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
