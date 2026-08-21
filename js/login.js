/* ---------- Boot-Log (linke Spalte, rein dekorativ) ---------- */
const BOOT_LINES = [
  { text: "$ connecting to ubuntu.host …", cls: "" },
  { text: "  » resolving edge via cloudflare tunnel", cls: "" },
  { text: "  ✓ tls handshake complete", cls: "ok" },
  { text: "  » authenticating session", cls: "" },
  { text: "  » provisioning <span class='tag'>ubuntu-22.04</span> + xfce", cls: "" },
  { text: "  ✓ container ready, 2 vCPU / 2GB RAM", cls: "ok" },
  { text: "  » attaching persistent home volume", cls: "" },
  { text: "  ✓ desktop online", cls: "ok" },
  { text: "$ waiting for login_", cls: "" },
];

function renderBootLog() {
  const el = document.getElementById("bootLog");
  if (!el) return;
  BOOT_LINES.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = `line ${line.cls}`;
    div.style.animationDelay = `${0.15 + i * 0.28}s`;
    div.innerHTML = line.text;
    el.appendChild(div);
  });
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  el.lastElementChild.appendChild(cursor);
}
renderBootLog();

/* ---------- Admin-Login Umschalter (rein visuelles Framing -
   die tatsächliche Berechtigung kommt ausschließlich vom Server
   über das is_admin-Feld der Login-Antwort, niemals vom Frontend) ---------- */
let adminMode = false;
const toggleBtn = document.getElementById("toggleAdminMode");
const formTitle = document.getElementById("formTitle");
const formSub = document.getElementById("formSub");

toggleBtn.addEventListener("click", () => {
  adminMode = !adminMode;
  if (adminMode) {
    formTitle.textContent = "Admin-Login";
    formSub.textContent = "Zugang zum Admin-Dashboard.";
    toggleBtn.textContent = "Zurück zum normalen Login";
  } else {
    formTitle.textContent = "Anmelden";
    formSub.textContent = "Zugang zu deiner persönlichen Ubuntu-Desktop-Session.";
    toggleBtn.textContent = "Admin-Login";
  }
});

/* ---------- Login-Formular ---------- */
const form = document.getElementById("loginForm");
const errorBox = document.getElementById("loginError");
const submitBtn = document.getElementById("loginSubmit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.remove("visible");
  submitBtn.disabled = true;
  submitBtn.textContent = "Anmelden …";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const result = await Api.login(username, password);
    if (adminMode && !result.is_admin) {
      // Zugangsdaten stimmen, aber kein Admin-Account - im Admin-Modus abweisen,
      // damit ein normaler Nutzer nicht versehentlich im falschen UI landet.
      await Api.logout();
      throw new ApiError("Dieser Account hat keine Admin-Rechte.", 403);
    }
    window.location.href = result.is_admin ? "admin.html" : "dashboard.html";
  } catch (err) {
    errorBox.textContent = err.message || "Anmeldung fehlgeschlagen.";
    errorBox.classList.add("visible");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Anmelden";
  }
});

/* ---------- Donate: QR-Code + Copy-Button ---------- */
const LTC_ADDRESS = document.getElementById("ltcAddress").textContent.trim();

function renderQr() {
  const qr = qrcode(0, "M"); // Typ 0 = automatische Größenwahl
  qr.addData(LTC_ADDRESS);
  qr.make();
  document.getElementById("donateQr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 });
}
renderQr();

document.getElementById("copyAddressBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(LTC_ADDRESS);
  } catch (_) {
    // Fallback für Kontexte ohne Clipboard-API (z.B. sehr alte Browser)
    const ta = document.createElement("textarea");
    ta.value = LTC_ADDRESS;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  const toast = document.getElementById("copyToast");
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 1800);
});
