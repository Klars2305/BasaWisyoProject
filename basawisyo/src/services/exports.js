function openForm14Modal() {
  const md = $("#md");
  md.hidden = false;

  const rows = CLASS_ROSTER.map((st, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${st.n}</b></td>
      <td>${PHIL_IRI_LEVELS[st.l]}</td>
      <td>${st.wpm} WPM</td>
      <td>${st.comp}%</td>
      <td>${st.weak}</td>
    </tr>
  `).join("");

  const userRow = S.lvl !== null ? `
    <tr style="background:var(--gold-soft);font-weight:bold">
      <td>41</td>
      <td>Current Learner (You)</td>
      <td>${PHIL_IRI_LEVELS[S.lvl]}</td>
      <td>${Math.round(S.w / Math.max(1, S.ss * 3))} WPM</td>
      <td>88%</td>
      <td>${S.miss ? S.miss.k : 'None'}</td>
    </tr>
  ` : '';

  md.innerHTML = `
    <div class="sheet">
      <div class="row">
        <div>
          <h2>DepEd Phil-IRI Form 14: Class Reading Profile</h2>
          <div class="sub-sm">School Year 2026–2027 · Grade 8 - Section A</div>
        </div>
        <button class="icon-btn noprint" data-a="modal-close">✕</button>
      </div>

      <p class="sub">
        Standardized summary of Oral and Silent Reading assessments for submission to DepEd Division reading coordinators.
      </p>

      <div style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Learner Name</th>
              <th>Reading Level</th>
              <th>Speed</th>
              <th>Comprehension</th>
              <th>Focus Area</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            ${userRow}
          </tbody>
        </table>
      </div>

      <div class="btn-row noprint" style="margin-top:14px">
        <button class="btn gold" data-a="download-csv">💾 Download CSV Report</button>
        <button class="btn o" data-a="print-sheet">🖨️ Print Form 14</button>
        <button class="btn o" data-a="modal-close">Close</button>
      </div>
    </div>
  `;
}

function downloadCSV() {
  let csv = "No.,Learner Name,Phil-IRI Level,Words Per Minute,Comprehension %,Focus Gap\n";
  CLASS_ROSTER.forEach((st, i) => {
    csv += `${i + 1},"${st.n}",${PHIL_IRI_LEVELS[st.l]},${st.wpm},${st.comp}%,${st.weak}\n`;
  });
  if (S.lvl !== null) {
    csv += `41,"Current Learner (You)",${PHIL_IRI_LEVELS[S.lvl]},115,88%,${S.miss ? S.miss.k : 'None'}\n`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "DepEd_Phil-IRI_Form14_Class8A.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("CSV file downloaded successfully!");
}

