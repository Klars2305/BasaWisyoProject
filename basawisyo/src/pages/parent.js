/* PARENT HUB VIEW */
function viewParent() {
  const currentLevelStr = S.lvl !== null ? PHIL_IRI_LEVELS[S.lvl] : "Pending Placement";
  const startLevelStr = S.l0 !== null ? PHIL_IRI_LEVELS[S.l0] : "—";
  const estPages = Math.max(1, Math.round(S.w / 220));

  const monthlyTutoring = (S.pay || 0) * (S.pm || 0);
  const diff = monthlyTutoring - 99;

  return `
    <div class="hero">
      <div class="lab" style="color:#f5ab1d">Para sa Magulang at Pamilya</div>
      <h2>Empowering Parents in Daily Reading Growth</h2>
      <p class="sub">
        Tangible proof of your child’s progress, actionable DepEd Brigada Pagbasa tips, and a simple 10-minute nightly routine.
      </p>
      ${S.sub ? `
        <span class="pill ok" style="background:#fff;color:var(--teal)">Subscribed ✓ (Demo Mode Active)</span>
      ` : `
        <button class="btn blue sm" data-a="sub-toggle">
          Unlock Parent Hub · ₱99/month (Demo)
        </button>
      `}
    </div>

    <!-- Student Progress Card -->
    <div class="card">
      <div class="lab">Reading Trajectory</div>
      <div class="row" style="margin:10px 0">
        <div>
          <div class="sub-sm">Starting Point</div>
          <b>${startLevelStr}</b>
        </div>
        <div class="big" style="color:var(--gold)">→</div>
        <div style="text-align:right">
          <div class="sub-sm">Current Level</div>
          <b style="color:var(--navy)">${currentLevelStr}</b>
        </div>
      </div>
      <div class="sub">
        ${S.ss} reading sessions completed · ${S.w.toLocaleString()} words read (~${estPages} book pages).
      </div>
    </div>

    <!-- DepEd Brigada Pagbasa Home Tips -->
    <div class="card">
      <div class="lab">10-Minute Read-Aloud Guide Tonight</div>
      <h3>Basa Together Routine</h3>
      <p class="sub">Read a short passage together for just 10 minutes before bedtime:</p>
      <ol class="sub" style="padding-left:18px;margin:8px 0;line-height:1.7">
        <li><b>Alternate sentences:</b> Parent reads sentence 1, student reads sentence 2.</li>
        <li><b>Ask the 'Bakit' question:</b> "Bakit kaya ginawa iyon ng tauhan?"</li>
        <li><b>Highlight a new word:</b> Pick one unfamiliar word and use it in a funny sentence.</li>
        <li><b>Praise effort:</b> "Ang galing ng pagbasa mo ngayon, tuloy-tuloy!"</li>
      </ol>
    </div>

    <!-- Message for OFW / Overseas Relatives -->
    <div class="card">
      <div class="lab">Update for OFW Parents or Relatives</div>
      <div class="speech-bubble" id="ofw-msg">
        "Kamusta po! Update lang po sa pagbasa ni anak sa BasaWisyo: Nasa level na po siya ng ${currentLevelStr}! Nakatapos na po siya ng ${S.ss} reading sessions at nakabasa ng ${S.w.toLocaleString()} salita. Tuloy-tuloy po ang pagpupursigi!"
      </div>
      <button class="btn sm o" data-a="copy-ofw-msg">${uiIcon("copy")} Copy Message for Messenger / SMS</button>
    </div>

    <!-- Tutoring Cost Comparison -->
    <div class="card">
      <div class="lab">Budget Comparison: Private Tutor vs BasaWisyo</div>
      <p class="sub">See how much you save while giving your child consistent daily reading practice:</p>
      
      <div class="parent-choice-grid">
        <div>
          <label class="sub-sm" for="tutor-rate">Rate per session (₱)</label>
          <input type="number" id="tutor-rate" value="${S.pay || ''}" placeholder="e.g. 250">
        </div>
        <div>
          <label class="sub-sm" for="tutor-sessions">Sessions / month</label>
          <input type="number" id="tutor-sessions" value="${S.pm || ''}" placeholder="e.g. 8">
        </div>
      </div>
      <button class="btn sm o" data-a="calc-tutor">Compute Monthly Comparison</button>

      ${monthlyTutoring > 0 ? `
        <div style="margin-top:12px;background:var(--teal-soft);padding:10px 12px;border-radius:10px">
          <b style="color:var(--teal)">Private Tutoring: ₱${monthlyTutoring.toLocaleString()} / month</b><br>
          <span class="sub-sm">BasaWisyo companion: ₱99 / month. You save approx <b>₱${diff.toLocaleString()}</b> every month!</span>
        </div>
      ` : ''}
    </div>
  `;
}

