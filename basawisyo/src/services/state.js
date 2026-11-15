/* ==========================================================================
   State Management & Persistence
   ========================================================================== */
function createInitialState() {
  return {
  lvl: null,          // 0: Frustration, 1: Instructional, 2: Independent, 3: Mastery
  w: 0,               // Cumulative words read
  ss: 0,              // Practice sessions completed
  done: [],           // Array of completed passage IDs
  guestJourney: { baseTier: 0, results: {}, skillEvidence: {}, frame: "none", boardOptIn: false }, // Guided practice for this browser's guest
  sk: {},             // Skill statistics: { [skillName]: [correctCount, totalCount] }
  sh: [],             // Imported or custom shared passages
  sub: 0,             // Demo parent subscription
  l0: null,           // Baseline starting level
  pay: 0,             // Tutoring session rate
  pm: 0,              // Tutoring sessions per month
  miss: null,         // Recent mistake info: { p, q, ch, ok, k, exp }
  theme: "light",     // 'light' or 'dark'
  fontScale: 1.0,     // 0.9, 1.0, 1.15, 1.3
  activeDiff: "all",  // 'all', 'easy', 'medium', 'hard', 'extreme'
  streak: 0,          // Daily practice streak
  lastPracticeDate: null, // ISO date string "YYYY-MM-DD" of last practice
  hearts: 5,          // Current hearts (max 5)
  maxHearts: 5,       // Maximum heart capacity
  lastHeartRegen: Date.now(), // Timestamp for regeneration countdown
  heartRegenMinutes: 20,      // 20 minutes per heart
  processedAnswerIds: [],     // Deduplication guard for answers
  heartAccommodations: false, // Accessibility/teacher override: unlimited hearts if true
    dailyQuest: null,           // Current active daily quest object
    questBonusXP: 0,            // Cumulative bonus XP from completed quests for guest
    attempts: [],               // Anti-farming and attempt audit history trail
    schemaVersion: 2            // Current schema version
  };
}

function migrateAndLoadState() {
  let state = createInitialState();
  try {
    const v2 = localStorage.getItem("basa_wisyo_state_v2");
    if (v2) {
      const parsed = JSON.parse(v2);
      return { ...state, ...parsed, schemaVersion: 2 };
    }
    const legacy = localStorage.getItem("basa_wisyo_state_v1") || localStorage.getItem("basa_state");
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      state = {
        ...state,
        lvl: parsedLegacy.lvl ?? null,
        w: parsedLegacy.w ?? 0,
        ss: parsedLegacy.ss ?? 0,
        done: Array.isArray(parsedLegacy.done) ? parsedLegacy.done : [],
        sk: parsedLegacy.sk && typeof parsedLegacy.sk === "object" ? parsedLegacy.sk : {},
        streak: parsedLegacy.streak ?? 0,
        lastPracticeDate: parsedLegacy.lastPracticeDate ?? null,
        schemaVersion: 2
      };
      localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(state));
      return state;
    }
  } catch (e) {
    // Return initial state if storage reading fails
  }
  return state;
}

let S = migrateAndLoadState();

const save = () => {
  try {
    localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(S));
  } catch(e) {}
};

// Global App State
let CURRENT_TAB = "home";
let GUEST_MODE = false;
let ACTIVE_QUIZ = null;
let SEARCH_QUERY = "";
let BOARD_TIER = null;

