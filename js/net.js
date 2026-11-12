// WebSocket 連線（Cloudflare Durable Object）
export class Net {
  constructor(base) { this.base = base; this.h = {}; this.ws = null; this.ok = false; this.room = 'edo1'; }
  on(t, f) { (this.h[t] = this.h[t] || []).push(f); }
  emit(t, m) { (this.h[t] || []).forEach(f => f(m)); }
  send(o) { if (this.ok && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  connect(hello, room = 'edo1') {
    this.room = room;
    return new Promise(res => {
      if (!this.base) return res('offline');
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      try { this.ws = new WebSocket(this.base + '?room=' + room); } catch (e) { return fin('offline'); }
      const to = setTimeout(() => { fin('offline'); try { this.ws.close(); } catch (e) {} }, 7000);
      this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'hi', ...hello }));
      this.ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'full') { clearTimeout(to); return fin('full'); }
        if (m.t === 'welcome') { clearTimeout(to); this.ok = true; fin('ok'); }
        this.emit(m.t, m);
      };
      this.ws.onclose = () => { clearTimeout(to); const was = this.ok; this.ok = false; fin('offline'); if (was) this.emit('closed', {}); };
      this.ws.onerror = () => {};
    });
  }
}
