function viewAssess() {
  const u = AUTH.currentUser;
  const isGuest = !u;

  if (S.lvl === null) {
    return `
      <div class="assessment-page">
      <div class="assessment-intro">
        <div class="lab">Reading placement</div>
        <h2>Find a comfortable place to start reading</h2>
        <p class="sub">Try four short passages, one question each. Your result suggests a starting level for practice in this browser. The activity works offline.</p>
      </div>
      <section class="card assessment-start-card" aria-label="What to expect from placement">
        <div class="assessment-start-head">
          <div>
            <div class="lab">${isGuest ? "Guest Screener Mode (No Account Needed)" : "Student Diagnostic"}</div>
            <h3>Four small steps</h3>
          </div>
          <span class="pill">About 3–4 minutes</span>
        </div>
        <ol class="assessment-steps">
          <li><b>Read</b><span>Easy, Medium, Hard, and Extreme passages</span></li>
          <li><b>Explore</b><span>Tap dotted words for Filipino, Bisaya, and English meanings</span></li>
          <li><b>Answer</b><span>One comprehension question after each passage</span></li>
          <li><b>Continue</b><span>Use the suggested level to choose your next story</span></li>
        </ol>
        <p class="assessment-note">This is a prototype practice placement, not an official Phil-IRI assessment.</p>
        <button class="btn blue assessment-start-button" data-a="start-placement">
          ${uiIcon("assess")} ${isGuest ? "Start Quick Diagnostic as Guest" : "Start Placement Test"}
        </button>
      </section></div>
    `;
  }

  const desc = [
    "Grade-level texts currently pose challenges. We recommend starting with Easy passages to master vocabulary and build reading fluency.",
    "You understand most texts with slight guidance. Consistent daily practice with Medium passages will propel you to independence.",
    "You read with confidence and high comprehension! Explore Hard passages and challenge yourself with advanced analysis.",
    "Exceptional comprehension! You grasp dense, technical, and philosophical texts. Tackle Extreme level passages and guide classmates."
  ];

  // Guest-specific post-test linking card
  let guestActions = "";
  if (isGuest) {
    const token = S.guestToken || "GUEST-READY";
    guestActions = `
      <div class="card assessment-guest-card">
        <div class="lab" style="color:var(--gold-ink)">${uiIcon("sparkles")} Save or Share Your Suggested Level</div>
        <h3 style="margin:4px 0">Your Temporary Guest Token: <code>${token}</code></h3>
        <p class="sub" style="margin:4px 0 14px 0">
          You don't have an account, but your reading level is saved locally! Choose how you would like to proceed:
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn blue" data-a="guest-save-profile">
            ${uiIcon("profile")} Save Profile (Create Permanent Student Account)
          </button>
          
          <div style="border-top:1px dashed var(--border);padding-top:10px">
            <label for="guest-teacher-code" style="font-size:12px;font-weight:700">Link directly to a Teacher:</label>
            <div class="guest-link-row" style="display:flex;gap:8px;margin-top:4px">
              <input type="text" id="guest-teacher-code" class="auth-input" placeholder="Enter Teacher Share Code (e.g. BASA-TEACH-8492)" style="text-transform:uppercase;font-family:monospace">
              <button class="btn" data-a="guest-connect-teacher">Send to Teacher</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="assessment-page assessment-complete">
    <div class="assessment-intro"><div class="lab">Practice placement</div><h2>Your Reading Profile</h2>
      <p class="sub">This result suggests where to start practicing. It is not an official Phil-IRI classification.</p></div>
    <div class="card assessment-result-card">
      <div class="lab">Suggested Reading Level</div>
      <div class="big assessment-level-value">
        ${PHIL_IRI_LEVELS[S.lvl]} Reader
      </div>
      <p class="sub">${desc[S.lvl]}</p>

      <div class="assessment-result-actions">
        <button class="btn" data-a="tab" data-v="practice">Go to Recommended Practice</button>
        <button class="btn o" data-a="start-placement">Retake Placement Test</button>
      </div>
    </div>

    ${guestActions}

    <!-- Phil-IRI Rubric Breakdown -->
    <div class="card assessment-scale-card">
      <div class="lab">DepEd Phil-IRI Scale</div>
      <p class="sub-sm">Reference labels are shown for learning context. This four-question activity does not measure reading speed or produce an official score.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading level scale; scroll horizontally for more columns">
      <table style="margin-top:8px">
        <thead>
          <tr>
            <th>Level</th>
            <th>Score</th>
            <th>Reading Speed</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr style="${S.lvl === 0 ? 'background:var(--coral-soft);font-weight:bold' : ''}">
            <td><span class="level-badge level-0">Frustration</span></td>
            <td>0 – 1 / 4 (&lt; 59%)</td>
            <td>&lt; 90 WPM</td>
            <td>Guided remedial vocabulary practice</td>
          </tr>
          <tr style="${S.lvl === 1 ? 'background:var(--gold-soft);font-weight:bold' : ''}">
            <td><span class="level-badge level-1">Instructional</span></td>
            <td>2 / 4 (59% – 79%)</td>
            <td>90 – 129 WPM</td>
            <td>Medium passages & inference practice</td>
          </tr>
          <tr style="${S.lvl === 2 ? 'background:var(--sky-soft);font-weight:bold' : ''}">
            <td><span class="level-badge level-2">Independent</span></td>
            <td>3 / 4 (80% – 89%)</td>
            <td>130 – 159 WPM</td>
            <td>Advanced reading & critical reflection</td>
          </tr>
          <tr style="${S.lvl === 3 ? 'background:var(--teal-soft);font-weight:bold' : ''}">
            <td><span class="level-badge level-3">Mastery</span></td>
            <td>4 / 4 (90% – 100%)</td>
            <td>160+ WPM</td>
            <td>Peer mentoring & extreme passages</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div></div>
  `;
}

