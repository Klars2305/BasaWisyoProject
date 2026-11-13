/* ==========================================================================
   Admin Interface Views
   ========================================================================== */

let CURRENT_ADMIN_TAB = "users"; // 'users', 'curriculum', 'benchmarks', 'system'

function viewAdmin() {
  const admin = AUTH.currentUser;
  if (!admin || admin.role !== "admin") {
    return `<div class="card"><p>Access restricted to Administrative accounts. Please sign in as Admin.</p></div>`;
  }

  const allUsers = AUTH.users;
  const students = allUsers.filter(u => u.role === "student");
  const teachers = allUsers.filter(u => u.role === "teacher");
  const admins = allUsers.filter(u => u.role === "admin");

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

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px">
      <div>
        <h2 style="margin:0">ðŸ›¡ï¸ DepEd School Admin Console</h2>
        <p class="sub" style="margin:4px 0 0 0">${admin.school} Â· Master Oversight & Curriculum Control</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn gold" data-a="admin-open-add-passage">âž• Add Passage</button>
        <button class="btn o" data-a="admin-export-backup">ðŸ’¾ Export Backup</button>
      </div>
    </div>

    <!-- School Metric Cards -->
    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-value">${allUsers.length}</div>
        <div class="metric-title">Total Users</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--sky)">${students.length}</div>
        <div class="metric-title">Enrolled Students</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--teal)">${teachers.length}</div>
        <div class="metric-title">Active Teachers</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--gold)">${totalPassages}</div>
        <div class="metric-title">Curriculum Passages</div>
      </div>
      <div class="metric-box">
        <div class="metric-value" style="color:var(--coral)">${frustCount}</div>
        <div class="metric-title">Frustration Cases</div>
      </div>
    </div>

    <!-- Admin Navigation Tabs -->
    <div class="auth-tab-bar" style="margin-bottom:18px">
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'users' ? 'active' : ''}" data-a="admin-tab" data-v="users">
        ðŸ‘¥ User Management (${allUsers.length})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'curriculum' ? 'active' : ''}" data-a="admin-tab" data-v="curriculum">
        ðŸ“š Curriculum & Passages (${totalPassages})
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'benchmarks' ? 'active' : ''}" data-a="admin-tab" data-v="benchmarks">
        âš™ï¸ Phil-IRI Standards
      </button>
      <button class="auth-tab-btn ${CURRENT_ADMIN_TAB === 'system' ? 'active' : ''}" data-a="admin-tab" data-v="system">
        ðŸ’¾ Database & Backup
      </button>
    </div>

    <!-- Admin Sub-tab Content -->
    ${CURRENT_ADMIN_TAB === 'users' ? renderAdminUsersTab(allUsers) : ''}
    ${CURRENT_ADMIN_TAB === 'curriculum' ? renderAdminCurriculumTab() : ''}
    ${CURRENT_ADMIN_TAB === 'benchmarks' ? renderAdminBenchmarksTab() : ''}
    ${CURRENT_ADMIN_TAB === 'system' ? renderAdminSystemTab() : ''}
  `;
}

function renderAdminUsersTab(users) {
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div class="lab">Registered Accounts Directory</div>
        <div style="font-size:12px;color:var(--sub)">Manage roles, permissions, and passwords</div>
      </div>

      <div class="responsive-table-wrap">
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
                <td><b>${u.name}</b></td>
                <td><code>${u.email}</code></td>
                <td>
                  <span class="user-role-badge role-${u.role}">${u.role}</span>
                </td>
                <td>
                  ${u.role === 'teacher' ? `<b>${u.shareCode}</b> (${u.section || 'General'})` : ''}
                  ${u.role === 'student' ? (u.teacherCode ? `Linked: <b>${u.teacherCode}</b>` : '<span style="color:var(--sub)">Unlinked</span>') : ''}
                  ${u.role === 'admin' ? 'System Administrator' : ''}
                </td>
                <td>
                  <span style="color:${u.status === 'active' ? 'var(--teal)' : 'var(--coral)'};font-weight:700">
                    ${u.status === 'active' ? 'â— Active' : 'â—‹ Suspended'}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn o" style="font-size:11px;padding:2px 8px" data-a="admin-edit-role" data-v="${u.id}">Role</button>
                    <button class="btn o" style="font-size:11px;padding:2px 8px" data-a="admin-toggle-status" data-v="${u.id}">
                      ${u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn o" style="font-size:11px;padding:2px 8px" data-a="admin-reset-pwd" data-v="${u.id}">Reset PW</button>
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
  const allPassages = [
    ...PRACTICE_DATA.easy.map(p => ({ ...p, tier: "Madali (Easy)" })),
    ...PRACTICE_DATA.medium.map(p => ({ ...p, tier: "Katamtaman (Medium)" })),
    ...PRACTICE_DATA.hard.map(p => ({ ...p, tier: "Mahirap (Hard)" })),
    ...PRACTICE_DATA.extreme.map(p => ({ ...p, tier: "Matindi (Extreme)" })),
    ...customRows
  ];

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div class="lab">Leveled Reading Curriculum</div>
          <p class="sub" style="margin:2px 0 0 0">Built-in and custom passage records; only published valid passages appear to readers.</p>
        </div>
        <button class="btn gold" data-a="admin-open-add-passage">âž• Add New Passage</button>
      </div>

      <div class="responsive-table-wrap">
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
                  <td>${escapeHTML(p.t)}</td>
                  <td>${wordCount(p.x)} words</td>
                  <td>${p.qs.length} questions</td>
                  <td>${escapeHTML(p.status || "published")}</td>
                  <td>${isCustom ? '<span style="color:var(--gold);font-weight:700">Admin Custom</span>' : 'Standard Core'}</td>
                  <td>
                    ${isCustom ? `
                      ${p.status === "published" ? `<button class="btn o" style="font-size:11px;padding:2px 8px" data-a="read-passage" data-v="${escapeHTML(p.id)}">Preview</button>` : ""}
                      <button class="btn o" style="font-size:11px;padding:2px 8px;color:var(--coral)" data-a="admin-delete-passage" data-v="${escapeHTML(p.id)}">Delete</button>
                    ` : `
                      <button class="btn o" style="font-size:11px;padding:2px 8px" data-a="read-passage" data-v="${p.id}">Preview</button>
                    `}
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
    <div class="card">
      <div class="lab">DepEd Phil-IRI Calibrated Benchmarks</div>
      <p class="sub">These standards dictate the automatic placement logic across junior and senior high reading assessments.</p>
      
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
            <td>59% â€“ 79%</td>
            <td>90 â€“ 129 WPM</td>
            <td>110 â€“ 149 WPM</td>
            <td>Guided Reading & Inferential Skill Focus</td>
          </tr>
          <tr>
            <td><span class="level-badge level-2">Independent</span></td>
            <td>80% â€“ 89%</td>
            <td>130 â€“ 159 WPM</td>
            <td>150 â€“ 179 WPM</td>
            <td>Self-directed Reading & Critical Analysis</td>
          </tr>
          <tr>
            <td><span class="level-badge level-3">Mastery</span></td>
            <td>90% â€“ 100%</td>
            <td>160+ WPM</td>
            <td>180+ WPM</td>
            <td>Peer Tutoring & Advanced Synthesis</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminSystemTab() {
  return `
    <div class="card">
      <div class="lab">Database Operations & Emergency Backup</div>
      <p class="sub" style="margin-bottom:14px">
        Export the complete school state including accounts, share codes, assignments, and curriculum. Works completely offline.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" data-a="admin-export-backup">ðŸ’¾ Export Complete JSON Backup</button>
        <button class="btn o" data-a="admin-restore-backup-trigger">ðŸ“¥ Restore from JSON File</button>
        <button class="btn o" style="color:var(--coral)" data-a="admin-reset-presets">ðŸ”„ Reset to DepEd Factory Presets</button>
      </div>
      <input type="file" id="admin-restore-file" style="display:none" accept=".json,application/json">
    </div>
  `;
}


