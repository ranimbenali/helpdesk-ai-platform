from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.models.user import User
from app.models.system_log import SystemLog
from app.models.enums import UserRole, UserStatus
from app.core.security import hash_password, verify_password
from app.core.current_user import get_current_user
from app.core.permissions import Permission, require_permission
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserList, UserCount
from app.services.notification_service import send_email_notification
import os, uuid, shutil, json


def _log(db: Session, event_type: str, category: str, actor_id, actor_name: str, detail: str, severity: str = "Info"):
    try:
        db.add(SystemLog(
            event_type=event_type, category=category,
            user_id=actor_id, user_name=actor_name,
            detail=detail, severity=severity,
        ))
        db.commit()
    except Exception:
        db.rollback()


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class MeUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None
    notify_reply: Optional[bool] = None
    notify_resolved: Optional[bool] = None
    notify_news: Optional[bool] = None
    notify_weekly: Optional[bool] = None
    notify_new_ticket: Optional[bool] = None
    notify_sla_risk: Optional[bool] = None
    notify_mention: Optional[bool] = None
    notify_daily_digest: Optional[bool] = None
    notify_sounds: Optional[bool] = None
    notify_sla_breach: Optional[bool] = None
    notify_ticket_closed: Optional[bool] = None
    notify_agent_idle: Optional[bool] = None
    notify_email_digest: Optional[bool] = None
    notify_inapp: Optional[bool] = None

router = APIRouter(prefix="/users", tags=["users"])

# ── Dossier uploads ──────────────────────────────────────────────────────────
UPLOAD_DIR = "static/avatars"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/", response_model=list[UserList])
def list_users(
    q: str = Query("", description="Search by full name or email"),
    skip: int = 0,
    limit: int = 50,
    current: User = Depends(require_permission(Permission.USERS_READ)),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if q:
        query = query.filter(
            or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%"))
        )
    return query.order_by(User.user_id.desc()).offset(skip).limit(limit).all()


@router.get("/count", response_model=UserCount)
def count_users(
    q: str = Query("", description="Search by full name or email"),
    current: User = Depends(require_permission(Permission.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if q:
        query = query.filter(
            or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%"))
        )
    return {"count": query.count()}


@router.get("/me/profile")
def get_my_profile(
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.ticket import Ticket
    from sqlalchemy import func

    assigned_total = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.assignee_user_id == current.user_id
    ).scalar() or 0

    assigned_resolved = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.assignee_user_id == current.user_id,
        Ticket.status.in_(["RESOLVED", "CLOSED"])
    ).scalar() or 0

    created_total = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.requester_name == current.full_name
    ).scalar() or 0

    created_resolved = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.requester_name == current.full_name,
        Ticket.status.in_(["RESOLVED", "CLOSED"])
    ).scalar() or 0

    global_total = db.query(func.count(Ticket.ticket_id)).scalar() or 0
    global_open  = db.query(func.count(Ticket.ticket_id)).filter(
        Ticket.status == "OPEN"
    ).scalar() or 0

    resolve_rate = round(
        (assigned_resolved / assigned_total * 100) if assigned_total > 0 else 0, 1
    )

    return {
        "user_id":    current.user_id,
        "full_name":  current.full_name,
        "email":      current.email,
        "role":       current.role.value,
        "status":     current.status.value,
        "created_at": current.created_at.isoformat() if current.created_at else None,
        "avatar_url": current.avatar_url,  # ✅ AJOUT
        "phone": current.phone,
        "preferred_language": current.preferred_language,
        "notify_reply": current.notify_reply,
        "notify_resolved": current.notify_resolved,
        "notify_news": current.notify_news,
        "notify_weekly": current.notify_weekly,
        "notify_new_ticket": current.notify_new_ticket,
        "notify_sla_risk": current.notify_sla_risk,
        "notify_mention": current.notify_mention,
        "notify_daily_digest": current.notify_daily_digest,
        "notify_sounds": current.notify_sounds,
        "notify_sla_breach": current.notify_sla_breach,
        "notify_ticket_closed": current.notify_ticket_closed,
        "notify_agent_idle": current.notify_agent_idle,
        "notify_email_digest": current.notify_email_digest,
        "notify_inapp": current.notify_inapp,
        "stats": {
            "assigned_total":    assigned_total,
            "assigned_resolved": assigned_resolved,
            "resolve_rate":      resolve_rate,
            "created_total":     created_total,
            "created_resolved":  created_resolved,
            "global_total":      global_total,
            "global_open":       global_open,
        },
    }


@router.patch("/me")
def update_my_profile(
    body: MeUpdateRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data and not data["full_name"].strip():
        raise HTTPException(status_code=400, detail="Le nom complet ne peut pas être vide")
    for field, value in data.items():
        setattr(current, field, value)
    db.commit()
    db.refresh(current)
    return {
        "user_id": current.user_id,
        "full_name": current.full_name,
        "email": current.email,
        "avatar_url": current.avatar_url,
        "phone": current.phone,
        "preferred_language": current.preferred_language,
        "notify_reply": current.notify_reply,
        "notify_resolved": current.notify_resolved,
        "notify_news": current.notify_news,
        "notify_weekly": current.notify_weekly,
        "notify_new_ticket": current.notify_new_ticket,
        "notify_sla_risk": current.notify_sla_risk,
        "notify_mention": current.notify_mention,
        "notify_daily_digest": current.notify_daily_digest,
        "notify_sounds": current.notify_sounds,
        "notify_sla_breach": current.notify_sla_breach,
        "notify_ticket_closed": current.notify_ticket_closed,
        "notify_agent_idle": current.notify_agent_idle,
        "notify_email_digest": current.notify_email_digest,
        "notify_inapp": current.notify_inapp,
    }


@router.post("/me/change-password")
def change_my_password(
    body: ChangePasswordRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères")
    current.password_hash = hash_password(body.new_password)
    db.commit()
    _log(db, "user.password_changed", "Sécurité", current.user_id, current.full_name,
         f"Mot de passe modifié par l'utilisateur lui-même ({current.email})", "Avertis.")
    return {"message": "Mot de passe modifié avec succès"}


# ✅ NOUVEAU : Upload avatar
@router.post("/{user_id}/avatar")
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Seul l'utilisateur lui-même ou un admin peut changer l'avatar
    if current.user_id != user_id and current.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Vérifier le type de fichier
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Format non supporté. Utilisez JPG, PNG, WEBP ou GIF."
        )

    # Vérifier la taille (max 2 Mo)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (max 2 Mo)")

    # Supprimer l'ancien avatar si existant
    if user.avatar_url:
        old_path = user.avatar_url.replace("/static/avatars/", "static/avatars/")
        if os.path.exists(old_path):
            os.remove(old_path)

    # Sauvegarder le nouveau fichier
    ext = file.filename.rsplit(".", 1)[-1].lower()
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(contents)

    # Mettre à jour la BDD
    user.avatar_url = f"/static/avatars/{filename}"
    db.commit()
    db.refresh(user)

    return {"avatar_url": user.avatar_url}


# ✅ NOUVEAU : Supprimer avatar (retour à l'initiale)
@router.delete("/{user_id}/avatar")
def delete_avatar(
    user_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current.user_id != user_id and current.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.avatar_url:
        old_path = user.avatar_url.replace("/static/avatars/", "static/avatars/")
        if os.path.exists(old_path):
            os.remove(old_path)
        user.avatar_url = None
        db.commit()

    return {"message": "Avatar supprimé"}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current: User = Depends(require_permission(Permission.USERS_READ)),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    current: User = Depends(require_permission(Permission.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        role_enum   = UserRole(user_data.role)
        status_enum = UserStatus(user_data.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role or status")

    new_user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=role_enum,
        status=status_enum,
        fonction=user_data.fonction,
        specialites=json.dumps(user_data.specialites, ensure_ascii=False) if user_data.specialites else None,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    _log(db, "user.created", "Permissions", current.user_id, current.full_name,
         f"Compte créé : {new_user.full_name} ({new_user.email}) — rôle {new_user.role.value}", "Info")

    try:
        send_email_notification(
            to_email=new_user.email,
            subject="[Helpdesk Geiser] Votre compte a été créé",
            body=f"""
            Bonjour {new_user.full_name},<br><br>
            Votre compte sur <strong>Helpdesk Geiser</strong> a été créé avec succès.<br><br>
            Voici vos informations de connexion :<br>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <strong>Email :</strong> {new_user.email}<br>
                <strong>Rôle :</strong> {new_user.role.value}<br>
            </div>
            ⚠️ <strong>Pour votre sécurité</strong>, nous vous recommandons de changer 
            votre mot de passe dès votre première connexion via :<br>
            <strong>Paramètres → Mot de passe</strong><br><br>
            <a href="http://localhost:5173/login" style="
                background: #0a46d6; color: #fff;
                padding: 12px 24px; border-radius: 8px;
                text-decoration: none; font-weight: bold;
            ">Se connecter</a><br><br>
            Cordialement,<br>L'équipe Helpdesk Geiser
            """,
        )
    except Exception as e:
        print(f"[EMAIL CREATE ACCOUNT ERROR] {e}")

    return new_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    current: User = Depends(require_permission(Permission.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.email and user_data.email != user.email:
        existing = db.query(User).filter(
            User.email == user_data.email, User.user_id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = user_data.email

    if user_data.full_name is not None: user.full_name = user_data.full_name
    if user_data.password:
        user.password_hash = hash_password(user_data.password)
        _log(db, "user.password_changed", "Sécurité", current.user_id, current.full_name,
             f"Mot de passe réinitialisé par l'admin pour : {user.full_name} ({user.email})", "Avertis.")
    if user_data.fonction is not None:  user.fonction = user_data.fonction
    if user_data.specialites is not None:
        user.specialites = json.dumps(user_data.specialites, ensure_ascii=False)
    if user_data.role:
        try:
            old_role = user.role.value
            user.role = UserRole(user_data.role)
            if old_role != user_data.role:
                _log(db, "user.role_changed", "Permissions", current.user_id, current.full_name,
                     f"Rôle modifié : {user.full_name} ({user.email}) — {old_role} → {user_data.role}", "Avertis.")
        except: raise HTTPException(status_code=400, detail="Invalid role")
    if user_data.status:
        try:
            old_status = user.status.value
            user.status = UserStatus(user_data.status)
            if old_status != user_data.status:
                _log(db, "user.status_changed", "Permissions", current.user_id, current.full_name,
                     f"Statut modifié : {user.full_name} ({user.email}) — {old_status} → {user_data.status}", "Avertis.")
        except: raise HTTPException(status_code=400, detail="Invalid status")

    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def patch_user(
    user_id: int,
    user_data: UserUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_data.email is not None and user_data.email != user.email:
        existing = db.query(User).filter(
            User.email == user_data.email, User.user_id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = user_data.email

    if user_data.full_name  is not None: user.full_name  = user_data.full_name
    if user_data.fonction   is not None: user.fonction   = user_data.fonction
    if user_data.specialites is not None:
        user.specialites = json.dumps(user_data.specialites, ensure_ascii=False)
    if user_data.password is not None and user_data.password.strip():
        user.password_hash = hash_password(user_data.password)
        _log(db, "user.password_changed", "Sécurité", current.user_id, current.full_name,
             f"Mot de passe réinitialisé par l'admin pour : {user.full_name} ({user.email})", "Avertis.")
    # Seul l'admin peut changer le rôle ou le statut d'un utilisateur
    if user_data.role is not None:
        if current.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Seul l'admin peut modifier le rôle")
        try:
            old_role = user.role.value
            user.role = UserRole(user_data.role)
            if old_role != user_data.role:
                _log(db, "user.role_changed", "Permissions", current.user_id, current.full_name,
                     f"Rôle modifié : {user.full_name} ({user.email}) — {old_role} → {user_data.role}", "Avertis.")
        except: raise HTTPException(status_code=400, detail="Invalid role")
    if user_data.status is not None:
        if current.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Seul l'admin peut modifier le statut")
        try:
            old_status = user.status.value
            user.status = UserStatus(user_data.status)
            if old_status != user_data.status:
                _log(db, "user.status_changed", "Permissions", current.user_id, current.full_name,
                     f"Statut modifié : {user.full_name} ({user.email}) — {old_status} → {user_data.status}", "Avertis.")
        except: raise HTTPException(status_code=400, detail="Invalid status")

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    current: User = Depends(require_permission(Permission.USERS_MANAGE)),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_id == current.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    deleted_name = user.full_name
    deleted_email = user.email
    deleted_role = user.role.value
    db.delete(user)
    db.commit()

    _log(db, "user.deleted", "Permissions", current.user_id, current.full_name,
         f"Compte supprimé : {deleted_name} ({deleted_email}) — rôle {deleted_role}", "Avertis.")

    return {"message": "User deleted successfully"}