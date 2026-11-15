let QUIZ_RESULT = null;
let KARAOKE_ANIM_FRAME = null;
let KARAOKE_TIMEOUTS = [];

function clearKaraokeTimers() {
  if (KARAOKE_ANIM_FRAME && typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(KARAOKE_ANIM_FRAME);
    KARAOKE_ANIM_FRAME = null;
  }
  if (Array.isArray(KARAOKE_TIMEOUTS)) {
    KARAOKE_TIMEOUTS.forEach(id => clearTimeout(id));
    KARAOKE_TIMEOUTS = [];
  }
}

function skipQuizKaraoke() {
  clearKaraokeTimers();
  if (QUIZ_RESULT) {
    QUIZ_RESULT.karaokeDone = true;
    renderQuizResult();
  }
}

function quizRatingText(pct) {
  if (pct === 100) return "PERFECT! · OUTSTANDING!";
  if (pct >= 75) return "EXCELLENT! · GREAT JOB!";
  if (pct >= 50) return "GOOD JOB! · KEEP GOING!";
  return "KEEP PRACTICING! · PROGRESS!";
}

function quizWisyoCelebrationQuote(pct) {
  if (pct === 100) return "Outstanding! You got every answer right!";
  if (pct >= 75) return "Great job! You read with strong comprehension!";
  if (pct >= 50) return "Good effort! Keep reading to sharpen your skills!";
  return "Don't worry! Every mistake is a step forward in learning!";
}

function renderConfettiParticles() {
  const colors = ["#F5AB1D", "#2589E6", "#0D9488", "#E11D48", "#8B5CF6", "#F97316"];
  let html = "";
  for (let i = 0; i < 20; i++) {
    const left = (i * 5) + (i % 3);
    const delay = (i % 6) * 0.15;
    const dur = 1.8 + (i % 4) * 0.4;
    const bg = colors[i % colors.length];
    const size = 7 + (i % 3) * 3;
    html += `<span class="confetti-piece" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;background:${bg};width:${size}px;height:${size}px"></span>`;
  }
  return html;
}

function updateDailyStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!S.lastPracticeDate) {
    S.streak = 1;
    S.lastPracticeDate = today;
  } else if (S.lastPracticeDate === today) {
    if (!S.streak) S.streak = 1;
  } else {
    const lastDate = new Date(S.lastPracticeDate + "T00:00:00Z");
    const currDate = new Date(today + "T00:00:00Z");
    const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / 86400000);
    if (diffDays === 1) {
      S.streak = (S.streak || 0) + 1;
      S.lastPracticeDate = today;
    } else if (diffDays > 1) {
      S.streak = 1;
      S.lastPracticeDate = today;
    }
  }
  save();
  return S.streak;
}

function runKaraokeCelebrationTicker(targetPct, score, total) {
  clearKaraokeTimers();
  if (typeof requestAnimationFrame === "undefined") return;

  const startTime = Date.now();
  const valEl = $("#karaoke-score-val");
  const ringEl = $("#karaoke-score-ring");
  const ratingEl = $("#karaoke-rating");
  const bubbleEl = $("#karaoke-wisyo-bubble");
  const confettiEl = $("#karaoke-confetti");

  if (!valEl || !ringEl) return;

  let locked = false;

  function tick() {
    const elapsed = Date.now() - startTime;

    if (elapsed < 1000) {
      valEl.textContent = "0%";
      if (bubbleEl) bubbleEl.textContent = "Checking your answers...";
      KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
    } else if (elapsed < 3200) {
      const progress = (elapsed - 1000) / 2200;
      const current = Math.min(targetPct, Math.round(targetPct * (1 - Math.pow(1 - progress, 2))));
      valEl.textContent = current + "%";
      if (bubbleEl) bubbleEl.textContent = "Calculating your score...";
      KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
    } else if (elapsed < 4200) {
      const progress = (elapsed - 3200) / 1000;
      const remaining = targetPct - Math.round(targetPct * 0.9);
      const current = Math.min(targetPct, Math.round(targetPct * 0.9) + Math.round(remaining * (1 - Math.pow(1 - progress, 3))));
      valEl.textContent = current + "%";
      ringEl.classList.add("suspense");
      if (bubbleEl) bubbleEl.textContent = "Almost ready with the results...";
      KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
    } else if (!locked) {
      locked = true;
      valEl.textContent = targetPct + "%";
      ringEl.classList.remove("suspense");
      ringEl.classList.add("locked");
      if (ratingEl) {
        ratingEl.textContent = quizRatingText(targetPct);
        ratingEl.classList.add("show");
      }
      if (bubbleEl) {
        bubbleEl.textContent = quizWisyoCelebrationQuote(targetPct);
      }

      const confettiTimer = setTimeout(() => {
        if (confettiEl) confettiEl.innerHTML = renderConfettiParticles();
      }, 700);
      KARAOKE_TIMEOUTS.push(confettiTimer);

      const doneTimer = setTimeout(() => {
        if (QUIZ_RESULT) QUIZ_RESULT.karaokeDone = true;
        const skipBtn = $(".karaoke-skip-btn");
        if (skipBtn) skipBtn.remove();
      }, 2300);
      KARAOKE_TIMEOUTS.push(doneTimer);
    }
  }

  KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
}

function startQuiz(passages, mode, title) {
  clearKaraokeTimers();

  QUIZ_RESULT = null;
  const steps = [];
  passages.forEach(P => {
    P.qs.forEach(q => {
      steps.push({ P, q });
    });
  });

  if (mode === "pr" && typeof updateQuestProgress === "function") {
    updateQuestProgress("read", 1);
  }

  const heartsObj = typeof initQuizHearts === "function"
    ? initQuizHearts(steps.length)
    : { hearts: steps.length, maxHearts: steps.length };

  ACTIVE_QUIZ = {
    title,
    mode, // 'pl' for placement, 'pr' for practice
    steps,
    idx: 0,
    correctCount: 0,
    correctQuestions: [],
    userAnswers: [],
    stage: mode === "review" ? "question" : "passage",
    isAnswered: false,
    selectedChoice: null,
    startTime: Date.now(),
    hearts: heartsObj.hearts,
    maxHearts: heartsObj.maxHearts,
    accommodated: heartsObj.accommodated,
    processedAnswerIds: []
  };

  renderApp();
  focusQuizStage();
}

function renderQuiz() {
  stopSpeech();
  const qz = ACTIVE_QUIZ;
  const currentStep = qz.steps[qz.idx] || {};
  const P = currentStep.P || {};
  const q = currentStep.q || { o: [] };
  const progressPct = ((qz.idx) / qz.steps.length) * 100;
  const isPassageStage = qz.stage === "passage";
  const passageQuestionCount = qz.steps.filter(step => step.P.id === P.id).length;
  const questionLabel = `Question ${qz.idx + 1} of ${qz.steps.length}`;

  const isReview = qz.mode === "review";
  const isStudio = qz.mode === "studio";
  const diffBadge = P.diff ? `<span class="badge-diff diff-${P.diff}">${P.diff.toUpperCase()}</span>` : "";
  const heartPill = (isReview || isStudio)
    ? `<span class="pill ok" style="font-weight:600" title="Safe zone: mistakes never deduct hearts">${uiIcon("check")} ${isStudio ? "Studio Safe Zone (0 Hearts Lost)" : "Review Safe Zone (0 Hearts Lost)"}</span>`
    : (qz.mode === "pr" && typeof renderHeartPill === "function" ? renderHeartPill(true) : "");

  const v = $("#v");
  if (v) {
    v.innerHTML = `
    <div class="reader-flow ${isPassageStage ? "reader-flow-passage" : "reader-flow-question"}">
    <div class="reader-progress-head">
      <div>
        <div class="lab">${isPassageStage ? "Read the passage" : "Reading practice"}</div>
        <h2 tabindex="-1">${escapeHTML(qz.title)}</h2>
        <span class="sub-sm">${isPassageStage ? `Read first, then answer ${passageQuestionCount} ${passageQuestionCount === 1 ? "question" : "questions"}.` : questionLabel}</span>
      </div>
      <button class="btn sm o" data-a="quit-quiz">Exit Quiz</button>
    </div>
    <div class="bar reader-progress-bar" role="progressbar" aria-label="Question progress" aria-valuemin="0" aria-valuemax="${qz.steps.length}" aria-valuenow="${qz.idx}"><i style="width:${progressPct}%"></i></div>

    ${isPassageStage ? `
    <!-- Reader Toolbar -->
    <div class="reader-toolbar">
      <div class="reader-tools">
        ${diffBadge}
        ${heartPill}
        <button class="reader-speech-btn" data-a="speech-read" title="${SPEECH_PASSAGE_ACTIVE ? 'Stop audio' : 'Read passage aloud'}" aria-label="${SPEECH_PASSAGE_ACTIVE ? 'Stop audio' : 'Read passage aloud'}" aria-pressed="${Boolean(SPEECH_PASSAGE_ACTIVE)}">${uiIcon(SPEECH_PASSAGE_ACTIVE ? "stop" : "sound")} ${SPEECH_PASSAGE_ACTIVE ? "Stop audio" : "Read aloud"}</button>
        <button class="reader-speech-btn secondary" data-a="${typeof isSpeechPaused === 'function' && isSpeechPaused() ? 'speech-resume' : 'speech-pause'}" title="${typeof isSpeechPaused === 'function' && isSpeechPaused() ? 'Resume reading narration' : 'Pause reading narration'}" aria-label="${typeof isSpeechPaused === 'function' && isSpeechPaused() ? 'Resume reading narration' : 'Pause reading narration'}" ${!SPEECH_PASSAGE_ACTIVE ? 'hidden' : ''}>${typeof isSpeechPaused === 'function' && isSpeechPaused() ? '▶ Resume' : '⏸ Pause'}</button>
        <div class="speech-speed-pills" role="group" aria-label="Reading voice speed" style="display:inline-flex;gap:4px;margin-left:4px">
          <button type="button" class="icon-btn sm ${SPEECH_SETTINGS.rate === 0.75 ? 'on' : ''}" data-a="speech-rate-set" data-v="0.75" title="0.75x speed">0.75x</button>
          <button type="button" class="icon-btn sm ${SPEECH_SETTINGS.rate === 1 ? 'on' : ''}" data-a="speech-rate-set" data-v="1" title="1x speed">1x</button>
          <button type="button" class="icon-btn sm ${SPEECH_SETTINGS.rate === 1.25 ? 'on' : ''}" data-a="speech-rate-set" data-v="1.25" title="1.25x speed">1.25x</button>
        </div>
      </div>
      <div class="reader-tools">
        <button class="icon-btn" data-a="font-dec" title="Decrease font size" aria-label="Decrease font size">A−</button>
        <button class="icon-btn" data-a="font-inc" title="Increase font size" aria-label="Increase font size">A+</button>
      </div>
    </div>
    <label class="speech-follow-control"><input id="speech-follow" type="checkbox" ${SPEECH_SETTINGS.follow ? "checked" : ""}> Follow narration as it reads</label>
    <details class="speech-settings">
      <summary>Voice settings</summary>
      <div class="speech-settings-grid">
        <label for="speech-mode">Narration
          <select id="speech-mode" class="auth-input">
            <option value="auto">Recording when available</option>
            <option value="device">Device voice</option>
          </select>
        </label>
        <label for="speech-language">Language
          <select id="speech-language" class="auth-input">
            <option value="auto">Passage language</option>
            <option value="en-US">English</option>
            <option value="fil-PH">Filipino</option>
            <option value="ceb-PH">Cebuano</option>
          </select>
        </label>
        <label for="speech-voice">Device voice
          <select id="speech-voice" class="auth-input"><option value="">Automatic</option></select>
        </label>
        <label for="speech-rate">Speed
          <select id="speech-rate" class="auth-input">
            <option value="0.75">Gentle (0.75x)</option>
            <option value="0.85">Relaxed (0.85x)</option>
            <option value="1">Normal (1x)</option>
            <option value="1.1">Active (1.1x)</option>
            <option value="1.25">Brisk (1.25x)</option>
          </select>
        </label>
        <button class="btn o sm" type="button" data-a="speech-preview">Preview device voice</button>
      </div>
      <p id="speech-status" class="sub-sm" role="status" aria-live="polite"></p>
    </details>

    <div class="reader-stage reader-passage-stage">
        <div class="card reader-passage-card">
          <div class="lab">Passage</div>
          <h3 tabindex="-1">${escapeHTML(P.t)}</h3>
          <div class="ps" id="active-ps">${tapMarkup(P.x)}</div>
          <div class="reader-dictionary-tip sub-sm">${uiIcon("bulb")} <span>Tip: Tap any dotted word to see Filipino, Bisaya, & English meanings.</span></div>
        </div>
        <div class="reader-stage-footer"><button class="btn blue reader-stage-next" data-a="quiz-begin-question" type="button">${!qz.hasStarted ? "Start questions" : "Back to question"} ${uiIcon("next")}</button></div>
    </div>
    ` : `
    <div class="reader-stage reader-question-stage">
      <div class="reader-question-context"><span>${uiIcon("practice")} ${escapeHTML(P.t)}</span><button class="btn o sm" data-a="quiz-show-passage" type="button">${uiIcon("practice")} View passage</button></div>
        <div class="card reader-question-card quiz-card-enter">
          <div class="lab">${escapeHTML(q.k || "Comprehension")} Question · ${qz.idx + 1} of ${qz.steps.length}</div>
          <p class="q" tabindex="-1">${escapeHTML(q.q)}</p>

          <div id="options-list">
            ${q.o.map((opt, i) => {
              let optClass = "opt";
              let optExtra = "";
              if (qz.isAnswered) {
                if (i === q.a) {
                  optClass += " ok answer-correct-pop";
                  optExtra = ` <span class="opt-result">${uiIcon("check")} ${i === qz.selectedChoice ? "Your answer · Correct" : "Correct answer"}</span>`;
                } else if (i === qz.selectedChoice) {
                  optClass += " no answer-wrong-shake";
                  optExtra = ` <span class="opt-result">${uiIcon("close")} Your answer · Incorrect</span>`;
                }
              }
              return `
              <button class="${optClass}" data-a="submit-answer" data-v="${i}" type="button" ${qz.isAnswered ? "disabled" : ""}>
                <span class="opt-letter">${String.fromCharCode(65 + i)}</span>
                <span class="opt-text">${escapeHTML(opt)}</span>
                ${optExtra}
              </button>
            `;
            }).join("")}
          </div>

          <div id="quiz-feedback" role="status" aria-live="polite" tabindex="-1"></div>
        </div>
    </div>`}
    </div>
  `;
  }
  if (isPassageStage) refreshSpeechControls(P);
  if (!isPassageStage && qz.isAnswered && Number.isInteger(qz.selectedChoice)) {
    renderQuizAnswerFeedback(qz.selectedChoice);
  }
}

function focusQuizStage({ restorePassage = false } = {}) {
  const main = $("#v");
  const savedOffset = ACTIVE_QUIZ?.passageScrollOffset;
  const mainTop = main?.getBoundingClientRect?.().top + (window.scrollY || 0);
  if (restorePassage && Number.isFinite(savedOffset) && Number.isFinite(mainTop)) {
    window.scrollTo?.({ top: mainTop + savedOffset, behavior: "auto" });
  } else {
    main?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }
  const target = ACTIVE_QUIZ?.stage === "passage" ? ".reader-passage-card h3" : ".reader-question-card .q";
  main?.querySelector?.(target)?.focus?.({ preventScroll: true });
}

function showQuizStage(stage) {
  const qz = ACTIVE_QUIZ;
  if (!qz || !["passage", "question"].includes(stage)) return;
  if (qz.stage === "passage" && stage === "question") {
    const main = $("#v");
    const mainTop = main?.getBoundingClientRect?.().top + (window.scrollY || 0);
    if (Number.isFinite(window.scrollY) && Number.isFinite(mainTop)) {
      qz.passageScrollOffset = Math.max(0, window.scrollY - mainTop);
    }
  }
  const restorePassage = stage === "passage" && qz.hasStarted;
  if (qz.stage === "question") qz.hasStarted = true;
  qz.stage = stage;
  if (stage === "question") qz.hasStarted = true;
  renderQuiz();
  focusQuizStage({ restorePassage });
}

function handleAnswer(choiceIdx) {
  const qz = ACTIVE_QUIZ;
  if (!qz || qz.isAnswered) return;
  qz.stage = "question";
  qz.isAnswered = true;
  qz.selectedChoice = choiceIdx;
  if (Array.isArray(qz.userAnswers)) {
    qz.userAnswers[qz.idx] = choiceIdx;
  }

  const step = qz.steps[qz.idx];
  const q = step.q;
  const isCorrect = choiceIdx === q.a;
  const questionId = `${step.P.id}:${qz.idx}`;

  // Deduct heart for incorrect practice quiz answer (diagnostic placement is exempt)
  if (!isCorrect && qz.mode === "pr") {
    const heartRes = typeof deductQuizHeart === "function"
      ? deductQuizHeart(qz, questionId)
      : { success: true, hearts: Math.max(0, (qz.hearts || 1) - 1), maxHearts: qz.maxHearts || 4, deducted: true };
    if (heartRes.deducted) {
      showToast(`Incorrect answer: -1 heart (${heartRes.hearts}/${heartRes.maxHearts} left)`, "warn");
    }
  }

  // Schedule question review in spaced repetition engine
  if (typeof scheduleQuestionReview === "function") {
    if (!isCorrect && (qz.mode === "pr" || qz.mode === "studio")) {
      scheduleQuestionReview({
        questionId,
        passageId: step.P.id,
        passageTitle: step.P.t,
        passageExcerpt: step.P.x,
        qIndex: qz.idx,
        questionText: q.q,
        options: q.o,
        correctAnswer: q.a,
        explanation: q.exp,
        skill: q.k || "General",
        outcome: "incorrect"
      });
    } else if (qz.mode === "review") {
      scheduleQuestionReview({
        questionId: step.questionId || questionId,
        passageId: step.P.id,
        passageTitle: step.P.t,
        passageExcerpt: step.P.x,
        qIndex: qz.idx,
        questionText: q.q,
        options: q.o,
        correctAnswer: q.a,
        explanation: q.exp,
        skill: q.k || "General",
        outcome: isCorrect ? "correct" : "incorrect"
      });
    }
  }

  // Track recent mistake for Wisyo AI tutor
  if (!isCorrect) {
    S.miss = {
      p: step.P.x,
      q: q.q,
      ch: q.o[choiceIdx],
      ok: q.o[q.a],
      k: q.k || "Comprehension",
      exp: q.exp || "Review the passage carefully to locate the direct text evidence."
    };
  }

  if (isCorrect) {
    qz.correctCount++;
    if (qz.mode === "pr") qz.correctQuestions.push({ index: qz.idx, skill: q.k || "General" });
  }

  // Update skills stats
  const skill = q.k || "General";
  const st = S.sk[skill] || [0, 0];
  st[0] += isCorrect ? 1 : 0;
  st[1] += 1;
  S.sk[skill] = st;
  save();

  if (typeof recordSkillAttempt === "function") {
    recordSkillAttempt({
      skill,
      isCorrect,
      questionId,
      passageId: step.P.id,
      timestamp: Date.now()
    });
  }

  renderQuiz();
  $("#quiz-feedback")?.focus?.({ preventScroll: true });
}

function renderQuizAnswerFeedback(choiceIdx) {
  const qz = ACTIVE_QUIZ;
  if (!qz) return;
  const step = qz.steps[qz.idx];
  const q = step.q;
  const isCorrect = choiceIdx === q.a;
  const isOutOfHearts = qz.mode === "pr" && qz.hearts === 0;

  // Mark the chosen and correct answers with words, icons, and color.
  $$(".opt").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.a) {
      btn.classList.add("ok", "answer-correct-pop");
      if (!btn.innerHTML || !btn.innerHTML.includes("opt-result")) {
        btn.insertAdjacentHTML("beforeend", `<span class="opt-result">${uiIcon("check")} ${i === choiceIdx ? "Your answer · Correct" : "Correct answer"}</span>`);
      }
    } else if (i === choiceIdx) {
      btn.classList.add("no", "answer-wrong-shake");
      if (!btn.innerHTML || !btn.innerHTML.includes("opt-result")) {
        btn.insertAdjacentHTML("beforeend", `<span class="opt-result">${uiIcon("close")} Your answer · Incorrect</span>`);
      }
    }
  });

  // Display feedback box
  const fb = $("#quiz-feedback");
  if (isOutOfHearts) {
    fb.innerHTML = `
      <div class="fb no answer-fb-pop">
        <b>${uiIcon("close")} Out of Hearts! (0/${qz.maxHearts})</b>
        <div>Correct answer: <b>${escapeHTML(q.o[q.a])}</b></div>
        ${q.exp ? `<div class="sub-sm" style="margin-top:4px">${escapeHTML(q.exp)}</div>` : ''}
        <div class="sub-sm" style="margin-top:6px;color:var(--text)">You ran out of hearts for this story. Review your answers or try again with fresh hearts!</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <button class="btn blue" data-a="out-of-hearts-retry" data-v="${escapeHTML(step.P.id)}">
          ${uiIcon("refresh")} Try Again with Fresh Hearts
        </button>
        <div style="display:flex;gap:8px">
          <button class="btn sm o" data-a="ai-explain-why" style="flex:1">
            ${uiIcon("bulb")} Ask Wisyo Why
          </button>
          <button class="btn sm o" data-a="quiz-exit-to-library" style="flex:1">
            ${uiIcon("practice")} Choose Another Story
          </button>
        </div>
      </div>
    `;
    return;
  }

  fb.innerHTML = `
    <div class="fb ${isCorrect ? 'ok' : 'no'} answer-fb-pop">
      <b>${isCorrect ? `${uiIcon("check")} Correct!` : `${uiIcon("bulb")} Not quite — take a look at the clue!`}</b>
      <div>${isCorrect ? 'Great job analyzing the text evidence.' : `Correct answer: <b>${escapeHTML(q.o[q.a])}</b>`}</div>
      ${q.exp ? `<div class="sub-sm" style="margin-top:4px">${escapeHTML(q.exp)}</div>` : ''}
    </div>

    <div style="display:flex;gap:8px;margin-top:10px">
      ${!isCorrect ? `
        <button class="btn sm o" data-a="ai-explain-why" style="flex:1">
          ${uiIcon("bulb")} Ask Wisyo Why
        </button>
      ` : ''}
      <button class="btn sm blue" data-a="quiz-next" style="flex:1">
        ${qz.idx + 1 < qz.steps.length ? 'Next Question →' : 'Finish Quiz ✓'}
      </button>
    </div>
  `;
}

function handleQuizNext() {
  const qz = ACTIVE_QUIZ;
  if (!qz) return;
  stopSpeech();
  const previousPassageId = qz.steps[qz.idx]?.P?.id;
  qz.idx++;
  qz.isAnswered = false;
  qz.selectedChoice = null;

  if (qz.idx < qz.steps.length) {
    qz.stage = qz.steps[qz.idx]?.P?.id === previousPassageId ? "question" : "passage";
    qz.hasStarted = qz.stage === "question";
    renderQuiz();
    focusQuizStage();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const qz = ACTIVE_QUIZ;
  if (!qz) return;
  const isPlacement = qz.mode === "pl";
  const score = qz.correctCount;
  const total = qz.steps.length;

  // Calculate unique words read
  const passageIds = [...new Set(qz.steps.map(s => s.P.id))];
  const allKnown = [...PLACEMENT_TEST, ...getPublishedPassages()];

  let totalWords = 0;
  passageIds.forEach(id => {
    const found = allKnown.find(p => p.id === id);
    if (found) {
      totalWords += wordCount(found.x);
      if (!isPlacement && !S.done.includes(id)) {
        S.done.push(id);
      }
    }
  });

  S.w += totalWords;
  S.ss += 1;

  if (isPlacement) {
    // Calibrate placement based on 4-point scale:
    // 0-1: Frustration, 2: Instructional, 3: Independent, 4: Mastery
    if (score <= 1) S.lvl = 0;
    else if (score === 2) S.lvl = 1;
    else if (score === 3) S.lvl = 2;
    else S.lvl = 3;

    if (S.l0 === null) S.l0 = S.lvl;

    // Check if user is Guest or Student
    if (!AUTH.currentUser) {
      // Guest mode: generate guest token so student can give it to teacher or register
      const guestToken = AUTH.createGuestToken(S.lvl, 110, Math.round((score / qz.steps.length) * 100));
      S.guestToken = guestToken;
    } else if (AUTH.currentUser.role === "student") {
      AUTH.currentUser.lvl = S.lvl;
      AUTH.currentUser.wordsRead = S.w;
      AUTH.saveUsers();
      AUTH.saveSession();
    }
  }

  save();

  let journeyError = null;
  let journeyRecord = null;
  let newBadges = [];
  const isStudio = qz.mode === "studio";
  try {
    if (isPlacement) recordJourneyPlacement(S.lvl);
    else if (qz.mode === "pr") {
      journeyRecord = recordJourneyPractice(qz);
      newBadges = journeyRecord?.newBadges || [];
    }
  } catch (error) {
    journeyError = error.message;
  }

  const attemptId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const xpAwarded = isStudio
    ? Math.min(10, qz.correctCount * 2)
    : (journeyRecord?.xpGained || (qz.mode === "review" ? qz.correctCount * 5 : 0));

  const finishedQuiz = {
    id: attemptId,
    title: qz.title,
    mode: qz.mode,
    steps: qz.steps,
    correctCount: qz.correctCount,
    correctQuestions: qz.correctQuestions || [],
    userAnswers: [...(qz.userAnswers || [])],
    startTime: qz.startTime,
    completedAt: Date.now(),
    xpAwarded
  };

  if (!Array.isArray(S.attempts)) S.attempts = [];
  S.attempts.push({
    id: attemptId,
    passageId: qz.steps[0]?.P?.id || "unknown",
    mode: qz.mode,
    score,
    total,
    xpAwarded,
    timestamp: Date.now()
  });
  if (S.attempts.length > 50) S.attempts = S.attempts.slice(-50);

  const streak = !isPlacement ? updateDailyStreak() : (S.streak || 1);

  if (!isPlacement && typeof updateQuestProgress === "function") {
    if (qz.mode === "review") {
      updateQuestProgress("review", 1);
      if (qz.correctCount > 0 && typeof awardQuestBonusXP === "function") {
        awardQuestBonusXP(qz.correctCount * 5);
      }
    } else {
      updateQuestProgress("read", 1);
      if (score / total >= 0.75) {
        updateQuestProgress("quiz", 1);
      }
    }
  }

  ACTIVE_QUIZ = null;
  QUIZ_RESULT = {
    quiz: finishedQuiz,
    isPlacement,
    score,
    total,
    totalWords,
    newBadges: newBadges || [],
    xpGained: xpAwarded,
    totalXP: journeyRecord?.totalXP ?? (typeof journeyTotalXP === "function" ? journeyTotalXP() : 0),
    isFirstCompletion: journeyRecord?.isFirstCompletion ?? false,
    improvement: journeyRecord?.improvement || 0,
    previousBest: journeyRecord?.previousBest || 0,
    levelUp: journeyRecord?.tierLeveledUp ? {
      fromTier: journeyRecord.beforeTier,
      toTier: journeyRecord.afterTier,
      tierName: journeyRecord.tierName
    } : null,
    streak: streak || 1,
    heartsRemaining: qz.hearts,
    maxHearts: qz.maxHearts,
    reviewMode: false,
    karaokeDone: false
  };

  CURRENT_TAB = isPlacement ? "assess" : "practice";
  renderApp();

  showToast(journeyError
    ? `Quiz completed, but ${journeyError}`
    : `Quiz completed! ${score} of ${total} correct · +${totalWords} words added to Bayanihan Quest!${newBadges.length ? ` New badge${newBadges.length > 1 ? "s" : ""}: ${newBadges.map(badge => badge.title).join(", ")}.` : ""}`,
  journeyError ? "warn" : undefined);
}

function renderQuizResult() {
  const res = QUIZ_RESULT;
  if (!res) return;
  const pct = Math.round((res.score / res.total) * 100);
  const isHigh = res.score / res.total >= 0.75;
  const isMid = res.score / res.total >= 0.5 && !isHigh;

  const isReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion || typeof requestAnimationFrame === "undefined") {
    res.karaokeDone = true;
  }

  let encourageHtml = "";
  if (isHigh) {
    encourageHtml = `
      <div class="quiz-result-message ok" role="note">
        <b>${uiIcon("check")} Outstanding! Excellent comprehension of the story!</b>
        <p class="sub">You identified key details and solid text evidence. You are ready for the next reading challenge.</p>
      </div>
    `;
  } else if (isMid) {
    encourageHtml = `
      <div class="quiz-result-message warn" role="note">
        <b>${uiIcon("bulb")} Good effort! Very close to your goal.</b>
        <p class="sub">You grasped important ideas from the story. Review your answers to spot clues in the passage, or try again to beat your personal best.</p>
      </div>
    `;
  } else {
    encourageHtml = `
      <div class="quiz-result-message info" role="note">
        <b>${uiIcon("bulb")} Keep learning! Practice makes progress.</b>
        <p class="sub">No penalties and no XP loss. Every mistake is an opportunity to learn. Review the answers below to find clues in the passage, and feel free to try again anytime!</p>
      </div>
    `;
  }

  let xpRow = "";
  if (!res.isPlacement) {
    let xpExplanation = "";
    if (res.isFirstCompletion) {
      xpExplanation = `10 XP for completion + ${res.score * 5} XP for ${res.score} correct answers`;
    } else if (res.improvement > 0) {
      xpExplanation = `+${res.xpGained} XP for a +${res.improvement} improvement over your personal best (${res.previousBest} → ${res.score})`;
    } else {
      xpExplanation = `Personal best (${res.previousBest}/${res.total}) maintained. On retries, only improving your personal best earns additional XP.`;
    }

    xpRow = `
      <div class="quiz-result-stats">
        <div class="stat-box quiz-xp-box">
          <div class="lab">${uiIcon("sparkles")} XP Points</div>
          <div class="num" style="color:var(--gold-hover)">+${res.xpGained} XP</div>
          <div class="sub-sm">${xpExplanation}</div>
        </div>
        <div class="stat-box quiz-word-box">
          <div class="lab">${uiIcon("quest")} Bayanihan Words</div>
          <div class="num" style="color:var(--sky)">+${res.totalWords}</div>
          <div class="sub-sm">Added to class Bayanihan word count</div>
        </div>
      </div>
    `;
  }

  let levelUpHtml = "";
  if (res.levelUp) {
    levelUpHtml = `
      <section class="card level-up-hero-card" role="status" aria-live="polite" aria-label="Reading Tier Level Up">
        <div class="level-up-badge">
          <span class="level-up-star" aria-hidden="true">⭐</span>
          <h3 style="margin:0">LEVEL UP! · New Reading Tier Unlocked!</h3>
        </div>
        <p style="margin:6px 0 0">You advanced to <b class="level-up-tier-name">${escapeHTML(res.levelUp.tierName)}</b>! You are ready for more engaging and challenging stories in your reading journey.</p>
      </section>
    `;
  }

  const karaokeStageHtml = `
    <section class="karaoke-stage" id="karaoke-stage" aria-label="Quiz result celebration" role="region">
      ${!res.karaokeDone ? `<button type="button" class="btn sm karaoke-skip-btn" data-a="quiz-karaoke-skip" aria-label="Skip score reveal animation">Skip ✕</button>` : ''}
      <div class="karaoke-spotlight karaoke-spotlight-left" aria-hidden="true"></div>
      <div class="karaoke-spotlight karaoke-spotlight-right" aria-hidden="true"></div>

      <div class="karaoke-wisyo-wrap">
        <img src="assets/images/wisyo.png" alt="Wisyo" class="karaoke-wisyo-img" />
        <div class="karaoke-wisyo-bubble" id="karaoke-wisyo-bubble">
          ${res.karaokeDone ? quizWisyoCelebrationQuote(pct) : "Analyzing your answers..."}
        </div>
      </div>

      <div class="karaoke-score-ring ${res.karaokeDone ? 'locked' : 'suspense'}" id="karaoke-score-ring">
        <div class="karaoke-score-val" id="karaoke-score-val">${res.karaokeDone ? pct : 0}%</div>
        <div class="karaoke-score-sub" id="karaoke-score-sub">${res.score} of ${res.total} correct</div>
      </div>

      <div class="karaoke-rating ${res.karaokeDone ? 'show' : ''}" id="karaoke-rating">
        ${res.karaokeDone ? quizRatingText(pct) : ""}
      </div>

      <div class="karaoke-confetti" id="karaoke-confetti" aria-hidden="true">
        ${res.karaokeDone ? renderConfettiParticles() : ""}
      </div>

      <div class="quiz-streak-pill" role="status">
        <span class="streak-flame" aria-hidden="true">🔥</span>
        <span><b>${res.streak || 1} Day Streak!</b> Keep up your daily reading habit!</span>
      </div>
    </section>
  `;

  let badgeRevealHtml = "";
  if (res.newBadges && res.newBadges.length > 0) {
    badgeRevealHtml = `
      <section class="card badge-reveal-hero" role="status" aria-live="polite" aria-label="Newly unlocked badges">
        <div class="badge-reveal-head">
          ${uiIcon("sparkles")} <span>New Badge Unlocked!</span>
        </div>
        <div class="badge-reveal-grid">
          ${res.newBadges.map(badge => `
            <div class="badge-reveal-card">
              <span class="badge-reveal-icon" aria-hidden="true">${badge.icon || "🏅"}</span>
              <div>
                <h4 style="margin:0 0 4px 0">${escapeHTML(badge.title)}</h4>
                <p class="sub-sm" style="margin:0 0 6px 0">${escapeHTML(badge.description)}</p>
                <div class="badge-reveal-reason">
                  <b>Why you earned this:</b> ${escapeHTML(badge.whyReason || badge.description)}
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  let reviewSectionHtml = "";
  if (res.reviewMode) {
    reviewSectionHtml = `
      <section class="card quiz-review-panel" aria-label="Answer review">
        <div class="card-header">
          <div>
            <div class="lab">${uiIcon("eye")} Question-by-Question Review</div>
            <h3 style="margin:4px 0">Review Answers & Evidence</h3>
          </div>
          <button class="btn sm o" data-a="quiz-review" aria-label="Close review">Close review ✕</button>
        </div>
        <p class="sub">Inspect each question, your selected answer, the correct choice, and explanations from the text:</p>
        <div class="quiz-review-list">
          ${res.quiz.steps.map((step, idx) => {
            const userChoice = res.quiz.userAnswers[idx];
            const isCorrect = userChoice === step.q.a;
            return `
              <div class="card quiz-review-item ${isCorrect ? 'review-ok' : 'review-no'}" style="margin-bottom:12px;border-left:4px solid ${isCorrect ? 'var(--teal)' : 'var(--coral)'}">
                <div class="row" style="margin-bottom:6px">
                  <span class="sub-sm">Question ${idx + 1} of ${res.total} · <b>${escapeHTML(step.q.k || "Comprehension")}</b></span>
                  <span class="pill ${isCorrect ? 'ok' : 'warn'}">${isCorrect ? 'Correct ✓' : 'Incorrect ✕'}</span>
                </div>
                <p class="q" style="margin-bottom:10px">${escapeHTML(step.q.q)}</p>
                <div class="quiz-review-choices">
                  ${step.q.o.map((opt, optIdx) => {
                    let optClass = "opt";
                    let marker = "";
                    if (optIdx === step.q.a) {
                      optClass += " ok";
                      marker = `<span class="opt-result">${uiIcon("check")} Correct answer</span>`;
                    } else if (optIdx === userChoice) {
                      optClass += " no";
                      marker = `<span class="opt-result">${uiIcon("close")} Your answer · Incorrect</span>`;
                    }
                    return `
                      <div class="${optClass}" style="cursor:default">
                        <span class="opt-letter">${String.fromCharCode(65 + optIdx)}</span>
                        <span class="opt-text">${escapeHTML(opt)}</span>
                        ${marker}
                      </div>
                    `;
                  }).join("")}
                </div>
                ${step.q.exp ? `
                  <div class="sub-sm" style="margin-top:10px;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm)">
                    <b>${uiIcon("bulb")} Text Evidence:</b> ${escapeHTML(step.q.exp)}
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  const v = $("#v");
  if (v) {
    v.innerHTML = `
    <div class="quiz-result-page">
    <div class="dashboard-intro">
      <div>
        <h2>${uiIcon("assess")} Quiz Result</h2>
        <p class="sub">${escapeHTML(res.quiz.title)}</p>
      </div>
      <div class="dashboard-intro-actions">
        <button class="btn sm o" data-a="quiz-exit-to-library">${uiIcon("practice")} Reading Library</button>
      </div>
    </div>

    ${karaokeStageHtml}
    ${levelUpHtml}

    <section class="card quiz-result-hero-card" aria-label="Score summary">
      <div class="quiz-score-header">
        <div class="quiz-score-badge-main" role="status" aria-live="polite">
          <span class="quiz-score-num">${res.score}/${res.total}</span>
          <span class="quiz-score-label">correct</span>
        </div>
        <div class="quiz-score-details">
          <div class="lab">Final Score</div>
          <h3 style="margin:2px 0 4px">${pct}% Accuracy</h3>
          <div class="bar score-reveal-bar" style="margin:6px 0 0"><i style="width:${pct}%"></i></div>
        </div>
      </div>

      ${xpRow}
      ${encourageHtml}

      <div class="quiz-result-buttons">
        <button type="button" class="btn o" data-a="quiz-review">
          ${uiIcon("eye")} ${res.reviewMode ? "Hide answers" : "Review answers"}
        </button>
        <button type="button" class="btn o" data-a="quiz-retry">
          ${uiIcon("refresh")} Try again
        </button>
        <button type="button" class="btn blue" data-a="quiz-next-story">
          ${uiIcon("next")} Next story
        </button>
      </div>
    </section>

    ${badgeRevealHtml}
    ${reviewSectionHtml}
    </div>
  `;
  }

  if (!res.karaokeDone) {
    runKaraokeCelebrationTicker(pct, res.score, res.total);
  }
}

