import sys, glob, os
from playwright.sync_api import sync_playwright
CH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
ROOT = '/home/claude/out/ridenova-blueprint'

def run(app, ids=None, out=None):
    files = sorted(glob.glob(f'{ROOT}/screens/{app}/[A-Z][0-9][0-9]-*.html'))
    dest = out or f'{ROOT}/images/screens/{app}'
    os.makedirs(dest, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CH, args=["--no-proxy-server"])
        pg = b.new_page(viewport={'width': 1500, 'height': 1000}, device_scale_factor=2 if app != 'admin' else 1.25)
        for f in files:
            sid = os.path.basename(f)[:3]
            if ids and sid not in ids:
                continue
            pg.goto('file://' + f)
            pg.wait_for_timeout(40)
            pg.locator('#mock > *').first.screenshot(path=f'{dest}/{sid}.png')
        b.close()

if __name__ == '__main__':
    app = sys.argv[1]
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else None
    out = sys.argv[3] if len(sys.argv) > 3 else None
    run(app, ids, out)
