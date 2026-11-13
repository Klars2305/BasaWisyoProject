/* DEPED REPORTS VIEW */
function viewReports() {
  const counts = [0, 0, 0, 0];
  CLASS_ROSTER.forEach(st => counts[st.l]++);
  if (S.lvl !== null) counts[S.lvl]++;
  const total = CLASS_ROSTER.length + (S.lvl !== null ? 1 : 0);

  return `
    <h2>DepEd Reading Assessment Dashboard</h2>
    <p class="sub">Phil-IRI (Philippine Informal Reading Inventory) Class 8-A diagnostic overview.</p>

    <!-- Distribution Summary Card -->
    <div class="card">
      <div class="lab">Class 8-A Distribution (${total} Learners)</div>
      
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
        <div>
          <div class="row">
            <span>ðŸ”´ Frustration (Needs Intensive Remediation)</span>
            <b>${counts[0]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[0]/total)*100}%;background:var(--coral)"></i></div>
        </div>

        <div>
          <div class="row">
            <span>ðŸŸ¡ Instructional (Guided Reading)</span>
            <b>${counts[1]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[1]/total)*100}%;background:var(--gold-hover)"></i></div>
        </div>

        <div>
          <div class="row">
            <span>ðŸ”µ Independent (At Grade Level)</span>
            <b>${counts[2]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[2]/total)*100}%;background:var(--sky)"></i></div>
        </div>

        <div>
          <div class="row">
            <span>ðŸŸ¢ Mastery (Advanced / Honor)</span>
            <b>${counts[3]} students</b>
          </div>
          <div class="bar"><i style="width:${(counts[3]/total)*100}%;background:var(--teal)"></i></div>
        </div>
      </div>
    </div>

    <!-- Identified Skill Gaps -->
    <div class="card">
      <div class="lab">Common Skill Gaps</div>
      <p class="sub">Skills that students struggled with most during practice quizzes:</p>
      <div>
        <span class="tag w2">Critical Analysis (42%)</span>
        <span class="tag w2">Inference Clues (38%)</span>
        <span class="tag">Vocabulary in Context (24%)</span>
        <span class="tag">Literal Identification (12%)</span>
      </div>
    </div>

    <div class="btn-row" style="margin-top:12px">
      <button class="btn gold" data-a="open-report-sheet" data-v="DepEd Phil-IRI Form 14">
        ðŸ“„ View Official Form 14
      </button>
      <button class="btn o" data-a="download-csv">
        ðŸ’¾ Export CSV
      </button>
    </div>
  `;
}

