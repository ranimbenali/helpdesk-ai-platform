"""
Script de labellisation des sous-catégories via Groq API (LLaMA 3) — gratuit.
- Lit dataset_clean.csv
- Pour chaque ticket, prédit la sous_categorie selon la catégorie déjà connue
- Sauvegarde la progression dans un checkpoint JSON
- Produit dataset_labeled.csv à la fin
"""

import csv
import json
import time
import os
import sys
from pathlib import Path
from groq import Groq

# Charger le .env depuis backend/.env
env_path = Path(__file__).parent.parent / "backend" / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY       = os.environ.get("GROQ_API_KEY", "")
INPUT_CSV     = r"C:\Users\ranim\Desktop\PFE\Helpdesk_IA\data\dataset_clean.csv"
OUTPUT_CSV    = r"C:\Users\ranim\Desktop\PFE\Helpdesk_IA\data\dataset_labeled.csv"
CHECKPOINT    = r"C:\Users\ranim\Desktop\PFE\Helpdesk_IA\scripts\checkpoint.json"
MODEL         = "llama-3.1-8b-instant"
DELAY_SECONDS = 0.3

# ── Taxonomie ─────────────────────────────────────────────────────────────────
TAXONOMY = {
    "Email & Messagerie": [
        "Création compte email",
        "Suppression compte email",
        "Extension boîte mail",
        "Problème accès email",
        "Configuration email",
    ],
    "Accès & Compte": [
        "Réinitialisation mot de passe",
        "Création de compte",
        "Désactivation compte",
        "Authentification 2FA",
        "Gestion des permissions",
    ],
    "Matériel": [
        "PC & Ordinateur",
        "Écran & Périphériques",
        "Imprimante & Scanner",
        "Caméra & Surveillance",
        "Serveur & Infrastructure",
        "TPE & Caisse",
        "Autre matériel",
    ],
    "Réseau": [
        "Connexion Internet",
        "WiFi",
        "Câblage réseau",
        "Lenteur réseau",
        "VPN",
    ],
    "Logiciel": [
        "Installation logiciel",
        "Mise à jour logiciel",
        "Bug logiciel",
        "Accès logiciel",
        "Configuration logiciel",
    ],
    "Téléphone": [
        "Téléphone fixe & VOIP",
        "Téléphone mobile",
        "Configuration téléphone",
    ],
    "Réclamation": [
        "Réclamation service",
        "Réclamation matériel",
        "Réclamation logiciel",
    ],
    "Intervention": [
        "Intervention sur site",
        "Maintenance préventive",
        "Déplacement technique",
    ],
    "RH_Finance": [
        "Gestion RH",
        "Gestion Finance & Paie",
        "Autre RH/Finance",
    ],
    "Autre": [
        "Demande générale",
        "Non classifiable",
    ],
}


def build_prompt(objet: str, description: str, categorie: str) -> str:
    sous_cats = TAXONOMY.get(categorie, ["Non classifiable"])
    liste = "|".join(sous_cats)
    desc_courte = description[:150] if description else ""
    return f"""Catégorie: {categorie}
Ticket: {objet}. {desc_courte}
Choix: {liste}
Réponds uniquement avec un choix exact."""


def load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_checkpoint(data: dict):
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    if not API_KEY:
        print("ERREUR : GROQ_API_KEY non trouvée dans backend/.env")
        sys.exit(1)

    client = Groq(api_key=API_KEY)

    with open(INPUT_CSV, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    checkpoint = load_checkpoint()
    total = len(rows)
    errors = 0

    print(f"Dataset : {total} tickets")
    print(f"Déjà traités (checkpoint) : {len(checkpoint)}")
    print(f"Restants : {total - len(checkpoint)}\n")

    for i, row in enumerate(rows):
        ticket_id = str(row["id"])

        if ticket_id in checkpoint:
            row["sous_categorie"] = checkpoint[ticket_id]
            continue

        objet       = row.get("objet", "").strip()
        description = row.get("description", "").strip()
        categorie   = row.get("categorie", "Autre").strip()

        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "Tu es un classificateur de tickets IT. Tu réponds UNIQUEMENT avec le nom exact d'une sous-catégorie, sans aucun autre texte.",
                    },
                    {"role": "user", "content": build_prompt(objet, description, categorie)},
                ],
                temperature=0.0,
                max_tokens=30,
            )
            sous_cat = response.choices[0].message.content.strip()

            # Valider que la réponse est dans la taxonomie
            valid = TAXONOMY.get(categorie, [])
            if sous_cat not in valid:
                sous_cat = valid[0] if valid else "Non classifiable"

            row["sous_categorie"] = sous_cat
            checkpoint[ticket_id] = sous_cat

            if (i + 1) % 50 == 0:
                save_checkpoint(checkpoint)
                print(f"  [{i+1}/{total}] checkpoint sauvegardé")

            time.sleep(DELAY_SECONDS)

        except Exception as e:
            print(f"  ERREUR ticket {ticket_id}: {e}")
            valid = TAXONOMY.get(categorie, ["Non classifiable"])
            row["sous_categorie"] = valid[0] if valid else "Non classifiable"
            errors += 1
            time.sleep(2)

        if (i + 1) % 100 == 0 or (i + 1) == total:
            print(f"  [{i+1}/{total}] {row['categorie']} → {row['sous_categorie']}")

    save_checkpoint(checkpoint)

    fieldnames = list(rows[0].keys())
    if "sous_categorie" not in fieldnames:
        fieldnames.append("sous_categorie")

    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nTerminé ! Fichier : {OUTPUT_CSV}")
    print(f"Erreurs : {errors}")

    sous_cats = {}
    for r in rows:
        sc = r.get("sous_categorie", "")
        sous_cats[sc] = sous_cats.get(sc, 0) + 1
    print("\nDistribution sous-catégories :")
    for k, v in sorted(sous_cats.items(), key=lambda x: -x[1]):
        print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main()
