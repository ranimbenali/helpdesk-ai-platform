"""
Tests des routes tickets — création et RBAC.
"""
from tests.conftest import auth_headers


def _create_ticket(client, user, title="Problème imprimante", description="Ne répond plus au réseau"):
    return client.post(
        "/tickets/create",
        json={"title": title, "description": description},
        headers=auth_headers(user),
    )


def test_create_ticket_requires_auth(client):
    resp = client.post("/tickets/create", json={"title": "x", "description": "y"})
    assert resp.status_code == 401


def test_requester_can_create_ticket(client, requester_user):
    resp = _create_ticket(client, requester_user)
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Problème imprimante"
    assert body["status"] == "OPEN"


def test_requester_cannot_list_all_tickets(client, requester_user):
    resp = client.get("/tickets/", headers=auth_headers(requester_user))
    assert resp.status_code == 403


def test_agent_can_list_all_tickets(client, agent_user):
    resp = client.get("/tickets/", headers=auth_headers(agent_user))
    assert resp.status_code == 200


def test_requester_cannot_delete_ticket(client, requester_user):
    created = _create_ticket(client, requester_user)
    ticket_id = created.json()["ticket_id"]

    resp = client.delete(f"/tickets/{ticket_id}", headers=auth_headers(requester_user))
    assert resp.status_code == 403


def test_admin_can_delete_ticket(client, requester_user, admin_user):
    created = _create_ticket(client, requester_user)
    ticket_id = created.json()["ticket_id"]

    resp = client.delete(f"/tickets/{ticket_id}", headers=auth_headers(admin_user))
    assert resp.status_code == 200


def test_requester_cannot_assign_ticket(client, requester_user):
    created = _create_ticket(client, requester_user)
    ticket_id = created.json()["ticket_id"]

    resp = client.put(
        f"/tickets/{ticket_id}/assign",
        json={"assignee_user_id": requester_user.user_id},
        headers=auth_headers(requester_user),
    )
    assert resp.status_code == 403


def test_requester_cannot_update_priority(client, requester_user):
    created = _create_ticket(client, requester_user)
    ticket_id = created.json()["ticket_id"]

    resp = client.put(
        f"/tickets/{ticket_id}/priority",
        json={"priority_label": "Urgente"},
        headers=auth_headers(requester_user),
    )
    assert resp.status_code == 403
