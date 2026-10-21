import { useEffect, useState } from "react";
import { fetchTicketStats, fetchAIStats } from "../../api/tickets";
import {
  Chart as ChartJS,
  ArcElement, BarElement,
  LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement, BarElement,
  LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
);

/* ─── tiny helpers ─── */
function TrendUp() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function TrendDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
      <polyline points="17 18 23 18 23 12"/>
    </svg>
  );
}

function normalizeStatus(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("open")     || s.includes("ouvert")) return "open";
  if (s.includes("progress") || s.includes("cours"))  return "progress";
  if (s.includes("resolv")   || s.includes("résol"))  return "resolved";
  return "open";
}

function statusLabel(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("open") || s.includes("ouvert")) return "Ouvert";
  if (s.includes("progress") || s.includes("cours")) return "En cours";
  if (s.includes("resolv") || s.includes("résol")) return "Résolu";
  if (s.includes("clos") || s.includes("ferm")) return "Fermé";
  return status;
}

export default function AdminHomeContent() {
  const [stats,   setStats]   = useState(null);
  const [aiStats, setAiStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    Promise.all([
      fetchTicketStats(),
      fetchAIStats().catch(() => null),
    ])
      .then(([s, ai]) => { setStats(s); setAiStats(ai); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  /* derived values */
  const open        = stats?.by_status?.OPEN ?? 0;
  const inProgress  = stats?.by_status?.IN_PROGRESS ?? 0;
  const resolved    = stats?.by_status?.RESOLVED ?? 0;
  const closed      = stats?.by_status?.CLOSED ?? 0;
  const total       = stats?.total ?? 0;
  const resolvedPct = total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0;

  const todayCount     = stats?.today_count ?? 0;
  const yesterdayCount = stats?.yesterday_count ?? 0;
  const todayDiff      = todayCount - yesterdayCount;

  const priorities  = stats?.by_priority ?? {};
  const last7Days   = stats?.last_7_days ?? [];
  const usersByRole = stats?.users_by_role ?? {};
  const totalUsers  = Object.values(usersByRole).reduce((a, b) => a + b, 0);

  /* taux de validation IA réel */
  const aiValidated  = aiStats?.by_validation?.VALIDATED  ?? 0;
  const aiRejected   = aiStats?.by_validation?.REJECTED   ?? 0;
  const aiCorrected  = aiStats?.by_validation?.CORRECTED  ?? 0;
  const aiReviewed   = aiValidated + aiRejected + aiCorrected;
  const validationRate = aiReviewed > 0 ? Math.round(aiValidated / aiReviewed * 100) : null;

  /* top catégories IA — depuis /ai/stats */
  const CAT_COLORS = ["#2563eb","#7c3aed","#16a34a","#ea580c","#0891b2","#dc2626","#854d0e","#0f766e","#9333ea","#64748b"];
  const catEntries = (aiStats?.by_category ?? [])
    .slice(0, 6)
    .map((c, i) => ({ name: c.category, count: c.count, color: CAT_COLORS[i % CAT_COLORS.length] }));
  const maxCat = Math.max(...catEntries.map((c) => c.count), 1);

  /* line chart */
  const lineData = {
    labels: last7Days.map((d) => d.date),
    datasets: [
      {
        label: "Reçus",
        data: last7Days.map((d) => d.count),
        borderColor: "#2B45C8",
        backgroundColor: "rgba(43,69,200,0.08)",
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#2B45C8",
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
      },
      {
        label: "Résolus",
        data: last7Days.map((d) => Math.round((d.count || 0) * (resolvedPct / 100))),
        borderColor: "#22D3A0",
        backgroundColor: "rgba(34,211,160,0.06)",
        tension: 0.4,
        fill: false,
        pointBackgroundColor: "#22D3A0",
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: [4, 3],
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "end",
        labels: {
          font: { family: "JetBrains Mono, monospace", size: 10 },
          color: "#64748b",
          boxWidth: 10,
          boxHeight: 2,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleFont: { family: "Plus Jakarta Sans, sans-serif", size: 12, weight: "700" },
        bodyFont:  { family: "JetBrains Mono, monospace",  size: 11 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#f0f2f9" },
        ticks: {
          font: { family: "JetBrains Mono, monospace", size: 10 },
          color: "#94a3b8",
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "JetBrains Mono, monospace", size: 10 },
          color: "#94a3b8",
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="adm-body" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>⟳</div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.05em" }}>
            CHARGEMENT…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-body">
      {error && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", background: "#fdecea", borderRadius: "10px", color: "#b71c1c", fontSize: "13px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* ══ ROW 1 — KPI cards ══ */}
      <div className="home-kpi-row">
        {/* Tickets ce mois */}
        <div className="kpi-card blue">
          <div className="kpi-label">Tickets ce mois</div>
          <div className="kpi-value">{total}</div>
          <span className={`kpi-trend ${todayDiff >= 0 ? "up" : "down"}`}>
            {todayDiff >= 0 ? <TrendUp /> : <TrendDown />}
            {Math.abs(todayDiff)} vs hier
          </span>
        </div>

        {/* SLA Global */}
        <div className="kpi-card green">
          <div className="kpi-label">SLA Global</div>
          <div className="kpi-value green-val">{resolvedPct}%</div>
          <span className={`kpi-trend ${resolvedPct >= 80 ? "up" : resolvedPct >= 50 ? "flat" : "down"}`}>
            {resolvedPct >= 80 ? <TrendUp /> : resolvedPct >= 50 ? null : <TrendDown />}
            {resolvedPct >= 80 ? "Excellent" : resolvedPct >= 50 ? "Correct" : "À améliorer"}
          </span>
        </div>

        {/* CSAT Moyen */}
        <div className="kpi-card purple">
          <div className="kpi-label">CSAT Moyen</div>
          <div className="kpi-value purple-val">4.7<span style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-muted)" }}>/5</span></div>
          <span className="kpi-trend up">
            <TrendUp />
            +0.2 ce mois
          </span>
        </div>

        {/* Coût / ticket */}
        <div className="kpi-card orange">
          <div className="kpi-label">Utilisateurs actifs</div>
          <div className="kpi-value" style={{ fontSize: "28px" }}>{totalUsers}</div>
          <span className="kpi-trend flat">
            {open} ouverts · {inProgress} en cours
          </span>
        </div>
      </div>

      {/* ══ ROW 2 — Volume chart + Categories ══ */}
      <div className="home-mid-row">
        {/* Line chart */}
        <div className="chart-card">
          <div className="chart-card-head">
            <div>
              <div className="chart-card-title">Volume — 30 jours</div>
              <div className="chart-card-sub">Reçus / résolus / SLA tenu</div>
            </div>
          </div>
          {last7Days.length === 0 ? (
            <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Aucune donnée disponible
            </div>
          ) : (
            <div className="chart-wrap">
              <Line data={lineData} options={lineOptions} />
            </div>
          )}
        </div>

        {/* Top catégories IA */}
        <div className="cat-card">
          <div className="cat-card-title">Top catégories IA</div>
          {catEntries.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>
              Aucune classification IA disponible.
            </div>
          ) : catEntries.map((cat) => (
            <div key={cat.name} className="cat-item">
              <div className="cat-item-header">
                <span className="cat-item-name">{cat.name}</span>
                <span className="cat-item-count">{cat.count}</span>
              </div>
              <div className="cat-bar-track">
                <div
                  className="cat-bar-fill"
                  style={{
                    width: `${Math.round((cat.count / maxCat) * 100)}%`,
                    background: cat.color,
                  }}
                />
              </div>
            </div>
          ))
          }
        </div>
      </div>

      {/* ══ ROW 3 — Activité récente / Performance IA / Licences ══ */}
      <div className="home-bottom-row">
        {/* Activité récente */}
        <div className="activity-card">
          <div className="activity-card-title">Activité récente</div>
          {!stats?.recent?.length ? (
            <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px 0" }}>
              Aucun ticket récent.
            </div>
          ) : (
            stats.recent.slice(0, 5).map((t) => {
              const ns = normalizeStatus(t.status);
              return (
                <div key={t.ticket_id} className="activity-item">
                  <div className={`activity-icon ${ns}`}>
                    {ns === "open" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    )}
                    {ns === "progress" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    )}
                    {ns === "resolved" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div className="activity-text">
                    <div className="activity-name">{t.title}</div>
                    <div className="activity-meta">{t.requester_name || "—"} · {t.priority_label || "—"}</div>
                  </div>
                  <span className={`activity-status ${ns}`}>
                    {statusLabel(t.status)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Performance IA */}
        <div className="ia-card">
          <div className="ia-card-title">Performance IA</div>
          <div className="ia-big-value">
            {validationRate !== null ? `${validationRate}%` : "—"}
          </div>
          <div className="ia-big-label">
            {aiReviewed > 0
              ? `Validées sans correction (${aiValidated}/${aiReviewed} évaluées)`
              : "Aucune classification évaluée"}
          </div>
          <div className="ia-bullet">
            <span className="ia-bullet-dot" />
            {aiStats?.total_classified ?? 0} tickets classifiés automatiquement
          </div>
          <div className="ia-bullet">
            <span className="ia-bullet-dot" style={{ background: "#22D3A0" }} />
            {aiCorrected} corrigées · {aiRejected} rejetées
          </div>
          <div className="ia-bullet">
            <span className="ia-bullet-dot" style={{ background: "#1E3AAF" }} />
            Confiance moyenne : {aiStats?.avg_confidence ?? "—"}%
          </div>
          <div className="ia-bullet">
            <span className="ia-bullet-dot" style={{ background: "#f59e0b" }} />
            ML (TF-IDF) + LLM Groq actifs
          </div>
        </div>

        {/* Utilisateurs */}
        <div className="lic-card">
          <div className="lic-card-title">Utilisateurs</div>
          <div className="lic-main-value">{totalUsers}</div>
          <div className="lic-main-label">Comptes actifs</div>

          {/* Barre de répartition par rôle */}
          <div className="lic-bar-track" style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
            {[
              { role: "ADMIN",      color: "#8B5CF6" },
              { role: "SUPERVISOR", color: "#1E3AAF" },
              { role: "AGENT",      color: "#22D3A0" },
              { role: "REQUESTER",  color: "#f59e0b" },
            ].map(({ role, color }) => {
              const pct = totalUsers > 0 ? Math.round(((usersByRole[role] ?? 0) / totalUsers) * 100) : 0;
              return pct > 0 ? (
                <div key={role} style={{ width: `${pct}%`, background: color, transition: "width 0.5s ease" }} />
              ) : null;
            })}
          </div>

          {/* Role breakdown */}
          {[
            { role: "ADMIN",      label: "Admins",      color: "#8B5CF6" },
            { role: "SUPERVISOR", label: "Superviseurs", color: "#1E3AAF" },
            { role: "AGENT",      label: "Agents",       color: "#22D3A0" },
            { role: "REQUESTER",  label: "Demandeurs",   color: "#f59e0b" },
          ].map(({ role, label, color }) => (
            <div key={role} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
                {label}
              </span>
              <strong style={{ color: "var(--text)" }}>
                {usersByRole[role] ?? 0}
                <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 11 }}>
                  {totalUsers > 0 ? ` (${Math.round(((usersByRole[role] ?? 0) / totalUsers) * 100)}%)` : ""}
                </span>
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
