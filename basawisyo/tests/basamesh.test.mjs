import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextEncoder, TextDecoder } from 'node:util';
import test from 'node:test';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const passage = {
  id: 'source_1', t: 'Ang Munting Bangka', diff: 'easy', lang: 'fil-PH',
  x: 'Maagang nagising si Ana upang tulungan ang kaniyang ama sa pag-aayos ng munting bangka sa dalampasigan.',
  qs: [{ q: 'Sino ang tumulong sa ama?', o: ['Ana', 'Lito', 'Maya', 'Pio'], a: 0, k: 'Literal' }]
};

function app({ role = 'student', saveFails = false } = {}) {
  const store = new Map();
  const context = vm.createContext({
    Buffer, TextEncoder, TextDecoder,
    DIFF_KEYS: ['easy', 'medium', 'hard', 'extreme'],
    PRACTICE_DATA: { easy: [], medium: [], hard: [], extreme: [] },
    AUTH: {
      currentUser: { id: 'actor_1', role, status: 'active' }, customPassages: [],
      savePractice(input) {
        const saved = { ...input, id: 'managed_1', status: role === 'teacher' ? 'draft' : 'published' };
        this.customPassages.push(saved);
        return saved;
      }
    },
    S: { sh: [], done: [] },
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key)
    },
    getStateStorageKey: () => 'basa_wisyo_state_actor_1',
    save() {
      store.set('basa_wisyo_state_v2', JSON.stringify(context.S));
      return { success: !saveFails };
    }
  });
  for (const file of ['src/data/passage-schema.js', 'src/services/bayanihan.js', 'src/services/basamesh.js']) {
    vm.runInContext(readFileSync(join(root, file), 'utf8'), context);
  }
  return { context, store, eval: code => vm.runInContext(code, context) };
}

test('offline packet round trips Filipino text and real question keys without personal records', () => {
  const testApp = app();
  const encoded = testApp.eval(`BASAMESH.encode(BASAMESH.createPacket(${JSON.stringify(passage)}))`);
  const inspected = testApp.eval(`BASAMESH.inspect(${JSON.stringify(encoded)})`);
  assert.equal(inspected.passage.t, passage.t);
  assert.equal(inspected.passage.x, passage.x);
  assert.equal(inspected.passage.qs[0].a, 0);
  assert.equal(inspected.passage.lang, 'fil-PH');
  assert.doesNotMatch(encoded, /actor_1|password|teacherCode/);
});

test('packet validation rejects corruption, unsupported versions, and invalid answer keys', () => {
  const testApp = app();
  const packet = testApp.eval(`BASAMESH.createPacket(${JSON.stringify(passage)})`);
  assert.throws(() => testApp.eval(`BASAMESH.inspect(${JSON.stringify({ ...packet, checksum: '00000000' })})`), /integrity/);
  assert.throws(() => testApp.eval(`BASAMESH.inspect(${JSON.stringify({ ...packet, protocol: 'Unknown-v2' })})`), /Unsupported/);
  assert.throws(() => testApp.eval(`BASAMESH.createPacket(${JSON.stringify({ ...passage, qs: [{ ...passage.qs[0], a: 9 }] })})`), /correct-answer/);
  assert.throws(() => testApp.eval('BASAMESH.inspect("BW1:bad")'), /damaged/);
});

test('learner import is private, detects duplicates, and leaves scores untouched', () => {
  const testApp = app();
  const packet = testApp.eval(`BASAMESH.createPacket(${JSON.stringify(passage)})`);
  const result = testApp.eval(`BASAMESH.importPassage(BASAMESH.inspect(${JSON.stringify(packet)}))`);
  assert.equal(result.destination, 'personal reading library');
  assert.equal(testApp.eval('S.sh.length'), 1);
  assert.equal(testApp.eval('getPublishedPassages().length'), 1);
  assert.equal(testApp.eval('S.done.length'), 0);
  assert.throws(() => testApp.eval(`BASAMESH.importPassage(BASAMESH.inspect(${JSON.stringify(packet)}))`), /already/);
});

test('teacher receives an editable draft and failed learner storage does not claim an import', () => {
  const teacher = app({ role: 'teacher' });
  const packet = teacher.eval(`BASAMESH.createPacket(${JSON.stringify(passage)})`);
  assert.equal(teacher.eval(`BASAMESH.importPassage(BASAMESH.inspect(${JSON.stringify(packet)})).passage.status`), 'draft');
  const learner = app({ saveFails: true });
  assert.throws(() => learner.eval(`BASAMESH.importPassage(BASAMESH.inspect(${JSON.stringify(packet)}))`), /could not be saved/);
  assert.equal(learner.eval('S.sh.length'), 0);
  assert.equal(learner.store.has('basa_wisyo_state_v2'), false);
});

test('offline QR vendor renders the complete short story packet as SVG', () => {
  const testApp = app();
  vm.runInContext(readFileSync(join(root, 'assets/vendor/qrcode.js'), 'utf8'), testApp.context);
  const svg = testApp.eval(`var qr = qrcode(0, "L"); qr.addData(BASAMESH.encode(BASAMESH.createPacket(${JSON.stringify(passage)})), "Byte"); qr.make(); qr.createSvgTag(3, 4)`);
  assert.match(svg, /<svg/);
  assert.match(svg, /<rect/);
});
