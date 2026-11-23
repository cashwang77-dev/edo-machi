// 釣魚（隅田川棧橋）、魚河岸賣魚、搬貨打工
import { FISH, rollFish } from './kashi.js?v=202611232221';
let A, GEN = 0; // GEN：每開一次小遊戲 +1，舊的畫面迴圈自動停止
const $ = s => document.querySelector(s);
const stars = r => r ? '★'.repeat(r) : '—';

export function initFishing(api) {
  A = api;
  A.P.addDexCat('fish', '🐟 魚', FISH.filter(f => f[3] > 0).map(f => ({ k: f[0], n: f[1], zh: f[2] })));
}

// ---- 釣魚 ----
// 拋竿 → 等浮標下沉（有假咬）→ 「！」時點一下 → 收線：按住拉、放開鬆，張力保持在綠區，進度滿就釣上來
export function playFish() {
  const M = A.gameModal('🎣 隅田川釣魚', '點一下拋竿。浮標沉下去出現「！」時馬上點，再按住收線、放開鬆線，讓張力保持在綠色區域。');
  const g = M.g, night = A.isNight(), my = ++GEN;
  let st = 'cast', t = 0, wait = 0, fake = [], fish = null, ten = .3, prog = .25, hold = false, surge = 0, sT = 0, msg = '', last = performance.now(), run = true, ripple = [];
  const reset = () => { st = 'cast'; t = 0; fish = null; ten = .3; prog = .25; };
  M.cv.onpointerdown = e => { e.preventDefault(); hold = true;
    if (st === 'cast') { st = 'wait'; t = 0; wait = 2 + Math.random() * 4.5; fake = [Math.random() * wait * .8, Math.random() * wait * .8].filter(() => Math.random() < .6); A.SND.pluck(330, .06); ripple.push({ x: 180, y: 120, t: 1 }); }
    else if (st === 'bite') { fish = rollFish(night); st = 'reel'; t = 0; ten = .45; prog = .3; A.SND.pluck(880, .06); }
    else if (st === 'wait') { msg = '太早了！魚被嚇跑了'; st = 'miss'; t = 0; }
    else if (st === 'done' || st === 'miss') { if (t > .6) reset(); } };
  M.cv.onpointerup = M.cv.onpointerleave = () => { hold = false; };
  const close = M.close; M.close = () => { run = false; close(); };
  const loop = () => {
    if (!run || my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return;
    const now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now; t += dt;
    // 水面
    const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, night ? '#1a2a44' : '#7ab8d8'); gr.addColorStop(1, night ? '#0c1626' : '#2f6a8a'); g.fillStyle = gr; g.fillRect(0, 0, 360, 240);
    g.strokeStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 9; i++) { const y = 30 + i * 24, o = Math.sin(now / 700 + i) * 18; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(120, y - 6 + o * .2, 240, y + 6, 360, y); g.stroke(); }
    if (night) { g.fillStyle = 'rgba(255,200,120,.5)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(30 + i * 75, 14 + (i % 2) * 6, 3, 0, 7); g.fill(); } }
    for (const r of ripple) { r.t -= dt; g.strokeStyle = `rgba(255,255,255,${Math.max(0, r.t)})`; g.beginPath(); g.ellipse(r.x, r.y, 40 * (1 - r.t) + 4, 14 * (1 - r.t) + 2, 0, 0, 7); g.stroke(); } ripple = ripple.filter(r => r.t > 0);
    // 浮標
    let by = 120;
    if (st === 'wait') { by += Math.sin(now / 300) * 2; for (const f of fake) if (t > f && t < f + .25) by += 5; if (t > wait) { st = 'bite'; t = 0; A.SND.pluck(1200, .05); ripple.push({ x: 180, y: 128, t: 1 }); } }
    if (st === 'bite') { by += 12; if (t > .85) { st = 'miss'; t = 0; msg = '慢了一步，魚溜走了…'; } }
    if (st !== 'reel') {
      g.strokeStyle = 'rgba(240,240,240,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(360, 0); g.quadraticCurveTo(260, 40, 180, by - 10); g.stroke();
      if (st !== 'cast') { g.fillStyle = '#e8322a'; g.beginPath(); g.ellipse(180, by - 6, 5, 7, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(180, by + 1, 5, 4, 0, 0, 7); g.fill(); }
      if (st === 'bite') { g.fillStyle = '#ffde4a'; g.font = '900 54px sans-serif'; g.textAlign = 'center'; g.fillText('！', 180, 70); }
    }
    // 收線
    if (st === 'reel') {
      const r = fish[3], pow = .25 + r * .12; sT -= dt; if (sT <= 0) { surge = (Math.random() < .5 ? 1 : .2) * pow; sT = .5 + Math.random() * 1.2; }
      ten += ((hold ? .75 : -.85) + surge * (Math.random() * 2 - .4)) * dt; ten = Math.max(0, ten);
      const lo = .32, hi = .72 - r * .03, inZ = ten > lo && ten < hi;
      prog += (inZ ? .16 - r * .012 : -.1) * dt;
      // 魚影
      const fx = 180 + Math.sin(now / (380 - r * 30)) * (60 + r * 10), fy = 150 + Math.cos(now / 520) * 25;
      g.fillStyle = 'rgba(10,20,30,.45)'; g.beginPath(); g.ellipse(fx, fy, 16 + r * 4, 7 + r, Math.sin(now / 380) * .5, 0, 7); g.fill();
      g.strokeStyle = 'rgba(240,240,240,.8)'; g.beginPath(); g.moveTo(360, 0); g.lineTo(fx, fy); g.stroke();
      // 張力條
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(16, 30, 22, 180); g.fillStyle = 'rgba(80,200,120,.75)'; g.fillRect(16, 210 - hi * 180, 22, (hi - lo) * 180);
      g.fillStyle = ten > .92 ? '#ff3a2a' : '#fff'; g.fillRect(12, 210 - Math.min(1, ten) * 180 - 2, 30, 4);
      g.fillStyle = '#fff'; g.font = '700 11px sans-serif'; g.textAlign = 'center'; g.fillText('張力', 27, 24);
      // 進度
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(60, 216, 280, 12); g.fillStyle = '#ffd45a'; g.fillRect(60, 216, 280 * Math.max(0, Math.min(1, prog)), 12);
      if (ten >= 1) { st = 'miss'; t = 0; msg = '線斷了！拉太用力了'; A.SND.pluck(200, .1); }
      else if (prog <= 0) { st = 'miss'; t = 0; msg = '魚掙脫跑掉了…'; }
      else if (prog >= 1) { st = 'done'; t = 0; caught(fish); }
    }
    if (st === 'done' && fish) { g.fillStyle = 'rgba(255,248,230,.92)'; g.fillRect(70, 60, 220, 110); g.fillStyle = '#3a2a1a'; g.textAlign = 'center'; g.font = '900 24px sans-serif'; g.fillText(fish[1], 180, 98); g.font = '600 13px sans-serif'; g.fillText(`${fish[2]}　${stars(fish[3])}`, 180, 122); g.fillText(fish[3] ? `可賣 ${fish[4]} 文` : '……是垃圾', 180, 144); g.fillText('點一下再拋竿', 180, 162); }
    if (st === 'miss') { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(60, 90, 240, 50); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 15px sans-serif'; g.fillText(msg, 180, 112); g.font = '12px sans-serif'; g.fillText('點一下再拋竿', 180, 130); }
    window.__fish = { st, ten, prog, msg, t: +t.toFixed(2), wait: +wait.toFixed(2), n: (window.__fish?.n || 0) + 1 };
    const cnt = Object.values(A.P.bag('fish')).reduce((a, b) => a + b, 0);
    M.stat(`${st === 'cast' ? '👉 點水面拋竿' : st === 'wait' ? '等魚上鉤…（別急著點）' : st === 'bite' ? '<b style="color:#c8322a">現在！快點！</b>' : st === 'reel' ? '按住收線、放開鬆線' : ''}　魚籠：<b>${cnt}</b> 條${night ? '　🌙 夜釣' : ''}`);
    requestAnimationFrame(loop);
  };
  loop();
}
function caught(f) {
  A.G.me.emoji(f[3] >= 4 ? '🤩' : f[3] ? '🐟' : '😅'); A.SND.pluck(f[3] >= 4 ? 1320 : 990, .12);
  if (f[3] === 0) { A.toast(`釣到了……「${f[1]}」`, 2200); A.P.addXp(2); return; }
  A.P.bagAdd('fish', f[0]); A.P.ev('fish', { k: f[0], r: f[3] });
  if (f[3] >= 5) A.announceSelf(`釣到了稀有的「${f[1]}」！`, '隅田川');
}

// ---- 魚河岸：賣魚 ----
export function openMarket() {
  const b = A.P.bag('fish'), keys = Object.keys(b).filter(k => b[k] > 0);
  const p = $('#panel'); const tot = keys.reduce((a, k) => a + FISH.find(f => f[0] === k)[4] * b[k], 0);
  p.innerHTML = `<h2>魚河岸<small>魚問屋 辰五郎</small></h2><p class="sub">「喲！今天釣到什麼好貨？」${A.isNight() ? '（夜裡收購價一樣）' : ''}</p>
    ${keys.length ? `<div class="mlist">${keys.map(k => { const f = FISH.find(x => x[0] === k); return `<div class="mrow"><span>${f[1]} <small>${f[2]} ${stars(f[3])}</small></span><span>×${b[k]}</span><span>${f[4]} 文</span><button data-s="${k}">賣 1</button></div>`; }).join('')}</div>
    <div class="btns"><button id="mAll" class="big">💰 全部賣掉（${tot} 文）</button></div>` : '<p class="sub">魚籠是空的。去旁邊的棧橋釣魚吧！</p>'}
    <div class="btns"><button id="mJob" class="big alt">📦 搬貨打工（一趟約 30 秒）</button></div><button class="close" id="mX">✕</button>`;
  A.show('#panel'); $('#mX').onclick = A.closePanels;
  p.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { sell({ [x.dataset.s]: 1 }); openMarket(); });
  if ($('#mAll')) $('#mAll').onclick = () => { sell({ ...b }); openMarket(); };
  $('#mJob').onclick = () => { A.closePanels(); playJob(); };
}
function sell(o) {
  let sum = 0, n = 0; for (const k in o) { const f = FISH.find(x => x[0] === k); if (!f) continue; sum += f[4] * o[k]; n += o[k]; A.P.bagAdd('fish', k, -o[k]); }
  if (!n) return; A.addMoney(sum, `賣魚 ${n} 條`); A.P.ev('sell', { n, sum }); A.SND.coin && A.SND.coin(1);
}

// ---- 打工：搬貨（魚箱從左邊滑過來，進到框框時點一下放上推車）----
export function playJob() {
  const M = A.gameModal('📦 魚河岸搬貨', '魚箱滑進黃框時點一下，把它搬上推車！放錯位置會掉地上。搬 10 箱領工錢。');
  const g = M.g, my = ++GEN; let boxes = [], spawn = 0, ok = 0, bad = 0, done = 0, last = performance.now(), run = true, flash = 0, sp = 90;
  const close = M.close; M.close = () => { run = false; close(); };
  M.cv.onpointerdown = e => { e.preventDefault(); if (!run || done >= 10) return; const b = boxes.find(b => !b.hit && b.x > 40 && b.x < 330); if (!b) return; b.hit = true; done++;
    if (Math.abs(b.x - 250) < 26) { ok++; b.good = true; A.SND.pluck(880, .05); } else { bad++; b.good = false; A.SND.pluck(220, .08); flash = .3; }
    if (done >= 10) finish(); };
  const finish = () => { setTimeout(() => { if (!run || !M.cv.isConnected) return; M.close(); const pay = ok * 6 + (ok === 10 ? 20 : 0); if (pay) A.addMoney(pay, `搬貨工錢${ok === 10 ? '（全對加給）' : ''}`); A.P.ev('job', { k: 'kashi', ok }); A.toast(`搬好 ${ok} / 10 箱${ok === 10 ? '，辰五郎：「好樣的！」' : ''}`, 3000); A.G.me.emoji(ok >= 8 ? '💪' : '😓'); }, 700); };
  const loop = () => {
    if (!run || my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return;
    const now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now;
    spawn -= dt; if (spawn <= 0 && boxes.filter(b => !b.hit).length < 3 && done + boxes.filter(b => !b.hit).length < 10) { boxes.push({ x: -30, hit: false, y: 150 }); spawn = .9 + Math.random() * .8; sp = 90 + done * 9; }
    g.fillStyle = '#d8c8a0'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#8a6a44'; g.fillRect(0, 168, 360, 14); // 輸送台
    for (let x = (now / 10) % 30 - 30; x < 360; x += 30) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, 168, 3, 14); }
    g.strokeStyle = '#e8b82a'; g.lineWidth = 3; g.strokeRect(222, 118, 56, 52); // 黃框
    g.fillStyle = '#6a4a2a'; g.fillRect(212, 190, 80, 20); g.beginPath(); g.arc(225, 214, 9, 0, 7); g.arc(280, 214, 9, 0, 7); g.fill(); // 推車
    for (const b of boxes) { if (!b.hit) { b.x += sp * dt; if (b.x > 380) { b.hit = true; b.good = false; done++; bad++; if (done >= 10) finish(); } } else if (b.good) { b.y += (180 - b.y) * dt * 8; } else { b.y += 160 * dt; }
      if (b.y > 260) continue; g.fillStyle = '#a8784a'; g.fillRect(b.x - 22, b.y - 20, 44, 32); g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; g.strokeRect(b.x - 22, b.y - 20, 44, 32); g.fillStyle = '#7aa8c8'; g.fillRect(b.x - 14, b.y - 12, 28, 6); }
    boxes = boxes.filter(b => b.y < 260 && !(b.good && Math.abs(b.y - 180) < 1 && b.hit && (b.gone = (b.gone || 0) + dt) > .4));
    if (flash > 0) { flash -= dt; g.fillStyle = `rgba(220,40,30,${flash})`; g.fillRect(0, 0, 360, 240); }
    M.stat(`搬好 <b>${ok}</b>　失誤 ${bad}　進度 ${done} / 10　（一箱 6 文，全對加 20 文）`);
    requestAnimationFrame(loop);
  };
  loop();
}
