import { useState, useEffect } from "react";
import { fetchMyProfile, updateMyProfile, uploadMyAvatar, changeMyPassword } from "../../api/users";
import { API_BASE } from "../../api/config";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };
const input = { height:40, padding:"0 12px", border:"1.5px solid #e8ecf7", borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };
const inputReadOnly = { ...input, background:"#f8fafc", color:"#64748b", cursor:"not-allowed" };

const LEFT_NAV = [
  { id:"profile", label:"Profil",        icon:"👤" },
  { id:"notifs",  label:"Notifications", icon:"🔔" },
  { id:"security",label:"Sécurité",      icon:"🔐" },
];

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width:44, height:24, borderRadius:12, border:"none", cursor:"pointer", background: value ? "#2B45C8" : "#e2e8f0", padding:2, display:"flex", alignItems:"center", justifyContent: value ? "flex-end" : "flex-start", transition:"background 0.2s" }}>
      <span style={{ width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,0.2)", display:"block" }} />
    </button>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }) {
  return (
    <div style={{ position:"relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "••••••••"} style={{ ...input, paddingRight:44 }} />
      <button type="button" onClick={onToggle}
        style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:14, padding:0, color:"#94a3b8" }}>
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export default function RequesterAccount({ user, onUserUpdate }) {
  const [active, setActive] = useState("profile");
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [lang,     setLang]     = useState("Français");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [notifs, setNotifs] = useState({ reply:true, resolved:true, news:false, weekly:false });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
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
        setPhone(p.phone || "");
        setLang(p.preferred_language || "Français");
        setAvatarUrl(p.avatar_url || null);
        setNotifs({
          reply: p.notify_reply ?? true,
          resolved: p.notify_resolved ?? true,
          news: p.notify_news ?? false,
          weekly: p.notify_weekly ?? false,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const initials = (fullName || "DM").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const updated = await updateMyProfile({ full_name: fullName, phone, preferred_language: lang });
      onUserUpdate?.({ full_name: updated.full_name });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setProfileSaving(false); }
  }

  async function saveNotifs() {
    setNotifsSaving(true);
    try {
      await updateMyProfile({
        notify_reply: notifs.reply,
        notify_resolved: notifs.resolved,
        notify_news: notifs.news,
        notify_weekly: notifs.weekly,
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
          <div style={{ ...card, padding:8 }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:700, color:"#94a3b8", letterSpacing:"0.12em", textTransform:"uppercase", padding:"8px 10px 6px" }}>SECTIONS</div>
            {LEFT_NAV.map(n => (
              <button type="button" key={n.id} onClick={() => setActive(n.id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9, border:"none", marginBottom:2, background: active===n.id ? "#eff6ff" : "transparent", color: active===n.id ? "#1e40af" : "#64748b", fontSize:13, fontWeight: active===n.id ? 700 : 500, cursor:"pointer", textAlign:"left", borderLeft:`3px solid ${active===n.id ? "#2563eb" : "transparent"}` }}>
                <span>{n.icon}</span><span>{n.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:16 }}>

          {active === "profile" && (
            <div style={card}>
              <div style={{ display:"flex", alignItems:"center", gap:14, padding:"20px 24px", borderBottom:"1px solid #f1f5f9", background:"#fafbff" }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#eff6ff", display:"flex", alignItems:"center", justifyContent:"center", color:"#2B45C8", fontSize:16, flexShrink:0 }}>👤</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Mon profil</div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>Ces informations apparaissent sur vos tickets et conversations.</div>
                </div>
              </div>
              {/* Photo */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"18px 24px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Photo</div>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:48, height:48, borderRadius:"50%", overflow:"hidden", background: avatarSrc ? "transparent" : "linear-gradient(135deg,#2B45C8,#1E3AAF)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16, flexShrink:0 }}>
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
                <input style={input} type="text" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"16px 24px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Email principal</div>
                <div>
                  <input style={inputReadOnly} type="email" value={email} readOnly />
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Contactez un administrateur pour changer votre email.</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"16px 24px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Téléphone (optionnel)</div>
                <input style={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+216 ..." />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1.2fr", gap:24, alignItems:"center", padding:"16px 24px" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Langue préférée</div>
                <select value={lang} onChange={e => setLang(e.target.value)} style={{ ...input, cursor:"pointer" }}>
                  <option>Français</option><option>English</option><option>العربية</option>
                </select>
              </div>

              <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10, padding:"16px 24px", borderTop:"1px solid #f1f5f9" }}>
                {profileSaved && <span style={{ fontSize:12.5, color:"#16a34a", fontWeight:600 }}>✓ Enregistré</span>}
                <button type="button" onClick={saveProfile} disabled={profileSaving}
                  style={{ height:38, padding:"0 22px", background: profileSaving ? "#94a3b8" : "#2B45C8", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor: profileSaving ? "not-allowed" : "pointer" }}>
                  {profileSaving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}

          {active === "notifs" && (
            <div style={card}>
              <div style={{ padding:"20px 24px", borderBottom:"1px solid #f1f5f9", background:"#fafbff" }}>
                <div style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Notifications</div>
                <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>Choisissez comment être notifié.</div>
              </div>
              {[
                { key:"reply",    label:"Réponse à mes tickets",  hint:"Email dès qu'un agent répond" },
                { key:"resolved", label:"Ticket résolu",          hint:"Email de confirmation" },
                { key:"news",     label:"Annonces produit",       hint:"Nouveautés et mises à jour" },
                { key:"weekly",   label:"Résumé hebdomadaire",    hint:"Récap chaque lundi matin" },
              ].map((n, i, arr) => (
                <div key={n.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom: i < arr.length-1 ? "1px solid #f1f5f9" : "none" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{n.label}</div>
                    <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:2 }}>{n.hint}</div>
                  </div>
                  <Toggle value={notifs[n.key]} onChange={v => setNotifs(p => ({ ...p, [n.key]:v }))} />
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
