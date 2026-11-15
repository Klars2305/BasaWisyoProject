/* ==========================================================================
   BasaWisyo - Vocabulary Flashcards Page (flashcards.js)
   Interactive 3D flip card UI with Leitner spaced repetition ratings.
   ========================================================================== */

let FLASHCARD_ACTIVE_INDEX = 0;
let FLASHCARD_IS_FLIPPED = false;
let FLASHCARD_ACTIVE_FILTER = "due"; // "due" | "all" | "mastered"
let FLASHCARD_SHOW_ADD_MODAL = false;

function viewFlashcards() {
  const stats = getFlashcardStats();
  const allCards = getFlashcardDeck();
  const dueCards = getDueFlashcards();
  const masteredCards = allCards.filter(c => (c.box || 1) >= 4);

  let activeCards = dueCards;
  if (FLASHCARD_ACTIVE_FILTER === "all") {
    activeCards = allCards;
  } else if (FLASHCARD_ACTIVE_FILTER === "mastered") {
    activeCards = masteredCards;
  }

  // Bound index safely
  if (FLASHCARD_ACTIVE_INDEX >= activeCards.length) {
    FLASHCARD_ACTIVE_INDEX = Math.max(0, activeCards.length - 1);
  }

  const currentCard = activeCards[FLASHCARD_ACTIVE_INDEX] || null;

  return `
    <div class="flashcards-page">
      <!-- Header -->
      <div class="fc-header-row">
        <div>
          <div class="lab" style="color:var(--gold)">Spaced Repetition &amp; Vocabulary</div>
          <h2>Vocabulary Flashcards</h2>
          <p class="sub">Culturally rooted Filipino vocabulary with trilingual translations, audio pronunciation, and Leitner spaced repetition.</p>
        </div>
        <button class="btn blue sm" data-a="fc-open-add">
          ${uiIcon("add")} Add New Word
        </button>
      </div>

      <!-- Stats Bar -->
      <div class="fc-stats-bar">
        <div class="fc-stat-item ${stats.due > 0 ? 'highlight' : ''}">
          <span class="fc-stat-label">Due Today</span>
          <span class="fc-stat-num">${stats.due}</span>
        </div>
        <div class="fc-stat-item">
          <span class="fc-stat-label">Mastered (Box 4+)</span>
          <span class="fc-stat-num">${stats.mastered}</span>
        </div>
        <div class="fc-stat-item">
          <span class="fc-stat-label">Total in Deck</span>
          <span class="fc-stat-num">${stats.total}</span>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="fc-tabs-row" role="tablist" aria-label="Flashcard Deck Filters">
        <button class="fc-tab-btn ${FLASHCARD_ACTIVE_FILTER === 'due' ? 'active' : ''}" data-a="fc-filter" data-v="due" role="tab" aria-selected="${FLASHCARD_ACTIVE_FILTER === 'due'}">
          Due for Review (${stats.due})
        </button>
        <button class="fc-tab-btn ${FLASHCARD_ACTIVE_FILTER === 'all' ? 'active' : ''}" data-a="fc-filter" data-v="all" role="tab" aria-selected="${FLASHCARD_ACTIVE_FILTER === 'all'}">
          All Cards (${stats.total})
        </button>
        <button class="fc-tab-btn ${FLASHCARD_ACTIVE_FILTER === 'mastered' ? 'active' : ''}" data-a="fc-filter" data-v="mastered" role="tab" aria-selected="${FLASHCARD_ACTIVE_FILTER === 'mastered'}">
          Mastered (${stats.mastered})
        </button>
      </div>

      <!-- Main Study Area -->
      ${activeCards.length > 0 && currentCard ? `
        <div class="fc-study-container">
          <div class="fc-card-meta">
            <span>Card <b>${FLASHCARD_ACTIVE_INDEX + 1}</b> of <b>${activeCards.length}</b></span>
            <span class="pill">Leitner Box ${currentCard.box || 1}/5 · Review interval: ${currentCard.intervalDays || 1}d</span>
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

                <!-- Rating Buttons -->
                <div class="fc-rating-row" onclick="event.stopPropagation()">
                  <div class="fc-rating-label">Rate recall difficulty:</div>
                  <div class="fc-rating-buttons">
                    <button class="btn sm fc-rate-btn rate-difficult" data-a="fc-rate" data-v="difficult" data-card="${escapeHTML(currentCard.id)}">
                      Difficult (1d)
                    </button>
                    <button class="btn sm fc-rate-btn rate-good" data-a="fc-rate" data-v="good" data-card="${escapeHTML(currentCard.id)}">
                      Good (3d)
                    </button>
                    <button class="btn sm fc-rate-btn rate-easy" data-a="fc-rate" data-v="easy" data-card="${escapeHTML(currentCard.id)}">
                      Easy (7d)
                    </button>
                  </div>
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
            <button class="btn o sm" data-a="fc-next" ${FLASHCARD_ACTIVE_INDEX >= activeCards.length - 1 ? 'disabled' : ''}>
              Next →
            </button>
          </div>
        </div>
      ` : `
        <!-- Empty or All Caught Up State -->
        <div class="card fc-empty-card">
          <div class="fc-empty-art" aria-hidden="true">
            <img src="assets/images/wisyo.png" alt="" style="width:110px;height:auto">
          </div>
          <h3>${FLASHCARD_ACTIVE_FILTER === 'due' ? 'All Caught Up! 🎉' : 'No Cards Found'}</h3>
          <p class="sub">
            ${FLASHCARD_ACTIVE_FILTER === 'due'
              ? 'You have reviewed all due vocabulary cards for today! Keeping up with spaced repetition builds lasting reading comprehension.'
              : 'No cards currently match this view.'}
          </p>
          <div class="fc-empty-actions">
            <button class="btn blue sm" data-a="fc-filter" data-v="all">
              Study All ${stats.total} Cards Anyway
            </button>
            <button class="btn o sm" data-a="tab" data-v="practice">
              Browse Stories to Save Words
            </button>
            <button class="btn o sm" data-a="fc-open-add">
              + Add Custom Word
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
