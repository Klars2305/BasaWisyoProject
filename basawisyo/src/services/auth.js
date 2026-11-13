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
          // Sync student stats with local S if student
          if (found.role === "student" && found.lvl !== undefined) {
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
        email: "admin@basawisyo.ph",
        password: "admin123",
        name: "Principal Maria Santos",
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
      localStorage.setItem(this.USERS_KEY, JSON.stringify(this.users));
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
    } catch(e) {}
  },

  // Auth Operations
  login(email, password) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const user = this.users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
    if (!user) return { success: false, message: "Invalid email or password." };
    if (user.status === "suspended") return { success: false, message: "This account has been suspended by the administrator." };

    this.currentUser = user;
    this.saveSession();

    // Sync student stats with S
    if (user.role === "student") {
      if (user.lvl !== undefined && user.lvl !== null) S.lvl = user.lvl;
      if (user.wordsRead) S.w = Math.max(S.w, user.wordsRead);
      save();
    }

    return { success: true, user };
  },

  register(data) {
    const cleanEmail = (data.email || "").trim().toLowerCase();
    if (this.users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: "An account with this email already exists." };
    }

    const id = "usr_" + Date.now();
    let shareCode = null;
    if (data.role === "teacher") {
      shareCode = "BASA-TEACH-" + Math.floor(1000 + Math.random() * 9000);
    }

    const newUser = {
      id,
      email: cleanEmail,
      password: data.password,
      name: data.name.trim(),
      role: data.role,
      school: data.school || "Rizal National High School",
      section: data.section || (data.role === "teacher" ? "Grade 8 - Section 1" : ""),
      teacherCode: (data.teacherCode || "").trim().toUpperCase(),
      shareCode,
      lvl: data.role === "student" ? (S.lvl !== null ? S.lvl : 1) : null,
      wpm: data.role === "student" ? 110 : null,
      comp: data.role === "student" ? 75 : null,
      wordsRead: data.role === "student" ? (S.w || 0) : null,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0]
    };

    this.users.push(newUser);
    this.saveUsers();
    this.currentUser = newUser;
    this.saveSession();

    return { success: true, user: newUser };
  },

  logout() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      if (localStorage.getItem(this.SESSION_KEY) !== null) return false;
    } catch(e) {
      return false;
    }
    this.currentUser = null;
    return true;
  },

  // Student Actions
  connectTeacher(teacherCode) {
    if (!this.currentUser) return { success: false, message: "Must be logged in." };
    const code = (teacherCode || "").trim().toUpperCase();
    const teacher = this.users.find(u => u.role === "teacher" && u.shareCode === code);
    if (!teacher) {
      return { success: false, message: `No active classroom found for code "${code}". Please check with your teacher.` };
    }

    this.currentUser.teacherCode = code;
    this.currentUser.section = teacher.section;
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
    if (!this.currentUser || this.currentUser.role !== "teacher") return;
    const newAsg = {
      id: "asg_" + Date.now(),
      teacherCode: this.currentUser.shareCode,
      passageId,
      title,
      targetGroup: targetGroup || "all",
      dueDate: dueDate || "Next Class",
      note: note || ""
    };
    this.assignments.unshift(newAsg);
    this.saveAssignments();
  },

  // Guest Token Mechanism
  createGuestToken(lvl, wpm, comp, studentName) {
    const token = "GUEST-" + Math.floor(1000 + Math.random() * 9000);
    this.guestTokens[token] = {
      name: studentName || "Guest Student",
      lvl,
      wpm: wpm || 105,
      comp: comp || 75,
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
      name: data.name + ` (${cleanToken})`,
      role: "student",
      school: "Rizal National High School",
      section: this.currentUser ? this.currentUser.section : "Connected Class",
      teacherCode: teacherCode || (this.currentUser ? this.currentUser.shareCode : ""),
      lvl: data.lvl,
      wpm: data.wpm,
      comp: data.comp,
      wordsRead: 350,
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

  addCustomPassage(p) {
    const passage = normalizePassage({
      ...p,
      id: p.id || "cust_" + Date.now(),
      status: p.status ?? "published"
    });
    if (getPublishedPassages().some(existing => existing.id === passage.id)
        || this.customPassages.some(existing => existing?.id === passage.id)) {
      throw new Error("Passage ID already exists.");
    }
    this.customPassages.push(passage);
    this.saveCustomPassages();
    return passage;
  },

  deleteCustomPassage(id) {
    this.customPassages = this.customPassages.filter(p => p.id !== id);
    this.saveCustomPassages();
    S.sh = S.sh.filter(p => p.id !== id);
    save();
  }
};

