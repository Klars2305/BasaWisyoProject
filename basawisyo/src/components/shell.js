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
    } else {
      hdrStreak.innerHTML = "";
      hdrStreak.hidden = true;
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
      hdrAvatar.textContent = u.name ? u.name.charAt(0).toUpperCase() : "?";
      hdrName.textContent = u.name ? u.name.split(" ")[0] : "User";
      hdrRole.textContent = u.role.toUpperCase();
      hdrRole.className = "user-role-badge role-" + u.role;
    } else {
      hdrAvatar.innerHTML = uiIcon("user");
      hdrName.textContent = S.guestToken ? "Guest (" + S.guestToken + ")" : "Guest";
      hdrRole.textContent = "GUEST";
      hdrRole.className = "user-role-badge role-guest";
    }
  }
  if (hdrAuth) {
    hdrAuth.dataset.a = u ? "tab" : "auth-open";
    if (u) hdrAuth.dataset.v = role === "student" ? "profile" : role;
    else delete hdrAuth.dataset.v;
    hdrAuth.title = u ? `Open ${role === "student" ? "your profile" : "your dashboard"}` : "Sign in or create an account";
    hdrAuth.setAttribute("aria-label", hdrAuth.title);
  }
  if (hdrSession && hdrSessionLabel) {
    hdrSession.dataset.a = u ? "auth-logout" : "auth-open";
    hdrSessionLabel.textContent = u ? "Log Out" : "Sign In";
    hdrSession.setAttribute("aria-label", u ? "Log out and return to the landing page" : "Sign in");
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
    snEl.innerHTML = subnavItems.map(item => `
      <button data-a="tab" data-v="${item[0]}" class="${CURRENT_TAB === item[0] ? 'on' : ''}" ${CURRENT_TAB === item[0] ? 'aria-current="page"' : ''}>
        ${uiIcon(item[0])}<span>${item[1]}</span>
      </button>
    `).join("");
  }

  // Bottom Navigation tabs based on role
  const bottomTabs = bottomTabsForRole(role);

  const navEl = $("#nav");
  if (navEl) {
    navEl.innerHTML = bottomTabs.map(k => `
      <button data-a="tab" data-v="${k}" class="${CURRENT_TAB === k ? 'on' : ''}" ${CURRENT_TAB === k ? 'aria-current="page"' : ''}>
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
      case "admin": main.innerHTML = viewAdmin(); break;
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
}

