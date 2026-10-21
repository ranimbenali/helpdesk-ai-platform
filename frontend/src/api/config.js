// En dev : http://127.0.0.1:8000
// En Docker (build avec VITE_API_URL="") : chaîne vide → URLs relatives proxiées par Nginx
export const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
