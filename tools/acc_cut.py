# 飾品圖鑑切圖：art_src/sprites/acc1.png、acc2.png（3 列×6 欄）→ img/spr/acc.png（每格 128）＋ acc.json
import sys, os, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.expanduser('~/Downloads/夜校如月/tools')); from sprite_lib import remove_bg
IDS = [['kasa','amigasa','jingasa','tenugui','zukin','hachimaki','hanakan','kushi','chokan','tamakan','tsumami','kitsune','hyottoko','okame','tengu','hannya','oni','nekomen'],
       ['shishi','kingyo','yoyo','inro','kinchaku','daisho','tabako','sensu','bangasa','janome','uchiwa','kazaguruma','chochin','furoshiki','kago','shamisen','stole','ofuda']]
def bands(v, minlen=12):
    o=[]; s=None
    for i,x in enumerate(v):
        if x and s is None: s=i
        if not x and s is not None:
            if i-s>=minlen: o.append((s,i))
            s=None
    if s is not None: o.append((s,len(v)))
    return o
C = 128; out = []; meta = {}
for si, ids in enumerate(IDS):
    im = Image.open(f'art_src/sprites/acc{si+1}.png').convert('RGB'); a = np.asarray(im).astype(int); ink = a.min(2) < 235
    rows = bands(ink.sum(1) > 1); cells = []
    for (y0, y1) in rows:
        for (x0, x1) in bands(ink[y0:y1].sum(0) > 0, 8): cells.append((x0, y0, x1, y1))
    print('sheet', si+1, len(rows), 'rows', len(cells), 'cells')
    for k, (x0, y0, x1, y1) in enumerate(cells[:len(ids)]):
        rgba = remove_bg(im.crop((x0-3, y0-3, x1+3, y1+3)), minfrac=.02, hole=60); rgba = rgba.crop(rgba.getbbox())
        rgba.thumbnail((C-6, C-6), Image.LANCZOS); f = Image.new('RGBA', (C, C)); f.alpha_composite(rgba, ((C-rgba.width)//2, (C-rgba.height)//2))
        meta[ids[k]] = len(out); out.append(f)
cols = 8; rws = (len(out)+cols-1)//cols; A = Image.new('RGBA', (cols*C, rws*C))
for i, f in enumerate(out): A.paste(f, ((i%cols)*C, (i//cols)*C))
A.save('img/spr/acc.png', optimize=True); json.dump({'c': C, 'cols': cols, 'rows': rws, 'i': meta}, open('img/spr/acc.json','w'))
chk = Image.new('RGB', A.size, (200,210,190)); chk.paste(A, (0,0), A); chk.save('art_src/sprites/acc_check.jpg', quality=85); print(len(out), 'items')
