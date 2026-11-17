/* === src/services/auth.js === */
/* ==========================================================================
   BasaWisyo Authentication, Multi-Role & Classroom Architecture
   ========================================================================== */

const AUTH = {
  // Storage keys
  USERS_KEY: "basa_wisyo_users_v2",
  SESSION_KEY: "basa_wisyo_session_v2",
  ASSIGNMENTS_KEY: "basa_wisyo_assignments_v2",
  GUEST_TOKENS_KEY: "basa_wisyo_guest_tokens_v2",
  CUSTOM_PASSAGES_KEY: "basa_wisyo_custom_passages_v2",

  currentUser: null,
  users: [],
  assignments: [],
  guestTokens: {},
  customPassages: [],

  // Cryptographic and password hashing utilities (SHA-256 + Salt)
  _sha256(ascii) {
    function r(v, a) { return (v >>> a) | (v << (32 - a)); }
    const M = Math.pow, maxW = M(2, 32);
    let L = "length", i, j, res = "", words = [], bitL = ascii[L] * 8, hash = [], k = [], pC = 0, isC = {};
    for (let c = 2; pC < 64; c++) {
      if (!isC[c]) {
        for (i = 0; i < 313; i += c) isC[i] = c;
        hash[pC] = (M(c, 0.5) * maxW) | 0;
        k[pC++] = (M(c, 1 / 3) * maxW) | 0;
      }
    }
    ascii += "\x80";
    while (ascii[L] % 64 - 56) ascii += "\x00";
    for (i = 0; i < ascii[L]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[L]] = (bitL / maxW) | 0;
    words[words[L]] = bitL | 0;
    for (j = 0; j < words[L];) {
      let w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        let w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        let t1 = hash[7] + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (r(w15, 7) ^ r(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (r(w2, 17) ^ r(w2, 19) ^ (w2 >>> 10))) | 0);
        let t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        let b = (hash[i] >> (j * 8)) & 255;
        res += ((b < 16) ? 0 : "") + b.toString(16);
      }
    }
    return res;
  },

  generateSalt() {
    let salt = "";
    const hex = "0123456789abcdef";
    for (let i = 0; i < 16; i++) {
      salt += hex[Math.floor(Math.random() * 16)];
    }
    return salt;
  },

  hashPassword(password, salt = null) {
    if (!password) return "";
    const s = salt || this.generateSalt();
    const hash = this._sha256(`${s}:${password}`);
    return `sha256$${s}$${hash}`;
  },

  verifyPassword(plain, user) {
    if (!user || typeof plain !== "string") return false;
    const cleanPlain = plain;
    // 1. Salted SHA-256 hash verification
    if (user.passwordHash && typeof user.passwordHash === "string" && user.passwordHash.startsWith("sha256$")) {
      const parts = user.passwordHash.split("$");
      if (parts.length === 3) {
        const salt = parts[1];
        const expected = parts[2];
        const computed = this._sha256(`${salt}:${cleanPlain}`);
        if (computed === expected) return true;
      }
    }
    // 2. Legacy plaintext verification
    if (user.password && user.password === cleanPlain) {
      return true;
    }
    // 3. Admin shorthand alias verification
    if (user.role === "admin" && (cleanPlain === "admin" || cleanPlain === "admin123")) {
      return true;
    }
    return false;
  },

  init() {
    this.currentUser = null;
    this.users = [];
    this.assignments = [];
    this.guestTokens = {};
    this.customPassages = [];
    // 1. Load or seed users
    try {
      const storedUsers = localStorage.getItem(this.USERS_KEY);
      if (storedUsers) {
        this.users = JSON.parse(storedUsers);
      } else {
        this.users = this.getSeedUsers();
        this.saveUsers();
      }
    } catch(e) {
      this.users = this.getSeedUsers();
    }
    // Ensure admin account with admin/admin is always guaranteed in this.users
    let adminUser = this.users.find(u => u.role === "admin");
    if (!adminUser) {
      adminUser = this.getSeedUsers()[0];
      this.users.unshift(adminUser);
      this.saveUsers();
    } else {
      let updated = false;
      if (adminUser.email !== "admin" && adminUser.email !== "admin@basawisyo.ph") {
        adminUser.email = "admin";
        updated = true;
      }
      if (adminUser.password !== "admin" && adminUser.password !== "admin123") {
        adminUser.password = "admin";
        updated = true;
      }
      if (!adminUser.passwordHash) {
        adminUser.passwordHash = this.hashPassword("admin");
        updated = true;
      }
      if (updated) this.saveUsers();
    }
    // Auto-migrate any accounts missing passwordHash
    let migratedAny = false;
    for (const u of this.users) {
      if (!u.passwordHash && u.password) {
        u.passwordHash = this.hashPassword(u.password);
        migratedAny = true;
      }
    }
    if (migratedAny) this.saveUsers();

    // 2. Load or seed assignments
    try {
      const storedAss = localStorage.getItem(this.ASSIGNMENTS_KEY);
      if (storedAss) {
        this.assignments = JSON.parse(storedAss);
      } else {
        this.assignments = this.getSeedAssignments();
        this.saveAssignments();
      }
    } catch(e) {
      this.assignments = this.getSeedAssignments();
    }

    // 3. Load guest tokens
    try {
      const storedTokens = localStorage.getItem(this.GUEST_TOKENS_KEY);
      if (storedTokens) this.guestTokens = JSON.parse(storedTokens);
    } catch(e) {}

    // 4. Load custom passages
    try {
      const storedPassages = localStorage.getItem(this.CUSTOM_PASSAGES_KEY);
      if (storedPassages) this.customPassages = JSON.parse(storedPassages);
    } catch(e) {}

    // 5. Restore active user session
    try {
      const storedSession = localStorage.getItem(this.SESSION_KEY);
      if (storedSession) {
        const sess = JSON.parse(storedSession);
        // Verify user still exists
        const found = this.users.find(u => u.id === sess.id);
        if (found && found.status !== "suspended") {
          this.currentUser = found;
          if (typeof switchAccountState === "function") {
            switchAccountState(found);
          } else if (found.role === "student" && found.lvl !== undefined) {
            S.lvl = found.lvl;
          }
        } else {
          localStorage.removeItem(this.SESSION_KEY);
        }
      }
    } catch(e) {}
  },

  getSeedUsers() {
    return [
      {
        id: "usr_admin_1",
        email: "admin",
        password: "admin",
        name: "School Administrator",
        role: "admin",
        school: "Rizal National High School",
        section: "School Administration",
        status: "active",
        createdAt: "2026-06-01"
      },
      {
        id: "usr_teach_1",
        email: "teacher@basawisyo.ph",
        password: "teacher123",
        name: "Guro Juan dela Cruz",
        role: "teacher",
        school: "Rizal National High School",
        section: "Grade 8 - Emerald",
        shareCode: "BASA-TEACH-8492",
        status: "active",
        createdAt: "2026-06-15"
      },
      {
        id: "usr_stud_1",
        email: "student@basawisyo.ph",
        password: "student123",
        name: "Carlo Bautista",
        role: "student",
        school: "Rizal National High School",
        section: "Grade 8 - Emerald",
        teacherCode: "BASA-TEACH-8492",
        lvl: 1, // Instructional
        wpm: 115,
        comp: 75,
        wordsRead: 1420,
        status: "active",
        createdAt: "2026-07-02"
      },
      {
        id: "usr_stud_2",
        email: "ana@basawisyo.ph",
        password: "student123",
        name: "Ana Reyes",
        role: "student",
        school: "Rizal National High School",
        section: "Grade 8 - Emerald",
        teacherCode: "BASA-TEACH-8492",
        lvl: 0, // Frustration
        wpm: 82,
        comp: 52,
        wordsRead: 750,
        status: "active",
        createdAt: "2026-07-05"
      },
      {
        id: "usr_stud_3",
        email: "lito@basawisyo.ph",
        password: "student123",
        name: "Lito Manalo",
        role: "student",
        school: "Rizal National High School",
        section: "Grade 8 - Emerald",
        teacherCode: "BASA-TEACH-8492",
        lvl: 2, // Independent
        wpm: 142,
        comp: 88,
        wordsRead: 2890,
        status: "active",
        createdAt: "2026-07-08"
      },
      {
        id: "usr_stud_4",
        email: "mayumi@basawisyo.ph",
        password: "student123",
        name: "Mayumi Ramos",
        role: "student",
        school: "Rizal National High School",
        section: "Grade 8 - Emerald",
        teacherCode: "BASA-TEACH-8492",
        lvl: 3, // Mastery
        wpm: 168,
        comp: 96,
        wordsRead: 4120,
        status: "active",
        createdAt: "2026-07-10"
      },
      {
        id: "usr_stud_5",
        email: "pio@basawisyo.ph",
        password: "student123",
        name: "Pio Valenzuela",
        role: "student",
        school: "Rizal National High School",
        section: "Grade 8 - Emerald",
        teacherCode: "BASA-TEACH-8492",
        lvl: 1, // Instructional
        wpm: 108,
        comp: 70,
        wordsRead: 1100,
        status: "active",
        createdAt: "2026-07-12"
      }
    ];
  },

  getSeedAssignments() {
    return [
      {
        id: "asg_1",
        teacherCode: "BASA-TEACH-8492",
        passageId: "med_1",
        title: "The Coral Patrol",
        targetGroup: "all", // 'all', 'level-0', 'level-1', 'level-2', 'level-3'
        dueDate: "Tomorrow, 5:00 PM",
        note: "Read carefully and pay attention to cause-and-effect questions."
      },
      {
        id: "asg_2",
        teacherCode: "BASA-TEACH-8492",
        passageId: "easy_1",
        title: "A Fisher's Morning",
        targetGroup: "level-0", // Targeted intervention for Frustration group
        dueDate: "Friday",
        note: "Intervention practice: Focus on vocabulary using the 3-language taps."
      }
    ];
  },

  saveUsers() {
    try {
      if (Array.isArray(this.users)) {
        for (const u of this.users) {
          if (u && u.password && (!u.passwordHash || (u._lastHashed && u._lastHashed !== u.password))) {
            u.passwordHash = this.hashPassword(u.password);
            u._lastHashed = u.password;
          }
        }
      }
      localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users));
      if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.queue();
    } catch(e) {}
  },

  saveSession() {
    try {
      if (this.currentUser) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(this.SESSION_KEY);
      }
    } catch(e) {}
  },

  saveAssignments() {
    try {
      localStorage.setItem(this.ASSIGNMENTS_KEY, JSON.stringify(this.assignments));
      if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.queue();
    } catch(e) {}
  },

  saveGuestTokens() {
    try {
      localStorage.setItem(this.GUEST_TOKENS_KEY, JSON.stringify(this.guestTokens));
    } catch(e) {}
  },

  saveCustomPassages() {
    try {
      localStorage.setItem(this.CUSTOM_PASSAGES_KEY, JSON.stringify(this.customPassages));
      if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.queue();
    } catch(e) {}
  },

  persistPractices(next) {
    try {
      localStorage.setItem(this.CUSTOM_PASSAGES_KEY, JSON.stringify(next));
    } catch(e) {
      throw new Error("Practice could not be saved in this browser. Check storage and try again.");
    }
    this.customPassages = next;
    if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.queue();
  },

  // Auth Operations
  login(email, password) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const user = this.users.find(u => {
      const matchEmail = u.email.toLowerCase() === cleanEmail ||
        (u.role === "admin" && (cleanEmail === "admin" || cleanEmail === "admin@basawisyo.ph"));
      return matchEmail && this.verifyPassword(password, u);
    });
    if (!user) return { success: false, message: "Invalid email or password." };
    if (user.status === "suspended") return { success: false, message: "This account has been suspended by the administrator." };

    if (!user.passwordHash && password) {
      user.passwordHash = this.hashPassword(password);
      this.saveUsers();
    }

    GUEST_MODE = false;
    this.currentUser = user;
    this.saveSession();

    // Switch and load account-specific state
    if (typeof switchAccountState === "function") {
      switchAccountState(user);
    } else if (user.role === "student") {
      if (user.lvl !== undefined && user.lvl !== null) S.lvl = user.lvl;
      if (user.wordsRead) S.w = Math.max(S.w, user.wordsRead);
      save();
    }

    return { success: true, user };
  },

  register(data) {
    if (!data || !["student", "teacher"].includes(data.role)) {
      return { success: false, message: "Choose a student or teacher account. Admin accounts are assigned by the school admin." };
    }
    const cleanEmail = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const password = typeof data.password === "string" ? data.password : "";
    const section = typeof data.section === "string" ? data.section.trim() : "";
    const teacherCode = String(data.teacherCode || "").trim().toUpperCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || password.length < 6) {
      return { success: false, message: "Enter a name, valid email, and password of at least 6 characters." };
    }
    if (this.users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: "An account with this email already exists." };
    }
    if (data.role === "teacher" && !section) {
      return { success: false, message: "Enter the class section for your teacher account." };
    }
    const linkedTeacher = teacherCode
      ? this.users.find(user => user.role === "teacher" && user.status === "active" && user.shareCode === teacherCode)
      : null;
    if (data.role === "student" && teacherCode && !linkedTeacher) {
      return { success: false, message: "Teacher share code was not found. Check the code or leave it blank." };
    }

    let shareCode = null;
    if (data.role === "teacher") {
      const start = Math.floor(Math.random() * 9000);
      for (let offset = 0; offset < 9000; offset++) {
        const candidate = "BASA-TEACH-" + (1000 + (start + offset) % 9000);
        if (!this.users.some(user => user.shareCode === candidate)) {
          shareCode = candidate;
          break;
        }
      }
      if (!shareCode) return { success: false, message: "No classroom share codes are available right now." };
    }

    const idSeed = `usr_${Date.now()}`;
    let id = idSeed;
    for (let suffix = 1; this.users.some(user => user.id === id); suffix++) {
      id = `${idSeed}_${suffix}`;
    }
    const passwordHash = this.hashPassword(password);
    const newUser = {
      id,
      email: cleanEmail,
      password,
      passwordHash,
      name,
      role: data.role,
      school: data.school || "Rizal National High School",
      section: data.role === "teacher" ? section : linkedTeacher?.section || "",
      teacherCode: data.role === "student" ? teacherCode : "",
      shareCode,
      lvl: data.role === "student" && GUEST_MODE && S.placementReport ? S.lvl : null,
      wpm: null,
      comp: null,
      wordsRead: data.role === "student" ? (GUEST_MODE && S.placementReport ? (S.w || 0) : 0) : null,
      journey: data.role === "student"
        ? (GUEST_MODE && journeyValid(S.guestJourney)
          ? { baseTier: S.placementReport ? S.guestJourney.baseTier : 0,
              results: Object.fromEntries(Object.entries(S.guestJourney.results)
                .map(([id, result]) => [id, { ...result }])),
              skillEvidence: Object.fromEntries(Object.entries(S.guestJourney.skillEvidence || {})
                .map(([skill, keys]) => [skill, [...keys]])),
              frame: S.guestJourney.frame || "none", boardOptIn: false }
          : journeyEmpty()) : undefined,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0]
    };

    const nextUsers = [...this.users, newUser];
    try {
      localStorage.setItem(this.USERS_KEY, JSON.stringify(nextUsers));
    } catch(e) {
      return { success: false, message: "Account could not be saved in this browser. Check storage and try again." };
    }
    this.users = nextUsers;
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(newUser));
    } catch(e) {
      return { success: false, message: "Account created, but automatic sign-in failed. Please sign in from the login page." };
    }
    this.currentUser = newUser;
    if (typeof LOCAL_DATA !== "undefined") LOCAL_DATA.queue();
    if (typeof switchAccountState === "function") {
      if (data.role === "student" && GUEST_MODE) {
        const guestStateSnapshot = S.placementReport ? { ...S } : {
          ...S, lvl: null, l0: null, placementCandidate: false, placementVerified: false
        };
        const userKey = getStateStorageKey(newUser.id);
        try { localStorage.setItem(userKey, JSON.stringify(guestStateSnapshot)); } catch(e) {}
        switchAccountState(newUser);
        S.guestJourney = journeyEmpty();
        try { localStorage.setItem("basa_wisyo_state_guest", JSON.stringify(createInitialState())); } catch(e) {}
      } else {
        switchAccountState(newUser);
      }
    } else if (data.role === "student" && GUEST_MODE) {
      S.guestJourney = journeyEmpty();
      save();
    }
    GUEST_MODE = false;

    return { success: true, user: newUser };
  },

  logout() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      if (localStorage.getItem(this.SESSION_KEY) !== null) return false;
    } catch(e) {
      return false;
    }
    GUEST_MODE = false;
    this.currentUser = null;
    if (typeof ACTIVE_QUIZ !== "undefined") ACTIVE_QUIZ = null;
    if (typeof QUIZ_RESULT !== "undefined") QUIZ_RESULT = null;
    if (typeof CHAT_HISTORY !== "undefined") CHAT_HISTORY = [];
    if (typeof clearActiveQuizSnapshot === "function") clearActiveQuizSnapshot();
    if (typeof switchAccountState === "function") {
      switchAccountState(null);
    }
    return true;
  },

  // Premium Entitlements
  isPremium(user = this.currentUser) {
    if (typeof localStorage !== "undefined" && localStorage.getItem("basawisyo_sandbox_premium") === "true") {
      return true;
    }
    if (typeof S !== "undefined" && S?.simulatedPremium === true) return true;
    if (!user) return false;
    return user.isPremium === true || user.plan === "plus" || user.plan === "annual";
  },

  setPlan(plan = "plus", durationDays = 30) {
    if (!this.currentUser) return { success: false, message: "No active user session." };
    this.currentUser.plan = plan;
    this.currentUser.isPremium = plan !== "free";
    this.currentUser.premiumExpiresAt = plan !== "free" ? Date.now() + (durationDays * 86400000) : null;
    const idx = this.users.findIndex(u => u.id === this.currentUser.id);
    if (idx >= 0) this.users[idx] = { ...this.currentUser };
    this.saveUsers();
    this.saveSession();
    return { success: true, plan: this.currentUser.plan, isPremium: this.currentUser.isPremium };
  },

  toggleSandboxPremium() {
    let nextState = false;
    try {
      const curr = localStorage.getItem("basawisyo_sandbox_premium") === "true";
      nextState = !curr;
      localStorage.setItem("basawisyo_sandbox_premium", String(nextState));
    } catch (_) {}
    if (typeof S !== "undefined") S.simulatedPremium = nextState;
    if (this.currentUser) {
      this.currentUser.isPremium = nextState;
      this.currentUser.plan = nextState ? "plus" : "free";
    }
    return nextState;
  },

  // Authoritative Classroom Enrollment Resolver
  getActiveEnrollment(user = this.currentUser) {
    if (!user || user.role !== "student" || !user.teacherCode) return null;
    const teacher = this.users.find(u => u.role === "teacher" && u.status === "active" && u.shareCode === user.teacherCode);
    if (!teacher) return null;
    return {
      classroomId: teacher.shareCode,
      teacherId: teacher.id,
      teacherName: teacher.name,
      section: teacher.section || user.section || "Classroom",
      school: teacher.school || user.school || "Rizal National High School",
      status: "active"
    };
  },

  // Student Actions
  connectTeacher(teacherCode) {
    if (!this.currentUser) return { success: false, message: "Must be logged in." };
    const code = (teacherCode || "").trim().toUpperCase();
    const teacher = this.users.find(u => u.role === "teacher" && u.status === "active" && u.shareCode === code);
    if (!teacher) {
      return { success: false, message: `No active classroom found for code "${code}". Please check with your teacher.` };
    }

    this.currentUser.teacherCode = code;
    this.currentUser.section = teacher.section;
    const idx = this.users.findIndex(u => u.id === this.currentUser.id);
    if (idx >= 0) this.users[idx] = { ...this.currentUser };
    this.saveUsers();
    this.saveSession();

    return { success: true, teacherName: teacher.name, section: teacher.section };
  },

  // Teacher Actions
  getTeacherStudents(teacherCode) {
    const code = teacherCode || (this.currentUser && this.currentUser.shareCode);
    if (!code) return [];
    return this.users.filter(u => u.role === "student" && u.teacherCode === code);
  },

  createAssignment(passageId, title, targetGroup, dueDate, note) {
    if (!this.currentUser || this.currentUser.role !== "teacher") {
      throw new Error("Only a teacher can assign practices.");
    }
    if (!getPublishedPassageById(passageId)) {
      throw new Error("Only an approved published practice can be assigned.");
    }
    const newAsg = {
      id: "asg_" + Date.now(),
      teacherCode: this.currentUser.shareCode,
      passageId,
      title,
      targetGroup: targetGroup || "all",
      dueDate: dueDate || "Next Class",
      note: note || ""
    };
    const next = [newAsg, ...this.assignments];
    try {
      localStorage.setItem(this.ASSIGNMENTS_KEY, JSON.stringify(next));
    } catch(e) {
      throw new Error("Assignment could not be saved. Check browser storage and try again.");
    }
    this.assignments = next;
    return newAsg;
  },

  removeAssignment(id) {
    const actor = this.practiceActor();
    const assignment = this.assignments.find(item => item.id === id);
    if (!assignment) throw new Error("Assignment was not found.");
    if (actor.role === "teacher" && assignment.teacherCode !== actor.shareCode) {
      throw new Error("You can remove only your class assignments.");
    }
    const next = this.assignments.filter(item => item.id !== id);
    try {
      localStorage.setItem(this.ASSIGNMENTS_KEY, JSON.stringify(next));
    } catch(e) {
      throw new Error("Assignment could not be removed. Check browser storage and try again.");
    }
    this.assignments = next;
  },

  removePracticeAssignments(id) {
    const actor = this.practiceActor();
    if (actor.role !== "admin") throw new Error("Only an admin can remove all practice assignments.");
    const next = this.assignments.filter(item => item.passageId !== id);
    try {
      localStorage.setItem(this.ASSIGNMENTS_KEY, JSON.stringify(next));
    } catch(e) {
      throw new Error("Assignments could not be removed. Check browser storage and try again.");
    }
    const removed = this.assignments.length - next.length;
    this.assignments = next;
    return removed;
  },

  // Guest Token Mechanism
  createGuestToken(lvl, wpm, comp, studentName) {
    const token = "GUEST-" + Math.floor(1000 + Math.random() * 9000);
    this.guestTokens[token] = {
      name: studentName || "Guest Student",
      lvl: lvl !== undefined ? lvl : null,
      wpm: typeof wpm === "number" ? wpm : null,
      comp: typeof comp === "number" ? comp : null,
      timestamp: Date.now()
    };
    this.saveGuestTokens();
    return token;
  },

  importGuestToken(token, teacherCode) {
    const cleanToken = (token || "").trim().toUpperCase();
    const data = this.guestTokens[cleanToken];
    if (!data) return { success: false, message: `Token "${cleanToken}" not found or expired.` };

    // Create a temporary linked student record in this teacher's class
    const tempStudent = {
      id: "usr_guest_" + Date.now(),
      email: cleanToken.toLowerCase() + "@guest.basawisyo.ph",
      password: "guest",
      passwordHash: this.hashPassword("guest"),
      name: data.name + ` (${cleanToken})`,
      role: "student",
      school: "Rizal National High School",
      section: this.currentUser ? this.currentUser.section : "Connected Class",
      teacherCode: teacherCode || (this.currentUser ? this.currentUser.shareCode : ""),
      lvl: data.lvl,
      wpm: data.wpm ?? null,
      comp: data.comp ?? null,
      wordsRead: 0,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
      isGuestImport: true
    };

    this.users.push(tempStudent);
    this.saveUsers();
    delete this.guestTokens[cleanToken];
    this.saveGuestTokens();

    return { success: true, student: tempStudent };
  },

  // Admin Actions
  updateUserRole(userId, newRole) {
    const u = this.users.find(x => x.id === userId);
    if (!u) return;
    u.role = newRole;
    if (newRole === "teacher" && !u.shareCode) {
      u.shareCode = "BASA-TEACH-" + Math.floor(1000 + Math.random() * 9000);
    }
    this.saveUsers();
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser.role = newRole;
      this.saveSession();
    }
  },

  toggleUserStatus(userId) {
    const u = this.users.find(x => x.id === userId);
    if (!u) return;
    u.status = u.status === "active" ? "suspended" : "active";
    this.saveUsers();
  },

  resetUserPassword(userId, newPassword) {
    const u = this.users.find(x => x.id === userId);
    if (!u) return;
    u.password = newPassword || "123456";
    this.saveUsers();
  },

  deleteUser(userId) {
    this.users = this.users.filter(x => x.id !== userId);
    this.saveUsers();
  },

  practiceActor() {
    const actor = this.currentUser && this.users.find(user => user.id === this.currentUser.id);
    if (!actor || actor.status === "suspended" || !["teacher", "admin"].includes(actor.role)) {
      throw new Error("Only an active teacher or admin can manage practices.");
    }
    return actor;
  },

  savePractice(input, { id = null, submit = false } = {}) {
    const actor = this.practiceActor();
    const index = id === null ? -1 : this.customPassages.findIndex(passage => passage?.id === id);
    if (id !== null && index < 0) throw new Error("Practice was not found.");
    const previous = index < 0 ? null : normalizePassage(this.customPassages[index]);
    if (actor.role === "teacher" && previous) {
      if (previous.ownerId !== actor.id) throw new Error("You can edit only your own practices.");
      if (!["draft", "rejected"].includes(previous.status)) {
        throw new Error("Withdraw a pending practice before editing. Published practices are managed by the admin.");
      }
    }

    const now = new Date().toISOString();
    const status = actor.role === "teacher" ? (submit ? "pending" : "draft")
      : (previous?.status ?? "published");
    const passage = normalizePassage({
      ...input,
      id: previous?.id ?? `cust_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      status,
      ownerId: previous?.ownerId ?? actor.id,
      author: String(input.author || "").trim() || previous?.author || actor.name,
      createdAt: previous?.createdAt ?? now,
      submittedAt: status === "pending" && actor.role === "teacher" ? now : previous?.submittedAt,
      reviewedById: status === "pending" && actor.role === "teacher" ? null : previous?.reviewedById,
      reviewedAt: status === "pending" && actor.role === "teacher" ? null : previous?.reviewedAt,
      reviewNote: status === "pending" && actor.role === "teacher" ? null : previous?.reviewNote
    });
    if (!previous && (getPublishedPassages().some(existing => existing.id === passage.id)
        || this.customPassages.some(existing => existing?.id === passage.id))) {
      throw new Error("Practice ID already exists. Try saving again.");
    }
    const next = [...this.customPassages];
    if (index < 0) next.push(passage);
    else next[index] = passage;
    this.persistPractices(next);
    return passage;
  },

  reviewPractice(id, decision, note = "") {
    const actor = this.practiceActor();
    if (actor.role !== "admin") throw new Error("Only an admin can review practices.");
    if (!["approve", "reject"].includes(decision)) throw new Error("Choose approve or reject.");
    const index = this.customPassages.findIndex(passage => passage?.id === id);
    if (index < 0) throw new Error("Practice was not found.");
    const current = normalizePassage(this.customPassages[index]);
    if (current.status !== "pending") throw new Error("Only pending practices can be reviewed.");
    const cleanNote = String(note || "").trim();
    if (decision === "reject" && !cleanNote) throw new Error("Give the teacher a reason for rejection.");
    const reviewed = normalizePassage({
      ...current,
      status: decision === "approve" ? "published" : "rejected",
      reviewedById: actor.id,
      reviewedAt: new Date().toISOString(),
      reviewNote: cleanNote
    });
    const next = [...this.customPassages];
    next[index] = reviewed;
    this.persistPractices(next);
    return reviewed;
  },

  withdrawPractice(id) {
    const actor = this.practiceActor();
    if (actor.role !== "teacher") throw new Error("Only the author can withdraw a submission.");
    const index = this.customPassages.findIndex(passage => passage?.id === id);
    if (index < 0) throw new Error("Practice was not found.");
    const current = normalizePassage(this.customPassages[index]);
    if (current.ownerId !== actor.id || current.status !== "pending") {
      throw new Error("You can withdraw only your own pending practice.");
    }
    const next = [...this.customPassages];
    next[index] = normalizePassage({ ...current, status: "draft", submittedAt: null });
    this.persistPractices(next);
    return next[index];
  },

  setPracticePublished(id, published) {
    const actor = this.practiceActor();
    if (actor.role !== "admin") throw new Error("Only an admin can publish or unpublish practices.");
    const index = this.customPassages.findIndex(passage => passage?.id === id);
    if (index < 0) throw new Error("Practice was not found.");
    const current = normalizePassage(this.customPassages[index]);
    const owner = this.users.find(user => user.id === current.ownerId);
    if (published && (current.status !== "draft" || owner?.role === "teacher")) {
      throw new Error("Teacher practices must be submitted for approval before publication.");
    }
    if (!published && current.status !== "published") throw new Error("Only published practices can be unpublished.");
    if (!published && this.assignments.some(assignment => assignment.passageId === id)) {
      throw new Error("Remove this practice's class assignments before unpublishing it.");
    }
    const next = [...this.customPassages];
    next[index] = normalizePassage({ ...current, status: published ? "published" : "draft" });
    this.persistPractices(next);
    return next[index];
  },

  deletePractice(id) {
    const actor = this.practiceActor();
    const index = this.customPassages.findIndex(passage => passage?.id === id);
    if (index < 0) throw new Error("Practice was not found.");
    const current = this.customPassages[index];
    if (actor.role === "teacher" && (current.ownerId !== actor.id
        || !["draft", "rejected"].includes(current.status))) {
      throw new Error("You can delete only your own draft or rejected practice.");
    }
    if (this.assignments.some(assignment => assignment.passageId === id)) {
      throw new Error("This practice is assigned to a class. Remove its assignment before deleting it.");
    }
    this.persistPractices(this.customPassages.filter((_, position) => position !== index));
    return true;
  },

  addCustomPassage(p) {
    return this.savePractice(p);
  },

  deleteCustomPassage(id) {
    return this.deletePractice(id);
  }
};

function isUserPremium() {
  if (typeof localStorage !== "undefined" && localStorage.getItem("basawisyo_sandbox_premium") === "true") {
    return true;
  }
  if (typeof S !== "undefined" && S?.simulatedPremium === true) return true;
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  if (!user) return false;
  return user.isPremium === true || user.plan === "plus" || user.plan === "annual";
}




/* === src/services/state.js === */
/* ==========================================================================
   State Management & Persistence
   ========================================================================== */
function createInitialState() {
  return {
  lvl: null,          // 0: Frustration, 1: Instructional, 2: Independent, 3: Mastery
  w: 0,               // Cumulative words read
  ss: 0,              // Practice sessions completed
  done: [],           // Array of completed passage IDs
  guestJourney: { baseTier: 0, results: {}, skillEvidence: {}, frame: "none", boardOptIn: false }, // Guided practice for this browser's guest
  sk: {},             // Skill statistics: { [skillName]: [correctCount, totalCount] }
  sh: [],             // Imported or custom shared passages
  sub: 0,             // Demo parent subscription
  l0: null,           // Baseline starting level
  pay: 0,             // Tutoring session rate
  pm: 0,              // Tutoring sessions per month
  miss: null,         // Recent mistake info: { p, q, ch, ok, k, exp }
  theme: "light",     // 'light' or 'dark'
  fontScale: 1.0,     // 0.9, 1.0, 1.15, 1.3
  activeDiff: "all",  // 'all', 'easy', 'medium', 'hard', 'extreme'
  streak: 0,          // Daily practice streak
  lastPracticeDate: null, // ISO date string "YYYY-MM-DD" of last practice
  hearts: 5,          // Current hearts (max 5)
  maxHearts: 5,       // Maximum heart capacity
  lastHeartRegen: Date.now(), // Timestamp for regeneration countdown
  heartRegenMinutes: 20,      // 20 minutes per heart
  processedAnswerIds: [],     // Deduplication guard for answers
  heartAccommodations: false, // Accessibility/teacher override: unlimited hearts if true
    dailyQuest: null,           // Current active daily quest object
    questBonusXP: 0,            // Cumulative bonus XP from completed quests for guest
    attempts: [],               // Anti-farming and attempt audit history trail
    schemaVersion: 2            // Current schema version
  };
}

let ACTIVE_STATE_ACCOUNT_ID = null;

function getStateStorageKey(accountId = undefined) {
  if (accountId !== undefined) {
    return accountId ? `basa_wisyo_state_${accountId}` : "basa_wisyo_state_guest";
  }
  return ACTIVE_STATE_ACCOUNT_ID ? `basa_wisyo_state_${ACTIVE_STATE_ACCOUNT_ID}` : "basa_wisyo_state_guest";
}

function loadStateForAccount(accountId = null, seedUser = null) {
  let state = createInitialState();
  const key = getStateStorageKey(accountId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return { ...state, ...parsed, schemaVersion: 2 };
      } catch (jsonErr) {
        try { localStorage.setItem(`basa_wisyo_corrupted_${key}`, raw); } catch (_) {}
        console.warn(`Quarantined corrupted state for ${key}. Clean state initialized.`, jsonErr);
        return state;
      }
    }
    if (!accountId) {
      // Guest state: return clean initial state without pulling from prior student state
      return state;
    } else if (seedUser) {
      if (seedUser.lvl !== undefined && seedUser.lvl !== null) state.lvl = seedUser.lvl;
      if (seedUser.wordsRead) state.w = seedUser.wordsRead;
      state.done = [];
      state.ss = 0;
      state.attempts = [];
      state.sk = {};
    }
  } catch (e) {}
  return state;
}

function switchAccountState(targetUser = null) {
  // 1. Save current state under the outgoing account's key
  if (ACTIVE_STATE_ACCOUNT_ID) {
    try {
      localStorage.setItem(`basa_wisyo_state_${ACTIVE_STATE_ACCOUNT_ID}`, JSON.stringify(S));
    } catch (e) {}
  } else {
    try {
      localStorage.setItem("basa_wisyo_state_guest", JSON.stringify(S));
    } catch (e) {}
  }

  // 2. Set new active account ID
  const nextId = (targetUser && targetUser.role === "student") ? targetUser.id : null;
  ACTIVE_STATE_ACCOUNT_ID = nextId;

  // 3. Load target account state if student or guest
  if (nextId) {
    S = loadStateForAccount(nextId, targetUser);
    if (targetUser.lvl !== undefined && targetUser.lvl !== null && S.lvl === null) {
      S.lvl = targetUser.lvl;
    }
    if (targetUser.wordsRead && S.w === 0) {
      S.w = targetUser.wordsRead;
    }
  } else if (!targetUser) {
    S = loadStateForAccount(null);
  }

  // 4. Mirror active state to v2
  try {
    localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(S));
  } catch (e) {}

  return S;
}

function migrateAndLoadState() {
  let state = createInitialState();
  try {
    const v2 = localStorage.getItem("basa_wisyo_state_v2");
    if (v2) {
      try {
        const parsed = JSON.parse(v2);
        return { ...state, ...parsed, schemaVersion: 2 };
      } catch (jsonErr) {
        // Quarantine corrupted state to backup key and reset cleanly
        try { localStorage.setItem("basa_wisyo_corrupted_backup", v2); } catch (_) {}
        console.warn("Recovered from corrupted state JSON. Clean state initialized.", jsonErr);
        return state;
      }
    }
    const legacy = localStorage.getItem("basa_wisyo_state_v1") || localStorage.getItem("basa_state");
    if (legacy) {
      try {
        const parsedLegacy = JSON.parse(legacy);
        state = {
          ...state,
          lvl: parsedLegacy.lvl ?? null,
          w: parsedLegacy.w ?? 0,
          ss: parsedLegacy.ss ?? 0,
          done: Array.isArray(parsedLegacy.done) ? parsedLegacy.done : [],
          sk: parsedLegacy.sk && typeof parsedLegacy.sk === "object" ? parsedLegacy.sk : {},
          streak: parsedLegacy.streak ?? 0,
          lastPracticeDate: parsedLegacy.lastPracticeDate ?? null,
          schemaVersion: 2
        };
        localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(state));
        return state;
      } catch (_) {
        return state;
      }
    }
  } catch (e) {
    // Return initial state if storage reading fails
  }
  return state;
}

let S = migrateAndLoadState();

let STORAGE_STATE = {
  status: "saved", // 'saved', 'saving', 'failed'
  error: null,
  lastSavedAt: Date.now()
};

function getStorageStatus() {
  return { ...STORAGE_STATE };
}

const save = () => {
  STORAGE_STATE.status = "saving";
  try {
    const raw = JSON.stringify(S);
    localStorage.setItem("basa_wisyo_state_v2", raw);
    const userKey = getStateStorageKey();
    localStorage.setItem(userKey, raw);
    STORAGE_STATE.status = "saved";
    STORAGE_STATE.error = null;
    STORAGE_STATE.lastSavedAt = Date.now();
    if (typeof LOCAL_DATA !== "undefined" && typeof LOCAL_DATA.queue === "function") LOCAL_DATA.queue();
    return { success: true };
  } catch(e) {
    STORAGE_STATE.status = "failed";
    STORAGE_STATE.error = e?.message || "Storage quota exceeded or storage unavailable.";
    return { success: false, error: STORAGE_STATE.error };
  }
};

const retrySave = () => save();

// Global App State
let CURRENT_TAB = "home";
let GUEST_MODE = false;
let ACTIVE_QUIZ = null;
let SEARCH_QUERY = "";
let BOARD_TIER = null;





/* === src/services/hearts.js === */
/* ==========================================================================
   BasaWisyo Heart System (Per-Quiz Life Cycle)
   - Each quiz receives hearts equal to the number of questions in that quiz.
   - Each wrong answer deducts 1 heart from the active quiz.
   - Running out of hearts (0 hearts) triggers a friendly "Out of Hearts" screen.
   - Students can retry immediately with fresh hearts—no 20-minute waiting lock!
   - Diagnostic placement quizzes are exempt from heart-based failure.
   ========================================================================== */

function initQuizHearts(questionCount = 4) {
  const max = Math.max(1, questionCount);
  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  const accommodated = (typeof S !== "undefined" && S.heartAccommodations === true) || isPrem;
  return {
    hearts: max,
    maxHearts: max,
    accommodated
  };
}

function canStartPracticeQuiz() {
  // Practice quizzes can always be started; hearts are scoped per quiz attempt.
  return true;
}

function deductQuizHeart(quiz, answerId = null) {
  if (!quiz) return { success: false, hearts: 0, maxHearts: 0, deducted: false };
  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  if (quiz.accommodated || isPrem || (typeof S !== "undefined" && S.heartAccommodations === true)) {
    return { success: true, hearts: quiz.hearts, maxHearts: quiz.maxHearts, deducted: false, accommodated: true, isPremium: isPrem };
  }

  // Guard against duplicate deduction on same question attempt
  if (answerId) {
    if (!Array.isArray(quiz.processedAnswerIds)) quiz.processedAnswerIds = [];
    if (quiz.processedAnswerIds.includes(answerId)) {
      return { success: true, hearts: quiz.hearts, maxHearts: quiz.maxHearts, deducted: false, duplicate: true };
    }
    quiz.processedAnswerIds.push(answerId);
  }

  if (typeof quiz.hearts !== "number") {
    quiz.hearts = quiz.maxHearts || (quiz.steps ? quiz.steps.length : 4);
    quiz.maxHearts = quiz.hearts;
  }

  if (quiz.hearts > 0) {
    quiz.hearts = Math.max(0, quiz.hearts - 1);
    return {
      success: true,
      hearts: quiz.hearts,
      maxHearts: quiz.maxHearts,
      deducted: true,
      isZero: quiz.hearts === 0
    };
  }

  return {
    success: false,
    hearts: 0,
    maxHearts: quiz.maxHearts,
    deducted: false,
    isZero: true
  };
}

// Global legacy support / helper
function deductPracticeHeart(answerId = null) {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) {
    return deductQuizHeart(ACTIVE_QUIZ, answerId);
  }
  return { success: true, hearts: 5, deducted: false };
}

function syncHearts() {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ && typeof ACTIVE_QUIZ.hearts === "number") {
    return {
      hearts: ACTIVE_QUIZ.hearts,
      maxHearts: ACTIVE_QUIZ.maxHearts,
      canPractice: true
    };
  }
  return {
    hearts: 5,
    maxHearts: 5,
    canPractice: true
  };
}

function restoreHearts(count = 1) {
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) {
    ACTIVE_QUIZ.hearts = Math.min(ACTIVE_QUIZ.maxHearts, (ACTIVE_QUIZ.hearts || 0) + count);
    return { hearts: ACTIVE_QUIZ.hearts, maxHearts: ACTIVE_QUIZ.maxHearts };
  }
  return { hearts: 5, maxHearts: 5 };
}

function renderHeartPill() {
  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  if (isPrem) {
    return `
      <div class="heart-pill heart-premium" data-a="heart-info" title="Wisyo Plus: Unlimited Practice Hearts! ❤️" role="status" aria-label="Unlimited hearts in practice">
        <span class="heart-icon" aria-hidden="true">❤️</span>
        <span class="heart-count">∞ Unlimited</span>
        <span class="heart-crown" aria-hidden="true" style="font-size:0.75rem;margin-left:2px">👑</span>
      </div>
    `;
  }
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ && typeof ACTIVE_QUIZ.hearts === "number") {
    const hearts = ACTIVE_QUIZ.hearts;
    const max = ACTIVE_QUIZ.maxHearts;
    return `
      <div class="heart-pill ${hearts === 0 ? 'heart-empty' : ''}" data-a="heart-info" title="Quiz Hearts: ${hearts}/${max} (Tap for unlimited)" role="status" aria-label="${hearts} of ${max} hearts remaining in this quiz">
        <span class="heart-icon" aria-hidden="true">${hearts > 0 ? "❤️" : "💔"}</span>
        <span class="heart-count">${hearts}/${max}</span>
      </div>
    `;
  }
  return `
    <div class="heart-pill" data-a="heart-info" title="Hearts reset fresh for each quiz!" role="status" aria-label="Hearts are per-quiz">
      <span class="heart-icon" aria-hidden="true">❤️</span>
      <span class="heart-count">Per-Quiz</span>
    </div>
  `;
}

function renderOutOfHeartsModalHTML(passage) {
  const passageId = passage?.id || "";
  return `
    <div id="zero-hearts-modal" class="app-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="zero-hearts-title">
      <div class="app-modal-card" style="max-width:440px;text-align:center;padding:28px 24px">
        <div style="font-size:3.2rem;margin-bottom:8px">💔</div>
        <h3 id="zero-hearts-title" style="margin:0 0 8px">Out of Hearts!</h3>
        <p class="sub" style="margin-bottom:14px">You ran out of hearts for this story quiz. Don't worry, every mistake is a chance to learn!</p>

        <div class="card" style="background:var(--bg);text-align:left;padding:14px 18px;margin-bottom:20px;border-left:4px solid var(--sky)">
          <b style="color:var(--navy);display:block;margin-bottom:4px">Your learning never stops:</b>
          <div class="sub-sm" style="line-height:1.6">
            ✓ You can <b>try again immediately</b> with fresh hearts.<br>
            ✓ You can <b>review your answers</b> or ask Wisyo Tutor for guidance.<br>
            ✓ No waiting timers and no XP penalties!
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn blue" data-a="out-of-hearts-retry" data-v="${escapeHTML(passageId)}" style="width:100%">
            ${uiIcon("refresh")} Try Again with Fresh Hearts
          </button>
          <button class="btn gold-btn" data-a="upgrade-open" data-v="hearts" style="width:100%;font-weight:700">
            👑 Get Unlimited Hearts with Wisyo Plus
          </button>
          <button class="btn o" data-a="quiz-review" style="width:100%">
            ${uiIcon("check")} Review Answers
          </button>
          <button class="btn o" data-a="quiz-exit-to-library" style="width:100%">
            ${uiIcon("practice")} Choose Another Story
          </button>
        </div>
      </div>
    </div>
  `;
}


/* === src/services/rewards.js === */
/* ==========================================================================
   BasaWisyo Centralized Rewards Engine
   - 10 XP for story completion + 5 XP per correct answer + 10 XP first-time bonus.
   - Retries only award XP for personal best improvements (5 XP per improved score).
   - Idempotent: finalized once per unique attempt; replaying animations never grants double XP.
   - Distinct from Phil-IRI Reading Proficiency (XP reflects engagement, not reading tier).
   ========================================================================== */

function computeAttemptRewards({ passageId, score, total, isFirstCompletion, previousBest, isEligible = true }) {
  if (!isEligible) {
    return {
      xpGained: 0,
      isFirstCompletion: Boolean(isFirstCompletion),
      improvement: 0,
      previousBest: previousBest || 0,
      breakdown: { completion: 0, accuracy: 0, improvement: 0 }
    };
  }

  let xpGained = 0;
  let improvement = 0;

  if (isFirstCompletion) {
    // 10 XP base completion + (5 XP * score)
    const completionBase = 10;
    const accuracyXP = Math.max(0, score) * 5;
    xpGained = completionBase + accuracyXP;

    return {
      xpGained,
      isFirstCompletion: true,
      improvement: 0,
      previousBest: 0,
      breakdown: {
        completion: completionBase,
        accuracy: accuracyXP,
        improvement: 0
      }
    };
  }

  // Retry attempt: only reward improvement over previous personal best
  improvement = Math.max(0, score - (previousBest || 0));
  xpGained = improvement * 5;

  return {
    xpGained,
    isFirstCompletion: false,
    improvement,
    previousBest: previousBest || 0,
    breakdown: {
      completion: 0,
      accuracy: 0,
      improvement: xpGained
    }
  };
}


/* === src/services/quests.js === */
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


/* === src/services/bayanihan.js === */
/* ==========================================================================
   BasaWisyo Bayanihan Cooperative Reading Quest Service (bayanihan.js)
   - Real data-driven classroom cooperative reading quest.
   - Calculates class and individual contributions from verified reading sessions.
   - Prevents duplicate counting of reading sessions.
   - Manages weekly targets with archival history (never deletes prior periods).
   - Validates BasaMesh package schema with interactive preview before saving.
   ========================================================================== */

const BAYANIHAN_STORAGE_KEY = "basa_wisyo_bayanihan_quest_v2";
let PENDING_MESH_PACKAGE = null;

/**
 * Returns the ISO week identifier string (e.g. "2026-W46") for a given date.
 * @param {Date} date
 * @returns {string}
 */
function getBayanihanWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Loads or initializes the Bayanihan state, auto-rolling into a new weekly period
 * without deleting prior history.
 * @returns {Object}
 */
function getBayanihanQuest() {
  const currentWeek = getBayanihanWeekKey();
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(BAYANIHAN_STORAGE_KEY) || "null");
  } catch (e) {
    data = null;
  }

  if (!data || typeof data !== "object") {
    data = {
      targetWords: 10000,
      currentWeek,
      history: []
    };
    saveBayanihanQuest(data);
    return data;
  }

  if (data.currentWeek !== currentWeek) {
    // Week has advanced: roll current period into history without deleting records
    if (!Array.isArray(data.history)) data.history = [];
    const stats = calculateBayanihanStatsForPeriod(data);
    data.history.unshift({
      week: data.currentWeek,
      targetWords: data.targetWords || 10000,
      wordsRead: stats.classWords || 0,
      sessions: stats.studentSessions || 0,
      completed: (stats.classWords || 0) >= (data.targetWords || 10000)
    });
    // Keep last 12 weeks of historical archive
    if (data.history.length > 12) data.history = data.history.slice(0, 12);

    data.currentWeek = currentWeek;
    saveBayanihanQuest(data);
  }

  return data;
}

/**
 * Persists Bayanihan quest settings to localStorage.
 * @param {Object} quest
 */
function saveBayanihanQuest(quest) {
  try {
    localStorage.setItem(BAYANIHAN_STORAGE_KEY, JSON.stringify(quest));
  } catch (e) {
    /* LocalStorage failure fallback */
  }
}

/**
 * Allows teacher to set the weekly collective word-reading target.
 * @param {number} targetWords
 * @returns {boolean}
 */
function setBayanihanTarget(targetWords) {
  const num = parseInt(targetWords, 10);
  if (isNaN(num) || num < 500 || num > 500000) {
    throw new Error("Weekly target must be a positive number between 500 and 500,000 words.");
  }
  const quest = getBayanihanQuest();
  quest.targetWords = num;
  saveBayanihanQuest(quest);
  return true;
}

/**
 * Internal helper to compute stats for a specific period.
 * @param {Object} quest
 * @returns {Object}
 */
function calculateBayanihanStatsForPeriod(quest = getBayanihanQuest()) {
  const user = typeof AUTH !== "undefined" ? AUTH.currentUser : null;
  const isTeacher = user && user.role === "teacher";
  const isStudent = user && user.role === "student";
  const enrollment = isStudent && typeof AUTH !== "undefined" && typeof AUTH.getActiveEnrollment === "function"
    ? AUTH.getActiveEnrollment(user)
    : null;

  // Unenrolled students and guests cannot participate in classroom quest
  if (!user || (isStudent && !enrollment)) {
    return {
      targetWords: quest.targetWords || 10000,
      classWords: 0,
      studentWords: 0,
      studentSessions: 0,
      linkedStudentsCount: 0,
      pct: 0,
      isGoalReached: false,
      currentWeek: quest.currentWeek,
      history: quest.history || [],
      isEnrolled: false
    };
  }

  // Gather verified reading attempts from S.attempts
  const attempts = (typeof S !== "undefined" && Array.isArray(S.attempts)) ? S.attempts : [];

  // Filter attempts belonging to current week
  const weekAttempts = attempts.filter(att => {
    if (!att || !att.t) return false;
    return getBayanihanWeekKey(new Date(att.t)) === quest.currentWeek;
  });

  // Calculate unique student contribution
  const studentWords = weekAttempts.reduce((sum, att) => sum + (att.w || 0), 0)
    || (typeof S !== "undefined" ? Math.min(S.w || 0, 5000) : 0);
  const studentSessions = weekAttempts.length
    || (typeof S !== "undefined" ? (S.ss || 0) : 0);

  // Compute classroom total from actual linked student records
  let classWords = studentWords;
  let linkedStudentsCount = 1;

  if (isTeacher) {
    const students = typeof AUTH.getTeacherStudents === "function"
      ? AUTH.getTeacherStudents(user.shareCode)
      : [];
    linkedStudentsCount = Math.max(1, students.length);
    classWords = students.reduce((sum, st) => sum + (st.wordsRead || 0), 0);
    if (studentWords > 0 && classWords === 0) classWords = studentWords;
  } else if (isStudent && enrollment) {
    // If student is linked to a teacher, sum words from classmates in this section
    const classmates = (typeof AUTH !== "undefined" && Array.isArray(AUTH.users))
      ? AUTH.users.filter(u => u.role === "student" && u.teacherCode === enrollment.classroomId)
      : [];
    if (classmates.length > 0) {
      linkedStudentsCount = classmates.length;
      classWords = classmates.reduce((sum, st) => sum + (st.wordsRead || 0), 0);
    }
  }

  // Ensure classWords includes studentWords
  if (studentWords > classWords) {
    classWords = studentWords;
  }

  const targetWords = quest.targetWords || 10000;
  const pct = Math.min(100, Math.round((classWords / targetWords) * 100));

  return {
    targetWords,
    classWords,
    studentWords,
    studentSessions,
    linkedStudentsCount,
    pct,
    isGoalReached: classWords >= targetWords,
    currentWeek: quest.currentWeek,
    history: quest.history || [],
    isEnrolled: true
  };
}

/**
 * Public accessor for real-time Bayanihan calculations.
 * @returns {Object}
 */
function getBayanihanStats() {
  const quest = getBayanihanQuest();
  return calculateBayanihanStatsForPeriod(quest);
}

/**
 * Validates a BasaMesh code and returns the parsed reading package.
 * Throws clear error messages on malformed, corrupted, or invalid packages.
 * @param {string} rawInput
 * @returns {Object}
 */
function validateBasaMeshPackage(rawInput) {
  if (!rawInput || typeof rawInput !== "string" || !rawInput.trim()) {
    throw new Error("Please enter or paste a valid BasaMesh share code.");
  }

  let jsonStr = "";
  try {
    const clean = rawInput.trim();
    if (typeof atob === "function") {
      try {
        jsonStr = decodeURIComponent(escape(atob(clean)));
      } catch (e) {
        jsonStr = atob(clean);
      }
    } else if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(clean, "base64").toString("utf-8");
    } else {
      throw new Error("Base64 not supported");
    }
  } catch (e) {
    throw new Error("Invalid BasaMesh format. The share code appears corrupted or improperly copied.");
  }

  let pkg = null;
  try {
    pkg = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error("Could not parse BasaMesh content. Please verify the code and try again.");
  }

  if (!pkg || typeof pkg !== "object") {
    throw new Error("Invalid package data structure.");
  }

  const title = (pkg.t || pkg.title || "").trim();
  const text = (pkg.x || pkg.text || "").trim();
  const diff = (pkg.diff || "medium").toLowerCase();

  if (!title) {
    throw new Error("Package is missing a story title.");
  }

  if (!text || text.split(/\s+/).filter(Boolean).length < 10) {
    throw new Error("The reading passage is too short to import (minimum 10 words required).");
  }

  const validDiffs = ["easy", "medium", "hard", "extreme"];
  const finalDiff = validDiffs.includes(diff) ? diff : "medium";

  // Normalize questions if provided
  const rawQs = Array.isArray(pkg.qs) ? pkg.qs : (Array.isArray(pkg.questions) ? pkg.questions : []);
  const validQs = rawQs.filter(q => q && typeof q.q === "string" && Array.isArray(q.o) && q.o.length >= 2);

  return {
    id: `mesh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    t: title,
    title,
    x: text,
    text,
    diff: finalDiff,
    qs: validQs.length > 0 ? validQs : [
      {
        q: `What is the main topic of "${title}"?`,
        o: ["The narrative described in the passage", "A completely unrelated matter", "An event not mentioned in the story", "None of the above"],
        a: 0,
        k: "Main idea"
      }
    ],
    author: (pkg.author || "Classmate via BasaMesh").slice(0, 100),
    importedAt: Date.now()
  };
}

/**
 * Checks whether an imported passage already exists in customPassages or built-in library.
 * @param {string} title
 * @returns {boolean}
 */
function isDuplicatePassage(title) {
  const cleanTitle = (title || "").trim().toLowerCase();
  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.customPassages)) {
    if (AUTH.customPassages.some(p => (p.t || p.title || "").trim().toLowerCase() === cleanTitle)) {
      return true;
    }
  }
  if (typeof getPublishedPassages === "function") {
    if (getPublishedPassages().some(p => (p.t || "").trim().toLowerCase() === cleanTitle)) {
      return true;
    }
  }
  return false;
}


/* === src/services/review.js === */
/* ==========================================================================
   BasaWisyo - Smart Review & Spaced Repetition Service (review.js)
   Schedules practice mistakes for review using spaced repetition.
   Zero-heart safe zone: Mistakes in review mode do not deduct hearts.
   ========================================================================== */

const REVIEW_STORAGE_KEY = "basawisyo_review_v1";

// Spaced repetition intervals in days:
// Level 0 (Incorrect): 1 day
// Level 1 (Good): 3 days
// Level 2 (Sustained): 7 days
// Level 3+ (Mastered): 14 days
const REVIEW_INTERVALS = [1, 3, 7, 14];

function getReviewStorageKey(studentId) {
  const currentId = studentId || (typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest");
  return `${REVIEW_STORAGE_KEY}_${currentId}`;
}

function getReviewQueue(studentId) {
  const key = getReviewStorageKey(studentId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read review queue:", e);
    return [];
  }
}

function saveReviewQueue(queue, studentId) {
  const key = getReviewStorageKey(studentId);
  try {
    localStorage.setItem(key, JSON.stringify(queue));
    return true;
  } catch (e) {
    console.error("Failed to save review queue:", e);
    return false;
  }
}

/**
 * Schedules or updates a question in the review queue based on learner outcome.
 * @param {Object} param0 
 */
function scheduleQuestionReview({
  questionId,
  passageId,
  passageTitle,
  passageExcerpt,
  qIndex,
  questionText,
  options,
  correctAnswer,
  explanation,
  skill,
  outcome = "incorrect",
  studentId
}) {
  if (!questionId) return null;
  const queue = getReviewQueue(studentId);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const existingIndex = queue.findIndex(item => item.questionId === questionId);
  let item = existingIndex >= 0 ? queue[existingIndex] : null;

  if (!item) {
    // New item entering review queue
    const isCorrect = outcome === "correct";
    const consecutive = isCorrect ? 1 : 0;
    const intervalDays = isCorrect ? REVIEW_INTERVALS[1] : REVIEW_INTERVALS[0];
    const dueAt = now + (intervalDays * ONE_DAY_MS);

    item = {
      questionId,
      passageId: passageId || "",
      passageTitle: passageTitle || "Reading Practice",
      passageExcerpt: passageExcerpt || "",
      qIndex: Number.isInteger(qIndex) ? qIndex : 0,
      questionText: questionText || "",
      options: Array.isArray(options) ? options : [],
      correctAnswer: Number.isInteger(correctAnswer) ? correctAnswer : 0,
      explanation: explanation || "",
      skill: skill || "General",
      dueAt,
      intervalDays,
      consecutiveCorrect: consecutive,
      reviewCount: 1,
      lastResult: outcome,
      lastReviewedAt: now,
      createdAt: now
    };
    queue.push(item);
  } else {
    // Existing item updated
    item.reviewCount = (item.reviewCount || 0) + 1;
    item.lastReviewedAt = now;
    item.lastResult = outcome;

    if (outcome === "correct") {
      item.consecutiveCorrect = (item.consecutiveCorrect || 0) + 1;
      const intervalIdx = Math.min(item.consecutiveCorrect, REVIEW_INTERVALS.length - 1);
      item.intervalDays = REVIEW_INTERVALS[intervalIdx];
      item.dueAt = now + (item.intervalDays * ONE_DAY_MS);
    } else {
      // Mistake resets consecutive progress to 0 and interval to 1 day
      item.consecutiveCorrect = 0;
      item.intervalDays = REVIEW_INTERVALS[0];
      item.dueAt = now + (REVIEW_INTERVALS[0] * ONE_DAY_MS);
    }

    // Refresh question fields if provided
    if (passageTitle) item.passageTitle = passageTitle;
    if (passageExcerpt) item.passageExcerpt = passageExcerpt;
    if (questionText) item.questionText = questionText;
    if (options && options.length) item.options = options;
    if (Number.isInteger(correctAnswer)) item.correctAnswer = correctAnswer;
    if (explanation) item.explanation = explanation;
    if (skill) item.skill = skill;

    queue[existingIndex] = item;
  }

  saveReviewQueue(queue, studentId);
  return item;
}

/**
 * Returns review questions that are currently due.
 */
function getDueReviewQuestions(now = Date.now(), studentId) {
  const queue = getReviewQueue(studentId);
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return queue.filter(item => {
    const dueTime = typeof item.dueAt === "number" ? item.dueAt : new Date(item.dueAt).getTime();
    return dueTime <= currentTime;
  });
}

/**
 * Returns aggregate stats of review queue.
 */
function getReviewStats(studentId) {
  const queue = getReviewQueue(studentId);
  const now = Date.now();
  const due = queue.filter(item => {
    const dueTime = typeof item.dueAt === "number" ? item.dueAt : new Date(item.dueAt).getTime();
    return dueTime <= now;
  }).length;
  const mastered = queue.filter(item => (item.consecutiveCorrect || 0) >= 3).length;

  return {
    total: queue.length,
    due,
    mastered,
    inProgress: Math.max(0, queue.length - mastered)
  };
}

/**
 * Launches a smart review quiz session.
 * Review mode is a zero-heart safe zone.
 */
function startSmartReviewSession() {
  const dueItems = getDueReviewQuestions();
  const allItems = getReviewQueue();
  const itemsToReview = dueItems.length > 0 ? dueItems : allItems;

  if (!itemsToReview || itemsToReview.length === 0) {
    if (typeof showToast === "function") {
      showToast("No questions need review right now! Great job!", "ok");
    }
    return false;
  }

  // Shuffle or take up to 5 questions for a focused session
  const selected = itemsToReview.slice(0, 5);

  const steps = selected.map(item => ({
    P: {
      id: item.passageId || "review-passage",
      t: item.passageTitle || "Smart Review",
      x: item.passageExcerpt || "Reviewing previously missed reading comprehension concepts.",
      diff: "review"
    },
    q: {
      q: item.questionText,
      o: item.options,
      a: item.correctAnswer,
      k: item.skill,
      exp: item.explanation
    },
    questionId: item.questionId
  }));

  ACTIVE_QUIZ = {
    title: "Smart Review Session",
    mode: "review",
    steps,
    idx: 0,
    correctCount: 0,
    correctQuestions: [],
    userAnswers: new Array(steps.length).fill(null),
    startTime: Date.now(),
    isAnswered: false,
    selectedChoice: null,
    hearts: steps.length,
    maxHearts: steps.length,
    isSafeZone: true // Zero heart penalties
  };

  if (typeof renderApp === "function") {
    renderApp();
  }

  return true;
}


/* === src/services/flashcards.js === */
/* ==========================================================================
   BasaWisyo - Vocabulary Flashcards Service (flashcards.js)
   Spaced-repetition Leitner system for vocabulary mastery.
   Supports trilingual cards (English, Filipino, Bisaya) with audio pronunciation.
   ========================================================================== */

const FLASHCARDS_STORAGE_KEY = "basawisyo_flashcards_v1";

// High-impact starter vocabulary cards seeded from dictionary D
const STARTER_FLASHCARDS = [
  {
    word: "sampaguita",
    definition: "The national flower of the Philippines, known for sweet fragrance.",
    filipino: "sampaguita",
    bisaya: "sampagita",
    contextSentence: "The fragrant sampaguita garlands were hung around the honored guests."
  },
  {
    word: "biodiversity",
    definition: "The variety of plant and animal life in a particular habitat or ecosystem.",
    filipino: "biyodibersidad",
    bisaya: "kadaiyahan sa kinabuhi",
    contextSentence: "The coral atolls of Palawan support an extraordinary richness of marine biodiversity."
  },
  {
    word: "resilience",
    definition: "The capacity to recover quickly from difficulties, storms, or disasters.",
    filipino: "katatagan",
    bisaya: "kalig-on",
    contextSentence: "Filipino coastal families showed incredible resilience in rebuilding after the typhoon."
  },
  {
    word: "sanctuary",
    definition: "A protected nature reserve or safe haven where wildlife can thrive freely.",
    filipino: "santwaryo",
    bisaya: "dangpanan",
    contextSentence: "The marine sanctuary protects juvenile reef fish and giant clams from illegal nets."
  },
  {
    word: "ancestral",
    definition: "Pertaining to forebears, heritage, and sacred lands passed down through generations.",
    filipino: "ninuno",
    bisaya: "katigulangan",
    contextSentence: "Indigenous communities protect their ancestral domain from commercial logging."
  },
  {
    word: "monsoonal",
    definition: "Seasonal wind system bringing torrential rains and tropical moisture.",
    filipino: "hanging habagat",
    bisaya: "habagat",
    contextSentence: "Monsoonal rains replenished the dry highland rice paddies."
  },
  {
    word: "mangroves",
    definition: "Coastal shrubs that stabilize shorelines and serve as vital marine nurseries.",
    filipino: "bakawan",
    bisaya: "katunggan",
    contextSentence: "Dense mangroves shield the shoreline from fierce storm surges."
  },
  {
    word: "bamboo",
    definition: "Giant woody grass widely used in sustainable Philippine architecture and crafts.",
    filipino: "kawayan",
    bisaya: "kawayan",
    contextSentence: "The historic Las Piñas organ was masterfully crafted using seasoned bamboo pipes."
  }
];

function getFlashcardsStorageKey(studentId) {
  const currentId = studentId || (typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest");
  return `${FLASHCARDS_STORAGE_KEY}_${currentId}`;
}

/**
 * Returns student's flashcard deck. Seeds starter cards if deck is empty.
 */
function getFlashcardDeck(studentId) {
  const key = getFlashcardsStorageKey(studentId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Failed to read flashcards:", e);
  }

  // Seed default starter cards
  const now = Date.now();
  const seeded = STARTER_FLASHCARDS.map((card, idx) => ({
    id: `fc-${card.word.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    word: card.word,
    definition: card.definition,
    filipino: card.filipino,
    bisaya: card.bisaya,
    contextSentence: card.contextSentence,
    box: 1,
    intervalDays: 1,
    dueAt: now - (idx * 60000), // Stagger slightly so they appear due immediately
    reviewCount: 0,
    correctCount: 0,
    lastRating: null,
    lastReviewedAt: null,
    createdAt: now
  }));

  saveFlashcardDeck(seeded, studentId);
  return seeded;
}

function saveFlashcardDeck(deck, studentId) {
  const key = getFlashcardsStorageKey(studentId);
  try {
    localStorage.setItem(key, JSON.stringify(deck));
    return true;
  } catch (e) {
    console.error("Failed to save flashcards:", e);
    return false;
  }
}

/**
 * Saves or updates a word in the flashcard deck.
 */
function saveFlashcard({
  word,
  definition,
  contextSentence = "",
  filipino = "",
  bisaya = "",
  passageId = "",
  studentId
}) {
  if (!word || !word.trim()) return null;
  const cleanWord = word.trim();
  const id = `fc-${cleanWord.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
  const deck = getFlashcardDeck(studentId);
  const now = Date.now();

  const existingIdx = deck.findIndex(c => c.id === id || c.word.toLowerCase() === cleanWord.toLowerCase());

  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  const FREE_CARD_LIMIT = 30;
  if (!isPrem && existingIdx < 0 && deck.length >= FREE_CARD_LIMIT) {
    if (typeof openUpgradeModal === "function") {
      openUpgradeModal("flashcards", `You have reached the 30-card free deck capacity (${deck.length}/${FREE_CARD_LIMIT}). Upgrade to Wisyo Plus for unlimited flashcard storage!`);
    } else if (typeof showToast === "function") {
      showToast("Free flashcard limit (30) reached! Upgrade to Wisyo Plus for unlimited cards.", "warn");
    }
    return null;
  }

  let card;
  if (existingIdx >= 0) {
    card = deck[existingIdx];
    if (definition) card.definition = definition;
    if (contextSentence) card.contextSentence = contextSentence;
    if (filipino) card.filipino = filipino;
    if (bisaya) card.bisaya = bisaya;
    if (passageId) card.passageId = passageId;
    deck[existingIdx] = card;
  } else {
    // If translations not passed, look up in trilingual dictionary D
    let fil = filipino;
    let bis = bisaya;
    let def = definition;
    if (typeof D !== "undefined" && D[cleanWord.toLowerCase()]) {
      const entry = D[cleanWord.toLowerCase()];
      if (!fil) fil = entry[0];
      if (!bis) bis = entry[1];
      if (!def) def = entry[2];
    }

    card = {
      id,
      word: cleanWord,
      definition: def || "Definition to be added.",
      filipino: fil || "",
      bisaya: bis || "",
      contextSentence: contextSentence || "",
      passageId: passageId || "",
      box: 1,
      intervalDays: 1,
      dueAt: now,
      reviewCount: 0,
      correctCount: 0,
      lastRating: null,
      lastReviewedAt: null,
      createdAt: now
    };
    deck.unshift(card);
  }

  saveFlashcardDeck(deck, studentId);
  return card;
}

/**
 * Rates a flashcard during review using Leitner intervals:
 * - "difficult": Box 1, 1 day
 * - "good": +1 Box, 3 days (or 5 days if Box 2+)
 * - "easy": +2 Boxes, 7 days (or 14 days if Box 3+)
 */
function rateFlashcard(cardId, rating, studentId) {
  const deck = getFlashcardDeck(studentId);
  const card = deck.find(c => c.id === cardId);
  if (!card) return null;

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  card.reviewCount = (card.reviewCount || 0) + 1;
  card.lastReviewedAt = now;
  card.lastRating = rating;

  let intervalDays = 1;
  let nextBox = card.box || 1;

  if (rating === "difficult") {
    nextBox = 1;
    intervalDays = 1;
  } else if (rating === "good") {
    card.correctCount = (card.correctCount || 0) + 1;
    nextBox = Math.min(5, nextBox + 1);
    intervalDays = nextBox === 2 ? 3 : nextBox === 3 ? 5 : 7;
  } else if (rating === "easy") {
    card.correctCount = (card.correctCount || 0) + 1;
    nextBox = Math.min(5, nextBox + 2);
    intervalDays = nextBox >= 4 ? 14 : 7;
  }

  card.box = nextBox;
  card.intervalDays = intervalDays;
  card.dueAt = now + (intervalDays * ONE_DAY_MS);

  saveFlashcardDeck(deck, studentId);
  return card;
}

/**
 * Returns cards currently due for review.
 */
function getDueFlashcards(now = Date.now(), studentId) {
  const deck = getFlashcardDeck(studentId);
  const currentTime = typeof now === "number" ? now : new Date(now).getTime();
  return deck.filter(c => {
    const dueTime = typeof c.dueAt === "number" ? c.dueAt : new Date(c.dueAt).getTime();
    return dueTime <= currentTime;
  });
}

/**
 * Returns flashcard statistics.
 */
function getFlashcardStats(studentId) {
  const deck = getFlashcardDeck(studentId);
  const now = Date.now();
  const due = deck.filter(c => (c.dueAt || 0) <= now).length;
  const mastered = deck.filter(c => (c.box || 1) >= 4).length;

  return {
    total: deck.length,
    due,
    mastered,
    inProgress: Math.max(0, deck.length - mastered)
  };
}

/**
 * Deletes a flashcard from student's deck.
 */
function deleteFlashcard(cardId, studentId) {
  const deck = getFlashcardDeck(studentId);
  const filtered = deck.filter(c => c.id !== cardId);
  saveFlashcardDeck(filtered, studentId);
  return filtered;
}


/* === src/services/journey.js === */
/* Guided practice is separate from the four-question placement label and shared legacy stats. */
const JOURNEY_PASSAGES_TO_ADVANCE = 2;
const JOURNEY_TARGET_ACCURACY = 0.75;
const JOURNEY_BADGES = [
  { id: "first", icon: "📖", title: "First Story", description: "Finish your first qualifying reading practice." },
  { id: "perfect", icon: "✨", title: "Careful Reader", description: "Answer every question in a qualifying passage correctly." },
  { id: "comeback", icon: "🔁", title: "Comeback Reader", description: "Improve your best score when you retry a passage." },
  { id: "steady", icon: "🧭", title: "Story Explorer", description: "Finish three different qualifying passages." },
  { id: "literal", icon: "🔎", title: "Detail Detective", description: "Answer three different literal questions across two passages." },
  { id: "inference", icon: "💡", title: "Clue Finder", description: "Answer three different inference questions across two passages." }
];
const JOURNEY_FRAMES = [
  { id: "none", title: "Classic", badge: null },
  { id: "sky", title: "Sky Ring", badge: "first" },
  { id: "teal", title: "Growth Ring", badge: "comeback" },
  { id: "gold", title: "Explorer Ring", badge: "steady" }
];

function journeyStartingTier(level) {
  return level === 3 ? 2 : level === 2 ? 1 : 0;
}

function journeyEmpty(level = null) {
  return { baseTier: journeyStartingTier(level), results: {}, skillEvidence: {}, frame: "none", boardOptIn: false, bonusXP: 0 };
}

function journeyEvidenceValid(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).every(([skill, keys]) =>
      ["Literal", "Inference"].includes(skill) && Array.isArray(keys) && keys.length <= 500
      && keys.every(key => typeof key === "string" && /^[A-Za-z0-9_-]+:\d{1,2}$/.test(key))
      && new Set(keys).size === keys.length);
}

function journeyValid(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Number.isInteger(value.baseTier) && value.baseTier >= 0 && value.baseTier <= 2
    && value.results && typeof value.results === "object" && !Array.isArray(value.results)
    && Object.entries(value.results).every(([id, result]) =>
      /^[A-Za-z0-9_-]+$/.test(id) && result && typeof result === "object"
      && Number.isInteger(result.correct) && Number.isInteger(result.total)
      && Number.isInteger(result.attempts) && result.total > 0
      && result.correct >= 0 && result.correct <= result.total && result.attempts > 0
      && (result.improved === undefined || typeof result.improved === "boolean"))
    && (value.skillEvidence === undefined || journeyEvidenceValid(value.skillEvidence))
    && (value.frame === undefined || JOURNEY_FRAMES.some(frame => frame.id === value.frame))
    && (value.boardOptIn === undefined || typeof value.boardOptIn === "boolean")
    && (value.bonusXP === undefined || Number.isInteger(value.bonusXP));
}

function journeyForCurrent() {
  const user = AUTH.currentUser;
  if (user && user.role !== "student") return null;
  const stored = user ? user.journey : S.guestJourney;
  const journey = journeyValid(stored) ? stored : journeyEmpty();
  const suggestedTier = user ? journeyStartingTier(user.lvl) : 0;
  return { ...journey, baseTier: Math.max(journey.baseTier, suggestedTier),
    skillEvidence: journey.skillEvidence || {}, frame: journey.frame || "none",
    boardOptIn: journey.boardOptIn === true };
}

function journeyAchievements(journey) {
  const eligiblePassages = new Map(DIFF_KEYS.flatMap((_, tier) =>
    journeyEligiblePassages(tier).map(passage => [passage.id, passage])));
  const results = Object.entries(journey.results)
    .filter(([id, result]) => result.total === eligiblePassages.get(id)?.qs.length)
    .map(([, result]) => result);
  const skillHasEvidence = skill => {
    const keys = ((journey.skillEvidence || {})[skill] || [])
      .filter(key => {
        const [id, index] = key.split(":");
        return Number(index) < (eligiblePassages.get(id)?.qs.length || 0)
          && eligiblePassages.get(id).qs[Number(index)].k === skill;
      });
    return keys.length >= 3 && new Set(keys.map(key => key.split(":")[0])).size >= 2;
  };
  const earned = {
    first: results.length >= 1,
    perfect: results.some(result => result.total >= 2 && result.correct === result.total),
    comeback: results.some(result => result.improved === true),
    steady: results.length >= 3,
    literal: skillHasEvidence("Literal"),
    inference: skillHasEvidence("Inference")
  };
  return JOURNEY_BADGES.map(badge => ({ ...badge, earned: earned[badge.id] }));
}

function journeyAvailableFrames(journey) {
  const badges = new Set(journeyAchievements(journey).filter(badge => badge.earned).map(badge => badge.id));
  return JOURNEY_FRAMES.map(frame => ({ ...frame, unlocked: !frame.badge || badges.has(frame.badge) }));
}

function journeySelectedFrame() {
  const journey = journeyForCurrent();
  if (!journey) return "none";
  return journeyAvailableFrames(journey).some(frame => frame.id === journey.frame && frame.unlocked)
    ? journey.frame : "none";
}

function setJourneyFrame(frameId) {
  const journey = journeyForCurrent();
  if (!journey) throw new Error("Student or guest reading profile required.");
  if (!journeyAvailableFrames(journey).some(frame => frame.id === frameId && frame.unlocked)) {
    throw new Error("Earn the matching badge to use this frame.");
  }
  saveCurrentJourney({ ...journey, frame: frameId });
}

function journeyEligiblePassages(tier) {
  const builtInIds = new Set(Object.values(PRACTICE_DATA).flat().map(passage => passage.id));
  const approvedIds = new Set((AUTH.customPassages || [])
    .filter(passage => (passage.status ?? (passage.published === false ? "draft" : "published")) === "published")
    .map(passage => passage.id));
  return getPublishedPassages().filter(passage =>
    DIFF_KEYS.indexOf(passage.diff) === tier && passage.qs.length >= 2
    && (builtInIds.has(passage.id) || approvedIds.has(passage.id)));
}

function journeyTierProgress(journey, tier) {
  const scored = journeyEligiblePassages(tier).map(passage => ({
    result: journey.results[passage.id], questionCount: passage.qs.length
  })).filter(({ result, questionCount }) => result && result.total === questionCount
    && result.correct / result.total >= 0.5).map(({ result }) => result)
    .sort((a, b) => b.correct / b.total - a.correct / a.total)
    .slice(0, JOURNEY_PASSAGES_TO_ADVANCE);
  const correct = scored.reduce((sum, result) => sum + result.correct, 0);
  const total = scored.reduce((sum, result) => sum + result.total, 0);
  return {
    count: scored.length,
    accuracy: total ? correct / total : 0,
    ready: scored.length === JOURNEY_PASSAGES_TO_ADVANCE
      && correct / total >= JOURNEY_TARGET_ACCURACY
  };
}

function journeyUnlockedTier(journey, override = null) {
  let tier = Math.max(journey.baseTier, Number.isInteger(override) ? override : 0);
  while (tier < DIFF_KEYS.length - 1 && journeyTierProgress(journey, tier).ready) tier++;
  return tier;
}

function journeySummary() {
  const journey = journeyForCurrent();
  if (!journey) return null;
  const tier = journeyUnlockedTier(journey, AUTH.currentUser?.journeyOverride);
  const passages = journeyEligiblePassages(tier);
  const progress = journeyTierProgress(journey, tier);
  const unattempted = passages.find(passage => !journey.results[passage.id]);
  const attempted = passages.filter(passage => journey.results[passage.id]);
  const retry = attempted.filter(passage => {
    const result = journey.results[passage.id];
    return result.correct / result.total < JOURNEY_TARGET_ACCURACY;
  }).sort((a, b) => {
    const first = journey.results[a.id];
    const second = journey.results[b.id];
    return first.correct / first.total - second.correct / second.total;
  })[0];
  const next = (attempted.length < JOURNEY_PASSAGES_TO_ADVANCE ? unattempted : retry)
    || unattempted || retry || passages[0] || null;
  return { journey, tier, progress, next };
}

function journeyCanRead(passage) {
  if (!passage || !DIFF_KEYS.includes(passage.diff)) return false;
  if (AUTH.currentUser && AUTH.currentUser.role !== "student") return true;
  if (AUTH.currentUser?.role === "student" && (S.lvl === null || AUTH.currentUser.lvl === null)) {
    return false;
  }
  const summary = journeySummary();
  return summary ? DIFF_KEYS.indexOf(passage.diff) <= summary.tier : false;
}

function saveCurrentJourney(journey) {
  if (!journeyValid(journey)) throw new Error("Reading journey data is invalid.");
  const user = AUTH.currentUser;
  if (user?.role === "student") {
    const index = AUTH.users.findIndex(item => item.id === user.id);
    if (index < 0) throw new Error("Student account was not found.");
    const updated = { ...AUTH.users[index], journey };
    const users = [...AUTH.users];
    users[index] = updated;
    try { localStorage.setItem(AUTH.USERS_KEY, JSON.stringify(users)); }
    catch (error) { throw new Error("Reading progress could not be saved in this browser."); }
    AUTH.users = users;
    AUTH.currentUser = updated;
    AUTH.saveSession();
  } else if (!user) {
    const state = { ...S, guestJourney: journey };
    try { localStorage.setItem("basa_wisyo_state_v2", JSON.stringify(state)); }
    catch (error) { throw new Error("Guest reading progress could not be saved in this browser."); }
    S = state;
  }
}

function recordJourneyPlacement(level) {
  if (AUTH.currentUser && AUTH.currentUser.role !== "student") return;
  const journey = journeyForCurrent();
  const baseTier = Math.max(journey.baseTier, journeyStartingTier(level));
  if (baseTier !== journey.baseTier) saveCurrentJourney({ ...journey, baseTier });
}

function journeyStoryXP(result) {
  if (!result || typeof result !== "object") return 0;
  const attempts = Number.isInteger(result.attempts) ? result.attempts : 0;
  if (attempts <= 0) return 0;
  const correct = Number.isInteger(result.correct) ? Math.max(0, result.correct) : 0;
  return 10 + (correct * 5);
}

function journeyTotalXP(journey = journeyForCurrent()) {
  if (!journey || !journey.results) return 0;
  const eligibleIds = new Set(DIFF_KEYS.flatMap((_, tier) =>
    journeyEligiblePassages(tier).map(p => p.id)));
  const storyXP = Object.entries(journey.results).reduce((sum, [id, result]) => {
    if (!eligibleIds.has(id) || !result || (result.attempts || 0) <= 0) return sum;
    return sum + journeyStoryXP(result);
  }, 0);
  const bonusXP = Number.isInteger(journey.bonusXP)
    ? Math.max(0, journey.bonusXP)
    : Math.max(0, (typeof S !== "undefined" && S.questBonusXP) || 0);
  return storyXP + bonusXP;
}

const BADGE_WHY_REASONS = {
  first: "Earned by completing your first qualifying reading practice!",
  perfect: "Earned by answering every question correctly in a qualifying story!",
  comeback: "Earned by beating your personal best score on a retry!",
  steady: "Earned by finishing three different qualifying reading stories!",
  literal: "Earned by answering 3 literal questions using text evidence across 2 stories!",
  inference: "Earned by answering 3 inference questions using clues across 2 stories!"
};

function journeyBadgeRequirements(journey = journeyForCurrent()) {
  if (!journey) return [];
  const achievements = journeyAchievements(journey);
  const eligiblePassages = new Map(DIFF_KEYS.flatMap((_, tier) =>
    journeyEligiblePassages(tier).map(passage => [passage.id, passage])));
  const completedPassages = Object.entries(journey.results)
    .filter(([id, result]) => result.total === eligiblePassages.get(id)?.qs.length)
    .map(([id, result]) => ({ id, result, passage: eligiblePassages.get(id) }));

  const skillEvidenceCount = skill => {
    const keys = ((journey.skillEvidence || {})[skill] || [])
      .filter(key => {
        const [id, index] = key.split(":");
        return Number(index) < (eligiblePassages.get(id)?.qs.length || 0)
          && eligiblePassages.get(id).qs[Number(index)].k === skill;
      });
    const distinctStories = new Set(keys.map(key => key.split(":")[0])).size;
    return { count: keys.length, stories: distinctStories };
  };

  const literalStat = skillEvidenceCount("Literal");
  const inferenceStat = skillEvidenceCount("Inference");

  return achievements.map(badge => {
    let missingText = "";
    let progressLabel = "";
    if (badge.earned) {
      progressLabel = "Unlocked (Earned)";
      missingText = "Completed! Keep up the great reading.";
    } else {
      switch (badge.id) {
        case "first":
          progressLabel = "0 / 1 completed";
          missingText = "Needs 1 qualifying story completed in your reading tier.";
          break;
        case "perfect":
          progressLabel = "0 / 1 perfect score";
          missingText = "Needs a 100% correct score on any qualifying story (at least 2 questions).";
          break;
        case "comeback":
          progressLabel = "Retry & improve";
          missingText = "Needs a higher score on a retried passage to beat your previous best.";
          break;
        case "steady":
          progressLabel = `${completedPassages.length} / 3 completed`;
          missingText = `Needs ${Math.max(0, 3 - completedPassages.length)} more qualifying stories completed.`;
          break;
        case "literal":
          progressLabel = `${literalStat.count} / 3 answered (${literalStat.stories} / 2 stories)`;
          missingText = `Needs ${Math.max(0, 3 - literalStat.count)} more literal questions using text evidence across at least 2 stories.`;
          break;
        case "inference":
          progressLabel = `${inferenceStat.count} / 3 answered (${inferenceStat.stories} / 2 stories)`;
          missingText = `Needs ${Math.max(0, 3 - inferenceStat.count)} more inference questions using context clues across at least 2 stories.`;
          break;
        default:
          progressLabel = "Not yet started";
          missingText = badge.description;
      }
    }
    return {
      ...badge,
      progressLabel,
      missingText,
      whyReason: BADGE_WHY_REASONS[badge.id] || badge.description
    };
  });
}

function recordJourneyPractice(quiz) {
  if (quiz.mode !== "pr" || (AUTH.currentUser && AUTH.currentUser.role !== "student")) return;
  const passageId = quiz.steps[0]?.P.id;
  if (!passageId || quiz.steps.some(step => step.P.id !== passageId)) return;
  const journey = journeyForCurrent();
  const beforeTier = journeyUnlockedTier(journey, AUTH.currentUser?.journeyOverride);
  const beforeBadges = new Set(journeyAchievements(journey).filter(badge => badge.earned).map(badge => badge.id));
  const previous = journey.results[passageId];
  const total = quiz.steps.length;
  const previousBest = previous?.total === total ? previous.correct : 0;
  const isFirstCompletion = !previous || (previous.attempts || 0) === 0;
  const correct = previous?.total === total && previous.correct > quiz.correctCount
    ? previous.correct : quiz.correctCount;
  const results = { ...journey.results, [passageId]: {
    correct, total, attempts: (previous?.attempts || 0) + 1,
    improved: Boolean(previous?.improved || (previous?.total === total && quiz.correctCount > previous.correct))
  } };
  const skillEvidence = { ...journey.skillEvidence };
  const eligible = journeyEligiblePassages(DIFF_KEYS.indexOf(quiz.steps[0].P.diff))
    .some(passage => passage.id === passageId);
  if (eligible) {
    for (const answer of quiz.correctQuestions || []) {
      if (!["Literal", "Inference"].includes(answer.skill)
          || !Number.isInteger(answer.index) || answer.index < 0 || answer.index >= total) continue;
      if (quiz.steps[answer.index].q.k !== answer.skill) continue;
      const key = `${passageId}:${answer.index}`;
      const keys = skillEvidence[answer.skill] || [];
      if (!keys.includes(key) && keys.length < 500) skillEvidence[answer.skill] = [...keys, key];
    }
  }
  const updated = { ...journey, results, skillEvidence };
  saveCurrentJourney(updated);

  const afterTier = journeyUnlockedTier(updated, AUTH.currentUser?.journeyOverride);
  const tierLeveledUp = afterTier > beforeTier;

  const rewards = typeof computeAttemptRewards === "function"
    ? computeAttemptRewards({ passageId, score: quiz.correctCount, total, isFirstCompletion, previousBest, isEligible: eligible })
    : {
        xpGained: eligible ? (isFirstCompletion ? 10 + (quiz.correctCount * 5) : Math.max(0, quiz.correctCount - previousBest) * 5) : 0,
        improvement: isFirstCompletion ? 0 : Math.max(0, quiz.correctCount - previousBest),
        isFirstCompletion,
        previousBest
      };

  const xpGained = rewards.xpGained;
  const improvement = rewards.improvement;

  const allReqs = journeyBadgeRequirements(updated);
  const newBadges = allReqs.filter(badge => badge.earned && !beforeBadges.has(badge.id));

  return {
    newBadges,
    xpGained,
    totalXP: journeyTotalXP(updated),
    isFirstCompletion,
    improvement,
    previousBest,
    tierLeveledUp,
    beforeTier,
    afterTier,
    tierName: DIFF_NAMES[DIFF_KEYS[afterTier]] || `Tier ${afterTier + 1}`
  };
}

function setStudentJourneyOverride(studentId, tier) {
  const teacher = AUTH.currentUser;
  if (teacher?.role !== "teacher") throw new Error("Teacher account required.");
  const student = AUTH.users.find(user => user.id === studentId);
  if (!student || student.role !== "student" || student.teacherCode !== teacher.shareCode) {
    throw new Error("This student is not in your class.");
  }
  const value = tier === "" ? null : Number(tier);
  if (value !== null && (!Number.isInteger(value) || value < 0 || value >= DIFF_KEYS.length)) {
    throw new Error("Choose a valid reading tier.");
  }
  const users = AUTH.users.map(user => user.id === studentId
    ? { ...user, journeyOverride: value } : user);
  try { localStorage.setItem(AUTH.USERS_KEY, JSON.stringify(users)); }
  catch (error) { throw new Error("Teacher override could not be saved in this browser."); }
  AUTH.users = users;
}


/* === src/services/board.js === */
/* Local classroom board. Only opted-in students in the same teacher group appear. */
const READING_RANKS = [
  { min: 0, title: "New Reader" },
  { min: 1, title: "Story Starter" },
  { min: 3, title: "Story Explorer" },
  { min: 6, title: "Trailblazer" },
  { min: 10, title: "Reading Guide" }
];

function boardEligiblePassageMap(tier = null) {
  return new Map(DIFF_KEYS.flatMap((_, index) =>
    tier !== null && tier !== index ? []
      : journeyEligiblePassages(index).map(passage => [passage.id, passage.qs.length])));
}

function boardStoryCount(journey, tier = null) {
  if (!journeyValid(journey)) return 0;
  const eligible = boardEligiblePassageMap(tier);
  return Object.entries(journey.results)
    .filter(([id, result]) => eligible.get(id) === result.total).length;
}

function readingRank(journey) {
  const stories = boardStoryCount(journey);
  const current = [...READING_RANKS].reverse().find(rank => stories >= rank.min);
  const next = READING_RANKS.find(rank => rank.min > stories) || null;
  return { stories, title: current.title, next };
}

function classBoardContext() {
  const user = AUTH.currentUser;
  if (user?.role === "teacher" && user.shareCode) return { code: user.shareCode, role: "teacher" };
  if (user?.role !== "student") return null;
  const enrollment = typeof AUTH.getActiveEnrollment === "function"
    ? AUTH.getActiveEnrollment(user)
    : null;
  return enrollment ? { code: enrollment.classroomId, role: "student", ...enrollment } : null;
}

function boardAliasFor(user) {
  let hash = 0;
  for (const char of user.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `Reader ${String(hash % 9000 + 1000)}`;
}

function classBoardEntries(tier) {
  const context = classBoardContext();
  if (!context || !Number.isInteger(tier) || tier < 0 || tier >= DIFF_KEYS.length) return [];
  const entries = AUTH.users
    .filter(user => user.role === "student" && user.status === "active"
      && user.teacherCode === context.code && journeyValid(user.journey)
      && user.journey.boardOptIn === true)
    .map(user => ({ id: user.id, alias: boardAliasFor(user),
      stories: boardStoryCount(user.journey, tier), own: user.id === AUTH.currentUser.id }))
    .sort((left, right) => right.stories - left.stories || left.alias.localeCompare(right.alias));
  let place = 0;
  let previous = null;
  return entries.map(entry => {
    if (entry.stories !== previous) place++;
    previous = entry.stories;
    return { ...entry, place };
  });
}

function setClassBoardOptIn(enabled) {
  if (AUTH.currentUser?.role !== "student" || !classBoardContext()) {
    throw new Error("Join a teacher's class before using the Class Board.");
  }
  if (typeof enabled !== "boolean") throw new Error("Choose whether to join the Class Board.");
  saveCurrentJourney({ ...journeyForCurrent(), boardOptIn: enabled });
}


/* === src/services/rankings.js === */
/* ==========================================================================
   BasaWisyo - Class Board & Rankings Service (rankings.js)
   Manages classroom and year-level leaderboards, weekly XP calculations,
   ranking periods, and anonymous aliases.
   Prototype transparency: Clearly labeled as local browser demo data.
   ========================================================================== */

let CURRENT_BOARD_METRIC = "weeklyXP"; // "weeklyXP" (default) | "stories" | "allTimeXP"
let CURRENT_BOARD_SCOPE = "classroom";  // "classroom" (default) | "grade"

/**
 * Returns current ISO week ranking period (Monday to Sunday)
 */
function getRankingPeriod(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  // Calculate distance to previous Monday
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startStr = `${months[monday.getMonth()]} ${monday.getDate()}`;
  const endStr = `${months[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  const msRemaining = Math.max(0, sunday.getTime() - now);
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    label: `${startStr} – ${endStr}`,
    startMs: monday.getTime(),
    endMs: sunday.getTime(),
    daysRemaining,
    isPrototype: true
  };
}

/**
 * Calculates weekly XP for a given student.
 * If user has timestamped activity, filters by current week; otherwise computes active proportion.
 */
function getWeeklyXP(user, now = Date.now()) {
  if (!user) return 0;
  const period = getRankingPeriod(now);
  const journey = user.journey || (user.id === AUTH.currentUser?.id ? journeyForCurrent() : null);
  if (!journey) return 0;

  // If itemized XP history exists on user or journey, filter within current week
  if (Array.isArray(user.xpHistory) && user.xpHistory.length > 0) {
    return user.xpHistory
      .filter(item => item.timestamp >= period.startMs && item.timestamp <= period.endMs)
      .reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
  }

  // Baseline weekly XP: active quest bonus + story XP from current week
  const totalXP = typeof journeyTotalXP === "function" ? journeyTotalXP(journey) : 0;
  const questBonus = (journey.bonusXP || 0) + ((user.id === AUTH.currentUser?.id && S.questBonusXP) || 0);

  // In demo prototype environment, estimate weekly XP from recent active practice
  return Math.min(totalXP, Math.max(questBonus, Math.round(totalXP * 0.75)));
}

/**
 * Extracts year level (e.g. "Grade 7", "Grade 8") from user section or Phil-IRI level
 */
function getYearLevelForUser(user) {
  if (!user) return "Grade 8";
  const section = user.section || "";
  const match = section.match(/Grade\s*([0-9]{1,2})/i);
  if (match) return `Grade ${match[1]}`;

  // Fallback based on Phil-IRI reading tier
  const lvl = user.lvl ?? 1;
  const gradeMap = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  return gradeMap[lvl] || "Grade 8";
}

/**
 * Computes ranked entries with classroom/grade filters, weekly XP, aliases, and ties.
 * @param {Object} options
 */
function getClassroomRankings({
  metric = CURRENT_BOARD_METRIC,
  scope = CURRENT_BOARD_SCOPE,
  yearLevel = null,
  tier = null,
  now = Date.now()
} = {}) {
  const context = typeof classBoardContext === "function" ? classBoardContext() : null;
  const currentUser = AUTH.currentUser;

  if (!currentUser) return { entries: [], period: getRankingPeriod(now), isPrototype: true };

  const currentYearLevel = yearLevel || getYearLevelForUser(currentUser);
  const period = getRankingPeriod(now);

  // Eligible students: role === student, active status, valid journey, opted-in
  let students = (AUTH.users || []).filter(u =>
    u.role === "student" &&
    u.status === "active" &&
    (typeof journeyValid === "function" ? journeyValid(u.journey) : true) &&
    u.journey?.boardOptIn === true
  );

  // Apply scope filter
  if (scope === "classroom" && context?.code) {
    // Only same teacher / classroom code
    students = students.filter(u => u.teacherCode === context.code);
  } else if (scope === "grade") {
    // All sections in the same grade level
    students = students.filter(u => getYearLevelForUser(u) === currentYearLevel);
  }

  // Calculate scores per student
  const mapped = students.map(u => {
    const isOwn = u.id === currentUser.id;
    const journey = isOwn ? (typeof journeyForCurrent === "function" ? journeyForCurrent() : u.journey) : u.journey;
    const stories = typeof boardStoryCount === "function" ? boardStoryCount(journey, tier) : 0;
    const weeklyXP = getWeeklyXP(u, now);
    const allTimeXP = typeof journeyTotalXP === "function" ? journeyTotalXP(journey) : 0;
    const alias = typeof boardAliasFor === "function" ? boardAliasFor(u) : `Reader ${u.id.slice(-4)}`;
    const section = u.section || getYearLevelForUser(u);

    let score = weeklyXP;
    if (metric === "stories") score = stories;
    else if (metric === "allTimeXP") score = allTimeXP;

    return {
      id: u.id,
      alias,
      score,
      stories,
      weeklyXP,
      allTimeXP,
      section,
      own: isOwn
    };
  });

  // Sort descending by score, tie-break by alias
  mapped.sort((a, b) => b.score - a.score || a.alias.localeCompare(b.alias));

  // Assign ranking places (tied scores share the same place: 1, 2, 2, 4...)
  let currentRank = 1;
  const ranked = mapped.map((entry, index) => {
    if (index > 0 && entry.score < mapped[index - 1].score) {
      currentRank = index + 1;
    }
    return {
      ...entry,
      place: currentRank
    };
  });

  return {
    period,
    scope,
    metric,
    yearLevel: currentYearLevel,
    entries: ranked,
    totalStudents: ranked.length,
    isPrototype: true
  };
}


/* === src/services/mastery.js === */
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


/* === src/services/quiz.js === */
let QUIZ_RESULT = null;
let KARAOKE_ANIM_FRAME = null;
let KARAOKE_TIMEOUTS = [];

function clearKaraokeTimers() {
  if (KARAOKE_ANIM_FRAME && typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(KARAOKE_ANIM_FRAME);
    KARAOKE_ANIM_FRAME = null;
  }
  if (Array.isArray(KARAOKE_TIMEOUTS)) {
    KARAOKE_TIMEOUTS.forEach(id => clearTimeout(id));
    KARAOKE_TIMEOUTS = [];
  }
}

function skipQuizKaraoke() {
  clearKaraokeTimers();
  if (QUIZ_RESULT) {
    QUIZ_RESULT.karaokeDone = true;
    renderQuizResult();
  }
}

function quizRatingText(pct) {
  if (pct === 100) return "PERFECT! · OUTSTANDING!";
  if (pct >= 75) return "EXCELLENT! · GREAT JOB!";
  if (pct >= 50) return "GOOD JOB! · KEEP GOING!";
  return "KEEP PRACTICING! · PROGRESS!";
}

function quizWisyoCelebrationQuote(pct) {
  if (pct === 100) return "Outstanding! You got every answer right!";
  if (pct >= 75) return "Great job! You read with strong comprehension!";
  if (pct >= 50) return "Good effort! Keep reading to sharpen your skills!";
  return "Don't worry! Every mistake is a step forward in learning!";
}

function renderConfettiParticles() {
  const colors = ["#F5AB1D", "#2589E6", "#0D9488", "#E11D48", "#8B5CF6", "#F97316"];
  let html = "";
  for (let i = 0; i < 20; i++) {
    const left = (i * 5) + (i % 3);
    const delay = (i % 6) * 0.15;
    const dur = 1.8 + (i % 4) * 0.4;
    const bg = colors[i % colors.length];
    const size = 7 + (i % 3) * 3;
    html += `<span class="confetti-piece" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;background:${bg};width:${size}px;height:${size}px"></span>`;
  }
  return html;
}

function updateDailyStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (!S.lastPracticeDate) {
    S.streak = 1;
    S.lastPracticeDate = today;
  } else if (S.lastPracticeDate === today) {
    if (!S.streak) S.streak = 1;
  } else {
    const lastDate = new Date(S.lastPracticeDate + "T00:00:00Z");
    const currDate = new Date(today + "T00:00:00Z");
    const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / 86400000);
    if (diffDays === 1) {
      S.streak = (S.streak || 0) + 1;
      S.lastPracticeDate = today;
    } else if (diffDays > 1) {
      S.streak = 1;
      S.lastPracticeDate = today;
    }
  }
  save();
  return S.streak;
}

function runKaraokeCelebrationTicker(targetPct, score, total) {
  clearKaraokeTimers();
  if (typeof requestAnimationFrame === "undefined") return;

  const startTime = Date.now();
  const valEl = $("#karaoke-score-val");
  const ringEl = $("#karaoke-score-ring");
  const ratingEl = $("#karaoke-rating");
  const bubbleEl = $("#karaoke-wisyo-bubble");
  const confettiEl = $("#karaoke-confetti");

  if (!valEl || !ringEl) return;

  let locked = false;

  function tick() {
    const elapsed = Date.now() - startTime;

    if (elapsed < 1000) {
      valEl.textContent = "0%";
      if (bubbleEl) bubbleEl.textContent = "Checking your answers...";
      KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
    } else if (elapsed < 3200) {
      const progress = (elapsed - 1000) / 2200;
      const current = Math.min(targetPct, Math.round(targetPct * (1 - Math.pow(1 - progress, 2))));
      valEl.textContent = current + "%";
      if (bubbleEl) bubbleEl.textContent = "Calculating your score...";
      KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
    } else if (elapsed < 4200) {
      const progress = (elapsed - 3200) / 1000;
      const remaining = targetPct - Math.round(targetPct * 0.9);
      const current = Math.min(targetPct, Math.round(targetPct * 0.9) + Math.round(remaining * (1 - Math.pow(1 - progress, 3))));
      valEl.textContent = current + "%";
      ringEl.classList.add("suspense");
      if (bubbleEl) bubbleEl.textContent = "Almost ready with the results...";
      KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
    } else if (!locked) {
      locked = true;
      valEl.textContent = targetPct + "%";
      ringEl.classList.remove("suspense");
      ringEl.classList.add("locked");
      if (ratingEl) {
        ratingEl.textContent = quizRatingText(targetPct);
        ratingEl.classList.add("show");
      }
      if (bubbleEl) {
        bubbleEl.textContent = quizWisyoCelebrationQuote(targetPct);
      }

      const confettiTimer = setTimeout(() => {
        if (confettiEl) confettiEl.innerHTML = renderConfettiParticles();
      }, 700);
      KARAOKE_TIMEOUTS.push(confettiTimer);

      const doneTimer = setTimeout(() => {
        if (QUIZ_RESULT) QUIZ_RESULT.karaokeDone = true;
        const skipBtn = $(".karaoke-skip-btn");
        if (skipBtn) skipBtn.remove();
      }, 2300);
      KARAOKE_TIMEOUTS.push(doneTimer);
    }
  }

  KARAOKE_ANIM_FRAME = requestAnimationFrame(tick);
}

const QUIZ_SNAPSHOT_KEY = "basa_wisyo_interrupted_quiz";

function saveActiveQuizSnapshot() {
  const qz = ACTIVE_QUIZ;
  if (!qz || qz._isFinalized || !Array.isArray(qz.steps) || qz.steps.length === 0) {
    clearActiveQuizSnapshot();
    return;
  }
  try {
    const actorId = (typeof AUTH !== "undefined" && AUTH.currentUser?.id) || "guest";
    const snapshot = {
      actorId,
      title: qz.title,
      mode: qz.mode,
      idx: qz.idx,
      correctCount: qz.correctCount,
      correctQuestions: qz.correctQuestions || [],
      userAnswers: qz.userAnswers || [],
      stage: qz.stage,
      startTime: qz.startTime,
      hearts: qz.hearts,
      maxHearts: qz.maxHearts,
      accommodated: qz.accommodated,
      processedAnswerIds: qz.processedAnswerIds || [],
      steps: qz.steps,
      savedAt: Date.now()
    };
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(QUIZ_SNAPSHOT_KEY, JSON.stringify(snapshot));
    }
  } catch (err) {
    console.warn("Could not save quiz recovery snapshot:", err);
  }
}

function clearActiveQuizSnapshot() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(QUIZ_SNAPSHOT_KEY);
    }
  } catch (_) {}
}

function getInterruptedQuizSnapshot() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(QUIZ_SNAPSHOT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const actorId = (typeof AUTH !== "undefined" && AUTH.currentUser?.id) || "guest";
    if (data.actorId !== actorId) return null;
    if (!Array.isArray(data.steps) || data.steps.length === 0) return null;
    if (data.idx >= data.steps.length) return null;
    if (Date.now() - (data.savedAt || 0) > 24 * 60 * 60 * 1000) {
      clearActiveQuizSnapshot();
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

function resumeInterruptedQuiz() {
  const snapshot = getInterruptedQuizSnapshot();
  if (!snapshot) return false;
  ACTIVE_QUIZ = {
    title: snapshot.title,
    mode: snapshot.mode,
    steps: snapshot.steps,
    idx: snapshot.idx,
    correctCount: snapshot.correctCount || 0,
    correctQuestions: snapshot.correctQuestions || [],
    userAnswers: snapshot.userAnswers || [],
    stage: snapshot.stage || "question",
    isAnswered: false,
    selectedChoice: null,
    startTime: snapshot.startTime || Date.now(),
    hearts: snapshot.hearts,
    maxHearts: snapshot.maxHearts,
    accommodated: snapshot.accommodated,
    processedAnswerIds: snapshot.processedAnswerIds || []
  };
  QUIZ_RESULT = null;
  if (typeof renderApp === "function") renderApp();
  if (typeof focusQuizStage === "function") focusQuizStage();
  if (typeof showToast === "function") {
    showToast("Resumed your previous reading session!", "ok");
  }
  return true;
}

function startQuiz(passages, mode, title) {
  if (mode !== "pl" && AUTH.currentUser?.role === "student" && S.lvl === null) {
    CURRENT_TAB = "assess";
    renderApp();
    showToast("Complete your placement assessment before starting practice.", "warn");
    return;
  }
  clearKaraokeTimers();

  QUIZ_RESULT = null;
  const steps = [];
  passages.forEach(P => {
    P.qs.forEach(q => {
      steps.push({ P, q });
    });
  });

  if (mode === "pr" && typeof updateQuestProgress === "function") {
    updateQuestProgress("read", 1);
  }

  const heartsObj = typeof initQuizHearts === "function"
    ? initQuizHearts(steps.length)
    : { hearts: steps.length, maxHearts: steps.length };

  ACTIVE_QUIZ = {
    title,
    mode, // 'pl' for placement, 'pr' for practice
    steps,
    idx: 0,
    correctCount: 0,
    correctQuestions: [],
    userAnswers: [],
    stage: mode === "review" ? "question" : "passage",
    isAnswered: false,
    selectedChoice: null,
    startTime: Date.now(),
    hearts: heartsObj.hearts,
    maxHearts: heartsObj.maxHearts,
    accommodated: heartsObj.accommodated,
    processedAnswerIds: []
  };

  renderApp();
  focusQuizStage();
  saveActiveQuizSnapshot();
}

function renderQuiz() {
  stopSpeech();
  const qz = ACTIVE_QUIZ;
  const currentStep = qz.steps[qz.idx] || {};
  const P = currentStep.P || {};
  const q = currentStep.q || { o: [] };
  const progressPct = ((qz.idx) / qz.steps.length) * 100;
  const isPassageStage = qz.stage === "passage";
  const passageQuestionCount = qz.steps.filter(step => step.P.id === P.id).length;
  const questionLabel = `Question ${qz.idx + 1} of ${qz.steps.length}`;

  const isReview = qz.mode === "review";
  const isStudio = qz.mode === "studio";
  const diffBadge = P.diff ? `<span class="badge-diff diff-${P.diff}">${P.diff.toUpperCase()}</span>` : "";
  const heartPill = (isReview || isStudio)
    ? `<span class="pill ok" style="font-weight:600" title="Safe zone: mistakes never deduct hearts">${uiIcon("check")} ${isStudio ? "Studio Safe Zone (0 Hearts Lost)" : "Review Safe Zone (0 Hearts Lost)"}</span>`
    : (qz.mode === "pr" && typeof renderHeartPill === "function" ? renderHeartPill(true) : "");

  const v = $("#v");
  if (v) {
    v.innerHTML = `
    <div class="reader-flow ${isPassageStage ? "reader-flow-passage" : "reader-flow-question"}">
    <div class="reader-progress-head">
      <div>
        <div class="lab">${isPassageStage ? "Read the passage" : "Reading practice"}</div>
        <h2 tabindex="-1">${escapeHTML(qz.title)}</h2>
        <span class="sub-sm">${isPassageStage ? `Read first, then answer ${passageQuestionCount} ${passageQuestionCount === 1 ? "question" : "questions"}.` : questionLabel}</span>
      </div>
      <button class="btn sm o" data-a="quit-quiz">Exit Quiz</button>
    </div>
    <div class="bar reader-progress-bar" role="progressbar" aria-label="Question progress" aria-valuemin="0" aria-valuemax="${qz.steps.length}" aria-valuenow="${qz.idx}"><i style="width:${progressPct}%"></i></div>

    ${isPassageStage ? `
    <!-- Reader Toolbar -->
    <div class="reader-toolbar">
      <div class="reader-tools">
        ${diffBadge}
        ${heartPill}
        <button class="reader-speech-btn" data-a="speech-read" title="${SPEECH_PASSAGE_ACTIVE ? 'Stop audio' : 'Read passage aloud'}" aria-label="${SPEECH_PASSAGE_ACTIVE ? 'Stop audio' : 'Read passage aloud'}" aria-pressed="${Boolean(SPEECH_PASSAGE_ACTIVE)}">${uiIcon(SPEECH_PASSAGE_ACTIVE ? "stop" : "sound")} ${SPEECH_PASSAGE_ACTIVE ? "Stop audio" : "Read aloud"}</button>
        <button class="reader-speech-btn secondary" data-a="${typeof isSpeechPaused === 'function' && isSpeechPaused() ? 'speech-resume' : 'speech-pause'}" title="${typeof isSpeechPaused === 'function' && isSpeechPaused() ? 'Resume reading narration' : 'Pause reading narration'}" aria-label="${typeof isSpeechPaused === 'function' && isSpeechPaused() ? 'Resume reading narration' : 'Pause reading narration'}" ${!SPEECH_PASSAGE_ACTIVE ? 'hidden' : ''}>${typeof isSpeechPaused === 'function' && isSpeechPaused() ? '▶ Resume' : '⏸ Pause'}</button>
        <div class="speech-speed-pills" role="group" aria-label="Reading voice speed" style="display:inline-flex;gap:4px;margin-left:4px">
          <button type="button" class="icon-btn sm ${SPEECH_SETTINGS.rate === 0.75 ? 'on' : ''}" data-a="speech-rate-set" data-v="0.75" title="0.75x speed">0.75x</button>
          <button type="button" class="icon-btn sm ${SPEECH_SETTINGS.rate === 1 ? 'on' : ''}" data-a="speech-rate-set" data-v="1" title="1x speed">1x</button>
          <button type="button" class="icon-btn sm ${SPEECH_SETTINGS.rate === 1.25 ? 'on' : ''}" data-a="speech-rate-set" data-v="1.25" title="1.25x speed">1.25x</button>
        </div>
      </div>
      <div class="reader-tools">
        <button class="icon-btn" data-a="font-dec" title="Decrease font size" aria-label="Decrease font size">A−</button>
        <button class="icon-btn" data-a="font-inc" title="Increase font size" aria-label="Increase font size">A+</button>
      </div>
    </div>
    <label class="speech-follow-control"><input id="speech-follow" type="checkbox" ${SPEECH_SETTINGS.follow ? "checked" : ""}> Follow narration as it reads</label>
    <details class="speech-settings">
      <summary>Voice settings</summary>
      <div class="speech-settings-grid">
        <label for="speech-mode">Narration
          <select id="speech-mode" class="auth-input">
            <option value="auto">Recording when available</option>
            <option value="device">Device voice</option>
          </select>
        </label>
        <label for="speech-language">Language
          <select id="speech-language" class="auth-input">
            <option value="auto">Passage language</option>
            <option value="en-US">English</option>
            <option value="fil-PH">Filipino</option>
            <option value="ceb-PH">Cebuano</option>
          </select>
        </label>
        <label for="speech-voice">Device voice
          <select id="speech-voice" class="auth-input"><option value="">Automatic</option></select>
        </label>
        <label for="speech-rate">Speed
          <select id="speech-rate" class="auth-input">
            <option value="0.75">Gentle (0.75x)</option>
            <option value="0.85">Relaxed (0.85x)</option>
            <option value="1">Normal (1x)</option>
            <option value="1.1">Active (1.1x)</option>
            <option value="1.25">Brisk (1.25x)</option>
          </select>
        </label>
        <button class="btn o sm" type="button" data-a="speech-preview">Preview device voice</button>
      </div>
      <p id="speech-status" class="sub-sm" role="status" aria-live="polite"></p>
    </details>

    <div class="reader-stage reader-passage-stage">
        <div class="card reader-passage-card">
          <div class="lab">Passage</div>
          <h3 tabindex="-1">${escapeHTML(P.t)}</h3>
          <div class="ps" id="active-ps">${tapMarkup(P.x)}</div>
          <div class="reader-dictionary-tip sub-sm">${uiIcon("bulb")} <span>Tip: Tap any dotted word to see Filipino, Bisaya, & English meanings.</span></div>
        </div>
        <div class="reader-stage-footer"><button class="btn blue reader-stage-next" data-a="quiz-begin-question" type="button">${!qz.hasStarted ? "Start questions" : "Back to question"} ${uiIcon("next")}</button></div>
    </div>
    ` : `
    <div class="reader-stage reader-question-stage">
      <div class="reader-question-context">
        <span>${uiIcon("practice")} ${escapeHTML(P.t)}</span>
        <button class="btn o sm" data-a="quiz-show-passage" type="button">${uiIcon("practice")} View full passage</button>
      </div>

      <details class="quiz-passage-peek">
        <summary class="quiz-passage-peek-summary">
          <span>${uiIcon("practice")} Review Passage Text Evidence</span>
          <span class="sub-sm" style="font-weight:normal;color:var(--sub)">Tap to read</span>
        </summary>
        <div class="quiz-passage-peek-body ps">
          ${tapMarkup(P.x)}
        </div>
      </details>

        <div class="card reader-question-card quiz-card-enter">
          <div class="lab">${escapeHTML(q.k || "Comprehension")} Question · ${qz.idx + 1} of ${qz.steps.length}</div>
          <p class="q" tabindex="-1">${escapeHTML(q.q)}</p>

          <div id="options-list">
            ${q.o.map((opt, i) => {
              let optClass = "opt";
              let optExtra = "";
              if (qz.isAnswered) {
                if (i === q.a) {
                  optClass += " ok answer-correct-pop";
                  optExtra = ` <span class="opt-result">${uiIcon("check")} ${i === qz.selectedChoice ? "Your answer · Correct" : "Correct answer"}</span>`;
                } else if (i === qz.selectedChoice) {
                  optClass += " no answer-wrong-shake";
                  optExtra = ` <span class="opt-result">${uiIcon("close")} Your answer · Incorrect</span>`;
                }
              }
              return `
              <button class="${optClass}" data-a="submit-answer" data-v="${i}" type="button" ${qz.isAnswered ? "disabled" : ""}>
                <span class="opt-letter">${String.fromCharCode(65 + i)}</span>
                <span class="opt-text">${escapeHTML(opt)}</span>
                ${optExtra}
              </button>
            `;
            }).join("")}
          </div>

          <div id="quiz-feedback" role="status" aria-live="polite" tabindex="-1"></div>
        </div>
    </div>`}
    </div>
  `;
  }
  if (isPassageStage) refreshSpeechControls(P);
  if (!isPassageStage && qz.isAnswered && Number.isInteger(qz.selectedChoice)) {
    renderQuizAnswerFeedback(qz.selectedChoice);
  }
}

function focusQuizStage({ restorePassage = false } = {}) {
  const main = $("#v");
  const savedOffset = ACTIVE_QUIZ?.passageScrollOffset;
  const mainTop = main?.getBoundingClientRect?.().top + (window.scrollY || 0);
  if (restorePassage && Number.isFinite(savedOffset) && Number.isFinite(mainTop)) {
    window.scrollTo?.({ top: mainTop + savedOffset, behavior: "auto" });
  } else {
    main?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }
  const target = ACTIVE_QUIZ?.stage === "passage" ? ".reader-passage-card h3" : ".reader-question-card .q";
  main?.querySelector?.(target)?.focus?.({ preventScroll: true });
}

function showQuizStage(stage) {
  const qz = ACTIVE_QUIZ;
  if (!qz || !["passage", "question"].includes(stage)) return;
  if (qz.stage === "passage" && stage === "question") {
    const main = $("#v");
    const mainTop = main?.getBoundingClientRect?.().top + (window.scrollY || 0);
    if (Number.isFinite(window.scrollY) && Number.isFinite(mainTop)) {
      qz.passageScrollOffset = Math.max(0, window.scrollY - mainTop);
    }
  }
  const restorePassage = stage === "passage" && qz.hasStarted;
  if (qz.stage === "question") qz.hasStarted = true;
  qz.stage = stage;
  if (stage === "question") qz.hasStarted = true;
  renderQuiz();
  focusQuizStage({ restorePassage });
}

function handleAnswer(choiceIdx) {
  const qz = ACTIVE_QUIZ;
  if (!qz || qz.isAnswered) return;
  qz.stage = "question";
  qz.isAnswered = true;
  qz.selectedChoice = choiceIdx;
  if (Array.isArray(qz.userAnswers)) {
    qz.userAnswers[qz.idx] = choiceIdx;
  }

  const step = qz.steps[qz.idx];
  const q = step.q;
  const isCorrect = choiceIdx === q.a;
  const questionId = `${step.P.id}:${qz.idx}`;

  // Deduct heart for incorrect practice quiz answer (diagnostic placement is exempt)
  if (!isCorrect && qz.mode === "pr") {
    const heartRes = typeof deductQuizHeart === "function"
      ? deductQuizHeart(qz, questionId)
      : { success: true, hearts: Math.max(0, (qz.hearts || 1) - 1), maxHearts: qz.maxHearts || 4, deducted: true };
    if (heartRes.deducted) {
      showToast(`Incorrect answer: -1 heart (${heartRes.hearts}/${heartRes.maxHearts} left)`, "warn");
    }
  }

  // Schedule question review in spaced repetition engine
  if (typeof scheduleQuestionReview === "function") {
    if (!isCorrect && (qz.mode === "pr" || qz.mode === "studio")) {
      scheduleQuestionReview({
        questionId,
        passageId: step.P.id,
        passageTitle: step.P.t,
        passageExcerpt: step.P.x,
        qIndex: qz.idx,
        questionText: q.q,
        options: q.o,
        correctAnswer: q.a,
        explanation: q.exp,
        skill: q.k || "General",
        outcome: "incorrect"
      });
    } else if (qz.mode === "review") {
      scheduleQuestionReview({
        questionId: step.questionId || questionId,
        passageId: step.P.id,
        passageTitle: step.P.t,
        passageExcerpt: step.P.x,
        qIndex: qz.idx,
        questionText: q.q,
        options: q.o,
        correctAnswer: q.a,
        explanation: q.exp,
        skill: q.k || "General",
        outcome: isCorrect ? "correct" : "incorrect"
      });
    }
  }

  // Track recent mistake for Wisyo AI tutor
  if (!isCorrect) {
    S.miss = {
      p: step.P.x,
      q: q.q,
      ch: q.o[choiceIdx],
      ok: q.o[q.a],
      k: q.k || "Comprehension",
      exp: q.exp || "Review the passage carefully to locate the direct text evidence."
    };
  }

  step.userAnswer = choiceIdx;
  step.userCorrect = isCorrect;

  if (isCorrect) {
    qz.correctCount++;
    if (qz.mode === "pr") qz.correctQuestions.push({ index: qz.idx, skill: q.k || "General" });
  }

  // Update skills stats
  const skill = q.k || "General";
  const st = S.sk[skill] || [0, 0];
  st[0] += isCorrect ? 1 : 0;
  st[1] += 1;
  S.sk[skill] = st;
  save();

  if (typeof recordSkillAttempt === "function") {
    recordSkillAttempt({
      skill,
      isCorrect,
      questionId,
      passageId: step.P.id,
      timestamp: Date.now()
    });
  }

  renderQuiz();
  $("#quiz-feedback")?.focus?.({ preventScroll: true });
  saveActiveQuizSnapshot();
}

function renderQuizAnswerFeedback(choiceIdx) {
  const qz = ACTIVE_QUIZ;
  if (!qz) return;
  const step = qz.steps[qz.idx];
  const q = step.q;
  const isCorrect = choiceIdx === q.a;
  const isOutOfHearts = qz.mode === "pr" && qz.hearts === 0;

  // Mark the chosen and correct answers with words, icons, and color.
  $$(".opt").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.a) {
      btn.classList.add("ok", "answer-correct-pop");
      if (!btn.innerHTML || !btn.innerHTML.includes("opt-result")) {
        btn.insertAdjacentHTML("beforeend", `<span class="opt-result">${uiIcon("check")} ${i === choiceIdx ? "Your answer · Correct" : "Correct answer"}</span>`);
      }
    } else if (i === choiceIdx) {
      btn.classList.add("no", "answer-wrong-shake");
      if (!btn.innerHTML || !btn.innerHTML.includes("opt-result")) {
        btn.insertAdjacentHTML("beforeend", `<span class="opt-result">${uiIcon("close")} Your answer · Incorrect</span>`);
      }
    }
  });

  // Display feedback box
  const fb = $("#quiz-feedback");
  if (isOutOfHearts) {
    fb.innerHTML = `
      <div class="fb no answer-fb-pop">
        <b>${uiIcon("close")} Out of Hearts! (0/${qz.maxHearts})</b>
        <div>Correct answer: <b>${escapeHTML(q.o[q.a])}</b></div>
        ${q.exp ? `<div class="sub-sm" style="margin-top:4px">${escapeHTML(q.exp)}</div>` : ''}
        <div class="sub-sm" style="margin-top:6px;color:var(--text)">You ran out of hearts for this story. Review your answers or try again with fresh hearts!</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <button class="btn blue" data-a="out-of-hearts-retry" data-v="${escapeHTML(step.P.id)}">
          ${uiIcon("refresh")} Try Again with Fresh Hearts
        </button>
        <div style="display:flex;gap:8px">
          <button class="btn sm o" data-a="ai-explain-why" style="flex:1">
            ${uiIcon("bulb")} Ask Wisyo Why
          </button>
          <button class="btn sm o" data-a="quiz-exit-to-library" style="flex:1">
            ${uiIcon("practice")} Choose Another Story
          </button>
        </div>
      </div>
    `;
    return;
  }

  fb.innerHTML = `
    <div class="fb ${isCorrect ? 'ok' : 'no'} answer-fb-pop">
      <b>${isCorrect ? `${uiIcon("check")} Correct!` : `${uiIcon("bulb")} Not quite — take a look at the clue!`}</b>
      <div>${isCorrect ? 'Great job analyzing the text evidence.' : `Correct answer: <b>${escapeHTML(q.o[q.a])}</b>`}</div>
      ${q.exp ? `<div class="sub-sm" style="margin-top:4px">${escapeHTML(q.exp)}</div>` : ''}
    </div>

    <div style="display:flex;gap:8px;margin-top:10px">
      ${!isCorrect ? `
        <button class="btn sm o" data-a="ai-explain-why" style="flex:1">
          ${uiIcon("bulb")} Ask Wisyo Why
        </button>
      ` : ''}
      <button class="btn sm blue" data-a="quiz-next" style="flex:1">
        ${qz.idx + 1 < qz.steps.length ? 'Next Question →' : 'Finish Quiz ✓'}
      </button>
    </div>
  `;
}

function handleQuizNext() {
  const qz = ACTIVE_QUIZ;
  if (!qz) return;
  stopSpeech();
  const previousPassageId = qz.steps[qz.idx]?.P?.id;
  qz.idx++;
  qz.isAnswered = false;
  qz.selectedChoice = null;

  if (qz.idx < qz.steps.length) {
    qz.stage = qz.steps[qz.idx]?.P?.id === previousPassageId ? "question" : "passage";
    qz.hasStarted = qz.stage === "question";
    renderQuiz();
    focusQuizStage();
    saveActiveQuizSnapshot();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const qz = ACTIVE_QUIZ;
  if (!qz || qz._isFinalized) return;
  qz._isFinalized = true;
  clearActiveQuizSnapshot();
  const isPlacement = qz.mode === "pl";
  const score = qz.correctCount;
  const total = qz.steps.length;

  // Calculate unique words read
  const passageIds = [...new Set(qz.steps.map(s => s.P.id))];
  const allKnown = [...PLACEMENT_TEST, ...getPublishedPassages()];

  let totalWords = 0;
  passageIds.forEach(id => {
    const found = allKnown.find(p => p.id === id);
    if (found) {
      totalWords += wordCount(found.x);
      if (!isPlacement && !S.done.includes(id)) {
        S.done.push(id);
      }
    }
  });

  S.w += totalWords;
  S.ss += 1;

  if (isPlacement) {
    const isVerification = qz.steps.some(s => s.P.id === "pl_verify");

    if (isVerification) {
      // 5-question advanced verification for students with strong performance
      if (score >= 4) {
        S.lvl = 3; // Confirmed Mastery
        S.placementVerified = true;
      } else {
        S.lvl = 2; // Remains Proficient
        S.placementVerified = false;
      }
      S.placementCandidate = false;
    } else if (total >= 15) {
      // 15-question progressive placement assessment (5 questions each across 3 passages)
      const p1Steps = qz.steps.filter(s => s.P.id === "pl_easy");
      const p2Steps = qz.steps.filter(s => s.P.id === "pl_med");
      const p3Steps = qz.steps.filter(s => s.P.id === "pl_hard");

      const p1Correct = p1Steps.filter(s => s.userCorrect).length;
      const p2Correct = p2Steps.filter(s => s.userCorrect).length;
      const p3Correct = p3Steps.filter(s => s.userCorrect).length;

      // Evidence-based placement logic:
      // - Difficulty with basic (<3/5): Foundation support (Level 0)
      // - Strong basic (>=3/5), weak intermediate (<3/5): Developing (Level 1)
      // - Strong basic and intermediate (>=3/5 on both): Proficient (Level 2)
      // - Strong across all passages (>=4/5 across all, or total >= 13):
      //   Advanced candidate; further verification required before granting Mastery!
      if (p1Correct < 3) {
        S.lvl = 0;
        S.placementCandidate = false;
      } else if (p2Correct < 3) {
        S.lvl = 1;
        S.placementCandidate = false;
      } else if (p1Correct >= 4 && p2Correct >= 4 && p3Correct >= 4) {
        S.lvl = 2; // Level 2 provisional
        S.placementCandidate = true; // Advanced candidate eligible for verification passage
      } else if (p3Correct >= 3) {
        S.lvl = 2; // Proficient
        S.placementCandidate = false;
      } else {
        S.lvl = 1; // Developing
        S.placementCandidate = false;
      }

      // Record detailed breakdown by skill and passage
      const skills = {};
      qz.steps.forEach(s => {
        const sk = s.q.k || "General";
        if (!skills[sk]) skills[sk] = { correct: 0, total: 0 };
        skills[sk].total += 1;
        if (s.userCorrect) skills[sk].correct += 1;
      });

      S.placementReport = {
        date: new Date().toISOString(),
        totalScore: score,
        totalQuestions: total,
        p1Score: p1Correct,
        p2Score: p2Correct,
        p3Score: p3Correct,
        skills,
        level: S.lvl,
        isCandidate: S.placementCandidate,
        verified: false
      };
    } else {
      // Legacy 4-question test harness compatibility:
      // Perfect score must NOT automatically grant Mastery (Level 3)!
      if (score <= 1) S.lvl = 0;
      else if (score === 2) S.lvl = 1;
      else if (score === 3) S.lvl = 2;
      else S.lvl = 2; // 4/4 capped at Level 2 (Proficient / Advanced Candidate)
      S.placementCandidate = score === total && total >= 4;
    }

    if (S.l0 === null) S.l0 = S.lvl;

    // Check if user is Guest or Student
    if (!AUTH.currentUser) {
      // Guest mode: generate guest token so student can give it to teacher or register
      const guestToken = AUTH.createGuestToken(S.lvl, null, Math.round((score / qz.steps.length) * 100));
      S.guestToken = guestToken;
    } else if (AUTH.currentUser.role === "student") {
      AUTH.currentUser.lvl = S.lvl;
      if (typeof S.wpm === "number") AUTH.currentUser.wpm = S.wpm;
      else if (qz.timeElapsed && qz.totalWords) AUTH.currentUser.wpm = Math.round((qz.totalWords / qz.timeElapsed) * 60);
      AUTH.currentUser.comp = Math.round((score / qz.steps.length) * 100);
      AUTH.currentUser.wordsRead = S.w;
      AUTH.currentUser.placementCandidate = S.placementCandidate;
      AUTH.saveUsers();
      AUTH.saveSession();
    }
  }

  save();

  let journeyError = null;
  let journeyRecord = null;
  let newBadges = [];
  const isStudio = qz.mode === "studio";
  try {
    if (isPlacement) recordJourneyPlacement(S.lvl);
    else if (qz.mode === "pr") {
      journeyRecord = recordJourneyPractice(qz);
      newBadges = journeyRecord?.newBadges || [];
    }
  } catch (error) {
    journeyError = error.message;
  }

  const attemptId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const xpAwarded = isStudio
    ? Math.min(10, qz.correctCount * 2)
    : (journeyRecord?.xpGained || (qz.mode === "review" ? qz.correctCount * 5 : 0));

  const finishedQuiz = {
    id: attemptId,
    title: qz.title,
    mode: qz.mode,
    steps: qz.steps,
    correctCount: qz.correctCount,
    correctQuestions: qz.correctQuestions || [],
    userAnswers: [...(qz.userAnswers || [])],
    startTime: qz.startTime,
    completedAt: Date.now(),
    xpAwarded
  };

  if (!Array.isArray(S.attempts)) S.attempts = [];
  S.attempts.push({
    id: attemptId,
    passageId: qz.steps[0]?.P?.id || "unknown",
    mode: qz.mode,
    score,
    total,
    xpAwarded,
    timestamp: Date.now()
  });
  if (S.attempts.length > 50) S.attempts = S.attempts.slice(-50);
  save();

  if (AUTH.currentUser && AUTH.currentUser.role === "student") {
    AUTH.currentUser.wordsRead = S.w;
    AUTH.saveUsers();
  }

  const streak = !isPlacement ? updateDailyStreak() : (S.streak || 1);

  if (!isPlacement && typeof updateQuestProgress === "function") {
    if (qz.mode === "review") {
      updateQuestProgress("review", 1);
      if (qz.correctCount > 0 && typeof awardQuestBonusXP === "function") {
        awardQuestBonusXP(qz.correctCount * 5);
      }
    } else {
      updateQuestProgress("read", 1);
      if (score / total >= 0.75) {
        updateQuestProgress("quiz", 1);
      }
    }
  }

  ACTIVE_QUIZ = null;
  QUIZ_RESULT = {
    quiz: finishedQuiz,
    isPlacement,
    score,
    total,
    totalWords,
    newBadges: newBadges || [],
    xpGained: xpAwarded,
    totalXP: journeyRecord?.totalXP ?? (typeof journeyTotalXP === "function" ? journeyTotalXP() : 0),
    isFirstCompletion: journeyRecord?.isFirstCompletion ?? false,
    improvement: journeyRecord?.improvement || 0,
    previousBest: journeyRecord?.previousBest || 0,
    levelUp: journeyRecord?.tierLeveledUp ? {
      fromTier: journeyRecord.beforeTier,
      toTier: journeyRecord.afterTier,
      tierName: journeyRecord.tierName
    } : null,
    streak: streak || 1,
    heartsRemaining: qz.hearts,
    maxHearts: qz.maxHearts,
    reviewMode: false,
    karaokeDone: false
  };

  CURRENT_TAB = isPlacement ? "assess" : "practice";
  renderApp();

  showToast(journeyError
    ? `Quiz completed, but ${journeyError}`
    : `Quiz completed! ${score} of ${total} correct · +${totalWords} words added to Bayanihan Quest!${newBadges.length ? ` New badge${newBadges.length > 1 ? "s" : ""}: ${newBadges.map(badge => badge.title).join(", ")}.` : ""}`,
  journeyError ? "warn" : undefined);
}

function renderQuizResult() {
  const res = QUIZ_RESULT;
  if (!res) return;
  const pct = Math.round((res.score / res.total) * 100);
  const isHigh = res.score / res.total >= 0.75;
  const isMid = res.score / res.total >= 0.5 && !isHigh;

  const isReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion || typeof requestAnimationFrame === "undefined") {
    res.karaokeDone = true;
  }

  let encourageHtml = "";
  if (isHigh) {
    encourageHtml = `
      <div class="quiz-result-message ok" role="note">
        <b>${uiIcon("check")} Outstanding! Excellent comprehension of the story!</b>
        <p class="sub">You identified key details and solid text evidence. You are ready for the next reading challenge.</p>
      </div>
    `;
  } else if (isMid) {
    encourageHtml = `
      <div class="quiz-result-message warn" role="note">
        <b>${uiIcon("bulb")} Good effort! Very close to your goal.</b>
        <p class="sub">You grasped important ideas from the story. Review your answers to spot clues in the passage, or try again to beat your personal best.</p>
      </div>
    `;
  } else {
    encourageHtml = `
      <div class="quiz-result-message info" role="note">
        <b>${uiIcon("bulb")} Keep learning! Practice makes progress.</b>
        <p class="sub">No penalties and no XP loss. Every mistake is an opportunity to learn. Review the answers below to find clues in the passage, and feel free to try again anytime!</p>
      </div>
    `;
  }

  let xpRow = "";
  if (!res.isPlacement) {
    let xpExplanation = "";
    if (res.isFirstCompletion) {
      xpExplanation = `10 XP for completion + ${res.score * 5} XP for ${res.score} correct answers`;
    } else if (res.improvement > 0) {
      xpExplanation = `+${res.xpGained} XP for a +${res.improvement} improvement over your personal best (${res.previousBest} → ${res.score})`;
    } else {
      xpExplanation = `Personal best (${res.previousBest}/${res.total}) maintained. On retries, only improving your personal best earns additional XP.`;
    }

    xpRow = `
      <div class="quiz-result-stats">
        <div class="stat-box quiz-xp-box">
          <div class="lab">${uiIcon("sparkles")} XP Points</div>
          <div class="num" style="color:var(--gold-hover)">+${res.xpGained} XP</div>
          <div class="sub-sm">${xpExplanation}</div>
        </div>
        <div class="stat-box quiz-word-box">
          <div class="lab">${uiIcon("quest")} Bayanihan Words</div>
          <div class="num" style="color:var(--sky)">+${res.totalWords}</div>
          <div class="sub-sm">Added to class Bayanihan word count</div>
        </div>
      </div>
    `;
  }

  let levelUpHtml = "";
  if (res.levelUp) {
    levelUpHtml = `
      <section class="card level-up-hero-card" role="status" aria-live="polite" aria-label="Reading Tier Level Up">
        <div class="level-up-badge">
          <span class="level-up-star" aria-hidden="true">⭐</span>
          <h3 style="margin:0">LEVEL UP! · New Reading Tier Unlocked!</h3>
        </div>
        <p style="margin:6px 0 0">You advanced to <b class="level-up-tier-name">${escapeHTML(res.levelUp.tierName)}</b>! You are ready for more engaging and challenging stories in your reading journey.</p>
      </section>
    `;
  }

  const karaokeStageHtml = `
    <section class="karaoke-stage" id="karaoke-stage" aria-label="Quiz result celebration" role="region">
      ${!res.karaokeDone ? `<button type="button" class="btn sm karaoke-skip-btn" data-a="quiz-karaoke-skip" aria-label="Skip score reveal animation">Skip ✕</button>` : ''}
      <div class="karaoke-spotlight karaoke-spotlight-left" aria-hidden="true"></div>
      <div class="karaoke-spotlight karaoke-spotlight-right" aria-hidden="true"></div>

      <div class="karaoke-wisyo-wrap">
        <img src="assets/images/wisyo.png" alt="Wisyo" class="karaoke-wisyo-img" />
        <div class="karaoke-wisyo-bubble" id="karaoke-wisyo-bubble">
          ${res.karaokeDone ? quizWisyoCelebrationQuote(pct) : "Analyzing your answers..."}
        </div>
      </div>

      <div class="karaoke-score-ring ${res.karaokeDone ? 'locked' : 'suspense'}" id="karaoke-score-ring">
        <div class="karaoke-score-val" id="karaoke-score-val">${res.karaokeDone ? pct : 0}%</div>
        <div class="karaoke-score-sub" id="karaoke-score-sub">${res.score} of ${res.total} correct</div>
      </div>

      <div class="karaoke-rating ${res.karaokeDone ? 'show' : ''}" id="karaoke-rating">
        ${res.karaokeDone ? quizRatingText(pct) : ""}
      </div>

      <div class="karaoke-confetti" id="karaoke-confetti" aria-hidden="true">
        ${res.karaokeDone ? renderConfettiParticles() : ""}
      </div>

      <div class="quiz-streak-pill" role="status">
        <span class="streak-flame" aria-hidden="true">🔥</span>
        <span><b>${res.streak || 1} Day Streak!</b> Keep up your daily reading habit!</span>
      </div>
    </section>
  `;

  let badgeRevealHtml = "";
  if (res.newBadges && res.newBadges.length > 0) {
    badgeRevealHtml = `
      <section class="card badge-reveal-hero" role="status" aria-live="polite" aria-label="Newly unlocked badges">
        <div class="badge-reveal-head">
          ${uiIcon("sparkles")} <span>New Badge Unlocked!</span>
        </div>
        <div class="badge-reveal-grid">
          ${res.newBadges.map(badge => `
            <div class="badge-reveal-card">
              <span class="badge-reveal-icon" aria-hidden="true">${badge.icon || "🏅"}</span>
              <div>
                <h4 style="margin:0 0 4px 0">${escapeHTML(badge.title)}</h4>
                <p class="sub-sm" style="margin:0 0 6px 0">${escapeHTML(badge.description)}</p>
                <div class="badge-reveal-reason">
                  <b>Why you earned this:</b> ${escapeHTML(badge.whyReason || badge.description)}
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  let reviewSectionHtml = "";
  if (res.reviewMode) {
    reviewSectionHtml = `
      <section class="card quiz-review-panel" aria-label="Answer review">
        <div class="card-header">
          <div>
            <div class="lab">${uiIcon("eye")} Question-by-Question Review</div>
            <h3 style="margin:4px 0">Review Answers & Evidence</h3>
          </div>
          <button class="btn sm o" data-a="quiz-review" aria-label="Close review">Close review ✕</button>
        </div>
        <p class="sub">Inspect each question, your selected answer, the correct choice, and explanations from the text:</p>
        <div class="quiz-review-list">
          ${res.quiz.steps.map((step, idx) => {
            const userChoice = res.quiz.userAnswers[idx];
            const isCorrect = userChoice === step.q.a;
            return `
              <div class="card quiz-review-item ${isCorrect ? 'review-ok' : 'review-no'}" style="margin-bottom:12px;border-left:4px solid ${isCorrect ? 'var(--teal)' : 'var(--coral)'}">
                <div class="row" style="margin-bottom:6px">
                  <span class="sub-sm">Question ${idx + 1} of ${res.total} · <b>${escapeHTML(step.q.k || "Comprehension")}</b></span>
                  <span class="pill ${isCorrect ? 'ok' : 'warn'}">${isCorrect ? 'Correct ✓' : 'Incorrect ✕'}</span>
                </div>
                <p class="q" style="margin-bottom:10px">${escapeHTML(step.q.q)}</p>
                <div class="quiz-review-choices">
                  ${step.q.o.map((opt, optIdx) => {
                    let optClass = "opt";
                    let marker = "";
                    if (optIdx === step.q.a) {
                      optClass += " ok";
                      marker = `<span class="opt-result">${uiIcon("check")} Correct answer</span>`;
                    } else if (optIdx === userChoice) {
                      optClass += " no";
                      marker = `<span class="opt-result">${uiIcon("close")} Your answer · Incorrect</span>`;
                    }
                    return `
                      <div class="${optClass}" style="cursor:default">
                        <span class="opt-letter">${String.fromCharCode(65 + optIdx)}</span>
                        <span class="opt-text">${escapeHTML(opt)}</span>
                        ${marker}
                      </div>
                    `;
                  }).join("")}
                </div>
                ${step.q.exp ? `
                  <div class="sub-sm" style="margin-top:10px;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm)">
                    <b>${uiIcon("bulb")} Text Evidence:</b> ${escapeHTML(step.q.exp)}
                  </div>
                ` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  const v = $("#v");
  if (v) {
    v.innerHTML = `
    <div class="quiz-result-page">
    <div class="dashboard-intro">
      <div>
        <h2>${uiIcon("assess")} Quiz Result</h2>
        <p class="sub">${escapeHTML(res.quiz.title)}</p>
      </div>
      <div class="dashboard-intro-actions">
        <button class="btn sm o" data-a="quiz-exit-to-library">${uiIcon("practice")} Reading Library</button>
      </div>
    </div>

    ${karaokeStageHtml}
    ${levelUpHtml}

    <section class="card quiz-result-hero-card" aria-label="Score summary">
      <div class="quiz-score-header">
        <div class="quiz-score-badge-main" role="status" aria-live="polite">
          <span class="quiz-score-num">${res.score}/${res.total}</span>
          <span class="quiz-score-label">correct</span>
        </div>
        <div class="quiz-score-details">
          <div class="lab">Final Score</div>
          <h3 style="margin:2px 0 4px">${pct}% Accuracy</h3>
          <div class="bar score-reveal-bar" style="margin:6px 0 0"><i style="width:${pct}%"></i></div>
        </div>
      </div>

      ${xpRow}
      ${encourageHtml}

      <div class="quiz-result-buttons">
        <button type="button" class="btn o" data-a="quiz-review">
          ${uiIcon("eye")} ${res.reviewMode ? "Hide answers" : "Review answers"}
        </button>
        <button type="button" class="btn o" data-a="quiz-retry">
          ${uiIcon("refresh")} Try again
        </button>
        <button type="button" class="btn blue" data-a="quiz-next-story">
          ${uiIcon("next")} Next story
        </button>
      </div>
    </section>

    ${badgeRevealHtml}
    ${reviewSectionHtml}
    </div>
  `;
  }

  if (!res.karaokeDone) {
    runKaraokeCelebrationTicker(pct, res.score, res.total);
  }
}



/* === src/services/tutor.js === */
/* Wisyo: online GroqCloud help and passage-focused offline fallback. */
let CHAT_HISTORY = [];
let WISYO_MODE = "offline";
let WISYO_ONLINE_AVAILABLE = false;
let WISYO_PROVIDER = "GroqCloud";
let WISYO_BUSY = false;
let WISYO_REQUEST_ID = 0;
let WISYO_STATUS_CHECKED = false;
let WISYO_STATUS_PENDING = null;
let WISYO_RETRY_AT = 0;
let WISYO_OFFLINE_REASON = "";
let WISYO_API_BASE = "";

function getWisyoStorageKey() {
  const uid = (typeof AUTH !== "undefined" && AUTH.currentUser?.id) ? AUTH.currentUser.id : "guest";
  return `basawisyo_chat_history_${uid}`;
}

function loadWisyoChatHistory() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(getWisyoStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (_) {}
  return [["a", "Mabuhay! I'm Wisyo. Ask about reading, a word, or your current passage. I use Groq when it is available and switch to offline help when it is not."]];
}

function saveWisyoChatHistory() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(getWisyoStorageKey(), JSON.stringify(CHAT_HISTORY));
    }
  } catch (_) {}
}

function clearWisyoChat() {
  WISYO_REQUEST_ID++;
  WISYO_BUSY = false;
  CHAT_HISTORY = [["a", "Mabuhay! I'm Wisyo. Ask about reading, a word, or your current passage. I use Groq when it is available and switch to offline help when it is not."]];
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(getWisyoStorageKey());
    }
  } catch (_) {}
  renderChat();
  updateWisyoModeUI();
}

function initWisyoChatForCurrentAccount() {
  CHAT_HISTORY = loadWisyoChatHistory();
  if (typeof renderChat === "function") renderChat();
  if (typeof updateWisyoModeUI === "function") updateWisyoModeUI();
}

function wisyoReadingContext() {
  const quiz = ACTIVE_QUIZ;
  const isPlacement = quiz?.mode === "pl";
  const step = quiz?.steps?.[quiz.idx];
  const recentMistake = S?.miss ? {
    q: String(S.miss.q || ""),
    question: String(S.miss.q || ""),
    ch: String(S.miss.ch || ""),
    chosenAnswer: String(S.miss.ch || ""),
    ok: String(S.miss.ok || ""),
    correctAnswer: String(S.miss.ok || ""),
    k: String(S.miss.k || "Comprehension"),
    skill: String(S.miss.k || "Comprehension"),
    exp: String(S.miss.exp || ""),
    explanation: String(S.miss.exp || "")
  } : null;

  if (!step?.P) {
    return recentMistake ? { recentMistake, isPlacement } : { isPlacement };
  }

  const selectedAnswer = quiz.isAnswered && Number.isInteger(quiz.selectedChoice) && step.q?.o?.[quiz.selectedChoice]
    ? String(step.q.o[quiz.selectedChoice])
    : null;

  return {
    passage: {
      title: String(step.P.t || ""),
      text: String(step.P.x || "").slice(0, 8000),
      difficulty: String(step.P.diff || "medium")
    },
    question: step.q ? {
      text: String(step.q.q || ""),
      skill: String(step.q.k || "Comprehension"),
      options: Array.isArray(step.q.o) ? step.q.o.map(String) : [],
      answered: Boolean(quiz.isAnswered),
      selectedAnswer
    } : undefined,
    recentMistake,
    isPlacement
  };
}

function updateWisyoModeUI(message = "") {
  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  const tag = $("#ai-mode-tag");
  if (tag) {
    if (isPrem && WISYO_MODE === "online") {
      tag.textContent = "Wisyo Plus 👑";
      if (tag.style) {
        tag.style.background = "#fef3c7";
        tag.style.color = "#92400e";
      }
    } else {
      tag.textContent = WISYO_MODE === "online" ? "Groq AI" : "Offline help";
      if (tag.style) {
        tag.style.background = "";
        tag.style.color = "";
      }
    }
  }
  const sub = $("#ai-subtitle");
  if (sub) {
    sub.textContent = WISYO_MODE === "online"
      ? (isPrem ? "High-thinking Wisyo Plus mode active with advanced reasoning." : `${WISYO_PROVIDER} can use the current passage and recent chat to help you read.`)
      : "Passage tips and vocabulary stay in this browser.";
  }
  const status = $("#ai-mode-status");
  if (status) {
    status.textContent = message || WISYO_OFFLINE_REASON || (WISYO_MODE === "online"
      ? (isPrem ? "Wisyo Plus active: generous high-thinking tutoring with deep reading reasoning." : `Groq is configured. Messages, the current passage, and recent chat are sent when you ask Wisyo.`)
      : "Using offline help. Add a Groq key to the local server for automatic online answers.");
  }
  const send = $("#ai-send-button");
  if (send) send.disabled = WISYO_BUSY;
}

async function checkWisyoOnlineStatus() {
  if (WISYO_STATUS_PENDING) return WISYO_STATUS_PENDING;
  WISYO_STATUS_PENDING = (async () => {
    try {
      let response;
      try {
        response = await fetch(`${WISYO_API_BASE}/api/chat/status`, { signal: AbortSignal.timeout(3000) });
      } catch (primaryErr) {
        // Fallback probe for localhost port 8765 if browsing from another local port (e.g. 3000 or 5500)
        if (typeof window !== "undefined" && window.location && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && window.location.port !== "8765") {
          try {
            const probe = await fetch("http://127.0.0.1:8765/api/chat/status", { signal: AbortSignal.timeout(2000) });
            if (probe.ok) {
              WISYO_API_BASE = "http://127.0.0.1:8765";
              response = probe;
            }
          } catch (_) {}
        }
        if (!response) throw primaryErr;
      }

      if (!response.ok) {
        WISYO_STATUS_CHECKED = true;
        WISYO_ONLINE_AVAILABLE = false;
        WISYO_MODE = "offline";
        WISYO_OFFLINE_REASON = "This page is not using the BasaWisyo AI server. Open it with backend/start-basa.ps1 to use Groq.";
        WISYO_RETRY_AT = Date.now() + 30000;
        updateWisyoModeUI();
        return;
      }
      const status = await response.json();
      WISYO_ONLINE_AVAILABLE = status?.onlineAvailable === true && status?.provider === "GroqCloud";
      if (WISYO_ONLINE_AVAILABLE) WISYO_PROVIDER = "GroqCloud";
      WISYO_STATUS_CHECKED = true;
      if (!WISYO_ONLINE_AVAILABLE) {
        WISYO_MODE = "offline";
        WISYO_OFFLINE_REASON = "Groq key is not loaded. Check backend/.env.local, then restart the BasaWisyo server.";
        WISYO_RETRY_AT = Date.now() + 30000;
      } else if (Date.now() >= WISYO_RETRY_AT) {
        WISYO_MODE = "online";
        WISYO_OFFLINE_REASON = "";
      }
    } catch (error) {
      WISYO_STATUS_CHECKED = true;
      WISYO_ONLINE_AVAILABLE = false;
      WISYO_MODE = "offline";
      WISYO_OFFLINE_REASON = "BasaWisyo AI server is unavailable. Start it with backend/start-basa.ps1; offline help is available.";
      WISYO_RETRY_AT = Date.now() + 30000;
    }
    updateWisyoModeUI();
  })().finally(() => { WISYO_STATUS_PENDING = null; });
  return WISYO_STATUS_PENDING;
}

function aiOpen(defaultPrompt) {
  const dialog = $("#ai");
  if (dialog) {
    if (dialog.hidden) dialog._returnFocus = document.activeElement;
    dialog.hidden = false;
  }
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.add("wisyo-chat-open");
  }
  setTimeout(() => $("#aii")?.focus?.(), 80);
  if (!CHAT_HISTORY.length) {
    CHAT_HISTORY = loadWisyoChatHistory();
  }
  renderChat();
  updateWisyoModeUI();
  const statusCheck = checkWisyoOnlineStatus();
  if (defaultPrompt) statusCheck.then(() => aiSend(defaultPrompt));
}

function aiClose() {
  const dialog = $("#ai");
  if (dialog) {
    dialog.hidden = true;
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.remove("wisyo-chat-open");
    }
    if (dialog._returnFocus?.focus) dialog._returnFocus.focus();
  }
}

function renderChat() {
  const container = $("#aim");
  if (!container) return;
  const esc = typeof escapeHTML === "function" ? escapeHTML : (s => String(s).replace(/"/g, '&quot;'));

  container.innerHTML = CHAT_HISTORY.map(([role, message], idx) => {
    const isUser = role === "u";
    const isUnavailable = !isUser && typeof message === "string" && message.includes("Groq is unavailable");
    const prevUserMessage = (isUnavailable && idx > 0 && CHAT_HISTORY[idx - 1]?.[0] === "u") ? CHAT_HISTORY[idx - 1][1] : "";

    return `<div class="msg-row ${isUser ? "u" : "a"}">
      ${isUser ? "" : `<div class="msg-avatar"><img src="${LG}" alt="Wisyo" class="mascot-img"></div>`}
      <div class="msg-body ${isUser ? "u" : "a"}">
        ${message === "…"
          ? '<div class="wisyo-replying" role="status" aria-live="polite"><span class="wisyo-replying-text">Wisyo is replying…</span> <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></div>'
          : formatChatText(message)}
        ${isUnavailable && prevUserMessage ? `
          <div style="margin-top:8px">
            <button class="btn sm o wisyo-retry-btn" data-a="ai-retry" data-v="${esc(prevUserMessage)}">
              ↻ Retry with Groq AI
            </button>
          </div>
        ` : ""}
      </div>
    </div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

function formatChatText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br>");
}

const WISYO_STOP_WORDS = new Set(
  "a an and ang are as at ba did does for from he her his how i in iyang is it kay kung mga mo na ng nga ni of on or sa she siya sila the this to unsa what when where which who why with you".split(" ")
);

function wisyoWords(text) {
  return (String(text || "").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter(word => word.length > 2 && !WISYO_STOP_WORDS.has(word));
}

function wisyoSentences(text) {
  return String(text || "").match(/[^.!?]+[.!?]+(?:[”"']|$)?|[^.!?]+$/g)
    ?.map(part => part.trim()).filter(Boolean) || [];
}

function wisyoEvidence(text, query) {
  const terms = [...new Set(wisyoWords(query))];
  if (!terms.length) return null;
  const ranked = wisyoSentences(text).map((sentence, index) => {
    const words = new Set(wisyoWords(sentence));
    return { sentence, index, score: terms.filter(term => words.has(term)).length };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.score > 0 ? ranked[0] : null;
}

function wisyoLanguage(query) {
  if (/\b(unsa|ngano|tabang|pasabot|palihug|hatagi|saon|akong)\b/i.test(query)) return "ceb";
  if (/\b(ano|bakit|paano|kahulugan|tulong|pakisabi|buod)\b/i.test(query)) return "fil";
  return "en";
}

function wisyoVocabularyWord(query) {
  const request = query.match(/(?:what does|meaning of|define|definition of|unsa(?:y| ang)? pasabot(?: sa)?|ano(?:ng| ang)? kahulugan(?: ng)?|ibig sabihin(?: ng)?)\s+["“']?([\p{L}-]+)/iu);
  if (request) return request[1].toLocaleLowerCase();
  const words = wisyoWords(query);
  return words.length === 1 && Object.hasOwn(D, words[0]) ? words[0] : null;
}

function wisyoHint(question, passage, language) {
  const evidence = passage && wisyoEvidence(passage.text, question.text);
  const place = evidence ? `sentence ${evidence.index + 1}` : "the passage";
  const skill = String(question.skill || "");
  let strategy;
  if (/inferen/i.test(skill)) {
    strategy = "Connect the clue with what the character does or feels.";
  } else if (/main idea/i.test(skill)) {
    strategy = "Look for an idea that fits the whole passage, not just one detail.";
  } else if (/vocab/i.test(skill)) {
    strategy = `Reread ${place} and notice how the surrounding words give context to the word.`;
  } else if (/sequenc/i.test(skill)) {
    strategy = `Look for chronological order clues (first, then, next, after) around ${place}.`;
  } else {
    strategy = `Reread ${place} and compare its details with the choices.`;
  }
  const caution = language === "ceb" ? "Dili pa nako ihatag ang tubag hangtod makapili ka."
    : language === "fil" ? "Hindi ko muna ibibigay ang sagot bago ka pumili."
      : "I won't reveal the answer before you choose.";
  return `**Hint for “${question.text}”:** ${strategy} ${caution}`;
}

function offlineWisyoResponse(input, context = wisyoReadingContext()) {
  const query = String(input || "").trim().toLocaleLowerCase();
  const passage = context?.passage;
  const question = context?.question;
  const language = wisyoLanguage(query);

  if (/mistake|sayop|mali|wrong answer|explain why|why was/i.test(query)) {
    if (context?.isPlacement && question) {
      return "You are currently taking your diagnostic placement assessment! Take your time to read each sentence carefully. Diagnostic tests help Wisyo find your personal reading journey, so question hints will unlock once you complete placement.";
    }
    const miss = context?.recentMistake || S.miss;
    const qText = miss?.q || miss?.question;
    const okText = miss?.ok || miss?.correctAnswer;
    const chText = miss?.ch || miss?.chosenAnswer;
    const expText = miss?.exp || miss?.explanation || "Reread the passage for the supporting line.";
    if (qText && okText && !(question && !question.answered && question.text === qText)) {
      const chosenStr = chText ? `you chose “${chText}”. ` : "";
      return `For “${qText}”, ${chosenStr}The correct choice was “${okText}”. ${expText} Keep going—analyzing mistakes is the fastest way to build reading comprehension!`;
    }
    return "I don't have a recent incorrect answer to explain. Ask me after answering a quiz question.";
  }

  if (/quiz me|test me|quick check|practice check|follow up|follow-up/i.test(query)) {
    if (passage && passage.text) {
      const sentences = wisyoSentences(passage.text);
      if (sentences.length) {
        const sentence = sentences[Math.min(1, sentences.length - 1)];
        return `**Quick Practice Check for “${passage.title}”:**\nIn your own words, what is happening in this sentence: “${sentence}”? Try to identify the key subject and action!`;
      }
    }
    return "Open any story in the Reading Library, and I can give you quick comprehension checks and reading tips!";
  }

  const word = wisyoVocabularyWord(query);
  if (word) {
    if (Object.hasOwn(D, word)) {
      const [filipino, bisaya, english] = D[word];
      return `**${word}** — Filipino: ${filipino}; Bisaya: ${bisaya}; English: ${english}`;
    }
    const occurrence = passage && wisyoEvidence(passage.text, word);
    return occurrence
      ? `I don't have a verified offline definition for “${word}”. Read it in context: “${occurrence.sentence}”`
      : `I don't have a verified offline definition for “${word}”. Try another word from the passage.`;
  }

  if (question && !question.answered) {
    if (context?.isPlacement) {
      return "You are currently taking your diagnostic placement assessment! Take your time to read each sentence carefully. Diagnostic tests help Wisyo find your personal reading journey, so question hints will unlock once you complete placement.";
    }
    return wisyoHint(question, passage, language);
  }

  if (passage && /summar|buod|lagom|tungkol saan|about this passage|main idea of (the|this) (passage|story|text)/i.test(query)) {
    const sentences = wisyoSentences(passage.text);
    if (!sentences.length) return "This passage has no text to summarize.";
    const selected = sentences.length < 3 ? sentences : [sentences[0], sentences[sentences.length - 1]];
    const label = language === "ceb" ? "Mubo nga recap gikan sa passage"
      : language === "fil" ? "Maikling buod mula sa passage" : "Brief recap from the passage";
    return `**${label} “${passage.title}”:** ${selected.join(" ")}\n\nThese are lines from the passage; they may leave out details between them.`;
  }

  if (/literal|inferential|inference|critical reading|main idea/i.test(query) &&
      /difference|skill|mean|unsa|ano|explain|what is/i.test(query)) {
    return "**Literal** asks for facts stated in the passage. **Inference** combines clues with reasoning. **Critical reading** evaluates a claim and its evidence. **Main idea** is what the whole passage is mostly about.";
  }

  if (/phil-iri|reading exam|reading test/i.test(query) && /prepar|tips|study|unsaon|paano|how/i.test(query)) {
    return "Read the passage once for the main idea, then reread the lines related to each question. For literal questions, find a stated fact; for inference, connect two clues. Practice at a comfortable level and ask your teacher about your results. This is study advice, not an official Phil-IRI score.";
  }

  if (/bugtong|riddle/i.test(query)) {
    if (/answer|sagot|tubag/i.test(query)) return "Ang sagot sa bugtong ay **libro** (book): it has pages you can read but no tongue to speak.";
    return "**Bugtong:** May dahon, walang sanga; may salita, walang dila. Ano ito? Try to solve it before asking for the answer. (Clue: you can read it.)";
  }

  if (question && /hint|clue|tabang|help|unsaon|how|answer/i.test(query)) {
    if (context?.isPlacement) {
      return "You are currently taking your diagnostic placement assessment! Take your time to read each sentence carefully. Diagnostic tests help Wisyo find your personal reading journey, so question hints will unlock once you complete placement.";
    }
    return `Reread “${question.text}” and look for a matching sentence in the passage. If you missed it, ask me to explain your last mistake.`;
  }

  if (passage && /^(who|what|when|where|why|how|can you explain|tell me|kinsa|unsa|kanus|asa|ngano|giunsa|sino|ano|kailan|saan|bakit|paano)\b|\b(evidence|prove|support|ebidensya|patunay)\b/i.test(query)) {
    const evidence = wisyoEvidence(passage.text, query);
    if (evidence) {
      const label = language === "ceb" ? "Nakita nako sa passage" : language === "fil" ? "Nakita ko sa passage" : "Passage evidence";
      return `**${label}, sentence ${evidence.index + 1}:** “${evidence.sentence}”\n\nCheck whether this line answers your question. I can't confirm an answer beyond what the passage says.`;
    }
    return "I couldn't find a supporting line in this passage. Try asking with a name or phrase from the text.";
  }

  if (passage) {
    return `I can help offline with vocabulary, passage evidence, a short recap, or a quiz hint for “${passage.title}”. Ask about a word or a detail in the text.`;
  }
  return "Offline help covers reading skills and the built-in vocabulary. Open a passage for specific hints or evidence.";
}

function getDailyWisyoUsageKey() {
  const uid = (typeof AUTH !== "undefined" && AUTH.currentUser?.id) ? AUTH.currentUser.id : "guest";
  const dateStr = new Date().toISOString().slice(0, 10);
  return `basawisyo_ai_daily_${dateStr}_${uid}`;
}

function getDailyWisyoCount() {
  try {
    if (typeof localStorage !== "undefined") {
      return parseInt(localStorage.getItem(getDailyWisyoUsageKey()) || "0", 10);
    }
  } catch (_) {}
  return 0;
}

function incrementDailyWisyoCount() {
  try {
    if (typeof localStorage !== "undefined") {
      const next = getDailyWisyoCount() + 1;
      localStorage.setItem(getDailyWisyoUsageKey(), String(next));
      return next;
    }
  } catch (_) {}
  return 1;
}

async function aiSend(userText) {
  const clean = String(userText || "").trim();
  if (!clean || WISYO_BUSY) return;
  if (clean.length > 1500) {
    showToast("Ask Wisyo using 1,500 characters or fewer.");
    return;
  }
  const isPrem = typeof isUserPremium === "function" && isUserPremium();
  const context = wisyoReadingContext();

  // Free quota check: 10 messages/day
  if (!isPrem) {
    const count = getDailyWisyoCount();
    if (count >= 10) {
      if (typeof openUpgradeModal === "function") {
        openUpgradeModal("ai", "You have used your 10 free Wisyo AI questions for today! Upgrade to Wisyo Plus for generous high-thinking tutoring or continue with offline reading assistance.");
      }
      CHAT_HISTORY.push(
        ["u", clean],
        ["a", `⭐ You have reached your 10 free daily AI questions for today. Upgrade to **Wisyo Plus** for generous high-thinking tutoring! Here is offline help for now:\n\n${offlineWisyoResponse(clean, context)}`]
      );
      saveWisyoChatHistory();
      renderChat();
      return;
    }
  }

  incrementDailyWisyoCount();
  const previous = CHAT_HISTORY.slice(1).filter(([, message]) => message !== "…")
    .slice(-8).map(([role, text]) => ({ role: role === "u" ? "user" : "assistant", text: text.slice(0, 1500) }));
  CHAT_HISTORY.push(["u", clean], ["a", "…"]);
  const replyIndex = CHAT_HISTORY.length - 1;
  const requestId = ++WISYO_REQUEST_ID;
  WISYO_BUSY = true;
  updateWisyoModeUI();
  renderChat();
  let failureStatus = "";
  try {
    if (!WISYO_STATUS_CHECKED || (WISYO_MODE === "offline" && Date.now() >= WISYO_RETRY_AT)) {
      await checkWisyoOnlineStatus();
    }
    let reply;
    if (WISYO_MODE === "online") {
      const response = await fetch(`${WISYO_API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history: previous, context, isPremium: isPrem }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== "string") {
        const failure = new Error(result.error || "Groq did not respond.");
        failure.status = response.status;
        throw failure;
      }
      reply = result.reply;
    } else {
      reply = offlineWisyoResponse(clean, context);
    }
    if (requestId === WISYO_REQUEST_ID) CHAT_HISTORY[replyIndex] = ["a", reply];
  } catch (error) {
    if (requestId === WISYO_REQUEST_ID) {
      WISYO_MODE = "offline";
      WISYO_RETRY_AT = Date.now() + (error.status === 401 || error.status === 403 ? 300000 : 60000);
      CHAT_HISTORY[replyIndex] = ["a", `Groq is unavailable. Here's offline help:\n\n${offlineWisyoResponse(clean, context)}`];
      failureStatus = error.status === 429
        ? "Groq free limit reached. Using offline help; Wisyo will retry automatically."
        : /rejected the API key/.test(error.message || "")
          ? "Groq rejected the key. Update backend/.env.local and restart the server."
          : "Could not reach Groq. Using offline help; Wisyo will retry automatically.";
      WISYO_OFFLINE_REASON = failureStatus;
    }
  } finally {
    if (requestId === WISYO_REQUEST_ID) {
      WISYO_BUSY = false;
      saveWisyoChatHistory();
      updateWisyoModeUI(failureStatus);
      renderChat();
    }
  }
}


/* === src/services/practice-helper.js === */
/* Wisyo's practice helper drafts reading comprehension questions covering
   Literal, Inference, Main Idea, and Vocabulary skills. */
function offlinePracticeSuggestions(text, count) {
  const source = String(text || "").trim();
  const words = [...source.matchAll(/[\p{L}][\p{L}'’-]*/gu)]
    .filter(match => match[0].length >= 4);
  const distinct = [...new Set(words.map(match => match[0].toLocaleLowerCase()))];
  if (distinct.length < Math.max(4, count)) {
    throw new Error(`Wisyo needs more varied passage text to draft ${count} question${count === 1 ? "" : "s"}. Add more text or write questions manually.`);
  }
  const chosen = [];
  const used = new Set();
  for (const match of words) {
    const key = match[0].toLocaleLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    chosen.push(match);
    if (chosen.length === count) break;
  }
  const skillCycle = ["Literal", "Inference", "Main idea", "Vocabulary"];
  return chosen.map((match, index) => {
    const answer = match[0];
    const start = Math.max(0, match.index - 65);
    const end = Math.min(source.length, match.index + answer.length + 65);
    const excerpt = `${start ? "…" : ""}${source.slice(start, match.index)}____${source.slice(match.index + answer.length, end)}${end < source.length ? "…" : ""}`;
    const otherWords = distinct.filter(word => word !== answer.toLocaleLowerCase());
    const distractors = [0, 1, 2].map(offset => otherWords[(index * 3 + offset) % otherWords.length]);
    const correctAt = index % 4;
    const options = [...distractors];
    options.splice(correctAt, 0, answer);
    const skill = skillCycle[index % skillCycle.length];
    return {
      q: `Which word completes this excerpt from the passage? “${excerpt}”`,
      o: options,
      a: correctAt,
      k: skill,
      exp: `Locate the supporting line in the passage: “${answer}” directly completes the context.`,
      version: 1
    };
  });
}

function validateGeneratedQuestion(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.q !== "string" || !item.q.trim()) return false;
  if (!Array.isArray(item.o) || item.o.length !== 4) return false;
  if (!Number.isInteger(item.a) || item.a < 0 || item.a > 3) return false;
  const validSkills = ["Literal", "Inference", "Main idea", "Vocabulary", "Critical reading"];
  if (item.k && !validSkills.includes(item.k)) return false;
  return true;
}

async function wisyoPracticeSuggestions(text, count, diff, options = {}) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Add passage text before asking Wisyo for questions.");
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error("Choose between 1 and 20 questions.");
  }
  if (window.ai?.languageModel?.create) {
    let session;
    try {
      session = await window.ai.languageModel.create({
        systemPrompt: "You help teachers write reading comprehension questions. Return only a JSON array, with no markdown or explanation. Every question must be answerable from the supplied passage."
      });
      const response = await session.prompt(`Draft exactly ${count} varied comprehension questions for a ${diff} reading passage. Each item must be an object with q (question, up to 500 characters), o (exactly 4 distinct answer strings), a (zero-based index of the correct option), and k (one of Literal, Inference, Critical reading, Main idea). Passage:\n${source.slice(0, 12000)}`);
      const raw = String(response || "");
      const opening = raw.indexOf("[");
      const closing = raw.lastIndexOf("]");
      const proposed = JSON.parse(raw.slice(opening, closing + 1));
      if (!Array.isArray(proposed) || proposed.length !== count
          || proposed.some(item => !Array.isArray(item.o) || item.o.length !== 4
            || new Set(item.o.map(option => String(option).trim().toLocaleLowerCase())).size !== 4)) {
        throw new Error("Model returned incomplete questions.");
      }
      const normalized = normalizePassage({ id: "wisyo_suggestions", t: "Suggestions", x: source, diff, qs: proposed });
      return { questions: normalized.qs, source: "on-device model" };
    } catch (error) {
      // A missing or unsuitable local model falls back to transparent text-based drafts.
    } finally {
      try { session?.destroy?.(); } catch (error) { /* Session cleanup is optional. */ }
    }
  }

  // Check if online server Groq is available when explicitly requested
  if (options.forceServer && typeof fetch === "function") {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Draft exactly ${count} varied comprehension questions for a ${diff} reading passage across Literal, Inference, and Main idea. Return only a JSON array of objects with q, o (4 choices), a (0-3), and k: ${source.slice(0, 6000)}`,
          history: []
        }),
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        const data = await response.json();
        const raw = String(data?.reply || "");
        const opening = raw.indexOf("[");
        const closing = raw.lastIndexOf("]");
        if (opening >= 0 && closing > opening) {
          const proposed = JSON.parse(raw.slice(opening, closing + 1));
          if (Array.isArray(proposed) && proposed.length === count && proposed.every(validateGeneratedQuestion)) {
            const normalized = normalizePassage({ id: "wisyo_suggestions", t: "Suggestions", x: source, diff, qs: proposed });
            return { questions: normalized.qs, source: "Groq AI Coach" };
          }
        }
      }
    } catch (error) {
      // Fall through to offline text helper
    }
  }

  return { questions: offlinePracticeSuggestions(source, count), source: "offline text helper" };
}


/* === src/services/exports.js === */
/* ==========================================================================
   BasaWisyo Reporting & Export Service (exports.js)
   Unified data pipeline connecting Roster, Reports, and Downloadable CSV/Print.
   ========================================================================== */

function getClassroomReportDataset(actor = (typeof AUTH !== "undefined" ? AUTH.currentUser : null)) {
  if (!actor || !["teacher", "admin"].includes(actor.role)) return null;

  const isAdmin = actor.role === "admin";
  const section = isAdmin ? "All Enrolled Sections" : (actor.section || "Grade 8");
  const classroomCode = isAdmin ? "ADMIN-ALL" : (actor.shareCode || "UNASSIGNED");
  const school = actor.school || "Rizal National High School";

  const rawStudents = isAdmin
    ? (AUTH.users || []).filter(u => u.role === "student" && u.status === "active")
    : (typeof AUTH.getTeacherStudents === "function" ? AUTH.getTeacherStudents(actor.shareCode) : []);

  const students = rawStudents.map((s, idx) => {
    const isAssessed = s.lvl !== null && s.lvl !== undefined;
    const lvlText = isAssessed ? (PHIL_IRI_LEVELS[s.lvl] || `Level ${s.lvl}`) : "Not assessed";
    const wpmText = s.wpm ? `${s.wpm} WPM` : "Not assessed";
    const compText = (s.comp !== null && s.comp !== undefined) ? `${s.comp}%` : "Not assessed";
    const wordsRead = s.wordsRead || 0;

    let status = "On Track";
    if (!isAssessed) {
      status = "Placement Required";
    } else if (s.lvl === 0 || (typeof s.comp === "number" && s.comp < 60)) {
      status = "Needs Intervention";
    }

    let tierIndex = 0;
    let tierName = "Easy (Madali)";
    if (typeof journeyUnlockedTier === "function" && typeof journeyValid === "function") {
      const j = journeyValid(s.journey) ? s.journey : (typeof journeyEmpty === "function" ? journeyEmpty(s.lvl) : null);
      if (j) {
        tierIndex = journeyUnlockedTier(j, s.journeyOverride);
        tierName = DIFF_NAMES[DIFF_KEYS[tierIndex]] || "Easy";
      }
    }

    return {
      index: idx + 1,
      id: s.id,
      name: s.name,
      isAssessed,
      lvl: s.lvl,
      profileLabel: lvlText,
      wpm: s.wpm,
      wpmText,
      comp: s.comp,
      compText,
      wordsRead,
      tierIndex,
      tierName,
      status,
      journeyOverride: s.journeyOverride,
      journey: s.journey
    };
  });

  const total = students.length;
  const assessed = students.filter(s => s.isAssessed).length;
  const unassessed = total - assessed;
  const coveragePct = total > 0 ? Math.round((assessed / total) * 100) : 0;

  const levelCounts = [0, 0, 0, 0];
  students.forEach(s => {
    if (s.isAssessed && s.lvl >= 0 && s.lvl <= 3) {
      levelCounts[s.lvl]++;
    }
  });

  const totalWords = students.reduce((sum, s) => sum + s.wordsRead, 0);

  return {
    actor,
    isAdmin,
    section,
    classroomCode,
    school,
    students,
    total,
    assessed,
    unassessed,
    coveragePct,
    levelCounts,
    totalWords,
    timestamp: new Date().toISOString()
  };
}

let CURRENT_REPORT_MODAL_SOURCE = "live";

function openForm14Modal(source = "live") {
  requireReportAccess();
  CURRENT_REPORT_MODAL_SOURCE = source;
  const md = $("#md");
  if (!md) return;

  const dataset = getClassroomReportDataset();
  const useLive = (source === "live");

  if (useLive && dataset && dataset.total > 0) {
    const rows = dataset.students.map(st => `
      <tr>
        <td>${st.index}</td>
        <td><b>${escapeHTML(st.name)}</b></td>
        <td><span class="level-badge ${st.isAssessed ? `level-${st.lvl}` : 'level-none'}">${escapeHTML(st.profileLabel)}</span></td>
        <td>${escapeHTML(st.wpmText)}</td>
        <td><b>${escapeHTML(st.compText)}</b></td>
        <td>${st.wordsRead.toLocaleString()}</td>
        <td>
          <span class="pill ${st.status === 'Needs Intervention' ? 'coral' : st.status === 'On Track' ? 'ok' : ''}">
            ${escapeHTML(st.status)}
          </span>
        </td>
      </tr>
    `).join("");

    md.innerHTML = `
      <div class="sheet">
        <div class="row">
          <div>
            <h2 id="live-report-title">BasaWisyo Classroom Reading Progress Report</h2>
            <div class="sub-sm">${escapeHTML(dataset.section)} · ${escapeHTML(dataset.school)} · ${dataset.total} Enrolled Students</div>
          </div>
          <button class="icon-btn noprint" data-a="modal-close" aria-label="Close report">✕</button>
        </div>

        <p class="sub">
          Formative reading progress and diagnostic placement records for connected students. Provisional data saved in this browser.
        </p>

        <div role="region" aria-label="Classroom report table" tabindex="0"
          style="max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:8px">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Learner Name</th>
                <th>Reading Level</th>
                <th>Speed</th>
                <th>Comprehension</th>
                <th>Words Read</th>
                <th>Intervention Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="btn-row noprint" style="margin-top:14px">
          <button class="btn blue" data-a="download-csv" data-v="live">${uiIcon("download")} Download Live CSV</button>
          <button class="btn o" data-a="print-sheet">${uiIcon("print")} Print Report</button>
          <button class="btn o" data-a="modal-close">Close</button>
        </div>
      </div>
    `;
  } else if (useLive) {
    const sec = dataset ? dataset.section : "Classroom";
    const code = dataset ? dataset.classroomCode : "UNASSIGNED";
    md.innerHTML = `
      <div class="sheet">
        <div class="row">
          <div>
            <h2 id="live-report-title">BasaWisyo Classroom Reading Progress Report</h2>
            <div class="sub-sm">${escapeHTML(sec)} · 0 Enrolled Students</div>
          </div>
          <button class="icon-btn noprint" data-a="modal-close" aria-label="Close report">✕</button>
        </div>
        <p class="sub">
          Formative reading progress and diagnostic placement records for connected students.
        </p>
        <div class="card" style="text-align:center;padding:32px 16px;margin:16px 0">
          <h3>No student results available yet</h3>
          <p class="sub" style="margin-top:6px">
            No student accounts are currently enrolled in this classroom (${escapeHTML(code)}). Once students connect with your share code and complete their diagnostic placement, their verified reading records will appear here.
          </p>
        </div>
        <div class="btn-row noprint" style="margin-top:14px">
          <button class="btn o" data-a="download-csv" data-v="live">${uiIcon("download")} Download Empty CSV</button>
          <button class="btn o" data-a="modal-close">Close</button>
        </div>
      </div>
    `;
  } else {
    // Sample / Demo Form 14 Layout (Fallback or explicit sample preview)
    const rows = CLASS_ROSTER.map((st, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${st.n}</b></td>
        <td>${PHIL_IRI_LEVELS[st.l]}</td>
        <td>${st.wpm} WPM</td>
        <td>${st.comp}%</td>
        <td>${st.weak}</td>
      </tr>
    `).join("");

    md.innerHTML = `
      <div class="sheet">
        <div class="row">
          <div>
            <h2 id="sample-report-title">Sample Form 14 Layout</h2>
            <div class="sub-sm">Demo Class 8-A · Not for official submission</div>
          </div>
          <button class="icon-btn noprint" data-a="modal-close" aria-label="Close sample report">✕</button>
        </div>

        <p class="sub">
          This layout uses sample learner data. It is not a validated assessment or official submission form.
        </p>

        <div role="region" aria-label="Sample report table" tabindex="0"
          style="max-height:360px;overflow:auto;border:1px solid var(--border);border-radius:8px">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Learner Name</th>
                <th>Reading Level</th>
                <th>Speed</th>
                <th>Comprehension</th>
                <th>Focus Area</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="btn-row noprint" style="margin-top:14px">
          <button class="btn blue" data-a="download-csv" data-v="sample">${uiIcon("download")} Download Sample CSV</button>
          <button class="btn o" data-a="print-sheet">${uiIcon("print")} Print Sample Layout</button>
          <button class="btn o" data-a="modal-close">Close</button>
        </div>
      </div>
    `;
  }

  md.hidden = false;
  md.querySelector?.('[data-a="modal-close"]')?.focus?.();
}

function closeReportModal() {
  const md = $("#md");
  if (!md || md.hidden) return;
  md.hidden = true;
  $('#v [data-a="open-report-sheet"]')?.focus?.();
}

function downloadCSV(source = CURRENT_REPORT_MODAL_SOURCE) {
  requireReportAccess();
  const dataset = getClassroomReportDataset();
  const useLive = (source === "live");

  let csv = "";
  let filename = "BasaWisyo_Reading_Report.csv";

  if (useLive) {
    csv = "No.,Student Name,Reading Profile,Reading Speed,Comprehension %,Words Read,Status / Intervention\n";
    if (dataset && dataset.students.length > 0) {
      dataset.students.forEach(st => {
        const escapedName = `"${st.name.replace(/"/g, '""')}"`;
        csv += `${st.index},${escapedName},${st.profileLabel},${st.wpmText},${st.compText},${st.wordsRead},${st.status}\n`;
      });
    }
    const secName = (dataset && dataset.section) ? dataset.section.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Class';
    filename = `BasaWisyo_Reading_Report_${secName}.csv`;
  } else {
    csv = "No.,Sample Learner Name,Demo Reading Level,Demo Words Per Minute,Demo Comprehension %,Sample Focus Gap\n";
    CLASS_ROSTER.forEach((st, i) => {
      csv += `${i + 1},"${st.n}",${PHIL_IRI_LEVELS[st.l]},${st.wpm},${st.comp}%,${st.weak}\n`;
    });
    filename = "BasaWisyo_Sample_Form14_Class8A.csv";
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(useLive ? "Classroom reading report CSV downloaded." : "Sample CSV file downloaded.");
}

function printReportSheet() {
  requireReportAccess();
  if ($("#md")?.hidden !== false) throw new Error("Open the report before printing.");
  window.print();
}


/* === src/services/backup.js === */
const BACKUP_FORMAT = "BasaWisyoBackup";
const BACKUP_VERSION = 1;
const STATE_KEY = "basa_wisyo_state_v2";

function backupIsObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function backupRequire(condition, message) {
  if (!condition) throw new Error(message);
}

function backupText(value, label) {
  backupRequire(typeof value === "string" && value.trim().length > 0, `${label} is missing or invalid.`);
}

function backupUnique(records, label, key) {
  const seen = new Set();
  for (const record of records) {
    const value = key(record);
    backupRequire(!seen.has(value), `${label} contains duplicate entries.`);
    seen.add(value);
  }
}

function validateBackupState(raw) {
  backupRequire(backupIsObject(raw), "systemState must be an object.");
  const defaults = createInitialState();
  const allowed = new Set([...Object.keys(defaults), "guestToken"]);
  for (const key of Object.keys(raw)) {
    backupRequire(allowed.has(key), `Unsupported systemState field: ${key}.`);
  }
  const state = { ...defaults, ...raw };
  for (const key of ["lvl", "l0"]) {
    backupRequire(state[key] === null || (Number.isInteger(state[key]) && state[key] >= 0 && state[key] <= 3),
      `systemState.${key} must be a reading level or null.`);
  }
  for (const key of ["w", "ss", "sub", "pay", "pm"]) {
    backupRequire(typeof state[key] === "number" && Number.isFinite(state[key]) && state[key] >= 0,
      `systemState.${key} must be a nonnegative number.`);
  }
  backupRequire(Array.isArray(state.done) && state.done.every(id => typeof id === "string"),
    "systemState.done must be a list of passage IDs.");
  backupUnique(state.done, "systemState.done", id => id);
  backupRequire(journeyValid(state.guestJourney), "systemState.guestJourney is invalid.");
  backupRequire(backupIsObject(state.sk), "systemState.sk must be an object.");
  for (const counts of Object.values(state.sk)) {
    backupRequire(Array.isArray(counts) && counts.length === 2
      && counts.every(Number.isInteger) && counts[0] >= 0 && counts[1] >= counts[0],
    "systemState.sk contains invalid skill counts.");
  }
  backupRequire(Array.isArray(state.sh), "systemState.sh must be a list of passages.");
  state.sh.forEach(normalizePassage);
  backupUnique(state.sh, "systemState.sh", passage => passage.id);
  backupRequire(state.miss === null || backupIsObject(state.miss),
    "systemState.miss must be an object or null.");
  backupRequire(state.theme === "light" || state.theme === "dark", "systemState.theme is invalid.");
  backupRequire(typeof state.fontScale === "number" && Number.isFinite(state.fontScale)
    && state.fontScale >= 0.5 && state.fontScale <= 3, "systemState.fontScale is invalid.");
  backupRequire(state.activeDiff === "all" || DIFF_KEYS.includes(state.activeDiff),
    "systemState.activeDiff is invalid.");
  if (state.guestToken !== undefined) backupText(state.guestToken, "systemState.guestToken");
  return state;
}

function validateBackup(raw) {
  backupRequire(backupIsObject(raw), "Backup must be a JSON object.");
  const isLegacy = raw.format === undefined && raw.version === undefined;
  if (isLegacy) {
    backupRequire(typeof raw.exportDate === "string", "Unsupported backup format.");
  } else {
    backupRequire(raw.format === BACKUP_FORMAT, "Unsupported backup format.");
    backupRequire(raw.version === BACKUP_VERSION,
      `Unsupported backup version: ${String(raw.version)}.`);
  }
  backupRequire(typeof raw.exportDate === "string" && Number.isFinite(Date.parse(raw.exportDate)),
    "Backup export date is invalid.");
  backupText(raw.school, "School");

  backupRequire(Array.isArray(raw.users), "users must be an array.");
  for (const user of raw.users) {
    backupRequire(backupIsObject(user), "users contains an invalid record.");
    for (const field of ["id", "email", "name", "role"]) {
      backupText(user[field], `User ${field}`);
    }
    const hasPassword = (typeof user.password === "string" && user.password.trim().length > 0)
      || (typeof user.passwordHash === "string" && user.passwordHash.trim().length > 0);
    backupRequire(hasPassword, "User password is missing or invalid.");
    backupRequire(["student", "teacher", "admin"].includes(user.role), "User role is invalid.");
    backupRequire(user.status === undefined || ["active", "suspended"].includes(user.status),
      "User status is invalid.");
    backupRequire(user.journey === undefined || journeyValid(user.journey), "User journey is invalid.");
    backupRequire(user.journeyOverride === undefined || user.journeyOverride === null
      || (Number.isInteger(user.journeyOverride) && user.journeyOverride >= 0 && user.journeyOverride < DIFF_KEYS.length),
      "User journey override is invalid.");
  }
  backupUnique(raw.users, "users", user => user.id);
  backupUnique(raw.users, "users email", user => user.email.trim().toLowerCase());

  backupRequire(Array.isArray(raw.assignments), "assignments must be an array.");
  for (const assignment of raw.assignments) {
    backupRequire(backupIsObject(assignment), "assignments contains an invalid record.");
    for (const field of ["id", "teacherCode", "passageId", "title"]) {
      backupText(assignment[field], `Assignment ${field}`);
    }
  }
  backupUnique(raw.assignments, "assignments", assignment => assignment.id);

  backupRequire(backupIsObject(raw.guestTokens), "guestTokens must be an object.");
  for (const [token, data] of Object.entries(raw.guestTokens)) {
    backupText(token, "Guest token");
    backupRequire(backupIsObject(data), `Guest token ${token} is invalid.`);
  }

  backupRequire(Array.isArray(raw.customPassages), "customPassages must be an array.");
  raw.customPassages.forEach(normalizePassage);
  backupUnique(raw.customPassages, "customPassages", passage => passage.id);
  const systemState = validateBackupState(raw.systemState);

  if (raw.flashcardDecks !== undefined) {
    backupRequire(backupIsObject(raw.flashcardDecks), "flashcardDecks must be an object.");
  }
  if (raw.materials !== undefined) {
    backupRequire(Array.isArray(raw.materials), "materials must be an array.");
  }
  if (raw.userStates !== undefined) {
    backupRequire(backupIsObject(raw.userStates), "userStates must be an object.");
  }

  return {
    users: raw.users,
    assignments: raw.assignments,
    guestTokens: raw.guestTokens,
    customPassages: raw.customPassages,
    systemState,
    flashcardDecks: raw.flashcardDecks || {},
    materials: raw.materials || [],
    userStates: raw.userStates || {}
  };
}

function createBackupPayload() {
  const flashcardDecks = {};
  const userStates = {};
  try {
    if (typeof localStorage !== "undefined") {
      for (const k of ["basawisyo_flashcards_v1_guest", "basa_wisyo_flashcards_guest", "basa_wisyo_state_guest"]) {
        const val = localStorage.getItem(k);
        if (val) {
          if (k.includes("flashcards")) flashcardDecks[k] = JSON.parse(val);
          if (k.includes("state")) userStates[k] = JSON.parse(val);
        }
      }
      for (const u of AUTH.users) {
        const fcKeys = [`basawisyo_flashcards_v1_${u.id}`, `basa_wisyo_flashcards_${u.id}`];
        for (const fcKey of fcKeys) {
          const fcVal = localStorage.getItem(fcKey);
          if (fcVal) flashcardDecks[fcKey] = JSON.parse(fcVal);
        }
        const stKey = `basa_wisyo_state_${u.id}`;
        const stVal = localStorage.getItem(stKey);
        if (stVal) userStates[stKey] = JSON.parse(stVal);
      }
    }
  } catch (e) {}

  const materials = typeof readLocalMaterials === "function" ? readLocalMaterials() : [];

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    school: "Rizal National High School",
    users: AUTH.users,
    assignments: AUTH.assignments,
    guestTokens: AUTH.guestTokens,
    customPassages: AUTH.customPassages,
    systemState: S,
    flashcardDecks,
    materials,
    userStates
  };
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(createBackupPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BasaWisyo_Backup_${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function restoreBackupFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("File is not valid JSON.");
  }
  const data = validateBackup(parsed);
  if (!confirm("Restore this backup? It will replace current local accounts, assignments, passages, and progress, then sign you out.")) {
    return false;
  }

  const keys = [AUTH.USERS_KEY, AUTH.ASSIGNMENTS_KEY, AUTH.GUEST_TOKENS_KEY,
    AUTH.CUSTOM_PASSAGES_KEY, STATE_KEY, AUTH.SESSION_KEY];

  const replacements = new Map([
    [AUTH.USERS_KEY, JSON.stringify(data.users)],
    [AUTH.ASSIGNMENTS_KEY, JSON.stringify(data.assignments)],
    [AUTH.GUEST_TOKENS_KEY, JSON.stringify(data.guestTokens)],
    [AUTH.CUSTOM_PASSAGES_KEY, JSON.stringify(data.customPassages)],
    [STATE_KEY, JSON.stringify(data.systemState)]
  ]);

  if (data.flashcardDecks && typeof data.flashcardDecks === "object") {
    for (const [k, deck] of Object.entries(data.flashcardDecks)) {
      keys.push(k);
      replacements.set(k, JSON.stringify(deck));
    }
  }

  if (Array.isArray(data.materials) && data.materials.length > 0) {
    keys.push("basa_wisyo_materials_v1");
    replacements.set("basa_wisyo_materials_v1", JSON.stringify(data.materials));
  }

  if (data.userStates && typeof data.userStates === "object") {
    for (const [k, st] of Object.entries(data.userStates)) {
      keys.push(k);
      replacements.set(k, JSON.stringify(st));
    }
  }

  const previous = new Map(keys.map(key => [key, localStorage.getItem(key)]));

  try {
    for (const [key, value] of replacements) localStorage.setItem(key, value);
    localStorage.removeItem(AUTH.SESSION_KEY);
  } catch (error) {
    try {
      for (const key of keys) localStorage.removeItem(key);
      for (const [key, value] of previous) {
        if (value !== null) localStorage.setItem(key, value);
      }
    } catch (rollbackError) {
      throw new Error("Restore failed and local storage could not be fully rolled back. Do not reload this page; export the current data for recovery.");
    }
    throw new Error("Restore failed while writing local storage. Previous data was restored.");
  }

  AUTH.users = data.users;
  AUTH.assignments = data.assignments;
  AUTH.guestTokens = data.guestTokens;
  AUTH.customPassages = data.customPassages;
  AUTH.currentUser = null;
  S = data.systemState;
  GUEST_MODE = false;
  ACTIVE_QUIZ = null;
  CURRENT_TAB = "home";
  SEARCH_QUERY = "";
  return true;
}


/* === src/services/local-data.js === */
/* Localhost relational copy. Browser storage remains available when the server is offline. */
const LOCAL_DATA = {
  timer: null,
  busy: false,
  pending: false,
  available: false,
  lastSyncedAt: null,
  syncError: null,

  async snapshot() {
    const backup = createBackupPayload();
    const states = { ...backup.userStates };
    if (AUTH.currentUser?.role === "student") {
      states[`basa_wisyo_state_${AUTH.currentUser.id}`] = S;
    }
    const materials = new Map([...backup.materials, ...backup.customPassages].map(item => [item.id, item]));
    if (typeof openMaterialsDatabase === "function") {
      try {
        const db = await openMaterialsDatabase();
        if (db) {
          const indexed = await new Promise((resolve, reject) => {
            const request = db.transaction("materials", "readonly").objectStore("materials").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          for (const item of indexed) {
            const prior = materials.get(item.id);
            if (!prior || (item.version || 1) >= (prior.version || 1)) materials.set(item.id, item);
          }
          db.close();
        }
      } catch (error) {
        console.warn("IndexedDB materials will retry on the next sync.", error);
      }
    }
    return {
      users: backup.users.map(({ password, ...user }) => user),
      userStates: states,
      assignments: backup.assignments,
      materials: [...materials.values()]
    };
  },

  queue() {
    if (location.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(location.hostname)) return;
    this.pending = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  },

  async flush() {
    if (!this.pending || this.busy) return;
    this.pending = false;
    this.busy = true;
    try {
      const response = await fetch("/api/data/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await this.snapshot())
      });
      if (!response.ok) throw new Error(`Local data sync failed (${response.status}).`);
      this.available = true;
      this.lastSyncedAt = Date.now();
      this.syncError = null;
    } catch (error) {
      this.available = false;
      this.syncError = error.message;
      this.pending = true;
      console.warn(error.message);
    } finally {
      this.busy = false;
      if (this.pending && this.available) this.queue();
    }
  },

  getSyncStatus() {
    if (this.busy) {
      return { status: "syncing", label: "Syncing changes with school server…" };
    }
    if (this.available && !this.pending) {
      return { status: "synced", label: "Synchronized with school server", lastSyncedAt: this.lastSyncedAt };
    }
    if (!this.available) {
      return { status: "offline", label: "Offline mode — changes saved locally on this device", lastSyncedAt: this.lastSyncedAt, error: this.syncError };
    }
    return { status: "pending", label: "Pending sync to school server…" };
  },

  start() {
    if (location.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(location.hostname)) return;
    this.queue();
    setInterval(() => this.queue(), 10000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.queue();
    });
  }
};


/* === src/services/import-reader.js === */
/* ==========================================================================
   BasaWisyo Shared Reading Material Import Engine
   Supports PDF, DOCX, TXT files and pasted text with text normalization
   ========================================================================== */

const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit as per spec
const ALLOWED_IMPORT_EXTENSIONS = [".txt", ".docx", ".pdf"];
const MIN_READABLE_WORDS = 20;

/**
 * Validates selected file for import: size, extension, and empty file check.
 * @param {File} file 
 * @returns {{ valid: boolean, error?: string, extension?: string }}
 */
function validateImportFile(file) {
  if (!file) {
    return { valid: false, error: "No file selected. Please choose a PDF, DOCX, or TXT file." };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 bytes). Please select a valid document." };
  }

  if (file.size > MAX_IMPORT_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return { 
      valid: false, 
      error: `File is too large (${sizeMb} MB). Maximum supported size is 10 MB.` 
    };
  }

  const name = file.name || "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1) {
    return { valid: false, error: "File lacks an extension. Supported formats are .txt, .docx, and .pdf." };
  }

  const ext = name.slice(lastDot).toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext)) {
    return { 
      valid: false, 
      error: `Unsupported file format (${ext}). Supported formats: PDF (.pdf), Word (.docx), or Text (.txt).` 
    };
  }

  return { valid: true, extension: ext };
}

/**
 * Normalizes imported or pasted text, cleaning whitespace and computing readability stats.
 * @param {string} rawText 
 * @returns {{ text: string, wordCount: number, charCount: number, estMinutes: number, cleanTitle: string, suggestedTier: string }}
 */
function normalizeImportedText(rawText) {
  if (typeof rawText !== "string") return { text: "", wordCount: 0, charCount: 0, estMinutes: 0, cleanTitle: "Untitled Story", suggestedTier: "easy" };

  // Strip unprintable control characters except standard whitespace
  let clean = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Collapse 3 or more consecutive newlines to double newlines
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = clean.length;
  const estMinutes = Math.max(1, Math.ceil(wordCount / 120)); // ~120 WPM for Grade 7-10 Filipino learners

  // Derive initial title from first line if reasonably short, otherwise first few words
  let cleanTitle = "Imported Reading Passage";
  const firstLine = clean.split("\n")[0]?.trim();
  if (firstLine && firstLine.length <= 80 && !firstLine.endsWith(".")) {
    cleanTitle = firstLine;
  } else if (words.length > 0) {
    cleanTitle = words.slice(0, 5).join(" ") + "...";
  }

  // Suggest initial difficulty based on average sentence length
  const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  let suggestedTier = "easy";
  if (avgSentenceLength > 18 || wordCount > 350) suggestedTier = "hard";
  else if (avgSentenceLength > 12 || wordCount > 200) suggestedTier = "medium";

  return {
    text: clean,
    wordCount,
    charCount,
    estMinutes,
    cleanTitle,
    suggestedTier
  };
}

/**
 * Native text extractor from raw DOCX ArrayBuffer (PKZip containing word/document.xml).
 * Works purely in browser and Node.js without heavy external dependencies.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<string>}
 */
async function extractTextFromDocxNative(arrayBuffer) {
  // If Mammoth.js is loaded in the page, prioritize it
  if (typeof window !== "undefined" && window.mammoth && typeof window.mammoth.extractRawText === "function") {
    try {
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      if (result && typeof result.value === "string" && result.value.trim().length > 0) {
        return result.value.trim();
      }
    } catch (e) {
      // Fallback to native byte extraction
    }
  }

  // Native PKZip extraction for word/document.xml
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder("utf-8", { fatal: false });
  const rawString = textDecoder.decode(bytes);

  // Look for XML paragraph and text tags (<w:p>, <w:t>)
  const tMatches = rawString.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  if (tMatches && tMatches.length > 0) {
    const textPieces = tMatches.map(m => {
      return m.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    });
    return textPieces.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  // If compressed deflate streams exist, return what is available or prompt user
  return "";
}

/**
 * Native text extractor from raw PDF ArrayBuffer.
 * Works purely in browser and Node.js with scanned document detection.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {Promise<{ text: string, isScannedOrEmpty: boolean }>}
 */
async function extractTextFromPdfNative(arrayBuffer) {
  // If PDF.js is loaded in the browser, use it for complete text layer extraction
  if (typeof window !== "undefined" && window.pdfjsLib && typeof window.pdfjsLib.getDocument === "function") {
    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map(item => item.str || "");
        fullText += pageStrings.join(" ") + "\n\n";
      }
      const normalized = fullText.trim();
      const wc = normalized.split(/\s+/).filter(Boolean).length;
      return {
        text: normalized,
        isScannedOrEmpty: wc < MIN_READABLE_WORDS
      };
    } catch (e) {
      // Fallback to text operator scanning below
    }
  }

  // Fallback text operator scanner
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder("latin1");
  const rawString = textDecoder.decode(bytes);

  const textSnippets = [];
  // Scan for PDF text operator literals: (text) Tj or [(text)] TJ
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(rawString)) !== null) {
    if (match[1] && match[1].length > 1) {
      textSnippets.push(match[1]);
    }
  }

  // Scan for array text operators
  const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(rawString)) !== null) {
    const inner = match[1];
    const subMatches = inner.match(/\(([^)]+)\)/g);
    if (subMatches) {
      subMatches.forEach(sm => {
        const cleanSm = sm.replace(/^\(/, "").replace(/\)$/, "");
        if (cleanSm.trim()) textSnippets.push(cleanSm);
      });
    }
  }

  const extracted = textSnippets.join(" ").replace(/\\([()\\])/g, "$1").replace(/\s{2,}/g, " ").trim();
  const wc = extracted.split(/\s+/).filter(Boolean).length;

  return {
    text: extracted,
    isScannedOrEmpty: wc < MIN_READABLE_WORDS
  };
}

/**
 * Extracts readable text from an uploaded file (PDF, DOCX, or TXT).
 * @param {File} file 
 * @returns {Promise<{ success: boolean, text: string, error?: string, isScannedOrEmpty?: boolean, stats: ReturnType<typeof normalizeImportedText> }>}
 */
async function extractTextFromFile(file) {
  const validation = validateImportFile(file);
  if (!validation.valid) {
    return {
      success: false,
      text: "",
      error: validation.error,
      stats: normalizeImportedText("")
    };
  }

  const ext = validation.extension;

  try {
    if (ext === ".txt") {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || "");
        reader.onerror = () => reject(new Error("Failed to read text file."));
        reader.readAsText(file, "utf-8");
      });
      const stats = normalizeImportedText(text);
      if (stats.wordCount < MIN_READABLE_WORDS) {
        return {
          success: true,
          text: stats.text,
          isScannedOrEmpty: true,
          error: `The file contains only ${stats.wordCount} words. We recommend at least 20 words for meaningful reading practice.`,
          stats
        };
      }
      return { success: true, text: stats.text, isScannedOrEmpty: false, stats };
    }

    if (ext === ".docx") {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read Word document."));
        reader.readAsArrayBuffer(file);
      });
      const extractedRaw = await extractTextFromDocxNative(buffer);
      const stats = normalizeImportedText(extractedRaw);
      if (stats.wordCount < MIN_READABLE_WORDS) {
        return {
          success: true,
          text: stats.text,
          isScannedOrEmpty: true,
          error: "Little or no readable text could be extracted from this Word document. You can also paste the reading passage directly.",
          stats
        };
      }
      return { success: true, text: stats.text, isScannedOrEmpty: false, stats };
    }

    if (ext === ".pdf") {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read PDF file."));
        reader.readAsArrayBuffer(file);
      });
      const { text, isScannedOrEmpty } = await extractTextFromPdfNative(buffer);
      const stats = normalizeImportedText(text);
      if (isScannedOrEmpty || stats.wordCount < MIN_READABLE_WORDS) {
        return {
          success: true,
          text: stats.text,
          isScannedOrEmpty: true,
          error: "This PDF appears to be a scanned image or contains non-selectable text. Please paste the reading text directly into the text box below.",
          stats
        };
      }
      return { success: true, text: stats.text, isScannedOrEmpty: false, stats };
    }

    return {
      success: false,
      text: "",
      error: "Unsupported file extension.",
      stats: normalizeImportedText("")
    };
  } catch (error) {
    return {
      success: false,
      text: "",
      error: error.message || "An unexpected error occurred while reading the file.",
      stats: normalizeImportedText("")
    };
  }
}


/* === src/services/material-storage.js === */
/* ==========================================================================
   BasaWisyo Material Storage Service
   Local-first IndexedDB storage with localStorage fallback and permission namespaces
   ========================================================================== */

const MATERIAL_STORAGE_KEY = "basa_wisyo_materials_v1";
const DB_NAME = "BasaWisyoMaterialsDB";
const DB_VERSION = 1;
const STORE_NAME = "materials";

/**
 * Returns current actor context (user or guest)
 * @returns {{ id: string, role: string, name: string }}
 */
function getStorageActor() {
  if (typeof AUTH !== "undefined" && AUTH.currentUser) {
    return {
      id: AUTH.currentUser.id,
      role: AUTH.currentUser.role,
      name: AUTH.currentUser.name || "User"
    };
  }
  return {
    id: typeof S !== "undefined" && S.guestToken ? `guest_${S.guestToken}` : "guest",
    role: "guest",
    name: "Guest Explorer"
  };
}

/**
 * Reads all materials from localStorage fallback
 * @returns {Array}
 */
function readLocalMaterials() {
  try {
    const raw = localStorage.getItem(MATERIAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Writes materials array to localStorage fallback
 * @param {Array} materials 
 */
function writeLocalMaterials(materials) {
  try {
    localStorage.setItem(MATERIAL_STORAGE_KEY, JSON.stringify(materials));
  } catch (e) {
    console.warn("Storage quota exceeded in localStorage fallback.");
  }
}

/**
 * Opens or accesses the browser's IndexedDB database
 * @returns {Promise<IDBDatabase|null>}
 */
function openMaterialsDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("ownerId", "ownerId", { unique: false });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("visibility", "visibility", { unique: false });
        }
      };
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Persists a material object to local-first storage.
 * @param {Object} material 
 * @param {Object} [actor] 
 * @returns {Promise<Object>}
 */
async function saveMaterial(material, actor = getStorageActor()) {
  if (!material || typeof material !== "object") {
    throw new Error("Invalid material object.");
  }

  const isStudentOrGuest = actor.role === "student" || actor.role === "guest";
  const now = Date.now();

  const id = material.id || `mat_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const title = (material.title || "Untitled Reading Material").trim();
  const text = (material.text || "").trim();

  if (!text) {
    throw new Error("Material must contain passage text.");
  }

  // Enforce role-based status and visibility
  let status = material.status || (isStudentOrGuest ? "personal" : "draft");
  if (isStudentOrGuest) {
    // Students can NEVER save materials as approved or published
    status = "personal";
  }

  let visibility = material.visibility || (isStudentOrGuest ? "private" : "private");
  if (isStudentOrGuest) {
    visibility = "private";
  }

  const existing = await getMaterialById(id, actor);

  if (isStudentOrGuest && !existing) {
    const isPrem = typeof isUserPremium === "function" && isUserPremium();
    if (!isPrem) {
      const existingPersonal = (await listMaterials(actor)).filter(m => m.ownerId === actor.id && m.status === "personal");
      if (existingPersonal.length >= 2) {
        if (typeof openUpgradeModal === "function") {
          openUpgradeModal("imports", `You have reached the free personal import limit (2 stories). Upgrade to Wisyo Plus for expanded reading material imports!`);
        }
        throw new Error("Free personal story import limit (2) reached. Upgrade to Wisyo Plus for expanded imports!");
      }
    }
  }

  let version = existing ? (existing.version || 1) : 1;
  if (existing && (existing.status === "approved" || existing.status === "published") && actor.role === "teacher") {
    // Editing an approved or published material increments version and resets to draft
    version += 1;
    status = "draft";
  }

  const normalized = {
    id,
    ownerId: existing ? existing.ownerId : actor.id,
    ownerRole: existing ? existing.ownerRole : actor.role,
    ownerName: existing ? existing.ownerName : actor.name,
    title,
    author: (material.author || "Imported Material").trim(),
    sourceType: material.sourceType || "paste",
    language: ["en", "fil", "ceb"].includes(material.language) ? material.language : "en",
    text,
    wordCount: typeof wordCount === "function" ? wordCount(text) : text.split(/\s+/).filter(Boolean).length,
    difficulty: ["easy", "medium", "hard"].includes(material.difficulty) ? material.difficulty : "medium",
    status,
    visibility,
    version,
    questions: Array.isArray(material.questions) ? material.questions : [],
    vocabulary: Array.isArray(material.vocabulary) ? material.vocabulary : [],
    reviewNote: material.reviewNote || "",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };

  // 1. Try IndexedDB
  const db = await openMaterialsDatabase();
  if (db) {
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(normalized);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      } catch (err) {
        resolve(false);
      }
    });
  }

  // 2. Always mirror to localStorage fallback for immediate synchronous retrieval & export safety
  const all = readLocalMaterials();
  const idx = all.findIndex(m => m.id === id);
  if (idx >= 0) all[idx] = normalized;
  else all.unshift(normalized);
  writeLocalMaterials(all);

  return normalized;
}

/**
 * Retrieves a material by ID, enforcing role-based privacy.
 * @param {string} id 
 * @param {Object} [actor] 
 * @returns {Promise<Object|null>}
 */
async function getMaterialById(id, actor = getStorageActor()) {
  if (!id) return null;

  let item = null;

  // 1. Try IndexedDB
  const db = await openMaterialsDatabase();
  if (db) {
    item = await new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // 2. Check localStorage fallback if not found in IndexedDB
  if (!item) {
    const all = readLocalMaterials();
    item = all.find(m => m.id === id) || null;
  }

  if (!item) return null;

  // Role privacy check:
  // - Students/guests cannot see another user's private/personal materials
  if (item.visibility === "private" && item.ownerId !== actor.id && actor.role !== "admin") {
    return null;
  }

  return item;
}

/**
 * Lists materials owned by the current actor, or published materials.
 * @param {Object} [actor] 
 * @returns {Promise<Array>}
 */
async function listMaterials(actor = getStorageActor()) {
  let items = [];

  const db = await openMaterialsDatabase();
  if (db) {
    items = await new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  if (!items || items.length === 0) {
    items = readLocalMaterials();
  }

  // Filter based on actor permissions:
  // - Admin sees all
  // - Teacher sees their own drafts/materials + approved/published materials
  // - Student/guest sees their own personal materials + approved/published materials
  if (actor.role === "admin") {
    return items;
  }

  return items.filter(m => {
    if (m.ownerId === actor.id) return true;
    if (m.status === "published" || m.status === "approved") return true;
    return false;
  });
}

/**
 * Deletes a material if the actor is authorized.
 * @param {string} id 
 * @param {Object} [actor] 
 * @returns {Promise<boolean>}
 */
async function deleteMaterial(id, actor = getStorageActor()) {
  const item = await getMaterialById(id, actor);
  if (!item) {
    throw new Error("Material not found.");
  }

  // Authorization: Owner or Admin
  if (item.ownerId !== actor.id && actor.role !== "admin") {
    throw new Error("You do not have permission to delete this material.");
  }

  // Teacher cannot delete approved or published materials directly if students are reading them
  if (actor.role === "teacher" && (item.status === "approved" || item.status === "published")) {
    throw new Error("Cannot delete approved or published materials. You can archive or withdraw them to draft instead.");
  }

  // 1. Remove from IndexedDB
  const db = await openMaterialsDatabase();
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // 2. Remove from localStorage
  const all = readLocalMaterials().filter(m => m.id !== id);
  writeLocalMaterials(all);

  return true;
}

/**
 * Updates the approval lifecycle status (Draft -> Pending -> Approved -> Published).
 * @param {string} id 
 * @param {string} newStatus 
 * @param {string} [reviewNote] 
 * @param {Object} [actor] 
 * @returns {Promise<Object>}
 */
async function updateMaterialStatus(id, newStatus, reviewNote = "", actor = getStorageActor()) {
  const item = await getMaterialById(id, actor);
  if (!item) {
    throw new Error("Material not found.");
  }

  const validStatuses = ["personal", "draft", "pending", "approved", "published", "rejected"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  // Permissions:
  // - Students can ONLY have "personal"
  if (actor.role === "student" || actor.role === "guest") {
    throw new Error("Students cannot change publication or approval statuses.");
  }

  // - Teachers can submit their drafts to "pending" or withdraw to "draft"
  if (actor.role === "teacher") {
    if (newStatus === "approved" || newStatus === "published") {
      throw new Error("Teachers cannot self-approve materials. Please submit for Admin Review.");
    }
    if (item.ownerId !== actor.id) {
      throw new Error("Teachers can only update their own materials.");
    }
  }

  // - Admins can approve, publish, reject
  item.status = newStatus;
  if (reviewNote) item.reviewNote = reviewNote;
  item.updatedAt = Date.now();

  return await saveMaterial(item, actor);
}

/**
 * Exports a material as a portable versioned JSON content package.
 * @param {string} id 
 * @param {Object} [actor] 
 * @returns {Promise<string>}
 */
async function exportMaterialPackage(id, actor = getStorageActor()) {
  const item = await getMaterialById(id, actor);
  if (!item) {
    throw new Error("Material not found for export.");
  }

  const pkg = {
    schemaVersion: "basa_wisyo_material_v1",
    exportedAt: Date.now(),
    exportedBy: actor.name,
    material: {
      id: item.id,
      title: item.title,
      author: item.author,
      language: item.language,
      difficulty: item.difficulty,
      sourceType: item.sourceType,
      text: item.text,
      version: item.version,
      questions: item.questions,
      vocabulary: item.vocabulary
    }
  };

  return JSON.stringify(pkg, null, 2);
}

/**
 * Imports a versioned JSON content package into local storage.
 * @param {string|Object} packageData 
 * @param {Object} [actor] 
 * @returns {Promise<Object>}
 */
async function importMaterialPackage(packageData, actor = getStorageActor()) {
  let pkg = packageData;
  if (typeof pkg === "string") {
    try {
      pkg = JSON.parse(packageData);
    } catch (e) {
      throw new Error("Invalid content package: JSON parsing failed.");
    }
  }

  if (!pkg || pkg.schemaVersion !== "basa_wisyo_material_v1" || !pkg.material) {
    throw new Error("Unsupported content package format or missing material data.");
  }

  const m = pkg.material;
  if (!m.text || !m.title) {
    throw new Error("Corrupted package: Missing title or passage text.");
  }

  // If importing as student, store as personal
  const isStudent = actor.role === "student" || actor.role === "guest";
  const newMaterial = {
    id: `mat_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: m.title,
    author: m.author || "Imported Package",
    language: m.language || "en",
    difficulty: m.difficulty || "medium",
    sourceType: m.sourceType || "package",
    text: m.text,
    version: 1,
    status: isStudent ? "personal" : "draft",
    visibility: "private",
    questions: Array.isArray(m.questions) ? m.questions : [],
    vocabulary: Array.isArray(m.vocabulary) ? m.vocabulary : []
  };

  return await saveMaterial(newMaterial, actor);
}


/* === src/services/ai-question-generator.js === */
/* ==========================================================================
   BasaWisyo Wisyo AI Question & Vocabulary Generator
   Generates multi-skill comprehension questions and trilingual vocabulary flashcards
   with strict schema validation, online Groq support, and robust offline fallback.
   ========================================================================== */

const GENERATION_SKILLS = ["Literal", "Inference", "Main idea", "Vocabulary", "Sequencing"];

/**
 * Validates a single question against strict schema requirements.
 * @param {Object} q 
 * @returns {boolean}
 */
function validateGeneratedQuestion(q) {
  if (!q || typeof q !== "object" || Array.isArray(q)) return false;
  if (typeof q.q !== "string" || !q.q.trim()) return false;
  if (!Array.isArray(q.o) || q.o.length !== 4) return false;
  
  // All options must be non-empty strings
  if (!q.o.every(opt => typeof opt === "string" && opt.trim().length > 0)) return false;

  // Options must be distinct
  const uniqueOpts = new Set(q.o.map(opt => opt.trim().toLowerCase()));
  if (uniqueOpts.size !== 4) return false;

  // Correct answer index must be 0, 1, 2, or 3
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) return false;

  // Must have text evidence explanation
  if (typeof q.exp !== "string" || q.exp.trim().length < 5) return false;

  return true;
}

/**
 * Validates a vocabulary item against schema requirements.
 * @param {Object} v 
 * @returns {boolean}
 */
function validateGeneratedVocabulary(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  if (typeof v.word !== "string" || !v.word.trim()) return false;
  if (typeof v.definition !== "string" || !v.definition.trim()) return false;
  return true;
}

/**
 * Deterministic offline question and vocabulary generator.
 * Synthesizes grounded questions directly from passage sentences.
 * @param {string} passageText 
 * @param {Object} [options]
 * @returns {{ questions: Array, vocabulary: Array }}
 */
function generateOfflineReadingPractice(passageText, {
  count = 5,
  difficulty = "medium",
  language = "en"
} = {}) {
  const clean = (passageText || "").trim();
  if (!clean) return { questions: [], vocabulary: [] };

  const sentences = clean
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const desiredCount = Math.min(Math.max(1, count), 15);
  const questions = [];
  const vocabulary = [];

  // Stop words to exclude from keyword extraction
  const stopWords = new Set([
    "the", "and", "that", "this", "with", "from", "have", "were", "been", "they",
    "their", "what", "when", "where", "which", "will", "would", "could", "should",
    "ang", "mga", "ng", "sa", "ay", "na", "at", "para", "kung", "upang", "nang",
    "ug", "sa", "ang", "mga", "ni", "nga", "aron", "kay", "apan"
  ]);

  // 1. Extract vocabulary items from rich words
  const words = clean
    .split(/\s+/)
    .map(w => w.replace(/[^A-Za-z0-9\u00C0-\u024F]/g, "").toLowerCase())
    .filter(w => w.length >= 6 && !stopWords.has(w));

  const uniqueWords = [...new Set(words)].slice(0, Math.min(6, desiredCount));
  uniqueWords.forEach((word, idx) => {
    // Find context sentence containing the word
    const contextSentence = sentences.find(s => s.toLowerCase().includes(word)) || sentences[0] || clean;
    const capitalized = word.charAt(0).toUpperCase() + word.slice(1);

    // Check trilingual dictionary D if present
    let filipino = "Kahalagahan o salita";
    let bisaya = "Kahulogan o pulong";
    let def = `Key vocabulary term from the reading passage.`;

    if (typeof D !== "undefined" && D && D[word]) {
      const entry = D[word];
      filipino = entry.tl || entry.fil || filipino;
      bisaya = entry.cb || entry.ceb || bisaya;
      def = entry.en || def;
    } else {
      def = `Important descriptive concept in the passage describing ${word}.`;
    }

    vocabulary.push({
      id: `voc_${Date.now()}_${idx}`,
      word: capitalized,
      pos: "noun/verb",
      definition: def,
      filipino,
      bisaya,
      example: contextSentence
    });
  });

  // 2. Synthesize multi-skill questions across available sentences
  const skillsRotation = GENERATION_SKILLS;

  for (let i = 0; i < desiredCount; i++) {
    const skill = skillsRotation[i % skillsRotation.length];
    const sentenceIndex = i % Math.max(1, sentences.length);
    const targetSentence = sentences[sentenceIndex] || clean;

    let qText = "";
    let options = [];
    let correctIdx = (i % 4);
    let explanation = "";

    // Extract significant nouns/phrases from the sentence
    const sentWords = targetSentence.split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w.toLowerCase()));
    const keyTarget = sentWords[0] || "the main event";

    if (skill === "Literal") {
      qText = `According to the passage, what detail is directly stated regarding "${keyTarget}"?`;
      const correctOpt = targetSentence.length > 60 ? targetSentence.slice(0, 60) + "..." : targetSentence;
      options = [
        "It was overlooked and never mentioned in the text.",
        "It caused an unrelated disruption in a different area.",
        correctOpt,
        "It was replaced by a modern synthetic alternative."
      ];
      // Place correct answer at designated index
      options = [
        "It caused an unrelated disruption in a different area.",
        "It was completely disregarded by everyone.",
        "It was replaced by a modern synthetic alternative.",
        "It happened at a completely different time."
      ];
      options[correctIdx] = correctOpt;
      explanation = `The text explicitly states: "${targetSentence}"`;
    } else if (skill === "Inference") {
      qText = `What can the reader reasonably infer from the following statement: "${targetSentence.slice(0, 70)}..."?`;
      const correctOpt = "The situation required careful observation and adaptive resilience.";
      options = [
        "The characters had complete certainty without needing to observe.",
        "The events had no impact on the surrounding environment.",
        "The participants refused to take any protective action.",
        "The situation required careful observation and adaptive resilience."
      ];
      options[3] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `Based on the clues in "${targetSentence}", the reader can deduce that thoughtful adaptation was taking place.`;
    } else if (skill === "Main idea") {
      qText = `What is the central idea highlighted in this part of the reading?`;
      const correctOpt = "Community cooperation and understanding natural connections.";
      options = [
        "An isolated dispute without lasting significance.",
        "Strict compliance with automated digital commands.",
        "Community cooperation and understanding natural connections.",
        "The rapid decline of all traditional community practices."
      ];
      options[2] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `The overall excerpt emphasizes how individuals and elements interact constructively.`;
    } else if (skill === "Vocabulary") {
      const vocabWord = uniqueWords[i % Math.max(1, uniqueWords.length)] || keyTarget;
      qText = `In the context of the passage, what does the word "${vocabWord}" most nearly mean?`;
      const correctOpt = `A meaningful concept related to ${vocabWord} in the narrative.`;
      options = [
        "An accidental error made without intention.",
        `A meaningful concept related to ${vocabWord} in the narrative.`,
        "A sudden cessation of all regular movement.",
        "A completely unrelated external measurement."
      ];
      options[1] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `Context clues surrounding "${vocabWord}" indicate this specific meaning within the passage.`;
    } else { // Sequencing
      qText = `Which event or condition develops in sequence with: "${targetSentence.slice(0, 60)}..."?`;
      const correctOpt = "The subsequent response described immediately following this passage.";
      options = [
        "The final conclusion was reached before anything started.",
        "All preceding preparations were entirely skipped.",
        "The subsequent response described immediately following this passage.",
        "The timeline jumped backward several generations."
      ];
      options[2] = options[correctIdx];
      options[correctIdx] = correctOpt;
      explanation = `Chronological progression in the text places this development in direct relation to earlier occurrences.`;
    }

    // Ensure all 4 options are distinct
    const distinctSet = new Set(options);
    if (distinctSet.size < 4) {
      options[1] = options[1] + " (Variation A)";
      options[2] = options[2] + " (Variation B)";
    }

    questions.push({
      id: `gen_q_${Date.now()}_${i}`,
      q: qText,
      o: options,
      a: correctIdx,
      k: skill,
      exp: explanation
    });
  }

  return { questions, vocabulary };
}

/**
 * Generates reading practice questions and vocabulary items using Wisyo AI.
 * Uses online server endpoint if available, with immediate offline fallback.
 * @param {string} passageText 
 * @param {Object} [config]
 * @returns {Promise<{ questions: Array, vocabulary: Array, isOffline: boolean }>}
 */
async function generateWisyoPractice(passageText, {
  count = 5,
  difficulty = "medium",
  language = "en"
} = {}) {
  const clean = (passageText || "").trim();
  if (!clean) {
    throw new Error("Passage text is required to generate practice items.");
  }

  // 1. Try online generation via local backend /api/chat if online
  if (typeof fetch !== "undefined") {
    try {
      const prompt = `You are Wisyo, an educational reading coach for Filipino learners.
Generate ${count} reading comprehension questions and 5 vocabulary items based strictly on this reading passage:

"""
${clean.slice(0, 4000)}
"""

Target difficulty: ${difficulty}
Language: ${language}
Skills to cover: Literal, Inference, Main idea, Vocabulary, Sequencing.

Respond with ONLY valid JSON with this exact schema:
{
  "questions": [
    {
      "q": "Question prompt text",
      "o": ["Option A", "Option B", "Option C", "Option D"],
      "a": 0,
      "k": "Literal",
      "exp": "Text evidence explanation citing the passage"
    }
  ],
  "vocabulary": [
    {
      "word": "VocabWord",
      "pos": "noun",
      "definition": "Definition in context",
      "filipino": "Filipino translation",
      "bisaya": "Bisaya translation",
      "example": "Example sentence"
    }
  ]
}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: [],
          context: { passage: { title: "Imported Passage", text: clean.slice(0, 3000) } }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || "";
        
        // Extract JSON block from response
        const jsonMatch = replyText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            const validQs = parsed.questions.filter(validateGeneratedQuestion);
            if (validQs.length >= Math.min(count, 3)) {
              return {
                questions: validQs.slice(0, count),
                vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.filter(validateGeneratedVocabulary) : [],
                isOffline: false
              };
            }
          }
        }
      }
    } catch (err) {
      // Gracefully proceed to offline generator
    }
  }

  // 2. Offline fallback generator
  const offlineResult = generateOfflineReadingPractice(clean, { count, difficulty, language });
  return {
    questions: offlineResult.questions,
    vocabulary: offlineResult.vocabulary,
    isOffline: true
  };
}


/* === src/services/assignments.js === */
/* ==========================================================================
   BasaWisyo Teacher Classroom Assignments & Content Packaging Service
   Manages class assignments, due dates, practice vs assessment modes,
   and versioned JSON content export/import packages.
   ========================================================================== */

const ASSIGNMENT_PACKAGE_SCHEMA = "basa_wisyo_assignment_v1";

/**
 * Creates a new classroom assignment from a teacher material.
 * @param {Object} params
 * @param {Object} actor
 * @returns {Promise<Object>}
 */
async function createClassAssignment({
  materialId,
  sectionCode,
  dueDate,
  mode = "practice"
}, actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "teacher_1", role: "teacher", name: "Teacher" }) {
  if (actor.role !== "teacher" && actor.role !== "admin") {
    throw new Error("Only teachers and administrators can create class assignments.");
  }

  const passage = typeof getPublishedPassageById === "function" ? getPublishedPassageById(materialId) : null;
  const mat = passage ? {
    id: passage.id,
    title: passage.t,
    author: passage.author || "BasaWisyo",
    difficulty: passage.diff,
    language: { "en-US": "en", "fil-PH": "fil", "ceb-PH": "ceb" }[passage.lang] || "en",
    text: passage.x,
    questions: passage.qs,
    version: 1
  } : await getMaterialById(materialId, actor);
  if (!mat) {
    throw new Error("Material was not found for assignment.");
  }

  if (!sectionCode || !sectionCode.trim()) {
    throw new Error("Please specify a target class section.");
  }

  if (!dueDate || !String(dueDate).trim()) {
    throw new Error("Please set a valid due date for this assignment.");
  }

  // Prevent duplicate assignment submissions for the same passage, section, and mode
  const currentAssignments = typeof listAssignments === "function" ? listAssignments({ role: actor.role, id: actor.id }) : [];
  const cleanSec = sectionCode.trim().toLowerCase();
  const cleanMode = (mode === "assessment" ? "assessment" : "practice").toLowerCase();
  const isDuplicate = currentAssignments.some(a =>
    a.status === "active" &&
    (a.materialId === mat.id || a.passageId === mat.id) &&
    (a.section || a.targetGroup || "").trim().toLowerCase() === cleanSec &&
    (a.mode || "practice").toLowerCase() === cleanMode
  );
  if (isDuplicate) {
    throw new Error(`An active assignment for "${mat.title}" in section "${sectionCode.trim()}" already exists.`);
  }

  const now = Date.now();
  const assignmentId = `ass_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const assignment = {
    id: assignmentId,
    materialId: mat.id,
    materialTitle: mat.title,
    materialVersion: mat.version || 1,
    passageId: mat.id,
    title: mat.title,
    targetGroup: sectionCode.trim(),
    section: sectionCode.trim(),
    teacherId: actor.id,
    teacherName: actor.name,
    dueDate,
    mode: mode === "assessment" ? "assessment" : "practice",
    status: "active",
    createdAt: now,
    material: {
      id: mat.id,
      title: mat.title,
      author: mat.author,
      diff: mat.difficulty,
      lang: mat.language,
      x: mat.text,
      qs: mat.questions
    }
  };

  // 1. Sync with AUTH.assignments if available
  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments)) {
    AUTH.assignments.unshift(assignment);
    if (typeof AUTH.saveAssignments === "function") AUTH.saveAssignments();
  }

  // 2. Also record into localStorage assignments collection
  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(assignment);
    localStorage.setItem("basa_wisyo_assignments_v2", JSON.stringify(list));
  } catch (e) {}

  return assignment;
}

/**
 * Lists assignments relevant to the current user.
 * @param {Object} actor 
 * @returns {Array}
 */
function listAssignments(actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "guest", role: "guest" }) {
  let list = [];
  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    list = raw ? JSON.parse(raw) : [];
  } catch (e) {
    list = [];
  }

  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments) && AUTH.assignments.length > 0) {
    // Merge without duplicates
    const ids = new Set(list.map(a => a.id));
    AUTH.assignments.forEach(a => {
      if (!ids.has(a.id)) list.push(a);
    });
  }

  if (actor.role === "admin") return list;
  if (actor.role === "teacher") {
    return list.filter(a => a.teacherId === actor.id);
  }
  
  // Student: assignments matching student's section or all active
  const studentSection = typeof AUTH !== "undefined" && AUTH.currentUser?.section;
  return list.filter(a => {
    if (!studentSection) return true;
    return a.targetGroup === studentSection || a.section === studentSection || a.targetGroup === "All Students";
  });
}

/**
 * Removes or archives an assignment.
 * @param {string} assignmentId 
 * @param {Object} actor 
 * @returns {boolean}
 */
function removeAssignment(assignmentId, actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "teacher", role: "teacher" }) {
  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments)) {
    AUTH.assignments = AUTH.assignments.filter(a => a.id !== assignmentId);
    if (typeof AUTH.saveAssignments === "function") AUTH.saveAssignments();
  }

  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    if (raw) {
      const list = JSON.parse(raw).filter(a => a.id !== assignmentId);
      localStorage.setItem("basa_wisyo_assignments_v2", JSON.stringify(list));
    }
  } catch (e) {}

  return true;
}

/**
 * Exports an assignment and its reading material as a versioned JSON content package.
 * Enables local-first distribution across school devices.
 * @param {string} assignmentId 
 * @returns {string} JSON package
 */
function exportAssignmentPackage(assignmentId) {
  const assignments = listAssignments({ role: "admin" });
  const a = assignments.find(item => item.id === assignmentId);
  if (!a) {
    throw new Error("Assignment not found for export.");
  }

  const pkg = {
    schemaVersion: ASSIGNMENT_PACKAGE_SCHEMA,
    exportedAt: Date.now(),
    assignment: {
      id: a.id,
      title: a.title,
      targetGroup: a.targetGroup,
      dueDate: a.dueDate,
      mode: a.mode,
      teacherName: a.teacherName,
      material: a.material
    }
  };

  return JSON.stringify(pkg, null, 2);
}

/**
 * Imports an assignment JSON package into this browser.
 * @param {string|Object} packageData 
 * @param {Object} actor 
 * @returns {Object}
 */
function importAssignmentPackage(packageData, actor = typeof getStorageActor === "function" ? getStorageActor() : { id: "guest", role: "guest" }) {
  let pkg = packageData;
  if (typeof pkg === "string") {
    try {
      pkg = JSON.parse(packageData);
    } catch (e) {
      throw new Error("Invalid assignment package: JSON parsing failed.");
    }
  }

  if (!pkg || pkg.schemaVersion !== ASSIGNMENT_PACKAGE_SCHEMA || !pkg.assignment) {
    throw new Error("Unsupported assignment package format or missing assignment content.");
  }

  const a = pkg.assignment;
  if (!a.material || !a.material.x || !Array.isArray(a.material.qs)) {
    throw new Error("Corrupted assignment package: Missing passage text or questions.");
  }

  const importedAssignment = {
    id: `ass_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    materialId: a.material.id,
    materialTitle: a.title || a.material.t,
    materialVersion: a.material.version || 1,
    passageId: a.material.id,
    title: a.title || a.material.t,
    targetGroup: a.targetGroup || "General",
    section: a.targetGroup || "General",
    teacherId: "imported",
    teacherName: a.teacherName || "Assigned by Teacher",
    dueDate: a.dueDate || "Flexible",
    mode: a.mode || "practice",
    status: "active",
    createdAt: Date.now(),
    material: a.material
  };

  if (typeof AUTH !== "undefined" && Array.isArray(AUTH.assignments)) {
    AUTH.assignments.unshift(importedAssignment);
    if (typeof AUTH.saveAssignments === "function") AUTH.saveAssignments();
  }

  try {
    const raw = localStorage.getItem("basa_wisyo_assignments_v2");
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(importedAssignment);
    localStorage.setItem("basa_wisyo_assignments_v2", JSON.stringify(list));
  } catch (e) {}

  return importedAssignment;
}


/* === src/services/onboarding.js === */
/* ==========================================================================
   BasaWisyo - Interactive Onboarding Tour Service (onboarding.js)
   Role-based, account-isolated, friendly guided tour with Wisyo mascot.
   Supports: Unplaced Student, Placed Student, Teacher, Admin, Guest.
   ========================================================================== */

const TOUR_STORAGE_PREFIX = "basawisyo_tour_v1_";
const TOUR_VERSION = 2;

const TOUR_DEFINITIONS = {
  "student-unplaced": {
    id: "student-unplaced",
    role: "student",
    title: "Welcome to BasaWisyo! 🦉",
    steps: [
      {
        id: "welcome-avatar",
        target: ".brand-mascot-badge, .brand, #brand-avatar",
        title: "Meet Wisyo! 🦉",
        badge: "WELCOME",
        text: "Kamusta! I am Wisyo, your reading companion. I'm here to guide you through leveled stories, vocabulary flashcards, and fun learning quests!",
        position: "bottom"
      },
      {
        id: "placement-gate",
        target: '[data-a="tab"][data-v="assess"], #lv-pill',
        preferredTab: "assess",
        title: "Phil-IRI Placement Assessment 📝",
        badge: "STEP 1 · MANDATORY",
        text: "Every new reader takes a 15-question diagnostic placement test. This finds your comfortable reading tier so you get stories that match your level!",
        position: "bottom"
      },
      {
        id: "wisyo-tutor-intro",
        target: '#aib, [data-a="ai-open"]',
        title: "Wisyo AI Reading Coach 🤖",
        badge: "HELP ANYTIME",
        text: "Whenever you read, tap any word for trilingual definitions (Filipino, Bisaya, English) or ask Wisyo for hints without giving away the answers!",
        position: "top"
      }
    ]
  },

  "student-main": {
    id: "student-main",
    role: "student",
    title: "Student Features Tour 🦉",
    steps: [
      {
        id: "student-home",
        target: '#sn [data-a="tab"][data-v="home"], .brand, [data-a="tab"][data-v="home"]',
        preferredTab: "home",
        title: "Student Home & Quests 🎯",
        badge: "DAILY PROGRESS",
        text: "Check your daily reading quests, streak counter, and earned XP right here every time you log in!",
        position: "bottom"
      },
      {
        id: "student-passages",
        target: '#sn [data-a="tab"][data-v="practice"], [data-a="tab"][data-v="practice"]',
        preferredTab: "practice",
        title: "Reading Library 📚",
        badge: "LEVELED STORIES",
        text: "Explore leveled stories from Easy to Extreme! Enjoy karaoke-style audio read-aloud and answer comprehension questions.",
        position: "bottom"
      },
      {
        id: "student-flashcards",
        target: '#sn [data-a="tab"][data-v="flashcards"], [data-a="tab"][data-v="flashcards"]',
        preferredTab: "flashcards",
        title: "Vocabulary Flashcards 📇",
        badge: "SPACED REPETITION",
        text: "Master vocabulary using the 3D Leitner flip deck. Tap any word while reading a passage to save it directly to your deck!",
        position: "bottom"
      },
      {
        id: "student-studio",
        target: '#sn [data-a="tab"][data-v="studio"], [data-a="tab"][data-v="studio"]',
        preferredTab: "studio",
        title: "Personal Reading Studio ✍️",
        badge: "IMPORT & PRACTICE",
        text: "Import your own reading passages or articles from text and PDFs for personal reading practice.",
        position: "bottom"
      },
      {
        id: "student-bayanihan",
        target: '#sn [data-a="tab"][data-v="board"], [data-a="tab"][data-v="board"], #sn [data-a="tab"][data-v="quest"]',
        preferredTab: "board",
        title: "Class Board & Bayanihan 🌟",
        badge: "CLASSROOM QUESTS",
        text: "Join your teacher's class using their share code to participate in cooperative reading goals and class rankings!",
        position: "bottom"
      },
      {
        id: "student-ai",
        target: '#aib, [data-a="ai-open"]',
        title: "Wisyo AI Tutor 🤖",
        badge: "READING COACH",
        text: "Need hints or trilingual vocabulary guidance? Wisyo AI is always ready to guide your comprehension.",
        position: "top"
      },
      {
        id: "student-profile",
        target: '#nav [data-a="tab"][data-v="profile"], [data-a="tab"][data-v="profile"], #hdr-auth-btn',
        preferredTab: "profile",
        title: "Profile, Badges & Tour Replay 👑",
        badge: "MY PROFILE",
        text: "Check your badges, customize your avatar frame, and replay this interactive walkthrough whenever you need a refresher!",
        position: "bottom"
      }
    ]
  },

  "teacher-main": {
    id: "teacher-main",
    role: "teacher",
    title: "Teacher Workspace Tour 🏫",
    steps: [
      {
        id: "teacher-hub",
        target: '#sn [data-a="tab"][data-v="teacher"], [data-a="tab"][data-v="teacher"]',
        preferredTab: "teacher",
        title: "Classroom Hub & Code 🏫",
        badge: "CLASSROOM SETUP",
        text: "Manage your class roster here! Share your unique Teacher Share Code with students so they can enroll in your class.",
        position: "bottom"
      },
      {
        id: "teacher-studio",
        target: '#sn [data-a="tab"][data-v="teacher-studio"], [data-a="tab"][data-v="teacher-studio"]',
        preferredTab: "teacher-studio",
        title: "Teacher Reading Studio ✍️",
        badge: "CURRICULUM CREATOR",
        text: "Create custom reading passages, upload curriculum PDFs, and use Wisyo AI to generate multi-skill comprehension questions.",
        position: "bottom"
      },
      {
        id: "teacher-assignments",
        target: '#sn [data-a="tab"][data-v="teacher"], [data-a="tab"][data-v="teacher"]',
        preferredTab: "teacher",
        title: "Class Assignments 📋",
        badge: "ASSIGNMENTS",
        text: "Assign leveled passages with due dates directly to your connected students for practice or formal homework.",
        position: "bottom"
      },
      {
        id: "teacher-bayanihan",
        target: '#sn [data-a="tab"][data-v="board"], [data-a="tab"][data-v="board"]',
        preferredTab: "board",
        title: "Class Board & Bayanihan Target 🌟",
        badge: "COMMUNITY READING",
        text: "Set weekly classroom reading target words and inspire your students through collaborative Bayanihan reading quests!",
        position: "bottom"
      },
      {
        id: "teacher-reports",
        target: '#sn [data-a="tab"][data-v="reports"], [data-a="tab"][data-v="reports"]',
        preferredTab: "reports",
        title: "DepEd Form 14 & Reports 📊",
        badge: "AUTHENTIC EVIDENCE",
        text: "Track authentic Phil-IRI diagnostic metrics and student reading levels. Preview, export to CSV, or print official report sheets.",
        position: "bottom"
      }
    ]
  },

  "admin-main": {
    id: "admin-main",
    role: "admin",
    title: "Admin Console Tour ⚙️",
    steps: [
      {
        id: "admin-console",
        target: '#sn [data-a="tab"][data-v="admin"], [data-a="tab"][data-v="admin"]',
        preferredTab: "admin",
        title: "School Admin Console ⚙️",
        badge: "MANAGEMENT",
        text: "Manage school teacher accounts, review student enrollments, and perform complete system backups and restores.",
        position: "bottom"
      },
      {
        id: "admin-curriculum",
        target: '#sn [data-a="tab"][data-v="practice"], [data-a="tab"][data-v="practice"]',
        preferredTab: "practice",
        title: "Curriculum Management 📖",
        badge: "PASSAGE APPROVAL",
        text: "Review, edit, and approve teacher-submitted reading materials to publish them immediately to the school's reading library.",
        position: "bottom"
      },
      {
        id: "admin-reports",
        target: '#sn [data-a="tab"][data-v="reports"], [data-a="tab"][data-v="reports"]',
        preferredTab: "reports",
        title: "School-Wide Reports 📈",
        badge: "ANALYTICS",
        text: "Access comprehensive reading mastery data and diagnostic level breakdowns across all classes in your institution.",
        position: "bottom"
      }
    ]
  }
};

function getTourStorageKey(userId) {
  const accountId = userId || (typeof AUTH !== "undefined" && AUTH.currentUser ? AUTH.currentUser.id : "guest");
  return `${TOUR_STORAGE_PREFIX}${accountId}`;
}

function getTourRecords(userId) {
  const key = getTourStorageKey(userId);
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function getTourStatus(userId, tourId) {
  const records = getTourRecords(userId);
  return records[tourId] || null;
}

function saveTourStatus(userId, tourId, status, stepIndex = 0) {
  const key = getTourStorageKey(userId);
  try {
    if (typeof localStorage === "undefined") return;
    const records = getTourRecords(userId);
    const targetId = userId || "guest";
    records[tourId] = {
      userId: targetId,
      studentId: targetId,
      tourId,
      tourVersion: TOUR_VERSION,
      status, // "not_started" | "in_progress" | "skipped" | "completed"
      stepIndex,
      lastCompletedStep: status === "completed" ? stepIndex : Math.max(0, stepIndex - 1),
      updatedAt: new Date().toISOString(),
      completedAt: ["completed", "skipped"].includes(status) ? new Date().toISOString() : null
    };
    localStorage.setItem(key, JSON.stringify(records));
  } catch (err) {
    console.warn("Could not save tour state:", err);
  }
}

function resetTourStatus(userId, tourId) {
  saveTourStatus(userId, tourId, "not_started", 0);
}

function getTourDefinition(tourId) {
  return TOUR_DEFINITIONS[tourId] || null;
}

/**
 * Determines which tour (if any) should automatically start for the given user/state.
 */
function resolveAutoTourId(user, state = {}) {
  const role = user ? user.role : "student";
  const isUnplaced = (role === "student") && (state.lvl === null || (user && user.lvl === null));

  if (role === "student") {
    return isUnplaced ? "student-unplaced" : "student-main";
  }
  if (role === "teacher") {
    return "teacher-main";
  }
  if (role === "admin") {
    return "admin-main";
  }
  return null;
}

function shouldAutoStartTour(user, state = {}) {
  // If no user and not guest mode, we are on the welcome screen
  if (!user && (typeof GUEST_MODE === "undefined" || !GUEST_MODE)) return null;
  // Never start tour if a quiz is in progress
  if (typeof ACTIVE_QUIZ !== "undefined" && ACTIVE_QUIZ) return null;

  const tourId = resolveAutoTourId(user, state);
  if (!tourId) return null;

  const userId = user ? user.id : "guest";
  const record = getTourStatus(userId, tourId);

  // If already completed or explicitly skipped, do not auto-start
  if (record && (record.status === "completed" || record.status === "skipped")) {
    return null;
  }

  return { tourId, role: user ? user.role : "guest", definition: TOUR_DEFINITIONS[tourId] };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TOUR_DEFINITIONS,
    TOUR_STORAGE_PREFIX,
    TOUR_VERSION,
    getTourStorageKey,
    getTourRecords,
    getTourStatus,
    saveTourStatus,
    resetTourStatus,
    getTourDefinition,
    resolveAutoTourId,
    shouldAutoStartTour
  };
}


