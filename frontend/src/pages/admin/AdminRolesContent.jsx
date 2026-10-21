import { useEffect, useState } from "react";
import { fetchUsers } from "../../api/users";

const DEFAULT_ROLES = [
  { key:"ADMIN",      label:"Admin",      color:"#8B5CF6", bg:"#f5f3ff", icon:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  )},
  { key:"SUPERVISOR", label:"Superviseur", color:"#F59E0B", bg:"#fffbeb", icon:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
  )},
  { key:"AGENT",      label:"Agent",      color:"#2B45C8", bg:"#eff6ff", icon:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  )},
  { key:"REQUESTER",  label:"Demandeur",  color:"#64748b", bg:"#f8fafc", icon:(
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
  )},
];

const PERM_LABELS = [
  "Voir les tickets",
  "Créer un ticket",
  "Assigner un ticket",
  "Modifier un ticket fermé",
  "Voir tous les tickets",
  "Gérer les utilisateurs",
  "Configurer les SLA",
  "Accéder aux logs d'audit",
  "Gérer la facturation",
];

const DEFAULT_MATRIX = [
  { label:"Voir les tickets",         ADMIN:true,  SUPERVISOR:true,  AGENT:true,  REQUESTER:true  },
  { label:"Créer un ticket",          ADMIN:true,  SUPERVISOR:true,  AGENT:true,  REQUESTER:true  },
  { label:"Assigner un ticket",       ADMIN:true,  SUPERVISOR:true,  AGENT:true,  REQUESTER:false },
  { label:"Modifier un ticket fermé", ADMIN:true,  SUPERVISOR:true,  AGENT:false, REQUESTER:false },
  { label:"Voir tous les tickets",    ADMIN:true,  SUPERVISOR:true,  AGENT:false, REQUESTER:false },
  { label:"Gérer les utilisateurs",   ADMIN:true,  SUPERVISOR:false, AGENT:false, REQUESTER:false },
  { label:"Configurer les SLA",       ADMIN:true,  SUPERVISOR:true,  AGENT:false, REQUESTER:false },
  { label:"Accéder aux logs d'audit", ADMIN:true,  SUPERVISOR:false, AGENT:false, REQUESTER:false },
  { label:"Gérer la facturation",     ADMIN:true,  SUPERVISOR:false, AGENT:false, REQUESTER:false },
];

const ACCENT_COLORS = ["#2B45C8","#22D3A0","#F97316","#EC4899","#6366F1","#14B8A6","#8B5CF6"];

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function AdminRolesContent({ triggerNewRole = 0 }) {
  const [counts, setCounts]       = useState({});
  const [roles, setRoles]         = useState(DEFAULT_ROLES);
  const [matrix, setMatrix]       = useState(DEFAULT_MATRIX.map(r => ({ ...r })));
  const [showModal, setShowModal] = useState(false);
  const [deleteRole, setDeleteRole] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [form, setForm] = useState({ label:"", color: ACCENT_COLORS[0], perms: {} });

  useEffect(() => {
    fetchUsers("", 0, 500).then(users => {
      const c = {};
      users.forEach(u => { c[u.role] = (c[u.role] || 0) + 1; });
      setCounts(c);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (triggerNewRole > 0) openModal();
  }, [triggerNewRole]);

  function openModal() {
    const initPerms = {};
    PERM_LABELS.forEach(p => { initPerms[p] = false; });
    setForm({ label:"", color: ACCENT_COLORS[0], perms: initPerms });
    setShowModal(true);
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!form.label.trim()) return;
    const key = form.label.toUpperCase().replace(/\s+/g,"_");

    // Ajouter la card
    setRoles(prev => [...prev, {
      key, label: form.label,
      color: form.color, bg: form.color + "18",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
      custom: true,
    }]);

    // Ajouter colonne dans la matrice
    setMatrix(prev => prev.map(row => ({
      ...row,
      [key]: form.perms[row.label] || false,
    })));

    setShowModal(false);
  }

  function toggleCell(rowIdx, roleKey) {
    if (roleKey === "ADMIN") return;
    setMatrix(prev => prev.map((row, i) =>
      i === rowIdx ? { ...row, [roleKey]: !row[roleKey] } : row
    ));
  }

  function removeCustomRole(key) {
    setRoles(prev => prev.filter(r => r.key !== key));
    setMatrix(prev => prev.map(row => {
      const r = { ...row };
      delete r[key];
      return r;
    }));
    setDeleteRole(null);
  }

  const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" };

  return (
    <div className="adm-body">

      {/* ── Role cards ── */}
      <div style={{ display:"flex", gap:16, marginBottom:20, flexWrap:"wrap" }}>
        {roles.map(r => (
          <div key={r.key} style={{ ...card, padding:"20px 22px", flex:"1 1 180px", minWidth:160, position:"relative" }}>
            {r.custom && (
              <button onClick={() => setDeleteRole(r)} title="Supprimer ce rôle"
                style={{ position:"absolute", top:10, right:10, background:"none", border:"none",
                  cursor:"pointer", color:"#cbd5e1", fontSize:16, lineHeight:1, padding:4 }}
                onMouseEnter={e => e.currentTarget.style.color="#e53935"}
                onMouseLeave={e => e.currentTarget.style.color="#cbd5e1"}>
                ×
              </button>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:r.bg,
                color:r.color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {r.icon}
              </div>
              <span style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700,
                fontSize:15, color:"#0f172a" }}>{r.label}</span>
            </div>
            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800,
              fontSize:32, color:"#0f172a", lineHeight:1, marginBottom:4 }}>
              {counts[r.key] ?? 0}
            </div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>utilisateurs assignés</div>
          </div>
        ))}
      </div>

      {/* ── Permission matrix ── */}
      <div style={{ ...card, overflow:"auto" }}>
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #f1f5f9" }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:16, color:"#0f172a" }}>
            Matrice des permissions
          </div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:3 }}>
            Cliquez une cellule pour modifier · Admin toujours actif
          </div>
        </div>

        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
          <thead>
            <tr style={{ background:"#f8fafc" }}>
              <th style={{ padding:"12px 24px", textAlign:"left", fontSize:10, fontWeight:700,
                color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase",
                fontFamily:"'JetBrains Mono',monospace", borderBottom:"1px solid #f1f5f9", width:"35%" }}>
                PERMISSION
              </th>
              {roles.map(r => (
                <th key={r.key} style={{ padding:"12px 16px", textAlign:"center",
                  fontSize:10, fontWeight:700, color:r.color,
                  letterSpacing:"0.1em", textTransform:"uppercase",
                  fontFamily:"'JetBrains Mono',monospace", borderBottom:"1px solid #f1f5f9" }}>
                  {r.label.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((perm, rowIdx) => (
              <tr key={perm.label}
                style={{ borderBottom:"1px solid #f8fafc",
                  background: hoveredRow === rowIdx ? "#fafbff" : "transparent",
                  transition:"background 0.15s" }}
                onMouseEnter={() => setHoveredRow(rowIdx)}
                onMouseLeave={() => setHoveredRow(null)}>
                <td style={{ padding:"14px 24px", fontSize:14, color:"#334155", fontWeight:500 }}>
                  {perm.label}
                </td>
                {roles.map(r => (
                  <td key={r.key}
                    style={{ padding:"14px 16px", textAlign:"center",
                      cursor: r.key==="ADMIN" ? "default" : "pointer" }}
                    onClick={() => toggleCell(rowIdx, r.key)}>
                    {perm[r.key]
                      ? <CheckIcon />
                      : <span style={{ color:"#cbd5e1", fontSize:16, fontWeight:600 }}>—</span>
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal Nouveau rôle ── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(11,26,82,0.55)",
          zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => setShowModal(false)}>
          <div style={{ background:"#fff", borderRadius:18, padding:32, width:480,
            boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>

            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:18, color:"#0f172a", marginBottom:4 }}>
              Nouveau rôle
            </div>
            <p style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>
              Définissez un nom, une couleur et les permissions de ce rôle.
            </p>

            <form onSubmit={handleCreate} style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Nom */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.08em",
                  textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", display:"block", marginBottom:6 }}>
                  Nom du rôle
                </label>
                <input value={form.label} required
                  onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="Ex: Comptable, Manager..."
                  style={{ width:"100%", height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                    borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit" }} />
              </div>

              {/* Couleur */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.08em",
                  textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", display:"block", marginBottom:8 }}>
                  Couleur
                </label>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {ACCENT_COLORS.map(c => (
                    <button key={c} type="button"
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      style={{ width:28, height:28, borderRadius:"50%", background:c, border:"none",
                        cursor:"pointer", outline: form.color===c ? `3px solid ${c}` : "none",
                        outlineOffset:2, transition:"outline 0.15s" }} />
                  ))}
                </div>
              </div>

              {/* Permissions */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:"0.08em",
                  textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", display:"block", marginBottom:10 }}>
                  Permissions
                </label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 16px",
                  maxHeight:220, overflowY:"auto", paddingRight:4 }}>
                  {PERM_LABELS.map(p => (
                    <label key={p} style={{ display:"flex", alignItems:"center", gap:8,
                      fontSize:13, color:"#334155", cursor:"pointer" }}>
                      <input type="checkbox" checked={form.perms[p] || false}
                        onChange={e => setForm(prev => ({
                          ...prev, perms: { ...prev.perms, [p]: e.target.checked }
                        }))}
                        style={{ accentColor: form.color, width:15, height:15, cursor:"pointer" }} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button type="submit"
                  style={{ flex:1, height:44, background:"#1E3AAF", color:"#fff",
                    border:"none", borderRadius:10, fontWeight:700, fontSize:14,
                    cursor:"pointer", fontFamily:"inherit" }}>
                  Créer le rôle
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex:1, height:44, background:"#f1f5f9", color:"#334155",
                    border:"none", borderRadius:10, fontWeight:600, fontSize:14,
                    cursor:"pointer", fontFamily:"inherit" }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Supprimer rôle ── */}
      {deleteRole && (
        <div style={{ position:"fixed", inset:0, background:"rgba(11,26,82,0.55)",
          zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => setDeleteRole(null)}>
          <div style={{ background:"#fff", borderRadius:18, padding:32, width:380,
            boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:18, color:"#e53935", marginBottom:12 }}>
              Supprimer le rôle
            </div>
            <p style={{ fontSize:13, color:"#64748b", marginBottom:20 }}>
              Voulez-vous supprimer le rôle <strong style={{ color:"#0f172a" }}>"{deleteRole.label}"</strong> ?
              Cette action supprimera aussi sa colonne dans la matrice.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => removeCustomRole(deleteRole.key)}
                style={{ flex:1, height:44, background:"#e53935", color:"#fff",
                  border:"none", borderRadius:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Supprimer
              </button>
              <button onClick={() => setDeleteRole(null)}
                style={{ flex:1, height:44, background:"#f1f5f9", color:"#334155",
                  border:"none", borderRadius:10, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
