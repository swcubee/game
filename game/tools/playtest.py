"""Automated play-through in headless Chromium.
Plays sort levels by the shortest solution, paints every cell it can, and saves screenshots.
Usage: python3 tools/playtest.py OUT_DIR [width height] [max_levels_to_play] [start_picture_index]
Stops early when every picture is finished.
Levels are built at runtime (js/levelgen.js); a start picture > 0 begins there with a fresh save.
"""
import sys, os, pathlib
from playwright.sync_api import sync_playwright

out = sys.argv[1]
W, H = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (390, 844)
LEVELS = int(sys.argv[4]) if len(sys.argv) > 4 else 2
START = int(sys.argv[5]) if len(sys.argv) > 5 else 0
os.makedirs(out, exist_ok=True)
url = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').as_uri()
errors = []
failed = False

def solve_level(pg):
    # one solver run per level (in-page BFS per move is slow and memory hungry), then replay the moves
    path = pg.evaluate("SortScene.__solution()")
    if not path:
        return False
    fl = pg.locator('#shelves .flask')
    for a, b in path:
        while pg.evaluate("SortScene.__busy()"):
            pg.wait_for_timeout(100)
        fl.nth(a).click(force=True); pg.wait_for_timeout(120)
        fl.nth(b).click(force=True); pg.wait_for_timeout(400)
    return True

def lose_by_moves(pg):
    # spend every move pouring one colour back and forth between the two empty flasks: the level must be lost
    fl = pg.locator('#shelves .flask')
    sizes = pg.evaluate("[...document.querySelectorAll('#shelves .flask')].map(f => f.querySelectorAll('.layer').length)")
    src, e1, e2 = 0, sizes.index(0), len(sizes) - 1 - sizes[::-1].index(0)
    pairs = [(src, e1)] + [(e1, e2), (e2, e1)] * 40
    for a, b in pairs:
        if pg.locator('#overlay:not(.hidden)').count():
            break
        while pg.evaluate("SortScene.__busy()"):
            pg.wait_for_timeout(100)
        fl.nth(a).click(force=True); pg.wait_for_timeout(120)
        fl.nth(b).click(force=True); pg.wait_for_timeout(400)
    pg.wait_for_selector('#overlay:not(.hidden) #note .btn', timeout=8000); pg.wait_for_timeout(300)
    text = pg.evaluate("document.getElementById('note').textContent")
    want = pg.evaluate("I18N.t('loseMoves')")
    if want not in text:
        raise SystemExit('expected the out-of-moves loss, got: ' + text)
    print('out of moves: level lost')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': W, 'height': H}, has_touch=W < 800)
    pg.on('pageerror', lambda e: (errors.append(str(e)), print('PAGEERROR', e)))
    pg.on('console', lambda m: m.type in ('error', 'warning') and (errors.append(m.text), print('CONSOLE', m.text, flush=True)))
    pg.goto(url); pg.wait_for_timeout(300)
    if START:
        pg.evaluate('''pic => { localStorage.setItem('spooky-paint:save', JSON.stringify({ v: 1, level: 1 + 6 * pic, pic,
            paint: [], painted: [], done: PICTURES.slice(0, pic).map(p => p.id), sound: false, tut: { brewed: true, painted: true } })); }''', START)
        pg.reload()
    pg.wait_for_timeout(900)
    pg.screenshot(path=f'{out}/01-start.png')
    for lv in range(LEVELS):
        if pg.locator('#btn-brew:disabled').count():          # every picture is finished: nothing left to brew
            print('all pictures finished after', lv, 'levels'); break
        pg.click('#btn-brew', force=True); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{out}/02-sort-{lv+1}.png')
        pg.locator('#shelves .flask').nth(0).click(force=True); pg.wait_for_timeout(250)
        if lv == 0: pg.screenshot(path=f'{out}/03-selected.png')
        pg.locator('#shelves .flask').nth(0).click(force=True); pg.wait_for_timeout(200)
        if lv == 0 and START == 0 and not pg.locator('#moves.hidden').count():
            raise SystemExit('the tutorial level must have no move limit')
        if lv == 1 and START == 0:
            lose_by_moves(pg)
            pg.screenshot(path=f'{out}/03-lost.png')
            pg.click('#note .btn', force=True); pg.wait_for_timeout(500)
        ok = solve_level(pg)
        print('level', lv + 1, 'solved' if ok else 'stopped', pg.evaluate("document.getElementById('level-name').textContent"))
        try:
            pg.wait_for_selector('#overlay:not(.hidden) #note .btn', timeout=8000); pg.wait_for_timeout(400)
        except Exception:
            pg.screenshot(path=f'{out}/FAIL-level-{lv+1}.png'); print('no win overlay on level', lv + 1)
            print('flasks:', pg.evaluate("[...document.querySelectorAll('#shelves .flask')].map(f => f.style.transform + ' anims=' + f.getAnimations().map(a => a.playState).join(','))"))
            print('all flask-like:', pg.evaluate("[...document.querySelectorAll('.flask, .glass')].map(e => e.className.baseVal ?? e.className).length"), pg.evaluate("(() => { const r = document.elementFromPoint(760, 40); return r && (r.outerHTML.slice(0, 160) + ' parent=' + (r.closest('.flask') ? r.closest('.flask').parentElement.id : '-')); })()"))
            print('hit test:', pg.evaluate('''(() => { const fl = [...document.querySelectorAll('#shelves .flask')]; return fl.map((f, i) => { const r = f.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const g = e && e.closest('.flask'); return i + '->' + (g ? fl.indexOf(g) : (e && e.className)) + ' rect ' + [r.left|0, r.top|0, r.width|0, r.height|0].join(','); }); })()'''))
            print('busy:', pg.evaluate("SortScene.__busy()"), 'solution from here:', pg.evaluate("SortScene.__solution()"))
            print('animations:', pg.evaluate("document.getAnimations().map(a => a.playState + ':' + (a.effect && a.effect.target && a.effect.target.className))"))
            failed = True
            break
        if lv == 0: pg.screenshot(path=f'{out}/04-win.png')
        pg.click('#note .btn', force=True); pg.wait_for_timeout(500)
        # paint everything we have paint for
        for _ in range(60):
            cell = pg.evaluate("""() => {
              const jars = [...document.querySelectorAll('#jars .jar')];
              const cells = [...document.querySelectorAll('#pic-viewport .cell.todo')];
              for (const c of cells) { const k = +c.dataset.c; const cnt = +(jars[k].querySelector('.count').textContent);
                if (cnt > 0) { const r = c.getBoundingClientRect(); const t = document.querySelector('#pic-viewport .num[data-for="'+c.dataset.id+'"]').getBoundingClientRect();
                  return [k, t.x + t.width/2, t.y + t.height/2]; } }
              return null; }""")
            if not cell: break
            k, x, y = cell
            pg.locator('#jars .jar').nth(k).click(force=True); pg.wait_for_timeout(60)
            pg.mouse.click(x, y); pg.wait_for_timeout(90)
        pg.wait_for_timeout(3000)
        pg.screenshot(path=f'{out}/05-painted-{lv+1}.png')
        if pg.locator('#overlay:not(.hidden)').count():
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{out}/06-picture-done-{lv+1}.png')
            pg.click('#note .btn', force=True); pg.wait_for_timeout(600)
    if pg.locator('#paint:not(.hidden)').count(): pg.click('#btn-gallery', force=True)
    pg.wait_for_timeout(500)
    pg.screenshot(path=f'{out}/07-gallery.png')
    b.close()
print('errors:', errors or 'none')
sys.exit(1 if errors or failed else 0)
