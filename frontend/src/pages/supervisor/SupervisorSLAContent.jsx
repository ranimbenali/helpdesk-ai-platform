import { useEffect, useState } from "react";
import {
  fetchSLAStats, fetchSLAPolicies, fetchSLAStatsByCategory,
  createSLAPolicy, updateSLAPolicy,
} from "../../api/sla";

function minsToLabel(mins) {
  if (!mins) return "—";
  return mins >= 60 ? `${Math.round(mins / 60)} h` : `${mins} min`;
}

function priorityColor(p) {
  const s = (p || "").toLowerCase();
  if (s.includes("urgent") || s.includes("p1")) return { color: "#e53935", bg: "#fee2e2" };
  if (s.includes("haut")   || s.includes("high")  || s.includes("p2")) return { color: "#ea580c", bg: "#ffedd5" };
  if (s.includes("norm")   || s.includes("p3"))  return { color: "#2563eb", bg: "#eff6ff" };
  if (s.includes("moyen"))                        return { color: "#7c3aed", bg: "#f5f3ff" };
  return { color: "#16a34a", bg: "#f0fdf4" };
}

function rateColor(rate) {
  if (rate >= 80) return "#22c55e";
  if (rate >= 50) return "#f59e0b";
  return "#e53935";
}

const EMPTY_FORM = { priority: "", response_time: "", resolve_time: "", is_active: true };

export default function SupervisorSLAContent({ triggerNewCategory = 0 }) {
  const [stats,      setStats]      = useState(null);
  const [policies,   setPolicies]   = useState([]);
  const [catStats,   setCatStats]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [catLoading, setCatLoading] = useState(true);
  const [error,      setError]      = useState("");
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editingId,  setEditingId]  = useState(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([fetchSLAStats(), fetchSLAPolicies()])
      .then(([s, p]) => { setStats(s); setPolicies(p || []); })
      .catch(e => setError(e.message || "Erreur de chargement"))
      .finally(() => setLoading(false));

    setCatLoading(true);
    fetchSLAStatsByCategory()
      .then(setCatStats)
      .catch(() => setCatStats([]))
      .finally(() => setCatLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (triggerNewCategory > 0) openCreate();
  }, [triggerNewCategory]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      priority:      p.priority,
      response_time: p.response_time,
      resolve_time:  p.resolve_time,
      is_active:     p.is_active,
    });
    setFormError("");
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.priority.trim()) return setFormError("Le nom de la priorité est requis.");
    const rt = parseInt(form.response_time);
    const rv = parseInt(form.resolve_time);
    if (!rt || rt <= 0) return setFormError("Temps de 1ère réponse invalide.");
    if (!rv || rv <= 0) return setFormError("Temps de résolution invalide.");
    if (rv <= rt)       return setFormError("Le délai de résolution doit être supérieur à la 1ère réponse.");

    try {
      setSaving(true);
      const payload = { priority: form.priority.trim(), response_time: rt, resolve_time: rv, is_active: form.is_active };
      if (editingId) await updateSLAPolicy(editingId, payload);
      else            await createSLAPolicy(payload);
      setShowModal(false);
      loadAll();
    } catch (err) {
      setFormError(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const globalRate = stats?.rate           ?? 0;
  const respected  = stats?.respected      ?? 0;
  const breachedCt = stats?.breached_resolve ?? 0;
  const atRiskCt   = stats?.at_risk        ?? 0;

  const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f1f5f9", overflow:"hidden" };
  const inputBase = { height:42, padding:"0 14px", border:"1.5px solid #e8ecf7", borderRadius:10,
    fontSize:13, outline:"none", fontFamily:"inherit", color:"#0f172a", background:"#fff", width:"100%" };
  const labelBase = { display:"block", fontSize:11, fontWeight:700, color:"#64748b",
    textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 };

  return (
    <div className="adm-body">

      {error && (
        <div style={{ background:"#fef2f2", color:"#e53935", padding:"12px 16px", borderRadius:10, marginBottom:16, fontSize:13 }}>
          {error}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 }}>
        {[
          { label:"TAUX GLOBAL",    value: loading ? "…" : `${globalRate}%`, color:"#22D3A0", bg:"#f0fdf4", border:"#bbf7d0" },
          { label:"SLA RESPECTÉS",  value: loading ? "…" : respected,         color:"#2B45C8", bg:"#eff6ff", border:"#bfdbfe" },
          { label:"SLA DÉPASSÉS",   value: loading ? "…" : breachedCt,        color:"#e53935", bg:"#fef2f2", border:"#fecaca" },
          { label:"TICKETS RISQUE", value: loading ? "…" : atRiskCt,          color:"#F59E0B", bg:"#fffbeb", border:"#fde68a" },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} style={{ background:bg, border:`1px solid ${border}`, borderRadius:14, padding:"18px 22px" }}>
            <div style={{ fontSize:10, fontWeight:700, color, letterSpacing:"0.09em", textTransform:"uppercase",
              fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:30, fontWeight:800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Politiques SLA ── */}
      <div style={{ ...card, marginBottom:20 }}>
        <div style={{ padding:"18px 22px", borderBottom:"1px solid #f1f5f9",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:15, color:"#0f172a" }}>Politiques SLA</div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#94a3b8",
            letterSpacing:"0.08em", textTransform:"uppercase" }}>Temps en minutes</span>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:36, color:"#94a3b8", fontSize:13 }}>Chargement…</div>
        ) : policies.length === 0 ? (
          <div style={{ textAlign:"center", padding:36, color:"#94a3b8", fontSize:13 }}>Aucune politique SLA configurée</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Priorité","1ère réponse","Résolution","Actif",""].map((h, i) => (
                  <th key={i} style={{ padding:"10px 20px", textAlign: i===4?"center":"left",
                    fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.09em",
                    textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace",
                    borderBottom:"1px solid #f1f5f9" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map(p => {
                const pc = priorityColor(p.priority);
                return (
                  <tr key={p.id}
                    style={{ borderBottom:"1px solid #f8fafc" }}
                    onMouseEnter={e => e.currentTarget.style.background="#fafbff"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <td style={{ padding:"14px 20px" }}>
                      <span style={{ padding:"3px 12px", borderRadius:20, background:pc.bg,
                        color:pc.color, fontSize:12, fontWeight:600 }}>{p.priority}</span>
                    </td>
                    <td style={{ padding:"14px 20px", fontSize:14, fontWeight:700, color:"#2B45C8" }}>
                      {minsToLabel(p.response_time)}
                    </td>
                    <td style={{ padding:"14px 20px", fontSize:14, fontWeight:700, color:"#2B45C8" }}>
                      {minsToLabel(p.resolve_time)}
                    </td>
                    <td style={{ padding:"14px 20px" }}>
                      <span style={{ display:"flex", alignItems:"center", gap:5,
                        fontSize:12, fontWeight:600, color: p.is_active?"#16a34a":"#e53935" }}>
                        <span style={{ width:7, height:7, borderRadius:"50%", display:"inline-block",
                          background: p.is_active?"#22c55e":"#e53935" }} />
                        {p.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td style={{ padding:"14px 20px", textAlign:"center" }}>
                      <button onClick={() => openEdit(p)}
                        style={{ height:30, padding:"0 12px", border:"1.5px solid #c7d2fe",
                          borderRadius:7, background:"#f0f4ff", color:"#3b5bdb",
                          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                        Modifier
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Taux de respect par catégorie ── */}
      <div style={{ ...card, padding:"22px 24px" }}>
        <div style={{ fontWeight:700, fontSize:15, color:"#0f172a", marginBottom:18 }}>
          Taux de respect SLA — par catégorie
        </div>

        {catLoading ? (
          <div style={{ textAlign:"center", padding:24, color:"#94a3b8", fontSize:13 }}>Chargement…</div>
        ) : catStats.length === 0 ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", padding:"32px 20px", gap:8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div style={{ fontSize:13, fontWeight:600, color:"#94a3b8" }}>Aucune donnée disponible</div>
            <div style={{ fontSize:11, color:"#cbd5e1" }}>Les catégories apparaîtront après la classification IA des tickets</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
            {catStats.map(cat => {
              const color = rateColor(cat.rate);
              return (
                <div key={cat.category} style={{ padding:"16px 18px", background:"#f8fafc",
                  borderRadius:12, border:"1px solid #f1f5f9" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{cat.category}</span>
                    <span style={{ fontSize:16, fontWeight:800, color }}>{cat.rate}%</span>
                  </div>
                  {/* Barre de progression */}
                  <div style={{ height:6, background:"#e8ecf7", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
                    <div style={{ height:"100%", borderRadius:4, background:color,
                      width:`${cat.rate}%`, transition:"width 0.6s ease" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94a3b8" }}>
                    <span>✓ {cat.respected} respectés</span>
                    <span style={{ color:"#e53935" }}>✗ {cat.breached} dépassés</span>
                    <span>{cat.total} total</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Nouvelle / Modifier politique ── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(11,26,82,0.55)",
          zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
          onClick={() => !saving && setShowModal(false)}>
          <div style={{ background:"#fff", borderRadius:18, padding:32, width:460,
            boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }} onClick={e => e.stopPropagation()}>

            <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:800, fontSize:18,
              color:"#0f172a", marginBottom:4 }}>
              {editingId ? "Modifier la politique SLA" : "Nouvelle politique SLA"}
            </div>
            <p style={{ fontSize:13, color:"#94a3b8", marginBottom:22 }}>
              {editingId
                ? "Modifiez les délais et le statut de cette politique."
                : "Définissez une priorité et ses délais SLA associés."}
            </p>

            {formError && (
              <div style={{ padding:"10px 14px", background:"#fef2f2", borderRadius:8,
                color:"#e53935", fontSize:12, marginBottom:14 }}>{formError}</div>
            )}

            <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* Nom priorité */}
              <div>
                <label style={labelBase}>Nom de la priorité</label>
                <input placeholder="Ex : Critique, Urgente, P1…"
                  value={form.priority} disabled={!!editingId}
                  onChange={e => setForm(p => ({...p, priority: e.target.value}))}
                  style={{ ...inputBase, opacity: editingId ? 0.6 : 1 }} />
              </div>

              {/* Délais côte à côte */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={labelBase}>1ère réponse (min)</label>
                  <input type="number" min="1" placeholder="ex: 60"
                    value={form.response_time}
                    onChange={e => setForm(p => ({...p, response_time: e.target.value}))}
                    style={inputBase} />
                </div>
                <div>
                  <label style={labelBase}>Résolution (min)</label>
                  <input type="number" min="1" placeholder="ex: 240"
                    value={form.resolve_time}
                    onChange={e => setForm(p => ({...p, resolve_time: e.target.value}))}
                    style={inputBase} />
                </div>
              </div>

              <div style={{ fontSize:11, color:"#94a3b8", marginTop:-6 }}>
                60 min = 1 h · 240 min = 4 h · 480 min = 8 h · 1440 min = 24 h
              </div>

              {/* Toggle actif */}
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ position:"relative", width:44, height:24,
                  background: form.is_active ? "#1E3AAF" : "#cbd5e1",
                  borderRadius:12, transition:"background 0.2s", flexShrink:0, cursor:"pointer" }}
                  onClick={() => setForm(p => ({...p, is_active: !p.is_active}))}>
                  <div style={{ position:"absolute", top:3,
                    left: form.is_active ? 23 : 3,
                    width:18, height:18, background:"#fff", borderRadius:"50%",
                    transition:"left 0.2s", pointerEvents:"none" }} />
                </div>
                <span style={{ fontSize:13, color:"#334155", fontWeight:500 }}>
                  {form.is_active ? "Politique active" : "Politique inactive"}
                </span>
              </div>

              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button type="submit" disabled={saving}
                  style={{ flex:1, height:44, background:"#1E3AAF", color:"#fff",
                    border:"none", borderRadius:10, fontWeight:700, fontSize:14,
                    cursor:"pointer", fontFamily:"inherit", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Créer la politique"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  style={{ flex:1, height:44, background:"#f1f5f9", color:"#334155",
                    border:"none", borderRadius:10, fontWeight:600, fontSize:14,
                    cursor:"pointer", fontFamily:"inherit" }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
