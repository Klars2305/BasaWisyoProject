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

This server binds to loopback and is for local testing. Accounts, practice,
progress, and reports remain in the browser prototype and are not suitable
for real student records or cross-device use.
