import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function createOnboardingContext(initialUser = null, initialState = { lvl: null }) {
  const store = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    AUTH: {
      currentUser: initialUser
    },
    S: initialState,
    GUEST_MODE: !initialUser,
    ACTIVE_QUIZ: null,
    QUIZ_RESULT: null,
    CURRENT_TAB: "home",
    showToast() {},
    escapeHTML: s => String(s),
    window: {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener() {},
      removeEventListener() {}
    },
    document: {
      body: {
        appendChild() {},
        removeChild() {}
      },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() {
        return {
          id: "",
          className: "",
          innerHTML: "",
          style: {},
          setAttribute() {},
          getAttribute() { return null; },
          getBoundingClientRect() {
            return { top: 100, bottom: 150, left: 100, right: 300, width: 200, height: 50 };
          },
          scrollIntoView() {}
        };
      }
    }
  });

  vm.runInContext(readFileSync(join(root, 'src/services/onboarding.js'), 'utf8'), context);
  vm.runInContext(readFileSync(join(root, 'src/components/onboarding-tour.js'), 'utf8'), context);
  return { context, store };
}

test('Onboarding Tour: unplaced student is guided to mandatory placement assessment first', () => {
  const { context } = createOnboardingContext({ id: 'student_unplaced', role: 'student', lvl: null }, { lvl: null });

  const recommendation = vm.runInContext('shouldAutoStartTour(AUTH.currentUser, S)', context);
  assert.ok(recommendation);
  assert.equal(recommendation.tourId, 'student-unplaced');
  assert.equal(recommendation.role, 'student');

  const def = recommendation.definition;
  assert.equal(def.steps.length, 3);
  assert.match(def.steps[1].title, /Placement Assessment/);
  assert.equal(def.steps[1].preferredTab, 'assess');

  // Skipping or finishing tour does NOT bypass placement or change lvl
  vm.runInContext('startOnboardingTour("student-unplaced")', context);
  assert.equal(vm.runInContext('getActiveTour().tourId', context), 'student-unplaced');

  vm.runInContext('skipOnboardingTour()', context);
  assert.equal(vm.runInContext('S.lvl', context), null);
  assert.equal(vm.runInContext('AUTH.currentUser.lvl', context), null);
});

test('Onboarding Tour: placed student receives full feature walkthrough', () => {
  const { context } = createOnboardingContext({ id: 'student_placed', role: 'student', lvl: 2 }, { lvl: 2 });

  const recommendation = vm.runInContext('shouldAutoStartTour(AUTH.currentUser, S)', context);
  assert.ok(recommendation);
  assert.equal(recommendation.tourId, 'student-main');

  const def = recommendation.definition;
  assert.equal(def.steps.length, 7);
  const stepTitles = def.steps.map(s => s.title);
  assert.ok(stepTitles.some(t => t.includes('Student Home')));
  assert.ok(stepTitles.some(t => t.includes('Reading Library')));
  assert.ok(stepTitles.some(t => t.includes('Flashcards')));
  assert.ok(stepTitles.some(t => t.includes('Reading Studio')));
  assert.ok(stepTitles.some(t => t.includes('Class Board')));
  assert.ok(stepTitles.some(t => t.includes('Wisyo AI')));
  assert.ok(stepTitles.some(t => t.includes('Profile')));
});

test('Onboarding Tour: Teacher and Admin walkthroughs feature only authorized controls', () => {
  // Teacher
  const { context: teacherCtx } = createOnboardingContext({ id: 'teach_01', role: 'teacher', section: 'Grade 7-A' });
  const teacherRec = vm.runInContext('shouldAutoStartTour(AUTH.currentUser, S)', teacherCtx);
  assert.equal(teacherRec.tourId, 'teacher-main');
  const teacherTitles = teacherRec.definition.steps.map(s => s.title);
  assert.ok(teacherTitles.some(t => t.includes('Classroom Hub')));
  assert.ok(teacherTitles.some(t => t.includes('Teacher Reading Studio')));
  assert.ok(teacherTitles.some(t => t.includes('Class Assignments')));
  assert.ok(teacherTitles.some(t => t.includes('Form 14')));

  // Admin
  const { context: adminCtx } = createOnboardingContext({ id: 'admin_01', role: 'admin', school: 'DepEd Central' });
  const adminRec = vm.runInContext('shouldAutoStartTour(AUTH.currentUser, S)', adminCtx);
  assert.equal(adminRec.tourId, 'admin-main');
  const adminTitles = adminRec.definition.steps.map(s => s.title);
  assert.ok(adminTitles.some(t => t.includes('Admin Console')));
  assert.ok(adminTitles.some(t => t.includes('Curriculum Management')));
  assert.ok(adminTitles.some(t => t.includes('School-Wide Reports')));
});

test('Account Isolation: Student A completing the tour does not suppress Student B on the same device', () => {
  const { context, store } = createOnboardingContext({ id: 'student_A', role: 'student', lvl: 1 }, { lvl: 1 });

  // Student A finishes tour
  vm.runInContext('startOnboardingTour("student-main")', context);
  vm.runInContext('finishOnboardingTour()', context);

  // Tour status for Student A is saved under student_A key
  const statusA = vm.runInContext('getTourStatus("student_A", "student-main")', context);
  assert.equal(statusA.status, 'completed');

  // Student A should no longer auto-start tour
  assert.equal(vm.runInContext('shouldAutoStartTour(AUTH.currentUser, S)', context), null);

  // Switch to Student B
  context.AUTH.currentUser = { id: 'student_B', role: 'student', lvl: 1 };
  const statusB = vm.runInContext('getTourStatus("student_B", "student-main")', context);
  assert.equal(statusB, null);

  // Student B automatically receives tour
  const recommendationB = vm.runInContext('shouldAutoStartTour(AUTH.currentUser, S)', context);
  assert.ok(recommendationB);
  assert.equal(recommendationB.tourId, 'student-main');
});

test('Step Navigation & Replay Tutorial: Next, Back, Skip, Finish, and Replay update state cleanly', () => {
  const { context } = createOnboardingContext({ id: 'student_nav', role: 'student', lvl: 2 }, { lvl: 2 });

  vm.runInContext('startOnboardingTour("student-main")', context);
  assert.equal(vm.runInContext('getActiveTour().stepIndex', context), 0);

  // Next step
  vm.runInContext('nextTourStep()', context);
  assert.equal(vm.runInContext('getActiveTour().stepIndex', context), 1);

  // Previous step
  vm.runInContext('prevTourStep()', context);
  assert.equal(vm.runInContext('getActiveTour().stepIndex', context), 0);

  // Skip tour
  vm.runInContext('skipOnboardingTour()', context);
  assert.equal(vm.runInContext('getActiveTour()', context), null);
  const skippedRecord = vm.runInContext('getTourStatus("student_nav", "student-main")', context);
  assert.equal(skippedRecord.status, 'skipped');

  // Replay tour resets status and restarts
  vm.runInContext('replayCurrentRoleTour()', context);
  assert.ok(vm.runInContext('getActiveTour()', context));
  assert.equal(vm.runInContext('getActiveTour().stepIndex', context), 0);
  assert.equal(vm.runInContext('getActiveTour().tourId', context), 'student-main');
});

test('Graceful Fallback: missing or conditionally hidden DOM elements do not crash the tour', () => {
  const { context } = createOnboardingContext({ id: 'student_fallback', role: 'student', lvl: 2 }, { lvl: 2 });
  // querySelector returns null
  context.document.querySelector = () => null;

  assert.doesNotThrow(() => {
    vm.runInContext('startOnboardingTour("student-main")', context);
    vm.runInContext('nextTourStep()', context);
    vm.runInContext('prevTourStep()', context);
    vm.runInContext('finishOnboardingTour()', context);
  });
});

test('Recommended Data Shape: stores studentId, tourVersion: 2, and lastCompletedStep', () => {
  const { context } = createOnboardingContext({ id: 'stu_123', role: 'student', lvl: 2 }, { lvl: 2 });

  vm.runInContext('saveTourStatus("stu_123", "student-main", "in_progress", 3)', context);
  const record = vm.runInContext('getTourStatus("stu_123", "student-main")', context);

  assert.ok(record);
  assert.equal(record.studentId, 'stu_123');
  assert.equal(record.userId, 'stu_123');
  assert.equal(record.tourId, 'student-main');
  assert.equal(record.tourVersion, 2);
  assert.equal(record.status, 'in_progress');
  assert.equal(record.stepIndex, 3);
  assert.equal(record.lastCompletedStep, 2);
  assert.ok(record.updatedAt);

  // When completed, lastCompletedStep matches stepIndex
  vm.runInContext('saveTourStatus("stu_123", "student-main", "completed", 6)', context);
  const completedRecord = vm.runInContext('getTourStatus("stu_123", "student-main")', context);
  assert.equal(completedRecord.status, 'completed');
  assert.equal(completedRecord.lastCompletedStep, 6);
  assert.ok(completedRecord.completedAt);
});

test('Step 4 Horizontal Scrolling: brings clipped tab inside scrollable container into view', () => {
  const { context } = createOnboardingContext({ id: 'stu_step4', role: 'student', lvl: 2 }, { lvl: 2 });

  // Mock a horizontal subnav container with overflow-x
  const parentContainer = {
    id: "sn",
    scrollWidth: 600,
    clientWidth: 350,
    scrollLeft: 0,
    parentElement: null,
    getBoundingClientRect: () => ({ left: 0, right: 350, top: 100, bottom: 150, width: 350, height: 50 })
  };

  // Mock Step 4 Reading Studio tab which is pushed to x=400 (past clientWidth 350)
  const tabButton = {
    parentElement: parentContainer,
    scrollWidth: 120,
    clientWidth: 120,
    getBoundingClientRect: () => ({ left: 380, right: 500, top: 100, bottom: 150, width: 120, height: 50 }),
    scrollIntoView() {}
  };

  vm.runInContext('scrollTargetIntoView', context)(tabButton);

  // parentContainer should have scrolled to bring tabButton into the center
  assert.ok(parentContainer.scrollLeft > 0, 'Container scrollLeft was adjusted to bring tab into view');
});

test('Viewport Boundaries: Spotlight and card are clamped within visual viewport bounds', () => {
  const { context } = createOnboardingContext({ id: 'stu_bounds', role: 'student', lvl: 2 }, { lvl: 2 });

  const mockSpotlight = { style: {} };
  const mockCard = { style: {}, offsetHeight: 200, querySelectorAll: () => [] };
  context.document.getElementById = id => {
    if (id === 'tour-spotlight') return mockSpotlight;
    if (id === 'tour-card') return mockCard;
    if (id === 'nav') return { offsetHeight: 60 };
    return null;
  };

  // Target that would overflow right edge at width 375
  context.window.visualViewport = { width: 375, height: 667, offsetTop: 0, offsetLeft: 0 };
  const overflowTarget = {
    getBoundingClientRect: () => ({ left: 320, right: 460, top: 80, bottom: 130, width: 140, height: 50 })
  };

  const step = { title: "Test Step", text: "Testing bounds", position: "bottom" };
  vm.runInContext('positionTourSpotlightAndCard', context)(step, overflowTarget);

  assert.equal(mockSpotlight.style.display, 'block');
  // Left is 320 - 6 = 314
  assert.equal(mockSpotlight.style.left, '314px');
  // Right is clamped to vw = 375, so width = 375 - 314 = 61px (no overflow past 375!)
  assert.equal(mockSpotlight.style.width, '61px');

  // Card is clamped so left + cardWidth <= 375 - 12
  const cardLeft = parseInt(mockCard.style.left, 10);
  assert.ok(cardLeft >= 12, 'Card left is at least 12px');
  assert.ok(cardLeft <= 375 - 24, 'Card does not overflow right viewport margin');
});

test('Focus Management: restores focus to previous activeElement after tour close', () => {
  const { context } = createOnboardingContext({ id: 'stu_focus', role: 'student', lvl: 2 }, { lvl: 2 });

  let focusedBack = false;
  const mockLauncher = {
    focus() { focusedBack = true; }
  };
  context.document.activeElement = mockLauncher;

  vm.runInContext('startOnboardingTour("student-main")', context);
  vm.runInContext('closeTourOverlay()', context);

  assert.equal(focusedBack, true, 'Original launcher element regained focus after tour exit');
});

test('Placement Assessment Gate: tour step cannot redirect unplaced student to restricted tab', () => {
  const { context } = createOnboardingContext({ id: 'stu_unplaced_gate', role: 'student', lvl: null }, { lvl: null });

  context.CURRENT_TAB = 'home';
  let appRendered = false;
  context.renderApp = () => { appRendered = true; };

  // Attempt to switch unplaced student to 'studio' tab during a step
  const restrictedStep = {
    preferredTab: 'studio',
    title: 'Studio',
    text: 'Restricted'
  };

  context.ACTIVE_TOUR = {
    tourId: 'student-unplaced',
    stepIndex: 0,
    steps: [restrictedStep],
    active: true
  };

  vm.runInContext('renderTourStep()', context);

  // Tab must NOT have changed to 'studio'
  assert.equal(context.CURRENT_TAB, 'home', 'CURRENT_TAB remained safe and protected from placement bypass');
});
