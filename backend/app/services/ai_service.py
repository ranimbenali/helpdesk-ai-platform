"""
Service IA — Helpdesk Geiser
Deux approches de classification :
  1. ML (TF-IDF + LinearSVC) — rapide, offline, modèles .pkl
  2. LLM (Groq / LLaMA 3)   — flexible, compréhension contextuelle

Pipeline complet :
  - Classification : catégorie + sous-catégorie + priorité
  - Réponse automatique suggérée
  - Suggestion d'agent (scoring multi-critères)
"""

import os
import json
import re
import pickle
import logging
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.ticket import Ticket
from app.models.user import User
from app.models.ai_classification import AIClassification, AIValidationStatus
from app.models.ai_response import AIResponse
from app.models.enums import UserRole

logger = logging.getLogger(__name__)

# ── Chemins modèles ML ────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).parent.parent / "ai_service" / "models"

# ── Catégories (taxonomie v2) ─────────────────────────────────────────────────
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

PRIORITIES = ["P1_URGENT", "P2_HIGH", "P3_NORMAL", "P4_LOW"]

from app.services.normalization import normalize_category as _normalize_category, normalize_priority as _normalize_priority

# ── Chargement des modèles ML ─────────────────────────────────────────────────
def _load_model(filename: str):
    path = MODELS_DIR / filename
    if path.exists():
        try:
            with open(path, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            logger.warning(f"[AI] Impossible de charger {filename} (incompatibilité binaire?) : {e}")
            return None
    logger.warning(f"[AI] Modèle introuvable : {filename}")
    return None

# ── Serving depuis le registre MLflow (catégorie/sous-catégorie/priorité) ─────
# Ces 3 modèles sont suivis et versionnés dans MLflow (notebook 02) ; le serving
# charge la version taguée "champion" du registre. En cas d'indispo du registre,
# on retombe sur le .pkl statique — résilience, jamais un blocage du démarrage.
#
# MLFLOW_TRACKING_URI (si définie, ex. http://mlflow:5000 en Docker ou
# http://localhost:5000 en local) fait passer par le serveur MLflow partagé —
# nécessaire car un accès direct au fichier SQLite stocke des chemins absolus
# propres à l'OS (Windows vs Linux), donc jamais portable entre local et Docker.
# Sans cette variable (dev sans le service mlflow lancé), on retombe sur l'accès
# direct au fichier SQLite local.
MLFLOW_DB_PATH = Path(__file__).parent.parent.parent / "notebooks" / "mlflow.db"

def _load_classifier(registered_name: str, alias: str, fallback_filename: str):
    tracking_uri = os.getenv("MLFLOW_TRACKING_URI")
    if tracking_uri or MLFLOW_DB_PATH.exists():
        try:
            import mlflow
            mlflow.set_tracking_uri(tracking_uri or f"sqlite:///{MLFLOW_DB_PATH.as_posix()}")
            model = mlflow.sklearn.load_model(f"models:/{registered_name}@{alias}")
            logger.info(f"[AI] Modèle '{registered_name}@{alias}' chargé depuis le registre MLflow ({tracking_uri or 'sqlite local'})")
            return model
        except Exception as e:
            logger.warning(f"[AI] Registre MLflow indisponible pour {registered_name} ({e}) — fallback .pkl")
    return _load_model(fallback_filename)

_model_cat  = _load_classifier("helpdesk-categorie", "champion", "model_categorie.pkl")
_model_sous = _load_classifier("helpdesk-sous_categorie", "champion", "model_sous_categorie.pkl")
_model_prio = _load_classifier("helpdesk-priorite", "champion", "model_priorite.pkl")
_le_cat     = _load_model("label_encoder_cat.pkl")
_le_sous    = _load_model("label_encoder_sous.pkl")
_le_prio    = _load_model("label_encoder_prio.pkl")
_model_routing       = _load_model("model_routing.pkl")
_le_agent            = _load_model("label_encoder_agent.pkl")
_routing_rules       = _load_model("routing_rules.pkl") or {}
_model_sla_risk      = _load_model("model_sla_risk.pkl")
_tfidf_sla           = _load_model("tfidf_sla.pkl")
_model_anomaly       = _load_model("model_anomaly.pkl")
_tfidf_anomaly       = _load_model("tfidf_anomaly.pkl")
_model_cluster       = _load_model("model_cluster.pkl")
_tfidf_cluster       = _load_model("tfidf_cluster.pkl")

ML_AVAILABLE = all([_model_cat, _model_sous, _model_prio, _le_cat, _le_sous, _le_prio])
SLA_RISK_MODEL_AVAILABLE = bool(_model_sla_risk and _tfidf_sla)
ANOMALY_MODEL_AVAILABLE  = bool(_model_anomaly and _tfidf_anomaly)
CLUSTER_MODEL_AVAILABLE  = bool(_model_cluster and _tfidf_cluster)


def get_cluster_keywords(cluster_id: int, top_n: int = 6) -> list[str]:
    """Mots-clés dominants d'un cluster, à partir du centre du cluster (mêmes calculs que le notebook 05)."""
    if not CLUSTER_MODEL_AVAILABLE or cluster_id >= _model_cluster.n_clusters:
        return []
    center = _model_cluster.cluster_centers_[cluster_id]
    top_indices = center.argsort()[-top_n:][::-1]
    return [_tfidf_cluster.get_feature_names_out()[i] for i in top_indices]
logger.info(f"[AI] Modèles ML chargés : {'✅' if ML_AVAILABLE else '❌'}")


# ── Nettoyage texte ───────────────────────────────────────────────────────────
def _clean_text(text: str) -> str:
    if not text:
        return ""
    text = str(text).lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&\w+;", " ", text)
    text = re.sub(r"http\S+", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"[^a-zà-ÿ\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# ── OCR : extraction de texte des pièces jointes images ───────────────────────
# Désactivé pendant les tests (HELPDESK_TESTING=1, fixé dans tests/conftest.py) :
# le premier appel réel télécharge des modèles depuis internet, ce qui rendrait
# la suite de tests lente et dépendante du réseau.
_OCR_DISABLED_FOR_TESTS = os.getenv("HELPDESK_TESTING") == "1"
_ocr_reader = None


def _get_ocr_reader():
    """Charge le lecteur EasyOCR à la demande — coûteux (modèles + mémoire), donc pas au démarrage."""
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        _ocr_reader = easyocr.Reader(["fr", "en"], gpu=False, verbose=False)
    return _ocr_reader


def extract_text_from_image(file_path: str) -> str:
    """
    Extrait le texte visible d'une image via OCR (easyocr).
    Ne lève jamais d'exception : retourne '' si l'OCR échoue ou est désactivé,
    pour ne jamais bloquer le pipeline de classification.
    """
    if _OCR_DISABLED_FOR_TESTS:
        return ""
    try:
        reader = _get_ocr_reader()
        lines = reader.readtext(file_path, detail=0)
        return " ".join(lines)
    except Exception as e:
        logger.warning(f"[OCR] Extraction échouée pour {file_path} : {e}")
        return ""


def get_ocr_text_for_ticket(ticket_id: int, db: Session, max_chars: int = 2000) -> str:
    """Concatène le texte OCR de toutes les pièces jointes images d'un ticket."""
    from app.models.ticket_attachment import TicketAttachment

    attachments = (
        db.query(TicketAttachment)
        .filter(TicketAttachment.ticket_id == ticket_id)
        .filter(TicketAttachment.content_type.like("image/%"))
        .all()
    )
    if not attachments:
        return ""

    texts = []
    for a in attachments:
        file_path = os.path.join("static", "ticket_attachments", str(ticket_id), a.stored_name)
        if os.path.exists(file_path):
            texts.append(extract_text_from_image(file_path))

    combined = " ".join(t for t in texts if t)
    return combined[:max_chars]


# ── Prédiction du risque SLA (Gradient Boosting, notebook 05) ─────────────────
# Distinct du calcul de risque_score déjà en place (temps écoulé / échéance) :
# ce modèle prédit, à partir du seul texte du ticket, la probabilité qu'il
# s'agisse d'un ticket à priorité urgente/haute — donc à SLA serré.
def predict_anomaly(title: str, description: str | None) -> dict | None:
    """
    Détecte si un ticket est atypique par rapport au corpus historique
    (Isolation Forest, notebook 05). Ne renvoie pas un pourcentage : le score
    d'Isolation Forest n'est pas une probabilité, seulement un signal relatif
    (plus négatif = plus atypique) — on le montre tel quel, sans le déguiser
    en faux pourcentage.

    Retourne {is_anomaly, anomaly_score} ou None si le modèle est indisponible.
    """
    if not ANOMALY_MODEL_AVAILABLE:
        return None
    try:
        text = _clean_text(f"{title} {description or ''}")
        X = _tfidf_anomaly.transform([text])
        is_anomaly = bool(_model_anomaly.predict(X)[0] == -1)
        score = float(_model_anomaly.score_samples(X)[0])
        return {"is_anomaly": is_anomaly, "anomaly_score": round(score, 4)}
    except Exception as e:
        logger.warning(f"[ANOMALY] Prédiction échouée : {e}")
        return None


def predict_cluster(title: str, description: str | None) -> int | None:
    """
    Assigne le ticket au cluster thématique le plus proche (KMeans, notebook 05).

    Limite connue et assumée : avec K=3 (suggéré par la méthode Elbow), seul un
    des 3 clusters correspond à un vrai thème métier cohérent (comptes/messagerie) —
    les 2 autres captent surtout des formules de politesse et des signatures
    d'email répétées, pas des problèmes récurrents distincts.
    """
    if not CLUSTER_MODEL_AVAILABLE:
        return None
    try:
        text = _clean_text(f"{title} {description or ''}")
        X = _tfidf_cluster.transform([text])
        return int(_model_cluster.predict(X)[0])
    except Exception as e:
        logger.warning(f"[CLUSTER] Prédiction échouée : {e}")
        return None


def predict_sla_risk(title: str, description: str | None) -> int | None:
    """Retourne un score 0-100 (probabilité 'à risque'), ou None si le modèle est indisponible."""
    if not SLA_RISK_MODEL_AVAILABLE:
        return None
    try:
        text = _clean_text(f"{title} {description or ''}")
        X = _tfidf_sla.transform([text])
        proba_at_risk = _model_sla_risk.predict_proba(X)[0][1]
        return round(float(proba_at_risk) * 100)
    except Exception as e:
        logger.warning(f"[SLA-RISK] Prédiction échouée : {e}")
        return None


# ── Prévision du volume de tickets (Prophet, notebook 05) ─────────────────────
# Différent des 3 prédictions précédentes (calculées par ticket, une fois, à la
# classification) : ici on entraîne Prophet à la demande sur l'historique
# complet des tickets en base — pas de modèle figé sauvegardé, pour toujours
# refléter les données les plus récentes. Mis en cache 1h pour éviter de
# ré-entraîner à chaque appel (l'entraînement lui-même ne prend qu'~1 seconde,
# mais inutile de le refaire à chaque chargement de page).
_forecast_cache: dict = {"result": None, "computed_at": None}
FORECAST_CACHE_TTL_SECONDS = 3600
FORECAST_MIN_DAYS = 14  # en dessous, pas assez d'historique pour une saisonnalité hebdo sensée
FORECAST_HISTORY_WINDOW_DAYS = 180  # limite l'historique renvoyé pour garder le graphique lisible


def get_volume_forecast(db: Session, periods: int = 30) -> dict | None:
    """
    Prévision du nombre de tickets créés par jour (Prophet).
    Retourne {"history": [...], "forecast": [...]} ou None si indisponible
    (désactivé en test, pas assez d'historique, ou échec d'entraînement).
    """
    import time

    now = time.time()
    cached = _forecast_cache["result"]
    if cached is not None and now - (_forecast_cache["computed_at"] or 0) < FORECAST_CACHE_TTL_SECONDS:
        return cached

    if os.getenv("HELPDESK_TESTING") == "1":
        return None

    try:
        import pandas as pd
        from prophet import Prophet
        from sqlalchemy import func as sqlfunc

        day = sqlfunc.date(Ticket.created_at)
        rows = (
            db.query(day.label("day"), sqlfunc.count(Ticket.ticket_id))
            .group_by(day)
            .order_by(day)
            .all()
        )
        if len(rows) < FORECAST_MIN_DAYS:
            logger.info(f"[FORECAST] Historique insuffisant ({len(rows)} jours < {FORECAST_MIN_DAYS})")
            return None

        df = pd.DataFrame(rows, columns=["ds", "y"])
        df["ds"] = pd.to_datetime(df["ds"])

        model = Prophet(
            yearly_seasonality=True, weekly_seasonality=True,
            daily_seasonality=False, changepoint_prior_scale=0.05,
        )
        model.fit(df)
        future   = model.make_future_dataframe(periods=periods)
        forecast = model.predict(future)

        history_df = df[df["ds"] >= df["ds"].max() - pd.Timedelta(days=FORECAST_HISTORY_WINDOW_DAYS)]
        history = [
            {"date": r["ds"].strftime("%Y-%m-%d"), "actual": int(r["y"])}
            for _, r in history_df.iterrows()
        ]

        future_only = forecast[forecast["ds"] > df["ds"].max()]
        predictions = [
            {
                "date":       r["ds"].strftime("%Y-%m-%d"),
                "yhat":       round(max(0.0, r["yhat"]), 1),
                "yhat_lower": round(max(0.0, r["yhat_lower"]), 1),
                "yhat_upper": round(max(0.0, r["yhat_upper"]), 1),
            }
            for _, r in future_only.iterrows()
        ]

        result = {"history": history, "forecast": predictions}
        _forecast_cache["result"]      = result
        _forecast_cache["computed_at"] = now
        return result
    except Exception as e:
        logger.warning(f"[FORECAST] Prévision échouée : {e}")
        return None


# ── APPROCHE 1 : Classification ML ───────────────────────────────────────────
def classify_with_ml(title: str, description: str | None) -> dict:
    """Classifie un ticket : TF-IDF + LinearSVC (catégorie/sous-catégorie), TF-IDF + XGBoost (priorité)."""
    if not ML_AVAILABLE:
        logger.warning("[AI-ML] Modèles non disponibles")
        return _default_result("ML-unavailable")

    try:
        text = _clean_text(f"{title} {description or ''}")

        # Catégorie
        cat_enc   = _model_cat.predict([text])[0]
        categorie = _normalize_category(_le_cat.inverse_transform([cat_enc])[0])

        # Confiance catégorie
        # Formule : écart entre le 1er et 2ème choix normalisé par l'amplitude totale
        # → plus le 1er choix domine le 2ème, plus la confiance est haute
        try:
            import numpy as np
            scores        = _model_cat.decision_function([text])[0]
            sorted_scores = np.sort(scores)[::-1]
            score_range   = sorted_scores[0] - sorted_scores[-1]
            if score_range > 0:
                confidence = float((sorted_scores[0] - sorted_scores[1]) / score_range)
            else:
                confidence = 0.5
            confidence = round(max(0.10, min(0.99, confidence)), 3)
        except Exception:
            confidence = 0.75

        # Sous-catégorie
        sous_enc      = _model_sous.predict([text])[0]
        sous_categorie = _le_sous.inverse_transform([sous_enc])[0]

        # Priorité
        prio_enc = _model_prio.predict([text])[0]
        priorite  = _le_prio.inverse_transform([prio_enc])[0]

        # Extraction mots-clés simples (top tokens TF-IDF)
        keywords = _extract_keywords(text)

        logger.info(f"[AI-ML] ✅ {categorie}/{sous_categorie} — {priorite} — conf: {confidence:.0%}")

        return {
            "predicted_category":    categorie,
            "predicted_subcategory": sous_categorie,
            "predicted_priority":    priorite,
            "confidence":            round(confidence, 3),
            "keywords":              json.dumps(keywords, ensure_ascii=False),
            "auto_reply":            "",
            "model_version":         "ML-TF-IDF-v3-mixed",  # LinearSVC (catégorie/sous-catégorie) + XGBoost (priorité)
        }

    except Exception as e:
        logger.error(f"[AI-ML] ❌ Erreur : {e}")
        return _default_result("ML-error")


def _extract_keywords(text: str, n: int = 5) -> list[str]:
    """Extrait les mots significatifs du texte."""
    stopwords = {"de", "du", "le", "la", "les", "un", "une", "des", "et", "en",
                 "à", "au", "par", "pour", "sur", "avec", "dans", "que", "qui",
                 "ne", "pas", "se", "ce", "il", "elle", "je", "nous", "vous"}
    words = [w for w in text.split() if len(w) > 3 and w not in stopwords]
    seen, result = set(), []
    for w in words:
        if w not in seen:
            seen.add(w)
            result.append(w)
        if len(result) == n:
            break
    return result


# ── APPROCHE 2 : Classification LLM (Groq) ───────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODEL_NAME   = "openai/gpt-oss-120b"  # llama-3.3-70b-versatile retiré du catalogue Groq


def classify_with_llm(title: str, description: str | None) -> dict:
    """Classifie un ticket via Groq (LLaMA 3) — approche LLM."""
    if not GROQ_API_KEY:
        logger.warning("[AI-LLM] GROQ_API_KEY non configurée")
        return _default_result(MODEL_NAME)

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)

        categories_str = "\n".join([
            f"- {cat}: {', '.join(subs)}"
            for cat, subs in CATEGORIES.items()
        ])

        prompt = f"""Tu es un expert en support IT helpdesk pour l'entreprise GEISER.
Analyse ce ticket et retourne UNIQUEMENT un objet JSON valide, sans markdown, sans backticks.

TICKET:
Titre: {title}
Description: {description or "Aucune description"}

CATÉGORIES ET SOUS-CATÉGORIES DISPONIBLES:
{categories_str}

PRIORITÉS DISPONIBLES (utilise exactement ces valeurs) :
- Urgente  : système en panne totale, blocage production, toute l'entreprise impactée
- Haute    : fonctionnalité indisponible, plusieurs utilisateurs impactés
- Normale  : problème gênant mais contournable, un seul utilisateur impacté
- Faible   : demande non urgente, question, information

RETOURNE CE JSON EXACT:
{{
  "predicted_category": "catégorie exacte",
  "predicted_subcategory": "sous-catégorie exacte",
  "predicted_priority": "Urgente|Haute|Normale|Faible",
  "confidence": 0.85,
  "keywords": ["mot1", "mot2", "mot3"],
  "auto_reply": "Réponse automatique en français (2-3 phrases)"
}}"""

        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "Tu es un assistant IT helpdesk. Tu réponds UNIQUEMENT en JSON valide."},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.1,
            max_tokens=500,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

        # Validation
        category = result.get("predicted_category", "Autre")
        if category not in CATEGORIES:
            category = "Autre"

        subcategory = result.get("predicted_subcategory", "Non classifiable")
        if subcategory not in CATEGORIES.get(category, []):
            subcategory = CATEGORIES[category][0]

        priority   = result.get("predicted_priority", "Normale")
        # Normaliser au cas où le LLM retourne encore un code
        priority   = _normalize_priority(priority)
        FR_PRIORITIES = ["Urgente", "Haute", "Normale", "Faible"]
        if priority not in FR_PRIORITIES:
            priority = "Normale"

        confidence = float(result.get("confidence", 0.75))
        confidence = max(0.0, min(1.0, confidence))

        keywords = result.get("keywords", [])
        keywords_str = json.dumps(keywords, ensure_ascii=False) if isinstance(keywords, list) else "[]"

        logger.info(f"[AI-LLM] ✅ {category}/{subcategory} — {priority} — conf: {confidence:.0%}")

        return {
            "predicted_category":    category,
            "predicted_subcategory": subcategory,
            "predicted_priority":    priority,
            "confidence":            confidence,
            "keywords":              keywords_str,
            "auto_reply":            result.get("auto_reply", ""),
            "model_version":         MODEL_NAME,
        }

    except json.JSONDecodeError as e:
        logger.error(f"[AI-LLM] ❌ JSON invalide : {e}")
        return _default_result(MODEL_NAME)
    except Exception as e:
        logger.error(f"[AI-LLM] ❌ Erreur Groq : {e}")
        return _default_result(MODEL_NAME)


# ── Résultat par défaut ───────────────────────────────────────────────────────
def _default_result(model_version: str) -> dict:
    return {
        "predicted_category":    None,
        "predicted_subcategory": None,
        "predicted_priority":    None,
        "confidence":            0.0,
        "keywords":              "[]",
        "auto_reply":            "",
        "model_version":         model_version,
    }


# ── Sauvegarde BDD ────────────────────────────────────────────────────────────
def save_classification(db: Session, ticket_id: int, result: dict) -> AIClassification:
    raw_cat  = result.get("predicted_category")
    raw_prio = result.get("predicted_priority")
    classification = AIClassification(
        ticket_id             = ticket_id,
        predicted_priority    = _normalize_priority(raw_prio) if raw_prio else None,
        predicted_category    = _normalize_category(raw_cat)  if raw_cat  else None,
        predicted_subcategory = result.get("predicted_subcategory"),
        confidence            = result.get("confidence"),
        ml_confidence         = result.get("ml_confidence"),
        keywords              = result.get("keywords"),
        model_version         = result.get("model_version"),
        is_anomaly            = result.get("is_anomaly"),
        anomaly_score         = result.get("anomaly_score"),
        cluster_id            = result.get("cluster_id"),
        validation_status     = AIValidationStatus.PENDING,
    )
    db.add(classification)
    db.commit()
    db.refresh(classification)
    return classification


def save_auto_reply(db: Session, ticket_id: int, result: dict) -> AIResponse | None:
    auto_reply = result.get("auto_reply", "")
    if not auto_reply:
        return None
    ai_response = AIResponse(
        ticket_id     = ticket_id,
        generated_text = auto_reply,
        confidence    = result.get("confidence"),
        model_version = result.get("model_version"),
    )
    db.add(ai_response)
    db.commit()
    db.refresh(ai_response)
    return ai_response


_PRIO_TO_FR = {
    "P1_URGENT": "Urgente",
    "P2_HIGH":   "Haute",
    "P3_NORMAL": "Normale",
    "P4_LOW":    "Faible",
}

def apply_classification_to_ticket(
    db: Session,
    ticket: Ticket,
    result: dict,
    ai_confidence_threshold: float = 0.75,
    ai_auto_assign: bool = False,
):
    if result.get("predicted_category"):
        ticket.category    = result["predicted_category"]
        ticket.subcategory = result.get("predicted_subcategory")

    if (
        result.get("predicted_priority")
        and result.get("confidence", 0) >= ai_confidence_threshold
        and not ticket.priority_manually_updated
    ):
        prio_raw = result["predicted_priority"]
        ticket.priority_label = _normalize_priority(_PRIO_TO_FR.get(prio_raw, prio_raw))

    db.commit()
    db.refresh(ticket)

    # Créer la ligne SLA dès que la priorité est connue — sans ça, un ticket créé
    # après le démarrage du serveur n'aurait de ligne SLA qu'au prochain redémarrage
    # (init_sla_instances_for_existing_tickets ne tourne qu'au startup).
    if ticket.priority_label:
        try:
            from app.services.sla_service import create_sla_instance
            create_sla_instance(db, ticket)
        except Exception as e:
            logger.warning(f"[AI] Création instance SLA échouée pour ticket #{ticket.ticket_id} : {e}")


# ── Suggestion agent (scoring : expertise historique + charge) ────────────────
def suggest_agent(
    db: Session,
    category: str | None = None,
    ticket_id: int | None = None,
) -> dict | None:
    """
    Formule : score = (expertise_catégorie × 2) - charge_actuelle

    expertise = nb tickets RESOLVED/CLOSED dans cette catégorie assignés à l'agent
    charge    = nb tickets OPEN/IN_PROGRESS/PENDING actuellement assignés

    Repli : si aucun agent actif n'a d'expertise dans la catégorie (score non
    informatif), on utilise la règle statique routing_rules.pkl (agent
    historiquement le plus sollicité par catégorie, cf. 03_routage_agent.ipynb).

    Retourne : {agent, score, expertise, load, strategie} ou None
    (strategie = "score" ou "regle_categorie")
    """
    try:
        from sqlalchemy import func
        from app.models.system_log import SystemLog

        # Sous-requête 1 : charge actuelle par agent
        load_sq = (
            db.query(
                Ticket.assignee_user_id.label("uid"),
                func.count(Ticket.ticket_id).label("load"),
            )
            .filter(Ticket.status.in_(["OPEN", "IN_PROGRESS", "PENDING"]))
            .filter(Ticket.assignee_user_id.isnot(None))
            .group_by(Ticket.assignee_user_id)
            .subquery()
        )

        # Sous-requête 2 : expertise par catégorie
        exp_sq = (
            db.query(
                Ticket.assignee_user_id.label("uid"),
                func.count(Ticket.ticket_id).label("expertise"),
            )
            .filter(Ticket.status.in_(["RESOLVED", "CLOSED"]))
            .filter(Ticket.assignee_user_id.isnot(None))
        )
        if category:
            exp_sq = exp_sq.filter(Ticket.category == category)
        exp_sq = exp_sq.group_by(Ticket.assignee_user_id).subquery()

        # Requête principale : tous les agents actifs
        rows = (
            db.query(
                User,
                func.coalesce(exp_sq.c.expertise, 0).label("expertise"),
                func.coalesce(load_sq.c.load, 0).label("load"),
            )
            .outerjoin(exp_sq,  User.user_id == exp_sq.c.uid)
            .outerjoin(load_sq, User.user_id == load_sq.c.uid)
            .filter(User.role.in_([UserRole.AGENT, UserRole.SUPERVISOR]))
            .filter(User.status == "ACTIVE")
            .all()
        )

        if not rows:
            logger.warning("[ROUTING] Aucun agent actif trouvé")
            return None

        # Calcul du score pour chaque agent
        def _score(row) -> float:
            return (row.expertise * 2) - row.load

        rows.sort(key=lambda r: (-_score(r), r.load))
        best     = rows[0]
        best_user, best_exp, best_load = best[0], best.expertise, best.load
        best_score = _score(best)
        strategie  = "score"

        # Repli règle catégorie : si aucun agent actif n'a d'historique dans cette
        # catégorie (expertise=0 partout), le score ne reflète que la charge —
        # pas de signal d'expertise fiable. On privilégie alors l'agent
        # historiquement le plus sollicité sur cette catégorie, calculé dans
        # 03_routage_agent.ipynb et sauvegardé dans routing_rules.pkl.
        if best_exp == 0 and category and category in _routing_rules:
            nom_repli = _routing_rules[category]
            candidat_repli = next((r for r in rows if r[0].full_name == nom_repli), None)
            if candidat_repli:
                best_user, best_exp, best_load = (
                    candidat_repli[0], candidat_repli.expertise, candidat_repli.load
                )
                best_score = _score(candidat_repli)
                strategie  = "regle_categorie"
                logger.info(
                    f"[ROUTING] Repli règle catégorie → {best_user.full_name} "
                    f"(aucun agent avec historique pour '{category}')"
                )

        # Log détaillé dans la console
        logger.info(
            f"[ROUTING] Catégorie='{category}' | "
            f"Agent={best_user.full_name} | "
            f"Stratégie={strategie} | "
            f"Score={best_score:.1f} (expertise={best_exp}×2, charge={best_load})"
        )

        # Audit SystemLog
        candidates_info = " | ".join(
            f"{r[0].full_name}(exp={r.expertise},load={r.load},score={_score(r):.0f})"
            for r in rows[:5]
        )
        try:
            db.add(SystemLog(
                event_type="ticket.routed",
                category="IA",
                user_name="IA Système",
                severity="Info",
                detail=(
                    f"Routage IA — ticket#{ticket_id or '?'} | "
                    f"Catégorie: {category or 'inconnue'} | "
                    f"Agent sélectionné: {best_user.full_name} "
                    f"(stratégie={strategie}, expertise={best_exp}, charge={best_load}, score={best_score:.1f}) | "
                    f"Candidats: [{candidates_info}]"
                ),
            ))
            db.commit()
        except Exception as log_err:
            db.rollback()
            logger.warning(f"[ROUTING] Erreur log audit: {log_err}")

        return {
            "agent":     best_user,
            "score":     best_score,
            "expertise": best_exp,
            "load":      best_load,
            "strategie": strategie,
        }

    except Exception as e:
        logger.error(f"[ROUTING] ❌ Erreur suggestion agent : {e}")
        return None


# ── Génération réponse automatique via Groq ───────────────────────────────────
def generate_auto_reply_groq(
    title: str,
    description: str | None,
    category: str | None,
    priority: str | None,
) -> str:
    """
    Génère une réponse automatique professionnelle via Groq LLaMA 3.
    Utilisée quand le modèle ML ne génère pas de réponse.
    """
    if not GROQ_API_KEY:
        return ""
    try:
        import requests as _req
        prompt = f"""Tu es un agent de support helpdesk chez GEISER.
Un utilisateur a soumis le ticket suivant :

Titre : {title}
Description : {description or 'Non fournie'}
Catégorie détectée : {category or 'Inconnue'}
Priorité : {priority or 'Normale'}

Rédige une réponse professionnelle et bienveillante en français (3-4 phrases) qui :
1. Accuse réception du ticket
2. Confirme la prise en charge
3. Donne une première piste de résolution ou action concrète selon la catégorie
4. Indique le délai de traitement selon la priorité

Réponds uniquement avec le texte de la réponse, sans titre ni formatage."""

        resp = _req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": MODEL_NAME,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 400,  # marge un peu plus large : gpt-oss est plus verbeux que llama3
                "temperature": 0.5,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"[AI] Erreur génération réponse auto : {e}")
        return ""


# ── Pipeline principal ────────────────────────────────────────────────────────
def process_ticket_with_ai(
    db: Session,
    ticket_id: int,
    ai_confidence_threshold: float = 0.75,
    ai_auto_assign: bool = False,
):
    """
    Pipeline complet :
    1. Classification ML (primary — rapide, offline)
    2. Si ML indisponible → fallback LLM Groq
    3. Sauvegarde classification + réponse auto
    4. Application au ticket si confiance suffisante
    5. Suggestion agent si auto_assign activé
    """
    try:
        ticket = db.query(Ticket).filter(Ticket.ticket_id == ticket_id).first()
        if not ticket:
            logger.error(f"[AI] ❌ Ticket #{ticket_id} non trouvé")
            return

        logger.info(f"[AI] 🔄 Traitement ticket #{ticket_id}: {ticket.title}")

        # Étape 1 : ML + fallback LLM si confiance insuffisante
        # Le texte OCR des pièces jointes images enrichit la classification sans
        # jamais modifier la description affichée au ticket (elle reste celle
        # écrite par le demandeur).
        base_description = ticket.description_text or ticket.description or ""
        ocr_text = get_ocr_text_for_ticket(ticket_id, db)
        description_for_ai = f"{base_description} {ocr_text}".strip() if ocr_text else base_description
        if ocr_text:
            logger.info(f"[AI] 📎 Texte OCR ajouté depuis les pièces jointes ({len(ocr_text)} caractères)")

        result = classify_with_fallback(
            title=ticket.title,
            description=description_for_ai,
            threshold=ai_confidence_threshold,
        )
        used_llm = result.get("used_llm_fallback", False)
        logger.info(f"[AI] {'LLM fallback' if used_llm else 'ML'} utilisé (conf={result.get('confidence',0):.0%})")

        # Étape 1bis : détection d'anomalie (ticket atypique vs corpus historique)
        anomaly = predict_anomaly(ticket.title, base_description)
        if anomaly:
            result["is_anomaly"]    = anomaly["is_anomaly"]
            result["anomaly_score"] = anomaly["anomaly_score"]
            if anomaly["is_anomaly"]:
                logger.info(f"[AI] ⚠️ Ticket #{ticket_id} détecté atypique (score={anomaly['anomaly_score']})")

        # Étape 1ter : clustering thématique (regroupement des tickets récurrents)
        cluster_id = predict_cluster(ticket.title, base_description)
        if cluster_id is not None:
            result["cluster_id"] = cluster_id

        # Étape 2 : Générer réponse auto si le modèle ML n'en a pas produit
        if not result.get("auto_reply"):
            reply_text = generate_auto_reply_groq(
                title=ticket.title,
                description=ticket.description_text or ticket.description,
                category=result.get("predicted_category"),
                priority=result.get("predicted_priority"),
            )
            result["auto_reply"] = reply_text

        # Étape 3 : Sauvegarde
        save_classification(db, ticket_id, result)
        save_auto_reply(db, ticket_id, result)

        # Étape 3 : Application au ticket
        apply_classification_to_ticket(
            db=db, ticket=ticket, result=result,
            ai_confidence_threshold=ai_confidence_threshold,
            ai_auto_assign=ai_auto_assign,
        )

        # Étape 4 : Auto-assignation
        if (
            ai_auto_assign
            and result.get("confidence", 0) >= ai_confidence_threshold
            and not ticket.assignee_manually_updated
            and ticket.assignee_user_id is None
        ):
            routing = suggest_agent(db, result.get("predicted_category"), ticket_id)
            if routing:
                agent = routing["agent"]
                ticket.assignee_user_id = agent.user_id
                ticket.assignee_name    = agent.full_name
                db.commit()
                logger.info(
                    f"[ROUTING] ✅ Ticket #{ticket_id} → {agent.full_name} "
                    f"(score={routing['score']:.1f}, "
                    f"expertise={routing['expertise']}, charge={routing['load']})"
                )

        logger.info(f"[AI] ✅ Ticket #{ticket_id} traité avec succès")

    except Exception as e:
        logger.error(f"[AI] ❌ Erreur traitement ticket #{ticket_id}: {e}")


# ── Classification avec fallback LLM si confiance insuffisante ───────────────
def classify_with_fallback(title: str, description: str | None, threshold: float = 0.75) -> dict:
    """
    Pipeline hybride :
    1. ML (rapide, offline) — si confiance >= threshold → résultat final
    2. LLM Groq (contexte) — si ML unavailable ou confiance < threshold
    Retourne aussi 'used_llm_fallback' pour traçabilité.
    """
    if not ML_AVAILABLE:
        result = classify_with_llm(title, description)
        result["used_llm_fallback"] = True
        return result

    ml_result = classify_with_ml(title, description)
    ml_conf   = ml_result.get("confidence", 0)

    if ml_conf >= threshold:
        ml_result["used_llm_fallback"] = False
        ml_result["ml_confidence"]     = ml_conf
        logger.info(f"[AI] ML suffisant (conf={ml_conf:.0%} >= {threshold:.0%}) — LLM ignoré")
        return ml_result

    # Confiance ML trop faible → on essaie le LLM
    logger.info(f"[AI] ML conf={ml_conf:.0%} < {threshold:.0%} — fallback LLM Groq")
    if not GROQ_API_KEY:
        logger.warning("[AI] GROQ_API_KEY absente — on garde le résultat ML malgré la faible confiance")
        ml_result["used_llm_fallback"] = False
        ml_result["ml_confidence"]     = ml_conf
        return ml_result

    llm_result = classify_with_llm(title, description)
    llm_conf   = llm_result.get("confidence", 0)

    # On garde le meilleur des deux — on attache toujours ml_confidence pour traçabilité
    if llm_conf >= ml_conf:
        llm_result["used_llm_fallback"] = True
        llm_result["ml_confidence"]     = ml_conf
        logger.info(f"[AI] LLM retenu (conf={llm_conf:.0%} > ML {ml_conf:.0%})")
        return llm_result
    else:
        ml_result["used_llm_fallback"] = False
        ml_result["ml_confidence"]     = ml_conf
        logger.info(f"[AI] ML retenu malgré tout (ML {ml_conf:.0%} > LLM {llm_conf:.0%})")
        return ml_result


# ── Rétro-compatibilité ───────────────────────────────────────────────────────
def classify_ticket(title: str, description: str | None) -> dict:
    """Alias — utilise ML si disponible, sinon LLM."""
    return classify_with_ml(title, description) if ML_AVAILABLE else classify_with_llm(title, description)
