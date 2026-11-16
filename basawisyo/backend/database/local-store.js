const crypto = require("node:crypto");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  school TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'))
);
CREATE TABLE IF NOT EXISTS classrooms (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  share_code TEXT NOT NULL UNIQUE,
  school TEXT NOT NULL,
  section TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classroom_memberships (
  student_id TEXT PRIMARY KEY REFERENCES users(id),
  classroom_id TEXT NOT NULL REFERENCES classrooms(id),
  joined_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS student_states (
  student_id TEXT PRIMARY KEY REFERENCES users(id),
  state_json TEXT NOT NULL,
  journey_json TEXT NOT NULL,
  reading_level INTEGER CHECK (reading_level BETWEEN 0 AND 3),
  base_tier INTEGER NOT NULL DEFAULT 0 CHECK (base_tier BETWEEN 0 AND 3),
  words_read INTEGER NOT NULL DEFAULT 0 CHECK (words_read >= 0),
  sessions INTEGER NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS placement_results (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  reading_level INTEGER NOT NULL CHECK (reading_level BETWEEN 0 AND 3),
  score INTEGER NOT NULL CHECK (score >= 0),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  candidate INTEGER NOT NULL DEFAULT 0 CHECK (candidate IN (0,1)),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
  result_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE(student_id, completed_at)
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  passage_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  completed_at TEXT NOT NULL,
  CHECK (score <= question_count)
);
CREATE INDEX IF NOT EXISTS attempts_by_student_time ON quiz_attempts(student_id, completed_at);
CREATE TABLE IF NOT EXISTS xp_events (
  attempt_id TEXT PRIMARY KEY REFERENCES quiz_attempts(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  points INTEGER NOT NULL CHECK (points >= 0)
);
CREATE TABLE IF NOT EXISTS badge_awards (
  student_id TEXT NOT NULL REFERENCES users(id),
  badge_code TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  PRIMARY KEY(student_id, badge_code)
);
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  content_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  classroom_id TEXT REFERENCES classrooms(id),
  teacher_id TEXT REFERENCES users(id),
  material_id TEXT REFERENCES materials(id),
  passage_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT,
  mode TEXT NOT NULL DEFAULT 'practice',
  status TEXT NOT NULL DEFAULT 'active',
  content_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_receipts (
  payload_hash TEXT PRIMARY KEY,
  received_at TEXT NOT NULL
);
`;

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nonnegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function level(value) {
  return Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
}

function isoTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function openLocalStore(filename = path.join(__dirname, "basawisyo.sqlite")) {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA busy_timeout = 5000");
  if (filename !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);

  function sync(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid sync payload.");
    const users = Array.isArray(payload.users) ? payload.users : [];
    const userStates = object(payload.userStates);
    const assignments = Array.isArray(payload.assignments) ? payload.assignments : [];
    const materials = Array.isArray(payload.materials) ? payload.materials : [];
    const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    if (db.prepare("SELECT 1 FROM sync_receipts WHERE payload_hash = ?").get(hash)) return { duplicate: true };
    db.exec("BEGIN IMMEDIATE");
    try {
      const putUser = db.prepare(`INSERT INTO users(id,email,name,role,school,section,status) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, school=excluded.school,
        section=excluded.section, status=excluded.status`);
      for (const user of users) {
        if (!user || !user.id || !user.email || !user.name || !["student", "teacher", "admin"].includes(user.role)) continue;
        putUser.run(String(user.id), String(user.email).trim().toLowerCase(), String(user.name), user.role,
          String(user.school || "Local School"), String(user.section || ""), user.status === "suspended" ? "suspended" : "active");
      }
      const putClass = db.prepare(`INSERT INTO classrooms(id,teacher_id,share_code,school,section) VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET share_code=excluded.share_code, school=excluded.school, section=excluded.section`);
      for (const teacher of users.filter(user => user?.role === "teacher" && user.shareCode)) {
        putClass.run(`class_${teacher.id}`, teacher.id, String(teacher.shareCode).toUpperCase(),
          String(teacher.school || "Local School"), String(teacher.section || ""));
      }
      const putMembership = db.prepare(`INSERT INTO classroom_memberships(student_id,classroom_id,joined_at) VALUES(?,?,?)
        ON CONFLICT(student_id) DO UPDATE SET classroom_id=excluded.classroom_id`);
      for (const student of users.filter(user => user?.role === "student" && user.teacherCode)) {
        const classroom = db.prepare("SELECT id FROM classrooms WHERE share_code = ?").get(String(student.teacherCode).toUpperCase());
        if (classroom) putMembership.run(student.id, classroom.id, isoTime(student.createdAt));
      }
      const putState = db.prepare(`INSERT INTO student_states(student_id,state_json,journey_json,reading_level,base_tier,words_read,sessions,xp,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET state_json=excluded.state_json,
        journey_json=excluded.journey_json, reading_level=excluded.reading_level,
        base_tier=excluded.base_tier, words_read=excluded.words_read, sessions=excluded.sessions,
        xp=excluded.xp, updated_at=excluded.updated_at
        WHERE excluded.sessions >= student_states.sessions AND excluded.words_read >= student_states.words_read`);
      const putPlacement = db.prepare(`INSERT OR IGNORE INTO placement_results
        (id,student_id,reading_level,score,question_count,candidate,verified,result_json,completed_at)
        VALUES(?,?,?,?,?,?,?,?,?)`);
      const putAttempt = db.prepare(`INSERT OR IGNORE INTO quiz_attempts
        (id,student_id,passage_id,mode,score,question_count,xp_awarded,completed_at)
        VALUES(?,?,?,?,?,?,?,?)`);
      const putXP = db.prepare("INSERT OR IGNORE INTO xp_events(attempt_id,student_id,points) VALUES(?,?,?)");
      for (const user of users.filter(item => item?.role === "student" && item.id)) {
        const state = object(userStates[`basa_wisyo_state_${user.id}`]);
        const journey = object(user.journey);
        if (!Object.keys(state).length && !Object.keys(journey).length) continue;
        const results = object(journey.results);
        const storyXP = Object.values(results).reduce((sum, result) => {
          if (!result || !Number.isInteger(result.attempts) || result.attempts < 1) return sum;
          return sum + 10 + nonnegative(result.correct) * 5;
        }, 0);
        putState.run(user.id, JSON.stringify(state), JSON.stringify(journey), level(state.lvl ?? user.lvl),
          Math.min(3, nonnegative(journey.baseTier)), nonnegative(state.w ?? user.wordsRead),
          nonnegative(state.ss), storyXP + nonnegative(journey.bonusXP), new Date().toISOString());
        const placement = object(state.placementReport);
        const placedLevel = level(placement.level);
        if (placedLevel !== null && Number.isInteger(placement.totalQuestions) && placement.totalQuestions > 0) {
          const completedAt = isoTime(placement.date);
          putPlacement.run(`placement_${user.id}_${Date.parse(completedAt)}`, user.id, placedLevel,
            nonnegative(placement.totalScore), placement.totalQuestions, Number(Boolean(placement.isCandidate)),
            Number(Boolean(placement.verified)), JSON.stringify(placement), completedAt);
        }
        for (const attempt of Array.isArray(state.attempts) ? state.attempts : []) {
          if (!attempt?.id || !Number.isInteger(attempt.total) || attempt.total < 1) continue;
          putAttempt.run(String(attempt.id), user.id, String(attempt.passageId || "unknown"),
            String(attempt.mode || "practice"), Math.min(nonnegative(attempt.score), attempt.total),
            attempt.total, nonnegative(attempt.xpAwarded), isoTime(attempt.timestamp));
          putXP.run(String(attempt.id), user.id, nonnegative(attempt.xpAwarded));
        }
      }
      const putMaterial = db.prepare(`INSERT INTO materials(id,owner_id,title,version,status,visibility,content_json)
        VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, version=excluded.version,
        status=excluded.status, visibility=excluded.visibility, content_json=excluded.content_json`);
      for (const material of materials) {
        if (!material?.id) continue;
        const owner = material.ownerId && db.prepare("SELECT id FROM users WHERE id = ?").get(material.ownerId);
        putMaterial.run(String(material.id), owner ? material.ownerId : null, String(material.title || material.t || "Untitled"),
          Math.max(1, nonnegative(material.version)), String(material.status || "personal"),
          String(material.visibility || "private"), JSON.stringify(material));
      }
      const putAssignment = db.prepare(`INSERT INTO assignments
        (id,classroom_id,teacher_id,material_id,passage_id,title,due_date,mode,status,content_json)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET classroom_id=excluded.classroom_id,
        teacher_id=excluded.teacher_id, material_id=excluded.material_id, due_date=excluded.due_date,
        status=excluded.status, content_json=excluded.content_json`);
      for (const assignment of assignments) {
        if (!assignment?.id || !assignment.passageId) continue;
        const classroom = assignment.teacherCode
          ? db.prepare("SELECT id, teacher_id FROM classrooms WHERE share_code = ?").get(assignment.teacherCode)
          : assignment.teacherId
            ? db.prepare("SELECT id, teacher_id FROM classrooms WHERE teacher_id = ?").get(assignment.teacherId)
            : null;
        const materialId = db.prepare("SELECT id FROM materials WHERE id = ?").get(assignment.materialId || assignment.passageId)?.id || null;
        putAssignment.run(String(assignment.id), classroom?.id || null, classroom?.teacher_id || null,
          materialId, String(assignment.passageId), String(assignment.title || assignment.materialTitle || "Untitled"),
          assignment.dueDate ? String(assignment.dueDate) : null, assignment.mode === "assessment" ? "assessment" : "practice",
          String(assignment.status || "active"), JSON.stringify(assignment));
      }
      db.prepare("INSERT INTO sync_receipts(payload_hash,received_at) VALUES(?,?)").run(hash, new Date().toISOString());
      db.exec("COMMIT");
      return { duplicate: false, users: users.length, assignments: assignments.length, materials: materials.length };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function summary(studentId) {
    const student = db.prepare(`SELECT u.id,u.name,u.role,s.reading_level,s.base_tier,s.words_read,s.sessions,s.xp,
      c.id AS classroom_id,c.section,c.share_code,t.name AS teacher_name
      FROM users u LEFT JOIN student_states s ON s.student_id=u.id
      LEFT JOIN classroom_memberships m ON m.student_id=u.id
      LEFT JOIN classrooms c ON c.id=m.classroom_id LEFT JOIN users t ON t.id=c.teacher_id WHERE u.id=?`).get(studentId);
    if (!student || student.role !== "student") return null;
    return {
      student,
      placement: db.prepare("SELECT reading_level,score,question_count,candidate,verified,completed_at FROM placement_results WHERE student_id=? ORDER BY completed_at DESC LIMIT 1").get(studentId) || null,
      attempts: db.prepare("SELECT id,passage_id,mode,score,question_count,xp_awarded,completed_at FROM quiz_attempts WHERE student_id=? ORDER BY completed_at DESC LIMIT 50").all(studentId)
    };
  }

  return { db, sync, summary, close: () => db.close() };
}

module.exports = { openLocalStore };
