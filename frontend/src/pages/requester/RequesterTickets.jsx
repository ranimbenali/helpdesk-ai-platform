import { useState, useEffect, useRef } from "react";
import { fetchMyRequests, fetchTicketDetail, fetchTicketMessages, createTicketMessage, updateTicketStatus } from "../../api/tickets";
import AttachmentsList from "../../components/AttachmentsList";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

const STATUS_FR    = { OPEN:"Ouvert", IN_PROGRESS:"En cours", PENDING:"En attente", RESOLVED:"Résolu", CLOSED:"Fermé" };
const STATUS_DOT   = { OPEN:"#2563eb", IN_PROGRESS:"#2B45C8", PENDING:"#f97316", RESOLVED:"#22c55e", CLOSED:"#94a3b8" };
const STATUS_BG    = { OPEN:"#eff6ff", IN_PROGRESS:"#eff6ff", PENDING:"#fff7ed", RESOLVED:"#f0fdf4", CLOSED:"#f8fafc" };
const PRIO_BG      = { Urgente:"#fef2f2", Haute:"#fef2f2", Normale:"#f1f5f9", Basse:"#f8fafc", Faible:"#f8fafc" };
const PRIO_COLOR   = { Urgente:"#dc2626", Haute:"#f97316", Normale:"#64748b", Basse:"#94a3b8", Faible:"#94a3b8" };

function timeAgo(d) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 3600)   return "Il y a " + Math.floor(s/60) + " min";
  if (s < 86400)  return "Il y a " + Math.floor(s/3600) + " h";
  if (s < 604800) return "Il y a " + Math.floor(s/86400) + " j";
  return "Il y a " + Math.floor(s/604800) + " sem";
}

function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}

export default function RequesterTickets({ user, onNavigate, onTitleChange, searchQuery = "" }) {
  const [tickets,    setTickets]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("tous");
  const [detail,     setDetail]     = useState(null);
  const [detLoading, setDetLoading] = useState(false);

  /* ── Chat state ── */
  const [chat,     setChat]     = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoad,  setMsgLoad]  = useState(false);
  const [msgText,  setMsgText]  = useState("");
  const [sending,  setSending]  = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const endRef   = useRef(null);
  const pollRef  = useRef(null);
  const knownIds = useRef(new Set());

  useEffect(() => {
    fetchMyRequests({ limit:100 })
      .then(data => {
        setTickets(data);
        const actifs  = data.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "PENDING").length;
        const resolus = data.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length;
        onTitleChange?.(`Mes tickets (${actifs} actif${actifs > 1 ? "s" : ""} · ${resolus} résolu${resolus > 1 ? "s" : ""})`);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function openDetail(ticket) {
    setDetail({ ...ticket, _loading: true });
    setDetLoading(true);
    try {
      const full = await fetchTicketDetail(ticket.ticket_id);
      setDetail(full);
    } catch {
      setDetail(ticket);
    } finally {
      setDetLoading(false);
    }
  }

  async function handleConfirm(ticketId, action) {
    if (confirmingId) return;
    setConfirmingId(ticketId);
    try {
      const newStatus = action === "close" ? "CLOSED" : "OPEN";
      await updateTicketStatus(ticketId, newStatus);
      setTickets(prev => prev.map(t => t.ticket_id === ticketId ? { ...t, status: newStatus } : t));
      setChat(prev => prev?.ticket_id === ticketId ? { ...prev, status: newStatus } : prev);
      if (action === "close" && chat?.ticket_id === ticketId) closeChat();
    } catch { /* ignore */ }
    finally { setConfirmingId(null); }
  }

  function openChat(ticket) {
    if (pollRef.current) clearInterval(pollRef.current);
    knownIds.current = new Set();
    setChat(ticket);
    setMessages([]);
    setMsgLoad(true);

    async function fetchAndMerge(tid) {
      try {
        const data = await fetchTicketMessages(tid);
        const items = data.items || [];
        const newOnes = items.filter(m => !knownIds.current.has(m.message_id));
        if (newOnes.length > 0) {
          newOnes.forEach(m => knownIds.current.add(m.message_id));
          setMessages(items);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
        }
      } catch { /* ignore */ }
      setMsgLoad(false);
    }

    fetchAndMerge(ticket.ticket_id);
    pollRef.current = setInterval(() => fetchAndMerge(ticket.ticket_id), 3000);
  }

  function closeChat() {
    if (pollRef.current) clearInterval(pollRef.current);
    setChat(null);
    setMessages([]);
    setMsgText("");
  }

  async function sendMessage() {
    if (!msgText.trim() || !chat || sending) return;
    const content = msgText.trim();
    setMsgText("");
    setSending(true);
    try {
      const msg = await createTicketMessage(chat.ticket_id, { content, is_internal: false });
      setMessages(prev => [...prev, msg]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    } catch { setMsgText(content); }
    finally { setSending(false); }
  }

  const myName = user?.full_name || "";

  const counts = {
    encours:  tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
    attente:  tickets.filter(t => t.status === "PENDING").length,
    resolus:  tickets.filter(t => t.status === "RESOLVED").length,
    fermes:   tickets.filter(t => t.status === "CLOSED").length,
  };

  const filtered = tickets.filter(t => {
    if (tab === "encours" && t.status !== "OPEN" && t.status !== "IN_PROGRESS") return false;
    if (tab === "attente" && t.status !== "PENDING")                             return false;
    if (tab === "resolus" && t.status !== "RESOLVED")                            return false;
    if (tab === "fermes"  && t.status !== "CLOSED")                              return false;
    if (searchQuery && !t.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id:"tous",    label:`Tous (${tickets.length})` },
    { id:"encours", label:`En cours (${counts.encours})` },
    { id:"attente", label:`En attente (${counts.attente})` },
    { id:"resolus", label:`Résolus (${counts.resolus})` },
    { id:"fermes",  label:`Fermés (${counts.fermes})` },
  ];

  return (
    <div className="adm-body">
      {/* Tabs + filters */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:12, padding:3, gap:2, flexWrap:"wrap" }}>
          {tabs.map(t => (
            <button type="button" key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"7px 14px", borderRadius:9, border:"none", cursor:"pointer",
              fontSize:12.5, fontWeight: tab===t.id ? 700 : 500,
              background: tab===t.id ? "#fff" : "transparent",
              color: tab===t.id ? "#1e40af" : "#64748b",
              boxShadow: tab===t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={card}>
        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:"#94a3b8" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
            {tickets.length === 0
              ? <><span>Aucun ticket. </span><button type="button" onClick={() => onNavigate("new")} style={{ color:"#2B45C8", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>Créer le premier →</button></>
              : "Aucun ticket dans cette catégorie."}
          </div>
        ) : filtered.map((t, i) => (
          <div key={t.ticket_id} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 20px", borderBottom: i < filtered.length-1 ? "1px solid #f8fafc" : "none", cursor:"pointer" }}
            onClick={() => openDetail(t)}
            onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {/* Status icon */}
            <div style={{ width:36, height:36, borderRadius:10, background:STATUS_BG[t.status]||"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {t.status === "RESOLVED" || t.status === "CLOSED"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : t.status === "PENDING"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8" }}>#{t.ticket_id}</span>
                <span style={{ fontSize:11.5, fontWeight:700, display:"flex", alignItems:"center", gap:3, color:STATUS_DOT[t.status]||"#64748b" }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:STATUS_DOT[t.status] }} />
                  {STATUS_FR[t.status] || t.status}
                </span>
                {t.category && <span style={{ fontSize:11, color:"#94a3b8" }}>· {t.category}</span>}
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:"#0f172a" }}>{t.title}</div>
              <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:2 }}>
                Ouvert {timeAgo(t.created_at)}
              </div>
            </div>
            {t.status === "RESOLVED" ? (
              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }} onClick={e => e.stopPropagation()}>
                <button type="button"
                  disabled={confirmingId === t.ticket_id}
                  onClick={() => handleConfirm(t.ticket_id, "close")}
                  style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"#16a34a", color:"#fff", fontWeight:700, fontSize:12, cursor: confirmingId === t.ticket_id ? "not-allowed" : "pointer", whiteSpace:"nowrap", opacity: confirmingId === t.ticket_id ? 0.6 : 1 }}>
                  ✓ Résolu
                </button>
                <button type="button"
                  disabled={confirmingId === t.ticket_id}
                  onClick={() => handleConfirm(t.ticket_id, "reopen")}
                  style={{ padding:"6px 12px", borderRadius:8, border:"1.5px solid #d1d5db", background:"#fff", color:"#374151", fontWeight:600, fontSize:12, cursor: confirmingId === t.ticket_id ? "not-allowed" : "pointer", whiteSpace:"nowrap", opacity: confirmingId === t.ticket_id ? 0.6 : 1 }}>
                  ↩ Rouvrir
                </button>
              </div>
            ) : (
              <button type="button" onClick={e => { e.stopPropagation(); openDetail(t); }}
                style={{ padding:"6px 14px", border:"1.5px solid #e8ecf7", borderRadius:8, background:"#fff", color:"#2B45C8", fontWeight:700, fontSize:12.5, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                Voir →
              </button>
            )}
            <button type="button" onClick={e => { e.stopPropagation(); openChat(t); }}
              style={{ padding:"5px 12px", border:"1.5px solid #e8ecf7", borderRadius:8, background:"#fff", color:"#2B45C8", fontWeight:600, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", flexShrink:0 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Messages
            </button>
            <span style={{ color:"#cbd5e1", fontSize:18, flexShrink:0 }}>›</span>
          </div>
        ))}
      </div>

      {/* ── Ticket detail modal ── */}
      {detail && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={() => setDetail(null)}>
          <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:640, maxHeight:"85vh", overflow:"auto", boxShadow:"0 16px 48px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#94a3b8" }}>#{detail.ticket_id}</span>
                  <span style={{ fontSize:12, fontWeight:700, padding:"2px 9px", borderRadius:20, background:STATUS_BG[detail.status]||"#f1f5f9", color:STATUS_DOT[detail.status]||"#64748b", display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:STATUS_DOT[detail.status] }} />
                    {STATUS_FR[detail.status] || detail.status}
                  </span>
                </div>
                <h2 style={{ fontSize:17, fontWeight:800, color:"#0f172a", margin:0, lineHeight:1.4 }}>{detail.title}</h2>
              </div>
              <button type="button" onClick={() => setDetail(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:22, lineHeight:1, flexShrink:0, padding:0 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding:"20px 24px" }}>
              {detLoading ? (
                <div style={{ color:"#94a3b8", textAlign:"center", padding:24 }}>Chargement…</div>
              ) : (
                <>
                  {/* Meta */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
                    {[
                      { label:"Catégorie",      value: detail.category || "—" },
                      { label:"Sous-catégorie", value: detail.subcategory || "—" },
                      { label:"Ouvert le",      value: detail.created_at ? new Date(detail.created_at).toLocaleString("fr-FR", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—" },
                      { label:"Mis à jour",     value: detail.updated_at ? new Date(detail.updated_at).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—" },
                      { label:"Résolu le",      value: detail.resolved_at ? new Date(detail.resolved_at).toLocaleString("fr-FR", { day:"2-digit", month:"long", year:"numeric" }) : "—" },
                    ].map(f => (
                      <div key={f.label} style={{ padding:"10px 12px", background:"#f8fafc", borderRadius:10, border:"1px solid #f0f4ff" }}>
                        <div style={{ fontSize:10.5, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{f.label}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {(detail.description_text || detail.description) && (
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Description</div>
                      <div style={{ fontSize:13.5, color:"#334155", lineHeight:1.75, background:"#f8fafc", borderRadius:10, padding:"14px 16px", border:"1px solid #f0f4ff" }}
                        dangerouslySetInnerHTML={{ __html: detail.description_text || detail.description }} />
                    </div>
                  )}
                </>
              )}
            </div>

            <AttachmentsList ticketId={detail?.ticket_id} style={{ borderTop:"1px solid #f1f5f9", borderBottom:"none" }} />

            {/* Footer */}
            <div style={{ padding:"14px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end" }}>
              <button type="button" onClick={() => setDetail(null)}
                style={{ padding:"8px 20px", border:"1.5px solid #e8ecf7", borderRadius:10, background:"#fff", color:"#374151", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat modal ── */}
      {chat && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={() => closeChat()}>
          <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:560, height:560, display:"flex", flexDirection:"column", boxShadow:"0 16px 48px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8" }}>#{chat.ticket_id} · {chat.assignee_name ? "Agent assigné" : "En attente d'assignation"}</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{chat.title}</div>
              </div>
              <button type="button" onClick={() => closeChat()} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:22, padding:0 }}>×</button>
            </div>
            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
              {msgLoad ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:24 }}>Chargement…</div>
              ) : messages.filter(m => !m.is_internal).length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:24 }}>Aucun message. Envoyez le premier message à votre agent !</div>
              ) : messages.filter(m => !m.is_internal).map(m => {
                const isMe = myName ? m.author_name === myName : m.author_name === chat.requester_name;
                return (
                  <div key={m.message_id} style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth:"70%", padding:"9px 13px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isMe ? "#1E3AAF" : "#f8fafc", color: isMe ? "#fff" : "#0f172a", fontSize:13, lineHeight:1.6, border: isMe ? "none" : "1px solid #f0f4ff" }}>
                      {!isMe && <div style={{ fontSize:11, fontWeight:700, color:"#64748b", marginBottom:3 }}>{m.author_name}</div>}
                      {m.content}
                      <div style={{ fontSize:10, marginTop:3, opacity:0.6, textAlign:"right" }}>{formatTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Bannière de confirmation — hors zone messages */}
            {chat.status === "RESOLVED" && (
              <div style={{ padding:"16px", borderTop:"1px solid #d1fae5", background:"#f0fdf4" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize:13, fontWeight:700, color:"#16a34a" }}>Ce ticket a été marqué comme résolu.</span>
                </div>
                <div style={{ fontSize:12.5, color:"#374151", marginBottom:12 }}>Votre problème est-il bien résolu ?</div>
                <div style={{ display:"flex", gap:8 }}>
                  <button type="button" disabled={!!confirmingId} onClick={() => handleConfirm(chat.ticket_id, "close")}
                    style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", background:"#16a34a", color:"#fff", fontWeight:700, fontSize:13, cursor: confirming ? "not-allowed" : "pointer" }}>
                    ✓ Oui, tout fonctionne
                  </button>
                  <button type="button" disabled={!!confirmingId} onClick={() => handleConfirm(chat.ticket_id, "reopen")}
                    style={{ flex:1, padding:"9px 0", borderRadius:9, border:"1.5px solid #d1d5db", background:"#fff", color:"#374151", fontWeight:600, fontSize:13, cursor: confirming ? "not-allowed" : "pointer" }}>
                    ↩ Non, rouvrir
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div style={{ padding:"12px 16px", borderTop:"1px solid #f1f5f9" }}>
              {chat.status === "CLOSED" ? (
                <div style={{ textAlign:"center", fontSize:12.5, color:"#94a3b8", padding:"8px 0" }}>
                  Ticket fermé — conversation archivée.
                </div>
              ) : chat.status !== "RESOLVED" && (
                <div style={{ display:"flex", gap:10, background:"#f8fafc", border:"1.5px solid #e8ecf7", borderRadius:12, padding:"8px 14px", alignItems:"flex-end" }}>
                  <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Répondre à l'agent… (Entrée pour envoyer)"
                    rows={1}
                    style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:13, color:"#0f172a", resize:"none", fontFamily:"inherit", lineHeight:1.6, maxHeight:100, overflowY:"auto" }} />
                  <button type="button" onClick={sendMessage} disabled={!msgText.trim() || sending}
                    style={{ width:34, height:34, borderRadius:"50%", border:"none", cursor: msgText.trim() ? "pointer" : "not-allowed", background: msgText.trim() ? "#1E3AAF" : "#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={msgText.trim() ? "#fff" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
