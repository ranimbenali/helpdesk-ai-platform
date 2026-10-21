"""
Réentraînement planifié — Helpdesk IA Geiser
=============================================

Combine le dataset original (data/dataset_labeled.csv) avec les tickets
validés/corrigés par les agents depuis le déploiement, ré-entraîne les
5 modèles ML pour les 3 cibles (catégorie, sous-catégorie, priorité),
et enregistre chaque résultat dans MLflow (tracking + nouvelle version
du registre de modèles).

IMPORTANT — ce script NE remplace JAMAIS automatiquement les modèles de
production (backend/app/ai_service/models/*.pkl). Il sauvegarde les
nouveaux modèles dans un dossier "candidat" séparé, à comparer dans
MLflow puis à valider manuellement. C'est cohérent avec le choix
d'architecture du projet : aucun réentraînement ne se déclenche depuis
la plateforme elle-même.

Lancement manuel (depuis la racine du projet, venv backend activé) :
    backend\\.venv\\Scripts\\python.exe scripts\\retrain_scheduled.py

Lancement planifié : voir scripts/README_retrain.md
"""
import pickle
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import mlflow
import mlflow.sklearn

from sklearn.base import clone
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.naive_bayes import MultinomialNB
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.db.session import SessionLocal          # noqa: E402
from app.models.ticket import Ticket              # noqa: E402
from app.models.ai_classification import AIClassification, AIValidationStatus  # noqa: E402

DATASET_PATH  = ROOT / "data" / "dataset_labeled.csv"
MLFLOW_DB     = ROOT / "backend" / "notebooks" / "mlflow.db"
CANDIDATE_DIR = ROOT / "backend" / "app" / "ai_service" / "models_candidate" / datetime.now().strftime("%Y%m%d_%H%M%S")

TFIDF_PARAMS = dict(max_features=5000, ngram_range=(1, 2), min_df=2, sublinear_tf=True)

MODELS = {
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42, C=1.0),
    "LinearSVC":            LinearSVC(random_state=42, max_iter=2000),
    "Random Forest":        RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
    "Naive Bayes":          MultinomialNB(alpha=0.1),
    "XGBoost":              XGBClassifier(
        n_estimators=200, max_depth=6, learning_rate=0.1,
        random_state=42, eval_metric="mlogloss", n_jobs=-1
    ),
}

TARGETS = [
    ("categorie",      "helpdesk-categorie",      "model_categorie.pkl",      "label_encoder_cat.pkl"),
    ("sous_categorie", "helpdesk-sous_categorie", "model_sous_categorie.pkl", "label_encoder_sous.pkl"),
    ("priorite",       "helpdesk-priorite",       "model_priorite.pkl",       "label_encoder_prio.pkl"),
]


def clean_text(text) -> str:
    if text is None or (isinstance(text, float)):
        return ""
    text = str(text).lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&\w+;", " ", text)
    text = re.sub(r"http\S+", " ", text)
    text = re.sub(r"\b\d+\b", " ", text)
    text = re.sub(r"[^a-zà-ÿ\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_training_data() -> pd.DataFrame:
    """Dataset original + tickets validés/corrigés par les agents depuis le déploiement."""
    df_original = pd.read_csv(DATASET_PATH, encoding="utf-8")
    df_original = df_original[["objet", "description", "categorie", "sous_categorie", "priorite"]]

    db = SessionLocal()
    try:
        rows = (
            db.query(Ticket, AIClassification)
            .join(AIClassification, AIClassification.ticket_id == Ticket.ticket_id)
            .filter(AIClassification.validation_status.in_(
                [AIValidationStatus.VALIDATED, AIValidationStatus.CORRECTED]
            ))
            .filter(Ticket.category.isnot(None), Ticket.priority_label.isnot(None))
            .all()
        )
    finally:
        db.close()

    nouveaux = [{
        "objet":          t.title or "",
        "description":    t.description_text or t.description or "",
        "categorie":      t.category,
        "sous_categorie": t.subcategory or "Non classifiable",
        "priorite":       t.priority_label,
    } for t, _c in rows]

    df_nouveaux = pd.DataFrame(nouveaux, columns=["objet", "description", "categorie", "sous_categorie", "priorite"])

    print(f"Dataset original      : {len(df_original)} tickets")
    print(f"Tickets validés en DB : {len(df_nouveaux)} tickets nouveaux")

    df = pd.concat([df_original, df_nouveaux], ignore_index=True)
    df["text"] = df["objet"].fillna("") + " " + df["description"].fillna("")
    df["text_clean"] = df["text"].apply(clean_text)
    df = df[df["text_clean"].str.len() > 5].reset_index(drop=True)
    return df


def train_target(df: pd.DataFrame, target_col: str, min_class_count: int = 2):
    counts  = df[target_col].value_counts()
    valides = counts[counts >= min_class_count].index
    d = df[df[target_col].isin(valides)].copy()

    le = LabelEncoder()
    y  = le.fit_transform(d[target_col])
    X  = d["text_clean"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    results = {}
    for name, model in MODELS.items():
        with mlflow.start_run(run_name=f"retrain-{target_col}-{name}"):
            pipeline = Pipeline([
                ("tfidf", TfidfVectorizer(**TFIDF_PARAMS)),
                ("clf", clone(model)),
            ])
            pipeline.fit(X_train, y_train)
            y_pred = pipeline.predict(X_test)
            acc = accuracy_score(y_test, y_pred)
            f1  = f1_score(y_test, y_pred, average="weighted")

            mlflow.set_tag("cible", target_col)
            mlflow.set_tag("source", "retrain_scheduled")
            mlflow.log_param("modele", name)
            mlflow.log_params(TFIDF_PARAMS)
            mlflow.log_metric("accuracy", acc)
            mlflow.log_metric("f1_score", f1)

            results[name] = {"pipeline": pipeline, "accuracy": acc, "f1_score": f1}
            print(f"  {name:<22} accuracy={acc:.4f}  f1={f1:.4f}")

    best_name = max(results, key=lambda n: results[n]["f1_score"])
    return best_name, results[best_name], le


def main():
    print("=" * 70)
    print(f"RÉENTRAÎNEMENT PLANIFIÉ — {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)

    mlflow.set_tracking_uri(f"sqlite:///{MLFLOW_DB.as_posix()}")
    mlflow.set_experiment("helpdesk-ia-classification")

    df = load_training_data()
    CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)

    summary = []
    for target_col, registry_name, model_file, encoder_file in TARGETS:
        print(f"\n--- Cible : {target_col} ---")
        best_name, best_result, le = train_target(df, target_col)
        print(f"  Meilleur : {best_name} (accuracy={best_result['accuracy']:.4f}, f1={best_result['f1_score']:.4f})")

        with open(CANDIDATE_DIR / model_file, "wb") as f:
            pickle.dump(best_result["pipeline"], f)
        with open(CANDIDATE_DIR / encoder_file, "wb") as f:
            pickle.dump(le, f)

        with mlflow.start_run(run_name=f"retrain-registry-{registry_name}"):
            mlflow.set_tag("source", "retrain_scheduled")
            mlflow.set_tag("algorithme", best_name)
            mlflow.log_metric("accuracy", best_result["accuracy"])
            mlflow.log_metric("f1_score", best_result["f1_score"])
            mlflow.sklearn.log_model(
                sk_model=best_result["pipeline"],
                name="model",
                registered_model_name=registry_name,
                serialization_format="pickle",
            )

        summary.append((target_col, best_name, best_result["accuracy"], best_result["f1_score"]))

    print("\n" + "=" * 70)
    print("RÉSUMÉ")
    print("=" * 70)
    for target_col, name, acc, f1 in summary:
        print(f"  {target_col:<16} {name:<22} accuracy={acc:.4f}  f1={f1:.4f}")
    print(f"\nModèles candidats sauvegardés dans : {CANDIDATE_DIR}")
    print("Rien n'a été déployé automatiquement. Comparez avec les modèles actuels")
    print("dans MLflow (http://127.0.0.1:5000) avant de copier manuellement vers")
    print("backend/app/ai_service/models/ si le nouveau modèle est meilleur.")


if __name__ == "__main__":
    main()
