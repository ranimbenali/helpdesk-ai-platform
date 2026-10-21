"""
Tests d'authentification — /auth/login, /auth/me, JWT.
"""
from tests.conftest import auth_headers


def test_login_success(client, requester_user):
    resp = client.post(
        "/auth/login",
        data={"username": requester_user.email, "password": "Test1234!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, requester_user):
    resp = client.post(
        "/auth/login",
        data={"username": requester_user.email, "password": "MauvaisMotDePasse"},
    )
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post(
        "/auth/login",
        data={"username": "inconnu@geiser.tn", "password": "peu importe"},
    )
    assert resp.status_code == 401


def test_me_requires_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, requester_user):
    resp = client.get("/auth/me", headers=auth_headers(requester_user))
    assert resp.status_code == 200
    assert resp.json()["email"] == requester_user.email


def test_me_rejects_invalid_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer token-invalide"})
    assert resp.status_code == 401


def test_archived_account_rejected_even_with_valid_token(client, db_session, requester_user):
    from app.models.enums import UserStatus

    requester_user.status = UserStatus.ARCHIVED
    db_session.commit()

    resp = client.get("/auth/me", headers=auth_headers(requester_user))
    assert resp.status_code == 403
