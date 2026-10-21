from sqlalchemy import Column, DateTime, Text, BigInteger, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base

class Ticket(Base):
    __tablename__ = "tickets"

    ticket_id = Column(BigInteger, primary_key=True, autoincrement=True)
    external_id = Column(BigInteger, unique=True, nullable=True)

    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    description_raw = Column(Text, nullable=True)
    description_text = Column(Text, nullable=True)

    requester_name = Column(Text, nullable=True)
    requester_user_id = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    assignee_name = Column(Text, nullable=True)

    assignee_user_id = Column(
        BigInteger,
        ForeignKey("users.user_id"),
        nullable=True
    )

    site = Column(Text, nullable=True)
    group_name = Column(Text, nullable=True)

    priority_label = Column(Text, nullable=True)
    status = Column(Text, nullable=False, server_default="OPEN")

    is_service_request = Column(Boolean, nullable=True)
    template_name = Column(Text, nullable=True)
    is_template_service = Column(Boolean, nullable=True)

    due_at = Column(DateTime(timezone=False), nullable=True)
    created_at = Column(DateTime(timezone=False), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    imported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    priority_manually_updated  = Column(Boolean, nullable=False, server_default="false")
    status_manually_updated    = Column(Boolean, nullable=False, server_default="false")
    assignee_manually_updated  = Column(Boolean, nullable=False, server_default="false")

    # ✅ AJOUT : Catégorie et sous-catégorie
    category    = Column(Text, nullable=True)
    subcategory = Column(Text, nullable=True)