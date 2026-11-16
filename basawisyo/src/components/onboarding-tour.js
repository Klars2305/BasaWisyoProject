/* ==========================================================================
   BasaWisyo - Interactive Onboarding Tour UI Component (onboarding-tour.js)
   Visual spotlight overlay, accessible dialog, keyboard controls, and
   viewport-safe mobile responsive positioning.
   ========================================================================== */

let ACTIVE_TOUR = null;
let TOUR_KEY_LISTENER = null;
let TOUR_REPOSITION_LISTENER = null;
let TOUR_VISUAL_VIEWPORT_LISTENER = null;
let IS_TRANSITIONING = false;
let LAST_FOCUSED_ELEMENT = null;
let CURRENT_RENDER_TOKEN = 0;

function getActiveTour() {
  return ACTIVE_TOUR;
}

function startOnboardingTour(tourId) {
  const def = typeof getTourDefinition === "function" ? getTourDefinition(tourId) : null;
  if (!def || !Array.isArray(def.steps) || def.steps.length === 0) return false;

  closeTourOverlay();

  if (typeof document !== "undefined" && document.activeElement) {
    LAST_FOCUSED_ELEMENT = document.activeElement;
  }

  ACTIVE_TOUR = {
    tourId,
    definition: def,
    stepIndex: 0,
    steps: def.steps,
    active: true
  };

  const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
  if (typeof saveTourStatus === "function") {
    saveTourStatus(userId, tourId, "in_progress", 0);
  }

  renderTourStep();
  bindTourEventListeners();
  return true;
}

function nextTourStep() {
  if (!ACTIVE_TOUR) return;
  if (ACTIVE_TOUR.stepIndex < ACTIVE_TOUR.steps.length - 1) {
    ACTIVE_TOUR.stepIndex++;
    const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
    if (typeof saveTourStatus === "function") {
      saveTourStatus(userId, ACTIVE_TOUR.tourId, "in_progress", ACTIVE_TOUR.stepIndex);
    }
    renderTourStep();
  } else {
    finishOnboardingTour();
  }
}

function prevTourStep() {
  if (!ACTIVE_TOUR) return;
  if (ACTIVE_TOUR.stepIndex > 0) {
    ACTIVE_TOUR.stepIndex--;
    const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
    if (typeof saveTourStatus === "function") {
      saveTourStatus(userId, ACTIVE_TOUR.tourId, "in_progress", ACTIVE_TOUR.stepIndex);
    }
    renderTourStep();
  }
}

function skipOnboardingTour() {
  if (!ACTIVE_TOUR) return;
  const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
  if (typeof saveTourStatus === "function") {
    saveTourStatus(userId, ACTIVE_TOUR.tourId, "skipped", ACTIVE_TOUR.stepIndex);
  }
  closeTourOverlay();
  if (typeof showToast === "function") {
    showToast("Tutorial skipped. You can replay it anytime from your Profile! 🦉", "info");
  }
}

function finishOnboardingTour() {
  if (!ACTIVE_TOUR) return;
  const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
  if (typeof saveTourStatus === "function") {
    saveTourStatus(userId, ACTIVE_TOUR.tourId, "completed", ACTIVE_TOUR.steps.length - 1);
  }
  closeTourOverlay();
  if (typeof showToast === "function") {
    showToast("Tutorial finished! Enjoy your reading journey! 🎉", "ok");
  }
}

function closeTourOverlay() {
  ACTIVE_TOUR = null;
  IS_TRANSITIONING = false;
  CURRENT_RENDER_TOKEN++;
  unbindTourEventListeners();
  const el = document.getElementById("tour-overlay");
  if (el && typeof el.remove === "function") el.remove();

  if (LAST_FOCUSED_ELEMENT && typeof LAST_FOCUSED_ELEMENT.focus === "function") {
    try {
      LAST_FOCUSED_ELEMENT.focus();
    } catch (e) {}
    LAST_FOCUSED_ELEMENT = null;
  }
}

function findTargetElement(selector) {
  if (!selector) return null;
  const parts = selector.split(",").map(s => s.trim());
  for (const part of parts) {
    try {
      const candidates = (typeof document !== "undefined" && typeof document.querySelectorAll === "function")
        ? Array.from(document.querySelectorAll(part))
        : (document.querySelector ? [document.querySelector(part)] : []);

      for (const el of candidates) {
        if (!el) continue;
        const isHidden = (typeof el.hasAttribute === "function" && el.hasAttribute("hidden")) ||
                         (el.style && el.style.display === "none");
        if (isHidden) continue;

        // Check if element or ancestor is hidden (e.g. #sn on mobile or nav on desktop)
        let ancestor = el;
        let isAncestorHidden = false;
        while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
          if (ancestor.style && ancestor.style.display === "none") {
            isAncestorHidden = true;
            break;
          }
          if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
            try {
              const comp = window.getComputedStyle(ancestor);
              if (comp.display === "none" || comp.visibility === "hidden") {
                isAncestorHidden = true;
                break;
              }
            } catch (err) {}
          }
          ancestor = ancestor.parentElement;
        }

        if (!isAncestorHidden) {
          return el;
        }
      }
    } catch (e) {}
  }
  return null;
}

function scrollTargetIntoView(target) {
  if (!target || typeof target.getBoundingClientRect !== "function") return;

  // 1. Horizontal scroll for container like #sn or any horizontally scrollable container
  let parent = target.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    try {
      const isScrollable = (parent.scrollWidth > parent.clientWidth + 2) || parent.id === "sn";
      if (isScrollable) {
        const style = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(parent) : {};
        const ox = style.overflowX || "";
        if (ox === "auto" || ox === "scroll" || parent.id === "sn") {
          const pRect = parent.getBoundingClientRect();
          const tRect = target.getBoundingClientRect();
          // If target is cut off on left or right inside parent
          if (tRect.left < pRect.left + 8 || tRect.right > pRect.right - 8) {
            const offset = (tRect.left - pRect.left) - ((parent.clientWidth - tRect.width) / 2);
            parent.scrollLeft += offset;
          }
        }
      }
    } catch (e) {}
    parent = parent.parentElement;
  }

  // 2. Vertical scroll if outside usable area
  try {
    const rect = target.getBoundingClientRect();
    const vh = (typeof window !== "undefined" && window.visualViewport)
      ? window.visualViewport.height
      : (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768);
    const navEl = document.getElementById("nav") || (typeof document !== "undefined" && document.querySelector ? document.querySelector("nav") : null);
    const bottomNavHeight = (navEl && navEl.offsetHeight) ? navEl.offsetHeight : 64;

    if (rect.top < 64 || rect.bottom > (vh - bottomNavHeight - 8)) {
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
    }
  } catch (e) {}
}

function setTourButtonsDisabled(disabled) {
  const card = document.getElementById("tour-card");
  if (!card) {
    IS_TRANSITIONING = false;
    return;
  }
  const buttons = card.querySelectorAll(".tour-btn");
  buttons.forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      btn.setAttribute("aria-busy", "true");
    } else {
      btn.removeAttribute("aria-busy");
    }
  });
}

function positionTourSpotlightAndCard(step, targetEl = null) {
  const spotlight = document.getElementById("tour-spotlight");
  const card = document.getElementById("tour-card");
  if (!card || !spotlight) return;

  const target = targetEl || findTargetElement(step.target);

  if (!target || typeof target.getBoundingClientRect !== "function") {
    // If target not visible or missing, center card gracefully without spotlight
    spotlight.style.display = "none";
    card.style.top = "50%";
    card.style.left = "50%";
    card.style.transform = "translate(-50%, -50%)";
    card.style.maxWidth = "min(420px, calc(100vw - 24px))";
    return;
  }

  spotlight.style.display = "block";

  // Visual viewport metrics
  const vv = (typeof window !== "undefined") ? window.visualViewport : null;
  const vw = vv ? vv.width : (typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024);
  const vh = vv ? vv.height : (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768);
  const vTop = vv ? vv.offsetTop : 0;
  const vLeft = vv ? vv.offsetLeft : 0;

  const rect = target.getBoundingClientRect();
  const pad = 6;

  // Clamped spotlight bounds to avoid any layout overflow
  const sTop = Math.max(0, rect.top - pad);
  const sLeft = Math.max(0, rect.left - pad);
  const sRight = Math.min(vw, rect.right + pad);
  const sBottom = Math.min(vh, rect.bottom + pad);
  const sWidth = Math.max(0, sRight - sLeft);
  const sHeight = Math.max(0, sBottom - sTop);

  spotlight.style.top = (vTop + sTop) + "px";
  spotlight.style.left = (vLeft + sLeft) + "px";
  spotlight.style.width = sWidth + "px";
  spotlight.style.height = sHeight + "px";

  // Card dimensions and safe bounds
  const cardWidth = Math.min(420, vw - 24);
  const cardHeight = card.offsetHeight || 220;
  const navEl = document.getElementById("nav") || (typeof document !== "undefined" && document.querySelector ? document.querySelector("nav") : null);
  const bottomNavHeight = (navEl && navEl.offsetHeight) ? navEl.offsetHeight : 64;

  const safeTop = vTop + 12;
  const safeBottom = vTop + vh - bottomNavHeight - 12;

  let top = vTop + rect.bottom + 12;

  // If placement prefers top or overflows bottom, attempt positioning above
  if (step.position === "top" || (top + cardHeight > safeBottom)) {
    const topAbove = vTop + rect.top - cardHeight - 12;
    if (topAbove >= safeTop) {
      top = topAbove;
    } else if (top + cardHeight > safeBottom) {
      top = Math.max(safeTop, Math.min(top, safeBottom - cardHeight));
    }
  }

  // Horizontally center card relative to target, clamped inside viewport
  let left = vLeft + rect.left + (rect.width / 2) - (cardWidth / 2);
  left = Math.max(vLeft + 12, Math.min(left, vLeft + vw - cardWidth - 12));

  card.style.top = Math.round(top) + "px";
  card.style.left = Math.round(left) + "px";
  card.style.transform = "none";
}

function renderTourStep() {
  if (!ACTIVE_TOUR) return;
  const step = ACTIVE_TOUR.steps[ACTIVE_TOUR.stepIndex];
  if (!step) return;

  IS_TRANSITIONING = true;
  CURRENT_RENDER_TOKEN++;
  const thisToken = CURRENT_RENDER_TOKEN;

  // Auto-switch tab if step requires it and user role allows it
  if (step.preferredTab && typeof CURRENT_TAB !== "undefined" && CURRENT_TAB !== step.preferredTab) {
    const role = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.role : "guest";
    const isStudent = role === "student" || role === "guest";
    const isUnplaced = isStudent && (typeof S !== "undefined" && S.lvl === null);

    // Unplaced students must not be redirected outside assessment/home/profile
    if (!(isUnplaced && step.preferredTab !== "assess" && step.preferredTab !== "home" && step.preferredTab !== "profile")) {
      CURRENT_TAB = step.preferredTab;
      if (typeof renderApp === "function") renderApp();
    }
  }

  let overlay = document.getElementById("tour-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "tour-overlay";
    overlay.className = "tour-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Interactive Onboarding Guide");
    overlay.innerHTML = `
      <div class="tour-backdrop" data-a="tour-noop"></div>
      <div class="tour-spotlight" id="tour-spotlight"></div>
      <div class="tour-card" id="tour-card" role="document"></div>
    `;
    document.body.appendChild(overlay);
  }

  const card = document.getElementById("tour-card");
  if (!card) {
    IS_TRANSITIONING = false;
    return;
  }

  const isFirst = ACTIVE_TOUR.stepIndex === 0;
  const isLast = ACTIVE_TOUR.stepIndex === ACTIVE_TOUR.steps.length - 1;
  const stepNumber = ACTIVE_TOUR.stepIndex + 1;
  const totalSteps = ACTIVE_TOUR.steps.length;

  card.innerHTML = `
    <div class="tour-header">
      <div class="tour-mascot-badge" aria-hidden="true">
        <img src="assets/images/wisyo.png" alt="">
      </div>
      <div class="tour-meta">
        <div class="tour-badge-row">
          <span class="tour-badge">${escapeHTML(step.badge || "GUIDE")}</span>
          <span class="tour-step-pill">Step ${stepNumber} of ${totalSteps}</span>
        </div>
        <h3 class="tour-title" id="tour-step-title">${escapeHTML(step.title)}</h3>
      </div>
    </div>
    <p class="tour-text">${escapeHTML(step.text)}</p>
    <div class="tour-actions">
      <button type="button" class="tour-btn tour-btn-skip" data-a="tour-skip" aria-label="Skip entire tutorial">Skip Tour</button>
      <div class="tour-btn-group-right">
        ${!isFirst ? `<button type="button" class="tour-btn tour-btn-prev" data-a="tour-prev" aria-label="Go to previous step">← Back</button>` : ""}
        <button type="button" class="tour-btn ${isLast ? 'tour-btn-finish' : 'tour-btn-next'}" data-a="${isLast ? 'tour-finish' : 'tour-next'}" id="tour-primary-btn" aria-label="${isLast ? 'Finish tutorial' : 'Go to next step'}">
          ${isLast ? "Finish 🎉" : "Next →"}
        </button>
      </div>
    </div>
  `;

  // Temporarily disable buttons while layout settles
  setTourButtonsDisabled(true);

  const hasRaf = typeof requestAnimationFrame === "function";
  if (hasRaf) {
    requestAnimationFrame(() => {
      if (!ACTIVE_TOUR || thisToken !== CURRENT_RENDER_TOKEN) return;
      const target = findTargetElement(step.target);
      if (target) {
        scrollTargetIntoView(target);
      }

      requestAnimationFrame(() => {
        if (!ACTIVE_TOUR || thisToken !== CURRENT_RENDER_TOKEN) return;
        positionTourSpotlightAndCard(step, target);
        setTourButtonsDisabled(false);
        IS_TRANSITIONING = false;

        // Focus primary button for accessible keyboard navigation
        const primaryBtn = document.getElementById("tour-primary-btn");
        if (primaryBtn && typeof primaryBtn.focus === "function") {
          primaryBtn.focus();
        }
      });
    });
  } else {
    // Immediate synchronous layout settling for Node / headless test environments
    const target = findTargetElement(step.target);
    if (target) {
      scrollTargetIntoView(target);
    }
    positionTourSpotlightAndCard(step, target);
    setTourButtonsDisabled(false);
    IS_TRANSITIONING = false;

    const primaryBtn = document.getElementById("tour-primary-btn");
    if (primaryBtn && typeof primaryBtn.focus === "function") {
      primaryBtn.focus();
    }
  }
}

function bindTourEventListeners() {
  if (!TOUR_KEY_LISTENER) {
    TOUR_KEY_LISTENER = e => {
      if (!ACTIVE_TOUR) return;
      if (e.key === "Escape") {
        e.preventDefault();
        skipOnboardingTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!IS_TRANSITIONING) nextTourStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!IS_TRANSITIONING) prevTourStep();
      } else if (e.key === "Tab") {
        // Focus trap inside tour card
        const card = document.getElementById("tour-card");
        if (card && typeof card.querySelectorAll === "function") {
          const focusables = card.querySelectorAll("button:not([disabled]), [tabindex]:not([tabindex='-1'])");
          if (focusables.length > 0) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
    };
    window.addEventListener("keydown", TOUR_KEY_LISTENER);
  }

  if (!TOUR_REPOSITION_LISTENER) {
    let rafPending = false;
    TOUR_REPOSITION_LISTENER = () => {
      if (!ACTIVE_TOUR || rafPending) return;
      rafPending = true;
      const scheduleRaf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : (cb => setTimeout(cb, 16));
      scheduleRaf(() => {
        rafPending = false;
        if (ACTIVE_TOUR) {
          const step = ACTIVE_TOUR.steps[ACTIVE_TOUR.stepIndex];
          if (step) positionTourSpotlightAndCard(step);
        }
      });
    };

    window.addEventListener("resize", TOUR_REPOSITION_LISTENER, { passive: true });
    window.addEventListener("scroll", TOUR_REPOSITION_LISTENER, { passive: true });
    if (typeof window.addEventListener === "function") {
      window.addEventListener("orientationchange", TOUR_REPOSITION_LISTENER, { passive: true });
    }

    if (typeof window !== "undefined" && window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
      TOUR_VISUAL_VIEWPORT_LISTENER = TOUR_REPOSITION_LISTENER;
      window.visualViewport.addEventListener("resize", TOUR_VISUAL_VIEWPORT_LISTENER, { passive: true });
      window.visualViewport.addEventListener("scroll", TOUR_VISUAL_VIEWPORT_LISTENER, { passive: true });
    }
  }
}

function unbindTourEventListeners() {
  if (TOUR_KEY_LISTENER) {
    window.removeEventListener("keydown", TOUR_KEY_LISTENER);
    TOUR_KEY_LISTENER = null;
  }
  if (TOUR_REPOSITION_LISTENER) {
    window.removeEventListener("resize", TOUR_REPOSITION_LISTENER);
    window.removeEventListener("scroll", TOUR_REPOSITION_LISTENER);
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("orientationchange", TOUR_REPOSITION_LISTENER);
    }
    TOUR_REPOSITION_LISTENER = null;
  }
  if (TOUR_VISUAL_VIEWPORT_LISTENER && typeof window !== "undefined" && window.visualViewport && typeof window.visualViewport.removeEventListener === "function") {
    window.visualViewport.removeEventListener("resize", TOUR_VISUAL_VIEWPORT_LISTENER);
    window.visualViewport.removeEventListener("scroll", TOUR_VISUAL_VIEWPORT_LISTENER);
    TOUR_VISUAL_VIEWPORT_LISTENER = null;
  }
}

function checkAndAutoStartOnboardingTour() {
  if (typeof shouldAutoStartTour !== "function") return;
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const state = typeof S !== "undefined" ? S : {};
  const recommendation = shouldAutoStartTour(user, state);
  if (recommendation && recommendation.tourId) {
    setTimeout(() => {
      startOnboardingTour(recommendation.tourId);
    }, 400);
  }
}

function replayCurrentRoleTour() {
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const state = typeof S !== "undefined" ? S : {};
  const tourId = typeof resolveAutoTourId === "function" ? resolveAutoTourId(user, state) : "student-unplaced";
  const userId = user ? user.id : "guest";
  if (typeof resetTourStatus === "function") {
    resetTourStatus(userId, tourId);
  }
  startOnboardingTour(tourId);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getActiveTour,
    startOnboardingTour,
    nextTourStep,
    prevTourStep,
    skipOnboardingTour,
    finishOnboardingTour,
    closeTourOverlay,
    findTargetElement,
    scrollTargetIntoView,
    positionTourSpotlightAndCard,
    checkAndAutoStartOnboardingTour,
    replayCurrentRoleTour
  };
}
