import { useState, useEffect, useRef } from "react";
import {
  fetchMyTickets, fetchTicketMessages, createTicketMessage,
  updateTicketStatus, fetchAIResult, fetchSimilarTickets,
} from "../../api/tickets";
import { API_BASE } from '../../api/config.js';
import AttachmentsList from "../../components/AttachmentsList";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

const STATUS_FR    = { OPEN:"Ouvert", IN_PROGRESS:"En cours", PENDING:"En attente", RESOLVED:"Résolu", CLOSED:"Fermé" };
const STATUS_BG    = { OPEN:"#eff6ff", IN_PROGRESS:"#f0fdf4", PENDING:"#fff7ed", RESOLVED:"#f1f5f9", CLOSED:"#f8fafc" };
const STATUS_COLOR = { OPEN:"#2563eb", IN_PROGRESS:"#16a34a", PENDING:"#ea580c", RESOLVED:"#64748b", CLOSED:"#94a3b8" };
const PRIO_BG      = { Urgente:"#fef2f2", Haute:"#fef2f2", Normale:"#eff6ff", Basse:"#f8fafc", Faible:"#f8fafc" };
const PRIO_COLOR   = { Urgente:"#dc2626", Haute:"#dc2626", Normale:"#2563eb", Basse:"#64748b", Faible:"#94a3b8" };

const STATUS_OPTIONS = [
  { value:"IN_PROGRESS", label:"En cours",    color:"#16a34a", bg:"#f0fdf4" },
  { value:"PENDING",     label:"En attente",  color:"#ea580c", bg:"#fff7ed" },
  { value:"RESOLVED",    label:"Résolu",      color:"#2563eb", bg:"#eff6ff" },
  { value:"CLOSED",      label:"Fermé",       color:"#64748b", bg:"#f8fafc" },
];

function timeAgo(d) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60)    return "< 1 min";
  if (s < 3600)  return Math.floor(s/60) + " min";
  if (s < 86400) return Math.floor(s/3600) + " h";
  if (s < 604800)return Math.floor(s/86400) + " j";
  return Math.floor(s/604800) + " sem";
}

export default function AgentTicketsContent({ onTitleChange, onBadgeChange }) {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("tous");
  const [aiTab,    setAiTab]    = useState("all");
  const [aiStatus, setAiStatus] = useState({});  // ticketId → "PENDING"|"VALIDATED"|"CORRECTED"|"REJECTED"
  const [search,   setSearch]   = useState("");

  /* ── Chat state ── */
  const [chat,     setChat]     = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoad,  setMsgLoad]  = useState(false);
  const [msgText,  setMsgText]  = useState("");
  const [sending,  setSending]  = useState(false);
  const endRef   = useRef(null);
  const pollRef  = useRef(null);
  const knownIds = useRef(new Set());

  /* ── Treatment modal state ── */
  const [treat,        setTreat]        = useState(null);
  const [treatTab,     setTreatTab]     = useState("manual");
  const [newStatus,    setNewStatus]    = useState("");
  const [noteText,     setNoteText]     = useState("");
  const [aiResult,     setAiResult]     = useState(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiReplyText,  setAiReplyText]  = useState("");
  const [generating,   setGenerating]   = useState(false);
  const [similar,      setSimilar]      = useState([]);
  const [simLoading,   setSimLoading]   = useState(false);
  const [simExpanded,  setSimExpanded]  = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [saveOk,         setSaveOk]         = useState(false);
  const [saveErr,        setSaveErr]        = useState("");
  const [aiValidating,   setAiValidating]   = useState(false);
  const [aiValidateOk,   setAiValidateOk]   = useState("");
  const [aiCorrectMode,  setAiCorrectMode]  = useState(false);
  const [aiCorrection,   setAiCorrection]   = useState({});

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const h = { Authorization: `Bearer ${token}` };

    fetchMyTickets({ limit:100 })
      .then(async data => {
        setTickets(data);
        const actifs  = data.filter(t => ["OPEN","IN_PROGRESS","PENDING"].includes(t.status)).length;
        const resolus = data.filter(t => ["RESOLVED","CLOSED"].includes(t.status)).length;
        onTitleChange?.(`Mes tickets (${actifs} actif${actifs !== 1 ? "s" : ""} · ${resolus} résolu${resolus !== 1 ? "s" : ""})`);
        onBadgeChange?.(actifs);

        // Charger les statuts IA pour tous les tickets en parallèle
        const myIds = new Set(data.map(t => t.ticket_id));
        const [pending, validated, rejected] = await Promise.all([
          fetch(`${API_BASE}/ai/pending`,                                          { headers: h }).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE}/ai/classified?status=VALIDATED,CORRECTED`,           { headers: h }).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE}/ai/classified?status=REJECTED`,                      { headers: h }).then(r => r.json()).catch(() => []),
        ]);
        const map = {};
        (Array.isArray(pending)   ? pending   : []).filter(t => myIds.has(t.ticket_id)).forEach(t => { map[t.ticket_id] = "PENDING";   });
        (Array.isArray(validated) ? validated : []).filter(t => myIds.has(t.ticket_id)).forEach(t => { map[t.ticket_id] = t.classification?.validation_status || "VALIDATED"; });
        (Array.isArray(rejected)  ? rejected  : []).filter(t => myIds.has(t.ticket_id)).forEach(t => { map[t.ticket_id] = "REJECTED";  });
        setAiStatus(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const counts = {
    tous:     tickets.length,
    hauts:    tickets.filter(t => t.priority_label === "Urgente" || t.priority_label === "Haute").length,
    encours:  tickets.filter(t => t.status === "IN_PROGRESS").length,
    attente:  tickets.filter(t => t.status === "PENDING").length,
    resolus:  tickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length,
  };

  const aiCounts = {
    pending:   tickets.filter(t => aiStatus[t.ticket_id] === "PENDING").length,
    validated: tickets.filter(t => ["VALIDATED","CORRECTED"].includes(aiStatus[t.ticket_id])).length,
    rejected:  tickets.filter(t => aiStatus[t.ticket_id] === "REJECTED").length,
  };

  const filtered = tickets.filter(t => {
    if (tab === "hauts"   && t.priority_label !== "Urgente" && t.priority_label !== "Haute") return false;
    if (tab === "encours" && t.status !== "IN_PROGRESS")                                     return false;
    if (tab === "attente" && t.status !== "PENDING")                                         return false;
    if (tab === "resolus" && t.status !== "RESOLVED" && t.status !== "CLOSED")               return false;
    if (aiTab === "pending"   && aiStatus[t.ticket_id] !== "PENDING")                        return false;
    if (aiTab === "validated" && !["VALIDATED","CORRECTED"].includes(aiStatus[t.ticket_id])) return false;
    if (aiTab === "rejected"  && aiStatus[t.ticket_id] !== "REJECTED")                       return false;
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase()))                    return false;
    return true;
  });

  const tabs = [
    { id:"tous",    label:`Tous (${counts.tous})` },
    { id:"hauts",   label:`Haute priorité (${counts.hauts})` },
    { id:"encours", label:`En cours (${counts.encours})` },
    { id:"attente", label:`En attente (${counts.attente})` },
    { id:"resolus", label:`Résolus (${counts.resolus})` },
  ];

  /* ── Chat ── */
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
    setChat(null); setMessages([]); setMsgText("");
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

  function formatTime(d) {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
  }

  /* ── Treatment modal ── */
  function openTreat(ticket) {
    setTreat(ticket);
    setTreatTab("manual");
    setNewStatus(ticket.status);
    setNoteText("");
    setAiResult(null);
    setAiReplyText("");
    setSimilar([]);
    setSimExpanded(null);
    setSaveOk(false);
    setSaveErr("");
    setAiValidateOk("");
    setAiCorrectMode(false);
    setAiCorrection({});
  }

  function closeTreat() {
    setTreat(null);
    setSaving(false);
    setSaveOk(false);
    setSaveErr("");
  }

  async function handleGenerateReply() {
    if (!treat?.ticket_id) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      // Déclenche la ré-analyse complète (génère réponse auto via Groq)
      await fetch(`${API_BASE}/ai/tickets/${treat.ticket_id}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      // Le traitement complet (classification + OCR éventuel + réponse Groq) prend
      // ~9-10 secondes en général — on interroge toutes les 2s au lieu d'attendre
      // un délai fixe, pour s'adapter si c'est un peu plus long ou plus court.
      let res = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        res = await fetchAIResult(treat.ticket_id);
        if (res?.auto_reply?.generated_text || res?.auto_reply?.corrected_text) break;
      }
      setAiResult(res);
      const text = res?.auto_reply?.corrected_text || res?.auto_reply?.generated_text || "";
      setAiReplyText(text);
    } catch (e) {
      console.error("Erreur génération réponse:", e);
    } finally {
      setGenerating(false);
    }
  }

  async function switchToAI() {
    setTreatTab("ai");
    if (!aiResult && !aiLoading) {
      setAiLoading(true);
      try {
        const res = await fetchAIResult(treat.ticket_id);
        setAiResult(res);
        const text = res?.auto_reply?.corrected_text || res?.auto_reply?.generated_text || "";
        setAiReplyText(text);
      } catch { setAiResult(null); }
      finally { setAiLoading(false); }
    }
  }

  async function switchToSimilar() {
    setTreatTab("similar");
    if (similar.length === 0 && !simLoading) {
      setSimLoading(true);
      try {
        const res = await fetchSimilarTickets(treat.ticket_id, 5);
        setSimilar(res?.similar_tickets || []);
      } catch { setSimilar([]); }
      finally { setSimLoading(false); }
    }
  }

  async function handleSave() {
    if (!treat || saving) return;
    setSaving(true);
    setSaveErr("");
    try {
      if (newStatus && newStatus !== treat.status) {
        await updateTicketStatus(treat.ticket_id, newStatus);
        setTickets(prev => prev.map(t =>
          t.ticket_id === treat.ticket_id ? { ...t, status: newStatus } : t
        ));
      }
      if (noteText.trim()) {
        await createTicketMessage(treat.ticket_id, { content: noteText.trim(), is_internal: true });
      }
      setSaveOk(true);
      setTimeout(() => closeTreat(), 1200);
    } catch (e) {
      setSaveErr(e?.message || "Erreur lors de l'enregistrement.");
    } finally { setSaving(false); }
  }

  async function handleSendAIReply() {
    if (!treat || !aiReplyText.trim() || saving) return;
    setSaving(true);
    try {
      await createTicketMessage(treat.ticket_id, { content: aiReplyText.trim(), is_internal: false });
      setSaveOk(true);
      setTimeout(() => closeTreat(), 1200);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleValidateAI(status, correctedData = {}) {
    if (!treat || aiValidating) return;
    setAiValidating(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await fetch(`${API_BASE}/ai/tickets/${treat.ticket_id}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ validation_status: status, ...correctedData }),
      });
      // Mettre à jour le statut local
      setAiStatus(prev => ({ ...prev, [treat.ticket_id]: status }));
      // Rafraîchir le résultat IA affiché
      const data = await fetchAIResult(treat.ticket_id);
      setAiResult(data);
      setAiValidateOk(status === "VALIDATED" ? "✅ Classification validée !" : status === "REJECTED" ? "❌ Classification rejetée." : "✏️ Classification corrigée !");
      setAiCorrectMode(false);
      setTimeout(() => setAiValidateOk(""), 3000);
    } catch { /* ignore */ }
    finally { setAiValidating(false); }
  }

  return (
    <div className="adm-body">
      {/* ── Onglets statut ticket ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:10 }}>
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
        <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ height:36, padding:"0 12px", border:"1.5px solid #e8ecf7", borderRadius:9, fontSize:13, outline:"none", fontFamily:"inherit", width:220, background:"#fff", color:"#0f172a" }} />
      </div>

      {/* ── Onglets validation IA ── */}
      <div style={{ display:"flex", gap:6, marginBottom:16, borderBottom:"1px solid #f1f5f9", paddingBottom:0 }}>
        {[
          { key:"all",       label:"Tous",              count: null,             color:"#2B45C8" },
          { key:"pending",   label:"⏳ En attente IA",  count: aiCounts.pending,   color:"#f59e0b" },
          { key:"validated", label:"✅ Validées",        count: aiCounts.validated, color:"#16a34a" },
          { key:"rejected",  label:"❌ Rejetées",        count: aiCounts.rejected,  color:"#dc2626" },
        ].map(t => (
          <button key={t.key} onClick={() => setAiTab(t.key)} style={{
            padding:"7px 14px", border:"none", background:"none", cursor:"pointer",
            fontSize:12.5, fontWeight: aiTab===t.key ? 700 : 500,
            color: aiTab===t.key ? t.color : "#94a3b8",
            borderBottom: aiTab===t.key ? `2px solid ${t.color}` : "2px solid transparent",
            marginBottom:-1, display:"flex", alignItems:"center", gap:6,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize:11, fontWeight:700, borderRadius:20, padding:"1px 7px",
                background: aiTab===t.key ? t.color : "#e2e8f0",
                color: aiTab===t.key ? "#fff" : "#64748b" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:"#94a3b8" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:32, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
            {tickets.length === 0 ? "Aucun ticket assigné." : "Aucun ticket correspondant à ce filtre."}
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #f1f5f9" }}>
                {["ID","SUJET","DEMANDEUR","PRIORITÉ","STATUT","CATÉGORIE","CRÉÉ",""].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:600, color:"#94a3b8", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.ticket_id}
                  style={{ borderBottom: i < filtered.length-1 ? "1px solid #f8fafc" : "none", cursor:"pointer" }}
                  onClick={() => openTreat(t)}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding:"14px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:11.5, color:"#94a3b8", whiteSpace:"nowrap" }}>#{t.ticket_id}</td>
                  <td style={{ padding:"14px 16px", maxWidth:280 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:12.5, color:"#64748b", whiteSpace:"nowrap" }}>{t.requester_name || "—"}</td>
                  <td style={{ padding:"14px 16px" }}>
                    {t.priority_label
                      ? <span style={{ padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:700, background:PRIO_BG[t.priority_label]||"#f1f5f9", color:PRIO_COLOR[t.priority_label]||"#64748b" }}>{t.priority_label}</span>
                      : <span style={{ color:"#94a3b8" }}>—</span>}
                  </td>
                  <td style={{ padding:"14px 16px" }}>
                    <span style={{ padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:700, background:STATUS_BG[t.status]||"#f1f5f9", color:STATUS_COLOR[t.status]||"#64748b" }}>
                      {STATUS_FR[t.status] || t.status}
                    </span>
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:12, color:"#64748b" }}>{t.category || "—"}</td>
                  <td style={{ padding:"14px 16px" }}>
                    {aiStatus[t.ticket_id] === "PENDING"
                      ? <span title="Validation IA en attente" style={{ fontSize:16 }}>⏳</span>
                      : aiStatus[t.ticket_id] === "VALIDATED"
                      ? <span title="Classification IA validée" style={{ fontSize:16 }}>✅</span>
                      : aiStatus[t.ticket_id] === "CORRECTED"
                      ? <span title="Classification IA corrigée" style={{ fontSize:16 }}>✏️</span>
                      : aiStatus[t.ticket_id] === "REJECTED"
                      ? <span title="Classification IA rejetée" style={{ fontSize:16 }}>❌</span>
                      : <span style={{ fontSize:11, color:"#cbd5e1" }}>—</span>}
                  </td>
                  <td style={{ padding:"14px 16px", fontSize:12, color:"#94a3b8", whiteSpace:"nowrap" }}>{timeAgo(t.created_at)}</td>
                  <td style={{ padding:"14px 16px" }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => openChat(t)}
                      style={{ padding:"5px 12px", border:"1.5px solid #e8ecf7", borderRadius:8, background:"#fff", color:"#2B45C8", fontWeight:600, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Messages
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal chat ── */}
      {chat && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={() => closeChat()}>
          <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:560, height:560, display:"flex", flexDirection:"column", boxShadow:"0 16px 48px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8" }}>#{chat.ticket_id} · {chat.requester_name || "Demandeur"}</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{chat.title}</div>
              </div>
              <button type="button" onClick={() => closeChat()} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:22, padding:0 }}>×</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
              {msgLoad ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:24 }}>Chargement…</div>
              ) : messages.filter(m => !m.is_internal).length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:13, padding:24 }}>Aucun message. Envoyez le premier message au demandeur.</div>
              ) : messages.filter(m => !m.is_internal).map(m => {
                const isMe = m.author_name !== chat.requester_name;
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
            <div style={{ padding:"12px 16px", borderTop:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", gap:10, background:"#f8fafc", border:"1.5px solid #e8ecf7", borderRadius:12, padding:"8px 14px", alignItems:"flex-end" }}>
                <textarea value={msgText} onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Répondre au demandeur… (Entrée pour envoyer)"
                  rows={1}
                  style={{ flex:1, border:"none", outline:"none", background:"transparent", fontSize:13, color:"#0f172a", resize:"none", fontFamily:"inherit", lineHeight:1.6, maxHeight:100, overflowY:"auto" }} />
                <button type="button" onClick={sendMessage} disabled={!msgText.trim() || sending}
                  style={{ width:34, height:34, borderRadius:"50%", border:"none", cursor: msgText.trim() ? "pointer" : "not-allowed", background: msgText.trim() ? "#1E3AAF" : "#e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={msgText.trim() ? "#fff" : "#94a3b8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal traitement ── */}
      {treat && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}
          onClick={() => closeTreat()}>
          <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:560, display:"flex", flexDirection:"column", boxShadow:"0 16px 48px rgba(0,0,0,0.20)" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding:"18px 22px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8", marginBottom:3 }}>
                  #{treat.ticket_id} · {treat.requester_name || "Demandeur"}
                </div>
                <div style={{ fontSize:15, fontWeight:800, color:"#0f172a", lineHeight:1.35 }}>{treat.title}</div>
                <div style={{ display:"flex", gap:7, marginTop:6, flexWrap:"wrap" }}>
                  <span style={{ padding:"3px 9px", borderRadius:20, fontSize:11.5, fontWeight:700, background:STATUS_BG[treat.status]||"#f1f5f9", color:STATUS_COLOR[treat.status]||"#64748b" }}>
                    {STATUS_FR[treat.status] || treat.status}
                  </span>
                  {treat.priority_label && (
                    <span style={{ padding:"3px 9px", borderRadius:20, fontSize:11.5, fontWeight:700, background:PRIO_BG[treat.priority_label]||"#f1f5f9", color:PRIO_COLOR[treat.priority_label]||"#64748b" }}>
                      {treat.priority_label}
                    </span>
                  )}
                  {treat.category && (
                    <span style={{ padding:"3px 9px", borderRadius:20, fontSize:11.5, background:"#f8fafc", color:"#64748b" }}>{treat.category}</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => closeTreat()} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:22, padding:0, flexShrink:0 }}>×</button>
            </div>

            {/* Description */}
            {(treat.description_text || treat.description) && (
              <div style={{ padding:"14px 22px", borderBottom:"1px solid #f1f5f9", background:"#f8fafc" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Description</div>
                <div style={{ fontSize:13, color:"#374151", lineHeight:1.65, maxHeight:110, overflowY:"auto",
                  whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                  {treat.description_text || treat.description}
                </div>
              </div>
            )}

            <AttachmentsList ticketId={treat.ticket_id} />

            {/* Tabs */}
            <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 22px" }}>
              {[
                { id:"manual",  label:"✏️ Traitement manuel",  action: () => setTreatTab("manual") },
                { id:"ai",      label:"⚡ Assistance IA",       action: switchToAI },
                { id:"similar", label:"🔍 Tickets similaires",  action: switchToSimilar },
              ].map(tb => (
                <button key={tb.id} type="button"
                  onClick={tb.action}
                  style={{
                    padding:"12px 14px", border:"none", background:"none", cursor:"pointer",
                    fontSize:12.5, fontWeight: treatTab === tb.id ? 700 : 500,
                    color: treatTab === tb.id ? "#1e40af" : "#94a3b8",
                    borderBottom: treatTab === tb.id ? "2px solid #2B45C8" : "2px solid transparent",
                    marginBottom:-1, whiteSpace:"nowrap",
                  }}>{tb.label}</button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding:"20px 22px", minHeight:220 }}>
              {/* Success flash */}
              {saveOk && (
                <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize:13, fontWeight:600, color:"#16a34a" }}>Modifications enregistrées !</span>
                </div>
              )}
              {saveErr && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{ fontSize:13, fontWeight:600, color:"#dc2626" }}>{saveErr}</span>
                </div>
              )}

              {treatTab === "similar" ? (
                simLoading ? (
                  <div style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>Recherche de tickets similaires…</div>
                ) : similar.length === 0 ? (
                  <div style={{ textAlign:"center", padding:32 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>🔍</div>
                    <div style={{ fontSize:13, color:"#94a3b8" }}>Aucun ticket similaire trouvé dans la base historique.</div>
                    <div style={{ fontSize:11, color:"#cbd5e1", marginTop:4 }}>Le service RAG (ChromaDB) n'a pas retourné de résultats.</div>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>
                      {similar.length} ticket{similar.length > 1 ? "s" : ""} similaire{similar.length > 1 ? "s" : ""} — base historique GEISER
                    </div>
                    {similar.map((s, i) => {
                      const pct = Math.round(s.similarity * 100);
                      const barColor = pct >= 60 ? "#16a34a" : pct >= 40 ? "#ea580c" : "#94a3b8";
                      const isOpen = simExpanded === i;
                      return (
                        <div key={i}
                          onClick={() => setSimExpanded(isOpen ? null : i)}
                          style={{ padding:"10px 12px", background:"#f8fafc", borderRadius:10, border: isOpen ? "1px solid #93c5fd" : "1px solid #f0f4ff", cursor:"pointer" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {s.title || "—"}
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:barColor, flexShrink:0 }}>{pct}%</span>
                          </div>
                          <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap" }}>
                            {s.category  && <span style={{ fontSize:10.5, background:"#eff6ff", color:"#2563eb", borderRadius:20, padding:"2px 8px", fontWeight:600 }}>{s.category}</span>}
                            {s.subcategory && <span style={{ fontSize:10.5, background:"#f8fafc", color:"#64748b", borderRadius:20, padding:"2px 8px" }}>{s.subcategory}</span>}
                            {s.priority  && <span style={{ fontSize:10.5, background:"#fef9c3", color:"#854d0e", borderRadius:20, padding:"2px 8px", fontWeight:600 }}>{s.priority}</span>}
                            {s.status  && <span style={{ fontSize:10.5, background:"#f0fdf4", color:"#16a34a", borderRadius:20, padding:"2px 8px", fontWeight:600 }}>{s.status}</span>}
                          </div>
                          <div style={{ marginTop:6, height:4, background:"#e2e8f0", borderRadius:2 }}>
                            <div style={{ width:`${pct}%`, height:"100%", background:barColor, borderRadius:2 }} />
                          </div>
                          {isOpen && (
                            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #e2e8f0" }}>
                              <div style={{ fontSize:10.5, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>
                                Description du ticket historique #{s.ticket_id}
                              </div>
                              <div style={{ fontSize:12.5, color:"#334155", lineHeight:1.5 }}>
                                {s.description || "Aucune description disponible."}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : treatTab === "manual" ? (
                <>
                  <div style={{ marginBottom:18 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Changer le statut</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {STATUS_OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setNewStatus(opt.value)}
                          style={{
                            padding:"7px 16px", borderRadius:20,
                            border: newStatus === opt.value ? `2px solid ${opt.color}` : "1.5px solid #e8ecf7",
                            background: newStatus === opt.value ? opt.bg : "#fff",
                            color: newStatus === opt.value ? opt.color : "#374151",
                            fontWeight: newStatus === opt.value ? 700 : 500,
                            fontSize:13, cursor:"pointer", transition:"all 0.1s",
                          }}>{opt.label}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Note interne <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(optionnel)</span></div>
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                      placeholder="Ajoutez une note visible uniquement par l'équipe…"
                      rows={3}
                      style={{ width:"100%", border:"1.5px solid #e8ecf7", borderRadius:10, padding:"10px 12px", fontSize:13, color:"#0f172a", background:"#fff", resize:"vertical", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                  </div>
                </>
              ) : (
                /* AI tab */
                aiLoading ? (
                  <div style={{ textAlign:"center", padding:32, color:"#94a3b8" }}>Chargement de l'analyse IA…</div>
                ) : !aiResult ? (
                  <div style={{ textAlign:"center", padding:32 }}>
                    <div style={{ fontSize:13, color:"#94a3b8", marginBottom:6 }}>Aucune analyse IA disponible pour ce ticket.</div>
                    <div style={{ fontSize:12, color:"#cbd5e1" }}>L'IA n'a pas encore traité ce ticket.</div>
                  </div>
                ) : (
                  <>
                    {/* Classification */}
                    {aiResult.classification && (
                      <>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                          {[
                            { label:"Catégorie",      value: aiResult.classification.predicted_category || "—" },
                            { label:"Sous-catégorie", value: aiResult.classification.predicted_subcategory || "—" },
                            { label:"Priorité",       value: treat.priority_label || "—" },
                            { label:"Approche IA",    value: aiResult.classification.model_version?.startsWith("ML") ? "🤖 ML (TF-IDF + LinearSVC)" : "🧠 LLM (Groq / LLaMA 3)" },
                          ].map(f => (
                            <div key={f.label} style={{ padding:"9px 11px", background:"#f8fafc", borderRadius:9, border:"1px solid #f0f4ff" }}>
                              <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{f.label}</div>
                              <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{f.value}</div>
                            </div>
                          ))}
                        </div>
                        {/* Barres de confiance */}
                        <div style={{ marginBottom:14, display:"flex", flexDirection:"column", gap:7 }}>
                          {aiResult.classification.ml_confidence != null && (
                            <div>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginBottom:3 }}>
                                <span>Confiance ML</span>
                                <span style={{ fontWeight:600, color: aiResult.classification.model_version?.startsWith("ML") ? "#2563eb" : "#94a3b8" }}>
                                  {Math.round(aiResult.classification.ml_confidence * 100)}%
                                  {!aiResult.classification.model_version?.startsWith("ML") && " (sous seuil → LLM utilisé)"}
                                </span>
                              </div>
                              <div style={{ height:5, background:"#e2e8f0", borderRadius:3 }}>
                                <div style={{ height:"100%", width:`${Math.round(aiResult.classification.ml_confidence * 100)}%`,
                                  background: aiResult.classification.model_version?.startsWith("ML") ? "#2563eb" : "#cbd5e1", borderRadius:3 }} />
                              </div>
                            </div>
                          )}
                          {!aiResult.classification.model_version?.startsWith("ML") && aiResult.classification.confidence && (
                            <div>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginBottom:3 }}>
                                <span>Confiance LLM <span style={{ fontSize:10, color:"#94a3b8" }}>(auto-estimée)</span></span>
                                <span style={{ fontWeight:600, color:"#7c3aed" }}>{Math.round(aiResult.classification.confidence * 100)}%</span>
                              </div>
                              <div style={{ height:5, background:"#e2e8f0", borderRadius:3 }}>
                                <div style={{ height:"100%", width:`${Math.round(aiResult.classification.confidence * 100)}%`,
                                  background:"#7c3aed", borderRadius:3 }} />
                              </div>
                            </div>
                          )}
                          {aiResult.classification.model_version?.startsWith("ML") && aiResult.classification.ml_confidence == null && aiResult.classification.confidence && (
                            <div>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#64748b", marginBottom:3 }}>
                                <span>Confiance ML</span>
                                <span style={{ fontWeight:600, color:"#2563eb" }}>{Math.round(aiResult.classification.confidence * 100)}%</span>
                              </div>
                              <div style={{ height:5, background:"#e2e8f0", borderRadius:3 }}>
                                <div style={{ height:"100%", width:`${Math.round(aiResult.classification.confidence * 100)}%`, background:"#2563eb", borderRadius:3 }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Validation IA */}
                    {aiResult.classification && (
                      <div style={{ marginBottom:14 }}>
                        {aiValidateOk ? (
                          <div style={{ padding:"10px 14px", borderRadius:9, background:"#f0fdf4", border:"1px solid #bbf7d0", fontSize:13, fontWeight:600, color:"#16a34a" }}>
                            {aiValidateOk}
                          </div>
                        ) : aiResult.classification.validation_status === "PENDING" ? (
                          <>
                            {!aiCorrectMode ? (
                              <div style={{ display:"flex", gap:8 }}>
                                <button type="button" onClick={() => handleValidateAI("VALIDATED")} disabled={aiValidating}
                                  style={{ flex:1, padding:"8px 0", background:"#16a34a", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                                  ✅ Valider
                                </button>
                                <button type="button" onClick={() => { setAiCorrectMode(true); setAiCorrection({}); }} disabled={aiValidating}
                                  style={{ flex:1, padding:"8px 0", background:"#2563eb", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                                  ✏️ Corriger
                                </button>
                                <button type="button" onClick={() => handleValidateAI("REJECTED")} disabled={aiValidating}
                                  style={{ flex:1, padding:"8px 0", background:"#dc2626", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                                  ❌ Rejeter
                                </button>
                              </div>
                            ) : (
                              <div style={{ background:"#eff6ff", borderRadius:9, padding:14 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:"#1d4ed8", marginBottom:10 }}>Corriger la classification</div>
                                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                                  {[
                                    { key:"corrected_category",    label:"Catégorie",      def: aiResult.classification.predicted_category },
                                    { key:"corrected_subcategory", label:"Sous-catégorie", def: aiResult.classification.predicted_subcategory },
                                    { key:"corrected_priority",    label:"Priorité",       def: aiResult.classification.predicted_priority },
                                  ].map(({ key, label, def }) => (
                                    <input key={key} placeholder={label} defaultValue={def}
                                      onChange={e => setAiCorrection(prev => ({ ...prev, [key]: e.target.value }))}
                                      style={{ padding:"8px 12px", border:"1px solid #bfdbfe", borderRadius:8, fontSize:13 }} />
                                  ))}
                                  <div style={{ display:"flex", gap:8 }}>
                                    <button type="button" onClick={() => handleValidateAI("CORRECTED", aiCorrection)}
                                      style={{ flex:1, padding:"8px 0", background:"#2563eb", color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                                      Enregistrer la correction
                                    </button>
                                    <button type="button" onClick={() => setAiCorrectMode(false)}
                                      style={{ padding:"8px 14px", background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:8, fontSize:13, cursor:"pointer" }}>
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ padding:"8px 12px", borderRadius:8, fontSize:12,
                            background: aiResult.classification.validation_status === "VALIDATED" ? "#f0fdf4"
                                       : aiResult.classification.validation_status === "CORRECTED" ? "#eff6ff" : "#fef2f2",
                            color: aiResult.classification.validation_status === "VALIDATED" ? "#16a34a"
                                 : aiResult.classification.validation_status === "CORRECTED" ? "#2563eb" : "#dc2626",
                            fontWeight:600 }}>
                            {{ VALIDATED:"✅ Validée", CORRECTED:"✏️ Corrigée", REJECTED:"❌ Rejetée" }[aiResult.classification.validation_status]}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto-reply */}
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                        Réponse suggérée <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0, fontSize:11.5 }}>(modifiable avant envoi)</span>
                      </div>
                      {aiResult.auto_reply ? (
                        <textarea value={aiReplyText} onChange={e => setAiReplyText(e.target.value)}
                          rows={4}
                          style={{ width:"100%", border:"1.5px solid #e8ecf7", borderRadius:10, padding:"10px 12px", fontSize:13, color:"#0f172a", background:"#fff", resize:"vertical", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                      ) : (
                        <div style={{ padding:"14px", background:"#f8fafc", borderRadius:10, border:"1px solid #f0f4ff", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                          <span style={{ fontSize:13, color:"#94a3b8" }}>
                            {generating ? "⏳ Génération en cours (~10 sec)…" : "Aucune réponse automatique générée."}
                          </span>
                          {!generating && (
                            <button type="button" onClick={handleGenerateReply}
                              style={{ padding:"7px 14px", borderRadius:8, border:"none",
                                background:"#7c3aed", color:"#fff", fontSize:12, fontWeight:700,
                                cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                              🧠 Générer via IA
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:"14px 22px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button type="button" onClick={() => closeTreat()}
                style={{ padding:"8px 18px", border:"1.5px solid #e8ecf7", borderRadius:10, background:"#fff", color:"#374151", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Annuler
              </button>
              {treatTab === "manual" ? (
                <button type="button" onClick={handleSave} disabled={saving || saveOk}
                  style={{ padding:"8px 20px", borderRadius:10, border:"none", background: saving || saveOk ? "#e2e8f0" : "#1E3AAF", color: saving || saveOk ? "#94a3b8" : "#fff", fontSize:13, fontWeight:700, cursor: saving || saveOk ? "not-allowed" : "pointer" }}>
                  {saving ? "Enregistrement…" : saveOk ? "Enregistré ✓" : "Enregistrer"}
                </button>
              ) : treatTab === "ai" ? (
                aiResult?.auto_reply && (
                  <button type="button" onClick={handleSendAIReply} disabled={!aiReplyText.trim() || saving || saveOk}
                    style={{ padding:"8px 20px", borderRadius:10, border:"none", background: !aiReplyText.trim() || saving || saveOk ? "#e2e8f0" : "#1E3AAF", color: !aiReplyText.trim() || saving || saveOk ? "#94a3b8" : "#fff", fontSize:13, fontWeight:700, cursor: aiReplyText.trim() && !saving && !saveOk ? "pointer" : "not-allowed" }}>
                    {saving ? "Envoi…" : saveOk ? "Envoyé ✓" : "⚡ Envoyer cette réponse"}
                  </button>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
