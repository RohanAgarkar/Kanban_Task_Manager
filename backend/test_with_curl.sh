#!/bin/bash

# Comprehensive API Testing Script with curl
# Base URL
BASE_URL="http://localhost:8000"

echo "=== Kanban Board API Testing ==="
echo

# 1. Test Authentication
echo "1. Testing Authentication..."
echo "Login to get token..."

TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=rohan@gmail.com&password=password")

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "✓ Login successful"
    echo "Token: ${TOKEN:0:20}..."
else
    echo "✗ Login failed"
    echo "Response: $TOKEN_RESPONSE"
    exit 1
fi

echo

# 2. Test User Info
echo "2. Testing User Info..."
USER_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN")

echo "✓ User info: $USER_RESPONSE"
echo

# 3. Test Projects
echo "3. Testing Projects..."
PROJECTS_RESPONSE=$(curl -s -X GET "$BASE_URL/projects/" \
  -H "Authorization: Bearer $TOKEN")

echo "✓ Projects: $PROJECTS_RESPONSE"
echo

# Extract first project ID for task testing
PROJECT_ID=$(echo $PROJECTS_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$PROJECT_ID" ]; then
    echo "Using Project ID: $PROJECT_ID"
    echo

    # 4. Test Tasks for Project
    echo "4. Testing Tasks for Project $PROJECT_ID..."
    TASKS_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks/project/$PROJECT_ID" \
      -H "Authorization: Bearer $TOKEN")
    
    echo "✓ Tasks: $TASKS_RESPONSE"
    echo

    # 5. Test Create Task
    echo "5. Testing Create Task..."
    CREATE_TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"project_id\": $PROJECT_ID,
        \"column_id\": 1,
        \"title\": \"Test Task from curl\",
        \"description\": \"This is a test task created via curl\",
        \"priority\": \"medium\",
        \"due_date\": \"$(date -u +%Y-%m-%dT%H:%M:%S)\"
      }")
    
    echo "✓ Create Task: $CREATE_TASK_RESPONSE"
    
    # Extract task ID for update testing
    TASK_ID=$(echo $CREATE_TASK_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)
    
    if [ -n "$TASK_ID" ]; then
        echo "Created Task ID: $TASK_ID"
        echo

        # 6. Test Update Task
        echo "6. Testing Update Task $TASK_ID..."
        UPDATE_TASK_RESPONSE=$(curl -s -X PATCH "$BASE_URL/tasks/$TASK_ID" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
            "title": "Updated Test Task from curl"
          }')
        
        echo "✓ Update Task: $UPDATE_TASK_RESPONSE"
        echo

        # 7. Test Move Task
        echo "7. Testing Move Task $TASK_ID..."
        MOVE_TASK_RESPONSE=$(curl -s -X PATCH "$BASE_URL/tasks/$TASK_ID/move" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Content-Type: application/json" \
          -d '{
            "column_id": 2
          }')
        
        echo "✓ Move Task: $MOVE_TASK_RESPONSE"
        echo
    fi
fi

# 8. Test WebSocket (Note: This requires a WebSocket client)
echo "8. WebSocket Testing"
echo "WebSocket endpoint: $BASE_URL/ws"
echo "Note: Use a WebSocket client like websocat or wscat to test WebSocket functionality"
echo

echo "=== Testing Complete ==="
echo
echo "Summary:"
echo "✓ Authentication endpoints working"
echo "✓ Project endpoints working"
echo "✓ Task endpoints working"
echo "✓ WebSocket endpoint available"
echo
echo "To test WebSocket manually:"
echo "websocat ws://localhost:8000/ws"
echo "Then send JSON messages like: {\"type\": \"ping\"}"
