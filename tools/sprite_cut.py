# 立繪切圖：Gemini 走路圖 → 去背、腳底對齊、和服/腰帶遮罩 → img/spr/<name>.png（顏色）、<name>_m.png（遮罩 R=和服 G=腰帶）、<name>.json
# 用法：python -I tools/sprite_cut.py <原型名> <圖> <plan.json>
#   plan.json：{"S":[[r,c],...], "SE":[...], "E":[...], "NE":[...], "N":[...]}（每方向的走路格，依序）
import sys, json, os, colorsys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.expanduser('~/Downloads/夜校如月/tools'))
from sprite_lib import remove_bg
sys.path.insert(0, os.path.expanduser('~/.claude/skills/gemini-image'))

name, src, planf = sys.argv[1], sys.argv[2], sys.argv[3]
plan = json.load(open(planf, encoding='utf-8'))
im = Image.open(src).convert('RGB')

# 找格子：沿用 find_figures 的切法（列＝水平空白帶，欄＝每列內的垂直空白帶）
a = np.asarray(im).astype(int); ink = (a.min(axis=2) < 235)
def bands(v, gap=6, minlen=20):
    out, s = [], None
    for i, x in enumerate(v):
        if x and s is None: s = i
        if not x and s is not None:
            if i - s >= minlen: out.append((s, i))
            s = None
    if s is not None and len(v) - s >= minlen: out.append((s, len(v)))
    return out
rows = bands(ink.sum(1) > 2)
boxes = []
for (y0, y1) in rows:
    cols = bands(ink[y0:y1].sum(0) > 1)
    boxes.append([(x0, y0, x1, y1) for (x0, x1) in cols])
print('列', len(boxes), [len(r) for r in boxes])

FW, FH = 128, 224  # 每格輸出大小（腳底對齊在 FH-6）
cells = {}
H = []
for d, lst in plan.items():
    for (r, c) in lst:
        x0, y0, x1, y1 = boxes[r][c]
        cell = im.crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4))
        rgba = remove_bg(cell, minfrac=.02, hole=80)
        bb = rgba.getbbox(); rgba = rgba.crop(bb); H.append(rgba.height)
        cells.setdefault(d, []).append(rgba)
scale = (FH - 14) / max(H)  # 全部同一比例，最高的人物剛好放滿
frames, out, outm = {}, [], []
for d, lst in cells.items():
    for rgba in lst:
        w, h = rgba.size; rs = rgba.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        A = np.asarray(rs).astype(float); al = A[..., 3] / 255
        # 身體中心：用下半身（腳）的 alpha 重心對齊，避免頭髮、袖子讓人左右晃
        lower = al[int(al.shape[0] * .55):]; xs = np.arange(al.shape[1]); cx = (lower.sum(0) * xs).sum() / max(lower.sum(), 1)
        fr = Image.new('RGBA', (FW, FH)); ox = int(round(FW / 2 - cx)); oy = FH - 6 - rs.height; fr.alpha_composite(rs, (max(0, ox), max(0, oy)))
        # 遮罩
        F = np.asarray(fr).astype(float) / 255; r_, g_, b_, al2 = F[..., 0], F[..., 1], F[..., 2], F[..., 3]
        mx, mn = F[..., :3].max(2), F[..., :3].min(2); sat = (mx - mn) / np.maximum(mx, 1e-3)
        hue = np.zeros_like(mx)
        yy = np.arange(FH)[:, None] / FH
        kimono = (al2 > .5) & (sat < .13) & (mx > .42) & (mx < .93)
        red = (al2 > .5) & (sat > .35) & (r_ > g_ * 1.5) & (r_ > b_ * 1.4) & (mx > .3)
        top = FH - 6 - rs.height; head_line = (top + rs.height * .38) / FH   # 頭（髮飾）以上的紅色不算腰帶
        obi = red & (yy > head_line)
        M = np.zeros((FH, FW, 3), np.uint8); M[..., 0] = kimono * 255; M[..., 1] = obi * 255
        frames.setdefault(d, []).append({'i': len(out), 'top': int(top)})
        out.append(fr); outm.append(Image.fromarray(M))
n = len(out); cols = 8; rws = (n + cols - 1) // cols
atlas = Image.new('RGBA', (cols * FW, rws * FH)); atlasm = Image.new('RGB', (cols * FW, rws * FH))
for i, (f, m) in enumerate(zip(out, outm)): atlas.paste(f, ((i % cols) * FW, (i // cols) * FH)); atlasm.paste(m, ((i % cols) * FW, (i // cols) * FH))
os.makedirs('img/spr', exist_ok=True)
atlas.save(f'img/spr/{name}.png', optimize=True); atlasm.save(f'img/spr/{name}_m.png', optimize=True)
json.dump({'fw': FW, 'fh': FH, 'cols': cols, 'rows': rws, 'frames': frames}, open(f'img/spr/{name}.json', 'w'), ensure_ascii=False)
# 檢查圖：原圖＋遮罩疊色
chk = Image.new('RGB', (cols * FW, rws * FH * 2), 'white'); chk.paste(atlas, (0, 0), atlas)
mv = np.asarray(atlasm).astype(float); base = np.asarray(atlas.convert('RGB')).astype(float)
ov = base.copy(); ov[mv[..., 0] > 0] = ov[mv[..., 0] > 0] * .4 + np.array([60, 140, 255]) * .6; ov[mv[..., 1] > 0] = ov[mv[..., 1] > 0] * .4 + np.array([255, 220, 0]) * .6
ov[np.asarray(atlas)[..., 3] < 10] = 255
chk.paste(Image.fromarray(ov.astype(np.uint8)), (0, rws * FH)); chk.save(f'art_src/sprites/{name}_check.jpg', quality=88)
print('frames', {k: len(v) for k, v in frames.items()}, 'scale', round(scale, 3))
