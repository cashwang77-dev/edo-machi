// 多人伺服器測試：node tools/mptest.mjs ws://localhost:8787/ws
const URL = process.argv[2] || 'ws://localhost:8787/ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(name, room = 'test' + Date.now() % 100000) {
  return new Promise(res => {
    const ws = new WebSocket(URL + '?room=' + room); const c = { ws, name, got: [], id: null };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hi', n: name, lk: { k: 1 }, x: 0, z: 0 }));
    ws.onmessage = ev => { const m = JSON.parse(ev.data); c.got.push(m); if (m.t === 'welcome') { c.id = m.id; res(c); } if (m.t === 'full') { c.full = true; res(c); } };
    ws.onerror = () => res(c);
    c.send = o => ws.send(JSON.stringify(o));
    c.has = (t, f = () => true) => c.got.some(m => m.t === t && f(m));
  });
}
const results = []; const ok = (c, m) => { results.push((c ? 'PASS ' : 'FAIL ') + m); };
const room = 'r' + Date.now() % 100000;
const A = await client('店主阿花', room), B = await client('客人小明', room);
ok(A.id && B.id, '兩人連線 ' + A.id + ' ' + B.id);
await sleep(300);
ok(A.has('join', m => m.n === '客人小明'), 'A 收到 B 加入');
B.send({ t: 'p', x: 5, z: 1, y: 0, r: 1, a: 1 }); await sleep(500);
ok(A.has('s', m => m.p.some(p => p[0] === B.id && p[1] === 5)), '位置同步');
A.send({ t: 'claim', s: 'soba' }); await sleep(300);
ok(B.has('shops', m => m.shops.soba === A.id), '開店廣播');
B.send({ t: 'claim', s: 'soba' }); await sleep(300);
ok(B.has('claimfail'), '同店不能兩個老闆');
B.send({ t: 'order', s: 'soba', oid: 'o1', item: 'kake' }); await sleep(300);
ok(A.has('order', m => m.oid === 'o1' && m.from === B.id && m.n === '客人小明'), '店主收到訂單');
A.send({ t: 'serve', to: B.id, oid: 'o1', item: 'kake', q: 90, s: 'soba' }); await sleep(300);
ok(B.has('served', m => m.oid === 'o1' && m.q === 90), '客人收到餐點');
B.send({ t: 'chat', s: 'うまい！' }); await sleep(300);
ok(A.has('chat', m => m.s === 'うまい！') && B.has('chat', m => m.s === 'うまい！'), '聊天雙方都收到');
B.send({ t: 'emote', e: '😍' }); await sleep(300);
ok(A.has('emote', m => m.e === '😍'), '表情符號');
B.send({ t: 'order', s: 'chaya', oid: 'o2', item: 'sencha' }); await sleep(300);
ok(B.has('nobody', m => m.oid === 'o2'), '沒老闆的店回 nobody');
A.ws.close(); await sleep(500);
ok(B.has('leave', m => m.id === A.id) && B.got.filter(m => m.t === 'shops').pop().shops.soba === undefined, '店主離線→自動收店');
B.ws.close();
// 80 人上限
const room2 = 'cap' + Date.now() % 100000; const many = [];
for (let i = 0; i < 82; i++) many.push(client('p' + i, room2));
const cs = await Promise.all(many);
const full = cs.filter(c => c.full).length, joined = cs.filter(c => c.id).length;
ok(joined === 80 && full === 2, `上限 80 人（進入 ${joined}、被擋 ${full}）`);
await sleep(800);
const last = cs.find(c => c.id); const sc = last.got.filter(m => m.t === 's').length;
cs.forEach(c => { try { c.ws.close(); } catch (e) {} });
console.log(results.join('\n'));
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
