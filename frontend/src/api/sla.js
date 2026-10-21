import { API_BASE } from './config.js';

function getAuthHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function handle(res, msg) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || msg);
  return data;
}

export async function fetchSLAPolicies() {
  const res = await fetch(`${API_BASE}/sla/policies`, { headers: getAuthHeaders() });
  return handle(res, "Erreur chargement politiques SLA");
}

export async function createSLAPolicy(payload) {
  const res = await fetch(`${API_BASE}/sla/policies`, {
    method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload),
  });
  return handle(res, "Erreur création politique SLA");
}

export async function fetchSLAStatsByCategory() {
  const res = await fetch(`${API_BASE}/sla/stats/by-category`, { headers: getAuthHeaders() });
  return handle(res, "Erreur stats SLA par catégorie");
}

export async function updateSLAPolicy(id, payload) {
  const res = await fetch(`${API_BASE}/sla/policies/${id}`, {
    method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(payload),
  });
  return handle(res, "Erreur mise à jour SLA");
}

export async function fetchSLAStats() {
  const res = await fetch(`${API_BASE}/sla/stats`, { headers: getAuthHeaders() });
  return handle(res, "Erreur stats SLA");
}

export async function fetchBreachedTickets() {
  const res = await fetch(`${API_BASE}/sla/breached`, { headers: getAuthHeaders() });
  return handle(res, "Erreur tickets breachés");
}

export async function fetchAtRiskTickets() {
  const res = await fetch(`${API_BASE}/sla/at-risk`, { headers: getAuthHeaders() });
  return handle(res, "Erreur tickets à risque");
}
