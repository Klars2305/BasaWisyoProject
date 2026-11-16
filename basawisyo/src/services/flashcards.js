/* ==========================================================================
   BasaWisyo - Vocabulary Flashcards Service (flashcards.js)
   Spaced-repetition Leitner system for vocabulary mastery.
   Supports trilingual cards (English, Filipino, Bisaya) with audio pronunciation.
   ========================================================================== */

const FLASHCARDS_STORAGE_KEY = "basawisyo_flashcards_v1";

// High-impact starter vocabulary cards seeded from dictionary D
const STARTER_FLASHCARDS = [
  {
    word: "sampaguita",
    definition: "The national flower of the Philippines, known for sweet fragrance.",
    filipino: "sampaguita",
    bisaya: "sampagita",
    contextSentence: "The fragrant sampaguita garlands were hung around the honored guests."
  },
  {
    word: "biodiversity",
    definition: "The variety of plant and animal life in a particular habitat or ecosystem.",
    filipino: "biyodibersidad",
    bisaya: "kadaiyahan sa kinabuhi",
    contextSentence: "The coral atolls of Palawan support an extraordinary richness of marine biodiversity."
  },
  {
    word: "resilience",
    definition: "The capacity to recover quickly from difficulties, storms, or disasters.",
    filipino: "katatagan",
    bisaya: "kalig-on",
    contextSentence: "Filipino coastal families showed incredible resilience in rebuilding after the typhoon."
  },
  {
    word: "sanctuary",
    definition: "A protected nature reserve or safe haven where wildlife can thrive freely.",
    filipino: "santwaryo",
    bisaya: "dangpanan",
    contextSentence: "The marine sanctuary protects juvenile reef fish and giant clams from illegal nets."
  },
  {
    word: "ancestral",
    definition: "Pertaining to forebears, heritage, and sacred lands passed down through generations.",
    filipino: "ninuno",
    bisaya: "katigulangan",
    contextSentence: "Indigenous communities protect their ancestral domain from commercial logging."
  },
  {
    word: "monsoonal",
    definition: "Seasonal wind system bringing torrential rains and tropical moisture.",
    filipino: "hanging habagat",
    bisaya: "habagat",
    contextSentence: "Monsoonal rains replenished the dry highland rice paddies."
  },
  {
    word: "mangroves",
    definition: "Coastal shrubs that stabilize shorelines and serve as vital marine nurseries.",
    filipino: "bakawan",
    bisaya: "katunggan",
    contextSentence: "Dense mangroves shield the shoreline from fierce storm surges."
  },
  {
    word: "bamboo",
    definition: "Giant woody grass widely used in sustainable Philippine architecture and crafts.",
    filipino: "kawayan",
    bisaya: "kawayan",
    contextSentence: "The historic Las Piñas organ was masterfully crafted using seasoned bamboo pipes."
  }
];

function getFlashcardsStorageKey(studentId) {
  const currentId = studentId || (typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest");
  return `${FLASHCARDS_STORAGE_KEY}_${currentId}`;
}

/**
 * Returns student's flashcard deck. Seeds starter cards if deck is empty.
 */
function getFlashcardDeck(studentId) {
  const key = getFlashcardsStorageKey(studentId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Failed to read flashcards:", e);
  }

  // Seed default starter cards
  const now = Date.now();
  const seeded = STARTER_FLASHCARDS.map((card, idx) => ({
    id: `fc-${card.word.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    word: card.word,
    definition: card.definition,
    filipino: card.filipino,
    bisaya: card.bisaya,
    contextSentence: card.contextSentence,
    box: 1,
    intervalDays: 1,
    dueAt: now - (idx * 60000), // Stagger slightly so they appear due immediately
    reviewCount: 0,
    correctCount: 0,
    lastRating: null,
    lastReviewedAt: null,
    createdAt: now
  }));

  saveFlashcardDeck(seeded, studentId);
  return seeded;
}

function saveFlashcardDeck(deck, studentId) {
  const key = getFlashcardsStorageKey(studentId);
  try {
    localStorage.setItem(key, JSON.stringify(deck));
    return true;
  } catch (e) {
    console.error("Failed to save flashcards:", e);
    return false;
  }
}

/**
 * Saves or updates a word in the flashcard deck.
 */
function saveFlashcard({
  word,
  definition,
  contextSentence = "",
  filipino = "",
  bisaya = "",
  passageId = "",
  studentId
}) {
  if (!word || !word.trim()) return null;
  const cleanWord = word.trim();
  const id = `fc-${cleanWord.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const deck = getFlashcardDeck(studentId);
  const now = Date.now();

  const existingIdx = deck.findIndex(c => c.id === id || c.word.toLowerCase() === cleanWord.toLowerCase());

  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  const FREE_CARD_LIMIT = 30;
  if (!isPrem && existingIdx < 0 && deck.length >= FREE_CARD_LIMIT) {
    if (typeof openUpgradeModal === "function") {
      openUpgradeModal("flashcards", `You have reached the 30-card free deck capacity (${deck.length}/${FREE_CARD_LIMIT}). Upgrade to Wisyo Plus for unlimited flashcard storage!`);
    } else if (typeof showToast === "function") {
      showToast("Free flashcard limit (30) reached! Upgrade to Wisyo Plus for unlimited cards.", "warn");
    }
    return null;
  }

  let card;
  if (existingIdx >= 0) {
    card = deck[existingIdx];
    if (definition) card.definition = definition;
    if (contextSentence) card.contextSentence = contextSentence;
    if (filipino) card.filipino = filipino;
    if (bisaya) card.bisaya = bisaya;
    if (passageId) card.passageId = passageId;
    deck[existingIdx] = card;
  } else {
    // If translations not passed, look up in trilingual dictionary D
    let fil = filipino;
    let bis = bisaya;
    let def = definition;
    if (typeof D !== "undefined" && D[cleanWord.toLowerCase()]) {
      const entry = D[cleanWord.toLowerCase()];
      if (!fil) fil = entry[0];
      if (!bis) bis = entry[1];
      if (!def) def = entry[2];
    }

    card = {
      id,
      word: cleanWord,
      definition: def || "Definition to be added.",
      filipino: fil || "",
      bisaya: bis || "",
      contextSentence: contextSentence || "",
      passageId: passageId || "",
      box: 1,
      intervalDays: 1,
      dueAt: now,
      reviewCount: 0,
      correctCount: 0,
      lastRating: null,
      lastReviewedAt: null,
      createdAt: now
    };
    deck.unshift(card);
  }

  saveFlashcardDeck(deck, studentId);
  return card;
}

/**
 * Rates a flashcard during review using Leitner intervals:
 * - "difficult": Box 1, 1 day
 * - "good": +1 Box, 3 days (or 5 days if Box 2+)
 * - "easy": +2 Boxes, 7 days (or 14 days if Box 3+)
 */
function rateFlashcard(cardId, rating, studentId) {
  const deck = getFlashcardDeck(studentId);
  const card = deck.find(c => c.id === cardId);
  if (!card) return null;

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  card.reviewCount = (card.reviewCount || 0) + 1;
  card.lastReviewedAt = now;
  card.lastRating = rating;

  let intervalDays = 1;
  let nextBox = card.box || 1;

  if (rating === "difficult") {
    nextBox = 1;
    intervalDays = 1;
  } else if (rating === "good") {
    card.correctCount = (card.correctCount || 0) + 1;
    nextBox = Math.min(5, nextBox + 1);
    intervalDays = nextBox === 2 ? 3 : nextBox === 3 ? 5 : 7;
  } else if (rating === "easy") {
    card.correctCount = (card.correctCount || 0) + 1;
    nextBox = Math.min(5, nextBox + 2);
    intervalDays = nextBox >= 4 ? 14 : 7;
  }

  card.box = nextBox;
  card.intervalDays = intervalDays;
  card.dueAt = now + (intervalDays * ONE_DAY_MS);

  saveFlashcardDeck(deck, studentId);
  return card;
}

/**
 * Returns cards currently due for review.
 */
function getDueFlashcards(now = Date.now(), studentId) {
  const deck = getFlashcardDeck(studentId);
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return deck.filter(c => {
    const dueTime = typeof c.dueAt === "number" ? c.dueAt : new Date(c.dueAt).getTime();
    return dueTime <= currentTime;
  });
}

/**
 * Returns flashcard statistics.
 */
function getFlashcardStats(studentId) {
  const deck = getFlashcardDeck(studentId);
  const now = Date.now();
  const due = deck.filter(c => (c.dueAt || 0) <= now).length;
  const mastered = deck.filter(c => (c.box || 1) >= 4).length;

  return {
    total: deck.length,
    due,
    mastered,
    inProgress: Math.max(0, deck.length - mastered)
  };
}

/**
 * Deletes a flashcard from student's deck.
 */
function deleteFlashcard(cardId, studentId) {
  const deck = getFlashcardDeck(studentId);
  const filtered = deck.filter(c => c.id !== cardId);
  saveFlashcardDeck(filtered, studentId);
  return filtered;
}
