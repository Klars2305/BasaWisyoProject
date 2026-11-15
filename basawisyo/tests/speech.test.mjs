import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const readingSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/utils/reading.js'), 'utf8');

test('narration follows only by choice and stops following manual scroll', () => {
  const app = speechApp();
  app.eval(`window.innerHeight = 600;
    window.followScrolls = 0;
    var offscreenWord = {
      getBoundingClientRect: () => ({ top: 650, bottom: 680 }),
      scrollIntoView: () => { window.followScrolls++; }
    };
    revealSpeechPosition(offscreenWord);`);
  assert.equal(app.eval('window.followScrolls'), 0);
  app.eval('setSpeechSetting("follow", true); revealSpeechPosition(offscreenWord)');
  assert.equal(app.eval('window.followScrolls'), 1);
  app.eval('SPEECH_PASSAGE_ACTIVE = true; pauseNarrationFollowOnManualScroll(); revealSpeechPosition(offscreenWord)');
  assert.equal(app.eval('SPEECH_SETTINGS.follow'), false);
  assert.equal(app.eval('window.followScrolls'), 1);
});

function speechApp({ voices = [], recordings = {}, AudioClass = null } = {}) {
  const utterances = [];
  const words = [];
  const savedSettings = new Map();
  const button = {
    textContent: '', title: '', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; }
  };
  let cancels = 0;
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const document = {
    querySelector(selector) { return selector === '[data-a="speech-read"]' ? button : null; },
    querySelectorAll(selector) { return selector === '#active-ps .speech-word' ? words : []; }
  };
  const context = vm.createContext({
    document, D: { river: ['ilog', 'suba', 'A waterway'] },
    window: {
      innerHeight: 0,
      addEventListener() {},
      performance: { now: () => now },
      setInterval(callback) { const id = nextTimerId++; timers.set(id, callback); return id; },
      clearInterval(id) { timers.delete(id); },
      speechSynthesis: {
        cancel() { cancels++; },
        getVoices() { return voices; },
        speak(utterance) { utterances.push(utterance); }
      }
    },
    localStorage: {
      getItem(key) { return savedSettings.get(key) ?? null; },
      setItem(key, value) { savedSettings.set(key, value); }
    },
    RECORDED_NARRATIONS: recordings,
    Audio: AudioClass,
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }
  });
  vm.runInContext(readingSource, context);
  return {
    eval: expression => vm.runInContext(expression, context),
    utterances, words, button,
    cancels: () => cancels,
    activeTimers: () => timers.size,
    advance(ms) { now += ms; for (const callback of [...timers.values()]) callback(); },
    loadWords(markup) {
      for (const match of markup.matchAll(/class="[^"]*speech-word[^"]*"[^>]*data-start="(\d+)" data-end="(\d+)"/g)) {
        const classes = new Set();
        words.push({
          dataset: { start: match[1], end: match[2] },
          classList: {
            add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); },
            toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
            contains(name) { return classes.has(name); }
          }
        });
      }
    }
  };
}

test('passage markup preserves text and dictionary taps while mapping all words', () => {
  const app = speechApp();
  const text = 'River & Rizal’s boats.';
  const markup = app.eval(`tapMarkup(${JSON.stringify(text)})`);
  assert.equal(markup.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&'), text);
  assert.match(markup, /class="w speech-word" data-a="tip" data-v="river" data-start="0" data-end="5"/);
  assert.match(markup, /data-start="8" data-end="15"/);
  assert.equal((markup.match(/class="[^"]*speech-word/g) || []).length, 3);
});

test('speech highlights a current word as soon as each sentence begins', () => {
  const app = speechApp();
  const source = 'River flows. Fish swim!';
  app.loadWords(app.eval(`tapMarkup(${JSON.stringify(source)})`));
  assert.equal(app.eval(`speak(${JSON.stringify(source)}, { followPassage: true })`), true);
  assert.equal(app.button.attributes['aria-pressed'], 'true');
  assert.equal(app.words[0].classList.contains('speech-current'), true);
  assert.equal(app.words[1].classList.contains('speech-current'), false);

  app.utterances[0].onboundary({ name: 'word', charIndex: 5 });
  assert.equal(app.words[0].classList.contains('speech-done'), true);
  assert.equal(app.words[1].classList.contains('speech-current'), true);
  assert.equal(app.words[2].classList.contains('speech-current'), false);

  app.utterances[0].onend();
  assert.equal(app.utterances.length, 2);
  assert.equal(app.words[2].classList.contains('speech-current'), true);
  app.utterances[1].onend();
  assert.equal(app.words.every(word => word.classList.contains('speech-done')), true);
  assert.equal(app.button.attributes['aria-pressed'], 'false');
});

test('a voice without useful word boundaries keeps moving the yellow highlight', () => {
  const app = speechApp();
  const source = 'River flows.';
  app.loadWords(app.eval(`tapMarkup(${JSON.stringify(source)})`));
  app.eval(`speak(${JSON.stringify(source)}, { followPassage: true })`);
  const utterance = app.utterances[0];
  assert.equal(app.words[0].classList.contains('speech-current'), true);
  utterance.onstart();
  utterance.onboundary({ name: 'word', charIndex: 0 });
  app.advance(900);
  assert.equal(app.words[1].classList.contains('speech-current'), true);
  utterance.onboundary({ name: 'word', charIndex: 0 });
  assert.equal(app.words[1].classList.contains('speech-current'), true);
  utterance.onend();
  assert.equal(app.activeTimers(), 0);
});

test('yellow tracking advances when a voice omits both start and boundary events', () => {
  const app = speechApp();
  const source = 'River flows.';
  app.loadWords(app.eval(`tapMarkup(${JSON.stringify(source)})`));
  app.eval(`speak(${JSON.stringify(source)}, { followPassage: true })`);
  app.advance(1300);
  assert.equal(app.words[1].classList.contains('speech-current'), true);
});

test('stopping narration clears progress and ignores late voice events', () => {
  const app = speechApp();
  const source = 'River flows. Fish swim!';
  app.loadWords(app.eval(`tapMarkup(${JSON.stringify(source)})`));
  app.eval(`speak(${JSON.stringify(source)}, { followPassage: true })`);
  const first = app.utterances[0];
  app.eval('stopSpeech()');
  assert.equal(app.activeTimers(), 0);
  first.onboundary({ name: 'word', charIndex: 6 });
  first.onend();
  app.advance(1200);
  assert.equal(app.words.every(word => !word.classList.contains('speech-current')
    && !word.classList.contains('speech-done') && !word.classList.contains('speech-sentence')), true);
  assert.equal(app.utterances.length, 1);
  assert.equal(app.button.attributes['aria-pressed'], 'false');
  assert.ok(app.cancels() >= 2);
});

test('selected device voice, language, and speed apply to reading', () => {
  const voice = { name: 'Filipino Local', lang: 'fil-PH', voiceURI: 'fil-local', localService: true };
  const app = speechApp({ voices: [voice] });
  app.eval('setSpeechSetting("language", "fil-PH")');
  app.eval('setSpeechSetting("voice", "fil-local|fil-PH|Filipino Local")');
  app.eval('setSpeechSetting("rate", "0.85")');
  assert.equal(app.eval('speak("Magandang araw.")'), true);
  assert.equal(app.utterances[0].voice, voice);
  assert.equal(app.utterances[0].lang, 'fil-PH');
  assert.equal(app.utterances[0].rate, 0.85);
});

test('reviewed recording follows word cues and stops without browser synthesis', () => {
  const audioInstances = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.currentTime = 0; audioInstances.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const text = 'River flows.';
  const app = speechApp({ AudioClass: FakeAudio, recordings: {
    p1: { file: 'assets/audio/p1.mp3', text, cues: [[0.1, 0.35], [0.4, 0.9]] }
  } });
  app.loadWords(app.eval(`tapMarkup(${JSON.stringify(text)})`));
  assert.equal(app.eval(`speak(${JSON.stringify(text)}, { followPassage: true, passage: { id: 'p1' } })`), true);
  assert.equal(app.utterances.length, 0);
  assert.equal(audioInstances[0].src, 'assets/audio/p1.mp3');
  audioInstances[0].currentTime = 0.2;
  audioInstances[0].ontimeupdate();
  assert.equal(app.words[0].classList.contains('speech-current'), true);
  audioInstances[0].currentTime = 0.5;
  audioInstances[0].ontimeupdate();
  assert.equal(app.words[0].classList.contains('speech-done'), true);
  assert.equal(app.words[1].classList.contains('speech-current'), true);
  app.eval('stopSpeech()');
  assert.equal(audioInstances[0].paused, true);
  assert.equal(app.words.every(word => !word.classList.contains('speech-current')), true);
});

test('unavailable recording falls back to device voice', () => {
  class BrokenAudio {
    constructor() { this.currentTime = 0; }
    play() { throw new Error('missing file'); }
    pause() {}
  }
  const text = 'River flows.';
  const app = speechApp({ AudioClass: BrokenAudio, recordings: {
    p1: { file: 'assets/audio/p1.mp3', text, cues: [[0.1, 0.35], [0.4, 0.9]] }
  } });
  app.loadWords(app.eval(`tapMarkup(${JSON.stringify(text)})`));
  assert.equal(app.eval(`speak(${JSON.stringify(text)}, { followPassage: true, passage: { id: 'p1' } })`), true);
  assert.equal(app.utterances.length, 1);
  assert.equal(app.utterances[0].text, text);
});
