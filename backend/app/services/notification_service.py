import os
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.enums import NotificationType, NotificationStatus


def create_in_app_notification(
    db: Session,
    user_id: int,
    ticket_id: int | None,
    title: str,
    message: str,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        ticket_id=ticket_id,
        type=NotificationType.IN_APP,
        status=NotificationStatus.SENT,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def _send_email_background(to_email: str, subject: str, body: str):
    smtp_host     = os.getenv("SMTP_HOST", "")
    smtp_port     = int(os.getenv("SMTP_PORT", "587"))
    smtp_user     = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from     = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user:
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = smtp_from
        msg["To"]      = to_email

        html_body = f"""
        <html><body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0a46d6; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0;">Helpdesk IA</h2>
            </div>
            <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
                <p style="font-size: 15px; color: #334155;">{body}</p>
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                <p style="font-size: 12px; color: #94a3b8;">
                    Cet email a été envoyé automatiquement par Helpdesk IA — Geiser.
                </p>
            </div>
        </div>
        </body></html>
        """

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, to_email, msg.as_string())
            print(f"[EMAIL OK] Envoyé à {to_email}")

    except Exception as e:
        print(f"[EMAIL ERROR] {e}")


def send_email_notification(to_email: str, subject: str, body: str) -> bool:
    """Envoi asynchrone (thread) — pour les notifications non critiques."""
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_user = os.getenv("SMTP_USER", "")
    if not smtp_host or not smtp_user:
        return False
    thread = threading.Thread(
        target=_send_email_background,
        args=(to_email, subject, body),
        daemon=True,
    )
    thread.start()
    return True


def send_email_sync(to_email: str, subject: str, body: str) -> bool:
    """Envoi synchrone — garantit la livraison avant de retourner (utilisé pour l'OTP)."""
    smtp_host     = os.getenv("SMTP_HOST", "")
    smtp_port     = int(os.getenv("SMTP_PORT", "587"))
    smtp_user     = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from     = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user:
        print("[EMAIL SYNC] SMTP non configuré")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = smtp_from
        msg["To"]      = to_email
        msg["X-Priority"] = "1"

        # Version texte brut (anti-spam)
        plain = body.replace("<br><br>", "\n\n").replace("<br>", "\n")
        import re as _re
        plain = _re.sub(r"<[^>]+>", "", plain).strip()
        msg.attach(MIMEText(plain, "plain", "utf-8"))

        # Version HTML
        html_body = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#0B1A52;padding:18px 24px;">
    <h2 style="color:#fff;margin:0;font-size:18px;">🎧 Helpdesk GEISER</h2>
  </div>
  <div style="padding:28px 24px;background:#ffffff;">
    {body}
  </div>
  <div style="padding:14px 24px;background:#f8f9fa;font-size:11px;color:#94a3b8;text-align:center;">
    Email automatique — Helpdesk IA GEISER · Ne pas répondre
  </div>
</div>
</body></html>"""
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, to_email, msg.as_string())
            print(f"[EMAIL SYNC OK] Envoyé à {to_email}")
            return True

    except Exception as e:
        print(f"[EMAIL SYNC ERROR] {e}")
        return False


def notify_ticket_assigned(db: Session, agent, ticket):
    """Notifie l'agent quand un ticket lui est assigné."""
    title   = f"Ticket #{ticket.external_id or ticket.ticket_id} assigné"
    message = f"Le ticket « {ticket.title} » vous a été assigné."

    create_in_app_notification(
        db=db,
        user_id=agent.user_id,
        ticket_id=ticket.ticket_id,
        title=title,
        message=message,
    )

    if agent.email:
        send_email_notification(
            to_email=agent.email,
            subject=f"[Helpdesk IA] {title}",
            body=message,
        )


def notify_status_changed(db: Session, requester_name: str,
                           ticket, old_status: str, new_status: str, all_users: list):
    """Notifie le demandeur quand le statut de son ticket change."""
    title   = f"Statut du ticket #{ticket.external_id or ticket.ticket_id} modifié"
    message = f"Le statut du ticket « {ticket.title} » est passé de {old_status} à {new_status}."

    matching_users = [u for u in all_users if u.full_name == requester_name]
    for user in matching_users:
        create_in_app_notification(
            db=db,
            user_id=user.user_id,
            ticket_id=ticket.ticket_id,
            title=title,
            message=message,
        )
        if user.email:
            send_email_notification(
                to_email=user.email,
                subject=f"[Helpdesk IA] {title}",
                body=message,
            )


def notify_new_message(db: Session, ticket, author_name: str, recipients: list):
    """Notifie les parties prenantes d'un nouveau message."""
    title   = f"Nouveau message sur le ticket #{ticket.external_id or ticket.ticket_id}"
    message = f"{author_name} a ajouté un message sur le ticket « {ticket.title} »."

    for user in recipients:
        create_in_app_notification(
            db=db,
            user_id=user.user_id,
            ticket_id=ticket.ticket_id,
            title=title,
            message=message,
        )
        if user.email:
            send_email_notification(
                to_email=user.email,
                subject=f"[Helpdesk IA] {title}",
                body=message,
            )


def notify_sla_breached(db: Session, ticket, assignee, supervisors: list):
    """Notifie l'agent et les superviseurs quand le SLA est dépassé."""
    title   = f"🚨 SLA dépassé — Ticket #{ticket.external_id or ticket.ticket_id}"
    message = f"Le SLA du ticket « {ticket.title} » (priorité: {ticket.priority_label}) a été dépassé."

    recipients = supervisors.copy()
    if assignee:
        recipients.append(assignee)

    for user in recipients:
        create_in_app_notification(
            db=db,
            user_id=user.user_id,
            ticket_id=ticket.ticket_id,
            title=title,
            message=message,
        )
        if user.email:
            send_email_notification(
                to_email=user.email,
                subject=f"[Helpdesk IA] {title}",
                body=message,
            )