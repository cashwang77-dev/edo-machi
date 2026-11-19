# 參考圖：python -I tools/sref.py 名 r,c r,c r,c r,c  → art_src/sprites/ref_名.png
import sys
import numpy as np
from PIL import Image
def bands(v,minlen=20):
    o=[];s=None
    for i,x in enumerate(v):
        if x and s is None: s=i
        if not x and s is not None:
            if i-s>=minlen:o.append((s,i))
            s=None
    if s is not None: o.append((s,len(v)))
    return o
n=sys.argv[1]; cells=[tuple(map(int,x.split(','))) for x in sys.argv[2:]] or [(0,0),(1,0),(2,0),(3,0)]
im=Image.open(f'art_src/sprites/{n}_A.png').convert('RGB'); a=np.asarray(im).astype(int); ink=a.min(2)<235
rows=bands(ink.sum(1)>2); W=Image.new('RGB',(4*130,220),'white')
for i,(r,c) in enumerate(cells):
    y0,y1=rows[r]; x0,x1=bands(ink[y0:y1].sum(0)>1)[c]; W.paste(im.crop((x0-8,y0-2,x1+8,y1+2)),(i*130+10,5))
W.resize((1040,440),Image.LANCZOS).save(f'art_src/sprites/ref_{n}.png'); print('ref', n)
