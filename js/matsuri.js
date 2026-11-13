// 江戶町 祭典：依共同時鐘每 12 分鐘舉行 4 分鐘（所有玩家同時）
// 內容：街上紅白提燈串、神轎隊伍（6 位扛轎人喊「わっしょい」）、祭典太鼓與笛、町人跳盆踊、夜晚煙火
// 效能：提燈用 InstancedMesh（1 次繪製）、煙火用 Points、扛轎人只在祭典時存在
import * as THREE from 'three';

export const FEST = { on: false, ph: -1 };
const PERIOD = 720, LEN = 240;
const now = () => Date.now() / 1000 + (window.__festOff || 0); // __festOff：測試用時間偏移
export function festPhase() { const s = now() % PERIOD; return s < LEN ? s : -1; }
export function nextFestIn() { const s = now() % PERIOD; return s < LEN ? 0 : PERIOD - s; }

let confetti, mochiT = 12, C, deco, mik, bearers = [], fws = [], fwT = 2, chantT = 1, voiceT = 3, beatI = 0, beatT = 0, fueT = 2;
export function initMatsuri(ctx) { C = ctx; }

function buildDeco() {
  const g = new THREE.Group(); C.scene.add(g);
  const pos = []; const cols = [];
  const cord = [];
  for (let x = -94; x <= 100; x += 9) {
    // 兩側店簷之間拉一條下垂的繩，掛 7 顆提燈
    const n = 7, y0 = 4.3;
    for (let i = 0; i <= n + 1; i++) { const t = i / (n + 1), z = -6.6 + t * 13.2, y = y0 - Math.sin(t * Math.PI) * .9; cord.push(x, y, z); if (i > 0 && i < n + 2) cord.push(x, y, z); }
    cord.pop(); cord.pop(); cord.pop();
    for (let i = 1; i <= n; i++) { const t = i / (n + 1), z = -6.6 + t * 13.2, y = y0 - Math.sin(t * Math.PI) * .9 - .32; pos.push([x, y, z]); cols.push(i % 2 ? '#ffffff' : '#ffe2c8'); }
  }
  const lg = new THREE.SphereGeometry(.2, 10, 8); lg.scale(1, 1.25, 1);
  const lm = new THREE.MeshBasicMaterial({ color: '#ffffff' }); { const t = new THREE.TextureLoader().load('img/tex/lantern_matsuri.jpg'); t.colorSpace = THREE.SRGBColorSpace; lm.map = t; } // Gemini 畫的「祭」提燈
  const inst = new THREE.InstancedMesh(lg, lm, pos.length); const m4 = new THREE.Matrix4(), col = new THREE.Color();
  pos.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); inst.setColorAt(i, col.set(cols[i])); });
  inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; g.add(inst);
  const lineG = new THREE.BufferGeometry(); lineG.setAttribute('position', new THREE.Float32BufferAttribute(cord, 3));
  g.add(new THREE.LineSegments(lineG, new THREE.LineBasicMaterial({ color: '#3a2a20' })));
  g.visible = false; return g;
}

function buildMikoshi() {
  const g = new THREE.Group(); C.scene.add(g);
  const lac = new THREE.MeshStandardMaterial({ color: '#1a1210', roughness: .3 }), gold = new THREE.MeshStandardMaterial({ color: '#d8a83a', metalness: .7, roughness: .3, emissive: '#3a2400' }), red = new THREE.MeshStandardMaterial({ color: '#a8232e', roughness: .5 });
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  add(new THREE.BoxGeometry(1.25, .22, 1.25), lac, 0, 1.45, 0);
  add(new THREE.BoxGeometry(.86, .62, .86), red, 0, 1.87, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(.035, .035, .62, 6), gold, sx * .43, 1.87, sz * .43);
  add(new THREE.BoxGeometry(1.0, .08, 1.0), gold, 0, 2.2, 0);
  add(new THREE.ConeGeometry(.92, .55, 4), lac, 0, 2.5, 0, Math.PI / 4);
  add(new THREE.ConeGeometry(.94, .08, 4), gold, 0, 2.22, 0, Math.PI / 4);
  add(new THREE.SphereGeometry(.13, 10, 8), gold, 0, 2.86, 0);
  const bird = add(new THREE.ConeGeometry(.08, .3, 5), gold, 0, 3.05, 0); bird.rotation.z = .3; // 鳳凰
  // 扛轎的兩根長木
  for (const sz of [-1, 1]) add(new THREE.BoxGeometry(4.6, .1, .1), new THREE.MeshStandardMaterial({ color: '#c9a868', roughness: .6 }), 0, 1.32, sz * .5);
  // 鈴鐺流蘇
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const t = add(new THREE.CylinderGeometry(.03, .06, .35, 6), red, sx * .62, 1.2, sz * .62); t.userData.tassel = 1; }
  g.visible = false; return g;
}

function makeBearers() {
  const looks = [0, 1, 2, 3, 4, 5].map(i => ({ k: [9, 0, 9, 3, 9, 0][i], p: [0, 1, 0, 0, 0, 1][i], o: 1, h: i % 3 === 2 ? 2 : 0, s: 1, hat: 3, fc: 1, ey: [3, 4, 0, 3, 4, 1][i], br: 3, mo: 1, ck: 0 }));
  return looks.map((lk, i) => { const ch = new C.Chara(lk, ''); C.scene.add(ch.root); ch.slot = [(i % 3 - 1) * 1.55, (i < 3 ? -1 : 1) * .5]; return ch; });
}

let _dot;
function dotTex() { if (_dot) return _dot; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); return _dot; }
function burst() {
  const N = 150, pos = new Float32Array(N * 3), vel = [];
  const cx = -60 + Math.random() * 170, cy = 42 + Math.random() * 26, cz = -55 - Math.random() * 25;
  const sp = 9 + Math.random() * 6;
  for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); vel.push([r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp]); pos.set([cx, cy, cz], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = ['#ff5a6a', '#ffd25a', '#7ad8ff', '#b07aff', '#7aff9a', '#ffffff'][Math.floor(Math.random() * 6)];
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col, map: dotTex(), size: 2.6, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  C.scene.add(pts); fws.push({ pts, vel, t: 0 });
  const d = Math.hypot(cx - C.pos().x, cz - C.pos().z); setTimeout(() => C.SND.boom && C.SND.boom(Math.max(.15, 1 - d / 260)), Math.min(1500, d / 340 * 1000));
}

// 紙花：神轎周圍飄落的彩色紙片（1 個 Points）
function buildConfetti() {
  const N = 220, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color(), pal = ['#e8455c', '#f2d27a', '#ffffff', '#7ab8e8', '#f29ac0', '#8ad89a'];
  for (let i = 0; i < N; i++) { pos.set([(Math.random() - .5) * 8, Math.random() * 6, (Math.random() - .5) * 6], i * 3); c.set(pal[i % pal.length]); col.set([c.r, c.g, c.b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: .12, vertexColors: true, transparent: true, opacity: .95, depthWrite: false })); p.frustumCulled = false; C.scene.add(p); return p;
}
export function updMatsuri(dt) {
  if (!C) return;
  const ph = festPhase(), on = ph >= 0; FEST.ph = ph;
  if (on && !FEST.on) {
    FEST.on = true; if (!deco) deco = buildDeco(); if (!mik) mik = buildMikoshi(); bearers = makeBearers();
    if (!confetti) confetti = buildConfetti(); confetti.visible = true;
    deco.visible = true; mik.visible = true; C.SND.duck && C.SND.duck(true);
    C.announce('🏮 夏祭り開催中！神輿が大通りを練り歩きます。一緒に盆踊りしよう！', '江戶町');
  }
  if (!on && FEST.on) {
    FEST.on = false; deco.visible = false; mik.visible = false; if (confetti) confetti.visible = false; bearers.forEach(b => C.scene.remove(b.root)); bearers = []; C.SND.duck && C.SND.duck(false);
    C.toast('🏮 祭典結束了，下一場約 8 分鐘後', 3500);
  }
  if (FEST.on) {
    // 神轎沿大街來回（約 2 分鐘一趟）
    const L = 190, s = (ph * 1.6) % (L * 2), fwd = s < L, x = fwd ? -90 + s : 100 - (s - L), ry = fwd ? Math.PI / 2 : -Math.PI / 2, t = performance.now() / 1000;
    const bob = Math.abs(Math.sin(t * 5)) * .12;
    mik.position.set(x, bob, .3); mik.rotation.y = fwd ? 0 : Math.PI; mik.rotation.z = Math.sin(t * 2.5) * .05;
    for (const b of bearers) {
      const [ox, oz] = b.slot, dir = fwd ? 1 : -1;
      b.root.position.set(x + ox * dir, 0, .3 + oz); b.root.rotation.y = ry; b.play(1); b.update(dt, 1.6);
      for (const a of b.arms) { a.rotation.x = -2.7; a.rotation.z = (a.position.x > 0 ? -1 : 1) * .15; } // 雙手舉高扛轎
    }
    const dP = Math.hypot(x - C.pos().x, .3 - C.pos().z);
    // 紙花跟著神轎飄落
    { const p = confetti.geometry.attributes.position, a = p.array; confetti.position.set(x, 0, .3);
      for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * (.6 + (i % 7) * .08); a[i] += Math.sin(t * 2 + i) * dt * .4; if (a[i + 1] < 0) { a[i + 1] = 4 + Math.random() * 2.5; a[i] = (Math.random() - .5) * 8; a[i + 2] = (Math.random() - .5) * 6; } }
      p.needsUpdate = true; }
    // 撒福餅：神轎附近的人撿得到小錢
    mochiT -= dt; if (mochiT < 0) { mochiT = 18 + Math.random() * 8; const b = bearers[0]; b && b.say('福餅だ〜！', 2);
      if (dP < 12) { const v = 10 + Math.floor(Math.random() * 21); C.gift && C.gift(v); C.toast(`🍡 撿到福餅！得到 ${v} 文`, 2500); } else if (dP < 40) C.toast('神轎那邊在撒福餅！快靠近一點', 2200); }
    chantT -= dt; if (chantT < 0) { chantT = 1.6 + Math.random(); const b = bearers[Math.floor(Math.random() * bearers.length)]; b.say(Math.random() < .7 ? 'わっしょい！' : 'せいや！', 1.4); }
    voiceT -= dt; if (voiceT < 0 && dP < 35) { voiceT = 5 + Math.random() * 3; C.SND.call('わっしょい、わっしょい！', '嘿咻、嘿咻！', 1 - dP / 40, 1.15); }
    // 祭典太鼓（ドン・ドン・カッ）與笛
    beatT -= dt; if (beatT < 0) { beatT = .27; const pat = [2, 0, 1, 0, 2, 1, 3, 0, 2, 0, 1, 1, 2, 0, 3, 0]; const k = pat[beatI++ % pat.length]; if (k && C.SND.taiko) C.SND.taiko(k, Math.max(.25, 1 - dP / 120)); }
    fueT -= dt; if (fueT < 0) { fueT = 3.8 + Math.random() * 2; C.SND.fue && C.SND.fue(); }
    // 夜晚煙火
    if (C.night() > .35) { fwT -= dt; if (fwT < 0 && fws.length < 4) { fwT = 1.8 + Math.random() * 2.5; burst(); } }
  }
  for (let i = fws.length - 1; i >= 0; i--) {
    const f = fws[i]; f.t += dt; const p = f.pts.geometry.attributes.position;
    for (let j = 0; j < f.vel.length; j++) { const v = f.vel[j]; v[1] -= 4.5 * dt; v[0] *= .985; v[1] *= .985; v[2] *= .985; p.array[j * 3] += v[0] * dt; p.array[j * 3 + 1] += v[1] * dt; p.array[j * 3 + 2] += v[2] * dt; }
    p.needsUpdate = true; f.pts.material.opacity = Math.max(0, 1 - f.t / 2.6);
    if (f.t > 2.6) { C.scene.remove(f.pts); f.pts.geometry.dispose(); f.pts.material.dispose(); fws.splice(i, 1); }
  }
}
