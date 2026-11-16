function dashboardTabForRole(role) {
  return role === "teacher" ? "teacher" : role === "admin" ? "admin" : "home";
}

function showInlineDialog(dialog, focusTarget) {
  if (!dialog) return;
  if (dialog.hidden) dialog._returnFocus = document.activeElement;
  dialog.hidden = false;
  (focusTarget || dialog.querySelector?.('button, input, select, textarea'))?.focus?.();
}

function closeInlineDialog(dialog) {
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  if (dialog._returnFocus?.isConnected) dialog._returnFocus.focus?.();
  dialog._returnFocus = null;
}

function selectedRegistrationRole() {
  return $('input[name="reg-role"]:checked')?.value || "student";
}

function updateRegistrationRole() {
  const role = selectedRegistrationRole();
  const studentFields = $("#reg-group-student");
  const teacherFields = $("#reg-group-teacher");
  const submit = $("#reg-submit");
  if (studentFields) studentFields.hidden = role !== "student";
  if (teacherFields) teacherFields.hidden = role !== "teacher";
  if (submit) submit.textContent = role === "teacher" ? "Create Teacher Account" : "Create Student Account";
}

function openRegistration() {
  updateRegistrationRole();
  showInlineDialog($("#auth-modal"), $("#reg-name"));
}

function openUpgradeModal(reason = "", notice = "") {
  const modal = $("#upgrade-modal");
  if (!modal) return;
  const banner = $("#upgrade-notice-banner");
  const bannerText = $("#upgrade-notice-text");
  if (banner && bannerText) {
    if (notice) {
      bannerText.textContent = notice;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }
  showInlineDialog(modal, modal.querySelector(".upgrade-close-btn"));
}

function closeUpgradeModal() {
  const modal = $("#upgrade-modal");
  if (modal) closeInlineDialog(modal);
}

function logoutToIndex() {
  if (!AUTH.logout()) {
    showToast("Could not sign out in this browser. Please try again.", "warn");
    return;
  }
  GUEST_MODE = false;
  if (typeof initWisyoChatForCurrentAccount === "function") initWisyoChatForCurrentAccount();
  if (typeof closeTourOverlay === "function") closeTourOverlay();
  stopSpeech();
  ACTIVE_QUIZ = null;
  CURRENT_TAB = "home";
  $("#auth-modal").hidden = true;
  window.location.replace("index.html");
}

let EDITING_PRACTICE_ID = null;
let IMPORTING_LEGACY_MATERIAL_ID = null;
let PRACTICE_EDITOR_GENERATION = 0;
let PRACTICE_ACTIVE_QUESTION_INDEX = 0;

function practiceQuestionMarkup(question = {}, index = 0) {
  const optionCount = Math.max(4, Math.min(6, question.o?.length ?? 4));
  const options = Array.from({ length: optionCount }, (_, optionIndex) => `
    <label>Option ${optionIndex + 1}
      <input type="text" class="auth-input" data-field="option-${optionIndex}"
        value="${escapeHTML(question.o?.[optionIndex] ?? "")}" placeholder="Answer choice ${optionIndex + 1}">
    </label>`).join("");
  const skills = ["Literal", "Inference", "Critical reading", "Main idea"];
  if (question.k && !skills.includes(question.k)) skills.push(question.k);
  return `<fieldset class="practice-question-card">
    <legend>Question ${index + 1}</legend>
    <label>Question prompt
      <input type="text" class="auth-input" data-field="prompt" maxlength="500"
        value="${escapeHTML(question.q ?? "")}" placeholder="Write a question about the passage">
    </label>
    <div class="practice-option-grid">${options}</div>
    <div class="practice-option-grid">
      <label>Correct answer
        <select class="auth-input" data-field="answer">
          ${Array.from({ length: optionCount }, (_, optionIndex) => `<option value="${optionIndex}" ${Number(question.a ?? 0) === optionIndex ? "selected" : ""}>Option ${optionIndex + 1}</option>`).join("")}
        </select>
      </label>
      <label>Question skill type
        <select class="auth-input" data-field="skill">
          ${skills.map(skill => `<option value="${escapeHTML(skill)}" ${question.k === skill ? "selected" : ""}>${escapeHTML(skill)}</option>`).join("")}
        </select>
      </label>
    </div>
    <label style="margin-top:8px">Explanation / Text evidence (optional)
      <input type="text" class="auth-input" data-field="explanation" maxlength="1000"
        value="${escapeHTML(question.exp ?? "")}" placeholder="Explanation or supporting lines for student feedback">
    </label>
  </fieldset>`;
}

function readPracticeQuestionDrafts() {
  return Array.from($$(".practice-question-card"), card => ({
    q: card.querySelector('[data-field="prompt"]').value,
    o: Array.from({ length: 6 }, (_, index) => card.querySelector(`[data-field="option-${index}"]`))
      .filter(Boolean).map(field => field.value),
    a: Number(card.querySelector('[data-field="answer"]').value),
    k: card.querySelector('[data-field="skill"]').value,
    exp: card.querySelector('[data-field="explanation"]')?.value ?? ""
  }));
}

function showPracticeQuestion(index, count = practiceQuestionCount()) {
  PRACTICE_ACTIVE_QUESTION_INDEX = Math.max(0, Math.min(count - 1, index));
  Array.from($$(".practice-question-card")).forEach((card, cardIndex) => {
    card.hidden = cardIndex !== PRACTICE_ACTIVE_QUESTION_INDEX;
  });
  const position = $("#practice-question-position");
  if (position) position.textContent = `Question ${PRACTICE_ACTIVE_QUESTION_INDEX + 1} of ${count}`;
  const slider = $("#practice-question-slider");
  if (slider) {
    slider.max = String(count);
    slider.value = String(PRACTICE_ACTIVE_QUESTION_INDEX + 1);
    slider.disabled = count === 1;
  }
  const previous = $("#practice-question-prev");
  if (previous) previous.disabled = PRACTICE_ACTIVE_QUESTION_INDEX === 0;
  const next = $("#practice-question-next");
  if (next) next.disabled = PRACTICE_ACTIVE_QUESTION_INDEX === count - 1;
}

function renderPracticeQuestionCards(questions, activeIndex = 0) {
  $("#passage-questions").innerHTML = questions.map(practiceQuestionMarkup).join("");
  showPracticeQuestion(activeIndex, questions.length);
}

function practiceQuestionCount() {
  const count = Number($("#practice-question-count").value);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Choose between 1 and 20 questions.");
  }
  return count;
}

function validatedPracticeQuestions() {
  const questions = readPracticeQuestionDrafts();
  if (questions.length !== practiceQuestionCount()) {
    throw new Error("Set the number of questions before saving.");
  }
  return questions.map((question, index) => {
    const firstEmpty = question.o.findIndex(option => !option.trim());
    if (firstEmpty >= 0 && question.o.slice(firstEmpty + 1).some(option => option.trim())) {
      showPracticeQuestion(index);
      throw new Error(`Question ${index + 1}: fill answer options in order, without gaps.`);
    }
    if (!question.q.trim() || question.o.filter(option => option.trim()).length < 2
        || !question.o[question.a]?.trim()) {
      showPracticeQuestion(index);
      throw new Error(`Complete question ${index + 1}, including two answers and the correct choice.`);
    }
    const cleaned = { ...question, o: question.o.filter(option => option.trim()) };
    if (cleaned.exp && cleaned.exp.trim()) cleaned.exp = cleaned.exp.trim();
    else delete cleaned.exp;
    return cleaned;
  });
}

function openPracticeEditor(id = null, legacyMaterial = null) {
  const actor = AUTH.practiceActor();
  const raw = id ? AUTH.customPassages.find(passage => passage?.id === id) : null;
  if (id && !raw) throw new Error("Practice was not found.");
  const passage = raw ? normalizePassage(raw) : null;
  if (actor.role === "teacher" && passage
      && (passage.ownerId !== actor.id || !["draft", "rejected"].includes(passage.status))) {
    throw new Error("You can edit only your own draft or rejected practice.");
  }
  EDITING_PRACTICE_ID = passage?.id ?? null;
  IMPORTING_LEGACY_MATERIAL_ID = legacyMaterial?.id ?? null;
  const values = {
    "#pass-title": passage?.t ?? legacyMaterial?.title ?? "",
    "#pass-author": passage?.author ?? legacyMaterial?.author ?? "",
    "#pass-diff": passage?.diff ?? legacyMaterial?.difficulty ?? "easy",
    "#pass-lang": passage?.lang ?? ({ en: "en-US", fil: "fil-PH", ceb: "ceb-PH" }[legacyMaterial?.language] ?? "en-US"),
    "#pass-text": passage?.x ?? legacyMaterial?.text ?? ""
  };
  for (const [selector, value] of Object.entries(values)) {
    const field = $(selector);
    if (field) field.value = value;
  }
  PRACTICE_EDITOR_GENERATION++;
  const legacyQuestions = Array.isArray(legacyMaterial?.questions)
    ? legacyMaterial.questions.slice(0, 20).map(question => ({
      q: question.q ?? "", o: question.o ?? [], a: question.a ?? 0,
      k: question.k ?? "Literal", exp: question.exp ?? ""
    })) : [];
  const questions = passage?.qs ?? (legacyQuestions.length ? legacyQuestions : [{}]);
  $("#practice-question-count").value = String(questions.length);
  renderPracticeQuestionCards(questions, 0);
  if ($("#pass-file")) $("#pass-file").value = "";
  if ($("#pass-file-status")) $("#pass-file-status").textContent = "Imported text stays editable. Scanned PDFs may need to be pasted manually.";
  $("#practice-wisyo-status").textContent = "Wisyo suggestions need your review before submission.";
  $("#passage-modal-title").textContent = passage ? "Edit passage" : "Add passage";
  $("#passage-modal-hint").textContent = actor.role === "teacher"
    ? "Save a draft or submit it for admin approval. Only approved work is visible to students."
    : "Admin changes to published practices appear in the reading library immediately.";
  $("#practice-save-draft").hidden = actor.role !== "teacher";
  $("#practice-submit").hidden = actor.role !== "teacher";
  $("#practice-admin-save").hidden = actor.role !== "admin";
  $("#practice-admin-save").textContent = passage ? "Save changes" : "Publish passage";
  showInlineDialog($("#admin-passage-modal"), $("#pass-title"));
}

function savePracticeFromEditor(submit) {
  const passage = AUTH.savePractice({
    t: $("#pass-title")?.value,
    author: $("#pass-author")?.value,
    diff: $("#pass-diff")?.value,
    lang: $("#pass-lang")?.value || "en-US",
    x: $("#pass-text")?.value,
    qs: validatedPracticeQuestions()
  }, { id: EDITING_PRACTICE_ID, submit });
  if (IMPORTING_LEGACY_MATERIAL_ID) linkLegacyMaterialToPassage(IMPORTING_LEGACY_MATERIAL_ID, passage.id);
  EDITING_PRACTICE_ID = null;
  IMPORTING_LEGACY_MATERIAL_ID = null;
  $("#admin-passage-modal").hidden = true;
  if (AUTH.currentUser.role === "admin") CURRENT_ADMIN_TAB = "curriculum";
  renderApp();
  showToast(passage.status === "pending" ? "Practice submitted for admin approval."
    : passage.status === "draft" ? "Practice draft saved." : "Practice saved to the curriculum.");
}

/* ==========================================================================
   Global Event Delegations
   ========================================================================== */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-a]");
  if (!t) return;
  const a = t.dataset.a;
  const v = t.dataset.v;
  if (((a === "tab" && v === "reports")
      || ["open-report-sheet", "download-csv", "print-sheet"].includes(a))
      && !canViewReports()) {
    showToast("Teacher or admin account required for reports.", "warn");
    return;
  }
  if (a.startsWith("admin-") && AUTH.currentUser?.role !== "admin") {
    showToast("Admin account required for this action.", "warn");
    return;
  }
  if (a.startsWith("teacher-") && AUTH.currentUser?.role !== "teacher") {
    showToast("Teacher account required for this action.", "warn");
    return;
  }

  // Tabs
  if (a === "tab") {
    stopSpeech();
    if (typeof canAccessRoute === "function" && !canAccessRoute(v, AUTH.currentUser, S)) {
      if (AUTH.currentUser?.role === "student" && S.lvl === null) {
        showToast("Please complete your placement assessment first! 📝", "info");
        CURRENT_TAB = "assess";
      } else if (v === "admin" || v === "users" || v === "classes") {
        showToast("Admin account required for this action.", "warn");
        return;
      } else if (v === "teacher" || v === "students" || v === "teacher-studio") {
        showToast("Teacher account required for this action.", "warn");
        return;
      } else if (v === "reports") {
        showToast("Teacher or admin account required for reports.", "warn");
        return;
      } else {
        showToast("Access restricted.", "warn");
        return;
      }
    } else {
      CURRENT_TAB = AUTH.currentUser?.role === "student" && S.lvl === null
        && !["home", "assess", "about", "services", "profile"].includes(v) ? "assess" : v;
    }
    ACTIVE_QUIZ = null;
    QUIZ_RESULT = null;
    renderApp();
  }

  // Difficulty filter in practice
  else if (a === "filter-diff") {
    S.activeDiff = v;
    CURRENT_TAB = "practice";
    QUIZ_RESULT = null;
    renderApp();
  }

  else if (a === "reward-frame") {
    try {
      setJourneyFrame(v);
      renderApp();
      showToast("Profile frame updated.");
    } catch (error) {
      showToast(error.message, "warn");
    }
  }

  else if (a === "board-opt") {
    try {
      setClassBoardOptIn(v === "on");
      renderApp();
      showToast(v === "on" ? "You joined the local Class Board." : "You left the Class Board.");
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "board-tier") {
    const tier = Number(v);
    if (Number.isInteger(tier) && tier >= 0 && tier < DIFF_KEYS.length) {
      BOARD_TIER = tier;
      renderApp();
    }
  }
  else if (a === "board-metric") {
    CURRENT_BOARD_METRIC = v;
    renderApp();
  }
  else if (a === "board-scope") {
    CURRENT_BOARD_SCOPE = v;
    renderApp();
  }

  // Start placement diagnostic
  else if (a === "start-placement") {
    if (["teacher", "admin"].includes(AUTH.currentUser?.role)) {
      CURRENT_TAB = "practice";
      renderApp();
      showToast("Open a passage to view its content and student results.");
      return;
    }
    if (!AUTH.currentUser) GUEST_MODE = true;
    $("#auth-modal").hidden = true;
    QUIZ_RESULT = null;
    startQuiz(PLACEMENT_TEST, "pl", "Phil-IRI Diagnostic Placement");
  }

  // Start advanced verification passage
  else if (a === "start-placement-verify") {
    if (["teacher", "admin"].includes(AUTH.currentUser?.role)) {
      CURRENT_TAB = "practice";
      renderApp();
      return;
    }
    if (!AUTH.currentUser) GUEST_MODE = true;
    $("#auth-modal").hidden = true;
    QUIZ_RESULT = null;
    const verifyPassages = typeof PLACEMENT_VERIFICATION_PASSAGE !== "undefined" ? PLACEMENT_VERIFICATION_PASSAGE : PLACEMENT_TEST;
    startQuiz(verifyPassages, "pl", "Advanced Placement Verification");
  }

  // Read specific passage in practice
  else if (a === "read-passage") {
    if (["teacher", "admin"].includes(AUTH.currentUser?.role)) {
      CURRENT_TAB = "practice";
      renderApp();
      showToast("Use View passage & results to review reading content without taking a quiz.");
      return;
    }
    if (AUTH.currentUser?.role === "student" && (S.lvl === null || AUTH.currentUser.lvl === null)) {
      showToast("Please complete your 15-question placement assessment before starting story practice.", "warn");
      CURRENT_TAB = "assess";
      renderApp();
      return;
    }
    const found = getPublishedPassageById(v);
    if (found && !journeyCanRead(found)) {
      showToast("Complete earlier reading tiers or ask your teacher to unlock this passage.", "warn");
    } else if (found) {
      QUIZ_RESULT = null;
      startQuiz([found], "pr", `Practice: ${found.t}`);
    }
  }

  // Answer selection in quiz
  else if (a === "quiz-begin-question") {
    showQuizStage("question");
  }
  else if (a === "quiz-show-passage") {
    showQuizStage("passage");
  }
  else if (a === "submit-answer") {
    handleAnswer(parseInt(v, 10));
  }

  // Next question in quiz
  else if (a === "quiz-next") {
    handleQuizNext();
  }

  // Quiz result scene actions
  else if (a === "quiz-karaoke-skip") {
    skipQuizKaraoke();
  }
  else if (a === "quiz-review") {
    if (QUIZ_RESULT) {
      QUIZ_RESULT.reviewMode = !QUIZ_RESULT.reviewMode;
      if (typeof updateQuestProgress === "function") {
        updateQuestProgress("review", 1);
      }
      renderApp();
    }
  }
  else if (a === "quiz-retry") {
    if (QUIZ_RESULT?.quiz?.steps?.[0]?.P) {
      const p = QUIZ_RESULT.quiz.steps[0].P;
      QUIZ_RESULT = null;
      startQuiz([p], "pr", `Practice: ${p.t}`);
    }
  }
  else if (a === "quiz-next-story") {
    const summary = journeySummary();
    const currentId = QUIZ_RESULT?.quiz?.steps?.[0]?.P?.id;
    const next = summary?.next;
    QUIZ_RESULT = null;
    if (next && next.id !== currentId && journeyCanRead(next)) {
      startQuiz([next], "pr", `Practice: ${next.t}`);
    } else {
      CURRENT_TAB = "practice";
      renderApp();
    }
  }
  else if (a === "quiz-exit-to-library") {
    const m = $("#zero-hearts-modal");
    if (m && typeof m.remove === "function") m.remove();
    QUIZ_RESULT = null;
    CURRENT_TAB = "practice";
    renderApp();
  }
  else if (a === "out-of-hearts-retry") {
    const m = $("#zero-hearts-modal");
    if (m && typeof m.remove === "function") m.remove();
    let passageToRetry = null;
    if (v) {
      passageToRetry = getPublishedPassageById(v);
    }
    if (!passageToRetry && ACTIVE_QUIZ?.steps?.[0]?.P) {
      passageToRetry = ACTIVE_QUIZ.steps[0].P;
    }
    if (passageToRetry) {
      ACTIVE_QUIZ = null;
      QUIZ_RESULT = null;
      startQuiz([passageToRetry], "pr", `Practice: ${passageToRetry.t}`);
    } else {
      CURRENT_TAB = "practice";
      renderApp();
    }
  }
  else if (a === "zero-hearts-close") {
    const m = $("#zero-hearts-modal");
    if (m && typeof m.remove === "function") m.remove();
  }
  else if (a === "heart-info") {
    if (typeof syncHearts === "function") {
      const st = syncHearts();
      const isPrem = typeof isUserPremium === "function" && isUserPremium();
      if (isPrem) {
        showToast("Wisyo Plus Active: You have Unlimited Practice Hearts! ❤️ ∞", "ok");
      } else {
        openUpgradeModal("hearts", "You are using standard practice hearts. Upgrade to Wisyo Plus for Unlimited Practice Hearts!");
      }
    }
  }

  // Wisyo Plus Upgrade Modal Actions
  else if (a === "upgrade-open") {
    openUpgradeModal(v || "general");
  }
  else if (a === "upgrade-close") {
    closeUpgradeModal();
  }
  else if (a === "upgrade-select") {
    const plan = v === "annual" ? "annual" : "monthly";
    if (typeof AUTH !== "undefined" && typeof AUTH.setPlan === "function") {
      AUTH.setPlan(plan);
    }
    closeUpgradeModal();
    renderApp();
    showToast(`Welcome to Wisyo Plus (${plan.toUpperCase()})! 👑 Unlimited Hearts & High-Thinking AI activated.`, "ok");
  }
  else if (a === "upgrade-toggle-sandbox") {
    if (typeof AUTH !== "undefined" && typeof AUTH.toggleSandboxPremium === "function") {
      const newPrem = AUTH.toggleSandboxPremium();
      closeUpgradeModal();
      renderApp();
      showToast(`Sandbox Wisyo Plus ${newPrem ? "ACTIVATED 👑" : "DEACTIVATED"} for testing!`, "ok");
    }
  }

  // Onboarding Interactive Tour Actions
  else if (a === "tour-next") {
    if (typeof nextTourStep === "function") nextTourStep();
  }
  else if (a === "tour-prev") {
    if (typeof prevTourStep === "function") prevTourStep();
  }
  else if (a === "tour-skip") {
    if (typeof skipOnboardingTour === "function") skipOnboardingTour();
  }
  else if (a === "tour-finish") {
    if (typeof finishOnboardingTour === "function") finishOnboardingTour();
  }
  else if (a === "tour-replay") {
    if (typeof replayCurrentRoleTour === "function") replayCurrentRoleTour();
  }

  // Quit quiz early
  else if (a === "quit-quiz") {
    if (confirm("Are you sure you want to exit? Your progress in this quiz will be cancelled.")) {
      stopSpeech();
      ACTIVE_QUIZ = null;
      renderApp();
    }
  }

  // Smart Review Session
  else if (a === "start-smart-review") {
    if (typeof startSmartReviewSession === "function") {
      const started = startSmartReviewSession();
      if (!started && typeof showToast === "function") {
        showToast("No questions need review right now! Great job!", "ok");
      }
    }
  }

  // Save word from reading passage directly to Vocabulary Flashcards
  else if (a === "save-word-flashcard") {
    if (typeof saveFlashcard === "function") {
      const card = saveFlashcard({ word: v });
      if (card && typeof showToast === "function") {
        showToast(`Saved "${v}" to Vocabulary Flashcards! 📇`);
      }
    }
    const tip = $("#tip");
    if (tip) tip.hidden = true;
  }

  // Vocabulary Flashcards interactions
  else if (a === "fc-flip") {
    FLASHCARD_IS_FLIPPED = !FLASHCARD_IS_FLIPPED;
    renderApp();
  }
  else if (a === "fc-rate") {
    const rating = v;
    const cardId = e.target.closest('[data-card]')?.getAttribute('data-card');
    if (cardId && typeof rateFlashcard === "function") {
      const updated = rateFlashcard(cardId, rating);
      if (typeof updateQuestProgress === "function") {
        updateQuestProgress("review", 1);
      }
      FLASHCARD_ACTIVE_INDEX++;
      FLASHCARD_IS_FLIPPED = false;
      const intervalStr = updated?.intervalDays ? ` Next review in ${updated.intervalDays} day(s).` : "";
      showToast(`Card rated ${rating.toUpperCase()}!${intervalStr}`);
      renderApp();
    }
  }
  else if (a === "fc-prev") {
    FLASHCARD_ACTIVE_INDEX = Math.max(0, FLASHCARD_ACTIVE_INDEX - 1);
    FLASHCARD_IS_FLIPPED = false;
    renderApp();
  }
  else if (a === "fc-next") {
    FLASHCARD_ACTIVE_INDEX++;
    FLASHCARD_IS_FLIPPED = false;
    renderApp();
  }
  else if (a === "fc-filter") {
    FLASHCARD_ACTIVE_FILTER = v;
    FLASHCARD_ACTIVE_INDEX = 0;
    FLASHCARD_IS_FLIPPED = false;
    renderApp();
  }
  else if (a === "fc-open-add") {
    FLASHCARD_SHOW_ADD_MODAL = true;
    renderApp();
  }
  else if (a === "fc-close-add") {
    FLASHCARD_SHOW_ADD_MODAL = false;
    renderApp();
  }
  else if (a === "fc-add-submit") {
    const word = $("#fc-new-word")?.value?.trim();
    const def = $("#fc-new-def")?.value?.trim();
    const fil = $("#fc-new-fil")?.value?.trim();
    const bis = $("#fc-new-bis")?.value?.trim();
    const sent = $("#fc-new-sentence")?.value?.trim();
    if (!word || !def) {
      showToast("Please enter a vocabulary word and its definition.", "warn");
      return;
    }
    if (typeof saveFlashcard === "function") {
      saveFlashcard({ word, definition: def, filipino: fil, bisaya: bis, contextSentence: sent });
      FLASHCARD_SHOW_ADD_MODAL = false;
      showToast(`Added "${word}" to Vocabulary Flashcards! 🎉`);
      renderApp();
    }
  }
  else if (a === "fc-speak") {
    speak(v);
  }

  // Trilingual dictionary tooltip
  else if (a === "tip") {
    const wordKey = v.toLowerCase();
    const entry = D[wordKey];
    if (entry) {
      const tip = $("#tip");
      tip.hidden = false;
      const pos = (entry[3] || (typeof getWordPOS === "function" ? getWordPOS(wordKey) : "noun")).toUpperCase();
      tip.innerHTML = `
        <div class="tip-header">
          <div style="display:flex;align-items:center;gap:6px">
            <b style="font-size:1.1rem;color:var(--navy);text-transform:capitalize">${escapeHTML(wordKey)}</b>
            <span class="pos-badge" style="background:var(--sky-light);color:var(--sky-ink);font-size:0.7rem;font-weight:700;padding:2px 6px;border-radius:4px">[${escapeHTML(pos)}]</span>
            <button class="icon-btn" data-a="speech-speak-word" data-v="${escapeHTML(wordKey)}" style="width:26px;height:26px;font-size:12px" title="Pronounce word">🔊</button>
          </div>
          <button class="icon-btn" data-a="tip-close" style="width:24px;height:24px;font-size:11px">✕</button>
        </div>
        <div style="font-size:0.875rem;line-height:1.5">
          <div>🇵🇭 <b>Filipino:</b> ${escapeHTML(entry[0])}</div>
          <div>🏝️ <b>Bisaya:</b> ${escapeHTML(entry[1])}</div>
          <div style="margin-top:4px">📖 <b>English:</b> ${escapeHTML(entry[2])}</div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn sm blue" data-a="save-word-flashcard" data-v="${escapeHTML(wordKey)}" style="flex:1;font-size:0.8rem;padding:5px 8px">
              ${uiIcon("flashcards")} Save Card
            </button>
            <button class="btn sm secondary" data-a="tip-ask-wisyo" data-v="${escapeHTML(wordKey)}" style="font-size:0.8rem;padding:5px 8px" title="Ask Wisyo AI about this word">
              🤖 Ask Wisyo
            </button>
          </div>
        </div>
      `;
    }
  }
  else if (a === "tip-ask-wisyo") {
    $("#tip").hidden = true;
    if (typeof aiOpen === "function") {
      aiOpen(`What does "${v}" mean in this passage and how is it used?`);
    }
  }
  else if (a === "tip-close") {
    $("#tip").hidden = true;
  }
  else if (a === "speech-speak-word") {
    speak(v, { passage: ACTIVE_QUIZ?.steps[ACTIVE_QUIZ.idx]?.P });
  }
  else if (a === "speech-preview") {
    const passage = ACTIVE_QUIZ?.steps[ACTIVE_QUIZ.idx]?.P;
    const language = speechLanguage(passage);
    const sample = language.startsWith("fil") ? "Magandang araw. Basahin natin ang kuwento."
      : language.startsWith("ceb") ? "Maayong adlaw. Atong basahon ang sugilanon."
      : "Good morning. Let us read this story together.";
    if (!speak(sample, { language })) showToast("No device voice is available.", "warn");
  }

  // Read whole passage aloud
  else if (a === "speech-read") {
    if (ACTIVE_QUIZ) {
      if (SPEECH_PASSAGE_ACTIVE) {
        stopSpeech();
      } else if (!speak(ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].P.x,
        { followPassage: true, passage: ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].P })) {
        showToast("Audio narration is unavailable in this browser.", "warn");
      }
    }
  }
  else if (a === "speech-pause") {
    if (typeof pauseSpeech === "function") {
      pauseSpeech();
    }
  }
  else if (a === "speech-resume") {
    if (typeof resumeSpeech === "function") {
      resumeSpeech();
    }
  }
  else if (a === "speech-rate-set") {
    const rateVal = Number(v);
    if ([0.75, 0.85, 1, 1.1, 1.25].includes(rateVal)) {
      setSpeechSetting("rate", rateVal);
      if (ACTIVE_QUIZ?.steps?.[ACTIVE_QUIZ.idx]?.P) {
        refreshSpeechControls(ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].P);
      }
      renderApp();
      showToast(`Narration speed: ${rateVal}x`);
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
    if (typeof updateQuestProgress === "function") {
      updateQuestProgress("review", 1);
    }
    aiOpen();
  }
  else if (a === "ai-close") {
    if (typeof aiClose === "function") aiClose();
    else closeInlineDialog($("#ai"));
  }
  else if (a === "ai-clear") {
    if (typeof clearWisyoChat === "function") clearWisyoChat();
    else {
      WISYO_REQUEST_ID++;
      WISYO_BUSY = false;
      CHAT_HISTORY = [];
      aiOpen();
    }
  }
  else if (a === "ai-chip") {
    aiSend(v);
  }
  else if (a === "ai-retry") {
    aiSend(v);
  }
  else if (a === "ai-send") {
    const inp = $("#aii");
    const val = inp?.value;
    if (inp) inp.value = "";
    aiSend(val);
  }
  else if (a === "ai-explain-why") {
    aiOpen("Explain my last mistake and help me fix it.");
  }

  // BasaMesh Share Actions & Bayanihan Target Setting
  else if (a === "set-bayanihan-target") {
    try {
      const targetVal = $("#bayanihan-target-input")?.value;
      setBayanihanTarget(targetVal);
      showToast(`Class weekly reading target updated to ${parseInt(targetVal, 10).toLocaleString()} words! 🎯`);
      renderApp();
    } catch (err) {
      showToast(err.message, "warn");
    }
  }
  else if (a === "mesh-create") {
    const title = $("#mesh-title").value.trim();
    const text = $("#mesh-text").value.trim();
    if (!title || !text) {
      showToast("Please enter both a title and passage text.");
      return;
    }
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 10) {
      showToast("Passage must have at least 10 words to share.", "warn");
      return;
    }
    const payload = JSON.stringify({
      schema: "basa_mesh_v1",
      t: title,
      x: text,
      diff: "medium",
      author: AUTH.currentUser?.name || "Classmate"
    });
    const code = btoa(unescape(encodeURIComponent(payload)));
    const outBox = $("#mesh-generated-box");
    const outInp = $("#mesh-code-output");
    if (outBox && outInp) {
      outBox.style.display = "block";
      outInp.value = code;
    }
    try {
      navigator.clipboard.writeText(code);
      showToast("Share code generated and copied to clipboard! 📋");
    } catch(e) {
      showToast("Share code generated in the box below! 📋");
    }
  }
  else if (a === "mesh-preview") {
    try {
      const raw = $("#mesh-code").value.trim();
      const pkg = validateBasaMeshPackage(raw);
      PENDING_MESH_PACKAGE = pkg;

      const previewDiv = $("#mesh-preview-container");
      if (previewDiv) {
        previewDiv.style.display = "block";
        const isDup = isDuplicatePassage(pkg.title);
        previewDiv.innerHTML = `
          <div class="card" style="border:2px solid var(--sky);background:var(--card-bg);padding:16px">
            <div class="lab" style="color:var(--sky-ink)">Passage Preview</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0">
              <h3 style="margin:0">${escapeHTML(pkg.title)}</h3>
              <span class="badge-diff diff-${pkg.diff}">${pkg.diff.toUpperCase()}</span>
            </div>
            <p class="sub-sm" style="margin-bottom:8px">
              <b>${wordCount(pkg.text)} words</b> · <b>${pkg.qs.length} question(s)</b> · Author: <i>${escapeHTML(pkg.author)}</i>
            </p>
            <p class="sub-sm" style="font-style:italic;background:var(--bg);padding:8px 12px;border-radius:var(--radius-sm);margin:8px 0">
              "${escapeHTML(pkg.text.slice(0, 200))}${pkg.text.length > 200 ? '...' : ''}"
            </p>
            ${isDup ? `
              <div style="background:#FFF1F2;border-left:4px solid var(--coral);padding:8px 12px;margin:10px 0;font-size:0.85rem">
                <b>Notice:</b> A passage titled "${escapeHTML(pkg.title)}" already exists in your library.
              </div>
            ` : ''}
            <div style="display:flex;gap:10px;margin-top:14px">
              <button class="btn sm blue" data-a="mesh-confirm-import">
                ${uiIcon("check")} Confirm &amp; Add to Reading Library
              </button>
              <button class="btn sm o" data-a="mesh-cancel-import">
                Cancel
              </button>
            </div>
          </div>
        `;
      }
    } catch(err) {
      showToast(err.message, "warn");
    }
  }
  else if (a === "mesh-confirm-import") {
    if (!PENDING_MESH_PACKAGE) return;
    const pkg = PENDING_MESH_PACKAGE;
    if (!Array.isArray(S.sh)) S.sh = [];
    S.sh.push(pkg);
    save();
    PENDING_MESH_PACKAGE = null;
    showToast(`Successfully imported "${pkg.title}"! Available under Practice. 🎉`);
    CURRENT_TAB = "practice";
    renderApp();
  }
  else if (a === "mesh-cancel-import") {
    PENDING_MESH_PACKAGE = null;
    const previewDiv = $("#mesh-preview-container");
    if (previewDiv) previewDiv.style.display = "none";
    showToast("Import cancelled.");
  }

  // Modals & Reports
  else if (a === "open-report-sheet") {
    openForm14Modal(v || "live");
  }
  else if (a === "modal-close") {
    closeReportModal();
  }
  else if (a === "download-csv") {
    downloadCSV(v || CURRENT_REPORT_MODAL_SOURCE || "live");
  }
  else if (a === "print-sheet") {
    try { printReportSheet(); }
    catch (error) { showToast(error.message, "warn"); }
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
    closeInlineDialog($("#auth-modal"));
  }
  else if (a === "toggle-reg-password") {
    const input = $("#reg-password");
    const toggleBtn = e.target.closest('[data-a="toggle-reg-password"]');
    if (input) {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
        toggleBtn.classList.toggle("is-revealed", isPassword);
        toggleBtn.innerHTML = isPassword
          ? `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
    }
  }
  else if (a === "auth-register-submit") {
    const name = $("#reg-name")?.value;
    const email = $("#reg-email")?.value;
    const password = $("#reg-password")?.value;
    const role = selectedRegistrationRole();
    const teacherCode = role === "student" ? $("#reg-teacher-code")?.value : "";
    const section = role === "teacher" ? $("#reg-section")?.value : "";

    if (!name || !email || !password) {
      showToast("Please fill in your name, email, and password.", "warn");
      return;
    }

    const res = AUTH.register({ name, email, password, role, teacherCode, section });
    if (res.success) {
      $("#auth-modal").hidden = true;
      GUEST_MODE = false;
      if (typeof initWisyoChatForCurrentAccount === "function") initWisyoChatForCurrentAccount();
      showToast(`Account created! Welcome, ${res.user.name} 🎉`);
      CURRENT_TAB = res.user.role === "student" && S.lvl === null
        ? "assess" : dashboardTabForRole(res.user.role);
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
      showInlineDialog(modal, modal.querySelector(".modal-close-btn"));
    }
  }
  else if (a === "projector-close") {
    closeInlineDialog($("#projector-modal"));
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

    try {
      AUTH.createAssignment(pId, pTitle, targetGroup, "Upcoming Session", note);
      showToast(`Assignment dispatched to ${targetGroup === 'all' ? 'entire class' : targetGroup}! 🚀`);
      renderApp();
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "teacher-remove-assignment") {
    if (!confirm("Remove this assignment from the class?")) return;
    try {
      AUTH.removeAssignment(v);
      renderApp();
      showToast("Assignment removed.");
    } catch (error) {
      showToast(error.message, "warn");
    }
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
    const input = $("#classroom-join-code") || $("#classroom-join-code-board") || $("#home-teacher-code");
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
      showInlineDialog(modal, $("#reg-name"));
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
      user.section = user.section || "Grade 8 - Section 1";
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
  else if (a === "practice-new" || a === "practice-edit") {
    try {
      openPracticeEditor(a === "practice-edit" ? v : null);
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "passage-modal-close") {
    PRACTICE_EDITOR_GENERATION++;
    EDITING_PRACTICE_ID = null;
    IMPORTING_LEGACY_MATERIAL_ID = null;
    closeInlineDialog($("#admin-passage-modal"));
  }
  else if (a === "practice-question-prev" || a === "practice-question-next") {
    showPracticeQuestion(PRACTICE_ACTIVE_QUESTION_INDEX + (a === "practice-question-next" ? 1 : -1));
  }
  else if (a === "practice-wisyo-suggest") {
    try {
      AUTH.practiceActor();
      const count = practiceQuestionCount();
      const generation = PRACTICE_EDITOR_GENERATION;
      const passageText = $("#pass-text").value;
      const button = $("#practice-wisyo-suggest");
      const status = $("#practice-wisyo-status");
      button.disabled = true;
      status.textContent = "Wisyo is drafting questions from your passage…";
      wisyoPracticeSuggestions(passageText, count, $("#pass-diff").value)
        .then(result => {
          if (generation !== PRACTICE_EDITOR_GENERATION || $("#admin-passage-modal").hidden) return;
          if ($("#pass-text").value !== passageText) {
            status.textContent = "The passage changed. Ask Wisyo again for suggestions based on the latest text.";
            return;
          }
          const current = readPracticeQuestionDrafts();
          let filled = 0;
          const merged = current.map((question, index) => {
            if (question.q.trim() || question.o.some(option => option.trim())) return question;
            filled++;
            return result.questions[index];
          });
          renderPracticeQuestionCards(merged, PRACTICE_ACTIVE_QUESTION_INDEX);
          status.textContent = filled
            ? `Wisyo filled ${filled} blank question${filled === 1 ? "" : "s"} using the ${result.source}. Check each answer before saving.`
            : "Your existing questions were kept. Clear a question to ask Wisyo for a new draft.";
        })
        .catch(error => {
          if (generation === PRACTICE_EDITOR_GENERATION) {
            status.textContent = error.message;
            showToast(error.message, "warn");
          }
        })
        .finally(() => { button.disabled = false; });
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (["practice-save-draft", "practice-submit", "practice-admin-save"].includes(a)) {
    try {
      savePracticeFromEditor(a === "practice-submit");
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "practice-approve" || a === "practice-reject") {
    const note = a === "practice-reject" ? prompt("Reason for rejection (shown to the teacher):") : "";
    if (a === "practice-reject" && note === null) return;
    try {
      AUTH.reviewPractice(v, a === "practice-approve" ? "approve" : "reject", note);
      renderApp();
      showToast(a === "practice-approve" ? "Practice approved and published." : "Practice returned to the teacher with feedback.");
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "practice-withdraw" || a === "practice-publish" || a === "practice-unpublish") {
    try {
      if (a === "practice-withdraw") AUTH.withdrawPractice(v);
      else AUTH.setPracticePublished(v, a === "practice-publish");
      renderApp();
      showToast(a === "practice-withdraw" ? "Practice moved to draft. You can edit it now."
        : a === "practice-publish" ? "Practice published." : "Practice unpublished.");
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "practice-delete") {
    if (!confirm("Delete this practice? This cannot be undone.")) return;
    try {
      AUTH.deletePractice(v);
      renderApp();
      showToast("Practice deleted.");
    } catch (error) {
      showToast(error.message, "warn");
    }
  }
  else if (a === "practice-remove-assignments") {
    if (!confirm("Remove this practice from every class assignment?")) return;
    try {
      const count = AUTH.removePracticeAssignments(v);
      renderApp();
      showToast(`${count} class assignment${count === 1 ? "" : "s"} removed.`);
    } catch (error) {
      showToast(error.message, "warn");
    }
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

  // Student My Reading Studio Actions
  else if (a === "studio-tab") {
    STUDIO_ACTIVE_SUBTAB = v || "import";
    renderApp();
  }
  else if (a === "studio-file-trigger") {
    const input = $("#studio-file-input");
    if (input) input.click();
  }
  else if (a === "studio-qcount") {
    STUDIO_Q_COUNT = Number(v) || 5;
    renderApp();
  }
  else if (a === "studio-generate-start") {
    handleStudioGenerateAndStart();
  }
  else if (a === "studio-launch-saved") {
    const all = typeof readLocalMaterials === "function" ? readLocalMaterials() : [];
    const mat = all.find(m => m.id === v);
    if (mat) {
      const passageObj = {
        id: mat.id,
        t: mat.title,
        diff: mat.difficulty,
        lang: mat.language,
        x: mat.text,
        qs: mat.questions
      };
      startQuiz([passageObj], "studio", `My Studio: ${mat.title}`);
    }
  }
  else if (a === "studio-delete") {
    if (!confirm("Are you sure you want to delete this material from your personal library?")) return;
    deleteMaterial(v).then(() => {
      showToast("Material removed from your personal library.");
      renderApp();
    }).catch(err => showToast(err.message, "warn"));
  }

  // Teacher Reading Studio Actions
  else if (a === "tstudio-subtab") {
    TEACHER_STUDIO_SUBTAB = v === "assignments" ? "assignments" : "queue";
    renderApp();
  }
  else if (a === "tstudio-convert-legacy") {
    const material = legacyTeacherMaterials(AUTH.currentUser?.id).find(item => item.id === v);
    if (!material) {
      showToast("Older material was not found for this teacher.", "warn");
      return;
    }
    try { openPracticeEditor(null, material); }
    catch (error) { showToast(error.message, "warn"); }
  }
  else if (a === "tstudio-assign-material") {
    TEACHER_STUDIO_SUBTAB = "assignments";
    renderApp();
    setTimeout(() => {
      const sel = $("#tstudio-assign-mat-select");
      if (sel) sel.value = v;
    }, 50);
  }
  else if (a === "tstudio-create-assignment-action") {
    const matId = $("#tstudio-assign-mat-select")?.value;
    const section = $("#tstudio-assign-section-input")?.value?.trim();
    const dueDate = $("#tstudio-assign-due-input")?.value;
    const mode = $("#tstudio-assign-mode-select")?.value || "practice";

    if (!matId || !section) {
      showToast("Please choose a material and specify a class section.", "warn");
      return;
    }

    createClassAssignment({
      materialId: matId,
      sectionCode: section,
      dueDate,
      mode
    }).then(() => {
      showToast("Class Assignment created successfully! 🚀");
      renderApp();
    }).catch(err => showToast(err.message, "warn"));
  }
  else if (a === "tstudio-export-pkg") {
    try {
      const json = exportAssignmentPackage(v);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `assignment_${v}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Assignment Package exported to JSON! 📦");
    } catch (err) {
      showToast(err.message, "warn");
    }
  }
  else if (a === "tstudio-delete-assignment") {
    if (!confirm("Are you sure you want to remove this class assignment?")) return;
    removeAssignment(v);
    showToast("Assignment removed.");
    renderApp();
  }
  else if (a === "tstudio-import-pkg-trigger") {
    const input = $("#tstudio-import-pkg-input");
    if (input) input.click();
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
  if (e.target.id === "studio-text-input") {
    STUDIO_EXTRACTED_TEXT = e.target.value;
    const stats = typeof normalizeImportedText === "function" ? normalizeImportedText(STUDIO_EXTRACTED_TEXT) : { wordCount: 0, charCount: 0, estMinutes: 1 };
    const statsEl = $("#studio-char-stats");
    if (statsEl) {
      statsEl.innerHTML = `<b>${stats.wordCount}</b> words · <b>${stats.charCount}</b> characters · ~${stats.estMinutes} min read`;
    }
  }
});

// Enter key support for AI input
document.addEventListener("keydown", e => {
  const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(item => !item.hidden);
  if (e.key === "Tab" && dialog) {
    const focusable = Array.from(dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
      .filter(item => !item.hidden && item.getClientRects().length);
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  if (e.key === "Enter" && e.target.id === "aii") {
    const val = e.target.value;
    e.target.value = "";
    aiSend(val);
  }
  if (e.key === "Escape") {
    closeInlineDialog($("#ai"));
    closeReportModal();
    closeInlineDialog($("#auth-modal"));
    closeInlineDialog($("#projector-modal"));
    if (!$("#admin-passage-modal").hidden) {
      PRACTICE_EDITOR_GENERATION++;
      EDITING_PRACTICE_ID = null;
      closeInlineDialog($("#admin-passage-modal"));
    }
    $("#tip").hidden = true;
  }
});

// Close modal when clicking dark backdrop
$("#md").addEventListener("click", e => {
  if (e.target.id === "md") closeReportModal();
});
$("#ai").addEventListener("click", e => {
  if (e.target.id === "ai") closeInlineDialog($("#ai"));
});

// Backdrop click closures for new modals
$("#auth-modal")?.addEventListener("click", e => {
  if (e.target.id === "auth-modal") closeInlineDialog($("#auth-modal"));
});
$("#projector-modal")?.addEventListener("click", e => {
  if (e.target.id === "projector-modal") closeInlineDialog($("#projector-modal"));
});
$("#admin-passage-modal")?.addEventListener("click", e => {
  if (e.target.id === "admin-passage-modal") {
    PRACTICE_EDITOR_GENERATION++;
    EDITING_PRACTICE_ID = null;
    closeInlineDialog($("#admin-passage-modal"));
  }
});

// JSON Backup Restore File Handler
document.addEventListener("input", e => {
  if (e.target.id === "practice-question-slider") {
    showPracticeQuestion(Number(e.target.value) - 1);
  }
});

document.addEventListener("change", e => {
  if (e.target.id === "speech-follow") {
    setSpeechSetting("follow", e.target.checked);
    return;
  }
  if (["speech-mode", "speech-language", "speech-voice", "speech-rate"].includes(e.target.id)) {
    stopSpeech();
    setSpeechSetting(e.target.id.slice("speech-".length), e.target.value);
    refreshSpeechControls(ACTIVE_QUIZ?.steps[ACTIVE_QUIZ.idx]?.P);
    return;
  }
  if (e.target.dataset?.a === "teacher-journey-override") {
    try {
      setStudentJourneyOverride(e.target.dataset.v, e.target.value);
      showToast("Student reading tier access updated in this browser.");
    } catch (error) {
      const student = AUTH.users.find(user => user.id === e.target.dataset.v);
      e.target.value = student?.journeyOverride == null ? "" : String(student.journeyOverride);
      showToast(error.message, "warn");
    }
    return;
  }
  if (e.target.name === "reg-role") {
    updateRegistrationRole();
    return;
  }
  if (e.target.id === "practice-question-count") {
    const previous = readPracticeQuestionDrafts();
    let count;
    try { count = practiceQuestionCount(); }
    catch (error) {
      e.target.value = String(previous.length);
      showToast(error.message, "warn");
      return;
    }
    if (count < previous.length && previous.slice(count).some(question =>
      question.q.trim() || question.o.some(option => option.trim()))
      && !confirm("Remove the questions above this number? Their unsaved text will be lost.")) {
      e.target.value = String(previous.length);
      return;
    }
    PRACTICE_EDITOR_GENERATION++;
    const activeIndex = count > previous.length ? previous.length
      : Math.min(PRACTICE_ACTIVE_QUESTION_INDEX, count - 1);
    renderPracticeQuestionCards(Array.from({ length: count }, (_, index) => previous[index] ?? {}), activeIndex);
    $("#practice-wisyo-status").textContent = "Wisyo suggestions need your review before submission.";
    return;
  }
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
    return;
  }
  if (e.target.id === "pass-file") {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const passageText = $("#pass-text");
    const status = $("#pass-file-status");
    if (passageText.value.trim() && !confirm("Replace the current passage text with the imported file? Your questions will stay for review.")) {
      input.value = "";
      return;
    }
    PRACTICE_EDITOR_GENERATION++;
    const generation = PRACTICE_EDITOR_GENERATION;
    status.textContent = `Reading ${file.name}…`;
    extractTextFromFile(file).then(result => {
      if (generation !== PRACTICE_EDITOR_GENERATION || $("#admin-passage-modal").hidden) return;
      if (!result.success) {
        status.textContent = result.error || "Could not read this file.";
        return;
      }
      if (!result.text.trim()) {
        status.textContent = result.error || "No readable text found. Paste the passage manually.";
        return;
      }
      passageText.value = result.text;
      if (!$("#pass-title").value.trim()) {
        $("#pass-title").value = result.stats?.cleanTitle || file.name.replace(/\.[^/.]+$/, "");
      }
      status.textContent = result.error || `${file.name} imported. Review the passage and questions before saving.`;
      if (result.text.length > 30000) status.textContent += " Shorten the passage to 30,000 characters before saving.";
      passageText.focus();
    }).catch(error => {
      if (generation === PRACTICE_EDITOR_GENERATION && !$("#admin-passage-modal").hidden) {
        status.textContent = error.message || "Could not read this file.";
      }
    })
      .finally(() => { input.value = ""; });
    return;
  }
  if (e.target.id === "studio-file-input") {
    handleStudioFileSelected(e.target);
    return;
  }
  if (e.target.id === "tstudio-import-pkg-input") {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        try {
          importAssignmentPackage(evt.target.result);
          showToast("Assignment Package imported successfully! 📦");
          renderApp();
        } catch (err) {
          showToast(`Import failed: ${err.message}`, "warn");
        }
      };
      reader.readAsText(file);
    }
    return;
  }
});

// Mobile touch long-press for words in reading passage
let wordLongPressTimer = null;
let wordTouchStartPos = null;

document.addEventListener("touchstart", e => {
  const wordEl = e.target.closest("#active-ps .speech-word, #active-ps .w");
  if (!wordEl) return;
  const word = wordEl.dataset.v || wordEl.textContent.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return;
  const touch = e.touches?.[0];
  if (!touch) return;
  wordTouchStartPos = { x: touch.clientX, y: touch.clientY };
  if (wordLongPressTimer) clearTimeout(wordLongPressTimer);
  wordLongPressTimer = setTimeout(() => {
    wordLongPressTimer = null;
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
    if (typeof D !== "undefined" && D[cleanWord]) {
      const tipActionEl = document.createElement("button");
      tipActionEl.setAttribute("data-a", "tip");
      tipActionEl.setAttribute("data-v", cleanWord);
      tipActionEl.style.display = "none";
      document.body.appendChild(tipActionEl);
      tipActionEl.click();
      tipActionEl.remove();
    }
  }, 400);
}, { passive: true });

document.addEventListener("touchmove", e => {
  if (!wordLongPressTimer || !wordTouchStartPos) return;
  const touch = e.touches?.[0];
  if (!touch) return;
  const dx = Math.abs(touch.clientX - wordTouchStartPos.x);
  const dy = Math.abs(touch.clientY - wordTouchStartPos.y);
  if (dx > 10 || dy > 10) {
    clearTimeout(wordLongPressTimer);
    wordLongPressTimer = null;
  }
}, { passive: true });

document.addEventListener("touchend", () => {
  if (wordLongPressTimer) {
    clearTimeout(wordLongPressTimer);
    wordLongPressTimer = null;
  }
}, { passive: true });

document.addEventListener("touchcancel", () => {
  if (wordLongPressTimer) {
    clearTimeout(wordLongPressTimer);
    wordLongPressTimer = null;
  }
}, { passive: true });

// Initial boot
AUTH.init();
if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.start();
if (typeof migrateLegacyTeacherMaterials === "function") migrateLegacyTeacherMaterials();
if (typeof initWisyoChatForCurrentAccount === "function") initWisyoChatForCurrentAccount();
const openingRegistration = window.location?.hash === "#register";
if (openingRegistration) {
  try {
    window.history?.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (error) {
    // The page can still open when a file URL does not allow history changes.
  }
}
if (AUTH.currentUser) {
  CURRENT_TAB = AUTH.currentUser.role === "student" && S.lvl === null
    ? "assess" : dashboardTabForRole(AUTH.currentUser.role);
}
renderApp();
if (openingRegistration && !AUTH.currentUser) openRegistration();
