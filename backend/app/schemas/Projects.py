from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
from app.models.Models import ProjectColumns


class ProjectResponse(BaseModel):
    """Response model for a single project"""
    id: int
    project_name: str
    created_at: datetime
    updated_at: datetime
    is_owner: bool
    
    class Config:
        from_attributes = True


class GetAllProjectsResponse(BaseModel):
    """Response model for get all projects endpoint"""
    projects: List[ProjectResponse]
    
    class Config:
        from_attributes = True


class ProjectMemberResponse(BaseModel):
    """Response model for a project member"""
    id: int
    user_id_int: int
    user_id: str
    full_name: str
    initials: str
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class GetProjectMembersResponse(BaseModel):
    """Response model for get project members endpoint"""
    members: List[ProjectMemberResponse]
    
    class Config:
        from_attributes = True


class CreateProjectRequest(BaseModel):
    """Request model for creating a new project"""
    project_name: str
    description: Optional[str] = None

class RenameProjectRequest(BaseModel):
    """Request model for renaming a project"""
    project_id: int
    project_name: str


class ColumnResponse(BaseModel):
    """Response model for a project column"""
    id: int
    project_id: int
    column_name: str
    order: int
    
    class Config:
        from_attributes = True


class GetColumnsResponse(BaseModel):
    """Response model for get project columns endpoint"""
    columns: List[ColumnResponse]
    
    class Config:
        from_attributes = True


class CreateColumnRequest(BaseModel):
    """Request model for creating a new column"""
    column_name: str
    order: int


class DeleteColumnRequest(BaseModel):
    """Request model for deleting a column"""
    move_tasks_to_column_id: Optional[int] = None
    delete_tasks: bool = False


class RenameColumnRequest(BaseModel):
    """Request model for renaming a column"""
    column_name: str
