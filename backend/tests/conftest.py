"""
Configuration pytest — Helpdesk IA Geiser
==========================================
Utilise une base Postgres de test séparée (nom de la base + "_test"),
schema construit via les vraies migrations Alembic, isolation de chaque
test dans une transaction annulée (rollback) après coup — même si le
code testé appelle db.commit() lui-même (pattern SAVEPOINT).

IMPORTANT : la variable DATABASE_URL est réécrite tout en haut de ce
fichier, AVANT tout import du package `app` — app.db.session crée son
engine SQLAlchemy dès l'import, donc l'ordre est critique.
"""
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv

# Empêche le déclenchement automatique de l'OCR pendant les tests : le premier
# appel réel télécharge des modèles depuis internet (lent, dépendance réseau
# indésirable dans une suite de tests). Voir ai_service.extract_text_from_image.
os.environ.setdefault("HELPDESK_TESTING", "1")

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

_base_url = os.environ["DATABASE_URL"]
_prefix, _dbname = _base_url.rsplit("/", 1)
TEST_DB_NAME = f"{_dbname}_test"
os.environ["DATABASE_URL"] = f"{_prefix}/{TEST_DB_NAME}"

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

# ── Imports `app` seulement après avoir réécrit DATABASE_URL ──────────────────
from app.main import app
from app.db.session import get_db, engine
from app.core.security import create_access_token, hash_password
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from fastapi.testclient import TestClient


def _ensure_test_database_exists() -> None:
    admin_url = f"{_prefix}/postgres"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": TEST_DB_NAME}
        ).first()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    admin_engine.dispose()


def _run_migrations() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    if result.returncode != 0:
        raise RuntimeError(
            "Échec des migrations Alembic sur la base de test :\n"
            + result.stdout + result.stderr
        )


@pytest.fixture(scope="session", autouse=True)
def _setup_test_database():
    _ensure_test_database_exists()
    _run_migrations()
    yield


@pytest.fixture()
def db_session():
    """Session liée à une transaction annulée en fin de test (isolation),
    robuste même si le code testé appelle lui-même db.commit()."""
    connection = engine.connect()
    outer_trans = connection.begin()

    TestingSessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    yield session

    session.close()
    outer_trans.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _make_user(db_session, role: UserRole, email: str, password: str = "Test1234!") -> User:
    user = User(
        full_name=f"Test {role.value}",
        email=email,
        password_hash=hash_password(password),
        role=role,
        status=UserStatus.ACTIVE,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def requester_user(db_session) -> User:
    return _make_user(db_session, UserRole.REQUESTER, "requester@test.geiser.tn")


@pytest.fixture()
def agent_user(db_session) -> User:
    return _make_user(db_session, UserRole.AGENT, "agent@test.geiser.tn")


@pytest.fixture()
def supervisor_user(db_session) -> User:
    return _make_user(db_session, UserRole.SUPERVISOR, "supervisor@test.geiser.tn")


@pytest.fixture()
def admin_user(db_session) -> User:
    return _make_user(db_session, UserRole.ADMIN, "admin@test.geiser.tn")


def auth_headers(user: User) -> dict:
    token = create_access_token(str(user.user_id))
    return {"Authorization": f"Bearer {token}"}
