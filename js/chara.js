// 江戶人物（程式建模 v2）：有膝蓋的雙腿、上身＋下襬、細緻臉部、和服袖、足袋木屐、髮型、配件、花魁
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
const PI = Math.PI;

export function randomLook(r = Math.random) {
  const pick = n => Math.floor(r() * n);
  return { k: pick(KIMONO.length), p: pick(4), o: pick(OBI.length), h: pick(HAIRS.length), s: pick(3), hat: r() < .15 ? 1 : 0, c: r() < .1 ? pick(3) : 0 };
}
const V2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
// ---------- 共用幾何 ----------
const G = {
  torso: new THREE.LatheGeometry(V2([[0, 0], [.19, 0], [.185, .12], [.165, .27], [.18, .44], [.175, .52], [.12, .6], [.05, .63], [0, .635]]), 20),
  skirt: new THREE.LatheGeometry(V2([[.19, 0], [.2, -.12], [.205, -.28], [.215, -.42], [.2, -.44], [0, -.44]]), 20),
  thigh: new THREE.CylinderGeometry(.06, .055, .25, 8),
  shin: new THREE.CylinderGeometry(.045, .04, .17, 8),
  tabi: new THREE.BoxGeometry(.07, .05, .13),
  geta: new THREE.BoxGeometry(.085, .025, .19),
  tooth: new THREE.BoxGeometry(.08, .04, .025),
  strap: new THREE.TorusGeometry(.03, .006, 4, 10, PI),
  obi: new THREE.CylinderGeometry(.188, .188, .14, 20),
  cord: new THREE.TorusGeometry(.19, .008, 4, 24),
  taiko: new THREE.BoxGeometry(.24, .17, .07),
  knotB: new THREE.BoxGeometry(.12, .07, .05),
  sleeve: new THREE.CapsuleGeometry(.1, .2, 6, 12),
  hand: new THREE.SphereGeometry(.04, 10, 8),
  neck: new THREE.CylinderGeometry(.045, .05, .08, 10),
  head: new THREE.SphereGeometry(.125, 24, 18),
  ear: new THREE.SphereGeometry(.024, 8, 6),
  nose: new THREE.SphereGeometry(.013, 8, 6),
  eye: new THREE.SphereGeometry(.018, 10, 8),
  hi: new THREE.SphereGeometry(.0055, 6, 4),
  brow: new THREE.BoxGeometry(.036, .007, .006),
  mouth: new THREE.TorusGeometry(.014, .0035, 4, 10, PI),
  cheek: new THREE.CircleGeometry(.022, 12),
  collar: new THREE.BoxGeometry(.04, .24, .015),
  capTop: new THREE.SphereGeometry(.133, 20, 7, 0, PI * 2, 0, PI * .34),
  capBack: new THREE.SphereGeometry(.133, 20, 9, PI / 2 + .9, PI * 2 - 1.8, PI * .32, PI * .34),
  side: new THREE.SphereGeometry(.134, 20, 9, PI / 2 + .9, PI * 2 - 1.8, PI * .3, PI * .3),
  knot: new THREE.CylinderGeometry(.022, .028, .16, 8),
  bun: new THREE.SphereGeometry(.085, 14, 10),
  hatG: new THREE.ConeGeometry(.34, .16, 24, 1, true),
  pin: new THREE.CylinderGeometry(.007, .007, .2, 5),
  fan: new THREE.CircleGeometry(.16, 12, 0, PI * .8),
  umb: new THREE.ConeGeometry(.55, .25, 16, 1, true),
  stick: new THREE.CylinderGeometry(.012, .012, .9, 5),
};
const M = {};
function mat(c, o = {}) { const k = c + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o })); }
const hairMat = mat('#16120f', { roughness: .42, metalness: .05 });
function fabricMat(lk) {
  const kc = KIMONO[lk.k % KIMONO.length][1]; const k = 'F' + lk.k + '_' + lk.p;
  return M[k] || (M[k] = new THREE.MeshStandardMaterial({ map: lk.p ? TX.pattern(lk.p, kc, lk.k === 9 ? '#5a5a66' : '#f4efe2') : TX.fabric(kc), roughness: .88 }));
}
function mesh(g, m, par, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = shadow; par.add(o); return o;
}

export class Chara {
  constructor(look, name = '') {
    this.root = new THREE.Group();
    this.phase = Math.random() * 6; this.anim = 0; this.t = 0; this.lift = 0;
    // 腿：髖→大腿→膝→小腿→足袋木屐
    this.legs = []; this.knees = []; this.feet = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * .075, .5, 0); this.root.add(hip);
      const th = mesh(G.thigh, mat('#888'), hip, 0, -.125, 0);
      const knee = new THREE.Group(); knee.position.y = -.25; hip.add(knee);
      const sh = mesh(G.shin, mat('#f1d2b6'), knee, 0, -.085, 0);
      const foot = new THREE.Group(); foot.position.y = -.17; knee.add(foot);
      mesh(G.tabi, mat('#f4f1ea'), foot, 0, .005, .025);
      const geta = mesh(G.geta, mat('#7a5634'), foot, 0, -.032, .03);
      const teeth = [mesh(G.tooth, mat('#5a3e26'), foot, 0, -.06, .085), mesh(G.tooth, mat('#5a3e26'), foot, 0, -.06, -.02)];
      mesh(G.strap, mat('#b8302a'), foot, 0, -.01, .07, 0, 0, 0, 1, 1, 1, false);
      hip.userData = { th, sh, geta, teeth }; this.legs.push(hip); this.knees.push(knee); this.feet.push(foot);
    }
    // 上身（髖為原點）
    this.upper = new THREE.Group(); this.upper.position.y = .5; this.root.add(this.upper);
    this.torsoM = mesh(G.torso, mat('#888'), this.upper);
    this.skirtG = new THREE.Group(); this.upper.add(this.skirtG);
    this.skirtM = mesh(G.skirt, mat('#888'), this.skirtG);
    this.obiM = mesh(G.obi, mat('#888'), this.upper, 0, .22, 0);
    this.cordM = mesh(G.cord, mat('#c8322a'), this.upper, 0, .2, 0, PI / 2, 0, 0, 1, 1, 1, false);
    this.bowM = mesh(G.taiko, mat('#888'), this.upper, 0, .25, -.2);
    this.detailG = new THREE.Group(); this.upper.add(this.detailG);
    for (const s of [-1, 1]) { mesh(G.collar, mat('#f6f2e8'), this.detailG, s * .045, .5, .165, -.32, 0, s * .5, 1, 1, 1, false); }
    this.collarC = [];
    for (const s of [-1, 1]) this.collarC.push(mesh(G.collar, mat('#888'), this.detailG, s * .065, .48, .17, -.32, 0, s * .5, 1.3, 1.05, 1, false));
    mesh(G.neck, mat('#f1d2b6'), this.upper, 0, .655, 0);
    // 手臂：肩→和服袖＋手
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * .2, .56, 0);
      const sl = mesh(G.sleeve, mat('#888'), a, s * .01, -.17, 0, 0, 0, 0, .48, 1, 1.15);
      const h = mesh(G.hand, mat('#f1d2b6'), a, 0, -.31, .07, 0, 0, 0, .9, 1.1, .8);
      a.userData = { sl, h }; this.upper.add(a); this.arms.push(a);
    }
    // 頭
    this.headG = new THREE.Group(); this.headG.position.y = .78; this.upper.add(this.headG);
    this.headM = mesh(G.head, mat('#f1d2b6'), this.headG, 0, 0, 0, 0, 0, 0, .95, 1.05, .98);
    this.faceG = new THREE.Group(); this.headG.add(this.faceG);
    this.skinParts = [];
    for (const s of [-1, 1]) {
      this.skinParts.push(mesh(G.ear, mat('#f1d2b6'), this.faceG, s * .118, -.01, -.005, 0, 0, 0, .55, 1, .8, false));
      mesh(G.eye, mat('#1a1210', { roughness: .3 }), this.faceG, s * .044, .004, .108, 0, 0, 0, 1, 1.25, .5, false);
      mesh(G.hi, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: .4 }), this.faceG, s * .044 + .006, .012, .117, 0, 0, 0, 1, 1, 1, false);
      this.browM = mesh(G.brow, hairMat, this.faceG, s * .047, .046, .112, 0, 0, s * -.12, 1, 1, 1, false);
      const ck = mesh(G.cheek, mat('#f08a8a', { transparent: true, opacity: .4 }), this.faceG, s * .07, -.03, .1, 0, s * .55, 0, 1, 1, 1, false);
    }
    this.noseM = mesh(G.nose, mat('#e8b896'), this.faceG, 0, -.022, .121, 0, 0, 0, 1, 1, 1, false);
    this.mouthM = mesh(G.mouth, mat('#a5463a'), this.faceG, 0, -.052, .112, 0, 0, PI, 1, 1, 1, false);
    this.hairG = new THREE.Group(); this.headG.add(this.hairG);
    this.accG = new THREE.Group(); this.headG.add(this.accG);
    this.carryG = new THREE.Group(); this.arms[1].add(this.carryG);
    this.oiranG = new THREE.Group(); this.upper.add(this.oiranG); this.auraG = new THREE.Group(); this.root.add(this.auraG);
    this.foodG = new THREE.Group(); this.foodG.position.set(0, -.36, .12); this.arms[0].add(this.foodG);
    this.waistG = new THREE.Group(); this.waistG.position.y = .22; this.upper.add(this.waistG);
    this.setLook(look);
    this.name = name; if (name) this.setName(name);
  }
  setLook(lk) {
    lk = Object.assign({ k: 0, p: 0, o: 0, h: 0, s: 0, hat: 0, c: 0, w: 0, f: '' }, lk || {});
    this.look = lk;
    const km = fabricMat(lk), skin = mat(SKINS[lk.s % 3], { roughness: .6 }), obi = mat(OBI[lk.o % OBI.length], { roughness: .55 });
    this.torsoM.material = this.skirtM.material = km; this.legs.forEach(l => { l.userData.th.material = km; l.userData.sh.material = skin; l.userData.geta.material = mat('#7a5634'); l.userData.geta.scale.y = 1; l.userData.teeth.forEach((t, i) => { t.material = mat('#5a3e26'); t.scale.set(1, 1, 1); t.position.y = -.06; t.visible = true; }); });
    this.collarC.forEach(c => c.material = km); this.arms.forEach(a => { a.userData.sl.material = km; a.userData.sl.scale.set(.48, 1, 1.15); a.userData.h.material = skin; });
    this.obiM.material = obi; this.bowM.material = obi; this.headM.material = skin; this.skinParts.forEach(p => p.material = skin);
    this.cordM.material = mat(['#c8322a', '#e8c56a', '#3a6a8a', '#f4f0e4', '#8a3a6a', '#2f6a4a'][(lk.o + 2) % 6]);
    this.mouthM.material = mat('#a5463a'); this.mouthM.scale.set(1, 1, 1);
    const female = lk.h === 1 || lk.h === 4;
    this.bowM.geometry = female ? G.taiko : G.knotB; this.bowM.position.set(0, female ? .27 : .22, -.2);
    this.hairG.clear(); this.accG.clear(); this.carryG.clear(); this.foodG.clear(); this.waistG.clear(); this.oiranG.clear(); this.auraG.clear();
    if (this.light) { this.root.remove(this.light); this.light = null; }
    this.lift = 0;
    if (this.gm) { this.buildOiran(lk); return; }
    const H = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => mesh(g, hairMat, this.hairG, x, y, z, rx, 0, rz, sx, sy, sz);
    const HC = (y = .005, s = 1.04) => { H(G.capTop, 0, y, -.008, s, s * 1.02, s * 1.05); H(G.capBack, 0, y - .005, -.01, s * 1.02, s * 1.04, s * 1.06); };
    switch (lk.h % HAIRS.length) {
      case 0: { // 丁髷：剃過的月代（青灰）、兩側鬢髮、向前折的髷
        mesh(G.capTop, mat('#c9b4a0', { roughness: .7 }), this.hairG, 0, .006, -.006, 1.01, 1.0, 1.02);
        H(G.side, 0, 0, -.005, 1.06, 1.05, 1.07);
        const k = H(G.knot, 0, .145, -.03); k.rotation.x = PI / 2 - .25; H(G.bun, 0, .12, -.1, .35, .35, .5); break;
      }
      case 1: { // 島田髷：前髮、兩鬢、頭頂大髷、後髷
        HC(); H(G.bun, 0, .11, .07, .55, .38, .45); for (const s of [-1, 1]) H(G.bun, s * .11, .0, -.01, .45, .6, .7);
        H(G.bun, 0, .17, -.04, 1.25, .62, .85); H(G.bun, 0, .05, -.14, .95, .75, .7); H(G.knot, 0, .17, -.04, 1.8, .55, 1.8, 0, PI / 2);
        break;
      }
      case 2: { HC(0, 1.05); const k = H(G.knot, 0, .02, -.16); k.rotation.x = .55; k.scale.set(1.6, 1.4, 1.6); H(G.bun, 0, -.06, -.2, .35, .9, .35); break; } // 総髪
      case 3: { mesh(G.capTop, mat('#d6bba3', { roughness: .65 }), this.hairG, 0, .004, -.004, 1.01, 1.0, 1.02); break; } // 坊主
      case 4: { HC(); H(G.bun, 0, .1, .07, .5, .35, .42); for (const s of [-1, 1]) { H(G.bun, s * .1, .15, -.02, .78, .78, .78); mesh(G.pin, mat('#d8b24a', { metalness: .6, roughness: .3 }), this.hairG, s * .1, .15, -.02, 0, 0, PI / 2, 1, .9, 1); } break; } // 唐輪
    }
    if (lk.hat === 1) { const h = mesh(G.hatG, mat('#c9a868', { side: THREE.DoubleSide }), this.accG, 0, .2, 0); for (let i = 0; i < 6; i++) mesh(new THREE.TorusGeometry(.34 - i * .05, .004, 3, 24), mat('#8a6a3a'), this.accG, 0, .13 + i * .022, 0, PI / 2, 0, 0, 1, 1, 1, false); mesh(new THREE.CylinderGeometry(.003, .003, .3, 3), mat('#5a3a2a'), this.accG, 0, -.06, .1, .3, 0, 0, 1, 1, 1, false); }
    if (lk.hat === 2) { for (const s of [-1, 1]) { mesh(G.pin, mat('#d8b24a', { metalness: .7, roughness: .25 }), this.accG, s * .06, .19, -.06, 0, 0, s * 1.2); mesh(new THREE.SphereGeometry(.024, 10, 8), mat('#d23c4c', { roughness: .3 }), this.accG, s * .15, .23, -.06); for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.004, .05, .004), mat('#d8b24a', { metalness: .7, roughness: .25 }), this.accG, s * (.15 + (i - 1) * .012), .19, -.06, 0, 0, 0, 1, 1, 1, false); } }
    if (lk.hat === 3) { mesh(new THREE.TorusGeometry(.133, .02, 6, 28), mat('#f4efe4'), this.accG, 0, .05, 0, PI / 2 - .15, 0, 0); mesh(new THREE.BoxGeometry(.07, .05, .05), mat('#f4efe4'), this.accG, 0, .07, -.14); mesh(new THREE.BoxGeometry(.02, .09, .01), mat('#f4efe4'), this.accG, .03, .02, -.15, 0, 0, .3); }
    if (lk.hat === 4) { const f = new THREE.Group(); mesh(new THREE.SphereGeometry(.095, 14, 10, 0, PI * 2, 0, PI / 2), mat('#f7f3ea', { roughness: .4 }), f, 0, 0, 0, PI / 2, 0, 0);
      mesh(new THREE.ConeGeometry(.035, .07, 10), mat('#f7f3ea', { roughness: .4 }), f, 0, -.02, .1, PI / 2, 0, 0);
      for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.03, .08, 4), mat('#f7f3ea'), f, s * .055, .085, 0); mesh(new THREE.BoxGeometry(.035, .008, .01), mat('#c8322a'), f, s * .04, .02, .085, 0, 0, s * .4); mesh(new THREE.BoxGeometry(.02, .006, .01), mat('#c8322a'), f, s * .055, -.01, .075, 0, 0, s * -.3); }
      mesh(new THREE.SphereGeometry(.011, 6, 4), mat('#1a1210'), f, 0, -.02, .135); f.position.set(.11, .04, .05); f.rotation.y = .9; this.accG.add(f); }
    if (lk.w === 1) { mesh(new THREE.BoxGeometry(.07, .1, .04), mat('#1a1414', { roughness: .25, metalness: .2 }), this.waistG, .17, -.1, .1); mesh(new THREE.CylinderGeometry(.004, .004, .1, 4), mat('#c9a24a'), this.waistG, .17, -.02, .1); mesh(new THREE.SphereGeometry(.018, 8, 6), mat('#c9a24a', { metalness: .6 }), this.waistG, .17, .03, .11); }
    if (lk.w === 2) { mesh(new THREE.SphereGeometry(.05, 10, 8), mat('#b8352f'), this.waistG, -.17, -.11, .1, 0, 0, 0, 1, 1.2, 1); mesh(new THREE.CylinderGeometry(.02, .03, .03, 8), mat('#c9a24a'), this.waistG, -.17, -.04, .1); }
    this.addHeld(lk);
    if (lk.c === 1) { mesh(G.fan, mat('#f2e6c8', { side: THREE.DoubleSide }), this.carryG, 0, -.36, .1, -1.2, 0, .6); }
    if (lk.c === 2) { mesh(G.stick, mat('#4a3424'), this.carryG, 0, .05, .08); mesh(G.umb, mat('#b8352f', { side: THREE.DoubleSide }), this.carryG, 0, .55, .08); for (let i = 0; i < 8; i++) mesh(new THREE.CylinderGeometry(.004, .004, .58, 3), mat('#e8dcc0'), this.carryG, Math.cos(i / 8 * PI * 2) * .24, .5, .08 + Math.sin(i / 8 * PI * 2) * .24, Math.sin(i / 8 * PI * 2) * .45, 0, -Math.cos(i / 8 * PI * 2) * .45, 1, 1, 1, false); }
  }
  addHeld(lk) { if (lk.f && Chara.foodModel) { const d = Chara.foodModel(lk.f); if (d) { d.scale.setScalar(1.25); d.rotation.x = -.2; this.foodG.add(d); } } }

  // ---------- GM：花魁 ----------
  buildOiran(lk) {
    const P = (g, m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, par = this.oiranG) => mesh(g, m, par, x, y, z, rx, ry, rz, sx, sy, sz);
    const goldM = mat('#e8bf4e', { metalness: .9, roughness: .22 }), redM = mat('#c21f32', { roughness: .45 }), tortoise = mat('#6a3a1a', { metalness: .35, roughness: .28 });
    const inner = new THREE.MeshStandardMaterial({ map: TX.oiranTex('in'), roughness: .5, metalness: .2 });
    const robe = new THREE.MeshStandardMaterial({ map: TX.oiranTex('out'), roughness: .45, metalness: .25, side: THREE.DoubleSide });
    const skin = mat('#f8f4ef', { roughness: .4 });
    this.torsoM.material = this.skirtM.material = inner; this.collarC.forEach(c => c.material = redM);
    this.legs.forEach(l => { l.userData.th.material = inner; l.userData.sh.material = skin; });
    this.arms.forEach(a => { a.userData.sl.material = robe; a.userData.sl.scale.set(.62, 1.35, 1.75); a.userData.h.material = skin; });
    this.headM.material = skin; this.skinParts.forEach(p => p.material = skin);
    this.obiM.material = goldM; this.bowM.material = goldM; this.bowM.geometry = G.knotB; this.cordM.material = redM;
    // 袖口多層衣緣
    for (const a of this.arms) [['#c21f32', 1], ['#e8bf4e', 2]].forEach(([c, n]) => mesh(G.sleeve, mat(c, c === '#e8bf4e' ? { metalness: .8, roughness: .3 } : {}), a, 0, -.17 - n * .018, -.004 * n, 0, 0, 0, .58, 1.35, 1.7));
    // 打掛：拖地外罩（前開）＋紅色厚下襬（ふき）＋後襬
    const pts = V2([[.0, -.52], [.4, -.52], [.37, -.3], [.3, .05], [.27, .4], [.24, .58], [.16, .66], [0, .67]]);
    P(new THREE.LatheGeometry(pts, 28, PI * .3, PI * 1.4), robe, 0, 0, -.02, 0, 0, 0, 1, 1, 1.18);
    P(new THREE.TorusGeometry(.4, .045, 8, 28, PI * 1.4), redM, 0, -.5, -.02, PI / 2, 0, PI * .3, 1, 1.18, 1);
    P(new THREE.CircleGeometry(.48, 24, PI * .1, PI * .8), robe, 0, -.515, -.32, -PI / 2, 0, PI, 1, 1, 1);
    // 前結帶：大蝴蝶結＋長垂帶＋流蘇
    const obiTex = new THREE.MeshStandardMaterial({ map: TX.oiranTex('obi'), metalness: .55, roughness: .3 });
    P(new THREE.BoxGeometry(.28, .56, .05), obiTex, 0, -.04, .235, -.05);
    P(new THREE.BoxGeometry(.4, .2, .1), obiTex, 0, .26, .22);
    for (const s of [-1, 1]) { P(new THREE.SphereGeometry(.11, 14, 10), obiTex, s * .17, .3, .27, 0, 0, s * .55, 1.35, .65, .45); P(new THREE.SphereGeometry(.06, 12, 8), redM, s * .13, .3, .31, 0, 0, s * .5, 1.2, .55, .4); }
    P(new THREE.SphereGeometry(.05, 12, 8), goldM, 0, .3, .32, 0, 0, 0, 1, .9, .7);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P(new THREE.CylinderGeometry(.006, .006, .16, 4), goldM, s * (.1 + i * .012), -.36, .27);
    // 層層衣領（白・紅・金）
    for (const [c, w, o] of [['#f6f1e8', .05, 0], ['#c21f32', .04, .03], ['#e8bf4e', .025, .055]]) for (const s of [-1, 1]) P(G.collar, mat(c, c === '#e8bf4e' ? { metalness: .8, roughness: .3 } : {}), s * (.05 + o), .5, .17 + o * .1, -.32, 0, s * .5, w / .04, 1.1, 1);
    // 三枚齒高木屐（黑漆）
    this.legs.forEach(l => { const u = l.userData; u.geta.material = mat('#141012', { roughness: .2, metalness: .25 }); u.geta.scale.y = 1.6; u.teeth.forEach(t => { t.material = mat('#141012', { roughness: .2, metalness: .25 }); t.scale.set(1, 4.2, 1.2); t.position.y = -.125; }); });
    this.lift = .16;
    // 妝：白粉、紅唇、眼尾紅、細眉
    this.mouthM.material = redM; this.mouthM.scale.set(.8, .8, 1);
    P(new THREE.SphereGeometry(.012, 8, 6), redM, 0, -.05, .114, 0, 0, 0, 1.5, .7, .6, this.faceG);
    for (const s of [-1, 1]) P(new THREE.BoxGeometry(.03, .008, .006), redM, s * .066, .012, .108, 0, s * .45, s * -.35, 1, 1, 1, this.faceG);
    // 橫兵庫髷：巨大的左右髷翼、頂髷、後髷
    const hair = mat('#0c0a0b', { roughness: .3, metalness: .08 });
    const H = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => P(g, hair, x, y, z, rx, 0, rz, sx, sy, sz, this.hairG);
    H(G.capTop, 0, .006, -.008, 1.07, 1.08, 1.08); H(G.capBack, 0, 0, -.01, 1.08, 1.08, 1.1);
    for (const s of [-1, 1]) { H(G.bun, s * .23, .2, -.03, 1.9, .78, 1.1, 0, s * -.32); H(G.bun, s * .12, .02, -.02, .55, .8, .8); }
    H(G.bun, 0, .25, -.03, 1.35, .7, 1.05); H(G.bun, 0, .06, -.17, 1.25, 1.0, .85);
    // 玳瑁長簪：左右各 6 支向外放射
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = .15 + i * .2; const g = new THREE.Group(); g.position.set(s * .05, .22, -.02); g.rotation.z = s * -(PI / 2 - a); this.hairG.add(g);
      mesh(new THREE.CylinderGeometry(.008, .008, .62, 6), tortoise, g, 0, .31, 0); mesh(new THREE.SphereGeometry(.016, 8, 6), goldM, g, 0, .62, 0); }
    // 前插金簪＋珊瑚珠
    for (let i = 0; i < 7; i++) { const a = -.9 + i / 6 * 1.8; mesh(new THREE.CylinderGeometry(.005, .005, .3, 4), goldM, this.hairG, Math.sin(a) * .16, .33 + Math.cos(a) * .05, .02, 0, 0, -a); mesh(new THREE.SphereGeometry(.02, 8, 6), i % 2 ? redM : goldM, this.hairG, Math.sin(a) * .29, .33 + Math.cos(a) * .17, .02); }
    // 大花簪（兩側）
    const flower = [mat('#f29bb6', { roughness: .4 }), mat('#e8455c', { roughness: .4 }), mat('#ffffff', { roughness: .4 })];
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; mesh(new THREE.SphereGeometry(.024, 8, 6), flower[i % 3], this.hairG, s * .2 + Math.cos(a) * .045, .05 + Math.sin(a) * .045, .07, 0, 0, 0, 1, 1, .6); }
    // 玳瑁梳三把＋金冠
    for (let i = 0; i < 3; i++) { P(new THREE.BoxGeometry(.24 - i * .03, .065, .015), tortoise, 0, .17 + i * .05, .07 + i * .016, -.35, 0, 0, 1, 1, 1, this.hairG); P(new THREE.BoxGeometry(.25 - i * .03, .008, .017), goldM, 0, .205 + i * .05, .07 + i * .016, -.35, 0, 0, 1, 1, 1, this.hairG); }
    // 垂飾鏈（びらびら）
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) P(new THREE.BoxGeometry(.008, .028, .004), goldM, s * (.26 + k * .016), .12 - j * .034, .04, 0, 0, 0, 1, 1, 1, this.hairG);
    // 長煙管
    const kis = new THREE.Group(); kis.position.set(0, -.3, .1); kis.rotation.set(-1.1, 0, .25); this.arms[1].add(kis); this.carryG.add(kis);
    mesh(new THREE.CylinderGeometry(.008, .008, .42, 6), mat('#1a1414', { roughness: .3 }), kis, 0, .1, 0); mesh(new THREE.CylinderGeometry(.013, .01, .05, 8), goldM, kis, 0, .32, 0); mesh(new THREE.CylinderGeometry(.01, .01, .05, 8), goldM, kis, 0, -.12, 0);
    // 金色光點、飄落櫻花、暖光
    const tex = TX.radial('aura', 'rgba(255,230,140,1)', 'rgba(255,190,80,0)'), petal = TX.radial('petalA', 'rgba(255,190,210,1)', 'rgba(255,170,200,0)');
    for (let i = 0; i < 22; i++) { const isP = i >= 14; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: isP ? petal : tex, transparent: true, depthWrite: false, blending: isP ? THREE.NormalBlending : THREE.AdditiveBlending })); sp.userData = { a: i / 14 * PI * 2, r: .45 + (i % 3) * .12, y: .2 + (i % 5) * .32, sp: .6 + (i % 4) * .2, petal: isP, fall: Math.random() * 2 }; sp.scale.setScalar(isP ? .06 : .1); this.auraG.add(sp); }
    this.light = new THREE.PointLight('#ffcf80', 2.2, 4, 1.6); this.light.position.set(0, 1.4, .5); this.root.add(this.light);
    this.addHeld(lk);
    if (this.name) this.setName(this.name);
  }
  // 遠處省略細節（效能）
  lod(d) { const near = d < 16; this.faceG.visible = d < 13; this.detailG.visible = near; this.legs.forEach(l => { l.userData.teeth.forEach(t => t.visible = near); }); }
  setName(n, npc) {
    if (this.tag) { this.root.remove(this.tag); this.tag.material.map.dispose(); }
    this.name = n;
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = `600 30px ${TX.FONT}`; const w = Math.min(250, g.measureText(n).width + 28);
    g.fillStyle = this.gm ? 'rgba(150,40,30,.85)' : npc ? 'rgba(60,70,50,.42)' : 'rgba(20,16,12,.55)'; rr(g, 128 - w / 2, 10, w, 44, 14); g.fill(); if (this.gm) { g.strokeStyle = '#f3cf6a'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = this.gm ? '#ffe08a' : npc ? '#e8ecdc' : '#fff6e0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8d8d8, map: t, depthWrite: false, transparent: true }));
    this.tag.scale.set(1.2, .3, 1); this.tag.position.y = this.gm ? 2.35 : 1.95; this.tag.renderOrder = 10; this.root.add(this.tag);
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
    this.bub.scale.set(2.6, .81, 1); this.bub.position.y = this.gm ? 2.85 : 2.5; this.bub.renderOrder = 11; this.root.add(this.bub);
    this.bubT = dur;
  }
  // anim: 0站 1走 2跑 3坐 4做菜 5吃 6鞠躬 7揮手 8泡湯 9拍手 10跳舞 11萬歲 12坐地 13指路 14大笑 15站著吃 16舉手 17合掌
  update(dt, speed) {
    this.t += dt;
    if (this.bub) { this.bubT -= dt; if (this.bubT < 0) { this.root.remove(this.bub); this.bub.material.map.dispose(); this.bub = null; } }
    if (this.emo) { this.emoT += dt; const f = this.emoT / 2.6; this.emo.position.set(.6, (this.gm ? 2.2 : 1.9) + f * .6, 0); this.emo.material.opacity = f < .15 ? f / .15 : 1 - Math.max(0, (f - .7) / .3); const sc = .75 + Math.sin(Math.min(f * 8, PI)) * .25; this.emo.scale.set(sc, sc, 1); if (f >= 1) { this.root.remove(this.emo); this.emo = null; } }
    const a = this.anim, L = this.legs, K = this.knees, A = this.arms, t = this.t;
    let lx = 0, rx = 0, lk = 0, rk = 0, alx = 0, arx = 0, alz = 0, arz = 0, up = 0, bend = 0, sitY = 0, headX = 0, twist = 0, side = 0, lap = 0;
    if (a === 1 || a === 2) {
      const slow = this.gm ? .7 : 1;
      this.phase += dt * (a === 2 ? 11 : 7.5) * slow * Math.max(.5, Math.min(1.4, speed / (a === 2 ? 5.5 : 3)));
      const s = Math.sin(this.phase), amp = (a === 2 ? .7 : .45) * (this.gm ? .55 : 1);
      lx = s * amp; rx = -s * amp; lk = Math.max(0, -s) * amp * 1.3; rk = Math.max(0, s) * amp * 1.3;
      alx = -s * amp * .6; arx = s * amp * .6; up = Math.abs(Math.cos(this.phase)) * (a === 2 ? .05 : .025); bend = a === 2 ? .1 : 0; lap = -Math.abs(s) * .08;
      if (this.gm) { twist = Math.sin(this.phase) * .12; side = Math.sin(this.phase) * .04; }
    } else if (a === 3 || a === 5 || a === 8) {
      lx = rx = -1.45; lk = rk = 1.45; sitY = -.42; lap = -1.3;
      if (a === 5) { const e = (Math.sin(t * 3) + 1) / 2; arx = -1.1 - e * .8; alx = -1.0; headX = .08 + e * .1; }
      if (a === 8) { alx = arx = -.3; headX = -.15; }
    } else if (a === 12) { lx = rx = -1.5; lk = rk = .1; sitY = -.42; lap = -1.35; alx = arx = -.5; bend = -.05; }
    else if (a === 4) { const e = Math.sin(t * 9); alx = -1 + e * .3; arx = -1 - e * .3; bend = .06; headX = .1; }
    else if (a === 6) { const e = Math.min(1, Math.sin(Math.min(t * 2.2, PI)) * 1.5); bend = e * .7; alx = arx = e * .1; }
    else if (a === 7) { arx = -2.6; arz = .3 + Math.sin(t * 10) * .35; }
    else if (a === 9) { const e = (Math.sin(t * 16) + 1) / 2; alx = arx = -1.25; alz = -.25 - e * .35; arz = .25 + e * .35; headX = -.05; }
    else if (a === 10) { const e = Math.sin(t * 5); side = e * .12; twist = e * .35; alx = -1.6 - e * .9; arx = -1.6 + e * .9; alz = -.4; arz = .4; up = Math.abs(Math.cos(t * 5)) * .07; lx = e * .3; rx = -e * .3; lk = Math.max(0, e) * .4; rk = Math.max(0, -e) * .4; headX = Math.sin(t * 10) * .08; }
    else if (a === 11) { const e = (Math.sin(t * 7) + 1) / 2; alx = arx = -2.6 - e * .35; alz = -.25; arz = .25; up = e * .05; headX = -.2; }
    else if (a === 13) { arx = -1.55; headX = .05; twist = .15; }
    else if (a === 15) { const e = (Math.sin(t * 3) + 1) / 2; alx = -1.3 - e * .9; headX = .1 + e * .12; }
    else if (a === 16) { const e = Math.min(1, t * 4); arx = -2.5 * e; arz = .15; up = Math.sin(Math.min(t * 6, PI)) * .04; }
    else if (a === 17) { const e = Math.min(1, t * 2.5); alx = arx = -1.25 * e; alz = -.62 * e; arz = .62 * e; bend = .22 * Math.min(1, Math.max(0, t - .6) * 2); headX = .25 * e; }
    else if (a === 14) { const e = Math.sin(t * 18); bend = -.18 + e * .04; alx = arx = -.5; alz = -.5; arz = .5; headX = -.25 + e * .06; up = Math.abs(e) * .02; }
    else { up = Math.sin(t * 1.6) * .012; if (this.gm) { twist = Math.sin(t * .9) * .06; headX = Math.sin(t * .7) * .04; } }
    if (this.look.c === 2 && ![7, 4, 9, 10, 11, 13, 16, 17].includes(a)) arx = Math.min(arx, -1.2);
    if (this.gm && ![7, 4, 9, 10, 11, 13, 16, 17].includes(a)) arx = Math.min(arx, -.7);
    if (this.look.f && ![5, 15, 4, 9, 10, 11, 17].includes(a)) alx = Math.min(alx, -.9);
    const k = Math.min(1, dt * 12), lr = (o, v) => o + (v - o) * k;
    L[0].rotation.x = lr(L[0].rotation.x, lx); L[1].rotation.x = lr(L[1].rotation.x, rx);
    K[0].rotation.x = lr(K[0].rotation.x, lk); K[1].rotation.x = lr(K[1].rotation.x, rk);
    A[0].rotation.x = lr(A[0].rotation.x, alx); A[1].rotation.x = lr(A[1].rotation.x, arx);
    A[0].rotation.z = lr(A[0].rotation.z, -alz); A[1].rotation.z = lr(A[1].rotation.z, -arz);
    this.upper.rotation.x = lr(this.upper.rotation.x, bend); this.upper.rotation.y = lr(this.upper.rotation.y, twist); this.upper.rotation.z = lr(this.upper.rotation.z, side);
    this.skirtG.rotation.x = lr(this.skirtG.rotation.x, lap - bend); this.skirtG.scale.y = lr(this.skirtG.scale.y, lap < -1 ? .62 : 1);
    this.headG.rotation.x = lr(this.headG.rotation.x, headX);
    this.offY = lr(this.offY || 0, sitY);
    const y0 = .5 + this.lift + this.offY;
    this.upper.position.y = y0 + up; L.forEach(l => l.position.y = y0 + up * .5);
    if (this.auraG.children.length) for (const sp of this.auraG.children) { const u = sp.userData;
      if (u.petal) { u.fall = (u.fall + dt * .35) % 2; const a2 = u.a + t * .5; sp.position.set(Math.cos(a2) * (u.r + .3), 2.2 - u.fall * 1.1, Math.sin(a2) * (u.r + .3)); sp.material.opacity = Math.min(1, (2 - u.fall) * 1.5) * .9; }
      else { const a2 = u.a + t * u.sp; sp.position.set(Math.cos(a2) * u.r, u.y + Math.sin(t * 1.7 + u.a * 3) * .08, Math.sin(a2) * u.r); sp.material.opacity = .45 + .45 * Math.sin(t * 3 + u.a * 5); } }
    if (this.light) this.light.intensity = 2 + Math.sin(t * 2.3) * .3;
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
