// 江戶人物（程式建模）：和服、髮型、配件、動作
import * as THREE from 'three';
import * as TX from './tex.js';

export const KIMONO = [
  ['藍', '#2a4b7c'], ['紅梅', '#c24a62'], ['若竹', '#5c9a68'], ['墨', '#2f2e35'], ['山吹', '#dba23a'],
  ['桜', '#e7b3c0'], ['茶', '#7a5236'], ['江戸紫', '#6a4a8a'], ['浅葱', '#3f97ad'], ['白鼠', '#c9c4ba']
];
export const OBI = ['#8a2f2f', '#2b2b2b', '#c9a24a', '#e8e2d2', '#355d8a', '#6b3f6b'];
export const PATTERNS = ['無地', '縞', '水玉', '市松', '麻の葉', '桜'];
export const HAIRS = ['丁髷', '島田髷', '総髪', '坊主', '唐輪'];
export const HATS = ['なし', '菅笠', '簪', '鉢巻', '狐面'];
export const WAIST = ['なし', '印籠', '巾着'];
export const CARRY = ['なし', '扇子', '番傘'];
export const SKINS = ['#f1d2b6', '#e6bf9c', '#d6a77e'];

export function randomLook(r = Math.random) {
  const pick = n => Math.floor(r() * n);
  return { k: pick(KIMONO.length), p: pick(4), o: pick(OBI.length), h: pick(HAIRS.length), s: pick(3), hat: r() < .15 ? 1 : 0, c: r() < .1 ? pick(3) : 0 };
}

const G = {
  body: (() => {
    const pts = [[0, .28], [.21, .28], [.205, .5], [.18, .75], [.2, .98], [.18, 1.1], [.1, 1.17], [0, 1.18]].map(p => new THREE.Vector2(p[0], p[1]));
    return new THREE.LatheGeometry(pts, 16);
  })(),
  obi: new THREE.CylinderGeometry(.205, .205, .15, 16),
  bow: new THREE.BoxGeometry(.22, .12, .08),
  leg: new THREE.CylinderGeometry(.055, .05, .3, 8),
  geta: new THREE.BoxGeometry(.1, .05, .2),
  sleeve: new THREE.CylinderGeometry(.075, .1, .36, 12),
  hand: new THREE.SphereGeometry(.045, 8, 6),
  head: new THREE.SphereGeometry(.135, 18, 14),
  eye: new THREE.SphereGeometry(.017, 8, 6),
  cheek: new THREE.CircleGeometry(.024, 12),
  mouth: new THREE.BoxGeometry(.03, .008, .01),
  collar: new THREE.BoxGeometry(.035, .22, .02),
  knot: new THREE.CylinderGeometry(.025, .03, .16, 8),
  bun: new THREE.SphereGeometry(.09, 12, 8),
  hatG: new THREE.ConeGeometry(.34, .16, 20, 1, true),
  pin: new THREE.CylinderGeometry(.008, .008, .2, 4),
  fan: new THREE.CircleGeometry(.16, 12, 0, Math.PI * .8),
  umb: new THREE.ConeGeometry(.55, .25, 16, 1, true),
  stick: new THREE.CylinderGeometry(.012, .012, .9, 4),
};
const M = {};
function mat(c, o = {}) { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o })); }
const hairMat = mat('#16120f', { roughness: .5 });

export class Chara {
  constructor(look, name = '') {
    this.root = new THREE.Group();
    this.upper = new THREE.Group(); this.upper.position.y = .5; this.root.add(this.upper);
    this.phase = Math.random() * 6; this.anim = 0; this.t = 0;
    this.legs = [];
    for (const s of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(s * .08, .5, 0);
      const l = new THREE.Mesh(G.leg, mat('#f1d2b6')); l.position.y = -.25; lg.add(l);
      const g = new THREE.Mesh(G.geta, mat('#6b4a2e')); g.position.set(0, -.44, .03); lg.add(g);
      this.root.add(lg); this.legs.push(lg); this.legSkin = this.legSkin || []; this.legSkin.push(l);
    }
    this.bodyM = new THREE.Mesh(G.body); this.bodyM.position.y = -.5; this.bodyM.castShadow = true; this.upper.add(this.bodyM);
    this.obiM = new THREE.Mesh(G.obi); this.obiM.position.y = .33; this.upper.add(this.obiM);
    this.bowM = new THREE.Mesh(G.bow); this.bowM.position.set(0, .33, -.21); this.upper.add(this.bowM);
    for (const s of [-1, 1]) { const c = new THREE.Mesh(G.collar, mat('#f4efe4')); c.position.set(s * .05, .52, .175); c.rotation.set(-.25, 0, s * .45); this.upper.add(c); }
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * .22, .58, 0);
      const sl = new THREE.Mesh(G.sleeve); sl.position.y = -.16; sl.scale.z = 1.55; sl.castShadow = true; a.add(sl);
      const h = new THREE.Mesh(G.hand); h.position.set(0, -.34, .05); a.add(h);
      a.userData.sl = sl; a.userData.h = h;
      this.upper.add(a); this.arms.push(a);
    }
    this.headG = new THREE.Group(); this.headG.position.y = .83; this.upper.add(this.headG);
    this.headM = new THREE.Mesh(G.head); this.headM.castShadow = true; this.headG.add(this.headM);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(G.eye, mat('#111')); e.position.set(s * .048, .01, .123); this.headG.add(e); const c = new THREE.Mesh(G.cheek, mat('#f08a8a', { transparent: true, opacity: .45 })); c.position.set(s * .078, -.035, .114); c.rotation.y = s * .55; this.headG.add(c); }
    { const m = new THREE.Mesh(G.mouth, mat('#7a3a2a')); m.position.set(0, -.055, .13); this.headG.add(m); }
    this.hairG = new THREE.Group(); this.headG.add(this.hairG);
    this.accG = new THREE.Group(); this.headG.add(this.accG);
    this.carryG = new THREE.Group(); this.arms[1].add(this.carryG);
    this.foodG = new THREE.Group(); this.foodG.position.set(0, -.4, .1); this.arms[0].add(this.foodG);
    this.waistG = new THREE.Group(); this.waistG.position.y = .33; this.upper.add(this.waistG);
    this.setLook(look);
    this.name = name; if (name) this.setName(name);
  }
  setLook(lk) {
    lk = Object.assign({ k: 0, p: 0, o: 0, h: 0, s: 0, hat: 0, c: 0, w: 0, f: '' }, lk || {});
    this.look = lk;
    const kc = KIMONO[lk.k % KIMONO.length][1];
    const km = lk.p ? new THREE.MeshStandardMaterial({ map: TX.pattern(lk.p, kc, lk.k === 9 ? '#5a5a66' : '#f4efe2'), roughness: .9 }) : mat(kc, { roughness: .9 });
    this.bodyM.material = km; this.arms.forEach(a => { a.userData.sl.material = km; a.userData.h.material = mat(SKINS[lk.s % 3]); });
    this.obiM.material = this.bowM.material = mat(OBI[lk.o % OBI.length]);
    this.headM.material = mat(SKINS[lk.s % 3]); this.legSkin.forEach(l => l.material = mat(SKINS[lk.s % 3]));
    this.hairG.clear(); this.accG.clear(); this.carryG.clear(); this.foodG.clear(); this.waistG.clear();
    const H = (g, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(g, hairMat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; this.hairG.add(m); return m; };
    const capTop = new THREE.SphereGeometry(.142, 18, 6, 0, Math.PI * 2, 0, Math.PI * .34);
    const capBack = new THREE.SphereGeometry(.142, 18, 8, Math.PI / 2 + .95, Math.PI * 2 - 1.9, Math.PI * .33, Math.PI * .3);
    const HC = (x, y, z, sx, sy, sz) => { H(capTop, x, y, z, sx, sy, sz); H(capBack, x, y, z, sx, sy, sz); };
    switch (lk.h % HAIRS.length) {
      case 0: { // 丁髷：月代＋前に折る髷
        const side = new THREE.Mesh(new THREE.SphereGeometry(.143, 18, 10, Math.PI / 2 + .95, Math.PI * 2 - 1.9, Math.PI * .3, Math.PI * .32), hairMat); this.hairG.add(side);
        const k = H(G.knot, 0, .15, -.02); k.rotation.x = Math.PI / 2 - .3; break;
      }
      case 1: { HC(0, .01, -.01, 1.05, 1.05, 1.08); H(G.bun, 0, .17, -.03, 1.3, .8, 1); H(G.bun, 0, .05, -.15, 1, .8, .8); break; }
      case 2: { HC(0, 0, -.01, 1.04, 1.1, 1.1); const k = H(G.knot, 0, .02, -.17); k.rotation.x = .5; k.scale.set(1.5, 1.5, 1.5); break; }
      case 3: break;
      case 4: { HC(0, .01, -.01, 1.05, 1.05, 1.08); H(G.bun, -.11, .14, -.02, .8, .8, .8); H(G.bun, .11, .14, -.02, .8, .8, .8); break; }
    }
    if (lk.hat === 1) { const h = new THREE.Mesh(G.hatG, mat('#c9a868', { side: THREE.DoubleSide })); h.position.y = .2; h.castShadow = true; this.accG.add(h); }
    if (lk.hat === 2) { for (const s of [-1, 1]) { const p = new THREE.Mesh(G.pin, mat('#d8b24a', { metalness: .6, roughness: .3 })); p.position.set(s * .06, .2, -.06); p.rotation.z = s * 1.2; this.accG.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), mat('#d23c4c')); b.position.set(s * .15, .24, -.06); this.accG.add(b); } }
    if (lk.hat === 3) { const b = new THREE.Mesh(new THREE.TorusGeometry(.142, .022, 6, 24), mat('#f4efe4')); b.rotation.x = Math.PI / 2 - .15; b.position.y = .05; this.accG.add(b); const k = new THREE.Mesh(new THREE.BoxGeometry(.07, .05, .05), mat('#f4efe4')); k.position.set(0, .07, -.15); this.accG.add(k); }
    if (lk.hat === 4) { const f = new THREE.Group(); const face = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f7f3ea')); face.rotation.x = Math.PI / 2; f.add(face);
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(.03, .08, 4), mat('#f7f3ea')); ear.position.set(s * .055, .09, 0); f.add(ear); const ey = new THREE.Mesh(new THREE.BoxGeometry(.035, .008, .01), mat('#c8322a')); ey.position.set(s * .04, .02, .09); ey.rotation.z = s * .4; f.add(ey); }
      const no = new THREE.Mesh(new THREE.SphereGeometry(.012, 6, 4), mat('#c8322a')); no.position.set(0, -.02, .1); f.add(no);
      f.position.set(.11, .04, .06); f.rotation.y = .9; this.accG.add(f); }
    if (lk.w === 1) { const g = new THREE.Mesh(new THREE.BoxGeometry(.07, .1, .04), mat('#1a1414', { roughness: .3, metalness: .2 })); g.position.set(.17, -.08, .1); this.waistG.add(g); const c = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .1, 4), mat('#c9a24a')); c.position.set(.17, .0, .1); this.waistG.add(c); const n = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), mat('#c9a24a', { metalness: .6 })); n.position.set(.17, .05, .11); this.waistG.add(n); }
    if (lk.w === 2) { const g = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), mat('#b8352f')); g.scale.y = 1.2; g.position.set(-.17, -.09, .1); this.waistG.add(g); const t = new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .03, 8), mat('#c9a24a')); t.position.set(-.17, -.02, .1); this.waistG.add(t); }
    if (lk.f && Chara.foodModel) { const d = Chara.foodModel(lk.f); if (d) { d.scale.setScalar(1.25); d.rotation.x = -.2; this.foodG.add(d); } }
    if (lk.c === 1) { const f = new THREE.Mesh(G.fan, mat('#f2e6c8', { side: THREE.DoubleSide })); f.position.set(0, -.38, .1); f.rotation.set(-1.2, 0, .6); this.carryG.add(f); }
    if (lk.c === 2) { const s = new THREE.Mesh(G.stick, mat('#4a3424')); s.position.set(0, .05, .08); this.carryG.add(s); const u = new THREE.Mesh(G.umb, mat('#b8352f', { side: THREE.DoubleSide })); u.position.set(0, .55, .08); u.castShadow = true; this.carryG.add(u); }
  }
  setName(n, npc) {
    if (this.tag) { this.root.remove(this.tag); this.tag.material.map.dispose(); }
    this.name = n;
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = `600 30px ${TX.FONT}`; const w = Math.min(250, g.measureText(n).width + 28);
    g.fillStyle = this.gm ? 'rgba(150,40,30,.85)' : npc ? 'rgba(60,70,50,.42)' : 'rgba(20,16,12,.55)'; rr(g, 128 - w / 2, 10, w, 44, 14); g.fill(); if (this.gm) { g.strokeStyle = '#f3cf6a'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = this.gm ? '#ffe08a' : npc ? '#e8ecdc' : '#fff6e0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8d8d8, map: t, depthWrite: false, transparent: true }));
    this.tag.scale.set(1.2, .3, 1); this.tag.position.y = 1.95; this.tag.renderOrder = 10; this.root.add(this.tag);
  }
  say(s, dur = 6) {
    if (this.bub) { this.root.remove(this.bub); this.bub.material.map.dispose(); }
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    g.font = `500 34px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
    const lines = wrap(g, s, 440).slice(0, 3);
    const w = Math.max(...lines.map(l => g.measureText(l).width)) + 40, h = lines.length * 42 + 26;
    g.fillStyle = 'rgba(255,250,238,.95)'; g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 3;
    rr(g, 256 - w / 2, 150 - h - 14, w, h, 18); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(244, 136); g.lineTo(256, 152); g.lineTo(268, 136); g.fill();
    g.fillStyle = '#2a1d12'; g.textAlign = 'center'; g.textBaseline = 'top';
    lines.forEach((l, i) => g.fillText(l, 256, 150 - h - 14 + 14 + i * 42));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.bub = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8d8d8, map: t, depthWrite: false, transparent: true }));
    this.bub.scale.set(2.6, .81, 1); this.bub.position.y = 2.5; this.bub.renderOrder = 11; this.root.add(this.bub);
    this.bubT = dur;
  }
  // anim: 0站 1走 2跑 3坐 4做菜 5吃 6鞠躬 7揮手 8泡湯 9拍手 10跳舞 11萬歲 12坐地 13指路 14大笑
  update(dt, speed) {
    this.t += dt;
    if (this.bub) { this.bubT -= dt; if (this.bubT < 0) { this.root.remove(this.bub); this.bub.material.map.dispose(); this.bub = null; } }
    if (this.emo) { this.emoT += dt; const f = this.emoT / 2.6; this.emo.position.set(.6, 1.9 + f * .6, 0); this.emo.material.opacity = f < .15 ? f / .15 : 1 - Math.max(0, (f - .7) / .3); const sc = .75 + Math.sin(Math.min(f * 8, Math.PI)) * .25; this.emo.scale.set(sc, sc, 1); if (f >= 1) { this.root.remove(this.emo); this.emo = null; } }
    const a = this.anim; const L = this.legs, A = this.arms, t = this.t;
    let lx = 0, rx = 0, alx = 0, arx = 0, alz = 0, arz = 0, up = 0, bend = 0, sitY = 0, headX = 0, twist = 0, side = 0;
    if (a === 1 || a === 2) {
      this.phase += dt * (a === 2 ? 11 : 7.5) * Math.max(.5, Math.min(1.4, speed / (a === 2 ? 5.5 : 3)));
      const s = Math.sin(this.phase), amp = a === 2 ? .75 : .5;
      lx = s * amp; rx = -s * amp; alx = -s * amp * .7; arx = s * amp * .7; up = Math.abs(Math.cos(this.phase)) * (a === 2 ? .06 : .03); bend = a === 2 ? .12 : 0;
    } else if (a === 3 || a === 5 || a === 8) {
      lx = rx = -1.45; sitY = -.06;
      if (a === 5) { const e = (Math.sin(t * 3) + 1) / 2; arx = -1.2 - e * .8; alx = -.9; headX = .1 + e * .1; }
      if (a === 8) { alx = arx = -.3; headX = -.15; }
    } else if (a === 12) { lx = rx = -1.5; sitY = -.42; alx = arx = -.4; bend = -.05; }
    else if (a === 4) { const e = Math.sin(t * 9); alx = -1 + e * .3; arx = -1 - e * .3; bend = .06; headX = .1; }
    else if (a === 6) { const e = Math.min(1, Math.sin(Math.min(t * 2.2, Math.PI)) * 1.5); bend = e * .7; alx = arx = e * .1; }
    else if (a === 7) { arx = -2.6; arz = .3 + Math.sin(t * 10) * .35; }
    else if (a === 9) { const e = (Math.sin(t * 16) + 1) / 2; alx = arx = -1.25; alz = -.25 - e * .35; arz = .25 + e * .35; headX = -.05; }
    else if (a === 10) { const e = Math.sin(t * 5); side = e * .12; twist = e * .35; alx = -1.6 - e * .9; arx = -1.6 + e * .9; alz = -.4; arz = .4; up = Math.abs(Math.cos(t * 5)) * .07; lx = e * .3; rx = -e * .3; headX = Math.sin(t * 10) * .08; }
    else if (a === 11) { const e = (Math.sin(t * 7) + 1) / 2; alx = arx = -2.6 - e * .35; alz = -.25; arz = .25; up = e * .05; headX = -.2; }
    else if (a === 13) { arx = -1.55; headX = .05; twist = .15; }
    else if (a === 15) { const e = (Math.sin(t * 3) + 1) / 2; alx = -1.3 - e * .9; headX = .1 + e * .12; }
    else if (a === 16) { const e = Math.min(1, t * 4); arx = -2.5 * e; arz = .15; up = Math.sin(Math.min(t * 6, Math.PI)) * .04; }
    else if (a === 14) { const e = Math.sin(t * 18); bend = -.18 + e * .04; alx = arx = -.5; alz = -.5; arz = .5; headX = -.25 + e * .06; up = Math.abs(e) * .02; }
    else { const b = Math.sin(t * 1.6) * .015; up = b; }
    if (this.look.c === 2 && ![7, 4, 9, 10, 11, 13, 16].includes(a)) arx = Math.min(arx, -1.2);
    if (this.look.f && ![5, 15, 4, 9, 10, 11].includes(a)) alx = Math.min(alx, -.9);
    const k = Math.min(1, dt * 12), lr = (o, v) => o + (v - o) * k;
    L[0].rotation.x = lr(L[0].rotation.x, lx); L[1].rotation.x = lr(L[1].rotation.x, rx);
    A[0].rotation.x = lr(A[0].rotation.x, alx); A[1].rotation.x = lr(A[1].rotation.x, arx);
    A[0].rotation.z = lr(A[0].rotation.z, -alz); A[1].rotation.z = lr(A[1].rotation.z, -arz);
    this.upper.rotation.x = lr(this.upper.rotation.x, bend); this.upper.rotation.y = lr(this.upper.rotation.y, twist); this.upper.rotation.z = lr(this.upper.rotation.z, side);
    this.headG.rotation.x = lr(this.headG.rotation.x, headX);
    this.upper.position.y = .5 + up; L.forEach(l => l.position.y = .5 + up * .5);
    this.offY = lr(this.offY || 0, sitY);
    this.upper.position.y += this.offY; L.forEach(l => l.position.y += this.offY);
  }
  emoji(e) {
    if (this.emo) { this.root.remove(this.emo); this.emo.material.map.dispose(); }
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.font = '96px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.emo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8d8d8, map: t, depthWrite: false, transparent: true, opacity: 0 }));
    this.emo.renderOrder = 12; this.emo.position.set(.6, 1.9, 0); this.root.add(this.emo); this.emoT = 0;
  }
  play(a) { if (this.anim !== a) { this.anim = a; this.t = 0; } }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, s, max) { const out = []; let cur = ''; for (const ch of s) { if (g.measureText(cur + ch).width > max) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
