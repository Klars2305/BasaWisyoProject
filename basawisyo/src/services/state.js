/* ==========================================================================
   State Management & Persistence
   ========================================================================== */
function createInitialState() {
  return {
  lvl: null,          // 0: Frustration, 1: Instructional, 2: Independent, 3: Mastery
  w: 0,               // Cumulative words read
  ss: 0,              // Practice sessions completed
  done: [],           // Array of completed passage IDs
  sk: {},             // Skill statistics: { [skillName]: [correctCount, totalCount] }
  sh: [],             // Imported or custom shared passages
  sub: 0,             // Demo parent subscription
  l0: null,           // Baseline starting level
  pay: 0,             // Tutoring session rate
  pm: 0,              // Tutoring sessions per month
  miss: null,         // Recent mistake info: { p, q, ch, ok, k, exp }
  theme: "light",     // 'light' or 'dark'
  fontScale: 1.0,     // 0.9, 1.0, 1.15, 1.3
  activeDiff: "all"   // 'all', 'easy', 'medium', 'hard', 'extreme'
  };
}

let S = createInitialState();

try {
  const loaded = localStorage.getItem("basa_wisyo_state_v2");
  if (loaded) S = { ...S, ...JSON.parse(loaded) };
} catch(e) {}

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

