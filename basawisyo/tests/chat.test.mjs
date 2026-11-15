import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createAppServer } = require('../backend/server.js');
const { askOpenAI, buildOpenAIRequest, extractOpenAIReply } = require('../backend/services/openai.js');
const { askGroq, buildGroqRequest, extractGroqReply } = require('../backend/services/groq.js');
const { loadLocalConfig, parseLocalConfig } = require('../backend/config.js');
const unansweredQuestion = { text: 'Where was the boat?', skill: 'Literal', answered: false };

async function withServer(options, run) {
  const server = createAppServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('private server configuration reads a Groq key without browser exposure', () => {
  assert.deepEqual(parseLocalConfig('# local only\nGROQ_API_KEY="test-key"\nGROQ_MODEL=openai/gpt-oss-120b'), {
    GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-120b'
  });
  assert.equal(readFileSync(join(root, 'index.html'), 'utf8').includes('GROQ_API_KEY='), false);
});

test('local server config loads a key once without overriding an environment key', () => {
  const file = join(tmpdir(), `basawisyo-${randomUUID()}.env`);
  const previous = process.env.GROQ_API_KEY;
  writeFileSync(file, 'GROQ_API_KEY=file-test-key\n');
  try {
    delete process.env.GROQ_API_KEY;
    loadLocalConfig(file);
    assert.equal(process.env.GROQ_API_KEY, 'file-test-key');
    process.env.GROQ_API_KEY = 'environment-test-key';
    loadLocalConfig(file);
    assert.equal(process.env.GROQ_API_KEY, 'environment-test-key');
  } finally {
    if (previous === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous;
    unlinkSync(file);
  }
});

test('OpenAI Responses request is stateless, bounded, and excludes answer keys', () => {
  const payload = buildOpenAIRequest({
    message: 'Give me a hint',
    history: [{ role: 'user', text: 'Hello' }, { role: 'assistant', text: 'Hi' }],
    context: {
      passage: { title: 'A boat', text: 'A boat crossed the river.' },
      question: unansweredQuestion
    }
  });
  assert.equal(payload.store, false);
  assert.equal(payload.model, 'gpt-6.1-sol');
  assert.deepEqual(payload.input.map(step => step.role), [
    'user', 'user', 'assistant', 'user'
  ]);
  assert.match(payload.instructions, /do not reveal the answer/);
  assert.equal(JSON.stringify(payload).includes('correctAnswer'), false);
  assert.equal(JSON.stringify(payload).includes('studentRoster'), false);
});

test('Groq request includes reading context and keeps the key server-side', async () => {
  const input = { message: 'Give me a hint in Bisaya', history: [], context: {
    passage: { title: 'Boat', text: 'A boat crossed the river.' }, question: unansweredQuestion
  } };
  const payload = buildGroqRequest(input);
  assert.equal(payload.model, 'openai/gpt-oss-120b');
  assert.match(payload.messages[0].content, /give a hint but do not reveal the answer/);
  assert.match(payload.messages[1].content, /Question answered: no/);
  assert.equal(JSON.stringify(payload).includes('correctAnswer'), false);
  assert.equal(extractGroqReply({ choices: [{ message: { content: 'Sakto ang tubag.' } }] }), 'Sakto ang tubag.');
  let sent;
  const reply = await askGroq(input, { apiKey: 'test-groq-key', fetchImpl: async (url, options) => {
    sent = { url, options };
    return { ok: true, async json() { return { choices: [{ message: { content: 'Sakto ang tubag.' } }] }; } };
  } });
  assert.equal(reply, 'Sakto ang tubag.');
  assert.match(sent.url, /api\.groq\.com/);
  assert.equal(sent.options.headers.Authorization, 'Bearer test-groq-key');
  assert.equal(sent.options.body.includes('test-groq-key'), false);
});

test('OpenAI response parser combines assistant text and rejects incomplete responses', () => {
  assert.equal(extractOpenAIReply({
    status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Look at the river sentence.' }] }]
  }), 'Look at the river sentence.');
  assert.equal(extractOpenAIReply({ status: 'incomplete', output: [] }), null);
});

test('OpenAI service sends key in header and returns only model reply', async () => {
  let request;
  const reply = await askOpenAI({ message: 'Hi' }, {
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Mabuhay!' }] }] };
        }
      };
    }
  });
  assert.equal(reply, 'Mabuhay!');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(request.options.body).store, false);
  assert.equal(request.url.includes('test-key'), false);
  assert.equal(request.options.body.includes('test-key'), false);
});

test('local server reports missing key and serves no backend source files', async () => {
  await withServer({ key: '' }, async base => {
    const status = await fetch(`${base}/api/chat/status`);
    assert.deepEqual(await status.json(), { onlineAvailable: false, provider: 'GroqCloud' });
    const chat = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hi', history: [] })
    });
    assert.equal(chat.status, 503);
    assert.equal((await fetch(`${base}/backend/services/openai.js`)).status, 403);
    assert.equal((await fetch(`${base}/backend/.env.local`)).status, 403);
    assert.equal((await fetch(`${base}/.env`)).status, 403);
    assert.equal((await fetch(`${base}/index.html`)).status, 200);
  });
});

test('local chat route validates input and calls OpenAI only for a valid request', async () => {
  const received = [];
  await withServer({ key: 'test-key', ask: async input => { received.push(input); return 'Read the first sentence.'; } }, async base => {
    const headers = { 'Content-Type': 'application/json', Origin: base };
    const bad = await fetch(`${base}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ message: '', history: [] }) });
    assert.equal(bad.status, 400);
    const otherOrigin = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { ...headers, Origin: 'https://example.com' }, body: JSON.stringify({ message: 'Hi', history: [] })
    });
    assert.equal(otherOrigin.status, 403);
    const good = await fetch(`${base}/api/chat`, {
      method: 'POST', headers,
      body: JSON.stringify({ message: 'Give me a hint', history: [], context: {
        passage: { title: 'River', text: 'We crossed a river.' }, question: unansweredQuestion
      } })
    });
    assert.equal(good.status, 200);
    assert.deepEqual(await good.json(), { reply: 'Read the first sentence.', mode: 'online' });
    assert.equal(received.length, 1);
    assert.equal(received[0].context.passage.title, 'River');
    assert.equal(received[0].context.question.answered, false);
  });
});

test('a rejected OpenAI key gives a clear local error', async () => {
  await withServer({
    key: 'test-key', provider: 'OpenAI Responses API',
    ask: async () => { const error = new Error('rejected'); error.status = 401; throw error; }
  }, async base => {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ message: 'Give me a hint', history: [], context: {
        passage: { title: 'River', text: 'We crossed a river.' }, question: unansweredQuestion
      } })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /rejected the API key/);
  });
});

test('Groq mode reports its provider and falls back cleanly at the free limit', async () => {
  await withServer({
    key: 'test-key', provider: 'GroqCloud',
    ask: async () => { const error = new Error('limit'); error.status = 429; throw error; }
  }, async base => {
    const status = await fetch(`${base}/api/chat/status`);
    assert.deepEqual(await status.json(), { onlineAvailable: true, provider: 'GroqCloud' });
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ message: 'Give me a hint', history: [], context: {
        passage: { title: 'River', text: 'We crossed a river.' }, question: unansweredQuestion
      } })
    });
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /free limit reached/);
  });
});

test('offline Wisyo gives grounded reading help without inventing general answers', () => {
  const elements = new Map();
  const context = vm.createContext({
    document: { querySelector: selector => elements.get(selector) || null },
    window: {}, D: { net: ['lambat', 'pukot', 'A mesh used to catch fish.'] },
    S: { miss: null }, ACTIVE_QUIZ: null,
    LG: 'assets/images/wisyo.png', $: selector => elements.get(selector) || null,
    setTimeout() {}, showToast() {}
  });
  vm.runInContext(readFileSync(join(root, 'src/services/tutor.js'), 'utf8'), context);
  assert.match(vm.runInContext(`offlineWisyoResponse('What does net mean?')`, context), /pukot/);
  assert.match(vm.runInContext(`offlineWisyoResponse('Who is the president?')`, context), /Offline help covers reading skills/);
  const hint = vm.runInContext(`offlineWisyoResponse('Give me a hint', {
    passage: { title: 'River', text: 'We crossed a river.' },
    question: { text: 'Where did we cross?', skill: 'Literal', answered: false }
  })`, context);
  assert.match(hint, /won't reveal the answer/);
});

test('offline Wisyo uses the question intent before dictionary matches and cites the passage', () => {
  const context = vm.createContext({
    D: { net: ['lambat', 'pukot', 'A mesh used to catch fish.'] },
    S: { miss: null }, ACTIVE_QUIZ: null
  });
  vm.runInContext(readFileSync(join(root, 'src/services/tutor.js'), 'utf8'), context);
  const reading = `{
    passage: { title: 'Tala', text: 'Tala woke on Samal Island. Her father mended a torn fishing net. Dolphins surfaced near the reef.' }
  }`;
  const answer = vm.runInContext(`offlineWisyoResponse('What did her father do with the net?', ${reading})`, context);
  assert.match(answer, /father mended a torn fishing net/);
  assert.doesNotMatch(answer, /Filipino: lambat/);
  const translation = vm.runInContext(`offlineWisyoResponse('What does net mean?', ${reading})`, context);
  assert.match(translation, /Filipino: lambat/);
  const unknown = vm.runInContext(`offlineWisyoResponse('What does mended mean?', ${reading})`, context);
  assert.match(unknown, /don't have a verified offline definition/);
  assert.match(unknown, /father mended a torn fishing net/);
  const unsupported = vm.runInContext(`offlineWisyoResponse('Who is the president?', ${reading})`, context);
  assert.match(unsupported, /couldn't find a supporting line/);
});

test('offline Wisyo protects unanswered quizzes and recaps more than the opening line', () => {
  const context = vm.createContext({ D: {}, S: { miss: null }, ACTIVE_QUIZ: null });
  vm.runInContext(readFileSync(join(root, 'src/services/tutor.js'), 'utf8'), context);
  const passage = `{ title: 'River', text: 'Ana walked to the river. She found a blue boat. She crossed before sunset.' }`;
  const hint = vm.runInContext(`offlineWisyoResponse('Where did Ana find the boat?', {
    passage: ${passage}, question: { text: 'Where did Ana find the boat?', skill: 'Literal', answered: false }
  })`, context);
  assert.match(hint, /Reread sentence/);
  assert.match(hint, /won't reveal the answer/);
  assert.doesNotMatch(hint, /blue boat/);
  const recap = vm.runInContext(`offlineWisyoResponse('Summarize this passage', { passage: ${passage} })`, context);
  assert.match(recap, /Ana walked to the river/);
  assert.match(recap, /crossed before sunset/);
  assert.doesNotMatch(recap, /She found a blue boat/);
  const bisayaHint = vm.runInContext(`offlineWisyoResponse('Tabang ko sa pangutana', {
    passage: ${passage}, question: { text: 'Where did Ana find the boat?', skill: 'Literal', answered: false }
  })`, context);
  assert.match(bisayaHint, /Dili pa nako ihatag ang tubag/);
});

test('Wisyo automatically uses Groq, falls back offline, and retries later', async () => {
  const elements = new Map([
    ['#ai-mode-tag', { textContent: '' }],
    ['#ai-subtitle', { textContent: '' }],
    ['#ai-mode-status', { textContent: '' }],
    ['#ai-send-button', { disabled: false }],
    ['#aim', { innerHTML: '', scrollTop: 0, scrollHeight: 0 }]
  ]);
  const requests = [];
  let failChat = null;
  const context = vm.createContext({
    document: { querySelector: selector => elements.get(selector) || null },
    window: {}, D: {}, S: { miss: null }, ACTIVE_QUIZ: null,
    LG: 'assets/images/wisyo.png', $: selector => elements.get(selector) || null,
    AbortSignal, setTimeout() {}, showToast() {},
    async fetch(url, options) {
      requests.push({ url, options });
      if (url === '/api/chat/status') return { ok: true, async json() { return { onlineAvailable: true, provider: 'GroqCloud' }; } };
      if (failChat === 'network') throw new Error('network unavailable');
      if (failChat === 'limit') return {
        ok: false, status: 429, async json() { return { error: 'GroqCloud free limit reached.' }; }
      };
      return { ok: true, async json() { return { reply: 'Look at the river sentence.' }; } };
    }
  });
  vm.runInContext(readFileSync(join(root, 'src/services/tutor.js'), 'utf8'), context);
  await vm.runInContext('checkWisyoOnlineStatus()', context);
  assert.equal(vm.runInContext('WISYO_MODE', context), 'online');
  await vm.runInContext('aiSend("Give me a hint")', context);
  assert.equal(requests[1].url, '/api/chat');
  assert.equal(JSON.parse(requests[1].options.body).message, 'Give me a hint');
  assert.equal(vm.runInContext('CHAT_HISTORY.at(-1)[1]', context), 'Look at the river sentence.');
  failChat = 'network';
  await vm.runInContext('aiSend("Another hint")', context);
  assert.equal(vm.runInContext('WISYO_MODE', context), 'offline');
  assert.match(vm.runInContext('CHAT_HISTORY.at(-1)[1]', context), /Groq is unavailable/);
  assert.match(elements.get('#ai-mode-status').textContent, /Using offline help/);
  const previousRequests = requests.length;
  await vm.runInContext('aiSend("One more question")', context);
  assert.equal(requests.length, previousRequests);
  failChat = null;
  vm.runInContext('WISYO_RETRY_AT = 0', context);
  await vm.runInContext('aiSend("Try online again")', context);
  assert.equal(vm.runInContext('WISYO_MODE', context), 'online');
  assert.equal(requests.at(-1).url, '/api/chat');
  failChat = 'limit';
  await vm.runInContext('aiSend("One more online question")', context);
  assert.equal(vm.runInContext('WISYO_MODE', context), 'offline');
  assert.match(elements.get('#ai-mode-status').textContent, /free limit reached/);
});

test('Wisyo distinguishes a static page from a server that has not loaded the key', async () => {
  const elements = new Map([
    ['#ai-mode-tag', { textContent: '' }], ['#ai-subtitle', { textContent: '' }],
    ['#ai-mode-status', { textContent: '' }], ['#ai-send-button', { disabled: false }]
  ]);
  let statusKind = 'static';
  const context = vm.createContext({
    $: selector => elements.get(selector) || null, ACTIVE_QUIZ: null,
    AbortSignal,
    async fetch() {
      if (statusKind === 'static') return { ok: false, status: 404 };
      return { ok: true, async json() { return { onlineAvailable: false, provider: 'GroqCloud' }; } };
    }
  });
  vm.runInContext(readFileSync(join(root, 'src/services/tutor.js'), 'utf8'), context);
  await vm.runInContext('checkWisyoOnlineStatus()', context);
  assert.match(elements.get('#ai-mode-status').textContent, /not using the BasaWisyo AI server/);
  statusKind = 'missing-key';
  await vm.runInContext('checkWisyoOnlineStatus()', context);
  assert.match(elements.get('#ai-mode-status').textContent, /key is not loaded/);
});
