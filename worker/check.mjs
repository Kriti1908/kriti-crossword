// Run:  node check.mjs   -> validates worker/puzzle.json and prints the solved grid (red cells shown as [X])
import fs from 'fs';
import { buildPuzzle } from './src/puzzle.js';
const P = buildPuzzle(JSON.parse(fs.readFileSync(new URL('./puzzle.json', import.meta.url))));
const red = new Set(P.red.map(([r, c]) => `${r},${c}`));
for (let r = 0; r < P.rows; r++) {
  let line = '';
  for (let c = 0; c < P.cols; c++) {
    const k = `${r},${c}`, ch = P.cells.get(k);
    line += !ch ? ' .  ' : red.has(k) ? `[${ch}] ` : ` ${ch}  `;
  }
  console.log(String(r).padStart(2), line);
}
console.log('\nClue numbers:'); P.words.sort((a, b) => a.n - b.n).forEach(w => console.log(`${w.n} ${w.dir}  (row ${w.row}, col ${w.col}, ${w.len} letters)  ${w.clue}`));
console.log(`\nAnagram answer: ${P.anagram}   |   grid ${P.rows} x ${P.cols}   |   next link: ${P.next}\naudio-page answer: "${P.audio.answer}"   |   final link: ${P.audio.link}\nticket appended to next link: ${P.nextTicket}\nOK ✔`);
