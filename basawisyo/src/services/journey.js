/* Guided practice is separate from the four-question placement label and shared legacy stats. */
const JOURNEY_PASSAGES_TO_ADVANCE = 2;
const JOURNEY_TARGET_ACCURACY = 0.75;
const JOURNEY_BADGES = [
  { id: "first", icon: "📖", title: "First Story", description: "Finish your first qualifying reading practice." },
  { id: "perfect", icon: "✨", title: "Careful Reader", description: "Answer every question in a qualifying passage correctly." },
  { id: "comeback", icon: "🔁", title: "Comeback Reader", description: "Improve your best score when you retry a passage." },
  { id: "steady", icon: "🧭", title: "Story Explorer", description: "Finish three different qualifying passages." },
  { id: "literal", icon: "🔎", title: "Detail Detective", description: "Answer three different literal questions across two passages." },
  { id: "inference", icon: "💡", title: "Clue Finder", description: "Answer three different inference questions across two passages." }
];
const JOURNEY_FRAMES = [
  { id: "none", title: "Classic", badge: null },
  { id: "sky", title: "Sky Ring", badge: "first" },
  { id: "teal", title: "Growth Ring", badge: "comeback" },
  { id: "gold", title: "Explorer Ring", badge: "steady" }
];

function journeyStartingTier(level) {
  return level === 3 ? 2 : level === 2 ? 1 : 0;
}

function journeyEmpty(level = null) {
  return { baseTier: journeyStartingTier(level), results: {}, skillEvidence: {}, frame: "none", boardOptIn: false, bonusXP: 0 };
}

function journeyEvidenceValid(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).every(([skill, keys]) =>
      ["Literal", "Inference"].includes(skill) && Array.isArray(keys) && keys.length <= 500
      && keys.every(key => typeof key === "string" && /^[A-Za-z0-9_-]+:\d{1,2}$/.test(key))
      && new Set(keys).size === keys.length);
}

function journeyValid(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Number.isInteger(value.baseTier) && value.baseTier >= 0 && value.baseTier <= 2
    && value.results && typeof value.results === "object" && !Array.isArray(value.results)
    && Object.entries(value.results).every(([id, result]) =>
      /^[A-Za-z0-9_-]+$/.test(id) && result && typeof result === "object"
      && Number.isInteger(result.correct) && Number.isInteger(result.total)
      && Number.isInteger(result.attempts) && result.total > 0
      && result.correct >= 0 && result.correct <= result.total && result.attempts > 0
      && (result.improved === undefined || typeof result.improved === "boolean"))
    && (value.skillEvidence === undefined || journeyEvidenceValid(value.skillEvidence))
    && (value.frame === undefined || JOURNEY_FRAMES.some(frame => frame.id === value.frame))
    && (value.boardOptIn === undefined || typeof value.boardOptIn === "boolean")
    && (value.bonusXP === undefined || Number.isInteger(value.bonusXP));
}

function journeyForCurrent() {
  const user = AUTH.currentUser;
  if (user && user.role !== "student") return null;
  const stored = user ? user.journey : S.guestJourney;
  const journey = journeyValid(stored) ? stored : journeyEmpty();
  const suggestedTier = user ? journeyStartingTier(user.lvl) : 0;
  return { ...journey, baseTier: Math.max(journey.baseTier, suggestedTier),
    skillEvidence: journey.skillEvidence || {}, frame: journey.frame || "none",
    boardOptIn: journey.boardOptIn === true };
}

function journeyAchievements(journey) {
  const eligiblePassages = new Map(DIFF_KEYS.flatMap((_, tier) =>
    journeyEligiblePassages(tier).map(passage => [passage.id, passage])));
  const results = Object.entries(journey.results)
    .filter(([id, result]) => result.total === eligiblePassages.get(id)?.qs.length)
    .map(([, result]) => result);
  const skillHasEvidence = skill => {
    const keys = ((journey.skillEvidence || {})[skill] || [])
      .filter(key => {
        const [id, index] = key.split(":");
        return Number(index) < (eligiblePassages.get(id)?.qs.length || 0)
          && eligiblePassages.get(id).qs[Number(index)].k === skill;
      });
    return keys.length >= 3 && new Set(keys.map(key => key.split(":")[0])).size >= 2;
  };
  const earned = {
    first: results.length >= 1,
    perfect: results.some(result => result.total >= 2 && result.correct === result.total),
    comeback: results.some(result => result.improved === true),
    steady: results.length >= 3,
    literal: skillHasEvidence("Literal"),
    inference: skillHasEvidence("Inference")
  };
  return JOURNEY_BADGES.map(badge => ({ ...badge, earned: earned[badge.id] }));
}

function journeyAvailableFrames(journey) {
  const badges = new Set(journeyAchievements(journey).filter(badge => badge.earned).map(badge => badge.id));
  return JOURNEY_FRAMES.map(frame => ({ ...frame, unlocked: !frame.badge || badges.has(frame.badge) }));
}

function journeySelectedFrame() {
  const journey = journeyForCurrent();
  if (!journey) return "none";
  return journeyAvailableFrames(journey).some(frame => frame.id === journey.frame && frame.unlocked)
    ? journey.frame : "none";
}

function setJourneyFrame(frameId) {
  const journey = journeyForCurrent();
  if (!journey) throw new Error("Student or guest reading profile required.");
  if (!journeyAvailableFrames(journey).some(frame => frame.id === frameId && frame.unlocked)) {
    throw new Error("Earn the matching badge to use this frame.");
  }
  saveCurrentJourney({ ...journey, frame: frameId });
}

function journeyEligiblePassages(tier) {
  const builtInIds = new Set(Object.values(PRACTICE_DATA).flat().map(passage => passage.id));
  const approvedIds = new Set((AUTH.customPassages || [])
    .filter(passage => (passage.status ?? (passage.published === false ? "draft" : "published")) === "published")
    .map(passage => passage.id));
  return getPublishedPassages().filter(passage =>
    DIFF_KEYS.indexOf(passage.diff) === tier && passage.qs.length >= 2
    && (builtInIds.has(passage.id) || approvedIds.has(passage.id)));
}

function journeyTierProgress(journey, tier) {
  const scored = journeyEligiblePassages(tier).map(passage => ({
    result: journey.results[passage.id], questionCount: passage.qs.length
  })).filter(({ result, questionCount }) => result && result.total === questionCount
    && result.correct / result.total >= 0.5).map(({ result }) => result)
    .sort((a, b) => b.correct / b.total - a.correct / a.total)
    .slice(0, JOURNEY_PASSAGES_TO_ADVANCE);
  const correct = scored.reduce((sum, result) => sum + result.correct, 0);
  const total = scored.reduce((sum, result) => sum + result.total, 0);
  return {
    count: scored.length,
    accuracy: total ? correct / total : 0,
    ready: scored.length === JOURNEY_PASSAGES_TO_ADVANCE
      && correct / total >= JOURNEY_TARGET_ACCURACY
  };
}

function journeyUnlockedTier(journey, override = null) {
  let tier = Math.max(journey.baseTier, Number.isInteger(override) ? override : 0);
  while (tier < DIFF_KEYS.length - 1 && journeyTierProgress(journey, tier).ready) tier++;
  return tier;
}

function journeySummary() {
  const journey = journeyForCurrent();
  if (!journey) return null;
  const tier = journeyUnlockedTier(journey, AUTH.currentUser?.journeyOverride);
  const passages = journeyEligiblePassages(tier);
  const progress = journeyTierProgress(journey, tier);
  const unattempted = passages.find(passage => !journey.results[passage.id]);
  const attempted = passages.filter(passage => journey.results[passage.id]);
  const retry = attempted.filter(passage => {
    const result = journey.results[passage.id];
    return result.correct / result.total < JOURNEY_TARGET_ACCURACY;
  }).sort((a, b) => {
    const first = journey.results[a.id];
    const second = journey.results[b.id];
    return first.correct / first.total - second.correct / second.total;
  })[0];
  const next = (attempted.length < JOURNEY_PASSAGES_TO_ADVANCE ? unattempted : retry)
    || unattempted || retry || passages[0] || null;
  return { journey, tier, progress, next };
}

function journeyCanRead(passage) {
  if (!passage || !DIFF_KEYS.includes(passage.diff)) return false;
  if (AUTH.currentUser && AUTH.currentUser.role !== "student") return true;
  if (AUTH.currentUser?.role === "student" && (S.lvl === null || AUTH.currentUser.lvl === null)) {
    return false;
  }
  const summary = journeySummary();
  return summary ? DIFF_KEYS.indexOf(passage.diff) <= summary.tier : false;
}

function saveCurrentJourney(journey) {
  if (!journeyValid(journey)) throw new Error("Reading journey data is invalid.");
  const user = AUTH.currentUser;
  if (user?.role === "student") {
    const index = AUTH.users.findIndex(item => item.id === user.id);
    if (index < 0) throw new Error("Student account was not found.");
    const updated = { ...AUTH.users[index], journey };
    const users = [...AUTH.users];
    users[index] = updated;
    try { localStorage.setItem(AUTH.USERS_KEY, JSON.stringify(users)); }
    catch (error) { throw new Error("Reading progress could not be saved in this browser."); }
    AUTH.users = users;
    AUTH.currentUser = updated;
    AUTH.saveSession();
  } else if (!user) {
    const state = { ...S, guestJourney: journey };
    try { localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(state)); }
    catch (error) { throw new Error("Guest reading progress could not be saved in this browser."); }
    S = state;
  }
}

function recordJourneyPlacement(level) {
  if (AUTH.currentUser && AUTH.currentUser.role !== "student") return;
  const journey = journeyForCurrent();
  const baseTier = Math.max(journey.baseTier, journeyStartingTier(level));
  if (baseTier !== journey.baseTier) saveCurrentJourney({ ...journey, baseTier });
}

function journeyStoryXP(result) {
  if (!result || typeof result !== "object") return 0;
  const attempts = Number.isInteger(result.attempts) ? result.attempts : 0;
  if (attempts <= 0) return 0;
  const correct = Number.isInteger(result.correct) ? Math.max(0, result.correct) : 0;
  return 10 + (correct * 5);
}

function journeyTotalXP(journey = journeyForCurrent()) {
  if (!journey || !journey.results) return 0;
  const eligibleIds = new Set(DIFF_KEYS.flatMap((_, tier) =>
    journeyEligiblePassages(tier).map(p => p.id)));
  const storyXP = Object.entries(journey.results).reduce((sum, [id, result]) => {
    if (!eligibleIds.has(id) || !result || (result.attempts || 0) <= 0) return sum;
    return sum + journeyStoryXP(result);
  }, 0);
  const bonusXP = Number.isInteger(journey.bonusXP)
    ? Math.max(0, journey.bonusXP)
    : Math.max(0, (typeof S !== "undefined" && S.questBonusXP) || 0);
  return storyXP + bonusXP;
}

const BADGE_WHY_REASONS = {
  first: "Earned by completing your first qualifying reading practice!",
  perfect: "Earned by answering every question correctly in a qualifying story!",
  comeback: "Earned by beating your personal best score on a retry!",
  steady: "Earned by finishing three different qualifying reading stories!",
  literal: "Earned by answering 3 literal questions using text evidence across 2 stories!",
  inference: "Earned by answering 3 inference questions using clues across 2 stories!"
};

function journeyBadgeRequirements(journey = journeyForCurrent()) {
  if (!journey) return [];
  const achievements = journeyAchievements(journey);
  const eligiblePassages = new Map(DIFF_KEYS.flatMap((_, tier) =>
    journeyEligiblePassages(tier).map(passage => [passage.id, passage])));
  const completedPassages = Object.entries(journey.results)
    .filter(([id, result]) => result.total === eligiblePassages.get(id)?.qs.length)
    .map(([id, result]) => ({ id, result, passage: eligiblePassages.get(id) }));

  const skillEvidenceCount = skill => {
    const keys = ((journey.skillEvidence || {})[skill] || [])
      .filter(key => {
        const [id, index] = key.split(":");
        return Number(index) < (eligiblePassages.get(id)?.qs.length || 0)
          && eligiblePassages.get(id).qs[Number(index)].k === skill;
      });
    const distinctStories = new Set(keys.map(key => key.split(":")[0])).size;
    return { count: keys.length, stories: distinctStories };
  };

  const literalStat = skillEvidenceCount("Literal");
  const inferenceStat = skillEvidenceCount("Inference");

  return achievements.map(badge => {
    let missingText = "";
    let progressLabel = "";
    if (badge.earned) {
      progressLabel = "Unlocked (Earned)";
      missingText = "Completed! Keep up the great reading.";
    } else {
      switch (badge.id) {
        case "first":
          progressLabel = "0 / 1 completed";
          missingText = "Needs 1 qualifying story completed in your reading tier.";
          break;
        case "perfect":
          progressLabel = "0 / 1 perfect score";
          missingText = "Needs a 100% correct score on any qualifying story (at least 2 questions).";
          break;
        case "comeback":
          progressLabel = "Retry & improve";
          missingText = "Needs a higher score on a retried passage to beat your previous best.";
          break;
        case "steady":
          progressLabel = `${completedPassages.length} / 3 completed`;
          missingText = `Needs ${Math.max(0, 3 - completedPassages.length)} more qualifying stories completed.`;
          break;
        case "literal":
          progressLabel = `${literalStat.count} / 3 answered (${literalStat.stories} / 2 stories)`;
          missingText = `Needs ${Math.max(0, 3 - literalStat.count)} more literal questions using text evidence across at least 2 stories.`;
          break;
        case "inference":
          progressLabel = `${inferenceStat.count} / 3 answered (${inferenceStat.stories} / 2 stories)`;
          missingText = `Needs ${Math.max(0, 3 - inferenceStat.count)} more inference questions using context clues across at least 2 stories.`;
          break;
        default:
          progressLabel = "Not yet started";
          missingText = badge.description;
      }
    }
    return {
      ...badge,
      progressLabel,
      missingText,
      whyReason: BADGE_WHY_REASONS[badge.id] || badge.description
    };
  });
}

function recordJourneyPractice(quiz) {
  if (quiz.mode !== "pr" || (AUTH.currentUser && AUTH.currentUser.role !== "student")) return;
  const passageId = quiz.steps[0]?.P.id;
  if (!passageId || quiz.steps.some(step => step.P.id !== passageId)) return;
  const journey = journeyForCurrent();
  const beforeTier = journeyUnlockedTier(journey, AUTH.currentUser?.journeyOverride);
  const beforeBadges = new Set(journeyAchievements(journey).filter(badge => badge.earned).map(badge => badge.id));
  const previous = journey.results[passageId];
  const total = quiz.steps.length;
  const previousBest = previous?.total === total ? previous.correct : 0;
  const isFirstCompletion = !previous || (previous.attempts || 0) === 0;
  const correct = previous?.total === total && previous.correct > quiz.correctCount
    ? previous.correct : quiz.correctCount;
  const results = { ...journey.results, [passageId]: {
    correct, total, attempts: (previous?.attempts || 0) + 1,
    improved: Boolean(previous?.improved || (previous?.total === total && quiz.correctCount > previous.correct))
  } };
  const skillEvidence = { ...journey.skillEvidence };
  const eligible = journeyEligiblePassages(DIFF_KEYS.indexOf(quiz.steps[0].P.diff))
    .some(passage => passage.id === passageId);
  if (eligible) {
    for (const answer of quiz.correctQuestions || []) {
      if (!["Literal", "Inference"].includes(answer.skill)
          || !Number.isInteger(answer.index) || answer.index < 0 || answer.index >= total) continue;
      if (quiz.steps[answer.index].q.k !== answer.skill) continue;
      const key = `${passageId}:${answer.index}`;
      const keys = skillEvidence[answer.skill] || [];
      if (!keys.includes(key) && keys.length < 500) skillEvidence[answer.skill] = [...keys, key];
    }
  }
  const updated = { ...journey, results, skillEvidence };
  saveCurrentJourney(updated);

  const afterTier = journeyUnlockedTier(updated, AUTH.currentUser?.journeyOverride);
  const tierLeveledUp = afterTier > beforeTier;

  const rewards = typeof computeAttemptRewards === "function"
    ? computeAttemptRewards({ passageId, score: quiz.correctCount, total, isFirstCompletion, previousBest, isEligible: eligible })
    : {
        xpGained: eligible ? (isFirstCompletion ? 10 + (quiz.correctCount * 5) : Math.max(0, quiz.correctCount - previousBest) * 5) : 0,
        improvement: isFirstCompletion ? 0 : Math.max(0, quiz.correctCount - previousBest),
        isFirstCompletion,
        previousBest
      };

  const xpGained = rewards.xpGained;
  const improvement = rewards.improvement;

  const allReqs = journeyBadgeRequirements(updated);
  const newBadges = allReqs.filter(badge => badge.earned && !beforeBadges.has(badge.id));

  return {
    newBadges,
    xpGained,
    totalXP: journeyTotalXP(updated),
    isFirstCompletion,
    improvement,
    previousBest,
    tierLeveledUp,
    beforeTier,
    afterTier,
    tierName: DIFF_NAMES[DIFF_KEYS[afterTier]] || `Tier ${afterTier + 1}`
  };
}

function setStudentJourneyOverride(studentId, tier) {
  const teacher = AUTH.currentUser;
  if (teacher?.role !== "teacher") throw new Error("Teacher account required.");
  const student = AUTH.users.find(user => user.id === studentId);
  if (!student || student.role !== "student" || student.teacherCode !== teacher.shareCode) {
    throw new Error("This student is not in your class.");
  }
  const value = tier === "" ? null : Number(tier);
  if (value !== null && (!Number.isInteger(value) || value < 0 || value >= DIFF_KEYS.length)) {
    throw new Error("Choose a valid reading tier.");
  }
  const users = AUTH.users.map(user => user.id === studentId
    ? { ...user, journeyOverride: value } : user);
  try { localStorage.setItem(AUTH.USERS_KEY, JSON.stringify(users)); }
  catch (error) { throw new Error("Teacher override could not be saved in this browser."); }
  AUTH.users = users;
}
