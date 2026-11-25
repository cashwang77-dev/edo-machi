// 妖怪の森（冒險區）：RO 風格練等打怪
// 神社廣場的傳送陣 → 森林營地（安全區：武器屋、妖怪札、藥草團子、收購素材）→ 越往北妖怪越強 → 最深處每 10 分鐘降臨頭目「大天狗」
// 操作：點妖怪自動走過去連續攻擊（或按 F／⚔️ 打最近的）、Q 斬擊、R 旋風斬、H 吃團子。動作全部用 dt 補間（衝刺、閃白、擊退、彈跳、死亡消散）
import * as THREE from 'three';
const PI = Math.PI, TAU = PI * 2, rnd = (a, b) => a + Math.random() * (b - a), ease = t => 1 - (1 - t) ** 3;
export const FOREST = { x0: -178, x1: -64, z0: -156, z1: -84 };
const CAMP = { x: -121, z: -92 }, P_IN = { x: -137, z: -19.5 }, P_OUT = { x: -121, z: -87.4 };
const POND = { x: -84, z: -140, r: 8 }, ARENA = { x: -152, z: -140 };
export function walkForest(x, z) {
  if (!(x >= FOREST.x0 && x <= FOREST.x1 && z >= FOREST.z0 && z <= FOREST.z1)) return false;
  return Math.hypot(x - POND.x, z - POND.z) > POND.r;
}
// 妖怪：名稱, Lv, HP, 攻, 防, 經驗, 錢[min,max], 速度, 主動攻擊, 半徑, 素材, 掉率, 札掉率
const MOB = {
  onibi: { n: '鬼火', lv: 1, hp: 30, atk: 5, def: 0, xp: 6, mon: [2, 5], spd: 1.5, agg: 0, r: .45, mat: 'hinoko', mr: .55, cr: .02 },
  kasa: { n: '唐傘お化け', lv: 3, hp: 58, atk: 8, def: 1, xp: 11, mon: [4, 8], spd: 2.1, agg: 0, r: .55, mat: 'kasabone', mr: .5, cr: .015 },
  chochin: { n: '提灯お化け', lv: 6, hp: 100, atk: 13, def: 3, xp: 20, mon: [6, 12], spd: 1.5, agg: 1, r: .55, mat: 'rousoku', mr: .45, cr: .012 },
  tanuki: { n: '化け狸', lv: 9, hp: 160, atk: 17, def: 5, xp: 32, mon: [9, 16], spd: 2.4, agg: 0, r: .6, mat: 'konoha', mr: .45, cr: .01 },
  kappa: { n: '河童', lv: 13, hp: 250, atk: 25, def: 8, xp: 55, mon: [14, 24], spd: 2.2, agg: 1, r: .6, mat: 'sara', mr: .4, cr: .008 },
  tengu: { n: '大天狗', lv: 20, hp: 2600, atk: 34, def: 12, xp: 650, mon: [300, 300], spd: 2.6, agg: 1, r: 1.3, mat: 'hane', mr: 1, cr: .3, boss: 1 },
};
const MAT = { hinoko: ['🔥', '鬼火の欠片', 6], kasabone: ['🦴', '傘の骨', 10], rousoku: ['🕯️', '妖しい蠟燭', 15], konoha: ['🍃', '化け葉', 22], sara: ['🍽️', '河童の皿', 35], hane: ['🪶', '天狗の羽', 220] };
// 妖怪札（卡片）：裝在武器插槽上才有效
const CARD = { onibi: ['鬼火札', '攻擊 +5', { atk: 5 }], kasa: ['唐傘札', '防禦 +4', { def: 4 }], chochin: ['提灯札', '暴擊 +10%', { crit: .1 }], tanuki: ['化け狸札', '掉寶率 +40%', { drop: .4 }], kappa: ['河童札', 'HP 上限 +60', { hp: 60 }], tengu: ['大天狗札', '攻擊 +20%・暴擊 +10%', { atkP: .2, crit: .1 }] };
// 武器：名, 攻擊, 插槽, 價格, 攻擊間隔(秒), 射程, 刀光顏色
const WEAP = { boku: ['木刀', 6, 0, 0, .85, 1.6, '#fff4d8'], yari: ['竹槍', 11, 0, 180, .95, 2.5, '#d8ffd0'], uchi: ['打刀', 20, 1, 700, .78, 1.8, '#d8ecff'], ono: ['鉞', 31, 1, 1600, 1.1, 1.8, '#ffd0a0'], masa: ['名刀・正宗', 44, 2, 4200, .72, 1.9, '#bfe4ff'] };
// 出生點：[種類, x, z, 數量, 範圍]
const SPAWN = [['onibi', -110, -100, 4, 9], ['kasa', -140, -102, 3, 9], ['onibi', -150, -96, 2, 6], ['chochin', -96, -120, 3, 8], ['tanuki', -132, -122, 3, 9], ['kasa', -76, -104, 2, 6],
  ['kappa', -84, -140, 4, 13], ['tanuki', -112, -146, 2, 7], ['chochin', -165, -120, 2, 7]];
const BOSS_CYCLE = 600, BOSS_WIN = 360; // 每 10 分鐘的前 6 分鐘出現

let A, S, root, mobs = [], fx, sparks, drops = [], slashes = [], stomps = [], tgtRing, lay, hudEl, tgtEl, barEl;
let hemi, inF = false, tgt = null, atkCd = 0, lunge = 9, warpCd = 0, combatT = 9, dead = 0, shake = 0, skCd = [0, 0], bossDay = -1, bossM = null, portalIn, portalOut, ffly;
const st = () => S;
function save() { A.store.set('adv', S); }
const lv = () => (A.P.prog() ? A.P.prog().lv : 1);
export function stats() {
  const L = lv(), w = WEAP[S.w], r = rfOf(S.w); let atk = 8 + L * 2 + w[1] + r * 3 + Math.max(0, r - 6) * 5, def = Math.floor(L * .6), hp = 80 + L * 12, crit = .05, drop = 1, atkP = 0;
  for (const c of S.eq) { const e = CARD[c] && CARD[c][2]; if (!e) continue; atk += e.atk || 0; def += e.def || 0; hp += e.hp || 0; crit += e.crit || 0; drop += e.drop || 0; atkP += e.atkP || 0; }
  return { atk: Math.round(atk * (1 + atkP)), def, hp, sp: 30 + L * 3, crit, drop, w, r, wn: (r ? '+' + r + ' ' : '') + w[0] };
}
const rfOf = k => (S.rf && S.rf[k]) || 0, RF_OK = [1, 1, 1, 1, .9, .75, .6, .45, .3, .2], rfCost = r => 40 * (r + 1) * (r + 1);
export function refine() { const k = S.w, r = rfOf(k); if (r >= 10) return A.toast('已經是 +10 了，這把刀傳家寶等級！'); const c = rfCost(r); if (!A.afford(c)) { A.toast('錢不夠喔'); return null; }
  A.addMoney(-c, '精煉 ' + WEAP[k][0]); S.rf = S.rf || {}; const ok = Math.random() < RF_OK[r];
  if (ok) { S.rf[k] = r + 1; tone(520, 1560, .35, .1, 'triangle'); setTimeout(() => tone(1560, 2080, .3, .08), 180); burst(A.G.pos.x, 1.4, A.G.pos.z, r + 1 >= 7 ? '#ffd848' : '#bfe4ff', r + 1 >= 7 ? 40 : 18, 3, 1); A.toast(`🔨 精煉成功！${WEAP[k][0]} → +${r + 1}`, 2500); if (r + 1 >= 7) { A.G.me && A.G.me.emoji('✨'); A.announce && A.announce(`🔨 ${A.G.name || '旅人'} 的 ${WEAP[k][0]} 精煉到 +${r + 1}！`, '妖怪の森'); } }
  else { S.rf[k] = 0; noise(.5, 900, 200, 1, .3); shake = .4; A.toast(`💥 精煉失敗……${WEAP[k][0]} 變回 +0 了`, 3000); A.G.me && A.G.me.emoji('😭'); }
  save(); hud(); return ok; }

// ---------- 小工具：貼圖、音效 ----------
const emoTex = {}; function etex(e) { if (emoTex[e]) return emoTex[e]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 32, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return emoTex[e] = t; }
let _nb = null; function nbuf(ac) { if (_nb) return _nb; _nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = _nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return _nb; }
function noise(dur, f0, f1, q = 1.2, v = .25, type = 'bandpass') {
  const S0 = A.SND, ac = S0.ac; if (!ac || !S0.sfxG) return; const t = ac.currentTime, n = ac.createBufferSource(); n.buffer = nbuf(ac);
  const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); n.connect(f).connect(g).connect(S0.sfxG); n.start(t); n.stop(t + dur + .05);
}
function tone(f0, f1, dur, v = .12, type = 'sine') { const S0 = A.SND, ac = S0.ac; if (!ac || !S0.sfxG) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(S0.sfxG); o.start(t); o.stop(t + dur + .02); }
const SFX = {
  swing: () => noise(.18, 2400, 700, 1.4, .22),
  hit: c => { tone(c ? 220 : 160, 60, .16, .22, 'triangle'); noise(.1, 1800, 400, .8, c ? .4 : .25); },
  hurt: () => { tone(300, 120, .2, .15, 'sawtooth'); },
  die: () => { noise(.5, 900, 120, .7, .25, 'lowpass'); tone(520, 1040, .25, .06); },
  pick: () => { tone(1320, 1760, .1, .07); },
  card: () => [0, .1, .2, .32].forEach((d, i) => setTimeout(() => tone([880, 1109, 1319, 1760][i], [880, 1109, 1319, 1760][i] * 1.01, .35, .09, 'triangle'), d * 1000)),
  warp: () => { tone(220, 1760, .6, .08, 'sine'); noise(.6, 400, 4000, 2, .12); },
  stomp: () => { tone(90, 30, .5, .35, 'sine'); noise(.4, 600, 80, .7, .35, 'lowpass'); },
};

// ---------- 森林場景 ----------
function buildForest(scene) {
  root = new THREE.Group(); root.visible = false; scene.add(root);
  const W0 = FOREST.x1 - FOREST.x0 + 30, D0 = FOREST.z1 - FOREST.z0 + 30, cx = (FOREST.x0 + FOREST.x1) / 2, cz = (FOREST.z0 + FOREST.z1) / 2;
  // 地面：苔＋落葉的手繪雜訊
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#3d4a2a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const v = Math.random(); g.fillStyle = v < .4 ? 'rgba(80,96,52,.5)' : v < .7 ? 'rgba(46,58,30,.55)' : v < .85 ? 'rgba(110,84,48,.45)' : 'rgba(140,60,40,.35)'; const r = 1 + Math.random() * 4; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, r, r * .6, Math.random() * 3, 0, TAU); g.fill(); }
  const gt = new THREE.CanvasTexture(c); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(W0 / 10, D0 / 10); gt.colorSpace = THREE.SRGBColorSpace;
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(W0, D0), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); gnd.rotation.x = -PI / 2; gnd.position.set(cx, .02, cz); gnd.receiveShadow = true; root.add(gnd);
  // 小徑（營地往北）
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 64), new THREE.MeshStandardMaterial({ color: '#6b5a40', roughness: 1, transparent: true, opacity: .8 })); path.rotation.x = -PI / 2; path.position.set(-121, .03, -118); root.add(path);
  // 池塘
  const pond = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 40), new THREE.MeshStandardMaterial({ color: '#2a5058', roughness: .1, metalness: .2, transparent: true, opacity: .9 })); pond.rotation.x = -PI / 2; pond.position.set(POND.x, .05, POND.z); root.add(pond);
  // 杉樹（instanced）：邊界一圈密林＋場內散落
  const trees = []; const ok = (x, z) => Math.hypot(x - CAMP.x, z - CAMP.z) > 9 && Math.hypot(x - POND.x, z - POND.z) > POND.r + 2.5 && Math.hypot(x - ARENA.x, z - ARENA.z) > 12 && Math.abs(x + 121) > 3 && SPAWN.every(q => Math.hypot(x - q[1], z - q[2]) > q[4] + 2);
  for (let i = 0; i < 230; i++) { const side = i % 4, t = Math.random(); let x, z;
    if (side === 0) { x = FOREST.x0 + t * (FOREST.x1 - FOREST.x0); z = FOREST.z0 - 1 - Math.random() * 12; } else if (side === 1) { x = FOREST.x0 + t * (FOREST.x1 - FOREST.x0); z = FOREST.z1 + 1 + Math.random() * 10; if (Math.abs(x + 121) < 7) continue; }
    else if (side === 2) { z = FOREST.z0 + t * (FOREST.z1 - FOREST.z0); x = FOREST.x0 - 1 - Math.random() * 12; } else { z = FOREST.z0 + t * (FOREST.z1 - FOREST.z0); x = FOREST.x1 + 1 + Math.random() * 10; }
    trees.push([x, z, 1 + Math.random() * .7, 0]); }
  for (let i = 0; i < 300 && trees.filter(t => t[3]).length < 40; i++) { const x = rnd(FOREST.x0 + 4, FOREST.x1 - 4), z = rnd(FOREST.z0 + 4, FOREST.z1 - 6); if (!ok(x, z) || trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 6)) continue; trees.push([x, z, .9 + Math.random() * .6, 1]); }
  const trunkG = new THREE.CylinderGeometry(.22, .38, 4, 7); trunkG.translate(0, 2, 0);
  const leafG = []; for (let k = 0; k < 3; k++) { const cg = new THREE.ConeGeometry(2.1 - k * .55, 3.2, 8); cg.translate(0, 3.6 + k * 1.9, 0); leafG.push(cg); }
  const tr = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 }), trees.length);
  const lfs = leafG.map((gg, k) => new THREE.InstancedMesh(gg, new THREE.MeshStandardMaterial({ color: ['#1f3b26', '#264a2c', '#2d5632'][k], roughness: .95, flatShading: true }), trees.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  trees.forEach((t, i) => { e.set(0, Math.random() * TAU, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(t[0], 0, t[1]), q, new THREE.Vector3(t[2], t[2] * (1 + Math.random() * .25), t[2])); tr.setMatrixAt(i, m4); for (const l of lfs) l.setMatrixAt(i, m4); if (t[3]) A.W.colliders.push({ x: t[0], z: t[1], r: .5 * t[2] }); });
  tr.castShadow = true; for (const l of lfs) { l.castShadow = true; root.add(l); } root.add(tr);
  // 石燈籠（自發光，不用真燈）
  const stone = new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 1 }), glow = new THREE.MeshBasicMaterial({ color: '#ffc870' });
  for (const [x, z] of [[-117, -90], [-125, -90], [-117, -104], [-125, -104], [-117, -118], [-125, -118], [-117, -132], [-125, -132], [-146, -132], [-158, -132], [-146, -148], [-158, -148]]) {
    const l = new THREE.Group(); l.position.set(x, 0, z);
    l.add(new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .9, 6), stone)).position.y = .45; const bx = new THREE.Mesh(new THREE.BoxGeometry(.6, .5, .6), stone); bx.position.y = 1.15; l.add(bx);
    const lt = new THREE.Mesh(new THREE.BoxGeometry(.34, .3, .62), glow); lt.position.y = 1.15; l.add(lt); const rf = new THREE.Mesh(new THREE.ConeGeometry(.6, .4, 4), stone); rf.position.y = 1.6; rf.rotation.y = PI / 4; l.add(rf);
    root.add(l); A.W.colliders.push({ x, z, r: .4 }); }
  // 營地：鳥居、篝火、兩個攤子
  const red = new THREE.MeshStandardMaterial({ color: '#b8402c', roughness: .7 }), wood = new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: .9 }), cloth = new THREE.MeshStandardMaterial({ color: '#2c3a5a', roughness: .9 });
  const torii = new THREE.Group(); torii.position.set(-121, 0, -97.5);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.18, .22, 4, 10), red); p.position.set(s * 2.2, 2, 0); torii.add(p); A.W.colliders.push({ x: -121 + s * 2.2, z: -97.5, r: .3 }); }
  const kb = new THREE.Mesh(new THREE.BoxGeometry(5.8, .3, .4), red); kb.position.y = 4.1; torii.add(kb); const nk = new THREE.Mesh(new THREE.BoxGeometry(5, .22, .3), red); nk.position.y = 3.4; torii.add(nk); root.add(torii);
  const fire = new THREE.Group(); fire.position.set(-116, 0, -93); for (let i = 0; i < 5; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 1, 5), wood); lg.rotation.z = PI / 2; lg.rotation.y = i / 5 * PI; lg.position.y = .1; fire.add(lg); }
  const fl = new THREE.Mesh(new THREE.ConeGeometry(.35, 1, 8), new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.y = .55; fire.add(fl); fire.userData.fl = fl; root.add(fire); root.userData.fire = fire; A.W.colliders.push({ x: -116, z: -93, r: .6 });
  for (const [x, z, col] of [[-128, -93, cloth], [-128, -88.5, red]]) { const s = new THREE.Group(); s.position.set(x, 0, z);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, 2.4), wood); tb.position.y = .4; s.add(tb); for (const a of [-1, 1]) for (const b of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, 2.2, .1), wood); p.position.set(a * .8, 1.1, b * 1.2); s.add(p); }
    const rf = new THREE.Mesh(new THREE.BoxGeometry(2, .08, 2.9), col); rf.position.y = 2.25; rf.rotation.z = .15; s.add(rf); root.add(s); A.W.colliders.push({ x0: x - .9, z0: z - 1.3, x1: x + .9, z1: z + 1.3 }); }
  // 天狗的石圈
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.8, 0), stone); r.position.set(ARENA.x + Math.cos(a) * 10, .4, ARENA.z + Math.sin(a) * 10); r.scale.y = 1.6; root.add(r); A.W.colliders.push({ x: r.position.x, z: r.position.z, r: .7 }); }
  const shime = new THREE.Mesh(new THREE.RingGeometry(9.6, 10.2, 48), new THREE.MeshBasicMaterial({ color: '#6a2a2a', transparent: true, opacity: .5, depthWrite: false })); shime.rotation.x = -PI / 2; shime.position.set(ARENA.x, .04, ARENA.z); root.add(shime);
  hemi = new THREE.HemisphereLight('#a8c8ff', '#304028', 0); A.scene.add(hemi); // 只調強度，不增減燈光（避免 shader 重編譯卡頓）
  // 螢火蟲
  const n = 140, fp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { fp[i * 3] = rnd(FOREST.x0, FOREST.x1); fp[i * 3 + 1] = rnd(.5, 3); fp[i * 3 + 2] = rnd(FOREST.z0, FOREST.z1); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); ffly = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#d8ff90', size: .14, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  ffly.userData.base = fp.slice(); root.add(ffly);
  // 森林營地 NPC 與互動點
  const shopA = A.makeNPC(A.randomLook ? A.randomLook() : {}); shopA.setName('武器屋 鐵五郎', true); shopA.root.position.set(-128.6, 0, -94.6); shopA.root.rotation.y = PI / 2; A.scene.add(shopA.root);
  const shopB = A.makeNPC(A.randomLook ? A.randomLook() : {}); shopB.setName('巫女 お鈴', true); shopB.root.position.set(-128.6, 0, -88.5); shopB.root.rotation.y = PI / 2; A.scene.add(shopB.root);
  A.W.spots.push({ type: 'adv', k: 'weap', x: -127, z: -93, label: '⚔️ 武器屋（武器・藥草團子・收購素材）' });
  A.W.spots.push({ type: 'adv', k: 'card', x: -127, z: -88.5, label: '🃏 妖怪札（插卡・冒險紀錄）' });
  A.W.spots.push({ type: 'adv', k: 'out', x: P_OUT.x, z: P_OUT.z, label: '🌀 傳送陣：回神社' });
  A.W.spots.push({ type: 'adv', k: 'in', x: P_IN.x, z: P_IN.z, label: '🌀 傳送陣：妖怪の森' });
}
// RO 風格的藍色傳送陣（光圈＋往上飄的光點）
function makePortal(scene, p) {
  const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
  const mat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(.55, 1.05, 40), mat('#5ab8ff')); r1.rotation.x = -PI / 2; r1.position.y = .06; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(.2, .45, 30), mat('#c0f0ff')); r2.rotation.x = -PI / 2; r2.position.y = .07; g.add(r2);
  const n = 40, pos = new Float32Array(n * 3), sd = []; for (let i = 0; i < n; i++) sd.push([Math.random() * TAU, .3 + Math.random() * .7, Math.random() * 2.4]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#9ad8ff', size: .12, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(pts);
  g.userData = { r1, r2, pts, sd }; scene.add(g); return g;
}
function updPortal(g, dt, time) { if (!g || !g.visible) return; const { r1, r2, pts, sd } = g.userData; r1.rotation.z += dt * .8; r2.rotation.z -= dt * 1.6; r1.material.opacity = .55 + Math.sin(time * 3) * .15;
  const P = pts.geometry.attributes.position; sd.forEach((s, i) => { s[2] += dt * (.6 + s[1] * .5); if (s[2] > 2.4) s[2] = 0; s[0] += dt * 1.2; P.setXYZ(i, Math.cos(s[0]) * s[1], s[2], Math.sin(s[0]) * s[1]); }); P.needsUpdate = true; }

// ---------- 妖怪模型（程序化，共用幾何） ----------
const GEO = {}; const geo = (k, f) => GEO[k] || (GEO[k] = f());
function std(c, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, emissive: '#000000' }, o)); }
function eyes(g, y, z, s = .09, dx = .14) { const w = std('#ffffff'), b = std('#151010'); for (const x of [-dx, dx]) { const e = new THREE.Mesh(geo('eye', () => new THREE.SphereGeometry(1, 10, 8)), w); e.scale.setScalar(s); e.position.set(x, y, z); g.add(e); const p = new THREE.Mesh(GEO.eye, b); p.scale.setScalar(s * .55); p.position.set(x, y, z + s * .6); g.add(p); } }
function build(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const mats = [];
  const add = (gm, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); o.castShadow = true; body.add(o); if (m.emissive) mats.push(m); return o; };
  if (kind === 'onibi') {
    const core = new THREE.MeshBasicMaterial({ color: '#c8f0ff' }); add(geo('sph', () => new THREE.SphereGeometry(1, 16, 12)), core, 0, .5, 0).scale.setScalar(.32);
    const fl = new THREE.MeshBasicMaterial({ color: '#5ab0ff', transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
    const f = add(geo('flame', () => { const c = new THREE.ConeGeometry(.45, 1.1, 12); c.translate(0, .45, 0); return c; }), fl, 0, .3, 0); f.castShadow = false; body.userData.flame = f;
    eyes(body, .55, .26, .07, .1); mats.push(core);
  } else if (kind === 'kasa') {
    const paper = std('#b8463a', { flatShading: true, side: THREE.DoubleSide }); add(geo('kasa', () => new THREE.ConeGeometry(.8, .9, 10, 1, true)), paper, 0, 1.05, 0);
    add(geo('stick', () => new THREE.CylinderGeometry(.04, .05, 1, 6)), std('#d8c090'), 0, .5, 0); add(geo('geta', () => new THREE.BoxGeometry(.22, .08, .34)), std('#5a3a22'), 0, .04, 0);
    eyes(body, 1.0, .5, .17, 0); const tg = add(geo('tongue', () => new THREE.BoxGeometry(.16, .4, .04)), std('#e05060'), 0, .68, .55); tg.rotation.x = -.3;
  } else if (kind === 'chochin') {
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(.18 + Math.sin(t * PI) * .32, t * .9)); }
    const lm = std('#f0d8a0', { emissive: '#c87828', emissiveIntensity: .7, side: THREE.DoubleSide }); add(geo('lathe', () => new THREE.LatheGeometry(pts, 14)), lm, 0, .6, 0); body.userData.lamp = lm;
    for (const y of [.6, 1.5]) add(geo('rib', () => new THREE.CylinderGeometry(.22, .22, .08, 12)), std('#222'), 0, y, 0);
    eyes(body, 1.18, .44, .09, .14); add(geo('mouth', () => new THREE.BoxGeometry(.4, .14, .05)), std('#401010'), 0, .9, .5); add(GEO.tongue, std('#e05060'), 0, .78, .5).scale.set(1, .6, 1);
  } else if (kind === 'tanuki') {
    const fur = std('#8a6440'), lt = std('#d8c0a0'), dk = std('#3a2a1e');
    add(GEO.sph || geo('sph', () => new THREE.SphereGeometry(1, 16, 12)), fur, 0, .5, 0).scale.set(.5, .48, .45); add(GEO.sph, lt, 0, .45, .25).scale.set(.34, .32, .25);
    add(GEO.sph, fur, 0, 1.05, .05).scale.setScalar(.32); add(GEO.sph, dk, 0, 1.08, .27).scale.set(.24, .1, .06); for (const x of [-.18, .18]) add(geo('ear', () => new THREE.ConeGeometry(.08, .16, 6)), dk, x, 1.32, 0);
    add(GEO.sph, std('#2a2a2a'), 0, 1.0, .35).scale.setScalar(.05); eyes(body, 1.1, .3, .045, .1);
    const tl = add(GEO.sph, fur, 0, .4, -.5); tl.scale.set(.18, .18, .32); const lf = add(geo('leaf', () => new THREE.ConeGeometry(.12, .3, 4)), std('#4a8a3a'), 0, 1.42, 0); lf.rotation.z = .5;
  } else if (kind === 'kappa') {
    const sk = std('#5a9a58'), sh = std('#6a5030', { flatShading: true });
    add(geo('cap', () => new THREE.CapsuleGeometry(.36, .5, 4, 10)), sk, 0, .68, 0); const s2 = add(GEO.sph || geo('sph', () => new THREE.SphereGeometry(1, 16, 12)), sh, 0, .75, -.2); s2.scale.set(.42, .48, .3);
    add(GEO.sph, sk, 0, 1.3, .02).scale.setScalar(.3); add(geo('dish', () => new THREE.CylinderGeometry(.2, .2, .04, 14)), std('#f0f0e8'), 0, 1.58, 0);
    const bk = add(geo('beak', () => new THREE.ConeGeometry(.09, .22, 6)), std('#e0b030'), 0, 1.24, .32); bk.rotation.x = PI / 2; eyes(body, 1.38, .25, .06, .11);
  } else if (kind === 'tengu') {
    const face = std('#c8302a'), robe = std('#e8e0d0'), dark = std('#1e1a22', { side: THREE.DoubleSide }), hair = std('#f0ece4');
    add(geo('robe', () => new THREE.CylinderGeometry(.35, .7, 1.4, 10)), robe, 0, .9, 0); add(geo('sph', () => new THREE.SphereGeometry(1, 16, 12)), face, 0, 1.9, 0).scale.setScalar(.32);
    const ns = add(geo('nose', () => new THREE.ConeGeometry(.07, .55, 8)), face, 0, 1.9, .5); ns.rotation.x = PI / 2; add(GEO.sph, hair, 0, 2.05, -.12).scale.set(.38, .3, .34);
    add(geo('tok', () => new THREE.BoxGeometry(.16, .14, .16)), dark, 0, 2.28, .1); eyes(body, 1.98, .26, .05, .12);
    const wg = geo('wing', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.3, .5); s.lineTo(1.1, -.3); s.lineTo(.8, -.7); s.lineTo(0, -.4); return new THREE.ShapeGeometry(s); });
    for (const sx of [-1, 1]) { const w = add(wg, dark, sx * .2, 1.45, -.3); w.scale.x = sx; body.userData['w' + sx] = w; }
    const fan = add(geo('fan', () => new THREE.CircleGeometry(.35, 10, 0, PI)), std('#2e5a2a', { side: THREE.DoubleSide }), .55, 1.2, .2); fan.rotation.z = -.4;
  }
  return { g, body, mats };
}

// ---------- 妖怪生成與 AI ----------
function spawnMob(kind, x, z, rg) {
  const d = MOB[kind], v = build(kind), m = { k: kind, d, ...v, hx: x, hz: z, rg, x, z, ry: rnd(0, TAU), hp: d.hp, st: 'idle', t: rnd(0, 3), wt: rnd(1, 3), tx: x, tz: z, kbx: 0, kbz: 0, fl: 0, frz: 0, wind: 0, agg: false, ph: rnd(0, 9), resp: 0, deadT: 0, sc: d.boss ? 2.1 : 1 };
  m.g.scale.setScalar(m.sc); m.g.position.set(x, 0, z);
  // 頭上血條
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#201010', depthTest: false, transparent: true, opacity: .8 })), fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: d.boss ? '#e8a030' : '#e04040', depthTest: false }));
  bg.center.set(.5, .5); fg.center.set(0, .5); bg.scale.set(1, .09, 1); fg.scale.set(.96, .06, 1); bg.renderOrder = fg.renderOrder = 20;
  const hb = new THREE.Group(); hb.add(bg, fg); fg.position.x = -.48; hb.position.y = (kind === 'tengu' ? 2.7 : kind === 'kasa' || kind === 'chochin' || kind === 'kappa' ? 1.85 : 1.55); hb.visible = false; m.g.add(hb); m.hb = hb; m.hbF = fg;
  root.add(m.g); mobs.push(m); return m;
}
function hurtMob(m, dmg, crit, kb = .5) {
  if (m.st === 'dead') return; m.hp -= dmg; m.fl = 1; m.frz = crit ? .1 : .06; m.agg = true; m.hb.visible = true;
  const a = Math.atan2(m.x - A.G.pos.x, m.z - A.G.pos.z); m.kbx += Math.sin(a) * kb * 6 / (m.d.boss ? 4 : 1); m.kbz += Math.cos(a) * kb * 6 / (m.d.boss ? 4 : 1);
  num(m.x, (m.d.boss ? 3 : 1.6), m.z, crit ? dmg + '!' : dmg, crit ? 'crit' : ''); burst(m.x, .9 * m.sc, m.z, crit ? '#ffe070' : '#ffffff', crit ? 14 : 8, 3.5);
  SFX.hit(crit); if (crit) shake = Math.max(shake, .25);
  if (m.hp <= 0) killMob(m);
  else if (m.d.boss && !m.summ && m.hp < m.d.hp / 2) { m.summ = 1; for (let i = 0; i < 3; i++) { const o = spawnMob('onibi', m.x + rnd(-3, 3), m.z + rnd(-3, 3), 4); o.agg = true; o.tmp = 1; } A.toast('大天狗：「出來吧，鬼火們！」', 2500); }
}
function killMob(m) {
  m.st = 'dead'; m.deadT = 0; m.hp = 0; m.hb.visible = false; if (tgt === m) tgt = null; SFX.die(); burst(m.x, .8 * m.sc, m.z, '#a080d0', m.d.boss ? 40 : 16, 2.2, 1.4);
  const s = stats(), d = m.d; if (m.tmp) { m.resp = -1; return; }
  m.resp = d.boss ? -1 : rnd(9, 15);
  A.P.addXp(d.xp, d.n); const mon = Math.round(rnd(d.mon[0], d.mon[1])); A.addMoney(mon, d.n);
  S.kills[m.k] = (S.kills[m.k] || 0) + 1; S.tot = (S.tot || 0) + 1; save();
  A.P.ev('kill', { dex: 'yokai', k: m.k });
  if (Math.random() < d.mr * s.drop) dropItem(m.x, m.z, 'mat', d.mat, MAT[d.mat][0]);
  if (Math.random() < d.cr * s.drop) dropItem(m.x, m.z, 'card', m.k, '🃏');
  if (Math.random() < .08 && !d.boss) dropItem(m.x, m.z, 'pot', 'dango', '🍡');
  if (d.boss) { bossM = null; S.boss = (S.boss || 0) + 1; save(); A.announce && A.announce(`🏆 MVP！${A.G.name || '旅人'} 討伐了大天狗！`, '妖怪の森'); for (let i = 0; i < 2; i++) dropItem(m.x + rnd(-1, 1), m.z + rnd(-1, 1), 'mat', 'hane', MAT.hane[0]); A.G.me && A.G.me.emoji('🏆'); }
}
function updMob(m, dt, time) {
  const G = A.G, d = m.d;
  if (m.st === 'dead') {
    m.deadT += dt; const k = Math.min(1, m.deadT / .6); m.g.visible = k < 1; m.body.scale.set(1 + k * .4, 1 - k * .9, 1 + k * .4); m.body.position.y = k * .4; m.body.rotation.y += dt * 12;
    if (m.resp > 0 && m.deadT > m.resp) { const a = Math.random() * TAU, r = Math.random() * m.rg; m.x = m.hx + Math.cos(a) * r; m.z = m.hz + Math.sin(a) * r; if (!walkForest(m.x, m.z)) { m.x = m.hx; m.z = m.hz; }
      m.hp = d.hp; m.st = 'spawn'; m.deadT = 0; m.agg = false; m.g.visible = true; m.body.scale.setScalar(.01); m.body.position.y = 0; m.body.rotation.y = 0; }
    return;
  }
  if (m.st === 'spawn') { m.deadT += dt; const k = Math.min(1, m.deadT / .5); const s = k < .7 ? ease(k / .7) * 1.15 : 1.15 - (k - .7) / .3 * .15; m.body.scale.setScalar(Math.max(.01, s)); m.g.position.set(m.x, 0, m.z); if (k >= 1) m.st = 'idle'; return; }
  // 閃白
  if (m.fl > 0) { m.fl = Math.max(0, m.fl - dt * 6); for (const mt of m.mats) if (mt.emissive) { if (!mt.userData.e0) mt.userData.e0 = mt.emissive.clone(); mt.emissive.copy(mt.userData.e0).lerp(_white, m.fl); } }
  if (m.frz > 0) { m.frz -= dt; return; } // 打擊停頓
  // 擊退（指數衰減，平順）
  if (Math.abs(m.kbx) + Math.abs(m.kbz) > .01) { const nx = m.x + m.kbx * dt, nz = m.z + m.kbz * dt; if (walkForest(nx, nz)) { m.x = nx; m.z = nz; } const f = Math.exp(-dt * 9); m.kbx *= f; m.kbz *= f; }
  const px = G.pos.x, pz = G.pos.z, dp = Math.hypot(px - m.x, pz - m.z), alive = inF && !dead && G.mode === 'walk';
  if (!m.agg && d.agg && alive && dp < (d.boss ? 9 : 5.5) && (m.k !== 'chochin' || A.isNight() || dp < 3.5)) { m.agg = true; m.hb.visible = true; A.G.me && m === bossM && A.toast('大天狗：「人類，竟敢踏入吾之山！」', 2500); }
  if (m.agg && (!alive || Math.hypot(m.x - m.hx, m.z - m.hz) > (d.boss ? 13 : m.rg + 10))) { m.agg = false; m.st = 'home'; m.wind = 0; }
  let mv = 0, sp = d.spd;
  if (m.st === 'home') { m.tx = m.hx; m.tz = m.hz; mv = 1; sp *= 1.4; m.hp = Math.min(d.hp, m.hp + d.hp * dt * .5); if (Math.hypot(m.x - m.hx, m.z - m.hz) < 1) { m.st = 'idle'; m.hp = d.hp; m.hb.visible = false; } }
  else if (m.agg) {
    const reach = 1.1 + d.r * m.sc * .6;
    if (m.wind > 0) { m.wind -= dt; if (m.wind <= 0) { // 出手
        if (dp < reach + .7 && alive) hurtMe(d.atk); m.ac = d.boss ? 1.3 : 1.4; } }
    else if (dp > reach) { m.tx = px; m.tz = pz; mv = 1; }
    else { m.ac = (m.ac || 0) - dt; if (m.ac <= 0) { m.wind = d.boss ? .5 : .45; } }
    if (m.ac > 0 && dp <= reach) m.ac -= dt;
    // 大天狗：跺地（紅圈預警，閃得掉）
    if (d.boss && alive) { m.sk = (m.sk || 4) - dt; if (m.sk <= 0) { m.sk = rnd(5, 7.5); stomps.push({ x: px, z: pz, t: 0, T: 1.3, r: 3.4, dmg: Math.round(d.atk * 1.8) }); A.G.me && A.G.me.say && 0; } }
  } else { // 閒晃
    m.wt -= dt; if (m.wt <= 0) { if (Math.random() < .55) { const a = Math.random() * TAU, r = Math.random() * m.rg; m.tx = m.hx + Math.cos(a) * r; m.tz = m.hz + Math.sin(a) * r; } else { m.tx = m.x; m.tz = m.z; } m.wt = rnd(2.5, 5); }
    if (Math.hypot(m.tx - m.x, m.tz - m.z) > .4) { mv = 1; sp *= .45; }
  }
  if (mv) { const dx = m.tx - m.x, dz = m.tz - m.z, dl = Math.hypot(dx, dz) || 1; const nx = m.x + dx / dl * sp * dt, nz = m.z + dz / dl * sp * dt;
    if (walkForest(nx, nz)) { m.x = nx; m.z = nz; } else { m.tx = m.x; m.tz = m.z; } m.ry = angLerp(m.ry, Math.atan2(dx, dz), Math.min(1, dt * 8)); }
  else if (m.agg) m.ry = angLerp(m.ry, Math.atan2(px - m.x, pz - m.z), Math.min(1, dt * 8));
  // 動畫（全部連續函數）
  m.ph += dt * (mv ? 7 : 2.4); const B = m.body, wd = m.wind > 0 ? 1 - m.wind / .45 : 0; let y = 0, sx = 1, sy = 1, lean = 0;
  if (m.k === 'onibi') { y = .25 + Math.sin(m.ph * .8) * .12; const fl = B.userData.flame; fl.scale.set(1 + Math.sin(time * 13 + m.ph) * .08, 1 + Math.sin(time * 9 + m.ph) * .15, 1); }
  else if (m.k === 'kasa') { const h = Math.abs(Math.sin(m.ph * .7)); y = mv ? h * .45 : h * .06; sy = mv ? (h < .15 ? .82 : 1.05) : 1; sx = 2 - sy; }
  else if (m.k === 'chochin') { y = .35 + Math.sin(m.ph * .6) * .15; lean = Math.sin(m.ph * .5) * .12; const lm = B.userData.lamp; lm.emissiveIntensity = .6 + Math.sin(time * 6 + m.ph) * .15 + (A.isNight() ? .5 : 0); }
  else if (m.k === 'tanuki' || m.k === 'kappa') { y = mv ? Math.abs(Math.sin(m.ph * .5)) * .1 : 0; lean = mv ? Math.sin(m.ph * .5) * .1 : Math.sin(m.ph * .4) * .03; sy = 1 + Math.sin(m.ph * .8) * .03; sx = 2 - sy; }
  else if (m.k === 'tengu') { y = .4 + Math.sin(m.ph * .4) * .15; for (const s of [-1, 1]) B.userData['w' + s].rotation.y = s * (Math.sin(time * (mv ? 9 : 4)) * .4 - .2); }
  if (wd > 0) { sy *= 1 - wd * .2; sx *= 1 + wd * .15; B.rotation.x = -wd * .35; } else B.rotation.x += (0 - B.rotation.x) * Math.min(1, dt * 12);
  if (m.wind <= 0 && m.ac > 1.15) { const k = (m.ac - 1.15) / .25; B.rotation.x = k * .5; } // 出手瞬間往前撲
  B.position.y = y; B.scale.set(sx, sy, sx); B.rotation.z = lean;
  m.g.position.set(m.x, 0, m.z); m.g.rotation.y = m.ry;
  if (m.hb.visible) { m.hbF.scale.x = .96 * Math.max(0, m.hp / d.hp); m.hb.rotation.y = -m.ry; }
}
const _white = new THREE.Color('#ffffff');
function angLerp(a, b, t) { let d = ((b - a + PI) % TAU + TAU) % TAU - PI; return a + d * t; }

// ---------- 玩家受傷／死亡 ----------
function hurtMe(atk) {
  if (dead) return; const s = stats(); const dmg = Math.max(1, Math.round(atk * rnd(.85, 1.1) - s.def * .6));
  S.hp = Math.max(0, S.hp - dmg); combatT = 0; num(A.G.pos.x, 2.1, A.G.pos.z, dmg, 'hurt'); SFX.hurt(); flashRed(); shake = Math.max(shake, .15);
  if (S.hp <= 0) { dead = 1; tgt = null; A.G.me && A.G.me.say('嗚…眼前一黑…', 2); A.toast('😵 被妖怪打倒了……巫女把你帶回營地休息', 3500); setTimeout(() => { A.warp(CAMP.x, CAMP.z + 1); S.hp = stats().hp; S.spv = stats().sp; dead = 0; save(); }, 1600); }
  hud();
}
function flashRed() { const v = document.getElementById('advRed'); if (!v) return; v.style.transition = 'none'; v.style.opacity = '.55'; requestAnimationFrame(() => { v.style.transition = 'opacity .5s'; v.style.opacity = '0'; }); }

// ---------- 特效：火花、刀光、數字、掉落、跺地 ----------
function initFx(scene) {
  const n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sparks = new THREE.Points(g, new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sparks.frustumCulled = false; sparks.userData.p = []; scene.add(sparks);
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -99;
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(.75, 1.25, 28, 1, 0, 2.3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); slashes.push({ m, t: 9 }); }
  tgtRing = new THREE.Mesh(new THREE.RingGeometry(.62, .78, 32), new THREE.MeshBasicMaterial({ color: '#ff5040', transparent: true, opacity: .8, depthWrite: false })); tgtRing.rotation.x = -PI / 2; tgtRing.visible = false; scene.add(tgtRing);
  fx = scene;
}
const _c = new THREE.Color();
function burst(x, y, z, c, n, sp, life = .6) { const P = sparks.userData.p; _c.set(c); for (let i = 0; i < n; i++) { if (P.length > 250) P.shift(); const a = Math.random() * TAU, u = Math.random() * 2 - 1, s = sp * (.4 + Math.random() * .6); P.push({ x, y, z, vx: Math.cos(a) * s * Math.sqrt(1 - u * u), vy: Math.abs(u) * s + 1, vz: Math.sin(a) * s * Math.sqrt(1 - u * u), t: 0, T: life * (.6 + Math.random() * .6), r: _c.r, g: _c.g, b: _c.b }); } }
function updSparks(dt) { const P = sparks.userData.p, pa = sparks.geometry.attributes.position, ca = sparks.geometry.attributes.color; let j = 0;
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += dt; if (p.t > p.T) { P.splice(i, 1); continue; } p.vy -= 5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const f = 1 - p.t / p.T; pa.setXYZ(j, p.x, Math.max(.05, p.y), p.z); ca.setXYZ(j, p.r * f, p.g * f, p.b * f); j++; }
  for (let i = j; i < pa.count; i++) pa.setXYZ(i, 0, -99, 0); pa.needsUpdate = ca.needsUpdate = true; }
function slash(x, z, ry, col, big) { const s = slashes.find(s => s.t > s.T) || slashes[0]; s.t = 0; s.T = big ? .32 : .22; s.x = x; s.z = z; s.ry = ry; s.big = big; s.m.material.color.set(col); s.m.visible = true; s.flip = (s.flip ? 0 : 1); }
function updSlashes(dt) { for (const s of slashes) { if (s.t > s.T) { s.m.visible = false; continue; } s.t += dt; const k = Math.min(1, s.t / s.T), e = ease(k), m = s.m;
  m.position.set(s.x + Math.sin(s.ry) * .55, 1.0, s.z + Math.cos(s.ry) * .55); m.rotation.set(-PI / 2 + (s.flip ? .5 : -.5), 0, 0); m.rotation.order = 'YXZ'; m.rotation.y = s.ry; m.rotateZ(-PI / 2 - 1.15 + (s.flip ? -1 : 1) * (e - .5) * 2.2);
  const sc = (s.big ? 1.7 : 1) * (.85 + e * .3); m.scale.set(sc, sc, sc); m.material.opacity = (1 - k) * (k < .15 ? k / .15 : 1) * .95; } }
// 傷害數字（DOM，每格投影到螢幕，用 transform 移動不觸發排版）
const nums = []; const _v = new THREE.Vector3();
function num(x, y, z, t, cls) { if (!lay) return; let o = nums.find(n => n.t > n.T); if (!o) { if (nums.length > 24) o = nums[0]; else { o = { el: document.createElement('div') }; lay.appendChild(o.el); nums.push(o); } }
  o.el.className = 'dmg ' + (cls || ''); o.el.textContent = t; o.x = x + rnd(-.25, .25); o.y = y; o.z = z; o.t = 0; o.T = cls === 'crit' ? 1.1 : .9; o.el.style.display = ''; }
function updNums(dt, camera) { for (const o of nums) { if (o.t > o.T) { if (o.el.style.display !== 'none') o.el.style.display = 'none'; continue; } o.t += dt; const k = o.t / o.T;
  _v.set(o.x, o.y + ease(Math.min(1, k * 1.4)) * .7, o.z).project(camera); if (_v.z > 1) { o.el.style.display = 'none'; continue; } o.el.style.display = '';
  const sx = (_v.x * .5 + .5) * innerWidth, sy = (-_v.y * .5 + .5) * innerHeight, sc = k < .12 ? 1.6 - k / .12 * .6 : 1;
  o.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%) scale(${sc})`; o.el.style.opacity = k > .7 ? (1 - k) / .3 : 1; } }
function dropItem(x, z, kind, k, emo) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: etex(emo), transparent: true, depthWrite: false })); sp.scale.setScalar(kind === 'card' ? .7 : .5); root.add(sp);
  if (kind === 'card') { sp.material.color.set('#ffe9a0'); burst(x, 1, z, '#ffd040', 24, 3, 1); SFX.card(); }
  const a = Math.random() * TAU, r = rnd(.6, 1.4); drops.push({ sp, kind, k, x, z, tx: x + Math.cos(a) * r, tz: z + Math.sin(a) * r, t: 0 });
}
function updDrops(dt, time) { const G = A.G; for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; let x, y, z;
  if (d.t < .55) { const k = d.t / .55; x = d.x + (d.tx - d.x) * k; z = d.z + (d.tz - d.z) * k; y = .3 + Math.sin(k * PI) * 1.2; } // 彈出拋物線
  else if (d.t < 1.1 || dead) { x = d.tx; z = d.tz; y = .3 + Math.abs(Math.sin((d.t - .55) * 7)) * .12 * Math.max(0, 1 - (d.t - .55) * 2); }
  else { // 吸到玩家身上
    const px = G.pos.x, pz = G.pos.z, dx = px - d.tx, dz = pz - d.tz, dl = Math.hypot(dx, dz); const s = Math.min(dl, dt * (4 + (d.t - 1.1) * 14)); d.tx += dx / (dl || 1) * s; d.tz += dz / (dl || 1) * s; x = d.tx; z = d.tz; y = .3 + Math.min(1, (d.t - 1.1) * 3) * .7;
    if (dl < .35 || dl > 40) { pick(d); root.remove(d.sp); d.sp.material.dispose(); drops.splice(i, 1); continue; } }
  d.sp.position.set(x, y + (d.kind === 'card' ? Math.sin(time * 4) * .05 : 0), z); if (d.kind === 'card') d.sp.material.rotation = Math.sin(time * 3) * .2; } }
function pick(d) { SFX.pick();
  if (d.kind === 'mat') { A.P.bagAdd('yokai', d.k, 1); A.log && A.log(`獲得 ${MAT[d.k][0]} ${MAT[d.k][1]}`); }
  else if (d.kind === 'pot') { S.pot = (S.pot || 0) + 1; save(); A.log && A.log('獲得 🍡 藥草團子'); hud(); }
  else if (d.kind === 'card') { S.cards[d.k] = (S.cards[d.k] || 0) + 1; save(); A.P.ev('card', { dex: 'card', k: d.k }); A.toast(`🃏✨ 獲得稀有的「${CARD[d.k][0]}」（${CARD[d.k][2] ? CARD[d.k][1] : ''}）！到營地巫女那裡插到武器上`, 6000); A.G.me && A.G.me.emoji('✨'); } }
function updStomps(dt) { for (let i = stomps.length - 1; i >= 0; i--) { const s = stomps[i];
  if (!s.m) { s.m = new THREE.Mesh(new THREE.CircleGeometry(s.r, 36), new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: .25, depthWrite: false })); s.m.rotation.x = -PI / 2; s.m.position.set(s.x, .06, s.z);
    s.ring = new THREE.Mesh(new THREE.RingGeometry(s.r - .12, s.r, 36), new THREE.MeshBasicMaterial({ color: '#ff5030', transparent: true, opacity: .9, depthWrite: false })); s.ring.rotation.x = -PI / 2; s.ring.position.set(s.x, .07, s.z); root.add(s.m, s.ring); }
  s.t += dt; const k = Math.min(1, s.t / s.T); s.m.scale.setScalar(Math.max(.01, k)); s.m.material.opacity = .15 + k * .25;
  if (k >= 1 && !s.hit) { s.hit = 1; SFX.stomp(); shake = .45; burst(s.x, .2, s.z, '#c8a070', 30, 4, .8); if (Math.hypot(A.G.pos.x - s.x, A.G.pos.z - s.z) < s.r && inF) hurtMe(s.dmg); }
  if (s.t > s.T + .3) { root.remove(s.m, s.ring); s.m.geometry.dispose(); s.ring.geometry.dispose(); stomps.splice(i, 1); } } }

// ---------- 玩家攻擊 ----------
function canFight() { return inF && !dead && A.G.mode === 'walk' && !A.G.busy; }
function nearest(r = 9) { let b = null, bd = r; for (const m of mobs) { if (m.st === 'dead' || m.st === 'spawn') continue; const d = Math.hypot(m.x - A.G.pos.x, m.z - A.G.pos.z); if (d < bd) { bd = d; b = m; } } return b; }
export function attackNearest() { if (!canFight()) return false; const m = nearest(); if (!m) { A.toast('附近沒有妖怪', 1500); return false; } tgt = m; return true; }
function hitRoll(m, mul, s) { const crit = Math.random() < s.crit; const dmg = Math.max(1, Math.round(crit ? s.atk * mul * 1.6 : s.atk * mul * rnd(.9, 1.1) - m.d.def)); return [dmg, crit]; }
function swing(m, mul = 1, big = false) { const G = A.G, s = stats(), w = s.w; const ry = Math.atan2(m.x - G.pos.x, m.z - G.pos.z); G.ry = ry; lunge = 0; combatT = 0;
  slash(G.pos.x, G.pos.z, ry, (s.r >= 7 ? '#ffe070' : w[6]), big); SFX.swing(); setTimeout(() => { if (m.st === 'dead') return; const [d, c] = hitRoll(m, mul, s); hurtMob(m, d, c, big ? .9 : .5); }, 70); }
export function skill(i) {
  if (!canFight()) return; const s = stats(); if (skCd[i] > 0) return; const cost = [6, 14][i]; if (S.spv < cost) return A.toast('SP 不夠（SP 會慢慢恢復）', 1500);
  if (i === 0) { const m = tgt && tgt.st !== 'dead' ? tgt : nearest(s.w[5] + 1.5); if (!m || Math.hypot(m.x - A.G.pos.x, m.z - A.G.pos.z) > s.w[5] + 1.6) return A.toast('斬擊：要先靠近妖怪', 1500); tgt = m; S.spv -= cost; skCd[0] = 2.5; swing(m, 2.2, true); A.G.me && A.G.me.say('斬！', .8); }
  else { S.spv -= cost; skCd[1] = 7; const G = A.G; lunge = 0; for (let k = 0; k < 3; k++) setTimeout(() => { slash(G.pos.x, G.pos.z, G.ry + k * 2.1, (s.r >= 7 ? '#ffe070' : s.w[6]), true); SFX.swing(); }, k * 70); burst(G.pos.x, .3, G.pos.z, '#cfe8ff', 26, 4, .5); A.G.me && A.G.me.say('旋風斬！', .9);
    setTimeout(() => { for (const m of mobs) if (m.st !== 'dead' && m.st !== 'spawn' && Math.hypot(m.x - G.pos.x, m.z - G.pos.z) < 3.4 + m.d.r) { const [d, c] = hitRoll(m, 1.5, s); hurtMob(m, d, c, 1); } }, 120); }
  hud();
}
export function usePot() { if (!inF) return; if (!S.pot) return A.toast('沒有藥草團子了（營地武器屋有賣）', 1800); const s = stats(); if (S.hp >= s.hp) return A.toast('HP 是滿的', 1200); S.pot--; const h = Math.round(s.hp * .5); S.hp = Math.min(s.hp, S.hp + h); num(A.G.pos.x, 2.1, A.G.pos.z, '+' + h, 'heal'); burst(A.G.pos.x, 1, A.G.pos.z, '#80ff90', 14, 2); tone(660, 990, .25, .08); save(); hud(); }
// 每格：回傳要走的方向（點怪自動走過去）
export function steer(yaw) {
  if (!tgt || !canFight()) return null; if (tgt.st === 'dead') { tgt = null; return null; }
  const G = A.G, dx = tgt.x - G.pos.x, dz = tgt.z - G.pos.z, d = Math.hypot(dx, dz), rg = stats().w[5] + tgt.d.r * tgt.sc * .7;
  if (d > 25) { tgt = null; return null; } if (d <= rg) return null;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw); return [(dz * fx - dx * fz) / d, (dx * fx + dz * fz) / d];
}
export function cancel() { if (tgt) tgt = null; }
// 點擊選怪
export function pick3d(ray) { if (!inF) return false; let b = null, bd = 60; for (const m of mobs) { if (m.st === 'dead' || !m.g.visible) continue; const h = ray.intersectObject(m.body, true)[0]; if (h && h.distance < bd) { bd = h.distance; b = m; } }
  if (!b) { // 點不準也算：螢幕上離點擊最近的妖怪
    for (const m of mobs) { if (m.st === 'dead') continue; _v.set(m.x, .8 * m.sc, m.z); const d = ray.ray.distanceToPoint(_v); if (d < .9 * m.sc && ray.ray.origin.distanceTo(_v) < bd) { bd = ray.ray.origin.distanceTo(_v); b = m; } } }
  if (!b) return false; if (!canFight()) return true; tgt = b; return true; }

// ---------- HUD ----------
function hud() { if (!hudEl) return; const s = stats(); S.hp = Math.min(S.hp, s.hp); S.spv = Math.min(S.spv, s.sp);
  barEl.innerHTML = `<div class="ab"><i class="hp" style="width:${S.hp / s.hp * 100}%"></i><span>HP ${Math.ceil(S.hp)} / ${s.hp}</span></div><div class="ab sp"><i class="sp" style="width:${S.spv / s.sp * 100}%"></i><span>SP ${Math.floor(S.spv)} / ${s.sp}</span></div><small>${s.wn}　攻 ${s.atk}　防 ${s.def}</small>`;
  const pb = document.getElementById('advPot'); if (pb) pb.dataset.n = S.pot || 0;
  for (let i = 0; i < 2; i++) { const b = document.getElementById('advS' + i); if (b) { b.style.setProperty('--cd', skCd[i] > 0 ? skCd[i] / [2.5, 7][i] : 0); b.classList.toggle('cd', skCd[i] > 0); } } }
let hudT = 0, lastTgt = null;
function updTgt() { if (!tgtEl) return; if (tgt !== lastTgt || tgt) { lastTgt = tgt; if (!tgt) { tgtEl.classList.add('hide'); return; } tgtEl.classList.remove('hide');
  const d = tgt.d; tgtEl.innerHTML = `<b>${d.boss ? '👺 ' : ''}Lv.${d.lv} ${d.n}</b><div class="ab"><i class="hp" style="width:${Math.max(0, tgt.hp / d.hp * 100)}%"></i></div>`; } }

// ---------- 面板 ----------
function panel(html) { const p = document.getElementById('panel'); p.innerHTML = html + '<button class="close" id="advX">✕</button>'; A.show('#panel'); document.getElementById('advX').onclick = A.closePanels; return p; }
export function openShop() {
  const s = stats(), yb = A.P.bag('yokai'), ks = Object.keys(yb).filter(k => yb[k] > 0 && MAT[k]), tot = ks.reduce((a, k) => a + MAT[k][2] * yb[k], 0);
  const pp = panel(`<h2>武器屋 鐵五郎<small>妖怪の森 營地</small></h2><p class="sub">「刀不夠利，可是會被唐傘舔一臉口水的喔！」　目前：<b>${s.wn}</b>（攻 ${s.atk}）</p>
    <div class="mlist"><div class="mrow"><span>🔨 精煉 ${s.wn}${s.r < 10 ? ` → +${s.r + 1}` : ''} <small>每級攻擊 +3（+7 起 +8）・${s.r < 10 ? (RF_OK[s.r] < 1 ? `<b style="color:#e04030">成功率 ${RF_OK[s.r] * 100}%，失敗會變回 +0</b>` : '+4 以前一定成功') : '已達上限'}</small></span><span></span><span>${s.r < 10 ? rfCost(s.r) + ' 文' : '—'}</span><button id="advRf" ${s.r >= 10 ? 'disabled' : ''}>精煉</button></div></div>
    <div class="mlist">${Object.entries(WEAP).map(([k, w]) => `<div class="mrow"><span>🗡️ ${w[0]} <small>攻擊 ${w[1]}・${w[2] ? `插槽 ${w[2]}` : '無插槽'}・${w[4] < .8 ? '出手快' : w[4] > 1 ? '出手慢' : '普通'}${w[5] > 2 ? '・射程長' : ''}</small></span><span></span><span>${w[3] ? w[3] + ' 文' : '—'}</span><button data-w="${k}" ${S.w === k ? 'disabled' : ''}>${S.w === k ? '裝備中' : S.own.includes(k) ? '裝備' : '買'}</button></div>`).join('')}
    <div class="mrow"><span>🍡 藥草團子 <small>回復 50% HP（H 鍵）・持有 ${S.pot || 0}</small></span><span></span><span>15 文</span><button id="advBP">買 1</button></div>
    <div class="mrow"><span>🍡×5 藥草團子 <small>五串一起買比較便宜</small></span><span></span><span>65 文</span><button id="advBP5">買 5</button></div></div>
    <h4>🧺 收購妖怪素材</h4>${ks.length ? `<div class="mlist">${ks.map(k => `<div class="mrow"><span>${MAT[k][0]} ${MAT[k][1]}</span><span>×${yb[k]}</span><span>${MAT[k][2]} 文</span><span></span></div>`).join('')}</div><div class="btns"><button id="advSell" class="big">💰 全部賣掉（${tot} 文）</button></div>` : '<p class="sub">打倒妖怪會掉素材，拿來這裡換錢。</p>'}`);
  pp.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const k = b.dataset.w, w = WEAP[k];
    if (!S.own.includes(k)) { if (!A.afford(w[3])) return A.toast('錢不夠喔'); A.addMoney(-w[3], w[0]); S.own.push(k); A.toast(`買了「${w[0]}」！`, 2000); }
    S.w = k; S.eq = S.eq.slice(0, w[2]); save(); hud(); openShop(); });
  const bp = (n, c) => { if (!A.afford(c)) return A.toast('錢不夠喔'); A.addMoney(-c, '藥草團子'); S.pot = (S.pot || 0) + n; save(); hud(); openShop(); };
  pp.querySelector('#advRf').onclick = () => { refine(); openShop(); };
  pp.querySelector('#advBP').onclick = () => bp(1, 15); pp.querySelector('#advBP5').onclick = () => bp(5, 65);
  const sl = pp.querySelector('#advSell'); if (sl) sl.onclick = () => { let n = 0; for (const k of ks) { n += yb[k]; A.P.bagAdd('yokai', k, -yb[k]); } A.addMoney(tot, `賣妖怪素材 ${n} 個`); openShop(); };
}
export function openCards() {
  const s = stats(), slots = s.w[2], have = Object.keys(CARD).filter(k => S.cards[k] > 0);
  const pp = panel(`<h2>巫女 お鈴<small>妖怪札・冒險紀錄</small></h2><p class="sub">「打倒妖怪偶爾會掉出封印了妖力的札，插在有插槽的武器上就能借用那份力量。」</p>
    <p>🗡️ ${s.w[0]}：插槽 ${slots ? Array.from({ length: slots }, (_, i) => S.eq[i] ? `<b>[${CARD[S.eq[i]][0]}]</b>` : '[　空　]').join(' ') : '沒有插槽（打刀以上才有）'}</p>
    <div class="mlist">${Object.entries(CARD).map(([k, c]) => `<div class="mrow"><span>${S.cards[k] ? '🃏' : '❔'} ${S.cards[k] ? c[0] : '？？？'} <small>${S.cards[k] ? c[1] : MOB[k].n + ' 偶爾會掉'}</small></span><span>${S.cards[k] ? '×' + S.cards[k] : ''}</span><span></span>${S.cards[k] ? `<button data-c="${k}" ${!slots ? 'disabled' : ''}>${S.eq.includes(k) ? '拔下' : '插上'}</button>` : '<span></span>'}</div>`).join('')}</div>
    <h4>📜 討伐紀錄</h4><p class="sub">${Object.entries(MOB).map(([k, d]) => `${d.n} ${S.kills[k] || 0}`).join('・')}　｜　大天狗 MVP ${S.boss || 0} 次</p>
    <div class="btns"><button id="advHeal">⛩️ 請巫女祈禱（HP・SP 全滿，免費）</button></div>`);
  pp.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const k = b.dataset.c; const i = S.eq.indexOf(k);
    if (i >= 0) S.eq.splice(i, 1); else { if (S.eq.length >= slots) return A.toast('插槽滿了，先拔下一張'); S.eq.push(k); } save(); hud(); openCards(); });
  pp.querySelector('#advHeal').onclick = () => { S.hp = s.hp; S.spv = s.sp; save(); hud(); burst(A.G.pos.x, 1, A.G.pos.z, '#ffffff', 20, 2); tone(880, 1320, .4, .08); A.toast('身體輕盈起來了！', 1500); };
}

// ---------- 進出森林 ----------
function enter(on) { inF = on; document.body.classList.toggle('forest', on); hudEl.classList.toggle('hide', !on); if (!on) { tgt = null; updTgt(); if (A.G.me && A.G.me.mesh) A.G.me.mesh.position.z = 0; }
  if (on) { const s = stats(); if (S.hp <= 0) S.hp = s.hp; hud(); if (!S.seen) { S.seen = 1; save(); A.toast('🌲 歡迎來到妖怪の森！點妖怪就會自動攻擊（電腦也可按 F），Q 斬擊、R 旋風斬、H 吃團子。越往北越強，最深處有大天狗。', 9000); } } }
export function spot(s) {
  if (s.k === 'weap') return openShop(); if (s.k === 'card') return openCards();
  if (s.k === 'in') return warpTo(CAMP.x, CAMP.z + 2.5, '妖怪の森'); if (s.k === 'out') return warpTo(P_IN.x + 1.8, P_IN.z + 1.5, '神社');
}
function warpTo(x, z, n) { if (warpCd > 0) return; warpCd = 2; SFX.warp(); const f = document.getElementById('advWarp'); if (f) { f.style.transition = 'opacity .18s'; f.style.opacity = '1'; }
  setTimeout(() => { A.warp(x, z); if (f) { f.style.transition = 'opacity .5s'; f.style.opacity = '0'; } A.toast(`🌀 傳送到「${n}」`, 1500); }, 200); }

// ---------- 初始化／每格更新 ----------
export function initAdv(api) {
  A = api; S = Object.assign({ w: 'boku', own: ['boku'], cards: {}, eq: [], kills: {}, hp: 999, spv: 999, pot: 3 }, A.store.get('adv', {}));
  A.P.addDexCat('yokai', '👺 妖怪', Object.entries(MOB).map(([k, d]) => ({ k, n: d.n })));
  A.P.addDexCat('card', '🃏 妖怪札', Object.entries(CARD).map(([k, c]) => ({ k, n: c[0] })));
  A.P.addQuest({ id: 'hunt', ev: 'kill', n: [5, 8], t: n => `到妖怪の森討伐 ${n} 隻妖怪（神社左後方的藍色傳送陣）`, rew: [80, 40] });
  A.P.EVL.push(t => { if (t === 'eat' && S) { const s = stats(); S.hp = Math.min(s.hp, S.hp + s.hp * .3); S.spv = Math.min(s.sp, S.spv + 15); hud(); } });
  buildForest(A.scene); initFx(A.scene); portalIn = makePortal(A.scene, P_IN); portalOut = makePortal(A.scene, P_OUT);
  for (const [k, x, z, n, r] of SPAWN) for (let i = 0; i < n; i++) { let px, pz, t = 0; do { const a = Math.random() * TAU, rr = Math.random() * r; px = x + Math.cos(a) * rr; pz = z + Math.sin(a) * rr; } while (!walkForest(px, pz) && ++t < 20); spawnMob(k, px, pz, r); }
  lay = document.createElement('div'); lay.id = 'advLay'; document.body.appendChild(lay);
  const red = document.createElement('div'); red.id = 'advRed'; document.body.appendChild(red); const wp = document.createElement('div'); wp.id = 'advWarp'; document.body.appendChild(wp);
  hudEl = document.getElementById('adv'); barEl = document.getElementById('advBar'); tgtEl = document.getElementById('advTgt');
  document.getElementById('advA').onclick = () => attackNearest(); document.getElementById('advS0').onclick = () => skill(0); document.getElementById('advS1').onclick = () => skill(1); document.getElementById('advPot').onclick = () => usePot();
  addEventListener('keydown', e => { if (!inF || A.typing()) return; if (e.code === 'KeyF') attackNearest(); else if (e.code === 'KeyQ') skill(0); else if (e.code === 'KeyR') skill(1); else if (e.code === 'KeyH') usePot(); });
}
export function inForest() { return inF; }
export function updAdv(dt, time, camera) {
  if (!A) return; const G = A.G; updPortal(portalIn, dt, time); if (inF) updPortal(portalOut, dt, time);
  warpCd -= dt;
  // 踩進傳送陣自動傳送（RO 風格）
  if (G.mode === 'walk' && warpCd <= 0) { if (Math.hypot(G.pos.x - P_IN.x, G.pos.z - P_IN.z) < .7) spot({ k: 'in' }); else if (inF && Math.hypot(G.pos.x - P_OUT.x, G.pos.z - P_OUT.z) < .7) spot({ k: 'out' }); }
  const now = walkForest(G.pos.x, G.pos.z) || (inF && G.mode !== 'walk' && G.mode !== 'title'); if (now !== inF && G.mode !== 'title') enter(now);
  // 頭目週期：每 10 分鐘（全員同一時間）
  const cyc = ((Date.now() / 1000) + (window.__bossOff || 0)) % BOSS_CYCLE, day = Math.floor(((Date.now() / 1000) + (window.__bossOff || 0)) / BOSS_CYCLE);
  if (cyc < BOSS_WIN && bossDay !== day) { bossDay = day; if (!bossM) { bossM = spawnMob('tengu', ARENA.x, ARENA.z, 6); bossM.st = 'spawn'; bossM.body.scale.setScalar(.01); burst(ARENA.x, 1, ARENA.z, '#ff6040', 40, 5, 1.2); }
    if (G.mode !== 'title' && lv() >= 5) A.toast(inF ? '👺 森林深處傳來振翅聲……大天狗降臨了！（西北角的石圈）' : '👺 妖怪の森出現了大天狗！打倒它可得 MVP 大獎（神社左後方的傳送陣）', 6000); }
  if (cyc >= BOSS_WIN && bossM && !bossM.agg) { root.remove(bossM.g); mobs.splice(mobs.indexOf(bossM), 1); bossM = null; }
  root.visible = inF || (G.pos.x < -88 && G.pos.z < -28); // 從千本鳥居就看得到森林邊
  if (hemi) hemi.intensity += ((inF ? (A.isNight() ? 1.1 : .35) : 0) - hemi.intensity) * Math.min(1, dt * 2);
  if (!inF) return;
  // 玩家：自動攻擊目標
  const s = stats(); atkCd -= dt; skCd[0] = Math.max(0, skCd[0] - dt); skCd[1] = Math.max(0, skCd[1] - dt); combatT += dt;
  if (tgt && tgt.st === 'dead') tgt = null;
  if (tgt && canFight()) { const d = Math.hypot(tgt.x - G.pos.x, tgt.z - G.pos.z), rg = s.w[5] + tgt.d.r * tgt.sc * .7; if (d <= rg + .05) { G.ry = angLerp(G.ry, Math.atan2(tgt.x - G.pos.x, tgt.z - G.pos.z), Math.min(1, dt * 14)); if (atkCd <= 0) { atkCd = s.w[4]; swing(tgt); } } }
  // 衝刺動作：往前 0.35 → 回原位（ease）
  lunge += dt; if (G.me && G.me.mesh) { const k = lunge < .07 ? ease(lunge / .07) : lunge < .3 ? 1 - ease((lunge - .07) / .23) : 0; G.me.mesh.position.z = k * .35; }
  // 回復：營地快、離開戰鬥 4 秒後慢慢回
  const camp = Math.hypot(G.pos.x - CAMP.x, G.pos.z - CAMP.z) < 9, rg = camp ? 12 : combatT > 4 ? 1.5 + s.hp * .01 : 0;
  if (!dead) { S.hp = Math.min(s.hp, S.hp + rg * dt); S.spv = Math.min(s.sp, S.spv + (camp ? 8 : combatT > 4 ? 1.2 : .5) * dt); }
  for (let i = mobs.length - 1; i >= 0; i--) { const m = mobs[i]; updMob(m, dt, time); if (m.resp === -1 && m.st === 'dead' && m.deadT > .7) { root.remove(m.g); mobs.splice(i, 1); } }
  updSparks(dt); updSlashes(dt); updDrops(dt, time); updStomps(dt); updNums(dt, camera);
  if (tgt) { tgtRing.visible = true; tgtRing.position.set(tgt.x, .05, tgt.z); tgtRing.scale.setScalar(tgt.sc * (1 + Math.sin(time * 6) * .06)); tgtRing.rotation.z += dt; } else tgtRing.visible = false;
  // 營火、螢火蟲
  const fl = root.userData.fire.userData.fl; fl.scale.set(1 + Math.sin(time * 11) * .1, 1 + Math.sin(time * 7.3) * .2, 1);
  if (ffly) { const P = ffly.geometry.attributes.position, b = ffly.userData.base; for (let i = 0; i < P.count; i++) P.setXYZ(i, b[i * 3] + Math.sin(time * .5 + i) * 1.2, b[i * 3 + 1] + Math.sin(time * .9 + i * 1.7) * .4, b[i * 3 + 2] + Math.cos(time * .4 + i * .7) * 1.2); P.needsUpdate = true; ffly.material.opacity = A.isNight() ? .95 : .35; }
  // 鏡頭震動（衰減）
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); const a = shake * shake * .5; camera.position.x += Math.sin(time * 71) * a; camera.position.y += Math.sin(time * 53) * a; }
  if ((hudT -= dt) < 0) { hudT = .1; hud(); updTgt(); }
}
export const __adv = { get mobs() { return mobs; }, get tgt() { return tgt; }, get S() { return S; }, get inF() { return inF; }, stats, refine, CAMP, P_IN, spawnMob, killMob, hurtMob, WEAP, CARD }; // 測試用
