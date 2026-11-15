const { askOpenAI } = require("../services/openai");
const { askGroq } = require("../services/groq");

function validChatInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (!message || message.length > 1500) return null;
  if (!Array.isArray(value.history) || value.history.length > 8) return null;
  const history = [];
  for (const turn of value.history) {
    if (!turn || !["user", "assistant"].includes(turn.role)
        || typeof turn.text !== "string" || !turn.text.trim() || turn.text.length > 1500) return null;
    history.push({ role: turn.role, text: turn.text.trim() });
  }
  const rawContext = value.context ?? {};
  if (!rawContext || typeof rawContext !== "object" || Array.isArray(rawContext)) return null;
  let context = {};
  if (rawContext.passage != null) {
    const p = rawContext.passage;
    if (!p || typeof p.title !== "string" || !p.title.trim() || p.title.length > 160
        || typeof p.text !== "string" || !p.text.trim() || p.text.length > 8000) return null;
    context = { passage: { title: p.title.trim(), text: p.text.trim() } };
  }
  if (rawContext.question != null) {
    const q = rawContext.question;
    if (!context.passage || !q || typeof q.text !== "string" || !q.text.trim()
        || q.text.length > 500 || typeof q.skill !== "string" || q.skill.length > 60
        || typeof q.answered !== "boolean") return null;
    context.question = { text: q.text.trim(), skill: q.skill, answered: q.answered };
  }
  return { message, history, context };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function createChatHandler({
  key = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  provider = process.env.GROQ_API_KEY || !process.env.OPENAI_API_KEY ? "GroqCloud" : "OpenAI Responses API",
  ask = process.env.GROQ_API_KEY ? askGroq : askOpenAI,
  now = Date.now
} = {}) {
  const requests = new Map();
  return async function chatHandler(req, res) {
    if (req.url === "/api/chat/status" && req.method === "GET") {
      sendJson(res, 200, { onlineAvailable: Boolean(key), provider });
      return;
    }
    if (req.url !== "/api/chat" || req.method !== "POST") {
      sendJson(res, 404, { error: "Not found." });
      return;
    }
    const origin = req.headers.origin;
    const expectedOrigin = `http://127.0.0.1:${req.socket.localPort}`;
    if (origin && origin !== expectedOrigin) {
      sendJson(res, 403, { error: "Chat must be used from this local BasaWisyo app." });
      return;
    }
    if (!key) {
      sendJson(res, 503, { error: "Online AI is not configured. Choose Offline help." });
      return;
    }
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
      sendJson(res, 415, { error: "Send JSON to this endpoint." });
      return;
    }
    const address = req.socket.remoteAddress || "local";
    const minute = Math.floor(now() / 60000);
    const record = requests.get(address);
    const count = record?.minute === minute ? record.count : 0;
    if (count >= 20) {
      sendJson(res, 429, { error: "Too many requests. Try again in a minute or use Offline help." });
      return;
    }
    requests.set(address, { minute, count: count + 1 });
    let raw = "";
    try {
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 16000) {
          sendJson(res, 413, { error: "Chat request is too long." });
          return;
        }
      }
      const input = validChatInput(JSON.parse(raw));
      if (!input) {
        sendJson(res, 400, { error: "Check the message and try again." });
        return;
      }
      const reply = await ask(input, { apiKey: key });
      sendJson(res, 200, { reply, mode: "online" });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "Send a valid JSON message." });
      } else if (error.status === 401 || error.status === 403) {
        sendJson(res, 503, { error: `${provider} rejected the API key. Restart the local server with a valid key.` });
      } else if (error.status === 429) {
        sendJson(res, 429, { error: `${provider} free limit reached. Wisyo switched to Offline help.` });
      } else {
        sendJson(res, 502, { error: "Online AI is unavailable. Choose Offline help and try again later." });
      }
    }
  };
}

module.exports = { createChatHandler, validChatInput };
