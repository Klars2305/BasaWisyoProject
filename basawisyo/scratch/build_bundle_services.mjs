import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const serviceFiles = [
  "auth.js",
  "state.js",
  "hearts.js",
  "rewards.js",
  "quests.js",
  "bayanihan.js",
  "review.js",
  "flashcards.js",
  "journey.js",
  "board.js",
  "rankings.js",
  "mastery.js",
  "quiz.js",
  "tutor.js",
  "practice-helper.js",
  "exports.js",
  "backup.js",
  "local-data.js",
  "import-reader.js",
  "material-storage.js",
  "ai-question-generator.js",
  "assignments.js",
  "onboarding.js"
];

let bundle = "";
for (const file of serviceFiles) {
  const content = readFileSync(join(root, "src/services", file), "utf8");
  bundle += `/* === src/services/${file} === */\n${content}\n\n`;
}

writeFileSync(join(root, "src/bundles/bundle-services.js"), bundle, "utf8");
console.log("Successfully rebuilt src/bundles/bundle-services.js!");
