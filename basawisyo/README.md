# BasaWisyo

This directory is the component-organized copy of the `indexNew.html`
baseline. The visual interface and existing application logic were retained.
The original file remains at the repository root and is tagged
`baseline-2026-11-13` for comparison.

## Run locally

From this directory, run `python -m http.server 8765`, then open
`http://127.0.0.1:8765/index.html` in a modern browser. No build or package
installation is required. The HTML loads the JavaScript files in their
original execution order as classic scripts, so the current global state and
event handlers continue to work. The public entry screen offers guest access
and links to the separate `login.html` sign-in page. Registration remains in
the app. `node --check` can check each JavaScript file.

## File map

- `index.html`: public entry, registration, and app markup with ordered scripts.
- `login.html`: separate sign-in page using `src/pages/login.js`.
- `assets/images/wisyo.png`: one copy of the formerly repeated embedded image.
- `assets/fonts/`: reserved for bundled fonts; current styles still request
  Bricolage Grotesque, Lexend, and Outfit from Google Fonts.
- `src/styles/`: base, role/dashboard, and login styles.
- `src/data/`: dictionary, built-in passages, placement items, and demo roster.
  `src/data/PASSAGE_SCHEMA.md` documents the shared passage contract.
- `src/components/`: navigation, app shell, and toast rendering.
- `src/pages/`: guest, student, teacher, admin, and supporting page views.
- Teachers can submit reading practices for admin review. Approved practices
  appear in the library and teacher assignment picker on the same browser.
- The practice editor supports 1–20 editable questions, shown one at a time
  with Previous/Next controls and a slider. Authors can write them manually
  or ask Wisyo for drafts. Wisyo uses an on-device browser model when
  available; otherwise its offline helper suggests passage-based word questions.
  Authors should verify every suggested question and answer before submission.
- Public registration creates student accounts only; staff roles are assigned
  from the existing admin account-management view in this prototype.
- `src/services/`: account/storage state, quizzes, tutor, export, and backup
  behavior. `src/services/BACKUP_FORMAT.md` documents backup version 1.
- `src/utils/`: common constants, selectors, speech, and reading helpers.
- `src/app.js`: delegated event handling and initial render call.
- `backend/`: reserved structure only; no server implementation exists yet.
- `tests/`: isolated reproduction tests for BW-006 through BW-009.
- `docs/`: draft permissions matrix and assessment-specification questions
  for review before implementing the P0 account and scoring work, plus the
  first-batch smoke report and issue tracker.

## Current limitations

The passage schema and library fixes cover BW-006 and BW-007. Backup restore
now covers BW-008 and BW-009. Authentication and authorization are still
browser-side demo behavior; browser storage is shared at the origin level;
reports can include sample values. Backup files include plaintext demo
passwords. Practice approval is also local to one browser; it does not sync
teacher and admin devices. Do not use real student accounts or records with
this build.
