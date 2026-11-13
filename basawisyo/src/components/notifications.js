/* ==========================================================================
   Toast and Modals
   ========================================================================== */
function showToast(msg) {
  const existing = $(".toast");
  if (existing) existing.remove();

  const d = document.createElement("div");
  d.className = "toast";
  const icon = document.createElement("span");
  icon.textContent = "💬";
  const message = document.createElement("span");
  message.textContent = msg;
  d.append(icon, message);
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

