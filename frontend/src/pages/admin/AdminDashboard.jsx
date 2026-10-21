import { useState, useEffect } from "react";
import "../../styles/AdminDashboard.css";
import ChatWidget from "../../components/ChatWidget";
import AdminHomeContent from "./AdminHomeContent";
import AdminUsersContent from "./AdminUsersContent";
import AdminRolesContent from "./AdminRolesContent";
import AdminTicketsContent from "./AdminTicketsContent";
import AdminReportsContent from "./AdminReportsContent";
import AdminIAConfigContent from "./AdminIAConfigContent";
import AdminSettingsContent from "./AdminConfigurationContent";
import AdminAuditContent from "./AdminAuditContent";
import AccountSettingsContent from "./AccountSettingsContent";
import ProfilePage from "../../pages/ProfilePage";
import SupervisorSLAContent from "../supervisor/SupervisorSLAContent";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllRead,
} from "../../api/notifications";

/* ─── SVG icon helpers ─── */
function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function IconTicket() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconCpu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <line x1="9" y1="1" x2="9" y2="4"/>
      <line x1="15" y1="1" x2="15" y2="4"/>
      <line x1="9" y1="20" x2="9" y2="23"/>
      <line x1="15" y1="20" x2="15" y2="23"/>
      <line x1="20" y1="9" x2="23" y2="9"/>
      <line x1="20" y1="14" x2="23" y2="14"/>
      <line x1="1" y1="9" x2="4" y2="9"/>
      <line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#ffffff"/>
      <polyline points="16 17 21 12 16 7" stroke="#ffffff"/>
      <line x1="21" y1="12" x2="9" y2="12" stroke="#ffffff"/>
    </svg>
  );
}
/* ─── sections groupées ─── */
const NAV_GROUPS = [
  {
    label: "Tableau de bord",
    items: [
      { key: "dashboard", label: "Vue d'ensemble", Icon: IconHome },
    ],
  },
  {
    label: "Gestion",
    items: [
      { key: "tickets", label: "Tickets",             Icon: IconTicket, badge: true },
      { key: "users",   label: "Utilisateurs",        Icon: IconUsers,  badge: true },
      { key: "roles",   label: "Rôles & permissions", Icon: IconShield },
    ],
  },
  {
    label: "Configuration",
    items: [
      { key: "sla",     label: "Catégories & SLA",   Icon: IconClock   },
      { key: "reports", label: "Configuration IA",   Icon: IconCpu     },
      { key: "account", label: "Paramètres",         Icon: IconSettings},
    ],
  },
  {
    label: "Rapports & Audit",
    items: [
      { key: "Configuration", label: "Audit & logs",   Icon: IconFile },
      { key: "stats",         label: "Statistiques",   Icon: IconChart },
    ],
  },
];
/* flat list pour compatibilité breadcrumb */
const SECTIONS = NAV_GROUPS.flatMap(g => g.items);

export default function AdminDashboard({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [triggerNewUser, setTriggerNewUser]     = useState(0);
  const [triggerNewRole, setTriggerNewRole]     = useState(0);
  const [triggerNewTicket, setTriggerNewTicket]       = useState(0);
  const [triggerExportCSV, setTriggerExportCSV]       = useState(0);
  const [triggerNewCategory, setTriggerNewCategory]   = useState(0);
  const [triggerAuditExport, setTriggerAuditExport]   = useState(0);

  function navigateTo(section) {
    setActiveSection(section);
    setTriggerNewTicket(0);
    setTriggerNewUser(0);
    setTriggerNewRole(0);
  }

  async function loadNotifications() {
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(),
        fetchUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count.count);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    let isMounted = true;
    const initNotifications = async () => {
      try {
        const [notifs, count] = await Promise.all([
          fetchNotifications(),
          fetchUnreadCount(),
        ]);
        if (isMounted) {
          setNotifications(notifs);
          setUnreadCount(count.count);
        }
      } catch (err) {
        console.error(err);
      }
    };
    initNotifications();
    const interval = setInterval(initNotifications, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside() {
      setShowNotifications(false);
      setShowMessages(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  /* current section meta */
  const currentSection = SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0];
  const initials = user?.full_name
    ? user.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "A";

  return (
    <div className="adm-shell">
      {/* ═══════════ SIDEBAR ═══════════ */}
      <aside className="adm-sidebar">
        {/* Logo */}
        <div className="sb-logo-wrap">
          <img
            src="/logo-geiser-login.png"
            alt="Geiser"
            className="sb-logo-img"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        {/* Space badge */}
        <div className="sb-space-badge">
          <span className="sb-space-dot" />
          <span className="sb-space-label">Espace Admin</span>
        </div>

        {/* Nav groupée */}
        <nav className="sb-nav">
          {NAV_GROUPS.map(({ label: groupLabel, items }) => (
            <div key={groupLabel} className="sb-group">
              <div className="sb-group-label">{groupLabel}</div>
              {items.map(({ key, label, Icon, badge }) => (
            <div
              key={key}
              className={`sb-item${activeSection === key ? " active" : ""}`}
              onClick={() => navigateTo(key)}
            >
              <span className="sb-icon">
                <Icon />
              </span>
              <span className="sb-item-label">{label}</span>
              {badge && key === "users" && unreadCount > 0 && (
                <span className="sb-badge">{unreadCount}</span>
              )}
            </div>
          ))}
            </div>
          ))}
        </nav>

        <div className="sb-divider" />

        {/* Bottom user strip */}
        <div className="sb-user-area">
          <div className="sb-user-avatar">{initials}</div>
          <div className="sb-user-info">
            <span className="sb-user-name">{user?.full_name || "Admin"}</span>
            <span className="sb-user-email">{user?.email || ""}</span>
          </div>
          <button className="sb-logout-btn" title="Déconnexion" onClick={onLogout}>
            <img src="/icon-logout.png" alt="Déconnexion" width="18" height="18" />
          </button>
        </div>
      </aside>

      {/* ═══════════ MAIN ═══════════ */}
      <div className="adm-main">
        {/* ── TOPBAR ── */}
        <div className="adm-topbar" onClick={(e) => e.stopPropagation()}>
          {/* Left: breadcrumb + title */}
          <div className="tb-titles">
            <div className="tb-breadcrumb">
              <span>ADMINISTRATION</span>
              <span className="tb-breadcrumb-sep">·</span>
              <span className="tb-breadcrumb-active">
                {currentSection.labelShort}
              </span>
            </div>
            <h1>
              {activeSection === "dashboard"
                ? "Vue d'ensemble système"
                : activeSection === "tickets"
                ? "Gestion des tickets"
                : activeSection === "users"
                ? "Gestion des utilisateurs"
                : activeSection === "roles"
                ? "Rôles & permissions"
                : activeSection === "sla"
                ? "Catégories & SLA"
                : activeSection === "reports"
                ? "Configuration IA"
                : activeSection === "stats"
                ? "Statistiques"
                : activeSection === "Configuration"
                ? "Audit & logs"
                : "Paramètres globaux"}
            </h1>
          </div>


          {/* Right: actions */}
          <div className="tb-actions">
            {/* Notifications bell */}
            <div style={{ position: "relative" }}>
              <div
                className="tb-icon-btn"
                onClick={() => {
                  setShowNotifications((v) => !v);
                  setShowMessages(false);
                }}
              >
                <IconBell />
                {unreadCount > 0 && (
                  <span className="tb-notif-badge">{unreadCount}</span>
                )}
              </div>

              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    <strong>
                      Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
                    </strong>
                    {unreadCount > 0 && (
                      <button
                        className="notif-mark-all"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await markAllRead();
                          await loadNotifications();
                        }}
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">Aucune notification</div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.notification_id}
                        className={`notif-item${n.is_read ? "" : " unread"}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!n.is_read) {
                            await markAsRead(n.notification_id);
                            await loadNotifications();
                          }
                        }}
                      >
                        <div
                          className={`notif-dot${n.is_read ? " read" : " unread"}`}
                        />
                        <div>
                          <div
                            className={`notif-item-title${n.is_read ? " read" : ""}`}
                          >
                            {n.title}
                          </div>
                          <div className="notif-item-msg">{n.message}</div>
                          <div className="notif-item-time">
                            {n.created_at
                              ? new Date(n.created_at).toLocaleString("fr-FR")
                              : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Messages */}
            <div style={{ position: "relative" }}>
              <div
                className="tb-icon-btn"
                onClick={() => {
                  setShowMessages((v) => !v);
                  setShowNotifications(false);
                }}
              >
                <IconMail />
              </div>
              {showMessages && (
                <div className="msg-dropdown">
                  <div className="msg-dropdown-header">Messagerie interne</div>
                  <div className="msg-soon">
                    <div className="msg-soon-icon">🚀</div>
                    <p className="msg-soon-title">Bientôt disponible</p>
                    <p className="msg-soon-desc">
                      La messagerie interne entre agents et admins sera
                      disponible prochainement.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton contextuel selon la section */}
            {activeSection === "users" ? (
              <button className="tb-report-btn" onClick={() => setTriggerNewUser(n => n + 1)}>
                <span className="tb-report-star">+</span>
                <span>Nouvel utilisateur</span>
              </button>
            ) : activeSection === "roles" ? (
              <button className="tb-report-btn" onClick={() => setTriggerNewRole(n => n + 1)}>
                <span className="tb-report-star">+</span>
                <span>Nouveau rôle</span>
              </button>
            ) : activeSection === "tickets" ? (
              <div style={{ display:"flex", gap:8 }}>
                <button className="tb-report-btn" style={{ background:"#fff", color:"#334155", border:"1.5px solid #e8ecf7", boxShadow:"none" }}
                  onClick={() => setTriggerExportCSV(n => n+1)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Exporter CSV</span>
                </button>
                <button className="tb-report-btn" onClick={() => setTriggerNewTicket(n => n+1)}>
                  <span className="tb-report-star">+</span>
                  <span>Créer un ticket</span>
                </button>
              </div>
            ) : activeSection === "sla" ? (
              <button className="tb-report-btn" onClick={() => setTriggerNewCategory(n => n+1)}>
                <span className="tb-report-star">+</span>
                <span>Nouvelle catégorie</span>
              </button>
            ) : activeSection === "Configuration" ? (
              <button className="tb-report-btn" style={{ background:"#fff", color:"#334155", border:"1.5px solid #e8ecf7", boxShadow:"none" }}
                onClick={() => setTriggerAuditExport(n => n+1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Exporter CSV</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ── CONTENU ── */}
        {activeSection === "dashboard" && <AdminHomeContent />}
        {activeSection === "tickets" && <AdminTicketsContent triggerNewTicket={triggerNewTicket} triggerExportCSV={triggerExportCSV} />}
        {activeSection === "users" && <AdminUsersContent triggerNewUser={triggerNewUser} />}
        {activeSection === "roles" && <AdminRolesContent triggerNewRole={triggerNewRole} />}
        {activeSection === "reports" && <AdminIAConfigContent />}
        {activeSection === "stats"   && <AdminReportsContent />}
        {activeSection === "Configuration" && <AdminAuditContent triggerExport={triggerAuditExport} />}
        {activeSection === "sla" && <SupervisorSLAContent triggerNewCategory={triggerNewCategory} />}
        {activeSection === "account" && <AccountSettingsContent user={user} />}

        {showProfile && (
          <ProfilePage user={user} onClose={() => setShowProfile(false)} />
        )}

        <ChatWidget userRole="ADMIN" />

        {/* ── FOOTER ── */}
        <div className="adm-footer">
          <span>© 2026 Helpdesk Geiser — Administration</span>
          <div className="footer-links">
            <a href="#">Confidentialité</a>
            <a href="#">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
