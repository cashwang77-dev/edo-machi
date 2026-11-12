// 江戶町 3D 世界
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './tex.js';
import { SHOPS, STREET } from './shops.js';

const PI = Math.PI;
export const ARCH = x => (x > 110 && x < 140) ? 1.7 * Math.sin(PI * (x - 110) / 30) : 0;
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- 幾何與材質 ----------
function boxG(w, h, d, s = 2) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
  return g;
}
const MAT = {}; export const GLOW = []; // 夜間發光材質
function std(key, o) { return MAT[key] || (MAT[key] = new THREE.MeshStandardMaterial({ roughness: .88, ...o })); }
function glow(key, o, k = 1) { if (MAT[key]) return MAT[key]; const m = std(key, o); m.userData.k = k; GLOW.push(m); return m; }
const C = {
  plaster: c => std('pl' + c, { map: TX.plaster('pl' + c, c) }),
  wood: () => std('wood', { map: TX.wood('wood', '#4d3322') }),
  woodL: () => std('woodL', { map: TX.wood('woodL', '#8a6440') }),
  woodD: () => std('woodD', { map: TX.wood('woodD', '#2c1f17') }),
  roof: () => std('roof', { map: TX.roof('roof', '#4f5660'), roughness: .65, metalness: .05 }),
  roofG: () => std('roofG', { map: TX.roof('roofG', '#4f7d6a'), roughness: .6, metalness: .2 }),
  lat: () => std('lat', { map: TX.lattice() }),
  shoji: () => glow('shoji', { map: TX.shoji(), emissive: '#ffb860', emissiveMap: TX.shoji(), emissiveIntensity: 0 }, .55),
  stone: () => std('stone', { map: TX.stone() }),
  red: () => std('red', { color: '#c8402c', roughness: .6 }),
  black: () => std('black', { color: '#1d1a18', roughness: .5 }),
  felt: () => std('felt', { color: '#b3262b', roughness: 1 }),
  pink: () => std('pink', { color: '#f3c1cf', roughness: .9, emissive: '#3a1a22', emissiveIntensity: .25 }),
  leaf: () => std('leaf', { color: '#4f6e35', roughness: .95 }),
  pine: () => std('pine', { color: '#2f4a2c', roughness: .95 }),
  willow: () => std('willow', { color: '#86a64a', roughness: .95, side: THREE.DoubleSide }),
  bark: () => std('bark', { color: '#4a3a30', roughness: 1 }),
};

class Batcher {
  constructor() { this.m = new Map(); }
  add(geo, mat, mx) {
    if (Array.isArray(mat)) {
      const base = geo.index ? geo : null;
      for (const gr of geo.groups) { const g2 = geo.clone(); g2.setIndex(Array.from(base.index.array.slice(gr.start, gr.start + gr.count))); g2.clearGroups(); this.add(g2, mat[gr.materialIndex], mx); }
      return;
    }
    let g = geo.clone(); g.applyMatrix4(mx);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    if (!this.m.has(mat)) this.m.set(mat, []); this.m.get(mat).push(g);
  }
  bake(obj) {
    obj.updateMatrixWorld(true); const rm = [];
    obj.traverse(o => { if (o.isMesh && !o.userData.dyn) { this.add(o.geometry, o.material, o.matrixWorld); rm.push(o); } });
    rm.forEach(o => o.parent && o.parent.remove(o));
  }
  finish(scene) {
    for (const [mat, list] of this.m) {
      const g = mergeGeometries(list, false); const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = !mat.userData.noShadow; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    }
  }
}
function M(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; }
function tri(z0, z1, zc, y0, y1, x, sign, mat) {
  const sh = new THREE.Shape(); const f = v => sign > 0 ? -v : v;
  sh.moveTo(f(z0), y0); sh.lineTo(f(z1), y0); sh.lineTo(f(zc), y1); sh.closePath();
  const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  g.rotateY(sign * PI / 2); g.translate(x, 0, 0); return new THREE.Mesh(g, mat);
}
function norenTex(str, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 512, 160);
  const n = Math.max(3, [...str].length + 1);
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < n; i++) g.fillRect(i * 512 / n - 2, 40, 4, 120);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, 512, 36);
  g.fillStyle = '#f6f0e2'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 92px ${TX.FONT}`; const ch = [...str];
  ch.forEach((s, i) => g.fillText(s, (i + (n - ch.length) / 2 + .5) * 512 / n, 92));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const LANTERN_G = (() => { const pts = []; for (let i = 0; i <= 10; i++) { const y = i / 10; pts.push(new THREE.Vector2(.07 + .17 * Math.sin(y * PI), y * .55)); } return new THREE.LatheGeometry(pts, 14); })();
function lanternMat(ch, col = '#c8322a') {
  const k = 'lan' + ch + col; if (MAT[k]) return MAT[k];
  const t = TX.text(ch, { w: 256, h: 128, bg: col, fg: '#1a1210', vertical: false });
  t.repeat.set(2, 1);
  return glow(k, { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0, roughness: .7 }, 4.2);
}

// ---------- 建築 ----------
function house(o) {
  const g = new THREE.Group(); const r = o.rand || Math.random;
  const w = o.w, d = o.d || 9, two = o.floors === 2, H1 = 3.0, H2 = 2.4;
  const pl = C.plaster(o.wall || '#e8e0cc'), wd = C.wood(), wl = C.woodL(), roofM = o.copper ? C.roofG() : C.roof();
  const lan = []; const info = { lanterns: lan };
  // 床・柱・牆
  g.add(M(boxG(w - .1, .4, d), wd, 0, .2, -d / 2));
  g.add(M(boxG(w, .3, d + .1), C.stone(), 0, .15, -d / 2 - .05));
  const postM = o.red ? C.red() : wd;
  const np = Math.max(2, Math.round(w / 3.2));
  for (let i = 0; i <= np; i++) g.add(M(boxG(.22, H1, .22), postM, -w / 2 + .11 + i * (w - .22) / np, H1 / 2, -.12));
  g.add(M(boxG(w, .26, .26), postM, 0, H1 - .13, -.12));
  g.add(M(boxG(w, H1, .2), pl, 0, H1 / 2, -d + .1));
  for (const s of [-1, 1]) { g.add(M(boxG(.2, H1, d), pl, s * (w / 2 - .1), H1 / 2, -d / 2)); g.add(M(boxG(.24, 1.1, d), wd, s * (w / 2 - .1), .85, -d / 2)); }
  if (!o.shop) {
    g.add(M(boxG(w - .5, 2.55, .1), C.lat(), 0, .4 + 1.27, -.45));
    if (r() < .5) { const t = norenTex(['御', '宿', '米', '油', '薬', '酒', '炭', '紙'][Math.floor(r() * 8)], ['#24406e', '#5a3420', '#2c2c34', '#3b6a5a'][Math.floor(r() * 4)]); const m = std('nor' + t.uuid, { map: t, side: THREE.DoubleSide }); g.add(M(new THREE.PlaneGeometry(Math.min(2.4, w - 1), .8), m, 0, 2.45, -.3)); }
  }
  // 屋頂
  const a = two ? .48 : .42;
  const roofAt = (base, zf, zb, wide) => {
    const hd = (zf - zb) / 2, zc = (zf + zb) / 2, L = hd / Math.cos(a) + .15, rise = hd * Math.tan(a);
    g.add(M(boxG(wide, .16, L, 1.5), roofM, 0, base + rise / 2, zf - hd / 2, a, 0, 0));
    g.add(M(boxG(wide, .16, L, 1.5), roofM, 0, base + rise / 2, zb + hd / 2, -a, 0, 0));
    g.add(M(boxG(wide + .1, .26, .34), C.black(), 0, base + rise + .06, zc));
    for (const s of [-1, 1]) g.add(M(new THREE.CylinderGeometry(.16, .16, .3, 8), C.black(), s * (wide / 2), base + rise + .06, zc, 0, 0, PI / 2));
    return { zc, top: base + rise };
  };
  if (two) {
    const zf = -1.1; // 二樓前牆
    g.add(M(boxG(w, H2, .2), pl, 0, H1 + H2 / 2, zf));
    g.add(M(boxG(w, H2, .2), pl, 0, H1 + H2 / 2, -d + .1));
    for (const s of [-1, 1]) g.add(M(boxG(.2, H2, d + zf), pl, s * (w / 2 - .1), H1 + H2 / 2, (zf - d) / 2));
    g.add(M(boxG(w + .02, .18, .24), wd, 0, H1 + .1, zf));
    // 虫籠窓／障子
    const nw = Math.max(1, Math.floor(w / 4.5)); const lit = o.shop || r() < .55;
    for (let i = 0; i < nw; i++) {
      const x = -w / 2 + (i + .5) * w / nw;
      if (!o.shop || i !== Math.floor(nw / 2) || nw === 1 && false) g.add(M(boxG(Math.min(2.2, w / nw - 1), .8, .12), lit ? C.shoji() : C.lat(), x, H1 + 1.2, zf + .07));
    }
    // 庇
    const ha = .3, hz0 = 1.5, hz1 = zf + .1, hl = (hz0 - hz1) / Math.cos(ha);
    g.add(M(boxG(w + .5, .14, hl + .1, 1.5), roofM, 0, H1 + .05 + (hz0 - hz1) / 2 * Math.tan(ha), (hz0 + hz1) / 2, ha, 0, 0));
    const R = roofAt(H1 + H2, zf + .9, -d - .6, w + .7);
    for (const s of [-1, 1]) g.add(tri(zf, -d, R.zc, H1 + H2, R.top - .1, s * (w / 2 - .05), s, pl));
    if (o.udatsu) for (const s of [-1, 1]) { g.add(M(boxG(.3, 1.5, 1.2), pl, s * (w / 2 + .1), H1 + 1, zf + .4)); g.add(M(boxG(.6, .12, 1.5), roofM, s * (w / 2 + .1), H1 + 1.8, zf + .4)); }
    info.signY = H1 + 1.25; info.signZ = zf + .14;
  } else {
    const R = roofAt(H1, 1.6, -d - .6, w + .7);
    for (const s of [-1, 1]) g.add(tri(0, -d, R.zc, H1, R.top - .1, s * (w / 2 - .05), s, pl));
    info.signY = null;
  }
  if (o.chimney) { g.add(M(boxG(1.2, 8, 1.2), C.plaster('#8a7b6a'), w / 2 - 1.5, 4, -d + 1.5)); info.chimney = new THREE.Vector3(w / 2 - 1.5, 8.2, -d + 1.5); }
  return { g, info };
}

function shopHouse(def, rand) {
  const w = def.w, d = 9;
  const { g, info } = house({ w, d, floors: def.floors, wall: def.wall, shop: def, rand, udatsu: false, chimney: def.chimney });
  const wd = C.wood(), wl = C.woodL();
  // 櫃台
  g.add(M(boxG(w - 1.4, .65, .55), wd, 0, .4 + .325, -.55));
  g.add(M(boxG(w - 1.25, .07, .68), wl, 0, 1.085, -.55));
  // 後方架子與商品
  for (let k = 0; k < 2; k++) g.add(M(boxG(w - 1.2, .06, .5), wl, 0, 1.4 + k * .7, -d + .5));
  const col = ['#7a3b2a', '#2f4f6a', '#c9a24a', '#5c7a3a', '#e8e0d0', '#6a3a5a'];
  for (let k = 0; k < 2; k++) for (let x = -w / 2 + 1; x < w / 2 - 1; x += .55 + rand() * .3) {
    const c = col[Math.floor(rand() * col.length)];
    if (def.id === 'gofuku' || def.id === 'komamono') g.add(M(boxG(.45, .3, .4), std('it' + c, { color: c }), x, 1.6 + k * .7, -d + .5));
    else g.add(M(new THREE.CylinderGeometry(.13, .16, .38, 10), std('it' + c, { color: c, roughness: .4 }), x, 1.62 + k * .7, -d + .5));
  }
  if (!def.service) { // かまど＋鍋
    g.add(M(boxG(1.8, .8, 1), C.plaster('#6e5f52'), -w / 2 + 1.6, .8, -d + 1.6));
    g.add(M(new THREE.CylinderGeometry(.4, .3, .35, 14), C.black(), -w / 2 + 1.6, 1.35, -d + 1.6));
    info.steam = new THREE.Vector3(-w / 2 + 1.6, 1.6, -d + 1.6);
  }
  if (def.id === 'ukiyoe') for (let i = 0; i < 6; i++) { const c = ['#2b5c8a', '#c46a2c', '#e8d4a8', '#5c7a3a', '#a33', '#334'][i]; g.add(M(boxG(.8, 1.1, .03), std('pr' + c, { color: c }), -w / 2 + 1.2 + i * 1.5, 2.1, -d + .25)); }
  if (def.id === 'kamiyui') { g.add(M(boxG(.6, .9, .05), std('mirror', { color: '#cfd8dc', metalness: .9, roughness: .15 }), 2, 1.8, -d + .3)); }
  if (def.id === 'yuya') { g.add(M(boxG(1.4, 1.3, 1), wl, w / 2 - 2, 1.05, -1.6)); }
  // 暖簾・のれん
  const nm = std('noren' + def.id, { map: norenTex(def.sign, def.noren), side: THREE.DoubleSide, roughness: 1 });
  if (def.rope) for (let x = -w / 2 + 1; x < w / 2 - 1; x += .12) g.add(M(new THREE.CylinderGeometry(.015, .015, .8, 4), std('rope', { color: '#7a6040' }), x, 2.45, -.05));
  else g.add(M(new THREE.PlaneGeometry(w - 1.2, .75), nm, 0, 2.47, .03));
  // 招牌
  const kan = std('kan' + def.id, { map: TX.text(def.name, { w: 512, h: 160, bg: '#2a1d14', fg: '#e8c56a', vertical: false, grain: true, border: '#7a5a3a' }) });
  if (info.signY) g.add(M(new THREE.BoxGeometry(Math.min(w * .5, 5), .9, .08), [wd, wd, wd, wd, kan, wd], 0, info.signY, info.signZ));
  const tate = std('tate' + def.id, { map: TX.text(def.sign, { w: 128, h: 384, bg: '#efe6d0', fg: '#1a1410', grain: true }) });
  g.add(M(new THREE.BoxGeometry(.55, 1.8, .1), [wd, wd, wd, wd, tate, tate], w / 2 - .45, 1.0, 1.15));
  g.add(M(boxG(.75, .1, .4), wd, w / 2 - .45, .05, 1.15));
  // 提燈
  const lm = lanternMat(def.sign[0], def.id === 'izakaya' ? '#e8dcc0' : '#c8322a');
  for (const s of [-1, 1]) {
    const lx = s * (w / 2 - .35);
    g.add(M(new THREE.CylinderGeometry(.008, .008, .4, 3), C.black(), lx, 2.7, .3));
    g.add(M(LANTERN_G, lm, lx, 1.95, .3));
    g.add(M(new THREE.CylinderGeometry(.09, .09, .05, 10), C.black(), lx, 2.52, .3));
    g.add(M(new THREE.CylinderGeometry(.09, .09, .05, 10), C.black(), lx, 1.95, .3));
    info.lanterns.push(new THREE.Vector3(lx, 2.2, .3));
  }
  // 座位
  const seats = [];
  if (def.umbrella) {
    g.add(M(new THREE.CylinderGeometry(.04, .04, 3.4, 6), wd, 0, 1.7, 3.3));
    const u = M(new THREE.ConeGeometry(2.3, .7, 20, 1, true), std('umb', { color: '#c0302e', side: THREE.DoubleSide, roughness: .8 }), 0, 3.25, 3.3); g.add(u);
    for (const s of [-1, 1]) {
      const bx = s * 1.6; g.add(M(boxG(2.4, .08, .8), C.felt(), bx, .46, 2.4)); g.add(M(boxG(2.4, .38, .7), wd, bx, .21, 2.4));
      for (const q of [-.55, .55]) seats.push({ lx: bx + q, ly: .5, lz: 2.4, face: PI, dlx: bx + q + (q > 0 ? .5 : -.5), dly: .55, dlz: 2.4 });
    }
  }
  const nStool = Math.min(3, Math.floor((w - 2) / 1.6));
  for (let i = 0; i < nStool; i++) {
    const x = (i - (nStool - 1) / 2) * 1.7;
    g.add(M(new THREE.CylinderGeometry(.2, .22, .45, 10), wl, x, .225, .4));
    seats.push({ lx: x, ly: .45, lz: .4, face: PI, dlx: x, dly: 1.13, dlz: -.5 });
  }
  info.seats = seats; info.owner = { lx: 0, ly: .4, lz: -1.45, face: 0 };
  return { g, info };
}

// ---------- 樹木 ----------
function sakura(B, x, z, s, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = r() * 6;
  g.add(M(new THREE.CylinderGeometry(.18, .32, 2.6, 8), C.bark(), 0, 1.3, 0, 0, 0, .08));
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + r(); g.add(M(new THREE.CylinderGeometry(.06, .13, 2, 6), C.bark(), Math.cos(a) * .6, 2.9, Math.sin(a) * .6, Math.sin(a) * .7, 0, -Math.cos(a) * .7)); }
  const blob = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, rr = r() * 1.6; const m = M(blob, C.pink(), Math.cos(a) * rr, 3.3 + r() * 1.4, Math.sin(a) * rr); m.scale.set(1.1 + r() * .6, .8 + r() * .4, 1.1 + r() * .6); g.add(m); }
  B.bake(g);
}
function willow(B, x, z, s, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
  g.add(M(new THREE.CylinderGeometry(.16, .28, 3.6, 8), C.bark(), 0, 1.8, 0, 0, 0, .1));
  g.add(M(new THREE.IcosahedronGeometry(1.1, 1), C.willow(), .2, 3.9, 0));
  const strand = new THREE.PlaneGeometry(.35, 3.2);
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28 + r() * .2, rr = .9 + r() * .7; g.add(M(strand, C.willow(), .2 + Math.cos(a) * rr, 2.6 - r() * .4, Math.sin(a) * rr, (r() - .5) * .2, -a, 0)); }
  B.bake(g);
}
function pine(B, x, z, s, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = r() * 6;
  g.add(M(new THREE.CylinderGeometry(.14, .3, 3, 7), C.bark(), 0, 1.5, 0, 0, 0, .15));
  g.add(M(new THREE.CylinderGeometry(.1, .14, 2.2, 7), C.bark(), -.35, 3.6, 0, 0, 0, -.35));
  const disc = new THREE.SphereGeometry(1, 10, 6);
  for (let i = 0; i < 4; i++) { const m = M(disc, C.pine(), (r() - .5) * 2, 3.2 + i * .75, (r() - .5) * 1.4); m.scale.set(1.5 - i * .2, .35, 1.2 - i * .15); g.add(m); }
  B.bake(g);
}
function toro(B, x, z, rot = 0) { // 石燈籠
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; const st = C.stone();
  g.add(M(boxG(.8, .3, .8, 1), st, 0, .15, 0)); g.add(M(new THREE.CylinderGeometry(.16, .2, 1.2, 8), st, 0, .9, 0));
  g.add(M(boxG(.7, .15, .7, 1), st, 0, 1.55, 0));
  g.add(M(boxG(.42, .4, .42, 1), glow('toro', { color: '#d9c9a0', emissive: '#ffb050', emissiveIntensity: 0 }, 3.2), 0, 1.83, 0));
  g.add(M(new THREE.ConeGeometry(.65, .45, 4), st, 0, 2.25, 0, 0, PI / 4, 0)); g.add(M(new THREE.SphereGeometry(.1, 8, 6), st, 0, 2.5, 0));
  B.bake(g); return new THREE.Vector3(x, 1.85, z);
}

// ---------- 天空與水 ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = vec4(p.xy, p.w*.99999, p.w); }`,
  fragmentShader: `varying vec3 vDir; uniform vec3 uTop,uBot,uSunDir,uSunCol; uniform float uStars,uTime;
  void main(){ vec3 d=normalize(vDir); float y=d.y;
    vec3 col=mix(uBot,uTop,smoothstep(-.02,.55,y));
    float sd=max(dot(d,uSunDir),0.); col+=uSunCol*(pow(sd,900.)*6.+pow(sd,12.)*.35+pow(sd,3.)*.12)*smoothstep(-.15,.05,uSunDir.y);
    float md=max(dot(d,-uSunDir),0.); col+=vec3(1.,.96,.85)*(smoothstep(.99955,.9998,md)*1.6+pow(md,60.)*.08)*uStars;
    vec3 q=floor(d*260.); float h=fract(sin(dot(q,vec3(12.9898,78.233,37.719)))*43758.5453);
    col+=vec3(step(.9978,h)*uStars*smoothstep(.02,.25,y)*(.55+.45*sin(uTime*2.+h*90.)));
    col=mix(col,uBot*.75,smoothstep(0.,-.25,y));
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
});
const waterMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uSky: { value: new THREE.Color() }, uDeep: { value: new THREE.Color('#1d3b3a') }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uFogD: { value: .006 }, uGlow: { value: 0 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vW; uniform float uTime,uFogD,uGlow; uniform vec3 uSky,uDeep,uSunDir,uSunCol,uFog;
  float H(vec2 p){ return sin(p.x*.9+uTime*1.1)*.35+sin(p.y*.7-uTime*.9)*.35+sin((p.x+p.y)*2.1+uTime*2.3)*.15+sin((p.x*1.3-p.y)*3.7-uTime*3.1)*.07; }
  void main(){ vec2 p=vW.xz; float e=.08;
    vec3 n=normalize(vec3(H(p-vec2(e,0.))-H(p+vec2(e,0.)),2.*e*4.,H(p-vec2(0.,e))-H(p+vec2(0.,e))));
    vec3 v=normalize(cameraPosition-vW); float fr=pow(1.-max(dot(n,v),0.),4.);
    vec3 col=mix(uDeep,uSky,.18+.75*fr);
    vec3 rf=reflect(-v,n); col+=uSunCol*pow(max(dot(rf,uSunDir),0.),180.)*2.5*smoothstep(-.1,.1,uSunDir.y);
    float st=sin(vW.z*.35+H(p)*3.)*.5+.5; col+=vec3(1.,.6,.25)*uGlow*.12*pow(st,6.)*fr;
    float dist=length(cameraPosition-vW); float f=1.-exp(-uFogD*uFogD*dist*dist);
    col=mix(col,uFog,f);
    gl_FragColor=vec4(col,.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`, transparent: true
});

// 晝夜關鍵影格 [t, 天頂, 地平, 霧, 日光色, 日光強度, 環境光, 燈籠, 星星]
const KEYS = [
  [0, '#0a0f24', '#1c2446', '#1a2140', '#a8bcf0', .55, .55, 1, 1],
  [.21, '#121836', '#38325a', '#2c2a48', '#9db0e8', .35, .42, 1, .8],
  [.265, '#46669f', '#f2a173', '#c79a8a', '#ffb070', 1.0, .6, .45, 0],
  [.33, '#5a8ccd', '#ead4b4', '#c9c7bf', '#ffe2b4', 2.3, .85, 0, 0],
  [.5, '#4d84d4', '#cfe1f0', '#bfcfdb', '#fff6e8', 3.0, 1.0, 0, 0],
  [.68, '#5884c6', '#f1ddc2', '#d1c7bb', '#ffe2b8', 2.5, .9, 0, 0],
  [.745, '#485d98', '#ff9a58', '#d79a7a', '#ff9450', 1.4, .65, .55, 0],
  [.795, '#232d5a', '#b05e70', '#5f4a66', '#c07a88', .5, .48, 1, .35],
  [.85, '#0c1230', '#252a50', '#1c2242', '#a8bcf0', .55, .55, 1, 1],
  [1, '#0a0f24', '#1c2446', '#1a2140', '#a8bcf0', .55, .55, 1, 1],
].map(k => [k[0], new THREE.Color(k[1]), new THREE.Color(k[2]), new THREE.Color(k[3]), new THREE.Color(k[4]), k[5], k[6], k[7], k[8]]);
export function sampleDay(t) {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
  const a = KEYS[i], b = KEYS[i + 1], f = (t - a[0]) / (b[0] - a[0] || 1);
  const L = (x, y) => x + (y - x) * f, LC = (x, y) => x.clone().lerp(y, f);
  return { top: LC(a[1], b[1]), bot: LC(a[2], b[2]), fog: LC(a[3], b[3]), sun: LC(a[4], b[4]), sunI: L(a[5], b[5]), hemi: L(a[6], b[6]), lan: L(a[7], b[7]), stars: L(a[8], b[8]) };
}

// ---------- 粒子：櫻花、螢火蟲、蒸氣 ----------
function petalTex() { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#ffd6e2'; g.beginPath(); g.ellipse(16, 16, 12, 7, .6, 0, 7); g.fill(); g.fillStyle = '#f7aec4'; g.beginPath(); g.ellipse(18, 15, 5, 3, .6, 0, 7); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
class Petals {
  constructor(scene, n = 700) {
    this.n = n; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { this.p[i * 3] = (Math.random() - .5) * 60; this.p[i * 3 + 1] = Math.random() * 14; this.p[i * 3 + 2] = (Math.random() - .5) * 60; this.v[i * 2] = Math.random() * 6; this.v[i * 2 + 1] = .5 + Math.random() * .6; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ map: petalTex(), size: .16, transparent: true, depthWrite: false, alphaTest: .1 }));
    this.pts.frustumCulled = false; scene.add(this.pts); this.c = new THREE.Vector3();
  }
  update(dt, t, c) {
    const p = this.p;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3; p[k + 1] -= this.v[i * 2 + 1] * dt; p[k] += (Math.sin(t * 1.3 + this.v[i * 2]) * .6 + .5) * dt; p[k + 2] += Math.cos(t + this.v[i * 2]) * .3 * dt;
      if (p[k + 1] < 0) { p[k + 1] = 10 + Math.random() * 5; p[k] = c.x + (Math.random() - .5) * 60; p[k + 2] = c.z + (Math.random() - .5) * 60; }
      if (Math.abs(p[k] - c.x) > 32) p[k] = c.x + (p[k] > c.x ? -30 : 30);
      if (Math.abs(p[k + 2] - c.z) > 32) p[k + 2] = c.z + (p[k + 2] > c.z ? -30 : 30);
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
class Fireflies {
  constructor(scene) {
    const n = 140; this.n = n; this.b = new Float32Array(n * 3); this.p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.b[i * 3] = 100 + Math.random() * 50; this.b[i * 3 + 1] = .3 + Math.random() * 2; this.b[i * 3 + 2] = (Math.random() - .5) * 70; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.m = new THREE.PointsMaterial({ map: TX.radial('ff', 'rgba(230,255,140,1)', 'rgba(200,255,100,0)'), size: .35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.pts = new THREE.Points(g, this.m); this.pts.frustumCulled = false; scene.add(this.pts);
  }
  update(t, night) {
    this.m.opacity = night; this.pts.visible = night > .02; if (!this.pts.visible) return;
    for (let i = 0; i < this.n; i++) { const k = i * 3; this.p[k] = this.b[k] + Math.sin(t * .4 + i) * 1.5; this.p[k + 1] = this.b[k + 1] + Math.sin(t * .7 + i * 3) * .5; this.p[k + 2] = this.b[k + 2] + Math.cos(t * .3 + i * 2) * 1.5; }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}
class Puffs {
  constructor(scene, n = 90) {
    this.list = []; this.em = [];
    const tex = TX.radial('puff', 'rgba(255,255,255,.55)', 'rgba(255,255,255,0)');
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); this.list.push({ s, life: 0 }); }
  }
  emitter(pos, rate, size, col, rise = .6) { this.em.push({ pos, rate, size, col: new THREE.Color(col), acc: 0, rise }); }
  update(dt, cam) {
    for (const e of this.em) {
      if (e.pos.distanceToSquared(cam) > 3600) continue;
      e.acc += dt * e.rate;
      while (e.acc > 1) { e.acc--; const q = this.list.find(q => q.life <= 0); if (!q) break; q.life = 1; q.max = 2.5 + Math.random(); q.s.position.copy(e.pos).add(new THREE.Vector3((Math.random() - .5) * .3, 0, (Math.random() - .5) * .3)); q.size = e.size; q.rise = e.rise; q.s.material.color.copy(e.col); q.s.visible = true; q.age = 0; }
    }
    for (const q of this.list) if (q.life > 0) {
      q.age += dt; const f = q.age / q.max; if (f >= 1) { q.life = 0; q.s.visible = false; continue; }
      q.s.position.y += dt * q.rise; q.s.position.x += dt * .15; const sc = q.size * (.5 + f * 1.8); q.s.scale.set(sc, sc, 1); q.s.material.opacity = Math.sin(f * PI) * .5;
    }
  }
}

// ---------- 建構世界 ----------
export function buildWorld(scene) {
  const B = new Batcher(); const rand = rng(12345);
  const W = { shops: [], seats: [], colliders: [], lanterns: [], spots: [], far: [] };
  const col = (x, z, r) => W.colliders.push({ x, z, r });
  const box = (x0, z0, x1, z1) => W.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });

  // 天空
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky); W.sky = sky;
  // 地面
  const gmat = std('grass', { map: TX.ground('g2'), color: '#a8a383' }); gmat.map = TX.ground('g2').clone(); gmat.map.repeat.set(160, 300); gmat.map.needsUpdate = true;
  const gW = new THREE.Mesh(new THREE.PlaneGeometry(912, 1600), gmat); gW.rotation.x = -PI / 2; gW.position.set(-344, 0, 0); gW.receiveShadow = true; scene.add(gW);
  const gE = new THREE.Mesh(new THREE.PlaneGeometry(662, 1600), gmat); gE.rotation.x = -PI / 2; gE.position.set(469, 0, 0); gE.receiveShadow = true; scene.add(gE);
  const dmat = std('dirt', { map: TX.ground('dirt').clone() }); dmat.map.repeat.set(26, 3); dmat.map.needsUpdate = true;
  const street = new THREE.Mesh(new THREE.PlaneGeometry(212, 18), dmat); street.rotation.x = -PI / 2; street.position.set(3, .015, 0); street.receiveShadow = true; scene.add(street);
  for (const [x, w] of [[106, 12], [160, 44]]) { const emat = new THREE.MeshStandardMaterial({ roughness: .88, map: TX.ground('dirt').clone() }); emat.map.repeat.set(w / 8, 10); emat.map.needsUpdate = true; const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 80), emat); p.rotation.x = -PI / 2; p.position.set(x, .012, 0); p.receiveShadow = true; scene.add(p); }
  const gv = std('gravel', { map: TX.gravel().clone() }); gv.map.repeat.set(14, 14); gv.map.needsUpdate = true;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(54, 52), gv); plaza.rotation.x = -PI / 2; plaza.position.set(-125, .02, 0); plaza.receiveShadow = true; scene.add(plaza);
  const sp = std('spath', { map: TX.stone().clone() }); sp.map.repeat.set(16, 1.5); sp.map.needsUpdate = true;
  const path = new THREE.Mesh(new THREE.PlaneGeometry(36, 3), sp); path.rotation.x = -PI / 2; path.position.set(-116, .03, 0); path.receiveShadow = true; scene.add(path);
  // 溝・石の縁
  for (const s of [-1, 1]) B.bake(M(boxG(206, .12, .35, 2), C.stone(), 3, .06, s * 7.05));

  // 河川
  const riv = new THREE.Mesh(new THREE.PlaneGeometry(26, 1600), waterMat); riv.rotation.x = -PI / 2; riv.position.set(125, -1.0, 0); scene.add(riv);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(26, 1600), std('bed', { color: '#2a3328' })); bed.rotation.x = -PI / 2; bed.position.set(125, -2.4, 0); scene.add(bed);
  const wallM = std('ishigaki', { map: TX.stone('ishi').clone() }); wallM.map.repeat.set(400, 1.2); wallM.map.needsUpdate = true;
  for (const x of [111.7, 138.3]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.6, 2.6, 1600), wallM); m.position.set(x, -1.2, 0); m.receiveShadow = true; scene.add(m); }

  // 日本橋（太鼓橋）
  {
    const g = new THREE.Group(); const N = 20, wd = C.wood(), wl = C.woodL();
    for (let i = 0; i < N; i++) {
      const x0 = 110 + 30 * i / N, x1 = 110 + 30 * (i + 1) / N, y0 = ARCH(x0), y1 = ARCH(x1);
      const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
      g.add(M(boxG(len + .05, .25, 5, 1), wl, (x0 + x1) / 2, (y0 + y1) / 2 - .12, 0, 0, 0, ang));
      for (const s of [-1, 1]) {
        g.add(M(boxG(.16, 1.0, .16), wd, x0, y0 + .4, s * 2.4));
        g.add(M(boxG(len + .05, .1, .14), wd, (x0 + x1) / 2, (y0 + y1) / 2 + .9, s * 2.4, 0, 0, ang));
        g.add(M(boxG(len + .05, .08, .1), wd, (x0 + x1) / 2, (y0 + y1) / 2 + .45, s * 2.4, 0, 0, ang));
      }
    }
    const brz = std('bronze', { color: '#6a7a4a', metalness: .6, roughness: .45 });
    for (const x of [110.2, 139.8]) for (const s of [-1, 1]) { g.add(M(boxG(.3, 1.3, .3), wd, x, .65, s * 2.4)); g.add(M(new THREE.SphereGeometry(.2, 10, 8), brz, x, 1.45, s * 2.4)); g.add(M(new THREE.ConeGeometry(.1, .3, 8), brz, x, 1.7, s * 2.4)); }
    for (let x = 114; x < 137; x += 4.5) for (const s of [-1, 0, 1]) g.add(M(new THREE.CylinderGeometry(.18, .18, 3.4, 8), wd, x, ARCH(x) - 1.9, s * 1.8));
    B.bake(g);
  }
  // 高札場（遊戲說明板）
  {
    const g = new THREE.Group(); g.position.set(104, 0, -9.5); g.rotation.y = PI / 2 + .35;
    g.add(M(boxG(3.6, .5, 1, 1), C.stone(), 0, .25, 0));
    for (const s of [-1, 1]) g.add(M(boxG(.2, 3, .2), C.wood(), s * 1.6, 1.5, 0));
    g.add(M(new THREE.BoxGeometry(3.4, 1.4, .08), std('kousatsu', { map: TX.text('江戸町 御触書', { w: 512, h: 210, bg: '#e9dfc4', fg: '#1a1410', vertical: false, grain: true }) }), 0, 2.2, 0));
    g.add(M(boxG(4, .14, 1.2), C.roof(), 0, 3.1, 0, .25, 0, 0));
    B.bake(g); W.spots.push({ type: 'board', x: 104, z: -8.5, label: '📜 看御觸書（遊戲說明）' }); col(104, -9.5, 1.6);
  }

  // 店鋪
  for (const def of SHOPS) {
    const { g, info } = shopHouse(def, rand);
    g.position.set(def.x, 0, def.side * STREET.front); g.rotation.y = def.side > 0 ? PI : 0; g.updateMatrixWorld(true);
    const tw = v => new THREE.Vector3(v.lx ?? v.x, v.ly ?? v.y, v.lz ?? v.z).applyMatrix4(g.matrixWorld);
    const rot = g.rotation.y;
    const shop = { def, rot, front: tw({ x: 0, y: 0, z: 1.1 }), owner: { ...tw(info.owner), r: rot + info.owner.face }, seats: [], lanterns: info.lanterns.map(tw) };
    info.seats.forEach((s, i) => { const p = tw(s), d = tw({ x: s.dlx, y: s.dly, z: s.dlz }); const seat = { x: p.x, y: p.y, z: p.z, r: rot + s.face, shop: def.id, i, dish: d, kind: 'shop' }; shop.seats.push(seat); W.seats.push(seat); });
    if (info.steam) shop.steam = tw(info.steam);
    if (info.chimney) shop.chimney = tw(info.chimney);
    W.lanterns.push(...shop.lanterns);
    if (def.umbrella) { const u = tw({ x: 0, y: 0, z: 3.3 }); col(u.x, u.z, .2); }
    B.bake(g); W.shops.push(shop);
  }
  // 填空民家
  for (const side of [-1, 1]) {
    const occ = SHOPS.filter(s => s.side === side).map(s => [s.x - s.w / 2, s.x + s.w / 2]).sort((a, b) => a[0] - b[0]);
    let x = -98; const ends = [...occ, [101, 101]];
    for (const [a, b] of ends) {
      while (a - x > 1.2) {
        let w = Math.min(a - x - .2, 6 + rand() * 5); if (a - x - .2 - w < 4.5) w = a - x - .2;
        const kura = rand() < .15;
        const { g, info } = house({ w, d: 8 + rand() * 2, floors: rand() < .6 ? 2 : 1, wall: kura ? '#f4f2ea' : ['#e8e0cc', '#ded2b8', '#e9e4d6', '#d6c7a8'][Math.floor(rand() * 4)], rand, udatsu: false });
        g.position.set(x + .1 + w / 2, 0, side * STREET.front); g.rotation.y = side > 0 ? PI : 0;
        if (rand() < .3) { const lx = (rand() - .5) * (w - 2); const m = M(LANTERN_G, lanternMat(['御', '宿', '酒', '茶'][Math.floor(rand() * 4)], '#e8dcc0'), lx, 1.95, .3); g.add(m); g.updateMatrixWorld(true); W.lanterns.push(new THREE.Vector3(lx, 2.2, .3).applyMatrix4(g.matrixWorld)); }
        if (rand() < .35) { // 天水桶
          const bx = (rand() - .5) * (w - 1.5), bz = 1.0; const bm = std('oke', { color: '#5a4030', map: TX.wood('oke', '#5a4030') });
          g.add(M(new THREE.CylinderGeometry(.42, .38, .8, 12), bm, bx, .4, bz)); g.add(M(new THREE.CylinderGeometry(.32, .3, .5, 12), bm, bx, 1.05, bz)); g.add(M(new THREE.CylinderGeometry(.22, .2, .4, 10), bm, bx, 1.5, bz));
          g.updateMatrixWorld(true); const p = new THREE.Vector3(bx, 0, bz).applyMatrix4(g.matrixWorld); col(p.x, p.z, .45);
        }
        B.bake(g); x += w + .2;
      }
      x = Math.max(x, b + .2);
    }
  }
  // 屋台小車、井戶
  {
    const g = new THREE.Group(); g.position.set(-8, 0, 3.8); g.rotation.y = .3; const wd = C.wood();
    g.add(M(boxG(2.2, .12, 1.1), wd, 0, .55, 0)); for (const s of [-1, 1]) g.add(M(new THREE.TorusGeometry(.5, .06, 6, 16), wd, -.4, .5, s * .62)); g.add(M(boxG(1.6, .1, .1), wd, 1.9, .55, .4)); g.add(M(boxG(1.6, .1, .1), wd, 1.9, .55, -.4));
    g.add(M(boxG(.6, .5, .5), std('it#e8e0d0', { color: '#e8e0d0' }), -.3, .85, 0)); g.add(M(boxG(.5, .4, .4), std('it#7a3b2a', { color: '#7a3b2a' }), .4, .8, .1));
    B.bake(g); col(-8, 3.8, 1.3);
    const w = new THREE.Group(); w.position.set(30, 0, -3.5); const st = C.stone();
    w.add(M(new THREE.CylinderGeometry(.8, .85, .8, 16, 1, true), st, 0, .4, 0)); w.add(M(new THREE.CylinderGeometry(.7, .7, .05, 16), std('wellw', { color: '#1d2a2a' }), 0, .5, 0));
    for (const s of [-1, 1]) w.add(M(boxG(.14, 2.2, .14), C.wood(), s * .9, 1.1, 0)); w.add(M(boxG(2, .14, .14), C.wood(), 0, 2.15, 0)); w.add(M(boxG(2.2, .1, 1.4), C.roof(), 0, 2.45, 0, .0, 0, 0));
    w.add(M(new THREE.CylinderGeometry(.18, .15, .3, 10), std('oke', { color: '#5a4030' }), .5, .95, .3));
    B.bake(w); col(30, -3.5, 1.0); W.spots.push({ type: 'well', x: 30, z: -2.3, label: '🪣 打水（井戶）' });
  }
  // 火の見櫓
  {
    const g = new THREE.Group(); g.position.set(8, 0, -26); const wd = C.wood();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(M(boxG(.3, 15, .3), wd, sx * 1.3, 7.5, sz * 1.3, sz * .03, 0, -sx * .03));
    for (let y = 2; y < 14; y += 3) for (const r of [0, PI / 2]) { const b = M(boxG(2.8, .14, .14), wd, 0, y, 0); b.rotation.y = r; b.position.x = r ? 1.25 : 0; b.position.z = r ? 0 : 1.25; g.add(b); const b2 = b.clone(); b2.position.x *= -1; b2.position.z *= -1; g.add(b2); }
    g.add(M(boxG(3.4, .2, 3.4), wd, 0, 13.4, 0)); g.add(M(new THREE.ConeGeometry(2.6, 1.4, 4), C.roof(), 0, 15.6, 0, 0, PI / 4, 0));
    g.add(M(new THREE.CylinderGeometry(.25, .35, .6, 10), std('bronze', { color: '#6a7a4a', metalness: .6, roughness: .45 }), 0, 14.4, 0));
    B.bake(g);
  }

  // 神社
  {
    const vm = C.red();
    const torii = (x, s) => { const g = new THREE.Group(); g.position.set(x, 0, 0); g.scale.setScalar(s);
      for (const z of [-2.4, 2.4]) { g.add(M(new THREE.CylinderGeometry(.24, .28, 5.6, 14), vm, 0, 2.8, z)); g.add(M(new THREE.CylinderGeometry(.34, .34, .35, 14), C.black(), 0, .17, z)); }
      g.add(M(boxG(.5, .3, 7, 1), vm, 0, 5.55, 0)); g.add(M(boxG(.6, .22, 7.6, 1), C.black(), 0, 5.8, 0)); g.add(M(boxG(.32, .3, 5.8, 1), vm, 0, 4.7, 0)); g.add(M(boxG(.3, .9, .3), vm, 0, 5.1, 0));
      B.bake(g); col(x, -2.4 * s, .4); col(x, 2.4 * s, .4); };
    torii(-100, 1.1); torii(-112, .85);
    for (const x of [-106, -118, -124]) for (const z of [-3.4, 3.4]) { W.lanterns.push(toro(B, x, z)); col(x, z, .5); }
    const { g, info } = house({ w: 11, d: 9, floors: 1, wall: '#efe7d4', red: true, copper: true, rand, shop: { id: 'shrine' } });
    g.position.set(-131, .5, 0); g.rotation.y = PI / 2;
    g.add(M(boxG(13, .5, 11, 1), C.stone(), 0, -.25, -4.5));
    g.add(M(boxG(2.4, .9, .9), C.woodD(), 0, .85, .5)); // 賽錢箱
    { const sm = M(new THREE.TorusGeometry(4.5, .16, 8, 30, PI), std('rope2', { color: '#d8c890' }), 0, 3.0, .25, 0, 0, PI); sm.scale.set(1, .1, 1); g.add(sm); }
    for (let i = 0; i < 4; i++) g.add(M(boxG(.08, .5, .02), std('shide', { color: '#fff' }), -2.4 + i * 1.6, 2.4, .25));
    g.add(M(new THREE.SphereGeometry(.22, 12, 10), std('bronze', { color: '#c9a24a', metalness: .8, roughness: .3 }), 0, 2.7, .6));
    g.add(M(new THREE.CylinderGeometry(.04, .04, 1.6, 6), std('rope3', { color: '#c8392b' }), 0, 1.75, .6));
    B.bake(g); box(-142, -6.5, -129.8, 6.5); box(-142, -6.5, -129.8, 6.5);
    W.spots.push({ type: 'pray', x: -128.6, z: 0, label: '🙏 參拜（投香油錢）' });
    for (const [x, z] of [[-104, 8], [-104, -8], [-116, 9], [-116, -9], [-128, 11], [-128, -11], [-138, 12], [-138, -12], [-96, 12], [-95, -14]]) { sakura(B, x, z, 1 + rand() * .3, rand); col(x, z, .45); }
    pine(B, -142, 16, 1.4, rand); pine(B, -144, -17, 1.3, rand); pine(B, -120, 18, 1.2, rand); pine(B, -120, -18, 1.1, rand);
    // 神木
    const gk = new THREE.Group(); gk.position.set(-112, 0, -15);
    gk.add(M(new THREE.CylinderGeometry(.9, 1.3, 7, 12), C.bark(), 0, 3.5, 0)); gk.add(M(new THREE.TorusGeometry(1.15, .1, 6, 24), std('rope2', { color: '#d8c890' }), 0, 2.4, 0, PI / 2, 0, 0));
    for (let i = 0; i < 10; i++) { const m = M(new THREE.IcosahedronGeometry(2.4, 1), C.leaf(), (rand() - .5) * 6, 7.5 + rand() * 3, (rand() - .5) * 6); gk.add(m); }
    B.bake(gk); col(-112, -15, 1.4);
    // 玉垣（圍欄）
    for (const z of [-24, 24]) for (let x = -148; x < -100; x += 2) B.bake(M(boxG(.15, 1, .15), C.stone(), x, .5, z));
    for (const z of [-24, 24]) B.bake(M(boxG(48, .15, .12), C.stone(), -124, .95, z));
  }

  // 河岸：柳樹、長椅
  for (let z = -36; z <= 36; z += 9) if (Math.abs(z) > 4) { willow(B, 109.5, z + rand() * 2, 1, rand); col(109.5, z, .4); willow(B, 140.5, z + 3 + rand() * 2, 1, rand); col(140.5, z + 3, .4); }
  const bench = (x, z, r) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; g.add(M(boxG(2.2, .08, .7), C.felt(), 0, .46, 0)); g.add(M(boxG(2.2, .38, .6), C.wood(), 0, .21, 0)); B.bake(g);
    for (const q of [-.55, .55]) { const p = new THREE.Vector3(q, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), r); W.seats.push({ x: x + p.x, y: .5, z: z + p.z, r, kind: 'view', dish: new THREE.Vector3(x - p.x, .55, z - p.z) }); }
  };
  bench(107.5, -14, PI / 2); bench(107.5, 14, PI / 2); bench(107.5, -26, PI / 2); bench(142.5, -20, -PI / 2); bench(-110, 15, PI); bench(-110, -15 + 4, 0);
  sakura(B, 106, 22, 1.2, rand); sakura(B, 106, -20, 1.1, rand); sakura(B, 146, 26, 1.2, rand);

  // 對岸：露天風呂
  {
    const cx = 160, cz = 14; const g = new THREE.Group(); g.position.set(cx, 0, cz);
    const rk = std('rock', { color: '#6d6a62', roughness: 1, flatShading: true });
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; const m = M(new THREE.DodecahedronGeometry(.7 + rand() * .3, 0), rk, Math.cos(a) * 3.6, .25, Math.sin(a) * 3.6, rand(), rand(), rand()); m.scale.y = .7; g.add(m); }
    g.add(M(new THREE.CylinderGeometry(3.4, 3.4, .1, 32), std('onsen', { color: '#7fb8b4', roughness: .1, metalness: .1, transparent: true, opacity: .85 }), 0, .2, 0));
    g.add(M(new THREE.CylinderGeometry(3.4, 3.4, .5, 32, 1, true), rk, 0, -.1, 0));
    for (let i = 0; i < 7; i++) g.add(M(boxG(1.7, 2.2, .12), C.lat(), -4.9, 1.1, -5.4 + i * 1.75, 0, PI / 2, 0));
    g.add(M(boxG(3, .12, 3), C.roof(), -3.2, 2.8, -4, .2, 0, 0)); for (const s of [-1, 1]) for (const t of [-1, 1]) g.add(M(boxG(.15, 2.8, .15), C.wood(), -3.2 + s * 1.3, 1.4, -4 + t * 1.3));
    B.bake(g); col(cx, cz, 4.1);
    W.bath = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + .2; W.bath.push({ x: cx + Math.cos(a) * 2.6, y: -.35, z: cz + Math.sin(a) * 2.6, r: Math.atan2(-Math.cos(a), -Math.sin(a)), kind: 'bath' }); }
    W.bathSteam = new THREE.Vector3(cx, .4, cz);
    // 湯屋後方小屋
    for (const [x, z, w] of [[168, -12, 9], [170, -26, 8], [150, -30, 10]]) { const { g: h } = house({ w, d: 7, floors: rand() < .5 ? 2 : 1, wall: '#e3d9c3', rand }); h.position.set(x, 0, z); h.rotation.y = -PI / 2; B.bake(h); box(x - 0, z - w / 2, x + 7.5, z + w / 2); }
  }

  // 背景街區（instanced）
  {
    const n = 900; const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std('bgw', { color: '#d9cfb8' }), n);
    const sh = new THREE.Shape(); sh.moveTo(-.5, 0); sh.lineTo(.5, 0); sh.lineTo(0, .45); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); rg.translate(0, 0, -.5); rg.rotateY(PI / 2);
    const roofs = new THREE.InstancedMesh(rg, std('bgr', { color: '#4c535d', roughness: .7 }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let k = 0;
    for (let gx = -260; gx < 260 && k < n; gx += 11) for (let gz = -170; gz < 170 && k < n; gz += 10) {
      if (Math.abs(gz) < 19) continue; if (gx > 102 && gx < 148) continue; if (gx < -96 && gx > -152 && Math.abs(gz) < 30) continue;
      if (gx > 140 && gx < 190 && Math.abs(gz) < 34) continue; if (Math.abs(gx - 8) < 6 && Math.abs(gz + 26) < 6) continue;
      if (rand() < .1) continue;
      const w = 6 + rand() * 4, d = 6 + rand() * 3, h = 2.8 + (rand() < .4 ? 2.4 : 0);
      const x = gx + (rand() - .5) * 3, z = gz + (rand() - .5) * 2, ry = rand() < .5 ? 0 : PI / 2;
      e.set(0, ry, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(w, h, d)); walls.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(x, h, z), q, new THREE.Vector3(w + 1, d * .9, d + 1)); roofs.setMatrixAt(k, m4); k++;
    }
    walls.count = roofs.count = k; walls.castShadow = roofs.castShadow = true; walls.receiveShadow = roofs.receiveShadow = true;
    scene.add(walls, roofs);
    for (let i = 0; i < 70; i++) { const x = -250 + rand() * 500, z = (rand() < .5 ? -1 : 1) * (25 + rand() * 140); if (x > 100 && x < 150) continue; (rand() < .5 ? pine : sakura)(B, x, z, 1 + rand() * .6, rand); }
  }

  // 遠景：富士山、江戶城、群山
  {
    const fogless = (c) => { const m = new THREE.MeshLambertMaterial({ color: c, fog: false }); m.userData.base = new THREE.Color(c); W.far.push(m); return m; };
    const pts = []; for (let i = 0; i <= 20; i++) { const y = i / 20 * .96; const r = 1 - Math.pow(y, .75); pts.push(new THREE.Vector2(r * 900, y * 520)); } pts.push(new THREE.Vector2(0, .955 * 520));
    const fg = new THREE.LatheGeometry(pts, 48); const cols = []; const pos = fg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 520; const ang = Math.atan2(pos.getZ(i), pos.getX(i)); const snow = y > .62 + Math.sin(ang * 9) * .06 ? 1 : 0; const c = snow ? new THREE.Color('#f4f6fb') : new THREE.Color('#5a6c8c'); cols.push(c.r, c.g, c.b); }
    fg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const fm = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }); fm.userData.base = new THREE.Color('#ffffff'); W.far.push(fm);
    const fuji = new THREE.Mesh(fg, fm); fuji.position.set(-2300, -40, -420); scene.add(fuji);
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, r = 1300 + rand() * 200; if (Math.abs(a - 3.4) < .35) continue; const m = new THREE.Mesh(new THREE.ConeGeometry(300 + rand() * 300, 90 + rand() * 120, 7), fogless('#4f6278')); m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.scale.z = .5 + rand() * .5; scene.add(m); }
    // 江戶城
    const cg = new THREE.Group(); cg.position.set(260, 0, -560);
    const wm = fogless('#e9e6dc'), rm = fogless('#3d4a52'), sm = fogless('#7d7a70'), gm = fogless('#caa44a');
    const base = new THREE.Mesh(new THREE.CylinderGeometry(52, 70, 22, 4), sm); base.rotation.y = PI / 4; base.position.y = 11; cg.add(base);
    let y = 22; for (let i = 0; i < 5; i++) { const s = 40 - i * 7; const b = new THREE.Mesh(new THREE.BoxGeometry(s, 9, s * .8), wm); b.position.y = y + 4.5; cg.add(b); const r = new THREE.Mesh(new THREE.ConeGeometry(s * .85, 6, 4), rm); r.rotation.y = PI / 4; r.scale.z = .8; r.position.y = y + 11; cg.add(r); y += 11; }
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 6), gm); sh.position.set(s * 6, y + 2, 0); cg.add(sh); }
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.BoxGeometry(160, 8, 3), wm); t.position.set(s * 0, 4, s * 70); cg.add(t); }
    scene.add(cg);
  }

  B.finish(scene);

  // 河上小舟（動態）
  {
    const g = new THREE.Group(); const wd = C.woodL();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, .5, 6), wd); hull.position.y = .1; g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(.7, 1.6, 4), wd); bow.rotation.set(PI / 2, PI / 4, 0); bow.position.set(0, .1, 3.7); bow.scale.set(1, 1, .4); g.add(bow);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 4.5, 4), C.wood()); pole.position.set(.4, 1.2, -2.2); pole.rotation.x = .5; g.add(pole);
    g.traverse(o => o.castShadow = true); scene.add(g); W.boat = g;
  }

  const sun = new THREE.DirectionalLight('#fff', 2.5); sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -45; sun.shadow.camera.right = sun.shadow.camera.top = 45; sun.shadow.camera.near = 1; sun.shadow.camera.far = 220; sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#7a6a50', 1); scene.add(hemi);
  scene.fog = new THREE.FogExp2('#c0d0dc', .006);
  const pool = []; for (let i = 0; i < 8; i++) { const l = new THREE.PointLight('#ffb070', 0, 13, 1.7); scene.add(l); pool.push(l); }
  const petals = new Petals(scene), ff = new Fireflies(scene), puffs = new Puffs(scene);
  for (const s of W.shops) { if (s.steam) puffs.emitter(s.steam, s.def.smoke ? 3 : 1.4, s.def.smoke ? 1.4 : .9, s.def.smoke ? '#9a9088' : '#ffffff'); if (s.chimney) puffs.emitter(s.chimney, 1, 2.6, '#a8a098', 1.2); }
  puffs.emitter(W.bathSteam, 5, 3, '#ffffff', .5);

  let lt = 0; const sunDir = new THREE.Vector3(); const tmp = new THREE.Vector3();
  W.update = (dt, time, tday, focus, camPos, quality) => {
    const D = sampleDay(tday);
    const th = (tday - .25) * PI * 2; sunDir.set(Math.cos(th) * .85, Math.sin(th), .42).normalize();
    skyMat.uniforms.uTop.value.copy(D.top); skyMat.uniforms.uBot.value.copy(D.bot); skyMat.uniforms.uSunDir.value.copy(sunDir); skyMat.uniforms.uSunCol.value.copy(D.sun); skyMat.uniforms.uStars.value = D.stars; skyMat.uniforms.uTime.value = time;
    sky.position.copy(camPos);
    const ld = sunDir.y > -.02 ? sunDir : tmp.copy(sunDir).negate();
    sun.position.copy(focus).addScaledVector(ld, 100); sun.target.position.copy(focus); sun.color.copy(D.sun); sun.intensity = D.sunI * (sunDir.y > -.02 ? Math.min(1, sunDir.y * 6 + .3) : .9);
    hemi.intensity = D.hemi; hemi.color.copy(D.top).lerp(new THREE.Color('#ffffff'), .5); hemi.groundColor.set('#6a5a44').multiplyScalar(.6 + D.hemi * .4);
    scene.fog.color.copy(D.fog); scene.fog.density = .0045 + D.lan * .0035;
    waterMat.uniforms.uTime.value = time; waterMat.uniforms.uSky.value.copy(D.bot).lerp(D.top, .3); waterMat.uniforms.uSunDir.value.copy(sunDir); waterMat.uniforms.uSunCol.value.copy(D.sun); waterMat.uniforms.uFog.value.copy(D.fog); waterMat.uniforms.uFogD.value = scene.fog.density; waterMat.uniforms.uGlow.value = D.lan;
    waterMat.uniforms.uDeep.value.set('#1d3b3a').multiplyScalar(.35 + .65 * (1 - D.lan));
    for (const m of GLOW) m.emissiveIntensity = D.lan * m.userData.k;
    for (const m of W.far) { m.color.copy(m.userData.base).lerp(D.fog, .62); }
    W.night = D.lan; W.D = D;
    // 燈籠點光源：每 0.4 秒挑最近的
    lt -= dt; if (lt < 0) { lt = .4; const near = W.lanterns.map(p => [p, p.distanceToSquared(focus)]).sort((a, b) => a[1] - b[1]).slice(0, pool.length); pool.forEach((l, i) => { if (near[i]) l.position.copy(near[i][0]).add(new THREE.Vector3(0, -.2, 0)); }); }
    pool.forEach((l, i) => l.intensity = D.lan * (quality > 0 ? 28 : 0) * (1 + Math.sin(time * 9 + i * 3) * .04));
    petals.update(dt, time, focus); ff.update(time, D.lan); puffs.update(dt, camPos);
    // 小舟
    const bz = ((time * 1.6) % 360) - 180; W.boat.position.set(122 + Math.sin(time * .05) * 2, -.95 + Math.sin(time * 1.5) * .04, bz); W.boat.rotation.z = Math.sin(time * 1.2) * .03;
  };
  return W;
}

// 可走區域
export function walkable(x, z) {
  if (x > -100 && x < 106 && Math.abs(z) < 6.9) return true;
  if (x >= -150 && x <= -98 && Math.abs(z) < 23.5) return x > -129.6 || Math.abs(z) > 7.5 || true;
  if (x >= 103 && x <= 111.6 && Math.abs(z) < 40) return true;
  if (x >= 110 && x <= 140 && Math.abs(z) < 2.15) return true;
  if (x >= 138.4 && x <= 185 && Math.abs(z) < 40) return true;
  return false;
}
export function heightAt(x, z) { return (x > 110 && x < 140 && Math.abs(z) < 2.6) ? ARCH(x) : 0; }
