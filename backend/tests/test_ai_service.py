"""
Tests du module IA — classification ML, seuil de confiance, fallback LLM.

Les tests sur classify_with_ml() utilisent les vrais modèles .pkl (rapides,
CPU, pas de dépendance réseau). Les tests sur classify_with_fallback()
simulent classify_with_ml/classify_with_llm pour tester la logique de
décision du seuil sans dépendre de l'API Groq.
"""
import pytest

from app.services import ai_service

VALID_PRIORITIES = {"P1_URGENT", "P2_HIGH", "P3_NORMAL", "P4_LOW"}


def test_ml_models_are_loaded():
    assert ai_service.ML_AVAILABLE is True


def test_classify_with_ml_returns_valid_structure():
    result = ai_service.classify_with_ml(
        "Problème réseau wifi bureau",
        "Internet ne fonctionne plus depuis ce matin",
    )
    assert result["predicted_category"]
    assert result["predicted_subcategory"]
    assert result["predicted_priority"] in VALID_PRIORITIES
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["model_version"]


def test_classify_with_ml_handles_empty_description():
    result = ai_service.classify_with_ml("Mot de passe oublié", None)
    assert result["predicted_category"]
    assert result["predicted_priority"] in VALID_PRIORITIES


# ── classify_with_fallback : logique du seuil de confiance ────────────────────

def _fake_ml_result(confidence: float, category: str = "Réseau", priority: str = "P3_NORMAL"):
    return {
        "predicted_category": category,
        "predicted_subcategory": "Lenteur réseau",
        "predicted_priority": priority,
        "confidence": confidence,
        "keywords": "[]",
        "auto_reply": "",
        "model_version": "ML-TF-IDF-v3-mixed",
    }


def _fake_llm_result(confidence: float, category: str = "Logiciel", priority: str = "P1_URGENT"):
    return {
        "predicted_category": category,
        "predicted_subcategory": "Bug logiciel",
        "predicted_priority": priority,
        "confidence": confidence,
        "keywords": "[]",
        "auto_reply": "",
        "model_version": "LLM-Groq-fallback",
    }


def test_fallback_skips_llm_when_ml_confidence_high(monkeypatch):
    monkeypatch.setattr(ai_service, "classify_with_ml", lambda t, d: _fake_ml_result(0.90))

    def _fail_if_called(*a, **kw):
        raise AssertionError("classify_with_llm ne doit pas être appelé quand la confiance ML suffit")

    monkeypatch.setattr(ai_service, "classify_with_llm", _fail_if_called)

    result = ai_service.classify_with_fallback("titre", "description", threshold=0.75)
    assert result["used_llm_fallback"] is False
    assert result["predicted_category"] == "Réseau"


def test_fallback_calls_llm_when_ml_confidence_low(monkeypatch):
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(ai_service, "classify_with_ml", lambda t, d: _fake_ml_result(0.30))
    monkeypatch.setattr(ai_service, "classify_with_llm", lambda t, d: _fake_llm_result(0.90))

    result = ai_service.classify_with_fallback("titre", "description", threshold=0.75)
    assert result["used_llm_fallback"] is True
    assert result["predicted_category"] == "Logiciel"  # résultat LLM
    assert result["ml_confidence"] == 0.30


def test_fallback_keeps_ml_if_it_scores_higher_than_llm(monkeypatch):
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "fake-key-for-test")
    monkeypatch.setattr(ai_service, "classify_with_ml", lambda t, d: _fake_ml_result(0.60))
    monkeypatch.setattr(ai_service, "classify_with_llm", lambda t, d: _fake_llm_result(0.20))

    result = ai_service.classify_with_fallback("titre", "description", threshold=0.75)
    # ML (0.60) > LLM (0.20) → on garde le ML malgré la confiance sous le seuil
    assert result["used_llm_fallback"] is False
    assert result["predicted_category"] == "Réseau"  # résultat ML


def test_fallback_keeps_ml_when_groq_key_missing(monkeypatch):
    monkeypatch.setattr(ai_service, "GROQ_API_KEY", "")
    monkeypatch.setattr(ai_service, "classify_with_ml", lambda t, d: _fake_ml_result(0.30))

    def _fail_if_called(*a, **kw):
        raise AssertionError("classify_with_llm ne doit pas être appelé sans clé Groq")

    monkeypatch.setattr(ai_service, "classify_with_llm", _fail_if_called)

    result = ai_service.classify_with_fallback("titre", "description", threshold=0.75)
    assert result["used_llm_fallback"] is False
    assert result["predicted_category"] == "Réseau"


@pytest.mark.parametrize("threshold", [0.5, 0.75, 0.9])
def test_fallback_threshold_is_respected(monkeypatch, threshold):
    monkeypatch.setattr(ai_service, "classify_with_ml", lambda t, d: _fake_ml_result(threshold + 0.01))

    def _fail_if_called(*a, **kw):
        raise AssertionError("confiance au-dessus du seuil, le LLM ne doit pas être sollicité")

    monkeypatch.setattr(ai_service, "classify_with_llm", _fail_if_called)

    result = ai_service.classify_with_fallback("titre", "description", threshold=threshold)
    assert result["used_llm_fallback"] is False


# ── suggest_agent : scoring + repli routing_rules ────────────────────────────

def test_suggest_agent_uses_score_when_expertise_exists(db_session, agent_user, supervisor_user):
    """Si un agent a déjà de l'expertise dans la catégorie, le scoring décide — pas de repli."""
    from datetime import datetime, timezone
    from app.models.ticket import Ticket

    db_session.add(Ticket(
        title="Ancien ticket réseau", description="x", category="Réseau",
        status="RESOLVED", assignee_user_id=agent_user.user_id, assignee_name=agent_user.full_name,
        created_at=datetime.now(timezone.utc),
    ))
    db_session.commit()

    result = ai_service.suggest_agent(db_session, category="Réseau")
    assert result is not None
    assert result["strategie"] == "score"
    assert result["agent"].user_id == agent_user.user_id


def test_suggest_agent_falls_back_to_routing_rules_when_no_expertise(monkeypatch, db_session, agent_user, supervisor_user):
    """Si aucun agent actif n'a d'historique dans la catégorie, on utilise routing_rules.pkl."""
    monkeypatch.setattr(ai_service, "_routing_rules", {"Réseau": supervisor_user.full_name})

    result = ai_service.suggest_agent(db_session, category="Réseau")
    assert result is not None
    assert result["strategie"] == "regle_categorie"
    assert result["agent"].user_id == supervisor_user.user_id


def test_suggest_agent_ignores_routing_rules_for_unmatched_agent_name(monkeypatch, db_session, agent_user, supervisor_user):
    """Si le nom dans routing_rules ne correspond à aucun agent actif, on garde le scoring normal."""
    monkeypatch.setattr(ai_service, "_routing_rules", {"Réseau": "Personne Inexistante"})

    result = ai_service.suggest_agent(db_session, category="Réseau")
    assert result is not None
    assert result["strategie"] == "score"
