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
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains: () => false
    },
    style: {},
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => []
  });

  const getElem = (id) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElem());
    }
    return elements.get(id);
  };

  const sandbox = {
    console,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear()
    },
    document: {
      documentElement: {
        setAttribute() {},
        style: { setProperty() {} }
      },
      body: {
        classList: { toggle() {}, add() {}, remove() {}, contains: () => false }
      },
      getElementById: (id) => getElem(id),
      querySelector: (sel) => {
        if (sel.startsWith('#')) return getElem(sel.slice(1));
        return getElem(sel);
      },
      querySelectorAll: () => [],
      addEventListener: (type, handler) => {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      }
    },
    window: {
      addEventListener: () => {},
      scrollTo: () => {}
    },
    navigator: {
      userAgent: 'Node.js Test'
    }
  };

  const context = vm.createContext(sandbox);
  for (const f of files) {
    const code = readFileSync(join(appRoot, f), 'utf8');
    vm.runInContext(code, context, { filename: f });
  }

  return {
    eval: (code) => vm.runInContext(code, context),
    getElem,
    context
  };
}

test('Navigation Matrix: Student role defines exactly 5 destinations with icons and labels', () => {
  const app = loadApp();
  const studentItems = app.eval('getNavItemsForRole("student")');
  assert.equal(studentItems.length, 5, 'Student must have exactly 5 destinations');
  
  const ids = JSON.parse(JSON.stringify(studentItems.map(item => item.id)));
  assert.deepEqual(ids, ['home', 'practice', 'flashcards', 'board', 'profile']);

  const labels = JSON.parse(JSON.stringify(studentItems.map(item => item.label)));
  assert.deepEqual(labels, ['Home', 'Read', 'Practice', 'Class', 'Profile']);

  for (const item of studentItems) {
    const iconHtml = app.eval(`uiIcon("${item.icon || item.id}")`);
    assert.ok(iconHtml.includes('<svg class="ui-icon"'), `Tab "${item.id}" must render valid SVG icon`);
  }
});

test('Navigation Matrix: Teacher role defines exactly 5 destinations with icons and labels', () => {
  const app = loadApp();
  const teacherItems = app.eval('getNavItemsForRole("teacher")');
  assert.equal(teacherItems.length, 5, 'Teacher must have exactly 5 destinations');

  const ids = JSON.parse(JSON.stringify(teacherItems.map(item => item.id)));
  assert.deepEqual(ids, ['home', 'teacher', 'teacher-studio', 'board', 'reports']);

  const labels = JSON.parse(JSON.stringify(teacherItems.map(item => item.label)));
  assert.deepEqual(labels, ['Overview', 'Students', 'Materials', 'Class', 'Reports']);

  for (const item of teacherItems) {
    const iconHtml = app.eval(`uiIcon("${item.icon || item.id}")`);
    assert.ok(iconHtml.includes('<svg class="ui-icon"'), `Tab "${item.id}" must render valid SVG icon`);
  }
});

test('Navigation Matrix: Admin role defines exactly 5 destinations with icons and labels', () => {
  const app = loadApp();
  const adminItems = app.eval('getNavItemsForRole("admin")');
  assert.equal(adminItems.length, 5, 'Admin must have exactly 5 destinations');

  const ids = JSON.parse(JSON.stringify(adminItems.map(item => item.id)));
  assert.deepEqual(ids, ['admin', 'users', 'classes', 'practice', 'reports']);

  const labels = JSON.parse(JSON.stringify(adminItems.map(item => item.label)));
  assert.deepEqual(labels, ['Overview', 'Users', 'Classes', 'Content', 'Settings']);

  for (const item of adminItems) {
    const iconHtml = app.eval(`uiIcon("${item.icon || item.id}")`);
    assert.ok(iconHtml.includes('<svg class="ui-icon"'), `Tab "${item.id}" must render valid SVG icon`);
  }
});

test('Navigation Matrix: Guest role defines strictly 4 destinations (no filler 5th tab)', () => {
  const app = loadApp();
  const guestItems = app.eval('getNavItemsForRole("guest")');
  assert.equal(guestItems.length, 4, 'Guest must have strictly 4 destinations');

  const ids = JSON.parse(JSON.stringify(guestItems.map(item => item.id)));
  assert.deepEqual(ids, ['home', 'practice', 'about', 'profile']);

  const labels = JSON.parse(JSON.stringify(guestItems.map(item => item.label)));
  assert.deepEqual(labels, ['Home', 'Explore', 'About', 'Sign In']);

  for (const item of guestItems) {
    const iconHtml = app.eval(`uiIcon("${item.icon || item.id}")`);
    assert.ok(iconHtml.includes('<svg class="ui-icon"'), `Tab "${item.id}" must render valid SVG icon`);
  }
});

test('Route Authorization: canAccessRoute enforces independent access gates for all roles', () => {
  const app = loadApp();

  // Guest permissions
  assert.equal(app.eval('canAccessRoute("home", null)'), true);
  assert.equal(app.eval('canAccessRoute("practice", null)'), true);
  assert.equal(app.eval('canAccessRoute("about", null)'), true);
  assert.equal(app.eval('canAccessRoute("admin", null)'), false);
  assert.equal(app.eval('canAccessRoute("users", null)'), false);
  assert.equal(app.eval('canAccessRoute("classes", null)'), false);
  assert.equal(app.eval('canAccessRoute("teacher", null)'), false);
  assert.equal(app.eval('canAccessRoute("teacher-studio", null)'), false);
  assert.equal(app.eval('canAccessRoute("reports", null)'), false);
  assert.equal(app.eval('canAccessRoute("studio", null)'), false);

  // Unplaced student (lvl is null)
  const unplacedStudent = { id: 's1', role: 'student', lvl: null };
  const unplacedState = { lvl: null };
  assert.equal(app.eval(`canAccessRoute("assess", ${JSON.stringify(unplacedStudent)}, ${JSON.stringify(unplacedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("home", ${JSON.stringify(unplacedStudent)}, ${JSON.stringify(unplacedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("profile", ${JSON.stringify(unplacedStudent)}, ${JSON.stringify(unplacedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("practice", ${JSON.stringify(unplacedStudent)}, ${JSON.stringify(unplacedState)})`), false, 'Unplaced student must not access practice directly');

  // Placed student
  const placedStudent = { id: 's2', role: 'student', lvl: 2 };
  const placedState = { lvl: 2 };
  assert.equal(app.eval(`canAccessRoute("practice", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("flashcards", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("board", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("studio", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), true);
  assert.equal(app.eval(`canAccessRoute("reports", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), false);
  assert.equal(app.eval(`canAccessRoute("teacher", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), false);
  assert.equal(app.eval(`canAccessRoute("admin", ${JSON.stringify(placedStudent)}, ${JSON.stringify(placedState)})`), false);

  // Teacher permissions
  const teacher = { id: 't1', role: 'teacher' };
  assert.equal(app.eval(`canAccessRoute("teacher", ${JSON.stringify(teacher)})`), true);
  assert.equal(app.eval(`canAccessRoute("teacher-studio", ${JSON.stringify(teacher)})`), true);
  assert.equal(app.eval(`canAccessRoute("reports", ${JSON.stringify(teacher)})`), true);
  assert.equal(app.eval(`canAccessRoute("admin", ${JSON.stringify(teacher)})`), false);
  assert.equal(app.eval(`canAccessRoute("users", ${JSON.stringify(teacher)})`), false);

  // Admin permissions
  const admin = { id: 'a1', role: 'admin' };
  assert.equal(app.eval(`canAccessRoute("admin", ${JSON.stringify(admin)})`), true);
  assert.equal(app.eval(`canAccessRoute("users", ${JSON.stringify(admin)})`), true);
  assert.equal(app.eval(`canAccessRoute("classes", ${JSON.stringify(admin)})`), true);
  assert.equal(app.eval(`canAccessRoute("reports", ${JSON.stringify(admin)})`), true);
  assert.equal(app.eval(`canAccessRoute("practice", ${JSON.stringify(admin)})`), true);
});

test('Active State Grouping: isRouteActive maintains active state across secondary views', () => {
  const app = loadApp();

  // Student subviews
  assert.equal(app.eval('isRouteActive("practice", "practice", "student")'), true);
  assert.equal(app.eval('isRouteActive("practice", "studio", "student")'), true);
  assert.equal(app.eval('isRouteActive("flashcards", "flashcards", "student")'), true);
  assert.equal(app.eval('isRouteActive("flashcards", "assess", "student")'), true);
  assert.equal(app.eval('isRouteActive("board", "board", "student")'), true);
  assert.equal(app.eval('isRouteActive("board", "quest", "student")'), true);

  // Teacher subviews
  assert.equal(app.eval('isRouteActive("home", "home", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("home", "teacher-preview", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("teacher", "teacher", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("teacher", "students", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("teacher-studio", "teacher-studio", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("teacher-studio", "practice", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("board", "board", "teacher")'), true);
  assert.equal(app.eval('isRouteActive("board", "quest", "teacher")'), true);

  // Admin subviews
  assert.equal(app.eval('isRouteActive("admin", "admin", "admin")'), true);
  assert.equal(app.eval('isRouteActive("admin", "home", "admin")'), true);
  assert.equal(app.eval('isRouteActive("reports", "settings", "admin")'), true);
  assert.equal(app.eval('isRouteActive("reports", "reports", "admin")'), true);
});

test('Rendering: renderNavButtons outputs accessible buttons with SVG icons and active state', () => {
  const app = loadApp();

  const studentHtml = app.eval('renderNavButtons("student", "practice")');
  assert.ok(studentHtml.includes('data-v="practice"'), 'Must have data-v attribute');
  assert.ok(studentHtml.includes('data-nav-route="practice"'), 'Must have stable data-nav-route attribute');
  assert.ok(studentHtml.includes('aria-current="page"'), 'Active item must have aria-current="page"');
  assert.ok(studentHtml.includes('class="on active"'), 'Active item must have active class');
  assert.ok(studentHtml.includes('<svg class="ui-icon"'), 'Buttons must include SVG icons');

  // Verify guest has exactly 4 button elements
  const guestHtml = app.eval('renderNavButtons("guest", "home")');
  const buttonMatches = guestHtml.match(/<button/g) || [];
  assert.equal(buttonMatches.length, 4, 'Guest navigation must render exactly 4 button elements');
});

test('Account Switching: Navigation dynamically updates destinations without state leakage', () => {
  const app = loadApp();
  const getTabs = (role) => JSON.parse(JSON.stringify(app.eval(`bottomTabsForRole("${role}")`)));

  // 1. Initial Guest
  assert.equal(getTabs("guest").length, 4);
  assert.deepEqual(getTabs("guest"), ['home', 'practice', 'about', 'profile']);

  // 2. Login as Student
  app.eval('AUTH.login("student@basawisyo.ph", "student123")');
  assert.equal(app.eval('AUTH.currentUser.role'), 'student');
  assert.equal(getTabs("student").length, 5);
  assert.deepEqual(getTabs("student"), ['home', 'practice', 'flashcards', 'board', 'profile']);

  // 3. Switch to Teacher
  app.eval('AUTH.logout()');
  app.eval('AUTH.login("teacher@basawisyo.ph", "teacher123")');
  assert.equal(app.eval('AUTH.currentUser.role'), 'teacher');
  assert.equal(getTabs("teacher").length, 5);
  assert.deepEqual(getTabs("teacher"), ['home', 'teacher', 'teacher-studio', 'board', 'reports']);

  // 4. Switch to Admin
  app.eval('AUTH.logout()');
  app.eval('AUTH.login("admin@basawisyo.ph", "admin123")');
  assert.equal(app.eval('AUTH.currentUser.role'), 'admin');
  assert.equal(getTabs("admin").length, 5);
  assert.deepEqual(getTabs("admin"), ['admin', 'users', 'classes', 'practice', 'reports']);

  // 5. Logout back to Guest
  app.eval('AUTH.logout()');
  assert.equal(app.eval('AUTH.currentUser'), null);
  assert.equal(getTabs("guest").length, 4);
});
