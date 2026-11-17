import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

test('Phase 2: renderStatusState produces correct semantic markup for all status states', () => {
  const coreCode = readFileSync(join(root, 'src/utils/core.js'), 'utf8');
  const context = vm.createContext({
    escapeHTML: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  });
  vm.runInContext(coreCode, context);

  // Loading state
  const loadingHtml = vm.runInContext(`renderStatusState({ type: 'loading', message: 'Loading reading records…' })`, context);
  assert.ok(loadingHtml.includes('status-loading'));
  assert.ok(loadingHtml.includes('Loading reading records…'));
  assert.ok(loadingHtml.includes('role="status"'));

  // Offline state
  const offlineHtml = vm.runInContext(`renderStatusState({ type: 'offline', message: 'Working offline' })`, context);
  assert.ok(offlineHtml.includes('status-offline'));
  assert.ok(offlineHtml.includes('Offline'));

  // Failure state with retry
  const failureHtml = vm.runInContext(`renderStatusState({ type: 'failure', title: 'Save Failed', message: 'Storage is full', actionLabel: 'Try Again', actionA: 'retry-save' })`, context);
  assert.ok(failureHtml.includes('status-failure'));
  assert.ok(failureHtml.includes('data-a="retry-save"'));
  assert.ok(failureHtml.includes('Try Again'));

  // Empty state
  const emptyHtml = vm.runInContext(`renderStatusState({ type: 'empty', title: 'No Passages Found', message: 'Try another search' })`, context);
  assert.ok(emptyHtml.includes('status-empty'));
  assert.ok(emptyHtml.includes('No Passages Found'));
});

test('Phase 2: Storage quota and disabled storage do not crash state service and support retrySave', () => {
  const stateCode = readFileSync(join(root, 'src/services/state.js'), 'utf8');
  let quotaError = false;
  const store = new Map();
  const storageMock = {
    getItem: k => store.get(k) ?? null,
    setItem: (k, v) => {
      if (quotaError) {
        const err = new Error('QuotaExceededError: Storage quota exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(k, String(v));
    },
    removeItem: k => store.delete(k)
  };

  const context = vm.createContext({
    localStorage: storageMock,
    sessionStorage: storageMock,
    AUTH: { currentUser: { id: 'stud_test', role: 'student' } },
    showToast: () => {},
    console
  });

  vm.runInContext(stateCode, context);
  vm.runInContext('switchAccountState({ id: "stud_test", role: "student" })', context);

  // Normal save
  vm.runInContext('S.xp = 100; save()', context);
  assert.equal(vm.runInContext('STORAGE_STATE.status', context), 'saved');
  assert.equal(vm.runInContext('getStorageStatus().status', context), 'saved');

  // Trigger quota error
  quotaError = true;
  const failRes = vm.runInContext('S.xp = 150; save()', context);
  assert.equal(failRes.success, false);
  assert.equal(vm.runInContext('STORAGE_STATE.status', context), 'failed');
  assert.equal(vm.runInContext('getStorageStatus().status', context), 'failed');
  // In-memory state is preserved even when storage fails
  assert.equal(vm.runInContext('S.xp', context), 150);

  // Resolve error and retry
  quotaError = false;
  const retried = vm.runInContext('retrySave()', context);
  assert.equal(retried.success, true);
  assert.equal(vm.runInContext('STORAGE_STATE.status', context), 'saved');
});

test('Phase 2: Corrupted JSON state is quarantined without crashing loadStateForAccount', () => {
  const stateCode = readFileSync(join(root, 'src/services/state.js'), 'utf8');
  const store = new Map();
  store.set('basa_wisyo_state_stud_corrupt', '{ this is broken JSON !!');

  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    AUTH: { currentUser: { id: 'stud_corrupt', role: 'student' } },
    showToast: () => {},
    console
  });

  vm.runInContext(stateCode, context);
  // Must not throw
  assert.doesNotThrow(() => {
    vm.runInContext('switchAccountState({ id: "stud_corrupt", role: "student" })', context);
  });
  // Fallback to fresh initial state
  assert.equal(vm.runInContext('S.w', context), 0);
  assert.equal(vm.runInContext('STORAGE_STATE.status', context), 'saved');
  // Corrupted state quarantined in localStorage with _corrupted timestamp
  assert.ok(store.has('basa_wisyo_corrupted_basa_wisyo_state_stud_corrupt'));
});

test('Phase 2: Local data sync status accurately reflects synced, syncing, offline, and pending states', () => {
  const localDataCode = readFileSync(join(root, 'src/services/local-data.js'), 'utf8');
  const context = vm.createContext({
    LOCAL_DATA: null,
    fetch: async () => {},
    location: { protocol: 'http:', hostname: 'localhost' },
    document: { addEventListener: () => {} },
    setTimeout: () => 1,
    setInterval: () => 1,
    console
  });
  vm.runInContext(localDataCode, context);

  // Default initial state
  assert.equal(vm.runInContext('LOCAL_DATA.getSyncStatus().status', context), 'offline');

  // Busy/syncing state
  vm.runInContext('LOCAL_DATA.busy = true', context);
  assert.equal(vm.runInContext('LOCAL_DATA.getSyncStatus().status', context), 'syncing');

  // Synced state
  vm.runInContext('LOCAL_DATA.busy = false; LOCAL_DATA.available = true; LOCAL_DATA.pending = false; LOCAL_DATA.lastSyncedAt = Date.now()', context);
  assert.equal(vm.runInContext('LOCAL_DATA.getSyncStatus().status', context), 'synced');

  // Pending sync state
  vm.runInContext('LOCAL_DATA.pending = true', context);
  assert.equal(vm.runInContext('LOCAL_DATA.getSyncStatus().status', context), 'pending');
});

test('Phase 2: Quiz interruption saves progress and allows seamless resumption', () => {
  const quizCode = readFileSync(join(root, 'src/services/quiz.js'), 'utf8');
  const sessionStore = new Map();
  const elementMock = {
    focus: () => {},
    querySelector: () => null,
    getBoundingClientRect: () => ({ top: 0 }),
    dataset: {}
  };
  const context = vm.createContext({
    sessionStorage: {
      getItem: k => sessionStore.get(k) ?? null,
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: k => sessionStore.delete(k)
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    window: { scrollY: 0 },
    AUTH: { currentUser: { id: 'stud_quiz_test', role: 'student' } },
    renderApp: () => {},
    renderQuiz: () => {},
    focusQuizStage: () => {},
    showToast: () => {},
    stopSpeech: () => {},
    $: () => elementMock,
    $$: () => [],
    S: { lvl: 1, sk: {}, miss: null },
    save: () => {},
    console
  });
  vm.runInContext(quizCode, context);

  // Create an active quiz
  const sampleSteps = [
    { P: { id: 'p1', t: 'Story 1', x: 'Text 1' }, q: { q: 'Q1?', o: ['A', 'B'], a: 0 } },
    { P: { id: 'p1', t: 'Story 1', x: 'Text 1' }, q: { q: 'Q2?', o: ['C', 'D'], a: 1 } }
  ];
  vm.runInContext(`
    ACTIVE_QUIZ = {
      title: 'Story 1',
      mode: 'pr',
      steps: ${JSON.stringify(sampleSteps)},
      idx: 1,
      correctCount: 1,
      correctQuestions: [{ index: 0, skill: 'Literal' }],
      userAnswers: [0],
      stage: 'question',
      isAnswered: false,
      selectedChoice: null,
      startTime: Date.now(),
      hearts: 3,
      maxHearts: 4,
      accommodated: false,
      processedAnswerIds: []
    };
    saveActiveQuizSnapshot();
  `, context);

  // Snapshot is preserved in sessionStorage
  assert.ok(sessionStore.has('basa_wisyo_interrupted_quiz'));
  const snapshot = vm.runInContext('getInterruptedQuizSnapshot()', context);
  assert.ok(snapshot !== null);
  assert.equal(snapshot.actorId, 'stud_quiz_test');
  assert.equal(snapshot.idx, 1);
  assert.equal(snapshot.correctCount, 1);

  // Clear in-memory quiz (simulating page reload)
  vm.runInContext('ACTIVE_QUIZ = null', context);
  assert.equal(vm.runInContext('ACTIVE_QUIZ', context), null);

  // Resume interrupted quiz
  const resumed = vm.runInContext('resumeInterruptedQuiz()', context);
  assert.equal(resumed, true);
  assert.equal(vm.runInContext('ACTIVE_QUIZ.idx', context), 1);
  assert.equal(vm.runInContext('ACTIVE_QUIZ.correctCount', context), 1);
  assert.equal(vm.runInContext('ACTIVE_QUIZ.title', context), 'Story 1');

  // Finishing quiz cleans up the snapshot
  vm.runInContext('clearActiveQuizSnapshot()', context);
  assert.equal(sessionStore.has('basa_wisyo_interrupted_quiz'), false);
  assert.equal(vm.runInContext('getInterruptedQuizSnapshot()', context), null);
});

test('Phase 2: Speech synthesis absence triggers child-friendly toast without crashing', () => {
  const readingCode = readFileSync(join(root, 'src/utils/reading.js'), 'utf8');
  let toastMsg = null;
  const context = vm.createContext({
    window: {}, // window without speechSynthesis
    document: {
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => []
    },
    SpeechSynthesisUtterance: undefined,
    showToast: msg => { toastMsg = msg; },
    SPEECH_SETTINGS: { mode: 'device', rate: 1 },
    SPEECH_WORDS: [],
    stopSpeech: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    console
  });
  vm.runInContext(readingCode, context);

  const result = vm.runInContext(`speak("Sample text", { followPassage: false })`, context);
  assert.equal(result, false);
  assert.ok(toastMsg !== null);
  assert.ok(toastMsg.includes('Narration is not supported in this browser'));
});
