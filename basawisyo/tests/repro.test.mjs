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
  'src/services/backup.js',
  'src/app.js',
];

function loadApp(storage = new Map(), { confirmResult = true } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const alerts = [];
  let exportedJson = null;
  let failNextKey = null;
  elements.set('#md', { addEventListener() {} });
  elements.set('#ai', { addEventListener() {} });

  const document = {
    querySelector: selector => elements.get(selector) ?? null,
    querySelectorAll: () => [],
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
    removeItem: key => storage.delete(key),
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
    window: {},
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
    eval: expression => vm.runInContext(expression, context),
    element(selector, value) { elements.set(selector, value); },
    click(action) {
      const event = { target: { closest: () => ({ dataset: { a: action } }) } };
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
  app.click('admin-export-backup');
  return JSON.parse(app.exportedJson());
}

function restorePayload(app, payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  app.change({ id: 'admin-restore-file', files: [{ text }], value: 'selected' });
}

function saveAdminPassage(app, title = 'Regression Passage') {
  const fields = {
    '#pass-title': title,
    '#pass-diff': 'easy',
    '#pass-text': 'A learner reads a short passage.',
    '#pass-q1': 'Who reads?',
    '#pass-opt-0': 'A learner',
    '#pass-opt-1': 'A teacher',
    '#pass-opt-2': 'A parent',
    '#pass-opt-3': 'A friend',
    '#pass-ans': '0',
    '#pass-skill': 'Literal',
  };
  for (const [selector, value] of Object.entries(fields)) {
    app.element(selector, { value });
  }
  app.element('#admin-passage-modal', { hidden: false });
  app.click('admin-save-passage');
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

test('login entry rejects bad credentials and signs in an existing account', () => {
  const app = loadApp();
  const email = { value: 'teacher@basawisyo.ph' };
  const password = { value: 'incorrect' };
  const error = { textContent: '', hidden: true };
  app.element('#entry-email', email);
  app.element('#entry-password', password);
  app.element('#entry-error', error);
  app.submit({ id: 'entry-login-form' });
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(error.textContent, 'Invalid email or password.');
  assert.equal(error.hidden, false);

  password.value = 'teacher123';
  app.submit({ id: 'entry-login-form' });
  assert.equal(app.eval('AUTH.currentUser.role'), 'teacher');
  assert.equal(app.eval('CURRENT_TAB'), 'teacher');
  assert.equal(app.eval('GUEST_MODE'), false);
  assert.equal(error.hidden, true);
  assert.equal(password.value, '');
});

test('returning local sessions open the matching role dashboard', () => {
  for (const [email, password, role, tab] of [
    ['student@basawisyo.ph', 'student123', 'student', 'home'],
    ['teacher@basawisyo.ph', 'teacher123', 'teacher', 'teacher'],
    ['admin@basawisyo.ph', 'admin123', 'admin', 'admin'],
  ]) {
    const storage = new Map();
    const firstVisit = loadApp(storage);
    assert.equal(firstVisit.eval(`AUTH.login(${JSON.stringify(email)}, ${JSON.stringify(password)}).success`), true);
    const returningVisit = loadApp(storage);
    assert.equal(returningVisit.eval('AUTH.currentUser.role'), role);
    assert.equal(returningVisit.eval('CURRENT_TAB'), tab);
    assert.equal(returningVisit.eval('GUEST_MODE'), false);
  }
});

test('public entry offers guest, sign-in, and student registration choices', () => {
  const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
  assert.match(html, /data-a="entry-guest">Explore as guest<\/button>/);
  assert.match(html, /data-a="entry-sign-in">Sign in<\/button>/);
  assert.match(html, /data-a="auth-open" data-v="register">Create student account<\/button>/);
  assert.match(html, /id="entry-sign-in-panel" hidden/);
});

test('public sign-in choice opens and closes the entry form', () => {
  const app = loadApp();
  const choices = { hidden: false };
  const panel = { hidden: true };
  const email = { focused: false, focus() { this.focused = true; } };
  const password = { value: 'old password' };
  const error = { textContent: 'Old error', hidden: false };
  const signInButton = { focused: false, focus() { this.focused = true; } };
  app.element('#entry-choices', choices);
  app.element('#entry-sign-in-panel', panel);
  app.element('#entry-email', email);
  app.element('#entry-password', password);
  app.element('#entry-error', error);
  app.element("[data-a='entry-sign-in']", signInButton);

  app.click('entry-sign-in');
  assert.equal(choices.hidden, true);
  assert.equal(panel.hidden, false);
  assert.equal(email.focused, true);

  app.click('entry-back');
  assert.equal(choices.hidden, false);
  assert.equal(panel.hidden, true);
  assert.equal(password.value, '');
  assert.equal(error.hidden, true);
  assert.equal(signInButton.focused, true);
});

test('guest entry is explicit and signing out returns to login', () => {
  const app = loadApp();
  app.click('entry-guest');
  assert.equal(app.eval('GUEST_MODE'), true);
  assert.equal(app.eval('AUTH.currentUser'), null);

  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  app.element('#auth-modal', { hidden: true });
  app.click('auth-open');
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(app.eval('GUEST_MODE'), false);
});

test('quick role controls and one-click demo accounts are absent', () => {
  const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
  const script = readFileSync(join(appRoot, 'src/app.js'), 'utf8');
  assert.ok(html.includes('id="login-screen"'));
  assert.ok(!html.includes('data-a="switch-role"'));
  assert.ok(!html.includes('data-a="auth-quick-fill"'));
  assert.ok(!script.includes('a === "switch-role"'));
});

test('BW-008: the restore control opens the file input rendered by admin', () => {
  const app = loadApp();
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
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  const backup = exportedBackup(app);
  backup.systemState.w = 700;
  const before = new Map(app.storage);
  app.failNextWrite('basa_wisyo_state_v2');
  restorePayload(app, backup);
  assert.deepEqual(app.storage, before);
  assert.equal(app.eval('AUTH.currentUser.role'), 'student');
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
