from sqlalchemy import Column, BigInteger, Text, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base


class AIResponse(Base):
    __tablename__ = "ai_responses"

    ai_response_id  = Column(BigInteger, primary_key=True, autoincrement=True)

    # Lien vers le ticket
    ticket_id       = Column(BigInteger, ForeignKey("tickets.ticket_id"), nullable=False)

    # Réponse générée par l'IA
    generated_text  = Column(Text, nullable=False)   # réponse automatique suggérée
    confidence      = Column(Float, nullable=True)   # 0.0 → 1.0
    model_version   = Column(Text, nullable=True)    # ex: "gpt-4o-mini"

    # Correction éventuelle par l'agent
    corrected_text  = Column(Text, nullable=True)    # si l'agent modifie la réponse

    created_at      = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)