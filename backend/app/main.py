import asyncio
import os
import logging

# Sans ceci, Python n'affiche par défaut que les logs WARNING+ dans la console
# (les logger.info(...), comme la confirmation de chargement MLflow, sont sinon
# silencieusement ignorés — pas un bug applicatif, juste une config manquante).
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Bibliothèques tierces trop verbeuses : elastic_transport dump un traceback
# complet à chaque tentative de connexion quand Elasticsearch n'est pas lancé
# (cas normal en dev local sans Docker) — on garde juste nos propres logs "[ES SYNC]".
logging.getLogger("elastic_transport").setLevel(logging.ERROR)
logging.getLogger("urllib3").setLevel(logging.WARNING)

from dotenv import load_dotenv
load_dotenv()
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.init_db import init_db
from app.db.session import SessionLocal
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.tickets import router as tickets_router
from app.services.geiser_sync import sync_tickets_from_geiser
from app.routers.settings import router as settings_router
from app.routers.sla import router as sla_router
from app.routers.notifications import router as notifications_router
from app.routers.ai import router as ai_router
from app.services.sla_service import (
    init_sla_policies,
    init_sla_instances_for_existing_tickets,
    check_sla_breaches,
)
from app.services.auto_close_service import auto_close_resolved_tickets
from app.services.es_sync_service import sync_classifications_to_elasticsearch

# ✅ Création de l'application FastAPI
app = FastAPI(title="Helpdesk IA — Geiser", version="1.0.0")
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Dev local (Vite)
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        # Docker / production (Nginx sur port 80)
        "http://localhost",
        "http://localhost:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sync_task_started = False


async def geiser_sync_loop():
    # Attendre un peu après le démarrage
    await asyncio.sleep(15)

    while True:
        db = SessionLocal()
        try:
            result = sync_tickets_from_geiser(db)
            print("[SYNC AUTO]", result)
        except Exception as e:
            print("[SYNC AUTO ERROR]", str(e))
        finally:
            db.close()

        await asyncio.sleep(300)  # 5 minutes


async def sla_check_loop():
    await asyncio.sleep(30)
    while True:
        db = SessionLocal()
        try:
            check_sla_breaches(db)
        except Exception as e:
            print("[SLA CHECK ERROR]", str(e))
        finally:
            db.close()
        await asyncio.sleep(600)  # 10 minutes


async def auto_close_loop():
    await asyncio.sleep(60)  # Attendre 1 min après démarrage
    while True:
        db = SessionLocal()
        try:
            auto_close_resolved_tickets(db)
        except Exception as e:
            print("[AUTO-CLOSE ERROR]", str(e))
        finally:
            db.close()
        await asyncio.sleep(21600)  # Vérifier toutes les 6 heures


async def es_sync_loop():
    # Sync continue vers Elasticsearch/Kibana (remplace l'ancien script ponctuel).
    # Résilient : si Elasticsearch n'est pas lancé (dev sans docker-compose), on
    # log et on réessaie au cycle suivant — ça ne doit jamais bloquer l'app.
    await asyncio.sleep(45)
    while True:
        db = SessionLocal()
        try:
            result = sync_classifications_to_elasticsearch(db)
            if result.get("synced"):
                print("[ES SYNC]", result)
        except Exception as e:
            print("[ES SYNC] Elasticsearch indisponible, nouvelle tentative dans 5 min :", str(e))
        finally:
            db.close()
        await asyncio.sleep(300)  # 5 minutes


@app.on_event("startup")
async def on_startup():
    global sync_task_started

    db = SessionLocal()
    try:
        init_db(db)
        init_sla_policies(db)
        init_sla_instances_for_existing_tickets(db)
    finally:
        db.close()

    # Boucle SLA auto toutes les 10 minutes
    asyncio.create_task(sla_check_loop())

    # Boucle auto-fermeture des tickets résolus (toutes les 6h)
    asyncio.create_task(auto_close_loop())

    # Boucle sync Elasticsearch/Kibana (toutes les 5 minutes)
    asyncio.create_task(es_sync_loop())

    # Éviter plusieurs tâches en mode reload
    if not sync_task_started and os.getenv("RUN_MAIN") != "true":
        sync_task_started = True
        asyncio.create_task(geiser_sync_loop())


@app.get("/")
def root():
    return {"message": "API is running"}


app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tickets_router)
app.include_router(settings_router)
app.include_router(sla_router)
app.include_router(notifications_router)
app.include_router(ai_router)