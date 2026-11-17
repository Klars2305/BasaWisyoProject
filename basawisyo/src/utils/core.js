/* ==========================================================================
   BasaWisyo Core Application Logic
   ========================================================================== */

const LG = "assets/images/wisyo.png";
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Reading difficulty tiers
const DIFF_KEYS = ["easy", "medium", "hard", "extreme"];
const DIFF_NAMES = {
  easy: "Easy (Madali)",
  medium: "Medium (Katamtaman)",
  hard: "Hard (Mahirap)",
  extreme: "Extreme (Sukdulan)"
};

// DepEd Phil-IRI standard levels
const PHIL_IRI_LEVELS = ["Frustration", "Instructional", "Independent", "Mastery"];

// Reusable status and error patterns
function renderStatusState({ type = "idle", title = "", message = "", actionLabel = "", actionA = "", actionV = "" } = {}) {
  if (type === "idle") return "";
  if (type === "loading") {
    return `<div class="status-state status-loading" role="status" aria-live="polite">
      <div class="status-spinner" aria-hidden="true"></div>
      <div class="status-content">
        <b class="status-title">${title || "Loading..."}</b>
        ${message ? `<p class="status-message sub-sm">${message}</p>` : ""}
      </div>
    </div>`;
  }
  if (type === "success") {
    return `<div class="status-state status-success" role="status" aria-live="polite">
      <span class="status-icon" aria-hidden="true">✓</span>
      <div class="status-content">
        <b class="status-title">${title || "Saved successfully!"}</b>
        ${message ? `<p class="status-message sub-sm">${message}</p>` : ""}
      </div>
    </div>`;
  }
  if (type === "empty") {
    return `<div class="status-state status-empty">
      <div class="status-icon" aria-hidden="true">📖</div>
      <div class="status-content">
        <b class="status-title">${title || "No items yet"}</b>
        <p class="status-message sub">${message || "Get started by selecting an activity below."}</p>
        ${actionLabel ? `<button class="btn sm" data-a="${actionA || 'tab'}" data-v="${actionV || 'practice'}">${actionLabel}</button>` : ""}
      </div>
    </div>`;
  }
  if (type === "offline") {
    return `<div class="status-state status-offline" role="status">
      <span class="status-icon" aria-hidden="true">📶</span>
      <div class="status-content">
        <b class="status-title">${title || "Working Offline"}</b>
        <p class="status-message sub-sm">${message || "All stories, tips, and answers are saved locally on this device."}</p>
      </div>
    </div>`;
  }
  if (type === "failure") {
    return `<div class="status-state status-failure" role="alert">
      <span class="status-icon" aria-hidden="true">⚠️</span>
      <div class="status-content">
        <b class="status-title">${title || "Something went wrong"}</b>
        <p class="status-message sub-sm">${message || "Your progress was kept in memory. You can safely try again."}</p>
        ${actionLabel ? `<button class="btn sm o" data-a="${actionA || 'retry'}" data-v="${actionV || ''}">${actionLabel}</button>` : ""}
      </div>
    </div>`;
  }
  return "";
}


