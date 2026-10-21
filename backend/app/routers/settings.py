from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.current_user import get_current_user
from app.core.permissions import Permission, require_permission
from app.models.user import User
from app.models.app_config import AppConfig
from app.schemas.app_config import AppConfigResponse, AppConfigUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def get_or_create_config(db: Session) -> AppConfig:
    config = db.query(AppConfig).first()
    if not config:
        config = AppConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/", response_model=AppConfigResponse)
def get_settings(
    current: User = Depends(require_permission(Permission.SYSTEM_CONFIG)),
    db: Session = Depends(get_db),
):
    return get_or_create_config(db)


@router.get("/routing-info")
def get_routing_info(
    current: User = Depends(require_permission(Permission.TICKETS_ASSIGN)),
    db: Session = Depends(get_db),
):
    """Vue en lecture seule des réglages de routage globaux, pour les superviseurs
    (les réglages complets restent réservés à l'admin via SYSTEM_CONFIG)."""
    config = get_or_create_config(db)
    return {
        "method": "IA",
        "ai_auto_assign": config.ai_auto_assign,
    }


@router.put("/", response_model=AppConfigResponse)
def update_settings(
    payload: AppConfigUpdate,
    current: User = Depends(require_permission(Permission.SYSTEM_CONFIG)),
    db: Session = Depends(get_db),
):
    config = get_or_create_config(db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)
    return config