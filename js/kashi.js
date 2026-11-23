// 隅田川河岸（日本橋西岸往北）：釣魚棧橋、魚河岸（魚市）、屋形船
import * as THREE from 'three';
const PI = Math.PI;

export const KASHI = { x0: 86, x1: 111.6, z0: -134, z1: -38 }; // 河岸廣場可走範圍
export const PIERS = [-60, -82, -104, -124];                    // 棧橋中心 z
export const PIER_X = 118.2;                                    // 棧橋前端
export function walkKashi(x, z) {
  if (x >= KASHI.x0 && x <= KASHI.x1 && z >= KASHI.z0 && z <= KASHI.z1) return !(x < 92.5 && x > 86 && z < -52 && z > -120 && !nearGap(z)); // 魚市攤位那一排擋住（留通道）
  if (x > 111 && x <= PIER_X && PIERS.some(p => Math.abs(z - p) < 1.15)) return true;     // 棧橋
  return false;
}
const GAPS = [-64, -86, -108];
function nearGap(z) { return GAPS.some(g => Math.abs(z - g) < 1.6); }

// 魚：[id, 名, 中文, 稀有度(0 垃圾、1 常見…6 傳說), 賣價, 時段 any|day|night]
export const FISH = [
  ['haze', 'ハゼ', '沙鰕虎', 1, 12, 'any'], ['funa', 'フナ', '鯽魚', 1, 10, 'any'], ['dojo', 'ドジョウ', '泥鰍', 1, 8, 'any'], ['medaka', 'メダカ', '青鱂魚', 1, 6, 'day'],
  ['tanago', 'タナゴ', '鰟鮍', 2, 18, 'day'], ['bora', 'ボラ', '烏魚', 2, 28, 'any'], ['koi', 'コイ', '鯉魚', 2, 32, 'any'], ['ayu', 'アユ', '香魚', 3, 42, 'day'],
  ['suzuki', 'スズキ', '鱸魚', 3, 55, 'any'], ['shirauo', 'シラウオ', '白魚', 3, 48, 'night'], ['namazu', 'ナマズ', '鯰魚', 3, 50, 'night'], ['unagi', 'ウナギ', '鰻魚', 4, 85, 'night'],
  ['kame', 'カメ', '烏龜', 4, 70, 'day'], ['nishiki', 'ニシキゴイ', '錦鯉', 5, 160, 'any'], ['kinkoi', '黄金の鯉', '黃金鯉', 6, 480, 'any'],
  ['zori', '古いわらじ', '舊草鞋', 0, 1, 'any'], ['kan', '空き樽', '空酒桶', 0, 2, 'any'],
];
const W8 = [6, 30, 18, 10, 5, 1.5, .35];
export function rollFish(night) {
  const pool = FISH.filter(f => f[5] === 'any' || (f[5] === 'night') === night);
  const tot = pool.reduce((a, f) => a + W8[f[3]], 0); let r = Math.random() * tot;
  for (const f of pool) { r -= W8[f[3]]; if (r <= 0) return f; } return pool[0];
}

export function buildKashi(ctx) {
  const { M, boxG, std, willow, toro, B, W, col, TX, scene } = ctx;
  const spot = (x, z, label, info, say) => W.spots.push({ type: 'meisho', x, z, label, info, say });
  const wood = std('kWoodP', { map: TX.wood('plank', '#7a5a3a', [1, 4]), roughness: .85 }), dark = std('kDark', { color: '#4a3424', roughness: .85 });
  const stone = std('kStone', { map: TX.stone('kst').clone(), color: '#a8a296' }); stone.map.repeat.set(30, 1); stone.map.needsUpdate = true;
  const canvas = std('kAwn', { color: '#2f4f7a', roughness: .9, side: THREE.DoubleSide }), white = std('kWhite', { color: '#efe8d8', roughness: .9 });
  const tex = (s, o) => std('kt' + s, { map: TX.text(s, o), roughness: .8 });
  // 地面（河岸土路）
  { const gm = std('kGround', { map: TX.ground('dirt').clone(), color: '#e2d6b8' }); gm.map.repeat.set(6, 20); gm.map.needsUpdate = true;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(KASHI.x1 - KASHI.x0 + 4, KASHI.z1 - KASHI.z0 + 4), gm); g.rotation.x = -PI / 2; g.position.set((KASHI.x0 + KASHI.x1) / 2 - 1, .015, (KASHI.z0 + KASHI.z1) / 2); g.receiveShadow = true; scene.add(g); }
  // 石垣護岸（棧橋處留缺口）
  for (let z = KASHI.z1 - 2; z > KASHI.z0; z -= 4) { if (PIERS.some(p => Math.abs(z - p) < 2.5)) continue; B.bake(M(boxG(.9, 1.1, 4, 1), stone, 112.1, -.25, z)); }
  // 棧橋
  for (const pz of PIERS) {
    const g = new THREE.Group(); g.position.set(0, 0, pz);
    g.add(M(boxG(PIER_X - 111 + .6, .14, 2.4, 1), wood, (111 + PIER_X) / 2, .05, 0));
    for (const x of [112, 114.5, 117.2]) for (const s of [-1, 1]) g.add(M(new THREE.CylinderGeometry(.11, .11, 2.2, 6), dark, x, -.9, s * 1.05));
    g.add(M(boxG(.5, .35, .5, 1), std('kBucket', { color: '#8a6a44' }), 117.4, .27, .75)); // 魚籠
    B.bake(g);
    W.spots.push({ type: 'fish', x: PIER_X - .6, z: pz, label: '🎣 在棧橋釣魚' });
  }
  // 魚河岸：一排攤位（面向河）
  const SIGN = ['魚河岸', '鮮魚', '活〆', '問屋'];
  for (let i = 0; i < 4; i++) {
    const z0 = -58 - i * 22, g = new THREE.Group(); g.position.set(89, 0, z0 - 7);
    g.add(M(boxG(2.2, .9, 10, 1), wood, 0, .45, 0));                                      // 台子
    g.add(M(boxG(2.4, .06, 10.4, 1), std('kIce', { color: '#cfe0e6', roughness: .3 }), 0, .93, 0)); // 冰
    for (let k = 0; k < 14; k++) { const f = M(new THREE.SphereGeometry(.2, 8, 6), std('kFish' + (k % 3), { color: ['#9aa8b4', '#c8783a', '#6a7a88'][k % 3], metalness: .4, roughness: .35 }), -.5 + (k % 3) * .5, 1.02, -4.3 + k * .65); f.scale.set(2.2, .5, .7); f.rotation.y = .3 * (k % 2 ? 1 : -1); g.add(f); }
    for (const z of [-5, 5]) for (const x of [-1.2, 1.4]) g.add(M(new THREE.CylinderGeometry(.07, .07, 2.8, 6), dark, x, 1.4, z));
    const aw = M(new THREE.PlaneGeometry(3.4, 10.8), canvas, .2, 2.75, 0, 0, 0, -.32); aw.rotation.order = 'ZXY'; aw.rotation.x = -PI / 2; g.add(aw);
    g.add(M(new THREE.BoxGeometry(.08, 1.1, 2.6), tex(SIGN[i], { bg: '#efe2c0', fg: '#1c1410', w: 128, h: 384 }), 1.5, 2.3, 0, 0, PI / 2, 0));
    B.bake(g); for (let z = -4.5; z <= 4.5; z += 1.5) col(89, z0 - 7 + z, 1.3);
  }
  W.spots.push({ type: 'fishmkt', x: 93.6, z: -69, label: '🐟 魚河岸：賣魚／搬貨打工' });
  W.fishKeeper = { x: 90.3, z: -69, r: PI / 2 };
  // 柳樹、石燈籠
  for (const z of [-48, -71, -93, -115, -131]) willow(B, 109.6, z, 1, Math.random);
  for (const z of [-44, -76, -98, -128]) W.lanterns.push(toro(B, 96, z, PI / 2));
  spot(108, -50, '📸 名所：隅田川河岸', '隅田川：流經江戶東側的大河。河岸邊是熱鬧的魚市「魚河岸」，夏天晚上有屋形船載著客人賞燈、看煙火。棧橋上可以釣魚喔！', '河風好舒服～');
  // 屋形船（在 game 迴圈裡移動）
  W.boats = [];
  const roofM = std('kRoof', { color: '#3a3430', roughness: .8 }), hullM = std('kHull', { color: '#6a4628', roughness: .8 }), shoji = std('kShoji', { color: '#f4ead2', emissive: '#ffb860', emissiveIntensity: .25, roughness: .9 });
  const red = std('kLan', { color: '#d83a2a', emissive: '#ff6a30', emissiveIntensity: .6 });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    b.add(M(boxG(2.6, .6, 9, 1), hullM, 0, -.7, 0)); b.add(M(boxG(2.2, 1.2, 6, 1), shoji, 0, .2, 0)); b.add(M(boxG(2.8, .14, 7, 1), roofM, 0, .9, 0));
    for (let k = -2; k <= 2; k++) b.add(M(new THREE.SphereGeometry(.17, 8, 6), red, 1.45, .55, k * 1.3));
    b.position.set(i % 2 ? 130 : 120.5, 0, -260 + i * 190); b.userData = { v: (i % 2 ? -1 : 1) * (1.6 + i * .3) }; if (b.userData.v < 0) b.rotation.y = PI;
    scene.add(b); W.boats.push(b);
  }
}
export function updBoats(W, dt) {
  for (const b of W.boats || []) { b.position.z += b.userData.v * dt; if (b.position.z > 320) b.position.z = -320; if (b.position.z < -320) b.position.z = 320; b.position.y = Math.sin(performance.now() / 900 + b.position.z) * .05; }
}
