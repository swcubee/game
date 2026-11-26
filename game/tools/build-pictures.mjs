// Builds js/pictures.js from the geometry below.
// Each picture: palette (1 picture = 1 palette), regions (one paintable cell each,
// colour index c into the palette, label point nx/ny), decor drawn under and over the cells.
// Run: node tools/build-pictures.mjs
import { writeFileSync } from 'node:fs';

const r1 = n => Math.round(n * 10) / 10;
const P = (x, y) => `${r1(x)},${r1(y)}`;

// Catmull-Rom through points -> cubic bezier segments (open curve, starts with M)
function curve(pts, closed = false) {
  const p = closed ? [pts.at(-1), ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts.at(-1)];
  let d = `M${P(...p[1])}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[i + 2];
    d += `C${P(x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6)} ${P(x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6)} ${P(x2, y2)}`;
  }
  return closed ? d + 'Z' : d;
}
const curveSeg = pts => curve(pts).replace(/^M[^C]+/, ''); // continuation without M
const wave = (y, amp, ph, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
  const x = -12 + i * (384 / n);
  return [x, y + amp * Math.sin(x / 55 + ph) + amp * 0.4 * Math.sin(x / 23 + ph * 2)];
});
// band between two wavy edges
function band(top, bottom) {
  const b = [...bottom].reverse();
  return `${curve(top)}L${P(...b[0])}${curveSeg(b)}Z`;
}
const flatEdge = y => [[-12, y], [372, y]];
const poly = pts => 'M' + pts.map(p => P(...p)).join('L') + 'Z';
const circle = (cx, cy, r) => `M${P(cx - r, cy)}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0Z`;
const ellipse = (cx, cy, rx, ry, rot = 0) => {
  const pts = []; const a = rot * Math.PI / 180;
  for (let i = 0; i < 24; i++) {
    const t = i / 24 * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return curve(pts, true);
};
function star(cx, cy, R, rot = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (rot + i * 36) * Math.PI / 180, r = i % 2 ? R * 0.48 : R;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return poly(pts);
}
const rotPts = (pts, cx, cy, deg) => {
  const a = deg * Math.PI / 180;
  return pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
};
// wobbly rounded rect: corners slightly uneven, like hand cut paper
function brick(x0, y0, x1, y1, seed) {
  const j = k => Math.sin(seed * 12.9898 + k * 78.233) * 2.2;
  const r = 7;
  const pts = [
    [x0 + r, y0 + j(1)], [(x0 + x1) / 2, y0 + j(2)], [x1 - r, y0 + j(3)],
    [x1 + j(4), y0 + r], [x1 + j(5), (y0 + y1) / 2], [x1 + j(6), y1 - r],
    [x1 - r, y1 + j(7)], [(x0 + x1) / 2, y1 + j(8)], [x0 + r, y1 + j(9)],
    [x0 + j(10), y1 - r], [x0 + j(11), (y0 + y1) / 2], [x0 + j(12), y0 + r],
  ];
  return curve(pts, true);
}
function bat(cx, cy, s, tilt = 0) {
  const base = [[0, -8], [6, -2], [16, -11], [30, -13], [38, -6], [31, -2], [30, 7], [22, 3], [15, 11], [7, 6], [0, 10],
    [-7, 6], [-15, 11], [-22, 3], [-30, 7], [-31, -2], [-38, -6], [-30, -13], [-16, -11], [-6, -2]];
  return poly(rotPts(base.map(([x, y]) => [cx + x * s, cy + y * s]), cx, cy, tilt));
}
const flame = (x, base, h, w) => `M${P(x, base - h)}C${P(x + w * 1.1, base - h * 0.45)} ${P(x + w, base)} ${P(x, base)}C${P(x - w, base)} ${P(x - w * 1.1, base - h * 0.45)} ${P(x, base - h)}Z`;
// a rising wisp of steam: tapered S-curve
function wisp(x, y0, h, amp, w, ph = 0) {
  const n = 8, L = [], Rr = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, cx = x + amp * Math.sin(t * Math.PI * 1.6 + ph), cy = y0 - t * h;
    const ww = w * (1 - t * 0.75) * (i === 0 ? 0.9 : 1);
    L.push([cx - ww, cy]); Rr.push([cx + ww, cy]);
  }
  const tip = [x + amp * Math.sin(Math.PI * 1.6 + ph) + 2, y0 - h - 6];
  return `${curve([...L, tip])}L${P(...Rr.at(-1))}${curveSeg([...Rr].reverse())}Z`;
}
function blob(cx, cy, rx, ry, seed, n = 9) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, k = 1 + 0.16 * Math.sin(seed + i * 2.3);
    pts.push([cx + rx * k * Math.cos(t), cy + ry * k * Math.sin(t)]);
  }
  return curve(pts, true);
}
// a pumpkin slice between meridians u0..u1 of an ellipse
function pumpkinSlice(cx, cy, rx, ry, u0, u1) {
  const side = u => Array.from({ length: 11 }, (_, i) => {
    const t = -1 + i / 5, s = Math.sqrt(Math.max(0, 1 - t * t));
    const bulge = 1 + 0.06 * Math.sin((u + 1) * Math.PI * 3); // lobed outline
    return [cx + rx * u * s * bulge, cy + ry * t];
  });
  const a = side(u0), b = side(u1).reverse();
  return `${curve(a)}L${P(...b[0])}${curveSeg(b)}Z`;
}
const sliceLabel = (cx, cy, rx, ry, u0, u1, t) => {
  const u = (u0 + u1) / 2;
  return [cx + rx * u * Math.sqrt(1 - t * t), cy + ry * t];
};

const R = (id, c, d, nx, ny, extra = {}) => ({ id, c, d, nx: r1(nx), ny: r1(ny), ...extra });

// ───────────────────────── Picture 1: pumpkin on the fence ─────────────────────────
function picture1() {
  const regions = [], decorBack = [], decorFront = [];
  const edges = [flatEdge(-12), wave(72, 7, 0.3), wave(140, 8, 1.7), wave(206, 7, 3.1), wave(268, 8, 4.4), flatEdge(492)];
  const skyLabels = [[128, 34], [58, 106], [300, 178], [180, 236], [180, 292]];
  for (let i = 0; i < 5; i++) regions.push(R(`sky${i}`, 0, band(edges[i], edges[i + 1]), ...skyLabels[i]));
  regions.push(R('moon', 2, circle(262, 92, 46), 262, 96));
  decorFront.push({ d: circle(244, 74, 8), s: 1 }, { d: circle(284, 113, 6), s: 1 }, { d: circle(236, 112, 4), s: 1 });
  regions.push(R('star0', 2, star(72, 52, 16, -86), 72, 56));
  regions.push(R('star1', 2, star(166, 116, 14, -95), 166, 120));
  decorFront.push({ d: 'M108,30l0,10M103,35l10,0', s: 1 }, { d: 'M212,52l0,8M208,56l8,0', s: 1 }, { d: 'M34,150l0,8M30,154l8,0', s: 1 });
  const planks = [[40, -2.2, 300], [105, 1.6, 284], [255, -1.1, 284], [320, 2.6, 300]];
  planks.forEach(([x, ang, ly], i) => {
    const w = 22, top = 238;
    const pts = rotPts([[x - w, 480], [x - w, top + 12], [x, top - 8], [x + w, top + 12], [x + w, 480]], x, 360, ang);
    regions.push(R(`plank${i}`, 2, poly(pts), x, ly));
    decorFront.push({ d: circle(x + Math.sin(ang / 57) * -60, 272, 2), fill: 'ink' }, { d: circle(x + Math.sin(ang / 57) * -40, 392, 2), fill: 'ink' });
  });
  regions.push(R('hill0', 0, 'M-12,418C60,380 150,392 210,412S320,396 372,404V492H-12Z', 322, 430));
  regions.push(R('hill1', 0, 'M-12,458C80,436 170,448 240,458S330,446 372,452V492H-12Z', 60, 476));
  decorFront.push({ d: 'M300,452l4,-9l3,9M316,450l3,-7l3,7', s: 1 }, { d: 'M30,466l4,-8l3,8M96,462l3,-7l3,7', s: 1 });
  const cx = 180, cy = 386, rx = 98, ry = 60;
  const us = [-1, -0.74, -0.4, 0, 0.4, 0.74, 1];
  const labelT = [0.05, 0.42, -0.74, -0.74, 0.42, 0.05];
  for (let i = 0; i < 6; i++) {
    const [lx, ly] = sliceLabel(cx, cy, rx, ry, us[i], us[i + 1], labelT[i]);
    regions.push(R(`rib${i}`, 1, pumpkinSlice(cx, cy, rx, ry, us[i], us[i + 1]), lx, ly));
  }
  regions.push(R('stem', 0, 'M172,331C170,318 171,306 177,298L190,302C186,310 185,320 188,331Z', 180, 320));
  decorFront.push({ d: 'M188,312c14,-10 27,-3 23,8c-3,8 -14,6 -12,-1', s: 1.6 });
  regions.push(R('eyeL', 2, poly([[137, 382], [152, 357], [167, 382]]), 152, 377));
  regions.push(R('eyeR', 2, poly([[193, 382], [208, 357], [223, 382]]), 208, 377));
  regions.push(R('mouth', 2, poly([[140, 398], [160, 406], [166, 399], [172, 407], [188, 407], [194, 399], [200, 406], [220, 398], [212, 414], [196, 424], [180, 427], [164, 424], [148, 414]]), 180, 418));
  return {
    id: 'pumpkin', name: { ru: 'Тыква на заборе', en: 'Pumpkin on the Fence' },
    palette: ['#4b3572', '#f28a2e', '#f6da8c'], regions, decorBack, decorFront, anim: 'glow',
  };
}

// ───────────────────────── Picture 2: witch's cat on a broom ─────────────────────────
function picture2() {
  const regions = [], decorBack = [], decorFront = [];
  const edges = [flatEdge(-12), wave(80, 8, 0.9), wave(160, 9, 2.2), wave(240, 8, 3.6), wave(320, 9, 5.0), flatEdge(492)];
  const skyLabels = [[152, 40], [30, 125], [340, 202], [336, 264], [330, 356]];
  for (let i = 0; i < 5; i++) regions.push(R(`sky${i}`, 0, band(edges[i], edges[i + 1]), ...skyLabels[i]));
  [[20, 30], [96, 18], [210, 22], [296, 120], [26, 300], [345, 160], [120, 70]].forEach(([x, y], i) =>
    decorBack.push({ d: circle(x, y, i % 3 ? 1.6 : 2.4), fill: '#f6e7b4', top: true }));
  regions.push(R('moon', 2, circle(190, 200, 118), 172, 112));
  regions.push(R('crater0', 3, circle(118, 170, 16), 118, 174));
  regions.push(R('crater1', 3, circle(262, 116, 13), 262, 120));
  regions.push(R('crater2', 3, circle(150, 294, 17), 150, 298));
  regions.push(R('cloud', 3, 'M226,312C236,296 262,296 272,304C284,290 312,292 318,306C334,300 360,304 368,316C356,330 330,332 312,326C298,336 270,336 256,328C240,334 222,326 226,312Z', 292, 318));
  regions.push(R('bat0', 1, bat(54, 68, 1.25, -8), 54, 70));
  regions.push(R('bat1', 1, bat(318, 54, 1.0, 10), 318, 56));
  regions.push(R('bat2', 1, bat(44, 206, 0.95, 4), 44, 208));
  regions.push(R('house0', 1, poly([[-12, 492], [-12, 420], [30, 384], [72, 424], [72, 492]]), 24, 458));
  regions.push(R('house1', 1, poly([[62, 492], [62, 438], [88, 410], [88, 392], [100, 392], [100, 400], [108, 396], [152, 436], [152, 492]]), 136, 458));
  regions.push(R('house2', 1, poly([[142, 492], [142, 420], [196, 368], [252, 420], [252, 492]]), 196, 424));
  regions.push(R('house3', 1, poly([[242, 492], [242, 430], [302, 390], [372, 432], [372, 492]]), 342, 458));
  regions.push(R('window0', 2, 'M92,476V456C92,446 116,446 116,456V476Z', 104, 466));
  regions.push(R('window1', 2, 'M290,474V454C290,442 316,442 316,454V474Z', 303, 464));
  regions.push(R('pump0', 2, ellipse(182, 470, 19, 14), 182, 474));
  regions.push(R('pump1', 2, ellipse(224, 476, 15, 11), 224, 477));
  decorFront.push({ d: 'M182,456c1,-5 4,-7 7,-8M224,465c1,-4 3,-5 5,-6', s: 1.6 }, { d: 'M104,446V476M92,462H116', s: 1 }, { d: 'M303,444V474M290,459H316', s: 1 });
  // broom
  const B = [72, 300], E = [305, 245];
  const L = Math.hypot(E[0] - B[0], E[1] - B[1]);
  const d = [(E[0] - B[0]) / L, (E[1] - B[1]) / L], n = [-d[1], d[0]];
  const at = (t, o) => [B[0] + d[0] * t + n[0] * o, B[1] + d[1] * t + n[1] * o];
  regions.push(R('stick', 3, poly([at(0, -6), at(L + 6, -5), at(L + 10, 0), at(L + 6, 5), at(0, 6)]), ...at(52, 0)));
  for (let i = 0; i < 4; i++) {
    const b0 = at(-2, -9 + i * 4.5), b1 = at(-2, -9 + (i + 1) * 4.5);
    const t0 = at(-60, -36 + i * 18), t1 = at(-60, -36 + (i + 1) * 18), mid = at(-64, -27 + i * 18);
    regions.push(R(`bristle${i}`, 3, `M${P(...b0)}L${P(...b1)}L${P(...t1)}Q${P(...mid)} ${P(...t0)}Z`, ...at(-40, -22 + i * 13.5)));
  }
  regions.push(R('tie', 2, poly([at(-2, -10), at(10, -10), at(10, 10), at(-2, 10)]), ...at(4, 0)));
  // cat
  regions.push(R('tail', 1, 'M152,238C120,238 100,222 106,196C110,180 128,178 131,191C122,192 117,204 124,214C130,224 142,226 154,226Z', 115, 205));
  regions.push(R('legB', 1, 'M166,250L182,252L180,284C178,292 166,292 164,284Z', 172, 272));
  regions.push(R('body', 1, ellipse(192, 238, 48, 30, -12), 188, 242));
  regions.push(R('legF', 1, 'M216,248L232,250L234,280C232,288 220,288 218,280Z', 225, 270));
  regions.push(R('earL', 1, poly([[214, 198], [217, 168], [234, 184]]), 219, 178));
  regions.push(R('earR', 1, poly([[262, 186], [281, 160], [279, 200]]), 275, 178));
  regions.push(R('head', 1, circle(240, 208, 27), 236, 222));
  regions.push(R('hat', 0, 'M228,190C238,170 246,150 268,128C262,148 262,168 268,186Z', 254, 172));
  regions.push(R('brim', 0, ellipse(248, 189, 28, 6, -8), 233, 191));
  // g: 'cat' — these details move together with the cat when the picture comes alive
  decorFront.push(
    { d: ellipse(231, 207, 4.5, 3.2, 0), fill: '#c6e85a', g: 'cat' }, { d: ellipse(251, 206, 4.5, 3.2, 0), fill: '#c6e85a', g: 'cat' },
    { d: 'M231,204.5v5M251,203.5v5', s: 1.6, g: 'cat' },
    { d: 'M258,215l18,-3M258,219l18,2M222,216l-16,-2M222,220l-15,3', s: 1, light: true, g: 'cat' },
    { d: `M${P(...at(-4, -4))}L${P(...at(-56, -14))}M${P(...at(-4, 3))}L${P(...at(-56, 12))}`, s: 1, g: 'cat' },
  );
  return {
    id: 'cat', name: { ru: 'Кот ведьмы', en: "The Witch's Cat" },
    palette: ['#33427a', '#2a2233', '#f59a3a', '#e3bd63'], regions, decorBack, decorFront, anim: 'fly',
  };
}

// ───────────────────────── Picture 3: the cauldron ─────────────────────────
function picture3() {
  const regions = [], decorBack = [], decorFront = [];
  decorBack.push({ d: 'M-12,-12H372V492H-12Z', fill: '#2c2238' });
  const rows = [
    [[-10, 108, 50, 40], [114, 236, 195, 30], [242, 370, 330, 40]],
    [[-10, 90, 40, 112], [96, 200, 150, 100], [206, 290, 262, 128], [296, 370, 333, 123]],
    [[-10, 108, 40, 200], [114, 236, 128, 186], [242, 370, 320, 200]],
    [[-10, 56, 14, 302], [304, 370, 348, 302]],
  ];
  const ys = [[-12, 82], [88, 164], [170, 246], [252, 396]];
  let k = 0;
  rows.forEach((row, ri) => row.forEach(([x0, x1, lx, ly]) => {
    regions.push(R(`brick${k}`, 0, brick(x0, ys[ri][0], x1, ys[ri][1], k + 3), lx, ly)); k++;
  }));
  regions.push(R('floor0', 0, brick(-12, 404, 104, 500, 21), 45, 458));
  regions.push(R('floor1', 0, brick(110, 458, 252, 500, 22), 180, 478));
  regions.push(R('floor2', 0, brick(258, 404, 372, 500, 23), 332, 458));
  regions.push(R('steam0', 4, wisp(112, 168, 88, 12, 13, 0), 112, 150));
  regions.push(R('steam1', 4, wisp(200, 150, 96, 14, 14, 2.4), 204, 132));
  regions.push(R('steam2', 4, wisp(150, 80, 70, 10, 11, 1.2), 150, 68));
  regions.push(R('steam3', 4, wisp(262, 104, 84, 12, 12, 3.6), 257, 97));
  regions.push(R('bottleG', 2, 'M33,340H48V362C60,366 64,376 64,388V414C64,420 60,424 54,424H26C20,424 16,420 16,414V388C16,376 22,366 33,362Z', 40, 398));
  regions.push(R('bottleO', 3, 'M314,340H330V368C344,372 350,384 350,394C350,410 338,422 322,422C306,422 294,410 294,394C294,384 300,372 314,368Z', 322, 398));
  regions.push(R('jar', 4, 'M272,388H292V398C302,402 306,410 306,418C306,428 298,434 282,434C266,434 258,428 258,418C258,410 262,402 272,398Z', 282, 420));
  regions.push(R('handleL', 1, 'M70,276C42,272 30,300 46,316C54,324 64,322 70,316L66,306C60,310 54,308 52,302C48,290 56,284 70,288Z', 46, 300));
  regions.push(R('handleR', 1, 'M290,276C318,272 330,300 314,316C306,324 296,322 290,316L294,306C300,310 306,308 308,302C312,290 304,284 290,288Z', 314, 300));
  regions.push(R('legL', 1, 'M100,384L120,392L108,432L84,432Z', 99, 420));
  regions.push(R('legR', 1, 'M260,384L240,392L252,432L276,432Z', 261, 420));
  regions.push(R('body', 1, 'M64,262C58,330 108,404 180,404C252,404 302,330 296,262Z', 180, 350));
  // back row of tall flames, then a front row of short ones
  [[136, 66, 16], [166, 78, 17], [196, 74, 17], [226, 62, 16]].forEach(([x, h, w], i) =>
    regions.push(R(`flame${i}`, 3, flame(x, 440, h, w), x, 440 - h * 0.62)));
  [[118, 40, 12], [151, 46, 13], [211, 44, 13], [243, 38, 12]].forEach(([x, h, w], i) =>
    regions.push(R(`flame${i + 4}`, 3, flame(x, 442, h, w), x, 442 - h * 0.3)));
  regions.push(R('logA', 1, poly(rotPts([[102, 432], [182, 432], [182, 450], [102, 450]], 142, 441, -3)), 142, 444));
  regions.push(R('logB', 1, poly(rotPts([[180, 434], [258, 434], [258, 452], [180, 452]], 219, 443, 4)), 219, 447));
  decorFront.push({ d: 'M108,441c-4,-3 -4,-7 0,-9M254,443c4,-3 4,-7 0,-9', s: 1.2 });
  regions.push(R('rim', 1, ellipse(180, 258, 122, 24), 67, 262));
  regions.push(R('potion', 2, ellipse(180, 256, 104, 15), 180, 260));
  [110, 150, 226, 262].forEach((x, i) =>
    regions.push(R(`drip${i}`, 2, `M${x - 9},274C${x - 9},290 ${x - 6},296 ${x - 6},304C${x - 6},314 ${x + 6},314 ${x + 6},304C${x + 6},296 ${x + 9},290 ${x + 9},274Z`, x, 298)));
  [[150, 222, 13], [200, 210, 16], [238, 226, 11], [174, 186, 12], [228, 178, 11]].forEach(([x, y, r], i) =>
    regions.push(R(`bubble${i}`, 4, circle(x, y, r), x, y + 4)));
  decorFront.push(
    { d: 'M120,250c20,-8 50,-11 70,-10', s: 2, light: true, fill: 'none' },
    { d: 'M196,214c4,-6 9,-8 13,-7M146,218c3,-4 6,-5 9,-5', s: 1.2, light: true },
    { d: 'M86,300c4,30 22,62 52,80', s: 1.6, light: true },
  );
  return {
    id: 'cauldron', name: { ru: 'Котёл с зельем', en: 'The Bubbling Cauldron' },
    palette: ['#5b4a7c', '#2b2433', '#86cc4d', '#f2742b', '#f1e6c8'], regions, decorBack, decorFront, anim: 'brew',
  };
}

const pictures = [picture1(), picture2(), picture3()];
for (const p of pictures) {
  const counts = p.palette.map((_, i) => p.regions.filter(r => r.c === i).length);
  p.counts = counts;
  console.log(p.id, 'cells', p.regions.length, 'per colour', counts.join('/'));
}
writeFileSync(new URL('../js/pictures.js', import.meta.url),
  '// Generated by tools/build-pictures.mjs — edit the generator, not this file.\nwindow.PICTURES = ' + JSON.stringify(pictures) + ';\n');
