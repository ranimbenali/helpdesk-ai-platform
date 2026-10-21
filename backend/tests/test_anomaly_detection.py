"""
Tests de la détection d'anomalies (model_anomaly.pkl, Isolation Forest).
"""
from datetime import datetime, timezone

from tests.conftest import auth_headers
from app.services import ai_service
from app.models.ticket import Ticket
from app.models.ai_classification import AIClassification


def test_anomaly_model_is_loaded():
    assert ai_service.ANOMALY_MODEL_AVAILABLE is True


def test_predict_anomaly_returns_valid_structure():
    result = ai_service.predict_anomaly("Problème réseau wifi bureau", "Internet ne fonctionne plus")
    assert result is not None
    assert "is_anomaly" in result
    assert "anomaly_score" in result
    assert isinstance(result["is_anomaly"], bool)
    assert isinstance(result["anomaly_score"], float)


def test_anomalies_endpoint_requires_permission(client, requester_user):
    resp = client.get("/ai/anomalies", headers=auth_headers(requester_user))
    assert resp.status_code == 403


def test_anomalies_endpoint_returns_flagged_tickets(client, admin_user, requester_user, db_session):
    ticket = Ticket(
        title="Réclamation atypique", description="x", status="OPEN",
        priority_label="Normale", requester_name=requester_user.full_name,
        requester_user_id=requester_user.user_id, created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    db_session.add(AIClassification(
        ticket_id=ticket.ticket_id, predicted_category="Réclamation",
        is_anomaly=True, anomaly_score=-0.44,
    ))
    db_session.commit()

    resp = client.get("/ai/anomalies", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    items = resp.json()["items"]
    match = next((i for i in items if i["ticket_id"] == ticket.ticket_id), None)
    assert match is not None
    assert match["anomaly_score"] == -0.44


def test_anomalies_endpoint_excludes_non_anomalous_tickets(client, admin_user, requester_user, db_session):
    ticket = Ticket(
        title="Ticket normal", description="x", status="OPEN",
        priority_label="Normale", requester_name=requester_user.full_name,
        requester_user_id=requester_user.user_id, created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    db_session.add(AIClassification(
        ticket_id=ticket.ticket_id, predicted_category="Réseau",
        is_anomaly=False, anomaly_score=-0.30,
    ))
    db_session.commit()

    resp = client.get("/ai/anomalies", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(i["ticket_id"] != ticket.ticket_id for i in items)
