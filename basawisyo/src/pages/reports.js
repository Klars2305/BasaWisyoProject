/* DEPED REPORTS VIEW */
function canViewReports() {
  return ["teacher", "admin"].includes(AUTH.currentUser?.role)
    && AUTH.currentUser.status !== "suspended";
}

function requireReportAccess() {
  if (!canViewReports()) throw new Error("Teacher or admin account required for reports.");
}

function viewReports() {
  if (!canViewReports()) {
    return `<section class="card"><h2>Reports unavailable</h2><p class="sub">Class reports are available to teacher and admin accounts.</p></section>`;
  }
  const counts = [0, 0, 0, 0];
  CLASS_ROSTER.forEach(st => counts[st.l]++);
  const total = CLASS_ROSTER.length;

  return `
    <h2>Reading Reports Preview</h2>
    <p class="sub">Sample Class 8-A data for layout review only. These counts and skill gaps are demo values, not validated Phil-IRI results or an official DepEd report.</p>

    <!-- Distribution Summary Card -->
    <div class="card">
      <div class="lab">Sample Class 8-A Distribution (${total} Learners)</div>
      
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
        <div>
          <div class="row report-distribution-row">
            <span><span class="badge-diff diff-hard" style="margin-right:6px">LEVEL 0</span> Frustration (Needs Intensive Remediation)</span>
            <b>${counts[0]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[0]/total)*100}%;background:var(--coral)"></i></div>
        </div>

        <div>
          <div class="row report-distribution-row">
            <span><span class="badge-diff diff-medium" style="margin-right:6px">LEVEL 1</span> Instructional (Guided Reading)</span>
            <b>${counts[1]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[1]/total)*100}%;background:var(--gold-hover)"></i></div>
        </div>

        <div>
          <div class="row report-distribution-row">
            <span><span class="badge-diff diff-easy" style="margin-right:6px;background:var(--sky-soft);color:var(--sky-ink);border-color:rgba(37,137,230,0.3)">LEVEL 2</span> Independent (At Grade Level)</span>
            <b>${counts[2]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[2]/total)*100}%;background:var(--sky)"></i></div>
        </div>

        <div>
          <div class="row report-distribution-row">
            <span><span class="badge-diff diff-easy" style="margin-right:6px">LEVEL 3</span> Mastery (Advanced / Honor)</span>
            <b>${counts[3]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[3]/total)*100}%;background:var(--teal)"></i></div>
        </div>
      </div>
    </div>

    <!-- Identified Skill Gaps -->
    <div class="card">
      <div class="lab">Sample Skill Gaps</div>
      <p class="sub">Illustrative values for this report layout:</p>
      <div>
        <span class="tag w2">Critical Analysis (42%)</span>
        <span class="tag w2">Inference Clues (38%)</span>
        <span class="tag">Vocabulary in Context (24%)</span>
        <span class="tag">Literal Identification (12%)</span>
      </div>
    </div>

    <div class="btn-row" style="margin-top:12px">
      <button class="btn blue" data-a="open-report-sheet" data-v="DepEd Phil-IRI Form 14">
        ${uiIcon("print")} Preview Sample Form 14
      </button>
      <button class="btn o" data-a="download-csv">
        ${uiIcon("download")} Export Sample CSV
      </button>
    </div>
  `;
}

