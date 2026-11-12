// 江戶町 主程式
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, walkable, heightAt } from './world.js';
import { Chara, randomLook, KIMONO, OBI, PATTERNS, HAIRS, SKINS, EYES, BROWS, MOUTHS, CHEEKS, MOLES, FACES } from './chara.js';
import { SHOPS, FORTUNE, ACC, SLOT_NAME } from './shops.js';
import { Net } from './net.js';
import { cleanText } from './filter.js';
import { SND } from './audio.js';
import * as TX from './tex.js';

const SERVER = new URLSearchParams(location.search).has('test') ? '' : (new URLSearchParams(location.search).get('server') || window.EDO_SERVER || '');
const QS = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || QS.has('touch');
const store = { get(k, d) { try { const v = localStorage.getItem('edo_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('edo_' + k, JSON.stringify(v)); } catch (e) {} } };
const DAY = 1800; // 一天＝30 分鐘
const PI = Math.PI;

// ---------- 渲染器 ----------
let quality = store.get('q', isTouch ? 1 : 2);
const renderer = new THREE.WebGLRenderer({ antialias: quality > 0, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = quality > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, .1, 4000);
let composer, bloom;
function setupPost() {
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .4, .55, .92); composer.addPass(bloom); composer.addPass(new OutputPass());
}
function applyQuality() {
  const pr = Math.min(devicePixelRatio, quality === 2 ? 2 : quality === 1 ? 1.5 : 1);
  renderer.setPixelRatio(pr); renderer.shadowMap.enabled = quality > 0;
  if (W && W.sunLight) W.sunLight.shadow.mapSize.set(quality === 2 ? 2048 : 1024, quality === 2 ? 2048 : 1024);
  resize();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); if (composer) composer.setSize(w, h); }
addEventListener('resize', resize);

// ---------- 狀態 ----------
let W;
const G = window.G = {
  mode: 'title', name: store.get('name', ''), look: store.get('look', randomLook()), money: 300,
  pos: new THREE.Vector3(96, 0, 0), ry: -PI / 2, me: null, myId: 'me', online: false,
  remotes: new Map(), owners: {}, seat: null, shop: null, order: null, queue: [], npcCust: [], emoteT: 0, busy: false, gm: false, timeOff: 0, eatT: 0, follow: null, whisper: null,
};
const cam = { yaw: PI / 2 - .5, pitch: .32, dist: 6.5, tx: 0, ty: 0, tz: 0, auto: false };
const net = new Net(SERVER);

// ---------- 小工具 ----------
function toast(s, ms = 2600) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }
function show(id, on = true) { $(id).classList.toggle('hide', !on); }
function setMoney(v) { G.money = Math.max(0, Math.round(v)); $('#mon').textContent = G.gm ? '∞' : G.money; if (!G.gm) store.set('mon_' + G.name, G.money); }
const afford = p => G.gm || G.money >= p;
function addMoney(v, why) { if (G.gm && v < 0) return; setMoney(G.money + v); if (v) { const f = document.createElement('div'); f.className = 'coin'; f.textContent = (v > 0 ? '+' : '') + v + ' 文' + (why ? '　' + why : ''); $('#hud').appendChild(f); setTimeout(() => f.remove(), 1800); } }
function uid() { return Math.random().toString(36).slice(2, 9); }
function angLerp(a, b, k) { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * k; }
function edoTime(t) {
  const h = t * 24; const names = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const i = Math.floor(((h + 1) % 24) / 2); const icon = (h > 5.5 && h < 18.5) ? '☀' : '🌙';
  return `${icon} ${names[i]}の刻（${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}）`;
}
function tday() { if (QS.has('t')) return +QS.get('t'); return ((Date.now() / 1000 / DAY) + .3 + G.timeOff) % 1; }
const sfx = (() => { let ac; return (f = 660, d = .12, type = 'sine', v = .08) => { try { ac = ac || new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.value = v; g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (e) {} }; })();

// ---------- 輸入 ----------
const keys = {}; const joy = { x: 0, y: 0, mag: 0, id: null };
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', e => {
  if (typing()) { if (e.key === 'Enter' && document.activeElement.id === 'chatIn') sendChat(); if (e.key === 'Escape') { document.activeElement.blur(); closeChat(); } return; }
  keys[e.code] = true;
  if (G.mode === 'title') return;
  if (e.code === 'KeyE') act();
  if (e.code === 'Enter') { e.preventDefault(); openChat(); }
  if (e.code === 'Space') { e.preventDefault(); mgPress(true); }
  if (e.code === 'Escape') closePanels();
  if (e.code === 'KeyV') toggleView();
  const dg = /^Digit([1-8])$/.exec(e.code); if (dg) { const [a, , , d] = ACTIONS[+dg[1] - 1]; emote(a, d); }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') mgPress(false); });
// 滑鼠／觸控拖曳轉鏡頭
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { if (cam.auto && G.mode !== 'title') { toggleView(); return; } drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; cam.yaw -= dx * .006; cam.pitch = Math.min(1.25, Math.max(.05, cam.pitch + dy * .004)); });
addEventListener('pointerup', e => { if (drag && drag.id === e.pointerId) drag = null; });
renderer.domElement.addEventListener('wheel', e => { cam.dist = Math.min(16, Math.max(2.2, cam.dist * (1 + Math.sign(e.deltaY) * .1))); }, { passive: true });
// 搖桿
const jb = $('#joy'), jk = $('#joyK');
jb.addEventListener('pointerdown', e => { joy.id = e.pointerId; jb.setPointerCapture(e.pointerId); joyMove(e); e.stopPropagation(); });
jb.addEventListener('pointermove', e => { if (joy.id === e.pointerId) joyMove(e); });
const joyEnd = e => { if (joy.id === e.pointerId) { joy.id = null; joy.x = joy.y = joy.mag = 0; jk.style.transform = ''; } };
jb.addEventListener('pointerup', joyEnd); jb.addEventListener('pointercancel', joyEnd);
function joyMove(e) { const r = jb.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } joy.x = x; joy.y = y; joy.mag = Math.min(1, m); jk.style.transform = `translate(${x * 34}px,${y * 34}px)`; }
// 雙指縮放
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => pts.set(e.pointerId, [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointermove', e => { if (!pts.has(e.pointerId)) return; const old = [...pts.values()]; const pd = old.length === 2 ? Math.hypot(old[0][0] - old[1][0], old[0][1] - old[1][1]) : 0; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const n = [...pts.values()]; const nd = Math.hypot(n[0][0] - n[1][0], n[0][1] - n[1][1]); if (pd) cam.dist = Math.min(16, Math.max(2.2, cam.dist * pd / nd)); drag = null; } });
const ptEnd = e => pts.delete(e.pointerId); renderer.domElement.addEventListener('pointerup', ptEnd); renderer.domElement.addEventListener('pointercancel', ptEnd);

// ---------- 鏡頭射線 vs 建築阻擋框（slab 法）----------
function rayBlock(ox, oy, oz, d, maxT) {
  let best = maxT;
  for (const b of W.blockers) {
    if (ox < b.x0 - maxT - 2 || ox > b.x1 + maxT + 2 || oz < b.z0 - maxT - 2 || oz > b.z1 + maxT + 2) continue;
    let t0 = 0, t1 = best, ok = true;
    for (const [o, v, lo, hi] of [[ox, d.x, b.x0, b.x1], [oy, d.y, b.y0, b.y1], [oz, d.z, b.z0, b.z1]]) {
      if (Math.abs(v) < 1e-6) { if (o < lo || o > hi) { ok = false; break; } continue; }
      let a = (lo - o) / v, c = (hi - o) / v; if (a > c) [a, c] = [c, a];
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) { ok = false; break; }
    }
    if (!ok) continue;
    const inside = ox > b.x0 && ox < b.x1 && oy > b.y0 && oy < b.y1 && oz > b.z0 && oz < b.z1;
    if (!inside && t0 > .05 && t0 < best) best = t0;
  }
  return best;
}

// ---------- 碰撞 ----------
function blocked(x, z, r = .3) {
  for (const c of W.colliders) {
    if (c.r != null) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + r) ** 2) return true; }
    else if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
const okAt = (x, z) => walkable(x, z) && !blocked(x, z);

// ---------- 角色 ----------
function addMe() {
  G.me = new Chara(G.look, G.name || '旅人'); scene.add(G.me.root); G.me.tag.visible = false;
  G.me.root.position.copy(G.pos); G.me.root.rotation.y = G.ry;
}
function addRemote(p) {
  if (G.remotes.has(p.id)) return;
  const ch = new Chara(p.lk, ''); if (p.gm) { ch.gm = true; ch.setLook(p.lk); } ch.setName(p.gm ? '👑 ' + p.n : p.n); ch.root.position.set(p.x, p.y || 0, p.z); scene.add(ch.root);
  G.remotes.set(p.id, { ch, n: p.n, tx: p.x, ty: p.y || 0, tz: p.z, tr: p.r || 0, a: p.a || 0, lastX: p.x, lastZ: p.z });
  updCount();
}
function delRemote(id) { const r = G.remotes.get(id); if (!r) return; scene.remove(r.ch.root); G.remotes.delete(id); updCount(); }
function updCount() { $('#online').textContent = G.online ? `👥 ${G.remotes.size + 1} / 80 人在線` : '🏮 單人模式（離線）'; }

// NPC 町人（人少時代替玩家逛街、吃東西、聊天）、掌櫃
const NPCS = []; const keepers = {};
const NPC_NAMES = ['八五郎', '熊吉', '阿花', '老隱居', '與太郎', '阿菊', '源三', '阿松', '辰五郎', '阿光', '金太', '阿竹', '新吉', '阿梅', '平助', '阿雪'];
const NPC_PAIRS = [['今天的蕎麥麵真好吃', '對吧！信濃屋是老字號'], ['要不要一起去泡湯？', '好啊，過了日本橋就到了'], ['聽說最近有人開了糰子店', '真的嗎？等等去看看'], ['夕陽真美呢', '富士山也看得好清楚'], ['你的和服好好看', '謝謝，是在丸屋買的'], ['最近生意如何？', '託您的福，還不錯'], ['浮世繪店可以畫肖像喔', '我也想畫一張！'], ['晚上河邊有螢火蟲', '那晚點一起去吧'], ['神社的櫻花開了', '去參拜順便賞花吧'], ['肚子餓了～', '去吃鰻魚飯吧！']];
function spawnNPCs() {
  const r = Math.random;
  for (let i = 0; i < 16; i++) {
    const lk = randomLook(r); if (r() < .25) lk.hat = 1 + Math.floor(r() * 4); if (r() < .2) lk.w = 1 + Math.floor(r() * 2);
    const ch = new Chara(lk, ''); ch.setName(NPC_NAMES[i], true);
    ch.root.position.set(-90 + r() * 185, 0, (r() - .5) * 10); scene.add(ch.root);
    NPCS.push({ ch, i, st: 'idle', tx: 0, tz: 0, wait: r() * 4, t: 0, sp: 1.5 + r() * 1.1, nm: NPC_NAMES[i], seat: null, goal: null });
  }
  for (const s of W.shops) {
    const lk = randomLook(); lk.hat = 0; lk.c = 0; if (!s.def.service) { lk.k = 9; lk.p = 0; }
    const ch = new Chara(lk, ''); ch.root.position.set(s.owner.x, s.owner.y, s.owner.z); ch.root.rotation.y = s.owner.r; scene.add(ch.root); keepers[s.def.id] = ch;
  }
}
function npcQuota() { const real = G.online ? G.remotes.size + 1 : 1; return Math.max(4, Math.min(16, 18 - real)); }
function npcSetFood(n, f) { n.ch.setLook({ ...n.ch.look, f: f || '' }); }
function npcEat(n, f) { npcSetFood(n, f); n.eatT = 4; }
function npcPlan(n) {
  n.goal = null; const r = Math.random();
  if (r < .25) {
    const list = W.shops.filter(s => !s.def.service && !G.owners[s.def.id]); const s = list[Math.floor(Math.random() * list.length)];
    const seat = s && s.seats.find(seatFree);
    if (seat) { n.goal = { k: 'shop', seat, shop: s }; n.tx = seat.x; n.tz = seat.z; n.st = 'walk'; return; }
  }
  if (r < .37) {
    const seats = W.seats.filter(x => x.kind === 'view' && seatFree(x)); const seat = seats[Math.floor(Math.random() * seats.length)];
    if (seat) { n.goal = { k: 'bench', seat }; n.tx = seat.x; n.tz = seat.z; n.st = 'walk'; return; }
  }
  if (r < .5) {
    const p = n.ch.root.position;
    const mate = NPCS.find(m => m !== n && m.ch.root.visible && (m.st === 'idle' || m.st === 'walk') && !m.goal && m.ch.root.position.distanceTo(p) < 30);
    if (mate) {
      const mp = mate.ch.root.position, mx = (p.x + mp.x) / 2, mz = Math.max(-5.5, Math.min(5.5, (p.z + mp.z) / 2));
      const pair = NPC_PAIRS[Math.floor(Math.random() * NPC_PAIRS.length)];
      n.goal = { k: 'chat', mate, line: pair[0], first: true }; mate.goal = { k: 'chat', mate: n, line: pair[1], first: false };
      n.tx = mx - .7; n.tz = mz; mate.tx = mx + .7; mate.tz = mz; n.st = mate.st = 'walk'; return;
    }
  }
  const q = Math.random();
  if (q < .06) { n.tx = 170 + Math.random() * 16; n.tz = -55 - Math.random() * 14; }
  else if (q < .12) { n.tx = -115 + Math.random() * 10; n.tz = (Math.random() - .5) * 4; }
  else if (q < .14) { n.tx = 104 + Math.random() * 4; n.tz = (Math.random() - .5) * 20; }
  else { n.tx = -95 + Math.random() * 196; n.tz = (Math.random() - .5) * 9; }
  n.st = 'walk';
}
function npcArrive(n) {
  const g = n.goal, p = n.ch.root.position;
  if (g && (g.k === 'shop' || g.k === 'bench')) {
    if (!seatFree(g.seat, n)) { n.goal = null; n.st = 'idle'; n.wait = 1; return; }
    n.seat = g.seat; p.set(g.seat.x, g.seat.y, g.seat.z); n.ch.root.rotation.y = g.seat.r; n.st = 'sit'; n.t = 0; n.sitFor = g.k === 'shop' ? 13 : 15 + Math.random() * 15; return;
  }
  if (g && g.k === 'chat') { n.st = 'chatwait'; n.t = 0; return; }
  n.st = 'idle'; n.wait = 2 + Math.random() * 6;
  if (Math.random() < .12) { n.ch.emoji(['🌸', '😊', '🍵', '🎵'][Math.floor(Math.random() * 4)]); }
}
function updNPCs(dt) {
  const quota = npcQuota();
  for (const n of NPCS) {
    const vis = n.i < quota;
    if (n.ch.root.visible !== vis) { n.ch.root.visible = vis; if (!vis) { n.seat = null; n.goal = null; n.st = 'idle'; n.wait = 1; if (n.ch.look.f) npcSetFood(n, ''); } }
    if (!vis) continue;
    const p = n.ch.root.position; n.t += dt;
    let anim = 0, sp = 0;
    if (n.five > 0) { n.five -= dt; n.ch.play(16); n.ch.update(dt, 0); continue; }
    if (n.eatT > 0) { n.eatT -= dt; anim = n.st === 'sit' ? 5 : 15; if (n.eatT <= 0) { npcSetFood(n, ''); n.ch.say(['好好吃！', '好吃～', '吃飽了～'][Math.floor(Math.random() * 3)], 3); } }
    if (n.st === 'talk') { if (!anim) anim = n.t < 1 ? 7 : 0; if (n.t > 4.5) { n.st = 'idle'; n.wait = 1; } }
    else if (n.st === 'sit') {
      if (!anim) anim = 3;
      const g = n.goal;
      if (g && g.k === 'shop') {
        const k = keepers[g.shop.def.id];
        if (!n.ordered) { n.ordered = 1; const items = g.shop.def.menu.filter(m => m.dish); n.food = g.shop.def.id + ':' + items[Math.floor(Math.random() * items.length)].id; if (k) k.cookT = 3; }
        if (n.t > 3 && n.ordered === 1) { n.ordered = 2; npcSetFood(n, n.food); }
        if (n.t > 5 && n.ordered === 2) { n.ordered = 3; n.eatT = 4; }
      } else if (n.t > 4 && !n.saidView && Math.random() < .002) { n.saidView = 1; n.ch.say(['風景真好～', '景色真美', '好想睡午覺…'][Math.floor(Math.random() * 3)], 4); }
      if (n.t > n.sitFor && !(n.eatT > 0)) { const s = n.seat; n.seat = null; n.goal = null; n.ordered = 0; n.saidView = 0; n.st = 'idle'; n.wait = .5; p.x -= Math.sin(s.r) * .9; p.z -= Math.cos(s.r) * .9; if (n.ch.look.f) npcSetFood(n, ''); }
    }
    else if (n.st === 'chatwait') {
      const m = n.goal && n.goal.mate; const mp = m && m.ch.root.position;
      if (!m || m.goal?.mate !== n || n.t > 12) { n.goal = null; n.st = 'idle'; n.wait = 1; }
      else {
        n.ch.root.rotation.y = angLerp(n.ch.root.rotation.y, Math.atan2(mp.x - p.x, mp.z - p.z), Math.min(1, dt * 6));
        if (m.st === 'chatwait') {
          if (n.goal.first && !n.goal.said) { n.goal.said = 1; n.chatT = 0; n.ch.say(n.goal.line, 3.5); }
          if (!n.goal.first && m.goal.said && !n.goal.said && (m.chatT += 0) >= 0 && n.t > 3) { n.goal.said = 1; n.ch.say(n.goal.line, 3.5); if (Math.random() < .5) n.ch.emoji(['😄', '👍', '🌸'][Math.floor(Math.random() * 3)]); }
          if (!anim) anim = n.goal.said ? 0 : 0;
          if (n.goal.said && m.goal.said && n.t > 8) { n.goal = null; n.st = 'idle'; n.wait = 1 + Math.random() * 2; }
        }
      }
    }
    else if (n.st === 'walk') {
      const dx = n.tx - p.x, dz = n.tz - p.z, d = Math.hypot(dx, dz);
      if (d < .45) npcArrive(n);
      else {
        sp = n.sp; const vx = dx / d * sp * dt, vz = dz / d * sp * dt;
        if (okAt(p.x + vx, p.z + vz) || n.goal) { p.x += vx; p.z += vz; } else if (okAt(p.x + vx, p.z)) p.x += vx; else if (okAt(p.x, p.z + vz)) p.z += vz; else { n.st = 'idle'; n.wait = .5; n.goal = null; }
        p.y = heightAt(p.x, p.z); n.ch.root.rotation.y = angLerp(n.ch.root.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 6));
        if (!anim) anim = 1;
      }
    }
    else { n.wait -= dt; if (n.wait <= 0) { npcPlan(n); n.t = 0; } if (!anim && n.idleA) { anim = n.idleA; } }
    n.ch.play(anim); n.ch.update(dt, sp);
  }
  for (const id in keepers) {
    const k = keepers[id]; k.root.visible = !G.owners[id];
    if (k.root.visible) { k.play(k.cookT > 0 ? 4 : 0); if (k.cookT > 0) k.cookT -= dt; k.update(dt, 0); }
  }
}

// ---------- 料理模型 ----------
const DM = {}; const dm = c => DM[c] || (DM[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .55 }));
const BOWL = (() => { const p = []; for (let i = 0; i <= 8; i++) { const t = i / 8; p.push(new THREE.Vector2(.06 + .1 * Math.sin(t * PI / 2), t * .1)); } return new THREE.LatheGeometry(p, 16); })();
function makeDish(d) {
  const g = new THREE.Group(); const c = d.c || [];
  if (d.type === 'bowl') { g.add(new THREE.Mesh(BOWL, dm('#7a1f1f'))); const s = new THREE.Mesh(new THREE.CircleGeometry(.145, 16), dm(c[0])); s.rotation.x = -PI / 2; s.position.y = .085; g.add(s); const n = new THREE.Mesh(new THREE.TorusGeometry(.06, .02, 6, 12), dm(c[1] || '#d8c69a')); n.rotation.x = PI / 2; n.position.y = .09; g.add(n); }
  else if (d.type === 'zaru') { g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .03, .3), dm('#b89a5a'))); const n = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 6), dm(c[0])); n.scale.y = .35; n.position.y = .04; g.add(n); }
  else if (d.type === 'cup') { const cup = new THREE.Mesh(new THREE.CylinderGeometry(.06, .05, .09, 12), dm('#4a3a2e')); cup.position.y = .045; g.add(cup); const t = new THREE.Mesh(new THREE.CircleGeometry(.055, 12), dm(c[0])); t.rotation.x = -PI / 2; t.position.y = .091; g.add(t); }
  else if (d.type === 'sushi') { g.add(new THREE.Mesh(new THREE.BoxGeometry(.32, .03, .16), dm('#5a3a24'))); for (const x of [-.07, .07]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.09, .04, .05), dm('#f4f0e6')); r.position.set(x, .035, 0); g.add(r); const f = new THREE.Mesh(new THREE.BoxGeometry(.1, .02, .06), dm(c[0])); f.position.set(x, .065, 0); g.add(f); } }
  else if (d.type === 'skewer') { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .015, 14), dm('#efe6d0')); g.add(pl); const st = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .26, 4), dm('#c9a868')); st.rotation.z = PI / 2; st.position.y = .04; g.add(st); c.forEach((cc, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), dm(cc)); b.position.set(-.05 + i * .055, .04, 0); g.add(b); }); }
  else if (d.type === 'box') { const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .07, .16), dm('#1a1414')); b.position.y = .035; g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(.19, .02, .13), dm(c[0])); t.position.y = .075; g.add(t); const rr = new THREE.Mesh(new THREE.BoxGeometry(.23, .072, .02), dm('#a8282a')); rr.position.set(0, .035, .08); g.add(rr); }
  else if (d.type === 'tokkuri') { const p = []; for (let i = 0; i <= 10; i++) { const t = i / 10; p.push(new THREE.Vector2(.02 + .05 * Math.sin(Math.min(1, t * 1.3) * PI) * (t < .8 ? 1 : .4), t * .2)); } g.add(new THREE.Mesh(new THREE.LatheGeometry(p, 12), dm(c[0]))); const cup = new THREE.Mesh(new THREE.CylinderGeometry(.03, .02, .03, 10), dm('#f4f0e4')); cup.position.set(.09, .015, 0); g.add(cup); }
  else { const pl = new THREE.Mesh(new THREE.CylinderGeometry(.12, .1, .02, 14), dm('#efe6d0')); g.add(pl); for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), dm(c[i] || c[0])); b.scale.y = .7; b.position.set(-.04 + i * .08, .04, 0); g.add(b); } }
  g.traverse(o => o.castShadow = true); return g;
}
function placeDish(item, pos, ry, sec = 7) { const d = makeDish(item.dish); d.position.copy(pos); d.rotation.y = ry; scene.add(d); setTimeout(() => scene.remove(d), sec * 1000); return d; }

// ---------- 互動 ----------
let near = null;
function findNear() {
  near = null; if (G.mode !== 'walk') return updPrompt();
  const p = G.pos; let best = 1e9;
  for (const s of W.shops) { const d = Math.hypot(p.x - s.front.x, p.z - s.front.z); if (d < 3.4 && d < best) { best = d; near = { type: 'shop', shop: s }; } }
  for (const s of W.seats) if (s.kind === 'view') { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < 1.5 && d < best) { best = d; near = { type: 'view', seat: s }; } }
  for (const s of W.spots) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < 2.6 && d < best) { best = d; near = { type: s.type, spot: s }; } }
  for (const n of NPCS) { const q = n.ch.root.position; const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < 2.0 && d < best) { best = d; near = { type: 'npc', npc: n }; } }
  for (const dr of DEER) { const q = dr.g.position; const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < 2.2 && d < best) { best = d; near = { type: 'deer', deer: dr }; } }
  updPrompt();
}
function updPrompt() {
  const b = $('#act'); let label = '';
  if (G.mode === 'walk' && near) label = near.type === 'shop' ? `🏮 ${near.shop.def.name}（${near.shop.def.kind}）` : near.type === 'view' ? '🪑 坐下來看風景' : near.type === 'npc' ? `💬 跟「${near.npc.nm}」聊天` : near.type === 'deer' ? '🦌 摸摸小鹿' : near.spot.label;
  else if (G.mode === 'seat' || G.mode === 'bath') label = '🚶 起身離開';
  b.textContent = label ? (isTouch ? label : `[E] ${label}`) : ''; b.classList.toggle('hide', !label || G.busy || !$('#panel').classList.contains('hide'));
}
function act() {
  if (G.busy) return;
  if (G.mode === 'seat' || G.mode === 'bath') return standUp();
  if (G.mode !== 'walk' || !near) return;
  if (near.type === 'shop') openShop(near.shop);
  else if (near.type === 'view') sitAt(near.seat);
  else if (near.type === 'npc') { npcTalk(near.npc); G.ry = Math.atan2(near.npc.ch.root.position.x - G.pos.x, near.npc.ch.root.position.z - G.pos.z); }
  else if (near.type === 'board') show('#help');
  else if (near.type === 'temple') openTemple();
  else if (near.type === 'kane') ringKane();
  else if (near.type === 'deer') petDeer(near.deer);
  else if (near.type === 'donate') { show('#donate'); G.me.emoji('🙇'); }
  else if (near.type === 'well') { G.me.say('井水好冰涼～'); emote(6); sfx(300, .3, 'sine', .05); }
  else if (near.type === 'pray') {
    if (!afford(1)) return toast('身上沒有錢可以投香油錢……');
    addMoney(-1, '香油錢'); sfx(880, .6, 'sine', .06); setTimeout(() => sfx(1320, .8, 'sine', .04), 200);
    G.ry = Math.atan2(-131 - G.pos.x, 0 - G.pos.z);
    wishPrompt('神社參拜', '二拜二拍手一拜，寫下你的心願吧', 6);
  }
}
function sitAt(seat, kind = 'seat') {
  G.mode = kind; G.seat = seat; G.pos.set(seat.x, seat.y || 0, seat.z); G.ry = seat.r;
  G.me.play(kind === 'bath' ? 8 : 3); cam.yaw = seat.r + PI + (kind === 'bath' ? 0 : .5); cam.pitch = .2; cam.dist = 4.8; updPrompt();
}
function standUp() {
  if (G.order) cancelOrder('離開座位，已退款');
  const s = G.seat; G.seat = null; closePanels();
  if (G.mode === 'bath') { const c = W.bathSteam; const a = Math.atan2(G.pos.z - c.z, G.pos.x - c.x); G.pos.set(c.x + Math.cos(a) * 4.8, 0, c.z + Math.sin(a) * 4.8); }
  else if (s && s.kind === 'shop') { const sh = W.shops.find(x => x.def.id === s.shop); G.pos.set(sh.front.x + (s.x - sh.front.x) * .6, 0, sh.front.z + Math.sign(-sh.front.z) * .9); }
  else if (s) { G.pos.x -= Math.sin(s.r) * -.6; G.pos.z -= Math.cos(s.r) * -.6; }
  G.mode = 'walk'; G.me.play(0); G.shop = null; updPrompt();
}
function seatFree(seat, me) {
  for (const [, r] of G.remotes) if (Math.hypot(r.tx - seat.x, r.tz - seat.z) < .45) return false;
  for (const c of G.npcCust) if (c.seat === seat) return false;
  for (const n of NPCS) if (n !== me && n.ch.root.visible && (n.seat === seat || (n.goal && n.goal.seat === seat))) return false;
  return true;
}
function ownerName(id) { if (id === G.myId) return '你'; return G.remotes.get(id)?.n || '某人'; }

// 店鋪面板
function openShop(s) {
  const d = s.def, own = G.owners[d.id];
  if (d.play) {
    const p = $('#panel'); p.innerHTML = `<h2>${d.name}<small>${d.kind}</small></h2>
    <p class="sub">${d.play === 'kingyo' ? '用紙網撈金魚，紙網濕了會破！撈到的金魚會裝袋給你。' : '用軟木塞槍打下架上的獎品，打中就送你！'}　一回 <b>${d.price}</b> 文</p>
    <div class="btns"><button id="bPlay" class="big alt">🎮 玩一回</button><button id="bX2">算了</button></div>`;
    show('#panel'); $('#bX2').onclick = closePanels;
    $('#bPlay').onclick = () => { if (!afford(d.price)) return toast('錢不夠喔'); addMoney(-d.price); closePanels(); (d.play === 'kingyo' ? playKingyo : playShateki)(s); };
    return;
  }
  const p = $('#panel'); p.innerHTML = `<h2>${d.name}<small>${d.kind}</small></h2>
  <p class="sub">${own ? `店主：玩家「${ownerName(own)}」營業中` : '店主：NPC 掌櫃（沒有玩家老闆時由掌櫃顧店）'}</p>
  <div class="btns"><button id="bCust" class="big">🍵 當客人・坐下${d.service ? '' : '點餐'}</button>
  ${own ? '' : '<button id="bOwn" class="big alt">🏮 我來當老闆（開店）</button>'}</div>
  <button class="close" id="bX">✕</button>`;
  show('#panel');
  $('#bX').onclick = closePanels;
  $('#bCust').onclick = () => { const seat = s.seats.find(seatFree); if (!seat) return toast('客滿了，稍等一下吧'); closePanels(); G.shop = s; sitAt(seat); openMenu(s); };
  if ($('#bOwn')) $('#bOwn').onclick = () => { closePanels(); claim(s); };
}
function openMenu(s) {
  const d = s.def; const own = G.owners[d.id];
  const p = $('#panel');
  p.innerHTML = `<h2>${d.name}<small>品書き（菜單）</small></h2><p class="sub">${own ? `店主：${ownerName(own)}（玩家）` : 'NPC 掌櫃為您服務'}　身上：<b>${G.gm ? '∞' : G.money}</b> 文</p>
  <div class="menu">${d.menu.map((m, i) => `${m.cat && (i === 0 || d.menu[i - 1].cat !== m.cat) ? `<div class="mcat">${m.cat}</div>` : ''}<button class="mi" data-i="${i}" ${afford(m.p) ? '' : 'disabled'}><span class="jp">${m.n}</span><span class="zh">${m.zh}${m.acc && invGet().includes(m.acc.id) ? '（已擁有）' : ''}</span><span class="pr">${m.p} 文</span></button>`).join('')}</div>
  <div class="btns"><button id="bLeave">🚶 起身離開</button></div>`;
  show('#panel'); show('#seatBar', false);
  p.querySelectorAll('.mi').forEach(b => b.onclick = () => order(s, d.menu[+b.dataset.i]));
  $('#bLeave').onclick = standUp;
}
// 買完東西：只留一條小按鈕列，不再整張菜單擋住人物
function seatBar(s, msg) {
  show('#panel', false); const b = $('#seatBar');
  b.innerHTML = `<span>${msg}</span><button id="sbMenu">📜 再點</button><button id="sbLeave">🚶 離開</button>`; show('#seatBar');
  $('#sbMenu').onclick = () => { show('#seatBar', false); openMenu(s); }; $('#sbLeave').onclick = standUp;
}
function closePanels() { show('#seatBar', false); show('#panel', false); show('#help', false); show('#fortune', false); show('#ukiyo', false); }

// 點餐
function order(s, item) {
  if (G.order) return;
  if (!afford(item.p)) return toast('錢不夠喔，去開店賺點錢吧！');
  const own = G.owners[s.def.id];
  if (own === G.myId) return;
  addMoney(-item.p);
  G.order = { oid: uid(), item, shop: s, owner: own || null, t: 0 };
  const p = $('#panel');
  p.innerHTML = `<h2>${s.def.name}<small>已點：${item.n}</small></h2><p class="sub wait">${own ? `等待店主「${ownerName(own)}」製作中…` : '掌櫃正在準備…'}</p><div class="btns"><button id="bCancel">取消（退款）</button></div>`;
  $('#bCancel').onclick = () => { cancelOrder('已取消，退款 ' + item.p + ' 文'); openMenu(s); };
  if (own) net.send({ t: 'order', s: s.def.id, oid: G.order.oid, item: item.id });
  else {
    const k = keepers[s.def.id]; const dur = 3.5 + Math.random() * 2.5; if (k) k.cookT = dur;
    const oid = G.order.oid; setTimeout(() => { if (G.order && G.order.oid === oid) served(s, item, 55 + Math.random() * 35, null); }, dur * 1000);
  }
}
function cancelOrder(msg) {
  const o = G.order; if (!o) return; G.order = null; if (!G.gm) addMoney(o.item.p); toast(msg);
  if (o.owner) net.send({ t: 'cancel', s: o.shop.def.id, oid: o.oid });
}
function grade(q) { return q >= 85 ? ['極上', '#c8322a'] : q >= 60 ? ['上', '#b07a1a'] : ['並', '#5a5a5a']; }
function served(s, item, q, from) {
  G.order = null; const [gname] = grade(q);
  const lines = ['好好吃！', '好吃！', '真是極品～', '這味道太棒了', '吃飽了，謝謝招待！'];
  if (item.dish) {
    setHeld(s.def.id + ':' + item.id);
    toast(`拿到「${item.n}」！品質：${gname}　按 🍡 吃掉，或帶著走、送給別人`, 3500);
    seatBar(s, `✔ ${item.n}`);
  } else if (item.look) {
    if (item.acc) { invAdd(item.acc.id); if (item.acc.slot === 'm' && G.look.hat === 4) G.look.hat = 0; if (item.acc.slot === 'hs' && G.look.hat === 2) G.look.hat = 0; }
    G.look = { ...G.look, ...item.look }; G.me.setLook(G.look); store.set('look', G.look); net.send({ t: 'look', lk: G.look }); G.me.emoji('✨');
    if (item.acc) toast(`「${item.n}」已收進 🎒 持ち物，可隨時穿戴`, 3000);
    G.me.say('換好了！好看嗎？'); toast(`完成「${item.zh}」！品質：${gname}`); seatBar(s, `✔ ${item.n}`); closeup(4, { dist: 2.4, h: .95, ang: .2, look: .75, spin: .45, keep: 1 });
  } else if (item.fortune) {
    const arr = FORTUNE[item.fortune]; const [h, t] = arr[Math.floor(Math.random() * arr.length)];
    $('#fortune').innerHTML = `<div class="kuji"><div class="kt">${h}</div><p>${t}</p><button onclick="this.closest('.modal').classList.add('hide')">收下</button></div>`; show('#fortune'); show('#panel', false);
    G.me.say(`抽到「${h}」！`); closeup(3.5, { dist: 1.8, h: 1.05, ang: .4, look: .95, keep: 1 });
  } else if (item.art) { show('#panel', false); setTimeout(() => ukiyoe(item.art, s), 300); }
  else if (item.bath) {
    const seat = W.bath.find(b => seatFree(b)) || W.bath[0]; closePanels();
    toast('前往對岸的露天風呂～'); sitAt(seat, 'bath'); setTimeout(() => G.me.say('呼～好舒服～'), 1200); closeup(5, { dist: 2.3, h: .55, ang: .35, look: .3, spin: .15, keep: 1 });
  }
}

// 當老闆
function claim(s) {
  if (G.owners[s.def.id] && G.owners[s.def.id] !== G.myId) return toast('這家店已經有老闆了');
  if (G.online) { net.send({ t: 'claim', s: s.def.id }); G.pendingClaim = s; }
  else { for (const k in G.owners) if (G.owners[k] === G.myId) delete G.owners[k]; G.owners[s.def.id] = G.myId; enterOwner(s); }
}
function enterOwner(s) {
  G.mode = 'owner'; G.shop = s; G.queue = []; G.pos.set(s.owner.x, s.owner.y, s.owner.z); G.ry = s.owner.r; G.me.play(0);
  cam.yaw = s.rot; cam.pitch = .05; cam.dist = 4.4; G.npcT = 6;
  if (!G.shopLight) { G.shopLight = new THREE.PointLight('#ffe2b8', 0, 7, 1.4); scene.add(G.shopLight); } G.shopLight.position.set(s.owner.x, 2.6, s.owner.z); G.shopLight.intensity = 6;
  toast(`「${s.def.name}」開店了！客人點餐後點訂單開始製作`, 3500); sfx(520, .2); setTimeout(() => sfx(780, .3), 150);
  renderOwner(); updPrompt();
}
function leaveOwner() {
  const s = G.shop; if (!s) return;
  if (G.online) net.send({ t: 'release', s: s.def.id }); delete G.owners[s.def.id];
  for (const c of G.npcCust) scene.remove(c.ch.root); G.npcCust = []; G.queue = []; mgAbort();
  G.mode = 'walk'; G.pos.set(s.front.x, 0, s.front.z); G.shop = null; show('#owner', false); updPrompt(); if (G.shopLight) G.shopLight.intensity = 0;
}
function renderOwner() {
  if (G.mode !== 'owner') return show('#owner', false);
  const s = G.shop; const el = $('#owner');
  el.innerHTML = `<div class="oh"><b>🏮 ${s.def.name} 營業中</b><button id="bClose">收店</button></div>
  <div class="oq">${G.queue.length ? G.queue.map((o, i) => `<button class="oi" data-i="${i}"><span>${o.npc ? '🧑' : '👤'} ${o.n}</span><b>${o.item.n}</b><small>${o.item.p}文</small></button>`).join('') : '<p class="sub">等待客人上門…<br>（玩家客人或 NPC 町人會來點餐）</p>'}</div>`;
  show('#owner'); $('#bClose').onclick = leaveOwner;
  el.querySelectorAll('.oi').forEach(b => b.onclick = () => startMG(G.queue[+b.dataset.i]));
}
function npcCustomerTick(dt) {
  if (G.mode !== 'owner') return;
  G.npcT -= dt; if (G.npcT > 0) return;
  G.npcT = 16 + Math.random() * 18;
  if (G.npcCust.length >= 2) return;
  const s = G.shop; const seat = s.seats.find(seatFree); if (!seat) return;
  const ch = new Chara(randomLook(), ''); ch.root.position.set(seat.x, seat.y, seat.z); ch.root.rotation.y = seat.r; ch.play(3); scene.add(ch.root);
  const item = s.def.menu.filter(m => m.p > 0)[Math.floor(Math.random() * s.def.menu.filter(m => m.p > 0).length)];
  const nm = NPCS[Math.floor(Math.random() * NPCS.length)].nm;
  const c = { ch, seat }; G.npcCust.push(c);
  setTimeout(() => { if (G.mode !== 'owner') return; ch.say(`${item.n}，麻煩了！`, 4); G.queue.push({ oid: uid(), item, npc: c, n: nm }); renderOwner(); sfx(990, .15); }, 1200);
}

// ---------- 做菜小遊戲 ----------
const MG = { on: false };
function startMG(o) {
  if (MG.on) return;
  Object.assign(MG, { on: true, o, i: 0, scores: [], st: null }); closeup(999, { dist: 2.3, h: 1.55, ang: .35, look: 1.2, keep: 1 });
  show('#mg'); show('#owner', false); G.me.play(4); nextStep();
}
function nextStep() {
  const steps = MG.o.item.steps;
  if (MG.i >= steps.length) return finishMG();
  const s = steps[MG.i]; MG.st = { g: s.g, t: 0, v: 0, n: 0, held: false, done: false };
  if (s.g === 'tap') { MG.st.zc = .25 + Math.random() * .5; MG.st.zw = .14; MG.st.sp = 1.1 + Math.random() * .5 + MG.i * .1; }
  if (s.g === 'hold') { MG.st.zc = .72 + Math.random() * .12; MG.st.zw = .1; }
  if (s.g === 'mash') { MG.st.need = 10; MG.st.lim = 3.2; }
  $('#mgItem').textContent = `${MG.o.item.n}（${MG.o.n}）`;
  $('#mgStep').innerHTML = `${MG.i + 1}/${steps.length}　<b>${s.n}</b>　${s.zh}`;
  $('#mgHint').textContent = s.g === 'tap' ? '指針到紅框時按下！' : s.g === 'hold' ? '按住，到紅框時放開！' : '快速連打！';
  $('#mgBtn').textContent = s.g === 'mash' ? '連打！' : s.g === 'hold' ? '按住' : '就是現在！';
  const z = $('#mgZone'); if (MG.st.zc != null) { z.style.display = 'block'; z.style.left = (MG.st.zc - MG.st.zw / 2) * 100 + '%'; z.style.width = MG.st.zw * 100 + '%'; } else z.style.display = 'none';
}
function mgPress(down) {
  if (!MG.on || !MG.st || MG.st.done) return;
  const st = MG.st;
  if (st.g === 'tap' && down) { const d = Math.abs(st.v - st.zc); stepDone(d < st.zw / 2 ? 100 - d / (st.zw / 2) * 25 : Math.max(10, 70 - d * 200)); }
  if (st.g === 'mash' && down) { st.n++; sfx(400 + st.n * 40, .05, 'square', .03); if (st.n >= st.need) stepDone(100 - Math.max(0, st.t - 1.6) * 20); }
  if (st.g === 'hold') { if (down && !st.held) st.held = true; else if (!down && st.held) { const d = Math.abs(st.v - st.zc); stepDone(d < st.zw / 2 ? 100 - d / (st.zw / 2) * 25 : Math.max(10, 70 - d * 220)); } }
}
function stepDone(sc) {
  const st = MG.st; st.done = true; sc = Math.max(0, Math.min(100, sc)); MG.scores.push(sc);
  const [g, c] = grade(sc); const f = $('#mgFlash'); f.textContent = g; f.style.color = c; f.classList.remove('pop'); void f.offsetWidth; f.classList.add('pop');
  sfx(sc >= 85 ? 1046 : sc >= 60 ? 784 : 392, .18, 'triangle', .07);
  setTimeout(() => { MG.i++; nextStep(); }, 550);
}
function updMG(dt) {
  if (!MG.on || !MG.st || MG.st.done) return;
  const st = MG.st; st.t += dt;
  if (st.g === 'tap') { st.v = (Math.sin(st.t * st.sp * PI) + 1) / 2; }
  if (st.g === 'hold') { if (st.held) st.v = Math.min(1.05, st.v + dt * .55); if (st.v >= 1.05) stepDone(15); }
  if (st.g === 'mash') { st.v = st.n / st.need; if (st.t > st.lim) stepDone(st.n / st.need * 70); }
  $('#mgNeedle').style.left = Math.min(1, st.v) * 100 + '%'; $('#mgFill').style.width = (st.g === 'tap' ? 0 : Math.min(1, st.v) * 100) + '%';
}
function finishMG() {
  const q = MG.scores.reduce((a, b) => a + b, 0) / MG.scores.length; const o = MG.o; MG.on = false; show('#mg', false); if (G.cu) G.cu.t = Math.max(G.cu.t, G.cu.dur - .7);
  G.me.play(0); G.queue = G.queue.filter(x => x !== o);
  const [g] = grade(q); const bonus = Math.round(o.item.p * (q >= 85 ? .5 : q >= 60 ? .2 : 0));
  addMoney(o.item.p + bonus, `${g}${bonus ? '（含獎金 ' + bonus + '）' : ''}`);
  toast(`完成「${o.item.n}」品質：${g}，送給 ${o.n}！`);
  if (o.npc) {
    const c = o.npc; if (o.item.dish) placeDish(o.item, c.seat.dish, c.seat.r, 6); c.ch.play(o.item.dish ? 5 : 3);
    if (o.item.look) { c.ch.setLook({ ...c.ch.look, ...o.item.look }); }
    setTimeout(() => c.ch.say(['好好吃！', '好吃！', '好手藝！', '下次再來！'][Math.floor(Math.random() * 4)], 3), 2500);
    setTimeout(() => { scene.remove(c.ch.root); G.npcCust = G.npcCust.filter(x => x !== c); }, 7000);
  } else {
    net.send({ t: 'serve', to: o.from, oid: o.oid, item: o.item.id, q: Math.round(q), s: G.shop.def.id });
  }
  renderOwner();
}
function mgAbort() { MG.on = false; show('#mg', false); if (G.cu) G.cu.t = Math.max(G.cu.t, G.cu.dur - .7); }
function placeDishFor(r, item) {
  const p = r.ch.root.position; const seat = W.seats.find(s => Math.hypot(s.x - p.x, s.z - p.z) < .6);
  placeDish(item, seat ? seat.dish : new THREE.Vector3(p.x, p.y + .5, p.z), seat ? seat.r : 0, 7);
}
const mgB = $('#mgBtn');
mgB.addEventListener('pointerdown', e => { e.preventDefault(); mgPress(true); });
mgB.addEventListener('pointerup', e => { e.preventDefault(); mgPress(false); });
mgB.addEventListener('pointerleave', () => { if (MG.st && MG.st.g === 'hold' && MG.st.held) mgPress(false); });

// ---------- 持ち物：買過的飾品可隨時穿戴 ----------
const SLOTS = ['hat', 'hs', 'm', 'w', 'c', 'b'];
function invGet() { return store.get('inv_' + (G.name || ''), []); }
function invAdd(id) { const v = invGet(); if (!v.includes(id)) { v.push(id); store.set('inv_' + G.name, v); } }
function invMigrate() { for (const a of ACC) if (G.look[a.slot] === a.v) invAdd(a.id); if (G.look.hat === 4) invAdd('kitsune'); if (G.look.hat === 2) invAdd('tamakan'); }
function equip(a, on) {
  const lk = { ...G.look };
  if (a.slot === 'm' && lk.hat === 4) lk.hat = 0; if (a.slot === 'hs' && lk.hat === 2) lk.hat = 0;
  lk[a.slot] = on ? a.v : 0; G.look = lk; G.me.setLook(lk); store.set('look', lk); net.send({ t: 'look', lk });
}
function openInv() {
  const own = invGet(); const p = $('#panel');
  const groups = SLOTS.map(sl => { const items = ACC.filter(a => a.slot === sl && own.includes(a.id)); if (!items.length) return '';
    return `<p class="sub" style="margin:8px 0 4px">${SLOT_NAME[sl]}</p><div class="chips">${items.map(a => `<button class="chipw inv${G.look[a.slot] === a.v ? ' on' : ''}" data-id="${a.id}">${a.n}<small> ${a.zh}</small></button>`).join('')}</div>`; }).join('');
  p.innerHTML = `<h2>🎒 持ち物<small>點一下穿上／卸下</small></h2>${groups || '<p class="sub">還沒有飾品，去日本橋附近的「紅屋」小間物店逛逛吧！</p>'}
  <div class="btns" style="margin-top:12px"><button id="invOff">全部卸下</button><button id="invX">關閉</button></div>`;
  show('#panel');
  p.querySelectorAll('.inv').forEach(b => b.onclick = () => { const a = ACC.find(x => x.id === b.dataset.id); equip(a, G.look[a.slot] !== a.v); openInv(); closeup(2.8, { dist: 2.4, h: 1.2, ang: .35, look: 1, spin: .5 }); });
  $('#invOff').onclick = () => { const lk = { ...G.look }; SLOTS.forEach(sl => lk[sl] = 0); if (lk.hat === 2 || lk.hat === 4) lk.hat = 0; G.look = lk; G.me.setLook(lk); store.set('look', lk); net.send({ t: 'look', lk }); openInv(); };
  $('#invX').onclick = closePanels;
}

// ---------- 手持食物 ----------
function itemById(fid) { const [sid, iid] = String(fid || '').split(':'); const sh = SHOPS.find(x => x.id === sid); return sh && sh.menu.find(m => m.id === iid); }
// 拿在手上的樣子要像商品本身（糰子是一串、壽司是一貫…），bites＝會被一口口吃掉的部分
function makeHeld(d) {
  const g = new THREE.Group(), c = d.c || [], bites = []; g.userData.bites = bites;
  const M_ = (geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, typeof col === 'string' ? dm(col) : col); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; };
  const chop = () => { for (const dx of [-.008, .008]) M_(new THREE.CylinderGeometry(.003, .002, .2, 4), '#5a3a24', dx, .1, -.02, .25, 0, 1.2); };
  switch (d.type) {
    case 'skewer': {
      M_(new THREE.CylinderGeometry(.004, .004, .26, 4), '#d8c08a', 0, .06, 0);
      if (c.length === 2 && c[0] === c[1]) { const b = M_(new THREE.CapsuleGeometry(.026, .09, 4, 8), c[0], 0, .14, 0); b.scale.set(1, 1, .8); bites.push(b); const t = M_(new THREE.ConeGeometry(.02, .04, 6), '#e86a3a', 0, .24, 0); bites.push(t); }
      else (c.length ? c : ['#ccc']).forEach((cc, i) => bites.unshift(M_(new THREE.SphereGeometry(.028, 12, 10), cc, 0, .08 + i * .055, 0)));
      if (c.every(x => x === '#b07a3a')) bites.forEach(b => b.material = new THREE.MeshStandardMaterial({ color: '#a8702c', roughness: .25, metalness: .05 }));
      g.rotation.x = .9; break;
    }
    case 'sushi': { M_(new THREE.BoxGeometry(.055, .028, .032), '#f6f2ea', 0, 0, 0); const t = M_(new THREE.BoxGeometry(.06, .012, .038), c[0], 0, .02, 0); bites.push(g.children[0], t); g.rotation.x = .9; break; }
    case 'bowl': case 'zaru': {
      if (d.type === 'bowl') { M_(BOWL, '#7a1f1f', 0, 0, 0, 0, 0, 0, .8, .8, .8); const soup = M_(new THREE.CircleGeometry(.115, 16), c[0], 0, .066, 0, -PI / 2); const n = M_(new THREE.TorusGeometry(.05, .016, 6, 12), c[1] || '#d8c69a', 0, .07, 0, PI / 2); bites.push(n); if (c[1] === '#e0a046') bites.push(M_(new THREE.CapsuleGeometry(.018, .07, 4, 8), '#e0a046', .02, .085, 0, 0, 0, PI / 2)); }
      else { M_(new THREE.BoxGeometry(.2, .02, .2), '#b89a5a', 0, 0, 0); const n = M_(new THREE.SphereGeometry(.07, 10, 6), c[0], 0, .03, 0, 0, 0, 0, 1, .35, 1); bites.push(n); }
      chop(); g.rotation.x = .9; break;
    }
    case 'cup': { const cup = M_(new THREE.CylinderGeometry(.045, .035, .07, 14), '#4a3a2e', 0, .035, 0); const t = M_(new THREE.CircleGeometry(.04, 14), c[0], 0, .068, 0, -PI / 2); bites.push(t); g.rotation.x = .9; break; }
    case 'tokkuri': { M_(new THREE.CylinderGeometry(.03, .02, .03, 12), '#f4f0e4', 0, .015, 0); bites.push(M_(new THREE.CircleGeometry(.026, 12), '#f0e6c0', 0, .029, 0, -PI / 2)); g.rotation.x = .9; break; }
    case 'box': { M_(new THREE.BoxGeometry(.16, .05, .12), '#1a1414', 0, .025, 0); const t = M_(new THREE.BoxGeometry(.14, .015, .1), c[0], 0, .055, 0); M_(new THREE.BoxGeometry(.165, .052, .01), '#a8282a', 0, .025, .06); bites.push(t); chop(); g.rotation.x = .9; break; }
    default: { // 和菓子・冷奴・炸什錦：放在懷紙上
      M_(new THREE.PlaneGeometry(.13, .13), '#f8f6f0', 0, 0, 0, -PI / 2, 0, PI / 4);
      if (c[0] === '#3a1a1a') bites.push(M_(new THREE.BoxGeometry(.05, .035, .025), '#3a1a1a', -.025, .018, 0), M_(new THREE.BoxGeometry(.05, .035, .025), '#3a1a1a', .03, .018, 0));
      else if (c[0] === '#f2b8d0') for (let i = 0; i < 7; i++) bites.push(M_(new THREE.IcosahedronGeometry(.012, 0), ['#f2b8d0', '#b8d8f2', '#f4efe2', '#f2e2a0'][i % 4], (i % 3 - 1) * .025, .014, (Math.floor(i / 3) - 1) * .025));
      else (c.length ? c.slice(0, 2) : ['#ccc']).forEach((cc, i) => bites.push(M_(new THREE.SphereGeometry(.035, 12, 10), cc, -.022 + i * .045, .024, 0, 0, 0, 0, 1, .7, 1)));
      g.rotation.x = .9;
    }
  }
  return g;
}
Chara.foodModel = fid => { const it = itemById(fid); return it && it.dish ? makeHeld(it.dish) : null; };
function setHeld(fid) {
  G.look = { ...G.look, f: fid || '' }; G.me.setLook(G.look); store.set('look', G.look); net.send({ t: 'look', lk: G.look }); updHeld();
}
function updHeld() {
  const it = itemById(G.look.f); const el = $('#held');
  if (!it) { el.classList.add('hide'); return; }
  el.innerHTML = `<span>手上：<b>${it.n}</b></span><button id="bEat">🍡 吃掉</button><button id="bDrop">放下</button>`; el.classList.remove('hide');
  $('#bEat').onclick = eatHeld; $('#bDrop').onclick = () => { setHeld(''); toast('把食物放下了'); };
}
function eatHeld() {
  const it = itemById(G.look.f); if (!it || G.eatT > 0) return;
  if (G.mode !== 'walk' && G.mode !== 'seat' && G.mode !== 'bath') return toast('現在不方便吃東西');
  G.eatT = 4; G.eatItem = it; $('#held').classList.add('hide');
  closeup(4.4, G.mode === 'seat' ? { dist: 1.6, h: 1.05, ang: .55, look: .95, keep: 1 } : G.mode === 'bath' ? { dist: 1.8, h: .5, ang: .5, look: .4, keep: 1 } : { dist: 1.7, h: 1.4, ang: .5, look: 1.2 });
}
function finishEat() {
  const it = G.eatItem; setHeld(''); const lines = ['好好吃！', '好吃！', '真是極品～', '這味道太棒了', '吃飽了，謝謝招待！'];
  G.me.say(lines[Math.floor(Math.random() * lines.length)]); G.me.emoji('😋'); net.send({ t: 'emote', e: '😋' });
  if (G.shop && G.mode === 'seat') openMenu(G.shop);
}

// ---------- 點選玩家：互動選單 ----------
const ray = new THREE.Raycaster(); let pdown = null;
renderer.domElement.addEventListener('pointerdown', e => { pdown = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!pdown || G.mode === 'title' || cam.auto) return; const d = Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y); if (d > 8 || performance.now() - pdown.t > 450) return;
  const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(v, camera);
  const cands = []; for (const [id, r] of G.remotes) cands.push({ id, root: r.ch.root, kind: 'p' }); for (const n of NPCS) if (n.ch.root.visible) cands.push({ npc: n, root: n.ch.root, kind: 'n' });
  let best = null, bd = 1e9;
  for (const c of cands) { const hit = ray.intersectObject(c.root, true)[0]; if (hit && hit.distance < bd && hit.distance < 40) { bd = hit.distance; best = c; } }
  if (best) openCard(best);
});
function faceTo(p) { G.ry = Math.atan2(p.x - G.pos.x, p.z - G.pos.z); }
function openCard(c) {
  const el = $('#pcard'); const isN = c.kind === 'n';
  const R = isN ? null : G.remotes.get(c.id); const name = isN ? c.npc.nm : R.n; const gm = !isN && R.ch.gm;
  const has = !!itemById(G.look.f);
  let h = `<button class="close" data-x>✕</button><h3>${gm ? '👑 ' : ''}${esc(name)}<small>${isN ? '町人（NPC）' : gm ? 'GM' : '玩家'}</small></h3><div class="pc">`;
  h += `<button data-k="hi">👋 打招呼</button><button data-k="five">🤝 擊掌</button>`;
  if (isN) h += `<button data-k="talk">💬 聊天</button>${has ? '<button data-k="food">🍡 請他吃</button>' : ''}`;
  else h += `<button data-k="g10">🎁 送 10 文</button><button data-k="g50">🎁 送 50 文</button>${has ? '<button data-k="food">🍡 送手上的食物</button>' : ''}<button data-k="w">🤫 悄悄話</button><button data-k="follow">🧭 跟著走</button>`;
  h += '</div>';
  if (G.gm && !isN) h += `<div class="pc gmrow"><button data-g="傳送">傳送過去</button><button data-g="召喚">召喚過來</button><button data-g="給">給 100 文</button><button data-g="禁言">禁言 10 分</button><button data-g="解禁">解禁</button><button data-g="踢">踢出</button></div>`;
  el.innerHTML = h; el.classList.remove('hide');
  el.querySelector('[data-x]').onclick = () => el.classList.add('hide');
  const tp = () => isN ? c.npc.ch.root.position : R.ch.root.position;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k, p = tp(), dist = Math.hypot(p.x - G.pos.x, p.z - G.pos.z); el.classList.add('hide');
    if ((k === 'five' || k === 'food') && dist > 3.5) return toast('靠近一點才能' + (k === 'five' ? '擊掌' : '遞食物'));
    if (G.mode === 'walk') faceTo(p);
    if (k === 'hi') { emote(7, 2); if (isN) { npcTalk(c.npc, ['你好！', '你好呀～', '今天天氣真好！'][Math.floor(Math.random() * 3)]); c.npc.ch.emoji('👋'); } else net.send({ t: 'act', to: c.id, k: 'hi' }); }
    if (k === 'five') { emote(16, 1.6); if (isN) { npcTalk(c.npc, '耶～！'); c.npc.ch.play(16); c.npc.five = 1.6; } else net.send({ t: 'act', to: c.id, k: 'five' }); sfx(1200, .08, 'square', .05); }
    if (k === 'talk') npcTalk(c.npc);
    if (k === 'g10' || k === 'g50') { const v = k === 'g10' ? 10 : 50; if (!afford(v)) return toast('錢不夠'); addMoney(-v, '送給 ' + name); net.send({ t: 'act', to: c.id, k: 'gift', v }); }
    if (k === 'food') { const it = itemById(G.look.f); const f = G.look.f; setHeld(''); if (isN) { npcTalk(c.npc, `謝謝你的${it.n}！`); npcEat(c.npc, f); } else { net.send({ t: 'act', to: c.id, k: 'food', v: f }); toast(`把「${it.n}」送給 ${name}`); } }
    if (k === 'w') { G.whisper = { id: c.id, n: name }; openChat(); $('#chatIn').placeholder = `悄悄話給 ${name}…`; }
    if (k === 'follow') { G.follow = c.id; toast(`跟著 ${name} 走（移動就會取消）`); }
  });
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { el.classList.add('hide'); net.send({ t: 'chat', s: `/${b.dataset.g} ${name}` }); });
}
function fxFor(id, a, dur) { if (id === G.myId) { if (G.mode === 'walk') emote(a, dur); return; } const R = G.remotes.get(id); if (R) { R.ov = a; R.ovT = dur; } }

// ---------- 公告、系統訊息 ----------
function logLine(html, cls) { const log = $('#log'); const li = document.createElement('div'); li.innerHTML = html; if (cls) li.className = cls; log.appendChild(li); while (log.children.length > 8) log.firstChild.remove(); setTimeout(() => li.classList.add('old'), 20000); }
function announce(s, n) { const b = $('#banner'); b.innerHTML = `<small>📜 ${esc(n || 'GM')} 公告</small>${esc(s)}`; b.classList.remove('hide'); clearTimeout(announce.h); announce.h = setTimeout(() => b.classList.add('hide'), 8000); logLine(`📜 <b>公告</b>：${esc(s)}`, 'sys'); sfx(660, .3); setTimeout(() => sfx(880, .4), 200); }

// ---------- GM 面板：五條街線上名單＋遠端管理（不用走到玩家旁邊）----------
const ROOM_ZH = { edo1: '一丁目', edo2: '二丁目', edo3: '三丁目', edo4: '四丁目', edo5: '五丁目' };
const GMS = { tab: 'all', q: '', rooms: null, timer: null };
function placeName(x, z) {
  if (x > 140 && z < -38) return '東光寺'; if (x > 100 && x < 118) return '日本橋'; if (z < -20) return '神社一帶'; if (x < -90) return '町西';
  let best = '大街', bd = 9e9; for (const sh of SHOPS) { const d = Math.abs(sh.x - x) + Math.abs((sh.side || 1) * 11 - z); if (d < bd) { bd = d; best = sh.name || best; } } return bd < 14 ? best + '前' : '大街';
}
function openGM() {
  const el = $('#gmPanel .card');
  el.innerHTML = `<button class="close" data-close>✕</button><h3>👑 町奉行所（GM 管理）</h3>
  <div class="gmtabs"><button data-gt="list" class="on">📜 人別帳</button><button data-gt="town">🏮 全町</button></div>
  <div id="gmBody"></div>`;
  show('#gmPanel');
  el.querySelector('[data-close]').onclick = () => { show('#gmPanel', false); clearInterval(GMS.timer); };
  el.querySelectorAll('[data-gt]').forEach(b => b.onclick = () => { el.querySelectorAll('[data-gt]').forEach(x => x.classList.toggle('on', x === b)); GMS.view = b.dataset.gt; drawGM(); });
  GMS.view = 'list'; drawGM(); net.send({ t: 'gml' });
  clearInterval(GMS.timer); GMS.timer = setInterval(() => { if ($('#gmPanel').classList.contains('hide')) return clearInterval(GMS.timer); net.send({ t: 'gml' }); }, 4000);
}
function gmAct(room, id, a, v) { net.send({ t: 'gma', room, id, a, v }); }
function drawGM() {
  const b = $('#gmBody'); if (!b) return;
  if (GMS.view === 'town') {
    b.innerHTML = `<p class="sub">全町公告（五條街同時看到）</p><div class="row"><input id="gmAnn" placeholder="公告內容" maxlength="120"><button id="gmAnnB">📜 本街</button><button id="gmAnnAll">📣 全町</button></div>
    <p class="sub" style="margin-top:12px">本街時間</p><div class="btns">${[['🌅 清晨', .27], ['☀ 正午', .5], ['🌇 黃昏', .755], ['🌙 夜晚', .9]].map(([t, v]) => `<button data-t="${v}">${t}</button>`).join('')}</div>
    <p class="sub" style="margin-top:12px">前往其他街</p><div class="btns">${[1, 2, 3, 4, 5].map(i => `<button data-go="${i}" ${G.room === i ? 'disabled' : ''}>${ROOM_ZH['edo' + i]}</button>`).join('')}</div>
    <p class="sub" style="margin-top:10px">聊天框也能打指令：/公告 文字、/時間 0.75、/傳送 名字、/召喚 名字、/給 名字 數量、/禁言 名字 分鐘、/解禁 名字、/踢 名字</p>`;
    $('#gmAnnB').onclick = () => { const v = $('#gmAnn').value.trim(); if (v) net.send({ t: 'chat', s: '/公告 ' + v }); $('#gmAnn').value = ''; };
    $('#gmAnnAll').onclick = () => { const v = $('#gmAnn').value.trim(); if (v) net.send({ t: 'gma', a: 'announceAll', v }); $('#gmAnn').value = ''; };
    b.querySelectorAll('[data-t]').forEach(x => x.onclick = () => net.send({ t: 'chat', s: '/時間 ' + x.dataset.t }));
    b.querySelectorAll('[data-go]').forEach(x => x.onclick = () => switchRoom(+x.dataset.go));
    return;
  }
  const R = GMS.rooms; if (!R) { b.innerHTML = '<p class="sub">讀取人別帳中…</p>'; return; }
  const all = Object.entries(R).sort().flatMap(([r, l]) => l.map(p => ({ ...p, room: r })));
  const counts = Object.fromEntries(Object.entries(R).map(([r, l]) => [r, l.length]));
  const q = GMS.q.trim(); const list = all.filter(p => (GMS.tab === 'all' || p.room === GMS.tab) && (!q || p.n.includes(q)));
  const myRoom = 'edo' + G.room;
  b.innerHTML = `<div class="gmhead"><input id="gmQ" placeholder="🔍 找名字" value="${esc(q)}"><span class="sub">共 ${all.length} 人在線</span></div>
  <div class="gmrooms"><button data-rt="all" class="${GMS.tab === 'all' ? 'on' : ''}">全部 ${all.length}</button>${Object.keys(ROOM_ZH).map(r => `<button data-rt="${r}" class="${GMS.tab === r ? 'on' : ''}">${ROOM_ZH[r]} ${counts[r] || 0}${r === myRoom ? ' ★' : ''}</button>`).join('')}</div>
  <div class="gml2">${list.map(p => `<div class="gmp${p.mute ? ' muted' : ''}" data-id="${p.id}" data-room="${p.room}">
    <div class="who"><b>${p.gm ? '👑 ' : ''}${esc(p.n)}</b><small>${ROOM_ZH[p.room] || p.room}・${placeName(p.x, p.z)}${p.shop ? '・🏮 開店中' : ''}・${p.t} 分鐘${p.mute ? `・🔇 禁言 ${p.mute} 分` : ''}${p.st ? `・⚠ ${p.st}` : ''}</small></div>
    ${p.gm ? '' : `<div class="ops"><button data-a="tp" title="傳送到他身邊">🚶 前往</button><button data-a="summon" title="叫他過來（同街）" ${p.room !== myRoom ? 'disabled' : ''}>🫴 召喚</button><button data-a="give">💰 +100</button><button data-a="warn">📢 提醒</button>${p.mute ? '<button data-a="unmute">🔊 解禁</button>' : '<button data-a="mute">🔇 禁言10分</button>'}<button data-a="kick" class="danger">🚪 踢出</button></div>`}
  </div>`).join('') || '<p class="sub">沒有符合的玩家</p>'}</div>`;
  const qi = $('#gmQ'); qi.oninput = () => { GMS.q = qi.value; const pos = qi.selectionStart; drawGM(); const n = $('#gmQ'); n.focus(); n.setSelectionRange(pos, pos); };
  b.querySelectorAll('[data-rt]').forEach(x => x.onclick = () => { GMS.tab = x.dataset.rt; drawGM(); });
  b.querySelectorAll('.gmp [data-a]').forEach(x => x.onclick = () => {
    const row = x.closest('.gmp'), a = x.dataset.a, n = row.querySelector('b').textContent;
    if (a === 'kick' && x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = '再按一次確認'; setTimeout(() => { if (x.isConnected) { x.dataset.sure = ''; x.textContent = '🚪 踢出'; } }, 3000); return; }
    gmAct(row.dataset.room, row.dataset.id, a, a === 'mute' ? 10 : a === 'give' ? 100 : undefined);
    if (a === 'tp') toast(`前往 ${n} 身邊…`);
  });
}
net.on('gml', m => { GMS.rooms = m.rooms; if (!$('#gmPanel').classList.contains('hide') && GMS.view === 'list' && document.activeElement?.id !== 'gmQ') drawGM(); });
net.on('gmgo', m => switchRoom(+String(m.room).replace('edo', ''), m.x, m.z));
async function switchRoom(i, x, z) {
  if (!G.online || i === G.room) return;
  toast(`前往江戶町${ROOM_ZH['edo' + i]}…`);
  G.switching = true; try { net.ws.onclose = null; net.ok = false; net.ws.close(); } catch (e) {}
  for (const id of [...G.remotes.keys()]) delRemote(id); for (const k in G.owners) if (G.owners[k] !== G.myId) delete G.owners[k];
  const r = await net.connect({ n: G.name, lk: G.look, x: x ?? G.pos.x, z: z ?? G.pos.z, k: store.get('gmk', '') }, 'edo' + i);
  G.switching = false;
  if (r !== 'ok') { toast(r === 'full' ? '那條街客滿了' : '連線失敗'); G.online = r === 'full' ? G.online : false; if (r === 'full') await net.connect({ n: G.name, lk: G.look, x: G.pos.x, z: G.pos.z, k: store.get('gmk', '') }, 'edo' + G.room); return; }
  G.online = true; G.room = i; if (x != null) { G.pos.set(x, heightAt(x, z), z); } updCount(); toast(`已到江戶町${ROOM_ZH['edo' + i]}`);
}

// ---------- 東光寺：參拜・投幣・搖鈴・撞鐘 ----------
const TEMPLE_WISH = ['心願成就', '身體健康', '開運招福', '學業進步', '生意興隆', '闔家平安', '良緣到來', '旅途平安'];
function openTemple() {
  const p = $('#panel');
  p.innerHTML = `<h2>東光寺 大佛殿<small>參拜</small></h2><p class="sub">寺院參拜不拍手：投香油錢、搖鈴，再雙手合十。身上：<b>${G.gm ? '∞' : G.money}</b> 文</p>
  <div class="btns"><button id="tc1">🪙 投 1 文</button><button id="tc5">🪙 投 5 文（結緣）</button><button id="tg">🔔 搖鈴</button><button id="tp" class="big alt">🙏 合掌參拜</button></div>
  <button class="close" id="bX">✕</button>`;
  show('#panel'); $('#bX').onclick = closePanels;
  $('#tc1').onclick = () => templeCoin(1); $('#tc5').onclick = () => templeCoin(5);
  $('#tg').onclick = templeGong; $('#tp').onclick = () => wishPrompt('東光寺 大佛殿', '雙手合十，寫下你的心願', 17);
  G.ry = PI; // 面向大殿
}
function templeCoin(v) {
  if (!afford(v)) return toast('身上的錢不夠');
  addMoney(-v, '香油錢'); G.coinT = performance.now();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .015, 14), new THREE.MeshStandardMaterial({ color: '#d9b44a', metalness: .9, roughness: .25 }));
  const a = G.pos.clone().add(new THREE.Vector3(.15, 1.3, -.2)), b = new THREE.Vector3(W.temple.gong.x, 1.15, -74.3);
  scene.add(c); let t = 0; const fly = () => { t += .03; const k = Math.min(1, t / .6); c.position.lerpVectors(a, b, k); c.position.y += Math.sin(k * PI) * 1.2; c.rotation.x += .5; c.rotation.z += .3; if (k < 1) requestAnimationFrame(fly); else setTimeout(() => scene.remove(c), 200); }; fly();
  emote(16, .8); SND.coin(1); net.send({ t: 'emote', e: '🪙' }); closeup(1.9, { dist: 2.3, h: 1.5, ang: 1.1, look: 1.2 });
}
function templeGong() {
  W.ringRope(); emote(16, 1.2); setTimeout(() => SND.gong(1), 250); net.send({ t: 'emote', e: '🔔' }); closeup(2.4, { dist: 2.6, h: 1.9, ang: 1.0, look: 1.9 });
}
// 祈福：讓玩家自己寫心願（最多 40 字，會過濾不雅字）
function wishPrompt(title, hint, anim) {
  const p = $('#panel');
  p.innerHTML = `<h2>${title}<small>祈福</small></h2><p class="sub">${hint}（可留空，最多 40 字）</p>
  <input id="wishIn" maxlength="40" placeholder="例：希望家人身體健康" autocomplete="off">
  <div class="chips">${TEMPLE_WISH.map(w => `<button class="chipw">${w}</button>`).join('')}</div>
  <div class="btns"><button id="wishGo" class="big alt">🙏 送出祈福</button><button id="wishX">取消</button></div>`;
  show('#panel');
  const inp = $('#wishIn'); setTimeout(() => inp.focus(), 50);
  p.querySelectorAll('.chipw').forEach(b => b.onclick = () => { inp.value = b.textContent; inp.focus(); });
  const go = () => { const raw = inp.value.trim(); closePanels(); inp.blur(); doWish(raw, anim); };
  $('#wishGo').onclick = go; $('#wishX').onclick = closePanels;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } e.stopPropagation(); });
}
function doWish(raw, anim) {
  const r = cleanText(raw); if (r.bad) toast('祈福內容含不雅字詞，已被過濾');
  const text = r.text || TEMPLE_WISH[Math.floor(Math.random() * TEMPLE_WISH.length)];
  const gave = G.coinT && performance.now() - G.coinT < 60000;
  emote(anim, anim === 17 ? 3.6 : 2.4); net.send({ t: 'emote', e: '🙏' });
  closeup(anim === 17 ? 5.2 : 4.2, { dist: 1.75, h: 1.45, ang: .5, look: 1.22 });
  setTimeout(() => {
    const line = `🙏 願：${text}`;
    if (G.online) net.send({ t: 'chat', s: line }); else onChat(G.myId, line);
    if (gave && anim === 17) setTimeout(() => G.me.emoji('✨'), 600);
    toast(anim === 17 && gave ? '香油錢的心意，佛祖收到了 ✨' : '心願已經傳達了 🙏');
  }, anim === 17 ? 2400 : 1500);
}
let kaneCD = 0;
function ringKane() {
  if (performance.now() < kaneCD) return toast('鐘聲還在迴盪，稍等一下再撞');
  kaneCD = performance.now() + 9000; W.strike(); emote(16, 1.2); closeup(3.4, { dist: 3.4, h: 1.8, ang: 1.25, look: 1.6 }); setTimeout(() => { SND.bigBell(1); }, 500); net.send({ t: 'emote', e: '🏯' });
}
function templeFx(e, from) { // 其他玩家的寺院動作：在附近才聽得到
  if (!W.temple) return; const d = from.distanceTo(G.pos);
  if (e === '🔔') { W.ringRope(); SND.gong(Math.max(0, 1 - d / 40)); }
  if (e === '🪙') SND.coin(Math.max(0, 1 - d / 25));
  if (e === '🏯') { W.strike(); setTimeout(() => SND.bigBell(Math.max(.15, 1 - d / 260)), 500); }
}

// ---------- 奈良鹿 ----------
const DEER = [];
function makeDeer() {
  const g = new THREE.Group(); const fur = new THREE.MeshStandardMaterial({ color: '#9a6a3c', roughness: .9 }), white = new THREE.MeshStandardMaterial({ color: '#efe6d8', roughness: .9 }), dark = new THREE.MeshStandardMaterial({ color: '#2a1d14' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .55, 4, 10), fur); body.rotation.z = PI / 2; body.position.y = .78; body.rotation.y = PI / 2; g.add(body);
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4), white); sp.position.set((i % 2 ? .12 : -.12), .92, -.25 + i * .1); g.add(sp); }
  const legs = []; for (const [x, z] of [[-.12, .3], [.12, .3], [-.12, -.3], [.12, -.3]]) { const l = new THREE.Group(); l.position.set(x, .62, z); const m = new THREE.Mesh(new THREE.CylinderGeometry(.04, .03, .6, 6), fur); m.position.y = -.3; l.add(m); const h = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .08), dark); h.position.y = -.6; l.add(h); g.add(l); legs.push(l); }
  const neck = new THREE.Group(); neck.position.set(0, .92, .38); g.add(neck);
  const nm = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .45, 8), fur); nm.position.y = .2; nm.rotation.x = .35; neck.add(nm);
  const head = new THREE.Group(); head.position.set(0, .44, .1); neck.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), fur); hm.scale.set(.9, .9, 1.2); head.add(hm);
  const sn = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), fur); sn.position.set(0, -.04, .14); sn.scale.set(.9, .8, 1.2); head.add(sn);
  const no = new THREE.Mesh(new THREE.SphereGeometry(.028, 6, 5), dark); no.position.set(0, -.03, .22); head.add(no);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.022, 6, 5), dark); e.position.set(s * .07, .03, .08); head.add(e); const ear = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 6), fur); ear.position.set(s * .1, .1, -.02); ear.rotation.z = -s * 1.1; head.add(ear); }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), white); tail.position.set(0, .86, -.52); g.add(tail);
  g.traverse(o => o.castShadow = true);
  return { g, legs, neck, head };
}
function spawnDeer() {
  for (const [x, z] of [[160, -60], [196, -64], [170, -95], [150, -85], [205, -92]]) {
    const d = makeDeer(); d.g.position.set(x, 0, z); d.g.rotation.y = Math.random() * 6; scene.add(d.g);
    Object.assign(d, { tx: x, tz: z, wait: Math.random() * 5, phase: 0, bowT: 0 }); DEER.push(d);
  }
}
function deerTarget(d) { d.tx = 146 + Math.random() * 64; d.tz = -103 + Math.random() * 52; if (d.tx > 156 && d.tx < 200 && d.tz < -76) d.tz = -60; }
function petDeer(d) { d.bowT = 2.4; d.wait = 4; closeup(3, { dist: 2.6, h: 1.1, ang: 1.35, look: .8 }); d.g.rotation.y = Math.atan2(G.pos.x - d.g.position.x, G.pos.z - d.g.position.z); setTimeout(() => G.me.emoji('🦌'), 300); setTimeout(() => d.g.position && G.me.say(['小鹿向你鞠躬了！', '好可愛～', '牠好像想吃鹿仙貝'][Math.floor(Math.random() * 3)], 3), 900); }
function updDeer(dt) {
  for (const d of DEER) {
    const p = d.g.position; let moving = false;
    if (d.bowT > 0) { d.bowT -= dt; const e = Math.sin((2.4 - d.bowT) / 1.2 * PI); d.neck.rotation.x = Math.max(0, e) * 1.1; }
    else {
      d.neck.rotation.x *= .9;
      const pd = Math.hypot(G.pos.x - p.x, G.pos.z - p.z);
      if (pd < 3 && Math.random() < dt * .15) { d.bowT = 2.4; d.g.rotation.y = Math.atan2(G.pos.x - p.x, G.pos.z - p.z); }
      if (d.wait > 0) { d.wait -= dt; if (d.wait <= 0) deerTarget(d); if (Math.random() < dt * .3) d.head.rotation.x = (Math.random() - .3) * .8; }
      else {
        const dx = d.tx - p.x, dz = d.tz - p.z, dist = Math.hypot(dx, dz);
        if (dist < .4) d.wait = 3 + Math.random() * 7;
        else { const sp = .9, nx = p.x + dx / dist * sp * dt, nz = p.z + dz / dist * sp * dt; if (okAt(nx, nz)) { p.x = nx; p.z = nz; moving = true; } else d.wait = 1; d.g.rotation.y = angLerp(d.g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 4)); }
      }
    }
    d.phase += dt * (moving ? 9 : 0); d.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(d.phase + (i % 2 ? PI : 0) + (i > 1 ? PI / 2 : 0)) * .45 : l.rotation.x * .8);
  }
}

// ---------- 花魁道中：GM 花魁身邊的跟班（提燈男眾、兩位禿、撐傘男眾）----------
const RETINUE = new Map();
const RET_PLAN = [
  { role: 'lantern', off: [0, 2.3], look: { k: 6, p: 1, o: 1, h: 0, s: 1, ey: 3, br: 3, mo: 3, ck: 0 } },
  { role: 'kamuro', off: [-.6, 1.2], look: { k: 1, p: 5, o: 2, h: 4, s: 0, ey: 0, br: 0, mo: 1, ck: 2, hs: 1 } },
  { role: 'kamuro', off: [.6, 1.2], look: { k: 1, p: 5, o: 2, h: 4, s: 0, ey: 4, br: 0, mo: 0, ck: 2, hs: 1 } },
  { role: 'umbrella', off: [.45, -.8], look: { k: 3, p: 0, o: 1, h: 0, s: 1, ey: 1, br: 1, mo: 3, ck: 0 } },
];
function makeRetinue(boss) {
  const mem = RET_PLAN.map(pl => { const ch = new Chara(pl.look, ''); if (pl.role === 'kamuro') ch.root.scale.setScalar(.66); scene.add(ch.root); const b = boss.root.position; ch.root.position.copy(b); return { ...pl, ch }; });
  const lb = mem[0].ch; const lan = new THREE.Group(); lan.position.set(0, -.3, .2); lan.rotation.x = 1; lb.arms[1].add(lan);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .7, 5), dm('#3a2418')); pole.position.y = .3; lan.add(pole);
  const box = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .32, 14), new THREE.MeshStandardMaterial({ map: TX.text('花', { w: 256, h: 128, bg: '#f6efe0', fg: '#1a1210', vertical: false }), emissive: '#ffb050', emissiveIntensity: .6 })); box.position.y = .72; box.rotation.x = -1; lan.add(box);
  // 大紅傘（長竿撐在花魁頭頂）
  const umb = new THREE.Group(); scene.add(umb);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.15, .45, 24, 1, true), new THREE.MeshStandardMaterial({ map: TX.janome(), side: THREE.DoubleSide, roughness: .7 })); canopy.castShadow = true; umb.add(canopy);
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; const r = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.15, 3), dm('#e8dcc0')); r.position.set(Math.cos(a) * .55, -.12, Math.sin(a) * .55); r.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15); umb.add(r); }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1, 6), dm('#4a3424')); scene.add(shaft);
  return { mem, umb, shaft, boss };
}
function dropRetinue(ch) { const r = RETINUE.get(ch); if (!r) return; r.mem.forEach(m => scene.remove(m.ch.root)); scene.remove(r.umb); scene.remove(r.shaft); RETINUE.delete(ch); }
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function updRetinue(dt) {
  const bosses = [G.me, ...[...G.remotes.values()].map(r => r.ch)].filter(c => c && c.gm && G.mode !== 'title');
  for (const [ch] of RETINUE) if (!bosses.includes(ch)) dropRetinue(ch);
  for (const boss of bosses) {
    if (!RETINUE.has(boss)) RETINUE.set(boss, makeRetinue(boss));
    const R = RETINUE.get(boss), bp = boss.root.position, ry = boss.root.rotation.y, sn = Math.sin(ry), cs = Math.cos(ry);
    for (const m of R.mem) {
      const p = m.ch.root.position, tx = bp.x + m.off[0] * cs + m.off[1] * sn, tz = bp.z - m.off[0] * sn + m.off[1] * cs;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d > 8) { p.set(tx, bp.y, tz); }
      const sp = Math.min(d, Math.max(0, d - .05) * 3 * dt + (d > 1.5 ? d * dt * 2 : 0)); if (d > .001) { p.x += dx / d * sp; p.z += dz / d * sp; }
      p.y = heightAt(p.x, p.z) * (m.role === 'kamuro' ? 1 : 1);
      m.ch.root.rotation.y = angLerp(m.ch.root.rotation.y, d > .3 ? Math.atan2(dx, dz) : ry, Math.min(1, dt * 5));
      m.ch.play(d > .12 ? 1 : 0); m.ch.update(dt, d > .12 ? 2.4 : 0);
    }
    // 傘：竿子從撐傘男眾的手到花魁頭頂
    const ub = R.mem[3].ch.root.position; _v1.set(ub.x, ub.y + 1.05, ub.z); _v2.set(bp.x, bp.y + 2.75, bp.z);
    R.umb.position.lerp(_v2, Math.min(1, dt * 6)); R.umb.rotation.y += dt * .2;
    const dir = _v2.clone().sub(_v1); const len = dir.length(); R.shaft.position.copy(_v1).addScaledVector(dir, .5); R.shaft.scale.set(1, len, 1); R.shaft.quaternion.setFromUnitVectors(_up, dir.normalize());
  }
}

// ---------- 掌櫃叫賣 ----------
const CALLS = {
  soba: ['そば〜、あったかいそばはいかが〜', '熱騰騰的蕎麥麵喔～'], chaya: ['いらっしゃい、お茶でも一服どうぞ〜', '進來喝杯茶歇歇腳吧～'],
  sushi: ['へい、らっしゃい！握りたてだよ！', '現捏的壽司喔！'], tempura: ['揚げたての天ぷら、いかがっすか〜', '剛炸好的天婦羅～'],
  unagi: ['うなぎの蒲焼、いい匂いだよ〜', '烤鰻魚，香噴噴喔～'], izakaya: ['熱燗あるよ〜、寄ってきな', '有熱清酒，進來坐坐～'],
  dango: ['だんご〜、おいしいだんご〜', '好吃的糰子喔～'], wagashi: ['甘いお菓子はいかがですか〜', '甜甜的和菓子～'],
  gofuku: ['新しい反物、入りましたよ〜', '新布料到貨囉～'], kamiyui: ['髪結い、いかがですか〜', '要不要整理一下頭髮～'],
  komamono: ['かんざし、扇子、なんでもあるよ〜', '髮簪扇子應有盡有～'], ukiyoe: ['錦絵、新作入りました〜', '新出的浮世繪喔～'],
  ekisha: ['当たるも八卦、当たらぬも八卦〜', '來算個命吧～'], yuya: ['いい湯だよ〜、寄ってらっしゃい', '熱呼呼的好湯喔～'],
};
const callCD = {}; let callT = 3, callGlobal = 0;
function callTick(dt) {
  callT -= dt; callGlobal -= dt; if (callT > 0) return; callT = 1;
  if (callGlobal > 0) return;
  const cands = W.shops.filter(s => !G.owners[s.def.id] && CALLS[s.def.id] && (callCD[s.def.id] || 0) < performance.now() / 1000)
    .map(s => [s, Math.hypot(s.front.x - G.pos.x, s.front.z - G.pos.z)]).filter(([, d]) => d < 18).sort((a, b) => a[1] - b[1]);
  if (!cands.length || Math.random() < .35) return;
  const [s, d] = cands[Math.floor(Math.random() * Math.min(2, cands.length))]; const [ja, zh] = CALLS[s.def.id];
  callCD[s.def.id] = performance.now() / 1000 + 25 + Math.random() * 25; callGlobal = 7 + Math.random() * 6;
  const k = keepers[s.def.id]; if (k) { k.say(zh, 3.5); k.play(7); setTimeout(() => k.play(0), 1200); }
  SND.call(ja, zh, 1 - d / 20, .9 + (s.def.x % 7) / 30);
}

// ---------- 祭典遊戲：撈金魚、射的 ----------
function gameModal(title, hint) {
  const el = $('#pg'); el.innerHTML = `<div class="card pgc"><h3>${title}</h3><p class="sub" id="pgHint">${hint}</p><canvas id="pgc" width="360" height="240"></canvas><p class="sub" id="pgStat"></p></div>`;
  show('#pg'); const cv = $('#pgc'); return { cv, g: cv.getContext('2d'), stat: t => $('#pgStat').innerHTML = t, close: () => show('#pg', false) };
}
function cvPos(cv, e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
function playKingyo(shop) {
  const M2 = gameModal('🐟 金魚すくい', '點金魚把牠撈起來！紙網用 4 次就會破，限時 20 秒。');
  const fish = [...Array(8)].map((_, i) => ({ x: 40 + Math.random() * 280, y: 40 + Math.random() * 160, a: Math.random() * 6, v: 30 + Math.random() * 40, c: i % 3 ? '#f05a28' : (i % 2 ? '#e02a3a' : '#2a2a2a') }));
  let hp = 4, caught = 0, t = 20, last = performance.now(), mx = -99, my = -99, run = true, splash = [];
  M2.cv.onpointermove = e => { [mx, my] = cvPos(M2.cv, e); };
  M2.cv.onpointerdown = e => { if (!run) return; [mx, my] = cvPos(M2.cv, e); const f = fish.find(f => Math.hypot(f.x - mx, f.y - my) < 24);
    hp--; splash.push({ x: mx, y: my, t: .5 }); SND.pluck(f ? 880 : 330, .06);
    if (f && Math.random() < .78) { caught++; fish.splice(fish.indexOf(f), 1); G.me.emoji('🐟'); } if (hp <= 0 || !fish.length) end(); };
  const end = () => { if (!run) return; run = false; setTimeout(() => { M2.close();
    if (caught) { invAdd('kingyo'); G.look = { ...G.look, c: 7 }; G.me.setLook(G.look); store.set('look', G.look); net.send({ t: 'look', lk: G.look }); toast(`撈到 ${caught} 隻金魚！裝袋拿在手上了 🐟`, 3200); G.me.say(`撈到 ${caught} 隻！`); closeup(3.2, { dist: 2, h: 1.2, ang: .4, look: .95 }); }
    else { toast('紙網破了……下次再挑戰！', 2600); G.me.emoji('😢'); } }, 700); };
  const loop = () => { if (!$('#pg') || $('#pg').classList.contains('hide')) return; const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; if (run) { t -= dt; if (t <= 0) end(); }
    const g = M2.g; const gr = g.createRadialGradient(180, 120, 20, 180, 120, 220); gr.addColorStop(0, '#6ab8e0'); gr.addColorStop(1, '#2a6a98'); g.fillStyle = gr; g.fillRect(0, 0, 360, 240);
    for (const f of fish) { f.a += (Math.random() - .5) * dt * 3; if (Math.hypot(f.x - mx, f.y - my) < 50) f.a = Math.atan2(f.y - my, f.x - mx); f.x += Math.cos(f.a) * f.v * dt; f.y += Math.sin(f.a) * f.v * dt; if (f.x < 20 || f.x > 340) f.a = PI - f.a; if (f.y < 20 || f.y > 220) f.a = -f.a; f.x = Math.max(20, Math.min(340, f.x)); f.y = Math.max(20, Math.min(220, f.y));
      g.save(); g.translate(f.x, f.y); g.rotate(f.a); g.fillStyle = f.c; g.beginPath(); g.ellipse(0, 0, 13, 7, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-11, 0); g.lineTo(-22, -8 + Math.sin(now / 90) * 3); g.lineTo(-22, 8 + Math.sin(now / 90) * 3); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(7, -3, 2, 0, 7); g.fill(); g.restore(); }
    for (const sp of splash) { sp.t -= dt; g.strokeStyle = `rgba(255,255,255,${Math.max(0, sp.t * 2)})`; g.lineWidth = 2; g.beginPath(); g.arc(sp.x, sp.y, 30 - sp.t * 30, 0, 7); g.stroke(); }
    if (mx > 0) { g.strokeStyle = '#d8c08a'; g.lineWidth = 4; g.beginPath(); g.arc(mx, my, 24, 0, 7); g.stroke(); g.fillStyle = `rgba(255,255,255,${.12 + (4 - hp) * .06})`; g.fill(); }
    M2.stat(`紙網：${'■'.repeat(Math.max(0, hp))}${'□'.repeat(4 - Math.max(0, hp))}　撈到 <b>${caught}</b> 隻　剩 ${Math.max(0, t).toFixed(0)} 秒`);
    requestAnimationFrame(loop); };
  loop();
}
function playShateki(shop) {
  const M2 = gameModal('🎯 射的', '點獎品開槍！一共 5 發軟木塞，打倒就是你的。');
  const pool = ['kazaguruma', 'uchiwa', 'okame', 'tamakan', 'sensu', 'hyottoko', 'chochin', 'nekomen'];
  const prizes = pool.sort(() => Math.random() - .5).slice(0, 5).map((id, i) => ({ id, a: ACC.find(x => x.id === id), x: 40 + i * 70, w: 44, h: 52 - (i % 2) * 12, down: 0 }));
  let shots = 5, won = [], last = performance.now(), off = 0, corks = [], run = true;
  M2.cv.onpointerdown = e => { if (!run || shots <= 0) return; const [mx, my] = cvPos(M2.cv, e); shots--; corks.push({ x: mx, y: 230, ty: my, t: 0 }); SND.pluck(220, .08); };
  const end = () => { if (!run) return; run = false; setTimeout(() => { M2.close();
    if (won.length) { won.forEach(a => invAdd(a.id)); const a = won[0]; G.look = { ...G.look, [a.slot]: a.v }; G.me.setLook(G.look); store.set('look', G.look); net.send({ t: 'look', lk: G.look }); toast(`打中了：${won.map(a => a.zh).join('、')}！已收進 🎒 持ち物`, 3500); G.me.emoji('🎯'); closeup(3, { dist: 2.4, h: 1.2, ang: .4, look: 1 }); }
    else { toast('一個都沒打中……再試一次吧！', 2600); G.me.emoji('😅'); } }, 900); };
  const loop = () => { if ($('#pg').classList.contains('hide')) return; const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; off += dt;
    const g = M2.g; g.fillStyle = '#3a2418'; g.fillRect(0, 0, 360, 240); g.fillStyle = '#a8232e'; g.fillRect(0, 150, 360, 16); g.fillStyle = '#5a3a24'; g.fillRect(0, 166, 360, 74);
    for (const p of prizes) { const px = p.x + Math.sin(off * 1.4 + p.x) * 22; p.cx = px; if (p.down >= 1) continue; g.save(); g.translate(px, 150); g.rotate(-p.down * 1.4); g.fillStyle = ['#e8c56a', '#3f97ad', '#e84a6a', '#5c9a68', '#f4efe2'][prizes.indexOf(p)]; g.fillRect(-p.w / 2, -p.h, p.w, p.h); g.fillStyle = '#2a1d12'; g.font = '600 12px sans-serif'; g.textAlign = 'center'; g.fillText(p.a.zh.slice(0, 4), 0, -p.h / 2 + 4); g.restore(); if (p.down > 0) p.down = Math.min(1, p.down + dt * 3); }
    for (const c of corks) { if (c.done) continue; c.t += dt * 4; c.y = 230 + (c.ty - 230) * Math.min(1, c.t); g.fillStyle = '#c9a868'; g.beginPath(); g.arc(c.x, c.y, 6 - Math.min(1, c.t) * 3, 0, 7); g.fill();
      if (c.t >= 1) { c.done = true; const hit = prizes.find(p => !p.down && Math.abs(c.x - p.cx) < p.w / 2 && c.ty < 150 && c.ty > 150 - p.h); if (hit && Math.random() < .8) { hit.down = .01; won.push(hit.a); SND.pluck(988, .1); } } }
    M2.stat(`軟木塞：${'●'.repeat(shots)}${'○'.repeat(5 - shots)}　打中 <b>${won.length}</b> 個`);
    if (run && shots <= 0 && corks.every(c => c.done)) end();
    requestAnimationFrame(loop); };
  loop();
}

// ---------- 浮世繪 ----------
function ukiyoe(kind, s) {
  const save = { p: camera.position.clone(), q: camera.quaternion.clone() };
  const hud = $('#hud'); hud.style.visibility = 'hidden';
  if (kind === 'me') {
    const p = G.me.root.position; const f = new THREE.Vector3(Math.sin(G.ry), 0, Math.cos(G.ry));
    camera.position.copy(p).addScaledVector(f, 2.6).add(new THREE.Vector3(.6, 1.5, 0)); camera.lookAt(p.x, p.y + 1.1, p.z);
  } else {
    const views = [[[124, 7, 14], [60, 6, -6]], [[-92, 3, 9], [-131, 4, 0]], [[90, 9, -1], [-40, 2, 0]], [[150, 4, 20], [118, 0, -30]]];
    const v = views[Math.floor(Math.random() * views.length)]; camera.position.set(...v[0]); camera.lookAt(...v[1]);
  }
  const oldAsp = camera.aspect; camera.aspect = 3 / 4; camera.updateProjectionMatrix();
  const oldSize = new THREE.Vector2(); renderer.getSize(oldSize); renderer.setSize(600, 800, false); composer && composer.setSize(600, 800);
  render(); const url = renderer.domElement.toDataURL('image/jpeg', .92);
  renderer.setSize(oldSize.x, oldSize.y, true); composer && composer.setSize(oldSize.x, oldSize.y); camera.aspect = oldAsp; camera.updateProjectionMatrix();
  camera.position.copy(save.p); camera.quaternion.copy(save.q); hud.style.visibility = '';
  const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = 700; c.height = 960; const g = c.getContext('2d');
    g.fillStyle = '#efe3c4'; g.fillRect(0, 0, 700, 960);
    g.drawImage(img, 50, 60, 600, 800);
    const id = g.getImageData(50, 60, 600, 800), d = id.data, L = new Float32Array(600 * 800);
    for (let i = 0; i < L.length; i++) L[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
    for (let y = 1; y < 799; y++) for (let x = 1; x < 599; x++) {
      const i = y * 600 + x, k = i * 4;
      const gx = L[i + 1] - L[i - 1], gy = L[i + 600] - L[i - 600], e = Math.min(1, Math.hypot(gx, gy) / 60);
      for (let ch = 0; ch < 3; ch++) { let v = d[k + ch] / 255; v = Math.round(v * 5) / 5; v = v * .82 + [.12, .09, .03][ch]; d[k + ch] = Math.max(0, v * 255 * (1 - e * .75)); }
      const n = (Math.random() - .5) * 14; d[k] += n; d[k + 1] += n; d[k + 2] += n;
    }
    g.putImageData(id, 50, 60);
    g.strokeStyle = '#2a1d12'; g.lineWidth = 4; g.strokeRect(50, 60, 600, 800);
    g.fillStyle = '#f6eed8'; g.fillRect(560, 80, 70, 300); g.strokeStyle = '#2a1d12'; g.lineWidth = 2; g.strokeRect(560, 80, 70, 300);
    g.fillStyle = '#1a1210'; g.font = `700 40px "Yuji Syuku",serif`; g.textAlign = 'center';
    const title = kind === 'me' ? (G.name + '之図').slice(0, 7) : '江戸名所' + ['春景', '夕景', '夜景'][Math.floor(Math.random() * 3)];
    [...title].forEach((ch, i) => g.fillText(ch, 595, 128 + i * 42));
    g.fillStyle = '#b8302a'; g.fillRect(578, 880, 64, 64); g.fillStyle = '#f6eed8'; g.font = `700 26px "Yuji Syuku",serif`; g.fillText('江戸', 610, 905); g.fillText('町', 610, 935);
    g.fillStyle = '#2a1d12'; g.font = `400 22px "Yuji Syuku",serif`; g.textAlign = 'left'; g.fillText(s.def.name + ' 版', 56, 905);
    const out = c.toDataURL('image/jpeg', .9);
    $('#ukiyo').innerHTML = `<div class="uk"><img src="${out}"><div class="btns"><a class="big" download="ukiyoe_${Date.now()}.jpg" href="${out}">⬇ 下載浮世繪</a><button onclick="this.closest('.modal').classList.add('hide')">收下</button></div></div>`;
    show('#ukiyo'); G.me.say('畫得真好！');
  }; img.src = url;
}

// ---------- 聊天、表情、看風景 ----------
function openChat() { show('#chatBox'); document.body.classList.add('chatting'); $('#chatIn').focus(); }
function closeChat() { document.body.classList.remove('chatting'); show('#chatBox', false); }
function sendChat() {
  const v = $('#chatIn').value.trim(); $('#chatIn').value = ''; $('#chatIn').blur(); closeChat();
  $('#chatIn').placeholder = '說點什麼…（Enter 送出）';
  const w = G.whisper; G.whisper = null;
  if (!v) return;
  if (G.gm && v.startsWith('/')) { net.send({ t: 'chat', s: v }); return; }
  const r = cleanText(v); if (r.bad) toast('請文明用語，不雅字詞已被過濾');
  if (w && G.online) { net.send({ t: 'w', to: w.id, s: r.text }); return; }
  if (G.online) net.send({ t: 'chat', s: r.text }); else onChat(G.myId, r.text);
}
function onChat(id, s) {
  const r = id === G.myId ? { ch: G.me, n: G.name } : G.remotes.get(id); if (!r) return;
  r.ch.say(s);
  const log = $('#log'); const li = document.createElement('div'); li.innerHTML = `<b>${esc(r.n)}</b>：${esc(s)}`; log.appendChild(li); while (log.children.length > 8) log.firstChild.remove();
  setTimeout(() => li.classList.add('old'), 15000);
  if (id === G.myId) { const p = G.pos; const cand = NPCS.filter(n => Math.hypot(n.ch.root.position.x - p.x, n.ch.root.position.z - p.z) < 7); if (cand.length && Math.random() < .55) { const n = cand[Math.floor(Math.random() * cand.length)]; setTimeout(() => npcTalk(n, /[?？嗎]/.test(s) ? ['嗯…我也不太清楚呢。', '嗯，好問題。', '去問問掌櫃吧！'][Math.floor(Math.random() * 3)] : /好吃|うま|美味/.test(s) ? '對吧！這家店是老字號了。' : /こんにち|你好|哈囉|嗨/.test(s) ? '你好啊，旅人！' : npcLine('reply')), 900); } }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACTIONS = [[7, '👋', '揮手', 2.2], [6, '🙇', '鞠躬', 2], [9, '👏', '拍手', 2.4], [14, '😆', '大笑', 2.4], [11, '🙌', '萬歲', 2.6], [13, '👉', '指路', 2.5], [10, '💃', '跳舞', 1e9], [12, '🧘', '坐在地上', 1e9]];
const EMOJIS = ['😊', '😂', '😍', '😮', '😢', '😡', '😴', '🤔', '👍', '❤️', '🎉', '🍵', '🍜', '🌸', '🏮', '💰'];
const PHRASES = ['你好！', '歡迎光臨！', '謝謝！', '好吃嗎？', '一起逛街吧', '要不要來我店裡？', '你的和服好漂亮', '去看富士山吧', '下次見～'];
// 特寫：鏡頭滑到人物正面拉近；移動或時間到就回原本視角
// opt：dist 距離、h 鏡頭高度、ang 偏離正面的角度、look 看向的高度、spin 環繞速度
function closeup(dur, opt = {}) {
  if (G.shot || (QS.has('test') && !QS.has('cu'))) return;
  G.cu = { t: 0, dur, dist: 2, h: 1.4, ang: .5, look: 1.2, spin: 0, ...opt };
}
const cuPos = new THREE.Vector3(), cuLook = new THREE.Vector3(), nPos = new THREE.Vector3(), nLook = new THREE.Vector3();
function applyCloseup(dt) {
  const c = G.cu; if (!c) return;
  c.t += dt; if (c.t > c.dur) { G.cu = null; return; }
  const k = Math.min(1, c.t / .7, (c.dur - c.t) / .7); const e = k * k * (3 - 2 * k);
  const p = G.me.root.position;
  // 繞著人物轉到正面（角度、距離、高度分別內插），避免鏡頭直線穿過頭部
  const a1 = G.ry + c.ang + c.t * c.spin;
  const dx = camera.position.x - p.x, dz = camera.position.z - p.z, a0 = Math.atan2(dx, dz), d0 = Math.hypot(dx, dz), h0 = camera.position.y - p.y;
  const a = angLerp(a0, a1, e), d = d0 + (c.dist - d0) * e, h = h0 + (c.h - h0) * e;
  camera.position.set(p.x + Math.sin(a) * d, p.y + h, p.z + Math.cos(a) * d);
  nLook.set(cam.tx, cam.ty, cam.tz); cuLook.set(p.x, p.y + c.look, p.z); nLook.lerp(cuLook, e); camera.lookAt(nLook);
}
const EMOTE_CU = { 9: [2.6, { dist: 2.6, h: 1.3, ang: .25, look: 1 }], 10: [4.2, { dist: 3, h: 1.25, ang: 0, look: 1, spin: .7 }], 11: [2.8, { dist: 2.8, h: 1.1, ang: .3, look: 1.1 }], 14: [2.6, { dist: 2.2, h: 1.4, ang: .35, look: 1.2 }], 7: [2.2, { dist: 2.6, h: 1.4, ang: .4, look: 1.2 }] };
function emote(a, dur = 2.2) { if (G.mode !== 'walk') { if (a !== 6) toast('站著的時候才能做動作喔'); return; } G.emote = a; G.emoteT = dur; G.me.play(a); }
function sendEmoji(e) { G.me.emoji(e); net.send({ t: 'emote', e }); }
const NPC_LINES = {
  day: ['今天天氣真好啊。', '聽說信濃屋的蕎麥麵很好吃。', '過了日本橋有露天風呂喔。', '神社的櫻花開得正美。', '我正要去買糰子。', '吳服屋進了新的布料呢。', '最近浮世繪很流行。'],
  dusk: ['夕陽下的富士山真美…', '該回家吃晚飯了。', '燈籠要點起來囉。', '黃昏的鐘聲要響囉。'],
  night: ['晚上河邊有螢火蟲。', '居酒屋千鳥的熱燗最暖了。', '夜路要小心喔。', '泡個湯再睡吧～'],
  reply: ['喔～', '說得也是', '哈哈，說得好！', '原來如此。', '是喔？', '真的嗎？', '江戶人最愛熱鬧了！'],
};
function npcLine(kind) { const t = tday(); const k = kind || (t > .3 && t < .72 ? 'day' : t < .8 && t >= .72 ? 'dusk' : 'night'); const a = NPC_LINES[k]; return a[Math.floor(Math.random() * a.length)]; }
function npcTalk(n, line) { const p = n.ch.root.position; if (n.st !== 'sit') { n.ch.root.rotation.y = Math.atan2(G.pos.x - p.x, G.pos.z - p.z); if (n.st !== 'chatwait') { n.st = 'talk'; n.t = 0; n.goal = null; } } n.ch.say(line || npcLine(), 4.5); if (Math.random() < .4) n.ch.emoji(['😊', '🌸', '🍵', '😄'][Math.floor(Math.random() * 4)]); }
function toggleView() {
  cam.auto = !cam.auto; document.body.classList.toggle('viewmode', cam.auto);
  if (cam.auto) toast(isTouch ? '看風景模式：點畫面返回' : '看風景模式：點畫面或按 V 返回', 2500);
}

// ---------- 標題畫面（換裝） ----------
function buildTitle() {
  $('#nameIn').value = G.name; $('#gmIn').value = store.get('gmk', ''); { let taps = [], lg = document.querySelector('#title .logo h1'); lg.style.pointerEvents = 'auto'; lg.addEventListener('pointerdown', () => { const t = performance.now(); taps = taps.filter(x => t - x < 2500); taps.push(t); if (taps.length >= 5) { taps = []; $('#gmRow').classList.toggle('hide'); } }); }
  const rows = [['k', '和服', KIMONO.map(k => k[1]), KIMONO.map(k => k[0])], ['p', '花紋', null, PATTERNS.slice(0, 6)], ['o', '腰帶', OBI, null], ['h', '髮型', null, HAIRS], ['s', '膚色', SKINS, null], ['fc', '臉型', null, FACES], ['ey', '眼睛', null, EYES], ['br', '眉毛', null, BROWS], ['mo', '嘴巴', null, MOUTHS], ['ck', '腮紅', null, CHEEKS], ['mk', '痣', null, MOLES]];
  $('#looks').innerHTML = rows.map(([k, t, cols, names]) => `<div class="lr"><span>${t}</span><div>${(cols || names).map((c, i) => cols ? `<button class="sw" data-k="${k}" data-v="${i}" style="background:${c}" title="${names ? names[i] : ''}"></button>` : `<button class="tx" data-k="${k}" data-v="${i}">${c}</button>`).join('')}</div></div>`).join('');
  ['ey', 'br', 'mo', 'ck', 'mk', 'fc'].forEach(k => { if (G.look[k] == null) G.look[k] = k === 'ck' ? 1 : 0; });
  const sync = () => document.querySelectorAll('#looks [data-k]').forEach(b => b.classList.toggle('on', G.look[b.dataset.k] == b.dataset.v));
  document.querySelectorAll('#looks [data-k]').forEach(b => b.onclick = () => { G.look[b.dataset.k] = +b.dataset.v; G.me.setLook(G.look); sync(); G.faceZoom = ['ey', 'br', 'mo', 'ck', 'mk', 'h', 's', 'fc'].includes(b.dataset.k) ? 3.5 : 0; });
  sync();
  $('#rnd').onclick = () => { G.look = randomLook(); G.look.hat = 0; G.look.c = 0; G.me.setLook(G.look); sync(); };
  $('#go').onclick = start;
  if (QS.has('embed')) { const a = document.createElement('a'); a.className = 'big'; a.target = '_blank'; a.rel = 'noopener'; a.href = location.origin + location.pathname; a.textContent = '↗ 開新分頁全螢幕玩'; a.style.cssText = 'display:block;text-align:center;margin-top:8px'; $('#go').parentElement.after(a); }
  $('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
}
// ---------- 防止手機連點／雙指放大網頁 ----------
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1 && e.target.tagName !== 'CANVAS') e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouchEnd < 350 && !e.target.closest('button,input,a,.mi,.oi')) e.preventDefault(); lastTouchEnd = now; }, { passive: false });

// ---------- 全螢幕（沒有網址列） ----------
const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
const canFS = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
function enterFS() {
  if (standalone || document.fullscreenElement || document.webkitFullscreenElement || !canFS || G.shot || QS.has('test')) return;
  const el = document.documentElement; const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
  if (r && r.catch) r.catch(() => {});
}
function toggleFS() { if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); store.set('nofs', true); } else { store.set('nofs', false); enterFS(); } }
// 手機上若被手勢退出全螢幕，下次點畫面自動回到全螢幕
addEventListener('pointerdown', () => { if (isTouch && G.mode !== 'title' && !store.get('nofs', false)) enterFS(); }, true);
if (/iPhone|iPod/.test(navigator.userAgent) && !standalone && !canFS) document.getElementById('iosTip').classList.remove('hide');
if (!canFS && !standalone) document.getElementById('bFS').classList.add('hide');

async function start() {
  if (!store.get('nofs', false)) enterFS();
  const n = $('#nameIn').value.trim().slice(0, 12);
  if (!n) { $('#nameIn').focus(); return toast('請先取一個暱稱'); }
  if (cleanText(n).bad) { $('#nameIn').focus(); return toast('暱稱含有不雅字詞，請換一個'); }
  const gk = ($('#gmIn').value || '').trim(); if (gk) store.set('gmk', gk);
  G.name = n; store.set('name', n); store.set('look', G.look); G.me.setName(n);
  setMoney(store.get('mon_' + n, 300));
  $('#go').disabled = true; $('#go').textContent = '連線中…';
  let r = 'offline';
  if (SERVER) for (let i = 1; i <= 5; i++) { r = await net.connect({ n, lk: G.look, x: G.pos.x, z: G.pos.z, k: store.get('gmk', '') }, 'edo' + i); if (r !== 'full') { G.room = i; break; } }
  G.online = r === 'ok';
  show('#title', false); show('#hud'); document.body.classList.add('playing');
  SND.start();
  G.mode = 'walk'; cam.yaw = PI / 2 - .25; cam.pitch = .3; cam.dist = 6.5;
  updCount(); toast(G.online ? `歡迎來到江戶町${['一', '二', '三', '四', '五'][G.room - 1]}丁目！` : '目前為單人模式（伺服器未連線），NPC 會陪你玩', 3500);
  updHeld(); invMigrate();
  if (!store.get('helped', false) && !G.shot && !QS.has('nohelp')) { show('#help'); store.set('helped', true); }
  sfx(660, .3); setTimeout(() => sfx(990, .4), 180);
}

// ---------- 連線事件 ----------
setInterval(() => { if (G.online) net.send({ t: 'ping' }); }, 15000);
net.on('welcome', m => {
  G.myId = m.id; G.timeOff = m.timeOff || 0; G.owners = m.shops || {};
  if (m.gm) {
    G.gm = true; G.me.gm = true; G.me.setLook(G.look); G.me.setName('👑 ' + m.n); setMoney(G.money); show('#bGM');
    // 花魁道中：環繞特寫＋櫻花＋公告橫幅
    setTimeout(() => { closeup(6, { dist: 3, h: 1.3, ang: 0, look: 1.1, spin: 1.05 }); G.me.emoji('🌸'); announce(`花魁「${m.n}」駕到`, '花魁道中'); SND.pluck(523, .1); setTimeout(() => SND.pluck(659, .1), 220); setTimeout(() => SND.pluck(784, .12), 440); }, 600);
    toast('👑 GM 模式：花魁造型、錢用不完、可使用管理面板', 3800);
  }
  else if (m.n !== G.name) { G.name = m.n; G.me.setName(m.n); }
  m.players.forEach(addRemote); updCount();
});
net.on('act', m => {
  const R = G.remotes.get(m.from); if (R && G.mode === 'walk') faceTo(R.ch.root.position);
  if (m.k === 'hi') { toast(`👋 ${m.n} 向你打招呼`); if (R) R.ch.emoji('👋'); }
  if (m.k === 'five') toast(`🤝 ${m.n} 跟你擊掌！`);
  if (m.k === 'gift') { addMoney(+m.v, `${m.n} 送的`); toast(`🎁 ${m.n} 送你 ${m.v} 文`); sfx(1046, .2); }
  if (m.k === 'food') { const it = itemById(m.v); if (it) { setHeld(m.v); toast(`🍡 ${m.n} 送你「${it.n}」`); } }
});
net.on('actfx', m => { if (m.k === 'five') { fxFor(m.a, 16, 1.6); fxFor(m.b, 16, 1.6); } if (m.k === 'hi') fxFor(m.a, 7, 2); });
net.on('w', m => { logLine(`🤫 <b>${m.self ? '你→' + esc(G.remotes.get(m.to)?.n || '') : esc(m.n)}</b>：${esc(m.s)}`, 'whisper'); if (!m.self) sfx(880, .1); });
net.on('sys', m => { toast(m.s, 3500); logLine(`⚙ ${esc(m.s)}`, 'sys'); });
net.on('announce', m => announce(m.s, m.n));
net.on('time', m => { G.timeOff = m.off; });
net.on('muted', m => { const t = new Date(m.until); toast(`${m.auto ? '因多次不雅用語，' : ''}你被禁言到 ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`, 4000); });
net.on('kicked', () => toast('你已被管理員請出江戶町', 6000));
net.on('tp', m => { if (G.mode === 'owner') leaveOwner(); if (G.mode === 'seat' || G.mode === 'bath') standUp(); G.pos.set(m.x, heightAt(m.x, m.z), m.z); if (!okAt(m.x, m.z)) G.pos.set(m.x - 1, 0, m.z); toast('✨ 瞬間移動！'); });
net.on('join', m => { addRemote(m); if (m.gm) { announce(`花魁「${m.n}」駕到`, '花魁道中'); const R = G.remotes.get(m.id); if (R) R.ch.emoji('🌸'); } else toast(`「${m.n}」來到了江戶町`); });
net.on('leave', m => delRemote(m.id));
net.on('s', m => { for (const [id, x, z, y, r, a] of m.p) { const R = G.remotes.get(id); if (R) { R.tx = x; R.tz = z; R.ty = y; R.tr = r; R.a = a; } } });
net.on('chat', m => onChat(m.id, m.s));
net.on('emote', m => { const R = G.remotes.get(m.id); if (R) { R.ch.emoji(m.e); if (['🔔', '🪙', '🏯'].includes(m.e)) templeFx(m.e, R.ch.root.position); if (m.e === '🙏') { R.ov = 17; R.ovT = 3.6; } } });
net.on('look', m => { const R = G.remotes.get(m.id); if (R) R.ch.setLook(m.lk); });
net.on('shops', m => {
  const old = G.owners; G.owners = m.shops || {};
  if (G.pendingClaim && G.owners[G.pendingClaim.def.id] === G.myId) { enterOwner(G.pendingClaim); G.pendingClaim = null; }
  if (G.order && G.order.owner && G.owners[G.order.shop.def.id] !== G.order.owner) { cancelOrder('店主收店了，已退款'); if (G.shop) openMenu(G.shop); }
});
net.on('claimfail', () => { G.pendingClaim = null; toast('被別人搶先開店了！'); });
net.on('order', m => {
  if (G.mode !== 'owner' || G.shop.def.id !== m.s) return;
  const item = G.shop.def.menu.find(x => x.id === m.item); if (!item) return;
  G.queue.push({ oid: m.oid, item, from: m.from, n: m.n }); renderOwner(); sfx(990, .15); setTimeout(() => sfx(1320, .15), 120); toast(`👤 ${m.n} 點了「${item.n}」`);
});
net.on('cancel', m => { G.queue = G.queue.filter(o => o.oid !== m.oid); if (MG.on && MG.o.oid === m.oid) { mgAbort(); toast('客人取消了訂單'); G.me.play(0); } renderOwner(); });
net.on('served', m => {
  if (!G.order || G.order.oid !== m.oid) return;
  served(G.order.shop, G.order.item, m.q, m.from);
});
net.on('nobody', m => { if (G.order && G.order.oid === m.oid) { cancelOrder('店主不在，已退款'); } });
net.on('closed', () => { G.online = false; updCount(); toast('與伺服器斷線，切換為單人模式', 4000); for (const id of [...G.remotes.keys()]) delRemote(id); for (const k in G.owners) if (G.owners[k] !== G.myId) delete G.owners[k]; });

// ---------- 主迴圈 ----------
const clock = new THREE.Clock(); let time = 0, sendT = 0, nearT = 0, last = { x: 0, z: 0, r: 0, a: -1 };
function update(dt) {
  time += dt;
  if (G.mode === 'title') {
    // 標題：從東邊拍角色，背景是街道盡頭的富士山
    const p = G.me.root.position, port = camera.aspect < 1;
    const th = (port ? .03 : .32) + Math.sin(time * .12) * .05, cz = p.z - (port ? .1 : .55);
    camera.position.set(p.x + (port ? 4.2 : 3.4), 1.45, cz); camera.lookAt(p.x + 3.4 - Math.cos(th) * 10, port ? 2.9 : 1.75, cz + Math.sin(th) * 10);
    // 選五官時鏡頭靠近臉
    G.fz = (G.fz || 0) + (((G.faceZoom = Math.max(0, (G.faceZoom || 0) - dt)) > 0 ? 1 : 0) - (G.fz || 0)) * Math.min(1, dt * 3);
    if (G.fz > .01) { const hy = 1.35, fp = new THREE.Vector3(p.x + (port ? .75 : .62), hy + (port ? .12 : .02), p.z + (port ? .02 : .25)); camera.position.lerp(fp, G.fz); const lk = new THREE.Vector3(p.x, hy - (port ? .22 : .02), p.z + (port ? 0 : .15)); const cur = new THREE.Vector3(); camera.getWorldDirection(cur); cur.multiplyScalar(10).add(camera.position); cur.lerp(lk, G.fz); camera.lookAt(cur); G.me.root.rotation.y = PI / 2; }
    G.me.root.rotation.y = PI / 2 + Math.sin(time * .4) * .4; G.me.update(dt, 0);
  } else {
    // 移動
    let ix = 0, iz = 0;
    if (!typing()) { if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; }
    if (joy.mag > .12) { ix += joy.x; iz -= joy.y; }
    if (G.follow && (Math.abs(ix) + Math.abs(iz) > .1)) G.follow = null;
    if (G.follow && G.mode === 'walk') { const R = G.remotes.get(G.follow); if (!R) G.follow = null; else { const dx = R.ch.root.position.x - G.pos.x, dz = R.ch.root.position.z - G.pos.z, d = Math.hypot(dx, dz); if (d > 2.2) { const a = Math.atan2(dx, dz) - Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw)); iz = Math.cos(a) * Math.min(1, d / 4); ix = -Math.sin(a) * Math.min(1, d / 4) * -1; } } }
    const len = Math.min(1, Math.hypot(ix, iz));
    if ((G.mode === 'seat' || G.mode === 'bath') && len > .5 && !G.busy) standUp();
    let anim = 0, speed = 0;
    if (G.mode === 'walk' && len > .05 && !cam.auto) {
      const run = keys.ShiftLeft || keys.ShiftRight || joy.mag > .9;
      speed = (run ? 6 : 3.2) * len;
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = -fz, rz = fx;
      let dx = fx * iz + rx * ix, dz = fz * iz + rz * ix; const dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
      const nx = G.pos.x + dx * speed * dt, nz = G.pos.z + dz * speed * dt;
      if (okAt(nx, nz)) { G.pos.x = nx; G.pos.z = nz; } else if (okAt(nx, G.pos.z)) G.pos.x = nx; else if (okAt(G.pos.x, nz)) G.pos.z = nz;
      G.ry = angLerp(G.ry, Math.atan2(dx, dz), Math.min(1, dt * 10)); anim = run ? 2 : 1; G.emoteT = 0;
    }
    if (G.mode === 'walk') G.pos.y = heightAt(G.pos.x, G.pos.z);
    if (G.emoteT > 0) { G.emoteT -= dt; anim = G.emote; }
    if (G.mode === 'seat') anim = 3;
    if (G.eatT > 0) { const fd = G.me.foodG.children[0]; if (fd && fd.userData.bites) { const b = fd.userData.bites, k = Math.floor((1 - G.eatT / 4) * (b.length + .5)); b.forEach((m, i) => m.visible = i >= k); }
      G.eatT -= dt; anim = G.mode === 'walk' ? (speed > 0 ? anim : 15) : 5; if (G.eatT <= 0) finishEat(); }
    if (G.mode === 'bath') anim = 8;
    if (G.mode === 'owner') anim = MG.on ? 4 : 0;
    G.me.play(anim); G.me.root.position.copy(G.pos); G.me.root.rotation.y = G.ry; G.me.update(dt, speed);
    // 鏡頭
    const tgt = new THREE.Vector3(G.pos.x, G.pos.y + 1.45, G.pos.z);
    if (cam.auto) { cam.yaw += dt * .06; cam.pitch += (.18 - cam.pitch) * dt * .5; }
    cam.tx += (tgt.x - cam.tx) * Math.min(1, dt * 8); cam.ty += (tgt.y - cam.ty) * Math.min(1, dt * 8); cam.tz += (tgt.z - cam.tz) * Math.min(1, dt * 8);
    let dist = cam.auto ? 11 : cam.dist;
    const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    { const hit = rayBlock(cam.tx, cam.ty, cam.tz, off, dist); if (hit < dist) dist = Math.max(.7, hit - .3); }
    cam.cd = cam.cd == null || dist < cam.cd ? dist : cam.cd + (dist - cam.cd) * Math.min(1, dt * 2.5); dist = cam.cd;
    camera.position.set(cam.tx + off.x * dist, Math.max(.4 + heightAt(cam.tx, cam.tz), cam.ty + off.y * dist), cam.tz + off.z * dist);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    if (G.cu && len > .3 && G.mode === 'walk' && !G.cu.keep) G.cu = null;
    applyCloseup(dt); if (G.me.tag) G.me.tag.visible = !G.cu;
    // 送位置
    sendT -= dt;
    if (G.online && sendT < 0) { sendT = .2; const a = G.me.anim; if (Math.abs(last.x - G.pos.x) > .03 || Math.abs(last.z - G.pos.z) > .03 || Math.abs(last.r - G.ry) > .05 || last.a !== a) { net.send({ t: 'p', x: G.pos.x, z: G.pos.z, y: G.pos.y, r: G.ry, a }); last = { x: G.pos.x, z: G.pos.z, r: G.ry, a }; } }
    nearT -= dt; if (nearT < 0) { nearT = .2; findNear(); }
    npcCustomerTick(dt); updMG(dt);
    $('#clock').textContent = edoTime(tday());
    if ((miniT -= dt) < 0) { miniT = .25; drawMini(); }
  }
  // 其他玩家
  const k = Math.min(1, dt * 10);
  for (const [, R] of G.remotes) {
    const p = R.ch.root.position; const ox = p.x, oz = p.z;
    p.x += (R.tx - p.x) * k; p.z += (R.tz - p.z) * k; p.y += (R.ty - p.y) * k;
    R.ch.root.rotation.y = angLerp(R.ch.root.rotation.y, R.tr, k);
    if (R.ovT > 0) { R.ovT -= dt; R.ch.play(R.ov); } else R.ch.play(R.a); R.ch.update(dt, Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, .001));
  }
  for (const c of G.npcCust) c.ch.update(dt, 0);
  updNPCs(dt); updDeer(dt); updRetinue(dt);
  if ((lodT = (lodT || 0) - dt) < 0) { lodT = .3; const cp = camera.position; const all = [G.me, ...[...G.remotes.values()].map(r => r.ch), ...NPCS.map(n => n.ch), ...Object.values(keepers), ...G.npcCust.map(c => c.ch), ...[...RETINUE.values()].flatMap(r => r.mem.map(m => m.ch))]; for (const ch of all) if (ch && ch.lod) ch.lod(ch.root.position.distanceTo(cp)); }
  if (G.mode !== 'title' && W) {
    const near = [...G.remotes.values()].filter(r => r.ch.root.position.distanceTo(G.pos) < 15).length + NPCS.filter(n => n.ch.root.visible && n.ch.root.position.distanceTo(G.pos) < 15).length;
    SND.update(dt, tday(), W.night || 0, Math.max(0, Math.abs(G.pos.x - 125) - 13), near, Math.abs(G.pos.z) < 12 && G.pos.x > -100 && G.pos.x < 104);
    callTick(dt);
  }
  W.update(dt, time, tday(), G.me ? G.me.root.position : new THREE.Vector3(), camera.position, quality);
  if (bloom) bloom.strength = .18 + W.night * .55;
}
let viewOff = 0;
function updViewOffset() {
  let target = 0;
  if (innerWidth <= 700 && G.mode !== 'title') {
    for (const id of ['#panel', '#mg', '#pcard', '#chatBox']) { const el = $(id); if (el && !el.classList.contains('hide')) { const r = el.getBoundingClientRect(); if (r.top > innerHeight * .35) target = Math.max(target, (innerHeight - r.top) * .55); } }
  }
  document.body.classList.toggle('sheet', target > 0);
  viewOff += (target - viewOff) * .15;
  if (viewOff > 1) camera.setViewOffset(innerWidth, innerHeight, 0, viewOff, innerWidth, innerHeight); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
}
function render() { updViewOffset(); if (G.shot) { const v = G.shot; camera.position.set(v[0], v[1], v[2]); camera.lookAt(v[3], v[4], v[5]); } if (quality === 2 && composer) composer.render(); else renderer.render(scene, camera); }
let miniT = 0, lodT = 0;
let frameN = 0;
function loop() {
  if (QS.has('test')) { const now = performance.now(), tdt = Math.min(.25, Math.max(1 / 30, (now - (loop.lt || now)) / 1000)); loop.lt = now; let left = tdt; while (left > 1e-4) { const st = Math.min(1 / 20, left); update(st); left -= st; } if (frameN++ % 15 === 0) render(); setTimeout(loop, 33); return; }
  const dt = Math.min(.05, clock.getDelta()); update(dt); render(); requestAnimationFrame(loop);
}

// ---------- 小地圖 ----------
const mini = $('#mini'), mg = mini.getContext('2d');
function drawMini() {
  if (mini.classList.contains('hide')) return;
  const w = mini.width, h = mini.height, sx = w / 380, ox = -160; const X = x => (x - ox) * sx, Z = z => h * .6 + z * sx;
  mg.clearRect(0, 0, w, h); mg.fillStyle = 'rgba(243,234,214,.92)'; mg.fillRect(0, 0, w, h);
  mg.fillStyle = '#cdbb98'; mg.fillRect(X(-100), Z(-7), (206) * sx, 14 * sx);
  mg.fillStyle = '#d9d2c2'; mg.fillRect(X(-150), Z(-24), 52 * sx, 48 * sx);
  mg.fillStyle = '#6aa0b8'; mg.fillRect(X(112), 0, 26 * sx, h);
  mg.fillStyle = '#8a6440'; mg.fillRect(X(110), Z(-2.4), 30 * sx, 4.8 * sx);
  mg.fillStyle = '#c8402c'; mg.fillRect(X(-101) - 2, Z(-3), 4, 6 * sx);
  for (const s of W.shops) { mg.fillStyle = G.owners[s.def.id] ? '#c8322a' : '#5a4636'; mg.fillRect(X(s.def.x - s.def.w / 2), Z(s.def.side * 7) - (s.def.side < 0 ? 9 * sx : 0), s.def.w * sx, 9 * sx); }
  mg.fillStyle = '#7fb8b4'; mg.beginPath(); mg.arc(X(160), Z(14), 3.4 * sx, 0, 7); mg.fill();
  mg.fillStyle = '#d9d2c2'; mg.fillRect(X(141), Z(-106), 74 * sx, 59 * sx); mg.fillStyle = '#4a3a2e'; mg.fillRect(X(158), Z(-104), 40 * sx, 26 * sx); mg.fillRect(X(167), Z(-50), 22 * sx, 6 * sx); mg.fillStyle = '#8a6440'; mg.fillRect(X(175.5), Z(-78), 5 * sx, 38 * sx);
  mg.fillStyle = '#2a4b7c'; for (const [, R] of G.remotes) { mg.beginPath(); mg.arc(X(R.tx), Z(R.tz), 2.2, 0, 7); mg.fill(); }
  mg.fillStyle = '#e8322a'; mg.beginPath(); mg.arc(X(G.pos.x), Z(G.pos.z), 3.4, 0, 7); mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 1.5; mg.stroke();
  mg.font = '600 10px sans-serif'; mg.fillStyle = '#3a2a1a'; mg.fillText('神社', X(-140), Z(-17)); mg.fillText('日本橋', X(110), Z(-6)); mg.fillText('湯', X(157), Z(6)); mg.fillStyle = '#f3ead6'; mg.fillText('東光寺', X(170), Z(-88)); mg.fillStyle = '#3a2a1a'; mg.fillText('御觸書', X(92), Z(-12));
}
mini.onclick = () => { const big = mini.classList.toggle('big'); mini.width = big ? 520 : 240; mini.height = big ? 260 : 120; drawMini(); };

// ---------- UI 綁定 ----------
addEventListener('pointerdown', () => { if (SND.ac && SND.ac.state !== 'running') SND.ac.resume(); });
$('#act').onclick = act;
$('#bChat').onclick = openChat;
$('#chatSend').onclick = sendChat;
const pop = (id, on) => { ['#actMenu', '#emoMenu'].forEach(x => show(x, x === id ? (on ?? $(x).classList.contains('hide')) : false)); };
$('#actMenu').innerHTML = ACTIONS.map(([a, ic, nm, d], i) => `<button data-a="${i}"><span>${ic}</span>${nm}${isTouch ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('');
$('#emoMenu').innerHTML = EMOJIS.map(e => `<button data-e="${e}">${e}</button>`).join('');
$('#phr').innerHTML = PHRASES.map(t => `<button>${t}</button>`).join('');
document.querySelectorAll('#actMenu [data-a]').forEach(b => b.onclick = () => { const [a, , , d] = ACTIONS[+b.dataset.a]; emote(a, d); if (EMOTE_CU[a] && G.mode === 'walk') closeup(...EMOTE_CU[a]); pop(null); });
document.querySelectorAll('#emoMenu [data-e]').forEach(b => b.onclick = () => { sendEmoji(b.dataset.e); pop(null); });
document.querySelectorAll('#phr button').forEach(b => b.onclick = () => { $('#chatIn').value = b.textContent; sendChat(); });
$('#bAct').onclick = () => pop('#actMenu'); $('#bEmo').onclick = () => pop('#emoMenu');
$('#bView').onclick = toggleView;
$('#bInv').onclick = () => { pop(null); openInv(); };
$('#bGM').onclick = openGM;
$('#bHelp').onclick = () => show('#help');
$('#bFS').onclick = toggleFS;
document.querySelectorAll('[data-donate]').forEach(b => b.onclick = () => { show('#settings', false); show('#donate'); SND.pluck(660, .06); });
$('#bSet').onclick = () => { show('#settings'); document.querySelectorAll('#settings [data-q]').forEach(b => b.classList.toggle('on', +b.dataset.q === quality)); };
const sndBtns = () => document.querySelectorAll('#settings [data-snd]').forEach(b => b.classList.toggle('on', !!SND.on[b.dataset.snd]));
document.querySelectorAll('#settings [data-snd]').forEach(b => b.onclick = () => { SND.start(); SND.setOn(b.dataset.snd, !SND.on[b.dataset.snd]); sndBtns(); });
sndBtns();
document.querySelectorAll('#settings [data-q]').forEach(b => b.onclick = () => { quality = +b.dataset.q; store.set('q', quality); applyQuality(); document.querySelectorAll('#settings [data-q]').forEach(x => x.classList.toggle('on', +x.dataset.q === quality)); });
document.querySelectorAll('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) m.classList.add('hide'); }));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.add('hide'));
if (isTouch) document.body.classList.add('touch');

// ---------- 啟動 ----------
(async () => {
  try { await Promise.race([document.fonts.load('700 64px "Yuji Syuku"'), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
  const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const art = await Promise.all(['roof', 'plaster', 'wood', 'dirt'].map(k => loadImg('img/tex/' + k + '.jpg')).concat([...Array(11).keys()].map(i => loadImg('img/tex/kanban' + i + '.png'))));
  ['roof', 'plaster', 'wood', 'dirt'].forEach((k, i) => TX.IMG[k] = art[i]); TX.IMG.kanban = art.slice(4);
  [TX.IMG.oiranOut, TX.IMG.oiranIn] = await Promise.all([loadImg('img/tex/oiran_out.jpg'), loadImg('img/tex/oiran_in.jpg')]);
  const L = (pre, n, ext) => Promise.all([...Array(n).keys()].map(i => loadImg(`img/tex/${pre}${i}.${ext}`)));
  const [ey, br, mo, mt, ob] = await Promise.all([L('eyes', 5, 'png'), L('brows', 4, 'png'), L('mouths', 4, 'png'), L('motif', 9, 'png'), L('obi', 6, 'jpg')]);
  if (ey.every(Boolean) && br.every(Boolean) && mo.every(Boolean)) TX.IMG.face = { eyes: ey, brows: br, mouths: mo };
  if (mt.every(Boolean)) TX.IMG.motifs = mt; if (ob.every(Boolean)) TX.IMG.obi = ob;
  W = buildWorld(scene);
  W.sunLight = scene.children.find(o => o.isDirectionalLight);
  setupPost(); applyQuality();
  addMe(); spawnNPCs(); spawnDeer(); buildTitle();
  $('#loading').classList.add('hide');
  if (QS.has('cam')) { G.shot = QS.get('cam').split(',').map(Number); show('#title', false); }
  if (QS.has('oiran') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { G.me.gm = true; G.me.setLook(G.look); G.me.setName('👑 花魁'); }
  if (QS.has('auto')) { $('#nameIn').value = QS.get('auto') || '測試'; start(); }
  if (QS.has('chat')) setTimeout(() => { openChat(); onChat(G.myId, '你好！一起去吃糰子吧'); }, 1500);
  if (QS.has('demo')) setTimeout(() => {
    const d = QS.get('demo');
    if (d === 'menu') { const sh = W.shops.find(x => x.def.id === 'soba'); G.pos.set(sh.front.x, 0, sh.front.z); openShop(sh); $('#bCust').click(); }
    if (d === 'sit') { const sh = W.shops.find(x => x.def.id === 'soba'); G.pos.set(sh.front.x, 0, sh.front.z); openShop(sh); $('#bCust').click(); closePanels(); cam.yaw = sh.rot + 2.1; cam.pitch = .12; cam.dist = 3.2; }
    if (d === 'bench') { const sh = W.shops.find(x => x.def.id === 'chaya'); const seat = sh.seats[0]; sitAt(seat); cam.yaw = seat.r + 1.6; cam.pitch = .1; cam.dist = 3; }
    if (d === 'eat') { G.pos.set(-40, 0, 1); G.ry = -PI / 2; setHeld('dango:sanshoku'); setTimeout(eatHeld, 300); }
    if (d === 'pray') { G.pos.set(178, 0, -72.3); G.ry = PI; doWish('願大家平安喜樂', 17); }
    if (d === 'wish') { G.pos.set(178, 0, -72.3); G.ry = PI; cam.yaw = .5; cam.pitch = .22; cam.dist = 4.8; openTemple(); $('#tp').click(); }
    cam.tx = G.pos.x; cam.ty = G.pos.y + 1.45; cam.tz = G.pos.z;
  }, 1800);
  loop();
})();

// ---------- 自動測試 ?test=flow ----------
async function runTest() {
  const log = []; let fail = false; const ok = (c, m) => { log.push((c ? '✔ ' : '✘ ') + m); if (!c) fail = true; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, ms = 45000) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await sleep(50); return f(); };
  try {
    await sleep(600); setMoney(2000);
    const soba = W.shops.find(s => s.def.id === 'soba');
    G.pos.set(soba.front.x, 0, soba.front.z);
    ok(await until(() => near && near.type === 'shop' && near.shop === soba), '靠近店家出現提示');
    act(); ok(!$('#panel').classList.contains('hide'), '店家面板');
    $('#bCust').click(); ok(G.mode === 'seat', '坐下');
    const m0 = G.money; document.querySelector('.mi[data-i="0"]').click(); ok(G.money === m0 - 16 && !!G.order, '點餐扣 16 文');
    ok(await until(() => !G.order && G.look.f === 'soba:kake' && !!G.me.foodG.children.length), 'NPC 掌櫃上菜、麵拿在手上');
    ok(!$('#held').classList.contains('hide'), '手持食物列');
    eatHeld(); ok(await until(() => G.me.anim === 5), '坐著吃'); ok(await until(() => !G.look.f), '吃完手上清空');
    standUp();
    const om = W.shops.find(s => s.def.id === 'omenya'); openShop(om); $('#bCust').click(); order(om, om.def.menu.find(m => m.id === 'kitsune'));
    ok(await until(() => G.look.m === 1 && G.me.accG.children.length > 0), '狐狸面具戴在頭上'); ok(invGet().includes('kitsune'), '飾品收進持ち物'); openInv(); ok(!!document.querySelector('.inv'), '持ち物面板'); closePanels(); standUp(); const ko = W.shops.find(s => s.def.id === 'komamono'); openShop(ko); $('#bCust').click(); order(ko, ko.def.menu.find(m => m.id === 'inro')); ok(await until(() => G.look.w === 1 && G.me.waistG.children.length > 0), '印籠掛腰間'); standUp();
    const dg = W.shops.find(s => s.def.id === 'dango'); openShop(dg); $('#bCust').click(); order(dg, dg.def.menu[1]); ok(await until(() => G.look.f === 'dango:sanshoku'), '買糰子'); ok((G.me.foodG.children[0]?.userData.bites || []).length === 3, '糰子拿在手上是一串三顆'); standUp();
    G.pos.set(dg.front.x, 0, dg.front.z - 2); eatHeld(); ok(await until(() => G.me.anim === 15), '邊走邊吃（站著吃）'); ok(await until(() => !G.look.f), '吃完');
    ok(cleanText('幹你娘').bad && cleanText('他媽的').bad && cleanText('f u c k').bad && !cleanText('幹部開會').bad && !cleanText('你好，一起去吃糰子').bad, '髒話過濾（幹部不誤判）'); ok(G.mode === 'walk', '起身');
    const go = W.shops.find(s => s.def.id === 'gofuku'); openShop(go); $('#bCust').click(); order(go, go.def.menu.find(m => m.id === 'k7'));
    ok(await until(() => G.look.k === 7 && G.look.p === 4), '吳服店換和服'); standUp();
    const ka = W.shops.find(s => s.def.id === 'kamiyui'); openShop(ka); $('#bCust').click(); order(ka, ka.def.menu[1]);
    ok(await until(() => G.look.h === 1), '髮結床換髮型'); standUp();
    const uk = W.shops.find(s => s.def.id === 'ukiyoe'); openShop(uk); $('#bCust').click(); order(uk, uk.def.menu[0]);
    ok(await until(() => !$('#ukiyo').classList.contains('hide') && !!$('#ukiyo img')), '浮世繪完成'); closePanels(); standUp();
    const ek = W.shops.find(s => s.def.id === 'ekisha'); openShop(ek); $('#bCust').click(); order(ek, ek.def.menu[0]);
    ok(await until(() => !$('#fortune').classList.contains('hide')), '求籤'); closePanels(); standUp();
    const yu = W.shops.find(s => s.def.id === 'yuya'); openShop(yu); $('#bCust').click(); order(yu, yu.def.menu[0]);
    ok(await until(() => G.mode === 'bath'), '泡湯'); standUp(); ok(G.mode === 'walk' && okAt(G.pos.x, G.pos.z), '出浴後位置可走');
    const ch = W.shops.find(s => s.def.id === 'chaya'); G.pos.set(ch.front.x, 0, ch.front.z); claim(ch); ok(G.mode === 'owner', '開店當老闆');
    G.npcT = 0; ok(await until(() => G.queue.length > 0), 'NPC 客人上門點餐');
    const m1 = G.money; startMG(G.queue[0]); ok(MG.on, '做菜小遊戲開始');
    for (let g = 0; MG.on && g < 600; g++) { const st = MG.st; if (st && !st.done) { if (st.g === 'tap' && Math.abs(st.v - st.zc) < st.zw / 4) mgPress(true); if (st.g === 'mash') mgPress(true); if (st.g === 'hold') { if (!st.held) mgPress(true); else if (st.v >= st.zc) mgPress(false); } } await sleep(25); }
    ok(!MG.on && G.money > m1, '做完收錢 +' + (G.money - m1) + ' 文');
    await sleep(500); leaveOwner(); ok(G.mode === 'walk' && !G.owners.chaya, '收店');
    emote(10, 1e9); ok(await until(() => G.me.anim === 10), '跳舞'); G.emoteT = 0; sendEmoji('🌸'); ok(!!G.me.emo, '表情符號');
    ok(NPCS.filter(n => n.ch.root.visible).length >= 4 && NPCS.some(n => n.st === 'sit' || n.st === 'walk'), 'NPC 町人活動中（' + NPCS.filter(n => n.ch.root.visible).length + ' 人）');
    G.pos.set(30, 0, 3); const n = NPCS[0]; n.ch.root.position.set(31, 0, 3); n.st = 'idle'; n.goal = null; n.wait = 20;
    ok(await until(() => near && near.type === 'npc'), 'NPC 互動提示'); act(); ok(!!n.ch.bub, 'NPC 回話');
    G.me.bub = null; onChat(G.myId, '你好'); ok(!!G.me.bub, '聊天泡泡');
    { const kg = W.shops.find(s => s.def.id === 'kingyosukui'); openShop(kg); ok(!!$('#bPlay'), '金魚攤可以玩'); closePanels(); }
    G.pos.set(-128, 0, 0); ok(await until(() => near && near.type === 'pray'), '神社參拜點');
    G.pos.set(125, 0, 0); ok(okAt(125, 0) && !okAt(125, 5), '橋可走、河不可走');
    G.pos.set(178, 0, -40); ok(okAt(178, -40) && okAt(178, -47) && !okAt(171, -47) && okAt(178, -70), '寺院可從南大門走進去、兩側被擋');
    G.pos.set(178, 0, -72.3); ok(await until(() => near && near.type === 'temple'), '大佛殿參拜點');
    act(); ok(!$('#panel').classList.contains('hide'), '參拜選單');
    const mt = G.money; $('#tc5').click(); ok(G.money === mt - 5, '投 5 文');
    $('#tg').click(); ok(W.temple.ropeT > 0, '搖鈴（繩子擺動）');
    await sleep(900); $('#tp').click(); ok(!!$('#wishIn'), '祈福輸入框'); $('#wishIn').value = '希望江戶町越來越熱鬧'; $('#wishGo').click(); ok($('#panel').classList.contains('hide'), '送出後面板關閉'); ok(await until(() => G.me.anim === 17), '合掌參拜'); ok(await until(() => !!G.me.bub && $('#log').textContent.includes('願：希望江戶町越來越熱鬧')), '祈福內容顯示在頭上與聊天紀錄');
    G.pos.set(198.4, 0, -63.5); ok(await until(() => near && near.type === 'kane'), '鐘樓撞鐘點'); act(); ok(W.temple.strikeT > 0, '撞鐘（撞木擺動）');
    const dr = DEER[0]; G.pos.set(dr.g.position.x + 1, 0, dr.g.position.z); dr.wait = 30; ok(await until(() => near && near.type === 'deer'), '小鹿互動提示'); act(); ok(dr.bowT > 0, '小鹿鞠躬');
  } catch (e) { ok(false, 'EXC ' + e.message); }
  document.title = (fail ? 'FAIL ' : 'PASS ') + log.length;
  const d = document.createElement('pre'); d.style.cssText = 'position:fixed;left:8px;top:50px;z-index:99;background:rgba(255,255,255,.92);font-size:15px;padding:8px;margin:0'; d.textContent = (fail ? 'FAIL\n' : 'PASS\n') + log.join('\n'); document.body.appendChild(d);
}
if (QS.get('test') === 'flow') { store.set('helped', true); setTimeout(runTest, 1500); }
window.EDO = { step: n => { for (let i = 0; i < n; i++) update(1 / 30); render(); }, SND, openCard, openGM, camera, setHeld, get W() { return W; }, openShop, sitAt, openMenu, order, startMG, claim, cam };
