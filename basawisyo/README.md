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
event handlers continue to work. `node --check` can check each JavaScript file.

## File map

- `index.html`: document markup and ordered stylesheet/script references.
- `assets/images/wisyo.png`: one copy of the formerly repeated embedded image.
- `assets/fonts/`: reserved for bundled fonts; current styles still request
  Bricolage Grotesque, Lexend, and Outfit from Google Fonts.
- `src/styles/`: base styles and role/dashboard styles.
- `src/data/`: dictionary, built-in passages, placement items, and demo roster.
  `src/data/PASSAGE_SCHEMA.md` documents the shared passage contract.
- `src/components/`: navigation, app shell, and toast rendering.
- `src/pages/`: guest, student, teacher, admin, and supporting page views.
- `src/services/`: account/storage state, quizzes, tutor, and export behavior.
- `src/utils/`: common constants, selectors, speech, and reading helpers.
- `src/app.js`: delegated event handling and initial render call.
- `backend/`: reserved structure only; no server implementation exists yet.
- `tests/`: isolated reproduction tests for BW-006 through BW-009.

## Current limitations

The passage schema and library fixes cover BW-006 and BW-007. Authentication
and authorization are still browser-side demo behavior; browser storage is
shared at the origin level; backup restore issues remain; reports can include
sample values. Do not use real student accounts or records with this build.
