# 3D 頭表情貼圖：Gemini 表情差分圖 → 對齊原圖 → 只取臉部（羽化橢圓）疊回原貼圖 → img/head_<name>_<ex>.jpg
import sys, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); SRC = os.path.join(ROOT, 'art_src', 'head3d')
name = sys.argv[1] if len(sys.argv) > 1 else 'bijin'
base = Image.open(os.path.join(SRC, f'{name}.png')).convert('RGB'); W, H = base.size
def bbox(im):
    a = np.asarray(im).astype(int); ink = (765 - a.sum(2)) > 40; w_ = ink.shape[1]; ink[:, :int(w_ * .25)] = False; ink[:, int(w_ * .75):] = False; ink[int(ink.shape[0] * .93):] = False
    ys, xs = np.where(ink); return np.percentile(xs, .5), np.percentile(ys, .5), np.percentile(xs, 99.5), np.percentile(ys, 99.5)
B = bbox(base)
# 新版貼圖排版：左半正面、右半側背面色帶 → 從 glb 取出右半沿用
import pygltflib, io
_g = pygltflib.GLTF2().load(os.path.join(ROOT, 'img', f'head_{name}.glb')); _b = _g.binary_blob(); _bv = _g.bufferViews[_g.images[0].bufferView]
RIGHT = Image.open(io.BytesIO(_b[_bv.byteOffset:_bv.byteOffset + _bv.byteLength])).convert('RGB').resize((2048, 1024)).crop((1024, 0, 2048, 1024))
def sq(im): w, h = im.size; return im.crop(((w - h) // 2, 0, (w + h) // 2, h))
def tex(im, cheek=(225, 177, 163)):
    t = sq(im).copy(); d = ImageDraw.Draw(t); d.rectangle([0, 0, 15, 15], fill=cheek); d.rectangle([16, 0, 31, 15], fill=(28, 24, 26)); return t.resize((1024, 1024), Image.LANCZOS)
# 臉部遮罩：原圖膚色區的外接橢圓
a = np.asarray(base).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
skin = (r > 150) & (r >= g) & (g >= b - 5) & (r - b > 18) & (r - b < 110)
skin[:, :int(W * .3)] = False; skin[:, int(W * .7):] = False
ys, xs = np.where(skin); cy0 = int(np.percentile(ys, 3)); cy1 = int(np.percentile(ys, 70)); cx0 = int(np.percentile(xs, 4)); cx1 = int(np.percentile(xs, 96))
mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).ellipse([cx0 + 6, cy0 - 10, cx1 - 6, cy1 + 30], fill=255); mask = mask.filter(ImageFilter.GaussianBlur(14))
for ex in [f[3:-4] for f in os.listdir(SRC) if f.startswith('ex_') and f.endswith('.png')]:
    im = Image.open(os.path.join(SRC, f'ex_{ex}.png')).convert('RGB').resize((W, H), Image.LANCZOS)
    E = bbox(im); s = ((B[3] - B[1]) / (E[3] - E[1]) + (B[2] - B[0]) / (E[2] - E[0])) / 2
    im2 = im.resize((round(W * s), round(H * s)), Image.LANCZOS); E2 = [v * s for v in E]
    canvas = Image.new('RGB', (W, H), 'white'); canvas.paste(im2, (round(B[0] - E2[0]), round(B[1] - E2[1])))
    out = Image.composite(canvas, base, mask)
    t = Image.new('RGB', (2048, 1024)); t.paste(tex(out), (0, 0)); t.paste(RIGHT, (1024, 0))
    t.save(os.path.join(ROOT, 'img', f'head_{name}_{ex}.jpg'), quality=86)
    print(ex, 'scale', round(s, 3))
