/* One teacher reading-content workflow: Add passage, approval, and assignments. */
const LEGACY_MATERIAL_LINKS_KEY = "basa_wisyo_legacy_material_links_v1";
let TEACHER_STUDIO_SUBTAB = "queue";

function readLegacyMaterialLinks() {
  try {
    const links = JSON.parse(localStorage.getItem(LEGACY_MATERIAL_LINKS_KEY) || "{}");
    return links && typeof links === "object" && !Array.isArray(links) ? links : {};
  }
  catch (error) { return {}; }
}

function linkLegacyMaterialToPassage(materialId, passageId) {
  try {
    const links = readLegacyMaterialLinks();
    links[materialId] = passageId;
    localStorage.setItem(LEGACY_MATERIAL_LINKS_KEY, JSON.stringify(links));
  } catch (error) { console.warn("Legacy material link could not be saved.", error); }
}

function legacyTeacherMaterials(actorId) {
  return (typeof readLocalMaterials === "function" ? readLocalMaterials() : [])
    .filter(material => material?.sourceType === "teacher_studio" && material.ownerId === actorId);
}

function legacyMaterialPassage(material) {
  const status = ["draft", "pending", "rejected", "published"].includes(material.status)
    ? material.status : "pending";
  const questions = Array.isArray(material.questions) ? material.questions.map(question => ({
    q: question?.q, o: question?.o, a: question?.a,
    k: question?.k || "Literal", exp: question?.exp || undefined
  })) : [];
  return normalizePassage({
    id: material.id, t: material.title, x: material.text, diff: material.difficulty,
    lang: { en: "en-US", fil: "fil-PH", ceb: "ceb-PH" }[material.language] || "en-US",
    qs: questions, status, ownerId: material.ownerId,
    author: material.author || material.ownerName || "Teacher",
    reviewNote: material.reviewNote || undefined
  });
}

function migrateLegacyTeacherMaterials() {
  const actor = AUTH.currentUser;
  if (actor?.role !== "teacher") return 0;
  const links = readLegacyMaterialLinks();
  const existing = new Set(AUTH.customPassages.map(passage => passage?.id));
  const migrated = [];
  for (const material of legacyTeacherMaterials(actor.id)) {
    if (existing.has(material.id) || links[material.id]) continue;
    try {
      const passage = legacyMaterialPassage(material);
      migrated.push(passage);
      existing.add(passage.id);
    } catch (error) {
      // Incomplete drafts remain visible below so their author can finish them.
    }
  }
  if (!migrated.length) return 0;
  try {
    AUTH.persistPractices([...AUTH.customPassages, ...migrated]);
    migrated.forEach(passage => linkLegacyMaterialToPassage(passage.id, passage.id));
    return migrated.length;
  } catch (error) {
    console.warn("Legacy materials were kept in their original store.", error);
    return 0;
  }
}

/**
 * Renders Teacher Reading Studio view.
 * @returns {string} HTML markup
 */
function viewTeacherReadingStudio() {
  const teacher = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  if (!teacher || (teacher.role !== "teacher" && teacher.role !== "admin")) {
    return `<div class="card"><p>Access restricted to Teachers and Administrators. Please sign in with an authorized account.</p></div>`;
  }

  return `
    <div class="teacher-reading-studio-page">
      <div class="subnav-segmented" role="tablist" aria-label="Materials section switcher">
        <button class="subnav-tab active" data-a="tab" data-v="teacher-studio">
          ${uiIcon("studio")} <span>Teacher Reading Studio</span>
        </button>
        <button class="subnav-tab" data-a="tab" data-v="practice">
          ${uiIcon("practice")} <span>Passage Library</span>
        </button>
      </div>

      <!-- Studio Intro -->
      <div class="dashboard-intro">
        <div>
          <div class="lab" style="color:var(--teal-ink)">${uiIcon("teacher")} Teacher Workspace</div>
          <h2>Teacher Reading Studio</h2>
          <p class="sub">Create passages in one editor, track admin approval, and manage class assignments.</p>
        </div>
        <div class="dashboard-intro-actions">
          <button class="btn sm blue" data-a="practice-new">
            ${uiIcon("add")} Add passage
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

      ${TEACHER_STUDIO_SUBTAB === "assignments"
        ? renderTeacherAssignmentsView()
        : renderTeacherApprovalQueueView()}
    </div>
  `;
}

/**
 * Renders the approval status queue for teacher materials.
 * @returns {string} HTML markup
 */
function renderTeacherApprovalQueueView() {
  const teacher = AUTH.currentUser;
  const passages = AUTH.customPassages.flatMap(raw => {
    try { return [normalizePassage(raw)]; }
    catch (error) { return []; }
  }).filter(passage => passage.ownerId === teacher.id);
  const passageIds = new Set(passages.map(passage => passage.id));
  const links = readLegacyMaterialLinks();
  const incompleteLegacy = legacyTeacherMaterials(teacher.id)
    .filter(material => !passageIds.has(material.id) && !links[material.id]);

  return `
    <div class="card">
      <div class="card-header" style="margin-bottom:16px">
        <div>
          <div class="lab">${uiIcon("badge")} Passage Lifecycle</div>
          <h3 style="margin:2px 0">Approval &amp; Publication Status</h3>
        </div>
      </div>
      ${passages.length ? `<div class="teacher-practice-list">
        ${passages.map(passage => `<article class="teacher-practice-row">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div><b>${escapeHTML(passage.t)}</b><div class="sub-sm">${escapeHTML(passage.diff)} · ${passage.qs.length} questions · ${wordCount(passage.x)} words</div></div>
            <span class="pill">${escapeHTML(passage.status)}</span>
          </div>
          ${passage.reviewNote ? `<p class="sub-sm">Admin note: ${escapeHTML(passage.reviewNote)}</p>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            ${["draft", "rejected"].includes(passage.status) ? `
              <button class="btn o sm" data-a="practice-edit" data-v="${escapeHTML(passage.id)}">Edit</button>
              <button class="btn o sm" data-a="practice-delete" data-v="${escapeHTML(passage.id)}">Delete</button>
            ` : ""}
            ${passage.status === "pending" ? `<button class="btn o sm" data-a="practice-withdraw" data-v="${escapeHTML(passage.id)}">Withdraw to edit</button>` : ""}
            ${passage.status === "published" ? `<button class="btn o sm" data-a="tstudio-assign-material" data-v="${escapeHTML(passage.id)}">Assign</button>` : ""}
          </div>
        </article>`).join("")}
      </div>` : `<p class="sub">No passages yet. Choose Add passage to create one.</p>`}
      ${incompleteLegacy.length ? `<section style="margin-top:20px" aria-label="Legacy materials needing review">
        <h4>Older materials needing completion</h4>
        <p class="sub-sm">These remain in their original browser storage. Complete them in Add passage; existing assignment packages remain available.</p>
        <div class="teacher-practice-list">
          ${incompleteLegacy.map(material => `<article class="teacher-practice-row">
            <b>${escapeHTML(material.title || "Untitled material")}</b>
            <div class="sub-sm">${Array.isArray(material.questions) ? material.questions.length : 0} questions · ${escapeHTML(material.status || "draft")}</div>
            <button class="btn o sm" data-a="tstudio-convert-legacy" data-v="${escapeHTML(material.id)}">Complete in Add passage</button>
          </article>`).join("")}
        </div>
      </section>` : ""}
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
  const publishedPassages = getPublishedPassages();

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
      <div class="card teacher-assignment-create-card" style="background:var(--bg);margin-bottom:20px;border:1px solid var(--border)">
        <h4 style="margin:0 0 10px 0">Create New Class Assignment</h4>
        <div class="teacher-assignment-form-grid">
          <label>
            <span class="lab">Select Published Passage</span>
            <select id="tstudio-assign-mat-select" class="auth-input">
              ${publishedPassages.map(passage => `
                <option value="${escapeHTML(passage.id)}">${escapeHTML(passage.t)} (${passage.qs.length} Qs · ${escapeHTML(passage.diff)})</option>
              `).join("")}
            </select>
          </label>
          <label>
            <span class="lab">Class Section</span>
            <input type="text" id="tstudio-assign-section-input" class="auth-input" placeholder="e.g. Grade 8 - Rizal" value="${escapeHTML(teacher?.section || "Grade 8 - Rizal")}">
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
          <button type="button" class="btn blue teacher-assign-btn" data-a="tstudio-create-assignment-action" style="padding:10px 16px">
            Assign to Class
          </button>
        </div>
      </div>

      <!-- Active Assignments: Desktop Table & Mobile Cards -->
      ${assignments.length === 0 ? `
        <p class="sub" style="text-align:center;padding:20px">No active assignments yet. Create one above to assign reading materials to your students.</p>
      ` : `
        <!-- Desktop Table View -->
        <div class="desktop-assignments-table table-responsive" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
          <table class="table" style="width:100%;min-width:620px">
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
        </div>

        <!-- Mobile Stacked Card View -->
        <div class="mobile-assignments-list">
          ${assignments.map(a => `
            <div class="card assignment-mobile-card" style="margin:0 0 12px 0;padding:14px;border:1px solid var(--border);background:var(--card-bg)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
                <b style="font-size:0.95rem;color:var(--text)">${escapeHTML(a.title)}</b>
                <span class="pill ${a.mode === 'assessment' ? 'warn' : 'ok'}">${escapeHTML(a.mode || 'practice').toUpperCase()}</span>
              </div>
              <div class="sub-sm" style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px;color:var(--sub)">
                <div><b>Section:</b> ${escapeHTML(a.targetGroup || a.section || "General")}</div>
                <div><b>Due:</b> ${escapeHTML(a.dueDate || "Flexible")}</div>
                <div><b>Status:</b> <span class="pill blue" style="font-size:0.75rem">${escapeHTML(a.status || 'active').toUpperCase()}</span></div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn sm o" data-a="tstudio-export-pkg" data-v="${escapeHTML(a.id)}" style="flex:1;min-height:44px;justify-content:center">
                  ${uiIcon("download")} Export
                </button>
                <button class="btn sm o" data-a="tstudio-delete-assignment" data-v="${escapeHTML(a.id)}" style="flex:1;min-height:44px;justify-content:center;color:var(--coral)">
                  ${uiIcon("trash")} Remove
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>
  `;
}
