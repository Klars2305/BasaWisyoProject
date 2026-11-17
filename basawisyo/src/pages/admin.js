/* ==========================================================================
   Admin Interface Views
   ========================================================================== */

let CURRENT_ADMIN_TAB = "users"; // 'users', 'classes', 'curriculum', 'benchmarks', 'system'

function viewAdmin() {
  const admin = AUTH.currentUser;
  if (!admin || admin.role !== "admin") {
    return `<div class="card"><p>Access restricted to Administrative accounts. Please sign in as Admin.</p></div>`;
  }

  if (typeof CURRENT_TAB !== "undefined") {
    if (CURRENT_TAB === "users") CURRENT_ADMIN_TAB = "users";
    else if (CURRENT_TAB === "classes") CURRENT_ADMIN_TAB = "classes";
  }

  const allUsers = AUTH.users;
  const students = allUsers.filter(u => u.role === "student");
  const enrolledStudents = students.filter(student => AUTH.getActiveEnrollment(student));
  const pendingStudents = students.filter(student => student.enrollmentStatus === "pending" && student.pendingTeacherCode);
  const teachers = allUsers.filter(u => u.role === "teacher");
  const activeTeachers = teachers.filter(u => u.status === "active");
  const admins = allUsers.filter(u => u.role === "admin");
  const cleanSchool = teachers.length === 0 && students.length === 0 && AUTH.assignments.length === 0;

  // Phil-IRI distribution school-wide
  const frustCount = students.filter(s => s.lvl === 0).length;
  const instCount = students.filter(s => s.lvl === 1).length;
  const indepCount = students.filter(s => s.lvl === 2).length;
  const mastCount = students.filter(s => s.lvl === 3).length;

  const totalPassages = 
    PRACTICE_DATA.easy.length + 
    PRACTICE_DATA.medium.length + 
    PRACTICE_DATA.hard.length + 
    PRACTICE_DATA.extreme.length + 
    AUTH.customPassages.length;
  const pendingPractices = AUTH.customPassages.filter(passage => passage?.status === "pending").length;

  return `<div class="admin-page">
    <div class="dashboard-intro admin-intro">
      <div>
        <div class="lab">Local administration</div>
        <h2>${uiIcon("admin")} School Admin Console</h2>
        <p class="sub">${escapeHTML(admin.school)} · Accounts and curriculum in this browser</p>
      </div>
      <div class="dashboard-intro-actions">
        <button class="btn o" data-a="tour-replay" title="Replay the admin onboarding walkthrough">🎓 Replay Tour</button>
        <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
        <button class="btn o" data-a="admin-export-backup">${uiIcon("backup")} Export Backup</button>
      </div>
    </div>

    ${cleanSchool ? `<div class="card admin-section-card" role="status">
      <div class="lab">First school setup</div>
      <h3>Start with your real teachers and learners</h3>
      <p class="sub">This browser has only the administrator account. Ask teachers to use Create an account on the public page. Each teacher receives a classroom share code; students can enter it when they register or join later. The teacher reviews each request before the student joins the class.</p>
      <p class="sub">The built-in reading passages are ready to use. Sample accounts are optional under Local Data &amp; Backup.</p>
      <div class="dashboard-intro-actions">
        <button class="btn blue" data-a="auth-logout">Sign out to public page</button>
        <button class="btn o" data-a="admin-tab" data-v="system">View sample-data option</button>
      </div>
    </div>` : ""}

    <!-- School Metric Cards -->
    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-value">${allUsers.length}</div>
        <div class="metric-title">Total Users</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--sky)">${enrolledStudents.length}</div>
        <div class="metric-title">Enrolled Students</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${pendingStudents.length}</div>
        <div class="metric-title">Pending Enrollments</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--teal)">${activeTeachers.length}</div>
        <div class="metric-title">Active Teachers</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--gold-ink)">${totalPassages}</div>
        <div class="metric-title">Curriculum Passages</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--coral)">${frustCount}</div>
        <div class="metric-title">Frustration Cases</div>
      </div>
    </div>

    <!-- Admin Navigation Tabs -->
    <div class="auth-tab-bar admin-section-tabs" role="group" aria-label="Admin console sections">
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'users' ? 'active' : ''}" data-a="admin-tab" data-v="users" aria-pressed="${CURRENT_ADMIN_TAB === 'users'}">
        ${uiIcon("users")} User Management (${allUsers.length})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'classes' ? 'active' : ''}" data-a="admin-tab" data-v="classes" aria-pressed="${CURRENT_ADMIN_TAB === 'classes'}">
        ${uiIcon("classes")} Classes & Sections (${teachers.length})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'curriculum' ? 'active' : ''}" data-a="admin-tab" data-v="curriculum" aria-pressed="${CURRENT_ADMIN_TAB === 'curriculum'}">
        ${uiIcon("practice")} Curriculum & Passages (${totalPassages}${pendingPractices ? ` · ${pendingPractices} awaiting review` : ""})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'benchmarks' ? 'active' : ''}" data-a="admin-tab" data-v="benchmarks" aria-pressed="${CURRENT_ADMIN_TAB === 'benchmarks'}">
        ${uiIcon("settings")} Phil-IRI Standards
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'system' ? 'active' : ''}" data-a="admin-tab" data-v="system" aria-pressed="${CURRENT_ADMIN_TAB === 'system'}">
        ${uiIcon("backup")} Local Data & Backup
      </button>
    </div>

    <!-- Admin Sub-tab Content -->
    ${CURRENT_ADMIN_TAB === 'users' ? renderAdminUsersTab(allUsers) : ''}
    ${CURRENT_ADMIN_TAB === 'classes' ? renderAdminClassesTab(teachers, allUsers) : ''}
    ${CURRENT_ADMIN_TAB === 'curriculum' ? renderAdminCurriculumTab() : ''}
    ${CURRENT_ADMIN_TAB === 'benchmarks' ? renderAdminBenchmarksTab() : ''}
    ${CURRENT_ADMIN_TAB === 'system' ? renderAdminSystemTab() : ''}
    </div>
  `;
}

function renderAdminUsersTab(users) {
  return `
    <div class="card admin-section-card">
      <div class="admin-card-head">
        <div class="lab">Registered Accounts Directory</div>
        <div style="font-size:12px;color:var(--sub)">Manage roles, permissions, and passwords</div>
      </div>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to review account details and actions.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Registered accounts; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Section / Code</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td><b>${escapeHTML(u.name)}</b></td>
                <td><code>${escapeHTML(u.email)}</code></td>
                <td>
                  <span class="user-role-badge role-${escapeHTML(u.role)}">${escapeHTML(u.role)}</span>
                </td>
                <td>
                  ${u.role === 'teacher' ? `<b>${escapeHTML(u.shareCode || '')}</b> (${escapeHTML(u.section || 'General')})` : ''}
                  ${u.role === 'student' ? (u.teacherCode ? `Linked: <b>${escapeHTML(u.teacherCode)}</b>`
                    : u.enrollmentStatus === 'pending' && u.pendingTeacherCode ? `Pending: <b>${escapeHTML(u.pendingTeacherCode)}</b>`
                      : '<span style="color:var(--sub)">Unlinked</span>') : ''}
                  ${u.role === 'admin' ? 'System Administrator' : ''}
                </td>
                <td>
                  <span style="color:${u.status === 'active' ? 'var(--teal)' : 'var(--coral)'};font-weight:700">
                    ${u.status === 'active' ? '● Active' : '○ Suspended'}
                  </span>
                </td>
                <td>
                  <div class="admin-row-actions">
                    <button class="btn o" data-a="admin-edit-role" data-v="${escapeHTML(u.id)}">Role</button>
                    <button class="btn o" data-a="admin-toggle-status" data-v="${escapeHTML(u.id)}">
                      ${u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn o" data-a="admin-reset-pwd" data-v="${escapeHTML(u.id)}">Reset PW</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminClassesTab(teachers, allUsers) {
  const students = allUsers.filter(u => u.role === "student");
  const assignments = Array.isArray(AUTH.assignments) ? AUTH.assignments : [];

  return `
    <div class="card admin-section-card">
      <div class="admin-card-head">
        <div>
          <div class="lab">School Classes & Sections Roster</div>
          <div style="font-size:12px;color:var(--sub)">Active sections, assigned teachers, class codes, and enrolled student distribution</div>
        </div>
      </div>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to review section and enrollment details.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="School sections and teachers; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>Section Name</th>
              <th>Teacher Adviser</th>
              <th>Class Share Code</th>
              <th>Enrolled Learners</th>
              <th>Active Assignments</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${teachers.length === 0 ? `
              <tr><td colspan="6" style="text-align:center;padding:18px;color:var(--sub)">No teacher classrooms registered yet.</td></tr>
            ` : teachers.map(t => {
              const enrolled = students.filter(s => s.teacherCode === t.shareCode);
              const classAssignments = assignments.filter(a => a.teacherId === t.id || a.sectionCode === t.section);
              return `
                <tr>
                  <td><b>${escapeHTML(t.section || "General Section")}</b></td>
                  <td>${escapeHTML(t.name)} <br><small style="color:var(--sub)">${escapeHTML(t.email)}</small></td>
                  <td><code>${escapeHTML(t.shareCode || "N/A")}</code></td>
                  <td><b>${enrolled.length}</b> student${enrolled.length === 1 ? "" : "s"}</td>
                  <td>${classAssignments.length} assignment${classAssignments.length === 1 ? "" : "s"}</td>
                  <td>
                    <span style="color:${t.status === 'active' ? 'var(--teal)' : 'var(--coral)'};font-weight:700">
                      ${t.status === 'active' ? '● Active' : '○ Suspended'}
                    </span>
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

function renderAdminCurriculumTab() {
  const customRows = (Array.isArray(AUTH.customPassages) ? AUTH.customPassages : []).map(raw => {
    try {
      const passage = normalizePassage(raw);
      return { ...passage, tier: `Custom (${passage.diff})`, isCustom: true };
    } catch (error) {
      return {
        id: String(raw?.id ?? "unknown"), t: `Invalid passage: ${error.message}`,
        x: "", qs: [], tier: "Needs repair", status: "invalid", isCustom: true
      };
    }
  });
  customRows.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const pendingCount = customRows.filter(p => p.status === "pending").length;
  const allPassages = [
    ...customRows,
    ...PRACTICE_DATA.easy.map(p => ({ ...p, tier: "Madali (Easy)" })),
    ...PRACTICE_DATA.medium.map(p => ({ ...p, tier: "Katamtaman (Medium)" })),
    ...PRACTICE_DATA.hard.map(p => ({ ...p, tier: "Mahirap (Hard)" })),
    ...PRACTICE_DATA.extreme.map(p => ({ ...p, tier: "Matindi (Extreme)" }))
  ];

  return `
    <div class="card admin-section-card">
      <div class="admin-card-head">
        <div>
          <div class="lab">Leveled Reading Curriculum</div>
          <p class="sub" style="margin:2px 0 0 0">Built-in and custom passage records; only published valid passages appear to readers.</p>
        </div>
        <button class="btn blue" data-a="practice-new">${uiIcon("add")} Add passage</button>
      </div>

      <p class="sub">${pendingCount ? `${pendingCount} teacher practice${pendingCount === 1 ? "" : "s"} awaiting review. Approve to add to the student library, or reject with a reason.` : "No teacher practices are awaiting review."}</p>

      <p class="table-scroll-hint sub-sm">Scroll the table sideways to review passage status and approval actions.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading curriculum; scroll horizontally for more columns">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tier</th>
              <th>Passage Title</th>
              <th>Word Count</th>
              <th>Questions</th>
              <th>Status</th>
              <th>Origin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allPassages.map(p => {
              const isCustom = Boolean(p.isCustom);
              return `
                <tr>
                  <td><code>${escapeHTML(p.id)}</code></td>
                  <td><b>${escapeHTML(p.tier)}</b></td>
                  <td>${escapeHTML(p.t)}${p.reviewNote ? `<div class="sub-sm">Review note: ${escapeHTML(p.reviewNote)}</div>` : ""}</td>
                  <td>${wordCount(p.x)} words</td>
                  <td>${p.qs.length} questions</td>
                  <td>${escapeHTML(p.status || "published")}</td>
                  <td>${isCustom ? escapeHTML(AUTH.users.find(user => user.id === p.ownerId)?.name || p.author || "Legacy custom") : 'Standard Core'}</td>
                  <td>
                    <div class="admin-row-actions">
                      ${isCustom ? `
                        ${p.status === "published" ? `<button class="btn o sm" data-a="read-passage" data-v="${escapeHTML(p.id)}">Preview</button>` : ""}
                        ${p.status !== "invalid" ? `<button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(p.id)}">Edit</button>` : ""}
                        ${p.status === "pending" ? `
                          <button class="btn blue sm" data-a="practice-approve" data-v="${escapeHTML(p.id)}">Approve</button>
                          <button class="btn o sm" data-a="practice-reject" data-v="${escapeHTML(p.id)}">Reject</button>
                        ` : ""}
                        ${p.status === "published" ? `<button class="btn o sm" data-a="practice-unpublish" data-v="${escapeHTML(p.id)}">Unpublish</button>` : ""}
                        ${p.status === "draft" && AUTH.users.find(user => user.id === p.ownerId)?.role !== "teacher" ? `<button class="btn o sm" data-a="practice-publish" data-v="${escapeHTML(p.id)}">Publish</button>` : ""}
                        ${AUTH.assignments.some(assignment => assignment.passageId === p.id) ? `<button class="btn o sm" data-a="practice-remove-assignments" data-v="${escapeHTML(p.id)}">Remove class assignments</button>` : ""}
                        <button class="btn o sm danger" data-a="practice-delete" data-v="${escapeHTML(p.id)}">Delete</button>
                      ` : `
                        <button class="btn o sm" data-a="read-passage" data-v="${escapeHTML(p.id)}">Preview</button>
                      `}
                    </div>
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

function renderAdminBenchmarksTab() {
  return `
    <div class="card admin-section-card">
      <div class="lab">DepEd Phil-IRI Calibrated Benchmarks</div>
      <p class="sub">These standards dictate the automatic placement logic across junior and senior high reading assessments.</p>
      
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading benchmark table; scroll horizontally for more columns">
      <table style="margin-top:14px">
        <thead>
          <tr>
            <th>Classification</th>
            <th>Comprehension Range</th>
            <th>Junior High WPM Target</th>
            <th>Senior High WPM Target</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="level-badge level-0">Frustration</span></td>
            <td>&lt; 59%</td>
            <td>&lt; 90 WPM</td>
            <td>&lt; 110 WPM</td>
            <td>Mandatory Remedial Reading & Vocabulary Taps</td>
          </tr>
          <tr>
            <td><span class="level-badge level-1">Instructional</span></td>
            <td>59% – 79%</td>
            <td>90 – 129 WPM</td>
            <td>110 – 149 WPM</td>
            <td>Guided Reading & Inferential Skill Focus</td>
          </tr>
          <tr>
            <td><span class="level-badge level-2">Independent</span></td>
            <td>80% – 89%</td>
            <td>130 – 159 WPM</td>
            <td>150 – 179 WPM</td>
            <td>Self-directed Reading & Critical Analysis</td>
          </tr>
          <tr>
            <td><span class="level-badge level-3">Mastery</span></td>
            <td>90% – 100%</td>
            <td>160+ WPM</td>
            <td>180+ WPM</td>
            <td>Peer Tutoring & Advanced Synthesis</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function renderAdminSystemTab() {
  const canLoadSamples = AUTH.users.every(user => user.role === "admin") && AUTH.assignments.length === 0;
  return `
    <div class="card admin-section-card">
      <div class="lab">Local Data & Emergency Backup</div>
      <p class="sub" style="margin-bottom:14px">
        Export this browser's accounts, share codes, assignments, and curriculum. Works completely offline.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" data-a="admin-export-backup">${uiIcon("backup")} Export Complete JSON Backup</button>
        <button class="btn o" data-a="admin-restore-backup-trigger">${uiIcon("upload")} Restore from JSON File</button>
        <button class="btn o danger" data-a="admin-reset-presets">${uiIcon("reset")} Erase local school records and restart</button>
      </div>
      <input type="file" id="admin-restore-file" style="display:none" accept=".json,application/json">
    </div>
    <div class="card admin-section-card">
      <div class="lab">Optional presentation data</div>
      <p class="sub">A new school starts with one administrator and no sample users. You can add a sample teacher, students, and assignments for a demonstration. This is available only while the school has no teacher, student, or assignment records.</p>
      ${canLoadSamples
        ? `<button class="btn o" data-a="admin-load-demo">Load sample accounts and assignments</button>`
        : `<p class="sub" role="status">This school already has account or assignment records. Sample data is unavailable to avoid mixing demo records with real learners.</p>`}
    </div>
  `;
}


