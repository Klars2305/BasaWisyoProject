import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const require = createRequire(import.meta.url);
const { openLocalStore } = require("../backend/database/local-store.js");
const { createDataHandler } = require("../backend/routes/data.js");

function pilotSnapshot() {
  return {
    users: [
      { id: "teacher_1", email: "teacher@example.test", name: "Teacher", role: "teacher", school: "Pilot", section: "Grade 8-A", shareCode: "CLASS-123" },
      { id: "student_1", email: "one@example.test", name: "One", role: "student", school: "Pilot", teacherCode: "CLASS-123" },
      { id: "student_2", email: "two@example.test", name: "Two", role: "student", school: "Pilot" }
    ],
    userStates: {
      basa_wisyo_state_student_1: {
        lvl: 1, w: 120, ss: 1,
        placementReport: { date: "2026-11-15T08:00:00Z", totalScore: 9, totalQuestions: 15, level: 1 },
        attempts: [{ id: "attempt_1", passageId: "easy_1", mode: "pr", score: 2, total: 2, xpAwarded: 20, timestamp: "2026-11-15T08:05:00Z" }]
      },
      basa_wisyo_state_student_2: { lvl: null, w: 0, ss: 0, attempts: [] }
    },
    assignments: [{ id: "assignment_1", teacherCode: "CLASS-123", passageId: "easy_1", title: "Practice" }],
    materials: []
  };
}

test("local relational sync links students to the correct class and keeps attempts separate", () => {
  const store = openLocalStore(":memory:");
  try {
    const snapshot = pilotSnapshot();
    assert.equal(store.sync(snapshot).duplicate, false);
    assert.equal(store.sync(snapshot).duplicate, true);
    const one = store.summary("student_1");
    const two = store.summary("student_2");
    assert.equal(one.student.classroom_id, "class_teacher_1");
    assert.equal(two.student.classroom_id, null);
    assert.equal(one.placement.score, 9);
    assert.equal(one.attempts.length, 1);
    assert.equal(two.attempts.length, 0);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM xp_events").get().n, 1);
    assert.equal(store.db.prepare("SELECT classroom_id FROM assignments WHERE id='assignment_1'").get().classroom_id, "class_teacher_1");
  } finally {
    store.close();
  }
});

test("a later empty browser state does not erase synchronized student progress", () => {
  const store = openLocalStore(":memory:");
  try {
    const snapshot = pilotSnapshot();
    store.sync(snapshot);
    store.sync({ ...snapshot, userStates: {} });
    assert.equal(store.summary("student_1").student.words_read, 120);
    assert.equal(store.summary("student_1").attempts.length, 1);
    const older = structuredClone(snapshot);
    older.userStates.basa_wisyo_state_student_1.w = 10;
    older.userStates.basa_wisyo_state_student_1.ss = 0;
    store.sync(older);
    assert.equal(store.summary("student_1").student.words_read, 120);
  } finally {
    store.close();
  }
});

test("invalid relational writes roll back without partial accounts", () => {
  const store = openLocalStore(":memory:");
  try {
    const snapshot = pilotSnapshot();
    snapshot.users[2].email = snapshot.users[1].email;
    assert.throws(() => store.sync(snapshot), /UNIQUE constraint failed/);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
  } finally {
    store.close();
  }
});

test("pending enrollment stays out of membership until accepted and a stale snapshot cannot undo review", () => {
  const store = openLocalStore(":memory:");
  try {
    const pending = pilotSnapshot();
    Object.assign(pending.users[2], {
      teacherCode: "", pendingTeacherCode: "CLASS-123", enrollmentRequestedCode: "CLASS-123",
      enrollmentStatus: "pending", enrollmentRequestedAt: "2026-11-17T09:00:00Z"
    });
    store.sync(pending);
    assert.equal(store.summary("student_2").student.classroom_id, null);
    assert.equal(store.db.prepare("SELECT status FROM enrollment_requests WHERE student_id='student_2'").get().status, "pending");

    const accepted = structuredClone(pending);
    Object.assign(accepted.users[2], {
      teacherCode: "CLASS-123", pendingTeacherCode: null, enrollmentStatus: "active",
      enrollmentDecisionAt: "2026-11-17T09:05:00Z"
    });
    store.sync(accepted);
    assert.equal(store.summary("student_2").student.classroom_id, "class_teacher_1");
    assert.equal(store.db.prepare("SELECT status FROM enrollment_requests WHERE student_id='student_2'").get().status, "accepted");

    pending.users[2].name = "Updated local name";
    store.sync(pending);
    assert.equal(store.db.prepare("SELECT status FROM enrollment_requests WHERE student_id='student_2'").get().status, "accepted");
  } finally {
    store.close();
  }
});

test("localhost sync route accepts a snapshot and rejects a foreign origin", async () => {
  const store = openLocalStore(":memory:");
  const handler = createDataHandler({ store });
  const call = async origin => {
    const req = Readable.from([JSON.stringify(pilotSnapshot())]);
    Object.assign(req, { url: "/api/data/sync", method: "POST", headers: {
      origin, "content-type": "application/json"
    }, socket: { localPort: 8765 } });
    const res = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    await handler(req, res);
    return res;
  };
  try {
    assert.equal((await call("https://outside.example")).status, 403);
    assert.equal((await call("http://127.0.0.1:8765")).status, 200);
    assert.equal(store.summary("student_1").attempts.length, 1);
  } finally {
    handler.close();
  }
});
