// 江戶町 主程式
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, walkable, heightAt } from './world.js';
import { Chara, randomLook, KIMONO, OBI, PATTERNS, HAIRS, SKINS } from './chara.js';
import { SHOPS, FORTUNE } from './shops.js';
import { Net } from './net.js';
import { cleanText } from './filter.js';

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
  if (typing()) { if (e.key === 'Enter' && document.activeElement.id === 'chatIn') sendChat(); if (e.key === 'Escape') document.activeElement.blur(); return; }
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
  const ch = new Chara(p.lk, ''); if (p.gm) ch.gm = true; ch.setName(p.gm ? '👑 ' + p.n : p.n); ch.root.position.set(p.x, p.y || 0, p.z); scene.add(ch.root);
  G.remotes.set(p.id, { ch, n: p.n, tx: p.x, ty: p.y || 0, tz: p.z, tr: p.r || 0, a: p.a || 0, lastX: p.x, lastZ: p.z });
  updCount();
}
function delRemote(id) { const r = G.remotes.get(id); if (!r) return; scene.remove(r.ch.root); G.remotes.delete(id); updCount(); }
function updCount() { $('#online').textContent = G.online ? `👥 ${G.remotes.size + 1} / 80 人在線` : '🏮 單人模式（離線）'; }

// NPC 町人（人少時代替玩家逛街、吃東西、聊天）、掌櫃
const NPCS = []; const keepers = {};
const NPC_NAMES = ['八っつぁん', '熊さん', 'お花', 'ご隠居', '与太郎', 'お菊', '源さん', 'お松', '辰五郎', 'おみつ', '金太', 'お竹', '新吉', 'お梅', '平助', 'お雪'];
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
  if (q < .08) { n.tx = -115 + Math.random() * 10; n.tz = (Math.random() - .5) * 4; }
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
    if (n.eatT > 0) { n.eatT -= dt; anim = n.st === 'sit' ? 5 : 15; if (n.eatT <= 0) { npcSetFood(n, ''); n.ch.say(['うまい！', '好吃～', 'ごちそうさま'][Math.floor(Math.random() * 3)], 3); } }
    if (n.st === 'talk') { if (!anim) anim = n.t < 1 ? 7 : 0; if (n.t > 4.5) { n.st = 'idle'; n.wait = 1; } }
    else if (n.st === 'sit') {
      if (!anim) anim = 3;
      const g = n.goal;
      if (g && g.k === 'shop') {
        const k = keepers[g.shop.def.id];
        if (!n.ordered) { n.ordered = 1; const items = g.shop.def.menu.filter(m => m.dish); n.food = g.shop.def.id + ':' + items[Math.floor(Math.random() * items.length)].id; if (k) k.cookT = 3; }
        if (n.t > 3 && n.ordered === 1) { n.ordered = 2; npcSetFood(n, n.food); }
        if (n.t > 5 && n.ordered === 2) { n.ordered = 3; n.eatT = 4; }
      } else if (n.t > 4 && !n.saidView && Math.random() < .002) { n.saidView = 1; n.ch.say(['風景真好～', 'いい眺めだ', '好想睡午覺…'][Math.floor(Math.random() * 3)], 4); }
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
  updPrompt();
}
function updPrompt() {
  const b = $('#act'); let label = '';
  if (G.mode === 'walk' && near) label = near.type === 'shop' ? `🏮 ${near.shop.def.name}（${near.shop.def.kind}）` : near.type === 'view' ? '🪑 坐下來看風景' : near.type === 'npc' ? `💬 跟「${near.npc.nm}」聊天` : near.spot.label;
  else if (G.mode === 'seat' || G.mode === 'bath') label = '🚶 起身離開';
  b.textContent = label ? (isTouch ? label : `[E] ${label}`) : ''; b.classList.toggle('hide', !label || G.busy);
}
function act() {
  if (G.busy) return;
  if (G.mode === 'seat' || G.mode === 'bath') return standUp();
  if (G.mode !== 'walk' || !near) return;
  if (near.type === 'shop') openShop(near.shop);
  else if (near.type === 'view') sitAt(near.seat);
  else if (near.type === 'npc') { npcTalk(near.npc); G.ry = Math.atan2(near.npc.ch.root.position.x - G.pos.x, near.npc.ch.root.position.z - G.pos.z); }
  else if (near.type === 'board') show('#help');
  else if (near.type === 'well') { G.me.say('井水好冰涼～'); emote(6); sfx(300, .3, 'sine', .05); }
  else if (near.type === 'pray') {
    if (!afford(1)) return toast('身上沒有錢可以投香油錢……');
    addMoney(-1, '香油錢'); emote(6); sfx(880, .6, 'sine', .06); setTimeout(() => sfx(1320, .8, 'sine', .04), 200);
    const b = ['願今天也平平安安。', '生意興隆！', '良緣成就！', '闔家平安。', '心想事成。', '學業進步！'];
    setTimeout(() => G.me.say('🙏 ' + b[Math.floor(Math.random() * b.length)]), 700);
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
  <div class="menu">${d.menu.map((m, i) => `<button class="mi" data-i="${i}" ${afford(m.p) ? '' : 'disabled'}><span class="jp">${m.n}</span><span class="zh">${m.zh}</span><span class="pr">${m.p} 文</span></button>`).join('')}</div>
  <div class="btns"><button id="bLeave">🚶 起身離開</button></div>`;
  show('#panel');
  p.querySelectorAll('.mi').forEach(b => b.onclick = () => order(s, d.menu[+b.dataset.i]));
  $('#bLeave').onclick = standUp;
}
function closePanels() { show('#panel', false); show('#help', false); show('#fortune', false); show('#ukiyo', false); }

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
  const lines = ['うまい！', '好吃！', '真是極品～', '這味道太棒了', 'ごちそうさま！'];
  if (item.dish) {
    setHeld(s.def.id + ':' + item.id);
    toast(`拿到「${item.n}」！品質：${gname}　按 🍡 吃掉，或帶著走、送給別人`, 3500);
    openMenu(s);
  } else if (item.look) {
    G.look = { ...G.look, ...item.look }; G.me.setLook(G.look); store.set('look', G.look); net.send({ t: 'look', lk: G.look }); G.me.emoji('✨');
    G.me.say('換好了！好看嗎？'); toast(`完成「${item.zh}」！品質：${gname}`); openMenu(s);
  } else if (item.fortune) {
    const arr = FORTUNE[item.fortune]; const [h, t] = arr[Math.floor(Math.random() * arr.length)];
    $('#fortune').innerHTML = `<div class="kuji"><div class="kt">${h}</div><p>${t}</p><button onclick="this.closest('.modal').classList.add('hide')">收下</button></div>`; show('#fortune'); show('#panel', false);
    G.me.say(`抽到「${h}」！`);
  } else if (item.art) { show('#panel', false); setTimeout(() => ukiyoe(item.art, s), 300); }
  else if (item.bath) {
    const seat = W.bath.find(b => seatFree(b)) || W.bath[0]; closePanels();
    toast('前往對岸的露天風呂～'); sitAt(seat, 'bath'); setTimeout(() => G.me.say('ふぅ～極樂極樂～'), 1200);
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
  toast(`「${s.def.name}」開店了！客人點餐後點訂單開始製作`, 3500); sfx(520, .2); setTimeout(() => sfx(780, .3), 150);
  renderOwner(); updPrompt();
}
function leaveOwner() {
  const s = G.shop; if (!s) return;
  if (G.online) net.send({ t: 'release', s: s.def.id }); delete G.owners[s.def.id];
  for (const c of G.npcCust) scene.remove(c.ch.root); G.npcCust = []; G.queue = []; mgAbort();
  G.mode = 'walk'; G.pos.set(s.front.x, 0, s.front.z); G.shop = null; show('#owner', false); updPrompt();
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
  Object.assign(MG, { on: true, o, i: 0, scores: [], st: null });
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
  const q = MG.scores.reduce((a, b) => a + b, 0) / MG.scores.length; const o = MG.o; MG.on = false; show('#mg', false);
  G.me.play(0); G.queue = G.queue.filter(x => x !== o);
  const [g] = grade(q); const bonus = Math.round(o.item.p * (q >= 85 ? .5 : q >= 60 ? .2 : 0));
  addMoney(o.item.p + bonus, `${g}${bonus ? '（含獎金 ' + bonus + '）' : ''}`);
  toast(`完成「${o.item.n}」品質：${g}，送給 ${o.n}！`);
  if (o.npc) {
    const c = o.npc; if (o.item.dish) placeDish(o.item, c.seat.dish, c.seat.r, 6); c.ch.play(o.item.dish ? 5 : 3);
    if (o.item.look) { c.ch.setLook({ ...c.ch.look, ...o.item.look }); }
    setTimeout(() => c.ch.say(['うまい！', '好吃！', '好手藝！', '下次再來！'][Math.floor(Math.random() * 4)], 3), 2500);
    setTimeout(() => { scene.remove(c.ch.root); G.npcCust = G.npcCust.filter(x => x !== c); }, 7000);
  } else {
    net.send({ t: 'serve', to: o.from, oid: o.oid, item: o.item.id, q: Math.round(q), s: G.shop.def.id });
  }
  renderOwner();
}
function mgAbort() { MG.on = false; show('#mg', false); }
function placeDishFor(r, item) {
  const p = r.ch.root.position; const seat = W.seats.find(s => Math.hypot(s.x - p.x, s.z - p.z) < .6);
  placeDish(item, seat ? seat.dish : new THREE.Vector3(p.x, p.y + .5, p.z), seat ? seat.r : 0, 7);
}
const mgB = $('#mgBtn');
mgB.addEventListener('pointerdown', e => { e.preventDefault(); mgPress(true); });
mgB.addEventListener('pointerup', e => { e.preventDefault(); mgPress(false); });
mgB.addEventListener('pointerleave', () => { if (MG.st && MG.st.g === 'hold' && MG.st.held) mgPress(false); });

// ---------- 手持食物 ----------
function itemById(fid) { const [sid, iid] = String(fid || '').split(':'); const sh = SHOPS.find(x => x.id === sid); return sh && sh.menu.find(m => m.id === iid); }
Chara.foodModel = fid => { const it = itemById(fid); return it && it.dish ? makeDish(it.dish) : null; };
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
}
function finishEat() {
  const it = G.eatItem; setHeld(''); const lines = ['うまい！', '好吃！', '真是極品～', '這味道太棒了', 'ごちそうさま！'];
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
    if (k === 'hi') { emote(7, 2); if (isN) { npcTalk(c.npc, ['こんにちは！', '你好呀～', 'いい天気だね！'][Math.floor(Math.random() * 3)]); c.npc.ch.emoji('👋'); } else net.send({ t: 'act', to: c.id, k: 'hi' }); }
    if (k === 'five') { emote(16, 1.6); if (isN) { npcTalk(c.npc, 'イェーイ！'); c.npc.ch.play(16); c.npc.five = 1.6; } else net.send({ t: 'act', to: c.id, k: 'five' }); sfx(1200, .08, 'square', .05); }
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

// ---------- GM 面板 ----------
function openGM() {
  const el = $('#gmPanel .card');
  el.innerHTML = `<button class="close" data-close>✕</button><h3>👑 GM 管理</h3>
  <div class="row"><input id="gmAnn" placeholder="公告內容"><button id="gmAnnB">📜 公告</button></div>
  <p class="sub">全服時間</p><div class="btns">${[['🌅 清晨', .27], ['☀ 正午', .5], ['🌇 黃昏', .755], ['🌙 夜晚', .9]].map(([t, v]) => `<button data-t="${v}">${t}</button>`).join('')}</div>
  <p class="sub" style="margin-top:12px">線上玩家（${G.remotes.size + 1} 人）— 點名字旁的按鈕管理</p>
  <div class="gml">${[...G.remotes.entries()].map(([id, r]) => `<div><b>${esc(r.n)}</b><span><button data-c="傳送" data-n="${esc(r.n)}">傳送</button><button data-c="召喚" data-n="${esc(r.n)}">召喚</button><button data-c="給" data-n="${esc(r.n)}">+100</button><button data-c="禁言" data-n="${esc(r.n)}">禁言</button><button data-c="踢" data-n="${esc(r.n)}">踢</button></span></div>`).join('') || '<p class="sub">目前只有你</p>'}</div>
  <p class="sub" style="margin-top:10px">聊天框也能打指令：/公告 文字、/時間 0.75、/傳送 名字、/召喚 名字、/給 名字 數量、/禁言 名字 分鐘、/解禁 名字、/踢 名字</p>`;
  show('#gmPanel'); el.querySelector('[data-close]').onclick = () => show('#gmPanel', false);
  $('#gmAnnB').onclick = () => { const v = $('#gmAnn').value.trim(); if (v) net.send({ t: 'chat', s: '/公告 ' + v }); $('#gmAnn').value = ''; };
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => net.send({ t: 'chat', s: '/時間 ' + b.dataset.t }));
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => net.send({ t: 'chat', s: `/${b.dataset.c} ${b.dataset.n}` }));
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
function openChat() { show('#chatBox'); $('#chatIn').focus(); }
function sendChat() {
  const v = $('#chatIn').value.trim(); $('#chatIn').value = ''; $('#chatIn').blur(); if (!isTouch) show('#chatBox', false);
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
  if (id === G.myId) { const p = G.pos; const cand = NPCS.filter(n => Math.hypot(n.ch.root.position.x - p.x, n.ch.root.position.z - p.z) < 7); if (cand.length && Math.random() < .55) { const n = cand[Math.floor(Math.random() * cand.length)]; setTimeout(() => npcTalk(n, /[?？嗎]/.test(s) ? ['嗯…我也不太清楚呢。', 'ほう、いい質問だ。', '去問問掌櫃吧！'][Math.floor(Math.random() * 3)] : /好吃|うま|美味/.test(s) ? '對吧！這家店是老字號了。' : /こんにち|你好|哈囉|嗨/.test(s) ? 'こんにちは！旅人さん。' : npcLine('reply')), 900); } }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACTIONS = [[7, '👋', '揮手', 2.2], [6, '🙇', '鞠躬', 2], [9, '👏', '拍手', 2.4], [14, '😆', '大笑', 2.4], [11, '🙌', '萬歲', 2.6], [13, '👉', '指路', 2.5], [10, '💃', '跳舞', 1e9], [12, '🧘', '坐在地上', 1e9]];
const EMOJIS = ['😊', '😂', '😍', '😮', '😢', '😡', '😴', '🤔', '👍', '❤️', '🎉', '🍵', '🍜', '🌸', '🏮', '💰'];
const PHRASES = ['こんにちは！', 'いらっしゃい！', 'ありがとう！', '好吃嗎？', '一起逛街吧', '要不要來我店裡？', '你的和服好漂亮', '去看富士山吧', 'またね～'];
function emote(a, dur = 2.2) { if (G.mode !== 'walk') { if (a !== 6) toast('站著的時候才能做動作喔'); return; } G.emote = a; G.emoteT = dur; G.me.play(a); }
function sendEmoji(e) { G.me.emoji(e); net.send({ t: 'emote', e }); }
const NPC_LINES = {
  day: ['今天天氣真好啊。', '聽說信濃屋的蕎麥麵很好吃。', '過了日本橋有露天風呂喔。', '神社的櫻花開得正美。', '我正要去買糰子。', '吳服屋進了新的布料呢。', '最近浮世繪很流行。'],
  dusk: ['夕陽下的富士山真美…', '該回家吃晚飯了。', '燈籠要點起來囉。', '暮れ六つの鐘が鳴るぞ。'],
  night: ['晚上河邊有螢火蟲。', '居酒屋千鳥的熱燗最暖了。', '夜路要小心喔。', '泡個湯再睡吧～'],
  reply: ['へぇ～', 'そうだねぇ', '哈哈，說得好！', '原來如此。', 'ほう？', '真的嗎？', '江戶人最愛熱鬧了！'],
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
  const rows = [['k', '和服', KIMONO.map(k => k[1]), KIMONO.map(k => k[0])], ['p', '花紋', null, PATTERNS], ['o', '腰帶', OBI, null], ['h', '髮型', null, HAIRS], ['s', '膚色', SKINS, null]];
  $('#looks').innerHTML = rows.map(([k, t, cols, names]) => `<div class="lr"><span>${t}</span><div>${(cols || names).map((c, i) => cols ? `<button class="sw" data-k="${k}" data-v="${i}" style="background:${c}" title="${names ? names[i] : ''}"></button>` : `<button class="tx" data-k="${k}" data-v="${i}">${c}</button>`).join('')}</div></div>`).join('');
  const sync = () => document.querySelectorAll('#looks [data-k]').forEach(b => b.classList.toggle('on', G.look[b.dataset.k] == b.dataset.v));
  document.querySelectorAll('#looks [data-k]').forEach(b => b.onclick = () => { G.look[b.dataset.k] = +b.dataset.v; G.me.setLook(G.look); sync(); });
  sync();
  $('#rnd').onclick = () => { G.look = randomLook(); G.look.hat = 0; G.look.c = 0; G.me.setLook(G.look); sync(); };
  $('#go').onclick = start;
  if (QS.has('embed')) { const a = document.createElement('a'); a.className = 'big'; a.target = '_blank'; a.rel = 'noopener'; a.href = location.origin + location.pathname; a.textContent = '↗ 開新分頁全螢幕玩'; a.style.cssText = 'display:block;text-align:center;margin-top:8px'; $('#go').parentElement.after(a); }
  $('#nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
}
async function start() {
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
  G.mode = 'walk'; cam.yaw = PI / 2 - .25; cam.pitch = .3; cam.dist = 6.5;
  updCount(); toast(G.online ? `歡迎來到江戶町${['一', '二', '三', '四', '五'][G.room - 1]}丁目！` : '目前為單人模式（伺服器未連線），NPC 會陪你玩', 3500);
  updHeld();
  if (!store.get('helped', false) && !G.shot) { show('#help'); store.set('helped', true); }
  sfx(660, .3); setTimeout(() => sfx(990, .4), 180);
}

// ---------- 連線事件 ----------
setInterval(() => { if (G.online) net.send({ t: 'ping' }); }, 15000);
net.on('welcome', m => {
  G.myId = m.id; G.timeOff = m.timeOff || 0; G.owners = m.shops || {};
  if (m.gm) { G.gm = true; G.me.gm = true; G.me.setName('👑 ' + m.n); setMoney(G.money); show('#bGM'); toast('👑 GM 模式：錢用不完、可使用管理面板', 3500); }
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
net.on('join', m => { addRemote(m); toast(`「${m.n}」來到了江戶町`); });
net.on('leave', m => delRemote(m.id));
net.on('s', m => { for (const [id, x, z, y, r, a] of m.p) { const R = G.remotes.get(id); if (R) { R.tx = x; R.tz = z; R.ty = y; R.tr = r; R.a = a; } } });
net.on('chat', m => onChat(m.id, m.s));
net.on('emote', m => { const R = G.remotes.get(m.id); if (R) R.ch.emoji(m.e); });
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
    const p = G.me.root.position; const a = time * .12;
    camera.position.set(p.x - 3.6 * Math.cos(a * .5 - .4), 1.55, p.z + 3.6 * Math.sin(a * .5 - .4) * .6 + 1.2); camera.lookAt(p.x, 1.05, p.z);
    G.me.root.rotation.y = -PI / 2 + Math.sin(time * .4) * .5; G.me.update(dt, 0);
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
    if (G.eatT > 0) { G.eatT -= dt; anim = G.mode === 'walk' ? (speed > 0 ? anim : 15) : 5; if (G.eatT <= 0) finishEat(); }
    if (G.mode === 'bath') anim = 8;
    if (G.mode === 'owner') anim = MG.on ? 4 : 0;
    G.me.play(anim); G.me.root.position.copy(G.pos); G.me.root.rotation.y = G.ry; G.me.update(dt, speed);
    // 鏡頭
    const tgt = new THREE.Vector3(G.pos.x, G.pos.y + 1.45, G.pos.z);
    if (cam.auto) { cam.yaw += dt * .06; cam.pitch += (.18 - cam.pitch) * dt * .5; }
    cam.tx += (tgt.x - cam.tx) * Math.min(1, dt * 8); cam.ty += (tgt.y - cam.ty) * Math.min(1, dt * 8); cam.tz += (tgt.z - cam.tz) * Math.min(1, dt * 8);
    let dist = cam.auto ? 11 : cam.dist;
    const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    for (let k = .5; k < dist; k += .25) { const x = cam.tx + off.x * k, y = cam.ty + off.y * k, z = cam.tz + off.z * k; if (y < 7 && x > -98 && x < 101 && Math.abs(z) > 7.4 && Math.abs(z) < 18 && G.mode !== 'owner') { dist = Math.max(1.2, k - .3); break; } }
    camera.position.set(cam.tx + off.x * dist, Math.max(.4 + heightAt(cam.tx, cam.tz), cam.ty + off.y * dist), cam.tz + off.z * dist);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
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
  updNPCs(dt);
  W.update(dt, time, tday(), G.me ? G.me.root.position : new THREE.Vector3(), camera.position, quality);
  if (bloom) bloom.strength = .18 + W.night * .55;
}
function render() { if (G.shot) { const v = G.shot; camera.position.set(v[0], v[1], v[2]); camera.lookAt(v[3], v[4], v[5]); } if (quality === 2 && composer) composer.render(); else renderer.render(scene, camera); }
let miniT = 0;
let frameN = 0;
function loop() {
  if (QS.has('test')) { update(1 / 30); if (frameN++ % 15 === 0) render(); setTimeout(loop, 33); return; }
  const dt = Math.min(.05, clock.getDelta()); update(dt); render(); requestAnimationFrame(loop);
}

// ---------- 小地圖 ----------
const mini = $('#mini'), mg = mini.getContext('2d');
function drawMini() {
  if (mini.classList.contains('hide')) return;
  const w = mini.width, h = mini.height, sx = w / 340, ox = -160; const X = x => (x - ox) * sx, Z = z => h / 2 + z * sx;
  mg.clearRect(0, 0, w, h); mg.fillStyle = 'rgba(243,234,214,.92)'; mg.fillRect(0, 0, w, h);
  mg.fillStyle = '#cdbb98'; mg.fillRect(X(-100), Z(-7), (206) * sx, 14 * sx);
  mg.fillStyle = '#d9d2c2'; mg.fillRect(X(-150), Z(-24), 52 * sx, 48 * sx);
  mg.fillStyle = '#6aa0b8'; mg.fillRect(X(112), 0, 26 * sx, h);
  mg.fillStyle = '#8a6440'; mg.fillRect(X(110), Z(-2.4), 30 * sx, 4.8 * sx);
  mg.fillStyle = '#c8402c'; mg.fillRect(X(-101) - 2, Z(-3), 4, 6 * sx);
  for (const s of W.shops) { mg.fillStyle = G.owners[s.def.id] ? '#c8322a' : '#5a4636'; mg.fillRect(X(s.def.x - s.def.w / 2), Z(s.def.side * 7) - (s.def.side < 0 ? 9 * sx : 0), s.def.w * sx, 9 * sx); }
  mg.fillStyle = '#7fb8b4'; mg.beginPath(); mg.arc(X(160), Z(14), 3.4 * sx, 0, 7); mg.fill();
  mg.fillStyle = '#2a4b7c'; for (const [, R] of G.remotes) { mg.beginPath(); mg.arc(X(R.tx), Z(R.tz), 2.2, 0, 7); mg.fill(); }
  mg.fillStyle = '#e8322a'; mg.beginPath(); mg.arc(X(G.pos.x), Z(G.pos.z), 3.4, 0, 7); mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 1.5; mg.stroke();
  mg.font = '600 10px sans-serif'; mg.fillStyle = '#3a2a1a'; mg.fillText('神社', X(-140), Z(-17)); mg.fillText('日本橋', X(110), Z(-6)); mg.fillText('湯', X(157), Z(6)); mg.fillText('御觸書', X(92), Z(-12));
}
mini.onclick = () => { const big = mini.classList.toggle('big'); mini.width = big ? 520 : 240; mini.height = big ? 260 : 120; drawMini(); };

// ---------- UI 綁定 ----------
$('#act').onclick = act;
$('#bChat').onclick = openChat;
$('#chatSend').onclick = sendChat;
const pop = (id, on) => { ['#actMenu', '#emoMenu'].forEach(x => show(x, x === id ? (on ?? $(x).classList.contains('hide')) : false)); };
$('#actMenu').innerHTML = ACTIONS.map(([a, ic, nm, d], i) => `<button data-a="${i}"><span>${ic}</span>${nm}${isTouch ? '' : `<kbd>${i + 1}</kbd>`}</button>`).join('');
$('#emoMenu').innerHTML = EMOJIS.map(e => `<button data-e="${e}">${e}</button>`).join('');
$('#phr').innerHTML = PHRASES.map(t => `<button>${t}</button>`).join('');
document.querySelectorAll('#actMenu [data-a]').forEach(b => b.onclick = () => { const [a, , , d] = ACTIONS[+b.dataset.a]; emote(a, d); pop(null); });
document.querySelectorAll('#emoMenu [data-e]').forEach(b => b.onclick = () => { sendEmoji(b.dataset.e); pop(null); });
document.querySelectorAll('#phr button').forEach(b => b.onclick = () => { $('#chatIn').value = b.textContent; sendChat(); });
$('#bAct').onclick = () => pop('#actMenu'); $('#bEmo').onclick = () => pop('#emoMenu');
$('#bView').onclick = toggleView;
$('#bGM').onclick = openGM;
$('#bHelp').onclick = () => show('#help');
$('#bSet').onclick = () => { show('#settings'); document.querySelectorAll('#settings [data-q]').forEach(b => b.classList.toggle('on', +b.dataset.q === quality)); };
document.querySelectorAll('#settings [data-q]').forEach(b => b.onclick = () => { quality = +b.dataset.q; store.set('q', quality); applyQuality(); document.querySelectorAll('#settings [data-q]').forEach(x => x.classList.toggle('on', +x.dataset.q === quality)); });
document.querySelectorAll('.modal').forEach(m => m.addEventListener('pointerdown', e => { if (e.target === m) m.classList.add('hide'); }));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.add('hide'));
if (isTouch) document.body.classList.add('touch');

// ---------- 啟動 ----------
(async () => {
  try { await Promise.race([document.fonts.load('700 64px "Yuji Syuku"'), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
  W = buildWorld(scene);
  W.sunLight = scene.children.find(o => o.isDirectionalLight);
  setupPost(); applyQuality();
  addMe(); spawnNPCs(); buildTitle();
  $('#loading').classList.add('hide');
  if (QS.has('cam')) { G.shot = QS.get('cam').split(',').map(Number); show('#title', false); }
  if (QS.has('auto')) { $('#nameIn').value = QS.get('auto') || '測試'; start(); }
  loop();
})();

// ---------- 自動測試 ?test=flow ----------
async function runTest() {
  const log = []; let fail = false; const ok = (c, m) => { log.push((c ? '✔ ' : '✘ ') + m); if (!c) fail = true; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, ms = 15000) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await sleep(50); return f(); };
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
    const ko = W.shops.find(s => s.def.id === 'komamono'); openShop(ko); $('#bCust').click(); order(ko, ko.def.menu.find(m => m.id === 'kitsune'));
    ok(await until(() => G.look.hat === 4 && G.me.accG.children.length > 0), '狐狸面具戴在頭上'); order(ko, ko.def.menu.find(m => m.id === 'inro')); ok(await until(() => G.look.w === 1 && G.me.waistG.children.length > 0), '印籠掛腰間'); standUp();
    const dg = W.shops.find(s => s.def.id === 'dango'); openShop(dg); $('#bCust').click(); order(dg, dg.def.menu[1]); ok(await until(() => G.look.f === 'dango:sanshoku'), '買糰子'); standUp();
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
    G.pos.set(-128, 0, 0); ok(await until(() => near && near.type === 'pray'), '神社參拜點');
    G.pos.set(125, 0, 0); ok(okAt(125, 0) && !okAt(125, 5), '橋可走、河不可走');
  } catch (e) { ok(false, 'EXC ' + e.message); }
  document.title = (fail ? 'FAIL ' : 'PASS ') + log.length;
  const d = document.createElement('pre'); d.style.cssText = 'position:fixed;left:8px;top:50px;z-index:99;background:rgba(255,255,255,.92);font-size:15px;padding:8px;margin:0'; d.textContent = (fail ? 'FAIL\n' : 'PASS\n') + log.join('\n'); document.body.appendChild(d);
}
if (QS.get('test') === 'flow') { store.set('helped', true); setTimeout(runTest, 1500); }
window.EDO = { openCard, openGM, camera, setHeld, get W() { return W; }, openShop, sitAt, openMenu, order, startMG, claim, cam };
