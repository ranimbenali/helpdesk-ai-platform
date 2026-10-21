from fastapi import APIRouter, Depends, HTTPException, Request, status, Form
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, create_access_token
from fastapi.security import OAuth2PasswordRequestForm
from app.models.user import User
from app.models.system_log import SystemLog
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse
from app.core.current_user import get_current_user
import secrets
import random
from datetime import datetime, timedelta, timezone
from app.services.notification_service import send_email_notification, send_email_sync


def _log(db: Session, event_type: str, category: str, user_id, user_name: str, detail: str, severity: str = "Info", ip: str = None):
    try:
        db.add(SystemLog(
            event_type=event_type, category=category,
            user_id=user_id, user_name=user_name,
            detail=detail, severity=severity, ip_address=ip,
        ))
        db.commit()
    except Exception:
        db.rollback()


router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        _log(db, "login.failed", "Authentification",
             user.user_id if user else None,
             user.full_name if user else form.username,
             f"Mot de passe incorrect — {form.username}", "Avertis.", ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _log(db, "login.success", "Authentification",
         user.user_id, user.full_name,
         f"Connexion depuis {ip or 'IP inconnue'}", "Info", ip)

    # "Se souvenir de moi" prolonge réellement la session (30 jours), pas juste
    # l'emplacement de stockage côté navigateur — sinon le token expire quand
    # même après la durée par défaut (8h) malgré la case cochée.
    expires_minutes = 60 * 24 * 30 if remember_me else None
    token = create_access_token(str(user.user_id), expires_minutes=expires_minutes)
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user

# ── Route 1 : Demander un OTP ──
@router.post("/request-otp")
def request_otp(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # On retourne quand même OK pour ne pas divulguer si l'email existe
        return {"message": "Si cet email existe, un code a été envoyé."}

    # Générer code 6 chiffres
    code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    user.otp_code = code
    user.otp_expires_at = expires_at
    db.commit()

    # ── Debug console (visible dans le terminal uvicorn) ──────────────────────
    print(f"\n{'='*50}")
    print(f"[OTP DEBUG] Email : {user.email}")
    print(f"[OTP DEBUG] Code  : {code}")
    print(f"[OTP DEBUG] Expire: {expires_at.strftime('%H:%M:%S')}")
    print(f"{'='*50}\n")

    email_sent = send_email_sync(
        to_email=user.email,
        subject="[Helpdesk Geiser] Votre code de connexion",
        body=f"""
        Bonjour <strong>{user.full_name}</strong>,<br><br>
        Votre code de connexion au Helpdesk GEISER est :<br><br>
        <div style="font-size:38px;font-weight:bold;letter-spacing:10px;
                    color:#0B1A52;text-align:center;padding:22px;
                    background:#eff6ff;border-radius:12px;
                    border:2px solid #bfdbfe;margin:10px 0;">
            {code}
        </div><br>
        Ce code est valable <strong>10 minutes</strong>.<br>
        Si vous n'avez pas demandé ce code, ignorez cet email.<br><br>
        Cordialement,<br><strong>L'équipe Helpdesk IA — GEISER</strong>
        """,
    )

    return {"message": "Si cet email existe, un code a été envoyé."}


# ── Route 2 : Vérifier le code OTP ──
@router.post("/verify-otp")
def verify_otp(email: str, code: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()

    if not user or not user.otp_code:
        raise HTTPException(status_code=400, detail="Code invalide ou expiré")

    now = datetime.now(timezone.utc)

    # Comparaison timezone-safe (supporte datetime naïf retourné par PostgreSQL)
    expires = user.otp_expires_at
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            user.otp_code = None
            user.otp_expires_at = None
            db.commit()
            raise HTTPException(status_code=400, detail="Code expiré. Demandez un nouveau code.")

    if user.otp_code != code:
        raise HTTPException(status_code=400, detail="Code incorrect")

    # Code valide → nettoyer + générer JWT
    user.otp_code = None
    user.otp_expires_at = None
    db.commit()

    token = create_access_token(str(user.user_id))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "user_id":   user.user_id,
            "full_name": user.full_name,
            "email":     user.email,
            "role":      user.role.value,
            "status":    user.status.value,
        }
    }

# ── Route 1 : Demander reset ──
@router.post("/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()

    # Toujours retourner OK pour ne pas divulguer si l'email existe
    if not user:
        return {"message": "Si cet email existe, un lien a été envoyé."}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    user.reset_token            = token
    user.reset_token_expires_at = expires_at
    db.commit()

    reset_url = f"http://localhost:5173/reset-password?token={token}"

    try:
        send_email_notification(
            to_email=user.email,
            subject="[Helpdesk Geiser] Réinitialisation de mot de passe",
            body=f"""
            Bonjour {user.full_name},<br><br>
            Vous avez demandé la réinitialisation de votre mot de passe.<br>
            Cliquez sur le lien ci-dessous :<br><br>
            <a href="{reset_url}" style="
                background: #0a46d6; color: #fff;
                padding: 12px 24px; border-radius: 8px;
                text-decoration: none; font-weight: bold;
            ">Réinitialiser mon mot de passe</a><br><br>
            Ce lien est valable <strong>1 heure</strong>.<br>
            Si vous n'avez pas fait cette demande, ignorez cet email.<br><br>
            Cordialement,<br>L'équipe Helpdesk IA — Geiser
            """,
        )
    except Exception as e:
        print(f"[RESET EMAIL ERROR] {e}")

    return {"message": "Si cet email existe, un lien a été envoyé."}


# ── Route 2 : Valider le token ──
@router.get("/reset-password/validate")
def validate_reset_token(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")

    now = datetime.now(timezone.utc)
    if user.reset_token_expires_at and user.reset_token_expires_at < now:
        user.reset_token            = None
        user.reset_token_expires_at = None
        db.commit()
        raise HTTPException(status_code=400, detail="Token expiré. Demandez un nouveau lien.")

    return {"valid": True, "email": user.email}


# ── Route 3 : Réinitialiser le mot de passe ──
@router.post("/reset-password")
def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == token).first()

    if not user:
        raise HTTPException(status_code=400, detail="Token invalide ou expiré")

    now = datetime.now(timezone.utc)
    if user.reset_token_expires_at and user.reset_token_expires_at < now:
        user.reset_token            = None
        user.reset_token_expires_at = None
        db.commit()
        raise HTTPException(status_code=400, detail="Token expiré.")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit avoir au moins 6 caractères.")

    from app.core.security import hash_password
    user.password_hash          = hash_password(new_password)
    user.reset_token            = None
    user.reset_token_expires_at = None
    db.commit()

    return {"message": "Mot de passe réinitialisé avec succès."}