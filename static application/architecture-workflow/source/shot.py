import sys
from playwright.sync_api import sync_playwright
CH='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
def svgs(names, outdir='/tmp'):
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path=CH, args=["--no-proxy-server"])
        pg=b.new_page(viewport={'width':1600,'height':900})
        for n in names:
            svg=open(f'/home/claude/out/ridenova-blueprint/images/diagrams/{n}.svg').read()
            pg.set_content(f'<html><body style="margin:0;background:#fff">{svg}</body></html>')
            pg.locator('svg').first.screenshot(path=f'{outdir}/{n}.png')
        b.close()
if __name__=="__main__": svgs(sys.argv[1:])
