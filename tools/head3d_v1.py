# Hunyuan3D 頭部模型 → 減面、正面投影貼圖（Gemini 原圖）、背面改髮色/膚色 → img/head_<name>.glb
import sys, os, numpy as np, trimesh
from PIL import Image
import fast_simplification as fs
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
name = sys.argv[1] if len(sys.argv) > 1 else 'bijin'
SRC = os.path.join(ROOT, 'art_src', 'head3d')
m = trimesh.load(os.path.join(SRC, 'head_raw.glb' if name == 'bijin' else f'{name}_raw.glb'), force='mesh')
v, f = fs.simplify(m.vertices.astype(np.float32), m.faces.astype(np.int32), target_reduction=1 - 9000 / len(m.faces))
mesh = trimesh.Trimesh(v, f, process=True)
# 正面方向：Hunyuan 輸出 +z 為正面（若鼻子在 -z 就翻轉）
cx = np.abs(mesh.vertices[:, 0]) < .04; mid = (mesh.vertices[:, 1] > -.2) & (mesh.vertices[:, 1] < .1)
sel = mesh.vertices[cx & mid]
if sel.size and -sel[:, 2].min() > sel[:, 2].max(): mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0]))
img = Image.open(os.path.join(SRC, f'{name}_sq.png')).convert('RGB'); W, H = img.size; a = np.asarray(img).astype(int)
ink = (255 * 3 - a.sum(axis=2)) > 30; ys, xs = np.where(ink)
X0, X1, Y0, Y1 = xs.min(), xs.max(), ys.min(), ys.max()
V = mesh.vertices; b0, b1 = V.min(0), V.max(0)
py = Y0 + (b1[1] - V[:, 1]) / (b1[1] - b0[1]) * (Y1 - Y0)
# 左右對齊：用臉中段的列，比較圖片輪廓左右邊與模型左右邊
rows = range(int(Y0 + (Y1 - Y0) * .45), int(Y0 + (Y1 - Y0) * .62))
L = np.mean([np.where(ink[y])[0].min() for y in rows]); Rr = np.mean([np.where(ink[y])[0].max() for y in rows])
band = (py > rows.start) & (py < rows.stop); ml, mr = V[band, 0].min(), V[band, 0].max()
px = L + (V[:, 0] - ml) / (mr - ml) * (Rr - L)
N = mesh.vertex_normals
def find_dark(x, y0):
    for dy in range(0, 300, 3):
        if a[y0 + dy, x].sum() < 120: return (x, y0 + dy)
    return (x, y0)
hair_px = find_dark(W // 2, int(Y0 + 8)); skin_px = (W // 2, int(Y0 + (Y1 - Y0) * .93))
neckY = Y0 + (Y1 - Y0) * .8
# 逐面判斷（避免同一面跨「圖片/填色」造成白色接縫）
F = mesh.faces; FN = mesh.face_normals
pu = np.stack([px / W, 1 - py / H], 1)
def light(i):
    xi, yi = int(np.clip(px[i], 0, W - 1)), int(np.clip(py[i], 0, H - 1)); c = a[yi, xi]; return c.min() > 240 and c.max() - c.min() < 12
lt = np.array([light(i) for i in range(len(V))])
hairUV = (24 / W, 1 - 8 / H); skinUV = (skin_px[0] / W, 1 - skin_px[1] / H)
# 圖片每一列的臉部膚色範圍（從中線往左右找連續膚色）
def is_skin(c): r, g_, b_ = c; return r > 140 and r >= g_ >= b_ - 5 and r - b_ > 18
cxi = W // 2; skinL = {}; skinR = {}
for y in range(int(Y0), int(Y1)):
    if not is_skin(a[y, cxi]): continue
    l = cxi; r = cxi
    while l > 0 and is_skin(a[y, l - 1]): l -= 1
    while r < W - 1 and is_skin(a[y, r + 1]): r += 1
    skinL[y] = l; skinR[y] = r
rowsK = sorted(skinL); hairline = rowsK[0] if rowsK else Y0
zc = (b0[2] + b1[2]) / 2 + (b1[2] - b0[2]) * .02
eyeY = hairline + (neckY - hairline) * .3
# 平滑：每列左右邊界取前後 15 列中位數，取樣點往臉內縮，避免條紋與嘴唇紅色
sm = {y: (int(np.median([skinL[k] for k in skinL if abs(k - y) < 15])), int(np.median([skinR[k] for k in skinR if abs(k - y) < 15]))) for y in skinL}
cy0 = int(eyeY + (neckY - eyeY) * .45); l0, r0 = sm[min(sm, key=lambda k: abs(k - cy0))]
# 在貼圖左上角畫兩塊純色：臉頰膚色（取臉頰中段的中位數）、頭髮色
samp = np.array([a[y, x] for y in range(int(eyeY), int(neckY), 3) if y in sm for x in range(sm[y][0] + 15, sm[y][0] + (sm[y][1] - sm[y][0]) // 4)])
samp = samp[[is_skin(c) and c[0] - c[1] < 60 for c in samp]]
cheekC = tuple(int(v) for v in np.median(samp, 0)); hairC = tuple(int(v) for v in a[hair_px[1], hair_px[0]])
img = img.copy(); from PIL import ImageDraw; dr = ImageDraw.Draw(img); dr.rectangle([0, 0, 15, 15], fill=cheekC); dr.rectangle([16, 0, 31, 15], fill=(28, 24, 26))
def edge_uv(i): return (8 / W, 1 - 8 / H)
print('cheek color', cheekC)
newV, newUV, newF, newN = [], [], [], []
for fi, tri in enumerate(F):
    front = FN[fi, 2] > -.05 and not lt[tri].any()
    cy = py[tri].mean(); cz = V[tri, 2].mean()
    cxp, cyp = int(np.clip(px[tri].mean(), 0, W - 1)), int(np.clip(cy, 0, H - 1)); dark = a[cyp, cxp].sum() < 260
    cxm = abs(V[tri, 0].mean() - (b0[0] + b1[0]) / 2) / (b1[0] - b0[0])  # 0＝中線，.5＝最外側
    lim = .2 + .07 * min(1, max(0, (cy - eyeY) / max(1, neckY - eyeY)))  # 越往下巴越寬
    cheek = eyeY < cy < neckY + 15 and cz > zc and (dark or not front) and cxm < lim
    if not cheek and eyeY + (neckY - eyeY) * .62 < cy < neckY + 40 and cz > zc - (b1[2] - b0[2]) * .28 and (dark or not front): cheek = True  # 下顎、頸側
    for k in range(3):
        newN.append(N[tri[k]]); newV.append(V[tri[k]]); newUV.append(edge_uv(tri[k]) if cheek else pu[tri[k]] if front else (skinUV if cy > neckY else hairUV))
    newF.append([fi * 3, fi * 3 + 1, fi * 3 + 2])
V = np.array(newV); uv = np.array(newUV)
mesh = trimesh.Trimesh(V, np.array(newF), vertex_normals=np.array(newN), process=False)
# 把模型移到原點：頭的中心在 (0,0,0)，高度縮成 1
c = (b0 + b1) / 2; mesh.vertices = (V - c) / (b1[1] - b0[1])
mesh.vertex_normals = np.array(newN)
mesh.merge_vertices(merge_tex=False, merge_norm=True) if False else None
tex = img.resize((1024, 1024), Image.LANCZOS).convert('RGB')
mat = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, roughnessFactor=.55, metallicFactor=0)
mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=mat)
out = os.path.join(ROOT, 'img', f'head_{name}.glb'); mesh.export(out)
print(name, len(mesh.faces), 'faces', os.path.getsize(out) // 1024, 'KB', 'bbox', b0.round(2), b1.round(2))
# 貼圖改存 JPEG（檔案小一半以上）
import pygltflib, io
g = pygltflib.GLTF2().load(out); blob = g.binary_blob()
for im in g.images:
    bv = g.bufferViews[im.bufferView]; data = blob[bv.byteOffset:bv.byteOffset + bv.byteLength]
    b = io.BytesIO(); Image.open(io.BytesIO(data)).convert('RGB').save(b, 'JPEG', quality=86); jb = b.getvalue()
    off = len(blob); blob = blob + jb + b'\0' * ((4 - len(jb) % 4) % 4); bv.byteOffset = off; bv.byteLength = len(jb); im.mimeType = 'image/jpeg'
g.buffers[0].byteLength = len(blob); g.set_binary_blob(blob); g.save(out)
print('jpeg', os.path.getsize(out) // 1024, 'KB')
# 重建 buffer，丟掉沒被引用的舊 PNG
g = pygltflib.GLTF2().load(out); blob = g.binary_blob(); nb = b''
for bv in g.bufferViews:
    d = blob[bv.byteOffset:bv.byteOffset + bv.byteLength]; nb += b'\0' * ((4 - len(nb) % 4) % 4); bv.byteOffset = len(nb); nb += d
nb += b'\0' * ((4 - len(nb) % 4) % 4); g.buffers[0].byteLength = len(nb); g.set_binary_blob(nb); g.save(out)
print('final', os.path.getsize(out) // 1024, 'KB')
