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

  persistPractices(next) {
    try {
      localStorage.setItem(this.CUSTOM_PASSAGES_KEY, JSON.stringify(next));
    } catch(e) {
      throw new Error("Practice could not be saved in this browser. Check storage and try again.");
    }
    this.customPassages = next;
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
    const newUser = {
      id,
      email: cleanEmail,
      password,
      name,
      role: data.role,
      school: data.school || "Rizal National High School",
      section: data.role === "teacher" ? section : linkedTeacher?.section || "",
      teacherCode: data.role === "student" ? teacherCode : "",
      shareCode,
      lvl: data.role === "student" ? (S.lvl !== null ? S.lvl : 1) : null,
      wpm: data.role === "student" ? 110 : null,
      comp: data.role === "student" ? 75 : null,
      wordsRead: data.role === "student" ? (S.w || 0) : null,
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
      author: previous?.author ?? actor.name,
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

