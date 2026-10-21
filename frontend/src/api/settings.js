import { API_BASE } from './config.js';

function getAuthHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings/`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || "Erreur chargement settings");
  return data;
}

export async function fetchRoutingInfo() {
  const res = await fetch(`${API_BASE}/settings/routing-info`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || "Erreur chargement routage");
  return data;
}

export async function updateSettings(payload) {
  const res = await fetch(`${API_BASE}/settings/`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || "Erreur mise à jour settings");
  return data;
}   