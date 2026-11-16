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
  if (typeof rawContext.isPlacement === "boolean") {
    context.isPlacement = rawContext.isPlacement;
  }
  const isPremium = Boolean(value.isPremium);
  return { message, history, context, isPremium };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function createChatHandler({
  key,
  provider,
  ask,
  now = Date.now
} = {}) {
  const requests = new Map();
  return async function chatHandler(req, res) {
    const activeKey = key !== undefined ? key : (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
    const activeProvider = provider !== undefined ? provider : (process.env.GROQ_API_KEY || !process.env.OPENAI_API_KEY ? "GroqCloud" : "OpenAI Responses API");
    const activeAsk = ask !== undefined ? ask : (process.env.GROQ_API_KEY ? askGroq : askOpenAI);

    if (req.url === "/api/chat/status" && req.method === "GET") {
      sendJson(res, 200, { onlineAvailable: Boolean(activeKey), provider: activeProvider });
      return;
    }
    if (req.url !== "/api/chat" || req.method !== "POST") {
      sendJson(res, 404, { error: "Not found." });
      return;
    }
    const origin = req.headers.origin;
    const port = req.socket?.localPort;
    const host = req.headers.host;
    const allowed = !origin
      || (port && origin === `http://127.0.0.1:${port}`)
      || (port && origin === `http://localhost:${port}`)
      || (host && (origin === `http://${host}` || origin === `https://${host}`))
      || origin.endsWith(".vercel.app")
      || (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN);

    if (!allowed) {
      sendJson(res, 403, { error: "Chat must be used from this local BasaWisyo app." });
      return;
    }
    if (!activeKey) {
      sendJson(res, 503, { error: "Online AI is not configured. Choose Offline help." });
      return;
    }
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
      sendJson(res, 415, { error: "Send JSON to this endpoint." });
      return;
    }
    const address = (req.headers && req.headers["x-forwarded-for"]) || req.socket?.remoteAddress || "local";
    const minute = Math.floor(now() / 60000);
    const record = requests.get(address);
    const count = record?.minute === minute ? record.count : 0;
    if (count >= 20) {
      sendJson(res, 429, { error: "Too many requests. Try again in a minute or use Offline help." });
      return;
    }
    requests.set(address, { minute, count: count + 1 });
    let input = null;
    if (req.body && typeof req.body === "object") {
      input = validChatInput(req.body);
    } else if (typeof req.body === "string" && req.body.length > 0) {
      try { input = validChatInput(JSON.parse(req.body)); }
      catch (_) { sendJson(res, 400, { error: "Send a valid JSON message." }); return; }
    } else {
      let raw = "";
      try {
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 16000) {
            sendJson(res, 413, { error: "Chat request is too long." });
            return;
          }
        }
        input = validChatInput(JSON.parse(raw));
      } catch (error) {
        sendJson(res, 400, { error: "Send a valid JSON message." });
        return;
      }
    }
    if (!input) {
      sendJson(res, 400, { error: "Check the message and try again." });
      return;
    }
    try {
      const reply = await activeAsk(input, { apiKey: activeKey });
      sendJson(res, 200, { reply, mode: "online" });
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "Send a valid JSON message." });
      } else if (error.status === 401 || error.status === 403) {
        sendJson(res, 503, { error: `${activeProvider} rejected the API key. Restart the local server with a valid key.` });
      } else if (error.status === 429) {
        sendJson(res, 429, { error: `${activeProvider} free limit reached. Wisyo switched to Offline help.` });
      } else {
        sendJson(res, 502, { error: "Online AI is unavailable. Choose Offline help and try again later." });
      }
    }
  };
}

module.exports = { createChatHandler, validChatInput };
