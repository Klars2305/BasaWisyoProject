/* ==========================================================================
   BasaWisyo - Class Reading Board & Rankings Page (board.js)
   Presents local classroom and year-level leaderboards.
   Supports Weekly XP, Stories Completed, and All-Time XP metrics.
   Guarantees student privacy (anonymous aliases, opt-in only).
   Explicitly marked as local demo prototype data.
   ========================================================================== */

function viewClassBoard() {
  const user = AUTH.currentUser;
  if (user?.role === "admin") {
    return `<div class="card"><h2>Class Board</h2><p class="sub">This board is for learners and their linked teachers.</p></div>`;
  }

  const journey = user?.role === "teacher" ? null : journeyForCurrent();
  const rank = journey ? readingRank(journey) : null;
  const context = classBoardContext();
  const tier = BOARD_TIER ?? (user?.role === "student"
    ? journeyUnlockedTier(journey, user.journeyOverride) : 0);
  const optedIn = user?.role === "student" && journey?.boardOptIn === true;

  const currentMetric = typeof CURRENT_BOARD_METRIC !== "undefined" ? CURRENT_BOARD_METRIC : "weeklyXP";
  const currentScope = typeof CURRENT_BOARD_SCOPE !== "undefined" ? CURRENT_BOARD_SCOPE : "classroom";
  const period = typeof getRankingPeriod === "function" ? getRankingPeriod() : { label: "Current Week", daysRemaining: 7 };

  // Get rankings based on selected metric
  let entries = [];
  if (context && (context.role === "teacher" || optedIn)) {
    if (currentMetric === "stories") {
      entries = classBoardEntries(tier);
    } else if (typeof getClassroomRankings === "function") {
      const res = getClassroomRankings({ metric: currentMetric, scope: currentScope, tier });
      entries = res.entries;
    }
  }

  return `
    <div class="subnav-segmented" role="tablist" aria-label="Class section switcher">
      <button class="subnav-tab active" data-a="tab" data-v="board">
        ${uiIcon("board")} <span>Class Board</span>
      </button>
      <button class="subnav-tab" data-a="tab" data-v="quest">
        ${uiIcon("quest")} <span>Bayanihan Quest</span>
      </button>
    </div>
    <div class="row">
      <h2>Class Reading Board</h2>
      <span class="pill">Local classroom</span>
    </div>
    <p class="sub">Celebrate reading practice and milestones at your own pace. Participation is voluntary, anonymous, and uses accounts saved in this browser only.</p>

    <!-- Prototype Transparency Banner -->
    <div class="card prototype-notice-banner" style="background:rgba(245, 171, 29, 0.08);border:1px solid rgba(245, 171, 29, 0.3);padding:10px 14px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px">
        <span aria-hidden="true">📌</span>
        <span class="sub-sm" style="color:var(--gold-ink)">
          <b>Local Demo Prototype Data:</b> Rankings reflect activity in this browser only. Not synced across live school servers.
        </span>
      </div>
    </div>

    <!-- Learner's Personal Milestone Card -->
    ${rank ? `
      <section class="card board-rank" aria-label="Your reading activity rank">
        <div class="lab">Your Activity Rank</div>
        <h3>${escapeHTML(rank.title)}</h3>
        <p class="sub-sm">${rank.stories} different qualifying ${rank.stories === 1 ? "story" : "stories"} completed across all tiers. This is a practice milestone, not a reading ability level.</p>
        <p class="sub-sm">${rank.next
          ? `${rank.next.min - rank.stories} more ${rank.next.min - rank.stories === 1 ? "story" : "stories"} to become ${escapeHTML(rank.next.title)}.`
          : "You have reached the final activity rank. Keep enjoying new stories."}</p>
      </section>
    ` : ""}

    ${!context ? `
      <div class="card join-classroom-gate-card" style="padding:24px;border-top:4px solid var(--sky)">
        <div class="lab" style="color:var(--sky-ink)">${uiIcon("classroom")} Classroom Enrollment Required</div>
        <h3 style="margin:4px 0 8px 0">Join a Classroom First!</h3>
        <p class="sub" style="margin-bottom:16px">${!user ? "Sign in with a student account and join a teacher's class to see the board. Your guest reading progress can transfer when you register."
          : "To view Class Board rankings and participate with your section, enter the Share Code provided by your teacher:"}</p>
        ${!user ? '<button class="btn blue sm" data-a="auth-open">Sign in</button>' : `
          <div class="connect-row" style="display:flex;gap:8px;max-width:440px;margin-bottom:16px">
            <input type="text" id="classroom-join-code-board" class="auth-input" placeholder="e.g. BASA-TEACH-8492" aria-label="Teacher share code" style="text-transform:uppercase;font-family:monospace">
            <button class="btn blue" data-a="student-connect-teacher" data-source="classroom-join-code-board">Join Class</button>
          </div>
          <div class="card" style="background:var(--bg);padding:12px 14px;border-left:4px solid var(--teal);margin:0">
            <p class="sub-sm" style="margin:0">
              💡 <b>Personal reading is always open!</b> You can freely explore and practice stories in the Reading Library once your diagnostic placement is complete, even before joining a classroom.
            </p>
          </div>
        `}
      </div>
    ` : `
      ${user?.role === "student" ? `
        <section class="card board-choice">
          <h3>Share your progress with your class?</h3>
          <p class="sub-sm">Only a generated reader label and your count of distinct stories appear. Participation is optional; you can leave anytime.</p>
          <button class="btn ${optedIn ? "o" : "blue"} sm" data-a="board-opt" data-v="${optedIn ? "off" : "on"}">
            ${optedIn ? "Leave Class Board" : "Join Class Board"}
          </button>
        </section>
      ` : ""}

      ${user?.role === "teacher" || optedIn ? `
        <section class="card board-panel" aria-label="Class reading board">
          <!-- Scope & Metric Control Bar -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px">
            <div>
              <div class="lab" style="color:var(--sky-ink)">Ranking Metric</div>
              <div style="display:flex;gap:6px;margin-top:4px" role="group" aria-label="Choose ranking metric">
                <button class="btn sm ${currentMetric === 'weeklyXP' ? 'blue' : 'o'}" data-a="board-metric" data-v="weeklyXP" aria-pressed="${currentMetric === 'weeklyXP'}">
                  Weekly XP
                </button>
                <button class="btn sm ${currentMetric === 'stories' ? 'blue' : 'o'}" data-a="board-metric" data-v="stories" aria-pressed="${currentMetric === 'stories'}">
                  Stories by Tier
                </button>
                <button class="btn sm ${currentMetric === 'allTimeXP' ? 'blue' : 'o'}" data-a="board-metric" data-v="allTimeXP" aria-pressed="${currentMetric === 'allTimeXP'}">
                  All-Time XP
                </button>
              </div>
            </div>

            <div>
              <div class="lab" style="color:var(--teal-ink)">Filter Scope</div>
              <div style="display:flex;gap:6px;margin-top:4px" role="group" aria-label="Choose board scope">
                <button class="btn sm ${currentScope === 'classroom' ? 'blue' : 'o'}" data-a="board-scope" data-v="classroom" aria-pressed="${currentScope === 'classroom'}">
                  My Classroom
                </button>
                <button class="btn sm ${currentScope === 'grade' ? 'blue' : 'o'}" data-a="board-scope" data-v="grade" aria-pressed="${currentScope === 'grade'}">
                  Year-Level
                </button>
              </div>
            </div>
          </div>

          <!-- Active Period Info -->
          ${currentMetric === "weeklyXP" ? `
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg);padding:8px 12px;border-radius:6px;margin-bottom:14px">
              <span class="sub-sm">🗓️ <b>Weekly Period:</b> ${escapeHTML(period.label)}</span>
              <span class="sub-sm" style="color:var(--sub)">Resets in ${period.daysRemaining} ${period.daysRemaining === 1 ? 'day' : 'days'}</span>
            </div>
          ` : ''}

          <!-- Tier buttons for Stories / Tier Navigation -->
          <h3>Stories by tier</h3>
          <div class="board-tier-choices" role="group" aria-label="Choose reading tier">
            ${DIFF_KEYS.map((key, index) => `
              <button class="btn sm ${tier === index ? "blue" : "o"}"
                data-a="board-tier" data-v="${index}" aria-pressed="${tier === index}">
                ${escapeHTML(DIFF_NAMES[key])}
              </button>
            `).join("")}
          </div>
          <p class="sub-sm" style="margin-top:8px">${escapeHTML(DIFF_NAMES[DIFF_KEYS[tier]])} · tied readers share the same place.</p>

          <!-- Ranked List -->
          ${entries.length ? `
            <ol class="board-list">
              ${entries.map(entry => `
                <li class="board-entry ${entry.own ? "own" : ""}">
                  <span class="board-place">#${entry.place}</span>
                  <b>${entry.own ? "You" : escapeHTML(entry.alias)}</b>
                  <span class="board-count">
                    ${currentMetric === "stories"
                      ? `${entry.stories} ${entry.stories === 1 ? "story" : "stories"}`
                      : `${entry.score} XP`}
                  </span>
                </li>
              `).join("")}
            </ol>
          ` : `
            <p class="sub">No one has joined this local class board yet.</p>
          `}
        </section>
      ` : ""}
    `}
  `;
}
