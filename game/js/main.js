// Game flow: save state, screens, paint jars, rewards, picture completion, gallery.
(function () {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'save';
  const t = (k, v) => I18N.t(k, v);

  // ───── state ─────
  // level: index of the next sort level; pic: picture being painted;
  // paint: units of paint per colour of the current picture (1 picture = 1 palette)
  // stars, ach, stats: sugar stars and achievements (js/meta.js), added in save v2
  // owned: patterns bought in the shop; pats: chosen pattern per colour for each picture id (save v3)
  // shades: replacement shades bought; tints: chosen shade id (or null) per colour for each picture id (save v4)
  // art: free colouring of finished pictures, {pictureId: {cellId: [hex, patternId|null]}} (save v5)
  // decor: bought frames and wallpapers; frames: frame id per picture id; wall: gallery wallpaper (save v6)
  let S = { v: 6, level: 0, pic: 0, paint: [], painted: [], done: [], sound: true, tut: {}, stars: 0, ach: [], stats: {}, owned: [], pats: {}, shades: [], tints: {}, art: {}, decor: [], frames: {}, wall: 'stripes' };
  const save = () => SDK.save(SAVE_KEY, S);
  // a picture with the player's shades applied: palette = colours now, base = the picture's own colours
  function dress(p) {
    const mine = S.tints[p.id] || [], colours = p.palette.slice();
    p.palette.forEach((_, c) => { const sh = Shades.get(mine[c]); if (sh && S.shades.includes(sh.id) && Shades.fits(sh, p.palette, colours, c)) colours[c] = sh.hex; });
    return Object.assign({}, p, { palette: colours, base: p.palette });
  }
  const picture = () => dress(PICTURES[Math.min(S.pic, PICTURES.length - 1)]);
  const allDone = () => S.pic >= PICTURES.length;
  let sel = 0, screen = 'paint', overlayOpen = false;
  // patterns of a picture: the player's choice where valid, otherwise the starter set; never two colours with one pattern
  const ownsDecor = id => { const d = Decor.get(id); return !!d && (!d.price || S.decor.includes(id)); };
  const ownsPattern = id => { const p = Patterns.get(id); return !!p && (!p.price || S.owned.includes(id)); };
  function patternsOf(p) {
    const def = Patterns.defaults(p), mine = S.pats[p.id] || [], out = [];
    p.palette.forEach((_, c) => { const id = mine[c]; out.push(id && ownsPattern(id) && !out.includes(id) ? id : null); });
    p.palette.forEach((_, c) => { if (!out[c]) out[c] = def.find(id => !out.includes(id)) || def[c]; });
    return out;
  }

  const need = c => picture().regions.filter(r => r.c === c && !S.painted.includes(r.id)).length;
  // paint earned so far for the current picture: still in the jars plus already on the picture
  const earned = () => picture().palette.map((_, c) => (S.paint[c] || 0) + picture().regions.filter(r => r.c === c && S.painted.includes(r.id)).length);
  const nextLevel = () => LevelGen.build(S.level, picture(), S.pic, earned());
  const canBrew = () => !allDone() && LevelGen.needs(picture(), earned()).some(n => n > 0);

  // ───── screens ─────
  function go(name) {
    screen = name;
    ['paint', 'sort', 'gallery', 'shop', 'studio'].forEach(s => $(s).classList.toggle('hidden', s !== name));
    if (name !== 'sort') SortScene.stop();
    if (name === 'gallery') { SDK.gameplayStop(); renderGallery(); }
    else if (name === 'shop') { SDK.gameplayStop(); renderShop(); }
    else if (name === 'studio') { SDK.gameplayStop(); renderStudio(); }
    else if (!overlayOpen) SDK.gameplayStart();
  }

  // ───── paint screen ─────
  let jarSeq = 0;
  function jarSVG(color, num, level, pattern) {
    const top = 64 - 44 * level, pid = `jp-${++jarSeq}`, cid = `jc-${jarSeq}`;   // ids unique: a clip in a hidden screen does not apply
    return `<svg viewBox="0 0 54 70" aria-hidden="true"><defs>${pattern ? Patterns.def(pid, pattern, color, 0.62) : ''}<clipPath id="${cid}"><path d="M10,18C7,20 7,23 7,27V58C7,63.5 10.5,66.5 16,66.5H38C43.5,66.5 47,63.5 47,58V27C47,23 47,20 44,18Z"/></clipPath></defs>
      <path d="M10,18C7,20 7,23 7,27V58C7,63.5 10.5,66.5 16,66.5H38C43.5,66.5 47,63.5 47,58V27C47,23 47,20 44,18Z" fill="#d6e8ee" fill-opacity=".2"/>
      <g clip-path="url(#${cid})"><rect x="0" y="${top}" width="54" height="70" fill="${pattern ? `url(#${pid})` : color}"/><ellipse cx="27" cy="${top}" rx="22" ry="3" fill="#fff" fill-opacity=".18"/></g>
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
    const p = picture(), box = $('jars'), pats = patternsOf(p);
    box.innerHTML = '';
    p.palette.forEach((color, c) => {
      const n = need(c), have = S.paint[c] || 0;
      const b = document.createElement('button');
      b.className = 'jar' + (c === sel ? ' sel' : '') + (n === 0 ? ' done' : '') + (n > 0 && have === 0 ? ' empty' : '');
      b.setAttribute('aria-label', `${c + 1}`);
      b.innerHTML = jarSVG(color, c + 1, n === 0 ? 0.05 : jarLevel(have), pats[c]) + `<span class="count">${n === 0 ? CHECK : have}</span>`;
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
    PaintScene.show(picture(), allDone() ? picture().regions.map(r => r.id) : S.painted, sel, { onTap }, patternsOf(picture()));
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
    requestAnimationFrame(() => SortScene.start(nextLevel(), picture().palette, { tutorial: S.level === 0, onWin, onLose, dustHint: S.tut.dust ? null : () => { S.tut.dust = true; save(); } }));
  }
  function onWin(reward, info) {
    Sound.win();
    reward.forEach((r, c) => { S.paint[c] = (S.paint[c] || 0) + r; });
    const res = Meta.levelWon(info);
    S.level++; save(); SDK.reportLevel(S.level);
    const loot = reward.map((r, c) => r ? `<div class="jar">${jarSVG(picture().palette[c], c + 1, jarLevel(r), patternsOf(picture())[c])}<span class="count">+${r}</span></div>` : '').join('');
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
    $('gallery').className = 'screen' + (ownsDecor(S.wall) && S.wall !== 'stripes' ? ' w-' + S.wall : '');
    PICTURES.forEach((p0, i) => {
      const f = document.createElement('div'), p = dress(p0);
      if (S.done.includes(p.id)) {
        f.className = 'frame done f-' + frameOf(p.id); f.innerHTML = PaintScene.markup(p, 'all', { patterns: patternsOf(p) }) + `<span class="cap">${p.name[I18N.lang()] || p.name.en}</span>`;
        applyArt(f.querySelector('svg'), p);
        f.addEventListener('click', () => { Sound.pick(); studio.pic = p0.id; go('studio'); });
      }
      else if (i === S.pic) { f.className = 'frame'; f.innerHTML = PaintScene.markup(p, new Set(S.painted), { patterns: patternsOf(p) }) + `<span class="cap progress">${t('progress', { a: S.painted.length, b: p.regions.length })}</span>`; }
      else { f.className = 'frame locked'; f.textContent = '?'; }
      b.appendChild(f);
    });
    if (allDone()) b.insertAdjacentHTML('beforeend', `<p class="soon">${t('soon')}</p>`);
    if (S.done.length) b.insertAdjacentHTML('afterbegin', `<p class="gallery-tip">${t('studioTip')}</p>`);
    // achievements album: what each one asks for and gives, earned ones ticked
    const al = document.createElement('div'); al.className = 'album';
    al.innerHTML = `<h2>${t('achTitle')}</h2>` + Meta.list().map(a => `<div class="ach${Meta.has(a.id) ? ' got' : ''}">
      <i>${Meta.has(a.id) ? CHECK : STAR}</i><b>${t('ach_' + a.id)}</b><small>${t('achDo_' + a.id)}</small><span>+${a.stars}</span></div>`).join('');
    b.appendChild(al);
  }

  // ───── shop: patterns for stars, and the patterns of the current picture ─────
  let shopSel = 0;
  function swatch(patternId, color) {
    const id = `sw-${++jarSeq}`;
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs>${Patterns.def(id, patternId, color, 0.9)}</defs><rect x="2" y="2" width="44" height="44" rx="10" fill="url(#${id})"/></svg>`;
  }
  function renderShop() {
    renderStars(); $('shop-stars-n').textContent = S.stars;
    const box = $('shop-body'), p = picture(), cur = allDone() ? null : patternsOf(p);
    let h = '';
    if (cur) {
      shopSel = Math.min(shopSel, p.palette.length - 1);
      h += `<h2>${t('shopPic')}</h2><p class="shop-tip">${t('shopPick')}</p><div class="shop-paints">` + p.palette.map((color, c) =>
        `<button class="shop-paint${c === shopSel ? ' sel' : ''}" data-c="${c}" aria-label="${c + 1}">${jarSVG(color, c + 1, 0.9, cur[c])}</button>`).join('') + '</div>';
    }
    if (cur) {
      // shades: the paint's own colour and the shades of its family; a shade too close to another paint is not offered
      const base = p.base[shopSel], mine = (S.tints[p.id] || [])[shopSel] || null;
      h += `<h2>${t('shopShades')}</h2><div class="shop-grid">` + [null, ...Shades.family(base)].map(sh => {
        const id = sh ? sh.id : '', hex = sh ? sh.hex : base, fits = !sh || Shades.fits(sh, p.base, p.palette, shopSel);
        const on = sh ? p.palette[shopSel] === sh.hex : p.palette[shopSel] === base;
        const state = on ? 'on' : !fits ? 'used' : !sh || S.shades.includes(id) ? 'own' : 'buy';
        const tag = state === 'on' ? CHECK : state === 'used' ? `<small class="clash">${t('shadeClash')}</small>` : state === 'buy' ? `${STAR}${sh.price}` : '';
        return `<button class="pat shade ${state}" data-shade="${id}"${state === 'used' ? ' disabled' : ''}>${chip(hex)}<span class="pat-name">${t(sh ? 'shade_' + id : 'shadeOwn')}</span><span class="pat-tag">${tag}</span></button>`;
      }).join('') + '</div>';
    }
    h += `<h2>${t('shopPatterns')}</h2><div class="shop-grid">`;
    const color = cur ? p.palette[shopSel] : '#e9cba7';
    for (const pt of Patterns.list) {
      const own = ownsPattern(pt.id), usedBy = cur ? cur.indexOf(pt.id) : -1;
      const state = usedBy === shopSel ? 'on' : usedBy >= 0 ? 'used' : own ? 'own' : 'buy';
      const tag = state === 'on' ? CHECK : state === 'used' ? `<b class="tag-num">${usedBy + 1}</b>` : state === 'buy' ? `${STAR}${pt.price}` : '';
      h += `<button class="pat ${state}" data-id="${pt.id}"${state === 'used' ? ' disabled' : ''}>${swatch(pt.id, color)}<span class="pat-name">${t('pat_' + pt.id)}</span><span class="pat-tag">${tag}</span></button>`;
    }
    h += `</div><h2>${t('shopWalls')}</h2><div class="shop-grid">` + Decor.walls.map(d => {
      const state = (ownsDecor(S.wall) ? S.wall : 'stripes') === d.id ? 'on' : ownsDecor(d.id) ? 'own' : 'buy';
      return `<button class="pat wall ${state}" data-wall="${d.id}"><span class="wall-tile w-${d.id}"></span><span class="pat-name">${t('decor_' + d.id)}</span><span class="pat-tag">${state === 'on' ? CHECK : state === 'buy' ? STAR + d.price : ''}</span></button>`;
    }).join('');
    box.innerHTML = h + '</div>';
    box.querySelectorAll('.pat.wall').forEach(b => b.addEventListener('click', () => pickDecor(b.dataset.wall, () => { S.wall = b.dataset.wall; }, renderShop)));
    box.querySelectorAll('.shop-paint').forEach(b => b.addEventListener('click', () => { Sound.pick(); shopSel = +b.dataset.c; renderShop(); }));
    box.querySelectorAll('.pat:not(.shade):not(.wall)').forEach(b => b.addEventListener('click', () => pickPattern(b.dataset.id)));
    box.querySelectorAll('.pat.shade').forEach(b => b.addEventListener('click', () => pickShade(b.dataset.shade)));
  }
  function pickPattern(id) {
    const pt = Patterns.get(id);
    if (!ownsPattern(id)) {
      if (S.stars < pt.price) { Sound.error(); note(`<h2>${t('notEnough')}</h2><p>${t('notEnoughText', { n: pt.price - S.stars })}</p>`, [[t('ok'), closeNote]]); return; }
      Sound.pick();
      note(`<h2>${t('pat_' + id)}</h2><div class="buy-swatch">${swatch(id, allDone() ? '#e9cba7' : picture().palette[shopSel])}</div><p>${t('buyQ', { n: pt.price })}</p>`,
        [[t('buy'), () => { closeNote(); const got = Meta.buy(pt.price); S.owned.push(id); if (!allDone()) setPattern(id); save(); Sound.cork(); renderShop(); toasts(got); }], [t('notNow'), closeNote]]);
      return;
    }
    if (allDone()) return;
    Sound.pick(); setPattern(id); save(); renderShop();
  }
  const chip = hex => `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="10" fill="${hex}"/></svg>`;
  // id '' = back to the picture's own colour
  function pickShade(id) {
    const sh = Shades.get(id);
    if (sh && !S.shades.includes(id)) {
      if (S.stars < sh.price) { Sound.error(); note(`<h2>${t('notEnough')}</h2><p>${t('notEnoughText', { n: sh.price - S.stars })}</p>`, [[t('ok'), closeNote]]); return; }
      Sound.pick();
      note(`<h2>${t('shade_' + id)}</h2><div class="buy-swatch">${chip(sh.hex)}</div><p>${t('buyShadeQ', { n: sh.price })}</p>`,
        [[t('buy'), () => { closeNote(); const got = Meta.buy(sh.price, 'shade'); S.shades.push(id); setShade(id); save(); Sound.cork(); renderShop(); toasts(got.concat(Meta.shadeUsed())); }], [t('notNow'), closeNote]]);
      return;
    }
    Sound.pick(); setShade(id); save(); renderShop();
    if (sh) toasts(Meta.shadeUsed());
  }
  function setShade(id) {
    const p = picture(), mine = (S.tints[p.id] || p.base.map(() => null)).slice();
    mine[shopSel] = id || null; S.tints[p.id] = mine;      // the paint screen redraws when the shop closes
  }
  function setPattern(id) {
    const p = picture(), cur = patternsOf(p);
    if (cur.includes(id) && cur.indexOf(id) !== shopSel) return;     // already on another paint of this picture
    cur[shopSel] = id; S.pats[p.id] = cur;
  }

  // ───── free colouring (studio): finished pictures only, free, no sorting, no palette rules (design 26.11) ─────
  const ZEFIR = ['#F9E58A', '#F9C6D0', '#A9CFF0', '#CDEBB4', '#F59E86', '#B39BE3', '#4FAFA6', '#8B6656', '#E9CBA7'];
  const studio = { pic: null, color: ZEFIR[0], pat: null };
  // the player's free colouring on a picture's svg (gallery frame or studio)
  // ids must be unique in the page (hidden screens keep their svgs, and a url(#id) into a hidden one draws nothing)
  let artSeq = 0;
  function applyArt(svg, p) {
    const art = S.art[p.id]; if (!art || !svg) return;
    const tag = ++artSeq;
    const defs = svg.querySelector('defs'), have = new Set();
    svg.querySelectorAll('path.cell').forEach(el => {
      const a = art[el.dataset.id]; if (!a) return;
      const [hex, pat] = a;
      if (pat && Patterns.get(pat)) {
        const id = `fc${tag}-${p.id}-${pat}-${hex.slice(1)}`;
        if (!have.has(id)) { have.add(id); defs.insertAdjacentHTML('beforeend', Patterns.def(id, pat, hex)); }
        el.style.fill = `url(#${id})`;
      } else el.style.fill = hex;
    });
  }
  const frameOf = id => ownsDecor(S.frames[id]) ? S.frames[id] : 'wood';
  // buy a frame or a wallpaper (asks first), then apply it
  function pickDecor(id, apply, rerender) {
    const d = Decor.get(id);
    if (!ownsDecor(id)) {
      if (S.stars < d.price) { Sound.error(); note(`<h2>${t('notEnough')}</h2><p>${t('notEnoughText', { n: d.price - S.stars })}</p>`, [[t('ok'), closeNote]]); return; }
      Sound.pick();
      note(`<h2>${t('decor_' + id)}</h2><p>${t('buyDecorQ', { n: d.price })}</p>`,
        [[t('buy'), () => { closeNote(); S.stars -= d.price; S.decor.push(id); apply(); save(); Sound.cork(); rerender(); }], [t('notNow'), closeNote]]);
      return;
    }
    Sound.pick(); apply(); save(); rerender();
  }
  function renderStudio() {
    const p = dress(PICTURES.find(x => x.id === studio.pic));
    const box = $('studio-pic');
    box.innerHTML = `<div class="frame studio-frame f-${frameOf(p.id)}">` + PaintScene.markup(p, 'all', { patterns: patternsOf(p) }).replace(/(id="|url\(#)(pt|hatch)-/g, '$1st$2-') + '</div>';
    const svg = box.querySelector('svg');
    applyArt(svg, p);
    svg.querySelectorAll('path.cell').forEach(el => el.addEventListener('click', () => {
      const art = S.art[p.id] = S.art[p.id] || {};
      art[el.dataset.id] = [studio.color, studio.pat];
      Sound.pick(); save(); renderStudio();
    }));
    const colours = ZEFIR.concat(Shades.list.filter(sh => S.shades.includes(sh.id)).map(sh => sh.hex));
    const pats = Patterns.list.filter(pt => ownsPattern(pt.id));
    $('studio-tools').innerHTML =
      `<div class="studio-row">` + colours.map(hex => `<button class="studio-chip${hex === studio.color ? ' sel' : ''}" data-hex="${hex}" style="background:${hex}" aria-label="${hex}"></button>`).join('') + '</div>' +
      `<div class="studio-row pats"><button class="studio-pat${!studio.pat ? ' sel' : ''}" data-pat="">${chip(studio.color)}</button>` +
      pats.map(pt => `<button class="studio-pat${pt.id === studio.pat ? ' sel' : ''}" data-pat="${pt.id}" aria-label="${t('pat_' + pt.id)}">${swatch(pt.id, studio.color)}</button>`).join('') + '</div>' +
      `<div class="studio-row frames">` + Decor.frames.map(d => `<button class="decor-chip${d.id === frameOf(studio.pic) ? ' sel' : ''}" data-frame="${d.id}" style="background:${d.swatch}" aria-label="${t('decor_' + d.id)}">${ownsDecor(d.id) ? '' : `<span class="price">${STAR}${d.price}</span>`}</button>`).join('') + '</div>';
    $('studio-tools').querySelectorAll('.decor-chip').forEach(b => b.addEventListener('click', () => pickDecor(b.dataset.frame, () => { S.frames[studio.pic] = b.dataset.frame; }, renderStudio)));
    $('studio-tools').querySelectorAll('.studio-chip').forEach(b => b.addEventListener('click', () => { Sound.pick(); studio.color = b.dataset.hex; renderStudio(); }));
    $('studio-tools').querySelectorAll('.studio-pat').forEach(b => b.addEventListener('click', () => { Sound.pick(); studio.pat = b.dataset.pat || null; renderStudio(); }));
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
  function closeNote() { overlayOpen = false; $('overlay').classList.add('hidden'); if (!['gallery', 'shop', 'studio'].includes(screen)) SDK.gameplayStart(); }

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
    $('btn-shop').addEventListener('click', () => { Sound.pick(); hand(null); shopSel = sel; go('shop'); });
    $('btn-shop-back').addEventListener('click', () => { Sound.pick(); showPaint(); });
    $('btn-gallery-back').addEventListener('click', () => { Sound.pick(); showPaint(); });
    $('btn-studio-back').addEventListener('click', () => { Sound.pick(); go('gallery'); });
    $('btn-studio-reset').addEventListener('click', () => {
      if (!S.art[studio.pic]) return;
      Sound.pick();
      note(`<h2>${t('studioReset')}</h2><p>${t('studioResetText')}</p>`, [[t('studioResetYes'), () => { closeNote(); delete S.art[studio.pic]; save(); renderStudio(); }], [t('notNow'), closeNote]]);
    });
    const snd = $('btn-sound');
    snd.addEventListener('click', () => { S.sound = !S.sound; Sound.setOn(S.sound); snd.classList.toggle('off', !S.sound); save(); if (S.sound) Sound.pick(); });
    addEventListener('resize', () => { SortScene.relayout(); if (screen === 'paint') tutorialPaint(); });
    // pause on lost focus: no sound, no gameplay time
    const away = () => { Sound.suspend(); SDK.gameplayStop(); };
    const back = () => { Sound.resume(); if (!['gallery', 'shop', 'studio'].includes(screen) && !overlayOpen) SDK.gameplayStart(); };
    document.addEventListener('visibilitychange', () => document.hidden ? away() : back());
    addEventListener('blur', away); addEventListener('focus', back);
  }

  async function boot() {
    SDK.loadingStart();
    const cfg = await SDK.config();
    I18N.setLocale(cfg.locale); I18N.apply();
    const saved = await SDK.load(SAVE_KEY);
    // v1 -> v2: Meta.init adds stars, achievements, stats; v2 -> v3: owned patterns and picture patterns (empty = defaults);
    // v3 -> v4: shades and picture shades (empty = the picture's own colours); v4 -> v5: free colouring (empty = none)
    // v5 -> v6: gallery frames and wallpaper (empty = light wood frames on the striped wall)
    if (saved && [1, 2, 3, 4, 5, 6].includes(saved.v)) S = Object.assign(S, saved, { v: 6 });
    S.decor = S.decor || []; S.frames = S.frames || {}; S.wall = S.wall || 'stripes';
    S.owned = S.owned || []; S.pats = S.pats || {}; S.shades = S.shades || []; S.tints = S.tints || {}; S.art = S.art || {};
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
