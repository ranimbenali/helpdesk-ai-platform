from sqlalchemy import Column, DateTime, Boolean, BigInteger, ForeignKey, Integer
from sqlalchemy.sql import func
from app.models.base import Base

class SLAInstance(Base):
    __tablename__ = "sla_instances"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    ticket_id = Column(
        BigInteger,
        ForeignKey("tickets.ticket_id", ondelete="CASCADE"),
        nullable=False, unique=True
    )

    due_response_at = Column(DateTime(timezone=True), nullable=True)
    due_resolve_at  = Column(DateTime(timezone=True), nullable=True)

    breached_response = Column(Boolean, nullable=False, server_default="false")
    breached_resolve  = Column(Boolean, nullable=False, server_default="false")

    risk_score = Column(Integer, nullable=False, server_default="0")

    # Score prédit par le modèle ML (GradientBoostingClassifier, notebook 05) à
    # partir du texte du ticket — distinct de risk_score qui, lui, mesure le
    # temps écoulé par rapport à l'échéance SLA. Null tant que non calculé.
    ml_risk_score = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )