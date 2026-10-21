import { useState, useEffect } from "react";
import { fetchMyRequests } from "../../api/tickets";

function getSupportStatus() {
  const now = new Date();
  const day = now.getDay();   // 0=dim, 6=sam
  const h   = now.getHours();
  if (day === 0 || day === 6) return { label:"Fermé (week-end)", color:"#94a3b8", dot:"#94a3b8", bg:"#f8fafc" };
  if (h >= 8 && h < 17)       return { label:"Disponible",       color:"#16a34a", dot:"#22c55e", bg:"#f0fdf4" };
  if (h >= 7 && h < 8)        return { label:"Ouverture dans 1 h",color:"#d97706",dot:"#f59e0b", bg:"#fffbeb" };
  return { label:"Fermé (hors horaires)", color:"#94a3b8", dot:"#94a3b8", bg:"#f8fafc" };
}

function avgDays(tickets) {
  const resolved = tickets.filter(t => t.resolved_at && t.created_at);
  if (!resolved.length) return null;
  const total = resolved.reduce((sum, t) => {
    return sum + (new Date(t.resolved_at) - new Date(t.created_at));
  }, 0);
  return Math.round(total / resolved.length / 86400000); // ms → jours
}

function topCategories(tickets) {
  const counts = {};
  tickets.forEach(t => {
    if (t.category) counts[t.category] = (counts[t.category] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
}

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff", padding:"20px 24px" };

export default function RequesterServiceStatus() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRequests({ limit: 100 })
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const support = getSupportStatus();

  const total    = tickets.length;
  const open     = tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
  const pending  = tickets.filter(t => t.status === "PENDING").length;
  const resolved = tickets.filter(t => t.status === "RESOLVED" || t.status === "CLOSED").length;
  const rate     = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const avg      = avgDays(tickets);
  const cats     = topCategories(tickets);

  return (
    <div className="adm-body">

      {/* Disponibilité du support */}
      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>Disponibilité du support</div>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 20px", borderRadius:12, background:support.bg, flex:1, minWidth:200 }}>
            <span style={{ width:12, height:12, borderRadius:"50%", background:support.dot, flexShrink:0,
              boxShadow: support.dot === "#22c55e" ? "0 0 0 4px rgba(34,197,94,0.2)" : "none" }} />
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:support.color }}>{support.label}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>Lundi – Vendredi · 08h00 – 17h00</div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:12.5, color:"#64748b" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e" }} />Lun – Ven  08h – 17h : Disponible
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#f59e0b" }} />Lun – Ven  07h – 08h : Ouverture imminente
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#94a3b8" }} />Hors horaires / Week-end : Fermé
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* Mes statistiques */}
        <div style={card}>
          <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>Mes statistiques</div>
          {loading ? (
            <div style={{ color:"#94a3b8", fontSize:13 }}>Chargement…</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Total soumis",    value: total,              color:"#2B45C8" },
                { label:"En cours",        value: open + pending,     color:"#f97316" },
                { label:"Résolus",         value: resolved,           color:"#22c55e" },
                { label:"Taux résolution", value: `${rate} %`,        color:"#8B5CF6" },
              ].map(s => (
                <div key={s.label} style={{ padding:"12px", background:"#f8fafc", borderRadius:10, textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Délai de résolution */}
        <div style={card}>
          <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>Délai moyen de résolution</div>
          {loading ? (
            <div style={{ color:"#94a3b8", fontSize:13 }}>Chargement…</div>
          ) : avg === null ? (
            <div style={{ color:"#94a3b8", fontSize:13, paddingTop:8 }}>Aucun ticket résolu pour l'instant.</div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:12 }}>
                <span style={{ fontSize:42, fontWeight:900, color:"#1E3AAF", lineHeight:1 }}>{avg}</span>
                <span style={{ fontSize:16, fontWeight:600, color:"#64748b", paddingBottom:4 }}>jour{avg > 1 ? "s" : ""}</span>
              </div>
              <div style={{ fontSize:12.5, color:"#64748b", lineHeight:1.6 }}>
                Calculé sur <strong>{tickets.filter(t => t.resolved_at).length}</strong> ticket{tickets.filter(t => t.resolved_at).length > 1 ? "s" : ""} résolu{tickets.filter(t => t.resolved_at).length > 1 ? "s" : ""}.
              </div>
              <div style={{ marginTop:12, height:6, borderRadius:10, background:"#f1f5f9", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:10, background:"#2B45C8",
                  width: `${Math.min(100, Math.max(5, 100 - avg * 8))}%`, transition:"width 0.6s" }} />
              </div>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
                {avg <= 1 ? "Excellent — résolution très rapide" : avg <= 3 ? "Bon — dans les délais normaux" : avg <= 7 ? "Moyen — quelques jours" : "Lent — plus d'une semaine"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Catégories fréquentes */}
      <div style={card}>
        <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:16 }}>Mes catégories les plus fréquentes</div>
        {loading ? (
          <div style={{ color:"#94a3b8", fontSize:13 }}>Chargement…</div>
        ) : cats.length === 0 ? (
          <div style={{ color:"#94a3b8", fontSize:13 }}>Aucune catégorie disponible.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {cats.map(([cat, count]) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={cat}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:600, color:"#0f172a", marginBottom:5 }}>
                    <span>{cat}</span>
                    <span style={{ color:"#64748b", fontWeight:400 }}>{count} ticket{count > 1 ? "s" : ""} · {pct} %</span>
                  </div>
                  <div style={{ height:7, borderRadius:10, background:"#f1f5f9", overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:10, background:"#2B45C8", width:`${pct}%`, transition:"width 0.6s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
