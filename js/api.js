/*
 * Zentrale API-Konfiguration + Fetch-Wrapper.
 *
 * WICHTIG: API_BASE_URL hier auf die eigene Backend-URL setzen, sobald
 * Cloudflare Tunnel steht (siehe README, Setup-Schritt 6). Für den
 * lokalen Test vorher einfach auf http://localhost:8000 stehen lassen.
 */
const API_BASE_URL = window.UBUNTU_HOSTING_API_BASE || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include", // HTTP-only Cookie mitschicken
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* Antwort ohne Body ist ok, z.B. bei manchen 204/DELETE-Antworten */
  }

  if (!res.ok) {
    const message = (data && data.detail) || `Fehler ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data;
}

const Api = {
  login: (username, password) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
  me: () => apiFetch("/api/auth/me"),

  sessionStart: () => apiFetch("/api/session/start", { method: "POST" }),
  sessionStop: () => apiFetch("/api/session/stop", { method: "POST" }),
  sessionStatus: () => apiFetch("/api/session/status"),

  adminListUsers: () => apiFetch("/api/admin/users"),
  adminCreateUser: (username, password, isAdmin) =>
    apiFetch("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, password, is_admin: isAdmin }),
    }),
  adminKick: (username) => apiFetch(`/api/admin/users/${encodeURIComponent(username)}/kick`, { method: "POST" }),
  adminStopSession: (username) =>
    apiFetch(`/api/admin/users/${encodeURIComponent(username)}/stop-session`, { method: "POST" }),
  adminWarn: (username, message) =>
    apiFetch(`/api/admin/users/${encodeURIComponent(username)}/warn`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  adminBan: (username, reason) =>
    apiFetch(`/api/admin/users/${encodeURIComponent(username)}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminUnban: (username) => apiFetch(`/api/admin/users/${encodeURIComponent(username)}/unban`, { method: "POST" }),
  adminIpBan: (ip, reason) =>
    apiFetch("/api/admin/ip-bans", { method: "POST", body: JSON.stringify({ ip_address: ip, reason }) }),
  adminIpUnban: (ip) => apiFetch(`/api/admin/ip-bans/${encodeURIComponent(ip)}`, { method: "DELETE" }),
  adminListIpBans: () => apiFetch("/api/admin/ip-bans"),
  adminAuditLog: () => apiFetch("/api/admin/audit-log"),
  adminUserDetail: (username) => apiFetch(`/api/admin/users/${encodeURIComponent(username)}`),
};

function wsUrl(path) {
  const httpBase = API_BASE_URL.replace(/\/$/, "");
  return httpBase.replace(/^http/, "ws") + path;
}
