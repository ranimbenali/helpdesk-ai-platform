"""
Tests RBAC — vérifie la matrice rôle → permission de app.core.permissions.

Tests unitaires purs : pas de DB, pas de client HTTP. has_permission() ne
regarde que .role et .status, donc un objet minimal suffit.
"""
from types import SimpleNamespace

import pytest

from app.core.permissions import Permission, has_permission
from app.models.enums import UserRole, UserStatus


def _user(role: UserRole, status: UserStatus = UserStatus.ACTIVE):
    return SimpleNamespace(role=role, status=status)


# ── Un compte désactivé ne doit jamais avoir de permission, quel que soit le rôle
@pytest.mark.parametrize("role", list(UserRole))
def test_archived_user_has_no_permission(role):
    user = _user(role, status=UserStatus.ARCHIVED)
    for permission in Permission:
        assert has_permission(user, permission) is False


# ── Admin a bien TOUTES les permissions
@pytest.mark.parametrize("permission", list(Permission))
def test_admin_has_all_permissions(permission):
    admin = _user(UserRole.ADMIN)
    assert has_permission(admin, permission) is True


# ── Demandeur : périmètre volontairement restreint
def test_requester_can_create_and_read_own_tickets():
    requester = _user(UserRole.REQUESTER)
    assert has_permission(requester, Permission.TICKETS_CREATE) is True
    assert has_permission(requester, Permission.TICKETS_READ_OWN) is True


@pytest.mark.parametrize(
    "forbidden_permission",
    [
        Permission.TICKETS_READ_ALL,
        Permission.TICKETS_DELETE,
        Permission.TICKETS_ASSIGN,
        Permission.USERS_MANAGE,
        Permission.SYSTEM_LOGS,
        Permission.AI_CONFIG,
    ],
)
def test_requester_cannot_access_privileged_actions(forbidden_permission):
    requester = _user(UserRole.REQUESTER)
    assert has_permission(requester, forbidden_permission) is False


# ── Agent : peut traiter des tickets mais pas les supprimer ni gérer les utilisateurs
def test_agent_can_update_status_but_not_delete():
    agent = _user(UserRole.AGENT)
    assert has_permission(agent, Permission.TICKETS_UPDATE_STATUS) is True
    assert has_permission(agent, Permission.TICKETS_DELETE) is False
    assert has_permission(agent, Permission.USERS_MANAGE) is False


# ── Seul Admin a le droit de suppression de ticket
@pytest.mark.parametrize("role", [UserRole.REQUESTER, UserRole.AGENT, UserRole.SUPERVISOR])
def test_only_admin_can_delete_tickets(role):
    user = _user(role)
    assert has_permission(user, Permission.TICKETS_DELETE) is False


def test_admin_can_delete_tickets():
    assert has_permission(_user(UserRole.ADMIN), Permission.TICKETS_DELETE) is True


# ── Superviseur : peut assigner et voir les rapports, mais pas gérer les utilisateurs ni la config système
def test_supervisor_scope():
    supervisor = _user(UserRole.SUPERVISOR)
    assert has_permission(supervisor, Permission.TICKETS_ASSIGN) is True
    assert has_permission(supervisor, Permission.TICKETS_REPORTS) is True
    assert has_permission(supervisor, Permission.USERS_MANAGE) is False
    assert has_permission(supervisor, Permission.SYSTEM_CONFIG) is False
