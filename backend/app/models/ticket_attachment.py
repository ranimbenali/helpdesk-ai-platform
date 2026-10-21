from sqlalchemy import Column, DateTime, Text, BigInteger, String, ForeignKey
from sqlalchemy.sql import func

from app.models.base import Base


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    attachment_id  = Column(BigInteger, primary_key=True, autoincrement=True)
    ticket_id      = Column(BigInteger, ForeignKey("tickets.ticket_id", ondelete="CASCADE"), nullable=False)

    original_name  = Column(String(255), nullable=False)   # nom du fichier tel qu'envoyé par l'utilisateur
    stored_name    = Column(String(255), nullable=False)   # nom unique sur disque (uuid)
    content_type   = Column(String(100), nullable=True)
    size_bytes     = Column(BigInteger, nullable=False)

    uploaded_by    = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    uploaded_by_name = Column(String(255), nullable=True)  # nom au moment de l'upload
    created_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
