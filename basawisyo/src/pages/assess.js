function viewAssess() {
  const u = AUTH.currentUser;
  const isGuest = !u;

  if (S.lvl === null) {
    return `
      <h2>Phil-IRI Diagnostic Placement</h2>
      <p class="sub">
        Discover your reading comprehension level. You will read 4 calibrated passages (Easy, Medium, Hard, and Extreme) with one question each. Works completely offline!
      </p>

      <div class="card">
        <div class="lab">${isGuest ? "Guest Screener Mode (No Account Needed)" : "Student Diagnostic"}</div>
        <p class="sub">
          • 4 calibrated passages testing literal, inferential, and critical reading<br>
          • Tap any dotted word for Filipino, Bisaya, and English translations<br>
          • Takes only 3 to 4 minutes<br>
          • Accurately classifies into: <b>Frustration, Instructional, Independent, or Mastery</b>
        </p>
        <button class="btn gold" data-a="start-placement">
          ${isGuest ? "⚡ Start Quick Diagnostic as Guest" : "Start Placement Test"}
        </button>
      </div>
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
      <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card));border:2px solid var(--gold);margin-top:16px">
        <div class="lab" style="color:var(--gold-hover)">🌟 Save or Share Your Diagnosed Level</div>
        <h3 style="margin:4px 0">Your Temporary Guest Token: <code>${token}</code></h3>
        <p class="sub" style="margin:4px 0 14px 0">
          You don't have an account, but your reading level is saved locally! Choose how you would like to proceed:
        </p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn gold" data-a="guest-save-profile">
            💾 Save Profile (Create Permanent Student Account)
          </button>
          
          <div style="border-top:1px dashed var(--border);padding-top:10px">
            <label style="font-size:12px;font-weight:700">Link directly to a Teacher:</label>
            <div style="display:flex;gap:8px;margin-top:4px">
              <input type="text" id="guest-teacher-code" class="auth-input" placeholder="Enter Teacher Share Code (e.g. BASA-TEACH-8492)" style="text-transform:uppercase;font-family:monospace">
              <button class="btn" data-a="guest-connect-teacher">Send to Teacher</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <h2>Your Phil-IRI Reading Profile</h2>
    <div class="card">
      <div class="lab">Official Diagnostic Level</div>
      <div class="big" style="color:var(--navy);margin-top:6px">
        ${PHIL_IRI_LEVELS[S.lvl]} Reader
      </div>
      <p class="sub" style="margin-top:8px">${desc[S.lvl]}</p>

      <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
        <button class="btn" data-a="tab" data-v="practice">Go to Recommended Practice</button>
        <button class="btn o" data-a="start-placement">Retake Placement Test</button>
      </div>
    </div>

    ${guestActions}

    <!-- Phil-IRI Rubric Breakdown -->
    <div class="card" style="margin-top:16px">
      <div class="lab">DepEd Phil-IRI Scale</div>
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
  `;
}

