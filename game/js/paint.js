// The picture: numbered cells, colour highlight, zoom and pan, the "alive" animation.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#3a2840', PAPER = '#f6efe2';
  // which cells move when a finished picture comes alive
  const ALIVE = {
    pumpkin: { 'anim-glow': ['eyeL', 'eyeR', 'mouth', 'moon'], 'anim-twinkle': ['star0', 'star1'] },
    cat: { 'anim-fly': ['tail', 'legB', 'body', 'legF', 'earL', 'earR', 'head', 'hat', 'brim', 'stick', 'bristle0', 'bristle1', 'bristle2', 'bristle3', 'tie', '@cat'], 'anim-flap': ['bat0', 'bat1', 'bat2'] },
    cauldron: { 'anim-rise': ['bubble0', 'bubble1', 'bubble2', 'bubble3', 'bubble4'], 'anim-sway': ['steam0', 'steam1', 'steam2', 'steam3'], 'anim-fire': ['flame0', 'flame1', 'flame2', 'flame3', 'flame4', 'flame5', 'flame6', 'flame7'], 'anim-glow': ['potion'] },
  };

  function decorPath(d) {
    const fill = d.fill === 'ink' ? INK : (d.fill || 'none');
    const stroke = d.s ? (d.light ? 'rgba(255,255,255,.55)' : INK) : 'none';
    return `<path d="${d.d}" fill="${fill}" stroke="${stroke}" stroke-width="${d.s || 0}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
  }

  // static SVG markup of a picture (gallery, notes): painted = Set of cell ids or 'all'
  function markup(pic, painted, { numbers = false, sel = -1 } = {}) {
    const isP = id => painted === 'all' || painted.has(id);
    let s = `<svg viewBox="0 0 360 480" xmlns="${NS}"><defs>`;
    pic.palette.forEach((c, i) => {
      s += `<pattern id="hatch-${pic.id}-${i}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="7" height="7" fill="${PAPER}"/><rect width="2.4" height="7" fill="${c}" fill-opacity=".42"/></pattern>`;
    });
    s += '</defs>';
    pic.decorBack.filter(d => !d.top).forEach(d => { s += decorPath(d); });
    const anim = ALIVE[pic.id] || {};
    const cls = id => Object.keys(anim).filter(k => anim[k].includes(id)).join(' ');
    pic.regions.forEach(r => {
      const fill = isP(r.id) ? pic.palette[r.c] : (r.c === sel ? `url(#hatch-${pic.id}-${r.c})` : PAPER);
      s += `<path class="cell ${cls(r.id)}${isP(r.id) ? '' : ' todo'}" data-id="${r.id}" data-c="${r.c}" d="${r.d}" style="fill:${fill}"/>`;
    });
    pic.decorBack.filter(d => d.top).forEach(d => { s += decorPath(d); });
    s += pic.decorFront.filter(d => !d.g).map(decorPath).join('');
    s += `<g class="${cls('@cat')}">` + pic.decorFront.filter(d => d.g).map(decorPath).join('') + '</g>';
    if (numbers) {
      s += '<g class="nums">';
      pic.regions.forEach(r => {
        s += `<text class="num${r.c === sel ? ' active' : ''}${isP(r.id) ? ' gone' : ''}" data-for="${r.id}" x="${r.nx}" y="${r.ny}">${r.c + 1}</text>`;
      });
      s += '</g>';
    }
    return s + '</svg>';
  }

  let pic = null, painted = null, sel = -1, svg = null, cb = null;
  const view = { s: 1, x: 0, y: 0 };
  const vp = () => document.getElementById('pic-viewport');

  function show(picture, paintedIds, selected, callbacks) {
    pic = picture; painted = new Set(paintedIds); sel = selected; cb = callbacks;
    vp().innerHTML = markup(pic, painted, { numbers: true, sel });
    svg = vp().querySelector('svg');
    view.s = 1; view.x = 0; view.y = 0; apply();
    document.getElementById('sheet').classList.remove('alive');
  }

  function select(c) {
    sel = c;
    if (!svg) return;
    svg.querySelectorAll('.cell').forEach(p => {
      if (painted.has(p.dataset.id)) return;
      p.style.fill = +p.dataset.c === c ? `url(#hatch-${pic.id}-${c})` : PAPER;
    });
    svg.querySelectorAll('.num').forEach(t => {
      const r = pic.regions.find(x => x.id === t.dataset.for);
      t.classList.toggle('active', r.c === c);
    });
  }

  function fill(id, at) {
    const r = pic.regions.find(x => x.id === id);
    painted.add(id);
    const p = svg.querySelector(`.cell[data-id="${id}"]`);
    p.classList.remove('todo'); p.style.fill = pic.palette[r.c];
    svg.querySelector(`.num[data-for="${id}"]`).classList.add('gone');
    if (at) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'ripple'); c.setAttribute('cx', at.x); c.setAttribute('cy', at.y); c.setAttribute('fill', '#fff');
      svg.appendChild(c);
      c.animate([{ r: 2, opacity: .55 }, { r: 34, opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = () => c.remove();
    }
  }

  function alive(on) {
    document.getElementById('sheet').classList.toggle('alive', on);
    if (on && svg) svg.querySelectorAll('.anim-rise, .anim-flap, .anim-fire, .anim-twinkle').forEach((e, i) => { e.style.animationDelay = (i * 0.23 % 1.6) + 's'; });
  }

  // ───── zoom & pan (wheel, pinch, drag when zoomed); a short still press is a tap ─────
  function apply() {
    const box = vp().getBoundingClientRect();
    view.s = Math.min(4, Math.max(1, view.s));
    view.x = Math.min(0, Math.max(box.width * (1 - view.s), view.x));
    view.y = Math.min(0, Math.max(box.height * (1 - view.s), view.y));
    if (svg) svg.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  }
  function zoomAt(px, py, factor) {
    const s0 = view.s, s1 = Math.min(4, Math.max(1, s0 * factor)), k = s1 / s0;
    view.x = px - (px - view.x) * k; view.y = py - (py - view.y) * k; view.s = s1; apply();
  }
  const ptrs = new Map();
  let gesture = null;
  function local(e) { const b = vp().getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; }
  function bind() {
    const v = vp();
    v.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    v.addEventListener('pointerdown', e => {
      v.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, local(e));
      if (ptrs.size === 1) gesture = { type: 'tap', start: local(e), t: performance.now(), vx: view.x, vy: view.y, target: e.target };
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        gesture = { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, vx: view.x, vy: view.y };
      }
    });
    v.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId) || !gesture) return;
      ptrs.set(e.pointerId, local(e));
      const p = local(e);
      if (gesture.type === 'tap' && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 8) gesture.type = view.s > 1 ? 'pan' : 'none';
      if (gesture.type === 'pan') { view.x = gesture.vx + p.x - gesture.start.x; view.y = gesture.vy + p.y - gesture.start.y; apply(); }
      if (gesture.type === 'pinch' && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        const s1 = Math.min(4, Math.max(1, gesture.s * d / gesture.d)), k = s1 / gesture.s;
        view.s = s1; view.x = gesture.mid.x - (gesture.mid.x - gesture.vx) * k; view.y = gesture.mid.y - (gesture.mid.y - gesture.vy) * k; apply();
      }
    });
    const end = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (gesture && gesture.type === 'tap' && ptrs.size === 0 && performance.now() - gesture.t < 600) {
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const cell = hit && hit.closest && hit.closest('.cell');
        if (cell && cb) {
          const ctm = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint();
          pt.x = e.clientX; pt.y = e.clientY; const sp = pt.matrixTransform(ctm);
          cb.onTap(cell.dataset.id, +cell.dataset.c, { x: sp.x, y: sp.y });
        }
      }
      if (ptrs.size === 0) gesture = null;
      else if (gesture && gesture.type === 'pinch') gesture = { type: 'none' };
    };
    v.addEventListener('pointerup', end);
    v.addEventListener('pointercancel', end);
    addEventListener('resize', apply);
  }

  window.PaintScene = { bind, show, select, fill, alive, markup, isPainted: id => painted && painted.has(id) };
})();
