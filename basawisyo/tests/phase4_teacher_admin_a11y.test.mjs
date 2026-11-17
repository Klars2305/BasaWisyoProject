import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const baseDir = process.cwd();
const adminJs = fs.readFileSync(path.join(baseDir, 'src/pages/admin.js'), 'utf8');
const teacherJs = fs.readFileSync(path.join(baseDir, 'src/pages/teacher.js'), 'utf8');
const appJs = fs.readFileSync(path.join(baseDir, 'src/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

test('Phase 4: Admin passage preview button escapes passage ID properly', () => {
  assert.match(adminJs, /data-a="read-passage" data-v="\${escapeHTML\(p\.id\)}"/);
  assert.doesNotMatch(adminJs, /data-a="read-passage" data-v="\${p\.id}"/);
});

test('Phase 4: Teacher assignment dispatch reads due date and note from input field', () => {
  assert.match(appJs, /const noteVal = noteInput\?\.value\?\.trim\(\) \|\| "";/);
  assert.match(appJs, /const dueDate = noteVal \|\| "Next Class";/);
  assert.match(appJs, /AUTH\.createAssignment\(pId, pTitle, targetGroup, dueDate, noteVal \|\| "Assigned by Teacher"\);/);
});

test('Phase 4: Teacher guest token import reads from #guest-token-input before fallback', () => {
  assert.match(appJs, /const inputEl = \$\("#guest-token-input"\);/);
  assert.match(appJs, /const inputVal = inputEl \? inputEl\.value\.trim\(\) : "";/);
  assert.match(appJs, /const token = inputVal \|\| prompt\("Enter Student Guest Token/);
  assert.match(appJs, /if \(inputEl\) inputEl\.value = "";/);
});

test('Phase 4: Practice unpublish requires explicit confirmation guard', () => {
  assert.match(appJs, /if \(a === "practice-unpublish" && !confirm\("Unpublish this passage from the public reading library\?"\)\) return;/);
});

test('Phase 4: Wisyo Plus modal has sandbox simulation removed and informs online payment in development', () => {
  // 1. Sandbox simulation is completely absent from index.html
  assert.equal(indexHtml.includes('Evaluation Sandbox Simulation:'), false);
  assert.equal(indexHtml.includes('Toggle Plus Sandbox'), false);
  assert.equal(indexHtml.includes('upgrade-toggle-sandbox'), false);

  // 2. Both Monthly and Annual buttons trigger upgrade-select
  assert.match(indexHtml, /<button[^>]+data-a="upgrade-select"[^>]+data-v="monthly"[^>]*>[\s\S]*?Get Wisyo Plus Monthly/);
  assert.match(indexHtml, /<button[^>]+data-a="upgrade-select"[^>]+data-v="annual"[^>]*>[\s\S]*?Get Wisyo Plus Annual/);

  // 3. upgrade-select action displays development message in modal and toast
  assert.match(appJs, /bannerText\.textContent = "Online payment is still in development phase\.";/);
  assert.match(appJs, /showToast\("Online payment is still in development phase\."\);/);
  assert.match(appJs, /showInlineDialog\(paymentModal/);

  // 4. Dedicated Payment Notice Modal Pop-up Dialog exists in DOM
  assert.match(indexHtml, /id="payment-notice-modal"/);
  assert.match(indexHtml, /data-a="payment-notice-close"/);
  assert.match(indexHtml, /id="upgrade-select-popup"/);
  const baseCss = fs.readFileSync(path.join(baseDir, 'src/styles/base.css'), 'utf8');
  assert.match(baseCss, /\.toast\{[^}]*z-index:\s*99999/);
});

test('Phase 4: Universal Pop-up Notification System functions across all notification types', () => {
  const notifJs = fs.readFileSync(path.join(baseDir, 'src/components/notifications.js'), 'utf8');
  const bundleUi = fs.readFileSync(path.join(baseDir, 'src/bundles/bundle-ui.js'), 'utf8');
  const baseCss = fs.readFileSync(path.join(baseDir, 'src/styles/base.css'), 'utf8');

  // Architecture check
  assert.match(notifJs, /function showPopupModal/);
  assert.match(notifJs, /function showToast/);
  assert.match(notifJs, /universal-popup-overlay/);
  assert.match(notifJs, /app-popup-card/);
  assert.match(notifJs, /overlay\.className = "app-popup-overlay"/);
  assert.match(bundleUi, /overlay\.className = "app-popup-overlay"/);
  assert.doesNotMatch(bundleUi, /overlay\.className = "app-popup-overlay toast"/);

  // CSS Styles check
  assert.match(baseCss, /\.app-popup-overlay\s*\{[^}]*z-index:\s*100000/);
  assert.match(baseCss, /#universal-popup-overlay\.app-popup-overlay\s*\{[^}]*width:\s*100vw;[^}]*transform:\s*none;/);
  assert.match(baseCss, /\.app-popup-card\s*\{/);
  assert.match(baseCss, /\.popup-btn\s*\{[^}]*min-height:\s*44px/);

  // Functional simulation in DOM VM
  const appended = [];
  const fakeDoc = {
    getElementById: () => null,
    createElement: tag => {
      const el = {
        tagName: tag,
        className: '',
        style: {},
        setAttribute: () => {},
        querySelector: () => ({ addEventListener: () => {}, focus: () => {} }),
        addEventListener: () => {}
      };
      return el;
    },
    body: {
      appendChild: el => appended.push(el)
    },
    addEventListener: () => {}
  };

  const context = vm.createContext({
    document: fakeDoc,
    escapeHTML: s => s,
    setTimeout: fn => fn()
  });

  vm.runInContext(notifJs, context);
  context.showToast("Test success popup", "ok");
  assert.equal(appended.length, 1);
  assert.match(appended[0].innerHTML, /Test success popup/);
  assert.match(appended[0].innerHTML, /popup-ok/);
  assert.equal(appended[0].className, 'app-popup-overlay');
});
