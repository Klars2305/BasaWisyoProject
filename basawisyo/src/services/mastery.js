/* ==========================================================================
   BasaWisyo - Reading Mastery Service (mastery.js)
   Formative reading comprehension analytics based on question-attempt evidence.
   Tracks Literal, Inference, Vocabulary, Sequencing, and Main Idea.
   Does not use XP. Not an official Phil-IRI classification.
   ========================================================================== */

const CORE_READING_SKILLS = [
  {
    key: "Literal",
    title: "Literal Comprehension",
    desc: "Locating directly stated facts, characters, settings, and sequence in the passage.",
    icon: "📖",
    threshold: 3
  },
  {
    key: "Inference",
    title: "Inference & Deduction",
    desc: "Reading between the lines using context clues and background knowledge to draw conclusions.",
    icon: "🔍",
    threshold: 3
  },
  {
    key: "Vocabulary",
    title: "Vocabulary in Context",
    desc: "Deriving meanings of unfamiliar, cultural, and figurative expressions from passage context.",
    icon: "📇",
    threshold: 3
  },
  {
    key: "Sequencing",
    title: "Sequencing & Structure",
    desc: "Understanding chronological order of events, text flow, and cause-and-effect relationships.",
    icon: "⏱️",
    threshold: 3
  },
  {
    key: "Main Idea",
    title: "Main Idea & Synthesis",
    desc: "Identifying the central theme, overarching arguments, and author's primary purpose.",
    icon: "💡",
    threshold: 3
  }
];

/**
 * Records a question attempt with skill metadata.
 */
function recordSkillAttempt({ skill, isCorrect, questionId, passageId, timestamp = Date.now() }) {
  if (!skill) return;
  const cleanSkill = skill.trim();

  // Normalize skill name to one of the core skills if possible
  let matchedSkill = cleanSkill;
  const lower = cleanSkill.toLowerCase();
  if (lower.includes("literal")) matchedSkill = "Literal";
  else if (lower.includes("infer")) matchedSkill = "Inference";
  else if (lower.includes("vocab")) matchedSkill = "Vocabulary";
  else if (lower.includes("sequence") || lower.includes("chronolog")) matchedSkill = "Sequencing";
  else if (lower.includes("main") || lower.includes("theme") || lower.includes("critical")) matchedSkill = "Main Idea";

  // Update in S.sk [correct, total]
  if (typeof S !== "undefined") {
    if (!S.sk) S.sk = {};
    const st = S.sk[matchedSkill] || [0, 0];
    st[0] += isCorrect ? 1 : 0;
    st[1] += 1;
    S.sk[matchedSkill] = st;

    // Maintain recent skill attempts array
    if (!Array.isArray(S.skillAttempts)) S.skillAttempts = [];
    S.skillAttempts.push({
      skill: matchedSkill,
      isCorrect: Boolean(isCorrect),
      questionId: questionId || "",
      passageId: passageId || "",
      timestamp
    });

    // Cap history at 200 items to prevent unbounded growth
    if (S.skillAttempts.length > 200) {
      S.skillAttempts = S.skillAttempts.slice(-200);
    }

    if (typeof save === "function") save();
  }

  // Also update current student account if authenticated
  if (typeof AUTH !== "undefined" && AUTH.currentUser?.role === "student") {
    const user = AUTH.currentUser;
    if (!Array.isArray(user.skillAttempts)) user.skillAttempts = [];
    user.skillAttempts.push({
      skill: matchedSkill,
      isCorrect: Boolean(isCorrect),
      questionId: questionId || "",
      passageId: passageId || "",
      timestamp
    });
    if (user.skillAttempts.length > 200) {
      user.skillAttempts = user.skillAttempts.slice(-200);
    }
    if (typeof AUTH.saveUsers === "function") AUTH.saveUsers();
  }
}

/**
 * Calculates evidence-based mastery for a single reading skill.
 */
function getSkillMastery(skillKey, studentId) {
  let stats = [0, 0];
  let attemptsHistory = [];

  const user = studentId && typeof AUTH !== "undefined"
    ? AUTH.users.find(u => u.id === studentId)
    : (typeof AUTH !== "undefined" ? AUTH.currentUser : null);

  if (user && Array.isArray(user.skillAttempts)) {
    attemptsHistory = user.skillAttempts.filter(a => a.skill === skillKey);
    const correctCount = attemptsHistory.filter(a => a.isCorrect).length;
    stats = [correctCount, attemptsHistory.length];
  } else if (typeof S !== "undefined" && S.sk && S.sk[skillKey]) {
    stats = S.sk[skillKey];
    if (Array.isArray(S.skillAttempts)) {
      attemptsHistory = S.skillAttempts.filter(a => a.skill === skillKey);
    }
  }

  const correct = stats[0] || 0;
  const attempts = stats[1] || 0;
  const sampleSize = attempts;
  const isSufficient = attempts >= 3;
  const neededAttempts = Math.max(0, 3 - attempts);
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  // Trend analysis (comparing recent 3 attempts against overall)
  let trend = "insufficient";
  if (isSufficient && attemptsHistory.length >= 3) {
    const recent3 = attemptsHistory.slice(-3);
    const recentCorrect = recent3.filter(a => a.isCorrect).length;
    const recentAccuracy = Math.round((recentCorrect / 3) * 100);

    if (recentAccuracy >= accuracy + 15) trend = "improving";
    else if (recentAccuracy <= accuracy - 15) trend = "needs-focus";
    else trend = "stable";
  }

  // Mastery classification
  let status = "Insufficient Evidence";
  let statusBadgeClass = "sub";
  if (!isSufficient) {
    status = "Insufficient Evidence";
    statusBadgeClass = "sub";
  } else if (accuracy >= 80) {
    status = "Mastered";
    statusBadgeClass = "ok";
  } else if (accuracy >= 60) {
    status = "Proficient";
    statusBadgeClass = "blue";
  } else {
    status = "Developing";
    statusBadgeClass = "warn";
  }

  const meta = CORE_READING_SKILLS.find(s => s.key === skillKey) || {
    key: skillKey,
    title: skillKey,
    desc: "Reading comprehension skill.",
    icon: "📖"
  };

  return {
    key: skillKey,
    title: meta.title,
    desc: meta.desc,
    icon: meta.icon,
    correct,
    attempts,
    sampleSize,
    accuracy,
    isSufficient,
    neededAttempts,
    trend,
    status,
    statusBadgeClass
  };
}

/**
 * Returns complete Reading Mastery analytics report.
 */
function getReadingMasteryReport(studentId) {
  const skills = CORE_READING_SKILLS.map(meta => getSkillMastery(meta.key, studentId));
  const totalAttempts = skills.reduce((sum, s) => sum + s.attempts, 0);
  const totalCorrect = skills.reduce((sum, s) => sum + s.correct, 0);
  const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const masteredCount = skills.filter(s => s.status === "Mastered").length;
  const proficientCount = skills.filter(s => s.status === "Proficient").length;
  const developingCount = skills.filter(s => s.status === "Developing").length;
  const insufficientCount = skills.filter(s => s.status === "Insufficient Evidence").length;

  return {
    skills,
    totalAttempts,
    totalCorrect,
    overallAccuracy,
    masteredCount,
    proficientCount,
    developingCount,
    insufficientCount,
    isOfficialAssessment: false,
    disclaimer: "Formative reading skill analytics based on local practice attempts. Not an official Phil-IRI classification."
  };
}

/**
 * Renders the HTML markup for the Reading Mastery Dashboard
 */
function renderReadingMasteryDashboard(studentId) {
  const report = getReadingMasteryReport(studentId);

  return `
    <div class="reading-mastery-dashboard">
      <!-- Advisory Alert -->
      <div class="card mastery-disclaimer-card" style="background:var(--sky-soft);border-left:4px solid var(--sky);margin-bottom:18px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:1.25rem;line-height:1">📊</span>
          <div>
            <b style="color:var(--sky-ink);font-size:0.9rem">Formative Skill Evidence Dashboard</b>
            <div class="sub-sm" style="margin-top:2px">
              Skill accuracy and trends are computed from question-attempt evidence in this browser. <b>XP and badges are never factored into reading skill decisions.</b> This serves formative guidance and does not replace official DepEd Phil-IRI reading assessment. (Not an official Phil-IRI classification).
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Summary Stats -->
      <div class="mastery-stat-grid" style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:10px;margin-bottom:20px">
        <div class="card" style="text-align:center;padding:12px;margin:0">
          <span class="sub-sm" style="display:block;text-transform:uppercase;font-size:0.75rem">Total Evidence</span>
          <b style="font-size:1.45rem;color:var(--navy);font-family:'Bricolage Grotesque'">${report.totalAttempts} Qs</b>
        </div>
        <div class="card" style="text-align:center;padding:12px;margin:0">
          <span class="sub-sm" style="display:block;text-transform:uppercase;font-size:0.75rem">Mastered (≥80%)</span>
          <b style="font-size:1.45rem;color:#059669;font-family:'Bricolage Grotesque'">${report.masteredCount}</b>
        </div>
        <div class="card" style="text-align:center;padding:12px;margin:0">
          <span class="sub-sm" style="display:block;text-transform:uppercase;font-size:0.75rem">Proficient (≥60%)</span>
          <b style="font-size:1.45rem;color:var(--sky-ink);font-family:'Bricolage Grotesque'">${report.proficientCount}</b>
        </div>
        <div class="card" style="text-align:center;padding:12px;margin:0">
          <span class="sub-sm" style="display:block;text-transform:uppercase;font-size:0.75rem">Needs Evidence</span>
          <b style="font-size:1.45rem;color:var(--sub);font-family:'Bricolage Grotesque'">${report.insufficientCount}</b>
        </div>
      </div>

      <!-- Skill Cards -->
      <div class="mastery-skill-list" style="display:grid;gap:12px">
        ${report.skills.map(skill => {
          let trendBadge = "";
          if (skill.trend === "improving") {
            trendBadge = `<span class="pill ok" style="font-size:0.75rem">📈 Improving</span>`;
          } else if (skill.trend === "needs-focus") {
            trendBadge = `<span class="pill warn" style="font-size:0.75rem">🎯 Needs Focus</span>`;
          } else if (skill.trend === "stable") {
            trendBadge = `<span class="pill" style="font-size:0.75rem">➡️ Stable</span>`;
          }

          let barColor = "var(--border)";
          if (skill.status === "Mastered") barColor = "#10b981";
          else if (skill.status === "Proficient") barColor = "var(--sky)";
          else if (skill.status === "Developing") barColor = "#f59e0b";

          return `
            <div class="card mastery-skill-card" style="padding:16px;margin:0">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:1.6rem" aria-hidden="true">${skill.icon}</span>
                  <div>
                    <h4 style="margin:0;font-size:1.05rem">${escapeHTML(skill.title)}</h4>
                    <p class="sub-sm" style="margin:2px 0 0">${escapeHTML(skill.desc)}</p>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  ${trendBadge}
                  <span class="pill ${skill.statusBadgeClass}">${escapeHTML(skill.status)}</span>
                </div>
              </div>

              <div style="margin-top:14px">
                ${skill.isSufficient ? `
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span class="sub-sm">Evidence Accuracy: <b>${skill.accuracy}%</b> (${skill.correct}/${skill.attempts} correct)</span>
                    <span class="sub-sm" style="color:var(--sub)">${skill.sampleSize} attempts recorded</span>
                  </div>
                  <div class="bar" role="progressbar" aria-valuenow="${skill.accuracy}" aria-valuemin="0" aria-valuemax="100" style="height:8px;background:rgba(0,0,0,0.06);border-radius:4px;overflow:hidden">
                    <i style="width:${skill.accuracy}%;background:${barColor};height:100%;display:block;border-radius:4px"></i>
                  </div>
                ` : `
                  <div style="background:rgba(100,116,139,0.08);padding:10px 14px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
                    <span class="sub-sm" style="color:var(--text)">
                      ⏳ <b>Insufficient Evidence (${skill.attempts}/3 attempts)</b> · Answer ${skill.neededAttempts} more questions to establish accuracy baseline.
                    </span>
                    <button class="btn sm o" data-a="tab" data-v="practice">Practice Stories</button>
                  </div>
                `}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}
