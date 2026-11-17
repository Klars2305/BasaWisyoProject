import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appRoot = join(__dirname, '..');

const files = [
  'src/utils/core.js',
  'src/data/dictionary.js',
  'src/data/passages.js',
  'src/data/narrations.js',
  'src/data/passage-schema.js',
  'src/services/auth.js',
  'src/pages/teacher.js',
  'src/pages/admin.js',
  'src/services/state.js',
  'src/services/hearts.js',
  'src/services/rewards.js',
  'src/services/quests.js',
  'src/services/review.js',
  'src/services/flashcards.js',
  'src/services/journey.js',
  'src/services/board.js',
  'src/services/rankings.js',
  'src/services/mastery.js',
  'src/utils/reading.js',
  'src/components/navigation.js',
  'src/components/shell.js',
  'src/pages/home.js',
  'src/pages/assess.js',
  'src/pages/practice.js',
  'src/pages/flashcards.js',
  'src/pages/profile.js',
  'src/pages/quest.js',
  'src/pages/board.js',
  'src/pages/reports.js',
  'src/pages/parent.js',
  'src/pages/about.js',
  'src/pages/services.js',
  'src/services/quiz.js',
  'src/services/tutor.js',
  'src/services/practice-helper.js',
  'src/components/notifications.js',
  'src/services/exports.js',
  'src/services/backup.js',
  'src/services/import-reader.js',
  'src/services/material-storage.js',
  'src/services/ai-question-generator.js',
  'src/services/assignments.js',
  'src/pages/reading-studio.js',
  'src/pages/teacher-reading-studio.js',
  'src/app.js'
];

function loadApp(storage = new Map()) {
  if (!storage.has('basa_wisyo_users_v2')) storage.set('basa_wisyo_school_mode_v1', 'demo');
  const elements = new Map();
  const listeners = new Map();
  const createMockElem = () => ({
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    insertAdjacentHTML(pos, html) {
      this.innerHTML = (this.innerHTML || '') + html;
    },
    append() {},
    appendChild() {},
    remove() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    style: { setProperty() {} },
    focus() {},
    click() {},
    innerHTML: '',
    value: ''
  });

  const document = {
    documentElement: {
      setAttribute() {},
      style: { setProperty() {} },
    },
    body: {
      classList: { toggle() {}, add() {}, remove() {} },
      appendChild() {},
      removeChild() {},
    },
    querySelector: selector => {
      if (!elements.has(selector)) elements.set(selector, createMockElem());
      return elements.get(selector);
    },
    querySelectorAll: selector => elements.get(selector) ? [elements.get(selector)] : [],
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    createElement: () => createMockElem(),
  };

  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
  };

  const context = vm.createContext({
    document,
    localStorage,
    FileReader: class {
      readAsText(file) {
        setTimeout(() => {
          this.result = file.content || "";
          if (typeof this.onload === 'function') this.onload({ target: { result: this.result } });
        }, 1);
      }
      readAsArrayBuffer(file) {
        setTimeout(() => {
          this.result = new ArrayBuffer(8);
          if (typeof this.onload === 'function') this.onload({ target: { result: this.result } });
        }, 1);
      }
    },
    Blob: class {
      constructor(parts) { this.parts = parts; }
    },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL() {} },
    showToast() {},
    alert() {},
    confirm: () => true,
    window: {
      location: { hash: '', pathname: '/index.html', search: '', assign() {}, replace() {} },
      history: { replaceState() {} },
      print() {},
      scrollTo() {},
      matchMedia: () => ({ matches: false }),
    },
    navigator: {},
    setTimeout,
    clearTimeout
  });

  for (const relative of files) {
    vm.runInContext(readFileSync(join(appRoot, relative), 'utf8'), context, {
      filename: relative,
    });
  }

  return {
    storage,
    elements,
    eval: expression => vm.runInContext(expression, context),
  };
}

test('Import Reader: File validation rejects oversized, empty, or unsupported files', () => {
  const app = loadApp();

  // Valid files
  const validTxt = app.eval(`validateImportFile({ name: "story.txt", size: 1024 })`);
  assert.equal(validTxt.valid, true);
  assert.equal(validTxt.extension, ".txt");

  const validDocx = app.eval(`validateImportFile({ name: "reading_module.docx", size: 50000 })`);
  assert.equal(validDocx.valid, true);
  assert.equal(validDocx.extension, ".docx");

  const validPdf = app.eval(`validateImportFile({ name: "lesson.pdf", size: 2 * 1024 * 1024 })`);
  assert.equal(validPdf.valid, true);
  assert.equal(validPdf.extension, ".pdf");

  // Invalid: empty file (0 bytes)
  const emptyRes = app.eval(`validateImportFile({ name: "empty.txt", size: 0 })`);
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.error.includes("empty"));

  // Invalid: exceeds 10 MB limit
  const hugeRes = app.eval(`validateImportFile({ name: "huge.pdf", size: 15 * 1024 * 1024 })`);
  assert.equal(hugeRes.valid, false);
  assert.ok(hugeRes.error.includes("10 MB"));

  // Invalid: unsupported format
  const badExt = app.eval(`validateImportFile({ name: "audio.mp3", size: 2048 })`);
  assert.equal(badExt.valid, false);
  assert.ok(badExt.error.includes("Unsupported"));
});

test('Import Reader: Text normalization strips control characters and computes accurate readability metrics', () => {
  const app = loadApp();

  const raw = "  The sea turtles of Apo Island return every year to nest along the white sands.\r\n\r\n\r\n\r\nLocal fishers protect their nesting grounds from predators.\x07\x08  ";
  const stats = app.eval(`normalizeImportedText(${JSON.stringify(raw)})`);

  assert.equal(stats.charCount > 0, true);
  assert.equal(stats.wordCount >= 20, true);
  assert.ok(!stats.text.includes("\x07"), "Control characters removed");
  assert.ok(!stats.text.includes("\r"), "Line breaks normalized");
  assert.ok(stats.cleanTitle.length > 0, "Derived clean title");
  assert.equal(stats.estMinutes >= 1, true, "Calculates estimated reading time");
});

test('Material Storage: Student personal materials are private and cannot be published or accessed by others', async () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Student saves a material
  const saved = await app.eval(`
    saveMaterial({
      title: "My Tarsier Story",
      text: "The Philippine tarsier is one of the smallest known primates. They dwell in the forests of Bohol and have large nocturnal eyes.",
      sourceType: "txt",
      status: "published", // Attempting to set published
      visibility: "public"  // Attempting to set public
    }, { id: "student_42", role: "student", name: "Maria" })
  `);

  // Enforced student safety policy
  assert.equal(saved.status, "personal", "Students are forced to status personal");
  assert.equal(saved.visibility, "private", "Student personal materials are forced to private");
  assert.equal(saved.ownerId, "student_42");

  // Another student attempting to retrieve Maria's private material gets null
  const unauthorizedRead = await app.eval(`
    getMaterialById("${saved.id}", { id: "student_99", role: "student", name: "Pedro" })
  `);
  assert.equal(unauthorizedRead, null, "Cannot read another student's private personal material");

  // Owner can retrieve it
  const ownerRead = await app.eval(`
    getMaterialById("${saved.id}", { id: "student_42", role: "student", name: "Maria" })
  `);
  assert.ok(ownerRead);
  assert.equal(ownerRead.title, "My Tarsier Story");

  // Student cannot update material to published
  await assert.rejects(
    async () => {
      await app.eval(`updateMaterialStatus("${saved.id}", "published", "", { id: "student_42", role: "student" })`);
    },
    /Students cannot change publication/,
    "Rejects student attempt to self-publish"
  );
});

test('Material Storage: Teacher drafts, versioning, and lifecycle progression', async () => {
  const app = loadApp();

  // Teacher creates a draft
  const draft = await app.eval(`
    saveMaterial({
      title: "Mangrove Conservation",
      text: "Mangroves are salt-tolerant trees that line tropical coastlines. Their roots trap sediments and shield shores from storm surges.",
      difficulty: "medium",
      status: "draft"
    }, { id: "teacher_1", role: "teacher", name: "Teacher Santos" })
  `);
  assert.equal(draft.status, "draft");
  assert.equal(draft.version, 1);

  // Teacher submits draft for Admin approval
  const pending = await app.eval(`
    updateMaterialStatus("${draft.id}", "pending", "", { id: "teacher_1", role: "teacher" })
  `);
  assert.equal(pending.status, "pending");

  // Admin approves material
  const approved = await app.eval(`
    updateMaterialStatus("${draft.id}", "approved", "Good comprehension questions", { id: "admin_1", role: "admin" })
  `);
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewNote, "Good comprehension questions");

  // Teacher edits approved material -> increments version to 2 and resets to draft
  const edited = await app.eval(`
    saveMaterial({
      id: "${draft.id}",
      title: "Mangrove Conservation (Updated)",
      text: "Mangroves are salt-tolerant trees that line tropical coastlines. Their roots trap sediments and shield shores from storm surges. They also sequester carbon efficiently."
    }, { id: "teacher_1", role: "teacher", name: "Teacher Santos" })
  `);
  assert.equal(edited.version, 2, "Increments version on edit of approved content");
  assert.equal(edited.status, "draft", "Resets to draft for teacher review");
});

test('AI Generator: Multi-skill question generation, schema validation, and trilingual vocabulary', () => {
  const app = loadApp();

  const passage = "The Coral Triangle is the global center of marine biodiversity. It encompasses the waters of the Philippines, Indonesia, and Papua New Guinea. Over five hundred species of reef-building corals flourish here, sustaining millions of coastal families.";

  // Generate 5 questions offline
  const result = app.eval(`
    generateOfflineReadingPractice(${JSON.stringify(passage)}, { count: 5, difficulty: "medium", language: "en" })
  `);

  assert.equal(result.questions.length, 5, "Generates requested 5 questions");
  assert.ok(result.vocabulary.length >= 2, "Generates vocabulary flashcards");

  // Validate every generated question against strict schema
  result.questions.forEach(q => {
    const isValid = app.eval(`validateGeneratedQuestion(${JSON.stringify(q)})`);
    assert.equal(isValid, true, `Question ${q.q} passes schema validation`);
    assert.equal(q.o.length, 4, "Has exactly 4 options");
    assert.ok(q.a >= 0 && q.a <= 3, "Valid answer key");
    assert.ok(q.exp && q.exp.length > 5, "Contains text evidence");
  });

  // Verify vocabulary schema
  result.vocabulary.forEach(v => {
    assert.ok(v.word);
    assert.ok(v.definition);
    assert.ok(v.example);
  });
});

test('Studio Practice Quiz: Heart-free safe zone, capped XP, Smart Review mistake saving, and karaoke integration', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  const samplePassage = {
    id: "mat_studio_test",
    t: "My Personal Imported Story",
    diff: "medium",
    lang: "en",
    x: "Apo Island is famous for community-based marine sanctuaries. Local fishers protect their coral reefs and fish populations thrive.",
    qs: [
      {
        q: "What is Apo Island famous for?",
        o: ["Gold mining", "Community-based marine sanctuaries", "Textile weaving", "Coffee production"],
        a: 1,
        k: "Literal",
        exp: "The text states: 'Apo Island is famous for community-based marine sanctuaries.'"
      },
      {
        q: "What is the result of protecting coral reefs?",
        o: ["Fish populations thrive", "The reef was destroyed", "Fishing was banned forever", "Water levels dropped"],
        a: 0,
        k: "Literal",
        exp: "The text explains: 'fish populations thrive.'"
      }
    ]
  };

  // Start quiz in "studio" mode
  app.eval(`startQuiz([${JSON.stringify(samplePassage)}], "studio", "My Studio Practice")`);
  assert.equal(app.eval('ACTIVE_QUIZ.mode'), 'studio');

  // Submit wrong answer on question 1
  app.eval('handleAnswer(0)'); // Correct is 1
  assert.equal(app.eval('ACTIVE_QUIZ.correctCount'), 0);

  // In Studio mode, hearts are NOT deducted on wrong answers (safe zone)
  const heartsLeft = app.eval('ACTIVE_QUIZ.hearts');
  assert.equal(heartsLeft, 2, "Studio mistakes do not deduct hearts");

  // Verify mistake was enqueued in Smart Review spaced repetition queue
  const reviewQueue = app.eval('getReviewQueue()');
  assert.ok(reviewQueue.length >= 1, "Mistake enqueued in smart review queue");

  // Submit correct answer on question 2
  app.eval('handleQuizNext()');
  app.eval('handleAnswer(0)');
  assert.equal(app.eval('ACTIVE_QUIZ.correctCount'), 1);

  // Finalize quiz
  app.eval('finishQuiz()');
  assert.ok(app.eval('QUIZ_RESULT'));
  assert.equal(app.eval('QUIZ_RESULT.score'), 1);
  assert.equal(app.eval('QUIZ_RESULT.total'), 2);

  // Capped personal XP (1 correct * 2 = 2 XP, capped at 10)
  assert.equal(app.eval('QUIZ_RESULT.xpGained'), 2, "Awards small capped personal XP");

  // Reuses karaoke result celebration
  assert.equal(app.eval('typeof QUIZ_RESULT.karaokeDone'), 'boolean');
});

test('Class Assignments: Creation, due dates, practice vs formal assessment, and JSON packaging', async () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');

  // 1. Save an approved teacher material
  const material = await app.eval(`
    saveMaterial({
      title: "Philippine Marine Ecosystems",
      text: "The Philippine waters contain rich mangrove forests and coral reefs providing food and livelihood to coastal families.",
      difficulty: "medium",
      status: "approved",
      questions: [
        {
          q: "What do Philippine waters contain?",
          o: ["Desert sand", "Mangrove forests and coral reefs", "Glaciers", "Volcanic ash only"],
          a: 1,
          k: "Literal",
          exp: "Directly stated in passage sentence 1."
        }
      ]
    }, { id: "usr_teach_1", role: "teacher", name: "Teacher Santos" })
  `);

  // 2. Create class assignment
  const assignment = await app.eval(`
    createClassAssignment({
      materialId: "${material.id}",
      sectionCode: "Grade 8 - Rizal",
      dueDate: "2026-12-05",
      mode: "assessment"
    }, { id: "usr_teach_1", role: "teacher", name: "Teacher Santos" })
  `);

  assert.ok(assignment.id.startsWith("ass_"));
  assert.equal(assignment.targetGroup, "Grade 8 - Rizal");
  assert.equal(assignment.dueDate, "2026-12-05");
  assert.equal(assignment.mode, "assessment");

  // 3. Export versioned JSON package
  const packageJson = app.eval(`exportAssignmentPackage("${assignment.id}")`);
  const parsed = JSON.parse(packageJson);
  assert.equal(parsed.schemaVersion, "basa_wisyo_assignment_v1");
  assert.equal(parsed.assignment.title, "Philippine Marine Ecosystems");

  // 4. Import package into another session
  const imported = app.eval(`importAssignmentPackage(${JSON.stringify(packageJson)})`);
  assert.ok(imported.id);
  assert.equal(imported.title, "Philippine Marine Ecosystems");
  assert.equal(imported.mode, "assessment");
});

test('Navigation: Teacher Studio icon renders in subnav and bottom tabs', async () => {
  const app = loadApp();
  const iconHtml = app.eval(`uiIcon("teacher-studio")`);
  assert.ok(iconHtml.includes('<svg class="ui-icon"'), 'teacher-studio should render SVG with ui-icon class');

  const teacherTabs = app.eval(`bottomTabsForRole("teacher")`);
  assert.ok(teacherTabs.includes("teacher-studio"), 'bottom tabs should include teacher-studio');

  for (const tab of teacherTabs) {
    const tabIcon = app.eval(`uiIcon("${tab}")`);
    assert.ok(tabIcon.includes('<svg class="ui-icon"'), `Tab "${tab}" must have a valid SVG icon`);
  }
});

test('Teacher Studio moves valid older materials into passages and keeps incomplete drafts available', () => {
  const storage = new Map();
  const app = loadApp(storage);
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const teacherId = app.eval('AUTH.currentUser.id');
  const base = {
    ownerId: teacherId, ownerRole: 'teacher', sourceType: 'teacher_studio',
    text: 'A teacher prepared a classroom reading about birds and the forest.',
    language: 'en', difficulty: 'easy', status: 'draft'
  };
  storage.set('basa_wisyo_materials_v1', JSON.stringify([
    { ...base, id: 'mat_valid', title: 'Forest Birds', questions: [
      { q: 'What did the teacher prepare?', o: ['A reading', 'A song'], a: 0, k: 'Literal' }
    ] },
    { ...base, id: 'mat_approved', title: 'Approved Older Material', status: 'approved', questions: [
      { q: 'Where did the story happen?', o: ['Forest', 'Sea'], a: 0, k: 'Literal' }
    ] },
    { ...base, id: 'mat_incomplete', title: 'Forest Draft', questions: [] },
    { ...base, id: 'mat_other_teacher', ownerId: 'another-teacher', title: 'Private Draft', questions: [] }
  ]));

  assert.equal(app.eval('migrateLegacyTeacherMaterials()'), 2);
  assert.equal(app.eval('migrateLegacyTeacherMaterials()'), 0);
  assert.equal(app.eval('AUTH.customPassages.length'), 2);
  assert.equal(app.eval('AUTH.customPassages[0].id'), 'mat_valid');
  assert.equal(app.eval('AUTH.customPassages[1].status'), 'pending');
  assert.equal(JSON.parse(storage.get('basa_wisyo_materials_v1')).length, 4);
  const studio = app.eval('viewTeacherReadingStudio()');
  assert.match(studio, /Add passage/);
  assert.match(studio, /Forest Birds/);
  assert.match(studio, /Forest Draft/);
  assert.doesNotMatch(studio, /Material &amp; Questions|Private Draft/);
});

test('Class assignment accepts a published passage from the unified library', async () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const passageId = app.eval('getPublishedPassages()[0].id');
  const assignment = await app.eval(`createClassAssignment({
    materialId: ${JSON.stringify(passageId)}, sectionCode: 'Grade 8 - Section 1',
    dueDate: '2026-12-01'
  })`);
  assert.equal(assignment.passageId, passageId);
  assert.ok(assignment.material.qs.length > 0);
  assert.equal(JSON.parse(app.eval(`exportAssignmentPackage(${JSON.stringify(assignment.id)})`)).assignment.material.id, passageId);
});
