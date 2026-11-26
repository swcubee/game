// Renders the scene, finds the visible part of every region, drops hidden ones, places labels at
// the point deepest inside the visible part (font size from that depth), writes JSON + SVGs + PNGs.
import { buildScene } from './scene.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const OUT = process.argv[2] || './out';
mkdirSync(OUT, { recursive: true });
const S = 4, W = 360 * S, H = 480 * S;
const INK = '#3a2840', PAPER = '#f6efe2';
const { regions, decorFront, colors } = buildScene();

const idSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 360 480" shape-rendering="crispEdges"><rect x="-20" y="-20" width="400" height="520" fill="#000"/>` +
  regions.map((r, i) => { const v = i + 1; return `<path d="${r.d}" fill="rgb(${v & 255},${v >> 8},0)"/>`; }).join('') + '</svg>';

const browser = await chromium.launch();
const page = await browser.newPage();
const res = await page.evaluate(async ({ svg, W, H, n }) => {
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  await img.decode();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, W, H).data;
  const id = new Int32Array(W * H);
  for (let i = 0; i < W * H; i++) id[i] = px[i * 4] + px[i * 4 + 1] * 256;
  const d = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = id[i];
    d[i] = (x === 0 || y === 0 || x === W - 1 || y === H - 1 || id[i - 1] !== v || id[i + 1] !== v || id[i - W] !== v || id[i + W] !== v) ? 0 : 1e9;
  }
  const D = Math.SQRT2;
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; d[i] = Math.min(d[i], d[i - 1] + 1, d[i - W] + 1, d[i - W - 1] + D, d[i - W + 1] + D);
  }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) {
    const i = y * W + x; d[i] = Math.min(d[i], d[i + 1] + 1, d[i + W] + 1, d[i + W + 1] + D, d[i + W - 1] + D);
  }
  const area = new Array(n + 1).fill(0), best = new Array(n + 1).fill(-1), at = new Array(n + 1).fill(0);
  for (let i = 0; i < W * H; i++) { const v = id[i]; area[v]++; if (d[i] > best[v]) { best[v] = d[i]; at[v] = i; } }
  return { area, best, at };
}, { svg: idSvg, W, H, n: regions.length });

const kept = [], dropped = [], small = [];
regions.forEach((r, i) => {
  const v = i + 1, a = res.area[v] / (S * S), rad = res.best[v] / S;
  if (a < 6 || rad < 1.5) { dropped.push(`${r.id}/${r.cn} area ${a.toFixed(1)} r ${rad.toFixed(1)}`); return; }
  const x = (res.at[v] % W + 0.5) / S, y = (Math.floor(res.at[v] / W) + 0.5) / S;
  const fs = Math.max(3.2, Math.min(11.5, rad * 1.25));
  if (rad < 2.8) small.push(`${r.id}/${r.cn} r ${rad.toFixed(1)}`);
  kept.push({ ...r, nx: +x.toFixed(1), ny: +y.toFixed(1), fs: +fs.toFixed(1), rad });
});
const names = []; kept.forEach(r => { if (!names.includes(r.cn)) names.push(r.cn); });
const palette = names.map(k => colors[k]);
kept.forEach(r => { r.c = names.indexOf(r.cn); });
const counts = palette.map((_, i) => kept.filter(r => r.c === i).length);
console.log('regions', kept.length, 'colours', palette.length, 'dropped', dropped.length, 'small', small.length);
if (dropped.length) console.log('DROPPED', dropped.join('; '));
if (small.length) console.log('SMALL', small.join('; '));
const unused = Object.keys(colors).filter(k => !names.includes(k)); if (unused.length) console.log('UNUSED', unused.join(' '));

const picture = {
  id: 'cottage', name: { ru: 'Домик ведьмы на тыквенной поляне', en: "The Witch's Pumpkin Patch" },
  palette, paletteNames: names, counts,
  regions: kept.map(({ id, c, d, nx, ny, fs }) => ({ id, c, d, nx, ny, fs })),
  decorBack: [], decorFront,
};
writeFileSync(`${OUT}/cottage-picture.json`, JSON.stringify(picture));

const decorSvg = () => decorFront.map(dd => {
  const fill = dd.fill === 'ink' ? INK : (dd.fill || 'none');
  const stroke = dd.stroke || (dd.s ? (dd.light ? 'rgba(255,255,255,.55)' : INK) : 'none');
  return `<path d="${dd.d}" fill="${fill}" stroke="${stroke}" stroke-width="${dd.s || 0}" stroke-linecap="round" stroke-linejoin="round"/>`;
}).join('');
function svg(mode) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" width="1080" height="1440"><style>text{font-family:Nunito,Arial,sans-serif;font-weight:900;fill:#8c7a8e;text-anchor:middle;dominant-baseline:central}</style>`;
  s += kept.map(r => `<path d="${r.d}" fill="${mode === 'color' ? palette[r.c] : PAPER}" stroke="${INK}" stroke-width="${mode === 'color' ? 0.5 : 0.6}" stroke-linejoin="round"/>`).join('');
  if (mode === 'color') s += decorSvg();
  if (mode === 'numbers') s += kept.map(r => `<text x="${r.nx}" y="${r.ny}" font-size="${r.fs}">${r.c + 1}</text>`).join('');
  return s + '</svg>';
}
writeFileSync(`${OUT}/cottage-numbers.svg`, svg('numbers'));
writeFileSync(`${OUT}/cottage-colored.svg`, svg('color'));
for (const m of ['numbers', 'color']) {
  await page.setViewportSize({ width: 1080, height: 1440 });
  await page.setContent(`<body style="margin:0">${svg(m)}</body>`);
  await page.screenshot({ path: `${OUT}/cottage-${m === 'color' ? 'colored' : 'numbers'}.png` });
}
await browser.close();
