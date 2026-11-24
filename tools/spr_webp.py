# 立繪圖集轉 WebP（遊戲讀 .webp，PNG 留給 face_pts/outfit_band 等工具）。改過任何 img/spr/<名>.png 後重跑。
# 用法：python -I tools/spr_webp.py   （_m.png 遮罩要精確值，維持 PNG）
import glob, os
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img', 'spr'); a = b = 0
for p in sorted(glob.glob(os.path.join(D, '*.png'))):
    if p.endswith('_m.png'): continue
    o = p[:-4] + '.webp'; Image.open(p).save(o, 'WEBP', quality=92, alpha_quality=100, method=6)
    a += os.path.getsize(p); b += os.path.getsize(o)
print('PNG %.1fMB -> WebP %.1fMB' % (a / 2**20, b / 2**20))
