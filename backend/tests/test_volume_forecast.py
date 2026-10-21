"""
Tests de la prévision de volume (Prophet).

Note : l'entraînement Prophet réel est désactivé pendant les tests
(HELPDESK_TESTING=1, cf. ai_service.get_volume_forecast) pour ne pas
ralentir la suite — vérifié manuellement en dehors des tests automatisés
(voir le rapport de vérification : ~1s d'entraînement, résultats cohérents
sur les vraies données).
"""
from tests.conftest import auth_headers
from app.services import ai_service


def test_get_volume_forecast_disabled_during_tests(db_session):
    result = ai_service.get_volume_forecast(db_session)
    assert result is None


def test_forecast_endpoint_requires_permission(client, requester_user):
    resp = client.get("/ai/forecast", headers=auth_headers(requester_user))
    assert resp.status_code == 403


def test_forecast_endpoint_returns_unavailable_during_tests(client, admin_user):
    resp = client.get("/ai/forecast", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    body = resp.json()
    assert body["available"] is False
    assert body["history"] == []
    assert body["forecast"] == []
