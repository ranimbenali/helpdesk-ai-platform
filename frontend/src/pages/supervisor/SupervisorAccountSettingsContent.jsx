import { useEffect, useState } from "react";
import { fetchMyProfile, updateMyProfile, uploadMyAvatar, changeMyPassword } from "../../api/users";
import { API_BASE } from '../../api/config.js';

function getAuthHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/* ── Reusable UI atoms ── */
function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)", marginBottom: 16 }}>
      {title && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 18, alignItems: "flex-start" }}>
      <div style={{ width: 200, flexShrink: 0, paddingTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function ReadonlyField({ value }) {
  return (
    <div style={{ height: 40, padding: "0 14px", border: "1.5px solid #f1f5f9", borderRadius: 10, fontSize: 13, color: "#64748b", background: "#f8fafc", display: "flex", alignItems: "center" }}>
      {value || "—"}
    </div>
  );
}

function TextField({ value, onChange }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", height: 40, padding: "0 14px", border: "1.5px solid #e8ecf7", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "var(--font)", color: "#0f172a", boxSizing: "border-box" }}
      onFocus={e => e.currentTarget.style.borderColor = "#2B45C8"}
      onBlur={e => e.currentTarget.style.borderColor = "#e8ecf7"}
    />
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "#2B45C8" : "#e2e8f0", position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}
    >
      <div style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left .2s" }} />
    </div>
  );
}

function SaveBtn({ saving, saved, label = "Enregistrer", onClick, type = "button" }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 8 }}>
      {saved && <span style={{ fontSize: 12.5, color: "#16a34a", fontWeight: 600 }}>✓ Enregistré</span>}
      <button type={type} onClick={onClick} disabled={saving}
        style={{ height: 38, padding: "0 22px", background: saving ? "#94a3b8" : "#2B45C8", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font)" }}>
        {saving ? "Enregistrement…" : label}
      </button>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, show, onToggle }) {
  return (
    <div style={{ position: "relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "••••••••"}
        style={{ width: "100%", height: 40, padding: "0 44px 0 14px", border: "1.5px solid #e8ecf7", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "var(--font)", color: "#0f172a", boxSizing: "border-box" }}
        onFocus={e => e.currentTarget.style.borderColor = "#2B45C8"}
        onBlur={e => e.currentTarget.style.borderColor = "#e8ecf7"}
      />
      <button type="button" onClick={onToggle}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: 0, color: "#94a3b8" }}>
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

/* ── Thème réel : même mécanisme que la page Admin (localStorage + data-theme) ── */
function applyTheme(value) {
  if (value === "Sombre") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (value === "Auto") {
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    dark ? document.documentElement.setAttribute("data-theme", "dark") : document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("theme", value);
}

function PillGroup({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2, width: "fit-content" }}>
      {options.map(o => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} style={{
          padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 12.5, fontWeight: value === o.value ? 700 : 500,
          background: value === o.value ? "#fff" : "transparent",
          color: value === o.value ? "#1e40af" : "#64748b",
          boxShadow: value === o.value ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

/* ── Champ Fonction (éditable, déjà réel) ── */
function FonctionField({ userId, initialValue }) {
  const [value,   setValue]   = useState(initialValue || "");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => { setValue(initialValue || ""); }, [initialValue]);

  async function handleSave(e) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/users/${userId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fonction: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSave}>
      <FieldRow label="Fonction" hint="Votre poste ou spécialité (ex: Responsable IT)">
        <div style={{ display: "flex", gap: 8 }}>
          <input value={value} onChange={e => setValue(e.target.value)}
            placeholder="Ex : Responsable helpdesk, Technicien réseau…"
            style={{ flex: 1, height: 40, padding: "0 14px", border: "1.5px solid #e8ecf7", borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "var(--font)", color: "#0f172a", background: "#fff" }}
            onFocus={e => e.currentTarget.style.borderColor = "#2B45C8"}
            onBlur={e => e.currentTarget.style.borderColor = "#e8ecf7"}
          />
          <button type="submit" disabled={saving}
            style={{ height: 40, padding: "0 16px", background: saved ? "#16a34a" : "#2B45C8", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {saved ? "✓ Enregistré" : saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </FieldRow>
    </form>
  );
}

/* ── Nav items ── */
const NAV_ITEMS = [
  { key: "general",       label: "Général",       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { key: "appearance",    label: "Apparence",     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg> },
  { key: "security",      label: "Sécurité",      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { key: "notifications", label: "Notifications", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];

/* ── Sections ── */
function GeneralSection({ user, profile, onUserUpdate, onProfileUpdate }) {
  const [fullName, setFullName] = useState(profile?.full_name || user?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => { setFullName(profile?.full_name || user?.full_name || ""); }, [profile?.full_name]);

  const initials = fullName ? fullName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "SV";
  const avatarUrl = profile?.avatar_url ? `${API_BASE}${profile.avatar_url}` : null;

  async function saveName() {
    setSaving(true);
    try {
      const updated = await updateMyProfile({ full_name: fullName });
      onUserUpdate?.({ full_name: updated.full_name });
      onProfileUpdate?.(p => ({ ...p, full_name: updated.full_name }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.user_id) return;
    setAvatarUploading(true);
    try {
      const res = await uploadMyAvatar(user.user_id, file);
      onUserUpdate?.({ avatar_url: res.avatar_url });
      onProfileUpdate?.(p => ({ ...p, avatar_url: res.avatar_url }));
    } catch { /* ignore */ }
    finally { setAvatarUploading(false); e.target.value = ""; }
  }

  return (
    <SectionCard title="Identité du compte" subtitle="Informations liées à votre profil superviseur.">
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", background: avatarUrl ? "transparent" : "linear-gradient(135deg,#2B45C8,#6c63ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
          {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{fullName || "—"}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{user?.email || "—"}</div>
          <span style={{ display: "inline-block", marginTop: 5, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: "#eff6ff", color: "#2B45C8" }}>Superviseur</span>
        </div>
        <label style={{ padding: "7px 14px", border: "1.5px solid #e8ecf7", borderRadius: 8, background: "#fff", cursor: avatarUploading ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
          {avatarUploading ? "Envoi…" : "↑ Importer"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoChange} disabled={avatarUploading} style={{ display: "none" }} />
        </label>
      </div>

      <FieldRow label="Nom complet">
        <TextField value={fullName} onChange={setFullName} />
      </FieldRow>
      <FieldRow label="Adresse e-mail" hint="Contactez un administrateur pour changer votre email.">
        <ReadonlyField value={user?.email} />
      </FieldRow>
      <FieldRow label="Identifiant" hint="Référence interne de votre compte">
        <ReadonlyField value={user?.user_id ? `#${user.user_id}` : "—"} />
      </FieldRow>
      <FieldRow label="Membre depuis">
        <ReadonlyField value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"} />
      </FieldRow>

      <SaveBtn saving={saving} saved={saved} onClick={saveName} />

      <div style={{ borderTop: "1px solid #f1f5f9", margin: "20px 0" }} />

      {/* Fonction — modifiable par le superviseur lui-même */}
      <FonctionField userId={user?.user_id} initialValue={user?.fonction} />
    </SectionCard>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "Clair");

  return (
    <SectionCard title="Apparence" subtitle="Personnalisez l'aspect visuel de l'interface.">
      <FieldRow label="Thème">
        <PillGroup
          value={theme}
          onChange={v => { setTheme(v); applyTheme(v); }}
          options={[
            { value: "Clair",  label: "☀️ Clair" },
            { value: "Sombre", label: "🌙 Sombre" },
            { value: "Auto",   label: "⚙️ Auto (système)" },
          ]}
        />
      </FieldRow>
    </SectionCard>
  );
}

function SecuritySection() {
  const [form, setForm]       = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [show, setShow]       = useState({ current_password: false, new_password: false, confirm_password: false });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.current_password || !form.new_password || !form.confirm_password) {
      setError("Tous les champs sont obligatoires."); return;
    }
    if (form.new_password !== form.confirm_password) {
      setError("Les nouveaux mots de passe ne correspondent pas."); return;
    }
    if (form.new_password.length < 6) {
      setError("Le nouveau mot de passe doit comporter au moins 6 caractères."); return;
    }
    try {
      setSaving(true);
      await changeMyPassword(form.current_password, form.new_password);
      setForm({ current_password: "", new_password: "", confirm_password: "" });
      setSuccess("Mot de passe modifié avec succès !");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { key: "current_password", label: "Mot de passe actuel" },
    { key: "new_password",     label: "Nouveau mot de passe" },
    { key: "confirm_password", label: "Confirmer le nouveau mot de passe" },
  ];

  return (
    <SectionCard title="Sécurité du compte" subtitle="Modifiez votre mot de passe pour protéger votre accès.">
      {error   && <div style={{ padding: "10px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", fontSize: 12, color: "#e53935", marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ padding: "10px 14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", fontSize: 12, color: "#16a34a", marginBottom: 16 }}>{success}</div>}

      <form onSubmit={handleSubmit}>
        {fields.map(f => (
          <FieldRow key={f.key} label={f.label}>
            <PasswordInput
              value={form[f.key]}
              onChange={v => setForm(p => ({ ...p, [f.key]: v }))}
              show={show[f.key]}
              onToggle={() => setShow(p => ({ ...p, [f.key]: !p[f.key] }))}
            />
          </FieldRow>
        ))}

        <div style={{ marginLeft: 216, padding: "12px 16px", background: "#f8fafc", borderRadius: 10, fontSize: 12, color: "#64748b", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Règles du mot de passe :</div>
          <div style={{ color: form.new_password.length >= 6 ? "#16a34a" : "#94a3b8", marginBottom: 3 }}>
            {form.new_password.length >= 6 ? "✅" : "○"} Au moins 6 caractères
          </div>
          <div style={{ color: form.new_password && form.new_password === form.confirm_password ? "#16a34a" : "#94a3b8" }}>
            {form.new_password && form.new_password === form.confirm_password ? "✅" : "○"} Les mots de passe correspondent
          </div>
        </div>

        <SaveBtn saving={saving} type="submit" label="Mettre à jour le mot de passe" />
      </form>
    </SectionCard>
  );
}

function NotificationsSection({ profile, onSaved }) {
  const [notifs, setNotifs] = useState({
    sla_breach: true, sla_risk: true, new_ticket: true,
    agent_idle: false, ticket_closed: false,
    email_digest: true, inapp: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setNotifs({
      sla_breach: profile.notify_sla_breach ?? true,
      sla_risk: profile.notify_sla_risk ?? true,
      new_ticket: profile.notify_new_ticket ?? true,
      agent_idle: profile.notify_agent_idle ?? false,
      ticket_closed: profile.notify_ticket_closed ?? false,
      email_digest: profile.notify_email_digest ?? true,
      inapp: profile.notify_inapp ?? true,
    });
  }, [profile]);

  const groups = [
    { title: "Alertes SLA", items: [
      { key: "sla_breach", label: "SLA dépassé",         desc: "Notifié quand un ticket dépasse son délai SLA." },
      { key: "sla_risk",   label: "Ticket à risque SLA", desc: "Avertissement préventif avant dépassement." },
    ]},
    { title: "Tickets", items: [
      { key: "new_ticket",    label: "Nouveau ticket",      desc: "À chaque ticket créé dans votre périmètre." },
      { key: "ticket_closed", label: "Ticket clôturé",      desc: "Quand un ticket passe à l'état fermé." },
      { key: "agent_idle",    label: "Agent sans activité", desc: "Si un agent n'a pas traité de ticket depuis 2 h." },
    ]},
    { title: "Communications", items: [
      { key: "email_digest", label: "Résumé e-mail quotidien", desc: "Rapport récapitulatif envoyé chaque matin." },
      { key: "inapp",        label: "Notifications in-app",    desc: "Alertes dans la cloche de l'interface." },
    ]},
  ];

  async function saveAll() {
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        notify_sla_breach: notifs.sla_breach,
        notify_sla_risk: notifs.sla_risk,
        notify_new_ticket: notifs.new_ticket,
        notify_agent_idle: notifs.agent_idle,
        notify_ticket_closed: notifs.ticket_closed,
        notify_email_digest: notifs.email_digest,
        notify_inapp: notifs.inapp,
      });
      onSaved?.(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div>
      {groups.map(g => (
        <SectionCard key={g.title} title={g.title}>
          {g.items.map(item => (
            <div key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{item.desc}</div>
              </div>
              <Toggle checked={notifs[item.key]} onChange={v => setNotifs(p => ({ ...p, [item.key]: v }))} />
            </div>
          ))}
        </SectionCard>
      ))}
      <SaveBtn saving={saving} saved={saved} onClick={saveAll} label="Enregistrer les notifications" />
    </div>
  );
}

/* ── Main export ── */
export default function SupervisorAccountSettingsContent({ user, onUserUpdate }) {
  const [active, setActive] = useState("general");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    fetchMyProfile().then(setProfile).catch(() => {});
  }, []);

  return (
    <div className="adm-body" style={{ display: "flex", gap: 20 }}>

      {/* Left nav */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 8, boxShadow: "var(--shadow-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "var(--font-mono)", padding: "8px 12px 6px" }}>PARAMÈTRES</div>
          {NAV_ITEMS.map(s => (
            <div key={s.key} onClick={() => setActive(s.key)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", background: active === s.key ? "#eff6ff" : "transparent", color: active === s.key ? "#2B45C8" : "#64748b", fontWeight: active === s.key ? 700 : 500, fontSize: 13, transition: "all .15s", marginBottom: 2 }}
              onMouseEnter={e => { if (active !== s.key) e.currentTarget.style.background = "#f8fafc"; }}
              onMouseLeave={e => { if (active !== s.key) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ opacity: active === s.key ? 1 : 0.6 }}>{s.icon}</span>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {active === "general"       && <GeneralSection user={user} profile={profile} onUserUpdate={onUserUpdate} onProfileUpdate={fn => setProfile(fn)} />}
        {active === "appearance"    && <AppearanceSection />}
        {active === "security"      && <SecuritySection />}
        {active === "notifications" && <NotificationsSection profile={profile} onSaved={setProfile} />}
      </div>
    </div>
  );
}
