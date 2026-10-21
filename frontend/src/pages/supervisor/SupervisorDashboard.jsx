import { useState, useEffect } from "react";
import "../../styles/AdminDashboard.css";
import ChatWidget from "../../components/ChatWidget";
import SupervisorHomeContent       from "./SupervisorHomeContent";
import SupervisorAgentsContent       from "./SupervisorAgentsContent";
import SupervisorQueueContent      from "./SupervisorQueueContent";
import SupervisorRiskContent       from "./SupervisorRiskContent";
import SupervisorPerformanceContent from "./SupervisorPerformanceContent";
import SupervisorSLAContent        from "./SupervisorSLAContent";
import SupervisorAssignmentRulesContent from "./SupervisorAssignmentRulesContent";
import SupervisorAccountSettingsContent from "./SupervisorAccountSettingsContent";
import {
  fetchNotifications, fetchUnreadCount, markAsRead, markAllRead,
} from "../../api/notifications";
import { exportPerformancePDF } from "../../utils/pdfExport";

/* ── Icons ── */
function IconHome()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconUsers()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconInbox()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>; }
function IconAlert()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconBar()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function IconClock()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconSettings() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IconBell()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function IconLogout()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#ffffff"/><polyline points="16 17 21 12 16 7" stroke="#ffffff"/><line x1="21" y1="12" x2="9" y2="12" stroke="#ffffff"/></svg>; }
function IconSearch()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconUser()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

const NAV_GROUPS = [
  {
    label: "TABLEAU DE BORD",
    items: [
      { key: "dashboard", label: "Vue d'ensemble", Icon: IconHome,  badge: null },
    ],
  },
  {
    label: "SUPERVISION",
    items: [
      { key: "agents", label: "Agents du support",  Icon: IconUsers, badge: null },
      { key: "queue", label: "File d'attente",   Icon: IconInbox, badge: "queue" },
      { key: "risk",  label: "Tickets à risque", Icon: IconAlert, badge: "risk" },
    ],
  },
  {
    label: "ANALYSES",
    items: [
      { key: "performance", label: "Performance",       Icon: IconBar,      badge: null },
      { key: "sla",         label: "SLA & engagements", Icon: IconClock,    badge: null },
    ],
  },
  {
    label: "PARAMÈTRES",
    items: [
      { key: "settings", label: "Règles d'assignation", Icon: IconSettings, badge: null },
      { key: "account",  label: "Mon compte",        Icon: IconUser,     badge: null },
    ],
  },
];

const PAGE_TITLES = {
  dashboard:   "Vue d'ensemble",
  agents:      "Agents du support",
  queue:       "File d'attente",
  risk:        "Tickets à risque",
  performance: "Performance",
  sla:         "SLA & engagements",
  settings:    "Règles d'assignation",
  account:     "Paramètres du compte",
};

const BREADCRUMBS = {
  dashboard:   ["SUPERVISION", "VUE D'ENSEMBLE"],
  agents:      ["SUPERVISION", "AGENTS DU SUPPORT"],
  queue:       ["SUPERVISION", "FILE D'ATTENTE"],
  risk:        ["SUPERVISION", "TICKETS À RISQUE"],
  performance: ["SUPERVISION", "PERFORMANCE"],
  sla:         ["SUPERVISION", "SLA"],
  settings:    ["SUPERVISION", "RÈGLES D'ASSIGNATION"],
  account:     ["SUPERVISION", "MON COMPTE"],
};

export default function SupervisorDashboard({ user, onLogout, onUserUpdate }) {
  const [activeSection,     setActiveSection]     = useState("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications,     setNotifications]     = useState([]);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [queueCount,        setQueueCount]        = useState(0);
  const [riskCount,         setRiskCount]         = useState(0);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [perfStats,         setPerfStats]         = useState(null);

  async function loadNotifications() {
    try {
      const [notifs, count] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
      setNotifications(notifs);
      setUnreadCount(count.count);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const [notifs, count] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
        if (mounted) { setNotifications(notifs); setUnreadCount(count.count); }
      } catch { /* ignore */ }
    };
    init();
    const iv = setInterval(init, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    function close() { setShowNotifications(false); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "SV";

  const breadcrumb = BREADCRUMBS[activeSection] || ["SUPERVISION", activeSection.toUpperCase()];
  const pageTitle  = PAGE_TITLES[activeSection] || "";

  function getBadge(badge) {
    if (badge === "queue") return queueCount;
    if (badge === "risk")  return riskCount;
    return null;
  }

  /* ── Top-right contextual button ── */
  function TopBtn() {
    if (activeSection === "performance") {
      return (
        <button className="tb-report-btn" disabled={!perfStats}
          style={!perfStats ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={() => perfStats && exportPerformancePDF(perfStats)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>Exporter PDF</span>
        </button>
      );
    }
    if (activeSection === "sla") {
      return (
        <button className="tb-report-btn">
          <span className="tb-report-star">+</span>
          <span>Nouveau SLA</span>
        </button>
      );
    }
    if (activeSection === "agents") {
      return null;
    }
    if (activeSection === "queue") {
      return null;
    }
    if (activeSection === "dashboard") {
      return null;
    }
    if (activeSection === "settings") return null;
    if (activeSection === "account") return null;
    return null;
  }

  return (
    <div className="adm-shell">

      {/* ══ SIDEBAR ══ */}
      <aside className="adm-sidebar">
        <div className="sb-logo-wrap">
          <img src="/logo-geiser-login.png" alt="Geiser" className="sb-logo-img"
            onError={e => { e.currentTarget.style.display = "none"; }} />
        </div>

        <div className="sb-space-badge">
          <span className="sb-space-dot" />
          <span className="sb-space-label">Espace Superviseur</span>
        </div>

        <nav className="sb-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.10em", textTransform: "uppercase", fontFamily: "var(--font-mono)", padding: "10px 14px 4px" }}>
                {group.label}
              </div>
              {group.items.map(item => {
                const badge = getBadge(item.badge);
                return (
                  <div
                    key={item.key}
                    className={`sb-item${activeSection === item.key ? " active" : ""}`}
                    onClick={() => { setActiveSection(item.key); setSearchQuery(""); }}
                  >
                    <span className="sb-icon"><item.Icon /></span>
                    <span className="sb-item-label">{item.label}</span>
                    {badge ? <span className="sb-badge">{badge}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sb-divider" />

        <div className="sb-user-area">
          <div className="sb-user-avatar">{initials}</div>
          <div className="sb-user-info">
            <span className="sb-user-name">{user?.full_name || "Superviseur"}</span>
            <span className="sb-user-email">{user?.email || ""}</span>
          </div>
          <button className="sb-logout-btn" title="Déconnexion" onClick={onLogout}>
            <img src="/icon-logout.png" alt="Déconnexion" width="18" height="18" />
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="adm-main">

        {/* ── TOPBAR ── */}
        <div className="adm-topbar" onClick={e => e.stopPropagation()}>
          <div className="tb-titles">
            <div className="tb-breadcrumb">
              <span>{breadcrumb[0]}</span>
              <span className="tb-breadcrumb-sep">·</span>
              <span className="tb-breadcrumb-active">{breadcrumb[1]}</span>
            </div>
            <h1>{pageTitle}</h1>
          </div>

          {["agents", "queue", "risk"].includes(activeSection) ? (
            <div className="tb-search">
              <span className="tb-search-icon"><IconSearch /></span>
              <input
                type="text"
                placeholder="Rechercher tickets, agents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:16, lineHeight:1, padding:"0 4px" }}>×</button>
              )}
              {!searchQuery && <span className="tb-search-kbd">⌘K</span>}
            </div>
          ) : (
            <div style={{ flex:1 }} />
          )}

          <div className="tb-actions">
            <div style={{ position: "relative" }}>
              <div className="tb-icon-btn" onClick={() => setShowNotifications(v => !v)}>
                <IconBell />
                {unreadCount > 0 && <span className="tb-notif-badge">{unreadCount}</span>}
              </div>
              {showNotifications && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    <strong>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}</strong>
                    {unreadCount > 0 && (
                      <button className="notif-mark-all" onClick={async e => {
                        e.stopPropagation(); await markAllRead(); await loadNotifications();
                      }}>Tout marquer lu</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">Aucune notification</div>
                  ) : notifications.slice(0, 10).map(n => (
                    <div key={n.notification_id}
                      className={`notif-item${n.is_read ? "" : " unread"}`}
                      onClick={async e => {
                        e.stopPropagation();
                        if (!n.is_read) { await markAsRead(n.notification_id); await loadNotifications(); }
                      }}>
                      <div className={`notif-dot${n.is_read ? " read" : " unread"}`} />
                      <div>
                        <div className={`notif-item-title${n.is_read ? " read" : ""}`}>{n.title}</div>
                        <div className="notif-item-msg">{n.message}</div>
                        <div className="notif-item-time">
                          {n.created_at ? new Date(n.created_at).toLocaleString("fr-FR") : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <TopBtn />
          </div>
        </div>

        {/* ── CONTENT ── */}
        {activeSection === "dashboard"   && <SupervisorHomeContent user={user} />}
        {activeSection === "agents"      && <SupervisorAgentsContent searchQuery={searchQuery} />}
        {activeSection === "queue"       && <SupervisorQueueContent onCountChange={setQueueCount} searchQuery={searchQuery} />}
        {activeSection === "risk"        && <SupervisorRiskContent onCountChange={setRiskCount} searchQuery={searchQuery} />}
        {activeSection === "performance" && <SupervisorPerformanceContent onStatsChange={setPerfStats} />}
        {activeSection === "sla"         && <SupervisorSLAContent />}
        {activeSection === "settings"    && <SupervisorAssignmentRulesContent user={user} />}
        {activeSection === "account"     && <SupervisorAccountSettingsContent user={user} onUserUpdate={onUserUpdate} />}

        <ChatWidget userRole="SUPERVISOR" />

        <div className="adm-footer">
          <span>© 2026 Helpdesk Geiser · IA — Supervision</span>
          <div className="footer-links">
            <a href="#">Confidentialité</a>
            <a href="#">Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
