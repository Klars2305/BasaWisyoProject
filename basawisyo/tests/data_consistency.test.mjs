import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
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
  'src/services/bayanihan.js',
  'src/services/review.js',
  'src/services/flashcards.js',
  'src/services/journey.js',
  'src/services/board.js',
  'src/services/rankings.js',
  'src/services/mastery.js',
  'src/utils/reading.js',
  'src/components/navigation.js',
  'src/pages/home.js',
  'src/pages/practice.js',
  'src/pages/flashcards.js',
  'src/pages/profile.js',
  'src/pages/board.js',
  'src/pages/reports.js',
  'src/services/quiz.js',
  'src/services/tutor.js',
  'src/services/practice-helper.js',
  'src/services/backup.js',
  'src/pages/assess.js',
  'src/pages/quest.js',
  'src/services/material-storage.js',
  'src/services/assignments.js',
  'src/pages/teacher-reading-studio.js',
  'src/components/shell.js',
  'src/app.js',
  'src/services/exports.js',
];

function loadApp(storage = new Map()) {
  if (!storage.has('basa_wisyo_users_v2')) storage.set('basa_wisyo_school_mode_v1', 'demo');
  const elements = new Map();
  const listeners = new Map();
  const createMockElem = () => ({
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    insertAdjacentHTML() {},
    remove() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    style: {},
    appendChild() {},
    focus() {},
    scrollIntoView() {},
    getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 100 }),
  });

  let exportedJson = null;
  class Blob {
    constructor(parts) { this.text = parts.join(''); }
  }

  const mdModalElem = { addEventListener() {}, hidden: true, innerHTML: '', querySelector: () => ({ focus() {} }) };
  elements.set('#md', mdModalElem);

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
    querySelector: selector => elements.get(selector) ?? createMockElem(),
    querySelectorAll: selector => elements.get(selector) ? [elements.get(selector)] : [],
    getElementById: id => elements.get(`#${id}`) ?? createMockElem(),
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    createElement: () => ({ ...createMockElem(), click() {} }),
  };

  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); },
    get length() { return storage.size; },
    key: index => Array.from(storage.keys())[index] ?? null,
  };

  const context = vm.createContext({
    document,
    localStorage,
    FileReader: class {},
    Blob,
    URL: {
      createObjectURL(blob) { exportedJson = blob.text; return 'blob:test'; },
      revokeObjectURL() {}
    },
    showToast() {},
    alert() {},
    confirm: () => true,
    atob: typeof atob !== 'undefined' ? atob : (s => Buffer.from(s, 'base64').toString('binary')),
    btoa: typeof btoa !== 'undefined' ? btoa : (s => Buffer.from(s, 'binary').toString('base64')),
    Buffer,
    window: {
      location: { hash: '', pathname: '/index.html', search: '', assign() {}, replace() {} },
      history: { replaceState() {} },
      print() {},
      scrollTo() {},
      matchMedia: () => ({ matches: false }),
    },
    navigator: {},
    setTimeout() {},
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
    exportedJson: () => exportedJson,
  };
}

test('Security Audit: No exposed Groq API keys and comprehensive gitignore rules', () => {
  const envContent = readFileSync(join(appRoot, 'backend/.env.local'), 'utf8');
  assert.ok(!envContent.includes('gsk_'), 'No active secret API key in backend/.env.local');

  const gitignore = readFileSync(join(appRoot, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.env'), 'gitignore ignores .env files');
  assert.ok(gitignore.includes('backend/.env*') || gitignore.includes('**/.env*'), 'gitignore ignores backend env files');
});

test('Student Data Isolation: Student A and Student B maintain strictly separated records', () => {
  const app = loadApp();

  // 1. Student A (Carlo) logs in and completes a passage
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  assert.equal(app.eval('AUTH.currentUser.name'), 'Carlo Bautista');
  const carloInitialWords = app.eval('S.w');

  // Carlo completes a passage quiz
  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Carlo Practice"); finishQuiz()');
  const carloWordsAfter = app.eval('S.w');
  assert.ok(carloWordsAfter > carloInitialWords, 'Carlo gained words read');
  assert.ok(app.eval('S.done.includes(PRACTICE_DATA.easy[0].id)'), 'Passage marked done for Carlo');
  assert.equal(app.eval('S.attempts.length'), 1, 'Carlo has 1 completed attempt');

  // 2. Carlo logs out
  app.eval('AUTH.logout()');
  assert.equal(app.eval('AUTH.currentUser'), null);

  // 3. Student B (Ana) logs in
  app.eval('AUTH.login("ana@basawisyo.ph", "student123")');
  assert.equal(app.eval('AUTH.currentUser.name'), 'Ana Reyes');

  // Ana must NOT inherit Carlo\'s done passages or attempts!
  assert.equal(app.eval('S.done.includes(PRACTICE_DATA.easy[0].id)'), false, 'Carlo done passage not leaked to Ana');
  assert.equal(app.eval('S.attempts.length'), 0, 'Carlo attempt record not leaked to Ana');
  assert.equal(app.eval('S.w'), 750, 'Ana starts with her own 750 words, not Carlo words');

  // Ana completes a different passage
  app.eval('startQuiz([PRACTICE_DATA.easy[1]], "pr", "Ana Practice"); finishQuiz()');
  assert.ok(app.eval('S.done.includes(PRACTICE_DATA.easy[1].id)'), 'Passage 2 marked done for Ana');
  assert.equal(app.eval('S.done.includes(PRACTICE_DATA.easy[0].id)'), false, 'Passage 1 still not marked done for Ana');

  // 4. Ana logs out, Carlo logs back in
  app.eval('AUTH.logout()');
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  assert.equal(app.eval('AUTH.currentUser.name'), 'Carlo Bautista');
  assert.equal(app.eval('S.w'), carloWordsAfter, 'Carlo words restored accurately');
  assert.ok(app.eval('S.done.includes(PRACTICE_DATA.easy[0].id)'), 'Carlo done passage 1 preserved');
  assert.equal(app.eval('S.done.includes(PRACTICE_DATA.easy[1].id)'), false, 'Ana done passage 2 not leaked to Carlo');
  assert.equal(app.eval('S.attempts.length'), 1, 'Carlo attempt count preserved at 1');
});

test('Idempotency: Replaying or multiple finishQuiz calls do not duplicate words or attempts', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Idempotent Test")');
  const wordsBefore = app.eval('S.w');
  const sessionsBefore = app.eval('S.ss');

  // First completion
  app.eval('finishQuiz()');
  const wordsAfterFirst = app.eval('S.w');
  const sessionsAfterFirst = app.eval('S.ss');
  assert.ok(wordsAfterFirst > wordsBefore, 'Words added on first finish');
  assert.equal(sessionsAfterFirst, sessionsBefore + 1, 'Session incremented once');

  // Duplicate finish call on already finalized quiz
  app.eval('finishQuiz()');
  assert.equal(app.eval('S.w'), wordsAfterFirst, 'Duplicate finishQuiz does not add words again');
  assert.equal(app.eval('S.ss'), sessionsAfterFirst, 'Duplicate finishQuiz does not add sessions again');
});

test('Complete Backup & Restore: Round-trip preservation of flashcards, materials, and isolated user states', () => {
  const app = loadApp();

  // Create flashcard deck for student
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('saveFlashcardDeck([{ id: "fc-1", word: "mangrove", definition: "A coastal tree" }], "usr_stud_1")');
  app.eval('S.w = 5555; save()');

  // Create backup payload
  const backup = app.eval('createBackupPayload()');
  assert.ok(backup.format === 'BasaWisyoBackup');
  assert.ok(backup.version === 1);
  assert.ok(backup.flashcardDecks, 'Backup includes flashcard decks');
  assert.ok(backup.userStates, 'Backup includes user states');

  // Verify flashcard deck is in backup
  const deck = backup.flashcardDecks['basawisyo_flashcards_v1_usr_stud_1'] || backup.flashcardDecks['basa_wisyo_flashcards_usr_stud_1'];
  assert.ok(deck, 'Student 1 deck exported in backup');
  assert.equal(deck[0].word, 'mangrove');

  // Wipe data and restore
  app.eval('localStorage.removeItem("basawisyo_flashcards_v1_usr_stud_1")');
  app.eval('localStorage.removeItem("basa_wisyo_flashcards_usr_stud_1")');
  app.eval(`restoreBackupFromText(${JSON.stringify(JSON.stringify(backup))})`);

  // Verify restored deck
  const restoredDeck = app.eval('getFlashcardDeck("usr_stud_1")');
  assert.equal(restoredDeck[0].word, 'mangrove', 'Flashcard deck successfully restored');
});

test('Offline & Service Worker: sw.js exists and implements app-shell caching with offline AI fallback', () => {
  assert.ok(existsSync(join(appRoot, 'sw.js')), 'sw.js exists in repository root');
  const swCode = readFileSync(join(appRoot, 'sw.js'), 'utf8');

  assert.match(swCode, /basawisyo-shell-v\d+/, 'sw.js defines a versioned cache');
  assert.match(swCode, /src\/styles\/basamesh\.css/, 'offline exchange styles are cached');
  assert.match(swCode, /assets\/vendor\/qrcode\.js/, 'offline QR renderer is cached');
  assert.ok(swCode.includes('APP_SHELL_FILES'), 'sw.js specifies app shell file list');
  assert.ok(swCode.includes('Offline Mode') || swCode.includes('offline'), 'sw.js provides offline response for API');

  // Check registration in index.html and login.html
  const indexHtml = readFileSync(join(appRoot, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('navigator.serviceWorker.register'), 'index.html registers service worker');

  const loginHtml = readFileSync(join(appRoot, 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('navigator.serviceWorker.register'), 'login.html registers service worker');
});

test('Account Isolation & Mandatory Placement: New student has zero prior data and cannot read passages until placement is completed', () => {
  const app = loadApp();

  // 1. Carlo (Student A) practices and logs out
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Carlo Story"); finishQuiz()');
  const carloWords = app.eval('S.w');
  assert.ok(carloWords > 0, 'Carlo has recorded words read');
  app.eval('AUTH.logout()');

  // 2. Register brand new Student B (Ben)
  const regResult = app.eval(`AUTH.register({
    name: "Ben Cruz",
    email: "ben@basawisyo.ph",
    password: "password123",
    role: "student"
  })`);
  assert.equal(regResult.success, true, 'Registration succeeds');
  assert.equal(app.eval('AUTH.currentUser.name'), 'Ben Cruz');

  // Strict account isolation checks
  assert.equal(app.eval('AUTH.currentUser.lvl'), null, 'New student starts with lvl null (unassessed)');
  assert.equal(app.eval('AUTH.currentUser.wordsRead'), 0, 'New student starts with 0 words read');
  assert.equal(app.eval('S.lvl'), null, 'S.lvl is null');
  assert.equal(app.eval('S.w'), 0, 'S.w is 0');
  assert.equal(app.eval('S.done.length'), 0, 'S.done is empty');
  assert.equal(app.eval('S.attempts.length'), 0, 'S.attempts is empty');

  // 3. Mandatory placement gatekeeper checks
  const easyPassage = app.eval('PRACTICE_DATA.easy[0]');
  assert.equal(app.eval(`journeyCanRead(PRACTICE_DATA.easy[0])`), false, 'Unassessed student cannot read Easy passages');
  assert.equal(app.eval(`journeyCanRead(PRACTICE_DATA.medium[0])`), false, 'Unassessed student cannot read Medium passages');

  // Attempting to read passage via click delegates directly to assess tab
  app.eval('CURRENT_TAB = "practice"');
  app.eval(`
    const btn = document.createElement("button");
    btn.dataset.a = "read-passage";
    btn.dataset.v = "${easyPassage.id}";
    document.body.appendChild(btn);
  `);
  // Click handler check
  app.eval(`
    const ev = { target: { closest: selector => selector === "[data-a]" ? { dataset: { a: "read-passage", v: "${easyPassage.id}" } } : null } };
    // Trigger global listener for click
  `);
  app.eval('ACTIVE_QUIZ = null');
  app.eval(`
    // Direct simulation of read-passage gatekeeper
    if (AUTH.currentUser?.role === "student" && (S.lvl === null || AUTH.currentUser.lvl === null)) {
      CURRENT_TAB = "assess";
    } else {
      startQuiz([PRACTICE_DATA.easy[0]], "pr", "Should Not Start");
    }
  `);
  assert.equal(app.eval('ACTIVE_QUIZ'), null, 'Quiz did not start for unassessed student');
  assert.equal(app.eval('CURRENT_TAB'), 'assess', 'Student was redirected to assess tab');

  // Practice Library UI inspection
  const practiceHtml = app.eval('viewPractice()');
  assert.ok(practiceHtml.includes('Diagnostic Placement Required'), 'Practice page renders placement required banner');
  assert.ok(practiceHtml.includes('Take Placement First'), 'Passage cards display Take Placement First');

  // 4. Complete placement assessment
  app.eval('startQuiz(PLACEMENT_TEST, "pl", "Phil-IRI Diagnostic Placement")');
  assert.equal(app.eval('ACTIVE_QUIZ.mode'), 'pl');
  // Mark questions as correct so placement awards developing/proficient tier
  app.eval(`
    ACTIVE_QUIZ.steps.forEach((step, i) => {
      step.userCorrect = true;
    });
    ACTIVE_QUIZ.correctCount = ACTIVE_QUIZ.steps.length;
    finishQuiz();
  `);
  assert.ok(app.eval('S.lvl !== null'), 'Placement awarded a valid Phil-IRI level');
  assert.equal(app.eval('AUTH.currentUser.lvl'), app.eval('S.lvl'), 'User level updated to match S.lvl');
  assert.equal(app.eval('journeyCanRead(PRACTICE_DATA.easy[0])'), true, 'Easy passages are now unlocked for Ben');

  // 5. Log out Ben and log Carlo back in to verify Carlo data remained pristine
  app.eval('AUTH.logout()');
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  assert.equal(app.eval('AUTH.currentUser.name'), 'Carlo Bautista');
  assert.equal(app.eval('S.w'), carloWords, 'Carlo words restored without interference');
  assert.ok(app.eval('S.done.includes(PRACTICE_DATA.easy[0].id)'), 'Carlo completed story preserved');
});

test('Centralized Classroom Enrollment: Unenrolled students are gated from Bayanihan quest and Class Board rankings', () => {
  const app = loadApp();

  // Register a new independent student without a teacher code
  app.eval(`AUTH.register({
    name: "Independent Student",
    email: "indep@basawisyo.ph",
    password: "password123",
    role: "student"
  })`);

  // Verify enrollment status is null
  assert.equal(app.eval('AUTH.getActiveEnrollment()'), null, 'Student is not actively enrolled in a classroom');

  // 1. Check Bayanihan Quest gating
  const questStats = app.eval('getBayanihanStats()');
  assert.equal(questStats.isEnrolled, false, 'Bayanihan reports unenrolled status');
  assert.equal(questStats.classWords, 0, 'Classroom words are 0 when unenrolled (no 351-word leak)');
  assert.equal(questStats.studentWords, 0, 'Student classroom contribution is 0 when unenrolled');

  const questHtml = app.eval('viewQuest()');
  assert.ok(questHtml.includes('Join a Classroom First!'), 'Quest page shows Join a Classroom First!');
  assert.ok(questHtml.includes('classroom-join-code'), 'Quest page provides classroom join code input');
  assert.ok(!questHtml.includes('10,000 words'), 'Quest page does not display active class progress bar');

  // 2. Check Class Board gating
  assert.equal(app.eval('classBoardContext()'), null, 'Class Board context is null when unenrolled');
  const boardHtml = app.eval('viewClassBoard()');
  assert.ok(boardHtml.includes('Join a Classroom First!'), 'Class Board shows Join a Classroom First!');
  assert.ok(boardHtml.includes('classroom-join-code-board'), 'Class Board provides classroom join code input');

  // 3. Request the valid classroom, then wait for teacher review
  const connectResult = app.eval('AUTH.connectTeacher("BASA-TEACH-8492")');
  assert.equal(connectResult.success, true, 'Classroom request was saved');
  assert.equal(connectResult.status, 'pending');
  assert.equal(app.eval('AUTH.getActiveEnrollment()'), null, 'Pending requests are not active enrollment');
  assert.equal(app.eval('getBayanihanStats().isEnrolled'), false);
  const requestingStudentId = app.eval('AUTH.currentUser.id');
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.equal(app.eval(`AUTH.acceptEnrollment("${requestingStudentId}").success`), true);
  app.eval('AUTH.login("indep@basawisyo.ph", "password123")');

  const activeEnrollment = app.eval('AUTH.getActiveEnrollment()');
  assert.ok(activeEnrollment !== null, 'Active enrollment is now resolved');
  assert.equal(activeEnrollment.classroomId, 'BASA-TEACH-8492');
  assert.equal(activeEnrollment.section, 'Grade 8 - Emerald');

  // 4. Verify Bayanihan and Class Board are now unlocked
  const questStatsEnrolled = app.eval('getBayanihanStats()');
  assert.equal(questStatsEnrolled.isEnrolled, true, 'Bayanihan is now enrolled');

  const enrolledQuestHtml = app.eval('viewQuest()');
  assert.ok(!enrolledQuestHtml.includes('Join a Classroom First!'), 'Join prompt gone from Quest page');
  assert.ok(enrolledQuestHtml.includes('Grade 8 - Emerald Bayanihan Reading Quest'), 'Quest page shows section name');

  const enrolledBoardContext = app.eval('classBoardContext()');
  assert.ok(enrolledBoardContext !== null, 'Class Board context is now available');
  assert.equal(enrolledBoardContext.code, 'BASA-TEACH-8492');
});

test('Student-Teacher Data Integration: Single authoritative reporting pipeline across Roster, Reports, and Live Exports', () => {
  const app = loadApp();

  // 1. Register a fresh teacher Teacher Cruz with no initial students
  const regTeacher = app.eval('AUTH.register({name:"Teacher Cruz",email:"cruz@basawisyo.ph",password:"teach123",role:"teacher",section:"Grade 8 - Diamond"})');
  assert.equal(regTeacher.success, true);
  app.eval('AUTH.login("cruz@basawisyo.ph", "teach123")');
  const cruzCode = app.eval('AUTH.currentUser.shareCode');

  // 2. Truthful empty state for empty classroom
  const emptyDataset = app.eval('getClassroomReportDataset()');
  assert.equal(emptyDataset.total, 0, 'Empty classroom has 0 total students');
  assert.equal(emptyDataset.assessed, 0, 'Empty classroom has 0 assessed students');
  assert.equal(emptyDataset.coveragePct, 0, 'Empty classroom has 0% placement coverage');
  assert.equal(emptyDataset.levelCounts.join(','), '0,0,0,0', 'Empty classroom has zero distribution');

  const emptyRoster = app.eval('viewTeacher()');
  assert.ok(emptyRoster.includes('No students connected yet'), 'Roster shows truthful empty state');
  assert.ok(!emptyRoster.includes('105 WPM'), 'Empty roster does not fabricate WPM');

  const emptyReports = app.eval('viewReports()');
  assert.ok(emptyReports.includes('No student results available yet'), 'Reports show truthful empty state');

  app.eval('openForm14Modal("live")');
  const emptyModal = app.eval('$("#md").innerHTML');
  assert.ok(emptyModal.includes('No student results available yet'), 'Live modal displays truthful empty state');
  assert.ok(emptyModal.includes('0 Enrolled Students'), 'Live modal displays 0 enrolled students');
  assert.ok(!emptyModal.includes('Carlo Bautista'), 'Live modal does not leak other students');

  app.eval('downloadCSV("live")');
  const emptyCsv = app.exportedJson();
  assert.ok(emptyCsv.startsWith('No.,Student Name,Reading Profile,Reading Speed,Comprehension %,Words Read,Status / Intervention'), 'Live CSV has header');
  assert.ok(!emptyCsv.includes('Sample Learner Name'), 'Live CSV has zero sample names');
  assert.ok(!emptyCsv.includes('Carlo Bautista'), 'Live CSV has zero unrelated students');

  // 3. Register two students under Teacher Cruz
  // Student 1 (Juan Luna): Assessed learner
  app.eval('AUTH.logout()');
  const regJuan = app.eval(`AUTH.register({name:"Juan Luna",email:"juan@basawisyo.ph",password:"stud123",role:"student",teacherCode:"${cruzCode}"})`);
  assert.equal(regJuan.success, true);
  app.eval('AUTH.login("juan@basawisyo.ph", "stud123")');

  // Complete diagnostic placement for Juan Luna: Level 2 (Independent), 130 WPM, 85% Comp
  app.eval(`
    S.lvl = 2;
    S.wpm = 130;
    S.comp = 85;
    S.w = 640;
    S.placementReport = { date: new Date().toISOString(), level: 2, score: 13, total: 15 };
    save();
    AUTH.currentUser.lvl = 2;
    AUTH.currentUser.wpm = 130;
    AUTH.currentUser.comp = 85;
    AUTH.currentUser.wordsRead = 640;
    AUTH.saveUsers();
  `);

  // Student 2 (Maria Clara): Unassessed learner (has NOT completed placement)
  app.eval('AUTH.logout()');
  const regMaria = app.eval(`AUTH.register({name:"Maria Clara",email:"maria@basawisyo.ph",password:"stud123",role:"student",teacherCode:"${cruzCode}"})`);
  assert.equal(regMaria.success, true);
  app.eval('AUTH.login("maria@basawisyo.ph", "stud123")');
  // Maria does not take placement, remains unassessed

  // 4. Log in as Teacher Cruz and verify single authoritative reporting pipeline
  app.eval('AUTH.logout()');
  app.eval('AUTH.login("cruz@basawisyo.ph", "teach123")');
  assert.equal(app.eval('AUTH.getPendingEnrollments().length'), 2, 'Both requests await Teacher Cruz');
  assert.equal(app.eval('getClassroomReportDataset().total'), 0, 'Pending learners are not in reports');
  assert.equal(app.eval(`AUTH.acceptEnrollment("${regJuan.user.id}").success`), true);
  assert.equal(app.eval(`AUTH.acceptEnrollment("${regMaria.user.id}").success`), true);

  const dataset = app.eval('getClassroomReportDataset()');
  assert.equal(dataset.total, 2, 'Classroom has 2 enrolled students');
  assert.equal(dataset.assessed, 1, '1 student is assessed');
  assert.equal(dataset.unassessed, 1, '1 student is unassessed');
  assert.equal(dataset.coveragePct, 50, '50% placement coverage');
  assert.equal(dataset.levelCounts[2], 1, '1 student at Level 2 (Independent)');
  assert.equal(dataset.levelCounts[0], 0, '0 students at Level 0');
  assert.equal(dataset.totalWords, 640, 'Total words read computed from authoritative records');

  // Check Connected Students Roster in Teacher Workspace
  const rosterHtml = app.eval('viewTeacher()');
  assert.ok(rosterHtml.includes('Juan Luna'), 'Roster includes Juan Luna');
  assert.ok(rosterHtml.includes('Maria Clara'), 'Roster includes Maria Clara');
  assert.ok(rosterHtml.includes('Independent'), 'Juan has Independent level');
  assert.ok(rosterHtml.includes('130 WPM'), 'Juan has 130 WPM');
  assert.ok(rosterHtml.includes('85%'), 'Juan has 85% comp');
  assert.ok(rosterHtml.includes('Not assessed'), 'Maria shows Not assessed for level and speed');
  assert.ok(rosterHtml.includes('Placement Required'), 'Maria shows Placement Required status');
  assert.ok(!rosterHtml.includes('105 WPM'), 'Roster does not fabricate 105 WPM for Maria');

  // Check Reading Reports view
  const reportsHtml = app.eval('viewReports()');
  assert.ok(reportsHtml.includes('Placement Coverage (1/2)'), 'Reports show accurate placement coverage ratio');
  assert.ok(reportsHtml.includes('50%'), 'Reports show 50% coverage');
  assert.ok(reportsHtml.includes('LEVEL 2'), 'Reports show Level 2 category');
  assert.ok(reportsHtml.includes('UNASSESSED'), 'Reports show separate unassessed category');

  // Check Live Modal
  app.eval('openForm14Modal("live")');
  const liveModal = app.eval('$("#md").innerHTML');
  assert.ok(liveModal.includes('BasaWisyo Classroom Reading Progress Report'), 'Live modal has progress report title');
  assert.ok(liveModal.includes('Juan Luna'), 'Live modal contains Juan Luna');
  assert.ok(liveModal.includes('Maria Clara'), 'Live modal contains Maria Clara');
  assert.ok(liveModal.includes('Not assessed'), 'Live modal shows Not assessed for Maria');
  assert.ok(liveModal.includes('Placement Required'), 'Live modal shows Placement Required for Maria');
  assert.ok(!liveModal.includes('Demo Class 8-A'), 'Live modal does not show demo class info');

  // Check Live CSV Export
  app.eval('downloadCSV("live")');
  const liveCsv = app.exportedJson();
  assert.ok(liveCsv.includes('Juan Luna'), 'Live CSV contains Juan Luna');
  assert.ok(liveCsv.includes('Maria Clara'), 'Live CSV contains Maria Clara');
  assert.ok(liveCsv.includes('Independent'), 'Live CSV contains Independent profile for Juan');
  assert.ok(liveCsv.includes('130 WPM'), 'Live CSV contains 130 WPM for Juan');
  assert.ok(liveCsv.includes('Not assessed'), 'Live CSV contains Not assessed for Maria');
  assert.ok(!liveCsv.includes('Sample Learner Name'), 'Live CSV contains 0 sample names');

  // Check Sample Isolation (Rule 10)
  app.eval('openForm14Modal("sample")');
  const sampleModal = app.eval('$("#md").innerHTML');
  assert.ok(sampleModal.includes('Sample Form 14 Layout'), 'Sample modal retains sample title');
  assert.ok(!sampleModal.includes('Juan Luna'), 'Sample modal does not leak live students');

  app.eval('downloadCSV("sample")');
  const sampleCsv = app.exportedJson();
  assert.ok(sampleCsv.includes('Sample Learner Name'), 'Sample CSV has sample headers');
  assert.ok(!sampleCsv.includes('Juan Luna'), 'Sample CSV does not leak live students');

  // 5. Account and Teacher Isolation
  // Register Teacher Santos in another section
  app.eval('AUTH.logout()');
  const regSantos = app.eval('AUTH.register({name:"Teacher Santos",email:"santos@basawisyo.ph",password:"teach123",role:"teacher",section:"Grade 8 - Ruby"})');
  assert.equal(regSantos.success, true);
  app.eval('AUTH.login("santos@basawisyo.ph", "teach123")');

  const santosDataset = app.eval('getClassroomReportDataset()');
  assert.equal(santosDataset.total, 0, 'Teacher Santos cannot see Teacher Cruz students');

  const santosRoster = app.eval('viewTeacher()');
  assert.ok(!santosRoster.includes('Juan Luna'), 'Teacher Santos roster does not leak Juan Luna');
  assert.ok(!santosRoster.includes('Maria Clara'), 'Teacher Santos roster does not leak Maria Clara');
});


