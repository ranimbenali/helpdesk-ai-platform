from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.models.user import User
from app.models.enums import UserRole, UserStatus

def init_db(db: Session) -> None:
    admin_email = "admin@geiser.tn"
    admin = db.query(User).filter(User.email == admin_email).first()
    if not admin:
        admin = User(
            full_name="Admin",
            email=admin_email,
            password_hash=hash_password("admin123"),
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
        )
        db.add(admin)
    db.commit()