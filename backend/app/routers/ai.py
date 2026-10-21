"""
Routes IA — Helpdesk Geiser
GET  /ai/tickets/{ticket_id}/result    → voir résultats IA d'un ticket
POST /ai/tickets/{ticket_id}/analyze   → (re)analyser manuellement
POST /ai/tickets/{ticket_id}/validate  → valider/rejeter/corriger la classification
POST /ai/tickets/{ticket_id}/apply-reply → appliquer la réponse automatique
GET  /ai/stats                         → statistiques globales IA
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from app.core.current_user import get_current_user
from app.core.permissions import Permission, require_permission
from app.db.session import get_db, SessionLocal
from app.models.ai_classification import AIClassification, AIValidationStatus
from app.models.ai_response import AIResponse
from app.models.ticket import Ticket
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.ai_schemas import (
    AIClassificationResponse,
    AIValidationPayload,
    AIResponseResponse,
)

router = APIRouter(prefix="/ai", tags=["ai"])


def _latest_classification_ids(db: Session):
    """Sous-requête : id de la classification la plus récente pour chaque ticket.

    Chaque (ré)analyse IA insère une nouvelle ligne AIClassification au lieu de
    mettre à jour l'existante (historique immuable) — sans ce filtre, une vieille
    ligne PENDING jamais retouchée peut faire réapparaître un ticket déjà validé.
    """
    return (
        db.query(func.max(AIClassification.ai_classif_id))
        .group_by(AIClassification.ticket_id)
        .subquery()
    )


# ── GET /ai/tickets/{ticket_id}/result ───────────────────────────────────────
@router.get("/tickets/{ticket_id}/result")
def get_ai_result(
    ticket_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les résultats IA pour un ticket donné"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Classification
    classification = (
        db.query(AIClassification)
        .filter(AIClassification.ticket_id == ticket_id)
        .order_by(AIClassification.created_at.desc())
        .first()
    )

    # Réponse automatique
    ai_response = (
        db.query(AIResponse)
        .filter(AIResponse.ticket_id == ticket_id)
        .order_by(AIResponse.created_at.desc())
        .first()
    )

    import json

    # Agent suggéré pour la catégorie prédite
    suggested_agent = None
    if classification and classification.predicted_category:
        from app.services.ai_service import suggest_agent
        routing = suggest_agent(db, classification.predicted_category)
        if routing:
            agent = routing["agent"]
            suggested_agent = {
                "user_id":   agent.user_id,
                "full_name": agent.full_name,
                "email":     agent.email,
                "score":     routing["score"],
                "expertise": routing["expertise"],
                "load":      routing["load"],
            }

    return {
        "ticket_id": ticket_id,
        "classification": {
            "ai_classif_id":         classification.ai_classif_id if classification else None,
            "predicted_category":    classification.predicted_category if classification else None,
            "predicted_subcategory": classification.predicted_subcategory if classification else None,
            "predicted_priority":    classification.predicted_priority if classification else None,
            "confidence":            classification.confidence if classification else None,
            "ml_confidence":         classification.ml_confidence if classification else None,
            "keywords":              json.loads(classification.keywords) if classification and classification.keywords else [],
            "model_version":         classification.model_version if classification else None,
            "validation_status":     classification.validation_status.value if classification else None,
            "validated_by":          classification.validated_by if classification else None,
            "validated_at":          classification.validated_at.isoformat() if classification and classification.validated_at else None,
            "created_at":            classification.created_at.isoformat() if classification else None,
        } if classification else None,
        "auto_reply": {
            "ai_response_id": ai_response.ai_response_id if ai_response else None,
            "generated_text": ai_response.generated_text if ai_response else None,
            "corrected_text": ai_response.corrected_text if ai_response else None,
            "confidence":     ai_response.confidence if ai_response else None,
            "model_version":  ai_response.model_version if ai_response else None,
            "created_at":     ai_response.created_at.isoformat() if ai_response else None,
        } if ai_response else None,
        "suggested_agent": suggested_agent,
        "ai_processed": classification is not None,
    }


# ── POST /ai/tickets/{ticket_id}/analyze ─────────────────────────────────────
@router.post("/tickets/{ticket_id}/analyze")
def analyze_ticket(
    ticket_id: int,
    background_tasks: BackgroundTasks,
    current: User = Depends(require_permission(Permission.AI_VALIDATE)),
    db: Session = Depends(get_db),
):
    """(Re)analyser manuellement un ticket avec l'IA"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    from app.services.ai_service import process_ticket_with_ai
    from app.models.app_config import AppConfig

    settings  = db.query(AppConfig).first()
    threshold = settings.ai_confidence_threshold if settings else 0.75
    auto_assign = settings.ai_auto_assign if settings else False

    def run_ai(tid: int, thr: float, aa: bool):
        bg_db = SessionLocal()
        try:
            process_ticket_with_ai(db=bg_db, ticket_id=tid,
                                   ai_confidence_threshold=thr, ai_auto_assign=aa)
        finally:
            bg_db.close()

    background_tasks.add_task(run_ai, ticket_id, threshold, auto_assign)

    return {"message": f"Analyse IA lancée pour le ticket #{ticket_id}"}


# ── POST /ai/tickets/{ticket_id}/validate ────────────────────────────────────
@router.post("/tickets/{ticket_id}/validate")
def validate_ai_classification(
    ticket_id: int,
    payload: AIValidationPayload,
    current: User = Depends(require_permission(Permission.AI_VALIDATE)),
    db: Session = Depends(get_db),
):
    """Valider, rejeter ou corriger la classification IA"""
    classification = (
        db.query(AIClassification)
        .filter(AIClassification.ticket_id == ticket_id)
        .order_by(AIClassification.created_at.desc())
        .first()
    )
    if not classification:
        raise HTTPException(status_code=404, detail="Aucune classification IA trouvée")

    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Mettre à jour le statut de validation
    try:
        classification.validation_status = AIValidationStatus(payload.validation_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Statut de validation invalide")

    classification.validated_by  = current.user_id
    classification.validated_at  = datetime.now(timezone.utc)

    # Si CORRECTED → appliquer les corrections au ticket
    if payload.validation_status == "CORRECTED":
        if payload.corrected_category:
            ticket.category    = payload.corrected_category
            classification.predicted_category = payload.corrected_category
        if payload.corrected_subcategory:
            ticket.subcategory = payload.corrected_subcategory
            classification.predicted_subcategory = payload.corrected_subcategory
        if payload.corrected_priority:
            ticket.priority_label = payload.corrected_priority
            classification.predicted_priority = payload.corrected_priority
            ticket.priority_manually_updated = True

    # Si VALIDATED → appliquer la classification originale au ticket
    elif payload.validation_status == "VALIDATED":
        if classification.predicted_category:
            ticket.category    = classification.predicted_category
            ticket.subcategory = classification.predicted_subcategory
        if classification.predicted_priority and not ticket.priority_manually_updated:
            ticket.priority_label = classification.predicted_priority

    db.commit()

    return {
        "message": f"Classification {payload.validation_status} avec succès",
        "ticket_id": ticket_id,
        "validation_status": payload.validation_status,
    }


# ── POST /ai/tickets/{ticket_id}/apply-reply ─────────────────────────────────
@router.post("/tickets/{ticket_id}/apply-reply")
def apply_auto_reply(
    ticket_id: int,
    payload: dict,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Appliquer la réponse automatique IA comme message sur le ticket"""
    from app.models.message import Message
    from app.models.enums import TicketSource

    ai_response = (
        db.query(AIResponse)
        .filter(AIResponse.ticket_id == ticket_id)
        .order_by(AIResponse.created_at.desc())
        .first()
    )
    if not ai_response:
        raise HTTPException(status_code=404, detail="Aucune réponse IA trouvée")

    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Utiliser le texte corrigé si disponible, sinon le texte généré
    text = ai_response.corrected_text or ai_response.generated_text

    # Créer le message
    message = Message(
        ticket_id=ticket_id,
        user_id=current.user_id,
        content=f"🤖 Réponse automatique IA :\n\n{text}",
        is_internal=False,
        source=TicketSource.WEB,
    )
    db.add(message)

    # Sauvegarder la correction éventuelle
    if payload.get("corrected_text"):
        ai_response.corrected_text = payload["corrected_text"]

    db.commit()

    return {"message": "Réponse IA appliquée avec succès", "ticket_id": ticket_id}


# ── GET /ai/pending ───────────────────────────────────────────────────────────
@router.get("/pending")
def get_pending_classifications(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les tickets avec classification IA en attente de validation"""
    import json

    latest_ids = _latest_classification_ids(db)

    rows = (
        db.query(Ticket, AIClassification)
        .join(AIClassification, AIClassification.ticket_id == Ticket.ticket_id)
        .filter(AIClassification.ai_classif_id.in_(latest_ids))
        .filter(AIClassification.validation_status == AIValidationStatus.PENDING)
        .order_by(AIClassification.created_at.desc())
        .limit(100)
        .all()
    )

    results = []
    for ticket, clf in rows:
        ai_response = (
            db.query(AIResponse)
            .filter(AIResponse.ticket_id == ticket.ticket_id)
            .order_by(AIResponse.created_at.desc())
            .first()
        )
        # Agent suggéré pour ce ticket
        from app.services.ai_service import suggest_agent
        routing = suggest_agent(db, clf.predicted_category) if clf.predicted_category else None
        if routing:
            a = routing["agent"]
            suggested_agent = {
                "user_id":   a.user_id,
                "full_name": a.full_name,
                "email":     a.email,
                "score":     routing["score"],
                "expertise": routing["expertise"],
                "load":      routing["load"],
            }
        else:
            suggested_agent = None

        results.append({
            "ticket_id":       ticket.ticket_id,
            "title":           ticket.title,
            "description":     ticket.description_text or ticket.description,
            "status":          ticket.status,
            "requester_name":  ticket.requester_name,
            "created_at":      ticket.created_at.isoformat() if ticket.created_at else None,
            "classification": {
                "ai_classif_id":         clf.ai_classif_id,
                "predicted_category":    clf.predicted_category,
                "predicted_subcategory": clf.predicted_subcategory,
                "predicted_priority":    clf.predicted_priority,
                "confidence":            clf.confidence,
                "ml_confidence":         clf.ml_confidence,
                "keywords":              json.loads(clf.keywords) if clf.keywords else [],
                "model_version":         clf.model_version,
                "validation_status":     clf.validation_status.value,
                "created_at":            clf.created_at.isoformat() if clf.created_at else None,
            },
            "auto_reply":      ai_response.generated_text if ai_response else None,
            "suggested_agent": suggested_agent,
        })

    return results


# ── GET /ai/classified ───────────────────────────────────────────────────────
@router.get("/classified")
def get_classified_tickets(
    status: str = "VALIDATED",   # VALIDATED | CORRECTED | REJECTED
    limit: int = 100,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les tickets dont la classification a été validée, corrigée ou rejetée"""
    import json

    allowed = {"VALIDATED", "CORRECTED", "REJECTED"}
    statuses = [s.strip().upper() for s in status.split(",") if s.strip().upper() in allowed]
    if not statuses:
        return []

    status_enums = [AIValidationStatus(s) for s in statuses]
    latest_ids = _latest_classification_ids(db)

    rows = (
        db.query(Ticket, AIClassification)
        .join(AIClassification, AIClassification.ticket_id == Ticket.ticket_id)
        .filter(AIClassification.ai_classif_id.in_(latest_ids))
        .filter(AIClassification.validation_status.in_(status_enums))
        .order_by(AIClassification.validated_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for ticket, clf in rows:
        results.append({
            "ticket_id":      ticket.ticket_id,
            "title":          ticket.title,
            "status":         ticket.status,
            "requester_name": ticket.requester_name,
            "created_at":     ticket.created_at.isoformat() if ticket.created_at else None,
            "classification": {
                "ai_classif_id":         clf.ai_classif_id,
                "predicted_category":    clf.predicted_category,
                "predicted_subcategory": clf.predicted_subcategory,
                "predicted_priority":    clf.predicted_priority,
                "confidence":            clf.confidence,
                "ml_confidence":         clf.ml_confidence,
                "model_version":         clf.model_version,
                "validation_status":     clf.validation_status.value,
                "validated_at":          clf.validated_at.isoformat() if clf.validated_at else None,
                "keywords":              json.loads(clf.keywords) if clf.keywords else [],
            },
        })

    return results


# ── GET /ai/tickets/{ticket_id}/similar ──────────────────────────────────────
@router.get("/tickets/{ticket_id}/similar")
def get_similar_tickets(
    ticket_id: int,
    n: int = 5,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les tickets historiques les plus similaires (RAG ChromaDB)"""
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    query_text = f"{ticket.title} {ticket.description_text or ticket.description or ''}"

    from app.services.rag_service import search_similar
    results = search_similar(query_text, n=n)

    return {
        "ticket_id": ticket_id,
        "similar_tickets": results,
        "rag_available": len(results) > 0,
    }


# ── POST /ai/normalize-data ───────────────────────────────────────────────────
_CAT_MAP = {
    "Accès":      "Accès & Compte",
    "Acces":      "Accès & Compte",
    "Email":      "Email & Messagerie",
    "Messagerie": "Email & Messagerie",
    "Impression": "Matériel",
    "Téléphonie": "Téléphone",
    "Telephonie": "Téléphone",
    "Serveur":    "Matériel",
    "Sécurité":   "Autre",
    "Securite":   "Autre",
}

_PRIO_MAP = {
    "P1_URGENT": "Urgente",
    "P2_HIGH":   "Haute",
    "P3_NORMAL": "Normale",
    "P4_LOW":    "Faible",
    "Basse":     "Faible",
    "Moyenne":   "Normale",
}

@router.post("/normalize-data")
def normalize_data(
    current: User = Depends(require_permission(Permission.AI_STATS)),
    db: Session = Depends(get_db),
):
    """Normalise catégories et priorités de tous les tickets + ai_classifications."""
    tickets_cat  = 0
    tickets_prio = 0
    ai_cat       = 0
    ai_prio      = 0

    # ── Tickets ──────────────────────────────────────────────────────────────
    all_tickets = db.query(Ticket).all()
    for t in all_tickets:
        changed = False
        if t.category and t.category in _CAT_MAP:
            t.category = _CAT_MAP[t.category]
            tickets_cat += 1
            changed = True
        if t.priority_label and t.priority_label in _PRIO_MAP:
            t.priority_label = _PRIO_MAP[t.priority_label]
            tickets_prio += 1
            changed = True

    # ── AIClassification ─────────────────────────────────────────────────────
    all_ai = db.query(AIClassification).all()
    for c in all_ai:
        if c.predicted_category and c.predicted_category in _CAT_MAP:
            c.predicted_category = _CAT_MAP[c.predicted_category]
            ai_cat += 1
        if c.predicted_priority and c.predicted_priority in _PRIO_MAP:
            c.predicted_priority = _PRIO_MAP[c.predicted_priority]
            ai_prio += 1

    db.commit()

    return {
        "tickets_categories_updated":  tickets_cat,
        "tickets_priorities_updated":  tickets_prio,
        "ai_categories_updated":       ai_cat,
        "ai_priorities_updated":       ai_prio,
        "message": (
            f"Normalisation terminée : "
            f"{tickets_cat} catégories tickets, {tickets_prio} priorités tickets, "
            f"{ai_cat} catégories IA, {ai_prio} priorités IA."
        ),
    }


# ── GET /ai/config ────────────────────────────────────────────────────────────
@router.get("/config")
def get_ai_config(current: User = Depends(get_current_user)):
    """Retourne la configuration IA (clé masquée, modèle, statut connexion)."""
    import os
    from app.services.ai_service import ML_AVAILABLE, GROQ_API_KEY, MODEL_NAME

    key = GROQ_API_KEY or ""
    if key:
        masked = key[:8] + "••••••••••••••••" + key[-4:]
    else:
        masked = None

    return {
        "groq_key_configured": bool(key),
        "groq_key_masked":     masked,
        "groq_key_full":       key,          # exposé uniquement aux admins authentifiés
        "model_name":          MODEL_NAME,
        "ml_available":        ML_AVAILABLE,
    }


# ── POST /ai/classify-test ────────────────────────────────────────────────────
@router.post("/classify-test")
def classify_test(
    payload: dict,
    current: User = Depends(get_current_user),
):
    """Teste la classification IA sur un texte libre sans créer de ticket."""
    from app.services.ai_service import classify_with_fallback
    from app.models.app_config import AppConfig

    title       = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()

    if not title:
        raise HTTPException(status_code=422, detail="Le titre est requis")

    # Utilise le seuil configuré en base
    db_gen = get_db()
    db_local = next(db_gen)
    try:
        settings  = db_local.query(AppConfig).first()
        threshold = settings.ai_confidence_threshold if settings else 0.75
    finally:
        db_local.close()

    result = classify_with_fallback(title, description, threshold=threshold)

    from app.services.ai_service import _normalize_category, _normalize_priority
    return {
        "category":          _normalize_category(result.get("predicted_category") or ""),
        "subcategory":       result.get("predicted_subcategory"),
        "priority":          _normalize_priority(result.get("predicted_priority") or ""),
        "confidence":        result.get("confidence"),
        "model":             result.get("model_version"),
        "keywords":          result.get("keywords"),
        "used_llm_fallback": result.get("used_llm_fallback", False),
    }


# ── GET /ai/stats ─────────────────────────────────────────────────────────────
@router.get("/stats")
def get_ai_stats(
    current: User = Depends(require_permission(Permission.AI_STATS)),
    db: Session = Depends(get_db),
):
    """Statistiques globales du service IA"""
    total_tickets    = db.query(func.count(Ticket.ticket_id)).scalar() or 0
    # Tickets distincts ayant au moins une classification — pas le nombre brut de
    # lignes ai_classifications, qui compte chaque reclassification séparément
    # (un ticket peut être reclassé plusieurs fois, ex. lors d'un incident).
    total_classified = (
        db.query(func.count(func.distinct(AIClassification.ticket_id))).scalar() or 0
    )

    # Répartition par statut de validation
    by_validation = (
        db.query(AIClassification.validation_status, func.count(AIClassification.ai_classif_id))
        .group_by(AIClassification.validation_status)
        .all()
    )

    # Confiance moyenne — on exclut confidence=0, qui correspond à des échecs
    # d'appel LLM (ex. quota API dépassé), pas à une vraie faible confiance du
    # modèle. Un confidence=0 gonflé artificiellement fausserait la moyenne.
    avg_confidence = (
        db.query(func.avg(AIClassification.confidence))
        .filter(AIClassification.confidence > 0)
        .scalar() or 0
    )

    # Répartition par catégorie prédite (même exclusion, pour cohérence)
    by_category = (
        db.query(AIClassification.predicted_category, func.count(AIClassification.ai_classif_id))
        .filter(AIClassification.predicted_category != None)
        .filter(AIClassification.confidence > 0)
        .group_by(AIClassification.predicted_category)
        .order_by(func.count(AIClassification.ai_classif_id).desc())
        .all()
    )

    # Répartition par priorité prédite (même exclusion, pour cohérence)
    by_priority = (
        db.query(AIClassification.predicted_priority, func.count(AIClassification.ai_classif_id))
        .filter(AIClassification.predicted_priority != None)
        .filter(AIClassification.confidence > 0)
        .group_by(AIClassification.predicted_priority)
        .all()
    )

    # Taux de classification
    classification_rate = round(total_classified / total_tickets * 100, 1) if total_tickets > 0 else 0

    return {
        "total_tickets":       total_tickets,
        "total_classified":    total_classified,
        "classification_rate": classification_rate,
        "avg_confidence":      round(float(avg_confidence) * 100, 1),
        "by_validation": {
            v.value: c for v, c in by_validation
        },
        "by_category": [
            {"category": cat, "count": cnt}
            for cat, cnt in by_category
        ],
        "by_priority": {
            p: c for p, c in by_priority if p
        },
    }


# ── GET /ai/confidence-history ────────────────────────────────────────────────
@router.get("/confidence-history")
def get_ai_confidence_history(
    current: User = Depends(require_permission(Permission.AI_STATS)),
    db: Session = Depends(get_db),
):
    """
    Suivi de la confiance moyenne des classifications IA par jour —
    sert de base à un monitoring simple de la dérive du modèle dans le temps.
    """
    day = func.date(AIClassification.created_at)

    rows = (
        db.query(
            day.label("day"),
            func.avg(AIClassification.confidence).label("avg_confidence"),
            func.count(AIClassification.ai_classif_id).label("count"),
        )
        .filter(AIClassification.confidence != None)
        .group_by(day)
        .order_by(day)
        .all()
    )

    return {
        "history": [
            {
                "date":           str(r.day),
                "avg_confidence": round(float(r.avg_confidence) * 100, 1),
                "count":          r.count,
            }
            for r in rows
        ],
    }


# ── GET /ai/anomalies ─────────────────────────────────────────────────────────
@router.get("/anomalies")
def get_anomalous_tickets(
    current: User = Depends(require_permission(Permission.AI_STATS)),
    db: Session = Depends(get_db),
):
    """
    Tickets détectés atypiques par rapport au corpus historique (Isolation
    Forest, notebook 05). anomaly_score n'est pas un pourcentage — plus
    négatif = plus atypique.
    """
    rows = (
        db.query(AIClassification, Ticket)
        .join(Ticket, Ticket.ticket_id == AIClassification.ticket_id)
        .filter(AIClassification.is_anomaly == True)
        .filter(Ticket.status.notin_(["RESOLVED", "CLOSED", "CANCELLED"]))
        .order_by(AIClassification.anomaly_score.asc())
        .limit(50)
        .all()
    )

    return {
        "items": [
            {
                "ticket_id":     t.ticket_id,
                "external_id":   t.external_id,
                "title":         t.title,
                "category":      c.predicted_category,
                "priority":      t.priority_label,
                "status":        t.status,
                "anomaly_score": c.anomaly_score,
                "created_at":    t.created_at,
            }
            for c, t in rows
        ]
    }


# ── GET /ai/clusters ───────────────────────────────────────────────────────────
@router.get("/clusters")
def get_ticket_clusters(
    current: User = Depends(require_permission(Permission.AI_STATS)),
    db: Session = Depends(get_db),
):
    """
    Répartition des tickets classifiés par thème récurrent (KMeans, notebook 05).

    Limite connue : avec K=3, seul un cluster sur trois correspond à un vrai
    thème métier cohérent — les autres captent surtout des formules de
    politesse / signatures d'email répétées. Affiché tel quel, mots-clés à
    l'appui, pour rester transparent plutôt que de masquer la limite.
    """
    from app.services.ai_service import CLUSTER_MODEL_AVAILABLE, get_cluster_keywords, _model_cluster

    if not CLUSTER_MODEL_AVAILABLE:
        return {"clusters": []}

    counts = dict(
        db.query(AIClassification.cluster_id, func.count(AIClassification.ai_classif_id))
        .filter(AIClassification.cluster_id != None)
        .group_by(AIClassification.cluster_id)
        .all()
    )

    return {
        "clusters": [
            {
                "cluster_id": c,
                "keywords":   get_cluster_keywords(c),
                "count":      counts.get(c, 0),
            }
            for c in range(_model_cluster.n_clusters)
        ]
    }


# ── GET /ai/forecast ───────────────────────────────────────────────────────────
@router.get("/forecast")
def get_volume_forecast_endpoint(
    current: User = Depends(require_permission(Permission.AI_STATS)),
    db: Session = Depends(get_db),
):
    """
    Prévision du volume de tickets sur 30 jours (Prophet). Entraîné à la
    demande sur l'historique réel des tickets, mis en cache 1h.
    """
    from app.services.ai_service import get_volume_forecast

    result = get_volume_forecast(db)
    if result is None:
        return {"available": False, "history": [], "forecast": []}
    return {"available": True, **result}


# ── POST /ai/route/{ticket_id} ────────────────────────────────────────────────
@router.post("/route/{ticket_id}")
def route_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """
    Déclenche le routage IA pour un ticket donné :
    1. Calcule le meilleur agent (expertise × 2 - charge)
    2. Assigne le ticket à cet agent
    3. Logue l'événement dans system_logs
    """
    from app.services.ai_service import suggest_agent
    from app.models.system_log import SystemLog

    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket introuvable")

    if ticket.assignee_manually_updated:
        raise HTTPException(status_code=409, detail="Ce ticket a été assigné manuellement — routage IA bloqué")

    routing = suggest_agent(db, ticket.category, ticket_id)
    if not routing:
        raise HTTPException(status_code=404, detail="Aucun agent disponible pour ce routage")

    agent = routing["agent"]

    # Assignation
    ticket.assignee_user_id = agent.user_id
    ticket.assignee_name    = agent.full_name

    # Log audit
    db.add(SystemLog(
        event_type="ticket.routed",
        category="IA",
        user_id=current.user_id,
        user_name=current.full_name,
        severity="Info",
        detail=(
            f"Routage manuel IA par {current.full_name} | "
            f"Ticket #{ticket.external_id or ticket_id} | "
            f"Catégorie: {ticket.category or '—'} | "
            f"Agent: {agent.full_name} "
            f"(expertise={routing['expertise']}, "
            f"charge={routing['load']}, "
            f"score={routing['score']:.1f})"
        ),
    ))
    db.commit()

    return {
        "ticket_id":   ticket_id,
        "assigned_to": {
            "user_id":   agent.user_id,
            "full_name": agent.full_name,
            "email":     agent.email,
        },
        "routing_details": {
            "score":     routing["score"],
            "expertise": routing["expertise"],
            "load":      routing["load"],
            "category":  ticket.category,
            "formula":   f"score = (expertise {routing['expertise']} × 2) - charge {routing['load']} = {routing['score']:.1f}",
        },
    }


# ── POST /ai/chat ─────────────────────────────────────────────────────────────
@router.post("/chat")
def chat_with_assistant(
    payload: dict,
    current: User = Depends(get_current_user),
):
    """Chatbot IA support — répond aux questions helpdesk via Groq LLaMA 3."""
    import os, requests as req_lib

    message  = (payload.get("message") or "").strip()
    history  = payload.get("history") or []   # [{"role":"user"|"assistant","content":"..."}]

    if not message:
        raise HTTPException(status_code=400, detail="Message vide")

    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=503, detail="Service IA non configuré")

    system_prompt = """Tu es l'assistant IA du Helpdesk GEISER, une plateforme de support IT.
Tu aides les agents et superviseurs à :
- Trouver des solutions aux problèmes techniques (réseau, logiciel, matériel, accès, email)
- Comprendre le statut et la priorité des tickets
- Suggérer des actions pour résoudre les incidents
- Expliquer les procédures internes de support

Règles :
- Réponds toujours en français, de façon concise et professionnelle
- Si tu ne sais pas, dis-le clairement et propose de contacter le support N2
- Ne fais jamais semblant d'avoir accès aux tickets réels
- Utilise des listes à puces pour les étapes de résolution
- Maximum 3-4 paragraphes par réponse"""

    messages = [{"role": "system", "content": system_prompt}]
    # Ajouter l'historique (max 10 derniers échanges)
    for h in history[-10:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        resp = req_lib.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
            json={"model": "openai/gpt-oss-120b", "messages": messages, "max_tokens": 600, "temperature": 0.4},
            timeout=20,
        )
        resp.raise_for_status()
        answer = resp.json()["choices"][0]["message"]["content"].strip()
        return {"reply": answer}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erreur Groq : {str(e)}")


# ── Agentic chat — tools definitions ─────────────────────────────────────────
_AGENTIC_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_tickets",
            "description": (
                "Recherche et liste des tickets selon des critères. "
                "Utilise pour: 'montre mes tickets ouverts', 'tickets urgents', "
                "'tickets non résolus', 'combien de tickets j\\'ai', etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status":   {"type": "string", "enum": ["OPEN","IN_PROGRESS","PENDING","RESOLVED","CLOSED"]},
                    "priority": {"type": "string", "enum": ["Urgente","Haute","Normale","Faible"]},
                    "query":    {"type": "string",  "description": "Texte à chercher dans le titre"},
                    "limit":    {"type": "integer", "description": "Max résultats (défaut 5, max 8)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ticket_detail",
            "description": "Récupère les détails complets d'un ticket par son numéro.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "integer", "description": "Numéro du ticket"},
                },
                "required": ["ticket_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_ticket_status",
            "description": "Change le statut d'un ticket. Agents, superviseurs et admins uniquement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id": {"type": "integer"},
                    "status":    {"type": "string", "enum": ["OPEN","IN_PROGRESS","PENDING","RESOLVED","CLOSED"]},
                },
                "required": ["ticket_id", "status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_ticket",
            "description": "Assigne un ticket à un agent. Superviseurs et admins uniquement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_id":  {"type": "integer"},
                    "agent_name": {"type": "string", "description": "Nom (partiel) de l'agent"},
                },
                "required": ["ticket_id", "agent_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_stats",
            "description": "Statistiques globales de la plateforme (total, par statut, par priorité).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_ticket",
            "description": "Crée un nouveau ticket de support pour le demandeur connecté.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title":          {"type": "string"},
                    "description":    {"type": "string"},
                    "priority_label": {"type": "string", "enum": ["Urgente","Haute","Normale","Faible"]},
                },
                "required": ["title", "description"],
            },
        },
    },
]


def _execute_tool(name: str, args: dict, db: Session, current: User) -> dict:
    from sqlalchemy import or_

    if name == "search_tickets":
        q = db.query(Ticket)
        if args.get("status"):
            q = q.filter(Ticket.status == args["status"])
        if args.get("priority"):
            q = q.filter(Ticket.priority_label == args["priority"])
        if args.get("query"):
            kw = args["query"]
            q = q.filter(Ticket.title.ilike(f"%{kw}%"))
        if current.role == UserRole.AGENT:
            q = q.filter(Ticket.assignee_user_id == current.user_id)
        elif current.role == UserRole.REQUESTER:
            q = q.filter(
                or_(Ticket.requester_user_id == current.user_id,
                    Ticket.requester_name == current.full_name)
            )
        limit = min(int(args.get("limit") or 5), 8)
        tickets = q.order_by(Ticket.created_at.desc()).limit(limit).all()
        return {
            "count": len(tickets),
            "tickets": [
                {
                    "id":       t.ticket_id,
                    "title":    t.title,
                    "status":   t.status,
                    "priority": t.priority_label or "—",
                    "assignee": t.assignee_name or "Non assigné",
                    "category": t.category or "—",
                }
                for t in tickets
            ],
        }

    if name == "get_ticket_detail":
        t = db.query(Ticket).filter(Ticket.ticket_id == args["ticket_id"]).first()
        if not t:
            return {"error": f"Ticket #{args['ticket_id']} introuvable"}
        return {
            "id":          t.ticket_id,
            "title":       t.title,
            "status":      t.status,
            "priority":    t.priority_label or "—",
            "assignee":    t.assignee_name or "Non assigné",
            "requester":   t.requester_name or "—",
            "category":    t.category or "—",
            "subcategory": t.subcategory or "—",
            "description": (t.description_text or t.description or "")[:400],
            "created_at":  t.created_at.isoformat() if t.created_at else None,
        }

    if name == "update_ticket_status":
        if current.role == UserRole.REQUESTER:
            return {"error": "Vous n'avez pas la permission de modifier le statut d'un ticket"}
        t = db.query(Ticket).filter(Ticket.ticket_id == args["ticket_id"]).first()
        if not t:
            return {"error": f"Ticket #{args['ticket_id']} introuvable"}
        old = t.status
        t.status = args["status"]
        if args["status"] == "RESOLVED":
            t.resolved_at = datetime.now(timezone.utc)
        db.commit()
        return {"success": True, "ticket_id": t.ticket_id, "title": t.title,
                "old_status": old, "new_status": args["status"]}

    if name == "assign_ticket":
        if current.role not in (UserRole.SUPERVISOR, UserRole.ADMIN):
            return {"error": "Seuls les superviseurs et admins peuvent assigner des tickets"}
        t = db.query(Ticket).filter(Ticket.ticket_id == args["ticket_id"]).first()
        if not t:
            return {"error": f"Ticket #{args['ticket_id']} introuvable"}
        agent = (
            db.query(User)
            .filter(User.full_name.ilike(f"%{args['agent_name']}%"),
                    User.role == UserRole.AGENT)
            .first()
        )
        if not agent:
            return {"error": f"Agent '{args['agent_name']}' introuvable"}
        t.assignee_user_id        = agent.user_id
        t.assignee_name           = agent.full_name
        t.assignee_manually_updated = True
        db.commit()
        return {"success": True, "ticket_id": t.ticket_id, "title": t.title,
                "assigned_to": agent.full_name}

    if name == "get_stats":
        from sqlalchemy import func as sqlfunc
        total = db.query(sqlfunc.count(Ticket.ticket_id)).scalar() or 0
        by_status   = dict(db.query(Ticket.status,        sqlfunc.count(Ticket.ticket_id)).group_by(Ticket.status).all())
        by_priority = dict(db.query(Ticket.priority_label, sqlfunc.count(Ticket.ticket_id)).group_by(Ticket.priority_label).all())
        return {"total": total, "by_status": by_status, "by_priority": by_priority}

    if name == "create_ticket":
        new_t = Ticket(
            title          = args["title"],
            description    = args.get("description", ""),
            description_text = args.get("description", ""),
            priority_label = args.get("priority_label", "Normale"),
            status         = "OPEN",
            requester_name = current.full_name,
            requester_user_id = current.user_id,
            created_at     = datetime.now(timezone.utc),
        )
        db.add(new_t)
        db.commit()
        db.refresh(new_t)
        return {"success": True, "ticket_id": new_t.ticket_id, "title": new_t.title,
                "priority": new_t.priority_label}

    return {"error": f"Outil '{name}' inconnu"}


# ── POST /ai/agentic-chat ─────────────────────────────────────────────────────
@router.post("/agentic-chat")
def agentic_chat(
    payload: dict,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chatbot agentique — comprend les intentions et exécute des actions réelles sur la plateforme."""
    import os, json
    import requests as req_lib

    message = (payload.get("message") or "").strip()
    history = payload.get("history") or []
    if not message:
        raise HTTPException(status_code=400, detail="Message vide")

    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        raise HTTPException(status_code=503, detail="Service IA non configuré")

    role_fr = {
        UserRole.ADMIN:      "Administrateur",
        UserRole.SUPERVISOR: "Superviseur",
        UserRole.AGENT:      "Agent",
        UserRole.REQUESTER:  "Demandeur",
    }.get(current.role, current.role)

    system_prompt = f"""Tu es l'assistant IA intelligent du Helpdesk GEISER. Tu as accès à des outils pour effectuer des actions RÉELLES sur la plateforme.

Utilisateur connecté : {current.full_name} ({role_fr})

Capacités selon le rôle :
- Rechercher / filtrer des tickets (tous)
- Voir les détails d'un ticket (tous)
- Changer le statut d'un ticket (agents, superviseurs, admins)
- Assigner un ticket à un agent (superviseurs, admins)
- Voir les statistiques globales (tous)
- Créer un ticket (demandeurs)

Règles :
- Réponds TOUJOURS en français, de façon concise et professionnelle
- Utilise les outils dès qu'une action ou information sur la plateforme est demandée
- Après une action, confirme ce qui a été fait avec les détails importants
- Si l'utilisateur n'a pas précisé un paramètre nécessaire (ex: numéro de ticket), demande-le
- Pour les listes de tickets, présente-les de façon structurée"""

    messages = [{"role": "system", "content": system_prompt}]
    for h in (history or [])[-10:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    actions_taken = []

    try:
        for _ in range(4):  # max 4 itérations dans la boucle agentique
            resp = req_lib.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "openai/gpt-oss-120b",
                    "messages": messages,
                    "tools": _AGENTIC_TOOLS,
                    "tool_choice": "auto",
                    "max_tokens": 1000,
                    "temperature": 0.2,
                },
                timeout=30,
            )
            resp.raise_for_status()
            choice = resp.json()["choices"][0]
            assistant_msg = choice["message"]

            # Pas d'appel d'outil → réponse finale
            if not assistant_msg.get("tool_calls"):
                return {
                    "reply":   assistant_msg.get("content", "").strip(),
                    "actions": actions_taken,
                }

            # Exécuter chaque outil appelé par le LLM
            messages.append(assistant_msg)
            for tc in assistant_msg["tool_calls"]:
                fn_name = tc["function"]["name"]
                fn_args = json.loads(tc["function"]["arguments"])
                result  = _execute_tool(fn_name, fn_args, db, current)
                actions_taken.append({"tool": fn_name, "args": fn_args, "result": result})
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tc["id"],
                    "content":      json.dumps(result, ensure_ascii=False, default=str),
                })

        return {"reply": "J'ai effectué les actions demandées.", "actions": actions_taken}

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erreur Groq : {str(e)}")