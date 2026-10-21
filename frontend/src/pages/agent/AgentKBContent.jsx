export default function AgentKBContent() {
  return (
    <div className="adm-body">
      <div style={{ background:"#fff", borderRadius:14, boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f0f4ff", padding:64, textAlign:"center" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:16 }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <div style={{ fontSize:16, fontWeight:700, color:"#0f172a", marginBottom:8 }}>Base de connaissance</div>
        <div style={{ fontSize:13, color:"#94a3b8", maxWidth:360, margin:"0 auto" }}>
          La gestion des articles KB sera disponible prochainement. Vous pourrez rédiger, consulter et partager des articles de support.
        </div>
      </div>
    </div>
  );
}
