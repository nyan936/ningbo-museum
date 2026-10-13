// horizon.js —— 远景：水墨远山（三层） + 北面（城市方向）的现代天际线 + 地平线雾带 + 树带
//  远山用顶点色手工做空气透视并 fog:false：交给场景雾的话，暖雾会把山染成和天空同一片，层次全丢。
//  最外层再补一条竖直雾带与一圈树带，把地面和山"接"起来（否则远山像一条纸板贴在天地之间）。
import * as THREE from 'three';
import { toonMat, mergeGeos, boxG, sphG, paint, mulberry32, lerp, clamp, TAU } from './base.js';
import { cityFacadeTexture } from './base.js';
import { cityLightsTexture } from './surfaces.js';

const RIDGE_LAYERS = [
  { r: 470, h: 40, base: 0x424e66, top: 0x8699b6, seg: 170, seed: 11 },
  { r: 585, h: 60, base: 0x4d5d79, top: 0x96a9c4, seg: 155, seed: 27 },
  { r: 695, h: 78, base: 0x596885, top: 0xa5b6cf, seg: 140, seed: 43 },
  { r: 790, h: 94, base: 0x66748f, top: 0xb4c3d8, seg: 125, seed: 61 },
];

function ridgeProfile(seed, n) {
  const R = mulberry32(seed);
  const comps = [];
  for (let i = 0; i < 9; i++) comps.push({ k: 2 + i * 2.7 + R() * 1.6, ph: R() * TAU, amp: 1 / (1 + i * 0.62) });
  const out = [];
  let max = 0.001;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    let s = 0;
    for (const c of comps) s += Math.sin(a * c.k + c.ph) * c.amp;
    s = 0.5 + 0.5 * s * 0.62;
    const v = Math.pow(clamp(s, 0, 1), 1.55);
    out.push(v);
    if (v > max) max = v;
  }
  return out.map((v) => v / max);
}

export function buildHorizon() {
  const group = new THREE.Group();
  group.name = 'horizon';
  const R = mulberry32(0x88AA);

  // ---------------- 水墨远山：竖直幕布 ----------------
  const hillMats = [];
  RIDGE_LAYERS.forEach((layer, li) => {
    const prof = ridgeProfile(layer.seed, layer.seg);
    const pos = [], col = [], idx = [];
    const cBase = new THREE.Color(layer.base), cTop = new THREE.Color(layer.top);
    for (let i = 0; i <= layer.seg; i++) {
      const a = (i / layer.seg) * TAU;
      const x = Math.cos(a) * layer.r, z = Math.sin(a) * layer.r;
      const h = layer.h * (0.34 + 0.66 * prof[i % layer.seg]) * (0.78 + 0.42 * R());
      pos.push(x, -3, z, x, h, z);
      // 山脚 alpha→0（渐隐进地面雾里，杜绝天地之间的硬线），山脊才是不透明的本色
      const cb = cBase.clone().lerp(cTop, 0.55);
      col.push(cb.r, cb.g, cb.b, 0.0);
      const ct = cBase.clone().lerp(cTop, 0.15);
      col.push(ct.r, ct.g, ct.b, 1.0);
    }
    for (let i = 0; i < layer.seg; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 4));   // RGBA：顶点 alpha 做渐隐
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, fog: false, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    }));
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.renderOrder = -3 + li;
    group.add(mesh);
    hillMats.push(mesh.material);
  });

  // ---------------- 树带：远山脚下的一圈深绿（接住地面，避免"草地直插远山"）----------------
  {
    const parts = [];
    for (let i = 0; i < 700; i++) {
      const a = R() * TAU;
      const rad = 470 + R() * 90;
      const s = 4 + R() * 6;
      const blobs = 2 + Math.floor(R() * 3);
      for (let b = 0; b < blobs; b++) {
        const g = sphG(s * (0.7 + R() * 0.5), 0, 0, 0, 6);
        g.scale(1.25, 0.8, 1.25);
        g.translate(Math.cos(a) * rad + (R() - 0.5) * s * 3.4, s * 0.7 + R() * 2, Math.sin(a) * rad + (R() - 0.5) * s * 3.4);
        parts.push(paint(g, new THREE.Color(R() > 0.5 ? 0x51704a : 0x5b7a52).offsetHSL(0, 0, R() * 0.05)));
      }
    }
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    const mesh = new THREE.Mesh(mergeGeos(parts), mat);
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.renderOrder = -1;
    group.add(mesh);
    hillMats.push(mat);
  }

  // ---------------- 北面现代天际线（在山脊之外拔起，只露塔尖）----------------
  const cityTex = cityFacadeTexture();
  cityTex.repeat.set(2, 3);
  const cityMat = toonMat({ map: cityTex, color: 0xb4c1d2, fog: false,
    emissiveMap: cityLightsTexture(), emissive: 0xffcf8a, emissiveIntensity: 0 });   // 夜里点窗（agy V6）
  {
    const parts = [];
    const placed = [];
    for (let i = 0; i < 34; i++) {
      let ok = false, x = 0, z = 0, w = 0, d = 0, h = 0;
      for (let t = 0; t < 24 && !ok; t++) {
        const a = -2.85 + R() * 2.3;
        const rad = 1010 + R() * 210;
        w = 26 + R() * 46; d = 26 + R() * 42;
        h = 30 + R() * 66;
        x = Math.cos(a) * rad; z = Math.sin(a) * rad;
        ok = placed.every((q) => Math.hypot(q.x - x, q.z - z) > (Math.max(q.w, q.d) + Math.max(w, d)) * 0.5 + 16);
      }
      if (!ok) continue;
      placed.push({ x, z, w, d });
      parts.push(boxG(w, h, d, x, h / 2 - 3, z));
      if (R() > 0.5) parts.push(boxG(w * 0.4, 10 + R() * 24, d * 0.4, x, h - 3 + 6, z));
    }
    const city = new THREE.Mesh(mergeGeos(parts), cityMat);
    city.castShadow = false; city.receiveShadow = false;
    city.renderOrder = -2;
    group.add(city);
  }

  return {
    group,
    update(st) {
      // 夜色下远山必须一起压暗（否则"十米外的草看不见、五公里外的山却亮着"）
      const k = lerp(0.11, 1.0, st.dayF);
      const warm = st.goldenF;
      for (const m of hillMats) {
        if (m.vertexColors) m.color.setRGB(k * (0.94 + warm * 0.10), k * 0.96, k * (1.04 - warm * 0.06));
        else m.color.setHex(0x46543f).multiplyScalar(lerp(0.14, 1.0, st.dayF));
      }
      cityMat.color.setHex(0x9fb0c4).lerp(st.skyHor, 0.42).multiplyScalar(lerp(0.22, 1.0, st.dayF));
      cityMat.emissiveIntensity = st.nightF * 1.15;      // 白天 0、夜里靠 emissiveMap 点亮零散窗口
    },
    tick() {},
  };
}
