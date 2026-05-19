from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: bool
    task_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GetNotificationsResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int