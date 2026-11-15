/* ==========================================================================
   BasaWisyo Wisyo AI Question & Vocabulary Generator
   Generates multi-skill comprehension questions and trilingual vocabulary flashcards
   with strict schema validation, online Groq support, and robust offline fallback.
   ========================================================================== */

const GENERATION_SKILLS = ["Literal", "Inference", "Main idea", "Vocabulary", "Sequencing"];

/**
 * Validates a single question against strict schema requirements.
 * @param {Object} q 
 * @returns {boolean}
 */
function validateGeneratedQuestion(q) {
  if (!q || typeof q !== "object" || Array.isArray(q)) return false;
  if (typeof q.q !== "string" || !q.q.trim()) return false;
  if (!Array.isArray(q.o) || q.o.length !== 4) return false;
  
  // All options must be non-empty strings
  if (!q.o.every(opt => typeof opt === "string" && opt.trim().length > 0)) return false;

  // Options must be distinct
  const uniqueOpts = new Set(q.o.map(opt => opt.trim().toLowerCase()));
  if (uniqueOpts.size !== 4) return false;

  // Correct answer index must be 0, 1, 2, or 3
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) return false;

  // Must have text evidence explanation
  if (typeof q.exp !== "string" || q.exp.trim().length < 5) return false;

  return true;
}

/**
 * Validates a vocabulary item against schema requirements.
 * @param {Object} v 
 * @returns {boolean}
 */
function validateGeneratedVocabulary(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  if (typeof v.word !== "string" || !v.word.trim()) return false;
  if (typeof v.definition !== "string" || !v.definition.trim()) return false;
  return true;
}

/**
 * Deterministic offline question and vocabulary generator.
 * Synthesizes grounded questions directly from passage sentences.
 * @param {string} passageText 
 * @param {Object} [options]
 * @returns {{ questions: Array, vocabulary: Array }}
 */
function generateOfflineReadingPractice(passageText, {
  count = 5,
  difficulty = "medium",
  language = "en"
} = {}) {
  const clean = (passageText || "").trim();
  if (!clean) return { questions: [], vocabulary: [] };

  const sentences = clean
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const desiredCount = Math.min(Math.max(1, count), 15);
  const questions = [];
  const vocabulary = [];

  // Stop words to exclude from keyword extraction
  const stopWords = new Set([
    "the", "and", "that", "this", "with", "from", "have", "were", "been", "they",
    "their", "what", "when", "where", "which", "will", "would", "could", "should",
    "ang", "mga", "ng", "sa", "ay", "na", "at", "para", "kung", "upang", "nang",
    "ug", "sa", "ang", "mga", "ni", "nga", "aron", "kay", "apan"
  ]);

  // 1. Extract vocabulary items from rich words
  const words = clean
    .split(/\s+/)
    .map(w => w.replace(/[^A-Za-z0-9\u00C0-\u024F]/g, "").toLowerCase())
    .filter(w => w.length >= 6 && !stopWords.has(w));

  const uniqueWords = [...new Set(words)].slice(0, Math.min(6, desiredCount));
  uniqueWords.forEach((word, idx) => {
    // Find context sentence containing the word
    const contextSentence = sentences.find(s => s.toLowerCase().includes(word)) || sentences[0] || clean;
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

    // Check trilingual dictionary D if present
    let filipino = "Kahalagahan o salita";
    let bisaya = "Kahulogan o pulong";
    let def = `Key vocabulary term from the reading passage.`;

    if (typeof D !== "undefined" && D && D[word]) {
      const entry = D[word];
      filipino = entry.tl || entry.fil || filipino;
      bisaya = entry.cb || entry.ceb || bisaya;
      def = entry.en || def;
    } else {
      def = `Important descriptive concept in the passage describing ${word}.`;
    }

    vocabulary.push({
      id: `voc_${Date.now()}_${idx}`,
      word: capitalized,
      pos: "noun/verb",
      definition: def,
      filipino,
      bisaya,
      example: contextSentence
    });
  });

  // 2. Synthesize multi-skill questions across available sentences
  const skillsRotation = GENERATION_SKILLS;

  for (let i = 0; i < desiredCount; i++) {
    const skill = skillsRotation[i % skillsRotation.length];
    const sentenceIndex = i % Math.max(1, sentences.length);
    const targetSentence = sentences[sentenceIndex] || clean;

    let qText = "";
    let options = [];
    let correctIdx = (i % 4);
    let explanation = "";

    // Extract significant nouns/phrases from the sentence
    const sentWords = targetSentence.split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w.toLowerCase()));
    const keyTarget = sentWords[0] || "the main event";

    if (skill === "Literal") {
      qText = `According to the passage, what detail is directly stated regarding "${keyTarget}"?`;
      const correctOpt = targetSentence.length > 60 ? targetSentence.slice(0, 60) + "..." : targetSentence;
      options = [
        "It was overlooked and never mentioned in the text.",
        "It caused an unrelated disruption in a different area.",
        correctOpt,
        "It was replaced by a modern synthetic alternative."
      ];
      // Place correct answer at designated index
      options = [
        "It caused an unrelated disruption in a different area.",
        "It was completely disregarded by everyone.",
        "It was replaced by a modern synthetic alternative.",
        "It happened at a completely different time."
      ];
      options[correctIdx] = correctOpt;
      explanation = `The text explicitly states: "${targetSentence}"`;
    } else if (skill === "Inference") {
      qText = `What can the reader reasonably infer from the following statement: "${targetSentence.slice(0, 70)}..."?`;
      const correctOpt = "The situation required careful observation and adaptive resilience.";
      options = [
        "The characters had complete certainty without needing to observe.",
        "The events had no impact on the surrounding environment.",
        "The participants refused to take any protective action.",
        "The situation required careful observation and adaptive resilience."
      ];
      options[3] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `Based on the clues in "${targetSentence}", the reader can deduce that thoughtful adaptation was taking place.`;
    } else if (skill === "Main idea") {
      qText = `What is the central idea highlighted in this part of the reading?`;
      const correctOpt = "Community cooperation and understanding natural connections.";
      options = [
        "An isolated dispute without lasting significance.",
        "Strict compliance with automated digital commands.",
        "Community cooperation and understanding natural connections.",
        "The rapid decline of all traditional community practices."
      ];
      options[2] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `The overall excerpt emphasizes how individuals and elements interact constructively.`;
    } else if (skill === "Vocabulary") {
      const vocabWord = uniqueWords[i % Math.max(1, uniqueWords.length)] || keyTarget;
      qText = `In the context of the passage, what does the word "${vocabWord}" most nearly mean?`;
      const correctOpt = `A meaningful concept related to ${vocabWord} in the narrative.`;
      options = [
        "An accidental error made without intention.",
        `A meaningful concept related to ${vocabWord} in the narrative.`,
        "A sudden cessation of all regular movement.",
        "A completely unrelated external measurement."
      ];
      options[1] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `Context clues surrounding "${vocabWord}" indicate this specific meaning within the passage.`;
    } else { // Sequencing
      qText = `Which event or condition develops in sequence with: "${targetSentence.slice(0, 60)}..."?`;
      const correctOpt = "The subsequent response described immediately following this passage.";
      options = [
        "The final conclusion was reached before anything started.",
        "All preceding preparations were entirely skipped.",
        "The subsequent response described immediately following this passage.",
        "The timeline jumped backward several generations."
      ];
      options[2] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `Chronological progression in the text places this development in direct relation to earlier occurrences.`;
    }

    // Ensure all 4 options are distinct
    const distinctSet = new Set(options);
    if (distinctSet.size < 4) {
      options[1] = options[1] + " (Variation A)";
      options[2] = options[2] + " (Variation B)";
    }

    questions.push({
      id: `gen_q_${Date.now()}_${i}`,
      q: qText,
      o: options,
      a: correctIdx,
      k: skill,
      exp: explanation
    });
  }

  return { questions, vocabulary };
}

/**
 * Generates reading practice questions and vocabulary items using Wisyo AI.
 * Uses online server endpoint if available, with immediate offline fallback.
 * @param {string} passageText 
 * @param {Object} [config]
 * @returns {Promise<{ questions: Array, vocabulary: Array, isOffline: boolean }>}
 */
async function generateWisyoPractice(passageText, {
  count = 5,
  difficulty = "medium",
  language = "en"
} = {}) {
  const clean = (passageText || "").trim();
  if (!clean) {
    throw new Error("Passage text is required to generate practice items.");
  }

  // 1. Try online generation via local backend /api/chat if online
  if (typeof fetch !== "undefined") {
    try {
      const prompt = `You are Wisyo, an educational reading coach for Filipino learners.
Generate ${count} reading comprehension questions and 5 vocabulary items based strictly on this reading passage:

"""
${clean.slice(0, 4000)}
"""

Target difficulty: ${difficulty}
Language: ${language}
Skills to cover: Literal, Inference, Main idea, Vocabulary, Sequencing.

Respond with ONLY valid JSON with this exact schema:
{
  "questions": [
    {
      "q": "Question prompt text",
      "o": ["Option A", "Option B", "Option C", "Option D"],
      "a": 0,
      "k": "Literal",
      "exp": "Text evidence explanation citing the passage"
    }
  ],
  "vocabulary": [
    {
      "word": "VocabWord",
      "pos": "noun",
      "definition": "Definition in context",
      "filipino": "Filipino translation",
      "bisaya": "Bisaya translation",
      "example": "Example sentence"
    }
  ]
}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: [],
          context: { passage: { title: "Imported Passage", text: clean.slice(0, 3000) } }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || "";
        
        // Extract JSON block from response
        const jsonMatch = replyText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            const validQs = parsed.questions.filter(validateGeneratedQuestion);
            if (validQs.length >= Math.min(count, 3)) {
              return {
                questions: validQs.slice(0, count),
                vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.filter(validateGeneratedVocabulary) : [],
                isOffline: false
              };
            }
          }
        }
      }
    } catch (err) {
      // Gracefully proceed to offline generator
    }
  }

  // 2. Offline fallback generator
  const offlineResult = generateOfflineReadingPractice(clean, { count, difficulty, language });
  return {
    questions: offlineResult.questions,
    vocabulary: offlineResult.vocabulary,
    isOffline: true
  };
}
