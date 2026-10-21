import { useState, useEffect } from "react";
import "../../styles/AdminDashboard.css";
import ChatWidget from "../../components/ChatWidget";
import AgentHomeContent        from "./AgentHomeContent";
import AgentTicketsContent     from "./AgentTicketsContent";
import AgentIASuggestions      from "./AgentIASuggestions";
import AgentConversations      from "./AgentConversations";
import AgentPerformance        from "./AgentPerformance";
import AgentPreferences        from "./AgentPreferences";
import {
  fetchNotifications, fetchUnreadCount, markAsRead, markAllRead,
} from "../../api/notifications";
import { API_BASE } from '../../api/config.js';

/* ── Icons ── */
function IcoHome()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IcoTicket() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="9" y1="12" x2="15" y2="12"/></svg>; }
function IcoAI()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IcoChat()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function IcoBar()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>; }
function IcoGear()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IcoBell()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function IcoOut()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#ffffff"/><polyline points="16 17 21 12 16 7" stroke="#ffffff"/><line x1="21" y1="12" x2="9" y2="12" stroke="#ffffff"/></svg>; }
function IcoSearch() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }

const NAV = [
  { key: "home",    label: "Mon espace",         Icon: IcoHome,   badge: null },
  { key: "tickets", label: "Mes tickets",         Icon: IcoTicket, badge: "tickets" },
  { key: "ai",      label: "Suggestions IA",      Icon: IcoAI,     badge: "ai" },
  { key: "chat",    label: "Conversations",       Icon: IcoChat,   badge: null },
  { key: "perf",    label: "Ma performance",      Icon: IcoBar,    badge: null },
  { key: "prefs",   label: "Mon compte",          Icon: IcoGear,   badge: null },
];

const PAGE_TITLES = {
  home:    null,
  tickets: null, // dynamic
  ai:      null, // dynamic
  chat:    "Conversations en direct",
  perf:    "Ma performance",
  prefs:   "Mon compte",
};

const BREADCRUMBS = {
  home:    ["ESPACE AGENT", "MON ESPACE"],
  tickets: ["ESPACE AGENT", "MES TICKETS"],
  ai:      ["ESPACE AGENT", "ASSISTANT IA"],
  chat:    ["ESPACE AGENT", "CONVERSATIONS"],
  perf:    ["ESPACE AGENT", "PERFORMANCE"],
  prefs:   ["ESPACE AGENT", "MON COMPTE"],
};

const TOPBAR_BTN = {
  home:    null,
  tickets: null,
  ai:      { label: "Régler la confiance min.", icon: "⚙", blue: false },
  chat:    null,
  perf:    { label: "Exporter", icon: null, blue: false },
  prefs:   { label: "Exporter", icon: null, blue: false },
};

export default function AgentDashboard({ user, onLogout, onUserUpdate }) {
  const [active,            setActive]            = useState("home");
  const [showNotif,         setShowNotif]         = useState(false);
  const [notifications,     setNotifications]     = useState([]);
  const [unreadCount,       setUnreadCount]       = useState(0);
  const [status,            setStatus]            = useState("Disponible");
  const [ticketsTitle,      setTicketsTitle]       = useState("Mes tickets");
  const [ticketsBadge,      setTicketsBadge]       = useState(0);
  const [searchQuery,       setSearchQuery]        = useState("");

  const [aiBadge, setAiBadge] = useState(0);

  async function loadNotif() {
    try {
      const [n, c] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
      setNotifications(n); setUnreadCount(c.count);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let ok = true;
    const run = async () => {
      try {
        const token = localStorage.getItem("token");
        const h = { Authorization: `Bearer ${token}` };
        const [n, c, aiRes] = await Promise.all([
          fetchNotifications(),
          fetchUnreadCount(),
          fetch(`${API_BASE}/ai/pending`, { headers: h }).then(r => r.ok ? r.json() : []).catch(() => []),
        ]);
        if (ok) {
          setNotifications(n);
          setUnreadCount(c.count);
          setAiBadge(Array.isArray(aiRes) ? aiRes.length : 0);
        }
      } catch { /* ignore */ }
    };
    run();
    const iv = setInterval(run, 30000);
    return () => { ok = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const close = () => setShowNotif(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "AG";
  const firstName = user?.full_name?.split(" ")[0] || "Agent";
  const breadcrumb = BREADCRUMBS[active] || ["ESPACE AGENT", ""];
  const btn = TOPBAR_BTN[active];
  const statusColors = {
    "Disponible": { dot: "#22c55e", bg: "#f0fdf4", color: "#16a34a" },
    "Occupé":     { dot: "#f97316", bg: "#fff7ed", color: "#ea580c" },
    "Absent":     { dot: "#eab308", bg: "#fefce8", color: "#ca8a04" },
    "Hors ligne": { dot: "#94a3b8", bg: "#f8fafc", color: "#64748b" },
  };
  const sc = statusColors[status];

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
          <span className="sb-space-label">Espace Agent</span>
        </div>

        <nav className="sb-nav" style={{ paddingTop: 8 }}>
          {NAV.map(({ key, label, Icon, badge }) => (
            <div key={key}
              className={`sb-item${active === key ? " active" : ""}`}
              onClick={() => { setActive(key); setSearchQuery(""); }}>
              <span className="sb-icon"><Icon /></span>
              <span className="sb-item-label">{label}</span>
              {badge === "tickets" && ticketsBadge > 0 && (
                <span className="sb-badge" style={{ background: "#2B45C8" }}>{ticketsBadge}</span>
              )}
              {badge === "ai" && aiBadge > 0 && (
                <span className="sb-badge" style={{ background: "#8B5CF6" }}>{aiBadge}</span>
              )}
            </div>
          ))}
        </nav>

        <div className="sb-divider" />

        <div className="sb-user-area">
          <div className="sb-user-avatar">{initials}</div>
          <div className="sb-user-info">
            <span className="sb-user-name">{user?.full_name || "Agent"}</span>
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
            <h1>
              {active === "home"
                ? `Bonjour ${firstName}${ticketsBadge > 0 ? ` — ${ticketsBadge} ticket${ticketsBadge > 1 ? "s" : ""} vous attend${ticketsBadge > 1 ? "ent" : ""}` : ""}`
                : active === "tickets"
                ? ticketsTitle
                : active === "ai"
                ? `Suggestions IA${aiBadge > 0 ? ` (${aiBadge} en attente)` : ""}`
                : PAGE_TITLES[active]}
            </h1>
          </div>

          {active === "home" ? (
            <div className="tb-search">
              <span className="tb-search-icon"><IcoSearch /></span>
              <input
                type="text"
                placeholder="Rechercher un ticket (numéro, sujet, demandeur)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <span className="tb-search-kbd">⌘K</span>
            </div>
          ) : (
            <div style={{ flex:1 }} />
          )}

          <div className="tb-actions">
            {/* Bell */}
            <div style={{ position: "relative" }}>
              <div className="tb-icon-btn" onClick={e => { e.stopPropagation(); setShowNotif(v => !v); }}>
                <IcoBell />
                {unreadCount > 0 && <span className="tb-notif-badge">{unreadCount}</span>}
              </div>
              {showNotif && (
                <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="notif-dropdown-header">
                    <strong>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}</strong>
                    {unreadCount > 0 && (
                      <button className="notif-mark-all" onClick={async () => { await markAllRead(); await loadNotif(); }}>
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  {notifications.length === 0
                    ? <div className="notif-empty">Aucune notification</div>
                    : notifications.slice(0, 10).map(n => (
                      <div key={n.notification_id}
                        className={`notif-item${n.is_read ? "" : " unread"}`}
                        onClick={async () => { if (!n.is_read) { await markAsRead(n.notification_id); await loadNotif(); } }}>
                        <div className={`notif-dot${n.is_read ? " read" : " unread"}`} />
                        <div>
                          <div className={`notif-item-title${n.is_read ? " read" : ""}`}>{n.title}</div>
                          <div className="notif-item-msg">{n.message}</div>
                          <div className="notif-item-time">{n.created_at ? new Date(n.created_at).toLocaleString("fr-FR") : ""}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Status pill */}
            <div style={{ position: "relative" }}>
              <button type="button"
                onClick={() => {
                  const opts = ["Disponible", "Occupé", "Absent", "Hors ligne"];
                  const idx = opts.indexOf(status);
                  setStatus(opts[(idx + 1) % opts.length]);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", border: `1.5px solid ${sc.dot}30`,
                  borderRadius: 20, background: sc.bg, cursor: "pointer",
                  fontSize: 12.5, fontWeight: 700, color: sc.color,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot }} />
                {status}
              </button>
            </div>

            {/* Contextual button */}
            {btn && (
              <button type="button" className="tb-report-btn"
                style={btn.blue ? {} : { background: "#fff", color: "#334155", border: "1.5px solid #e8ecf7", boxShadow: "none" }}>
                {btn.icon && <span className="tb-report-star">{btn.icon}</span>}
                <span>{btn.label}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── CONTENT ── */}
        {active === "home"    && <AgentHomeContent    user={user} onNavigate={setActive} searchQuery={searchQuery} />}
        {active === "tickets" && <AgentTicketsContent onTitleChange={setTicketsTitle} onBadgeChange={setTicketsBadge} />}
        {active === "ai"      && <AgentIASuggestions />}
        {active === "chat"    && <AgentConversations user={user} />}
        {active === "perf"    && <AgentPerformance user={user} />}
        {active === "prefs"   && <AgentPreferences user={user} onUserUpdate={onUserUpdate} />}

        <ChatWidget userRole="AGENT" />

        <div className="adm-footer">
          <span>© 2026 Helpdesk Geiser — Espace Agent</span>
          <div className="footer-links"><a href="#">Support</a></div>
        </div>
      </div>
    </div>
  );
}
