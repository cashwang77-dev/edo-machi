// 程式產生的材質（不需外部圖片）
import * as THREE from 'three';
export const FONT = '"Yuji Syuku","Noto Serif JP","Yu Mincho","MS Mincho",serif';
const cache = {};
export const IMG = {};
function fromImg(img, tint, alpha = 1, rep = [1, 1]) { const [c, g] = cv(512, 512); g.drawImage(img, 0, 0, 512, 512); if (tint) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = alpha; g.fillStyle = tint; g.fillRect(0, 0, 512, 512); } return mk(c, rep); }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function mk(c, rep = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
function rnd(seed) { let s = seed | 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function noise(g, w, h, amt, r, n = 4000, size = 2) {
  for (let i = 0; i < n; i++) { const v = (r() - .5) * amt; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(r() * w, r() * h, size * r() + 1, size * r() + 1); }
}
export function roof(key = 'roof', base = '#525a66') {
  if (cache[key]) return cache[key];
  if (IMG.roof) { const t = fromImg(IMG.roof, key === 'roof' ? null : '#7fb39a', .85); t.repeat.set(.4, .4); return cache[key] = t; }
  const [c, g] = cv(256, 256); const r = rnd(7);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const cols = 8, rows = 8, cw = 256 / cols, rh = 256 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const gr = g.createLinearGradient(x * cw, 0, x * cw + cw, 0);
    const b = .85 + r() * .25;
    gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(.35, `rgba(255,255,255,${.12 * b})`); gr.addColorStop(.6, `rgba(255,255,255,${.05 * b})`); gr.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = gr; g.fillRect(x * cw, y * rh, cw, rh);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x * cw, y * rh + rh - 5, cw, 5);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x * cw, y * rh + rh - 7, cw, 2);
  }
  noise(g, 256, 256, .12, r, 3000, 2);
  return cache[key] = mk(c);
}
export function plaster(key = 'plaster', base = '#e9e2d0') {
  if (cache[key]) return cache[key];
  if (IMG.plaster) return cache[key] = fromImg(IMG.plaster, base, 1);
  const [c, g] = cv(256, 256); const r = rnd(11);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, .06, r, 6000, 3);
  for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(120,100,70,${.03 + r() * .04})`; g.beginPath(); g.ellipse(r() * 256, 200 + r() * 56, 40 + r() * 60, 10 + r() * 20, 0, 0, 7); g.fill(); }
  return cache[key] = mk(c);
}
export function wood(key = 'wood', base = '#5b3d27', rep = [1, 1]) {
  const k = key + rep; if (cache[k]) return cache[k];
  if (IMG.wood && (key === 'wood' || key === 'woodD')) return cache[k] = fromImg(IMG.wood, key === 'woodD' ? '#7a7a7a' : '#d8c8b8', 1, rep);
  const [c, g] = cv(128, 256); const r = rnd(key.length * 13 + 5);
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(${r() > .5 ? '0,0,0' : '255,230,200'},${.04 + r() * .08})`; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * 128; g.moveTo(x, 0); for (let y = 0; y <= 256; y += 32) { x += (r() - .5) * 4; g.lineTo(x, y); } g.stroke(); }
  return cache[k] = mk(c, rep);
}
export function lattice(key = 'lat', slat = '#6b4a30', gap = '#1b1410', n = 12) {
  if (cache[key]) return cache[key];
  const [c, g] = cv(256, 256);
  g.fillStyle = gap; g.fillRect(0, 0, 256, 256);
  const w = 256 / n;
  for (let i = 0; i < n; i++) { const gr = g.createLinearGradient(i * w, 0, i * w + w * .7, 0); gr.addColorStop(0, slat); gr.addColorStop(1, '#3a281a'); g.fillStyle = gr; g.fillRect(i * w + 1, 0, w * .62, 256); }
  g.fillStyle = slat; g.fillRect(0, 0, 256, 10); g.fillRect(0, 246, 256, 10); g.fillRect(0, 123, 256, 6);
  return cache[key] = mk(c);
}
export function shoji(key = 'shoji') {
  if (cache[key]) return cache[key];
  const [c, g] = cv(256, 256);
  g.fillStyle = '#f3ead2'; g.fillRect(0, 0, 256, 256);
  const r = rnd(3); noise(g, 256, 256, .04, r, 2000, 2);
  g.fillStyle = '#5a3f2a';
  for (let i = 0; i <= 4; i++) g.fillRect(i * 64 - 3, 0, 6, 256);
  for (let j = 0; j <= 6; j++) g.fillRect(0, j * 256 / 6 - 2, 256, 4);
  g.fillRect(0, 0, 256, 10); g.fillRect(0, 246, 256, 10);
  return cache[key] = mk(c);
}
export function ground(key = 'ground') {
  if (cache[key]) return cache[key];
  if (IMG.dirt && key === 'dirt') return cache[key] = fromImg(IMG.dirt, '#d8cfc0', .5);
  const [c, g] = cv(512, 512); const r = rnd(21);
  g.fillStyle = '#9a8566'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${r() > .5 ? '80,60,40' : '190,170,140'},${.06 + r() * .06})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 30 + r() * 90, 20 + r() * 60, r() * 3, 0, 7); g.fill(); }
  noise(g, 512, 512, .18, r, 14000, 2);
  for (let i = 0; i < 900; i++) { const x = r() * 512, y = r() * 512, s = .6 + r() * 1.4; g.fillStyle = 'rgba(60,50,40,.5)'; g.beginPath(); g.arc(x + 1, y + 1, s, 0, 7); g.fill(); const v = 110 + r() * 60; g.fillStyle = `rgb(${v},${v - 8},${v - 20})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  return cache[key] = mk(c, [1, 1]);
}
export function stone(key = 'stone') {
  if (cache[key]) return cache[key];
  const [c, g] = cv(256, 256); const r = rnd(33);
  g.fillStyle = '#4c4a45'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = -1; x < 4; x++) {
    const off = (y % 2) * 32;
    const v = 120 + r() * 40; g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
    g.fillRect(x * 64 + off + 2, y * 64 + 2, 60, 60);
  }
  noise(g, 256, 256, .15, r, 5000, 2);
  return cache[key] = mk(c);
}
export function gravel(key = 'gravel') {
  if (cache[key]) return cache[key];
  const [c, g] = cv(256, 256); const r = rnd(41);
  g.fillStyle = '#b9b3a6'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { const v = 140 + r() * 90; g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; g.beginPath(); g.arc(r() * 256, r() * 256, .8 + r() * 2.2, 0, 7); g.fill(); }
  return cache[key] = mk(c);
}
// 文字布條／招牌／燈籠
export function text(str, o = {}) {
  const k = 'T' + str + JSON.stringify(o); if (cache[k]) return cache[k];
  const W = o.w || 256, H = o.h || 512; const [c, g] = cv(W, H);
  if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, W, H); }
  if (o.grain) { const r = rnd(str.length * 7); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${.05 + r() * .06})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * H; g.moveTo(0, y); g.lineTo(W, y + (r() - .5) * 8); g.stroke(); } }
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = W * .04; g.strokeRect(W * .04, W * .04, W - W * .08, H - W * .08); }
  if (o.circle) { g.fillStyle = o.circle; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) * .36, 0, 7); g.fill(); }
  g.fillStyle = o.fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...str];
  if (o.vertical !== false && H > W) {
    const fs = Math.min(W * .78, (H * .86) / chars.length);
    g.font = `${o.weight || 700} ${fs}px ${FONT}`;
    const y0 = H / 2 - (chars.length - 1) * fs * .52;
    chars.forEach((ch, i) => g.fillText(ch, W / 2, y0 + i * fs * 1.04));
  } else {
    const fs = Math.min(H * .7, (W * .9) / chars.length);
    g.font = `${o.weight || 700} ${fs}px ${FONT}`;
    g.fillText(str, W / 2, H / 2 + fs * .04);
  }
  return cache[k] = mk(c);
}
// 和服花紋
export function pattern(kind, color, alt = '#f4efe2') {
  const k = 'P' + kind + color + alt; if (cache[k]) return cache[k];
  const [c, g] = cv(128, 128); g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  g.fillStyle = alt; g.strokeStyle = alt;
  if (kind === 1) { for (let i = 0; i < 128; i += 16) g.fillRect(i, 0, 5, 128); }
  else if (kind === 2) { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, 7); g.fill(); } }
  else if (kind === 3) { g.globalAlpha = .55; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16); }
  else if (kind === 4) { g.lineWidth = 2; g.globalAlpha = .7; for (let y = -1; y < 6; y++) for (let x = -1; x < 6; x++) { const cx = x * 32 + (y % 2) * 16, cy = y * 28; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 16, cy + 28); g.lineTo(cx - 16, cy + 28); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 19); g.lineTo(cx + 16, cy + 28); g.moveTo(cx, cy + 19); g.lineTo(cx - 16, cy + 28); g.stroke(); } }
  else if (kind === 5) { g.globalAlpha = .8; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const cx = x * 44 + (y % 2) * 22 + 10, cy = y * 44 + 20; for (let p = 0; p < 5; p++) { const a = p / 5 * 6.283; g.beginPath(); g.ellipse(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 5, 3.5, a, 0, 7); g.fill(); } } }
  return cache[k] = mk(c, [2, 2]);
}
export function radial(key, inner, outer) {
  if (cache[key]) return cache[key];
  const [c, g] = cv(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return cache[key] = t;
}

// Gemini 畫的木招牌＋書法店名
export function kanban(name, idx) {
  const k = 'K' + name + idx; if (cache[k]) return cache[k];
  const img = IMG.kanban && IMG.kanban[idx]; if (!img) return null;
  const W = 600, H = Math.round(600 * img.height / img.width); const [c, g] = cv(W, H);
  g.drawImage(img, 0, 0, W, H);
  const light = [1, 4, 8].includes(idx);
  g.fillStyle = light ? '#1e140c' : idx === 2 ? '#f6e3a8' : idx === 5 || idx === 9 ? '#f4efe4' : '#e8c56a';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ch = [...name]; const fs = Math.min(H * .52, (W * .7) / ch.length);
  g.font = `700 ${fs}px ${FONT}`; g.shadowColor = light ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.6)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
  const sp = Math.min(fs * .25, (W * .72 - fs * ch.length) / Math.max(1, ch.length - 1));
  const tw = fs * ch.length + sp * (ch.length - 1); ch.forEach((x, i) => g.fillText(x, W / 2 - tw / 2 + fs / 2 + i * (fs + sp), H / 2 + fs * .04));
  const t = mk(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.userData = { ratio: W / H }; return cache[k] = t;
}

// 花魁布料：in＝紅地金牡丹、out＝黑地金鳳凰雲紋、obi＝金地紅菱
export function oiran(kind) {
  const k = 'OI' + kind; if (cache[k]) return cache[k];
  const [c, g] = cv(256, 256); const r = rnd(kind.length * 31 + 7);
  const gold = (a = 1) => `rgba(232,190,82,${a})`;
  if (kind === 'obi') {
    g.fillStyle = '#d9a83a'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#b8202e' : '#f2d27a'; g.beginPath(); const cx = x * 32 + 16, cy = y * 32 + 16; g.moveTo(cx, cy - 12); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 12, cy); g.fill(); }
    return cache[k] = mk(c);
  }
  g.fillStyle = kind === 'in' ? '#b3172c' : '#141015'; g.fillRect(0, 0, 256, 256);
  // 雲紋
  g.strokeStyle = gold(kind === 'in' ? .35 : .5); g.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const x = r() * 256, y = r() * 256; for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + j * 16, y, 9, Math.PI, 0); g.stroke(); } }
  // 大朵牡丹
  for (let i = 0; i < (kind === 'in' ? 5 : 4); i++) {
    const x = r() * 256, y = r() * 256, R = 18 + r() * 14;
    for (let p = 0; p < 8; p++) { const a = p / 8 * Math.PI * 2; g.fillStyle = kind === 'in' ? (p % 2 ? '#f2d27a' : '#ffffff') : (p % 2 ? gold(.95) : '#c21f32'); g.beginPath(); g.ellipse(x + Math.cos(a) * R * .55, y + Math.sin(a) * R * .55, R * .5, R * .3, a, 0, 7); g.fill(); }
    g.fillStyle = gold(); g.beginPath(); g.arc(x, y, R * .25, 0, 7); g.fill();
  }
  // 金箔細點
  for (let i = 0; i < 260; i++) { g.fillStyle = gold(.4 + r() * .6); g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  const t = mk(c, [2, 2]); return cache[k] = t;
}

// 一般和服布料：底色＋細織紋
export function fabric(color) {
  const k = 'FAB' + color; if (cache[k]) return cache[k];
  const [c, g] = cv(128, 128); const r = rnd(color.length * 17 + 3);
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(255,255,255,${.025 + r() * .02})`; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(0,0,0,${.03 + r() * .03})`; g.fillRect(x, 0, 1, 128); }
  noise(g, 128, 128, .05, r, 900, 1);
  return cache[k] = mk(c, [2, 2]);
}
// 花魁布料：有 Gemini 刺繡圖就用，否則程式產生
export function oiranTex(kind) {
  const key = kind === 'out' ? 'oiranOut' : kind === 'in' ? 'oiranIn' : null;
  if (key && IMG[key]) { const k = 'OIX' + kind; if (cache[k]) return cache[k]; const [c, g] = cv(512, 512); g.drawImage(IMG[key], 0, 0, 512, 512); return cache[k] = mk(c, kind === 'out' ? [1.4, 1.4] : [1.6, 1.6]); }
  return oiran(kind);
}
