import { useEffect, useState, useCallback } from "react";
import { fetchUsers, createUser, updateUser, deleteUser } from "../../api/users";

const PAGE_SIZE = 10;

const AVATAR_COLORS = [
  "#F97316","#8B5CF6","#06B6D4","#22C55E",
  "#EF4444","#EC4899","#3B82F6","#F59E0B","#14B8A6","#6366F1",
];
function avatarColor(name = "") {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

const ROLE_STYLE = {
  ADMIN:      { bg: "#f0f0ff", color: "#6366F1", label: "Admin" },
  AGENT:      { bg: "#eff6ff", color: "#2563EB", label: "Agent" },
  SUPERVISOR: { bg: "#fff7ed", color: "#D97706", label: "Superviseur" },
  REQUESTER:  { bg: "#f0fdf4", color: "#16A34A", label: "Demandeur" },
};

const IcSearch  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IcPlus    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>;
const IcChevL   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>;
const IcChevR   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>;
const IcEdit    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcLock    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcUnlock  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;
const IcTrash   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>;

export default function AdminUsersContent({ triggerNewUser = 0 }) {
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [roleFilter, setRoleFilter]   = useState("");
  const [statusTab, setStatusTab]     = useState("ALL");
  const [page, setPage]               = useState(1);
  const [showModal, setShowModal]     = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [toggling, setToggling]       = useState(null);
  const [form, setForm]               = useState({
    full_name:"", email:"", password:"", role:"REQUESTER", status:"ACTIVE", fonction:"",
  });

  const loadUsers = useCallback(async () => {
    try { setLoading(true); setError("");
      const data = await fetchUsers("", 0, 200);
      setUsers(data);
    } catch (err) { setError(err.message || "Erreur"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (triggerNewUser > 0) openCreate(); }, [triggerNewUser]);

  function openCreate() {
    setEditingUser(null);
    setForm({ full_name:"", email:"", password:"", role:"REQUESTER", status:"ACTIVE", fonction:"" });
    setShowModal(true);
  }
  function openEdit(u) {
    setEditingUser(u);
    setForm({
      full_name:u.full_name, email:u.email, password:"", role:u.role,
      status:u.status, fonction:u.fonction||"",
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError("");
    try {
      if (editingUser) await updateUser(editingUser.user_id, form);
      else             await createUser(form);
      setShowModal(false); await loadUsers();
    } catch (err) { setError(err.message || "Erreur"); }
  }

  async function handleToggleStatus(u) {
    setToggling(u.user_id);
    try {
      const newStatus = u.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
      await updateUser(u.user_id, { ...u, status: newStatus, password: "" });
      await loadUsers();
    } catch (err) { setError(err.message || "Erreur"); }
    finally { setToggling(null); }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    try { setDeleting(true);
      await deleteUser(deleteConfirm.user_id);
      setDeleteConfirm(null); await loadUsers();
    } catch (err) { setError(err.message); setDeleteConfirm(null); }
    finally { setDeleting(false); }
  }

  /* ── Counts ── */
  const activeCount   = users.filter(u => u.status === "ACTIVE").length;
  const archivedCount = users.filter(u => u.status === "ARCHIVED").length;
  const totalUsers    = users.length;

  const STATUS_TABS = [
    { key:"ALL",      label:"Tous",     count: totalUsers   },
    { key:"ACTIVE",   label:"Actifs",   count: activeCount  },
    { key:"ARCHIVED", label:"Archivés", count: archivedCount },
  ];

  /* ── Filtrage + pagination ── */
  const filtered = users.filter(u => {
    if (search && !u.full_name?.toLowerCase().includes(search.toLowerCase()) &&
        !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusTab !== "ALL" && u.status !== statusTab) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, roleFilter, statusTab]);

  const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" };
  const inputBase = { height:38, padding:"0 12px", border:"1.5px solid #e8ecf7", borderRadius:9,
    fontSize:12.5, outline:"none", fontFamily:"inherit", background:"#fff", color:"#0f172a" };

  return (
    <div className="adm-body">

      {/* ── Main card ── */}
      <div style={card}>

        {/* ── Card header ── */}
        <div style={{ padding:"18px 24px 0", borderBottom:"1px solid #f1f5f9" }}>
          {/* ── Status tabs ── */}
          <div style={{ display:"flex", gap:0 }}>
            {STATUS_TABS.map(tab => {
              const active = statusTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setStatusTab(tab.key)}
                  style={{ padding:"9px 18px", border:"none", background:"transparent",
                    fontFamily:"inherit", fontSize:13, fontWeight: active ? 700 : 500,
                    color: active ? "#1E3AAF" : "#64748b",
                    borderBottom: active ? "2.5px solid #1E3AAF" : "2.5px solid transparent",
                    cursor:"pointer", whiteSpace:"nowrap", marginBottom:-1, transition:"color 0.15s" }}>
                  {tab.label}
                  <span style={{ marginLeft:6, padding:"2px 7px", borderRadius:20,
                    background: active ? "#e8edff" : "#f1f5f9",
                    color: active ? "#1E3AAF" : "#94a3b8",
                    fontSize:11, fontWeight:700 }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Filters row ── */}
        <div style={{ padding:"12px 24px", display:"flex", gap:8, alignItems:"center",
          borderBottom:"1px solid #f1f5f9", background:"#fafbff" }}>
          <div style={{ position:"relative", flex:1, maxWidth:320 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", display:"flex" }}>
              <IcSearch />
            </span>
            <input type="text" placeholder="Rechercher par nom ou email..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputBase, width:"100%", paddingLeft:30 }} />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ ...inputBase, cursor:"pointer",
              color: roleFilter ? "#1E3AAF" : "#64748b",
              fontWeight: roleFilter ? 700 : 400 }}>
            <option value="">Tous les rôles</option>
            <option value="ADMIN">Admin</option>
            <option value="AGENT">Agent</option>
            <option value="SUPERVISOR">Superviseur</option>
            <option value="REQUESTER">Demandeur</option>
          </select>
          {(search || roleFilter) && (
            <button onClick={() => { setSearch(""); setRoleFilter(""); }}
              style={{ height:38, padding:"0 12px", border:"none", borderRadius:9,
                background:"#fee2e2", color:"#dc2626", fontSize:12, fontWeight:700,
                cursor:"pointer", fontFamily:"inherit" }}>
              ✕ Effacer
            </button>
          )}
        </div>

        {error && <div style={{ padding:"10px 24px", background:"#fef2f2", color:"#e53935", fontSize:12 }}>{error}</div>}

        {/* ── Table ── */}
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>Chargement...</div>
        ) : (
          <>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["#", "NOM", "EMAIL", "RÔLE", "STATUT", "ACTIONS"].map((h, i) => (
                    <th key={i} style={{
                      padding:"10px 16px", textAlign: i === 5 ? "center" : "left",
                      fontSize:10, fontWeight:700, color:"#94a3b8",
                      letterSpacing:"0.1em", textTransform:"uppercase",
                      fontFamily:"'JetBrains Mono',monospace",
                      borderBottom:"1px solid #f1f5f9",
                      width: i === 0 ? 48 : "auto",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>
                    Aucun utilisateur trouvé
                  </td></tr>
                ) : paginated.map((u, idx) => {
                  const role     = ROLE_STYLE[u.role] || ROLE_STYLE.REQUESTER;
                  const isActive = u.status === "ACTIVE";
                  const rowNum   = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={u.user_id}
                      style={{ borderBottom:"1px solid #f8fafc", transition:"background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background="#fafbff"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}>

                      {/* # */}
                      <td style={{ padding:"13px 16px", fontSize:12, color:"#94a3b8",
                        fontFamily:"'JetBrains Mono',monospace", textAlign:"center" }}>
                        {rowNum}
                      </td>

                      {/* Avatar + nom */}
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:36, height:36, borderRadius:"50%",
                            background:avatarColor(u.full_name),
                            display:"flex", alignItems:"center", justifyContent:"center",
                            color:"#fff", fontWeight:700, fontSize:13, flexShrink:0 }}>
                            {initials(u.full_name)}
                          </div>
                          <div style={{ fontWeight:600, fontSize:13, color:"#0f172a" }}>{u.full_name}</div>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding:"13px 16px", fontSize:12.5, color:"#64748b" }}>
                        {u.email}
                      </td>

                      {/* Rôle */}
                      <td style={{ padding:"13px 16px" }}>
                        <span style={{ padding:"3px 12px", borderRadius:20,
                          background:role.bg, color:role.color,
                          fontSize:11.5, fontWeight:600 }}>{role.label}</span>
                      </td>

                      {/* Statut */}
                      <td style={{ padding:"13px 16px" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5,
                          fontSize:12, fontWeight:600,
                          color: isActive ? "#15803D" : "#94a3b8" }}>
                          <span style={{ width:7, height:7, borderRadius:"50%", display:"inline-block",
                            background: isActive ? "#22c55e" : "#94a3b8" }} />
                          {isActive ? "Actif" : "Archivé"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding:"13px 16px" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                          {/* Modifier */}
                          <button onClick={() => openEdit(u)}
                            style={{ display:"inline-flex", alignItems:"center", gap:5,
                              height:30, padding:"0 10px",
                              border:"1.5px solid #c7d2fe", borderRadius:7,
                              background:"#f0f4ff", color:"#3b5bdb",
                              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                              whiteSpace:"nowrap" }}>
                            <IcEdit /> Modifier
                          </button>

                          {/* Activer / Désactiver */}
                          <button onClick={() => handleToggleStatus(u)}
                            disabled={toggling === u.user_id}
                            style={{ display:"inline-flex", alignItems:"center", gap:5,
                              height:30, padding:"0 10px",
                              border: isActive ? "1.5px solid #fca5a5" : "1.5px solid #86efac",
                              borderRadius:7,
                              background: isActive ? "#fff1f1" : "#f0fdf4",
                              color: isActive ? "#dc2626" : "#16a34a",
                              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                              whiteSpace:"nowrap",
                              opacity: toggling === u.user_id ? 0.6 : 1 }}>
                            {isActive ? <><IcLock /> Désactiver</> : <><IcUnlock /> Activer</>}
                          </button>

                          {/* Supprimer */}
                          <button onClick={() => setDeleteConfirm(u)}
                            title="Supprimer"
                            style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                              width:30, height:30,
                              border:"1.5px solid #e8ecf7", borderRadius:7,
                              background:"#fff", color:"#94a3b8",
                              cursor:"pointer", flexShrink:0,
                              transition:"border-color 0.15s, color 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor="#fca5a5"; e.currentTarget.style.color="#e53935"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor="#e8ecf7"; e.currentTarget.style.color="#94a3b8"; }}>
                            <IcTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{ padding:"14px 24px", borderTop:"1px solid #f1f5f9",
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:12, color:"#94a3b8" }}>
                  Page <strong style={{ color:"#0f172a" }}>{page}</strong> sur{" "}
                  <strong style={{ color:"#0f172a" }}>{totalPages}</strong>
                  &nbsp;·&nbsp; {filtered.length} utilisateurs
                </div>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page===1}
                    style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #e8ecf7",
                      background:"#fff", color: page===1?"#cbd5e1":"#334155",
                      cursor: page===1?"not-allowed":"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <IcChevL />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width:32, height:32, borderRadius:8, border:"1.5px solid",
                        borderColor: p===page ? "#1E3AAF":"#e8ecf7",
                        background: p===page ? "#1E3AAF":"#fff",
                        color: p===page ? "#fff":"#64748b",
                        fontWeight: p===page ? 700:400,
                        fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(p+1, totalPages))} disabled={page===totalPages}
                    style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #e8ecf7",
                      background:"#fff", color: page===totalPages?"#cbd5e1":"#334155",
                      cursor: page===totalPages?"not-allowed":"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <IcChevR />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal Ajout/Édition ── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(11,26,82,0.55)",
          zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => setShowModal(false)}>
          <div style={{ background:"#fff", borderRadius:18, padding:32, width:500,
            maxHeight:"90vh", overflowY:"auto",
            boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>

            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:18, color:"#0f172a", marginBottom:4 }}>
              {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </div>
            <p style={{ fontSize:13, color:"#94a3b8", marginBottom:22 }}>
              {editingUser ? "Modifiez les informations du compte." : "Créez un nouveau compte utilisateur."}
            </p>

            {error && <div style={{ padding:10, background:"#fef2f2", borderRadius:8, color:"#e53935", fontSize:12, marginBottom:14 }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <input name="full_name" type="text" placeholder="Nom complet" required
                value={form.full_name}
                onChange={e => setForm(p => ({...p, full_name:e.target.value}))}
                style={{ height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                  borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit",
                  color:"#0f172a", background:"#fff" }} />

              <input name="email" type="email" placeholder="Adresse email" required
                value={form.email}
                onChange={e => setForm(p => ({...p, email:e.target.value}))}
                style={{ height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                  borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit",
                  color:"#0f172a", background:"#fff" }} />

              <input name="password" type="password"
                placeholder={editingUser ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe"}
                required={!editingUser}
                value={form.password}
                onChange={e => setForm(p => ({...p, password:e.target.value}))}
                style={{ height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                  borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit",
                  color:"#0f172a", background:"#fff" }} />

              <div>
                <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b",
                  textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5 }}>Rôle</label>
                <select name="role" value={form.role}
                  onChange={e => setForm(p => ({...p, role:e.target.value}))}
                  style={{ width:"100%", height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                    borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit",
                    background:"#fff", color:"#0f172a", cursor:"pointer" }}>
                  <option value="REQUESTER">Demandeur</option>
                  <option value="AGENT">Agent</option>
                  <option value="SUPERVISOR">Superviseur</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {editingUser && (
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#64748b",
                    textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:5 }}>Statut</label>
                  <select name="status" value={form.status}
                    onChange={e => setForm(p => ({...p, status:e.target.value}))}
                    style={{ width:"100%", height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                      borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit",
                      background:"#fff", color:"#0f172a", cursor:"pointer" }}>
                    <option value="ACTIVE">Actif</option>
                    <option value="ARCHIVED">Archivé</option>
                  </select>
                </div>
              )}

              {form.role !== "REQUESTER" && (
                <input name="fonction" type="text"
                  placeholder="Fonction (ex : Technicien réseau, Responsable IT…)"
                  value={form.fonction}
                  onChange={e => setForm(p => ({...p, fonction:e.target.value}))}
                  style={{ height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                    borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit",
                    color:"#0f172a", background:"#fff" }} />
              )}

              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button type="submit" style={{ flex:1, height:44, background:"#1E3AAF", color:"#fff",
                  border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                  {editingUser ? "Enregistrer" : "Créer"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex:1, height:44, background:"#f1f5f9", color:"#334155",
                    border:"none", borderRadius:10, fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Suppression ── */}
      {deleteConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(11,26,82,0.55)",
          zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => !deleting && setDeleteConfirm(null)}>
          <div style={{ background:"#fff", borderRadius:18, padding:32, width:400,
            boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:18, color:"#e53935", marginBottom:16 }}>Confirmer la suppression</div>
            <div style={{ padding:14, background:"#fef2f2", borderRadius:10, marginBottom:16 }}>
              <div style={{ fontWeight:700, color:"#e53935" }}>{deleteConfirm.full_name}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{deleteConfirm.email}</div>
            </div>
            <p style={{ fontSize:13, color:"#94a3b8", marginBottom:20 }}>Cette action est irréversible.</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleConfirmDelete} disabled={deleting}
                style={{ flex:1, height:44, background:"#e53935", color:"#fff",
                  border:"none", borderRadius:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
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
