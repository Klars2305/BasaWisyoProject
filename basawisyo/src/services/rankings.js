/* ==========================================================================
   BasaWisyo - Class Board & Rankings Service (rankings.js)
   Manages classroom and year-level leaderboards, weekly XP calculations,
   ranking periods, and anonymous aliases.
   Prototype transparency: Clearly labeled as local browser demo data.
   ========================================================================== */

let CURRENT_BOARD_METRIC = "weeklyXP"; // "weeklyXP" (default) | "stories" | "allTimeXP"
let CURRENT_BOARD_SCOPE = "classroom";  // "classroom" (default) | "grade"

/**
 * Returns current ISO week ranking period (Monday to Sunday)
 */
function getRankingPeriod(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  // Calculate distance to previous Monday
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startStr = `${months[monday.getMonth()]} ${monday.getDate()}`;
  const endStr = `${months[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  const msRemaining = Math.max(0, sunday.getTime() - now);
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    label: `${startStr} – ${endStr}`,
    startMs: monday.getTime(),
    endMs: sunday.getTime(),
    daysRemaining,
    isPrototype: true
  };
}

/**
 * Calculates weekly XP for a given student.
 * If user has timestamped activity, filters by current week; otherwise computes active proportion.
 */
function getWeeklyXP(user, now = Date.now()) {
  if (!user) return 0;
  const period = getRankingPeriod(now);
  const journey = user.journey || (user.id === AUTH.currentUser?.id ? journeyForCurrent() : null);
  if (!journey) return 0;

  // If itemized XP history exists on user or journey, filter within current week
  if (Array.isArray(user.xpHistory) && user.xpHistory.length > 0) {
    return user.xpHistory
      .filter(item => item.timestamp >= period.startMs && item.timestamp <= period.endMs)
      .reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
  }

  // Baseline weekly XP: active quest bonus + story XP from current week
  const totalXP = typeof journeyTotalXP === "function" ? journeyTotalXP(journey) : 0;
  const questBonus = (journey.bonusXP || 0) + ((user.id === AUTH.currentUser?.id && S.questBonusXP) || 0);

  // In demo prototype environment, estimate weekly XP from recent active practice
  return Math.min(totalXP, Math.max(questBonus, Math.round(totalXP * 0.75)));
}

/**
 * Extracts year level (e.g. "Grade 7", "Grade 8") from user section or Phil-IRI level
 */
function getYearLevelForUser(user) {
  if (!user) return "Grade 8";
  const section = user.section || "";
  const match = section.match(/Grade\s*([0-9]{1,2})/i);
  if (match) return `Grade ${match[1]}`;

  // Fallback based on Phil-IRI reading tier
  const lvl = user.lvl ?? 1;
  const gradeMap = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  return gradeMap[lvl] || "Grade 8";
}

/**
 * Computes ranked entries with classroom/grade filters, weekly XP, aliases, and ties.
 * @param {Object} options
 */
function getClassroomRankings({
  metric = CURRENT_BOARD_METRIC,
  scope = CURRENT_BOARD_SCOPE,
  yearLevel = null,
  tier = null,
  now = Date.now()
} = {}) {
  const context = typeof classBoardContext === "function" ? classBoardContext() : null;
  const currentUser = AUTH.currentUser;

  if (!currentUser) return { entries: [], period: getRankingPeriod(now), isPrototype: true };

  const currentYearLevel = yearLevel || getYearLevelForUser(currentUser);
  const period = getRankingPeriod(now);

  // Eligible students: role === student, active status, valid journey, opted-in
  let students = (AUTH.users || []).filter(u =>
    u.role === "student" &&
    u.status === "active" &&
    (typeof journeyValid === "function" ? journeyValid(u.journey) : true) &&
    u.journey?.boardOptIn === true
  );

  // Apply scope filter
  if (scope === "classroom" && context?.code) {
    // Only same teacher / classroom code
    students = students.filter(u => u.teacherCode === context.code);
  } else if (scope === "grade") {
    // All sections in the same grade level
    students = students.filter(u => getYearLevelForUser(u) === currentYearLevel);
  }

  // Calculate scores per student
  const mapped = students.map(u => {
    const isOwn = u.id === currentUser.id;
    const journey = isOwn ? (typeof journeyForCurrent === "function" ? journeyForCurrent() : u.journey) : u.journey;
    const stories = typeof boardStoryCount === "function" ? boardStoryCount(journey, tier) : 0;
    const weeklyXP = getWeeklyXP(u, now);
    const allTimeXP = typeof journeyTotalXP === "function" ? journeyTotalXP(journey) : 0;
    const alias = typeof boardAliasFor === "function" ? boardAliasFor(u) : `Reader ${u.id.slice(-4)}`;
    const section = u.section || getYearLevelForUser(u);

    let score = weeklyXP;
    if (metric === "stories") score = stories;
    else if (metric === "allTimeXP") score = allTimeXP;

    return {
      id: u.id,
      alias,
      score,
      stories,
      weeklyXP,
      allTimeXP,
      section,
      own: isOwn
    };
  });

  // Sort descending by score, tie-break by alias
  mapped.sort((a, b) => b.score - a.score || a.alias.localeCompare(b.alias));

  // Assign ranking places (tied scores share the same place: 1, 2, 2, 4...)
  let currentRank = 1;
  const ranked = mapped.map((entry, index) => {
    if (index > 0 && entry.score < mapped[index - 1].score) {
      currentRank = index + 1;
    }
    return {
      ...entry,
      place: currentRank
    };
  });

  return {
    period,
    scope,
    metric,
    yearLevel: currentYearLevel,
    entries: ranked,
    totalStudents: ranked.length,
    isPrototype: true
  };
}
