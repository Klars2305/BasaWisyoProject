import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("Passage Answer Diversity: Extreme difficulty questions have varied answer distribution", () => {
  const passagesFile = fs.readFileSync(path.join(rootDir, "src", "data", "passages.js"), "utf8");
  
  // Extract extreme questions block
  const extMatch = passagesFile.match(/extreme:\s*\[([\s\S]*?)\]\s*,\r?\n\s*\/\//) || passagesFile.match(/extreme:\s*\[([\s\S]*?)\]\s*\r?\n\s*\};/);
  assert.ok(extMatch, "Must find extreme block in passages.js");
  
  const answers = [...extMatch[1].matchAll(/a:\s*(\d+)/g)].map(m => Number(m[1]));
  assert.equal(answers.length, 13, "Must have exactly 13 extreme questions");

  // Count answer distribution
  const count0 = answers.filter(a => a === 0).length; // A
  const count1 = answers.filter(a => a === 1).length; // B
  const count2 = answers.filter(a => a === 2).length; // C
  const count3 = answers.filter(a => a === 3).length; // D

  assert.ok(count0 >= 2, "Option A must appear at least twice as the correct answer");
  assert.ok(count1 >= 2, "Option B must appear at least twice as the correct answer");
  assert.ok(count2 >= 2, "Option C must appear at least twice as the correct answer");
  assert.ok(count3 >= 2, "Option D must appear at least twice as the correct answer");

  // Assert that not all answers are B
  const allB = answers.every(a => a === 1);
  assert.equal(allB, false, "Answers must not all be 'B' (index 1)");
});
