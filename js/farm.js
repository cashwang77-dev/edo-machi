// 郊外農村：自己的田（8 塊）——種屋買種子、依真實時間成長、澆水加速、收成賣給八百屋
import * as THREE from 'three';
import { WX } from './weather.js?v=202611260116';
const PI = Math.PI;
export const FARM = { x0: -100.5, x1: -22, z0: 46, z1: 136 };
export function walkFarm(x, z) { return x >= FARM.x0 && x <= FARM.x1 && z >= FARM.z0 && z <= FARM.z1 && !(x > -36 && x < -26 && z > 106.5 && z < 113.5); } // 農家擋住
// 作物：[id, 名, 中文, 種子價, 賣價, 成長小時, 需要等級, 顏色]
export const CROPS = [['kabu', '蕪', '蕪菁', 5, 16, .5, 1, '#f4f0e8'], ['daikon', '大根', '白蘿蔔', 6, 22, 1, 1, '#f8f6ee'], ['negi', '葱', '青蔥', 6, 20, 1.5, 1, '#5a9a3a'],
  ['nasu', '茄子', '茄子', 8, 30, 2, 1, '#5a2a6a'], ['kyuri', '胡瓜', '小黃瓜', 8, 28, 2, 1, '#3a7a2a'], ['satsuma', '薩摩芋', '番薯', 12, 48, 4, 2, '#b04a5a'],
  ['kabocha', '南瓜', '南瓜', 15, 62, 6, 3, '#3a5a3a'], ['suika', '西瓜', '西瓜', 20, 95, 10, 3, '#2a6a2a'], ['ine', '稲', '稻米', 18, 80, 12, 2, '#d8b850'], ['cha', '茶葉', '茶葉', 25, 115, 18, 5, '#2a5a2a']];
export const BEDS = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) BEDS.push({ x: -88 + c * 9, z: 64 + r * 9 });
const SEED = { x: -40, z: 58 }, VEG = { x: -40, z: 74 };
let A, grp = null, tick = 0;
const $ = s => document.querySelector(s);
const cropOf = id => CROPS.find(c => c[0] === id);

export function buildFarm(ctx) {
  const { M, boxG, std, B, W, col, TX, scene, pine } = ctx;
  const gm = std('fmGrass', { map: TX.ground('g2').clone(), color: '#b8c888' }); gm.map.repeat.set(20, 22); gm.map.needsUpdate = true;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(FARM.x1 - FARM.x0, FARM.z1 - FARM.z0), gm); g.rotation.x = -PI / 2; g.position.set((FARM.x0 + FARM.x1) / 2, .013, (FARM.z0 + FARM.z1) / 2); g.receiveShadow = true; scene.add(g);
  const soil = std('fmSoil', { color: '#6a4a30', roughness: .95 }), ridge = std('fmRidge', { color: '#7a5636', roughness: .95 }), wd = std('fmWood', { color: '#7a5a3a' }), straw = std('fmStraw', { color: '#d8c070' });
  BEDS.forEach((b, i) => { const gr = new THREE.Group(); gr.position.set(b.x, 0, b.z); gr.add(M(boxG(7, .18, 6, 1), soil, 0, .09, 0)); for (let k = -2; k <= 2; k++) gr.add(M(boxG(6.6, .14, .5, 1), ridge, 0, .22, k * 1.15)); B.bake(gr);
    W.spots.push({ type: 'bed', i, x: b.x, z: b.z + 3.6, label: `🌱 我的田 ${i + 1} 號` }); });
  // 稻草人
  { const s = new THREE.Group(); s.position.set(-52, 0, 68.5); s.add(M(boxG(.12, 2.2, .12, 1), wd, 0, 1.1, 0)); s.add(M(boxG(1.6, .1, .1, 1), wd, 0, 1.7, 0)); s.add(M(new THREE.SphereGeometry(.28, 10, 8), std('fmFace', { color: '#efe6d0' }), 0, 2.3, 0)); s.add(M(new THREE.ConeGeometry(.55, .4, 12), straw, 0, 2.6, 0)); s.add(M(boxG(.9, .8, .3, 1), std('fmCloth', { color: '#3a5a8a' }), 0, 1.5, 0)); B.bake(s); col(-52, 68.5, .5); }
  // 農家（茅葺）
  { const h = new THREE.Group(); h.position.set(-31, 0, 110); h.add(M(boxG(9, 3, 6, 1), std('fmWall', { color: '#d8c8a8' }), 0, 1.5, 0)); const r = M(new THREE.ConeGeometry(7, 4, 4), straw, 0, 5, 0, 0, PI / 4, 0); r.scale.set(1, 1, .75); h.add(r); h.add(M(boxG(1.6, 2, .1, 1), std('fmDoor', { color: '#4a3424' }), 0, 1, -3.05)); B.bake(h); }
  // 井戸、木
  { const w = new THREE.Group(); w.position.set(-60, 0, 86); w.add(M(new THREE.CylinderGeometry(.8, .85, .8, 14), std('fmStone', { color: '#9a958a' }), 0, .4, 0)); for (const x of [-.8, .8]) w.add(M(boxG(.12, 2, .12, 1), wd, x, 1, 0)); w.add(M(boxG(2, .12, 1.2, 1), std('fmRoofW', { color: '#4a3e34' }), 0, 2.05, 0)); B.bake(w); col(-60, 86, 1); W.spots.push({ type: 'well', x: -60, z: 87.6, label: '💧 喝口井水' }); }
  for (let i = 0; i < 9; i++) pine(B, -96 + (i % 3) * 30 + Math.random() * 6, 100 + Math.floor(i / 3) * 12 + Math.random() * 4, 1 + Math.random() * .4, Math.random);
  // 種屋・八百屋 攤子
  for (const [p, nm, c, type, lbl] of [[SEED, '種屋', '#7a5a3a', 'seed', '🌰 種屋（買種子）'], [VEG, '八百屋', '#4a7a3a', 'veg', '🥬 八百屋（賣作物）']]) {
    const s = new THREE.Group(); s.position.set(p.x, 0, p.z); s.rotation.y = -PI / 2;
    s.add(M(boxG(4, .9, 1.4, 1), wd, 0, .45, 0)); for (const x of [-1.8, 1.8]) s.add(M(boxG(.12, 2.4, .12, 1), wd, x, 1.2, -.5));
    s.add(M(boxG(4.6, .1, 2, 1), std('fmAwn' + type, { color: c }), 0, 2.45, .1, .2, 0, 0));
    s.add(M(new THREE.BoxGeometry(2.2, .6, .06), std('fmSg' + type, { map: TX.text(nm, { bg: '#efe2c0', fg: '#1c1410', w: 384, h: 112, vertical: false }) }), 0, 2.0, -.5));
    for (let j = 0; j < 5; j++) s.add(M(new THREE.SphereGeometry(.2, 8, 6), std('fmGood' + type + (j % 3), { color: type === 'seed' ? ['#8a6a44', '#c8a060', '#5a4030'][j % 3] : ['#f4f0e8', '#5a2a6a', '#e07a2a'][j % 3] }), -1.4 + j * .7, 1.05, 0));
    B.bake(s); col(p.x, p.z - 1, 1.2); col(p.x, p.z + 1, 1.2);
    W.spots.push({ type, x: p.x + 1.8, z: p.z, label: lbl }); W.farmKeepers = W.farmKeepers || []; W.farmKeepers.push({ x: p.x - .9, z: p.z, r: PI / 2 });
  }
  W.spots.push({ type: 'meisho', x: -70, z: 92, label: '📸 名所：郊外の田園', info: '江戶郊外的田園：町人在這裡種菜、種稻，收成後挑到城裡的八百屋賣。春天一片新綠，秋天稻穗金黃。', say: '空氣好清新～' });
}

// ---- 存檔 ----
function fields() { const S = A.P.prog(); if (!S) return []; S.farm = S.farm || BEDS.map(() => null); return S.farm; }
const now = () => Date.now();
function prog(b) { if (!b) return 0; const c = cropOf(b.c), dur = c[5] * 3600e3 * (b.w ? .75 : 1); return Math.min(1, (now() - b.t) / dur); }
function leftTxt(b) { const c = cropOf(b.c), dur = c[5] * 3600e3 * (b.w ? .75 : 1), ms = Math.max(0, b.t + dur - now()); const h = Math.floor(ms / 3600e3), m = Math.ceil((ms % 3600e3) / 60000); return h ? `${h} 小時 ${m} 分` : `${m} 分`; }

// ---- 作物模型 ----
const MT = {}; const mat = (c) => MT[c] || (MT[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
function cropMesh(id, p) {
  const g = new THREE.Group(), c = cropOf(id), leaf = mat('#5a9a3a');
  for (let k = -2; k <= 2; k++) for (let j = -1; j <= 1; j++) {
    const x = j * 2.1, z = k * 1.15, s = p < .3 ? .35 : p < 1 ? .7 : 1;
    const l = new THREE.Mesh(new THREE.ConeGeometry(.22 * s, .6 * s, 5), leaf); l.position.set(x, .3 + .3 * s, z); g.add(l);
    if (p >= 1) { let f;
      if (['daikon', 'kabu'].includes(id)) { f = new THREE.Mesh(new THREE.SphereGeometry(id === 'kabu' ? .2 : .16, 8, 6), mat(c[7])); f.scale.y = id === 'kabu' ? 1 : 1.8; f.position.set(x, .35, z); }
      else if (['kabocha', 'suika'].includes(id)) { f = new THREE.Mesh(new THREE.SphereGeometry(.32, 10, 8), mat(c[7])); f.scale.y = .8; f.position.set(x + .35, .4, z); }
      else if (id === 'ine') { f = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, 1.1, 5), mat('#d8b850')); f.position.set(x, .8, z); f.rotation.z = .25; }
      else { f = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), mat(c[7])); f.scale.y = id === 'negi' ? 3 : 1.6; f.position.set(x + .2, .55, z); }
      g.add(f); }
  }
  return g;
}
function rebuild() {
  if (grp) A.scene.remove(grp); grp = new THREE.Group();
  fields().forEach((b, i) => { if (!b) return; const m = cropMesh(b.c, prog(b)); m.position.set(BEDS[i].x, 0, BEDS[i].z); grp.add(m);
    if (b.w) { const w = new THREE.Mesh(new THREE.BoxGeometry(6.8, .02, 5.8), mat('#4a3420')); w.position.set(BEDS[i].x, .2, BEDS[i].z); grp.add(w); } });
  A.scene.add(grp);
}

// ---- 面板 ----
function panel(html) { const p = $('#panel'); p.innerHTML = html + '<button class="close" id="fmX">✕</button>'; A.show('#panel'); $('#fmX').onclick = A.closePanels; return p; }
export function openBed(i) {
  const F = fields(), b = F[i], seeds = A.P.bag('seed');
  if (!b) {
    const own = CROPS.filter(c => (seeds[c[0]] || 0) > 0);
    const pp = panel(`<h2>我的田 ${i + 1} 號<small>空田</small></h2><p class="sub">選一種種子播下去吧！作物依照真實時間成長，收成時間到了再回來採收。</p>
      ${own.length ? `<div class="mlist">${own.map(c => `<div class="mrow"><span>${c[1]} <small>${c[2]}・約 ${c[5] >= 1 ? c[5] + ' 小時' : c[5] * 60 + ' 分'}</small></span><span>種子 ×${seeds[c[0]]}</span><span>賣 ${c[4]} 文</span><button data-p="${c[0]}">播種</button></div>`).join('')}</div>` : '<p class="sub">身上沒有種子，先到東邊的「種屋」買吧。</p>'}`);
    pp.querySelectorAll('[data-p]').forEach(x => x.onclick = () => { A.P.bagAdd('seed', x.dataset.p, -1); F[i] = { c: x.dataset.p, t: now(), w: false }; A.P.save(); rebuild(); A.P.ev('plant', { k: x.dataset.p }); A.G.me.emoji('🌱'); A.toast(`種下了${cropOf(x.dataset.p)[1]}！記得澆水會長得更快`, 3000); openBed(i); });
    return;
  }
  const c = cropOf(b.c), p = prog(b);
  if (p >= 1) {
    const pp = panel(`<h2>我的田 ${i + 1} 號<small>${c[1]}</small></h2><p class="sub">🎉 ${c[1]}（${c[2]}）成熟了！</p><div class="btns"><button class="big" id="fmH">🧺 收成</button></div>`);
    pp.querySelector('#fmH').onclick = () => { const n = 2 + Math.floor(Math.random() * 3) + (b.w ? 1 : 0); A.P.bagAdd('crop', b.c, n); F[i] = null; A.P.save(); rebuild(); A.P.ev('crop', { k: b.c, n }); A.G.me.emoji('🧺'); A.G.me.say(`收成 ${n} 個${c[1]}！`, 3); A.closePanels(); };
    return;
  }
  const pp = panel(`<h2>我的田 ${i + 1} 號<small>${c[1]}</small></h2><div class="xpbar"><i style="width:${Math.round(p * 100)}%"></i><span>成長 ${Math.round(p * 100)}%　還要 ${leftTxt(b)}</span></div>
    <p class="sub">${b.w ? '💧 已經澆過水了（成長時間縮短 25%）' : '還沒澆水——澆了水會長得更快，收成也多一個！'}</p>
    <div class="btns">${b.w ? '' : '<button class="big" id="fmW">💧 澆水</button>'}<button id="fmD">剷掉重種</button></div>`);
  const w = pp.querySelector('#fmW'); if (w) w.onclick = () => { b.w = true; A.P.save(); rebuild(); A.P.ev('water'); A.G.me.emoji('💧'); A.SND.pluck(520, .06); openBed(i); };
  pp.querySelector('#fmD').onclick = () => { F[i] = null; A.P.save(); rebuild(); A.toast('把田剷平了'); A.closePanels(); };
}
export function openSeed() {
  const lv = A.P.prog().lv;
  const pp = panel(`<h2>種屋<small>種子專賣</small></h2><p class="sub">「今年的種子很飽滿喔！」　身上：<b>${A.G.money}</b> 文</p>
    <div class="mlist">${CROPS.map(c => `<div class="mrow"><span>${c[1]} <small>${c[2]}・${c[5] >= 1 ? c[5] + ' 小時' : c[5] * 60 + ' 分'}・賣 ${c[4]}</small></span><span>持有 ${A.P.bag('seed')[c[0]] || 0}</span><span>${c[3]} 文</span>${lv >= c[6] ? `<button data-b="${c[0]}" data-p="${c[3]}">買</button>` : `<small>Lv.${c[6]}</small>`}</div>`).join('')}</div>`);
  pp.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const p = +b.dataset.p; if (!A.afford(p)) return A.toast('錢不夠喔'); A.addMoney(-p, ''); A.P.bagAdd('seed', b.dataset.b, 1); openSeed(); });
}
export function openVeg() {
  const bg = A.P.bag('crop'), ks = Object.keys(bg).filter(k => bg[k] > 0), tot = ks.reduce((a, k) => a + cropOf(k)[4] * bg[k], 0);
  const pp = panel(`<h2>八百屋<small>蔬果收購</small></h2><p class="sub">「新鮮的菜，城裡人最愛了！」</p>
    ${ks.length ? `<div class="mlist">${ks.map(k => { const c = cropOf(k); return `<div class="mrow"><span>${c[1]} <small>${c[2]}</small></span><span>×${bg[k]}</span><span>${c[4]} 文</span><button data-s="${k}">賣 1</button></div>`; }).join('')}</div><div class="btns"><button class="big" id="fmAll">💰 全部賣掉（${tot} 文）</button></div>` : '<p class="sub">還沒有收成可以賣。</p>'}`);
  const sell = o => { let sum = 0, n = 0; for (const k in o) { sum += cropOf(k)[4] * o[k]; n += o[k]; A.P.bagAdd('crop', k, -o[k]); } if (n) { A.addMoney(sum, `賣菜 ${n} 個`); A.P.ev('sellveg', { n }); } };
  pp.querySelectorAll('[data-s]').forEach(x => x.onclick = () => { sell({ [x.dataset.s]: 1 }); openVeg(); });
  const al = pp.querySelector('#fmAll'); if (al) al.onclick = () => { sell({ ...bg }); openVeg(); };
}
export function farmUpdate(dt) { if (!A) return; tick += dt; if (tick > 20) { tick = 0; if (WX.rain > .4) { const F = fields(); let n = 0; for (const b of F) if (b && !b.w) { b.w = true; n++; } if (n) { A.P.save(); A.toast(`🌧️ 雨水幫你澆了 ${n} 塊田`, 2500); } } if (grp) rebuild(); } } // 每 20 秒更新作物外觀
export function initFarm(api) {
  A = api; A.P.addDexCat('crop', '🥬 作物', CROPS.map(c => ({ k: c[0], n: c[1], zh: c[2] })));
  for (const k of A.W.farmKeepers || []) { const ch = A.makeNPC({ ...A.randomLook(), hat: 0, c: 0 }); ch.root.position.set(k.x, 0, k.z); ch.root.rotation.y = k.r; A.scene.add(ch.root); }
  rebuild();
}
export const farmState = () => fields();
