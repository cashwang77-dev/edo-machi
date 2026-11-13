// 江戶人物（程式建模 v2）：有膝蓋的雙腿、上身＋下襬、細緻臉部、和服袖、足袋木屐、髮型、配件、花魁
import * as THREE from 'three';
import * as TX from './tex.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

export const KIMONO = [
  ['藍', '#2a4b7c'], ['紅梅', '#c24a62'], ['若竹', '#5c9a68'], ['墨', '#2f2e35'], ['山吹', '#dba23a'],
  ['桜', '#e7b3c0'], ['茶', '#7a5236'], ['江戸紫', '#6a4a8a'], ['浅葱', '#3f97ad'], ['白鼠', '#c9c4ba']
];
export const OBI = ['#8a2f2f', '#2b2b2b', '#c9a24a', '#e8e2d2', '#355d8a', '#6b3f6b'];
export const PATTERNS = ['無地', '縞', '水玉', '市松', '麻の葉', '桜', '朝顔', '金魚', '花火', '青海波', '龜甲', '梅', '菊'];
export const HAIRS = ['丁髷', '島田髷', '総髪', '坊主', '唐輪', 'おかっぱ', 'ポニー', '垂髪'];
export const OUTFITS = ['着物', '羽織', '袴', '法被'];
export const OUTER = ['#2a2a3a', '#5a3a2a', '#3a5a4a', '#6a2a2a', '#2a4a6a', '#c9b48a'];
export const HATS = ['なし', '菅笠', '簪', '鉢巻', '狐面'];
export const WAIST = ['なし', '印籠', '巾着'];
export const CARRY = ['なし', '扇子', '番傘'];
export const SKINS = ['#f1d2b6', '#e6bf9c', '#d6a77e'];
export const EYES = ['圓眼', '細長眼', '垂眼', '吊眼', '笑眼'];
export const BROWS = ['細眉', '粗眉', '麻呂眉', '劍眉'];
export const MOUTHS = ['微笑', '開口笑', '小O嘴', '一字嘴'];
export const CHEEKS = ['無', '淡', '濃'];
export const MOLES = ['無', '淚痣'];
export const FACES = ['Q版'];
const PI = Math.PI;
export const RIDE_Y = .7; // 坐在人力車上時角色根部的高度
const BODY_W = .84; // 身體寬度比例
const BODY_S = .86; // 身體整體比例（頭部另外反向補償，頭身比更像 Q 版）

export function randomLook(r = Math.random) {
  const pick = n => Math.floor(r() * n);
  return { k: pick(KIMONO.length), p: [0, 0, 1, 2, 3, 4, 5, 9, 10, 11, 12][pick(11)], o: pick(OBI.length), h: pick(HAIRS.length), s: pick(3), hat: r() < .15 ? 1 : 0, c: r() < .1 ? pick(3) : 0, ey: pick(5), br: pick(4), mo: pick(4), ck: pick(3), mk: r() < .2 ? 1 : 0, y: [0, 0, 0, 1, 2, 3][pick(6)], yc: pick(6) };
}
const V2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
// 把球形變成真人頭型：拉長、側面收窄、下巴收尖、顴骨、後腦飽滿（頭、臉部貼花、頭髮共用，貼合不浮）
function headShape(x, y, z) {
  y *= 1.06; x *= .94;
  if (y < 0) { const t = Math.min(1, -y / 1.06); x *= 1 - .2 * t * t; z *= 1 - .1 * t * t; if (z > 0) { z += .06 * t * t; y -= .04 * t * t; } }
  if (z < 0) { z *= 1.1; y *= 1.02; }
  if (y > -.4 && y < .1 && z > .2) x *= 1 + .05 * (1 - Math.abs(y + .15) / .25);
  if (y > .25 && z > .3) z *= .97;
  return [x, y, z];
}
function deformHead(g, r) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const [x, y, z] = headShape(p.getX(i) / r, p.getY(i) / r, p.getZ(i) / r); p.setXYZ(i, x * r, y * r, z * r); }
  g.computeVertexNormals(); return g;
}
const HEADP = (x, y, z, r = .125) => headShape(x / r, y / r, z / r).map(v => v * r);
// ---------- 共用幾何 ----------
const G = {
  torso: new THREE.LatheGeometry(V2([[0, .16], [.183, .16], [.17, .26], [.172, .36], [.176, .44], [.168, .5], [.14, .55], [.098, .59], [.06, .615], [.035, .628], [0, .632]]), 20),
  skirt: new THREE.LatheGeometry(V2([[0, -.44], [.168, -.44], [.176, -.435], [.18, -.42], [.184, -.34], [.19, -.22], [.194, -.1], [.192, -.03], [.19, 0], [.188, .08], [.184, .17]]), 20),
  fuki: new THREE.TorusGeometry(.176, .011, 5, 20),
  skirtLow: new THREE.LatheGeometry(V2([[0, -.2], [.16, -.2], [.175, -.19], [.17, -.14], [.165, -.06], [.16, .02]]), 20),
  thigh: new THREE.CylinderGeometry(.062, .054, .25, 10),
  shin: new THREE.CylinderGeometry(.042, .036, .17, 10),
  tabi: new THREE.BoxGeometry(.07, .05, .13),
  geta: new THREE.BoxGeometry(.085, .025, .19),
  tooth: new THREE.BoxGeometry(.08, .04, .025),
  strap: new THREE.TorusGeometry(.03, .006, 4, 10, PI),
  obi: new THREE.CylinderGeometry(.19, .192, .19, 10),
  cord: new THREE.TorusGeometry(.19, .008, 4, 20),
  taiko: (() => { const sh = new THREE.Shape(), w = .29, h = .24; sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h / 2 - .06); sh.quadraticCurveTo(w / 2, h / 2 + .03, 0, h / 2 + .035); sh.quadraticCurveTo(-w / 2, h / 2 + .03, -w / 2, h / 2 - .06); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: true, bevelThickness: .02, bevelSize: .015, bevelSegments: 4, curveSegments: 14 }); g.translate(0, 0, -.025); g.computeVertexNormals(); const U = g.attributes.uv; for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * 3.2 + .5, U.getY(i) * 3.2 + .5); return g; })(),
  knotB: new THREE.BoxGeometry(.12, .07, .05),
  sleeve: (() => { const sh = new THREE.Shape(), w = .2, h = .36, r = .09, x = -w / 2, y = -h;
    sh.moveTo(x, y + r); sh.lineTo(x, 0); sh.lineTo(x + w, 0); sh.lineTo(x + w, y + r); sh.quadraticCurveTo(x + w, y, x + w - r, y); sh.lineTo(x + r, y); sh.quadraticCurveTo(x, y, x, y + r);
    const g = new THREE.ExtrudeGeometry(sh, { depth: .03, bevelEnabled: true, bevelThickness: .028, bevelSize: .02, bevelSegments: 5, curveSegments: 12 });
    g.translate(0, 0, -.015); g.rotateY(PI / 2);
    // 袖口上緣收窄、下方鼓起：越往下越厚，像布料自然下垂
    const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i), t = Math.min(1, -y / .36); P.setX(i, P.getX(i) * (.55 + .6 * t)); P.setZ(i, P.getZ(i) + .012 * Math.sin(t * PI)); }
    g.computeVertexNormals(); return g; })(),
  arm: new THREE.CylinderGeometry(.04, .036, .26, 10),
  hand: new THREE.CapsuleGeometry(.034, .036, 4, 10),
  neck: new THREE.CylinderGeometry(.045, .05, .08, 10),
  head: deformHead(new THREE.SphereGeometry(.125, 28, 20), .125),
  decal: deformHead(new THREE.SphereGeometry(.1265, 24, 18, PI / 2 - .9, 1.8, PI * .28, PI * .5), .1265),
  ear: new THREE.SphereGeometry(.024, 8, 6),
  nose: (() => { const sh = new THREE.Shape(); sh.moveTo(-.011, 0); sh.lineTo(.011, 0); sh.lineTo(0, .034); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: .016, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2 }); g.translate(0, -.034, -.008); g.rotateX(-.25); return g; })(),
  eye: new THREE.SphereGeometry(.018, 10, 8),
  hi: new THREE.SphereGeometry(.0055, 6, 4),
  brow: new THREE.BoxGeometry(.036, .007, .006),
  mouth: new THREE.TorusGeometry(.014, .0035, 4, 10, PI),
  cheek: new THREE.CircleGeometry(.022, 12),
  collar: new THREE.BoxGeometry(.04, .24, .015),
  eri: new THREE.BoxGeometry(.03, .3, .012),
  capTop: deformHead(new THREE.SphereGeometry(.133, 18, 10, 0, PI * 2, 0, PI * .37), .133),
  capBack: deformHead(new THREE.SphereGeometry(.133, 18, 11, PI / 2 + .9, PI * 2 - 1.8, PI * .32, PI * .4), .133),
  side: deformHead(new THREE.SphereGeometry(.134, 18, 11, PI / 2 + .9, PI * 2 - 1.8, PI * .3, PI * .3), .134),
  knot: new THREE.CylinderGeometry(.022, .028, .16, 8),
  bun: new THREE.SphereGeometry(.085, 14, 10),
  hatG: new THREE.ConeGeometry(.34, .16, 24, 1, true),
  pin: new THREE.CylinderGeometry(.007, .007, .2, 5),
  fan: new THREE.CircleGeometry(.16, 12, 0, PI * .8),
  umb: new THREE.ConeGeometry(.55, .25, 16, 1, true),
  stick: new THREE.CylinderGeometry(.012, .012, .9, 5),
};
const M = {};
// 把群組裡「同材質、不會單獨動」的直屬零件合成一個網格，減少繪製次數（頭髮、飾品每次換裝都重建，可以安全合併）
function mergeGroup(gr) {
  const by = new Map();
  for (const o of [...gr.children]) { if (!o.isMesh || o.userData.dyn || Array.isArray(o.material)) continue; const k = o.material.uuid + (o.userData.minor ? 'm' : ''); if (!by.has(k)) by.set(k, []); by.get(k).push(o); }
  for (const list of by.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { o.updateMatrix(); let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g.applyMatrix4(o.matrix); });
    let mg; try { mg = mergeGeometries(geos, false); } catch (e) { mg = null; } if (!mg) continue;
    const m = new THREE.Mesh(mg, list[0].material); m.userData.minor = !!list[0].userData.minor; m.userData.merged = 1; list.forEach(o => gr.remove(o)); gr.add(m);
  }
}
const BLOB_G = new THREE.CircleGeometry(.36, 16), BLOB_M = new THREE.MeshBasicMaterial({ map: TX.radial('blob', 'rgba(0,0,0,.42)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false });
// 卡通著色（動畫風）：三階明暗，成本與標準材質相同
const GRAD = (() => { const d = new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
function TM(o = {}) { const { roughness, metalness, ...r } = o; return new THREE.MeshToonMaterial({ gradientMap: GRAD, ...r }); }
function mat(c, o = {}) { const k = c + JSON.stringify(o); return M[k] || (M[k] = TM({ color: c, roughness: .85, ...o })); }
const hairMat = TM({ map: TX.hairTex(), color: '#ffffff', roughness: .38, metalness: .06 });
function fabricMat(lk) {
  const kc = KIMONO[lk.k % KIMONO.length][1]; const k = 'F' + lk.k + '_' + lk.p;
  return M[k] || (M[k] = TM({ map: lk.p ? TX.pattern(lk.p, kc, lk.k === 9 ? '#5a5a66' : '#f4efe2') : TX.fabric(kc), roughness: .88 }));
}
function obiMat(i) { const k = 'OBI' + i; return M[k] || (M[k] = TM({ map: TX.obiTex(OBI[i], i), roughness: .5, metalness: .08 })); }
function mesh(g, m, par, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.castShadow = false; o.userData.minor = !shadow; par.add(o); return o; // 人物改用腳下圓影；shadow=false 的是小零件，中遠距離隱藏
}

export class Chara {
  constructor(look, name = '') {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.body.scale.setScalar(BODY_S); this.root.add(this.body); // Q 版：身體縮小、頭維持原大
    this.blob = new THREE.Mesh(BLOB_G, BLOB_M); this.blob.rotation.x = -PI / 2; this.blob.position.y = .012; this.blob.renderOrder = -1; this.root.add(this.blob);
    this.phase = Math.random() * 6; this.anim = 0; this.t = 0; this.lift = 0;
    // 腿：髖→大腿→膝→小腿→足袋木屐
    this.legs = []; this.knees = []; this.feet = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * .075, .5, 0); this.body.add(hip);
      const th = mesh(G.thigh, mat('#888'), hip, 0, -.125, 0);
      const knee = new THREE.Group(); knee.position.y = -.25; hip.add(knee);
      const sh = mesh(G.shin, mat('#f1d2b6'), knee, 0, -.085, 0);
      const foot = new THREE.Group(); foot.position.y = -.17; knee.add(foot);
      mesh(G.tabi, mat('#f4f1ea'), foot, 0, .005, .025);
      const geta = mesh(G.geta, mat('#7a5634'), foot, 0, -.032, .03);
      const teeth = [mesh(G.tooth, mat('#5a3e26'), foot, 0, -.06, .085), mesh(G.tooth, mat('#5a3e26'), foot, 0, -.06, -.02)];
      mesh(G.strap, mat('#b8302a'), foot, 0, -.01, .07, 0, 0, 0, 1, 1, 1, false);
      const koma = new THREE.Group(); koma.visible = false; foot.add(koma); (this.koma = this.koma || []).push(koma);
      mesh(new THREE.BoxGeometry(.1, .05, .22), mat('#16100e', { roughness: .25 }), koma, 0, -.07, .03);
      for (const tz of [.1, .03, -.05]) mesh(new THREE.BoxGeometry(.095, .11, .035), mat('#16100e', { roughness: .25 }), koma, 0, -.15, tz);
      mesh(new THREE.TorusGeometry(.032, .008, 4, 10, Math.PI), mat('#c8202e'), koma, 0, -.035, .08, 0, 0, 0, 1, 1, 1, false);
      th.userData.minor = sh.userData.minor = true; hip.userData = { th, sh, geta, teeth }; this.legs.push(hip); this.knees.push(knee); this.feet.push(foot);
    }
    // 上身（髖為原點）
    this.upper = new THREE.Group(); this.upper.position.y = .5; this.body.add(this.upper);
    this.torsoM = mesh(G.torso, mat('#888'), this.upper);
    this.skirtG = new THREE.Group(); this.upper.add(this.skirtG);
    this.skirtM = mesh(G.skirt, mat('#888'), this.skirtG);
    this.lowG = new THREE.Group(); this.upper.add(this.lowG); this.skirtLowM = mesh(G.skirtLow, mat('#888'), this.lowG); this.lowG.visible = false;
    this.obiM = mesh(G.obi, mat('#888'), this.upper, 0, .25, 0);
    this.obiageM = mesh(new THREE.CylinderGeometry(.18, .186, .024, 10), mat('#888'), this.upper, 0, .352, 0, 0, 0, 0, 1, 1, 1, false);
    this.cordM = mesh(G.cord, mat('#c8322a'), this.upper, 0, .245, 0, PI / 2, 0, 0, 1.02, 1.02, 1, false);
    this.bowM = mesh(G.taiko, mat('#888'), this.upper, 0, .25, -.2);
    this.detailG = new THREE.Group(); this.upper.add(this.detailG);
    for (const s of [-1, 1]) { mesh(G.eri, mat('#f8f4ec', { roughness: .6 }), this.detailG, s * .036, .5, .156, -.36, 0, -s * .26, .8, 1, 1, false); }
    this.collarC = [];
    for (const s of [-1, 1]) this.collarC.push(mesh(G.eri, mat('#888'), this.detailG, s * .058, .49, .16, -.36, 0, -s * .28, 1.3, 1.02, 1, false));
    this.fukiM = mesh(G.fuki, mat('#c8322a'), this.skirtG, 0, -.432, 0, PI / 2, 0, 0, 1, 1, 1, false);
    this.neckM = mesh(G.neck, mat('#f1d2b6'), this.upper, 0, .655, 0);
    // 手臂：肩→和服袖＋手
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * .2, .56, 0);
      const arm = mesh(G.arm, mat('#888'), a, 0, -.14, .03, .12, 0, 0);
      const sl = mesh(G.sleeve, mat('#888'), a, s * .012, -.015, -.02, 0, 0, 0, 1, 1, 1);
      const lin = mesh(G.sleeve, mat('#c8322a'), a, s * .012, -.03, -.02, 0, 0, 0, .85, 1, .98, false);
      const h = mesh(G.hand, mat('#f1d2b6'), a, 0, -.29, .08, .35, 0, 0, .9, 1, .75);
      const th = mesh(G.hand, mat('#f1d2b6'), a, -s * .02, -.27, .1, .3, 0, s * .8, .45, .6, .45, false);
      a.userData = { sl, h, arm, lin, th }; this.upper.add(a); this.arms.push(a);
    }
    // 頭
    this.upper.scale.set(BODY_W, 1, BODY_W);
    this.headG = new THREE.Group(); this.headG.position.y = .775; this.headG.scale.set(.9 / BODY_W, .9, .9 / BODY_W); this.upper.add(this.headG);
    this.headM = mesh(G.head, mat('#f1d2b6'), this.headG, 0, 0, 0);
    this.faceG = new THREE.Group(); this.headG.add(this.faceG);
    this.skinParts = [];
    this.backG = new THREE.Group(); this.backG.position.set(0, .38, -.2); 
    this.hairG = new THREE.Group(); this.headG.add(this.hairG);
    this.accG = new THREE.Group(); this.headG.add(this.accG); this.upper.add(this.backG);
    this.carryG = new THREE.Group(); this.arms[1].add(this.carryG);
    this.oiranG = new THREE.Group(); this.upper.add(this.oiranG); this.auraG = new THREE.Group(); this.root.add(this.auraG);
    this.foodG = new THREE.Group(); this.foodG.position.set(0, -.36, .12); this.arms[0].add(this.foodG);
    this.waistG = new THREE.Group(); this.waistG.position.y = .22; this.upper.add(this.waistG);
    this.setLook(look);
    this.name = name; if (name) this.setName(name);
  }
  setLook(lk) { this._setLook(lk); mergeGroup(this.hairG); mergeGroup(this.accG); this.tier = -1; }
  _setLook(lk) {
    this.tier = -1;
    lk = Object.assign({ k: 0, p: 0, o: 0, h: 0, s: 0, hat: 0, c: 0, w: 0, f: '' }, lk || {});
    this.look = lk;
    const km = fabricMat(lk), skin = mat(SKINS[lk.s % 3], { roughness: .55, emissive: '#6a2a18', emissiveIntensity: .07 }), obi = obiMat(lk.o % OBI.length);
    this.obiageM.material = mat(['#e8889a', '#f2d27a', '#8ab4d8', '#f4f0e4', '#c8a0d8', '#a8d8b0'][(lk.o + 3) % 6], { roughness: .7 });
    this.torsoM.material = this.skirtM.material = km; this.legs.forEach(l => { l.userData.th.material = km; l.userData.sh.material = skin; l.userData.geta.material = mat('#7a5634'); l.userData.geta.scale.y = 1; l.userData.teeth.forEach((t, i) => { t.material = mat('#5a3e26'); t.scale.set(1, 1, 1); t.position.y = -.06; t.visible = true; }); });
    this.collarC.forEach(c => c.material = km); this.skirtLowM.material = km; this.arms.forEach(a => { a.userData.sl.material = km; a.userData.arm.material = km; a.userData.sl.scale.set(1, 1, 1); a.userData.h.material = a.userData.th.material = skin; a.userData.lin.material = mat(['#c8322a', '#f4f0e4', '#d8a8b8', '#e8c56a'][(lk.k + lk.o) % 4]); a.userData.lin.visible = true; a.userData.lin.userData.minor = true; });
    this.fukiM.material = mat(['#c8322a', '#f4f0e4', '#d8a8b8', '#e8c56a'][(lk.k + lk.o) % 4], { roughness: .6 });
    this.obiM.material = obi; this.bowM.material = obi; this.headM.material = skin; this.neckM.material = skin; this.buildFace(lk, skin); this.apply3d();
    this.cordM.material = mat(['#c8322a', '#e8c56a', '#3a6a8a', '#f4f0e4', '#8a3a6a', '#2f6a4a'][(lk.o + 2) % 6]);
    const female = [1, 4, 5, 6, 7].includes(lk.h % HAIRS.length);
    this.obiM.scale.set(1, female ? 1 : .5, 1); this.obiM.position.y = female ? .25 : .19; this.obiageM.visible = female; this.cordM.visible = female; this.fukiM.visible = female;
    this.bowM.geometry = female ? G.taiko : G.knotB; this.bowM.position.set(0, female ? .25 : .23, female ? -.215 : -.2);
    this.hairG.clear(); this.accG.clear(); this.carryG.clear(); this.foodG.clear(); this.waistG.clear(); this.oiranG.clear(); this.auraG.clear(); this.backG.clear(); this.wheel = null;
    if (this.light) { this.root.remove(this.light); this.light = null; }
    this.lift = 0; this.koma.forEach(k => k.visible = false); this.legs.forEach(l => { l.userData.geta.visible = true; l.userData.teeth.forEach(t => { t.userData.minor = true; }); });
    this.outfit(lk, km, skin);
    if (this.gm) { this.buildOiran(lk); return; }
    const H = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => mesh(g, hairMat, this.hairG, x, y, z, rx, 0, rz, sx, sy, sz);
    const HC = (y = .005, s = 1.04) => { H(G.capTop, 0, y, -.008, s, s * 1.02, s * 1.05); H(G.capBack, 0, y - .005, -.01, s * 1.02, s * 1.04, s * 1.06); };
    switch (lk.h % HAIRS.length) {
      case 0: { // 丁髷：剃過的月代（青灰）、兩側鬢髮、向前折的髷
        H(G.side, 0, 0, -.005, 1.06, 1.05, 1.07);
        const k = H(G.knot, 0, .145, -.03); k.rotation.x = PI / 2 - .25; H(G.bun, 0, .12, -.1, .35, .35, .5); break;
      }
      case 1: { // 島田髷：前髮、兩鬢、頭頂大髷、後髷
        HC(); H(G.bun, 0, .098, .072, .58, .36, .45); for (const s of [-1, 1]) H(G.bun, s * .11, .0, -.01, .45, .6, .7);
        H(G.bun, 0, .17, -.04, 1.25, .62, .85); H(G.bun, 0, .05, -.14, .95, .75, .7); H(G.knot, 0, .17, -.04, 1.8, .55, 1.8, 0, PI / 2);
        break;
      }
      case 2: { HC(0, 1.05); const k = H(G.knot, 0, .02, -.16); k.rotation.x = .55; k.scale.set(1.6, 1.4, 1.6); H(G.bun, 0, -.06, -.2, .35, .9, .35); break; } // 総髪
      case 3: { break; } // 坊主：光頭就是頭皮本身，不另外加片
      case 5: { HC(0, 1.05); // おかっぱ：齊瀏海、兩側到下巴、後面整齊
        for (const sx of [-1, 1]) H(new THREE.BoxGeometry(.05, .2, .2), sx * .118, -.05, -.02, 1, 1, 1);
        H(new THREE.BoxGeometry(.24, .2, .06), 0, -.05, -.12); H(new THREE.BoxGeometry(.22, .05, .05), 0, .085, .11); break; }
      case 6: { HC(); H(G.bun, 0, .05, -.13, .45, .45, .45); // ポニー：高馬尾＋綁帶
        const tail = H(new THREE.CylinderGeometry(.045, .015, .28, 8), 0, -.08, -.2); tail.rotation.x = .35;
        mesh(new THREE.TorusGeometry(.035, .01, 4, 10), mat('#c8322a'), this.hairG, 0, .06, -.14, .3, 0, 0, 1, 1, 1, false); break; }
      case 7: { HC(); H(new THREE.BoxGeometry(.24, .42, .05), 0, -.13, -.12); for (const sx of [-1, 1]) H(new THREE.BoxGeometry(.045, .3, .14), sx * .118, -.08, -.04); // 垂髪：長髮披背
        mesh(new THREE.BoxGeometry(.08, .025, .02), mat('#f4efe2'), this.hairG, 0, -.06, -.15, 0, 0, 0, 1, 1, 1, false); break; }
      case 4: { HC(); H(G.bun, 0, .092, .07, .54, .34, .42); for (const s of [-1, 1]) { H(G.bun, s * .1, .15, -.02, .78, .78, .78); mesh(G.pin, mat('#d8b24a', { metalness: .6, roughness: .3 }), this.hairG, s * .1, .15, -.02, 0, 0, PI / 2, 1, .9, 1); } break; } // 唐輪
    }
    if (lk.hat === 1) { const h = mesh(G.hatG, mat('#c9a868', { side: THREE.DoubleSide }), this.accG, 0, .2, 0); for (let i = 0; i < 6; i++) mesh(new THREE.TorusGeometry(.34 - i * .05, .004, 3, 20), mat('#8a6a3a'), this.accG, 0, .13 + i * .022, 0, PI / 2, 0, 0, 1, 1, 1, false); mesh(new THREE.CylinderGeometry(.003, .003, .3, 3), mat('#5a3a2a'), this.accG, 0, -.06, .1, .3, 0, 0, 1, 1, 1, false); }
    if (lk.hat === 2) { for (const s of [-1, 1]) { mesh(G.pin, mat('#d8b24a', { metalness: .7, roughness: .25 }), this.accG, s * .06, .19, -.06, 0, 0, s * 1.2); mesh(new THREE.SphereGeometry(.024, 10, 8), mat('#d23c4c', { roughness: .3 }), this.accG, s * .15, .23, -.06); for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(.004, .05, .004), mat('#d8b24a', { metalness: .7, roughness: .25 }), this.accG, s * (.15 + (i - 1) * .012), .19, -.06, 0, 0, 0, 1, 1, 1, false); } }
    if (lk.hat === 3) { mesh(new THREE.TorusGeometry(.133, .02, 5, 20), mat('#f4efe4'), this.accG, 0, .05, 0, PI / 2 - .15, 0, 0); mesh(new THREE.BoxGeometry(.07, .05, .05), mat('#f4efe4'), this.accG, 0, .07, -.14); mesh(new THREE.BoxGeometry(.02, .09, .01), mat('#f4efe4'), this.accG, .03, .02, -.15, 0, 0, .3); }
    if (lk.hat === 4) { const f = new THREE.Group(); mesh(new THREE.SphereGeometry(.095, 14, 10, 0, PI * 2, 0, PI / 2), mat('#f7f3ea', { roughness: .4 }), f, 0, 0, 0, PI / 2, 0, 0);
      mesh(new THREE.ConeGeometry(.035, .07, 10), mat('#f7f3ea', { roughness: .4 }), f, 0, -.02, .1, PI / 2, 0, 0);
      for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.03, .08, 4), mat('#f7f3ea'), f, s * .055, .085, 0); mesh(new THREE.BoxGeometry(.035, .008, .01), mat('#c8322a'), f, s * .04, .02, .085, 0, 0, s * .4); mesh(new THREE.BoxGeometry(.02, .006, .01), mat('#c8322a'), f, s * .055, -.01, .075, 0, 0, s * -.3); }
      mesh(new THREE.SphereGeometry(.011, 6, 4), mat('#1a1210'), f, 0, -.02, .135); f.position.set(.11, .04, .05); f.rotation.y = .9; this.accG.add(f); }
    if (lk.w === 1) { mesh(new THREE.BoxGeometry(.07, .1, .04), mat('#1a1414', { roughness: .25, metalness: .2 }), this.waistG, .17, -.1, .1); mesh(new THREE.CylinderGeometry(.004, .004, .1, 4), mat('#c9a24a'), this.waistG, .17, -.02, .1); mesh(new THREE.SphereGeometry(.018, 8, 6), mat('#c9a24a', { metalness: .6 }), this.waistG, .17, .03, .11); }
    if (lk.w === 2) { mesh(new THREE.SphereGeometry(.05, 10, 8), mat('#b8352f'), this.waistG, -.17, -.11, .1, 0, 0, 0, 1, 1.2, 1); mesh(new THREE.CylinderGeometry(.02, .03, .03, 8), mat('#c9a24a'), this.waistG, -.17, -.04, .1); }
    this.buildAcc(lk);
    this.addHeld(lk);
    if (lk.c === 1) { mesh(G.fan, mat('#f2e6c8', { side: THREE.DoubleSide }), this.carryG, 0, -.36, .1, -1.2, 0, .6); }
    if (lk.c === 2) { mesh(G.stick, mat('#4a3424'), this.carryG, 0, .05, .08); mesh(G.umb, mat('#b8352f', { side: THREE.DoubleSide }), this.carryG, 0, .55, .08); for (let i = 0; i < 8; i++) mesh(new THREE.CylinderGeometry(.004, .004, .58, 3), mat('#e8dcc0'), this.carryG, Math.cos(i / 8 * PI * 2) * .24, .5, .08 + Math.sin(i / 8 * PI * 2) * .24, Math.sin(i / 8 * PI * 2) * .45, 0, -Math.cos(i / 8 * PI * 2) * .45, 1, 1, 1, false); }
  }
  // ---------- 五官 ----------
  buildFace(lk, skin) {
    const F = this.faceG; F.clear(); this.skinParts = []; this.decal = null;
    if (TX.IMG.face) {
      for (const s of [-1, 1]) this.skinParts.push(mesh(G.ear, skin, F, s * .108, -.012, -.008, 0, 0, 0, .5, 1.15, .8, false));
      this.noseM = mesh(G.nose, skin, F, 0, -.01, .122, 0, 0, 0, .45, .4, .4, false);
      this.faceBase = { ey: (lk.ey || 0) % 5, br: (lk.br || 0) % 4, mo: (lk.mo || 0) % 4, ck: lk.ck == null ? 1 : lk.ck % 3, mk: lk.mk ? 1 : 0 }; this.faceKey = '';
      const b = this.faceBase, tex = TX.faceTex(b.ey, b.br, b.mo, b.ck, b.mk);
      this.decal = mesh(G.decal, TM({ map: tex, transparent: true, depthWrite: false, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2 }), F, 0, 0, 0, 0, 0, 0, 1, 1, 1, false);
      this.mouthM = this.noseM; return;
    }
    const dark = mat('#1a1210', { roughness: .3 }), hl = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: .4 });
    const ey = (lk.ey || 0) % 5, br = (lk.br || 0) % 4, mo = (lk.mo || 0) % 4, ck = lk.ck == null ? 1 : lk.ck % 3;
    for (const s of [-1, 1]) {
      this.skinParts.push(mesh(G.ear, skin, F, s * .118, -.01, -.005, 0, 0, 0, .55, 1, .8, false));
      const x = s * .044, y = .004, z = .108;
      if (ey === 4) mesh(new THREE.TorusGeometry(.016, .0045, 4, 12, PI), dark, F, x, y - .006, z + .004, 0, 0, 0, 1, 1, 1, false);
      else {
        const [sx, sy, rz] = [[1, 1.25, 0], [1.45, .72, s * .16], [1.3, .92, -s * .24], [1.42, .78, s * .38]][ey];
        mesh(G.eye, mat('#fbf8f2', { roughness: .3 }), F, x, y, z - .003, 0, 0, rz, sx * 1.2, sy * 1.0, .42, false);
        mesh(G.eye, mat('#2a1a12', { roughness: .25 }), F, x, y - .001, z + .003, 0, 0, rz, sx * .74, sy * .82, .5, false);
        mesh(G.hi, hl, F, x + .006, y + .007, z + .011, 0, 0, 0, 1, 1, 1, false);
        mesh(new THREE.BoxGeometry(.04, .005, .006), dark, F, x, y + .02 * sy, z + .006, 0, 0, rz, sx, 1, 1, false);
        if (ey === 2) mesh(new THREE.BoxGeometry(.03, .004, .004), dark, F, x + s * .006, y - .022, z + .002, 0, 0, -s * .3, 1, 1, 1, false);
      }
      if (br === 2) mesh(G.hi, hairMat, F, s * .04, .07, .108, 0, 0, 0, 3, 2, 1, false);
      else { const [bsx, bsy, brz, by] = [[1, 1, -s * .12, .046], [1.15, 2.2, -s * .1, .048], [0, 0, 0, 0], [1.1, 1.5, s * .32, .043]][br]; mesh(G.brow, hairMat, F, s * .047, by, .112, 0, 0, brz, bsx, bsy, 1, false); }
      if (ck) mesh(G.cheek, mat('#f08a8a', { transparent: true, opacity: ck === 2 ? .6 : .38 }), F, s * .07, -.03, .1, 0, s * .55, 0, ck === 2 ? 1.35 : 1, ck === 2 ? 1.2 : 1, 1, false);
    }
    if (lk.mk) mesh(new THREE.SphereGeometry(.004, 6, 4), dark, F, .058, -.022, .112, 0, 0, 0, 1, 1, 1, false);
    this.noseM = mesh(G.nose, skin, F, 0, -.024, .119, 0, 0, 0, .8, .7, .65, false);
    const lip = mat('#a5463a');
    if (mo === 0) this.mouthM = mesh(G.mouth, lip, F, 0, -.052, .112, 0, 0, PI, 1, 1, 1, false);
    else if (mo === 1) { this.mouthM = mesh(new THREE.CircleGeometry(.021, 14, PI, PI), mat('#7a2a24'), F, 0, -.046, .1195, 0, 0, 0, 1, .9, 1, false); mesh(new THREE.CircleGeometry(.012, 10, PI, PI), mat('#e8707a'), F, 0, -.058, .12, 0, 0, 0, 1, .7, 1, false); }
    else if (mo === 2) this.mouthM = mesh(new THREE.TorusGeometry(.008, .0035, 5, 12), lip, F, 0, -.054, .115, 0, 0, 0, 1, 1.2, 1, false);
    else this.mouthM = mesh(new THREE.BoxGeometry(.03, .005, .006), lip, F, 0, -.052, .116, 0, 0, 0, 1, 1, 1, false);
  }
  // ---------- 飾品（頭部 hat、髮飾 hs、面具 m、腰間 w、手持 c、背上 b）----------
  buildAcc(lk) {
    const gold = mat('#d8b24a', { metalness: .75, roughness: .25 }), straw = mat('#c9a868', { side: THREE.DoubleSide, roughness: .9 });
    const A = this.accG, W = this.waistG, C = this.carryG, B = this.backG;
    // 頭部
    if (lk.hat === 5) { mesh(new THREE.SphereGeometry(.2, 18, 8, 0, PI * 2, 0, PI / 2), straw, A, 0, .02, 0, 0, 0, 0, 1, .85, 1); mesh(new THREE.TorusGeometry(.2, .012, 4, 20), mat('#8a6a3a'), A, 0, .02, 0, PI / 2, 0, 0, 1, 1, 1, false); for (let i = 0; i < 5; i++) mesh(new THREE.TorusGeometry(.19 - i * .03, .003, 3, 20), mat('#8a6a3a'), A, 0, .05 + i * .028, 0, PI / 2, 0, 0, 1, 1, 1, false); }
    if (lk.hat === 6) { mesh(new THREE.ConeGeometry(.27, .09, 24), mat('#141012', { roughness: .2, metalness: .3 }), A, 0, .16, 0); mesh(new THREE.CircleGeometry(.045, 16), gold, A, 0, .205, .001, -PI / 2 + .3, 0, 0, 1, 1, 1, false); }
    if (lk.hat === 7) { mesh(new THREE.SphereGeometry(.142, 18, 8, 0, PI * 2, 0, PI * .45), TM({ map: TX.pattern(2, '#2a4b7c', '#f4efe2'), roughness: .9 }), A, 0, .01, -.01, 0, 0, 0, 1.05, 1.08, 1.08); mesh(new THREE.BoxGeometry(.06, .04, .04), mat('#2a4b7c'), A, 0, .14, .1); }
    if (lk.hat === 8) { mesh(new THREE.SphereGeometry(.15, 18, 10, 0, PI * 2, 0, PI * .62), mat('#3a3a44', { side: THREE.DoubleSide }), A, 0, .0, -.012, 0, 0, 0, 1.06, 1.12, 1.1); }
    // 髮飾
    const hs = lk.hs || 0;
    if (hs === 1) for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; mesh(new THREE.SphereGeometry(.02, 8, 6), [mat('#f29bb6'), mat('#e8455c'), mat('#ffffff')][i % 3], A, .13 + Math.cos(a) * .035, .1 + Math.sin(a) * .035, .02, 0, 0, 0, 1, 1, .6); }
    if (hs === 2) { mesh(new THREE.BoxGeometry(.17, .05, .014), mat('#6a3a1a', { metalness: .35, roughness: .28 }), A, 0, .17, .07, -.4); mesh(new THREE.BoxGeometry(.175, .007, .016), gold, A, 0, .195, .075, -.4, 0, 0, 1, 1, 1, false); }
    if (hs === 3) for (const s of [-1, 1]) { mesh(new THREE.CircleGeometry(.04, 12), mat('#e8c56a', { side: THREE.DoubleSide, metalness: .6, roughness: .3 }), A, -.12 + s * .03, .14, -.02, 0, -.9, s * .5, 1, .7, 1, false); }
    if (hs === 4) { mesh(G.pin, gold, A, .05, .17, -.08, 0, 0, 1.2); mesh(new THREE.SphereGeometry(.03, 12, 10), mat('#c21f32', { roughness: .25 }), A, .14, .21, -.08); }
    // 面具（戴在頭側）
    const m = lk.m || 0;
    if (m) {
      const f = new THREE.Group(); f.position.set(.11, .04, .05); f.rotation.y = .9; A.add(f);
      const base = { 1: '#f7f3ea', 2: '#f0c9a0', 3: '#fbf6ee', 4: '#c8322a', 5: '#efe6d0', 6: '#b8282e', 7: '#fbfaf6', 8: '#c8322a' }[m];
      mesh(new THREE.SphereGeometry(.095, 14, 10, 0, PI * 2, 0, PI / 2), mat(base, { roughness: .4 }), f, 0, 0, 0, PI / 2, 0, 0);
      if (m === 1) { mesh(new THREE.ConeGeometry(.035, .07, 10), mat(base), f, 0, -.02, .1, PI / 2, 0, 0); for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.03, .08, 4), mat(base), f, s * .055, .085, 0); mesh(new THREE.BoxGeometry(.035, .008, .01), mat('#c8322a'), f, s * .04, .02, .085, 0, 0, s * .4); } }
      if (m === 2) { mesh(new THREE.TorusGeometry(.016, .007, 5, 12), mat('#c8322a'), f, .02, -.04, .09); for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.014, 8, 6), mat('#1a1210'), f, s * .035 + (s > 0 ? .012 : 0), .02, .085, 0, 0, 0, 1, s > 0 ? .6 : 1, .5); }
      if (m === 3) { for (const s of [-1, 1]) { mesh(new THREE.CircleGeometry(.022, 12), mat('#f07a8a'), f, s * .05, -.015, .09, 0, s * .4, 0, 1, 1, 1, false); mesh(new THREE.BoxGeometry(.025, .005, .004), mat('#1a1210'), f, s * .035, .02, .093, 0, 0, s * .2); } mesh(new THREE.SphereGeometry(.009, 6, 4), mat('#c8322a'), f, 0, -.04, .094); }
      if (m === 5) { for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.015, .1, 8), gold, f, s * .06, .1, .02, 0, 0, -s * .5); mesh(new THREE.BoxGeometry(.035, .01, .008), gold, f, s * .035, .02, .09, 0, 0, s * .45); } mesh(new THREE.BoxGeometry(.07, .02, .008), mat('#7a1a1a'), f, 0, -.045, .09); mesh(new THREE.BoxGeometry(.06, .006, .009), mat('#ffffff'), f, 0, -.04, .093); }
      if (m === 6) { for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.018, .08, 8), mat('#f2e6c8'), f, s * .05, .1, .02, 0, 0, -s * .3); mesh(new THREE.ConeGeometry(.008, .025, 6), mat('#ffffff'), f, s * .025, -.055, .09, PI, 0, 0); mesh(new THREE.SphereGeometry(.013, 8, 6), mat('#f2d27a'), f, s * .035, .02, .088); } }
      if (m === 7) { for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(.03, .06, 4), mat(base), f, s * .055, .085, 0); mesh(new THREE.ConeGeometry(.015, .03, 4), mat('#f2a0b0'), f, s * .055, .08, .015); for (let w = 0; w < 3; w++) mesh(new THREE.BoxGeometry(.05, .002, .002), mat('#1a1210'), f, s * .06, -.02 + w * .01, .088, 0, 0, s * (w - 1) * .2, 1, 1, 1, false); mesh(new THREE.BoxGeometry(.025, .006, .004), mat('#1a1210'), f, s * .035, .02, .09, 0, 0, -s * .3); } mesh(new THREE.SphereGeometry(.01, 6, 4), mat('#f2a0b0'), f, 0, -.01, .095); }
      if (m === 8) { mesh(new THREE.SphereGeometry(.03, 10, 8), mat('#c8322a'), f, 0, -.01, .1); for (const s of [-1, 1]) { mesh(new THREE.SphereGeometry(.018, 8, 6), gold, f, s * .04, .03, .085); mesh(new THREE.TorusGeometry(.025, .008, 5, 12, PI), mat('#1a1a1a'), f, s * .04, .05, .08); } mesh(new THREE.BoxGeometry(.08, .015, .01), mat('#ffffff'), f, 0, -.05, .088); mesh(new THREE.TorusGeometry(.11, .02, 5, 18, PI * 1.4), mat('#2f6a4a'), f, 0, 0, -.01, 0, 0, -PI * .2); }
      if (m === 4) { mesh(new THREE.CylinderGeometry(.012, .022, .12, 8), mat('#c8322a'), f, 0, -.005, .15, PI / 2, 0, 0); for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.04, .012, .008), mat('#1a1210'), f, s * .04, .035, .088, 0, 0, s * .35); }
    }
    // 腰間
    if (lk.w === 3) for (const [len, dy] of [[.62, 0], [.42, -.04]]) mesh(new THREE.CylinderGeometry(.014, .014, len, 6), mat('#141012', { roughness: .25, metalness: .2 }), W, -.17, -.02 + dy, .02, 1.25, 0, .25, 1, 1, 1);
    if (lk.w === 3) mesh(new THREE.CylinderGeometry(.028, .028, .01, 10), gold, W, -.18, .03, .2, 1.25, 0, .25);
    if (lk.w === 4) { mesh(new THREE.BoxGeometry(.07, .08, .03), mat('#6a4a2a', { roughness: .5 }), W, .17, -.1, .1); mesh(new THREE.CylinderGeometry(.012, .012, .14, 6), mat('#2a1d14'), W, .19, -.08, .11, 0, 0, .3); }
    // 手持
    if (lk.c === 3) { mesh(G.stick, mat('#4a3424'), C, 0, .05, .08); mesh(G.umb, TM({ map: TX.janome(), side: THREE.DoubleSide, roughness: .7 }), C, 0, .55, .08); }
    if (lk.c === 4) { mesh(new THREE.CylinderGeometry(.006, .006, .14, 4), mat('#c9a868'), C, 0, -.32, .1); mesh(new THREE.CircleGeometry(.09, 18), TM({ map: TX.text('涼', { w: 128, h: 128, bg: '#f4efe2', fg: '#2a4b7c', vertical: false }), side: THREE.DoubleSide }), C, 0, -.2, .1, -.6, 0, 0, 1, 1, 1, false); }
    if (lk.c === 5) { mesh(new THREE.CylinderGeometry(.006, .006, .45, 4), mat('#c9a868'), C, 0, -.12, .1); this.wheel = new THREE.Group(); this.wheel.position.set(0, .12, .13); C.add(this.wheel); ['#e8455c', '#3f97ad', '#e8c56a', '#5c9a68'].forEach((c, i) => mesh(new THREE.ConeGeometry(.05, .09, 3), mat(c, { side: THREE.DoubleSide }), this.wheel, Math.cos(i * PI / 2) * .04, Math.sin(i * PI / 2) * .04, 0, 0, 0, i * PI / 2, 1, 1, .2, false)); }
    if (lk.c === 8) { mesh(new THREE.CylinderGeometry(.002, .002, .2, 3), mat('#f4efe2'), C, 0, -.38, .1); const yb = mesh(new THREE.SphereGeometry(.06, 12, 10), mat('#e8455c', { roughness: .25 }), C, 0, -.5, .1); yb.scale.y = .9; mesh(new THREE.TorusGeometry(.061, .008, 4, 16), mat('#f2d27a'), C, 0, -.5, .1, PI / 2); }
    if (lk.c === 7) { mesh(new THREE.CylinderGeometry(.003, .003, .1, 3), mat('#e84a5c'), C, 0, -.34, .1); const bag = mesh(new THREE.SphereGeometry(.07, 14, 12), TM({ color: '#cfe8f4', transparent: true, opacity: .45, roughness: .1, metalness: .1 }), C, 0, -.46, .1, 0, 0, 0, 1, 1.15, 1, false);
      for (let i = 0; i < 2; i++) { const fish = new THREE.Group(); fish.position.set(-.02 + i * .04, -.47 - i * .02, .1); fish.rotation.y = i * 2; C.add(fish); mesh(new THREE.SphereGeometry(.015, 8, 6), mat('#f05a28'), fish, 0, 0, 0, 0, 0, 0, 1.4, .8, .8, false); mesh(new THREE.ConeGeometry(.012, .02, 4), mat('#f05a28'), fish, -.025, 0, 0, 0, 0, PI / 2, 1, 1, .4, false); } }
    if (lk.c === 6) { mesh(new THREE.CylinderGeometry(.006, .006, .3, 4), mat('#4a3424'), C, 0, -.2, .18, 1.1, 0, 0); const lan = mesh(new THREE.SphereGeometry(.08, 12, 10), TM({ color: '#f4e4c0', emissive: '#ffb050', emissiveIntensity: .8 }), C, 0, -.28, .36, 0, 0, 0, 1, 1.3, 1); }
    // 背上
    if (lk.b === 1) { mesh(new THREE.SphereGeometry(.15, 12, 10), TM({ map: TX.karakusa(), roughness: .9 }), B, 0, .02, -.08, 0, 0, 0, 1.1, .85, .7); mesh(new THREE.TorusGeometry(.12, .015, 5, 16, PI), mat('#3a7a4a'), B, 0, .14, .14, -PI / 2, 0, 0); }
    if (lk.b === 2) { mesh(new THREE.CylinderGeometry(.13, .1, .3, 10, 1, true), mat('#9a7a4a', { side: THREE.DoubleSide, roughness: 1 }), B, 0, 0, -.1); for (let i = 0; i < 4; i++) mesh(new THREE.TorusGeometry(.125 - i * .008, .006, 3, 16), mat('#6a4a2a'), B, 0, -.12 + i * .08, -.1, PI / 2, 0, 0, 1, 1, 1, false); }
    if (lk.b === 3) { mesh(new THREE.BoxGeometry(.18, .18, .07), mat('#3a2418', { roughness: .4 }), B, .02, -.12, -.06, 0, 0, .25); mesh(new THREE.CylinderGeometry(.012, .012, .62, 6), mat('#2a1810'), B, -.06, .22, -.07, 0, 0, .25); mesh(new THREE.CircleGeometry(.065, 12), mat('#f4efe2'), B, .02, -.12, -.024, 0, 0, 0, 1, 1, 1, false); }
  }
  addHeld(lk) { if (lk.f && Chara.foodModel) { const d = Chara.foodModel(lk.f); if (d) { d.scale.multiplyScalar(1.15); this.foodG.add(d); } } }

  // ---------- GM：花魁 ----------
  buildOiran(lk) {
    const P = (g, m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, par = this.oiranG) => mesh(g, m, par, x, y, z, rx, ry, rz, sx, sy, sz);
    const goldM = mat('#e8bf4e', { metalness: .9, roughness: .22 }), redM = mat('#c21f32', { roughness: .45 }), tortoise = mat('#6a3a1a', { metalness: .35, roughness: .28 });
    const inner = TM({ map: TX.oiranTex('in'), roughness: .5, metalness: .2 });
    const robe = TM({ map: TX.oiranTex('out'), roughness: .45, metalness: .25, side: THREE.DoubleSide });
    const skin = mat('#f8f4ef', { roughness: .4 });
    this.torsoM.material = this.skirtM.material = inner; this.collarC.forEach(c => c.material = redM);
    this.legs.forEach(l => { l.userData.th.material = inner; l.userData.sh.material = skin; });
    this.skirtLowM.material = inner; this.arms.forEach(a => { a.userData.lin.visible = false; a.userData.lin.userData.minor = false; a.userData.th.material = skin; a.userData.sl.material = robe; a.userData.arm.material = robe; a.userData.sl.scale.set(1.3, 1.45, 1.45); a.userData.h.material = skin; });
    this.headM.material = skin; this.skinParts.forEach(p => p.material = skin);
    this.obiM.material = goldM; this.bowM.material = goldM; this.bowM.geometry = G.knotB; this.cordM.material = redM;
    // 袖口多層衣緣
    for (const a of this.arms) [['#c21f32', 1], ['#e8bf4e', 2]].forEach(([c, n]) => mesh(G.sleeve, mat(c, c === '#e8bf4e' ? { metalness: .8, roughness: .3 } : {}), a, .002 * n, -.015 - n * .016, -.02 - .004 * n, 0, 0, 0, 1.24, 1.45, 1.45));
    // 打掛：拖地外罩（前開）＋紅色厚下襬（ふき）＋後襬
    const pts = V2([[.0, -.52], [.4, -.52], [.37, -.3], [.3, .05], [.27, .4], [.24, .58], [.16, .66], [0, .67]]);
    P(new THREE.LatheGeometry(pts, 28, PI * .3, PI * 1.4), robe, 0, 0, -.02, 0, 0, 0, 1, 1, 1.18);
    P(new THREE.TorusGeometry(.395, .022, 5, 20, PI * 1.4), redM, 0, -.51, -.02, PI / 2, 0, PI * .3, 1, 1.18, 1);
    P(new THREE.CircleGeometry(.48, 24, PI * .1, PI * .8), robe, 0, -.515, -.32, -PI / 2, 0, PI, 1, 1, 1);
    // 前結帶：大蝴蝶結＋長垂帶＋流蘇
    const obiTex = TM({ map: TX.oiranTex('obi'), metalness: .55, roughness: .3 });
    P(new THREE.BoxGeometry(.28, .56, .05), obiTex, 0, -.04, .235, -.05);
    P(new THREE.BoxGeometry(.4, .2, .1), obiTex, 0, .26, .22);
    for (const s of [-1, 1]) { P(new THREE.SphereGeometry(.11, 14, 10), obiTex, s * .17, .3, .27, 0, 0, s * .55, 1.35, .65, .45); P(new THREE.SphereGeometry(.06, 12, 8), redM, s * .13, .3, .31, 0, 0, s * .5, 1.2, .55, .4); }
    P(new THREE.SphereGeometry(.05, 12, 8), goldM, 0, .3, .32, 0, 0, 0, 1, .9, .7);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) P(new THREE.CylinderGeometry(.006, .006, .16, 4), goldM, s * (.1 + i * .012), -.36, .27);
    // 層層衣領（白・紅・金）
    for (const [c, w, o] of [['#f6f1e8', .05, 0], ['#c21f32', .04, .03], ['#e8bf4e', .025, .055]]) for (const s of [-1, 1]) P(G.collar, mat(c, c === '#e8bf4e' ? { metalness: .8, roughness: .3 } : {}), s * (.05 + o), .5, .17 + o * .1, -.32, 0, s * .5, w / .04, 1.1, 1);
    // 三枚齒高木屐（黑漆）
    this.legs.forEach(l => { const u = l.userData; u.geta.material = mat('#141012', { roughness: .2, metalness: .25 }); u.geta.scale.y = 1.6; u.teeth.forEach(t => { t.material = mat('#141012', { roughness: .2, metalness: .25 }); t.scale.set(1, 4.2, 1.2); t.position.y = -.125; }); });
    this.lift = .16; this.koma.forEach(k => k.visible = true); this.legs.forEach(l => { l.userData.geta.visible = false; l.userData.teeth.forEach(t => { t.visible = false; t.userData.minor = false; }); });
    // 妝：白粉、紅唇、眼尾紅、細眉
    if (!this.decal) { this.mouthM.material = redM; this.mouthM.scale.set(.8, .8, 1); }
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
  outfit(lk, km, skin) {
    if (this.outG) this.upper.remove(this.outG); this.outG = new THREE.Group(); this.upper.add(this.outG);
    this.skirtG.scale.set(1, 1, 1); this.skirtSY = 1; this.skirtM.material = km;
    const y = (lk.y || 0) % OUTFITS.length, oc = OUTER[(lk.yc || 0) % OUTER.length];
    if (y === 1) { // 羽織：外套罩在和服外面，長到大腿，前面羽織繩
      const hm = TM({ map: TX.fabric(oc) });
      const shell = mesh(new THREE.LatheGeometry(V2([[.2, -.2], [.205, -.05], [.198, .1], [.19, .26], [.186, .4], [.182, .48], [.16, .55], [.11, .6], [.07, .625]]), 20), hm, this.outG, 0, 0, 0, 0, 0, 0, 1.04, 1, 1.06);
      shell.material = shell.material.clone(); shell.material.side = THREE.DoubleSide;
      this.arms.forEach(a => { a.userData.sl.material = hm; a.userData.arm.material = hm; });
      for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(.018, 8, 6), mat('#f4efe2'), this.outG, sx * .03, .38, .2, 0, 0, 0, 1, 1, 1, false);
      mesh(new THREE.CylinderGeometry(.005, .005, .07, 4), mat('#f4efe2'), this.outG, 0, .37, .205, 0, 0, PI / 2, 1, 1, 1, false);
    } else if (y === 2) { // 袴：下半身寬大、細條紋
      this.skirtM.material = TM({ map: TX.pattern(1, oc, '#00000033') });
      this.skirtG.scale.set(1.22, 1, 1.18);
    } else if (y === 3) { // 法被：短外褂＋背後「祭」字，下身深色緊身褲
      const hm = TM({ map: TX.pattern(9, '#24406e', '#f4efe2') });
      this.torsoM.material = hm; this.arms.forEach(a => { a.userData.sl.material = hm; a.userData.arm.material = hm; a.userData.sl.scale.set(.75, .6, .9); a.userData.lin.visible = false; }); this.bowM.geometry = G.knotB; this.bowM.position.set(0, .23, -.2);
      this.collarC.forEach(c => c.material = mat('#f4efe2'));
      mesh(new THREE.PlaneGeometry(.2, .2), TM({ map: TX.text('祭', { w: 128, h: 128, bg: '#f4efe2', fg: '#a8232e', vertical: false }), transparent: true }), this.outG, 0, .53, -.175, 0, PI, 0, .85, .85, 1, false);
      this.skirtG.scale.set(1, .42, 1); this.skirtSY = .42; this.skirtM.material = hm; this.fukiM.visible = false;
      const pants = mat('#1e2433'); this.legs.forEach(l => { l.userData.th.material = pants; l.userData.sh.material = pants; });
    }
  }
  apply3d() { // Q 版頭部比例（大頭可愛）
    const hs = 1.12 / BODY_S * .93; this.headG.scale.set(hs / BODY_W, hs, hs / BODY_W); this.headG.position.y = .765; this.headM.visible = this.hairG.visible = this.faceG.visible = true;
  }
  lod(d) {
    // 太遠的人不畫：只隱藏底下的零件（root.visible 另有用途：NPC 是否在街上、掌櫃是否在店裡）
    const far = d > 70;
    if (far !== !!this.farOff) { this.farOff = far; if (far) { this._vis = this.root.children.map(c => [c, c.visible]); this.root.children.forEach(c => c.visible = false); } else if (this._vis) { this._vis.forEach(([c, v]) => c.visible = v); this._vis = null; } }
    if (far) return;
    const tier = d < 12 || this.anim === 3 || this.anim === 5 || this.anim === 8 || this.anim === 12 ? 0 : 1; // 坐著時腿看得到，維持完整
    if (tier !== this.tier) { this.tier = tier; this.root.traverse(o => { if (o.userData.minor) o.visible = tier === 0; }); if (this.blob) this.blob.visible = true; }
    // 3D 真人頭只給近處的人（遠處改回輕量頭部），避免一整條街幾十顆高面數頭拖慢
    const near = d < 16; this.faceG.visible = d < 13; this.detailG.visible = near; this.legs.forEach(l => { l.userData.teeth.forEach(t => t.visible = near); }); }
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
    this.talkT = Math.min(3, .6 + String(s).length * .12);
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
    this.t += dt; this.updFace(dt);
    if (this.bub) { this.bubT -= dt; if (this.bubT < 0) { this.root.remove(this.bub); this.bub.material.map.dispose(); this.bub = null; } }
    if (this.emo) { this.emoT += dt; const f = this.emoT / 2.6; this.emo.position.set(.6, (this.gm ? 2.2 : 1.9) + f * .6, 0); this.emo.material.opacity = f < .15 ? f / .15 : 1 - Math.max(0, (f - .7) / .3); const sc = .75 + Math.sin(Math.min(f * 8, PI)) * .25; this.emo.scale.set(sc, sc, 1); if (f >= 1) { this.root.remove(this.emo); this.emo = null; } }
    const a = this.anim, L = this.legs, K = this.knees, A = this.arms, t = this.t;
    let lzL = 0, lzR = 0, lx = 0, rx = 0, lk = 0, rk = 0, alx = 0, arx = 0, alz = 0, arz = 0, up = 0, bend = 0, sitY = 0, headX = 0, twist = 0, side = 0, lap = 0;
    if (a === 1 || a === 2) {
      const slow = this.gm ? .7 : 1;
      this.phase += dt * (a === 2 ? 11 : 7.5) * slow * Math.max(.5, Math.min(1.4, speed / (a === 2 ? 5.5 : 3)));
      const s = Math.sin(this.phase), amp = (a === 2 ? .7 : .45) * (this.gm ? .55 : 1);
      lx = s * amp; rx = -s * amp; lk = Math.max(0, -s) * amp * 1.3; rk = Math.max(0, s) * amp * 1.3;
      alx = -s * amp * .6; arx = s * amp * .6; up = Math.abs(Math.cos(this.phase)) * (a === 2 ? .05 : .025); bend = a === 2 ? .1 : 0; lap = -Math.abs(s) * .08;
      if (this.gm) { // 外八文字
        this.phase += dt * 2.6 - dt * 7.5 * .7 * Math.max(.5, Math.min(1.4, speed / 3)); // 抵銷上面的步頻，改用慢步
        const p = this.phase, s2 = Math.sin(p), c2 = Math.cos(p);
        lx = Math.max(0, s2) * .55 - .05; rx = Math.max(0, -s2) * .55 - .05; lk = Math.max(0, s2) * .5; rk = Math.max(0, -s2) * .5;
        lzL = -Math.max(0, s2) * Math.max(0, c2 + .3) * .55; lzR = Math.max(0, -s2) * Math.max(0, c2 + .3) * .55; // 腳往外甩半圈
        twist = s2 * .16; side = s2 * .07; up = Math.abs(c2) * .05; bend = -.04; alx = arx = -.3; alz = -.2; arz = .2; lap = -Math.abs(s2) * .05;
      }
    } else if (a === 3 || a === 5 || a === 8) {
      lx = rx = -1.45; lk = rk = 1.45; sitY = -.42; lap = -1.3; alx = arx = -.62; alz = -.16; arz = .16; bend = .04;
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
    else if (a === 18) { const e = Math.sin(t * 7); bend = .42 + e * .03; alx = arx = -.75; alz = -.12; arz = .12; lx = rx = -.28; lk = rk = .3; sitY = -.06; headX = -.25; up = e * .01; }
    else if (a === 14) { const e = Math.sin(t * 18); bend = -.18 + e * .04; alx = arx = -.5; alz = -.5; arz = .5; headX = -.25 + e * .06; up = Math.abs(e) * .02; }
    else { up = Math.sin(t * 1.6) * .012; alx = arx = -.4; alz = -.26; arz = .26; if (this.gm) { twist = Math.sin(t * .9) * .06; headX = Math.sin(t * .7) * .04; } }
    if (this.look.c === 2 && ![7, 4, 9, 10, 11, 13, 16, 17].includes(a)) arx = Math.min(arx, -1.2);
    if (this.gm && ![7, 4, 9, 10, 11, 13, 16, 17].includes(a)) arx = Math.min(arx, -.7);
    if (this.look.f && ![5, 15, 4, 9, 10, 11, 17].includes(a)) alx = Math.min(alx, -.9);
    const k = Math.min(1, dt * 12), lr = (o, v) => o + (v - o) * k;
    L[0].rotation.x = lr(L[0].rotation.x, lx); L[1].rotation.x = lr(L[1].rotation.x, rx); L[0].rotation.z = lr(L[0].rotation.z, lzL); L[1].rotation.z = lr(L[1].rotation.z, lzR);
    K[0].rotation.x = lr(K[0].rotation.x, lk); K[1].rotation.x = lr(K[1].rotation.x, rk);
    A[0].rotation.x = lr(A[0].rotation.x, alx); A[1].rotation.x = lr(A[1].rotation.x, arx);
    A[0].rotation.z = lr(A[0].rotation.z, -alz); A[1].rotation.z = lr(A[1].rotation.z, -arz);
    // 袖子受重力下垂：抵銷大部分手臂旋轉
    for (const ar of A) { const u = ar.userData; if (!u.sl) continue; const gx = -ar.rotation.x * .78, gz = -ar.rotation.z * .7; u.sl.rotation.x = gx; u.sl.rotation.z = gz; if (u.lin) { u.lin.rotation.x = gx; u.lin.rotation.z = gz; } }
    this.upper.rotation.x = lr(this.upper.rotation.x, bend); this.upper.rotation.y = lr(this.upper.rotation.y, twist); this.upper.rotation.z = lr(this.upper.rotation.z, side);
    this.skirtG.rotation.x = lr(this.skirtG.rotation.x, lap - bend); this.skirtG.scale.y = lr(this.skirtG.scale.y, (lap < -1 ? .6 : 1) * (this.skirtSY || 1));
    { const th = this.skirtG.rotation.x, Lk = .44 * this.skirtG.scale.y; this.lowG.position.set(0, -Lk * Math.cos(th), -Lk * Math.sin(th)); this.lowG.rotation.x = -this.upper.rotation.x; this.lowG.visible = th < -.8; }
    this.headG.rotation.x = lr(this.headG.rotation.x, headX);
    this.offY = lr(this.offY || 0, sitY);
    const y0 = .5 + this.lift + this.offY;
    this.upper.position.y = y0 + up; L.forEach(l => l.position.y = y0 + up * .5);
    if (this.auraG.children.length) for (const sp of this.auraG.children) { const u = sp.userData;
      if (u.petal) { u.fall = (u.fall + dt * .35) % 2; const a2 = u.a + t * .5; sp.position.set(Math.cos(a2) * (u.r + .3), 2.2 - u.fall * 1.1, Math.sin(a2) * (u.r + .3)); sp.material.opacity = Math.min(1, (2 - u.fall) * 1.5) * .9; }
      else { const a2 = u.a + t * u.sp; sp.position.set(Math.cos(a2) * u.r, u.y + Math.sin(t * 1.7 + u.a * 3) * .08, Math.sin(a2) * u.r); sp.material.opacity = .45 + .45 * Math.sin(t * 3 + u.a * 5); } }
    if (this.light) this.light.intensity = 2 + Math.sin(t * 2.3) * .3;
    if (this.wheel) this.wheel.rotation.z -= dt * (4 + (speed || 0) * 3);
  }
  emoji(e) {
    const EX = { '😊': 'smile', '😂': 'laugh', '😆': 'laugh', '😍': 'love', '❤️': 'love', '😮': 'wow', '😢': 'sad', '😡': 'angry', '😴': 'sleep', '🤔': 'think', '👍': 'happy', '🎉': 'happy', '✨': 'happy', '🙇': 'calm', '🙏': 'calm' }; if (EX[e]) this.expr(EX[e]);
    if (this.emo) { this.root.remove(this.emo); this.emo.material.map.dispose(); }
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.font = '96px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.emo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xd8d8d8, map: t, depthWrite: false, transparent: true, opacity: 0 }));
    this.emo.renderOrder = 12; this.emo.position.set(.6, 1.9, 0); this.root.add(this.emo); this.emoT = 0;
  }
  play(a) { if (this.anim !== a) { this.anim = a; this.t = 0; } }
  // ---- 人力車：黑漆車身、朱紅坐墊、大木輪、折起的車篷，前方車夫拉車 ----
  setRide(on, Puller) {
    if (this.kuruma) { this.root.remove(this.kuruma); this.kuruma = null; this.puller = null; }
    if (!on) return;
    const K = this.kuruma = new THREE.Group(); K.position.y = -RIDE_Y; this.root.add(K);
    const lac = mat('#16100e', { roughness: .25, metalness: .1 }), red = mat('#a8232e', { roughness: .6 }), wood = mat('#6a4a2e', { roughness: .7 }), brass = mat('#c9a24a', { metalness: .7, roughness: .3 }), hood = mat('#1e1a24', { roughness: .8, side: THREE.DoubleSide });
    const box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; K.add(o); return o; };
    box(.66, .08, .62, lac, 0, .66, -.02); box(.6, .1, .5, red, 0, .73, -.02); box(.66, .46, .07, lac, 0, .94, -.33, -.18); box(.6, .38, .03, red, 0, .95, -.29, -.18);
    for (const s of [-1, 1]) { box(.05, .26, .58, lac, s * .33, .8, -.02); box(.05, .05, .5, brass, s * .33, .94, -.02); }
    box(.5, .05, .3, lac, 0, .36, .34, -.5); box(.46, .03, .22, red, 0, .4, .36, -.5); // 踏板
    // 車篷（折起在椅背後）
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .64, 10, 1, true, -PI / 2, PI), hood); hd.rotation.z = PI / 2; hd.rotation.y = PI / 2; hd.scale.set(1, 1, .55); hd.position.set(0, 1.08, -.42); K.add(hd);
    // 大木輪
    this.wheels = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * .42, .5, -.05); K.add(w); this.wheels.push(w);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.48, .025, 5, 20), lac); rim.rotation.y = PI / 2; w.add(rim);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(.5, .018, 5, 20), mat('#2a2a2a', { roughness: .9 })); tire.rotation.y = PI / 2; w.add(tire);
      for (let i = 0; i < 12; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .94, 4), wood); sp.rotation.x = i / 12 * PI; w.add(sp); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .1, 10), brass); hub.rotation.z = PI / 2; w.add(hub);
    }
    box(.86, .03, .03, lac, 0, .5, -.05);
    // 拉桿與橫木
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.CylinderGeometry(.018, .015, 1.7, 6), lac); sh.rotation.x = PI / 2 - .14; sh.position.set(s * .3, .78, .95); K.add(sh); }
    box(.66, .03, .03, wood, 0, .9, 1.8);
    // 提燈（車側）
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .12, 10), mat('#f4ead0', { emissive: '#ffb050', emissiveIntensity: .8 })); lan.position.set(.38, .98, .2); K.add(lan);
    if (Puller) { const p = this.puller = new Puller({ k: 0, p: 1, o: 3, h: 0, s: 1, hat: 3, ey: 3, br: 1, mo: 0, ck: 0, fc: 1 }, ''); p.root.position.set(0, 0, 2.0); K.add(p.root); }
  }
  updRide(dt, speed) {
    if (!this.kuruma) return;
    for (const w of this.wheels) w.rotation.x += speed * dt / .5;
    if (this.puller) { this.puller.play(speed > .3 ? 2 : 0); this.puller.update(dt, speed); const A = this.puller.arms; if (A) for (const a of A) a.rotation.x = -.35; }
  }
  // ---- 表情：表情符號、動作、說話、吃東西、眨眼都會讓臉變化 ----
  expr(k, dur = 2.6) { this.exK = k; this.exT = dur; }
  updFace(dt) {
    if (!this.decal || !this.faceBase || !this.decal.visible && !this.faceG.visible) return;
    const b = this.faceBase; let { ey, br, mo, ck } = b; const a = this.anim, t = this.t;
    this.exT = (this.exT || 0) - dt; this.talkT = (this.talkT || 0) - dt;
    const k = this.exT > 0 ? this.exK : [9, 14, 11, 10, 7, 16].includes(a) ? 'happy' : [6, 17].includes(a) ? 'calm' : null;
    if (k === 'happy') { ey = 4; mo = 1; } else if (k === 'laugh') { ey = 4; mo = 1; ck = 2; } else if (k === 'love') { ey = 4; mo = 0; ck = 2; }
    else if (k === 'wow') { ey = 11; mo = 2; } else if (k === 'sad') { ey = 12; mo = 3; } else if (k === 'angry') { ey = 10; mo = 3; }
    else if (k === 'sleep' || k === 'calm') { ey = 9; mo = k === 'sleep' ? 2 : 0; } else if (k === 'think') { ey = 1; mo = 3; } else if (k === 'smile') { ey = 4; mo = 0; }
    if (a === 5 || a === 15) mo = Math.sin(t * 6) > .2 ? 2 : 0; // 咀嚼
    else if (this.talkT > 0 && k !== 'sleep') mo = Math.sin(t * 14) > 0 ? 1 : mo === 1 ? 0 : mo; // 說話
    // 眨眼：每 2.5～5 秒眨一次
    this.blinkT = (this.blinkT ?? 2 + Math.random() * 3) - dt; if (this.blinkT < -.13) this.blinkT = 2.5 + Math.random() * 2.5;
    if (this.blinkT < 0 && ey !== 9 && ey !== 4) ey = 9;
    const key = `${ey}_${br}_${mo}_${ck}`; if (key === this.faceKey) return; this.faceKey = key;
    this.decal.material.map = TX.faceTex(ey, br, mo, ck, b.mk); this.decal.material.needsUpdate = true;
  }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, s, max) { const out = []; let cur = ''; for (const ch of s) { if (g.measureText(cur + ch).width > max) { out.push(cur); cur = ch; } else cur += ch; } if (cur) out.push(cur); return out; }
