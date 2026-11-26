// Generates js/levels.js: the full list of sort levels for all pictures.
//  * which colours each level contains comes from the picture's paint needs
//    (1 sealed flask = 2 units of paint, 1 cell = 1 unit),
//  * difficulty is random per level (easy, medium or hard); the only rule: a hard level
//    is always followed by an easy one,
//  * a BFS solver proves every level solvable and scores its difficulty.
// Run: node tools/generate-levels.mjs   (deterministic: same seed -> same levels)
import { readFileSync, writeFileSync } from 'node:fs';

const SEED = 20261037;     // picked so the random difficulty order of the current 14 levels has 3 hard ones
const CAP = 4;            // layers per flask
const PAINT_PER_FLASK = 2;
const CANDIDATES = 260;   // random layouts tried per level
const PLAYOUTS = 80;      // random play-throughs used to estimate dead ends

const pics = JSON.parse(readFileSync(new URL('../js/pictures.js', import.meta.url), 'utf8')
  .replace(/^[\s\S]*?window\.PICTURES = /, '').replace(/;\s*$/, ''));

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rand = rng(SEED);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ───────── water sort rules (shared with js/sort.js) ─────────
const top = t => t[t.length - 1];
function runLen(t) { let n = 1; while (n < t.length && t[t.length - 1 - n] === top(t)) n++; return n; }
function canPour(a, b) {
  if (a === b || !a.length || b.length >= CAP) return false;
  if (a.length === runLen(a) && a.length === CAP) return false;        // full sorted flask: nothing to do
  if (!b.length) return a.length !== runLen(a);                        // pouring a whole single-colour flask into empty is pointless
  return top(a) === top(b);
}
function pour(state, i, j) {
  const s = state.map(t => t.slice()), a = s[i], b = s[j];
  const n = Math.min(runLen(a), CAP - b.length);
  for (let k = 0; k < n; k++) b.push(a.pop());
  return s;
}
const solved = s => s.every(t => !t.length || (t.length === CAP && runLen(t) === CAP));
const key = s => s.map(t => t.join('')).sort().join('|');
function moves(s) { const m = []; for (let i = 0; i < s.length; i++) for (let j = 0; j < s.length; j++) if (canPour(s[i], s[j])) m.push([i, j]); return m; }

function bfs(start, limit = 250000) {
  if (solved(start)) return 0;
  let frontier = [start]; const seen = new Set([key(start)]); let depth = 0;
  while (frontier.length) {
    depth++; const next = [];
    for (const s of frontier) for (const [i, j] of moves(s)) {
      const t = pour(s, i, j), k = key(t);
      if (seen.has(k)) continue;
      if (solved(t)) return depth;
      seen.add(k); next.push(t);
      if (seen.size > limit) return -1;
    }
    frontier = next;
  }
  return Infinity; // unsolvable
}
// share of random play-throughs that end with no legal move (a real loss in the game)
function deadRate(start) {
  let dead = 0;
  for (let p = 0; p < PLAYOUTS; p++) {
    let s = start, last = null;
    for (let step = 0; step < 160; step++) {
      if (solved(s)) break;
      let m = moves(s).filter(([i, j]) => !(last && last[0] === j && last[1] === i));
      if (!m.length) { dead++; break; }
      // players prefer pouring onto a matching colour over pouring into an empty flask
      const onto = m.filter(([, j]) => s[j].length);
      if (onto.length && rand() < 0.7) m = onto;
      const mv = m[Math.floor(rand() * m.length)]; s = pour(s, ...mv); last = mv;
    }
  }
  return dead / PLAYOUTS;
}
function layout(colors, empties) {
  const seg = shuffle(colors.flatMap(c => [c, c, c, c]));
  const tubes = colors.map((_, i) => seg.slice(i * CAP, i * CAP + CAP));
  for (let e = 0; e < empties; e++) tubes.push([]);
  return tubes;
}
const score = (mm, dr) => mm * (1 + 1.5 * dr);

// ───────── 1. which flasks go into each level ─────────
const plan = [];
pics.forEach((p, pi) => {
  const k = p.palette.length;
  const need = p.counts.map(n => Math.ceil(n / PAINT_PER_FLASK));
  while (need.some(n => n > 0)) {
    const colors = [], paid = new Array(k).fill(0);
    const inLevel = new Array(k).fill(0);
    for (let s = 0; s < k; s++) {
      const open = need.map((n, i) => [n, i]).filter(([n, i]) => n > 0 && inLevel[i] < 2); // max 2 flasks of one colour
      let c;
      if (open.length) {
        const max = Math.max(...open.map(([n]) => n));
        const best = open.filter(([n]) => n === max).map(([, i]) => i);
        c = best[Math.floor(rand() * best.length)]; need[c]--; paid[c]++;
      } else {                                         // filler flask: gives no paint ("enough")
        const fewest = Math.min(...inLevel);
        const pool = inLevel.map((n, i) => [n, i]).filter(([n]) => n === fewest).map(([, i]) => i);
        c = pool[Math.floor(rand() * pool.length)];
      }
      inLevel[c]++; colors.push(c);
    }
    plan.push({ pic: pi, colors, reward: paid.map(n => n * PAINT_PER_FLASK) });
  }
});

// ───────── 2. difficulty order: random ─────────
// each level draws easy / medium / hard (weights 2:3:1); after a hard level comes an easy one.
// Level 1 is the tutorial and is always easy.
function difficulty(total) {
  const bag = ['E', 'E', 'M', 'M', 'M', 'H'], out = [];
  for (let i = 0; i < total; i++) {
    if (i === 0 || out[i - 1] === 'H') out.push('E');
    else out.push(bag[Math.floor(rand() * bag.length)]);
  }
  return out;
}
const tiers = difficulty(plan.length);
const CORRIDOR = { E: [0.6, 0.8], M: [0.9, 1.1], H: [1.3, 1.5] };
// moves the player gets: the shortest solution plus room for mistakes, less room on harder tiers
// (integer maths so the result never depends on float rounding)
const SLACK = { E: [3, 5, 4], M: [2, 5, 3], H: [1, 4, 2] };   // ceil(min * a / b) + c extra moves
const moveLimit = (tier, mm) => { const [a, b, c] = SLACK[tier]; return mm + Math.ceil(mm * a / b) + c; };

// ───────── 3. build each level ─────────
const levels = [];
plan.forEach((pl, n) => {
  const tier = tiers[n], hiddenAllowed = pl.pic >= 2 && tier !== 'E';
  const growth = 1 + 0.02 * n;
  const gen = empties => {
    const out = [];
    for (let i = 0; i < CANDIDATES; i++) {
      const t = layout(pl.colors, empties);
      if (t.some(x => x.length === CAP && runLen(x) === CAP)) continue;   // no flask sorted from the start
      const mm = bfs(t);
      if (mm <= 0 || !isFinite(mm)) continue;
      out.push({ tubes: t, mm, dr: 0, s: 0, empties });
    }
    return out;
  };
  let cands = gen(2);
  for (const c of cands) { c.dr = deadRate(c.tubes); c.s = score(c.mm, c.dr); }
  const sorted = cands.map(c => c.s).sort((a, b) => a - b);
  const B = sorted[Math.floor(sorted.length / 2)] * growth;
  let [lo, hi] = CORRIDOR[tier].map(f => f * B);
  if (n === 0) { lo = 0; hi = sorted[0]; }                                // level 1: the gentlest layout
  if (tier === 'H' && pl.pic >= 1 && !cands.some(c => c.s >= lo && c.s <= hi)) {
    const one = gen(1); for (const c of one) { c.dr = deadRate(c.tubes); c.s = score(c.mm, c.dr); }
    cands = cands.concat(one);
  }
  const mid = (lo + hi) / 2;
  const fair = cands.filter(c => c.dr <= (tier === 'H' ? 0.6 : 0.25));   // a level must stay winnable for people
  if (fair.length) cands = fair;
  cands.sort((a, b) => Math.abs(a.s - mid) - Math.abs(b.s - mid));
  const pick = cands[0];
  if (!pick) { console.log("NO CANDIDATES", n, pl, tier); process.exit(1); }
  levels.push({
    n: n + 1, pic: pl.pic, tier, tubes: pick.tubes, reward: pl.reward,
    hidden: hiddenAllowed ? 2 : 0,          // "cobweb": bottom layers stay hidden until reached
    minMoves: pick.mm, moves: moveLimit(tier, pick.mm), deadRate: Math.round(pick.dr * 100) / 100, score: Math.round(pick.s * 10) / 10,
    base: Math.round(B * 10) / 10, inCorridor: pick.s >= lo && pick.s <= hi,
  });
  console.log(`#${n + 1} pic${pl.pic + 1} ${tier} colours[${pl.colors}] flasks ${pick.tubes.length} min ${pick.mm} moves ${moveLimit(tier, pick.mm)} dead ${pick.dr.toFixed(2)} score ${pick.s.toFixed(1)} B ${B.toFixed(1)} ${pick.s >= lo && pick.s <= hi ? '' : '(nearest)'}`);
});

writeFileSync(new URL('../js/levels.js', import.meta.url),
  '// Generated by tools/generate-levels.mjs — edit the generator, not this file.\nwindow.LEVELS = ' + JSON.stringify(levels) + ';\n');
console.log('levels:', levels.length, 'difficulty:', tiers.join(''));
