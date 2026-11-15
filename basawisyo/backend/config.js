const fs = require("node:fs");
const path = require("node:path");

const LOCAL_CONFIG = path.join(__dirname, ".env.local");

function parseLocalConfig(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*(GROQ_API_KEY|GROQ_MODEL)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function loadLocalConfig(file = LOCAL_CONFIG) {
  let values;
  try { values = parseLocalConfig(fs.readFileSync(file, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const name of ["GROQ_API_KEY", "GROQ_MODEL"]) {
    if (!process.env[name] && values[name]) process.env[name] = values[name];
  }
}

module.exports = { loadLocalConfig, parseLocalConfig };
