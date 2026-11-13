/* Wisyo's practice helper stays on this device. Its fallback drafts literal
   fill-in-the-blank questions from the author's own passage. */
function offlinePracticeSuggestions(text, count) {
  const source = String(text || "").trim();
  const words = [...source.matchAll(/[\p{L}][\p{L}'’-]*/gu)]
    .filter(match => match[0].length >= 4);
  const distinct = [...new Set(words.map(match => match[0].toLocaleLowerCase()))];
  if (distinct.length < Math.max(4, count)) {
    throw new Error(`Wisyo needs more varied passage text to draft ${count} question${count === 1 ? "" : "s"}. Add more text or write questions manually.`);
  }
  const chosen = [];
  const used = new Set();
  for (const match of words) {
    const key = match[0].toLocaleLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    chosen.push(match);
    if (chosen.length === count) break;
  }
  return chosen.map((match, index) => {
    const answer = match[0];
    const start = Math.max(0, match.index - 65);
    const end = Math.min(source.length, match.index + answer.length + 65);
    const excerpt = `${start ? "…" : ""}${source.slice(start, match.index)}____${source.slice(match.index + answer.length, end)}${end < source.length ? "…" : ""}`;
    const otherWords = distinct.filter(word => word !== answer.toLocaleLowerCase());
    const distractors = [0, 1, 2].map(offset => otherWords[(index * 3 + offset) % otherWords.length]);
    const correctAt = index % 4;
    const options = [...distractors];
    options.splice(correctAt, 0, answer);
    return {
      q: `Which word completes this excerpt from the passage? “${excerpt}”`,
      o: options,
      a: correctAt,
      k: "Literal"
    };
  });
}

async function wisyoPracticeSuggestions(text, count, diff) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Add passage text before asking Wisyo for questions.");
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Choose between 1 and 20 questions.");
  }
  if (window.ai?.languageModel?.create) {
    let session;
    try {
      session = await window.ai.languageModel.create({
        systemPrompt: "You help teachers write reading comprehension questions. Return only a JSON array, with no markdown or explanation. Every question must be answerable from the supplied passage."
      });
      const response = await session.prompt(`Draft exactly ${count} varied comprehension questions for a ${diff} reading passage. Each item must be an object with q (question, up to 500 characters), o (exactly 4 distinct answer strings), a (zero-based index of the correct option), and k (one of Literal, Inference, Critical reading, Main idea). Passage:\n${source.slice(0, 12000)}`);
      const raw = String(response || "");
      const opening = raw.indexOf("[");
      const closing = raw.lastIndexOf("]");
      const proposed = JSON.parse(raw.slice(opening, closing + 1));
      if (!Array.isArray(proposed) || proposed.length !== count
          || proposed.some(item => !Array.isArray(item.o) || item.o.length !== 4
            || new Set(item.o.map(option => String(option).trim().toLocaleLowerCase())).size !== 4)) {
        throw new Error("Model returned incomplete questions.");
      }
      const normalized = normalizePassage({ id: "wisyo_suggestions", t: "Suggestions", x: source, diff, qs: proposed });
      return { questions: normalized.qs, source: "on-device model" };
    } catch (error) {
      // A missing or unsuitable local model falls back to transparent text-based drafts.
    } finally {
      try { session?.destroy?.(); } catch (error) { /* Session cleanup is optional. */ }
    }
  }
  return { questions: offlinePracticeSuggestions(source, count), source: "offline text helper" };
}
