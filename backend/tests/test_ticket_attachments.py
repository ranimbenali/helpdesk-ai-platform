"""
Tests des pièces jointes de tickets — upload, liste, téléchargement, RBAC.
"""
import io

from tests.conftest import auth_headers


def _create_ticket(client, user, title="Problème imprimante", description="Ne répond plus au réseau"):
    resp = client.post(
        "/tickets/create",
        json={"title": title, "description": description},
        headers=auth_headers(user),
    )
    assert resp.status_code == 201
    return resp.json()["ticket_id"]


def _png_file(name="capture.png"):
    # 1x1 PNG minimal valide
    content = bytes.fromhex(
        "89504e470d0a1a0a0000000d494844520000000100000001080600000"
        "01f15c4890000000a4944415478da6360000002000155037de50000000049454e44ae426082"
    )
    return (name, io.BytesIO(content), "image/png")


def test_upload_attachment_requires_auth(client):
    ticket_id = 1
    resp = client.post(f"/tickets/{ticket_id}/attachments", files={"file": _png_file()})
    assert resp.status_code == 401


def test_requester_can_upload_and_list_own_attachment(client, requester_user):
    ticket_id = _create_ticket(client, requester_user)

    resp = client.post(
        f"/tickets/{ticket_id}/attachments",
        files={"file": _png_file()},
        headers=auth_headers(requester_user),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["original_name"] == "capture.png"
    assert body["content_type"] == "image/png"

    resp = client.get(f"/tickets/{ticket_id}/attachments", headers=auth_headers(requester_user))
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["original_name"] == "capture.png"


def test_upload_rejects_unsupported_type(client, requester_user):
    ticket_id = _create_ticket(client, requester_user)
    resp = client.post(
        f"/tickets/{ticket_id}/attachments",
        files={"file": ("script.exe", io.BytesIO(b"MZ..."), "application/x-msdownload")},
        headers=auth_headers(requester_user),
    )
    assert resp.status_code == 400


def test_upload_rejects_oversized_file(client, requester_user):
    ticket_id = _create_ticket(client, requester_user)
    big_content = b"0" * (25 * 1024 * 1024 + 1)
    resp = client.post(
        f"/tickets/{ticket_id}/attachments",
        files={"file": ("gros.png", io.BytesIO(big_content), "image/png")},
        headers=auth_headers(requester_user),
    )
    assert resp.status_code == 400


def test_other_requester_cannot_access_attachments(client, requester_user, db_session):
    from app.core.security import hash_password
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User

    other = User(
        full_name="Autre Demandeur", email="autre@test.geiser.tn",
        password_hash=hash_password("Test1234!"), role=UserRole.REQUESTER, status=UserStatus.ACTIVE,
    )
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    ticket_id = _create_ticket(client, requester_user)
    client.post(f"/tickets/{ticket_id}/attachments", files={"file": _png_file()}, headers=auth_headers(requester_user))

    resp = client.get(f"/tickets/{ticket_id}/attachments", headers=auth_headers(other))
    assert resp.status_code == 403


def test_agent_can_access_only_when_assigned(client, requester_user, agent_user):
    ticket_id = _create_ticket(client, requester_user)

    resp = client.get(f"/tickets/{ticket_id}/attachments", headers=auth_headers(agent_user))
    assert resp.status_code == 403


def test_admin_can_download_attachment(client, requester_user, admin_user):
    ticket_id = _create_ticket(client, requester_user)
    upload_resp = client.post(
        f"/tickets/{ticket_id}/attachments",
        files={"file": _png_file()},
        headers=auth_headers(requester_user),
    )
    attachment_id = upload_resp.json()["attachment_id"]

    resp = client.get(
        f"/tickets/{ticket_id}/attachments/{attachment_id}/download",
        headers=auth_headers(admin_user),
    )
    assert resp.status_code == 200
    assert resp.content.startswith(b"\x89PNG")
