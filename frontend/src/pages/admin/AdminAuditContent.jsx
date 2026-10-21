import { useEffect, useState } from "react";
import { fetchSystemLogs } from "../../api/tickets";

/* ── Mapping event_type → catégorie de l'onglet ── */
const EVENT_CATEGORY = {
  "login.success":     "Authentification",
  "login.failed":      "Authentification",
  "logout":            "Authentification",
  "user.created":      "Permissions",
  "user.deleted":      "Permissions",
  "user.updated":      "Permissions",
  "role.modified":     "Permissions",
  "permission.changed":"Permissions",
  "ticket.created":    "Tickets",
  "ticket.assigned":   "Tickets",
  "ticket.closed":     "Tickets",
  "ticket.status":     "Tickets",
  "sync.completed":    "Système",
  "sync.failed":       "Système",
  "sla.breach":        "Système",
  "sla.check":         "Système",
  "ticket.routed":     "IA",
  "ai.classify":       "IA",
  "ai.route":          "IA",
};

const EVENT_COLOR = {
  "login.success":    "#2563eb",
  "login.failed":     "#ea580c",
  "logout":           "#64748b",
  "ticket.created":   "#16a34a",
  "ticket.assigned":  "#2563eb",
  "ticket.closed":    "#64748b",
  "role.modified":    "#7c3aed",
  "permission.changed":"#7c3aed",
  "sla.breach":       "#dc2626",
  "sla.check":        "#2563eb",
  "ai.retrain":       "#7c3aed",
  "integration.update":"#64748b",
  "sync.completed":   "#16a34a",
  "sync.failed":      "#dc2626",
  "ticket.routed":    "#7c3aed",
  "ai.classify":      "#7c3aed",
  "ai.route":         "#7c3aed",
};

const SEVERITY_STYLE = {
  "Info":     { bg:"#eff6ff", color:"#2563eb" },
  "Avertis.": { bg:"#fff7ed", color:"#ea580c" },
  "Critique": { bg:"#fef2f2", color:"#dc2626" },
};

const TABS = ["Tous","Authentification","Tickets","Permissions","Système","IA"];
const PAGE_SIZE = 10;

function formatTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}
function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

export default function AdminAuditContent({ triggerExport = 0 }) {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("Tous");
  const [severityFilter, setSeverityFilter] = useState("");
  const [periodeFilter, setPeriodeFilter]   = useState("");
  const [userFilter, setUserFilter]         = useState("");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchSystemLogs();
        const all = (data || []).map(s => ({
          type:       s.category || EVENT_CATEGORY[s.event_type] || "Système",
          event:      s.event_type,
          user:       s.user_name || "system",
          detail:     s.detail || "",
          severity:   s.severity || "Info",
          created_at: s.created_at,
        }));
        setLogs(all);
      } catch {
        setLogs([]);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  /* ── Filtrage ── */
  const filtered = logs.filter(l => {
    if (tab !== "Tous" && l.type !== tab) return false;
    if (severityFilter && l.severity !== severityFilter) return false;
    if (userFilter && !l.user?.toLowerCase().includes(userFilter.toLowerCase())) return false;
    if (search && !l.event?.toLowerCase().includes(search.toLowerCase()) &&
        !l.detail?.toLowerCase().includes(search.toLowerCase()) &&
        !l.user?.toLowerCase().includes(search.toLowerCase())) return false;
    if (periodeFilter) {
      const d = new Date(l.created_at);
      const now = new Date();
      if (periodeFilter === "today")   { const s=new Date(now); s.setHours(0,0,0,0); if(d<s) return false; }
      if (periodeFilter === "week")    { const s=new Date(now); s.setDate(s.getDate()-7); if(d<s) return false; }
      if (periodeFilter === "month")   { const s=new Date(now); s.setMonth(s.getMonth()-1); if(d<s) return false; }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  useEffect(() => setPage(1), [tab, severityFilter, periodeFilter, userFilter, search]);
  useEffect(() => { if (triggerExport > 0) exportCSV(); }, [triggerExport]);

  /* ── Export CSV ── */
  function exportCSV() {
    const headers = ["Heure","Utilisateur","Événement","Détail","Sévérité"];
    const rows = filtered.map(l => [
      formatDate(l.created_at) + " " + formatTime(l.created_at),
      l.user, l.event,
      `"${(l.detail||"").replace(/"/g,'""')}"`,
      l.severity,
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" };

  return (
    <div className="adm-body">

      {/* ── KPI row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
        {[
          { label:"TOTAL ÉVÉNEMENTS",  value: logs.length,                                         color:"#2B45C8" },
          { label:"CRITIQUES",          value: logs.filter(l=>l.severity==="Critique").length,      color:"#dc2626", valueColor:"#dc2626" },
          { label:"AVERTISSEMENTS",     value: logs.filter(l=>l.severity==="Avertis.").length,      color:"#F59E0B", valueColor:"#F59E0B" },
          { label:"AUJOURD'HUI",        value: logs.filter(l=>new Date(l.created_at).toDateString()===new Date().toDateString()).length, color:"#22D3A0", valueColor:"#22D3A0" },
        ].map((k,i) => (
          <div key={i} style={{ ...card, padding:"18px 20px", borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:600,
              color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:30, fontWeight:800,
              color:k.valueColor||"#0f172a", lineHeight:1 }}>{loading?"...":k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Table card ── */}
      <div style={card}>

        {/* ── Tabs + Filtres ── */}
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #f1f5f9",
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:4 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer",
                  fontFamily:"inherit", fontSize:13, fontWeight: tab===t?700:500,
                  background: tab===t?"#1E3AAF":"transparent",
                  color: tab===t?"#fff":"#64748b", transition:"all 0.15s" }}>
                {t}
              </button>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {[
              { label:"Sévérité", value:severityFilter, onChange:setSeverityFilter,
                opts:[["","Sévérité"],["Info","Info"],["Avertis.","Avertis."],["Critique","Critique"]] },
              { label:"Période", value:periodeFilter, onChange:setPeriodeFilter,
                opts:[["","Période"],["today","Aujourd'hui"],["week","Cette semaine"],["month","Ce mois"]] },
            ].map(f => (
              <div key={f.label} style={{ display:"flex", alignItems:"center", gap:4,
                borderLeft:"1px solid #e8ecf7", paddingLeft:8 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                <select value={f.value} onChange={e=>f.onChange(e.target.value)}
                  style={{ border:"none", background:"none", fontSize:12.5, fontWeight:600,
                    color:f.value?"#1E3AAF":"#334155", cursor:"pointer", outline:"none", fontFamily:"inherit" }}>
                  {f.opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}

            {/* Utilisateur */}
            <div style={{ display:"flex", alignItems:"center", gap:4, borderLeft:"1px solid #e8ecf7", paddingLeft:8 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              <input type="text" placeholder="Utilisateur" value={userFilter}
                onChange={e=>setUserFilter(e.target.value)}
                style={{ border:"none", background:"none", fontSize:12.5, fontWeight:600,
                  color:userFilter?"#1E3AAF":"#334155", outline:"none", fontFamily:"inherit", width:90 }} />
            </div>

            {(severityFilter||periodeFilter||userFilter||search) && (
              <button onClick={()=>{ setSeverityFilter(""); setPeriodeFilter(""); setUserFilter(""); setSearch(""); }}
                style={{ height:28, padding:"0 8px", border:"none", borderRadius:6,
                  background:"#fee2e2", color:"#dc2626", fontSize:11, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit" }}>✕</button>
            )}
          </div>
        </div>

        {/* ── Barre info + recherche ── */}
        <div style={{ padding:"10px 20px", borderBottom:"1px solid #f1f5f9",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:12, color:"#94a3b8" }}>
            <strong style={{ color:"#0f172a" }}>{filtered.length}</strong> événements · page {page}/{totalPages}
          </div>
          <div style={{ position:"relative" }}>
            <svg style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Rechercher un événement..." value={search}
              onChange={e=>setSearch(e.target.value)}
              style={{ height:32, padding:"0 12px 0 28px", border:"1.5px solid #e8ecf7",
                borderRadius:8, fontSize:12, outline:"none", width:220, fontFamily:"inherit", background:"#fff", color:"#0f172a" }} />
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>Chargement...</div>
        ) : (
          <>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["DATE & HEURE","UTILISATEUR","ÉVÉNEMENT","DÉTAIL","SÉVÉRITÉ"].map((h,i)=>(
                    <th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:700,
                      color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase",
                      fontFamily:"'JetBrains Mono',monospace", borderBottom:"1px solid #f1f5f9",
                      width: i===3?"40%":undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding:40, textAlign:"center", color:"#94a3b8" }}>Aucun événement trouvé</td></tr>
                ) : paginated.map((l,i) => {
                  const sev = SEVERITY_STYLE[l.severity] || SEVERITY_STYLE.Info;
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #f8fafc" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#fafbff"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>

                      {/* Date & Heure */}
                      <td style={{ padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace",
                        fontSize:12, color:"#64748b", whiteSpace:"nowrap" }}>
                        <div>{formatDate(l.created_at)}</div>
                        <div style={{ color:"#94a3b8", fontSize:11 }}>{formatTime(l.created_at)}</div>
                      </td>

                      {/* Utilisateur */}
                      <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#0f172a", whiteSpace:"nowrap" }}>
                        {l.user}
                      </td>

                      {/* Événement */}
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600,
                          color: EVENT_COLOR[l.event] || "#64748b" }}>
                          {l.event}
                        </span>
                      </td>

                      {/* Détail */}
                      <td style={{ padding:"12px 16px", fontSize:13, color:"#334155", maxWidth:340,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {l.detail}
                      </td>

                      {/* Sévérité */}
                      <td style={{ padding:"12px 16px" }}>
                        <span style={{ padding:"3px 10px", borderRadius:20,
                          background:sev.bg, color:sev.color, fontSize:11, fontWeight:700 }}>
                          {l.severity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Pagination ── */}
            <div style={{ padding:"12px 20px", borderTop:"1px solid #f1f5f9",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, color:"#94a3b8" }}>
                Affichage <strong style={{ color:"#0f172a" }}>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)}</strong> sur <strong style={{ color:"#0f172a" }}>{filtered.length}</strong>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={()=>setPage(p=>Math.max(p-1,1))} disabled={page===1}
                  style={{ width:30,height:30,borderRadius:7,border:"1.5px solid #e8ecf7",
                    background:"#fff",color:page===1?"#cbd5e1":"#334155",
                    cursor:page===1?"not-allowed":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                {[...Array(Math.min(5, totalPages))].map((_,i)=>{
                  const p = page<=2 ? i : page-2+i;
                  if(p>=totalPages) return null;
                  return (
                    <button key={p} onClick={()=>setPage(p+1)}
                      style={{ width:30,height:30,borderRadius:7,border:"1.5px solid",
                        borderColor:p+1===page?"#1E3AAF":"#e8ecf7",
                        background:p+1===page?"#1E3AAF":"#fff",
                        color:p+1===page?"#fff":"#64748b",
                        fontWeight:p+1===page?700:400,fontSize:12,
                        cursor:"pointer",fontFamily:"inherit" }}>
                      {p+1}
                    </button>
                  );
                })}
                {totalPages>5 && <span style={{ display:"flex",alignItems:"center",color:"#94a3b8",fontSize:13 }}>...</span>}
                <button onClick={()=>setPage(p=>Math.min(p+1,totalPages))} disabled={page===totalPages}
                  style={{ width:30,height:30,borderRadius:7,border:"1.5px solid #e8ecf7",
                    background:"#fff",color:page===totalPages?"#cbd5e1":"#334155",
                    cursor:page===totalPages?"not-allowed":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
