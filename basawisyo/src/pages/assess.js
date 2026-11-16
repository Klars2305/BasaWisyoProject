function viewAssess() {
  const u = AUTH.currentUser;
  const isGuest = !u;

  const subnavHtml = `
    <div class="subnav-segmented" role="tablist" aria-label="Practice section switcher">
      <button class="subnav-tab" data-a="tab" data-v="flashcards">
        ${uiIcon("flashcards")} <span>Vocabulary Flashcards</span>
      </button>
      <button class="subnav-tab active" data-a="tab" data-v="assess">
        ${uiIcon("assess")} <span>Diagnostic Placement</span>
      </button>
    </div>
  `;

  if (S.lvl === null) {
    return `
      <div class="assessment-page">
      ${subnavHtml}
      <div class="assessment-intro">
        <div class="lab">Reading Placement Assessment</div>
        <h2>Find your comfortable reading starting path</h2>
        <p class="sub">Complete three short Philippine reading passages with five comprehension questions each (15 questions total). Your results determine a <b>provisional BasaWisyo starting level</b> to guide your practice journey. Works 100% offline.</p>
      </div>
      <section class="card assessment-start-card" aria-label="What to expect from placement">
        <div class="assessment-start-head">
          <div>
            <div class="lab">${isGuest ? "Guest Diagnostic Mode (No Account Required)" : "Student Diagnostic Screener"}</div>
            <h3>Three Progressive Reading Steps</h3>
          </div>
          <span class="pill">15 Questions · About 6–8 minutes</span>
        </div>
        <ol class="assessment-steps">
          <li><b>Step 1: Basic (Easy)</b><span>"A Fisher's Morning in Bohol" · 5 questions (Literal, Vocab, Inference, Sequence, Main idea)</span></li>
          <li><b>Step 2: Intermediate (Medium)</b><span>"The Coral Patrol of Davao Gulf" · 5 questions testing analytical comprehension</span></li>
          <li><b>Step 3: Advanced (Hard)</b><span>"Voices of La Solidaridad" · 5 questions exploring historical and civic reasoning</span></li>
          <li><b>Provisional Level</b><span>Receive your provisional starting level and custom-recommended reading passages</span></li>
        </ol>
        <div class="card" style="background:var(--bg);border-left:4px solid var(--sky);padding:10px 14px;margin:14px 0">
          <b style="color:var(--navy);font-size:0.85rem">Provisional Starting Level Safeguard:</b>
          <p class="sub-sm" style="margin:2px 0 0 0">
            This activity suggests an initial practice tier in BasaWisyo. It is not an official DepEd Phil-IRI classification, does not infer reading speed (WPM), and does not use XP or rankings.
          </p>
        </div>
        <button class="btn blue assessment-start-button" data-a="start-placement">
          ${uiIcon("assess")} ${isGuest ? "Start 15-Question Diagnostic as Guest" : "Start Placement Assessment"}
        </button>
      </section></div>
    `;
  }

  const desc = [
    "Grade-level texts currently pose challenges. We recommend starting with Easy passages to master core vocabulary, build confidence, and strengthen basic comprehension.",
    "You understand texts with slight guidance and answer literal questions well. Daily practice with Medium passages will guide your transition to independence.",
    "You read with strong independence and critical comprehension across multiple subjects! Explore Hard passages and challenge yourself with advanced analysis.",
    "Exceptional comprehension! You grasp dense, technical, and historical texts. Tackle Extreme level passages and guide classmates."
  ];

  const levelNames = ["Foundation Support", "Developing", "Proficient", "Mastery"];
  const rep = S.placementReport || null;

  // Guest-specific post-test linking card
  let guestActions = "";
  if (isGuest) {
    const token = S.guestToken || "GUEST-READY";
    guestActions = `
      <div class="card assessment-guest-card">
        <div class="lab" style="color:var(--gold-ink)">${uiIcon("sparkles")} Save or Share Your Suggested Level</div>
        <h3 style="margin:4px 0">Your Temporary Guest Token: <code>${token}</code></h3>
        <p class="sub" style="margin:4px 0 14px 0">
          Your provisional reading level is saved in this browser! Create a free student account or send your token to your teacher:
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

  // Advanced Candidate Verification Card
  let candidateCard = "";
  if (S.placementCandidate && S.lvl === 2) {
    candidateCard = `
      <div class="card" style="background:linear-gradient(135deg, rgba(37,137,230,0.1), rgba(46,196,182,0.12));border:1.5px solid var(--sky);margin-bottom:16px">
        <div class="lab" style="color:var(--sky-ink)">🌟 Advanced Placement Candidate</div>
        <h3 style="margin:4px 0">You demonstrated strong comprehension across all passages!</h3>
        <p class="sub-sm" style="margin:4px 0 12px 0">
          To maintain rigorous standards, automatic Mastery is not granted from initial screening. Take an optional <b>5-question advanced verification passage</b> ("Intergenerational Ecological Justice") to confirm verified Mastery status.
        </p>
        <button class="btn blue sm" data-a="start-placement-verify">
          ${uiIcon("sparkles")} Take Advanced Verification Passage (5 Qs)
        </button>
      </div>
    `;
  }

  // Skills Breakdown Markup
  let skillsMarkup = "";
  if (rep && rep.skills) {
    skillsMarkup = `
      <div class="card" style="margin-bottom:16px">
        <div class="lab">Assessment Evidence by Skill &amp; Passage</div>
        <h3 style="margin:4px 0 10px 0">Comprehension Profile</h3>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:14px">
          <div class="card" style="margin:0;padding:8px 12px;background:var(--bg);text-align:center">
            <div class="lab">Basic Passage</div>
            <b style="font-size:1.1rem;color:var(--teal)">${rep.p1Score !== undefined ? `${rep.p1Score}/5` : "Complete"}</b>
          </div>
          <div class="card" style="margin:0;padding:8px 12px;background:var(--bg);text-align:center">
            <div class="lab">Intermediate</div>
            <b style="font-size:1.1rem;color:var(--gold-ink)">${rep.p2Score !== undefined ? `${rep.p2Score}/5` : "Complete"}</b>
          </div>
          <div class="card" style="margin:0;padding:8px 12px;background:var(--bg);text-align:center">
            <div class="lab">Advanced</div>
            <b style="font-size:1.1rem;color:var(--sky)">${rep.p3Score !== undefined ? `${rep.p3Score}/5` : "Complete"}</b>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          ${Object.entries(rep.skills).map(([skill, stat]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.875rem">
              <span><b>${escapeHTML(skill)}:</b></span>
              <span class="pill ${stat.correct === stat.total ? 'ok' : stat.correct >= 1 ? 'blue' : 'warn'}">
                ${stat.correct} / ${stat.total} correct
              </span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  return `
    <div class="assessment-page assessment-complete">
    ${subnavHtml}
    <div class="assessment-intro">
      <div class="lab">Provisional Diagnostic Placement</div>
      <h2>Your Reading Profile</h2>
      <p class="sub">This result suggests your optimal starting level for guided reading. It is a formative classroom guide, not an official Phil-IRI classification.</p>
    </div>

    <div class="card assessment-result-card" style="margin-bottom:16px">
      <div class="lab">Provisional Starting Level</div>
      <div class="big assessment-level-value">
        ${levelNames[S.lvl] || PHIL_IRI_LEVELS[S.lvl]} Reader
      </div>
      <p class="sub">${desc[S.lvl]}</p>

      <div class="assessment-result-actions">
        <button class="btn" data-a="tab" data-v="practice">Go to Recommended Practice</button>
        <button class="btn o" data-a="start-placement">Retake Placement Assessment</button>
      </div>
    </div>

    ${candidateCard}
    ${skillsMarkup}
    ${guestActions}

    <!-- Evidence-Based Provisional Placement Scale -->
    <div class="card assessment-scale-card">
      <div class="lab">BasaWisyo Placement Evidence Rubric</div>
      <p class="sub-sm">Starting levels are determined by multi-passage comprehension evidence across literal comprehension, vocabulary, inference, sequencing, and main idea.</p>
      <div class="responsive-table-wrap" tabindex="0" role="region" aria-label="Reading level scale; scroll horizontally for more columns">
      <table style="margin-top:8px;width:100%">
        <thead>
          <tr>
            <th>Evidence</th>
            <th>Provisional Level</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr style="${S.lvl === 0 ? 'background:var(--coral-soft);font-weight:bold' : ''}">
            <td>Difficulty with basic passage (&lt; 3 / 5)</td>
            <td><span class="level-badge level-0">Foundation Support</span></td>
            <td>Guided remedial vocabulary &amp; Easy tier stories</td>
          </tr>
          <tr style="${S.lvl === 1 ? 'background:var(--gold-soft);font-weight:bold' : ''}">
            <td>Strong basic (≥ 3 / 5), weak intermediate (&lt; 3 / 5)</td>
            <td><span class="level-badge level-1">Developing</span></td>
            <td>Medium passages &amp; guided inference practice</td>
          </tr>
          <tr style="${S.lvl === 2 ? 'background:var(--sky-soft);font-weight:bold' : ''}">
            <td>Strong basic and intermediate (≥ 3 / 5 on both)</td>
            <td><span class="level-badge level-2">Proficient</span></td>
            <td>Hard passages &amp; critical analysis</td>
          </tr>
          <tr style="${S.lvl === 3 ? 'background:var(--teal-soft);font-weight:bold' : ''}">
            <td>Strong performance across all passages + verification</td>
            <td><span class="level-badge level-3">Mastery (Verified)</span></td>
            <td>Extreme passages &amp; peer mentoring</td>
          </tr>
        </tbody>
      </table>
      </div>
      <p class="sub-sm" style="margin-top:10px;color:var(--sub)">
        <b>Assessment Safeguards:</b> Keep official DepEd Phil-IRI classifications separate from these app-defined levels. Do not infer words per minute (WPM) from comprehension answers. Do not use XP or classroom rank to determine reading proficiency.
      </p>
    </div></div>
  `;
}

