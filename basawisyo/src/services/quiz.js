/* ==========================================================================
   Active Quiz & Practice Engine
   ========================================================================== */
function startQuiz(passages, mode, title) {
  const steps = [];
  passages.forEach(P => {
    P.qs.forEach(q => {
      steps.push({ P, q });
    });
  });

  ACTIVE_QUIZ = {
    title,
    mode, // 'pl' for placement, 'pr' for practice
    steps,
    idx: 0,
    correctCount: 0,
    isAnswered: false,
    startTime: Date.now()
  };

  renderApp();
}

function renderQuiz() {
  const qz = ACTIVE_QUIZ;
  const currentStep = qz.steps[qz.idx];
  const P = currentStep.P;
  const q = currentStep.q;
  const progressPct = ((qz.idx) / qz.steps.length) * 100;

  const diffBadge = P.diff ? `<span class="badge-diff diff-${P.diff}">${P.diff.toUpperCase()}</span>` : "";

  $("#v").innerHTML = `
    <div class="row" style="margin-bottom:6px">
      <div class="sub-sm">${escapeHTML(qz.title)} · Question ${qz.idx + 1} of ${qz.steps.length}</div>
      <button class="btn sm o" data-a="quit-quiz" style="padding:4px 10px;font-size:0.75rem">Exit Quiz</button>
    </div>
    <div class="bar"><i style="width:${progressPct}%"></i></div>

    <!-- Reader Toolbar -->
    <div class="reader-toolbar">
      <div class="reader-tools">
        ${diffBadge}
        <button class="icon-btn" data-a="speech-read" title="Listen to text read aloud">🔊</button>
      </div>
      <div class="reader-tools">
        <button class="icon-btn" data-a="font-dec" title="Decrease font size">A-</button>
        <button class="icon-btn" data-a="font-inc" title="Increase font size">A+</button>
      </div>
    </div>

    <div class="reading-split">
      <div class="reading-passage-col">
        <!-- Passage Card -->
        <div class="card" style="margin-bottom:0">
          <div class="lab">Passage: ${escapeHTML(P.t)}</div>
          <div class="ps" id="active-ps">${tapMarkup(P.x)}</div>
          <div class="sub-sm" style="margin-top:10px;font-style:italic;color:var(--sky)">💡 Tip: Tap any dotted word to see Filipino, Bisaya, & English meanings.</div>
        </div>
      </div>

      <div class="reading-sidebar-col">
        <!-- Question Card -->
        <div class="card" style="margin-bottom:0">
          <div class="lab">${escapeHTML(q.k || "Comprehension")} Question</div>
          <p class="q">${escapeHTML(q.q)}</p>

          <div id="options-list">
            ${q.o.map((opt, i) => `
              <button class="opt" data-a="submit-answer" data-v="${i}">
                <span class="opt-letter">${String.fromCharCode(65 + i)}</span>
                <span>${escapeHTML(opt)}</span>
              </button>
            `).join("")}
          </div>

          <div id="quiz-feedback"></div>
        </div>
      </div>
    </div>
  `;
}

function handleAnswer(choiceIdx) {
  const qz = ACTIVE_QUIZ;
  if (!qz || qz.isAnswered) return;
  qz.isAnswered = true;

  const step = qz.steps[qz.idx];
  const q = step.q;
  const isCorrect = choiceIdx === q.a;

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
  }

  // Update skills stats
  const skill = q.k || "General";
  const st = S.sk[skill] || [0, 0];
  st[0] += isCorrect ? 1 : 0;
  st[1] += 1;
  S.sk[skill] = st;
  save();

  // Highlight options visually
  $$(".opt").forEach((btn, i) => {
    if (i === q.a) btn.classList.add("ok");
    else if (i === choiceIdx) btn.classList.add("no");
  });

  // Display feedback box
  const fb = $("#quiz-feedback");
  fb.innerHTML = `
    <div class="fb ${isCorrect ? 'ok' : 'no'}">
      <b>${isCorrect ? 'Tama! Correct!' : 'Not quite.'}</b>
      <div>${isCorrect ? 'Great job analyzing the text evidence.' : `Correct answer: <b>${escapeHTML(q.o[q.a])}</b>`}</div>
      ${q.exp ? `<div class="sub-sm" style="margin-top:4px">${escapeHTML(q.exp)}</div>` : ''}
    </div>

    <div style="display:flex;gap:8px;margin-top:10px">
      ${!isCorrect ? `
        <button class="btn sm o" data-a="ai-explain-why" style="flex:1">
          💡 Ask Wisyo Why
        </button>
      ` : ''}
      <button class="btn sm gold" data-a="quiz-next" style="flex:1">
        ${qz.idx + 1 < qz.steps.length ? 'Next Question →' : 'Finish Quiz ✓'}
      </button>
    </div>
  `;
}

function handleQuizNext() {
  const qz = ACTIVE_QUIZ;
  if (!qz) return;
  qz.idx++;
  qz.isAnswered = false;

  if (qz.idx < qz.steps.length) {
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const qz = ACTIVE_QUIZ;
  const isPlacement = qz.mode === "pl";

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
    const score = qz.correctCount;
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

  const score = qz.correctCount;
  const total = qz.steps.length;
  ACTIVE_QUIZ = null;
  CURRENT_TAB = isPlacement ? "assess" : "practice";
  renderApp();

  showToast(`Quiz completed! ${score} of ${total} correct · +${totalWords} words added to Bayanihan Quest!`);
}

