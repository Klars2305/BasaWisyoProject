/* One passage contract for built-in, admin, and shared reading content.
   Legacy admin fields are converted here without rewriting stored records. */
function passageText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  const clean = value.trim();
  if (clean.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return clean;
}

function normalizePassage(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Passage must be an object.");
  }

  const id = passageText(raw.id, "Passage ID", 80);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error("Passage ID may contain only letters, numbers, _ and -.");
  }
  const t = passageText(raw.t, "Passage title", 160);
  const x = passageText(raw.x, "Passage text", 30000);
  const diff = raw.diff ?? raw.tier;
  if (!DIFF_KEYS.includes(diff)) {
    throw new Error("Choose a valid difficulty tier.");
  }

  const sourceQuestions = raw.qs ?? raw.q;
  if (!Array.isArray(sourceQuestions) || sourceQuestions.length < 1 || sourceQuestions.length > 20) {
    throw new Error("Passage must have 1 to 20 questions.");
  }
  const qs = sourceQuestions.map((question, index) => {
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new Error(`Question ${index + 1} must be an object.`);
    }
    const q = passageText(question.q, `Question ${index + 1} text`, 500);
    if (!Array.isArray(question.o) || question.o.length < 2 || question.o.length > 6) {
      throw new Error(`Question ${index + 1} must have 2 to 6 options.`);
    }
    const o = question.o.map((option, optionIndex) =>
      passageText(option, `Question ${index + 1} option ${optionIndex + 1}`, 300)
    );
    if (!Number.isInteger(question.a) || question.a < 0 || question.a >= o.length) {
      throw new Error(`Question ${index + 1} needs a valid correct-answer option.`);
    }
    const k = passageText(question.k ?? question.skill, `Question ${index + 1} skill`, 60);
    const normalized = { q, o, a: question.a, k };
    if (question.exp !== undefined && question.exp !== null && question.exp !== "") {
      normalized.exp = passageText(question.exp, `Question ${index + 1} explanation`, 2000);
    }
    return normalized;
  });

  // Existing admin records had no status and were intended for the curriculum.
  const status = raw.status ?? (raw.published === false ? "draft" : "published");
  if (!["draft", "pending", "rejected", "published"].includes(status)) {
    throw new Error("Passage status must be draft, pending, rejected, or published.");
  }
  const result = { id, t, diff, x, qs, status };
  if (raw.ownerId != null && raw.ownerId !== "") {
    result.ownerId = passageText(raw.ownerId, "Owner ID", 80);
  }
  if (raw.author != null && raw.author !== "") {
    result.author = passageText(raw.author, "Author", 160);
  }
  if (raw.createdAt != null && raw.createdAt !== "") {
    result.createdAt = passageText(raw.createdAt, "Created date", 40);
  }
  if (raw.submittedAt != null && raw.submittedAt !== "") {
    result.submittedAt = passageText(raw.submittedAt, "Submission date", 40);
  }
  if (raw.reviewedById != null && raw.reviewedById !== "") {
    result.reviewedById = passageText(raw.reviewedById, "Reviewer ID", 80);
  }
  if (raw.reviewedAt != null && raw.reviewedAt !== "") {
    result.reviewedAt = passageText(raw.reviewedAt, "Review date", 40);
  }
  if (raw.reviewNote != null && raw.reviewNote !== "") {
    result.reviewNote = passageText(raw.reviewNote, "Review note", 500);
  }
  return result;
}

function getPublishedPassages() {
  const sources = [
    ...PRACTICE_DATA.easy,
    ...PRACTICE_DATA.medium,
    ...PRACTICE_DATA.hard,
    ...PRACTICE_DATA.extreme,
    ...(Array.isArray(AUTH.customPassages) ? AUTH.customPassages : []),
    ...(Array.isArray(S.sh) ? S.sh : [])
  ];
  const seen = new Set();
  const passages = [];
  for (const source of sources) {
    try {
      const passage = normalizePassage(source);
      if (passage.status !== "published" || seen.has(passage.id)) continue;
      seen.add(passage.id);
      passages.push(passage);
    } catch (error) {
      // Invalid stored records remain untouched and are excluded from readers.
    }
  }
  return passages;
}

function getPublishedPassageById(id) {
  return getPublishedPassages().find(passage => passage.id === id);
}
