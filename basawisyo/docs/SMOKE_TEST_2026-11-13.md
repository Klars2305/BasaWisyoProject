# First-batch smoke test — 2026-11-13

**Scope:** All 17 items in section 12 of `C:\Users\klare\Downloads\PLAN.md`.
This is a local prototype check, not a school pilot or production sign-off.
The app was served from this checkout on isolated localhost ports with seeded
demo accounts and a newly created test passage. No real student data was used.

**Automated checks:** `node --test tests/repro.test.mjs` passed 19/19;
`node --check` passed for every `src/*.js` file and the test file. The Node
suite runs application scripts in an isolated VM with storage and file stubs.
It does not prove browser audio, server authorization, offline sync, or mobile
accessibility.

**Browser checks:** In the in-app browser, guest entry, library, dictionary
popup, narration control state, and a two-question practice quiz worked. A
seeded student signed in and remained signed in after reload. A seeded teacher
opened the classroom roster and dispatched a `level-0` assignment in local
storage. A seeded admin created “Smoke Test Passage,” found it in the library,
answered its question, and saw the completed result. These roles were tested
on separate localhost origins so their demo storage did not mix.

## Plan section 12 results

| ID | Checklist item | Result | Evidence / limit |
| --- | --- | --- | --- |
| S01 | Student registers/logs in and retains their own progress after reload | **Fail** | Seed student login and reload worked in browser; `state.js` still persists one shared `basa_wisyo_state_v2`, so “own” progress is not guaranteed. Registration was not repeated in this smoke run. BW-003. |
| S02 | Switching accounts never transfers student A's state to student B | **Fail** | `auth.js` merges a student's words read into shared `S`; state is not keyed by account. BW-003. |
| S03 | Suspended or signed-out accounts cannot access protected features | **Fail** | Login/session restoration reject suspended users, but authorization and action handlers remain client-side; no protected server boundary exists. BW-001/BW-002. |
| S04 | Admin creates/publishes a passage; students can find it in the library | **Pass (local prototype)** | Browser admin created a published test passage, found it in library; automated BW-007 test checks reader and teacher consumers. Cross-device visibility is not supported. |
| S05 | Student completes an admin-created quiz without runtime error | **Pass (local prototype)** | Browser test passage quiz completed 1/1; automated BW-006 test exercises create → quiz → result. |
| S06 | Quiz score and stored answer history are internally consistent | **Fail** | `quiz.js` keeps `correctCount` and aggregate skill counts, but does not persist a per-attempt answer history that could be reconciled. BW-004/reporting work. |
| S07 | Dictionary and text-to-speech work in supported browsers | **Partial** | Browser dictionary popup showed Filipino, Bisaya, and English; narration control showed “Playing audio narration.” Actual audible output and device coverage were not verified. |
| S08 | Teacher assignments reach only intended students/classrooms | **Fail** | Browser teacher wrote a `level-0` local assignment. No shared backend, enrollment authorization, or cross-device delivery exists. BW-011. |
| S09 | Guest assessment import targets the correct authorized student/classroom | **Fail** | `importGuestToken` creates a local student from a token and caller-supplied teacher code; there is no authoritative identity/ownership check or cross-device flow. BW-003/BW-011. |
| S10 | Reading scores match approved scoring specification | **Blocked by missing specification** | No approved scoring rubric exists. Current 2/4 = 50% and 3/4 = 75% labels conflict with displayed 59–79% and 80–89% bands. See `ASSESSMENT_SPEC_QUESTIONS.md`. BW-004/BW-005. |
| S11 | Dashboard and CSV values match actual stored attempts | **Fail** | `reports.js` and `exports.js` use `CLASS_ROSTER` demo data; CSV includes a fixed 115 WPM while the sheet derives a different value. No raw attempts are stored. BW-010. |
| S12 | Backup export/import round trip restores documented categories | **Pass (isolated harness)** | BW-008/BW-009 and versioned/legacy round-trip tests restore collections and `systemState`, clear session, and reload correctly. No real browser backup was imported. |
| S13 | Invalid/malformed backups preserve existing data | **Pass (isolated harness)** | Empty, malformed, unsupported-version, duplicate, oversized, unreadable, canceled, and simulated storage-write failure tests preserve previous values. |
| S14 | Offline attempts survive reload and synchronize once on reconnect | **Fail** | No backend or sync queue exists (`backend/README.md`); local state may survive reload but cannot synchronize. BW-011. |
| S15 | User-provided text renders safely without executable markup | **Fail** | Custom passage/library/quiz escaping tests pass, but `admin.js` and `teacher.js` interpolate user names and other account fields into HTML without escaping. BW-012. |
| S16 | Keyboard-only navigation completes critical reading/quiz tasks | **Partial** | Browser Tab focused library filters and Return activated Easy. A full keyboard-only quiz and focus sequence was not verified. |
| S17 | Mobile layout, focus, and assistive labels pass review | **Not verified** | One narrow browser view was inspected, but no device matrix, screen-reader session, or systematic focus/label audit was run. |

**Result:** 4 local passes, 9 failures, 2 partial checks, 1 blocked by an
approval prerequisite, and 1 not verified. The local demo remains unsuitable
for real student accounts or official score/report claims.

## Additional findings from this run

- Visible symbols and punctuation are garbled in navigation, quiz controls,
  teacher/admin views, and some passage previews. Track under BW-015.
- The teacher view says “Real-time sync” and the home view says “Live roster
  synced,” although the app has no backend. Track under BW-011.
- Reports present sample values as an official DepEd form. Track under BW-010
  and the assessment claim decision in `ASSESSMENT_SPEC_QUESTIONS.md`.

No failed/blocked checklist item is checked off as complete in the source
plan. The next work should be chosen only after review of these results and
the P0 security and assessment decisions.
