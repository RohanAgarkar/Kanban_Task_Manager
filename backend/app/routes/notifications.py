from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.config.db import get_db
from app.modals.Modals import User, Notifications
from app.routes.auth import get_current_user
from app.schemas.Notifications import GetNotificationsResponse, NotificationResponse

notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])

@notifications_router.get("/", response_model=GetNotificationsResponse)
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch user's notifications ordered by newest first
    result = await db.execute(
        select(Notifications)
        .where(Notifications.user_id == current_user.id)
        .order_by(Notifications.created_at.desc())
        .limit(50) # Keep the payload light
    )
    notifications = result.scalars().all()
    
    unread_count = sum(1 for n in notifications if not n.is_read)
    
    return {"notifications": notifications, "unread_count": unread_count}

@notifications_router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notifications).where(
            Notifications.id == notification_id,
            Notifications.user_id == current_user.id
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.is_read = True
    await db.commit()
    return {"message": "Marked as read"}

@notifications_router.patch("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notifications)
        .where(Notifications.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All marked as read"}