// 江戶町 聲音：和風配樂（白天／夜晚交叉淡入）、環境音、鐘聲、風鈴、掌櫃叫賣（語音）
const store = { get(k, d) { try { const v = localStorage.getItem('edo_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('edo_' + k, JSON.stringify(v)); } catch (e) {} } };

export const SND = {
  ac: null, on: store.get('snd', { music: true, sfx: true, call: true }),
  vol: { music: .55, amb: .5 },
  started: false, lastT: null, chimeT: 8, bellDone: {}, cricketT: 0,

  start() {
    if (this.started) { this.ac && this.ac.resume(); return; }
    this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ac = this.ac = new AC();
    this.master = ac.createGain(); this.master.connect(ac.destination);
    this.musicG = ac.createGain(); this.musicG.gain.value = this.on.music ? this.vol.music : 0; this.musicG.connect(this.master);
    this.sfxG = ac.createGain(); this.sfxG.gain.value = this.on.sfx ? 1 : 0; this.sfxG.connect(this.master);
    // 配樂：白天／夜晚兩首交叉淡入
    this.tracks = {};
    for (const k of ['day', 'night']) {
      const el = new Audio('audio/' + k + '.mp3'); el.loop = true; el.crossOrigin = 'anonymous'; el.preload = 'auto';
      const g = ac.createGain(); g.gain.value = 0;
      try { ac.createMediaElementSource(el).connect(g); } catch (e) {}
      g.connect(this.musicG); this.tracks[k] = { el, g, playing: false };
    }
    // 環境音：粉紅雜訊經濾波 → 人聲嘈雜、河水
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2 + w * .02) * .5; }
    const mk = (type, f, q) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = .9 + Math.random() * .2; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(this.sfxG); s.start(); return { g, fl }; };
    this.crowd = mk('bandpass', 700, .8);
    this.river = mk('lowpass', 900, .5);
    this.wind = mk('bandpass', 350, .4);
  },
  setOn(k, v) {
    this.on[k] = v; store.set('snd', this.on);
    if (!this.ac) return;
    if (k === 'music') this.musicG.gain.setTargetAtTime(v ? this.vol.music : 0, this.ac.currentTime, .3);
    if (k === 'sfx') this.sfxG.gain.setTargetAtTime(v ? 1 : 0, this.ac.currentTime, .3);
    if (k === 'call' && !v && window.speechSynthesis) speechSynthesis.cancel();
  },
  // 每幀呼叫：t＝一天中的時間 0~1、night＝夜晚程度 0~1、river＝離河距離、crowd＝附近人數
  update(dt, t, night, river, crowd, nearShop) {
    if (!this.ac || this.ac.state !== 'running') return;
    const now = this.ac.currentTime, T = (p, v) => p.setTargetAtTime(v, now, .8);
    // 配樂交叉淡入
    const nightMix = Math.min(1, Math.max(0, night * 1.2));
    for (const [k, tr] of Object.entries(this.tracks)) {
      const v = k === 'night' ? nightMix : 1 - nightMix;
      T(tr.g.gain, v);
      if (v > .02 && !tr.playing) { tr.playing = true; tr.el.play().catch(() => { tr.playing = false; }); }
      if (v <= .02 && tr.playing && tr.g.gain.value < .03) { tr.el.pause(); tr.playing = false; }
    }
    T(this.crowd.g.gain, Math.min(.16, .03 + crowd * .012) * (1 - night * .6));
    T(this.river.g.gain, Math.max(0, .22 * (1 - river / 30)));
    T(this.wind.g.gain, .03 + night * .03);
    // 黃昏（暮れ六つ）與清晨（明け六つ）的寺院鐘聲
    if (this.lastT != null) for (const mark of [.25, .75]) {
      const crossed = (this.lastT < mark && t >= mark) || (this.lastT > .95 && mark < .05);
      if (crossed) { let k = 0; const ring = () => { this.bell(); if (++k < 3) setTimeout(ring, 4500); }; ring(); }
    }
    this.lastT = t;
    // 夜晚：風鈴與蟲鳴
    this.chimeT -= dt; if (this.chimeT < 0) { this.chimeT = 9 + Math.random() * 14; if (nearShop && Math.random() < .5 + night * .4) this.chime(); }
    if (night > .4) { this.cricketT -= dt; if (this.cricketT < 0) { this.cricketT = .6 + Math.random() * 1.6; this.cricket(night); } }
  },
  bell() {
    if (!this.ac || !this.on.sfx) return; const ac = this.ac, t = ac.currentTime;
    [[1, .5, 9], [2.01, .22, 6], [2.76, .18, 5], [5.4, .08, 3], [8.9, .04, 2]].forEach(([m, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 73.4 * m; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * .35, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(this.sfxG); o.start(t); o.stop(t + d);
    });
  },
  chime() {
    if (!this.ac || !this.on.sfx) return; const ac = this.ac; let t = ac.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = [2093, 2349, 2637, 3136][Math.floor(Math.random() * 4)];
      for (const [m, a] of [[1, .05], [2.7, .015]]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + 2.2); o.connect(g).connect(this.sfxG); o.start(t); o.stop(t + 2.3); }
      t += .12 + Math.random() * .25;
    }
  },
  cricket(night) {
    if (!this.ac || !this.on.sfx) return; const ac = this.ac, t = ac.currentTime, f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; const s = t + i * .07; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(.012 * night, s + .01); g.gain.linearRampToValueAtTime(0, s + .05); o.connect(g).connect(this.sfxG); o.start(s); o.stop(s + .06); }
  },
  gong(vol = 1) { // 鰐口：金屬鏘鏘聲
    if (!this.ac || !this.on.sfx || vol < .03) return; const ac = this.ac;
    for (let k = 0; k < 3; k++) { const t = ac.currentTime + k * .22;
      [[523, .2, 1.4], [1187, .12, 1.0], [1873, .08, .7], [2655, .05, .5], [3411, .03, .3]].forEach(([f, a, d]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - .5) * .01); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vol * (k ? .7 : 1), t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(g).connect(this.sfxG); o.start(t); o.stop(t + d); }); }
  },
  coin(vol = 1) { // 投幣：叮、叮噹
    if (!this.ac || !this.on.sfx || vol < .03) return; const ac = this.ac;
    [[0, 3520], [.09, 4400], [.2, 2960]].forEach(([dt, f]) => { const t = ac.currentTime + .55 + dt; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06 * vol, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .35); o.connect(g).connect(this.sfxG); o.start(t); o.stop(t + .4); });
    const t = ac.currentTime + .75; const n = ac.createBufferSource(), b = ac.createBuffer(1, ac.sampleRate * .15, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 900); n.buffer = b; const g = ac.createGain(); g.gain.value = .12 * vol; const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 900; n.connect(fl).connect(g).connect(this.sfxG); n.start(t);
  },
  bigBell(vol = 1) { // 梵鐘：低沉長音
    if (!this.ac || !this.on.sfx || vol < .03) return; const ac = this.ac, t = ac.currentTime;
    [[1, .6, 14], [2.02, .3, 10], [2.74, .22, 8], [3.5, .1, 6], [5.4, .07, 4], [8.9, .03, 2.5]].forEach(([m, a, d]) => {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 55 * m; o2.frequency.value = 55 * m * 1.004; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * .45 * vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); o2.connect(g); g.connect(this.sfxG); o.start(t); o2.start(t); o.stop(t + d); o2.stop(t + d); });
    const n = ac.createBufferSource(), b = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 2500); n.buffer = b; const g = ac.createGain(); g.gain.value = .25 * vol; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400; n.connect(fl).connect(g).connect(this.sfxG); n.start(t);
  },
  pluck(f = 440, v = .08) { // 介面用的琴音
    if (!this.ac || !this.on.sfx) return; const ac = this.ac, t = ac.currentTime;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.002; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + .4);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
    o.connect(fl); o2.connect(fl); fl.connect(g).connect(this.sfxG); o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
  },
  // 叫賣：用瀏覽器語音念日文，沒有日文語音就念中文
  voices: null,
  call(ja, zh, vol = 1, pitch = 1) {
    if (!this.on.call || !window.speechSynthesis || vol < .05) return;
    if (!this.voices || !this.voices.length) this.voices = speechSynthesis.getVoices();
    const jv = this.voices.find(v => /^ja/i.test(v.lang)), zv = this.voices.find(v => /^zh[-_](TW|HK)/i.test(v.lang)) || this.voices.find(v => /^zh/i.test(v.lang));
    const u = new SpeechSynthesisUtterance(jv ? ja : zh); const v = jv || zv; if (!v) return;
    u.voice = v; u.lang = v.lang; u.volume = Math.min(1, vol) * .9; u.pitch = pitch; u.rate = jv ? .95 : 1;
    speechSynthesis.speak(u);
  },
};
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { SND.voices = speechSynthesis.getVoices(); };
