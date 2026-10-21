import { useState, useEffect } from "react";
import "../../styles/AdminDashboard.css";
import ChatWidget from "../../components/ChatWidget";
import RequesterHome          from "./RequesterHome";
import RequesterTickets       from "./RequesterTickets";
import RequesterNewTicket     from "./RequesterNewTicket";
import RequesterConversations from "./RequesterConversations";
import RequesterServiceStatus from "./RequesterServiceStatus";
import RequesterAccount       from "./RequesterAccount";
import { fetchNotifications, fetchUnreadCount, markAsRead, markAllRead } from "../../api/notifications";
import { fetchMyRequests } from "../../api/tickets";

/* ── Icons ── */
function IcoHome()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IcoInbox()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>; }
function IcoPlus()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IcoChat()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function IcoGlobe()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>; }
function IcoGear()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function IcoBell()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>; }
function IcoOut()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#ffffff"/><polyline points="16 17 21 12 16 7" stroke="#ffffff"/><line x1="21" y1="12" x2="9" y2="12" stroke="#ffffff"/></svg>; }
function IcoSearch() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }

const NAV = [
  { key:"home",    label:"Accueil",            Icon:IcoHome,  badge:null      },
  { key:"tickets", label:"Mes tickets",        Icon:IcoInbox, badge:"tickets" },
  { key:"new",     label:"Nouveau ticket",     Icon:IcoPlus,  badge:null      },
  { key:"convs",   label:"Mes conversations",  Icon:IcoChat,  badge:null      },
  { key:"status",  label:"Statut des services",Icon:IcoGlobe, badge:null      },
  { key:"account", label:"Mon compte",         Icon:IcoGear,  badge:null      },
];

const BREADCRUMBS = {
  home:    ["ESPACE CLIENT", "Accueil"],
  tickets: ["ESPACE CLIENT", "MES TICKETS"],
  new:     ["ESPACE CLIENT", "NOUVEAU"],
  convs:   ["ESPACE CLIENT", "CONVERSATIONS"],
  status:  ["ESPACE CLIENT", "STATUT"],
  account: ["ESPACE CLIENT", "MON COMPTE"],
};

const PAGE_TITLES_STATIC = {
  home:    null,
  new:     "Créer un nouveau ticket",
  convs:   "Mes conversations",
  status:  "Statut des services",
  account: "Mon compte",
};

export default function RequesterDashboard({ user, onLogout, onUserUpdate }) {
  const [active,        setActive]        = useState("home");
  const [showNotif,     setShowNotif]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [ticketsTitle,  setTicketsTitle]  = useState("Mes tickets");
  const [searchQuery,   setSearchQuery]   = useState("");

  function navigateTo(section) { setActive(section); setSearchQuery(""); }

  const [ticketsBadge, setTicketsBadge] = useState(0);
  const firstName = user?.full_name?.split(" ")[0] || "Pierre";

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
        const [n, c] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
        if (ok) { setNotifications(n); setUnreadCount(c.count); }
      } catch { /* ignore */ }
    };
    run();
    const iv = setInterval(run, 30000);
    return () => { ok = false; clearInterval(iv); };
  }, []);

  useEffect(() => {
    let ok = true;
    const run = async () => {
      try {
        const tickets = await fetchMyRequests({ limit: 100 });
        const open = tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
        if (ok) setTicketsBadge(open);
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
    : "DM";
  const bc = BREADCRUMBS[active] || ["ESPACE CLIENT", ""];

  const topbarRight = active === "tickets" ? (
    <button type="button" className="tb-report-btn" onClick={() => setActive("new")}>
      <span className="tb-report-star">+</span><span>Nouveau ticket</span>
    </button>
  ) : active === "status" ? (
    <button type="button" className="tb-report-btn" style={{ background:"#fff", color:"#334155", border:"1.5px solid #e8ecf7", boxShadow:"none" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span>S'abonner aux alertes</span>
    </button>
  ) : null;

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
          <span className="sb-space-label">Espace Demandeur</span>
        </div>
        <nav className="sb-nav" style={{ paddingTop:8 }}>
          {NAV.map((item) => {
            const NavIcon = item.Icon;
            return (
              <div key={item.key}
                className={`sb-item${active === item.key ? " active" : ""}`}
                onClick={() => navigateTo(item.key)}>
                <span className="sb-icon"><NavIcon /></span>
                <span className="sb-item-label">{item.label}</span>
                {item.badge === "tickets" && ticketsBadge > 0 && (
                  <span className="sb-badge" style={{ background:"#2B45C8" }}>{ticketsBadge}</span>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sb-divider" />
        <div className="sb-user-area">
          <div className="sb-user-avatar">{initials}</div>
          <div className="sb-user-info">
            <span className="sb-user-name">{user?.full_name || "Demandeur"}</span>
            <span className="sb-user-email">{user?.email || ""}</span>
          </div>
          <button className="sb-logout-btn" title="Déconnexion" onClick={onLogout}>
            <img src="/icon-logout.png" alt="Déconnexion" width="18" height="18" />
          </button>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="adm-main">
        <div className="adm-topbar" onClick={e => e.stopPropagation()}>
          <div className="tb-titles">
            <div className="tb-breadcrumb">
              <span>{bc[0]}</span>
              <span className="tb-breadcrumb-sep">·</span>
              <span className="tb-breadcrumb-active">{bc[1]}</span>
            </div>
            <h1>
              {active === "home"
                ? `Bonjour ${firstName}, comment pouvons-nous vous aider ?`
                : active === "tickets"
                ? ticketsTitle
                : PAGE_TITLES_STATIC[active] || ""}
            </h1>
          </div>
          {!["new", "account", "status", "convs"].includes(active) ? (
            <div className="tb-search">
              <span className="tb-search-icon"><IcoSearch /></span>
              <input
                type="text"
                placeholder="Rechercher tickets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <span className="tb-search-kbd">⌘K</span>
            </div>
          ) : (
            <div style={{ flex:1 }} />
          )}
          <div className="tb-actions">
            <div style={{ position:"relative" }}>
              <div className="tb-icon-btn" onClick={e => { e.stopPropagation(); setShowNotif(v => !v); }}>
                <IcoBell />
                {unreadCount > 0 && <span className="tb-notif-badge">{unreadCount}</span>}
              </div>
              {showNotif && (
                <div className="notif-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="notif-dropdown-header">
                    <strong>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}</strong>
                    {unreadCount > 0 && <button className="notif-mark-all" onClick={async () => { await markAllRead(); await loadNotif(); }}>Tout marquer lu</button>}
                  </div>
                  {notifications.length === 0
                    ? <div className="notif-empty">Aucune notification</div>
                    : notifications.slice(0,10).map(n => (
                      <div key={n.notification_id} className={`notif-item${n.is_read ? "" : " unread"}`}
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
            {topbarRight}
          </div>
        </div>

        {active === "home"    && <RequesterHome    user={user} onNavigate={navigateTo} searchQuery={searchQuery} />}
        {active === "tickets" && <RequesterTickets user={user} onNavigate={navigateTo} onTitleChange={setTicketsTitle} searchQuery={searchQuery} />}
        {active === "new"     && <RequesterNewTicket onNavigate={setActive} />}
        {active === "convs"   && <RequesterConversations user={user} />}
        {active === "status"  && <RequesterServiceStatus />}
        {active === "account" && <RequesterAccount user={user} onUserUpdate={onUserUpdate} />}

        <ChatWidget userRole="REQUESTER" />

        <div className="adm-footer">
          <span>© 2026 Helpdesk Geiser — Espace Client</span>
          <div className="footer-links"><a href="#">Confidentialité</a><a href="#">Support</a></div>
        </div>
      </div>
    </div>
  );
}
