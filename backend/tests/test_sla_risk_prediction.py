"""
Tests de la prédiction de risque SLA par IA (model_sla_risk.pkl).
"""
from datetime import datetime, timezone

from app.services import ai_service
from app.services.sla_service import init_sla_policies, create_sla_instance
from app.models.ticket import Ticket
from app.models.sla_instance import SLAInstance


def test_sla_risk_model_is_loaded():
    assert ai_service.SLA_RISK_MODEL_AVAILABLE is True


def test_predict_sla_risk_scores_urgent_text_higher_than_mundane_text():
    urgent  = ai_service.predict_sla_risk("Serveur en panne", "Bloquant, urgent, personne ne peut travailler")
    mundane = ai_service.predict_sla_risk("Question generale", "Petite question sans urgence, quand vous aurez le temps")
    assert urgent is not None and mundane is not None
    assert 0 <= urgent <= 100
    assert 0 <= mundane <= 100
    assert urgent > mundane


def test_create_sla_instance_sets_ml_risk_score(db_session, requester_user):
    init_sla_policies(db_session)

    ticket = Ticket(
        title="Panne urgente", description="Serveur bloque tout le monde, urgent",
        description_text="Serveur bloque tout le monde, urgent",
        priority_label="Urgente", status="OPEN",
        requester_name=requester_user.full_name, requester_user_id=requester_user.user_id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    instance = create_sla_instance(db_session, ticket)
    assert instance is not None
    assert instance.ml_risk_score is not None
    assert 0 <= instance.ml_risk_score <= 100


def test_apply_classification_creates_sla_instance_immediately(db_session, requester_user):
    """
    Avant cette correction, un ticket créé après le démarrage du serveur ne
    recevait sa ligne SLA qu'au prochain redémarrage (init_sla_instances_for_
    existing_tickets ne tourne qu'au startup) — apply_classification_to_ticket
    doit maintenant la créer dès que la priorité est connue.
    """
    from app.services.sla_service import init_sla_policies
    from app.models.sla_instance import SLAInstance

    init_sla_policies(db_session)

    ticket = Ticket(
        title="Panne", description="x", status="OPEN",
        requester_name=requester_user.full_name, requester_user_id=requester_user.user_id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)

    assert db_session.query(SLAInstance).filter_by(ticket_id=ticket.ticket_id).first() is None

    ai_service.apply_classification_to_ticket(
        db=db_session, ticket=ticket,
        result={"predicted_category": "Réseau", "predicted_priority": "P1_URGENT", "confidence": 0.9},
        ai_confidence_threshold=0.75,
    )

    instance = db_session.query(SLAInstance).filter_by(ticket_id=ticket.ticket_id).first()
    assert instance is not None
    assert instance.ml_risk_score is not None


def test_at_risk_endpoint_includes_ml_risk_score(client, admin_user, requester_user, db_session):
    from tests.conftest import auth_headers

    init_sla_policies(db_session)

    ticket = Ticket(
        title="Panne urgente", description="Serveur bloque tout, urgent, bloquant",
        description_text="Serveur bloque tout, urgent, bloquant",
        priority_label="Urgente", status="OPEN",
        requester_name=requester_user.full_name, requester_user_id=requester_user.user_id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ticket)
    db_session.commit()
    db_session.refresh(ticket)
    create_sla_instance(db_session, ticket)

    resp = client.get("/sla/at-risk", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    items = resp.json()
    match = next((i for i in items if i["ticket_id"] == ticket.ticket_id), None)
    assert match is not None, "Un ticket urgent tout juste créé doit apparaître grâce au score IA, même à risk_score=0"
    assert "ml_risk_score" in match
