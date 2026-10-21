from sqlalchemy import Column, DateTime, Text, BigInteger, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import TicketSource


class Message(Base):
    __tablename__ = "messages"

    message_id = Column(BigInteger, primary_key=True, autoincrement=True)

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

    content = Column(Text, nullable=False)

    is_internal = Column(Boolean, nullable=False, server_default="true")

    source = Column(
        SAEnum(TicketSource, name="ticket_source", create_type=False),
        nullable=False,
        server_default=TicketSource.WEB.value
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )