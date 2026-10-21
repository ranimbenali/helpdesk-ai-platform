from sqlalchemy import Column, Text, Integer, BigInteger, Boolean
from app.models.base import Base

class SLAPolicy(Base):
    __tablename__ = "sla_policies"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    priority       = Column(Text, nullable=False, unique=True)
    response_time  = Column(Integer, nullable=False)  # en minutes
    resolve_time   = Column(Integer, nullable=False)  # en minutes
    is_active      = Column(Boolean, nullable=False, server_default="true")