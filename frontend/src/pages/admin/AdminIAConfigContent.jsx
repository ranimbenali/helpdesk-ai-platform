import { useEffect, useState } from "react";
import { API_BASE } from '../../api/config.js';
import {
  Chart as ChartJS,
  LineElement, PointElement, CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

const PRIORITY_COLORS = {
  Urgente:"#dc2626", Haute:"#ea580c", Normale:"#2563eb",
  Moyenne:"#7c3aed", Basse:"#16a34a", Faible:"#16a34a",
};

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", overflow:"hidden" };

export default function AdminIAConfigContent() {
  const [aiStats, setAiStats]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [confidenceHistory, setConfidenceHistory] = useState([]);
  const [testTitle, setTestTitle]   = useState("");
  const [testDesc, setTestDesc]     = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting]       = useState(false);
  const [aiConfig, setAiConfig]     = useState(null);
  const [showKey, setShowKey]       = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [bulkMsg, setBulkMsg]       = useState("");
  const [threshold, setThreshold]         = useState(null);
  const [autoAssign, setAutoAssign]       = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdMsg, setThresholdMsg]       = useState("");

  const loadStats = () => {
    const h = { Authorization:`Bearer ${getToken()}` };
    fetch(`${API_BASE}/ai/stats`,  { headers: h }).then(r => r.json()).then(setAiStats).catch(() => {}).finally(() => setLoading(false));
    fetch(`${API_BASE}/ai/confidence-history`, { headers: h }).then(r => r.json())
      .then(d => setConfidenceHistory(d?.history || [])).catch(() => {});
    fetch(`${API_BASE}/ai/config`, { headers: h }).then(r => r.json()).then(setAiConfig).catch(() => {});
    fetch(`${API_BASE}/settings/`, { headers: h }).then(r => r.json()).then(d => {
      if (d?.ai_confidence_threshold != null) setThreshold(Math.round(d.ai_confidence_threshold * 100));
      if (d?.ai_auto_assign != null) setAutoAssign(d.ai_auto_assign);
    }).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  async function handleSaveThreshold() {
    if (threshold == null) return;
    setSavingThreshold(true); setThresholdMsg("");
    try {
      const res = await fetch(`${API_BASE}/settings/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ai_confidence_threshold: threshold / 100, ai_auto_assign: autoAssign }),
      });
      if (res.ok) setThresholdMsg("Paramètres sauvegardés ✓");
      else setThresholdMsg("Erreur lors de la sauvegarde");
    } catch { setThresholdMsg("Erreur réseau"); }
    finally { setSavingThreshold(false); setTimeout(() => setThresholdMsg(""), 3000); }
  }


  async function handleBulkAnalyze() {
    try {
      setAnalyzing(true); setBulkMsg("");
      const res = await fetch(`${API_BASE}/ai/analyze-all`, {
        method:"POST",
        headers:{ Authorization:`Bearer ${getToken()}` },
      });
      const data = await res.json().catch(()=>({}));
      setBulkMsg(data.message || `${data.analyzed ?? 0} tickets analysés`);
    } catch(e) { setBulkMsg("Erreur : " + e.message); }
    finally { setAnalyzing(false); }
  }

  async function handleTestClassify() {
    if (!testTitle.trim()) return;
    try {
      setTesting(true); setTestResult(null);
      const res = await fetch(`${API_BASE}/ai/classify-test`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify({ title: testTitle, description: testDesc }),
      });
      const data = await res.json().catch(()=>({}));
      setTestResult(data);
    } catch(e) { setTestResult({ error: e.message }); }
    finally { setTesting(false); }
  }

  const categories = aiStats?.by_category || [];
  const priorities  = aiStats?.by_priority ? Object.entries(aiStats.by_priority) : [];

  const confidenceChartData = {
    labels: confidenceHistory.map(h => h.date),
    datasets: [{
      label: "Confiance moyenne (%)",
      data: confidenceHistory.map(h => h.avg_confidence),
      borderColor: "#22D3A0",
      backgroundColor: "rgba(34,211,160,0.12)",
      pointBackgroundColor: "#22D3A0",
      tension: 0.3,
      fill: true,
    }],
  };
  const confidenceChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const h = confidenceHistory[ctx.dataIndex];
            return `${ctx.parsed.y}% de confiance moyenne (${h?.count ?? 0} classifications)`;
          },
        },
      },
    },
    scales: {
      y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
    },
  };

  return (
    <div className="adm-body">

      {/* ── KPI IA ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:20 }}>
        {[
          { label:"TICKETS ANALYSÉS",  value: loading?"...": aiStats?.total_classified ?? "—",    color:"#2B45C8" },
          { label:"CONFIANCE MOYENNE", value: loading?"...": aiStats?.avg_confidence != null ? `${aiStats.avg_confidence}%`:"—", color:"#22D3A0", valueColor:"#22D3A0",
            sub: "ML (mathématique) + LLM (auto-estimée)" },
          { label:"APPROCHE",          value: "ML + LLM",  color:"#8B5CF6", valueColor:"#8B5CF6",
            sub: `ML local → fallback Groq si conf. < ${threshold ?? "…"}%` },
        ].map((k,i) => (
          <div key={i} style={{ ...card, padding:"18px 20px", borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, fontWeight:600,
              color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:28, fontWeight:800,
              color:k.valueColor||"#0f172a", lineHeight:1 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:10, color:"#94a3b8", marginTop:4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

        {/* ── Test classification ── */}
        <div style={{ ...card, padding:24, gridColumn:"1 / -1" }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:15,
            color:"#0f172a", marginBottom:4 }}>Tester la classification</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>
            Testez comment l'IA classerait un ticket en temps réel.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <input type="text" placeholder="Titre du ticket..." value={testTitle}
              onChange={e=>setTestTitle(e.target.value)}
              style={{ height:40, padding:"0 12px", border:"1.5px solid #e8ecf7",
                borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit" }} />
            <textarea placeholder="Description (optionnel)..." value={testDesc}
              onChange={e=>setTestDesc(e.target.value)} rows={2}
              style={{ padding:"8px 12px", border:"1.5px solid #e8ecf7",
                borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", resize:"none" }} />
            <button onClick={handleTestClassify} disabled={testing||!testTitle.trim()}
              style={{ height:40, background:testing||!testTitle.trim()?"#f1f5f9":"#1E3AAF",
                color:testing||!testTitle.trim()?"#94a3b8":"#fff",
                border:"none", borderRadius:10, fontWeight:700, fontSize:13,
                cursor:testing||!testTitle.trim()?"not-allowed":"pointer", fontFamily:"inherit" }}>
              {testing ? "Analyse..." : "Classifier"}
            </button>
          </div>
          {testResult && (
            <div style={{ marginTop:14, padding:14, background:"#f8fafc",
              borderRadius:10, border:"1px solid #e8ecf7" }}>
              {testResult.error ? (
                <div style={{ color:"#e53935", fontSize:12 }}>❌ {testResult.error}</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { label:"Catégorie",      value: testResult.category    || "—", color:"#2563eb" },
                    { label:"Sous-catégorie", value: testResult.subcategory || "—", color:"#64748b" },
                    { label:"Priorité",       value: testResult.priority    || "—", color: PRIORITY_COLORS[testResult.priority]||"#64748b" },
                    { label:"Confiance",      value: testResult.confidence  != null ? `${Math.round(testResult.confidence*100)}%`:"—", color:"#22D3A0" },
                  ].map(r => (
                    <div key={r.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace",
                        fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                        {r.label}
                      </span>
                      <span style={{ fontSize:13, fontWeight:700, color:r.color }}>{r.value}</span>
                    </div>
                  ))}
                  {/* Badge modèle utilisé */}
                  <div style={{ marginTop:4, display:"flex", justifyContent:"flex-end" }}>
                    <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:10,
                      background: testResult.used_llm_fallback ? "#f5f3ff" : "#eff6ff",
                      color:      testResult.used_llm_fallback ? "#7c3aed" : "#2563eb" }}>
                      {testResult.used_llm_fallback ? "🧠 LLM Groq (fallback)" : "⚡ ML local"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Seuil de confiance ── */}
        <div style={{ ...card, padding:24, gridColumn:"1 / -1" }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#0f172a", marginBottom:4 }}>
            Seuil de confiance ML
          </div>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>
            En dessous de ce seuil, le modèle ML passe la main au LLM Groq (fallback).
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
            <input type="range" min={10} max={95} step={5}
              value={threshold ?? 75}
              onChange={e => setThreshold(+e.target.value)}
              style={{ flex:1, minWidth:200, accentColor:"#2B45C8" }} />
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:22, fontWeight:800,
              color:"#2B45C8", minWidth:52 }}>
              {threshold ?? 75}%
            </span>
            <div style={{ fontSize:11, color:"#64748b", flex:1 }}>
              {(threshold ?? 75) <= 40 ? "⚡ Favorise le ML local (rapide, offline)"
               : (threshold ?? 75) >= 75 ? "🧠 Favorise le LLM Groq (plus précis sur cas complexes)"
               : "⚖️ Équilibre ML / LLM"}
            </div>
            <button onClick={handleSaveThreshold} disabled={savingThreshold}
              style={{ height:38, padding:"0 20px", background:"#1E3AAF", color:"#fff",
                border:"none", borderRadius:10, fontWeight:700, fontSize:13,
                cursor: savingThreshold ? "not-allowed" : "pointer", opacity: savingThreshold ? 0.7 : 1 }}>
              {savingThreshold ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
          {/* ── Auto-assignation ── */}
          <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid #f1f5f9" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:"#0f172a" }}>Auto-assignation IA</div>
                <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>
                  Si activée, chaque nouveau ticket est automatiquement assigné au meilleur agent disponible
                  (expertise catégorie × 2 − charge actuelle), dès que la confiance IA ≥ seuil.
                </div>
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", flexShrink:0 }}>
                <div style={{
                  position:"relative", width:44, height:24,
                  background: autoAssign ? "#7c3aed" : "#cbd5e1",
                  borderRadius:12, transition:"background 0.2s",
                }}>
                  <input type="checkbox" checked={autoAssign} onChange={e => setAutoAssign(e.target.checked)}
                    style={{ opacity:0, position:"absolute", width:"100%", height:"100%", cursor:"pointer", margin:0 }} />
                  <div style={{
                    position:"absolute", top:3,
                    left: autoAssign ? 23 : 3,
                    width:18, height:18, background:"#fff", borderRadius:"50%",
                    transition:"left 0.2s", pointerEvents:"none",
                  }} />
                </div>
                <span style={{ fontSize:13, fontWeight:600, color: autoAssign ? "#7c3aed" : "#94a3b8" }}>
                  {autoAssign ? "Activée" : "Désactivée"}
                </span>
              </label>
            </div>
            {autoAssign && (
              <div style={{ marginTop:10, padding:"8px 12px", background:"#faf5ff", borderRadius:8,
                border:"1px solid #e9d5ff", fontSize:12, color:"#7c3aed" }}>
                🤖 Les nouveaux tickets seront assignés automatiquement. Le superviseur peut toujours réassigner manuellement.
              </div>
            )}
          </div>

          {thresholdMsg && (
            <div style={{ marginTop:10, fontSize:12, fontWeight:600,
              color: thresholdMsg.includes("✓") ? "#16a34a" : "#dc2626" }}>
              {thresholdMsg}
            </div>
          )}
          <div style={{ marginTop:12, padding:"10px 14px", background:"#fffbeb",
            borderRadius:8, border:"1px solid #fde68a", fontSize:12, color:"#92400e" }}>
            ⚠️ Ce seuil s'applique uniquement aux <strong>nouveaux tickets</strong>.
            Les tickets déjà analysés conservent leur classification. Pour les reclassifier,
            utilisez le bouton <strong>"Trier par IA"</strong> dans la vue tickets.
          </div>
        </div>

        {/* ── Monitoring — confiance dans le temps ── */}
        <div style={{ ...card, padding:24, gridColumn:"1 / -1" }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:15,
            color:"#0f172a", marginBottom:4 }}>Monitoring — confiance moyenne dans le temps</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>
            Suivi de la confiance moyenne des classifications IA par jour — permet de repérer une dérive
            du modèle avant qu'elle ne devienne un problème.
          </div>
          {loading ? (
            <div style={{ color:"#94a3b8", fontSize:12 }}>Chargement…</div>
          ) : confidenceHistory.length === 0 ? (
            <div style={{ color:"#94a3b8", fontSize:12 }}>Pas encore assez de données pour afficher une tendance.</div>
          ) : (
            <div style={{ height:260 }}>
              <Line data={confidenceChartData} options={confidenceChartOptions} />
            </div>
          )}
        </div>

        {/* ── Catégories IA ── */}
        <div style={{ ...card, padding:24 }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:15,
            color:"#0f172a", marginBottom:4 }}>Catégories reconnues</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:16 }}>
            Catégories détectées par le modèle de classification.
          </div>
          {loading ? (
            <div style={{ color:"#94a3b8", fontSize:12 }}>Chargement…</div>
          ) : categories.length === 0 ? (
            <div style={{ color:"#94a3b8", fontSize:12 }}>Aucune catégorie détectée</div>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {categories.map(({ category, count }) => (
                <span key={category} title={`${count} tickets`}
                  style={{ display:"inline-flex", alignItems:"center", gap:5,
                    padding:"5px 12px", borderRadius:20,
                    background:"#eff6ff", color:"#1d4ed8", fontSize:12, fontWeight:600 }}>
                  {category}
                  <span style={{ background:"#bfdbfe", color:"#1e40af",
                    borderRadius:10, padding:"0 6px", fontSize:10, fontWeight:700 }}>
                    {count}
                  </span>
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f1f5f9" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600,
              color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>
              Priorités
            </div>
            {loading ? (
              <div style={{ color:"#94a3b8", fontSize:12 }}>Chargement…</div>
            ) : priorities.length === 0 ? (
              <div style={{ color:"#94a3b8", fontSize:12 }}>Aucune priorité détectée</div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {priorities.map(([p, count]) => {
                  const pLow = p || "";
                  const bg = pLow.toLowerCase().includes("urgent") ? "#fee2e2"
                    : pLow.toLowerCase().includes("haut") ? "#ffedd5"
                    : pLow.toLowerCase().includes("norm") ? "#eff6ff"
                    : pLow.toLowerCase().includes("moyen") ? "#f5f3ff"
                    : "#f0fdf4";
                  return (
                    <span key={p} title={`${count} tickets`}
                      style={{ display:"inline-flex", alignItems:"center", gap:5,
                        padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600,
                        background: bg, color: PRIORITY_COLORS[p] || "#64748b" }}>
                      {p}
                      <span style={{ background:"rgba(0,0,0,0.08)",
                        borderRadius:10, padding:"0 6px", fontSize:10, fontWeight:700 }}>
                        {count}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Clé API Groq ── */}
        <div style={{ ...card, padding:24 }}>
          <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700, fontSize:15,
            color:"#0f172a", marginBottom:4 }}>Configuration API</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:20 }}>
            Paramètres du service IA (Groq LLM).
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Groq Key */}
            <div>
              <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                GROQ API KEY
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ flex:1, height:40, padding:"0 14px",
                  border:"1.5px solid #e8ecf7", borderRadius:10,
                  background:"#f8fafc", display:"flex", alignItems:"center",
                  fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#334155",
                  overflow:"hidden", whiteSpace:"nowrap" }}>
                  {aiConfig?.groq_key_configured
                    ? (showKey
                        ? (aiConfig.groq_key_full || aiConfig.groq_key_masked || "—")
                        : (aiConfig.groq_key_masked || "••••••••••••••••••••••••"))
                    : <span style={{ color:"#94a3b8", fontStyle:"italic" }}>Non configurée</span>
                  }
                </div>
                {aiConfig?.groq_key_configured && (
                  <button onClick={() => setShowKey(v => !v)}
                    style={{ height:40, padding:"0 14px", border:"1.5px solid #e8ecf7",
                      borderRadius:10, background:"#fff", cursor:"pointer",
                      color:"#64748b", fontSize:12, fontFamily:"inherit", whiteSpace:"nowrap",
                      transition:"border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="#c7d2fe"}
                    onMouseLeave={e => e.currentTarget.style.borderColor="#e8ecf7"}>
                    {showKey ? "🙈 Masquer" : "👁 Afficher"}
                  </button>
                )}
              </div>
            </div>

            {/* Modèle */}
            <div>
              <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                MODÈLE
              </div>
              <div style={{ height:40, padding:"0 14px", border:"1.5px solid #e8ecf7",
                borderRadius:10, background:"#f8fafc", display:"flex", alignItems:"center",
                fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#334155" }}>
                {aiConfig?.model_name || "llama-3.3-70b-versatile"}
              </div>
            </div>

            {/* Statut connexion */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
              background: aiConfig?.groq_key_configured ? "#f0fdf4" : "#fff7ed",
              borderRadius:10,
              border: `1px solid ${aiConfig?.groq_key_configured ? "#bbf7d0" : "#fed7aa"}` }}>
              <span style={{ width:8, height:8, borderRadius:"50%", display:"inline-block",
                background: aiConfig?.groq_key_configured ? "#22c55e" : "#f59e0b" }} />
              <span style={{ fontSize:12, fontWeight:700,
                color: aiConfig?.groq_key_configured ? "#15803d" : "#b45309" }}>
                {aiConfig?.groq_key_configured ? "API Groq connectée" : "Clé API non configurée"}
              </span>
            </div>

            {/* ML local */}
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
              background: aiConfig?.ml_available ? "#eff6ff" : "#f8fafc",
              borderRadius:10,
              border: `1px solid ${aiConfig?.ml_available ? "#bfdbfe" : "#e8ecf7"}` }}>
              <span style={{ width:8, height:8, borderRadius:"50%", display:"inline-block",
                background: aiConfig?.ml_available ? "#3b82f6" : "#cbd5e1" }} />
              <span style={{ fontSize:12, fontWeight:700,
                color: aiConfig?.ml_available ? "#1d4ed8" : "#94a3b8" }}>
                {aiConfig?.ml_available ? "⚡ Modèles ML locaux chargés" : "Modèles ML non disponibles"}
              </span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
