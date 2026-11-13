/* ==========================================================================
   UI Routing and Rendering
   ========================================================================== */
function renderApp() {
  document.documentElement.setAttribute("data-theme", S.theme);
  document.documentElement.style.setProperty("--font-scale", S.fontScale);

  const showWelcome = !AUTH.currentUser && !GUEST_MODE;
  document.body.classList.toggle("auth-entry", showWelcome);
  $("#welcome-screen").hidden = !showWelcome;
  if (showWelcome) return;

  const u = AUTH.currentUser;
  const role = u ? u.role : "guest";

  // Update header level pill
  const pill = $("#lv-pill");
  if (pill) {
    if (S.lvl === null) {
      pill.textContent = "Take Placement";
      pill.className = "pill";
    } else {
      pill.textContent = PHIL_IRI_LEVELS[S.lvl];
      pill.className = "pill " + (S.lvl >= 2 ? "ok" : S.lvl === 1 ? "warn" : "");
    }
  }

  // Update user header badge
  const hdrAvatar = $("#hdr-user-avatar");
  const hdrName = $("#hdr-user-name");
  const hdrRole = $("#hdr-user-role");
  if (hdrAvatar && hdrName && hdrRole) {
    if (u) {
      hdrAvatar.textContent = u.name ? u.name.charAt(0).toUpperCase() : "👤";
      hdrName.textContent = u.name ? u.name.split(" ")[0] : "User";
      hdrRole.textContent = u.role.toUpperCase();
      hdrRole.className = "user-role-badge role-" + u.role;
    } else {
      hdrAvatar.textContent = "👤";
      hdrName.textContent = S.guestToken ? "Guest (" + S.guestToken + ")" : "Guest";
      hdrRole.textContent = "GUEST";
      hdrRole.className = "user-role-badge role-guest";
    }
  }

  // Top subnav pills based on role
  let subnavItems = [
    ["home", "🏠 Home"],
    ["practice", "📚 All Passages"],
    ["quest", "🤝 Bayanihan"],
    ["about", "ℹ️ About"],
    ["services", "✨ Programs"]
  ];
  if (role === "teacher") {
    subnavItems = [
      ["teacher", "🏫 Classroom Hub"],
      ["home", "🏠 Student View"],
      ["practice", "📚 Passage Library"],
      ["reports", "📊 DepEd Form 14"]
    ];
  } else if (role === "admin") {
    subnavItems = [
      ["admin", "🛡️ Admin Console"],
      ["practice", "📚 Curriculum"],
      ["reports", "📊 DepEd Form 14"],
      ["home", "🏠 App Preview"]
    ];
  }

  const snEl = $("#sn");
  if (snEl) {
    snEl.innerHTML = subnavItems.map(item => `
      <button data-a="tab" data-v="${item[0]}" class="${CURRENT_TAB === item[0] ? 'on' : ''}">
        ${item[1]}
      </button>
    `).join("");
  }

  // Bottom Navigation tabs based on role
  let bottomTabs = ["home", "assess", "practice", "quest", "reports", "parent"];
  if (role === "teacher") {
    bottomTabs = ["teacher", "home", "assess", "practice", "reports"];
  } else if (role === "admin") {
    bottomTabs = ["admin", "practice", "assess", "reports", "home"];
  }

  const navEl = $("#nav");
  if (navEl) {
    navEl.innerHTML = bottomTabs.map(k => `
      <button data-a="tab" data-v="${k}" class="${CURRENT_TAB === k ? 'on' : ''}">
        ${ICONS[k] || ''}
        <span>${TAB_TITLES[k] || k}</span>
      </button>
    `).join("");
  }

  // Render view or active quiz
  const main = $("#v");
  if (ACTIVE_QUIZ) {
    renderQuiz();
  } else {
    switch (CURRENT_TAB) {
      case "home": main.innerHTML = viewHome(); break;
      case "assess": main.innerHTML = viewAssess(); break;
      case "practice": main.innerHTML = viewPractice(); break;
      case "quest": main.innerHTML = viewQuest(); break;
      case "reports": main.innerHTML = viewReports(); break;
      case "parent": main.innerHTML = viewParent(); break;
      case "about": main.innerHTML = viewAbout(); break;
      case "services": main.innerHTML = viewServices(); break;
      case "teacher": main.innerHTML = viewTeacher(); break;
      case "admin": main.innerHTML = viewAdmin(); break;
      default: main.innerHTML = viewHome();
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

