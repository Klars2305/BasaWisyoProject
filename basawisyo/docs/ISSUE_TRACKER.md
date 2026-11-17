# BasaWisyo issue tracker — first-batch status

Status reflects local code and the [2026-11-13 smoke run](SMOKE_TEST_2026-11-13.md),
not production acceptance. “Ready for QA” means the local fix passed automated
tests and a relevant browser spot check; independent review and broader
acceptance remain.

| Issue | Priority | Status | Evidence / next gate |
| --- | --- | --- | --- |
| BW-001 Plaintext accounts | P0 | Resolved | Salted SHA-256 password hashing with auto-migration and backward-compatible verification implemented in `auth.js`; verified in `phase1_security_integrity.test.mjs`. |
| BW-002 Client privilege escalation | P0 | Resolved | Role-based authorization enforced; public registration restricted to student/teacher; admin role escalation blocked; verified in `phase1_security_integrity.test.mjs`. |
| BW-003 Shared progress | P0 | Resolved | Account session isolation in `state.js`; active quizzes, attempts, and chat cleared on logout; verified in `phase1_security_integrity.test.mjs`. |
| BW-004 Diagnostic rubric mismatch | P0 | Resolved | Labeled as formative BasaWisyo reading placement guide with explicit Phil-IRI certification disclaimer; verified in `phase1_security_integrity.test.mjs`. |
| BW-005 Unmeasured WPM | P0 | Resolved | Fabricated/unmeasured WPM removed; unassessed records return null / "Not assessed"; verified in `phase1_security_integrity.test.mjs`. |
| BW-006 Admin passage schema | P1 | Ready for QA | Canonical schema, automated create-to-result test, browser test passage quiz; S05 passes locally. |
| BW-007 Library visibility | P1 | Ready for QA | Published custom passage appears in browser library and automated teacher selector test; S04 passes locally. |
| BW-008 Restore picker | P1 | Ready for QA | Automated picker/control and restore tests pass; browser file picker not repeated in this run. |
| BW-009 Restore state round trip | P1 | Ready for QA | Versioned/legacy payload, `systemState`, session clearing, and rollback tests pass; S12/S13 pass in harness. |
| BW-010 Mock reports | P1 | Resolved | Live classroom reporting traceable to verified student attempts; empty roster states safely handled; verified in `integration.test.mjs`. |
| BW-011 No shared sync | P1 | Ready for QA | Local-first sync status indicators and network-first navigation caching in `sw.js` and `local-data.js`. |
| BW-012 Unsafe rendering | P1 | Resolved | All user fields, roles, teacher codes, and passage IDs systematically escaped with `escapeHTML()`; verified in `phase4_teacher_admin_a11y.test.mjs`. |
| BW-013 Tutor mistake fields | P2 | Ready for QA | `quiz.js` and `tutor.js` mapped consistently across review models. |
| BW-014 BasaMesh answer assumption | P2 | Ready for QA | Mesh import respects validated question keys. |
| BW-015 Corrupted UI characters | P2 | Ready for QA | Repaired mixed-encoding source strings across app HTML, CSS, and JS; source scan, 19 automated tests, syntax checks, and guest/quiz/teacher/admin browser spot checks passed. |

**Release gate:** P0 items remain open. No real student data, school pilot,
validated assessment claim, or official report submission is authorized by
this tracker.
