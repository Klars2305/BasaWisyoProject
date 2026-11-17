`node backend/server.js` runs the local BasaWisyo app and Wisyo chat route on
`127.0.0.1:8765`. Place `GROQ_API_KEY=` and your key in the private
`backend/.env.local` file. The server loads it at startup, and
`powershell -NoProfile -File backend/start-basa.ps1` starts the server and
opens the app. Git ignores this file; remove it from any ZIP you share.
Environment variables take precedence over the local file. `GROQ_MODEL`
optionally overrides the default `openai/gpt-oss-120b` model. Never place a
key in browser code.

The chat route checks input size, same-origin browser requests, and a local
request limit. It sends only the chat message, up to eight recent turns, and
the current reading passage/question context. It does not send account
records or quiz answer keys. The Groq integration uses Chat Completions;
OpenAI responses are requested with `store: false`. The browser automatically
tries GroqCloud when configured and switches to offline help on connection,
key, or free-tier errors; there is no mode dropdown.

Use Node.js 24 or newer. The local server also creates `backend/database/basawisyo.sqlite` on first
start. It is ignored by Git. While the app is open at `127.0.0.1`, the browser
sends its existing accounts (without passwords or password hashes), per-student state, placement
results, quiz attempts, classroom links, materials, and assignments to this
relational copy. Repeated payloads and attempts are deduplicated. The browser
keeps its offline copy; reopening the page sends pending changes when the
local server is available. Back up both the browser data and SQLite file.

Student share codes create pending enrollment requests. The teacher reviews
them in Classroom Hub. Accepted requests become classroom memberships;
declined and pending requests stay out of rosters, class reports, and boards.
Existing linked students remain active. This local copy records the request
and decision but does not synchronize separate devices or provide server-side
teacher authentication.

This is a localhost pilot data layer. The browser still handles sign-in and
some scoring and reporting. The SQLite copy does not yet provide secure
server-authenticated student isolation or cross-device accounts. Use the
current demo/sample reports only for layout review, not official submission.
