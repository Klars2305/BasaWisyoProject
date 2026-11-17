/* === src/utils/reading.js === */
/* Browser narration follows source-text offsets, so punctuation and tapped words stay aligned. */
let SPEECH_RUN = 0;
let SPEECH_PASSAGE_ACTIVE = false;
let SPEECH_WORDS = [];
let RECORDED_AUDIO = null;
let SPEECH_FRAME = null;
let SPEECH_FALLBACK_TIMER = null;
let SPEECH_ACTIVE_WORD_INDEX = -1;
const SPEECH_SETTINGS_KEY = "basa_wisyo_speech_v1";
const SPEECH_LANGUAGES = ["auto", "en-US", "fil-PH", "ceb-PH"];

function loadSpeechSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SPEECH_SETTINGS_KEY) || "{}");
    return {
      mode: saved.mode === "device" ? "device" : "auto",
      language: SPEECH_LANGUAGES.includes(saved.language) ? saved.language : "auto",
      voice: typeof saved.voice === "string" ? saved.voice.slice(0, 240) : "",
      rate: [0.75, 0.85, 1, 1.1, 1.25].includes(Number(saved.rate)) ? Number(saved.rate) : 1,
      follow: saved.follow === true
    };
  } catch (error) {
    return { mode: "auto", language: "auto", voice: "", rate: 1, follow: false };
  }
}

const SPEECH_SETTINGS = loadSpeechSettings();

function setSpeechSetting(field, value) {
  if (field === "mode") SPEECH_SETTINGS.mode = value === "device" ? "device" : "auto";
  else if (field === "language") {
    SPEECH_SETTINGS.language = SPEECH_LANGUAGES.includes(value) ? value : "auto";
    SPEECH_SETTINGS.voice = "";
  } else if (field === "voice") SPEECH_SETTINGS.voice = String(value).slice(0, 240);
  else if (field === "rate" && [0.75, 0.85, 1, 1.1, 1.25].includes(Number(value))) SPEECH_SETTINGS.rate = Number(value);
  else if (field === "follow") SPEECH_SETTINGS.follow = value === true;
  else return;
  try { localStorage.setItem(SPEECH_SETTINGS_KEY, JSON.stringify(SPEECH_SETTINGS)); }
  catch (error) { /* Speech still works when preferences cannot be saved. */ }
}

function speechLanguage(passage) {
  return SPEECH_SETTINGS.language === "auto" ? passage?.lang || "en-US" : SPEECH_SETTINGS.language;
}

function speechVoices() {
  try { return Array.from(window.speechSynthesis?.getVoices?.() || []); }
  catch (error) { return []; }
}

function speechVoiceKey(voice) {
  return `${voice.voiceURI || voice.name}|${voice.lang}|${voice.name}`;
}

function speechVoice(language) {
  const voices = speechVoices();
  const chosen = voices.find(voice => speechVoiceKey(voice) === SPEECH_SETTINGS.voice);
  if (chosen) return chosen;
  const primary = language.split("-")[0].toLowerCase();
  const matching = voices.filter(voice => voice.lang?.toLowerCase() === language.toLowerCase());
  const languageVoices = matching.length ? matching
    : voices.filter(voice => voice.lang?.split("-")[0].toLowerCase() === primary);
  return languageVoices.find(voice => voice.localService && /natural|enhanced/i.test(voice.name))
    || languageVoices.find(voice => voice.localService && voice.default)
    || languageVoices.find(voice => voice.localService)
    || languageVoices.find(voice => voice.default)
    || languageVoices[0] || null;
}

function recordedNarration(passage, text, wordCount) {
  if (!passage?.id || wordCount < 1 || typeof RECORDED_NARRATIONS === "undefined") return null;
  const item = RECORDED_NARRATIONS[passage.id];
  if (!item || item.text !== text || !/^assets\/audio\/[\w-]+\.(?:mp3|ogg|wav)$/.test(item.file)
      || !Array.isArray(item.cues) || item.cues.length !== wordCount) return null;
  let previousEnd = 0;
  for (const cue of item.cues) {
    if (!Array.isArray(cue) || cue.length !== 2 || !cue.every(Number.isFinite)
        || cue[0] < previousEnd || cue[1] <= cue[0]) return null;
    previousEnd = cue[1];
  }
  return item;
}

function refreshSpeechControls(passage) {
  const voiceSelect = document.querySelector("#speech-voice");
  if (!voiceSelect) return;
  const language = speechLanguage(passage);
  voiceSelect.innerHTML = `<option value="">Automatic for ${escapeHTML(language)}</option>`
    + speechVoices().map(voice => `<option value="${escapeHTML(speechVoiceKey(voice))}">${escapeHTML(voice.name)} (${escapeHTML(voice.lang)})${voice.localService ? " · on-device" : ""}</option>`).join("");
  voiceSelect.value = SPEECH_SETTINGS.voice;
  if (voiceSelect.value !== SPEECH_SETTINGS.voice) voiceSelect.value = "";
  const mode = document.querySelector("#speech-mode");
  if (mode) mode.value = SPEECH_SETTINGS.mode;
  const languageSelect = document.querySelector("#speech-language");
  if (languageSelect) languageSelect.value = SPEECH_SETTINGS.language;
  const rate = document.querySelector("#speech-rate");
  if (rate) rate.value = String(SPEECH_SETTINGS.rate);
  const status = document.querySelector("#speech-status");
  if (status) {
    const text = passage?.x || "";
    const count = Array.from(text.matchAll(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)).length;
    const hasRecording = !!recordedNarration(passage, text, count);
    status.textContent = hasRecording && SPEECH_SETTINGS.mode === "auto"
      ? "Reviewed recording selected. Device voice will play if the file is unavailable."
      : speechVoice(language) ? "Using a device voice. Word highlighting is approximate if this voice gives no word timing."
      : `No ${language} device voice was found. This device may use another accent or have no narration.`;
  }
}

let SPEECH_PAUSED = false;

function pauseSpeech() {
  if (!SPEECH_PASSAGE_ACTIVE || SPEECH_PAUSED) return false;
  SPEECH_PAUSED = true;
  if (RECORDED_AUDIO) {
    try { RECORDED_AUDIO.pause(); } catch (e) {}
  }
  if (window.speechSynthesis?.speaking && !window.speechSynthesis?.paused) {
    try { window.speechSynthesis.pause(); } catch (e) {}
  }
  updateSpeechButton();
  return true;
}

function resumeSpeech() {
  if (!SPEECH_PASSAGE_ACTIVE || !SPEECH_PAUSED) return false;
  SPEECH_PAUSED = false;
  if (RECORDED_AUDIO) {
    try { RECORDED_AUDIO.play(); } catch (e) {}
  }
  if (window.speechSynthesis?.paused) {
    try { window.speechSynthesis.resume(); } catch (e) {}
  }
  updateSpeechButton();
  return true;
}

function isSpeechPaused() {
  return Boolean(SPEECH_PAUSED);
}

function updateSpeechButton() {
  const button = document.querySelector('[data-a="speech-read"]');
  if (button) {
    const icon = typeof uiIcon === "function" ? uiIcon(SPEECH_PASSAGE_ACTIVE ? "stop" : "sound") : "";
    button.innerHTML = `${icon} ${SPEECH_PASSAGE_ACTIVE ? "Stop audio" : "Read aloud"}`;
    button.title = SPEECH_PASSAGE_ACTIVE ? "Stop reading aloud" : "Read passage aloud";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(SPEECH_PASSAGE_ACTIVE));
  }
  const pauseBtn = document.querySelector?.('[data-a="speech-pause"], [data-a="speech-resume"]');
  if (pauseBtn) {
    pauseBtn.hidden = !SPEECH_PASSAGE_ACTIVE;
    const action = SPEECH_PAUSED ? "speech-resume" : "speech-pause";
    if (pauseBtn.dataset) {
      pauseBtn.dataset.a = action;
    }
    pauseBtn.setAttribute?.("data-a", action);
    const title = SPEECH_PAUSED ? "Resume reading narration" : "Pause reading narration";
    pauseBtn.title = title;
    pauseBtn.setAttribute?.("aria-label", title);
    pauseBtn.innerHTML = SPEECH_PAUSED ? "▶ Resume" : "⏸ Pause";
  }
}

function clearSpeechHighlight() {
  document.querySelectorAll("#active-ps .speech-word").forEach(word => {
    word.classList.remove("speech-current", "speech-done", "speech-sentence");
  });
  SPEECH_WORDS = [];
  SPEECH_ACTIVE_WORD_INDEX = -1;
}

function stopSpeech() {
  SPEECH_RUN++;
  SPEECH_PASSAGE_ACTIVE = false;
  SPEECH_PAUSED = false;
  clearSpeechFallbackTimer();
  if (SPEECH_FRAME !== null) {
    window.cancelAnimationFrame?.(SPEECH_FRAME);
    SPEECH_FRAME = null;
  }
  if (RECORDED_AUDIO) {
    const audio = RECORDED_AUDIO;
    RECORDED_AUDIO = null;
    audio.onended = audio.onerror = audio.ontimeupdate = null;
    try { audio.pause(); audio.currentTime = 0; }
    catch (error) { /* A failed media source may not be seekable. */ }
  }
  try { window.speechSynthesis?.cancel(); } catch (error) { /* Unsupported speech engine. */ }
  clearSpeechHighlight();
  updateSpeechButton();
}

function clearSpeechFallbackTimer() {
  if (SPEECH_FALLBACK_TIMER !== null) {
    window.clearInterval?.(SPEECH_FALLBACK_TIMER);
    SPEECH_FALLBACK_TIMER = null;
  }
}

function speechNow() {
  return window.performance?.now?.() ?? Date.now();
}

function speechSentences(text) {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text),
      part => ({ text: part.segment, start: part.index })).filter(part => part.text.trim());
  }
  const parts = Array.from(text.matchAll(/[^.!?]+(?:[.!?]+(?:["”']+)?|$)\s*/g),
    match => ({ text: match[0], start: match.index })).filter(part => part.text.trim());
  return parts.length ? parts : [{ text, start: 0 }];
}

function revealSpeechPosition(word) {
  if (!SPEECH_SETTINGS.follow || !word?.getBoundingClientRect || !window.innerHeight) return;
  const rect = word.getBoundingClientRect();
  if (rect.top < 90 || rect.bottom > window.innerHeight - 80) {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    word.scrollIntoView?.({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
  }
}

function pauseNarrationFollowOnManualScroll() {
  if (!SPEECH_PASSAGE_ACTIVE || !SPEECH_SETTINGS.follow) return;
  setSpeechSetting("follow", false);
  const followControl = document.querySelector?.("#speech-follow");
  if (followControl) followControl.checked = false;
}
document.addEventListener?.("wheel", pauseNarrationFollowOnManualScroll, { passive: true });
document.addEventListener?.("touchmove", pauseNarrationFollowOnManualScroll, { passive: true });
document.addEventListener?.("keydown", event => {
  if (["PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End", " "].includes(event.key)) {
    pauseNarrationFollowOnManualScroll();
  }
});

function markSpeechWordIndex(index) {
  if (index < 0 || index >= SPEECH_WORDS.length) return;
  if (index === SPEECH_ACTIVE_WORD_INDEX) return;
  SPEECH_ACTIVE_WORD_INDEX = index;
  SPEECH_WORDS.forEach((word, wordIndex) => {
    word.classList.toggle("speech-done", wordIndex < index);
    word.classList.toggle("speech-current", wordIndex === index);
    word.classList.remove("speech-sentence");
  });
  revealSpeechPosition(SPEECH_WORDS[index]);
}

function estimatedSpeechWord(partWords, elapsedMs, rate) {
  let budget = Math.max(0, elapsedMs) * rate / 55;
  for (const item of partWords) {
    const length = Number(item.word.dataset.end) - Number(item.word.dataset.start);
    budget -= Math.max(4, Math.min(16, length + 2));
    if (budget < 0) return item.index;
  }
  return partWords.at(-1)?.index ?? -1;
}

function markRecordedTime(seconds, cues) {
  const index = cues.findIndex(cue => cue[0] <= seconds && seconds < cue[1]);
  if (index === SPEECH_ACTIVE_WORD_INDEX) return;
  SPEECH_ACTIVE_WORD_INDEX = index;
  SPEECH_WORDS.forEach((word, wordIndex) => {
    word.classList.toggle("speech-done", cues[wordIndex][1] <= seconds);
    word.classList.toggle("speech-current", wordIndex === index);
    word.classList.remove("speech-sentence");
  });
  if (index >= 0) revealSpeechPosition(SPEECH_WORDS[index]);
}

function playRecordedNarration(item, source, passage, run) {
  if (typeof Audio !== "function") return false;
  let audio;
  try { audio = new Audio(item.file); }
  catch (error) { return false; }
  RECORDED_AUDIO = audio;
  audio.preload = "auto";
  audio.playbackRate = SPEECH_SETTINGS.rate;
  let failed = false;
  const tick = () => {
    if (run !== SPEECH_RUN || RECORDED_AUDIO !== audio) return;
    markRecordedTime(audio.currentTime, item.cues);
    if (typeof window.requestAnimationFrame === "function") {
      SPEECH_FRAME = window.requestAnimationFrame(tick);
    }
  };
  audio.ontimeupdate = tick;
  audio.onended = () => {
    if (run !== SPEECH_RUN || RECORDED_AUDIO !== audio) return;
    markRecordedTime(item.cues.at(-1)[1], item.cues);
    RECORDED_AUDIO = null;
    SPEECH_PASSAGE_ACTIVE = false;
    updateSpeechButton();
  };
  const fallback = () => {
    if (failed || run !== SPEECH_RUN || RECORDED_AUDIO !== audio) return;
    failed = true;
    if (typeof showToast === "function") showToast("Recording unavailable; using the device voice.", "warn");
    speak(source, { followPassage: true, passage, forceDevice: true });
  };
  audio.onerror = fallback;
  try {
    const started = audio.play();
    if (started?.catch) started.catch(fallback);
    tick();
  } catch (error) { fallback(); }
  return true;
}

function markSpeechSentence(start, end) {
  SPEECH_ACTIVE_WORD_INDEX = -1;
  let firstWord = null;
  SPEECH_WORDS.forEach(word => {
    const wordStart = Number(word.dataset.start);
    const inSentence = wordStart >= start && wordStart < end;
    word.classList.remove("speech-current");
    word.classList.toggle("speech-done", wordStart < start);
    word.classList.toggle("speech-sentence", inSentence);
    if (inSentence && !firstWord) firstWord = word;
  });
  revealSpeechPosition(firstWord);
}

function speak(text, { followPassage = false, passage = null, language = null, forceDevice = false } = {}) {
  stopSpeech();
  const source = String(text || "");
  if (!source.trim()) return false;
  const run = SPEECH_RUN;
  SPEECH_PASSAGE_ACTIVE = followPassage;
  SPEECH_WORDS = followPassage
    ? Array.from(document.querySelectorAll("#active-ps .speech-word")) : [];
  updateSpeechButton();
  if (followPassage && !forceDevice && SPEECH_SETTINGS.mode === "auto") {
    const item = recordedNarration(passage, source, SPEECH_WORDS.length);
    if (item && playRecordedNarration(item, source, passage, run)) return true;
  }
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance !== "function") {
    stopSpeech();
    return false;
  }
  const parts = followPassage ? speechSentences(source) : [{ text: source, start: 0 }];
  const locale = language || speechLanguage(passage);
  const voice = speechVoice(locale);

  function speakPart(partIndex) {
    if (run !== SPEECH_RUN) return;
    clearSpeechFallbackTimer();
    if (partIndex >= parts.length) {
      SPEECH_PASSAGE_ACTIVE = false;
      updateSpeechButton();
      return;
    }
    const part = parts[partIndex];
    const partEnd = part.start + part.text.length;
    const partWords = followPassage ? SPEECH_WORDS.map((word, index) => ({ word, index }))
      .filter(item => Number(item.word.dataset.start) >= part.start
        && Number(item.word.dataset.start) < partEnd) : [];
    if (followPassage) {
      markSpeechSentence(part.start, partEnd);
      if (partWords.length) markSpeechWordIndex(partWords[0].index);
    }
    let startedAt = speechNow() + 400;
    let lastBoundaryAt = -Infinity;
    let lastBoundaryIndex = -1;
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.rate = SPEECH_SETTINGS.rate;
    utterance.lang = voice?.lang || locale;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (run === SPEECH_RUN) startedAt = speechNow();
    };
    utterance.onboundary = event => {
      if (run !== SPEECH_RUN || !followPassage || (event.name && event.name !== "word")) return;
      if (!Number.isInteger(event.charIndex)) return;
      const position = part.start + event.charIndex;
      const matched = partWords.find(item => Number(item.word.dataset.start) <= position
        && position < Number(item.word.dataset.end))
        || partWords.find(item => Number(item.word.dataset.start) >= position);
      if (!matched || matched.index <= lastBoundaryIndex) return;
      lastBoundaryIndex = matched.index;
      lastBoundaryAt = speechNow();
      if (matched.index > SPEECH_ACTIVE_WORD_INDEX) markSpeechWordIndex(matched.index);
    };
    utterance.onend = () => {
      if (run !== SPEECH_RUN) return;
      clearSpeechFallbackTimer();
      if (followPassage) {
        SPEECH_WORDS.forEach(word => {
          if (Number(word.dataset.start) < part.start + part.text.length) {
            word.classList.remove("speech-current", "speech-sentence");
            word.classList.add("speech-done");
          }
        });
      }
      speakPart(partIndex + 1);
    };
    utterance.onerror = () => {
      if (run !== SPEECH_RUN) return;
      stopSpeech();
      if (typeof showToast === "function") showToast("Audio narration stopped. Please try again.", "warn");
    };
    try {
      window.speechSynthesis.speak(utterance);
      if (partWords.length && typeof window.setInterval === "function") {
        SPEECH_FALLBACK_TIMER = window.setInterval(() => {
          if (run !== SPEECH_RUN) return;
          const now = speechNow();
          if (now - lastBoundaryAt < 650) return;
          const estimated = estimatedSpeechWord(partWords, now - startedAt, SPEECH_SETTINGS.rate);
          if (estimated > SPEECH_ACTIVE_WORD_INDEX) markSpeechWordIndex(estimated);
        }, 100);
      }
    }
    catch (error) { utterance.onerror(); }
  }

  speakPart(0);
  return true;
}

window.addEventListener?.("pagehide", stopSpeech);
window.speechSynthesis?.addEventListener?.("voiceschanged", () =>
  refreshSpeechControls(typeof ACTIVE_QUIZ === "undefined" ? null : ACTIVE_QUIZ?.steps[ACTIVE_QUIZ.idx]?.P));

// Word counter and tap-word markup generator
const wordCount = s => s.trim().split(/\s+/).filter(Boolean).length;

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const tapMarkup = text => {
  let markup = "";
  let lastIndex = 0;
  for (const match of text.matchAll(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)) {
    markup += escapeHTML(text.slice(lastIndex, match.index));
    const w = match[0];
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (D[clean]) {
      markup += `<button type="button" class="w speech-word" data-a="tip" data-v="${clean}" data-start="${match.index}" data-end="${match.index + w.length}" aria-label="Show meanings for ${escapeHTML(w)}">${escapeHTML(w)}</button>`;
    } else {
      markup += `<span class="speech-word" data-start="${match.index}" data-end="${match.index + w.length}">${escapeHTML(w)}</span>`;
    }
    lastIndex = match.index + w.length;
  }
  return markup + escapeHTML(text.slice(lastIndex));
};

// Navigation icons


/* === src/components/navigation.js === */
/* ==========================================================================
   BasaWisyo - Unified Role-Based Responsive Navigation (navigation.js)
   Single authoritative navigation configuration, independent route access,
   and shared rendering interface.
   ========================================================================== */

const ICONS = {
  admin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  teacher: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="8" r="3"/><path d="M6 14c0-2 2.5-3 6-3s6 1 6 3"/></svg>',
  home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  assess: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
  practice: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  explore: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  quest: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  reports: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
  profile: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/></svg>',
  parent: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  board: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3zM16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1h-3"/></svg>',
  about: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  services: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.3 6.7L21 11l-6.7 2.3L12 20l-2.3-6.7L3 11l6.7-2.3L12 2zM20 18v4M18 20h4"/></svg>',
  users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2H2zM17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v1h-3"/></svg>',
  students: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2H2zM17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v1h-3"/></svg>',
  classes: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  backup: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  add: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg>',
  copy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></svg>',
  projector: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M8 21h8M7 8h10M7 11h7"/></svg>',
  print: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V3h12v5M6 17H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4"/></svg>',
  upload: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V5M7 10l5-5 5 5M4 17v4h16v-4"/></svg>',
  reset: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>',
  theme: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  trash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  bulb: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  badge: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
  lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  sound: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  stop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
  refresh: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  eye: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>',
  classroom: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
  target: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  sparkles: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>',
  flashcards: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="15" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v13"/></svg>',
  studio: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/></svg>',
  "teacher-studio": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/></svg>'
};

function uiIcon(name) {
  const icon = ICONS[name] ||
    (name === "students" ? ICONS.users :
     name === "classes" ? ICONS.classroom :
     name === "teacher-studio" ? ICONS.studio :
     name === "explore" ? ICONS.practice :
     "");
  return icon ? icon.replace('<svg ', '<svg class="ui-icon" aria-hidden="true" focusable="false" ') : "";
}

/**
 * Authoritative Navigation Matrix
 * Student: Home · Read · Practice · Class · Profile
 * Teacher: Overview · Students · Materials · Class · Reports
 * Admin: Overview · Users · Classes · Content · Settings
 * Guest: Home · Explore · About · Sign In (Exactly 4 destinations)
 */
const NAV_CONFIG = {
  student: [
    { id: "home", label: "Home", icon: "home" },
    { id: "practice", label: "Read", icon: "practice" },
    { id: "flashcards", label: "Practice", icon: "flashcards" },
    { id: "board", label: "Class", icon: "classroom" },
    { id: "profile", label: "Profile", icon: "profile" }
  ],
  teacher: [
    { id: "home", label: "Overview", icon: "home" },
    { id: "teacher", label: "Students", icon: "users" },
    { id: "teacher-studio", label: "Materials", icon: "studio" },
    { id: "board", label: "Class", icon: "classroom" },
    { id: "reports", label: "Reports", icon: "reports" }
  ],
  admin: [
    { id: "admin", label: "Overview", icon: "admin" },
    { id: "users", label: "Users", icon: "users" },
    { id: "classes", label: "Classes", icon: "classroom" },
    { id: "practice", label: "Content", icon: "practice" },
    { id: "reports", label: "Settings", icon: "settings" }
  ],
  guest: [
    { id: "home", label: "Home", icon: "home" },
    { id: "practice", label: "Explore", icon: "practice" },
    { id: "about", label: "About", icon: "about" },
    { id: "profile", label: "Sign In", icon: "user" }
  ]
};

const TAB_TITLES = {
  admin: "Overview",
  users: "Users",
  classes: "Classes",
  teacher: "Overview",
  students: "Students",
  home: "Home",
  assess: "Assess",
  practice: "Read",
  explore: "Explore",
  studio: "Reading Studio",
  "teacher-studio": "Materials",
  quest: "Bayanihan Quest",
  flashcards: "Practice",
  board: "Class",
  reports: "Reports",
  profile: "Profile",
  settings: "Settings",
  parent: "Parent Hub",
  about: "About Us",
  services: "Services"
};

function getNavItemsForRole(role) {
  const norm = (role === "teacher" || role === "admin" || role === "student") ? role : "guest";
  return NAV_CONFIG[norm] || NAV_CONFIG.guest;
}

function bottomTabsForRole(role) {
  const items = getNavItemsForRole(role);
  return items.map(item => item.id);
}

function isRouteActive(navId, currentTab, role = "guest") {
  if (navId === currentTab) return true;
  if (role === "student" || role === "guest") {
    if (navId === "practice" && (currentTab === "studio" || currentTab === "practice")) return true;
    if (navId === "flashcards" && (currentTab === "assess" || currentTab === "flashcards")) return true;
    if (navId === "board" && (currentTab === "quest" || currentTab === "board")) return true;
  }
  if (role === "teacher") {
    if (navId === "home" && (currentTab === "home" || currentTab === "teacher-preview")) return true;
    if (navId === "teacher" && (currentTab === "teacher" || currentTab === "students")) return true;
    if (navId === "teacher-studio" && (currentTab === "practice" || currentTab === "teacher-studio")) return true;
    if (navId === "board" && (currentTab === "board" || currentTab === "quest")) return true;
    if (navId === "reports" && currentTab === "reports") return true;
  }
  if (role === "admin") {
    if (navId === "admin" && (currentTab === "home" || currentTab === "admin")) return true;
    if (navId === "users" && currentTab === "users") return true;
    if (navId === "classes" && currentTab === "classes") return true;
    if (navId === "practice" && currentTab === "practice") return true;
    if (navId === "reports" && (currentTab === "settings" || currentTab === "reports")) return true;
  }
  return false;
}

/**
 * Independent Route Authorization
 * Validates permission to open any route independent of button presence.
 */
function canAccessRoute(route, user, state = {}) {
  const role = user ? user.role : "guest";

  // Admin-only routes
  if (["admin", "users", "classes"].includes(route)) {
    return role === "admin";
  }

  // Teacher-only routes
  if (["teacher", "students", "teacher-studio", "teacher-preview"].includes(route)) {
    return role === "teacher";
  }

  // Reports requires teacher or admin
  if (route === "reports") {
    return role === "teacher" || role === "admin";
  }

  // Mandatory placement check for new/unplaced students
  if (role === "student" && (state.lvl === null || user.lvl === null)) {
    if (!["assess", "home", "profile", "about", "services"].includes(route)) {
      return false;
    }
  }

  // Guest cannot open private personal studio
  if (role === "guest" && ["studio"].includes(route)) {
    return false;
  }

  return true;
}

function renderNavButtons(role, currentTab, isTopNav = false) {
  const items = getNavItemsForRole(role);
  return items.map(item => {
    const active = isRouteActive(item.id, currentTab, role);
    return `
      <button type="button" data-a="tab" data-v="${item.id}" data-nav-route="${item.id}"
        class="${active ? 'on active' : ''}" ${active ? 'aria-current="page"' : ''}
        aria-label="${item.label}">
        ${uiIcon(item.icon || item.id)}
        <span>${item.label}</span>
      </button>
    `;
  }).join("");
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ICONS,
    uiIcon,
    NAV_CONFIG,
    TAB_TITLES,
    getNavItemsForRole,
    bottomTabsForRole,
    isRouteActive,
    canAccessRoute,
    renderNavButtons
  };
}


/* === src/components/shell.js === */
/* ==========================================================================
   UI Routing and Rendering
   ========================================================================== */
let LAST_RENDER_LOCATION = null;
function renderApp() {
  document.documentElement.setAttribute("data-theme", S.theme);
  document.documentElement.style.setProperty("--font-scale", S.fontScale);

  const showWelcome = !AUTH.currentUser && !GUEST_MODE;
  document.body.classList.toggle("auth-entry", showWelcome);
  $("#welcome-screen").hidden = !showWelcome;
  if (showWelcome) {
    LAST_RENDER_LOCATION = "welcome";
    return;
  }

  const u = AUTH.currentUser;
  const role = u ? u.role : "guest";

  // Update header level pill
  const pill = $("#lv-pill");
  if (pill) {
    pill.hidden = false;
    if (role === "teacher" || role === "admin") {
      pill.textContent = role === "teacher" ? (u.section || "Classroom") : (u.school || "School admin");
      pill.className = "pill";
    } else if (S.lvl === null) {
      pill.textContent = "Take Placement";
      pill.className = "pill";
    } else {
      pill.textContent = PHIL_IRI_LEVELS[S.lvl];
      pill.className = "pill " + (S.lvl >= 2 ? "ok" : S.lvl === 1 ? "warn" : "");
    }
  }
  const headerStatusDot = $(".app-header .header-status-dot");
  if (headerStatusDot) headerStatusDot.hidden = false;

  // Update header hearts badge
  const hdrHearts = $("#hdr-hearts-container");
  if (hdrHearts) {
    if ((role === "student" || role === "guest") && typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) {
      hdrHearts.innerHTML = typeof renderHeartPill === "function" ? renderHeartPill(true) : "";
      hdrHearts.hidden = false;
    } else {
      hdrHearts.innerHTML = "";
      hdrHearts.hidden = true;
    }
  }

  // Update header streak badge
  const hdrStreak = $("#hdr-streak-container");
  if (hdrStreak) {
    if (role === "student" || role === "guest") {
      hdrStreak.innerHTML = typeof renderStreakPill === "function" ? renderStreakPill() : "";
      hdrStreak.hidden = false;
      if (hdrStreak.dataset) {
        hdrStreak.dataset.a = "tab";
        hdrStreak.dataset.v = "quest";
      }
      if (typeof hdrStreak.setAttribute === "function") {
        hdrStreak.setAttribute("role", "button");
        hdrStreak.setAttribute("tabindex", "0");
      }
      hdrStreak.title = "View reading streak & daily quests";
    } else {
      hdrStreak.innerHTML = "";
      hdrStreak.hidden = true;
    }
  }

  // Update header upgrade badge
  const hdrUpgrade = $("#hdr-upgrade-container");
  if (hdrUpgrade) {
    if (role === "student" || role === "guest") {
      const isPrem = typeof isUserPremium === "function" && isUserPremium();
      hdrUpgrade.innerHTML = `
        <button type="button" class="hdr-upgrade-pill ${isPrem ? 'is-premium' : ''}" data-a="upgrade-open" title="${isPrem ? 'Wisyo Plus Active — Click to view plan' : 'Upgrade to Wisyo Plus'}">
          <span class="upgrade-crown" aria-hidden="true">👑</span>
          <span class="upgrade-text">Wisyo Plus</span>
          <svg class="upgrade-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      `;
      hdrUpgrade.hidden = false;
    } else {
      hdrUpgrade.innerHTML = "";
      hdrUpgrade.hidden = true;
    }
  }

  // Update user header badge
  const hdrAvatar = $("#hdr-user-avatar");
  const hdrName = $("#hdr-user-name");
  const hdrRole = $("#hdr-user-role");
  const hdrAuth = $("#hdr-auth-btn");
  const hdrSession = $("#hdr-session-btn");
  const hdrSessionLabel = $("#hdr-session-label");
  if (hdrAvatar && hdrName && hdrRole) {
    hdrAvatar.className = "user-avatar-dot";
    if (role === "student" || role === "guest") {
      hdrAvatar.classList.add("frame-" + journeySelectedFrame());
    }
    if (u) {
      if (role === "student") {
        hdrAvatar.innerHTML = `<img src="assets/images/wisyo.png" alt="${escapeHTML(u.name)}" class="hdr-avatar-img">`;
      } else {
        hdrAvatar.textContent = u.name ? u.name.charAt(0).toUpperCase() : "?";
      }
      hdrName.textContent = u.name ? u.name.split(" ")[0] : "User";
      hdrRole.textContent = u.role.toUpperCase();
      hdrRole.className = "user-role-badge role-" + u.role;
    } else {
      hdrAvatar.innerHTML = `<img src="assets/images/wisyo.png" alt="Guest" class="hdr-avatar-img">`;
      hdrName.textContent = S.guestToken ? "Guest (" + S.guestToken + ")" : "Guest";
      hdrRole.textContent = "GUEST";
      hdrRole.className = "user-role-badge role-guest";
    }
  }
  if (hdrAuth) {
    if (hdrAuth.dataset) {
      hdrAuth.dataset.a = u ? "tab" : "auth-open";
      if (u) hdrAuth.dataset.v = role === "student" ? "profile" : role;
      else delete hdrAuth.dataset.v;
    }
    hdrAuth.title = u ? `Open ${role === "student" ? "your profile" : "your dashboard"}` : "Sign in or create an account";
    if (typeof hdrAuth.setAttribute === "function") {
      hdrAuth.setAttribute("aria-label", hdrAuth.title);
    }
  }
  if (hdrSession && hdrSessionLabel) {
    if (hdrSession.dataset) {
      hdrSession.dataset.a = u ? "auth-logout" : "auth-open";
    }
    hdrSessionLabel.textContent = u ? "Log Out" : "Sign In";
    if (typeof hdrSession.setAttribute === "function") {
      hdrSession.setAttribute("aria-label", u ? "Log out and return to the landing page" : "Sign in");
    }
    const sessionIcon = typeof hdrSession.querySelector === "function" ? hdrSession.querySelector(".session-icon") : null;
    if (sessionIcon) {
      sessionIcon.innerHTML = u
        ? `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`
        : `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>`;
    }
  }

  // Top subnav pills based on role
  let subnavItems = [
    ["home", "Home"],
    ["practice", "All Passages"],
    ["flashcards", "Flashcards"],
    ["studio", "Reading Studio"],
    ["board", "Class Board"],
    ["quest", "Bayanihan"],
    ["about", "About"],
    ["services", "Programs"]
  ];
  if (role === "teacher") {
    subnavItems = [
      ["teacher", "Classroom Hub"],
      ["teacher-studio", "Reading Studio"],
      ["home", "Class Overview"],
      ["practice", "Passage Library"],
      ["board", "Class Board"],
      ["reports", "Reports (Demo)"]
    ];
  } else if (role === "admin") {
    subnavItems = [
      ["admin", "Admin Console"],
      ["practice", "Curriculum"],
      ["reports", "Reports (Demo)"],
      ["home", "App Preview"]
    ];
  }

  const snEl = $("#sn");
  if (snEl) {
    snEl.innerHTML = typeof renderNavButtons === "function"
      ? renderNavButtons(role, CURRENT_TAB, true)
      : subnavItems.map(item => `
          <button data-a="tab" data-v="${item[0]}" data-nav-route="${item[0]}" class="${CURRENT_TAB === item[0] ? 'on' : ''}" ${CURRENT_TAB === item[0] ? 'aria-current="page"' : ''}>
            ${uiIcon(item[0])}<span>${item[1]}</span>
          </button>
        `).join("");
  }

  // Bottom Navigation tabs based on role
  const bottomTabs = bottomTabsForRole(role);

  const navEl = $("#nav");
  if (navEl) {
    navEl.innerHTML = typeof renderNavButtons === "function"
      ? renderNavButtons(role, CURRENT_TAB, false)
      : bottomTabs.map(k => `
          <button data-a="tab" data-v="${k}" data-nav-route="${k}" class="${CURRENT_TAB === k ? 'on' : ''}" ${CURRENT_TAB === k ? 'aria-current="page"' : ''}>
            ${uiIcon(k)}
            <span>${role === "guest" && k === "profile" ? "My Progress" : role === "teacher" && k === "home" ? "Overview" : TAB_TITLES[k] || k}</span>
          </button>
        `).join("");
  }

  // Render view, active quiz, or quiz result
  const main = $("#v");
  if (ACTIVE_QUIZ) {
    renderQuiz();
  } else if (QUIZ_RESULT) {
    renderQuizResult();
  } else {
    switch (CURRENT_TAB) {
      case "home": main.innerHTML = role === "teacher" ? viewTeacherOverview() : viewHome(); break;
      case "teacher-preview": main.innerHTML = viewTeacherLearnerPreview(); break;
      case "assess": main.innerHTML = viewAssess(); break;
      case "practice": main.innerHTML = viewPractice(); break;
      case "studio": main.innerHTML = typeof viewReadingStudio === "function" ? viewReadingStudio() : viewHome(); break;
      case "teacher-studio": main.innerHTML = typeof viewTeacherReadingStudio === "function" ? viewTeacherReadingStudio() : viewTeacher(); break;
      case "flashcards": main.innerHTML = viewFlashcards(); break;
      case "quest": main.innerHTML = viewQuest(); break;
      case "board": main.innerHTML = viewClassBoard(); break;
      case "reports": main.innerHTML = viewReports(); break;
      case "profile": main.innerHTML = viewProfile(); break;
      case "parent": main.innerHTML = viewParent(); break;
      case "about": main.innerHTML = viewAbout(); break;
      case "services": main.innerHTML = viewServices(); break;
      case "teacher": main.innerHTML = viewTeacher(); break;
      case "students": main.innerHTML = viewTeacher(); break;
      case "admin": main.innerHTML = viewAdmin(); break;
      case "users": main.innerHTML = viewAdmin(); break;
      case "classes": main.innerHTML = viewAdmin(); break;
      case "settings": main.innerHTML = viewAdmin(); break;
      default: main.innerHTML = viewHome();
    }
  }

  const location = ACTIVE_QUIZ ? "quiz" : QUIZ_RESULT ? "quiz-result" : `tab:${CURRENT_TAB}`;
  if (location !== LAST_RENDER_LOCATION) {
    LAST_RENDER_LOCATION = location;
    if ((ACTIVE_QUIZ || QUIZ_RESULT) && main?.scrollIntoView) {
      main.scrollIntoView({ block: "start", behavior: "auto" });
    } else {
      window.scrollTo?.({ top: 0, behavior: "auto" });
    }
  }

  // Onboarding tour check & repositioning
  if (typeof getActiveTour === "function" && getActiveTour() && getActiveTour().active) {
    if (typeof positionTourSpotlightAndCard === "function") {
      const step = getActiveTour().steps[getActiveTour().stepIndex];
      if (step) positionTourSpotlightAndCard(step);
    }
  } else if (!ACTIVE_QUIZ && !QUIZ_RESULT && !showWelcome) {
    if (typeof checkAndAutoStartOnboardingTour === "function") {
      checkAndAutoStartOnboardingTour();
    }
  }
}



/* === src/components/notifications.js === */
/* ==========================================================================
   Universal Pop-up Notification System
   ========================================================================== */
function showPopupModal(options = {}) {
  if (typeof document === "undefined" || typeof document.createElement !== "function" || !document.body) return;

  const msg = typeof options === "string" ? options : (options.message || options.msg || "");
  const type = options.type || options.kind || "info";
  const title = options.title || "";
  const duration = typeof options.duration === "number" ? options.duration : 4200;
  const confirmText = options.confirmText || "Got it";

  const existing = typeof document.getElementById === "function"
    ? document.getElementById("universal-popup-overlay")
    : (typeof document.querySelector === "function" ? document.querySelector("#universal-popup-overlay") : null);
  if (existing) {
    if (existing._dismissTimer) clearTimeout(existing._dismissTimer);
    existing.remove?.();
  }

  const typeConfig = {
    ok:      { icon: "✅", title: title || "Success!", class: "popup-ok", badgeBg: "rgba(16, 185, 129, 0.15)", border: "#10b981", btnClass: "blue" },
    success: { icon: "✅", title: title || "Success!", class: "popup-ok", badgeBg: "rgba(16, 185, 129, 0.15)", border: "#10b981", btnClass: "blue" },
    warn:    { icon: "⚠️", title: title || "Notice", class: "popup-warn", badgeBg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", btnClass: "gold-btn" },
    warning: { icon: "⚠️", title: title || "Notice", class: "popup-warn", badgeBg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", btnClass: "gold-btn" },
    danger:  { icon: "❌", title: title || "Attention", class: "popup-danger", badgeBg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", btnClass: "danger" },
    error:   { icon: "❌", title: title || "Attention", class: "popup-danger", badgeBg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", btnClass: "danger" },
    info:    { icon: "ℹ️", title: title || "BasaWisyo Notice", class: "popup-info", badgeBg: "rgba(43, 127, 255, 0.15)", border: "#2b7fff", btnClass: "blue" }
  }[type] || { icon: "💬", title: title || "BasaWisyo Notice", class: "popup-info", badgeBg: "rgba(43, 127, 255, 0.15)", border: "#2b7fff", btnClass: "blue" };

  let displayIcon = typeConfig.icon;
  if (/^([🎉🚀👏📝📇🎯📋📦👑❤️🔥⭐🛡️⚠️])/.test(msg)) {
    const match = msg.match(/^([🎉🚀👏📝📇🎯📋📦👑❤️🔥⭐🛡️⚠️])/);
    if (match) displayIcon = match[1];
  }

  const overlay = document.createElement("div");
  overlay.id = "universal-popup-overlay";
  overlay.className = "app-popup-overlay toast";
  overlay.setAttribute?.("role", "dialog");
  overlay.setAttribute?.("aria-modal", "true");
  overlay.setAttribute?.("aria-live", "assertive");
  overlay.setAttribute?.("aria-labelledby", "popup-modal-title");

  const safeTitle = typeof escapeHTML === "function" ? escapeHTML(typeConfig.title) : typeConfig.title;
  const safeMsg = typeof escapeHTML === "function" ? escapeHTML(msg) : msg;
  const safeBtn = typeof escapeHTML === "function" ? escapeHTML(confirmText) : confirmText;

  overlay.innerHTML = `
    <div class="app-popup-card ${typeConfig.class}">
      <div class="popup-badge" style="background:${typeConfig.badgeBg};border:2px solid ${typeConfig.border}" aria-hidden="true">${displayIcon}</div>
      <h3 id="popup-modal-title" class="popup-title">${safeTitle}</h3>
      <p class="popup-message">${safeMsg}</p>
      <button type="button" class="btn ${typeConfig.btnClass} popup-btn" data-a="popup-close">${safeBtn}</button>
      ${duration > 0 ? `<div class="popup-progress-track"><div class="popup-progress-bar" style="animation-duration:${duration}ms"></div></div>` : ""}
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    if (!overlay.parentNode) return;
    if (overlay._dismissTimer) clearTimeout(overlay._dismissTimer);
    overlay.classList?.add?.("popup-closing");
    setTimeout(() => overlay.remove?.(), 180);
  };

  const btn = overlay.querySelector?.(".popup-btn");
  if (btn) {
    btn.addEventListener?.("click", close);
    setTimeout(() => btn.focus?.(), 40);
  }

  overlay.addEventListener?.("click", e => {
    if (e.target === overlay) close();
  });

  const keyHandler = e => {
    if (e.key === "Escape") {
      close();
      if (typeof document.removeEventListener === "function") {
        document.removeEventListener("keydown", keyHandler);
      }
    }
  };
  if (typeof document.addEventListener === "function") {
    document.addEventListener("keydown", keyHandler, { once: true });
  }

  if (duration > 0) {
    overlay._dismissTimer = setTimeout(close, duration);
  }
}

function showToast(msg, type = "info") {
  showPopupModal({ message: msg, type });
}



/* === src/components/onboarding-tour.js === */
/* ==========================================================================
   BasaWisyo - Interactive Onboarding Tour UI Component (onboarding-tour.js)
   Visual spotlight overlay, accessible dialog, keyboard controls, and
   viewport-safe mobile responsive positioning.
   ========================================================================== */

let ACTIVE_TOUR = null;
let TOUR_KEY_LISTENER = null;
let TOUR_REPOSITION_LISTENER = null;
let TOUR_VISUAL_VIEWPORT_LISTENER = null;
let IS_TRANSITIONING = false;
let LAST_FOCUSED_ELEMENT = null;
let CURRENT_RENDER_TOKEN = 0;

function getActiveTour() {
  return ACTIVE_TOUR;
}

function startOnboardingTour(tourId) {
  const def = typeof getTourDefinition === "function" ? getTourDefinition(tourId) : null;
  if (!def || !Array.isArray(def.steps) || def.steps.length === 0) return false;

  closeTourOverlay();

  if (typeof document !== "undefined" && document.activeElement) {
    LAST_FOCUSED_ELEMENT = document.activeElement;
  }

  ACTIVE_TOUR = {
    tourId,
    definition: def,
    stepIndex: 0,
    steps: def.steps,
    active: true
  };

  const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
  if (typeof saveTourStatus === "function") {
    saveTourStatus(userId, tourId, "in_progress", 0);
  }

  renderTourStep();
  bindTourEventListeners();
  return true;
}

function nextTourStep() {
  if (!ACTIVE_TOUR) return;
  if (ACTIVE_TOUR.stepIndex < ACTIVE_TOUR.steps.length - 1) {
    ACTIVE_TOUR.stepIndex++;
    const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
    if (typeof saveTourStatus === "function") {
      saveTourStatus(userId, ACTIVE_TOUR.tourId, "in_progress", ACTIVE_TOUR.stepIndex);
    }
    renderTourStep();
  } else {
    finishOnboardingTour();
  }
}

function prevTourStep() {
  if (!ACTIVE_TOUR) return;
  if (ACTIVE_TOUR.stepIndex > 0) {
    ACTIVE_TOUR.stepIndex--;
    const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
    if (typeof saveTourStatus === "function") {
      saveTourStatus(userId, ACTIVE_TOUR.tourId, "in_progress", ACTIVE_TOUR.stepIndex);
    }
    renderTourStep();
  }
}

function skipOnboardingTour() {
  if (!ACTIVE_TOUR) return;
  const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
  if (typeof saveTourStatus === "function") {
    saveTourStatus(userId, ACTIVE_TOUR.tourId, "skipped", ACTIVE_TOUR.stepIndex);
  }
  closeTourOverlay();
  if (typeof showToast === "function") {
    showToast("Tutorial skipped. You can replay it anytime from your Profile! 🦉", "info");
  }
}

function finishOnboardingTour() {
  if (!ACTIVE_TOUR) return;
  const userId = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest";
  if (typeof saveTourStatus === "function") {
    saveTourStatus(userId, ACTIVE_TOUR.tourId, "completed", ACTIVE_TOUR.steps.length - 1);
  }
  closeTourOverlay();
  if (typeof showToast === "function") {
    showToast("Tutorial finished! Enjoy your reading journey! 🎉", "ok");
  }
}

function closeTourOverlay() {
  ACTIVE_TOUR = null;
  IS_TRANSITIONING = false;
  CURRENT_RENDER_TOKEN++;
  unbindTourEventListeners();
  const el = document.getElementById("tour-overlay");
  if (el && typeof el.remove === "function") el.remove();

  if (LAST_FOCUSED_ELEMENT && typeof LAST_FOCUSED_ELEMENT.focus === "function") {
    try {
      LAST_FOCUSED_ELEMENT.focus();
    } catch (e) {}
    LAST_FOCUSED_ELEMENT = null;
  }
}

function findTargetElement(selector) {
  if (!selector) return null;
  const parts = selector.split(",").map(s => s.trim());
  for (const part of parts) {
    try {
      const candidates = (typeof document !== "undefined" && typeof document.querySelectorAll === "function")
        ? Array.from(document.querySelectorAll(part))
        : (document.querySelector ? [document.querySelector(part)] : []);

      for (const el of candidates) {
        if (!el) continue;
        const isHidden = (typeof el.hasAttribute === "function" && el.hasAttribute("hidden")) ||
                         (el.style && el.style.display === "none");
        if (isHidden) continue;

        // Check if element or ancestor is hidden (e.g. #sn on mobile or nav on desktop)
        let ancestor = el;
        let isAncestorHidden = false;
        while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
          if (ancestor.style && ancestor.style.display === "none") {
            isAncestorHidden = true;
            break;
          }
          if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
            try {
              const comp = window.getComputedStyle(ancestor);
              if (comp.display === "none" || comp.visibility === "hidden") {
                isAncestorHidden = true;
                break;
              }
            } catch (err) {}
          }
          ancestor = ancestor.parentElement;
        }

        if (!isAncestorHidden) {
          return el;
        }
      }
    } catch (e) {}
  }
  return null;
}

function scrollTargetIntoView(target) {
  if (!target || typeof target.getBoundingClientRect !== "function") return;

  // 1. Horizontal scroll for container like #sn or any horizontally scrollable container
  let parent = target.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    try {
      const isScrollable = (parent.scrollWidth > parent.clientWidth + 2) || parent.id === "sn";
      if (isScrollable) {
        const style = (typeof window !== "undefined" && window.getComputedStyle) ? window.getComputedStyle(parent) : {};
        const ox = style.overflowX || "";
        if (ox === "auto" || ox === "scroll" || parent.id === "sn") {
          const pRect = parent.getBoundingClientRect();
          const tRect = target.getBoundingClientRect();
          // If target is cut off on left or right inside parent
          if (tRect.left < pRect.left + 8 || tRect.right > pRect.right - 8) {
            const offset = (tRect.left - pRect.left) - ((parent.clientWidth - tRect.width) / 2);
            parent.scrollLeft += offset;
          }
        }
      }
    } catch (e) {}
    parent = parent.parentElement;
  }

  // 2. Vertical scroll if outside usable area
  try {
    const rect = target.getBoundingClientRect();
    const vh = (typeof window !== "undefined" && window.visualViewport)
      ? window.visualViewport.height
      : (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768);
    const navEl = document.getElementById("nav") || (typeof document !== "undefined" && document.querySelector ? document.querySelector("nav") : null);
    const bottomNavHeight = (navEl && navEl.offsetHeight) ? navEl.offsetHeight : 64;

    if (rect.top < 64 || rect.bottom > (vh - bottomNavHeight - 8)) {
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      }
    }
  } catch (e) {}
}

function setTourButtonsDisabled(disabled) {
  const card = document.getElementById("tour-card");
  if (!card) {
    IS_TRANSITIONING = false;
    return;
  }
  const buttons = card.querySelectorAll(".tour-btn");
  buttons.forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      btn.setAttribute("aria-busy", "true");
    } else {
      btn.removeAttribute("aria-busy");
    }
  });
}

function positionTourSpotlightAndCard(step, targetEl = null) {
  const spotlight = document.getElementById("tour-spotlight");
  const card = document.getElementById("tour-card");
  if (!card || !spotlight) return;

  const target = targetEl || findTargetElement(step.target);

  if (!target || typeof target.getBoundingClientRect !== "function") {
    // If target not visible or missing, center card gracefully without spotlight
    spotlight.style.display = "none";
    card.style.top = "50%";
    card.style.left = "50%";
    card.style.transform = "translate(-50%, -50%)";
    card.style.maxWidth = "min(420px, calc(100vw - 24px))";
    return;
  }

  spotlight.style.display = "block";

  // Visual viewport metrics
  const vv = (typeof window !== "undefined") ? window.visualViewport : null;
  const vw = vv ? vv.width : (typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024);
  const vh = vv ? vv.height : (typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 768);
  const vTop = vv ? vv.offsetTop : 0;
  const vLeft = vv ? vv.offsetLeft : 0;

  const rect = target.getBoundingClientRect();
  const pad = 6;

  // Clamped spotlight bounds to avoid any layout overflow
  const sTop = Math.max(0, rect.top - pad);
  const sLeft = Math.max(0, rect.left - pad);
  const sRight = Math.min(vw, rect.right + pad);
  const sBottom = Math.min(vh, rect.bottom + pad);
  const sWidth = Math.max(0, sRight - sLeft);
  const sHeight = Math.max(0, sBottom - sTop);

  spotlight.style.top = (vTop + sTop) + "px";
  spotlight.style.left = (vLeft + sLeft) + "px";
  spotlight.style.width = sWidth + "px";
  spotlight.style.height = sHeight + "px";

  // Card dimensions and safe bounds
  const cardWidth = Math.min(420, vw - 24);
  const cardHeight = card.offsetHeight || 220;
  const navEl = document.getElementById("nav") || (typeof document !== "undefined" && document.querySelector ? document.querySelector("nav") : null);
  const bottomNavHeight = (navEl && navEl.offsetHeight) ? navEl.offsetHeight : 64;

  const safeTop = vTop + 12;
  const safeBottom = vTop + vh - bottomNavHeight - 12;

  let top = vTop + rect.bottom + 12;

  // If placement prefers top or overflows bottom, attempt positioning above
  if (step.position === "top" || (top + cardHeight > safeBottom)) {
    const topAbove = vTop + rect.top - cardHeight - 12;
    if (topAbove >= safeTop) {
      top = topAbove;
    } else if (top + cardHeight > safeBottom) {
      top = Math.max(safeTop, Math.min(top, safeBottom - cardHeight));
    }
  }

  // Horizontally center card relative to target, clamped inside viewport
  let left = vLeft + rect.left + (rect.width / 2) - (cardWidth / 2);
  left = Math.max(vLeft + 12, Math.min(left, vLeft + vw - cardWidth - 12));

  card.style.top = Math.round(top) + "px";
  card.style.left = Math.round(left) + "px";
  card.style.transform = "none";
}

function renderTourStep() {
  if (!ACTIVE_TOUR) return;
  const step = ACTIVE_TOUR.steps[ACTIVE_TOUR.stepIndex];
  if (!step) return;

  IS_TRANSITIONING = true;
  CURRENT_RENDER_TOKEN++;
  const thisToken = CURRENT_RENDER_TOKEN;

  // Auto-switch tab if step requires it and user role allows it
  if (step.preferredTab && typeof CURRENT_TAB !== "undefined" && CURRENT_TAB !== step.preferredTab) {
    const role = typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.role : "guest";
    const isStudent = role === "student" || role === "guest";
    const isUnplaced = isStudent && (typeof S !== "undefined" && S.lvl === null);

    // Unplaced students must not be redirected outside assessment/home/profile
    if (!(isUnplaced && step.preferredTab !== "assess" && step.preferredTab !== "home" && step.preferredTab !== "profile")) {
      CURRENT_TAB = step.preferredTab;
      if (typeof renderApp === "function") renderApp();
    }
  }

  let overlay = document.getElementById("tour-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "tour-overlay";
    overlay.className = "tour-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Interactive Onboarding Guide");
    overlay.innerHTML = `
      <div class="tour-backdrop" data-a="tour-noop"></div>
      <div class="tour-spotlight" id="tour-spotlight"></div>
      <div class="tour-card" id="tour-card" role="document"></div>
    `;
    document.body.appendChild(overlay);
  }

  const card = document.getElementById("tour-card");
  if (!card) {
    IS_TRANSITIONING = false;
    return;
  }

  const isFirst = ACTIVE_TOUR.stepIndex === 0;
  const isLast = ACTIVE_TOUR.stepIndex === ACTIVE_TOUR.steps.length - 1;
  const stepNumber = ACTIVE_TOUR.stepIndex + 1;
  const totalSteps = ACTIVE_TOUR.steps.length;

  card.innerHTML = `
    <div class="tour-header">
      <div class="tour-mascot-badge" aria-hidden="true">
        <img src="assets/images/wisyo.png" alt="">
      </div>
      <div class="tour-meta">
        <div class="tour-badge-row">
          <span class="tour-badge">${escapeHTML(step.badge || "GUIDE")}</span>
          <span class="tour-step-pill">Step ${stepNumber} of ${totalSteps}</span>
        </div>
        <h3 class="tour-title" id="tour-step-title">${escapeHTML(step.title)}</h3>
      </div>
    </div>
    <p class="tour-text">${escapeHTML(step.text)}</p>
    <div class="tour-actions">
      <button type="button" class="tour-btn tour-btn-skip" data-a="tour-skip" aria-label="Skip entire tutorial">Skip Tour</button>
      <div class="tour-btn-group-right">
        ${!isFirst ? `<button type="button" class="tour-btn tour-btn-prev" data-a="tour-prev" aria-label="Go to previous step">← Back</button>` : ""}
        <button type="button" class="tour-btn ${isLast ? 'tour-btn-finish' : 'tour-btn-next'}" data-a="${isLast ? 'tour-finish' : 'tour-next'}" id="tour-primary-btn" aria-label="${isLast ? 'Finish tutorial' : 'Go to next step'}">
          ${isLast ? "Finish 🎉" : "Next →"}
        </button>
      </div>
    </div>
  `;

  // Temporarily disable buttons while layout settles
  setTourButtonsDisabled(true);

  const hasRaf = typeof requestAnimationFrame === "function";
  if (hasRaf) {
    requestAnimationFrame(() => {
      if (!ACTIVE_TOUR || thisToken !== CURRENT_RENDER_TOKEN) return;
      const target = findTargetElement(step.target);
      if (target) {
        scrollTargetIntoView(target);
      }

      requestAnimationFrame(() => {
        if (!ACTIVE_TOUR || thisToken !== CURRENT_RENDER_TOKEN) return;
        positionTourSpotlightAndCard(step, target);
        setTourButtonsDisabled(false);
        IS_TRANSITIONING = false;

        // Focus primary button for accessible keyboard navigation
        const primaryBtn = document.getElementById("tour-primary-btn");
        if (primaryBtn && typeof primaryBtn.focus === "function") {
          primaryBtn.focus();
        }
      });
    });
  } else {
    // Immediate synchronous layout settling for Node / headless test environments
    const target = findTargetElement(step.target);
    if (target) {
      scrollTargetIntoView(target);
    }
    positionTourSpotlightAndCard(step, target);
    setTourButtonsDisabled(false);
    IS_TRANSITIONING = false;

    const primaryBtn = document.getElementById("tour-primary-btn");
    if (primaryBtn && typeof primaryBtn.focus === "function") {
      primaryBtn.focus();
    }
  }
}

function bindTourEventListeners() {
  if (!TOUR_KEY_LISTENER) {
    TOUR_KEY_LISTENER = e => {
      if (!ACTIVE_TOUR) return;
      if (e.key === "Escape") {
        e.preventDefault();
        skipOnboardingTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!IS_TRANSITIONING) nextTourStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!IS_TRANSITIONING) prevTourStep();
      } else if (e.key === "Tab") {
        // Focus trap inside tour card
        const card = document.getElementById("tour-card");
        if (card && typeof card.querySelectorAll === "function") {
          const focusables = card.querySelectorAll("button:not([disabled]), [tabindex]:not([tabindex='-1'])");
          if (focusables.length > 0) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
    };
    window.addEventListener("keydown", TOUR_KEY_LISTENER);
  }

  if (!TOUR_REPOSITION_LISTENER) {
    let rafPending = false;
    TOUR_REPOSITION_LISTENER = () => {
      if (!ACTIVE_TOUR || rafPending) return;
      rafPending = true;
      const scheduleRaf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : (cb => setTimeout(cb, 16));
      scheduleRaf(() => {
        rafPending = false;
        if (ACTIVE_TOUR) {
          const step = ACTIVE_TOUR.steps[ACTIVE_TOUR.stepIndex];
          if (step) positionTourSpotlightAndCard(step);
        }
      });
    };

    window.addEventListener("resize", TOUR_REPOSITION_LISTENER, { passive: true });
    window.addEventListener("scroll", TOUR_REPOSITION_LISTENER, { passive: true });
    if (typeof window.addEventListener === "function") {
      window.addEventListener("orientationchange", TOUR_REPOSITION_LISTENER, { passive: true });
    }

    if (typeof window !== "undefined" && window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
      TOUR_VISUAL_VIEWPORT_LISTENER = TOUR_REPOSITION_LISTENER;
      window.visualViewport.addEventListener("resize", TOUR_VISUAL_VIEWPORT_LISTENER, { passive: true });
      window.visualViewport.addEventListener("scroll", TOUR_VISUAL_VIEWPORT_LISTENER, { passive: true });
    }
  }
}

function unbindTourEventListeners() {
  if (TOUR_KEY_LISTENER) {
    window.removeEventListener("keydown", TOUR_KEY_LISTENER);
    TOUR_KEY_LISTENER = null;
  }
  if (TOUR_REPOSITION_LISTENER) {
    window.removeEventListener("resize", TOUR_REPOSITION_LISTENER);
    window.removeEventListener("scroll", TOUR_REPOSITION_LISTENER);
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("orientationchange", TOUR_REPOSITION_LISTENER);
    }
    TOUR_REPOSITION_LISTENER = null;
  }
  if (TOUR_VISUAL_VIEWPORT_LISTENER && typeof window !== "undefined" && window.visualViewport && typeof window.visualViewport.removeEventListener === "function") {
    window.visualViewport.removeEventListener("resize", TOUR_VISUAL_VIEWPORT_LISTENER);
    window.visualViewport.removeEventListener("scroll", TOUR_VISUAL_VIEWPORT_LISTENER);
    TOUR_VISUAL_VIEWPORT_LISTENER = null;
  }
}

function checkAndAutoStartOnboardingTour() {
  if (typeof shouldAutoStartTour !== "function") return;
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const state = typeof S !== "undefined" ? S : {};
  const recommendation = shouldAutoStartTour(user, state);
  if (recommendation && recommendation.tourId) {
    setTimeout(() => {
      startOnboardingTour(recommendation.tourId);
    }, 400);
  }
}

function replayCurrentRoleTour() {
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const state = typeof S !== "undefined" ? S : {};
  const tourId = typeof resolveAutoTourId === "function" ? resolveAutoTourId(user, state) : "student-unplaced";
  const userId = user ? user.id : "guest";
  if (typeof resetTourStatus === "function") {
    resetTourStatus(userId, tourId);
  }
  startOnboardingTour(tourId);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getActiveTour,
    startOnboardingTour,
    nextTourStep,
    prevTourStep,
    skipOnboardingTour,
    finishOnboardingTour,
    closeTourOverlay,
    findTargetElement,
    scrollTargetIntoView,
    positionTourSpotlightAndCard,
    checkAndAutoStartOnboardingTour,
    replayCurrentRoleTour
  };
}


/* === src/pages/teacher.js === */
/* ==========================================================================
   Teacher Interface Views
   ========================================================================== */

function teacherOverviewStudentProgress(student, passageById) {
  const journey = journeyValid(student.journey) ? student.journey : journeyEmpty(student.lvl);
  const results = Object.entries(journey.results).flatMap(([id, result]) => {
    const passage = passageById.get(id);
    if (!passage || result.total !== passage.qs.length || result.attempts < 1) return [];
    return [{ passage, result }];
  });
  const tier = journeyUnlockedTier({ ...journey, baseTier: Math.max(journey.baseTier, journeyStartingTier(student.lvl)) }, student.journeyOverride);
  const best = [...results].sort((a, b) =>
    b.result.correct / b.result.total - a.result.correct / a.result.total
    || b.result.correct - a.result.correct)[0] || null;
  return { student, tier, completed: results.length, best };
}

function viewTeacherOverview() {
  const teacher = AUTH.currentUser;
  if (!teacher || teacher.role !== "teacher") {
    return `<section class="card"><h2>Class Overview</h2><p class="sub">Teacher account required.</p></section>`;
  }
  const students = AUTH.getTeacherStudents(teacher.shareCode);
  const passages = getPublishedPassages();
  const passageById = new Map(passages.map(passage => [passage.id, passage]));
  const progress = students.map(student => teacherOverviewStudentProgress(student, passageById));
  const completed = progress.reduce((sum, item) => sum + item.completed, 0);
  const assignments = AUTH.assignments.filter(assignment => assignment.teacherCode === teacher.shareCode);
  const practices = AUTH.customPassages.flatMap(raw => {
    if (raw?.ownerId !== teacher.id) return [];
    try { return [normalizePassage(raw)]; } catch (error) { return []; }
  });
  const pending = practices.filter(passage => passage.status === "pending").length;
  const drafts = practices.filter(passage => ["draft", "rejected"].includes(passage.status)).length;
  const learnersWithoutResults = progress.filter(item => item.completed === 0).length;

  return `<div class="teacher-overview">
    <div class="teacher-overview-intro">
      <div><div class="lab">Teacher workspace · ${escapeHTML(teacher.section || "Classroom")}</div>
        <h2>Class Overview</h2>
        <p class="sub">See your class at a glance, then open the Classroom Hub for detailed management.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn o" data-a="tour-replay" title="Replay the teacher onboarding walkthrough">🎓 Replay Tour</button>
        <button class="btn o" data-a="tab" data-v="teacher-preview">${uiIcon("home")} Preview learner experience</button>
      </div>
    </div>

    <section class="card teacher-overview-code" aria-label="Classroom share code">
      <div><div class="lab">Classroom share code</div>
        <strong>${escapeHTML(teacher.shareCode || "No code available")}</strong>
        <p class="sub-sm">Students enter this code to link their account to your class in this browser.</p></div>
      <button class="btn blue" data-a="teacher-copy-code">${uiIcon("copy")} Copy code</button>
    </section>

    <section class="teacher-overview-metrics" aria-label="Local classroom summary">
      <div class="card"><span class="lab">Linked students</span><b>${students.length}</b><span class="sub-sm">In this browser</span></div>
      <div class="card"><span class="lab">Passage results</span><b>${completed}</b><span class="sub-sm">Completed student-passage pairs</span></div>
      <div class="card"><span class="lab">Active assignments</span><b>${assignments.length}</b><span class="sub-sm">Completion is not tracked per assignment</span></div>
      <div class="card"><span class="lab">Awaiting admin review</span><b>${pending}</b><span class="sub-sm">Your submitted practices</span></div>
    </section>

    ${students.length ? `<div class="teacher-overview-grid">
      <section class="card teacher-overview-panel">
        <div class="teacher-overview-panel-head"><div><div class="lab">Learner progress</div><h3>Student snapshot</h3>
          <p class="sub-sm">${learnersWithoutResults} of ${students.length} ${learnersWithoutResults === 1 ? "student has" : "students have"} no completed passage results recorded here.</p></div>
          <button class="btn o sm" data-a="tab" data-v="teacher">Open full roster</button></div>
        <div class="teacher-overview-students">${progress.slice(0, 5).map(item => `<div class="teacher-overview-student">
          <div><b>${escapeHTML(item.student.name)}</b><span class="sub-sm">Current path: ${escapeHTML(DIFF_NAMES[DIFF_KEYS[item.tier]])}</span></div>
          <div class="teacher-overview-student-score"><strong>${item.completed} ${item.completed === 1 ? "passage" : "passages"}</strong>
            <span class="sub-sm">${item.best ? `Best: ${item.best.result.correct}/${item.best.result.total} · ${escapeHTML(item.best.passage.t)}` : "No score yet"}</span></div>
        </div>`).join("")}</div>
        ${students.length > 5 ? `<p class="sub-sm teacher-overview-more">Showing 5 of ${students.length} students. Open the full roster for everyone.</p>` : ""}
      </section>

      <section class="card teacher-overview-panel">
        <div class="teacher-overview-panel-head"><div><div class="lab">Classroom activity</div><h3>Assigned passages</h3></div>
          <button class="btn o sm" data-a="tab" data-v="teacher">Manage assignments</button></div>
        ${assignments.length ? `<ul class="teacher-overview-assignments">${assignments.slice(0, 3).map(assignment => `<li>
          <b>${escapeHTML(assignment.title)}</b>
          <span class="sub-sm">${escapeHTML(assignment.targetGroup || "Class")} · ${escapeHTML(assignment.dueDate || "No due date")}</span>
        </li>`).join("")}</ul>${assignments.length > 3 ? `<p class="sub-sm">${assignments.length - 3} more in Classroom Hub.</p>` : ""}`
          : `<p class="sub">No passages assigned yet. Open Classroom Hub to assign an approved practice.</p>`}
        <div class="teacher-overview-practice-status"><span>${drafts} ${drafts === 1 ? "draft or rejected practice" : "draft or rejected practices"}</span>
          <button class="btn o sm" data-a="tab" data-v="practice">Manage passages</button></div>
      </section>
    </div>` : `<section class="card teacher-overview-empty"><div class="lab">First step</div><h3>Invite students to your class</h3>
      <p class="sub">No student accounts are linked to this share code in this browser yet. Share the code above, then their local reading results can appear here.</p>
      <div class="teacher-overview-empty-actions"><button class="btn blue" data-a="teacher-copy-code">${uiIcon("copy")} Copy share code</button>
        <button class="btn o" data-a="tab" data-v="teacher">Open Classroom Hub</button></div></section>`}

    <p class="sub-sm teacher-overview-disclaimer">This overview uses account data saved in this browser. Scores are formative practice results, not official Phil-IRI assessments or live cross-device submissions.</p>
  </div>`;
}

function viewTeacherLearnerPreview() {
  if (AUTH.currentUser?.role !== "teacher") {
    return `<section class="card"><h2>Learner preview</h2><p class="sub">Teacher account required.</p></section>`;
  }
  const samples = getPublishedPassages().slice(0, 3);
  return `<div class="teacher-preview-page">
    <div class="teacher-overview-intro"><div><div class="lab">Read-only preview</div><h2>What learners see</h2>
      <p class="sub">Students start with placement, follow a reading journey, and practice with approved stories. Their progress appears only when signed in as that student.</p></div>
      <button class="btn o" data-a="tab" data-v="home">Back to Class Overview</button></div>
    <section class="teacher-preview-grid" aria-label="Learner experience preview">
      <div class="card"><div class="lab">1 · Start</div><h3>Placement activity</h3><p class="sub">A short practice placement suggests a reading level. It is not an official Phil-IRI result.</p></div>
      <div class="card"><div class="lab">2 · Practice</div><h3>Reading journey</h3><p class="sub">Learners read approved passages, answer questions, and progress at their own pace.</p></div>
      <div class="card"><div class="lab">3 · Reflect</div><h3>Profile and rewards</h3><p class="sub">Their profile shows best scores, badges, and the next reading step.</p></div>
    </section>
    <section class="card teacher-overview-panel"><div class="lab">Available stories</div><h3>Sample approved passages</h3>
      ${samples.length ? `<ul class="teacher-overview-assignments">${samples.map(passage => `<li><b>${escapeHTML(passage.t)}</b>
        <span class="sub-sm">${escapeHTML(DIFF_NAMES[passage.diff])} · ${passage.qs.length} questions</span></li>`).join("")}</ul>`
        : `<p class="sub">No approved passages are available yet.</p>`}
    </section>
    <p class="sub-sm">Preview only. Teacher accounts do not answer learner quizzes or create learner progress.</p>
  </div>`;
}

function viewTeacher() {
  const teacher = AUTH.currentUser;
  if (!teacher || teacher.role !== "teacher") {
    return `<div class="card"><p>Access restricted to Teacher accounts. Please sign in as a Teacher.</p></div>`;
  }

  const dataset = getClassroomReportDataset(teacher);
  const students = dataset ? dataset.students : [];
  const totalStudents = dataset ? dataset.total : 0;

  // Breakdown by Phil-IRI Level
  const frustCount = dataset ? dataset.levelCounts[0] : 0;
  const instCount = dataset ? dataset.levelCounts[1] : 0;
  const indepCount = dataset ? dataset.levelCounts[2] : 0;
  const mastCount = dataset ? dataset.levelCounts[3] : 0;

  const assessedWithWpm = students.filter(s => s.isAssessed && typeof s.wpm === "number");
  const avgWpm = assessedWithWpm.length > 0 
    ? Math.round(assessedWithWpm.reduce((acc, s) => acc + s.wpm, 0) / assessedWithWpm.length)
    : 0;

  const assessedWithComp = students.filter(s => s.isAssessed && typeof s.comp === "number");
  const avgComp = assessedWithComp.length > 0 
    ? Math.round(assessedWithComp.reduce((acc, s) => acc + s.comp, 0) / assessedWithComp.length)
    : 0;

  const assignments = AUTH.assignments.filter(a => a.teacherCode === teacher.shareCode);
  const assignablePassages = getPublishedPassages();
  const myPractices = AUTH.customPassages
    .filter(passage => passage?.ownerId === teacher.id)
    .map(passage => {
      try { return normalizePassage(passage); } catch (error) { return null; }
    })
    .filter(Boolean);

  return `<div class="teacher-page">
    <!-- Teacher Header & Share Code Hero Banner -->
    <div class="share-code-hero">
      <h2>Classroom Hub</h2>
      <div class="share-code-label">${uiIcon("teacher")} Teacher Share Code (Class Section: ${escapeHTML(teacher.section || "Grade 8")})</div>
      <p class="teacher-share-help">
        Share this code with your nearby students so they can join your classroom roster:
      </p>
      <div class="share-code-box">
        <span class="share-code-digits" id="teacher-share-code-val">${escapeHTML(teacher.shareCode)}</span>
      </div>
      <div class="share-code-actions">
        <button class="share-code-btn" data-a="teacher-copy-code">
          ${uiIcon("copy")} Copy Code
        </button>
        <button class="share-code-btn secondary" data-a="teacher-show-projector">
          ${uiIcon("projector")} Open Projector / Blackboard Mode
        </button>
        <button class="share-code-btn secondary" data-a="open-report-sheet" data-v="live">
          ${uiIcon("print")} Reading Progress Report
        </button>
      </div>
    </div>

    <!-- Live Classroom Metric Summary -->
    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-value">${totalStudents}</div>
        <div class="metric-title">Connected Students</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--coral)">${frustCount}</div>
        <div class="metric-title">Frustration (Intervention)</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--gold-ink)">${instCount}</div>
        <div class="metric-title">Instructional</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--sky)">${indepCount + mastCount}</div>
        <div class="metric-title">Independent / Mastery</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${avgWpm}</div>
        <div class="metric-title">Avg. Words Per Min</div>
      </div>
    </div>

    <section class="card teacher-section-card">
      <div class="teacher-section-head">
        <div>
          <h3>My reading practices</h3>
          <p class="sub">Create custom passages or draft questions with Wisyo AI. An admin reviews submissions before students can read or receive them.</p>
        </div>
        <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
      </div>
      ${myPractices.length ? `<div class="teacher-practice-list">
        ${myPractices.map(passage => `
          <div class="teacher-practice-row">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div><b>${escapeHTML(passage.t)}</b><div class="sub-sm">${escapeHTML(DIFF_NAMES[passage.diff])} · ${wordCount(passage.x)} words</div></div>
              <span class="pill">${escapeHTML(passage.status)}</span>
            </div>
            ${passage.reviewNote ? `<p class="sub" style="margin:8px 0">Admin note: ${escapeHTML(passage.reviewNote)}</p>` : ""}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              ${["draft", "rejected"].includes(passage.status) ? `
                <button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(passage.id)}">Edit</button>
                <button class="btn o sm" data-a="practice-delete" data-v="${escapeHTML(passage.id)}">Delete</button>
              ` : ""}
              ${passage.status === "pending" ? `<button class="btn o sm" data-a="practice-withdraw" data-v="${escapeHTML(passage.id)}">Withdraw to edit</button>` : ""}
              ${passage.status === "published" ? `<span class="sub-sm">Available in the reading library and assignment picker.</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>` : `<p class="sub teacher-empty-state">No practices yet. Add one to start the admin review process.</p>`}
    </section>

    <!-- Targeted Differentiated Assignment Dispatcher -->
    <section class="card teacher-section-card">
      <div class="lab">${uiIcon("target")} Targeted Leveled Assignment Dispatcher</div>
      <p class="sub" style="margin-bottom:14px">
        Send tailored reading passages directly to specific Phil-IRI ability groups in your class:
      </p>
      <div class="assignment-fields">
        <div class="auth-form-group">
          <label for="asg-passage-select">Select Reading Passage</label>
          <select id="asg-passage-select" class="auth-input">
            ${DIFF_KEYS.map(diff => {
              const options = assignablePassages.filter(passage => passage.diff === diff);
              return options.length ? `<optgroup label="${escapeHTML(DIFF_NAMES[diff])}">
                ${options.map(passage => `<option value="${escapeHTML(passage.id)}">${escapeHTML(passage.t)}</option>`).join("")}
              </optgroup>` : "";
            }).join("")}
          </select>
        </div>
        <div class="auth-form-group">
          <label for="asg-target-select">Assign To Group</label>
          <select id="asg-target-select" class="auth-input">
            <option value="all">Entire Class (${totalStudents} students)</option>
            <option value="level-0">Frustration Learners Only (${frustCount} students - Remedial)</option>
            <option value="level-1">Instructional Learners Only (${instCount} students)</option>
            <option value="level-2">Independent Learners Only (${indepCount} students)</option>
            <option value="level-3">Mastery Learners Only (${mastCount} students)</option>
          </select>
        </div>
        <div class="auth-form-group">
          <label for="asg-note-input">Due Date / Note</label>
          <input type="text" id="asg-note-input" class="auth-input" placeholder="e.g. Due Friday, complete quiz">
        </div>
      </div>
      <button class="btn blue teacher-dispatch-button" data-a="teacher-dispatch-assignment">
        ${uiIcon("send")} Dispatch Assignment to Students
      </button>

      <!-- Active Assignments List -->
      ${assignments.length > 0 ? `
        <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
          <div class="lab" style="margin-bottom:8px">Active Assigned Passages:</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${assignments.map(a => `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <span class="assignment-badge">${uiIcon("practice")} ${escapeHTML(a.title)}</span>
                  <span style="font-size:12px;color:var(--sub);margin-left:8px">Target: <b>${escapeHTML(a.targetGroup)}</b> · Due: ${escapeHTML(a.dueDate)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:12px;color:var(--teal);font-weight:600">Active in Student Dashboards</span>
                  <button class="btn o sm" data-a="teacher-remove-assignment" data-v="${escapeHTML(a.id)}">Remove</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}
    </section>

    <!-- Connect Nearby Student via Guest Token -->
    <section class="card teacher-section-card">
      <div class="lab">${uiIcon("upload")} Link Unregistered Student by Guest Token</div>
      <p class="sub" style="margin-bottom:10px">
        If a student completed a diagnostic test on a shared device without logging in, enter their 6-digit Guest Token (e.g. <b>GUEST-8291</b>) to pull their reading score into your class:
      </p>
      <div class="guest-token-row" style="display:flex;gap:8px;max-width:440px">
        <input type="text" id="guest-token-input" class="auth-input" aria-label="Guest token" placeholder="GUEST-XXXX" style="text-transform:uppercase;font-family:monospace">
        <button class="btn" data-a="teacher-import-guest">Link Student</button>
      </div>
    </section>

    <!-- Connected Students Live Roster -->
    <section class="card teacher-section-card teacher-roster-card">
      <div class="teacher-section-head">
        <div>
          <h3>${uiIcon("users")} Connected Students Roster (${escapeHTML(teacher.section)})</h3>
          <p class="sub" style="margin:2px 0 0 0">Roster and journey access are stored in this browser. Use the selector to open a higher tier for a student.</p>
        </div>
        <div class="teacher-roster-actions">
          <button class="btn o" data-a="open-report-sheet" data-v="live">${uiIcon("print")} Reading Progress Report</button>
          <button class="btn o" data-a="download-csv" data-v="live">${uiIcon("download")} Export CSV</button>
        </div>
      </div>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to see every student detail and access control.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Connected students roster; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Phil-IRI Reading Level</th>
              <th>Reading Speed</th>
              <th>Comprehension</th>
              <th>Words Read</th>
              <th>Reading Journey Access</th>
              <th>Status / Intervention</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center;padding:24px;color:var(--sub)">
                  No students connected yet. Have students enter your Share Code <b>${escapeHTML(teacher.shareCode)}</b>!
                </td>
              </tr>
            ` : students.map((s, idx) => {
              const isAssessed = s.isAssessed;
              const lvlClass = isAssessed ? `level-${s.lvl}` : 'level-none';
              const lvlText = s.profileLabel;
              const wpmText = s.wpmText;
              const compText = s.compText;
              const isRemedial = isAssessed && (s.lvl === 0 || (typeof s.comp === 'number' && s.comp < 60));

              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${escapeHTML(s.name)}</b></td>
                  <td><span class="level-badge ${lvlClass}">${escapeHTML(lvlText)}</span></td>
                  <td>${escapeHTML(wpmText)}</td>
                  <td><b>${escapeHTML(compText)}</b></td>
                  <td>${(s.wordsRead || 0).toLocaleString()} words</td>
                  <td>
                    <label class="sub-sm" for="journey-override-${escapeHTML(s.id)}">Extra tier access</label>
                    <select id="journey-override-${escapeHTML(s.id)}" class="auth-input" data-a="teacher-journey-override" data-v="${escapeHTML(s.id)}" aria-label="Extra reading tier access for ${escapeHTML(s.name)}">
                      <option value="" ${s.journeyOverride == null ? "selected" : ""}>Automatic path</option>
                      ${DIFF_KEYS.slice(1).map((key, index) => `<option value="${index + 1}" ${s.journeyOverride === index + 1 ? "selected" : ""}>Open through ${escapeHTML(DIFF_NAMES[key])}</option>`).join("")}
                    </select>
                  </td>
                  <td>
                    ${!isAssessed
                      ? '<span class="pill" style="color:var(--sub)">Placement Required</span>'
                      : isRemedial 
                        ? '<span style="color:var(--coral);font-weight:700">⚠️ Needs Intervention</span>'
                        : '<span style="color:var(--teal)">✓ On Track</span>'}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section></div>
  `;
}



/* === src/pages/admin.js === */
/* ==========================================================================
   Admin Interface Views
   ========================================================================== */

let CURRENT_ADMIN_TAB = "users"; // 'users', 'classes', 'curriculum', 'benchmarks', 'system'

function viewAdmin() {
  const admin = AUTH.currentUser;
  if (!admin || admin.role !== "admin") {
    return `<div class="card"><p>Access restricted to Administrative accounts. Please sign in as Admin.</p></div>`;
  }

  if (typeof CURRENT_TAB !== "undefined") {
    if (CURRENT_TAB === "users") CURRENT_ADMIN_TAB = "users";
    else if (CURRENT_TAB === "classes") CURRENT_ADMIN_TAB = "classes";
  }

  const allUsers = AUTH.users;
  const students = allUsers.filter(u => u.role === "student");
  const teachers = allUsers.filter(u => u.role === "teacher");
  const admins = allUsers.filter(u => u.role === "admin");

  // Phil-IRI distribution school-wide
  const frustCount = students.filter(s => s.lvl === 0).length;
  const instCount = students.filter(s => s.lvl === 1).length;
  const indepCount = students.filter(s => s.lvl === 2).length;
  const mastCount = students.filter(s => s.lvl === 3).length;

  const totalPassages = 
    PRACTICE_DATA.easy.length + 
    PRACTICE_DATA.medium.length + 
    PRACTICE_DATA.hard.length + 
    PRACTICE_DATA.extreme.length + 
    AUTH.customPassages.length;
  const pendingPractices = AUTH.customPassages.filter(passage => passage?.status === "pending").length;

  return `<div class="admin-page">
    <div class="dashboard-intro admin-intro">
      <div>
        <div class="lab">Local administration</div>
        <h2>${uiIcon("admin")} School Admin Console</h2>
        <p class="sub">${escapeHTML(admin.school)} · Accounts and curriculum in this browser</p>
      </div>
      <div class="dashboard-intro-actions">
        <button class="btn o" data-a="tour-replay" title="Replay the admin onboarding walkthrough">🎓 Replay Tour</button>
        <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
        <button class="btn o" data-a="admin-export-backup">${uiIcon("backup")} Export Backup</button>
      </div>
    </div>

    <!-- School Metric Cards -->
    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-value">${allUsers.length}</div>
        <div class="metric-title">Total Users</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--sky)">${students.length}</div>
        <div class="metric-title">Enrolled Students</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--teal)">${teachers.length}</div>
        <div class="metric-title">Active Teachers</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--gold-ink)">${totalPassages}</div>
        <div class="metric-title">Curriculum Passages</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--coral)">${frustCount}</div>
        <div class="metric-title">Frustration Cases</div>
      </div>
    </div>

    <!-- Admin Navigation Tabs -->
    <div class="auth-tab-bar admin-section-tabs" role="group" aria-label="Admin console sections">
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'users' ? 'active' : ''}" data-a="admin-tab" data-v="users" aria-pressed="${CURRENT_ADMIN_TAB === 'users'}">
        ${uiIcon("users")} User Management (${allUsers.length})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'classes' ? 'active' : ''}" data-a="admin-tab" data-v="classes" aria-pressed="${CURRENT_ADMIN_TAB === 'classes'}">
        ${uiIcon("classes")} Classes & Sections (${teachers.length})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'curriculum' ? 'active' : ''}" data-a="admin-tab" data-v="curriculum" aria-pressed="${CURRENT_ADMIN_TAB === 'curriculum'}">
        ${uiIcon("practice")} Curriculum & Passages (${totalPassages}${pendingPractices ? ` · ${pendingPractices} awaiting review` : ""})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'benchmarks' ? 'active' : ''}" data-a="admin-tab" data-v="benchmarks" aria-pressed="${CURRENT_ADMIN_TAB === 'benchmarks'}">
        ${uiIcon("settings")} Phil-IRI Standards
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'system' ? 'active' : ''}" data-a="admin-tab" data-v="system" aria-pressed="${CURRENT_ADMIN_TAB === 'system'}">
        ${uiIcon("backup")} Local Data & Backup
      </button>
    </div>

    <!-- Admin Sub-tab Content -->
    ${CURRENT_ADMIN_TAB === 'users' ? renderAdminUsersTab(allUsers) : ''}
    ${CURRENT_ADMIN_TAB === 'classes' ? renderAdminClassesTab(teachers, allUsers) : ''}
    ${CURRENT_ADMIN_TAB === 'curriculum' ? renderAdminCurriculumTab() : ''}
    ${CURRENT_ADMIN_TAB === 'benchmarks' ? renderAdminBenchmarksTab() : ''}
    ${CURRENT_ADMIN_TAB === 'system' ? renderAdminSystemTab() : ''}
    </div>
  `;
}

function renderAdminUsersTab(users) {
  return `
    <div class="card admin-section-card">
      <div class="admin-card-head">
        <div class="lab">Registered Accounts Directory</div>
        <div style="font-size:12px;color:var(--sub)">Manage roles, permissions, and passwords</div>
      </div>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to review account details and actions.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Registered accounts; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Section / Code</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><b>${escapeHTML(u.name)}</b></td>
                <td><code>${escapeHTML(u.email)}</code></td>
                <td>
                  <span class="user-role-badge role-${escapeHTML(u.role)}">${escapeHTML(u.role)}</span>
                </td>
                <td>
                  ${u.role === 'teacher' ? `<b>${escapeHTML(u.shareCode || '')}</b> (${escapeHTML(u.section || 'General')})` : ''}
                  ${u.role === 'student' ? (u.teacherCode ? `Linked: <b>${escapeHTML(u.teacherCode)}</b>` : '<span style="color:var(--sub)">Unlinked</span>') : ''}
                  ${u.role === 'admin' ? 'System Administrator' : ''}
                </td>
                <td>
                  <span style="color:${u.status === 'active' ? 'var(--teal)' : 'var(--coral)'};font-weight:700">
                    ${u.status === 'active' ? '● Active' : '○ Suspended'}
                  </span>
                </td>
                <td>
                  <div class="admin-row-actions">
                    <button class="btn o" data-a="admin-edit-role" data-v="${escapeHTML(u.id)}">Role</button>
                    <button class="btn o" data-a="admin-toggle-status" data-v="${escapeHTML(u.id)}">
                      ${u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn o" data-a="admin-reset-pwd" data-v="${escapeHTML(u.id)}">Reset PW</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminClassesTab(teachers, allUsers) {
  const students = allUsers.filter(u => u.role === "student");
  const assignments = Array.isArray(AUTH.assignments) ? AUTH.assignments : [];

  return `
    <div class="card admin-section-card">
      <div class="admin-card-head">
        <div>
          <div class="lab">School Classes & Sections Roster</div>
          <div style="font-size:12px;color:var(--sub)">Active sections, assigned teachers, class codes, and enrolled student distribution</div>
        </div>
      </div>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to review section and enrollment details.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="School sections and teachers; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>Section Name</th>
              <th>Teacher Adviser</th>
              <th>Class Share Code</th>
              <th>Enrolled Learners</th>
              <th>Active Assignments</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${teachers.length === 0 ? `
              <tr><td colspan="6" style="text-align:center;padding:18px;color:var(--sub)">No teacher classrooms registered yet.</td></tr>
            ` : teachers.map(t => {
              const enrolled = students.filter(s => s.teacherCode === t.shareCode);
              const classAssignments = assignments.filter(a => a.teacherId === t.id || a.sectionCode === t.section);
              return `
                <tr>
                  <td><b>${escapeHTML(t.section || "General Section")}</b></td>
                  <td>${escapeHTML(t.name)} <br><small style="color:var(--sub)">${escapeHTML(t.email)}</small></td>
                  <td><code>${escapeHTML(t.shareCode || "N/A")}</code></td>
                  <td><b>${enrolled.length}</b> student${enrolled.length === 1 ? "" : "s"}</td>
                  <td>${classAssignments.length} assignment${classAssignments.length === 1 ? "" : "s"}</td>
                  <td>
                    <span style="color:${t.status === 'active' ? 'var(--teal)' : 'var(--coral)'};font-weight:700">
                      ${t.status === 'active' ? '● Active' : '○ Suspended'}
                    </span>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminCurriculumTab() {
  const customRows = (Array.isArray(AUTH.customPassages) ? AUTH.customPassages : []).map(raw => {
    try {
      const passage = normalizePassage(raw);
      return { ...passage, tier: `Custom (${passage.diff})`, isCustom: true };
    } catch (error) {
      return {
        id: String(raw?.id ?? "unknown"), t: `Invalid passage: ${error.message}`,
        x: "", qs: [], tier: "Needs repair", status: "invalid", isCustom: true
      };
    }
  });
  customRows.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const pendingCount = customRows.filter(p => p.status === "pending").length;
  const allPassages = [
    ...customRows,
    ...PRACTICE_DATA.easy.map(p => ({ ...p, tier: "Madali (Easy)" })),
    ...PRACTICE_DATA.medium.map(p => ({ ...p, tier: "Katamtaman (Medium)" })),
    ...PRACTICE_DATA.hard.map(p => ({ ...p, tier: "Mahirap (Hard)" })),
    ...PRACTICE_DATA.extreme.map(p => ({ ...p, tier: "Matindi (Extreme)" }))
  ];

  return `
    <div class="card admin-section-card">
      <div class="admin-card-head">
        <div>
          <div class="lab">Leveled Reading Curriculum</div>
          <p class="sub" style="margin:2px 0 0 0">Built-in and custom passage records; only published valid passages appear to readers.</p>
        </div>
        <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
      </div>

      <p class="sub">${pendingCount ? `${pendingCount} teacher practice${pendingCount === 1 ? "" : "s"} awaiting review. Approve to add to the student library, or reject with a reason.` : "No teacher practices are awaiting review."}</p>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to review passage status and approval actions.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading curriculum; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tier</th>
              <th>Passage Title</th>
              <th>Word Count</th>
              <th>Questions</th>
              <th>Status</th>
              <th>Origin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allPassages.map(p => {
              const isCustom = Boolean(p.isCustom);
              return `
                <tr>
                  <td><code>${escapeHTML(p.id)}</code></td>
                  <td><b>${escapeHTML(p.tier)}</b></td>
                  <td>${escapeHTML(p.t)}${p.reviewNote ? `<div class="sub-sm">Review note: ${escapeHTML(p.reviewNote)}</div>` : ""}</td>
                  <td>${wordCount(p.x)} words</td>
                  <td>${p.qs.length} questions</td>
                  <td>${escapeHTML(p.status || "published")}</td>
                  <td>${isCustom ? escapeHTML(AUTH.users.find(user => user.id === p.ownerId)?.name || p.author || "Legacy custom") : 'Standard Core'}</td>
                  <td>
                    <div class="admin-row-actions">
                      ${isCustom ? `
                        ${p.status === "published" ? `<button class="btn o sm" data-a="read-passage" data-v="${escapeHTML(p.id)}">Preview</button>` : ""}
                        ${p.status !== "invalid" ? `<button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(p.id)}">Edit</button>` : ""}
                        ${p.status === "pending" ? `
                          <button class="btn blue sm" data-a="practice-approve" data-v="${escapeHTML(p.id)}">Approve</button>
                          <button class="btn o sm" data-a="practice-reject" data-v="${escapeHTML(p.id)}">Reject</button>
                        ` : ""}
                        ${p.status === "published" ? `<button class="btn o sm" data-a="practice-unpublish" data-v="${escapeHTML(p.id)}">Unpublish</button>` : ""}
                        ${p.status === "draft" && AUTH.users.find(user => user.id === p.ownerId)?.role !== "teacher" ? `<button class="btn o sm" data-a="practice-publish" data-v="${escapeHTML(p.id)}">Publish</button>` : ""}
                        ${AUTH.assignments.some(assignment => assignment.passageId === p.id) ? `<button class="btn o sm" data-a="practice-remove-assignments" data-v="${escapeHTML(p.id)}">Remove class assignments</button>` : ""}
                        <button class="btn o sm danger" data-a="practice-delete" data-v="${escapeHTML(p.id)}">Delete</button>
                      ` : `
                        <button class="btn o sm" data-a="read-passage" data-v="${p.id}">Preview</button>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminBenchmarksTab() {
  return `
    <div class="card admin-section-card">
      <div class="lab">DepEd Phil-IRI Calibrated Benchmarks</div>
      <p class="sub">These standards dictate the automatic placement logic across junior and senior high reading assessments.</p>
      
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading benchmark table; scroll horizontally for more columns">
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Classification</th>
            <th>Comprehension Range</th>
            <th>Junior High WPM Target</th>
            <th>Senior High WPM Target</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="level-badge level-0">Frustration</span></td>
            <td>&lt; 59%</td>
            <td>&lt; 90 WPM</td>
            <td>&lt; 110 WPM</td>
            <td>Mandatory Remedial Reading & Vocabulary Taps</td>
          </tr>
          <tr>
            <td><span class="level-badge level-1">Instructional</span></td>
            <td>59% – 79%</td>
            <td>90 – 129 WPM</td>
            <td>110 – 149 WPM</td>
            <td>Guided Reading & Inferential Skill Focus</td>
          </tr>
          <tr>
            <td><span class="level-badge level-2">Independent</span></td>
            <td>80% – 89%</td>
            <td>130 – 159 WPM</td>
            <td>150 – 179 WPM</td>
            <td>Self-directed Reading & Critical Analysis</td>
          </tr>
          <tr>
            <td><span class="level-badge level-3">Mastery</span></td>
            <td>90% – 100%</td>
            <td>160+ WPM</td>
            <td>180+ WPM</td>
            <td>Peer Tutoring & Advanced Synthesis</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function renderAdminSystemTab() {
  return `
    <div class="card admin-section-card">
      <div class="lab">Local Data & Emergency Backup</div>
      <p class="sub" style="margin-bottom:14px">
        Export this browser's accounts, share codes, assignments, and curriculum. Works completely offline.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" data-a="admin-export-backup">${uiIcon("backup")} Export Complete JSON Backup</button>
        <button class="btn o" data-a="admin-restore-backup-trigger">${uiIcon("upload")} Restore from JSON File</button>
        <button class="btn o danger" data-a="admin-reset-presets">${uiIcon("reset")} Reset to DepEd Factory Presets</button>
      </div>
      <input type="file" id="admin-restore-file" style="display:none" accept=".json,application/json">
    </div>
  `;
}




/* === src/pages/home.js === */
function viewHome() {
  const u = AUTH.currentUser;
  const role = u ? u.role : "guest";
  const currentLvlStr = S.lvl !== null ? PHIL_IRI_LEVELS[S.lvl] : "Not Assessed";
  const journey = role === "student" || role === "guest" ? journeySummary() : null;
  const publishedPassages = getPublishedPassages();
  const tierCounts = DIFF_KEYS.map(key => publishedPassages.filter(passage => passage.diff === key).length);
  const isUnassessedStudent = role === "student" && S.lvl === null;
  const tierPill = index => isUnassessedStudent
    ? `<span class="pill">${uiIcon("lock")} Placement Required</span>`
    : journey && index > journey.tier
      ? `<span class="pill">${uiIcon("lock")} Locked</span>`
      : `<span class="pill ok">${tierCounts[index]} Passages</span>`;
  const assignmentLocked = id => {
    if (isUnassessedStudent) return true;
    const passage = publishedPassages.find(item => item.id === id);
    return passage && journey && DIFF_KEYS.indexOf(passage.diff) > journey.tier;
  };

  // Build role-specific banner
  let roleBanner = "";
  if (role === "student") {
    if (u.teacherCode) {
      // Find teacher
      const teach = AUTH.users.find(x => x.role === "teacher" && x.shareCode === u.teacherCode);
      const teachName = teach ? teach.name : "Your Teacher";
      // Check assignments
      const myAsgs = AUTH.assignments.filter(a => 
        a.teacherCode === u.teacherCode && publishedPassages.some(passage => passage.id === a.passageId)
        && (a.targetGroup === "all" || a.targetGroup === `level-${u.lvl}`)
      );

      roleBanner = `
        <div class="card home-role-card home-role-student">
          <div class="home-role-content">
            <div>
              <div class="lab" style="color:var(--sky-ink)">${uiIcon("classroom")} Connected Classroom</div>
              <h3 style="margin:2px 0 0 0">${escapeHTML(teachName)} · ${escapeHTML(u.section || "Grade 8")}</h3>
              <p class="sub" style="margin:4px 0 0 0">Classroom Share Code: <b>${escapeHTML(u.teacherCode)}</b> · Live roster synced</p>
            </div>
            <span class="level-badge level-${S.lvl !== null ? S.lvl : 1}">
              ${currentLvlStr}
            </span>
          </div>

          ${myAsgs.length > 0 ? `
            <div class="home-assignment-list">
              <div class="lab" style="margin-bottom:6px">${uiIcon("practice")} Assigned by Teacher for your reading level:</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${myAsgs.map(a => `
                  <div class="assigned-story-row">
                    <div>
                      <b>${escapeHTML(a.title)}</b>
                      <span class="sub-sm" style="margin-left:6px">Due: ${escapeHTML(a.dueDate)}</span>
                    </div>
                    <button class="btn sm" ${isUnassessedStudent ? 'data-a="tab" data-v="assess"' : `data-a="read-passage" data-v="${escapeHTML(a.passageId)}"`}
                      ${!isUnassessedStudent && assignmentLocked(a.passageId) ? 'disabled title="Complete earlier tiers or ask your teacher to unlock this tier"' : ""}>
                      ${isUnassessedStudent ? "Take Placement First" : assignmentLocked(a.passageId) ? "Tier locked" : "Read Now"}
                    </button>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : `
            <div class="home-empty-assignment sub-sm">
              ${uiIcon("check")} You are up to date on all teacher reading assignments!
            </div>
          `}
        </div>
      `;
    } else {
      roleBanner = `
        <div class="connect-teacher-card">
          <h3>${uiIcon("classroom")} Connect with Your Teacher</h3>
          <p class="sub">Enter the Share Code provided by your teacher to join your section, sync diagnostic scores, and receive assigned stories:</p>
          <div class="connect-row">
            <input type="text" id="home-teacher-code" aria-label="Teacher share code" placeholder="e.g. BASA-TEACH-8492">
            <button class="btn" data-a="student-connect-teacher">Join Class</button>
          </div>
        </div>
      `;
    }
  } else if (role === "teacher") {
    const studCount = AUTH.getTeacherStudents().length;
    roleBanner = `
      <div class="card home-role-card home-role-teacher">
        <div class="home-role-content">
          <div>
            <div class="lab" style="color:var(--teal-ink)">${uiIcon("teacher")} Teacher Workspace · ${escapeHTML(u.section)}</div>
            <h3 style="margin:2px 0 0 0">Classroom Share Code: <b>${escapeHTML(u.shareCode)}</b></h3>
            <p class="sub" style="margin:4px 0 0 0">${studCount} students currently connected to your roster</p>
          </div>
          <div class="teacher-home-actions">
            <button class="btn sm" data-a="tab" data-v="teacher">${uiIcon("teacher")} Open Classroom Hub</button>
            <button class="btn o sm" data-a="teacher-show-projector">${uiIcon("projector")} Blackboard Code</button>
          </div>
        </div>
      </div>
    `;
  } else if (role === "admin") {
    roleBanner = `
      <div class="card home-role-card home-role-admin">
        <div class="home-role-content">
          <div>
            <div class="lab" style="color:var(--coral-ink)">${uiIcon("admin")} School Administration Console</div>
            <h3 style="margin:2px 0 0 0">${u.school}</h3>
            <p class="sub" style="margin:4px 0 0 0">${AUTH.users.length} total users enrolled · Full curriculum & account management</p>
          </div>
          <button class="btn sm" data-a="tab" data-v="admin">${uiIcon("admin")} Open Admin Panel</button>
        </div>
      </div>
    `;
  } else {
    // Guest
    roleBanner = `
      <div class="card home-role-card home-role-guest">
        <div class="home-role-content">
          <div>
            <div class="lab" style="color:var(--gold-ink)">${uiIcon("user")} Guest Mode</div>
            <h3 style="margin:2px 0 0 0">Identify Your Reading Level Instantly</h3>
            <p class="sub" style="margin:4px 0 0 0">No account required for guest practice. Your progress stays in this browser and can transfer when you create a student account here.</p>
          </div>
          <div class="guest-entry-actions">
            <button class="btn blue sm" data-a="start-placement" data-v="guest">${uiIcon("assess")} Start Guest Diagnostic</button>
            <button class="btn o sm" data-a="auth-open">${uiIcon("profile")} Sign in</button>
            <button class="btn o sm" data-a="auth-open" data-v="register">Create account</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="hero home-hero">
      <div class="home-hero-copy">
      <div class="lab" style="color:#f5ab1d">Welcome to BasaWisyo</div>
      <h2>Every Filipino Learner a Confident Reader.</h2>
      <p class="sub">
        Culturally rooted reading practice built for Grades 7 to 12. Try a placement activity, explore leveled Philippine stories, follow your reading journey, and celebrate progress with badges.
      </p>
      <div class="home-hero-actions">
        <button class="btn blue sm" data-a="tab" data-v="assess">
          ${uiIcon("assess")} ${S.lvl === null ? "Start Placement Test" : "Check Reading Level"}
        </button>
        <button class="btn o sm" data-a="tab" data-v="practice">
          ${uiIcon("practice")} Browse 24+ Passages
        </button>
      </div>
      </div>
      <div class="home-hero-art" aria-hidden="true">
        <div class="home-hero-book"><span></span><span></span><span></span></div>
        <img src="assets/images/wisyo.png" alt="">
      </div>
    </div>

    ${roleBanner}
    <div class="home-dashboard-grid">
      ${journey ? `<div class="home-dashboard-main">
        ${typeof renderDailyQuestCard === "function" ? renderDailyQuestCard() : ""}
        ${viewJourneyPanel(journey)}
        <div class="home-profile-link">
          <button class="btn o sm" data-a="tab" data-v="profile">${uiIcon("badge")} View badges in ${role === "guest" ? "My Progress" : "Student Profile"}</button>
        </div>
      </div>` : ""}
      <div class="home-dashboard-side">
        <!-- Quick Stat Bar -->
        <div class="stat-grid">
          <div class="stat-box">
            <div class="lab">Your Phil-IRI Level</div>
            <div class="num">${currentLvlStr}</div>
            <div class="sub-sm">${S.ss} sessions completed</div>
          </div>
          <div class="stat-box">
            <div class="lab">Words Read</div>
            <div class="num">${S.w.toLocaleString()}</div>
            <div class="sub-sm">Contributed to class quest</div>
          </div>
        </div>

        <!-- 4 Difficulty Tiers Showcase -->
        <div class="card home-tiers-card">
          <div class="lab">Leveled Reading Tiers</div>
          <h3>Choose Your Difficulty</h3>
          <p class="sub">Carefully calibrated texts spanning foundational to college-prep analytical prose:</p>
          
          <div class="home-tier-list">
            <button type="button" class="tier-row tier-easy" data-a="filter-diff" data-v="easy">
              <span class="tier-copy">
                <b style="color:var(--teal-ink)"><span class="badge-diff diff-easy" style="margin-right:6px">EASY</span> Easy (Madali)</b>
                <span class="sub-sm">Grade 7 Foundational · Everyday community life & nature</span>
              </span>
              ${tierPill(0)}
            </button>

            <button type="button" class="tier-row tier-medium" data-a="filter-diff" data-v="medium">
              <span class="tier-copy">
                <b style="color:var(--gold-ink)"><span class="badge-diff diff-medium" style="margin-right:6px">MEDIUM</span> Medium (Katamtaman)</b>
                <span class="sub-sm">Grade 8–9 Instructional · Ecology, local history & science</span>
              </span>
              ${tierPill(1)}
            </button>

            <button type="button" class="tier-row tier-hard" data-a="filter-diff" data-v="hard">
              <span class="tier-copy">
                <b style="color:var(--coral-ink)"><span class="badge-diff diff-hard" style="margin-right:6px">HARD</span> Hard (Mahirap)</b>
                <span class="sub-sm">Grade 10–11 Advanced · Rhetoric, propaganda & engineering</span>
              </span>
              ${tierPill(2)}
            </button>

            <button type="button" class="tier-row tier-extreme" data-a="filter-diff" data-v="extreme">
              <span class="tier-copy">
                <b style="color:var(--purple-ink)"><span class="badge-diff diff-extreme" style="margin-right:6px">EXTREME</span> Extreme (Sukdulan)</b>
                <span class="sub-sm">Grade 12 Mastery · Jurisprudence, ethology & critical theory</span>
              </span>
              ${tierPill(3)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}



/* === src/pages/assess.js === */
function viewAssess() {
  const u = AUTH.currentUser;
  const isGuest = !u;

  const subnavHtml = `
    <div class="subnav-segmented" role="tablist" aria-label="Practice section switcher">
      <button class="subnav-tab" data-a="tab" data-v="flashcards">
        ${uiIcon("flashcards")} <span>Vocabulary Flashcards</span>
      </button>
      <button class="subnav-tab active" data-a="tab" data-v="assess">
        ${uiIcon("assess")} <span>Diagnostic Placement</span>
      </button>
    </div>
  `;

  if (S.lvl === null) {
    return `
      <div class="assessment-page">
      ${subnavHtml}
      <div class="assessment-intro">
        <div class="lab">Reading Placement Assessment</div>
        <h2>Find your comfortable reading starting path</h2>
        <p class="sub">Complete three short Philippine reading passages with five comprehension questions each (15 questions total). Your results determine a <b>provisional BasaWisyo starting level</b> to guide your practice journey. Works 100% offline.</p>
      </div>
      <section class="card assessment-start-card" aria-label="What to expect from placement">
        <div class="assessment-start-head">
          <div>
            <div class="lab">${isGuest ? "Guest Diagnostic Mode (No Account Required)" : "Student Diagnostic Screener"}</div>
            <h3>Three Progressive Reading Steps</h3>
          </div>
          <span class="pill">15 Questions · About 6–8 minutes</span>
        </div>
        <ol class="assessment-steps">
          <li><b>Step 1: Basic (Easy)</b><span>"A Fisher's Morning in Bohol" · 5 questions (Literal, Vocab, Inference, Sequence, Main idea)</span></li>
          <li><b>Step 2: Intermediate (Medium)</b><span>"The Coral Patrol of Davao Gulf" · 5 questions testing analytical comprehension</span></li>
          <li><b>Step 3: Advanced (Hard)</b><span>"Voices of La Solidaridad" · 5 questions exploring historical and civic reasoning</span></li>
          <li><b>Provisional Level</b><span>Receive your provisional starting level and custom-recommended reading passages</span></li>
        </ol>
        <div class="card" style="background:var(--bg);border-left:4px solid var(--sky);padding:10px 14px;margin:14px 0">
          <b style="color:var(--navy);font-size:0.85rem">Provisional Starting Level Safeguard:</b>
          <p class="sub-sm" style="margin:2px 0 0 0">
            This activity suggests an initial practice tier in BasaWisyo. It is not an official DepEd Phil-IRI classification, does not infer reading speed (WPM), and does not use XP or rankings.
          </p>
        </div>
        <button class="btn blue assessment-start-button" data-a="start-placement">
          ${uiIcon("assess")} ${isGuest ? "Start 15-Question Diagnostic as Guest" : "Start Placement Assessment"}
        </button>
      </section></div>
    `;
  }

  const desc = [
    "Grade-level texts currently pose challenges. We recommend starting with Easy passages to master core vocabulary, build confidence, and strengthen basic comprehension.",
    "You understand texts with slight guidance and answer literal questions well. Daily practice with Medium passages will guide your transition to independence.",
    "You read with strong independence and critical comprehension across multiple subjects! Explore Hard passages and challenge yourself with advanced analysis.",
    "Exceptional comprehension! You grasp dense, technical, and historical texts. Tackle Extreme level passages and guide classmates."
  ];

  const levelNames = ["Foundation Support", "Developing", "Proficient", "Mastery"];
  const rep = S.placementReport || null;

  // Guest-specific post-test linking card
  let guestActions = "";
  if (isGuest) {
    const token = S.guestToken || "GUEST-READY";
    guestActions = `
      <div class="card assessment-guest-card">
        <div class="lab" style="color:var(--gold-ink)">${uiIcon("sparkles")} Save or Share Your Suggested Level</div>
        <h3 style="margin:4px 0">Your Temporary Guest Token: <code>${token}</code></h3>
        <p class="sub" style="margin:4px 0 14px 0">
          Your provisional reading level is saved in this browser! Create a free student account or send your token to your teacher:
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn blue" data-a="guest-save-profile">
            ${uiIcon("profile")} Save Profile (Create Permanent Student Account)
          </button>
          
          <div style="border-top:1px dashed var(--border);padding-top:10px">
            <label for="guest-teacher-code" style="font-size:12px;font-weight:700">Link directly to a Teacher:</label>
            <div class="guest-link-row" style="display:flex;gap:8px;margin-top:4px">
              <input type="text" id="guest-teacher-code" class="auth-input" placeholder="Enter Teacher Share Code (e.g. BASA-TEACH-8492)" style="text-transform:uppercase;font-family:monospace">
              <button class="btn" data-a="guest-connect-teacher">Send to Teacher</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Advanced Candidate Verification Card
  let candidateCard = "";
  if (S.placementCandidate && S.lvl === 2) {
    candidateCard = `
      <div class="card" style="background:linear-gradient(135deg, rgba(37,137,230,0.1), rgba(46,196,182,0.12));border:1.5px solid var(--sky);margin-bottom:16px">
        <div class="lab" style="color:var(--sky-ink)">🌟 Advanced Placement Candidate</div>
        <h3 style="margin:4px 0">You demonstrated strong comprehension across all passages!</h3>
        <p class="sub-sm" style="margin:4px 0 12px 0">
          To maintain rigorous standards, automatic Mastery is not granted from initial screening. Take an optional <b>5-question advanced verification passage</b> ("Intergenerational Ecological Justice") to confirm verified Mastery status.
        </p>
        <button class="btn blue sm" data-a="start-placement-verify">
          ${uiIcon("sparkles")} Take Advanced Verification Passage (5 Qs)
        </button>
      </div>
    `;
  }

  // Skills Breakdown Markup
  let skillsMarkup = "";
  if (rep && rep.skills) {
    skillsMarkup = `
      <div class="card" style="margin-bottom:16px">
        <div class="lab">Assessment Evidence by Skill &amp; Passage</div>
        <h3 style="margin:4px 0 10px 0">Comprehension Profile</h3>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:14px">
          <div class="card" style="margin:0;padding:8px 12px;background:var(--bg);text-align:center">
            <div class="lab">Basic Passage</div>
            <b style="font-size:1.1rem;color:var(--teal)">${rep.p1Score !== undefined ? `${rep.p1Score}/5` : "Complete"}</b>
          </div>
          <div class="card" style="margin:0;padding:8px 12px;background:var(--bg);text-align:center">
            <div class="lab">Intermediate</div>
            <b style="font-size:1.1rem;color:var(--gold-ink)">${rep.p2Score !== undefined ? `${rep.p2Score}/5` : "Complete"}</b>
          </div>
          <div class="card" style="margin:0;padding:8px 12px;background:var(--bg);text-align:center">
            <div class="lab">Advanced</div>
            <b style="font-size:1.1rem;color:var(--sky)">${rep.p3Score !== undefined ? `${rep.p3Score}/5` : "Complete"}</b>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          ${Object.entries(rep.skills).map(([skill, stat]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.875rem">
              <span><b>${escapeHTML(skill)}:</b></span>
              <span class="pill ${stat.correct === stat.total ? 'ok' : stat.correct >= 1 ? 'blue' : 'warn'}">
                ${stat.correct} / ${stat.total} correct
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="assessment-page assessment-complete">
    ${subnavHtml}
    <div class="assessment-intro">
      <div class="lab">Provisional Diagnostic Placement</div>
      <h2>Your Reading Profile</h2>
      <p class="sub">This result suggests your optimal starting level for guided reading. It is a formative classroom guide, not an official Phil-IRI classification.</p>
    </div>

    <div class="card assessment-result-card" style="margin-bottom:16px">
      <div class="lab">Provisional Starting Level</div>
      <div class="big assessment-level-value">
        ${levelNames[S.lvl] || PHIL_IRI_LEVELS[S.lvl]} Reader
      </div>
      <p class="sub">${desc[S.lvl]}</p>

      <div class="assessment-result-actions">
        <button class="btn" data-a="tab" data-v="practice">Go to Recommended Practice</button>
        <button class="btn o" data-a="start-placement">Retake Placement Assessment</button>
      </div>
    </div>

    ${candidateCard}
    ${skillsMarkup}
    ${guestActions}

    <!-- Evidence-Based Provisional Placement Scale -->
    <div class="card assessment-scale-card">
      <div class="lab">BasaWisyo Placement Evidence Rubric</div>
      <p class="sub-sm">Starting levels are determined by multi-passage comprehension evidence across literal comprehension, vocabulary, inference, sequencing, and main idea.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading level scale; scroll horizontally for more columns">
      <table style="margin-top:8px;width:100%">
        <thead>
          <tr>
            <th>Evidence</th>
            <th>Provisional Level</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr style="${S.lvl === 0 ? 'background:var(--coral-soft);font-weight:bold' : ''}">
            <td>Difficulty with basic passage (&lt; 3 / 5)</td>
            <td><span class="level-badge level-0">Foundation Support</span></td>
            <td>Guided remedial vocabulary &amp; Easy tier stories</td>
          </tr>
          <tr style="${S.lvl === 1 ? 'background:var(--gold-soft);font-weight:bold' : ''}">
            <td>Strong basic (≥ 3 / 5), weak intermediate (&lt; 3 / 5)</td>
            <td><span class="level-badge level-1">Developing</span></td>
            <td>Medium passages &amp; guided inference practice</td>
          </tr>
          <tr style="${S.lvl === 2 ? 'background:var(--sky-soft);font-weight:bold' : ''}">
            <td>Strong basic and intermediate (≥ 3 / 5 on both)</td>
            <td><span class="level-badge level-2">Proficient</span></td>
            <td>Hard passages &amp; critical analysis</td>
          </tr>
          <tr style="${S.lvl === 3 ? 'background:var(--teal-soft);font-weight:bold' : ''}">
            <td>Strong performance across all passages + verification</td>
            <td><span class="level-badge level-3">Mastery (Verified)</span></td>
            <td>Extreme passages &amp; peer mentoring</td>
          </tr>
        </tbody>
      </table>
      </div>
      <p class="sub-sm" style="margin-top:10px;color:var(--sub)">
        <b>Assessment Safeguards:</b> Keep official DepEd Phil-IRI classifications separate from these app-defined levels. Do not infer words per minute (WPM) from comprehension answers. Do not use XP or classroom rank to determine reading proficiency.
      </p>
    </div></div>
  `;
}



/* === src/pages/practice.js === */
function viewJourneyPanel(summary = journeySummary()) {
  if (!summary) return "";
  const tierName = DIFF_NAMES[DIFF_KEYS[summary.tier]];
  const progress = summary.progress;
  return `<section class="card journey-panel" aria-label="Your guided reading journey">
    <div class="lab">Your Reading Journey</div>
    <h3>Current path: ${escapeHTML(tierName)}</h3>
    <p class="sub">Read at your pace. Complete two different passages in this tier with at least half the answers correct in each and 75% combined to open the next tier. You may retry. Passages need at least two questions to count toward unlocking.</p>
    <div class="journey-steps" aria-label="Difficulty tier progress">
      ${DIFF_KEYS.map((key, index) => `<span class="journey-step ${index === summary.tier ? "current" : index < summary.tier ? "open" : "locked"}">
        ${index > summary.tier ? "🔒 " : ""}${escapeHTML(DIFF_NAMES[key])}
      </span>`).join("")}
    </div>
    <p class="sub-sm">${summary.tier < DIFF_KEYS.length - 1
      ? `${progress.count} of ${JOURNEY_PASSAGES_TO_ADVANCE} qualifying passages · ${Math.round(progress.accuracy * 100)}% combined on your best qualifying attempts`
      : "All four difficulty tiers are open. Keep practicing and exploring."}</p>
    ${summary.next ? `<div class="journey-next">
      <div><b>Next recommended: ${escapeHTML(summary.next.t)}</b><div class="sub-sm">${escapeHTML(tierName)} · ${summary.next.qs.length} questions</div></div>
      <button class="btn blue sm" data-a="read-passage" data-v="${escapeHTML(summary.next.id)}">Continue reading</button>
    </div>` : ""}
  </section>`;
}

function viewAchievementsPanel(journey = journeyForCurrent()) {
  if (!journey) return "";
  const reqs = typeof journeyBadgeRequirements === "function"
    ? journeyBadgeRequirements(journey)
    : journeyAchievements(journey);
  const frames = journeyAvailableFrames(journey);
  const selected = journeySelectedFrame();
  return `<section class="card rewards-panel" aria-label="Reading badges and profile frames">
    <div class="lab">${uiIcon("badge")} Reading Rewards</div>
    <h3>Your badges</h3>
    <p class="sub-sm">Earn badges as you practice. They celebrate progress and do not change your score or reading tier.</p>
    <div class="rewards-grid">
      ${reqs.map(badge => `<div class="reward-badge ${badge.earned ? "earned" : "locked"}">
        <span class="reward-icon" aria-hidden="true">${badge.earned ? badge.icon : uiIcon("lock")}</span>
        <div style="flex:1;min-width:0">
          <b>${escapeHTML(badge.title)}</b>
          <span class="sub-sm">${escapeHTML(badge.description)}</span>
          ${badge.earned
            ? `<div class="sub-sm" style="color:var(--teal);margin-top:4px"><b>Why you earned this:</b> ${escapeHTML(badge.whyReason || badge.description)}</div>`
            : `<div class="sub-sm" style="color:var(--sub);margin-top:4px"><b>What's needed:</b> ${escapeHTML(badge.missingText || badge.description)}</div>`
          }
        </div>
        <span class="reward-status">${badge.earned ? "Earned" : "To earn"}</span>
      </div>`).join("")}
    </div>
    <h3>Profile frame</h3>
    <p class="sub-sm">Choose a frame for your name in this browser.</p>
    <div class="frame-choices" role="group" aria-label="Choose a profile frame">
      ${frames.map(frame => `<button type="button" class="frame-choice ${selected === frame.id ? "selected" : ""}"
        data-a="reward-frame" data-v="${frame.id}" aria-pressed="${selected === frame.id}"
        ${frame.unlocked ? "" : "disabled"}>
        <span class="frame-preview frame-${frame.id}" aria-hidden="true">A</span>
        <span>${escapeHTML(frame.title)}${frame.unlocked ? "" : " · Locked"}</span>
      </button>`).join("")}
    </div>
    <button class="btn o sm" data-a="tab" data-v="board" style="margin-top:14px">View Activity Rank &amp; Class Board</button>
  </section>`;
}

function practiceManagementScores(passage, students) {
  return students.flatMap(student => {
    const result = student.journey?.results?.[passage.id];
    if (!result || !Number.isInteger(result.correct) || !Number.isInteger(result.total)
        || !Number.isInteger(result.attempts) || result.total < 1
        || result.correct < 0 || result.correct > result.total || result.attempts < 1) return [];
    return [{ student, result }];
  });
}

function viewPracticeManagement() {
  const actor = AUTH.currentUser;
  if (!actor || !["teacher", "admin"].includes(actor.role)) return "";
  const isAdmin = actor.role === "admin";
  const students = isAdmin
    ? AUTH.users.filter(user => user.role === "student")
    : AUTH.getTeacherStudents(actor.shareCode);
  const custom = (Array.isArray(AUTH.customPassages) ? AUTH.customPassages : [])
    .flatMap(raw => {
      try { return [normalizePassage(raw)]; } catch (error) { return []; }
    })
    .filter(passage => isAdmin || passage.ownerId === actor.id);
  const passages = [...getPublishedPassages()];
  const seen = new Set(passages.map(passage => passage.id));
  for (const passage of custom) {
    if (!seen.has(passage.id)) {
      passages.push(passage);
      seen.add(passage.id);
    }
  }
  const filtered = passages.filter(passage =>
    (!S.activeDiff || S.activeDiff === "all" || passage.diff === S.activeDiff)
    && (!SEARCH_QUERY.trim() || `${passage.t} ${passage.x} ${passage.diff}`
      .toLowerCase().includes(SEARCH_QUERY.trim().toLowerCase())));

  return `<div class="practice-management-page">
    ${actor.role === "teacher" ? `
      <div class="subnav-segmented" role="tablist" aria-label="Materials section switcher">
        <button class="subnav-tab" data-a="tab" data-v="teacher-studio">
          ${uiIcon("studio")} <span>Teacher Reading Studio</span>
        </button>
        <button class="subnav-tab active" data-a="tab" data-v="practice">
          ${uiIcon("practice")} <span>Passage Library</span>
        </button>
      </div>
    ` : ""}
    <div class="row library-heading">
      <div><div class="lab">${isAdmin ? "Admin curriculum" : "Teacher classroom"}</div>
        <h2>Passage Library</h2></div>
      <span class="pill">${filtered.length} ${filtered.length === 1 ? "passage" : "passages"}</span>
    </div>
    <p class="sub library-intro">View reading content and local student results. ${isAdmin
      ? "Manage custom practices and review teacher submissions."
      : "Manage your own practices and assignments without taking a learner quiz."}</p>
    <div class="practice-management-actions">
      <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
      <button class="btn o" data-a="tab" data-v="${isAdmin ? "admin" : "teacher"}">${uiIcon(isAdmin ? "admin" : "teacher")} ${isAdmin ? "Admin Console" : "Classroom Hub"}</button>
    </div>
    <div class="diff-selector" role="group" aria-label="Filter managed passages by difficulty">
      ${["all", ...DIFF_KEYS].map(key => `<button data-a="filter-diff" data-v="${key}"
        class="${S.activeDiff === key ? "on" : ""}" aria-pressed="${S.activeDiff === key}">${key === "all" ? "All" : key[0].toUpperCase() + key.slice(1)}</button>`).join("")}
    </div>
    <label class="library-search-label" for="lib-search">Search passages</label>
    <div class="search-row">
      <svg class="ui-icon" aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" id="lib-search" placeholder="Search title, text, or difficulty" value="${escapeHTML(SEARCH_QUERY)}">
    </div>
    <p class="sub-sm practice-management-note">Results include only ${isAdmin ? "student accounts" : "linked students in your class"} saved in this browser. Scores show each student's best completed attempt; older scores keep their original question count. Assignment submissions are not tracked separately.</p>
    <div class="practice-management-list">
      ${filtered.length ? filtered.map(passage => {
        const ownedCustom = custom.find(item => item.id === passage.id);
        const editable = Boolean(ownedCustom && (isAdmin || ["draft", "rejected"].includes(passage.status)));
        const scores = practiceManagementScores(passage, students);
        const assignedCount = AUTH.assignments.filter(assignment => assignment.passageId === passage.id
          && (isAdmin || assignment.teacherCode === actor.shareCode)).length;
        return `<article class="card practice-management-card">
          <div class="practice-management-card-head">
            <div><div class="practice-management-meta"><span class="badge-diff diff-${passage.diff}">${escapeHTML(passage.diff.toUpperCase())}</span>
              <span class="pill">${escapeHTML(passage.status)}</span>
              <span class="sub-sm">${passage.qs.length} ${passage.qs.length === 1 ? "question" : "questions"} · ${wordCount(passage.x)} words</span></div>
              <h3>${escapeHTML(passage.t)}</h3>
              <p class="sub-sm">${ownedCustom ? `Custom practice · ${escapeHTML(passage.author || "Teacher")}` : "Built-in or shared passage · read only"}</p>
            </div>
            <div class="practice-management-totals" aria-label="Passage result counts">
              <div><b>${scores.length}</b><span>answered</span></div>
              <div><b>${students.length}</b><span>${isAdmin ? "local students" : "class students"}</span></div>
              <div><b>${assignedCount}</b><span>${assignedCount === 1 ? "assignment" : "assignments"}</span></div>
            </div>
          </div>
          <div class="practice-management-controls">
            <details class="practice-management-details">
              <summary>View passage &amp; results</summary>
              <div class="practice-management-detail-body">
                <div class="lab">Passage text</div>
                <p class="practice-management-passage">${escapeHTML(passage.x)}</p>
                <div class="lab">Questions &amp; answer keys</div>
                <ol class="practice-management-questions">${passage.qs.map(question => `<li><b>${escapeHTML(question.q)}</b>
                  <span class="sub-sm">${escapeHTML(question.k)} · Correct: ${escapeHTML(question.o[question.a])}</span></li>`).join("")}</ol>
                <div class="lab">Student results</div>
                ${scores.length ? `<div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Scores for ${escapeHTML(passage.t)}">
                  <table class="data-table"><thead><tr><th>Student</th><th>Best score</th><th>Attempts</th></tr></thead><tbody>
                  ${scores.map(({ student, result }) => `<tr><td>${escapeHTML(student.name)}</td><td>${result.correct}/${result.total}${result.total !== passage.qs.length ? ' <span class="sub-sm">Earlier question count</span>' : ""}</td><td>${result.attempts}</td></tr>`).join("")}
                  </tbody></table></div>` : `<p class="sub">No completed results for this passage in ${isAdmin ? "local student accounts" : "your linked class"} yet.</p>`}
              </div>
            </details>
            ${editable ? `<button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(passage.id)}">Edit / add questions</button>` : ""}
            ${ownedCustom?.status === "pending" && !isAdmin ? `<button class="btn o sm" data-a="practice-withdraw" data-v="${escapeHTML(passage.id)}">Withdraw to edit</button>` : ""}
            ${ownedCustom?.status === "pending" && isAdmin ? `<button class="btn blue sm" data-a="practice-approve" data-v="${escapeHTML(passage.id)}">Approve</button>
              <button class="btn o sm" data-a="practice-reject" data-v="${escapeHTML(passage.id)}">Reject</button>` : ""}
            ${ownedCustom?.status === "published" && isAdmin ? `<button class="btn o sm" data-a="practice-unpublish" data-v="${escapeHTML(passage.id)}">Unpublish</button>` : ""}
            ${ownedCustom && isAdmin && assignedCount ? `<button class="btn o sm" data-a="practice-remove-assignments" data-v="${escapeHTML(passage.id)}">Remove assignments</button>` : ""}
            ${editable ? `<button class="btn o sm" data-a="practice-delete" data-v="${escapeHTML(passage.id)}">Delete</button>` : ""}
          </div>
          ${passage.reviewNote ? `<p class="sub-sm">Admin note: ${escapeHTML(passage.reviewNote)}</p>` : ""}
        </article>`;
      }).join("") : `<div class="card"><p class="sub">No passages match these filters. Try another title or difficulty.</p></div>`}
    </div>
  </div>`;
}

function viewPractice() {
  if (["teacher", "admin"].includes(AUTH.currentUser?.role)) return viewPracticeManagement();
  let allPassages = getPublishedPassages();
  const journey = journeySummary();
  const isUnassessedStudent = AUTH.currentUser?.role === "student" && (S.lvl === null || AUTH.currentUser.lvl === null);

  // Filter by difficulty
  if (S.activeDiff && S.activeDiff !== "all") {
    allPassages = allPassages.filter(p => p.diff === S.activeDiff);
  }

  // Filter by search query
  if (SEARCH_QUERY.trim()) {
    const q = SEARCH_QUERY.toLowerCase();
    allPassages = allPassages.filter(p => 
      p.t.toLowerCase().includes(q) || 
      p.x.toLowerCase().includes(q) ||
      (p.diff && p.diff.toLowerCase().includes(q))
    );
  }

  const renderPassageCard = p => {
    const isDone = journey ? Boolean(journey.journey.results[p.id]) : S.done.includes(p.id);
    const isLocked = isUnassessedStudent || (journey && DIFF_KEYS.indexOf(p.diff) > journey.tier);
    const diffClass = "diff-" + (p.diff || "easy");
    const diffLabel = (p.diff || "custom").toUpperCase();
    const wc = wordCount(p.x);
    const estMin = Math.max(1, Math.round(wc / 130));

    const buttonLabel = isUnassessedStudent
      ? 'Take Placement First'
      : isLocked
        ? 'Complete earlier tiers'
        : isDone
          ? 'Read Again'
          : 'Read & Answer';
    const buttonAction = isUnassessedStudent ? 'data-a="tab" data-v="assess"' : `data-a="read-passage" data-v="${escapeHTML(p.id)}"`;
    const buttonDisabled = isUnassessedStudent ? '' : (isLocked ? 'disabled aria-label="Complete earlier reading tiers to unlock this passage"' : '');

    return `
      <article class="card passage-card ${isLocked ? 'passage-card-locked' : ''}">
        <div class="card-header">
          <div class="passage-card-heading">
            <span class="badge-diff ${diffClass}">${diffLabel}</span>
            <span class="sub-sm passage-card-meta">${wc} words · ~${estMin} min</span>
            <h3>${escapeHTML(p.t)}</h3>
          </div>
          <span class="pill ${isDone ? 'ok' : ''}">${isLocked ? 'Locked' : isDone ? 'Done ✓' : 'New'}</span>
        </div>
        <p class="sub passage-card-excerpt">${escapeHTML(p.x.slice(0, 110))}…</p>
        <div class="passage-card-footer">
          <span class="sub-sm">${p.qs.length} comprehension questions</span>
          <button class="btn sm ${isDone || isLocked ? 'o' : 'blue'}" ${buttonAction} ${buttonDisabled}>
            ${buttonLabel}
          </button>
        </div>
      </article>`;
  };
  const groupLocked = Boolean(!isUnassessedStudent && journey && S.activeDiff === "all" && !SEARCH_QUERY.trim());
  const availablePassages = groupLocked
    ? allPassages.filter(p => DIFF_KEYS.indexOf(p.diff) <= journey.tier) : allPassages;
  const lockedPassages = groupLocked
    ? allPassages.filter(p => DIFF_KEYS.indexOf(p.diff) > journey.tier) : [];

  return `
    <div class="subnav-segmented" role="tablist" aria-label="Reading section switcher">
      <button class="subnav-tab active" data-a="tab" data-v="practice">
        ${uiIcon("practice")} <span>Leveled Passages</span>
      </button>
      ${AUTH.currentUser?.role === "student" ? `
        <button class="subnav-tab" data-a="tab" data-v="studio">
          ${uiIcon("studio")} <span>My Reading Studio</span>
        </button>
      ` : ""}
    </div>
    <div class="row library-heading">
      <h2>Reading Library</h2>
      <span class="pill">${allPassages.length} Passages</span>
    </div>
    <p class="sub library-intro">Tap underlined words for trilingual translations. Test your comprehension with instant feedback.</p>

    ${isUnassessedStudent ? `
      <div class="card placement-required-banner" style="background:linear-gradient(135deg, rgba(37,137,230,0.08), rgba(46,196,182,0.1));border:1.5px solid var(--sky);padding:18px 20px;border-radius:var(--radius-md);margin-bottom:18px">
        <div class="lab" style="color:var(--sky-ink)">${uiIcon("assess")} Diagnostic Placement Required</div>
        <h3 style="margin:4px 0 6px 0">Find Your Comfortable Reading Level First</h3>
        <p class="sub" style="margin-bottom:14px">
          Welcome to BasaWisyo! Before starting story practice, complete your 15-question diagnostic placement assessment. This identifies your reading level and unlocks calibrated Philippine stories tailored to you.
        </p>
        <button class="btn blue sm" data-a="tab" data-v="assess">
          ${uiIcon("assess")} Start Placement Assessment
        </button>
      </div>
    ` : ""}

    <!-- Difficulty Filter Bar -->
    <div class="diff-selector" role="group" aria-label="Filter passages by difficulty">
      <button data-a="filter-diff" data-v="all" class="${S.activeDiff==='all'?'on':''}" aria-pressed="${S.activeDiff==='all'}">All</button>
      <button data-a="filter-diff" data-v="easy" class="${S.activeDiff==='easy'?'on':''}" aria-pressed="${S.activeDiff==='easy'}">Easy</button>
      <button data-a="filter-diff" data-v="medium" class="${S.activeDiff==='medium'?'on':''}" aria-pressed="${S.activeDiff==='medium'}">Medium</button>
      <button data-a="filter-diff" data-v="hard" class="${S.activeDiff==='hard'?'on':''}" aria-pressed="${S.activeDiff==='hard'}">Hard</button>
      <button data-a="filter-diff" data-v="extreme" class="${S.activeDiff==='extreme'?'on':''}" aria-pressed="${S.activeDiff==='extreme'}">Extreme</button>
    </div>

    <!-- Search Bar -->
    <label class="library-search-label" for="lib-search">Search stories</label>
    <div class="search-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="lib-search" placeholder="Search topics (e.g. coral, history, tarsier, science)..." value="${escapeHTML(SEARCH_QUERY)}">
    </div>

    <!-- Smart Review & Vocabulary Flashcards Banner -->
    ${(() => {
      const rStats = typeof getReviewStats === "function" ? getReviewStats() : { total: 0, due: 0 };
      const fStats = typeof getFlashcardStats === "function" ? getFlashcardStats() : { total: 0, due: 0 };
      if (rStats.total === 0 && fStats.total === 0) return "";
      return `
        <div class="smart-review-card">
          <div class="smart-review-content">
            <div class="lab" style="color:var(--gold)">Personalized Learning</div>
            <h3>Spaced Review &amp; Vocabulary Practice</h3>
            <p class="sub-sm" style="margin:2px 0 0 0">
              ${rStats.due > 0 ? `<b>${rStats.due}</b> questions due for review (zero-heart safe zone) · ` : "Review questions up to date · "}
              <b>${fStats.due}</b> vocabulary cards due today.
            </p>
          </div>
          <div class="smart-review-actions">
            ${rStats.due > 0 || rStats.total > 0 ? `
              <button class="btn sm blue" data-a="start-smart-review">
                ${uiIcon("refresh")} Review Questions (${rStats.due || rStats.total})
              </button>
            ` : ''}
            <button class="btn sm o" data-a="tab" data-v="flashcards">
              ${uiIcon("flashcards")} Flashcards (${fStats.due})
            </button>
          </div>
        </div>
      `;
    })()}

    ${journey ? `<details class="library-journey">
      <summary>${uiIcon("target")} <span>Your Reading Journey</span><span class="library-journey-tier">Current path: ${escapeHTML(DIFF_NAMES[DIFF_KEYS[journey.tier]])}</span></summary>
      ${viewJourneyPanel(journey)}
    </details>` : ""}

    <!-- Passages Grid -->
    <div id="passages-list">
      ${allPassages.length === 0 ? `
        <div class="card" style="text-align:center;padding:24px">
          <p class="sub">No passages found matching your search. Try another keyword or switch difficulty.</p>
          <button class="btn sm o" data-a="filter-diff" data-v="all" style="margin:0 auto">Show All Passages</button>
        </div>
      ` : `${availablePassages.map(renderPassageCard).join("")}
        ${lockedPassages.length ? `<details class="library-locked-group">
          <summary>${uiIcon("lock")} <span>Later reading tiers</span><span class="library-locked-count">${lockedPassages.length} locked stories</span></summary>
          <div class="library-locked-list">${lockedPassages.map(renderPassageCard).join("")}</div>
        </details>` : ""}`}
    </div>
  `;
}



/* === src/pages/flashcards.js === */
/* ==========================================================================
   BasaWisyo - Vocabulary Flashcards Page (flashcards.js)
   Interactive 3D flip card UI with Leitner spaced repetition ratings.
   ========================================================================== */

let FLASHCARD_ACTIVE_INDEX = 0;
let FLASHCARD_IS_FLIPPED = false;
let FLASHCARD_ACTIVE_FILTER = "due"; // "due" | "all" | "mastered"
let FLASHCARD_SHOW_ADD_MODAL = false;

function viewFlashcards() {
  const allCards = getFlashcardDeck();

  // Bound index safely
  if (FLASHCARD_ACTIVE_INDEX >= allCards.length) {
    FLASHCARD_ACTIVE_INDEX = Math.max(0, allCards.length - 1);
  }

  const currentCard = allCards[FLASHCARD_ACTIVE_INDEX] || null;

  return `
    <div class="flashcards-page">
      <div class="subnav-segmented" role="tablist" aria-label="Practice section switcher">
        <button class="subnav-tab active" data-a="tab" data-v="flashcards">
          ${uiIcon("flashcards")} <span>Vocabulary Flashcards</span>
        </button>
        <button class="subnav-tab" data-a="tab" data-v="assess">
          ${uiIcon("assess")} <span>Diagnostic Placement</span>
        </button>
      </div>

      <!-- Header -->
      <div class="fc-header-row">
        <div>
          <div class="lab" style="color:var(--gold)">Vocabulary Study Deck</div>
          <h2>Vocabulary Flashcards</h2>
          <p class="sub">Culturally rooted Filipino vocabulary with trilingual translations, audio pronunciation, and example sentences.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${(typeof isUserPremium === "function" && isUserPremium())
            ? `<span class="badge-prem" style="font-size:0.75rem;padding:5px 12px;border-radius:14px;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:700">👑 Wisyo Plus: Unlimited (${allCards.length} cards)</span>`
            : `<button class="btn sm o" data-a="upgrade-open" data-v="flashcards" style="font-size:0.75rem;border-color:#f59e0b;color:#92400e;background:#fffbeb;padding:5px 10px">Deck: ${allCards.length}/30 (Free) · ⭐ Upgrade</button>`}
          <button class="btn blue sm" data-a="fc-open-add">
            ${uiIcon("add")} Add New Word
          </button>
        </div>
      </div>

      <!-- Main Study Area: One Card at a Time -->
      ${allCards.length > 0 && currentCard ? `
        <div class="fc-study-container">
          <div class="fc-card-meta">
            <span>Card <b>${FLASHCARD_ACTIVE_INDEX + 1}</b> of <b>${allCards.length}</b></span>
            <span class="sub-sm" style="color:var(--sub)">Vocabulary Deck</span>
          </div>

          <!-- 3D Flippable Card -->
          <div class="fc-card-viewport" data-a="fc-flip" role="button" tabindex="0" aria-label="Flashcard for ${escapeHTML(currentCard.word)}. Press Space or Enter to flip.">
            <div class="fc-card-inner ${FLASHCARD_IS_FLIPPED ? 'is-flipped' : ''}">
              
              <!-- FRONT FACE -->
              <div class="fc-card-face fc-card-front">
                <div class="fc-face-header">
                  <span class="badge-diff diff-easy">Vocabulary</span>
                  <button class="btn sm o fc-speak-btn" data-a="fc-speak" data-v="${escapeHTML(currentCard.word)}" title="Hear pronunciation">
                    ${uiIcon("sound")} Pronounce
                  </button>
                </div>

                <div class="fc-front-content">
                  <div class="fc-word-title">${escapeHTML(currentCard.word)}</div>
                  ${currentCard.contextSentence ? `
                    <div class="fc-word-hint">Context: "${escapeHTML(currentCard.contextSentence)}"</div>
                  ` : ''}
                </div>

                <div class="fc-flip-hint">
                  ${uiIcon("refresh")} Click or press Space to flip and see definition
                </div>
              </div>

              <!-- BACK FACE -->
              <div class="fc-card-face fc-card-back">
                <div class="fc-face-header">
                  <b style="font-size:1.15rem;color:var(--navy);text-transform:capitalize">${escapeHTML(currentCard.word)}</b>
                  <button class="btn sm o fc-speak-btn" data-a="fc-speak" data-v="${escapeHTML(currentCard.word)}" title="Hear pronunciation">
                    ${uiIcon("sound")}
                  </button>
                </div>

                <div class="fc-back-details">
                  <div class="fc-def-box">
                    <div class="fc-def-label">Definition:</div>
                    <div class="fc-def-text">${escapeHTML(currentCard.definition)}</div>
                  </div>

                  <div class="fc-trilingual-grid">
                    <div class="fc-trilingual-item">
                      <span class="fc-flag">🇵🇭</span>
                      <b>Filipino:</b>
                      <span>${escapeHTML(currentCard.filipino || "—")}</span>
                    </div>
                    <div class="fc-trilingual-item">
                      <span class="fc-flag">🏝️</span>
                      <b>Bisaya:</b>
                      <span>${escapeHTML(currentCard.bisaya || "—")}</span>
                    </div>
                  </div>

                  ${currentCard.contextSentence ? `
                    <div class="fc-sentence-box">
                      <b>Example:</b> <i>"${escapeHTML(currentCard.contextSentence)}"</i>
                    </div>
                  ` : ''}
                </div>
              </div>

            </div>
          </div>

          <!-- Bottom Navigation Controls -->
          <div class="fc-controls-row">
            <button class="btn o sm" data-a="fc-prev" ${FLASHCARD_ACTIVE_INDEX === 0 ? 'disabled' : ''}>
              ← Previous
            </button>
            <button class="btn blue sm" data-a="fc-flip">
              ${uiIcon("refresh")} ${FLASHCARD_IS_FLIPPED ? 'Show Front' : 'Flip Card'}
            </button>
            <button class="btn o sm" data-a="fc-next" ${FLASHCARD_ACTIVE_INDEX >= allCards.length - 1 ? 'disabled' : ''}>
              Next →
            </button>
          </div>
        </div>
      ` : `
        <!-- Empty State -->
        <div class="card fc-empty-card">
          <div class="fc-empty-art" aria-hidden="true">
            <img src="assets/images/wisyo.png" alt="" style="width:110px;height:auto">
          </div>
          <h3>No Vocabulary Cards Yet</h3>
          <p class="sub">
            Save interesting words while reading stories in the library, or add your own words below.
          </p>
          <div class="fc-empty-actions">
            <button class="btn blue sm" data-a="fc-open-add">
              ${uiIcon("add")} Add New Word
            </button>
            <button class="btn o sm" data-a="tab" data-v="practice">
              Browse Reading Library
            </button>
          </div>
        </div>
      `}

      <!-- Add Custom Word Modal -->
      ${FLASHCARD_SHOW_ADD_MODAL ? `
        <div class="app-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fc-add-title">
          <div class="app-modal-card">
            <div class="modal-hdr">
              <h2 id="fc-add-title">${uiIcon("add")} Add Vocabulary Flashcard</h2>
              <button type="button" class="modal-close-btn" data-a="fc-close-add" aria-label="Close modal">✕</button>
            </div>
            <form id="fc-add-form" onsubmit="return false;">
              <div class="auth-form-group">
                <label for="fc-new-word">English Vocabulary Word *</label>
                <input type="text" id="fc-new-word" class="auth-input" placeholder="e.g. mangrove, biodiversity, resilience" required>
              </div>
              <div class="auth-form-group">
                <label for="fc-new-def">English Definition *</label>
                <textarea id="fc-new-def" class="auth-input" rows="2" placeholder="Clear, concise definition" required></textarea>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="auth-form-group">
                  <label for="fc-new-fil">🇵🇭 Filipino Translation</label>
                  <input type="text" id="fc-new-fil" class="auth-input" placeholder="e.g. bakawan">
                </div>
                <div class="auth-form-group">
                  <label for="fc-new-bis">🏝️ Bisaya Translation</label>
                  <input type="text" id="fc-new-bis" class="auth-input" placeholder="e.g. katunggan">
                </div>
              </div>
              <div class="auth-form-group">
                <label for="fc-new-sentence">Example Context Sentence</label>
                <input type="text" id="fc-new-sentence" class="auth-input" placeholder="e.g. Dense mangroves shield the coastline from fierce storm surges.">
              </div>
              <div style="display:flex;gap:10px;margin-top:16px">
                <button type="button" class="btn blue" data-a="fc-add-submit" style="flex:1">Save Card to Deck</button>
                <button type="button" class="btn o" data-a="fc-close-add" style="flex:1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}


/* === src/pages/profile.js === */
function viewProfile() {
  const user = AUTH.currentUser;
  if (user && user.role !== "student") {
    return `<section class="card"><h2>Learner Profile</h2><p class="sub">This view is for students and guests.</p></section>`;
  }
  const summary = journeySummary();
  const journey = summary.journey;
  const rank = readingRank(journey);
  const badges = journeyAchievements(journey).filter(badge => badge.earned);
  const teacher = user?.teacherCode
    ? AUTH.users.find(item => item.role === "teacher" && item.shareCode === user.teacherCode)
    : null;
  const placement = user && Number.isInteger(user.lvl) && user.lvl >= 0 && user.lvl < PHIL_IRI_LEVELS.length
    ? PHIL_IRI_LEVELS[user.lvl] : "Not assessed";
  const completed = DIFF_KEYS.flatMap((_, tier) => journeyEligiblePassages(tier))
    .filter(passage => journey.results[passage.id]?.total === passage.qs.length)
    .map(passage => ({ passage, result: journey.results[passage.id] }));
  const name = user?.name || "Guest Reader";
    const totalXP = typeof journeyTotalXP === "function" ? journeyTotalXP(journey) : 0;
    const badgeReqs = typeof journeyBadgeRequirements === "function" ? journeyBadgeRequirements(journey) : [];
    const lockedBadges = badgeReqs.filter(b => !b.earned);
    return `<div class="profile-page"><div class="profile-heading">
      <span class="profile-avatar frame-${journeySelectedFrame()}" aria-hidden="true">${escapeHTML(name.charAt(0).toUpperCase())}</span>
      <div><div class="lab">${user ? "Student Profile" : "My Progress"}</div>
        <h2>${escapeHTML(name)}</h2>
        <p class="sub-sm">${user ? "Your reading practice and rewards in this browser." : "Your guest progress is saved in this browser."}</p>
      </div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
        <button class="btn sm o" data-a="tour-replay" title="Replay the interactive onboarding walkthrough">🎓 Replay Tutorial</button>
      </div>
    </div>
    ${!user ? `<section class="card profile-guest-note">
      <p class="sub">Create a student account to keep this guest reading journey with your profile. Class Board participation stays off until you choose to join.</p>
      <button class="btn blue sm" data-a="auth-open" data-v="register">Create student account</button>
      <button class="btn o sm" data-a="auth-open">Sign in</button>
    </section>` : `<section class="card profile-account" aria-label="Your class information">
      <div class="lab">My Class</div>
      <p><b>Section:</b> ${escapeHTML(user.section || "Not linked to a class")}</p>
      <p><b>Teacher:</b> ${escapeHTML(teacher?.name || "Not linked to a teacher")}</p>
      <p><b>Placement label:</b> ${escapeHTML(placement)} <span class="sub-sm">(prototype placement, not an official Phil-IRI result)</span></p>
    </section>`}
    ${(() => {
      const isPrem = typeof isUserPremium === "function" ? isUserPremium() : false;
      const planName = user?.plan === "plus_annual" ? "Annual Member (₱99/mo)" : (user?.plan === "plus_monthly" ? "Monthly Member (₱149/mo)" : (isPrem ? "Wisyo Plus Active" : "Free Practice Tier"));
      return `<section class="card profile-membership-card ${isPrem ? "is-premium" : ""}" aria-label="Wisyo Plus Membership">
      <div class="membership-header">
        <div>
          <div class="lab">${uiIcon("sparkles")} Membership &amp; Features</div>
          <h3 style="margin:2px 0 0;font-size:1.15rem;display:flex;align-items:center;gap:8px">
            <span class="membership-badge ${isPrem ? "gold" : ""}">${isPrem ? "👑 Wisyo Plus" : "🌱 Free Plan"}</span>
            <span>${escapeHTML(planName)}</span>
          </h3>
        </div>
        <button class="btn sm ${isPrem ? "o" : "blue"}" data-a="upgrade-open">
          ${isPrem ? "Manage Plan" : "⭐ Upgrade to Wisyo Plus"}
        </button>
      </div>
      <p class="sub-sm" style="margin:4px 0 10px">
        ${isPrem 
          ? "You have full access to Wisyo Plus learning enhancements including unlimited practice hearts, speech audio, and advanced AI tutor." 
          : "Enjoy core curriculum reading and diagnostics for free, or upgrade for unlimited hearts, audio pronunciation, and smart AI tutoring."}
      </p>
      <ul class="membership-features">
        <li><span class="check">✓</span> ${isPrem ? "<strong>Unlimited Practice Hearts</strong> (❤️ ∞)" : "Standard Hearts per Quiz (Instant Retries)"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>Smart Contextual Audio</strong> (Web Speech 🔊)" : "Trilingual Dictionary & POS Badges"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>Unlimited Flashcards</strong>" : "Up to 30 Saved Flashcards"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>High-Thinking Wisyo AI</strong> (1,000 tokens)" : "10 Daily Wisyo AI Messages"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>Unlimited Story Imports</strong>" : "2 Personal Story Imports / Mo"}</li>
      </ul>
      <p class="membership-guarantee">
        <span>🛡️</span> <b>Equal Education Guarantee:</b> Reading curriculum, diagnostic placement, and teacher assignments are 100% free for all students.
      </p>
    </section>`;
    })()}
    <section class="profile-summary" aria-label="Your reading summary">
      <div class="card profile-stat"><span class="lab">Reading Path</span><b>${escapeHTML(DIFF_NAMES[DIFF_KEYS[summary.tier]])}</b></div>
      <div class="card profile-stat"><span class="lab">Stories Finished</span><b>${rank.stories}</b></div>
      <div class="card profile-stat"><span class="lab">Total XP</span><b class="profile-xp-value">${totalXP} XP</b><span class="sub-sm">5 XP/correct · 10 XP/story</span></div>
      <div class="card profile-stat"><span class="lab">Badges Earned</span><b>${badges.length} of ${JOURNEY_BADGES.length}</b></div>
      <div class="card profile-stat"><span class="lab">Activity Rank</span><b>${escapeHTML(rank.title)}</b></div>
    </section>
    ${viewJourneyPanel(summary)}
    ${lockedBadges.length ? `<section class="card profile-next-badges" aria-label="What is needed for your next badge">
      <div class="lab">${uiIcon("sparkles")} Next Badges to Unlock</div>
      <h3>Badges in Progress</h3>
      <p class="sub-sm">Rewards celebrate progress, effort, and customization—never punishment for mistakes. No XP loss or penalties on retries!</p>
      <div class="profile-badge-targets">
        ${lockedBadges.map(b => `<div class="profile-badge-target">
          <div class="profile-badge-target-head">
            <b>${b.icon} ${escapeHTML(b.title)}</b>
            <span class="pill">${escapeHTML(b.progressLabel)}</span>
          </div>
          <div class="sub-sm">${escapeHTML(b.description)}</div>
          <div class="sub-sm profile-badge-target-next"><b>Target:</b> ${escapeHTML(b.missingText)}</div>
        </div>`).join("")}
      </div>
    </section>` : ""}
    ${viewAchievementsPanel(journey)}

    <section class="card profile-stories" aria-label="Your completed reading practices">
      <div class="lab">My Completed Stories</div>
      ${completed.length ? `<ul>${completed.map(({ passage, result }) => `<li>
        <div><b>${escapeHTML(passage.t)}</b><span class="sub-sm">${escapeHTML(DIFF_NAMES[passage.diff])} · Best practice: ${result.correct} of ${result.total} correct</span></div>
        <button class="btn o sm" data-a="read-passage" data-v="${escapeHTML(passage.id)}"
          ${journeyCanRead(passage) ? "" : 'disabled aria-label="Complete earlier reading tiers to reopen this passage"'}>
          ${journeyCanRead(passage) ? "Read again" : "Tier locked"}</button>
      </li>`).join("")}</ul>` : `<p class="sub">No completed stories yet. Start with the next recommended passage above.</p>`}
    </section>
    <!-- Reading Mastery Dashboard -->
    <section class="card profile-mastery-section" aria-label="Reading comprehension skill mastery">
      <div class="lab">${uiIcon("target")} Reading Mastery</div>
      <h3>Reading Skill Evidence &amp; Analytics</h3>
      <p class="sub-sm">Evidence-based comprehension breakdown across literal, inference, vocabulary, sequencing, and main idea questions.</p>
      ${typeof renderReadingMasteryDashboard === "function" ? renderReadingMasteryDashboard(user?.id) : ""}
    </section></div>`;
}


/* === src/pages/quest.js === */
/* ==========================================================================
   BAYANIHAN COOPERATIVE READING QUEST VIEW (quest.js)
   - Real data-driven classroom cooperative reading quest.
   - Calculates verified class and individual word totals without simulated data.
   - Preserves weekly history and supports teacher-configured targets.
   - BasaMesh validated offline package exchange with preview before saving.
   ========================================================================== */

function viewQuest() {
  const stats = typeof getBayanihanStats === "function" ? getBayanihanStats() : {
    targetWords: 10000,
    classWords: 0,
    studentWords: 0,
    studentSessions: 0,
    linkedStudentsCount: 0,
    pct: 0,
    isGoalReached: false,
    currentWeek: "Current Week",
    history: [],
    isEnrolled: false
  };

  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const isTeacher = user && user.role === "teacher";
  const sectionName = user?.section || (user?.teacherCode ? `Section (${user.teacherCode})` : "Classroom");

  const subnavHtml = `
    <div class="subnav-segmented" role="tablist" aria-label="Class section switcher">
      <button class="subnav-tab" data-a="tab" data-v="board">
        ${uiIcon("board")} <span>Class Board</span>
      </button>
      <button class="subnav-tab active" data-a="tab" data-v="quest">
        ${uiIcon("quest")} <span>Bayanihan Quest</span>
      </button>
    </div>
  `;

  if (!stats.isEnrolled && !isTeacher) {
    return `
      <div class="quest-page">
        ${subnavHtml}
        <div class="quest-intro">
          <div class="lab" style="color:var(--gold)">Cooperative Reading Quest</div>
          <h2>Bayanihan Reading Quest</h2>
          <p class="sub">
            A shared classroom reading endeavor where every student's independent reading contributes toward a collective weekly milestone. Kept strictly separate from individual rankings.
          </p>
        </div>

        <div class="card join-classroom-gate-card" style="padding:24px;border-top:4px solid var(--sky)">
          <div class="lab" style="color:var(--sky-ink)">${uiIcon("classroom")} Classroom Enrollment Required</div>
          <h3 style="margin:4px 0 8px 0">Join a Classroom First!</h3>
          <p class="sub" style="margin-bottom:16px">
            To participate in the collective Bayanihan Reading Quest and contribute your words read toward a weekly classroom goal, enter the Share Code provided by your teacher:
          </p>
          <div class="connect-row" style="display:flex;gap:8px;max-width:440px;margin-bottom:16px">
            <input type="text" id="classroom-join-code" class="auth-input" placeholder="e.g. BASA-TEACH-8492" aria-label="Teacher share code" style="text-transform:uppercase;font-family:monospace">
            <button class="btn blue" data-a="student-connect-teacher" data-source="classroom-join-code">Join Class</button>
          </div>
          <div class="card" style="background:var(--bg);padding:12px 14px;border-left:4px solid var(--teal);margin:0">
            <p class="sub-sm" style="margin:0">
              💡 <b>Personal reading is always open!</b> You can freely explore and practice stories in the Reading Library once your diagnostic placement is complete, even before joining a classroom.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="quest-page">
      ${subnavHtml}
      <div class="quest-intro">
        <div class="lab" style="color:var(--gold)">Cooperative Reading Quest · ${escapeHTML(stats.currentWeek)}</div>
        <h2>${escapeHTML(sectionName)} Bayanihan Reading Quest</h2>
        <p class="sub">
          A shared classroom reading endeavor where every student's independent reading contributes toward a collective weekly milestone. Kept strictly separate from individual rankings.
        </p>
      </div>

      <!-- Real Data Progress Hero -->
      <div class="hero quest-hero" style="background:linear-gradient(135deg, var(--navy), #1a3365);border-radius:var(--radius-lg);padding:24px;color:#fff;margin-bottom:20px;box-shadow:var(--shadow-md)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div class="lab" style="color:#f5ab1d">Collective Classroom Goal: ${stats.targetWords.toLocaleString()} Words</div>
          <span class="pill" style="background:rgba(255,255,255,0.15);color:#fff">${stats.currentWeek}</span>
        </div>

        <div class="big" style="color:#fff;font-size:2.2rem;font-weight:700;margin:8px 0">
          ${stats.classWords.toLocaleString()} <span style="font-size:1.1rem;font-weight:500;color:#ccdcf8">/ ${stats.targetWords.toLocaleString()} words</span>
        </div>

        <!-- Progress Bar -->
        <div class="bar" style="background:rgba(255,255,255,0.2);height:12px;border-radius:6px;overflow:hidden;margin:10px 0">
          <i style="display:block;height:100%;background:linear-gradient(90deg, #2ec4b6, #f5ab1d);width:${stats.pct}%;border-radius:6px;transition:width 0.3s ease"></i>
        </div>

        <p class="sub" style="color:#e0edff;margin:6px 0 12px 0">
          ${stats.isGoalReached
            ? `${uiIcon("check")} Weekly Goal Reached! Wonderful cooperative reading effort by the classroom!`
            : stats.classWords === 0
              ? `No completed reading sessions recorded for this week yet. Read stories in the library to make the first classroom contribution!`
              : `Remaining: ${(stats.targetWords - stats.classWords).toLocaleString()} words to complete this week's milestone (${stats.pct}% complete).`}
        </p>

        <!-- Student Contribution Card -->
        <div class="row" style="background:rgba(255,255,255,0.12);padding:10px 14px;border-radius:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-size:0.85rem;color:#ccdcf8">Your personal contribution:</span>
            <div style="font-size:1.05rem;font-weight:700;color:#fff">
              ${stats.studentWords.toLocaleString()} words read <span style="font-size:0.85rem;font-weight:500;color:#ccdcf8">(${stats.studentSessions} completed sessions)</span>
            </div>
          </div>
          <button class="btn sm" data-a="tab" data-v="practice" style="background:#fff;color:var(--navy);font-weight:700">
            ${uiIcon("practice")} Read More Stories
          </button>
        </div>
      </div>

      <!-- Teacher Target Setting Panel -->
      ${isTeacher ? `
        <div class="card" style="margin-bottom:20px;border-left:4px solid var(--gold);padding:14px 18px">
          <div class="lab" style="color:var(--gold-ink)">Teacher Classroom Management</div>
          <h4 style="margin:2px 0 8px 0">Set Classroom Weekly Reading Target</h4>
          <p class="sub-sm" style="margin-bottom:10px">Adjust your class's weekly goal based on class size and weekly curriculum goals:</p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:440px">
            <input type="number" id="bayanihan-target-input" class="auth-input" value="${stats.targetWords}" min="500" max="500000" step="500" style="flex:1" aria-label="Weekly word goal">
            <button type="button" class="btn blue sm" data-a="set-bayanihan-target" style="padding:10px 16px">
              Update Goal
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Weekly Quest History Archive -->
      ${stats.history && stats.history.length > 0 ? `
        <div class="card" style="margin-bottom:20px">
          <div class="lab">Prior Weekly Quest History</div>
          <h3 style="margin:2px 0 10px 0">Classroom Reading Archive</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${stats.history.map(h => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm);font-size:0.875rem">
                <div>
                  <b>Week ${escapeHTML(h.week)}:</b>
                  <span style="margin-left:6px;color:var(--sub)">${h.wordsRead.toLocaleString()} / ${h.targetWords.toLocaleString()} words</span>
                </div>
                <span class="pill ${h.completed ? 'ok' : 'blue'}">
                  ${h.completed ? 'Milestone Reached ✓' : `${Math.round((h.wordsRead / h.targetWords) * 100)}%`}
                </span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}

      <!-- Prototype Synchronization Notice -->
      <div class="card" style="background:var(--bg);border:1px solid var(--border);margin-bottom:20px;padding:12px 16px">
        <b style="font-size:0.85rem;color:var(--navy)">Local-First Classroom Storage Notice:</b>
        <p class="sub-sm" style="margin:4px 0 0 0">
          Independent web browsers cannot automatically share class totals without a live server sync. Class totals shown above represent verified student reading sessions recorded in this browser or linked classroom roster. Use BasaMesh below to exchange reading packages between devices without internet!
        </p>
      </div>

      <!-- BasaMesh Offline Story Exchange -->
      <div class="card">
        <div class="lab">${uiIcon("upload")} BasaMesh · Offline Story Exchange</div>
        <h3 style="margin:2px 0">Share Stories &amp; Quizzes Without Internet</h3>
        <p class="sub">
          Generate an encoded share code for any custom reading passage. Classmates and teachers can import it via Bluetooth, flash drive, SMS, or local text!
        </p>

        <!-- Generate Code Form -->
        <div style="margin-top:14px;background:var(--bg);padding:14px;border-radius:var(--radius-sm)">
          <h4 style="margin:0 0 8px 0">Create Share Code for a Passage</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input id="mesh-title" class="auth-input" placeholder="Passage Title (e.g. Ang Agila ng Davao)">
            <textarea id="mesh-text" class="auth-input" rows="3" placeholder="Paste or type passage text here..."></textarea>
            <button class="btn sm o" data-a="mesh-create" style="align-self:flex-start">
              ${uiIcon("copy")} Generate BasaMesh Code
            </button>
            <div id="mesh-generated-box" style="display:none;margin-top:8px">
              <span class="lab">Your Share Code (Copy and send to classmates):</span>
              <textarea id="mesh-code-output" class="auth-input" rows="3" readonly style="font-family:monospace;font-size:0.8rem;background:var(--card-bg)"></textarea>
            </div>
          </div>
        </div>

        <!-- Import Code Form with Preview -->
        <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:16px">
          <h4 style="margin:0 0 4px 0">Import Passage from Classmate</h4>
          <p class="sub-sm" style="margin-bottom:8px">Paste code below to preview the passage before adding it to your library:</p>
          <textarea id="mesh-code" class="auth-input" rows="2" placeholder="Paste BasaMesh code here..."></textarea>
          <button class="btn sm blue" data-a="mesh-preview" style="margin-top:8px">
            ${uiIcon("eye")} Inspect &amp; Preview Passage
          </button>
        </div>

        <!-- Interactive Import Preview Card -->
        <div id="mesh-preview-container" style="display:none;margin-top:16px"></div>
      </div>
    </div>
  `;
}


/* === src/pages/board.js === */
/* ==========================================================================
   BasaWisyo - Class Reading Board & Rankings Page (board.js)
   Presents local classroom and year-level leaderboards.
   Supports Weekly XP, Stories Completed, and All-Time XP metrics.
   Guarantees student privacy (anonymous aliases, opt-in only).
   Explicitly marked as local demo prototype data.
   ========================================================================== */

function viewClassBoard() {
  const user = AUTH.currentUser;
  if (user?.role === "admin") {
    return `<div class="card"><h2>Class Board</h2><p class="sub">This board is for learners and their linked teachers.</p></div>`;
  }

  const journey = user?.role === "teacher" ? null : journeyForCurrent();
  const rank = journey ? readingRank(journey) : null;
  const context = classBoardContext();
  const tier = BOARD_TIER ?? (user?.role === "student"
    ? journeyUnlockedTier(journey, user.journeyOverride) : 0);
  const optedIn = user?.role === "student" && journey?.boardOptIn === true;

  const currentMetric = typeof CURRENT_BOARD_METRIC !== "undefined" ? CURRENT_BOARD_METRIC : "weeklyXP";
  const currentScope = typeof CURRENT_BOARD_SCOPE !== "undefined" ? CURRENT_BOARD_SCOPE : "classroom";
  const period = typeof getRankingPeriod === "function" ? getRankingPeriod() : { label: "Current Week", daysRemaining: 7 };

  // Get rankings based on selected metric
  let entries = [];
  if (context && (context.role === "teacher" || optedIn)) {
    if (currentMetric === "stories") {
      entries = classBoardEntries(tier);
    } else if (typeof getClassroomRankings === "function") {
      const res = getClassroomRankings({ metric: currentMetric, scope: currentScope, tier });
      entries = res.entries;
    }
  }

  return `
    <div class="subnav-segmented" role="tablist" aria-label="Class section switcher">
      <button class="subnav-tab active" data-a="tab" data-v="board">
        ${uiIcon("board")} <span>Class Board</span>
      </button>
      <button class="subnav-tab" data-a="tab" data-v="quest">
        ${uiIcon("quest")} <span>Bayanihan Quest</span>
      </button>
    </div>
    <div class="row">
      <h2>Class Reading Board</h2>
      <span class="pill">Local classroom</span>
    </div>
    <p class="sub">Celebrate reading practice and milestones at your own pace. Participation is voluntary, anonymous, and uses accounts saved in this browser only.</p>

    <!-- Prototype Transparency Banner -->
    <div class="card prototype-notice-banner" style="background:rgba(245, 171, 29, 0.08);border:1px solid rgba(245, 171, 29, 0.3);padding:10px 14px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px">
        <span aria-hidden="true">📌</span>
        <span class="sub-sm" style="color:var(--gold-ink)">
          <b>Local Demo Prototype Data:</b> Rankings reflect activity in this browser only. Not synced across live school servers.
        </span>
      </div>
    </div>

    <!-- Learner's Personal Milestone Card -->
    ${rank ? `
      <section class="card board-rank" aria-label="Your reading activity rank">
        <div class="lab">Your Activity Rank</div>
        <h3>${escapeHTML(rank.title)}</h3>
        <p class="sub-sm">${rank.stories} different qualifying ${rank.stories === 1 ? "story" : "stories"} completed across all tiers. This is a practice milestone, not a reading ability level.</p>
        <p class="sub-sm">${rank.next
          ? `${rank.next.min - rank.stories} more ${rank.next.min - rank.stories === 1 ? "story" : "stories"} to become ${escapeHTML(rank.next.title)}.`
          : "You have reached the final activity rank. Keep enjoying new stories."}</p>
      </section>
    ` : ""}

    ${!context ? `
      <div class="card join-classroom-gate-card" style="padding:24px;border-top:4px solid var(--sky)">
        <div class="lab" style="color:var(--sky-ink)">${uiIcon("classroom")} Classroom Enrollment Required</div>
        <h3 style="margin:4px 0 8px 0">Join a Classroom First!</h3>
        <p class="sub" style="margin-bottom:16px">${!user ? "Sign in with a student account and join a teacher's class to see the board. Your guest reading progress can transfer when you register."
          : "To view Class Board rankings and participate with your section, enter the Share Code provided by your teacher:"}</p>
        ${!user ? '<button class="btn blue sm" data-a="auth-open">Sign in</button>' : `
          <div class="connect-row" style="display:flex;gap:8px;max-width:440px;margin-bottom:16px">
            <input type="text" id="classroom-join-code-board" class="auth-input" placeholder="e.g. BASA-TEACH-8492" aria-label="Teacher share code" style="text-transform:uppercase;font-family:monospace">
            <button class="btn blue" data-a="student-connect-teacher" data-source="classroom-join-code-board">Join Class</button>
          </div>
          <div class="card" style="background:var(--bg);padding:12px 14px;border-left:4px solid var(--teal);margin:0">
            <p class="sub-sm" style="margin:0">
              💡 <b>Personal reading is always open!</b> You can freely explore and practice stories in the Reading Library once your diagnostic placement is complete, even before joining a classroom.
            </p>
          </div>
        `}
      </div>
    ` : `
      ${user?.role === "student" ? `
        <section class="card board-choice">
          <h3>Share your progress with your class?</h3>
          <p class="sub-sm">Only a generated reader label and your count of distinct stories appear. Participation is optional; you can leave anytime.</p>
          <button class="btn ${optedIn ? "o" : "blue"} sm" data-a="board-opt" data-v="${optedIn ? "off" : "on"}">
            ${optedIn ? "Leave Class Board" : "Join Class Board"}
          </button>
        </section>
      ` : ""}

      ${user?.role === "teacher" || optedIn ? `
        <section class="card board-panel" aria-label="Class reading board">
          <!-- Scope & Metric Control Bar -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px">
            <div>
              <div class="lab" style="color:var(--sky-ink)">Ranking Metric</div>
              <div style="display:flex;gap:6px;margin-top:4px" role="group" aria-label="Choose ranking metric">
                <button class="btn sm ${currentMetric === 'weeklyXP' ? 'blue' : 'o'}" data-a="board-metric" data-v="weeklyXP" aria-pressed="${currentMetric === 'weeklyXP'}">
                  Weekly XP
                </button>
                <button class="btn sm ${currentMetric === 'stories' ? 'blue' : 'o'}" data-a="board-metric" data-v="stories" aria-pressed="${currentMetric === 'stories'}">
                  Stories by Tier
                </button>
                <button class="btn sm ${currentMetric === 'allTimeXP' ? 'blue' : 'o'}" data-a="board-metric" data-v="allTimeXP" aria-pressed="${currentMetric === 'allTimeXP'}">
                  All-Time XP
                </button>
              </div>
            </div>

            <div>
              <div class="lab" style="color:var(--teal-ink)">Filter Scope</div>
              <div style="display:flex;gap:6px;margin-top:4px" role="group" aria-label="Choose board scope">
                <button class="btn sm ${currentScope === 'classroom' ? 'blue' : 'o'}" data-a="board-scope" data-v="classroom" aria-pressed="${currentScope === 'classroom'}">
                  My Classroom
                </button>
                <button class="btn sm ${currentScope === 'grade' ? 'blue' : 'o'}" data-a="board-scope" data-v="grade" aria-pressed="${currentScope === 'grade'}">
                  Year-Level
                </button>
              </div>
            </div>
          </div>

          <!-- Active Period Info -->
          ${currentMetric === "weeklyXP" ? `
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg);padding:8px 12px;border-radius:6px;margin-bottom:14px">
              <span class="sub-sm">🗓️ <b>Weekly Period:</b> ${escapeHTML(period.label)}</span>
              <span class="sub-sm" style="color:var(--sub)">Resets in ${period.daysRemaining} ${period.daysRemaining === 1 ? 'day' : 'days'}</span>
            </div>
          ` : ''}

          <!-- Tier buttons for Stories / Tier Navigation -->
          <h3>Stories by tier</h3>
          <div class="board-tier-choices" role="group" aria-label="Choose reading tier">
            ${DIFF_KEYS.map((key, index) => `
              <button class="btn sm ${tier === index ? "blue" : "o"}"
                data-a="board-tier" data-v="${index}" aria-pressed="${tier === index}">
                ${escapeHTML(DIFF_NAMES[key])}
              </button>
            `).join("")}
          </div>
          <p class="sub-sm" style="margin-top:8px">${escapeHTML(DIFF_NAMES[DIFF_KEYS[tier]])} · tied readers share the same place.</p>

          <!-- Ranked List -->
          ${entries.length ? `
            <ol class="board-list">
              ${entries.map(entry => `
                <li class="board-entry ${entry.own ? "own" : ""}">
                  <span class="board-place">#${entry.place}</span>
                  <b>${entry.own ? "You" : escapeHTML(entry.alias)}</b>
                  <span class="board-count">
                    ${currentMetric === "stories"
                      ? `${entry.stories} ${entry.stories === 1 ? "story" : "stories"}`
                      : `${entry.score} XP`}
                  </span>
                </li>
              `).join("")}
            </ol>
          ` : `
            <p class="sub">No one has joined this local class board yet.</p>
          `}
        </section>
      ` : ""}
    `}
  `;
}


/* === src/pages/reports.js === */
/* DEPED REPORTS VIEW */
function canViewReports() {
  return ["teacher", "admin"].includes(AUTH.currentUser?.role)
    && AUTH.currentUser.status !== "suspended";
}

function requireReportAccess() {
  if (!canViewReports()) throw new Error("Teacher or admin account required for reports.");
}

function viewReports() {
  if (!canViewReports()) {
    return `<section class="card"><h2>Reports unavailable</h2><p class="sub">Class reports are available to teacher and admin accounts.</p></section>`;
  }
  const dataset = getClassroomReportDataset();

  return `
    <h2>Reading Reports Preview & Analytics</h2>
    <p class="sub">Comprehensive reading performance reports, diagnostic placement tracking, and formative assessment metrics.</p>

    <!-- Operational Classroom Analytics -->
    ${(!dataset || dataset.total === 0) ? `
      <div class="card" style="margin-bottom:18px">
        <div class="lab">Live Classroom Analytics (${escapeHTML(dataset ? dataset.section : "Classroom")})</div>
        <div style="padding:16px 0">
          <h3 style="margin-bottom:6px">No student results available yet</h3>
          <p class="sub">
            No student accounts are currently enrolled in this classroom (${escapeHTML(dataset ? dataset.classroomCode : "UNASSIGNED")}). Once students connect with your share code and complete their diagnostic placement, verified analytics, reading profiles, and intervention indicators will appear here.
          </p>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn o" data-a="open-report-sheet" data-v="live">
            ${uiIcon("print")} Preview Classroom Report
          </button>
          <button class="btn o" data-a="download-csv" data-v="live">
            ${uiIcon("download")} Export Empty CSV
          </button>
        </div>
      </div>
    ` : `
      <div class="card" style="margin-bottom:18px">
        <div class="lab">Live Classroom Analytics (${escapeHTML(dataset.section)} · ${escapeHTML(dataset.school)})</div>
        <div class="metric-grid" style="margin-top:10px;margin-bottom:14px">
          <div class="metric-box">
            <div class="metric-value">${dataset.total}</div>
            <div class="metric-title">Enrolled Students</div>
          </div>
          <div class="metric-box">
            <div class="metric-value" style="color:var(--teal)">${dataset.coveragePct}%</div>
            <div class="metric-title">Placement Coverage (${dataset.assessed}/${dataset.total})</div>
          </div>
          <div class="metric-box">
            <div class="metric-value">${dataset.totalWords.toLocaleString()}</div>
            <div class="metric-title">Total Words Read</div>
          </div>
          <div class="metric-box">
            <div class="metric-value" style="color:var(--coral)">${dataset.students.filter(s => s.status === 'Needs Intervention').length}</div>
            <div class="metric-title">Needs Intervention</div>
          </div>
        </div>

        <div class="lab" style="margin-bottom:6px">Verified Reading Profile Distribution</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-hard" style="margin-right:6px">LEVEL 0</span> Frustration (Needs Intensive Remediation)</span>
              <b>${dataset.levelCounts[0]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[0]/dataset.total)*100}%;background:var(--coral)"></i></div>
          </div>

          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-medium" style="margin-right:6px">LEVEL 1</span> Instructional (Guided Reading)</span>
              <b>${dataset.levelCounts[1]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[1]/dataset.total)*100}%;background:var(--gold-hover)"></i></div>
          </div>

          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-easy" style="margin-right:6px;background:var(--sky-soft);color:var(--sky-ink);border-color:rgba(37,137,230,0.3)">LEVEL 2</span> Independent (At Grade Level)</span>
              <b>${dataset.levelCounts[2]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[2]/dataset.total)*100}%;background:var(--sky)"></i></div>
          </div>

          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-easy" style="margin-right:6px">LEVEL 3</span> Mastery (Advanced / Honor)</span>
              <b>${dataset.levelCounts[3]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[3]/dataset.total)*100}%;background:var(--teal)"></i></div>
          </div>

          ${dataset.unassessed > 0 ? `
          <div>
            <div class="row report-distribution-row">
              <span><span class="pill" style="margin-right:6px;background:var(--bg-card);border:1px solid var(--border)">UNASSESSED</span> Placement Required</span>
              <b>${dataset.unassessed} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.unassessed/dataset.total)*100}%;background:var(--sub)"></i></div>
          </div>
          ` : ''}
        </div>

        <div class="btn-row" style="margin-top:14px">
          <button class="btn blue" data-a="open-report-sheet" data-v="live">
            ${uiIcon("print")} Preview Classroom Report
          </button>
          <button class="btn o" data-a="download-csv" data-v="live">
            ${uiIcon("download")} Download Verified CSV
          </button>
        </div>
      </div>
    `}
  `;
}



/* === src/pages/parent.js === */
/* PARENT HUB VIEW */
function viewParent() {
  const currentLevelStr = S.lvl !== null ? PHIL_IRI_LEVELS[S.lvl] : "Pending Placement";
  const startLevelStr = S.l0 !== null ? PHIL_IRI_LEVELS[S.l0] : "—";
  const estPages = Math.max(1, Math.round(S.w / 220));

  const monthlyTutoring = (S.pay || 0) * (S.pm || 0);
  const diff = monthlyTutoring - 99;

  return `
    <div class="hero">
      <div class="lab" style="color:#f5ab1d">Para sa Magulang at Pamilya</div>
      <h2>Empowering Parents in Daily Reading Growth</h2>
      <p class="sub">
        Tangible proof of your child’s progress, actionable DepEd Brigada Pagbasa tips, and a simple 10-minute nightly routine.
      </p>
      ${S.sub ? `
        <span class="pill ok" style="background:#fff;color:var(--teal)">Subscribed ✓ (Demo Mode Active)</span>
      ` : `
        <button class="btn blue sm" data-a="sub-toggle">
          Unlock Parent Hub · ₱99/month (Demo)
        </button>
      `}
    </div>

    <!-- Student Progress Card -->
    <div class="card">
      <div class="lab">Reading Trajectory</div>
      <div class="row" style="margin:10px 0">
        <div>
          <div class="sub-sm">Starting Point</div>
          <b>${startLevelStr}</b>
        </div>
        <div class="big" style="color:var(--gold)">→</div>
        <div style="text-align:right">
          <div class="sub-sm">Current Level</div>
          <b style="color:var(--navy)">${currentLevelStr}</b>
        </div>
      </div>
      <div class="sub">
        ${S.ss} reading sessions completed · ${S.w.toLocaleString()} words read (~${estPages} book pages).
      </div>
    </div>

    <!-- DepEd Brigada Pagbasa Home Tips -->
    <div class="card">
      <div class="lab">10-Minute Read-Aloud Guide Tonight</div>
      <h3>Basa Together Routine</h3>
      <p class="sub">Read a short passage together for just 10 minutes before bedtime:</p>
      <ol class="sub" style="padding-left:18px;margin:8px 0;line-height:1.7">
        <li><b>Alternate sentences:</b> Parent reads sentence 1, student reads sentence 2.</li>
        <li><b>Ask the 'Bakit' question:</b> "Bakit kaya ginawa iyon ng tauhan?"</li>
        <li><b>Highlight a new word:</b> Pick one unfamiliar word and use it in a funny sentence.</li>
        <li><b>Praise effort:</b> "Ang galing ng pagbasa mo ngayon, tuloy-tuloy!"</li>
      </ol>
    </div>

    <!-- Message for OFW / Overseas Relatives -->
    <div class="card">
      <div class="lab">Update for OFW Parents or Relatives</div>
      <div class="speech-bubble" id="ofw-msg">
        "Kamusta po! Update lang po sa pagbasa ni anak sa BasaWisyo: Nasa level na po siya ng ${currentLevelStr}! Nakatapos na po siya ng ${S.ss} reading sessions at nakabasa ng ${S.w.toLocaleString()} salita. Tuloy-tuloy po ang pagpupursigi!"
      </div>
      <button class="btn sm o" data-a="copy-ofw-msg">${uiIcon("copy")} Copy Message for Messenger / SMS</button>
    </div>

    <!-- Tutoring Cost Comparison -->
    <div class="card">
      <div class="lab">Budget Comparison: Private Tutor vs BasaWisyo</div>
      <p class="sub">See how much you save while giving your child consistent daily reading practice:</p>
      
      <div class="parent-choice-grid">
        <div>
          <label class="sub-sm" for="tutor-rate">Rate per session (₱)</label>
          <input type="number" id="tutor-rate" value="${S.pay || ''}" placeholder="e.g. 250">
        </div>
        <div>
          <label class="sub-sm" for="tutor-sessions">Sessions / month</label>
          <input type="number" id="tutor-sessions" value="${S.pm || ''}" placeholder="e.g. 8">
        </div>
      </div>
      <button class="btn sm o" data-a="calc-tutor">Compute Monthly Comparison</button>

      ${monthlyTutoring > 0 ? `
        <div style="margin-top:12px;background:var(--teal-soft);padding:10px 12px;border-radius:10px">
          <b style="color:var(--teal)">Private Tutoring: ₱${monthlyTutoring.toLocaleString()} / month</b><br>
          <span class="sub-sm">BasaWisyo companion: ₱99 / month. You save approx <b>₱${diff.toLocaleString()}</b> every month!</span>
        </div>
      ` : ''}
    </div>
  `;
}



/* === src/pages/about.js === */
/* ABOUT VIEW */
function viewAbout() {
  return `
    <h2>About BasaWisyo</h2>
    <div class="card">
      <div class="lab">Our Story</div>
      <p class="sub">
        BasaWisyo (a fusion of <i>Basa</i> - to read, and <i>Wisyo</i> - consciousness / wisdom) is a student-led educational innovation developed to tackle the Philippine reading crisis. Many Grade 7 to 12 learners struggle with reading comprehension below their grade level, while overworked teachers handle 40 to 50 students per class with limited internet access.
      </p>
      <p class="sub">
        BasaWisyo bridges this gap by unifying offline Phil-IRI diagnostics, four difficulty tiers of culturally relevant texts, the Wisyo AI Tutor, cooperative Bayanihan quests, and automatic DepEd Form 14 generation into a single lightweight platform.
      </p>
    </div>

    <div class="card">
      <div class="lab">The Founding Team</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
        <div class="row">
          <div>
            <b>Justin A. Rayon</b>
            <div class="sub-sm">Chief Executive Officer · Strategy & DepEd Partnerships</div>
          </div>
          <span class="pill">Leadership</span>
        </div>
        <div class="row">
          <div>
            <b>Charles Jerico H. Villapa</b>
            <div class="sub-sm">Chief Operating Officer · School Pilots & Teacher Training</div>
          </div>
          <span class="pill">Operations</span>
        </div>
        <div class="row">
          <div>
            <b>Jobert C. Jamelo</b>
            <div class="sub-sm">Chief Technology Officer · Offline Architecture & NLP Systems</div>
          </div>
          <span class="pill">Engineering</span>
        </div>
      </div>
    </div>
  `;
}



/* === src/pages/services.js === */
/* SERVICES VIEW */
function viewServices() {
  return `
    <h2>Programs & Services</h2>
    <div class="card">
      <div class="lab">School Licensing</div>
      <h3>BasaWisyo Institutional for DepEd Schools</h3>
      <p class="sub">
        Complete offline package deployed on school servers or tablets. Includes automated Phil-IRI Pre-test / Post-test tracking, division-level reporting, and specialized Teacher Training Workshops.
      </p>
      <div class="sub-sm"><b>Estimated licensing:</b> ₱150 – ₱250 per student/year (subsidy eligible).</div>
    </div>

    <div class="card">
      <div class="lab">Community & LGU Partnerships</div>
      <h3>Brigada Pagbasa Community Hubs</h3>
      <p class="sub">
        Partnership packages for Local Government Units (LGUs) and NGOs deploying BasaWisyo in barangay reading centers and libraries.
      </p>
    </div>
  `;
}



/* === src/pages/reading-studio.js === */
/* ==========================================================================
   BasaWisyo Student: My Reading Studio
   Personal reading import, Wisyo AI question & vocabulary generation,
   heart-free practice, and personal library management.
   ========================================================================== */

let STUDIO_EXTRACTED_TEXT = "";
let STUDIO_TITLE = "";
let STUDIO_LANG = "en";
let STUDIO_DIFF = "medium";
let STUDIO_Q_COUNT = 5;
let STUDIO_WARNING = "";
let STUDIO_IS_LOADING = false;
let STUDIO_ACTIVE_SUBTAB = "import"; // 'import', 'library'

/**
 * Renders the main My Reading Studio page view for students and guests.
 * @returns {string} HTML markup
 */
function viewReadingStudio() {
  const actor = typeof getStorageActor === "function" ? getStorageActor() : { role: "student", name: "Student" };
  const stats = typeof normalizeImportedText === "function"
    ? normalizeImportedText(STUDIO_EXTRACTED_TEXT)
    : { wordCount: 0, charCount: 0, estMinutes: 1, suggestedTier: "medium" };

  return `
    <div class="reading-studio-page">
      <div class="subnav-segmented" role="tablist" aria-label="Reading section switcher">
        <button class="subnav-tab" data-a="tab" data-v="practice">
          ${uiIcon("practice")} <span>Leveled Passages</span>
        </button>
        <button class="subnav-tab active" data-a="tab" data-v="studio">
          ${uiIcon("studio")} <span>My Reading Studio</span>
        </button>
      </div>

      <!-- Studio Header -->
      <div class="dashboard-intro">
        <div>
          <div class="lab" style="color:var(--teal-ink)">${uiIcon("sparkles")} Personalized Learning</div>
          <h2>My Reading Studio</h2>
          <p class="sub">Import any story, article, or document. Wisyo AI will prepare interactive questions, vocabulary flashcards, and read-aloud practice just for you!</p>
        </div>
        <div class="dashboard-intro-actions">
          <button class="btn sm ${STUDIO_ACTIVE_SUBTAB === 'import' ? 'blue' : 'o'}" data-a="studio-tab" data-v="import">
            ${uiIcon("add")} New Material
          </button>
          <button class="btn sm ${STUDIO_ACTIVE_SUBTAB === 'library' ? 'blue' : 'o'}" data-a="studio-tab" data-v="library">
            ${uiIcon("practice")} My Saved Stories
          </button>
        </div>
      </div>

      <!-- Studio Mode Policy Banner -->
      <div class="card studio-policy-card" style="background:var(--sky-soft);border-left:4px solid var(--sky);margin-bottom:18px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:1.25rem;line-height:1">🛡️</span>
          <div>
            <b style="color:var(--sky-ink);font-size:0.9rem">Private &amp; Heart-Free Learning Space</b>
            <div class="sub-sm" style="margin-top:2px">
              Your imported materials are completely private to your device. Practice quizzes in your studio are <b>100% heart-free</b> (mistakes never cost hearts), and results do not alter your official DepEd Phil-IRI reading tier.
            </div>
          </div>
        </div>
      </div>

      ${STUDIO_ACTIVE_SUBTAB === "library" ? renderStudioLibraryView() : renderStudioImportView(stats)}
    </div>
  `;
}

/**
 * Renders the file upload, text editor, and practice configuration form.
 * @param {Object} stats 
 * @returns {string} HTML markup
 */
function renderStudioImportView(stats) {
  return `
    <div class="studio-grid" style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start">
      <!-- Left Column: File Input & Passage Text Editor -->
      <div class="card" style="margin:0">
        <div class="card-header" style="margin-bottom:12px">
          <div>
            <div class="lab">Step 1 · Source Material</div>
            <h3 style="margin:2px 0">Upload Document or Paste Text</h3>
          </div>
        </div>

        <!-- File Upload Area -->
        <div class="studio-dropzone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:20px;text-align:center;background:var(--bg);margin-bottom:16px">
          <div style="font-size:1.75rem;margin-bottom:6px">📄</div>
          <b>Choose a PDF, Word (.docx), or Text (.txt) file</b>
          <p class="sub-sm" style="margin:4px 0 12px">Up to 10 MB per file. Text is extracted locally in your browser.</p>
          <input type="file" id="studio-file-input" accept=".txt,.docx,.pdf" style="display:none" data-a="studio-file-change">
          <button type="button" class="btn sm o" data-a="studio-file-trigger">
            ${uiIcon("upload")} Select Document from Device
          </button>
        </div>

        <!-- Warning Alert (if any) -->
        ${STUDIO_WARNING ? `
          <div class="card" style="background:#FFF1F2;border-left:4px solid var(--coral);padding:10px 14px;margin-bottom:14px">
            <b style="color:var(--coral);font-size:0.85rem">⚠️ Notice:</b>
            <div class="sub-sm" style="margin-top:2px">${escapeHTML(STUDIO_WARNING)}</div>
          </div>
        ` : ""}

        <!-- Title Input -->
        <label style="display:block;margin-bottom:12px">
          <span class="lab">Story / Material Title</span>
          <input type="text" id="studio-title-input" class="auth-input" placeholder="e.g. Tala and the Hidden Spring" value="${escapeHTML(STUDIO_TITLE || stats.cleanTitle)}">
        </label>

        <!-- Passage Text Editor -->
        <label style="display:block;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span class="lab">Reading Passage Text</span>
            <span class="sub-sm" id="studio-char-stats">
              <b>${stats.wordCount}</b> words · <b>${stats.charCount}</b> characters · ~${stats.estMinutes} min read
            </span>
          </div>
          <textarea id="studio-text-input" class="auth-input" rows="12" style="font-family:inherit;font-size:0.95rem;line-height:1.6;resize:vertical" placeholder="Paste or type your reading passage here...">${escapeHTML(STUDIO_EXTRACTED_TEXT)}</textarea>
        </label>
      </div>

      <!-- Right Column: Generation Configuration & Launch -->
      <div class="card" style="margin:0">
        <div class="card-header" style="margin-bottom:12px">
          <div>
            <div class="lab">Step 2 · Practice Settings</div>
            <h3 style="margin:2px 0">Configure Practice</h3>
          </div>
        </div>

        <!-- Language Selector -->
        <label style="display:block;margin-bottom:14px">
          <span class="lab">Passage Language</span>
          <select id="studio-lang-select" class="auth-input">
            <option value="en" ${STUDIO_LANG === 'en' ? 'selected' : ''}>English</option>
            <option value="fil" ${STUDIO_LANG === 'fil' ? 'selected' : ''}>Filipino</option>
            <option value="ceb" ${STUDIO_LANG === 'ceb' ? 'selected' : ''}>Cebuano / Bisaya</option>
          </select>
        </label>

        <!-- Difficulty Selector -->
        <label style="display:block;margin-bottom:14px">
          <span class="lab">Target Difficulty</span>
          <select id="studio-diff-select" class="auth-input">
            <option value="easy" ${STUDIO_DIFF === 'easy' ? 'selected' : ''}>Easy (Grades 7–8)</option>
            <option value="medium" ${STUDIO_DIFF === 'medium' ? 'selected' : ''}>Medium (Grades 9–10)</option>
            <option value="hard" ${STUDIO_DIFF === 'hard' ? 'selected' : ''}>Hard (Grades 11–12)</option>
          </select>
        </label>

        <!-- Question Count Pills -->
        <div style="margin-bottom:18px">
          <span class="lab" style="display:block;margin-bottom:6px">Comprehension Questions</span>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px">
            ${[5, 10, 15].map(cnt => `
              <button type="button" class="btn sm ${STUDIO_Q_COUNT === cnt ? 'blue' : 'o'}" data-a="studio-qcount" data-v="${cnt}" style="font-weight:600">
                ${cnt} Questions
              </button>
            `).join("")}
          </div>
        </div>

        <!-- Wisyo Feature Summary -->
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:18px">
          <b style="font-size:0.85rem;color:var(--navy);display:flex;align-items:center;gap:6px">
            ${uiIcon("sparkles")} Wisyo AI Will Generate:
          </b>
          <ul class="sub-sm" style="margin:6px 0 0 18px;padding:0">
            <li>${STUDIO_Q_COUNT} multi-skill questions (Literal, Inference, Main Idea)</li>
            <li>Vocabulary flashcards with trilingual definitions</li>
            <li>Direct text evidence explanations for every answer</li>
          </ul>
        </div>

        <!-- Action Button -->
        <button type="button" class="btn blue" data-a="studio-generate-start" style="width:100%;padding:12px;font-size:1rem" ${STUDIO_IS_LOADING ? 'disabled' : ''}>
          ${STUDIO_IS_LOADING ? 'Wisyo AI is Analyzing Passage...' : `${uiIcon("sparkles")} Generate &amp; Start Practice →`}
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the student's personal library of previously saved imported materials.
 * @returns {string} HTML markup
 */
function renderStudioLibraryView() {
  const actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "guest", role: "guest" };
  const allMaterials = typeof readLocalMaterials === "function" ? readLocalMaterials() : [];
  const myMaterials = allMaterials.filter(m => m.ownerId === actor.id || m.status === "personal");

  if (myMaterials.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:40px 20px">
        <div style="font-size:2.5rem;margin-bottom:8px">📚</div>
        <h3>No Imported Stories Yet</h3>
        <p class="sub" style="max-width:440px;margin:0 auto 18px">
          You haven't imported any personal reading materials yet. Upload a document or paste an interesting article to begin your personalized practice!
        </p>
        <button class="btn blue" data-a="studio-tab" data-v="import">
          ${uiIcon("upload")} Import Your First Story
        </button>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-header" style="margin-bottom:16px">
        <div>
          <div class="lab">${uiIcon("practice")} Saved Materials</div>
          <h3 style="margin:2px 0">My Personal Reading Library (${myMaterials.length})</h3>
        </div>
        <button class="btn sm blue" data-a="studio-tab" data-v="import">
          ${uiIcon("add")} Import Another Story
        </button>
      </div>

      <div class="studio-materials-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:16px">
        ${myMaterials.map(mat => `
          <div class="card" style="margin:0;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--border)">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <span class="badge-diff diff-${mat.difficulty}">${mat.difficulty.toUpperCase()}</span>
                <span class="sub-sm">${mat.sourceType?.toUpperCase() || 'IMPORT'}</span>
              </div>
              <h4 style="margin:0 0 6px 0;font-size:1.05rem">${escapeHTML(mat.title)}</h4>
              <p class="sub-sm" style="margin:0 0 10px 0;line-height:1.4">
                ${escapeHTML(mat.text.slice(0, 110))}…
              </p>
              <div class="sub-sm" style="color:var(--sub);margin-bottom:12px">
                <b>${mat.wordCount || 0}</b> words · <b>${mat.questions?.length || 0}</b> questions · <b>${mat.vocabulary?.length || 0}</b> flashcards
              </div>
            </div>

            <div style="display:flex;gap:8px;border-top:1px solid var(--border);padding-top:10px">
              <button class="btn sm blue" data-a="studio-launch-saved" data-v="${escapeHTML(mat.id)}" style="flex:1">
                ${uiIcon("practice")} Practice Now
              </button>
              <button class="btn sm o" data-a="studio-delete" data-v="${escapeHTML(mat.id)}" title="Delete material" aria-label="Delete material">
                ${uiIcon("trash")}
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Handles file selection and text extraction in My Reading Studio.
 * @param {HTMLInputElement} input 
 */
async function handleStudioFileSelected(input) {
  const file = input?.files?.[0];
  if (!file) return;

  STUDIO_WARNING = "";
  STUDIO_IS_LOADING = true;
  renderApp();

  try {
    const res = await extractTextFromFile(file);
    if (!res.success) {
      STUDIO_WARNING = res.error || "Could not extract text from this file.";
    } else {
      STUDIO_EXTRACTED_TEXT = res.text;
      STUDIO_TITLE = res.stats.cleanTitle || file.name.replace(/\.[^/.]+$/, "");
      STUDIO_DIFF = res.stats.suggestedTier || "medium";
      if (res.isScannedOrEmpty && res.error) {
        STUDIO_WARNING = res.error;
      }
    }
  } catch (err) {
    STUDIO_WARNING = err.message || "Failed to read the document.";
  } finally {
    STUDIO_IS_LOADING = false;
    renderApp();
  }
}

/**
 * Generates questions & vocabulary, saves material, and launches practice.
 */
async function handleStudioGenerateAndStart() {
  const titleInput = $("#studio-title-input");
  const textInput = $("#studio-text-input");
  const langSelect = $("#studio-lang-select");
  const diffSelect = $("#studio-diff-select");

  const title = (titleInput?.value || STUDIO_TITLE || "Imported Story").trim();
  const text = (textInput?.value || STUDIO_EXTRACTED_TEXT || "").trim();
  const language = langSelect?.value || STUDIO_LANG || "en";
  const difficulty = diffSelect?.value || STUDIO_DIFF || "medium";

  if (!text || text.length < 30) {
    showToast("Please provide a reading passage of at least 20 words.", "warn");
    return;
  }

  STUDIO_IS_LOADING = true;
  showToast("Wisyo AI is generating your practice questions...", "info");
  renderApp();

  try {
    const generated = await generateWisyoPractice(text, {
      count: STUDIO_Q_COUNT,
      difficulty,
      language
    });

    const actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "guest", role: "guest" };
    
    // Save material to personal library
    const saved = await saveMaterial({
      title,
      author: "My Imported Story",
      text,
      language,
      difficulty,
      sourceType: "studio",
      status: "personal",
      visibility: "private",
      questions: generated.questions,
      vocabulary: generated.vocabulary
    }, actor);

    // Save generated vocabulary flashcards to deck
    if (Array.isArray(generated.vocabulary) && generated.vocabulary.length > 0 && typeof addFlashcardToDeck === "function") {
      generated.vocabulary.forEach(card => {
        addFlashcardToDeck({
          word: card.word,
          definition: card.definition,
          filipino: card.filipino,
          bisaya: card.bisaya,
          example: card.example,
          passageId: saved.id
        });
      });
    }

    STUDIO_IS_LOADING = false;

    // Launch Heart-Free Studio Practice Quiz
    const passageObj = {
      id: saved.id,
      t: saved.title,
      diff: saved.difficulty,
      lang: saved.language,
      x: saved.text,
      qs: saved.questions
    };

    startQuiz([passageObj], "studio", `My Studio: ${saved.title}`);
  } catch (err) {
    STUDIO_IS_LOADING = false;
    showToast(`Generation failed: ${err.message}`, "warn");
    renderApp();
  }
}


/* === src/pages/teacher-reading-studio.js === */
/* One teacher reading-content workflow: Add passage, approval, and assignments. */
const LEGACY_MATERIAL_LINKS_KEY = "basa_wisyo_legacy_material_links_v1";
let TEACHER_STUDIO_SUBTAB = "queue";

function readLegacyMaterialLinks() {
  try {
    const links = JSON.parse(localStorage.getItem(LEGACY_MATERIAL_LINKS_KEY) || "{}");
    return links && typeof links === "object" && !Array.isArray(links) ? links : {};
  }
  catch (error) { return {}; }
}

function linkLegacyMaterialToPassage(materialId, passageId) {
  try {
    const links = readLegacyMaterialLinks();
    links[materialId] = passageId;
    localStorage.setItem(LEGACY_MATERIAL_LINKS_KEY, JSON.stringify(links));
  } catch (error) { console.warn("Legacy material link could not be saved.", error); }
}

function legacyTeacherMaterials(actorId) {
  return (typeof readLocalMaterials === "function" ? readLocalMaterials() : [])
    .filter(material => material?.sourceType === "teacher_studio" && material.ownerId === actorId);
}

function legacyMaterialPassage(material) {
  const status = ["draft", "pending", "rejected", "published"].includes(material.status)
    ? material.status : "pending";
  const questions = Array.isArray(material.questions) ? material.questions.map(question => ({
    q: question?.q, o: question?.o, a: question?.a,
    k: question?.k || "Literal", exp: question?.exp || undefined
  })) : [];
  return normalizePassage({
    id: material.id, t: material.title, x: material.text, diff: material.difficulty,
    lang: { en: "en-US", fil: "fil-PH", ceb: "ceb-PH" }[material.language] || "en-US",
    qs: questions, status, ownerId: material.ownerId,
    author: material.author || material.ownerName || "Teacher",
    reviewNote: material.reviewNote || undefined
  });
}

function migrateLegacyTeacherMaterials() {
  const actor = AUTH.currentUser;
  if (actor?.role !== "teacher") return 0;
  const links = readLegacyMaterialLinks();
  const existing = new Set(AUTH.customPassages.map(passage => passage?.id));
  const migrated = [];
  for (const material of legacyTeacherMaterials(actor.id)) {
    if (existing.has(material.id) || links[material.id]) continue;
    try {
      const passage = legacyMaterialPassage(material);
      migrated.push(passage);
      existing.add(passage.id);
    } catch (error) {
      // Incomplete drafts remain visible below so their author can finish them.
    }
  }
  if (!migrated.length) return 0;
  try {
    AUTH.persistPractices([...AUTH.customPassages, ...migrated]);
    migrated.forEach(passage => linkLegacyMaterialToPassage(passage.id, passage.id));
    return migrated.length;
  } catch (error) {
    console.warn("Legacy materials were kept in their original store.", error);
    return 0;
  }
}

/**
 * Renders Teacher Reading Studio view.
 * @returns {string} HTML markup
 */
function viewTeacherReadingStudio() {
  const teacher = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  if (!teacher || (teacher.role !== "teacher" && teacher.role !== "admin")) {
    return `<div class="card"><p>Access restricted to Teachers and Administrators. Please sign in with an authorized account.</p></div>`;
  }

  return `
    <div class="teacher-reading-studio-page">
      <div class="subnav-segmented" role="tablist" aria-label="Materials section switcher">
        <button class="subnav-tab active" data-a="tab" data-v="teacher-studio">
          ${uiIcon("studio")} <span>Teacher Reading Studio</span>
        </button>
        <button class="subnav-tab" data-a="tab" data-v="practice">
          ${uiIcon("practice")} <span>Passage Library</span>
        </button>
      </div>

      <!-- Studio Intro -->
      <div class="dashboard-intro">
        <div>
          <div class="lab" style="color:var(--teal-ink)">${uiIcon("teacher")} Teacher Workspace</div>
          <h2>Teacher Reading Studio</h2>
          <p class="sub">Create passages in one editor, track admin approval, and manage class assignments.</p>
        </div>
        <div class="dashboard-intro-actions">
          <button class="btn sm blue" data-a="practice-new">
            ${uiIcon("add")} Add passage
          </button>
          <button class="btn sm ${TEACHER_STUDIO_SUBTAB === 'queue' ? 'blue' : 'o'}" data-a="tstudio-subtab" data-v="queue">
            ${uiIcon("badge")} Approval Status
          </button>
          <button class="btn sm ${TEACHER_STUDIO_SUBTAB === 'assignments' ? 'blue' : 'o'}" data-a="tstudio-subtab" data-v="assignments">
            ${uiIcon("classroom")} Class Assignments
          </button>
        </div>
      </div>

      <!-- Local Prototype Transparency Advisory -->
      <div class="card" style="background:var(--sky-soft);border-left:4px solid var(--sky);margin-bottom:18px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:1.25rem;line-height:1">ℹ️</span>
          <div>
            <b style="color:var(--sky-ink);font-size:0.9rem">Local-First School Prototype</b>
            <div class="sub-sm" style="margin-top:2px">
              Materials and assignments are saved locally in this browser. To distribute an assignment to student devices without a live network server, use the <b>Export Content Package</b> feature.
            </div>
          </div>
        </div>
      </div>

      ${TEACHER_STUDIO_SUBTAB === "assignments"
        ? renderTeacherAssignmentsView()
        : renderTeacherApprovalQueueView()}
    </div>
  `;
}

/**
 * Renders the approval status queue for teacher materials.
 * @returns {string} HTML markup
 */
function renderTeacherApprovalQueueView() {
  const teacher = AUTH.currentUser;
  const passages = AUTH.customPassages.flatMap(raw => {
    try { return [normalizePassage(raw)]; }
    catch (error) { return []; }
  }).filter(passage => passage.ownerId === teacher.id);
  const passageIds = new Set(passages.map(passage => passage.id));
  const links = readLegacyMaterialLinks();
  const incompleteLegacy = legacyTeacherMaterials(teacher.id)
    .filter(material => !passageIds.has(material.id) && !links[material.id]);

  return `
    <div class="card">
      <div class="card-header" style="margin-bottom:16px">
        <div>
          <div class="lab">${uiIcon("badge")} Passage Lifecycle</div>
          <h3 style="margin:2px 0">Approval &amp; Publication Status</h3>
        </div>
      </div>
      ${passages.length ? `<div class="teacher-practice-list">
        ${passages.map(passage => `<article class="teacher-practice-row">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div><b>${escapeHTML(passage.t)}</b><div class="sub-sm">${escapeHTML(passage.diff)} · ${passage.qs.length} questions · ${wordCount(passage.x)} words</div></div>
            <span class="pill">${escapeHTML(passage.status)}</span>
          </div>
          ${passage.reviewNote ? `<p class="sub-sm">Admin note: ${escapeHTML(passage.reviewNote)}</p>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            ${["draft", "rejected"].includes(passage.status) ? `
              <button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(passage.id)}">Edit</button>
              <button class="btn o sm" data-a="practice-delete" data-v="${escapeHTML(passage.id)}">Delete</button>
            ` : ""}
            ${passage.status === "pending" ? `<button class="btn o sm" data-a="practice-withdraw" data-v="${escapeHTML(passage.id)}">Withdraw to edit</button>` : ""}
            ${passage.status === "published" ? `<button class="btn o sm" data-a="tstudio-assign-material" data-v="${escapeHTML(passage.id)}">Assign</button>` : ""}
          </div>
        </article>`).join("")}
      </div>` : `<p class="sub">No passages yet. Choose Add passage to create one.</p>`}
      ${incompleteLegacy.length ? `<section style="margin-top:20px" aria-label="Legacy materials needing review">
        <h4>Older materials needing completion</h4>
        <p class="sub-sm">These remain in their original browser storage. Complete them in Add passage; existing assignment packages remain available.</p>
        <div class="teacher-practice-list">
          ${incompleteLegacy.map(material => `<article class="teacher-practice-row">
            <b>${escapeHTML(material.title || "Untitled material")}</b>
            <div class="sub-sm">${Array.isArray(material.questions) ? material.questions.length : 0} questions · ${escapeHTML(material.status || "draft")}</div>
            <button class="btn o sm" data-a="tstudio-convert-legacy" data-v="${escapeHTML(material.id)}">Complete in Add passage</button>
          </article>`).join("")}
        </div>
      </section>` : ""}
    </div>
  `;
}

/**
 * Renders the Class Assignments management tab.
 * @returns {string} HTML markup
 */
function renderTeacherAssignmentsView() {
  const teacher = typeof AUTH !== "undefined" ? AUTH.currentUser : { id: "teacher", role: "teacher", section: "Grade 8 - Rizal" };
  const assignments = typeof listAssignments === "function" ? listAssignments({ role: "teacher", id: teacher?.id }) : [];
  const publishedPassages = getPublishedPassages();

  return `
    <div class="card">
      <div class="card-header" style="margin-bottom:16px">
        <div>
          <div class="lab">${uiIcon("classroom")} Distribution Hub</div>
          <h3 style="margin:2px 0">Classroom Reading Assignments</h3>
        </div>
        <div style="display:flex;gap:8px">
          <input type="file" id="tstudio-import-pkg-input" accept=".json" style="display:none" data-a="tstudio-import-pkg-change">
          <button class="btn sm o" data-a="tstudio-import-pkg-trigger">
            ${uiIcon("upload")} Import Package (.json)
          </button>
        </div>
      </div>

      <!-- New Assignment Quick Form -->
      <div class="card teacher-assignment-create-card" style="background:var(--bg);margin-bottom:20px;border:1px solid var(--border)">
        <h4 style="margin:0 0 10px 0">Create New Class Assignment</h4>
        <div class="teacher-assignment-form-grid">
          <label>
            <span class="lab">Select Published Passage</span>
            <select id="tstudio-assign-mat-select" class="auth-input">
              ${publishedPassages.map(passage => `
                <option value="${escapeHTML(passage.id)}">${escapeHTML(passage.t)} (${passage.qs.length} Qs · ${escapeHTML(passage.diff)})</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span class="lab">Class Section</span>
            <input type="text" id="tstudio-assign-section-input" class="auth-input" placeholder="e.g. Grade 8 - Rizal" value="${escapeHTML(teacher?.section || "Grade 8 - Rizal")}">
          </label>
          <label>
            <span class="lab">Due Date</span>
            <input type="date" id="tstudio-assign-due-input" class="auth-input" value="2026-11-30">
          </label>
          <label>
            <span class="lab">Mode</span>
            <select id="tstudio-assign-mode-select" class="auth-input">
              <option value="practice">Practice Mode</option>
              <option value="assessment">Formal Assessment</option>
            </select>
          </label>
          <button type="button" class="btn blue teacher-assign-btn" data-a="tstudio-create-assignment-action" style="padding:10px 16px">
            Assign to Class
          </button>
        </div>
      </div>

      <!-- Active Assignments: Desktop Table & Mobile Cards -->
      ${assignments.length === 0 ? `
        <p class="sub" style="text-align:center;padding:20px">No active assignments yet. Create one above to assign reading materials to your students.</p>
      ` : `
        <!-- Desktop Table View -->
        <div class="desktop-assignments-table table-responsive" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table class="table" style="width:100%;min-width:620px">
            <thead>
              <tr>
                <th>Assignment Title</th>
                <th>Class Section</th>
                <th>Due Date</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${assignments.map(a => `
                <tr>
                  <td><b>${escapeHTML(a.title)}</b></td>
                  <td>${escapeHTML(a.targetGroup || a.section || "General")}</td>
                  <td>${escapeHTML(a.dueDate || "Flexible")}</td>
                  <td><span class="pill ${a.mode === 'assessment' ? 'warn' : 'ok'}">${escapeHTML(a.mode || 'practice').toUpperCase()}</span></td>
                  <td><span class="pill blue">${escapeHTML(a.status || 'active').toUpperCase()}</span></td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn sm o" data-a="tstudio-export-pkg" data-v="${escapeHTML(a.id)}" title="Export content package for student devices">
                        ${uiIcon("download")} Export Package
                      </button>
                      <button class="btn sm o" data-a="tstudio-delete-assignment" data-v="${escapeHTML(a.id)}" title="Remove assignment">
                        ${uiIcon("trash")}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Mobile Stacked Card View -->
        <div class="mobile-assignments-list">
          ${assignments.map(a => `
            <div class="card assignment-mobile-card" style="margin:0 0 12px 0;padding:14px;border:1px solid var(--border);background:var(--card-bg)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
                <b style="font-size:0.95rem;color:var(--text)">${escapeHTML(a.title)}</b>
                <span class="pill ${a.mode === 'assessment' ? 'warn' : 'ok'}">${escapeHTML(a.mode || 'practice').toUpperCase()}</span>
              </div>
              <div class="sub-sm" style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;color:var(--sub)">
                <div><b>Section:</b> ${escapeHTML(a.targetGroup || a.section || "General")}</div>
                <div><b>Due:</b> ${escapeHTML(a.dueDate || "Flexible")}</div>
                <div><b>Status:</b> <span class="pill blue" style="font-size:0.75rem">${escapeHTML(a.status || 'active').toUpperCase()}</span></div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn sm o" data-a="tstudio-export-pkg" data-v="${escapeHTML(a.id)}" style="flex:1;min-height:44px;justify-content:center">
                  ${uiIcon("download")} Export
                </button>
                <button class="btn sm o" data-a="tstudio-delete-assignment" data-v="${escapeHTML(a.id)}" style="flex:1;min-height:44px;justify-content:center;color:var(--coral)">
                  ${uiIcon("trash")} Remove
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>
  `;
}
