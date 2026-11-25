// 2D 手繪立繪人物（RO 式紙娃娃）：一個面向鏡頭的平面＋換色著色器；每人 1 次繪製
// SChara 與 3D 的 Chara 介面相同（root、setLook、play、update、say、emoji、setName、lod、setRide、updRide、headG、foodG、accG、waistG），遊戲端直接替換
import * as THREE from 'three';
import { Chara, KIMONO, OBI, SKINS, OUTER } from './chara.js?v=202611260241';
import * as TX from './tex.js?v=202611260241';
import { ACC } from './shops.js?v=202611260241';

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
  const [tex, mask, meta] = await Promise.all([L.loadAsync(base + name + '.webp').catch(() => L.loadAsync(base + name + '.png')), L.loadAsync(base + name + '_m.png'), fetch(base + name + '.json').then(r => r.json())]);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  mask.colorSpace = THREE.NoColorSpace; mask.magFilter = mask.minFilter = THREE.NearestFilter; mask.generateMipmaps = false;
  return ATLAS[name] = { tex, mask, meta };
}
let ACCA = null; // 飾品圖集
async function loadAcc() { const [t, m] = await Promise.all([new THREE.TextureLoader().loadAsync('img/spr/acc.webp').catch(() => new THREE.TextureLoader().loadAsync('img/spr/acc.png')), fetch('img/spr/acc.json').then(r => r.json())]); t.colorSpace = THREE.SRGBColorSpace; ACCA = { t, m }; }
export const preloadSprites = () => Promise.all([...ARCH_LIST.map(n => loadArchetype(n).catch(() => null)), loadAcc().catch(() => null)]);
// 各部位的位置（以人物平面為準，x 正＝畫面右邊；z 正＝在人物前面）與大小
const ACC_G = new THREE.PlaneGeometry(1, 1);
const EYE0 = 1.0; // 頭部飾品 y 的基準眼高（實際依每格眼睛位置位移）
const ACC_POS = { hat: [0, 1.31, .03, .62], hs: [-.17, 1.42, .03, .22], m: [.18, 1.3, .03, .3], w: [.2, .72, .03, .26], c: [.25, .85, .04, .3], b: [-.22, 1.02, -.03, .55] };
const ACC_FIX = { tenugui: [0, 1.44, .03, .46], zukin: [0, 1.4, .03, .5], hachimaki: [0, 1.33, .03, .44], daisho: [.12, .72, .03, .46], bangasa: [-.24, 1.11, -.04, 1.3], janome: [.47, 1.17, -.04, 1.3], kazaguruma: [.28, 1.0, .04, .42], chochin: [.3, .95, .04, .5], kingyo: [.24, .7, .04, .26], yoyo: [.24, .7, .04, .24], shamisen: [-.2, .95, -.03, .7] };
export const spritesReady = () => ARCH_LIST.every(n => ATLAS[n]);

export const SPR_LIGHT = { value: new THREE.Color(1, 1, 1) }; // 共用環境光（遊戲依晝夜更新）
let CAM = null; export function setSprCam(c) { CAM = c; }
const DIRS = ['S', 'SE', 'E', 'NE', 'N'];
let MATSURI = null; // 法被背後的「祭」字
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
      uPat: { value: null }, uPatOn: { value: 0 }, uPatS: { value: 6 }, uLight: SPR_LIGHT, uStep: { value: 0 }, uSkin: { value: new THREE.Color(1, 1, 1) },
      uOy: { value: 0 }, uOut: { value: new THREE.Color() }, uBand: { value: new THREE.Vector3(.5, .57, .95) }, uDir: { value: 0 }, uPat2: { value: null }, uMat: { value: null }, uFc: { value: new THREE.Vector4() }, uEh: { value: 0 }, uBlink: { value: 0 }, uCk: { value: 0 }, uMk: { value: 0 } };
    this.setLook(look);
    this.name = name; if (name) this.setName(name);
  }
  _mesh(A) {
    if (this.mesh && this.A === A) return;
    if (this.mesh) { this.root.remove(this.mesh); this.mat.dispose(); }
    this.A = A; this.u.uMask.value = A.mask;
    const m = new THREE.MeshBasicMaterial({ map: A.tex, alphaTest: .5 });
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, this.u);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask, uPat, uPat2, uMat; uniform vec4 uRect; uniform float uFlip, uPatOn, uPatS, uStep, uOy, uDir, uCk, uMk, uEh, uBlink; uniform vec4 uFc; uniform vec3 uKim, uObi, uLight, uSkin, uOut, uBand;')
        .replace('#include <map_fragment>', `
          vec2 uv0 = vMapUv; if (uFlip > .5) uv0.x = 1. - uv0.x;
          if (uStep != 0.) { float sd = smoothstep(.44, .56, uv0.x); float lift = mix(max(uStep, 0.), max(-uStep, 0.), sd) * .085 * smoothstep(.3, .06, uv0.y); uv0.y -= lift; if (uv0.y < .005) discard; }
          vec2 a = uRect.xy + uv0 * uRect.zw;
          vec4 c = texture2D(map, a); vec3 mk = texture2D(uMask, a).rgb;
          float l = dot(c.rgb, vec3(.299, .587, .114));
          vec3 kim = uPatOn > .5 ? texture2D(uPat, uv0 * uRect.zw * uPatS).rgb : uKim;
          c.rgb = mix(c.rgb, kim * clamp(l / .5, .2, 1.25), mk.r);
          c.rgb = mix(c.rgb, uObi * clamp(c.r / .45, .2, 1.3), mk.g);
          if (uOy > .5) { /* 衣裝（羽織／袴／法被）：依腰帶上下緣 uBand（由上往下的比例）把和服分成上身、下身 */
            float py = 1. - uv0.y, ux = uv0.x, bt = uBand.x, bb = uBand.y, kb = uBand.z, cl = max(mk.r, mk.g);
            float sh = clamp(l / mix(.5, .3, mk.g), .3, 1.2);
            if (uOy < 1.5) { /* 羽織：罩到大腿，正面中間敞開看得到和服與腰帶，胸前白色羽織紐 */
              float hem = bb + (kb - bb) * .4, op = uDir < .5 ? 1. - smoothstep(.03, .045, abs(ux - .5)) : 0.;
              float cv = cl * step(py, hem) * (1. - op);
              c.rgb = mix(c.rgb, uOut * sh * (1. - .3 * smoothstep(hem - .014, hem, py)), cv);
              if (uDir < .5) { c.rgb = mix(c.rgb, uOut * .45, cl * step(py, hem) * (1. - smoothstep(.045, .056, abs(abs(ux - .5) - .04)))); /* 前襟邊線 */
                float tie = (1. - smoothstep(.006, .009, abs(py - bt + .045))) * (1. - smoothstep(.04, .05, abs(ux - .5))); c.rgb = mix(c.rgb, vec3(.96, .94, .88) * clamp(l / .5, .7, 1.1), tie * cl); }
            } else if (uOy < 2.5) { /* 袴：腰帶以下改成外衣色，加直向褶線 */
              float lo = mk.r * smoothstep(bb - .01, bb + .005, py);
              float pl = .8 + .2 * smoothstep(.1, .7, abs(sin(ux * 38.)));
              c.rgb = mix(c.rgb, uOut * clamp(l / .5, .3, 1.2) * pl, lo);
            } else { /* 法被：短外褂（花紋，到腰帶下一點，下緣白線）、背後「祭」字；下身深色緊身褲 */
              float hem = bb + (kb - bb) * .2, up = mk.r * step(py, hem);
              c.rgb = mix(c.rgb, texture2D(uPat2, uv0 * uRect.zw * uPatS).rgb * sh, up);
              c.rgb = mix(c.rgb, vec3(.96, .94, .88) * sh, up * smoothstep(hem - .022, hem - .016, py));
              c.rgb = mix(c.rgb, vec3(.035, .04, .07) * clamp(l / .5, .4, 1.3), mk.r * step(hem, py));
              if (uDir > 3.5) { vec2 q = vec2((ux - .5) / .36 + .5, 1. - ((py - bt + .075) / .2 + .5));
                if (q.x > 0. && q.x < 1. && q.y > 0. && q.y < 1.) { vec4 tm = texture2D(uMat, q); c.rgb = mix(c.rgb, tm.rgb * sh, up * tm.a); } }
            }
          }
          if (uFc.w > 0.) { /* 腮紅、淚痣：uFc＝眼睛下緣 y（由上往下）、左眼 x、右眼 x、眼寬（皆為格子比例） */
            vec2 pp = vec2(uv0.x, 1. - uv0.y), ar = vec2(1., 1.75); float cy = uFc.x + uFc.w * .55;
            if (uBlink > .5) { /* 眨眼：眼睛那塊換成臉頰膚色，畫一條閉眼弧線 */
              float ex = abs(pp.x - uFc.y) < abs(pp.x - uFc.z) ? uFc.y : uFc.z, dx = (pp.x - ex) / (uFc.w * .5);
              float dy = (pp.y - (uFc.x - uEh * .5)) / (uEh * .5 + .004), el = length(vec2(dx / 1.5, dy / 1.35));
              vec3 cs = texture2D(map, uRect.xy + vec2(ex, 1. - uFc.x - uEh * .55 - .008) * uRect.zw).rgb;
              c.rgb = mix(c.rgb, cs * (mk.b > .5 ? vec3(1.) : uSkin), 1. - smoothstep(.85, 1., el));
              float ly = uFc.x - uEh * .3 - (1. - dx * dx) * uEh * .12;
              if (abs(dx) < 1.05) c.rgb = mix(c.rgb, vec3(.18, .12, .1), 1. - smoothstep(.0035, .0065, abs(pp.y - ly))); }
            float bl = max(1. - smoothstep(.0, 1., length((pp - vec2(uFc.y, cy)) * ar) / (uFc.w * .62)), uFc.y != uFc.z ? 1. - smoothstep(.0, 1., length((pp - vec2(uFc.z, cy)) * ar) / (uFc.w * .62)) : 0.);
            c.rgb = mix(c.rgb, c.rgb * vec3(1., .62, .62), bl * uCk * mk.b);
            if (uMk > .5) c.rgb = mix(c.rgb, vec3(.22, .13, .1), (1. - smoothstep(.006, .011, length((pp - vec2(uFc.z + uFc.w * .32, uFc.x + uFc.w * .22)) * ar))) * mk.b); }
          c.rgb *= mix(vec3(1.), uSkin, mk.b); /* 膚色：遮罩 B＝皮膚，乘上與預設膚色的比例 */
          c.rgb *= uLight;
          diffuseColor *= c;`);
    };
    m.customProgramCacheKey = () => 'schara7';
    this.mat = m; this.mesh = new THREE.Mesh(geoFor(A.meta.fw, A.meta.fh), m); this.root.add(this.mesh);
    if (!this.accP) this.accP = new THREE.Group(); this.mesh.add(this.accP);
  }
  setLook(lk) {
    lk = Object.assign({ k: 0, p: 0, o: 0, h: 0 }, lk || {}); this.look = lk;
    const A = (this.gm && ATLAS.oi) || ATLAS[archOf(lk)] || ATLAS.f1; if (A) this._mesh(A);
    if (this.mesh) this.mesh.scale.setScalar(A === ATLAS.oi ? 1.4 : 1); this._aura(A === ATLAS.oi);
    const kc = (KIMONO[lk.k % KIMONO.length] || KIMONO[0])[1];
    { const s0 = new THREE.Color(SKINS[0]), s1 = new THREE.Color(SKINS[(lk.s || 0) % SKINS.length]); const k = 1.8; this.u.uSkin.value.setRGB((s1.r / s0.r) ** k, (s1.g / s0.g) ** k, (s1.b / s0.b) ** k); } /* 立繪較亮，差距放大才看得出來 */
    this.u.uKim.value.set(lk.kc || kc); this.u.uObi.value.set(lk.oc || OBI[lk.o % OBI.length]);
    if (lk.p) { this.u.uPat.value = TX.pattern(lk.p, kc, lk.k === 9 ? '#5a5a66' : '#f4efe2'); this.u.uPatOn.value = 1; } else { this.u.uPat.value = null; this.u.uPatOn.value = 0; }
    { const ob = A && A !== ATLAS.oi && A.meta.ob, y = ob ? (lk.y || 0) % 4 : 0, oc = OUTER[(lk.yc || 0) % OUTER.length]; this.u.uOy.value = y; this.u.uOut.value.set(oc); /* 衣裝：遮罩 json 有 ob（腰帶分區）才做 */
      if (y === 3) { this.u.uPat2.value = TX.pattern(9, oc, '#f4efe2'); this.u.uMat.value = MATSURI || (MATSURI = TX.text('祭', { w: 128, h: 128, circle: '#f4efe2', fg: '#a8232e', vertical: false })); } }
    this.u.uCk.value = A === ATLAS.oi ? 0 : [0, .4, .75][lk.ck == null ? 1 : lk.ck % 3]; this.u.uMk.value = A !== ATLAS.oi && lk.mk ? 1 : 0; /* 腮紅：預設淡 */
    this.foodG.clear(); Chara.prototype.addHeld.call(this, lk);
    this.accG.clear(); this.waistG.clear(); this._acc(lk);
  }
  // 飾品：先用小圖示疊在頭上／腰上（之後換手繪）
  _acc(lk) {
    if (ACCA) { this.accP.clear(); this.accH = [];
      for (const sl of ['hat', 'hs', 'm', 'w', 'c', 'b']) { const it = lk[sl] && ACC.find(a => a.slot === sl && a.v === lk[sl]); if (!it || ACCA.m.i[it.id] == null) continue;
        const idx = ACCA.m.i[it.id], { c, cols, rows } = ACCA.m, t = ACCA.t.clone(); t.repeat.set(1 / cols, 1 / rows); t.offset.set((idx % cols) / cols, 1 - (Math.floor(idx / cols) + 1) / rows); t.needsUpdate = true;
        const sp = new THREE.Mesh(ACC_G, new THREE.MeshBasicMaterial({ map: t, alphaTest: .4, side: THREE.DoubleSide })); /* 與人物平面平行（Sprite 會跟著鏡頭俯角傾斜，下緣穿到臉前面） */ const [x, y, z, sc] = ACC_FIX[it.id] || ACC_POS[sl]; sp.position.set(x, y, z); sp.scale.set(sc, sc, 1);
        sp.userData.slot = sl; sp.userData.y = y; this.accP.add(sp); if (sl === 'hat' || sl === 'hs' || sl === 'm') this.accG.add(new THREE.Object3D()); if (sl === 'w') this.waistG.add(new THREE.Object3D()); }
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
  // 這一格眼睛的高度（人物座標）；沒有臉資料的格（背面）用正面站姿的眼高
  _eyeY(idx) { const M = this.A.meta, e = M.fc && M.fc[idx]; if (e) return H * (1 - (6 + e[0]) / M.fh);
    if (this.A.eye0 == null) { const f = M.fc && M.frames.idle.S && M.fc[M.frames.idle.S[0].i]; this.A.eye0 = f ? H * (1 - (6 + f[0]) / M.fh) : EYE0; } return this.A.eye0; }
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
    let sway = 0, step = 0; /* step：左右腳輪流抬起（著色器把下襬與腳的左半或右半往上提） */
    if (moving) { const ph = this.t * speed * 1.6; i = Math.floor(ph) % fr.length; bob = Math.abs(Math.sin(ph * Math.PI / 2)) * .02; /* 11/24 拿掉整個人左右傾斜（不自然），彈跳減小 */ step = Math.sin(ph * Math.PI / 2); } /* 正面背面的走路圖腳幾乎不動：加上踏步彈跳與左右搖擺 */
    else if (act) { if (a === 10) fr = (Math.floor(this.t * 2) % 2 ? F.act.wave : F.act.cheer); bob = Math.abs(Math.sin(this.t * 4)) * (a === 10 || a === 11 ? .04 : 0); }
    else if (!SIT.has(a)) bob = Math.sin(this.t * 2.2) * .004;
    const { fw, fh, cols, rows } = this.A.meta, idx = fr[i % fr.length].i, W = cols * fw, Hh = rows * fh;
    this.u.uRect.value.set((idx % cols) * fw / W, 1 - (Math.floor(idx / cols) + 1) * fh / Hh, fw / W, fh / Hh); this.u.uFlip.value = flip && !act ? 1 : 0;
    if (this.u.uOy.value) { const b = this.A.meta.ob[idx]; this.u.uBand.value.set(b[0] / fh, b[1] / fh, b[2] / fh); this.u.uDir.value = act ? -1 : k; }
    { const e = (act || k < 3) && this.A.meta.fc && this.A.meta.fc[idx]; /* 斜後方、背面看不到臉；側面只用朝向那側的眼睛 */
      if (e) { const xr = e[2] / fw, xl = !act && k === 2 ? xr : e[1] / fw; this.u.uFc.value.set(e[0] / fh, xl, xr, e[3] / fw); this.u.uEh.value = (e[4] || e[3]) / fh; this.u.uBlink.value = (this.t + (this.bk || (this.bk = 1 + Math.random() * 3))) % 4.3 < .14 || this.blinkTest ? 1 : 0; } else this.u.uFc.value.w = 0; }
    this.mesh.position.y = bob; this.mesh.rotation.z = sway; this.u.uStep.value = step;
    if (this.accP && this.accP.children.length) { this.accP.scale.x = flip && !act ? -1 : 1; for (const sp of this.accP.children) { const sl = sp.userData.slot; sp.visible = !(k === 4 && !act && (sl === 'hs' || sl === 'm' || sl === 'w' || (sl === 'c' && sp.scale.x < .9))); sp.material.color.copy(SPR_LIGHT.value); if (sl === 'hat' || sl === 'hs' || sl === 'm') sp.position.y = sp.userData.y + this._eyeY(idx) - EYE0; } }
  }
}
// 名牌、說話泡泡、表情符號、人力車：直接沿用 3D 人物的做法
for (const k of ['setRide', 'updRide']) SChara.prototype[k] = Chara.prototype[k];
// 花魁比較高：名牌、說話泡泡往上移
SChara.prototype.setName = function (n, npc) { Chara.prototype.setName.call(this, n, npc); if (this.tag && this.A === ATLAS.oi) this.tag.position.y = 2.75; };
SChara.prototype.say = function (t, dur) { Chara.prototype.say.call(this, t, dur); if (this.bub && this.A === ATLAS.oi) this.bub.position.y = 3.25; };
SChara.prototype.emoji = function (e) { Chara.prototype.emoji.call(this, e); };
