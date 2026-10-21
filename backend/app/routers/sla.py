from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.current_user import get_current_user
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.models.user import User
from app.models.enums import UserRole
from app.models.sla_policy import SLAPolicy
from app.models.sla_instance import SLAInstance
from app.models.ticket import Ticket
from app.schemas.sla import SLAPolicyResponse, SLAPolicyCreate, SLAPolicyUpdate, SLAInstanceResponse
from app.services.sla_service import check_sla_breaches, get_sla_stats, create_sla_instance

router = APIRouter(prefix="/sla", tags=["sla"])


@router.get("/policies", response_model=list[SLAPolicyResponse])
def get_policies(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    return db.query(SLAPolicy).order_by(SLAPolicy.id).all()


@router.post("/policies", response_model=SLAPolicyResponse)
def create_policy(
    payload: SLAPolicyCreate,
    current: User = Depends(require_permission(Permission.SLA_MANAGE)),
    db: Session = Depends(get_db),
):
    existing = db.query(SLAPolicy).filter(SLAPolicy.priority == payload.priority).first()
    if existing:
        raise HTTPException(status_code=400, detail="Une politique avec cette priorité existe déjà")
    policy = SLAPolicy(**payload.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.put("/policies/{policy_id}", response_model=SLAPolicyResponse)
def update_policy(
    policy_id: int,
    payload: SLAPolicyUpdate,
    current: User = Depends(require_permission(Permission.SLA_MANAGE)),
    db: Session = Depends(get_db),
):
    policy = db.query(SLAPolicy).filter(SLAPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(policy, field, value)

    db.commit()
    db.refresh(policy)
    return policy


@router.get("/stats/by-category")
def get_stats_by_category(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import case as sa_case

    rows = (
        db.query(
            Ticket.category,
            func.count(SLAInstance.id).label("total"),
            func.sum(sa_case((SLAInstance.breached_resolve == True, 1), else_=0)).label("breached"),
        )
        .join(SLAInstance, SLAInstance.ticket_id == Ticket.ticket_id)
        .filter(Ticket.category.isnot(None))
        .group_by(Ticket.category)
        .order_by(func.count(SLAInstance.id).desc())
        .all()
    )

    result = []
    for category, total, breached in rows:
        breached = breached or 0
        respected = total - breached
        rate = round(respected / total * 100, 1) if total > 0 else 100.0
        result.append({
            "category": category,
            "total": total,
            "respected": respected,
            "breached": breached,
            "rate": rate,
        })
    return result


@router.get("/stats")
def get_stats(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    return get_sla_stats(db)


@router.post("/check-breaches")
def trigger_check(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    escalated = check_sla_breaches(db)
    return {"escalated": escalated, "message": f"{escalated} ticket(s) mis à jour."}


@router.get("/breached", response_model=list[dict])
def get_breached_tickets(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SLAInstance, Ticket)
        .join(Ticket, SLAInstance.ticket_id == Ticket.ticket_id)
        .filter(
            (SLAInstance.breached_resolve == True) |
            (SLAInstance.breached_response == True)
        )
        .order_by(SLAInstance.risk_score.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "ticket_id": t.ticket_id,
            "external_id": t.external_id,
            "title": t.title,
            "priority": t.priority_label,
            "status": t.status,
            "assignee": t.assignee_name or "—",
            "assignee_manually_updated": t.assignee_manually_updated,
            "due_resolve_at": s.due_resolve_at.isoformat() if s.due_resolve_at else None,
            "breached_response": s.breached_response,
            "breached_resolve": s.breached_resolve,
            "risk_score": s.risk_score,
            "ml_risk_score": s.ml_risk_score,
        }
        for s, t in rows
    ]


@router.get("/at-risk", response_model=list[dict])
def get_at_risk_tickets(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    # "À risque" si le temps écoulé OU la prédiction IA (texte du ticket)
    # dépasse 70% — le score IA rattrape les tickets urgents tout juste créés,
    # pour lesquels le temps écoulé seul est encore proche de 0.
    rows = (
        db.query(SLAInstance, Ticket)
        .join(Ticket, SLAInstance.ticket_id == Ticket.ticket_id)
        .filter(
            or_(SLAInstance.risk_score >= 70, SLAInstance.ml_risk_score >= 70),
            SLAInstance.breached_resolve == False,
            Ticket.status.notin_(["RESOLVED", "CLOSED", "CANCELLED"])
        )
        .order_by(SLAInstance.risk_score.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "ticket_id": t.ticket_id,
            "external_id": t.external_id,
            "title": t.title,
            "priority": t.priority_label,
            "status": t.status,
            "assignee": t.assignee_name or "—",
            "assignee_manually_updated": t.assignee_manually_updated,
            "due_resolve_at": s.due_resolve_at.isoformat() if s.due_resolve_at else None,
            "risk_score": s.risk_score,
            "ml_risk_score": s.ml_risk_score,
        }
        for s, t in rows
    ]

@router.post("/init-instances")
def init_instances(
    current: User = Depends(require_permission(Permission.SLA_READ)),
    db: Session = Depends(get_db),
):
    from app.services.sla_service import init_sla_instances_for_existing_tickets
    created = init_sla_instances_for_existing_tickets(db)
    # Lancer immédiatement une vérification
    check_sla_breaches(db)
    return {"created": created, "message": f"{created} instances SLA créées et vérifiées."}