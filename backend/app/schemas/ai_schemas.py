from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── AI Classification ────────────────────────────────────────

class AIClassificationResult(BaseModel):
    """Résultat retourné par l'IA"""
    predicted_priority:    Optional[str]   = None
    predicted_category:    Optional[str]   = None
    predicted_subcategory: Optional[str]   = None
    confidence:            Optional[float] = None
    keywords:              Optional[str]   = None  # JSON string
    model_version:         Optional[str]   = None


class AIClassificationResponse(BaseModel):
    """Réponse API pour une classification"""
    ai_classif_id:         int
    ticket_id:             int
    predicted_priority:    Optional[str]   = None
    predicted_category:    Optional[str]   = None
    predicted_subcategory: Optional[str]   = None
    confidence:            Optional[float] = None
    keywords:              Optional[str]   = None
    model_version:         Optional[str]   = None
    validation_status:     str
    validated_by:          Optional[int]   = None
    validated_at:          Optional[datetime] = None
    created_at:            datetime

    class Config:
        from_attributes = True


class AIValidationPayload(BaseModel):
    """Payload pour valider/rejeter/corriger une classification"""
    validation_status:     str            # VALIDATED / REJECTED / CORRECTED
    corrected_priority:    Optional[str]  = None
    corrected_category:    Optional[str]  = None
    corrected_subcategory: Optional[str]  = None


# ── AI Response ──────────────────────────────────────────────

class AIResponseResponse(BaseModel):
    """Réponse API pour une réponse automatique"""
    ai_response_id: int
    ticket_id:      int
    generated_text: str
    confidence:     Optional[float] = None
    model_version:  Optional[str]   = None
    corrected_text: Optional[str]   = None
    created_at:     datetime

    class Config:
        from_attributes = True


class AIResponseCorrection(BaseModel):
    """Payload pour corriger une réponse IA"""
    corrected_text: str