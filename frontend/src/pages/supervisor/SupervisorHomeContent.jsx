import { useEffect, useState } from "react";
import { fetchSupervisorStats } from "../../api/tickets";
import { fetchAtRiskTickets } from "../../api/sla";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

function ComingSoon({ title }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "32px 20px", gap: 8,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{title}</div>
      <div style={{ fontSize: 11, color: "#cbd5e1" }}>Bientôt disponible</div>
    </div>
  );
}

export default function SupervisorHomeContent({ user }) {
  const [stats,   setStats]   = useState(null);
  const [atRisk,  setAtRisk]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(true);

  useEffect(() => {
    fetchSupervisorStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchAtRiskTickets()
      .then(r => setAtRisk(r || []))
      .catch(() => setAtRisk([]))
      .finally(() => setRiskLoading(false));
  }, []);

  const total    = stats?.total ?? 0;
  const open     = stats?.by_status?.OPEN ?? 0;
  const inProg   = stats?.by_status?.IN_PROGRESS ?? 0;
  const resolved = (stats?.by_status?.RESOLVED ?? 0) + (stats?.by_status?.CLOSED ?? 0);
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  /* ── Bar chart — 7 derniers jours ── */
  const last7  = stats?.last_7_days ?? [];
  const hasBar = last7.length > 0;
  const barData = {
    labels: last7.map(d => d.date?.slice(5) || d.date),
    datasets: [
      {
        label: "Reçus",
        data: last7.map(d => d.count),
        backgroundColor: "#2B45C8",
        borderRadius: 4, borderSkipped: false,
      },
    ],
  };
  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "top", labels: { font: { size: 11 }, boxWidth: 12 } } },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f0f4ff" }, ticks: { font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  /* ── Donut — Par catégorie ── */
  const byCat    = stats?.by_category ?? null;
  const hasDoughnut = byCat && Object.keys(byCat).length > 0;
  const catColors   = ["#2B45C8", "#F59E0B", "#22D3A0", "#8B5CF6", "#e53935", "#94a3b8"];
  const catLabels   = hasDoughnut ? Object.keys(byCat) : [];
  const catValues   = hasDoughnut ? Object.values(byCat) : [];
  const catTotal    = catValues.reduce((a, b) => a + b, 0);
  const catData     = {
    labels: catLabels,
    datasets: [{ data: catValues, backgroundColor: catColors.slice(0, catLabels.length), borderWidth: 2, borderColor: "#fff" }],
  };
  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    cutout: "70%",
  };

  /* ── Risk tickets ── */
  const riskDisplay = atRisk.slice(0, 4).map(t => {
    const diff = t.due_resolve_at
      ? Math.max(0, Math.round((new Date(t.due_resolve_at) - Date.now()) / 60000))
      : null;
    const slaIn = diff === null ? "—"
      : diff >= 60 ? `${Math.floor(diff / 60)} h ${diff % 60} min`
      : `${diff} min`;
    const color = (t.risk_score || 0) >= 70 ? "#e53935" : "#F59E0B";
    return {
      id: `#${t.external_id || t.ticket_id}`,
      title: t.title || "—",
      agent: t.assignee || "Non assigné",
      assignee_manually_updated: t.assignee_manually_updated,
      slaIn,
      color,
    };
  });

  const firstName = user?.full_name?.split(" ")[0] || "Superviseur";

  return (
    <div className="adm-body">

      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
          Bonjour {firstName} — voici l'état du support aujourd'hui
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>Tableau de bord superviseur</div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "TICKETS TOTAL",   value: loading ? "…" : total,          color: "#2B45C8" },
          { label: "OUVERTS",         value: loading ? "…" : open,           color: "#F59E0B" },
          { label: "EN COURS",        value: loading ? "…" : inProg,         color: "#8B5CF6" },
          { label: "TAUX RÉSOLUTION", value: loading ? "…" : `${resolvedPct}%`, color: "#22D3A0" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, marginBottom: 16 }}>

        {/* Bar chart — données réelles */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 2 }}>Volume de tickets — 7 derniers jours</div>
          {loading ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
          ) : !hasBar ? (
            <ComingSoon title="Volume de tickets" />
          ) : (
            <div style={{ height: 200, marginTop: 8 }}>
              <Bar data={barData} options={barOpts} />
            </div>
          )}
        </div>

        {/* Donut — données réelles ou vide */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>Par catégorie</div>
          {loading ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
          ) : !hasDoughnut ? (
            <ComingSoon title="Répartition par catégorie" />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ height: 140, width: 140, flexShrink: 0 }}>
                <Doughnut data={catData} options={donutOpts} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {catLabels.map((k, i) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: catColors[i] || "#94a3b8", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#334155", flex: 1 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                      {catTotal > 0 ? Math.round(((byCat[k] || 0) / catTotal) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Charge des agents — données réelles */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>Charge des agents</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
          ) : !(stats?.by_agent?.length > 0) ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>Aucun ticket assigné</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats.by_agent.slice(0, 5).map((a, i) => {
                const maxCount = stats.by_agent[0]?.count || 1;
                const pct = Math.round((a.count / maxCount) * 100);
                const colors = ["#2B45C8", "#8B5CF6", "#22D3A0", "#F59E0B", "#e53935"];
                const col = colors[i % colors.length];
                return (
                  <div key={a.user_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: col,
                      color: "#fff", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {(a.full_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#334155",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                          {a.full_name}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: col, flexShrink: 0, marginLeft: 8 }}>
                          {a.count} tickets
                        </span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tickets à risque SLA — données réelles */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Tickets à risque SLA</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {riskLoading ? "Chargement…" : `${riskDisplay.length} nécessitent votre attention`}
              </div>
            </div>
            {riskDisplay.length > 0 && (
              <span style={{ background: "#fee2e2", color: "#e53935", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                ⚠ {riskDisplay.length} urgent{riskDisplay.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {riskLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
          ) : riskDisplay.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#22D3A0", fontSize: 13, fontWeight: 600 }}>
              ✓ Aucun ticket à risque SLA
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {riskDisplay.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: i < riskDisplay.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                      {t.id} · {t.agent}
                      {t.agent && t.agent !== "Non assigné" && (
                        t.assignee_manually_updated
                          ? <span style={{ fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:20, background:"#eff6ff", color:"#2563eb" }}>👤</span>
                          : <span style={{ fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:20, background:"#faf5ff", color:"#7c3aed" }}>🤖</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>SLA DANS</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.slaIn}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
