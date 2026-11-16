/* ==========================================================================
   BasaWisyo - Interactive Onboarding Tour Service (onboarding.js)
   Role-based, account-isolated, friendly guided tour with Wisyo mascot.
   Supports: Unplaced Student, Placed Student, Teacher, Admin, Guest.
   ========================================================================== */

const TOUR_STORAGE_PREFIX = "basawisyo_tour_v1_";
const TOUR_VERSION = 2;

const TOUR_DEFINITIONS = {
  "student-unplaced": {
    id: "student-unplaced",
    role: "student",
    title: "Welcome to BasaWisyo! 🦉",
    steps: [
      {
        id: "welcome-avatar",
        target: ".brand-mascot-badge, .brand, #brand-avatar",
        title: "Meet Wisyo! 🦉",
        badge: "WELCOME",
        text: "Kamusta! I am Wisyo, your reading companion. I'm here to guide you through leveled stories, vocabulary flashcards, and fun learning quests!",
        position: "bottom"
      },
      {
        id: "placement-gate",
        target: '[data-a="tab"][data-v="assess"], #lv-pill',
        preferredTab: "assess",
        title: "Phil-IRI Placement Assessment 📝",
        badge: "STEP 1 · MANDATORY",
        text: "Every new reader takes a 15-question diagnostic placement test. This finds your comfortable reading tier so you get stories that match your level!",
        position: "bottom"
      },
      {
        id: "wisyo-tutor-intro",
        target: '#aib, [data-a="ai-open"]',
        title: "Wisyo AI Reading Coach 🤖",
        badge: "HELP ANYTIME",
        text: "Whenever you read, tap any word for trilingual definitions (Filipino, Bisaya, English) or ask Wisyo for hints without giving away the answers!",
        position: "top"
      }
    ]
  },

  "student-main": {
    id: "student-main",
    role: "student",
    title: "Student Features Tour 🦉",
    steps: [
      {
        id: "student-home",
        target: '#sn [data-a="tab"][data-v="home"], .brand, [data-a="tab"][data-v="home"]',
        preferredTab: "home",
        title: "Student Home & Quests 🎯",
        badge: "DAILY PROGRESS",
        text: "Check your daily reading quests, streak counter, and earned XP right here every time you log in!",
        position: "bottom"
      },
      {
        id: "student-passages",
        target: '#sn [data-a="tab"][data-v="practice"], [data-a="tab"][data-v="practice"]',
        preferredTab: "practice",
        title: "Reading Library 📚",
        badge: "LEVELED STORIES",
        text: "Explore leveled stories from Easy to Extreme! Enjoy karaoke-style audio read-aloud and answer comprehension questions.",
        position: "bottom"
      },
      {
        id: "student-flashcards",
        target: '#sn [data-a="tab"][data-v="flashcards"], [data-a="tab"][data-v="flashcards"]',
        preferredTab: "flashcards",
        title: "Vocabulary Flashcards 📇",
        badge: "SPACED REPETITION",
        text: "Master vocabulary using the 3D Leitner flip deck. Tap any word while reading a passage to save it directly to your deck!",
        position: "bottom"
      },
      {
        id: "student-studio",
        target: '#sn [data-a="tab"][data-v="studio"], [data-a="tab"][data-v="studio"]',
        preferredTab: "studio",
        title: "Personal Reading Studio ✍️",
        badge: "IMPORT & PRACTICE",
        text: "Import your own reading passages or articles from text and PDFs for personal reading practice.",
        position: "bottom"
      },
      {
        id: "student-bayanihan",
        target: '#sn [data-a="tab"][data-v="board"], [data-a="tab"][data-v="board"], #sn [data-a="tab"][data-v="quest"]',
        preferredTab: "board",
        title: "Class Board & Bayanihan 🌟",
        badge: "CLASSROOM QUESTS",
        text: "Join your teacher's class using their share code to participate in cooperative reading goals and class rankings!",
        position: "bottom"
      },
      {
        id: "student-ai",
        target: '#aib, [data-a="ai-open"]',
        title: "Wisyo AI Tutor 🤖",
        badge: "READING COACH",
        text: "Need hints or trilingual vocabulary guidance? Wisyo AI is always ready to guide your comprehension.",
        position: "top"
      },
      {
        id: "student-profile",
        target: '#nav [data-a="tab"][data-v="profile"], [data-a="tab"][data-v="profile"], #hdr-auth-btn',
        preferredTab: "profile",
        title: "Profile, Badges & Tour Replay 👑",
        badge: "MY PROFILE",
        text: "Check your badges, customize your avatar frame, and replay this interactive walkthrough whenever you need a refresher!",
        position: "bottom"
      }
    ]
  },

  "teacher-main": {
    id: "teacher-main",
    role: "teacher",
    title: "Teacher Workspace Tour 🏫",
    steps: [
      {
        id: "teacher-hub",
        target: '#sn [data-a="tab"][data-v="teacher"], [data-a="tab"][data-v="teacher"]',
        preferredTab: "teacher",
        title: "Classroom Hub & Code 🏫",
        badge: "CLASSROOM SETUP",
        text: "Manage your class roster here! Share your unique Teacher Share Code with students so they can enroll in your class.",
        position: "bottom"
      },
      {
        id: "teacher-studio",
        target: '#sn [data-a="tab"][data-v="teacher-studio"], [data-a="tab"][data-v="teacher-studio"]',
        preferredTab: "teacher-studio",
        title: "Teacher Reading Studio ✍️",
        badge: "CURRICULUM CREATOR",
        text: "Create custom reading passages, upload curriculum PDFs, and use Wisyo AI to generate multi-skill comprehension questions.",
        position: "bottom"
      },
      {
        id: "teacher-assignments",
        target: '#sn [data-a="tab"][data-v="teacher"], [data-a="tab"][data-v="teacher"]',
        preferredTab: "teacher",
        title: "Class Assignments 📋",
        badge: "ASSIGNMENTS",
        text: "Assign leveled passages with due dates directly to your connected students for practice or formal homework.",
        position: "bottom"
      },
      {
        id: "teacher-bayanihan",
        target: '#sn [data-a="tab"][data-v="board"], [data-a="tab"][data-v="board"]',
        preferredTab: "board",
        title: "Class Board & Bayanihan Target 🌟",
        badge: "COMMUNITY READING",
        text: "Set weekly classroom reading target words and inspire your students through collaborative Bayanihan reading quests!",
        position: "bottom"
      },
      {
        id: "teacher-reports",
        target: '#sn [data-a="tab"][data-v="reports"], [data-a="tab"][data-v="reports"]',
        preferredTab: "reports",
        title: "DepEd Form 14 & Reports 📊",
        badge: "AUTHENTIC EVIDENCE",
        text: "Track authentic Phil-IRI diagnostic metrics and student reading levels. Preview, export to CSV, or print official report sheets.",
        position: "bottom"
      }
    ]
  },

  "admin-main": {
    id: "admin-main",
    role: "admin",
    title: "Admin Console Tour ⚙️",
    steps: [
      {
        id: "admin-console",
        target: '#sn [data-a="tab"][data-v="admin"], [data-a="tab"][data-v="admin"]',
        preferredTab: "admin",
        title: "School Admin Console ⚙️",
        badge: "MANAGEMENT",
        text: "Manage school teacher accounts, review student enrollments, and perform complete system backups and restores.",
        position: "bottom"
      },
      {
        id: "admin-curriculum",
        target: '#sn [data-a="tab"][data-v="practice"], [data-a="tab"][data-v="practice"]',
        preferredTab: "practice",
        title: "Curriculum Management 📖",
        badge: "PASSAGE APPROVAL",
        text: "Review, edit, and approve teacher-submitted reading materials to publish them immediately to the school's reading library.",
        position: "bottom"
      },
      {
        id: "admin-reports",
        target: '#sn [data-a="tab"][data-v="reports"], [data-a="tab"][data-v="reports"]',
        preferredTab: "reports",
        title: "School-Wide Reports 📈",
        badge: "ANALYTICS",
        text: "Access comprehensive reading mastery data and diagnostic level breakdowns across all classes in your institution.",
        position: "bottom"
      }
    ]
  }
};

function getTourStorageKey(userId) {
  const accountId = userId || (typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest");
  return `${TOUR_STORAGE_PREFIX}${accountId}`;
}

function getTourRecords(userId) {
  const key = getTourStorageKey(userId);
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function getTourStatus(userId, tourId) {
  const records = getTourRecords(userId);
  return records[tourId] || null;
}

function saveTourStatus(userId, tourId, status, stepIndex = 0) {
  const key = getTourStorageKey(userId);
  try {
    if (typeof localStorage === "undefined") return;
    const records = getTourRecords(userId);
    const targetId = userId || "guest";
    records[tourId] = {
      userId: targetId,
      studentId: targetId,
      tourId,
      tourVersion: TOUR_VERSION,
      status, // "not_started" | "in_progress" | "skipped" | "completed"
      stepIndex,
      lastCompletedStep: status === "completed" ? stepIndex : Math.max(0, stepIndex - 1),
      updatedAt: new Date().toISOString(),
      completedAt: ["completed", "skipped"].includes(status) ? new Date().toISOString() : null
    };
    localStorage.setItem(key, JSON.stringify(records));
  } catch (err) {
    console.warn("Could not save tour state:", err);
  }
}

function resetTourStatus(userId, tourId) {
  saveTourStatus(userId, tourId, "not_started", 0);
}

function getTourDefinition(tourId) {
  return TOUR_DEFINITIONS[tourId] || null;
}

/**
 * Determines which tour (if any) should automatically start for the given user/state.
 */
function resolveAutoTourId(user, state = {}) {
  const role = user ? user.role : "student";
  const isUnplaced = (role === "student") && (state.lvl === null || (user && user.lvl === null));

  if (role === "student") {
    return isUnplaced ? "student-unplaced" : "student-main";
  }
  if (role === "teacher") {
    return "teacher-main";
  }
  if (role === "admin") {
    return "admin-main";
  }
  return null;
}

function shouldAutoStartTour(user, state = {}) {
  // If no user and not guest mode, we are on the welcome screen
  if (!user && (typeof GUEST_MODE === "undefined" || !GUEST_MODE)) return null;
  // Never start tour if a quiz is in progress
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) return null;

  const tourId = resolveAutoTourId(user, state);
  if (!tourId) return null;

  const userId = user ? user.id : "guest";
  const record = getTourStatus(userId, tourId);

  // If already completed or explicitly skipped, do not auto-start
  if (record && (record.status === "completed" || record.status === "skipped")) {
    return null;
  }

  return { tourId, role: user ? user.role : "guest", definition: TOUR_DEFINITIONS[tourId] };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TOUR_DEFINITIONS,
    TOUR_STORAGE_PREFIX,
    TOUR_VERSION,
    getTourStorageKey,
    getTourRecords,
    getTourStatus,
    saveTourStatus,
    resetTourStatus,
    getTourDefinition,
    resolveAutoTourId,
    shouldAutoStartTour
  };
}
