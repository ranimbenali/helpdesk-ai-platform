import os
import uuid
from datetime import datetime
from fastapi import BackgroundTasks, APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from app.core.current_user import get_current_user
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.models.enums import AuditEventType, TicketSource, UserRole, UserStatus
from app.models.message import Message
from app.models.sync_log import SyncLog
from app.models.ticket import Ticket
from app.models.ticket_attachment import TicketAttachment
from app.models.user import User
from app.schemas.ticket import (
    MessageCreate,
    MessageItem,
    SyncLogsResponse,
    TicketAssignAgent,
    TicketAuditResponse,
    TicketDetail,
    TicketListItem,
    TicketMessagesResponse,
    TicketUpdatePriority,
    TicketUpdateStatus,
)
from app.services.geiser_sync import sync_tickets_from_geiser
from app.services.notification_service import (
    notify_ticket_assigned,
    notify_status_changed,
    notify_new_message,
    create_in_app_notification,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])

# Catégories synchronisées avec la taxonomie IA (ai_service.py)
CATEGORIES = {
    "Réseau":             ["Connexion Internet", "WiFi", "Câblage réseau", "Lenteur réseau", "VPN"],
    "Matériel":           ["PC & Ordinateur", "Écran & Périphériques", "Imprimante & Scanner",
                           "Caméra & Surveillance", "Serveur & Infrastructure", "TPE & Caisse", "Autre matériel"],
    "Logiciel":           ["Installation logiciel", "Mise à jour logiciel", "Bug logiciel",
                           "Accès logiciel", "Configuration logiciel"],
    "Accès & Compte":     ["Réinitialisation mot de passe", "Création de compte", "Désactivation compte",
                           "Authentification 2FA", "Gestion des permissions"],
    "Email & Messagerie": ["Création compte email", "Suppression compte email", "Extension boîte mail",
                           "Problème accès email", "Configuration email"],
    "Téléphone":          ["Téléphone fixe & VOIP", "Téléphone mobile", "Configuration téléphone"],
    "Réclamation":        ["Réclamation service", "Réclamation matériel", "Réclamation logiciel"],
    "Intervention":       ["Intervention sur site", "Maintenance préventive", "Déplacement technique"],
    "RH_Finance":         ["Gestion RH", "Gestion Finance & Paie", "Autre RH/Finance"],
    "Autre":              ["Demande générale", "Non classifiable"],
}


def create_audit_event(
    db: Session,
    ticket_id: int,
    user_id: int | None,
    event_type: AuditEventType,
    old_value: str | None,
    new_value: str | None,
):
    event = AuditEvent(
        ticket_id=ticket_id,
        user_id=user_id,
        event_type=event_type,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(event)


# =========================================================
# ROUTES STATIQUES EN PREMIER
# =========================================================

@router.get("/", response_model=list[TicketListItem])
def list_tickets(
    q: str = Query("", description="Search by title, requester, assignee, site"),
    status_filter: str = Query("", alias="status"),
    priority_filter: str = Query("", alias="priority"),
    skip: int = 0,
    limit: int = 50,
    current: User = Depends(require_permission(Permission.TICKETS_READ_ALL)),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)

    if q:
        query = query.filter(
            or_(
                Ticket.title.ilike(f"%{q}%"),
                Ticket.requester_name.ilike(f"%{q}%"),
                Ticket.assignee_name.ilike(f"%{q}%"),
                Ticket.site.ilike(f"%{q}%"),
                Ticket.group_name.ilike(f"%{q}%"),
            )
        )

    if status_filter:
        query = query.filter(Ticket.status == status_filter)

    if priority_filter:
        # Accepter les deux formats : "Haute" ou "P2_HIGH"
        _PRIO_ALIASES = {
            "Urgente":"P1_URGENT","Haute":"P2_HIGH","Normale":"P3_NORMAL","Faible":"P4_LOW",
            "P1_URGENT":"Urgente","P2_HIGH":"Haute","P3_NORMAL":"Normale","P4_LOW":"Faible",
        }
        alt = _PRIO_ALIASES.get(priority_filter)
        if alt:
            query = query.filter(or_(Ticket.priority_label == priority_filter, Ticket.priority_label == alt))
        else:
            query = query.filter(Ticket.priority_label == priority_filter)

    tickets = (
        query.order_by(Ticket.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return tickets


# ✅ AJOUT : Route pour récupérer les catégories
@router.get("/categories")
def get_categories(current: User = Depends(get_current_user)):
    return {
        "categories": [
            {"name": cat, "subcategories": subs}
            for cat, subs in CATEGORIES.items()
        ]
    }


@router.post("/sync-now")
def sync_tickets_now(
    current: User = Depends(require_permission(Permission.TICKETS_SYNC)),
    db: Session = Depends(get_db),
):
    return sync_tickets_from_geiser(db)


@router.post("/ai/classify-pending")
def classify_pending_tickets(
    current: User = Depends(require_permission(Permission.TICKETS_STATS)),
    db: Session = Depends(get_db),
):
    """Déclenche la classification IA de tous les tickets sans catégorie."""
    from app.services.geiser_sync import _trigger_ai_for_unclassified
    from app.models.ai_classification import AIClassification

    count = (
        db.query(Ticket.ticket_id)
        .outerjoin(AIClassification, Ticket.ticket_id == AIClassification.ticket_id)
        .filter(AIClassification.ai_classif_id == None)  # noqa: E711
        .count()
    )

    _trigger_ai_for_unclassified(db)
    return {
        "message": f"Classification lancée en arrière-plan pour {count} tickets.",
        "pending_count": count,
    }


@router.get("/system-logs")
def get_system_logs(
    current: User = Depends(require_permission(Permission.SYSTEM_LOGS)),
    db: Session = Depends(get_db),
):
    """
    Retourne TOUS les logs (sans limite de date) :
      - system_logs     : connexions, créations/suppressions de comptes
      - audit_events    : changements de statut/priorité/assignation sur les tickets
      - sync_logs       : synchronisations GEISER
    """
    from app.models.system_log import SystemLog

    entries = []

    # ── 1. SystemLog (auth + users) ──────────────────────────────────────────
    sys_items = db.query(SystemLog).order_by(SystemLog.created_at.desc()).all()
    for i in sys_items:
        entries.append({
            "event_type": i.event_type,
            "category":   i.category or "Système",
            "user_name":  i.user_name or "system",
            "detail":     i.detail or "",
            "severity":   i.severity or "Info",
            "created_at": i.created_at,
        })

    # ── 2. AuditEvent (statut, priorité, assignation par ticket) ─────────────
    AUDIT_EVENT_MAP = {
        "STATUS_CHANGED":   ("ticket.status",   "Tickets",  "Info"),
        "PRIORITY_CHANGED": ("ticket.priority", "Tickets",  "Avertis."),
        "ASSIGNED":         ("ticket.assigned", "Tickets",  "Info"),
        "CREATED":          ("ticket.created",  "Tickets",  "Info"),
        "CLOSED":           ("ticket.closed",   "Tickets",  "Info"),
    }
    audit_rows = (
        db.query(AuditEvent, User.full_name, Ticket.title, Ticket.external_id)
        .outerjoin(User,   AuditEvent.user_id   == User.user_id)
        .outerjoin(Ticket, AuditEvent.ticket_id == Ticket.ticket_id)
        .order_by(AuditEvent.created_at.desc())
        .all()
    )
    for ev, uname, t_title, t_ext in audit_rows:
        ev_str  = ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type)
        mapping = AUDIT_EVENT_MAP.get(ev_str, (ev_str.lower(), "Tickets", "Info"))
        event_type, category, severity = mapping

        ref = f"#{t_ext or ev.ticket_id}"
        title_str = t_title or "—"
        if ev_str == "STATUS_CHANGED":
            detail = f"Ticket {ref} « {title_str} » : {ev.old_value} → {ev.new_value}"
        elif ev_str == "PRIORITY_CHANGED":
            detail = f"Ticket {ref} « {title_str} » : priorité {ev.old_value} → {ev.new_value}"
            severity = "Avertis."
        elif ev_str == "ASSIGNED":
            detail = f"Ticket {ref} « {title_str} » assigné à {ev.new_value}"
        else:
            detail = f"Ticket {ref} « {title_str} »"
            if ev.new_value:
                detail += f" — {ev.new_value}"

        entries.append({
            "event_type": event_type,
            "category":   category,
            "user_name":  uname or "system",
            "detail":     detail,
            "severity":   severity,
            "created_at": ev.created_at,
        })

    # ── 3. SyncLog (synchronisations GEISER) ─────────────────────────────────
    sync_items = db.query(SyncLog).order_by(SyncLog.timestamp.desc()).all()
    for s in sync_items:
        sev = "Info" if s.status.value == "SUCCESS" else ("Avertis." if s.status.value == "PARTIAL" else "Critique")
        entries.append({
            "event_type": "sync.completed" if s.status.value == "SUCCESS" else "sync.failed",
            "category":   "Système",
            "user_name":  "system",
            "detail":     s.message or f"Sync : {s.created_count} créés, {s.updated_count} màj",
            "severity":   sev,
            "created_at": s.timestamp,
        })

    # ── Tri global par date décroissante ──────────────────────────────────────
    entries.sort(key=lambda x: x["created_at"] or datetime.min, reverse=True)

    return [
        {**e, "created_at": e["created_at"].isoformat() if e["created_at"] else None}
        for e in entries
    ]


@router.get("/sync-logs", response_model=SyncLogsResponse)
def get_sync_logs(
    current: User = Depends(require_permission(Permission.SYSTEM_LOGS)),
    db: Session = Depends(get_db),
):
    items = (
        db.query(SyncLog)
        .order_by(SyncLog.timestamp.desc(), SyncLog.sync_log_id.desc())
        .limit(20)
        .all()
    )
    return {"items": items}


@router.get("/stats")
def get_tickets_stats(
    current: User = Depends(require_permission(Permission.TICKETS_STATS)),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(Ticket.ticket_id)).scalar()

    by_status = db.query(
        Ticket.status,
        func.count(Ticket.ticket_id)
    ).group_by(Ticket.status).all()

    by_priority = db.query(
        Ticket.priority_label,
        func.count(Ticket.ticket_id)
    ).group_by(Ticket.priority_label).all()

    recent = (
        db.query(Ticket)
        .order_by(Ticket.created_at.desc())
        .limit(5)
        .all()
    )

    today = date.today()
    yesterday = today - timedelta(days=1)

    today_count = db.query(func.count(Ticket.ticket_id)).filter(
        func.date(Ticket.created_at) == today
    ).scalar()

    yesterday_count = db.query(func.count(Ticket.ticket_id)).filter(
        func.date(Ticket.created_at) == yesterday
    ).scalar()

    last_7_days = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.query(func.count(Ticket.ticket_id)).filter(
            func.date(Ticket.created_at) == day
        ).scalar()
        last_7_days.append({
            "date": day.strftime("%d/%m"),
            "count": count or 0,
        })

    users_by_role = db.query(
        User.role,
        func.count(User.user_id)
    ).filter(User.status == UserStatus.ACTIVE).group_by(User.role).all()

    top_agents = (
        db.query(
            User.full_name,
            User.role,
            func.count(Ticket.ticket_id).label("ticket_count")
        )
        .join(Ticket, Ticket.assignee_user_id == User.user_id)
        .filter(User.role.in_(["AGENT", "SUPERVISOR"]))
        .group_by(User.user_id, User.full_name, User.role)
        .order_by(func.count(Ticket.ticket_id).desc())
        .limit(5)
        .all()
    )

    last_sync = (
        db.query(SyncLog)
        .order_by(SyncLog.timestamp.desc())
        .first()
    )

    resolved_today = db.query(func.count(Ticket.ticket_id)).filter(
        func.date(Ticket.resolved_at) == today,
        Ticket.status.in_(["RESOLVED", "CLOSED"]),
    ).scalar()

    # Tickets ouverts dont l'âge dépasse 80% du délai SLA
    _SLA_HOURS = {"Urgente": 4, "Haute": 8, "Normale": 24, "Faible": 72}
    _PRIO_MAP = {"P1_URGENT": "Urgente", "P2_HIGH": "Haute", "P3_NORMAL": "Normale", "P4_LOW": "Faible"}
    open_rows = (
        db.query(Ticket.created_at, Ticket.priority_label)
        .filter(Ticket.status.in_(["OPEN", "IN_PROGRESS"]))
        .all()
    )
    from datetime import datetime as _dt
    _now = _dt.utcnow()
    at_risk_count = 0
    for (created_at, prio_label) in open_rows:
        prio = _PRIO_MAP.get(prio_label, prio_label)
        sla_h = _SLA_HOURS.get(prio, 24)
        if created_at:
            naive = created_at.replace(tzinfo=None) if created_at.tzinfo else created_at
            age_h = (_now - naive).total_seconds() / 3600
            if age_h / sla_h >= 0.8:
                at_risk_count += 1

    return {
        "total": total,
        "by_status": {s: c for s, c in by_status},
        "by_priority": {p: c for p, c in by_priority if p},
        "recent": [
            {
                "ticket_id": t.ticket_id,
                "external_id": t.external_id,
                "title": t.title,
                "status": t.status,
                "priority_label": t.priority_label,
                "requester_name": t.requester_name,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in recent
        ],
        "today_count": today_count or 0,
        "yesterday_count": yesterday_count or 0,
        "resolved_today": resolved_today or 0,
        "at_risk_count": at_risk_count,
        "last_7_days": last_7_days,
        "users_by_role": {r.value: c for r, c in users_by_role},
        "top_agents": [
            {
                "full_name": name,
                "role": role.value,
                "ticket_count": count,
            }
            for name, role, count in top_agents
        ],
        "last_sync": {
            "timestamp": last_sync.timestamp.isoformat() if last_sync else None,
            "status": last_sync.status.value if last_sync else None,
            "created_count": last_sync.created_count if last_sync else 0,
            "updated_count": last_sync.updated_count if last_sync else 0,
        } if last_sync else None,
    }


@router.get("/reports")
def get_tickets_reports(
    date_from: str = Query("", description="Date début YYYY-MM-DD"),
    date_to: str = Query("", description="Date fin YYYY-MM-DD"),
    current: User = Depends(require_permission(Permission.TICKETS_REPORTS)),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)

    if date_from:
        try:
            query = query.filter(Ticket.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
        except ValueError:
            pass

    if date_to:
        try:
            query = query.filter(Ticket.created_at <= datetime.strptime(date_to + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
        except ValueError:
            pass

    tickets = query.order_by(Ticket.created_at.desc()).all()

    by_status = {}
    for t in tickets:
        by_status[t.status] = by_status.get(t.status, 0) + 1

    by_priority = {}
    for t in tickets:
        key = t.priority_label or "Non défini"
        by_priority[key] = by_priority.get(key, 0) + 1

    by_site = {}
    for t in tickets:
        key = t.site or "Non défini"
        by_site[key] = by_site.get(key, 0) + 1

    by_agent = {}
    for t in tickets:
        key = t.assignee_name or "Non assigné"
        by_agent[key] = by_agent.get(key, 0) + 1

    import re as _re
    def _strip_html(html: str | None) -> str:
        if not html:
            return ""
        text = _re.sub(r"<[^>]+>", " ", html)
        text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
        return " ".join(text.split())

    tickets_export = [
        {
            "id": t.external_id or t.ticket_id,
            "title": t.title,
            "description": _strip_html(t.description or t.description_text or ""),
            "requester": t.requester_name or "—",
            "assignee": t.assignee_name or "—",
            "site": t.site or "—",
            "group": t.group_name or "—",
            "category": t.category or "—",
            "subcategory": t.subcategory or "—",
            "priority": t.priority_label or "—",
            "status": t.status,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "—",
            "resolved_at": t.resolved_at.strftime("%Y-%m-%d %H:%M") if t.resolved_at else "—",
        }
        for t in tickets
    ]

    return {
        "total": len(tickets),
        "by_status": by_status,
        "by_priority": by_priority,
        "by_site": dict(sorted(by_site.items(), key=lambda x: x[1], reverse=True)[:10]),
        "by_agent": dict(sorted(by_agent.items(), key=lambda x: x[1], reverse=True)[:10]),
        "tickets": tickets_export,
    }


@router.get("/my-tickets", response_model=list[TicketListItem])
def get_my_tickets(
    q: str = Query("", description="Search"),
    status_filter: str = Query("", alias="status"),
    skip: int = 0,
    limit: int = 50,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket).filter(
        Ticket.assignee_user_id == current.user_id
    )

    if q:
        query = query.filter(
            or_(
                Ticket.title.ilike(f"%{q}%"),
                Ticket.requester_name.ilike(f"%{q}%"),
                Ticket.site.ilike(f"%{q}%"),
            )
        )

    if status_filter:
        query = query.filter(Ticket.status == status_filter)

    return (
        query.order_by(Ticket.created_at.desc())
        .offset(skip).limit(limit).all()
    )


@router.get("/my-stats")
def get_my_stats(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.assignee_user_id == current.user_id
    ).scalar()

    by_status = db.query(
        Ticket.status,
        func.count(Ticket.ticket_id)
    ).filter(
        Ticket.assignee_user_id == current.user_id
    ).group_by(Ticket.status).all()

    return {
        "total": total or 0,
        "by_status": {s: c for s, c in by_status},
    }


@router.get("/supervisor-stats")
def get_supervisor_stats(
    current: User = Depends(require_permission(Permission.TICKETS_STATS)),
    db: Session = Depends(get_db),
):

    total = db.query(func.count(Ticket.ticket_id)).scalar()

    by_status = db.query(
        Ticket.status,
        func.count(Ticket.ticket_id)
    ).group_by(Ticket.status).all()

    by_priority = db.query(
        Ticket.priority_label,
        func.count(Ticket.ticket_id)
    ).group_by(Ticket.priority_label).all()

    by_category = db.query(
        Ticket.category,
        func.count(Ticket.ticket_id)
    ).filter(Ticket.category.isnot(None)).group_by(Ticket.category).order_by(func.count(Ticket.ticket_id).desc()).all()

    unassigned = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.assignee_user_id == None
    ).scalar()

    agents = db.query(User).filter(
        User.role.in_(["AGENT", "SUPERVISOR"]),
        User.status == UserStatus.ACTIVE
    ).all()

    by_agent = (
        db.query(
            User.full_name,
            User.user_id,
            func.count(Ticket.ticket_id).label("count")
        )
        .join(Ticket, Ticket.assignee_user_id == User.user_id)
        .filter(User.role.in_(["AGENT", "SUPERVISOR"]))
        .group_by(User.user_id, User.full_name)
        .order_by(func.count(Ticket.ticket_id).desc())
        .all()
    )

    audit_logs = (
        db.query(AuditEvent, User.full_name, Ticket.title)
        .outerjoin(User, AuditEvent.user_id == User.user_id)
        .outerjoin(Ticket, AuditEvent.ticket_id == Ticket.ticket_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(20)
        .all()
    )

    today = date.today()
    last_7_days = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.query(func.count(Ticket.ticket_id)).filter(
            func.date(Ticket.created_at) == day
        ).scalar()
        last_7_days.append({
            "date": day.strftime("%d/%m"),
            "count": count or 0,
        })

    return {
        "total": total or 0,
        "unassigned": unassigned or 0,
        "by_status": {s: c for s, c in by_status},
        "by_priority": {p: c for p, c in by_priority if p},
        "by_category": {cat: c for cat, c in by_category},
        "by_agent": [
            {"full_name": name, "user_id": uid, "count": count}
            for name, uid, count in by_agent
        ],
        "agents": [
            {"user_id": a.user_id, "full_name": a.full_name, "role": a.role.value}
            for a in agents
        ],
        "last_7_days": last_7_days,
        "audit_logs": [
            {
                "event_id": e.event_id,
                "ticket_id": e.ticket_id,
                "ticket_title": title or "—",
                "author_name": name or "—",
                "event_type": e.event_type.value,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e, name, title in audit_logs
        ],
    }


@router.get("/my-requests", response_model=list[TicketListItem])
def get_my_requests(
    q: str = Query("", description="Search"),
    status_filter: str = Query("", alias="status"),
    skip: int = 0,
    limit: int = 50,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket).filter(
        Ticket.requester_name == current.full_name
    )

    if q:
        query = query.filter(
            or_(
                Ticket.title.ilike(f"%{q}%"),
                Ticket.site.ilike(f"%{q}%"),
            )
        )

    if status_filter:
        query = query.filter(Ticket.status == status_filter)

    return (
        query.order_by(Ticket.created_at.desc())
        .offset(skip).limit(limit).all()
    )


# ✅ MODIFIÉ : ajout category + subcategory
@router.post("/create", status_code=status.HTTP_201_CREATED)
def create_ticket(
    payload: dict,
    background_tasks: BackgroundTasks,          # ✅ AJOUT
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = Ticket(
        title=payload.get("title", "Sans objet"),
        description=payload.get("description"),
        description_raw=payload.get("description"),
        description_text=payload.get("description"),
        requester_name=current.full_name,
        requester_user_id=current.user_id,
        priority_label=payload.get("priority_label", "Normale"),
        status="OPEN",
        created_at=datetime.now(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Classification IA en arrière-plan
    from app.services.ai_service import process_ticket_with_ai
    from app.models.app_config import AppConfig
    from app.db.session import SessionLocal

    settings    = db.query(AppConfig).first()
    threshold   = settings.ai_confidence_threshold if settings else 0.75
    auto_assign = settings.ai_auto_assign if settings else False

    def run_ai(tid: int, thr: float, aa: bool):
        bg_db = SessionLocal()
        try:
            process_ticket_with_ai(db=bg_db, ticket_id=tid,
                                   ai_confidence_threshold=thr, ai_auto_assign=aa)
        finally:
            bg_db.close()

    background_tasks.add_task(run_ai, ticket.ticket_id, threshold, auto_assign)

    return ticket


@router.get("/advanced-stats")
def get_advanced_stats(
    current: User = Depends(require_permission(Permission.TICKETS_REPORTS)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import extract

    today = date.today()

    # ── 1. Évolution tickets par mois (12 derniers mois) ──
    monthly = []
    for i in range(11, -1, -1):
        month_date = today.replace(day=1)
        month = month_date.month - i
        year  = month_date.year
        while month <= 0:
            month += 12
            year  -= 1

        created = db.query(func.count(Ticket.ticket_id)).filter(
            extract("year",  Ticket.created_at) == year,
            extract("month", Ticket.created_at) == month,
        ).scalar() or 0

        resolved = db.query(func.count(Ticket.ticket_id)).filter(
            extract("year",  Ticket.resolved_at) == year,
            extract("month", Ticket.resolved_at) == month,
        ).scalar() or 0

        monthly.append({
            "label":    f"{month:02d}/{year}",
            "created":  created,
            "resolved": resolved,
        })

    # ── 2. Top 10 sites ──
    top_sites = (
        db.query(Ticket.site, func.count(Ticket.ticket_id).label("count"))
        .filter(Ticket.site != None, Ticket.site != "")
        .group_by(Ticket.site)
        .order_by(func.count(Ticket.ticket_id).desc())
        .limit(10)
        .all()
    )

    # ── 3. Temps moyen résolution par priorité (en heures) ──
    avg_resolution = (
        db.query(
            Ticket.priority_label,
            func.avg(
                func.extract("epoch", Ticket.resolved_at) -
                func.extract("epoch", Ticket.created_at)
            ).label("avg_seconds")
        )
        .filter(
            Ticket.resolved_at != None,
            Ticket.created_at  != None,
            Ticket.priority_label != None,
        )
        .group_by(Ticket.priority_label)
        .all()
    )

    # ── 4. Répartition par groupe ──
    by_group = (
        db.query(Ticket.group_name, func.count(Ticket.ticket_id).label("count"))
        .filter(Ticket.group_name != None, Ticket.group_name != "")
        .group_by(Ticket.group_name)
        .order_by(func.count(Ticket.ticket_id).desc())
        .limit(10)
        .all()
    )

    # ── 5. Taux résolution global ──
    total         = db.query(func.count(Ticket.ticket_id)).scalar() or 0
    resolved_count = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.status.in_(["RESOLVED", "CLOSED"])
    ).scalar() or 0

    return {
        "monthly":        monthly,
        "top_sites":      [{"site": s, "count": c} for s, c in top_sites],
        "avg_resolution": [
            {
                "priority":  p,
                "avg_hours": round(avg / 3600, 1) if avg else 0,
            }
            for p, avg in avg_resolution if p
        ],
        "by_group":     [{"group": g, "count": c} for g, c in by_group],
        "total":        total,
        "resolved":     resolved_count,
        "resolve_rate": round(resolved_count / total * 100, 1) if total > 0 else 0,
    }


# =========================================================
# ROUTES DYNAMIQUES ENSUITE
# =========================================================

@router.delete("/{ticket_id}", status_code=status.HTTP_200_OK)
def delete_ticket(
    ticket_id: int,
    current: User = Depends(require_permission(Permission.TICKETS_DELETE)),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Supprimer les messages, classifications IA, réponses IA, audit events, SLA instances
    from app.models.message import Message
    from app.models.ai_classification import AIClassification
    from app.models.ai_response import AIResponse
    from app.models.audit_event import AuditEvent
    from app.models.sla_instance import SLAInstance
    from app.models.notification import Notification

    db.query(Message).filter(Message.ticket_id == ticket_id).delete()
    db.query(AIClassification).filter(AIClassification.ticket_id == ticket_id).delete()
    db.query(AIResponse).filter(AIResponse.ticket_id == ticket_id).delete()
    db.query(AuditEvent).filter(AuditEvent.ticket_id == ticket_id).delete()
    db.query(SLAInstance).filter(SLAInstance.ticket_id == ticket_id).delete()
    db.query(Notification).filter(Notification.ticket_id == ticket_id).delete()
    db.delete(ticket)
    db.commit()

    return {"message": f"Ticket #{ticket_id} supprimé avec succès"}


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket_detail(
    ticket_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Agent : seulement ses tickets assignés (par ID ou par nom pour les tickets GEISER)
    if current.role == UserRole.AGENT:
        assigned = (
            (ticket.assignee_user_id is not None and ticket.assignee_user_id == current.user_id)
            or ticket.assignee_name == current.full_name
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Accès refusé")

    # Demandeur : seulement ses propres tickets
    if current.role == UserRole.REQUESTER:
        owns = (
            (ticket.requester_user_id is not None and ticket.requester_user_id == current.user_id)
            or ticket.requester_name == current.full_name
        )
        if not owns:
            raise HTTPException(status_code=403, detail="Accès refusé")

    return ticket


@router.put("/{ticket_id}/status", response_model=TicketDetail)
def update_ticket_status(
    ticket_id: int,
    payload: TicketUpdateStatus,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    new_status = payload.status.strip().upper()
    allowed_statuses = {"OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED", "CANCELLED"}

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status",
        )

    # Agent : peut modifier le statut uniquement de ses tickets assignés (par ID ou par nom)
    if current.role == UserRole.AGENT:
        assigned = (
            (ticket.assignee_user_id is not None and ticket.assignee_user_id == current.user_id)
            or ticket.assignee_name == current.full_name
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Vous ne pouvez modifier que vos propres tickets")

    # Demandeur : peut uniquement confirmer (→ CLOSED) ou rouvrir (→ OPEN) son propre ticket résolu
    if current.role == UserRole.REQUESTER:
        owns = (
            (ticket.requester_user_id is not None and ticket.requester_user_id == current.user_id)
            or ticket.requester_name == current.full_name
        )
        if not owns:
            raise HTTPException(status_code=403, detail="Access denied")
        if ticket.status != "RESOLVED" or new_status not in {"CLOSED", "OPEN"}:
            raise HTTPException(status_code=403, detail="Action non autorisée pour le demandeur")

    old_status = ticket.status

    if old_status == new_status:
        return ticket

    ticket.status = new_status
    ticket.status_manually_updated = True

    if new_status == "RESOLVED":
        ticket.resolved_at = datetime.utcnow()

    if new_status == "CLOSED":
        ticket.closed_at = datetime.utcnow()
        if ticket.resolved_at is None:
            ticket.resolved_at = datetime.utcnow()

    if new_status in {"OPEN", "IN_PROGRESS"}:
        ticket.closed_at = None

    create_audit_event(
        db=db,
        ticket_id=ticket.ticket_id,
        user_id=current.user_id,
        event_type=AuditEventType.STATUS_CHANGED,
        old_value=old_status,
        new_value=new_status,
    )

    db.commit()
    db.refresh(ticket)

    try:
        all_users = db.query(User).all()
        notify_status_changed(
            db=db,
            requester_name=ticket.requester_name or "",
            ticket=ticket,
            old_status=old_status,
            new_status=new_status,
            all_users=all_users,
        )
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            if admin.user_id != current.user_id:
                create_in_app_notification(
                    db=db,
                    user_id=admin.user_id,
                    ticket_id=ticket.ticket_id,
                    title=f"Statut modifié — Ticket #{ticket.external_id or ticket.ticket_id}",
                    message=f"Statut passé de {old_status} à {new_status} sur « {ticket.title} ».",
                )
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")

    return ticket


@router.put("/{ticket_id}/priority", response_model=TicketDetail)
def update_ticket_priority(
    ticket_id: int,
    payload: TicketUpdatePriority,
    current: User = Depends(require_permission(Permission.TICKETS_UPDATE_PRIORITY)),
    db: Session = Depends(get_db),
):

    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    new_priority = payload.priority_label.strip()

    if not new_priority:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priority cannot be empty",
        )

    old_priority = ticket.priority_label

    if old_priority == new_priority:
        return ticket

    ticket.priority_label = new_priority
    ticket.priority_manually_updated = True

    create_audit_event(
        db=db,
        ticket_id=ticket.ticket_id,
        user_id=current.user_id,
        event_type=AuditEventType.PRIORITY_CHANGED,
        old_value=old_priority,
        new_value=new_priority,
    )

    db.commit()
    db.refresh(ticket)

    return ticket


@router.put("/{ticket_id}/assign", response_model=TicketDetail)
def assign_ticket_agent(
    ticket_id: int,
    payload: TicketAssignAgent,
    current: User = Depends(require_permission(Permission.TICKETS_ASSIGN)),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    agent = db.query(User).filter(User.user_id == payload.assignee_user_id).first()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if agent.role not in {UserRole.AGENT, UserRole.SUPERVISOR, UserRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user cannot be assigned to a ticket",
        )

    old_assignee = ticket.assignee_name

    if (
        ticket.assignee_user_id == agent.user_id
        and ticket.assignee_name == agent.full_name
    ):
        return ticket

    ticket.assignee_user_id = agent.user_id
    ticket.assignee_name    = agent.full_name
    ticket.assignee_manually_updated = True

    create_audit_event(
        db=db,
        ticket_id=ticket.ticket_id,
        user_id=current.user_id,
        event_type=AuditEventType.ASSIGNEE_CHANGED,
        old_value=old_assignee,
        new_value=agent.full_name,
    )

    db.commit()
    db.refresh(ticket)

    try:
        notify_ticket_assigned(db=db, agent=agent, ticket=ticket)
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            if admin.user_id != current.user_id:
                create_in_app_notification(
                    db=db,
                    user_id=admin.user_id,
                    ticket_id=ticket.ticket_id,
                    title=f"Ticket #{ticket.external_id or ticket.ticket_id} assigné",
                    message=f"Le ticket « {ticket.title} » a été assigné à {agent.full_name}.",
                )
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")

    return ticket


@router.get("/{ticket_id}/audit", response_model=TicketAuditResponse)
def get_ticket_audit(
    ticket_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    audit_rows = (
        db.query(AuditEvent, User.full_name)
        .outerjoin(User, AuditEvent.user_id == User.user_id)
        .filter(AuditEvent.ticket_id == ticket_id)
        .order_by(AuditEvent.created_at.desc(), AuditEvent.event_id.desc())
        .all()
    )

    items = [
        {
            "event_id": event.event_id,
            "ticket_id": event.ticket_id,
            "user_id": event.user_id,
            "author_name": full_name,
            "event_type": event.event_type,
            "old_value": event.old_value,
            "new_value": event.new_value,
            "created_at": event.created_at,
        }
        for event, full_name in audit_rows
    ]

    return {"items": items}


@router.get("/{ticket_id}/messages", response_model=TicketMessagesResponse)
def get_ticket_messages(
    ticket_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    messages = (
        db.query(Message, User.full_name)
        .outerjoin(User, Message.user_id == User.user_id)
        .filter(Message.ticket_id == ticket_id)
        .order_by(Message.created_at.asc(), Message.message_id.asc())
        .all()
    )

    items = [
        {
            "message_id": message.message_id,
            "ticket_id": message.ticket_id,
            "user_id": message.user_id,
            "author_name": full_name,
            "content": message.content,
            "is_internal": message.is_internal,
            "source": message.source,
            "created_at": message.created_at,
        }
        for message, full_name in messages
    ]

    return {"items": items}


@router.post("/{ticket_id}/messages", response_model=MessageItem, status_code=status.HTTP_201_CREATED)
def create_ticket_message(
    ticket_id: int,
    payload: MessageCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    content = payload.content.strip()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content cannot be empty",
        )

    message = Message(
        ticket_id=ticket.ticket_id,
        user_id=current.user_id,
        content=content,
        is_internal=payload.is_internal,
        source=TicketSource.WEB,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    try:
        recipients = []
        # Notifier l'agent assigné si ce n'est pas lui qui écrit
        if ticket.assignee_user_id and ticket.assignee_user_id != current.user_id:
            agent = db.query(User).filter(User.user_id == ticket.assignee_user_id).first()
            if agent:
                recipients.append(agent)
        # Notifier le demandeur si c'est l'agent/admin qui répond
        if ticket.requester_user_id and ticket.requester_user_id != current.user_id:
            requester = db.query(User).filter(User.user_id == ticket.requester_user_id).first()
            if requester:
                recipients.append(requester)
        # Notifier les admins
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            if admin.user_id != current.user_id and admin not in recipients:
                recipients.append(admin)

        if recipients:
            notify_new_message(
                db=db,
                ticket=ticket,
                author_name=current.full_name,
                recipients=recipients,
            )
    except Exception as e:
        print(f"[NOTIF ERROR] {e}")

    return {
        "message_id": message.message_id,
        "ticket_id": message.ticket_id,
        "user_id": message.user_id,
        "author_name": current.full_name,
        "content": message.content,
        "is_internal": message.is_internal,
        "source": message.source,
        "created_at": message.created_at,
    }


# ── Pièces jointes ────────────────────────────────────────────────────────────
ATTACHMENTS_DIR = "static/ticket_attachments"
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)

ATTACHMENT_ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
ATTACHMENT_MAX_SIZE = 25 * 1024 * 1024  # 25 Mo


def _check_ticket_view_access(ticket: Ticket, current: User) -> None:
    """Même règle d'accès que get_ticket_detail : agent assigné, demandeur propriétaire, admin/superviseur libres."""
    if current.role == UserRole.AGENT:
        assigned = (
            (ticket.assignee_user_id is not None and ticket.assignee_user_id == current.user_id)
            or ticket.assignee_name == current.full_name
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Accès refusé")

    if current.role == UserRole.REQUESTER:
        owns = (
            (ticket.requester_user_id is not None and ticket.requester_user_id == current.user_id)
            or ticket.requester_name == current.full_name
        )
        if not owns:
            raise HTTPException(status_code=403, detail="Accès refusé")


def _get_ticket_or_404(ticket_id: int, db: Session) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.post("/{ticket_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_ticket_attachment(
    ticket_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    _check_ticket_view_access(ticket, current)

    if file.content_type not in ATTACHMENT_ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Utilisez PNG, JPG, PDF, DOC, DOCX ou TXT.",
        )

    contents = await file.read()
    if len(contents) > ATTACHMENT_MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 25 Mo)")
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")

    ticket_dir = os.path.join(ATTACHMENTS_DIR, str(ticket_id))
    os.makedirs(ticket_dir, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    stored_name = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(ticket_dir, stored_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    attachment = TicketAttachment(
        ticket_id=ticket_id,
        original_name=file.filename,
        stored_name=stored_name,
        content_type=file.content_type,
        size_bytes=len(contents),
        uploaded_by=current.user_id,
        uploaded_by_name=current.full_name,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    # Si c'est une image, on relance la classification IA en arrière-plan pour
    # qu'elle prenne en compte le texte extrait par OCR (ex: capture d'écran
    # d'un message d'erreur). La description affichée du ticket n'est jamais
    # modifiée — seul le texte envoyé au classifieur est enrichi.
    if file.content_type and file.content_type.startswith("image/"):
        from app.services.ai_service import process_ticket_with_ai
        from app.models.app_config import AppConfig
        from app.db.session import SessionLocal

        settings    = db.query(AppConfig).first()
        threshold   = settings.ai_confidence_threshold if settings else 0.75
        auto_assign = settings.ai_auto_assign if settings else False

        def run_ai_after_attachment(tid: int, thr: float, aa: bool):
            bg_db = SessionLocal()
            try:
                process_ticket_with_ai(db=bg_db, ticket_id=tid,
                                       ai_confidence_threshold=thr, ai_auto_assign=aa)
            finally:
                bg_db.close()

        background_tasks.add_task(run_ai_after_attachment, ticket_id, threshold, auto_assign)

    return {
        "attachment_id": attachment.attachment_id,
        "ticket_id": attachment.ticket_id,
        "original_name": attachment.original_name,
        "content_type": attachment.content_type,
        "size_bytes": attachment.size_bytes,
        "uploaded_by_name": attachment.uploaded_by_name,
        "created_at": attachment.created_at,
    }


@router.get("/{ticket_id}/attachments")
def list_ticket_attachments(
    ticket_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    _check_ticket_view_access(ticket, current)

    attachments = (
        db.query(TicketAttachment)
        .filter(TicketAttachment.ticket_id == ticket_id)
        .order_by(TicketAttachment.created_at.asc())
        .all()
    )

    return {
        "items": [
            {
                "attachment_id": a.attachment_id,
                "ticket_id": a.ticket_id,
                "original_name": a.original_name,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "uploaded_by_name": a.uploaded_by_name,
                "created_at": a.created_at,
            }
            for a in attachments
        ]
    }


@router.get("/{ticket_id}/attachments/{attachment_id}/download")
def download_ticket_attachment(
    ticket_id: int,
    attachment_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(ticket_id, db)
    _check_ticket_view_access(ticket, current)

    attachment = (
        db.query(TicketAttachment)
        .filter(TicketAttachment.attachment_id == attachment_id, TicketAttachment.ticket_id == ticket_id)
        .first()
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Pièce jointe introuvable")

    file_path = os.path.join(ATTACHMENTS_DIR, str(ticket_id), attachment.stored_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le serveur")

    return FileResponse(
        path=file_path,
        filename=attachment.original_name,
        media_type=attachment.content_type or "application/octet-stream",
    )