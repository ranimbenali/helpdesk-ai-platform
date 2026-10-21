import { API_BASE } from './config.js';

function getAuthHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchUsers(q = "", skip = 0, limit = 50) {
  const params = new URLSearchParams({
    q,
    skip: String(skip),
    limit: String(limit),
  });

  const res = await fetch(`${API_BASE}/users/?${params.toString()}`, {
    headers: getAuthHeaders(),
  });

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors du chargement des utilisateurs");
  }

  return data;
}

export async function createUser(payload) {
  const res = await fetch(`${API_BASE}/users/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors de la création");
  }

  return data;
}

export async function updateUser(userId, payload) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors de la modification");
  }

  return data;
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors de la suppression");
  }

  return data;
}

export async function fetchMyProfile() {
  const res = await fetch(`${API_BASE}/users/me/profile`, {
    headers: getAuthHeaders(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur chargement profil");
  }

  return data;
}

export async function updatePassword(userId, payload) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors du changement de mot de passe");
  }

  return data;
}

export async function updateMyProfile(payload) {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors de la mise à jour du profil");
  }

  return data;
}

export async function uploadMyAvatar(userId, file) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors de l'envoi de la photo");
  }

  return data;
}

export async function changeMyPassword(currentPassword, newPassword) {
  const res = await fetch(`${API_BASE}/users/me/change-password`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Erreur lors du changement de mot de passe");
  }

  return data;
}