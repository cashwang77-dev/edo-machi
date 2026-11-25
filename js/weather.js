// 江戶町 天氣：晴／曇／雨／雪／雷雨
// 依真實時間每 10 分鐘換一段（雜湊決定），所有玩家看到同樣天氣；換段時 60 秒漸變。
// 雨、雪粒子全部在 GPU 著色器裡動（CPU 每幀只更新幾個 uniform），跟著鏡頭無縫循環。
import * as THREE from 'three';

const SEG = 600e3, FADE = 60e3;
const QS = new URLSearchParams(location.search);
const hash = n => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822507) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
const winter = i => { const m = new Date(i * SEG + 8 * 3600e3).getUTCMonth(); return m >= 10 || m <= 1; }; // 11～2 月會下雪
// 種類：0 晴 1 曇 2 雨 3 雪 4 雷雨
export const KINDS = [
  { n: '晴', icon: '☀️', c: 0, r: 0, s: 0, th: 0 },
  { n: '曇', icon: '☁️', c: .7, r: 0, s: 0, th: 0 },
  { n: '雨', icon: '🌧️', c: 1, r: .75, s: 0, th: 0 },
  { n: '雪', icon: '❄️', c: .85, r: 0, s: 1, th: 0 },
  { n: '雷雨', icon: '⛈️', c: 1, r: 1, s: 0, th: 1 },
];
export const BONUS = {
  2: '下雨了：魚比較快上鉤、稀有魚變多，田裡自動澆水。撐傘散步有經驗值',
  3: '下雪了：泡溫泉經驗值加倍，雪中撐傘散步有經驗值',
  4: '雷雨：魚群躁動，稀有魚大增！小心打雷',
};
function kindAt(i) {
  if (window.__wx != null) return window.__wx; if (QS.has('wx')) return +QS.get('wx') || 0;
  const r = hash(i);
  if (r < .48) return 0; if (r < .68) return 1;
  if (winter(i) && hash(i * 7 + 3) < .5) return 3;
  return r < .93 ? 2 : 4;
}
export const WX = { kind: 0, cloud: 0, rain: 0, snow: 0, thunder: 0, flash: 0, name: '晴', icon: '☀️', wet: 0 };
const ss = x => x * x * (3 - 2 * x);
function sample() {
  const now = Date.now(), i = Math.floor(now / SEG), f = Math.min(1, (now - i * SEG) / FADE);
  const k = kindAt(i), a = KINDS[kindAt(i - 1)], b = KINDS[k], e = window.__wx != null ? 1 : ss(f);
  WX.kind = k; WX.name = b.n; WX.icon = b.icon;
  WX.cloud = a.c + (b.c - a.c) * e; WX.rain = a.r + (b.r - a.r) * e; WX.snow = a.s + (b.s - a.s) * e; WX.thunder = a.th + (b.th - a.th) * e;
  WX.left = (i + 1) * SEG - now; WX.next = KINDS[kindAt(i + 1)];
}

const VS_RAIN = `
uniform float uT, uBox, uH, uAmt, uLen; uniform vec3 uCam;
attribute vec3 seed; attribute float e; varying float vA;
void main(){
  vec3 p; p.xz = uCam.xz + (fract(seed.xz - uCam.xz / uBox) - .5) * uBox;
  float fall = fract(seed.y - uT * 1.9);
  p.y = uCam.y - uH * .4 + fall * uH;
  p.x += e * uLen * .22; p.y += e * uLen;
  float on = step(fract(seed.x * 37.13 + seed.z * 11.7), uAmt);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vA = on * (1. - e * .7) * smoothstep(0., 3., -mv.z) * (1. - smoothstep(uBox * .35, uBox * .5, length(p.xz - uCam.xz)));
  gl_Position = projectionMatrix * mv;
}`;
const FS_RAIN = `uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * uOp); }`;
const VS_SNOW = `
uniform float uT, uBox, uH, uAmt, uPx; uniform vec3 uCam;
attribute vec3 seed; varying float vA;
void main(){
  vec3 p; p.xz = uCam.xz + (fract(seed.xz - uCam.xz / uBox) - .5) * uBox;
  float fall = fract(seed.y - uT * .055 * (.7 + seed.z * .6));
  p.y = uCam.y - uH * .4 + fall * uH;
  float w = uT * (.6 + seed.z) + seed.x * 40.;
  p.x += sin(w) * .6; p.z += cos(w * .8) * .45;
  float on = step(fract(seed.x * 37.13 + seed.z * 11.7), uAmt);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vA = on * smoothstep(.5, 2.5, -mv.z);
  gl_PointSize = uPx * (.6 + seed.z * .8) / max(.5, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS_SNOW = `uniform vec3 uCol; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float a = smoothstep(.5, .2, length(d)); if (a * vA < .02) discard; gl_FragColor = vec4(uCol, a * vA * .9); }`;

let rain, snow, U, US, rainSnd, last = -1, flashT = 8, boltT = 0, A = null, umbT = 0, warned = false;
export function initWeather(scene, quality, api) {
  A = api;
  const n = [1200, 1800, 2800][quality] ?? 1800, box = 34, H = 20;
  { const g = new THREE.BufferGeometry(), sd = new Float32Array(n * 6), e = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); sd.set([x, y, z, x, y, z], i * 6); e[i * 2 + 1] = 1; }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 3)); g.setAttribute('e', new THREE.BufferAttribute(e, 1));
    U = { uT: { value: 0 }, uBox: { value: box }, uH: { value: H }, uAmt: { value: 0 }, uLen: { value: .8 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#c8d4e0') }, uOp: { value: .6 } };
    rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS_RAIN, fragmentShader: FS_RAIN, transparent: true, depthWrite: false }));
    rain.frustumCulled = false; rain.renderOrder = 5; rain.visible = false; scene.add(rain); }
  { const m = Math.round(n * .8), g = new THREE.BufferGeometry(), sd = new Float32Array(m * 3); for (let i = 0; i < sd.length; i++) sd[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 3));
    US = { uT: { value: 0 }, uBox: { value: 40 }, uH: { value: 18 }, uAmt: { value: 0 }, uPx: { value: 60 * Math.min(2, devicePixelRatio) }, uCam: U.uCam, uCol: { value: new THREE.Color('#ffffff') } };
    snow = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: US, vertexShader: VS_SNOW, fragmentShader: FS_SNOW, transparent: true, depthWrite: false }));
    snow.frustumCulled = false; snow.renderOrder = 5; snow.visible = false; scene.add(snow); }
  sample(); last = WX.kind;
}
export const setPx = pr => { if (US) US.uPx.value = 60 * pr; };

const GREY = new THREE.Color('#8d97a2'), GREY2 = new THREE.Color('#aab2bb'), WHITE = new THREE.Color('#ffffff'), tc = new THREE.Color();
// game.js 在 W.update 之後呼叫：把天氣疊到晝夜光線上（W.update 每幀重設，所以這裡不會累積）
export function updWeather(dt, time, W, scene, camera, inside) {
  if (!rain) return; sample();
  const c = WX.cloud, r = WX.rain, s = WX.snow, day = W.D ? Math.max(.15, Math.min(1, (W.D.hemi - .3) / .7)) : 1;
  // 雷：雷雨時每 6～16 秒閃一次，閃光後 0.4～2 秒雷聲
  flashT -= dt; if (WX.thunder > .6 && flashT < 0) { flashT = 6 + Math.random() * 10; WX.flash = 1; boltT = .4 + Math.random() * 1.6; }
  if (boltT > 0 && (boltT -= dt) <= 0) thunder();
  WX.flash = Math.max(0, WX.flash - dt * (WX.flash > .5 ? 6 : 2.5)); const fl = WX.flash > .55 || (WX.flash > .2 && WX.flash < .35) ? WX.flash : 0;
  if (W.sunLight) W.sunLight.intensity *= 1 - .75 * c;
  if (W.hemi) { W.hemi.intensity = W.hemi.intensity * (1 - .12 * c) + fl * 2.2; W.hemi.color.lerp(GREY2, .5 * c); }
  tc.copy(s > .3 ? GREY2 : GREY).multiplyScalar(.3 + .7 * day);
  if (scene.fog) { scene.fog.color.lerp(tc, .6 * c); scene.fog.density += .004 * r + .007 * s + .001 * c; }
  if (W.skyMat) { const u = W.skyMat.uniforms; u.uTop.value.lerp(tc, .75 * c); u.uBot.value.lerp(tc, .65 * c); u.uStars.value *= 1 - c; if (fl) { u.uTop.value.lerp(WHITE, fl * .35); u.uBot.value.lerp(WHITE, fl * .35); } }
  if (W.clouds) { W.clouds.material.color.multiplyScalar(1 - .45 * c); W.clouds.material.opacity = Math.min(1, W.clouds.material.opacity + .3 * c); }
  if (W.petals) W.petals.pts.visible = c < .5;
  WX.wet += ((r > .2 ? 1 : 0) - WX.wet) * Math.min(1, dt * .05);
  // 粒子
  U.uT.value = time; US.uT.value = time; U.uCam.value.copy(camera.position);
  U.uAmt.value = inside ? 0 : r; US.uAmt.value = inside ? 0 : s;
  U.uCol.value.setRGB(.55 + .3 * day, .6 + .3 * day, .66 + .3 * day).lerp(WHITE, fl * .6);
  rain.visible = U.uAmt.value > .01; snow.visible = US.uAmt.value > .01;
  // 雨聲
  const SND = A && A.SND;
  if (SND && SND.ac && SND.ac.state === 'running') {
    if (!rainSnd) { const ac = SND.ac, src = ac.createBufferSource(); src.buffer = SND.noiseBuf(); src.loop = true; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900; const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000; const g = ac.createGain(); g.gain.value = 0; src.connect(f).connect(f2).connect(g).connect(SND.sfxG); src.start(); rainSnd = g; }
    rainSnd.gain.setTargetAtTime(r * (inside ? .05 : .16), SND.ac.currentTime, .8);
  }
  // 換天氣提示
  if (WX.kind !== last && A && A.G.mode !== 'title') { last = WX.kind; A.toast(`${WX.icon} 天氣轉為「${WX.name}」${BONUS[WX.kind] ? '｜' + BONUS[WX.kind] : ''}`, 5000); warned = false; }
  // 撐傘散步：雨雪天拿著傘走路，每 45 秒 +4 經驗
  if (A && A.G.mode === 'walk' && (r > .4 || s > .4) && !inside) {
    const lk = A.G.look || {}, umb = lk.c === 2 || lk.c === 3;
    if (umb) { if ((umbT += dt) > 45) { umbT = 0; A.P.addXp(4, '雨中撐傘散步'); } }
    else if (!warned) { warned = true; setTimeout(() => A.toast('☂️ 雜貨店有賣番傘、蛇の目傘，撐傘在雨中散步可以拿經驗值', 4000), 6000); }
  }
}
function thunder() {
  const SND = A && A.SND; if (!SND || !SND.ac || !SND.on.sfx) return; const ac = SND.ac, t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = SND.noiseBuf(); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.2);
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.9, t + .05); g.gain.exponentialRampToValueAtTime(.3, t + .5); g.gain.exponentialRampToValueAtTime(.001, t + 2.6);
  s.loop = true; s.connect(f).connect(g).connect(SND.sfxG); s.start(t); s.stop(t + 2.8);
}
export const isWet = () => WX.rain > .4;
