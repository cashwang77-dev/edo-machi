// 江戶町 多人伺服器（Cloudflare Worker + Durable Object）
// 一個 Town 物件 = 一條街，最多 80 人。伺服器負責轉送、店主登記、髒話過濾、GM 指令。
import { cleanText } from '../js/filter.js';
const MAX = 80;
const TICK = 200; // 毫秒，位置廣播 5Hz

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('need websocket', { status: 426 });
      const room = (url.searchParams.get('room') || 'edo1').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'edo1';
      return env.TOWN.get(env.TOWN.idFromName(room)).fetch(req);
    }
    if (url.pathname === '/count') {
      const r = await env.TOWN.get(env.TOWN.idFromName('edo1')).fetch(new Request('https://x/count'));
      return new Response(await r.text(), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
    }
    return new Response('edo-machi ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};

function safeEq(a, b) { // 固定時間比較，避免時間差攻擊
  let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0;
}

export class Town {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.players = new Map(); // id -> {ws, n, lk, x, z, y, r, a, gm, strikes, muteUntil}
    this.shops = {}; this.seq = 1; this.timer = null; this.timeOff = 0; this.fails = new Map(); // ip -> {n, until}
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/count') return new Response(JSON.stringify({ n: this.players.size, max: MAX }));
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.accept(); this.onOpen(server, req.headers.get('CF-Connecting-IP') || 'local');
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
  bcast(obj, exceptId) { const s = JSON.stringify(obj); for (const [id, p] of this.players) if (id !== exceptId) { try { p.ws.send(s); } catch (e) {} } }
  byName(n) { n = String(n || '').trim(); for (const [id, p] of this.players) if (p.n === n) return [id, p]; for (const [id, p] of this.players) if (p.n.includes(n) && n) return [id, p]; return [null, null]; }
  sys(ws, s) { this.send(ws, { t: 'sys', s }); }

  onOpen(ws, ip) {
    const id = 'p' + (this.seq++); let joined = false;
    ws.addEventListener('message', ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!joined) {
        if (m.t !== 'hi') return;
        let gm = false;
        if (m.k && this.env.GM_KEY) {
          const f = this.fails.get(ip) || { n: 0, until: 0 };
          if (f.until > Date.now()) { /* 鎖定中：不比對 */ }
          else if (safeEq(String(m.k), String(this.env.GM_KEY))) { gm = true; this.fails.delete(ip); }
          else { f.n++; if (f.n >= 5) { f.until = Date.now() + 3600000; f.n = 0; } this.fails.set(ip, f); }
        }
        if (this.players.size >= MAX && !gm) { this.send(ws, { t: 'full', max: MAX }); try { ws.close(1000, 'full'); } catch (e) {} return; }
        joined = true;
        let n = cleanText(String(m.n || '旅人').slice(0, 12)).text.replace(/＊/g, '') || '旅人';
        if (!gm && /^GM|管理員/i.test(n)) n = '旅人' + id.slice(1);
        const p = { ws, n, lk: m.lk || {}, x: +m.x || 0, z: +m.z || 0, y: 0, r: 0, a: 0, dirty: true, gm, strikes: 0, muteUntil: 0 };
        this.players.set(id, p);
        const list = [];
        for (const [pid, q] of this.players) if (pid !== id) list.push({ id: pid, n: q.n, lk: q.lk, x: q.x, z: q.z, y: q.y, r: q.r, a: q.a, gm: q.gm });
        this.send(ws, { t: 'welcome', id, n, gm, players: list, shops: this.shops, max: MAX, timeOff: this.timeOff });
        this.bcast({ t: 'join', id, n: p.n, lk: p.lk, x: p.x, z: p.z, gm }, id);
        this.startTick(); return;
      }
      this.onMsg(id, m);
    });
    const bye = () => {
      if (!this.players.has(id)) return;
      this.players.delete(id);
      let changed = false; for (const s in this.shops) if (this.shops[s] === id) { delete this.shops[s]; changed = true; }
      this.bcast({ t: 'leave', id }); if (changed) this.bcast({ t: 'shops', shops: this.shops });
      if (this.players.size === 0 && this.timer) { clearInterval(this.timer); this.timer = null; }
    };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
  }

  // 過濾＋累犯禁言；回傳過濾後文字或 null（被禁言）
  speak(id, p, s) {
    if (p.muteUntil > Date.now()) { this.send(p.ws, { t: 'muted', until: p.muteUntil }); return null; }
    const r = cleanText(String(s || '').slice(0, 80));
    if (r.bad && !p.gm) {
      p.strikes++;
      if (p.strikes >= 3) { p.muteUntil = Date.now() + 5 * 60000; p.strikes = 0; this.send(p.ws, { t: 'muted', until: p.muteUntil, auto: 1 }); }
      else this.sys(p.ws, `請文明用語（警告 ${p.strikes}/3，累積 3 次會被禁言 5 分鐘）`);
    }
    return r.text;
  }

  gmCmd(id, p, s) {
    const [cmd, ...rest] = s.slice(1).trim().split(/\s+/); const arg = rest.join(' ');
    const [tid, tp] = this.byName(rest[0]);
    switch (cmd) {
      case 'a': case '公告': if (arg) this.bcast({ t: 'announce', s: arg.slice(0, 120), n: p.n }); break;
      case 'time': case '時間': { const v = parseFloat(rest[0]); if (v >= 0 && v < 1) { const base = ((Date.now() / 1000 / 1800) + .3) % 1; this.timeOff = (v - base + 1) % 1; this.bcast({ t: 'time', off: this.timeOff }); } break; }
      case 'kick': case '踢': if (tp && !tp.gm) { this.send(tp.ws, { t: 'kicked' }); try { tp.ws.close(1000, 'kick'); } catch (e) {} this.sys(p.ws, `已踢出 ${tp.n}`); } break;
      case 'mute': case '禁言': if (tp && !tp.gm) { const min = Math.max(1, Math.min(1440, +rest[1] || 10)); tp.muteUntil = Date.now() + min * 60000; this.send(tp.ws, { t: 'muted', until: tp.muteUntil }); this.sys(p.ws, `已禁言 ${tp.n} ${min} 分鐘`); } break;
      case 'unmute': case '解禁': if (tp) { tp.muteUntil = 0; this.sys(tp.ws, '你已被解除禁言'); this.sys(p.ws, `已解除 ${tp.n} 禁言`); } break;
      case 'give': case '給': if (tp) { const v = Math.max(1, Math.min(99999, +rest[1] || 100)); this.send(tp.ws, { t: 'gift', v, n: p.n, gm: 1 }); this.sys(p.ws, `已給 ${tp.n} ${v} 文`); } break;
      case 'tp': case '傳送': if (tp) this.send(p.ws, { t: 'tp', x: tp.x + 1, z: tp.z }); break;
      case 'summon': case '召喚': if (tp) this.send(tp.ws, { t: 'tp', x: p.x + 1, z: p.z }); break;
      default: this.sys(p.ws, 'GM 指令：/公告 文字、/時間 0~1、/傳送 名字、/召喚 名字、/給 名字 數量、/禁言 名字 分鐘、/解禁 名字、/踢 名字');
    }
  }

  onMsg(id, m) {
    const p = this.players.get(id); if (!p) return;
    switch (m.t) {
      case 'p': p.x = +m.x || 0; p.z = +m.z || 0; p.y = +m.y || 0; p.r = +m.r || 0; p.a = m.a | 0; p.dirty = true; break;
      case 'chat': {
        const raw = String(m.s || '');
        if (p.gm && raw.startsWith('/')) { this.gmCmd(id, p, raw); break; }
        const s = this.speak(id, p, raw); if (s != null) this.bcast({ t: 'chat', id, s }); break;
      }
      case 'w': { // 悄悄話
        const q = this.players.get(m.to); if (!q) break; const s = this.speak(id, p, m.s); if (s == null) break;
        this.send(q.ws, { t: 'w', from: id, n: p.n, s }); this.send(p.ws, { t: 'w', from: id, to: m.to, n: p.n, s, self: 1 }); break;
      }
      case 'emote': this.bcast({ t: 'emote', id, e: String(m.e || '').slice(0, 10) }, id); break;
      case 'look': p.lk = m.lk || {}; this.bcast({ t: 'look', id, lk: p.lk }, id); break;
      case 'act': { // 玩家對玩家：打招呼、擊掌、送禮、送食物
        const q = this.players.get(m.to); if (!q) break;
        const k = String(m.k || '').slice(0, 10), v = m.k === 'gift' ? Math.max(1, Math.min(p.gm ? 99999 : 500, m.v | 0)) : String(m.v || '').slice(0, 30);
        this.send(q.ws, { t: 'act', from: id, n: p.n, k, v });
        if (k === 'five' || k === 'hi') this.bcast({ t: 'actfx', a: id, b: m.to, k });
        break;
      }
      case 'claim': {
        const s = String(m.s || '');
        if (this.shops[s] && this.shops[s] !== id && this.players.has(this.shops[s])) { this.send(p.ws, { t: 'claimfail', s }); break; }
        for (const k in this.shops) if (this.shops[k] === id) delete this.shops[k];
        this.shops[s] = id; this.bcast({ t: 'shops', shops: this.shops }); break;
      }
      case 'release': { const s = String(m.s || ''); if (this.shops[s] === id) { delete this.shops[s]; this.bcast({ t: 'shops', shops: this.shops }); } break; }
      case 'order': {
        const owner = this.shops[m.s]; const q = owner && this.players.get(owner);
        if (!q) { this.send(p.ws, { t: 'nobody', s: m.s, oid: m.oid }); break; }
        this.send(q.ws, { t: 'order', s: m.s, oid: m.oid, item: m.item, from: id, n: p.n }); break;
      }
      case 'serve': {
        const c = this.players.get(m.to);
        if (c) this.send(c.ws, { t: 'served', s: m.s, oid: m.oid, item: m.item, q: m.q, from: id });
        break;
      }
      case 'cancel': { const owner = this.shops[m.s]; const q = owner && this.players.get(owner); if (q) this.send(q.ws, { t: 'cancel', oid: m.oid }); break; }
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
