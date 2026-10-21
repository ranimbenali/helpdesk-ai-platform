import { useEffect, useState, useCallback } from "react";
import {
  fetchTickets,
  fetchTicketDetail,
  fetchTicketStats,
  updateTicketStatus,
  updateTicketPriority,
  assignTicketAgent,
  fetchUsers,
  fetchTicketAudit,
  fetchTicketMessages,
  createTicketMessage,
  syncTicketsNow,
  fetchSyncLogs,
  createTicket,
  deleteTicket,
} from "../../api/tickets";
import { exportTicketPDF } from "../../utils/pdfExport";

import { API_BASE } from '../../api/config.js';
import AttachmentsList from "../../components/AttachmentsList";

// ── Helpers API IA ────────────────────────────────────────────────────────────
async function fetchAIResult(ticketId) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}/ai/tickets/${ticketId}/result`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement résultats IA");
  return res.json();
}

async function validateAIClassification(ticketId, payload) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}/ai/tickets/${ticketId}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erreur validation IA");
  return res.json();
}

async function analyzeTicketAI(ticketId) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}/ai/tickets/${ticketId}/analyze`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur analyse IA");
  return res.json();
}

async function applyAIReply(ticketId) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}/ai/tickets/${ticketId}/apply-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Erreur application réponse IA");
  return res.json();
}

// ── Composant panneau IA ──────────────────────────────────────────────────────
function AIPanel({ ticketId, onRefreshTicket }) {
  const [aiData, setAiData]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState("");
  const [analyzing, setAnalyzing]   = useState(false);

  // Correction manuelle
  const [showCorrect, setShowCorrect] = useState(false);
  const [corrPriority, setCorrPriority]     = useState("");
  const [corrCategory, setCorrCategory]     = useState("");
  const [corrSubcategory, setCorrSubcategory] = useState("");

  const CATEGORIES = [
    "Réseau", "Matériel", "Logiciel", "Accès",
    "Impression", "Email", "Téléphonie", "Autre",
  ];
  const SUBCATEGORIES = {
    "Réseau":      ["Connexion Internet", "VPN", "WiFi", "Switch/Routeur", "Autre"],
    "Matériel":    ["PC / Laptop", "Imprimante", "Écran", "Périphérique", "Autre"],
    "Logiciel":    ["Installation", "Mise à jour", "Licence", "Bug applicatif", "Autre"],
    "Accès":       ["Compte utilisateur", "Mot de passe", "Droits/Permissions", "Badge", "Autre"],
    "Impression":  ["Imprimante en panne", "Qualité impression", "Papier/Toner", "Autre"],
    "Email":       ["Messagerie Outlook", "Spam", "Configuration", "Autre"],
    "Téléphonie":  ["Téléphone fixe", "Mobile", "Visioconférence", "Autre"],
    "Autre":       ["Demande générale", "Information", "Autre"],
  };

  useEffect(() => { loadAI(); }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAI() {
    try {
      setLoading(true); setError("");
      const data = await fetchAIResult(ticketId);
      setAiData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate(status) {
    try {
      setSaving(true); setError(""); setSuccess("");
      const payload = { validation_status: status };
      if (status === "CORRECTED") {
        payload.corrected_priority    = corrPriority;
        payload.corrected_category    = corrCategory;
        payload.corrected_subcategory = corrSubcategory;
      }
      await validateAIClassification(ticketId, payload);
      setSuccess(`Classification ${status === "VALIDATED" ? "validée" : status === "REJECTED" ? "rejetée" : "corrigée"} !`);
      setShowCorrect(false);
      await loadAI();
      if (onRefreshTicket) onRefreshTicket();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze() {
    try {
      setAnalyzing(true); setError(""); setSuccess("");
      await analyzeTicketAI(ticketId);
      setSuccess("Analyse IA lancée ! Résultats disponibles dans quelques secondes...");
      setTimeout(async () => { await loadAI(); setSuccess(""); }, 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleApplyReply() {
    try {
      setSaving(true); setError(""); setSuccess("");
      await applyAIReply(ticketId);
      setSuccess("Réponse IA appliquée comme message !");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "#94a3b8", fontSize: "13px" }}>Chargement analyse IA...</p>;

  const classif   = aiData?.classification;
  const autoReply = aiData?.auto_reply;
  const processed = aiData?.ai_processed;

  const confidencePct = classif ? Math.round((classif.confidence || 0) * 100) : 0;
  const confidenceColor =
    confidencePct >= 80 ? "#22c55e" :
    confidencePct >= 60 ? "#f59e0b" : "#ef4444";

  const validationStatus = classif?.validation_status;
  const validationBadge = {
    PENDING:   { label: "En attente",  bg: "#fef9c3", color: "#854d0e" },
    VALIDATED: { label: "Validée",     bg: "#f0fdf4", color: "#16a34a" },
    REJECTED:  { label: "Rejetée",     bg: "#fef2f2", color: "#dc2626" },
    CORRECTED: { label: "Corrigée",    bg: "#eff6ff", color: "#0a46d6" },
  };
  const badge = validationBadge[validationStatus] || validationBadge.PENDING;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {error   && <div style={{ padding: "10px 14px", background: "#fef2f2", borderRadius: "8px", color: "#dc2626", fontSize: "13px" }}>⚠️ {error}</div>}
      {success && <div style={{ padding: "10px 14px", background: "#f0fdf4", borderRadius: "8px", color: "#16a34a", fontSize: "13px" }}>✅ {success}</div>}

      {/* ── Pas encore analysé ── */}
      {!processed && (
        <div style={{
          padding: "20px", borderRadius: "12px",
          background: "linear-gradient(135deg, #f8faff, #f5f3ff)",
          border: "1px solid #e8ecff", textAlign: "center",
        }}>
          <div style={{ fontSize: "36px", marginBottom: "10px" }}>🤖</div>
          <p style={{ margin: "0 0 4px", fontWeight: "700", color: "#0f172a", fontSize: "14px" }}>
            Ce ticket n'a pas encore été analysé
          </p>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "12px" }}>
            Lancez l'analyse pour obtenir une classification automatique
          </p>
          <button
            onClick={handleAnalyze} disabled={analyzing}
            style={{
              padding: "8px 20px", borderRadius: "8px", border: "none",
              background: "linear-gradient(135deg, #0a46d6, #6c63ff)",
              color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer",
            }}
          >
            {analyzing ? "⏳ Analyse en cours..." : "🚀 Lancer l'analyse IA"}
          </button>
        </div>
      )}

      {/* ── Résultats classification ── */}
      {processed && classif && (
        <div style={{ background: "#f8faff", borderRadius: "12px", border: "1px solid #e8ecff", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px",
            background: "linear-gradient(135deg, #0a46d6, #6c63ff)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: "700", fontSize: "13px" }}>
              🤖 Classification IA
            </span>
            <span style={{
              padding: "2px 8px", borderRadius: "20px",
              background: badge.bg, color: badge.color,
              fontSize: "10px", fontWeight: "700",
            }}>
              {badge.label}
            </span>
          </div>

          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Catégorie */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Catégorie</span>
              <span style={{
                padding: "3px 10px", borderRadius: "6px",
                background: "#edf2ff", color: "#0a46d6",
                fontSize: "12px", fontWeight: "700",
              }}>
                {classif.predicted_category || "—"}
                {classif.predicted_subcategory ? ` / ${classif.predicted_subcategory}` : ""}
              </span>
            </div>

            {/* Priorité */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Priorité suggérée</span>
              <span style={{
                padding: "3px 10px", borderRadius: "6px",
                background: classif.predicted_priority === "Urgente" ? "#fef2f2" :
                            classif.predicted_priority === "Haute"   ? "#fff8e1" :
                            classif.predicted_priority === "Normale" ? "#eff6ff" : "#f0fdf4",
                color: classif.predicted_priority === "Urgente" ? "#dc2626" :
                       classif.predicted_priority === "Haute"   ? "#b45309" :
                       classif.predicted_priority === "Normale" ? "#0a46d6" : "#16a34a",
                fontSize: "12px", fontWeight: "700",
              }}>
                {classif.predicted_priority || "—"}
              </span>
            </div>

            {/* Confiance — double barre ML + LLM */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {/* Barre ML — toujours si ml_confidence dispo */}
              {classif.ml_confidence != null && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Confiance ML</span>
                    <span style={{ fontSize: "11px", fontWeight: "700",
                      color: classif.model_version?.startsWith("ML") ? "#2563eb" : "#94a3b8" }}>
                      {Math.round(classif.ml_confidence * 100)}%
                      {!classif.model_version?.startsWith("ML") && " (sous seuil → LLM)"}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round(classif.ml_confidence * 100)}%`,
                      background: classif.model_version?.startsWith("ML") ? "#2563eb" : "#cbd5e1",
                      borderRadius: 3, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              )}
              {/* Barre LLM — si LLM utilisé */}
              {!classif.model_version?.startsWith("ML") && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                      Confiance LLM <span style={{ fontSize: 10, color: "#94a3b8" }}>(auto-estimée)</span>
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed" }}>{confidencePct}%</span>
                  </div>
                  <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${confidencePct}%`,
                      background: "#7c3aed", borderRadius: 3, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              )}
              {/* ML seul sans ml_confidence (anciens tickets) */}
              {classif.model_version?.startsWith("ML") && classif.ml_confidence == null && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>Confiance ML</span>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: confidenceColor }}>{confidencePct}%</span>
                  </div>
                  <div style={{ height: 5, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${confidencePct}%`,
                      background: confidenceColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Mots-clés */}
            {classif.keywords && classif.keywords.length > 0 && (
              <div>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Mots-clés
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {classif.keywords.map((kw, i) => (
                    <span key={i} style={{
                      padding: "2px 8px", borderRadius: "20px",
                      background: "#f1f5f9", color: "#475569",
                      fontSize: "11px", fontWeight: "600",
                    }}>
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modèle */}
            <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
              Modèle : {classif.model_version || "—"} • {classif.created_at ? new Date(classif.created_at).toLocaleString("fr-FR") : ""}
            </div>

            {/* Boutons validation */}
            {validationStatus === "PENDING" && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                <button
                  onClick={() => handleValidate("VALIDATED")} disabled={saving}
                  style={{
                    flex: 1, padding: "7px", borderRadius: "8px",
                    background: "#f0fdf4", color: "#16a34a",
                    fontWeight: "700", fontSize: "12px", cursor: "pointer",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  ✅ Valider
                </button>
                <button
                  onClick={() => handleValidate("REJECTED")} disabled={saving}
                  style={{
                    flex: 1, padding: "7px", borderRadius: "8px",
                    background: "#fef2f2", color: "#dc2626",
                    fontWeight: "700", fontSize: "12px", cursor: "pointer",
                    border: "1px solid #fecaca",
                  }}
                >
                  ❌ Rejeter
                </button>
                <button
                  onClick={() => setShowCorrect(!showCorrect)} disabled={saving}
                  style={{
                    flex: 1, padding: "7px", borderRadius: "8px",
                    background: "#eff6ff", color: "#0a46d6",
                    fontWeight: "700", fontSize: "12px", cursor: "pointer",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  ✏️ Corriger
                </button>
              </div>
            )}

            {/* Formulaire correction */}
            {showCorrect && (
              <div style={{
                padding: "14px", background: "#fff",
                borderRadius: "10px", border: "1px solid #e8ecff",
                display: "flex", flexDirection: "column", gap: "10px",
              }}>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                  ✏️ Corriger la classification
                </p>
                <select className="users-input" value={corrCategory}
                  onChange={e => { setCorrCategory(e.target.value); setCorrSubcategory(""); }}>
                  <option value="">Catégorie...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="users-input" value={corrSubcategory}
                  onChange={e => setCorrSubcategory(e.target.value)}
                  disabled={!corrCategory}>
                  <option value="">Sous-catégorie...</option>
                  {(SUBCATEGORIES[corrCategory] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="users-input" value={corrPriority}
                  onChange={e => setCorrPriority(e.target.value)}>
                  <option value="">Priorité...</option>
                  {["Urgente", "Haute", "Normale", "Faible"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button
                  onClick={() => handleValidate("CORRECTED")} disabled={saving}
                  style={{
                    padding: "8px", borderRadius: "8px", border: "none",
                    background: "linear-gradient(135deg, #0a46d6, #6c63ff)",
                    color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                  }}
                >
                  Appliquer la correction
                </button>
              </div>
            )}

            {/* Re-analyser */}
            {validationStatus !== "PENDING" && (
              <button
                onClick={handleAnalyze} disabled={analyzing}
                style={{
                  padding: "7px", borderRadius: "8px",
                  background: "#f8faff", color: "#0a46d6",
                  fontWeight: "700", fontSize: "12px", cursor: "pointer",
                  border: "1px solid #e8ecff",
                }}
              >
                {analyzing ? "⏳ Analyse en cours..." : "🔄 Re-analyser"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Réponse automatique ── */}
      {processed && autoReply && (
        <div style={{
          background: "#f8faff", borderRadius: "12px",
          border: "1px solid #e8ecff", overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 16px",
            background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: "700", fontSize: "13px" }}>
              💬 Réponse automatique suggérée
            </span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <p style={{
              margin: "0 0 12px", fontSize: "13px", color: "#334155",
              lineHeight: "1.6", fontStyle: "italic",
              background: "#fff", padding: "10px 12px", borderRadius: "8px",
              border: "1px solid #e8ecff",
            }}>
              "{autoReply.corrected_text || autoReply.generated_text}"
            </p>
            <button
              onClick={handleApplyReply} disabled={saving}
              style={{
                padding: "7px 16px", borderRadius: "8px", border: "none",
                background: "linear-gradient(135deg, #6c63ff, #8b5cf6)",
                color: "#fff", fontWeight: "700", fontSize: "12px", cursor: "pointer",
              }}
            >
              📤 Envoyer comme message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function AdminTicketsContent({ triggerNewTicket = 0, triggerExportCSV = 0 }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [hasMore, setHasMore] = useState(false);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [statusValue, setStatusValue] = useState("");
  const [priorityValue, setPriorityValue] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");

  const [assignableUsers, setAssignableUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [auditItems, setAuditItems] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  const [messageItems, setMessageItems] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [classifying, setClassifying] = useState(false);

  const [syncLogs, setSyncLogs] = useState([]);
  const [syncLogsLoading, setSyncLogsLoading] = useState(false);
  const [syncLogsError, setSyncLogsError] = useState("");
  const [showSyncLogsModal, setShowSyncLogsModal] = useState(false);

  const [activeTab, setActiveTab]     = useState("info");
  const [statusTab, setStatusTab]     = useState("ALL");
  const [ticketStats, setTicketStats] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [periodeFilter, setPeriodeFilter]   = useState("");
  const [slaFilter, setSlaFilter]           = useState("");
  const [agentsList, setAgentsList]         = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ title:"", description:"" });
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchTickets({
        q: search, status: statusFilter, priority: priorityFilter,
        skip: page * perPage, limit: perPage,
      });
      setTickets(data);
      setHasMore(data.length === perPage);
    } catch (err) {
      setError(err.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, page, perPage]);

  async function loadSyncLogs() {
    try {
      setSyncLogsLoading(true); setSyncLogsError("");
      const data = await fetchSyncLogs();
      setSyncLogs(data.items || []);
    } catch (err) {
      setSyncLogsError(typeof err?.message === "string" ? err.message : "Erreur lors du chargement des logs.");
      setSyncLogs([]);
    } finally {
      setSyncLogsLoading(false);
    }
  }

  async function exportAllToCSV() {
    try {
      setSyncMessage("Préparation de l'export CSV...");
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tickets/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur lors de l'export");
      const data = await res.json();
      const all = data.tickets || [];

      const SLA_H = { Urgente:4, Haute:8, Normale:24, Faible:72 };
      const PRIO_FR = { P1_URGENT:"Urgente", P2_HIGH:"Haute", P3_NORMAL:"Normale", P4_LOW:"Faible" };
      function computeSLA(t) {
        if (["RESOLVED","CLOSED"].includes(t.status)) return "OK";
        const prio = PRIO_FR[t.priority] || t.priority || "Normale";
        const slaH = SLA_H[prio] ?? 24;
        const created = t.created_at ? new Date(t.created_at.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1")) : null;
        if (!created || isNaN(created)) return "—";
        const ageH = (Date.now() - created) / 3_600_000;
        const pct = ageH / slaH;
        if (pct >= 1) return "Dépassé";
        if (pct >= 0.8) return "À risque";
        return "En cours";
      }

      function csvCell(val) {
        const s = (val == null ? "" : String(val)).replace(/"/g, '""');
        return `"${s}"`;
      }

      const headers = ["ID","Sujet","Description","Demandeur","Agent","Site","Groupe","Catégorie","Sous-catégorie","Priorité","Statut","SLA","Créé le","Résolu le"];
      const rows = all.map(t => [
        t.id,
        csvCell(t.title),
        csvCell(t.description),
        csvCell(t.requester),
        csvCell(t.assignee),
        csvCell(t.site),
        csvCell(t.group),
        csvCell(t.category),
        csvCell(t.subcategory),
        csvCell(t.priority),
        csvCell(t.status),
        computeSLA(t),
        csvCell(t.created_at),
        csvCell(t.resolved_at),
      ]);
      const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tickets_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setSyncMessage(`Export CSV : ${all.length} tickets exportés.`);
      setTimeout(() => setSyncMessage(""), 4000);
    } catch (err) {
      setSyncError(err.message || "Erreur lors de l'export CSV.");
    }
  }

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { if (triggerNewTicket > 0) setShowCreateModal(true); }, [triggerNewTicket]);
  useEffect(() => { if (triggerExportCSV > 0) exportAllToCSV(); }, [triggerExportCSV]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTicketStats().then(setTicketStats).catch(() => {}); }, []);
  useEffect(() => {
    fetchUsers().then(u => setAgentsList(u.filter(x => ["AGENT","SUPERVISOR","ADMIN"].includes(x.role)))).catch(()=>{});
  }, []);

  async function handleSearch(e) { e.preventDefault(); setPage(0); await loadTickets(); }

  async function handleReset() {
    setSearch(""); setStatusFilter(""); setPriorityFilter(""); setPage(0);
    setSyncMessage(""); setSyncError("");
    try {
      setLoading(true); setError("");
      const data = await fetchTickets({ skip: 0, limit: perPage });
      setTickets(data); setHasMore(data.length === perPage);
    } catch (err) { setError(err.message || "Erreur de chargement"); }
    finally { setLoading(false); }
  }

  async function handleSyncNow() {
    try {
      setSyncing(true); setSyncError(""); setSyncMessage("");
      const result = await syncTicketsNow();
      await Promise.all([loadTickets(), loadSyncLogs(), fetchTicketStats().then(setTicketStats).catch(() => {})]);
      setSyncMessage(`Synchronisation réussie : ${result.created_count} créés, ${result.updated_count} mis à jour, ${result.skipped_count} ignorés.`);
      setTimeout(() => setSyncMessage(""), 5000);
    } catch (err) { setSyncError(err.message || "Échec de la synchronisation."); }
    finally { setSyncing(false); }
  }

  async function handleClassifyPending() {
    try {
      setClassifying(true); setSyncError(""); setSyncMessage("");
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tickets/ai/classify-pending`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Erreur classification");
      setSyncMessage(`Classification IA lancée en arrière-plan pour ${data.pending_count} tickets. Rafraîchissez dans quelques minutes.`);
      setTimeout(() => setSyncMessage(""), 10000);
    } catch (err) { setSyncError(err.message || "Erreur lors du lancement de la classification."); }
    finally { setClassifying(false); }
  }

  async function loadAssignableUsers() {
    try {
      const data = await fetchUsers();
      setAssignableUsers(data.filter(u => ["AGENT", "SUPERVISOR", "ADMIN"].includes(u.role)));
    } catch (err) { console.error(err); }
  }

  async function loadTicketAudit(ticketId) {
    try {
      setAuditLoading(true); setAuditError("");
      const data = await fetchTicketAudit(ticketId);
      setAuditItems(data.items || []);
    } catch (err) { setAuditError(err.message || "Impossible de charger l'historique."); setAuditItems([]); }
    finally { setAuditLoading(false); }
  }

  async function loadTicketMessages(ticketId) {
    try {
      setMessagesLoading(true); setMessagesError("");
      const data = await fetchTicketMessages(ticketId);
      setMessageItems(data.items || []);
    } catch (err) { setMessagesError(err.message || "Impossible de charger les messages."); setMessageItems([]); }
    finally { setMessagesLoading(false); }
  }

  async function openTicketModal(ticket) {
    try {
      setDetailLoading(true); setDetailError(""); setSaveMessage("");
      setAuditError(""); setAuditItems([]); setMessagesError("");
      setMessageItems([]); setNewMessage(""); setMessageSuccess("");
      setActiveTab("info"); // ✅ Reset onglet

      const [detail] = await Promise.all([fetchTicketDetail(ticket.ticket_id), loadAssignableUsers()]);
      setSelectedTicket(detail);
      setStatusValue(detail.status || "");
      setPriorityValue(detail.priority_label || "");
      setAssigneeUserId(detail.assignee_user_id ? String(detail.assignee_user_id) : "");
      await Promise.all([loadTicketAudit(ticket.ticket_id), loadTicketMessages(ticket.ticket_id)]);
    } catch (err) {
      setDetailError(err.message || "Impossible de charger le détail.");
      setSelectedTicket(ticket);
      setStatusValue(ticket.status || ""); setPriorityValue(ticket.priority_label || ""); setAssigneeUserId("");
    } finally { setDetailLoading(false); }
  }

  function closeTicketModal() {
    setSelectedTicket(null); setDetailError(""); setSaveMessage("");
    setStatusValue(""); setPriorityValue(""); setAssigneeUserId("");
    setAuditItems([]); setAuditError(""); setMessageItems([]);
    setMessagesError(""); setNewMessage(""); setMessageSuccess("");
    setActiveTab("info"); setDeleteConfirm(false);
  }

  async function handleDeleteTicket() {
    if (!selectedTicket || deleting) return;
    setDeleting(true);
    try {
      await deleteTicket(selectedTicket.ticket_id);
      closeTicketModal();
      await loadTickets();
    } catch (err) { setDetailError(err.message || "Erreur lors de la suppression."); }
    finally { setDeleting(false); setDeleteConfirm(false); }
  }

  async function handleSaveTicketActions() {
    if (!selectedTicket) return;
    try {
      setSaving(true); setDetailError(""); setSaveMessage("");
      await updateTicketStatus(selectedTicket.ticket_id, statusValue);
      await updateTicketPriority(selectedTicket.ticket_id, priorityValue);
      if (assigneeUserId) await assignTicketAgent(selectedTicket.ticket_id, Number(assigneeUserId));
      const refreshed = await fetchTicketDetail(selectedTicket.ticket_id);
      setSelectedTicket(refreshed);
      setStatusValue(refreshed.status || "");
      setPriorityValue(refreshed.priority_label || "");
      setAssigneeUserId(refreshed.assignee_user_id ? String(refreshed.assignee_user_id) : "");
      await Promise.all([loadTicketAudit(selectedTicket.ticket_id), loadTickets()]);
      setSaveMessage("Ticket mis à jour avec succès.");
    } catch (err) { setDetailError(err.message || "Échec de la mise à jour."); }
    finally { setSaving(false); }
  }

  async function handleSendMessage() {
    if (!selectedTicket) return;
    const content = newMessage.trim();
    if (!content) { setMessagesError("Le message ne peut pas être vide."); return; }
    try {
      setSendingMessage(true); setMessagesError(""); setMessageSuccess("");
      await createTicketMessage(selectedTicket.ticket_id, { content, is_internal: true });
      setNewMessage("");
      await loadTicketMessages(selectedTicket.ticket_id);
      setMessageSuccess("Commentaire ajouté avec succès.");
    } catch (err) { setMessagesError(err.message || "Échec lors de l'ajout."); }
    finally { setSendingMessage(false); }
  }

  // ── Tabs config ──
  const TABS = [
    { id: "info",     icon: "📋", label: "Informations" },
    { id: "actions",  icon: "⚡", label: "Actions" },
    { id: "ai",       icon: "🤖", label: "Analyse IA" },
    { id: "audit",    icon: "📜", label: "Historique" },
    { id: "messages", icon: "💬", label: "Commentaires" },
  ];

  // ── helpers visuels ──
  const AVATAR_COLORS = ["#F97316","#8B5CF6","#06B6D4","#22C55E","#EF4444","#EC4899","#3B82F6","#F59E0B"];
  function agentColor(name = "") { let h=0; for(let c of name) h=(h*31+c.charCodeAt(0))&0xffff; return AVATAR_COLORS[h%AVATAR_COLORS.length]; }
  function agentInitials(name = "") { return name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

  // Normalise P1_URGENT/P2_HIGH... → Urgente/Haute...
  function normalizePriority(p) {
    const MAP = {
      P1_URGENT:"Urgente", P2_HIGH:"Haute", P3_NORMAL:"Normale", P4_LOW:"Faible",
      // déjà en français → inchangé
      Urgente:"Urgente", Haute:"Haute", Normale:"Normale", Faible:"Faible", Basse:"Faible", Moyenne:"Normale",
    };
    return MAP[p] || p || "—";
  }

  // Calcule le statut SLA depuis created_at + priorité
  function getSLAStatus(ticket) {
    if (["RESOLVED","CLOSED"].includes(ticket.status))
      return { label:"OK", color:"#22c55e", bg:"#f0fdf4" };

    const SLA_H = { Urgente:4, Haute:8, Normale:24, Faible:72 };
    const prio  = normalizePriority(ticket.priority_label);
    const slaH  = SLA_H[prio] ?? 24;
    const ageH  = (Date.now() - new Date(ticket.created_at)) / 3_600_000;
    const pct   = ageH / slaH;

    if (pct >= 1)   return { label:"Dépassé",  color:"#dc2626", bg:"#fef2f2" };
    if (pct >= 0.8) return { label:"À risque", color:"#ea580c", bg:"#fff7ed" };
    return { label:"En cours", color:"#64748b", bg:"#f8fafc" };
  }

  const PRIORITY_STYLE = {
    Urgente:{ bg:"#fee2e2", color:"#dc2626" },
    Haute:  { bg:"#ffedd5", color:"#ea580c" },
    Normale:{ bg:"#eff6ff", color:"#2563eb" },
    Faible: { bg:"#f0fdf4", color:"#16a34a" },
    Basse:  { bg:"#f0fdf4", color:"#16a34a" },
    Moyenne:{ bg:"#fef9c3", color:"#ca8a04" },
  };

  const STATUS_STYLE = {
    OPEN:        { dot:"#F59E0B", label:"Ouvert",   color:"#B45309" },
    IN_PROGRESS: { dot:"#3B82F6", label:"En cours", color:"#1d4ed8" },
    RESOLVED:    { dot:"#22c55e", label:"Résolu",   color:"#15803d" },
    CLOSED:      { dot:"#94a3b8", label:"Fermé",    color:"#64748b" },
    CANCELLED:   { dot:"#e53935", label:"Annulé",   color:"#e53935" },
  };

  const byStatus    = ticketStats?.by_status || {};
  const totalOpen   = (byStatus.OPEN || 0);
  const totalIP     = (byStatus.IN_PROGRESS || 0);
  const totalRes    = (byStatus.RESOLVED || 0) + (byStatus.CLOSED || 0);
  const totalAll    = ticketStats?.total || 0;
  const atRiskCount = ticketStats?.at_risk_count ?? 0;
  const resolvedToday = ticketStats?.resolved_today ?? 0;

  const STATUS_TABS = [
    { key:"ALL",         label:"Tous",       filter:"",            count: totalAll },
    { key:"OPEN",        label:"Ouverts",    filter:"OPEN",        count: byStatus.OPEN || 0 },
    { key:"IN_PROGRESS", label:"En cours",   filter:"IN_PROGRESS", count: byStatus.IN_PROGRESS || 0 },
    { key:"OPEN_WAIT",   label:"En attente", filter:"OPEN",        count: byStatus.OPEN || 0 },
    { key:"RESOLVED",    label:"Résolus",    filter:"RESOLVED",    count: byStatus.RESOLVED || 0 },
    { key:"CLOSED",      label:"Fermés",     filter:"CLOSED",      count: byStatus.CLOSED || 0 },
  ];

  const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" };

  return (
    <div className="adm-body">

      {/* ── KPI Row ── */}
      {(() => {
        const ipPct    = totalAll > 0 ? Math.round(totalIP   / totalAll * 100) : 0;
        const openPct  = totalAll > 0 ? Math.round(totalOpen / totalAll * 100) : 0;
        const resPct   = totalAll > 0 ? Math.round(totalRes  / totalAll * 100) : 0;
        const kpis = [
          { label:"TOTAL OUVERTS",       value: totalOpen + totalIP, trend: `${totalAll} au total`,    color:"#2B45C8",  trendColor:"#64748b" },
          { label:"EN COURS",            value: totalIP,             trend: `${ipPct}% du total`,      color:"#2B45C8",  trendColor:"#2563eb" },
          { label:"EN ATTENTE",          value: totalOpen,           trend: `${openPct}% du total`,    color:"#2B45C8",  trendColor:"#ea580c" },
          { label:"À RISQUE SLA",        value: atRiskCount,
                                         trend: "SLA > 80% consommé", color:"#dc2626", trendColor:"#dc2626", valueColor:"#dc2626" },
          { label:"RÉSOLUS AUJOURD'HUI", value: resolvedToday,       trend: `${resPct}% taux résolution`, color:"#16a34a", trendColor:"#16a34a", valueColor:"#16a34a" },
        ];
        return (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:18 }}>
            {kpis.map((k,i) => (
              <div key={i} style={{ ...card, padding:"18px 20px", borderTop:`3px solid ${k.color}` }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:600, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</div>
                <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:28, fontWeight:800, color:k.valueColor||"#0f172a", lineHeight:1, marginBottom:6 }}>{k.value}</div>
                <div style={{ fontSize:11, color:k.trendColor||"#64748b", fontWeight:600 }}>{k.trend}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Main card ── */}
      <div style={card}>

        {/* ── Ligne 1 : Onglets de statut ── */}
        <div style={{ padding:"0 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:2 }}>
          {STATUS_TABS.map(t => (
            <button key={t.key}
              onClick={() => { setStatusTab(t.key); setStatusFilter(t.filter); setPage(0); }}
              style={{
                padding:"12px 14px", border:"none", cursor:"pointer", whiteSpace:"nowrap",
                fontFamily:"inherit", fontSize:13, fontWeight: statusTab===t.key ? 700 : 500,
                background:"transparent",
                color: statusTab===t.key ? "#1E3AAF" : "#64748b",
                borderBottom: statusTab===t.key ? "2px solid #1E3AAF" : "2px solid transparent",
                marginBottom:"-1px",
                transition:"all 0.15s",
                display:"flex", alignItems:"center", gap:6,
              }}>
              {t.label}
              <span style={{
                fontSize:11, fontWeight:700,
                padding:"1px 7px", borderRadius:20,
                background: statusTab===t.key ? "#eef2ff" : "#f1f5f9",
                color: statusTab===t.key ? "#1E3AAF" : "#94a3b8",
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Ligne 2 : Filtres ── */}
        <div style={{ padding:"10px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:8, flexWrap:"nowrap", overflowX:"auto" }}>
          <span style={{ fontSize:11, fontWeight:600, color:"#94a3b8", whiteSpace:"nowrap", marginRight:4 }}>Filtrer :</span>

          {/* Catégorie */}
          {[
            { label:"Catégorie", value:categoryFilter, onChange: v => { setCategoryFilter(v); setPage(0); },
              options:["Réseau","Matériel","Logiciel","Accès & Compte","Email & Messagerie","Téléphone","Réclamation","Intervention","RH_Finance","Autre"] },
            { label:"Priorité",  value:priorityFilter, onChange: v => { setPriorityFilter(v); setPage(0); },
              options:["Urgente","Haute","Normale","Faible"] },
            { label:"Période",   value:periodeFilter,  onChange: v => { setPeriodeFilter(v);  setPage(0); },
              options:[{v:"today",l:"Aujourd'hui"},{v:"week",l:"Cette semaine"},{v:"month",l:"Ce mois"},{v:"quarter",l:"Ce trimestre"}] },
            { label:"SLA",       value:slaFilter,      onChange: v => { setSlaFilter(v);      setPage(0); },
              options:[{v:"ok",l:"OK (résolu)"},{v:"ongoing",l:"En cours"},{v:"risk",l:"À risque (> 80%)"},{v:"breach",l:"Dépassé (> 100%)"}] },
          ].map(f => (
            <div key={f.label} style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"5px 12px", borderRadius:20,
              border:`1.5px solid ${f.value ? "#1E3AAF" : "#e8ecf7"}`,
              background: f.value ? "#eef2ff" : "#fff",
              cursor:"pointer",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={f.value?"#1E3AAF":"#94a3b8"} strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              <select value={f.value} onChange={e => f.onChange(e.target.value)}
                style={{ border:"none", background:"none", fontSize:12, fontWeight:600,
                  color: f.value ? "#1E3AAF" : "#475569", cursor:"pointer", outline:"none",
                  fontFamily:"inherit", padding:0, whiteSpace:"nowrap" }}>
                <option value="">{f.label}</option>
                {f.options.map(o => typeof o === "string"
                  ? <option key={o} value={o}>{o}</option>
                  : <option key={o.v} value={o.v}>{o.l}</option>
                )}
              </select>
            </div>
          ))}

          {/* Reset */}
          {(categoryFilter||periodeFilter||slaFilter||priorityFilter||statusFilter) && (
            <button onClick={() => { setCategoryFilter(""); setPeriodeFilter(""); setSlaFilter(""); setPriorityFilter(""); setStatusFilter(""); setStatusTab("ALL"); setPage(0); }}
              style={{ border:"none", background:"#fee2e2", color:"#dc2626", borderRadius:20,
                padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer",
                fontFamily:"inherit", whiteSpace:"nowrap" }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>

        {/* ── Table header ── */}
        <div style={{ padding:"12px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:14, color:"#0f172a" }}>
              {totalAll.toLocaleString("fr-FR")} tickets · {tickets.length} affichés
            </div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Triés par date · plus récents d'abord</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Sync buttons */}
            <button onClick={handleSyncNow} disabled={syncing || classifying}
              style={{ height:34, padding:"0 12px", border:"1.5px solid #e8ecf7", borderRadius:8,
                background:"#fff", fontSize:12, fontWeight:600, color: syncing?"#94a3b8":"#334155",
                cursor: syncing?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              {syncing ? "Sync..." : "Synchroniser"}
            </button>
            <button onClick={handleClassifyPending} disabled={classifying || syncing}
              style={{ height:34, padding:"0 12px", border:"1.5px solid #7c3aed", borderRadius:8,
                background: classifying?"#f5f3ff":"#faf5ff", fontSize:12, fontWeight:600,
                color: classifying?"#94a3b8":"#7c3aed",
                cursor: classifying?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><circle cx="19" cy="5" r="3" fill="#7c3aed" stroke="none"/></svg>
              {classifying ? "En cours..." : "Reclassifier non traités"}
            </button>
            <button onClick={() => { setShowSyncLogsModal(true); loadSyncLogs(); }}
              style={{ height:34, padding:"0 12px", border:"1.5px solid #e8ecf7", borderRadius:8,
                background:"#fff", fontSize:12, fontWeight:600, color:"#334155",
                cursor:"pointer", fontFamily:"inherit" }}>
              Historique sync
            </button>
            {/* Search */}
            <div style={{ position:"relative" }}>
              <svg style={{ position:"absolute", left:10, top:10, color:"#94a3b8" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" placeholder="Rechercher par ID, sujet..."
                value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                style={{ height:34, padding:"0 12px 0 30px", border:"1.5px solid #e8ecf7",
                  borderRadius:8, fontSize:12, outline:"none", width:220, fontFamily:"inherit", background:"#fff", color:"#0f172a" }} />
            </div>
          </div>
        </div>

        {error    && <div style={{ padding:"10px 20px", background:"#fef2f2", color:"#e53935", fontSize:12 }}>{error}</div>}
        {syncError&& <div style={{ padding:"10px 20px", background:"#fef2f2", color:"#e53935", fontSize:12 }}>{syncError}</div>}
        {syncMessage&& <div style={{ padding:"10px 20px", background:"#f0fdf4", color:"#15803d", fontSize:12 }}>{syncMessage}</div>}

        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:"#94a3b8" }}>Chargement...</div>
        ) : (
          <>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["ID","SUJET","DEMANDEUR","AGENT","CATÉGORIE","PRIORITÉ","STATUT","SLA",""].map((h,i) => (
                    <th key={i} style={{ padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700,
                      color:"#94a3b8", letterSpacing:"0.09em", textTransform:"uppercase",
                      fontFamily:"'JetBrains Mono',monospace", borderBottom:"1px solid #f1f5f9",
                      whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const now = new Date();
                  const displayed = tickets.filter(t => {
                    if (categoryFilter && t.category !== categoryFilter) return false;
                    if (slaFilter) {
                      const slaLabel = getSLAStatus(t).label;
                      if (slaFilter === "ok"      && slaLabel !== "OK")        return false;
                      if (slaFilter === "ongoing"  && slaLabel !== "En cours") return false;
                      if (slaFilter === "risk"     && slaLabel !== "À risque") return false;
                      if (slaFilter === "breach"   && slaLabel !== "Dépassé")  return false;
                    }
                    if (periodeFilter) {
                      const created = new Date(t.created_at);
                      if (periodeFilter==="today") { const d=new Date(now); d.setHours(0,0,0,0); if(created<d) return false; }
                      if (periodeFilter==="week")  { const d=new Date(now); d.setDate(d.getDate()-7); if(created<d) return false; }
                      if (periodeFilter==="month") { const d=new Date(now); d.setMonth(d.getMonth()-1); if(created<d) return false; }
                      if (periodeFilter==="quarter"){ const d=new Date(now); d.setMonth(d.getMonth()-3); if(created<d) return false; }
                    }
                    return true;
                  });
                  if (displayed.length === 0) return (
                    <tr><td colSpan="9" style={{ padding:40, textAlign:"center", color:"#94a3b8" }}>Aucun ticket trouvé</td></tr>
                  );
                  return displayed.map(ticket => {
                  const priLabel = normalizePriority(ticket.priority_label);
                  const pri  = PRIORITY_STYLE[priLabel] || { bg:"#f1f5f9", color:"#64748b" };
                  const sta  = STATUS_STYLE[ticket.status] || STATUS_STYLE.OPEN;
                  const sla  = getSLAStatus(ticket);
                  const agent= ticket.assignee_name || "";
                  return (
                    <tr key={ticket.ticket_id} onClick={() => openTicketModal(ticket)}
                      style={{ borderBottom:"1px solid #f8fafc", cursor:"pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background="#fafbff"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}>

                      {/* ID */}
                      <td style={{ padding:"12px 14px", fontSize:13, color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>
                        #{ticket.external_id || ticket.ticket_id}
                      </td>

                      {/* Sujet */}
                      <td style={{ padding:"12px 14px", maxWidth:220 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:"#0f172a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {ticket.title}
                        </div>
                        <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
                          {formatDate(ticket.created_at)}
                        </div>
                      </td>

                      {/* Demandeur */}
                      <td style={{ padding:"12px 14px" }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{ticket.requester_name || "—"}</div>
                        <div style={{ fontSize:11, color:"#94a3b8" }}>{ticket.site || ""}</div>
                      </td>

                      {/* Agent */}
                      <td style={{ padding:"12px 14px" }}>
                        {agent ? (
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            <div style={{ width:28, height:28, borderRadius:"50%", background:agentColor(agent),
                              display:"flex", alignItems:"center", justifyContent:"center",
                              color:"#fff", fontWeight:700, fontSize:10, flexShrink:0 }}>
                              {agentInitials(agent)}
                            </div>
                            <div>
                              <span style={{ fontSize:12, color:"#334155", fontWeight:500 }}>
                                {agent.split(" ").map((w,i) => i===0 ? w : w[0]+".").join(" ")}
                              </span>
                              <div>
                                {ticket.assignee_manually_updated
                                  ? <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#eff6ff", color:"#2563eb" }}>👤 Manuel</span>
                                  : <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:20, background:"#faf5ff", color:"#7c3aed" }}>🤖 IA</span>
                                }
                              </div>
                            </div>
                          </div>
                        ) : <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>}
                      </td>

                      {/* Catégorie */}
                      <td style={{ padding:"12px 14px" }}>
                        {ticket.category ? (
                          <span style={{ padding:"3px 10px", borderRadius:20, background:"#eff6ff",
                            color:"#1d4ed8", fontSize:11, fontWeight:600 }}>{ticket.category}</span>
                        ) : <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>}
                      </td>

                      {/* Priorité */}
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ padding:"3px 10px", borderRadius:20,
                          background:pri.bg, color:pri.color, fontSize:11, fontWeight:600 }}>
                          {priLabel}
                        </span>
                      </td>

                      {/* Statut */}
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:5,
                          fontSize:12, fontWeight:600, color:sta.color }}>
                          <span style={{ width:7, height:7, borderRadius:"50%", background:sta.dot, display:"inline-block" }} />
                          {sta.label}
                        </span>
                      </td>

                      {/* SLA */}
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px",
                          borderRadius:20, background:sla.bg, color:sla.color }}>
                          {sla.label}
                        </span>
                      </td>

                      {/* Menu */}
                      <td style={{ padding:"12px 10px" }}>
                        <span style={{ color:"#cbd5e1", fontSize:16, letterSpacing:2 }}>•••</span>
                      </td>
                    </tr>
                  );
                  }); })()}
              </tbody>
            </table>

            {/* ── Pagination ── */}
            <div style={{ padding:"14px 20px", borderTop:"1px solid #f1f5f9",
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, color:"#94a3b8" }}>
                Affichage de <strong style={{ color:"#0f172a" }}>{page*perPage+1}-{Math.min((page+1)*perPage, totalAll)}</strong> sur <strong style={{ color:"#0f172a" }}>{totalAll.toLocaleString("fr-FR")}</strong>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={() => setPage(p => Math.max(p-1,0))} disabled={page===0}
                  style={{ width:30, height:30, borderRadius:7, border:"1.5px solid #e8ecf7",
                    background:"#fff", color: page===0?"#cbd5e1":"#334155",
                    cursor:page===0?"not-allowed":"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                {[...Array(Math.min(5, Math.ceil(totalAll/perPage)))].map((_,i) => {
                  const p = page <= 2 ? i : page-2+i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width:30, height:30, borderRadius:7, border:"1.5px solid",
                        borderColor: p===page?"#1E3AAF":"#e8ecf7",
                        background: p===page?"#1E3AAF":"#fff",
                        color: p===page?"#fff":"#64748b",
                        fontWeight: p===page?700:400, fontSize:12,
                        cursor:"pointer", fontFamily:"inherit" }}>
                      {p+1}
                    </button>
                  );
                })}
                {totalAll/perPage > 5 && <span style={{ display:"flex", alignItems:"center", color:"#94a3b8", fontSize:13 }}>...</span>}
                <button onClick={() => setPage(p => p+1)} disabled={!hasMore}
                  style={{ width:30, height:30, borderRadius:7, border:"1.5px solid #e8ecf7",
                    background:"#fff", color:!hasMore?"#cbd5e1":"#334155",
                    cursor:!hasMore?"not-allowed":"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modale ticket ── */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={closeTicketModal}>
          <div className="modal-content ticket-large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Détails du ticket #{selectedTicket.external_id || selectedTicket.ticket_id}</h2>
              <button className="modal-close" onClick={closeTicketModal}>×</button>
            </div>

            <div className="modal-body">
              {detailLoading ? <p>Chargement du détail...</p> : (
                <>
                  {detailError  && <p className="users-error">{detailError}</p>}
                  {saveMessage  && <p className="users-success">{saveMessage}</p>}

                  {/* ✅ Tabs */}
                  <div style={{
                    display: "flex", gap: "2px", marginBottom: "20px",
                    background: "#f1f5f9", borderRadius: "10px", padding: "4px",
                  }}>
                    {TABS.map(tab => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        flex: 1, padding: "7px 8px", borderRadius: "7px", border: "none",
                        cursor: "pointer", fontSize: "12px", fontWeight: "600",
                        transition: "all 0.2s",
                        background: activeTab === tab.id ? "#fff" : "transparent",
                        color:      activeTab === tab.id ? "#0a46d6" : "#64748b",
                        boxShadow:  activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      }}>
                        {tab.icon} {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Tab : Informations ── */}
                  {activeTab === "info" && (
                    <div className="ticket-section">
                      <div className="ticket-detail"><strong>Objet:</strong> {selectedTicket.title}</div>
                      <div className="ticket-detail">
                        <strong>Description:</strong>
                        <div
                          className="ticket-description"
                          dangerouslySetInnerHTML={{
                            __html: selectedTicket.description || "Aucune description disponible.",
                          }}
                        />
                      </div>
                      <div className="ticket-detail"><strong>Demandeur:</strong> {selectedTicket.requester_name || "—"}</div>
                      <div className="ticket-detail"><strong>Attribué à:</strong> {selectedTicket.assignee_name || "—"}</div>
                      <div className="ticket-detail"><strong>Site:</strong> {selectedTicket.site || "—"}</div>
                      <div className="ticket-detail">
                        <strong>Catégorie:</strong>{" "}
                        {selectedTicket.category ? (
                          <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#edf2ff", color: "#0a46d6", fontSize: "12px", fontWeight: "600" }}>
                            {selectedTicket.category}{selectedTicket.subcategory ? ` / ${selectedTicket.subcategory}` : ""}
                          </span>
                        ) : <span style={{ color: "#94a3b8", fontSize: "12px" }}>🤖 En attente IA</span>}
                      </div>
                      <div className="ticket-detail"><strong>Créé le:</strong> {formatDate(selectedTicket.created_at)}</div>
                      <AttachmentsList ticketId={selectedTicket.ticket_id} style={{ border:"none", padding:"10px 0 0" }} />
                    </div>
                  )}

                  {/* ── Tab : Actions ── */}
                  {activeTab === "actions" && (
                    <div className="ticket-section">
                      <div className="ticket-detail">
                        <strong>Modifier le statut:</strong>
                        <select className="users-input" value={statusValue} onChange={e => setStatusValue(e.target.value)}>
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                          <option value="CLOSED">CLOSED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>
                      <div className="ticket-detail">
                        <strong>Modifier la priorité:</strong>
                        <select className="users-input" value={priorityValue} onChange={e => setPriorityValue(e.target.value)}>
                          <option value="Urgente">Urgente</option>
                          <option value="Haute">Haute</option>
                          <option value="Normale">Normale</option>
                          <option value="Moyenne">Moyenne</option>
                          <option value="Faible">Faible</option>
                        </select>
                      </div>
                      <div className="ticket-detail">
                        <strong>Affecter à un agent:</strong>
                        <select className="users-input" value={assigneeUserId} onChange={e => setAssigneeUserId(e.target.value)}>
                          <option value="">Non assigné</option>
                          {assignableUsers.map(u => (
                            <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ marginTop: "20px", display: "flex", gap: "12px", flexWrap:"wrap" }}>
                        <button type="button" className="users-btn users-btn-primary" onClick={handleSaveTicketActions} disabled={saving}>
                          {saving ? "Enregistrement..." : "Enregistrer"}
                        </button>
                        <button type="button" className="users-btn users-btn-soft" onClick={closeTicketModal} disabled={saving}>
                          Annuler
                        </button>
                      </div>

                      {/* Suppression */}
                      <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid #fee2e2" }}>
                        {!deleteConfirm ? (
                          <button type="button" onClick={() => setDeleteConfirm(true)}
                            style={{ padding:"7px 16px", borderRadius:8, border:"1.5px solid #fca5a5", background:"#fff5f5", color:"#dc2626", fontWeight:600, fontSize:12.5, cursor:"pointer" }}>
                            🗑 Supprimer ce ticket
                          </button>
                        ) : (
                          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 16px" }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"#dc2626", marginBottom:10 }}>
                              Confirmer la suppression définitive du ticket #{selectedTicket.ticket_id} ?
                            </div>
                            <div style={{ display:"flex", gap:8 }}>
                              <button type="button" onClick={handleDeleteTicket} disabled={deleting}
                                style={{ padding:"7px 16px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", fontWeight:700, fontSize:12.5, cursor: deleting ? "not-allowed" : "pointer" }}>
                                {deleting ? "Suppression…" : "Oui, supprimer"}
                              </button>
                              <button type="button" onClick={() => setDeleteConfirm(false)}
                                style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #e8ecf7", background:"#fff", color:"#374151", fontWeight:600, fontSize:12.5, cursor:"pointer" }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Tab : IA ── */}
                  {activeTab === "ai" && (
                    <AIPanel
                      ticketId={selectedTicket.ticket_id}
                      onRefreshTicket={async () => {
                        const refreshed = await fetchTicketDetail(selectedTicket.ticket_id);
                        setSelectedTicket(refreshed);
                        setPriorityValue(refreshed.priority_label || "");
                        await loadTickets(); // ✅ AJOUT — rafraîchit le tableau
                      }}
                    />
                  )}

                  {/* ── Tab : Historique ── */}
                  {activeTab === "audit" && (
                    <div className="ticket-section">
                      {auditLoading ? <p>Chargement...</p>
                       : auditError ? <p className="users-error">{auditError}</p>
                       : auditItems.length === 0 ? <p>Aucun historique disponible.</p>
                       : (
                        <div className="ticket-audit-list">
                          {auditItems.map(item => (
                            <div key={item.event_id} className="ticket-audit-item">
                              <div><strong>{formatAuditEventType(item.event_type)}</strong></div>
                              <div className="ticket-audit-meta">Par <strong>{item.author_name || "—"}</strong></div>
                              <div><span>Ancienne valeur : </span><strong>{item.old_value || "—"}</strong></div>
                              <div><span>Nouvelle valeur : </span><strong>{item.new_value || "—"}</strong></div>
                              <div><span>Date : </span><strong>{formatDate(item.created_at)}</strong></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab : Commentaires ── */}
                  {activeTab === "messages" && (
                    <div className="ticket-section">
                      {messagesError  && <p className="users-error">{messagesError}</p>}
                      {messageSuccess && <p className="users-success">{messageSuccess}</p>}
                      <div className="ticket-message-compose">
                        <textarea className="users-input" rows={5}
                          placeholder="Ajouter un commentaire interne..."
                          value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                        <div style={{ marginTop: "10px" }}>
                          <button type="button" className="users-btn users-btn-primary"
                            onClick={handleSendMessage} disabled={sendingMessage}>
                            {sendingMessage ? "Envoi..." : "Envoyer le commentaire"}
                          </button>
                        </div>
                      </div>
                      {messagesLoading ? <p>Chargement des messages...</p>
                       : messageItems.length === 0 ? <p>Aucun commentaire pour ce ticket.</p>
                       : (
                        <div className="ticket-messages-list">
                          {messageItems.map(msg => (
                            <div key={msg.message_id} className="ticket-message-item">
                              <div className="ticket-message-meta">
                                <div>
                                  <strong>{msg.author_name || "—"}</strong>
                                  <div className="ticket-message-submeta">
                                    {msg.is_internal ? "Commentaire interne" : "Message"}
                                  </div>
                                </div>
                                <span>{formatDate(msg.created_at)}</span>
                              </div>
                              <div className="ticket-message-content">{msg.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Créer un ticket ── */}
      {showCreateModal && (() => {
        const currentUser = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "{}");
        const requesterName = currentUser.full_name || currentUser.email || "—";
        return (
        <div style={{ position:"fixed", inset:0, background:"rgba(11,26,82,0.55)", zIndex:200,
          display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => setShowCreateModal(false)}>
          <div style={{ background:"#fff", borderRadius:18, padding:32, width:480,
            boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>

            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:18, color:"#0f172a", marginBottom:4 }}>
              Créer un ticket
            </div>
            <p style={{ fontSize:13, color:"#94a3b8", marginBottom:22 }}>Nouveau ticket interne Helpdesk IA</p>

            {/* Info demandeur auto */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
              background:"#f8fafc", borderRadius:10, marginBottom:14,
              border:"1.5px solid #e8ecf7" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"#1E3AAF",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#fff", fontWeight:700, fontSize:12, flexShrink:0 }}>
                {requesterName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{requesterName}</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>Demandeur · détecté automatiquement</div>
              </div>
            </div>

            <form onSubmit={async e => {
              e.preventDefault();
              try {
                setCreating(true);
                await createTicket({ ...createForm, requester_name: requesterName, priority_label:"Normale" });
                setShowCreateModal(false);
                setCreateForm({ title:"", description:"" });
                await loadTickets();
              } catch(err) { alert(err.message); }
              finally { setCreating(false); }
            }} style={{ display:"flex", flexDirection:"column", gap:12 }}>

              <input name="title" type="text" placeholder="Objet du ticket" required
                value={createForm.title}
                onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
                style={{ width:"100%", height:42, padding:"0 14px", border:"1.5px solid #e8ecf7",
                  borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit" }} />

              <textarea name="description" placeholder="Description du problème..." rows={4}
                value={createForm.description || ""}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                style={{ padding:"10px 14px", border:"1.5px solid #e8ecf7", borderRadius:10,
                  fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical" }} />

              {/* Info priorité auto */}
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
                background:"#eff6ff", borderRadius:10, border:"1.5px solid #bfdbfe" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                <span style={{ fontSize:12, color:"#1d4ed8", fontWeight:600 }}>
                  Priorité définie automatiquement par l'IA après création
                </span>
              </div>

              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button type="submit" disabled={creating}
                  style={{ flex:1, height:44, background:"#1E3AAF", color:"#fff",
                    border:"none", borderRadius:10, fontWeight:700, fontSize:14,
                    cursor:"pointer", fontFamily:"inherit", opacity: creating?0.7:1 }}>
                  {creating ? "Création..." : "Créer le ticket"}
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)}
                  style={{ flex:1, height:44, background:"#f1f5f9", color:"#334155",
                    border:"none", borderRadius:10, fontWeight:600, fontSize:14,
                    cursor:"pointer", fontFamily:"inherit" }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* ── Modal sync logs ── */}
      {showSyncLogsModal && (
        <div className="modal-overlay" onClick={() => setShowSyncLogsModal(false)}>
          <div className="modal-content ticket-large-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Historique des synchronisations</h2>
              <button className="modal-close" onClick={() => setShowSyncLogsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {syncLogsError && <p className="users-error">{syncLogsError}</p>}
              {syncLogsLoading ? <p>Chargement des logs...</p>
               : syncLogs.length === 0 ? <p>Aucun log de synchronisation disponible.</p>
               : (
                <div className="users-table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Type</th><th>Statut</th><th>Récupérés</th>
                        <th>Créés</th><th>Mis à jour</th><th>Ignorés</th><th>Erreurs</th><th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.map(log => (
                        <tr key={log.sync_log_id}>
                          <td>{formatDate(log.timestamp)}</td>
                          <td>{log.type}</td>
                          <td><span className={`users-badge ${normalizeSyncStatusClass(log.status)}`}>{log.status}</span></td>
                          <td>{log.fetched_count}</td><td>{log.created_count}</td>
                          <td>{log.updated_count}</td><td>{log.skipped_count}</td>
                          <td>{log.error_count}</td>
                          <td>{typeof log.message === "string" ? log.message : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const dateStr = value.includes("T") || value.includes("+") || value.includes("Z")
      ? value
      : value.replace(" ", "T");
    return new Date(dateStr).toLocaleString("fr-FR");
  } catch { return value; }
}

function formatAuditEventType(eventType) {
  switch (eventType) {
    case "STATUS_CHANGED":   return "Statut modifié";
    case "PRIORITY_CHANGED": return "Priorité modifiée";
    case "ASSIGNEE_CHANGED": return "Agent assigné modifié";
    default: return eventType || "Événement";
  }
}

function normalizeStatusClass(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s.includes("open"))     return "open";
  if (s.includes("progress")) return "in_progress";
  if (s.includes("resolv"))   return "resolved";
  if (s.includes("clos"))     return "closed";
  return "open";
}

function normalizePriorityClass(priority) {
  const p = String(priority || "").toLowerCase().trim();
  if (p.includes("p1") || p.includes("urgent")) return "p1_urgent";
  if (p.includes("p2") || p.includes("haut") || p.includes("high")) return "p2_high";
  if (p.includes("p3") || p.includes("moy") || p.includes("normal")) return "p3_normal";
  if (p.includes("p4") || p.includes("faible") || p.includes("low")) return "p4_low";
  return "p3_normal";
}

function normalizeSyncStatusClass(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s.includes("success")) return "resolved";
  if (s.includes("partial")) return "in_progress";
  if (s.includes("failed"))  return "closed";
  return "open";
}