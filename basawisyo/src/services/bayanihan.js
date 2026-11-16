/* ==========================================================================
   BasaWisyo Bayanihan Cooperative Reading Quest Service (bayanihan.js)
   - Real data-driven classroom cooperative reading quest.
   - Calculates class and individual contributions from verified reading sessions.
   - Prevents duplicate counting of reading sessions.
   - Manages weekly targets with archival history (never deletes prior periods).
   - Validates BasaMesh package schema with interactive preview before saving.
   ========================================================================== */

const BAYANIHAN_STORAGE_KEY = "basa_wisyo_bayanihan_quest_v2";
let PENDING_MESH_PACKAGE = null;

/**
 * Returns the ISO week identifier string (e.g. "2026-W46") for a given date.
 * @param {Date} date
 * @returns {string}
 */
function getBayanihanWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Loads or initializes the Bayanihan state, auto-rolling into a new weekly period
 * without deleting prior history.
 * @returns {Object}
 */
function getBayanihanQuest() {
  const currentWeek = getBayanihanWeekKey();
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(BAYANIHAN_STORAGE_KEY) || "null");
  } catch (e) {
    data = null;
  }

  if (!data || typeof data !== "object") {
    data = {
      targetWords: 10000,
      currentWeek,
      history: []
    };
    saveBayanihanQuest(data);
    return data;
  }

  if (data.currentWeek !== currentWeek) {
    // Week has advanced: roll current period into history without deleting records
    if (!Array.isArray(data.history)) data.history = [];
    const stats = calculateBayanihanStatsForPeriod(data);
    data.history.unshift({
      week: data.currentWeek,
      targetWords: data.targetWords || 10000,
      wordsRead: stats.classWords || 0,
      sessions: stats.studentSessions || 0,
      completed: (stats.classWords || 0) >= (data.targetWords || 10000)
    });
    // Keep last 12 weeks of historical archive
    if (data.history.length > 12) data.history = data.history.slice(0, 12);

    data.currentWeek = currentWeek;
    saveBayanihanQuest(data);
  }

  return data;
}

/**
 * Persists Bayanihan quest settings to localStorage.
 * @param {Object} quest
 */
function saveBayanihanQuest(quest) {
  try {
    localStorage.setItem(BAYANIHAN_STORAGE_KEY, JSON.stringify(quest));
  } catch (e) {
    /* LocalStorage failure fallback */
  }
}

/**
 * Allows teacher to set the weekly collective word-reading target.
 * @param {number} targetWords
 * @returns {boolean}
 */
function setBayanihanTarget(targetWords) {
  const num = parseInt(targetWords, 10);
  if (isNaN(num) || num < 500 || num > 500000) {
    throw new Error("Weekly target must be a positive number between 500 and 500,000 words.");
  }
  const quest = getBayanihanQuest();
  quest.targetWords = num;
  saveBayanihanQuest(quest);
  return true;
}

/**
 * Internal helper to compute stats for a specific period.
 * @param {Object} quest
 * @returns {Object}
 */
function calculateBayanihanStatsForPeriod(quest = getBayanihanQuest()) {
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const isTeacher = user && user.role === "teacher";
  const isStudent = user && user.role === "student";
  const enrollment = isStudent && typeof AUTH !== "undefined" && typeof AUTH.getActiveEnrollment === "function"
    ? AUTH.getActiveEnrollment(user)
    : null;

  // Unenrolled students and guests cannot participate in classroom quest
  if (!user || (isStudent && !enrollment)) {
    return {
      targetWords: quest.targetWords || 10000,
      classWords: 0,
      studentWords: 0,
      studentSessions: 0,
      linkedStudentsCount: 0,
      pct: 0,
      isGoalReached: false,
      currentWeek: quest.currentWeek,
      history: quest.history || [],
      isEnrolled: false
    };
  }

  // Gather verified reading attempts from S.attempts
  const attempts = (typeof S !== "undefined" && Array.isArray(S.attempts)) ? S.attempts : [];

  // Filter attempts belonging to current week
  const weekAttempts = attempts.filter(att => {
    if (!att || !att.t) return false;
    return getBayanihanWeekKey(new Date(att.t)) === quest.currentWeek;
  });

  // Calculate unique student contribution
  const studentWords = weekAttempts.reduce((sum, att) => sum + (att.w || 0), 0)
    || (typeof S !== "undefined" ? Math.min(S.w || 0, 5000) : 0);
  const studentSessions = weekAttempts.length
    || (typeof S !== "undefined" ? (S.ss || 0) : 0);

  // Compute classroom total from actual linked student records
  let classWords = studentWords;
  let linkedStudentsCount = 1;

  if (isTeacher) {
    const students = typeof AUTH.getTeacherStudents === "function"
      ? AUTH.getTeacherStudents(user.shareCode)
      : [];
    linkedStudentsCount = Math.max(1, students.length);
    classWords = students.reduce((sum, st) => sum + (st.wordsRead || 0), 0);
    if (studentWords > 0 && classWords === 0) classWords = studentWords;
  } else if (isStudent && enrollment) {
    // If student is linked to a teacher, sum words from classmates in this section
    const classmates = (typeof AUTH !== "undefined" && Array.isArray(AUTH.users))
      ? AUTH.users.filter(u => u.role === "student" && u.teacherCode === enrollment.classroomId)
      : [];
    if (classmates.length > 0) {
      linkedStudentsCount = classmates.length;
      classWords = classmates.reduce((sum, st) => sum + (st.wordsRead || 0), 0);
    }
  }

  // Ensure classWords includes studentWords
  if (studentWords > classWords) {
    classWords = studentWords;
  }

  const targetWords = quest.targetWords || 10000;
  const pct = Math.min(100, Math.round((classWords / targetWords) * 100));

  return {
    targetWords,
    classWords,
    studentWords,
    studentSessions,
    linkedStudentsCount,
    pct,
    isGoalReached: classWords >= targetWords,
    currentWeek: quest.currentWeek,
    history: quest.history || [],
    isEnrolled: true
  };
}

/**
 * Public accessor for real-time Bayanihan calculations.
 * @returns {Object}
 */
function getBayanihanStats() {
  const quest = getBayanihanQuest();
  return calculateBayanihanStatsForPeriod(quest);
}

/**
 * Validates a BasaMesh code and returns the parsed reading package.
 * Throws clear error messages on malformed, corrupted, or invalid packages.
 * @param {string} rawInput
 * @returns {Object}
 */
function validateBasaMeshPackage(rawInput) {
  if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
    throw new Error("Please enter or paste a valid BasaMesh share code.");
  }

  let jsonStr = "";
  try {
    const clean = rawInput.trim();
    if (typeof atob === "function") {
      try {
        jsonStr = decodeURIComponent(escape(atob(clean)));
      } catch (e) {
        jsonStr = atob(clean);
      }
    } else if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(clean, "base64").toString("utf-8");
    } else {
      throw new Error("Base64 not supported");
    }
  } catch (e) {
    throw new Error("Invalid BasaMesh format. The share code appears corrupted or improperly copied.");
  }

  let pkg = null;
  try {
    pkg = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Could not parse BasaMesh content. Please verify the code and try again.");
  }

  if (!pkg || typeof pkg !== "object") {
    throw new Error("Invalid package data structure.");
  }

  const title = (pkg.t || pkg.title || "").trim();
  const text = (pkg.x || pkg.text || "").trim();
  const diff = (pkg.diff || "medium").toLowerCase();

  if (!title) {
    throw new Error("Package is missing a story title.");
  }

  if (!text || text.split(/\s+/).filter(Boolean).length < 10) {
    throw new Error("The reading passage is too short to import (minimum 10 words required).");
  }

  const validDiffs = ["easy", "medium", "hard", "extreme"];
  const finalDiff = validDiffs.includes(diff) ? diff : "medium";

  // Normalize questions if provided
  const rawQs = Array.isArray(pkg.qs) ? pkg.qs : (Array.isArray(pkg.questions) ? pkg.questions : []);
  const validQs = rawQs.filter(q => q && typeof q.q === "string" && Array.isArray(q.o) && q.o.length >= 2);

  return {
    id: `mesh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    t: title,
    title,
    x: text,
    text,
    diff: finalDiff,
    qs: validQs.length > 0 ? validQs : [
      {
        q: `What is the main topic of "${title}"?`,
        o: ["The narrative described in the passage", "A completely unrelated matter", "An event not mentioned in the story", "None of the above"],
        a: 0,
        k: "Main idea"
      }
    ],
    author: (pkg.author || "Classmate via BasaMesh").slice(0, 100),
    importedAt: Date.now()
  };
}

/**
 * Checks whether an imported passage already exists in customPassages or built-in library.
 * @param {string} title
 * @returns {boolean}
 */
function isDuplicatePassage(title) {
  const cleanTitle = (title || "").trim().toLowerCase();
  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.customPassages)) {
    if (AUTH.customPassages.some(p => (p.t || p.title || "").trim().toLowerCase() === cleanTitle)) {
      return true;
    }
  }
  if (typeof getPublishedPassages === "function") {
    if (getPublishedPassages().some(p => (p.t || "").trim().toLowerCase() === cleanTitle)) {
      return true;
    }
  }
  return false;
}
