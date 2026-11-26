// Game flow: save state, screens, paint jars, rewards, picture completion, gallery.
(function () {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'save';
  const t = (k, v) => I18N.t(k, v);

  // ───── state ─────
  // level: index of the next sort level; pic: picture being painted;
  // paint: units of paint per colour of the current picture (1 picture = 1 palette)
  // stars, ach, stats: sugar stars and achievements (js/meta.js), added in save v2
  let S = { v: 2, level: 0, pic: 0, paint: [], painted: [], done: [], sound: true, tut: {}, stars: 0, ach: [], stats: {} };
  const save = () => SDK.save(SAVE_KEY, S);
  const picture = () => PICTURES[Math.min(S.pic, PICTURES.length - 1)];
  const allDone = () => S.pic >= PICTURES.length;
  let sel = 0, screen = 'paint', overlayOpen = false;

  const need = c => picture().regions.filter(r => r.c === c && !S.painted.includes(r.id)).length;
  // paint earned so far for the current picture: still in the jars plus already on the picture
  const earned = () => picture().palette.map((_, c) => (S.paint[c] || 0) + picture().regions.filter(r => r.c === c && S.painted.includes(r.id)).length);
  const nextLevel = () => LevelGen.build(S.level, picture(), S.pic, earned());
  const canBrew = () => !allDone() && LevelGen.needs(picture(), earned()).some(n => n > 0);

  // ───── screens ─────
  function go(name) {
    screen = name;
    ['paint', 'sort', 'gallery'].forEach(s => $(s).classList.toggle('hidden', s !== name));
    if (name !== 'sort') SortScene.stop();
    if (name === 'gallery') { SDK.gameplayStop(); renderGallery(); }
    else if (!overlayOpen) SDK.gameplayStart();
  }

  // ───── paint screen ─────
  function jarSVG(color, num, level) {
    const top = 64 - 44 * level;
    return `<svg viewBox="0 0 54 70" aria-hidden="true"><defs><clipPath id="jc-${num}-${color.slice(1)}"><path d="M10,18C7,20 7,23 7,27V58C7,63.5 10.5,66.5 16,66.5H38C43.5,66.5 47,63.5 47,58V27C47,23 47,20 44,18Z"/></clipPath></defs>
      <path d="M10,18C7,20 7,23 7,27V58C7,63.5 10.5,66.5 16,66.5H38C43.5,66.5 47,63.5 47,58V27C47,23 47,20 44,18Z" fill="#d6e8ee" fill-opacity=".2"/>
      <g clip-path="url(#jc-${num}-${color.slice(1)})"><rect x="0" y="${top}" width="54" height="70" fill="${color}"/><ellipse cx="27" cy="${top}" rx="22" ry="3" fill="#fff" fill-opacity=".18"/></g>
      <path d="M10,18C7,20 7,23 7,27V58C7,63.5 10.5,66.5 16,66.5H38C43.5,66.5 47,63.5 47,58V27C47,23 47,20 44,18Z" fill="none" stroke="#e4f1f5" stroke-opacity=".85" stroke-width="2"/>
      <path d="M13,28V54" stroke="#fff" stroke-opacity=".35" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M9,6.5C9,4.5 10.5,3 12.5,3H41.5C43.5,3 45,4.5 45,6.5V15C45,17 43.5,18.5 41.5,18.5H12.5C10.5,18.5 9,17 9,15Z" fill="#4a3150" stroke="#2a1b2f" stroke-width="1.6"/>
      <text x="27" y="11.5" text-anchor="middle" dominant-baseline="central" font-family="Nunito" font-weight="900" font-size="12" fill="#f3e6cf">${num}</text></svg>`;
  }
  const STAR = '<svg class="star-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12,2.6L14.7,8.6 21.2,9.2 16.3,13.5 17.8,19.9 12,16.5 6.2,19.9 7.7,13.5 2.8,9.2 9.3,8.6Z"/></svg>';
  const CHECK = '<svg viewBox="0 0 20 14" width="18" height="13" style="vertical-align:-1px"><path d="M2,7.5L7.2,12 18,2" fill="none" stroke="#3f6b2a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function jarLevel(paint) { return paint <= 0 ? 0.05 : Math.min(1, 0.22 + paint / 14); }

  function renderStars() { $('stars-n').textContent = S.stars; }
  // the stars just earned, line by line, for a result note
  const earnHTML = res => `<div class="earn">${res.lines.map(([k, n]) => `<span>${STAR}+${n} ${t('earn_' + k)}</span>`).join('')}</div>`;
  // achievements: a paper slip at the top of the screen, one after another
  const toastQueue = [];
  function toasts(list) {
    list.forEach(a => toastQueue.push(a)); renderStars();
    if (toastQueue.length === list.length && list.length) nextToast();
  }
  function nextToast() {
    const a = toastQueue[0]; if (!a) return;
    const el = document.createElement('div'); el.className = 'toast';
    el.innerHTML = `<small>${t('achGot')}</small><b>${t('ach_' + a.id)}</b><span>${STAR}+${a.stars}</span>`;
    $('toasts').appendChild(el); Sound.cork();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); toastQueue.shift(); nextToast(); }, 400); }, 2600);
  }

  function renderJars() {
    renderStars();
    const p = picture(), box = $('jars');
    box.innerHTML = '';
    p.palette.forEach((color, c) => {
      const n = need(c), have = S.paint[c] || 0;
      const b = document.createElement('button');
      b.className = 'jar' + (c === sel ? ' sel' : '') + (n === 0 ? ' done' : '') + (n > 0 && have === 0 ? ' empty' : '');
      b.setAttribute('aria-label', `${c + 1}`);
      b.innerHTML = jarSVG(color, c + 1, n === 0 ? 0.05 : jarLevel(have)) + `<span class="count">${n === 0 ? CHECK : have}</span>`;
      b.addEventListener('click', () => pickColor(c));
      box.appendChild(b);
    });
    const brew = $('btn-brew'), label = brew.querySelector('span');
    brew.disabled = !canBrew();
    label.textContent = allDone() ? t('soon') : canBrew() ? t('brew') : t('brewDone');
    const stuck = canBrew() && picture().palette.every((_, c) => need(c) === 0 || (S.paint[c] || 0) === 0);
    brew.classList.toggle('urge', stuck);
    tutorialPaint();
  }

  function pickColor(c) {
    Sound.unlock();
    sel = c; PaintScene.select(c); renderJars(); Sound.pick();
  }
  function autoSelect() {
    const p = picture();
    const order = p.palette.map((_, c) => c).filter(c => need(c) > 0);
    sel = order.find(c => (S.paint[c] || 0) > 0) ?? order[0] ?? 0;
  }

  function showPaint() {
    if (S.paint.length !== picture().palette.length) S.paint = picture().palette.map(() => 0);
    autoSelect();
    PaintScene.show(picture(), allDone() ? picture().regions.map(r => r.id) : S.painted, sel, { onTap });
    if (allDone()) PaintScene.alive(true);
    renderJars();
    go('paint');
  }

  function onTap(id, c, at) {
    if (allDone() || PaintScene.isPainted(id)) return;
    Sound.unlock();
    if (c !== sel) { pickColor(c); return; }
    if ((S.paint[c] || 0) <= 0) {
      Sound.error();
      const jar = $('jars').children[c]; jar.classList.remove('shake'); void jar.offsetWidth; jar.classList.add('shake');
      $('btn-brew').classList.add('urge');
      return;
    }
    S.paint[c]--; S.painted.push(id);
    toasts(Meta.cellPainted());
    PaintScene.fill(id, at); Sound.fill();
    S.tut.painted = true;
    if (need(c) === 0) autoSelect(), PaintScene.select(sel);
    renderJars(); save();
    if (S.painted.length === picture().regions.length) setTimeout(pictureDone, 500);
  }

  function pictureDone() {
    const p = picture();
    hand(null);
    PaintScene.alive(true); Sound.picture();
    if (!S.done.includes(p.id)) S.done.push(p.id);
    const leftover = S.paint.reduce((a, n) => a + (n || 0), 0);   // unused paint turns into stars
    const res = Meta.pictureDone(S.pic + 1, leftover);
    S.pic++; S.paint = []; S.painted = [];
    save();
    setTimeout(() => {
      const last = allDone();
      renderStars(); toasts(res.ach);
      note(`<h2>${t('picDone')}</h2><p>${p.name[I18N.lang()] || p.name.en}</p>${earnHTML(res)}`,
        [[last ? t('toGallery') : t('next'), () => { closeNote(); last ? go('gallery') : showPaint(); }]]);
    }, 2200);
  }

  // ───── sort screen ─────
  function brew() {
    if (!canBrew()) return;
    Sound.unlock(); Sound.pick();
    S.tut.brewed = true; hand(null);
    go('sort');
    requestAnimationFrame(() => SortScene.start(nextLevel(), picture().palette, { tutorial: S.level === 0, onWin, onLose }));
  }
  function onWin(reward, info) {
    Sound.win();
    reward.forEach((r, c) => { S.paint[c] = (S.paint[c] || 0) + r; });
    const res = Meta.levelWon(info);
    S.level++; save(); SDK.reportLevel(S.level);
    const loot = reward.map((r, c) => r ? `<div class="jar">${jarSVG(picture().palette[c], c + 1, jarLevel(r))}<span class="count">+${r}</span></div>` : '').join('');
    note(`<h2>${t('winTitle')}</h2><p>${t('winText')}</p><div class="loot">${loot}</div>${earnHTML(res)}`, [[t('toPaint'), () => { closeNote(); showPaint(); }]]);
    toasts(res.ach);
  }
  function onLose(reason) {
    Sound.lose();
    Meta.levelLost(); save();
    note(`<h2>${t('loseTitle')}</h2><p>${t(reason === 'moves' ? 'loseMoves' : 'loseText')}</p>`, [[t('retry'), () => { closeNote(); SortScene.restart(); }]]);
  }

  // ───── gallery ─────
  function renderGallery() {
    const b = $('board'); b.innerHTML = '';
    PICTURES.forEach((p, i) => {
      const f = document.createElement('div');
      if (S.done.includes(p.id)) { f.className = 'frame'; f.innerHTML = PaintScene.markup(p, 'all') + `<span class="cap">${p.name[I18N.lang()] || p.name.en}</span>`; }
      else if (i === S.pic) { f.className = 'frame'; f.innerHTML = PaintScene.markup(p, new Set(S.painted)) + `<span class="cap progress">${t('progress', { a: S.painted.length, b: p.regions.length })}</span>`; }
      else { f.className = 'frame locked'; f.textContent = '?'; }
      b.appendChild(f);
    });
    if (allDone()) b.insertAdjacentHTML('beforeend', `<p class="soon">${t('soon')}</p>`);
    // achievements album: what each one asks for and gives, earned ones ticked
    const al = document.createElement('div'); al.className = 'album';
    al.innerHTML = `<h2>${t('achTitle')}</h2>` + Meta.list().map(a => `<div class="ach${Meta.has(a.id) ? ' got' : ''}">
      <i>${Meta.has(a.id) ? CHECK : STAR}</i><b>${t('ach_' + a.id)}</b><small>${t('achDo_' + a.id)}</small><span>+${a.stars}</span></div>`).join('');
    b.appendChild(al);
  }

  // ───── note overlay ─────
  function note(html, buttons) {
    overlayOpen = true; SDK.gameplayStop();
    const n = $('note'); n.innerHTML = html;
    buttons.forEach(([label, fn], k) => {
      const b = document.createElement('button'); b.className = 'btn' + (k ? ' quiet' : ''); b.textContent = label;
      if (k) b.style.marginLeft = '10px';
      b.addEventListener('click', () => { Sound.pick(); fn(); }); n.appendChild(b);
    });
    $('overlay').classList.remove('hidden');
    setTimeout(() => n.querySelector('.btn') && n.querySelector('.btn').focus({ preventScroll: true }), 50);
  }
  function closeNote() { overlayOpen = false; $('overlay').classList.add('hidden'); if (screen !== 'gallery') SDK.gameplayStart(); }

  // ───── first-time hints ─────
  function hand(el) {
    const h = $('hand');
    if (!el) { h.classList.add('hidden'); return; }
    const r = el.getBoundingClientRect(), g = $('game').getBoundingClientRect();
    h.style.left = (r.left - g.left + r.width / 2) + 'px'; h.style.top = (r.top - g.top + r.height / 2) + 'px';
    h.classList.remove('hidden');
  }
  function tutorialPaint() {
    if (screen !== 'paint' || overlayOpen || allDone()) return;
    if (!S.tut.brewed) { requestAnimationFrame(() => hand($('btn-brew'))); return; }
    if (!S.tut.painted && (S.paint[sel] || 0) > 0) {
      const r = picture().regions.find(x => x.c === sel && !S.painted.includes(x.id));
      const cell = r && document.querySelector(`#pic-viewport .cell[data-id="${r.id}"]`);
      const num = r && document.querySelector(`#pic-viewport .num[data-for="${r.id}"]`);
      requestAnimationFrame(() => hand(num || cell));
      return;
    }
    hand(null);
  }

  // ───── wiring ─────
  function bind() {
    PaintScene.bind();
    $('btn-brew').addEventListener('click', brew);
    $('btn-undo').addEventListener('click', () => SortScene.undo());
    $('btn-restart').addEventListener('click', () => { Sound.pick(); SortScene.restart(); });
    $('btn-back').addEventListener('click', () => {
      if (SortScene.locked()) return;          // leaving mid-pour or right after the last move would lose the result
      Sound.pick();
      note(`<h2>${t('leave')}</h2><p>${t('leaveText')}</p>`, [[t('stay'), closeNote], [t('exit'), () => { closeNote(); showPaint(); }]]);
    });
    $('btn-gallery').addEventListener('click', () => { Sound.pick(); hand(null); go('gallery'); });
    $('btn-gallery-back').addEventListener('click', () => { Sound.pick(); showPaint(); });
    const snd = $('btn-sound');
    snd.addEventListener('click', () => { S.sound = !S.sound; Sound.setOn(S.sound); snd.classList.toggle('off', !S.sound); save(); if (S.sound) Sound.pick(); });
    addEventListener('resize', () => { SortScene.relayout(); if (screen === 'paint') tutorialPaint(); });
    // pause on lost focus: no sound, no gameplay time
    const away = () => { Sound.suspend(); SDK.gameplayStop(); };
    const back = () => { Sound.resume(); if (screen !== 'gallery' && !overlayOpen) SDK.gameplayStart(); };
    document.addEventListener('visibilitychange', () => document.hidden ? away() : back());
    addEventListener('blur', away); addEventListener('focus', back);
  }

  async function boot() {
    SDK.loadingStart();
    const cfg = await SDK.config();
    I18N.setLocale(cfg.locale); I18N.apply();
    const saved = await SDK.load(SAVE_KEY);
    if (saved && (saved.v === 1 || saved.v === 2)) S = Object.assign(S, saved, { v: 2 });   // v1 -> v2: Meta.init adds stars, achievements, stats
    S.tut = S.tut || {};
    Meta.init(S);                 // achievements already earned by an old save are granted quietly
    Sound.setOn(S.sound); $('btn-sound').classList.toggle('off', !S.sound);
    bind();
    try { await document.fonts.ready; } catch (e) { /* fonts optional */ }
    showPaint();
    SDK.loadingStop();
  }
  boot();
})();
