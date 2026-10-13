// world.js —— 场地：地坪、广场铺装、三面环绕的水岸、它山堰（可走人的堰顶）、草坪与绿篱
//  水面布局与 water.js 共用同一份 L 常量，避免"水盘与岸线对不上"这类经典事故。
import * as THREE from 'three';
import {
  NC, toonMat, mergeGeos, prismG, boxG, rboxG, cylG, meshOf, mulberry32, rnd, clamp, sphG,
} from './base.js';
import { plazaPavingTexture, graniteTexture, lawnTexture, gravelTexture } from './surfaces.js';

// ---------------- 场地布局（单位 m）----------------
export const L = {
  plinth: { x0: -74.2, x1: 74.2, z0: -42.7, z1: 35.7 },
  plazaN: { x0: -205, x1: 205, z0: -172, z1: -54 },
  plazaW: { x0: -205, x1: -132, z0: -110, z1: 112 },
  westStrip: { x0: -84, x1: -74.2, z0: -46.6, z1: 50.6 },   // 湖与建筑之间的岸边通道
  forecourt: { x0: -34, x1: 58, z0: 33.2, z1: 58 },          // 山谷大台阶前的场地
  lawn: { x0: -190, x1: 190, z0: 56, z1: 196 },
  lawnPath: { x0: -132, x1: -74, z0: 58, z1: 68 },
  // 水面（水面高度 WATER_Y）
  moatN: { x0: -84, x1: 78, z0: -54, z1: -46.2, gap: [-24, 14] },
  moatE: { x0: 78, x1: 88, z0: -46.2, z1: 54 },
  pondN: { x0: -128, x1: -84, z0: -46, z1: -6 },
  pondS: { x0: -128, x1: -84, z0: 6, z1: 50 },
  weir: { x0: -134, x1: -78, z0: -6.6, z1: 6.6, y: 0.62 },   // 它山堰：堰顶即过河的路
};
export const WATER_Y = -0.16;   // 水面只比铺装低 0.22m：走近能看清水，不像一条埋进地里的缝
export const BASIN_Y = -1.35;

// 水面矩形（world 的地面开洞、water 的水盘几何共用这一份，绝不各写一处）
export function waterRects() {
  const m = L.moatN, e = L.moatE;
  return [
    { x0: m.x0, z0: m.z0, x1: m.gap[0], z1: m.z1 },
    { x0: m.gap[1], z0: m.z0, x1: m.x1, z1: m.z1 },
    { x0: e.x0, z0: e.z0, x1: e.x1, z1: e.z1 },
    { x0: L.pondN.x0, z0: L.pondN.z0, x1: L.pondN.x1, z1: L.pondN.z1 },
    { x0: L.pondS.x0, z0: L.pondS.z0, x1: L.pondS.x1, z1: L.pondS.z1 },
  ];
}

export function buildWorld() {
  const group = new THREE.Group();
  group.name = 'site';
  const hideDuringReflect = [];

  const matPave = toonMat({ map: plazaPavingTexture() });
  const matGranite = toonMat({ map: graniteTexture() });
  const lawnTex = lawnTexture();
  const matGrass = toonMat({ map: lawnTex, color: 0xf0f3ea });
  const matHedge = toonMat({ color: NC.leafA });
  const matSoil = toonMat({ color: NC.soil });
  const matPebble = toonMat({ color: 0xa9a49a });
  const matWaterBed = toonMat({ color: 0x59685c });
  const matWood = toonMat({ color: NC.wood });

  const add = (geo, mat, opts) => {
    if (!geo) return null;
    const m = meshOf(geo, mat, opts);
    group.add(m);
    return m;
  };

  // ---------------- 大地面：带洞（洞 = 水面），洞外才是草地 ----------------
  {
    const S = 800;
    const shape = new THREE.Shape();
    shape.moveTo(-S, -S); shape.lineTo(S, -S); shape.lineTo(S, S); shape.lineTo(-S, S); shape.lineTo(-S, -S);
    // 形状空间 (sx, sy) → 世界 (x, -z)（rotateX(-90°) 的映射）
    for (const r of waterRects()) {
      const p = new THREE.Path();
      // 洞必须与水面矩形严格重合：洞比水面大一圈会在地面/池壁之间留下一条黑缝
      const x0 = r.x0, x1 = r.x1, y0 = -r.z1, y1 = -r.z0;
      p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.lineTo(x0, y0);
      shape.holes.push(p);
    }
    const g = new THREE.ShapeGeometry(shape, 1);
    g.rotateX(-Math.PI / 2);
    lawnTex.repeat.set(0.045, 0.045);           // ShapeGeometry 的 uv = 形状坐标（米）：约 22m 一个循环
    const m = new THREE.Mesh(g, matGrass);
    m.receiveShadow = true;
    m.castShadow = false;
    group.add(m);
  }

  // ---------------- 铺装（各块互不重叠，避免共面闪烁）----------------
  const PAVES = [
    { x0: -168, x1: 168, z0: -168, z1: -54 },        // 北广场
    { x0: -168, x1: -132, z0: -54, z1: 108 },        // 西前庭
    { x0: -24, x1: 14, z0: -54, z1: -42.7 },         // 过北水带的堰桥通道
    { x0: -84, x1: -24, z0: -46.2, z1: -42.7 },      // 水岸内侧（西段）
    { x0: 14, x1: 78, z0: -46.2, z1: -42.7 },        // 水岸内侧（东段）
    { x0: 74.2, x1: 78, z0: -42.7, z1: 35.7 },       // 东侧通道
    { x0: -84, x1: -74.2, z0: -42.7, z1: 50.6 },     // 湖与建筑之间的通道
    { x0: -74.2, x1: -34, z0: 35.7, z1: 58 },        // 南侧通道（西段）
    { x0: -34, x1: 58, z0: 35.7, z1: 58 },           // 山谷大台阶前场地
    { x0: 58, x1: 78, z0: 35.7, z1: 58 },            // 南侧通道（东段）
  ];
  PAVES.forEach((r, i) => add(prismG({ bx0: r.x0, bx1: r.x1, bz0: r.z0, bz1: r.z1, y0: -0.9, y1: 0.055 + i * 0.002 }, 12, 12, 'nswetop'), matPave));
  // 铺装 → 草地的过渡（agy V7：原来是一条 90° 硬边，像地毯贴在荒原上）
  // 三层：碎石带（3.2m）→ 灌木带 → 园路（4m）+ 行道树，让边界读作"公园边缘"
  {
    const gv = gravelTexture(); gv.repeat.set(0.35, 0.35);
    const matGravel = toonMat({ map: gv, color: 0xd8d3c4 });
    const matShrub = toonMat({ map: gv, color: 0x7f9a72 });
    const verge = [];
    const band = (x0, z0, x1, z1, wide, y) => {
      const g = boxG(Math.abs(x1 - x0) || wide, 0.08, Math.abs(z1 - z0) || wide, 0, 0, 0);
      g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      return g;
    };
    // 碎石带：北 / 东 / 西 / 南
    verge.push(band(-168, -171.6, 168, -168.4, 3.2, 0.03));
    verge.push(band(168.4, -168, 171.6, -54, 3.2, 0.03));
    verge.push(band(-171.6, -168, -168.4, 108, 3.2, 0.03));
    verge.push(band(-168, 57.6, 168, 60.8, 3.2, 0.03));
    add(mergeGeos(verge), matGravel);
    // 灌木带：外侧 6~9m 一丛，留缺口才像园林而不是围墙
    const shrubs = [];
    const bush = (x, z, r) => {
      const g = sphG(r, 7, 5); g.scale(1.35, 0.72, 1.0);
      g.translate(x, 0.34 + r * 0.42, z);
      shrubs.push(g);
    };
    for (let x = -164; x <= 164; x += 7.5) { if (Math.abs(x) < 40 && (x % 15) < 7.5) continue; bush(x, -174.5, rnd(1.5, 2.4)); }
    for (let z = -160; z <= 100; z += 8) { if ((z % 16) < 8) continue; bush(174.5, z, rnd(1.4, 2.2)); }
    for (let z = -160; z <= 104; z += 8) { if ((z % 16) < 8) continue; bush(-174.5, z, rnd(1.4, 2.2)); }
    for (let x = -160; x <= 160; x += 9) { if (Math.abs(x - 12) < 26) continue; bush(x, 63.5, rnd(1.3, 2.1)); }
    add(mergeGeos(shrubs), matShrub);
    // 园路：外侧 14m 一条 4m 宽环路（只做可见的南北两段，东西段隐入树列）
    const walk = [];
    walk.push(band(-192, -185, 192, -181, 4, 0.02));
    walk.push(band(-192, 74, 192, 78, 4, 0.02));
    walk.push(band(-192, -185, -188, 78, 4, 0.02));   // 东西两段把南北连成环，消除断头路（agy N6）
    walk.push(band(188, -185, 192, 78, 4, 0.02));
    add(mergeGeos(walk), matGravel);
  }

  // 草坪与铺装之间的花岗岩道牙（否则草地是一条硬边）
  {
    const kerbs = [];
    const kerb = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = rboxG(len, 0.34, 0.7, 0, 0, 0, 0.05, 1);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate((x0 + x1) / 2, 0.14, (z0 + z1) / 2);
      kerbs.push(g);
    };
    kerb(-168, 57.6, -34, 57.6); kerb(58, 57.6, 168, 57.6);
    kerb(-168, -54.4, -84, -54.4); kerb(14, -54.4, 168, -54.4);
    kerb(-168.4, -54, -168.4, 108); kerb(168.4, -168, 168.4, -54);
    kerb(-132.4, -54, -132.4, 8); kerb(-132.4, 52, -132.4, 108);
    add(mergeGeos(kerbs), matGranite);
  }

  // ---------------- 它山堰：条石压顶 + 下游连续跌水石级 + 一排护堰木桩 ----------------
  {
    const w = L.weir;
    add(prismG({ bx0: w.x0, bx1: w.x1, bz0: w.z0, bz1: w.z1, y0: -1.5, y1: w.y }, 3, 3, 'nswetop'), matGranite);
    // 压顶条石（一行，缝 0.15m）
    const cop = [];
    for (let x = w.x0 + 0.6; x < w.x1 - 0.6; x += 1.35) {
      cop.push(prismG({ bx0: x, bx1: x + 1.2, bz0: w.z0 + 0.12, bz1: w.z1 - 0.12, y0: w.y, y1: w.y + 0.18 }, 1.4, 1.4, 'nswetop'));
    }
    add(mergeGeos(cop), matGranite);
    // 堰顶两端上岸台阶：堰顶 0.62 → 场地 0.055，原来是 57cm 直落（agy N5：像悬空石唇）
    const endSteps = [];
    for (const [xEnd, dir] of [[w.x0, -1], [w.x1, 1]]) {
      for (let i = 0; i < 3; i++) {
        const yTop = w.y - 0.19 * (i + 1);
        endSteps.push(prismG({
          bx0: Math.min(xEnd + dir * (0.1 + i * 0.44), xEnd + dir * (0.1 + (i + 1) * 0.44)),
          bx1: Math.max(xEnd + dir * (0.1 + i * 0.44), xEnd + dir * (0.1 + (i + 1) * 0.44)),
          bz0: w.z0 + 0.2, bz1: w.z1 - 0.2, y0: -0.6, y1: yTop,
        }, 1.2, 1.2, 'nswetop'));
      }
    }
    add(mergeGeos(endSteps), matGranite);
    // 下游跌水石级：4 级、贯通全宽、彼此相接（原来是 3 块分开的梁，看着像漂着的木料）
    const st = [];
    for (let i = 0; i < 4; i++) {
      const yTop = w.y - 0.16 - i * 0.34;
      const z0 = w.z1 + i * 1.06;
      st.push(prismG({ bx0: w.x0, bx1: w.x1, bz0: z0, bz1: z0 + 1.22, y0: yTop - 0.34, y1: yTop }, 3, 3, 'nswetop'));
    }
    add(mergeGeos(st), matGranite);
    // 护堰木桩：只在下游水边一排、矮桩（原来两排 1.5m 高，像围栏）
    const stakes = [];
    for (let x = w.x0 + 5; x < w.x1 - 4; x += 6.5) {
      stakes.push(cylG(0.13, 0.15, 0.72, 6, x, WATER_Y + 0.34, w.z1 + 4.5));
    }
    add(mergeGeos(stakes), matWood);
  }

  // ---------------- 湖 / 水带：底泥 + 石壁 ----------------
  {
    const beds = [], walls = [];
    let bi = 0;
    const bed = (r) => {
      const yB = BASIN_Y - (bi++) * 0.012;      // 微错开：相邻水盘的角部重叠不再共面
      beds.push(prismG({ bx0: r.x0 - 0.5, bx1: r.x1 + 0.5, bz0: r.z0 - 0.5, bz1: r.z1 + 0.5, y0: yB - 0.6, y1: yB }, 4, 4, 't'));
      const seg = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const g = boxG(len, 2.2, 0.6, 0, 0, 0);
        g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
        g.translate((x0 + x1) / 2, WATER_Y - 1.05, (z0 + z1) / 2);
        walls.push(g);
      };
      seg(r.x0 - 0.4, r.z0, r.x1 + 0.4, r.z0);
      seg(r.x0 - 0.4, r.z1, r.x1 + 0.4, r.z1);
      seg(r.x0, r.z0, r.x0, r.z1);
      seg(r.x1, r.z0, r.x1, r.z1);
    };
    const m = L.moatN;
    bed({ x0: m.x0, x1: m.gap[0], z0: m.z0, z1: m.z1 });
    bed({ x0: m.gap[1], x1: m.x1, z0: m.z0, z1: m.z1 });
    bed(L.moatE);
    bed(L.pondN);
    bed(L.pondS);
    add(mergeGeos(beds), matWaterBed);
    add(mergeGeos(walls), matGranite);
  }

  // ---------------- 池岸压边（花岗岩）----------------
  {
    const curbs = [];
    const edge = (x0, z0, x1, z1, w = 1.25) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = rboxG(len, 0.62, w, 0, 0, 0, 0.06, 2);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate((x0 + x1) / 2, 0.24, (z0 + z1) / 2);
      curbs.push(g);
    };
    const m = L.moatN, e = L.moatE;
    edge(m.x0, m.z0, m.gap[0], m.z0); edge(m.gap[1], m.z0, m.x1, m.z0);
    edge(m.x0, m.z1, m.gap[0], m.z1); edge(m.gap[1], m.z1, m.x1, m.z1);
    edge(m.gap[0], m.z0, m.gap[0], m.z1); edge(m.gap[1], m.z0, m.gap[1], m.z1);
    edge(e.x1, e.z0, e.x1, e.z1);
    edge(e.x0, e.z0, e.x1, e.z0); edge(e.x0, e.z1, e.x1, e.z1);
    for (const p of [L.pondN, L.pondS]) {
      edge(p.x0 - 0.5, p.z0, p.x1 + 0.5, p.z0);
      edge(p.x0 - 0.5, p.z1, p.x1 + 0.5, p.z1);
      edge(p.x0, p.z0, p.x0, p.z1);
      edge(p.x1, p.z0, p.x1, p.z1);
    }
    add(mergeGeos(curbs), matGranite);
    // 水线卵石带：北水带南岸（贴着建筑那一侧）与东水带内岸
    const line = [];
    for (let x = -80; x < 76; x += 1.5) {
      const r = rnd(0.16, 0.34);
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1.1, rnd(0.5, 0.75), 1.1);
      g.translate(x, 0.02, -46.9 + rnd(-0.25, 0.25));
      line.push(g);
    }
    for (let z = -40; z < 50; z += 1.5) {
      const r = rnd(0.16, 0.34);
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1.1, rnd(0.5, 0.75), 1.1);
      g.translate(78.6 + rnd(-0.25, 0.25), 0.02, z);
      line.push(g);
    }
    add(mergeGeos(line), matPebble);

    // 卵石滩：北水带北岸 + 湖的西北角
    const peb = [];
    for (let i = 0; i < 380; i++) {
      const x = rnd(-128, -84), z = rnd(-51, -34);
      if (z > -46.4) continue;
      const r = rnd(0.15, 0.36);
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1, rnd(0.5, 0.8), 1);
      g.translate(x, r * 0.4, z);
      peb.push(g);
    }
    for (let i = 0; i < 240; i++) {
      const x = rnd(-84, 76), z = rnd(-57.5, -54.5);
      const r = rnd(0.13, 0.32);
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1, rnd(0.5, 0.8), 1);
      g.translate(x, r * 0.4, z);
      peb.push(g);
    }
    add(mergeGeos(peb), matPebble);
  }

  // ---------------- 广场中轴铺装带 + 入口引道（把 300 多米的大广场"分格"）----------------
  {
    const bandMat = toonMat({ map: graniteTexture(), color: 0xbdb6a6 });
    const bands = [];
    for (const [x0, x1, z0, z1] of [[-24, 14, -170, -54], [-96, -20, -62, -58.4], [-96, -20, -66.6, -63]]) {
      bands.push(prismG({ bx0: x0, bx1: x1, bz0: z0, bz1: z1, y0: -0.3, y1: 0.062 }, 3, 3, 'nswetop'));
    }
    add(mergeGeos(bands), bandMat);
  }

  // ---------------- 绿篱 / 树池 ----------------
  {
    const hedges = [], pits = [], soil = [];
    for (let x = -162; x < 162; x += 6) {
      if (x > -30 && x < 20) continue;
      hedges.push(rboxG(5.4, 1.05, 1.6, x, 0.55, -59, 0.35, 2));
      hedges.push(rboxG(5.4, 1.05, 1.6, x, 0.55, -164, 0.35, 2));
    }
    for (let z = 62; z < 108; z += 6) hedges.push(rboxG(1.6, 1.05, 5.4, -166, 0.55, z, 0.35, 2));   // 原来在 -136/-80，正好杵在广场正中（agy V11）
    add(mergeGeos(hedges), matHedge);
    for (let ix = 0; ix < 9; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        const x = -160 + ix * 40, z = -76 - iz * 19;
        if (x > -30 && x < 20) continue;
        pits.push(rboxG(2.3, 0.36, 2.3, x, 0.14, z, 0.06, 1));
        soil.push(boxG(1.9, 0.12, 1.9, x, 0.22, z));
      }
    }
    add(mergeGeos(pits), matGranite);
    add(mergeGeos(soil), matSoil);
  }


  // ---------------- 无障碍坡道（北侧上台基）+ 排水明沟 ----------------
  {
    const R0 = { x0: 22, x1: 42, z0: -47.2, z1: -42.8, y1: 0.57 };
    const len = R0.x1 - R0.x0;
    const ang = Math.atan2(R0.y1, len);
    const slope = prismG({
      bx0: -(len + 0.4) / 2, bx1: (len + 0.4) / 2, bz0: -(R0.z1 - R0.z0) / 2, bz1: (R0.z1 - R0.z0) / 2,
      y0: -0.11, y1: 0.11,
    }, 3, 3, 'nswetopbot');
    slope.rotateZ(ang);
    slope.translate((R0.x0 + R0.x1) / 2, R0.y1 / 2 - 0.08, (R0.z0 + R0.z1) / 2);
    add(slope, matGranite);
    const rails = [];
    for (const zz of [R0.z0 + 0.25, R0.z1 - 0.25]) {
      for (let x = R0.x0 + 1; x <= R0.x1 - 0.5; x += 2) {
        const g = boxG(0.07, 1.0, 0.07, 0, 0, 0);
        g.translate(x, (x - R0.x0) / len * R0.y1 + 0.5, zz);
        rails.push(g);
      }
      const bar = boxG(len + 0.3, 0.07, 0.07, 0, 0, 0);
      bar.rotateZ(ang);
      bar.translate((R0.x0 + R0.x1) / 2, R0.y1 / 2 + 1.0, zz);
      rails.push(bar);
    }
    add(mergeGeos(rails), new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.72, roughness: 0.44 }));
    // 明沟（贴着台基外沿的一圈深色排水沟）
    const gut = [];
    const g0 = (w, d, x, z) => gut.push(boxG(w, 0.1, d, x, 0.045, z));
    g0(146, 0.5, 0, -43.3);
    g0(0.5, 74, -78.7, 0);
    g0(0.5, 74, 78.7, 0);
    g0(110, 0.5, -17, 36.3);
    add(mergeGeos(gut), toonMat({ color: 0x4f5457 }));
  }

  const tintable = [matGrass, matHedge, matPave, matGranite, matPebble, matSoil];
  for (const m of tintable) m.userData.base = m.color.clone();
  return {
    group, hideDuringReflect, L,
    update(st) {
      const k = clamp(0.30 + 0.74 * st.dayF + 0.28 * st.nightF, 0.26, 1.1);
      for (const m of tintable) m.color.copy(m.userData.base).multiplyScalar(k);
    },
    tick() {},
  };
}
