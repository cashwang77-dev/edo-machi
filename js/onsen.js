// 溫泉鄉（東岸再往東）：三座露天溫泉、湯けむり荘（住宿・溫泉卓球・饅頭・收購山貨）、山貨採集
// 夜市（隅田川河岸，只在晚上出現）：夜鳴きそば、甘酒、烤地瓜、夜店抽籤
import * as THREE from 'three';
const PI = Math.PI;
export const ONSEN = { x0: 184.5, x1: 262, z0: -36, z1: 36 };
export const POOLS = [{ x: 204, z: -18, n: '美肌の湯', c: '#7ab8c8' }, { x: 226, z: 16, n: '金の湯', c: '#c8a048' }, { x: 248, z: -16, n: '雪見の湯', c: '#9ac8d8' }];
const RYO = { x: 240, z: 26 };
export const GATHER = [['warabi', 'わらび', '蕨菜', 18], ['zenmai', 'ぜんまい', '薇菜', 18], ['shiitake', '椎茸', '香菇', 25], ['kuri', '栗', '栗子', 20], ['matsutake', '松茸', '松茸', 90]];
const GPTS = [[192, 30, 0], [200, 31, 1], [214, -31, 2], [232, -31, 3], [258, 4, 2], [258, -28, 4], [212, 30, 3]];
export function walkOnsen(x, z) {
  if (!(x >= ONSEN.x0 && x <= ONSEN.x1 && z >= ONSEN.z0 && z <= ONSEN.z1)) return false;
  for (const p of POOLS) if (Math.hypot(x - p.x, (z - p.z) * 1.25) < 5.2) return false; // 池子裡用「泡湯」
  if (Math.abs(x - RYO.x) < 8 && Math.abs(z - RYO.z - 2) < 5) return false; // 旅館
  return true;
}
// 夜市
export const NIGHT = [['soba', '夜鳴きそば', 16, '熱騰騰的蕎麥麵，吃完體力全滿'], ['amazake', '甘酒', 10, '暖呼呼的甜米酒'], ['imo', '焼き芋', 12, '烤得香甜的番薯'], ['kuji', '夜店くじ', 20, '抽籤！可能抽到錢或飾品']];
const YO = [{ x: 101, z: -92 }, { x: 101, z: -100 }, { x: 101, z: -112 }, { x: 101, z: -120 }];

let A, yGrp = null, steam = [], tick = 0;
const $ = s => document.querySelector(s);
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

export function buildOnsen(ctx) {
  const { M, boxG, std, B, W, col, TX, scene } = ctx;
  const spot = (x, z, label, info, say) => W.spots.push({ type: 'meisho', x, z, label, info, say });
  const gm = std('onGround', { map: TX.ground('dirt').clone(), color: '#c8bca0' }); gm.map.repeat.set(16, 16); gm.map.needsUpdate = true;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(ONSEN.x1 - ONSEN.x0, ONSEN.z1 - ONSEN.z0), gm); g.rotation.x = -PI / 2; g.position.set((ONSEN.x0 + ONSEN.x1) / 2, .014, 0); g.receiveShadow = true; scene.add(g);
  const rock = std('onRock', { color: '#7a746a', roughness: .95 }), wd = std('onWood', { color: '#6a4a30' }), roof = std('onRoof', { color: '#3a3430' });
  // 山（背景）＋紅葉
  const hill = std('onHill', { color: '#3a5a3a', roughness: 1 });
  for (let i = 0; i < 7; i++) { const h = M(new THREE.ConeGeometry(16 + (i % 3) * 5, 22 + (i % 2) * 10, 7), hill, 200 + i * 12, 10, (i % 2 ? 66 : -66)); /* 山腳不伸進可走範圍 */ B.bake(h); }
  const mo = std('onMomiji', { color: '#d8502a' }), mo2 = std('onMomiji2', { color: '#e8a030' }), bark = std('onBark', { color: '#5a3e2e' });
  for (let i = 0; i < 12; i++) { const x = 190 + i * 6.3, z = (i % 2 ? 33.5 : -33.5); const t = new THREE.Group(); t.position.set(x, 0, z); t.add(M(new THREE.CylinderGeometry(.14, .22, 2.2, 6), bark, 0, 1.1, 0)); for (let k = 0; k < 4; k++) t.add(M(new THREE.IcosahedronGeometry(.9, 0), k % 2 ? mo : mo2, Math.cos(k * 1.7) * .7, 2.4 + (k % 2) * .5, Math.sin(k * 1.7) * .7)); B.bake(t); col(x, z, .6); }
  // 入口門
  { const gt = new THREE.Group(); gt.position.set(186.5, 0, 0); for (const s of [-1, 1]) gt.add(M(boxG(.4, 4.2, .4, 1), wd, 0, 2.1, s * 3.4)); gt.add(M(boxG(.6, .5, 8, 1), roof, 0, 4.3, 0));
    gt.add(M(new THREE.BoxGeometry(.1, .9, 3), std('onGateSg', { map: TX.text('湯の郷', { bg: '#3a2a1a', fg: '#f4e8d0', w: 384, h: 128, vertical: false }) }), .35, 3.6, 0)); B.bake(gt); for (const s of [-1, 1]) col(186.5, s * 3.4, .5); }
  // 三座露天風呂
  POOLS.forEach((p, i) => {
    const w = new THREE.Mesh(new THREE.CircleGeometry(4.6, 28), std('onWater' + i, { color: p.c, metalness: .25, roughness: .08, transparent: true, opacity: .9 })); w.rotation.x = -PI / 2; w.scale.y = .8; w.position.set(p.x, .12, p.z); scene.add(w);
    for (let k = 0; k < 18; k++) { const a = k / 18 * PI * 2; B.bake(M(new THREE.DodecahedronGeometry(.75 + (k % 3) * .15, 0), rock, p.x + Math.cos(a) * 5, .35, p.z + Math.sin(a) * 4)); }
    const sg = new THREE.Group(); sg.position.set(p.x, 0, p.z + (p.z < 0 ? -5.8 : 5.8)); sg.add(M(boxG(.12, 1.4, .12, 1), wd, 0, .7, 0)); sg.add(M(new THREE.BoxGeometry(1.8, .7, .08), std('onSg' + i, { map: TX.text(p.n, { bg: '#efe2c0', fg: '#1c1410', w: 384, h: 128, vertical: false }) }), 0, 1.6, 0)); B.bake(sg);
    W.spots.push({ type: 'onsen', i, x: p.x + (p.x < 230 ? 5.6 : -5.6), z: p.z, label: `♨ 泡「${p.n}」` });
    W.onsenSteam = W.onsenSteam || []; W.onsenSteam.push({ x: p.x, z: p.z });
  });
  // 湯けむり荘
  { const r = new THREE.Group(); r.position.set(RYO.x, 0, RYO.z + 2); r.rotation.y = PI;
    r.add(M(boxG(15, 3.4, 9, 1), std('onWall', { color: '#ece0c4' }), 0, 1.7, 0)); r.add(M(boxG(13, 2.8, 7.5, 1), std('onWall', {}), 0, 4.8, 0));
    for (const [y, w, d] of [[3.5, 17, 11], [6.4, 15, 9.4]]) { const rf = M(boxG(w, .3, d, 1), roof, 0, y, 0); r.add(rf); const c = M(new THREE.ConeGeometry(Math.max(w, d) * .6, 1.4, 4), roof, 0, y + .8, 0, 0, PI / 4, 0); c.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); r.add(c); }
    r.add(M(boxG(13, 2, .06, 1), std('onShoji', { color: '#fff4d8', emissive: '#ffb860', emissiveIntensity: .5 }), 0, 1.8, 4.53));
    r.add(M(boxG(2.4, 1.4, .05, 1), std('onNoren', { color: '#8a2a2a' }), 0, 2.4, 4.6)); r.add(M(new THREE.BoxGeometry(4.4, 1, .1), std('onRyoSg', { map: TX.text('湯けむり荘', { bg: '#2a1e14', fg: '#f0d890', w: 512, h: 128, vertical: false }) }), 0, 3.15, 4.65));
    B.bake(r); W.spots.push({ type: 'ryokan', x: RYO.x, z: RYO.z - 4.2, label: '🏯 湯けむり荘（住宿・卓球・饅頭・收購山貨）' }); W.ryokanKeeper = { x: RYO.x + 2.4, z: RYO.z - 3.3, r: PI }; }
  // 採集點
  GPTS.forEach(([x, z, k], i) => { const b = new THREE.Group(); b.position.set(x, 0, z); for (let j = 0; j < 4; j++) b.add(M(new THREE.IcosahedronGeometry(.45, 0), std('onBush', { color: '#4a6a3a' }), Math.cos(j * 1.6) * .5, .35, Math.sin(j * 1.6) * .5)); B.bake(b); W.spots.push({ type: 'gather', i, k, x, z: z + (z > 0 ? -1.6 : 1.6), label: '🌿 採集山貨' }); });
  spot(220, -2, '📸 名所：湯の郷', '湯の郷：山腳下冒著熱氣的溫泉村。三座露天風呂各有不同泉質，秋天被紅葉包圍，冬天還能邊泡湯邊賞雪。', '好多熱氣～好舒服的感覺');
}
export function buildYoichi(ctx) {
  const { M, boxG, std, B, W, col, TX, scene } = ctx;
  yGrp = new THREE.Group(); const red = std('yoLan', { color: '#e83a2a', emissive: '#ff5020', emissiveIntensity: 1 }), wd = std('yoWood', { color: '#6a4a30' });
  YO.forEach((p, i) => {
    const s = new THREE.Group(); s.position.set(p.x, 0, p.z); s.rotation.y = -PI / 2;
    s.add(M(boxG(3.4, .9, 1.4, 1), wd, 0, .45, 0)); for (const x of [-1.5, 1.5]) s.add(M(boxG(.1, 2.4, .1, 1), wd, x, 1.2, -.5));
    s.add(M(boxG(4, .1, 2, 1), std('yoAwn' + i, { color: ['#2a2a4a', '#4a2a2a', '#2a4a3a', '#5a3a1a'][i] }), 0, 2.45, .1, .2, 0, 0));
    for (const x of [-1.2, 0, 1.2]) { const l = M(new THREE.SphereGeometry(.22, 10, 8), red, x, 2.05, .9); l.scale.y = 1.35; s.add(l); }
    s.add(M(new THREE.BoxGeometry(2, .55, .06), std('yoSg' + i, { map: TX.text(['そば', '甘酒', '焼芋', 'くじ'][i], { bg: '#efe2c0', fg: '#1c1410', w: 256, h: 96, vertical: false }) }), 0, 1.75, -.5));
    yGrp.add(s); W.spots.push({ type: 'yoichi', i, night: true, x: p.x + 1.8, z: p.z, label: `🏮 夜市：${NIGHT[i][1]}` });
  });
  yGrp.visible = false; scene.add(yGrp);
}

// ---------------- 互動 ----------------
function panel(html) { const p = $('#panel'); p.innerHTML = html + '<button class="close" id="onX">✕</button>'; A.show('#panel'); $('#onX').onclick = A.closePanels; return p; }
export function enterPool(i) {
  const p = POOLS[i], S = A.P.prog(); S.bath = S.bath || {};
  A.sitAt({ x: p.x, y: -.35, z: p.z, r: p.x < 230 ? PI / 2 : -PI / 2, kind: 'onsen', exit: { x: p.x + (p.x < 230 ? 6.2 : -6.2), z: p.z } }, 'bath');
  A.G.sta = 100; A.G.me.say(['ふぅ～極楽極楽', '啊～好舒服', '泡到骨頭都軟了～'][i], 3);
  const key = i + '|' + today(); if (!S.bath[key]) { S.bath[key] = 1; A.P.addXp(15, p.n); } A.P.ev('spot', { k: p.n === '美肌の湯' ? '湯の郷' : '湯の郷' }); A.P.ev('bath', { k: p.n });
}
export function openRyokan() {
  const S = A.P.prog(), gb = A.P.bag('gather'), gk = Object.keys(gb).filter(k => gb[k] > 0), tot = gk.reduce((a, k) => a + GATHER.find(g => g[0] === k)[3] * gb[k], 0);
  const pp = panel(`<h2>湯けむり荘<small>溫泉旅館</small></h2><p class="sub">女將：「歡迎光臨，遠道而來辛苦了～」</p>
    <div class="mlist">
      <div class="mrow"><span>🛏 住一晚 <small>每天一次：體力全滿＋40 經驗</small></span><span></span><span>50 文</span><button id="ryS" ${S.ryokan === today() ? 'disabled' : ''}>${S.ryokan === today() ? '已住' : '住'}</button></div>
      <div class="mrow"><span>🏓 溫泉卓球 <small>先拿 5 分獲勝</small></span><span></span><span>10 文</span><button id="ryT">玩</button></div>
      <div class="mrow"><span>🍡 溫泉饅頭 <small>吃了恢復體力</small></span><span></span><span>8 文</span><button id="ryM">買</button></div>
    </div>
    <h4>🧺 收購山貨</h4>${gk.length ? `<div class="mlist">${gk.map(k => { const g = GATHER.find(x => x[0] === k); return `<div class="mrow"><span>${g[1]} <small>${g[2]}</small></span><span>×${gb[k]}</span><span>${g[3]} 文</span><span></span></div>`; }).join('')}</div><div class="btns"><button id="ryG" class="big">💰 全部賣給板前（${tot} 文）</button></div>` : '<p class="sub">山邊的草叢可以採到山菜、香菇、栗子，運氣好還有松茸！</p>'}`);
  pp.querySelector('#ryS').onclick = () => { if (S.ryokan === today()) return; if (!A.afford(50)) return A.toast('錢不夠喔'); A.addMoney(-50, '住宿'); S.ryokan = today(); A.P.save(); A.G.sta = 100; A.P.addXp(40, '溫泉旅館一晚'); A.P.ev('ryokan'); A.G.me.emoji('😴'); A.closePanels(); A.toast('睡了一個好覺，神清氣爽！', 3000); };
  pp.querySelector('#ryT').onclick = () => { if (!A.afford(10)) return A.toast('錢不夠喔'); A.addMoney(-10, ''); A.closePanels(); playPingpong(); };
  pp.querySelector('#ryM').onclick = () => { if (!A.afford(8)) return A.toast('錢不夠喔'); A.addMoney(-8, '溫泉饅頭'); A.G.sta = 100; A.G.me.emoji('😋'); A.G.me.say('外皮好Q～', 2); A.P.ev('eat', { id: 'manju' }); };
  const gs = pp.querySelector('#ryG'); if (gs) gs.onclick = () => { let n = 0; for (const k of gk) { n += gb[k]; A.P.bagAdd('gather', k, -gb[k]); } A.addMoney(tot, `賣山貨 ${n} 個`); A.P.ev('sellveg', { n }); openRyokan(); };
}
export function doGather(sp) {
  const S = A.P.prog(); S.gat = S.gat || {}; const key = sp.i + '|' + today();
  if (S.gat[key]) return A.toast('這裡今天已經採過了，明天再來吧');
  S.gat[key] = 1; let k = GATHER[sp.k][0]; if (Math.random() < .12) k = 'matsutake';
  const n = k === 'matsutake' ? 1 : 1 + Math.floor(Math.random() * 3); A.P.bagAdd('gather', k, n); A.P.ev('gather', { k, n }); A.G.me.emoji(k === 'matsutake' ? '🤩' : '🌿');
  const g = GATHER.find(x => x[0] === k); A.toast(`採到 ${g[1]}（${g[2]}）×${n}${k === 'matsutake' ? '！稀有的松茸！' : ''}`, 2800);
}
// 溫泉卓球：拖曳／移動控制下方球拍，把球打回去；先拿 5 分
let GEN = 0;
function playPingpong() {
  const M = A.gameModal('🏓 溫泉卓球', '左右移動（滑鼠或手指）控制下面的球拍，把球打回去！先拿 5 分贏。');
  const g = M.g, my = ++GEN; let px = 180, ax = 180, b = { x: 180, y: 120, vx: 90, vy: 150 }, me = 0, ai = 0, last = performance.now(), pause = .8, done = false;
  const at = e => { const r = M.cv.getBoundingClientRect(); px = Math.max(30, Math.min(330, (e.clientX - r.left) * 360 / r.width)); };
  M.cv.onpointermove = at; M.cv.onpointerdown = e => { e.preventDefault(); at(e); };
  const serve = dir => { b = { x: 180, y: 120, vx: (Math.random() - .5) * 160, vy: dir * 150 }; pause = .8; };
  const fin = () => { done = true; setTimeout(() => { if (my !== GEN || !M.cv.isConnected) return; M.close(); const win = me > ai; if (win) A.addMoney(30, '卓球獲勝'); A.P.ev('pingpong', { win }); A.P.addXp(win ? 20 : 8); A.toast(win ? `${me}：${ai} 贏了！浴衣都濕了～` : `${me}：${ai} 輸了……再來一局？`, 3000); }, 700); };
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return; const now = performance.now(), DT = Math.min(.5, (now - last) / 1000); last = now;
    for (let st = 0, dt = DT / Math.ceil(DT * 120); st < Math.ceil(DT * 120); st++) if (!done) { if (pause > 0) pause -= dt; else { b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < 12 || b.x > 348) b.vx *= -1;
      if (b.vy < 0) ax += Math.sign(b.x - ax) * Math.min(Math.abs(b.x - ax), (95 + ai * 6) * dt); // 對手只在球飛過去時移動
      if (b.vy < 0 && b.y < 30 && Math.abs(b.x - ax) < 34) { b.vy = Math.abs(b.vy) * 1.04; b.vx += (b.x - ax) * 3; A.SND.pluck(700, .03); }
      if (b.vy > 0 && b.y > 210 && b.y < 224 && Math.abs(b.x - px) < 36) { b.vy = -Math.abs(b.vy) * 1.05; b.vx += (b.x - px) * 4; A.SND.pluck(900, .03); }
      if (b.y < -10) { me++; me >= 5 ? fin() : serve(1); } if (b.y > 250) { ai++; ai >= 5 ? fin() : serve(-1); } } }
    g.fillStyle = '#2a6a4a'; g.fillRect(0, 0, 360, 240); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(8, 8, 344, 224); g.beginPath(); g.moveTo(8, 120); g.lineTo(352, 120); g.stroke();
    g.fillStyle = '#c8322a'; g.fillRect(ax - 30, 18, 60, 8); g.fillStyle = '#2a4a8a'; g.fillRect(px - 32, 214, 64, 8);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, 6, 0, 7); g.fill();
    g.font = '700 16px sans-serif'; g.textAlign = 'left'; g.fillText(`對手 ${ai}`, 14, 112); g.fillText(`你 ${me}`, 14, 140);
    M.stat(`你 <b>${me}</b> ： ${ai} 對手（先拿 5 分）`);
    window.__pp = { b, px, done, me, ai, setPx: v => { px = v; } };
    requestAnimationFrame(loop);
  };
  loop();
}
export function openYoichi(i) {
  const [id, n, p, d] = NIGHT[i];
  const pp = panel(`<h2>夜市<small>${n}</small></h2><p class="sub">${d}　（只在晚上營業）</p><div class="btns"><button class="big" id="yoB">買（${p} 文）</button></div>`);
  pp.querySelector('#yoB').onclick = () => { if (!A.afford(p)) return A.toast('錢不夠喔'); A.addMoney(-p, n); A.P.ev('night', { k: id, dex: 'night' });
    if (id === 'kuji') { const r = Math.random(); if (r < .08) { A.prizeAcc(Math.random() < .5 ? 'chochin' : 'kazaguruma', '夜店抽籤：大當たり！'); } else if (r < .45) { const m = [30, 40, 60][Math.floor(Math.random() * 3)]; A.addMoney(m, '抽籤中獎'); A.toast(`抽中 ${m} 文！`); } else A.toast('殘念……下次再來！'); }
    else { A.G.sta = 100; A.G.me.emoji('😋'); A.G.me.say({ soba: '湯頭好濃～', amazake: '暖到心裡了', imo: '好燙好甜！' }[id], 2.5); A.P.addXp(5); }
    A.closePanels(); };
}
export function onsenUpdate(dt) {
  if (!A) return; // 進町前（標題畫面）還沒初始化
  tick += dt; if (tick > 1) { tick = 0; if (yGrp) yGrp.visible = A.isNight(); }
  // 溫泉蒸氣
  if (A.W.onsenSteam && steam.length < 30 && Math.random() < dt * 8) { const p = A.W.onsenSteam[Math.floor(Math.random() * A.W.onsenSteam.length)]; const m = new THREE.Mesh(new THREE.SphereGeometry(.5, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .25, depthWrite: false })); m.position.set(p.x + (Math.random() - .5) * 6, .3, p.z + (Math.random() - .5) * 5); A.scene.add(m); steam.push({ m, t: 0 }); }
  for (const s of steam) { s.t += dt; s.m.position.y += dt * .7; s.m.scale.setScalar(1 + s.t * .8); s.m.material.opacity = Math.max(0, .25 - s.t * .07); }
  steam = steam.filter(s => { if (s.t > 3.5) { A.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); return false; } return true; });
}
export function initOnsen(api) {
  A = api;
  A.P.addDexCat('gather', '🍄 山貨', GATHER.map(g => ({ k: g[0], n: g[1], zh: g[2] })));
  A.P.addDexCat('night', '🏮 夜市', NIGHT.map(n => ({ k: n[0], n: n[1] })));
  if (A.W.ryokanKeeper) { const k = A.W.ryokanKeeper, ch = A.makeNPC({ ...A.randomLook(), hat: 0, c: 0 }); ch.root.position.set(k.x, 0, k.z); ch.root.rotation.y = k.r; A.scene.add(ch.root); }
}
