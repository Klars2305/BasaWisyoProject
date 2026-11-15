/* Wisyo: online GroqCloud help and passage-focused offline fallback. */
let CHAT_HISTORY = [];
let WISYO_MODE = "offline";
let WISYO_ONLINE_AVAILABLE = false;
let WISYO_PROVIDER = "GroqCloud";
let WISYO_BUSY = false;
let WISYO_REQUEST_ID = 0;
let WISYO_STATUS_CHECKED = false;
let WISYO_STATUS_PENDING = null;
let WISYO_RETRY_AT = 0;
let WISYO_OFFLINE_REASON = "";

function wisyoReadingContext() {
  const quiz = ACTIVE_QUIZ;
  const step = quiz?.steps?.[quiz.idx];
  const recentMistake = S?.miss ? {
    q: String(S.miss.q || ""),
    question: String(S.miss.q || ""),
    ch: String(S.miss.ch || ""),
    chosenAnswer: String(S.miss.ch || ""),
    ok: String(S.miss.ok || ""),
    correctAnswer: String(S.miss.ok || ""),
    k: String(S.miss.k || "Comprehension"),
    skill: String(S.miss.k || "Comprehension"),
    exp: String(S.miss.exp || ""),
    explanation: String(S.miss.exp || "")
  } : null;

  if (!step?.P) {
    return recentMistake ? { recentMistake } : {};
  }

  const selectedAnswer = quiz.isAnswered && Number.isInteger(quiz.selectedChoice) && step.q?.o?.[quiz.selectedChoice]
    ? String(step.q.o[quiz.selectedChoice])
    : null;

  return {
    passage: {
      title: String(step.P.t || ""),
      text: String(step.P.x || "").slice(0, 8000),
      difficulty: String(step.P.diff || "medium")
    },
    question: step.q ? {
      text: String(step.q.q || ""),
      skill: String(step.q.k || "Comprehension"),
      options: Array.isArray(step.q.o) ? step.q.o.map(String) : [],
      answered: Boolean(quiz.isAnswered),
      selectedAnswer
    } : undefined,
    recentMistake
  };
}

function updateWisyoModeUI(message = "") {
  $("#ai-mode-tag").textContent = WISYO_MODE === "online" ? "Groq AI" : "Offline help";
  $("#ai-subtitle").textContent = WISYO_MODE === "online"
    ? `${WISYO_PROVIDER} can use the current passage and recent chat to help you read.`
    : "Passage tips and vocabulary stay in this browser.";
  $("#ai-mode-status").textContent = message || WISYO_OFFLINE_REASON || (WISYO_MODE === "online"
    ? `Groq is configured. Messages, the current passage, and recent chat are sent when you ask Wisyo.`
    : "Using offline help. Add a Groq key to the local server for automatic online answers.");
  const send = $("#ai-send-button");
  if (send) send.disabled = WISYO_BUSY;
}

async function checkWisyoOnlineStatus() {
  if (WISYO_STATUS_PENDING) return WISYO_STATUS_PENDING;
  WISYO_STATUS_PENDING = (async () => {
    try {
      const response = await fetch("/api/chat/status", { signal: AbortSignal.timeout(3000) });
      if (!response.ok) {
        WISYO_STATUS_CHECKED = true;
        WISYO_ONLINE_AVAILABLE = false;
        WISYO_MODE = "offline";
        WISYO_OFFLINE_REASON = "This page is not using the BasaWisyo AI server. Open it with backend/start-basa.ps1 to use Groq.";
        WISYO_RETRY_AT = Date.now() + 30000;
        updateWisyoModeUI();
        return;
      }
      const status = await response.json();
      WISYO_ONLINE_AVAILABLE = status?.onlineAvailable === true && status?.provider === "GroqCloud";
      if (WISYO_ONLINE_AVAILABLE) WISYO_PROVIDER = "GroqCloud";
      WISYO_STATUS_CHECKED = true;
      if (!WISYO_ONLINE_AVAILABLE) {
        WISYO_MODE = "offline";
        WISYO_OFFLINE_REASON = "Groq key is not loaded. Check backend/.env.local, then restart the BasaWisyo server.";
        WISYO_RETRY_AT = Date.now() + 30000;
      } else if (Date.now() >= WISYO_RETRY_AT) {
        WISYO_MODE = "online";
        WISYO_OFFLINE_REASON = "";
      }
    } catch (error) {
      WISYO_STATUS_CHECKED = true;
      WISYO_ONLINE_AVAILABLE = false;
      WISYO_MODE = "offline";
      WISYO_OFFLINE_REASON = "BasaWisyo AI server is unavailable. Start it with backend/start-basa.ps1; offline help is available.";
      WISYO_RETRY_AT = Date.now() + 30000;
    }
    updateWisyoModeUI();
  })().finally(() => { WISYO_STATUS_PENDING = null; });
  return WISYO_STATUS_PENDING;
}

function aiOpen(defaultPrompt) {
  const dialog = $("#ai");
  if (dialog.hidden) dialog._returnFocus = document.activeElement;
  dialog.hidden = false;
  setTimeout(() => $("#aii").focus(), 80);
  if (!CHAT_HISTORY.length) {
    CHAT_HISTORY.push(["a", "Mabuhay! I'm Wisyo. Ask about reading, a word, or your current passage. I use Groq when it is available and switch to offline help when it is not."]);
  }
  renderChat();
  updateWisyoModeUI();
  const statusCheck = checkWisyoOnlineStatus();
  if (defaultPrompt) statusCheck.then(() => aiSend(defaultPrompt));
}

function renderChat() {
  const container = $("#aim");
  container.innerHTML = CHAT_HISTORY.map(([role, message]) => {
    const isUser = role === "u";
    return `<div class="msg-row ${isUser ? "u" : "a"}">
      ${isUser ? "" : `<div class="msg-avatar"><img src="${LG}" alt="Wisyo" class="mascot-img"></div>`}
      <div class="msg-body ${isUser ? "u" : "a"}">
        ${message === "…"
          ? '<div class="wisyo-replying" role="status" aria-live="polite"><span class="wisyo-replying-text">Wisyo is replying…</span> <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></div>'
          : formatChatText(message)}
      </div>
    </div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

function formatChatText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br>");
}

const WISYO_STOP_WORDS = new Set(
  "a an and ang are as at ba did does for from he her his how i in iyang is it kay kung mga mo na ng nga ni of on or sa she siya sila the this to unsa what when where which who why with you".split(" ")
);

function wisyoWords(text) {
  return (String(text || "").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter(word => word.length > 2 && !WISYO_STOP_WORDS.has(word));
}

function wisyoSentences(text) {
  return String(text || "").match(/[^.!?]+[.!?]+(?:[”"']|$)?|[^.!?]+$/g)
    ?.map(part => part.trim()).filter(Boolean) || [];
}

function wisyoEvidence(text, query) {
  const terms = [...new Set(wisyoWords(query))];
  if (!terms.length) return null;
  const ranked = wisyoSentences(text).map((sentence, index) => {
    const words = new Set(wisyoWords(sentence));
    return { sentence, index, score: terms.filter(term => words.has(term)).length };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.score > 0 ? ranked[0] : null;
}

function wisyoLanguage(query) {
  if (/\b(unsa|ngano|tabang|pasabot|palihug|hatagi|saon|akong)\b/i.test(query)) return "ceb";
  if (/\b(ano|bakit|paano|kahulugan|tulong|pakisabi|buod)\b/i.test(query)) return "fil";
  return "en";
}

function wisyoVocabularyWord(query) {
  const request = query.match(/(?:what does|meaning of|define|definition of|unsa(?:y| ang)? pasabot(?: sa)?|ano(?:ng| ang)? kahulugan(?: ng)?|ibig sabihin(?: ng)?)\s+["“']?([\p{L}-]+)/iu);
  if (request) return request[1].toLocaleLowerCase();
  const words = wisyoWords(query);
  return words.length === 1 && Object.hasOwn(D, words[0]) ? words[0] : null;
}

function wisyoHint(question, passage, language) {
  const evidence = passage && wisyoEvidence(passage.text, question.text);
  const place = evidence ? `sentence ${evidence.index + 1}` : "the passage";
  const skill = String(question.skill || "");
  let strategy;
  if (/inferen/i.test(skill)) {
    strategy = "Connect the clue with what the character does or feels.";
  } else if (/main idea/i.test(skill)) {
    strategy = "Look for an idea that fits the whole passage, not just one detail.";
  } else if (/vocab/i.test(skill)) {
    strategy = `Reread ${place} and notice how the surrounding words give context to the word.`;
  } else if (/sequenc/i.test(skill)) {
    strategy = `Look for chronological order clues (first, then, next, after) around ${place}.`;
  } else {
    strategy = `Reread ${place} and compare its details with the choices.`;
  }
  const caution = language === "ceb" ? "Dili pa nako ihatag ang tubag hangtod makapili ka."
    : language === "fil" ? "Hindi ko muna ibibigay ang sagot bago ka pumili."
      : "I won't reveal the answer before you choose.";
  return `**Hint for “${question.text}”:** ${strategy} ${caution}`;
}

function offlineWisyoResponse(input, context = wisyoReadingContext()) {
  const query = String(input || "").trim().toLocaleLowerCase();
  const passage = context?.passage;
  const question = context?.question;
  const language = wisyoLanguage(query);

  if (/mistake|sayop|mali|wrong answer|explain why|why was/i.test(query)) {
    const miss = context?.recentMistake || S.miss;
    const qText = miss?.q || miss?.question;
    const okText = miss?.ok || miss?.correctAnswer;
    const chText = miss?.ch || miss?.chosenAnswer;
    const expText = miss?.exp || miss?.explanation || "Reread the passage for the supporting line.";
    if (qText && okText && !(question && !question.answered && question.text === qText)) {
      const chosenStr = chText ? `you chose “${chText}”. ` : "";
      return `For “${qText}”, ${chosenStr}The correct choice was “${okText}”. ${expText} Keep going—analyzing mistakes is the fastest way to build reading comprehension!`;
    }
    return "I don't have a recent incorrect answer to explain. Ask me after answering a quiz question.";
  }

  if (/quiz me|test me|quick check|practice check|follow up|follow-up/i.test(query)) {
    if (passage && passage.text) {
      const sentences = wisyoSentences(passage.text);
      if (sentences.length) {
        const sentence = sentences[Math.min(1, sentences.length - 1)];
        return `**Quick Practice Check for “${passage.title}”:**\nIn your own words, what is happening in this sentence: “${sentence}”? Try to identify the key subject and action!`;
      }
    }
    return "Open any story in the Reading Library, and I can give you quick comprehension checks and reading tips!";
  }

  const word = wisyoVocabularyWord(query);
  if (word) {
    if (Object.hasOwn(D, word)) {
      const [filipino, bisaya, english] = D[word];
      return `**${word}** — Filipino: ${filipino}; Bisaya: ${bisaya}; English: ${english}`;
    }
    const occurrence = passage && wisyoEvidence(passage.text, word);
    return occurrence
      ? `I don't have a verified offline definition for “${word}”. Read it in context: “${occurrence.sentence}”`
      : `I don't have a verified offline definition for “${word}”. Try another word from the passage.`;
  }

  if (question && !question.answered) {
    return wisyoHint(question, passage, language);
  }

  if (passage && /summar|buod|lagom|tungkol saan|about this passage|main idea of (the|this) (passage|story|text)/i.test(query)) {
    const sentences = wisyoSentences(passage.text);
    if (!sentences.length) return "This passage has no text to summarize.";
    const selected = sentences.length < 3 ? sentences : [sentences[0], sentences[sentences.length - 1]];
    const label = language === "ceb" ? "Mubo nga recap gikan sa passage"
      : language === "fil" ? "Maikling buod mula sa passage" : "Brief recap from the passage";
    return `**${label} “${passage.title}”:** ${selected.join(" ")}\n\nThese are lines from the passage; they may leave out details between them.`;
  }

  if (/literal|inferential|inference|critical reading|main idea/i.test(query) &&
      /difference|skill|mean|unsa|ano|explain|what is/i.test(query)) {
    return "**Literal** asks for facts stated in the passage. **Inference** combines clues with reasoning. **Critical reading** evaluates a claim and its evidence. **Main idea** is what the whole passage is mostly about.";
  }

  if (/phil-iri|reading exam|reading test/i.test(query) && /prepar|tips|study|unsaon|paano|how/i.test(query)) {
    return "Read the passage once for the main idea, then reread the lines related to each question. For literal questions, find a stated fact; for inference, connect two clues. Practice at a comfortable level and ask your teacher about your results. This is study advice, not an official Phil-IRI score.";
  }

  if (/bugtong|riddle/i.test(query)) {
    if (/answer|sagot|tubag/i.test(query)) return "Ang sagot sa bugtong ay **libro** (book): it has pages you can read but no tongue to speak.";
    return "**Bugtong:** May dahon, walang sanga; may salita, walang dila. Ano ito? Try to solve it before asking for the answer. (Clue: you can read it.)";
  }

  if (question && /hint|clue|tabang|help|unsaon|how|answer/i.test(query)) {
    return `Reread “${question.text}” and look for a matching sentence in the passage. If you missed it, ask me to explain your last mistake.`;
  }

  if (passage && /^(who|what|when|where|why|how|can you explain|tell me|kinsa|unsa|kanus|asa|ngano|giunsa|sino|ano|kailan|saan|bakit|paano)\b|\b(evidence|prove|support|ebidensya|patunay)\b/i.test(query)) {
    const evidence = wisyoEvidence(passage.text, query);
    if (evidence) {
      const label = language === "ceb" ? "Nakita nako sa passage" : language === "fil" ? "Nakita ko sa passage" : "Passage evidence";
      return `**${label}, sentence ${evidence.index + 1}:** “${evidence.sentence}”\n\nCheck whether this line answers your question. I can't confirm an answer beyond what the passage says.`;
    }
    return "I couldn't find a supporting line in this passage. Try asking with a name or phrase from the text.";
  }

  if (passage) {
    return `I can help offline with vocabulary, passage evidence, a short recap, or a quiz hint for “${passage.title}”. Ask about a word or a detail in the text.`;
  }
  return "Offline help covers reading skills and the built-in vocabulary. Open a passage for specific hints or evidence.";
}

async function aiSend(userText) {
  const clean = String(userText || "").trim();
  if (!clean || WISYO_BUSY) return;
  if (clean.length > 1500) {
    showToast("Ask Wisyo using 1,500 characters or fewer.");
    return;
  }
  const previous = CHAT_HISTORY.slice(1).filter(([, message]) => message !== "…")
    .slice(-8).map(([role, text]) => ({ role: role === "u" ? "user" : "assistant", text: text.slice(0, 1500) }));
  const context = wisyoReadingContext();
  CHAT_HISTORY.push(["u", clean], ["a", "…"]);
  const replyIndex = CHAT_HISTORY.length - 1;
  const requestId = ++WISYO_REQUEST_ID;
  WISYO_BUSY = true;
  updateWisyoModeUI();
  renderChat();
  let failureStatus = "";
  try {
    if (!WISYO_STATUS_CHECKED || (WISYO_MODE === "offline" && Date.now() >= WISYO_RETRY_AT)) {
      await checkWisyoOnlineStatus();
    }
    let reply;
    if (WISYO_MODE === "online") {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history: previous, context }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== "string") {
        const failure = new Error(result.error || "Groq did not respond.");
        failure.status = response.status;
        throw failure;
      }
      reply = result.reply;
    } else {
      reply = offlineWisyoResponse(clean, context);
    }
    if (requestId === WISYO_REQUEST_ID) CHAT_HISTORY[replyIndex] = ["a", reply];
  } catch (error) {
    if (requestId === WISYO_REQUEST_ID) {
      WISYO_MODE = "offline";
      WISYO_RETRY_AT = Date.now() + (error.status === 401 || error.status === 403 ? 300000 : 60000);
      CHAT_HISTORY[replyIndex] = ["a", `Groq is unavailable. Here's offline help:\n\n${offlineWisyoResponse(clean, context)}`];
      failureStatus = error.status === 429
        ? "Groq free limit reached. Using offline help; Wisyo will retry automatically."
        : /rejected the API key/.test(error.message || "")
          ? "Groq rejected the key. Update backend/.env.local and restart the server."
          : "Could not reach Groq. Using offline help; Wisyo will retry automatically.";
      WISYO_OFFLINE_REASON = failureStatus;
    }
  } finally {
    if (requestId === WISYO_REQUEST_ID) {
      WISYO_BUSY = false;
      updateWisyoModeUI(failureStatus);
      renderChat();
    }
  }
}
