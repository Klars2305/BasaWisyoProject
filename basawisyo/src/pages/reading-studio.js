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
