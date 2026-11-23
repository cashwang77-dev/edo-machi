// 花街「金波楼」：金碧輝煌的料亭與舞台（藝妓舞蹈欣賞、お座敷遊び小遊戲、舞妓打工）
import * as THREE from 'three';
const PI = Math.PI;
export const HANA = { x0: -48, x1: 20, z0: -138, z1: -58 };
export function walkHana(x, z) { return x >= HANA.x0 && x <= HANA.x1 && z >= HANA.z0 && z <= HANA.z1; }
const LANE_Z = -98, STAGE = { x: -8, z: -121 }, ROU = { x: -36, z: LANE_Z }, OKIYA = { x: 6, z: -76 };

let A, GEN = 0, geisha = [], show = null;
const $ = s => document.querySelector(s);

// ---------------- 場景 ----------------
export function buildHana(ctx) {
  const { M, boxG, std, B, W, col, TX, scene, glow } = ctx;
  const spot = (x, z, label, info, say) => W.spots.push({ type: 'meisho', x, z, label, info, say });
  const gold = std('hnGold', { color: '#f0c850', metalness: .6, roughness: .25, emissive: '#a07018', emissiveIntensity: .55 });
  const goldWall = std('hnGoldW', { color: '#d8a838', metalness: .45, roughness: .32, emissive: '#6a4410', emissiveIntensity: .4 }), lacq = std('hnLacq', { color: '#c8281e', roughness: .3, metalness: .1, emissive: '#3a0804', emissiveIntensity: .3 });
  const red = std('hnRed', { color: '#b8221a', roughness: .45 }), black = std('hnBlack', { color: '#1a1412', roughness: .4 });
  const roof = std('hnRoof', { color: '#2e2a2a', roughness: .6 }), wall = std('hnWall', { color: '#f2e6cc', roughness: .9 }), bengara = std('hnBengara', { color: '#8a2a1e', roughness: .7 });
  const lanM = std('hnLan', { color: '#e83a2a', emissive: '#ff5a2a', emissiveIntensity: .8 });
  const lantern = (g, x, y, z, s = 1) => { const l = M(new THREE.SphereGeometry(.28 * s, 12, 9), lanM, x, y, z); l.scale.y = 1.35; g.add(l); g.add(M(boxG(.2 * s, .06, .2 * s, 1), black, x, y + .4 * s, z)); g.add(M(boxG(.2 * s, .06, .2 * s, 1), black, x, y - .4 * s, z)); };
  const gm = std('hnStone', { map: TX.stone('hnst').clone(), color: '#b0a898' }); gm.map.repeat.set(30, 3); gm.map.needsUpdate = true;
  // 地面：草地底＋石板花見小路
  { const g0 = std('hnGround', { map: TX.ground('dirt').clone(), color: '#d8ccb0' }); g0.map.repeat.set(14, 16); g0.map.needsUpdate = true;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(HANA.x1 - HANA.x0, HANA.z1 - HANA.z0), g0); g.rotation.x = -PI / 2; g.position.set((HANA.x0 + HANA.x1) / 2, .011, (HANA.z0 + HANA.z1) / 2); g.receiveShadow = true; scene.add(g);
    const l = new THREE.Mesh(new THREE.PlaneGeometry(HANA.x1 - HANA.x0, 7), gm); l.rotation.x = -PI / 2; l.position.set((HANA.x0 + HANA.x1) / 2, .02, LANE_Z); l.receiveShadow = true; scene.add(l);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 18), gm); p.rotation.x = -PI / 2; p.position.set(STAGE.x, .021, -110); scene.add(p); }
  // 大門
  { const g = new THREE.Group(); g.position.set(18, 0, LANE_Z);
    for (const s of [-1, 1]) g.add(M(boxG(.6, 6, .6, 1), red, 0, 3, s * 4));
    g.add(M(boxG(1.2, .7, 10.4, 1), black, 0, 6.1, 0)); g.add(M(boxG(1.4, .2, 11, 1), gold, 0, 6.55, 0));
    g.add(M(new THREE.BoxGeometry(.1, 1.2, 3.4), std('hnGateSign', { map: TX.text('花街 金波', { bg: '#1a1412', fg: '#e8c050', w: 512, h: 160, vertical: false }) }), -.65, 5.2, 0));
    for (const s of [-1, 1]) lantern(g, -.7, 4.2, s * 2.6, 1.3);
    B.bake(g); for (const s of [-1, 1]) col(18, LANE_Z + s * 4, .6); }
  // 茶屋（紅殼格子）兩側
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = 10 - i * 11, z = LANE_Z + sd * 9, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = sd > 0 ? PI : 0;
    g.add(M(boxG(9.4, 3, 5, 1), wall, 0, 1.5, -1)); g.add(M(boxG(9.4, 2.4, 4.4, 1), wall, 0, 4.2, -1.2));
    g.add(M(boxG(9.6, .12, 6, 1), roof, 0, 3.1, -.6, .12, 0, 0)); g.add(M(boxG(9.8, .14, 5.4, 1), roof, 0, 5.6, -1.1, .18, 0, 0));
    for (let k = -4; k <= 4; k += .3) g.add(M(boxG(.06, 2.2, .06, 1), bengara, k, 1.3, 1.55)); // 紅殼格子
    g.add(M(boxG(9.4, .1, .1, 1), bengara, 0, 2.4, 1.55)); g.add(M(boxG(2, 1.5, .04, 1), std('hnNoren' + (i % 3), { color: ['#2f3f6a', '#6a2a3a', '#2a4a3a'][i % 3] }), 0, 2.2, 1.6));
    lantern(g, -3.6, 2.05, 2.25); lantern(g, 3.6, 2.05, 2.25); g.add(M(boxG(9.4, .5, .4, 1), std('hnInu', { color: '#5a4030' }), 0, .25, 1.75));
    B.bake(g); for (let k = -3.6; k <= 3.6; k += 1.8) col(x + k, z + sd * 1.2, 2.3); // 碰撞圈放在房子本體（之前算反，門前多了一道隱形牆）
  }
  // 金波楼（三層、金箔屋簷、金鯱）
  { const g = new THREE.Group(); g.position.set(ROU.x, 0, ROU.z); g.rotation.y = PI / 2; // 正面朝東（+x）
    const fl = [[16, 4.2, 12], [13, 3.4, 10], [10, 3, 8]]; let y = 0;
    g.add(M(boxG(17, .6, 13, 1), std('hnBase', { color: '#9a958a' }), 0, .3, 0)); y = .6;
    fl.forEach(([w, h, d], i) => {
      g.add(M(boxG(w, h, d, 1), i ? goldWall : lacq, 0, y + h / 2, 0));
      for (let k = -w / 2 + .4; k <= w / 2 - .3; k += w / 6) { g.add(M(boxG(.4, h, .4, 1), lacq, k, y + h / 2, d / 2 + .05)); g.add(M(boxG(.5, .22, .5, 1), gold, k, y + h - .1, d / 2 + .05)); } // 朱漆柱＋金飾
      g.add(M(boxG(w - .6, h * .55, .05, 1), std('hnShoji', { color: '#fff4d8', emissive: '#ffb860', emissiveIntensity: .9 }), 0, y + h * .5, d / 2 + .02));
      g.add(M(boxG(w + .4, .3, .3, 1), gold, 0, y + h * .9, d / 2 + .3)); g.add(M(boxG(w + .4, .1, .1, 1), gold, 0, y + .15, d / 2 + .3)); // 金高欄
      y += h;
      const rw = w + 3, rd = d + 3; const r = M(boxG(rw, .3, rd, 1), roof, 0, y + .15, 0); g.add(r);
      for (const s of [-1, 1]) { g.add(M(boxG(rw + .2, .18, .25, 1), gold, 0, y + .32, s * rd / 2)); g.add(M(boxG(.25, .18, rd + .2, 1), gold, s * rw / 2, y + .32, 0)); }
      const cap = M(new THREE.ConeGeometry(Math.max(rw, rd) * .62, 1.6, 4), roof, 0, y + 1.1, 0, 0, PI / 4, 0); cap.scale.set(rw / Math.max(rw, rd), 1, rd / Math.max(rw, rd)); g.add(cap);
      for (let k = -w / 2; k <= w / 2; k += 2.4) lantern(g, k, y - .5, d / 2 + 1.1, .9);
      y += .4;
    });
    for (const s of [-1, 1]) { const sh = M(new THREE.ConeGeometry(.35, 1.4, 8), gold, s * 1.6, y + 1.9, 0, 0, 0, s * .5); g.add(sh); g.add(M(new THREE.SphereGeometry(.3, 10, 8), gold, s * 1.4, y + 1.4, 0)); } // 金鯱
    g.add(M(boxG(4, 1.6, .1, 1), std('hnSign', { map: TX.text('金波楼', { bg: '#1a1412', fg: '#f0c850', w: 512, h: 200, vertical: false }) }), 0, 5.6, 7.3 - 0.9));
    g.add(M(boxG(3.6, 2.6, .06, 1), gold, 0, 1.9, 6.2)); // 玄關金屏風
    B.bake(g); for (let xx = -7; xx <= 7; xx += 2) for (let zz = -5.5; zz <= 5.5; zz += 2) col(ROU.x - zz, ROU.z + xx, 1.4);
    W.spots.push({ type: 'ozashiki', x: ROU.x + 8.6, z: ROU.z, label: '🏮 金波楼：お座敷遊び' });
    spot(ROU.x + 11, ROU.z + 2.5, '📸 名所：金波楼', '金波楼：花街最氣派的料亭，三層樓簷都貼著金箔，屋頂有一對金鯱。藝妓在這裡以舞蹈、三味線和宴席遊戲招待客人。', '好氣派啊！金光閃閃～'); }
  // 舞台（金屏風、紅毛氈）
  { const g = new THREE.Group(); g.position.set(STAGE.x, 0, STAGE.z);
    g.add(M(boxG(10, 1, 6, 1), std('hnHinoki', { map: TX.wood('plank', '#c8a070', [3, 1]) }), 0, .5, 0)); g.add(M(boxG(10.2, .2, 6.2, 1), red, 0, .1, 0));
    g.add(M(boxG(9, .04, 4.6, 1), std('hnMosen', { color: '#c8221a', roughness: .95 }), 0, 1.02, .2));
    for (let i = 0; i < 6; i++) { const p = M(boxG(1.6, 3.2, .06, 1), gold, -4 + i * 1.6, 2.6, -2.6 + (i % 2) * .22); p.rotation.y = (i % 2 ? -.25 : .25); g.add(p); } // 金屏風
    for (const s of [-1, 1]) { g.add(M(boxG(.4, 5.4, .4, 1), red, s * 5, 2.7, 3)); lantern(g, s * 5, 4.6, 3.4, 1.4); }
    g.add(M(boxG(10.8, .5, .5, 1), black, 0, 5.4, 3)); g.add(M(boxG(11, .16, .7, 1), gold, 0, 5.7, 3));
    for (let k = -4.5; k <= 4.5; k += 1.5) lantern(g, k, 4.9, 3.3, .7);
    B.bake(g); for (let k = -4.5; k <= 4.5; k += 1.8) { col(STAGE.x + k, STAGE.z - 1.5, 1.4); col(STAGE.x + k, STAGE.z + 1.5, 1.4); }
    for (const s of [-1, 1]) { const b = new THREE.Group(); b.position.set(STAGE.x + s * 3.2, 0, STAGE.z + 7); b.add(M(boxG(3.4, .1, 1, 1), std('hnEndai', { color: '#c8322a' }), 0, .48, 0)); for (const x of [-1.5, 1.5]) b.add(M(boxG(.08, .44, .8, 1), black, x, .22, 0)); B.bake(b); }
    W.spots.push({ type: 'stage', x: STAGE.x, z: STAGE.z + 5.2, label: '🎐 觀賞藝妓舞蹈（花代 20 文）' });
    W.geishaPos = [{ x: STAGE.x, y: 1.05, z: STAGE.z, r: 0, stage: true }, { x: -2, y: 0, z: LANE_Z + 4.2, r: PI / 2 }, { x: -18, y: 0, z: LANE_Z - 4.2, r: -PI / 2 }, { x: ROU.x + 9.4, y: 0, z: ROU.z + 2.6, r: PI / 2 }];
    spot(STAGE.x + 4, STAGE.z + 8, '📸 名所：花見小路', '花見小路：鋪著石板的花街小路，兩旁是紅殼格子的茶屋。入夜後提燈一盞盞亮起，是江戶最華麗的街道。', '燈籠好美～'); }
  // 置屋（舞妓打工）
  { const g = new THREE.Group(); g.position.set(OKIYA.x, 0, OKIYA.z);
    g.add(M(boxG(8, 3.2, 6, 1), wall, 0, 1.6, 0)); g.add(M(boxG(9, .2, 7, 1), roof, 0, 3.3, 0, .1, 0, 0)); for (let k = -3.6; k <= 3.6; k += .3) g.add(M(boxG(.06, 2.2, .06, 1), bengara, k, 1.2, -3.05));
    g.add(M(boxG(2.2, 1.1, .04, 1), std('hnOkiyaN', { map: TX.text('置屋', { bg: '#6a2a3a', fg: '#f4e8d0', w: 256, h: 128, vertical: false }) }), 0, 2.3, -3.1)); lantern(g, 3, 2.6, -3.4);
    B.bake(g); for (let k = -3; k <= 3; k += 2) for (const zz of [-1.5, 1.5]) col(OKIYA.x + k, OKIYA.z + zz, 1.6);
    W.spots.push({ type: 'maiko', x: OKIYA.x, z: OKIYA.z - 4.4, label: '🎎 置屋：舞妓打工' }); }
}

// ---------------- 遊戲 ----------------
const SCALE = [392, 440, 523, 587, 659, 784, 880]; // 都節風
function shamisen(n = 8, gap = 260) { for (let i = 0; i < n; i++) setTimeout(() => A.SND.pluck(SCALE[[0, 2, 3, 2, 4, 3, 2, 0, 5, 4, 3, 2][i % 12]], .09), i * gap); }

export function watchShow() {
  if (show) return A.toast('正在表演中，請欣賞～');
  if (!A.afford(20)) return A.toast('花代不夠喔');
  A.addMoney(-20, '花代'); const g = geisha.find(x => x.stage); if (!g) return;
  show = { t: 0 }; A.G.shot = [STAGE.x + 3.2, 2.6, STAGE.z + 8.5, STAGE.x, 2, STAGE.z]; A.G.me.say('好期待～', 2);
  const seq = [10, 14, 6, 10, 9, 17, 10, 6]; seq.forEach((a, i) => setTimeout(() => { g.ch.play(a); if (i % 2) g.ch.emoji(['🎐', '🌸', '✨'][i % 3]); }, i * 1100));
  shamisen(34, 260);
  setTimeout(() => { g.ch.play(17); g.ch.say('おおきに～', 3); }, seq.length * 1100);
  setTimeout(() => { A.G.shot = null; show = null; g.ch.play(0); A.G.me.emoji('👏'); A.P.ev('show'); A.P.addXp(15, '欣賞舞蹈'); A.toast('好精彩的舞蹈！', 2500); }, seq.length * 1100 + 2200);
}
export function openOzashiki() {
  const p = $('#panel'); p.innerHTML = `<h2>金波楼<small>お座敷遊び</small></h2><p class="sub">女將：「歡迎光臨～今晚想玩什麼遊戲呢？」　お座敷代 30 文</p>
    <div class="btns"><button class="big" id="oz1">⛵ 金毘羅船々（反應遊戲）</button><button class="big alt" id="oz2">🎐 投扇興（丟扇子）</button></div><button class="close" id="ozX">✕</button>`;
  A.show('#panel'); $('#ozX').onclick = A.closePanels;
  const pay = () => { if (!A.afford(30)) { A.toast('お座敷代不夠喔'); return false; } A.addMoney(-30, 'お座敷代'); A.closePanels(); return true; };
  $('#oz1').onclick = () => pay() && playKonpira(); $('#oz2').onclick = () => pay() && playTosenkyo();
}
// 金毘羅船々：每一拍看台上有沒有「袴（小台子）」——有就點左邊 ✋ 拍上去，被拿走了就點右邊 ✊。越來越快，錯一次結束。
function playKonpira() {
  const M = A.gameModal('⛵ 金毘羅船々', '每一拍：台子上有袴（紫色小台）就點左邊「✋ 拍」，被藝妓拿走了就點右邊「✊ 握拳」。越來越快，錯一次就結束！');
  const g = M.g, my = ++GEN; let beat = 0, has = true, t0 = performance.now(), per = 1.15, answered = false, alive = true, msg = '', next = performance.now() + 1500;
  const judge = side => { if (!alive || answered) return; answered = true; const ok = (side === 0) === has; A.SND.pluck(ok ? 880 : 200, .07); if (!ok) { alive = false; msg = '啊！錯了～'; end(); } else msg = ['よいよい！', 'はい！', 'お見事！'][beat % 3]; };
  M.cv.onpointerdown = e => { e.preventDefault(); const r = M.cv.getBoundingClientRect(); judge(e.clientX - r.left < r.width / 2 ? 0 : 1); };
  const end = () => setTimeout(() => { if (my !== GEN || !M.cv.isConnected) return; M.close(); const pay = beat * 5 + (beat >= 15 ? 60 : 0); if (pay) A.addMoney(pay, `金毘羅船々 ${beat} 拍`); A.P.ev('ozashiki', { n: beat }); A.P.addXp(5 + beat); A.toast(beat >= 15 ? '藝妓：「哎呀，您真厲害！」' : `撐了 ${beat} 拍～`, 3000); }, 900);
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return; const now = performance.now();
    if (alive && now >= next) { if (beat > 0 && !answered) { alive = false; msg = '慢了一拍～'; end(); } else { beat++; has = Math.random() < .55; answered = false; per = Math.max(.42, 1.15 - beat * .045); next = now + per * 1000; A.SND.pluck(has ? 523 : 659, .05); } }
    g.fillStyle = '#5a1a14'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#c89a52'; g.fillRect(40, 150, 280, 16); // 膳
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, 180, 240);
    if (has) { g.fillStyle = '#6a3a8a'; g.fillRect(160, 118, 40, 32); g.fillStyle = '#e8c050'; g.fillRect(160, 118, 40, 5); }
    const k = Math.min(1, (next - now) / (per * 1000)); g.strokeStyle = '#e8c050'; g.lineWidth = 4; g.beginPath(); g.arc(180, 60, 24, -PI / 2, -PI / 2 + PI * 2 * k); g.stroke();
    g.fillStyle = '#f4e8d0'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.fillText('✋', 90, 215); g.fillText('✊', 270, 215);
    g.font = '700 13px sans-serif'; g.fillText('拍（有袴）', 90, 232); g.fillText('握拳（沒袴）', 270, 232);
    if (msg) { g.font = '900 20px sans-serif'; g.fillStyle = '#ffd86a'; g.fillText(msg, 180, 104); }
    M.stat(`第 <b>${beat}</b> 拍　（一拍 5 文，撐到 15 拍加 60 文）`);
    window.__konpira = { beat, has, answered, alive, judge };
    requestAnimationFrame(loop);
  };
  loop();
}
// 投扇興：先點一下定方向（左右擺），再點一下定力道，扇子打中台上的「蝶」得分。丟 3 次。
export function playTosenkyo(duel) { // duel：對決模式，丟完把分數交給回呼，不發獎金
  const M = A.gameModal('🎐 投扇興', '第一下決定方向、第二下決定力道，把扇子丟中枕台上的「蝶」！一共丟 3 次。');
  const g = M.g, my = ++GEN; let n = 0, st = 0, t0 = performance.now(), ang = 0, pow = 0, pts = 0, fly = null, msg = '';
  const tri = u => { const k = u % 2; return k < 1 ? k : 2 - k; };
  M.cv.onpointerdown = e => { e.preventDefault(); if (fly) return; const u = (performance.now() - t0) / 1000;
    if (st === 0) { ang = tri(u * 1.3) * 2 - 1; st = 1; t0 = performance.now(); }
    else { pow = tri(u * 1.1); st = 0; t0 = performance.now(); fly = { t: 0 }; } };
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return; const u = (performance.now() - t0) / 1000;
    g.fillStyle = '#e8dcb8'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#c8a070'; for (let i = 0; i < 8; i++) g.fillRect(0, i * 30, 360, 1); // 榻榻米線
    g.fillStyle = '#6a2a1a'; g.fillRect(166, 70, 28, 22); g.fillStyle = '#e8c050'; g.beginPath(); g.ellipse(180, 64, 12, 7, 0, 0, 7); g.fill(); // 枕台＋蝶
    const a = st === 0 && !fly ? tri(u * 1.3) * 2 - 1 : ang, pw = st === 1 && !fly ? tri(u * 1.1) : pow;
    g.strokeStyle = '#3a2a1a'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(180, 220); g.lineTo(180 + a * 120, 60); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(320, 60, 16, 150); g.fillStyle = st === 1 ? '#c8322a' : '#a08060'; g.fillRect(320, 210 - pw * 150, 16, pw * 150); g.fillStyle = 'rgba(80,200,120,.6)'; g.fillRect(320, 210 - .82 * 150, 16, .12 * 150); // 綠區＝剛好飛到蝶（力道 .76 左右）
    if (fly) { const nw = performance.now(); fly.t += Math.min(.1, (nw - (fly.last || nw)) / 1000) * 1.6; fly.last = nw; /* 依真實時間飛 */ const k = Math.min(1, fly.t); const fx = 180 + ang * 120 * k * pow / .78, fy = 220 - 160 * k * pow / .78; g.fillStyle = '#e83a5a'; g.beginPath(); g.moveTo(fx, fy); g.arc(fx, fy, 12, PI * 1.1, PI * 1.9); g.fill();
      if (k >= 1) { const d = Math.hypot(fx - 180, fy - 64); const s = d < 14 ? 5 : d < 30 ? 3 : d < 55 ? 1 : 0; pts += s; msg = ['落空…', '擦到邊（1 分）', '', '打中枕台（3 分）', '', '蝶落！（5 分）'][s]; A.SND.pluck(s ? 990 : 260, .07); fly = null; n++;
        if (n >= 3) setTimeout(() => { if (my !== GEN || !M.cv.isConnected) return; M.close(); if (duel) return duel(pts); const pay = pts * 8; if (pay) A.addMoney(pay, `投扇興 ${pts} 分`); A.P.ev('ozashiki', { n: pts }); A.P.addXp(5 + pts * 2); A.toast(`投扇興 ${pts} 分！${pts >= 12 ? '藝妓們都拍手叫好～' : ''}`, 3000); }, 900); } }
    if (msg) { g.fillStyle = '#8a1a14'; g.font = '700 16px sans-serif'; g.textAlign = 'center'; g.fillText(msg, 180, 30); }
    M.stat(`第 ${Math.min(n + 1, 3)} / 3 扇　得分 <b>${pts}</b>　${st === 0 ? '👉 點一下定方向' : '👉 點一下定力道（綠區剛好）'}`);
    window.__tosen = { n, st, pts, stNow: () => st, flyNow: () => !!fly, angNow: () => tri((performance.now() - t0) / 1000 * 1.3) * 2 - 1, powNow: () => tri((performance.now() - t0) / 1000 * 1.1), fly: !!fly };
    requestAnimationFrame(loop);
  };
  loop();
}
// 舞妓打工：音符從上往下掉到三條線（左扇／中鞠躬／右袖），掉到判定線時點對應的區塊。共 16 個音符。
export function playMaiko() {
  const M = A.gameModal('🎎 舞妓打工：練舞', '音符掉到金色判定線時，點對應的那一欄（左・中・右）！跟著三味線跳完一曲，依準確度領工錢。');
  const g = M.g, my = ++GEN, start = performance.now() + 1200, notes = []; let hit = 0, miss = 0, fb = '', fbT = 0;
  for (let i = 0; i < 16; i++) notes.push({ t: i * .75 + (i > 8 ? -.2 * (i - 8) * .5 : 0), lane: Math.floor(Math.random() * 3), done: false });
  const SPD = 150, LINE = 200;
  M.cv.onpointerdown = e => { e.preventDefault(); const r = M.cv.getBoundingClientRect(), lane = Math.min(2, Math.floor((e.clientX - r.left) / r.width * 3)), now = (performance.now() - start) / 1000;
    const n = notes.find(n => !n.done && n.lane === lane && Math.abs(now - n.t) < .22);
    if (n) { n.done = true; hit++; fb = Math.abs(now - n.t) < .09 ? '完美' : '好'; A.SND.pluck(SCALE[(lane * 2 + hit) % 7], .07); } else { fb = '…'; } fbT = .4; };
  const fin = () => setTimeout(() => { if (my !== GEN || !M.cv.isConnected) return; M.close(); const pay = hit * 3 + (hit >= 14 ? 25 : 0); A.addMoney(pay, `舞妓工錢${hit >= 14 ? '（女將加賞）' : ''}`); A.P.ev('job', { k: 'maiko', hit }); A.toast(`跳完一曲！命中 ${hit} / 16　女將：「${hit >= 14 ? '跳得真美！' : hit >= 8 ? '再練練會更好。' : '腳步還不穩呢～'}」`, 3200); }, 800);
  let ended = false;
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return; const now = (performance.now() - start) / 1000;
    g.fillStyle = '#3a0e0a'; g.fillRect(0, 0, 360, 240); for (let i = 1; i < 3; i++) { g.fillStyle = 'rgba(232,192,80,.2)'; g.fillRect(i * 120 - 1, 0, 2, 240); }
    g.fillStyle = '#e8c050'; g.fillRect(0, LINE - 2, 360, 4);
    for (const n of notes) { if (!n.done && now - n.t > .22) { n.done = true; miss++; } if (n.done) continue; const y = LINE - (n.t - now) * SPD; if (y < -20) continue;
      g.fillStyle = ['#e85a7a', '#e8c050', '#7ab8e8'][n.lane]; g.beginPath(); g.arc(n.lane * 120 + 60, y, 14, 0, 7); g.fill(); g.fillStyle = '#3a0e0a'; g.font = '700 13px sans-serif'; g.textAlign = 'center'; g.fillText(['扇', '礼', '袖'][n.lane], n.lane * 120 + 60, y + 5); }
    g.fillStyle = '#f4e8d0'; g.font = '700 14px sans-serif'; g.textAlign = 'center'; ['🎐 扇', '🙇 礼', '👘 袖'].forEach((s, i) => g.fillText(s, i * 120 + 60, 228));
    fbT -= 1 / 60; if (fbT > 0) { g.fillStyle = '#ffd86a'; g.font = '900 22px sans-serif'; g.fillText(fb, 180, 60); }
    if (!ended && notes.every(n => n.done)) { ended = true; fin(); }
    M.stat(`命中 <b>${hit}</b>　失誤 ${miss}　（一拍 3 文，14 拍以上女將加賞 25 文）`);
    window.__maiko = { now, notes, hit, lanes: 3, start };
    requestAnimationFrame(loop);
  };
  loop();
}

export function initHana(api) {
  A = api; geisha = [];
  for (const p of A.W.geishaPos || []) { const lk = { ...A.randomLook(), k: 3, p: 1, hat: 0, c: 0, f: '' }; const ch = A.makeNPC(lk, true); ch.root.position.set(p.x, p.y, p.z); ch.root.rotation.y = p.r; A.scene.add(ch.root); geisha.push({ ch, stage: !!p.stage, p }); }
  // 小路上的藝妓偶爾行禮、掩嘴笑
  setInterval(() => { for (const g of geisha) { if (g.stage && show) continue; if (Math.random() < .35) g.ch.play([6, 14, 9, 7][Math.floor(Math.random() * 4)]); else g.ch.play(0); } }, 3500);
}
export const hanaUpdate = dt => { for (const g of geisha) g.ch.update(dt, 0); };
