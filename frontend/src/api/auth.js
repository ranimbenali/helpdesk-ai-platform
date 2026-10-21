import { API_BASE } from './config.js';

export async function login(email, password, rememberMe = false) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);
  body.append("remember_me", rememberMe ? "true" : "false");

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Login failed");
  }

  return data;
}

export async function getMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.detail || "Unauthorized");
  }

  return data;
}


export async function requestOTP(email) {
  const res = await fetch(`${API_BASE}/auth/request-otp?email=${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || "Erreur envoi OTP");
  return data;
}

export async function verifyOTP(email, code) {
  const res = await fetch(
    `${API_BASE}/auth/verify-otp?email=${encodeURIComponent(email)}&code=${code}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || "Code invalide");
  return data;
}