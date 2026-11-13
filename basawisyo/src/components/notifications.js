/* ==========================================================================
   Toast and Modals
   ========================================================================== */
function showToast(msg) {
  const existing = $(".toast");
  if (existing) existing.remove();

  const d = document.createElement("div");
  d.className = "toast";
  d.innerHTML = `<span>ðŸ’¬</span><span>${msg}</span>`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

