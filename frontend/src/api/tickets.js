import { API_BASE } from './config.js';

function getAuthHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse(res, defaultMessage) {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.detail || defaultMessage);
  }

  return data;
}

export async function fetchTickets({
  q = "",
  status = "",
  priority = "",
  skip = 0,
  limit = 50,
} = {}) {
  const params = new URLSearchParams();

  if (q) params.append("q", q);
  if (status) params.append("status", status);
  if (priority) params.append("priority", priority);
  params.append("skip", String(skip));
  params.append("limit", String(limit));

  const res = await fetch(`${API_BASE}/tickets/?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors du chargement des tickets");
}

function getAuthHeaderOnly() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

export async function uploadTicketAttachment(ticketId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: getAuthHeaderOnly(), // pas de Content-Type : le navigateur fixe le boundary multipart lui-même
    body: formData,
  });
  return handleResponse(res, "Erreur lors de l'envoi de la pièce jointe");
}

export async function fetchTicketAttachments(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/attachments`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse(res, "Erreur lors du chargement des pièces jointes");
  return data.items;
}

export function ticketAttachmentDownloadUrl(ticketId, attachmentId) {
  return `${API_BASE}/tickets/${ticketId}/attachments/${attachmentId}/download`;
}

export async function fetchAttachmentBlobUrl(ticketId, attachmentId) {
  const res = await fetch(ticketAttachmentDownloadUrl(ticketId, attachmentId), {
    headers: getAuthHeaderOnly(),
  });
  if (!res.ok) throw new Error("Erreur lors du chargement de l'image");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function downloadTicketAttachment(ticketId, attachmentId, filename) {
  const res = await fetch(ticketAttachmentDownloadUrl(ticketId, attachmentId), {
    headers: getAuthHeaderOnly(),
  });
  if (!res.ok) throw new Error("Erreur lors du téléchargement");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "piece-jointe";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchTicketDetail(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors du chargement du ticket");
}

export async function updateTicketStatus(ticketId, status) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });

  return handleResponse(res, "Erreur lors de la mise à jour du statut");
}

export async function updateTicketPriority(ticketId, priority_label) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/priority`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ priority_label }),
  });

  return handleResponse(res, "Erreur lors de la mise à jour de la priorité");
}

export async function assignTicketAgent(ticketId, assignee_user_id) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/assign`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ assignee_user_id }),
  });

  return handleResponse(res, "Erreur lors de l'affectation du ticket");
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users/`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors du chargement des utilisateurs");
}

export async function fetchTicketAudit(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/audit`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors du chargement de l'historique du ticket");
}

export async function fetchTicketMessages(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/messages`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors du chargement des messages");
}

export async function createTicketMessage(ticketId, payload) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Erreur lors de l'ajout du message");
}

export async function syncTicketsNow() {
  const res = await fetch(`${API_BASE}/tickets/sync-now`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors de la synchronisation des tickets");
}

export async function fetchSyncLogs() {
  const res = await fetch(`${API_BASE}/tickets/sync-logs`, {
    headers: getAuthHeaders(),
  });

  return handleResponse(res, "Erreur lors du chargement des logs de synchronisation");
}

export async function fetchSystemLogs() {
  const res = await fetch(`${API_BASE}/tickets/system-logs`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur lors du chargement des logs système");
}


export async function fetchTicketStats() {
  const res = await fetch(`${API_BASE}/tickets/stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur lors du chargement des stats");
}

export async function fetchReports({ dateFrom = "", dateTo = "" } = {}) {
  const params = new URLSearchParams();
  if (dateFrom) params.append("date_from", dateFrom);
  if (dateTo)   params.append("date_to", dateTo);

  const res = await fetch(`${API_BASE}/tickets/reports?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur lors du chargement des rapports");
}


export async function fetchMyTickets({ q = "", status = "", skip = 0, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (q)      params.append("q", q);
  if (status) params.append("status", status);
  params.append("skip", String(skip));
  params.append("limit", String(limit));

  const res = await fetch(`${API_BASE}/tickets/my-tickets?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement tickets");
}

export async function fetchMyStats() {
  const res = await fetch(`${API_BASE}/tickets/my-stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement stats");
}

export async function fetchSupervisorStats() {
  const res = await fetch(`${API_BASE}/tickets/supervisor-stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement stats superviseur");
}

export async function fetchMyRequests({ q = "", status = "", skip = 0, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (q)      params.append("q", q);
  if (status) params.append("status", status);
  params.append("skip", String(skip));
  params.append("limit", String(limit));

  const res = await fetch(`${API_BASE}/tickets/my-requests?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement tickets");
}

export async function createTicket(payload) {
  const res = await fetch(`${API_BASE}/tickets/create`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "Erreur création ticket");
}

export async function fetchAdvancedStats() {
  const res = await fetch(`${API_BASE}/tickets/advanced-stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur stats avancées");
}

export async function deleteTicket(ticketId) {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur lors de la suppression du ticket");
}

export async function fetchAIResult(ticketId) {
  const res = await fetch(`${API_BASE}/ai/tickets/${ticketId}/result`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement résultat IA");
}

export async function fetchSimilarTickets(ticketId, n = 5) {
  const res = await fetch(`${API_BASE}/ai/tickets/${ticketId}/similar?n=${n}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement tickets similaires");
}

export async function fetchAIStats() {
  const res = await fetch(`${API_BASE}/ai/stats`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement stats IA");
}

export async function fetchAIConfidenceHistory() {
  const res = await fetch(`${API_BASE}/ai/confidence-history`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement historique de confiance IA");
}

export async function fetchAnomalousTickets() {
  const res = await fetch(`${API_BASE}/ai/anomalies`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse(res, "Erreur chargement des tickets atypiques");
  return data.items;
}

export async function fetchTicketClusters() {
  const res = await fetch(`${API_BASE}/ai/clusters`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse(res, "Erreur chargement des clusters");
  return data.clusters;
}

export async function fetchVolumeForecast() {
  const res = await fetch(`${API_BASE}/ai/forecast`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur chargement de la prévision de volume");
}

export async function routeTicketByAI(ticketId) {
  const res = await fetch(`${API_BASE}/ai/route/${ticketId}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(res, "Erreur routage IA");
}