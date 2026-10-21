import re
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.ticket import Ticket

CSV_PATH = r"C:\Users\ranim\Desktop\PFE\Helpdesk_IA\Ticket_export.csv"

STATUS_MAP = {
    "Ouvert": "OPEN",
    "Résolu": "RESOLVED",
    "Fermé": "CLOSED",
    "Cancelled": "CANCELED",
    "En cours": "IN_PROGRESS",
}


def clean_html(text: str | None) -> str | None:
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return None
    s = str(text)
    s = s.replace("&nbsp;", " ")
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def parse_dt(x):
    if x is None or (isinstance(x, float) and pd.isna(x)) or str(x).strip() == "":
        return None

    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(str(x), fmt)
        except ValueError:
            pass

    try:
        dt = pd.to_datetime(x, dayfirst=True, errors="coerce")
        if pd.isna(dt):
            return None
        return dt.to_pydatetime()
    except Exception:
        return None


def to_bool(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    v = str(value).strip().lower()

    if v in ["true", "1", "yes", "oui", "vrai"]:
        return True
    if v in ["false", "0", "no", "non", "faux"]:
        return False

    return None


def main():
    df = pd.read_csv(CSV_PATH, encoding="utf-8", sep=",")
    df.columns = [c.strip() for c in df.columns]

    db: Session = SessionLocal()

    try:
        inserted = 0
        skipped_existing = 0
        skipped_duplicate_in_csv = 0

        # Décommente cette ligne si tu veux toujours repartir à zéro
        db.execute(text("TRUNCATE TABLE public.tickets RESTART IDENTITY"))
        db.commit()

        seen_external_ids = set()

        for _, row in df.iterrows():
            ext_id = row.get("ID")
            objet = row.get("OBJET")
            desc = row.get("DESCRIPTION")
            demandeur = row.get("DEMANDEUR")
            attribue = row.get("ATTRIBUÉ À")
            date_creation = row.get("DATE DE CRÉATION")
            date_echeance = row.get("DATE D'ECHÉANCE")
            statut = row.get("STATUT")
            site = row.get("SITE")
            priorite = row.get("PRIORITE")
            groupe = row.get("GROUPE")
            est_service = row.get("EST_DEMANDE_SERVICE")
            template_nom = row.get("TEMPLATE_NOM")
            template_service = row.get("TEMPLATE_SERVICE")

            external_id = int(ext_id) if pd.notna(ext_id) else None

            if external_id is not None:
                if external_id in seen_external_ids:
                    skipped_duplicate_in_csv += 1
                    continue

                exists = db.query(Ticket).filter(Ticket.external_id == external_id).first()
                if exists:
                    skipped_existing += 1
                    continue

                seen_external_ids.add(external_id)

            description_raw = None if pd.isna(desc) else str(desc)
            description_text = clean_html(desc)

            mapped_status = STATUS_MAP.get(
                str(statut).strip(),
                str(statut).strip() if pd.notna(statut) else "OPEN"
            )

            ticket = Ticket(
                external_id=external_id,
                title=str(objet).strip() if pd.notna(objet) else "Sans objet",
                description=description_text,
                description_raw=description_raw,
                description_text=description_text,
                requester_name=None if pd.isna(demandeur) else str(demandeur).strip(),
                assignee_name=None if pd.isna(attribue) else str(attribue).strip(),
                site=None if pd.isna(site) else str(site).strip(),
                group_name=None if pd.isna(groupe) else str(groupe).strip(),
                priority_label=None if pd.isna(priorite) else str(priorite).strip(),
                status=mapped_status,
                is_service_request=to_bool(est_service),
                template_name=None if pd.isna(template_nom) else str(template_nom).strip(),
                is_template_service=to_bool(template_service),
                due_at=parse_dt(date_echeance),
                created_at=parse_dt(date_creation) or datetime.utcnow(),
            )

            db.add(ticket)
            inserted += 1

        db.commit()
        print(
            f"✅ Import terminé. "
            f"Insérés: {inserted}, "
            f"déjà en base: {skipped_existing}, "
            f"doublons CSV ignorés: {skipped_duplicate_in_csv}"
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()