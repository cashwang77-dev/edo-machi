// 江戶町 多人伺服器（Cloudflare Worker + Durable Object）
// 一個 Town 物件 = 一條街，最多 80 人。伺服器只轉送與記錄店主，不做重運算。
const MAX = 80;
const TICK = 200; // 毫秒，位置廣播頻率 5Hz

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('need websocket', { status: 426 });
      const room = (url.searchParams.get('room') || 'edo1').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'edo1';
      const id = env.TOWN.idFromName(room);
      return env.TOWN.get(id).fetch(req);
    }
    if (url.pathname === '/count') {
      const id = env.TOWN.idFromName('edo1');
      const r = await env.TOWN.get(id).fetch(new Request('https://x/count'));
      return new Response(await r.text(), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
    }
    return new Response('edo-machi ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};

export class Town {
  constructor(state, env) {
    this.state = state;
    this.players = new Map(); // id -> {ws, n, lk, x, z, r, a, y, dirty}
    this.shops = {};          // shopId -> ownerId
    this.seq = 1;
    this.timer = null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/count') return new Response(JSON.stringify({ n: this.players.size, max: MAX }));
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.onOpen(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
  bcast(obj, exceptId) {
    const s = JSON.stringify(obj);
    for (const [id, p] of this.players) if (id !== exceptId) { try { p.ws.send(s); } catch (e) {} }
  }

  onOpen(ws) {
    if (this.players.size >= MAX) { this.send(ws, { t: 'full', max: MAX }); ws.close(1000, 'full'); return; }
    const id = 'p' + (this.seq++);
    let joined = false;
    ws.addEventListener('message', ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!joined) {
        if (m.t !== 'hi') return;
        if (this.players.size >= MAX) { this.send(ws, { t: 'full', max: MAX }); try { ws.close(1000, 'full'); } catch (e) {} return; }
        joined = true;
        const p = { ws, n: String(m.n || '旅人').slice(0, 12), lk: m.lk || {}, x: +m.x || 0, z: +m.z || 0, y: 0, r: 0, a: 0, dirty: true };
        this.players.set(id, p);
        const list = [];
        for (const [pid, q] of this.players) if (pid !== id) list.push({ id: pid, n: q.n, lk: q.lk, x: q.x, z: q.z, y: q.y, r: q.r, a: q.a });
        this.send(ws, { t: 'welcome', id, players: list, shops: this.shops, max: MAX });
        this.bcast({ t: 'join', id, n: p.n, lk: p.lk, x: p.x, z: p.z }, id);
        this.startTick();
        return;
      }
      this.onMsg(id, m);
    });
    const bye = () => {
      if (!this.players.has(id)) return;
      this.players.delete(id);
      let changed = false;
      for (const s in this.shops) if (this.shops[s] === id) { delete this.shops[s]; changed = true; }
      this.bcast({ t: 'leave', id });
      if (changed) this.bcast({ t: 'shops', shops: this.shops });
      if (this.players.size === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
    };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  onMsg(id, m) {
    const p = this.players.get(id); if (!p) return;
    switch (m.t) {
      case 'p': // 位置
        p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; p.r = +m.r || 0; p.a = m.a | 0; p.dirty = true; break;
      case 'chat':
        this.bcast({ t: 'chat', id, s: String(m.s || '').slice(0, 80) }); break;
      case 'emote':
        this.bcast({ t: 'emote', id, e: String(m.e || '').slice(0, 10) }, id); break;
      case 'look':
        p.lk = m.lk || {}; this.bcast({ t: 'look', id, lk: p.lk }, id); break;
      case 'claim': {
        const s = String(m.s || '');
        if (this.shops[s] && this.shops[s] !== id && this.players.has(this.shops[s])) { this.send(p.ws, { t: 'claimfail', s }); break; }
        for (const k in this.shops) if (this.shops[k] === id) delete this.shops[k];
        this.shops[s] = id; this.bcast({ t: 'shops', shops: this.shops }); break;
      }
      case 'release': {
        const s = String(m.s || '');
        if (this.shops[s] === id) { delete this.shops[s]; this.bcast({ t: 'shops', shops: this.shops }); }
        break;
      }
      case 'order': { // 客人 → 店主
        const owner = this.shops[m.s];
        const q = owner && this.players.get(owner);
        if (!q) { this.send(p.ws, { t: 'nobody', s: m.s, oid: m.oid }); break; }
        this.send(q.ws, { t: 'order', s: m.s, oid: m.oid, item: m.item, from: id, n: p.n }); break;
      }
      case 'serve': { // 店主 → 客人（也廣播給大家看端菜）
        const c = this.players.get(m.to);
        if (c) this.send(c.ws, { t: 'served', s: m.s, oid: m.oid, item: m.item, q: m.q, from: id });
        this.bcast({ t: 'dish', to: m.to, item: m.item, s: m.s }, m.to);
        break;
      }
      case 'cancel': { // 客人取消
        const owner = this.shops[m.s]; const q = owner && this.players.get(owner);
        if (q) this.send(q.ws, { t: 'cancel', oid: m.oid }); break;
      }
      case 'paid': { // 客人付款通知店主（含小費）
        const owner = this.players.get(m.to);
        if (owner) this.send(owner.ws, { t: 'paid', v: m.v | 0, n: p.n }); break;
      }
    }
  }

  startTick() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const arr = [];
      for (const [id, p] of this.players) if (p.dirty) { arr.push([id, Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.r * 100) / 100, p.a]); p.dirty = false; }
      if (arr.length) this.bcast({ t: 's', p: arr });
    }, TICK);
  }
}
