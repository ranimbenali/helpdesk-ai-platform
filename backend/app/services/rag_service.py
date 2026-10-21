"""
Service RAG — Recherche de tickets similaires via ChromaDB
Utilise sentence-transformers pour encoder la requête,
puis interroge la collection ChromaDB sans embedding_function
(pour éviter un conflit avec les embeddings stockés par LangChain).
"""
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

CHROMA_DIR   = Path(__file__).parent.parent / "ai_service" / "chroma_db"
COLLECTION   = "helpdesk_cosine"   # collection avec sous_categorie
MODEL_NAME   = "paraphrase-multilingual-MiniLM-L12-v2"

_model      = None
_collection = None
_ready      = False


def _init() -> bool:
    global _model, _collection, _ready
    if _ready:
        return True
    try:
        import chromadb
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(MODEL_NAME)

        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        cols   = [c.name for c in client.list_collections()]

        # Priorité : helpdesk_cosine, sinon la première disponible
        name = COLLECTION if COLLECTION in cols else (cols[0] if cols else None)
        if not name:
            logger.warning("[RAG] Aucune collection ChromaDB disponible")
            return False

        _collection = client.get_collection(name=name)
        logger.info(f"[RAG] ✅ Collection '{name}' — {_collection.count()} tickets indexés")
        _ready = True
        return True
    except Exception as e:
        logger.error(f"[RAG] ❌ Initialisation échouée : {e}")
        return False


def _extract_description(doc: str) -> str:
    """Extrait le champ Description: du texte indexé (voir notebook 04_RAG_pipeline)."""
    match = re.search(r"Description:\s*(.+?)(?:\nCatégorie:|\Z)", doc, re.DOTALL)
    return match.group(1).strip() if match else ""


def search_similar(text: str, n: int = 5) -> list[dict]:
    """
    Encode le texte avec sentence-transformers, interroge ChromaDB
    et retourne les n tickets les plus proches.
    """
    if not _init():
        return []
    try:
        embedding = _model.encode([text]).tolist()
        results   = _collection.query(
            query_embeddings=embedding,
            n_results=min(n, _collection.count()),
            include=["documents", "metadatas", "distances"],
        )
        similar = []
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            # distance cosine / L2 → score [0,1]
            similarity = round(1 / (1 + float(dist)), 3)
            similar.append({
                "ticket_id":   meta.get("ticket_id"),
                "title":       meta.get("objet") or doc[:120],
                "description": _extract_description(doc),
                "category":    meta.get("categorie"),
                "subcategory": meta.get("sous_categorie"),
                "priority":    meta.get("priorite"),
                "status":      meta.get("statut"),
                "similarity":  similarity,
            })
        return similar
    except Exception as e:
        logger.error(f"[RAG] ❌ Recherche échouée : {e}")
        return []
