const { createChatHandler } = require("../../backend/routes/chat");

const handler = createChatHandler();

module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  req.url = "/api/chat/status";
  return handler(req, res);
};
