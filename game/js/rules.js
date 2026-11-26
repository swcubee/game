// Water sort rules. Kept identical to tools/generate-levels.mjs so the game and the
// level generator agree on what a legal, useful move is.
(function () {
  const CAP = 4;
  const top = t => t[t.length - 1];
  function runLen(t) { if (!t.length) return 0; let n = 1; while (n < t.length && t[t.length - 1 - n] === top(t)) n++; return n; }
  const isDone = t => t.length === CAP && runLen(t) === CAP;
  // legal for the player: anything a real flask allows
  function canPour(a, b) {
    if (a === b || !a.length || b.length >= CAP || isDone(a)) return false;
    return !b.length || top(a) === top(b);
  }
  // useful: the solver's definition (pouring a single-colour flask into an empty one changes nothing)
  function useful(a, b) {
    if (!canPour(a, b)) return false;
    return b.length || a.length !== runLen(a);
  }
  function pourCount(a, b) { return Math.min(runLen(a), CAP - b.length); }
  function pour(s, i, j) {
    const n = pourCount(s[i], s[j]);
    const out = s.map(t => t.slice());
    for (let k = 0; k < n; k++) out[j].push(out[i].pop());
    return out;
  }
  const solved = s => s.every(t => !t.length || isDone(t));
  function usefulMoves(s) {
    const m = [];
    for (let i = 0; i < s.length; i++) for (let j = 0; j < s.length; j++) if (useful(s[i], s[j])) m.push([i, j]);
    return m;
  }
  // flask order does not matter for solving: states that differ only by order count as one
  const key = s => s.map(t => t.join(',')).sort().join('|');
  // shortest solution from a state (used for the tutorial hand); small levels only
  function solvePath(start, limit = 60000) {
    if (solved(start)) return [];
    const prev = new Map([[key(start), null]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) for (const [i, j] of usefulMoves(s)) {
        const t = pour(s, i, j), k = key(t);
        if (prev.has(k)) continue;
        prev.set(k, [key(s), i, j]);
        if (solved(t)) {
          const path = []; let cur = k;
          while (prev.get(cur)) { const [p, a, b] = prev.get(cur); path.unshift([a, b]); cur = p; }
          return path;
        }
        next.push(t);
        if (prev.size > limit) return null;
      }
      frontier = next;
    }
    return null;
  }
  window.Rules = { CAP, top, runLen, isDone, canPour, useful, pourCount, pour, solved, usefulMoves, solvePath };
})();
