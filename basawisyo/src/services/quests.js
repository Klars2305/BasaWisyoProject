/* ==========================================================================
   BasaWisyo Daily Reading Quests & Streak System
   - Daily goals: 1 reading passage + 1 comprehension quiz (≥75%) + 1 mistake review / Wisyo consult.
   - 3/3 Tasks completion reward: +25 XP Bonus.
   - Idempotent: rewards claimed at most once per local calendar day.
   - Streak tracking with broken streak detection.
   ========================================================================== */

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialDailyQuest(dateStr = getTodayDateString()) {
  return {
    date: dateStr,
    tasks: {
      read: {
        id: "read",
        title: "Read 1 Story",
        desc: "Open and read any qualifying reading passage.",
        completed: false,
        count: 0,
        target: 1
      },
      quiz: {
        id: "quiz",
        title: "Pass 1 Quiz (≥75%)",
        desc: "Score 75% or higher on a practice quiz.",
        completed: false,
        count: 0,
        target: 1
      },
      review: {
        id: "review",
        title: "Review Answers or Ask Wisyo",
        desc: "Review your quiz answers or consult Wisyo AI for guidance.",
        completed: false,
        count: 0,
        target: 1
      }
    },
    completed: false,
    claimedAt: null,
    rewardXP: 25
  };
}

function getDailyQuest(targetDate = getTodayDateString()) {
  const user = (typeof AUTH !== "undefined" && AUTH.currentUser && AUTH.currentUser.role === "student")
    ? AUTH.currentUser : null;
  let q = user ? user.dailyQuest : (typeof S !== "undefined" ? S.dailyQuest : null);

  if (!q || typeof q !== "object" || q.date !== targetDate || !q.tasks || !q.tasks.read || !q.tasks.quiz || !q.tasks.review) {
    q = createInitialDailyQuest(targetDate);
    saveDailyQuest(q);
  }
  return q;
}

function saveDailyQuest(quest) {
  const user = (typeof AUTH !== "undefined" && AUTH.currentUser && AUTH.currentUser.role === "student")
    ? AUTH.currentUser : null;
  if (user) {
    user.dailyQuest = quest;
    if (typeof AUTH.saveSession === "function") AUTH.saveSession();
    if (Array.isArray(AUTH.users)) {
      const idx = AUTH.users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        AUTH.users[idx] = { ...AUTH.users[idx], dailyQuest: quest };
        try { localStorage.setItem(AUTH.USERS_KEY, JSON.stringify(AUTH.users)); } catch(e) {}
      }
    }
  }
  if (typeof S !== "undefined") {
    S.dailyQuest = quest;
    if (typeof save === "function") save();
  }
}

function awardQuestBonusXP(amount) {
  if (!amount || amount <= 0) return;
  if (typeof journeyForCurrent === "function" && typeof saveCurrentJourney === "function") {
    const journey = journeyForCurrent();
    if (journey) {
      journey.bonusXP = (journey.bonusXP || 0) + amount;
      saveCurrentJourney(journey);
    }
  }
  if (typeof S !== "undefined") {
    S.questBonusXP = (S.questBonusXP || 0) + amount;
    if (typeof save === "function") save();
  }
}

function updateQuestProgress(taskKey, count = 1) {
  const quest = getDailyQuest();
  if (!quest || !quest.tasks || !quest.tasks[taskKey]) return null;

  const task = quest.tasks[taskKey];
  task.count = Math.min(task.target, (task.count || 0) + count);
  if (task.count >= task.target) {
    task.completed = true;
  }

  let newlyCompleted = false;
  const allDone = Object.values(quest.tasks).every(t => t.completed);

  // Award rewards idempotently: only once per calendar day
  if (allDone && !quest.completed && !quest.claimedAt) {
    quest.completed = true;
    quest.claimedAt = Date.now();
    newlyCompleted = true;

    awardQuestBonusXP(quest.rewardXP || 25);

    if (typeof showToast === "function") {
      showToast("🎉 Daily Quest Completed! +25 Bonus XP earned!", "ok");
    }
  }

  saveDailyQuest(quest);
  return { quest, newlyCompleted, allDone };
}

function getDailyStreak() {
  if (typeof S === "undefined" || !S.lastPracticeDate) return 0;
  const today = getTodayDateString();
  if (S.lastPracticeDate === today) return S.streak || 1;

  const lastDate = new Date(S.lastPracticeDate + "T00:00:00Z");
  const currDate = new Date(today + "T00:00:00Z");
  const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / 86400000);

  if (diffDays === 1) {
    return S.streak || 1;
  }
  if (diffDays > 1) {
    return 0; // Streak broken, will reset to 1 on next practice
  }
  return S.streak || 0;
}

function renderStreakPill() {
  const streak = getDailyStreak();
  const title = streak > 0 ? `${streak} day reading streak` : "Start your reading streak today!";
  return `
    <div class="streak-pill streak-pill-content ${streak === 0 ? 'streak-zero' : ''}" title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}">
      <div class="streak-flame-badge" aria-hidden="true">🔥</div>
      <div class="streak-info-text">
        <span class="streak-count">${streak}</span>
        <span class="streak-label">Day Streak</span>
      </div>
      <svg class="streak-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `;
}

function renderDailyQuestCard() {
  const quest = getDailyQuest();
  const streak = getDailyStreak();
  const tasks = Object.values(quest.tasks);
  const doneCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  const formattedDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) || quest.date;

  return `
    <section class="card daily-quest-card" aria-label="Daily Reading Quest">
      <div class="quest-header">
        <div class="quest-title-wrap">
          <div class="quest-eyebrow">
            <span class="quest-sparkle-icon" aria-hidden="true">⭐</span> Daily Quest · ${escapeHTML(formattedDate)}
          </div>
          <h3 class="quest-title">Daily Reading Quest</h3>
        </div>
        <div class="quest-streak-badge" title="Daily Streak">
          <span class="streak-flame" aria-hidden="true">🔥</span>
          <b>${streak}</b> <span class="streak-label">${streak === 1 ? "day" : "days"}</span>
        </div>
      </div>

      <div class="quest-progress-section">
        <div class="quest-progress-meta">
          <span class="quest-progress-label"><b>${doneCount}/${totalCount}</b> Tasks Completed</span>
          <span class="quest-progress-pct">${pct}%</span>
        </div>
        <div class="quest-progress-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="quest-progress-fill" style="width: ${pct}%"></div>
        </div>
      </div>

      <div class="quest-task-list">
        ${tasks.map(t => {
          let actionBtn = "";
          if (!t.completed) {
            if (t.id === "read") {
              actionBtn = `<button class="btn sm o quest-action-btn" data-a="tab" data-v="practice">Read Now</button>`;
            } else if (t.id === "quiz") {
              actionBtn = `<span class="quest-chip pending">Quiz Pending</span>`;
            } else if (t.id === "review") {
              actionBtn = `<button class="btn sm o quest-action-btn" data-a="start-smart-review">Smart Review</button>`;
            }
          } else {
            actionBtn = `<span class="quest-chip done">${uiIcon("check")} Completed</span>`;
          }

          return `
            <div class="quest-task-row ${t.completed ? 'task-done' : ''}">
              <div class="quest-task-icon" aria-hidden="true">
                ${t.completed ? `<span class="task-check-circle">${uiIcon("check")}</span>` : `<span class="task-empty-circle"></span>`}
              </div>
              <div class="quest-task-info">
                <div class="quest-task-title">${escapeHTML(t.title)}</div>
                <div class="quest-task-desc">${escapeHTML(t.desc)}</div>
              </div>
              <div class="quest-task-action">
                ${actionBtn}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="quest-footer">
        ${quest.completed ? `
          <div class="quest-reward-banner claimed">
            <span class="reward-icon" aria-hidden="true">🎉</span>
            <div class="reward-copy">
              <b>Today's Reward Claimed!</b>
              <span>+${quest.rewardXP} Bonus XP has been added to your profile.</span>
            </div>
          </div>
        ` : `
          <div class="quest-reward-banner pending">
            <span class="reward-icon" aria-hidden="true">🎁</span>
            <div class="reward-copy">
              <b>Reward for Completing 3 Tasks:</b>
              <span>Earn +${quest.rewardXP} Bonus XP upon finishing all 3 daily tasks.</span>
            </div>
          </div>
        `}
      </div>
    </section>
  `;
}
