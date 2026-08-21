const usersTableBody = document.getElementById("usersTableBody");
const ipBansTableBody = document.getElementById("ipBansTableBody");
const auditTableBody = document.getElementById("auditTableBody");
const onlineCount = document.getElementById("onlineCount");
const totalCount = document.getElementById("totalCount");
const whoAmI = document.getElementById("whoAmI");

let currentAdminUsername = null;
let pollTimer = null;

/* ---------- Auth-Check ---------- */
async function requireAdmin() {
  try {
    const me = await Api.me();
    if (!me.is_admin) {
      window.location.href = "dashboard.html";
      return false;
    }
    currentAdminUsername = me.username;
    whoAmI.textContent = me.username;
    return true;
  } catch (_) {
    window.location.href = "index.html";
    return false;
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await Api.logout();
  } catch (_) {}
  window.location.href = "index.html";
});

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tabUsers").style.display = tab.dataset.tab === "users" ? "" : "none";
    document.getElementById("tabIpbans").style.display = tab.dataset.tab === "ipbans" ? "" : "none";
    document.getElementById("tabAudit").style.display = tab.dataset.tab === "audit" ? "" : "none";
    if (tab.dataset.tab === "ipbans") loadIpBans();
    if (tab.dataset.tab === "audit") loadAuditLog();
  });
});

/* ---------- Bestätigungsdialog (generisch für destruktive Aktionen) ---------- */
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmText = document.getElementById("confirmText");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");
let confirmAction = null;

function askConfirm(title, text, onConfirm) {
  confirmTitle.textContent = title;
  confirmText.textContent = text;
  confirmAction = onConfirm;
  confirmModal.classList.remove("hidden");
}
confirmCancel.addEventListener("click", () => confirmModal.classList.add("hidden"));
confirmOk.addEventListener("click", async () => {
  confirmModal.classList.add("hidden");
  if (confirmAction) await confirmAction();
});

/* ---------- Nutzertabelle ---------- */
function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return "–";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function barClass(percent) {
  if (percent >= 85) return "high";
  if (percent >= 60) return "mid";
  return "";
}

function renderUsers(users) {
  onlineCount.textContent = `${users.filter((u) => u.online).length} online`;
  totalCount.textContent = `${users.length} gesamt`;

  if (users.length === 0) {
    usersTableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Keine Nutzer angelegt.</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = users
    .map((u) => {
      const cpuPct = u.cpu_percent ?? 0;
      const cpuDisplay = u.cpu_percent !== null && u.cpu_percent !== undefined ? `${u.cpu_percent}%` : "–";
      const ramDisplay = u.ram_mb !== null && u.ram_mb !== undefined ? `${Math.round(u.ram_mb)} MB` : "–";
      const containerBadgeClass =
        u.container_status === "running" ? "running" : u.container_status === "unknown" ? "unknown" : "stopped";

      return `
        <tr data-username="${u.username}">
          <td>
            <div class="user-cell">
              <span class="status-dot ${u.online ? "on" : "off"}"></span>
              ${u.username}
              ${u.is_banned ? '<span class="badge banned" style="margin-left:6px">gesperrt</span>' : ""}
            </div>
          </td>
          <td class="metric-cell">${u.online ? "online" : "offline"}</td>
          <td class="metric-cell">${fmtDuration(u.session_seconds)}</td>
          <td class="metric-cell">${u.ping_ms !== null && u.ping_ms !== undefined ? u.ping_ms + " ms" : "–"}</td>
          <td class="metric-cell">
            <span class="mini-bar"><span class="mini-bar-fill ${barClass(cpuPct)}" style="width:${Math.min(cpuPct, 100)}%"></span></span>${cpuDisplay}
          </td>
          <td class="metric-cell">${ramDisplay}</td>
          <td><span class="badge ${containerBadgeClass}">${u.container_status}</span></td>
          <td class="metric-cell">${u.ip_address || "–"}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-sm btn-ghost" data-action="view">Details</button>
              <button class="btn btn-sm btn-ghost" data-action="warn">Warnen</button>
              <button class="btn btn-sm btn-danger" data-action="kick">Kick</button>
              <button class="btn btn-sm btn-danger" data-action="stop">Stop</button>
              ${
                u.is_banned
                  ? '<button class="btn btn-sm btn-ghost" data-action="unban">Entsperren</button>'
                  : '<button class="btn btn-sm btn-danger" data-action="ban">Bannen</button>'
              }
            </div>
          </td>
        </tr>`;
    })
    .join("");
}

async function loadUsers() {
  try {
    const users = await Api.adminListUsers();
    renderUsers(users);
  } catch (err) {
    usersTableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Fehler beim Laden: ${err.message}</td></tr>`;
  }
}

/* ---------- Zeilen-Aktionen (Event-Delegation) ---------- */
usersTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const row = e.target.closest("tr");
  const username = row.dataset.username;
  const action = btn.dataset.action;

  if (username === currentAdminUsername && (action === "kick" || action === "ban")) {
    alert("Du kannst diese Aktion nicht auf deinen eigenen Account anwenden.");
    return;
  }

  if (action === "view") {
    try {
      const detail = await Api.adminUserDetail(username);
      document.getElementById("detailTitle").textContent = `Details: ${detail.username}`;
      document.getElementById("detailBody").innerHTML = `
        Admin: ${detail.is_admin ? "ja" : "nein"}<br/>
        Gesperrt: ${detail.is_banned ? "ja (" + (detail.ban_reason || "kein Grund angegeben") + ")" : "nein"}<br/>
        Online: ${detail.online ? "ja" : "nein"}<br/>
        Container: ${detail.container_status}<br/>
        Angelegt: ${new Date(detail.created_at).toLocaleString("de-DE")}<br/>
        Letzter Login: ${detail.last_login_at ? new Date(detail.last_login_at).toLocaleString("de-DE") : "–"}<br/>
        Letzte IP: ${detail.last_ip || "–"}
      `;
      document.getElementById("detailModal").classList.remove("hidden");
    } catch (err) {
      alert("Fehler: " + err.message);
    }
    return;
  }

  if (action === "warn") {
    document.getElementById("warnMessage").value = "";
    document.getElementById("warnModal").dataset.target = username;
    document.getElementById("warnModal").classList.remove("hidden");
    return;
  }

  if (action === "kick") {
    askConfirm("Nutzer kicken?", `${username} wird sofort aus der laufenden Session geworfen.`, async () => {
      await Api.adminKick(username);
      loadUsers();
    });
    return;
  }

  if (action === "stop") {
    askConfirm("Session stoppen?", `Der Ubuntu-Container von ${username} wird gestoppt. Das Home-Verzeichnis bleibt erhalten.`, async () => {
      await Api.adminStopSession(username);
      loadUsers();
    });
    return;
  }

  if (action === "ban") {
    askConfirm("Nutzer sperren?", `${username} kann sich danach nicht mehr einloggen, bis er entsperrt wird.`, async () => {
      const reason = prompt("Grund für die Sperre (optional):") || null;
      await Api.adminBan(username, reason);
      loadUsers();
    });
    return;
  }

  if (action === "unban") {
    askConfirm("Nutzer entsperren?", `${username} kann sich danach wieder einloggen.`, async () => {
      await Api.adminUnban(username);
      loadUsers();
    });
    return;
  }
});

/* ---------- Warn-Modal ---------- */
document.getElementById("warnCancel").addEventListener("click", () => {
  document.getElementById("warnModal").classList.add("hidden");
});
document.getElementById("warnSubmit").addEventListener("click", async () => {
  const modal = document.getElementById("warnModal");
  const username = modal.dataset.target;
  const message = document.getElementById("warnMessage").value.trim();
  if (!message) return;
  try {
    await Api.adminWarn(username, message);
    modal.classList.add("hidden");
  } catch (err) {
    alert("Fehler: " + err.message);
  }
});

document.getElementById("detailClose").addEventListener("click", () => {
  document.getElementById("detailModal").classList.add("hidden");
});

/* ---------- Neuen Nutzer anlegen ---------- */
const newUserModal = document.getElementById("newUserModal");
document.getElementById("newUserBtn").addEventListener("click", () => {
  document.getElementById("newUsername").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("newIsAdmin").checked = false;
  document.getElementById("newUserError").classList.remove("visible");
  newUserModal.classList.remove("hidden");
});
document.getElementById("newUserCancel").addEventListener("click", () => newUserModal.classList.add("hidden"));
document.getElementById("newUserSubmit").addEventListener("click", async () => {
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value;
  const isAdmin = document.getElementById("newIsAdmin").checked;
  const errorBox = document.getElementById("newUserError");
  try {
    await Api.adminCreateUser(username, password, isAdmin);
    newUserModal.classList.add("hidden");
    loadUsers();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("visible");
  }
});

/* ---------- IP-Sperren ---------- */
async function loadIpBans() {
  try {
    const bans = await Api.adminListIpBans();
    if (bans.length === 0) {
      ipBansTableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Keine IP-Sperren.</td></tr>`;
      return;
    }
    ipBansTableBody.innerHTML = bans
      .map(
        (b) => `
        <tr>
          <td class="metric-cell">${b.ip_address}</td>
          <td>${b.reason || "–"}</td>
          <td class="metric-cell">${new Date(b.created_at).toLocaleString("de-DE")}</td>
          <td><button class="btn btn-sm btn-ghost" data-ip="${b.ip_address}">Entsperren</button></td>
        </tr>`
      )
      .join("");
  } catch (err) {
    ipBansTableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Fehler: ${err.message}</td></tr>`;
  }
}

ipBansTableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-ip]");
  if (!btn) return;
  const ip = btn.dataset.ip;
  askConfirm("IP-Sperre aufheben?", `${ip} kann sich danach wieder verbinden.`, async () => {
    await Api.adminIpUnban(ip);
    loadIpBans();
  });
});

document.getElementById("ipBanSubmit").addEventListener("click", async () => {
  const ip = document.getElementById("ipBanInput").value.trim();
  const reason = document.getElementById("ipBanReason").value.trim() || null;
  if (!ip) return;
  try {
    await Api.adminIpBan(ip, reason);
    document.getElementById("ipBanInput").value = "";
    document.getElementById("ipBanReason").value = "";
    loadIpBans();
  } catch (err) {
    alert("Fehler: " + err.message);
  }
});

/* ---------- Audit-Log ---------- */
async function loadAuditLog() {
  try {
    const entries = await Api.adminAuditLog();
    if (entries.length === 0) {
      auditTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Noch keine Einträge.</td></tr>`;
      return;
    }
    auditTableBody.innerHTML = entries
      .map(
        (e) => `
        <tr>
          <td class="metric-cell">${new Date(e.timestamp).toLocaleString("de-DE")}</td>
          <td>${e.admin_username}</td>
          <td><span class="badge">${e.action}</span></td>
          <td>${e.target_username || "–"}</td>
          <td style="color: var(--text-muted); font-size: 12px">${e.details || "–"}</td>
        </tr>`
      )
      .join("");
  } catch (err) {
    auditTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Fehler: ${err.message}</td></tr>`;
  }
}

/* ---------- Start ---------- */
(async () => {
  const ok = await requireAdmin();
  if (!ok) return;
  await loadUsers();
  pollTimer = setInterval(loadUsers, 4000);
})();
