_CAT_NORMALIZE = {
    "Accès":      "Accès & Compte",
    "Acces":      "Accès & Compte",
    "Email":      "Email & Messagerie",
    "Messagerie": "Email & Messagerie",
    "Impression": "Matériel",
    "Téléphonie": "Téléphone",
    "Telephonie": "Téléphone",
    "Serveur":    "Matériel",
    "Sécurité":   "Autre",
    "Securite":   "Autre",
}

_PRIO_NORMALIZE = {
    "P1_URGENT": "Urgente",
    "P2_HIGH":   "Haute",
    "P3_NORMAL": "Normale",
    "P4_LOW":    "Faible",
    "Basse":     "Faible",
    "Moyenne":   "Normale",
}


def normalize_category(cat: str) -> str:
    return _CAT_NORMALIZE.get(cat, cat)


def normalize_priority(prio: str) -> str:
    return _PRIO_NORMALIZE.get(prio, prio)
