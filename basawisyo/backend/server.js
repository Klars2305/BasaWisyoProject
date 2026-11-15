const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createChatHandler } = require("./routes/chat");
const { loadLocalConfig } = require("./config");

const root = path.resolve(__dirname, "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2"
};

function createAppServer(options = {}) {
  const chat = createChatHandler(options);
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname.startsWith("/api/")) {
      chat(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    let decoded;
    try { decoded = decodeURIComponent(pathname); }
    catch (error) { res.writeHead(400); res.end(); return; }
    const file = path.resolve(root, `.${decoded === "/" ? "/index.html" : decoded}`);
    const relative = path.relative(root, file);
    if (!file.startsWith(root + path.sep)
        || relative.split(path.sep).some(segment => segment.startsWith("."))
        || ["backend", "tests", "node_modules"].includes(relative.split(path.sep)[0])) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { res.writeHead(404); res.end(); return; }
      const type = types[path.extname(file).toLowerCase()];
      if (!type) { res.writeHead(403); res.end(); return; }
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      if (req.method === "HEAD") { res.end(); return; }
      fs.createReadStream(file).pipe(res);
    });
  });
}

if (require.main === module) {
  loadLocalConfig();
  const port = Number(process.env.PORT || 8765);
  createAppServer().listen(port, "127.0.0.1", () => {
    console.log(`BasaWisyo local server: http://127.0.0.1:${port}/index.html`);
    console.log(process.env.GROQ_API_KEY ? "GroqCloud AI configured"
      : process.env.OPENAI_API_KEY ? "OpenAI AI configured"
        : "Offline help only (set GROQ_API_KEY for online AI)");
  });
}

module.exports = { createAppServer };
