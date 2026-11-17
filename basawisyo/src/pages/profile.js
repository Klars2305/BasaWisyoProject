function viewProfile() {
  const user = AUTH.currentUser;
  if (user && user.role !== "student") {
    return `<section class="card"><h2>Learner Profile</h2><p class="sub">This view is for students and guests.</p></section>`;
  }
  const summary = journeySummary();
  const journey = summary.journey;
  const rank = readingRank(journey);
  const badges = journeyAchievements(journey).filter(badge => badge.earned);
  const teacher = user?.teacherCode
    ? AUTH.users.find(item => item.role === "teacher" && item.shareCode === user.teacherCode)
    : null;
  const pendingTeacher = user?.pendingTeacherCode
    ? AUTH.users.find(item => item.role === "teacher" && item.shareCode === user.pendingTeacherCode) : null;
  const placement = user && Number.isInteger(user.lvl) && user.lvl >= 0 && user.lvl < PHIL_IRI_LEVELS.length
    ? PHIL_IRI_LEVELS[user.lvl] : "Not assessed";
  const completed = DIFF_KEYS.flatMap((_, tier) => journeyEligiblePassages(tier))
    .filter(passage => journey.results[passage.id]?.total === passage.qs.length)
    .map(passage => ({ passage, result: journey.results[passage.id] }));
  const name = user?.name || "Guest Reader";
    const totalXP = typeof journeyTotalXP === "function" ? journeyTotalXP(journey) : 0;
    const badgeReqs = typeof journeyBadgeRequirements === "function" ? journeyBadgeRequirements(journey) : [];
    const lockedBadges = badgeReqs.filter(b => !b.earned);
    return `<div class="profile-page"><div class="profile-heading">
      <span class="profile-avatar frame-${journeySelectedFrame()}" aria-hidden="true">${escapeHTML(name.charAt(0).toUpperCase())}</span>
      <div><div class="lab">${user ? "Student Profile" : "My Progress"}</div>
        <h2>${escapeHTML(name)}</h2>
        <p class="sub-sm">${user ? "Your reading practice and rewards in this browser." : "Your guest progress is saved in this browser."}</p>
      </div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
        <button class="btn sm o" data-a="tour-replay" title="Replay the interactive onboarding walkthrough">🎓 Replay Tutorial</button>
      </div>
    </div>
    ${!user ? `<section class="card profile-guest-note">
      <p class="sub">Create a student account to keep this guest reading journey with your profile. Class Board participation stays off until you choose to join.</p>
      <button class="btn blue sm" data-a="auth-open" data-v="register">Create student account</button>
      <button class="btn o sm" data-a="auth-open">Sign in</button>
    </section>` : `<section class="card profile-account" aria-label="Your class information">
      <div class="lab">My Class</div>
      <p><b>Section:</b> ${escapeHTML(user.section || "Not linked to a class")}</p>
      <p><b>Teacher:</b> ${escapeHTML(teacher?.name || "Not linked to a teacher")}</p>
      ${user.enrollmentStatus === "pending" ? `<p role="status"><b>Enrollment:</b> Waiting for ${escapeHTML(pendingTeacher?.name || "your teacher")} to review your request.</p>` : ""}
      ${user.enrollmentStatus === "declined" ? `<p role="status"><b>Enrollment:</b> Request declined. Check the share code with your teacher and try again from Home.</p>` : ""}
      <p><b>Placement label:</b> ${escapeHTML(placement)} <span class="sub-sm">(prototype placement, not an official Phil-IRI result)</span></p>
    </section>`}
    ${(() => {
      const isPrem = typeof isUserPremium === "function" ? isUserPremium() : false;
      const planName = user?.plan === "plus_annual" ? "Annual Member (₱99/mo)" : (user?.plan === "plus_monthly" ? "Monthly Member (₱149/mo)" : (isPrem ? "Wisyo Plus Active" : "Free Practice Tier"));
      return `<section class="card profile-membership-card ${isPrem ? "is-premium" : ""}" aria-label="Wisyo Plus Membership">
      <div class="membership-header">
        <div>
          <div class="lab">${uiIcon("sparkles")} Membership &amp; Features</div>
          <h3 style="margin:2px 0 0;font-size:1.15rem;display:flex;align-items:center;gap:8px">
            <span class="membership-badge ${isPrem ? "gold" : ""}">${isPrem ? "👑 Wisyo Plus" : "🌱 Free Plan"}</span>
            <span>${escapeHTML(planName)}</span>
          </h3>
        </div>
        <button class="btn sm ${isPrem ? "o" : "blue"}" data-a="upgrade-open">
          ${isPrem ? "Manage Plan" : "⭐ Upgrade to Wisyo Plus"}
        </button>
      </div>
      <p class="sub-sm" style="margin:4px 0 10px">
        ${isPrem 
          ? "You have full access to Wisyo Plus learning enhancements including unlimited practice hearts, speech audio, and advanced AI tutor." 
          : "Enjoy core curriculum reading and diagnostics for free, or upgrade for unlimited hearts, audio pronunciation, and smart AI tutoring."}
      </p>
      <ul class="membership-features">
        <li><span class="check">✓</span> ${isPrem ? "<strong>Unlimited Practice Hearts</strong> (❤️ ∞)" : "Standard Hearts per Quiz (Instant Retries)"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>Smart Contextual Audio</strong> (Web Speech 🔊)" : "Trilingual Dictionary & POS Badges"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>Unlimited Flashcards</strong>" : "Up to 30 Saved Flashcards"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>High-Thinking Wisyo AI</strong> (1,000 tokens)" : "10 Daily Wisyo AI Messages"}</li>
        <li><span class="check">✓</span> ${isPrem ? "<strong>Unlimited Story Imports</strong>" : "2 Personal Story Imports / Mo"}</li>
      </ul>
      <p class="membership-guarantee">
        <span>🛡️</span> <b>Equal Education Guarantee:</b> Reading curriculum, diagnostic placement, and teacher assignments are 100% free for all students.
      </p>
    </section>`;
    })()}
    <section class="profile-summary" aria-label="Your reading summary">
      <div class="card profile-stat"><span class="lab">Reading Path</span><b>${escapeHTML(DIFF_NAMES[DIFF_KEYS[summary.tier]])}</b></div>
      <div class="card profile-stat"><span class="lab">Stories Finished</span><b>${rank.stories}</b></div>
      <div class="card profile-stat"><span class="lab">Total XP</span><b class="profile-xp-value">${totalXP} XP</b><span class="sub-sm">5 XP/correct · 10 XP/story</span></div>
      <div class="card profile-stat"><span class="lab">Badges Earned</span><b>${badges.length} of ${JOURNEY_BADGES.length}</b></div>
      <div class="card profile-stat"><span class="lab">Activity Rank</span><b>${escapeHTML(rank.title)}</b></div>
    </section>
    ${viewJourneyPanel(summary)}
    ${lockedBadges.length ? `<section class="card profile-next-badges" aria-label="What is needed for your next badge">
      <div class="lab">${uiIcon("sparkles")} Next Badges to Unlock</div>
      <h3>Badges in Progress</h3>
      <p class="sub-sm">Rewards celebrate progress, effort, and customization—never punishment for mistakes. No XP loss or penalties on retries!</p>
      <div class="profile-badge-targets">
        ${lockedBadges.map(b => `<div class="profile-badge-target">
          <div class="profile-badge-target-head">
            <b>${b.icon} ${escapeHTML(b.title)}</b>
            <span class="pill">${escapeHTML(b.progressLabel)}</span>
          </div>
          <div class="sub-sm">${escapeHTML(b.description)}</div>
          <div class="sub-sm profile-badge-target-next"><b>Target:</b> ${escapeHTML(b.missingText)}</div>
        </div>`).join("")}
      </div>
    </section>` : ""}
    ${viewAchievementsPanel(journey)}

    <section class="card profile-stories" aria-label="Your completed reading practices">
      <div class="lab">My Completed Stories</div>
      ${completed.length ? `<ul>${completed.map(({ passage, result }) => `<li>
        <div><b>${escapeHTML(passage.t)}</b><span class="sub-sm">${escapeHTML(DIFF_NAMES[passage.diff])} · Best practice: ${result.correct} of ${result.total} correct</span></div>
        <button class="btn o sm" data-a="read-passage" data-v="${escapeHTML(passage.id)}"
          ${journeyCanRead(passage) ? "" : 'disabled aria-label="Complete earlier reading tiers to reopen this passage"'}>
          ${journeyCanRead(passage) ? "Read again" : "Tier locked"}</button>
      </li>`).join("")}</ul>` : `<p class="sub">No completed stories yet. Start with the next recommended passage above.</p>`}
    </section>
    <!-- Reading Mastery Dashboard -->
    <section class="card profile-mastery-section" aria-label="Reading comprehension skill mastery">
      <div class="lab">${uiIcon("target")} Reading Mastery</div>
      <h3>Reading Skill Evidence &amp; Analytics</h3>
      <p class="sub-sm">Evidence-based comprehension breakdown across literal, inference, vocabulary, sequencing, and main idea questions.</p>
      ${typeof renderReadingMasteryDashboard === "function" ? renderReadingMasteryDashboard(user?.id) : ""}
    </section></div>`;
}
