import { useEffect, useState } from "react";
import { fetchUsers } from "../../api/users";
import { fetchSupervisorStats, fetchTickets } from "../../api/tickets";

const PAGE_SIZE = 6;

const AVATAR_COLORS = [
  "#2B45C8","#22D3A0","#F59E0B","#8B5CF6",
  "#e53935","#0ea5e9","#10b981","#f97316",
];

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function roleLabel(role) {
  if (role === "SUPERVISOR") return "Superviseur";
  if (role === "ADMIN")      return "Administrateur";
  if (role === "AGENT")      return "Agent";
  return role || "—";
}

function IconTicket() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>;
}
function IconMail() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}

function AgentCard({ agent, idx, ticketCount, openCount }) {
  const color  = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const active = agent.status === "ACTIVE";

  return (
    <div style={{
      background:"#fff", borderRadius:12, padding:"14px 16px",
      boxShadow:"0 2px 8px rgba(0,0,0,0.06)", border:"1px solid #f0f2f9",
      transition:"box-shadow .2s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.09)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"}
    >
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{
            width:36, height:36, borderRadius:"50%", background:color,
            color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:12, fontWeight:800, flexShrink:0,
          }}>
            {initials(agent.full_name)}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#0f172a" }}>{agent.full_name}</div>
            <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>{agent.email}</div>
          </div>
        </div>
        <span style={{
          fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
          background: active ? "#f0fdf4" : "#f1f5f9",
          color:      active ? "#16a34a" : "#94a3b8",
          border:`1px solid ${active ? "#bbf7d0" : "#e2e8f0"}`,
        }}>
          {active ? "Actif" : "Inactif"}
        </span>
      </div>

      {/* Rôle + Stats sur la même ligne */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:6, background:"#eff6ff", color:"#2B45C8" }}>
          {roleLabel(agent.role)}
        </span>
        <div style={{ display:"flex", gap:16 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:8, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"var(--font-mono)" }}>TOTAL</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#0f172a", lineHeight:1.2 }}>{ticketCount ?? 0}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:8, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"var(--font-mono)" }}>EN COURS</div>
            <div style={{ fontSize:16, fontWeight:800, color:(openCount??0)>10?"#F59E0B":"#0f172a", lineHeight:1.2 }}>{openCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, borderTop:"1px solid #f1f5f9", paddingTop:10 }}>
        {[
          { icon:<IconTicket />, label:"Tickets" },
          { icon:<IconMail />,   label:"Message" },
        ].map(btn => (
          <button key={btn.label} style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:4,
            height:28, borderRadius:7, border:"1.5px solid #e8ecf7",
            background:"#fff", color:"#64748b", fontSize:11, fontWeight:600,
            cursor:"pointer", fontFamily:"var(--font)",
          }}
            onMouseEnter={e => { e.currentTarget.style.background="#f8faff"; e.currentTarget.style.color="#2B45C8"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#fff";    e.currentTarget.style.color="#64748b"; }}
          >
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SupervisorAgentsContent({ searchQuery = "" }) {
  const [agents,  setAgents]  = useState([]);
  const [byAgent, setByAgent] = useState({});
  const [openMap, setOpenMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [page,    setPage]    = useState(0);
  const [filter,  setFilter]  = useState("all"); // all | active | inactive

  useEffect(() => {
    async function load() {
      try {
        const [users, stats, openTickets] = await Promise.all([
          fetchUsers(),
          fetchSupervisorStats(),
          fetchTickets({ status: "OPEN", limit: 200 }),
        ]);

        const list = (users || []).filter(u => ["AGENT","SUPERVISOR"].includes(u.role));
        setAgents(list);

        const agentMap = {};
        (stats?.by_agent || []).forEach(a => { agentMap[a.full_name] = a.count; });
        setByAgent(agentMap);

        const openCounts = {};
        (openTickets || []).forEach(t => {
          if (t.assignee_name) openCounts[t.assignee_name] = (openCounts[t.assignee_name] || 0) + 1;
        });
        setOpenMap(openCounts);
      } catch (e) {
        setError(e.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => { setPage(0); }, [searchQuery]);

  const activeCount   = agents.filter(a => a.status === "ACTIVE").length;
  const inactiveCount = agents.length - activeCount;

  const byStatus = filter === "active"   ? agents.filter(a => a.status === "ACTIVE")
                  : filter === "inactive" ? agents.filter(a => a.status !== "ACTIVE")
                  : agents;

  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? byStatus : byStatus.filter(a =>
    a.full_name?.toLowerCase().includes(q) ||
    a.email?.toLowerCase().includes(q)
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const TAB_STYLE = (key) => ({
    padding:"6px 16px", borderRadius:8, border:"none", cursor:"pointer",
    fontFamily:"inherit", fontSize:13,
    fontWeight: filter === key ? 700 : 500,
    background: filter === key ? "#1E3AAF" : "transparent",
    color:      filter === key ? "#fff"    : "#64748b",
    transition:"all 0.15s",
  });

  return (
    <div className="adm-body">

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0f172a" }}>
            {loading ? "Agents du support" : `Agents du support (${agents.length})`}
          </div>
          {!loading && (
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>
              <span style={{ color:"#22D3A0", fontWeight:700 }}>{activeCount} actif{activeCount > 1 ? "s" : ""}</span>
              {inactiveCount > 0 && <> · <span style={{ fontWeight:700 }}>{inactiveCount} inactif{inactiveCount > 1 ? "s" : ""}</span></>}
            </div>
          )}
        </div>

        {/* Tabs filtre */}
        <div style={{ display:"flex", gap:4, background:"#f8fafc", borderRadius:10, padding:4 }}>
          <button style={TAB_STYLE("all")}      onClick={() => { setFilter("all");      setPage(0); }}>Tous</button>
          <button style={TAB_STYLE("active")}   onClick={() => { setFilter("active");   setPage(0); }}>Actifs</button>
          <button style={TAB_STYLE("inactive")} onClick={() => { setFilter("inactive"); setPage(0); }}>Inactifs</button>
        </div>
      </div>

      {error && (
        <div style={{ background:"#fef2f2", color:"#e53935", padding:"12px 16px", borderRadius:10, marginBottom:16, fontSize:13 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#94a3b8", fontSize:14 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background:"#fff", borderRadius:14, padding:48, boxShadow:"var(--shadow-card)", textAlign:"center" }}>
          <div style={{ fontSize:14, color:"#94a3b8" }}>Aucun agent dans cette catégorie.</div>
        </div>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {paginated.map((agent, i) => (
              <AgentCard
                key={agent.user_id}
                agent={agent}
                idx={page * PAGE_SIZE + i}
                ticketCount={byAgent[agent.full_name] ?? null}
                openCount={openMap[agent.full_name] ?? null}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:20 }}>
              <span style={{ fontSize:12, color:"#94a3b8" }}>
                {page * PAGE_SIZE + 1}–{Math.min((page+1)*PAGE_SIZE, filtered.length)} sur {filtered.length} agents
              </span>
              <div style={{ display:"flex", gap:4 }}>
                <button disabled={page===0} onClick={() => setPage(p => p-1)}
                  style={{ width:30, height:30, borderRadius:6, border:"1.5px solid #e8ecf7", background:"#fff", cursor:page===0?"not-allowed":"pointer", color:page===0?"#cbd5e1":"#334155" }}>‹</button>
                {Array.from({ length: totalPages }, (_,i) => (
                  <button key={i} onClick={() => setPage(i)}
                    style={{ width:30, height:30, borderRadius:6, border:"1.5px solid", borderColor:i===page?"#1E3AAF":"#e8ecf7",
                      background:i===page?"#1E3AAF":"#fff", color:i===page?"#fff":"#64748b",
                      fontWeight:i===page?700:400, fontSize:12, cursor:"pointer" }}>{i+1}</button>
                ))}
                <button disabled={page>=totalPages-1} onClick={() => setPage(p => p+1)}
                  style={{ width:30, height:30, borderRadius:6, border:"1.5px solid #e8ecf7", background:"#fff", cursor:page>=totalPages-1?"not-allowed":"pointer", color:page>=totalPages-1?"#cbd5e1":"#334155" }}>›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
