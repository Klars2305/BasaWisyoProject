import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

test('Phase 3: Question stage renders inline passage text evidence review accordion without losing answer state', () => {
  const quizCode = readFileSync(join(root, 'src/services/quiz.js'), 'utf8');
  let renderedHtml = '';
  const elementMock = {
    set innerHTML(val) { renderedHtml = val; },
    get innerHTML() { return renderedHtml; },
    focus: () => {},
    querySelector: () => null,
    getBoundingClientRect: () => ({ top: 0 })
  };

  const context = vm.createContext({
    ACTIVE_QUIZ: null,
    QUIZ_RESULT: null,
    SPEECH_PASSAGE_ACTIVE: false,
    SPEECH_SETTINGS: { rate: 1, follow: true },
    uiIcon: name => `[icon:${name}]`,
    escapeHTML: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    tapMarkup: s => `<span class="tapped">${s}</span>`,
    refreshSpeechControls: () => {},
    stopSpeech: () => {},
    renderQuizAnswerFeedback: () => {},
    $: () => elementMock,
    $$: () => [],
    console
  });

  vm.runInContext(quizCode, context);

  // Setup active quiz in question stage
  const sampleSteps = [
    { P: { id: 'p1', t: 'Ang Munting Bangka', diff: 'easy', x: 'Nakakita si Ana ng munting bangka sa tabing-ilog.' }, q: { q: 'Asan ang bangka?', o: ['Sa ilog', 'Sa bundok'], a: 0, k: 'Literal' } }
  ];
  vm.runInContext(`
    ACTIVE_QUIZ = {
      title: 'Practice: Ang Munting Bangka',
      mode: 'pr',
      steps: ${JSON.stringify(sampleSteps)},
      idx: 0,
      stage: 'question',
      isAnswered: false,
      selectedChoice: null,
      hearts: 4,
      maxHearts: 4
    };
    renderQuiz();
  `, context);

  // Verifications
  assert.ok(renderedHtml.includes('quiz-passage-peek'), 'Includes inline passage review details accordion');
  assert.ok(renderedHtml.includes('Review Passage Text Evidence'), 'Provides clear learner affordance to check passage clues');
  assert.ok(renderedHtml.includes('quiz-show-passage'), 'Provides full-screen switch option');
  assert.ok(renderedHtml.includes('Nakakita si Ana ng munting bangka'), 'Passage text evidence is available inside peek drawer');
});

test('Phase 3: Student Home Dashboard prioritizes Continue Reading and displays Daily Streak', () => {
  const homeCode = readFileSync(join(root, 'src/pages/home.js'), 'utf8');
  const context = vm.createContext({
    AUTH: {
      currentUser: { id: 'stud_1', name: 'Juan', role: 'student' },
      users: [],
      assignments: []
    },
    PHIL_IRI_LEVELS: ['Frustration', 'Instructional', 'Independent', 'Mastery'],
    DIFF_KEYS: ['easy', 'medium', 'hard', 'extreme'],
    getPublishedPassages: () => [
      { id: 'p1', t: 'Story 1', diff: 'easy' },
      { id: 'p2', t: 'Story 2', diff: 'medium' }
    ],
    journeySummary: () => ({ tier: 1 }),
    uiIcon: name => `[icon:${name}]`,
    escapeHTML: s => String(s),
    viewJourneyPanel: () => '<div class="journey-panel"></div>',
    S: { lvl: 1, ss: 5, w: 1250, streak: 3 },
    console
  });

  vm.runInContext(homeCode, context);
  const html = vm.runInContext('viewHome()', context);

  // Assessed student has Continue Reading CTA
  assert.ok(html.includes('Continue Reading →'), 'Prioritizes Continue Reading for active learners');
  // Daily Reading Streak is prominently rendered
  assert.ok(html.includes('Daily Reading Streak'), 'Displays daily reading streak in stat bar');
  assert.ok(html.includes('🔥 3 Days'), 'Shows streak count and flame emoji');

  // Unassessed student has Placement Required CTA
  context.S.lvl = null;
  const unassessedHtml = vm.runInContext('viewHome()', context);
  assert.ok(unassessedHtml.includes('Start Placement Test'), 'Directs unassessed students to placement');
});

test('Phase 3: Reduced motion CSS rules cover all quiz feedback and celebration elements', () => {
  const css = readFileSync(join(root, 'src/styles/visual-system.css'), 'utf8');
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('.answer-correct-pop'));
  assert.ok(css.includes('.answer-wrong-shake'));
  assert.ok(css.includes('.karaoke-stage'));
  assert.ok(css.includes('animation: none !important'));
});
