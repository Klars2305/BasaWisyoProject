function dashboardTabForRole(role) {
  return role === "teacher" ? "teacher" : role === "admin" ? "admin" : "home";
}

function openRegistration() {
  $("#auth-modal").hidden = false;
  $("#role-card-student")?.click();
}

function logoutToIndex() {
  if (!AUTH.logout()) {
    showToast("Could not sign out in this browser. Please try again.", "warn");
    return;
  }
  GUEST_MODE = false;
  ACTIVE_QUIZ = null;
  CURRENT_TAB = "home";
  $("#auth-modal").hidden = true;
  window.location.replace("index.html");
}

/* ==========================================================================
   Global Event Delegations
   ========================================================================== */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-a]");
  if (!t) return;
  const a = t.dataset.a;
  const v = t.dataset.v;

  // Tabs
  if (a === "tab") {
    CURRENT_TAB = v;
    ACTIVE_QUIZ = null;
    renderApp();
  }

  // Difficulty filter in practice
  else if (a === "filter-diff") {
    S.activeDiff = v;
    CURRENT_TAB = "practice";
    renderApp();
  }

  // Start placement diagnostic
  else if (a === "start-placement") {
    if (!AUTH.currentUser) GUEST_MODE = true;
    $("#auth-modal").hidden = true;
    startQuiz(PLACEMENT_TEST, "pl", "Phil-IRI Diagnostic Placement");
  }

  // Read specific passage in practice
  else if (a === "read-passage") {
    const found = getPublishedPassageById(v);
    if (found) {
      startQuiz([found], "pr", `Practice: ${found.t}`);
    }
  }

  // Answer selection in quiz
  else if (a === "submit-answer") {
    handleAnswer(parseInt(v, 10));
  }

  // Next question in quiz
  else if (a === "quiz-next") {
    handleQuizNext();
  }

  // Quit quiz early
  else if (a === "quit-quiz") {
    if (confirm("Are you sure you want to exit? Your progress in this quiz will be cancelled.")) {
      ACTIVE_QUIZ = null;
      renderApp();
    }
  }

  // Trilingual dictionary tooltip
  else if (a === "tip") {
    const wordKey = v.toLowerCase();
    const entry = D[wordKey];
    if (entry) {
      const tip = $("#tip");
      tip.hidden = false;
      tip.innerHTML = `
        <div class="tip-header">
          <div style="display:flex;align-items:center;gap:6px">
            <b style="font-size:1.1rem;color:var(--navy);text-transform:capitalize">${wordKey}</b>
            <button class="icon-btn" data-a="speech-speak-word" data-v="${wordKey}" style="width:26px;height:26px;font-size:12px" title="Pronounce word">🔊</button>
          </div>
          <button class="icon-btn" data-a="tip-close" style="width:24px;height:24px;font-size:11px">✕</button>
        </div>
        <div style="font-size:0.875rem;line-height:1.5">
          <div>🇵🇭 <b>Filipino:</b> ${entry[0]}</div>
          <div>🏝️ <b>Bisaya:</b> ${entry[1]}</div>
          <div style="margin-top:4px">📖 <b>English:</b> ${entry[2]}</div>
        </div>
      `;
    }
  }
  else if (a === "tip-close") {
    $("#tip").hidden = true;
  }
  else if (a === "speech-speak-word") {
    speak(v);
  }

  // Read whole passage aloud
  else if (a === "speech-read") {
    if (ACTIVE_QUIZ) {
      speak(ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].P.x);
      showToast("Playing audio narration...");
    }
  }

  // Font scale controls
  else if (a === "font-inc") {
    S.fontScale = Math.min(1.35, S.fontScale + 0.1);
    save();
    renderApp();
  }
  else if (a === "font-dec") {
    S.fontScale = Math.max(0.85, S.fontScale - 0.1);
    save();
    renderApp();
  }

  // AI Tutor interactions
  else if (a === "ai-open") {
    aiOpen();
  }
  else if (a === "ai-close") {
    $("#ai").hidden = true;
  }
  else if (a === "ai-clear") {
    CHAT_HISTORY = [];
    aiOpen();
  }
  else if (a === "ai-chip") {
    aiSend(v);
  }
  else if (a === "ai-send") {
    const inp = $("#aii");
    const val = inp.value;
    inp.value = "";
    aiSend(val);
  }
  else if (a === "ai-explain-why") {
    aiOpen("Explain my last mistake and help me fix it.");
  }

  // BasaMesh Share Actions
  else if (a === "mesh-create") {
    const title = $("#mesh-title").value.trim();
    const text = $("#mesh-text").value.trim();
    if (!title || !text) {
      showToast("Please enter both a title and passage text.");
      return;
    }
    const payload = JSON.stringify({ t: title, x: text });
    const code = btoa(unescape(encodeURIComponent(payload)));
    $("#mesh-code").value = code;
    try {
      navigator.clipboard.writeText(code);
      showToast("Share code generated and copied to clipboard!");
    } catch(e) {
      showToast("Share code generated in the box below!");
    }
  }
  else if (a === "mesh-import") {
    try {
      const raw = $("#mesh-code").value.trim();
      const decoded = decodeURIComponent(escape(atob(raw)));
      const obj = JSON.parse(decoded);
      if (!obj.t || !obj.x) throw new Error();

      S.sh.push({
        id: "mesh_" + Date.now(),
        t: obj.t,
        x: obj.x,
        diff: "medium",
        qs: [
          {
            q: `What is the main topic of "${obj.t}"?`,
            o: ["Personal experience", "Scientific discovery", "Community reflection", "General knowledge"],
            a: 0,
            k: "Main idea"
          }
        ]
      });
      save();
      showToast(`Imported "${obj.t}"! Available under Practice.`);
      CURRENT_TAB = "practice";
      renderApp();
    } catch(e) {
      showToast("Invalid share code. Please paste the complete string.");
    }
  }

  // Modals & Reports
  else if (a === "open-report-sheet") {
    openForm14Modal();
  }
  else if (a === "modal-close") {
    $("#md").hidden = true;
  }
  else if (a === "download-csv") {
    downloadCSV();
  }
  else if (a === "print-sheet") {
    window.print();
  }

  // Parent Features
  else if (a === "sub-toggle") {
    S.sub = S.sub ? 0 : 1;
    save();
    renderApp();
    showToast(S.sub ? "Demo Subscription Active! All features unlocked." : "Demo Subscription Deactivated.");
  }
  else if (a === "copy-ofw-msg") {
    const text = $("#ofw-msg").textContent.trim();
    try {
      navigator.clipboard.writeText(text);
      showToast("Message copied! Ready to paste into Messenger or SMS.");
    } catch(e) {
      showToast("Select the message to copy manually.");
    }
  }
  else if (a === "calc-tutor") {
    S.pay = parseFloat($("#tutor-rate").value) || 0;
    S.pm = parseFloat($("#tutor-sessions").value) || 0;
    save();
    renderApp();
    showToast("Monthly comparison updated!");
  }
  // Entry screen and account modal
  else if (a === "entry-guest") {
    GUEST_MODE = true;
    CURRENT_TAB = "home";
    renderApp();
  }

  // Auth Modal Opening & Closing
  else if (a === "auth-open") {
    const u = AUTH.currentUser;
    if (u) {
      if (confirm(`Currently signed in as ${u.name} (${u.role.toUpperCase()}). Would you like to sign out?`)) {
        logoutToIndex();
      }
    } else if (v === "register") {
      openRegistration();
    } else {
      window.location.assign("login.html");
    }
  }
  else if (a === "auth-close") {
    const modal = $("#auth-modal");
    if (modal) modal.hidden = true;
  }
  else if (a === "auth-select-role") {
    $$(".role-choice-card").forEach(c => c.classList.remove("selected"));
    t.classList.add("selected");
    const roleInput = $("#reg-role");
    if (roleInput) roleInput.value = v;

    const studGroup = $("#reg-group-student");
    const teachGroup = $("#reg-group-teacher");
    const adminGroup = $("#reg-group-admin");

    if (studGroup) studGroup.hidden = (v !== "student");
    if (teachGroup) teachGroup.hidden = (v !== "teacher");
    if (adminGroup) adminGroup.hidden = (v !== "admin");
  }
  else if (a === "auth-register-submit") {
    const name = $("#reg-name")?.value;
    const email = $("#reg-email")?.value;
    const password = $("#reg-password")?.value;
    const role = $("#reg-role")?.value || "student";
    const section = $("#reg-section")?.value;
    const teacherCode = $("#reg-teacher-code")?.value;
    const adminKey = $("#reg-admin-key")?.value;

    if (!name || !email || !password) {
      showToast("Please fill in your name, email, and password.", "warn");
      return;
    }

    if (role === "admin" && adminKey !== "DEPED-ADMIN-2026") {
      showToast("Invalid Admin Authorization Key. Default is DEPED-ADMIN-2026", "warn");
      return;
    }

    const res = AUTH.register({ name, email, password, role, section, teacherCode });
    if (res.success) {
      $("#auth-modal").hidden = true;
      GUEST_MODE = false;
      showToast(`Account created! Welcome, ${res.user.name} 🎉`);
      CURRENT_TAB = dashboardTabForRole(res.user.role);
      renderApp();
    } else {
      showToast(res.message, "warn");
    }
  }
  else if (a === "auth-logout") {
    logoutToIndex();
  }

  // Teacher Classroom & Share Code Actions
  else if (a === "teacher-copy-code") {
    const code = (AUTH.currentUser && AUTH.currentUser.shareCode) || "BASA-TEACH-8492";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Teacher Share Code copied: ${code} 📋`);
      }).catch(() => {
        prompt("Copy Teacher Share Code:", code);
      });
    } else {
      prompt("Copy Teacher Share Code:", code);
    }
  }
  else if (a === "teacher-show-projector") {
    const modal = $("#projector-modal");
    const code = (AUTH.currentUser && AUTH.currentUser.shareCode) || "BASA-TEACH-8492";
    if (modal) {
      const codeEl = $("#projector-share-code");
      const subEl = $("#projector-share-code-sub");
      if (codeEl) codeEl.textContent = code;
      if (subEl) subEl.textContent = code;
      modal.hidden = false;
    }
  }
  else if (a === "projector-close") {
    const modal = $("#projector-modal");
    if (modal) modal.hidden = true;
  }
  else if (a === "teacher-dispatch-assignment") {
    const pSelect = $("#asg-passage-select");
    const tSelect = $("#asg-target-select");
    const noteInput = $("#asg-note-input");

    if (!pSelect || !pSelect.value) {
      showToast("Please select a passage to assign.", "warn");
      return;
    }

    const pId = pSelect.value;
    const pTitle = pSelect.options[pSelect.selectedIndex].text;
    const targetGroup = tSelect?.value || "all";
    const note = noteInput?.value || "Assigned by Teacher";

    AUTH.createAssignment(pId, pTitle, targetGroup, "Upcoming Session", note);
    showToast(`Assignment dispatched to ${targetGroup === 'all' ? 'entire class' : targetGroup}! 🚀`);
    renderApp();
  }
  else if (a === "teacher-import-guest") {
    const token = prompt("Enter Student Guest Token (e.g. GUEST-8492):");
    if (!token) return;
    const code = (AUTH.currentUser && AUTH.currentUser.shareCode) || "BASA-TEACH-8492";
    const res = AUTH.importGuestToken(token.trim().toUpperCase(), code);
    if (res.success) {
      showToast(`Student ${res.student.name} imported with Phil-IRI Level ${PHIL_IRI_LEVELS[res.student.lvl]}! 🎉`);
      renderApp();
    } else {
      showToast(res.message, "warn");
    }
  }

  // Student & Guest Connecting
  else if (a === "student-connect-teacher") {
    const input = $("#home-teacher-code");
    const code = input ? input.value : prompt("Enter Teacher Share Code (e.g. BASA-TEACH-8492):");
    if (!code) return;
    const res = AUTH.connectTeacher(code);
    if (res.success) {
      showToast(`Successfully connected to ${res.teacherName} (${res.section})! 🤝`);
      renderApp();
    } else {
      showToast(res.message, "warn");
    }
  }
  else if (a === "guest-save-profile") {
    const modal = $("#auth-modal");
    if (modal) {
      modal.hidden = false;
      const regTab = $("#tab-btn-register");
      if (regTab) regTab.click();
      showToast("Fill in registration to permanently link your reading score!");
    }
  }
  else if (a === "guest-connect-teacher") {
    const code = prompt("Enter your Teacher's Share Code (e.g. BASA-TEACH-8492):");
    if (!code) return;
    const teacher = AUTH.users.find(u => u.role === "teacher" && u.shareCode === code.trim().toUpperCase());
    if (!teacher) {
      alert(`Teacher Share Code "${code.trim().toUpperCase()}" not found. Please verify with your teacher.`);
      return;
    }
    const studentName = prompt("Enter your Full Name for your teacher's class roster:") || "Guest Student";
    const token = AUTH.createGuestToken(S.lvl !== null ? S.lvl : 1, 110, 75, studentName);
    S.guestToken = token;
    const impRes = AUTH.importGuestToken(token, teacher.shareCode);
    if (impRes.success) {
      alert(`Connected! You are now listed on ${teacher.name}'s roster (${teacher.section}) with Level: ${PHIL_IRI_LEVELS[S.lvl || 1]}. Your Guest Token is ${token}.`);
      renderApp();
    } else {
      alert(impRes.message);
    }
  }

  // Admin Console Actions
  else if (a === "admin-tab") {
    CURRENT_ADMIN_TAB = v;
    renderApp();
  }
  else if (a === "admin-edit-role") {
    const userId = v;
    const user = AUTH.users.find(u => u.id === userId);
    if (!user) return;
    const newRole = prompt(`Change role for ${user.name} (${user.email}):\nEnter 'student', 'teacher', or 'admin'`, user.role);
    if (!newRole) return;
    const cleanRole = newRole.trim().toLowerCase();
    if (!["student", "teacher", "admin"].includes(cleanRole)) {
      alert("Invalid role. Must be 'student', 'teacher', or 'admin'.");
      return;
    }
    user.role = cleanRole;
    if (cleanRole === "teacher" && !user.shareCode) {
      user.shareCode = "BASA-TEACH-" + Math.floor(1000 + Math.random() * 9000);
    }
    AUTH.saveUsers();
    showToast(`Updated ${user.name}'s role to ${cleanRole.toUpperCase()}!`);
    renderApp();
  }
  else if (a === "admin-toggle-status") {
    const userId = v;
    const user = AUTH.users.find(u => u.id === userId);
    if (!user) return;
    user.status = user.status === "active" ? "suspended" : "active";
    AUTH.saveUsers();
    showToast(`Account for ${user.name} is now ${user.status.toUpperCase()}.`);
    renderApp();
  }
  else if (a === "admin-reset-pwd") {
    const userId = v;
    const user = AUTH.users.find(u => u.id === userId);
    if (!user) return;
    const newPwd = prompt(`Enter new password for ${user.name}:`, "basa123");
    if (!newPwd) return;
    user.password = newPwd.trim();
    AUTH.saveUsers();
    showToast(`Password updated for ${user.name}! 🔑`);
  }
  else if (a === "admin-open-add-passage") {
    const modal = $("#admin-passage-modal");
    if (modal) modal.hidden = false;
  }
  else if (a === "passage-modal-close") {
    const modal = $("#admin-passage-modal");
    if (modal) modal.hidden = true;
  }
  else if (a === "admin-save-passage") {
    const title = $("#pass-title")?.value;
    const diff = $("#pass-diff")?.value || "easy";
    const text = $("#pass-text")?.value;
    const q1 = $("#pass-q1")?.value;
    const opt0 = $("#pass-opt-0")?.value;
    const opt1 = $("#pass-opt-1")?.value;
    const opt2 = $("#pass-opt-2")?.value;
    const opt3 = $("#pass-opt-3")?.value;
    const ans = parseInt($("#pass-ans")?.value || "0", 10);
    const skill = $("#pass-skill")?.value || "Literal";

    if (!title || !text || !q1 || !opt0 || !opt1) {
      showToast("Please fill in Title, Passage Text, Question, and Options.", "warn");
      return;
    }

    try {
      AUTH.addCustomPassage({
        t: title,
        diff,
        x: text,
        qs: [{
          q: q1,
          o: [opt0, opt1, opt2, opt3].filter(option => typeof option === "string" && option.trim()),
          a: ans,
          k: skill
        }],
        status: "published",
        author: (AUTH.currentUser && AUTH.currentUser.name) || "Curriculum Admin",
        createdAt: new Date().toISOString().split("T")[0]
      });
    } catch (error) {
      showToast(error.message, "warn");
      return;
    }
    $("#admin-passage-modal").hidden = true;
    showToast(`Custom passage "${title}" added to curriculum! 📚`);
    renderApp();
  }
  else if (a === "admin-delete-passage") {
    const pId = v;
    if (!confirm("Are you sure you want to remove this custom passage from the curriculum?")) return;
    AUTH.customPassages = AUTH.customPassages.filter(p => p.id !== pId);
    AUTH.saveCustomPassages();
    showToast("Passage removed from curriculum.");
    renderApp();
  }
  else if (a === "admin-export-backup") {
    try {
      downloadBackup();
      showToast("Backup exported to JSON.");
    } catch (error) {
      alert("Backup export failed: " + error.message);
    }
  }
  else if (a === "admin-restore-backup-trigger") {
    const fileInput = $("#admin-restore-file");
    if (fileInput) fileInput.click();
  }
  else if (a === "admin-reset-presets") {
    if (!confirm("Are you sure you want to reset all data to DepEd initial presets? All custom users and passages will be reset.")) return;
    localStorage.removeItem(AUTH.USERS_KEY);
    localStorage.removeItem(AUTH.ASSIGNMENTS_KEY);
    localStorage.removeItem(AUTH.GUEST_TOKENS_KEY);
    localStorage.removeItem(AUTH.CUSTOM_PASSAGES_KEY);
    localStorage.removeItem(AUTH.SESSION_KEY);
    AUTH.init();
    showToast("All data successfully restored to initial presets! 🔄");
    renderApp();
  }

  else if (a === "toggle-theme") {
    S.theme = S.theme === "dark" ? "light" : "dark";
    save();
    renderApp();
    showToast(S.theme === "dark" ? "Dark Mode enabled 🌙" : "Light Mode enabled ☀️");
  }

  // Dismiss tip when clicking outside
  if (!e.target.closest("#tip") && !e.target.closest(".w")) {
    const tip = $("#tip");
    if (tip) tip.hidden = true;
  }
});

// Search input handling
document.addEventListener("input", e => {
  if (e.target.id === "lib-search") {
    SEARCH_QUERY = e.target.value;
    renderApp();
    const searchInput = $("#lib-search");
    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(SEARCH_QUERY.length, SEARCH_QUERY.length);
    }
  }
});

// Enter key support for AI input
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "aii") {
    const val = e.target.value;
    e.target.value = "";
    aiSend(val);
  }
  if (e.key === "Escape") {
    $("#ai").hidden = true;
    $("#md").hidden = true;
    $("#tip").hidden = true;
  }
});

// Close modal when clicking dark backdrop
$("#md").addEventListener("click", e => {
  if (e.target.id === "md") $("#md").hidden = true;
});
$("#ai").addEventListener("click", e => {
  if (e.target.id === "ai") $("#ai").hidden = true;
});

// Backdrop click closures for new modals
$("#auth-modal")?.addEventListener("click", e => {
  if (e.target.id === "auth-modal") $("#auth-modal").hidden = true;
});
$("#projector-modal")?.addEventListener("click", e => {
  if (e.target.id === "projector-modal") $("#projector-modal").hidden = true;
});
$("#admin-passage-modal")?.addEventListener("click", e => {
  if (e.target.id === "admin-passage-modal") $("#admin-passage-modal").hidden = true;
});

// JSON Backup Restore File Handler
document.addEventListener("change", e => {
  if (e.target.id === "admin-restore-file") {
    const input = e.target;
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Backup could not be restored: File exceeds the 10 MB limit.");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        if (restoreBackupFromText(evt.target.result)) {
          renderApp();
          showToast("Backup restored. Sign in to continue.");
        }
      } catch (error) {
        alert("Backup could not be restored: " + error.message);
      } finally {
        input.value = "";
      }
    };
    reader.onerror = () => {
      alert("Backup could not be read. Select the file again.");
      input.value = "";
    };
    reader.readAsText(file);
  }
});

// Initial boot
AUTH.init();
const openingRegistration = window.location?.hash === "#register";
if (openingRegistration) {
  try {
    window.history?.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (error) {
    // The page can still open when a file URL does not allow history changes.
  }
}
if (AUTH.currentUser) {
  CURRENT_TAB = dashboardTabForRole(AUTH.currentUser.role);
}
renderApp();
if (openingRegistration && !AUTH.currentUser) openRegistration();
