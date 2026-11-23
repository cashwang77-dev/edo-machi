// 玩家互動：友帳（好友）、緣（一起玩累積）、同樂加成、邀請朋友、拜訪別人的家、投扇興對決、紀念照
let A; const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const EN_LV = [[0, '點頭之交'], [10, '熟人'], [30, '好友'], [60, '知己'], [100, '莫逆之交']];
const enLv = en => { let k = 0; EN_LV.forEach((x, i) => { if (en >= x[0]) k = i; }); return k; };
let duel = null, lastTogether = 0;

function S() { return A.P.prog(); }
export function friends() { const s = S(); if (!s) return {}; return s.friends = s.friends || {}; }
export const isFriend = n => !!friends()[n];
function remoteByName(n) { for (const [id, R] of A.G.remotes) if (R.n === n) return [id, R]; return [null, null]; }
function send(to, k, v) { if (A.G.online) A.net.send({ t: 'act', to, k, v: v == null ? '' : String(v) }); }
function panel(html) { const p = $('#panel'); p.innerHTML = html + '<button class="close" id="soX">✕</button>'; A.show('#panel'); $('#soX').onclick = A.closePanels; return p; }

// ---- 同樂加成：身邊 10 步內有其他玩家，經驗 ×1.5；身邊的好友累積「緣」----
export function together() {
  if (!A || !A.G.online) return []; const out = [];
  for (const [, R] of A.G.remotes) { const p = R.ch.root.position; if (Math.hypot(p.x - A.G.pos.x, p.z - A.G.pos.z) < 10) out.push(R.n); }
  if (out.length) {
    const F = friends(), d = today();
    for (const n of out) if (F[n]) { const f = F[n]; if (f.day !== d) { f.day = d; f.dayN = 0; } if (f.dayN < 30) { const lv0 = enLv(f.en); f.en++; f.dayN++; const lv1 = enLv(f.en); if (lv1 > lv0) { const gift = lv1 * 40; A.addMoney(gift, `和${n}的緣升級`); A.announce(`和「${n}」的緣變成「${EN_LV[lv1][1]}」了！`, '友帳'); } } }
    if (performance.now() - lastTogether > 60000) { lastTogether = performance.now(); A.toast(`👫 和${out.slice(0, 2).join('、')}${out.length > 2 ? '等人' : ''}一起玩：經驗 +50%`, 2600); }
  }
  return out;
}

// ---- 玩家卡片上的按鈕 ----
export function cardButtons(R) {
  return `${isFriend(R.n) ? '<button data-s="unf">💔 解除好友</button>' : '<button data-s="fr">➕ 加為好友</button>'}<button data-s="duel">⚔ 投扇興對決（各押 20 文）</button><button data-s="photo">📷 一起拍照</button>`;
}
export function cardAction(k, id, R) {
  if (k === 'fr') { send(id, 'friend'); A.toast(`已向「${R.n}」送出好友邀請`); }
  if (k === 'unf') { delete friends()[R.n]; A.P.save(); A.toast(`和「${R.n}」解除好友了`); }
  if (k === 'duel') { if (duel) return A.toast('正在對決中'); if (!A.afford(20)) return A.toast('押金不夠喔'); duel = { id, n: R.n, me: null, them: null, wait: true }; send(id, 'duel', 20); A.toast(`向「${R.n}」下了戰帖，等對方回應…`, 3000); setTimeout(() => { if (duel && duel.wait) { duel = null; A.toast('對方沒有回應戰帖'); } }, 25000); }
  if (k === 'photo') photo();
}

// ---- 收到其他玩家的動作 ----
export function onAct(m) {
  const id = m.from, n = m.n;
  if (m.k === 'friend') {
    if (isFriend(n)) return send(id, 'friendok');
    const p = panel(`<h2>好友邀請</h2><p class="sub">「${esc(n)}」想和你成為朋友！成為好友後可以在友帳看到對方在哪裡，一起玩還會累積「緣」。</p><div class="btns"><button class="big" id="soY">👫 好啊</button><button id="soN">下次吧</button></div>`);
    p.querySelector('#soY').onclick = () => { addFriend(n); send(id, 'friendok'); A.closePanels(); };
    p.querySelector('#soN').onclick = () => { send(id, 'friendno'); A.closePanels(); };
  }
  if (m.k === 'friendok') { if (!isFriend(n)) { addFriend(n); } }
  if (m.k === 'friendno') A.toast(`「${n}」婉拒了好友邀請`);
  if (m.k === 'visit') { const s = S(), d = today(); s.guests = s.guests && s.guests.day === d ? s.guests : { day: d, n: 0 }; A.toast(`🔔「${n}」來你家拜訪了！`, 3500); A.SND.pluck(1320, .1); if (s.guests.n < 5) { s.guests.n++; A.addMoney(10, '客人來訪'); } A.P.save(); }
  if (m.k === 'note') { const s = S(); s.notes = [{ n, s: m.v, t: Date.now() }, ...(s.notes || [])].slice(0, 20); A.P.save(); A.toast(`✍「${n}」在你家留言：${m.v}`, 4500); }
  if (m.k === 'invjoin') { const s = S(), d = today(); s.inv = s.inv || {}; s.invDay = s.invDay && s.invDay.day === d ? s.invDay : { day: d, n: 0 };
    if (!s.inv[n] && s.invDay.n < 5) { s.inv[n] = d; s.invDay.n++; A.addMoney(100, `邀請「${n}」來江戶町`); A.announce(`「${n}」收到你的邀請來到江戶町了！`, '友帳'); } A.P.save(); }
  if (m.k === 'duel') {
    if (duel) return send(id, 'duelno', 'busy');
    const p = panel(`<h2>⚔ 戰帖</h2><p class="sub">「${esc(n)}」向你下戰帖：投扇興對決，各押 ${m.v | 0} 文，分數高的拿走全部！</p><div class="btns"><button class="big" id="soY">接受</button><button id="soN">不了</button></div>`);
    p.querySelector('#soY').onclick = () => { if (!A.afford(20)) { A.toast('押金不夠喔'); send(id, 'duelno'); return A.closePanels(); } A.closePanels(); duel = { id, n, me: null, them: null }; send(id, 'duelok'); startDuel(); };
    p.querySelector('#soN').onclick = () => { send(id, 'duelno'); A.closePanels(); };
  }
  if (m.k === 'duelok' && duel && duel.id === id) { duel.wait = false; startDuel(); }
  if (m.k === 'duelno' && duel && duel.id === id) { duel = null; A.toast(`「${n}」沒有接受對決`); }
  if (m.k === 'duelres' && duel && duel.id === id) { duel.them = +m.v; finishDuel(); }
}
function addFriend(n) { const F = friends(); if (!F[n]) { F[n] = { en: 0, since: today() }; A.P.save(); A.toast(`👫 和「${n}」成為好友了！`, 3000); A.G.me.emoji('🤝'); A.P.ev('friend'); } }
function startDuel() {
  A.addMoney(-20, '對決押金'); A.toast(`⚔ 對決開始！對手：${duel.n}`, 2500);
  A.HN.playTosenkyo(pts => { if (!duel) return; duel.me = pts; send(duel.id, 'duelres', pts); A.toast(`你得了 ${pts} 分，等對手丟完…`, 3000); finishDuel(); setTimeout(() => { if (duel && duel.them == null) { A.addMoney(20, '對手離開，退回押金'); duel = null; } }, 60000); });
}
function finishDuel() {
  if (!duel || duel.me == null || duel.them == null) return; const { me, them, n } = duel; duel = null;
  if (me > them) { A.addMoney(40, `對決勝利（${me}：${them}）`); A.announce(`投扇興對決 ${me}：${them} 贏了「${n}」！`, '對決'); A.G.me.emoji('🏆'); A.P.ev('duel', { win: true }); }
  else if (me === them) { A.addMoney(20, '平手退回押金'); A.toast(`${me}：${them} 平手！`); A.P.ev('duel', { win: false }); }
  else { A.toast(`${me}：${them} 輸給了「${n}」……下次再來！`, 3000); A.G.me.emoji('😣'); A.P.ev('duel', { win: false }); }
}

// ---- 拜訪別人的家 ----
export function visitPanel(id, n, i) {
  const s = S(), key = n + '|' + today(); s.visited = s.visited || {};
  const p = panel(`<h2>${esc(n)} の家<small>建地 ${i + 1} 號</small></h2><p class="sub">按門鈴打聲招呼，或在門口留一句話（30 字以內）。</p>
    <div class="btns"><button class="big" id="soB">🔔 按門鈴拜訪</button></div><input id="soNote" maxlength="30" placeholder="留言給屋主…" style="width:100%;margin-top:8px"><div class="btns"><button id="soW">✍ 留言</button></div>`);
  p.querySelector('#soB').onclick = () => { send(id, 'visit'); A.SND.pluck(1320, .1); A.G.me.emoji('🔔'); if (!s.visited[key]) { s.visited[key] = 1; A.P.addXp(10, `拜訪${n}家`); A.P.save(); } A.P.ev('visit'); A.toast(`按了「${n}」家的門鈴`); };
  p.querySelector('#soW').onclick = () => { const v = p.querySelector('#soNote').value.trim().slice(0, 30); if (!v) return; send(id, 'note', v); A.toast('留言送出了'); A.closePanels(); };
}

// ---- 友帳（町人帳的分頁內容）----
export function friendsHtml() {
  const F = friends(), names = Object.keys(F);
  const rooms = A.whoRooms(), where = {}; if (rooms) for (const [r, l] of Object.entries(rooms)) for (const q of l) where[q.n] = A.roomName(r);
  const row = n => { const f = F[n], [rid] = remoteByName(n), lv = enLv(f.en), nx = EN_LV[lv + 1];
    return `<div class="quest"><div><b>${esc(n)}</b> <small style="display:inline">${EN_LV[lv][1]}</small><small>緣 ${f.en}${nx ? ` / 下一級 ${nx[0]}` : ''}　${rid ? '🟢 就在這條街' : where[n] ? '🟡 在' + where[n] : '⚪ 不在線上'}</small></div><span>${rid || where[n] ? `<button data-go="${esc(n)}">🛺 去找</button>` : ''}</span></div>`; };
  const s = S(), notes = (s.notes || []).slice(0, 5);
  return `<div class="psec"><h4>👫 友帳 <small>${names.length} 位好友</small></h4>${names.length ? names.map(row).join('') : '<p class="sub">點其他玩家，選「➕ 加為好友」。和好友待在一起做事會累積「緣」，緣升級有禮物。</p>'}</div>
    <div class="psec"><h4>📨 邀請朋友 <small>朋友第一次來，兩人各得 100 文（每天最多 5 位）</small></h4><p class="sub">把邀請連結傳給朋友，他點開就會來到你這條街。</p><button class="big" id="soInv">📨 分享邀請連結</button><p class="sub" id="soInvMsg"></p></div>
    ${notes.length ? `<div class="psec"><h4>✍ 家門口的留言</h4>${notes.map(x => `<div class="quest"><div><b>${esc(x.n)}</b><small>${esc(x.s)}</small></div></div>`).join('')}</div>` : ''}
    <p class="sub">💡 身邊有其他玩家一起做事（做菜、釣魚、泡湯、看舞蹈…）經驗 +50%</p>`;
}
export function bindFriends(c) {
  if (A.G.online) A.net.send({ t: 'who' });
  c.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { A.closeProg(); A.openRide(); });
  const iv = c.querySelector('#soInv'); if (iv) iv.onclick = async () => {
    const url = `${location.origin}${location.pathname}?st=${A.G.room || 1}&inv=${encodeURIComponent(A.G.name)}`, text = `來江戶町找我玩！我在${A.roomName('edo' + (A.G.room || 1))}，暱稱「${A.G.name}」`;
    try { if (navigator.share) { await navigator.share({ title: '江戶町', text, url }); c.querySelector('#soInvMsg').textContent = '✔ 已分享'; return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text + ' ' + url); c.querySelector('#soInvMsg').textContent = '✔ 邀請連結已複製，貼給朋友吧！'; } catch (e) { c.querySelector('#soInvMsg').textContent = url; } };
}
// 被邀請的人：第一次進町（welcome 之後、町人帳準備好）
export function inviteCheck() {
  const inv = A.QS.get('inv'); if (!inv || inv === A.G.name) return; const s = S(); if (!s) return;
  if (!s.invitedBy) { s.invitedBy = inv; A.addMoney(100, `「${inv}」的邀請禮`); A.toast(`🎉 收到「${inv}」的邀請，送你 100 文！`, 4000); A.P.save(); }
  const [id] = remoteByName(inv); if (id) { send(id, 'invjoin'); if (!isFriend(inv)) send(id, 'friend'); }
}
export function onJoin(p) { if (A && isFriend(p.n)) { A.toast(`👫 好友「${p.n}」來了！`, 3500); A.SND.pluck(990, .1); } }

// ---- 紀念照 ----
export function photo() {
  const cv = A.snapshot(); if (!cv) return; const W = cv.width, H = cv.height, out = document.createElement('canvas'); out.width = W; out.height = H + Math.round(H * .13);
  const g = out.getContext('2d'), pad = Math.round(H * .13); g.fillStyle = '#f3ead6'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
  g.strokeStyle = '#b5373a'; g.lineWidth = Math.max(4, W / 160); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
  const names = [A.G.name, ...together()].slice(0, 6); const fs = Math.round(pad * .34);
  g.fillStyle = '#2a1e14'; g.font = `700 ${fs}px serif`; g.textBaseline = 'middle'; g.fillText('江戶町 Edo Machi', fs * .6, H + pad * .35);
  g.font = `${Math.round(fs * .7)}px sans-serif`; g.fillText(`${names.join('・')}　${today()}`, fs * .6, H + pad * .74);
  g.textAlign = 'right'; g.fillStyle = '#b5373a'; g.font = `700 ${Math.round(fs * .62)}px sans-serif`; g.fillText('cashkingw.blogspot.com', W - fs * .6, H + pad * .74);
  const url = out.toDataURL('image/jpeg', .9);
  const p = panel(`<h2>📷 紀念照</h2><img src="${url}" style="width:100%;border-radius:8px;border:2px solid var(--ink)"><div class="btns"><a class="big" id="soDl" download="江戶町_${today()}.jpg" href="${url}" style="text-decoration:none;text-align:center">💾 存到裝置</a><button id="soSh">📤 分享</button></div>`);
  p.querySelector('#soSh').onclick = async () => { try { const b = await (await fetch(url)).blob(), f = new File([b], 'edo-machi.jpg', { type: 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: '江戶町', text: '在江戶町拍的紀念照！' }); else A.toast('這個瀏覽器不支援直接分享，請先存到裝置'); } catch (e) {} };
  A.G.me.emoji('📷'); A.SND.pluck(1800, .05); A.P.ev('photo');
}

export function initSocial(api) { A = api; }
