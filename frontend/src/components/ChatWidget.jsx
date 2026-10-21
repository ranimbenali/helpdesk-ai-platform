import { useState, useRef, useEffect } from "react";
import { API_BASE } from '../api/config.js';
function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

/* ── Icons ── */
function IconBot() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
      <line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function IconMinus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

/* ── Status helpers ── */
const STATUS_FR = { OPEN:"Ouvert", IN_PROGRESS:"En cours", PENDING:"En attente", RESOLVED:"Résolu", CLOSED:"Fermé", CANCELLED:"Annulé" };
const STATUS_COLOR = { OPEN:"#f59e0b", IN_PROGRESS:"#2563eb", PENDING:"#7c3aed", RESOLVED:"#16a34a", CLOSED:"#64748b", CANCELLED:"#94a3b8" };
const STATUS_BG    = { OPEN:"#fffbeb", IN_PROGRESS:"#eff6ff", PENDING:"#faf5ff", RESOLVED:"#f0fdf4", CLOSED:"#f8fafc", CANCELLED:"#f8fafc" };
const PRIO_COLOR   = { Urgente:"#dc2626", Haute:"#ea580c", Normale:"#2563eb", Faible:"#16a34a" };
const PRIO_BG      = { Urgente:"#fee2e2", Haute:"#fff7ed", Normale:"#eff6ff", Faible:"#f0fdf4" };

/* ── Action card renderers ── */
function ActionCard({ action }) {
  const { tool, result } = action;

  if (tool === "search_tickets") {
    if (result.error) return <ErrorCard msg={result.error} />;
    const tickets = result.tickets || [];
    return (
      <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px", marginBottom:6, border:"1px solid #e8ecf7" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#7c3aed", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
          <span>📋</span> {result.count} ticket{result.count !== 1 ? "s" : ""} trouvé{result.count !== 1 ? "s" : ""}
        </div>
        {tickets.length === 0
          ? <div style={{ fontSize:12, color:"#94a3b8" }}>Aucun résultat</div>
          : tickets.map(t => (
            <div key={t.id} style={{ background:"#fff", borderRadius:8, padding:"7px 10px", marginBottom:5,
              border:"1px solid #f0f4ff", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontFamily:"monospace", fontSize:11, color:"#94a3b8", flexShrink:0 }}>#{t.id}</span>
              <span style={{ fontSize:12, fontWeight:600, color:"#0f172a", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</span>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20,
                background: STATUS_BG[t.status] || "#f1f5f9", color: STATUS_COLOR[t.status] || "#64748b", flexShrink:0 }}>
                {STATUS_FR[t.status] || t.status}
              </span>
              {t.priority && t.priority !== "—" && (
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:20,
                  background: PRIO_BG[t.priority] || "#f1f5f9", color: PRIO_COLOR[t.priority] || "#64748b", flexShrink:0 }}>
                  {t.priority}
                </span>
              )}
            </div>
          ))
        }
      </div>
    );
  }

  if (tool === "get_ticket_detail") {
    if (result.error) return <ErrorCard msg={result.error} />;
    return (
      <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px", marginBottom:6, border:"1px solid #e8ecf7" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#2563eb", marginBottom:8 }}>🎫 Ticket #{result.id}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
          {[
            { label:"Titre",       value: result.title },
            { label:"Statut",      value: STATUS_FR[result.status] || result.status },
            { label:"Priorité",    value: result.priority },
            { label:"Assigné à",   value: result.assignee },
            { label:"Demandeur",   value: result.requester },
            { label:"Catégorie",   value: result.category },
          ].map(({ label, value }) => (
            <div key={label} style={{ background:"#fff", borderRadius:7, padding:"5px 8px", border:"1px solid #f0f4ff" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
              <div style={{ fontSize:12, fontWeight:600, color:"#0f172a", marginTop:1 }}>{value || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tool === "update_ticket_status") {
    if (result.error) return <ErrorCard msg={result.error} />;
    const statusLabel = STATUS_FR[result.new_status] || result.new_status;
    const isResolved = result.new_status === "RESOLVED" || result.new_status === "CLOSED";
    return (
      <div style={{ background: isResolved ? "#f0fdf4" : "#eff6ff", borderRadius:10, padding:"10px 14px",
        marginBottom:6, border:`1px solid ${isResolved ? "#bbf7d0" : "#bfdbfe"}`,
        display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>{isResolved ? "✅" : "🔄"}</span>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color: isResolved ? "#16a34a" : "#2563eb" }}>
            Statut mis à jour
          </div>
          <div style={{ fontSize:11, color:"#64748b" }}>
            Ticket #{result.ticket_id} · {STATUS_FR[result.old_status] || result.old_status} → <strong>{statusLabel}</strong>
          </div>
        </div>
      </div>
    );
  }

  if (tool === "assign_ticket") {
    if (result.error) return <ErrorCard msg={result.error} />;
    return (
      <div style={{ background:"#faf5ff", borderRadius:10, padding:"10px 14px", marginBottom:6,
        border:"1px solid #e9d5ff", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>👤</span>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#7c3aed" }}>Ticket assigné</div>
          <div style={{ fontSize:11, color:"#64748b" }}>
            Ticket #{result.ticket_id} → <strong>{result.assigned_to}</strong>
          </div>
        </div>
      </div>
    );
  }

  if (tool === "get_stats") {
    if (result.error) return <ErrorCard msg={result.error} />;
    const bs = result.by_status || {};
    const bp = result.by_priority || {};
    return (
      <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px", marginBottom:6, border:"1px solid #e8ecf7" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#0f172a", marginBottom:8 }}>📊 Statistiques plateforme</div>
        <div style={{ fontSize:13, fontWeight:800, color:"#2B45C8", marginBottom:6 }}>{result.total} tickets au total</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6 }}>
          {Object.entries(bs).map(([s, n]) => (
            <span key={s} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
              background: STATUS_BG[s] || "#f1f5f9", color: STATUS_COLOR[s] || "#64748b" }}>
              {STATUS_FR[s] || s}: {n}
            </span>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {Object.entries(bp).filter(([p]) => p).map(([p, n]) => (
            <span key={p} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
              background: PRIO_BG[p] || "#f1f5f9", color: PRIO_COLOR[p] || "#64748b" }}>
              {p}: {n}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (tool === "create_ticket") {
    if (result.error) return <ErrorCard msg={result.error} />;
    return (
      <div style={{ background:"#f0fdf4", borderRadius:10, padding:"10px 14px", marginBottom:6,
        border:"1px solid #bbf7d0", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🎫</span>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:"#16a34a" }}>Ticket créé !</div>
          <div style={{ fontSize:11, color:"#64748b" }}>#{result.ticket_id} · {result.title} · {result.priority}</div>
        </div>
      </div>
    );
  }

  return null;
}

function ErrorCard({ msg }) {
  return (
    <div style={{ background:"#fef2f2", borderRadius:8, padding:"7px 10px", marginBottom:6,
      border:"1px solid #fecaca", fontSize:12, color:"#dc2626" }}>
      ⚠️ {msg}
    </div>
  );
}

/* ── Suggestions par rôle ── */
const SUGGESTIONS_BY_ROLE = {
  AGENT: [
    "Montre mes tickets ouverts",
    "Combien de tickets j'ai en cours ?",
    "Tickets urgents assignés à moi",
    "Passe le ticket #2688 en résolu",
  ],
  SUPERVISOR: [
    "Statistiques globales",
    "Tickets urgents non assignés",
    "Assigne le ticket #2688 à ranim",
    "Montre les tickets en cours",
  ],
  ADMIN: [
    "Statistiques globales",
    "Tickets ouverts urgents",
    "Montre les tickets résolus",
    "Combien de tickets aujourd'hui ?",
  ],
  REQUESTER: [
    "Voir mes tickets",
    "Créer un ticket : mon PC ne démarre plus",
    "Statut de mon ticket #2688",
    "Problème de connexion VPN",
  ],
};

/* ── Main component ── */
export default function ChatWidget({ userRole }) {
  const [open,      setOpen]      = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages,  setMessages]  = useState([
    { role: "assistant", content: "Bonjour ! Je suis l'Assistant IA Helpdesk GEISER.\nJe peux rechercher des tickets, changer des statuts, afficher des statistiques et bien plus encore.\nQue puis-je faire pour vous ?" }
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const suggestions = SUGGESTIONS_BY_ROLE[userRole] || SUGGESTIONS_BY_ROLE.AGENT;

  useEffect(() => {
    if (open && !minimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open, minimized]);

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg = { role: "user", content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const history = updated.slice(0, -1)
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API_BASE}/ai/agentic-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Erreur");

      setMessages(prev => [...prev, {
        role:    "assistant",
        content: data.reply,
        actions: data.actions || [],
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role:    "assistant",
        content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
        error:   true,
        actions: [],
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function clearChat() {
    setMessages([{
      role: "assistant",
      content: "Bonjour ! Je suis l'Assistant IA Helpdesk GEISER.\nJe peux rechercher des tickets, changer des statuts, afficher des statistiques et bien plus encore.\nQue puis-je faire pour vous ?"
    }]);
  }

  return (
    <>
      {/* ── Floating button ── */}
      {!open && (
        <button onClick={() => { setOpen(true); setMinimized(false); }}
          style={{
            position:"fixed", bottom:24, right:24, zIndex:9999,
            display:"flex", alignItems:"center", gap:10,
            background:"#0f172a", color:"#fff",
            border:"none", borderRadius:50, cursor:"pointer",
            padding:"10px 18px 10px 14px",
            boxShadow:"0 4px 24px rgba(0,0,0,0.25)",
            fontFamily:"var(--font,'Plus Jakarta Sans',sans-serif)",
            fontSize:14, fontWeight:600, transition:"transform .15s, box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform="scale(1.04)"; e.currentTarget.style.boxShadow="0 8px 32px rgba(0,0,0,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,0.25)"; }}
        >
          <span style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#22D3A0", boxShadow:"0 0 6px #22D3A0", flexShrink:0 }} />
            Assistant IA
          </span>
          <span style={{ width:34, height:34, borderRadius:"50%", background:"#2B45C8",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <IconBot />
          </span>
        </button>
      )}

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          position:"fixed", bottom:24, right:24, zIndex:9999,
          width:400, borderRadius:20, background:"#fff",
          boxShadow:"0 16px 64px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
          display:"flex", flexDirection:"column", overflow:"hidden",
          maxHeight: minimized ? "auto" : 580,
          transition:"max-height .25s ease",
          fontFamily:"var(--font,'Plus Jakarta Sans',sans-serif)",
        }}>

          {/* Header */}
          <div style={{ background:"linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
            padding:"14px 18px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:"#2B45C8",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <IconBot />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>Assistant IA</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:1 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:"#22D3A0", boxShadow:"0 0 4px #22D3A0" }} />
                <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11 }}>Helpdesk GEISER · Agentique</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={clearChat} title="Nouvelle conversation"
                style={{ width:28, height:28, borderRadius:8, border:"none",
                  background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)",
                  cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
              >↺</button>
              <button onClick={() => setMinimized(v => !v)} title={minimized ? "Agrandir" : "Réduire"}
                style={{ width:28, height:28, borderRadius:8, border:"none",
                  background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.2)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
              ><IconMinus /></button>
              <button onClick={() => setOpen(false)} title="Fermer"
                style={{ width:28, height:28, borderRadius:8, border:"none",
                  background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.7)",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.3)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
              ><IconClose /></button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div style={{ flex:1, overflowY:"auto", padding:"14px 12px",
                display:"flex", flexDirection:"column", gap:10,
                background:"#f8fafc", minHeight:0, maxHeight:400 }}>

                {messages.map((m, i) => (
                  <div key={i}>
                    {/* Action cards (above assistant text) */}
                    {m.role === "assistant" && m.actions?.length > 0 && (
                      <div style={{ marginBottom:6, paddingLeft:36 }}>
                        {m.actions.map((a, j) => <ActionCard key={j} action={a} />)}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div style={{ display:"flex",
                      flexDirection: m.role === "user" ? "row-reverse" : "row",
                      alignItems:"flex-end", gap:8 }}>
                      {m.role === "assistant" && (
                        <div style={{ width:28, height:28, borderRadius:"50%", background:"#2B45C8",
                          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
                          </svg>
                        </div>
                      )}
                      {m.content && (
                        <div style={{
                          maxWidth:"80%", padding:"10px 14px",
                          borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: m.role === "user" ? "#2B45C8" : m.error ? "#fef2f2" : "#fff",
                          color: m.role === "user" ? "#fff" : m.error ? "#dc2626" : "#0f172a",
                          fontSize:13, lineHeight:1.55,
                          boxShadow:"0 1px 4px rgba(0,0,0,0.08)",
                          whiteSpace:"pre-wrap", wordBreak:"break-word",
                        }}>
                          {m.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing */}
                {loading && (
                  <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:"#2B45C8",
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/>
                      </svg>
                    </div>
                    <div style={{ padding:"12px 16px", background:"#fff", borderRadius:"18px 18px 18px 4px",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.08)", display:"flex", gap:4, alignItems:"center" }}>
                      {[0,1,2].map(i => (
                        <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#94a3b8",
                          display:"inline-block",
                          animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions (premier message seulement) */}
              {messages.length === 1 && (
                <div style={{ padding:"8px 12px", borderTop:"1px solid #f1f5f9",
                  display:"flex", flexWrap:"wrap", gap:6, background:"#fff" }}>
                  {suggestions.map(s => (
                    <button key={s} onClick={() => sendMessage(s)}
                      style={{ padding:"5px 12px", borderRadius:20, border:"1.5px solid #e8ecf7",
                        background:"#fff", color:"#334155", fontSize:11, fontWeight:600,
                        cursor:"pointer", fontFamily:"inherit", transition:"all .15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background="#eff6ff"; e.currentTarget.style.borderColor="#2B45C8"; e.currentTarget.style.color="#2B45C8"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="#fff";    e.currentTarget.style.borderColor="#e8ecf7"; e.currentTarget.style.color="#334155"; }}
                    >{s}</button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{ padding:"12px 14px", borderTop:"1px solid #f1f5f9",
                background:"#fff", display:"flex", gap:8, alignItems:"flex-end" }}>
                <textarea ref={inputRef} rows={1} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ex : Montre mes tickets urgents..."
                  disabled={loading}
                  style={{ flex:1, resize:"none", border:"1.5px solid #e8ecf7",
                    borderRadius:12, padding:"9px 14px",
                    fontSize:13, fontFamily:"inherit", outline:"none",
                    background:"#f8fafc", color:"#0f172a",
                    maxHeight:80, overflowY:"auto", lineHeight:1.5,
                    transition:"border-color .15s" }}
                  onFocus={e => e.currentTarget.style.borderColor="#2B45C8"}
                  onBlur={e  => e.currentTarget.style.borderColor="#e8ecf7"}
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  style={{ width:38, height:38, borderRadius:10, border:"none", flexShrink:0,
                    background: loading || !input.trim() ? "#e8ecf7" : "#2B45C8",
                    color: loading || !input.trim() ? "#94a3b8" : "#fff",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                    transition:"all .15s" }}>
                  <IconSend />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}
