import { useState, useEffect } from "react";
import { fetchTicketAttachments, downloadTicketAttachment, fetchAttachmentBlobUrl } from "../api/tickets";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isImage(contentType) {
  return (contentType || "").startsWith("image/");
}

/**
 * Vignette d'une pièce jointe image : charge le fichier protégé (avec le
 * token d'authentification) puis l'affiche comme une vraie image, cliquable
 * pour l'agrandir. Un <img src="..."> classique ne peut pas fonctionner ici
 * car le fichier exige d'être connecté pour y accéder.
 */
function ImageThumbnail({ ticketId, attachment, onOpen }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    fetchAttachmentBlobUrl(ticketId, attachment.attachment_id)
      .then(u => { if (!cancelled) { objectUrl = u; setUrl(u); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ticketId, attachment.attachment_id]);

  if (failed) return null;

  return (
    <div
      onClick={() => url && onOpen(url, attachment.original_name)}
      title={attachment.original_name}
      style={{
        width: 96, height: 96, borderRadius: 10, overflow: "hidden",
        border: "1.5px solid #e8ecf7", background: "#f8fafc",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: url ? "pointer" : "default", flexShrink: 0,
      }}
    >
      {url ? (
        <img src={url} alt={attachment.original_name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: 11, color: "#94a3b8" }}>…</span>
      )}
    </div>
  );
}

/**
 * Liste des pièces jointes d'un ticket — images en aperçu cliquable,
 * autres fichiers (PDF, DOC, TXT) en chip téléchargeable.
 * Ne s'affiche rien si le ticket n'a aucune pièce jointe.
 */
export default function AttachmentsList({ ticketId, style }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null); // { url, name }

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    setLoading(true);
    fetchTicketAttachments(ticketId)
      .then(data => { if (!cancelled) setItems(data || []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticketId]);

  if (loading || items.length === 0) return null;

  const images = items.filter(a => isImage(a.content_type));
  const others = items.filter(a => !isImage(a.content_type));

  return (
    <div style={{ padding:"14px 22px", borderBottom:"1px solid #f1f5f9", ...style }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
        📎 Pièces jointes ({items.length})
      </div>

      {images.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom: others.length > 0 ? 10 : 0 }}>
          {images.map(a => (
            <ImageThumbnail key={a.attachment_id} ticketId={ticketId} attachment={a}
              onOpen={(url, name) => setLightbox({ url, name })} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {others.map(a => (
            <button key={a.attachment_id} type="button"
              onClick={() => downloadTicketAttachment(ticketId, a.attachment_id, a.original_name)}
              title={`Téléchargé par ${a.uploaded_by_name || "?"}`}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 12px", border:"1.5px solid #e8ecf7", borderRadius:8, background:"#f8fafc", fontSize:12.5, color:"#334155", cursor:"pointer", fontFamily:"inherit" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2B45C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>{a.original_name}</span>
              <span style={{ color:"#94a3b8" }}>{formatSize(a.size_bytes)}</span>
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.85)", zIndex:2000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, cursor:"zoom-out" }}>
          <img src={lightbox.url} alt={lightbox.name}
            style={{ maxWidth:"90vw", maxHeight:"85vh", borderRadius:8, boxShadow:"0 16px 48px rgba(0,0,0,0.4)" }} />
          <div style={{ color:"#fff", fontSize:13, marginTop:14 }}>{lightbox.name} · cliquez pour fermer</div>
        </div>
      )}
    </div>
  );
}
