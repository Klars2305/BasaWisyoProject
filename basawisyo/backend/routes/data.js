const { openLocalStore } = require("../database/local-store");

function send(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

function createDataHandler(options = {}) {
  const store = options.store || openLocalStore(options.filename);
  return Object.assign(async function dataHandler(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    const allowedOrigins = [`http://127.0.0.1:${req.socket.localPort}`, `http://localhost:${req.socket.localPort}`];
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) {
      send(res, 403, { error: "Use this API from the local BasaWisyo app." });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/data/status") {
      send(res, 200, { available: true, storage: "SQLite", localOnly: true });
      return;
    }
    if (req.method !== "POST" || url.pathname !== "/api/data/sync") {
      send(res, 404, { error: "Not found." });
      return;
    }
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
      send(res, 415, { error: "Send JSON." });
      return;
    }
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 5_000_000) {
          send(res, 413, { error: "Sync payload is too large." });
          return;
        }
      }
      send(res, 200, store.sync(JSON.parse(body)));
    } catch (error) {
      send(res, error instanceof SyntaxError ? 400 : 422, { error: error.message });
    }
  }, { close: () => store.close() });
}

module.exports = { createDataHandler };
