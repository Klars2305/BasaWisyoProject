/* ==========================================================================
   BasaWisyo Core Application Logic
   ========================================================================== */

const LG = "assets/images/wisyo.png";
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Reading difficulty tiers
const DIFF_KEYS = ["easy", "medium", "hard", "extreme"];
const DIFF_NAMES = {
  easy: "Easy (Madali)",
  medium: "Medium (Katamtaman)",
  hard: "Hard (Mahirap)",
  extreme: "Extreme (Sukdulan)"
};

// DepEd Phil-IRI standard levels
const PHIL_IRI_LEVELS = ["Frustration", "Instructional", "Independent", "Mastery"];

