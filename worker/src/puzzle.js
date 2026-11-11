// Builds + validates the puzzle from puzzle.json. Used by the Worker and by check.mjs.
const norm = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
// looser normaliser for sentence answers: lowercase, drop punctuation, collapse spaces
const norm2 = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
export { norm, norm2 };

export function buildPuzzle(p) {
  const cells = new Map();          // "row,col" -> letter
  const words = [];
  for (const w of p.words) {
    if (!['across', 'down'].includes(w.dir)) throw new Error(`Bad dir for "${w.answer}" (use "across" or "down")`);
    if (!Number.isInteger(w.row) || !Number.isInteger(w.col) || w.row < 0 || w.col < 0) throw new Error(`Bad row/col for "${w.answer}"`);
    const a = norm(w.answer);
    if (!a) throw new Error('A word has an empty answer');
    for (let i = 0; i < a.length; i++) {
      const r = w.row + (w.dir === 'down' ? i : 0), c = w.col + (w.dir === 'across' ? i : 0), k = `${r},${c}`;
      if (cells.has(k) && cells.get(k) !== a[i]) throw new Error(`Crossing conflict at row ${r}, col ${c}: "${w.answer}" wants ${a[i]} but another word has ${cells.get(k)}`);
      cells.set(k, a[i]);
    }
    words.push({ dir: w.dir, row: w.row, col: w.col, len: a.length, clue: w.clue });
  }
  // clue numbers: reading order of start cells (across + down starting at the same cell share a number)
  const starts = [...new Set(words.map(w => `${w.row},${w.col}`))].map(k => k.split(',').map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const num = new Map(starts.map((s, i) => [s.join(','), i + 1]));
  words.forEach(w => { w.n = num.get(`${w.row},${w.col}`); });

  const letters = [];
  for (const [r, c] of p.red) {
    const k = `${r},${c}`;
    if (!cells.has(k)) throw new Error(`Red cell (${r},${c}) is not part of any word`);
    letters.push(cells.get(k));
  }
  const anagram = norm(p.anagram);
  if ([...letters].sort().join('') !== [...anagram].sort().join(''))
    throw new Error(`Red cell letters [${[...letters].sort().join('')}] don't match the anagram letters [${[...anagram].sort().join('')}]`);

  const audio = p.audio || {};
  if (!norm2(audio.answer) || !/^https?:\/\//i.test(String(audio.link || ''))) throw new Error('"audio" needs an "answer" and a "link" starting with https://');

  const keys = [...cells.keys()].map(k => k.split(',').map(Number));
  return {
    cells, words, anagram, red: p.red, next: String(p.next || ''), nextTicket: !!p.nextTicket,
    audio: { answer: norm2(audio.answer), link: String(audio.link) },
    rows: Math.max(...keys.map(k => k[0])) + 1, cols: Math.max(...keys.map(k => k[1])) + 1,
  };
}
