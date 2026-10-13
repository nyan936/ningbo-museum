// main.js —— 宁波博物馆 · 卡通三维场景：装配、光照、相机、UI、自检 API
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dayState, clamp, lerp, V3 } from './base.js';
import { buildSky } from './sky.js';
import { buildHorizon } from './horizon.js';
import { buildWorld } from './world.js';
import { buildWater } from './water.js';
import { buildMuseum } from './museum.js';
import { buildProps } from './props.js';
import { buildPost } from './post.js';

// ---------------- 渲染器 ----------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// 江南水汽：近景锐利、远景朦胧（必须线性雾，FogExp2 会把近景一起洗白）
scene.fog = new THREE.Fog(0xc8d6dc, 150, 820);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.4, 9000);
camera.position.set(-104, 44, 136);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(-6, 9, -2);
controls.minDistance = 12;
controls.maxDistance = 620;
controls.minPolarAngle = 0.10;
controls.maxPolarAngle = Math.PI - 0.02;
controls.update();

// ---------------- 光照 ----------------
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 1000;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.07;
scene.add(sun, sun.target);

const moon = new THREE.DirectionalLight(0xa8c4ff, 0.0);
scene.add(moon, moon.target);

const hemi = new THREE.HemisphereLight(0xdcecfa, 0x93a074, 0.6);
scene.add(hemi);

const amb = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(amb);

const fill = new THREE.DirectionalLight(0xffffff, 0.2);
scene.add(fill, fill.target);

// ---------------- 场景模块 ----------------
const sky = buildSky();
const horizon = buildHorizon();
const world = buildWorld();
const water = buildWater();
const museum = buildMuseum();
const props = buildProps();
const mods = [sky, horizon, world, museum, water, props];
for (const m of mods) scene.add(m.group);

// 反射期间隐藏大量小物件（水里的倒影几乎看不见它们，却很吃三角形）
water.hideDuringReflect.push(...world.hideDuringReflect, ...props.hideDuringReflect, ...museum.hideDuringReflect);

const post = buildPost(renderer, scene, camera);
// 法线通道（描边用）里隐藏天空/远山/水面/草木：省掉一次反射渲染，也免了草叶的噪点边
post.setHideForNormal([sky.group, horizon.group, water.reflector, ...water.hideDuringReflect, ...props.hideDuringReflect, ...museum.hideDuringReflect]);

// ---------------- 环境反射贴图（随昼夜重建，节流）----------------
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
let envHour = -99;
let prevEnvRT = null;
function refreshEnv(st) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 32;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 32);
  grd.addColorStop(0.0, '#' + st.skyTop.getHexString());
  grd.addColorStop(0.48, '#' + st.skyHor.getHexString());
  grd.addColorStop(0.52, '#' + st.skyHor.clone().multiplyScalar(0.9).getHexString());
  grd.addColorStop(1.0, '#' + new THREE.Color(0x6b6a5c).multiplyScalar(lerp(0.16, 1.0, st.dayF)).getHexString());
  g.fillStyle = grd; g.fillRect(0, 0, 64, 32);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const rt = pmrem.fromEquirectangular(tex);
  if (prevEnvRT) prevEnvRT.dispose();
  prevEnvRT = rt;
  scene.environment = rt.texture;
  scene.environmentIntensity = 0.45;
  tex.dispose();
  envHour = st.hour;
}

// ---------------- 状态与相机预设 ----------------
const state = {
  hour: 16.4,
  exposure: 0.98,
  autoOrbit: false,      // 默认关闭自动环绕
  bloom: true,
  shadows: true,
  people: true,
  outline: false,       // 默认关闭卡通描边
  water: true,
  quality: 'high',
  cam: 'hero',
  fps: 0,
};
const CAMS = {
  hero: { label: '全景', pos: [-104, 44, 136], tgt: [-6, 9, -2] },
  portal: { label: '裂口', pos: [-164, 7.6, 2.0], tgt: [-48, 7.0, 0] },
  valley: { label: '山谷台阶', pos: [13.6, 15, 98], tgt: [13.6, 8, 14] },
  wall: { label: '瓦爿墙', pos: [-30, 4.8, -45.3], tgt: [-29, 8.8, -32.5] },
  water: { label: '水岸', pos: [-118, 3.6, 32], tgt: [-88, 6.0, -12] },
  ridge: { label: '屋脊', pos: [-56, 45, -28], tgt: [-6, 20, 4] },
  aerial: { label: '鸟瞰', pos: [-126, 152, 156], tgt: [0, 4, 0] },
  night: { label: '夜色', pos: [-96, 34, 118], tgt: [-6, 9, 0] },
  walk:  { label: '漫步', pos: [13.6, 1.65, 62], tgt: [13.6, 3.4, 22] },   // 行人视高 1.65m，沿山谷轴线看大台阶
};
const _fillDir = V3(), _up70 = V3(0, 70, 0);   // 补光灯用的静态临时向量
const camTween = { active: false, t: 0, dur: 1.25, fromPos: V3(), toPos: V3(), fromTgt: V3(), toTgt: V3() };
function setCam(name) {
  const c = CAMS[name];
  if (!c) return;
  state.cam = name;
  if (name === 'night') setHour(19.8);
  camTween.fromPos.copy(camera.position);
  camTween.fromTgt.copy(controls.target);
  camTween.toPos.set(...c.pos);
  camTween.toTgt.set(...c.tgt);
  camTween.t = 0;
  camTween.active = true;
  state.autoOrbit = false;
  syncUI();
}
function jumpCam(name) {
  const c = CAMS[name];
  if (!c) return;
  state.cam = name;
  camTween.active = false;
  camera.position.set(...c.pos);
  controls.target.set(...c.tgt);
  state.autoOrbit = false;
  camera.updateMatrixWorld(true);
  syncUI();
}
function setHour(h) {
  state.hour = ((h % 24) + 24) % 24;
  const el = document.getElementById('hour');
  if (el) el.value = String(state.hour);
  syncUI();
  applyDay(dayState(state.hour));
}

let orbitA = Math.atan2(camera.position.z - controls.target.z, camera.position.x - controls.target.x);
let orbitR = 0;

// ---------------- 光照随昼夜 ----------------
function updateLights(st) {
  const se = Math.max(0, st.se);
  sun.intensity = (0.62 + 2.35 * Math.pow(se, 0.42)) * st.dayF + st.goldenF * 0.30;
  sun.color.copy(st.sunColor);
  sun.position.copy(st.sunDir).multiplyScalar(340);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = state.shadows && st.dayF > 0.03;
  sun.shadow.intensity = clamp(0.12 + se * 2.4, 0, 1) * 0.92;

  moon.intensity = st.nightF * 0.42;
  moon.position.copy(st.moonDir).multiplyScalar(340);
  moon.target.position.set(0, 0, 0);

  const hemiDay = st.skyHor.clone().lerp(new THREE.Color(0xffffff), 0.48);
  hemi.color.copy(hemiDay).lerp(new THREE.Color(0x4d6fa8), st.nightF);
  hemi.groundColor.setHex(0xa8b48a).lerp(new THREE.Color(0xc9a878), st.goldenF).lerp(new THREE.Color(0x2b3550), st.nightF);
  hemi.intensity = 0.26 + 0.62 * st.dayF + 0.55 * st.goldenF + 1.00 * st.nightF;

  amb.intensity = 0.15 + 0.12 * st.dayF + 0.24 * st.goldenF + 0.48 * st.nightF;

  _fillDir.copy(camera.position).sub(controls.target).normalize();   // 不再每帧 clone（消除 GC 抖动）
  fill.position.copy(controls.target).add(_fillDir.multiplyScalar(130)).add(_up70);
  fill.target.position.copy(controls.target);
  fill.intensity = (0.10 + 0.18 * st.dayF) * (1 - st.nightF * 0.40);
  fill.color.copy(st.skyHor).lerp(new THREE.Color(0xffffff), 0.5);
}

let _st = null;
function applyDay(st) {
  _st = st;
  scene.fog.color.copy(st.fogColor).lerp(new THREE.Color(0xffffff), 0.12);
  updateLights(st);
  for (const m of mods) m.update(st);
  renderer.toneMappingExposure = state.exposure * st.exposure;
  post.update(time, st);
  if (Math.abs(state.hour - envHour) > 0.4) refreshEnv(st);
}

// ---------------- 每帧 ----------------
let time = 0, last = performance.now(), fpsAcc = 0, fpsN = 0;
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { state.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }

  const st = dayState(state.hour);

  if (camTween.active) {
    camTween.t += dt;
    const k = clamp(camTween.t / camTween.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
    controls.target.lerpVectors(camTween.fromTgt, camTween.toTgt, e);
    if (k >= 1) camTween.active = false;
  } else if (state.autoOrbit) {
    const tgt = controls.target;
    if (!orbitR) orbitR = camera.position.distanceTo(tgt);
    orbitA += dt * 0.05;
    const h = 42 + Math.sin(time * 0.11) * 12;
    camera.position.set(tgt.x + Math.cos(orbitA) * orbitR, tgt.y + h, tgt.z + Math.sin(orbitA) * orbitR);
    camera.lookAt(tgt);
  }
  controls.enabled = !state.autoOrbit && !camTween.active;
  controls.update();
  if (camera.position.y < 1.4) camera.position.y = 1.4;

  for (const m of mods) if (m.tick) m.tick(time, dt, st);
  sky.tickMeteor(dt, st);
  applyDay(st);
  post.render();

  const hud = document.getElementById('hud');
  if (hud && fpsN === 1) hud.textContent = `${state.fps} fps`;
  requestAnimationFrame(frame);
}

// ---------------- UI ----------------
const TOGGLES = {
  orbit: (v) => { state.autoOrbit = v; if (v) orbitR = 0; },
  bloom: (v) => { state.bloom = v; post.setBloom(v); },
  shadows: (v) => { state.shadows = v; },
  people: (v) => { state.people = v; props.crowd.group.visible = v; },
  outline: (v) => { state.outline = v; post.setOutline(v); post.outline.enabled = v; },
  water: (v) => { state.water = v; water.group.visible = v; },
  quality: (v) => {
    state.quality = v ? 'high' : 'low';
    renderer.setPixelRatio(v ? Math.min(devicePixelRatio, 1.75) : 1.0);
    const rt = water.reflector.getRenderTarget();
    rt.setSize(v ? 1024 : 384, v ? 1024 : 384);
    sun.shadow.mapSize.set(v ? 2048 : 1024, v ? 2048 : 1024);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    post.setSize(innerWidth, innerHeight);
  },
};
function syncUI() {
  document.querySelectorAll('[data-cam]').forEach((b) => b.classList.toggle('on', b.dataset.cam === state.cam));
  document.querySelectorAll('[data-toggle]').forEach((b) => {
    const k = b.dataset.toggle;
    if (k === 'quality') b.classList.toggle('on', state.quality === 'high');
    else if (k === 'orbit') b.classList.toggle('on', state.autoOrbit);
    else b.classList.toggle('on', !!state[k]);
  });
  document.querySelectorAll('[data-hour]').forEach((b) => b.classList.toggle('on', Math.abs(parseFloat(b.dataset.hour) - state.hour) < 0.06));
  const hl = document.getElementById('hourLabel');
  if (hl) {
    const h = Math.floor(state.hour), m = Math.floor((state.hour - h) * 60);
    hl.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const el = document.getElementById('hour');
  if (el && Math.abs(parseFloat(el.value) - state.hour) > 0.001) el.value = String(state.hour);
}
function bindUI() {
  const el = document.getElementById('hour');
  if (el) { el.value = String(state.hour); el.addEventListener('input', () => setHour(parseFloat(el.value))); }
  const ex = document.getElementById('exposure');
  if (ex) {
    ex.value = String(state.exposure);
    ex.addEventListener('input', () => {
      state.exposure = parseFloat(ex.value);
      const lab = document.getElementById('expLabel');
      if (lab) lab.textContent = state.exposure.toFixed(2);
      applyDay(dayState(state.hour));
    });
  }
  document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
  document.querySelectorAll('[data-hour]').forEach((b) => b.addEventListener('click', () => setHour(parseFloat(b.dataset.hour))));
  document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.toggle;
    const cur = k === 'quality' ? state.quality === 'high' : (k === 'orbit' ? state.autoOrbit : state[k]);
    TOGGLES[k](!cur);
    syncUI();
  }));
  controls.addEventListener('start', () => { state.autoOrbit = false; camTween.active = false; syncUI(); });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight);
  });
}
bindUI();
{
  const q = new URLSearchParams(location.search);
  if (q.has('hour')) { const h = parseFloat(q.get('hour')); if (Number.isFinite(h)) setHour(h); }
  if (q.has('cam') && CAMS[q.get('cam')]) { jumpCam(q.get('cam')); state.autoOrbit = q.get('orbit') === '1'; }
  TOGGLES.outline(state.outline);   // 把默认值真正落到 pass 上
  if (q.get('outline') === '1') TOGGLES.outline(true);
  if (q.get('ui') === '0') for (const id of ['dock', 'brand', 'cams', 'hudwrap', 'scrim']) document.getElementById(id)?.style.setProperty('display', 'none');
}
syncUI();
addEventListener('keydown', (e) => {
  if (e.key === 'o' || e.key === 'O') { TOGGLES.orbit(!state.autoOrbit); syncUI(); }
  if (e.key === 'h' || e.key === 'H') { document.getElementById('dock')?.classList.toggle('hide'); }
});

// ---------------- 自检 API ----------------
function stats() {
  let tris = 0, meshes = 0, visibleTris = 0;
  scene.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    meshes++;
    const g = o.geometry;
    const c = g.index ? g.index.count : g.getAttribute('position')?.count || 0;
    let n = c / 3;
    if (o.isInstancedMesh) n *= o.count;
    tris += n;
    if (o.visible && o.parent?.visible) visibleTris += n;
  });
  const gl = renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    fps: state.fps,
    tris_total: Math.round(tris),
    tris_visible_upper_bound: Math.round(visibleTris),
    meshes,
    programs: renderer.info.programs?.length ?? 0,
    calls_last_pass: renderer.info.render.calls,
    hour: state.hour,
    cam: state.cam,
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    size: [renderer.domElement.width, renderer.domElement.height],
    pixelRatio: renderer.getPixelRatio(),
  };
}

let _buf = null, _bw = 0, _bh = 0;
function readBuf() {
  const gl = renderer.getContext();
  const w = renderer.domElement.width, h = renderer.domElement.height;
  if (!_buf || _bw !== w || _bh !== h) { _buf = new Uint8Array(w * h * 4); _bw = w; _bh = h; }
  for (let i = 0; i < 3; i++) post.render();
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, _buf);
  return { d: _buf, w, h };
}
function sample() {
  const buf = readBuf();
  const stepX = Math.max(1, Math.floor(buf.w / 120)), stepY = Math.max(1, Math.floor(buf.h / 68));
  let sum = [0, 0, 0], n = 0, black = 0, over = 0;
  const grid = Array.from({ length: 9 }, () => [0, 0, 0, 0]);
  for (let iy = 0; iy < buf.h; iy += stepY) {
    for (let ix = 0; ix < buf.w; ix += stepX) {
      const i = (iy * buf.w + ix) * 4;
      const r = buf.d[i], g = buf.d[i + 1], b = buf.d[i + 2];
      sum[0] += r; sum[1] += g; sum[2] += b; n++;
      if (r + g + b < 24) black++;
      if (r > 250 && g > 250 && b > 250) over++;
      const nx = ix / buf.w, ny = 1 - iy / buf.h;
      const gi = Math.min(2, Math.floor(ny * 3)) * 3 + Math.min(2, Math.floor(nx * 3));
      grid[gi][0] += r; grid[gi][1] += g; grid[gi][2] += b; grid[gi][3]++;
    }
  }
  const g2 = grid.map(([r, gg, b, c]) => [Math.round(r / c), Math.round(gg / c), Math.round(b / c)]);
  return {
    mean: sum.map((v) => Math.round(v / n)),
    blackPct: +(100 * black / n).toFixed(2),
    overPct: +(100 * over / n).toFixed(2),
    grid: [g2.slice(0, 3), g2.slice(3, 6), g2.slice(6, 9)],
  };
}
function regionMean(x0, y0, x1, y1) {
  const buf = readBuf();
  const X0 = Math.max(0, Math.floor(x0 * buf.w)), X1 = Math.min(buf.w, Math.ceil(x1 * buf.w));
  const Y0 = Math.max(0, Math.floor(y0 * buf.h)), Y1 = Math.min(buf.h, Math.ceil(y1 * buf.h));
  const stepX = Math.max(1, Math.floor((X1 - X0) / 60)), stepY = Math.max(1, Math.floor((Y1 - Y0) / 60));
  let s = [0, 0, 0], n = 0;
  for (let y = Y0; y < Y1; y += stepY) {
    const iy = buf.h - 1 - y;
    for (let x = X0; x < X1; x += stepX) {
      const i = (iy * buf.w + x) * 4;
      s[0] += buf.d[i]; s[1] += buf.d[i + 1]; s[2] += buf.d[i + 2]; n++;
    }
  }
  return n ? s.map((v) => Math.round(v / n)) : [0, 0, 0];
}
window.__DBG__ = { Raycaster: THREE.Raycaster, Vector2: THREE.Vector2, Vector3: THREE.Vector3 };
window.__SCENE__ = {
  state, CAMS, setHour, setCam, jumpCam, stats, sample, regionMean, TOGGLES, syncUI, applyDay,
  scene, camera, renderer, controls, post, mods, water, props, museum, sky, horizon, world,
};

refreshEnv(dayState(state.hour));
requestAnimationFrame(frame);
window.__READY__ = true;
