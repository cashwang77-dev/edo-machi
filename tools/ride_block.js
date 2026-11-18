// ---------- 人力車：點路上的空車或按🛺叫車 → 選名所／點地圖／找玩家，車資依距離 ----------
const RIDE = { fare2: 40 };
const DEST = [['大街中央', 0, 3], ['神社', -116, 4], ['千本鳥居', -125, -30], ['名所南區', -125, 50], ['江戶城', -212, 92], ['不忍池', -122, 86], ['中村座', -166, 66], ['回向院相撲', -170, 104], ['日本橋', 106, 0], ['雷門', 158, 4], ['露天風呂', 153, 8], ['東光寺', 178, -42], ['五重塔', 155, -90], ['金閣寺', 180, 97]];
const GM_DEST = DEST;
// 路網：車夫沿著這些點跑（不會穿過房子）；邊在啟動時會自動檢查
const RN = { P: { m0: [-96, 0], m1: [-60, 0], m2: [-20, 0], m3: [20, 0], m4: [60, 0], m5: [100, 0], b0: [108, 0], b1: [142, 0], e1: [158, 0], e2: [164, 2], o0: [153, 8], e3: [164, 30], e4: [150, -20], e5: [150, -36], t0: [178, -44], t1: [178, -72], t2: [160, -74], t3: [154, -88], k0: [164, 42], k1: [150, 60], k2: [150, 97], k3: [180, 98],
  s0: [-110, 0], s1: [-119, 14], s2: [-125, 21], p0: [-125, 34], p1: [-125, 48], q0: [-125, 56], q1: [-150, 56], q2: [-160, 66], q3: [-150, 86], q4: [-166, 100], q5: [-195, 80], c0: [-204, 92], c1: [-214, 92], w0: [-122, 82], n0: [-119, -14], n1: [-125, -21], n2: [-125, -50], n3: [-125, -70] },
  E: 'm0-m1 m1-m2 m2-m3 m3-m4 m4-m5 m5-b0 b0-b1 b1-e1 e1-e2 e1-o0 e2-e3 b1-e4 e4-e5 e5-t0 t0-t1 t1-t2 t2-t3 e3-k0 k0-k1 k1-k2 k2-k3 m0-s0 s0-s1 s1-s2 s2-p0 p0-p1 p1-q0 q0-q1 q1-q2 q1-q3 q3-q4 q2-q5 q4-q5 q5-c0 c0-c1 q0-w0 s0-n0 n0-n1 n1-n2 n2-n3' };
const RN_ADJ = {}; for (const e of RN.E.split(' ')) { const [a, b] = e.split('-'); const d = Math.hypot(RN.P[a][0] - RN.P[b][0], RN.P[a][1] - RN.P[b][1]); (RN_ADJ[a] = RN_ADJ[a] || []).push([b, d]); (RN_ADJ[b] = RN_ADJ[b] || []).push([a, d]); }
const lineOK = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / .6); for (let i = 1; i < n; i++) { const t = i / n; if (!walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; } return true; };
function nearNode(p) { // 最近、而且直線過去不會穿牆的路網點
  const L = Object.entries(RN.P).map(([k, [x, z]]) => [k, Math.hypot(x - p.x, z - p.z), x, z]).sort((a, b) => a[1] - b[1]);
  for (const [k, , x, z] of L.slice(0, 8)) if (lineOK(p, { x, z })) return k; return L[0][0];
}
function routeTo(from, to) { // 回傳 { pts: [起點, ...路網點, 終點], len }
  const direct = Math.hypot(to.x - from.x, to.z - from.z);
  if (direct < 30 && lineOK(from, to)) return { pts: [from, to], len: direct };
  const a = nearNode(from), b = nearNode(to), dist = { [a]: 0 }, prev = {}, done = new Set();
  while (true) { let u = null, ud = 1e18; for (const k in dist) if (!done.has(k) && dist[k] < ud) { ud = dist[k]; u = k; } if (u === null || u === b) break; done.add(u);
    for (const [v, w] of RN_ADJ[u] || []) if (dist[v] === undefined || ud + w < dist[v]) { dist[v] = ud + w; prev[v] = u; } }
  const path = []; for (let k = b; k; k = prev[k]) { path.unshift(k); if (k === a) break; }
  const pts = [from, ...path.map(k => ({ x: RN.P[k][0], z: RN.P[k][1] })), to];
  while (pts.length > 2 && Math.hypot(pts[1].x - from.x, pts[1].z - from.z) < 1) pts.splice(1, 1);
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return { pts, len };
}
const fareOf = len => Math.max(8, Math.round(len / 8)); // 每 8 步 1 文，最低 8 文
function snapWalk(x, z) { if (okAt(x, z)) return { x, z }; for (let r = .5; r < 16; r += .5) for (let a = 0; a < 6.28; a += .5 / r) { const qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (okAt(qx, qz)) return { x: qx, z: qz }; } return null; }
function gmRide(x, z, n) { // GM 專用：免費、不用等車、跑得快
  if (G.mode !== 'walk') return toast('先起身再搭車吧');
  startRide({ id: '__gm', n, x, z, room: 'edo' + G.room, gmFast: true }, true);
}
function openRide(cab) {
  if (G.mode !== 'walk') return toast('先起身再搭車吧');
  RIDE.from = cab || null; RIDE.rooms = null; drawRide(); if (G.online) net.send({ t: 'who' });
}
function drawRide() {
  const p = $('#panel'); const myRoom = 'edo' + G.room, cab = RIDE.from, me = { x: G.pos.x, z: G.pos.z };
  const all = RIDE.rooms ? Object.entries(RIDE.rooms).sort().flatMap(([r, l]) => l.filter(q => !(q.id === G.myId && r === myRoom)).map(q => ({ ...q, room: r }))) : null;
  const dFee = DEST.map(([, x, z]) => fareOf(routeTo(me, { x, z }).len));
  const pFee = q => q.room === myRoom ? fareOf(routeTo(me, { x: q.x, z: q.z }).len) : RIDE.fare2;
  const gm = G.gm;
  p.innerHTML = `<h2>🛺 人力車<small>${cab ? '車夫：「客官要去哪？」' : '叫一台車過來載你'}</small></h2>
  <p class="sub" style="margin:4px 0">${gm ? '👑 GM 免費、免等車，一下就到' : `車資依距離：約每 8 步 1 文（最低 8 文）　身上 <b>${G.money}</b> 文`}</p>
  <div class="chips gmdest">${DEST.map(([n], i) => `<button class="chipw" data-gd="${i}" ${gm || afford(dFee[i]) ? '' : 'disabled'}>${n}${gm ? '' : `<small> ${dFee[i]}文</small>`}</button>`).join('')}</div>
  <canvas id="gmMap" width="520" height="260" style="width:100%;border-radius:10px;border:1.5px solid var(--line);cursor:crosshair;margin:6px 0"></canvas>
  <p class="sub" style="margin:0">↑ 也可以直接點地圖上想去的地方</p>
  ${G.online ? `<p class="sub" style="margin:8px 0 0">去找玩家：</p><div class="rlist">${!all ? '<p class="sub">車夫正在打聽大家在哪裡…</p>' : all.length ? all.map(q => { const fee = pFee(q);
    return `<button class="rp" data-id="${q.id}" data-room="${q.room}" ${gm || afford(fee) ? '' : 'disabled'}><b>${q.gm ? '👑 ' : ''}${esc(q.n)}</b><small>${ROOM_ZH[q.room] || q.room}・${placeName(q.x, q.z)}</small><span>${gm ? '' : fee + ' 文'}</span></button>`; }).join('') : '<p class="sub">現在沒有其他真人玩家在線</p>'}</div>` : ''}
  <div class="btns"><button id="rX">算了</button></div>`;
  show('#panel'); $('#rX').onclick = () => { RIDE.from = null; closePanels(); };
  const go = (q, fee) => { if (gm && q.room === myRoom) return gmRide(q.x, q.z, q.n); bookRide(q, gm ? 0 : fee); };
  const cv = $('#gmMap'); drawMini(cv);
  p.querySelectorAll('[data-gd]').forEach(b => b.onclick = () => { const i = +b.dataset.gd, [n, x, z] = DEST[i]; go({ id: '__place', n, x, z, room: myRoom, place: true }, dFee[i]); });
  cv.onclick = e => { const r = cv.getBoundingClientRect(), sx = cv.width / 540, px = (e.clientX - r.left) * cv.width / r.width, py = (e.clientY - r.top) * cv.height / r.height;
    const x = px / sx - 300, z = (py - cv.height * .5) / sx, q = snapWalk(x, z); if (!q) return toast('那裡車子到不了，點近一點的路吧');
    const n = placeName(q.x, q.z); go({ id: '__place', n, x: q.x, z: q.z, room: myRoom, place: true }, fareOf(routeTo(me, q).len)); };
  p.querySelectorAll('.rp').forEach(b => b.onclick = () => { const q = all.find(x => x.id === b.dataset.id && x.room === b.dataset.room); go(q, pFee(q)); });
}
net.on('who', m => { RIDE.rooms = m.rooms; if (!$('#panel').classList.contains('hide') && $('#panel #gmMap')) drawRide(); });
// 付錢後：點的是路上空車 → 直接上車；按🛺叫車 → 車夫從附近跑過來
function bookRide(q, fee) {
  if (!afford(fee)) return toast(`錢不夠喔（車資 ${fee} 文）`);
  if (fee) addMoney(-fee, '人力車'); closePanels(); G.follow = null;
  const cab = RIDE.from; RIDE.from = null;
  if (cab && !(cab.busy > 0)) { const r = cab.cart.root; cab.busy = 45; r.visible = false; G.pos.x = r.position.x; G.pos.z = r.position.z; G.ry = r.rotation.y; G.me.say('麻煩了！', 2); return startRide(q, true, fee); }
  hailRide(q, fee);
}
// 空車：借用 Chara 的人力車模型（車＋車夫），掛在獨立的 Group 上
function makeCart(x, z, ry) { const c = { root: new THREE.Group() }; Chara.prototype.setRide.call(c, true, Chara); c.kuruma.position.y = 0; c.root.position.set(x, heightAt(x, z), z); c.root.rotation.y = ry; scene.add(c.root); return c; }
function dropCart(c) { if (c) scene.remove(c.root); }
function hailRide(q, fee) {
  // 找最近的空車跑過來；沒有就從附近路上出發
  let best = null, bd = 60; for (const c of CABS) { if (c.busy > 0 || !c.cart.root.visible) continue; const d = c.cart.root.position.distanceTo(G.pos); if (d < bd) { bd = d; best = c; } }
  let cart, cab = null;
  if (best) { cab = best; cab.busy = 60; cab.cart.root.visible = false; const r = best.cart.root; cart = makeCart(r.position.x, r.position.z, r.rotation.y); }
  else { const s = snapWalk(G.pos.x + 14, G.pos.z) || snapWalk(G.pos.x - 14, G.pos.z) || { x: G.pos.x, z: G.pos.z + 3 }; cart = makeCart(s.x, s.z, Math.atan2(G.pos.x - s.x, G.pos.z - s.z)); }
  RIDE.hail = { cart, q, fee, sp: 0, t: 0, cab }; G.mode = 'hail'; G.me.play(16); G.me.say('人力車～這邊！', 2.5);
  toast(`🛺 已叫車${fee ? `（${fee} 文）` : ''}，車夫正跑過來…　走開會取消${fee ? '並退錢' : ''}`, 3500); sfx(600, .15);
}
function cancelHail(msg) { const H = RIDE.hail; if (!H) return; RIDE.leave = { cart: H.cart, t: 0 }; if (H.cab) H.cab.busy = 8; if (H.fee) addMoney(H.fee, '退款'); RIDE.hail = null; G.mode = 'walk'; toast(msg || '已取消叫車' + (H.fee ? '，退回車資' : '')); }
function updHail(dt, moveLen) {
  const H = RIDE.hail; if (!H) return;
  if (moveLen > .5) return cancelHail();
  H.t += dt; const c = H.cart, p = c.root.position;
  const side = { x: G.pos.x + Math.cos(G.ry) * 1.1, z: G.pos.z - Math.sin(G.ry) * 1.1 }; // 停在玩家側邊
  const dx = side.x - p.x, dz = side.z - p.z, d = Math.hypot(dx, dz);
  H.sp = Math.min(7, H.sp + dt * 5, Math.max(.8, d * 1.6));
  if (d > .3) { const st = Math.min(d, H.sp * dt); p.x += dx / d * st; p.z += dz / d * st; p.y = heightAt(p.x, p.z); c.root.rotation.y = angLerp(c.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5)); }
  Chara.prototype.updRide.call(c, dt, d > .3 ? H.sp : 0);
  if (d <= .3 || H.t > 25) { // 上車
    G.pos.x = p.x; G.pos.z = p.z; G.ry = c.root.rotation.y; dropCart(c); RIDE.hail = null; G.me.say('麻煩了！', 2); startRide(H.q, true, H.fee);
  }
}
function updLeave(dt) { const L = RIDE.leave; if (!L) return; L.t += dt; const c = L.cart, ry = c.root.rotation.y; c.root.position.x += Math.sin(ry) * 5 * dt; c.root.position.z += Math.cos(ry) * 5 * dt; Chara.prototype.updRide.call(c, dt, 5); if (L.t > 5) { dropCart(c); RIDE.leave = null; } }
function startRide(q, paid, fee) {
  const same = q.room === 'edo' + G.room;
  if (!paid) { fee = same ? fareOf(routeTo(G.pos, q).len) : RIDE.fare2; if (!afford(fee)) return toast('錢不夠喔'); addMoney(-fee, '人力車'); }
  closePanels(); G.follow = null;
  G.mode = 'ride'; G.me.setRide(true, Chara); net.send({ t: 'ride', on: 1 });
  G.pos.y = RIDE_Y + heightAt(G.pos.x, G.pos.z); const from = { x: G.pos.x, z: G.pos.z };
  const tgt = () => { const R = same && G.remotes.get(q.id); return R ? { x: R.ch.root.position.x, z: R.ch.root.position.z } : { x: q.x, z: q.z }; };
  const t0 = tgt(); const pts = same && !q.gmFast ? routeTo(from, t0).pts.slice(0, -1) : [from]; // 沿路網跑，最後一段直接到目的地
  RIDE.cur = { pts, i: 1, q, same, tgt, sp: 0, end: !same ? 2.6 : 0, t: 0, fast: !!q.gmFast, place: !!q.place };
  if (q.gmFast) { G.me.say(`去${q.n}！`); sfx(520, .15); closeup(1.6, { dist: 4.2, h: 1.6, ang: .9, look: .9, spin: .25 }); return; }
  G.me.say(q.place ? `麻煩載我去${q.n}！` : same ? `麻煩載我去找「${q.n}」！` : `麻煩載我去${ROOM_ZH[q.room]}找「${q.n}」！`); sfx(520, .15);
  closeup(2.2, { dist: 4.2, h: 1.6, ang: .9, look: .9, spin: .25 });
}
async function arriveOther(q) {
  const x = q.x + 1.6, z = q.z; G.me.setRide(false); G.mode = 'walk'; G.pos.y = 0; net.send({ t: 'ride', on: 0 });
  await switchRoom(+q.room.replace('edo', ''), x, z);
}
function endRide(msg, faceP) {
  RIDE.cur = null; G.me.setRide(false); G.mode = 'walk'; net.send({ t: 'ride', on: 0 });
  RIDE.leave = { cart: makeCart(G.pos.x, G.pos.z, G.ry), t: 0 };
  const s = snapWalk(G.pos.x - Math.cos(G.ry) * 1.0, G.pos.z + Math.sin(G.ry) * 1.0) || snapWalk(G.pos.x, G.pos.z); if (s) { G.pos.x = s.x; G.pos.z = s.z; }
  G.pos.y = heightAt(G.pos.x, G.pos.z); if (faceP) faceTo(faceP); toast(msg); G.me.say('謝謝車夫！'); sfx(660, .2);
}
function updRide(dt) {
  const C = RIDE.cur; if (G.mode !== 'ride' || !C) return 0;
  C.t += dt;
  if (C.fast) { // GM 快速移動：依真實時間 2.5 秒內直線抵達（不受畫面卡頓影響）
    if (!C.t0) { C.t0 = performance.now(); C.f = { x: G.pos.x, z: G.pos.z }; }
    const T = C.tgt(), k = Math.min(1, (performance.now() - C.t0) / 2500), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const nx = C.f.x + (T.x - C.f.x) * e, nz = C.f.z + (T.z - C.f.z) * e; if (Math.hypot(nx - G.pos.x, nz - G.pos.z) > .01) G.ry = angLerp(G.ry, Math.atan2(nx - G.pos.x, nz - G.pos.z), .3);
    G.pos.x = nx; G.pos.z = nz; G.pos.y = RIDE_Y + heightAt(nx, nz);
    if (k >= 1) { endRide(`🛺 到了：${C.q.n}`); return 0; }
    return 13;
  }
  if (!C.same && C.t > C.end) { RIDE.cur = null; arriveOther(C.q); return 0; }
  const T = C.tgt(); const stop = C.place ? { x: T.x, z: T.z } : { x: T.x + 1.4 * Math.sign(G.pos.x - T.x || 1), z: T.z + .6 };
  const goal = C.same ? (C.i < C.pts.length ? C.pts[C.i] : stop) : { x: G.pos.x + Math.sin(G.ry) * 10, z: G.pos.z + Math.cos(G.ry) * 10 };
  const dx = goal.x - G.pos.x, dz = goal.z - G.pos.z, d = Math.hypot(dx, dz);
  const last = C.same && C.i >= C.pts.length;
  C.sp = Math.min(14, C.sp + dt * 9); if (last) C.sp = Math.min(C.sp, Math.max(1.5, d * 2.2));
  const step = Math.min(d, C.sp * dt);
  if (d > .05) { G.pos.x += dx / d * step; G.pos.z += dz / d * step; G.ry = angLerp(G.ry, Math.atan2(dx, dz), Math.min(1, dt * 6)); }
  if (d < (last ? .35 : 1.2)) { if (!last) C.i++; else { // 到了（中途點放寬，轉彎比較順）
    const R = G.remotes.get(C.q.id); endRide(C.place ? `🛺 到了：${C.q.n}` : `🛺 到了！「${C.q.n}」就在旁邊`, R && R.ch.root.position); return 0; } }
  G.pos.y = RIDE_Y + heightAt(G.pos.x, G.pos.z); return C.sp;
}
// 路上的空車：乘り場停靠＋大街來回；點一下就能搭。太遠不畫、不更新（省效能）
const CABS = [];
const CAB_STANDS = [[-60, 4.6, PI / 2], [92, -4.6, -PI / 2], [146, -12, 0], [-131, 52, PI / 2], [-104, -9, -PI / 2], [150, 44, PI], [-112, 60, -PI / 2]];
function spawnCabs() {
  for (const [x, z, ry] of CAB_STANDS) { const cart = makeCart(x, z, ry); CABS.push({ cart, kind: 'stand', home: [x, z, ry] }); W.colliders.push({ x: x + Math.sin(ry) * .9, z: z + Math.cos(ry) * .9, r: 1.1 }); }
  for (let i = 0; i < 3; i++) CABS.push({ cart: makeCart(0, 0, 0), kind: 'cruise', lane: [2.4, -2.4, 2.4][i], ph: i / 3 });
}
function updCabs(dt) {
  const cp = camera.position, now = (Date.now() + (G.timeOff || 0)) / 1000;
  for (const c of CABS) {
    const r = c.cart.root;
    if (c.busy > 0) { c.busy -= dt; if (c.busy > 0) continue; r.visible = true; }
    let sp = 0;
    if (c.kind === 'cruise') { // 大街 -88↔98 來回，位置由共用時間算出，大家看到的一樣
      const L = 186, per = L * 2 / 4.5, t = (now / per + c.ph) % 1, fw = t < .5, u = fw ? t * 2 : 2 - t * 2;
      r.position.set(-88 + u * L, 0, fw ? c.lane : -c.lane); r.rotation.y = fw ? PI / 2 : -PI / 2; sp = 4.5;
    }
    const d = r.position.distanceTo(cp), vis = d < 55; r.visible = vis; if (!vis) continue;
    Chara.prototype.updRide.call(c.cart, dt, sp); if (c.cart.puller && c.cart.puller.lod) c.cart.puller.lod(d);
  }
}
