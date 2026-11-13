# BasaWisyo source baseline

Captured on 2026-11-13 before application changes. The source snapshot is
`indexNew.html` at Git tag `baseline-2026-11-13`. Its SHA-256 is
`40A62029A56B548DA8E0D860A5BCC1B0C5D22977B4CFD8EBB42EE4E01F7A700A`.
The source file was not edited while capturing this baseline.

## Environment assumptions from the source

- The app is one HTML file with inline CSS and JavaScript. Open it in a modern
  browser; browser storage behavior for `file://` can vary, so a local HTTP
  origin is preferable for repeatable testing. No build step is present.
- It uses `localStorage`, `FileReader`, `Blob` downloads, and optional browser
  speech synthesis, clipboard, and `window.ai` features. Google Fonts requires
  network access; the images observed in the source are embedded data URLs.
- Browser state belongs to the page origin, not to an account. Changing origin,
  browser, or browser profile changes which stored records are visible.
- These are code-derived assumptions and storage shapes, not a live browser
  export or a claim that the application flows pass. No real student data was
  inspected or copied for this baseline.

## Current browser-state format

All persistent values below are JSON strings in `localStorage`. The `v2`
suffix is part of the key name; there is no schema version or validation in
the stored payload. See `AUTH` near line 1946 and `S` near line 2879.

| Key | Current JSON shape | Written by |
| --- | --- | --- |
| `basa_wisyo_users_v2` | Array of user objects | `AUTH.saveUsers()` |
| `basa_wisyo_session_v2` | Full current user object; key removed on logout | `AUTH.saveSession()` |
| `basa_wisyo_assignments_v2` | Array of assignment objects | `AUTH.saveAssignments()` |
| `basa_wisyo_guest_tokens_v2` | Object keyed by `GUEST-####` tokens | `AUTH.saveGuestTokens()` |
| `basa_wisyo_custom_passages_v2` | Array of admin-created passage objects | `AUTH.saveCustomPassages()` |
| `basa_wisyo_state_v2` | One global `S` object | `save()` |

The `S` defaults are `lvl: null`, `w: 0`, `ss: 0`, `done: []`, `sk: {}`,
`sh: []`, `sub: 0`, `l0: null`, `pay: 0`, `pm: 0`, `miss: null`,
`theme: "light"`, `fontScale: 1.0`, and `activeDiff: "all"`. On load,
stored `S` fields are shallow-merged with these defaults. `done` contains
passage IDs; `sk` maps skill names to `[correctCount, totalCount]`; `sh`
contains imported/shared passages. This state is not scoped by user ID.

User records have `id`, `email`, `password`, `name`, `role`, `school`,
`section`, `status`, and `createdAt`. Depending on role and history, they
can also have `teacherCode`, `shareCode`, `lvl`, `wpm`, `comp`, `wordsRead`,
and `isGuestImport`. Passwords are stored as plain text in the current code.
The session repeats the full user record, including its password.

Assignment records have `id`, `teacherCode`, `passageId`, `title`,
`targetGroup`, `dueDate`, and `note`. Guest-token values have `name`, `lvl`,
`wpm`, `comp`, and `timestamp`. Admin passage records currently use `id`,
`t`, `tier`, `x`, `q: [{q, o, a, skill}]`, `wc`, `author`, and `createdAt`.
The reader instead expects `diff`, `qs`, and question field `k`; this is
recorded here as a baseline mismatch, with no normalization applied yet.

The in-app backup download is an unversioned JSON object with `exportDate`,
`school`, `users`, `assignments`, `guestTokens`, `customPassages`, and
`systemState` (the current `S`). The current restore handler reads only the
four `AUTH` collections and omits `systemState`. Browser storage content was
not exported as part of this source baseline; a separate data backup and
restore exercise is the next Phase 1 task if relevant development data exists.

## Reproduce or revert the source snapshot

Use `git show baseline-2026-11-13:indexNew.html` to inspect the original
file and `git diff baseline-2026-11-13 -- indexNew.html` to inspect later
changes. The hash above checks byte-for-byte source identity.
