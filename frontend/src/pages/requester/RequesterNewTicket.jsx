import { useState, useRef } from "react";
import { createTicket, uploadTicketAttachment } from "../../api/tickets";

const card = { background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff" };

const TIPS = [
  { n:1, title:"Décrivez le contexte",   hint:"Quand le problème est-il survenu ? Sur quel appareil ?" },
  { n:2, title:"Donnez les étapes",      hint:"Qu'avez-vous fait juste avant que ça arrive ?" },
  { n:3, title:"Ajoutez des captures",   hint:"Une image vaut mille mots — surtout pour les bugs visuels." },
  { n:4, title:"Précisez votre attente", hint:"Ce que vous essayez d'accomplir." },
];

export default function RequesterNewTicket({ onNavigate }) {
  const [subject,   setSubject]   = useState("");
  const [desc,      setDesc]      = useState("");
  const [files,     setFiles]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState("");
  const [created,   setCreated]   = useState(null); // ticket créé
  const fileRef = useRef(null);

  const canSubmit = subject.trim().length >= 3 && desc.trim().length >= 10;

  function handleFileAdd(e) {
    const newFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files || []);
    setFiles(prev => [...prev, ...newFiles]);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const data = await createTicket({ title: subject.trim(), description: desc.trim() });
      const ticketId = data.ticket_id || data.id;

      if (files.length > 0 && ticketId) {
        const results = await Promise.allSettled(
          files.map(f => uploadTicketAttachment(ticketId, f))
        );
        const failed = results.filter(r => r.status === "rejected");
        if (failed.length > 0) {
          setError(
            `Le ticket a été créé, mais ${failed.length} pièce(s) jointe(s) sur ${files.length} n'ont pas pu être envoyées.`
          );
        }
      }

      setCreated(data);
    } catch (err) {
      setError(err.message || "Erreur lors de la création du ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Succès ── */
  if (created) {
    return (
      <div className="adm-body">
        <div style={{ ...card, padding:56, textAlign:"center", maxWidth:520, margin:"0 auto" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:"#f0fdf4", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:"#0f172a", marginBottom:8 }}>Ticket créé avec succès !</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#8B5CF6", fontWeight:700, marginBottom:12 }}>
            #{created.ticket_id || created.id || "—"}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginBottom:28, lineHeight:1.7 }}>
            Votre ticket a été soumis et sera traité par notre équipe dans les meilleurs délais.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button type="button" onClick={() => onNavigate("tickets")}
              style={{ padding:"10px 22px", background:"#1E3AAF", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13.5, cursor:"pointer" }}>
              Voir mes tickets
            </button>
            <button type="button" onClick={() => { setCreated(null); setSubject(""); setDesc(""); setFiles([]); }}
              style={{ padding:"10px 22px", background:"#fff", color:"#334155", border:"1.5px solid #e8ecf7", borderRadius:10, fontWeight:600, fontSize:13.5, cursor:"pointer" }}>
              Nouveau ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulaire ── */
  return (
    <div className="adm-body">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>

        {/* ── Main form ── */}
        <div style={card}>
          <div style={{ padding:24 }}>
            {/* Subject */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#0f172a", display:"block", marginBottom:8 }}>
                Sujet <span style={{ color:"#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Décrivez brièvement votre problème…"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{ width:"100%", height:44, padding:"0 14px", border:`2px solid ${subject.trim().length >= 3 ? "#2B45C8" : "#e8ecf7"}`, borderRadius:10, fontSize:13.5, outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.15s" }}
              />
              <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:5 }}>
                Minimum 3 caractères · Soyez clair et concis
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#0f172a", display:"block", marginBottom:8 }}>
                Description <span style={{ color:"#dc2626" }}>*</span>
              </label>
              <textarea
                placeholder="Décrivez le problème en détail : contexte, étapes pour reproduire, ce que vous avez déjà essayé…"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={7}
                style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${desc.trim().length >= 10 ? "#e8ecf7" : "#e8ecf7"}`, borderRadius:10, fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical", lineHeight:1.75, boxSizing:"border-box" }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94a3b8", marginTop:4 }}>
                <span>Minimum 10 caractères</span>
                <span style={{ color: desc.length > 4800 ? "#dc2626" : "#94a3b8" }}>{desc.length} / 5000</span>
              </div>
            </div>

            {/* Attachments */}
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#0f172a", display:"block", marginBottom:8 }}>
                Pièces jointes <span style={{ fontSize:12, fontWeight:400, color:"#94a3b8" }}>(optionnel)</span>
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                style={{ border:"2px dashed #e8ecf7", borderRadius:12, padding:"28px 20px", textAlign:"center", cursor:"pointer", transition:"border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#2B45C8"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#e8ecf7"}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:8 }}>
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                <div style={{ fontSize:13, fontWeight:600, color:"#334155" }}>Glissez vos fichiers ici ou cliquez</div>
                <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:3 }}>PNG, JPG, PDF · 25 Mo max par fichier</div>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" style={{ display:"none" }} onChange={handleFileAdd} />

              {files.length > 0 && (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 12px", border:"1.5px solid #e8ecf7", borderRadius:8, background:"#f8fafc", fontSize:12.5, color:"#334155" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2B45C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span>{f.name}</span>
                      <span style={{ color:"#94a3b8" }}>{(f.size / 1024).toFixed(0)} Ko</span>
                      <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:15, lineHeight:1, padding:0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom:16, padding:"10px 14px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, fontSize:13, color:"#dc2626", display:"flex", alignItems:"center", gap:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              style={{
                width:"100%", padding:"13px", border:"none", borderRadius:10,
                fontWeight:700, fontSize:14, cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
                background: canSubmit && !submitting ? "#1E3AAF" : "#e2e8f0",
                color: canSubmit && !submitting ? "#fff" : "#94a3b8",
                transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              }}>
              {submitting ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation:"spin 1s linear infinite" }}>
                    <path d="M12 2a10 10 0 0 1 10 10"/>
                  </svg>
                  Envoi en cours…
                </>
              ) : "Soumettre le ticket →"}
            </button>
          </div>
        </div>

        {/* ── Right sidebar : Tips only ── */}
        <div style={card}>
          <div style={{ padding:"16px 18px", borderBottom:"1px solid #f1f5f9" }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:"#0f172a" }}>Conseils pour un ticket clair</div>
            <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>Un bon ticket = une réponse rapide</div>
          </div>
          {TIPS.map((t, i) => (
            <div key={t.n} style={{ padding:"14px 18px", borderBottom: i < TIPS.length-1 ? "1px solid #f8fafc" : "none" }}>
              <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:"#fffbeb", border:"1.5px solid #fde68a", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:"#f59e0b" }}>{t.n}</span>
                </div>
                <div>
                  <div style={{ fontSize:12.5, fontWeight:700, color:"#0f172a" }}>{t.title}</div>
                  <div style={{ fontSize:11.5, color:"#94a3b8", marginTop:3, lineHeight:1.5 }}>{t.hint}</div>
                </div>
              </div>
            </div>
          ))}

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
