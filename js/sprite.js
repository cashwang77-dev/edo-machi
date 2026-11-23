// 2D 手繪立繪人物（RO 式紙娃娃）：一個面向鏡頭的平面＋換色著色器；每人 1 次繪製
// SChara 與 3D 的 Chara 介面相同（root、setLook、play、update、say、emoji、setName、lod、setRide、updRide、headG、foodG、accG、waistG），遊戲端直接替換
import * as THREE from 'three';
import { Chara, KIMONO, OBI } from './chara.js?v=202611232143';
import * as TX from './tex.js?v=202611232143';
import { ACC } from './shops.js?v=202611232143';

const ATLAS = {}; // 原型名 → { tex, mask, meta }
export const ARCH_LIST = ['f1', 'f2', 'f3', 'f4', 'm1', 'm2', 'm3', 'm4', 'f5', 'f6', 'f7', 'f8', 'f9', 'm5', 'oi']; // 新的只能接在後面（玩家存的是編號）
export const ARCH_NAME = { f1: '島田髷', f2: 'おかっぱ', f3: 'ポニー', f4: '垂髪', m1: '丁髷', m2: '総髪', m3: '坊主', m4: '散切り', f5: '唐輪', f6: '勝山髷', f7: '兵庫髷', f8: 'お団子', f9: '二つ結び', m5: '銀杏髷', oi: '花魁' };
// 舊的 14 種髮型 → 立繪原型
const HAIR2ARCH = ['m1', 'f1', 'm2', 'm3', 'f5', 'f2', 'f3', 'f4', 'm5', 'f6', 'f7', 'f8', 'm4', 'f9'];
export const AR2H = [1, 5, 6, 7, 0, 2, 3, 12, 4, 9, 10, 11, 13, 8, 10]; // 原型 → 代表的舊髮型編號（3D 備用）
// 選了原型（ai）且髮型沒被髮結床改過（aiH＝h）就用原型；否則依髮型對應
export const archOf = lk => (lk && lk.ai != null && lk.aiH === lk.h && ARCH_LIST[lk.ai]) || HAIR2ARCH[((lk && lk.h) || 0) % HAIR2ARCH.length];

export async function loadArchetype(name, base = 'img/spr/') {
  if (ATLAS[name]) return ATLAS[name];
  const L = new THREE.TextureLoader();
  const [tex, mask, meta] = await Promise.all([L.loadAsync(base + name + '.png'), L.loadAsync(base + name + '_m.png'), fetch(base + name + '.json').then(r => r.json())]);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  mask.colorSpace = THREE.NoColorSpace; mask.magFilter = mask.minFilter = THREE.NearestFilter; mask.generateMipmaps = false;
  return ATLAS[name] = { tex, mask, meta };
}
let ACCA = null; // 飾品圖集
async function loadAcc() { const [t, m] = await Promise.all([new THREE.TextureLoader().loadAsync('img/spr/acc.png'), fetch('img/spr/acc.json').then(r => r.json())]); t.colorSpace = THREE.SRGBColorSpace; ACCA = { t, m }; }
export const preloadSprites = () => Promise.all([...ARCH_LIST.map(n => loadArchetype(n).catch(() => null)), loadAcc().catch(() => null)]);
// 各部位的位置（以人物平面為準，x 正＝畫面右邊；z 正＝在人物前面）與大小
const ACC_POS = { hat: [0, 1.5, .03, .62], hs: [-.17, 1.42, .03, .22], m: [.18, 1.3, .03, .3], w: [.2, .72, .03, .26], c: [.25, .85, .04, .3], b: [-.22, 1.02, -.03, .55] };
const ACC_FIX = { tenugui: [0, 1.44, .03, .46], zukin: [0, 1.4, .03, .5], hachimaki: [0, 1.4, .03, .44], daisho: [.12, .72, .03, .46], bangasa: [.12, 1.72, .04, .95], janome: [.12, 1.72, .04, .95], kazaguruma: [.28, 1.0, .04, .42], chochin: [.3, .95, .04, .5], kingyo: [.24, .7, .04, .26], yoyo: [.24, .7, .04, .24], shamisen: [-.2, .95, -.03, .7] };
export const spritesReady = () => ARCH_LIST.every(n => ATLAS[n]);

export const SPR_LIGHT = { value: new THREE.Color(1, 1, 1) }; // 共用環境光（遊戲依晝夜更新）
let CAM = null; export function setSprCam(c) { CAM = c; }
const DIRS = ['S', 'SE', 'E', 'NE', 'N'];
const H = 1.62; // 人物在世界中的高度
// 3D 動作編號 → 立繪狀態
const ACT = { 6: 'bow', 7: 'wave', 9: 'laugh', 10: 'cheer', 11: 'cheer', 13: 'wave', 14: 'laugh', 16: 'wave', 17: 'bow' };
const SIT = new Set([3, 5, 8, 12]);
const GEO = {}; const geoFor = (fw, fh) => GEO[fw + 'x' + fh] || (GEO[fw + 'x' + fh] = (() => { const g = new THREE.PlaneGeometry(H * fw / fh, H); g.translate(0, H / 2 - H * 6 / fh, 0); return g; })());
const BLOB_G = new THREE.CircleGeometry(.3, 16), BLOB_M = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .28, depthWrite: false });
const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Vector3();

export class SChara {
  constructor(look, name = '') {
    this.root = new THREE.Group(); this.t = Math.random() * 10; this.anim = 0; this.spd = 0;
    this.headG = new THREE.Group(); this.headG.position.y = 1.3; this.root.add(this.headG);
    this.accG = new THREE.Group(); this.headG.add(this.accG);
    this.foodG = new THREE.Group(); this.foodG.position.set(.16, .78, .22); this.root.add(this.foodG);
    this.waistG = new THREE.Group(); this.waistG.position.y = .75; this.root.add(this.waistG);
    this.arms = [-1, 1].map(sx => { const g = new THREE.Group(); g.position.set(sx * .2, .95, .08); this.root.add(g); return g; }); // 手的掛點（提燈籠、扛轎）
    this.blob = new THREE.Mesh(BLOB_G, BLOB_M); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = .012; this.blob.renderOrder = -1; this.root.add(this.blob);
    this.u = { uMask: { value: null }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uFlip: { value: 0 }, uKim: { value: new THREE.Color('#9fb8e8') }, uObi: { value: new THREE.Color('#e8b84a') },
      uPat: { value: null }, uPatOn: { value: 0 }, uPatS: { value: 6 }, uLight: SPR_LIGHT };
    this.setLook(look);
    this.name = name; if (name) this.setName(name);
  }
  _mesh(A) {
    if (this.mesh && this.A === A) return;
    if (this.mesh) { this.root.remove(this.mesh); this.mat.dispose(); }
    this.A = A; this.u.uMask.value = A.mask;
    const m = new THREE.MeshBasicMaterial({ map: A.tex, alphaTest: .5 });
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, this.u);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask, uPat; uniform vec4 uRect; uniform float uFlip, uPatOn, uPatS; uniform vec3 uKim, uObi, uLight;')
        .replace('#include <map_fragment>', `
          vec2 uv0 = vMapUv; if (uFlip > .5) uv0.x = 1. - uv0.x; vec2 a = uRect.xy + uv0 * uRect.zw;
          vec4 c = texture2D(map, a); vec3 mk = texture2D(uMask, a).rgb;
          float l = dot(c.rgb, vec3(.299, .587, .114));
          vec3 kim = uPatOn > .5 ? texture2D(uPat, a * uPatS).rgb : uKim;
          c.rgb = mix(c.rgb, kim * clamp(l / .5, .2, 1.25), mk.r);
          c.rgb = mix(c.rgb, uObi * clamp(c.r / .45, .2, 1.3), mk.g);
          c.rgb *= uLight;
          diffuseColor *= c;`);
    };
    m.customProgramCacheKey = () => 'schara1';
    this.mat = m; this.mesh = new THREE.Mesh(geoFor(A.meta.fw, A.meta.fh), m); this.root.add(this.mesh);
    if (!this.accP) this.accP = new THREE.Group(); this.mesh.add(this.accP);
  }
  setLook(lk) {
    lk = Object.assign({ k: 0, p: 0, o: 0, h: 0 }, lk || {}); this.look = lk;
    const A = (this.gm && ATLAS.oi) || ATLAS[archOf(lk)] || ATLAS.f1; if (A) this._mesh(A);
    if (this.mesh) this.mesh.scale.setScalar(A === ATLAS.oi ? 1.4 : 1); this._aura(A === ATLAS.oi);
    const kc = (KIMONO[lk.k % KIMONO.length] || KIMONO[0])[1];
    this.u.uKim.value.set(lk.kc || kc); this.u.uObi.value.set(lk.oc || OBI[lk.o % OBI.length]);
    if (lk.p) { this.u.uPat.value = TX.pattern(lk.p, kc, lk.k === 9 ? '#5a5a66' : '#f4efe2'); this.u.uPatOn.value = 1; } else { this.u.uPat.value = null; this.u.uPatOn.value = 0; }
    this.foodG.clear(); Chara.prototype.addHeld.call(this, lk);
    this.accG.clear(); this.waistG.clear(); this._acc(lk);
  }
  // 飾品：先用小圖示疊在頭上／腰上（之後換手繪）
  _acc(lk) {
    if (ACCA) { this.accP.clear(); this.accH = [];
      for (const sl of ['hat', 'hs', 'm', 'w', 'c', 'b']) { const it = lk[sl] && ACC.find(a => a.slot === sl && a.v === lk[sl]); if (!it || ACCA.m.i[it.id] == null) continue;
        const idx = ACCA.m.i[it.id], { c, cols, rows } = ACCA.m, t = ACCA.t.clone(); t.repeat.set(1 / cols, 1 / rows); t.offset.set((idx % cols) / cols, 1 - (Math.floor(idx / cols) + 1) / rows); t.needsUpdate = true;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: .4 })); const [x, y, z, sc] = ACC_FIX[it.id] || ACC_POS[sl]; sp.position.set(x, y, z); sp.scale.set(sc, sc, 1);
        sp.userData.slot = sl; this.accP.add(sp); if (sl === 'hat' || sl === 'hs' || sl === 'm') this.accG.add(new THREE.Object3D()); if (sl === 'w') this.waistG.add(new THREE.Object3D()); }
      return; }
    const icon = (e, par, x, y, s = .32) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '52px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 32, 36);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); sp.scale.set(s, s, 1); sp.position.set(x, y, .05); par.add(sp); };
    if (lk.hat === 1) icon('👒', this.accG, 0, .2, .5); if (lk.hat === 4 || lk.m === 1) icon('🦊', this.accG, .14, .02); if (lk.hat === 2) icon('🌸', this.accG, .12, .14, .22); if (lk.hat === 3) icon('🎗️', this.accG, -.1, .14, .22);
    if (lk.w === 1) icon('🧧', this.waistG, .16, 0, .2); if (lk.w === 2) icon('👛', this.waistG, -.16, 0, .2);
  }
  // 花魁：背後金色光暈＋緩緩飄升的金色光點
  _aura(on) {
    if (!on) { if (this.aura) { this.root.remove(this.aura); this.aura = null; } return; }
    if (this.aura) return;
    const g = new THREE.Group(); this.aura = g; this.root.add(g);
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,226,140,.9)'); gr.addColorStop(.45, 'rgba(255,190,90,.35)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), new THREE.MeshBasicMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .7, fog: false, toneMapped: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = .03; g.add(halo); this.halo = halo; // 腳下金色光環
    const N = 18, pos = new Float32Array(N * 3); this.spk = Array.from({ length: N }, (_, i) => ({ a: Math.random() * 6.28, r: .45 + Math.random() * .5, y: Math.random() * 2.2, v: .25 + Math.random() * .35 }));
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: t, size: .14, color: '#ffe08a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false })); g.add(pts); this.spkP = pts;
  }
  play(a) { if (this.anim !== a) { this.anim = a; this.t = 0; } }
  expr() {}
  lod(d) { const far = d > 70; if (this.mesh) this.mesh.visible = !far; this.blob.visible = !far; }
  update(dt, speed = 0) {
    this.t += dt;
    if (this.bub) { this.bubT -= dt; if (this.bubT < 0) { this.root.remove(this.bub); this.bub.material.map.dispose(); this.bub = null; } }
    if (this.emo) { this.emoT += dt; const f = this.emoT / 2.6; this.emo.position.set(.6, 1.9 + f * .6, 0); this.emo.material.opacity = f < .15 ? f / .15 : 1 - Math.max(0, (f - .7) / .3); const sc = .75 + Math.sin(Math.min(f * 8, Math.PI)) * .25; this.emo.scale.set(sc, sc, 1); if (f >= 1) { this.root.remove(this.emo); this.emo = null; } }
    if (this.aura) { this.halo.material.opacity = .55 + Math.sin(this.t * 1.8) * .15; const P = this.spkP.geometry.attributes.position;
      this.spk.forEach((s, i) => { s.y += s.v * dt; s.a += dt * .6; if (s.y > 2.4) s.y = 0; P.setXYZ(i, Math.cos(s.a) * s.r, s.y, Math.sin(s.a) * s.r); }); P.needsUpdate = true; this.spkP.material.opacity = .6 + Math.sin(this.t * 3) * .3; }
    if (!this.mesh || !CAM || !this.mesh.visible) return;
    // 世界中的位置與朝向（人物可能掛在人力車底下）
    this.root.getWorldPosition(_p); this.root.getWorldQuaternion(_q); _v.set(0, 0, 1).applyQuaternion(_q);
    const ry = Math.atan2(_v.x, _v.z), dx = _p.x - CAM.position.x, dz = _p.z - CAM.position.z, dl = Math.hypot(dx, dz) || 1, d0 = dx / dl, d1 = dz / dl;
    CAM.getWorldDirection(_c); this.mesh.rotation.y = Math.atan2(-_c.x, -_c.z) - ry; // 所有立繪都與鏡頭平面平行（彼此不會交叉切開）
    const f0 = Math.sin(ry), f1 = Math.cos(ry), th = Math.atan2(f0 * -d1 + f1 * d0, -(f0 * d0 + f1 * d1));
    let k = Math.round(th / (Math.PI / 4)); const flip = k < 0 && k > -4; k = Math.min(4, Math.abs(k));
    const F = this.A.meta.frames, a = this.anim, actN = ACT[a], act = actN && F.act && F.act[actN];
    const moving = speed > .2 && !act && !SIT.has(a);
    const set = act ? null : moving ? F.walk : SIT.has(a) ? F.sit : F.idle;
    let fr = act || set[DIRS[k]] || set.S, i = 0, bob = 0;
    if (moving) { const ph = this.t * speed * 1.6; i = Math.floor(ph) % fr.length; }
    else if (act) { if (a === 10) fr = (Math.floor(this.t * 2) % 2 ? F.act.wave : F.act.cheer); bob = Math.abs(Math.sin(this.t * 4)) * (a === 10 || a === 11 ? .04 : 0); }
    else if (!SIT.has(a)) bob = Math.sin(this.t * 2.2) * .004;
    const { fw, fh, cols, rows } = this.A.meta, idx = fr[i % fr.length].i, W = cols * fw, Hh = rows * fh;
    this.u.uRect.value.set((idx % cols) * fw / W, 1 - (Math.floor(idx / cols) + 1) * fh / Hh, fw / W, fh / Hh); this.u.uFlip.value = flip && !act ? 1 : 0;
    this.mesh.position.y = bob;
    if (this.accP && this.accP.children.length) { this.accP.scale.x = flip && !act ? -1 : 1; for (const sp of this.accP.children) { const sl = sp.userData.slot; sp.visible = !(k === 4 && !act && (sl === 'hs' || sl === 'm' || sl === 'w' || (sl === 'c' && sp.scale.x < .9))); sp.material.color.copy(SPR_LIGHT.value); } }
  }
}
// 名牌、說話泡泡、表情符號、人力車：直接沿用 3D 人物的做法
for (const k of ['setRide', 'updRide']) SChara.prototype[k] = Chara.prototype[k];
// 花魁比較高：名牌、說話泡泡往上移
SChara.prototype.setName = function (n, npc) { Chara.prototype.setName.call(this, n, npc); if (this.tag && this.A === ATLAS.oi) this.tag.position.y = 2.75; };
SChara.prototype.say = function (t, dur) { Chara.prototype.say.call(this, t, dur); if (this.bub && this.A === ATLAS.oi) this.bub.position.y = 3.25; };
SChara.prototype.emoji = function (e) { Chara.prototype.emoji.call(this, e); };
