import { useState, useEffect } from "react";
import { fetchMyTickets, fetchMyStats } from "../../api/tickets";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

const STATUS_FR = { OPEN:"Ouvert", IN_PROGRESS:"En cours", PENDING:"En attente", RESOLVED:"Résolu", CLOSED:"Fermé" };
const STATUS_COLOR = { OPEN:"#2563eb", IN_PROGRESS:"#2B45C8", PENDING:"#f97316", RESOLVED:"#22c55e", CLOSED:"#94a3b8" };
const PRIO_BG    = { Urgente:"#fef2f2", Haute:"#fef2f2", Normale:"#eff6ff", Basse:"#f8fafc", Faible:"#f8fafc" };
const PRIO_COLOR = { Urgente:"#dc2626", Haute:"#dc2626", Normale:"#2563eb", Basse:"#64748b", Faible:"#64748b" };

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return "Il y a " + diff + " s";
  if (diff < 3600) return "Il y a " + Math.floor(diff/60) + " min";
  if (diff < 86400)return "Il y a " + Math.floor(diff/3600) + " h";
  return "Il y a " + Math.floor(diff/86400) + " j";
}

export default function AgentHomeContent({ user, searchQuery = "" }) {
  const [tickets, setTickets] = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("tous");

  useEffect(() => {
    Promise.all([
      fetchMyTickets({ limit:10 }),
      fetchMyStats(),
    ]).then(([t, s]) => {
      setTickets(t);
      setStats(s);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const open      = stats?.by_status?.OPEN       || 0;
  const inProg    = stats?.by_status?.IN_PROGRESS || 0;
  const resolved  = stats?.by_status?.RESOLVED   || 0;
  const toDoToday = open + inProg;

  const byTab = tab === "hauts"
    ? tickets.filter(t => t.priority_label === "Urgente" || t.priority_label === "Haute")
    : tab === "encours"
    ? tickets.filter(t => t.status === "IN_PROGRESS")
    : tickets;

  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? byTab : byTab.filter(t =>
    String(t.ticket_id).includes(q) ||
    t.title?.toLowerCase().includes(q) ||
    t.requester_name?.toLowerCase().includes(q)
  );

  return (
    <div className="adm-body">
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
        {[
          { label:"À TRAITER",       value: loading ? "…" : String(toDoToday), border:"#2B45C8" },
          { label:"EN COURS",        value: loading ? "…" : String(inProg),    border:"#8B5CF6", valueColor:"#8B5CF6" },
          { label:"RÉSOLUS (TOTAL)", value: loading ? "…" : String(resolved),  border:"#22D3A0", valueColor:"#22D3A0" },
          { label:"TOTAL ASSIGNÉS",  value: loading ? "…" : String(stats?.total ?? 0), border:"#f59e0b" },
        ].map((k, i) => (
          <div key={i} style={{ ...card, padding:"18px 20px", borderTop:`3px solid ${k.border}` }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:600, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:k.valueColor||"#0f172a", lineHeight:1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Ticket queue */}
      <div style={card}>
        <div style={{ padding:"18px 20px 0" }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#0f172a" }}>Mes tickets assignés</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:2, marginBottom:14 }}>Triés par date de création (plus récents en premier)</div>
          <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10, padding:3, width:"fit-content", gap:2, marginBottom:16 }}>
            {[["tous","Tous"],["hauts","Priorité haute"],["encours","En cours"]].map(([v,l]) => (
              <button type="button" key={v} onClick={() => setTab(v)} style={{
                padding:"5px 14px", borderRadius:8, border:"none", cursor:"pointer",
                fontSize:12.5, fontWeight: tab===v ? 700 : 500,
                background: tab===v ? "#0f172a" : "transparent",
                color: tab===v ? "#fff" : "#64748b",
              }}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding:"32px", textAlign:"center", color:"#94a3b8" }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:"32px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>Aucun ticket à afficher.</div>
        ) : filtered.slice(0,8).map((t, i) => (
          <div key={t.ticket_id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 20px", borderTop:"1px solid #f1f5f9", cursor:"pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10.5, color:"#94a3b8" }}>#{t.ticket_id}</span>
                {t.priority_label && (
                  <span style={{ padding:"2px 7px", borderRadius:20, fontSize:10.5, fontWeight:700, background:PRIO_BG[t.priority_label]||"#f1f5f9", color:PRIO_COLOR[t.priority_label]||"#64748b" }}>{t.priority_label}</span>
                )}
                {t.category && (
                  <span style={{ padding:"2px 7px", borderRadius:20, fontSize:10.5, fontWeight:600, background:"#f1f5f9", color:"#64748b" }}>{t.category}</span>
                )}
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
              {t.requester_name && <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:2 }}>{t.requester_name}{t.site ? ` — ${t.site}` : ""}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:STATUS_COLOR[t.status]||"#64748b", marginBottom:2 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:STATUS_COLOR[t.status], display:"inline-block", marginRight:4 }} />
                {STATUS_FR[t.status] || t.status}
              </div>
              <div style={{ fontSize:11, color:"#94a3b8" }}>{timeAgo(t.created_at)}</div>
            </div>
            <span style={{ color:"#cbd5e1", fontSize:16 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
