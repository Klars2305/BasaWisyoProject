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
  const pendingClass = user?.role === "student" && user.enrollmentStatus === "pending" && user.pendingTeacherCode;
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
          <h3 style="margin:4px 0 8px 0">${pendingClass ? "Waiting for Teacher Approval" : "Join a Classroom First!"}</h3>
          <p class="sub" style="margin-bottom:16px">
            ${pendingClass
              ? "Your classroom request is pending. Your teacher will review it before your reading contributes to the class goal."
              : "To participate in the collective Bayanihan Reading Quest, request enrollment with the Share Code provided by your teacher:"}
          </p>
          ${pendingClass ? "" : `<div class="connect-row" style="display:flex;gap:8px;max-width:440px;margin-bottom:16px">
            <input type="text" id="classroom-join-code" class="auth-input" placeholder="e.g. BASA-TEACH-8492" aria-label="Teacher share code" style="text-transform:uppercase;font-family:monospace">
            <button class="btn blue" data-a="student-connect-teacher" data-source="classroom-join-code">Request to Join</button>
          </div>`}
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
        <h3 style="margin:2px 0">Share stories and quizzes without internet</h3>
        <p class="sub">Exchange a validated story packet by file or QR code. Imported stories stay on this device and do not transfer class scores.</p>
        <button class="btn blue" data-a="mesh-open">Open BasaMesh</button>
      </div>
    </div>
  `;
}
