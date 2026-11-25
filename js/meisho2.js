// 江戶町 名所南區（神社南門出去）：江戶城天守、不忍池弁天堂、歌舞伎中村座、回向院相撲土俵
// 靜態物件全部 bake 進合併網格；走近按 E 有特寫與介紹
import * as THREE from 'three';
import { hipRoof } from './temple.js?v=202611260116';
const PI = Math.PI;

export const SHINOBAZU = { x: -122, z: 102, rx: 15, rz: 11, isl: 4.6 }; // 不忍池（中島可走、北側石橋）
export const SOUTH = { x0: -205, x1: -100, z0: 44, z1: 140 }; // 名所南區可走範圍
export const CASTLE = { x: -252, z: 92 }; // 江戶城本丸中心

export function walkSouth(x, z) {
  if (x >= -127.2 && x <= -122.8 && z >= 23 && z <= 46) return true; // 神社南參道
  if (x >= -226.8 && x <= -204 && Math.abs(z - CASTLE.z) < 2.2) return true; // 大手橋
  if (x >= SOUTH.x0 && x <= SOUTH.x1 && z >= SOUTH.z0 && z <= SOUTH.z1) {
    const P = SHINOBAZU, dx = x - P.x, dz = z - P.z;
    if ((dx / (P.rx + 1)) ** 2 + (dz / (P.rz + 1)) ** 2 > 1) return true;
    if (Math.hypot(dx, dz) < P.isl - .3) return true; // 中島
    return Math.abs(dx) < 1.2 && dz < 0; // 石橋
  }
  return false;
}

export function buildMeisho2(ctx) {
  const { M, boxG, std, pine, sakura, toro, B, W, col, box, TX, scene, rand } = ctx;
  const spot = (x, z, label, info, say) => W.spots.push({ type: 'meisho', x, z, label, info, say });
  const vermil = std('vermil', { color: '#c8382a', roughness: .6 }), black = std('mBlack', { color: '#1c1614', roughness: .5 });
  const shingle = std('mShingle', { color: '#3a3430', roughness: .8, side: THREE.DoubleSide }), stone = std('mStone', { color: '#9a958a', roughness: .95 });
  const wood = std('mWood', { color: '#6a4a30', roughness: .8 }), white = std('mWhite', { color: '#f2ece0', roughness: .9 });
  const gold = std('kinGold', { color: '#e8c050', metalness: .3, roughness: .35, emissive: '#6a4a08', emissiveIntensity: .45 });
  const ishi = std('ishigakiS', { map: TX.stone('ishi').clone(), color: '#b8b2a4' }); ishi.map.repeat.set(6, 2); ishi.map.needsUpdate = true;
  const water = std('kWater', { color: '#3f7088', metalness: .35, roughness: .12 });
  const tex = (s, o) => std('t' + s + (o.bg || ''), { map: TX.text(s, o), roughness: .8 });

  // 地面（砂利）＋參道
  {
    const gv = std('sGrass', { map: TX.ground('g2').clone(), color: '#b8c890' }); gv.map.repeat.set(26, 24); gv.map.needsUpdate = true; // 名所南區像公園：草地
    const g = new THREE.Mesh(new THREE.PlaneGeometry(112, 104), gv); g.rotation.x = -PI / 2; g.position.set(-152.5, .02, 92); g.receiveShadow = true; scene.add(g);
    const sp = std('spathS', { map: TX.stone().clone() }); sp.map.repeat.set(1.5, 10); sp.map.needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 24), sp); p.rotation.x = -PI / 2; p.position.set(-125, .03, 34); p.receiveShadow = true; scene.add(p);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.4), sp); p2.rotation.x = -PI / 2; p2.position.set(-217, .03, CASTLE.z); scene.add(p2);
    // 南門口的道標
    const s = new THREE.Group(); s.position.set(-121.5, 0, 26);
    s.add(M(boxG(.22, 2.6, .22), wood, 0, 1.3, 0)); s.add(M(new THREE.BoxGeometry(.7, 1.9, .08), tex('名所南區', { w: 128, h: 384, bg: '#efe4c8', fg: '#2a1a10', border: '#5a3a20' }), 0, 1.75, .13, 0, -PI / 2, 0));
    B.bake(s); col(-121.5, 26, .3);
    // 參道兩旁櫻樹
    for (const z of [30, 38]) for (const x of [-131, -119]) { sakura(B, x, z, 1, rand); col(x, z, .45); }
  }

  // ---- 1. 江戶城天守（寬永度天守）：區域最西邊，過大手橋到大手門 ----
  {
    const C = CASTLE, g = new THREE.Group(); g.position.set(C.x, 0, C.z);
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), water); wm.rotation.x = -PI / 2; wm.position.set(C.x, .04, C.z); scene.add(wm); // 內堀
    const frustum = (w0, w1, h, y, mat) => { const m = M(new THREE.CylinderGeometry(w1 / Math.SQRT2, w0 / Math.SQRT2, h, 4, 1), mat, 0, y + h / 2, 0, 0, PI / 4, 0); g.add(m); return m; };
    frustum(48, 44, 6, 0, ishi); // 本丸石垣
    g.add(M(boxG(43.6, .12, 43.6), std('honmaru', { color: '#9a9478' }), 0, 6.06, 0));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // 隅櫓（二重）
      const y = new THREE.Group(); y.position.set(sx * 19.5, 6, sz * 19.5);
      y.add(M(boxG(5, 2.6, 5), white, 0, 1.3, 0)); const r1 = new THREE.Mesh(hipRoof(6.4, 6.4, .8, .45), shingle); r1.position.y = 2.6; y.add(r1);
      y.add(M(boxG(3.6, 2, 3.6), white, 0, 3.6, 0)); const r2 = new THREE.Mesh(hipRoof(5, 5, 1.6, .5), shingle); r2.position.y = 4.6; y.add(r2); g.add(y);
    }
    for (const s of [-1, 1]) { g.add(M(boxG(38, 1.4, .5), white, 0, 6.7, s * 21.3)); g.add(M(boxG(.5, 1.4, 38), white, s * 21.3, 6.7, 0)); } // 土塀
    // 天守台＋五重天守
    frustum(17, 15, 5, 6, ishi);
    let y = 11, w = 13.5;
    for (let i = 0; i < 5; i++) {
      const h = 3.3; g.add(M(boxG(w, h, w * .88), white, 0, y + h / 2, 0));
      for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) g.add(M(boxG(.9, .7, .06), black, k * w * .28, y + h * .55, s * (w * .44 + .02))); // 窓
      const rf = new THREE.Mesh(hipRoof(w + 2.4, w * .88 + 2.4, i === 4 ? 2.6 : 1, .7), shingle); rf.position.y = y + h; g.add(rf);
      if (i < 4 && i % 2 === 1) for (const s of [-1, 1]) g.add(M(new THREE.ConeGeometry(1.2, 1.1, 3), shingle, 0, y + h + .5, s * (w * .44 + 1), 0, 0, 0)); // 千鳥破風
      y += h + .9; w *= .82;
    }
    for (const s of [-1, 1]) { const sh = M(new THREE.ConeGeometry(.35, 1.4, 6), gold, s * 2.4, y + 1.8, 0, 0, 0, s * .5); g.add(sh); g.add(M(new THREE.SphereGeometry(.32, 8, 6), gold, s * 2.2, y + 1.3, 0)); } // 金鯱
    // 大手門（高麗門）：本丸石垣東面
    const gt = new THREE.Group(); gt.position.set(24.2, 0, 0);
    for (const sz of [-1, 1]) gt.add(M(boxG(.6, 5.2, .6), wood, .2, 2.6, sz * 2.4));
    gt.add(M(boxG(.3, 4.2, 4.2), std('gateDoor', { color: '#3a2a1c' }), 0, 2.1, 0)); for (let k = -1; k <= 1; k++) gt.add(M(boxG(.36, .14, 4.2), black, 0, 1 + k * 1.3 + 1.3, 0));
    gt.add(M(boxG(1.6, .4, 6.4), wood, .2, 5.4, 0)); const gr = new THREE.Mesh(hipRoof(6.8, 2.6, .9, .4), shingle); gr.rotation.y = PI / 2; gr.position.set(.2, 5.6, 0); gt.add(gr);
    g.add(gt);
    B.bake(g);
    // 大手橋
    const br = new THREE.Group(); br.position.set(-218, 0, C.z);
    br.add(M(boxG(22, .3, 4.4), std('bridgeW', { color: '#7a5a3a' }), 0, 0, 0));
    for (const s of [-1, 1]) { br.add(M(boxG(22, .14, .16), wood, 0, 1.05, s * 2.1)); for (let x = -10; x <= 10; x += 2.5) br.add(M(boxG(.2, 1, .2), wood, x, .6, s * 2.1)); }
    for (const s of [-1, 1]) br.add(M(new THREE.SphereGeometry(.22, 8, 6), std('giboshi', { color: '#6a7a4a', metalness: .6, roughness: .4 }), -11, 1.2, s * 2.1));
    B.bake(br);
    for (const s of [-1, 1]) { W.lanterns.push(toro(B, -202, C.z + s * 4.2, PI / 2)); col(-202, C.z + s * 4.2, .4); }
    for (const [x, z] of [[-205, 70], [-205, 114], [-200, 58], [-200, 128]]) { pine(B, x, z, 1.4, rand); col(x, z, .5); }
    spot(-225.6, C.z, '📸 名所：江戶城', '江戶城：德川將軍的居城，也是江戶的中心。這座五重天守是第三代將軍家光蓋的「寬永度天守」，高約 58 公尺，1657 年明曆大火燒毀後就再也沒有重建。', '這就是將軍大人住的地方…');
    spot(-207, C.z, '🌉 大手橋', '大手門是江戶城的正門，各藩大名登城時都從這裡進去，門口有重兵把守。', '大名都從這座橋登城呢');
  }

  // ---- 2. 不忍池・弁天堂（上野）：池中島上的八角堂 ----
  {
    const P = SHINOBAZU;
    const wm = new THREE.Mesh(new THREE.CircleGeometry(1, 40), water); wm.rotation.x = -PI / 2; wm.scale.set(P.rx, P.rz, 1); wm.position.set(P.x, .05, P.z); scene.add(wm);
    const rim = new THREE.Mesh(new THREE.RingGeometry(.97, 1.05, 48), stone); rim.rotation.x = -PI / 2; rim.scale.set(P.rx, P.rz, 1); rim.position.set(P.x, .06, P.z); scene.add(rim);
    const g = new THREE.Group(); g.position.set(P.x, 0, P.z);
    g.add(M(new THREE.CylinderGeometry(P.isl, P.isl + .3, .5, 24), stone, 0, .2, 0)); // 中島
    g.add(M(new THREE.CylinderGeometry(2.4, 2.4, .4, 8), stone, 0, .65, 0));
    g.add(M(new THREE.CylinderGeometry(2, 2, 2.4, 8), vermil, 0, 2, 0, 0, PI / 8, 0)); // 八角堂
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; g.add(M(boxG(.2, 2.4, .2), black, Math.sin(a) * 2.05, 2, Math.cos(a) * 2.05)); }
    g.add(M(new THREE.ConeGeometry(3.2, 1.8, 8), shingle, 0, 4.1, 0, 0, PI / 8, 0)); g.add(M(new THREE.ConeGeometry(.3, .8, 8), gold, 0, 5.3, 0)); g.add(M(new THREE.SphereGeometry(.25, 8, 6), gold, 0, 5.75, 0));
    g.add(M(boxG(1.4, 1.8, .06), std('bentenDoor', { color: '#e8c050', emissive: '#6a4a08', emissiveIntensity: .3 }), 0, 1.9, -2.02));
    // 石橋（北側）
    g.add(M(boxG(2.4, .35, P.rz - P.isl + 1.6), stone, 0, .22, -(P.isl + P.rz) / 2 - .2));
    for (const s of [-1, 1]) g.add(M(boxG(.14, .5, P.rz - P.isl + 1.6), stone, s * 1.15, .55, -(P.isl + P.rz) / 2 - .2));
    // 蓮
    const pad = new THREE.CylinderGeometry(.45, .45, .04, 9), lm = std('lotus', { color: '#3f8a3a' }), fl = std('lotusF', { color: '#f0b8c8' });
    for (let i = 0; i < 46; i++) { const a = rand() * PI * 2, r = .45 + rand() * .45; const x = Math.cos(a) * r * P.rx, z = Math.sin(a) * r * P.rz; if (Math.hypot(x, z) < P.isl + 1 || (Math.abs(x) < 2 && z < 0)) continue; const m = M(pad, lm, x, .09, z); m.scale.setScalar(.7 + rand() * .7); g.add(m); if (rand() < .25) g.add(M(new THREE.SphereGeometry(.18, 6, 5), fl, x + .1, .26, z)); }
    B.bake(g); col(P.x, P.z, 2.5);
    for (const [x, z] of [[-140, 92], [-104, 94], [-138, 114], [-106, 112], [-122, 120]]) { (rand() < .5 ? sakura : pine)(B, x, z, 1.1, rand); col(x, z, .45); }
    toro(B, -124.6, 87, PI); toro(B, -119.4, 87, PI); W.lanterns.push(new THREE.Vector3(-124.6, 1.85, 87), new THREE.Vector3(-119.4, 1.85, 87)); col(-124.6, 87, .4); col(-119.4, 87, .4);
    spot(P.x, P.z - 3.6, '📸 名所：不忍池弁天堂', '不忍池弁天堂：上野不忍池中島上供奉弁財天的八角堂，掌管音樂、口才與財運。夏天池面開滿蓮花，是江戶人賞蓮的名所。', '弁天様，請保佑我變有錢！');
    spot(P.x, 86.2, '🌸 不忍池', '不忍池：仿照琵琶湖建造，池中島仿竹生島。夏天清晨蓮花「啵」一聲綻放，江戶人特地起早來聽。', '好多蓮葉～');
  }

  // ---- 3. 歌舞伎・中村座（猿若町）：屋頂上的櫓與成排的幟 ----
  {
    const g = new THREE.Group(); g.position.set(-180, 0, 66); g.rotation.y = PI / 2; // 正面朝東
    g.add(M(boxG(18, 7, 13), std('kabukiW', { color: '#e8dcc0' }), 0, 3.5, 0));
    g.add(M(boxG(18.2, 1.4, 13.2), black, 0, 4.9, 0));
    const rf = new THREE.Mesh(hipRoof(20, 15, 2.2, .5), shingle); rf.position.y = 7; g.add(rf);
    // 正面：大看板、入口、提燈
    g.add(M(new THREE.BoxGeometry(10, 2.4, .2), tex('中村座', { w: 768, h: 192, bg: '#1c1614', fg: '#f0d070', vertical: false }), 0, 5.6, 6.65));
    g.add(M(boxG(4, 2.6, .1), std('noren', { color: '#2a3a6a' }), 0, 1.6, 6.56));
    for (let k = 0; k < 6; k++) g.add(M(new THREE.BoxGeometry(2.2, 1.4, .1), tex(['助六', '勧進帳', '暫', '忠臣蔵', '鳴神', '道成寺'][k], { w: 256, h: 160, bg: ['#f0e0b0', '#e8c8a0'][k % 2], fg: '#7a1a14', vertical: false }), -7 + k * 2.8, 3.2, 6.58));
    for (let k = 0; k < 7; k++) { const l = M(new THREE.CylinderGeometry(.32, .32, .7, 10), std('kabukiLan', { color: '#f6e8c8', emissive: '#ffb050', emissiveIntensity: .2 }), -7.5 + k * 2.5, 4.05, 6.9); g.add(l); }
    // 櫓（芝居の櫓：幕府公認の印）
    const yg = new THREE.Group(); yg.position.set(0, 7.6, 5);
    yg.add(M(new THREE.BoxGeometry(4, 2.2, 2.6), std('yaguraMaku', { map: TX.text('中', { w: 256, h: 256, bg: '#1c1614', fg: '#ffffff', circle: '#1c1614', vertical: false }) }), 0, 1.1, 0));
    yg.add(M(boxG(4.4, .2, 3), black, 0, 2.3, 0)); for (let k = 0; k < 5; k++) yg.add(M(boxG(.12, 1.4, .12), std('bonten', { color: '#f4f0e6' }), -1.6 + k * .8, 3.1, 0));
    g.add(yg);
    B.bake(g); box(-186.6, 57, -173.4, 75);
    // 幟（のぼり）兩排
    const cols = ['#c8382a', '#2a4a8a', '#e8c050', '#3a6a3a', '#7a2a6a'], names = ['市川團十郎', '尾上菊五郎', '中村勘三郎', '松本幸四郎', '坂東三津五郎'];
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      const z = 66 + s * (10 + k * 2.4), x = -171.5, n = new THREE.Group(); n.position.set(x, 0, z);
      n.add(M(new THREE.CylinderGeometry(.06, .07, 5.2, 6), wood, 0, 2.6, 0)); n.add(M(boxG(.04, .04, .9), wood, 0, 5, .45));
      n.add(M(new THREE.BoxGeometry(.03, 3.6, .8), tex(names[(k + (s > 0 ? 2 : 0)) % 5], { w: 128, h: 512, bg: cols[(k + (s > 0 ? 1 : 0)) % 5], fg: '#ffffff' }), 0, 3.15, .45, 0, PI / 2, 0));
      B.bake(n); col(x, z, .2);
    }
    for (const z of [61, 71]) { toro(B, -169.5, z, -PI / 2); W.lanterns.push(new THREE.Vector3(-169.5, 1.85, z)); col(-169.5, z, .4); }
    spot(-171, 66, '📸 名所：歌舞伎中村座', '中村座：江戶三座之首，1624 年由猿若勘三郎創立。屋頂的「櫓」是官方許可演出的證明，門口掛滿名角的幟，觀眾一看就是一整天。', '今天演什麼戲呢？好想看團十郎！');
  }

  // ---- 4. 回向院・勸進相撲（兩國）：吊屋根下的土俵 ----
  {
    const g = new THREE.Group(); g.position.set(-170, 0, 114);
    g.add(M(boxG(8, .7, 8), std('dohyo', { color: '#b08a5a', roughness: 1 }), 0, .35, 0));
    const ring = M(new THREE.TorusGeometry(2.3, .13, 6, 40), std('tawara', { color: '#c8b070' }), 0, .72, 0, PI / 2, 0, 0); g.add(ring);
    for (const s of [-1, 1]) g.add(M(boxG(.6, .05, .08), white, s * .5, .72, 0)); // 仕切り線
    const pc = ['#2a5a9a', '#c8382a', '#f0ece0', '#1c1614']; // 四本柱：青龍・朱雀・白虎・玄武
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => g.add(M(new THREE.CylinderGeometry(.18, .18, 5.2, 8), std('hashira' + i, { color: pc[i] }), sx * 3.6, 2.6, sz * 3.6)));
    const rf = new THREE.Mesh(hipRoof(9, 9, 1.8, .4), shingle); rf.position.y = 5.2; g.add(rf);
    g.add(M(boxG(8.4, .5, 8.4), std('mizuhiki', { color: '#5a2a6a' }), 0, 4.95, 0));
    for (const s of [-1, 1]) { g.add(M(boxG(14, .5, 2.6), wood, 0, .25, s * 7.4)); g.add(M(boxG(2.6, .5, 9), wood, s * 7.4, .25, 0)); } // 桟敷
    g.add(M(new THREE.CylinderGeometry(.35, .3, .6, 10), std('chikaraMizu', { color: '#6a4a30' }), 3.2, 1, -3.2));
    B.bake(g); box(-174.2, 109.8, -165.8, 118.2);
    for (const s of [-1, 1]) W.seats.push({ x: -170 + s * 2, y: .5, z: 114 - 7.4, r: 0, kind: 'view', dish: new THREE.Vector3(-170, .8, 114) }, { x: -170 + s * 2, y: .5, z: 114 + 7.4, r: PI, kind: 'view', dish: new THREE.Vector3(-170, .8, 114) });
    // 太鼓櫓
    const t = new THREE.Group(); t.position.set(-186, 0, 104);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.add(M(boxG(.22, 8, .22), wood, sx * 1, 4, sz * 1));
    t.add(M(boxG(2.4, .2, 2.4), wood, 0, 7.6, 0)); t.add(M(new THREE.CylinderGeometry(.6, .6, .8, 12), std('taikoB', { color: '#7a3a20' }), 0, 8.2, 0, PI / 2, 0, 0));
    const tr = new THREE.Mesh(hipRoof(3, 3, 1, .3), shingle); tr.position.y = 8.9; t.add(tr);
    B.bake(t); col(-186, 104, 1.4);
    spot(-170, 104.8, '📸 名所：回向院相撲', '勸進相撲：江戶時代在兩國回向院境內舉行，一年兩場、每場晴天十日。四本柱的顏色代表青龍、朱雀、白虎、玄武四方神。', '加油！推出去！');
  }

  // 屋台（廣場北側）
  [['蕎麦', '#2a3a6a'], ['天麩羅', '#7a2a1a'], ['団子', '#3a5a3a']].forEach(([n, c], i) => {
    const x = -168 + i * 9, z = 50, g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(M(boxG(3, 1, 1.6), wood, 0, .5, 0)); g.add(M(boxG(3.2, .1, 1.8), std('yataiTop', { color: '#8a6a48' }), 0, 1.05, 0));
    for (const sx of [-1, 1]) g.add(M(boxG(.12, 2.4, .12), wood, sx * 1.45, 1.6, -.7));
    const rf = new THREE.Mesh(hipRoof(3.8, 2.4, .5, .2), shingle); rf.position.set(0, 2.8, -.3); g.add(rf);
    for (let k = 0; k < 3; k++) g.add(M(new THREE.BoxGeometry(.9, .8, .03), tex(n, { w: 128, h: 128, bg: c, fg: '#f4ecd8', vertical: false }), -1 + k, 2.35, .2));
    g.add(M(new THREE.CylinderGeometry(.22, .22, .5, 10), std('yataiLan', { color: '#f6e8c8', emissive: '#ffb050', emissiveIntensity: .2 }), 1.6, 2.2, .3));
    g.add(M(boxG(1.8, .4, .6), wood, 0, .2, 1.4)); // 長椅
    B.bake(g); box(x - 1.6, z - 1, x + 1.6, z + .9); W.seats.push({ x: x - .45, y: .45, z: z + 1.4, r: PI, kind: 'view', dish: new THREE.Vector3(x - .45, 1.1, z + .5) }, { x: x + .45, y: .45, z: z + 1.4, r: PI, kind: 'view', dish: new THREE.Vector3(x + .45, 1.1, z + .5) });
  });

  // 區內點綴
  for (const [x, z] of [[-198, 50], [-150, 48], [-112, 50], [-150, 136], [-196, 136], [-140, 76]]) { (rand() < .6 ? pine : sakura)(B, x, z, 1 + rand() * .3, rand); col(x, z, .45); }
  for (const [x, z, r] of [[-150, 60, 0], [-150, 122, PI]]) { toro(B, x, z, r); W.lanterns.push(new THREE.Vector3(x, 1.85, z)); col(x, z, .4); }
}
