from sqlalchemy import Column, BigInteger, Text, Float, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.sql import func
from app.models.base import Base
import enum


class AIValidationStatus(str, enum.Enum):
    PENDING   = "PENDING"
    VALIDATED = "VALIDATED"
    REJECTED  = "REJECTED"
    CORRECTED = "CORRECTED"


class AIClassification(Base):
    __tablename__ = "ai_classifications"

    ai_classif_id         = Column(BigInteger, primary_key=True, autoincrement=True)

    # Lien vers le ticket
    ticket_id             = Column(BigInteger, ForeignKey("tickets.ticket_id"), nullable=False)

    # Résultats de la classification
    predicted_priority    = Column(Text, nullable=True)   # Urgente / Haute / Normale / Faible
    predicted_category    = Column(Text, nullable=True)   # Réseau / Matériel / ...
    predicted_subcategory = Column(Text, nullable=True)   # VPN / WiFi / ...
    confidence            = Column(Float, nullable=True)  # confiance du modèle retenu (0.0 → 1.0)
    ml_confidence         = Column(Float, nullable=True)  # confiance ML brute (présente même si LLM retenu)
    keywords              = Column(Text, nullable=True)   # JSON string ["vpn", "connexion"]
    model_version         = Column(Text, nullable=True)   # ex: "ML-TF-IDF-LinearSVC-v2"

    # Détection d'anomalies (Isolation Forest, notebook 05) — ticket atypique
    # par rapport au corpus historique. anomaly_score n'est pas une probabilité,
    # juste un score relatif (plus négatif = plus atypique).
    is_anomaly            = Column(Boolean, nullable=True)
    anomaly_score         = Column(Float, nullable=True)

    # Clustering thématique (KMeans, notebook 05) — regroupe les tickets par
    # thème récurrent. Voir predict_cluster() pour les limites connues (K=3).
    cluster_id            = Column(BigInteger, nullable=True)

    # Validation par l'agent/admin
    validation_status     = Column(
        SAEnum(AIValidationStatus, name="ai_validation_status", create_type=True),
        nullable=False,
        server_default=AIValidationStatus.PENDING.value,
    )
    validated_by          = Column(BigInteger, ForeignKey("users.user_id"), nullable=True)
    validated_at          = Column(DateTime(timezone=True), nullable=True)

    created_at            = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)