function openForm14Modal() {
  requireReportAccess();
  const md = $("#md");

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

  md.innerHTML = `
    <div class="sheet">
      <div class="row">
        <div>
          <h2 id="sample-report-title">Sample Form 14 Layout</h2>
          <div class="sub-sm">Demo Class 8-A · Not for official submission</div>
        </div>
        <button class="icon-btn noprint" data-a="modal-close" aria-label="Close sample report">✕</button>
      </div>

      <p class="sub">
        This layout uses sample learner data. It is not a validated assessment or official submission form.
      </p>

      <div role="region" aria-label="Sample report table" tabindex="0"
        style="max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:8px">
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
          </tbody>
        </table>
      </div>

      <div class="btn-row noprint" style="margin-top:14px">
        <button class="btn blue" data-a="download-csv">${uiIcon("download")} Download Sample CSV</button>
        <button class="btn o" data-a="print-sheet">${uiIcon("print")} Print Sample Layout</button>
        <button class="btn o" data-a="modal-close">Close</button>
      </div>
    </div>
  `;
  md.hidden = false;
  md.querySelector?.('[data-a="modal-close"]')?.focus?.();
}

function closeReportModal() {
  const md = $("#md");
  if (md.hidden) return;
  md.hidden = true;
  $('#v [data-a="open-report-sheet"]')?.focus?.();
}

function downloadCSV() {
  requireReportAccess();
  let csv = "No.,Sample Learner Name,Demo Reading Level,Demo Words Per Minute,Demo Comprehension %,Sample Focus Gap\n";
  CLASS_ROSTER.forEach((st, i) => {
    csv += `${i + 1},"${st.n}",${PHIL_IRI_LEVELS[st.l]},${st.wpm},${st.comp}%,${st.weak}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "BasaWisyo_Sample_Form14_Class8A.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Sample CSV file downloaded.");
}

function printReportSheet() {
  requireReportAccess();
  if ($("#md")?.hidden !== false) throw new Error("Open the sample report before printing.");
  window.print();
}

