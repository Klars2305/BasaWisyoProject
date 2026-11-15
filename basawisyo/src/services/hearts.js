/* ==========================================================================
   BasaWisyo Heart System (Per-Quiz Life Cycle)
   - Each quiz receives hearts equal to the number of questions in that quiz.
   - Each wrong answer deducts 1 heart from the active quiz.
   - Running out of hearts (0 hearts) triggers a friendly "Out of Hearts" screen.
   - Students can retry immediately with fresh hearts—no 20-minute waiting lock!
   - Diagnostic placement quizzes are exempt from heart-based failure.
   ========================================================================== */

function initQuizHearts(questionCount = 4) {
  const max = Math.max(1, questionCount);
  const accommodated = typeof S !== "undefined" && S.heartAccommodations === true;
  return {
    hearts: max,
    maxHearts: max,
    accommodated
  };
}

function canStartPracticeQuiz() {
  // Practice quizzes can always be started; hearts are scoped per quiz attempt.
  return true;
}

function deductQuizHeart(quiz, answerId = null) {
  if (!quiz) return { success: false, hearts: 0, maxHearts: 0, deducted: false };
  if (quiz.accommodated || (typeof S !== "undefined" && S.heartAccommodations === true)) {
    return { success: true, hearts: quiz.hearts, maxHearts: quiz.maxHearts, deducted: false, accommodated: true };
  }

  // Guard against duplicate deduction on same question attempt
  if (answerId) {
    if (!Array.isArray(quiz.processedAnswerIds)) quiz.processedAnswerIds = [];
    if (quiz.processedAnswerIds.includes(answerId)) {
      return { success: true, hearts: quiz.hearts, maxHearts: quiz.maxHearts, deducted: false, duplicate: true };
    }
    quiz.processedAnswerIds.push(answerId);
  }

  if (typeof quiz.hearts !== "number") {
    quiz.hearts = quiz.maxHearts || (quiz.steps ? quiz.steps.length : 4);
    quiz.maxHearts = quiz.hearts;
  }

  if (quiz.hearts > 0) {
    quiz.hearts = Math.max(0, quiz.hearts - 1);
    return {
      success: true,
      hearts: quiz.hearts,
      maxHearts: quiz.maxHearts,
      deducted: true,
      isZero: quiz.hearts === 0
    };
  }

  return {
    success: false,
    hearts: 0,
    maxHearts: quiz.maxHearts,
    deducted: false,
    isZero: true
  };
}

// Global legacy support / helper
function deductPracticeHeart(answerId = null) {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) {
    return deductQuizHeart(ACTIVE_QUIZ, answerId);
  }
  return { success: true, hearts: 5, deducted: false };
}

function syncHearts() {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ && typeof ACTIVE_QUIZ.hearts === "number") {
    return {
      hearts: ACTIVE_QUIZ.hearts,
      maxHearts: ACTIVE_QUIZ.maxHearts,
      canPractice: true
    };
  }
  return {
    hearts: 5,
    maxHearts: 5,
    canPractice: true
  };
}

function restoreHearts(count = 1) {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) {
    ACTIVE_QUIZ.hearts = Math.min(ACTIVE_QUIZ.maxHearts, (ACTIVE_QUIZ.hearts || 0) + count);
    return { hearts: ACTIVE_QUIZ.hearts, maxHearts: ACTIVE_QUIZ.maxHearts };
  }
  return { hearts: 5, maxHearts: 5 };
}

function renderHeartPill() {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ && typeof ACTIVE_QUIZ.hearts === "number") {
    const hearts = ACTIVE_QUIZ.hearts;
    const max = ACTIVE_QUIZ.maxHearts;
    return `
      <div class="heart-pill ${hearts === 0 ? 'heart-empty' : ''}" data-a="heart-info" title="Quiz Hearts: ${hearts}/${max}" role="status" aria-label="${hearts} of ${max} hearts remaining in this quiz">
        <span class="heart-icon" aria-hidden="true">${hearts > 0 ? "❤️" : "💔"}</span>
        <span class="heart-count">${hearts}/${max}</span>
      </div>
    `;
  }
  return `
    <div class="heart-pill" data-a="heart-info" title="Hearts reset fresh for each quiz!" role="status" aria-label="Hearts are per-quiz">
      <span class="heart-icon" aria-hidden="true">❤️</span>
      <span class="heart-count">Per-Quiz</span>
    </div>
  `;
}

function renderOutOfHeartsModalHTML(passage) {
  const passageId = passage?.id || "";
  return `
    <div id="zero-hearts-modal" class="app-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="zero-hearts-title">
      <div class="app-modal-card" style="max-width:440px;text-align:center;padding:28px 24px">
        <div style="font-size:3.2rem;margin-bottom:8px">💔</div>
        <h3 id="zero-hearts-title" style="margin:0 0 8px">Out of Hearts!</h3>
        <p class="sub" style="margin-bottom:14px">You ran out of hearts for this story quiz. Don't worry, every mistake is a chance to learn!</p>

        <div class="card" style="background:var(--bg);text-align:left;padding:14px 18px;margin-bottom:20px;border-left:4px solid var(--sky)">
          <b style="color:var(--navy);display:block;margin-bottom:4px">Your learning never stops:</b>
          <div class="sub-sm" style="line-height:1.6">
            ✓ You can <b>try again immediately</b> with fresh hearts.<br>
            ✓ You can <b>review your answers</b> or ask Wisyo Tutor for guidance.<br>
            ✓ No waiting timers and no XP penalties!
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn blue" data-a="out-of-hearts-retry" data-v="${escapeHTML(passageId)}" style="width:100%">
            ${uiIcon("refresh")} Try Again with Fresh Hearts
          </button>
          <button class="btn o" data-a="quiz-review" style="width:100%">
            ${uiIcon("check")} Review Answers
          </button>
          <button class="btn o" data-a="quiz-exit-to-library" style="width:100%">
            ${uiIcon("practice")} Choose Another Story
          </button>
        </div>
      </div>
    </div>
  `;
}
