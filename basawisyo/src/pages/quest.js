/* ==========================================================================
   BAYANIHAN COOPERATIVE READING QUEST VIEW (quest.js)
   - Real data-driven classroom cooperative reading quest.
   - Calculates verified class and individual word totals without simulated data.
   - Preserves weekly history and supports teacher-configured targets.
   - BasaMesh validated offline package exchange with preview before saving.
   ========================================================================== */

function viewQuest() {
  const stats = typeof getBayanihanStats === "function" ? getBayanihanStats() : {
    targetWords: 10000,
    classWords: 0,
    studentWords: 0,
    studentSessions: 0,
    linkedStudentsCount: 0,
    pct: 0,
    isGoalReached: false,
    currentWeek: "Current Week",
    history: [],
    isEnrolled: false
  };

  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const isTeacher = user && user.role === "teacher";
  const sectionName = user?.section || (user?.teacherCode ? `Section (${user.teacherCode})` : "Classroom");

  const subnavHtml = `
    <div class="subnav-segmented" role="tablist" aria-label="Class section switcher">
      <button class="subnav-tab" data-a="tab" data-v="board">
        ${uiIcon("board")} <span>Class Board</span>
      </button>
      <button class="subnav-tab active" data-a="tab" data-v="quest">
        ${uiIcon("quest")} <span>Bayanihan Quest</span>
      </button>
    </div>
  `;

  if (!stats.isEnrolled && !isTeacher) {
    return `
      <div class="quest-page">
        ${subnavHtml}
        <div class="quest-intro">
          <div class="lab" style="color:var(--gold)">Cooperative Reading Quest</div>
          <h2>Bayanihan Reading Quest</h2>
          <p class="sub">
            A shared classroom reading endeavor where every student's independent reading contributes toward a collective weekly milestone. Kept strictly separate from individual rankings.
          </p>
        </div>

        <div class="card join-classroom-gate-card" style="padding:24px;border-top:4px solid var(--sky)">
          <div class="lab" style="color:var(--sky-ink)">${uiIcon("classroom")} Classroom Enrollment Required</div>
          <h3 style="margin:4px 0 8px 0">Join a Classroom First!</h3>
          <p class="sub" style="margin-bottom:16px">
            To participate in the collective Bayanihan Reading Quest and contribute your words read toward a weekly classroom goal, enter the Share Code provided by your teacher:
          </p>
          <div class="connect-row" style="display:flex;gap:8px;max-width:440px;margin-bottom:16px">
            <input type="text" id="classroom-join-code" class="auth-input" placeholder="e.g. BASA-TEACH-8492" aria-label="Teacher share code" style="text-transform:uppercase;font-family:monospace">
            <button class="btn blue" data-a="student-connect-teacher" data-source="classroom-join-code">Join Class</button>
          </div>
          <div class="card" style="background:var(--bg);padding:12px 14px;border-left:4px solid var(--teal);margin:0">
            <p class="sub-sm" style="margin:0">
              💡 <b>Personal reading is always open!</b> You can freely explore and practice stories in the Reading Library once your diagnostic placement is complete, even before joining a classroom.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="quest-page">
      ${subnavHtml}
      <div class="quest-intro">
        <div class="lab" style="color:var(--gold)">Cooperative Reading Quest · ${escapeHTML(stats.currentWeek)}</div>
        <h2>${escapeHTML(sectionName)} Bayanihan Reading Quest</h2>
        <p class="sub">
          A shared classroom reading endeavor where every student's independent reading contributes toward a collective weekly milestone. Kept strictly separate from individual rankings.
        </p>
      </div>

      <!-- Real Data Progress Hero -->
      <div class="hero quest-hero" style="background:linear-gradient(135deg, var(--navy), #1a3365);border-radius:var(--radius-lg);padding:24px;color:#fff;margin-bottom:20px;box-shadow:var(--shadow-md)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div class="lab" style="color:#f5ab1d">Collective Classroom Goal: ${stats.targetWords.toLocaleString()} Words</div>
          <span class="pill" style="background:rgba(255,255,255,0.15);color:#fff">${stats.currentWeek}</span>
        </div>

        <div class="big" style="color:#fff;font-size:2.2rem;font-weight:700;margin:8px 0">
          ${stats.classWords.toLocaleString()} <span style="font-size:1.1rem;font-weight:500;color:#ccdcf8">/ ${stats.targetWords.toLocaleString()} words</span>
        </div>

        <!-- Progress Bar -->
        <div class="bar" style="background:rgba(255,255,255,0.2);height:12px;border-radius:6px;overflow:hidden;margin:10px 0">
          <i style="display:block;height:100%;background:linear-gradient(90deg, #2ec4b6, #f5ab1d);width:${stats.pct}%;border-radius:6px;transition:width 0.3s ease"></i>
        </div>

        <p class="sub" style="color:#e0edff;margin:6px 0 12px 0">
          ${stats.isGoalReached
            ? `${uiIcon("check")} Weekly Goal Reached! Wonderful cooperative reading effort by the classroom!`
            : stats.classWords === 0
              ? `No completed reading sessions recorded for this week yet. Read stories in the library to make the first classroom contribution!`
              : `Remaining: ${(stats.targetWords - stats.classWords).toLocaleString()} words to complete this week's milestone (${stats.pct}% complete).`}
        </p>

        <!-- Student Contribution Card -->
        <div class="row" style="background:rgba(255,255,255,0.12);padding:10px 14px;border-radius:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-size:0.85rem;color:#ccdcf8">Your personal contribution:</span>
            <div style="font-size:1.05rem;font-weight:700;color:#fff">
              ${stats.studentWords.toLocaleString()} words read <span style="font-size:0.85rem;font-weight:500;color:#ccdcf8">(${stats.studentSessions} completed sessions)</span>
            </div>
          </div>
          <button class="btn sm" data-a="tab" data-v="practice" style="background:#fff;color:var(--navy);font-weight:700">
            ${uiIcon("practice")} Read More Stories
          </button>
        </div>
      </div>

      <!-- Teacher Target Setting Panel -->
      ${isTeacher ? `
        <div class="card" style="margin-bottom:20px;border-left:4px solid var(--gold);padding:14px 18px">
          <div class="lab" style="color:var(--gold-ink)">Teacher Classroom Management</div>
          <h4 style="margin:2px 0 8px 0">Set Classroom Weekly Reading Target</h4>
          <p class="sub-sm" style="margin-bottom:10px">Adjust your class's weekly goal based on class size and weekly curriculum goals:</p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:440px">
            <input type="number" id="bayanihan-target-input" class="auth-input" value="${stats.targetWords}" min="500" max="500000" step="500" style="flex:1" aria-label="Weekly word goal">
            <button type="button" class="btn blue sm" data-a="set-bayanihan-target" style="padding:10px 16px">
              Update Goal
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Weekly Quest History Archive -->
      ${stats.history && stats.history.length > 0 ? `
        <div class="card" style="margin-bottom:20px">
          <div class="lab">Prior Weekly Quest History</div>
          <h3 style="margin:2px 0 10px 0">Classroom Reading Archive</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${stats.history.map(h => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm);font-size:0.875rem">
                <div>
                  <b>Week ${escapeHTML(h.week)}:</b>
                  <span style="margin-left:6px;color:var(--sub)">${h.wordsRead.toLocaleString()} / ${h.targetWords.toLocaleString()} words</span>
                </div>
                <span class="pill ${h.completed ? 'ok' : 'blue'}">
                  ${h.completed ? 'Milestone Reached ✓' : `${Math.round((h.wordsRead / h.targetWords) * 100)}%`}
                </span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}

      <!-- Prototype Synchronization Notice -->
      <div class="card" style="background:var(--bg);border:1px solid var(--border);margin-bottom:20px;padding:12px 16px">
        <b style="font-size:0.85rem;color:var(--navy)">Local-First Classroom Storage Notice:</b>
        <p class="sub-sm" style="margin:4px 0 0 0">
          Independent web browsers cannot automatically share class totals without a live server sync. Class totals shown above represent verified student reading sessions recorded in this browser or linked classroom roster. Use BasaMesh below to exchange reading packages between devices without internet!
        </p>
      </div>

      <!-- BasaMesh Offline Story Exchange -->
      <div class="card">
        <div class="lab">${uiIcon("upload")} BasaMesh · Offline Story Exchange</div>
        <h3 style="margin:2px 0">Share Stories &amp; Quizzes Without Internet</h3>
        <p class="sub">
          Generate an encoded share code for any custom reading passage. Classmates and teachers can import it via Bluetooth, flash drive, SMS, or local text!
        </p>

        <!-- Generate Code Form -->
        <div style="margin-top:14px;background:var(--bg);padding:14px;border-radius:var(--radius-sm)">
          <h4 style="margin:0 0 8px 0">Create Share Code for a Passage</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            <input id="mesh-title" class="auth-input" placeholder="Passage Title (e.g. Ang Agila ng Davao)">
            <textarea id="mesh-text" class="auth-input" rows="3" placeholder="Paste or type passage text here..."></textarea>
            <button class="btn sm o" data-a="mesh-create" style="align-self:flex-start">
              ${uiIcon("copy")} Generate BasaMesh Code
            </button>
            <div id="mesh-generated-box" style="display:none;margin-top:8px">
              <span class="lab">Your Share Code (Copy and send to classmates):</span>
              <textarea id="mesh-code-output" class="auth-input" rows="3" readonly style="font-family:monospace;font-size:0.8rem;background:var(--card-bg)"></textarea>
            </div>
          </div>
        </div>

        <!-- Import Code Form with Preview -->
        <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:16px">
          <h4 style="margin:0 0 4px 0">Import Passage from Classmate</h4>
          <p class="sub-sm" style="margin-bottom:8px">Paste code below to preview the passage before adding it to your library:</p>
          <textarea id="mesh-code" class="auth-input" rows="2" placeholder="Paste BasaMesh code here..."></textarea>
          <button class="btn sm blue" data-a="mesh-preview" style="margin-top:8px">
            ${uiIcon("eye")} Inspect &amp; Preview Passage
          </button>
        </div>

        <!-- Interactive Import Preview Card -->
        <div id="mesh-preview-container" style="display:none;margin-top:16px"></div>
      </div>
    </div>
  `;
}
