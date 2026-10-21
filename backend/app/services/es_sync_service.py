"""
Synchronisation continue Postgres → Elasticsearch/Kibana — Helpdesk IA Geiser.

Remplace l'ancien script ponctuel (scripts/sync_confidence_to_elasticsearch.py) :
Elasticsearch + Kibana font maintenant partie du déploiement (docker-compose.yml)
et cette synchronisation tourne en tâche de fond au même titre que la sync Geiser
ou la vérification des SLA (voir app/main.py).

Incrémentale par design : ne réindexe que les classifications IA nouvelles depuis
le dernier passage (pas de delete+recreate de l'index à chaque cycle).
"""
import os
import logging
from sqlalchemy.orm import Session

from app.models.ai_classification import AIClassification

logger = logging.getLogger(__name__)

ES_URL     = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
INDEX_NAME = "ai_classifications"

INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "ticket_id":             {"type": "long"},
            "predicted_category":    {"type": "keyword"},
            "predicted_subcategory": {"type": "keyword"},
            "predicted_priority":    {"type": "keyword"},
            "confidence":            {"type": "float"},
            "ml_confidence":         {"type": "float"},
            "model_version":         {"type": "keyword"},
            "validation_status":     {"type": "keyword"},
            "created_at":            {"type": "date"},
        }
    }
}

_last_synced_id = 0
_es_client = None


def _get_client():
    global _es_client
    if _es_client is None:
        from elasticsearch import Elasticsearch
        _es_client = Elasticsearch(ES_URL)
    return _es_client


def sync_classifications_to_elasticsearch(db: Session) -> dict:
    """Indexe dans Elasticsearch les classifications IA pas encore synchronisées.
    Lève une exception si Elasticsearch est injoignable — à l'appelant de gérer
    (la boucle périodique de main.py l'attrape et réessaie au cycle suivant)."""
    global _last_synced_id
    from elasticsearch import helpers

    es = _get_client()
    if not es.ping():
        raise ConnectionError(f"Elasticsearch injoignable sur {ES_URL}")

    if not es.indices.exists(index=INDEX_NAME):
        es.indices.create(index=INDEX_NAME, body=INDEX_MAPPING)
        logger.info(f"[ES] Index '{INDEX_NAME}' créé")

    rows = (
        db.query(AIClassification)
        .filter(AIClassification.ai_classif_id > _last_synced_id)
        .filter(AIClassification.confidence.isnot(None))
        .order_by(AIClassification.ai_classif_id)
        .all()
    )
    if not rows:
        return {"synced": 0}

    def gen_actions():
        for r in rows:
            yield {
                "_index": INDEX_NAME,
                "_id": r.ai_classif_id,
                "_source": {
                    "ticket_id":             r.ticket_id,
                    "predicted_category":    r.predicted_category,
                    "predicted_subcategory": r.predicted_subcategory,
                    "predicted_priority":    r.predicted_priority,
                    "confidence":            r.confidence,
                    "ml_confidence":         r.ml_confidence,
                    "model_version":         r.model_version,
                    "validation_status":     r.validation_status.value if r.validation_status else None,
                    "created_at":            r.created_at.isoformat() if r.created_at else None,
                },
            }

    success, errors = helpers.bulk(es, gen_actions(), raise_on_error=False)
    _last_synced_id = max(r.ai_classif_id for r in rows)
    logger.info(f"[ES] {success} classifications synchronisées (jusqu'à id={_last_synced_id})")
    return {"synced": success, "errors": len(errors) if errors else 0}
