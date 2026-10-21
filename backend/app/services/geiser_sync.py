import json
import logging
import os
import re
import threading

logger = logging.getLogger(__name__)
from datetime import datetime
from typing import Any

import requests
from sqlalchemy.orm import Session

from app.models.enums import SyncStatus, SyncType
from app.models.sync_log import SyncLog
from app.models.ticket import Ticket


def clean_description(html: str | None) -> str | None:
    if not html:
        return html

    # Remplacer &nbsp; par espace normal
    text = html.replace("&nbsp;", " ").replace(" ", " ")

    # Supprimer les balises <p>, <br>, <div> vides ou ne contenant que des espaces
    text = re.sub(r"<(p|div|span)[^>]*>\s*</\1>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<br\s*/?>(\s*<br\s*/?>)+", "<br>", text, flags=re.IGNORECASE)

    # Remplacer les séquences de <p>&nbsp;</p> ou <p> </p>
    text = re.sub(r"<p[^>]*>(\s|&nbsp;)*</p>", "", text, flags=re.IGNORECASE)

    # Supprimer les lignes vides multiples dans le texte brut (hors balises)
    text = re.sub(r"(\s*\n){3,}", "\n\n", text)

    # Nettoyer les espaces multiples consécutifs (hors HTML)
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text.strip()


def map_status(raw_status: str | None) -> str:
    s = (raw_status or "").strip().lower()

    if s in {"ouvert", "open"}:
        return "OPEN"
    if s in {"en cours", "in progress", "in_progress"}:
        return "IN_PROGRESS"
    if s in {"résolu", "resolu", "resolved"}:
        return "RESOLVED"
    if s in {"fermé", "ferme", "closed"}:
        return "CLOSED"
    if s in {"annulé", "annule", "cancelled", "canceled"}:
        return "CANCELLED"

    return (raw_status or "OPEN").strip().upper()


def parse_api_datetime(value: Any):
    if not value:
        return None

    if isinstance(value, dict):
        raw_value = value.get("value")
        display_value = value.get("display_value")

        if raw_value is not None:
            value = raw_value
        elif display_value is not None:
            value = display_value

    if value is None:
        return None

    # timestamp millisecondes
    if isinstance(value, int):
        try:
            return datetime.fromtimestamp(value / 1000)
        except Exception:
            pass

    str_value = str(value).strip()

    if str_value.isdigit():
        try:
            return datetime.fromtimestamp(int(str_value) / 1000)
        except Exception:
            pass

    for fmt in (
        "%b %d, %Y %I:%M %p",
        "%b %d, %Y %I:%M:%S %p",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            return datetime.strptime(str_value, fmt)
        except ValueError:
            pass

    return None


def get_nested(data: dict, *keys, default=None):
    current = data
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current


def extract_ticket_fields(item: dict) -> dict:
    external_id = item.get("id")
    title = item.get("subject") or "Sans objet"
    full_description = clean_description(item.get("description") or item.get("short_description"))
    short_description = clean_description(item.get("short_description"))

    requester_name  = get_nested(item, "requester",  "name")
    technician_name = get_nested(item, "technician", "name")
    site_name       = get_nested(item, "site",       "name")
    priority_name   = get_nested(item, "priority",   "name")
    status_name     = get_nested(item, "status",     "name")
    group_name      = get_nested(item, "group",      "name")
    template_name   = get_nested(item, "template",   "name")
    category_name   = get_nested(item, "category",   "name")
    subcategory_name = get_nested(item, "subcategory", "name")

    created_at = parse_api_datetime(get_nested(item, "created_time"))
    due_at     = parse_api_datetime(get_nested(item, "due_by_time"))

    # Normaliser catégorie et priorité vers la taxonomie courante
    from app.services.normalization import normalize_category, normalize_priority
    norm_cat  = normalize_category(category_name)  if category_name  else None
    norm_prio = normalize_priority(priority_name)  if priority_name  else None

    return {
        "external_id":        int(external_id) if external_id else None,
        "title":              title,
        "description":        full_description,
        "description_raw":    full_description,
        "description_text":   short_description,
        "requester_name":     requester_name,
        "assignee_name":      technician_name,
        "site":               site_name,
        "group_name":         group_name,
        "priority_label":     norm_prio,
        "status":             map_status(status_name),
        "is_service_request": item.get("is_service_request"),
        "template_name":      template_name,
        "is_template_service":item.get("is_service_request"),
        "due_at":             due_at,
        "created_at":         created_at or datetime.utcnow(),
        "category":           norm_cat,
        "subcategory":        subcategory_name,
    }


def apply_ticket_updates(existing: Ticket, fields: dict) -> bool:
    """
    Met à jour un ticket existant avec les données Geiser.
    Chaque champ est protégé individuellement via son flag :
    - priority_manually_updated  → priority_label  ne sera pas écrasé
    - status_manually_updated    → status           ne sera pas écrasé
    - assignee_manually_updated  → assignee_name et assignee_user_id ne seront pas écrasés
    """
    changed = False

    for key, new_value in fields.items():

        # ✅ Protection priorité
        if key == "priority_label":
            if getattr(existing, "priority_manually_updated", False):
                continue

        # ✅ Protection statut
        elif key == "status":
            if getattr(existing, "status_manually_updated", False):
                continue

        # ✅ Protection agent assigné
        elif key in ("assignee_name", "assignee_user_id"):
            if getattr(existing, "assignee_manually_updated", False):
                continue

        # ✅ Protection catégorie : ne pas écraser une catégorie existante avec None
        elif key in ("category", "subcategory"):
            if new_value is None and getattr(existing, key, None) is not None:
                continue

        old_value = getattr(existing, key, None)

        if old_value != new_value:
            setattr(existing, key, new_value)
            changed = True

    return changed


def fetch_ticket_detail(base_url: str, token: str, ticket_id: int) -> str | None:
    """Récupère la description complète d'un ticket via l'endpoint de détail."""
    try:
        url = f"{base_url}/api/v3/requests/{ticket_id}"
        params = {"TECHNICIAN_KEY": token}
        headers = {"Accept": "application/vnd.manageengine.sdp.v3+json"}
        response = requests.get(url, params=params, headers=headers, timeout=15)
        if not response.ok:
            return None
        data = response.json()
        request_data = data.get("request", {})
        raw = request_data.get("description") or request_data.get("short_description")
        return clean_description(raw)
    except Exception:
        return None


def fetch_requests_page(base_url: str, token: str, start_index: int, row_count: int = 100):
    url = f"{base_url}/api/v3/requests"

    input_data = {
        "list_info": {
            "row_count": row_count,
            "start_index": start_index,
        }
    }

    params = {
        "TECHNICIAN_KEY": token,
        "input_data": json.dumps(input_data),
    }

    headers = {
        "Accept": "application/vnd.manageengine.sdp.v3+json",
    }

    response = requests.get(url, params=params, headers=headers, timeout=30)

    if not response.ok:
        raise ValueError(
            f"Geiser API HTTP {response.status_code}: {response.text[:1000]}"
        )

    payload = response.json()

    response_status = payload.get("response_status", {})

    status_code = None
    status_message = None

    if isinstance(response_status, list):
        if response_status:
            first_status = response_status[0] or {}
            if isinstance(first_status, dict):
                status_code = first_status.get("status_code")
                status_message = first_status.get("message") or first_status.get("messages")
    elif isinstance(response_status, dict):
        status_code = response_status.get("status_code")
        status_message = response_status.get("message") or response_status.get("messages")

    if status_code != 2000:
        raise ValueError(
            f"Geiser API error: {status_message or 'Unknown API error'} | payload={payload}"
        )

    requests_data = payload.get("requests", []) or []

    list_info = payload.get("list_info", {}) or {}
    if isinstance(list_info, list):
        list_info = list_info[0] if list_info else {}

    has_more_rows = False
    if isinstance(list_info, dict):
        has_more_rows = bool(list_info.get("has_more_rows", False))

    return requests_data, has_more_rows


def _classify_all_sequential(ticket_ids: list[int]) -> None:
    """
    Traite tous les tickets non classifiés dans un SEUL thread,
    séquentiellement avec un délai pour respecter le rate-limit Groq.
    """
    import time
    from app.db.session import SessionLocal
    from app.services.ai_service import process_ticket_with_ai
    from app.models.app_config import AppConfig

    bg_db = SessionLocal()
    try:
        settings    = bg_db.query(AppConfig).first()
        threshold   = settings.ai_confidence_threshold if settings else 0.75
        auto_assign = settings.ai_auto_assign          if settings else False

        total = len(ticket_ids)
        logger.info(f"[AI-SYNC] Demarrage classification sequentielle : {total} tickets")

        for i, tid in enumerate(ticket_ids, 1):
            try:
                process_ticket_with_ai(
                    db=bg_db,
                    ticket_id=tid,
                    ai_confidence_threshold=threshold,
                    ai_auto_assign=auto_assign,
                )
                logger.info(f"[AI-SYNC] [{i}/{total}] Ticket #{tid} classifie")
            except Exception as e:
                logger.error(f"[AI-SYNC] [{i}/{total}] Ticket #{tid} erreur: {e}")

            # Délai uniquement si on utilise Groq (fallback LLM) pour respecter le rate-limit
            from app.services.ai_service import ML_AVAILABLE
            if not ML_AVAILABLE and i < total:
                time.sleep(2)

    except Exception as e:
        logger.error(f"[AI-SYNC] Erreur generale classification: {e}")
    finally:
        bg_db.close()
        logger.info("[AI-SYNC] Classification terminee")


def _trigger_ai_for_unclassified(db: Session) -> None:
    """
    Récupère TOUS les tickets sans classification IA et les traite
    dans un seul thread de fond (séquentiel, sans saturer Groq).
    """
    try:
        from app.models.ai_classification import AIClassification

        unclassified_ids = (
            db.query(Ticket.ticket_id)
            .outerjoin(AIClassification, Ticket.ticket_id == AIClassification.ticket_id)
            .filter(AIClassification.ai_classif_id == None)  # noqa: E711
            .order_by(Ticket.ticket_id.desc())
            .all()
        )

        if not unclassified_ids:
            logger.info("[AI-SYNC] Tous les tickets sont deja classifies")
            return

        ids = [tid for (tid,) in unclassified_ids]
        logger.info(f"[AI-SYNC] {len(ids)} tickets non classifies -> lancement thread")

        t = threading.Thread(target=_classify_all_sequential, args=(ids,), daemon=True)
        t.start()

    except Exception as e:
        logger.error(f"[AI-SYNC] Impossible de lancer la classification: {e}")


def sync_tickets_from_geiser(db: Session) -> dict:
    geiser_base_url = os.getenv("GEISER_BASE_URL", "")
    geiser_token = os.getenv("GEISER_TOKEN", "")

    if not geiser_token:
        raise ValueError("GEISER_TOKEN is missing in environment variables")

    sync_log = SyncLog(
        type=SyncType.IMPORT,
        status=SyncStatus.SUCCESS,
        message="Synchronisation démarrée",
        fetched_count=0,
        created_count=0,
        updated_count=0,
        skipped_count=0,
        error_count=0,
    )
    db.add(sync_log)
    db.commit()
    db.refresh(sync_log)

    try:
        fetched_count = 0
        created_count = 0
        updated_count = 0
        skipped_count = 0
        error_count = 0

        start_index = 1
        page_size = 100

        while True:
            requests_data, has_more_rows = fetch_requests_page(
                base_url=geiser_base_url,
                token=geiser_token,
                start_index=start_index,
                row_count=page_size,
            )

            if not requests_data:
                break

            fetched_count += len(requests_data)

            for item in requests_data:
                try:
                    fields = extract_ticket_fields(item)
                    external_id = fields.get("external_id")

                    if not external_id:
                        skipped_count += 1
                        continue

                    existing = (
                        db.query(Ticket)
                        .filter(Ticket.external_id == external_id)
                        .first()
                    )

                    if existing:
                        changed = apply_ticket_updates(existing, fields)
                        if changed:
                            updated_count += 1
                        else:
                            skipped_count += 1
                    else:
                        full_desc = fetch_ticket_detail(geiser_base_url, geiser_token, external_id)
                        if full_desc:
                            fields["description"] = full_desc
                            fields["description_raw"] = full_desc
                        ticket = Ticket(**fields)
                        db.add(ticket)
                        created_count += 1

                    db.commit()

                except Exception as e:
                    logger.error(f"[SYNC ERROR] ticket id={item.get('id')}: {type(e).__name__}: {e}")
                    db.rollback()
                    error_count += 1

            if not has_more_rows:
                break

            start_index += page_size

        sync_log.fetched_count = fetched_count
        sync_log.created_count = created_count
        sync_log.updated_count = updated_count
        sync_log.skipped_count = skipped_count
        sync_log.error_count = error_count

        if error_count > 0 and (created_count > 0 or updated_count > 0):
            sync_log.status = SyncStatus.PARTIAL
            sync_log.message = (
                f"Sync partielle : {created_count} créés, "
                f"{updated_count} mis à jour, "
                f"{skipped_count} ignorés, "
                f"{error_count} erreurs."
            )
        elif error_count > 0 and created_count == 0 and updated_count == 0:
            sync_log.status = SyncStatus.FAILED
            sync_log.message = f"Échec de sync : {error_count} erreurs."
        else:
            sync_log.status = SyncStatus.SUCCESS
            sync_log.message = (
                f"Sync réussie : {created_count} créés, "
                f"{updated_count} mis à jour, "
                f"{skipped_count} ignorés."
            )

        db.commit()
        db.refresh(sync_log)

        # Classification IA automatique sur les tickets non encore classifiés
        _trigger_ai_for_unclassified(db)

        return {
            "sync_log_id": sync_log.sync_log_id,
            "status": sync_log.status,
            "fetched_count": sync_log.fetched_count,
            "created_count": sync_log.created_count,
            "updated_count": sync_log.updated_count,
            "skipped_count": sync_log.skipped_count,
            "error_count": sync_log.error_count,
            "message": sync_log.message,
        }

    except Exception as e:
        db.rollback()

        failed_log = db.query(SyncLog).filter(SyncLog.sync_log_id == sync_log.sync_log_id).first()
        if failed_log:
            failed_log.status = SyncStatus.FAILED
            failed_log.message = str(e)
            db.commit()

        raise