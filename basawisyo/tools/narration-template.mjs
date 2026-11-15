import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const id = process.argv[2];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/data/passages.js'), 'utf8');
const passages = vm.runInNewContext(`${source}\nPRACTICE_DATA`, {});
const passage = Object.values(passages).flat().find(item => item.id === id);

if (!passage) {
  console.error('Pass a built-in passage ID, for example: node tools/narration-template.mjs e1');
  process.exitCode = 1;
} else {
  const words = Array.from(passage.x.matchAll(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu),
    match => match[0]);
  console.log(JSON.stringify({
    file: `assets/audio/${id}.mp3`,
    text: passage.x,
    cues: words.map(() => [null, null]),
    _wordGuide: words.map((word, index) => `${index + 1}. ${word}`)
  }, null, 2));
}
