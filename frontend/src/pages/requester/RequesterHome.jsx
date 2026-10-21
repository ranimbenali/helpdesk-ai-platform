import { useState, useEffect } from "react";
import { fetchMyRequests } from "../../api/tickets";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

const STATUS_FR    = { OPEN:"Ouvert", IN_PROGRESS:"En cours", PENDING:"En attente", RESOLVED:"Résolu", CLOSED:"Fermé" };
const STATUS_COLOR = { OPEN:"#2563eb", IN_PROGRESS:"#2B45C8", PENDING:"#f97316", RESOLVED:"#22c55e", CLOSED:"#94a3b8" };
const STATUS_BG    = { OPEN:"#eff6ff", IN_PROGRESS:"#eff6ff", PENDING:"#fff7ed", RESOLVED:"#f0fdf4", CLOSED:"#f8fafc" };

function timeAgo(d) {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 3600)  return "Il y a " + Math.floor(s/60) + " min";
  if (s < 86400) return "Il y a " + Math.floor(s/3600) + " h";
  if (s < 604800)return "Il y a " + Math.floor(s/86400) + " j";
  return "Il y a " + Math.floor(s/604800) + " sem";
}

export default function RequesterHome({ user, onNavigate, searchQuery = "" }) {
  const [allTickets, setAllTickets] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetchMyRequests({ limit: 100 })
      .then(setAllTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tickets  = allTickets.slice(0, 4);
  const firstName = user?.full_name?.split(" ")[0] || "Pierre";
  const open     = allTickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const pending  = allTickets.filter(t => t.status === "PENDING").length;
  const resolved = allTickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length;

  return (
    <div className="adm-body">
      {/* Hero */}
      <div style={{ marginBottom:20 }}>
        <div style={{ background:"linear-gradient(135deg,#1E3AAF 0%,#2B45C8 50%,#1a2fa0 100%)", borderRadius:16, padding:"36px 36px 32px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.12)", padding:"5px 12px", borderRadius:20, marginBottom:20 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#22D3A0" }} />
            <span style={{ fontSize:11, fontWeight:700, color:"#22D3A0", textTransform:"uppercase", letterSpacing:"0.06em" }}>Support disponible</span>
          </div>
          <div style={{ fontSize:26, fontWeight:800, color:"#fff", lineHeight:1.3, marginBottom:10 }}>
            Une question ou un souci ?<br />
            <span style={{ color:"#A6BBFF" }}>Décrivez-le en quelques mots.</span>
          </div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)", marginBottom:28, lineHeight:1.7 }}>
            Notre équipe traite votre demande et vous tient informé à chaque étape.
          </div>
          <div style={{ display:"flex", gap:12 }}>
            <button type="button" onClick={() => onNavigate("new")} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"#fff", color:"#1E3AAF", border:"none", borderRadius:10, fontWeight:700, fontSize:13.5, cursor:"pointer" }}>
              + Créer un ticket
            </button>
            <button type="button" onClick={() => onNavigate("convs")} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 20px", background:"transparent", color:"#fff", border:"2px solid rgba(255,255,255,0.35)", borderRadius:10, fontWeight:700, fontSize:13.5, cursor:"pointer" }}>
              Mes conversations
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:16 }}>
        {/* My tickets */}
        <div style={card}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #f1f5f9" }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Mes tickets</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>{open} ouvert{open > 1 ? "s" : ""} · {resolved} résolu{resolved > 1 ? "s" : ""}</div>
            </div>
            <button type="button" onClick={() => onNavigate("tickets")} style={{ fontSize:13, color:"#2B45C8", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>Voir tout →</button>
          </div>
          {loading ? (
            <div style={{ padding:24, textAlign:"center", color:"#94a3b8", fontSize:13 }}>Chargement…</div>
          ) : tickets.length === 0 ? (
            <div style={{ padding:24, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
              Aucun ticket. <button type="button" onClick={() => onNavigate("new")} style={{ color:"#2B45C8", fontWeight:700, background:"none", border:"none", cursor:"pointer" }}>Créer le premier →</button>
            </div>
          ) : tickets
              .filter(t => !searchQuery || t.title?.toLowerCase().includes(searchQuery.toLowerCase()))
              .slice(0,4).map((t, i, arr) => (
            <div key={t.ticket_id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom: i < arr.length-1 ? "1px solid #f8fafc" : "none", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width:32, height:32, borderRadius:9, background:STATUS_BG[t.status]||"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {t.status === "RESOLVED" || t.status === "CLOSED"
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : t.status === "PENDING"
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                }
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10.5, color:"#94a3b8" }}>#{t.ticket_id}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:STATUS_COLOR[t.status]||"#64748b", display:"flex", alignItems:"center", gap:3 }}>
                    <span style={{ width:5, height:5, borderRadius:"50%", background:STATUS_COLOR[t.status] }} />
                    {STATUS_FR[t.status] || t.status}
                  </span>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.title}</div>
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{timeAgo(t.created_at)}</div>
              </div>
              <span style={{ color:"#cbd5e1", fontSize:16 }}>›</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ ...card, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0f172a", marginBottom:14 }}>Suivi rapide</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[
              { label:"Ouverts",    value: loading ? "…" : String(open),    color:"#2B45C8" },
              { label:"En attente", value: loading ? "…" : String(pending), color:"#f97316" },
              { label:"Résolus",    value: loading ? "…" : String(resolved),color:"#22c55e" },
              { label:"Total",      value: loading ? "…" : String(allTickets.length),  color:"#8B5CF6" },
            ].map(s => (
              <div key={s.label} style={{ padding:"12px", background:"#f8fafc", borderRadius:10, textAlign:"center" }}>
                <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
