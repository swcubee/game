// Complex test picture for Spooky Paint: "Witch's cottage in the pumpkin patch".
// Same format as tools/build-pictures.mjs (viewBox 360x480, regions drawn in order, later ones on top).
// Labels (nx, ny, fs) are computed afterwards by analyze.mjs from the rendered visibility map.

const r1 = n => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;
function curve(pts, closed = false) {
  const p = closed ? [pts.at(-1), ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts.at(-1)];
  let d = `M${P(...p[1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    d += `C${P(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6)} ${P(x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6)} ${P(x2, y2)}`;
  }
  return closed ? d + 'Z' : d;
}
const poly = pts => 'M' + pts.map(p => P(...p)).join('L') + 'Z';
const circle = (cx, cy, r) => `M${P(cx - r, cy)}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0Z`;
const ellipsePts = (cx, cy, rx, ry, rot = 0, n = 24) => {
  const a = rot * Math.PI / 180, pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return pts;
};
const ellipse = (...a) => curve(ellipsePts(...a), true);
const rotPts = (pts, cx, cy, deg) => {
  const a = deg * Math.PI / 180;
  return pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
};
let seed = 7;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();

function blobPts(cx, cy, rx, ry, s, n = 9, k = 0.16) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, m = 1 + k * Math.sin(s + i * 2.3);
    pts.push([cx + rx * m * Math.cos(t), cy + ry * m * Math.sin(t)]);
  }
  return pts;
}
const blob = (...a) => curve(blobPts(...a), true);
function star(cx, cy, R, rot = -90, inner = 0.48, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? R * inner : R;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}
// part of circle A (c, r) that lies outside circle B (o, r2): a crescent
function crescent(cx, cy, r, ox, oy, r2, n = 120) {
  const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2;
    const ax = cx + r * Math.cos(t), ay = cy + r * Math.sin(t);
    A.push([t, ax, ay, Math.hypot(ax - ox, ay - oy) > r2]);
    const bx = ox + r2 * Math.cos(t), by = oy + r2 * Math.sin(t);
    B.push([t, bx, by, Math.hypot(bx - cx, by - cy) < r]);
  }
  const run = arr => { // contiguous run of true starting after a false
    const s = arr.findIndex((e, i) => e[3] && !arr[(i - 1 + n) % n][3]);
    const out = []; for (let k = 0; k < n; k++) { const e = arr[(s + k) % n]; if (!e[3]) break; out.push([e[1], e[2]]); }
    return out;
  };
  const a = run(A); let b = run(B);
  const end = a.at(-1);
  if (Math.hypot(b[0][0] - end[0], b[0][1] - end[1]) > Math.hypot(b.at(-1)[0] - end[0], b.at(-1)[1] - end[1])) b = b.reverse();
  return poly([...a, ...b]);
}
// band piece between edge functions top(x) / bottom(x), from x0 to x1 (cut lines slanted by sl)
function bandPiece(top, bot, x0, x1, sl = 0, n = 10) {
  const T = [], B = [];
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; T.push([x, top(x)]); }
  for (let i = n; i >= 0; i--) { const x = x0 + sl + (x1 - x0) * i / n; B.push([x, bot(x)]); }
  return poly([...T, ...B]);
}
const waveFn = (y, amp, ph) => x => y + amp * Math.sin(x / 55 + ph) + amp * 0.4 * Math.sin(x / 23 + ph * 2);
function pumpkinSlice(cx, cy, rx, ry, u0, u1) {
  const side = u => Array.from({ length: 11 }, (_, i) => {
    const t = -1 + i / 5, s = Math.sqrt(Math.max(0, 1 - t * t));
    const bulge = 1 + 0.06 * Math.sin((u + 1) * Math.PI * 3);
    return [cx + rx * u * s * bulge, cy + ry * t];
  });
  const a = side(u0), b = side(u1).reverse();
  return poly([...a, ...b]);
}
function bat(cx, cy, s, tilt = 0) {
  const base = [[0, -8], [6, -2], [16, -11], [30, -13], [38, -6], [31, -2], [30, 7], [22, 3], [15, 11], [7, 6], [0, 10],
    [-7, 6], [-15, 11], [-22, 3], [-30, 7], [-31, -2], [-38, -6], [-30, -13], [-16, -11], [-6, -2]];
  return poly(rotPts(base.map(([x, y]) => [cx + x * s, cy + y * s]), cx, cy, tilt));
}
function cloudPts(cx, cy, w, h, s) {
  const k = 4, pts = [];
  for (let i = 0; i < k; i++) {
    const t = (i + 0.5) / k, bx = cx + w / 2 - t * w, env = 0.55 + 0.45 * Math.sin(t * Math.PI);
    const rb = (w / k) * 0.62 * (1 + 0.12 * Math.sin(s + i * 1.7)), hb = h * env - rb * 0.6;
    for (let j = 0; j <= 8; j++) { const a = Math.PI * j / 8; pts.push([bx + rb * Math.cos(a), cy - hb - rb * Math.sin(a) * env]); }
  }
  pts.push([cx - w / 2, cy]); pts.push([cx + w / 2, cy]);
  return pts.filter(p => p[1] <= cy + 0.01).map(p => [p[0], Math.min(p[1], cy)]);
}
function cloudPtsOld(cx, cy, w, h, s) {
  const pts = [[cx + w / 2, cy]];
  const bumps = 5;
  for (let i = 0; i <= bumps * 2; i++) {
    const t = i / (bumps * 2), x = cx + w / 2 - t * w;
    const env = Math.sin(t * Math.PI);
    const y = cy - h * (0.25 + 0.75 * env) * (i % 2 ? 1 + 0.15 * Math.sin(s + i) : 0.72);
    pts.push([x, y]);
  }
  pts.push([cx - w / 2, cy]); pts.push([cx - w * 0.3, cy + h * 0.18]); pts.push([cx + w * 0.3, cy + h * 0.18]);
  return pts;
}
const leaf = (cx, cy, L, W, rot) => curve(rotPts([[cx - L / 2, cy], [cx - L * 0.15, cy - W / 2], [cx + L * 0.25, cy - W * 0.38], [cx + L / 2, cy], [cx + L * 0.25, cy + W * 0.38], [cx - L * 0.15, cy + W / 2]], cx, cy, rot), true);

// ───────────────────────── palette (name → colour), index = order of first use ─────────────────────────
const C = {
  sky0: '#1d1838', sky1: '#251e48', sky2: '#2e2558', sky3: '#392d68', sky4: '#463577', sky5: '#563e84', sky6: '#6a478c', sky7: '#83518f', sky8: '#a05e8d',
  halo1: '#4d3f86', halo2: '#62539b',
  moon: '#f7e6ae', moonSh1: '#ead293', moonSh2: '#d9bb78', crater: '#e2c886', moonHi: '#fff6d8',
  star1: '#fff3c4', star2: '#f9d27a',
  cloud1: '#4a3c74', cloud2: '#655692', cloud3: '#8676ae',
  bat: '#211a2b', batBody: '#3a2c47',
  ghost: '#f4f0fa', ghostSh: '#d6cde8', cheek: '#f2a7c0',
  farRim: '#5a4a86', farHill: '#45386f', fir: '#2c2550', firLit: '#3b3266',
  smoke1: '#9a8fb5', smoke2: '#bbb1d2',
  brick1: '#9c5448', brick2: '#b4674f', capDark: '#3f2a3c',
  hillRim: '#4b6c5f', hill: '#2f4b4c', hillPatch: '#3a5a55',
  wall1: '#8a5a3c', wall2: '#7a4e33', wall3: '#9a6847', stone1: '#7d6f83', stone2: '#958aa0',
  roof1: '#4a3466', roof2: '#5b4078', roof3: '#3b2954', roofTip: '#6d4e8c',
  frame: '#4a2f2a', glass1: '#ffe9a6', glass2: '#ffd061', glass3: '#f6a944', sill: '#6b4530',
  door1: '#5e3524', door2: '#71442f', doorArch: '#3f2a2e', knob: '#e8b84a',
  trunk1: '#4a3326', trunk2: '#5e4230', trunk3: '#77553b', hollow: '#2a1d22', owl: '#8a6a52', owlBelly: '#cfae84', owlEye: '#f4ecd6',
  leaf1: '#a3402a', leaf2: '#c75a2e', leaf3: '#e67838', leaf4: '#f29c46', leaf5: '#f7c45e',
  fgRim: '#3a5d4f', fg1: '#284339', fg2: '#21382f',
  path: '#594563', pathStone1: '#8e8197', pathStone2: '#a99cad', pathStone3: '#c2b6c1',
  rail: '#8d7b66', picket1: '#d1bf9f', picket2: '#b9a585',
  post: '#5e4230', lantFrame: '#2f2735', lantGlow: '#ffcf5a', lantHalo: '#e6a64e',
  vine: '#4c7338', vLeaf1: '#5f8a45', vLeaf2: '#7aa556',
  pO1: '#f28a2e', pO2: '#e2721f', pO3: '#f7a54d', pO4: '#c65b1b', pOHi: '#fbc574',
  face1: '#ffd75e', face2: '#fff1ad',
  stem1: '#6b7a3a', stem2: '#89984d',
  pR1: '#d4502a', pR2: '#b5401f', pR3: '#e46c3c',
  pW1: '#efe4cc', pW2: '#dacca9', pW3: '#c4b490',
  cat: '#2a2233', catLit: '#41364f', catEar: '#c97a92', catEye: '#c6e85a',
  mush1: '#a2457a', mush2: '#c4609a', mushDot: '#f6e3ef', mushStem: '#eadcc6',
  tuft1: '#4f7a5c', tuft2: '#3c6650',
  fly: '#eaf77e', flyHalo: '#52704f',
};

export function buildScene() {
  const regions = [], decorFront = [];
  let n = 0;
  const add = (c, d, id) => { if (!C[c]) throw new Error('no colour ' + c); regions.push({ id: id || `r${n++}`, cn: c, d }); };
  const deco = (d, s = 1, extra = {}) => decorFront.push({ d, s, ...extra });

  // ── sky: 9 wavy bands, each cut into 3 pieces ──
  const skyY = [-12, 30, 64, 96, 126, 154, 180, 204, 228, 330];
  const edges = skyY.map((y, i) => (i === 0 ? () => -12 : i === 9 ? () => 330 : waveFn(y, 6, i * 1.3)));
  for (let i = 0; i < 9; i++) {
    const cuts = [-12, 80 + ((i * 47) % 70), 210 + ((i * 61) % 80), 372];
    const ct = cuts.map((c, j) => (j && j < 3 ? c + 9 : c)), cb = cuts.map((c, j) => (j && j < 3 ? c - 9 : c));
    for (let k = 0; k < 3; k++) {
      const T = [], B = [];
      for (let q = 0; q <= 10; q++) { const x = ct[k] + (ct[k + 1] - ct[k]) * q / 10; T.push([x, edges[i](x)]); }
      for (let q = 10; q >= 0; q--) { const x = cb[k] + (cb[k + 1] - cb[k]) * q / 10; B.push([x, edges[i + 1](x)]); }
      add(`sky${i}`, poly([...T, ...B]));
    }
  }
  // ── stars ──
  [[24, 18, 7], [104, 20, 6], [150, 12, 5], [124, 150, 6], [16, 250, 5], [232, 176, 5], [176, 196, 5], [118, 64, 5], [84, 126, 4.5], [28, 160, 5]].forEach(([x, y, r], i) =>
    add(i % 2 ? 'star2' : 'star1', star(x, y, Math.max(7, r * 1.3), -90 + i * 7)));
  [[256, 202, 7.5], [262, 18, 8], [16, 118, 8], [240, 230, 7]].forEach(([x, y, r]) => add('star1', star(x, y, r, -90, 0.34, 4)));
  // ── moon with halo ──
  const mx = 186, my = 92;
  add('halo1', circle(mx, my, 72)); add('halo2', circle(mx, my, 58));
  add('moon', circle(mx, my, 44));
  add('moonSh1', crescent(mx, my, 44, mx + 17, my - 13, 44));
  add('moonSh2', crescent(mx, my, 44, mx + 8, my - 6, 44));
  add('moonHi', blob(mx + 18, my - 22, 10, 7, 1.2, 8, 0.1));
  [[mx - 14, my - 8, 8], [mx + 12, my + 14, 7], [mx - 20, my + 22, 5.5], [mx + 4, my - 26, 5]].forEach(([x, y, r]) => add('crater', circle(x, y, r)));
  // ── clouds (three layers each) ──
  [[226, 140, 118, 30, 1], [70, 200, 100, 28, 2.5], [56, 76, 84, 24, 4]].forEach(([x, y, w, h, s]) => {
    add('cloud1', poly(cloudPts(x, y, w, h, s)));
    add('cloud2', poly(cloudPts(x - 4, y - 6, w * 0.7, h * 0.66, s + 1)));
    add('cloud3', poly(cloudPts(x - 8, y - 12, w * 0.4, h * 0.42, s + 2)));
  });
  // ── bats ──
  [[98, 36, 0.75, -10], [104, 104, 0.55, 6], [268, 186, 0.5, -6]].forEach(([x, y, s, t]) => {
    add('bat', bat(x, y, s, t)); add('batBody', ellipse(x, y + 1 * s, 6 * s + 2, 9 * s + 1.5, t));
  });
  // ── cute ghost ──
  {
    const gx = 52, gy = 128;
    const pts = [[gx, gy - 30], [gx + 18, gy - 22], [gx + 22, gy], [gx + 24, gy + 18], [gx + 16, gy + 26], [gx + 8, gy + 20], [gx, gy + 28], [gx - 8, gy + 20], [gx - 16, gy + 26], [gx - 22, gy + 16], [gx - 22, gy], [gx - 18, gy - 22]];
    add('ghost', curve(pts, true));
    add('ghostSh', curve([[gx + 10, gy - 22], [gx + 20, gy - 6], [gx + 22, gy + 16], [gx + 16, gy + 24], [gx + 12, gy + 6]], true));
    add('ghost', ellipse(gx - 25, gy + 4, 7, 4.5, -30)); // arm
    add('cheek', circle(gx - 10, gy - 2, 4)); add('cheek', circle(gx + 9, gy - 2, 4));
    deco(ellipse(gx - 7, gy - 10, 2.6, 3.6), 0, { fill: 'ink' }); deco(ellipse(gx + 6, gy - 10, 2.6, 3.6), 0, { fill: 'ink' });
    deco(`M${P(gx - 4, gy - 1)}q4,4 8,0`, 1.4);
  }
  // ── far hill with little firs ──
  const far = waveFn(262, 10, 0.4);
  add('farRim', bandPiece(far, x => far(x) + 9, -12, 180)); add('farRim', bandPiece(far, x => far(x) + 9, 180, 372));
  add('farHill', bandPiece(x => far(x) + 9, () => 400, -12, 140)); add('farHill', bandPiece(x => far(x) + 9, () => 400, 140, 372));
  [[176, 0.8], [196, 1.1], [216, 0.7], [238, 1.0], [12, 0.9], [30, 0.7], [292, 0.9]].forEach(([x, s]) => {
    const b = far(x) + 6, h = 34 * s, w = 12 * s;
    add('fir', poly([[x, b - h], [x + w, b], [x - w, b]]));
    add('firLit', poly([[x, b - h], [x + w, b], [x + w * 0.2, b]]));
  });
  // ── chimney (behind roof) + smoke ──
  [[151, 108, 6], [156, 93, 7], [151, 76, 8], [159, 57, 8.5], [152, 38, 7]].forEach(([x, y, r], i) => {
    add(i % 2 ? 'smoke2' : 'smoke1', blob(x, y, r * 1.25, r, i * 1.7, 9, 0.1));
  });
  {
    const x0 = 138, x1 = 162, top = 128;
    add('capDark', poly([[x0 - 4, top - 8], [x1 + 4, top - 8], [x1 + 4, top + 2], [x0 - 4, top + 2]]));
    for (let row = 0; row < 5; row++) {
      const y0 = top + 2 + row * 10, y1 = y0 + 10, off = row % 2 ? 6 : 0;
      const xs = [x0, x0 + 6 + off, x0 + 18 + off, x1].filter((v, i, a) => i === 0 || i === a.length - 1 || (v > x0 + 3 && v < x1 - 3));
      for (let k = 0; k < xs.length - 1; k++) add((row + k) % 2 ? 'brick1' : 'brick2', poly([[xs[k], y0], [xs[k + 1], y0], [xs[k + 1], y1], [xs[k], y1]]));
    }
  }
  // ── house hill ──
  const hillTop = x => 296 - 26 * Math.exp(-(((x - 110) / 110) ** 2)) + 4 * Math.sin(x / 30);
  add('hillRim', bandPiece(hillTop, x => hillTop(x) + 10, -12, 372, 0, 24));
  add('hill', bandPiece(x => hillTop(x) + 10, () => 420, -12, 372, 0, 24));
  [[30, 312, 26, 8], [220, 312, 30, 7], [300, 322, 36, 9]].forEach(([x, y, rx, ry], i) => add('hillPatch', blob(x, y, rx, ry, i, 9, 0.1)));
  // ── cottage ──
  {
    const L = 60, Rx = 164, top = 214, base = 290;
    const planks = 7, w = (Rx - L) / planks;
    const plankCols = ['wall1', 'wall2', 'wall3', 'wall1', 'wall2', 'wall3', 'wall2'];
    for (let i = 0; i < planks; i++) {
      const xa = L + i * w, xb = xa + w, sk = 3;
      add(plankCols[i], poly([[xa + sk * 0.5, top + (i % 2) * 2], [xb + sk * 0.5, top + ((i + 1) % 2) * 2], [xb, base], [xa, base]]));
    }
    for (let i = 0; i < 6; i++) {
      const xa = L - 4 + i * 18.3;
      add(i % 2 ? 'stone1' : 'stone2', curve([[xa, base - 6], [xa + 9, base - 8], [xa + 18, base - 6], [xa + 19, base + 3], [xa + 9, base + 6], [xa - 1, base + 3]], true));
    }
    // windows
    [[66, 232], [134, 232]].forEach(([x, y]) => {
      add('frame', poly([[x - 3, y - 3], [x + 27, y - 3], [x + 27, y + 31], [x - 3, y + 31]]));
      const cols = [['glass1', 'glass2'], ['glass2', 'glass3']];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++)
        add(cols[a][b], poly([[x + 1 + b * 12, y + 1 + a * 14], [x + 11 + b * 12, y + 1 + a * 14], [x + 11 + b * 12, y + 13 + a * 14], [x + 1 + b * 12, y + 13 + a * 14]]));
      add('sill', poly([[x - 6, y + 31], [x + 30, y + 31], [x + 28, y + 38], [x - 4, y + 38]]));
    });
    // door
    const dx = 112;
    add('doorArch', `M${dx - 17},${base}V${base - 34}A17,17 0 0,1 ${dx + 17},${base - 34}V${base}Z`);
    const dw = 26 / 3;
    for (let i = 0; i < 3; i++) {
      const xa = dx - 13 + i * dw, xb = xa + dw;
      const yTop = x => base - 34 - Math.sqrt(Math.max(0, 169 - (x - dx) ** 2));
      const pts = [[xa, base]]; for (let k = 0; k <= 4; k++) { const x = xa + (xb - xa) * k / 4; pts.push([x, yTop(x)]); } pts.push([xb, base]);
      add(i % 2 ? 'door2' : 'door1', poly(pts));
    }
    add('knob', circle(dx + 8, base - 22, 3.4));
    deco(`M${dx - 13},${base - 36}h9M${dx - 13},${base - 12}h9`, 1.6);
    // roof: bent witch-hat roof made of shingle rows
    const apex = [104, 128], le = [36, 226], re = [190, 220];
    const at = (e, t) => [apex[0] + (e[0] - apex[0]) * t, apex[1] + (e[1] - apex[1]) * t];
    const ts = [0.2, 0.33, 0.47, 0.61, 0.75, 0.88, 1.0];
    const rowCols = ['roof1', 'roof2', 'roof3'];
    add('roofTip', curve([[apex[0] - 14, apex[1] + 22], [apex[0] - 2, apex[1] - 8], [apex[0] + 10, apex[1] - 32], [apex[0] + 34, apex[1] - 40], [apex[0] + 26, apex[1] - 30], [apex[0] + 18, apex[1] - 8], [apex[0] + 16, apex[1] + 22]], true));
    for (let k = 0; k < ts.length - 1; k++) {
      const a0 = at(le, ts[k]), b0 = at(re, ts[k]), a1 = at(le, ts[k + 1]), b1 = at(re, ts[k + 1]);
      const m = 2 + k, ov = 3;
      for (let j = 0; j < m; j++) {
        const u0 = j / m, u1 = (j + 1) / m;
        const lx = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
        const tl = lx(a0, b0, u0), tr = lx(a0, b0, u1), bl = lx(a1, b1, u0), br = lx(a1, b1, u1);
        const mid = [(bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2 + ov + 2];
        add(rowCols[(k + j) % 3], `M${P(...tl)}L${P(...tr)}L${P(br[0], br[1] + ov)}Q${P(...mid)} ${P(bl[0], bl[1] + ov)}Z`);
      }
    }
    // round attic window
    const ax = 108, ay = 186;
    add('frame', circle(ax, ay, 15));
    [[0, 'glass1'], [90, 'glass2'], [180, 'glass3'], [270, 'glass2']].forEach(([a0, c]) => {
      const pts = [[ax + 1.5 * Math.cos((a0 + 45) * Math.PI / 180), ay + 1.5 * Math.sin((a0 + 45) * Math.PI / 180)]];
      for (let k = 0; k <= 6; k++) { const a = (a0 + 4 + k * 82 / 6) * Math.PI / 180; pts.push([ax + 10 * Math.cos(a), ay + 10 * Math.sin(a)]); }
      add(c, poly(pts));
    });
  }
  // ── tree with autumn crown and an owl ──
  {
    const tr = (y) => 330 + 0.00035 * (y - 420) ** 2; // trunk centre line
    const half = y => 9 + (y - 120) * 0.075;
    const ysT = []; for (let y = 470; y >= 120; y -= 25) ysT.push(y);
    const sideL = ysT.map(y => [tr(y) - half(y), y]), sideR = ysT.map(y => [tr(y) + half(y), y]);
    add('trunk2', poly([...sideL, ...[...sideR].reverse()]));
    add('trunk1', poly([...sideL, ...ysT.map(y => [tr(y) - half(y) * 0.35, y]).reverse()]));
    add('trunk3', poly([...ysT.map(y => [tr(y) + half(y) * 0.4, y]), ...[...sideR].reverse()]));
    // branches
    [[[325, 230], [262, 150], 7], [[330, 190], [372, 120], 6], [[322, 270], [250, 222], 5.5]].forEach(([a, b, w]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      add('trunk1', poly([[a[0] + nx * w, a[1] + ny * w], [b[0] + nx * 2, b[1] + ny * 2], [b[0] - nx * 2, b[1] - ny * 2], [a[0] - nx * w, a[1] - ny * w]]));
    });
    add('hollow', ellipse(tr(330) + 1, 330, 16, 23));
    add('owl', curve([[tr(330) - 10, 346], [tr(330) - 11, 326], [tr(330) - 6, 316], [tr(330) - 9, 309], [tr(330), 314], [tr(330) + 9, 309], [tr(330) + 6, 316], [tr(330) + 11, 326], [tr(330) + 10, 346]], true));
    add('owlBelly', ellipse(tr(330), 336, 6, 8));
    add('owlEye', circle(tr(330) - 4.5, 322, 4.2)); add('owlEye', circle(tr(330) + 4.5, 322, 4.2));
    deco(circle(tr(330) - 4, 322.5, 1.8), 0, { fill: 'ink' }); deco(circle(tr(330) + 4, 322.5, 1.8), 0, { fill: 'ink' });
    deco(`M${P(tr(330) - 1.6, 327)}l1.6,2.6l1.6,-2.6Z`, 0, { fill: '#e8a53a' });
    // crown: back dark blobs, then mid, then light
    seed = 11;
    const crown = [];
    for (let i = 0; i < 34; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      crown.push([310 + Math.cos(a) * 70 * d, 96 + Math.sin(a) * 78 * d, rr(15, 24)]);
    }
    crown.sort((p, q) => p[1] - q[1] + (q[0] - p[0]) * 0.3);
    crown.forEach(([x, y, r], i) => {
      const lit = (330 - x) * 0.01 + (140 - y) * 0.012 + rnd() * 0.8; // light from the moon (upper left)
      const c = i < 8 ? 'leaf1' : lit > 1.3 ? 'leaf5' : lit > 0.85 ? 'leaf4' : lit > 0.4 ? 'leaf3' : 'leaf2';
      add(c, blob(x, y, r, r * 0.85, i * 1.9, 9, 0.18));
    });
    [[252, 220, 13], [240, 232, 10], [262, 230, 9]].forEach(([x, y, r], i) => add(['leaf2', 'leaf4', 'leaf3'][i], blob(x, y, r, r * 0.8, i * 2.2, 9, 0.18)));
    // falling leaves
    [[222, 196, 30], [236, 262, 120], [206, 244, -40], [290, 236, 70]].forEach(([x, y, a], i) => add(['leaf3', 'leaf4', 'leaf2', 'leaf5'][i], leaf(x, y, 15, 9, a)));
  }
  // ── foreground ground ──
  const fgTop = waveFn(372, 7, 2.2);
  add('fgRim', bandPiece(fgTop, x => fgTop(x) + 10, -12, 180)); add('fgRim', bandPiece(fgTop, x => fgTop(x) + 10, 180, 372));
  add('fg1', bandPiece(x => fgTop(x) + 10, waveFn(432, 6, 0.9), -12, 140)); add('fg1', bandPiece(x => fgTop(x) + 10, waveFn(432, 6, 0.9), 140, 372));
  add('fg2', bandPiece(waveFn(432, 6, 0.9), () => 492, -12, 120)); add('fg2', bandPiece(waveFn(432, 6, 0.9), () => 492, 120, 250)); add('fg2', bandPiece(waveFn(432, 6, 0.9), () => 492, 250, 372));
  [[40, 404, 30, 8, 'fgRim'], [300, 420, 40, 9, 'fg2'], [200, 468, 34, 8, 'fg1'], [26, 446, 24, 7, 'fg1'], [330, 482, 30, 7, 'fg1'], [96, 480, 26, 6, 'fgRim']].forEach(([x, y, rx, ry, c], i) => add(c, blob(x, y, rx, ry, i * 1.3, 9, 0.12)));
  // ── winding path with stepping stones ──
  {
    const cx = y => 112 + (y - 290) * 0.25 + 22 * Math.sin((y - 290) / 60);
    const hw = y => 12 + (y - 290) * 0.2;
    const ys = []; for (let y = 290; y <= 496; y += 12) ys.push(y);
    add('path', curve([...ys.map(y => [cx(y) - hw(y), y]), ...ys.reverse().map(y => [cx(y) + hw(y), y])], true));
    seed = 5;
    let k = 0;
    for (let y = 300; y < 486; y += 13 + (y - 290) * 0.07) {
      const s = 0.6 + (y - 290) / 260;
      const off = (k % 2 ? 1 : -1) * hw(y) * 0.38;
      add(['pathStone1', 'pathStone2', 'pathStone3'][k % 3], blob(cx(y) + off, y, 9 * s + 1, 5 * s + 1, k * 2.1, 8, 0.12));
      k++;
    }
  }
  // ── crooked picket fence (gap for the path) ──
  {
    add('rail', poly([[-12, 330], [92, 326], [92, 334], [-12, 338]]));
    add('rail', poly([[-12, 348], [92, 345], [92, 353], [-12, 356]]));
    add('rail', poly([[146, 327], [250, 332], [250, 340], [146, 335]]));
    add('rail', poly([[146, 345], [250, 350], [250, 358], [146, 353]]));
    seed = 3;
    const xs = [-4, 14, 32, 50, 68, 86, 152, 170, 188, 206, 224, 242];
    xs.forEach((x, i) => {
      const a = rr(-6, 6), h = rr(44, 54), y0 = 368;
      const pts = [[x - 7, y0], [x - 7, y0 - h + 9], [x, y0 - h], [x + 7, y0 - h + 9], [x + 7, y0]];
      add(i % 2 ? 'picket2' : 'picket1', poly(rotPts(pts, x, y0, a)));
    });
  }
  // ── lantern on a post by the path ──
  {
    const x = 146, y = 340;
    add('post', poly([[x - 4, y - 18], [x + 4, y - 18], [x + 5, 372], [x - 5, 372]]));
    add('lantHalo', circle(x, y - 34, 16));
    add('lantFrame', poly([[x - 9, y - 46], [x + 9, y - 46], [x + 11, y - 20], [x - 11, y - 20]]));
    add('lantGlow', poly([[x - 6, y - 42], [x + 6, y - 42], [x + 7, y - 24], [x - 7, y - 24]]));
    add('lantFrame', poly([[x - 6, y - 54], [x + 6, y - 54], [x + 11, y - 46], [x - 11, y - 46]]));
  }
  // ── cat sitting by the fence ──
  {
    const x = 62, y = 412;
    add('cat', curve([[x + 16, y - 6], [x + 34, y - 4], [x + 42, y - 24], [x + 34, y - 44], [x + 28, y - 36], [x + 33, y - 22], [x + 26, y - 14], [x + 14, y - 14]], true)); // tail
    add('cat', curve([[x - 18, y], [x - 20, y - 22], [x - 12, y - 40], [x, y - 46], [x + 12, y - 40], [x + 20, y - 22], [x + 18, y]], true)); // body
    add('catLit', curve([[x - 7, y - 4], [x - 9, y - 22], [x, y - 32], [x + 9, y - 22], [x + 7, y - 4]], true));
    add('catLit', ellipse(x - 9, y - 2, 8, 5)); add('catLit', ellipse(x + 9, y - 2, 8, 5));
    add('cat', poly([[x - 19, y - 62], [x - 16, y - 94], [x - 1, y - 72]]));
    add('cat', poly([[x + 19, y - 62], [x + 16, y - 94], [x + 1, y - 72]]));
    add('catEar', poly([[x - 14, y - 72], [x - 13, y - 88], [x - 5, y - 75]]));
    add('catEar', poly([[x + 14, y - 72], [x + 13, y - 88], [x + 5, y - 75]]));
    add('cat', ellipse(x, y - 60, 19, 16));
    add('catEye', ellipse(x - 7.5, y - 62, 5, 4)); add('catEye', ellipse(x + 7.5, y - 62, 5, 4));
    deco('M' + P(x - 7.5, y - 65) + 'v6M' + P(x + 7.5, y - 65) + 'v6', 1.8);
    deco(`M${P(x - 2, y - 54)}l2,2l2,-2Z`, 0, { fill: '#e88a9a' });
    deco(`M${P(x + 8, y - 54)}l16,-2M${P(x + 8, y - 51)}l15,3M${P(x - 8, y - 54)}l-16,-2M${P(x - 8, y - 51)}l-15,3`, 0.9, { light: true });
  }
  // ── pumpkins ──
  function pumpkin(cx, cy, rx, ry, fam, opts = {}) {
    const ribs = opts.ribs || 7;
    const us = Array.from({ length: ribs + 1 }, (_, i) => -1 + 2 * i / ribs);
    // stem behind the top
    add('stem1', curve([[cx - 5, cy - ry + 6], [cx - 6, cy - ry - 8], [cx - 2, cy - ry - 16 * (ry / 40)], [cx + 6, cy - ry - 14 * (ry / 40)], [cx + 4, cy - ry - 4], [cx + 5, cy - ry + 6]], true));
    const order = []; // draw outer ribs first, centre last
    for (let i = 0; i < ribs; i++) order.push(i);
    order.sort((a, b) => Math.abs(b - (ribs - 1) / 2) - Math.abs(a - (ribs - 1) / 2));
    order.forEach(i => {
      const side = Math.abs(i - (ribs - 1) / 2) / ((ribs - 1) / 2);
      const c = side > 0.9 ? fam[3] : side > 0.5 ? fam[1] : i % 2 ? fam[0] : fam[2];
      add(c, pumpkinSlice(cx, cy, rx, ry, us[i] * 1.02, us[i + 1] * 1.02));
    });
    if (opts.hi) add(opts.hi, ellipse(cx - rx * 0.42, cy - ry * 0.45, rx * 0.12, ry * 0.26, 20));
    add('stem2', curve([[cx - 1, cy - ry - 2], [cx, cy - ry - 12 * (ry / 40)], [cx + 4, cy - ry - 12 * (ry / 40)], [cx + 3, cy - ry - 2]], true));
  }
  pumpkin(176, 312, 22, 15, ['pO1', 'pO2', 'pO3', 'pO4'], { ribs: 5 });
  pumpkin(300, 448, 38, 26, ['pR1', 'pR2', 'pR3', 'pR2'], { ribs: 6, hi: 'pR3' });
  pumpkin(122, 452, 32, 22, ['pW1', 'pW2', 'pW1', 'pW3'], { ribs: 5 });
  // big jack-o'-lantern
  {
    const cx = 210, cy = 408, rx = 64, ry = 44;
    pumpkin(cx, cy, rx, ry, ['pO1', 'pO2', 'pO3', 'pO4'], { ribs: 7, hi: 'pOHi' });
    add('face1', poly([[cx - 36, cy - 4], [cx - 22, cy - 26], [cx - 8, cy - 4]]));
    add('face1', poly([[cx + 8, cy - 4], [cx + 22, cy - 26], [cx + 36, cy - 4]]));
    add('face2', poly([[cx - 31, cy - 7], [cx - 22, cy - 21], [cx - 13, cy - 7]]));
    add('face2', poly([[cx + 13, cy - 7], [cx + 22, cy - 21], [cx + 31, cy - 7]]));
    add('face1', poly([[cx - 5, cy + 4], [cx, cy - 4], [cx + 5, cy + 4]]));
    add('face1', poly([[cx - 40, cy + 8], [cx - 22, cy + 14], [cx - 16, cy + 8], [cx - 8, cy + 16], [cx + 8, cy + 16], [cx + 16, cy + 8], [cx + 22, cy + 14], [cx + 40, cy + 8], [cx + 30, cy + 26], [cx + 12, cy + 34], [cx - 12, cy + 34], [cx - 30, cy + 26]]));
    const mouth = [[cx - 40, cy + 8], [cx - 22, cy + 14], [cx - 16, cy + 8], [cx - 8, cy + 16], [cx + 8, cy + 16], [cx + 16, cy + 8], [cx + 22, cy + 14], [cx + 40, cy + 8], [cx + 30, cy + 26], [cx + 12, cy + 34], [cx - 12, cy + 34], [cx - 30, cy + 26]];
    add('face2', poly(mouth.map(([x, y]) => [cx + (x - cx) * 0.6, cy + 24 + (y - cy - 24) * 0.45])));
  }
  // vines and leaves
  deco('M176,326C186,352 168,368 186,378M238,370C262,360 272,392 270,430M128,436C140,420 160,428 170,414', 2.4, { stroke: '#4c7338' });
  [[188, 358, 16, 11, -30, 'vLeaf1'], [262, 372, 18, 12, 40, 'vLeaf2'], [276, 410, 15, 10, 100, 'vLeaf1'], [152, 424, 16, 11, -150, 'vLeaf2'], [100, 432, 15, 10, -20, 'vLeaf1']].forEach(([x, y, L, W, a, c]) => add(c, leaf(x, y, L, W, a)));
  // ── mushrooms ──
  [[24, 462, 15], [46, 470, 11], [342, 400, 10]].forEach(([x, y, s], i) => {
    add('mushStem', poly([[x - s * 0.32, y], [x - s * 0.25, y - s * 0.9], [x + s * 0.25, y - s * 0.9], [x + s * 0.32, y]]));
    add(i % 2 ? 'mush2' : 'mush1', `M${P(x - s, y - s * 0.8)}C${P(x - s, y - s * 2)} ${P(x + s, y - s * 2)} ${P(x + s, y - s * 0.8)}Q${P(x, y - s * 0.5)} ${P(x - s, y - s * 0.8)}Z`);
    add('mushDot', circle(x - s * 0.35, y - s * 1.25, s * 0.22 + 0.6)); add('mushDot', circle(x + s * 0.4, y - s * 1.12, s * 0.18 + 0.6));
  });
  // ── grass tufts ──
  [[10, 386], [100, 384], [250, 452], [352, 470], [176, 470], [74, 474], [210, 476]].forEach(([x, y], i) => {
    const s = 1 + (i % 3) * 0.15;
    add(i % 2 ? 'tuft2' : 'tuft1', poly([[x - 12 * s, y], [x - 10 * s, y - 10 * s], [x - 6 * s, y - 3 * s], [x - 3 * s, y - 16 * s], [x + 1 * s, y - 4 * s], [x + 6 * s, y - 13 * s], [x + 7 * s, y - 3 * s], [x + 12 * s, y - 9 * s], [x + 12 * s, y]]));
  });
  // ── fireflies ──
  [[150, 384], [262, 300], [24, 300], [340, 364], [90, 296], [196, 342]].forEach(([x, y]) => { add('flyHalo', circle(x, y, 10)); add('fly', circle(x, y, 4)); });

  return { regions, decorFront, colors: C };
}
