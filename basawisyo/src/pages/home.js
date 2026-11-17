function viewHome() {
  const u = AUTH.currentUser;
  const role = u ? u.role : "guest";
  const currentLvlStr = S.lvl !== null ? PHIL_IRI_LEVELS[S.lvl] : "Not Assessed";
  const journey = role === "student" || role === "guest" ? journeySummary() : null;
  const publishedPassages = getPublishedPassages();
  const tierCounts = DIFF_KEYS.map(key => publishedPassages.filter(passage => passage.diff === key).length);
  const isUnassessedStudent = role === "student" && S.lvl === null;
  const tierPill = index => isUnassessedStudent
    ? `<span class="pill">${uiIcon("lock")} Placement Required</span>`
    : journey && index > journey.tier
      ? `<span class="pill">${uiIcon("lock")} Locked</span>`
      : `<span class="pill ok">${tierCounts[index]} Passages</span>`;
  const assignmentLocked = id => {
    if (isUnassessedStudent) return true;
    const passage = publishedPassages.find(item => item.id === id);
    return passage && journey && DIFF_KEYS.indexOf(passage.diff) > journey.tier;
  };

  // Build role-specific banner
  let roleBanner = "";
  if (role === "student") {
    if (u.teacherCode) {
      // Find teacher
      const teach = AUTH.users.find(x => x.role === "teacher" && x.shareCode === u.teacherCode);
      const teachName = teach ? teach.name : "Your Teacher";
      // Check assignments
      const myAsgs = AUTH.assignments.filter(a => 
        a.teacherCode === u.teacherCode && publishedPassages.some(passage => passage.id === a.passageId)
        && (a.targetGroup === "all" || a.targetGroup === `level-${u.lvl}`)
      );

      roleBanner = `
        <div class="card home-role-card home-role-student">
          <div class="home-role-content">
            <div>
              <div class="lab" style="color:var(--sky-ink)">${uiIcon("classroom")} Connected Classroom</div>
              <h3 style="margin:2px 0 0 0">${escapeHTML(teachName)} · ${escapeHTML(u.section || "Grade 8")}</h3>
              <p class="sub" style="margin:4px 0 0 0">Classroom Share Code: <b>${escapeHTML(u.teacherCode)}</b> · Live roster synced</p>
            </div>
            <span class="level-badge level-${S.lvl !== null ? S.lvl : 1}">
              ${currentLvlStr}
            </span>
          </div>

          ${myAsgs.length > 0 ? `
            <div class="home-assignment-list">
              <div class="lab" style="margin-bottom:6px">${uiIcon("practice")} Assigned by Teacher for your reading level:</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${myAsgs.map(a => `
                  <div class="assigned-story-row">
                    <div>
                      <b>${escapeHTML(a.title)}</b>
                      <span class="sub-sm" style="margin-left:6px">Due: ${escapeHTML(a.dueDate)}</span>
                    </div>
                    <button class="btn sm" ${isUnassessedStudent ? 'data-a="tab" data-v="assess"' : `data-a="read-passage" data-v="${escapeHTML(a.passageId)}"`}
                      ${!isUnassessedStudent && assignmentLocked(a.passageId) ? 'disabled title="Complete earlier tiers or ask your teacher to unlock this tier"' : ""}>
                      ${isUnassessedStudent ? "Take Placement First" : assignmentLocked(a.passageId) ? "Tier locked" : "Read Now"}
                    </button>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : `
            <div class="home-empty-assignment sub-sm">
              ${uiIcon("check")} You are up to date on all teacher reading assignments!
            </div>
          `}
        </div>
      `;
    } else if (u.enrollmentStatus === "pending" && u.pendingTeacherCode) {
      const requestedTeacher = AUTH.users.find(x => x.role === "teacher" && x.shareCode === u.pendingTeacherCode);
      roleBanner = `<section class="card home-role-card" role="status" aria-live="polite">
        <div class="lab">Classroom request pending</div><h3>Waiting for teacher review</h3>
        <p class="sub">${escapeHTML(requestedTeacher?.name || "Your teacher")} · ${escapeHTML(requestedTeacher?.section || "Classroom")}. You can continue reading while your teacher reviews your request.</p>
      </section>`;
    } else {
      roleBanner = `
        <div class="connect-teacher-card">
          <h3>${uiIcon("classroom")} Connect with Your Teacher</h3>
          <p class="sub">${u.enrollmentStatus === "declined"
            ? "Your previous request was declined. Confirm the code with your teacher, then request again."
            : "Enter your teacher's Share Code to request a place in their class. Your teacher will review it before class assignments appear."}</p>
          <div class="connect-row">
            <input type="text" id="home-teacher-code" aria-label="Teacher share code" placeholder="e.g. BASA-TEACH-8492">
            <button class="btn" data-a="student-connect-teacher">Request to Join</button>
          </div>
        </div>
      `;
    }
  } else if (role === "teacher") {
    const studCount = AUTH.getTeacherStudents().length;
    roleBanner = `
      <div class="card home-role-card home-role-teacher">
        <div class="home-role-content">
          <div>
            <div class="lab" style="color:var(--teal-ink)">${uiIcon("teacher")} Teacher Workspace · ${escapeHTML(u.section)}</div>
            <h3 style="margin:2px 0 0 0">Classroom Share Code: <b>${escapeHTML(u.shareCode)}</b></h3>
            <p class="sub" style="margin:4px 0 0 0">${studCount} students currently connected to your roster</p>
          </div>
          <div class="teacher-home-actions">
            <button class="btn sm" data-a="tab" data-v="teacher">${uiIcon("teacher")} Open Classroom Hub</button>
            <button class="btn o sm" data-a="teacher-show-projector">${uiIcon("projector")} Blackboard Code</button>
          </div>
        </div>
      </div>
    `;
  } else if (role === "admin") {
    roleBanner = `
      <div class="card home-role-card home-role-admin">
        <div class="home-role-content">
          <div>
            <div class="lab" style="color:var(--coral-ink)">${uiIcon("admin")} School Administration Console</div>
            <h3 style="margin:2px 0 0 0">${u.school}</h3>
            <p class="sub" style="margin:4px 0 0 0">${AUTH.users.length} total users enrolled · Full curriculum & account management</p>
          </div>
          <button class="btn sm" data-a="tab" data-v="admin">${uiIcon("admin")} Open Admin Panel</button>
        </div>
      </div>
    `;
  } else {
    // Guest
    roleBanner = `
      <div class="card home-role-card home-role-guest">
        <div class="home-role-content">
          <div>
            <div class="lab" style="color:var(--gold-ink)">${uiIcon("user")} Guest Mode</div>
            <h3 style="margin:2px 0 0 0">Identify Your Reading Level Instantly</h3>
            <p class="sub" style="margin:4px 0 0 0">No account required for guest practice. Your progress stays in this browser and can transfer when you create a student account here.</p>
          </div>
          <div class="guest-entry-actions">
            <button class="btn blue sm" data-a="start-placement" data-v="guest">${uiIcon("assess")} Start Guest Diagnostic</button>
            <button class="btn o sm" data-a="auth-open">${uiIcon("profile")} Sign in</button>
            <button class="btn o sm" data-a="auth-open" data-v="register">Create account</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="hero home-hero">
      <div class="home-hero-copy">
      <div class="lab" style="color:#f5ab1d">Welcome to BasaWisyo</div>
      <h2>Every Filipino Learner a Confident Reader.</h2>
      <p class="sub">
        Culturally rooted reading practice built for Grades 7 to 12. Try a placement activity, explore leveled Philippine stories, follow your reading journey, and celebrate progress with badges.
      </p>
      <div class="home-hero-actions">
        ${isUnassessedStudent ? `
          <button class="btn blue sm" data-a="tab" data-v="assess">
            ${uiIcon("assess")} Start Placement Test
          </button>
          <button class="btn o sm" data-a="tab" data-v="practice">
            ${uiIcon("practice")} Browse 24+ Passages
          </button>
        ` : `
          <button class="btn blue sm" data-a="tab" data-v="practice">
            ${uiIcon("practice")} Continue Reading →
          </button>
          <button class="btn o sm" data-a="tab" data-v="assess">
            ${uiIcon("assess")} Check Reading Level
          </button>
        `}
      </div>
      </div>
      <div class="home-hero-art" aria-hidden="true">
        <div class="home-hero-book"><span></span><span></span><span></span></div>
        <img src="assets/images/wisyo.png" alt="">
      </div>
    </div>

    ${roleBanner}
    <div class="home-dashboard-grid">
      ${journey ? `<div class="home-dashboard-main">
        ${typeof renderDailyQuestCard === "function" ? renderDailyQuestCard() : ""}
        ${viewJourneyPanel(journey)}
        <div class="home-profile-link">
          <button class="btn o sm" data-a="tab" data-v="profile">${uiIcon("badge")} View badges in ${role === "guest" ? "My Progress" : "Student Profile"}</button>
        </div>
      </div>` : ""}
      <div class="home-dashboard-side">
        <!-- Quick Stat Bar -->
        <div class="stat-grid">
          <div class="stat-box">
            <div class="lab">Your Phil-IRI Level</div>
            <div class="num">${currentLvlStr}</div>
            <div class="sub-sm">${S.ss} sessions completed</div>
          </div>
          <div class="stat-box">
            <div class="lab">Daily Reading Streak</div>
            <div class="num" style="color:var(--gold-ink)">🔥 ${S.streak || 0} ${(S.streak || 0) === 1 ? "Day" : "Days"}</div>
            <div class="sub-sm">${(S.streak || 0) > 0 ? "Daily reading habit active!" : "Read a passage today to start!"}</div>
          </div>
          <div class="stat-box">
            <div class="lab">Words Read</div>
            <div class="num">${S.w.toLocaleString()}</div>
            <div class="sub-sm">Contributed to class quest</div>
          </div>
        </div>

        <!-- 4 Difficulty Tiers Showcase -->
        <div class="card home-tiers-card">
          <div class="lab">Leveled Reading Tiers</div>
          <h3>Choose Your Difficulty</h3>
          <p class="sub">Carefully calibrated texts spanning foundational to college-prep analytical prose:</p>
          
          <div class="home-tier-list">
            <button type="button" class="tier-row tier-easy" data-a="filter-diff" data-v="easy">
              <span class="tier-copy">
                <b style="color:var(--teal-ink)"><span class="badge-diff diff-easy" style="margin-right:6px">EASY</span> Easy (Madali)</b>
                <span class="sub-sm">Grade 7 Foundational · Everyday community life & nature</span>
              </span>
              ${tierPill(0)}
            </button>

            <button type="button" class="tier-row tier-medium" data-a="filter-diff" data-v="medium">
              <span class="tier-copy">
                <b style="color:var(--gold-ink)"><span class="badge-diff diff-medium" style="margin-right:6px">MEDIUM</span> Medium (Katamtaman)</b>
                <span class="sub-sm">Grade 8–9 Instructional · Ecology, local history & science</span>
              </span>
              ${tierPill(1)}
            </button>

            <button type="button" class="tier-row tier-hard" data-a="filter-diff" data-v="hard">
              <span class="tier-copy">
                <b style="color:var(--coral-ink)"><span class="badge-diff diff-hard" style="margin-right:6px">HARD</span> Hard (Mahirap)</b>
                <span class="sub-sm">Grade 10–11 Advanced · Rhetoric, propaganda & engineering</span>
              </span>
              ${tierPill(2)}
            </button>

            <button type="button" class="tier-row tier-extreme" data-a="filter-diff" data-v="extreme">
              <span class="tier-copy">
                <b style="color:var(--purple-ink)"><span class="badge-diff diff-extreme" style="margin-right:6px">EXTREME</span> Extreme (Sukdulan)</b>
                <span class="sub-sm">Grade 12 Mastery · Jurisprudence, ethology & critical theory</span>
              </span>
              ${tierPill(3)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

