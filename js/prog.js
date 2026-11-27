// 町人帳：個人進度（等級／稱號、每日簽到、町人委託、圖鑑、存檔備份）
// 存在瀏覽器 localStorage（edo_save_<暱稱>），另可匯出／匯入備份碼
import { SHOPS, ACC } from './shops.js?v=202611271504';

let A = null; // game.js 傳進來的介面
let S = null; // 目前存檔
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---- 日期（台灣時間）----
export const today = (off = 0) => new Date(Date.now() + 8 * 3600e3 + off * 86400e3).toISOString().slice(0, 10);

// ---- 等級與稱號 ----
const need = lv => 40 + lv * 30;                       // lv → lv+1 需要的經驗
export const TITLES = [[1, '見習い', '剛來到江戶的新面孔'], [3, '町人', '街坊都叫得出你的名字'], [5, '一人前', '能獨當一面的江戶人'], [8, '腕利き', '手藝了得，口碑漸開'],
  [12, '親方', '帶得動徒弟的老手'], [16, '名人', '連大名都聽過你的名號'], [20, '江戸っ子', '道地的江戶人，粋！'], [30, '江戸の顔', '提到江戶，就會想到你']];
export const titleOf = lv => { let t = TITLES[0]; for (const x of TITLES) if (lv >= x[0]) t = x; return t; };

// ---- 圖鑑資料 ----
const DEX_DISH = SHOPS.flatMap(s => (s.menu || []).filter(m => m.dish).map(m => ({ k: s.id + ':' + m.id, n: m.n, zh: m.zh, from: s.name })));
const DEX_ACC = ACC.map(a => ({ k: a.id, n: a.n, zh: a.zh }));
let DEX_SPOT = [];
export const DEX = { dish: ['🍱 料理', () => DEX_DISH], acc: ['🎐 飾品', () => DEX_ACC], spot: ['🏯 名所', () => DEX_SPOT] };
export function addDexCat(key, label, list) { DEX[key] = [label, () => list]; if (S) S.dex[key] = S.dex[key] || {}; } // 之後的釣魚／作物／採集用

// ---- 委託 ----
const NPCN = ['八百屋のお松', '大工の熊吉', '魚屋の辰', '飛脚の源太', '茶屋娘のお花', '隠居の宗右衛門', '寺子屋の先生', '髪結いのお梅', '番頭の与兵衛', '火消しの鉄'];
const QPOOL = [
  { id: 'cook', ev: 'cook', n: [2, 3], t: n => `在任一家店當老闆，做 ${n} 道料理`, rew: [50, 30] },
  { id: 'eat', ev: 'eat', n: [1, 2], t: n => `吃掉 ${n} 份料理`, rew: [30, 20] },
  { id: 'spot', ev: 'spot', n: [1], pick: 'spot', t: (n, x) => `去名所「${x}」看看`, rew: [40, 25] },
  { id: 'play', ev: 'play', n: [1, 2], t: n => `玩 ${n} 次祭典攤位遊戲`, rew: [40, 25] },
  { id: 'deer', ev: 'deer', n: [2, 3], t: n => `摸摸東光寺的小鹿 ${n} 次`, rew: [30, 20] },
  { id: 'pray', ev: 'pray', n: [1], t: () => `到神社或東光寺參拜一次`, rew: [30, 20] },
  { id: 'ride', ev: 'ride', n: [1], t: () => `搭一趟人力車`, rew: [40, 25] },
  { id: 'buy', ev: 'buy', n: [1], t: () => `買一件衣服、髮型或飾品`, rew: [40, 25] },
  { id: 'fish', ev: 'fish', n: [2, 3], t: n => `在隅田川棧橋釣到 ${n} 條魚`, rew: [45, 30] },
  { id: 'sell', ev: 'sell', n: [1], t: () => `到魚河岸賣一次魚`, rew: [30, 20] },
  { id: 'job', ev: 'job', n: [1, 2], t: n => `打工 ${n} 次（魚河岸搬貨等）`, rew: [40, 25] },
  { id: 'mat', ev: 'mat', n: [2, 3], t: n => `到新開地的建材店買 ${n} 件建材`, rew: [30, 20], cond: S => S.home && S.home.stage < 6 },
  { id: 'build', ev: 'build', n: [1], t: () => `完成一道蓋房子的工序`, rew: [60, 35], cond: S => S.home && S.home.stage < 6 },
  { id: 'deco', ev: 'furn', n: [1], t: () => `到萬屋買一件家具`, rew: [40, 25], cond: S => S.home && S.home.stage >= 6 },
  { id: 'show', ev: 'show', n: [1], t: () => `到花街金波楼的舞台欣賞藝妓舞蹈`, rew: [40, 25] },
  { id: 'ozashiki', ev: 'ozashiki', n: [1, 2], t: n => `在金波楼玩 ${n} 次お座敷遊び`, rew: [50, 30] },
  { id: 'plant', ev: 'plant', n: [1, 2], t: n => `在郊外農村的田裡播種 ${n} 次`, rew: [35, 20] },
  { id: 'crop', ev: 'crop', n: [1], t: () => `收成一次作物`, rew: [50, 30], cond: S => (S.stats.plant || 0) > 0 },
  { id: 'sellveg', ev: 'sellveg', n: [1], t: () => `到八百屋賣一次菜`, rew: [30, 20], cond: S => (S.stats.crop || 0) > 0 },
  { id: 'bath', ev: 'bath', n: [1, 2], t: n => `到湯の郷泡 ${n} 次溫泉`, rew: [40, 25] },
  { id: 'gather', ev: 'gather', n: [2, 3], t: n => `在湯の郷山邊採集 ${n} 次山貨`, rew: [45, 30] },
  { id: 'night', ev: 'night', n: [1], t: () => `晚上到隅田川河岸的夜市買一樣東西`, rew: [40, 25] },
  { id: 'photo', ev: 'photo', n: [1], t: () => `拍一張紀念照（玩家卡片或 📷）`, rew: [30, 20] },
  { id: 'order', ev: 'get', n: [1], pick: 'shop', t: (n, x, nm) => `到「${nm}」點一份餐`, rew: [35, 20] },
];
const QEXTRA = []; export function addQuest(q) { QEXTRA.push(q); }
function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeQuests() {
  const r = rng(today() + '|' + A.G.name), pool = [...QPOOL, ...QEXTRA].filter(q => !(q.pick === 'spot' && !DEX_SPOT.length) && (!q.minLv || S.lv >= q.minLv) && (!q.cond || q.cond(S))), out = [];
  while (out.length < 3 && pool.length) {
    const q = pool.splice(Math.floor(r() * pool.length), 1)[0]; const n = q.n[Math.floor(r() * q.n.length)];
    let x = '', nm = '';
    if (q.pick === 'spot') x = DEX_SPOT[Math.floor(r() * DEX_SPOT.length)].k;
    if (q.pick === 'shop') { const sh = SHOPS.filter(s => !s.play && !s.service && (s.menu || []).some(m => m.dish)); const s = sh[Math.floor(r() * sh.length)]; x = s.id; nm = s.name; }
    if (q.pick && typeof q.pick === 'function') [x, nm] = q.pick(r);
    out.push({ id: q.id, ev: q.ev, x, need: n, have: 0, t: q.t(n, x, nm), from: NPCN[Math.floor(r() * NPCN.length)], rew: q.rew, done: false, got: false });
  }
  return out;
}

// ---- 存檔 ----
const key = () => 'save_' + (A.G.name || '');
const blank = () => ({ v: 1, bag: {}, xp: 0, lv: 1, daily: { last: '', streak: 0 }, q: { date: '', list: [], bonus: false }, dex: {}, stats: {}, made: today() });
function load() { S = Object.assign(blank(), A.store.get(key(), {})); for (const k in DEX) S.dex[k] = S.dex[k] || {}; }
export function save() { if (S && A.G.name) A.store.set(key(), S); }
export const prog = () => S;
// 道具袋（魚、作物、建材…）
export function bag(cat) { if (!S) return {}; S.bag = S.bag || {}; return S.bag[cat] = S.bag[cat] || {}; }
export function bagAdd(cat, k, n = 1) { const b = bag(cat); b[k] = (b[k] || 0) + n; if (b[k] <= 0) delete b[k]; save(); }

// ---- 經驗 ----
export function addXp(n, why) {
  if (!S || !n) return; S.xp += n; let up = false;
  while (S.xp >= need(S.lv)) { S.xp -= need(S.lv); S.lv++; up = true;
    const rew = S.lv * 30; A.addMoney(rew, `升級獎勵`);
    const t = titleOf(S.lv), nt = TITLES.find(x => x[0] === S.lv);
    A.announceSelf(`升到 Lv.${S.lv}！${nt ? `獲得稱號「${t[1]}」` : ''}`, '町人帳'); A.G.me.emoji('🎉'); A.sfx(660, .2); setTimeout(() => A.sfx(990, .3), 160); setTimeout(() => A.sfx(1320, .4), 320);
    A.onLevel && A.onLevel(S.lv);
  }
  const f = document.createElement('div'); f.className = 'coin xp'; f.textContent = `+${n} 經驗${why ? '　' + why : ''}`; $('#hud').appendChild(f); setTimeout(() => f.remove(), 1800);
  save(); hud();
}

// ---- 事件 ----
// cook{item,q,shop} eat{id} get{item,shop} buy{} spot{k} play{k} deer pray ride acc{id} fish{k} crop{k} gather{k}
const XP = { friend: 15, visit: 3, duel: 8, photo: 2, bath: 3, pingpong: 4, plant: 3, water: 1, sellveg: 4, ozashiki: 4, build: 5, mat: 1, furn: 3, deco: 2, sell: 4, job: 10, cook: 10, eat: 5, get: 3, buy: 6, spot: 4, play: 8, deer: 3, pray: 5, ride: 6, fish: 8, crop: 10, gather: 6, night: 6, home: 2 };
export const EVL = []; // 事件監聽（新手之路）
export function ev(type, d = {}) {
  for (const f of EVL) try { f(type, d); } catch (e) { }
  if (!S) return;
  S.stats[type] = (S.stats[type] || 0) + 1;
  let xp = XP[type] || 0; if (type === 'cook' && d.q >= 85) xp += 6; else if (type === 'cook' && d.q >= 60) xp += 3;
  // 圖鑑
  const dexKey = d.dex || { get: 'dish', eat: 'dish', spot: 'spot', acc: 'acc', fish: 'fish', crop: 'crop', gather: 'gather', dish: 'dish' }[type];
  let k = d.k; if (type === 'get' && d.item && d.item.dish) k = d.shop + ':' + d.item.id; if (type === 'eat') k = d.id; if (type === 'acc') k = d.id;
  if (dexKey && DEX[dexKey]) S.dex[dexKey] = S.dex[dexKey] || {};
  if (dexKey && k && S.dex[dexKey] && !S.dex[dexKey][k] && DEX[dexKey][1]().some(e => e.k === k)) {
    S.dex[dexKey][k] = today(); xp += 15; A.toast(`📖 圖鑑登錄：${DEX[dexKey][1]().find(e => e.k === k).n}`, 2600); checkDexDone(dexKey);
  }
  // 委託
  dailyCheck();
  for (const q of S.q.list) {
    if (q.done || q.ev !== type) continue;
    if (q.id === 'spot' && d.k !== q.x) continue;
    if (q.id === 'order' && d.shop !== q.x) continue;
    if (q.match && !q.match(d)) continue;
    if (q.x && q.ev !== 'spot' && q.ev !== 'get' && d.k && q.x !== d.k) continue;
    q.have++; if (q.have >= q.need) { q.done = true; A.toast(`📜 委託完成：${q.t}（打開町人帳領獎）`, 3500); A.sfx(880, .2); }
  }
  if (xp && A.together && !['friend', 'acc'].includes(type)) { const t = A.together(); if (t.length) xp = Math.round(xp * 1.5); } // 同樂加成
  if (xp) addXp(xp); else { save(); hud(); }
}
function checkDexDone(cat) {
  const all = DEX[cat][1](), got = all.filter(e => S.dex[cat][e.k]).length;
  if (got === all.length && all.length && !(S.dexDone || {})[cat]) { S.dexDone = { ...(S.dexDone || {}), [cat]: today() }; A.addMoney(300, `${DEX[cat][0]} 圖鑑全收集`); addXp(150); A.announceSelf(`${DEX[cat][0]} 圖鑑全部收集完成！`, '町人帳'); }
}

// ---- 每日 ----
function dailyCheck() {
  if (S.q.date !== today()) { S.q = { date: today(), list: makeQuests(), bonus: false }; save(); }
}
export function loginCheck() {
  dailyCheck();
  if (S.daily.last === today()) return false;
  return true; // 今天還沒簽到
}
function claimLogin() {
  if (S.daily.last === today()) return;
  S.daily.streak = S.daily.last === today(-1) ? S.daily.streak + 1 : 1; S.daily.last = today();
  const d = ((S.daily.streak - 1) % 7) + 1, money = [20, 30, 40, 50, 60, 80, 100][d - 1];
  A.addMoney(money, `第 ${S.daily.streak} 天簽到`); addXp(10 + d * 2);
  if (d === 7) { const own = A.invGet(); const cand = ACC.filter(a => !own.includes(a.id) && !a.prize); const a = cand[Math.floor(Math.random() * cand.length)]; if (a) A.prizeAcc(a.id, `連續簽到 7 天！獲得「${a.n}」`); }
  A.sfx(990, .2); save(); open('day');
}
function claimQuest(i) {
  const q = S.q.list[i]; if (!q || !q.done || q.got) return; q.got = true;
  A.addMoney(q.rew[0], `委託：${q.from}`); addXp(q.rew[1]);
  if (!S.q.bonus && S.q.list.every(x => x.got)) { S.q.bonus = true; A.addMoney(60, '今日委託全部完成'); addXp(40); A.G.me.emoji('🎊'); }
  save(); open('day');
}

// ---- 備份碼 ----
function exportCode() {
  const o = { n: A.G.name, s: S, m: A.G.money, i: A.invGet(), l: A.G.look, x: A.extraSave ? A.extraSave() : null };
  const json = JSON.stringify(o); let sum = 0; for (const c of json) sum = (sum * 31 + c.charCodeAt(0)) >>> 0;
  return 'EDO1-' + btoa(unescape(encodeURIComponent(json))) + '-' + sum.toString(36);
}
function importCode(code) {
  const m = /^EDO1-([A-Za-z0-9+/=]+)-([a-z0-9]+)$/.exec(code.replace(/\s+/g, '')); if (!m) return '備份碼格式不對';
  let json; try { json = decodeURIComponent(escape(atob(m[1]))); } catch (e) { return '備份碼無法解讀'; }
  let sum = 0; for (const c of json) sum = (sum * 31 + c.charCodeAt(0)) >>> 0; if (sum.toString(36) !== m[2]) return '備份碼不完整（可能少複製了一段）';
  const o = JSON.parse(json); S = Object.assign(blank(), o.s); for (const k in DEX) S.dex[k] = S.dex[k] || {};
  save(); A.setMoney(o.m || 0); A.store.set('inv_' + A.G.name, o.i || []); if (o.l) { A.G.look = o.l; A.G.me.setLook(o.l); A.store.set('look', o.l); }
  if (o.x && A.extraLoad) A.extraLoad(o.x);
  hud(); return '';
}

// ---- HUD 與面板 ----
export function hud() {
  if (!S) return; const t = titleOf(S.lv), el = $('#lvchip'); if (!el) return;
  const dot = S.daily.last !== today() || S.q.list.some(q => q.done && !q.got);
  el.innerHTML = `📜 Lv.${S.lv} ${t[1]}<i style="width:${Math.round(S.xp / need(S.lv) * 100)}%"></i>${dot ? '<b class="dot"></b>' : ''}`;
}
let tab = 'day';
export function open(t) {
  if (!S) return; tab = t || tab; dailyCheck(); const m = $('#prog'); const c = m.querySelector('.card');
  const tabs = [['day', '今日'], ['fr', '友帳'], ['dex', '圖鑑'], ['rank', '等級'], ['save', '存檔']];
  let h = `<button class="close" data-close>✕</button><h3>📜 町人帳 <small>${esc(A.G.name)}</small></h3><div class="ptabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  if (tab === 'day') {
    const d = S.daily.last === today() ? ((S.daily.streak - 1) % 7) + 1 : (S.daily.last === today(-1) ? (S.daily.streak % 7) + 1 : 1);
    h += `<div class="psec"><h4>🗓 每日簽到 <small>連續 ${S.daily.last === today() || S.daily.last === today(-1) ? S.daily.streak : 0} 天</small></h4><div class="stamps">${[20, 30, 40, 50, 60, 80, 100].map((v, i) => `<span class="${i + 1 < d || (i + 1 === d && S.daily.last === today()) ? 'got' : i + 1 === d ? 'now' : ''}">${i + 1}<br><small>${i === 6 ? '🎁' : v + '文'}</small></span>`).join('')}</div>
      ${S.daily.last === today() ? '<p class="sub">今天已經簽到了，明天再來！</p>' : '<button class="big" id="pLogin">🖌 簽到領獎</button>'}</div>`;
    h += `<div class="psec"><h4>📮 今日町人委託 <small>每天台灣時間 0 點更新</small></h4>${S.q.list.map((q, i) => `<div class="quest ${q.got ? 'got' : q.done ? 'done' : ''}"><div><b>${esc(q.t)}</b><small>委託人：${esc(q.from)}　獎勵 ${q.rew[0]} 文＋${q.rew[1]} 經驗</small></div><span>${q.got ? '✔ 已領' : q.done ? `<button data-q="${i}">領獎</button>` : `${q.have}/${q.need}`}</span></div>`).join('')}
      <p class="sub">${S.q.bonus ? '🎊 今天的委託全部完成了！' : '三個委託全部完成再加 60 文＋40 經驗'}</p></div>`;
  } else if (tab === 'fr') {
    h += A.friendsHtml ? A.friendsHtml() : '';
  } else if (tab === 'dex') {
    for (const k in DEX) { const [lb, f] = DEX[k], all = f(); if (!all.length) continue; S.dex[k] = S.dex[k] || {}; const got = all.filter(e => S.dex[k][e.k]).length;
      h += `<div class="psec"><h4>${lb} <small>${got} / ${all.length}（${Math.round(got / all.length * 100)}%）${(S.dexDone || {})[k] ? '　✨全收集' : ''}</small></h4><div class="dex">${all.map(e => S.dex[k][e.k] ? `<span title="${esc(e.zh || '')}${e.from ? '・' + esc(e.from) : ''}">${esc(e.n)}</span>` : `<span class="no">？？？</span>`).join('')}</div></div>`; }
    h += `<p class="sub">第一次吃到／得到／造訪就會登錄，每登錄一項 +15 經驗；整類收集完送 300 文。</p>`;
  } else if (tab === 'rank') {
    const t = titleOf(S.lv);
    h += `<div class="psec"><h4>Lv.${S.lv}「${t[1]}」</h4><p class="sub">${t[2]}</p><div class="xpbar"><i style="width:${Math.round(S.xp / need(S.lv) * 100)}%"></i><span>${S.xp} / ${need(S.lv)} 經驗</span></div></div>
      <div class="psec"><h4>稱號</h4><div class="titles">${TITLES.map(x => `<span class="${S.lv >= x[0] ? 'got' : ''}"><b>${x[1]}</b><small>Lv.${x[0]}</small></span>`).join('')}</div></div>
      <div class="psec"><h4>紀錄</h4><div class="stats">${[['cook', '做菜'], ['eat', '吃東西'], ['job', '打工'], ['sell', '賣魚'], ['build', '施工'], ['furn', '買家具'], ['show', '看舞蹈'], ['ozashiki', 'お座敷遊び'], ['plant', '播種'], ['visit', '拜訪'], ['duel', '對決'], ['photo', '拍照'], ['bath', '泡湯'], ['gather', '採集'], ['night', '逛夜市'], ['buy', '買衣飾'], ['play', '玩攤位'], ['pray', '參拜'], ['ride', '搭人力車'], ['deer', '摸小鹿'], ['fish', '釣魚'], ['crop', '收成'], ['gather', '採集']].filter(([k]) => S.stats[k] || ['cook', 'eat'].includes(k)).map(([k, n]) => `<span>${n}<b>${S.stats[k] || 0}</b></span>`).join('')}</div></div>
      <p class="sub">做任何事都有經驗：做菜、吃東西、逛名所、完成委託…升級會發獎勵金。</p>`;
  } else if (tab === 'save') {
    h += `<div class="psec"><h4>💾 存檔</h4><p class="sub">進度自動存在這台裝置的瀏覽器（以暱稱「${esc(A.G.name)}」區分）。<b>清除瀏覽器資料、換手機或換瀏覽器</b>會讀不到，請先複製備份碼存起來（例如傳給自己的 LINE）。</p>
      <button class="big" id="pExp">📋 複製備份碼</button><textarea id="pCode" rows="3" placeholder="在新裝置貼上備份碼，再按「匯入」" style="width:100%;margin-top:10px"></textarea><button id="pImp">📥 匯入備份碼（會覆蓋目前進度）</button><p class="sub" id="pMsg"></p></div>`;
  }
  c.innerHTML = h; m.classList.remove('hide');
  c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => open(b.dataset.t));
  c.querySelector('[data-close]').onclick = () => m.classList.add('hide');
  if (tab === 'fr' && A.bindFriends) A.bindFriends(c);
  const L = c.querySelector('#pLogin'); if (L) L.onclick = claimLogin;
  c.querySelectorAll('[data-q]').forEach(b => b.onclick = () => claimQuest(+b.dataset.q));
  const E = c.querySelector('#pExp'); if (E) E.onclick = async () => { const code = exportCode(); c.querySelector('#pCode').value = code; try { await navigator.clipboard.writeText(code); c.querySelector('#pMsg').textContent = '✔ 已複製到剪貼簿，請貼到安全的地方保存'; } catch (e) { c.querySelector('#pCode').select(); c.querySelector('#pMsg').textContent = '請長按上面的文字框，全選後複製'; } };
  const I = c.querySelector('#pImp'); if (I) I.onclick = () => { const v = c.querySelector('#pCode').value.trim(); if (!v) return; const err = importCode(v); c.querySelector('#pMsg').textContent = err || '✔ 匯入完成！'; if (!err) setTimeout(() => open('rank'), 800); };
  hud();
}

// ---- 初始化 ----
export function initProg(api) {
  A = api; load();
  DEX_SPOT = (api.W.spots || []).filter(s => s.type === 'meisho').map(s => ({ k: spotKey(s.label), n: spotKey(s.label) }))
    .filter((e, i, a) => a.findIndex(x => x.k === e.k) === i);
  for (const id of api.invGet()) if (ACC.some(x => x.id === id) && !S.dex.acc[id]) S.dex.acc[id] = today(); // 舊玩家已有的飾品
  dailyCheck(); hud(); save();
  if (loginCheck() && !location.search.includes('cam=') && (location.search.includes('test') || A.store.get('guide', A.store.get('helped', false) ? 99 : 0) >= 99)) setTimeout(() => open('day'), 1800);
}
export function spotKey(label) { return (label.includes('：') ? label.split('：').pop() : label.replace(/^[^぀-鿿]+/, '')).trim(); }
