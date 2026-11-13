function viewHome() {
  const u = AUTH.currentUser;
  const role = u ? u.role : "guest";
  const currentLvlStr = S.lvl !== null ? PHIL_IRI_LEVELS[S.lvl] : "Not Assessed";

  // Build role-specific banner
  let roleBanner = "";
  if (role === "student") {
    if (u.teacherCode) {
      // Find teacher
      const teach = AUTH.users.find(x => x.role === "teacher" && x.shareCode === u.teacherCode);
      const teachName = teach ? teach.name : "Your Teacher";
      // Check assignments
      const myAsgs = AUTH.assignments.filter(a => 
        a.teacherCode === u.teacherCode && (a.targetGroup === "all" || a.targetGroup === `level-${S.lvl}`)
      );

      roleBanner = `
        <div class="card" style="background:linear-gradient(135deg, var(--card), var(--sky-soft));border-left:5px solid var(--sky);margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <div class="lab" style="color:var(--sky)">🎓 Connected Classroom</div>
              <h3 style="margin:2px 0 0 0">${teachName} · ${u.section || "Grade 8"}</h3>
              <p class="sub" style="margin:4px 0 0 0">Classroom Share Code: <b>${u.teacherCode}</b> · Live roster synced</p>
            </div>
            <span class="level-badge level-${S.lvl !== null ? S.lvl : 1}">
              ${currentLvlStr}
            </span>
          </div>

          ${myAsgs.length > 0 ? `
            <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">
              <div class="lab" style="margin-bottom:6px">📌 Assigned by Teacher for your reading level:</div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${myAsgs.map(a => `
                  <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <b>${a.title}</b>
                      <span class="sub-sm" style="margin-left:6px">Due: ${a.dueDate}</span>
                    </div>
                    <button class="btn sm" data-a="read-passage" data-v="${a.passageId}">Read Now</button>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : `
            <div style="margin-top:10px;font-size:12px;color:var(--sub)">
              ✓ You are up to date on all teacher reading assignments!
            </div>
          `}
        </div>
      `;
    } else {
      roleBanner = `
        <div class="connect-teacher-card">
          <h3>👩‍🏫 Connect with Your Teacher</h3>
          <p class="sub">Enter the Share Code provided by your teacher to join your section, sync diagnostic scores, and receive assigned stories:</p>
          <div class="connect-row">
            <input type="text" id="home-teacher-code" placeholder="e.g. BASA-TEACH-8492">
            <button class="btn" data-a="student-connect-teacher">Join Class</button>
          </div>
        </div>
      `;
    }
  } else if (role === "teacher") {
    const studCount = AUTH.getTeacherStudents().length;
    roleBanner = `
      <div class="card" style="background:linear-gradient(135deg, var(--card), var(--teal-soft));border-left:5px solid var(--teal);margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div class="lab" style="color:var(--teal)">👩‍🏫 Teacher Workspace · ${u.section}</div>
            <h3 style="margin:2px 0 0 0">Classroom Share Code: <b>${u.shareCode}</b></h3>
            <p class="sub" style="margin:4px 0 0 0">${studCount} students currently connected to your roster</p>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn sm" data-a="tab" data-v="teacher">Open Classroom Hub</button>
            <button class="btn o sm" data-a="teacher-show-projector">📡 Blackboard Code</button>
          </div>
        </div>
      </div>
    `;
  } else if (role === "admin") {
    roleBanner = `
      <div class="card" style="background:linear-gradient(135deg, var(--card), var(--coral-soft));border-left:5px solid var(--coral);margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div class="lab" style="color:var(--coral)">🛡️ School Administration Console</div>
            <h3 style="margin:2px 0 0 0">${u.school}</h3>
            <p class="sub" style="margin:4px 0 0 0">${AUTH.users.length} total users enrolled · Full curriculum & account management</p>
          </div>
          <button class="btn sm" data-a="tab" data-v="admin">Open Admin Panel</button>
        </div>
      </div>
    `;
  } else {
    // Guest
    roleBanner = `
      <div class="card" style="background:linear-gradient(135deg, var(--gold-soft), var(--card));border-left:5px solid var(--gold);margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div class="lab" style="color:var(--gold-hover)">👤 Guest Mode</div>
            <h3 style="margin:2px 0 0 0">Identify Your Reading Level Instantly</h3>
            <p class="sub" style="margin:4px 0 0 0">No account required! Take a 3-minute diagnostic test or sign in to save your profile.</p>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn gold sm" data-a="start-placement" data-v="guest">⚡ Start Guest Diagnostic</button>
            <button class="btn o sm" data-a="auth-open">🔐 Sign In / Register</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    ${roleBanner}

    <div class="hero">
      <div class="lab" style="color:#f5ab1d">Mabuhay! Welcome to BasaWisyo</div>
      <h2>Every Filipino Learner a Confident Reader.</h2>
      <p class="sub">
        Offline-first, culturally rooted reading practice built for Grades 7 to 12. Complete diagnostic placement, explore leveled Philippine stories, read together in class quests, and generate official DepEd Phil-IRI reports in seconds.
      </p>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn gold sm" data-a="tab" data-v="assess">
          ${S.lvl === null ? "🎯 Start Placement Test" : "🔄 Check Reading Level"}
        </button>
        <button class="btn o sm" data-a="tab" data-v="practice">
          📖 Browse 24+ Passages
        </button>
      </div>
    </div>

    <div class="home-layout">
      <div>
        <!-- Quick Stat Bar -->
        <div class="stat-grid">
          <div class="stat-box">
            <div class="lab">Your Phil-IRI Level</div>
            <div class="num">${currentLvlStr}</div>
            <div class="sub-sm">${S.ss} sessions completed</div>
          </div>
          <div class="stat-box">
            <div class="lab">Words Read</div>
            <div class="num">${S.w.toLocaleString()}</div>
            <div class="sub-sm">Contributed to class quest</div>
          </div>
        </div>

        <!-- 4 Difficulty Tiers Showcase -->
        <div class="card">
          <div class="lab">Leveled Reading Tiers</div>
          <h3>Choose Your Difficulty</h3>
          <p class="sub">Carefully calibrated texts spanning foundational to college-prep analytical prose:</p>
          
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
            <div class="row" style="background:var(--teal-soft);padding:10px;border-radius:10px;cursor:pointer" data-a="filter-diff" data-v="easy">
              <div>
                <b style="color:var(--teal)">🟢 Easy (Madali)</b>
                <div class="sub-sm">Grade 7 Foundational · Everyday community life & nature</div>
              </div>
              <span class="pill ok">6 Passages</span>
            </div>

            <div class="row" style="background:var(--gold-soft);padding:10px;border-radius:10px;cursor:pointer" data-a="filter-diff" data-v="medium">
              <div>
                <b style="color:var(--gold-hover)">🟡 Medium (Katamtaman)</b>
                <div class="sub-sm">Grade 8–9 Instructional · Ecology, local history & science</div>
              </div>
              <span class="pill warn">6 Passages</span>
            </div>

            <div class="row" style="background:var(--coral-soft);padding:10px;border-radius:10px;cursor:pointer" data-a="filter-diff" data-v="hard">
              <div>
                <b style="color:var(--coral)">🟠 Hard (Mahirap)</b>
                <div class="sub-sm">Grade 10–11 Advanced · Rhetoric, propaganda & engineering</div>
              </div>
              <span class="pill">6 Passages</span>
            </div>

            <div class="row" style="background:var(--purple-soft);padding:10px;border-radius:10px;cursor:pointer" data-a="filter-diff" data-v="extreme">
              <div>
                <b style="color:var(--purple)">🔴 Extreme (Sukdulan)</b>
                <div class="sub-sm">Grade 12 Mastery · Jurisprudence, ethology & critical theory</div>
              </div>
              <span class="pill">6 Passages</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

