// 新開地：買地蓋自己的房子（材料到各建材店買、每個工序一個小遊戲）、裝飾家具與庭院
import * as THREE from 'three';
const PI = Math.PI;
export const AREA = { x0: 20, x1: 86, z0: -136, z1: -58 };
export const PLOTS = []; for (const z of [-74, -96, -118]) for (const x of [32, 46, 60, 74]) PLOTS.push({ x, z });
export function walkHome(x, z) { return x >= AREA.x0 && x <= AREA.x1 && z >= AREA.z0 && z <= AREA.z1; }
export const LAND = 1500; /* 地價（11/23 調高：整棟約 3200 文，要存一陣子才買得起） */

// 材料：[id, 名, 店, 價]
export const MAT = [['ishi', '礎石', 'zai', 30], ['hashira', '柱', 'zai', 60], ['hari', '梁', 'zai', 120], ['ita', '板材', 'zai', 35],
  ['kawara', '瓦（10 片一束）', 'kawa', 90], ['shoji', '障子', 'tate', 70], ['tatami', '畳', 'tata', 80]];
// 家具：[id, 名, 價, 放哪 in|out|both]
export const FURN = [['andon', '行灯', 80, 'in'], ['hibachi', '火鉢', 100, 'in'], ['byobu', '金屏風', 180, 'in'], ['kakejiku', '掛軸', 140, 'in'], ['tansu', '箪笥', 220, 'in'],
  ['bonsai', '盆栽', 90, 'both'], ['maneki', '招き猫', 120, 'both'], ['chochin', '赤提灯', 50, 'out'], ['endai', '縁台', 100, 'out'], ['toro', '石燈籠', 240, 'out'],
  ['koinobori', '鯉のぼり', 180, 'out'], ['ido', '井戸', 320, 'out'], ['sakura', '桜の木', 260, 'out'], ['matsu', '松の木', 260, 'out'], ['ike', '小池', 400, 'out'],
  // 11/24 新增：江戶町「道具屋」（家具）、「瀬戸物屋」（飾品）販售
  ['zataku', '座卓', 160, 'in'], ['zabuton', '座布団', 40, 'in'], ['kotatsu', '炬燵', 200, 'in'], ['kyodai', '鏡台', 210, 'in'], ['tsuitate', '衝立', 130, 'in'], ['shamisen', '三味線', 260, 'in'],
  ['daruma', '達磨', 60, 'both'], ['hina', '雛人形', 300, 'in'], ['kabuto', '兜飾り', 280, 'in'], ['ikebana', '生け花', 90, 'in'], ['hagoita', '羽子板', 110, 'in'],
  ['tanuki', '信楽狸', 150, 'out'], ['fuurin', '風鈴', 45, 'out'], ['kadomatsu', '門松', 120, 'out'], ['tsukubai', '蹲踞', 200, 'out']];
export const FZH = { andon: '紙罩油燈', hibachi: '炭火盆', byobu: '金箔屏風', kakejiku: '水墨掛軸', tansu: '桐木衣櫃', bonsai: '松樹盆栽', maneki: '招財貓', chochin: '紅燈籠', endai: '長板凳', toro: '石燈籠', koinobori: '鯉魚旗', ido: '水井', sakura: '櫻花樹', matsu: '松樹', ike: '鯉魚池',
  zataku: '和式矮桌', zabuton: '坐墊', kotatsu: '暖桌', kyodai: '梳妝鏡台', tsuitate: '屏風隔板', shamisen: '三味線', daruma: '不倒翁', hina: '女兒節人偶', kabuto: '武士頭盔擺飾', ikebana: '插花', hagoita: '羽子板擺飾', tanuki: '狸貓陶偶', fuurin: '風鈴', kadomatsu: '新年門松', tsukubai: '洗手石缽' };
export const TOWN_FURN = { dogu: ['andon', 'hibachi', 'tansu', 'zataku', 'zabuton', 'kotatsu', 'kyodai', 'tsuitate', 'byobu', 'shamisen', 'endai', 'chochin'],
  seto: ['kakejiku', 'ikebana', 'daruma', 'maneki', 'hagoita', 'hina', 'kabuto', 'bonsai', 'fuurin', 'tanuki', 'kadomatsu', 'toro', 'tsukubai'] };
export const STORES = { zai: ['材木屋 木曽屋', '「上等的檜木，蓋房子就靠它！」'], kawa: ['瓦屋 瓦善', '「屋頂沒瓦，下雨可就慘囉。」'], tate: ['建具屋 戸田屋', '「障子紙是今早剛糊的。」'], tata: ['畳屋 畳清', '「藺草香，聞了就想躺。」'], yoro: ['萬屋 よろづ屋', '「家具擺飾，應有盡有！」'] };
// 工序：[名, 說明, 需要材料, 小遊戲]
export const STEPS = [['整地・礎石', '把地面夯平，放上礎石', { ishi: 4 }, 'mash'], ['柱立て', '一根一根立起柱子', { hashira: 4 }, 'tap'], ['上棟', '架上大樑，辦上棟式！', { hari: 2 }, 'hold'],
  ['床・壁', '鋪地板、釘牆板', { ita: 6 }, 'tap'], ['屋根', '一片片鋪上屋瓦', { kawara: 3 }, 'tap'], ['建具・畳', '裝障子、鋪榻榻米', { shoji: 4, tatami: 4 }, 'mash']];
const SLOTS_IN = [[-2.6, -1.3], [-.9, -1.3], [.9, -1.3], [2.6, -1.3], [-2.9, 1.2], [-1.2, 1.4], [1.2, 1.4], [2.9, 1.2]], SLOTS_OUT = [[-4.6, 4.2], [-1.8, 4.8], [1.8, 4.8], [4.6, 4.2], [-5.3, .6], [5.3, .6], [-3.4, 6.6], [3.4, 6.6]];
const WALL_ONLY = ['kakejiku']; // 掛在後牆，只能放室內前四格

let A, H = null, grp = null, cols = [], GEN = 0;
const $ = s => document.querySelector(s);
const matN = id => MAT.find(m => m[0] === id)[1], furN = id => FURN.find(f => f[0] === id)[1];

// ---------------- 場景（固定物件）----------------
export function buildHomeArea(ctx) {
  const { M, boxG, std, B, W, col, TX, scene } = ctx;
  const gm = std('hGround', { map: TX.ground('g2').clone(), color: '#c8d0a0' }); gm.map.repeat.set(16, 20); gm.map.needsUpdate = true;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(AREA.x1 - AREA.x0, AREA.z1 - AREA.z0), gm); g.rotation.x = -PI / 2; g.position.set((AREA.x0 + AREA.x1) / 2, .012, (AREA.z0 + AREA.z1) / 2); g.receiveShadow = true; scene.add(g);
  const stake = std('hStake', { color: '#8a6a44' }), rope = std('hRope', { color: '#e8dcc0' }), sign = std('hSign', { color: '#d8c49a' });
  PLOTS.forEach((p, i) => { // 地界樁＋繩子＋告示牌
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) B.bake(M(boxG(.14, .7, .14, 1), stake, p.x + dx, .35, p.z + dz));
    for (const [x, z, w, d] of [[p.x, p.z - 6, 12, .04], [p.x, p.z + 6, 12, .04], [p.x - 6, p.z, .04, 12], [p.x + 6, p.z, .04, 12]]) B.bake(M(boxG(w, .03, d, 1), rope, x, .6, z));
    B.bake(M(boxG(.1, 1.1, .1, 1), stake, p.x + 4.5, .55, p.z + 6.6)); B.bake(M(boxG(1, .6, .06, 1), sign, p.x + 4.5, 1.2, p.z + 6.6));
    W.spots.push({ type: 'plot', i, x: p.x + 4.5, z: p.z + 7.3, label: `📋 建地 ${i + 1} 號` });
  });
  // 建材店：一排小屋台（北側）
  const keys = Object.keys(STORES);
  keys.forEach((k, i) => {
    const x = 28 + i * 13, z = -61.5, gr = new THREE.Group(); gr.position.set(x, 0, z);
    gr.add(M(boxG(5, .9, 1.6, 1), std('hCnt', { map: TX.wood('plank', '#7a5a3a', [2, 1]) }), 0, .45, 0));
    for (const sx of [-2.3, 2.3]) gr.add(M(boxG(.14, 2.6, .14, 1), std('hPost', { color: '#5a3e28' }), sx, 1.3, -.6));
    gr.add(M(boxG(5.6, .12, 2.4, 1), std('hAwn' + i, { color: ['#7a5a3a', '#5a5f6a', '#c8a050', '#5a7a4a', '#a8323e'][i] }), 0, 2.65, .1, .18, 0, 0));
    gr.add(M(new THREE.BoxGeometry(3.4, .7, .08), std('hSg' + i, { map: TX.text(STORES[k][0].split(' ')[1], { bg: '#efe2c0', fg: '#1c1410', w: 512, h: 128, vertical: false }) }), 0, 2.2, -.55));
    const goods = { zai: ['#c89a62', '#b0844e'], kawa: ['#4a4f58', '#5a606a'], tate: ['#f4ecd8', '#e8dcc0'], tata: ['#a8b468', '#98a458'], yoro: ['#c8322a', '#e8c050'] }[k];
    for (let j = 0; j < 6; j++) gr.add(M(boxG(.55, .3 + (j % 2) * .2, .5, 1), std('hGd' + k + j % 2, { color: goods[j % 2] }), -1.9 + j * .76, 1.05, 0));
    B.bake(gr); col(x - 1.5, z, 1.1); col(x + 1.5, z, 1.1);
    W.spots.push({ type: 'mat', k, x, z: z + 1.9, label: `🔨 ${STORES[k][0]}` });
    W.homeKeepers = W.homeKeepers || []; W.homeKeepers.push({ x, z: z - .5, r: 0 });
  });
}

// ---------------- 存檔 ----------------
function home() { const S = A.P.prog(); return S ? (S.home = S.home || null) : null; }
function setHome(h) { A.P.prog().home = h; A.P.save(); }

// ---------------- 房子模型 ----------------
const MATS = {};
function m(k, o) { return MATS[k] || (MATS[k] = new THREE.MeshStandardMaterial({ roughness: .85, ...o })); }
const box = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };
export function furnMesh(id) {
  const g = new THREE.Group(), wd = m('fwd', { color: '#7a5434' });
  const add = o => { o.castShadow = true; g.add(o); return o; };
  const cyl = (rt, rb, h, mat, y = h / 2, x = 0, z = 0) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), mat); c.position.set(x, y, z); return add(c); };
  const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat); s.position.set(x, y, z); s.scale.set(sx, sy, sz); return add(s); };
  switch (id) {
    case 'andon': add(box(.4, .7, .4, m('fpaper', { color: '#f6ecd0', emissive: '#ffb860', emissiveIntensity: .7 }), 0, .45, 0)); add(box(.5, .08, .5, wd, 0, .06, 0)); break;
    case 'hibachi': cyl(.32, .26, .4, m('fbrz', { color: '#6a4a2a', metalness: .4 })); cyl(.25, .25, .05, m('fash', { color: '#c8c0b0' }), .4); sph(.06, m('fcoal', { color: '#ff5a20', emissive: '#ff3a10', emissiveIntensity: 1 }), 0, .44, 0); break;
    case 'byobu': for (let i = 0; i < 4; i++) { const p = box(.5, 1.1, .03, m('fgold', { color: '#e8c050', metalness: .5, roughness: .3 }), -.75 + i * .5, .55, (i % 2) * .15); p.rotation.y = (i % 2 ? -.5 : .5); add(p); } break;
    case 'kakejiku': add(box(.5, 1.3, .02, m('fscroll', { color: '#efe6d0' }), 0, 1.1, .2)); add(box(.3, .6, .025, m('fink', { color: '#3a4a3a' }), 0, 1.15, .21)); break;
    case 'tansu': add(box(.9, .9, .45, m('ftan', { color: '#8a5a2a' }), 0, .45, 0)); for (const y of [.2, .45, .7]) add(box(.92, .03, .46, m('fmet', { color: '#2a2a2a' }), 0, y, .01)); break;
    case 'bonsai': cyl(.22, .16, .18, m('fpot', { color: '#4a5a6a' })); cyl(.04, .05, .3, wd, .3); sph(.25, m('fleaf', { color: '#4a7a3a' }), .05, .5, 0, 1.3, .6, 1); break;
    case 'maneki': sph(.2, m('fcat', { color: '#fbf6ec' }), 0, .2, 0, 1, 1.1, .9); sph(.15, m('fcat', {}), 0, .48, 0); sph(.05, m('fcat', {}), .14, .55, .05); sph(.05, m('fred', { color: '#d83a2a' }), 0, .33, .16); break;
    case 'chochin': cyl(.03, .03, 1.6, wd, .8); sph(.28, m('fchoc', { color: '#d83a2a', emissive: '#ff4a20', emissiveIntensity: .6 }), 0, 1.8, 0, 1, 1.3, 1); break;
    case 'endai': add(box(1.6, .08, .6, m('fcloth', { color: '#c8322a' }), 0, .45, 0)); for (const x of [-.7, .7]) for (const z of [-.25, .25]) add(box(.06, .42, .06, wd, x, .21, z)); break;
    case 'toro': { const st = m('fst', { color: '#9a958a' }); add(box(.6, .25, .6, st, 0, .12, 0)); cyl(.12, .15, .8, st, .65); add(box(.55, .12, .55, st, 0, 1.1, 0)); add(box(.34, .3, .34, m('ftl', { color: '#e8dcc0', emissive: '#ffb050', emissiveIntensity: .5 }), 0, 1.31, 0)); const c = new THREE.Mesh(new THREE.ConeGeometry(.48, .35, 4), st); c.position.y = 1.63; c.rotation.y = PI / 4; add(c); break; }
    case 'koinobori': cyl(.05, .06, 4, wd, 2); [['#2a4a8a', 3.6], ['#c8322a', 3.0], ['#e88aa0', 2.4]].forEach(([c, y], i) => { const k = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.4 - i * .2, 10), m('fkoi' + i, { color: c, side: THREE.DoubleSide })); k.position.set(.75, y, 0); k.rotation.z = -PI / 2; add(k); }); break;
    case 'ido': { const st = m('fst', {}); cyl(.6, .65, .7, st, .35); cyl(.48, .48, .05, m('fwater', { color: '#2a4a5a' }), .66); for (const x of [-.6, .6]) cyl(.05, .05, 1.8, wd, .9, x); add(box(1.6, .08, 1, m('froof', { color: '#3a3430' }), 0, 1.85, 0)); break; }
    case 'sakura': cyl(.12, .2, 1.8, m('fbark', { color: '#5a3e2e' }), .9); for (let i = 0; i < 6; i++) sph(.6, m('fpink', { color: '#f4b8c8' }), Math.cos(i) * .6, 2.2 + (i % 3) * .3, Math.sin(i) * .6); break;
    case 'matsu': cyl(.12, .2, 2, m('fbark', {}), 1); for (let i = 0; i < 3; i++) sph(.8 - i * .15, m('fpine', { color: '#3a5a3a' }), (i - 1) * .3, 1.8 + i * .5, 0, 1.4, .4, 1); break;
    case 'zataku': add(box(1.1, .07, .65, m('furu', { color: '#5a2a1a', roughness: .35 }), 0, .32, 0)); for (const x of [-.48, .48]) for (const z of [-.26, .26]) add(box(.07, .29, .07, m('furu', {}), x, .145, z)); break;
    case 'zabuton': for (const [x, c] of [[-.3, '#6a3a6a'], [.3, '#a8323e']]) add(box(.55, .09, .55, m('fzb' + c, { color: c }), x, .05, 0)); break;
    case 'kotatsu': add(box(1.05, .32, 1.05, m('fkf', { color: '#a8323e' }), 0, .16, 0)); add(box(.9, .05, .9, m('fkt', { color: '#8a5a2a', roughness: .4 }), 0, .345, 0)); sph(.07, m('fmikan', { color: '#f08a20' }), .1, .41, .05); sph(.07, m('fmikan', {}), -.05, .41, -.08); break;
    case 'kyodai': add(box(.55, .4, .35, m('furu', { color: '#5a2a1a', roughness: .35 }), 0, .2, 0)); add(box(.06, .55, .05, m('furu', {}), 0, .65, -.1)); add(box(.38, .46, .03, m('fmirror', { color: '#c8d4dc', emissive: '#7a8a98', emissiveIntensity: .5, roughness: .2 }), 0, .78, -.07)); add(box(.5, .06, .04, m('fred', { color: '#d83a2a' }), 0, .42, .16)); break;
    case 'tsuitate': for (const x of [-.4, .4]) add(box(.12, .08, .4, wd, x, .04, 0)); add(box(1.05, .85, .05, wd, 0, .55, 0)); add(box(.95, .75, .055, m('fpaper2', { color: '#efe6d0' }), 0, .55, 0)); add(box(.6, .07, .06, m('fink', { color: '#3a4a3a' }), .1, .7, 0)); add(box(.05, .45, .06, m('fink', {}), -.15, .5, 0)); break;
    case 'shamisen': { const s = new THREE.Group(); s.add(box(.34, .36, .09, m('fsh', { color: '#efe2c0' }), 0, .18, 0)); s.add(box(.045, .95, .04, m('furu', { color: '#5a2a1a' }), 0, .74, 0)); s.add(box(.07, .12, .05, m('furu', {}), 0, 1.24, -.02)); s.rotation.z = .22; s.position.x = .12; g.add(s); add(box(.4, .04, .3, wd, 0, .02, 0)); break; }
    case 'daruma': sph(.26, m('fdaru', { color: '#c8221a', roughness: .4 }), 0, .26, 0, 1, 1.1, .95); sph(.15, m('fface', { color: '#f6efe0' }), 0, .33, .16, 1, 1, .45); for (const x of [-.05, .05]) sph(.025, m('fcoal2', { color: '#111111' }), x, .36, .225); add(box(.2, .03, .02, m('fgold', { color: '#e8c050', metalness: .5, roughness: .3 }), 0, .16, .25)); break;
    case 'hina': { const red = m('fhina', { color: '#c8222a' }); for (let i = 0; i < 3; i++) add(box(1.1 - i * .25, .22, .5 - i * .1, red, 0, .11 + i * .22, i * -.06));
      [[-.15, .66, '#2a2a4a'], [.15, .66, '#c84a6a'], [-.35, .44, '#f0e6d0'], [0, .44, '#f0e6d0'], [.35, .44, '#f0e6d0'], [-.3, .22, '#3a6a4a'], [.3, .22, '#6a4a8a']].forEach(([x, y, c]) => { sph(.07, m('fdoll' + c, { color: c }), x, y + .07, .05, 1, 1.3, 1); sph(.045, m('fface', { color: '#f6efe0' }), x, y + .19, .05); }); break; }
    case 'kabuto': add(box(.6, .12, .45, m('furu', { color: '#5a2a1a' }), 0, .06, 0)); sph(.22, m('fkab', { color: '#2a2a30', metalness: .5, roughness: .35 }), 0, .2, 0, 1, .8, 1); add(box(.6, .05, .5, m('fkab', {}), 0, .18, .02));
      for (const sd of [-1, 1]) { const k = box(.04, .4, .02, m('fgold', { color: '#e8c050', metalness: .5, roughness: .3 }), sd * .12, .5, .15); k.rotation.z = -sd * .45; add(k); } break;
    case 'ikebana': cyl(.1, .14, .3, m('fvase', { color: '#2a4a6a', roughness: .2 })); for (const [x, y, z] of [[0, .62, 0], [-.12, .5, .05], [.13, .55, -.04]]) cyl(.012, .012, y - .2, m('fstem', { color: '#4a7a3a' }), (y + .2) / 2, x * .5, z * .5);
      sph(.07, m('fpink', { color: '#f4b8c8' }), 0, .65, 0); sph(.06, m('fwhite', { color: '#fbf6ec' }), -.12, .52, .05); sph(.06, m('fdaru', { color: '#c8221a', roughness: .4 }), .13, .57, -.04); sph(.1, m('fstem', {}), .02, .38, .06, 1.6, .4, 1); break;
    case 'hagoita': add(box(.4, .05, .25, wd, 0, .025, 0)); add(box(.07, .28, .03, wd, 0, .19, -.02)); add(box(.3, .55, .03, m('fhago', { color: '#e8c050', metalness: .3 }), 0, .6, -.02)); add(box(.22, .38, .035, m('fhina', { color: '#c8222a' }), 0, .62, -.01)); sph(.05, m('fface', { color: '#f6efe0' }), 0, .72, .01); break;
    case 'tanuki': { const cl = m('ftan2', { color: '#8a6a4a', roughness: .6 }); sph(.35, cl, 0, .38, 0, 1, 1, .9); sph(.23, cl, 0, .88, .02); sph(.13, m('fbel', { color: '#d8c8a8' }), 0, .38, .25, 1, 1.2, .5); for (const x of [-.09, .09]) sph(.04, m('fcoal2', { color: '#111111' }), x, .92, .22);
      const h = new THREE.Mesh(new THREE.ConeGeometry(.3, .18, 14), m('fstraw', { color: '#c8a868' })); h.position.y = 1.15; add(h); cyl(.07, .08, .22, m('fsake', { color: '#f0e6d0' }), .4, .33, .1); break; }
    case 'fuurin': cyl(.03, .035, 1.7, wd, .85); add(box(.5, .04, .04, wd, .22, 1.68, 0)); sph(.09, m('fglass', { color: '#bfe2f0', transparent: true, opacity: .7, roughness: .05 }), .44, 1.55, 0, 1, .8, 1); add(box(.07, .25, .01, m('fslip', { color: '#d83a2a' }), .44, 1.33, 0)); break;
    case 'kadomatsu': cyl(.3, .26, .4, m('fstraw', { color: '#c8a868' })); for (const [x, z, h] of [[0, -.08, 1.2], [-.12, .08, 1.0], [.12, .08, .85]]) cyl(.06, .06, h, m('fbamb', { color: '#5a8a3a' }), .3 + h / 2, x, z);
      sph(.32, m('fpine', { color: '#3a5a3a' }), 0, .5, .05, 1.3, .5, 1); for (const sd of [-1, 1]) sph(.05, m('fdaru', { color: '#c8221a', roughness: .4 }), sd * .25, .45, .25); break;
    case 'tsukubai': { const st = m('fst', { color: '#9a958a' }); cyl(.4, .45, .45, st); cyl(.3, .3, .04, m('fwater', { color: '#2a4a5a' }), .44); const p = box(.06, .06, .7, m('fbamb', { color: '#5a8a3a' }), 0, .62, -.55); p.rotation.x = .25; add(p); add(box(.08, .7, .08, m('fbamb', {}), 0, .35, -.85)); for (let i = 0; i < 4; i++) sph(.13, st, Math.cos(i * 1.7) * .7, .08, Math.sin(i * 1.7) * .5 + .2); break; }
    case 'ike': { const w = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), m('fpond', { color: '#3f7088', metalness: .3, roughness: .1 })); w.rotation.x = -PI / 2; w.position.y = .03; w.scale.set(1.3, .9, 1); add(w); for (let i = 0; i < 8; i++) sph(.16, m('fst', {}), Math.cos(i / 8 * 6.28) * 1.45, .08, Math.sin(i / 8 * 6.28) * 1.0); sph(.1, m('fkoi0', {}), .3, .06, .1, 1.8, .4, .8); break; }
  }
  return g;
}
function buildHouse(h, owner) { // 依存檔（plot/stage/deco）蓋出一棟房子，回傳 { grp, cols }
  const cols = [], p = PLOTS[h.plot], s = h.stage, grp = new THREE.Group(); grp.position.set(p.x, 0, p.z - 2);
  const wood = m('hwood', { color: '#a87a4a' }), dark = m('hdark', { color: '#5a3e28' }), stone = m('hstone', { color: '#9a958a' }), wall = m('hwall', { color: '#efe6d0' });
  const colAt = (x, z, r) => { const c = { x: p.x + x, z: p.z - 2 + z, r }; A.W.colliders.push(c); cols.push(c); };
  // 0：地基土台
  grp.add(box(9, .1, 7, m('hpad', { color: '#b8a888' }), 0, .05, 0));
  if (s >= 1) for (const x of [-4, -1.33, 1.33, 4]) for (const z of [-3, 3]) grp.add(box(.5, .3, .5, stone, x, .15, z));
  if (s >= 2) for (const x of [-4, -1.33, 1.33, 4]) for (const z of [-3, 3]) { grp.add(box(.24, 3, .24, wood, x, 1.8, z)); colAt(x, z, .35); }
  if (s >= 3) { for (const z of [-3, 3]) grp.add(box(8.4, .26, .26, dark, 0, 3.3, z)); for (const x of [-4, 4]) grp.add(box(.26, .26, 6.4, dark, x, 3.3, 0)); grp.add(box(8.6, .3, .3, dark, 0, 4.6, 0)); for (const x of [-4, 4]) { const r = box(.2, 1.5, .2, dark, x, 4, 0); grp.add(r); } }
  if (s >= 4) { grp.add(box(8.2, .12, 6.2, m('hfloor', { color: '#b88a5a' }), 0, .55, 0)); grp.add(box(8.6, .1, 1.2, m('hengawa', { color: '#a87a4a' }), 0, .5, 3.6));
    grp.add(box(8.1, 2.6, .12, wall, 0, 1.9, -2.95)); for (const x of [-3.95, 3.95]) grp.add(box(.12, 2.6, 5.9, wall, x, 1.9, 0));
    for (let x = -3.6; x <= 3.6; x += 1.2) colAt(x, -2.9, .7); for (let z = -2.4; z <= 2.4; z += 1.2) { colAt(-3.9, z, .7); colAt(3.9, z, .7); } }
  if (s >= 5) { const roof = m('hroof', { color: '#4a4f58', roughness: .7 }); for (const sd of [-1, 1]) { const r = box(9.4, .16, 4.3, roof, 0, 4.15, sd * 1.8); r.rotation.x = sd * .55; grp.add(r); } grp.add(box(9.6, .3, .4, m('hridge', { color: '#3a3e46' }), 0, 4.95, 0)); }
  if (s >= 6) { for (let i = 0; i < 4; i++) grp.add(box(1.9, 2.4, .05, m('hshoji', { color: '#f6efdc', emissive: '#ffcf90', emissiveIntensity: .12 }), -3 + i * 2 + (i % 2 ? .6 : 0), 1.8, 2.92 - (i % 2) * .08));
    for (let i = 0; i < 4; i++) grp.add(box(1.9, .03, 2.9, m('htatami', { color: '#b8c070' }), -3 + i * 2, .62, -.9)); grp.add(box(.5, .9, .05, m('hnoren', { color: '#2f4f7a' }), 0, 2.6, 3.0)); }
  if (s >= 6) { const d = h.deco || {}; // 家具
    SLOTS_IN.forEach(([x, z], i) => { const id = d['i' + i]; if (!id) return; const f = furnMesh(id); f.position.set(x, .62, z - (WALL_ONLY.includes(id) ? .95 : 0)); grp.add(f); });
    SLOTS_OUT.forEach(([x, z], i) => { const id = d['o' + i]; if (!id) return; const f = furnMesh(id); f.position.set(x, 0, z); f.rotation.y = x < 0 ? .3 : -.3; grp.add(f); colAt(x, z, ['sakura', 'matsu', 'ido', 'ike', 'toro', 'tsukubai'].includes(id) ? .9 : .5); }); }
  if (owner) { // 屋主名牌
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = 'rgba(40,28,18,.85)'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#f4e8d0'; c.font = '700 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(owner).slice(0, 8) + ' の家', 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); sp.scale.set(2.6, .65, 1); sp.position.set(4.5, 2.2, 8.6); grp.add(sp); }
  A.scene.add(grp); return { grp, cols };
}
const REM = new Map(); let remObjs = []; // 其他線上玩家的房子
function clearCols(list) { for (const c of list) { const i = A.W.colliders.indexOf(c); if (i >= 0) A.W.colliders.splice(i, 1); } }
function rebuild() {
  if (!A) return;
  if (grp) { A.scene.remove(grp); grp = null; } clearCols(cols); cols = [];
  const h = home(); if (h) { const r = buildHouse(h, A.G.name); grp = r.grp; cols = r.cols; }
  renderRemotes(); sendMine();
}
function renderRemotes() {
  if (!A) return; for (const o of remObjs) { A.scene.remove(o.grp); clearCols(o.cols); } remObjs = [];
  const mine = home(), used = new Set(mine ? [mine.plot] : []);
  for (const [id, r] of REM) { if (!r.h || used.has(r.h.plot)) continue; used.add(r.h.plot); const o = buildHouse(r.h, r.n); o.id = id; o.plot = r.h.plot; o.n = r.n; remObjs.push(o); }
}
export function sendMine() { if (A && A.sendHome) A.sendHome(home()); }
export function setRemoteHome(id, n, h) { REM.set(id, { n, h }); renderRemotes(); }
export function delRemoteHome(id) { if (REM.delete(id)) renderRemotes(); }
const plotOwner = i => { const o = remObjs.find(o => o.plot === i); return o ? o.n : null; };
const plotObj = i => remObjs.find(o => o.plot === i);

// ---------------- 小遊戲（施工）----------------
// tap：指針左右擺，進綠區點；mash：限時連打把條灌滿；hold：按住蓄力、在綠區放開
function buildGame(stepName, kind, rounds, onDone) {
  const M = A.gameModal('🔨 ' + stepName, kind === 'tap' ? '指針經過綠色區域時點一下！' : kind === 'mash' ? '用力連打，在時間內把進度條灌滿！' : '按住蓄力，在綠色區域放開！');
  const g = M.g, my = ++GEN; let i = 0, score = 0, x = 0, dir = 1, v = 1.1, zc = .5, zw = .16, fill = 0, held = false, tLeft = 5, last = performance.now(), msg = '', mT = 0, fin = false;
  let t0 = performance.now(), h0 = 0;
  const tri = u => { const k = u % 2; return k < 1 ? k : 2 - k; };
  const xNow = () => tri((performance.now() - t0) / 1000 * v), fillNow = () => held && kind === 'hold' ? (performance.now() - h0) / 1000 * .5 : fill; // 依真實時間計算，畫面卡也不會跳格
  const nextRound = () => { zc = .25 + Math.random() * .5; zw = Math.max(.08, .17 - i * .015); v = .8 + i * .12 + Math.random() * .25; t0 = performance.now(); x = 0; dir = 1; fill = 0; tLeft = kind === 'mash' ? 4.5 : 99; };
  nextRound();
  const judge = ok => { if (ok) score++; msg = ok ? ['好！', '漂亮！', '完美！'][Math.floor(Math.random() * 3)] : '失手了…'; mT = .7; A.SND.pluck(ok ? 880 : 240, .06); i++; if (i >= rounds) { fin = true; setTimeout(() => { if (my === GEN && M.cv.isConnected) { M.close(); onDone(score / rounds); } }, 700); } else nextRound(); };
  M.cv.onpointerdown = e => { e.preventDefault(); if (fin) return; held = true;
    if (kind === 'tap') judge(Math.abs(xNow() - zc) < zw / 2);
    if (kind === 'hold') { h0 = performance.now(); fill = 0; }
    if (kind === 'mash') { fill += .075; A.SND.pluck(500 + fill * 600, .03); if (fill >= 1) judge(true); } };
  M.cv.onpointerup = M.cv.onpointerleave = () => { if (!held) return; held = false; if (kind === 'hold' && !fin) { fill = (performance.now() - h0) / 1000 * .5; if (fill > .05) judge(Math.abs(fill - zc) < zw / 2); } };
  const loop = () => {
    if (my !== GEN || !$('#pg') || $('#pg').classList.contains('hide') || !M.cv.isConnected) return;
    const now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now; mT -= dt;
    if (!fin) { if (kind === 'tap') x = xNow();
      if (kind === 'mash') { fill = Math.max(0, fill - .12 * dt); tLeft -= dt; if (tLeft <= 0) judge(false); }
      if (kind === 'hold') { if (held) { fill = fillNow(); if (fill > 1.05) { held = false; judge(false); } } } }
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 360, 240);
    // 木頭工地背景
    g.fillStyle = '#c89a62'; for (let k = 0; k < 6; k++) g.fillRect(20 + k * 56, 150, 40, 70); g.fillStyle = '#8a6a44'; g.fillRect(0, 210, 360, 30);
    const bx = 30, bw = 300, by = 70;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx, by, bw, 30); g.fillStyle = 'rgba(80,200,120,.85)';
    if (kind !== 'mash') g.fillRect(bx + (zc - zw / 2) * bw, by, zw * bw, 30);
    if (kind === 'tap') { g.fillStyle = '#c8322a'; g.fillRect(bx + x * bw - 3, by - 8, 6, 46); }
    else { g.fillStyle = kind === 'mash' ? '#e0a046' : '#c8322a'; g.fillRect(bx, by + 8, Math.min(1, fill) * bw, 14); }
    g.fillStyle = '#3a2a1a'; g.font = '700 15px sans-serif'; g.textAlign = 'center';
    g.fillText(kind === 'mash' ? `剩 ${Math.max(0, tLeft).toFixed(1)} 秒` : kind === 'hold' ? '按住…放開！' : '看準時機', 180, 130);
    if (mT > 0) { g.font = '900 28px sans-serif'; g.fillStyle = msg === '失手了…' ? '#8a3a2a' : '#c8322a'; g.fillText(msg, 180, 50); }
    M.stat(`第 ${Math.min(i + 1, rounds)} / ${rounds} 回　成功 <b>${score}</b>`);
    window.__build = { i, score, fin, x, zc, zw, fill, kind, xNow, fillNow };
    requestAnimationFrame(loop);
  };
  loop();
}

// ---------------- 面板 ----------------
function panel(html) { const p = $('#panel'); p.innerHTML = html + '<button class="close" id="hX">✕</button>'; A.show('#panel'); $('#hX').onclick = A.closePanels; return p; }
export function openPlot(i) {
  const h = home(), p = PLOTS[i], who = plotOwner(i);
  if (who && (!h || h.plot !== i) && A.visit) return A.visit(plotObj(i).id, who, i);
  if (who && (!h || h.plot !== i)) return panel(`<h2>建地 ${i + 1} 號</h2><p class="sub">這裡是「${who}」的家。${h ? '' : '找一塊空地蓋自己的家吧！'}</p>`);
  if (!h) {
    const pp = panel(`<h2>建地 ${i + 1} 號<small>新開地</small></h2><p class="sub">一塊 12 × 12 的空地。買下後就能在這裡蓋自己的家，之後到北邊的建材店買材料，一步一步動工！</p>
      <p class="sub">地價：<b>${LAND}</b> 文　身上：${A.G.money} 文<br>蓋好一整棟，材料大約還要 <b>${STEPS.reduce((t, st) => t + Object.entries(st[2]).reduce((a, [k, n]) => a + MAT.find(m => m[0] === k)[3] * n, 0), 0)}</b> 文。打工、釣魚、種田、完成委託都能存錢！</p><div class="btns"><button class="big" id="hBuy">🏡 買下這塊地</button></div>`);
    pp.querySelector('#hBuy').onclick = () => { if (!A.afford(LAND)) return A.toast('錢不夠喔，先去打工或賣魚吧'); A.addMoney(-LAND, '買地'); setHome({ plot: i, stage: 0, deco: {} }); A.P.ev('build', { k: 'land' }); rebuild(); A.toast('買下建地了！到北邊的「材木屋」買礎石開始施工吧', 4000); openPlot(i); };
    return;
  }
  if (h.plot !== i) return panel(`<h2>建地 ${i + 1} 號</h2><p class="sub">你已經在 ${h.plot + 1} 號地蓋房子了。</p>`);
  if (h.stage < STEPS.length) {
    const st = STEPS[h.stage], mb = A.P.bag('mat'); const enough = Object.entries(st[2]).every(([k, n]) => (mb[k] || 0) >= n);
    const pp = panel(`<h2>我的家<small>建地 ${i + 1} 號・工序 ${h.stage + 1} / ${STEPS.length}</small></h2>
      <div class="steps">${STEPS.map((s, k) => `<span class="${k < h.stage ? 'got' : k === h.stage ? 'now' : ''}">${s[0]}</span>`).join('')}</div>
      <p class="sub"><b>下一步：${st[0]}</b>——${st[1]}</p>
      <div class="mlist">${Object.entries(st[2]).map(([k, n]) => `<div class="mrow"><span>${matN(k)}</span><span>${mb[k] || 0} / ${n}</span><span>${(mb[k] || 0) >= n ? '✔' : '不足'}</span><span></span></div>`).join('')}</div>
      <div class="btns">${enough ? '<button class="big" id="hGo">🔨 開始施工</button>' : '<p class="sub">材料不夠，到北邊的建材店買齊再來！</p>'}</div>`);
    const go = pp.querySelector('#hGo'); if (go) go.onclick = () => { A.closePanels(); doStep(); };
    return;
  }
  openDeco();
}
function doStep() {
  const h = home(), st = STEPS[h.stage];
  buildGame(st[0], st[3], st[3] === 'mash' ? 2 : 4, q => {
    if (q < .5) { A.toast(`「${st[0]}」沒做好……材料沒浪費，再試一次吧`, 3200); A.G.me.emoji('😓'); return; }
    for (const [k, n] of Object.entries(st[2])) A.P.bagAdd('mat', k, -n);
    h.stage++; setHome(h); rebuild(); A.P.ev('build', { k: 'step' + h.stage }); A.P.addXp(30 + h.stage * 5);
    A.G.me.emoji('🔨'); A.toast(`完成工序「${st[0]}」！${h.stage < STEPS.length ? '下一步：' + STEPS[h.stage][0] : ''}`, 3500);
    if (h.stage === 3) { A.announceSelf('上棟式！撒餅慶祝 🎉（獲得 150 文賀禮）', '我的家'); A.addMoney(150, '上棟式賀禮'); A.G.me.emoji('🎊'); }
    if (h.stage === STEPS.length) { A.announceSelf('房子蓋好了！到江戶町的道具屋、瀬戸物屋買家具和飾品來裝飾吧', '我的家'); A.P.addXp(120); A.G.me.emoji('🏡'); }
  });
}
export function openDeco() {
  const h = home(), fb = A.P.bag('furn'), d = h.deco = h.deco || {};
  const used = {}; for (const k in d) if (d[k]) used[d[k]] = (used[d[k]] || 0) + 1;
  const opt = (slot, where) => { const cur = d[slot] || ''; const ids = FURN.filter(f => (f[3] === where || f[3] === 'both') && !(where === 'in' && +slot.slice(1) >= 4 && WALL_ONLY.includes(f[0]))).map(f => f[0]).filter(id => id === cur || (fb[id] || 0) - (used[id] || 0) > 0);
    return `<select data-slot="${slot}"><option value="">（空）</option>${ids.map(id => `<option value="${id}" ${id === cur ? 'selected' : ''}>${furN(id)}</option>`).join('')}</select>`; };
  const pp = panel(`<h2>我的家<small>建地 ${h.plot + 1} 號・裝飾</small></h2><p class="sub">把買來的家具、飾品擺進家裡和庭院（江戶町「道具屋」賣家具、「瀬戸物屋」賣飾品，新開地「萬屋」什麼都有）。每換一次擺設都會馬上看到。</p>
    <h4>🏠 室內（1–4 靠牆、5–8 前排）</h4><div class="slots">${SLOTS_IN.map((_, i) => `<label>位置 ${i + 1}${opt('i' + i, 'in')}</label>`).join('')}</div>
    <h4>🌳 庭院</h4><div class="slots">${SLOTS_OUT.map((_, i) => `<label>位置 ${i + 1}${opt('o' + i, 'out')}</label>`).join('')}</div>
    <div class="btns"><button id="hRest" class="big alt">🍵 在家休息（每天一次 +經驗）</button></div>`);
  pp.querySelectorAll('select').forEach(s => s.onchange = () => { d[s.dataset.slot] = s.value || undefined; if (!s.value) delete d[s.dataset.slot]; setHome(h); rebuild(); A.P.ev('deco', { k: s.value }); openDeco(); });
  pp.querySelector('#hRest').onclick = () => { const S = A.P.prog(); const t = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); if (S.homeRest === t) return A.toast('今天已經在家休息過了'); S.homeRest = t; A.P.save(); A.G.sta = 100; A.P.addXp(20 + Object.keys(d).length * 3, '在家休息'); A.G.me.emoji('🍵'); A.G.me.say('還是自己家最舒服～', 3); A.closePanels(); };
}
export function openStore(k) {
  const [name, line] = STORES[k];
  const items = k === 'yoro' ? FURN.map(f => ({ id: f[0], n: f[1], p: f[2], cat: 'furn', note: { in: '室內', out: '庭院', both: '室內／庭院' }[f[3]] })) : MAT.filter(x => x[2] === k).map(x => ({ id: x[0], n: x[1], p: x[3], cat: 'mat', note: '' }));
  const h = home(), st = h && h.stage < STEPS.length ? STEPS[h.stage] : null;
  const pp = panel(`<h2>${name.split(' ')[1]}<small>${name.split(' ')[0]}</small></h2><p class="sub">${line}　身上：<b>${A.G.money}</b> 文</p>
    ${st ? `<p class="sub">🏗 你的下一步「${st[0]}」需要：${Object.entries(st[2]).map(([kk, n]) => `${matN(kk)} ${A.P.bag('mat')[kk] || 0}/${n}`).join('、')}</p>` : ''}
    <div class="mlist">${items.map(it => `<div class="mrow"><span>${it.n}${it.note ? ` <small>${it.note}</small>` : ''}</span><span>持有 ${A.P.bag(it.cat)[it.id] || 0}</span><span>${it.p} 文</span><button data-b="${it.id}" data-c="${it.cat}" data-p="${it.p}">買 1</button></div>`).join('')}</div>
    ${k === 'zai' ? '<div class="btns"><button id="hJob" class="big alt">🔨 大工助手打工（幫忙刨木頭）</button></div>' : ''}`);
  pp.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const p = +b.dataset.p; if (!A.afford(p)) return A.toast('錢不夠喔'); A.addMoney(-p, ''); A.P.bagAdd(b.dataset.c, b.dataset.b, 1); A.P.ev(b.dataset.c === 'furn' ? 'furn' : 'mat', { k: b.dataset.b, dex: b.dataset.c === 'furn' ? 'furn' : null }); openStore(k); });
  const j = pp.querySelector('#hJob'); if (j) j.onclick = () => { A.closePanels(); buildGame('大工助手：刨木頭', 'tap', 5, q => { const pay = Math.round(q * 40); A.addMoney(pay, '大工工錢'); A.P.ev('job', { k: 'daiku', q }); A.toast(`工頭：「${q >= .8 ? '手藝不錯嘛！' : q >= .4 ? '還行，明天再來。' : '……木頭都刨壞了。'}」`, 3000); }); };
}

export function initHome(api) {
  A = api;
  A.P.addDexCat('furn', '🏮 家具', FURN.map(f => ({ k: f[0], n: f[1] })));
  rebuild();
}
export const homeState = () => home();
export const remoteList = () => remObjs.map(o => ({ plot: o.plot, n: o.n }));
