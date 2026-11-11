# 🧩 A very cute crossword

A pastel crossword. The player fills the grid, collects the letters from the **red boxes**, unscrambles them into
a secret word, and unlocks the next page. Same architecture as the trivia site: a **static front end** (GitHub Pages)
plus a tiny **Cloudflare Worker** that holds every secret.

## Project structure (put files exactly here)

If your download shows the files flat, recreate these folders. `index.html` / `index.js` appear in different folders.

```
kriti-crossword/                ← repo root (what you push to GitHub)
├── .gitignore                  ← keeps puzzle.json out of git (don't delete)
├── README.md                   ← this file
│
├── docs/                       ← THE WEBSITE (GitHub Pages serves this folder)
│   ├── index.html              ← the crossword page. Edit for colours / text / the decoy link
│   ├── audio.html              ← page 2: the audio question. Only opens with the key from the crossword
│   ├── config.js               ← EDIT: paste your crossword Worker URL (used by both pages)
│   ├── audio/
│   │   ├── clip.mp3            ← the clip the player listens to (mp3 for Safari/iPhone)
│   │   └── clip.ogg            ← same clip (ogg, fallback). Replace BOTH if you change the clip
│   └── img/
│       ├── cheer.gif           ← happy cat on the crossword success screen
│       └── muehehe-cat.png     ← the cat on the final page
│
└── worker/                     ← THE BACKEND (deployed to Cloudflare, NOT GitHub Pages)
    ├── wrangler.toml           ← EDIT: your KV id + your GitHub Pages origin
    ├── puzzle.json             ← YOUR REAL PUZZLE (words, clues, red cells, anagram, audio answer, links). Git-ignored
    ├── puzzle.example.json     ← tiny template showing the format. Safe to commit
    ├── check.mjs               ← run `node check.mjs` to validate puzzle.json + preview the grid
    └── src/
        ├── index.js            ← the API (checking, rate limit, hidden link release)
        └── puzzle.js           ← builds/validates the puzzle, numbers the clues
```

| I want to… | File |
|---|---|
| Change words, clues, red cells, anagram, the audio-page answer, or either link | `worker/puzzle.json` (then re-upload the secret, see §2) |
| Change the audio clip or final cat | replace `docs/audio/clip.mp3` + `clip.ogg` / `docs/img/muehehe-cat.png` |
| Point the website at the server | `docs/config.js` |
| Allow my GitHub Pages site to call the server | `ALLOWED_ORIGINS` in `worker/wrangler.toml` |
| Change the decoy (rickroll) link | `RICKROLL` constant near the top of the script in `docs/index.html` |
| Change colours, fonts, text | `docs/index.html` |
| Change the success-screen gif | replace `docs/img/cheer.gif` |
| Change the hourly check limit | `LIMITS` at the top of `worker/src/index.js` |

Only `docs/` is public. Only `worker/` goes to Cloudflare. **`worker/puzzle.json` must never be committed.**

## 1. How the game works

1. The page loads the **layout** from the server (grid size, clue text, word lengths, which cells are red). It never receives any letters.
2. The player types letters. **Check crossword** sends the grid to the server, which replies "perfect" or "N cells empty/wrong".
3. The red letters appear as tiles at the bottom (in a scrambled order on purpose). The player types the secret word and clicks **Unlock**.
4. Only if the grid is fully correct **and** the word is right does the server send back the hidden link.
5. Success screen: a button that goes to the decoy (rickroll) link, plus the **real link printed in the same colour as the
   background** (select the page with Ctrl/Cmd+A, or drag over the blank area, to reveal it). That link only ever exists in
   the browser after a correct solve.

### Page 2: the audio question (`audio.html`)

After a correct crossword the hidden link is `…/audio.html?t=<key>`. The key is created by the server and is only ever
sent in the reply to a correct solve, so the audio page can't be opened (or answered) by someone who skipped the crossword:
without a valid key the page just says "Not yet! 🔒" and the server refuses every answer.

On the page the player hears the clip and is asked what was in the *other* clip. The answer is checked on the server
(ignoring case, punctuation and extra spaces, so `God, you look so pretty…!` still matches). A correct answer returns the final
link, which is shown with the cat photo. The answer and the final link exist only in the secret, never in the website files.
Limit: 20 answer attempts per IP per hour.

Notes: the key is derived from your secret `PUZZLE_JSON`, so if you change `puzzle.json` and re-upload it, any old
`audio.html?t=…` links people saved stop working (new solves get fresh ones). If your GitHub repo isn't named `kriti-crossword`,
update `"next"` in `puzzle.json` to match your real Pages URL.

## 2. Your puzzle: `worker/puzzle.json`

```json
{
  "anagram": "babyjaan",
  "next": "https://<you>.github.io/<repo>/audio.html",
  "nextTicket": true,
  "audio": { "answer": "the sentence in the other clip", "link": "https://final-link" },
  "red": [[8,2],[19,7],[3,12],[14,0],[2,11],[12,4],[10,7],[6,7]],
  "words": [
    { "dir": "across", "row": 14, "col": 0, "answer": "BLOCKCHAIN", "clue": "teamed up for the first time" }
  ]
}
```

- **Coordinates are 0-indexed from the top-left**: `row` goes down, `col` goes right. `row`/`col` is where the word's *first letter* sits.
- `dir` is `"across"` or `"down"`. Letters from `answer` are placed one per cell in that direction. Crossing words must agree on the shared letter.
- **Clue numbers are automatic** (reading order of start cells, like a newspaper). You never number them.
- `red` is a list of `[row, col]` cells to outline in red. The letters in those cells must be exactly the letters of `anagram`
  (any order). The **order you list them in is the order the tiles show up**, so list them scrambled
  (don't sort them top-to-bottom, that can spell the answer by accident).
- `anagram` is matched ignoring case, spaces and punctuation ("Baby Jaan" == "babyjaan").
- `next` is the hidden link shown after the crossword. With `"nextTicket": true` the server appends the secret `?t=` key
  to it (needed for `audio.html`). Set it to `false` if `next` points somewhere that doesn't need a key.
- `audio.answer` is the expected sentence (case, punctuation and extra spaces are ignored). `audio.link` is the final link
  and must start with `https://`.

**Always validate after editing:**

```
cd worker
node check.mjs
```

It prints the solved grid (red cells as `[X]`), every clue number/position, and errors out with a clear message on a
crossing conflict, a red cell that isn't on a word, or red letters that don't match the anagram.

Upload your changes (no website redeploy needed):

```
cd worker
npx wrangler secret put PUZZLE_JSON < puzzle.json         # macOS / Linux / Git Bash
# PowerShell:  Get-Content puzzle.json | npx wrangler secret put PUZZLE_JSON
```

(`secret put` takes only the name. The value comes from the `<` file or from the prompt. Never type it after the name.)

## 3. Deploy (one time)

This is a **second Worker** with its own name and KV namespace; your trivia Worker is untouched.

```
cd worker
npx wrangler login
npx wrangler kv namespace create KV        # copy the printed id into wrangler.toml (id = "...")
# check ALLOWED_ORIGINS in wrangler.toml is your Pages origin: lowercase, no path, no trailing slash
npx wrangler secret put PUZZLE_JSON < puzzle.json
npx wrangler deploy                         # prints https://kriti-crossword-api.<your-subdomain>.workers.dev
```

Then:

1. Put that URL in `docs/config.js` (no trailing slash).
2. Make a **new GitHub repo** for this (e.g. `kriti-crossword`), push, and in **Settings → Pages** choose `main` / `/docs`.
3. Because the origin is only `https://<username>.github.io` (the repo path isn't part of it), the same `ALLOWED_ORIGINS` value works for both your trivia and crossword sites.
4. Open `https://<username>.github.io/kriti-crossword/`. Confirm `…workers.dev/api/puzzle` returns JSON with **no letters** in it.
5. Re-upload the secret after any `puzzle.json` change (§2) and `npx wrangler deploy` again after the code changes in this version.

Right after first creating a `workers.dev` URL you can briefly see an SSL error; that clears within a few minutes.

## 4. Security notes

| Thing | Where it lives |
|---|---|
| All answers, the anagram, the audio-page answer, both links | Worker secret `PUZZLE_JSON` only |
| Grid checking | Server. The browser sends its letters and gets back only "n wrong" |
| Skipping straight to the anagram | The anagram is never even evaluated until the whole grid is correct |
| The hidden link | Sent only in the reply to a fully correct grid + correct word |
| Skipping to the audio page | Needs the key issued only after a correct crossword; the server rejects answers without it |
| Abuse | 40 crossword checks and 20 audio answers / IP / hour (KV-based) |

**Honest limits:** the "n cells wrong" feedback could in theory be probed letter-by-letter by a script. At 40 checks an hour
that takes days, which is fine for this audience. If you want it stricter, drop the count: change `{ crossword: false, wrong }`
in `worker/src/index.js` to return only `{ crossword: false }` and update the message in `docs/index.html`. The decoy link and the
background-coloured link are obscurity by design (the real link is visible in DevTools *after* solving). Anything printed to
a browser can always be read by that player; the point is that they have to solve it first.

## 5. Tips

- **Test locally (no Cloudflare login needed):** see "Testing locally" in the root of this zip's `TESTING-LOCALLY.md`
  (short version: `cd worker && cp quiz.example.json quiz.json` if needed, `node make-devvars.mjs`, `npx wrangler dev --port 8787`,
  serve `docs/` on port 8000, and put `window.API_URL = "http://localhost:8787";` in `docs/config.local.js`).
- Controls: click a cell (click again to flip across/down), type to auto-advance, arrow keys move, Backspace goes back, clicking a clue jumps to it.
- A puzzle layout change = new coordinates. Edit `puzzle.json`, run `node check.mjs`, re-upload the secret.
- Free tier: KV allows ~1000 writes/day; each check is one write.
