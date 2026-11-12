# 產生封面 og.png / img/cover.jpg 與文章用截圖 img/*.jpg
# 用法：python -I tools/make_promo.py <專案資料夾>
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
root = sys.argv[1]
S = lambda f: os.path.join(root, 'shots', f)
os.makedirs(os.path.join(root, 'img'), exist_ok=True)
KAI = 'C:/Windows/Fonts/kaiu.ttf'; JH = 'C:/Windows/Fonts/msjhbd.ttc'

def cover():
    im = Image.open(os.path.join(root, 'art_src', 'title_ukiyoe.jfif')).convert('RGB')
    w, h = im.size; th = int(w * 630 / 1200)
    y0 = max(0, (h - th) // 2); im = im.crop((0, y0, w, y0 + th)).resize((1200, 630), Image.LANCZOS)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for y in range(630):  # 上方漸層讓字清楚
        a = int(120 * max(0, 1 - y / 300)); d.line([(0, y), (1200, y)], fill=(20, 10, 30, a))
    im = Image.alpha_composite(im.convert('RGBA'), ov)
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(KAI, 150); f2 = ImageFont.truetype(JH, 38); f3 = ImageFont.truetype(JH, 30)
    t = '江戶町'; bw = d.textlength(t, font=f1)
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    sd.text(((1200 - bw) / 2 + 4, 34 + 5), t, font=f1, fill=(0, 0, 0, 200)); sh = sh.filter(ImageFilter.GaussianBlur(6))
    im = Image.alpha_composite(im, sh); d = ImageDraw.Draw(im)
    d.text(((1200 - bw) / 2, 34), t, font=f1, fill=(255, 246, 225))
    s2 = '3D 多人江戶小鎮・開店當老闆・逛街泡湯看夕陽'; d.text(((1200 - d.textlength(s2, font=f2)) / 2, 205), s2, font=f2, fill=(255, 236, 200))
    tag = ' 免費線上遊戲｜手機・電腦都能玩｜最多 80 人同時上線 '
    tw = d.textlength(tag, font=f3); x0 = (1200 - tw) / 2
    d.rounded_rectangle([x0 - 14, 556, x0 + tw + 14, 604], 22, fill=(184, 48, 42, 235)); d.text((x0, 561), tag, font=f3, fill=(255, 248, 232))
    im = im.convert('RGB'); im.save(os.path.join(root, 'og.png')); im.save(os.path.join(root, 'img', 'cover.jpg'), quality=88)

def shot(src, dst, w=1200):
    im = Image.open(S(src)).convert('RGB')
    if im.width > w: im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(root, 'img', dst), quality=85)

cover()
for a, b in [('c1.png', 'sunset.jpg'), ('c2.png', 'night.jpg'), ('c3.png', 'shrine.jpg'), ('c4.png', 'river.jpg'), ('c5.png', 'soba.jpg'),
             ('g_menu.jpg', 'menu.jpg'), ('g_crowd.jpg', 'crowd.jpg'), ('g_cook.jpg', 'cook.jpg'), ('g_night.jpg', 'night2.jpg')]:
    shot(a, b)
print('ok')
