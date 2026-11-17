/* ==========================================================================
   Universal Pop-up Notification System
   ========================================================================== */
function showPopupModal(options = {}) {
  if (typeof document === "undefined" || typeof document.createElement !== "function" || !document.body) return;

  const msg = typeof options === "string" ? options : (options.message || options.msg || "");
  const type = options.type || options.kind || "info";
  const title = options.title || "";
  const duration = typeof options.duration === "number" ? options.duration : 4200;
  const confirmText = options.confirmText || "Got it";

  // Remove any currently open popup modal
  const existing = typeof document.getElementById === "function"
    ? document.getElementById("universal-popup-overlay")
    : (typeof document.querySelector === "function" ? document.querySelector("#universal-popup-overlay") : null);
  if (existing) {
    if (existing._dismissTimer) clearTimeout(existing._dismissTimer);
    existing.remove?.();
  }

  // Type configuration
  const typeConfig = {
    ok:      { icon: "✅", title: title || "Success!", class: "popup-ok", badgeBg: "rgba(16, 185, 129, 0.15)", border: "#10b981", btnClass: "blue" },
    success: { icon: "✅", title: title || "Success!", class: "popup-ok", badgeBg: "rgba(16, 185, 129, 0.15)", border: "#10b981", btnClass: "blue" },
    warn:    { icon: "⚠️", title: title || "Notice", class: "popup-warn", badgeBg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", btnClass: "gold-btn" },
    warning: { icon: "⚠️", title: title || "Notice", class: "popup-warn", badgeBg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", btnClass: "gold-btn" },
    danger:  { icon: "❌", title: title || "Attention", class: "popup-danger", badgeBg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", btnClass: "danger" },
    error:   { icon: "❌", title: title || "Attention", class: "popup-danger", badgeBg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", btnClass: "danger" },
    info:    { icon: "ℹ️", title: title || "BasaWisyo Notice", class: "popup-info", badgeBg: "rgba(43, 127, 255, 0.15)", border: "#2b7fff", btnClass: "blue" }
  }[type] || { icon: "💬", title: title || "BasaWisyo Notice", class: "popup-info", badgeBg: "rgba(43, 127, 255, 0.15)", border: "#2b7fff", btnClass: "blue" };

  // Detect leading emoji in message
  let displayIcon = typeConfig.icon;
  if (/^([🎉🚀👏📝📇🎯📋📦👑❤️🔥⭐🛡️⚠️])/.test(msg)) {
    const match = msg.match(/^([🎉🚀👏📝📇🎯📋📦👑❤️🔥⭐🛡️⚠️])/);
    if (match) displayIcon = match[1];
  }

  const overlay = document.createElement("div");
  overlay.id = "universal-popup-overlay";
  overlay.className = "app-popup-overlay toast";
  overlay.setAttribute?.("role", "dialog");
  overlay.setAttribute?.("aria-modal", "true");
  overlay.setAttribute?.("aria-live", "assertive");
  overlay.setAttribute?.("aria-labelledby", "popup-modal-title");

  const safeTitle = typeof escapeHTML === "function" ? escapeHTML(typeConfig.title) : typeConfig.title;
  const safeMsg = typeof escapeHTML === "function" ? escapeHTML(msg) : msg;
  const safeBtn = typeof escapeHTML === "function" ? escapeHTML(confirmText) : confirmText;

  overlay.innerHTML = `
    <div class="app-popup-card ${typeConfig.class}">
      <div class="popup-badge" style="background:${typeConfig.badgeBg};border:2px solid ${typeConfig.border}" aria-hidden="true">${displayIcon}</div>
      <h3 id="popup-modal-title" class="popup-title">${safeTitle}</h3>
      <p class="popup-message">${safeMsg}</p>
      <button type="button" class="btn ${typeConfig.btnClass} popup-btn" data-a="popup-close">${safeBtn}</button>
      ${duration > 0 ? `<div class="popup-progress-track"><div class="popup-progress-bar" style="animation-duration:${duration}ms"></div></div>` : ""}
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    if (!overlay.parentNode) return;
    if (overlay._dismissTimer) clearTimeout(overlay._dismissTimer);
    overlay.classList?.add?.("popup-closing");
    setTimeout(() => overlay.remove?.(), 180);
  };

  const btn = overlay.querySelector?.(".popup-btn");
  if (btn) {
    btn.addEventListener?.("click", close);
    setTimeout(() => btn.focus?.(), 40);
  }

  overlay.addEventListener?.("click", e => {
    if (e.target === overlay) close();
  });

  const keyHandler = e => {
    if (e.key === "Escape") {
      close();
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", keyHandler);
      }
    }
  };
  if (typeof document.addEventListener === "function") {
    document.addEventListener("keydown", keyHandler, { once: true });
  }

  if (duration > 0) {
    overlay._dismissTimer = setTimeout(close, duration);
  }
}

// Global showToast dispatcher upgraded to universal popup modal
function showToast(msg, type = "info") {
  showPopupModal({ message: msg, type });
}
