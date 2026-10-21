import { useEffect, useState } from "react";
import { fetchAtRiskTickets, fetchBreachedTickets } from "../../api/sla";
import { fetchAnomalousTickets } from "../../api/tickets";

const PAGE_SIZE = 8;

function priorityStyle(p) {
  const s = (p || "").toLowerCase();
  if (s === "urgente" || s.includes("urgent")) return { color: "#dc2626", bg: "#fee2e2" };
  if (s === "haute"   || s.includes("haut"))   return { color: "#ea580c", bg: "#fff7ed" };
  if (s === "normale" || s.includes("norm"))   return { color: "#2B45C8", bg: "#eff6ff" };
  return { color: "#16a34a", bg: "#f0fdf4" };
}

function ScoreBar({ score }) {
  const color = score >= 80 ? "#e53935" : score >= 60 ? "#F59E0B" : "#22D3A0";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, width: 34, textAlign: "right" }}>{score}%</span>
    </div>
  );
}

/* ── Pagination ── */
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

function TicketTable({ items, headerBg, headerBorder, emptyMsg, showExpired }) {
  const [page, setPage] = useState(0);
  const paginated = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const thStyle = {
    padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700,
    color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase",
    fontFamily: "var(--font-mono)", borderBottom: `1px solid ${headerBorder}`,
  };

  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: headerBg }}>
            {["ID", "Sujet", "Priorité", "Agent", "Temps écoulé", "Score IA", showExpired ? "Statut" : "SLA dans"].map((h, i) => (
              <th key={i} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "#94a3b8", fontSize: 13 }}>{emptyMsg}</td></tr>
          ) : paginated.map(t => {
            const ps = priorityStyle(t.priority);
            return (
              <tr key={t.ticket_id || t.id}
                style={{ borderBottom: "1px solid #f8fafc" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#2B45C8" }}>
                  #{t.external_id || t.ticket_id}
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#0f172a", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: ps.bg, color: ps.color }}>
                    {t.priority || "—"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "#334155" }}>
                  <div>{t.assignee || "Non assigné"}</div>
                  {t.assignee && t.assignee !== "—" && (
                    t.assignee_manually_updated
                      ? <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#eff6ff", color:"#2563eb" }}>👤 Manuel</span>
                      : <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#faf5ff", color:"#7c3aed" }}>🤖 IA</span>
                  )}
                </td>
                <td style={{ padding: "12px 16px", minWidth: 120 }} title="Basé sur le temps écoulé par rapport à l'échéance SLA">
                  <ScoreBar score={t.risk_score || 0} />
                </td>
                <td style={{ padding: "12px 16px", minWidth: 120 }} title="Prédit par IA (Gradient Boosting) à partir du texte du ticket">
                  {t.ml_risk_score == null ? (
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>
                  ) : (
                    <ScoreBar score={t.ml_risk_score} />
                  )}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {showExpired ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e53935" }}>Expiré</span>
                  ) : t.due_resolve_at ? (() => {
                    const diff = Math.max(0, Math.round((new Date(t.due_resolve_at) - Date.now()) / 60000));
                    const label = diff >= 60 ? `${Math.floor(diff/60)} h ${diff%60} min` : `${diff} min`;
                    const color = diff < 30 ? "#e53935" : diff < 120 ? "#F59E0B" : "#64748b";
                    return <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>;
                  })() : (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} total={items.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </>
  );
}

export default function SupervisorRiskContent({ onCountChange, searchQuery = "" }) {
  const [atRisk,    setAtRisk]    = useState([]);
  const [breached,  setBreached]  = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAtRiskTickets(), fetchBreachedTickets(), fetchAnomalousTickets()])
      .then(([r, b, a]) => {
        const risk = r || [], breach = b || [];
        setAtRisk(risk);
        setBreached(breach);
        setAnomalies(a || []);
        onCountChange?.(risk.length + breach.length);
      })
      .catch(e => setError(e.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const q = searchQuery.toLowerCase().trim();
  function applySearch(list) {
    if (!q) return list;
    return list.filter(t =>
      (t.title || "").toLowerCase().includes(q) ||
      String(t.external_id || t.ticket_id || "").includes(q) ||
      (t.assignee || "").toLowerCase().includes(q)
    );
  }

  const filteredRisk      = applySearch(atRisk);
  const filteredBreached  = applySearch(breached);
  const filteredAnomalies = applySearch(anomalies);
  const critical = atRisk.filter(t => (t.risk_score || 0) >= 80).length;

  return (
    <div className="adm-body">

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "À RISQUE",  value: loading ? "…" : atRisk.length,   color: "#F59E0B", bg: "#fffbeb", border: "#fde68a", icon: "⚠" },
          { label: "EXPIRÉS",   value: loading ? "…" : breached.length, color: "#e53935", bg: "#fef2f2", border: "#fecaca", icon: "✕" },
          { label: "CRITIQUES", value: loading ? "…" : critical,        color: "#e53935", bg: "#fef2f2", border: "#fecaca", icon: "🔴" },
        ].map(({ label, value, color, bg, border, icon }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "18px 22px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
              {icon} {label}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#e53935", padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* At risk table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", border: "1px solid #f0f2f9", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#F59E0B" }}>
            Tickets à risque SLA ({loading ? "…" : filteredRisk.length})
          </span>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
        ) : (
          <TicketTable items={filteredRisk} headerBg="#fffbeb" headerBorder="#fde68a" emptyMsg="Aucun ticket à risque SLA" showExpired={false} />
        )}
      </div>

      {/* Breached table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", border: "1px solid #f0f2f9", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e53935", display: "inline-block" }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e53935" }}>
            SLA expirés ({loading ? "…" : filteredBreached.length})
          </span>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
        ) : (
          <TicketTable items={filteredBreached} headerBg="#fef2f2" headerBorder="#fecaca" emptyMsg="Aucun SLA expiré" showExpired={true} />
        )}
      </div>

      {/* Anomalies table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", border: "1px solid #f0f2f9", overflow: "hidden", marginTop: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: "#7c3aed" }}>
              Tickets atypiques ({loading ? "…" : filteredAnomalies.length})
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4, marginLeft: 18 }}>
            Détectés par IA (Isolation Forest) comme inhabituels par rapport à l'historique — à passer en revue, pas nécessairement urgents.
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontSize: 13 }}>Chargement…</div>
        ) : filteredAnomalies.length === 0 ? (
          <div style={{ textAlign: "center", padding: 28, color: "#94a3b8", fontSize: 13 }}>Aucun ticket atypique détecté</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#faf5ff" }}>
                {["ID", "Sujet", "Catégorie", "Priorité", "Statut"].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1.5px solid #e9d5ff" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.map(t => (
                <tr key={t.ticket_id} style={{ borderBottom: "1px solid #f8fafc" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>
                    #{t.external_id || t.ticket_id}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#0f172a", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#334155" }}>{t.category || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#334155" }}>{t.priority || "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#334155" }}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
