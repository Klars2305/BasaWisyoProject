/* ==========================================================================
   BasaWisyo Reporting & Export Service (exports.js)
   Unified data pipeline connecting Roster, Reports, and Downloadable CSV/Print.
   ========================================================================== */

function getClassroomReportDataset(actor = (typeof AUTH !== "undefined" ? AUTH.currentUser : null)) {
  if (!actor || !["teacher", "admin"].includes(actor.role)) return null;

  const isAdmin = actor.role === "admin";
  const section = isAdmin ? "All Enrolled Sections" : (actor.section || "Grade 8");
  const classroomCode = isAdmin ? "ADMIN-ALL" : (actor.shareCode || "UNASSIGNED");
  const school = actor.school || "Rizal National High School";

  const rawStudents = isAdmin
    ? (AUTH.users || []).filter(u => u.role === "student" && u.status === "active")
    : (typeof AUTH.getTeacherStudents === "function" ? AUTH.getTeacherStudents(actor.shareCode) : []);

  const students = rawStudents.map((s, idx) => {
    const isAssessed = s.lvl !== null && s.lvl !== undefined;
    const lvlText = isAssessed ? (PHIL_IRI_LEVELS[s.lvl] || `Level ${s.lvl}`) : "Not assessed";
    const wpmText = s.wpm ? `${s.wpm} WPM` : "Not assessed";
    const compText = (s.comp !== null && s.comp !== undefined) ? `${s.comp}%` : "Not assessed";
    const wordsRead = s.wordsRead || 0;

    let status = "On Track";
    if (!isAssessed) {
      status = "Placement Required";
    } else if (s.lvl === 0 || (typeof s.comp === "number" && s.comp < 60)) {
      status = "Needs Intervention";
    }

    let tierIndex = 0;
    let tierName = "Easy (Madali)";
    if (typeof journeyUnlockedTier === "function" && typeof journeyValid === "function") {
      const j = journeyValid(s.journey) ? s.journey : (typeof journeyEmpty === "function" ? journeyEmpty(s.lvl) : null);
      if (j) {
        tierIndex = journeyUnlockedTier(j, s.journeyOverride);
        tierName = DIFF_NAMES[DIFF_KEYS[tierIndex]] || "Easy";
      }
    }

    return {
      index: idx + 1,
      id: s.id,
      name: s.name,
      isAssessed,
      lvl: s.lvl,
      profileLabel: lvlText,
      wpm: s.wpm,
      wpmText,
      comp: s.comp,
      compText,
      wordsRead,
      tierIndex,
      tierName,
      status,
      journeyOverride: s.journeyOverride,
      journey: s.journey
    };
  });

  const total = students.length;
  const assessed = students.filter(s => s.isAssessed).length;
  const unassessed = total - assessed;
  const coveragePct = total > 0 ? Math.round((assessed / total) * 100) : 0;

  const levelCounts = [0, 0, 0, 0];
  students.forEach(s => {
    if (s.isAssessed && s.lvl >= 0 && s.lvl <= 3) {
      levelCounts[s.lvl]++;
    }
  });

  const totalWords = students.reduce((sum, s) => sum + s.wordsRead, 0);

  return {
    actor,
    isAdmin,
    section,
    classroomCode,
    school,
    students,
    total,
    assessed,
    unassessed,
    coveragePct,
    levelCounts,
    totalWords,
    timestamp: new Date().toISOString()
  };
}

let CURRENT_REPORT_MODAL_SOURCE = "live";

function openForm14Modal(source = "live") {
  requireReportAccess();
  CURRENT_REPORT_MODAL_SOURCE = source;
  const md = $("#md");
  if (!md) return;

  const dataset = getClassroomReportDataset();
  const useLive = (source === "live");

  if (useLive && dataset && dataset.total > 0) {
    const rows = dataset.students.map(st => `
      <tr>
        <td>${st.index}</td>
        <td><b>${escapeHTML(st.name)}</b></td>
        <td><span class="level-badge ${st.isAssessed ? `level-${st.lvl}` : 'level-none'}">${escapeHTML(st.profileLabel)}</span></td>
        <td>${escapeHTML(st.wpmText)}</td>
        <td><b>${escapeHTML(st.compText)}</b></td>
        <td>${st.wordsRead.toLocaleString()}</td>
        <td>
          <span class="pill ${st.status === 'Needs Intervention' ? 'coral' : st.status === 'On Track' ? 'ok' : ''}">
            ${escapeHTML(st.status)}
          </span>
        </td>
      </tr>
    `).join("");

    md.innerHTML = `
      <div class="sheet">
        <div class="row">
          <div>
            <h2 id="live-report-title">BasaWisyo Classroom Reading Progress Report</h2>
            <div class="sub-sm">${escapeHTML(dataset.section)} · ${escapeHTML(dataset.school)} · ${dataset.total} Enrolled Students</div>
          </div>
          <button class="icon-btn noprint" data-a="modal-close" aria-label="Close report">✕</button>
        </div>

        <p class="sub">
          Formative reading progress and diagnostic placement records for connected students. Provisional data saved in this browser.
        </p>

        <div role="region" aria-label="Classroom report table" tabindex="0"
          style="max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:8px">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Learner Name</th>
                <th>Reading Level</th>
                <th>Speed</th>
                <th>Comprehension</th>
                <th>Words Read</th>
                <th>Intervention Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="btn-row noprint" style="margin-top:14px">
          <button class="btn blue" data-a="download-csv" data-v="live">${uiIcon("download")} Download Live CSV</button>
          <button class="btn o" data-a="print-sheet">${uiIcon("print")} Print Report</button>
          <button class="btn o" data-a="modal-close">Close</button>
        </div>
      </div>
    `;
  } else if (useLive) {
    const sec = dataset ? dataset.section : "Classroom";
    const code = dataset ? dataset.classroomCode : "UNASSIGNED";
    md.innerHTML = `
      <div class="sheet">
        <div class="row">
          <div>
            <h2 id="live-report-title">BasaWisyo Classroom Reading Progress Report</h2>
            <div class="sub-sm">${escapeHTML(sec)} · 0 Enrolled Students</div>
          </div>
          <button class="icon-btn noprint" data-a="modal-close" aria-label="Close report">✕</button>
        </div>
        <p class="sub">
          Formative reading progress and diagnostic placement records for connected students.
        </p>
        <div class="card" style="text-align:center;padding:32px 16px;margin:16px 0">
          <h3>No student results available yet</h3>
          <p class="sub" style="margin-top:6px">
            No student accounts are currently enrolled in this classroom (${escapeHTML(code)}). Once students connect with your share code and complete their diagnostic placement, their verified reading records will appear here.
          </p>
        </div>
        <div class="btn-row noprint" style="margin-top:14px">
          <button class="btn o" data-a="download-csv" data-v="live">${uiIcon("download")} Download Empty CSV</button>
          <button class="btn o" data-a="modal-close">Close</button>
        </div>
      </div>
    `;
  } else {
    // Sample / Demo Form 14 Layout (Fallback or explicit sample preview)
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
          <button class="btn blue" data-a="download-csv" data-v="sample">${uiIcon("download")} Download Sample CSV</button>
          <button class="btn o" data-a="print-sheet">${uiIcon("print")} Print Sample Layout</button>
          <button class="btn o" data-a="modal-close">Close</button>
        </div>
      </div>
    `;
  }

  md.hidden = false;
  md.querySelector?.('[data-a="modal-close"]')?.focus?.();
}

function closeReportModal() {
  const md = $("#md");
  if (!md || md.hidden) return;
  md.hidden = true;
  $('#v [data-a="open-report-sheet"]')?.focus?.();
}

function downloadCSV(source = CURRENT_REPORT_MODAL_SOURCE) {
  requireReportAccess();
  const dataset = getClassroomReportDataset();
  const useLive = (source === "live");

  let csv = "";
  let filename = "BasaWisyo_Reading_Report.csv";

  if (useLive) {
    csv = "No.,Student Name,Reading Profile,Reading Speed,Comprehension %,Words Read,Status / Intervention\n";
    if (dataset && dataset.students.length > 0) {
      dataset.students.forEach(st => {
        const escapedName = `"${st.name.replace(/"/g, '""')}"`;
        csv += `${st.index},${escapedName},${st.profileLabel},${st.wpmText},${st.compText},${st.wordsRead},${st.status}\n`;
      });
    }
    const secName = (dataset && dataset.section) ? dataset.section.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Class';
    filename = `BasaWisyo_Reading_Report_${secName}.csv`;
  } else {
    csv = "No.,Sample Learner Name,Demo Reading Level,Demo Words Per Minute,Demo Comprehension %,Sample Focus Gap\n";
    CLASS_ROSTER.forEach((st, i) => {
      csv += `${i + 1},"${st.n}",${PHIL_IRI_LEVELS[st.l]},${st.wpm},${st.comp}%,${st.weak}\n`;
    });
    filename = "BasaWisyo_Sample_Form14_Class8A.csv";
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(useLive ? "Classroom reading report CSV downloaded." : "Sample CSV file downloaded.");
}

function printReportSheet() {
  requireReportAccess();
  if ($("#md")?.hidden !== false) throw new Error("Open the report before printing.");
  window.print();
}
