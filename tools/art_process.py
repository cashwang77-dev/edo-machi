# 處理 Gemini 美術：招牌切片、標題圖、材質切片
# 用法：python -I tools/art_process.py <專案資料夾>
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
root = sys.argv[1]
A = lambda *p: os.path.join(root, *p)
os.makedirs(A('img', 'tex'), exist_ok=True)

def kanban():
    im = Image.open(A('art_src', 'kanban_sheet.jfif')).convert('RGB'); a = np.asarray(im).astype(int)
    mask = (a.min(axis=2) < 225)
    mask = ndimage.binary_closing(mask, iterations=3); mask = ndimage.binary_fill_holes(mask)
    lab, n = ndimage.label(mask); boxes = ndimage.find_objects(lab)
    out = []
    for i, sl in enumerate(boxes):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        w, h = x1 - x0, y1 - y0
        if w < 120 or h < 40: continue
        out.append((y0 // 60, x0, y0, y1, x1, w, h))
    out.sort()
    res = []
    for k, (_, x0, y0, y1, x1, w, h) in enumerate(out):
        crop = im.crop((x0, y0, x1, y1))
        # 去白底：外圍白色變透明
        c = np.asarray(crop.convert('RGBA')).copy(); white = (c[..., :3].min(axis=2) > 232)
        lab2, _ = ndimage.label(white); edge = set(np.unique(np.concatenate([lab2[0], lab2[-1], lab2[:, 0], lab2[:, -1]]))) - {0}
        bg = np.isin(lab2, list(edge)); c[bg, 3] = 0
        Image.fromarray(c).save(A('img', 'tex', f'kanban{k}.png'))
        res.append({'i': k, 'w': int(w), 'h': int(h), 'ratio': round(w / h, 2)})
    print('kanban', json.dumps(res))

def title():
    im = Image.open(A('art_src', 'title_ukiyoe.jfif')).convert('RGB')
    im.save(A('img', 'title.jpg'), quality=86)
    im.resize((688, 384), Image.LANCZOS).save(A('img', 'title_s.jpg'), quality=82)
    print('title ok')

def textures():
    p = A('art_src', 'textures.jfif')
    if not os.path.exists(p): print('no textures'); return
    im = Image.open(p).convert('RGB'); a = np.asarray(im).astype(int)
    W, H = im.size
    # 找白色分隔線：整列／整欄接近白的位置
    rowwhite = (a.min(axis=2) > 235).mean(axis=1); colwhite = (a.min(axis=2) > 235).mean(axis=0)
    def split(v, n):
        mid = n // 2; rng = range(int(n * .35), int(n * .65)); c = [i for i in rng if v[i] > .6]
        return (min(c), max(c)) if c else (mid, mid)
    ry = split(rowwhite, H); cx = split(colwhite, W)
    pad = 18
    cells = {'roof': (0, 0, cx[0], ry[0]), 'plaster': (cx[1], 0, W, ry[0]), 'wood': (0, ry[1], cx[0], H), 'dirt': (cx[1], ry[1], W, H)}
    for k, (x0, y0, x1, y1) in cells.items():
        c = im.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad)); s = min(c.size); c = c.crop((0, 0, s, s)).resize((512, 512), Image.LANCZOS)
        # 無縫拼接：原圖與「位移半張」的圖依中心權重混合，邊緣完全取自位移圖→上下左右都接得起來
        arr = np.asarray(c).astype(float); n = 512
        low = ndimage.gaussian_filter(arr, sigma=(70, 70, 0), mode='wrap'); arr = arr / np.maximum(low, 1) * arr.mean(axis=(0, 1))  # 拉平大範圍明暗
        rolled = np.roll(np.roll(arr, n // 2, axis=0), n // 2, axis=1)
        x = np.sin(np.pi * (np.arange(n) + .5) / n) ** 1.5; m = np.outer(x, x)[..., None]
        out = arr * m + rolled * (1 - m)
        Image.fromarray(out.clip(0, 255).astype('uint8')).save(A('img', 'tex', k + '.jpg'), quality=86)
    print('textures', ry, cx)

def oiran():
    for k in ('out', 'in'):
        im = Image.open(A('art_src', f'oiran_{k}.jfif')).convert('RGB'); w, h = im.size; p = 30
        c = im.crop((p, p, w - p, h - p)).resize((512, 512), Image.LANCZOS)
        arr = np.asarray(c).astype(float); n = 512
        rolled = np.roll(np.roll(arr, n // 2, axis=0), n // 2, axis=1)
        x = np.sin(np.pi * (np.arange(n) + .5) / n) ** 1.2; m = np.outer(x, x)[..., None]
        Image.fromarray((arr * m + rolled * (1 - m)).clip(0, 255).astype('uint8')).save(A('img', 'tex', f'oiran_{k}.jpg'), quality=88)
    print('oiran ok')

for f in sys.argv[2:] or ['kanban', 'title', 'textures']: globals()[f]()
