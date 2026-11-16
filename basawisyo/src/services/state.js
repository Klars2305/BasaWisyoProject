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

let ACTIVE_STATE_ACCOUNT_ID = null;

function getStateStorageKey(accountId = undefined) {
  if (accountId !== undefined) {
    return accountId ? `basa_wisyo_state_${accountId}` : "basa_wisyo_state_guest";
  }
  return ACTIVE_STATE_ACCOUNT_ID ? `basa_wisyo_state_${ACTIVE_STATE_ACCOUNT_ID}` : "basa_wisyo_state_guest";
}

function loadStateForAccount(accountId = null, seedUser = null) {
  let state = createInitialState();
  const key = getStateStorageKey(accountId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...state, ...parsed, schemaVersion: 2 };
    }
    if (!accountId) {
      // Guest state: return clean initial state without pulling from prior student state
      return state;
    } else if (seedUser) {
      if (seedUser.lvl !== undefined && seedUser.lvl !== null) state.lvl = seedUser.lvl;
      if (seedUser.wordsRead) state.w = seedUser.wordsRead;
      state.done = [];
      state.ss = 0;
      state.attempts = [];
      state.sk = {};
    }
  } catch (e) {}
  return state;
}

function switchAccountState(targetUser = null) {
  // 1. Save current state under the outgoing account's key
  if (ACTIVE_STATE_ACCOUNT_ID) {
    try {
      localStorage.setItem(`basa_wisyo_state_${ACTIVE_STATE_ACCOUNT_ID}`, JSON.stringify(S));
    } catch (e) {}
  } else {
    try {
      localStorage.setItem("basa_wisyo_state_guest", JSON.stringify(S));
    } catch (e) {}
  }

  // 2. Set new active account ID
  const nextId = (targetUser && targetUser.role === "student") ? targetUser.id : null;
  ACTIVE_STATE_ACCOUNT_ID = nextId;

  // 3. Load target account state if student or guest
  if (nextId) {
    S = loadStateForAccount(nextId, targetUser);
    if (targetUser.lvl !== undefined && targetUser.lvl !== null && S.lvl === null) {
      S.lvl = targetUser.lvl;
    }
    if (targetUser.wordsRead && S.w === 0) {
      S.w = targetUser.wordsRead;
    }
  } else if (!targetUser) {
    S = loadStateForAccount(null);
  }

  // 4. Mirror active state to v2
  try {
    localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(S));
  } catch (e) {}

  return S;
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
    const raw = JSON.stringify(S);
    localStorage.setItem("basa_wisyo_state_v2", raw);
    const userKey = getStateStorageKey();
    localStorage.setItem(userKey, raw);
    if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.queue();
  } catch(e) {}
};

// Global App State
let CURRENT_TAB = "home";
let GUEST_MODE = false;
let ACTIVE_QUIZ = null;
let SEARCH_QUERY = "";
let BOARD_TIER = null;


