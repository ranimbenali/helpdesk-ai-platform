import { useState, useEffect } from "react";
import { fetchMyProfile, updateMyProfile, uploadMyAvatar, changeMyPassword } from "../../api/users";
import { API_BASE } from '../../api/config.js';

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

const LEFT_NAV = [
  { id:"profile", label:"Profil",        icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id:"notifs",  label:"Notifications", icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
  { id:"security",label:"Sécurité",      icon:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
];

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:12, border:"none", cursor:"pointer", background: value ? "#2B45C8" : "#e2e8f0", padding:2, display:"flex", alignItems:"center", justifyContent: value ? "flex-end" : "flex-start", transition:"background 0.2s", flexShrink:0 }}>
      <span style={{ width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.2)", display:"block" }} />
    </button>
  );
}

function PasswordInput({ value, onChange, show, onToggle }) {
  return (
    <div style={{ position:"relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        placeholder="••••••••" style={{ ...input, paddingRight:44 }} />
      <button type="button" onClick={onToggle}
        style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:14, padding:0, color:"#94a3b8" }}>
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

const input = { height:40, padding:"0 12px", border:"1.5px solid #e8ecf7", borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };

const NOTIFS = [
  { label:"Nouveau ticket assigné",   hint:"", key:"newTicket" },
  { label:"Réponse du demandeur",     hint:"", key:"reply"     },
  { label:"SLA à risque (-30 min)",   hint:"", key:"sla"       },
  { label:"Mention par un collègue",  hint:"", key:"mention"   },
  { label:"Récap quotidien",          hint:"", key:"daily"     },
  { label:"Sons de notification",     hint:"", key:"sounds"    },
];

export default function AgentPreferences({ user, onUserUpdate }) {
  const [active, setActive] = useState("profile");
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [fonction, setFonction] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [notifState, setNotifState] = useState({ newTicket:true, reply:true, sla:true, mention:true, daily:false, sounds:false });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
  const [fonctionSaving, setFonctionSaving] = useState(false);
  const [fonctionSaved,  setFonctionSaved]  = useState(false);
  const [notifsSaving,  setNotifsSaving]  = useState(false);
  const [notifsSaved,   setNotifsSaved]   = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [pwd, setPwd] = useState({ current:"", next:"", confirm:"" });
  const [pwdShow, setPwdShow] = useState({ current:false, next:false, confirm:false });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  useEffect(() => {
    fetchMyProfile()
      .then(p => {
        setFullName(p.full_name || "");
        setEmail(p.email || "");
        setFonction(user?.fonction || "");
        setAvatarUrl(p.avatar_url || null);
        setNotifState({
          newTicket: p.notify_new_ticket ?? true,
          reply: p.notify_reply ?? true,
          sla: p.notify_sla_risk ?? true,
          mention: p.notify_mention ?? true,
          daily: p.notify_daily_digest ?? false,
          sounds: p.notify_sounds ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const initials = (fullName || "AG").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const updated = await updateMyProfile({ full_name: fullName });
      onUserUpdate?.({ full_name: updated.full_name });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setProfileSaving(false); }
  }

  async function saveFonction(e) {
    e.preventDefault();
    if (!user?.user_id) return;
    setFonctionSaving(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await fetch(`${API_BASE}/users/${user.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fonction }),
      });
      onUserUpdate?.({ fonction });
      setFonctionSaved(true);
      setTimeout(() => setFonctionSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setFonctionSaving(false); }
  }

  async function saveNotifs() {
    setNotifsSaving(true);
    try {
      await updateMyProfile({
        notify_new_ticket: notifState.newTicket,
        notify_reply: notifState.reply,
        notify_sla_risk: notifState.sla,
        notify_mention: notifState.mention,
        notify_daily_digest: notifState.daily,
        notify_sounds: notifState.sounds,
      });
      setNotifsSaved(true);
      setTimeout(() => setNotifsSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setNotifsSaving(false); }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.user_id) return;
    setAvatarUploading(true);
    try {
      const res = await uploadMyAvatar(user.user_id, file);
      setAvatarUrl(res.avatar_url);
      onUserUpdate?.({ avatar_url: res.avatar_url });
    } catch { /* ignore */ }
    finally { setAvatarUploading(false); e.target.value = ""; }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwdError(""); setPwdSuccess("");
    if (!pwd.current || !pwd.next || !pwd.confirm) { setPwdError("Tous les champs sont obligatoires."); return; }
    if (pwd.next !== pwd.confirm) { setPwdError("Les nouveaux mots de passe ne correspondent pas."); return; }
    if (pwd.next.length < 6) { setPwdError("Le nouveau mot de passe doit contenir au moins 6 caractères."); return; }
    setPwdSaving(true);
    try {
      await changeMyPassword(pwd.current, pwd.next);
      setPwd({ current:"", next:"", confirm:"" });
      setPwdSuccess("Mot de passe modifié avec succès.");
      setTimeout(() => setPwdSuccess(""), 3500);
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setPwdSaving(false);
    }
  }

  const avatarSrc = avatarUrl ? `${API_BASE}${avatarUrl}` : null;

  if (loading) {
    return <div className="adm-body"><div style={{ ...card, padding:48, textAlign:"center", color:"#94a3b8" }}>Chargement…</div></div>;
  }

  return (
    <div className="adm-body" style={{ paddingBottom:40 }}>
      <div style={{ display:"flex", gap:24, alignItems:"flex-start" }}>
        {/* Left nav */}
        <div style={{ width:200, flexShrink:0 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:700, color:"#94a3b8", letterSpacing:"0.12em", textTransform:"uppercase", padding:"0 14px 8px" }}>SECTIONS</div>
          {LEFT_NAV.map(n => (
            <button type="button" key={n.id} onClick={() => setActive(n.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderRadius:9, border:"none", marginBottom:2, background: active===n.id ? "#eff6ff" : "transparent", color: active===n.id ? "#1e40af" : "#64748b", fontSize:13, fontWeight: active===n.id ? 700 : 500, cursor:"pointer", textAlign:"left", borderLeft:`3px solid ${active===n.id ? "#2563eb" : "transparent"}` }}>
              {n.icon}<span style={{ flex:1 }}>{n.label}</span>
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:16 }}>

          {active === "profile" && (
            <div style={card}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"20px 24px", borderBottom:"1px solid #f1f5f9", background:"#fafbff" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", color:"#2563eb", flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Mon profil</div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>Visible des demandeurs et de l'équipe.</div>
                </div>
              </div>

              {/* Photo */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"18px 24px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Photo de profil</div>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:48, height:48, borderRadius:"50%", overflow:"hidden", background: avatarSrc ? "transparent" : "linear-gradient(135deg,#2B45C8,#8B5CF6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16, flexShrink:0 }}>
                    {avatarSrc ? <img src={avatarSrc} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : initials}
                  </div>
                  <label style={{ padding:"7px 14px", border:"1.5px solid #e8ecf7", borderRadius:8, background:"#fff", cursor: avatarUploading ? "not-allowed" : "pointer", fontSize:12.5, fontWeight:600, color:"#374151", display:"flex", alignItems:"center", gap:6 }}>
                    {avatarUploading ? "Envoi…" : "↑ Importer"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoChange} disabled={avatarUploading} style={{ display:"none" }} />
                  </label>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"16px 24px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Nom complet</div>
                <input style={input} value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"16px 24px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Email</div>
                <div>
                  <input style={{ ...input, background:"#f8fafc", color:"#64748b", cursor:"not-allowed" }} value={email} readOnly />
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Contactez un administrateur pour changer votre email.</div>
                </div>
              </div>

              {/* Fonction */}
              <form onSubmit={saveFonction}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"16px 24px" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Fonction</div>
                    <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:2 }}>Votre poste ou spécialité</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input style={{ ...input, flex:1 }} value={fonction}
                      onChange={e => setFonction(e.target.value)}
                      placeholder="Ex : Technicien réseau, Support N2…" />
                    <button type="submit" disabled={fonctionSaving}
                      style={{ height:40, padding:"0 14px", background: fonctionSaved ? "#16a34a" : "#2B45C8", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:12.5, cursor: fonctionSaving ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
                      {fonctionSaved ? "✓" : fonctionSaving ? "…" : "Sauver"}
                    </button>
                  </div>
                </div>
              </form>

              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10, padding:"16px 24px", borderTop:"1px solid #f1f5f9" }}>
                {profileSaved && <span style={{ fontSize:12.5, color:"#16a34a", fontWeight:600 }}>✓ Enregistré</span>}
                <button type="button" onClick={saveProfile} disabled={profileSaving}
                  style={{ height:38, padding:"0 22px", background: profileSaving ? "#94a3b8" : "#2B45C8", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor: profileSaving ? "not-allowed" : "pointer" }}>
                  {profileSaving ? "Enregistrement…" : "Enregistrer le nom"}
                </button>
              </div>
            </div>
          )}

          {active === "notifs" && (
            <div style={card}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"20px 24px", borderBottom:"1px solid #f1f5f9", background:"#fafbff" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", color:"#2563eb", flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Notifications</div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>Comment et quand être prévenu(e).</div>
                </div>
              </div>
              {NOTIFS.map((n, i) => (
                <div key={n.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom: i < NOTIFS.length-1 ? "1px solid #f1f5f9" : "none" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{n.label}</div>
                  <Toggle value={notifState[n.key]} onChange={v => setNotifState(s => ({ ...s, [n.key]: v }))} />
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10, padding:"16px 24px", borderTop:"1px solid #f1f5f9" }}>
                {notifsSaved && <span style={{ fontSize:12.5, color:"#16a34a", fontWeight:600 }}>✓ Enregistré</span>}
                <button type="button" onClick={saveNotifs} disabled={notifsSaving}
                  style={{ height:38, padding:"0 22px", background: notifsSaving ? "#94a3b8" : "#2B45C8", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor: notifsSaving ? "not-allowed" : "pointer" }}>
                  {notifsSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}

          {active === "security" && (
            <div style={card}>
              <div style={{ padding:"20px 24px", borderBottom:"1px solid #f1f5f9", background:"#fafbff" }}>
                <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Sécurité du compte</div>
                <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>Modifiez votre mot de passe pour protéger votre accès.</div>
              </div>
              <form onSubmit={handleChangePassword} style={{ padding:"20px 24px" }}>
                {pwdError && <div style={{ padding:"10px 14px", background:"#fef2f2", borderRadius:10, border:"1px solid #fecaca", fontSize:12.5, color:"#dc2626", marginBottom:16 }}>{pwdError}</div>}
                {pwdSuccess && <div style={{ padding:"10px 14px", background:"#f0fdf4", borderRadius:10, border:"1px solid #bbf7d0", fontSize:12.5, color:"#16a34a", marginBottom:16 }}>{pwdSuccess}</div>}

                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginBottom:6 }}>Mot de passe actuel</div>
                  <PasswordInput value={pwd.current} onChange={v => setPwd(p => ({ ...p, current:v }))}
                    show={pwdShow.current} onToggle={() => setPwdShow(p => ({ ...p, current:!p.current }))} />
                </div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginBottom:6 }}>Nouveau mot de passe</div>
                  <PasswordInput value={pwd.next} onChange={v => setPwd(p => ({ ...p, next:v }))}
                    show={pwdShow.next} onToggle={() => setPwdShow(p => ({ ...p, next:!p.next }))} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0f172a", marginBottom:6 }}>Confirmer le nouveau mot de passe</div>
                  <PasswordInput value={pwd.confirm} onChange={v => setPwd(p => ({ ...p, confirm:v }))}
                    show={pwdShow.confirm} onToggle={() => setPwdShow(p => ({ ...p, confirm:!p.confirm }))} />
                </div>

                <div style={{ padding:"12px 16px", background:"#f8fafc", borderRadius:10, fontSize:12, color:"#64748b", marginBottom:16 }}>
                  <div style={{ color: pwd.next.length >= 6 ? "#16a34a" : "#94a3b8", marginBottom:3 }}>
                    {pwd.next.length >= 6 ? "✅" : "○"} Au moins 6 caractères
                  </div>
                  <div style={{ color: pwd.next && pwd.next === pwd.confirm ? "#16a34a" : "#94a3b8" }}>
                    {pwd.next && pwd.next === pwd.confirm ? "✅" : "○"} Les mots de passe correspondent
                  </div>
                </div>

                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button type="submit" disabled={pwdSaving}
                    style={{ height:38, padding:"0 22px", background: pwdSaving ? "#94a3b8" : "#2B45C8", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor: pwdSaving ? "not-allowed" : "pointer" }}>
                    {pwdSaving ? "Modification…" : "Changer le mot de passe"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
