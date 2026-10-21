import { useEffect, useState, useCallback } from "react";
import { fetchTickets, assignTicketAgent, fetchAIResult, routeTicketByAI } from "../../api/tickets";
import { fetchUsers } from "../../api/users";
import AttachmentsList from "../../components/AttachmentsList";

const PAGE_SIZE = 10;

const COLORS = ["#2B45C8","#22D3A0","#F59E0B","#8B5CF6","#e53935","#0ea5e9","#10b981","#f97316"];
function initials(name) { return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2); }

function priorityMeta(p) {
  const s = (p || "").toLowerCase();
  if (s.includes("urgent") || s === "urgente") return { label: "Urgente", color: "#dc2626", bg: "#fee2e2" };
  if (s.includes("haut")   || s === "haute")   return { label: "Haute",   color: "#ea580c", bg: "#fff7ed" };
  if (s.includes("norm")   || s === "normale")  return { label: "Normale", color: "#2B45C8", bg: "#eff6ff" };
  if (s.includes("faible") || s.includes("low") || s.includes("basse")) return { label: "Faible", color: "#16a34a", bg: "#f0fdf4" };
  return { label: p || "—", color: "#64748b", bg: "#f1f5f9" };
}

function isUrgent(p) { const s=(p||"").toLowerCase(); return s.includes("urgent") || s==="urgente"; }
function isHigh(p)   { const s=(p||"").toLowerCase(); return s.includes("haut") || s==="haute"; }
function isNormal(p) { const s=(p||"").toLowerCase(); return s.includes("norm") || s==="normale"; }
function isLow(p)    { return !isUrgent(p) && !isHigh(p) && !isNormal(p); }

function waitLabel(createdAt) {
  if (!createdAt) return "—";
  const diff = Math.round((Date.now() - new Date(createdAt)) / 60000);
  if (diff < 60)   return `${diff} min`;
  if (diff < 1440) return `${Math.floor(diff/60)} h ${diff%60} min`;
  return `${Math.floor(diff/1440)} j`;
}

/* ── Pagination ── */
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

/* ── Assign Modal ── */
function AssignModal({ ticket, onClose, onAssigned }) {
  const [agents,        setAgents]        = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [search,        setSearch]        = useState("");
  const [suggestedAgent, setSuggestedAgent] = useState(null);

  useEffect(() => {
    // Charger les agents ET la suggestion IA en parallèle
    Promise.all([
      fetchUsers("", 0, 200),
      fetchAIResult(ticket.ticket_id).catch(() => null),
    ]).then(([users, aiResult]) => {
      const all       = users || [];
      const agentList = all.filter(u => (u.role || "").toUpperCase() === "AGENT");
      setAgents(agentList);
      if (aiResult?.suggested_agent) {
        setSuggestedAgent(aiResult.suggested_agent);
        // Pré-sélectionner l'agent suggéré
        setSelected(aiResult.suggested_agent.user_id);
      }
    })
    .catch(e => setError(e.message || "Erreur chargement agents"))
    .finally(() => setLoading(false));
  }, [ticket.ticket_id]);

  async function handleConfirm() {
    if (!selected) { setError("Veuillez sélectionner un agent."); return; }
    try {
      setSaving(true); setError("");
      await assignTicketAgent(ticket.ticket_id, selected);
      onAssigned(ticket.ticket_id);
      onClose();
    } catch (e) {
      setError(e.message || "Erreur lors de l'assignation");
    } finally {
      setSaving(false);
    }
  }

  const filtered = agents.filter(a =>
    !search || a.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, backdropFilter: "blur(2px)" }} />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 480, maxHeight: "80vh", background: "#fff", borderRadius: 18,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)", zIndex: 1001,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Assigner le ticket</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
              #{ticket.external_id || ticket.ticket_id} · {ticket.title?.slice(0, 50)}{ticket.title?.length > 50 ? "…" : ""}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <AttachmentsList ticketId={ticket.ticket_id} />

        {/* Search */}
        <div style={{ padding: "14px 24px", borderBottom: "1px solid #f8fafc" }}>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un agent…"
            style={{ width: "100%", height: 38, padding: "0 14px", border: "1.5px solid #e8ecf7", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "var(--font)", boxSizing: "border-box", background: "#fff", color: "#0f172a" }}
            onFocus={e => e.currentTarget.style.borderColor = "#2B45C8"}
            onBlur={e => e.currentTarget.style.borderColor = "#e8ecf7"}
            autoFocus
          />
        </div>

        {/* Agent list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>Chargement des agents…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>Aucun agent trouvé</div>
          ) : (
            <>
              {/* Agent suggéré par l'IA */}
              {suggestedAgent && !search && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, paddingLeft: 4 }}>
                    ⚡ Recommandé par l'IA — scoring multi-critères
                  </div>
                  {(() => {
                    const isActive = selected === suggestedAgent.user_id;
                    return (
                      <div onClick={() => setSelected(suggestedAgent.user_id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                          borderRadius: 10, cursor: "pointer",
                          background: isActive ? "#faf5ff" : "#faf5ff",
                          border: `2px solid ${isActive ? "#7c3aed" : "#e9d5ff"}`,
                          transition: "all .12s",
                        }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                          {initials(suggestedAgent.full_name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>{suggestedAgent.full_name}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{suggestedAgent.email}</div>
                        </div>
                        <span style={{ fontSize: 10, background: "#7c3aed", color: "#fff", borderRadius: 20, padding: "2px 8px", fontWeight: 700, flexShrink: 0 }}>
                          IA
                        </span>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isActive ? "#7c3aed" : "#c4b5fd"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }} />}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ borderTop: "1px dashed #e8ecf7", margin: "10px 0 6px" }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", paddingLeft: 4 }}>Tous les agents</div>
                </div>
              )}

              {/* Liste complète */}
              {filtered.map((agent, idx) => {
                const isActive = selected === agent.user_id;
                const isSuggested = suggestedAgent?.user_id === agent.user_id;
                return (
                  <div key={agent.user_id} onClick={() => setSelected(agent.user_id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                      borderRadius: 10, cursor: "pointer", marginBottom: 2,
                      background: isActive ? "#eff6ff" : "transparent",
                      border: `1.5px solid ${isActive ? "#2B45C8" : "transparent"}`,
                      transition: "all .12s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS[idx % COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {initials(agent.full_name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? "#2B45C8" : "#0f172a" }}>
                        {agent.full_name}
                        {isSuggested && <span style={{ marginLeft: 6, fontSize: 10, background: "#e9d5ff", color: "#7c3aed", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>IA</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{agent.email}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isActive ? "#2B45C8" : "#cbd5e1"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2B45C8" }} />}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9" }}>
          {error && <div style={{ fontSize: 12, color: "#e53935", marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} disabled={saving}
              style={{ height: 38, padding: "0 18px", borderRadius: 10, border: "1.5px solid #e8ecf7", background: "#fff", color: "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}>
              Annuler
            </button>
            <button onClick={handleConfirm} disabled={saving || !selected}
              style={{ height: 38, padding: "0 22px", borderRadius: 10, border: "none", background: saving || !selected ? "#94a3b8" : "#2B45C8", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving || !selected ? "not-allowed" : "pointer", fontFamily: "var(--font)" }}>
              {saving ? "Assignation…" : "Confirmer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main ── */
export default function SupervisorQueueContent({ onCountChange, searchQuery = "" }) {
  const [tickets,        setTickets]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [tab,            setTab]            = useState("tous");
  const [page,           setPage]           = useState(0);
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [routingId,       setRoutingId]       = useState(null);
  const [routingResult,   setRoutingResult]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchTickets({ status: "OPEN", limit: 200 })
      .then(data => {
        const list = data || [];
        setTickets(list);
        onCountChange?.(list.length);
      })
      .catch(e => setError(e.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleAssigned(ticketId) {
    setTickets(prev => prev.filter(t => t.ticket_id !== ticketId));
  }

  const q = searchQuery.toLowerCase().trim();
  const searched = q
    ? tickets.filter(t =>
        (t.title || "").toLowerCase().includes(q) ||
        String(t.external_id || t.ticket_id).includes(q) ||
        (t.requester_name || "").toLowerCase().includes(q) ||
        (t.site || "").toLowerCase().includes(q)
      )
    : tickets;

  const urgents = searched.filter(t => isUrgent(t.priority_label));
  const hauts   = searched.filter(t => isHigh(t.priority_label));
  const normaux = searched.filter(t => isNormal(t.priority_label));
  const bas     = searched.filter(t => isLow(t.priority_label));

  const displayed = tab === "urgents" ? urgents
                  : tab === "hauts"   ? hauts
                  : tab === "normaux" ? normaux
                  : tab === "bas"     ? bas
                  : searched;
  const paginated = displayed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function changeTab(key) { setTab(key); setPage(0); }

  const tabs = [
    { key: "tous",    label: "Tous",     count: searched.length, color: null },
    { key: "urgents", label: "Urgentes", count: urgents.length,  color: "#dc2626" },
    { key: "hauts",   label: "Hautes",   count: hauts.length,    color: "#ea580c" },
    { key: "normaux", label: "Normales", count: normaux.length,  color: "#2B45C8" },
    { key: "bas",     label: "Faibles",  count: bas.length,      color: "#16a34a" },
  ];

  return (
    <div className="adm-body">

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
          File d'attente — {loading ? "…" : `${tickets.length} ticket${tickets.length !== 1 ? "s" : ""} non assigné${tickets.length !== 1 ? "s" : ""}`}
        </div>
        {error && <div style={{ color: "#e53935", fontSize: 12, marginTop: 4 }}>{error}</div>}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #e8ecf7", borderRadius: 10, padding: 4, marginBottom: 16, width: "fit-content" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => changeTab(t.key)} style={{
            height: 32, padding: "0 14px", borderRadius: 7, border: "none",
            background: tab === t.key ? "#2B45C8" : "transparent",
            color: tab === t.key ? "#fff" : "#64748b",
            fontWeight: tab === t.key ? 700 : 500,
            fontSize: 13, cursor: "pointer", fontFamily: "var(--font)", transition: "all .15s",
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-card)", border: "1px solid #f0f2f9", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["ID", "SUJET", "DEMANDEUR", "SITE", "PRIORITÉ", "EN ATTENTE", ""].map((h, i) => (
                <th key={i} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", borderBottom: "1px solid #f1f5f9" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontSize: 13 }}>Chargement…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontSize: 13 }}>
                {tickets.length === 0 ? "Aucun ticket ouvert" : "Aucun ticket dans cette priorité"}
              </td></tr>
            ) : paginated.map(t => {
              const pm = priorityMeta(t.priority_label);
              return (
                <tr key={t.ticket_id}
                  style={{ borderBottom: "1px solid #f8fafc" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "13px 16px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#2B45C8" }}>
                    #{t.external_id || t.ticket_id}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#0f172a", fontWeight: 500, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b" }}>{t.requester_name || "—"}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b" }}>{t.site || "—"}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: pm.bg, color: pm.color }}>
                      {pm.label}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#64748b" }}>{waitLabel(t.created_at)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      {/* Bouton routage IA */}
                      <button
                        disabled={routingId === t.ticket_id}
                        onClick={async () => {
                          setRoutingId(t.ticket_id); setRoutingResult(null);
                          try {
                            const res = await routeTicketByAI(t.ticket_id);
                            setRoutingResult({ ticketId: t.ticket_id, ...res });
                            handleAssigned(t.ticket_id);
                          } catch(e) {
                            setRoutingResult({ ticketId: t.ticket_id, error: e.message });
                          } finally { setRoutingId(null); }
                        }}
                        style={{
                          height:32, padding:"0 10px", borderRadius:8,
                          border:"1.5px solid #7c3aed",
                          background: routingId===t.ticket_id ? "#f5f3ff" : "#7c3aed",
                          color: routingId===t.ticket_id ? "#7c3aed" : "#fff",
                          fontSize:11, fontWeight:700, cursor: routingId===t.ticket_id?"not-allowed":"pointer",
                          fontFamily:"var(--font)", display:"flex", alignItems:"center", gap:4,
                          transition:"all .15s", whiteSpace:"nowrap",
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        {routingId === t.ticket_id ? "…" : "IA"}
                      </button>
                      {/* Bouton assigner manuel */}
                      <button
                        onClick={() => setAssigningTicket(t)}
                        style={{
                          height:32, padding:"0 12px", borderRadius:8,
                          border:"1.5px solid #2B45C8",
                          background:"#2B45C8", color:"#fff",
                          fontSize:12, fontWeight:700, cursor:"pointer",
                          fontFamily:"var(--font)", display:"flex", alignItems:"center", gap:5,
                          transition:"all .15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background="#1e35a8"}
                        onMouseLeave={e => e.currentTarget.style.background="#2B45C8"}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                        Assigner
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <Pagination page={page} total={displayed.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* Toast résultat routage IA */}
      {routingResult && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          zIndex:9998, borderRadius:12, padding:"14px 20px",
          background: routingResult.error ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${routingResult.error ? "#fecaca" : "#bbf7d0"}`,
          boxShadow:"0 8px 32px rgba(0,0,0,0.12)",
          display:"flex", alignItems:"center", gap:12, minWidth:340,
          fontFamily:"var(--font)",
        }}>
          {routingResult.error ? (
            <>
              <span style={{ fontSize:18 }}>❌</span>
              <div>
                <div style={{ fontWeight:700, color:"#dc2626", fontSize:13 }}>Routage IA échoué</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>{routingResult.error}</div>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize:18 }}>✅</span>
              <div>
                <div style={{ fontWeight:700, color:"#16a34a", fontSize:13 }}>
                  Assigné par IA → {routingResult.assigned_to?.full_name}
                </div>
                <div style={{ fontSize:11, color:"#64748b" }}>
                  {routingResult.routing_details?.formula}
                </div>
              </div>
            </>
          )}
          <button onClick={() => setRoutingResult(null)}
            style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:18 }}>×</button>
        </div>
      )}

      {/* Assign Modal */}
      {assigningTicket && (
        <AssignModal
          ticket={assigningTicket}
          onClose={() => setAssigningTicket(null)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  );
}
