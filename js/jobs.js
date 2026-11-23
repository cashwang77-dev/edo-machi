// 口入屋（打工介紹所）：飛腳送信、茶屋端茶、町內打掃，並介紹其他地方的打工
import * as THREE from 'three';
const PI = Math.PI;
let A, GEN = 0, run = null; // run：進行中的飛腳任務 {to, x, z, t, lim, pay}
const $ = s => document.querySelector(s);
export const KUCHI = { x: 98, z: 5.3 };

function build() {
  const g = new THREE.Group(); g.position.set(KUCHI.x, 0, KUCHI.z + .9);
  const wd = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: .85 });
  const b = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); };
  for (const x of [-1.3, 1.3]) b(.16, 2.6, .16, wd, x, 1.3, 0);
  b(3, .14, .5, new THREE.MeshStandardMaterial({ color: '#3a3430' }), 0, 2.65, 0);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const c = cv.getContext('2d');
  c.fillStyle = '#e8dcbc'; c.fillRect(0, 0, 512, 300); c.fillStyle = '#1c1410'; c.font = '700 64px serif'; c.textAlign = 'center'; c.fillText('口入屋', 256, 80);
  c.font = '600 34px serif'; ['飛脚 送信', '茶屋 端茶', '町内 掃除', '其他打工'].forEach((s, i) => c.fillText('・' + s, 256, 135 + i * 42));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  b(2.4, 1.4, .08, new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }), 0, 1.75, 0);
  A.scene.add(g); A.W.colliders.push({ x: KUCHI.x, z: KUCHI.z + .9, r: 1.1 });
  A.W.spots.push({ type: 'kuchi', x: KUCHI.x, z: KUCHI.z - .6, label: '📋 口入屋：打工介紹' });
  // 飛腳任務 HUD
  const h = document.createElement('div'); h.id = 'jobHud'; h.className = 'hide'; document.body.appendChild(h);
}

export function openKuchi() {
  const p = $('#panel');
  p.innerHTML = `<h2>口入屋<small>打工介紹所</small></h2><p class="sub">掌櫃：「今天也有不少活兒喔，挑一個吧！」</p>
    <div class="mlist">
      <div class="mrow"><span>📮 飛腳送信 <small>把信送到指定地點，越快工錢越多</small></span><span></span><span>15〜60 文</span><button id="jb1">接</button></div>
      <div class="mrow"><span>🍵 茶屋端茶 <small>40 秒內把茶點端給客人</small></span><span></span><span>〜50 文</span><button id="jb2">接</button></div>
      <div class="mrow"><span>🧹 町內打掃 <small>20 秒內把落葉掃乾淨</small></span><span></span><span>〜35 文</span><button id="jb3">接</button></div>
    </div>
    <p class="sub">其他地方也在徵人：<br>・📦 隅田川「魚河岸」搬貨　・🪚 新開地「材木屋」大工助手　・🎎 花街「置屋」舞妓練舞</p>
    ${run ? `<p class="sub">⚠ 你身上還有一封要送到「${run.to}」的信</p><div class="btns"><button id="jbQ">放棄送信</button></div>` : ''}<button class="close" id="jbX">✕</button>`;
  A.show('#panel'); $('#jbX').onclick = A.closePanels;
  $('#jb1').onclick = () => { A.closePanels(); startCourier(); };
  $('#jb2').onclick = () => { A.closePanels(); playTea(); };
  $('#jb3').onclick = () => { A.closePanels(); playSweep(); };
  const q = $('#jbQ'); if (q) q.onclick = () => { endCourier(false, '放棄了送信'); openKuchi(); };
}

// ---- 飛腳送信 ----
function startCourier() {
  if (run) return A.toast(`先把信送到「${run.to}」吧`);
  const here = A.G.pos, cand = A.DEST.filter(d => Math.hypot(d[1] - here.x, d[2] - here.z) > 30);
  const d = cand[Math.floor(Math.random() * cand.length)], dist = Math.hypot(d[1] - here.x, d[2] - here.z);
  const NAMES = ['隠居の宗右衛門', '八百屋のお松', '寺子屋の先生', '大工の熊吉', '番頭の与兵衛', '髪結いのお梅'];
  run = { to: d[0], x: d[1], z: d[2], t: 0, lim: Math.round(dist / 3.2 + 20), dist, who: NAMES[Math.floor(Math.random() * NAMES.length)] };
  A.toast(`📮 把信送到「${d[0]}」交給${run.who}！小地圖上的 ★ 就是目的地（限時 ${run.lim} 秒，坐人力車不算）`, 4500); A.G.me.emoji('📮');
}
function endCourier(ok, msg) {
  if (!run) return; const r = run; run = null; $('#jobHud').classList.add('hide');
  if (ok) { const left = Math.max(0, r.lim - r.t), pay = Math.round(15 + r.dist / 8 + left / 2); A.addMoney(pay, `送信工錢${left > r.lim * .4 ? '（神速！）' : ''}`); A.P.ev('job', { k: 'hikyaku' }); A.G.me.emoji('📨'); A.G.me.say('信送到了！', 2.5); A.toast(`${r.who}：「辛苦了！」`, 2500); }
  else A.toast(msg || '信沒送到……', 2600);
}
export function jobUpdate(dt) {
  if (!run) return; run.t += dt; const left = run.lim - run.t, d = Math.hypot(A.G.pos.x - run.x, A.G.pos.z - run.z);
  const h = $('#jobHud'); h.classList.remove('hide'); h.innerHTML = `📮 送信到「${run.to}」　剩 <b>${Math.max(0, Math.ceil(left))}</b> 秒　距離 ${Math.round(d)} 步`; h.classList.toggle('late', left < 10);
  if (d < 4) { if (A.G.mode === 'ride') { h.innerHTML += '　（請下車再交信）'; return; } endCourier(true); }
  else if (left <= 0) endCourier(false, '⌛ 太慢了，信沒能準時送到……');
}
export function jobMark() { return run ? { x: run.x, z: run.z } : null; }

// ---- 茶屋端茶：點上面的茶點拿起來，再點想要那樣東西的客人 ----
function playTea() {
  const M = A.gameModal('🍵 茶屋端茶', '先點上排的茶點拿起來，再點頭上想要那樣東西的客人！客人等太久會生氣離開。限時 40 秒。');
  const g = M.g, my = ++GEN, ITEMS = ['🍵', '🍡', '🍶'], seats = [0, 1, 2, 3].map(() => null); let hand = -1, served = 0, angry = 0, left = 40, last = performance.now(), spawn = .5, done = false;
  const pos = i => [52 + i * 85, 165];
  M.cv.onpointerdown = e => { e.preventDefault(); if (done) return; const r = M.cv.getBoundingClientRect(), x = (e.clientX - r.left) * 360 / r.width, y = (e.clientY - r.top) * 240 / r.height;
    if (y < 70) { const i = Math.floor((x - 60) / 80); if (i >= 0 && i < 3) { hand = i; A.SND.pluck(660, .04); } return; }
    const s = seats.findIndex((c, i) => c && Math.abs(x - pos(i)[0]) < 38); if (s < 0 || hand < 0) return;
    if (seats[s].want === hand) { served++; seats[s] = { leaving: .6, happy: true }; A.SND.pluck(990, .06); } else { A.SND.pluck(220, .08); seats[s].p -= 2; } hand = -1; };
  const fin = () => { done = true; setTimeout(() => { if (my !== GEN || !M.cv.isConnected) return; M.close(); const pay = served * 4 + (angry === 0 && served >= 8 ? 15 : 0); if (pay) A.addMoney(pay, `端茶工錢 ${served} 份`); A.P.ev('job', { k: 'tea', served }); A.toast(`端了 ${served} 份${angry ? `，有 ${angry} 位客人生氣走了` : '，客人都很滿意！'}`, 3000); }, 600); };
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return; const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
    if (!done) { left -= dt; if (left <= 0) fin(); spawn -= dt; if (spawn <= 0) { const e = seats.findIndex(c => !c); if (e >= 0) seats[e] = { want: Math.floor(Math.random() * 3), p: 7 + Math.random() * 3 }; spawn = 1.2 + Math.random() * 1.5; }
      seats.forEach((c, i) => { if (!c) return; if (c.leaving != null) { c.leaving -= dt; if (c.leaving <= 0) seats[i] = null; return; } c.p -= dt; if (c.p <= 0) { angry++; seats[i] = { leaving: .6, happy: false }; } }); }
    g.fillStyle = '#efe2c4'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#b5373a'; g.fillRect(0, 0, 360, 70); // 暖簾色的櫃台
    ITEMS.forEach((it, i) => { g.fillStyle = hand === i ? '#ffe08a' : '#f6ecd6'; g.fillRect(64 + i * 80, 10, 70, 50); g.font = '34px sans-serif'; g.textAlign = 'center'; g.fillText(it, 99 + i * 80, 47); });
    g.fillStyle = '#c8322a'; g.fillRect(20, 200, 320, 12); // 長椅
    seats.forEach((c, i) => { const [x, y] = pos(i); if (!c) return; g.font = '38px sans-serif'; g.textAlign = 'center';
      if (c.leaving != null) { g.fillText(c.happy ? '😋' : '😠', x, y + 20); return; }
      g.fillText(c.p < 3 ? '😣' : '🙂', x, y + 20); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y - 34, 22, 17, 0, 0, 7); g.fill(); g.font = '24px sans-serif'; g.fillStyle = '#000'; g.fillText(ITEMS[c.want], x, y - 26);
      g.fillStyle = c.p < 3 ? '#e33' : '#5a5'; g.fillRect(x - 25, y + 30, 50 * Math.max(0, c.p) / 10, 5); });
    if (hand >= 0) { g.font = '26px sans-serif'; g.fillText('手上：' + ITEMS[hand], 300, 100); }
    M.stat(`剩 <b>${Math.max(0, Math.ceil(left))}</b> 秒　已端 <b>${served}</b> 份　生氣 ${angry}`);
    window.__tea = { seats, hand, done, pos, left, served };
    requestAnimationFrame(loop);
  };
  loop();
}

// ---- 町內打掃：按住拖曳掃把把落葉掃掉 ----
function playSweep() {
  const M = A.gameModal('🧹 町內打掃', '按住並拖曳，用掃把把落葉掃乾淨！風一吹又會飄來新的落葉。限時 20 秒。');
  const g = M.g, my = ++GEN; let leaves = [...Array(70)].map(() => ({ x: 20 + Math.random() * 320, y: 20 + Math.random() * 200, r: Math.random() * 6, c: ['#c8642a', '#e0a040', '#a84a2a'][Math.floor(Math.random() * 3)] }));
  let down = false, mx = -99, my2 = -99, left = 20, last = performance.now(), swept = 0, done = false, wind = 3;
  const sweep = () => { const n0 = leaves.length; leaves = leaves.filter(l => Math.hypot(l.x - mx, l.y - my2) > 26); const k = n0 - leaves.length; if (k) { swept += k; if (Math.random() < .3) A.SND.pluck(300 + Math.random() * 200, .02); } };
  const at = e => { const r = M.cv.getBoundingClientRect(); mx = (e.clientX - r.left) * 360 / r.width; my2 = (e.clientY - r.top) * 240 / r.height; };
  M.cv.onpointerdown = e => { e.preventDefault(); down = true; at(e); sweep(); };
  M.cv.onpointermove = e => { at(e); if (down) sweep(); };
  M.cv.onpointerup = M.cv.onpointerleave = () => { down = false; };
  const fin = () => { done = true; setTimeout(() => { if (my !== GEN || !M.cv.isConnected) return; M.close(); const clean = 1 - Math.min(1, leaves.length / 70), pay = Math.round(clean * 30 + (leaves.length === 0 ? 5 : 0)); if (pay) A.addMoney(pay, `打掃工錢（乾淨度 ${Math.round(clean * 100)}%）`); A.P.ev('job', { k: 'sweep' }); A.toast(clean > .9 ? '大家：「街上好乾淨！」' : `掃了 ${swept} 片落葉`, 2800); }, 500); };
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return; const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
    if (!done) { left -= dt; if (left <= 0) fin(); wind -= dt; if (wind <= 0) { for (let i = 0; i < 5; i++) leaves.push({ x: Math.random() * 360, y: Math.random() * 240, r: Math.random() * 6, c: '#c8642a' }); wind = 3 + Math.random() * 2; } }
    g.fillStyle = '#d8c8a0'; g.fillRect(0, 0, 360, 240);
    for (const l of leaves) { g.save(); g.translate(l.x, l.y); g.rotate(l.r); g.fillStyle = l.c; g.beginPath(); g.ellipse(0, 0, 7, 4, 0, 0, 7); g.fill(); g.restore(); }
    if (mx > 0) { g.strokeStyle = '#7a5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx + 18, my2 - 30); g.lineTo(mx, my2); g.stroke(); g.fillStyle = 'rgba(200,170,90,.8)'; g.beginPath(); g.ellipse(mx, my2, 24, 9, -.4, 0, 7); g.fill(); }
    M.stat(`剩 <b>${Math.max(0, Math.ceil(left))}</b> 秒　落葉還有 <b>${leaves.length}</b> 片`);
    window.__sweep = { leaves, done };
    requestAnimationFrame(loop);
  };
  loop();
}

export function initJobs(api) { A = api; build(); }
