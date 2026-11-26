"""Checks that every cell's number sits on a visible part of that same cell (so tapping the number paints it)."""
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
html = """<!doctype html><link rel="stylesheet" href="../css/style.css"><body style="margin:0"><div id="pic-viewport" style="width:720px;height:960px;position:relative;inset:auto;left:0;top:0"></div>
<script src="../js/pictures.js"></script><script src="../js/paint.js"></script>
<script>window.check = i => { const v = document.getElementById('pic-viewport'); v.innerHTML = PaintScene.markup(PICTURES[i], new Set(), {numbers:true});
 const svg = v.querySelector('svg'); svg.style.width='720px'; svg.style.height='960px'; const bad = [];
 for (const r of PICTURES[i].regions) { const x = r.nx*2, y = r.ny*2; let ok = 0;
   for (const [dx,dy] of [[0,0],[-6,0],[6,0],[0,-6],[0,6]]) { const el = document.elementFromPoint(x+dx, y+dy); const c = el && el.closest('.cell'); if (c && c.dataset.id === r.id) ok++; }
   if (ok < 4) bad.push(r.id + ' ' + ok + '/5'); } return [PICTURES[i].id, bad]; };</script>"""
(root / 'tools' / '_labels.html').write_text(html)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 720, 'height': 960})
    pg.goto((root / 'tools' / '_labels.html').as_uri())
    n = pg.evaluate('PICTURES.length')
    results = [pg.evaluate(f'check({i})') for i in range(n)]
    for r in results: print(r)
    b.close()
(root / 'tools' / '_labels.html').unlink()
sys.exit(1 if any(bad for _, bad in results) else 0)
