# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** Elementary school learners (Philippine K-12, aligned with Phil-IRI diagnostic and developmental reading contexts) practicing reading comprehension across English, Filipino, and Cebuano.
- **Secondary:**
  - Teachers: Assigning reading practices, tracking class comprehension and progress via section share codes and rosters, and authoring custom practice passages with questions.
  - School Administrators: Reviewing and approving teacher-submitted reading passages, overseeing benchmarks and school catalog.
  - Guests: Independent learners accessing the platform immediately without requiring prior account registration.

## Product Purpose

BasaWisyo is an interactive literacy companion and diagnostic reading platform designed to build reading fluency and comprehension for Philippine elementary students. It pairs tiered reading passages and comprehension quizzes with Wisyo—an AI reading companion—and text-to-speech synchronized word highlighting. Success means learners independently build reading stamina and comprehension across languages without feeling judged, while teachers receive authentic visibility into classroom reading performance.

## Positioning

Unlike generic quiz apps or open-ended chatbot interfaces, BasaWisyo grounds the AI tutor ("Wisyo") strictly in the active reading passage and comprehension context. Wisyo acts Socratically: it guides learners with contextual vocabulary hints, background explanations, and post-answer mistake clarifications without ever giving away test answers or hallucinating unrelated content. It functions offline-first, adapting gracefully between cloud AI (Groq) and deterministic on-device fallback.

## Operating Context

- Philippine public and private elementary school classroom environments and home study with varied connectivity (low bandwidth, intermittent internet, or offline devices).
- Multilingual instruction context: Mother Tongue / Cebuano, Filipino, and English.
- Device environments: Desktop/laptop browsers, classroom computer labs, and shared browser terminals using modern Chromium, Firefox, or Safari.
- Phil-IRI (Philippine Informal Reading Inventory) assessment workflows: diagnostic screening, oral/silent reading stages, comprehension scoring (Frustration, Instructional, Independent, Mastery), and reading speed estimation (WPM).

## Capabilities and Constraints

- **Zero-Build Architecture:** Pure client-side static web app (vanilla HTML/JS/CSS) requiring no build step, bundler, or compilation. Runs via any static file server (or Python `http.server`).
- **Offline-First Data Storage:** Uses browser `localStorage` for user accounts, attempt history, journey progression, and class rosters. No mandatory central database required for core usage.
- **Wisyo AI Integration & Resilience:** Local Node server (`backend/server.js`) or Vercel serverless function (`api/`) acts as proxy to GroqCloud LLM (default `openai/gpt-oss-120b`). If offline or without API key, fails over gracefully to deterministic offline heuristic hints without crashing.
- **Reading Stages & Audio Sync:** Separates the reading passage stage from the question-answering stage. Synchronized word-by-word highlighting via Web Speech API or reviewed audio cues.
- **Reading Journey & Tiering:** Gamified progression across tiers (Easy → Medium → Hard → Extreme). Advancement gated by accuracy rules (minimum passage count and score thresholds). Includes placement diagnostic.
- **Durable Constraints & Undecided Items:**
  - Strict server-enforced authentication/authorization is currently draft/prototype; all data currently lives in browser-local storage.
  - Diagnostic Phil-IRI scoring formula and official DepEd compliance remain subject to reading specialist review (tracked in `docs/ASSESSMENT_SPEC_QUESTIONS.md`).
  - Passage schema strictly follows `src/data/PASSAGE_SCHEMA.md`.

## Brand Commitments

- **Name:** BasaWisyo (portmanteau of *Basa* [Filipino for "read"] and *Wisyo* [Filipino for "sense/wisdom/sanity"]).
- **Mascot & Personality:** "Wisyo" the owl companion (`assets/images/wisyo.png`), encouraging, patient, culturally respectful, educational, and non-punitive.
- **Typography Commitments:** Bricolage Grotesque (headings/display) and Lexend (reading body / comprehension-optimized typography) with clean system sans fallbacks for offline operation.

## Evidence on Hand

- Built-in reading catalog and multilingual passages (`src/data/passages.js`, `src/data/placement.js`).
- Passages schema specification (`src/data/PASSAGE_SCHEMA.md`).
- Assessment specification and open questions (`docs/ASSESSMENT_SPEC_QUESTIONS.md`).
- Draft permissions matrix (`docs/PERMISSIONS_MATRIX.md`).
- Mascot asset (`assets/images/wisyo.png`).
- Audio cues schema and folder (`assets/audio/`).
- Full working UI implementation (`index.html`, `login.html`, `src/styles/`, `src/pages/`).

## Product Principles

1. **Never Give Away the Answer:** Wisyo scolds nobody and solves no quiz questions directly; it illuminates clues within the text so the learner discovers the answer themselves.
2. **Resilient Under Any Connectivity:** A lost connection or missing API key must never stall learning. The reader, narration, offline helper, and local journey progress remain fully functional offline.
3. **Praise Effort, Honor Progress:** Progression is earned through comprehension and deliberate retries, celebrating incremental milestones with badges and cosmetic rewards rather than high-stakes pressure.
4. **Teacher Visibility Without Administrative Burden:** Simple classroom share codes and local roster aggregations provide actionable student insight without requiring complex enterprise setup.

## Accessibility & Inclusion

- Support for learners with reading difficulties via comprehension-friendly typography (Lexend), customizable text-to-speech narration speed, and synced visual word-tracking.
- Trilingual support reflecting Philippine linguistic reality: English, Filipino, and Cebuano.
- High-contrast visual cues and non-color-only state indicators for quiz feedback and tier unlocks.
