// 2D 手繪立繪人物（RO 式紙娃娃）：一個面向鏡頭的平面＋換色著色器；每人 1 次繪製
import * as THREE from 'three';

const ATLAS = {}; // 原型名 → { tex, mask, meta }
export async function loadArchetype(name, base = 'img/spr/') {
  if (ATLAS[name]) return ATLAS[name];
  const L = new THREE.TextureLoader();
  const [tex, mask, meta] = await Promise.all([L.loadAsync(base + name + '.png'), L.loadAsync(base + name + '_m.png'), fetch(base + name + '.json').then(r => r.json())]);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
  mask.colorSpace = THREE.NoColorSpace; mask.magFilter = mask.minFilter = THREE.NearestFilter; mask.generateMipmaps = false;
  return ATLAS[name] = { tex, mask, meta };
}
// 共用的環境光（每格由遊戲依晝夜更新一次）
export const SPR_LIGHT = { value: new THREE.Color(1, 1, 1) };
const DIRS = ['S', 'SE', 'E', 'NE', 'N']; // 0..4；負的方向用鏡像
const H = 1.62; // 人物在世界中的高度（公尺）

export class SpriteChara {
  constructor(arch, look = {}) {
    this.A = arch; const { fw, fh } = arch.meta;
    this.root = new THREE.Group();
    const w = H * fw / fh, g = new THREE.PlaneGeometry(w, H); g.translate(0, H / 2 - H * 6 / fh, 0);
    this.u = { uMask: { value: arch.mask }, uRect: { value: new THREE.Vector4() }, uFlip: { value: 0 }, uKim: { value: new THREE.Color('#9fb8e8') }, uObi: { value: new THREE.Color('#e8b84a') },
      uPat: { value: null }, uPatOn: { value: 0 }, uPatS: { value: 6 }, uLight: SPR_LIGHT };
    const m = new THREE.MeshBasicMaterial({ map: arch.tex, alphaTest: .5, transparent: false });
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, this.u);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask, uPat; uniform vec4 uRect; uniform float uFlip, uPatOn, uPatS; uniform vec3 uKim, uObi, uLight;')
        .replace('#include <map_fragment>', `
          vec2 uv0 = vMapUv; if (uFlip > .5) uv0.x = 1. - uv0.x; vec2 a = uRect.xy + uv0 * uRect.zw;
          vec4 c = texture2D(map, a); vec3 mk = texture2D(uMask, a).rgb;
          float l = dot(c.rgb, vec3(.299, .587, .114));
          vec3 kim = uPatOn > .5 ? texture2D(uPat, a * uPatS).rgb : uKim;
          c.rgb = mix(c.rgb, kim * clamp(l / .5, .2, 1.25), mk.r);            // 和服：保留原本的明暗，換成選的顏色／花紋
          c.rgb = mix(c.rgb, uObi * clamp(c.r / .45, .2, 1.3), mk.g);          // 腰帶
          c.rgb *= uLight;
          diffuseColor *= c;`);
    };
    m.customProgramCacheKey = () => 'sprchara1';
    this.mat = m; this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = true; this.root.add(this.mesh);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(.3, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = .012; blob.renderOrder = -1; this.root.add(blob); this.blob = blob;
    this.t = Math.random() * 10; this.anim = 0; this.speed = 0; this.setLook(look);
  }
  setLook(lk) {
    this.look = lk || {};
    if (lk.kc) this.u.uKim.value.set(lk.kc); if (lk.oc) this.u.uObi.value.set(lk.oc);
    this.u.uPat.value = lk.pat || null; this.u.uPatOn.value = lk.pat ? 1 : 0;
  }
  // 動作：0 站 1 走 2 跑 3 坐；字串 'wave' 'bow' 'laugh' 'cheer' 為正面動作
  play(a) { this.anim = a; }
  // 依鏡頭位置選方向與畫格；ry＝角色朝向（與 Chara 相同定義：面向 +z 時 ry=0）
  update(dt, speed, cam) {
    this.t += dt; const p = this.root.position;
    if (cam) {
      const dx = p.x - cam.position.x, dz = p.z - cam.position.z, dl = Math.hypot(dx, dz) || 1, d = [dx / dl, dz / dl];
      this.mesh.rotation.y = Math.atan2(-d[0], -d[1]) - this.root.rotation.y; // 平面永遠面向鏡頭（只轉水平）
      const ry = this.root.rotation.y, f = [Math.sin(ry), Math.cos(ry)], right = [-d[1], d[0]];
      const th = Math.atan2(f[0] * right[0] + f[1] * right[1], -(f[0] * d[0] + f[1] * d[1]));
      let k = Math.round(th / (Math.PI / 4)); const flip = k < 0 && k > -4; k = Math.abs(k); if (k > 4) k = 4;
      const F = this.A.meta.frames, act = typeof this.anim === 'string' && F.act && F.act[this.anim];
      const set = act ? null : speed > .2 ? F.walk : this.anim === 3 ? F.sit : F.idle;
      let fr = act || (set && (set[DIRS[k]] || set.S)), i = 0, bob = 0;
      if (act) { k = 0; } // 動作只有正面圖
      if (!act && speed > .2) { const ph = this.t * speed * 1.6; i = Math.floor(ph) % fr.length; if (fr.length < 4) bob = Math.abs(Math.sin(ph * Math.PI)) * .03; }
      else if (!act && this.anim !== 3) bob = Math.sin(this.t * 2.2) * .004; // 站著時微微呼吸
      const { fw, fh, cols, rows } = this.A.meta, idx = fr[i].i, W = cols * fw, Hh = rows * fh;
      this.u.uRect.value.set((idx % cols) * fw / W, 1 - (Math.floor(idx / cols) + 1) * fh / Hh, fw / W, fh / Hh); this.u.uFlip.value = flip && !act ? 1 : 0;
      this.mesh.position.y = bob;
    }
  }
}
