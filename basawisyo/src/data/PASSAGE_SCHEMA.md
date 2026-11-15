# Passage contract

`normalizePassage()` in `passage-schema.js` is the single conversion and
validation path for reading content. It returns the canonical form:

```js
{
  id: "cust_123",              // stable letters/numbers/_/- ID, up to 80 chars
  t: "Title",                  // 1–160 chars
  diff: "easy",                // easy | medium | hard | extreme
  lang: "en-US",               // optional: en-US | fil-PH | ceb-PH; older passages narrate as English
  x: "Passage text",           // 1–30,000 chars
  qs: [{                       // 1–20 questions
    q: "Question?",            // 1–500 chars
    o: ["Option A", "Option B"], // 2–6 nonempty options, up to 300 chars each
    a: 0,                      // zero-based index into o
    k: "Literal",              // skill name, 1–60 chars
    exp: "Optional explanation" // optional, up to 2,000 chars
  }],
  status: "published",         // draft | pending | rejected | published
  ownerId: "usr_teach_1",      // creator's local account ID
  author: "Optional author",
  createdAt: "Optional date",
  submittedAt: "Optional date",
  reviewedById: "Optional admin ID",
  reviewedAt: "Optional date",
  reviewNote: "Optional admin feedback"
}
```

Admins can publish new practices directly. Teachers can save a draft or submit
it as `pending`. An admin can approve a pending practice to make it `published`,
or reject it with a reason. Teachers can withdraw pending work, then edit or
resubmit their own draft or rejected work. Only `published` records appear in
the student library and teacher assignment selector. Existing admin
records with `tier`, `q`, and `skill` are converted to `diff`, `qs`, and `k`
when read. Legacy records without a status are treated as published. Stored
legacy records are **not rewritten on load**; their raw bytes remain available
for the later backup and migration work.

`getPublishedPassages()` is the shared reader collection. It includes the
24 built-in passages, valid published admin passages, and valid shared
passages, with IDs deduplicated. Invalid records remain in storage but are
excluded from the reader; the admin curriculum table labels them for repair.
These role and ownership checks operate in one browser's local storage. They
are not server-side authorization or cross-device synchronization.
