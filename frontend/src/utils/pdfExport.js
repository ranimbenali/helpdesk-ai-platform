import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Couleurs Helpdesk IA ──
const PRIMARY   = [10, 70, 214];   // #0a46d6
const DARK      = [15, 23, 42];    // #0f172a
const GRAY      = [100, 116, 139]; // #64748b
const LIGHT_BG  = [248, 250, 255]; // #f8faff
const WHITE     = [255, 255, 255];

function addHeader(doc, title) {
  // Bande bleue en haut
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, 210, 22, "F");

  // Logo / titre
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("🎫 Helpdesk IA — Geiser", 14, 14);

  // Titre du document
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 210 - 14, 14, { align: "right" });

  // Date
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.text(
    `Généré le ${new Date().toLocaleString("fr-FR")}`,
    14, 28
  );
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...LIGHT_BG);
    doc.rect(0, 285, 210, 12, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.text("Helpdesk IA — Geiser © 2026", 14, 292);
    doc.text(`Page ${i} / ${pageCount}`, 210 - 14, 292, { align: "right" });
  }
}

// ══════════════════════════════════════════════
// Export 1 — Fiche détaillée d'un ticket
// ══════════════════════════════════════════════
export function exportTicketPDF(ticket, messages = [], auditItems = []) {
  const doc = new jsPDF();

  addHeader(doc, "Fiche Ticket");

  let y = 36;

  // ── Titre ticket ──
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, 182, 14, 3, 3, "F");
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Ticket #${ticket.external_id || ticket.ticket_id} — ${ticket.title || ""}`,
    14 + 4, y + 9.5
  );
  y += 20;

  // ── Informations générales ──
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informations générales", 14, y);
  y += 2;

  const infos = [
    ["Demandeur",  ticket.requester_name  || "—"],
    ["Agent",      ticket.assignee_name   || "Non assigné"],
    ["Site",       ticket.site            || "—"],
    ["Groupe",     ticket.group_name      || "—"],
    ["Priorité",   ticket.priority_label  || "—"],
    ["Statut",     ticket.status          || "—"],
    ["Créé le",    ticket.created_at
      ? new Date(ticket.created_at).toLocaleString("fr-FR") : "—"],
    ["Résolu le",  ticket.resolved_at
      ? new Date(ticket.resolved_at).toLocaleString("fr-FR") : "—"],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [],
    body: infos,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: LIGHT_BG, textColor: GRAY, cellWidth: 40 },
      1: { textColor: DARK },
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Description ──
  if (ticket.description) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Description", 14, y);
    y += 4;

    // Nettoyer le HTML
    const cleanDesc = (ticket.description || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(cleanDesc, 182);
    doc.text(lines, 14, y + 4);
    y += lines.length * 4 + 10;
  }

  // ── Messages ──
  if (messages.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Messages", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [["Auteur", "Message", "Date"]],
      body: messages.map((m) => [
        m.author_name || "—",
        m.content || "—",
        m.created_at ? new Date(m.created_at).toLocaleString("fr-FR") : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 110 },
        2: { cellWidth: 37 },
      },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Historique ──
  if (auditItems.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Historique des actions", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [["Action", "Par", "Ancienne valeur", "Nouvelle valeur", "Date"]],
      body: auditItems.map((a) => [
        formatEventType(a.event_type),
        a.author_name || "—",
        a.old_value   || "—",
        a.new_value   || "—",
        a.created_at  ? new Date(a.created_at).toLocaleString("fr-FR") : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`ticket_${ticket.external_id || ticket.ticket_id}.pdf`);
}

// ══════════════════════════════════════════════
// Export 2 — Rapport liste de tickets
// ══════════════════════════════════════════════
export function exportTicketsListPDF(tickets, filters = {}) {
  const doc = new jsPDF({ orientation: "landscape" });

  addHeader(doc, "Rapport Tickets");

  let y = 36;

  // ── Résumé filtres ──
  if (filters.dateFrom || filters.dateTo) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const from = filters.dateFrom || "—";
    const to   = filters.dateTo   || "—";
    doc.text(`Période : ${from} → ${to}`, 14, y);
    y += 6;
  }

  // ── KPIs ──
  const total    = tickets.length;
  const open     = tickets.filter((t) => t.status === "OPEN").length;
  const resolved = tickets.filter((t) => ["RESOLVED", "CLOSED"].includes(t.status)).length;
  const rate     = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const kpis = [
    ["Total tickets", String(total)],
    ["Ouverts",       String(open)],
    ["Résolus",       String(resolved)],
    ["Taux résolution", `${rate}%`],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: kpis,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRAY,    cellWidth: 40 },
      1: { fontStyle: "bold", textColor: PRIMARY,  cellWidth: 30 },
    },
    tableWidth: 160,
    margin: { left: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Tableau tickets ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(`Liste des tickets (${total})`, 14, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    head: [["ID", "Objet", "Demandeur", "Agent", "Site", "Priorité", "Statut", "Créé le"]],
    body: tickets.map((t) => [
      t.id || t.external_id || t.ticket_id,
      (t.title || "—").substring(0, 50),
      t.requester  || t.requester_name  || "—",
      t.assignee   || t.assignee_name   || "Non assigné",
      t.site       || "—",
      t.priority   || t.priority_label  || "—",
      t.status     || "—",
      t.created_at
        ? new Date(t.created_at).toLocaleString("fr-FR")
        : (t.created_at || "—"),
    ]),
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 65 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  doc.save(`rapport_tickets_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ══════════════════════════════════════════════
// Export 3 — Performance (Superviseur)
// ══════════════════════════════════════════════
export function exportPerformancePDF(stats) {
  const doc = new jsPDF();

  addHeader(doc, "Performance");

  let y = 36;

  const total    = stats?.total ?? 0;
  const resolved = (stats?.by_status?.RESOLVED ?? 0) + (stats?.by_status?.CLOSED ?? 0);
  const rate     = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const unassigned = stats?.unassigned ?? 0;

  const kpis = [
    ["Total tickets",   String(total)],
    ["Résolus",         String(resolved)],
    ["Taux résolution", `${rate}%`],
    ["Non assignés",    String(unassigned)],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: kpis,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRAY,    cellWidth: 40 },
      1: { fontStyle: "bold", textColor: PRIMARY, cellWidth: 30 },
    },
    tableWidth: 160,
    margin: { left: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Répartition par statut ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("Répartition par statut", 14, y);
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    head: [["Ouverts", "En cours", "Résolus", "Fermés"]],
    body: [[
      stats?.by_status?.OPEN ?? 0,
      stats?.by_status?.IN_PROGRESS ?? 0,
      stats?.by_status?.RESOLVED ?? 0,
      stats?.by_status?.CLOSED ?? 0,
    ]],
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, halign: "center" },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Classement agents ──
  const byAgent = [...(stats?.by_agent ?? [])].sort((a, b) => b.count - a.count);
  if (byAgent.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text(`Classement agents (${byAgent.length})`, 14, y);
    y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [["#", "Agent", "Tickets traités"]],
      body: byAgent.map((a, i) => [String(i + 1), a.full_name, String(a.count)]),
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Activité récente ──
  const logs = stats?.audit_logs ?? [];
  if (logs.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Activité récente", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [["Ticket", "Action", "Par", "Date"]],
      body: logs.map((log) => [
        `#${log.ticket_id}`,
        formatEventType(log.event_type),
        log.author_name || "—",
        log.created_at ? new Date(log.created_at).toLocaleString("fr-FR") : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  doc.save(`performance_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function formatEventType(t) {
  if (t === "STATUS_CHANGED")   return "Statut modifié";
  if (t === "PRIORITY_CHANGED") return "Priorité modifiée";
  if (t === "ASSIGNEE_CHANGED") return "Agent modifié";
  return t || "—";
}