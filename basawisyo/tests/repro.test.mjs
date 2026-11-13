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
  'src/data/passage-schema.js',
  'src/services/auth.js',
  'src/pages/teacher.js',
  'src/pages/admin.js',
  'src/services/state.js',
  'src/utils/reading.js',
  'src/pages/practice.js',
  'src/services/quiz.js',
  'src/services/practice-helper.js',
  'src/services/backup.js',
  'src/app.js',
];

function loadApp(storage = new Map(), { confirmResult = true, locationHash = '' } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const alerts = [];
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
    showToast() {},
    alert(message) { alerts.push(message); },
    confirm: () => confirmResult,
    window: {
      location: {
        hash: locationHash, pathname: '/index.html', search: '', assigned: null, replaced: null,
        assign(url) { this.assigned = url; },
        replace(url) { this.replaced = url; },
      },
      history: { replaceState() {} },
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
  assert.match(html, /data-a="entry-guest">Explore as guest<\/button>/);
  assert.match(html, /href="login.html">Sign in<\/a>/);
  assert.match(html, /data-a="auth-open" data-v="register">Create student account<\/button>/);
  assert.ok(!html.includes('id="entry-login-form"'));
  assert.ok(!html.includes('id="form-login"'));
  assert.ok(!html.includes('id="role-card-admin"'));
  assert.ok(!html.includes('id="reg-admin-key"'));
  assert.match(loginHtml, /id="entry-login-form"/);
  assert.match(loginHtml, /href="index.html#register"/);
});

test('public registration cannot create a teacher or admin account', () => {
  const app = loadApp();
  const before = app.eval('AUTH.users.length');
  assert.equal(app.eval(`AUTH.register({
    name: 'New Teacher', email: 'newteacher@school.test', password: 'test123', role: 'teacher'
  }).success`), false);
  assert.equal(app.eval(`AUTH.register({
    name: 'New Admin', email: 'newadmin@school.test', password: 'test123', role: 'admin'
  }).success`), false);
  assert.equal(app.eval('AUTH.users.length'), before);
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
