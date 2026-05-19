from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
from app.modals.Modals import ColumnNames, Priority, ProjectColumns, TaskAttachments


class TaskResponse(BaseModel):
    """Response model for a single task"""
    id: int
    project_id: int
    column_id: int
    title: str
    description: str
    priority: str
    due_date: datetime
    created_by: int
    updated_by: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaskAssigneeResponse(BaseModel):
    """Response model for a task assignee"""
    id: int
    user_id: str
    full_name: str
    initials: str
    
    class Config:
        from_attributes = True


class TaskWithAssigneesResponse(BaseModel):
    """Response model for a task with its assignees"""
    task: TaskResponse
    assignees: List[TaskAssigneeResponse]
    
    class Config:
        from_attributes = True


class GetTasksResponse(BaseModel):
    """Response model for get all tasks endpoint"""
    tasks: List[TaskWithAssigneesResponse]
    
    class Config:
        from_attributes = True


class CreateTaskRequest(BaseModel):
    """Request model for creating a new task"""
    project_id: int
    column_id: int
    title: str
    description: str
    priority: Priority
    due_date: datetime


class UpdateTaskRequest(BaseModel):
    """Request model for updating a task"""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    due_date: Optional[datetime] = None


class MoveTaskRequest(BaseModel):
    """Request model for moving a task to a different column"""
    column_id: int


class AssignTaskRequest(BaseModel):
    """Request model for assigning users to a task"""
    user_ids: List[int]


class CommentResponse(BaseModel):
    """Response model for a single comment"""
    id: int
    task_id: int
    user_id: str
    comment: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class GetCommentsResponse(BaseModel):
    """Response model for get comments endpoint"""
    comments: List[CommentResponse]
    
    class Config:
        from_attributes = True


class AddCommentRequest(BaseModel):
    """Request model for adding a comment"""
    comment: str


class TaskAttachmentResponse(BaseModel):
    """Response model for a task attachment"""
    id: int
    task_id: int
    file_name: str
    file_path: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaskWithAttachmentsResponse(BaseModel):
    """Response model for a task with its attachments"""
    task: TaskResponse
    attachments: List[TaskAttachmentResponse]
    
    class Config:
        from_attributes = True
