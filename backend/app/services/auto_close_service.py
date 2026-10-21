"""
Auto-fermeture des tickets résolus sans réponse du demandeur.
Délai : 3 jours après la date de résolution.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.ticket import Ticket
from app.models.enums import AuditEventType

AUTO_CLOSE_DAYS = 3


def auto_close_resolved_tickets(db: Session) -> int:
    """
    Ferme automatiquement les tickets RESOLVED depuis plus de AUTO_CLOSE_DAYS jours.
    Retourne le nombre de tickets fermés.
    """
    cutoff = datetime.utcnow() - timedelta(days=AUTO_CLOSE_DAYS)

    tickets = (
        db.query(Ticket)
        .filter(
            Ticket.status == "RESOLVED",
            Ticket.resolved_at != None,          # noqa: E711
            Ticket.resolved_at <= cutoff,
        )
        .all()
    )

    if not tickets:
        return 0

    from app.models.audit_event import AuditEvent

    closed = 0
    for ticket in tickets:
        ticket.status = "CLOSED"
        ticket.closed_at = datetime.utcnow()

        event = AuditEvent(
            ticket_id  = ticket.ticket_id,
            user_id    = None,
            event_type = AuditEventType.STATUS_CHANGED,
            old_value  = "RESOLVED",
            new_value  = "CLOSED",
        )
        db.add(event)
        closed += 1

    db.commit()
    print(f"[AUTO-CLOSE] ✅ {closed} ticket(s) fermé(s) automatiquement après {AUTO_CLOSE_DAYS} jours sans réponse.")
    return closed
