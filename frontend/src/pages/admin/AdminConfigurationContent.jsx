import { useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "../../api/settings";

export default function AdminSettingsContent() {
  const [form, setForm] = useState({
    app_name: "",
    app_language: "fr",
    geiser_base_url: "",
    geiser_token: "",
    ai_enabled: true,
    ai_confidence_threshold: 0.7,
    ai_auto_assign: false,
  });

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((data) => setForm({
        app_name:                 data.app_name,
        app_language:             data.app_language,
        geiser_base_url:          data.geiser_base_url || "",
        geiser_token:             data.geiser_token || "",
        ai_enabled:               data.ai_enabled,
        ai_confidence_threshold:  data.ai_confidence_threshold,
        ai_auto_assign:           data.ai_auto_assign,
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updateSettings({
        ...form,
        ai_confidence_threshold: parseFloat(form.ai_confidence_threshold),
      });
      setSuccess("Paramètres sauvegardés avec succès !");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="adm-body"><p>Chargement...</p></div>;

  return (
    <div className="adm-body">
      {error   && <p className="users-error">{error}</p>}
      {success && <p className="users-success">{success}</p>}

      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

          {/* ── Paramètres généraux ── */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: "20px" }}>
              <h3 className="card-title">⚙️ Paramètres généraux</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="section-title" style={{ display: "block", marginBottom: "6px" }}>
                  Nom de l'application
                </label>
                <input
                  name="app_name" className="users-input"
                  value={form.app_name} onChange={handleChange}
                  placeholder="Helpdesk IA"
                />
              </div>

              <div>
                <label className="section-title" style={{ display: "block", marginBottom: "6px" }}>
                  Langue
                </label>
                <select name="app_language" className="users-input"
                  value={form.app_language} onChange={handleChange}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Configuration Geiser ── */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: "20px" }}>
              <h3 className="card-title">🔗 Synchronisation Geiser</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="section-title" style={{ display: "block", marginBottom: "6px" }}>
                  URL du helpdesk Geiser
                </label>
                <input
                  name="geiser_base_url" className="users-input"
                  value={form.geiser_base_url} onChange={handleChange}
                  placeholder="https://your-servicedesk.example.com"
                />
              </div>

              <div>
                <label className="section-title" style={{ display: "block", marginBottom: "6px" }}>
                  Token API
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    name="geiser_token"
                    className="users-input"
                    type={showToken ? "text" : "password"}
                    value={form.geiser_token}
                    onChange={handleChange}
                    placeholder="••••••••••••••••"
                    style={{ paddingRight: "48px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    style={{
                      position: "absolute", right: "12px", top: "50%",
                      transform: "translateY(-50%)",
                      background: "none", border: "none",
                      cursor: "pointer", fontSize: "16px",
                    }}
                  >
                    {showToken ? "🙈" : "👁️"}
                  </button>
                </div>
                <p style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  Le token est chiffré et ne sera pas affiché en clair.
                </p>
              </div>
            </div>
          </div>

          {/* ── Configuration IA ── */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-head" style={{ marginBottom: "20px" }}>
              <h3 className="card-title">🤖 Configuration IA</h3>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>

              {/* IA activée */}
              <div style={{
                padding: "20px", background: "#f8f9fa",
                borderRadius: "14px", border: "1px solid #e8ecff",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "12px", color: "#334155" }}>
                  Triage IA
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <div style={{
                    position: "relative", width: "44px", height: "24px",
                    background: form.ai_enabled ? "#0a46d6" : "#cbd5e1",
                    borderRadius: "12px", transition: "background 0.2s", flexShrink: 0,
                  }}>
                    <input
                      type="checkbox" name="ai_enabled"
                      checked={form.ai_enabled} onChange={handleChange}
                      style={{ opacity: 0, position: "absolute", width: "100%", height: "100%", cursor: "pointer", margin: 0 }}
                    />
                    <div style={{
                      position: "absolute", top: "3px",
                      left: form.ai_enabled ? "23px" : "3px",
                      width: "18px", height: "18px",
                      background: "#fff", borderRadius: "50%",
                      transition: "left 0.2s", pointerEvents: "none",
                    }} />
                  </div>
                  <span style={{ fontSize: "13px", color: "#334155" }}>
                    {form.ai_enabled ? "Activé" : "Désactivé"}
                  </span>
                </label>
                <p style={{ fontSize: "11px", color: "#888", marginTop: "8px" }}>
                  Classification automatique des tickets par l'IA.
                </p>
              </div>

              {/* Seuil de confiance */}
              <div style={{
                padding: "20px", background: "#f8f9fa",
                borderRadius: "14px", border: "1px solid #e8ecff",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "12px", color: "#334155" }}>
                  Seuil de confiance
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <input
                    type="range" name="ai_confidence_threshold"
                    min="0" max="1" step="0.05"
                    value={form.ai_confidence_threshold}
                    onChange={handleChange}
                    style={{ flex: 1, accentColor: "#0a46d6" }}
                  />
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#0a46d6", minWidth: "40px" }}>
                    {Math.round(form.ai_confidence_threshold * 100)}%
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: "#888" }}>
                  Score minimum pour valider une classification IA.
                </p>
              </div>

              {/* Auto-assign */}
              <div style={{
                padding: "20px", background: "#f8f9fa",
                borderRadius: "14px", border: "1px solid #e8ecff",
              }}>
                <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "12px", color: "#334155" }}>
                  Auto-assignation
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <div style={{
                    position: "relative", width: "44px", height: "24px",
                    background: form.ai_auto_assign ? "#0a46d6" : "#cbd5e1",
                    borderRadius: "12px", transition: "background 0.2s", flexShrink: 0,
                  }}>
                    <input
                      type="checkbox" name="ai_auto_assign"
                      checked={form.ai_auto_assign} onChange={handleChange}
                      style={{ opacity: 0, position: "absolute", width: "100%", height: "100%", cursor: "pointer", margin: 0 }}
                    />
                    <div style={{
                      position: "absolute", top: "3px",
                      left: form.ai_auto_assign ? "23px" : "3px",
                      width: "18px", height: "18px",
                      background: "#fff", borderRadius: "50%",
                      transition: "left 0.2s", pointerEvents: "none",
                    }} />
                  </div>
                  <span style={{ fontSize: "13px", color: "#334155" }}>
                    {form.ai_auto_assign ? "Activée" : "Désactivée"}
                  </span>
                </label>
                <p style={{ fontSize: "11px", color: "#888", marginTop: "8px" }}>
                  Assigner automatiquement si confiance ≥ seuil.
                </p>
              </div>
            </div>
          </div>

          {/* ── Catégories ── */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card-head" style={{ marginBottom: "16px" }}>
              <h3 className="card-title">🏷️ Catégories et tags</h3>
              <span style={{ fontSize: "12px", color: "#888" }}>
                Gestion depuis la section Users (à venir)
              </span>
            </div>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "10px", padding: "16px",
              background: "#f8f9fa", borderRadius: "12px",
            }}>
              {["Réseau", "Matériel", "Logiciel", "Accès", "Impression", "Email", "Téléphonie", "Autre"].map((cat) => (
                <span key={cat} style={{
                  padding: "6px 14px", borderRadius: "20px",
                  background: "#edf2ff", color: "#0a46d6",
                  fontSize: "12px", fontWeight: "600",
                  border: "1px solid #c7d7ff",
                }}>
                  {cat}
                </span>
              ))}
              <span style={{
                padding: "6px 14px", borderRadius: "20px",
                background: "#f1f0ff", color: "#6c63ff",
                fontSize: "12px", fontWeight: "600",
                border: "1px dashed #c7c2ff", cursor: "pointer",
              }}>
                + Ajouter
              </span>
            </div>
          </div>

        </div>

        {/* ── Bouton save ── */}
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button type="button" className="users-btn users-btn-soft"
            onClick={() => window.location.reload()}>
            Annuler
          </button>
          <button type="submit" className="users-btn users-btn-primary" disabled={saving}>
            {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
          </button>
        </div>
      </form>
    </div>
  );
}