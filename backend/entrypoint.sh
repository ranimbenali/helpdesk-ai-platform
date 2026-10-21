#!/bin/bash
set -e

echo "⏳ Attente de PostgreSQL..."
until python - <<'PYEOF'
import os, sys
import psycopg2
url = os.environ.get("DATABASE_URL", "")
# Retirer le dialecte SQLAlchemy pour psycopg2 pur
url = url.replace("postgresql+psycopg2://", "postgresql://")
try:
    conn = psycopg2.connect(url)
    conn.close()
    print("✅ PostgreSQL prête")
except Exception as e:
    print(f"   PostgreSQL pas encore prête: {e}")
    sys.exit(1)
PYEOF
do
  sleep 2
done

echo "🔄 Lancement des migrations Alembic..."
alembic upgrade head

echo "🚀 Démarrage FastAPI (uvicorn)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
