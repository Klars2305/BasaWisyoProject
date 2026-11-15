/* Local classroom board. Only opted-in students in the same teacher group appear. */
const READING_RANKS = [
  { min: 0, title: "New Reader" },
  { min: 1, title: "Story Starter" },
  { min: 3, title: "Story Explorer" },
  { min: 6, title: "Trailblazer" },
  { min: 10, title: "Reading Guide" }
];

function boardEligiblePassageMap(tier = null) {
  return new Map(DIFF_KEYS.flatMap((_, index) =>
    tier !== null && tier !== index ? []
      : journeyEligiblePassages(index).map(passage => [passage.id, passage.qs.length])));
}

function boardStoryCount(journey, tier = null) {
  if (!journeyValid(journey)) return 0;
  const eligible = boardEligiblePassageMap(tier);
  return Object.entries(journey.results)
    .filter(([id, result]) => eligible.get(id) === result.total).length;
}

function readingRank(journey) {
  const stories = boardStoryCount(journey);
  const current = [...READING_RANKS].reverse().find(rank => stories >= rank.min);
  const next = READING_RANKS.find(rank => rank.min > stories) || null;
  return { stories, title: current.title, next };
}

function classBoardContext() {
  const user = AUTH.currentUser;
  if (user?.role === "teacher" && user.shareCode) return { code: user.shareCode, role: "teacher" };
  if (user?.role !== "student" || !user.teacherCode) return null;
  const teacher = AUTH.users.find(item => item.role === "teacher" && item.status === "active"
    && item.shareCode === user.teacherCode);
  return teacher ? { code: user.teacherCode, role: "student" } : null;
}

function boardAliasFor(user) {
  let hash = 0;
  for (const char of user.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `Reader ${String(hash % 9000 + 1000)}`;
}

function classBoardEntries(tier) {
  const context = classBoardContext();
  if (!context || !Number.isInteger(tier) || tier < 0 || tier >= DIFF_KEYS.length) return [];
  const entries = AUTH.users
    .filter(user => user.role === "student" && user.status === "active"
      && user.teacherCode === context.code && journeyValid(user.journey)
      && user.journey.boardOptIn === true)
    .map(user => ({ id: user.id, alias: boardAliasFor(user),
      stories: boardStoryCount(user.journey, tier), own: user.id === AUTH.currentUser.id }))
    .sort((left, right) => right.stories - left.stories || left.alias.localeCompare(right.alias));
  let place = 0;
  let previous = null;
  return entries.map(entry => {
    if (entry.stories !== previous) place++;
    previous = entry.stories;
    return { ...entry, place };
  });
}

function setClassBoardOptIn(enabled) {
  if (AUTH.currentUser?.role !== "student" || !classBoardContext()) {
    throw new Error("Join a teacher's class before using the Class Board.");
  }
  if (typeof enabled !== "boolean") throw new Error("Choose whether to join the Class Board.");
  saveCurrentJourney({ ...journeyForCurrent(), boardOptIn: enabled });
}
