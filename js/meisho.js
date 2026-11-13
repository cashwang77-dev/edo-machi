// 江戶町 名所：雷門、海上大鳥居（嚴島）、千本鳥居（伏見稻荷）、金閣寺（鹿苑寺）、五重塔
// 靜態物件全部 bake 進合併網格（不增加繪製次數）；走近按 E 有特寫與介紹
import * as THREE from 'three';
import { hipRoof } from './temple.js';
const PI = Math.PI;

export const KINKAKU_POND = { x: 180, z: 78, rx: 21, rz: 15 }; // 金閣寺鏡湖池（不可走入）

function lanternTex() { // 大字「雷門」前後各一組（燈籠繞一圈）
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#c8282e'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, i * 86 + 40, 1024, 3); }
  x.fillStyle = '#16100e'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 230px "Yu Mincho","MS Mincho",serif';
  for (const cx of [256, 768]) x.fillText('雷門', cx, 270);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildMeisho(ctx) {
  const { M, boxG, std, pine, toro, B, W, col, box, TX, scene, rand } = ctx;
  const vermil = std('vermil', { color: '#c8382a', roughness: .6 }), black = std('mBlack', { color: '#1c1614', roughness: .5 });
  const gold = std('kinGold', { color: '#e8c050', metalness: .3, roughness: .35, emissive: '#6a4a08', emissiveIntensity: .45 }), shingle = std('mShingle', { color: '#3a3430', roughness: .8, side: THREE.DoubleSide });
  const stone = std('mStone', { color: '#9a958a', roughness: .95 }), wood = std('mWood', { color: '#6a4a30', roughness: .8 }), white = std('mWhite', { color: '#f2ece0', roughness: .9 });
  const spot = (x, z, label, info, say) => W.spots.push({ type: 'meisho', x, z, label, info, say });
  const torii = (g, w, h, mat = vermil, r = .16) => { // 明神鳥居
    for (const sx of [-1, 1]) g.add(M(new THREE.CylinderGeometry(r * .9, r, h, 12), mat, sx * w / 2, h / 2, 0));
    g.add(M(boxG(w + 1.1, r * 1.3, r * 1.6), black, 0, h + r * .7, 0)); g.add(M(boxG(w + .7, r * 1.1, r * 1.4), mat, 0, h - r * .4, 0));
    g.add(M(boxG(w + .3, r * .9, r * .9), mat, 0, h * .78, 0)); g.add(M(boxG(r * .9, h * .2, r * .8), mat, 0, h * .88, 0));
  };

  // ---- 1. 雷門（淺草寺）：過日本橋往東，穿過大紅燈籠 ----
  {
    const g = new THREE.Group(); g.position.set(152, 0, 0); g.rotation.y = PI / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(M(new THREE.CylinderGeometry(.28, .3, 5.4, 12), vermil, sx * 3.1, 2.7, sz * 1.4));
    for (const sx of [-1, 1]) { g.add(M(boxG(2.2, 5.2, 2.6), vermil, sx * 4.4, 2.6, 0)); g.add(M(boxG(1.8, 3.6, .1), std('lattice', { color: '#2a1d14' }), sx * 4.4, 2.4, 1.32)); } // 左右兩間（風神・雷神）
    g.add(M(boxG(11.2, .5, 3.6), vermil, 0, 5.6, 0));
    const rf = new THREE.Mesh(hipRoof(13.5, 6.2, 2.6, .9), shingle); rf.position.y = 5.85; g.add(rf);
    // 大提燈「雷門」
    const pts = []; for (let i = 0; i <= 12; i++) { const y = i / 12; pts.push(new THREE.Vector2(.55 + .75 * Math.sin(y * PI), y * 2.6)); }
    const lan = M(new THREE.LatheGeometry(pts, 24), std('kmLantern', { map: lanternTex(), roughness: .7 }), 0, 2.55, 0, 0, PI / 2, 0); g.add(lan);
    g.add(M(new THREE.CylinderGeometry(.62, .62, .18, 16), black, 0, 2.5, 0)); g.add(M(new THREE.CylinderGeometry(.62, .62, .18, 16), black, 0, 5.2, 0));
    g.updateMatrixWorld(true); B.bake(g);
    for (const sz of [-1, 1]) { col(152 + 1.4, sz * 3.1, .45); col(152 - 1.4, sz * 3.1, .45); box(150.6, sz * 3.4, 153.4, sz * 6.2); }
    spot(156, 1.5, '📸 名所：雷門', '雷門：淺草寺的總門。正中央的大提燈高約 4 公尺，左右供奉風神與雷神，是江戶最熱鬧的地標。', '雷門好大的燈籠！');
  }

  // ---- 2. 海上大鳥居（嚴島神社）：立在河中央 ----
  {
    const g = new THREE.Group(); g.position.set(125, -.4, -24); g.rotation.y = PI / 2;
    torii(g, 6.5, 9, vermil, .38);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(M(new THREE.CylinderGeometry(.2, .22, 6, 10), vermil, sx * 3.25, 3, sz * 1.4)); // 兩部鳥居的稚兒柱
    for (const sx of [-1, 1]) g.add(M(boxG(.4, .3, 3.2), vermil, sx * 3.25, 5.6, 0));
    g.updateMatrixWorld(true); B.bake(g);
    spot(125, -2.4, '📸 眺望：海上大鳥居', '嚴島神社的大鳥居：立在海中、漲潮時像浮在水面上，是日本三景之一。從日本橋這裡看最漂亮。', '鳥居浮在水上耶！');
  }

  // ---- 3. 千本鳥居（伏見稻荷）：神社廣場往北的朱紅隧道 ----
  {
    for (let z = -25; z > -72; z -= 1.3) { const g = new THREE.Group(); g.position.set(-125, 0, z); torii(g, 2.6, 2.7, vermil, .1); g.updateMatrixWorld(true); B.bake(g); }
    const g = new THREE.Group(); g.position.set(-125, 0, -77); // 盡頭的稻荷小社＋狐狸
    g.add(M(boxG(3.4, .6, 3), stone, 0, .3, 0)); g.add(M(boxG(2.6, 2, 2.2), vermil, 0, 1.6, -.2)); g.add(M(boxG(2.2, 1.6, .05), white, 0, 1.6, .92));
    const rf = new THREE.Mesh(hipRoof(3.6, 3, 1.1, .4), shingle); rf.position.y = 2.6; g.add(rf);
    for (const sx of [-1, 1]) { g.add(M(boxG(.7, 1, .7), stone, sx * 2.4, .5, 1.6)); const f = M(new THREE.ConeGeometry(.22, .7, 8), white, sx * 2.4, 1.35, 1.6); g.add(f); g.add(M(new THREE.SphereGeometry(.18, 10, 8), white, sx * 2.4, 1.78, 1.68)); for (const ex of [-1, 1]) g.add(M(new THREE.ConeGeometry(.05, .16, 4), white, sx * 2.4 + ex * .09, 1.98, 1.65)); g.add(M(boxG(.22, .1, .05), vermil, sx * 2.4, 1.58, 1.82)); }
    g.updateMatrixWorld(true); B.bake(g); box(-127, -79, -123, -75.5);
    spot(-125, -27, '📸 名所：千本鳥居', '伏見稻荷大社的千本鳥居：一座座朱紅鳥居連成隧道，是信眾奉納的。走到底有守護稻荷神的狐狸。', '鳥居一直延伸下去…好美');
    spot(-125, -73.5, '🦊 稻荷社', '稻荷神掌管五穀豐收與生意興隆，狐狸是祂的使者，嘴裡常叼著稻穗或鑰匙。', '狐狸大人，請保佑生意興隆！');
  }

  // ---- 4. 金閣寺（鹿苑寺）：東岸往南的池泉庭園 ----
  {
    const P = KINKAKU_POND;
    const gv = std('kGravel', { map: TX.gravel().clone() }); gv.map.repeat.set(16, 16); gv.map.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(78, 76), gv); ground.rotation.x = -PI / 2; ground.position.set(178, .02, 75); ground.receiveShadow = true; scene.add(ground);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), std('kWater', { color: '#3f7088', metalness: .35, roughness: .12 })); water.rotation.x = -PI / 2; water.scale.set(P.rx, P.rz, 1); water.position.set(P.x, .05, P.z); scene.add(water);
    const rim = new THREE.Mesh(new THREE.RingGeometry(.97, 1.05, 48), stone); rim.rotation.x = -PI / 2; rim.scale.set(P.rx, P.rz, 1); rim.position.set(P.x, .06, P.z); scene.add(rim);
    // 金閣：一層白木寢殿造、二三層金箔
    const g = new THREE.Group(); g.position.set(182, 0, 70); g.rotation.y = PI;
    g.add(M(boxG(13, .5, 10), stone, 0, .25, 0)); // 小島
    g.add(M(boxG(10, 3, 7.5), white, 0, 2, 0)); for (let i = 0; i < 6; i++) g.add(M(boxG(.22, 3, .22), wood, -4.6 + i * 1.84, 2, 3.76));
    const r1 = new THREE.Mesh(hipRoof(11.8, 9.2, .9, .5), shingle); r1.position.y = 3.5; g.add(r1);
    g.add(M(boxG(8.6, 2.6, 6.6), gold, 0, 5.2, 0)); g.add(M(boxG(9.4, .2, 7.4), gold, 0, 3.95, 0)); // 二層（含回廊）
    const r2 = new THREE.Mesh(hipRoof(10.4, 8.4, .9, .6), shingle); r2.position.y = 6.5; g.add(r2);
    g.add(M(boxG(5.8, 2.4, 5.8), gold, 0, 8.4, 0));
    const r3 = new THREE.Mesh(hipRoof(7.6, 7.6, 2.4, .8), shingle); r3.position.y = 9.6; g.add(r3);
    g.add(M(new THREE.ConeGeometry(.3, 1.1, 6), gold, 0, 12.4, 0)); g.add(M(new THREE.SphereGeometry(.22, 10, 8), gold, 0, 12.1, 0)); // 鳳凰
    g.updateMatrixWorld(true); B.bake(g);
    for (const [x, z, s] of [[160, 60, 1.1], [200, 62, 1.2], [205, 90, 1], [158, 92, 1.15], [170, 98, 1], [195, 99, 1.1], [188, 58, .9]]) pine(B, x, z, s, rand);
    for (const [x, z] of [[171, 82], [190, 86], [176, 70]]) { const r = M(new THREE.DodecahedronGeometry(1.1, 0), stone, x, .3, z); r.scale.set(1.3, .6, 1); r.updateMatrixWorld(true); B.add(r.geometry, stone, r.matrixWorld); }
    toro(B, 168, 96, PI); toro(B, 192, 96, PI);
    spot(180, 96.5, '📸 名所：金閣寺', '金閣寺（鹿苑寺）：二、三層貼滿金箔的舍利殿，倒映在鏡湖池上，金光閃閃，是室町時代足利義滿所建。', '金閣寺閃閃發亮～');
  }

  // ---- 5. 五重塔：東光寺院內 ----
  {
    const g = new THREE.Group(); g.position.set(150, 0, -96);
    g.add(M(boxG(6.4, .8, 6.4), stone, 0, .4, 0));
    let y = .8, w = 4.6;
    for (let i = 0; i < 5; i++) {
      g.add(M(boxG(w, 2.1, w), vermil, 0, y + 1.05, 0)); g.add(M(boxG(w * .9, 1.4, .05), white, 0, y + 1.1, w / 2 + .01));
      const rf = new THREE.Mesh(hipRoof(w + 2.4, w + 2.4, .9, .7), shingle); rf.position.y = y + 2.1; g.add(rf);
      y += 2.6; w *= .88;
    }
    g.add(M(new THREE.CylinderGeometry(.09, .12, 4.2, 8), std('sorin', { color: '#6a5a3a', metalness: .6, roughness: .4 }), 0, y + 2.1, 0));
    for (let i = 0; i < 9; i++) g.add(M(new THREE.TorusGeometry(.32 - i * .015, .05, 5, 14), std('sorin', { color: '#6a5a3a', metalness: .6, roughness: .4 }), 0, y + .6 + i * .32, 0, PI / 2, 0, 0));
    g.updateMatrixWorld(true); B.bake(g); col(150, -96, 3.6);
    spot(154.5, -91, '📸 名所：五重塔', '五重塔：供奉佛舍利的佛塔，五層屋簷代表地水火風空。中央的心柱讓塔遇到地震也不容易倒。', '五重塔好高！');
  }
}
