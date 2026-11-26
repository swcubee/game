// Builds the next sort level at runtime, for any picture: no pre-made level list.
//  * the flasks come from what the current picture still needs (1 sealed flask = 2 units of paint, 1 cell = 1 unit),
//  * the layout comes from js/level-pool.js (every template proved solvable by the solver, with its shortest
//    solution), relabelled with the picture's colours and shuffled,
//  * difficulty is random per level (easy:medium:hard = 2:3:1, counted over the whole game);
//    a hard level is always followed by an easy one, level 1 is the gentlest layout and has no move limit,
//  * everything is seeded by the level number, so every player gets the same levels and a lost level comes back
//    with the same flasks.
// Growth curve (design/progression.md): paint flasks per level k = min(colours + floor(picture / 3), 10).
(function () {
  const SEED = 20261126;
  const PAINT_PER_FLASK = 2, MAX_PAINT_FLASKS = 10;
  const TIER_BAG = ['E', 'E', 'M', 'M', 'M', 'H'];
  // which part of the pool (sorted by difficulty score) each tier draws from
  const BAND = { E: [0.1, 0.35], M: [0.4, 0.65], H: [0.7, 0.95] };
  const FAIR = { E: 0.25, M: 0.25, H: 0.6 };      // max share of random play-throughs that get stuck
  // moves the player gets: shortest solution plus room for mistakes, less room on harder tiers
  const SLACK = { E: [3, 5, 4], M: [2, 5, 3], H: [1, 4, 2] };   // ceil(min * a / b) + c extra moves
  const moveLimit = (tier, mm) => { const [a, b, c] = SLACK[tier]; return mm + Math.ceil(mm * a / b) + c; };

  function rng(seed) { // mulberry32
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const mix = (...n) => n.reduce((h, x) => Math.imul(h ^ (x + 0x9e3779b9), 0x85ebca6b) >>> 0, SEED);

  // difficulty of the n-th sort level of the game (0-based); level 1 is easy, levels 2-3 easy or medium,
  // a hard level is followed by an easy one
  const tiers = ['E'], tierRand = rng(SEED);
  function tierAt(n) {
    while (tiers.length <= n) {
      const bag = tiers.length < 3 ? TIER_BAG.filter(t => t !== 'H') : TIER_BAG;   // the first 3 levels of the game are never hard
      tiers.push(tiers[tiers.length - 1] === 'H' ? 'E' : bag[Math.floor(tierRand() * bag.length)]);
    }
    return tiers[n];
  }

  // paint still to earn per colour: cells not covered by paint already earned (in jars or on the picture)
  function needs(picture, earned) {
    return picture.counts.map((n, c) => Math.max(0, Math.ceil((n - (earned[c] || 0)) / PAINT_PER_FLASK)));
  }

  // n: level number in the whole game, picIndex: picture number (0-based), earned: paint per colour so far
  function build(n, picture, picIndex, earned, twoEmpty, kMax) {
    const rand = rng(mix(n, picIndex));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const colours = picture.palette.length;
    const need = needs(picture, earned);
    const tier = tierAt(n);
    // at most colours + 2 paint flasks below 8 colours (10 only with 8): bigger mixes are too slow for the solver
    const k = Math.min(colours + Math.floor(picIndex / 3), colours >= 8 ? MAX_PAINT_FLASKS : colours + 2, 2 * colours, kMax || Infinity);

    // 1. which flasks: slot by slot the colour that still needs the most paint, at most two flasks of a colour;
    //    when nothing is needed any more, a filler flask (gives no paint, labelled "enough") of a colour seen least
    const inLevel = new Array(colours).fill(0), paid = new Array(colours).fill(0), rest = need.slice();
    for (let s = 0; s < k; s++) {
      const open = shuffle(rest.map((r, c) => c).filter(c => rest[c] > 0 && inLevel[c] < 2)).sort((a, b) => rest[b] - rest[a]);
      let c;
      if (open.length) { c = open[0]; rest[c]--; paid[c]++; }
      else c = shuffle(inLevel.map((_, c) => c)).sort((a, b) => inLevel[a] - inLevel[b])[0];
      inLevel[c]++;
    }
    const doubles = shuffle(inLevel.map((_, c) => c).filter(c => inLevel[c] === 2));
    const singles = shuffle(inLevel.map((_, c) => c).filter(c => inLevel[c] === 1));
    const d = doubles.length + singles.length;
    const label = doubles.concat(singles);                          // template labels 0 .. k-d-1 fill two flasks
    let empties = tier === 'H' && picIndex >= 4 && !twoEmpty ? 1 : 2;
    if (!LEVEL_POOL[`${k}-${d}-${empties}`]) empties = 2;
    if (!LEVEL_POOL[`${k}-${d}-2`]) return build(n, picture, picIndex, earned, twoEmpty, k - 1);   // no layouts for this mix: one flask less

    // 2. layout: a template from the tier's band of the pool, fair enough for people
    const pool = LEVEL_POOL[`${k}-${d}-${empties}`];
    let pick;
    if (n === 0) pick = pool[0];                                    // tutorial: the gentlest layout
    else {
      const [lo, hi] = BAND[tier];
      let band = pool.slice(Math.floor(lo * pool.length), Math.max(Math.floor(lo * pool.length) + 1, Math.ceil(hi * pool.length)));
      const fair = band.filter(t => t.r <= FAIR[tier]);
      if (fair.length) band = fair;
      else if (empties === 1) return build(n, picture, picIndex, earned, true, kMax);   // no fair layout with one empty flask
      pick = band[Math.floor(rand() * band.length)];
    }
    const tubes = shuffle(pick.t.split(',').map(f => [...f].map(ch => label[+ch])));
    for (let e = 0; e < empties; e++) tubes.push([]);
    return {
      n: n + 1, pic: picIndex, tier, tubes,
      reward: paid.map(p => p * PAINT_PER_FLASK),
      hidden: picIndex >= 2 && tier !== 'E' ? 2 : 0,                // "cobweb": bottom layers stay hidden until reached
      minMoves: pick.m,
      moves: n === 0 ? 0 : moveLimit(tier, pick.m),                 // 0 = no limit (tutorial)
    };
  }
  window.LevelGen = { build, needs, tierAt };
})();
