// 路線規劃：地圖切 1 公尺格子（可走＝walkable 且不碰障礙物），從起點做一次最短路，就能得到到每個地方的距離與路線
const GR = { x0: -300, z0: -115, w: 535, h: 260 }; let GRID = null;
function buildGrid() {
  const { x0, z0, w, h } = GR, g = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[j * w + i] = walkable(x0 + i + .5, z0 + j + .5) ? 1 : 0;
  const m = .55, cell = (i, j) => i >= 0 && j >= 0 && i < w && j < h;
  for (const c of W.colliders) {
    if (c.r !== undefined) { const r = c.r + m; for (let j = Math.floor(c.z - r - z0); j <= Math.ceil(c.z + r - z0); j++) for (let i = Math.floor(c.x - r - x0); i <= Math.ceil(c.x + r - x0); i++) if (cell(i, j) && Math.hypot(x0 + i + .5 - c.x, z0 + j + .5 - c.z) < r) g[j * w + i] = 0; }
    else for (let j = Math.floor(c.z0 - m - z0); j <= Math.ceil(c.z1 + m - z0); j++) for (let i = Math.floor(c.x0 - m - x0); i <= Math.ceil(c.x1 + m - x0); i++) { const x = x0 + i + .5, z = z0 + j + .5; if (cell(i, j) && x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) g[j * w + i] = 0; }
  }
  GRID = g;
}
function gCell(x, z) { // 最近的可走格
  if (!GRID) buildGrid(); const { x0, z0, w, h } = GR; const ci = Math.floor(x - x0), cj = Math.floor(z - z0);
  for (let r = 0; r < 6; r++) for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) { if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || i < 0 || j < 0 || i >= w || j >= h) continue; if (GRID[j * w + i]) return j * w + i; }
  return -1;
}
function flood(from) { // Dijkstra（二元堆積），回傳距離與前一格
  const { w, h } = GR, N = w * h, D = new Float64Array(N).fill(1e9), P = new Int32Array(N).fill(-1), s = gCell(from.x, from.z);
  const FL = { D, P, s, from }; if (s < 0) return FL;
  const hk = [], hv = []; const push = (k, v) => { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= v) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v; };
  const pop = () => { const k = hk[0], lk = hk.pop(), lv = hv.pop(); if (hk.length) { let i = 0; const n = hk.length; while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hv[c + 1] < hv[c]) c++; if (hv[c] >= lv) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; } hk[i] = lk; hv[i] = lv; } return k; };
  D[s] = 0; push(s, 0); const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (hk.length) { const dv = hv[0], u = pop(); if (dv > D[u]) continue; const ui = u % w, uj = (u / w) | 0;
    for (const [di, dj, c] of NB) { const i = ui + di, j = uj + dj; if (i < 0 || j < 0 || i >= w || j >= h) continue; const v = j * w + i; if (!GRID[v]) continue;
      if (di && dj && (!GRID[uj * w + i] || !GRID[j * w + ui])) continue; const nd = dv + c; if (nd < D[v]) { D[v] = nd; P[v] = u; push(v, nd); } } }
  return FL;
}
const gClear = (a, b) => { const { x0, z0, w } = GR, d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / .35); for (let k = 1; k < n; k++) { const t = k / n, i = Math.floor(a.x + (b.x - a.x) * t - x0), j = Math.floor(a.z + (b.z - a.z) * t - z0); if (!GRID[j * w + i]) return false; } return true; };
function pathFrom(FL, to) { // 回傳 { pts, len } 或 null（到不了）
  const t = gCell(to.x, to.z); if (t < 0 || FL.s < 0 || FL.D[t] >= 1e9) return null;
  const { x0, z0, w } = GR, cells = []; for (let k = t; k >= 0; k = FL.P[k]) { cells.push({ x: x0 + (k % w) + .5, z: z0 + ((k / w) | 0) + .5 }); if (k === FL.s) break; }
  cells.reverse(); const raw = [FL.from, ...cells.slice(1, -1), to], pts = [raw[0]];
  for (let i = 0; i < raw.length - 1;) { let j = i + 1; while (j + 1 < raw.length && gClear(raw[i], raw[j + 1])) j++; pts.push(raw[j]); i = j; } // 拉直
  return { pts, len: FL.D[t] };
}
function routeTo(from, to) { const r = pathFrom(flood(from), to); return r || { pts: [from, to], len: Math.hypot(to.x - from.x, to.z - from.z) }; }
const lineOK = (a, b) => { if (!GRID) buildGrid(); return gClear(a, b); };
