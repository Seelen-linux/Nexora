/*
 * Einzige Stelle, die nach dem Deployment angepasst werden muss.
 *
 * Lokaler Test (vor Cloudflare Tunnel):
 *   window.UBUNTU_HOSTING_API_BASE = "http://localhost:8000";
 *
 * Produktion (nach Setup-Schritt 6, README):
 *   window.UBUNTU_HOSTING_API_BASE = "https://api.deine-domain.example.com";
 */
window.UBUNTU_HOSTING_API_BASE = "http://localhost:8000";
