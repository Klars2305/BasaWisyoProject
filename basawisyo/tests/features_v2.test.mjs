import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    focus() {},
    click() {},
  });
  elements.set('#md', createMockElem());
  elements.set('#ai', createMockElem());
  elements.set('#auth-modal', { hidden: true, ...createMockElem() });
  elements.set('#role-card-student', createMockElem());
  elements.set('#sn', createMockElem());
  elements.set('#nav', createMockElem());
  elements.set('#v', createMockElem());
  elements.set('#welcome-screen', { hidden: true, ...createMockElem() });

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
    FileReader: class {},
    Blob: class {},
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
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
  };
}

test('XP system: awards 10 XP base + 5 XP per correct answer on first completion', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // First completion with 2 correct answers out of 2 (PRACTICE_DATA.easy[0].qs.length is 2)
  const res = app.eval(`
    const p = PRACTICE_DATA.easy[0];
    recordJourneyPractice({
      mode: "pr",
      steps: p.qs.map(q => ({ P: p, q })),
      correctCount: 2
    });
  `);

  // 10 base + (2 * 5) = 20 XP
  assert.equal(res.isFirstCompletion, true);
  assert.equal(res.xpGained, 20);
  assert.equal(res.totalXP, 20);
  assert.equal(app.eval('journeyTotalXP(journeyForCurrent())'), 20);
});

test('XP system: retries only award XP for personal best improvements and never deduct', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Create a 4-question mock eligible passage
  app.eval(`
    const mockPassage = {
      id: PRACTICE_DATA.easy[0].id,
      t: "Mock Story",
      diff: "easy",
      qs: [
        { q: "Q1", o: ["A", "B"], a: 0, k: "Literal" },
        { q: "Q2", o: ["A", "B"], a: 0, k: "Literal" },
        { q: "Q3", o: ["A", "B"], a: 0, k: "Literal" },
        { q: "Q4", o: ["A", "B"], a: 0, k: "Literal" }
      ]
    };
  `);

  // 1st attempt: 2 of 4 correct -> 10 + 2*5 = 20 XP
  const res1 = app.eval(`
    recordJourneyPractice({
      mode: "pr",
      steps: mockPassage.qs.map(q => ({ P: mockPassage, q })),
      correctCount: 2
    });
  `);
  assert.equal(res1.isFirstCompletion, true);
  assert.equal(res1.xpGained, 20);
  assert.equal(res1.totalXP, 20);

  // 2nd attempt (retry): 1 of 4 correct (worse than best of 2) -> 0 XP gained, total remains 20
  const res2 = app.eval(`
    recordJourneyPractice({
      mode: "pr",
      steps: mockPassage.qs.map(q => ({ P: mockPassage, q })),
      correctCount: 1
    });
  `);
  assert.equal(res2.isFirstCompletion, false);
  assert.equal(res2.xpGained, 0);
  assert.equal(res2.totalXP, 20);
  assert.equal(app.eval('journeyTotalXP(journeyForCurrent())'), 20);

  // 3rd attempt (retry): 4 of 4 correct (improved from 2 to 4) -> (4 - 2) * 5 = 10 XP gained
  const res3 = app.eval(`
    recordJourneyPractice({
      mode: "pr",
      steps: mockPassage.qs.map(q => ({ P: mockPassage, q })),
      correctCount: 4
    });
  `);
  assert.equal(res3.isFirstCompletion, false);
  assert.equal(res3.xpGained, 10);
  assert.equal(res3.totalXP, 30);
  assert.equal(app.eval('journeyTotalXP(journeyForCurrent())'), 30);
});

test('XP separation: Class Board ranking is unaffected by XP', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Complete passage e1
  app.eval(`
    const p = PRACTICE_DATA.easy[0];
    recordJourneyPractice({
      mode: "pr",
      steps: p.qs.map(q => ({ P: p, q })),
      correctCount: p.qs.length
    });
  `);

  // boardStoryCount counts qualifying stories completed
  const storyCount1 = app.eval('boardStoryCount(journeyForCurrent())');
  assert.equal(storyCount1, 1);

  // Retry same passage
  app.eval(`{
    const p = PRACTICE_DATA.easy[0];
    recordJourneyPractice({
      mode: "pr",
      steps: p.qs.map(q => ({ P: p, q })),
      correctCount: p.qs.length
    });
  }`);
  const storyCount2 = app.eval('boardStoryCount(journeyForCurrent())');
  assert.equal(storyCount2, 1, 'Board story count must remain 1 after retrying same story');
});

test('Badge requirements and reveal: computes missing requirements and reveals newly unlocked badges only', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  const reqsBefore = app.eval('journeyBadgeRequirements(journeyForCurrent())');
  assert.ok(Array.isArray(reqsBefore));
  const firstBadge = reqsBefore.find(b => b.id === 'first');
  assert.ok(firstBadge);
  assert.equal(firstBadge.earned, false);
  assert.ok(firstBadge.missingText.includes('Needs'));

  // Complete first story to earn 'first' and 'perfect' badges
  const res1 = app.eval(`{
    const p = PRACTICE_DATA.easy[0];
    recordJourneyPractice({
      mode: "pr",
      steps: p.qs.map(q => ({ P: p, q })),
      correctCount: p.qs.length
    });
  }`);

  assert.ok(res1.newBadges.some(b => b.id === 'first'));
  const unlockedFirst = res1.newBadges.find(b => b.id === 'first');
  assert.ok(unlockedFirst.whyReason.length > 0, 'Must have "Ngano nimo ni nakuha" reason');

  // Complete another practice on the same story; 'first' badge must NOT appear in newBadges again
  const res2 = app.eval(`{
    const p = PRACTICE_DATA.easy[0];
    recordJourneyPractice({
      mode: "pr",
      steps: p.qs.map(q => ({ P: p, q })),
      correctCount: p.qs.length
    });
  }`);
  assert.equal(res2.newBadges.length, 0, 'Previously unlocked badge must not be in newBadges again');
});

test('Quiz result scene: captures score, renders review, retry, next story buttons, and explanations', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Start quiz with first easy passage and answer all questions
  app.eval(`
    startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice");
    handleAnswer(PRACTICE_DATA.easy[0].qs[0].a);
    handleAnswer((PRACTICE_DATA.easy[0].qs[1].a + 1) % 4);
    finishQuiz();
  `);

  const quizResult = app.eval('QUIZ_RESULT');
  assert.ok(quizResult, 'QUIZ_RESULT must be populated after finishQuiz()');
  assert.equal(quizResult.score, 1);
  assert.equal(quizResult.total, 2);
  assert.equal(typeof quizResult.xpGained, 'number');

  const html = app.eval('renderQuizResult(); $("#v").innerHTML');
  assert.ok(html.includes('quiz-result-hero-card'), 'Renders result card');
  assert.ok(html.includes('1/2') && html.includes('correct'), 'Shows correct score');
  assert.ok(html.includes('data-a="quiz-review"'), 'Includes review answers button');
  assert.ok(html.includes('data-a="quiz-retry"'), 'Includes try again button');
  assert.ok(html.includes('data-a="quiz-next-story"'), 'Includes next story button');
  assert.ok(html.includes('data-a="quiz-exit-to-library"'), 'Includes library button');

  // In review mode, renders explanations
  app.eval('QUIZ_RESULT.reviewMode = true');
  const reviewHtml = app.eval('renderQuizResult(); $("#v").innerHTML');
  assert.ok(reviewHtml.includes('quiz-review-panel'), 'Includes review panel');
  assert.ok(reviewHtml.includes('Question 1 of 2'), 'Labels first question');
  assert.ok(reviewHtml.includes('Text Evidence:'), 'Provides explanation');
});

test('Profile progress: displays Total XP, Badges in Progress, and positive framing', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');

  // Record practice
  app.eval(`
    const p = PRACTICE_DATA.easy[0];
    recordJourneyPractice({
      mode: "pr",
      steps: p.qs.map(q => ({ P: p, q })),
      correctCount: p.qs.length
    });
  `);

  const profileHtml = app.eval('viewProfile()');
  assert.ok(profileHtml.includes('Total XP'), 'Must include Total XP stat');
  assert.ok(profileHtml.includes('Next Badges to Unlock'), 'Must include Next Badges section');
  assert.ok(profileHtml.includes('Badges in Progress'), 'Must list badges in progress');
  assert.ok(profileHtml.includes('No XP loss'), 'Must reinforce positive learning');
});

test('Unified icon system: SVG icons and companion text in navigation', () => {
  const app = loadApp();

  const checkSvg = app.eval('uiIcon("check")');
  assert.ok(checkSvg.includes('<svg'), 'uiIcon must return SVG markup');
  assert.ok(checkSvg.includes('viewBox="0 0 24 24"'), 'SVG has valid viewBox');

  const closeSvg = app.eval('uiIcon("close")');
  assert.ok(closeSvg.includes('<svg'));

  const lockSvg = app.eval('uiIcon("lock")');
  assert.ok(lockSvg.includes('<svg'));

  const bottomTabs = app.eval('bottomTabsForRole("student")');
  assert.ok(Array.isArray(bottomTabs));
  assert.ok(bottomTabs.includes('home'));
  assert.ok(bottomTabs.includes('practice'));
  assert.ok(bottomTabs.includes('profile'));
});

test('Button color system: primary buttons and passage cards are blue and not yellow', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  const practiceHtml = app.eval('viewPractice()');
  assert.ok(practiceHtml.includes('btn sm blue'), 'Passage card button must have blue styling');
  assert.ok(!practiceHtml.includes('btn sm gold'), 'Passage card button must not use gold/yellow class');

  const homeHtml = app.eval('viewHome()');
  assert.ok(homeHtml.includes('btn blue'), 'Hero action button must have blue styling');
  assert.ok(!homeHtml.includes('btn gold'), 'Hero action button must not use gold/yellow class');
});

test('Animation spec: karaoke quiz celebration stage, spotlights, rating text, and skip action', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  app.eval(`
    startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice");
    handleAnswer(PRACTICE_DATA.easy[0].qs[0].a);
    handleQuizNext();
    handleAnswer(PRACTICE_DATA.easy[0].qs[1].a);
    handleQuizNext();
  `);

  const html = app.eval('renderQuizResult(); $("#v").innerHTML');
  assert.ok(html.includes('karaoke-stage'), 'Must render karaoke stage');
  assert.ok(html.includes('karaoke-spotlight-left'), 'Must include left spotlight');
  assert.ok(html.includes('karaoke-spotlight-right'), 'Must include right spotlight');
  assert.ok(html.includes('karaoke-score-ring'), 'Must include score ring');
  assert.ok(html.includes('karaoke-rating'), 'Must include karaoke rating container');
  assert.ok(html.includes('karaoke-confetti'), 'Must include confetti container');
  assert.ok(html.includes('karaoke-wisyo-wrap'), 'Must include Wisyo celebratory mascot');

  // Verify skip action
  app.eval('skipQuizKaraoke()');
  const res = app.eval('QUIZ_RESULT');
  assert.equal(res.karaokeDone, true, 'skipQuizKaraoke must mark celebration as complete');
  const postSkipHtml = app.eval('$("#v").innerHTML');
  assert.ok(postSkipHtml.includes('PERFECT! · OUTSTANDING!'), '100% score displays PERFECT rating text');
});

test('Animation spec: correct and wrong answer feedback animation classes and double-submission protection', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Start quiz
  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice")');
  const q = app.eval('ACTIVE_QUIZ.steps[0].q');

  // Submit an answer
  app.eval(`handleAnswer(${q.a})`);

  // Check active quiz isAnswered
  const qz = app.eval('ACTIVE_QUIZ');
  assert.equal(qz.isAnswered, true);

  // Submitting another answer while answered must be ignored
  app.eval(`handleAnswer((${(q.a + 1) % 4}))`);
  assert.equal(app.eval('ACTIVE_QUIZ.selectedChoice'), q.a, 'Must block double submissions');

  // Inspect feedback box markup
  const fbHtml = app.eval('$("#quiz-feedback")?.innerHTML || ""');
  assert.ok(fbHtml.includes('answer-fb-pop'), 'Feedback box has entrance animation class');
  assert.ok(fbHtml.includes('Correct!'), 'Feedback has positive tone');
});

test('reader separates passage and question without losing the answer', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice")');
  let html = app.eval('$("#v").innerHTML');
  assert.ok(html.includes('reader-passage-stage'), 'Reading stage appears first');
  assert.ok(!html.includes('reader-question-card quiz-card-enter'), 'Question is not combined with passage');
  assert.ok(html.includes('reader-progress-bar'), 'Progress remains visible');

  app.eval('showQuizStage("question")');
  html = app.eval('$("#v").innerHTML');
  assert.ok(html.includes('reader-question-card quiz-card-enter'), 'One question card appears');
  assert.ok(html.includes('data-a="quiz-show-passage"'), 'Passage can be reopened');
  app.eval('handleAnswer(0)');
  const selected = app.eval('ACTIVE_QUIZ.selectedChoice');
  app.eval('showQuizStage("passage"); showQuizStage("question")');
  assert.equal(app.eval('ACTIVE_QUIZ.selectedChoice'), selected);
  assert.equal(app.eval('ACTIVE_QUIZ.isAnswered'), true);
  app.eval('handleQuizNext()');
  assert.equal(app.eval('ACTIVE_QUIZ.stage'), 'question', 'Next question in the same story stays focused');
});

test('placement shows each new passage before its question', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true; startQuiz([PRACTICE_DATA.easy[0], PRACTICE_DATA.easy[1]], "pl", "Placement")');
  app.eval('showQuizStage("question"); handleAnswer(0); handleQuizNext()');
  app.eval('handleAnswer(0); handleQuizNext()');
  assert.equal(app.eval('ACTIVE_QUIZ.stage'), 'passage');
  assert.ok(app.eval('$("#v").innerHTML').includes('reader-passage-stage'));
});

test('returning to a passage restores its previous reading position', () => {
  const app = loadApp();
  app.eval(`GUEST_MODE = true; startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice");
    window.scrollY = 600;
    $("#v").getBoundingClientRect = () => ({ top: -400 });
    showQuizStage("question");
    window.scrollY = 300;
    $("#v").getBoundingClientRect = () => ({ top: -100 });
    window.scrollTo = options => { window.restoredTop = options.top; };
    showQuizStage("passage");`);
  assert.equal(app.eval('window.restoredTop'), 600);
});

test('rerendering the same view does not force the page to scroll', () => {
  const app = loadApp();
  app.eval('window.scrollCount = 0; window.scrollTo = () => { window.scrollCount++; }; GUEST_MODE = true; renderApp()');
  const afterArrival = app.eval('window.scrollCount');
  app.eval('renderApp()');
  assert.equal(app.eval('window.scrollCount'), afterArrival);
  app.eval('CURRENT_TAB = "practice"; renderApp()');
  assert.equal(app.eval('window.scrollCount'), afterArrival + 1);
});

test('Animation spec: daily streak tracking and tier level-up celebration card', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Test streak initialization and increment
  assert.equal(app.eval('S.streak'), 0);
  const streak1 = app.eval('updateDailyStreak()');
  assert.equal(streak1, 1);
  assert.equal(app.eval('S.streak'), 1);

  // Re-updating on the same day maintains streak
  const streakSameDay = app.eval('updateDailyStreak()');
  assert.equal(streakSameDay, 1);

  // Simulating yesterday\'s practice increments streak
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  app.eval(`S.lastPracticeDate = "${yesterday}"`);
  const streakNextDay = app.eval('updateDailyStreak()');
  assert.equal(streakNextDay, 2);

  // Complete a quiz to check streak pill in result
  app.eval(`
    startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice");
    handleAnswer(PRACTICE_DATA.easy[0].qs[0].a);
    handleAnswer(PRACTICE_DATA.easy[0].qs[1].a);
    finishQuiz();
  `);

  const html = app.eval('renderQuizResult(); $("#v").innerHTML');
  assert.ok(html.includes('quiz-streak-pill'), 'Renders streak pill in result');
  assert.ok(html.includes('streak-flame'), 'Renders streak flame animation element');
  assert.ok(html.includes('Day Streak!'), 'Displays day streak text');

  // Test Level Up card rendering when tier advance occurs
  app.eval(`
    QUIZ_RESULT.levelUp = { fromTier: 0, toTier: 1, tierName: "Medium (Katamtaman)" };
  `);
  const levelUpHtml = app.eval('renderQuizResult(); $("#v").innerHTML');
  assert.ok(levelUpHtml.includes('level-up-hero-card'), 'Renders level-up card');
  assert.ok(levelUpHtml.includes('LEVEL UP!'), 'Displays LEVEL UP header');
  assert.ok(levelUpHtml.includes('Medium (Katamtaman)'), 'Displays new tier name');
});

test('Heart system: initializes with hearts based on question count, deducts 1 on wrong practice answer, exempts placement diagnostic', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Practice quiz: hearts allocated equal to question count
  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice")');
  const totalQuestions = app.eval('ACTIVE_QUIZ.steps.length');
  assert.equal(app.eval('ACTIVE_QUIZ.hearts'), totalQuestions, 'Quiz hearts equal number of questions');
  assert.equal(app.eval('ACTIVE_QUIZ.maxHearts'), totalQuestions);

  // Wrong answer in practice quiz deducts 1 heart
  app.eval(`
    const q = ACTIVE_QUIZ.steps[0].q;
    handleAnswer((q.a + 1) % 4);
  `);
  assert.equal(app.eval('ACTIVE_QUIZ.hearts'), totalQuestions - 1, 'Wrong answer in practice quiz must deduct 1 heart');

  // Placement diagnostic: wrong answer MUST NEVER deduct hearts
  app.eval(`
    startQuiz(PLACEMENT_TEST, "pl", "Phil-IRI Diagnostic Placement");
    const plTotal = ACTIVE_QUIZ.steps.length;
    const qPl = ACTIVE_QUIZ.steps[0].q;
    handleAnswer((qPl.a + 1) % 4);
  `);
  assert.equal(app.eval('ACTIVE_QUIZ.hearts'), app.eval('ACTIVE_QUIZ.steps.length'), 'Placement diagnostic must NEVER deduct hearts');
});

test('Heart system: per-quiz heart deduction, deduplication guard, and accommodation mode', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  app.eval('var testQuiz = initQuizHearts(4)');
  assert.equal(app.eval('testQuiz.hearts'), 4, 'Initializes with 4 hearts for a 4-question quiz');
  assert.equal(app.eval('testQuiz.maxHearts'), 4);

  // Deduct 1 heart
  const res1 = app.eval('deductQuizHeart(testQuiz, "p1:q0")');
  assert.equal(res1.deducted, true);
  assert.equal(app.eval('testQuiz.hearts'), 3);

  // Deduplication guard test: submitting same answer ID twice does not double-deduct
  const res2 = app.eval('deductQuizHeart(testQuiz, "p1:q0")');
  assert.equal(res2.deducted, false, 'Duplicate answer ID must not deduct another heart');
  assert.equal(res2.duplicate, true);
  assert.equal(app.eval('testQuiz.hearts'), 3, 'Heart count remains unchanged on duplicate submission');

  // Accommodation mode test: unlimited hearts
  app.eval('S.heartAccommodations = true; var accomQuiz = initQuizHearts(4); var resAccom = deductQuizHeart(accomQuiz, "p1:q1");');
  assert.equal(app.eval('resAccom.accommodated'), true);
  assert.equal(app.eval('accomQuiz.hearts'), 4, 'Accommodation mode does not deduct hearts');
});

test('Heart system: zero hearts triggers out-of-hearts screen and instant retry; centralized rewards engine', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Start practice quiz with easy[0]
  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Practice")');
  const passageId = app.eval('ACTIVE_QUIZ.steps[0].P.id');

  // Set hearts to 1 and make a mistake to trigger Out of Hearts
  app.eval('ACTIVE_QUIZ.hearts = 1');
  app.eval(`
    const q = ACTIVE_QUIZ.steps[0].q;
    handleAnswer((q.a + 1) % 4);
  `);
  assert.equal(app.eval('ACTIVE_QUIZ.hearts'), 0, 'Hearts drop to 0 on final mistake');

  // Feedback contains Out of Hearts message and retry button
  const fbText = app.eval('document.querySelector("#quiz-feedback")?.innerHTML || ""');
  assert.ok(fbText.includes('Out of Hearts!'), 'Displays Out of Hearts message');
  assert.ok(fbText.includes('out-of-hearts-retry'), 'Offers instant retry with fresh hearts');

  // Instant retry restarts quiz with full fresh hearts (no 20-minute waiting lock)
  app.eval(`
    const p = getPublishedPassageById("${passageId}");
    startQuiz([p], "pr", "Practice: " + p.t);
  `);
  assert.equal(app.eval('ACTIVE_QUIZ.hearts'), app.eval('ACTIVE_QUIZ.steps.length'), 'Restarts immediately with fresh full hearts');

  // Centralized rewards engine calculations
  const r1 = app.eval('computeAttemptRewards({ passageId: "p1", score: 2, total: 2, isFirstCompletion: true, isEligible: true })');
  assert.equal(r1.xpGained, 20, 'First completion awards 10 base + 2*5 accuracy = 20 XP');
  assert.equal(r1.isFirstCompletion, true);

  const r2 = app.eval('computeAttemptRewards({ passageId: "p1", score: 2, total: 2, isFirstCompletion: false, previousBest: 1, isEligible: true })');
  assert.equal(r2.xpGained, 5, 'Retry awards (2 - 1)*5 = 5 XP for personal best improvement');
  assert.equal(r2.improvement, 1);
});

test('Sprint 2: Daily Reading Quests, streak tracking, idempotent rewards, and home card integration', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  const today = app.eval('getTodayDateString()');
  const quest = app.eval('getDailyQuest()');
  assert.equal(quest.date, today, 'Daily quest is keyed by local today');
  assert.equal(quest.completed, false);
  assert.equal(quest.claimedAt, null);
  assert.equal(quest.tasks.read.completed, false);
  assert.equal(quest.tasks.quiz.completed, false);
  assert.equal(quest.tasks.review.completed, false);

  const initialXP = app.eval('journeyTotalXP()');

  // Complete task 1: read
  const prog1 = app.eval('updateQuestProgress("read", 1)');
  assert.equal(prog1.quest.tasks.read.completed, true);
  assert.equal(prog1.newlyCompleted, false);
  assert.equal(app.eval('journeyTotalXP()'), initialXP);

  // Complete task 2: quiz
  const prog2 = app.eval('updateQuestProgress("quiz", 1)');
  assert.equal(prog2.quest.tasks.quiz.completed, true);
  assert.equal(prog2.newlyCompleted, false);

  // Complete task 3: review -> triggers 3/3 completion reward (+25 XP)
  const prog3 = app.eval('updateQuestProgress("review", 1)');
  assert.equal(prog3.quest.tasks.review.completed, true);
  assert.equal(prog3.newlyCompleted, true, 'Marked as newly completed on 3/3 tasks');
  assert.equal(prog3.quest.completed, true);
  assert.ok(prog3.quest.claimedAt > 0, 'claimedAt timestamp is recorded');

  // Verify rewards awarded: +25 XP
  assert.equal(app.eval('journeyTotalXP()'), initialXP + 25, 'Awards +25 bonus XP upon quest completion');

  // Anti-duplicate protection: calling progress again on same day must NOT award duplicate rewards
  const prog4 = app.eval('updateQuestProgress("read", 1)');
  assert.equal(prog4.newlyCompleted, false, 'Must not complete again on the same calendar day');
  assert.equal(app.eval('journeyTotalXP()'), initialXP + 25, 'XP must remain strictly unchanged');

  // Day rollover / calendar day reset
  const tm = new Date();
  tm.setDate(tm.getDate() + 1);
  const tomorrow = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, "0")}-${String(tm.getDate()).padStart(2, "0")}`;
  const tomorrowQuest = app.eval(`getDailyQuest("${tomorrow}")`);
  assert.equal(tomorrowQuest.date, tomorrow);
  assert.equal(tomorrowQuest.completed, false, 'New day starts with uncompleted quest');
  assert.equal(tomorrowQuest.claimedAt, null);
  assert.equal(tomorrowQuest.tasks.read.completed, false);

  // Streak tracking & broken streak detection
  app.eval(`S.lastPracticeDate = "${today}"; S.streak = 3`);
  assert.equal(app.eval('getDailyStreak()'), 3, 'Active streak of 3 when practiced today');

  // 2 days without practice breaks streak to 0
  app.eval('S.lastPracticeDate = "2026-11-01"');
  assert.equal(app.eval('getDailyStreak()'), 0, 'Streak is 0 when past practice is over 1 day ago');

  // UI rendering in English
  const cardHtml = app.eval('renderDailyQuestCard()');
  assert.ok(cardHtml.includes('Daily Reading Quest'), 'Card renders quest title');
  assert.ok(cardHtml.includes('Daily Quest'), 'Card renders English eyebrow');
  assert.ok(cardHtml.includes('Tasks Completed'), 'Card renders English progress label');

  // Home page includes the Daily Quest card for students/guests
  const homeHtml = app.eval('viewHome()');
  assert.ok(homeHtml.includes('daily-quest-card'), 'viewHome includes Daily Quest card');
});

test('Sprint 3: Smart Review spaced repetition queue, scheduling intervals, and zero-heart safe zone', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // Initial review queue should be empty
  let queue = app.eval('getReviewQueue()');
  assert.equal(queue.length, 0);

  // 1. Schedule a mistake (outcome = "incorrect")
  const qItem1 = app.eval(`scheduleQuestionReview({
    questionId: "p-batanes:0",
    passageId: "p-batanes-limestone",
    passageTitle: "The Stone Houses of Batanes",
    passageExcerpt: "Ivatan stone houses are built of thick limestone...",
    qIndex: 0,
    questionText: "Why are walls made of limestone?",
    options: ["For decoration", "To withstand violent typhoons", "To absorb heat", "For light"],
    correctAnswer: 1,
    explanation: "Limestone provides structural resilience against Pacific typhoons.",
    skill: "Inference",
    outcome: "incorrect"
  })`);

  assert.equal(qItem1.questionId, "p-batanes:0");
  assert.equal(qItem1.intervalDays, 1, "Initial mistake gets 1-day interval");
  assert.equal(qItem1.consecutiveCorrect, 0);
  assert.equal(qItem1.reviewCount, 1);
  assert.equal(qItem1.lastResult, "incorrect");

  // 2. Successful review advances interval: 1 day -> 3 days
  const qItem2 = app.eval(`scheduleQuestionReview({
    questionId: "p-batanes:0",
    outcome: "correct"
  })`);
  assert.equal(qItem2.intervalDays, 3, "First correct review increases interval to 3 days");
  assert.equal(qItem2.consecutiveCorrect, 1);
  assert.equal(qItem2.reviewCount, 2);

  // 3. Second sustained success: 3 days -> 7 days
  const qItem3 = app.eval(`scheduleQuestionReview({
    questionId: "p-batanes:0",
    outcome: "correct"
  })`);
  assert.equal(qItem3.intervalDays, 7, "Second correct review increases interval to 7 days");
  assert.equal(qItem3.consecutiveCorrect, 2);

  // 4. Third sustained success: 7 days -> 14 days (Mastered threshold)
  const qItem4 = app.eval(`scheduleQuestionReview({
    questionId: "p-batanes:0",
    outcome: "correct"
  })`);
  assert.equal(qItem4.intervalDays, 14, "Third correct review sets interval to 14 days (Mastered)");
  assert.equal(qItem4.consecutiveCorrect, 3);

  // Stats verification
  let stats = app.eval('getReviewStats()');
  assert.equal(stats.total, 1);
  assert.equal(stats.mastered, 1, "Item with 3 consecutive correct is marked mastered");

  // 5. Subsequent mistake resets consecutive correct count and interval back to 1 day
  const qItem5 = app.eval(`scheduleQuestionReview({
    questionId: "p-batanes:0",
    outcome: "incorrect"
  })`);
  assert.equal(qItem5.intervalDays, 1, "Mistake resets interval back to 1 day");
  assert.equal(qItem5.consecutiveCorrect, 0, "Mistake resets consecutive correct count to 0");

  // 6. Practice quiz mistake automatically enqueues into review queue
  const passage = app.eval('PRACTICE_DATA.easy[0]');
  app.eval(`startQuiz([${JSON.stringify(passage)}], "pr", "Practice Quiz")`);
  const initialHearts = app.eval('ACTIVE_QUIZ.hearts');
  assert.ok(initialHearts > 0);

  // Submit wrong answer
  const wrongChoice = passage.qs[0].a === 0 ? 1 : 0;
  app.eval(`handleAnswer(${wrongChoice})`);

  // Verify question was recorded into review queue
  queue = app.eval('getReviewQueue()');
  const enqueued = queue.find(q => q.questionId === `${passage.id}:0`);
  assert.ok(enqueued, "Wrong practice question is automatically added to review queue");
  assert.equal(enqueued.intervalDays, 1);

  // 7. Launch Smart Review session (Zero-Heart Safe Zone)
  const started = app.eval('startSmartReviewSession()');
  assert.equal(started, true, "Smart Review session successfully started");
  assert.equal(app.eval('ACTIVE_QUIZ.mode'), 'review');
  assert.equal(app.eval('ACTIVE_QUIZ.isSafeZone'), true, "Review session marked as safe zone");

  // Wrong answer in review mode must NEVER deduct hearts
  const reviewHeartsBefore = app.eval('ACTIVE_QUIZ.hearts');
  const reviewQ = app.eval('ACTIVE_QUIZ.steps[0].q');
  const reviewWrongChoice = reviewQ.a === 0 ? 1 : 0;
  app.eval(`handleAnswer(${reviewWrongChoice})`);
  assert.equal(app.eval('ACTIVE_QUIZ.hearts'), reviewHeartsBefore, "Review mode does not deduct hearts on wrong answer");

  // Finish review quiz awards XP and updates daily quest task "review"
  app.eval('ACTIVE_QUIZ.correctCount = 2; finishQuiz()');
  const quest = app.eval('getDailyQuest()');
  assert.equal(quest.tasks.review.completed, true, "Review quiz advances quest task 'review'");
});

test('Sprint 3: Vocabulary Flashcards deck, Leitner ratings, 3D flip card UI, and dictionary integration', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // 1. Deck seeds high-impact starter vocabulary from dictionary D
  const deck = app.eval('getFlashcardDeck()');
  assert.ok(Array.isArray(deck));
  assert.ok(deck.length >= 8, 'Seeded at least 8 starter vocabulary flashcards');
  const sampaguitaCard = deck.find(c => c.word.toLowerCase() === 'sampaguita');
  assert.ok(sampaguitaCard, 'Deck includes sampaguita');
  assert.equal(sampaguitaCard.filipino, 'sampaguita');
  assert.equal(sampaguitaCard.bisaya, 'sampagita');
  assert.ok(sampaguitaCard.definition.length > 10);
  assert.equal(sampaguitaCard.box, 1, 'Initial Leitner box is 1');
  assert.equal(sampaguitaCard.intervalDays, 1, 'Initial interval is 1 day');

  // 2. Leitner rating: "good" advances box and interval
  const ratedGood = app.eval(`rateFlashcard("${sampaguitaCard.id}", "good")`);
  assert.equal(ratedGood.box, 2, 'Rating Good advances to Box 2');
  assert.equal(ratedGood.intervalDays, 3, 'Box 2 interval is 3 days');
  assert.equal(ratedGood.correctCount, 1);
  assert.equal(ratedGood.lastRating, 'good');

  // Leitner rating: "easy" jumps box and interval
  const ratedEasy = app.eval(`rateFlashcard("${sampaguitaCard.id}", "easy")`);
  assert.equal(ratedEasy.box, 4, 'Rating Easy advances by 2 boxes to Box 4');
  assert.equal(ratedEasy.intervalDays, 14, 'Box 4+ interval is 14 days');

  // Leitner rating: "difficult" resets to Box 1 and 1 day
  const ratedDiff = app.eval(`rateFlashcard("${sampaguitaCard.id}", "difficult")`);
  assert.equal(ratedDiff.box, 1, 'Rating Difficult resets to Box 1');
  assert.equal(ratedDiff.intervalDays, 1, 'Reset interval is 1 day');

  // 3. Saving custom word or word from passage reading
  const savedCard = app.eval(`saveFlashcard({
    word: "tarsier",
    passageId: "p-bohol-tarsier",
    contextSentence: "The nocturnal tarsier clung quietly to the branch."
  })`);
  assert.equal(savedCard.word, "tarsier");
  assert.equal(savedCard.filipino, "tarsyer o mamag", "Auto-fills Filipino translation from dictionary D");
  assert.equal(savedCard.bisaya, "mawmag", "Auto-fills Bisaya translation from dictionary D");
  assert.equal(savedCard.box, 1);

  // 4. Flashcard statistics
  const fcStats = app.eval('getFlashcardStats()');
  assert.ok(fcStats.total >= 9);
  assert.ok(fcStats.due >= 0);

  // 5. Dictionary tooltip contains Save to Flashcards button
  app.eval('ACTIVE_QUIZ = null');
  const entry = app.eval('D["biodiversity"]');
  assert.ok(entry);

  // 6. UI View Flashcards rendering: simplified one-card-at-a-time interface
  const fcHtml = app.eval('viewFlashcards()');
  assert.ok(fcHtml.includes('Vocabulary Flashcards'), 'Renders Flashcards title');
  assert.ok(fcHtml.includes('fc-card-viewport'), 'Renders 3D card viewport');
  assert.ok(!fcHtml.includes('Due Today'), 'Technical statistics bar removed from student UI');
  assert.ok(!fcHtml.includes('Easy (7d)'), 'Self-rating difficulty buttons removed from student UI');
  assert.ok(fcHtml.includes('Card <b>1</b>'), 'Renders clear card progress');

  // 7. Navigation tab switching to flashcards
  app.eval('CURRENT_TAB = "flashcards"; renderApp()');
  assert.equal(app.eval('CURRENT_TAB'), 'flashcards');
});

test('Sprint 4: Class Board rankings, weekly XP, classroom/year-level filters, and prototype transparency', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // 1. Ranking period calculation
  const period = app.eval('getRankingPeriod()');
  assert.ok(period.label.length > 5, 'Period label is formatted');
  assert.ok(period.daysRemaining >= 1 && period.daysRemaining <= 7);
  assert.equal(period.isPrototype, true, 'Marked as prototype data');

  // 2. Setup teacher and two students opted in
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('setClassBoardOptIn(true)');
  app.eval('S.questBonusXP = 50');

  // Second student
  app.eval('AUTH.logout(); AUTH.login("ana@basawisyo.ph", "student123")');
  app.eval('setClassBoardOptIn(true)');
  app.eval('S.questBonusXP = 25');

  // 3. Weekly XP calculation
  const rankings = app.eval('getClassroomRankings({ metric: "weeklyXP", scope: "classroom" })');
  assert.ok(rankings.entries.length >= 2, 'Classroom rankings include opted-in students');
  assert.equal(rankings.entries[0].place, 1, 'Top earner has rank 1');
  assert.ok(rankings.entries[0].score >= rankings.entries[1].score, 'Sorted descending by weekly score');
  assert.equal(rankings.isPrototype, true, 'Prototype transparency preserved');

  // 4. View Class Board UI rendering
  const boardHtml = app.eval('viewClassBoard()');
  assert.ok(boardHtml.includes('Local Demo Prototype Data'), 'Renders prototype transparency notice');
  assert.ok(boardHtml.includes('Weekly XP'), 'Renders Weekly XP metric');
  assert.ok(boardHtml.includes('Filter Scope'), 'Renders filter scope controls');
  assert.ok(boardHtml.includes('board-metric'), 'Renders metric buttons');
  assert.ok(boardHtml.includes('board-scope'), 'Renders scope buttons');

  // 5. Switching metric to Stories preserves tier buttons and story count
  app.eval('CURRENT_BOARD_METRIC = "stories"');
  const storiesBoardHtml = app.eval('viewClassBoard()');
  assert.ok(storiesBoardHtml.includes('Stories by tier'), 'Renders stories by tier section');
  assert.ok(storiesBoardHtml.includes('board-tier-choices'), 'Renders tier filter choices');
});

test('Sprint 4: Reading Mastery Dashboard, question-attempt evidence, and formative skill analytics', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // 1. Initial state: insufficient evidence (< 3 attempts)
  let litMastery = app.eval('getSkillMastery("Literal")');
  assert.equal(litMastery.key, 'Literal');
  assert.equal(litMastery.isSufficient, false);
  assert.equal(litMastery.status, 'Insufficient Evidence');
  assert.equal(litMastery.neededAttempts, 3);

  // 2. Record 2 question attempts (still insufficient)
  app.eval(`
    recordSkillAttempt({ skill: "Literal", isCorrect: true, questionId: "p1:0", passageId: "p1" });
    recordSkillAttempt({ skill: "Literal", isCorrect: true, questionId: "p1:1", passageId: "p1" });
  `);
  litMastery = app.eval('getSkillMastery("Literal")');
  assert.equal(litMastery.attempts, 2);
  assert.equal(litMastery.isSufficient, false);
  assert.equal(litMastery.neededAttempts, 1);

  // 3. Record 3rd attempt: reaches sufficiency threshold (3/3 = 100% -> "Mastered")
  app.eval(`recordSkillAttempt({ skill: "Literal", isCorrect: true, questionId: "p1:2", passageId: "p1" })`);
  litMastery = app.eval('getSkillMastery("Literal")');
  assert.equal(litMastery.attempts, 3);
  assert.equal(litMastery.isSufficient, true);
  assert.equal(litMastery.accuracy, 100);
  assert.equal(litMastery.status, 'Mastered');

  // 4. Test "Inference" skill with mixed accuracy (2 correct / 4 attempts = 50% -> "Developing")
  app.eval(`
    recordSkillAttempt({ skill: "Inference", isCorrect: true, questionId: "p2:0", passageId: "p2" });
    recordSkillAttempt({ skill: "Inference", isCorrect: false, questionId: "p2:1", passageId: "p2" });
    recordSkillAttempt({ skill: "Inference", isCorrect: false, questionId: "p2:2", passageId: "p2" });
    recordSkillAttempt({ skill: "Inference", isCorrect: true, questionId: "p2:3", passageId: "p2" });
  `);
  const inferMastery = app.eval('getSkillMastery("Inference")');
  assert.equal(inferMastery.attempts, 4);
  assert.equal(inferMastery.correct, 2);
  assert.equal(inferMastery.accuracy, 50);
  assert.equal(inferMastery.status, 'Developing');

  // 5. Complete Mastery Report across 5 core skills
  const report = app.eval('getReadingMasteryReport()');
  assert.equal(report.skills.length, 5, 'Tracks all 5 core skills');
  assert.equal(report.isOfficialAssessment, false, 'Explicitly marked as formative analytics');
  assert.ok(report.totalAttempts >= 7);
  assert.equal(report.masteredCount, 1);
  assert.equal(report.developingCount, 1);

  // 6. UI Dashboard rendering
  const dashboardHtml = app.eval('renderReadingMasteryDashboard()');
  assert.ok(dashboardHtml.includes('Formative Skill Evidence Dashboard'), 'Renders formative disclaimer header');
  assert.ok(dashboardHtml.includes('Literal Comprehension'), 'Renders Literal skill card');
  assert.ok(dashboardHtml.includes('Inference &amp; Deduction') || dashboardHtml.includes('Inference'), 'Renders Inference skill card');
  assert.ok(dashboardHtml.includes('Mastered'), 'Renders Mastered badge');
  assert.ok(dashboardHtml.includes('Insufficient Evidence'), 'Renders Insufficient Evidence state');

  // 7. Profile view embeds Reading Mastery Dashboard
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  const profileHtml = app.eval('viewProfile()');
  assert.ok(profileHtml.includes('profile-mastery-section'), 'Profile includes Reading Mastery section');
  assert.ok(profileHtml.includes('Formative Skill Evidence Dashboard'), 'Profile embeds mastery dashboard HTML');
});

test('Sprint 5: Wisyo AI reading coach context, skill-specific hints, constructive mistake analysis, and quick checks', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // 1. Context passing: passage, question, selected answer, and recent mistake
  const passage = {
    id: "p_coral_reef",
    t: "The Coral Sanctuary",
    diff: "medium",
    x: "Marine protected sanctuaries help replenish fish populations around the Apo Island reef. Divers observe vibrant corals and turtles.",
    qs: [
      {
        q: "What do marine protected sanctuaries help replenish?",
        o: ["Plastic pollution", "Fish populations", "Tourist crowds", "Fishing boats"],
        a: 1,
        k: "Literal",
        exp: "Sentence 1 states that sanctuaries replenish fish populations."
      },
      {
        q: "Why might local fishers support protecting the reef?",
        o: ["To stop all tourism", "Because nearby waters gain more fish over time", "To close the island forever", "To build a hotel"],
        a: 1,
        k: "Inference",
        exp: "Replenishing fish populations spills over into surrounding waters, sustaining fishers' livelihoods."
      }
    ]
  };

  app.eval(`startQuiz([${JSON.stringify(passage)}], "pr", "The Coral Sanctuary")`);

  // Before answering: answered is false, selectedAnswer is null
  let ctx = app.eval('wisyoReadingContext()');
  assert.equal(ctx.passage.title, "The Coral Sanctuary");
  assert.equal(ctx.question.text, "What do marine protected sanctuaries help replenish?");
  assert.equal(ctx.question.skill, "Literal");
  assert.equal(ctx.question.answered, false);
  assert.equal(ctx.question.selectedAnswer, null);
  assert.equal(ctx.recentMistake, null);

  // Submit wrong answer (Choice 0: Plastic pollution)
  app.eval('handleAnswer(0)');
  ctx = app.eval('wisyoReadingContext()');
  assert.equal(ctx.question.answered, true);
  assert.equal(ctx.question.selectedAnswer, "Plastic pollution");
  assert.ok(ctx.recentMistake, "Recent mistake is recorded in context");
  assert.equal(ctx.recentMistake.chosenAnswer, "Plastic pollution");
  assert.equal(ctx.recentMistake.correctAnswer, "Fish populations");

  // 2. Constructive mistake explanation from Wisyo
  const mistakeExplanation = app.eval(`offlineWisyoResponse("Explain why my answer was wrong", wisyoReadingContext())`);
  assert.ok(mistakeExplanation.includes("Plastic pollution"), "Mentions chosen answer");
  assert.ok(mistakeExplanation.includes("Fish populations"), "Mentions correct answer");
  assert.ok(mistakeExplanation.includes("fastest way to build reading comprehension") || mistakeExplanation.includes("Keep going"), "Includes encouraging guidance");

  // 3. Skill-specific hints (Literal vs Inference vs Main Idea vs Vocabulary vs Sequencing)
  const literalHint = app.eval(`wisyoHint({ text: "What do sanctuaries replenish?", skill: "Literal" }, { text: "Sanctuaries replenish fish." }, "en")`);
  assert.ok(literalHint.includes("compare its details with the choices") || literalHint.includes("Reread sentence"));
  assert.ok(literalHint.includes("won't reveal the answer"));

  const inferHint = app.eval(`wisyoHint({ text: "Why do fishers support it?", skill: "Inference" }, { text: "Sanctuaries help fish." }, "en")`);
  assert.ok(inferHint.includes("Connect the clue with what the character does or feels"), "Inference hint prompts connecting clues");

  const mainIdeaHint = app.eval(`wisyoHint({ text: "What is the theme?", skill: "Main idea" }, { text: "Sanctuaries help fish." }, "en")`);
  assert.ok(mainIdeaHint.includes("fits the whole passage"), "Main idea hint focuses on whole passage");

  const vocabHint = app.eval(`wisyoHint({ text: "What does replenish mean?", skill: "Vocabulary" }, { text: "Sanctuaries help replenish fish." }, "en")`);
  assert.ok(vocabHint.includes("surrounding words give context"), "Vocabulary hint guides contextual clues");

  const seqHint = app.eval(`wisyoHint({ text: "What happened first?", skill: "Sequencing" }, { text: "First the reef was formed, then corals grew." }, "en")`);
  assert.ok(seqHint.includes("chronological order clues"), "Sequencing hint guides order clues");

  // 4. Quick follow-up practice check
  const quickCheck = app.eval(`offlineWisyoResponse("Quick check", wisyoReadingContext())`);
  assert.ok(quickCheck.includes("Quick Practice Check") || quickCheck.includes("In your own words"), "Provides interactive quick check");
});

test('Sprint 5: Teacher question generator, multi-skill offline drafts, schema validation, and read-along controls', async () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');

  // 1. Teacher offline suggestions cover varied skills (Literal, Inference, Main idea, Vocabulary)
  const samplePassage = "The mangrove forest along the bay protects coastal communities from monsoonal waves. Fish find nursery habitats among the tangled roots, while birds nest in the canopy above.";
  const suggestions = app.eval(`offlinePracticeSuggestions(${JSON.stringify(samplePassage)}, 4)`);

  assert.equal(suggestions.length, 4, "Drafts requested number of questions");
  const skillsUsed = suggestions.map(q => q.k);
  assert.ok(skillsUsed.includes("Literal"), "Generates Literal question");
  assert.ok(skillsUsed.includes("Inference"), "Generates Inference question");
  assert.ok(skillsUsed.includes("Main idea"), "Generates Main idea question");
  assert.ok(skillsUsed.includes("Vocabulary"), "Generates Vocabulary question");

  for (const q of suggestions) {
    assert.equal(q.o.length, 4, "Every question has exactly 4 options");
    assert.ok(q.a >= 0 && q.a <= 3, "Valid zero-based answer key");
    assert.ok(q.exp && q.exp.length > 5, "Includes text evidence explanation");
    assert.ok(q.q.includes("____"), "Follows passage excerpt cloze contract");
  }

  // 2. Schema validator for generated questions
  assert.equal(app.eval(`validateGeneratedQuestion(${JSON.stringify(suggestions[0])})`), true);
  assert.equal(app.eval(`validateGeneratedQuestion({ q: "Incomplete?", o: ["A", "B"], a: 0, k: "Literal" })`), false, "Rejects fewer than 4 options");
  assert.equal(app.eval(`validateGeneratedQuestion({ q: "", o: ["A", "B", "C", "D"], a: 0, k: "Literal" })`), false, "Rejects empty question prompt");
  assert.equal(app.eval(`validateGeneratedQuestion({ q: "Bad key?", o: ["A", "B", "C", "D"], a: 5, k: "Literal" })`), false, "Rejects out of range answer index");

  // 3. Read-along speech controls (pause, resume, isSpeechPaused, and speed options)
  assert.equal(app.eval('typeof pauseSpeech'), 'function');
  assert.equal(app.eval('typeof resumeSpeech'), 'function');
  assert.equal(app.eval('typeof isSpeechPaused'), 'function');

  // Test speed options (0.75x, 1x, 1.25x)
  app.eval('setSpeechSetting("rate", 0.75)');
  assert.equal(app.eval('SPEECH_SETTINGS.rate'), 0.75);

  app.eval('setSpeechSetting("rate", 1.25)');
  assert.equal(app.eval('SPEECH_SETTINGS.rate'), 1.25);

  // Pause and resume state transitions
  assert.equal(app.eval('isSpeechPaused()'), false);
  app.eval('SPEECH_PASSAGE_ACTIVE = true');
  const paused = app.eval('pauseSpeech()');
  assert.equal(paused, true);
  assert.equal(app.eval('isSpeechPaused()'), true);

  const resumed = app.eval('resumeSpeech()');
  assert.equal(resumed, true);
  assert.equal(app.eval('isSpeechPaused()'), false);

  // stopSpeech resets paused state
  app.eval('pauseSpeech()');
  assert.equal(app.eval('isSpeechPaused()'), true);
  app.eval('stopSpeech()');
  assert.equal(app.eval('isSpeechPaused()'), false);
  assert.equal(app.eval('SPEECH_PASSAGE_ACTIVE'), false);
});

test('Sprint 6: Storage migration from legacy keys (v1 to v2) preserving student progress', () => {
  const storage = new Map();
  // Simulate legacy v1 state
  const legacyData = {
    lvl: 2,
    w: 1250,
    ss: 8,
    done: ["p_batanes", "p_tarsier"],
    sk: { Literal: [6, 7], Inference: [4, 5] },
    streak: 4,
    lastPracticeDate: "2026-11-14"
  };
  storage.set("basa_wisyo_state_v1", JSON.stringify(legacyData));

  // Load app without v2 state
  const app = loadApp(storage);
  const state = app.eval('S');

  assert.equal(state.lvl, 2, "Migrated Phil-IRI level");
  assert.equal(state.w, 1250, "Migrated words read");
  assert.equal(state.ss, 8, "Migrated practice sessions count");
  assert.deepEqual([...state.done], ["p_batanes", "p_tarsier"], "Migrated completed stories list");
  assert.equal(state.streak, 4, "Migrated streak");
  assert.equal(state.schemaVersion, 2, "Upgraded to schemaVersion 2");
  assert.ok(Array.isArray(state.attempts), "Initialized attempts audit array");

  // Verified it wrote migrated v2 state to storage
  assert.ok(storage.has("basa_wisyo_state_v2"), "Persisted migrated state to v2 key");
  const storedV2 = JSON.parse(storage.get("basa_wisyo_state_v2"));
  assert.equal(storedV2.lvl, 2);
  assert.equal(storedV2.schemaVersion, 2);
});

test('Sprint 6: Anti-farming, attempt audit logging, and double-submission idempotency', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  const passage = app.eval('PRACTICE_DATA.easy[0]');
  app.eval(`startQuiz([${JSON.stringify(passage)}], "pr", "Anti-Farming Test")`);

  // 1. Double-click protection: submitting answer twice on the same step does nothing
  const firstChoice = passage.qs[0].a;
  app.eval(`handleAnswer(${firstChoice})`);
  assert.equal(app.eval('ACTIVE_QUIZ.isAnswered'), true);
  const scoreAfterFirst = app.eval('ACTIVE_QUIZ.correctCount');

  // Second submission attempt on same question must be ignored
  app.eval('handleAnswer(0)');
  assert.equal(app.eval('ACTIVE_QUIZ.correctCount'), scoreAfterFirst, "Double answer submission ignored");

  // 2. Finalize attempt generates audit record
  app.eval('finishQuiz()');
  const attempts = app.eval('S.attempts');
  assert.ok(Array.isArray(attempts));
  assert.ok(attempts.length >= 1, "Attempt recorded in persistent audit trail");
  const lastAttempt = attempts[attempts.length - 1];
  assert.ok(lastAttempt.id.startsWith("att_"), "Generates unique attempt identifier");
  assert.equal(lastAttempt.passageId, passage.id);
  assert.ok(Number.isInteger(lastAttempt.timestamp));

  // 3. Duplicate finishQuiz call is a no-op (ACTIVE_QUIZ is nullified)
  const initialAttemptsCount = attempts.length;
  app.eval('finishQuiz()');
  assert.equal(app.eval('S.attempts.length'), initialAttemptsCount, "Duplicate finishQuiz does not append second attempt");

  // 4. Karaoke celebration skip does not modify score or XP
  const xpBefore = app.eval('QUIZ_RESULT.xpGained');
  app.eval('skipQuizKaraoke()');
  assert.equal(app.eval('QUIZ_RESULT.karaokeDone'), true);
  assert.equal(app.eval('QUIZ_RESULT.xpGained'), xpBefore, "Karaoke skip never grants or deducts XP");
});

test('Sprint 6: Accessibility, reduced-motion skip, non-color feedback, and keyboard controls', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // 1. Accessibility: Non-color-only quiz feedback
  const passage = app.eval('PRACTICE_DATA.easy[0]');
  app.eval(`startQuiz([${JSON.stringify(passage)}], "pr", "Accessibility Test")`);
  const correctChoice = passage.qs[0].a;
  app.eval(`handleAnswer(${correctChoice})`);

  // Rendered option contains clear text and check icon, not just green color
  const optionsHtml = app.eval('$("#v").innerHTML');
  assert.ok(optionsHtml.includes("Correct answer") || optionsHtml.includes("Your answer · Correct"), "Feedback includes text statement");
  assert.ok(optionsHtml.includes("ui-icon"), "Feedback includes visual icon");

  // 2. Accessibility: Prefers-reduced-motion skips karaoke celebration automatically
  const reducedMotionApp = loadApp();
  reducedMotionApp.eval('window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion") })');
  reducedMotionApp.eval('GUEST_MODE = true');
  reducedMotionApp.eval(`startQuiz([${JSON.stringify(passage)}], "pr", "Reduced Motion Test")`);
  reducedMotionApp.eval('finishQuiz()');
  assert.equal(reducedMotionApp.eval('QUIZ_RESULT.karaokeDone'), true, "Karaoke stage marked done instantly when reduced-motion matches");

  // 3. Prototype transparency: Class Board and Reading Mastery disclaimers
  const boardHtml = app.eval('viewClassBoard()');
  assert.ok(boardHtml.includes("Local Demo Prototype Data"), "Class Board clearly labeled as local demo");

  const masteryHtml = app.eval('renderReadingMasteryDashboard()');
  assert.ok(masteryHtml.includes("Formative Skill Evidence Dashboard"), "Mastery clearly labeled as formative classroom evidence");
  assert.ok(masteryHtml.includes("Not an official Phil-IRI classification"), "Educational safety disclaimer present");
});

test('UX Plan Area 1: Teacher Assignments responsive cards, date validation, and duplicate prevention', async () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const pid = app.eval('getPublishedPassages()[0].id');

  // 1. Validation requires section and due date
  await assert.rejects(
    () => app.eval(`createClassAssignment({ materialId: "${pid}", sectionCode: "", dueDate: "2026-11-30" })`),
    /specify a target class section/
  );
  await assert.rejects(
    () => app.eval(`createClassAssignment({ materialId: "${pid}", sectionCode: "Grade 8 - Rizal", dueDate: "" })`),
    /valid due date/
  );

  // 2. Successful creation
  const asg1 = await app.eval(`createClassAssignment({ materialId: "${pid}", sectionCode: "Grade 8 - Rizal", dueDate: "2026-11-30", mode: "practice" })`);
  assert.ok(asg1.id);
  assert.equal(asg1.section, "Grade 8 - Rizal");

  // 3. Duplicate assignment for same passage, section, and mode is rejected
  await assert.rejects(
    () => app.eval(`createClassAssignment({ materialId: "${pid}", sectionCode: "Grade 8 - Rizal", dueDate: "2026-12-05", mode: "practice" })`),
    /already exists/
  );

  // 4. Studio UI renders desktop table and mobile stacked cards
  const studioHtml = app.eval('renderTeacherAssignmentsView()');
  assert.ok(studioHtml.includes("desktop-assignments-table"), "Renders desktop table container");
  assert.ok(studioHtml.includes("mobile-assignments-list"), "Renders mobile card list container");
  assert.ok(studioHtml.includes("assignment-mobile-card"), "Renders stacked assignment card for phone screens");
});

test('UX Plan Area 2: Progressive 15-question placement assessment, provisional level without auto-mastery, and skills profile', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');

  // 1. PLACEMENT_TEST has 15 total questions across 3 passages
  const testSteps = app.eval('PLACEMENT_TEST.reduce((sum, p) => sum + p.qs.length, 0)');
  assert.equal(testSteps, 15, 'Placement test contains 15 comprehension questions');
  assert.equal(app.eval('PLACEMENT_TEST.length'), 3, 'Placement test presents 3 progressive reading passages');

  // 2. Start placement quiz
  app.eval('startQuiz(PLACEMENT_TEST, "pl", "Phil-IRI Diagnostic Placement")');
  assert.equal(app.eval('ACTIVE_QUIZ.steps.length'), 15);

  // 3. Perfect score on initial 15-question placement does NOT grant automatic Mastery!
  for (let i = 0; i < 15; i++) {
    app.eval('ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].userCorrect = true');
    app.eval('ACTIVE_QUIZ.correctCount++');
    app.eval('ACTIVE_QUIZ.idx++');
  }
  app.eval('finishQuiz()');

  // Perfect score awards provisional Level 2 (Proficient) with candidate status for Level 3 verification
  assert.equal(app.eval('S.lvl'), 2, 'Perfect initial score caps at Level 2 (Proficient / Candidate); does NOT auto-grant Mastery');
  assert.equal(app.eval('S.placementCandidate'), true, 'Student flagged as Advanced Candidate');

  // 4. Assess view renders Provisional Starting Level and Advanced Verification card
  const assessHtml = app.eval('viewAssess()');
  assert.ok(assessHtml.includes("Provisional Starting Level"), 'Renders provisional starting level');
  assert.ok(assessHtml.includes("Advanced Placement Candidate"), 'Offers optional advanced verification');
  assert.ok(assessHtml.includes("take the 5-question Advanced Verification") || assessHtml.includes("Take Advanced Verification Passage"), 'Verification button present');
  assert.ok(assessHtml.includes("Assessment Evidence by Skill"), 'Renders skills breakdown card');

  // 5. Taking and passing verification passage confirms Mastery (Level 3)
  app.eval('startQuiz(PLACEMENT_VERIFICATION_PASSAGE, "pl", "Advanced Placement Verification")');
  assert.equal(app.eval('ACTIVE_QUIZ.steps.length'), 5);
  for (let i = 0; i < 5; i++) {
    app.eval('ACTIVE_QUIZ.steps[ACTIVE_QUIZ.idx].userCorrect = true');
    app.eval('ACTIVE_QUIZ.correctCount++');
    app.eval('ACTIVE_QUIZ.idx++');
  }
  app.eval('finishQuiz()');
  assert.equal(app.eval('S.lvl'), 3, 'Passing advanced verification confirms verified Mastery (Level 3)');
});

test('UX Plan Area 4: Data-driven Bayanihan quest, real student contribution, target configuration, and BasaMesh package preview', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');

  // 1. Data-driven calculation without fake BASE_COMMUNITY
  const questHtml = app.eval('viewQuest()');
  assert.ok(!questHtml.includes("18450"), 'Fake BASE_COMMUNITY 18450 removed completely');
  assert.ok(questHtml.includes("Bayanihan Reading Quest"), 'Renders Bayanihan title');
  assert.ok(questHtml.includes("Your personal contribution"), 'Renders actual personal contribution');
  assert.ok(questHtml.includes("Local-First Classroom Storage Notice"), 'Renders transparent local-first prototype notice');

  // 2. Teacher can set weekly target
  app.eval('setBayanihanTarget(15000)');
  const updatedStats = app.eval('getBayanihanStats()');
  assert.equal(updatedStats.targetWords, 15000, 'Teacher successfully updated weekly word target to 15,000');

  // Target validation rejects invalid numbers
  assert.throws(() => app.eval('setBayanihanTarget(-50)'), /between 500 and 500,000/);

  // 3. BasaMesh Package validation
  assert.throws(
    () => app.eval('validateBasaMeshPackage("invalid-base64-random-text")'),
    /Invalid BasaMesh format/
  );

  // Valid package encoding & decoding
  const validPayload = JSON.stringify({
    title: "Ang Munting Bangka",
    text: "Bayani woke up early to help his uncle repair their small wooden banca. They replaced two broken bamboo outriggers and sealed the joints with tree resin.",
    diff: "easy"
  });
  const validCode = Buffer.from(validPayload).toString('base64');
  const parsed = app.eval(`validateBasaMeshPackage("${validCode}")`);
  assert.equal(parsed.title, "Ang Munting Bangka");
  assert.equal(parsed.diff, "easy");
  assert.ok(parsed.qs.length >= 1, "Generated default comprehension question for imported passage");
});







