# 立繪膚色遮罩：在 img/spr/<原型>_m.png 的藍色通道標出皮膚（臉、脖子、手、腳），遊戲裡依 look.s 換膚色。
# 用法：python -I tools/skin_mask.py [原型…]   （不給＝全部）；--preview 另存 shots/skin_<原型>.png
# 只改 _m.png 的 B 通道，不重跑 sprite_cut（f9 歡呼、m3 長椅線的手動修正不受影響）。
import sys, os, glob
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPR = os.path.join(ROOT, 'img', 'spr')

def hsv(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1); d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return h, s, mx

def dilate(m, n=1):
    for _ in range(n):
        p = np.pad(m, 1)
        m = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return m

def run(name, preview=False):
    a = np.array(Image.open(os.path.join(SPR, name + '.png')).convert('RGBA')).astype(float) / 255
    mp = os.path.join(SPR, name + '_m.png'); m = np.array(Image.open(mp).convert('RGB'))
    rgb, al = a[..., :3], a[..., 3]
    h, s, v = hsv(rgb)
    free = (al > .5) & (m[..., 0] < 128) & (m[..., 1] < 128)
    core = free & (h > 8) & (h < 40) & (s > .1) & (s < .5) & (v > .6)
    # 邊緣陰影：色相相同但較暗，且緊鄰核心皮膚
    soft = free & (h > 4) & (h < 42) & (s > .08) & (s < .62) & (v > .38) & dilate(core, 2)
    sk = core | soft
    m[..., 2] = np.where(sk, 255, 0).astype(np.uint8)
    Image.fromarray(m).save(mp)
    if preview:
        out = (rgb * 255 * .35).astype(np.uint8); out[al < .5] = 0; out[sk] = [255, 0, 255]
        Image.fromarray(out).save(os.path.join(ROOT, 'shots', 'skin_' + name + '.png'))
    return int(sk.sum())

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    # oi（GM 花魁）金色和服會被誤判成皮膚，且花魁外觀固定不換膚色 → 不做
    names = args or sorted(os.path.basename(p)[:-6] for p in glob.glob(os.path.join(SPR, '*_m.png')) if not p.endswith('oi_m.png'))
    for n in names:
        print(n, run(n, '--preview' in sys.argv))
