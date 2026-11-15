/* ==========================================================================
   BasaWisyo Teacher: Teacher Reading Studio
   Import custom materials, multi-skill question drafting, interactive question editor,
   approval workflow (Draft -> Pending -> Approved -> Published), and class assignments.
   ========================================================================== */

let TEACHER_STUDIO_TEXT = "";
let TEACHER_STUDIO_TITLE = "";
let TEACHER_STUDIO_AUTHOR = "";
let TEACHER_STUDIO_LANG = "en";
let TEACHER_STUDIO_DIFF = "medium";
let TEACHER_STUDIO_Q_COUNT = 5;
let TEACHER_STUDIO_QUESTIONS = [];
let TEACHER_STUDIO_VOCAB = [];
let TEACHER_STUDIO_IS_LOADING = false;
let TEACHER_STUDIO_WARNING = "";
let TEACHER_STUDIO_EDITING_ID = null;
let TEACHER_STUDIO_SUBTAB = "editor"; // 'editor', 'queue', 'assignments'

/**
 * Renders Teacher Reading Studio view.
 * @returns {string} HTML markup
 */
function viewTeacherReadingStudio() {
  const teacher = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  if (!teacher || (teacher.role !== "teacher" && teacher.role !== "admin")) {
    return `<div class="card"><p>Access restricted to Teachers and Administrators. Please sign in with an authorized account.</p></div>`;
  }

  const stats = typeof normalizeImportedText === "function"
    ? normalizeImportedText(TEACHER_STUDIO_TEXT)
    : { wordCount: 0, charCount: 0, estMinutes: 1, suggestedTier: "medium" };

  return `
    <div class="teacher-reading-studio-page">
      <!-- Studio Intro -->
      <div class="dashboard-intro">
        <div>
          <div class="lab" style="color:var(--teal-ink)">${uiIcon("teacher")} Teacher Workspace</div>
          <h2>Teacher Reading Studio</h2>
          <p class="sub">Import curriculum passages, generate multi-skill questions with Wisyo AI, refine answer keys, and assign reading assessments to your classes.</p>
        </div>
        <div class="dashboard-intro-actions">
          <button class="btn sm ${TEACHER_STUDIO_SUBTAB === 'editor' ? 'blue' : 'o'}" data-a="tstudio-subtab" data-v="editor">
            ${uiIcon("add")} Material &amp; Questions
          </button>
          <button class="btn sm ${TEACHER_STUDIO_SUBTAB === 'queue' ? 'blue' : 'o'}" data-a="tstudio-subtab" data-v="queue">
            ${uiIcon("badge")} Approval Status
          </button>
          <button class="btn sm ${TEACHER_STUDIO_SUBTAB === 'assignments' ? 'blue' : 'o'}" data-a="tstudio-subtab" data-v="assignments">
            ${uiIcon("classroom")} Class Assignments
          </button>
        </div>
      </div>

      <!-- Local Prototype Transparency Advisory -->
      <div class="card" style="background:var(--sky-soft);border-left:4px solid var(--sky);margin-bottom:18px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:1.25rem;line-height:1">ℹ️</span>
          <div>
            <b style="color:var(--sky-ink);font-size:0.9rem">Local-First School Prototype</b>
            <div class="sub-sm" style="margin-top:2px">
              Materials and assignments are saved locally in this browser. To distribute an assignment to student devices without a live network server, use the <b>Export Content Package</b> feature.
            </div>
          </div>
        </div>
      </div>

      ${TEACHER_STUDIO_SUBTAB === "queue" 
        ? renderTeacherApprovalQueueView() 
        : TEACHER_STUDIO_SUBTAB === "assignments" 
          ? renderTeacherAssignmentsView() 
          : renderTeacherEditorView(stats)}
    </div>
  `;
}

/**
 * Renders the primary material import and question editor tab.
 * @param {Object} stats 
 * @returns {string} HTML markup
 */
function renderTeacherEditorView(stats) {
  return `
    <div class="teacher-studio-grid" style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start">
      <!-- Left Column: Source Material & Interactive Question Editor -->
      <div>
        <!-- Material Source Card -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header teacher-step-header" style="margin-bottom:12px">
            <div>
              <div class="lab">Step 1 · Reading Content</div>
              <h3 style="margin:2px 0">Passage Text &amp; Metadata</h3>
            </div>
            <div>
              <input type="file" id="tstudio-file-input" accept=".txt,.docx,.pdf" style="display:none" data-a="tstudio-file-change">
              <button type="button" class="btn sm o" data-a="tstudio-file-trigger">
                ${uiIcon("upload")} Upload File (PDF/DOCX/TXT)
              </button>
            </div>
          </div>

          ${TEACHER_STUDIO_WARNING ? `
            <div class="card" style="background:#FFF1F2;border-left:4px solid var(--coral);padding:10px 14px;margin-bottom:14px">
              <b style="color:var(--coral);font-size:0.85rem">Notice:</b>
              <div class="sub-sm" style="margin-top:2px">${escapeHTML(TEACHER_STUDIO_WARNING)}</div>
            </div>
          ` : ""}

          <div class="teacher-meta-grid">
            <label>
              <span class="lab">Passage Title</span>
              <input type="text" id="tstudio-title-input" class="auth-input" placeholder="e.g. The Mangrove Sanctuaries of Bohol" value="${escapeHTML(TEACHER_STUDIO_TITLE || stats.cleanTitle)}">
            </label>
            <label>
              <span class="lab">Author / Curriculum Source</span>
              <input type="text" id="tstudio-author-input" class="auth-input" placeholder="e.g. DepEd Region VII" value="${escapeHTML(TEACHER_STUDIO_AUTHOR || "DepEd Curriculum")}">
            </label>
          </div>

          <label style="display:block;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span class="lab">Passage Text</span>
              <span class="sub-sm"><b>${stats.wordCount}</b> words · <b>${stats.charCount}</b> chars</span>
            </div>
            <textarea id="tstudio-text-input" class="auth-input" rows="8" style="font-family:inherit;font-size:0.95rem;line-height:1.6;resize:vertical" placeholder="Paste or type curriculum passage text here...">${escapeHTML(TEACHER_STUDIO_TEXT)}</textarea>
          </label>
        </div>

        <!-- Interactive Question Editor Card -->
        <div class="card">
          <div class="card-header teacher-step-header" style="margin-bottom:12px">
            <div>
              <div class="lab">Step 2 · Teacher Question Review</div>
              <h3 style="margin:2px 0">Comprehension Questions (${TEACHER_STUDIO_QUESTIONS.length})</h3>
            </div>
            <button type="button" class="btn sm o" data-a="tstudio-add-question">
              ${uiIcon("add")} Add Custom Question
            </button>
          </div>

          ${TEACHER_STUDIO_QUESTIONS.length === 0 ? `
            <div style="text-align:center;padding:30px 10px;background:var(--bg);border-radius:var(--radius-sm)">
              <div style="font-size:2rem;margin-bottom:6px">💡</div>
              <b>No Questions Generated Yet</b>
              <p class="sub-sm" style="max-width:360px;margin:4px auto 0">
                Click <b>Draft Questions with Wisyo AI</b> in the side panel to propose comprehension questions, or add custom questions manually.
              </p>
            </div>
          ` : `
            <div class="teacher-questions-list" style="display:flex;flex-direction:column;gap:14px">
              ${TEACHER_STUDIO_QUESTIONS.map((q, qIdx) => `
                <div class="card" style="margin:0;border:1px solid var(--border);background:var(--card-bg)">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span class="sub-sm">
                      Question ${qIdx + 1} of ${TEACHER_STUDIO_QUESTIONS.length} · 
                      <b style="color:var(--navy)">${escapeHTML(q.k || "Literal")}</b>
                    </span>
                    <button type="button" class="icon-btn" data-a="tstudio-delete-q" data-v="${qIdx}" title="Delete question" aria-label="Delete question">
                      ${uiIcon("trash")}
                    </button>
                  </div>

                  <!-- Question Prompt -->
                  <label style="display:block;margin-bottom:10px">
                    <span class="lab">Question Prompt</span>
                    <input type="text" class="auth-input tstudio-q-prompt" data-idx="${qIdx}" value="${escapeHTML(q.q)}">
                  </label>

                  <!-- 4 Options -->
                  <div style="margin-bottom:10px">
                    <span class="lab" style="display:block;margin-bottom:4px">Answer Choices (Select radio button for Correct Answer)</span>
                    <div style="display:flex;flex-direction:column;gap:6px">
                      ${q.o.map((opt, optIdx) => `
                        <div style="display:flex;align-items:center;gap:8px">
                          <input type="radio" name="correct_key_${qIdx}" value="${optIdx}" ${q.a === optIdx ? 'checked' : ''} data-a="tstudio-set-key" data-qidx="${qIdx}" data-optidx="${optIdx}" aria-label="Option ${String.fromCharCode(65 + optIdx)} correct">
                          <span style="font-weight:700;font-size:0.85rem;width:20px">${String.fromCharCode(65 + optIdx)}</span>
                          <input type="text" class="auth-input tstudio-opt-input" style="flex:1" data-qidx="${qIdx}" data-optidx="${optIdx}" value="${escapeHTML(opt)}">
                        </div>
                      `).join("")}
                    </div>
                  </div>

                  <!-- Text Evidence Explanation -->
                  <label style="display:block">
                    <span class="lab">Text Evidence &amp; Explanation</span>
                    <input type="text" class="auth-input tstudio-exp-input" data-idx="${qIdx}" placeholder="Cite the passage clue supporting this answer..." value="${escapeHTML(q.exp || "")}">
                  </label>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      </div>

      <!-- Right Column: AI Generator & Workflow Controls -->
      <div class="card" style="margin:0">
        <div class="card-header" style="margin-bottom:12px">
          <div>
            <div class="lab">AI Drafting &amp; Controls</div>
            <h3 style="margin:2px 0">Drafting Settings</h3>
          </div>
        </div>

        <label style="display:block;margin-bottom:12px">
          <span class="lab">Language</span>
          <select id="tstudio-lang-select" class="auth-input">
            <option value="en" ${TEACHER_STUDIO_LANG === 'en' ? 'selected' : ''}>English</option>
            <option value="fil" ${TEACHER_STUDIO_LANG === 'fil' ? 'selected' : ''}>Filipino</option>
            <option value="ceb" ${TEACHER_STUDIO_LANG === 'ceb' ? 'selected' : ''}>Cebuano / Bisaya</option>
          </select>
        </label>

        <label style="display:block;margin-bottom:12px">
          <span class="lab">Difficulty Level</span>
          <select id="tstudio-diff-select" class="auth-input">
            <option value="easy" ${TEACHER_STUDIO_DIFF === 'easy' ? 'selected' : ''}>Easy (Grades 7–8)</option>
            <option value="medium" ${TEACHER_STUDIO_DIFF === 'medium' ? 'selected' : ''}>Medium (Grades 9–10)</option>
            <option value="hard" ${TEACHER_STUDIO_DIFF === 'hard' ? 'selected' : ''}>Hard (Grades 11–12)</option>
          </select>
        </label>

        <div style="margin-bottom:16px">
          <span class="lab" style="display:block;margin-bottom:6px">Questions Count</span>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px">
            ${[5, 10, 15].map(cnt => `
              <button type="button" class="btn sm ${TEACHER_STUDIO_Q_COUNT === cnt ? 'blue' : 'o'}" data-a="tstudio-qcount" data-v="${cnt}">
                ${cnt} Qs
              </button>
            `).join("")}
          </div>
        </div>

        <button type="button" class="btn o" data-a="tstudio-draft-ai" style="width:100%;margin-bottom:16px" ${TEACHER_STUDIO_IS_LOADING ? 'disabled' : ''}>
          ${TEACHER_STUDIO_IS_LOADING ? 'Generating Draft Questions...' : `${uiIcon("sparkles")} Draft Questions with Wisyo AI`}
        </button>

        <!-- Save & Approval Actions -->
        <div style="border-top:1px solid var(--border);padding-top:16px">
          <span class="lab" style="display:block;margin-bottom:8px">Material Lifecycle</span>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" class="btn blue" data-a="tstudio-save-draft" style="width:100%">
              ${uiIcon("download")} Save as Teacher Draft
            </button>
            <button type="button" class="btn o" data-a="tstudio-submit-approval" style="width:100%">
              ${uiIcon("send")} Submit for Admin Approval
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the approval status queue for teacher materials.
 * @returns {string} HTML markup
 */
function renderTeacherApprovalQueueView() {
  const teacher = typeof AUTH !== "undefined" ? AUTH.currentUser : { id: "teacher", role: "teacher" };
  const allMaterials = typeof readLocalMaterials === "function" ? readLocalMaterials() : [];
  const teacherMaterials = allMaterials.filter(m => m.ownerId === teacher?.id || m.ownerRole === "teacher");

  return `
    <div class="card">
      <div class="card-header" style="margin-bottom:16px">
        <div>
          <div class="lab">${uiIcon("badge")} Material Lifecycle</div>
          <h3 style="margin:2px 0">Approval &amp; Publication Status</h3>
        </div>
      </div>

      ${teacherMaterials.length === 0 ? `
        <div style="text-align:center;padding:30px 10px">
          <p class="sub">You haven't saved any materials yet. Create a draft in the Material &amp; Questions tab.</p>
        </div>
      ` : `
        <div class="table-responsive" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table class="table" style="width:100%;min-width:540px">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Words</th>
                <th>Questions</th>
                <th>Version</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${teacherMaterials.map(m => `
                <tr>
                  <td><b>${escapeHTML(m.title)}</b></td>
                  <td><span class="badge-diff diff-${m.difficulty}">${m.difficulty.toUpperCase()}</span></td>
                  <td>${m.wordCount || 0}</td>
                  <td>${m.questions?.length || 0}</td>
                  <td>v${m.version || 1}</td>
                  <td>
                    <span class="pill ${m.status === 'approved' || m.status === 'published' ? 'ok' : m.status === 'pending' ? 'blue' : 'warn'}">
                      ${m.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn sm o" data-a="tstudio-load-edit" data-v="${escapeHTML(m.id)}">Edit</button>
                      ${m.status === 'draft' ? `
                        <button class="btn sm blue" data-a="tstudio-submit-approval-id" data-v="${escapeHTML(m.id)}">Submit</button>
                      ` : ''}
                      <button class="btn sm o" data-a="tstudio-assign-material" data-v="${escapeHTML(m.id)}">Assign</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/**
 * Renders the Class Assignments management tab.
 * @returns {string} HTML markup
 */
function renderTeacherAssignmentsView() {
  const teacher = typeof AUTH !== "undefined" ? AUTH.currentUser : { id: "teacher", role: "teacher", section: "Grade 8 - Rizal" };
  const assignments = typeof listAssignments === "function" ? listAssignments({ role: "teacher", id: teacher?.id }) : [];
  const allMaterials = typeof readLocalMaterials === "function" ? readLocalMaterials() : [];

  return `
    <div class="card">
      <div class="card-header" style="margin-bottom:16px">
        <div>
          <div class="lab">${uiIcon("classroom")} Distribution Hub</div>
          <h3 style="margin:2px 0">Classroom Reading Assignments</h3>
        </div>
        <div style="display:flex;gap:8px">
          <input type="file" id="tstudio-import-pkg-input" accept=".json" style="display:none" data-a="tstudio-import-pkg-change">
          <button class="btn sm o" data-a="tstudio-import-pkg-trigger">
            ${uiIcon("upload")} Import Package (.json)
          </button>
        </div>
      </div>

      <!-- New Assignment Quick Form -->
      <div class="card" style="background:var(--bg);margin-bottom:20px;border:1px solid var(--border)">
        <h4 style="margin:0 0 10px 0">Create New Class Assignment</h4>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:10px;align-items:end">
          <label>
            <span class="lab">Select Reading Material</span>
            <select id="tstudio-assign-mat-select" class="auth-input">
              ${allMaterials.map(m => `
                <option value="${escapeHTML(m.id)}">${escapeHTML(m.title)} (${m.questions?.length || 0} Qs · ${m.difficulty})</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span class="lab">Class Section</span>
            <input type="text" id="tstudio-assign-section-input" class="auth-input" value="${escapeHTML(teacher?.section || "Grade 8 - Rizal")}">
          </label>
          <label>
            <span class="lab">Due Date</span>
            <input type="date" id="tstudio-assign-due-input" class="auth-input" value="2026-11-30">
          </label>
          <label>
            <span class="lab">Mode</span>
            <select id="tstudio-assign-mode-select" class="auth-input">
              <option value="practice">Practice Mode</option>
              <option value="assessment">Formal Assessment</option>
            </select>
          </label>
          <button type="button" class="btn blue" data-a="tstudio-create-assignment-action" style="padding:10px 16px">
            Assign to Class
          </button>
        </div>
      </div>

      <!-- Active Assignments Table -->
      ${assignments.length === 0 ? `
        <p class="sub" style="text-align:center;padding:20px">No active assignments yet. Create one above to assign reading materials to your students.</p>
      ` : `
        <table class="table" style="width:100%">
          <thead>
            <tr>
              <th>Assignment Title</th>
              <th>Class Section</th>
              <th>Due Date</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${assignments.map(a => `
              <tr>
                <td><b>${escapeHTML(a.title)}</b></td>
                <td>${escapeHTML(a.targetGroup || a.section || "General")}</td>
                <td>${escapeHTML(a.dueDate || "Flexible")}</td>
                <td><span class="pill ${a.mode === 'assessment' ? 'warn' : 'ok'}">${escapeHTML(a.mode || 'practice').toUpperCase()}</span></td>
                <td><span class="pill blue">${escapeHTML(a.status || 'active').toUpperCase()}</span></td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn sm o" data-a="tstudio-export-pkg" data-v="${escapeHTML(a.id)}" title="Export content package for student devices">
                      ${uiIcon("download")} Export Package
                    </button>
                    <button class="btn sm o" data-a="tstudio-delete-assignment" data-v="${escapeHTML(a.id)}" title="Remove assignment">
                      ${uiIcon("trash")}
                    </button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `}
    </div>
  `;
}
