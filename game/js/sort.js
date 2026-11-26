// The sorting level: flasks on shelves, pouring, undo, corks, win / lose.
(function () {
  const R = Rules;
  const VB_W = 60, VB_H = 165, IN = { x: 11, y: 32, w: 38, h: 127, r: 19 };
  const UNDOS = 2, LIFT = 20;

  const GLASS = `<svg class="glass" viewBox="0 0 60 165" preserveAspectRatio="none">
    <path d="M9,14V140C9,155 18,161.5 30,161.5C42,161.5 51,155 51,140V14" fill="none" stroke="#dcedf3" stroke-opacity=".92" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M4.5,8.5C4.5,5.6 6.8,4.4 10,4.4H50C53.2,4.4 55.5,5.6 55.5,8.5V10.8C55.5,13 54,14.2 51.8,14.2H8.2C6,14.2 4.5,13 4.5,10.8Z" fill="#cfe5ee" fill-opacity=".3" stroke="#dcedf3" stroke-width="2.2"/>
    <path d="M16.5,26V126" stroke="#fff" stroke-opacity=".36" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M19,134C20,142 23.6,146 28,147.4" stroke="#fff" stroke-opacity=".2" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  </svg>`;
  const BACK = `<svg class="glass-back" viewBox="0 0 60 165" preserveAspectRatio="none"><path d="M9,14V140C9,155 18,161.5 30,161.5C42,161.5 51,155 51,140V14Z" fill="#d4e7ef" fill-opacity=".3"/></svg>`;
  const CORK = w => `<svg class="cork" width="${w}" height="${Math.round(w * 0.62)}" viewBox="0 0 34 21"><path d="M3,4C3,2 5,1 7,1H27C29,1 31,2 31,4L29.5,19C29.4,20 28.6,20.5 27.6,20.5H6.4C5.4,20.5 4.6,20 4.5,19Z" fill="#b07a4c" stroke="#5a3620" stroke-width="1.6"/><path d="M8,7.5h3M17,6h2.5M23,10h3M11,14h2.5M20,15h3" stroke="#7a4e2c" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let st = null;

  function snapshot() { return { tubes: st.tubes.map(t => t.slice()), hidden: st.hidden.map(h => h.slice()), corked: st.corked.slice(), paid: st.paid.slice() }; }
  function restore(s) { st.tubes = s.tubes.map(t => t.slice()); st.hidden = s.hidden.map(h => h.slice()); st.corked = s.corked.slice(); st.paid = s.paid.slice(); }

  function start(level, palette, cb) {
    const tubes = level.tubes.map(t => t.slice());
    const hidden = tubes.map(t => t.map((_, i) => level.hidden > 0 && i < Math.min(level.hidden, t.length - 1)));
    st = { level, palette, cb, tubes, hidden, corked: tubes.map(R.isDone), paid: level.reward.map(r => r / 2),
      undos: UNDOS, history: [], sel: null, busy: false, moves: 0, limit: level.moves || Infinity, flasks: [], geo: null, over: false };
    st.initial = snapshot();
    $('level-name').textContent = I18N.t('level', { n: level.n });
    hideHint();
    build();
    updatePips();
    updateMoves();
    tutorial();
  }

  function build() {
    const box = $('shelves');
    box.innerHTML = '';
    st.flasks = st.tubes.map((_, i) => {
      const el = document.createElement('div');
      el.className = 'flask';
      el.style.transition = 'none';                    // first placement must not slide in from the corner
      el.innerHTML = BACK + '<div class="liquid"></div>' + GLASS;
      el.addEventListener('click', () => tap(i));
      box.appendChild(el);
      return { el, x: 0, y: 0 };
    });
    layout();
    requestAnimationFrame(() => requestAnimationFrame(() => st && st.flasks.forEach(f => { f.el.style.transition = ''; })));
  }

  function layout() {
    if (!st) return;
    const box = $('shelves'), W = box.clientWidth, H = box.clientHeight;
    const n = st.tubes.length, rows = n > 5 ? 2 : 1, per = Math.ceil(n / rows);
    let w = Math.min(W > H ? 86 : 70, (W - 24) / (per * 1.3));
    const rowGap = 34, below = 40;
    const fit = ((H - 40 - (rows - 1) * rowGap) / rows - below) / (VB_H / VB_W);
    w = Math.max(30, Math.min(w, fit));
    const h = w * VB_H / VB_W;
    const gap = Math.min(w * 0.8, (W - per * w) / (per + 1));
    const block = rows * (h + below) + (rows - 1) * rowGap;
    const top0 = Math.max(LIFT + 8, (H - block) / 2 + 12);
    box.querySelectorAll('.shelf').forEach(s => s.remove());
    st.geo = { w, h, layerH: IN.h / VB_H * h / R.CAP };
    for (let r = 0; r < rows; r++) {
      const ids = st.flasks.map((_, i) => i).slice(r * per, r * per + per);
      const rowW = ids.length * w + (ids.length - 1) * gap, x0 = (W - rowW) / 2, y = top0 + r * (h + below + rowGap);
      ids.forEach((i, k) => { st.flasks[i].x = x0 + k * (w + gap); st.flasks[i].y = y; });
      const shelf = document.createElement('div');
      shelf.className = 'shelf';
      Object.assign(shelf.style, { left: (x0 - 22) + 'px', width: (rowW + 44) + 'px', top: (y + h - 5) + 'px' });
      box.prepend(shelf);
    }
    st.flasks.forEach((f, i) => {
      Object.assign(f.el.style, { width: w + 'px', height: h + 'px', transformOrigin: `50% ${4 / VB_H * 100}%` });
      const liq = f.el.querySelector('.liquid');
      Object.assign(liq.style, { left: IN.x / VB_W * w + 'px', width: IN.w / VB_W * w + 'px', top: IN.y / VB_H * h + 'px', height: IN.h / VB_H * h + 'px',
        borderRadius: `0 0 ${IN.r / VB_W * w}px ${IN.r / VB_W * w}px` });
      const cork = f.el.querySelector('.cork'); if (cork) cork.remove();
      f.el.insertAdjacentHTML('beforeend', CORK(w * 0.62));
      f.el.classList.toggle('closed', st.corked[i]);
      place(i);
      paintFlask(i);
    });
  }

  const pose = i => { const f = st.flasks[i]; return `translate(${f.x}px, ${f.y - (st.sel === i ? LIFT : 0)}px)`; };
  function place(i) { st.flasks[i].el.style.transform = pose(i); }

  function paintFlask(i) {
    const liq = st.flasks[i].el.querySelector('.liquid');
    liq.innerHTML = '';
    st.tubes[i].forEach((c, k) => liq.appendChild(layerEl(c, st.hidden[i][k], st.geo.layerH)));
  }
  // very dark paints get a touch of light so they read inside the glass
  function liquid(hex) {
    const v = parseInt(hex.slice(1), 16), r = v >> 16, g = v >> 8 & 255, b = v & 255;
    if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.18) return hex;
    const m = (x, t) => Math.round(x + (t - x) * 0.25);
    return `rgb(${m(r, 16)},${m(g, 10)},${m(b, 22)})`;
  }
  // very dark paints get a touch of light so they read inside the glass
  function liquid(hex) {
    const v = parseInt(hex.slice(1), 16), r = v >> 16, g = v >> 8 & 255, b = v & 255;
    if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.18) return hex;
    const m = (x, t) => Math.round(x + (t - x) * 0.25);
    return `rgb(${m(r, 16)},${m(g, 10)},${m(b, 22)})`;
  }
  function layerEl(c, hid, hgt) {
    const d = document.createElement('div');
    d.className = 'layer' + (hid ? ' hid' : '');
    d.style.height = hgt + 'px';
    d.style.background = liquid(st.palette[c]);
    return d;
  }

  function tap(i) {
    if (!st || st.busy || st.over) return;
    Sound.unlock();
    const s = st.sel;
    if (s === null) {
      if (st.tubes[i].length && !st.corked[i]) select(i); else nudge(i);
    } else if (s === i) {
      st.sel = null; place(i); Sound.drop();
    } else if (R.canPour(st.tubes[s], st.tubes[i])) {
      pour(s, i);
    } else if (st.tubes[i].length && !st.corked[i]) {
      st.sel = null; place(s); select(i);
    } else nudge(i);
    tutorial();
  }
  function select(i) { st.sel = i; st.flasks[i].el.classList.add('up'); place(i); Sound.pick(); }
  function nudge(i) {
    const el = st.flasks[i].el; Sound.error();
    el.animate([{ transform: pose(i) }, { transform: pose(i) + ' translateX(-5px) rotate(-3deg)' }, { transform: pose(i) + ' translateX(5px) rotate(3deg)' }, { transform: pose(i) }], { duration: 300 });
  }

  // flask moves use CSS transitions on the element's own style: the resting pose is always the
  // style value, so nothing can stay stuck in a tilted state if a frame is dropped
  const move = (el, transform, ms) => {
    el.style.transition = `transform ${ms}ms cubic-bezier(.4,.1,.3,1)`;
    el.style.transform = transform;
    return wait(ms + 30);
  };

  async function pour(a, b) {
    st.busy = true;
    st.history.push(snapshot());
    const A = st.flasks[a], B = st.flasks[b], { w, h, layerH } = st.geo;
    const n = R.pourCount(st.tubes[a], st.tubes[b]), c = R.top(st.tubes[a]), color = liquid(st.palette[c]);
    const lenB = st.tubes[b].length;
    // commit the move to the model first; the animation only shows it
    st.tubes = R.pour(st.tubes, a, b);
    for (let k = 0; k < n; k++) { st.hidden[a].pop(); st.hidden[b].push(false); }
    let revealed = false;
    const ta = st.hidden[a];
    if (ta.length && ta[ta.length - 1]) { ta[ta.length - 1] = false; revealed = true; }
    st.sel = null; st.moves++; updateMoves();

    const dir = A.x < B.x ? 1 : -1;
    const mouthX = B.x + w / 2 - dir * w * 0.16, mouthY = B.y - h * 0.2;
    const tilt = `translate(${mouthX - w / 2}px, ${mouthY - 4 / VB_H * h}px) rotate(${dir * 98}deg)`;
    const box = $('shelves');
    let stream = null;
    try {
      A.el.classList.add('up');
      await move(A.el, tilt, 300);
      const surface = B.y + (IN.y / VB_H) * h + IN.h / VB_H * h - lenB * layerH;
      stream = document.createElement('div');
      stream.className = 'stream';
      Object.assign(stream.style, { left: (B.x + w / 2 - 3.5) + 'px', top: (mouthY + 2) + 'px', height: Math.max(8, surface - mouthY) + 'px', background: color });
      box.appendChild(stream);
      stream.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 120, fill: 'forwards' });
      Sound.pour(n, lenB);
      [...A.el.querySelectorAll('.layer')].slice(-n).forEach(l => { l.style.height = '0px'; });
      const liqB = B.el.querySelector('.liquid');
      const added = Array.from({ length: n }, () => { const l = layerEl(c, false, 0); liqB.appendChild(l); return l; });
      requestAnimationFrame(() => requestAnimationFrame(() => added.forEach(l => { l.style.height = layerH + 'px'; })));
      await wait(430);
      stream.style.transition = 'opacity .11s'; stream.style.opacity = '0'; await wait(120);
      stream.remove(); stream = null;
      paintFlask(a); paintFlask(b);
      if (revealed) { const l = A.el.querySelectorAll('.layer'); l[l.length - 1].animate([{ filter: 'brightness(2)' }, { filter: 'none' }], { duration: 500 }); }
      await move(A.el, pose(a), 260);
    } catch (e) {
      console.warn('[sort] animation', e);
    } finally {
      if (stream) stream.remove();
      A.el.style.transition = '';
      place(a); A.el.classList.remove('up');
      paintFlask(a); paintFlask(b);
    }
    if (R.isDone(st.tubes[b]) && !st.corked[b]) cork(b);
    st.busy = false;
    after();
  }

  function cork(i) {
    st.corked[i] = true;
    const f = st.flasks[i], c = st.tubes[i][0];
    f.el.classList.add('closed');
    Sound.cork();
    const tag = document.createElement('div');
    if (st.paid[c] > 0) { st.paid[c]--; tag.className = 'float-tag'; tag.textContent = '+2'; tag.style.boxShadow = `inset 0 -4px 0 ${st.palette[c]}`; }
    else { tag.className = 'float-tag enough'; tag.textContent = I18N.t('enough'); }
    Object.assign(tag.style, { left: (f.x + st.geo.w / 2) + 'px', top: (f.y - 34) + 'px' });
    $('shelves').appendChild(tag);
    setTimeout(() => tag.remove(), 1400);
    sparkles(f.x + st.geo.w / 2, f.y + 4, st.palette[c]);
  }
  function sparkles(x, y, color) {
    for (let k = 0; k < 9; k++) {
      const s = document.createElement('i'), a = Math.PI * (1.1 + k / 8 * 0.8), d = 26 + Math.random() * 22;
      s.className = 'sparkle';
      Object.assign(s.style, { left: x + 'px', top: y + 'px', background: k % 3 ? color : '#fff3c4' });
      s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      $('shelves').appendChild(s); setTimeout(() => s.remove(), 750);
    }
  }

  function after() {
    hideHint();
    $('btn-undo').classList.remove('urge');
    if (R.solved(st.tubes)) {
      st.over = true; hand(null);
      setTimeout(() => st.cb.onWin(st.level.reward), 1100);
      return;
    }
    if (st.moves >= st.limit) {               // out of moves and the paint is not sorted: the level is lost
      st.over = true; hand(null);
      setTimeout(() => st.cb.onLose('moves'), 450);
      return;
    }
    if (!R.usefulMoves(st.tubes).length) {
      if (st.undos > 0) { showHint(I18N.t('noMoves')); $('btn-undo').classList.add('urge'); }
      else { st.over = true; setTimeout(() => st.cb.onLose('stuck'), 450); }
    }
    tutorial();
  }

  function undo() {
    if (!st || st.busy || st.over) return;
    if (!st.undos || !st.history.length) { Sound.error(); $('btn-undo').animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 220 }); return; }
    restore(st.history.pop());
    st.undos--; st.sel = null; st.moves = Math.max(0, st.moves - 1); updateMoves();
    st.flasks.forEach((f, i) => { f.el.classList.toggle('closed', st.corked[i]); f.el.classList.remove('up'); place(i); paintFlask(i); });
    Sound.drop(); updatePips(); hideHint(); $('btn-undo').classList.remove('urge');
    tutorial();
  }
  function restart() {
    if (!st || st.busy) return;
    restore(st.initial);
    st.undos = UNDOS; st.history = []; st.sel = null; st.moves = 0; st.over = false; updateMoves();
    st.flasks.forEach((f, i) => { f.el.classList.toggle('closed', st.corked[i]); f.el.classList.remove('up'); place(i); paintFlask(i); });
    updatePips(); hideHint(); $('btn-undo').classList.remove('urge');
    tutorial();
  }
  function updatePips() {
    [...$('undo-pips').children].forEach((p, k) => p.classList.toggle('used', k >= st.undos));
    $('btn-undo').disabled = st.undos === 0;
  }
  function updateMoves() {
    const box = $('moves'), left = st.limit - st.moves;
    box.classList.toggle('hidden', !isFinite(st.limit));
    $('moves-left').textContent = left;
    box.classList.toggle('low', left <= 3);
  }
  function showHint(text) { const e = $('sort-hint'); e.textContent = text; e.classList.remove('hidden'); }
  function hideHint() { $('sort-hint').classList.add('hidden'); }

  // first level only: a hand shows the next move of a shortest solution
  function tutorial() {
    if (!st || !st.cb.tutorial || st.over || st.moves >= 3) { hand(null); return; }
    const path = Rules.solvePath(st.tubes);
    if (!path || !path.length) { hand(null); return; }
    const [a, b] = path[0];
    hand(st.sel === null ? a : (st.sel === a ? b : a));
  }
  function hand(i) {
    const h = $('hand');
    if (i === null || !st) { h.classList.add('hidden'); return; }
    // from the logical position, not the on-screen box: the flask may still be moving
    const box = $('shelves').getBoundingClientRect(), g = $('game').getBoundingClientRect(), f = st.flasks[i];
    h.style.left = (box.left - g.left + f.x + st.geo.w / 2) + 'px';
    h.style.top = (box.top - g.top + f.y + st.geo.h * 0.55) + 'px';
    h.classList.remove('hidden');
  }

  window.SortScene = {
    start, undo, restart,
    relayout() { if (st && !st.busy) { layout(); tutorial(); } },
    stop() { hand(null); st = null; },
    __busy: () => !!(st && st.busy),
    __solution() { return st ? Rules.solvePath(st.tubes, 400000) : null; },
  };
})();
