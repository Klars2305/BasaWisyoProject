# Assessment specification: questions for approval

**Status:** Draft questions for an adviser or reading specialist. No scoring
rule, threshold, reading-speed benchmark, or assessment name is approved by
this document. Do not use the current four-question diagnostic as a validated
placement assessment or claim its scores are official.

## What the current prototype does

- `src/pages/assess.js` calls the four-passage exercise a **Phil-IRI Diagnostic
  Placement**, says it accurately classifies readers, and displays an
  **Official Diagnostic Level** and a **DepEd Phil-IRI Scale**.
- `src/services/quiz.js` maps correct counts of 0–1, 2, 3, and 4 to
  Frustration, Instructional, Independent, and Mastery. With four items, those
  counts correspond to 0–25%, 50%, 75%, and 100%.
- The displayed scale in `src/pages/assess.js` instead describes 2/4 as
  59–79%, 3/4 as 80–89%, and 4/4 as 90–100%. The same scale appears in the
  admin benchmarks. It does not match the computed percentages.
- `src/services/quiz.js` supplies a fixed 110 WPM value to a guest result.
  `src/services/auth.js` seeds or defaults other WPM values, and the teacher
  view can fall back to 105 WPM. The prototype does not time reading.
- `src/services/state.js` stores a current level and aggregate counts, but
  not a durable, user-owned attempt with every answer and timing event.

## Blocking questions for the adviser or reading specialist

1. **Purpose and name.** Is this an informal app screening exercise, a
   classroom practice result, or an assessment intended to align with a named
   instrument? Which claims and labels may appear in the student, teacher,
   admin, and exported views? Is use of “Phil-IRI,” “DepEd,” “official,” and
   “diagnostic” authorized for this implementation?
2. **Population and form.** Which grades, languages, reading modes, and
   accommodations are supported? Are four passages with one question each
   sufficient for any placement decision? Who reviews passage difficulty,
   question validity, skill coverage, and answer keys? How are form versions
   and changes recorded?
3. **Scoring.** What is the exact unit of scoring: correct answers, weighted
   items, comprehension percentage, oral reading accuracy, speed, or a
   combination? Are partial credit and unanswered items allowed? What is the
   denominator after skipped or invalid questions? What rounding rule applies?
4. **Level boundaries.** What approved rule assigns each level for every
   possible result, including 0, 1, 2, 3, and 4 correct on this form? Should
   the 50% and 75% outcomes keep their current labels, or should the rubric,
   number of items, or both change? Do not infer new thresholds from the
   displayed bands.
5. **Completion and retakes.** Does a quit, timeout, missed item, or lost
   connection create an incomplete attempt or a score? May learners retake?
   Which result is displayed and reported: first, latest, best, or a reviewed
   result? Is the initial baseline preserved? Who may invalidate or override
   a result, for what reason, and with what audit trail?
6. **Reading speed.** Is WPM an approved outcome for this task? If so, what
   text and word-count method, start/end events, pauses, tab switches, text
   to speech use, rereading, and interrupted attempts count toward active
   reading time? What quality limits or outlier rules apply? If not approved,
   which WPM displays and exports must be removed or marked unavailable?
7. **Interpretation and action.** What evidence supports each label and
   recommendation? Are recommendations automated or reviewed by a teacher?
   What uncertainty or limitations must students and teachers see?
8. **Reporting.** Which raw fields must be stored to recalculate results:
   form/version, passage and item IDs, answers, correctness, timestamps,
   duration, accommodations, scorer/rubric version, and override history?
   Which aggregate and rounding rules must be identical in student views,
   teacher dashboards, admin views, and CSV exports? How are sample values
   separated from actual attempts?

## Approval record to complete before scoring changes

- Assessment owner and reviewer: **Pending**
- Intended purpose, population, and permitted name/claims: **Pending**
- Approved form and item review evidence: **Pending**
- Exact scoring function and full boundary examples: **Pending**
- WPM method or decision to hide WPM: **Pending**
- Retake, incomplete-attempt, override, and reporting rules: **Pending**
- Approval date and version of the specification: **Pending**

Until those answers are recorded, implementation should treat the existing
levels and WPM figures as prototype behavior, not validated measurements.
