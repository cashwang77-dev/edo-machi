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
hairUV = (hair_px[0] / W, 1 - hair_px[1] / H); skinUV = (skin_px[0] / W, 1 - skin_px[1] / H)
newV, newUV, newF = [], [], []
for fi, tri in enumerate(F):
    front = FN[fi, 2] > -.05 and not lt[tri].any()
    cy = py[tri].mean()
    for k in range(3):
        newV.append(V[tri[k]]); newUV.append(pu[tri[k]] if front else (skinUV if cy > neckY else hairUV))
    newF.append([fi * 3, fi * 3 + 1, fi * 3 + 2])
V = np.array(newV); uv = np.array(newUV)
mesh = trimesh.Trimesh(V, np.array(newF), process=False)
# 把模型移到原點：頭的中心在 (0,0,0)，高度縮成 1
c = (b0 + b1) / 2; mesh.vertices = (V - c) / (b1[1] - b0[1])
mesh.merge_vertices(merge_tex=False, merge_norm=True) if False else None
tex = img.resize((1024, 1024), Image.LANCZOS).convert('RGB')
mat = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, roughnessFactor=.55, metallicFactor=0)
mesh.visual = trimesh.visual.TextureVisuals(uv=uv, material=mat)
out = os.path.join(ROOT, 'img', f'head_{name}.glb'); mesh.export(out)
print(name, len(mesh.faces), 'faces', os.path.getsize(out) // 1024, 'KB', 'bbox', b0.round(2), b1.round(2))
