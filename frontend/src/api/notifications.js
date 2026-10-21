import { API_BASE } from './config.js';

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

async function handle(res, msg) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || msg);
  return data;
}

export async function fetchNotifications() {
  const res = await fetch(`${API_BASE}/notifications/`, { headers: getAuthHeaders() });
  return handle(res, "Erreur notifications");
}

export async function fetchUnreadCount() {
  const res = await fetch(`${API_BASE}/notifications/unread-count`, { headers: getAuthHeaders() });
  return handle(res, "Erreur compteur");
}

export async function markAsRead(id) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "PUT", headers: getAuthHeaders(),
  });
  return handle(res, "Erreur mark read");
}

export async function markAllRead() {
  const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
    method: "PUT", headers: getAuthHeaders(),
  });
  return handle(res, "Erreur mark all read");
}