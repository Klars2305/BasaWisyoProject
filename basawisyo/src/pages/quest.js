/* BAYANIHAN QUEST VIEW */
function viewQuest() {
  const BASE_COMMUNITY = 18450;
  const totalWords = BASE_COMMUNITY + S.w;
  const GOAL = 25000;
  const pct = Math.min(100, Math.round((totalWords / GOAL) * 100));

  return `
    <h2>Class 8-A Bayanihan Reading Quest</h2>
    <p class="sub">Cooperative reading: every learner contributes words to a collective goal. No toxic ranking or cutthroat leaderboards.</p>

    <div class="hero">
      <div class="lab" style="color:#f5ab1d">Collective Class Target: 25,000 Words</div>
      <div class="big" style="color:#fff;margin:6px 0">${totalWords.toLocaleString()} <span style="font-size:1.1rem;font-weight:500;color:#ccdcf8">/ ${GOAL.toLocaleString()}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="sub" style="color:#e0edff">
        ${totalWords >= GOAL ? "🎉 Goal Reached! Maraming salamat sa sipag at tiyaga ng buong klase!" : `Remaining: ${(GOAL - totalWords).toLocaleString()} words to complete this week's quest.`}
      </p>
      <div class="row" style="background:rgba(255,255,255,0.1);padding:8px 12px;border-radius:10px;margin-top:10px">
        <span>Your contribution:</span>
        <b>${S.w.toLocaleString()} words (${S.ss} sessions)</b>
      </div>
    </div>

    <!-- BasaMesh Card -->
    <div class="card">
      <div class="lab">BasaMesh · Offline Passage Sharing</div>
      <h3>Share Stories Without Internet</h3>
      <p class="sub">
        Create custom passages and peer quizzes. Generate a share code to send via Bluetooth, SMS, or handwritten note!
      </p>

      <div style="margin-top:12px">
        <input id="mesh-title" placeholder="Story Title (e.g. Ang Agila ng Davao)">
        <textarea id="mesh-text" rows="3" placeholder="Paste or write your passage text here..."></textarea>
        <button class="btn sm o" data-a="mesh-create">Generate Share Code</button>
      </div>

      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
        <div class="lab">Import Code from Classmate</div>
        <textarea id="mesh-code" rows="2" placeholder="Paste code here..."></textarea>
        <button class="btn sm gold" data-a="mesh-import">Import & Add to Practice</button>
      </div>
    </div>
  `;
}

