/* ==========================================================================
   UI Routing and Rendering
   ========================================================================== */
let LAST_RENDER_LOCATION = null;
function renderApp() {
  document.documentElement.setAttribute("data-theme", S.theme);
  document.documentElement.style.setProperty("--font-scale", S.fontScale);

  const showWelcome = !AUTH.currentUser && !GUEST_MODE;
  document.body.classList.toggle("auth-entry", showWelcome);
  $("#welcome-screen").hidden = !showWelcome;
  if (showWelcome) {
    LAST_RENDER_LOCATION = "welcome";
    return;
  }

  const u = AUTH.currentUser;
  const role = u ? u.role : "guest";

  // Update header level pill
  const pill = $("#lv-pill");
  if (pill) {
    pill.hidden = false;
    if (role === "teacher" || role === "admin") {
      pill.textContent = role === "teacher" ? (u.section || "Classroom") : (u.school || "School admin");
      pill.className = "pill";
    } else if (S.lvl === null) {
      pill.textContent = "Take Placement";
      pill.className = "pill";
    } else {
      pill.textContent = PHIL_IRI_LEVELS[S.lvl];
      pill.className = "pill " + (S.lvl >= 2 ? "ok" : S.lvl === 1 ? "warn" : "");
    }
  }
  const headerStatusDot = $(".app-header .header-status-dot");
  if (headerStatusDot) headerStatusDot.hidden = false;

  // Update header hearts badge
  const hdrHearts = $("#hdr-hearts-container");
  if (hdrHearts) {
    if ((role === "student" || role === "guest") && typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) {
      hdrHearts.innerHTML = typeof renderHeartPill === "function" ? renderHeartPill(true) : "";
      hdrHearts.hidden = false;
    } else {
      hdrHearts.innerHTML = "";
      hdrHearts.hidden = true;
    }
  }

  // Update header streak badge
  const hdrStreak = $("#hdr-streak-container");
  if (hdrStreak) {
    if (role === "student" || role === "guest") {
      hdrStreak.innerHTML = typeof renderStreakPill === "function" ? renderStreakPill() : "";
      hdrStreak.hidden = false;
      if (hdrStreak.dataset) {
        hdrStreak.dataset.a = "tab";
        hdrStreak.dataset.v = "quest";
      }
      if (typeof hdrStreak.setAttribute === "function") {
        hdrStreak.setAttribute("role", "button");
        hdrStreak.setAttribute("tabindex", "0");
      }
      hdrStreak.title = "View reading streak & daily quests";
    } else {
      hdrStreak.innerHTML = "";
      hdrStreak.hidden = true;
    }
  }

  // Update header upgrade badge
  const hdrUpgrade = $("#hdr-upgrade-container");
  if (hdrUpgrade) {
    if (role === "student" || role === "guest") {
      const isPrem = typeof isUserPremium === "function" && isUserPremium();
      hdrUpgrade.innerHTML = `
        <button type="button" class="hdr-upgrade-pill ${isPrem ? 'is-premium' : ''}" data-a="upgrade-open" title="${isPrem ? 'Wisyo Plus Active — Click to view plan' : 'Upgrade to Wisyo Plus'}">
          <span class="upgrade-crown" aria-hidden="true">👑</span>
          <span class="upgrade-text">Wisyo Plus</span>
          <svg class="upgrade-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      `;
      hdrUpgrade.hidden = false;
    } else {
      hdrUpgrade.innerHTML = "";
      hdrUpgrade.hidden = true;
    }
  }

  // Update user header badge
  const hdrAvatar = $("#hdr-user-avatar");
  const hdrName = $("#hdr-user-name");
  const hdrRole = $("#hdr-user-role");
  const hdrAuth = $("#hdr-auth-btn");
  const hdrSession = $("#hdr-session-btn");
  const hdrSessionLabel = $("#hdr-session-label");
  if (hdrAvatar && hdrName && hdrRole) {
    hdrAvatar.className = "user-avatar-dot";
    if (role === "student" || role === "guest") {
      hdrAvatar.classList.add("frame-" + journeySelectedFrame());
    }
    if (u) {
      if (role === "student") {
        hdrAvatar.innerHTML = `<img src="assets/images/wisyo.png" alt="${escapeHTML(u.name)}" class="hdr-avatar-img">`;
      } else {
        hdrAvatar.textContent = u.name ? u.name.charAt(0).toUpperCase() : "?";
      }
      hdrName.textContent = u.name ? u.name.split(" ")[0] : "User";
      hdrRole.textContent = u.role.toUpperCase();
      hdrRole.className = "user-role-badge role-" + u.role;
    } else {
      hdrAvatar.innerHTML = `<img src="assets/images/wisyo.png" alt="Guest" class="hdr-avatar-img">`;
      hdrName.textContent = S.guestToken ? "Guest (" + S.guestToken + ")" : "Guest";
      hdrRole.textContent = "GUEST";
      hdrRole.className = "user-role-badge role-guest";
    }
  }
  if (hdrAuth) {
    if (hdrAuth.dataset) {
      hdrAuth.dataset.a = u ? "tab" : "auth-open";
      if (u) hdrAuth.dataset.v = role === "student" ? "profile" : role;
      else delete hdrAuth.dataset.v;
    }
    hdrAuth.title = u ? `Open ${role === "student" ? "your profile" : "your dashboard"}` : "Sign in or create an account";
    if (typeof hdrAuth.setAttribute === "function") {
      hdrAuth.setAttribute("aria-label", hdrAuth.title);
    }
  }
  if (hdrSession && hdrSessionLabel) {
    if (hdrSession.dataset) {
      hdrSession.dataset.a = u ? "auth-logout" : "auth-open";
    }
    hdrSessionLabel.textContent = u ? "Log Out" : "Sign In";
    if (typeof hdrSession.setAttribute === "function") {
      hdrSession.setAttribute("aria-label", u ? "Log out and return to the landing page" : "Sign in");
    }
    const sessionIcon = typeof hdrSession.querySelector === "function" ? hdrSession.querySelector(".session-icon") : null;
    if (sessionIcon) {
      sessionIcon.innerHTML = u
        ? `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`
        : `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>`;
    }
  }

  // Top subnav pills based on role
  let subnavItems = [
    ["home", "Home"],
    ["practice", "All Passages"],
    ["flashcards", "Flashcards"],
    ["studio", "Reading Studio"],
    ["board", "Class Board"],
    ["quest", "Bayanihan"],
    ["about", "About"],
    ["services", "Programs"]
  ];
  if (role === "teacher") {
    subnavItems = [
      ["teacher", "Classroom Hub"],
      ["teacher-studio", "Reading Studio"],
      ["home", "Class Overview"],
      ["practice", "Passage Library"],
      ["board", "Class Board"],
      ["reports", "Reports (Demo)"]
    ];
  } else if (role === "admin") {
    subnavItems = [
      ["admin", "Admin Console"],
      ["practice", "Curriculum"],
      ["reports", "Reports (Demo)"],
      ["home", "App Preview"]
    ];
  }

  const snEl = $("#sn");
  if (snEl) {
    snEl.innerHTML = typeof renderNavButtons === "function"
      ? renderNavButtons(role, CURRENT_TAB, true)
      : subnavItems.map(item => `
          <button data-a="tab" data-v="${item[0]}" data-nav-route="${item[0]}" class="${CURRENT_TAB === item[0] ? 'on' : ''}" ${CURRENT_TAB === item[0] ? 'aria-current="page"' : ''}>
            ${uiIcon(item[0])}<span>${item[1]}</span>
          </button>
        `).join("");
  }

  // Bottom Navigation tabs based on role
  const bottomTabs = bottomTabsForRole(role);

  const navEl = $("#nav");
  if (navEl) {
    navEl.innerHTML = typeof renderNavButtons === "function"
      ? renderNavButtons(role, CURRENT_TAB, false)
      : bottomTabs.map(k => `
          <button data-a="tab" data-v="${k}" data-nav-route="${k}" class="${CURRENT_TAB === k ? 'on' : ''}" ${CURRENT_TAB === k ? 'aria-current="page"' : ''}>
            ${uiIcon(k)}
            <span>${role === "guest" && k === "profile" ? "My Progress" : role === "teacher" && k === "home" ? "Overview" : TAB_TITLES[k] || k}</span>
          </button>
        `).join("");
  }

  // Render view, active quiz, or quiz result
  const main = $("#v");
  if (ACTIVE_QUIZ) {
    renderQuiz();
  } else if (QUIZ_RESULT) {
    renderQuizResult();
  } else {
    switch (CURRENT_TAB) {
      case "home": main.innerHTML = role === "teacher" ? viewTeacherOverview() : viewHome(); break;
      case "teacher-preview": main.innerHTML = viewTeacherLearnerPreview(); break;
      case "assess": main.innerHTML = viewAssess(); break;
      case "practice": main.innerHTML = viewPractice(); break;
      case "studio": main.innerHTML = typeof viewReadingStudio === "function" ? viewReadingStudio() : viewHome(); break;
      case "teacher-studio": main.innerHTML = typeof viewTeacherReadingStudio === "function" ? viewTeacherReadingStudio() : viewTeacher(); break;
      case "flashcards": main.innerHTML = viewFlashcards(); break;
      case "quest": main.innerHTML = viewQuest(); break;
      case "board": main.innerHTML = viewClassBoard(); break;
      case "reports": main.innerHTML = viewReports(); break;
      case "profile": main.innerHTML = viewProfile(); break;
      case "parent": main.innerHTML = viewParent(); break;
      case "about": main.innerHTML = viewAbout(); break;
      case "services": main.innerHTML = viewServices(); break;
      case "teacher": main.innerHTML = viewTeacher(); break;
      case "students": main.innerHTML = viewTeacher(); break;
      case "admin": main.innerHTML = viewAdmin(); break;
      case "users": main.innerHTML = viewAdmin(); break;
      case "classes": main.innerHTML = viewAdmin(); break;
      case "settings": main.innerHTML = viewAdmin(); break;
      default: main.innerHTML = viewHome();
    }
  }

  const location = ACTIVE_QUIZ ? "quiz" : QUIZ_RESULT ? "quiz-result" : `tab:${CURRENT_TAB}`;
  if (location !== LAST_RENDER_LOCATION) {
    LAST_RENDER_LOCATION = location;
    if ((ACTIVE_QUIZ || QUIZ_RESULT) && main?.scrollIntoView) {
      main.scrollIntoView({ block: "start", behavior: "auto" });
    } else {
      window.scrollTo?.({ top: 0, behavior: "auto" });
    }
  }

  // Onboarding tour check & repositioning
  if (typeof getActiveTour === "function" && getActiveTour() && getActiveTour().active) {
    if (typeof positionTourSpotlightAndCard === "function") {
      const step = getActiveTour().steps[getActiveTour().stepIndex];
      if (step) positionTourSpotlightAndCard(step);
    }
  } else if (!ACTIVE_QUIZ && !QUIZ_RESULT && !showWelcome) {
    if (typeof checkAndAutoStartOnboardingTour === "function") {
      checkAndAutoStartOnboardingTour();
    }
  }
}

