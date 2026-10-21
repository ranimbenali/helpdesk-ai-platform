from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.sla_policy import SLAPolicy
from app.models.sla_instance import SLAInstance
from app.models.ticket import Ticket
from app.models.user import User
from app.models.enums import UserRole
from app.services.notification_service import notify_sla_breached
from datetime import timezone
from app.models.ticket import Ticket


DEFAULT_POLICIES = [
    {"priority": "Urgente",  "response_time": 60,   "resolve_time": 240},
    {"priority": "Haute",    "response_time": 240,  "resolve_time": 480},
    {"priority": "Normale",  "response_time": 480,  "resolve_time": 1440},
    {"priority": "Moyenne",  "response_time": 1440, "resolve_time": 2880},
    {"priority": "Faible",   "response_time": 2880, "resolve_time": 4320},
]


def init_sla_policies(db: Session):
    """Initialise les politiques SLA par défaut si elles n'existent pas."""
    for policy_data in DEFAULT_POLICIES:
        existing = db.query(SLAPolicy).filter(
            SLAPolicy.priority == policy_data["priority"]
        ).first()
        if not existing:
            db.add(SLAPolicy(**policy_data))
    db.commit()


def create_sla_instance(db: Session, ticket: Ticket) -> SLAInstance | None:
    """Crée une instance SLA pour un ticket selon sa priorité."""
    if not ticket.priority_label:
        return None

    policy = db.query(SLAPolicy).filter(
        SLAPolicy.priority == ticket.priority_label,
        SLAPolicy.is_active == True
    ).first()

    if not policy:
        return None

    existing = db.query(SLAInstance).filter(
        SLAInstance.ticket_id == ticket.ticket_id
    ).first()
    if existing:
        return existing

    now = ticket.created_at or datetime.now(timezone.utc)
    due_response = now + timedelta(minutes=policy.response_time)
    due_resolve  = now + timedelta(minutes=policy.resolve_time)

    from app.services.ai_service import predict_sla_risk
    ml_risk_score = predict_sla_risk(ticket.title, ticket.description_text or ticket.description)

    instance = SLAInstance(
        ticket_id=ticket.ticket_id,
        due_response_at=due_response,
        due_resolve_at=due_resolve,
        breached_response=False,
        breached_resolve=False,
        risk_score=0,
        ml_risk_score=ml_risk_score,
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def check_sla_breaches(db: Session):
    """Vérifie tous les tickets actifs et met à jour les breaches SLA."""
    now = datetime.now(timezone.utc)

    instances = (
        db.query(SLAInstance)
        .join(Ticket, SLAInstance.ticket_id == Ticket.ticket_id)
        .filter(Ticket.status.notin_(["RESOLVED", "CLOSED", "CANCELLED"]))
        .all()
    )

    escalated = 0

    for inst in instances:
        changed = False

        # ── Vérifier breach réponse ──
        if inst.due_response_at and now > inst.due_response_at and not inst.breached_response:
            inst.breached_response = True
            changed = True

        # ── Vérifier breach résolution ──
        if inst.due_resolve_at and now > inst.due_resolve_at and not inst.breached_resolve:
            inst.breached_resolve = True
            changed = True

            # ✅ Notification SLA dépassé (résolution)
            try:
                ticket = db.query(Ticket).filter(
                    Ticket.ticket_id == inst.ticket_id
                ).first()

                if ticket:
                    assignee = None
                    if ticket.assignee_user_id:
                        assignee = db.query(User).filter(
                            User.user_id == ticket.assignee_user_id
                        ).first()

                    supervisors = db.query(User).filter(
                        User.role.in_([UserRole.SUPERVISOR, UserRole.ADMIN])
                    ).all()

                    notify_sla_breached(
                        db=db,
                        ticket=ticket,
                        assignee=assignee,
                        supervisors=supervisors,
                    )
            except Exception as e:
                print(f"[SLA NOTIF ERROR] {e}")

        # ── Calcul du score de risque ──
        # ── Calcul du score de risque ──
        if inst.due_resolve_at and inst.created_at:
            total_seconds = (inst.due_resolve_at - inst.created_at).total_seconds()
            elapsed_seconds = (now - inst.created_at).total_seconds()

            if total_seconds > 0:
                pct = (elapsed_seconds / total_seconds) * 100
                inst.risk_score = max(0, min(100, int(pct)))
            else:
                inst.risk_score = 100 if inst.breached_resolve else 0
        elif inst.breached_resolve:
            inst.risk_score = 100

        if changed:
            escalated += 1

    db.commit()
    return escalated


def get_sla_stats(db: Session) -> dict:
    """Retourne les statistiques SLA globales."""
    total = db.query(SLAInstance).count()

    breached_resolve = db.query(SLAInstance).filter(
        SLAInstance.breached_resolve == True
    ).count()

    breached_response = db.query(SLAInstance).filter(
        SLAInstance.breached_response == True
    ).count()

    at_risk = db.query(SLAInstance).filter(
        SLAInstance.risk_score >= 70,
        SLAInstance.breached_resolve == False
    ).count()

    respected = total - breached_resolve
    rate = round((respected / total * 100), 1) if total > 0 else 100.0

    return {
        "total":             total,
        "breached_resolve":  breached_resolve,
        "breached_response": breached_response,
        "at_risk":           at_risk,
        "respected":         respected,
        "rate":              rate,
    }

def init_sla_instances_for_existing_tickets(db: Session):
    """
    Crée les instances SLA pour tous les tickets existants
    qui n'en ont pas encore.
    """
    from app.models.sla_instance import SLAInstance

    # Tickets sans instance SLA
    tickets_without_sla = (
        db.query(Ticket)
        .outerjoin(SLAInstance, SLAInstance.ticket_id == Ticket.ticket_id)
        .filter(SLAInstance.id == None)
        .filter(Ticket.status.notin_(["RESOLVED", "CLOSED", "CANCELLED"]))
        .filter(Ticket.priority_label != None)
        .all()
    )

    created = 0
    for ticket in tickets_without_sla:
        instance = create_sla_instance(db, ticket)
        if instance:
            created += 1

    print(f"[SLA INIT] {created} instances SLA créées pour les tickets existants.")
    return created