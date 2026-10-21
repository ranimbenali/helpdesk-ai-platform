import { useEffect, useState, useCallback } from "react";
import { API_BASE as API } from '../../api/config.js';

function getHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const PRIORITY_LABELS = {
  P1_URGENT: "Urgente", P2_HIGH: "Haute", P3_NORMAL: "Normale", P4_LOW: "Faible",
};

const STATUS_COLORS = {
  PENDING:   { bg: "#fefce8", color: "#ca8a04",  label: "En attente" },
  VALIDATED: { bg: "#f0fdf4", color: "#16a34a",  label: "Validée" },
  REJECTED:  { bg: "#fef2f2", color: "#dc2626",  label: "Rejetée" },
  CORRECTED: { bg: "#eff6ff", color: "#2563eb",  label: "Corrigée" },
};

function ConfidenceBars({ clf }) {
  const conf = Math.round((clf?.confidence || 0) * 100);
  const isML = clf?.model_version?.startsWith("ML");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
      {clf?.ml_confidence != null && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 3 }}>
            <span>Confiance ML</span>
            <span style={{ fontWeight: 600, color: isML ? "#2563eb" : "#94a3b8" }}>
              {Math.round(clf.ml_confidence * 100)}%
              {!isML && " (sous seuil → LLM utilisé)"}
            </span>
          </div>
          <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${Math.round(clf.ml_confidence * 100)}%`,
              background: isML ? "#2563eb" : "#cbd5e1", borderRadius: 3 }} />
          </div>
        </div>
      )}
      {!isML && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 3 }}>
            <span>Confiance LLM <span style={{ fontSize: 10, color: "#94a3b8" }}>(auto-estimée)</span></span>
            <span style={{ fontWeight: 600, color: "#7c3aed" }}>{conf}%</span>
          </div>
          <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${conf}%`, background: "#7c3aed", borderRadius: 3 }} />
          </div>
        </div>
      )}
      {isML && clf?.ml_confidence == null && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 3 }}>
            <span>Confiance ML</span><span style={{ fontWeight: 600, color: "#2563eb" }}>{conf}%</span>
          </div>
          <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${conf}%`, background: "#2563eb", borderRadius: 3 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentIASuggestions() {
  const [activeTab,   setActiveTab]   = useState("pending");
  const [pending,     setPending]     = useState([]);
  const [validated,   setValidated]   = useState([]);
  const [rejected,    setRejected]    = useState([]);
  const [aiData,      setAiData]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [correcting,  setCorrecting]  = useState(null);
  const [correction,  setCorrection]  = useState({});
  const [minConf,     setMinConf]     = useState(0);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/ai/pending`, { headers: getHeaders() }).then(r => r.json());
      const list = Array.isArray(data) ? data : [];
      setPending(list);
      const map = {};
      list.forEach(t => {
        map[t.ticket_id] = {
          ai_processed: true,
          classification: t.classification,
          auto_reply: t.auto_reply ? { generated_text: t.auto_reply } : null,
        };
      });
      setAiData(prev => ({ ...prev, ...map }));
    } finally { setLoading(false); }
  }, []);

  const loadValidated = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/ai/classified?status=VALIDATED,CORRECTED`, { headers: getHeaders() }).then(r => r.json());
      const list = Array.isArray(data) ? data : [];
      setValidated(list);
      const map = {};
      list.forEach(t => { map[t.ticket_id] = { ai_processed: true, classification: t.classification }; });
      setAiData(prev => ({ ...prev, ...map }));
    } finally { setLoading(false); }
  }, []);

  const loadRejected = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API}/ai/classified?status=REJECTED`, { headers: getHeaders() }).then(r => r.json());
      const list = Array.isArray(data) ? data : [];
      setRejected(list);
      const map = {};
      list.forEach(t => { map[t.ticket_id] = { ai_processed: true, classification: t.classification }; });
      setAiData(prev => ({ ...prev, ...map }));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "pending")    loadPending();
    if (activeTab === "validated")  loadValidated();
    if (activeTab === "rejected")   loadRejected();
    setSelected(null);
    setCorrecting(null);
  }, [activeTab]);

  const handleValidate = async (ticketId, status, correctedData = {}) => {
    const payload = { validation_status: status, ...correctedData };
    await fetch(`${API}/ai/tickets/${ticketId}/validate`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify(payload),
    });
    // Retirer du pending et recharger le bon onglet
    setPending(prev => prev.filter(t => t.ticket_id !== ticketId));
    setCorrecting(null);
    setSelected(null);
  };

  const currentList = activeTab === "pending" ? pending : activeTab === "validated" ? validated : rejected;

  const withAI = currentList.filter(t => {
    const clf = aiData[t.ticket_id]?.classification;
    return clf && (clf.confidence || 0) >= minConf / 100;
  });

  const mlCount  = withAI.filter(t => aiData[t.ticket_id]?.classification?.model_version?.startsWith("ML")).length;
  const llmCount = withAI.length - mlCount;
  const modelLabel = mlCount > 0 && llmCount > 0 ? "ML (TF-IDF) + LLM (LLaMA 3)"
    : mlCount > 0 ? "ML — TF-IDF + LinearSVC"
    : llmCount > 0 ? "LLM — Groq / LLaMA 3"
    : "ML + LLM";

  const TABS = [
    { key: "pending",   label: "En attente",  count: pending.length,   color: "#f59e0b" },
    { key: "validated", label: "Validées",    count: validated.length, color: "#16a34a" },
    { key: "rejected",  label: "Rejetées",    count: rejected.length,  color: "#dc2626" },
  ];

  return (
    <div className="adm-body">

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            ⚡ Suggestions IA
          </h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
            Classifications automatiques — {modelLabel}
          </p>
        </div>
        {activeTab === "pending" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Confiance min.</span>
            <select value={minConf} onChange={e => setMinConf(+e.target.value)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px", fontSize: 13 }}>
              {[0, 30, 50, 70, 90].map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid #f1f5f9", paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 18px", border: "none", borderRadius: "8px 8px 0 0",
              background: activeTab === tab.key ? "#fff" : "transparent",
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : "2px solid transparent",
              marginBottom: -2,
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: 13,
              color: activeTab === tab.key ? tab.color : "#64748b",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 7,
            }}>
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 7px",
                background: activeTab === tab.key ? tab.color : "#e2e8f0",
                color: activeTab === tab.key ? "#fff" : "#64748b",
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Chargement...</div>
      ) : withAI.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #f0f4ff", padding: 64, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {activeTab === "pending" ? "⚡" : activeTab === "validated" ? "✅" : "❌"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>
            {activeTab === "pending"   ? "Aucune classification en attente"
           : activeTab === "validated" ? "Aucune classification validée"
           : "Aucune classification rejetée"}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            {activeTab === "pending" ? "Les nouvelles classifications apparaîtront ici à la création d'un ticket."
           : activeTab === "validated" ? "Les classifications validées ou corrigées apparaîtront ici."
           : "Les classifications rejetées apparaîtront ici."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {withAI.map(ticket => {
            const ai  = aiData[ticket.ticket_id];
            const clf = ai?.classification;
            const vSt = STATUS_COLORS[clf?.validation_status] || STATUS_COLORS.PENDING;
            const conf = Math.round((clf?.confidence || 0) * 100);

            return (
              <div key={ticket.ticket_id}
                onClick={() => setSelected(selected === ticket.ticket_id ? null : ticket.ticket_id)}
                style={{ background: "#fff", borderRadius: 12,
                  border: `1px solid ${selected === ticket.ticket_id ? "#6366f1" : "#e2e8f0"}`,
                  padding: "16px 20px", cursor: "pointer", transition: "all 0.15s" }}>

                {/* Ligne principale */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>#{ticket.ticket_id}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ticket.title}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, background: vSt.bg, color: vSt.color, borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>
                      {vSt.label}
                    </span>
                    <span style={{ fontSize: 11, background: "#f1f5f9", color: "#475569", borderRadius: 20, padding: "2px 10px" }}>
                      Confiance : {conf}%
                    </span>
                    {activeTab === "validated" && clf?.validated_at && (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {new Date(clf.validated_at).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Détail */}
                {selected === ticket.ticket_id && (
                  <div style={{ marginTop: 16, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
                    {/* Badge modèle */}
                    <div style={{ marginBottom: 12 }}>
                      {clf?.model_version?.startsWith("ML") ? (
                        <span style={{ fontSize: 11, background: "#eff6ff", color: "#2563eb", borderRadius: 20, padding: "3px 12px", fontWeight: 600 }}>
                          🤖 ML — TF-IDF + LinearSVC
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, background: "#faf5ff", color: "#7c3aed", borderRadius: 20, padding: "3px 12px", fontWeight: 600 }}>
                          🧠 LLM — Groq / LLaMA 3
                        </span>
                      )}
                    </div>

                    {/* Catégorie / Sous-cat / Priorité */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                      {[
                        { label: "Catégorie",      value: clf?.predicted_category },
                        { label: "Sous-catégorie", value: clf?.predicted_subcategory },
                        { label: "Priorité",       value: PRIORITY_LABELS[clf?.predicted_priority] || clf?.predicted_priority },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{value || "—"}</div>
                        </div>
                      ))}
                    </div>

                    {/* Barres confiance */}
                    <ConfidenceBars clf={clf} />

                    {/* Réponse suggérée (pending uniquement) */}
                    {activeTab === "pending" && ai?.auto_reply?.generated_text && (
                      <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, marginBottom: 4 }}>💬 Réponse suggérée</div>
                        <div style={{ fontSize: 13, color: "#0f172a" }}>{ai.auto_reply.generated_text}</div>
                      </div>
                    )}

                    {/* Actions — uniquement onglet En attente */}
                    {activeTab === "pending" && clf?.validation_status === "PENDING" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={e => { e.stopPropagation(); handleValidate(ticket.ticket_id, "VALIDATED"); }}
                          style={{ flex: 1, padding: "8px 0", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ✅ Valider
                        </button>
                        <button onClick={e => { e.stopPropagation(); setCorrecting(ticket.ticket_id); }}
                          style={{ flex: 1, padding: "8px 0", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ✏️ Corriger
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleValidate(ticket.ticket_id, "REJECTED"); }}
                          style={{ flex: 1, padding: "8px 0", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          ❌ Rejeter
                        </button>
                      </div>
                    )}

                    {/* Formulaire correction */}
                    {activeTab === "pending" && correcting === ticket.ticket_id && (
                      <div onClick={e => e.stopPropagation()}
                        style={{ marginTop: 12, background: "#eff6ff", borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8", marginBottom: 10 }}>Corriger la classification</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {[
                            { key: "corrected_category",    label: "Catégorie",      def: clf?.predicted_category },
                            { key: "corrected_subcategory", label: "Sous-catégorie", def: clf?.predicted_subcategory },
                            { key: "corrected_priority",    label: "Priorité",       def: clf?.predicted_priority },
                          ].map(({ key, label, def }) => (
                            <input key={key} placeholder={label} defaultValue={def}
                              onChange={e => setCorrection(prev => ({ ...prev, [key]: e.target.value }))}
                              style={{ padding: "8px 12px", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13 }} />
                          ))}
                          <button onClick={() => handleValidate(ticket.ticket_id, "CORRECTED", correction)}
                            style={{ padding: "8px 0", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                            Enregistrer la correction
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Info validé/rejeté */}
                    {activeTab !== "pending" && clf?.validated_at && (
                      <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8,
                        background: activeTab === "validated" ? "#f0fdf4" : "#fef2f2",
                        fontSize: 12, color: activeTab === "validated" ? "#16a34a" : "#dc2626" }}>
                        {activeTab === "validated" ? "✅ Validée" : "❌ Rejetée"} le{" "}
                        {new Date(clf.validated_at).toLocaleString("fr-FR")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
