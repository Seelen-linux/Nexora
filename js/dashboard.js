import RFB from "./novnc/core/rfb.js";

const stage = document.getElementById("desktopStage");
const overlayStarting = document.getElementById("overlayStarting");
const overlayError = document.getElementById("overlayError");
const overlayErrorText = document.getElementById("overlayErrorText");
const retryBtn = document.getElementById("retryBtn");
const statusText = document.getElementById("statusText");
const pingText = document.getElementById("pingText");
const durationText = document.getElementById("durationText");
const whoAmI = document.getElementById("whoAmI");
const logoutBtn = document.getElementById("logoutBtn");
const toastStack = document.getElementById("toastStack");
const kickModal = document.getElementById("kickModal");
const kickModalText = document.getElementById("kickModalText");
const kickModalOk = document.getElementById("kickModalOk");

let rfb = null;
let eventsSocket = null;
let durationTimer = null;
let latencyTimer = null;
let kicked = false;

function setHop(hop, state) {
  const el = document.querySelector(`.handshake-hop[data-hop="${hop}"]`);
  if (!el) return;
  el.classList.remove("active", "done");
  el.classList.add(state);
  const sep = el.previousElementSibling;
  if (sep && sep.classList.contains("handshake-sep") && state === "done") {
    sep.classList.add("done");
  }
}

function showError(message) {
  overlayStarting.classList.add("hidden");
  overlayError.classList.remove("hidden");
  overlayErrorText.textContent = message;
  statusText.textContent = "Fehler";
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function showKickModal(message) {
  kicked = true;
  kickModalText.textContent = message;
  kickModal.classList.remove("hidden");
}
kickModalOk.addEventListener("click", () => {
  window.location.href = "index.html";
});

function startDurationTimer() {
  const startedAt = Date.now();
  durationTimer = setInterval(() => {
    const secs = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    durationText.textContent = `${mm}:${ss}`;
  }, 1000);
}

async function measureLatency() {
  const start = performance.now();
  try {
    await fetch(`${window.UBUNTU_HOSTING_API_BASE || "http://localhost:8000"}/api/health`, {
      credentials: "include",
    });
    pingText.textContent = `${Math.round(performance.now() - start)} ms`;
  } catch (_) {
    pingText.textContent = "–";
  }
}

function connectEventsChannel() {
  eventsSocket = new WebSocket(wsUrl("/api/session/events"));
  eventsSocket.addEventListener("message", (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (_) {
      return;
    }
    if (msg.type === "ping") {
      eventsSocket.send(JSON.stringify({ type: "pong", ts: msg.ts }));
    } else if (msg.type === "warning") {
      showToast(`⚠ Hinweis vom Administrator: ${msg.message}`);
    } else if (msg.type === "kicked") {
      if (rfb) {
        try {
          rfb.disconnect();
        } catch (_) {}
      }
      showKickModal("Deine Session wurde von einem Administrator beendet.");
    }
  });
}

function connectRfb() {
  try {
    rfb = new RFB(stage, wsUrl("/api/session/ws"));
    rfb.scaleViewport = true;
    rfb.resizeSession = true;

    rfb.addEventListener("connect", () => {
      setHop("container", "done");
      overlayStarting.classList.add("hidden");
      overlayError.classList.add("hidden");
      statusText.textContent = "verbunden";
    });

    rfb.addEventListener("disconnect", () => {
      statusText.textContent = "getrennt";
      if (kicked) return; // Kick-Modal erklärt das schon
      showError("Verbindung zum Desktop unterbrochen.");
    });

    rfb.addEventListener("securityfailure", () => {
      showError("Sicherheitsfehler beim Verbindungsaufbau zum Desktop.");
    });
  } catch (err) {
    showError("noVNC-Client konnte nicht gestartet werden.");
  }
}

async function boot() {
  overlayError.classList.add("hidden");
  overlayStarting.classList.remove("hidden");
  kicked = false;
  setHop("you", "done");

  setHop("cloudflare", "active");
  let me;
  try {
    me = await Api.me();
  } catch (err) {
    showError("Nicht eingeloggt oder Session abgelaufen.");
    setTimeout(() => (window.location.href = "index.html"), 1500);
    return;
  }
  setHop("cloudflare", "done");
  whoAmI.textContent = me.username;

  setHop("backend", "active");
  try {
    await Api.sessionStart();
  } catch (err) {
    showError(err.message || "Session konnte nicht gestartet werden.");
    return;
  }
  setHop("backend", "done");

  setHop("container", "active");
  connectRfb();
  connectEventsChannel();

  if (!durationTimer) startDurationTimer();
  if (!latencyTimer) {
    measureLatency();
    latencyTimer = setInterval(measureLatency, 5000);
  }
}

retryBtn.addEventListener("click", boot);

logoutBtn.addEventListener("click", async () => {
  try {
    if (rfb) rfb.disconnect();
  } catch (_) {}
  try {
    if (eventsSocket) eventsSocket.close();
  } catch (_) {}
  try {
    await Api.logout();
  } catch (_) {}
  window.location.href = "index.html";
});

boot();
