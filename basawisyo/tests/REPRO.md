# BW-006 to BW-009 reproduction evidence

Captured against the componentized baseline before behavior fixes. At step 2,
the suite had one passing built-in passage control and four failing issue
tests. Step 3 fixed BW-006 and BW-007. Step 4 fixed BW-008 and BW-009 and
added backup validation and rollback tests. All 19 tests now pass.
Run `node --test tests/repro.test.mjs` from `basawisyo/`.

## BW-006 — Admin passage schema

1. Submit the admin passage form with a title, body, one question, four
   options, correct option `0`, and skill `Literal`.
2. The saved record in `AUTH.customPassages` has `tier`, `q`, and `skill`.
3. Pass that record to `startQuiz()`.

Originally observed: `P.qs.forEach` throws because `qs` is undefined. The reader also
expects `diff` and question skill `k`. Source: `src/app.js` practice-admin-save
handler and `src/services/quiz.js` `startQuiz()`.

## BW-007 — Admin passage library visibility

1. Save the same admin passage.
2. Render `viewPractice()`.

Originally observed: the new title is absent. `viewPractice()` reads built-in passages
and `S.sh` but not `AUTH.customPassages`. Source: `src/pages/practice.js`.

## BW-008 — Restore picker

1. Render the admin system tab.
2. Activate the restore button.

Originally observed: the view renders file input `admin-backup-file`, while the button
handler looks up `admin-restore-file`; the picker does not open. The change
handler also listens for `admin-restore-file`. Source: `src/pages/admin.js`
and `src/app.js`.

## BW-009 — Backup round trip

1. Set `S.w` to `1234` and `S.theme` to `dark`, then use the export action.
2. Confirm the exported JSON includes those values under `systemState`.
3. Change the in-memory values and feed the exported JSON to the restore
   handler directly (to isolate this issue from BW-008).

Originally observed: `S.w` and `S.theme` retain the changed values. The restore handler
loads the four `AUTH` collections but never assigns or saves `systemState`.
Source: `src/app.js` backup export and restore handlers.

All four reproductions use isolated test data. No user browser storage or
student records were read or modified.
