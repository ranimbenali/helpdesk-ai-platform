import { useState, useEffect } from "react";
import { fetchMyStats } from "../../api/tickets";
import { fetchMyProfile } from "../../api/users";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

export default function AgentPerformance() {
  const [stats,   setStats]   = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMyStats(), fetchMyProfile()])
      .then(([s, p]) => { setStats(s); setProfile(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="adm-body" style={{ color:"#94a3b8", padding:32 }}>Chargement…</div>;

  const total    = stats?.total ?? 0;
  const open     = stats?.by_status?.OPEN       ?? 0;
  const inProg   = stats?.by_status?.IN_PROGRESS ?? 0;
  const pending  = stats?.by_status?.PENDING     ?? 0;
  const resolved = (stats?.by_status?.RESOLVED ?? 0) + (stats?.by_status?.CLOSED ?? 0);
  const resolveRate = profile?.stats?.resolve_rate ?? (total > 0 ? Math.round((resolved/total)*100) : 0);

  const STATUS_DATA = [
    { label:"Ouverts",    value:open,     color:"#2B45C8", bg:"#eff6ff" },
    { label:"En cours",   value:inProg,   color:"#8B5CF6", bg:"#f5f3ff" },
    { label:"En attente", value:pending,  color:"#f97316", bg:"#fff7ed" },
    { label:"Résolus",    value:resolved, color:"#22c55e", bg:"#f0fdf4" },
  ];

  return (
    <div className="adm-body">
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
        {[
          { label:"TOTAL ASSIGNÉS",  value:String(total),          border:"#2B45C8" },
          { label:"RÉSOLUS",         value:String(resolved),       border:"#22D3A0", valueColor:"#22D3A0" },
          { label:"TAUX RÉSOLUTION", value:`${resolveRate}%`,      border:"#8B5CF6", valueColor:"#8B5CF6" },
          { label:"EN ATTENTE",      value:String(open + pending), border:"#f59e0b" },
        ].map((k, i) => (
          <div key={i} style={{ ...card, padding:"18px 20px", borderTop:`3px solid ${k.border}` }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:600, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:k.valueColor||"#0f172a", lineHeight:1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div style={{ ...card, padding:24 }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#0f172a", marginBottom:20 }}>Répartition par statut</div>
          {STATUS_DATA.map(s => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <div key={s.label} style={{ marginBottom:18 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:s.color }} />
                    <span style={{ fontSize:13, color:"#334155", fontWeight:500 }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{s.value} <span style={{ color:"#94a3b8", fontWeight:400 }}>({pct}%)</span></span>
                </div>
                <div style={{ height:8, borderRadius:4, background:"#f1f5f9", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:s.color, borderRadius:4, transition:"width 0.5s" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...card, padding:24 }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#0f172a", marginBottom:20 }}>Informations du compte</div>
          {profile ? [
            { label:"Nom",       value:profile.full_name },
            { label:"Email",     value:profile.email },
            { label:"Rôle",      value:profile.role },
            { label:"Statut",    value:profile.status },
            { label:"Membre depuis", value:profile.created_at ? new Date(profile.created_at).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"}) : "—" },
          ].map(f => (
            <div key={f.label} style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
              <span style={{ fontSize:12.5, color:"#64748b" }}>{f.label}</span>
              <span style={{ fontSize:12.5, fontWeight:600, color:"#0f172a" }}>{f.value || "—"}</span>
            </div>
          )) : <div style={{ color:"#94a3b8", fontSize:13 }}>Profil non disponible.</div>}
        </div>
      </div>
    </div>
  );
}
