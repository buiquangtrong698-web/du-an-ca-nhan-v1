from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    title: str
    description: str
    created_at: datetime

    @field_validator("created_at")
    @classmethod
    def ensure_utc_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class NotificationPage(BaseModel):
    items: list[NotificationRead]
    total_count: int
    has_more: bool


class NotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=5000)


class ForumPostNotificationRequest(BaseModel):
    room: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=5000)
    image_count: int = Field(default=0, ge=0, le=4)
