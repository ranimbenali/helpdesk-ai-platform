import { useState, useEffect, useRef } from "react";
import { fetchMyRequests, fetchTicketMessages, createTicketMessage, updateTicketStatus } from "../../api/tickets";

const STATUS_FR    = { OPEN:"Ouvert", IN_PROGRESS:"En cours", PENDING:"En attente", RESOLVED:"Résolu", CLOSED:"Fermé" };
const STATUS_DOT   = { OPEN:"#2563eb", IN_PROGRESS:"#2B45C8", PENDING:"#f97316", RESOLVED:"#22c55e", CLOSED:"#94a3b8" };

function timeAgo(d) {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "À l'instant";
  if (s < 3600)  return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short" });
}

function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
}

function avatarColor(name) {
  const colors = ["#2B45C8","#22c55e","#f97316","#8B5CF6","#0ea5e9","#dc2626","#f59e0b"];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function RequesterConversations({ user }) {
  const [tickets,    setTickets]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [text,       setText]       = useState("");
  const [sending,    setSending]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const knownIdsRef    = useRef(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const all = await fetchMyRequests({ limit: 100 });
        if (cancelled) return;

        const results = await Promise.allSettled(
          all.map(t => fetchTicketMessages(t.ticket_id))
        );
        if (cancelled) return;

        const withMessages = all.filter((_, i) => {
          const r = results[i];
          if (r.status !== "fulfilled") return false;
          return (r.value?.items || []).some(m => !m.is_internal);
        });

        setTickets(withMessages);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Chargement initial + polling toutes les 3s ── */
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;

    knownIdsRef.current = new Set();
    setMsgLoading(true);

    async function fetchAndMerge() {
      try {
        const data = await fetchTicketMessages(selected.ticket_id);
        const items = data.items || [];
        const newOnes = items.filter(m => !knownIdsRef.current.has(m.message_id));
        if (newOnes.length > 0) {
          newOnes.forEach(m => knownIdsRef.current.add(m.message_id));
          setMessages(items);  // replace complet pour garder l'ordre
        }
      } catch { /* ignore */ }
      setMsgLoading(false);
    }

    fetchAndMerge();
    pollRef.current = setInterval(fetchAndMerge, 3000);

    return () => clearInterval(pollRef.current);
  }, [selected?.ticket_id]);

  /* scroll vers le bas sur nouveaux messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !selected || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      const msg = await createTicketMessage(selected.ticket_id, { content, is_internal: false });
      setMessages(prev => [...prev, msg]);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleConfirm(action) {
    if (!selected || confirming) return;
    setConfirming(true);
    try {
      const newStatus = action === "close" ? "CLOSED" : "OPEN";
      await updateTicketStatus(selected.ticket_id, newStatus);
      setSelected(prev => ({ ...prev, status: newStatus }));
      setTickets(prev => prev.map(t =>
        t.ticket_id === selected.ticket_id ? { ...t, status: newStatus } : t
      ));
      if (action === "close") {
        setSelected(null);
        setMessages([]);
      }
    } catch { /* ignore */ }
    finally { setConfirming(false); }
  }

  const myName = user?.full_name || "";

  return (
    <div className="adm-body" style={{ paddingBottom:0 }}>
      <div style={{ display:"flex", gap:0, background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff", height:"calc(100vh - 150px)" }}>

        {/* ── Liste des tickets ── */}
        <div style={{ width:280, borderRight:"1px solid #f1f5f9", display:"flex", flexDirection:"column", flexShrink:0 }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>Mes conversations</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>
              {loading ? "Chargement…" : `${tickets.length} conversation${tickets.length !== 1 ? "s" : ""}`}
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            {loading ? (
              <div style={{ padding:24, textAlign:"center", color:"#94a3b8", fontSize:13 }}>Chargement…</div>
            ) : tickets.length === 0 ? (
              <div style={{ padding:32, textAlign:"center" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:10 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <div style={{ fontSize:13, color:"#94a3b8" }}>Aucune conversation.</div>
                <div style={{ fontSize:12, color:"#cbd5e1", marginTop:4 }}>Envoyez un premier message depuis «&nbsp;Mes tickets&nbsp;».</div>
              </div>
            ) : tickets.map(t => (
              <div key={t.ticket_id}
                onClick={() => setSelected(t)}
                style={{
                  padding:"13px 16px", borderBottom:"1px solid #f8fafc", cursor:"pointer",
                  background: selected?.ticket_id === t.ticket_id ? "#f0f4ff" : "transparent",
                  borderLeft: selected?.ticket_id === t.ticket_id ? "3px solid #2B45C8" : "3px solid transparent",
                }}
                onMouseEnter={e => { if (selected?.ticket_id !== t.ticket_id) e.currentTarget.style.background = "#fafbff"; }}
                onMouseLeave={e => { if (selected?.ticket_id !== t.ticket_id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10.5, color:"#94a3b8" }}>#{t.ticket_id}</span>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:STATUS_DOT[t.status]||"#64748b" }} />
                    <span style={{ fontSize:11, fontWeight:600, color:STATUS_DOT[t.status]||"#64748b" }}>{STATUS_FR[t.status]||t.status}</span>
                  </div>
                  <span style={{ fontSize:10.5, color:"#94a3b8" }}>{timeAgo(t.created_at)}</span>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:3 }}>
                  {t.assignee_name ? "Agent assigné" : "En attente d'assignation"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Zone de chat ── */}
        {!selected ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#94a3b8" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:14 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div style={{ fontSize:14, fontWeight:600, color:"#94a3b8" }}>Sélectionnez un ticket</div>
            <div style={{ fontSize:12, color:"#cbd5e1", marginTop:4 }}>pour ouvrir la conversation avec l'agent</div>
          </div>
        ) : (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>

            {/* Header chat */}
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:"50%", background: selected.assignee_name ? "#eff6ff" : "#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={selected.assignee_name ? "#2B45C8" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#0f172a" }}>
                  {selected.assignee_name ? "Agent de support" : "En attente d'assignation"}
                </div>
                <div style={{ fontSize:12, color:"#94a3b8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  #{selected.ticket_id} · {selected.title}
                </div>
              </div>
              <span style={{ padding:"3px 9px", borderRadius:20, fontSize:11.5, fontWeight:700, background:"#f1f5f9", color:STATUS_DOT[selected.status]||"#64748b", display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                <span style={{ width:6, height:6, borderRadius:"50%", background:STATUS_DOT[selected.status] }} />
                {STATUS_FR[selected.status]||selected.status}
              </span>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:12 }}>
              {msgLoading ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:24 }}>Chargement…</div>
              ) : messages.filter(m => !m.is_internal).length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:24 }}>
                  Aucun message. Envoyez le premier message à votre agent !
                </div>
              ) : messages
                  .filter(m => !m.is_internal)
                  .map(m => {
                    const isMe = m.author_name === myName || (!m.author_name && m.user_id === user?.user_id);
                    return (
                      <div key={m.message_id} style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start", gap:8, alignItems:"flex-end" }}>
                        {!isMe && (
                          <div style={{ width:30, height:30, borderRadius:"50%", background:avatarColor(m.author_name), display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:11, flexShrink:0 }}>
                            {initials(m.author_name)}
                          </div>
                        )}
                        <div style={{ maxWidth:"65%" }}>
                          {!isMe && m.author_name && (
                            <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3, marginLeft:4 }}>{m.author_name}</div>
                          )}
                          <div style={{
                            padding:"10px 14px",
                            borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                            background: isMe ? "#1E3AAF" : "#f8fafc",
                            color: isMe ? "#fff" : "#0f172a",
                            fontSize:13.5, lineHeight:1.6,
                            border: isMe ? "none" : "1px solid #f0f4ff",
                          }}>
                            {m.content}
                          </div>
                          <div style={{ fontSize:10.5, color:"#94a3b8", marginTop:3, textAlign: isMe ? "right" : "left", paddingRight: isMe ? 4 : 0, paddingLeft: isMe ? 0 : 4 }}>
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })
              }
              <div ref={messagesEndRef} />
            </div>

            {/* Bannière de confirmation — hors zone messages */}
            {selected.status === "RESOLVED" && (
              <div style={{ padding:"16px", borderTop:"1px solid #d1fae5", background:"#f0fdf4", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize:13, fontWeight:700, color:"#16a34a" }}>Ce ticket a été marqué comme résolu.</span>
                </div>
                <div style={{ fontSize:12.5, color:"#374151", marginBottom:12 }}>Votre problème est-il bien résolu ?</div>
                <div style={{ display:"flex", gap:8 }}>
                  <button type="button" disabled={confirming} onClick={() => handleConfirm("close")}
                    style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", background:"#16a34a", color:"#fff", fontWeight:700, fontSize:13, cursor: confirming ? "not-allowed" : "pointer" }}>
                    ✓ Oui, tout fonctionne
                  </button>
                  <button type="button" disabled={confirming} onClick={() => handleConfirm("reopen")}
                    style={{ flex:1, padding:"9px 0", borderRadius:9, border:"1.5px solid #d1d5db", background:"#fff", color:"#374151", fontWeight:600, fontSize:13, cursor: confirming ? "not-allowed" : "pointer" }}>
                    ↩ Non, rouvrir
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div style={{ padding:"12px 16px", borderTop:"1px solid #f1f5f9" }}>
              {selected.status === "CLOSED" ? (
                <div style={{ textAlign:"center", fontSize:12.5, color:"#94a3b8", padding:"8px 0" }}>
                  Ticket fermé — conversation archivée.
                </div>
              ) : selected.status !== "RESOLVED" && (
                <div style={{ display:"flex", alignItems:"flex-end", gap:10, background:"#f8fafc", border:"1.5px solid #e8ecf7", borderRadius:12, padding:"8px 14px" }}>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Écrivez votre message… (Entrée pour envoyer)"
                    rows={1}
                    style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:13, color:"#0f172a", resize:"none", fontFamily:"inherit", lineHeight:1.6, maxHeight:120, overflowY:"auto" }}
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    style={{
                      width:36, height:36, borderRadius:"50%", border:"none", cursor: text.trim() && !sending ? "pointer" : "not-allowed",
                      background: text.trim() && !sending ? "#1E3AAF" : "#e2e8f0",
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s",
                    }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={text.trim() && !sending ? "#fff" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
