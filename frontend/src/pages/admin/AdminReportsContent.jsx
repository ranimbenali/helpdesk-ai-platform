import { useEffect, useState, useCallback } from "react";
import { fetchReports, fetchAdvancedStats, fetchAIStats, fetchTicketClusters, fetchVolumeForecast, fetchAnomalousTickets } from "../../api/tickets";
import { fetchSLAStats } from "../../api/sla";
import {
  Chart as ChartJS,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { exportTicketsListPDF } from "../../utils/pdfExport";

ChartJS.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Filler
);

export default function AdminReportsContent() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  // Stats avancées
  const [advanced, setAdvanced]         = useState(null);
  const [advancedLoading, setAdvancedLoading] = useState(true);

  // Stats IA
  const [aiStats, setAiStats]           = useState(null);
  const [aiStatsLoading, setAiStatsLoading] = useState(true);

  // Clustering thématique
  const [clusters, setClusters]           = useState([]);
  const [clustersLoading, setClustersLoading] = useState(true);

  // Prévision de volume
  const [forecast, setForecast]           = useState(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  // Risque SLA (ML)
  const [slaStats, setSlaStats]           = useState(null);
  const [slaStatsLoading, setSlaStatsLoading] = useState(true);

  // Anomalies (Isolation Forest)
  const [anomalies, setAnomalies]           = useState([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await fetchReports({ dateFrom, dateTo });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Charger les stats avancées une seule fois
  useEffect(() => {
    fetchAdvancedStats()
      .then(setAdvanced)
      .catch(console.error)
      .finally(() => setAdvancedLoading(false));
  }, []);

  // Charger les stats IA une seule fois
  useEffect(() => {
    fetchAIStats()
      .then(setAiStats)
      .catch(console.error)
      .finally(() => setAiStatsLoading(false));
  }, []);

  // Charger les clusters thématiques une seule fois
  useEffect(() => {
    fetchTicketClusters()
      .then(setClusters)
      .catch(console.error)
      .finally(() => setClustersLoading(false));
  }, []);

  // Charger la prévision de volume une seule fois
  useEffect(() => {
    fetchVolumeForecast()
      .then(setForecast)
      .catch(console.error)
      .finally(() => setForecastLoading(false));
  }, []);

  // Charger les stats de risque SLA une seule fois
  useEffect(() => {
    fetchSLAStats()
      .then(setSlaStats)
      .catch(console.error)
      .finally(() => setSlaStatsLoading(false));
  }, []);

  // Charger les anomalies une seule fois
  useEffect(() => {
    fetchAnomalousTickets()
      .then(setAnomalies)
      .catch(console.error)
      .finally(() => setAnomaliesLoading(false));
  }, []);

  function exportCSV() {
    if (!data?.tickets?.length) return;

    const headers = ["ID", "Titre", "Demandeur", "Agent", "Site", "Groupe", "Priorité", "Statut", "Créé le", "Résolu le"];
    const rows = data.tickets.map((t) => [
      t.id, `"${t.title}"`, t.requester, t.assignee,
      t.site, t.group, t.priority, t.status, t.created_at, t.resolved_at,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `rapport_tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Données graphiques existants ──
  const statusColors = {
    OPEN: "#1e88e5", IN_PROGRESS: "#fb8c00",
    RESOLVED: "#43a047", CLOSED: "#7c3aed", CANCELLED: "#e53935",
  };

  const byStatus   = data?.by_status   ?? {};
  const byPriorityRaw = data?.by_priority ?? {};
  const byPriority = Object.fromEntries(
    Object.entries(byPriorityRaw).filter(([k]) => k && k !== "null" && k !== "Non défini")
  );
  const bySite     = data?.by_site     ?? {};
  const byAgent    = data?.by_agent    ?? {};

  const statusChart = {
    labels: Object.keys(byStatus),
    datasets: [{
      data: Object.values(byStatus),
      backgroundColor: Object.keys(byStatus).map((s) => statusColors[s] ?? "#94a3b8"),
      borderWidth: 2, borderColor: "#fff",
    }],
  };

  const AI_PRIO_ORDER = ["Urgente","Haute","Normale","Faible"];
  const AI_PRIO_COLORS = { Urgente:"#dc2626", Haute:"#ea580c", Normale:"#1e88e5", Faible:"#43a047" };
  const aiByPriority = aiStats?.by_priority ?? {};
  const priorityChart = {
    labels: AI_PRIO_ORDER.filter(k => aiByPriority[k] != null),
    datasets: [{
      label: "Tickets",
      data: AI_PRIO_ORDER.filter(k => aiByPriority[k] != null).map(k => aiByPriority[k]),
      backgroundColor: AI_PRIO_ORDER.filter(k => aiByPriority[k] != null).map(k => AI_PRIO_COLORS[k]),
      borderRadius: 8, borderSkipped: false,
    }],
  };

  const CLUSTER_COLORS = ["#0891b2", "#7c3aed", "#ea580c", "#16a34a", "#dc2626", "#854d0e"];
  const clusterChart = {
    labels: clusters.map(c => `Cluster ${c.cluster_id}`),
    datasets: [{
      label: "Tickets",
      data: clusters.map(c => c.count),
      backgroundColor: clusters.map((_, i) => CLUSTER_COLORS[i % CLUSTER_COLORS.length]),
      borderRadius: 6, borderSkipped: false,
    }],
  };

  const forecastHistory = forecast?.history ?? [];
  const forecastFuture  = forecast?.forecast ?? [];
  const forecastLabels  = [...forecastHistory.map(h => h.date), ...forecastFuture.map(f => f.date)];
  const forecastChart = {
    labels: forecastLabels,
    datasets: [
      {
        label: "Réel",
        data: [...forecastHistory.map(h => h.actual), ...forecastFuture.map(() => null)],
        borderColor: "#534AB7",
        backgroundColor: "#534AB7",
        pointRadius: 2,
        borderWidth: 1.5,
        spanGaps: false,
      },
      {
        label: "Prévision",
        data: [...forecastHistory.map(() => null), ...forecastFuture.map(f => f.yhat)],
        borderColor: "#1D9E75",
        backgroundColor: "#1D9E75",
        borderDash: [5, 4],
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: "Intervalle haut",
        data: [...forecastHistory.map(() => null), ...forecastFuture.map(f => f.yhat_upper)],
        borderColor: "transparent",
        backgroundColor: "rgba(29,158,117,0.12)",
        pointRadius: 0,
        fill: "+1",
      },
      {
        label: "Intervalle bas",
        data: [...forecastHistory.map(() => null), ...forecastFuture.map(f => f.yhat_lower)],
        borderColor: "transparent",
        backgroundColor: "rgba(29,158,117,0.12)",
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  // Répartition risque SLA (respectés / à risque / dépassés)
  const slaRespected = Math.max(0, (slaStats?.total ?? 0) - (slaStats?.breached_resolve ?? 0) - (slaStats?.at_risk ?? 0));
  const slaRiskChart = {
    labels: ["Respectés", "À risque", "Dépassés"],
    datasets: [{
      data: [slaRespected, slaStats?.at_risk ?? 0, slaStats?.breached_resolve ?? 0],
      backgroundColor: ["#16a34a", "#f59e0b", "#dc2626"],
      borderWidth: 2, borderColor: "#fff",
    }],
  };

  // Anomalies par catégorie
  const anomalyByCategory = {};
  anomalies.forEach(a => {
    const cat = a.category || "Non classé";
    anomalyByCategory[cat] = (anomalyByCategory[cat] || 0) + 1;
  });
  const anomalyCatEntries = Object.entries(anomalyByCategory).sort((a, b) => b[1] - a[1]);
  const anomalyChart = {
    labels: anomalyCatEntries.map(([cat]) => cat),
    datasets: [{
      label: "Tickets atypiques",
      data: anomalyCatEntries.map(([, count]) => count),
      backgroundColor: "#7c3aed",
      borderRadius: 6, borderSkipped: false,
    }],
  };

  const siteChart = {
    labels: Object.keys(bySite),
    datasets: [{
      label: "Tickets",
      data: Object.values(bySite),
      backgroundColor: "#0a46d6",
      borderRadius: 6, borderSkipped: false,
    }],
  };

  const agentChart = {
    labels: Object.keys(byAgent),
    datasets: [{
      label: "Tickets",
      data: Object.values(byAgent),
      backgroundColor: "#6c63ff",
      borderRadius: 6, borderSkipped: false,
    }],
  };

  // ── Données graphiques avancés ──
  const monthlyData = {
    labels: (advanced?.monthly || []).map((m) => m.label),
    datasets: [
      {
        label: "Créés",
        data: (advanced?.monthly || []).map((m) => m.created),
        borderColor: "#0a46d6",
        backgroundColor: "rgba(10,70,214,0.08)",
        tension: 0.4, fill: true, pointRadius: 4,
        pointBackgroundColor: "#0a46d6",
      },
      {
        label: "Résolus",
        data: (advanced?.monthly || []).map((m) => m.resolved),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        tension: 0.4, fill: true, pointRadius: 4,
        pointBackgroundColor: "#22c55e",
      },
    ],
  };

  const avgResolutionData = {
    labels: (advanced?.avg_resolution || []).map((a) => a.priority),
    datasets: [{
      label: "Heures",
      data: (advanced?.avg_resolution || []).map((a) => a.avg_hours),
      backgroundColor: "#fb8c00",
      borderRadius: 6, borderSkipped: false,
    }],
  };

  const groupData = {
    labels: (advanced?.by_group || []).map((g) => g.group),
    datasets: [{
      data: (advanced?.by_group || []).map((g) => g.count),
      backgroundColor: [
        "#0a46d6","#6c63ff","#22c55e","#fb8c00",
        "#e53935","#1e88e5","#43a047","#7c3aed",
        "#f59e0b","#10b981",
      ],
      borderWidth: 2, borderColor: "#fff",
    }],
  };

  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  const barOptsH = {
    ...barOpts,
    indexAxis: "y",
    scales: {
      x: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  const pieOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: "right", labels: { font: { size: 11 }, padding: 10 } } },
  };

  const lineOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "top" } },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  const forecastOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, position: "top",
        labels: { filter: (item) => !item.text.startsWith("Intervalle") },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 14 } },
    },
  };

  return (
    <div className="adm-body">
      {error && <p className="users-error">{error}</p>}

      {/* ── Filtres ── */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div className="section-title" style={{ marginBottom: "6px" }}>Date début</div>
            <input
              type="date" className="users-input" style={{ width: "180px" }}
              value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <div className="section-title" style={{ marginBottom: "6px" }}>Date fin</div>
            <input
              type="date" className="users-input" style={{ width: "180px" }}
              value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button className="users-btn users-btn-soft" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Réinitialiser
          </button>
          <button className="users-btn users-btn-primary" onClick={exportCSV} disabled={!data?.tickets?.length}>
            ⬇ Exporter CSV
          </button>
          <button
            className="users-btn users-btn-soft"
            onClick={() => exportTicketsListPDF(data?.tickets || [], { dateFrom, dateTo })}
            disabled={!data?.tickets?.length}
          >
            📄 Exporter PDF
          </button>
          <div style={{ marginLeft: "auto" }}>
            <div className="section-title" style={{ marginBottom: "6px" }}>Total période</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#0a46d6" }}>
              {loading ? "..." : data?.total ?? 0}
              <span style={{ fontSize: "13px", color: "#888", marginLeft: "8px", fontWeight: "500" }}>
                tickets
              </span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", padding: "40px", color: "#888" }}>Chargement...</p>
      ) : (
        <>
          {/* ── Graphiques ligne 1 : statut + priorité ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Répartition par statut</h3>
              </div>
              <div style={{ height: "220px", marginTop: "8px" }}>
                <Doughnut data={statusChart} options={pieOpts} />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Répartition par priorité</h3>
              </div>
              <div style={{ height: "220px", marginTop: "8px" }}>
                <Bar data={priorityChart} options={barOpts} />
              </div>
            </div>
          </div>

          {/* ── Graphiques ligne 2 : sites + agents ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Top 10 sites</h3>
              </div>
              <div style={{ height: "220px", marginTop: "8px" }}>
                <Bar data={siteChart} options={barOptsH} />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Top 10 agents</h3>
              </div>
              <div style={{ height: "220px", marginTop: "8px" }}>
                <Bar data={agentChart} options={barOptsH} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════
          STATS AVANCÉES
      ════════════════════════════════ */}

      {/* ── Évolution mensuelle créés vs résolus ── */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-head">
          <h3 className="card-title">📈 Évolution mensuelle — Créés vs Résolus (12 mois)</h3>
        </div>
        {advancedLoading ? (
          <p style={{ color: "#888" }}>Chargement...</p>
        ) : (
          <div style={{ height: "260px", marginTop: "8px" }}>
            <Line data={monthlyData} options={lineOpts} />
          </div>
        )}
      </div>

      {/* ════════════════════════════════
          ANALYTICS IA
      ════════════════════════════════ */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <span style={{ fontSize:20 }}>⚡</span>
          <h2 style={{ fontSize:17, fontWeight:800, color:"#0f172a", margin:0 }}>Analytics IA — Service de classification automatique</h2>
          <span style={{ fontSize:12, background:"#6366f1", color:"#fff", borderRadius:20, padding:"2px 10px", fontWeight:600 }}>
            TF-IDF + LinearSVC
          </span>
          <a href="http://localhost:5601/app/dashboards#/view/e859647e-89c3-4688-9f89-cccc6c3a900e" target="_blank" rel="noopener noreferrer"
            style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:12.5, fontWeight:600, color:"#0891b2", textDecoration:"none", padding:"5px 12px", border:"1.5px solid #cffafe", borderRadius:8, background:"#ecfeff" }}>
            Ouvrir le dashboard Kibana ↗
          </a>
        </div>
        <p style={{ fontSize:11.5, color:"#94a3b8", marginTop:-14, marginBottom:20 }}>
          Les classifications IA sont synchronisées automatiquement vers Elasticsearch toutes les 5 minutes pour exploration dans Kibana.
        </p>

        {aiStatsLoading ? (
          <p style={{ color:"#888", padding:"20px 0" }}>Chargement des stats IA…</p>
        ) : !aiStats ? (
          <p style={{ color:"#94a3b8" }}>Stats IA non disponibles.</p>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
              {[
                { label:"Tickets classifiés",     value: aiStats.total_classified,                 sub:`/ ${aiStats.total_tickets} total`,       color:"#2563eb", bg:"#eff6ff" },
                { label:"Taux de classification", value:`${aiStats.classification_rate ?? 0} %`,   sub:"tickets classifiés automatiquement",      color:"#16a34a", bg:"#f0fdf4" },
                { label:"Confiance moyenne",      value:`${aiStats.avg_confidence ?? 0} %`,        sub:"score moyen du modèle ML",                color:"#7c3aed", bg:"#faf5ff" },
              ].map(kpi => (
                <div key={kpi.label} className="card" style={{ padding:"16px 20px", background:kpi.bg, border:"none" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:kpi.color, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>{kpi.label}</div>
                  <div style={{ fontSize:26, fontWeight:800, color:"#0f172a", lineHeight:1 }}>{kpi.value}</div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Top catégories prédites — pleine largeur */}
            <div className="card" style={{ marginBottom:24 }}>
              <div className="card-head">
                <h3 className="card-title">Top catégories prédites par le modèle</h3>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:12 }}>
                {(aiStats.by_category ?? []).slice(0, 7).map((c, i) => {
                  const maxCount = aiStats.by_category?.[0]?.count || 1;
                  const pct      = Math.round(c.count / maxCount * 100);
                  const catColors = ["#2563eb","#7c3aed","#16a34a","#ea580c","#0891b2","#dc2626","#854d0e"];
                  const col       = catColors[i % catColors.length];
                  return (
                    <div key={c.category} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11.5, color:"#374151", minWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.category}</span>
                      <div style={{ flex:1, height:7, background:"#f1f5f9", borderRadius:3 }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:col, borderRadius:3 }} />
                      </div>
                      <span style={{ fontSize:11.5, fontWeight:700, color:"#0f172a", width:40, textAlign:"right", flexShrink:0 }}>{c.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Répartition priorités prédites par l'IA */}
            <div className="card" style={{ marginBottom:24 }}>
              <div className="card-head">
                <h3 className="card-title">Répartition des priorités prédites par l'IA</h3>
              </div>
              <div style={{ display:"flex", gap:16, marginTop:12, flexWrap:"wrap" }}>
                {[
                  { key:"Urgente", label:"Urgente", color:"#dc2626", bg:"#fef2f2" },
                  { key:"Haute",   label:"Haute",   color:"#ea580c", bg:"#fff7ed" },
                  { key:"Normale", label:"Normale", color:"#16a34a", bg:"#f0fdf4" },
                  { key:"Faible",  label:"Faible",  color:"#64748b", bg:"#f8fafc" },
                ].map(p => {
                  const count = aiStats.by_priority?.[p.key] ?? 0;
                  return (
                    <div key={p.key} style={{ flex:"1 1 120px", background:p.bg, borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:p.color, marginBottom:6 }}>{p.label}</div>
                      <div style={{ fontSize:28, fontWeight:800, color:"#0f172a" }}>{count}</div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>tickets</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════
          RISQUE SLA (Gradient Boosting)
      ════════════════════════════════ */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <span style={{ fontSize:20 }}>⏱️</span>
          <h2 style={{ fontSize:17, fontWeight:800, color:"#0f172a", margin:0 }}>Risque de dépassement SLA</h2>
          <span style={{ fontSize:12, background:"#f59e0b", color:"#fff", borderRadius:20, padding:"2px 10px", fontWeight:600 }}>
            Gradient Boosting
          </span>
        </div>
        <p style={{ fontSize:12.5, color:"#94a3b8", marginTop:0, marginBottom:20, maxWidth:700 }}>
          Score de risque prédit par IA à partir du texte du ticket, calculé automatiquement à la création.
          Les tickets historiques déjà fermés avant l'ajout de cette fonctionnalité n'ont pas de score.
        </p>

        {slaStatsLoading ? (
          <p style={{ color:"#888", padding:"20px 0" }}>Chargement…</p>
        ) : !slaStats ? (
          <p style={{ color:"#94a3b8" }}>Statistiques SLA non disponibles.</p>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Répartition des tickets SLA</h3>
              </div>
              <div style={{ height:"220px", marginTop:"8px" }}>
                <Doughnut data={slaRiskChart} options={pieOpts} />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Vue d'ensemble</h3>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:16 }}>
                {[
                  { label:"Total suivis", value: slaStats.total, color:"#0f172a", bg:"#f8fafc" },
                  { label:"Taux respecté", value:`${slaStats.rate}%`, color:"#16a34a", bg:"#f0fdf4" },
                  { label:"À risque", value: slaStats.at_risk, color:"#f59e0b", bg:"#fffbeb" },
                  { label:"Dépassés", value: slaStats.breached_resolve, color:"#dc2626", bg:"#fef2f2" },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background:kpi.bg, borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ fontSize:10.5, fontWeight:700, color:kpi.color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{kpi.label}</div>
                    <div style={{ fontSize:22, fontWeight:800, color:"#0f172a" }}>{kpi.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════
          ANOMALIES (Isolation Forest)
      ════════════════════════════════ */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <span style={{ fontSize:20 }}>🎯</span>
          <h2 style={{ fontSize:17, fontWeight:800, color:"#0f172a", margin:0 }}>Tickets atypiques</h2>
          <span style={{ fontSize:12, background:"#7c3aed", color:"#fff", borderRadius:20, padding:"2px 10px", fontWeight:600 }}>
            Isolation Forest
          </span>
        </div>
        <p style={{ fontSize:12.5, color:"#94a3b8", marginTop:0, marginBottom:20, maxWidth:700 }}>
          Tickets détectés comme inhabituels par rapport à l'historique — à passer en revue, pas nécessairement urgents.
        </p>

        {anomaliesLoading ? (
          <p style={{ color:"#888", padding:"20px 0" }}>Chargement…</p>
        ) : anomalies.length === 0 ? (
          <p style={{ color:"#94a3b8" }}>Aucun ticket atypique détecté actuellement.</p>
        ) : (
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Anomalies par catégorie ({anomalies.length} au total)</h3>
            </div>
            <div style={{ height:"220px", marginTop:"8px" }}>
              <Bar data={anomalyChart} options={barOptsH} />
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════
          CLUSTERING THÉMATIQUE (KMeans)
      ════════════════════════════════ */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <span style={{ fontSize:20 }}>🔍</span>
          <h2 style={{ fontSize:17, fontWeight:800, color:"#0f172a", margin:0 }}>Thèmes récurrents — Clustering</h2>
          <span style={{ fontSize:12, background:"#0891b2", color:"#fff", borderRadius:20, padding:"2px 10px", fontWeight:600 }}>
            KMeans
          </span>
        </div>
        <p style={{ fontSize:12.5, color:"#94a3b8", marginTop:0, marginBottom:20, maxWidth:700 }}>
          Regroupement des tickets par similarité de texte (K=3, déterminé par la méthode Elbow).
          Limite connue : seul un cluster sur trois correspond à un vrai thème métier cohérent —
          les autres captent surtout des formules de politesse ou signatures d'email répétées.
        </p>

        {clustersLoading ? (
          <p style={{ color:"#888", padding:"20px 0" }}>Chargement des clusters…</p>
        ) : clusters.length === 0 ? (
          <p style={{ color:"#94a3b8" }}>Clustering non disponible.</p>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Répartition par cluster</h3>
              </div>
              <div style={{ height:"220px", marginTop:"8px" }}>
                <Bar data={clusterChart} options={barOpts} />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3 className="card-title">Mots-clés par cluster</h3>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:12 }}>
                {clusters.map((c, i) => (
                  <div key={c.cluster_id} style={{ padding:"10px 14px", background:"#f8fafc", borderRadius:10, borderLeft:`3px solid ${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}` }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#0f172a", marginBottom:4 }}>
                      Cluster {c.cluster_id} · {c.count} ticket{c.count > 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize:11.5, color:"#64748b" }}>
                      {c.keywords.join(", ") || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════
          PRÉVISION DE VOLUME (Prophet)
      ════════════════════════════════ */}
      <div style={{ marginTop: "32px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <span style={{ fontSize:20 }}>📈</span>
          <h2 style={{ fontSize:17, fontWeight:800, color:"#0f172a", margin:0 }}>Prévision du volume de tickets</h2>
          <span style={{ fontSize:12, background:"#1D9E75", color:"#fff", borderRadius:20, padding:"2px 10px", fontWeight:600 }}>
            Prophet
          </span>
        </div>
        <p style={{ fontSize:12.5, color:"#94a3b8", marginTop:0, marginBottom:20, maxWidth:700 }}>
          Entraîné à la demande sur l'historique réel des tickets (saisonnalités hebdomadaire et annuelle), mis en cache 1h.
        </p>

        {forecastLoading ? (
          <p style={{ color:"#888", padding:"20px 0" }}>Chargement de la prévision…</p>
        ) : !forecast?.available ? (
          <p style={{ color:"#94a3b8" }}>Prévision non disponible (historique insuffisant).</p>
        ) : (
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">Tickets créés par jour — 30 prochains jours</h3>
            </div>
            <div style={{ height:"320px", marginTop:"8px" }}>
              <Line data={forecastChart} options={forecastOpts} />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}