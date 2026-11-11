// Crossword backend (Cloudflare Worker). Answers, anagram and the hidden link live ONLY here.
import { buildPuzzle, norm, norm2 } from './puzzle.js';
const LIMITS = { solve: 40, audio: 20 };   // checks per IP per hour

// Stateless key that only the crossword's success reply hands out. Derived from the secret puzzle JSON, so it can't be guessed.
async function ticketFor(secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('audio-page-ticket'));
  return [...new Uint8Array(sig)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().toLowerCase()).includes(origin.toLowerCase());
    const cors = ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' } : {};
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    let P;
    try { P = buildPuzzle(JSON.parse(env.PUZZLE_JSON)); } catch { return out({ error: 'server not configured' }, 500); }
    const path = new URL(req.url).pathname;
    const ip = req.headers.get('CF-Connecting-IP') || 'local';

    // public layout only: positions, lengths, clues, red cells. NO letters.
    if (path === '/api/puzzle' && req.method === 'GET') {
      const words = [...P.words].sort((a, b) => a.n - b.n || (a.dir === 'across' ? -1 : 1));
      return out({ rows: P.rows, cols: P.cols, words, red: P.red, anagramLen: P.anagram.length });
    }

    if (path === '/api/solve' && req.method === 'POST') {
      const k = `r:solve:${ip}`, n = +(await env.KV.get(k) || 0);
      if (n >= LIMITS.solve) return out({ error: 'slow down, try again a bit later 🥺' }, 429);
      await env.KV.put(k, String(n + 1), { expirationTtl: 3600 });

      const b = await req.json().catch(() => ({}));
      const g = b.grid && typeof b.grid === 'object' ? b.grid : {};
      let wrong = 0;
      for (const [cell, ch] of P.cells) if (norm(g[cell]) !== ch) wrong++;
      if (wrong > 0) return out({ crossword: false, wrong });                 // anagram is never evaluated until the grid is perfect
      if (!norm(b.anagram)) return out({ crossword: true });                  // grid check only
      if (norm(b.anagram) === P.anagram) {
        let next = P.next;
        if (P.nextTicket) next += (next.includes('?') ? '&' : '?') + 't=' + await ticketFor(env.PUZZLE_JSON);
        return out({ crossword: true, anagram: true, next });
      }
      return out({ crossword: true, anagram: false });
    }

    // Audio page: needs the ticket from the crossword. With no answer it only says whether the ticket is valid.
    if (path === '/api/audio' && req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      if (String(b.t || '') !== await ticketFor(env.PUZZLE_JSON)) return out({ error: 'this page opens only after the crossword 🔒' }, 403);
      if (b.answer === undefined) return out({ ok: true });
      const k = `r:audio:${ip}`, n = +(await env.KV.get(k) || 0);
      if (n >= LIMITS.audio) return out({ error: 'slow down, try again a bit later 🥺' }, 429);
      await env.KV.put(k, String(n + 1), { expirationTtl: 3600 });
      if (norm2(b.answer) === P.audio.answer) return out({ correct: true, link: P.audio.link });
      return out({ correct: false });
    }
    return out({ error: 'not found' }, 404);
  },
};
