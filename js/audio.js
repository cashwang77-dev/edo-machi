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
