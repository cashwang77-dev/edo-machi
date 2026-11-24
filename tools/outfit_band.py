# 立繪衣裝分區：每一格算出 腰帶上緣、腰帶下緣、下襬底（像素，由上往下），寫進 img/spr/<原型>.json 的 "ob"（依格號）
# 遊戲的著色器用它把和服分成上身／下身，畫出羽織、袴、法被。
# 用法：python -I tools/outfit_band.py [原型…] [--preview]   （預覽輸出 shots/ob_<原型>.png：紅線＝腰帶、藍線＝下襬）
import sys, os, json, glob
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPR = os.path.join(ROOT, 'img', 'spr')

def band(K, G, fh):
    ys = np.nonzero(K.any(1))[0]
    if len(ys) < 10: return None
    kt, kb = int(ys.min()), int(ys.max())
    xs = np.nonzero(K.any(0))[0]; x0, x1 = xs.min(), xs.max()
    lo, hi = int(fh * .3), int(fh * .8)
    cnt = G[:, x0:x1 + 1].sum(1).astype(float); cnt[:lo] = 0; cnt[hi:] = 0
    if cnt.max() >= 8:
        m = cnt.argmax(); th = max(5, cnt.max() * .35); t = b = m
        while t > lo and cnt[t - 1] >= th: t -= 1
        while b < hi and cnt[b + 1] >= th: b += 1
        if 4 <= b - t <= fh * .2: return [int(t), int(b), kb]
    # 找不到腰帶（背面被手擋住等）：用和服高度估計
    t = int(kt + (kb - kt) * .3); return [t, t + int(fh * .07), kb]

def run(name, preview=False):
    jp = os.path.join(SPR, name + '.json'); meta = json.load(open(jp, encoding='utf-8'))
    fw, fh, cols, rows = meta['fw'], meta['fh'], meta['cols'], meta['rows']
    m = np.array(Image.open(os.path.join(SPR, name + '_m.png')).convert('RGB'))
    ob = []
    for i in range(cols * rows):
        x, y = (i % cols) * fw, (i // cols) * fh
        c = m[y:y + fh, x:x + fw]; r = band(c[..., 0] > 128, c[..., 1] > 128, fh)
        ob.append(r or [int(fh * .5), int(fh * .57), int(fh * .95)])
    meta['ob'] = ob
    s = json.dumps(meta, ensure_ascii=False, separators=(',', ':')); open(jp, 'w', encoding='utf-8').write(s)
    if preview:
        im = Image.open(os.path.join(SPR, name + '.png')).convert('RGBA'); bg = Image.new('RGBA', im.size, (235, 230, 220, 255)); bg.alpha_composite(im); d = ImageDraw.Draw(bg)
        for i, (t, b, kb) in enumerate(ob):
            x, y = (i % cols) * fw, (i // cols) * fh
            for yy, col in ((t, 'red'), (b, 'red'), (kb, 'blue')): d.line([(x, y + yy), (x + fw, y + yy)], fill=col)
        bg.convert('RGB').save(os.path.join(ROOT, 'shots', 'ob_' + name + '.png'))

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    names = args or sorted(os.path.basename(p)[:-6] for p in glob.glob(os.path.join(SPR, '*_m.png')) if not p.endswith('oi_m.png'))
    for n in names: run(n, '--preview' in sys.argv); print(n)
