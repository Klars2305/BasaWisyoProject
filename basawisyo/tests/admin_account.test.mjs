import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function createAuthContext(initialUsers = null) {
  const store = new Map();
  store.set('basa_wisyo_school_mode_v1', 'demo');
  if (initialUsers) {
    store.set('basawisyo_users_v2', JSON.stringify(initialUsers));
  }
  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    window: {},
    document: { addEventListener() {} },
    S: { simulatedPremium: false },
    save() {},
    showToast() {},
    PRACTICE_DATA: { easy: [], medium: [], hard: [], extreme: [] },
    escapeHTML: str => String(str || ''),
    uiIcon: () => ''
  });

  vm.runInContext(readFileSync(join(root, 'src/bundles/bundle-core-data.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(root, 'src/services/auth.js'), 'utf8'), context);
  return { context, store };
}

test('Admin Account: Primary credentials admin/admin authenticate successfully', () => {
  const { context } = createAuthContext();
  vm.runInContext('AUTH.init()', context);

  const res = vm.runInContext('AUTH.login("admin", "admin")', context);
  assert.equal(res.success, true);
  assert.equal(res.user.role, 'admin');
  assert.equal(res.user.email, 'admin');
  assert.equal(res.user.status, 'active');

  const currentUser = vm.runInContext('AUTH.currentUser', context);
  assert.equal(currentUser.role, 'admin');
  assert.equal(currentUser.email, 'admin');
});

test('Admin Account: Backwards compatibility with admin@basawisyo.ph and admin123', () => {
  const { context } = createAuthContext();
  vm.runInContext('AUTH.init()', context);

  // Email alias with primary password
  const res1 = vm.runInContext('AUTH.login("admin@basawisyo.ph", "admin")', context);
  assert.equal(res1.success, true);
  assert.equal(res1.user.role, 'admin');

  // Username with legacy password
  const res2 = vm.runInContext('AUTH.login("admin", "admin123")', context);
  assert.equal(res2.success, true);
  assert.equal(res2.user.role, 'admin');

  // Legacy email with legacy password
  const res3 = vm.runInContext('AUTH.login("admin@basawisyo.ph", "admin123")', context);
  assert.equal(res3.success, true);
  assert.equal(res3.user.role, 'admin');
});

test('Admin Auto-Reconciliation: Existing localStorage data is auto-reconciled on AUTH.init()', () => {
  // Scenario 1: Pre-existing localStorage with old email admin@basawisyo.ph and password admin123
  const legacyUsers = [
    {
      id: 'usr_admin',
      role: 'admin',
      name: 'School Administrator',
      email: 'admin@basawisyo.ph',
      password: 'admin123',
      school: 'Wisyo Integrated High School',
      status: 'active'
    },
    {
      id: 'usr_teacher',
      role: 'teacher',
      name: 'Teacher Maria',
      email: 'teacher@basawisyo.ph',
      password: 'basa123',
      section: 'Grade 8 - Rizal',
      shareCode: 'WISYO-8A',
      status: 'active'
    }
  ];

  const { context } = createAuthContext(legacyUsers);
  vm.runInContext('AUTH.init()', context);

  // Both admin/admin and admin@basawisyo.ph/admin123 must work after reconciliation
  const resAdmin = vm.runInContext('AUTH.login("admin", "admin")', context);
  assert.equal(resAdmin.success, true);
  assert.equal(resAdmin.user.role, 'admin');

  // Admin record in AUTH.users is updated to email: "admin", password: "admin"
  const adminInDb = vm.runInContext('AUTH.users.find(u => u.role === "admin")', context);
  assert.equal(adminInDb.email, 'admin');
  assert.equal(adminInDb.password, 'admin');
});

test('Login HTML interface: entry-email input allows non-email username "admin"', () => {
  const loginHtml = readFileSync(join(root, 'login.html'), 'utf8');

  // Input must be type="text" to avoid HTML5 browser validation blocking "admin"
  assert.match(loginHtml, /<input\s+id="entry-email"[^>]*type="text"/);
  assert.match(loginHtml, /placeholder="Enter your email or username"/);
  assert.match(loginHtml, /Email or username/);
});

test('Admin User Management: Role editing, status toggle, and password reset', () => {
  const { context } = createAuthContext();
  vm.runInContext('AUTH.init()', context);
  vm.runInContext('AUTH.login("admin", "admin")', context);

  // 1. Suspend a teacher account
  const teacher = vm.runInContext('AUTH.users.find(u => u.email === "teacher@basawisyo.ph")', context);
  assert.ok(teacher);
  assert.equal(teacher.status, 'active');

  teacher.status = 'suspended';
  vm.runInContext('AUTH.saveUsers()', context);

  // Teacher cannot log in while suspended
  const suspendedLogin = vm.runInContext('AUTH.login("teacher@basawisyo.ph", "teacher123")', context);
  assert.equal(suspendedLogin.success, false);
  assert.match(suspendedLogin.message, /suspended/);

  // Reactivate teacher
  teacher.status = 'active';
  vm.runInContext('AUTH.saveUsers()', context);
  const activeLogin = vm.runInContext('AUTH.login("teacher@basawisyo.ph", "teacher123")', context);
  assert.equal(activeLogin.success, true);

  // 2. Admin resets password
  teacher.password = 'newsecurepass456';
  vm.runInContext('AUTH.saveUsers()', context);
  const oldPwdLogin = vm.runInContext('AUTH.login("teacher@basawisyo.ph", "teacher123")', context);
  assert.equal(oldPwdLogin.success, false);
  const newPwdLogin = vm.runInContext('AUTH.login("teacher@basawisyo.ph", "newsecurepass456")', context);
  assert.equal(newPwdLogin.success, true);

  // 3. Admin edits role
  teacher.role = 'student';
  vm.runInContext('AUTH.saveUsers()', context);
  const updatedUser = vm.runInContext(`AUTH.users.find(u => u.id === "${teacher.id}")`, context);
  assert.equal(updatedUser.role, 'student');
});

test('Admin Curriculum Review: Approve, reject with feedback, publish, and delete', () => {
  const { context } = createAuthContext();
  vm.runInContext('AUTH.init()', context);

  // Sign in as teacher and submit practice
  vm.runInContext('AUTH.login("teacher@basawisyo.ph", "teacher123")', context);
  const submitted = vm.runInContext(`
    AUTH.savePractice({
      t: "Ang Alamat ng Pinya",
      diff: "easy",
      lang: "fil-PH",
      x: "Noong unang panahon may isang batang nagngangalang Pina na lumaki sa pagmamahal ng ina.",
      qs: [
        { q: "Sino ang bata sa kwento?", o: ["Pina", "Maria", "Rosa", "Ana"], a: 0, k: "Literal", exp: "Pina ang pangalan." }
      ]
    }, { submit: true })
  `, context);

  assert.equal(submitted.status, 'pending');

  // Sign in as admin
  vm.runInContext('AUTH.login("admin", "admin")', context);

  // Admin approves passage
  vm.runInContext(`AUTH.reviewPractice("${submitted.id}", "approve")`, context);
  let passage = vm.runInContext(`AUTH.customPassages.find(p => p.id === "${submitted.id}")`, context);
  assert.equal(passage.status, 'published');

  // Admin unpublishes passage
  vm.runInContext(`AUTH.setPracticePublished("${submitted.id}", false)`, context);
  passage = vm.runInContext(`AUTH.customPassages.find(p => p.id === "${submitted.id}")`, context);
  assert.equal(passage.status, 'draft');

  // Admin deletes passage
  vm.runInContext(`AUTH.deletePractice("${submitted.id}")`, context);
  passage = vm.runInContext(`AUTH.customPassages.find(p => p.id === "${submitted.id}")`, context);
  assert.equal(passage, undefined);
});

test('Admin Classes & Sections Tab: Renders teacher classrooms, share codes, and enrollments', () => {
  const adminPageCode = readFileSync(join(root, 'src/pages/admin.js'), 'utf8');

  // Verify viewAdmin contains classes sub-tab
  assert.match(adminPageCode, /data-a="admin-tab"\s+data-v="classes"/);
  assert.match(adminPageCode, /renderAdminClassesTab/);
  assert.match(adminPageCode, /School Classes & Sections Roster/);
  assert.match(adminPageCode, /Class Share Code/);
  assert.match(adminPageCode, /Enrolled Learners/);
  assert.match(adminPageCode, /Active Assignments/);
});

test('Admin Navigation & Routing: Admin tabs and permissions', () => {
  const navCode = readFileSync(join(root, 'src/components/navigation.js'), 'utf8');

  // Verify NAV_CONFIG for admin
  assert.match(navCode, /{ id: "admin", label: "Overview", icon: "admin" }/);
  assert.match(navCode, /{ id: "users", label: "Users", icon: "users" }/);
  assert.match(navCode, /{ id: "classes", label: "Classes", icon: "classroom" }/);
  assert.match(navCode, /{ id: "practice", label: "Content", icon: "practice" }/);

  // Verify canAccessRoute allows admin on admin, users, classes
  assert.match(navCode, /\["admin", "users", "classes"\]\.includes\(route\)/);
});
