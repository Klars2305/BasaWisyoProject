const BACKUP_FORMAT = "BasaWisyoBackup";
const BACKUP_VERSION = 1;
const STATE_KEY = "basa_wisyo_state_v2";

function backupIsObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function backupRequire(condition, message) {
  if (!condition) throw new Error(message);
}

function backupText(value, label) {
  backupRequire(typeof value === "string" && value.trim().length > 0, `${label} is missing or invalid.`);
}

function backupUnique(records, label, key) {
  const seen = new Set();
  for (const record of records) {
    const value = key(record);
    backupRequire(!seen.has(value), `${label} contains duplicate entries.`);
    seen.add(value);
  }
}

function validateBackupState(raw) {
  backupRequire(backupIsObject(raw), "systemState must be an object.");
  const defaults = createInitialState();
  const allowed = new Set([...Object.keys(defaults), "guestToken"]);
  for (const key of Object.keys(raw)) {
    backupRequire(allowed.has(key), `Unsupported systemState field: ${key}.`);
  }
  const state = { ...defaults, ...raw };
  for (const key of ["lvl", "l0"]) {
    backupRequire(state[key] === null || (Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 3),
      `systemState.${key} must be a reading level or null.`);
  }
  for (const key of ["w", "ss", "sub", "pay", "pm"]) {
    backupRequire(typeof state[key] === "number" && Number.isFinite(state[key]) && state[key] >= 0,
      `systemState.${key} must be a nonnegative number.`);
  }
  backupRequire(Array.isArray(state.done) && state.done.every(id => typeof id === "string"),
    "systemState.done must be a list of passage IDs.");
  backupUnique(state.done, "systemState.done", id => id);
  backupRequire(journeyValid(state.guestJourney), "systemState.guestJourney is invalid.");
  backupRequire(backupIsObject(state.sk), "systemState.sk must be an object.");
  for (const counts of Object.values(state.sk)) {
    backupRequire(Array.isArray(counts) && counts.length === 2
      && counts.every(Number.isInteger) && counts[0] >= 0 && counts[1] >= counts[0],
    "systemState.sk contains invalid skill counts.");
  }
  backupRequire(Array.isArray(state.sh), "systemState.sh must be a list of passages.");
  state.sh.forEach(normalizePassage);
  backupUnique(state.sh, "systemState.sh", passage => passage.id);
  backupRequire(state.miss === null || backupIsObject(state.miss),
    "systemState.miss must be an object or null.");
  backupRequire(state.theme === "light" || state.theme === "dark", "systemState.theme is invalid.");
  backupRequire(typeof state.fontScale === "number" && Number.isFinite(state.fontScale)
    && state.fontScale >= 0.5 && state.fontScale <= 3, "systemState.fontScale is invalid.");
  backupRequire(state.activeDiff === "all" || DIFF_KEYS.includes(state.activeDiff),
    "systemState.activeDiff is invalid.");
  if (state.guestToken !== undefined) backupText(state.guestToken, "systemState.guestToken");
  return state;
}

function validateBackup(raw) {
  backupRequire(backupIsObject(raw), "Backup must be a JSON object.");
  const isLegacy = raw.format === undefined && raw.version === undefined;
  if (isLegacy) {
    backupRequire(typeof raw.exportDate === "string", "Unsupported backup format.");
  } else {
    backupRequire(raw.format === BACKUP_FORMAT, "Unsupported backup format.");
    backupRequire(raw.version === BACKUP_VERSION,
      `Unsupported backup version: ${String(raw.version)}.`);
  }
  backupRequire(typeof raw.exportDate === "string" && Number.isFinite(Date.parse(raw.exportDate)),
    "Backup export date is invalid.");
  backupText(raw.school, "School");

  backupRequire(Array.isArray(raw.users), "users must be an array.");
  for (const user of raw.users) {
    backupRequire(backupIsObject(user), "users contains an invalid record.");
    for (const field of ["id", "email", "name", "role"]) {
      backupText(user[field], `User ${field}`);
    }
    const hasPassword = (typeof user.password === "string" && user.password.trim().length > 0)
      || (typeof user.passwordHash === "string" && user.passwordHash.trim().length > 0);
    backupRequire(hasPassword, "User password is missing or invalid.");
    backupRequire(["student", "teacher", "admin"].includes(user.role), "User role is invalid.");
    backupRequire(user.status === undefined || ["active", "suspended"].includes(user.status),
      "User status is invalid.");
    backupRequire(user.journey === undefined || journeyValid(user.journey), "User journey is invalid.");
    backupRequire(user.journeyOverride === undefined || user.journeyOverride === null
      || (Number.isInteger(user.journeyOverride) && user.journeyOverride >= 0 && user.journeyOverride < DIFF_KEYS.length),
      "User journey override is invalid.");
  }
  backupUnique(raw.users, "users", user => user.id);
  backupUnique(raw.users, "users email", user => user.email.trim().toLowerCase());

  backupRequire(Array.isArray(raw.assignments), "assignments must be an array.");
  for (const assignment of raw.assignments) {
    backupRequire(backupIsObject(assignment), "assignments contains an invalid record.");
    for (const field of ["id", "teacherCode", "passageId", "title"]) {
      backupText(assignment[field], `Assignment ${field}`);
    }
  }
  backupUnique(raw.assignments, "assignments", assignment => assignment.id);

  backupRequire(backupIsObject(raw.guestTokens), "guestTokens must be an object.");
  for (const [token, data] of Object.entries(raw.guestTokens)) {
    backupText(token, "Guest token");
    backupRequire(backupIsObject(data), `Guest token ${token} is invalid.`);
  }

  backupRequire(Array.isArray(raw.customPassages), "customPassages must be an array.");
  raw.customPassages.forEach(normalizePassage);
  backupUnique(raw.customPassages, "customPassages", passage => passage.id);
  const systemState = validateBackupState(raw.systemState);

  if (raw.flashcardDecks !== undefined) {
    backupRequire(backupIsObject(raw.flashcardDecks), "flashcardDecks must be an object.");
  }
  if (raw.materials !== undefined) {
    backupRequire(Array.isArray(raw.materials), "materials must be an array.");
  }
  if (raw.userStates !== undefined) {
    backupRequire(backupIsObject(raw.userStates), "userStates must be an object.");
  }

  return {
    users: raw.users,
    assignments: raw.assignments,
    guestTokens: raw.guestTokens,
    customPassages: raw.customPassages,
    systemState,
    flashcardDecks: raw.flashcardDecks || {},
    materials: raw.materials || [],
    userStates: raw.userStates || {}
  };
}

function createBackupPayload() {
  const flashcardDecks = {};
  const userStates = {};
  try {
    if (typeof localStorage !== "undefined") {
      for (const k of ["basawisyo_flashcards_v1_guest", "basa_wisyo_flashcards_guest", "basa_wisyo_state_guest"]) {
        const val = localStorage.getItem(k);
        if (val) {
          if (k.includes("flashcards")) flashcardDecks[k] = JSON.parse(val);
          if (k.includes("state")) userStates[k] = JSON.parse(val);
        }
      }
      for (const u of AUTH.users) {
        const fcKeys = [`basawisyo_flashcards_v1_${u.id}`, `basa_wisyo_flashcards_${u.id}`];
        for (const fcKey of fcKeys) {
          const fcVal = localStorage.getItem(fcKey);
          if (fcVal) flashcardDecks[fcKey] = JSON.parse(fcVal);
        }
        const stKey = `basa_wisyo_state_${u.id}`;
        const stVal = localStorage.getItem(stKey);
        if (stVal) userStates[stKey] = JSON.parse(stVal);
      }
    }
  } catch (e) {}

  const materials = typeof readLocalMaterials === "function" ? readLocalMaterials() : [];

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    school: "Rizal National High School",
    users: AUTH.users,
    assignments: AUTH.assignments,
    guestTokens: AUTH.guestTokens,
    customPassages: AUTH.customPassages,
    systemState: S,
    flashcardDecks,
    materials,
    userStates
  };
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(createBackupPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BasaWisyo_Backup_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function restoreBackupFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("File is not valid JSON.");
  }
  const data = validateBackup(parsed);
  if (!confirm("Restore this backup? It will replace current local accounts, assignments, passages, and progress, then sign you out.")) {
    return false;
  }

  const keys = [AUTH.USERS_KEY, AUTH.ASSIGNMENTS_KEY, AUTH.GUEST_TOKENS_KEY,
    AUTH.CUSTOM_PASSAGES_KEY, STATE_KEY, AUTH.SESSION_KEY];

  const replacements = new Map([
    [AUTH.USERS_KEY, JSON.stringify(data.users)],
    [AUTH.ASSIGNMENTS_KEY, JSON.stringify(data.assignments)],
    [AUTH.GUEST_TOKENS_KEY, JSON.stringify(data.guestTokens)],
    [AUTH.CUSTOM_PASSAGES_KEY, JSON.stringify(data.customPassages)],
    [STATE_KEY, JSON.stringify(data.systemState)]
  ]);

  if (data.flashcardDecks && typeof data.flashcardDecks === "object") {
    for (const [k, deck] of Object.entries(data.flashcardDecks)) {
      keys.push(k);
      replacements.set(k, JSON.stringify(deck));
    }
  }

  if (Array.isArray(data.materials) && data.materials.length > 0) {
    keys.push("basa_wisyo_materials_v1");
    replacements.set("basa_wisyo_materials_v1", JSON.stringify(data.materials));
  }

  if (data.userStates && typeof data.userStates === "object") {
    for (const [k, st] of Object.entries(data.userStates)) {
      keys.push(k);
      replacements.set(k, JSON.stringify(st));
    }
  }

  const previous = new Map(keys.map(key => [key, localStorage.getItem(key)]));

  try {
    for (const [key, value] of replacements) localStorage.setItem(key, value);
    localStorage.removeItem(AUTH.SESSION_KEY);
  } catch (error) {
    try {
      for (const key of keys) localStorage.removeItem(key);
      for (const [key, value] of previous) {
        if (value !== null) localStorage.setItem(key, value);
      }
    } catch (rollbackError) {
      throw new Error("Restore failed and local storage could not be fully rolled back. Do not reload this page; export the current data for recovery.");
    }
    throw new Error("Restore failed while writing local storage. Previous data was restored.");
  }

  AUTH.users = data.users;
  AUTH.assignments = data.assignments;
  AUTH.guestTokens = data.guestTokens;
  AUTH.customPassages = data.customPassages;
  AUTH.currentUser = null;
  S = data.systemState;
  GUEST_MODE = false;
  ACTIVE_QUIZ = null;
  CURRENT_TAB = "home";
  SEARCH_QUERY = "";
  return true;
}
