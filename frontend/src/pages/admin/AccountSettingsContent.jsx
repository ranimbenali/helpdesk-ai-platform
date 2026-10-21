import { useState, useEffect, useRef } from "react";
import { fetchMyProfile, changeMyPassword } from "../../api/users";
import { API_BASE } from '../../api/config.js';

/* ─── SVG icons ─── */
function IcoSettings({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IcoPalette({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5"  cy="7.5"  r=".5" fill="currentColor"/>
      <circle cx="6.5"  cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  );
}
function IcoLock({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function IcoBell({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function IcoMail({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IcoCard({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function IcoCode({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}
function IcoGlobe({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}
function IcoUpload({ s = 14 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
}
function IcoWarn({ s = 14 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function IcoEye({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IcoEyeOff({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function IcoKey({ s = 15 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

/* ─── Left nav config ─── */
const LEFT_NAV = [
  { id: "general",       label: "Général",        Icon: IcoSettings },
  { id: "appearance",    label: "Apparence",       Icon: IcoPalette  },
  { id: "security",      label: "Sécurité",        Icon: IcoLock, warning: true },
  { id: "notifications", label: "Notifications",   Icon: IcoBell    },
  { id: "email",         label: "Email",           Icon: IcoMail    },
  { id: "billing",       label: "Facturation",     Icon: IcoCard    },
  { id: "api",           label: "API & webhooks",  Icon: IcoCode    },
  { id: "domains",       label: "Domaines",        Icon: IcoGlobe   },
];

const BRAND_COLORS = ["#2B45C8","#10b981","#f59e0b","#f97316","#8b5cf6","#ec4899"];

const input = {
  height: 40, padding: "0 12px", border: "1.5px solid #e8ecf7",
  borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit",
  width: "100%", boxSizing: "border-box", color: "#0f172a", background: "#fff",
};
const card = {
  background: "#fff", borderRadius: 14,
  boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  border: "1px solid #f0f4ff",
  overflow: "hidden",
};

/* ─── Row inside a section card ─── */
function SettingRow({ label, hint, children, last }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24,
      alignItems: "center", padding: "18px 24px",
      borderBottom: last ? "none" : "1px solid #f1f5f9",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.5 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ─── Section card header ─── */
function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "20px 24px", borderBottom: "1px solid #f1f5f9", background: "#fafbff" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

/* ─── Pill selector ─── */
function PillGroup({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, width: "fit-content", gap: 2 }}>
      {options.map(opt => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: value === opt.value ? 700 : 500,
            transition: "all 0.15s", fontFamily: "inherit",
            background: value === opt.value ? "#fff" : "transparent",
            color: value === opt.value ? "#1e40af" : "#64748b",
            boxShadow: value === opt.value ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function applyTheme(value) {
  if (value === "Sombre") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (value === "Auto") {
    const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    dark
      ? document.documentElement.setAttribute("data-theme", "dark")
      : document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("theme", value);
}

export default function AccountSettingsContent({ user }) {
  const [activeSection, setActiveSection] = useState("general");
  const [hasChanges, setHasChanges]       = useState(false);
  const [profile, setProfile]             = useState(null);
  const fileInputRef = useRef(null);

  /* General fields */
  const [orgName, setOrgName]       = useState("Geiser Helpdesk SAS");
  const [orgId]                     = useState("geiser-prod");
  const [supportDomain, setSupportDomain] = useState("support.geiser.fr");

  /* Localisation */
  const [timezone, setTimezone]     = useState("Europe/Paris (UTC+1)");
  const [lang, setLang]             = useState("Français");
  const [dateFormat, setDateFormat] = useState("JJ/MM/AAAA");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [currency, setCurrency]     = useState("Euro (€)");

  /* Appearance */
  const [theme, setTheme]           = useState(() => localStorage.getItem("theme") || "Clair");
  const [brandColor, setBrandColor] = useState("#2B45C8");
  const [density, setDensity]       = useState("Standard");

  /* Notifications */
  const [notifEmail, setNotifEmail]     = useState(true);
  const [notifBrowser, setNotifBrowser] = useState(true);
  const [notifSlack, setNotifSlack]     = useState(false);

  /* Security */
  const [pwForm, setPwForm]     = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwError, setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurr, setShowCurr] = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  useEffect(() => {
    fetchMyProfile().then(setProfile).catch(() => {});
  }, []);

  function dirty() { setHasChanges(true); }

  function getStrength(pw) {
    if (!pw) return { score: 0, label: "", color: "#e2e8f0" };
    let s = 0;
    if (pw.length >= 8)          s++;
    if (/[A-Z]/.test(pw))        s++;
    if (/[0-9]/.test(pw))        s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    const lvl = [
      { label: "Très faible", color: "#ef4444" },
      { label: "Faible",      color: "#f97316" },
      { label: "Moyen",       color: "#eab308" },
      { label: "Fort",        color: "#22c55e" },
      { label: "Très fort",   color: "#16a34a" },
    ];
    return { score: s, ...lvl[s] };
  }

  async function handlePasswordSave() {
    setPwError(""); setPwSuccess("");
    if (!pwForm.current_password || !pwForm.new_password || !pwForm.confirm) {
      setPwError("Tous les champs sont obligatoires."); return;
    }
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError("Les mots de passe ne correspondent pas."); return;
    }
    if (pwForm.new_password.length < 6) {
      setPwError("Le mot de passe doit faire au moins 6 caractères."); return;
    }
    try {
      setPwSaving(true);
      /* Vérifie le mot de passe actuel côté backend avant de changer */
      await changeMyPassword(pwForm.current_password, pwForm.new_password);
      setPwSuccess("Mot de passe modifié avec succès !");
      setPwForm({ current_password: "", new_password: "", confirm: "" });
      setTimeout(() => setPwSuccess(""), 4000);
    } catch (err) {
      setPwError(err.message || "Erreur lors du changement.");
    } finally {
      setPwSaving(false);
    }
  }

  const strength = getStrength(pwForm.new_password);
  const initials = (profile?.full_name || user?.full_name || "A")
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  /* ─── Render ─── */
  return (
    <div className="adm-body" style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* ── Left sub-nav ── */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 700,
            color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "0 14px 8px",
          }}>
            SETTINGS
          </div>
          {LEFT_NAV.map(({ id, label, Icon, warning }) => (
            <button type="button" key={id} onClick={() => setActiveSection(id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "9px 14px", borderRadius: 9, border: "none", marginBottom: 2,
              background: activeSection === id ? "#eff6ff" : "transparent",
              color: activeSection === id ? "#1e40af" : "#64748b",
              fontSize: 13, fontWeight: activeSection === id ? 700 : 500,
              cursor: "pointer", textAlign: "left",
              borderLeft: `3px solid ${activeSection === id ? "#2563eb" : "transparent"}`,
              transition: "all 0.12s",
            }}>
              <Icon />
              <span style={{ flex: 1 }}>{label}</span>
              {warning && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ══ GÉNÉRAL ══ */}
          {activeSection === "general" && (
            <>
              {/* Identité */}
              <div style={card}>
                <SectionHeader
                  icon={<IcoSettings s={18} />}
                  title="Identité de l'organisation"
                  subtitle="Ces informations apparaissent dans les emails, factures et l'interface utilisateur."
                />
                <SettingRow label="Nom de l'organisation" hint="Affiché en haut à gauche et dans les emails sortants.">
                  <input style={input} value={orgName}
                    onChange={e => { setOrgName(e.target.value); dirty(); }} />
                </SettingRow>
                <SettingRow label="Identifiant interne" hint="Utilisé dans les URL et les API. Non modifiable.">
                  <div style={{ position: "relative" }}>
                    <input style={{ ...input, background: "#f8fafc", color: "#94a3b8", paddingRight: 40 }}
                      value={orgId} readOnly />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#cbd5e1" }}>
                      <IcoLock s={14} />
                    </span>
                  </div>
                </SettingRow>
                <SettingRow label="Logo de l'organisation" hint="PNG ou SVG, 512×512 minimum, fond transparent recommandé.">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: "linear-gradient(135deg, #2B45C8, #1E3AAF)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0,
                    }}>
                      {initials[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "7px 14px", border: "1.5px solid #e8ecf7",
                          borderRadius: 8, background: "#fff", cursor: "pointer",
                          fontSize: 12.5, fontWeight: 600, color: "#374151",
                        }}>
                        <IcoUpload /> Importer
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} />
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        geiser-logo.svg · 14 Ko
                      </div>
                    </div>
                  </div>
                </SettingRow>
                <SettingRow label="Domaine du support" hint="L'URL publique de votre portail helpdesk." last>
                  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    <span style={{
                      height: 40, padding: "0 12px", background: "#f1f5f9",
                      border: "1.5px solid #e8ecf7", borderRight: "none",
                      borderRadius: "10px 0 0 10px", fontSize: 13, color: "#94a3b8",
                      display: "flex", alignItems: "center", flexShrink: 0, fontWeight: 500,
                    }}>
                      https://
                    </span>
                    <input style={{ ...input, borderRadius: "0 10px 10px 0" }}
                      value={supportDomain}
                      onChange={e => { setSupportDomain(e.target.value); dirty(); }} />
                  </div>
                </SettingRow>
              </div>

              {/* Localisation */}
              <div style={card}>
                <SectionHeader
                  icon={<IcoGlobe s={18} />}
                  title="Localisation"
                  subtitle="Réglages régionaux par défaut pour tous les nouveaux comptes."
                />
                <SettingRow label="Fuseau horaire">
                  <select style={{ ...input, height: 40, cursor: "pointer" }}
                    value={timezone} onChange={e => { setTimezone(e.target.value); dirty(); }}>
                    <option>Europe/Paris (UTC+1)</option>
                    <option>UTC</option>
                    <option>America/New_York (UTC-5)</option>
                    <option>Asia/Dubai (UTC+4)</option>
                  </select>
                </SettingRow>
                <SettingRow label="Langue par défaut">
                  <select style={{ ...input, height: 40, cursor: "pointer" }}
                    value={lang} onChange={e => { setLang(e.target.value); dirty(); }}>
                    <option>Français</option>
                    <option>English</option>
                    <option>العربية</option>
                  </select>
                </SettingRow>
                <SettingRow label="Format de date">
                  <PillGroup
                    value={dateFormat}
                    onChange={v => { setDateFormat(v); dirty(); }}
                    options={[
                      { value: "JJ/MM/AAAA", label: "JJ/MM/AAAA" },
                      { value: "MM/JJ/AAAA", label: "MM/JJ/AAAA" },
                      { value: "AAAA-MM-JJ", label: "AAAA-MM-JJ" },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Format d'heure">
                  <PillGroup
                    value={timeFormat}
                    onChange={v => { setTimeFormat(v); dirty(); }}
                    options={[
                      { value: "24h",     label: "24 h"       },
                      { value: "12h",     label: "12 h (am/pm)" },
                    ]}
                  />
                </SettingRow>
                <SettingRow label="Devise" hint="Pour la facturation et les rapports." last>
                  <select style={{ ...input, height: 40, cursor: "pointer" }}
                    value={currency} onChange={e => { setCurrency(e.target.value); dirty(); }}>
                    <option>Euro (€)</option>
                    <option>Dollar US ($)</option>
                    <option>Dinar tunisien (DT)</option>
                  </select>
                </SettingRow>
              </div>
            </>
          )}

          {/* ══ APPARENCE ══ */}
          {activeSection === "appearance" && (
            <div style={card}>
              <SectionHeader
                icon={<IcoPalette s={18} />}
                title="Apparence"
                subtitle="Personnalise l'interface pour tous les utilisateurs de l'organisation."
              />
              <SettingRow label="Thème" hint="Sera appliqué par défaut. Les utilisateurs peuvent surcharger.">
                <PillGroup
                  value={theme}
                  onChange={v => { setTheme(v); applyTheme(v); dirty(); }}
                  options={[
                    { value: "Clair",        label: "Clair"        },
                    { value: "Sombre",       label: "Sombre"       },
                    { value: "Auto",         label: "Auto (système)" },
                  ]}
                />
              </SettingRow>
              <SettingRow label="Couleur de marque" hint="Utilisée pour les boutons primaires, liens et accents.">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {BRAND_COLORS.map(c => (
                    <button type="button" key={c} onClick={() => { setBrandColor(c); dirty(); }} style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: c, border: brandColor === c ? `3px solid ${c}` : "3px solid transparent",
                      outline: brandColor === c ? `2px solid #fff` : "none",
                      cursor: "pointer", padding: 0,
                      boxShadow: brandColor === c ? `0 0 0 3px ${c}40` : "none",
                      transition: "all 0.15s",
                    }} />
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Densité" last>
                <PillGroup
                  value={density}
                  onChange={v => { setDensity(v); dirty(); }}
                  options={[
                    { value: "Confortable", label: "Confortable" },
                    { value: "Standard",    label: "Standard"    },
                    { value: "Compacte",    label: "Compacte"    },
                  ]}
                />
              </SettingRow>
            </div>
          )}

          {/* ══ SÉCURITÉ ══ */}
          {activeSection === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={card}>
                <SectionHeader
                  icon={<IcoLock s={18} />}
                  title="Mot de passe"
                  subtitle="Changez régulièrement votre mot de passe pour sécuriser votre compte."
                />
                <div style={{ padding: "24px" }}>
                  {pwError && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12.5, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <IcoWarn /> {pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 12.5, marginBottom: 16 }}>
                      ✓ {pwSuccess}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <PwField label="Mot de passe actuel" value={pwForm.current_password}
                      show={showCurr} onToggle={() => setShowCurr(v => !v)}
                      onChange={v => setPwForm(p => ({ ...p, current_password: v }))} />
                    <div>
                      <PwField label="Nouveau mot de passe" value={pwForm.new_password}
                        show={showNew} onToggle={() => setShowNew(v => !v)}
                        onChange={v => setPwForm(p => ({ ...p, new_password: v }))} />
                      {pwForm.new_password && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                            {[0,1,2,3].map(i => (
                              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < strength.score ? strength.color : "#e2e8f0", transition: "background 0.3s" }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 11, color: strength.color, fontWeight: 700 }}>{strength.label}</span>
                        </div>
                      )}
                    </div>
                    <PwField label="Confirmer le mot de passe" value={pwForm.confirm}
                      show={showConf} onToggle={() => setShowConf(v => !v)}
                      onChange={v => setPwForm(p => ({ ...p, confirm: v }))}
                      error={pwForm.confirm && pwForm.confirm !== pwForm.new_password ? "Les mots de passe ne correspondent pas" : ""}
                      success={pwForm.confirm && pwForm.confirm === pwForm.new_password && pwForm.confirm.length > 0} />
                  </div>
                  <button onClick={handlePasswordSave} disabled={pwSaving} style={{
                    marginTop: 20, padding: "10px 24px",
                    background: pwSaving ? "#94a3b8" : "#1E3AAF",
                    color: "#fff", border: "none", borderRadius: 10,
                    fontSize: 13.5, fontWeight: 700, cursor: pwSaving ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 7,
                  }}>
                    <IcoKey /> {pwSaving ? "Enregistrement..." : "Modifier le mot de passe"}
                  </button>
                </div>
              </div>

              {/* Tips */}
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  Conseils de sécurité
                </div>
                {[
                  "Au moins 8 caractères",
                  "Une lettre majuscule (A–Z)",
                  "Au moins un chiffre (0–9)",
                  "Un caractère spécial (!@#$...)",
                ].map(t => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#f8fafc", marginBottom: 6, border: "1px solid #f0f4ff" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: "#475569" }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ NOTIFICATIONS ══ */}
          {activeSection === "notifications" && (
            <div style={card}>
              <SectionHeader
                icon={<IcoBell s={18} />}
                title="Notifications"
                subtitle="Choisissez comment et quand vous souhaitez être notifié."
              />
              {[
                { label: "Notifications par email",    hint: "Recevoir un email pour chaque nouveau ticket assigné.",         value: notifEmail,   set: setNotifEmail   },
                { label: "Notifications navigateur",   hint: "Afficher les alertes dans le navigateur en temps réel.",        value: notifBrowser, set: setNotifBrowser },
                { label: "Intégration Slack",          hint: "Envoyer les alertes critiques vers un canal Slack configuré.",   value: notifSlack,   set: setNotifSlack   },
              ].map((item, i, arr) => (
                <SettingRow key={item.label} label={item.label} hint={item.hint} last={i === arr.length - 1}>
                  <Toggle value={item.value} onChange={v => { item.set(v); dirty(); }} />
                </SettingRow>
              ))}
            </div>
          )}

          {/* ══ EMAIL ══ */}
          {activeSection === "email" && (
            <div style={card}>
              <SectionHeader
                icon={<IcoMail s={18} />}
                title="Configuration email"
                subtitle="Paramètres SMTP pour l'envoi des emails transactionnels."
              />
              <SettingRow label="Serveur SMTP" hint="Adresse du serveur d'envoi.">
                <input style={input} defaultValue="smtp.gmail.com" onChange={dirty} />
              </SettingRow>
              <SettingRow label="Port" hint="Port SMTP (465 pour SSL, 587 pour TLS).">
                <input style={{ ...input, width: 120 }} defaultValue="587" onChange={dirty} />
              </SettingRow>
              <SettingRow label="Email expéditeur" hint="Adresse affichée dans les emails envoyés.">
                <input style={input} defaultValue="noreply@geiser.fr" onChange={dirty} />
              </SettingRow>
              <SettingRow label="Nom expéditeur" hint="Nom affiché dans les emails." last>
                <input style={input} defaultValue="Helpdesk Geiser" onChange={dirty} />
              </SettingRow>
            </div>
          )}

          {/* ══ BILLING ══ */}
          {activeSection === "billing" && (
            <div style={{ ...card, padding: 48, textAlign: "center" }}>
              <IcoCard s={40} />
              <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Facturation</div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#94a3b8" }}>Ce module sera disponible prochainement.</div>
            </div>
          )}

          {/* ══ API ══ */}
          {activeSection === "api" && (
            <div style={card}>
              <SectionHeader
                icon={<IcoCode s={18} />}
                title="API & webhooks"
                subtitle="Gérez les clés d'accès à l'API REST et configurez les webhooks."
              />
              <SettingRow label="Clé API" hint="Utilisée pour s'authentifier aux appels API.">
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...input, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#64748b" }}
                    value="gsk_••••••••••••••••••••••••••••••••" readOnly />
                  <button style={{ height: 40, padding: "0 14px", border: "1.5px solid #e8ecf7", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151", flexShrink: 0 }}>
                    Copier
                  </button>
                </div>
              </SettingRow>
              <SettingRow label="URL du webhook" hint="Recevez les événements en temps réel." last>
                <input style={input} placeholder="https://votre-serveur.fr/webhook" />
              </SettingRow>
            </div>
          )}

          {/* ══ DOMAINES ══ */}
          {activeSection === "domains" && (
            <div style={card}>
              <SectionHeader
                icon={<IcoGlobe s={18} />}
                title="Domaines"
                subtitle="Configurez les domaines autorisés pour votre organisation."
              />
              <SettingRow label="Domaine principal" hint="Domaine utilisé pour le portail et les liens emails." last>
                <input style={input} defaultValue="geiser.fr" onChange={dirty} />
              </SettingRow>
            </div>
          )}

        </div>
      </div>

      {/* ── Sticky bottom bar for unsaved changes ── */}
      {hasChanges && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "#fff", borderTop: "1px solid #e8ecf7",
          padding: "14px 40px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          zIndex: 100, boxShadow: "0 -4px 20px rgba(0,0,0,0.07)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", fontSize: 13, fontWeight: 600 }}>
            <IcoWarn /> Vous avez des modifications non enregistrées
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setHasChanges(false)} style={{
              padding: "9px 20px", borderRadius: 10, border: "1.5px solid #e8ecf7",
              background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              Annuler
            </button>
            <button onClick={() => setHasChanges(false)} style={{
              padding: "9px 20px", borderRadius: 10, border: "none",
              background: "#1E3AAF", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <IcoSettings s={14} /> Enregistrer les modifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── helpers ─── */
function PwField({ label, value, show, onToggle, onChange, error, success }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input type={show ? "text" : "password"} value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            height: 40, width: "100%", padding: "0 44px 0 12px",
            border: `1.5px solid ${error ? "#fca5a5" : success ? "#86efac" : "#e8ecf7"}`,
            borderRadius: 10, fontSize: 13, outline: "none", fontFamily: "inherit",
            boxSizing: "border-box", background: error ? "#fff5f5" : success ? "#f0fdf4" : "#fff",
          }}
          placeholder="••••••••"
        />
        <button type="button" onClick={onToggle} style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0,
        }}>
          {show ? <IcoEyeOff /> : <IcoEye />}
        </button>
      </div>
      {error   && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#dc2626" }}>{error}</p>}
      {success && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#16a34a" }}>✓ Les mots de passe correspondent</p>}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
      background: value ? "#2B45C8" : "#e2e8f0", padding: 2,
      display: "flex", alignItems: "center",
      justifyContent: value ? "flex-end" : "flex-start",
      transition: "background 0.2s",
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        display: "block",
      }} />
    </button>
  );
}
