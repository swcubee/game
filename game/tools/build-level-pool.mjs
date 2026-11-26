// Builds js/level-pool.js: a pool of solver-checked flask layouts ("templates") that the game turns into
// sort levels at runtime (js/levelgen.js), for any picture, without a pre-made level list.
//
// A template is written with abstract colour labels. For a level with k paint flasks and d different colours,
// labels 0 .. k-d-1 fill two flasks each (8 layers) and the other labels one flask each. The game maps labels
// to the colours the picture needs and shuffles the flask order, so one template gives many different levels.
// Relabelling and reordering never change how hard a layout is, so the solver's numbers stay valid.
//
// Every template is solved by BFS (shortest solution = minMoves) and scored with random play-throughs
// (share of dead ends). The game picks easy / medium / hard templates by score percentile.
//
// Run: node tools/build-level-pool.mjs            (deterministic; takes several minutes, uses all CPU cores)
//      node tools/build-level-pool.mjs --quick    (small pool for a fast check, not for commit)
//      results per key are cached in dist/pool-cache; pass --fresh after changing rules or scoring
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import vm from 'node:vm';

const SEED = 20261126;
const PLAYOUTS = 80;      // random play-throughs per template to estimate dead ends
const BUDGET_MS = 150000; // time per key; big keys with few colours are slow to solve and keep what they found
// [paint flasks k, different colours d, empty flasks e, templates wanted]
// k goes up to 10 and d up to 8 (design/progression.md: at most 8 colours and 10 paint flasks in a level).
// A colour fills at most two flasks, so d >= k/2. e = 1 is offered for hard levels from picture 5 (k >= 8).
const KEYS = [];
for (let k = 3; k <= 10; k++) for (let d = Math.max(2, Math.ceil(k / 2)); d <= Math.min(k, 8); d++) {
  KEYS.push([k, d, 2, k <= 5 ? 100 : k <= 7 ? 60 : 30]);
  if (k >= 8 && d >= 6) KEYS.push([k, d, 1, 30]);
}
const FRESH = process.argv.includes('--fresh');   // ignore results cached in dist/pool-cache
const QUICK = isMainThread ? process.argv.includes('--quick') : workerData.quick;

// the game's own rules, so the solver and the game can never disagree
function loadRules() {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../js/rules.js', import.meta.url), 'utf8'), ctx);
  return ctx.window.Rules;
}

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function buildKey({ key: [k, d, e, want] }) {
  const R = loadRules(), CAP = R.CAP;
  const rand = rng(SEED + k * 1000 + d * 10 + e);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const skey = s => s.map(t => t.join('')).sort().join('|');      // order of flasks does not matter to the solver
  const limit = 800000;                                    // states; a bigger search is slow and runs out of memory
  const t0 = Date.now();

  function bfs(start) {
    if (R.solved(start)) return 0;
    let frontier = [start]; const seen = new Set([skey(start)]); let depth = 0;
    while (frontier.length) {
      depth++; const next = [];
      for (const s of frontier) for (const [i, j] of R.usefulMoves(s)) {
        const t = R.pour(s, i, j), key = skey(t);
        if (seen.has(key)) continue;
        if (R.solved(t)) return depth;
        seen.add(key); next.push(t);
        if (seen.size > limit) return -1;
      }
      frontier = next;
    }
    return Infinity;
  }
  function deadRate(start) {
    let dead = 0;
    for (let p = 0; p < PLAYOUTS; p++) {
      let s = start, last = null;
      for (let step = 0; step < 200; step++) {
        if (R.solved(s)) break;
        let m = R.usefulMoves(s).filter(([i, j]) => !(last && last[0] === j && last[1] === i));
        if (!m.length) { dead++; break; }
        const onto = m.filter(([, j]) => s[j].length);        // people prefer pouring onto a matching colour
        if (onto.length && rand() < 0.7) m = onto;
        const mv = m[Math.floor(rand() * m.length)]; s = R.pour(s, ...mv); last = mv;
      }
    }
    return dead / PLAYOUTS;
  }

  const labels = [];
  for (let c = 0; c < d; c++) labels.push(...(c < k - d ? [c, c] : [c]));
  const out = [], seen = new Set();
  const tries = (QUICK ? 6 : 30) * want;
  for (let n = 0; n < tries && out.length < (QUICK ? Math.min(want, 8) : want) && Date.now() - t0 < BUDGET_MS; n++) {
    const seg = shuffle(labels.flatMap(c => [c, c, c, c]));
    const tubes = labels.map((_, i) => seg.slice(i * CAP, i * CAP + CAP));
    for (let x = 0; x < e; x++) tubes.push([]);
    if (tubes.some(R.isDone)) continue;                             // no flask sorted from the start
    const key = skey(tubes);
    if (seen.has(key)) continue;
    seen.add(key);
    const mm = bfs(tubes);
    if (mm <= 0 || !isFinite(mm)) continue;
    const dr = deadRate(tubes);
    out.push({ t: tubes.slice(0, k).map(t => t.join('')).join(','), m: mm, r: Math.round(dr * 100) / 100,
      s: Math.round(mm * (1 + 1.5 * dr) * 10) / 10 });
  }
  out.sort((a, b) => a.s - b.s || a.m - b.m);
  return out;
}

if (!isMainThread) {
  parentPort.postMessage(buildKey(workerData));
} else {
  const t0 = Date.now();
  const queue = KEYS.map((key, i) => ({ key, i })).sort((a, b) => b.key[0] - a.key[0]);   // big keys first
  const results = new Array(KEYS.length);
  const run = () => new Promise(done => {
    const next = () => {
      const job = queue.shift();
      if (!job) return done();
      const cacheFile = new URL(`../dist/pool-cache/${job.key.join('-')}${QUICK ? '-quick' : ''}.json`, import.meta.url);
      if (!FRESH && existsSync(cacheFile)) { results[job.i] = JSON.parse(readFileSync(cacheFile, 'utf8')); console.log(`${job.key.slice(0, 3).join('-')}: cached`); return next(); }
      const w = new Worker(new URL(import.meta.url), { workerData: { key: job.key, quick: QUICK } });
      w.once('message', r => {
        results[job.i] = r;
        mkdirSync(new URL('../dist/pool-cache/', import.meta.url), { recursive: true }); writeFileSync(cacheFile, JSON.stringify(r));
        const [k, d, e] = job.key;
        console.log(`k${k} d${d} e${e}: ${r.length} templates, minMoves ${r[0]?.m ?? '-'}..${r.at(-1)?.m ?? '-'}, ${Math.round((Date.now() - t0) / 1000)}s`);
        w.terminate(); next();
      });
      w.once('error', err => { console.error(err); process.exit(1); });
    };
    next();
  });
  await Promise.all(Array.from({ length: Math.max(1, Math.min(cpus().length, 3)) }, run));
  const pool = {};
  KEYS.forEach(([k, d, e], i) => { if (results[i].length >= 8) pool[`${k}-${d}-${e}`] = results[i]; });
  writeFileSync(new URL('../js/level-pool.js', import.meta.url),
    '// Generated by tools/build-level-pool.mjs — edit the generator, not this file.\n' +
    '// key "k-d-e": k paint flasks, d colours, e empty flasks. t: flasks bottom to top, m: shortest solution,\n' +
    '// r: share of random play-throughs that get stuck, s: difficulty score. Sorted by s.\n' +
    'window.LEVEL_POOL = ' + JSON.stringify(pool) + ';\n');
  console.log('keys:', Object.keys(pool).join(' '), 'in', Math.round((Date.now() - t0) / 1000), 's');
}
