// 東光寺：參考奈良東大寺格局的原創寺院（南大門、大佛殿、鐘樓、常香爐、八角燈籠、築地塀）
import * as THREE from 'three';
const PI = Math.PI;

// 寄棟屋根：屋角上翹（lift），回傳 BufferGeometry（雙面材質使用）
export function hipRoof(w, d, h, lift = .6) {
  const R = Math.max(.3, w - d);
  const c = (x, z) => [x, lift * (Math.abs(x) / (w / 2)) ** 3 * (Math.abs(z) / (d / 2)) ** 3 * 1 + lift * .15 * ((Math.abs(x) / (w / 2)) ** 4 + (Math.abs(z) / (d / 2)) ** 4), z];
  const P0 = c(-w / 2, d / 2), P1 = c(w / 2, d / 2), P2 = c(w / 2, -d / 2), P3 = c(-w / 2, -d / 2);
  const A = [-R / 2, h, 0], Bp = [R / 2, h, 0];
  const segs = 6, pos = [], uv = [];
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // 每個面用細分的四邊形（讓屋角曲線好看）：沿屋簷邊細分，向屋脊收
  const face = (e0, e1, r0, r1) => {
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const a0 = lerp(e0, e1, t0), a1 = lerp(e0, e1, t1); a0[1] = c(a0[0], a0[2])[1]; a1[1] = c(a1[0], a1[2])[1];
      const b0 = lerp(r0, r1, t0), b1 = lerp(r0, r1, t1);
      for (const q of [a0, a1, b1, a0, b1, b0]) { pos.push(...q); uv.push(q[0] / 3, (q[2] + q[1] * Math.sign(q[2] || 1)) / 3); }
    }
  };
  face(P0, P1, A, Bp); face(P2, P3, Bp, A); face(P3, P0, A, A); face(P1, P2, Bp, Bp);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  g.userData = { R, h };
  return g;
}

// ctx：{ M, boxG, C, std, glow, toro, pine, B, W, col, box, rand, TX, LANTERN_G, lanternMat }
export function buildTemple(ctx) {
  const { M, boxG, C, std, glow, toro, pine, B, W, col, box, rand, TX, lanternMat, LANTERN_G } = ctx;
  const CX = 178;
  const wd = C.woodD(), plaster = C.plaster('#efe9da'), stone = C.stone();
  const roofT = std('templeRoof', { map: TX.roof(), side: THREE.DoubleSide, roughness: .55, metalness: .1, color: '#9aa3ad' });
  const gold = std('gold', { color: '#d4a640', metalness: .85, roughness: .28 });
  const goldGlow = glow('goldGlow', { color: '#d4a640', metalness: .7, roughness: .35, emissive: '#ffbb55', emissiveIntensity: 0 }, .55);
  const bronze = std('bronzeT', { color: '#5d6a4a', metalness: .65, roughness: .45 });
  const redPost = std('templeCol', { color: '#5a3324', roughness: .8 });
  const hallGlow = glow('hallGlow', { color: '#3a2615', emissive: '#ffb050', emissiveIntensity: 0 }, .8);
  const earth = C.plaster('#d6c08f');

  // 地面：砂礫境內＋石板參道
  {
    const gv = std('tgravel', { map: TX.gravel().clone() }); gv.map.repeat.set(20, 18); gv.map.needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(76, 70), gv); p.rotation.x = -PI / 2; p.position.set(CX, .021, -72); p.receiveShadow = true; ctx.scene.add(p);
    const sp = std('tpath', { map: TX.stone().clone() }); sp.map.repeat.set(2, 16); sp.map.needsUpdate = true;
    const path = new THREE.Mesh(new THREE.PlaneGeometry(5, 40), sp); path.rotation.x = -PI / 2; path.position.set(CX, .032, -57); path.receiveShadow = true; ctx.scene.add(path);
    const ap = new THREE.Mesh(new THREE.PlaneGeometry(5, 12), sp); ap.rotation.x = -PI / 2; ap.position.set(CX, .03, -34); ctx.scene.add(ap);
  }
  // 斗栱（屋簷下一排小木塊）
  const brackets = (g, w, d, y, step = 1.6) => {
    for (let x = -w / 2 + .5; x <= w / 2 - .5; x += step) for (const s of [-1, 1]) g.add(M(boxG(.42, .38, .7, 1), wd, x, y, s * (d / 2 - .1)));
    for (let z = -d / 2 + 1.2; z <= d / 2 - 1.2; z += step) for (const s of [-1, 1]) g.add(M(boxG(.7, .38, .42, 1), wd, s * (w / 2 - .1), y, z));
  };
  const ridge = (g, R, y, shibi) => {
    g.add(M(boxG(R + .4, .55, .7, 1), C.black(), 0, y + .15, 0));
    if (shibi) for (const s of [-1, 1]) {
      const t = new THREE.Group(); t.position.set(s * (R / 2 + .1), y + .3, 0);
      const a = M(new THREE.ConeGeometry(.55, 2.6, 6), gold, 0, 1.1, 0, 0, 0, -s * .28); a.scale.set(.55, 1, 1.25); t.add(a);
      const b = M(new THREE.ConeGeometry(.35, 1.4, 6), gold, s * .45, 1.9, 0, 0, 0, s * .9); b.scale.set(.6, 1, 1.2); t.add(b);
      g.add(t);
    }
  };

  // ---------- 南大門 ----------
  {
    const g = new THREE.Group(); g.position.set(CX, 0, -47);
    g.add(M(boxG(24, .5, 11, 1), stone, 0, .25, 0));
    const xs = [-10, -6.2, -2.6, 2.6, 6.2, 10];
    for (const x of xs) for (const z of [-3.6, 3.6]) { g.add(M(new THREE.CylinderGeometry(.5, .56, 10.5, 14), redPost, x, 5.75, z)); col(CX + x, -47 + z, .65); }
    for (const x of [-10, -6.2, 6.2, 10]) g.add(M(new THREE.CylinderGeometry(.5, .56, 10.5, 14), redPost, x, 5.75, 0));
    for (const y of [3.6, 9.4]) { g.add(M(boxG(21, .45, .45, 1), wd, 0, y, 3.6)); g.add(M(boxG(21, .45, .45, 1), wd, 0, y, -3.6)); }
    // 兩側仁王像的格子屏
    for (const s of [-1, 1]) { g.add(M(boxG(6.6, 6, .2, 2), C.lat(), s * 6.3, 3.6, 2.4)); g.add(M(boxG(6.6, 6, .2, 2), C.lat(), s * 6.3, 3.6, -2.4)); box(CX + s * 2.7, -49.5, CX + s * 10.4, -44.5); }
    brackets(g, 22, 8.6, 10.4);
    const r1 = hipRoof(28, 14, 2.6, .9); g.add(M(r1, roofT, 0, 10.7, 0));
    g.add(M(boxG(18, 4, 7.4, 2), plaster, 0, 12.6, 0));
    for (let x = -8; x <= 8; x += 3.2) for (const s of [-1, 1]) g.add(M(boxG(.42, 4.2, .42), redPost, x, 12.6, s * 3.7));
    g.add(M(new THREE.BoxGeometry(6, 1.3, .1), std('tGateSign', { map: TX.text('東光寺', { w: 420, h: 140, bg: '#1e1a16', fg: '#e8c56a', vertical: false, grain: true, border: '#8a6a3a' }) }), 0, 12.9, 3.78));
    brackets(g, 18.4, 7.8, 14.9, 1.4);
    const r2 = hipRoof(26, 13, 5.2, 1.1); g.add(M(r2, roofT, 0, 15.1, 0)); ridge(g, r2.userData.R, 20.3, false);
    B.bake(g);
  }
  // ---------- 築地塀（土牆）----------
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = -ang;
    g.add(M(boxG(len, .5, 1.1, 1), stone, 0, .25, 0)); g.add(M(boxG(len, 2.6, .8, 2.5), earth, 0, 1.8, 0));
    for (let i = 0; i < 4; i++) g.add(M(boxG(len, .05, .82), std('wline', { color: '#f2ead8' }), 0, 1.2 + i * .4, 0));
    g.add(M(boxG(len + .2, .14, 1.6, 1.5), C.roof(), 0, 3.25, .4, .32, 0, 0)); g.add(M(boxG(len + .2, .14, 1.6, 1.5), C.roof(), 0, 3.25, -.4, -.32, 0, 0));
    g.add(M(boxG(len + .2, .22, .3), C.black(), 0, 3.48, 0));
    B.bake(g);
    const nx = Math.sin(ang), nz = Math.cos(ang); void nx; void nz;
    box(Math.min(x0, x1) - .5, Math.min(z0, z1) - .5, Math.max(x0, x1) + .5, Math.max(z0, z1) + .5);
  };
  wall(141, -47, 167.4, -47); wall(188.6, -47, 215, -47); wall(141, -47, 141, -106); wall(215, -47, 215, -106); wall(141, -106, 215, -106);

  // ---------- 參道：石燈籠、常香爐、八角燈籠 ----------
  for (const z of [-52, -58, -70]) for (const x of [CX - 4.2, CX + 4.2]) { W.lanterns.push(toro(B, x, z)); col(x, z, .5); }
  { // 常香爐
    const g = new THREE.Group(); g.position.set(CX, 0, -57);
    g.add(M(boxG(3, .5, 3, 1), stone, 0, .25, 0));
    for (let i = 0; i < 3; i++) { const a = i / 3 * 2 * PI; g.add(M(new THREE.CylinderGeometry(.12, .16, 1, 6), bronze, Math.cos(a) * .7, 1, Math.sin(a) * .7)); }
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(.5 + Math.sin(t * PI * .55) * .75, t * 1)); }
    g.add(M(new THREE.LatheGeometry(pts, 18), bronze, 0, 1.4, 0));
    g.add(M(new THREE.CylinderGeometry(1.3, 1.3, .1, 18), std('ash', { color: '#8d8a84' }), 0, 2.35, 0));
    for (const s of [-1, 1]) for (const t of [-1, 1]) g.add(M(new THREE.CylinderGeometry(.06, .06, 2.4, 6), bronze, s * 1.05, 3.5, t * 1.05));
    g.add(M(hipRoof(3.2, 3.2, 1, .25), std('bronzeRoof', { color: '#4e5a3e', metalness: .6, roughness: .5, side: THREE.DoubleSide }), 0, 4.7, 0));
    g.add(M(new THREE.SphereGeometry(.18, 10, 8), gold, 0, 5.8, 0));
    B.bake(g); col(CX, -57, 1.6); W.templeSmoke = new THREE.Vector3(CX, 2.6, -57);
  }
  { // 八角燈籠（青銅）
    const g = new THREE.Group(); g.position.set(CX, 0, -66);
    g.add(M(new THREE.CylinderGeometry(1.1, 1.3, .6, 8), stone, 0, .3, 0)); g.add(M(new THREE.CylinderGeometry(.75, .9, .5, 8), stone, 0, .85, 0));
    g.add(M(new THREE.CylinderGeometry(.22, .26, 2.6, 8), bronze, 0, 2.4, 0));
    g.add(M(new THREE.CylinderGeometry(.8, .7, .25, 8), bronze, 0, 3.8, 0));
    g.add(M(new THREE.CylinderGeometry(.62, .62, 1.3, 8, 1, true), C.lat(), 0, 4.55, 0));
    g.add(M(new THREE.CylinderGeometry(.5, .5, 1.1, 8), glow('hakkaku', { color: '#d9c9a0', emissive: '#ffb050', emissiveIntensity: 0 }, 1.8), 0, 4.55, 0));
    g.add(M(new THREE.ConeGeometry(1.15, .9, 8), bronze, 0, 5.65, 0)); g.add(M(new THREE.SphereGeometry(.22, 10, 8), gold, 0, 6.2, 0)); g.add(M(new THREE.ConeGeometry(.12, .5, 8), gold, 0, 6.55, 0));
    B.bake(g); col(CX, -66, .9); W.lanterns.push(new THREE.Vector3(CX, 4.5, -66));
  }

  // ---------- 大佛殿 ----------
  {
    const g = new THREE.Group(); g.position.set(CX, 0, -91);
    g.add(M(boxG(40, 1.2, 26, 1.5), stone, 0, .6, 0));
    for (let i = 0; i < 3; i++) g.add(M(boxG(9 - i * .6, .4, 2 - i * .55, 1), stone, 0, .2 + i * .4, 13.6 - i * .02 + (2 - (2 - i * .55)) / 2));
    const cxs = []; for (let x = -16; x <= 16; x += 4) cxs.push(x);
    for (const x of cxs) for (const z of [-9.5, 9.5]) g.add(M(new THREE.CylinderGeometry(.48, .52, 9.2, 14), redPost, x, 5.8, z));
    for (const z of [-5, 0, 5]) for (const s of [-1, 1]) g.add(M(new THREE.CylinderGeometry(.48, .52, 9.2, 14), redPost, s * 16, 5.8, z));
    // 前面：中央大門敞開，兩側白牆＋格子窗
    for (const s of [-1, 1]) {
      const wx = s * 10.5; g.add(M(boxG(11, 8.6, .3, 2), plaster, wx, 5.5, 9.1));
      for (let x = 6; x <= 14; x += 4) g.add(M(boxG(2.6, 2.2, .1, 1), hallGlow, s * x, 7.6, 9.3));
      g.add(M(boxG(2.6, 3, .2, 1.5), C.lat(), s * 6.8, 3.3, 9.3));
    }
    g.add(M(boxG(10, 2.2, .3, 2), plaster, 0, 8.7, 9.1));
    for (const s of [-1, 1]) g.add(M(boxG(2.4, 7.5, .18, 2), wd, s * 4.6, 4.95, 10.4, 0, s * .9, 0)); // 敞開的門扇
    for (const y of [1.6, 7.5, 10]) g.add(M(boxG(33, .42, .42, 1), wd, 0, y, 9.5));
    g.add(M(boxG(33, 9, .3, 2), plaster, 0, 5.8, -9.1)); for (const s of [-1, 1]) g.add(M(boxG(.3, 9, 18, 2), plaster, s * 16, 5.8, 0));
    g.add(M(boxG(31, .2, 18, 4), wd, 0, 1.25, 0));
    // 內部：金色坐佛＋光背
    {
      const bud = new THREE.Group(); bud.scale.setScalar(.72); g.add(bud);
      const bz = -5;
      bud.add(M(new THREE.CylinderGeometry(3.4, 3.8, 1.4, 16), std('lotus', { color: '#7a5a2a', metalness: .5, roughness: .5 }), 0, 1.9, bz));
      for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * PI; const p = M(new THREE.SphereGeometry(.8, 8, 6), gold, Math.cos(a) * 3.4, 2.7, bz + Math.sin(a) * 3.4); p.scale.set(1, .5, .6); p.rotation.y = -a; bud.add(p); }
      const pts = [[0, 0], [3.2, 0], [3.4, .8], [2.6, 2], [2.4, 3.2], [2.7, 4.6], [2.2, 5.6], [.9, 6.1], [0, 6.2]].map(p => new THREE.Vector2(p[0], p[1]));
      const body = M(new THREE.LatheGeometry(pts, 20), goldGlow, 0, 2.6, bz); body.scale.set(1, 1, .75); bud.add(body);
      bud.add(M(new THREE.SphereGeometry(1.35, 18, 14), goldGlow, 0, 9.9, bz + .1));
      for (let i = 0; i < 40; i++) { const t = Math.acos(1 - Math.random() * .9), p = Math.random() * 2 * PI; bud.add(M(new THREE.SphereGeometry(.16, 6, 5), C.black(), Math.sin(t) * Math.cos(p) * 1.36, 9.9 + Math.cos(t) * 1.36, bz + .1 + Math.sin(t) * Math.sin(p) * 1.36 * .9)); }
      bud.add(M(new THREE.SphereGeometry(.6, 12, 10), C.black(), 0, 11.15, bz));
      const fz = bz + 1.38, dk = std('budFace', { color: '#5a3a14', metalness: .5, roughness: .4 });
      for (const sx of [-1, 1]) { bud.add(M(new THREE.BoxGeometry(.5, .07, .06), dk, sx * .45, 9.95, fz, 0, 0, sx * -.12)); bud.add(M(new THREE.BoxGeometry(.4, .05, .05), dk, sx * .45, 10.25, fz - .04, 0, 0, sx * .18));
        const ear = M(new THREE.CapsuleGeometry(.2, 1.1, 4, 8), goldGlow, sx * 1.35, 9.55, bz + .1); bud.add(ear); }
      bud.add(M(new THREE.SphereGeometry(.09, 8, 6), std('urna', { color: '#f6e7b0', metalness: .3, roughness: .3 }), 0, 10.45, fz));
      bud.add(M(new THREE.BoxGeometry(.42, .06, .05), dk, 0, 9.35, fz - .05));
      bud.add(M(new THREE.SphereGeometry(.22, 8, 6), goldGlow, 0, 9.75, fz + .05));
      for (const s of [-1, 1]) bud.add(M(new THREE.CapsuleGeometry(.5, 2.4, 4, 8), goldGlow, s * 2.4, 6.4, bz + .9, .9, 0, s * .25));
      const halo = M(new THREE.CircleGeometry(5.6, 40), goldGlow, 0, 8.6, bz - 1.4); bud.add(halo);
      bud.add(M(new THREE.TorusGeometry(5.6, .18, 6, 48), gold, 0, 8.6, bz - 1.35));
      bud.add(M(new THREE.TorusGeometry(2.1, .14, 6, 32), gold, 0, 9.9, bz - 1.3));
    }
    brackets(g, 33, 19, 10.6);
    const r1 = hipRoof(44, 30, 4.2, 1.3); g.add(M(r1, roofT, 0, 10.9, 0));
    // 上層
    g.add(M(boxG(28, 6.2, 16, 2), plaster, 0, 15.2, 0));
    for (let x = -13; x <= 13; x += 3.25) for (const s of [-1, 1]) g.add(M(boxG(.48, 6.4, .48), redPost, x, 15.2, s * 8.05));
    for (let x = -11.4; x <= 11.4; x += 3.25) for (const s of [-1, 1]) g.add(M(boxG(2.2, 1.6, .12, 1), C.lat(), x, 15.6, s * 8.1));
    brackets(g, 28.6, 16.6, 18.5, 1.4);
    const r2 = hipRoof(38, 24, 7.5, 1.5); g.add(M(r2, roofT, 0, 18.8, 0)); ridge(g, r2.userData.R, 26.3, true);
    // 觀相窗（下層屋頂中央的小窗）
    g.add(M(boxG(6.6, 2.6, 3.2, 2), plaster, 0, 13.3, 12.6));
    g.add(M(boxG(5.2, 1.7, .12, 1), hallGlow, 0, 13.35, 14.25));
    g.add(M(boxG(5.2, 1.7, .1, 1), C.lat(), 0, 13.35, 14.33));
    const kr = hipRoof(8.4, 4.6, 1.6, .5); g.add(M(kr, roofT, 0, 14.65, 12.8));
    // 賽錢箱、鰐口支架
    g.add(M(boxG(3.4, 1.1, 1.3, 1), wd, 0, .55, 16.7));
    for (let i = 0; i < 9; i++) g.add(M(boxG(.08, .06, 1.1), C.black(), -1.4 + i * .35, 1.12, 16.7));
    g.add(M(boxG(3.6, .08, 1.5, 1), std('saisenTop', { color: '#7a5233' }), 0, 1.06, 16.7));
    for (const s of [-1, 1]) g.add(M(boxG(.24, 4.6, .24), wd, s * 2.4, 2.3, 15.8));
    g.add(M(boxG(5.3, .3, .3), wd, 0, 4.55, 15.8)); g.add(M(boxG(6, .12, 1.4, 1.2), C.roof(), 0, 4.85, 15.8, .18, 0, 0));
    const gong = M(new THREE.CylinderGeometry(.7, .7, .32, 24), bronze, 0, 3.9, 15.85, PI / 2, 0, 0); g.add(gong);
    g.add(M(new THREE.TorusGeometry(.7, .07, 6, 24), gold, 0, 3.9, 16.02));
    B.bake(g);
    box(CX - 20.5, -104.5, CX + 20.5, -77.5); box(CX - 1.8, -75, CX + 1.8, -73.9);
    col(CX - 2.4, -75.2, .3); col(CX + 2.4, -75.2, .3);
    W.lanterns.push(new THREE.Vector3(CX - 8, 7.5, -81), new THREE.Vector3(CX + 8, 7.5, -81), new THREE.Vector3(CX, 4, -84));
    // 搖鈴繩（動態）
    const rope = new THREE.Group(); rope.position.set(CX, 3.45, -91 + 16.2);
    const rm = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 2.5, 8), std('ropeW', { color: '#e8dcc0' })); rm.position.y = -1.25; rope.add(rm);
    for (const [c, y] of [['#c8322a', -.5], ['#f2f0e8', -.9], ['#5a7a3a', -1.3], ['#3a5a8a', -1.7]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .3, 8), std('rc' + c, { color: c })); b.position.y = y; rope.add(b); }
    const tas = new THREE.Mesh(new THREE.ConeGeometry(.16, .4, 8), std('tassel', { color: '#c8322a' })); tas.position.y = -2.6; tas.rotation.x = PI; rope.add(tas);
    rope.traverse(o => o.castShadow = true); ctx.scene.add(rope);
    W.temple = { rope, ropeT: 0, gong: new THREE.Vector3(CX, 3.9, -75.2) };
    W.spots.push({ type: 'temple', x: CX, z: -72.3, label: '🙏 東光寺 大佛殿（參拜・投幣・搖鈴）' });
  }

  // ---------- 鐘樓 ----------
  {
    const BX = 203, BZ = -66;
    const g = new THREE.Group(); g.position.set(BX, 0, BZ);
    g.add(M(boxG(8, .7, 8, 1), stone, 0, .35, 0));
    for (const s of [-1, 1]) for (const t of [-1, 1]) { g.add(M(new THREE.CylinderGeometry(.3, .36, 6.2, 12), redPost, s * 2.8, 3.8, t * 2.8, 0, 0, s * .04)); col(BX + s * 2.8, BZ + t * 2.8, .45); }
    for (const y of [2, 6.4]) for (const r of [0, PI / 2]) { const b = M(boxG(6.4, .32, .32), wd, 0, y, 2.8); b.rotation.y = r; if (r) { b.position.set(2.8, y, 0); } g.add(b); const b2 = b.clone(); b2.position.x *= -1; b2.position.z *= -1; g.add(b2); }
    g.add(M(boxG(6, .5, .5), wd, 0, 6.3, 0));
    brackets(g, 6.4, 6.4, 6.75, 1.3);
    const rr = hipRoof(10.5, 10.5, 3.4, 1.0); g.add(M(rr, roofT, 0, 7, 0));
    g.add(M(new THREE.SphereGeometry(.3, 10, 8), gold, 0, 10.5, 0));
    const pts = [[0, 2.2], [.55, 2.2], [.62, 2.0], [.66, 1.2], [.74, .4], [.86, .05], [.84, 0], [0, 0]].map(p => new THREE.Vector2(p[0], p[1]));
    g.add(M(new THREE.LatheGeometry(pts, 24), bronze, 0, 3.6, 0));
    for (let y = .4; y < 2; y += .32) g.add(M(new THREE.TorusGeometry(.7 - (y - .4) * .07, .03, 4, 24), bronze, 0, 3.6 + y, 0, PI / 2, 0, 0));
    g.add(M(new THREE.TorusGeometry(.25, .08, 6, 12), bronze, 0, 5.95, 0));
    B.bake(g);
    const striker = new THREE.Group(); striker.position.set(BX - 1.2, 6.2, BZ);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 2.4, 10), std('shumoku', { color: '#a88a62' })); log.rotation.z = PI / 2; log.position.set(-1.2, -2.05, 0); striker.add(log);
    for (const x of [-.4, -2]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.05, 4), std('ropeW', { color: '#e8dcc0' })); r.position.set(x, -1.02, 0); striker.add(r); }
    striker.traverse(o => o.castShadow = true); ctx.scene.add(striker);
    W.temple.striker = striker; W.temple.strikeT = 0; W.temple.bell = new THREE.Vector3(BX, 4.5, BZ);
    W.spots.push({ type: 'kane', x: BX - 4.6, z: BZ + 2.5, label: '🔔 鐘樓（撞鐘）' });
    W.lanterns.push(new THREE.Vector3(BX, 5.6, BZ));
  }

  // ---------- 樹木：松與紅葉 ----------
  const maple = (x, z, s) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rand() * 6;
    g.add(M(new THREE.CylinderGeometry(.14, .26, 2.8, 8), C.bark(), 0, 1.4, 0, 0, 0, .1));
    const mm = [std('maple1', { color: '#c4432c', roughness: .9 }), std('maple2', { color: '#d9822b', roughness: .9 }), std('maple3', { color: '#a8322a', roughness: .9 })];
    for (let i = 0; i < 8; i++) { const a = rand() * 6.28, r = rand() * 1.4; const m = M(new THREE.IcosahedronGeometry(.9, 1), mm[i % 3], Math.cos(a) * r, 3.1 + rand() * 1.2, Math.sin(a) * r); m.scale.set(1.2, .75, 1.2); g.add(m); }
    B.bake(g); col(x, z, .4);
  };
  for (const [x, z] of [[148, -55], [149, -72], [147, -92], [208, -52], [209, -84], [208, -98], [160, -50], [196, -50]]) maple(x, z, 1 + rand() * .3);
  for (const [x, z] of [[152, -100], [204, -101], [146, -64], [212, -75], [165, -60], [191, -60]]) { pine(B, x, z, 1.2 + rand() * .3, rand); col(x, z, .45); }
}
