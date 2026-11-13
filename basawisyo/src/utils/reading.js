/* Audio / Speech Synthesis Support */
const speak = text => {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.lang = "en-PH"; // Philippine English accent fallback
    window.speechSynthesis.speak(u);
  } catch(e) {}
};

// Word counter and tap-word markup generator
const wordCount = s => s.trim().split(/\s+/).filter(Boolean).length;

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const tapMarkup = text => {
  let markup = "";
  let lastIndex = 0;
  for (const match of text.matchAll(/[A-Za-z’'-]+/g)) {
    markup += escapeHTML(text.slice(lastIndex, match.index));
    const w = match[0];
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (D[clean]) {
      markup += `<b class="w" data-a="tip" data-v="${clean}">${escapeHTML(w)}</b>`;
    } else {
      markup += escapeHTML(w);
    }
    lastIndex = match.index + w.length;
  }
  return markup + escapeHTML(text.slice(lastIndex));
};

// Navigation icons
