from sqlalchemy import Column, DateTime, Text, BigInteger, Boolean, Enum as SAEnum
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import UserRole, UserStatus


class User(Base):
    __tablename__ = "users"

    user_id = Column(BigInteger, primary_key=True, autoincrement=True)

    full_name = Column(Text, nullable=False)
    email = Column(CITEXT, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)

    role = Column(SAEnum(UserRole, name="user_role", create_type=False),
                  nullable=False, server_default=UserRole.REQUESTER.value)
    status = Column(SAEnum(UserStatus, name="user_status", create_type=False),
                    nullable=False, server_default=UserStatus.ACTIVE.value)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    otp_code       = Column(Text, nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    reset_token            = Column(Text, nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    avatar_url  = Column(Text, nullable=True)
    fonction    = Column(Text, nullable=True)
    specialites = Column(Text, nullable=True)  # JSON array ex: '["Réseau","Matériel"]'

    phone               = Column(Text, nullable=True)
    preferred_language  = Column(Text, nullable=False, server_default="Français")
    notify_reply        = Column(Boolean, nullable=False, server_default="true")
    notify_resolved     = Column(Boolean, nullable=False, server_default="true")
    notify_news         = Column(Boolean, nullable=False, server_default="false")
    notify_weekly       = Column(Boolean, nullable=False, server_default="false")

    notify_new_ticket    = Column(Boolean, nullable=False, server_default="true")
    notify_sla_risk      = Column(Boolean, nullable=False, server_default="true")
    notify_mention       = Column(Boolean, nullable=False, server_default="true")
    notify_daily_digest  = Column(Boolean, nullable=False, server_default="false")
    notify_sounds        = Column(Boolean, nullable=False, server_default="false")

    notify_sla_breach    = Column(Boolean, nullable=False, server_default="true")
    notify_ticket_closed = Column(Boolean, nullable=False, server_default="false")
    notify_agent_idle    = Column(Boolean, nullable=False, server_default="false")
    notify_email_digest  = Column(Boolean, nullable=False, server_default="true")
    notify_inapp         = Column(Boolean, nullable=False, server_default="true")