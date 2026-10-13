// props.js —— 场景里的"人味儿"：游客、香樟树阵、竹丛、垂柳、芦苇、草坪、荷叶、长椅、
//  路灯、展旗、小木船、锦鲤、飞鸟、台阶上的猫、广场鸽
//  全部程序化生成；会动的都挂在 tick() 里，保证"打开就在动"。
import * as THREE from 'three';
import {
  NC, toonMat, lightPoolTexture, mergeGeos, prismG, boxG, rboxG, cylG, sphG, coneG,
  paint, meshOf, mulberry32, clamp, lerp, TAU,
} from './base.js';
import { bannerTexture, museumSignTexture, signboardTexture, graniteTexture, siteMapTexture } from './surfaces.js';
import { L, WATER_Y } from './world.js';
import { M, STAIR, stairY } from './museum.js';

const FWD = (dx, dz) => Math.atan2(dx, dz);   // 约定：模型正面朝 +z
const SKIN = [0xf6cda6, 0xe6b58c, 0xcf9a6e, 0xa9744c];
const HAIR = [0x33261f, 0x4a3226, 0x1f1d22, 0x6b4a35];
const CLOTH = [0xe8604f, 0x4a86d8, 0xf2c14e, 0x8f5fc0, 0x3fb08a, 0xf2f0e8, 0xe97cae, 0x4d5b78, 0xefa24c, 0x63c3d8, 0xd9d3c4];
const PANTS = [0x3c4658, 0x5a5348, 0x2f3a46, 0x6d6355, 0x8a8578];

export function buildProps() {
  const group = new THREE.Group();
  group.name = 'props';
  const hideDuringReflect = [];
  const R = mulberry32(0x9E07);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const pk = (arr) => arr[Math.floor(R() * arr.length)];
  const add = (m) => { group.add(m); return m; };

  const wind = { value: 0 };
  const withWind = (mat, amp = 1, ref = 1.2) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iw = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 iw = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        #endif
        float ph = iw.x * 0.37 + iw.z * 0.29;
        float sway = sin(uWind * 1.35 + ph) * 0.6 + sin(uWind * 2.6 + ph * 1.7) * 0.3;
        float kw = pow(clamp(transformed.y / ${ref.toFixed(2)}, 0.0, 1.5), 1.8);
        transformed.x += sway * ${(0.18 * amp).toFixed(3)} * kw;
        transformed.z += sway * ${(0.13 * amp).toFixed(3)} * kw;`,
      );
    };
    return mat;
  };

  // ============================================================
  // 1. 游客
  // ============================================================
  function personGeo(cfg) {
    const { kind = 'walk', cloth, skin, hair, pants, scale = 1 } = cfg;
    const parts = [];
    const stride = kind === 'walk' ? 0.13 : 0;
    for (const s of [-1, 1]) {
      const dx = s * 0.095;                       // 两腿并排（x 向分开）
      const dz = s * stride;                      // 迈步只在 z 向小幅错开
      const leg = boxG(0.135, 0.80, 0.16, dx, 0.45, dz);
      if (kind === 'sit') leg.translate(0, -0.20, 0.18);
      parts.push(paint(leg, pants));
      parts.push(paint(boxG(0.155, 0.09, 0.27, dx, 0.05, dz + (kind === 'sit' ? 0.32 : 0.03)), 0x2c2c30));
    }
    parts.push(paint(rboxG(0.40, 0.60, 0.235, 0, 1.13, 0, 0.1, 2), cloth));
    parts.push(paint(sphG(0.15, 0, 1.43, 0, 10), cloth));
    const photo = kind === 'photo';
    for (const s of [-1, 1]) {
      if (photo) {
        const arm = boxG(0.095, 0.52, 0.115, 0, 0, 0);
        arm.rotateX(-0.55);
        arm.translate(s * 0.2, 1.5, -0.14);
        parts.push(paint(arm, cloth));
        parts.push(paint(sphG(0.055, s * 0.2, 1.76, -0.26, 8), skin));
      } else {
        const arm = boxG(0.095, 0.52, 0.115, 0, 0, 0);
        arm.rotateZ(s * 0.06);
        arm.translate(s * 0.235, 1.14, 0);
        parts.push(paint(arm, cloth));
        parts.push(paint(sphG(0.055, s * 0.235, 0.89, 0, 8), skin));
      }
    }
    if (photo) parts.push(paint(boxG(0.09, 0.16, 0.02, 0, 1.76, -0.3), 0x22262b));
    parts.push(paint(sphG(0.125, 0, 1.60, 0, 12), skin));
    const cap = sphG(0.132, 0, 1.66, 0, 12);
    cap.scale(1.0, 0.84, 1.0);
    parts.push(paint(cap, hair));
    if (scale !== 1) for (const p of parts) p.scale(scale, scale, scale);
    return mergeGeos(parts);
  }

  // 坐姿（长椅上的人）：脚落地、髋在座面上
  function sittingPersonGeo(cfg) {
    const { cloth, skin, hair, pants, scale = 1 } = cfg;
    const parts = [];
    for (const sgn of [-1, 1]) {
      parts.push(paint(boxG(0.15, 0.15, 0.44, sgn * 0.1, 0.45, 0.2), pants));      // 大腿
      parts.push(paint(boxG(0.14, 0.44, 0.15, sgn * 0.1, 0.23, 0.4), pants));      // 小腿
      parts.push(paint(boxG(0.16, 0.08, 0.26, sgn * 0.1, 0.05, 0.44), 0x2c2c30));  // 鞋
      const arm = boxG(0.09, 0.42, 0.1, 0, 0, 0);
      arm.rotateX(0.25);
      arm.translate(sgn * 0.23, 0.78, 0.06);
      parts.push(paint(arm, cloth));
      parts.push(paint(sphG(0.055, sgn * 0.23, 0.58, 0.16, 8), skin));
    }
    parts.push(paint(rboxG(0.38, 0.56, 0.24, 0, 0.76, 0, 0.1, 2), cloth));
    parts.push(paint(sphG(0.12, 0, 1.16, 0, 12), skin));
    const cap = sphG(0.126, 0, 1.22, 0, 12);
    cap.scale(1.0, 0.84, 1.0);
    parts.push(paint(cap, hair));
    if (scale !== 1) for (const p of parts) p.scale(scale, scale, scale);
    return mergeGeos(parts);
  }

  const crowd = { group: new THREE.Group(), walkers: [] };
  group.add(crowd.group);
  {
    const paths = [];
    for (let i = 0; i < 5; i++) {
      const z = rr(-4.6, 4.6);
      paths.push({ p0: [L.weir.x0 + 3, z], p1: [L.weir.x1 - 3, z], y0: L.weir.y, y1: L.weir.y, speed: rr(0.5, 0.85) });
    }
    for (let i = 0; i < 4; i++) {
      const z = rr(-40, 46);
      paths.push({ p0: [-82.5, z], p1: [-76.5, z], y0: 0.06, y1: 0.06, speed: rr(0.35, 0.65) });
    }
    for (let i = 0; i < 6; i++) {
      const z = rr(-140, -64);
      const x0 = -110 + rr(-25, 25), x1 = 60 + rr(-25, 25);
      paths.push({ p0: [x0, z], p1: [x1, z], y0: 0.06, y1: 0.06, speed: rr(0.5, 0.95) });
    }
    const CA = M.canyon;
    for (let i = 0; i < 4; i++) {                       // 台阶上的行人：y 由 stairY(z) 贴地
      const x = rr(CA.x0 + 1.3, CA.x1 - 1.3);
      const za = STAIR.zStart - rr(1, 8), zb = STAIR.zStart - rr(16, 25);
      paths.push({ p0: [x, za], p1: [x, zb], y0: stairY(za), y1: stairY(zb), speed: rr(0.55, 0.85), onStair: true });
    }
    for (let i = 0; i < 3; i++) {
      const z = rr(-40, 30);
      paths.push({ p0: [-192 + rr(0, 18), z], p1: [-142, z + rr(-6, 6)], y0: 0.06, y1: 0.06, speed: rr(0.45, 0.75) });
    }
    const mat = toonMat({ vertexColors: true });
    for (const p of paths) {
      const g = personGeo({
        kind: R() > 0.86 ? 'photo' : 'walk', cloth: pk(CLOTH), skin: pk(SKIN),
        hair: pk(HAIR), pants: pk(PANTS), scale: rr(0.92, 1.06),
      });
      const m = meshOf(g, mat);
      crowd.group.add(m);
      crowd.walkers.push({ mesh: m, ...p, phase: R() });
    }
    for (let i = 0; i < 7; i++) {
      const kind = R() > 0.45 ? 'photo' : 'stand';
      const g = personGeo({ kind, cloth: pk(CLOTH), skin: pk(SKIN), hair: pk(HAIR), pants: pk(PANTS), scale: rr(0.9, 1.05) });
      const m = meshOf(g, mat);
      m.position.set(rr(-26, 50), 0.06, rr(37, 47));   // 站姿别落进石凳里
      m.rotation.y = FWD(rr(-1, 1), -1);
      crowd.group.add(m);
    }
    for (let i = 0; i < 3; i++) {                       // 站在堰顶看水的人
      const g = personGeo({ kind: i === 0 ? 'photo' : 'stand', cloth: pk(CLOTH), skin: pk(SKIN), hair: pk(HAIR), pants: pk(PANTS), scale: rr(0.92, 1.04) });
      const m = meshOf(g, mat);
      m.position.set(rr(-126, -86), L.weir.y, rr(-5, 5));
      m.rotation.y = FWD(0, 1);
      crowd.group.add(m);
    }
    // 长椅上的坐姿游客（椅面 0.45m，脚落地）
    for (const [bx, bz, ry] of [[-114, -62.5, 0], [-68, -62.5, 0], [-22, -62.5, 0], [24, 55, Math.PI]]) {
      const m = meshOf(sittingPersonGeo({ cloth: pk(CLOTH), skin: pk(SKIN), hair: pk(HAIR), pants: pk(PANTS), scale: rr(0.95, 1.05) }), mat);
      m.position.set(bx + rr(-0.4, 0.4), 0.06, bz);
      m.rotation.y = ry;
      crowd.group.add(m);
    }
    // 拍"山谷大台阶"的摄影者（三脚架 + 相机）
    {
      const p = meshOf(personGeo({ kind: 'photo', cloth: 0x2f3a46, skin: pk(SKIN), hair: pk(HAIR), pants: 0x3c4658, scale: 1.02 }), mat);
      p.position.set(-2.5, 0.06, 46);
      p.rotation.y = FWD(0.25, -1);
      crowd.group.add(p);
      const legM = new THREE.MeshStandardMaterial({ color: 0x6f7680, metalness: 0.5, roughness: 0.5 });
      const trip = [];
      for (const a of [0, 2.1, 4.2]) {
        const g = cylG(0.03, 0.03, 1.5, 5);
        g.rotateZ(0.13); g.rotateY(a);
        g.translate(-1.1 + Math.cos(a) * 0.16, 0.75, 45.6 + Math.sin(a) * 0.16);
        trip.push(g);
      }
      add(meshOf(mergeGeos(trip), legM));
      add(meshOf(boxG(0.3, 0.22, 0.36, -1.1, 1.6, 45.6), toonMat({ color: 0x2a2e33 })));
    }
    const kid = meshOf(personGeo({ kind: 'stand', cloth: 0xf2c14e, skin: pk(SKIN), hair: pk(HAIR), pants: 0x4a86d8, scale: 0.66 }), mat);
    kid.position.set(22.6, 0.06, 41);
    kid.rotation.y = FWD(0.4, -1);
    crowd.group.add(kid);
  }

  // ============================================================
  // 1.5 中景：远景林地 / 田埂林带（agy V7 + 我的观察：场地外 100~500m 原来是一整片纯绿"地毯"）
  // ============================================================
  {
    const matFar = toonMat({ vertexColors: true });
    const simpleTree = (h) => {
      const parts = [];
      const trunk = cylG(0.16 * h / 8, 0.22 * h / 8, h * 0.34, 5);
      trunk.translate(0, h * 0.17, 0);
      parts.push(paint(trunk, 0x6b5540));
      const n = 3;
      for (let i = 0; i < n; i++) {
        const r = h * rr(0.20, 0.30);
        const g = sphG(r, 6, 5);
        g.scale(1.15, 0.9, 1.15);
        g.translate(rr(-0.5, 0.5) * h * 0.12, h * rr(0.55, 0.82), rr(-0.5, 0.5) * h * 0.12);
        parts.push(paint(g, pk([0x4f7a44, 0x5d8a4c, 0x6d9a55, 0x476f3e])));
      }
      return mergeGeos(parts);
    };
    const groves = [
      [-300, 150, 14], [-360, 40, 12], [-250, 240, 16], [-420, -60, 10], [-180, 320, 18],
      [250, 210, 14], [330, 90, 12], [300, 320, 16], [420, -30, 10], [180, 380, 15],
      [-120, 430, 14], [60, 450, 12], [220, 470, 16], [-300, 430, 12], [420, 330, 12],
      [520, 120, 10], [-520, 220, 12], [520, 420, 14], [-460, 380, 12], [640, 200, 12],
    ];
    for (const [cx, cz, n] of groves) {
      const parts = [];
      for (let i = 0; i < n; i++) {
        const a = rr(0, TAU), rad = rr(0, 34);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        const g = simpleTree(rr(7, 13));
        g.rotateY(rr(0, TAU));
        g.translate(x, 0.05, z);
        parts.push(g);
      }
      const m = meshOf(mergeGeos(parts), matFar);
      m.position.set(cx, 0, cz);
      add(m);
    }
    // 田埂 / 防风林带：几条长条状树列，把中景切成"田地"
    const belts = [[-420, 250, 360, 250], [-100, 360, 300, 360], [140, 520, 420, 520],
      [-380, -140, -380, 120], [300, -160, 300, 120], [-520, 60, -300, 60]];
    for (const [x0, z0, x1, z1] of belts) {
      const parts = [];
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 11);
      for (let i = 0; i <= n; i++) {
        const t = n ? i / n : 0;
        const g = simpleTree(rr(6.5, 10.5));
        g.rotateY(rr(0, TAU));
        g.translate(x0 + (x1 - x0) * t + rr(-1.6, 1.6), 0.05, z0 + (z1 - z0) * t + rr(-1.6, 1.6));
        parts.push(g);
      }
      add(meshOf(mergeGeos(parts), matFar));
    }
    // 田块色差：几片低矮大色块（比纯色草地多一层"田"的信息）
    const fields = [], fieldMat = toonMat({ color: 0x9fb069 });
    const patch = (x0, z0, x1, z1, dy) => {          // 边界带随机抖动的多边形，消除"贴纸直角"（agy N8）
      const sp = new THREE.Shape();
      const N = 14;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const t = i / N * Math.PI * 2;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const rx = (x1 - x0) / 2 * rr(0.86, 1.05), rz = (z1 - z0) / 2 * rr(0.86, 1.05);
        pts.push([cx + Math.cos(t) * rx, cz + Math.sin(t) * rz]);
      }
      sp.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < N; i++) sp.lineTo(pts[i][0], pts[i][1]);
      sp.closePath();
      const g = new THREE.ShapeGeometry(sp, 1);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0.045 + dy, 0);
      fields.push(g);
    };
    patch(-430, 180, -300, 330, 0); patch(-260, 300, -60, 420, 0.004);
    patch(150, 300, 360, 430, 0.008); patch(380, 60, 560, 260, 0.006);
    patch(-560, -80, -380, 60, 0.002); patch(250, -220, 420, -60, 0.01);
    add(meshOf(mergeGeos(fields), fieldMat));
  }

  // ============================================================
  // 2. 树：香樟（树阵）/ 垂柳（水边）/ 竹丛
  // ============================================================
  function camphor(h) {
    const parts = [];
    const trunkH = h * 0.46;
    const r0 = h * 0.055;
    parts.push(paint(cylG(r0 * 0.52, r0, trunkH, 7, 0, trunkH / 2, 0), 0x7c5a3e));
    // 主枝：从树干顶端斜插进树冠，树冠不再是"浮在上面的一坨"
    const nb = ri(3, 4);
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * TAU + rr(-0.4, 0.4);
      const len = h * rr(0.20, 0.30);
      const g = cylG(r0 * 0.26, r0 * 0.6, len, 6);
      g.translate(0, len / 2, 0);
      g.rotateZ(rr(0.34, 0.60));
      g.rotateY(a);
      g.translate(0, trunkH - 0.08, 0);
      parts.push(paint(g, 0x6f5138));
    }
    // 树冠：最低一档压在树干顶端以下，向上逐层铺开
    const blobs = ri(10, 15);
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * TAU + rr(-0.5, 0.5);
      const t = (i % 3) / 2;
      const rad = h * rr(0.07, 0.21) * (1.0 - t * 0.28);
      const g = new THREE.IcosahedronGeometry(h * rr(0.10, 0.16), 0);
      g.scale(1.0, rr(0.75, 0.95), 1.0);
      g.translate(Math.cos(a) * rad, trunkH + h * rr(-0.03, 0.26) + t * h * 0.11, Math.sin(a) * rad);
      parts.push(paint(g, pk([0x6d9c52, 0x5c8a45, 0x7cae5c, 0x548040, NC.camphor])));
    }
    const top = new THREE.IcosahedronGeometry(h * 0.13, 0);
    top.scale(1, 0.85, 1);
    top.translate(0, trunkH + h * 0.44, 0);
    parts.push(paint(top, 0x74a456));
    return mergeGeos(parts);
  }
  function willow(h) {
    const parts = [];
    const trunkH = h * 0.40;
    parts.push(paint(cylG(h * 0.03, h * 0.055, trunkH, 7, 0, trunkH / 2, 0), 0x6f5238));
    // 树冠：绿色圆冠 + 若干下垂枝叶（细杆会被描边吃掉 → 用较粗的叶条）
    const dome = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rr(-0.4, 0.4);
      const g = new THREE.IcosahedronGeometry(h * rr(0.09, 0.15), 0);
      g.scale(1.1, 0.8, 1.1);
      g.translate(Math.cos(a) * h * 0.13, trunkH + h * rr(0.08, 0.22), Math.sin(a) * h * 0.13);
      dome.push(g);
    }
    parts.push(paint(mergeGeos(dome), 0x5f9147));
    for (let i = 0; i < 22; i++) {
      const a = rr(0, TAU), rad = h * rr(0.07, 0.19), len = h * rr(0.14, 0.26);
      const g = boxG(0.17, len, 0.17, 0, 0, 0);
      g.rotateZ(rr(-0.16, 0.16)); g.rotateX(rr(-0.16, 0.16));
      g.translate(Math.cos(a) * rad, trunkH + h * 0.12 - len / 2, Math.sin(a) * rad);
      parts.push(paint(g, pk([0x74a456, 0x86b662, 0x5f9147])));
    }
    return mergeGeos(parts);
  }
  function bambooClump(h) {
    const parts = [];
    const n = ri(8, 12);
    for (let i = 0; i < n; i++) {
      const a = rr(0, TAU), rad = rr(0, 1.8);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const hh = h * rr(0.55, 1.0);
      const r0 = rr(0.075, 0.11);
      const stalk = cylG(r0 * 0.76, r0, hh, 6);
      stalk.rotateZ(rr(-0.07, 0.07)); stalk.rotateX(rr(-0.07, 0.07));
      stalk.translate(x, hh / 2, z);
      parts.push(paint(stalk, pk([0xa8bb62, 0x9aae56, 0xb8c473, 0x8fa44c])));
      const nn = Math.floor(hh / 1.1);
      for (let k = 1; k < nn; k++) {
        const ring = cylG(r0 * 1.14, r0 * 1.14, 0.05, 6);
        ring.translate(x, k * 1.1, z);
        parts.push(paint(ring, 0x86994a));
      }
      for (let k = 0; k < 40; k++) {                          // 竹叶：加密（原来 26 片，远看像几根绿棍）
        const ly = hh * rr(0.55, 1.02);
        const g = boxG(0.78, 0.04, 0.15, 0, 0, 0);
        g.rotateZ(rr(-0.8, 0.8));
        g.rotateY(rr(0, TAU));
        g.translate(x + rr(-0.7, 0.7), ly, z + rr(-0.7, 0.7));
        parts.push(paint(g, pk([0x74a456, 0x86b662, 0x639246])));
      }
    }
    return mergeGeos(parts);
  }
  {
    const mat = toonMat({ vertexColors: true });
    const spots = [];
    for (let ix = 0; ix < 9; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        const x = -160 + ix * 40, z = -76 - iz * 19;
        if (x > -30 && x < 20) continue;
        spots.push([x, z, rr(9.5, 13.5)]);
      }
    }
    for (let i = 0; i < 24; i++) {
      const x = rr(-180, 180), z = rr(62, 186);
      if (x > L.lawnPath.x0 - 7 && x < L.lawnPath.x1 + 7 && z < 76) continue;
      if (Math.abs(x - 13.6) < 17 && z < 130) continue;      // 让开"山谷"轴线，别挡住正观
      spots.push([x, z, rr(8.5, 14.5)]);
    }
    for (const [x, z, h] of spots) {
      const m = meshOf(camphor(h), mat);
      m.position.set(x, 0.05, z);
      m.rotation.y = rr(0, TAU);
      add(m);
    }
    for (let i = 0; i < 9; i++) {                    // 垂柳：湖岸（避开堰顶通道 z∈[-11,11]）
      const z = rr(0, 1) < 0.5 ? rr(-44, -12) : rr(12, 48);
      const x = i % 2 ? -130.5 : -82.5;
      const m = meshOf(willow(rr(7.5, 10.5)), mat);
      m.position.set(x, 0.05, z);
      m.rotation.y = rr(0, TAU);
      add(m);
    }
    const clumps = [[-79.5, -30], [-79.5, -14], [-79.5, 26], [-79.5, 40], [-46, -40], [-18, -40], [22, -40], [58, -40],
      [-100, 60], [-40, 62], [30, 60], [96, 62], [-150, 100], [110, 104], [160, 70]];
    for (const [x, z] of clumps) {
      const m = meshOf(bambooClump(rr(6.5, 9.5)), mat);
      m.position.set(x, 0.05, z);
      add(m);
    }
    // 竹丛树池：花岗岩收边 + 深色种植土（原来竹子直接从地砖里长出来 —— agy V10）
    {
      const rings = [], soils = [];
      for (const [x, z] of clumps) {
        rings.push(prismG({ bx0: x - 2.2, bx1: x + 2.2, bz0: z - 2.2, bz1: z + 2.2, y0: -0.2, y1: 0.16 }, 1.2, 1.2, 'nswetop'));
        soils.push(prismG({ bx0: x - 1.85, bx1: x + 1.85, bz0: z - 1.85, bz1: z + 1.85, y0: 0.16, y1: 0.19 }, 1.2, 1.2, 'nswetop'));
      }
      add(meshOf(mergeGeos(rings), toonMat({ map: graniteTexture(), color: 0x9d998e })));
      add(meshOf(mergeGeos(soils), toonMat({ color: 0x4a3b2c })));
    }
  }

  // ============================================================
  // 3. 芦苇（岸边）/ 草坪草簇
  // ============================================================
  {
    const pN = L.pondN, pS = L.pondS, m = L.moatN, e = L.moatE;
    const bands = [
      [pN.x0, -47.9, pN.x1, -46.3], [pS.x0, 50.3, pS.x1, 51.9],
      [-83.7, pN.z0, -82.1, pS.z1], [-129.7, pN.z0, -128.3, pS.z1],
      [m.x0, -55.7, m.gap[0], -54.3], [m.gap[1], -55.7, m.x1, -54.3],
      [m.x0, -46.1, m.gap[0], -45.0], [m.gap[1], -46.1, m.x1, -45.0],
      [e.x1 + 0.3, e.z0, e.x1 + 1.9, e.z1], [e.x0, e.z1 + 0.3, e.x1, e.z1 + 1.9],
    ];
    const blade = (() => {
      const g = new THREE.BufferGeometry();
      const w = 0.045, h = 1;
      const pos = new Float32Array([-w, 0, 0, w, 0, 0, 0.006, h, 0, -w, 0, 0, 0.006, h, 0, -0.006, h, 0]);
      const uv = new Float32Array([0, 0, 1, 0, 0.5, 1, 0, 0, 0.5, 1, 0.5, 1]);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    })();
    const mat = withWind(toonMat({ color: 0xffffff, side: THREE.DoubleSide }), 1.5, 2.2);
    const tmp = [];
    for (const [x0, z0, x1, z1] of bands) {
      const area = Math.abs(x1 - x0) * Math.abs(z1 - z0);
      const n = Math.max(20, Math.floor(area * 0.5));
      for (let i = 0; i < n; i++) {
        const x = rr(Math.min(x0, x1), Math.max(x0, x1));
        const z = rr(Math.min(z0, z1), Math.max(z0, z1));
        const clump = ri(4, 8);
        for (let k = 0; k < clump; k++) {
          tmp.push({
            x: x + rr(-0.22, 0.22), z: z + rr(-0.22, 0.22), h: rr(0.9, 1.8),
            rot: rr(0, TAU), tilt: rr(-0.12, 0.12),
            col: new THREE.Color(pk([NC.reed, NC.reed2, 0xa8b062, 0x8f9a52])),
          });
        }
      }
    }
    const im = new THREE.InstancedMesh(blade, mat, tmp.length);
    im.castShadow = false; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const eul = new THREE.Euler();
    for (let i = 0; i < tmp.length; i++) {
      const t = tmp[i];
      p.set(t.x, 0, t.z);
      eul.set(t.tilt, t.rot, t.tilt * 0.6);
      q.setFromEuler(eul);
      s.set(1, t.h, 1);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, t.col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    add(im);
    hideDuringReflect.push(im);
  }
  {
    const tuft = (() => {
      const g = new THREE.BufferGeometry();
      const pos = [], uv = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU, w = 0.03;
        const dx = Math.cos(a) * 0.06, dz = Math.sin(a) * 0.06;
        pos.push(-w + dx, 0, dz, w + dx, 0, dz, dx + Math.cos(a) * 0.05, 0.42, dz + Math.sin(a) * 0.05);
        uv.push(0, 0, 1, 0, 0.5, 1);
      }
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      bg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
      bg.computeVertexNormals();
      return bg;
    })();
    const mat = withWind(toonMat({ color: 0xffffff, side: THREE.DoubleSide }), 0.8, 0.45);
    const N = 7000;
    const im = new THREE.InstancedMesh(tuft, mat, N);
    im.castShadow = false; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const eul = new THREE.Euler();
    const base = new THREE.Color(0x71874d);
    for (let i = 0; i < N; i++) {
      const cx = Math.round(rr(-186, 186) / 3.1) * 3.1, cz = Math.round(rr(58, 192) / 3.1) * 3.1;
      p.set(cx + rr(-0.55, 0.55), 0, cz + rr(-0.55, 0.55));
      eul.set(0, rr(0, TAU), 0);
      q.setFromEuler(eul);
      s.set(1, rr(0.6, 1.15), 1);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, base.clone().offsetHSL(rr(-0.02, 0.02), rr(-0.08, 0.08), rr(-0.09, 0.09)));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    add(im);
    hideDuringReflect.push(im);
  }

  // ============================================================
  // 4. 荷叶 / 荷花 / 锦鲤
  // ============================================================
  const floaters = [];
  {
    const padGeo = (() => {
      const sh = new THREE.Shape();
      const seg = 18, r0 = 0.46;
      sh.moveTo(0, 0);
      for (let i = 0; i <= seg; i++) {
        const a = -0.42 + (i / seg) * (TAU - 0.84);
        sh.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
      }
      sh.lineTo(0, 0);
      const g = new THREE.ShapeGeometry(sh, 1);
      g.rotateX(-Math.PI / 2);
      return g;
    })();
    const mat = toonMat({ color: 0xffffff, side: THREE.DoubleSide });
    const N = 110;
    const im = new THREE.InstancedMesh(padGeo, mat, N);
    im.castShadow = false; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const eul = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      let x, z;
      if (i % 3 === 0) { x = rr(L.pondN.x0 + 2, L.pondN.x1 - 2); z = rr(L.pondN.z0 + 2, L.pondN.z1 - 2); }
      else { x = rr(L.pondS.x0 + 2, L.pondS.x1 - 2); z = rr(L.pondS.z0 + 2, L.pondS.z1 - 2); }
      const sc = rr(0.72, 1.25);
      p.set(x, WATER_Y + 0.03, z);
      eul.set(rr(-0.06, 0.06), rr(0, TAU), rr(-0.06, 0.06));
      q.setFromEuler(eul);
      s.set(sc, 1, sc);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(pk([NC.lotus, 0x4f8b46, 0x6faa55])));
      floaters.push({ im, i, base: p.clone(), quat: q.clone(), scale: sc, ph: rr(0, TAU), amp: rr(0.012, 0.035) });
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    add(im);
    hideDuringReflect.push(im);
    // 荷花
    const fMat = toonMat({ vertexColors: true });
    for (let i = 0; i < 10; i++) {
      const x = rr(L.pondS.x0 + 4, L.pondS.x1 - 4), z = rr(L.pondS.z0 + 4, L.pondS.z1 - 4);
      const petals = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        const g = coneG(0.058, 0.34, 5);
        g.rotateX(0.5);
        g.rotateY(a);
        g.translate(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12);
        petals.push(paint(g, 0xf3b6c9));
      }
      const f = meshOf(mergeGeos(petals), fMat);
      f.position.set(x, WATER_Y + 0.18, z);
      add(f);
      const core = meshOf(sphG(0.08, 0, 0, 0, 8), toonMat({ color: 0xf4e08a }));
      core.position.set(x, WATER_Y + 0.32, z);
      add(core);
      floaters.push({ mesh: f, base: f.position.clone(), ph: rr(0, TAU), amp: rr(0.02, 0.05) });
      floaters.push({ mesh: core, base: core.position.clone(), ph: rr(0, TAU), amp: rr(0.02, 0.05) });
    }
  }
  const koi = [];
  {
    const g = mergeGeos([
      paint((() => { const s = sphG(0.26, 0, 0, 0, 10); s.scale(2.2, 0.68, 1.0); return s; })(), 0xf07a3a),
      paint((() => { const c = coneG(0.20, 0.46, 6); c.rotateZ(Math.PI / 2); c.translate(-0.74, 0, 0); return c; })(), 0xf7ede0),
    ]);
    const mat = toonMat({ vertexColors: true });
    for (let i = 0; i < 10; i++) {
      const m = meshOf(g, mat, { cast: false });
      const cx = rr(L.pondS.x0 + 8, L.pondS.x1 - 8), cz = rr(L.pondS.z0 + 8, L.pondS.z1 - 8);
      add(m);
      koi.push({ mesh: m, cx, cz, r: rr(1.5, 5.5), ph: rr(0, TAU), sp: rr(0.18, 0.4) * (R() > 0.5 ? 1 : -1) });
      hideDuringReflect.push(m);
    }
  }

  // ============================================================
  // 5. 长椅 / 路灯 / 展旗 / 木船 / 飞鸟 / 台阶上的猫 / 广场鸽
  // ============================================================
  const lampGlassMats = [], lightPoolMats = [], pointLights = [];
  {
    const benchWood = toonMat({ color: 0xa8763f });
    const benchSteel = new THREE.MeshStandardMaterial({ color: 0x8b939a, metalness: 0.6, roughness: 0.45 });
    const slats = [], legs = [];
    const benchAt = (x, z, rot) => {
      const s = [], l = [];
      for (let i = 0; i < 4; i++) s.push(boxG(1.9, 0.06, 0.11, 0, 0.45, -0.18 + i * 0.12));
      for (let i = 0; i < 3; i++) s.push(boxG(1.9, 0.06, 0.11, 0, 0.66 + i * 0.14, -0.27));
      for (const sx of [-1, 1]) l.push(boxG(0.08, 0.45, 0.46, sx * 0.82, 0.22, 0));
      const gs = mergeGeos(s), gl = mergeGeos(l);
      for (const g of [gs, gl]) { const gg = g; gg.rotateY(rot); gg.translate(x, 0.06, z); }
      slats.push(gs); legs.push(gl);
    };
    for (let i = 0; i < 7; i++) benchAt(-160 + i * 46, -62.5, 0);
    for (let i = 0; i < 4; i++) benchAt(-20 + i * 22, 55, Math.PI);
    for (let i = 0; i < 3; i++) benchAt(-86, 10 + i * 18, Math.PI / 2);
    const bm = meshOf(mergeGeos(slats), benchWood);
    const bl = meshOf(mergeGeos(legs), benchSteel);
    add(bm); add(bl);
  }
  {
    // 路灯：钢构件全场景合并（1 个 draw call），灯罩单独发光，地面光斑夜间渐亮
    const steel = [], glass = [], pools = [];
    const poolTex = lightPoolTexture();
    const lampAt = (x, z, rot = 0) => {
      const gg = [];
      gg.push(cylG(0.09, 0.14, 4.7, 8, 0, 2.35, 0));
      gg.push(cylG(0.23, 0.27, 0.34, 8, 0, 0.17, 0));
      const arm = boxG(0.95, 0.1, 0.1, 0, 0, 0);
      arm.translate(0.48, 4.68, 0);
      gg.push(arm);
      const head = rboxG(0.56, 0.18, 0.34, 0.92, 4.6, 0, 0.05, 1);
      gg.push(head);
      const g = mergeGeos(gg);
      g.rotateY(rot); g.translate(x, 0.06, z);
      steel.push(g);
      const gl = boxG(0.5, 0.1, 0.32, 0, 0, 0);
      gl.rotateY(rot);
      gl.translate(x + Math.cos(rot) * 0.92, 4.5, z - Math.sin(rot) * 0.92);   // 灯头里，不是地面
      glass.push(gl);
      const pl = new THREE.PlaneGeometry(7.5, 7.5);
      pl.rotateX(-Math.PI / 2);
      pl.rotateY(rot);
      pl.translate(x + Math.cos(rot) * 0.9, 0.1, z - Math.sin(rot) * 0.9);
      pools.push(pl);
    };
    for (let i = 0; i < 9; i++) lampAt(-172 + i * 43, -63.5);
    for (let z = -96; z <= 100; z += 32) lampAt(-162, z);   // 原来 x=-140 正立在广场中间
    for (let i = 0; i < 5; i++) { const lx = -18 + i * 17; if (Math.abs(lx - 13.6) < 9) continue; lampAt(lx, 53.5, Math.PI); }   // 让开漫步机位主轴（agy N4）
    for (let z = -40; z <= 44; z += 21) { if (z > -11 && z < 11) continue; lampAt(-76.2, z, Math.PI / 2); }
    add(meshOf(mergeGeos(steel), new THREE.MeshStandardMaterial({ color: 0x7f878c, metalness: 0.55, roughness: 0.5 })));
    const gm = new THREE.MeshStandardMaterial({ color: 0xf3f0e4, emissive: 0xffcf8a, emissiveIntensity: 0 });
    const gmesh = meshOf(mergeGeos(glass), gm, { cast: false, receive: false });
    add(gmesh);
    lampGlassMats.push(gm);
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const pmesh = meshOf(mergeGeos(pools), pm, { cast: false, receive: false });
    add(pmesh);
    lightPoolMats.push(pm);
    hideDuringReflect.push(pmesh);
    // 入口与广场各一盏真光源（toon 材质下会形成明显的色块光池）
    for (const [x, y, z, c] of [[-60, 6.5, 0, 0xffc98a], [0, 7.0, -63, 0xffd39a]]) {
      const pl = new THREE.PointLight(c, 0, 90, 2);
      pl.position.set(x, y, z);
      group.add(pl);
      pointLights.push(pl);
    }
  }
  {
    // 展旗（博物馆的展览横幅）
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa2a7, metalness: 0.6, roughness: 0.4 });
    const poles = [];
    const bannerMats = [];
    const bannerAt = (x, z) => {
      poles.push(cylG(0.1, 0.13, 7.4, 8, x, 3.76, z));
      // 上下横臂（把旗面挂到立杆上，原来旗面悬在杆旁没有任何连接件）
      for (const yy of [6.78, 3.18]) {
        const arm = cylG(0.045, 0.05, 1.06, 6);
        arm.rotateX(Math.PI / 2);
        arm.translate(x, yy, z + 0.53);
        poles.push(arm);
        const band = cylG(0.13, 0.13, 0.12, 8);
        band.translate(x, yy, z);
        poles.push(band);
      }
      const tex = bannerTexture('宁波博物馆');
      const mat = withWind(toonMat({ map: tex, side: THREE.DoubleSide }), 1.2, 3.4);
      const m = meshOf(new THREE.PlaneGeometry(1.05, 3.6), mat, { cast: false });
      m.position.set(x, 4.98, z + 0.56);
      add(m);
      bannerMats.push(mat);
    };
    for (const x of [-32, -22, 22, 32]) bannerAt(x, -59.8);
    for (const z of [-70, -40]) bannerAt(-142, z);
    add(meshOf(mergeGeos(poles), poleMat));
  }
  const boats = [];
  {
    const wood = toonMat({ color: 0x8a6244 });
    const g = mergeGeos([
      paint(boxG(4.6, 0.55, 1.5, 0, 0.1, 0), 0x8a6244),
      paint(boxG(4.9, 0.22, 1.7, 0, 0.42, 0), 0x6f4c33),
      paint(boxG(1.2, 0.16, 1.4, 0, 0.42, 0), 0xa8763f),
      paint(boxG(1.2, 0.16, 1.4, -1.3, 0.42, 0), 0xa8763f),
      paint(cylG(0.05, 0.05, 3.6, 6, 0, 1.4, 0.5), 0xa8763f),
    ]);
    const m = meshOf(g, toonMat({ vertexColors: true }));
    m.position.set(-110, WATER_Y + 0.05, -28);
    m.rotation.y = 0.5;
    add(m);
    boats.push({ mesh: m, ph: 0 });
  }
  const birds = [];
  {
    const body = mergeGeos([
      paint((() => { const s = sphG(0.22, 0, 0, 0, 8); s.scale(2.2, 1, 1); return s; })(), 0x53585f),
      paint(boxG(1.5, 0.05, 0.34, 0, 0.05, 0.55), 0x6b717a),
      paint(boxG(1.5, 0.05, 0.34, 0, 0.05, -0.55), 0x6b717a),
    ]);
    const mat = toonMat({ vertexColors: true });
    const im = new THREE.InstancedMesh(body, mat, 14);
    im.castShadow = false; im.receiveShadow = false;
    add(im);
    hideDuringReflect.push(im);
    for (let i = 0; i < 14; i++) {
      birds.push({ im, i, r: rr(55, 135), y: rr(34, 62), ph: rr(0, TAU), sp: rr(0.07, 0.16) * (R() > 0.5 ? 1 : -1), flap: rr(4, 8) });
    }
  }
  {
    // 台阶上的猫（第 7 级）——卡通片里的"活物"点缀
    const CA = M.canyon;
    const parts = [];
    parts.push(paint((() => { const s = sphG(0.24, 0, 0, 0, 10); s.scale(1.35, 1.0, 1.9); return s; })(), 0xd9a25e));
    parts.push(paint(sphG(0.17, 0, 0.34, 0.24, 10), 0xe2b070));
    for (const s of [-1, 1]) {
      const ear = coneG(0.07, 0.14, 4);
      ear.translate(s * 0.09, 0.48, 0.24);
      parts.push(paint(ear, 0xd9a25e));
    }
    const tail = [];
    for (let k = 0; k < 3; k++) {
      const t = cylG(0.045, 0.05, 0.3, 6);
      t.rotateX(0.5 + k * 0.35);
      t.translate(-0.02, 0.06 + k * 0.1, -0.42 - k * 0.06);
      tail.push(paint(t, 0xd9a25e));
    }
    parts.push(...tail);
    for (const s of [-1, 1]) parts.push(paint(boxG(0.1, 0.24, 0.1, s * 0.14, 0.12, 0.1), 0xcf9a58));
    const cat = meshOf(mergeGeos(parts), toonMat({ vertexColors: true }));
    const catZ = STAIR.zStart - STAIR.run * 7.5;
    cat.position.set(STAIR && 17.4, stairY(catZ) + 0.02, catZ);
    cat.rotation.y = FWD(0.25, 1);
    add(cat);
  }
  {
    // 广场鸽（会小跳）
    const g = mergeGeos([
      paint((() => { const s = sphG(0.09, 0, 0, 0, 8); s.scale(1.5, 1.1, 1); return s; })(), 0x9aa1ad),
      paint(sphG(0.055, 0, 0.09, 0.1, 8), 0x8d94a0),
      paint(coneG(0.03, 0.09, 4), 0xe4a24a),
    ]);
    const mat = toonMat({ vertexColors: true });
    const im = new THREE.InstancedMesh(g, mat, 16);
    add(im);
    hideDuringReflect.push(im);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const eul = new THREE.Euler();
    for (let i = 0; i < 16; i++) {
      p.set(rr(-120, 80), 0.1, rr(-140, -66));
      eul.set(0, rr(0, TAU), 0);
      q.setFromEuler(eul);
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  }


  // ============================================================
  // 6. 场地家具：馆名墙 / 指示牌 / 垃圾桶 / 地埋灯柱
  // ============================================================
  {
    // 独立馆名墙（广场上的标识物）
    const wall = meshOf(boxG(7.2, 3.8, 0.8, 0, 1.9, 0), toonMat({ map: graniteTexture() }));
    wall.position.set(-34, 0.06, -66);
    add(wall);
    const st = museumSignTexture();
    const sm = toonMat({ map: st.map, bumpMap: st.bump, bumpScale: 0.5, side: THREE.DoubleSide });
    for (const sgn of [-1, 1]) {
      const pg = new THREE.PlaneGeometry(6.6, 3.3);
      if (sgn < 0) pg.rotateY(Math.PI);
      pg.translate(0, 1.9, sgn * 0.42);
      const m = meshOf(pg, sm, { cast: false });
      m.position.set(-34, 0.06, -66);
      add(m);
    }
    // 指示牌（一柱三板）
    const pole = [], plates = [];
    const signTex = signboardTexture();
    const signMat = toonMat({ map: signTex, side: THREE.DoubleSide });
    const sp = [16, -62];
    pole.push(cylG(0.09, 0.11, 3.4, 8, sp[0], 1.7, sp[1]));
    add(meshOf(mergeGeos(pole), new THREE.MeshStandardMaterial({ color: 0x8f979c, metalness: 0.5, roughness: 0.5 })));
    for (let i = 0; i < 3; i++) {
      const y = 2.55 - i * 0.55;
      const pg = new THREE.PlaneGeometry(1.9, 0.44);
      pg.rotateY(-0.35 + i * 0.35);
      pg.translate(sp[0], y, sp[1]);
      const m = meshOf(pg, signMat, { cast: false });
      add(m);
    }
    // 垃圾桶
    const bins = [];
    for (const [bx, bz] of [[-118, -63], [-70, -63], [-24, -63], [22, -63], [-4, 55], [40, 55]]) {
      bins.push(cylG(0.34, 0.3, 0.86, 8, bx, 0.5, bz));
      bins.push(cylG(0.38, 0.38, 0.08, 8, bx, 0.95, bz));
    }
    add(meshOf(mergeGeos(bins), toonMat({ color: 0x4b5257 })));   // 原来把 BufferGeometry 直接塞进 group → 垃圾桶全丢 + 控制台报错
    // 岸边地埋灯柱（夜间亮）
    const bollards = [], bglass = [];
    for (let z = -34; z <= 44; z += 13) {
      if (z > -11 && z < 11) continue;               // 堰顶通道上不放（原来正好立在路上）
      bollards.push(cylG(0.09, 0.11, 0.92, 6, -76.4, 0.5, z));
      bglass.push(boxG(0.16, 0.14, 0.16, -76.4, 0.9, z));
    }
    puddle: {
      const pm = new THREE.MeshStandardMaterial({ color: 0xf3f0e4, emissive: 0xffcf8a, emissiveIntensity: 0 });
      add(meshOf(mergeGeos(bollards), new THREE.MeshStandardMaterial({ color: 0x70787c, metalness: 0.5, roughness: 0.5 })));
      add(meshOf(mergeGeos(bglass), pm, { cast: false, receive: false }));
      lampGlassMats.push(pm);
    }
  }


  // ============================================================
  // 7. 水岸与广场的细部：汀步 / 石拱桥 / 石凳 / 花池
  // ============================================================
  {
    // 北水带上的汀步（堰桥通道以西另开一条过水踏步）
    const steps = [];
    for (let i = 0; i < 11; i++) {                     // 走得过人的汀步：石面高于水面 ~0.4m
      const z = -54.4 + i * 0.88;
      steps.push(prismG({
        bx0: -38.4, bx1: -37.2, bz0: z - 0.34, bz1: z + 0.34, y0: -0.5, y1: 0.26,
      }, 1.2, 1.2, 'nswetop'));
    }
    // 两岸接驳小平台（否则就是"水里一排孤石"）
    steps.push(prismG({ bx0: -40.2, bx1: -36.4, bz0: -55.9, bz1: -54.2, y0: -0.5, y1: 0.2 }, 1.5, 1.5, 'nswetop'));
    steps.push(prismG({ bx0: -40.2, bx1: -36.4, bz0: -45.8, bz1: -44.1, y0: -0.5, y1: 0.2 }, 1.5, 1.5, 'nswetop'));
    add(meshOf(mergeGeos(steps), toonMat({ map: graniteTexture() })));
    // 东水带上的小石拱桥
    {
      const bx = 83, bz = 22;
      const parts = [];
      for (let i = 0; i < 7; i++) {                       // 踏步式拱圈
        const a = (i / 6) * Math.PI;
        const y = 0.16 + Math.sin(a) * 1.15;
        const g = boxG(10.4, 0.34, 1.1, 0, 0, 0);
        g.translate(bx, y, bz - 3.3 + i * 1.1);
        parts.push(g);
      }
      const m = meshOf(mergeGeos(parts), toonMat({ map: graniteTexture() }));
      add(m);
      const railing = [];
      for (const dz of [-3.9, 3.9]) {
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI;
          const g = boxG(0.16, 0.9, 0.16, 0, 0, 0);
          g.translate(bx + dz, 0.16 + Math.sin(a) * 1.15 + 0.45, bz - 3.3 + i * 1.1);
          railing.push(g);
        }
      }
      add(meshOf(mergeGeos(railing), new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.6, roughness: 0.45 })));
    }
    // 石凳
    const stoneBenches = [];
    for (const [bx, bz] of [[-96, -62], [-52, -62], [-4, -61.5], [64, -62], [-14, 52], [26, 52], [-92, 30]]) {
      stoneBenches.push(prismG({ bx0: bx - 0.95, bx1: bx + 0.95, bz0: bz - 0.26, bz1: bz + 0.26, y0: 0.36, y1: 0.52 }, 2, 2, 'nswetop'));
      stoneBenches.push(prismG({ bx0: bx - 0.72, bx1: bx - 0.46, bz0: bz - 0.2, bz1: bz + 0.2, y0: 0.06, y1: 0.36 }, 1.5, 1.5, 'nswetop'));
      stoneBenches.push(prismG({ bx0: bx + 0.46, bx1: bx + 0.72, bz0: bz - 0.2, bz1: bz + 0.2, y0: 0.06, y1: 0.36 }, 1.5, 1.5, 'nswetop'));
    }
    add(meshOf(mergeGeos(stoneBenches), toonMat({ map: graniteTexture(), color: 0x9d998e })));
    // 花池 + 花丛（实例化小球/小锥）
    const beds = [], soilBed = [];
    const bedSpots = [[-140, -58], [-92, -58], [-44, -58], [8, -58], [56, -58], [104, -58], [-30, 44], [8, 44], [46, 44]];
    for (const [bx, bz] of bedSpots) {
      beds.push(rboxG(5.2, 0.62, 2.2, bx, 0.31, bz, 0.08, 1));
      soilBed.push(boxG(4.9, 0.16, 1.9, bx, 0.62, bz));
    }
    add(meshOf(mergeGeos(beds), toonMat({ map: graniteTexture() })));
    add(meshOf(mergeGeos(soilBed), toonMat({ color: NC.soil })));
    const fg = mergeGeos([
      paint(sphG(0.11, 0, 0.1, 0, 6), 0xffffff),
      paint(coneG(0.05, 0.12, 5), 0xf6e08a),
    ]);
    const fmat = toonMat({ vertexColors: true });
    const FL = 260;
    const fim = new THREE.InstancedMesh(fg, fmat, FL);
    const m4b = new THREE.Matrix4(), q4b = new THREE.Quaternion(), p4b = new THREE.Vector3(), s4b = new THREE.Vector3();
    const e4b = new THREE.Euler();
    const FCOL = [0xe8604f, 0xf2c14e, 0xe97cae, 0xf2f0e8, 0xc06fd0, 0xff8f5a];
    for (let i = 0; i < FL; i++) {
      const b = bedSpots[i % bedSpots.length];
      const px = b[0] + rr(-2.3, 2.3), pz = b[1] + rr(-0.85, 0.85);
      const sc = rr(0.75, 1.35);
      p4b.set(px, 0.66, pz);
      e4b.set(0, rr(0, TAU), 0);
      q4b.setFromEuler(e4b);
      s4b.set(sc, sc, sc);
      m4b.compose(p4b, q4b, s4b);
      fim.setMatrixAt(i, m4b);
      fim.setColorAt(i, new THREE.Color(FCOL[i % FCOL.length]).offsetHSL(0, 0, rr(-0.05, 0.05)));
    }
    fim.instanceMatrix.needsUpdate = true;
    if (fim.instanceColor) fim.instanceColor.needsUpdate = true;
    add(fim);
    hideDuringReflect.push(fim);
  }

  // ============================================================
  // 8. 水岸生灵与导览设施：白鹭 / 浮萍 / 系缆桩 / 导览牌 / 石灯笼
  // ============================================================
  {
    // 白鹭（站在浅水里的江南水鸟）
    const eg = mergeGeos([
      paint((() => { const b = sphG(0.22, 0, 0.46, 0, 8); b.scale(1.5, 1.0, 1.0); return b; })(), 0xf4f2ea),
      paint((() => { const n = cylG(0.05, 0.07, 0.5, 6); n.rotateX(0.22); n.translate(0.1, 0.72, 0.04); return n; })(), 0xf7f5ee),
      paint(sphG(0.085, 0.14, 0.98, 0.06, 8), 0xfaf8f2),
      paint(coneG(0.03, 0.22, 5).rotateZ(-Math.PI / 2).translate(0.28, 0.96, 0.06), 0xe8a13c),
      paint(cylG(0.022, 0.022, 0.5, 5, -0.06, 0.24, 0.04), 0x2b2b2b),
      paint(cylG(0.022, 0.022, 0.5, 5, 0.08, 0.24, -0.02), 0x2b2b2b),
    ]);
    const egretMat = toonMat({ vertexColors: true });
    for (const [ex, ez, ry] of [[-122, 16, 1.1], [-104, -32, -0.6], [-99, 34, 2.4]]) {
      const m = meshOf(eg, egretMat);
      m.position.set(ex, WATER_Y - 0.12, ez);
      m.rotation.y = ry;
      add(m);
    }
    // 浮萍（水面小绿点）
    const fp = new THREE.CircleGeometry(0.085, 6);
    fp.rotateX(-Math.PI / 2);
    const fmat2 = toonMat({ color: 0xffffff, side: THREE.DoubleSide });
    const FN = 320;
    const fim2 = new THREE.InstancedMesh(fp, fmat2, FN);
    const m4f = new THREE.Matrix4(), q4f = new THREE.Quaternion(), p4f = new THREE.Vector3(), s4f = new THREE.Vector3();
    const e4f = new THREE.Euler();
    for (let i = 0; i < FN; i++) {
      const mode = i % 3;
      let x, z;
      if (mode === 0) { x = rr(L.pondN.x0 + 2, L.pondN.x1 - 2); z = rr(L.pondN.z0 + 2, L.pondN.z1 - 2); }
      else if (mode === 1) { x = rr(L.pondS.x0 + 2, L.pondS.x1 - 2); z = rr(L.pondS.z0 + 2, L.pondS.z1 - 2); }
      else { x = rr(L.moatN.gap[1] + 3, L.moatN.x1 - 3); z = rr(L.moatN.z0 + 1.5, L.moatN.z1 - 1.5); }
      const sc = rr(0.6, 1.5);
      p4f.set(x, WATER_Y + 0.02, z);
      e4f.set(0, rr(0, TAU), 0);
      q4f.setFromEuler(e4f);
      s4f.set(sc, 1, sc);
      m4f.compose(p4f, q4f, s4f);
      fim2.setMatrixAt(i, m4f);
      fim2.setColorAt(i, new THREE.Color(pk([0x6fae52, 0x82bd62, 0x5c9a45])).offsetHSL(0, 0, rr(-0.05, 0.05)));
    }
    fim2.instanceMatrix.needsUpdate = true;
    if (fim2.instanceColor) fim2.instanceColor.needsUpdate = true;
    add(fim2);
    hideDuringReflect.push(fim2);
    // 系缆桩（沿湖岸）
    const moor = [];
    for (let z = -30; z <= 40; z += 10) { if (z > -8 && z < 8) continue; moor.push(cylG(0.16, 0.19, 0.52, 8, -83.2, 0.3, z)); }
    for (let x = 20; x <= 70; x += 12) moor.push(cylG(0.16, 0.19, 0.52, 8, x, 0.3, -45.7));
    add(meshOf(mergeGeos(moor), toonMat({ map: graniteTexture() })));
    // 导览牌（两根柱子 + 一块图板）
    const posts = [];
    for (const dx of [-1.1, 1.1]) posts.push(boxG(0.12, 2.1, 0.12, -12 + dx, 1.05, -58.2));
    add(meshOf(mergeGeos(posts), new THREE.MeshStandardMaterial({ color: 0x6f7680, metalness: 0.5, roughness: 0.5 })));
    const mapGeo = new THREE.PlaneGeometry(2.5, 1.85);
    mapGeo.rotateY(Math.PI);
    mapGeo.translate(-12, 1.5, -58.14);
    add(meshOf(mapGeo, toonMat({ map: siteMapTexture(), side: THREE.DoubleSide })));
    add(meshOf(boxG(2.7, 2.05, 0.1, -12, 1.5, -58.24), toonMat({ color: 0x8b8781 })));
    // 石灯笼（草坪小径旁）
    const lanterns = [], lglass = [];
    for (const [lx, lz] of [[-96, 58], [-52, 66]]) {
      const parts = [];
      parts.push(cylG(0.36, 0.42, 0.22, 8));
      parts.push(cylG(0.13, 0.15, 0.85, 8).translate(0, 1.35, 0));
      parts.push(boxG(0.5, 0.42, 0.5, 0, 2.0, 0));
      parts.push(coneG(0.46, 0.34, 4).translate(0, 2.42, 0));
      const g = mergeGeos(parts);
      g.translate(lx, 0.02, lz);
      lanterns.push(g);
      lglass.push(boxG(0.36, 0.3, 0.36, lx, 2.0, lz));
    }
    add(meshOf(mergeGeos(lanterns), toonMat({ color: 0x9a968c })));
    const lgm = new THREE.MeshStandardMaterial({ color: 0xf3f0e4, emissive: 0xffcf8a, emissiveIntensity: 0 });
    add(meshOf(mergeGeos(lglass), lgm, { cast: false, receive: false }));
    lampGlassMats.push(lgm);
  }

  // ============================================================
  // 更新与动画
  // ============================================================
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  const e4 = new THREE.Euler();

  return {
    group, hideDuringReflect, crowd, wind, pointLights,
    update(st) {
      const lit = clamp(st.lampF, 0, 1);
      for (const m of lampGlassMats) m.emissiveIntensity = 2.4 * lit;
      for (const m of lightPoolMats) m.opacity = 0.5 * lit;
      for (const l of pointLights) l.intensity = 34 * lit;
    },
    tick(t, dt, st) {
      wind.value = t;
      // 游客：往返行走 + 身体起伏
      for (const w of crowd.walkers) {
        const dx = w.p1[0] - w.p0[0], dz = w.p1[1] - w.p0[1];
        const len = Math.hypot(dx, dz) || 1;
        const u = ((t * w.speed / (2 * len)) + w.phase) % 1;
        const k = u < 0.5 ? u * 2 : 2 - u * 2;
        const x = lerp(w.p0[0], w.p1[0], k), z = lerp(w.p0[1], w.p1[1], k);
        const y = w.onStair ? stairY(z) : lerp(w.y0, w.y1, k);
        const fwd = u < 0.5 ? 1 : -1;
        w.mesh.position.set(x, y + Math.abs(Math.sin(t * 5.2 * w.speed + w.phase * 9)) * 0.035, z);
        w.mesh.rotation.y = FWD(dx * fwd, dz * fwd);
        w.mesh.rotation.z = Math.sin(t * 5.2 * w.speed + w.phase * 9) * 0.02;
      }
      // 荷叶 / 荷花随波起伏
      for (const f of floaters) {
        const dy = Math.sin(t * 1.1 + f.ph) * f.amp;
        if (f.im) {
          p4.set(f.base.x, f.base.y + dy, f.base.z);
          e4.set(0, 0, Math.sin(t * 0.8 + f.ph) * 0.06);
          const qq = new THREE.Quaternion().setFromEuler(e4).multiply(f.quat);
          s4.set(f.scale, 1, f.scale);
          m4.compose(p4, qq, s4);
          f.im.setMatrixAt(f.i, m4);
          f.im.instanceMatrix.needsUpdate = true;
        } else {
          f.mesh.position.y = f.base.y + dy;
        }
      }
      // 锦鲤绕圈
      for (const k of koi) {
        const a = t * k.sp + k.ph;
        const x = k.cx + Math.cos(a) * k.r, z = k.cz + Math.sin(a) * k.r;
        k.mesh.position.set(x, WATER_Y - 0.26 + Math.sin(t * 2 + k.ph) * 0.025, z);
        k.mesh.rotation.y = FWD(-Math.sin(a) * Math.sign(k.sp), Math.cos(a) * Math.sign(k.sp));
      }
      // 小木船轻轻摇晃
      for (const b of boats) {
        b.mesh.position.y = WATER_Y + 0.05 + Math.sin(t * 0.9) * 0.06;
        b.mesh.rotation.z = Math.sin(t * 0.7) * 0.03;
        b.mesh.rotation.x = Math.sin(t * 1.1 + 1) * 0.025;
      }
      // 飞鸟盘旋
      for (const b of birds) {
        const a = t * b.sp + b.ph;
        p4.set(Math.cos(a) * b.r, b.y + Math.sin(t * 0.5 + b.ph) * 2.4, Math.sin(a) * b.r);
        e4.set(Math.sin(t * b.flap + b.ph) * 0.22, -a + (b.sp > 0 ? -Math.PI / 2 : Math.PI / 2), 0);
        q4.setFromEuler(e4);
        s4.setScalar(1);
        m4.compose(p4, q4, s4);
        b.im.setMatrixAt(b.i, m4);
        b.im.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
