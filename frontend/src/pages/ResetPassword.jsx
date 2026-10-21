import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "../styles/Login.css";
import { API_BASE } from '../api/config.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get("token");

  const [step, setStep]               = useState("validating");
  const [email, setEmail]             = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm]         = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  useEffect(() => {
    if (!token) { setStep("error"); return; }

    fetch(`${API_BASE}/auth/reset-password/validate?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) { setEmail(data.email); setStep("form"); }
        else setStep("error");
      })
      .catch(() => setStep("error"));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (newPassword.length < 6)  { setError("Au moins 6 caractères requis."); return; }

    try {
      setLoading(true); setError("");
      const res = await fetch(
        `${API_BASE}/auth/reset-password?token=${token}&new_password=${encodeURIComponent(newPassword)}`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Erreur");
      setStep("success");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp-wrap">
      <div className="lp-stage">
        <div className="lp-card">

          {step === "validating" && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p style={{ color: "#64748b" }}>Validation du lien...</p>
            </div>
          )}

          {step === "error" && (
            <>
              <h2 className="lp-title">❌ Lien invalide</h2>
              <div className="lp-title-underline" />
              <p style={{ color: "#e53935", textAlign: "center", margin: "16px 0" }}>
                Ce lien est invalide ou a expiré.
              </p>
              <button className="lp-btn" onClick={() => navigate("/login")}>
                <span>↩ Retour au login</span>
              </button>
            </>
          )}

          {step === "form" && (
            <>
              <h2 className="lp-title">🔐 Nouveau mot de passe</h2>
              <div className="lp-title-underline" />
              <p style={{ color: "#64748b", fontSize: "13px",
                textAlign: "center", margin: "12px 0 20px" }}>
                Compte : <strong>{email}</strong>
              </p>

              <form className="lp-form" onSubmit={handleSubmit}>
                <div className="lp-field">
                  <span className="lp-field__icon">🔑</span>
                  <span className="lp-field__divider" />
                  <input
                    type="password"
                    placeholder="Nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="lp-field">
                  <span className="lp-field__icon">🔑</span>
                  <span className="lp-field__divider" />
                  <input
                    type="password"
                    placeholder="Confirmer le mot de passe"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {/* Indicateurs */}
                <div style={{ fontSize: "12px", marginBottom: "12px" }}>
                  <div style={{ color: newPassword.length >= 6 ? "#22c55e" : "#94a3b8" }}>
                    {newPassword.length >= 6 ? "✅" : "○"} Au moins 6 caractères
                  </div>
                  <div style={{
                    color: newPassword && newPassword === confirm ? "#22c55e" : "#94a3b8"
                  }}>
                    {newPassword && newPassword === confirm ? "✅" : "○"} Les mots de passe correspondent
                  </div>
                </div>

                {error && <div className="lp-error">{error}</div>}

                <button className="lp-btn" disabled={loading}>
                  <span className="lp-btn__icon">🔐</span>
                  <span>{loading ? "RÉINITIALISATION..." : "CONFIRMER"}</span>
                </button>
              </form>
            </>
          )}

          {step === "success" && (
            <>
              <h2 className="lp-title">✅ Mot de passe modifié !</h2>
              <div className="lp-title-underline" />
              <p style={{ color: "#22c55e", textAlign: "center", margin: "16px 0" }}>
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <button className="lp-btn" onClick={() => navigate("/login")}>
                <span>🔐 Se connecter</span>
              </button>
            </>
          )}

        </div>

        <div className="lp-panel">
          <div className="lp-panel__inner">
            <h3>HELPDESK IA</h3>
            <p>Geiser — Réinitialisation de mot de passe</p>
          </div>
          <div className="lp-panel__wave" />
        </div>
      </div>
    </div>
  );
}