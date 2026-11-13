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

const tapMarkup = text => {
  return text.replace(/[A-Za-zâ€™'-]+/g, w => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, "");
    if (D[clean]) {
      return `<b class="w" data-a="tip" data-v="${clean}">${w}</b>`;
    }
    return w;
  });
};

// Navigation icons
