from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Notification, User
from backend.routers.auth import _check_csrf, get_current_user
from backend.schemas.notifications import (
    ForumPostNotificationRequest,
    NotificationCreate,
    NotificationPage,
    NotificationRead,
)


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện việc này.",
        )
    return user


@router.get("", response_model=NotificationPage)
def list_notifications(
    response: Response,
    _: Annotated[User, Depends(get_current_user)],
    database: Annotated[Session, Depends(get_db)],
    before_id: Annotated[int | None, Query(gt=0)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
):
    response.headers["Cache-Control"] = "no-store"
    query = database.query(Notification)
    if before_id is not None:
        query = query.filter(Notification.id < before_id)

    notifications = (
        query.order_by(Notification.id.desc())
        .limit(limit + 1)
        .all()
    )
    has_more = len(notifications) > limit
    return {
        "items": notifications[:limit],
        "total_count": database.query(func.count(Notification.id)).scalar(),
        "has_more": has_more,
    }


@router.post(
    "",
    response_model=NotificationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_notification(
    payload: NotificationCreate,
    request: Request,
    database: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    _check_csrf(request)
    notification = Notification(
        title=payload.title.strip(),
        category=payload.category.strip(),
        description=payload.description.strip(),
    )
    if not notification.title or not notification.category or not notification.description:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tiêu đề, loại và nội dung thông báo không được để trống.",
        )

    database.add(notification)
    database.commit()
    database.refresh(notification)
    return notification


@router.post(
    "/forum-post",
    response_model=NotificationRead,
    status_code=status.HTTP_201_CREATED,
)
def notify_forum_post(
    payload: ForumPostNotificationRequest,
    request: Request,
    database: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _check_csrf(request)
    room = payload.room.strip()
    content = payload.content.strip()
    if not room or not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Phòng và nội dung bài đăng không được để trống.",
        )

    notification = Notification(
        category="Diễn đàn",
        title=f"Bài đăng mới: {room}"[:100],
        description=(
            f"Người đăng: {user.display_name}\n"
            f"Phòng: {room}\n"
            "Nội dung bài đăng:\n"
            f"{content}\n"
            f"Số ảnh đính kèm: {payload.image_count}"
        ),
    )
    database.add(notification)
    database.commit()
    database.refresh(notification)
    return notification
