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
  const dataset = getClassroomReportDataset();

  return `
    <h2>Reading Reports Preview & Analytics</h2>
    <p class="sub">Comprehensive reading performance reports, diagnostic placement tracking, and formative assessment metrics.</p>

    <!-- Operational Classroom Analytics -->
    ${(!dataset || dataset.total === 0) ? `
      <div class="card" style="margin-bottom:18px">
        <div class="lab">Live Classroom Analytics (${escapeHTML(dataset ? dataset.section : "Classroom")})</div>
        <div style="padding:16px 0">
          <h3 style="margin-bottom:6px">No student results available yet</h3>
          <p class="sub">
            No student accounts are currently enrolled in this classroom (${escapeHTML(dataset ? dataset.classroomCode : "UNASSIGNED")}). Once students connect with your share code and complete their diagnostic placement, verified analytics, reading profiles, and intervention indicators will appear here.
          </p>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn o" data-a="open-report-sheet" data-v="live">
            ${uiIcon("print")} Preview Classroom Report
          </button>
          <button class="btn o" data-a="download-csv" data-v="live">
            ${uiIcon("download")} Export Empty CSV
          </button>
        </div>
      </div>
    ` : `
      <div class="card" style="margin-bottom:18px">
        <div class="lab">Live Classroom Analytics (${escapeHTML(dataset.section)} · ${escapeHTML(dataset.school)})</div>
        <div class="metric-grid" style="margin-top:10px;margin-bottom:14px">
          <div class="metric-box">
            <div class="metric-value">${dataset.total}</div>
            <div class="metric-title">Enrolled Students</div>
          </div>
          <div class="metric-box">
            <div class="metric-value" style="color:var(--teal)">${dataset.coveragePct}%</div>
            <div class="metric-title">Placement Coverage (${dataset.assessed}/${dataset.total})</div>
          </div>
          <div class="metric-box">
            <div class="metric-value">${dataset.totalWords.toLocaleString()}</div>
            <div class="metric-title">Total Words Read</div>
          </div>
          <div class="metric-box">
            <div class="metric-value" style="color:var(--coral)">${dataset.students.filter(s => s.status === 'Needs Intervention').length}</div>
            <div class="metric-title">Needs Intervention</div>
          </div>
        </div>

        <div class="lab" style="margin-bottom:6px">Verified Reading Profile Distribution</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-hard" style="margin-right:6px">LEVEL 0</span> Frustration (Needs Intensive Remediation)</span>
              <b>${dataset.levelCounts[0]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[0]/dataset.total)*100}%;background:var(--coral)"></i></div>
          </div>

          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-medium" style="margin-right:6px">LEVEL 1</span> Instructional (Guided Reading)</span>
              <b>${dataset.levelCounts[1]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[1]/dataset.total)*100}%;background:var(--gold-hover)"></i></div>
          </div>

          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-easy" style="margin-right:6px;background:var(--sky-soft);color:var(--sky-ink);border-color:rgba(37,137,230,0.3)">LEVEL 2</span> Independent (At Grade Level)</span>
              <b>${dataset.levelCounts[2]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[2]/dataset.total)*100}%;background:var(--sky)"></i></div>
          </div>

          <div>
            <div class="row report-distribution-row">
              <span><span class="badge-diff diff-easy" style="margin-right:6px">LEVEL 3</span> Mastery (Advanced / Honor)</span>
              <b>${dataset.levelCounts[3]} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.levelCounts[3]/dataset.total)*100}%;background:var(--teal)"></i></div>
          </div>

          ${dataset.unassessed > 0 ? `
          <div>
            <div class="row report-distribution-row">
              <span><span class="pill" style="margin-right:6px;background:var(--bg-card);border:1px solid var(--border)">UNASSESSED</span> Placement Required</span>
              <b>${dataset.unassessed} students</b>
            </div>
            <div class="bar"><i style="width:${(dataset.unassessed/dataset.total)*100}%;background:var(--sub)"></i></div>
          </div>
          ` : ''}
        </div>

        <div class="btn-row" style="margin-top:14px">
          <button class="btn blue" data-a="open-report-sheet" data-v="live">
            ${uiIcon("print")} Preview Classroom Report
          </button>
          <button class="btn o" data-a="download-csv" data-v="live">
            ${uiIcon("download")} Download Verified CSV
          </button>
        </div>
      </div>
    `}
  `;
}

