import { useEffect, useState } from "react";
import { fetchSupervisorStats } from "../../api/tickets";
import {
  Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const AGENT_PAGE_SIZE = 8;
const LOG_PAGE_SIZE   = 10;

function PageBtn({ children, active, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 30, height: 30, borderRadius: 6, border: "1.5px solid",
      borderColor: active ? "#2B45C8" : disabled ? "#f1f5f9" : "#e8ecf7",
      background: active ? "#2B45C8" : "#fff",
      color: active ? "#fff" : disabled ? "#cbd5e1" : "#64748b",
      fontSize: 12, fontWeight: active ? 700 : 500,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "var(--font)",
    }}>{children}</button>
  );
}

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, color: "#94a3b8" }}>
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} sur {total}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <PageBtn disabled={page === 0} onClick={() => onChange(page - 1)}>‹</PageBtn>
        {Array.from({ length: totalPages }, (_, i) => (
          <PageBtn key={i} active={i === page} onClick={() => onChange(i)}>{i + 1}</PageBtn>
        ))}
        <PageBtn disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>›</PageBtn>
      </div>
    </div>
  );
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const COLORS = [
  "#2B45C8", "#22D3A0", "#F59E0B", "#8B5CF6",
  "#e53935", "#0ea5e9", "#10b981", "#f97316",
];

export default function SupervisorPerformanceContent({ onStatsChange }) {
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [agentPage,  setAgentPage]  = useState(0);
  const [logPage,    setLogPage]    = useState(0);

  useEffect(() => {
    fetchSupervisorStats()
      .then(s => { setStats(s); onStatsChange?.(s); })
      .catch(e => setError(e.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const total    = stats?.total ?? 0;
  const resolved = (stats?.by_status?.RESOLVED ?? 0) + (stats?.by_status?.CLOSED ?? 0);
  const open     = stats?.by_status?.OPEN ?? 0;
  const inProg   = stats?.by_status?.IN_PROGRESS ?? 0;
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const unassigned  = stats?.unassigned ?? 0;

  /* ── Tickets par agent (tri décroissant) ── */
  const byAgent = [...(stats?.by_agent ?? [])].sort((a, b) => b.count - a.count);

  /* ── Volume 7 jours ── */
  const last7  = stats?.last_7_days ?? [];
  const hasBar = last7.length > 0;
  const barData = {
    labels: last7.map(d => {
      const s = d.date?.slice(5) || d.date;
      return s;
    }),
    datasets: [{
      label: "Tickets créés",
      data: last7.map(d => d.count),
      backgroundColor: "#2B45C8",
      borderRadius: 4, borderSkipped: false,
    }],
  };
  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f0f4ff" }, ticks: { font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  /* ── Agents bar chart ── */
  const agentBarData = {
    labels: byAgent.slice(0, 8).map(a => a.full_name.split(" ")[0]),
    datasets: [{
      label: "Tickets traités",
      data: byAgent.slice(0, 8).map(a => a.count),
      backgroundColor: byAgent.slice(0, 8).map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 4, borderSkipped: false,
    }],
  };
  const agentBarOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f0f4ff" }, ticks: { font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  return (
    <div className="adm-body">

      {error && (
        <div style={{ background: "#fef2f2", color: "#e53935", padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "TOTAL TICKETS",     value: loading ? "…" : total,         color: "#2B45C8", bg: "#eff6ff",  border: "#bfdbfe" },
          { label: "RÉSOLUS",           value: loading ? "…" : resolved,      color: "#22D3A0", bg: "#f0fdf4",  border: "#bbf7d0" },
          { label: "TAUX RÉSOLUTION",   value: loading ? "…" : `${resolvedPct}%`, color: "#22D3A0", bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "NON ASSIGNÉS",      value: loading ? "…" : unassigned,    color: "#e53935", bg: "#fef2f2",  border: "#fecaca" },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Statuts */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 14 }}>Répartition par statut</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "Ouverts",    value: open,    color: "#2B45C8", bg: "#eff6ff" },
            { label: "En cours",   value: inProg,  color: "#8B5CF6", bg: "#f5f3ff" },
            { label: "Résolus",    value: stats?.by_status?.RESOLVED ?? 0, color: "#22D3A0", bg: "#f0fdf4" },
            { label: "Fermés",     value: stats?.by_status?.CLOSED ?? 0,   color: "#64748b", bg: "#f1f5f9" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{loading ? "…" : value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Volume 7 jours */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 2 }}>Volume de tickets — 7 derniers jours</div>
          {loading ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
          ) : !hasBar ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Aucune donnée disponible</div>
          ) : (
            <div style={{ height: 180, marginTop: 8 }}>
              <Bar data={barData} options={barOpts} />
            </div>
          )}
        </div>

        {/* Tickets par agent */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 2 }}>Tickets traités par agent</div>
          {loading ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
          ) : byAgent.length === 0 ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>Aucune donnée disponible</div>
          ) : (
            <div style={{ height: 180, marginTop: 8 }}>
              <Bar data={agentBarData} options={agentBarOpts} />
            </div>
          )}
        </div>
      </div>

      {/* Classement agents */}
      {!loading && byAgent.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)", overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Classement agents</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Par volume de tickets traités</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Agent", "Tickets traités"].map((h, i) => (
                  <th key={i} style={{ padding: "10px 20px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byAgent.slice(agentPage * AGENT_PAGE_SIZE, (agentPage + 1) * AGENT_PAGE_SIZE).map((a, idxInPage) => {
                const idx = agentPage * AGENT_PAGE_SIZE + idxInPage;
                return (
                  <tr key={a.full_name}
                    style={{ borderBottom: "1px solid #f8fafc" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "13px 20px", width: 50 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: idx < 3 ? "#2B45C8" : "#94a3b8" }}>#{idx + 1}</span>
                    </td>
                    <td style={{ padding: "13px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS[idx % COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {initials(a.full_name)}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{a.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "13px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, maxWidth: 200, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${byAgent[0].count > 0 ? Math.round((a.count / byAgent[0].count) * 100) : 0}%`,
                            background: COLORS[idx % COLORS.length],
                            borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", minWidth: 32 }}>{a.count}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={agentPage} total={byAgent.length} pageSize={AGENT_PAGE_SIZE} onChange={setAgentPage} />
        </div>
      )}

      {/* Logs récents */}
      {!loading && (stats?.audit_logs ?? []).length > 0 && (() => {
        const logs = stats.audit_logs;
        const pagedLogs = logs.slice(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE);
        return (
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)", overflow: "hidden", marginTop: 16 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Activité récente</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{logs.length} dernières actions</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Ticket", "Action", "Par", "Date"].map((h, i) => (
                    <th key={i} style={{ padding: "9px 18px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map(log => (
                  <tr key={log.event_id}
                    style={{ borderBottom: "1px solid #f8fafc" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "11px 18px", color: "#2B45C8", fontWeight: 700, fontSize: 12, fontFamily: "var(--font-mono)" }}>
                      #{log.ticket_id}
                      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, fontFamily: "var(--font)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.ticket_title}</div>
                    </td>
                    <td style={{ padding: "11px 18px" }}>
                      <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: log.event_type === "STATUS_CHANGED" ? "#e3f2fd" : log.event_type === "PRIORITY_CHANGED" ? "#fff8e1" : "#f3e5f5",
                        color: log.event_type === "STATUS_CHANGED" ? "#1565c0" : log.event_type === "PRIORITY_CHANGED" ? "#f57f17" : "#6a1b9a",
                      }}>
                        {log.event_type === "STATUS_CHANGED" ? "Statut modifié" : log.event_type === "PRIORITY_CHANGED" ? "Priorité modifiée" : log.event_type === "ASSIGNEE_CHANGED" ? "Agent modifié" : log.event_type}
                      </span>
                    </td>
                    <td style={{ padding: "11px 18px", fontSize: 12, color: "#334155" }}>{log.author_name}</td>
                    <td style={{ padding: "11px 18px", fontSize: 11, color: "#94a3b8" }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString("fr-FR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={logPage} total={logs.length} pageSize={LOG_PAGE_SIZE} onChange={setLogPage} />
          </div>
        );
      })()}
    </div>
  );
}
