"""
Tests des routes de statistiques IA — /ai/stats, /ai/confidence-history.
"""
from tests.conftest import auth_headers


def test_confidence_history_requires_ai_stats_permission(client, requester_user):
    resp = client.get("/ai/confidence-history", headers=auth_headers(requester_user))
    assert resp.status_code == 403


def test_confidence_history_accessible_to_admin(client, admin_user):
    resp = client.get("/ai/confidence-history", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    body = resp.json()
    assert "history" in body
    assert body["history"] == []  # base de test vierge, aucune classification


def test_confidence_history_reflects_stored_classifications(client, admin_user, requester_user, db_session):
    from datetime import datetime, timezone
    from app.models.ticket import Ticket
    from app.models.ai_classification import AIClassification

    ticket = Ticket(
        title="Test", description="Test", requester_name=requester_user.full_name,
        requester_user_id=requester_user.user_id, priority_label="Normale",
        status="OPEN", created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    db_session.add(AIClassification(
        ticket_id=ticket.ticket_id, predicted_category="Réseau",
        predicted_priority="P3_NORMAL", confidence=0.82,
    ))
    db_session.commit()

    resp = client.get("/ai/confidence-history", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    history = resp.json()["history"]
    assert len(history) == 1
    assert history[0]["count"] == 1
    assert history[0]["avg_confidence"] == 82.0
