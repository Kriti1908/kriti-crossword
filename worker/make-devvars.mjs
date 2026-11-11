// Run:  node make-devvars.mjs   -> writes worker/.dev.vars for LOCAL testing (git-ignored)
// For local runs the "next" link is pointed at the local audio page so the whole chain works on your machine.
import fs from 'fs';
const puz = JSON.parse(fs.readFileSync(new URL('./puzzle.json', import.meta.url)));
puz.next = 'http://localhost:8001/audio.html';
fs.writeFileSync(new URL('./.dev.vars', import.meta.url),
`PUZZLE_JSON=\`${JSON.stringify(puz)}\`
ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000,http://localhost:8001,http://127.0.0.1:8001
`);
console.log('wrote .dev.vars  (next link -> http://localhost:8001/audio.html)');
