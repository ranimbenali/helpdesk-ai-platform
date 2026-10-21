from sqlalchemy import Column, DateTime, Text, BigInteger, Integer, Enum as SAEnum
from sqlalchemy.sql import func

from app.models.base import Base
from app.models.enums import SyncStatus, SyncType


class SyncLog(Base):
    __tablename__ = "sync_logs"

    sync_log_id = Column(BigInteger, primary_key=True, autoincrement=True)

    type = Column(
        SAEnum(SyncType, name="sync_type"),
        nullable=False
    )

    status = Column(
        SAEnum(SyncStatus, name="sync_status"),
        nullable=False
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    message = Column(Text, nullable=True)

    fetched_count = Column(Integer, nullable=False, server_default="0")
    created_count = Column(Integer, nullable=False, server_default="0")
    updated_count = Column(Integer, nullable=False, server_default="0")
    skipped_count = Column(Integer, nullable=False, server_default="0")
    error_count = Column(Integer, nullable=False, server_default="0")