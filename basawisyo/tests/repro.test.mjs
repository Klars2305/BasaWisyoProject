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
  'src/app.js',
];

function loadApp(storage = new Map()) {
  const elements = new Map();
  const listeners = new Map();
  let exportedJson = null;
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
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  class FileReader {
    readAsText(file) {
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
    alert() {},
    confirm: () => true,
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
