from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.enums import AuditEventType, TicketSource, SyncStatus, SyncType

class TicketListItem(BaseModel):
    ticket_id: int
    external_id: Optional[int] = None
    title: str
    requester_name: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_manually_updated: Optional[bool] = None
    site: Optional[str] = None
    group_name: Optional[str] = None
    priority_label: Optional[str] = None
    status: str
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    due_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TicketDetail(BaseModel):
    ticket_id: int
    external_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    description_raw: Optional[str] = None
    description_text: Optional[str] = None

    requester_name: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_user_id: Optional[int] = None
    assignee_manually_updated: Optional[bool] = None

    site: Optional[str] = None
    group_name: Optional[str] = None

    priority_label: Optional[str] = None
    status: str

    is_service_request: Optional[bool] = None
    template_name: Optional[str] = None
    is_template_service: Optional[bool] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None

    due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    imported_at: datetime

    class Config:
        from_attributes = True


class TicketUpdateStatus(BaseModel):
    status: str


class TicketUpdatePriority(BaseModel):
    priority_label: str


class TicketAssignAgent(BaseModel):
    assignee_user_id: int


class AuditEventItem(BaseModel):
    event_id: int
    ticket_id: int
    user_id: Optional[int] = None
    author_name: Optional[str] = None
    event_type: AuditEventType
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TicketAuditResponse(BaseModel):
    items: list[AuditEventItem]


class MessageItem(BaseModel):
    message_id: int
    ticket_id: int
    user_id: Optional[int] = None
    author_name: Optional[str] = None
    content: str
    is_internal: bool
    source: TicketSource
    created_at: datetime


class MessageCreate(BaseModel):
    content: str
    is_internal: bool = True


class TicketMessagesResponse(BaseModel):
    items: list[MessageItem]

class SyncLogItem(BaseModel):
    sync_log_id: int
    type: SyncType
    status: SyncStatus
    timestamp: datetime
    message: Optional[str] = None
    fetched_count: int
    created_count: int
    updated_count: int
    skipped_count: int
    error_count: int

    class Config:
        from_attributes = True


class SyncLogsResponse(BaseModel):
    items: list[SyncLogItem]

class TicketCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority_label: Optional[str] = "Normale"   