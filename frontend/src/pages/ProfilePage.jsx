import { useEffect, useState } from "react";
import { fetchMyProfile } from "../api/users";
import { API_BASE } from '../api/config.js';

const ROLE_COLORS = {
  ADMIN:      { bg: "#edf2ff", color: "#0a46d6", label: "Administrateur" },
  SUPERVISOR: { bg: "#fff1df", color: "#b86a00", label: "Superviseur" },
  AGENT:      { bg: "#e8f7ff", color: "#1677b3", label: "Agent" },
  REQUESTER:  { bg: "#edf7ef", color: "#2e8b57", label: "Demandeur" },
};

export default function ProfilePage({ user, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetchMyProfile()
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const role      = profile?.role || user?.role || "";
  const roleInfo  = ROLE_COLORS[role] || { bg: "#f1f5f9", color: "#64748b", label: role };
  const initial   = (profile?.full_name || user?.full_name || "?").charAt(0).toUpperCase();
  const avatarSrc = profile?.avatar_url ? `${API_BASE}${profile.avatar_url}` : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "24px",
          width: "100%", maxWidth: "520px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #0a46d6 0%, #6c63ff 100%)",
          padding: "28px 28px 24px", position: "relative",
        }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "16px", right: "16px",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff", borderRadius: "50%",
              width: "30px", height: "30px", fontSize: "16px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.28)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
          >×</button>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Avatar ou initiale */}
            <div style={{
              width: "70px", height: "70px", borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.6)",
              overflow: "hidden", flexShrink: 0,
              background: avatarSrc ? "transparent" : "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "26px", fontWeight: "800", color: "#fff",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : initial}
            </div>

            <div>
              {loading ? (
                <p style={{ color: "rgba(255,255,255,0.7)", margin: 0 }}>Chargement...</p>
              ) : (
                <>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#fff" }}>
                    {profile?.full_name || user?.full_name}
                  </h2>
                  <p style={{ margin: "3px 0 8px", fontSize: "13px", color: "rgba(255,255,255,0.75)" }}>
                    {profile?.email || user?.email}
                  </p>
                  <span style={{
                    padding: "3px 10px", borderRadius: "20px",
                    background: "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff", fontSize: "11px", fontWeight: "700",
                  }}>
                    {roleInfo.label}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Corps ── */}
        <div style={{ padding: "24px 28px 28px" }}>
          {error ? (
            <div style={{
              padding: "12px 16px", background: "#fef2f2",
              borderRadius: "10px", color: "#dc2626", fontSize: "13px",
            }}>⚠️ {error}</div>
          ) : loading ? null : (
            <>
              <p style={{
                margin: "0 0 12px", fontSize: "11px", fontWeight: "700",
                color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                Informations du compte
              </p>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "10px", marginBottom: "24px",
              }}>
                {[
                  { label: "Identifiant",   value: `#${profile.user_id}` },
                  { label: "Statut",        value: profile.status },
                  { label: "Rôle",          value: roleInfo.label },
                  {
                    label: "Membre depuis",
                    value: profile.created_at
                      ? new Date(profile.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "long", year: "numeric",
                        })
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    padding: "12px 14px", background: "#f8faff",
                    borderRadius: "12px", border: "1px solid #e8ecff",
                  }}>
                    <div style={{
                      fontSize: "10px", color: "#94a3b8", fontWeight: "700",
                      textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: "4px",
                    }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "14px", color: "#0f172a", fontWeight: "700" }}>
                      {value || "—"}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", marginBottom: "20px" }} />

              <p style={{
                margin: "0 0 12px", fontSize: "11px", fontWeight: "700",
                color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                Statistiques
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {role === "ADMIN" && <>
                  <StatCard label="Total tickets"   value={profile.stats?.global_total}      color="#0a46d6" bg="#eff6ff" />
                  <StatCard label="Tickets ouverts" value={profile.stats?.global_open}        color="#e53935" bg="#fef2f2" />
                  <StatCard label="Taux résolution" value={`${profile.stats?.resolve_rate}%`} color="#22c55e" bg="#f0fdf4" />
                </>}
                {(role === "AGENT" || role === "SUPERVISOR") && <>
                  <StatCard label="Assignés"        value={profile.stats?.assigned_total}     color="#0a46d6" bg="#eff6ff" />
                  <StatCard label="Résolus"         value={profile.stats?.assigned_resolved}  color="#22c55e" bg="#f0fdf4" />
                  <StatCard label="Taux résolution" value={`${profile.stats?.resolve_rate}%`} color="#6c63ff" bg="#f5f3ff" />
                </>}
                {role === "REQUESTER" && <>
                  <StatCard label="Tickets créés" value={profile.stats?.created_total}    color="#0a46d6" bg="#eff6ff" />
                  <StatCard label="Résolus"       value={profile.stats?.created_resolved} color="#22c55e" bg="#f0fdf4" />
                  <StatCard
                    label="En attente"
                    value={(profile.stats?.created_total || 0) - (profile.stats?.created_resolved || 0)}
                    color="#fb8c00" bg="#fff8e1"
                  />
                </>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ padding: "14px 12px", background: bg, borderRadius: "12px", textAlign: "center" }}>
      <div style={{ fontSize: "24px", fontWeight: "800", color }}>{value ?? "—"}</div>
      <div style={{ fontSize: "11px", color, fontWeight: "600", marginTop: "4px" }}>{label}</div>
    </div>
  );
}