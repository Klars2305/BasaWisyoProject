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
    <div class="row library-heading">
      <div><div class="lab">${isAdmin ? "Admin curriculum" : "Teacher classroom"}</div>
        <h2>Passage Library</h2></div>
      <span class="pill">${filtered.length} ${filtered.length === 1 ? "passage" : "passages"}</span>
    </div>
    <p class="sub library-intro">View reading content and local student results. ${isAdmin
      ? "Manage custom practices and review teacher submissions."
      : "Manage your own practices and assignments without taking a learner quiz."}</p>
    <div class="practice-management-actions">
      <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add practice</button>
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
    const isLocked = journey && DIFF_KEYS.indexOf(p.diff) > journey.tier;
    const diffClass = "diff-" + (p.diff || "easy");
    const diffLabel = (p.diff || "custom").toUpperCase();
    const wc = wordCount(p.x);
    const estMin = Math.max(1, Math.round(wc / 130));

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
          <button class="btn sm ${isDone || isLocked ? 'o' : 'blue'}" data-a="read-passage" data-v="${escapeHTML(p.id)}" ${isLocked ? 'disabled aria-label="Complete earlier reading tiers to unlock this passage"' : ''}>
            ${isLocked ? 'Complete earlier tiers' : isDone ? 'Read Again' : 'Read & Answer'}
          </button>
        </div>
      </article>`;
  };
  const groupLocked = Boolean(journey && S.activeDiff === "all" && !SEARCH_QUERY.trim());
  const availablePassages = groupLocked
    ? allPassages.filter(p => DIFF_KEYS.indexOf(p.diff) <= journey.tier) : allPassages;
  const lockedPassages = groupLocked
    ? allPassages.filter(p => DIFF_KEYS.indexOf(p.diff) > journey.tier) : [];

  return `
    <div class="row library-heading">
      <h2>Reading Library</h2>
      <span class="pill">${allPassages.length} Passages</span>
    </div>
    <p class="sub library-intro">Tap underlined words for trilingual translations. Test your comprehension with instant feedback.</p>

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

