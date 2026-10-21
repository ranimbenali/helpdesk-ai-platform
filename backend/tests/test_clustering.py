"""
Tests du clustering thématique (model_cluster.pkl, KMeans).
"""
from datetime import datetime, timezone

from tests.conftest import auth_headers
from app.services import ai_service
from app.models.ticket import Ticket
from app.models.ai_classification import AIClassification


def test_cluster_model_is_loaded():
    assert ai_service.CLUSTER_MODEL_AVAILABLE is True


def test_predict_cluster_returns_valid_id():
    cluster_id = ai_service.predict_cluster("Problème réseau wifi bureau", "Internet ne fonctionne plus")
    assert cluster_id is not None
    assert 0 <= cluster_id < ai_service._model_cluster.n_clusters


def test_get_cluster_keywords_returns_list():
    keywords = ai_service.get_cluster_keywords(0)
    assert isinstance(keywords, list)
    assert len(keywords) > 0


def test_clusters_endpoint_requires_permission(client, requester_user):
    resp = client.get("/ai/clusters", headers=auth_headers(requester_user))
    assert resp.status_code == 403


def test_clusters_endpoint_returns_all_clusters_with_counts(client, admin_user, requester_user, db_session):
    ticket = Ticket(
        title="Demande", description="x", status="OPEN",
        priority_label="Normale", requester_name=requester_user.full_name,
        requester_user_id=requester_user.user_id, created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    db_session.add(AIClassification(ticket_id=ticket.ticket_id, cluster_id=0))
    db_session.commit()

    resp = client.get("/ai/clusters", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    clusters = resp.json()["clusters"]
    assert len(clusters) == ai_service._model_cluster.n_clusters
    cluster_0 = next(c for c in clusters if c["cluster_id"] == 0)
    assert cluster_0["count"] >= 1
    assert len(cluster_0["keywords"]) > 0
