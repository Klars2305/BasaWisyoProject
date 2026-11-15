# Reviewed narration files

BasaWisyo uses free device speech until a reviewed recording is added. Record a
complete passage as one natural reading, keeping the spoken words exactly the
same as the passage text. Save the audio as `assets/audio/<passage-id>.mp3`
(`.ogg` and `.wav` also work). Recordings are ordinary static files and do not
call a voice API. Offline playback requires the app and audio files to be
present on the device; this prototype does not yet install them for offline use.

For a built-in passage, run `node tools/narration-template.mjs e1` (replace
`e1` with its ID). This prints the exact text, a numbered word guide, and
empty cue pairs. Enter the measured start and end time for each word, then
copy the object into the narration catalog. The `_wordGuide` field is for
authoring only and may be removed.

Add an entry to `src/data/narrations.js` after the recording and its word cues
have been reviewed. The entry has this shape:

```js
const RECORDED_NARRATIONS = Object.freeze({
  sample_id: {
    file: "assets/audio/sample_id.mp3",
    text: "The exact passage text, including punctuation.",
    cues: [[0.20, 0.55], [0.58, 1.05], [1.08, 1.35], [1.38, 1.85], [1.88, 2.25], [2.28, 2.70]]
  }
});
```

Each `[start, end]` pair is in seconds for one spoken word, in passage order.
There must be one pair for every word shown by the reader. Times must increase
without overlap. The text must match the published passage exactly. These
checks prevent a mismatched recording from highlighting the wrong words.

First record and review three passages across difficulty tiers. Check the
pronunciation of local names, clarity, natural pauses, background noise, and
word highlight on a phone. Add the remaining built-in passages only after
those samples sound right. Teacher-created passages without recordings keep
the free device voice. No paid API or database is required.
