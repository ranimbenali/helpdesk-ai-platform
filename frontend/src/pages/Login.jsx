import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import { login, getMe } from "../api/auth";

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const IconKey = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
  </svg>
);
const IconHash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);
const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

import { API_BASE } from '../api/config.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();

  const [tab, setTab]           = useState("password");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const [otpEmail, setOtpEmail]     = useState("");
  const [otpCode, setOtpCode]       = useState("");
  const [otpSent, setOtpSent]       = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMsg, setOtpMsg]         = useState("");
  const [otpError, setOtpError]     = useState("");

  const [showForgot, setShowForgot]       = useState(false);
  const [forgotEmail, setForgotEmail]     = useState("");
  const [forgotMsg, setForgotMsg]         = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  function redirectByRole(user) {
    if (user.role === "ADMIN")           navigate("/admin",      { replace: true });
    else if (user.role === "AGENT")      navigate("/agent",      { replace: true });
    else if (user.role === "SUPERVISOR") navigate("/supervisor", { replace: true });
    else if (user.role === "REQUESTER")  navigate("/requester",  { replace: true });
    else throw new Error("Rôle inconnu");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data  = await login(email, password, rememberMe);
      const token = data.access_token;
      if (!token) throw new Error("Token non reçu");
      const user = await getMe(token);
      if (rememberMe) {
        localStorage.setItem("token", token);
        localStorage.setItem("user",  JSON.stringify(user));
        localStorage.setItem("rememberMe", "true");
        sessionStorage.removeItem("token"); sessionStorage.removeItem("user");
      } else {
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("user",  JSON.stringify(user));
        localStorage.removeItem("token"); localStorage.removeItem("user");
        localStorage.setItem("rememberMe", "false");
      }
      onLogin(token, user);
      redirectByRole(user);
    } catch (err) {
      setError(err.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOTP(e) {
    e.preventDefault();
    if (!otpEmail.trim()) return;
    try {
      setOtpLoading(true); setOtpError(""); setOtpMsg("");
      const res = await fetch(
        `${API_BASE}/auth/request-otp?email=${encodeURIComponent(otpEmail.trim())}`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Erreur envoi OTP");
      setOtpSent(true);
      setOtpMsg("Code envoyé ! Vérifiez votre email.");
    } catch (err) { setOtpError(err.message); }
    finally { setOtpLoading(false); }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (!otpCode.trim()) return;
    try {
      setOtpLoading(true); setOtpError("");
      const res = await fetch(
        `${API_BASE}/auth/verify-otp?email=${encodeURIComponent(otpEmail.trim())}&code=${otpCode.trim()}`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Code invalide");
      const token = data.access_token; const user = data.user;
      sessionStorage.setItem("token", token); sessionStorage.setItem("user", JSON.stringify(user));
      localStorage.removeItem("token"); localStorage.removeItem("user");
      localStorage.setItem("rememberMe", "false");
      onLogin(token, user); redirectByRole(user);
    } catch (err) { setOtpError(err.message); }
    finally { setOtpLoading(false); }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    try {
      setForgotLoading(true); setForgotMsg("");
      const res = await fetch(
        `${API_BASE}/auth/forgot-password?email=${encodeURIComponent(forgotEmail)}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      setForgotMsg(data.message || "Email envoyé !");
    } catch { setForgotMsg("Erreur lors de l'envoi."); }
    finally { setForgotLoading(false); }
  }

  function switchTab(id) {
    setTab(id); setError(""); setOtpError("");
    setOtpSent(false); setOtpCode(""); setOtpMsg("");
  }

  return (
    <div className="lp-wrap">
      <div className="lp-stage">

      {/* ── Barre du haut ── */}
      <div className="lp-topbar">
        <div className="lp-topbar-logo">
          <img src="/logo-geiser-login.png" alt="Geiser" />
        </div>
      </div>

      {/* ── Corps ── */}
      <div className="lp-body">

        {/* Texte héro gauche */}
        <div className="lp-hero">
          <p className="lp-hero-eyebrow">
            — Geiser <span>·</span> Plateforme Helpdesk
          </p>
          <h1 className="lp-hero-title">
            Chaque ticket,<br />
            <em>une promesse</em><br />
            tenue.
          </h1>
          <p className="lp-hero-sub">
            La plateforme intelligente qui transforme votre support en avantage compétitif.
          </p>
          <div className="lp-social">
            <div className="lp-avatars">
              <div className="lp-avatar" style={{ background: "linear-gradient(135deg,#f472b6,#a78bfa)" }} />
              <div className="lp-avatar" style={{ background: "linear-gradient(135deg,#60a5fa,#34d399)" }} />
              <div className="lp-avatar" style={{ background: "linear-gradient(135deg,#fbbf24,#f87171)" }} />
              <div className="lp-avatar" style={{ background: "linear-gradient(135deg,#818cf8,#6ee7b7)" }} />
            </div>
            <p className="lp-social-text">
              <strong>+100 utilisateurs</strong> utilisent<br />Geiser Helpdesk IA.
            </p>
          </div>
        </div>

        {/* ── Carte connexion ── */}
        <div className="lp-card">
          <h2 className="lp-card-title">Connexion agent</h2>
          <p className="lp-card-sub">Connectez-vous pour accéder à votre espace de support.</p>

          {/* Onglets */}
          <div className="lp-tabs">
            <button type="button" className={`lp-tab${tab === "password" ? " active" : ""}`} onClick={() => switchTab("password")}>
              <IconKey /> Mot de passe
            </button>
            <button type="button" className={`lp-tab${tab === "otp" ? " active" : ""}`} onClick={() => switchTab("otp")}>
              <IconMail /> Code email
            </button>
          </div>

          {/* ── Zone formulaire hauteur fixe ── */}
          <div className="lp-form-area">

          {/* ── Tab mot de passe ── */}
          {tab === "password" && (
            <form className="lp-form" onSubmit={handleSubmit}>
              <div className="lp-field-wrap">
                <label>Email</label>
                <div className="lp-field">
                  <span className="lp-field__icon"><IconMail /></span>
                  <span className="lp-field__divider" />
                  <input
                    type="email"
                    placeholder="vous@entreprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required autoComplete="email"
                  />
                </div>
              </div>

              <div className="lp-field-wrap lp-field-pw">
                <label>Mot de passe</label>
                <div className="lp-field">
                  <span className="lp-field__icon"><IconLock /></span>
                  <span className="lp-field__divider" />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required autoComplete="current-password"
                    style={{ paddingRight: "40px" }}
                  />
                  <button type="button" className="lp-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                    {showPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              <div className="lp-row">
                <label className="lp-check">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>Se souvenir de moi</span>
                </label>
                <button type="button" className="lp-link"
                  onClick={() => { setShowForgot(true); setForgotMsg(""); setForgotEmail(""); }}>
                  Besoin d'aide ?
                </button>
              </div>

              {error && <div className="lp-error">{error}</div>}

              <button className="lp-btn" disabled={loading}>
                {loading ? "Connexion en cours..." : "Accéder à la plateforme →"}
              </button>

              <div className="lp-security">
                <span className="lp-security-icon"><IconShield /></span>
                <span>Connexion chiffrée. Vos identifiants ne sont jamais partagés avec des tiers.</span>
              </div>
            </form>
          )}

          {/* ── Tab OTP ── */}
          {tab === "otp" && (
            <form className="lp-form" onSubmit={otpSent ? handleVerifyOTP : handleRequestOTP}>

              {/* Champ email — masqué après envoi */}
              {!otpSent && (
                <div className="lp-field-wrap">
                  <label>Email</label>
                  <div className="lp-field">
                    <span className="lp-field__icon"><IconMail /></span>
                    <span className="lp-field__divider" />
                    <input
                      type="email" placeholder="vous@entreprise.com"
                      value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Après envoi : notification + champ code */}
              {otpSent && (
                <>
                  {otpMsg && <div className="lp-success">{otpMsg}</div>}
                  <div className="lp-field-wrap">
                    <label>Code à 6 chiffres</label>
                    <div className="lp-field">
                      <span className="lp-field__icon"><IconHash /></span>
                      <span className="lp-field__divider" />
                      <input
                        type="text" placeholder="------"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6} required className="lp-otp-input"
                        autoFocus
                      />
                    </div>
                  </div>
                </>
              )}

              {otpError && <div className="lp-error">{otpError}</div>}

              <button className="lp-btn" disabled={otpLoading}>
                {otpLoading
                  ? (otpSent ? "Vérification..." : "Envoi...")
                  : (otpSent ? "Vérifier et se connecter →" : "Envoyer le code →")}
              </button>

              {otpSent && (
                <p className="lp-resend">
                  Pas reçu ?{" "}
                  <button type="button" onClick={() => { setOtpSent(false); setOtpCode(""); setOtpMsg(""); setOtpError(""); }}>
                    Renvoyer
                  </button>
                </p>
              )}

              <div className="lp-security">
                <span className="lp-security-icon"><IconShield /></span>
                <span>Connexion chiffrée. Vos identifiants ne sont jamais partagés avec des tiers.</span>
              </div>
            </form>
          )}

          </div>{/* fin lp-form-area */}
        </div>
      </div>

      {/* ── Modal Mot de passe oublié ── */}
      {showForgot && (
        <div className="lp-modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔐 Mot de passe oublié</h3>
            <p>Entrez votre email pour recevoir un lien de réinitialisation.</p>
            {forgotMsg ? (
              <div className="lp-success"><span>✅</span> {forgotMsg}</div>
            ) : (
              <form onSubmit={handleForgotPassword} className="lp-form">
                <div className="lp-field-wrap">
                  <label>Email</label>
                  <div className="lp-field">
                    <span className="lp-field__icon"><IconMail /></span>
                    <span className="lp-field__divider" />
                    <input type="email" placeholder="vous@entreprise.com"
                      value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
                  </div>
                </div>
                <button className="lp-btn" disabled={forgotLoading}>
                  {forgotLoading ? "Envoi..." : "Envoyer le lien →"}
                </button>
              </form>
            )}
            <p className="lp-resend" style={{ marginTop: "16px" }}>
              <button type="button" onClick={() => { setShowForgot(false); setForgotMsg(""); setForgotEmail(""); }}>
                ← Retour au login
              </button>
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
