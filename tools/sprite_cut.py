# 立繪切圖：Gemini 走路圖 → 去背、腳底對齊、和服/腰帶遮罩 → img/spr/<name>.png（顏色）、<name>_m.png（遮罩 R=和服 G=腰帶）、<name>.json
# 用法：python -I tools/sprite_cut.py <原型名> <圖> <plan.json>
#   plan.json：{"S":[[r,c],...], "SE":[...], "E":[...], "NE":[...], "N":[...]}（每方向的走路格，依序）
import sys, json, os, colorsys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.expanduser('~/Downloads/夜校如月/tools'))
from sprite_lib import remove_bg
sys.path.insert(0, os.path.expanduser('~/.claude/skills/gemini-image'))

name, planf = sys.argv[1], sys.argv[2]
plan = json.load(open(planf, encoding='utf-8'))   # {"img":{"A":路徑,...}, "anims":{"walk":{"S":[["A",r,c],...]}, "idle":{...}, "sit":{...}, "act":{"wave":[...]}}}
IMGS = {k: Image.open(v).convert('RGB') for k, v in plan['img'].items()}

# 找格子：列＝水平空白帶，欄＝每列內的垂直空白帶
def bands(v, gap=6, minlen=20):
    out, s = [], None
    for i, x in enumerate(v):
        if x and s is None: s = i
        if not x and s is not None:
            if i - s >= minlen: out.append((s, i))
            s = None
    if s is not None and len(v) - s >= minlen: out.append((s, len(v)))
    return out
BOX = {}
for k, im in IMGS.items():
    a = np.asarray(im).astype(int); ink = (a.min(axis=2) < 235); boxes = []
    for (y0, y1) in bands(ink.sum(1) > 2):
        cols = bands(ink[y0:y1].sum(0) > 1); boxes.append([(x0, y0, x1, y1) for (x0, x1) in cols])
    BOX[k] = boxes; print(k, '列', len(boxes), [len(r) for r in boxes])

FW, FH = 128, 224  # 每格輸出大小（腳底對齊在 FH-6）
cells = []; HW = {}   # (動作, 方向, rgba, 圖)
for an, dirs in plan['anims'].items():
    for d, lst in dirs.items():
        for (k, r, c) in lst:
            x0, y0, x1, y1 = BOX[k][r][c]
            rgba = remove_bg(IMGS[k].crop((x0 - 4, y0 - 4, x1 + 4, y1 + 4)), minfrac=.02, hole=80)
            # 去背後白邊收 1 像素
            A = np.asarray(rgba).copy(); al = A[..., 3]; from scipy.ndimage import binary_erosion
            al = np.where(binary_erosion(al > 128, iterations=1), al, 0).astype(np.uint8); A[..., 3] = al; rgba = Image.fromarray(A, 'RGBA')
            # Gemini 偶爾在腳下畫一條地平線：刪掉「橫跨 70% 以上寬度」的細橫列（只看下方 15%）
            al = A[..., 3]; hh = al.shape[0]
            for y in range(int(hh * .85), hh):
                if (al[y] > 128).mean() > .93: A[max(0, y - 1):y + 2, :, 3] = 0
            # 刪掉和人物分開的小碎塊（長椅線、雜點）
            from scipy.ndimage import label
            lb, nlb = label(A[..., 3] > 100)
            if nlb > 1:
                sizes = np.bincount(lb.ravel()); sizes[0] = 0; big = sizes.max()
                for li in range(1, nlb + 1):
                    if sizes[li] < big * .04: A[lb == li, 3] = 0
            rgba = Image.fromarray(A, 'RGBA')
            rgba = rgba.crop(rgba.getbbox()); cells.append((an, d, rgba, k))
            if an == 'walk': HW.setdefault(k, []).append(rgba.height)
ref = float(np.median(HW[list(plan['img'])[0]]))
SC = {k: ref / float(np.median(v)) for k, v in HW.items()}   # 各張圖的人物大小統一到第一張
scale = (FH - 22) / (ref * 1.0)
print('各圖比例', {k: round(v, 3) for k, v in SC.items()})
frames, out, outm = {}, [], []
if True:
    for (an, d, rgba, k) in cells:
        rgba = rgba.resize((max(1, round(rgba.width * SC.get(k, 1))), max(1, round(rgba.height * SC.get(k, 1)))), Image.LANCZOS)
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
        kimono = kimono & (yy > (top + rs.height * .34) / FH)   # 頭部（剃過的頭頂、灰色眼睛）不算和服
        M = np.zeros((FH, FW, 3), np.uint8); M[..., 0] = kimono * 255; M[..., 1] = obi * 255
        frames.setdefault(an, {}).setdefault(d, []).append({'i': len(out), 'top': int(top)})
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
print('frames', {a: {d: len(v) for d, v in x.items()} for a, x in frames.items()}, 'scale', round(scale, 3))
