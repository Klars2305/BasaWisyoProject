function viewPractice() {
  let allPassages = getPublishedPassages();

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

  return `
    <div class="row">
      <h2>Reading Library</h2>
      <span class="pill">${allPassages.length} Passages</span>
    </div>
    <p class="sub">Tap underlined words for trilingual translations. Test your comprehension with instant feedback.</p>

    <!-- Difficulty Filter Bar -->
    <div class="diff-selector">
      <button data-a="filter-diff" data-v="all" class="${S.activeDiff==='all'?'on':''}">All</button>
      <button data-a="filter-diff" data-v="easy" class="${S.activeDiff==='easy'?'on':''}">Easy</button>
      <button data-a="filter-diff" data-v="medium" class="${S.activeDiff==='medium'?'on':''}">Medium</button>
      <button data-a="filter-diff" data-v="hard" class="${S.activeDiff==='hard'?'on':''}">Hard</button>
      <button data-a="filter-diff" data-v="extreme" class="${S.activeDiff==='extreme'?'on':''}">Extreme</button>
    </div>

    <!-- Search Bar -->
    <div class="search-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="lib-search" placeholder="Search topics (e.g. coral, history, tarsier, science)..." value="${escapeHTML(SEARCH_QUERY)}">
    </div>

    <!-- Passages Grid -->
    <div id="passages-list">
      ${allPassages.length === 0 ? `
        <div class="card" style="text-align:center;padding:24px">
          <p class="sub">No passages found matching your search. Try another keyword or switch difficulty.</p>
          <button class="btn sm o" data-a="filter-diff" data-v="all" style="margin:0 auto">Show All Passages</button>
        </div>
      ` : allPassages.map(p => {
        const isDone = S.done.includes(p.id);
        const diffClass = "diff-" + (p.diff || "easy");
        const diffLabel = (p.diff || "custom").toUpperCase();
        const wc = wordCount(p.x);
        const estMin = Math.max(1, Math.round(wc / 130));

        return `
          <div class="card">
            <div class="card-header">
              <div>
                <span class="badge-diff ${diffClass}">${diffLabel}</span>
                <span class="sub-sm" style="margin-left:6px">${wc} words Â· ~${estMin} min</span>
                <h3 style="margin-top:4px">${escapeHTML(p.t)}</h3>
              </div>
              <span class="pill ${isDone ? 'ok' : ''}">${isDone ? 'Done âœ“' : 'New'}</span>
            </div>
            <p class="sub" style="font-size:0.82rem;margin-bottom:10px">
              ${escapeHTML(p.x.slice(0, 110))}â€¦
            </p>
            <div class="row">
              <span class="sub-sm">${p.qs.length} comprehension questions</span>
              <button class="btn sm ${isDone ? 'o' : 'gold'}" data-a="read-passage" data-v="${p.id}">
                ${isDone ? 'Read Again' : 'Read & Answer'}
              </button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

