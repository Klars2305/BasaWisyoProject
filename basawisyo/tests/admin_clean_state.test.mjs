import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const authSource = readFileSync(join(root, 'src/services/auth.js'), 'utf8');

function loadAuth(store = new Map(), failWrite = null) {
  const context = vm.createContext({
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem(key, value) {
        if (key === failWrite) throw new Error('Storage full');
        store.set(key, String(value));
      },
      removeItem: key => store.delete(key)
    },
    S: { lvl: null },
    GUEST_MODE: false,
    save() {}
  });
  vm.runInContext(authSource, context);
  vm.runInContext('AUTH.init()', context);
  return { context, store, eval: code => vm.runInContext(code, context) };
}

test('new browser starts with one admin and zero teachers, students, and assignments', () => {
  const app = loadAuth();
  assert.deepEqual(JSON.parse(app.store.get('basa_wisyo_users_v2')).map(user => user.role), ['admin']);
  assert.deepEqual(JSON.parse(app.store.get('basa_wisyo_assignments_v2')), []);
  assert.equal(app.store.has('basa_wisyo_school_mode_v1'), false);
});

test('existing school accounts and assignments survive initialization unchanged', () => {
  const storedUsers = [
    { id: 'school-admin', role: 'admin', name: 'Principal', email: 'admin', password: 'admin', passwordHash: 'already-hashed', status: 'active' },
    { id: 'real-teacher', role: 'teacher', name: 'Real Teacher', email: 'teacher@example.test', password: 'secret', passwordHash: 'already-hashed', status: 'active' }
  ];
  const storedAssignments = [{ id: 'real-assignment', teacherCode: 'REAL-CODE', passageId: 'easy_1', title: 'Reading' }];
  const store = new Map([
    ['basa_wisyo_users_v2', JSON.stringify(storedUsers)],
    ['basa_wisyo_assignments_v2', JSON.stringify(storedAssignments)]
  ]);
  const app = loadAuth(store);
  assert.equal(app.eval('AUTH.users.length'), 2);
  assert.equal(app.eval('AUTH.assignments.length'), 1);
  assert.equal(store.get('basa_wisyo_users_v2'), JSON.stringify(storedUsers));
  assert.equal(store.get('basa_wisyo_assignments_v2'), JSON.stringify(storedAssignments));
});

test('sample load requires admin, is explicit, and never duplicates records', () => {
  const app = loadAuth();
  assert.equal(app.eval('AUTH.loadSampleDemoData().success'), false);
  app.eval('AUTH.login("admin", "admin")');
  const result = app.eval('AUTH.loadSampleDemoData()');
  assert.equal(result.success, true);
  assert.equal(result.teachers, 1);
  assert.equal(result.students, 5);
  assert.equal(app.eval('AUTH.users.length'), 7);
  assert.equal(app.eval('AUTH.assignments.length'), 2);
  assert.equal(app.eval('AUTH.loadSampleDemoData().success'), false);
  assert.equal(app.eval('AUTH.users.length'), 7);
  const reloaded = loadAuth(app.store);
  assert.equal(reloaded.eval('AUTH.users.length'), 7);
  assert.equal(reloaded.eval('AUTH.assignments.length'), 2);
});

test('sample load rolls back browser records when a write fails', () => {
  const app = loadAuth();
  app.eval('AUTH.login("admin", "admin")');
  const previousUsers = app.store.get('basa_wisyo_users_v2');
  const previousAssignments = app.store.get('basa_wisyo_assignments_v2');
  const broken = loadAuth(app.store, 'basa_wisyo_assignments_v2');
  assert.equal(broken.eval('AUTH.loadSampleDemoData().success'), false);
  assert.equal(broken.eval('AUTH.users.length'), 1);
  assert.equal(app.store.get('basa_wisyo_users_v2'), previousUsers);
  assert.equal(app.store.get('basa_wisyo_assignments_v2'), previousAssignments);
});
