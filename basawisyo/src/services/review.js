/* ==========================================================================
   BasaWisyo - Smart Review & Spaced Repetition Service (review.js)
   Schedules practice mistakes for review using spaced repetition.
   Zero-heart safe zone: Mistakes in review mode do not deduct hearts.
   ========================================================================== */

const REVIEW_STORAGE_KEY = "basawisyo_review_v1";

// Spaced repetition intervals in days:
// Level 0 (Incorrect): 1 day
// Level 1 (Good): 3 days
// Level 2 (Sustained): 7 days
// Level 3+ (Mastered): 14 days
const REVIEW_INTERVALS = [1, 3, 7, 14];

function getReviewStorageKey(studentId) {
  const currentId = studentId || (typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest");
  return `${REVIEW_STORAGE_KEY}_${currentId}`;
}

function getReviewQueue(studentId) {
  const key = getReviewStorageKey(studentId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read review queue:", e);
    return [];
  }
}

function saveReviewQueue(queue, studentId) {
  const key = getReviewStorageKey(studentId);
  try {
    localStorage.setItem(key, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.error("Failed to save review queue:", e);
    return false;
  }
}

/**
 * Schedules or updates a question in the review queue based on learner outcome.
 * @param {Object} param0 
 */
function scheduleQuestionReview({
  questionId,
  passageId,
  passageTitle,
  passageExcerpt,
  qIndex,
  questionText,
  options,
  correctAnswer,
  explanation,
  skill,
  outcome = "incorrect",
  studentId
}) {
  if (!questionId) return null;
  const queue = getReviewQueue(studentId);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const existingIndex = queue.findIndex(item => item.questionId === questionId);
  let item = existingIndex >= 0 ? queue[existingIndex] : null;

  if (!item) {
    // New item entering review queue
    const isCorrect = outcome === "correct";
    const consecutive = isCorrect ? 1 : 0;
    const intervalDays = isCorrect ? REVIEW_INTERVALS[1] : REVIEW_INTERVALS[0];
    const dueAt = now + (intervalDays * ONE_DAY_MS);

    item = {
      questionId,
      passageId: passageId || "",
      passageTitle: passageTitle || "Reading Practice",
      passageExcerpt: passageExcerpt || "",
      qIndex: Number.isInteger(qIndex) ? qIndex : 0,
      questionText: questionText || "",
      options: Array.isArray(options) ? options : [],
      correctAnswer: Number.isInteger(correctAnswer) ? correctAnswer : 0,
      explanation: explanation || "",
      skill: skill || "General",
      dueAt,
      intervalDays,
      consecutiveCorrect: consecutive,
      reviewCount: 1,
      lastResult: outcome,
      lastReviewedAt: now,
      createdAt: now
    };
    queue.push(item);
  } else {
    // Existing item updated
    item.reviewCount = (item.reviewCount || 0) + 1;
    item.lastReviewedAt = now;
    item.lastResult = outcome;

    if (outcome === "correct") {
      item.consecutiveCorrect = (item.consecutiveCorrect || 0) + 1;
      const intervalIdx = Math.min(item.consecutiveCorrect, REVIEW_INTERVALS.length - 1);
      item.intervalDays = REVIEW_INTERVALS[intervalIdx];
      item.dueAt = now + (item.intervalDays * ONE_DAY_MS);
    } else {
      // Mistake resets consecutive progress to 0 and interval to 1 day
      item.consecutiveCorrect = 0;
      item.intervalDays = REVIEW_INTERVALS[0];
      item.dueAt = now + (REVIEW_INTERVALS[0] * ONE_DAY_MS);
    }

    // Refresh question fields if provided
    if (passageTitle) item.passageTitle = passageTitle;
    if (passageExcerpt) item.passageExcerpt = passageExcerpt;
    if (questionText) item.questionText = questionText;
    if (options && options.length) item.options = options;
    if (Number.isInteger(correctAnswer)) item.correctAnswer = correctAnswer;
    if (explanation) item.explanation = explanation;
    if (skill) item.skill = skill;

    queue[existingIndex] = item;
  }

  saveReviewQueue(queue, studentId);
  return item;
}

/**
 * Returns review questions that are currently due.
 */
function getDueReviewQuestions(now = Date.now(), studentId) {
  const queue = getReviewQueue(studentId);
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return queue.filter(item => {
    const dueTime = typeof item.dueAt === "number" ? item.dueAt : new Date(item.dueAt).getTime();
    return dueTime <= currentTime;
  });
}

/**
 * Returns aggregate stats of review queue.
 */
function getReviewStats(studentId) {
  const queue = getReviewQueue(studentId);
  const now = Date.now();
  const due = queue.filter(item => {
    const dueTime = typeof item.dueAt === "number" ? item.dueAt : new Date(item.dueAt).getTime();
    return dueTime <= now;
  }).length;
  const mastered = queue.filter(item => (item.consecutiveCorrect || 0) >= 3).length;

  return {
    total: queue.length,
    due,
    mastered,
    inProgress: Math.max(0, queue.length - mastered)
  };
}

/**
 * Launches a smart review quiz session.
 * Review mode is a zero-heart safe zone.
 */
function startSmartReviewSession() {
  const dueItems = getDueReviewQuestions();
  const allItems = getReviewQueue();
  const itemsToReview = dueItems.length > 0 ? dueItems : allItems;

  if (!itemsToReview || itemsToReview.length === 0) {
    if (typeof showToast === "function") {
      showToast("No questions need review right now! Great job!", "ok");
    }
    return false;
  }

  // Shuffle or take up to 5 questions for a focused session
  const selected = itemsToReview.slice(0, 5);

  const steps = selected.map(item => ({
    P: {
      id: item.passageId || "review-passage",
      t: item.passageTitle || "Smart Review",
      x: item.passageExcerpt || "Reviewing previously missed reading comprehension concepts.",
      diff: "review"
    },
    q: {
      q: item.questionText,
      o: item.options,
      a: item.correctAnswer,
      k: item.skill,
      exp: item.explanation
    },
    questionId: item.questionId
  }));

  ACTIVE_QUIZ = {
    title: "Smart Review Session",
    mode: "review",
    steps,
    idx: 0,
    correctCount: 0,
    correctQuestions: [],
    userAnswers: new Array(steps.length).fill(null),
    startTime: Date.now(),
    isAnswered: false,
    selectedChoice: null,
    hearts: steps.length,
    maxHearts: steps.length,
    isSafeZone: true // Zero heart penalties
  };

  if (typeof renderApp === "function") {
    renderApp();
  }

  return true;
}
