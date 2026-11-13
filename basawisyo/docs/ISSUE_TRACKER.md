# BasaWisyo issue tracker — first-batch status

Status reflects local code and the [2026-11-13 smoke run](SMOKE_TEST_2026-11-13.md),
not production acceptance. “Ready for QA” means the local fix passed automated
tests and a relevant browser spot check; independent review and broader
acceptance remain.

| Issue | Priority | Status | Evidence / next gate |
| --- | --- | --- | --- |
| BW-001 Plaintext accounts | P0 | Open | `auth.js` stores and checks passwords in browser storage; design secure backend identity. |
| BW-002 Client privilege escalation | P0 | Open | Quick role control removed, but registration role choice and embedded admin key remain in `app.js`; enforce server roles. |
| BW-003 Shared progress | P0 | Open | `state.js` uses origin-wide state; S01/S02/S09 fail. |
| BW-004 Diagnostic rubric mismatch | P0 | Open | Four-item count mapping conflicts with displayed percentage bands; S10 blocked pending specialist approval. |
| BW-005 Unmeasured WPM | P0 | Open | Guest/seed WPM is fixed or estimated; no reading timer or approved method. |
| BW-006 Admin passage schema | P1 | Ready for QA | Canonical schema, automated create-to-result test, browser test passage quiz; S05 passes locally. |
| BW-007 Library visibility | P1 | Ready for QA | Published custom passage appears in browser library and automated teacher selector test; S04 passes locally. |
| BW-008 Restore picker | P1 | Ready for QA | Automated picker/control and restore tests pass; browser file picker not repeated in this run. |
| BW-009 Restore state round trip | P1 | Ready for QA | Versioned/legacy payload, `systemState`, session clearing, and rollback tests pass; S12/S13 pass in harness. |
| BW-010 Mock reports | P1 | Open | `reports.js`/`exports.js` use `CLASS_ROSTER` and fixed values; S11 fails. |
| BW-011 No shared sync | P1 | Open | Backend is empty; assignment/guest/offline checks S08/S09/S14 fail. |
| BW-012 Unsafe rendering | P1 | In progress | Passage rendering is escaped; account names and other fields in admin/teacher HTML are not; S15 fails. |
| BW-013 Tutor mistake fields | P2 | Open | `quiz.js` stores `ch`/`ok`; `tutor.js` reads `userChoice`/`correctChoice`. |
| BW-014 BasaMesh answer assumption | P2 | Open | `app.js` mesh import sets generated question answer index `0` without evidence. |
| BW-015 Corrupted UI characters | P2 | Open | Browser shows garbled symbols/text in multiple views; encoding cleanup and visual review needed. |

**Release gate:** P0 items remain open. No real student data, school pilot,
validated assessment claim, or official report submission is authorized by
this tracker.
