/* ==========================================================================
   Teacher Interface Views
   ========================================================================== */

function viewTeacher() {
  const teacher = AUTH.currentUser;
  if (!teacher || teacher.role !== "teacher") {
    return `<div class="card"><p>Access restricted to Teacher accounts. Please sign in as a Teacher.</p></div>`;
  }

  const students = AUTH.getTeacherStudents(teacher.shareCode);
  const totalStudents = students.length;

  // Breakdown by Phil-IRI Level
  const frustCount = students.filter(s => s.lvl === 0).length;
  const instCount = students.filter(s => s.lvl === 1).length;
  const indepCount = students.filter(s => s.lvl === 2).length;
  const mastCount = students.filter(s => s.lvl === 3).length;

  const avgWpm = totalStudents > 0 
    ? Math.round(students.reduce((acc, s) => acc + (s.wpm || 100), 0) / totalStudents)
    : 0;

  const avgComp = totalStudents > 0 
    ? Math.round(students.reduce((acc, s) => acc + (s.comp || 70), 0) / totalStudents)
    : 0;

  const assignments = AUTH.assignments.filter(a => a.teacherCode === teacher.shareCode);
  const assignablePassages = getPublishedPassages();
  const myPractices = AUTH.customPassages
    .filter(passage => passage?.ownerId === teacher.id)
    .map(passage => {
      try { return normalizePassage(passage); } catch (error) { return null; }
    })
    .filter(Boolean);

  return `
    <!-- Teacher Header & Share Code Hero Banner -->
    <div class="share-code-hero">
      <div class="share-code-label">👩‍🏫 Teacher Share Code (Class Section: ${teacher.section || "Grade 8"})</div>
      <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-bottom:8px">
        Share this code with your nearby students so they can join your classroom roster:
      </div>
      <div class="share-code-box">
        <span class="share-code-digits" id="teacher-share-code-val">${teacher.shareCode}</span>
      </div>
      <div class="share-code-actions">
        <button class="share-code-btn" data-a="teacher-copy-code">
          📋 Copy Code
        </button>
        <button class="share-code-btn secondary" data-a="teacher-show-projector">
          📡 Open Projector / Blackboard Mode
        </button>
        <button class="share-code-btn secondary" data-a="open-report-sheet">
          🖨️ View DepEd Form 14
        </button>
      </div>
    </div>

    <!-- Live Classroom Metric Summary -->
    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-value">${totalStudents}</div>
        <div class="metric-title">Connected Students</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--coral)">${frustCount}</div>
        <div class="metric-title">Frustration (Intervention)</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:#b7791f">${instCount}</div>
        <div class="metric-title">Instructional</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--sky)">${indepCount + mastCount}</div>
        <div class="metric-title">Independent / Mastery</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${avgWpm}</div>
        <div class="metric-title">Avg. Words Per Min</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <h3>My reading practices</h3>
          <p class="sub">Create a passage and question. An admin reviews submissions before students can read or receive them.</p>
        </div>
        <button class="btn gold" data-a="practice-new">Add practice</button>
      </div>
      ${myPractices.length ? `<div style="display:grid;gap:10px;margin-top:16px">
        ${myPractices.map(passage => `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div><b>${escapeHTML(passage.t)}</b><div class="sub-sm">${escapeHTML(DIFF_NAMES[passage.diff])} · ${wordCount(passage.x)} words</div></div>
              <span class="pill">${escapeHTML(passage.status)}</span>
            </div>
            ${passage.reviewNote ? `<p class="sub" style="margin:8px 0">Admin note: ${escapeHTML(passage.reviewNote)}</p>` : ""}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              ${["draft", "rejected"].includes(passage.status) ? `
                <button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(passage.id)}">Edit</button>
                <button class="btn o sm" data-a="practice-delete" data-v="${escapeHTML(passage.id)}">Delete</button>
              ` : ""}
              ${passage.status === "pending" ? `<button class="btn o sm" data-a="practice-withdraw" data-v="${escapeHTML(passage.id)}">Withdraw to edit</button>` : ""}
              ${passage.status === "published" ? `<span class="sub-sm">Available in the reading library and assignment picker.</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>` : `<p class="sub" style="margin-top:14px">No practices yet. Add one to start the admin review process.</p>`}
    </div>

    <!-- Targeted Differentiated Assignment Dispatcher -->
    <div class="card" style="margin-bottom:24px">
      <div class="lab">🎯 Targeted Leveled Assignment Dispatcher</div>
      <p class="sub" style="margin-bottom:14px">
        Send tailored reading passages directly to specific Phil-IRI ability groups in your class:
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px">
        <div class="auth-form-group">
          <label>Select Reading Passage</label>
          <select id="asg-passage-select" class="auth-input">
            ${DIFF_KEYS.map(diff => {
              const options = assignablePassages.filter(passage => passage.diff === diff);
              return options.length ? `<optgroup label="${escapeHTML(DIFF_NAMES[diff])}">
                ${options.map(passage => `<option value="${escapeHTML(passage.id)}">${escapeHTML(passage.t)}</option>`).join("")}
              </optgroup>` : "";
            }).join("")}
          </select>
        </div>
        <div class="auth-form-group">
          <label>Assign To Group</label>
          <select id="asg-target-select" class="auth-input">
            <option value="all">Entire Class (${totalStudents} students)</option>
            <option value="level-0">Frustration Learners Only (${frustCount} students - Remedial)</option>
            <option value="level-1">Instructional Learners Only (${instCount} students)</option>
            <option value="level-2">Independent Learners Only (${indepCount} students)</option>
            <option value="level-3">Mastery Learners Only (${mastCount} students)</option>
          </select>
        </div>
        <div class="auth-form-group">
          <label>Due Date / Note</label>
          <input type="text" id="asg-note-input" class="auth-input" placeholder="e.g. Due Friday, complete quiz">
        </div>
      </div>
      <button class="btn gold" style="margin-top:8px" data-a="teacher-dispatch-assignment">
        🚀 Dispatch Assignment to Students
      </button>

      <!-- Active Assignments List -->
      ${assignments.length > 0 ? `
        <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
          <div class="lab" style="margin-bottom:8px">Active Assigned Passages:</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${assignments.map(a => `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <span class="assignment-badge">📌 ${escapeHTML(a.title)}</span>
                  <span style="font-size:12px;color:var(--sub);margin-left:8px">Target: <b>${escapeHTML(a.targetGroup)}</b> · Due: ${escapeHTML(a.dueDate)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:12px;color:var(--teal);font-weight:600">Active in Student Dashboards</span>
                  <button class="btn o sm" data-a="teacher-remove-assignment" data-v="${escapeHTML(a.id)}">Remove</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Connect Nearby Student via Guest Token -->
    <div class="card" style="margin-bottom:24px">
      <div class="lab">📥 Link Unregistered Student by Guest Token</div>
      <p class="sub" style="margin-bottom:10px">
        If a student completed a diagnostic test on a shared device without logging in, enter their 6-digit Guest Token (e.g. <b>GUEST-8291</b>) to pull their reading score into your class:
      </p>
      <div style="display:flex;gap:8px;max-width:440px">
        <input type="text" id="guest-token-input" class="auth-input" placeholder="GUEST-XXXX" style="text-transform:uppercase;font-family:monospace">
        <button class="btn" data-a="teacher-import-guest">Link Student</button>
      </div>
    </div>

    <!-- Connected Students Live Roster -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <h3 style="margin:0;font-size:18px">📋 Connected Students Roster (${teacher.section})</h3>
          <p class="sub" style="margin:2px 0 0 0">Real-time sync with student diagnostic tests and reading sessions</p>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn o" style="font-size:12px;padding:5px 12px" data-a="open-report-sheet">🖨️ DepEd Form 14</button>
          <button class="btn o" style="font-size:12px;padding:5px 12px" data-a="download-csv">⬇️ Export CSV</button>
        </div>
      </div>

      <div class="responsive-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Phil-IRI Reading Level</th>
              <th>Reading Speed</th>
              <th>Comprehension</th>
              <th>Words Read</th>
              <th>Status / Intervention</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center;padding:24px;color:var(--sub)">
                  No students connected yet. Have students enter your Share Code <b>${teacher.shareCode}</b>!
                </td>
              </tr>
            ` : students.map((s, idx) => {
              const lvl = s.lvl !== null && s.lvl !== undefined ? s.lvl : 1;
              const lvlClass = `level-${lvl}`;
              const lvlText = PHIL_IRI_LEVELS[lvl];
              const isRemedial = lvl === 0;
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${s.name}</b></td>
                  <td><span class="level-badge ${lvlClass}">${lvlText}</span></td>
                  <td>${s.wpm || 105} WPM</td>
                  <td><b>${s.comp || 75}%</b></td>
                  <td>${(s.wordsRead || 0).toLocaleString()} words</td>
                  <td>
                    ${isRemedial 
                      ? '<span style="color:var(--coral);font-weight:700">⚠️ Needs Intervention</span>'
                      : '<span style="color:var(--teal)">✓ On Track</span>'}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

