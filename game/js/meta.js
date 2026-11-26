// Sugar stars and achievements (design/meta-rewards.md). Stars are only earned in play: no purchases,
// no random rewards, no way to lose them. This file keeps the rules; main.js shows the results.
(function () {
  // achievement: id, stars, test on the stats (and the event that just happened)
  const ACH = [
    { id: 'firstCell', stars: 5, test: s => s.cells >= 1 },
    { id: 'firstPic', stars: 10, test: s => s.pics >= 1 },
    { id: 'noUndo10', stars: 15, test: s => s.noUndoStreak >= 10 },
    { id: 'thrifty5', stars: 15, test: s => s.thrifty >= 5 },
    { id: 'pics5', stars: 25, test: s => s.pics >= 5 },
    { id: 'pics10', stars: 50, test: s => s.pics >= 10 },
    { id: 'flasks100', stars: 20, test: s => s.flasks >= 100 },
    { id: 'cells1000', stars: 30, test: s => s.cells >= 1000 },
    { id: 'noWaste', stars: 20, test: s => s.noWaste >= 1 },
    { id: 'patterns5', stars: 15, test: s => (s.patternsBought || 0) >= 5 },      // shop: not in the game yet
    { id: 'ownShade', stars: 10, test: s => (s.shadesUsed || 0) >= 1 },           // shop: not in the game yet
    { id: 'stubborn', stars: 10, test: s => s.stubborn >= 1 },
  ];
  const STATS = { wins: 0, flasks: 0, cells: 0, pics: 0, noUndoStreak: 0, thrifty: 0, loseStreak: 0, noWaste: 0, stubborn: 0 };
  let S = null;

  // S: the save object; adds what is missing (new saves and saves from before v2)
  function init(save) {
    S = save;
    S.stars = S.stars || 0;
    S.ach = S.ach || [];
    S.stats = Object.assign({}, STATS, S.stats || {});
    if (!S.stats.pics && S.done && S.done.length) S.stats.pics = S.done.length;
    return check();
  }
  // grants every achievement whose condition is now met; returns the new ones
  function check() {
    const got = [];
    for (const a of ACH) if (!S.ach.includes(a.id) && a.test(S.stats)) { S.ach.push(a.id); S.stars += a.stars; got.push(a); }
    return got;
  }

  // a sort level was won. info: { undos used, moves made, limit (Infinity = none), flasks with paint }
  function levelWon(info) {
    const st = S.stats, lines = [];
    st.wins++; st.flasks += info.flasks;
    lines.push(['level', 1]);
    if (info.undos === 0) { lines.push(['noUndo', 1]); st.noUndoStreak++; } else st.noUndoStreak = 0;
    if (isFinite(info.limit) && info.limit - info.moves >= info.limit / 3) { lines.push(['thrifty', 1]); st.thrifty++; }
    if (st.loseStreak >= 3) st.stubborn++;
    st.loseStreak = 0;
    return finish(lines);
  }
  function levelLost() { S.stats.loseStreak++; }
  function cellPainted() { S.stats.cells++; return check(); }
  // a picture was finished. number: 1-based picture number, leftover: paint units still in the jars
  function pictureDone(number, leftover) {
    const st = S.stats, lines = [['picture', 10 + number]];
    st.pics++;
    const fromPaint = Math.floor(leftover / 2);
    if (fromPaint) lines.push(['leftover', fromPaint]);
    if (leftover <= 2) st.noWaste++;
    return finish(lines);
  }
  function finish(lines) {
    const total = lines.reduce((a, [, n]) => a + n, 0);
    S.stars += total;
    return { lines, total, ach: check() };
  }

  window.Meta = { init, levelWon, levelLost, cellPainted, pictureDone, list: () => ACH, stars: () => S.stars, has: id => S.ach.includes(id) };
})();
