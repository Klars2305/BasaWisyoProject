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
  'src/services/journey.js',
  'src/services/board.js',
  'src/utils/reading.js',
  'src/components/navigation.js',
  'src/pages/home.js',
  'src/pages/practice.js',
  'src/pages/profile.js',
  'src/pages/board.js',
  'src/pages/reports.js',
  'src/pages/practice.js',
  'src/services/quiz.js',
  'src/services/practice-helper.js',
  'src/services/backup.js',
  'src/app.js',
  'src/services/exports.js',
];

function loadApp(storage = new Map(), { confirmResult = true, locationHash = '' } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const alerts = [];
  const toasts = [];
  let prints = 0;
  let exportedJson = null;
  let failNextKey = null;
  let failNextRemoveKey = null;
  elements.set('#md', { addEventListener() {} });
  elements.set('#ai', { addEventListener() {} });
  elements.set('#auth-modal', { hidden: true, addEventListener() {} });
  elements.set('#role-card-student', { click() {} });

  const document = {
    querySelector: selector => elements.get(selector) ?? null,
    querySelectorAll: selector => elements.get(selector) ?? [],
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    createElement: () => ({ click() {} }),
    body: { appendChild() {}, removeChild() {} },
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) {
      if (key === failNextKey) {
        failNextKey = null;
        throw new Error('simulated storage failure');
      }
      storage.set(key, value);
    },
    removeItem(key) {
      if (key === failNextRemoveKey) {
        failNextRemoveKey = null;
        throw new Error('simulated removal failure');
      }
      storage.delete(key);
    },
  };
  class FileReader {
    readAsText(file) {
      if (file.fail) { this.onerror(); return; }
      this.onload({ target: { result: file.text } });
    }
  }
  class Blob {
    constructor(parts) { this.text = parts.join(''); }
  }

  const context = vm.createContext({
    document,
    localStorage,
    FileReader,
    Blob,
    URL: {
      createObjectURL(blob) { exportedJson = blob.text; return 'blob:test'; },
      revokeObjectURL() {},
    },
    renderApp() {},
    showToast(message, kind) { toasts.push({ message, kind }); },
    alert(message) { alerts.push(message); },
    confirm: () => confirmResult,
    window: {
      location: {
        hash: locationHash, pathname: '/index.html', search: '', assigned: null, replaced: null,
        assign(url) { this.assigned = url; },
        replace(url) { this.replaced = url; },
      },
      history: { replaceState() {} },
      print() { prints++; },
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
    alerts,
    toasts,
    prints: () => prints,
    failNextWrite(key) { failNextKey = key; },
    failNextRemove(key) { failNextRemoveKey = key; },
    eval: expression => vm.runInContext(expression, context),
    element(selector, value) { elements.set(selector, value); },
    click(action, value) {
      const event = { target: { closest: () => ({ dataset: { a: action, v: value } }) } };
      for (const listener of listeners.get('click') ?? []) listener(event);
    },
    change(target) {
      for (const listener of listeners.get('change') ?? []) listener({ target });
    },
    input(target) {
      for (const listener of listeners.get('input') ?? []) listener({ target });
    },
    submit(target) {
      for (const listener of listeners.get('submit') ?? []) {
        listener({ target, preventDefault() {} });
      }
    },
    exportedJson: () => exportedJson,
  };
}

function exportedBackup(app) {
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  app.click('admin-export-backup');
  return JSON.parse(app.exportedJson());
}

function restorePayload(app, payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  app.change({ id: 'admin-restore-file', files: [{ text }], value: 'selected' });
}

function mockQuestionCard({ q, o, a = 0, k = 'Literal' }) {
  const fields = new Map([
    ['[data-field="prompt"]', { value: q }],
    ['[data-field="answer"]', { value: String(a) }],
    ['[data-field="skill"]', { value: k }],
    ...Array.from({ length: Math.max(4, o.length) }, (_, index) =>
      [`[data-field="option-${index}"]`, { value: o[index] ?? '' }]),
  ]);
  return { querySelector: selector => fields.get(selector) };
}

function saveAdminPassage(app, title = 'Regression Passage') {
  app.eval('AUTH.currentUser = AUTH.users.find(user => user.role === "admin")');
  const fields = {
    '#pass-title': title,
    '#pass-diff': 'easy',
    '#pass-text': 'A learner reads a short passage.',
  };
  for (const [selector, value] of Object.entries(fields)) {
    app.element(selector, { value });
  }
  app.element('#practice-question-count', { value: '1' });
  app.element('.practice-question-card', [mockQuestionCard({
    q: 'Who reads?', o: ['A learner', 'A teacher', 'A parent', 'A friend']
  })]);
  app.element('#admin-passage-modal', { hidden: false });
  app.click('practice-admin-save');
  assert.equal(app.eval('AUTH.customPassages.length'), 1);
}

test('control: a built-in passage renders and starts a quiz', () => {
  const app = loadApp();
  assert.equal(app.eval('getPublishedPassages().length'), 24);
  assert.ok(app.eval('viewPractice()').includes('Tala and the Morning Catch'));
  assert.doesNotThrow(() => app.eval(
    'startQuiz([PRACTICE_DATA.easy[0]], "pr", "Built-in Passage")',
  ));
  assert.equal(app.eval('ACTIVE_QUIZ.steps.length'), 2);
});

test('BW-006: an admin-created passage runs through the reader quiz contract', () => {
  const app = loadApp();
  saveAdminPassage(app);
  assert.doesNotThrow(() => app.eval(
    'startQuiz([AUTH.customPassages[0]], "pr", "Regression Passage")',
  ));
  assert.equal(app.eval('ACTIVE_QUIZ.steps.length'), 1);
  assert.equal(app.eval('AUTH.customPassages[0].diff'), 'easy');
  assert.equal(app.eval('AUTH.customPassages[0].qs[0].k'), 'Literal');
  app.element('#quiz-feedback', { innerHTML: '' });
  app.eval('handleAnswer(0); handleQuizNext()');
  assert.equal(app.eval('S.ss'), 1);
  assert.equal(app.eval('S.done.includes(AUTH.customPassages[0].id)'), true);
  assert.equal(app.eval('S.w'), 6);
});

test('BW-007: an admin-created passage appears in the reading library', () => {
  const app = loadApp();
  saveAdminPassage(app);
  assert.ok(
    app.eval('viewPractice()').includes('Regression Passage'),
    'saved admin passage is missing from the reading library',
  );
  const reloaded = loadApp(app.storage);
  assert.ok(reloaded.eval('viewPractice()').includes('Regression Passage'));
});

test('legacy admin fields normalize without rewriting stored records', () => {
  const app = loadApp();
  app.eval(`AUTH.customPassages.push({
    id: 'cust_legacy', t: 'Legacy Passage', tier: 'hard', x: 'Legacy body.',
    q: [{ q: 'What is this?', o: ['A passage', 'A note'], a: 0, skill: 'Literal' }]
  })`);
  assert.equal(app.eval("getPublishedPassageById('cust_legacy').diff"), 'hard');
  assert.equal(app.eval("getPublishedPassageById('cust_legacy').qs[0].k"), 'Literal');
  assert.equal(app.eval('AUTH.customPassages[0].diff'), undefined);
});

test('draft and invalid custom records stay out of the published collection', () => {
  const app = loadApp();
  app.eval('AUTH.currentUser = AUTH.users.find(user => user.role === "admin")');
  app.eval(`AUTH.customPassages.push({
    id: 'cust_draft', t: 'Draft Passage', diff: 'easy', x: 'Draft body.',
    qs: [{ q: 'Question?', o: ['Yes', 'No'], a: 0, k: 'Literal' }],
    status: 'draft'
  })`);
  assert.equal(app.eval("getPublishedPassageById('cust_draft')"), undefined);
  assert.throws(() => app.eval(`AUTH.addCustomPassage({
    t: 'Invalid Passage', diff: 'easy', x: 'Body.',
    qs: [{ q: 'Question?', o: ['Yes', 'No'], a: 3, k: 'Literal' }]
  })`), /valid correct-answer option/);
  assert.equal(app.eval('AUTH.customPassages.length'), 1);
});

test('practice language is retained for narration and invalid locales are rejected', () => {
  const app = loadApp();
  const base = `{
    id: 'language_test', t: 'Ang Bangka', diff: 'easy', x: 'Ang bangka ay maliit.',
    qs: [{ q: 'Ano ito?', o: ['Bangka', 'Bahay'], a: 0, k: 'Literal' }],
    lang: 'fil-PH'
  }`;
  assert.equal(app.eval(`normalizePassage(${base}).lang`), 'fil-PH');
  assert.throws(() => app.eval(`normalizePassage({ ...${base}, lang: 'wrong' })`), /passage language/);
});

test('teacher assignment choices include the published admin passage', () => {
  const app = loadApp();
  saveAdminPassage(app);
  app.eval('AUTH.currentUser = AUTH.users.find(user => user.role === "teacher")');
  const id = app.eval('AUTH.customPassages[0].id');
  assert.ok(app.eval('viewTeacher()').includes(`<option value="${id}">Regression Passage</option>`));
});

test('teacher submission stays private until admin approval, then becomes assignable', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const id = app.eval(`AUTH.savePractice({
    t: 'Our Garden', diff: 'easy', x: 'Students plant seeds in the school garden.',
    qs: [{ q: 'What did they plant?', o: ['Seeds', 'Rocks'], a: 0, k: 'Literal' }]
  }, { submit: true }).id`);
  assert.equal(app.eval(`AUTH.customPassages.find(p => p.id === ${JSON.stringify(id)}).status`), 'pending');
  assert.equal(app.eval(`getPublishedPassageById(${JSON.stringify(id)})`), undefined);
  assert.ok(app.eval('viewTeacher()').includes('Our Garden'));
  assert.ok(app.eval('viewTeacher()').includes('data-a="practice-new"'));
  assert.throws(() => app.eval(`AUTH.createAssignment(${JSON.stringify(id)}, 'Our Garden')`), /approved published/);

  const reloaded = loadApp(app.storage);
  assert.equal(reloaded.eval(`AUTH.customPassages.find(p => p.id === ${JSON.stringify(id)}).status`), 'pending');
  reloaded.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.ok(reloaded.eval('renderAdminCurriculumTab()').includes(`data-a="practice-approve" data-v="${id}"`));
  reloaded.click('practice-approve', id);
  assert.equal(reloaded.eval(`AUTH.customPassages.find(p => p.id === ${JSON.stringify(id)}).status`), 'published');
  assert.ok(reloaded.eval('viewPractice()').includes('Our Garden'));
  reloaded.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.ok(reloaded.eval('viewTeacher()').includes(`<option value="${id}">Our Garden</option>`));
  const assignmentId = reloaded.eval(`AUTH.createAssignment(${JSON.stringify(id)}, 'Our Garden').id`);
  reloaded.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.throws(() => reloaded.eval(`AUTH.setPracticePublished(${JSON.stringify(id)}, false)`), /Remove this practice/);
  assert.equal(reloaded.eval(`AUTH.removePracticeAssignments(${JSON.stringify(id)})`), 1);
  assert.equal(reloaded.eval(`AUTH.assignments.some(a => a.id === ${JSON.stringify(assignmentId)})`), false);
  reloaded.eval(`AUTH.setPracticePublished(${JSON.stringify(id)}, false)`);
  assert.equal(reloaded.eval(`getPublishedPassageById(${JSON.stringify(id)})`), undefined);
});

test('review, editing, withdrawal, and deletion enforce teacher ownership', () => {
  const app = loadApp();
  const input = `{
    t: 'River Cleanup', diff: 'medium', x: 'The class cleaned the river bank.',
    qs: [{ q: 'What did the class clean?', o: ['River bank', 'School hall'], a: 0, k: 'Literal' }]
  }`;
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const id = app.eval(`AUTH.savePractice(${input}, { submit: true }).id`);
  assert.throws(() => app.eval(`AUTH.reviewPractice(${JSON.stringify(id)}, 'approve')`), /Only an admin/);
  assert.throws(() => app.eval(`AUTH.savePractice(${input}, { id: ${JSON.stringify(id)}, submit: true })`), /Withdraw a pending/);
  app.eval(`AUTH.withdrawPractice(${JSON.stringify(id)})`);
  assert.equal(app.eval(`AUTH.customPassages[0].status`), 'draft');
  app.eval(`AUTH.savePractice(${input}, { id: ${JSON.stringify(id)}, submit: true })`);

  app.eval(`AUTH.users.push({ ...AUTH.currentUser, id: 'other_teacher', email: 'other@school.test' }); AUTH.currentUser = AUTH.users.at(-1)`);
  assert.throws(() => app.eval(`AUTH.withdrawPractice(${JSON.stringify(id)})`), /own pending/);
  assert.throws(() => app.eval(`AUTH.deletePractice(${JSON.stringify(id)})`), /own draft or rejected/);

  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.throws(() => app.eval(`AUTH.reviewPractice(${JSON.stringify(id)}, 'reject', '')`), /reason/);
  app.eval(`AUTH.reviewPractice(${JSON.stringify(id)}, 'reject', 'Clarify the answer choices.')`);
  assert.equal(app.eval('AUTH.customPassages[0].status'), 'rejected');
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.ok(app.eval('viewTeacher()').includes('Clarify the answer choices.'));
  app.eval(`AUTH.savePractice(${input}, { id: ${JSON.stringify(id)}, submit: true })`);
  assert.equal(app.eval('AUTH.customPassages[0].reviewNote'), undefined);
});

test('practice storage failure leaves the review queue unchanged', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  app.failNextWrite('basa_wisyo_custom_passages_v2');
  assert.throws(() => app.eval(`AUTH.savePractice({
    t: 'Failed Save', diff: 'easy', x: 'A short passage.',
    qs: [{ q: 'What is this?', o: ['Passage', 'Poem'], a: 0, k: 'Literal' }]
  }, { submit: true })`), /could not be saved/);
  assert.equal(app.eval('AUTH.customPassages.length'), 0);
  assert.equal(app.storage.get('basa_wisyo_custom_passages_v2'), undefined);
});

test('teacher editor submits a practice for admin review', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const fields = new Map();
  for (const selector of [
    '#pass-title', '#pass-diff', '#pass-text'
  ]) {
    const field = { value: '', focus() {} };
    fields.set(selector, field);
    app.element(selector, field);
  }
  const modal = { hidden: true };
  app.element('#admin-passage-modal', modal);
  app.element('#passage-modal-title', { textContent: '' });
  app.element('#passage-modal-hint', { textContent: '' });
  app.element('#practice-question-count', { value: '1' });
  app.element('#passage-questions', { innerHTML: '' });
  app.element('#practice-wisyo-status', { textContent: '' });
  app.element('#practice-save-draft', { hidden: true });
  app.element('#practice-submit', { hidden: true });
  app.element('#practice-admin-save', { hidden: true, textContent: '' });

  app.click('practice-new');
  assert.equal(modal.hidden, false);
  fields.get('#pass-title').value = 'Market Morning';
  fields.get('#pass-diff').value = 'easy';
  fields.get('#pass-text').value = 'The learners visited a morning market.';
  app.element('.practice-question-card', [mockQuestionCard({
    q: 'Where did the learners go?', o: ['Market', 'River']
  })]);
  app.click('practice-submit');
  assert.equal(modal.hidden, true);
  assert.equal(app.eval('AUTH.customPassages[0].status'), 'pending');
  assert.equal(app.eval('AUTH.customPassages[0].ownerId'), 'usr_teach_1');
});

test('question editor saves and reopens every selected question', () => {
  const app = loadApp();
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  for (const selector of ['#pass-title', '#pass-diff', '#pass-text']) {
    app.element(selector, { value: '', focus() {} });
  }
  const count = { value: '1' };
  const questionContainer = { innerHTML: '' };
  app.element('#practice-question-count', count);
  app.element('#passage-questions', questionContainer);
  app.element('#practice-wisyo-status', { textContent: '' });
  app.element('#admin-passage-modal', { hidden: true });
  app.element('#passage-modal-title', { textContent: '' });
  app.element('#passage-modal-hint', { textContent: '' });
  app.element('#practice-save-draft', { hidden: true });
  app.element('#practice-submit', { hidden: true });
  app.element('#practice-admin-save', { hidden: true, textContent: '' });
  app.click('practice-new');
  count.value = '3';
  app.change({ id: 'practice-question-count', value: '3' });
  assert.match(questionContainer.innerHTML, /Question 3/);
  app.element('#pass-title', { value: 'Three Questions', focus() {} });
  app.element('#pass-diff', { value: 'easy' });
  app.element('#pass-text', { value: 'The class read near the river.' });
  app.element('.practice-question-card', [
    mockQuestionCard({ q: 'Who read?', o: ['Class', 'Birds'] }),
    mockQuestionCard({ q: 'Where did they read?', o: ['River', 'Market'] }),
    mockQuestionCard({ q: 'What did they do?', o: ['Read', 'Swim'] }),
  ]);
  app.click('practice-admin-save');
  assert.equal(app.eval('AUTH.customPassages[0].qs.length'), 3);
  const id = app.eval('AUTH.customPassages[0].id');
  app.click('practice-edit', id);
  assert.equal(count.value, '3');
  assert.match(questionContainer.innerHTML, /Where did they read\?/);
  assert.match(questionContainer.innerHTML, /What did they do\?/);
  app.element('.practice-question-card', [
    mockQuestionCard({ q: 'Who read?', o: ['Class', 'Birds', 'Parents', 'Teachers', 'Fish'], a: 4 }),
    mockQuestionCard({ q: 'Where did they read?', o: ['River', 'Market'] }),
    mockQuestionCard({ q: 'What did they do?', o: ['Read', 'Swim'] }),
  ]);
  app.click('practice-admin-save');
  assert.equal(app.eval('AUTH.customPassages[0].qs[0].o.length'), 5);
  assert.equal(app.eval('AUTH.customPassages[0].qs[0].a'), 4);
  app.click('practice-edit', id);
  assert.match(questionContainer.innerHTML, /Option 5/);
});

test('question slider shows one card at a time and reaches invalid questions', () => {
  const app = loadApp();
  const cards = [
    mockQuestionCard({ q: 'First?', o: ['Yes', 'No'] }),
    mockQuestionCard({ q: 'Second?', o: ['Yes', 'No'] }),
    mockQuestionCard({ q: '', o: ['', ''] }),
  ];
  app.element('.practice-question-card', cards);
  app.element('#passage-questions', { innerHTML: '' });
  app.element('#practice-question-count', { value: '3' });
  const position = { textContent: '' };
  const slider = { value: '1', max: '1' };
  const previous = { disabled: false };
  const next = { disabled: false };
  app.element('#practice-question-position', position);
  app.element('#practice-question-slider', slider);
  app.element('#practice-question-prev', previous);
  app.element('#practice-question-next', next);
  app.eval('renderPracticeQuestionCards([{}, {}, {}])');
  assert.deepEqual(cards.map(card => card.hidden), [false, true, true]);
  assert.equal(previous.disabled, true);
  app.click('practice-question-next');
  assert.deepEqual(cards.map(card => card.hidden), [true, false, true]);
  assert.equal(position.textContent, 'Question 2 of 3');
  slider.value = '3';
  app.input({ id: 'practice-question-slider', value: '3' });
  assert.deepEqual(cards.map(card => card.hidden), [true, true, false]);
  assert.equal(next.disabled, true);
  app.click('practice-question-prev');
  assert.throws(() => app.eval('validatedPracticeQuestions()'), /Complete question 3/);
  assert.deepEqual(cards.map(card => card.hidden), [true, true, false]);
});

test('Wisyo offline helper drafts editable questions with valid answer keys', async () => {
  const app = loadApp();
  const result = await app.eval(`wisyoPracticeSuggestions(
    'Munting bangka ang ginamit ni Maria. Dinala niya ang pagkain sa paaralan. Masayang sinalubong siya ng guro.',
    3, 'easy')`);
  assert.equal(result.source, 'offline text helper');
  assert.equal(result.questions.length, 3);
  for (const question of result.questions) {
    assert.equal(question.o.length, 4);
    assert.ok(question.o[question.a]);
    assert.match(question.q, /____/);
  }
  await assert.rejects(app.eval("wisyoPracticeSuggestions('Maikling teksto.', 5, 'easy')"), /more varied passage text/);
});

test('backup preserves a pending practice and its review metadata', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const id = app.eval(`AUTH.savePractice({
    t: 'Coastal Cleanup', diff: 'easy', x: 'The class gathered litter on the shore.',
    qs: [{ q: 'What did the class gather?', o: ['Litter', 'Shells'], a: 0, k: 'Literal' }]
  }, { submit: true }).id`);
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  const backup = exportedBackup(app);
  assert.equal(backup.customPassages[0].status, 'pending');
  app.eval('AUTH.customPassages = []');
  restorePayload(app, backup);
  assert.equal(app.eval('AUTH.customPassages[0].status'), 'pending');
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  app.eval(`AUTH.reviewPractice(${JSON.stringify(id)}, 'reject', 'Add a clearer answer.')`);
  assert.equal(app.eval('AUTH.customPassages[0].reviewNote'), 'Add a clearer answer.');
});

test('custom passage text is escaped in library and quiz markup', () => {
  const app = loadApp();
  saveAdminPassage(app, '<img src=x onerror=alert(1)>');
  const library = app.eval('viewPractice()');
  assert.ok(library.includes('&lt;img src=x onerror=alert(1)&gt;'));
  const output = { innerHTML: '' };
  app.element('#v', output);
  app.eval('startQuiz([AUTH.customPassages[0]], "pr", AUTH.customPassages[0].t)');
  app.eval('renderQuiz()');
  assert.ok(output.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!output.innerHTML.includes('<img src=x onerror=alert(1)>'));
});

test('separate login page rejects bad credentials and redirects after sign-in', () => {
  const storage = new Map();
  const listeners = new Map();
  const field = value => ({ value, type: 'text', addEventListener(type, callback) { listeners.set(`${this.id}:${type}`, callback); } });
  const email = { ...field('teacher@basawisyo.ph'), id: 'email' };
  const password = { ...field('incorrect'), id: 'password' };
  const error = { textContent: '', hidden: true };
  const toggle = { id: 'toggle', ...field(''), setAttribute() {} };
  const form = { id: 'form', ...field('') };
  const elements = new Map([
    ['#entry-login-form', form], ['#entry-email', email],
    ['#entry-password', password], ['#entry-error', error],
    ['#entry-toggle-password', toggle],
  ]);
  const destination = { url: null };
  const context = vm.createContext({
    document: { querySelector: selector => elements.get(selector) },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    window: { location: { replace(url) { destination.url = url; } } },
  });
  for (const relative of ['src/services/state.js', 'src/services/auth.js', 'src/pages/login.js']) {
    vm.runInContext(readFileSync(join(appRoot, relative), 'utf8'), context, { filename: relative });
  }

  listeners.get('form:submit')({ preventDefault() {} });
  assert.equal(error.textContent, 'Invalid email or password.');
  assert.equal(destination.url, null);

  password.value = 'teacher123';
  listeners.get('form:submit')({ preventDefault() {} });
  assert.equal(destination.url, 'index.html');
  assert.equal(JSON.parse(storage.get('basa_wisyo_session_v2')).role, 'teacher');
  assert.equal(password.value, '');
});

test('fresh visits show the landing page and returning students open Student Home', () => {
  const storage = new Map();
  const firstVisit = loadApp(storage);
  assert.equal(firstVisit.eval('AUTH.currentUser'), null);
  assert.equal(firstVisit.eval('GUEST_MODE'), false);

  assert.equal(firstVisit.eval('AUTH.login("student@basawisyo.ph", "student123").success'), true);
  const returningVisit = loadApp(storage);
  assert.equal(returningVisit.eval('AUTH.currentUser.role'), 'student');
  assert.equal(returningVisit.eval('CURRENT_TAB'), 'home');
  assert.equal(returningVisit.eval('GUEST_MODE'), false);
});

test('teacher and admin reloads restore their own dashboard', () => {
  for (const [email, password, tab] of [
    ['teacher@basawisyo.ph', 'teacher123', 'teacher'],
    ['admin@basawisyo.ph', 'admin123', 'admin'],
  ]) {
    const storage = new Map();
    const firstVisit = loadApp(storage);
    assert.equal(firstVisit.eval(`AUTH.login(${JSON.stringify(email)}, ${JSON.stringify(password)}).success`), true);
    const returningVisit = loadApp(storage);
    assert.equal(returningVisit.eval('AUTH.currentUser.role'), tab);
    assert.equal(returningVisit.eval('CURRENT_TAB'), tab);
    assert.equal(returningVisit.eval('GUEST_MODE'), false);
    assert.equal(storage.has('basa_wisyo_session_v2'), true);
  }
});

test('a suspended session returns to the public landing page', () => {
  const storage = new Map();
  const firstVisit = loadApp(storage);
  assert.equal(firstVisit.eval('AUTH.login("teacher@basawisyo.ph", "teacher123").success'), true);
  firstVisit.eval('AUTH.currentUser.status = "suspended"; AUTH.saveUsers()');

  const returningVisit = loadApp(storage);
  assert.equal(returningVisit.eval('AUTH.currentUser'), null);
  assert.equal(returningVisit.eval('GUEST_MODE'), false);
  assert.equal(storage.has('basa_wisyo_session_v2'), false);
});

test('public entry links to a separate login page and keeps registration', () => {
  const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
  const loginHtml = readFileSync(join(appRoot, 'login.html'), 'utf8');
  const guestAction = html.match(/<button\b[^>]*data-a="entry-guest"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  const signInAction = html.match(/<a\b[^>]*href="login.html"[^>]*>([\s\S]*?)<\/a>/)?.[1];
  const registerAction = html.match(/<button\b[^>]*data-a="auth-open"[^>]*data-v="register"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  assert.match(guestAction || '', /Explore as guest/);
  assert.match(signInAction || '', /Sign in/);
  assert.match(registerAction || '', /Create an account/);
  assert.match(html, /name="reg-role" value="student" checked/);
  assert.match(html, /name="reg-role" value="teacher"/);
  assert.ok(!html.includes('id="entry-login-form"'));
  assert.ok(!html.includes('id="form-login"'));
  assert.ok(!html.includes('id="role-card-admin"'));
  assert.ok(!html.includes('id="reg-admin-key"'));
  assert.match(loginHtml, /id="entry-login-form"/);
  assert.match(loginHtml, /href="index.html#register"/);
});

test('public registration creates teacher accounts with distinct classroom codes but never admin accounts', () => {
  const app = loadApp();
  const before = app.eval('AUTH.users.length');
  app.eval('Math.random = () => 0');
  assert.equal(app.eval(`AUTH.register({
    name: 'New Teacher', email: 'newteacher@school.test', password: 'test123', role: 'teacher',
    section: 'Grade 7 - Luna'
  }).success`), true);
  assert.equal(app.eval(`AUTH.register({
    name: 'Second Teacher', email: 'secondteacher@school.test', password: 'test123', role: 'teacher',
    section: 'Grade 8 - Rizal'
  }).success`), true);
  assert.equal(app.eval('AUTH.users.at(-2).shareCode'), 'BASA-TEACH-1000');
  assert.equal(app.eval('AUTH.users.at(-1).shareCode'), 'BASA-TEACH-1001');
  assert.equal(app.eval('AUTH.users.at(-1).section'), 'Grade 8 - Rizal');
  assert.equal(app.eval('AUTH.users.at(-1).lvl'), null);
  assert.equal(app.eval('AUTH.users.at(-1).id !== AUTH.users.at(-2).id'), true);
  assert.equal(app.eval(`AUTH.register({
    name: 'New Admin', email: 'newadmin@school.test', password: 'test123', role: 'admin'
  }).success`), false);
  assert.equal(app.eval('AUTH.users.length'), before + 2);
  assert.equal(loadApp(app.storage).eval('AUTH.users.at(-1).role'), 'teacher');
});

test('teacher registration needs a section and student share codes link to that section', () => {
  const app = loadApp();
  const before = app.eval('AUTH.users.length');
  assert.equal(app.eval(`AUTH.register({
    name: 'No Section', email: 'nosection@school.test', password: 'test123', role: 'teacher'
  }).success`), false);
  assert.equal(app.eval('AUTH.users.length'), before);
  const student = app.eval(`AUTH.register({
    name: 'New Student', email: 'newstudent@school.test', password: 'test123', role: 'student',
    teacherCode: 'basa-teach-8492'
  })`);
  assert.equal(student.success, true);
  assert.equal(student.user.teacherCode, 'BASA-TEACH-8492');
  assert.equal(student.user.section, 'Grade 8 - Emerald');
  assert.equal(app.eval(`AUTH.register({
    name: 'Bad Code', email: 'badcode@school.test', password: 'test123', role: 'student',
    teacherCode: 'BASA-TEACH-9999'
  }).success`), false);
});

test('registration form switches fields and creates the chosen teacher role', () => {
  const app = loadApp();
  const studentFields = { hidden: false };
  const teacherFields = { hidden: true };
  const button = { textContent: '' };
  app.element('input[name="reg-role"]:checked', { value: 'teacher' });
  app.element('#reg-group-student', studentFields);
  app.element('#reg-group-teacher', teacherFields);
  app.element('#reg-submit', button);
  app.change({ name: 'reg-role' });
  assert.equal(studentFields.hidden, true);
  assert.equal(teacherFields.hidden, false);
  assert.equal(button.textContent, 'Create Teacher Account');
  for (const [selector, value] of Object.entries({
    '#reg-name': 'Guro Lea', '#reg-email': 'lea@school.test', '#reg-password': 'test123',
    '#reg-section': 'Grade 9 - Sampaguita', '#reg-teacher-code': 'SHOULD-NOT-COPY'
  })) app.element(selector, { value });
  app.click('auth-register-submit');
  assert.equal(app.eval('AUTH.currentUser.role'), 'teacher');
  assert.equal(app.eval('AUTH.currentUser.teacherCode'), '');
  assert.equal(app.eval('CURRENT_TAB'), 'teacher');
});

test('registration reports storage failure without claiming an unsaved account', () => {
  const app = loadApp();
  const before = app.eval('AUTH.users.length');
  app.failNextWrite('basa_wisyo_users_v2');
  const result = app.eval(`AUTH.register({
    name: 'Storage Test', email: 'storage@school.test', password: 'test123', role: 'teacher',
    section: 'Grade 7 - Test'
  })`);
  assert.equal(result.success, false);
  assert.match(result.message, /could not be saved/);
  assert.equal(app.eval('AUTH.users.length'), before);
  assert.equal(app.eval('AUTH.currentUser'), null);
  app.failNextWrite('basa_wisyo_session_v2');
  const sessionResult = app.eval(`AUTH.register({
    name: 'Saved Teacher', email: 'saved@school.test', password: 'test123', role: 'teacher',
    section: 'Grade 7 - Test'
  })`);
  assert.equal(sessionResult.success, false);
  assert.match(sessionResult.message, /Account created, but automatic sign-in failed/);
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(loadApp(app.storage).eval('AUTH.users.at(-1).email'), 'saved@school.test');
});

test('new teacher and student names render safely in role dashboards', () => {
  const app = loadApp();
  const teacher = app.eval(`AUTH.register({
    name: '<img src=x onerror=alert(1)>', email: 'safe@school.test',
    password: 'test123', role: 'teacher', section: '<b>Grade 7</b>'
  })`);
  assert.equal(teacher.success, true);
  assert.match(app.eval('viewTeacher()'), /&lt;b&gt;Grade 7&lt;\/b&gt;/);
  assert.match(app.eval('viewHome()'), /&lt;b&gt;Grade 7&lt;\/b&gt;/);
  assert.ok(!app.eval('viewTeacher()').includes('<b>Grade 7</b>'));
  app.eval(`AUTH.register({
    name: '<svg onload=alert(1)>', email: 'safestudent@school.test', password: 'test123',
    role: 'student', teacherCode: AUTH.users.at(-1).shareCode
  })`);
  assert.match(app.eval('viewHome()'), /&lt;img src=x onerror=alert\(1\)&gt;/);
  app.eval('AUTH.login("safe@school.test", "test123")');
  assert.match(app.eval('viewTeacher()'), /&lt;svg onload=alert\(1\)&gt;/);
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.match(app.eval('viewAdmin()'), /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('a guest cannot invoke admin account controls through a forged UI action', () => {
  const app = loadApp();
  app.click('admin-edit-role', 'usr_stud_1');
  assert.equal(app.eval('AUTH.users.find(user => user.id === "usr_stud_1").role'), 'student');
  app.click('admin-export-backup');
  assert.equal(app.exportedJson(), null);
});

test('registration link from login page opens registration on the public page', () => {
  const app = loadApp(new Map(), { locationHash: '#register' });
  assert.equal(app.eval('$("#auth-modal").hidden'), false);
  assert.equal(app.eval('AUTH.currentUser'), null);
});

test('guest entry is explicit and account sign-out returns to index.html', () => {
  const app = loadApp();
  app.click('entry-guest');
  assert.equal(app.eval('GUEST_MODE'), true);
  assert.equal(app.eval('AUTH.currentUser'), null);
  app.click('auth-open');
  assert.equal(app.eval('window.location.assigned'), 'login.html');

  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.element('#auth-modal', { hidden: true });
  app.click('auth-open');
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(app.eval('GUEST_MODE'), false);
  assert.equal(app.eval('CURRENT_TAB'), 'home');
  assert.equal(app.eval('window.location.replaced'), 'index.html');
  assert.equal(loadApp(app.storage).eval('AUTH.currentUser'), null);
});

test('logout action returns to index.html and clears the session', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  app.element('#auth-modal', { hidden: false });
  app.click('auth-logout');
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(app.eval('GUEST_MODE'), false);
  assert.equal(app.eval('CURRENT_TAB'), 'home');
  assert.equal(app.eval('window.location.replaced'), 'index.html');
  assert.equal(app.storage.has('basa_wisyo_session_v2'), false);
  const landing = loadApp(app.storage);
  assert.equal(landing.eval('AUTH.currentUser'), null);
  assert.equal(landing.eval('GUEST_MODE'), false);
});

test('logout stays on the account if the browser cannot clear its session', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  app.failNextRemove('basa_wisyo_session_v2');
  app.click('auth-logout');
  assert.equal(app.eval('AUTH.currentUser.role'), 'teacher');
  assert.equal(app.eval('window.location.replaced'), null);
  assert.equal(app.storage.has('basa_wisyo_session_v2'), true);
});

test('quick role controls and one-click demo accounts are absent', () => {
  const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
  const script = readFileSync(join(appRoot, 'src/app.js'), 'utf8');
  assert.ok(html.includes('id="welcome-screen"'));
  assert.ok(!html.includes('data-a="switch-role"'));
  assert.ok(!html.includes('data-a="auth-quick-fill"'));
  assert.ok(!script.includes('a === "switch-role"'));
});

test('BW-008: the restore control opens the file input rendered by admin', () => {
  const app = loadApp();
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  const markup = app.eval('renderAdminSystemTab()');
  const id = markup.match(/<input\s+type="file"\s+id="([^"]+)"/)?.[1];
  assert.ok(id, 'admin system view must render a file input');
  let opened = false;
  app.element(`#${id}`, { click() { opened = true; } });
  app.click('admin-restore-backup-trigger');
  assert.equal(opened, true);
});

test('BW-009: restoring an exported backup restores systemState', () => {
  const app = loadApp();
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  app.eval('S.w = 1234; S.theme = "dark"');
  app.click('admin-export-backup');
  const json = app.exportedJson();
  assert.ok(json, 'export action must produce a JSON payload');
  assert.equal(JSON.parse(json).systemState.w, 1234);

  app.eval('S.w = 0; S.theme = "light"');
  app.change({ id: 'admin-restore-file', files: [{ text: json }] });
  assert.equal(app.eval('S.w'), 1234);
  assert.equal(app.eval('S.theme'), 'dark');
});

test('versioned backup restores every collection, clears the session, and is repeatable', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123"); S.w = 4321');
  const backup = exportedBackup(app);
  assert.equal(backup.format, 'BasaWisyoBackup');
  assert.equal(backup.version, 1);
  assert.equal(backup.systemState.w, 4321);

  app.eval('AUTH.users = []; AUTH.assignments = []; AUTH.guestTokens = {}; AUTH.customPassages = []; S.w = 0');
  restorePayload(app, backup);
  assert.equal(app.eval('AUTH.users.length'), backup.users.length);
  assert.equal(app.eval('AUTH.assignments.length'), backup.assignments.length);
  assert.equal(app.eval('S.w'), 4321);
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(app.storage.get('basa_wisyo_session_v2'), undefined);
  const reloaded = loadApp(app.storage);
  assert.equal(reloaded.eval('AUTH.currentUser'), null);
  assert.equal(reloaded.eval('S.w'), 4321);

  const firstRestore = new Map(app.storage);
  restorePayload(app, backup);
  assert.deepEqual(app.storage, firstRestore);
  assert.equal(app.eval('AUTH.users.length'), backup.users.length);
});

test('legacy unversioned export still restores supported fields', () => {
  const app = loadApp();
  app.eval('S.w = 987');
  const backup = exportedBackup(app);
  delete backup.format;
  delete backup.version;
  app.eval('S.w = 0');
  restorePayload(app, backup);
  assert.equal(app.eval('S.w'), 987);
  assert.equal(app.alerts.length, 0);
});

test('empty, malformed, unsupported, and duplicate backups leave data intact', () => {
  const app = loadApp();
  const valid = exportedBackup(app);
  const duplicate = structuredClone(valid);
  duplicate.users.push(structuredClone(duplicate.users[0]));
  const missingState = structuredClone(valid);
  delete missingState.systemState;
  const unsupported = { ...valid, version: 99 };
  const oldVersion = { ...valid, version: 0 };
  const before = new Map(app.storage);

  for (const payload of ['{}', '{broken', unsupported, oldVersion, duplicate, missingState]) {
    const previousAlerts = app.alerts.length;
    restorePayload(app, payload);
    assert.equal(app.alerts.length, previousAlerts + 1);
    assert.deepEqual(app.storage, before);
    assert.equal(app.eval('AUTH.users.length'), valid.users.length);
  }
  assert.match(app.alerts[2], /Unsupported backup version/);
  assert.match(app.alerts[3], /Unsupported backup version/);
  assert.match(app.alerts[4], /duplicate entries/);
});

test('canceling restore does not change stored or in-memory data', () => {
  const app = loadApp(new Map(), { confirmResult: false });
  const backup = exportedBackup(app);
  backup.systemState.w = 700;
  const before = new Map(app.storage);
  restorePayload(app, backup);
  assert.deepEqual(app.storage, before);
  assert.equal(app.eval('S.w'), 0);
  assert.equal(app.alerts.length, 0);
});

test('failed storage write rolls back the complete restore', () => {
  const app = loadApp();
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  const backup = exportedBackup(app);
  backup.systemState.w = 700;
  const before = new Map(app.storage);
  app.failNextWrite('basa_wisyo_state_v2');
  restorePayload(app, backup);
  assert.deepEqual(app.storage, before);
  assert.equal(app.eval('AUTH.currentUser.role'), 'admin');
  assert.match(app.alerts[0], /Previous data was restored/);
});

test('unreadable and oversized files do not touch current data', () => {
  const app = loadApp();
  const before = new Map(app.storage);
  app.change({ id: 'admin-restore-file', files: [{ fail: true }], value: 'selected' });
  app.change({ id: 'admin-restore-file', files: [{ size: 11 * 1024 * 1024 }], value: 'selected' });
  assert.deepEqual(app.storage, before);
  assert.equal(app.alerts.length, 2);
});

test('student session reloads after state initialization', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  const reloaded = loadApp(app.storage);
  assert.equal(reloaded.eval('AUTH.currentUser.role'), 'student');
  assert.equal(reloaded.eval('S.lvl'), 1);
});

test('guided journey blocks extreme practice and unlocks the next tier after two distinct results', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  const extremeId = app.eval('PRACTICE_DATA.extreme[0].id');
  app.click('read-passage', extremeId);
  assert.equal(app.eval('ACTIVE_QUIZ'), null);
  assert.match(app.eval('viewPractice()'), /Complete earlier tiers/);

  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "First"); ACTIVE_QUIZ.correctCount = 2; finishQuiz()');
  assert.equal(app.eval('journeySummary().tier'), 0);
  app.eval('startQuiz([PRACTICE_DATA.easy[1]], "pr", "Second"); ACTIVE_QUIZ.correctCount = 1; finishQuiz()');
  assert.equal(app.eval('journeySummary().tier'), 1);
  assert.equal(app.eval('journeyCanRead(PRACTICE_DATA.medium[0])'), true);
  assert.equal(app.eval('journeyCanRead(PRACTICE_DATA.extreme[0])'), false);
  assert.equal(loadApp(app.storage).eval('journeySummary().tier'), 1);
});

test('guided journey suggests a retry after two weak attempts', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:0})');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[1].qs.map(q=>({P:PRACTICE_DATA.easy[1],q})),correctCount:1})');
  assert.equal(app.eval('journeySummary().tier'), 0);
  assert.equal(app.eval('journeySummary().next.id'), app.eval('PRACTICE_DATA.easy[0].id'));
});

test('student home shows the next reading step and teacher roster shows tier controls', () => {
  const app = loadApp();
  app.eval('AUTH.login("ana@basawisyo.ph", "student123")');
  assert.match(app.eval('viewHome()'), /Next recommended:/);
  assert.match(app.eval('viewHome()'), /Locked/);
  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.match(app.eval('viewTeacher()'), /data-a="teacher-journey-override"/);
});

test('student journeys stay separate and guest journey transfers during registration', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:2})');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[1].qs.map(q=>({P:PRACTICE_DATA.easy[1],q})),correctCount:1})');
  assert.equal(app.eval('journeySummary().tier'), 1);
  app.eval('AUTH.logout(); AUTH.login("ana@basawisyo.ph", "student123")');
  assert.equal(app.eval('journeySummary().tier'), 0);

  app.eval('AUTH.logout(); GUEST_MODE = true');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:2})');
  const registered = app.eval('AUTH.register({name:"New Reader",email:"newreader@example.ph",password:"secret7",role:"student"})');
  assert.equal(registered.success, true);
  assert.equal(app.eval('Object.keys(AUTH.currentUser.journey.results).length'), 1);
  assert.equal(app.eval('Object.keys(S.guestJourney.results).length'), 0);
  assert.equal(loadApp(app.storage).eval('Object.keys(AUTH.currentUser.journey.results).length'), 1);
});

test('only a linked teacher can grant extra tier access, and failed saves do not grant it', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  app.change({ dataset: { a: 'teacher-journey-override', v: 'usr_stud_2' }, value: '3' });
  assert.equal(app.eval('AUTH.users.find(u => u.id === "usr_stud_2").journeyOverride'), 3);
  app.eval('AUTH.logout(); AUTH.login("ana@basawisyo.ph", "student123")');
  assert.equal(app.eval('journeySummary().tier'), 3);
  assert.throws(() => app.eval('setStudentJourneyOverride("usr_stud_1", "3")'), /Teacher account required/);

  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  app.failNextWrite('basa_wisyo_users_v2');
  assert.throws(() => app.eval('setStudentJourneyOverride("usr_stud_1", "3")'), /could not be saved/);
  assert.equal(app.eval('AUTH.users.find(u => u.id === "usr_stud_1").journeyOverride'), undefined);
});

test('reading badges reflect distinct eligible practice and a better retry', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  const practice = (index, correctCount, correctQuestions = []) => app.eval(`recordJourneyPractice({
    mode:"pr", steps:PRACTICE_DATA.easy[${index}].qs.map(q=>({P:PRACTICE_DATA.easy[${index}],q})),
    correctCount:${correctCount}, correctQuestions:${JSON.stringify(correctQuestions)}
  })`);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).filter(b=>b.earned).length'), 0);
  practice(0, 0);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="first").earned'), true);
  practice(0, 0);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="steady").earned'), false);
  practice(0, 2, [{ index: 0, skill: 'Literal' }]);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="comeback").earned'), true);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="perfect").earned'), true);
  practice(1, 1, [{ index: 0, skill: 'Literal' }]);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="steady").earned'), false);
  practice(2, 1, [{ index: 0, skill: 'Literal' }]);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="steady").earned'), true);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="literal").earned'), true);
  practice(2, 1, [{ index: 0, skill: 'Literal' }]);
  assert.equal(app.eval('journeyForCurrent().skillEvidence.Literal.length'), 3);
});

test('profile frames unlock from badges, save per learner, and transfer from guest registration', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  assert.throws(() => app.eval('setJourneyFrame("gold")'), /Earn the matching badge/);
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  assert.match(app.eval('viewProfile()'), /data-a="reward-frame" data-v="sky"/);
  app.click('reward-frame', 'sky');
  assert.equal(app.eval('journeySelectedFrame()'), 'sky');
  const registered = app.eval('AUTH.register({name:"Badge Reader",email:"badgereader@example.ph",password:"secret7",role:"student"})');
  assert.equal(registered.success, true);
  assert.equal(app.eval('journeySelectedFrame()'), 'sky');
  assert.equal(app.eval('S.guestJourney.frame'), 'none');
  assert.equal(loadApp(app.storage).eval('journeySelectedFrame()'), 'sky');
  app.eval('AUTH.logout(); AUTH.login("ana@basawisyo.ph", "student123")');
  assert.equal(app.eval('journeySelectedFrame()'), 'none');
});

test('guest skill badge evidence transfers into the new student account and stays in backups', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  for (const index of [0, 1, 2]) {
    app.eval(`recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[${index}].qs.map(q=>({P:PRACTICE_DATA.easy[${index}],q})),correctCount:1,correctQuestions:[{index:0,skill:"Literal"}]})`);
  }
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="literal").earned'), true);
  const registered = app.eval('AUTH.register({name:"Skill Reader",email:"skillreader@example.ph",password:"secret7",role:"student"})');
  assert.equal(registered.success, true);
  assert.equal(app.eval('journeyAchievements(journeyForCurrent()).find(b=>b.id==="literal").earned'), true);
  app.eval('AUTH.logout()');
  const backup = exportedBackup(app);
  assert.equal(backup.users.find(user => user.email === 'skillreader@example.ph').journey.skillEvidence.Literal.length, 3);
});

test('answering a practice question records skill evidence through the quiz flow', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  app.element('#quiz-feedback', { innerHTML: '' });
  app.element('.opt', []);
  app.eval('startQuiz([PRACTICE_DATA.easy[0]], "pr", "Badge practice")');
  app.eval('handleAnswer(PRACTICE_DATA.easy[0].qs[0].a)');
  assert.equal(app.eval('ACTIVE_QUIZ.correctQuestions.length'), 1);
  app.eval('finishQuiz()');
  assert.equal(app.eval('journeyForCurrent().skillEvidence.Literal.length'), 1);
});

test('class board is opt-in, counts each story once, and shares tied places', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  assert.equal(app.eval('classBoardEntries(0).length'), 0);
  assert.match(app.eval('viewClassBoard()'), /Join Class Board/);
  app.click('board-opt', 'on');
  assert.equal(app.eval('AUTH.currentUser.journey.boardOptIn'), true);
  assert.equal(app.eval('classBoardEntries(0).length'), 1);
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:0})');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:2})');
  assert.equal(app.eval('readingRank(journeyForCurrent()).stories'), 1);
  assert.equal(app.eval('boardStoryCount(journeyForCurrent(), 0)'), 1);
  app.eval('AUTH.logout(); AUTH.login("ana@basawisyo.ph", "student123")');
  assert.equal(app.eval('classBoardEntries(0).length'), 1);
  app.click('board-opt', 'on');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[1].qs.map(q=>({P:PRACTICE_DATA.easy[1],q})),correctCount:1})');
  assert.equal(app.eval('classBoardEntries(0).map(entry=>entry.place).join(",")'), '1,1');
  assert.doesNotMatch(app.eval('viewClassBoard()'), /Carlo Bautista/);
  app.click('board-opt', 'off');
  assert.equal(app.eval('classBoardEntries(0).length'), 1);
  assert.equal(loadApp(app.storage).eval('AUTH.currentUser.journey.boardOptIn'), false);
});

test('class board stays inside the teacher group and excludes guests and admins', () => {
  const app = loadApp();
  assert.throws(() => app.eval('setClassBoardOptIn(true)'), /Join a teacher/);
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('setClassBoardOptIn(true)');
  app.eval('AUTH.logout()');
  const teacher = app.eval('AUTH.register({name:"Second Guro",email:"secondguro@example.ph",password:"secret7",role:"teacher",section:"Grade 7"})');
  assert.equal(teacher.success, true);
  assert.equal(app.eval('classBoardEntries(0).length'), 0);
  const code = teacher.user.shareCode;
  app.eval('AUTH.logout()');
  const student = app.eval(`AUTH.register({name:"Second Reader",email:"secondreader@example.ph",password:"secret7",role:"student",teacherCode:"${code}"})`);
  assert.equal(student.success, true);
  assert.equal(app.eval('AUTH.currentUser.journey.boardOptIn'), false);
  app.eval('setClassBoardOptIn(true)');
  assert.equal(app.eval('classBoardEntries(0).length'), 1);
  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.equal(app.eval('classBoardEntries(0).length'), 1);
  assert.throws(() => app.eval('setClassBoardOptIn(true)'), /Join a teacher/);
  app.eval('AUTH.logout(); AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.equal(app.eval('classBoardEntries(0).length'), 0);
  assert.match(app.eval('viewClassBoard()'), /for learners and their linked teachers/);
});

test('failed Class Board opt-in save does not add the student', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.failNextWrite('basa_wisyo_users_v2');
  assert.throws(() => app.eval('setClassBoardOptIn(true)'), /could not be saved/);
  assert.equal(app.eval('classBoardEntries(0).length'), 0);
});

test('Class Board filters tiers and excludes legacy or unapproved story records', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  assert.equal(app.eval('journeyForCurrent().boardOptIn'), false);
  app.eval('setClassBoardOptIn(true)');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.medium[0].qs.map(q=>({P:PRACTICE_DATA.medium[0],q})),correctCount:1})');
  app.eval('saveCurrentJourney({...journeyForCurrent(),results:{...journeyForCurrent().results,mesh_fake:{correct:1,total:2,attempts:1}}})');
  assert.equal(app.eval('boardStoryCount(journeyForCurrent(), 0)'), 1);
  assert.equal(app.eval('boardStoryCount(journeyForCurrent(), 1)'), 1);
  assert.equal(app.eval('readingRank(journeyForCurrent()).stories'), 2);
  app.click('board-tier', '1');
  assert.equal(app.eval('BOARD_TIER'), 1);
  assert.match(app.eval('viewClassBoard()'), /Medium \(Katamtaman\)/);
  app.click('board-tier', '999');
  assert.equal(app.eval('BOARD_TIER'), 1);
});

test('reading rewards and Class Board choices survive reload without network access', () => {
  const storage = new Map();
  const app = loadApp(storage);
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:2})');
  app.eval('setJourneyFrame("sky"); setClassBoardOptIn(true)');
  const reloaded = loadApp(storage);
  assert.equal(reloaded.eval('AUTH.currentUser.role'), 'student');
  assert.equal(reloaded.eval('readingRank(journeyForCurrent()).stories'), 1);
  assert.equal(reloaded.eval('journeySelectedFrame()'), 'sky');
  assert.equal(reloaded.eval('classBoardEntries(0).length'), 1);
});

test('guest progress transfers once but never joins a new account to the Class Board', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  assert.equal(app.eval('readingRank(journeyForCurrent()).stories'), 1);
  const created = app.eval('AUTH.register({name:"Guest Reader",email:"guestboard@example.ph",password:"secret7",role:"student",teacherCode:"BASA-TEACH-8492"})');
  assert.equal(created.success, true);
  assert.equal(app.eval('readingRank(journeyForCurrent()).stories'), 1);
  assert.equal(app.eval('journeyForCurrent().boardOptIn'), false);
  assert.equal(app.eval('classBoardEntries(0).length'), 0);
  assert.equal(app.eval('boardStoryCount(S.guestJourney)'), 0);
});

test('teacher override is limited to linked students and valid tiers', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.throws(() => app.eval('setStudentJourneyOverride("missing", "2")'), /not in your class/);
  assert.throws(() => app.eval('setStudentJourneyOverride("usr_stud_1", "4")'), /valid reading tier/);
  const otherTeacher = app.eval('AUTH.register({name:"Other Teacher",email:"otherteacher@example.ph",password:"secret7",role:"teacher",section:"Grade 7"})');
  assert.equal(otherTeacher.success, true);
  assert.throws(() => app.eval('setStudentJourneyOverride("usr_stud_1", "2")'), /not in your class/);
  assert.equal(app.eval('AUTH.users.find(user=>user.id==="usr_stud_1").journeyOverride'), undefined);
});

test('learner navigation uses Profile while teacher and admin keep Reports', () => {
  const app = loadApp();
  for (const role of ['guest', 'student']) {
    assert.equal(app.eval(`bottomTabsForRole("${role}").includes("profile")`), true);
    assert.equal(app.eval(`bottomTabsForRole("${role}").includes("reports")`), false);
  }
  for (const role of ['teacher', 'admin']) {
    assert.equal(app.eval(`bottomTabsForRole("${role}").includes("reports")`), true);
    assert.equal(app.eval(`bottomTabsForRole("${role}").includes("profile")`), false);
  }
});

test('guests and students cannot open or export reports through forged actions', () => {
  const app = loadApp();
  for (const role of ['guest', 'student']) {
    if (role === 'student') app.eval('AUTH.login("student@basawisyo.ph", "student123")');
    app.eval('CURRENT_TAB = "home"');
    assert.match(app.eval('viewReports()'), /Reports unavailable/);
    for (const [action, value] of [['tab', 'reports'], ['open-report-sheet'], ['download-csv'], ['print-sheet']]) {
      app.click(action, value);
      assert.equal(app.eval('CURRENT_TAB'), 'home');
      assert.match(app.toasts.at(-1).message, /Teacher or admin account required/);
    }
    assert.equal(app.eval('$("#md").hidden'), undefined);
    assert.equal(app.exportedJson(), null);
    assert.equal(app.prints(), 0);
    assert.throws(() => app.eval('openForm14Modal()'), /Teacher or admin account required/);
    assert.throws(() => app.eval('downloadCSV()'), /Teacher or admin account required/);
    assert.throws(() => app.eval('printReportSheet()'), /Teacher or admin account required/);
  }
});

test('teacher and admin can preview, export, and print only sample report data', () => {
  const app = loadApp();
  app.eval('S.lvl = 3; S.w = 99999; S.ss = 1');
  for (const [email, password] of [['teacher@basawisyo.ph', 'teacher123'], ['admin@basawisyo.ph', 'admin123']]) {
    app.eval('AUTH.logout()');
    app.eval(`AUTH.login("${email}", "${password}")`);
    app.click('tab', 'reports');
    assert.equal(app.eval('CURRENT_TAB'), 'reports');
    const report = app.eval('viewReports()');
    assert.match(report, /Sample Class 8-A Distribution/);
    assert.match(report, /not validated Phil-IRI results/);
    assert.doesNotMatch(report, /41 Learners|Current Learner/);
    app.click('open-report-sheet');
    const modal = app.eval('$("#md").innerHTML');
    assert.match(modal, /Sample Form 14 Layout/);
    assert.match(modal, /Not for official submission/);
    assert.doesNotMatch(modal, /Current Learner|99,999/);
    app.click('download-csv');
    assert.match(app.exportedJson(), /Sample Learner Name/);
    assert.doesNotMatch(app.exportedJson(), /Current Learner|99999/);
    const beforePrints = app.prints();
    app.click('print-sheet');
    assert.equal(app.prints(), beforePrints + 1);
  }
});

test('Home links to rewards while guest and student profiles contain the badge panel', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  const guestHome = app.eval('viewHome()');
  assert.match(guestHome, /View badges in My Progress/);
  assert.doesNotMatch(guestHome, /class="card rewards-panel"/);
  assert.match(app.eval('viewProfile()'), /class="card rewards-panel"/);

  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  const studentHome = app.eval('viewHome()');
  assert.match(studentHome, /View badges in Student Profile/);
  assert.doesNotMatch(studentHome, /class="card rewards-panel"/);
  assert.match(app.eval('viewProfile()'), /class="card rewards-panel"/);
});

test('Student Profile shows only the current account journey and earned rewards', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:2})');
  app.eval('S.w = 99999; S.ss = 999');
  const first = app.eval('viewProfile()');
  assert.match(first, /Carlo Bautista/);
  assert.match(first, /My Completed Stories/);
  assert.match(first, /Best practice: 2 of 2 correct/);
  assert.match(first, /Story Starter/);
  assert.match(first, /First Story/);
  assert.doesNotMatch(first, /99,999 words|999 reading sessions/);
  app.eval('AUTH.logout(); AUTH.login("ana@basawisyo.ph", "student123")');
  const second = app.eval('viewProfile()');
  assert.match(second, /Ana Reyes/);
  assert.match(second, /No completed stories yet/);
  assert.doesNotMatch(second, /Carlo Bautista|Best practice: 2 of 2 correct/);
});

test('guest My Progress uses local guest journey and registration carries it into Profile', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  const guest = app.eval('viewProfile()');
  assert.match(guest, /My Progress/);
  assert.match(guest, /Create student account/);
  assert.match(guest, /Best practice: 1 of 2 correct/);
  assert.doesNotMatch(guest, /Carlo Bautista/);
  const registered = app.eval('AUTH.register({name:"Transferred Reader",email:"transferred@example.ph",password:"secret7",role:"student"})');
  assert.equal(registered.success, true);
  assert.match(app.eval('viewProfile()'), /Transferred Reader/);
  assert.match(app.eval('viewProfile()'), /Best practice: 1 of 2 correct/);
  assert.equal(app.eval('boardStoryCount(S.guestJourney)'), 0);
  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.doesNotMatch(app.eval('viewProfile()'), /Transferred Reader|Best practice/);
});

test('reloading restores only the student profile and does not grant report access', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  const reloaded = loadApp(app.storage);
  assert.match(reloaded.eval('viewProfile()'), /Carlo Bautista/);
  assert.match(reloaded.eval('viewProfile()'), /Best practice: 1 of 2 correct/);
  assert.match(reloaded.eval('viewReports()'), /Reports unavailable/);
  reloaded.click('tab', 'reports');
  assert.notEqual(reloaded.eval('CURRENT_TAB'), 'reports');
  assert.throws(() => reloaded.eval('downloadCSV()'), /Teacher or admin account required/);
});

test('report dialog takes keyboard focus and restores it when closed', () => {
  const app = loadApp();
  let closeFocused = false;
  let triggerFocused = false;
  const modal = { hidden: true, innerHTML: '', querySelector: () => ({ focus() { closeFocused = true; } }) };
  app.element('#md', modal);
  app.element('#v [data-a="open-report-sheet"]', { focus() { triggerFocused = true; } });
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123"); openForm14Modal()');
  assert.equal(modal.hidden, false);
  assert.equal(closeFocused, true);
  assert.match(modal.innerHTML, /id="sample-report-title"/);
  app.click('modal-close');
  assert.equal(modal.hidden, true);
  assert.equal(triggerFocused, true);
});

test('Student Profile escapes account and classroom text', () => {
  const app = loadApp();
  const created = app.eval('AUTH.register({name:"<img src=x onerror=alert(1)>",email:"escapeprofile@example.ph",password:"secret7",role:"student",teacherCode:"BASA-TEACH-8492"})');
  assert.equal(created.success, true);
  const html = app.eval('viewProfile()');
  assert.doesNotMatch(html, /<img src=x onerror=/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('guest My Progress survives reload without granting report access', () => {
  const app = loadApp();
  app.eval('GUEST_MODE = true');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  const reloaded = loadApp(app.storage);
  assert.equal(reloaded.eval('AUTH.currentUser'), null);
  reloaded.eval('GUEST_MODE = true');
  assert.match(reloaded.eval('viewProfile()'), /Best practice: 1 of 2 correct/);
  assert.match(reloaded.eval('viewReports()'), /Reports unavailable/);
});

test('teacher and admin report access survives session reload', () => {
  for (const [email, password] of [['teacher@basawisyo.ph', 'teacher123'], ['admin@basawisyo.ph', 'admin123']]) {
    const app = loadApp();
    app.eval(`AUTH.login("${email}", "${password}")`);
    const reloaded = loadApp(app.storage);
    assert.equal(reloaded.eval('canViewReports()'), true);
    assert.match(reloaded.eval('viewReports()'), /Reading Reports Preview/);
    reloaded.click('tab', 'reports');
    assert.equal(reloaded.eval('CURRENT_TAB'), 'reports');
  }
});

test('teacher and admin Passage Library shows local best scores without learner quiz controls', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const teacherHtml = app.eval('viewPractice()');
  assert.match(teacherHtml, /Passage Library/);
  assert.match(teacherHtml, /View passage &amp; results/);
  assert.match(teacherHtml, /Carlo Bautista/);
  assert.match(teacherHtml, /1\/2/);
  assert.doesNotMatch(teacherHtml, /data-a="read-passage"|Read & Answer|Read Again/);
  const passageId = app.eval('PRACTICE_DATA.easy[0].id');
  app.click('read-passage', passageId);
  assert.equal(app.eval('ACTIVE_QUIZ'), null);
  assert.equal(app.eval('CURRENT_TAB'), 'practice');
  app.click('start-placement');
  assert.equal(app.eval('ACTIVE_QUIZ'), null);
  app.eval('AUTH.logout(); AUTH.login("admin@basawisyo.ph", "admin123")');
  const adminHtml = app.eval('viewPractice()');
  assert.match(adminHtml, /Carlo Bautista/);
  assert.match(adminHtml, /1\/2/);
  assert.doesNotMatch(adminHtml, /data-a="read-passage"/);
  app.click('read-passage', passageId);
  assert.equal(app.eval('ACTIVE_QUIZ'), null);
});

test('Passage Library keeps teacher edits to owned drafts and gives admins review actions', () => {
  const app = loadApp();
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const own = app.eval('AUTH.savePractice({t:"Teacher Draft",diff:"easy",x:"A short classroom passage.",qs:[{q:"What happened?",o:["Reading","Running"],a:0,k:"Literal"}]})');
  const teacherHtml = app.eval('viewPractice()');
  assert.match(teacherHtml, new RegExp(`data-a="practice-edit" data-v="${own.id}"`));
  assert.match(teacherHtml, new RegExp(`data-a="practice-delete" data-v="${own.id}"`));
  assert.doesNotMatch(teacherHtml, /data-a="practice-approve"/);
  app.eval('AUTH.savePractice({t:"Teacher Draft",diff:"easy",x:"A short classroom passage.",qs:[{q:"What happened?",o:["Reading","Running"],a:0,k:"Literal"}]},{id:"' + own.id + '",submit:true})');
  const pendingHtml = app.eval('viewPractice()');
  assert.match(pendingHtml, new RegExp(`data-a="practice-withdraw" data-v="${own.id}"`));
  assert.doesNotMatch(pendingHtml, new RegExp(`data-a="practice-delete" data-v="${own.id}"`));
  app.eval('AUTH.logout(); AUTH.login("admin@basawisyo.ph", "admin123")');
  const adminHtml = app.eval('viewPractice()');
  assert.match(adminHtml, new RegExp(`data-a="practice-approve" data-v="${own.id}"`));
  assert.match(adminHtml, new RegExp(`data-a="practice-reject" data-v="${own.id}"`));
});

test('teacher results stay within the linked class and keep earlier score totals', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:2})');
  app.eval('AUTH.users.find(user=>user.id==="usr_stud_1").teacherCode="ANOTHER-CLASS"');
  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.doesNotMatch(app.eval('viewPractice()'), /Carlo Bautista/);
  app.eval('AUTH.logout(); AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.match(app.eval('viewPractice()'), /Carlo Bautista/);
  app.eval('PRACTICE_DATA.easy[0].qs.push({q:"A new question?",o:["Yes","No"],a:0,k:"Literal"})');
  assert.match(app.eval('viewPractice()'), /Earlier question count/);
});

test('teacher Class Overview uses linked student progress and has no learner assessment controls', () => {
  const app = loadApp();
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.eval('recordJourneyPractice({mode:"pr",steps:PRACTICE_DATA.easy[0].qs.map(q=>({P:PRACTICE_DATA.easy[0],q})),correctCount:1})');
  app.eval('AUTH.logout(); AUTH.login("teacher@basawisyo.ph", "teacher123")');
  const html = app.eval('viewTeacherOverview()');
  assert.match(html, /Class Overview/);
  assert.match(html, /Carlo Bautista/);
  assert.match(html, /Best: 1\/2/);
  assert.match(html, /Completed student-passage pairs/);
  assert.doesNotMatch(html, /Your Phil-IRI Level|Words Read|data-a="start-placement"|data-a="read-passage"/);
  assert.match(app.eval('viewTeacherLearnerPreview()'), /Read-only preview/);
  assert.doesNotMatch(app.eval('viewTeacherLearnerPreview()'), /data-a="read-passage"|data-a="start-placement"/);
  assert.equal(app.eval('bottomTabsForRole("teacher").includes("assess")'), false);
});

test('teacher Class Overview gives an empty invite state and excludes other teachers classes', () => {
  const app = loadApp();
  const created = app.eval('AUTH.register({name:"Other Teacher",email:"overviewteacher@example.ph",password:"secret7",role:"teacher",section:"Grade 9"})');
  assert.equal(created.success, true);
  const html = app.eval('viewTeacherOverview()');
  assert.match(html, /Invite students to your class/);
  assert.match(html, new RegExp(created.user.shareCode));
  assert.doesNotMatch(html, /Carlo Bautista|Ana Reyes/);
  app.eval('AUTH.logout(); AUTH.login("student@basawisyo.ph", "student123")');
  assert.match(app.eval('viewTeacherOverview()'), /Teacher account required/);
});
