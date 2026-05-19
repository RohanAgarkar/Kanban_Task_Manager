"""
TODO Checklist:
- [x] Create project creation endpoint
- [x] Create project retrieval endpoint
- [x] Create project rename endpoint
- [x] Create project deletion endpoint
- [x] Create project member management endpoints
    - [x] Add member
    - [x] Remove member
"""


from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, exists
from datetime import datetime, timezone



from app.config.db import get_db
from app.modals.Modals import User, Projects, ProjectMembers, ProjectColumns, UserRole
from app.routes.auth import get_current_user
from app.schemas.Projects import (
    GetAllProjectsResponse, 
    ProjectResponse, 
    GetProjectMembersResponse,
    ProjectMemberResponse,
    CreateProjectRequest,
    RenameProjectRequest,
    ColumnResponse,
    GetColumnsResponse,
    CreateColumnRequest,
    DeleteColumnRequest,
    RenameColumnRequest
)
from app.websockets.manager import manager



async def check_user_access(project_id: int, current_user: User, db: AsyncSession):
    result = await db.execute(
        select(Projects).where(
            Projects.id == project_id,
            or_(
                Projects.owner_id == current_user.id,
                exists().where(
                    and_(
                        ProjectMembers.project_id == project_id,
                        ProjectMembers.user_id == current_user.id
                    )
                )
            )
        )
    )

    project = result.scalar_one_or_none()

    if not project or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this project"
        )

    return project


projects_router = APIRouter(prefix="/projects", tags=["projects"])

@projects_router.get("/", response_model=GetAllProjectsResponse)
async def get_projects(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Get all projects for the current user
    Returns projects where user is either owner or member
    """
    # Get projects where user is owner
    if current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]:
        owner_projects_result = await db.execute(
            select(Projects).where(Projects.owner_id == current_user.id)
        )
        owner_projects = owner_projects_result.scalars().all()
    else:
        owner_projects = []
    
    # Get project IDs where user is member
    member_projects_result = await db.execute(
        select(ProjectMembers.project_id).where(ProjectMembers.user_id == current_user.id)
    )
    member_project_ids = [row[0] for row in member_projects_result.fetchall()]
    
    # Get projects where user is member (but not owner)
    if member_project_ids:
        member_projects_result = await db.execute(
            select(Projects).where(
                Projects.id.in_(member_project_ids),
                Projects.owner_id != current_user.id
            )
        )
        member_projects = member_projects_result.scalars().all()
    else:
        member_projects = []
    
    # Combine both lists
    all_projects = list(owner_projects) + member_projects
    
    project_responses = [
        ProjectResponse(
            id=project.id,
            project_name=project.project_name,
            created_at=project.created_at,
            updated_at=project.updated_at,
            is_owner=project.owner_id == current_user.id
        )
        for project in all_projects
    ]
    
    return GetAllProjectsResponse(projects=project_responses)

@projects_router.get("/{project_id}")
async def get_project(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    return ProjectResponse(
        id=project_access.id,
        project_name=project_access.project_name,
        created_at=project_access.created_at,
        updated_at=project_access.updated_at,
        is_owner=project_access.owner_id == current_user.id
    )

@projects_router.get("/{project_id}/members", response_model=GetProjectMembersResponse)
async def get_project_members(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Check if user has access to this project (owner or member)
    project_access = await db.execute(
        select(Projects).where(
            Projects.id == project_id,
            or_(
                Projects.owner_id == current_user.id,
                exists().where(
                    and_(
                        ProjectMembers.project_id == project_id,
                        ProjectMembers.user_id == current_user.id
                    )
                )
            )
        )
    )
    
    if not project_access.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access denied to this project"
        )
    
    # Get all members of the project
    members_result = await db.execute(
        select(ProjectMembers, User).join(User).where(ProjectMembers.project_id == project_id)
    )
    
    member_responses = []
    for member, user in members_result.fetchall():
        member_responses.append(
            ProjectMemberResponse(
                id=member.id,
                user_id_int=user.id,
                user_id=user.user_id,
                full_name=user.full_name,
                initials=user.initials,
                role=user.role.value,
                created_at=member.created_at
            )
        )
    
    return GetProjectMembersResponse(members=member_responses)


@projects_router.post("/create_project")
async def create_project(request: CreateProjectRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and managers can create projects"
        )
    
    new_project = Projects(
        project_name=request.project_name,
        owner_id=current_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    
    # Create default columns for the new project
    default_columns = [
        ProjectColumns(project_id=new_project.id, column_name="To Do", order=1),
        ProjectColumns(project_id=new_project.id, column_name="In Progress", order=2),
        ProjectColumns(project_id=new_project.id, column_name="Review", order=3),
        ProjectColumns(project_id=new_project.id, column_name="Done", order=4),
    ]
    
    db.add_all(default_columns)
    await db.commit()
    
    # Get the created columns with their IDs for response
    columns_result = await db.execute(
        select(ProjectColumns).where(ProjectColumns.project_id == new_project.id).order_by(ProjectColumns.order)
    )
    created_columns = columns_result.scalars().all()
    
    column_responses = [
        ColumnResponse(
            id=column.id,
            project_id=column.project_id,
            column_name=column.column_name,
            order=column.order
        )
        for column in created_columns
    ]
    
    # Broadcast project creation to all connected clients
    await manager.broadcast("project_created", {
        "project": {
            "id": new_project.id,
            "project_name": new_project.project_name,
            "owner_id": new_project.owner_id,
            "created_at": new_project.created_at.isoformat(),
            "updated_at": new_project.updated_at.isoformat()
        },
        "columns": [
            {
                "id": column.id,
                "project_id": column.project_id,
                "column_name": column.column_name,
                "order": column.order
            }
            for column in created_columns
        ],
        "created_by": current_user.user_id
    })
    
    return {
        "message": "Project created successfully", 
        "project_id": new_project.id,
        "columns": column_responses
    }

@projects_router.patch("/rename_project/{project_id}/{new_name}")
async def update_project(project_id: int, new_name: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to rename this project"
        )
    
    # Update project name
    project_access.project_name = new_name
    project_access.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project_access)
    
    # Broadcast project update to all connected clients
    await manager.broadcast("project_updated", {
        "project": {
            "id": project_access.id,
            "project_name": project_access.project_name,
            "updated_at": project_access.updated_at.isoformat()
        },
        "updated_by": current_user.user_id
    })

    return {"message": "Project renamed successfully"}

@projects_router.delete("/{project_id}")
async def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this project"
        )
    
    # Store project info for broadcast before deletion
    project_info = {
        "id": project_access.id,
        "project_name": project_access.project_name,
        "owner_id": project_access.owner_id
    }
    
    await db.delete(project_access)
    await db.commit()
    
    # Broadcast project deletion to all connected clients
    await manager.broadcast("project_deleted", {
        "project": project_info,
        "deleted_by": current_user.user_id
    })

    return {"message": "Project deleted successfully"}

@projects_router.post("/{project_id}/members/{user_id}")
async def add_member(project_id: int, user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to add members to this project"
        )
    
    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already a member
    existing_member = await db.execute(
        select(ProjectMembers).where(
            ProjectMembers.project_id == project_id,
            ProjectMembers.user_id == user_id
        )
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this project"
        )
    
    project_member = ProjectMembers(
        project_id=project_id,
        user_id=user_id
    )
    db.add(project_member)
    await db.commit()
    await db.refresh(project_member)
    
    # Broadcast member addition to all connected clients
    await manager.broadcast("member_added", {
        "project_id": project_id,
        "member": {
            "id": project_member.id,
            "user_id": user.user_id,
            "full_name": user.full_name,
            "initials": user.initials,
            "role": user.role.value
        },
        "added_by": current_user.user_id
    })

    return {"message": "Member added successfully"}

@projects_router.delete("/{project_id}/members/{user_id}")
async def remove_member(project_id: int, user_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project_access = await check_user_access(project_id, current_user, db)
    if not project_access or project_access.owner_id != current_user.id or current_user.role == UserRole.USER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to remove members from this project"
        )
    
    # Find the member to remove
    member_result = await db.execute(
        select(ProjectMembers).where(
            ProjectMembers.project_id == project_id,
            ProjectMembers.user_id == user_id
        )
    )
    project_member = member_result.scalar_one_or_none()
    
    if not project_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # Get user info for broadcast
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    await db.delete(project_member)
    await db.commit()
    
    # Broadcast member removal to all connected clients
    await manager.broadcast("member_removed", {
        "project_id": project_id,
        "member": {
            "id": project_member.id,
            "user_id": user.user_id if user else str(user_id),
            "full_name": user.full_name if user else "Unknown User",
            "initials": user.initials if user else "??"
        },
        "removed_by": current_user.user_id
    })

    return {"message": "Member removed successfully"}


@projects_router.get("/{project_id}/columns", response_model=GetColumnsResponse)
async def get_project_columns(project_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get all columns for a project, ordered by their order field"""
    # Check if user has access to this project
    project_access = await db.execute(
        select(Projects).where(
            Projects.id == project_id,
            or_(
                Projects.owner_id == current_user.id,
                exists().where(
                    and_(
                        ProjectMembers.project_id == project_id,
                        ProjectMembers.user_id == current_user.id
                    )
                )
            )
        )
    )
    
    if not project_access.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )
    
    # Get all columns for the project, ordered by order field
    columns_result = await db.execute(
        select(ProjectColumns).where(ProjectColumns.project_id == project_id).order_by(ProjectColumns.order)
    )
    
    columns = columns_result.scalars().all()
    
    column_responses = [
        ColumnResponse(
            id=column.id,
            project_id=column.project_id,
            column_name=column.column_name,
            order=column.order
        )
        for column in columns
    ]
    
    return GetColumnsResponse(columns=column_responses)


@projects_router.post("/{project_id}/columns", response_model=ColumnResponse)
async def create_project_column(
    project_id: int, 
    request: CreateColumnRequest, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """Create a new column for a project (Admins and Project Managers/Moderators only)"""
    # Check if user has admin/manager access to this project
    project_access = await db.execute(
        select(Projects).where(
            Projects.id == project_id,
            or_(
                Projects.owner_id == current_user.id,
                and_(
                    exists().where(
                        and_(
                            ProjectMembers.project_id == project_id,
                            ProjectMembers.user_id == current_user.id
                        )
                    ),
                    current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]
                )
            )
        )
    )
    
    project = project_access.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )
    
    # Check if column name already exists for this project
    existing_column = await db.execute(
        select(ProjectColumns).where(
            ProjectColumns.project_id == project_id,
            ProjectColumns.column_name == request.column_name
        )
    )
    
    if existing_column.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Column with this name already exists in the project"
        )
    
    # Create new column
    new_column = ProjectColumns(
        project_id=project_id,
        column_name=request.column_name,
        order=request.order
    )
    
    db.add(new_column)
    await db.commit()
    await db.refresh(new_column)
    
    # Broadcast column creation to all connected clients
    await manager.broadcast("column_created", {
        "column": {
            "id": new_column.id,
            "project_id": new_column.project_id,
            "column_name": new_column.column_name,
            "order": new_column.order
        },
        "created_by": current_user.user_id
    })
    
    return ColumnResponse(
        id=new_column.id,
        project_id=new_column.project_id,
        column_name=new_column.column_name,
        order=new_column.order
    )


@projects_router.delete("/columns/{column_id}")
async def delete_project_column(
    column_id: int,
    request: DeleteColumnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a column and optionally move its tasks to another column"""
    # Get the column to delete
    column_result = await db.execute(
        select(ProjectColumns).where(ProjectColumns.id == column_id)
    )
    column = column_result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Column not found"
        )
    
    # Check if user has admin/manager access to this project
    project_access = await db.execute(
        select(Projects).where(
            Projects.id == column.project_id,
            or_(
                Projects.owner_id == current_user.id,
                and_(
                    exists().where(
                        and_(
                            ProjectMembers.project_id == column.project_id,
                            ProjectMembers.user_id == current_user.id
                        )
                    ),
                    current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]
                )
            )
        )
    )
    
    if not project_access.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )
    
    # Handle tasks in the column
    from app.modals.Modals import Task
    
    tasks_result = await db.execute(
        select(Task).where(Task.column_name == column_id)
    )
    tasks = tasks_result.scalars().all()
    
    if tasks:
        if request.delete_tasks:
            # Delete all tasks in the column
            for task in tasks:
                await db.delete(task)
        elif request.move_tasks_to_column_id:
            # Move tasks to another column
            # Verify the target column exists and belongs to the same project
            target_column_result = await db.execute(
                select(ProjectColumns).where(
                    ProjectColumns.id == request.move_tasks_to_column_id,
                    ProjectColumns.project_id == column.project_id
                )
            )
            target_column = target_column_result.scalar_one_or_none()
            
            if not target_column:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Target column not found or does not belong to the same project"
                )
            
            # Move all tasks to the target column
            for task in tasks:
                task.column_name = request.move_tasks_to_column_id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Column contains tasks. Either specify move_tasks_to_column_id or set delete_tasks to true"
            )
    
    # Delete the column
    await db.delete(column)
    await db.commit()
    
    # Broadcast column deletion to all connected clients
    await manager.broadcast("column_deleted", {
        "column_id": column_id,
        "project_id": column.project_id,
        "deleted_by": current_user.user_id,
        "tasks_moved_to": request.move_tasks_to_column_id if not request.delete_tasks else None,
        "tasks_deleted": request.delete_tasks
    })
    
    return {"message": "Column deleted successfully"}


@projects_router.patch("/columns/{column_id}", response_model=ColumnResponse)
async def rename_project_column(
    column_id: int,
    request: RenameColumnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Rename a project column (Admins and Project Managers/Moderators only)"""
    # Get the column to rename
    column_result = await db.execute(
        select(ProjectColumns).where(ProjectColumns.id == column_id)
    )
    column = column_result.scalar_one_or_none()
    
    if not column:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Column not found"
        )
    
    # Check if user has admin/manager access to this project
    project_access = await db.execute(
        select(Projects).where(
            Projects.id == column.project_id,
            or_(
                Projects.owner_id == current_user.id,
                and_(
                    exists().where(
                        and_(
                            ProjectMembers.project_id == column.project_id,
                            ProjectMembers.user_id == current_user.id
                        )
                    ),
                    current_user.role in [UserRole.ADMIN, UserRole.MODERATOR]
                )
            )
        )
    )
    
    if not project_access.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this project"
        )
    
    # Check if column name already exists for this project (excluding current column)
    existing_column = await db.execute(
        select(ProjectColumns).where(
            ProjectColumns.project_id == column.project_id,
            ProjectColumns.column_name == request.column_name,
            ProjectColumns.id != column_id
        )
    )
    
    if existing_column.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Column with this name already exists in the project"
        )
    
    # Update column name
    old_column_name = column.column_name
    column.column_name = request.column_name
    await db.commit()
    await db.refresh(column)
    
    # Broadcast column rename to all connected clients
    await manager.broadcast("column_renamed", {
        "column": {
            "id": column.id,
            "project_id": column.project_id,
            "column_name": column.column_name,
            "order": column.order,
            "old_column_name": old_column_name
        },
        "renamed_by": current_user.user_id
    })
    
    return ColumnResponse(
        id=column.id,
        project_id=column.project_id,
        column_name=column.column_name,
        order=column.order
    )
