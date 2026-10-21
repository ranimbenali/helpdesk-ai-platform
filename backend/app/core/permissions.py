"""
RBAC — Helpdesk IA GEISER
=========================
Module central de gestion des permissions.

Usage dans un router :
    from app.core.permissions import require_permission, Permission

    @router.get("/reports")
    def reports(current: User = Depends(require_permission(Permission.TICKETS_REPORTS))):
        ...
"""

from enum import Enum
from fastapi import Depends, HTTPException, status

from app.core.current_user import get_current_user
from app.models.user import User
from app.models.enums import UserRole, UserStatus


# ── Définition des permissions ────────────────────────────────────────────────

class Permission(str, Enum):
    # ── Tickets ──────────────────────────────────────────────────────────────
    TICKETS_READ_ALL        = "tickets:read_all"       # Admin · Supervisor · Agent
    TICKETS_READ_OWN        = "tickets:read_own"       # tous les rôles
    TICKETS_CREATE          = "tickets:create"         # tous les rôles
    TICKETS_UPDATE_STATUS   = "tickets:update_status"  # Admin · Supervisor · Agent
    TICKETS_UPDATE_PRIORITY = "tickets:update_priority"# Admin · Supervisor
    TICKETS_ASSIGN          = "tickets:assign"         # Admin · Supervisor
    TICKETS_DELETE          = "tickets:delete"         # Admin uniquement
    TICKETS_SYNC            = "tickets:sync"           # Admin · Supervisor
    TICKETS_STATS           = "tickets:stats"          # Admin · Supervisor
    TICKETS_REPORTS         = "tickets:reports"        # Admin · Supervisor

    # ── Utilisateurs ─────────────────────────────────────────────────────────
    USERS_READ              = "users:read"             # Admin · Supervisor
    USERS_MANAGE            = "users:manage"           # Admin uniquement

    # ── IA ───────────────────────────────────────────────────────────────────
    AI_READ                 = "ai:read"                # tous les rôles authentifiés
    AI_VALIDATE             = "ai:validate"            # Admin · Supervisor · Agent
    AI_CONFIG               = "ai:config"              # Admin uniquement
    AI_STATS                = "ai:stats"               # Admin · Supervisor

    # ── Système ──────────────────────────────────────────────────────────────
    SYSTEM_LOGS             = "system:logs"            # Admin uniquement
    SYSTEM_CONFIG           = "system:config"          # Admin uniquement
    SLA_READ                = "sla:read"               # Admin · Supervisor
    SLA_MANAGE              = "sla:manage"             # Admin uniquement


# ── Matrice rôle → permissions ────────────────────────────────────────────────

_ROLE_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {

    UserRole.REQUESTER: frozenset({
        Permission.TICKETS_READ_OWN,
        Permission.TICKETS_CREATE,
        Permission.AI_READ,
    }),

    UserRole.AGENT: frozenset({
        Permission.TICKETS_READ_ALL,
        Permission.TICKETS_READ_OWN,
        Permission.TICKETS_CREATE,
        Permission.TICKETS_UPDATE_STATUS,
        Permission.AI_READ,
        Permission.AI_VALIDATE,
    }),

    UserRole.SUPERVISOR: frozenset({
        Permission.TICKETS_READ_ALL,
        Permission.TICKETS_READ_OWN,
        Permission.TICKETS_CREATE,
        Permission.TICKETS_UPDATE_STATUS,
        Permission.TICKETS_UPDATE_PRIORITY,
        Permission.TICKETS_ASSIGN,
        Permission.TICKETS_SYNC,
        Permission.TICKETS_STATS,
        Permission.TICKETS_REPORTS,
        Permission.USERS_READ,
        Permission.AI_READ,
        Permission.AI_VALIDATE,
        Permission.AI_STATS,
        Permission.SLA_READ,
    }),

    UserRole.ADMIN: frozenset(Permission),  # toutes les permissions
}


# ── API publique ──────────────────────────────────────────────────────────────

def has_permission(user: User, permission: Permission) -> bool:
    """Retourne True si l'utilisateur actif possède la permission."""
    if user.status != UserStatus.ACTIVE:
        return False
    return permission in _ROLE_PERMISSIONS.get(user.role, frozenset())


def require_permission(permission: Permission):
    """
    Factory de dépendances FastAPI.
    Exemple : Depends(require_permission(Permission.TICKETS_REPORTS))
    """
    def _dependency(current: User = Depends(get_current_user)) -> User:
        if not has_permission(current, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé — permission requise : {permission.value}",
            )
        return current
    return _dependency


def require_any_permission(*permissions: Permission):
    """Vérifie que l'utilisateur possède AU MOINS UNE des permissions listées."""
    def _dependency(current: User = Depends(get_current_user)) -> User:
        if not any(has_permission(current, p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé — permissions insuffisantes",
            )
        return current
    return _dependency
