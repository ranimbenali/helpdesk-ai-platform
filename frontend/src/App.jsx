import { useState } from "react"; // v2
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AgentDashboard from "./pages/agent/AgentDashboard";
import RequesterDashboard from "./pages/requester/RequesterDashboard";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import ResetPassword from "./pages/ResetPassword";

function getStoredUser() {
  // ✅ Remember me coché → localStorage, sinon → sessionStorage
  const rememberMe = localStorage.getItem("rememberMe");

  if (rememberMe === "true") {
    const token   = localStorage.getItem("token");
    const userRaw = localStorage.getItem("user");
    if (!token || !userRaw) return { token: null, user: null };
    try {
      return { token, user: JSON.parse(userRaw) };
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return { token: null, user: null };
    }
  } else {
    // Pas de remember me → sessionStorage (expire à la fermeture du navigateur)
    const token   = sessionStorage.getItem("token");
    const userRaw = sessionStorage.getItem("user");
    if (!token || !userRaw) return { token: null, user: null };
    try {
      return { token, user: JSON.parse(userRaw) };
    } catch {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      return { token: null, user: null };
    }
  }
}

function ProtectedRoute({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const stored = getStoredUser();
  const [token, setToken] = useState(stored.token);
  const [user, setUser]   = useState(stored.user);

  function handleLogin(token, user) {
    setToken(token);
    setUser(user);
  }

  function handleLogout() {
    // ✅ Nettoyer les deux storages
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("rememberMe");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  // ✅ Met à jour le user (partiel) dans le state ET le bon storage
  function handleUserUpdate(patch) {
    const updatedUser = { ...user, ...patch };
    setUser(updatedUser);
    const rememberMe = localStorage.getItem("rememberMe");
    if (rememberMe === "true") {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } else {
      sessionStorage.setItem("user", JSON.stringify(updatedUser));
    }
  }
  function handleAvatarUpdate(avatarUrl) { handleUserUpdate({ avatar_url: avatarUrl }); }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />

        <Route path="/admin" element={
          <ProtectedRoute token={token}>
            <AdminDashboard user={user} onLogout={handleLogout} onAvatarUpdate={handleAvatarUpdate} />
          </ProtectedRoute>
        } />

        <Route path="/agent" element={
          <ProtectedRoute token={token}>
            <AgentDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
          </ProtectedRoute>
        } />

        <Route path="/requester" element={
          <ProtectedRoute token={token}>
            <RequesterDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
          </ProtectedRoute>
        } />

        <Route path="/supervisor" element={
          <ProtectedRoute token={token}>
            <SupervisorDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    </BrowserRouter>
  );
}