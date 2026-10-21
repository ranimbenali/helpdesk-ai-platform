from sqlalchemy import Column, DateTime, Text, BigInteger, String, ForeignKey
from sqlalchemy.sql import func

from app.models.base import Base


class SystemLog(Base):
    __tablename__ = "system_logs"

    log_id     = Column(BigInteger, primary_key=True, autoincrement=True)
    event_type = Column(String(60), nullable=False)   # login.success, user.created, …
    category   = Column(String(50), nullable=True)    # Authentification, Permissions, Système
    user_id    = Column(BigInteger, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    user_name  = Column(String(255), nullable=True)   # nom au moment de l'événement
    detail     = Column(Text, nullable=True)
    severity   = Column(String(20), default="Info")   # Info | Avertis. | Critique
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
