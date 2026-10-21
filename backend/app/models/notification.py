from sqlalchemy import Column, Text, Boolean, BigInteger, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.models.base import Base
from app.models.enums import NotificationType, NotificationStatus


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(BigInteger, primary_key=True, autoincrement=True)

    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False
    )

    ticket_id = Column(
        BigInteger,
        ForeignKey("tickets.ticket_id", ondelete="CASCADE"),
        nullable=True
    )

    type = Column(
        SAEnum(NotificationType, name="notification_type", create_type=False),
        nullable=False
    )

    status = Column(
        SAEnum(NotificationStatus, name="notification_status", create_type=False),
        nullable=False,
        server_default=NotificationStatus.PENDING.value
    )

    title   = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, server_default="false")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )