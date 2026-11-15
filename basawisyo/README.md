# BasaWisyo

This directory is the component-organized copy of the `indexNew.html`
baseline. The visual interface and existing application logic were retained.
The original file remains at the repository root and is tagged
`baseline-2026-11-13` for comparison.

## Run locally

Run `python -m http.server 8765`, then open
`http://127.0.0.1:8765/index.html` in a modern browser. No build or package
installation is required for guest use and browser-local accounts. The HTML loads the JavaScript files in their
original execution order as classic scripts, so the current global state and
event handlers continue to work. The public entry screen offers guest access
and links to the separate `login.html` sign-in page. Registration stays in
the app. `node --check` can check each JavaScript file.

For automatic GroqCloud help, create an API key in your own GroqCloud account
and paste it after `GROQ_API_KEY=` in `backend/.env.local`. Keep this private
file on your computer; Git ignores it, but remove it before sharing a ZIP of
the project. From this directory, run
`powershell -NoProfile -File backend/start-basa.ps1`. The launcher starts the
local Node server and opens `http://127.0.0.1:8765/index.html`. Restart the
server after changing the key. You can also run `node backend/server.js`
directly; it reads the same private file. Never add the key to HTML, browser
JavaScript, source control, or chat. `GROQ_MODEL` can optionally override the
default `openai/gpt-oss-120b` model. The Python static server supports Offline
help only. Confirm that your GroqCloud account is on its Free plan; this app
cannot control account billing.

Wisyo offers passage-focused reading help and hints before a quiz answer,
then can explain a recent mistake after the learner answers. With the local
Node server and a key, Wisyo automatically tries GroqCloud. If the server,
internet, key, or free-tier quota prevents an online reply, it uses Offline
help and retries a later message. The status label shows the current mode.
The app sends the current passage, question status, and recent chat to Groq,
but not account records or quiz answer keys.

Reader **Voice settings** offer language, device voice preview, and speed
without a paid speech API. English is the default for older passages; teachers
can choose English, Filipino, or Cebuano when creating a practice. If a
reviewed human recording and word cues exist for a passage, the reader uses it
with word highlighting. See [assets/audio/README.md](assets/audio/README.md)
for the recording workflow. No human recordings are bundled yet, so playback
currently uses available device voices. Voice quality and offline availability
vary by device. Device voices that do not report word timing use approximate
word pacing so the current word still turns yellow; reviewed recording cues
remain the accurate option.

Reading and quizzing use separate stages. Learners read a passage, then answer
one question at a time; **View passage** returns to the text without clearing
the current answer. A new passage in placement starts with its reading stage.
Narration highlights words without moving the page by default. **Follow
narration as it reads** enables automatic tracking, and manual scrolling turns
that option off. Changing settings or rerendering the same view does not force
the page back to the top.

## File map

- `index.html`: public entry, registration, and app markup with ordered scripts.
- `login.html`: separate sign-in page using `src/pages/login.js`.
- `assets/images/wisyo.png`: one copy of the formerly repeated embedded image.
- `assets/audio/`: reviewed narration files and cue instructions; no recordings bundled yet.
- `assets/fonts/`: reserved for bundled fonts; current styles still request
  Bricolage Grotesque and Lexend from Google Fonts, with system fallbacks offline.
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
- Public registration creates browser-local student or teacher accounts.
  Teachers provide a class section and receive a share code. Admin accounts
  remain managed from the prototype admin account-management view.
- The Reading Journey recommends the next passage and opens Easy → Medium →
  Hard → Extreme gradually. Two distinct passages with at least two questions,
  at least half correct in each, and 75% correct combined open the next tier;
  retries keep the best result. Placement can start stronger readers at Medium
  or Hard, but never directly at Extreme. A linked teacher can grant extra tier
  access on the same browser. These are prototype practice rules, not validated
  Phil-IRI scoring rules. Guest journey results transfer when registering a
  student account. Older shared `done` flags have no attributable quiz scores,
  so they do not unlock tiers.
- Reading badges mark a first story, a perfect passage, a better retry, three
  distinct stories, and correct literal or inference questions across passages.
  Repeating the same question does not add badge evidence. Learners can choose
  unlocked cosmetic avatar frames on Home. Badge evidence and frame choice stay
  in the local journey record and transfer with guest progress during student
  registration; they do not affect scores or tier unlocks.
- The optional Class Board shows generated reader labels within one linked
  teacher's class. Learners can join or leave anytime. It ranks distinct
  qualifying stories within a chosen tier, with ties sharing a place; personal
  activity ranks count stories across tiers. Guest progress never automatically
  opts a new student account in. The board uses accounts in this browser only,
  so it is not a cross-device or server-authorized leaderboard.
- Student navigation has a dedicated Profile view for the signed-in learner's
  reading journey, completed stories, badges, rank, and profile frame. Guests
  see their own browser-local My Progress view. This view does not use the
  shared legacy word and session counters as per-student measurements.
- Teacher and admin accounts can open the Reports preview, sample Form 14,
  sample CSV, and print action. Guests and students cannot reach those actions
  through the app. The preview uses a fixed demo roster and remains unsuitable
  for official submissions or real student data.
- `src/services/`: account/storage state, quizzes, tutor, export, and backup
  behavior. `src/services/BACKUP_FORMAT.md` documents backup version 1.
- `src/utils/`: common constants, selectors, speech, and reading helpers.
- `src/app.js`: delegated event handling and initial render call.
- `backend/`: loopback-only local app server and OpenAI chat route. It is not
  ready for public hosting and does not store account or learning data.
- `tests/`: isolated reproduction tests for BW-006 through BW-009.
- `docs/`: draft permissions matrix and assessment-specification questions
  for review before implementing the P0 account and scoring work, plus the
  first-batch smoke report and issue tracker.

## Current limitations

The passage schema and library fixes cover BW-006 and BW-007. Backup restore
now covers BW-008 and BW-009. Authentication and authorization are browser-side
demo behavior; no shared account service is configured. Browser storage is
shared at the origin level; reports can include sample values. Backup files
include plaintext demo passwords. Practice approval is also local to one
browser; it does not sync teacher and admin devices. Do not use real student
accounts or records with this build. Wisyo Online AI sends the learner's message, current passage, and
recent chat to OpenAI only when selected; Offline help stays in the browser.
Reading Journey records and teacher overrides are also local to this browser;
they do not synchronize across devices or provide secure authorization.
