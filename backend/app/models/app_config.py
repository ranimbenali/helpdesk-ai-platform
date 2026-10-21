from sqlalchemy import Column, Text, Boolean, Float, BigInteger
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.models.base import Base

class AppConfig(Base):
    __tablename__ = "app_config"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # Général
    app_name = Column(Text, nullable=False, server_default="Helpdesk IA")
    app_language = Column(Text, nullable=False, server_default="fr")

    # Geiser sync
    geiser_base_url = Column(Text, nullable=True)
    geiser_token = Column(Text, nullable=True)

    # IA
    ai_enabled = Column(Boolean, nullable=False, server_default="true")
    ai_confidence_threshold = Column(Float, nullable=False, server_default="0.7")
    ai_auto_assign = Column(Boolean, nullable=False, server_default="false")

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )