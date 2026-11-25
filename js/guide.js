// 新手之路：一步一步帶新玩家玩過核心內容（走路→聊天→點餐→吃→換裝→參拜→開店→拍照）
// 進度存在 store('guide')：步驟索引，99＝完成或略過。左上小卡顯示目前任務＋「帶我去」，目標位置有金色光柱。
import * as THREE from 'three';

const STEPS = [
  { ev: 'move', t: '先在街上走走看', h: '電腦：WASD／方向鍵（Shift 跑步）；手機：左下搖桿' },
  { ev: 'talk', t: '跟路上的町人聊聊天', h: '走近 NPC，按 E 或點畫面下方的按鈕' },
  { ev: 'get', t: '到「花見茶屋」坐下點一份茶點', h: '坐到長椅上 → 看菜單點餐 → 等老闆做好', go: 'chaya' },
  { ev: 'eat', t: '把點到的東西吃掉', h: '按畫面上的 🍡 就會吃掉，也可以帶著走或送人' },
  { ev: ['buy', 'acc'], t: '到「丸屋」換一件和服', h: '也可以去髮結床換髮型、小間物屋買飾品', go: 'gofuku' },
  { ev: 'pray', t: '到神社參拜，求個好運', h: '走到拜殿前按 E 投香油錢', go: 'pray' },
  { ev: 'cook', t: '到「信濃屋」開店當老闆，做一道料理', h: '客人點餐後點訂單開始做菜，做得好獎金越多', go: 'soba' },
  { ev: 'photo', t: '拍一張紀念照', h: '按下方 📷 拍照，可以存圖或分享給朋友' },
];
const REW = [20, 20, 30, 20, 40, 30, 50, 30];
let A, step = 99, el, beacon, moved = 0, lx = null, lz = null, tgt = null;

export function initGuide(api) {
  A = api; const s = A.store;
  if (s.get('guide', null) == null) s.set('guide', s.get('helped', false) ? 99 : 0); // 老玩家不打擾
  step = s.get('guide', 99); if (A.QS.has('test') || A.QS.has('noguide')) step = 99;
  A.P.EVL.push(onEv);
  el = document.getElementById('guide');
  // 金色光柱（上淡下亮）＋地上光圈
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(.7, 'rgba(255,210,110,.55)'); gr.addColorStop(1, 'rgba(255,240,190,.95)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c); beacon = new THREE.Group();
  const mat = { map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false };
  const col = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 14, 16, 1, true), new THREE.MeshBasicMaterial(mat)); col.position.y = 7; beacon.add(col);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .95, 32), new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .05; beacon.add(ring); beacon.userData.ring = ring;
  beacon.visible = false; A.scene.add(beacon);
  render();
}
const active = () => step < STEPS.length && A.G.mode !== 'title';
export const guiding = () => step < STEPS.length;
function target() {
  const s = STEPS[step]; if (!s || !s.go) return null;
  if (s.go === 'pray') { const p = A.W.spots.find(p => p.type === 'pray'); return p && { x: p.x, z: p.z, name: '神社' }; }
  return A.goTarget(s.go);
}
function render() {
  if (!el) return; el.classList.toggle('hide', !active()); if (!active()) { beacon.visible = false; return; }
  const s = STEPS[step]; tgt = target();
  el.innerHTML = `<div class="gh"><b>🧭 新手之路</b><span>${step + 1} / ${STEPS.length}</span><button class="gx" title="略過新手之路">✕</button></div>
    <div class="gt">${s.t}</div><div class="gs">${s.h}</div>
    <div class="gb"><i style="width:${step / STEPS.length * 100}%"></i></div>
    ${tgt ? `<button class="gg">🚶 帶我去</button>` : ''}<small class="gr">獎勵 ${REW[step]} 文</small>`;
  el.querySelector('.gx').onclick = () => { if (confirmSkip()) { step = 99; A.store.set('guide', 99); render(); } };
  const gg = el.querySelector('.gg'); if (gg) gg.onclick = () => A.startGoto(tgt);
}
function confirmSkip() { if (el.dataset.sk) return true; el.dataset.sk = 1; A.toast('再按一次 ✕ 就會略過新手之路（之後不會再出現）', 3000); setTimeout(() => delete el.dataset.sk, 3000); return false; }
function onEv(type) {
  if (!guiding()) return; const s = STEPS[step], evs = [].concat(s.ev);
  if (!evs.includes(type)) return; advance();
}
function advance() {
  const r = REW[step]; A.addMoney(r, '新手之路'); A.P.addXp(10, '新手之路'); A.sfx(880, .15); setTimeout(() => A.sfx(1320, .2), 120);
  step++; A.store.set('guide', step);
  if (step >= STEPS.length) { step = 99; A.store.set('guide', 99); A.addMoney(150, '新手之路完成'); A.toast('🎉 新手之路完成！多拿 150 文。接下來看看「📜 町人帳」的每日委託吧', 6000); if (A.G.me) A.G.me.emoji('🎉'); }
  else A.toast(`✔ 完成！下一步：${STEPS[step].t}`, 3500);
  render();
}
export function updGuide(dt, time) {
  if (!A || !active()) { if (beacon) beacon.visible = false; if (el && !el.classList.contains('hide') && !active()) el.classList.add('hide'); return; }
  if (el.classList.contains('hide')) render();
  if (STEPS[step].ev === 'move' && A.G.mode === 'walk') { const p = A.G.pos; if (lx != null) moved += Math.hypot(p.x - lx, p.z - lz); lx = p.x; lz = p.z; if (moved > 12) { moved = 0; advance(); } }
  if (tgt) { const d = Math.hypot(A.G.pos.x - tgt.x, A.G.pos.z - tgt.z); beacon.visible = d > 2.5; beacon.position.set(tgt.x, 0, tgt.z);
    const r = beacon.userData.ring, k = (time * .8) % 1; r.scale.setScalar(.6 + k * 1.2); r.material.opacity = .9 * (1 - k); beacon.children[0].material.opacity = .55 + Math.sin(time * 3) * .2; }
  else beacon.visible = false;
}
export const __guide = { get step() { return step; }, set(s) { step = s; moved = 0; lx = null; render(); }, get beacon() { return beacon; } }; // 測試用
