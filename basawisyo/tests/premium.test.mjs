import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { buildGroqRequest } = require('../backend/services/groq.js');
const { validChatInput } = require('../backend/routes/chat.js');

test('User Entitlement & Plan Management: AUTH.isPremium and isUserPremium accurately track tiers', () => {
  const store = new Map();
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
    showToast() {}
  });

  vm.runInContext(readFileSync(join(root, 'src/services/auth.js'), 'utf8'), context);

  // Default guest/empty state is free
  assert.equal(vm.runInContext('AUTH.isPremium()', context), false);
  assert.equal(vm.runInContext('isUserPremium()', context), false);

  // Set annual plan on currentUser
  vm.runInContext('AUTH.currentUser = { id: "student-1", role: "student", plan: "annual" }', context);
  assert.equal(vm.runInContext('AUTH.isPremium()', context), true);
  assert.equal(vm.runInContext('isUserPremium()', context), true);

  // Set monthly plan on currentUser
  vm.runInContext('AUTH.setPlan("monthly")', context);
  assert.equal(vm.runInContext('AUTH.currentUser.plan', context), 'monthly');
  assert.equal(vm.runInContext('AUTH.isPremium()', context), true);

  // Downgrade to free
  vm.runInContext('AUTH.setPlan("free")', context);
  assert.equal(vm.runInContext('AUTH.isPremium()', context), false);
  assert.equal(vm.runInContext('isUserPremium()', context), false);

  // Toggle sandbox simulation
  const toggledOn = vm.runInContext('AUTH.toggleSandboxPremium()', context);
  assert.equal(toggledOn, true);
  assert.equal(vm.runInContext('isUserPremium()', context), true);
  assert.equal(store.get('basawisyo_sandbox_premium'), 'true');

  const toggledOff = vm.runInContext('AUTH.toggleSandboxPremium()', context);
  assert.equal(toggledOff, false);
  assert.equal(vm.runInContext('isUserPremium()', context), false);
  assert.equal(store.get('basawisyo_sandbox_premium'), 'false');
});

test('Smart Contextual Dictionary: entries preserve trilingual translations and include Parts of Speech', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(join(root, 'src/data/dictionary.js'), 'utf8'), context);

  const D = vm.runInContext('D', context);
  const getWordPOS = vm.runInContext('getWordPOS', context);

  // Verify backward compatibility: first 3 items are still [filipino, bisaya, english]
  assert.ok(D['carabao']);
  assert.equal(D['carabao'][0], 'kalabaw');
  assert.equal(D['carabao'][1], 'kabaw');
  assert.match(D['carabao'][2], /water buffalo/);
  // 4th item is Part of Speech
  assert.equal(D['carabao'][3], 'noun');
  assert.equal(getWordPOS('carabao'), 'noun');

  assert.ok(D['harvest']);
  assert.match(D['harvest'][3], /verb/);
  assert.match(getWordPOS('harvest'), /verb/);

  assert.ok(D['monsoonal']);
  assert.equal(D['monsoonal'][3], 'adjective');
  assert.equal(getWordPOS('monsoonal'), 'adjective');

  // Morphological fallback heuristic for unknown words
  assert.equal(getWordPOS('running'), 'verb');
  assert.equal(getWordPOS('quickly'), 'adverb');
  assert.equal(getWordPOS('wonderful'), 'adjective');
});

test('Unlimited Hearts: Wisyo Plus provides infinite hearts in practice while placement remains universally free', () => {
  const store = new Map();
  const authObj = {
    currentUser: { id: 'stud_1', role: 'student', plan: 'free' },
    isPremium() { return this.currentUser.plan !== 'free'; }
  };
  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    AUTH: authObj,
    isUserPremium: () => authObj.isPremium(),
    ACTIVE_QUIZ: null,
    document: { getElementById() { return null; } }
  });

  vm.runInContext(readFileSync(join(root, 'src/services/hearts.js'), 'utf8'), context);

  const quiz = { mode: 'pr', hearts: 3, maxHearts: 3, steps: [{}, {}, {}] };
  context.ACTIVE_QUIZ = quiz;

  // Free student: deducting quiz heart reduces remaining hearts
  const freeResult = vm.runInContext('deductQuizHeart(ACTIVE_QUIZ)', context);
  assert.equal(freeResult.success, true);
  assert.equal(freeResult.deducted, true);
  assert.equal(quiz.hearts, 2);

  // Upgrade student to Wisyo Plus
  authObj.currentUser.plan = 'annual';

  // Deducting quiz heart on premium does NOT decrement hearts and flags accommodated/isPremium
  const premResult = vm.runInContext('deductQuizHeart(ACTIVE_QUIZ)', context);
  assert.equal(premResult.success, true);
  assert.equal(premResult.deducted, false);
  assert.equal(premResult.isPremium, true);
  assert.equal(quiz.hearts, 2); // remains 2, not deducted

  // Render heart pill returns unlimited crown badge for premium
  const pillHtml = vm.runInContext('renderHeartPill()', context);
  assert.match(pillHtml, /Unlimited/);
  assert.match(pillHtml, /👑/);
  assert.match(pillHtml, /heart-premium/);
});

test('Flashcards Quota: Free accounts capped at 30 cards, Wisyo Plus allows unlimited expansion', () => {
  const store = new Map();
  const cards = [];
  for (let i = 0; i < 30; i++) {
    cards.push({ id: `fc-word-${i}`, word: `word-${i}`, definition: `def-${i}` });
  }
  store.set('basawisyo_flashcards_v1_guest', JSON.stringify(cards));

  let upgradeModalOpened = false;
  let simulatedPrem = false;
  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    AUTH: {
      currentUser: null,
      isPremium() { return simulatedPrem; }
    },
    isUserPremium: () => simulatedPrem,
    openUpgradeModal: () => { upgradeModalOpened = true; },
    showToast() {},
    D: {}
  });

  vm.runInContext(readFileSync(join(root, 'src/services/flashcards.js'), 'utf8'), context);

  // Attempting to save 31st card on free account triggers upgrade modal and returns null
  const blockedCard = vm.runInContext('saveFlashcard({ word: "extra-word", definition: "extra-def" })', context);
  assert.equal(blockedCard, null);
  assert.equal(upgradeModalOpened, true);

  // Upgrade to premium
  simulatedPrem = true;
  const savedCard = vm.runInContext('saveFlashcard({ word: "extra-word", definition: "extra-def" })', context);
  assert.ok(savedCard);
  assert.equal(savedCard.word, 'extra-word');
});

test('AI Quota & High-Thinking Tutoring: Groq prompt expands reasoning depth and tokens for Wisyo Plus', () => {
  // Free request
  const freeInput = {
    message: 'Help me understand why the carabao ran',
    isPremium: false,
    history: [],
    context: { passage: { title: 'The Carabao', text: 'The carabao ran when it heard thunder.' } }
  };
  const freePayload = buildGroqRequest(freeInput);
  assert.equal(freePayload.max_completion_tokens, 700);
  assert.equal(freePayload.messages[0].content.includes('Wisyo Plus Advanced Tutoring mode'), false);

  // Premium request
  const premInput = {
    message: 'Help me understand why the carabao ran',
    isPremium: true,
    history: [],
    context: { passage: { title: 'The Carabao', text: 'The carabao ran when it heard thunder.' } }
  };
  const premPayload = buildGroqRequest(premInput);
  assert.equal(premPayload.max_completion_tokens, 1000);
  assert.match(premPayload.messages[0].content, /Wisyo Plus Advanced Tutoring mode/);
  assert.match(premPayload.messages[0].content, /Socratic reading guidance/);

  // Chat route validation accepts isPremium boolean
  assert.deepEqual(validChatInput({ message: 'hi', history: [], isPremium: true }), {
    message: 'hi',
    history: [],
    context: {},
    isPremium: true
  });
});

test('Personal Story Import Quota: Free students capped at 2 personal stories; 3rd triggers upgrade modal', async () => {
  const store = new Map();
  let upgradeModalPayload = null;
  let isPrem = false;
  const actor = { id: 'stud_reader', role: 'student', name: 'Reader One' };

  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    window: {},
    AUTH: {
      currentUser: actor,
      isPremium() { return isPrem; }
    },
    isUserPremium: () => isPrem,
    openUpgradeModal: (category, msg) => {
      upgradeModalPayload = { category, msg };
    },
    console: { warn() {} }
  });

  vm.runInContext(readFileSync(join(root, 'src/services/material-storage.js'), 'utf8'), context);

  // Story 1: succeeds
  const s1 = await vm.runInContext('saveMaterial({ title: "My Story 1", text: "Once upon a time in Davao..." })', context);
  assert.ok(s1 && s1.id);
  assert.equal(s1.status, 'personal');

  // Story 2: succeeds
  const s2 = await vm.runInContext('saveMaterial({ title: "My Story 2", text: "The river was quiet..." })', context);
  assert.ok(s2 && s2.id);

  // Story 3 on free student: blocked and opens upgrade modal
  await assert.rejects(
    async () => {
      await vm.runInContext('saveMaterial({ title: "My Story 3", text: "The mountain trail was steep..." })', context);
    },
    /Free personal story import limit \(2\) reached/
  );
  assert.ok(upgradeModalPayload);
  assert.equal(upgradeModalPayload.category, 'imports');

  // Upgrade student to Wisyo Plus
  isPrem = true;
  const s3 = await vm.runInContext('saveMaterial({ title: "My Story 3", text: "The mountain trail was steep..." })', context);
  assert.ok(s3 && s3.id);
  assert.equal(s3.title, 'My Story 3');
});

test('Dual-Card Paywall Modal: index.html contains monthly and annual cards with ribbon, pricing, features, fairness guarantee, and sandbox toggle', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');

  // Paywall Modal element
  assert.match(html, /id="upgrade-modal"/);
  assert.match(html, /class="app-modal-overlay"/);

  // Dual Cards
  assert.match(html, /Wisyo Plus/);
  assert.match(html, /Wisyo Plus Annual/);
  assert.match(html, />149</);
  assert.match(html, />99</);
  assert.match(html, /MOST POPULAR · SAVE 35%/);

  // Action Buttons
  assert.match(html, /data-a="upgrade-select"\s+data-v="monthly"/);
  assert.match(html, /data-a="upgrade-select"\s+data-v="annual"/);
  assert.match(html, /data-a="upgrade-toggle-sandbox"/);
  assert.match(html, /data-a="upgrade-close"/);

  // Fairness & Guarantee
  assert.match(html, /Equal Education Guarantee/);
  assert.match(html, /Phil-IRI diagnostic assessments, teacher-assigned homework, and classroom reading libraries remain/);
});

test('Profile Membership Section: viewProfile renders plan status, feature highlights, and upgrade/manage action', () => {
  const store = new Map();
  let isPrem = false;
  let currentUser = { id: 'stud_1', name: 'Maria Santos', role: 'student', plan: 'free', lvl: 2 };

  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    AUTH: {
      get currentUser() { return currentUser; },
      set currentUser(u) { currentUser = u; },
      users: [],
      isPremium() { return isPrem; },
      practiceActor() { return currentUser; }
    },
    isUserPremium: () => isPrem,
    escapeHTML: str => String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    uiIcon: name => `[icon:${name}]`,
    journeySummary: () => ({ tier: 0, journey: { results: {} } }),
    readingRank: () => ({ stories: 2, title: 'Novice Explorer' }),
    journeyAchievements: () => [],
    journeySelectedFrame: () => 'default',
    PHIL_IRI_LEVELS: ['Emergent', 'Beginning', 'Instructional', 'Independent'],
    DIFF_KEYS: ['easy', 'medium', 'hard'],
    DIFF_NAMES: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    journeyEligiblePassages: () => [],
    journeyCanRead: () => true,
    JOURNEY_BADGES: [],
    viewJourneyPanel: () => '',
    viewAchievementsPanel: () => '',
    renderReadingMasteryDashboard: () => ''
  });

  vm.runInContext(readFileSync(join(root, 'src/pages/profile.js'), 'utf8'), context);

  // 1. Free Student view
  const freeHtml = vm.runInContext('viewProfile()', context);
  assert.match(freeHtml, /profile-membership-card/);
  assert.match(freeHtml, /🌱 Free Plan/);
  assert.match(freeHtml, /Free Practice Tier/);
  assert.match(freeHtml, /⭐ Upgrade to Wisyo Plus/);
  assert.match(freeHtml, /Equal Education Guarantee/);

  // 2. Wisyo Plus Annual Member view
  isPrem = true;
  currentUser.plan = 'plus_annual';
  const premHtml = vm.runInContext('viewProfile()', context);
  assert.match(premHtml, /is-premium/);
  assert.match(premHtml, /👑 Wisyo Plus/);
  assert.match(premHtml, /Annual Member \(₱99\/mo\)/);
  assert.match(premHtml, /Manage Plan/);
  assert.match(premHtml, /Unlimited Practice Hearts/);
  assert.match(premHtml, /High-Thinking Wisyo AI/);

  // 3. Guest Reader view
  currentUser = null;
  isPrem = false;
  const guestHtml = vm.runInContext('viewProfile()', context);
  assert.match(guestHtml, /profile-membership-card/);
  assert.match(guestHtml, /🌱 Free Plan/);
  assert.match(guestHtml, /⭐ Upgrade to Wisyo Plus/);
});
