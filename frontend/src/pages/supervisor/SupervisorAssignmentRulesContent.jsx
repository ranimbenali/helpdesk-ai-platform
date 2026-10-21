import { useEffect, useState } from "react";
import { fetchRoutingInfo } from "../../api/settings";

const card = { background: "#fff", borderRadius: 14, padding: "22px 26px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" };

export default function SupervisorAssignmentRulesContent() {
  const [info,    setInfo]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetchRoutingInfo()
      .then(setInfo)
      .catch(e => setError(e.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="adm-body">
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>Règles d'assignation</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 22 }}>
          Comment les nouveaux tickets sont distribués aux agents. Ces réglages sont globaux à la plateforme
          (une seule organisation, un seul flux de tickets) — ils sont gérés par un administrateur.
        </div>

        {error && (
          <div style={{ background: "#fef2f2", color: "#e53935", padding: "12px 16px", borderRadius: 10, fontSize: 13 }}>{error}</div>
        )}

        {loading ? (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
        ) : info && (
          <>
            <div style={{ display: "flex", gap: 16, marginBottom: 18, alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", width: 220, flexShrink: 0 }}>Méthode active</div>
              <div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                  IA
                </span>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>
                  L'IA pondère par disponibilité, charge, spécialité et CSAT (bouton "IA" dans la File d'attente).
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", width: 220, flexShrink: 0 }}>Auto-assignation à la création</div>
              <div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 8,
                  background: info.ai_auto_assign ? "#f0fdf4" : "#f1f5f9",
                  color: info.ai_auto_assign ? "#16a34a" : "#64748b",
                  border: `1px solid ${info.ai_auto_assign ? "#bbf7d0" : "#e2e8f0"}`,
                  fontSize: 12, fontWeight: 700,
                }}>
                  {info.ai_auto_assign ? "Activée" : "Désactivée"}
                </span>
                <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>
                  {info.ai_auto_assign
                    ? "Les tickets classés avec une confiance suffisante sont assignés automatiquement par l'IA dès leur création."
                    : "Les tickets arrivent dans la File d'attente pour assignation manuelle ou via le bouton IA."}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ ...card, background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
        <div style={{ fontSize: 12.5, color: "#64748b" }}>
          Pour modifier ces réglages (seuil de confiance IA, auto-assignation), contactez un administrateur —
          section <strong>Configuration IA</strong>.
        </div>
      </div>
    </div>
  );
}
