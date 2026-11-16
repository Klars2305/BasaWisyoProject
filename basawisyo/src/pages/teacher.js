/* ==========================================================================
   Teacher Interface Views
   ========================================================================== */

function teacherOverviewStudentProgress(student, passageById) {
  const journey = journeyValid(student.journey) ? student.journey : journeyEmpty(student.lvl);
  const results = Object.entries(journey.results).flatMap(([id, result]) => {
    const passage = passageById.get(id);
    if (!passage || result.total !== passage.qs.length || result.attempts < 1) return [];
    return [{ passage, result }];
  });
  const tier = journeyUnlockedTier({ ...journey, baseTier: Math.max(journey.baseTier, journeyStartingTier(student.lvl)) }, student.journeyOverride);
  const best = [...results].sort((a, b) =>
    b.result.correct / b.result.total - a.result.correct / a.result.total
    || b.result.correct - a.result.correct)[0] || null;
  return { student, tier, completed: results.length, best };
}

function viewTeacherOverview() {
  const teacher = AUTH.currentUser;
  if (!teacher || teacher.role !== "teacher") {
    return `<section class="card"><h2>Class Overview</h2><p class="sub">Teacher account required.</p></section>`;
  }
  const students = AUTH.getTeacherStudents(teacher.shareCode);
  const passages = getPublishedPassages();
  const passageById = new Map(passages.map(passage => [passage.id, passage]));
  const progress = students.map(student => teacherOverviewStudentProgress(student, passageById));
  const completed = progress.reduce((sum, item) => sum + item.completed, 0);
  const assignments = AUTH.assignments.filter(assignment => assignment.teacherCode === teacher.shareCode);
  const practices = AUTH.customPassages.flatMap(raw => {
    if (raw?.ownerId !== teacher.id) return [];
    try { return [normalizePassage(raw)]; } catch (error) { return []; }
  });
  const pending = practices.filter(passage => passage.status === "pending").length;
  const drafts = practices.filter(passage => ["draft", "rejected"].includes(passage.status)).length;
  const learnersWithoutResults = progress.filter(item => item.completed === 0).length;

  return `<div class="teacher-overview">
    <div class="teacher-overview-intro">
      <div><div class="lab">Teacher workspace · ${escapeHTML(teacher.section || "Classroom")}</div>
        <h2>Class Overview</h2>
        <p class="sub">See your class at a glance, then open the Classroom Hub for detailed management.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn o" data-a="tour-replay" title="Replay the teacher onboarding walkthrough">🎓 Replay Tour</button>
        <button class="btn o" data-a="tab" data-v="teacher-preview">${uiIcon("home")} Preview learner experience</button>
      </div>
    </div>

    <section class="card teacher-overview-code" aria-label="Classroom share code">
      <div><div class="lab">Classroom share code</div>
        <strong>${escapeHTML(teacher.shareCode || "No code available")}</strong>
        <p class="sub-sm">Students enter this code to link their account to your class in this browser.</p></div>
      <button class="btn blue" data-a="teacher-copy-code">${uiIcon("copy")} Copy code</button>
    </section>

    <section class="teacher-overview-metrics" aria-label="Local classroom summary">
      <div class="card"><span class="lab">Linked students</span><b>${students.length}</b><span class="sub-sm">In this browser</span></div>
      <div class="card"><span class="lab">Passage results</span><b>${completed}</b><span class="sub-sm">Completed student-passage pairs</span></div>
      <div class="card"><span class="lab">Active assignments</span><b>${assignments.length}</b><span class="sub-sm">Completion is not tracked per assignment</span></div>
      <div class="card"><span class="lab">Awaiting admin review</span><b>${pending}</b><span class="sub-sm">Your submitted practices</span></div>
    </section>

    ${students.length ? `<div class="teacher-overview-grid">
      <section class="card teacher-overview-panel">
        <div class="teacher-overview-panel-head"><div><div class="lab">Learner progress</div><h3>Student snapshot</h3>
          <p class="sub-sm">${learnersWithoutResults} of ${students.length} ${learnersWithoutResults === 1 ? "student has" : "students have"} no completed passage results recorded here.</p></div>
          <button class="btn o sm" data-a="tab" data-v="teacher">Open full roster</button></div>
        <div class="teacher-overview-students">${progress.slice(0, 5).map(item => `<div class="teacher-overview-student">
          <div><b>${escapeHTML(item.student.name)}</b><span class="sub-sm">Current path: ${escapeHTML(DIFF_NAMES[DIFF_KEYS[item.tier]])}</span></div>
          <div class="teacher-overview-student-score"><strong>${item.completed} ${item.completed === 1 ? "passage" : "passages"}</strong>
            <span class="sub-sm">${item.best ? `Best: ${item.best.result.correct}/${item.best.result.total} · ${escapeHTML(item.best.passage.t)}` : "No score yet"}</span></div>
        </div>`).join("")}</div>
        ${students.length > 5 ? `<p class="sub-sm teacher-overview-more">Showing 5 of ${students.length} students. Open the full roster for everyone.</p>` : ""}
      </section>

      <section class="card teacher-overview-panel">
        <div class="teacher-overview-panel-head"><div><div class="lab">Classroom activity</div><h3>Assigned passages</h3></div>
          <button class="btn o sm" data-a="tab" data-v="teacher">Manage assignments</button></div>
        ${assignments.length ? `<ul class="teacher-overview-assignments">${assignments.slice(0, 3).map(assignment => `<li>
          <b>${escapeHTML(assignment.title)}</b>
          <span class="sub-sm">${escapeHTML(assignment.targetGroup || "Class")} · ${escapeHTML(assignment.dueDate || "No due date")}</span>
        </li>`).join("")}</ul>${assignments.length > 3 ? `<p class="sub-sm">${assignments.length - 3} more in Classroom Hub.</p>` : ""}`
          : `<p class="sub">No passages assigned yet. Open Classroom Hub to assign an approved practice.</p>`}
        <div class="teacher-overview-practice-status"><span>${drafts} ${drafts === 1 ? "draft or rejected practice" : "draft or rejected practices"}</span>
          <button class="btn o sm" data-a="tab" data-v="practice">Manage passages</button></div>
      </section>
    </div>` : `<section class="card teacher-overview-empty"><div class="lab">First step</div><h3>Invite students to your class</h3>
      <p class="sub">No student accounts are linked to this share code in this browser yet. Share the code above, then their local reading results can appear here.</p>
      <div class="teacher-overview-empty-actions"><button class="btn blue" data-a="teacher-copy-code">${uiIcon("copy")} Copy share code</button>
        <button class="btn o" data-a="tab" data-v="teacher">Open Classroom Hub</button></div></section>`}

    <p class="sub-sm teacher-overview-disclaimer">This overview uses account data saved in this browser. Scores are formative practice results, not official Phil-IRI assessments or live cross-device submissions.</p>
  </div>`;
}

function viewTeacherLearnerPreview() {
  if (AUTH.currentUser?.role !== "teacher") {
    return `<section class="card"><h2>Learner preview</h2><p class="sub">Teacher account required.</p></section>`;
  }
  const samples = getPublishedPassages().slice(0, 3);
  return `<div class="teacher-preview-page">
    <div class="teacher-overview-intro"><div><div class="lab">Read-only preview</div><h2>What learners see</h2>
      <p class="sub">Students start with placement, follow a reading journey, and practice with approved stories. Their progress appears only when signed in as that student.</p></div>
      <button class="btn o" data-a="tab" data-v="home">Back to Class Overview</button></div>
    <section class="teacher-preview-grid" aria-label="Learner experience preview">
      <div class="card"><div class="lab">1 · Start</div><h3>Placement activity</h3><p class="sub">A short practice placement suggests a reading level. It is not an official Phil-IRI result.</p></div>
      <div class="card"><div class="lab">2 · Practice</div><h3>Reading journey</h3><p class="sub">Learners read approved passages, answer questions, and progress at their own pace.</p></div>
      <div class="card"><div class="lab">3 · Reflect</div><h3>Profile and rewards</h3><p class="sub">Their profile shows best scores, badges, and the next reading step.</p></div>
    </section>
    <section class="card teacher-overview-panel"><div class="lab">Available stories</div><h3>Sample approved passages</h3>
      ${samples.length ? `<ul class="teacher-overview-assignments">${samples.map(passage => `<li><b>${escapeHTML(passage.t)}</b>
        <span class="sub-sm">${escapeHTML(DIFF_NAMES[passage.diff])} · ${passage.qs.length} questions</span></li>`).join("")}</ul>`
        : `<p class="sub">No approved passages are available yet.</p>`}
    </section>
    <p class="sub-sm">Preview only. Teacher accounts do not answer learner quizzes or create learner progress.</p>
  </div>`;
}

function viewTeacher() {
  const teacher = AUTH.currentUser;
  if (!teacher || teacher.role !== "teacher") {
    return `<div class="card"><p>Access restricted to Teacher accounts. Please sign in as a Teacher.</p></div>`;
  }

  const dataset = getClassroomReportDataset(teacher);
  const students = dataset ? dataset.students : [];
  const totalStudents = dataset ? dataset.total : 0;

  // Breakdown by Phil-IRI Level
  const frustCount = dataset ? dataset.levelCounts[0] : 0;
  const instCount = dataset ? dataset.levelCounts[1] : 0;
  const indepCount = dataset ? dataset.levelCounts[2] : 0;
  const mastCount = dataset ? dataset.levelCounts[3] : 0;

  const assessedWithWpm = students.filter(s => s.isAssessed && typeof s.wpm === "number");
  const avgWpm = assessedWithWpm.length > 0 
    ? Math.round(assessedWithWpm.reduce((acc, s) => acc + s.wpm, 0) / assessedWithWpm.length)
    : 0;

  const assessedWithComp = students.filter(s => s.isAssessed && typeof s.comp === "number");
  const avgComp = assessedWithComp.length > 0 
    ? Math.round(assessedWithComp.reduce((acc, s) => acc + s.comp, 0) / assessedWithComp.length)
    : 0;

  const assignments = AUTH.assignments.filter(a => a.teacherCode === teacher.shareCode);
  const assignablePassages = getPublishedPassages();
  const myPractices = AUTH.customPassages
    .filter(passage => passage?.ownerId === teacher.id)
    .map(passage => {
      try { return normalizePassage(passage); } catch (error) { return null; }
    })
    .filter(Boolean);

  return `<div class="teacher-page">
    <!-- Teacher Header & Share Code Hero Banner -->
    <div class="share-code-hero">
      <h2>Classroom Hub</h2>
      <div class="share-code-label">${uiIcon("teacher")} Teacher Share Code (Class Section: ${escapeHTML(teacher.section || "Grade 8")})</div>
      <p class="teacher-share-help">
        Share this code with your nearby students so they can join your classroom roster:
      </p>
      <div class="share-code-box">
        <span class="share-code-digits" id="teacher-share-code-val">${escapeHTML(teacher.shareCode)}</span>
      </div>
      <div class="share-code-actions">
        <button class="share-code-btn" data-a="teacher-copy-code">
          ${uiIcon("copy")} Copy Code
        </button>
        <button class="share-code-btn secondary" data-a="teacher-show-projector">
          ${uiIcon("projector")} Open Projector / Blackboard Mode
        </button>
        <button class="share-code-btn secondary" data-a="open-report-sheet" data-v="live">
          ${uiIcon("print")} Reading Progress Report
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
        <div class="metric-value" style="color:var(--gold-ink)">${instCount}</div>
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

    <section class="card teacher-section-card">
      <div class="teacher-section-head">
        <div>
          <h3>My reading practices</h3>
          <p class="sub">Create custom passages or draft questions with Wisyo AI. An admin reviews submissions before students can read or receive them.</p>
        </div>
        <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
      </div>
      ${myPractices.length ? `<div class="teacher-practice-list">
        ${myPractices.map(passage => `
          <div class="teacher-practice-row">
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
      </div>` : `<p class="sub teacher-empty-state">No practices yet. Add one to start the admin review process.</p>`}
    </section>

    <!-- Targeted Differentiated Assignment Dispatcher -->
    <section class="card teacher-section-card">
      <div class="lab">${uiIcon("target")} Targeted Leveled Assignment Dispatcher</div>
      <p class="sub" style="margin-bottom:14px">
        Send tailored reading passages directly to specific Phil-IRI ability groups in your class:
      </p>
      <div class="assignment-fields">
        <div class="auth-form-group">
          <label for="asg-passage-select">Select Reading Passage</label>
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
          <label for="asg-target-select">Assign To Group</label>
          <select id="asg-target-select" class="auth-input">
            <option value="all">Entire Class (${totalStudents} students)</option>
            <option value="level-0">Frustration Learners Only (${frustCount} students - Remedial)</option>
            <option value="level-1">Instructional Learners Only (${instCount} students)</option>
            <option value="level-2">Independent Learners Only (${indepCount} students)</option>
            <option value="level-3">Mastery Learners Only (${mastCount} students)</option>
          </select>
        </div>
        <div class="auth-form-group">
          <label for="asg-note-input">Due Date / Note</label>
          <input type="text" id="asg-note-input" class="auth-input" placeholder="e.g. Due Friday, complete quiz">
        </div>
      </div>
      <button class="btn blue teacher-dispatch-button" data-a="teacher-dispatch-assignment">
        ${uiIcon("send")} Dispatch Assignment to Students
      </button>

      <!-- Active Assignments List -->
      ${assignments.length > 0 ? `
        <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">
          <div class="lab" style="margin-bottom:8px">Active Assigned Passages:</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${assignments.map(a => `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <span class="assignment-badge">${uiIcon("practice")} ${escapeHTML(a.title)}</span>
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
    </section>

    <!-- Connect Nearby Student via Guest Token -->
    <section class="card teacher-section-card">
      <div class="lab">${uiIcon("upload")} Link Unregistered Student by Guest Token</div>
      <p class="sub" style="margin-bottom:10px">
        If a student completed a diagnostic test on a shared device without logging in, enter their 6-digit Guest Token (e.g. <b>GUEST-8291</b>) to pull their reading score into your class:
      </p>
      <div class="guest-token-row" style="display:flex;gap:8px;max-width:440px">
        <input type="text" id="guest-token-input" class="auth-input" aria-label="Guest token" placeholder="GUEST-XXXX" style="text-transform:uppercase;font-family:monospace">
        <button class="btn" data-a="teacher-import-guest">Link Student</button>
      </div>
    </section>

    <!-- Connected Students Live Roster -->
    <section class="card teacher-section-card teacher-roster-card">
      <div class="teacher-section-head">
        <div>
          <h3>${uiIcon("users")} Connected Students Roster (${escapeHTML(teacher.section)})</h3>
          <p class="sub" style="margin:2px 0 0 0">Roster and journey access are stored in this browser. Use the selector to open a higher tier for a student.</p>
        </div>
        <div class="teacher-roster-actions">
          <button class="btn o" data-a="open-report-sheet" data-v="live">${uiIcon("print")} Reading Progress Report</button>
          <button class="btn o" data-a="download-csv" data-v="live">${uiIcon("download")} Export CSV</button>
        </div>
      </div>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to see every student detail and access control.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Connected students roster; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Phil-IRI Reading Level</th>
              <th>Reading Speed</th>
              <th>Comprehension</th>
              <th>Words Read</th>
              <th>Reading Journey Access</th>
              <th>Status / Intervention</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center;padding:24px;color:var(--sub)">
                  No students connected yet. Have students enter your Share Code <b>${escapeHTML(teacher.shareCode)}</b>!
                </td>
              </tr>
            ` : students.map((s, idx) => {
              const isAssessed = s.isAssessed;
              const lvlClass = isAssessed ? `level-${s.lvl}` : 'level-none';
              const lvlText = s.profileLabel;
              const wpmText = s.wpmText;
              const compText = s.compText;
              const isRemedial = isAssessed && (s.lvl === 0 || (typeof s.comp === 'number' && s.comp < 60));

              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${escapeHTML(s.name)}</b></td>
                  <td><span class="level-badge ${lvlClass}">${escapeHTML(lvlText)}</span></td>
                  <td>${escapeHTML(wpmText)}</td>
                  <td><b>${escapeHTML(compText)}</b></td>
                  <td>${(s.wordsRead || 0).toLocaleString()} words</td>
                  <td>
                    <label class="sub-sm" for="journey-override-${escapeHTML(s.id)}">Extra tier access</label>
                    <select id="journey-override-${escapeHTML(s.id)}" class="auth-input" data-a="teacher-journey-override" data-v="${escapeHTML(s.id)}" aria-label="Extra reading tier access for ${escapeHTML(s.name)}">
                      <option value="" ${s.journeyOverride == null ? "selected" : ""}>Automatic path</option>
                      ${DIFF_KEYS.slice(1).map((key, index) => `<option value="${index + 1}" ${s.journeyOverride === index + 1 ? "selected" : ""}>Open through ${escapeHTML(DIFF_NAMES[key])}</option>`).join("")}
                    </select>
                  </td>
                  <td>
                    ${!isAssessed
                      ? '<span class="pill" style="color:var(--sub)">Placement Required</span>'
                      : isRemedial 
                        ? '<span style="color:var(--coral);font-weight:700">⚠️ Needs Intervention</span>'
                        : '<span style="color:var(--teal)">✓ On Track</span>'}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section></div>
  `;
}

