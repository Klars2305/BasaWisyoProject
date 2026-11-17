import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = process.cwd();

function createAuthContext() {
  const store = new Map();
  const localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); },
    clear: () => { store.clear(); }
  };
  const sandbox = {
    console,
    localStorage,
    S: { lvl: null, w: 0, guestJourney: { baseTier: 0, results: {}, skillEvidence: {}, frame: "none", boardOptIn: false } },
    GUEST_MODE: false,
    ACTIVE_QUIZ: null,
    QUIZ_RESULT: null,
    CHAT_HISTORY: [],
    PHIL_IRI_LEVELS: ["Frustration", "Instructional", "Independent", "Mastery"],
    DIFF_KEYS: ["easy", "medium", "hard", "extreme"],
    save: () => {},
    journeyValid: () => true,
    journeyEmpty: () => ({ baseTier: 0, results: {}, skillEvidence: {}, frame: "none", boardOptIn: false }),
    createInitialState: () => ({ lvl: null, w: 0, guestJourney: { baseTier: 0, results: {}, skillEvidence: {}, frame: "none", boardOptIn: false } }),
    getStateStorageKey: id => (id ? `basa_wisyo_state_${id}` : "basa_wisyo_state_guest"),
    switchAccountState: targetUser => {
      sandbox.ACTIVE_STATE_ACCOUNT_ID = targetUser && targetUser.role === "student" ? targetUser.id : null;
    }
  };
  const context = vm.createContext(sandbox);
  const authCode = readFileSync(join(root, "src/services/auth.js"), "utf8");
  vm.runInContext(authCode, context);
  return { context, store };
}

test("Phase 1 - BW-001: Salted SHA-256 password hashing and verification", () => {
  const { context } = createAuthContext();
  vm.runInContext("AUTH.init()", context);

  // Hash generation
  const hash1 = vm.runInContext('AUTH.hashPassword("SecretP@ss123")', context);
  const hash2 = vm.runInContext('AUTH.hashPassword("SecretP@ss123")', context);

  assert.match(hash1, /^sha256\$[0-9a-f]{16}\$[0-9a-f]{64}$/);
  assert.match(hash2, /^sha256\$[0-9a-f]{16}\$[0-9a-f]{64}$/);
  // Different random salts produce different hashes for the same password
  assert.notEqual(hash1, hash2);

  // Verification
  const user = { role: "student", passwordHash: hash1 };
  assert.equal(vm.runInContext(`AUTH.verifyPassword("SecretP@ss123", ${JSON.stringify(user)})`, context), true);
  assert.equal(vm.runInContext(`AUTH.verifyPassword("WrongPassword", ${JSON.stringify(user)})`, context), false);
  assert.equal(vm.runInContext(`AUTH.verifyPassword("", ${JSON.stringify(user)})`, context), false);
});

test("Phase 1 - BW-001: Auto-migration of legacy plaintext password to salted hash on init and login", () => {
  const { context, store } = createAuthContext();

  // Seed with legacy user that only has plaintext password and no passwordHash
  const legacyUsers = [
    {
      id: "usr_legacy_1",
      email: "legacy@basawisyo.ph",
      password: "legacypassword999",
      name: "Legacy Learner",
      role: "student",
      school: "Rizal High",
      section: "Grade 8",
      status: "active",
      createdAt: "2026-01-01"
    }
  ];
  store.set("basa_wisyo_users_v2", JSON.stringify(legacyUsers));

  // Initialize AUTH - should auto-migrate missing passwordHash
  vm.runInContext("AUTH.init()", context);

  const migratedUser = vm.runInContext('AUTH.users.find(u => u.email === "legacy@basawisyo.ph")', context);
  assert.ok(migratedUser.passwordHash, "passwordHash must be generated during auto-migration");
  assert.match(migratedUser.passwordHash, /^sha256\$/);

  // Successful login using verified password
  const loginRes = vm.runInContext('AUTH.login("legacy@basawisyo.ph", "legacypassword999")', context);
  assert.equal(loginRes.success, true);
  assert.equal(loginRes.user.email, "legacy@basawisyo.ph");
});

test("Phase 1 - BW-002: Rejection of client-side admin privilege escalation", () => {
  const { context } = createAuthContext();
  vm.runInContext("AUTH.init()", context);

  // Attacker tries to register as an admin
  const regAdmin = vm.runInContext(`
    AUTH.register({
      name: "Attacker User",
      email: "attacker@basawisyo.ph",
      password: "password123",
      role: "admin"
    })
  `, context);

  assert.equal(regAdmin.success, false);
  assert.match(regAdmin.message, /student or teacher/i);

  // Verify attacker was not inserted
  const found = vm.runInContext('AUTH.users.find(u => u.email === "attacker@basawisyo.ph")', context);
  assert.equal(found, undefined);
});

test("Phase 1 - BW-003: Account isolation, in-flight quiz invalidation, and session cleanup on logout", () => {
  const { context } = createAuthContext();
  vm.runInContext("AUTH.init()", context);

  // Student 1 logs in
  vm.runInContext('AUTH.login("student@basawisyo.ph", "student123")', context);
  assert.ok(vm.runInContext("AUTH.currentUser", context));

  // Student 1 starts in-flight quiz and chat
  vm.runInContext('ACTIVE_QUIZ = { passageId: "story_1", score: 3 }', context);
  vm.runInContext('QUIZ_RESULT = { score: 3, total: 5 }', context);
  vm.runInContext('CHAT_HISTORY = [{ role: "user", text: "Help me" }]', context);

  // Student 1 logs out
  const logoutRes = vm.runInContext("AUTH.logout()", context);
  assert.equal(logoutRes, true);
  assert.equal(vm.runInContext("AUTH.currentUser", context), null);

  // Verify in-flight quiz, result, and chat were invalidated
  assert.equal(vm.runInContext("ACTIVE_QUIZ", context), null);
  assert.equal(vm.runInContext("QUIZ_RESULT", context), null);
  assert.equal(vm.runInContext("CHAT_HISTORY.length", context), 0);
});

test("Phase 1 - BW-004 & BW-005: Formative placement labeling and unmeasured WPM safeguards", () => {
  const { context } = createAuthContext();
  vm.runInContext("AUTH.init()", context);

  // Create guest token without active reading timer
  const token = vm.runInContext("AUTH.createGuestToken(1, null, 80, 'Guest Learner')", context);
  const tokenRecord = vm.runInContext(`AUTH.guestTokens["${token}"]`, context);

  assert.ok(tokenRecord);
  assert.equal(tokenRecord.wpm, null, "WPM must be null when unmeasured, never hardcoded to 110 or 105");
  assert.equal(tokenRecord.comp, 80);

  // Import guest token into classroom
  const teacher = vm.runInContext('AUTH.users.find(u => u.role === "teacher")', context);
  const importRes = vm.runInContext(`AUTH.importGuestToken("${token}", "${teacher.shareCode}")`, context);
  assert.equal(importRes.success, true);

  // Read assessment page code to verify disclaimers
  const assessPage = readFileSync(join(root, "src/pages/assess.js"), "utf8");
  assert.match(assessPage, /not an official DepEd Phil-IRI classification/i);
  assert.match(assessPage, /does not infer reading speed \(WPM\)/i);
  assert.match(assessPage, /does not use XP or rankings/i);
});

test("Phase 1 - Backup validation supports salted passwordHash records", () => {
  const stateCode = readFileSync(join(root, "src/services/state.js"), "utf8");
  const backupCode = readFileSync(join(root, "src/services/backup.js"), "utf8");
  const sandbox = {
    console,
    DIFF_KEYS: ["easy", "medium", "hard", "extreme"],
    journeyValid: () => true,
    normalizePassage: () => {}
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(stateCode, context);
  vm.runInContext(backupCode, context);

  const baseState = vm.runInContext("createInitialState()", context);
  const validPayload = {
    format: "BasaWisyoBackup",
    version: 1,
    exportDate: new Date().toISOString(),
    school: "Rizal National High School",
    users: [
      {
        id: "usr_hashed_1",
        email: "hashed@basawisyo.ph",
        name: "Hashed Student",
        role: "student",
        passwordHash: "sha256$abcdef0123456789$1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      }
    ],
    assignments: [],
    guestTokens: {},
    customPassages: [],
    systemState: {
      ...baseState,
      lvl: 1,
      l0: 1,
      w: 100,
      ss: 1
    }
  };

  const validated = vm.runInContext(`validateBackup(${JSON.stringify(validPayload)})`, context);
  assert.equal(validated.users[0].id, "usr_hashed_1");
  assert.equal(validated.users[0].passwordHash.startsWith("sha256$"), true);
});
