// Packs the game into one self-contained HTML file (fonts, CSS and JS inlined) for quick sharing
// and previews. The portal build is the folder itself; this file is only a convenience.
// Run: node tools/build-single.mjs  ->  dist/spooky-paint-preview.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('..', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
let css = read('css/style.css').replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (_, f) =>
  `url(data:font/woff2;base64,${readFileSync(new URL('fonts/' + f, root)).toString('base64')})`);
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src="js/'));
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => read(m[1]).replace(/<\/script/g, '<\\/script'));
const out = `<title>Spooky Paint</title>
<style>${css}</style>
${body}
${scripts.map(s => `<script>${s}</script>`).join('\n')}
`;
mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/spooky-paint-preview.html', root), out);
console.log('dist/spooky-paint-preview.html', Math.round(out.length / 1024), 'KB');
