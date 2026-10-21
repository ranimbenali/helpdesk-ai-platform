from sqlalchemy import Column, DateTime, Text, BigInteger, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import AuditEventType


class AuditEvent(Base):
    __tablename__ = "audit_events"

    event_id = Column(BigInteger, primary_key=True, autoincrement=True)

    ticket_id = Column(
        BigInteger,
        ForeignKey("tickets.ticket_id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = Column(
        BigInteger,
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True
    )

    event_type = Column(
        SAEnum(AuditEventType, name="audit_event_type"),
        nullable=False
    )

    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )