# Hunyuan3D 頭部模型 → 減面、正面投影 Gemini 原圖當貼圖 → img/head_<name>.glb
# 對位：把模型正面輪廓與原圖輪廓做 IoU 搜尋（縮放＋位移），側面/背面取「同一高度原圖輪廓邊緣」的真實顏色
# （舊版見 head3d_v1.py）
import sys, os, io, numpy as np, trimesh, pygltflib
from PIL import Image
from scipy import ndimage
import fast_simplification as fs
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
name = sys.argv[1] if len(sys.argv) > 1 else 'bijin'
SRC = os.path.join(ROOT, 'art_src', 'head3d')
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 9000

raw = trimesh.load(os.path.join(SRC, 'head_raw.glb' if name == 'bijin' else f'{name}_raw.glb'), force='mesh')
raw.merge_vertices(); raw.update_faces(raw.unique_faces()); raw.update_faces(raw.nondegenerate_faces()); raw.remove_unreferenced_vertices()
v, f = fs.simplify(raw.vertices.astype(np.float32), raw.faces.astype(np.int32), target_reduction=max(0, 1 - TARGET / len(raw.faces)))
mesh = trimesh.Trimesh(v, f, process=True)
parts = mesh.split(only_watertight=False)
if len(parts) > 1: mesh = max(parts, key=lambda m: len(m.faces))
TRIM = float(sys.argv[3]) if len(sys.argv) > 3 else 0
if TRIM > 0:  # 去掉脖子以下（肩膀）
    yb = mesh.vertices[:, 1]; cut = yb.min() + (yb.max() - yb.min()) * TRIM
    keep = mesh.vertices[mesh.faces][:, :, 1].min(1) > cut; mesh.update_faces(keep); mesh.remove_unreferenced_vertices()
V = mesh.vertices.copy(); F = mesh.faces; N = mesh.vertex_normals.copy(); FN = mesh.face_normals.copy()
P = raw.vertices if len(raw.vertices) < 400000 else raw.vertices[::3]
P = np.asarray(P).copy()
# 正面方向：臉中線最突出的一側為 +z
cx = np.abs(V[:, 0] - V[:, 0].mean()) < .05; mid = (V[:, 1] > -.3) & (V[:, 1] < .1)
sel = V[cx & mid]
if sel.size and -sel[:, 2].min() > sel[:, 2].max():
    for A in (V, N, FN, P): A[:, 0] *= -1; A[:, 2] *= -1

img = Image.open(os.path.join(SRC, f'{name}_sq.png')).convert('RGB'); W, H = img.size; a = np.asarray(img).astype(int)
bg = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), 0)
ink = np.abs(a - bg).sum(2) > 34
ink = ndimage.binary_fill_holes(ndimage.binary_opening(ink, iterations=2))
lab, nl = ndimage.label(ink); ink = lab == (np.argmax(np.bincount(lab.ravel())[1:]) + 1)

# ---- 輪廓 IoU 對位 ----
D = 4; inkS = ink[::D, ::D]; hS, wS = inkS.shape
def mask_of(s, tx, ty):
    qx = (P[:, 0] * s + tx) / D; qy = (-P[:, 1] * s + ty) / D
    ok = (qx >= 0) & (qx < wS) & (qy >= 0) & (qy < hS); m = np.zeros((hS, wS), bool); m[qy[ok].astype(int), qx[ok].astype(int)] = True
    return ndimage.binary_dilation(m, iterations=1)
def iou(m): return (m & inkS).sum() / max(1, (m | inkS).sum())
ys, xs = np.where(ink); b0, b1 = V.min(0), V.max(0)
s0 = ((ys.max() - ys.min()) / (b1[1] - b0[1]) + (xs.max() - xs.min()) / (b1[0] - b0[0])) / 2
best = (0, s0, (xs.min() + xs.max()) / 2 - (b0[0] + b1[0]) / 2 * s0, (ys.min() + ys.max()) / 2 + (b0[1] + b1[1]) / 2 * s0)
for ss, st in [(.1, 30), (.04, 10), (.015, 4), (.006, 1.5)]:
    _, s1, tx1, ty1 = best
    for ds in np.linspace(-ss, ss, 5):
        for dx in np.linspace(-st, st, 5):
            for dy in np.linspace(-st, st, 5):
                sc = s1 * (1 + ds); r = iou(mask_of(sc, tx1 + dx, ty1 + dy))
                if r > best[0]: best = (r, sc, tx1 + dx, ty1 + dy)
IOU, S, TX, TY = best; print(name, 'IoU', round(IOU, 3))
px = V[:, 0] * S + TX; py = -V[:, 1] * S + TY

# ---- 每列輪廓邊緣（側面/背面取色）----
rows = {}
for y in range(H):
    xs_ = np.where(ink[y])[0]
    if len(xs_) > 6: rows[y] = (xs_.min(), xs_.max())
rk = np.array(sorted(rows))
def edge_uv(dx, y_img):
    y = int(rk[np.abs(rk - y_img).argmin()]); l, r = rows[y]; inset = max(5, (r - l) * .07)
    return ((l + inset if dx < 0 else r - inset) / W, 1 - y / H)
xi = np.clip(px, 0, W - 1).astype(int); yi = np.clip(py, 0, H - 1).astype(int); lt = ~ink[yi, xi]
cxm = (b0[0] + b1[0]) / 2
newV, newUV, newF, newN = [], [], [], []
for fi, tri in enumerate(F):
    front = FN[fi, 2] > .12 and not lt[tri].any()
    for k in range(3):
        i = tri[k]; newV.append(V[i]); newN.append(N[i])
        u, vv = (px[i] / W, 1 - py[i] / H) if front else edge_uv(V[i, 0] - cxm, py[i]); newUV.append((u / 2 + (0 if front else .5), vv))
    newF.append([fi * 3, fi * 3 + 1, fi * 3 + 2])
V2 = np.array(newV); c = (V2.min(0) + V2.max(0)) / 2; hgt = V2.max(0)[1] - V2.min(0)[1]
out_mesh = trimesh.Trimesh((V2 - c) / hgt, np.array(newF), vertex_normals=np.array(newN), process=False)
from PIL import ImageFilter
wgt = ndimage.gaussian_filter(ink.astype(float), 10)[..., None]; blur = Image.fromarray(np.clip(np.stack([ndimage.gaussian_filter(a[..., k] * ink, 10) for k in range(3)], -1) / np.maximum(wgt, 1e-3), 0, 255).astype('uint8'))
bA = np.asarray(blur).astype(float); strip = np.zeros((H, 3))
for y in range(H):
    yy = int(rk[np.abs(rk - y).argmin()]); l, r = rows[yy]; inset = int(max(5, (r - l) * .07))
    strip[y] = (bA[yy, min(W - 1, l + inset)] + bA[yy, max(0, r - inset)]) / 2
strip = ndimage.gaussian_filter1d(strip, 3, axis=0)
TS = 512  # 貼圖解析度（正面 TS×TS，整張 2TS×TS）；太大會讓手機卡
side = Image.fromarray(np.repeat(strip[:, None, :], 64, 1).clip(0, 255).astype('uint8')).resize((TS, TS))
tex = Image.new('RGB', (TS * 2, TS)); tex.paste(img.resize((TS, TS), Image.LANCZOS), (0, 0)); tex.paste(side, (TS, 0))
out_mesh.visual = trimesh.visual.TextureVisuals(uv=np.array(newUV), material=trimesh.visual.material.PBRMaterial(baseColorTexture=tex, roughnessFactor=.55, metallicFactor=0))
out_mesh.vertex_normals = np.array(newN)
out = os.path.join(ROOT, 'img', f'head_{name}.glb'); out_mesh.export(out)
g = pygltflib.GLTF2().load(out); blob = g.binary_blob(); nb = b''
imgBV = {im.bufferView for im in g.images}
for bi, bv in enumerate(g.bufferViews):
    d = blob[bv.byteOffset:bv.byteOffset + bv.byteLength]
    if bi in imgBV:
        b = io.BytesIO(); Image.open(io.BytesIO(d)).convert('RGB').save(b, 'JPEG', quality=86); d = b.getvalue()
    nb += b'\0' * ((4 - len(nb) % 4) % 4); bv.byteOffset = len(nb); bv.byteLength = len(d); nb += d
for im in g.images: im.mimeType = 'image/jpeg'
nb += b'\0' * ((4 - len(nb) % 4) % 4); g.buffers[0].byteLength = len(nb); g.set_binary_blob(nb); g.save(out)
print(name, len(F), 'faces', os.path.getsize(out) // 1024, 'KB')
