#!/usr/bin/env python3
"""
Comprehensive endpoint testing script
"""
import asyncio
import aiohttp
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def test_authentication():
    """Test authentication endpoints"""
    print("\n=== Testing Authentication Endpoints ===")
    
    async with aiohttp.ClientSession() as session:
        # Test login with form data
        login_data = aiohttp.FormData()
        login_data.add_field('username', 'rohan@gmail.com')
        login_data.add_field('password', 'password')
        
        async with session.post(f"{BASE_URL}/auth/login", data=login_data) as resp:
            if resp.status == 200:
                data = await resp.json()
                print(f"✓ Login successful: Token received")
                return data["access_token"]
            else:
                error_text = await resp.text()
                print(f"✗ Login failed: {resp.status} - {error_text}")
                return None

async def test_projects(token):
    """Test project endpoints"""
    print("\n=== Testing Project Endpoints ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    async with aiohttp.ClientSession() as session:
        # Get all projects
        async with session.get(f"{BASE_URL}/projects/", headers=headers) as resp:
            if resp.status == 200:
                projects_data = await resp.json()
                print(f"✓ Get projects: Found {len(projects_data)} projects")
                return projects_data
            else:
                error_text = await resp.text()
                print(f"✗ Get projects failed: {resp.status} - {error_text}")
                return []

async def test_tasks(token, projects):
    """Test task endpoints"""
    print("\n=== Testing Task Endpoints ===")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    if not projects:
        print("✗ No projects available for task testing")
        return
    
    # Handle different response formats
    if isinstance(projects, list) and len(projects) > 0:
        project = projects[0]
    elif isinstance(projects, dict) and "projects" in projects:
        project = projects["projects"][0] if projects["projects"] else None
    else:
        project = projects if projects else None
    
    if not project:
        print("✗ No valid project found for task testing")
        return
        
    project_id = project["id"]
    
    async with aiohttp.ClientSession() as session:
        # Get tasks for project
        async with session.get(f"{BASE_URL}/tasks/project/{project_id}", headers=headers) as resp:
            if resp.status == 200:
                tasks_data = await resp.json()
                tasks = tasks_data.get("tasks", [])
                print(f"✓ Get tasks: Found {len(tasks)} tasks")
                
                # Test creating a task
                create_task_data = {
                    "project_id": project_id,
                    "column_id": 1,  # Assuming column 1 exists
                    "title": "Test Task",
                    "description": "This is a test task",
                    "priority": "medium",
                    "due_date": datetime.now().isoformat()
                }
                
                async with session.post(f"{BASE_URL}/tasks/", json=create_task_data, headers=headers) as resp:
                    if resp.status == 200:
                        new_task = await resp.json()
                        print(f"✓ Create task: {new_task['title']}")
                        
                        # Test updating the task
                        update_data = {"title": "Updated Test Task"}
                        async with session.patch(f"{BASE_URL}/tasks/{new_task['id']}", json=update_data, headers=headers) as resp:
                            if resp.status == 200:
                                updated_task = await resp.json()
                                print(f"✓ Update task: {updated_task['title']}")
                            else:
                                print(f"✗ Update task failed: {resp.status}")
                    else:
                        print(f"✗ Create task failed: {resp.status}")
            else:
                print(f"✗ Get tasks failed: {resp.status}")

async def test_websocket():
    """Test WebSocket endpoint"""
    print("\n=== Testing WebSocket Endpoint ===")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(f"{BASE_URL}/ws") as ws:
                print("✓ WebSocket connection established")
                
                # Send a test message
                await ws.send_str(json.dumps({"type": "ping"}))
                
                # Wait for response
                try:
                    msg = await asyncio.wait_for(ws.receive(), timeout=2.0)
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        print(f"✓ WebSocket message received: {msg.data}")
                    else:
                        print(f"✗ WebSocket message type: {msg.type}")
                except asyncio.TimeoutError:
                    print("✗ WebSocket response timeout")
                    
                await ws.close()
                print("✓ WebSocket connection closed")
    except Exception as e:
        print(f"✗ WebSocket test failed: {e}")

async def main():
    """Run all endpoint tests"""
    print("Starting comprehensive endpoint testing...")
    
    # Test authentication first
    token = await test_authentication()
    
    if token:
        # Test projects
        projects = await test_projects(token)
        
        # Test tasks
        await test_tasks(token, projects)
        
        # Test WebSocket
        await test_websocket()
    else:
        print("✗ Authentication failed, skipping other tests")
    
    print("\n=== Testing Complete ===")

if __name__ == "__main__":
    asyncio.run(main())
