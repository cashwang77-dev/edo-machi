# 立繪五官定位：每一格找出眼睛（被皮膚左右包住的深色塊），寫進 img/spr/<原型>.json 的 "fc"（依格號）
# fc[i] = [眼睛下緣 y, 左眼 x, 右眼 x, 眼寬]（像素），找不到眼睛（背面等）= 0。遊戲用它畫腮紅、淚痣。
# 需要 _m.png 的 B 通道（皮膚，tools/skin_mask.py）。用法：python -I tools/face_pts.py [原型…] [--preview]
import sys, os, json, glob
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPR = os.path.join(ROOT, 'img', 'spr')

def eyes(rgb, al, sk, fh):
    top = int(fh * .5); sk = sk[:top]; al = al[:top]; rgb = rgb[:top]
    lab, n = ndimage.label(sk)
    if not n: return 0
    sizes = ndimage.sum(sk, lab, range(1, n + 1)); f = lab == (np.argmax(sizes) + 1)  # 臉（最大的皮膚塊）
    if sizes.max() < 300: return 0
    lum = rgb @ np.array([.299, .587, .114])
    L = np.maximum.accumulate(f, 1); Rr = np.maximum.accumulate(f[:, ::-1], 1)[:, ::-1]  # 左右兩側都有臉的皮膚
    U = np.maximum.accumulate(f, 0)  # 上方有皮膚（排除瀏海）
    cand = (~sk) & (al > .5) & (lum < .45) & L & Rr & U
    lab2, n2 = ndimage.label(cand)
    if not n2: return 0
    comps = []
    for i in range(1, n2 + 1):
        ys, xs = np.nonzero(lab2 == i)
        if 6 <= len(ys) <= 260 and xs.max() - xs.min() <= 22 and ys.max() - ys.min() <= 20: comps.append((len(ys), xs.mean(), ys.max(), xs.max() - xs.min() + 1))
    if not comps: return 0
    comps.sort(reverse=True); e = comps[:2]
    if len(e) == 2 and (abs(e[0][2] - e[1][2]) > 8 or abs(e[0][1] - e[1][1]) < 10): e = e[:1]  # 兩塊不在同一高度＝只有一隻眼
    e.sort(key=lambda c: c[1])
    yb = int(round(max(c[2] for c in e))); w = int(round(max(c[3] for c in e)))
    return [yb, int(round(e[0][1])), int(round(e[-1][1])), w]

def run(name, preview=False):
    jp = os.path.join(SPR, name + '.json'); meta = json.load(open(jp, encoding='utf-8'))
    fw, fh, cols, rows = meta['fw'], meta['fh'], meta['cols'], meta['rows']
    a = np.array(Image.open(os.path.join(SPR, name + '.png')).convert('RGBA')).astype(float) / 255
    m = np.array(Image.open(os.path.join(SPR, name + '_m.png')).convert('RGB'))
    fc = []
    for i in range(cols * rows):
        x, y = (i % cols) * fw, (i // cols) * fh
        c = a[y:y + fh, x:x + fw]; fc.append(eyes(c[..., :3], c[..., 3], m[y:y + fh, x:x + fw, 2] > 128, fh))
    meta['fc'] = fc
    open(jp, 'w', encoding='utf-8').write(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    if preview:
        im = Image.open(os.path.join(SPR, name + '.png')).convert('RGBA'); bg = Image.new('RGBA', im.size, (235, 230, 220, 255)); bg.alpha_composite(im); d = ImageDraw.Draw(bg)
        for i, e in enumerate(fc):
            if not e: continue
            x, y = (i % cols) * fw, (i // cols) * fh; yb, xl, xr, w = e
            for ex in {xl, xr}: d.ellipse([x + ex - 6, y + yb + 3, x + ex + 6, y + yb + 9], outline='magenta')
        bg.convert('RGB').save(os.path.join(ROOT, 'shots', 'fc_' + name + '.png'))
    return sum(1 for e in fc if e)

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    names = args or sorted(os.path.basename(p)[:-6] for p in glob.glob(os.path.join(SPR, '*_m.png')) if not p.endswith('oi_m.png'))
    for n in names: print(n, run(n, '--preview' in sys.argv))
