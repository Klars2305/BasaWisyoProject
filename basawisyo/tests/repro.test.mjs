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
  'src/services/auth.js',
  'src/pages/admin.js',
  'src/services/state.js',
  'src/utils/reading.js',
  'src/pages/practice.js',
  'src/services/quiz.js',
  'src/app.js',
];

function loadApp() {
  const elements = new Map();
  const listeners = new Map();
  const storage = new Map();
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
    eval: expression => vm.runInContext(expression, context),
    element(selector, value) { elements.set(selector, value); },
    click(action) {
      const event = { target: { closest: () => ({ dataset: { a: action } }) } };
      for (const listener of listeners.get('click') ?? []) listener(event);
    },
    change(target) {
      for (const listener of listeners.get('change') ?? []) listener({ target });
    },
    exportedJson: () => exportedJson,
  };
}

function saveAdminPassage(app) {
  const fields = {
    '#pass-title': 'Regression Passage',
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
});

test('BW-007: an admin-created passage appears in the reading library', () => {
  const app = loadApp();
  saveAdminPassage(app);
  assert.ok(
    app.eval('viewPractice()').includes('Regression Passage'),
    'saved admin passage is missing from the reading library',
  );
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
