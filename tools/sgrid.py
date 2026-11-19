# 立繪 grid 檢查圖：python -I tools/sgrid.py 輸出.jpg 圖1 圖2 ...
import sys
import numpy as np
from PIL import Image, ImageDraw
def bands(v,minlen=20):
    o=[];s=None
    for i,x in enumerate(v):
        if x and s is None: s=i
        if not x and s is not None:
            if i-s>=minlen:o.append((s,i))
            s=None
    if s is not None: o.append((s,len(v)))
    return o
def grid(fn):
    im=Image.open(fn).convert('RGB'); a=np.asarray(im).astype(int); ink=a.min(2)<235
    W=Image.new('RGB',(4*120,5*140),'white'); d=ImageDraw.Draw(W); rows=bands(ink.sum(1)>2)
    for r,(y0,y1) in enumerate(rows):
        for c,(x0,x1) in enumerate(bands(ink[y0:y1].sum(0)>1)):
            if c>3: continue
            cell=im.crop((x0-4,y0-2,x1+4,y1+2)); cell.thumbnail((112,130)); W.paste(cell,(c*120+5,r*140+10)); d.text((c*120+3,r*140),f'{r},{c}',fill='red')
    print(fn, len(rows), [len(bands(ink[y0:y1].sum(0)>1)) for y0,y1 in rows]); return W
out=sys.argv[1]; gs=[grid(f) for f in sys.argv[2:]]
W=Image.new('RGB',(len(gs)*490,700),'white'); [W.paste(g,(i*490,0)) for i,g in enumerate(gs)]; W.save(out,quality=88)
