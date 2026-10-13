// museum.js —— 宁波博物馆（王澍 / 业余建筑工作室，2008 年开馆）
//  依据公开资料还原的设计要点：
//   · 主体 144m(长) × 65m(宽) × 24m(高)，三层起裂开成五个量体，如山体片段
//   · 直壁 = 瓦爿墙（回收青砖 / 龙骨砖 / 瓦片 / 缸片，含"福壽"铭文砖）
//   · 斜壁 = 竹条模板混凝土（竹节与模板拼缝留在混凝土面上）
//   · 西端面向城市的"开放裂口"；南面"山谷"大台阶（仿《溪山行旅图》的正观）
//   · 量体之间的天光缝、平台上的绿化小景与点景方亭（园林"一步一景"）
import * as THREE from 'three';
import {
  NC, toonMat, mergeGeos, prismG, boxG, cylG, sphG, meshOf, mulberry32, clamp, lerp, windowSheenTexture,
} from './base.js';
import {
  wapanTexture, bambooConcreteTexture, roofTileTexture, graniteTexture,
  museumSignTexture, glassSheenTexture, posterTexture, wallWashTexture, deckTexture,
} from './surfaces.js';

// ---------------- 控制尺寸 ----------------
export const M = {
  x0: -72, x1: 72, z0: -32.5, z1: 32.5,     // 144 × 65
  yPl: 0.55,                                 // 台基顶
  yBase: 10.5,                               // 瓦爿墙基座顶 = 直壁/斜壁分界
  portal: { x0: -72, x1: -44, z0: -20, z1: 20 },        // 西端大裂口（28m 宽）
  canyon: { x0: 6.5, x1: 20.5, z0: 6, z1: 32.5 },       // 南面"山谷"大台阶（宽 14m）
  wallT: 0.85,
  // 五个量体：yE 为西端高、yR 为东端高，交错成锯齿山脊
  vols: [
    { x0: -72, x1: -46, yE: 16.2, yR: 22.6 },
    { x0: -42, x1: -14, yE: 24.2, yR: 19.4 },
    { x0: -10, x1: 10, yE: 19.4, yR: 23.6 },
    { x0: 14, x1: 42, yE: 23.8, yR: 18.6 },
    { x0: 46, x1: 72, yE: 17.8, yR: 23.0 },
  ],
};
// 大台阶几何（三段十级 + 两道缓步台）：几何与"人怎么站在台阶上"共用这一份
export const STAIR = (() => {
  const N = 63, per = 21, runs = 3, landing = 2.2;   // 30 级时每级 35cm（膝盖高，不可攀）→ 63 级每级 16.7cm（公共建筑 15~17cm）
  const zStart = M.canyon.z1 + 0.5, zEnd = M.canyon.z0 + 0.6;
  const rise = M.yBase / N;
  const run = ((zStart - zEnd) - (runs - 1) * landing) / N;
  return { N, per, zStart, zEnd, rise, run, landing };
})();
export function stairY(z) {
  const S = STAIR;
  let zz = S.zStart;
  for (let i = 0; i < S.N; i++) {
    if (i > 0 && i % S.per === 0) {
      if (z <= zz && z > zz - S.landing) return S.rise * i;
      zz -= S.landing;
    }
    if (z <= zz && z > zz - S.run) return S.rise * (i + 1);
    zz -= S.run;
  }
  return z > S.zStart ? 0 : M.yBase;
}

const UX = 12.0, UY = 6.0;    // 瓦爿贴图：4096×2048px = 12.0m × 6.0m（墙面只重复 12 次）
const BX = 2.4, BY = 4.8;      // 竹模贴图：2.4m 宽 × 4.8m 高

export function buildMuseum() {
  const group = new THREE.Group();
  group.name = 'ningbo-museum';
  const hideDuringReflect = [];
  const glowEmissive = [];      // { mat, max } —— 带 emissive 的（窗、门）
  const glowBasic = [];         // { mat, max } —— 用 opacity 做的（台阶灯带）
  const glowLights = [];        // { light, day, night } —— 真实点光源（门厅）

  // ---------------- 材质 ----------------
  const wap = wapanTexture();
  const matWapan = toonMat({ map: wap.map, bumpMap: wap.bump, bumpScale: 0.6 });
  const bam = bambooConcreteTexture();
  const matBamboo = toonMat({ map: bam.map, bumpMap: bam.bump, bumpScale: 0.45, color: 0xf0ece2 });
  const roofTex = roofTileTexture();
  const matTile = toonMat({ map: roofTex.map, bumpMap: roofTex.bump, bumpScale: 0.9 });
  const matGranite = toonMat({ map: graniteTexture() });
  const matSlab = toonMat({ color: NC.slab });
  const matSlabDark = toonMat({ color: 0x6f7578 });
  const matCourse = toonMat({ map: graniteTexture(), color: 0x9a978e });   // 线脚：压暗的花岗岩
  const matDeep = new THREE.MeshStandardMaterial({ color: 0x1e2326, roughness: 0.95, metalness: 0.0 });   // 窗洞/百叶后的"室内暗部"：玻璃后面必须是暗的，不能是墙
  const matFrame = toonMat({ color: 0x8b8781 });
  const matStair = toonMat({ color: 0xb9bcb8 });
  const matDeck = toonMat({ map: deckTexture(), color: 0xffffff });
  const matDark = toonMat({ color: 0x3c3b38 });
  const matWood = toonMat({ color: NC.wood });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.72, roughness: 0.44 });
  const matGlassRoof = new THREE.MeshStandardMaterial({   // 屋面天窗：夜里保持暗色（不共用 matGlass 的暖光自发光）
    map: glassSheenTexture(), color: 0x9fb6c2, metalness: 0.6, roughness: 0.18,
    transparent: true, opacity: 0.72, side: THREE.DoubleSide,
  });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x9fc4d2, map: glassSheenTexture(), transparent: true, opacity: 0.62,
    metalness: 0.35, roughness: 0.14, emissive: 0x1a2a30, emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
  });
  const sign = museumSignTexture();
  const matSign = toonMat({ map: sign.map, bumpMap: sign.bump, bumpScale: 0.55 });
  const matWindow = new THREE.MeshStandardMaterial({
    map: windowSheenTexture(), color: 0xa9c4d0, metalness: 0.55, roughness: 0.14,
    emissive: 0xffc07a, emissiveIntensity: 0,
  });
  glowEmissive.push({ mat: matWindow, max: 0.62 });

  // 斜壁（内收 6.5°）上的附着物：z 必须按高度算，并跟着倾斜，否则越高离墙越远（"浮空"）
  const BATTER = 0.115;
  const BATTER_ROT = Math.atan(BATTER);
  const faceZ = (y, sgn) => (sgn < 0 ? zN + (y - yBase) * BATTER - 0.02 : zS - (y - yBase) * BATTER + 0.02);
  const faceAttach = (geo, y, sgn) => {         // 先绕自身中心倾斜，再平移到该高度的墙面
    geo.rotateX(sgn < 0 ? BATTER_ROT : -BATTER_ROT);
    return geo;
  };
  // 墙面真实位置与"距墙面 d 米（向外为正）"：向外方向恒为 +sgn（sgn=-1 是北面，外侧是 -z）
  const zwall = (y, sgn) => faceZ(y, sgn) + sgn * 0.02;
  const outAt = (y, sgn, d) => zwall(y, sgn) + sgn * d;

  const add = (geo, mat, opts) => {
    if (!geo) return null;
    const m = meshOf(geo, mat, opts);
    group.add(m);
    return m;
  };
  const addGlass = (geo) => {
    const m = new THREE.Mesh(geo, matGlass);
    m.castShadow = false; m.receiveShadow = false;
    group.add(m);
    return m;
  };

  const { x0: xW, x1: xE, z0: zN, z1: zS, yPl, yBase } = M;
  const P = M.portal, CA = M.canyon, T = M.wallT;
  const wall = (r) => add(prismG(r, UX, UY, 'nswetop'), matWapan);

  // ---------------- 台基（花岗岩，外扩 2.2m）----------------
  const PL = 2.2, zPlN = zN - PL - 8;
  add(prismG({
    bx0: xW - PL, bx1: xE + PL, bz0: zPlN, bz1: zS + PL,
    y0: -1.2, y1: yPl,
  }, 3, 3, 'nswetop'), matGranite);
  {
    const g = [];
    for (let i = 0; i < 3; i++) {
      g.push(prismG({
        bx0: -76, bx1: 76, bz0: zPlN - 0.66 - i * 0.66, bz1: zPlN - i * 0.66,
        y0: yPl - 0.19 - i * 0.19, y1: yPl - i * 0.19,
      }, 3, 3, 'nswetop'));
    }
    add(mergeGeos(g), matGranite);
  }
  {
    const g = [];                                   // 西侧大台阶（进入裂口）
    for (let i = 0; i < 4; i++) {
      g.push(prismG({
        bx0: xW - PL - 0.95 - i * 0.95, bx1: xW - PL - i * 0.95, bz0: -22.5, bz1: 22.5,
        y0: yPl - 0.14 - i * 0.14, y1: yPl - i * 0.14,
      }, 3, 3, 'nswetop'));
    }
    add(mergeGeos(g), matGranite);
  }

  // ---------------- 基座：瓦爿墙直壁（y 0.55 → 10.5）----------------
  const wallBox = (bx0, bx1, bz0, bz1) => wall({ bx0, bx1, bz0, bz1, y0: yPl, y1: yBase });
  wallBox(xW, xE, zN, zN + T);                                     // 北立面（完整）
  wallBox(xW, CA.x0, zS - T, zS);                                  // 南立面西段
  wallBox(CA.x1, xE, zS - T, zS);                                  // 南立面东段
  wallBox(xW, xW + T, zN, P.z0);                                   // 西立面北墙墩
  wallBox(xW, xW + T, P.z1, zS);                                   // 西立面南墙墩
  wallBox(xE - T, xE, zN, zS);                                     // 东立面
  wallBox(P.x0, P.x1 + T, P.z0 - T, P.z0);                         // 裂口北侧壁
  wallBox(P.x0, P.x1 + T, P.z1, P.z1 + T);                         // 裂口南侧壁
  wallBox(P.x1, P.x1 + T, P.z0, P.z1);                             // 裂口尽端墙
  wallBox(CA.x0 - T, CA.x0, CA.z0 - T, CA.z1);                     // 山谷西壁
  wallBox(CA.x1, CA.x1 + T, CA.z0 - T, CA.z1);                     // 山谷东壁
  wallBox(CA.x0, CA.x1, CA.z0 - T, CA.z0);                         // 山谷尽端墙

  // ---------------- 石裙 + 压顶线脚 ----------------
  {
    const skirt = [], S = 0.44, yS = yPl + S / 2 + 0.02;
    const s = (w, d, x, z) => skirt.push(boxG(w, S, d, x, yS, z));
    s(xE - xW + 0.06, T + 0.06, 0, zN + T / 2);
    s(CA.x0 - xW, T + 0.06, (xW + CA.x0) / 2, zS - T / 2);
    s(xE - CA.x1, T + 0.06, (CA.x1 + xE) / 2, zS - T / 2);
    s(T + 0.06, P.z0 - zN, xW + T / 2, (zN + P.z0) / 2);
    s(T + 0.06, zS - P.z1, xW + T / 2, (P.z1 + zS) / 2);
    s(T + 0.06, zS - zN, xE - T / 2, 0);
    s(P.x1 - P.x0, T + 0.06, (P.x0 + P.x1) / 2, P.z0 - T / 2);
    s(P.x1 - P.x0, T + 0.06, (P.x0 + P.x1) / 2, P.z1 + T / 2);
    s(T + 0.06, P.z1 - P.z0, P.x1 + T / 2, 0);
    add(mergeGeos(skirt), matSlabDark);
  }
  {
    const caps = [], yC = yBase + 0.02;
    const c = (w, d, x, z) => caps.push(boxG(w, 0.34, d, x, yC, z));
    c(xE - xW + 0.12, T + 0.14, 0, zN + T / 2);
    c(CA.x0 - xW + 0.06, T + 0.14, (xW + CA.x0) / 2, zS - T / 2);
    c(xE - CA.x1 + 0.06, T + 0.14, (CA.x1 + xE) / 2, zS - T / 2);
    c(T + 0.14, P.z0 - zN, xW + T / 2, (zN + P.z0) / 2);
    c(T + 0.14, zS - P.z1, xW + T / 2, (P.z1 + zS) / 2);
    c(T + 0.14, zS - zN, xE - T / 2, 0);
    c(P.x1 - P.x0 + T, T + 0.14, (P.x0 + P.x1 + T) / 2, P.z0 - T / 2);
    c(P.x1 - P.x0 + T, T + 0.14, (P.x0 + P.x1 + T) / 2, P.z1 + T / 2);
    c(T + 0.14, P.z1 - P.z0, P.x1 + T / 2, 0);
    add(mergeGeos(caps), matGranite);
  }

  // ---------------- 基座顶平台（避开山谷开口；裂口上方即其顶棚）----------------
  const terr = (x0, x1, z0, z1) => add(prismG({
    bx0: x0, bx1: x1, bz0: z0, bz1: z1, y0: yBase, y1: yBase + 0.28,
  }, 2.4, 2.4, 'nswetopbot'), matDeck);
  terr(xW, CA.x0, zN + T, zS - T);
  terr(CA.x1, xE, zN + T, zS - T);
  terr(CA.x0, CA.x1, zN + T, CA.z0 - T);
  const yT = yBase + 0.28;

  // ---------------- 上部五个体量：竹条模板混凝土斜壁（墙顶跟着屋面起坡）+ 单坡屋面 ----------------
  for (const v of M.vols) {
    const yLo = Math.min(v.yE, v.yR);
    const west = v.yE, east = v.yR;
    const plane = (x) => west + (east - west) * ((x - v.x0) / (v.x1 - v.x0));   // 屋面基准面
    const inset = (yLo - yBase) * 0.115;                     // 斜壁内收（约 6.5°）
    // 关键：ty0/ty1 让墙顶沿 x 起坡、贴在屋面下皮（原来是平顶 → 高端屋顶悬空 6m）
    add(prismG({
      bx0: v.x0, bx1: v.x1, bz0: zN, bz1: zS,
      tx0: v.x0 + 0.6, tx1: v.x1 - 0.6, tz0: zN + inset, tz1: zS - inset,
      y0: yBase, y1: yLo,
      ty0: plane(v.x0) - 0.30, ty1: plane(v.x1) - 0.30,
    }, BX, BY, 'nswetop'), matBamboo);
    // 斜壁上的竖向分缝（细，12m 一道）
    const joints = [];
    const jy = yBase + (yLo - yBase) * 0.46;
    for (let x = v.x0 + 12; x < v.x1 - 3; x += 12) {
      for (const sgn of [-1, 1]) {
        const g = faceAttach(boxG(0.07, (yLo - yBase) * 0.92, 0.1, 0, 0, 0), jy, sgn);
        g.translate(x, jy, faceZ(jy, sgn));
        joints.push(g);
      }
    }
    if (joints.length) add(mergeGeos(joints), matSlabDark);
    // 檐下结构：椽子（每 1.35m 一根，从墙里伸到檐口）+ 两道斜檐檩
    const struct = [];
    // 檐檩/封檐板必须按屋面"折线"分两段走，不能一条直线（否则在折点处偏离屋面 1.15m）
    const xFold = v.x0 + (v.x1 - v.x0) * 0.58;
    const yFold = west + (east - west) * 0.58 + 1.15;
    const beams = [], fascia2 = [];
    for (const [xa, xc, ya, yc] of [[v.x0, xFold, west, yFold], [xFold, v.x1, yFold, east]]) {
      const ang = Math.atan2(yc - ya, xc - xa);
      const len = (xc - xa) + 0.9;
      for (const zz of [zN - 0.26, zS + 0.26]) {
        const g = boxG(len - 0.7, 0.24, 0.24, 0, 0, 0);   // 端头也不超出山墙挑檐
        g.rotateZ(ang);
        g.translate((xa + xc) / 2, (ya + yc) / 2 - 0.54, zz);
        beams.push(g);
      }
      for (const zz of [zN - 0.56, zS + 0.56]) {
        const g = boxG(len + 0.6, 0.26, 0.16, 0, 0, 0);
        g.rotateZ(ang);
        g.translate((xa + xc) / 2, (ya + yc) / 2 - 0.30, zz);
        fascia2.push(g);
      }
      // 檐下椽子也跟着各坡段的高度
      for (let x = xa + 0.7; x < xc + 0.6; x += 1.35) {
        const yy = ya + (yc - ya) * ((x - xa) / Math.max(1e-3, xc - xa));
        for (const zz of [zN - 0.14, zS + 0.14]) {
          const g = boxG(0.15, 0.18, 0.86, 0, 0, 0);   // 长度收在 0.55m 挑檐之内，不再伸出屋面
          g.translate(x, yy - 0.50, zz);
          struct.push(g);
        }
      }
    }
    add(mergeGeos(beams), matWood);
    add(mergeGeos(fascia2), matSlabDark);
    add(mergeGeos(struct), matWood);   // 檐下椽子
    // 两段折坡屋面
    const D = (zS - zN) + 1.1;      // 挑檐从 1.3m 收到 0.55m（原来檐口构件离墙太远像浮空）
    const xb = v.x0 + (v.x1 - v.x0) * 0.58;
    const yb = west + (east - west) * 0.58 + 1.15;
    const segs = [[v.x0, xb, west, yb], [xb, v.x1, yb, east]];
    segs.forEach(([xa, xc, ya, yc]) => {
      const Ls = (xc - xa) + 0.9;
      const ang = Math.atan2(yc - ya, xc - xa);
      const slab = prismG({
        bx0: -Ls / 2, bx1: Ls / 2, bz0: -D / 2, bz1: D / 2, y0: -0.44, y1: 0.44,
      }, 1.8, 1.8, 'nswetopbot');
      slab.rotateZ(ang);
      slab.translate((xa + xc) / 2, (ya + yc) / 2 - 0.34, 0);
      add(slab, matTile);
    });
    // 屋面高度（含折点；+0.46 是屋面板上表面到板中面的距离）
    const roofY = (x) => {
      if (x <= xb) return west + (yb - west) * ((x - v.x0) / Math.max(1e-3, xb - v.x0)) + 0.46;
      return yb + (east - yb) * ((x - xb) / Math.max(1e-3, v.x1 - xb)) + 0.46;
    };
    // 高端石压顶 + 低端滴水檐
    const hiX = west > east ? v.x0 : v.x1, loX = west > east ? v.x1 : v.x0;
    const hiY = Math.max(west, east), loY = Math.min(west, east);
    add(boxG(1.7, 0.38, D, hiX + (hiX === v.x1 ? -0.85 : 0.85), hiY - 0.02, 0), matGranite);
    add(boxG(0.85, 0.34, D + 0.12, loX + (loX === v.x1 ? -0.42 : 0.42), loY - 0.64, 0), matSlabDark);
    add(boxG(1.3, 0.34, D + 0.1, xb, yb + 0.30, 0), matGranite);
  }

  // ---------------- V4：山谷大台阶尽端上方的缝隙补玻璃幕（否则台阶尽头一孔漏天、能看见远山与城市）----------------
  {
    const gapX0 = 10, gapX1 = 14;                 // V3(x−10..10) 与 V4(x14..42) 之间的缝
    const g0 = [], g1 = [];
    const zA = CA.z0 - 0.2, zB = CA.z1 + 0.2, depth = zB - zA;
    for (const [xa, xb] of [[gapX0, gapX1]]) {
      const w = xb - xa;
      // 高度 7.4 → 13.4：原来只到 18.2m，而两侧屋面到 23m+，上方露出 4.8m 的露天缺口（agy N2）
      g0.push(boxG(w - 0.3, 13.4, depth - 0.3, (xa + xb) / 2, yT + 6.9, (zA + zB) / 2));
      for (let z = zA + 1.2; z < zB; z += 2.2) g1.push(boxG(w - 0.2, 0.16, 0.14, (xa + xb) / 2, yT + 6.9, z));
      for (const yy of [yT + 0.4, yT + 3.6, yT + 6.9, yT + 10.2, yT + 13.4]) g1.push(boxG(w - 0.2, 0.2, depth - 0.2, (xa + xb) / 2, yy, (zA + zB) / 2));
      g1.push(boxG(w + 0.3, 0.42, depth + 0.3, (xa + xb) / 2, yT + 13.7, (zA + zB) / 2));   // 顶部过梁
    }
    const gm = new THREE.Mesh(mergeGeos(g0), matGlass);
    gm.castShadow = false; gm.receiveShadow = false;
    group.add(gm);
    add(mergeGeos(g1), matSlabDark);
  }

  // ---------------- 量体之间的天光缝：玻璃采光顶 + 绿化小景 ----------------
  for (let i = 0; i < M.vols.length - 1; i++) {
    const gx0 = M.vols[i].x1, gx1 = M.vols[i + 1].x0, w = gx1 - gx0, gx = (gx0 + gx1) / 2;
    addGlass(boxG(w - 0.4, 0.12, zS - zN - 2.6, gx, yT + 0.16, 0));
    const bars = [];
    for (let z = zN + 1.3; z < zS - 1.3; z += 2.2) bars.push(boxG(w - 0.4, 0.14, 0.1, gx, yT + 0.24, z));
    bars.push(boxG(0.16, 0.18, zS - zN - 2.6, gx0 + 0.14, yT + 0.26, 0));
    bars.push(boxG(0.16, 0.18, zS - zN - 2.6, gx1 - 0.14, yT + 0.26, 0));
    add(mergeGeos(bars), matSteel);
    // 缝隙两侧的花池 + 种植土
    const boxes = [], soil = [];
    for (const bx of [gx - (w / 2 - 0.62), gx + (w / 2 - 0.62)]) {
      for (const zz of [zN + 7, zS - 9]) {
        boxes.push(boxG(0.98, 0.6, 5.4, bx, yT + 0.3, zz));
        soil.push(boxG(0.82, 0.22, 5.2, bx, yT + 0.62, zz));
      }
    }
    add(mergeGeos(boxes), matGranite);
    add(mergeGeos(soil), toonMat({ color: NC.soil }));
  }

  // ---------------- 平台栏杆（山谷口一圈）----------------
  {
    const rails = [];
    const post = (x, z) => rails.push(boxG(0.08, 0.98, 0.08, x, yT + 0.5, z));
    const seg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = boxG(len, 0.07, 0.07, 0, 0, 0);
      g.rotateY(Math.atan2(z1 - z0, x1 - x0));
      g.translate((x0 + x1) / 2, yT + 0.94, (z0 + z1) / 2);
      rails.push(g);
    };
    const zRail = zS - T - (yT + 0.5 - yBase) * BATTER - 0.05;   // 站在斜壁内侧，不再悬在墙外
    for (let x = CA.x0 + 0.5; x <= CA.x1 - 0.4; x += 1.5) post(x, CA.z1 - 0.5);
    seg(CA.x0 + 0.5, CA.z1 - 0.5, CA.x1 - 0.4, CA.z1 - 0.5);
    for (const xx of [CA.x0 - 0.5, CA.x1 + 0.5]) {
      for (let z = CA.z0 - 0.5; z <= CA.z1 - 0.5; z += 1.5) post(xx, z);
      seg(xx, CA.z0 - 0.5, xx, CA.z1 - 0.5);
    }
    for (let x = xW + 1; x < CA.x0 - 1; x += 3.2) post(x, zRail);
    seg(xW + 1, zRail, CA.x0 - 1.5, zRail);
    for (let x = CA.x1 + 1.5; x < xE - 1; x += 3.2) post(x, zRail);
    seg(CA.x1 + 1.5, zRail, xE - 1, zRail);
    add(mergeGeos(rails), matSteel);
  }

  // ---------------- 山谷大台阶：三段十级 + 两道缓步台（30 级）----------------
  {
    const S = STAIR;
    const cx = (CA.x0 + CA.x1) / 2, w = CA.x1 - CA.x0;
    const steps = [], noses = [], strips = [];
    let z = S.zStart;
    for (let i = 0; i < S.N; i++) {
      if (i > 0 && i % S.per === 0) {                       // 缓步台
        const yL = S.rise * i;
        steps.push(boxG(w, 0.32, S.landing + 0.02, cx, yL - 0.16, z - S.landing / 2));
        strips.push(boxG(w - 1.4, 0.05, 0.1, cx, yL + 0.006, z - S.landing + 0.1));
        z -= S.landing;
      }
      const yTop = S.rise * (i + 1);
      steps.push(boxG(w, S.rise, S.run + 0.04, cx, yTop - S.rise / 2, z - S.run / 2));
      noses.push(boxG(w, 0.055, 0.14, cx, yTop - 0.022, z - 0.07));
      if (i % 5 === 2 && i > 2) strips.push(boxG(w - 1.4, 0.05, 0.1, cx, yTop + 0.006, z - S.run + 0.08));
      z -= S.run;
    }
    add(mergeGeos(steps), matStair);
    add(mergeGeos(noses), matGranite);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.12, fog: false });
    const lm = meshOf(mergeGeos(strips), lightMat, { cast: false, receive: false });
    group.add(lm);
    hideDuringReflect.push(lm);
    glowBasic.push({ mat: lightMat, max: 0.95 });
    // 台阶两侧扶手：立柱 + 随坡度分段的斜扶手（含缓步台水平段）
    const rails = [];
    for (const xx of [CA.x0 + 0.36, CA.x1 - 0.36]) {
      for (let zz = S.zStart - 0.6; zz > S.zEnd; zz -= 1.5) rails.push(boxG(0.09, 1.05, 0.09, xx, stairY(zz) + 0.5, zz));
      for (let zz = S.zStart - 0.6; zz > S.zEnd + 1.2; zz -= 1.5) {
        const y0 = stairY(zz) + 1.0, y1 = stairY(zz - 1.5) + 1.0;
        const seg = boxG(0.08, 0.08, Math.hypot(1.5, y1 - y0), 0, 0, 0);
        seg.rotateX(-Math.atan2(y1 - y0, 1.5));
        seg.translate(xx, (y0 + y1) / 2, zz - 0.75);
        rails.push(seg);
      }
    }
    add(mergeGeos(rails), matSteel);
  }

  // ---------------- 西端裂口内的入口（玻璃幕 + 雨棚 + 馆名牌 + 石球）----------------
  {
    const gx = -58, gw = 22, gh = 9.2;
    addGlass(boxG(0.18, gh, gw, gx, yPl + gh / 2, 0));
    const frames = [];
    for (let z = -gw / 2; z <= gw / 2 + 0.01; z += 1.9) frames.push(boxG(0.28, gh, 0.14, gx, yPl + gh / 2, z));
    frames.push(boxG(0.3, 0.34, gw, gx, yPl + gh, 0));
    frames.push(boxG(0.34, 0.44, gw, gx, yPl + 0.22, 0));
    frames.push(boxG(0.28, 0.2, gw, gx, yPl + gh * 0.62, 0));
    add(mergeGeos(frames), matSteel);
    // 双开大门（夜间透暖光）
    const doorMat = toonMat({ color: 0x4a4640, emissive: 0xffb866, emissiveIntensity: 0 });
    glowEmissive.push({ mat: doorMat, max: 0.8 });
    add(mergeGeos([boxG(0.22, 3.7, 3.7, gx + 0.14, yPl + 1.85, -2.1), boxG(0.22, 3.7, 3.7, gx + 0.14, yPl + 1.85, 2.1)]), doorMat, { cast: false });
    // 雨棚 + 支柱
    add(boxG(5.4, 0.52, 16.5, gx - 3.0, yPl + gh - 0.2, 0), matSlabDark);
    const cols = [];
    for (const z of [-7.2, 0, 7.2]) cols.push(cylG(0.22, 0.22, gh - 0.4, 10, gx - 5.4, yPl + (gh - 0.4) / 2, z));
    add(mergeGeos(cols), matSteel);
    // 裂口地面直接用台基花岗岩顶面（原来又铺一层、只差 2cm → 边缘闪面）
    // 门口石球
    const balls = [];
    for (let z = -9; z <= 9; z += 3) balls.push(sphG(0.42, gx - 8.2, yPl + 0.36, z, 12));
    add(mergeGeos(balls), matGranite);
    // 馆名牌（贴在西立面南墙墩外侧）
    for (const zz of [26.4, -26.4]) {
      const s = new THREE.Mesh(boxG(0.14, 2.2, 8.4, xW - 0.09, 5.05, zz), matSign);   // 落在 3.5/6.7 两道线脚之间
      s.castShadow = false;
      group.add(s);
    }
  }

  // ---------------- 斜壁窄缝窗：暗色洞口 + 亮色压条 + 玻璃 + 竖梃（夜间透暖光）----------------
  {
    const winG = [], frameD = [], frameL = [], mull = [], deepD = [];
    for (const v of M.vols) {
      const yLo = Math.min(v.yE, v.yR);
      for (let k = 0; k < 2; k++) {
        const wx = (v.x0 + v.x1) / 2 + (k ? 5.2 : -6.2);
        const wl = 5.2 - k * 1.8;                     // 窄长缝窗（原来 6.5×1.15 像一块空白灰板）
        const wy = yBase + (yLo - yBase) * (0.30 + k * 0.26);
        for (const sgn of [-1, 1]) {
          // 由外向内：压条(0.20) → 框(0.10) → 玻璃(0.10) → 暗底板(0.01)
          for (const [dw, dh, dx, dy] of [[wl + 0.5, 0.22, 0, 0.585], [wl + 0.5, 0.22, 0, -0.585],
            [0.22, 1.39, -(wl + 0.5) / 2 + 0.11, 0], [0.22, 1.39, (wl + 0.5) / 2 - 0.11, 0]]) {
            const fr = faceAttach(boxG(dw, dh, 0.26, 0, 0, 0), wy + dy, sgn);
            fr.translate(wx + dx, wy + dy, outAt(wy + dy, sgn, 0.10));
            frameD.push(fr);
          }
          const gl = faceAttach(boxG(wl, 0.95, 0.10, 0, 0, 0), wy, sgn);
          gl.translate(wx, wy, outAt(wy, sgn, 0.10));
          winG.push(gl);
          for (const f of [-0.25, 0.25]) {
            const b2 = faceAttach(boxG(0.07, 0.95, 0.13, 0, 0, 0), wy, sgn);
            b2.translate(wx + wl * f, wy, outAt(wy, sgn, 0.16));
            mull.push(b2);
          }
          for (const dy of [0.72, -0.72]) {
            const tr = faceAttach(boxG(wl + 0.66, 0.07, 0.18, 0, 0, 0), wy + dy, sgn);
            tr.translate(wx, wy + dy, outAt(wy + dy, sgn, 0.21));
            frameL.push(tr);
          }
          const bk = faceAttach(boxG(wl + 0.02, 0.99, 0.06, 0, 0, 0), wy, sgn);
          bk.translate(wx, wy, outAt(wy, sgn, 0.015));
          deepD.push(bk);
        }
      }
    }
    // 直墙上的竖缝窗：与斜壁条窗同一套做法（深色洞口 + 亮色压条 + 玻璃 + 横向分格）
    // —— 上一轮只改了斜壁那批，直墙这批还是"黑竖条"，所以看起来像只修了一半
    const vSlit = (wx, wy, sgn) => {
      const zz = sgn < 0 ? zN : zS;                 // 直墙，无收分
      const o = (d) => zz + sgn * d;                // 距墙面 d（向外为正）
      for (const [dw, dh, dx, dy] of [[0.98, 0.22, 0, 2.32], [0.98, 0.22, 0, -2.32],
        [0.22, 4.9, -0.4, 0], [0.22, 4.9, 0.4, 0]]) {
        frameD.push(boxG(dw, dh, 0.26, wx + dx, wy + dy, o(0.10)));
      }
      winG.push(boxG(0.5, 4.5, 0.1, wx, wy, o(0.10)));
      for (const dy of [1.5, 0, -1.5]) mull.push(boxG(0.44, 0.06, 0.13, wx, wy + dy, o(0.16)));
      for (const dx of [-0.5, 0.5]) frameL.push(boxG(0.07, 4.98, 0.18, wx + dx, wy, o(0.21)));
      for (const dy of [2.42, -2.42]) frameL.push(boxG(1.05, 0.07, 0.18, wx, wy + dy, o(0.21)));
      deepD.push(boxG(0.54, 4.54, 0.06, wx, wy, o(0.015)));
    };
    for (const x of [30, 40, 52, 62, 68]) vSlit(x, 5.4, -1);
    for (const x of [-30, -16, 26, 44, 58]) vSlit(x, 5.4, 1);
    // 东、西立面各一条（沿 z 方向，单独处理）
    for (const [xx, wz, sgn] of [[xW + 0.06, -26, -1], [xE - 0.06, 12, 1]]) {
      winG.push(boxG(0.1, 4.5, 0.5, xx - sgn * 0.03, 5.6, wz));
      frameD.push(boxG(0.24, 0.18, 0.86, xx + sgn * 0.05, 7.94, wz));
      frameD.push(boxG(0.24, 0.18, 0.86, xx + sgn * 0.05, 3.26, wz));
      frameD.push(boxG(0.24, 4.9, 0.18, xx + sgn * 0.05, 5.6, wz - 0.34));
      frameD.push(boxG(0.24, 4.9, 0.18, xx + sgn * 0.05, 5.6, wz + 0.34));
      for (const dz of [-0.42, 0.42]) frameL.push(boxG(0.18, 4.98, 0.07, xx - sgn * 0.05, 5.6, wz + dz));
      for (const dy of [2.42, -2.42]) frameL.push(boxG(0.18, 0.07, 0.92, xx - sgn * 0.05, 5.6 + dy, wz));
      for (const dy of [1.5, 0, -1.5]) mull.push(boxG(0.13, 0.06, 0.44, xx - sgn * 0.07, 5.6 + dy, wz));
    }
    add(mergeGeos(frameD), matSlabDark);
    add(mergeGeos(frameL), matFrame);
    add(mergeGeos(mull), matFrame);
    add(mergeGeos(deepD), matDeep);   // 窗洞暗部
    const wm = meshOf(mergeGeos(winG), matWindow, { cast: false, receive: false });
    group.add(wm);
  }

  // ---------------- 落水管 ----------------
  {
    const pipes = [];
    for (let x = xW + 12; x < xE; x += 16) {
      // 管子贴到离墙 0.07m（原来 0.14m 悬空、且没有抱箍与接水斗 —— agy N3）
      for (const [px, pz] of [[x, zN - 0.21], [x + 7, zS + 0.21]]) {
        pipes.push(cylG(0.14, 0.14, yBase - yPl - 0.5, 8, px, (yBase + yPl) / 2 - 0.25, pz));
        pipes.push(boxG(0.5, 0.34, 0.5, px, yBase - 0.5, pz));                  // 顶部接水斗
        for (let yy = yPl + 2.6; yy < yBase - 1.2; yy += 2.9) {                 // 每 ~3m 一道抱箍
          pipes.push(boxG(0.34, 0.12, 0.2, px, yy, pz + (pz < 0 ? 0.1 : -0.1)));
          pipes.push(boxG(0.06, 0.3, 0.42, px, yy, pz + (pz < 0 ? 0.2 : -0.2)));
        }
      }
    }
    add(mergeGeos(pipes), matSlabDark);
  }

  // ---------------- 平台上的点景方亭（园林"一步一景"）----------------
  {
    const px = -24, pz = -22;
    const posts = [];
    for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) {
      posts.push(boxG(0.26, 3.2, 0.26, px + dx, yT + 1.6, pz + dz));
    }
    add(mergeGeos(posts), matWood);
    add(boxG(6.0, 0.42, 6.0, px, yT + 3.4, pz), matWood);
    const roof = prismG({
      bx0: -3.7, bx1: 3.7, bz0: -3.7, bz1: 3.7, tx0: -1.4, tx1: 1.4, tz0: -1.4, tz1: 1.4, y0: 0, y1: 1.8,
    }, 2, 2, 'nswetop');
    roof.translate(px, yT + 3.62, pz);
    add(roof, matTile);
    add(boxG(0.55, 0.4, 0.55, px, yT + 5.6, pz), matGranite);
    // 亭前的几块景石
    const rocks = [];
    for (let i = 0; i < 5; i++) {
      const r = 0.5 + i * 0.08;
      const g = new THREE.IcosahedronGeometry(r, 0);
      g.scale(1.3, 0.8, 1.1);
      g.translate(px + 4.5 + i * 1.4, yT + r * 0.35, pz + 3.0 + (i % 2) * 1.2);
      rocks.push(g);
    }
    add(mergeGeos(rocks), toonMat({ color: 0x8b8d87 }));
  }


  // ---------------- 细节层 1：瓦爿墙分层石线脚 + 墙顶滴水嘴 ----------------
  {
    const courses = [];
    const band = (w, d, x, z) => { const g = boxG(w, 0.13, d, 0, 0, 0); g.translate(x, 0, z); return g; };
    for (const y of [3.5, 6.7, 9.55]) {
      for (const g of [
        band(xE - xW, 0.13, 0, zN - 0.06),
        band(CA.x0 - xW, 0.13, (xW + CA.x0) / 2, zS + 0.06),
        band(xE - CA.x1, 0.13, (CA.x1 + xE) / 2, zS + 0.06),
        band(0.13, zS - zN, xE + 0.06, 0),
        band(0.13, P.z0 - zN, xW - 0.06, (zN + P.z0) / 2),
        band(0.13, zS - P.z1, xW - 0.06, (P.z1 + zS) / 2),
      ]) { g.translate(0, y, 0); courses.push(g); }
    }
    add(mergeGeos(courses), matCourse);   // 偏暗的花岗岩：不再把瓦爿墙切成一格格"笼子"（agy V2/风格）
    const scup = [];
    for (let x = xW + 13; x < xE - 6; x += 13) {
      scup.push(boxG(0.34, 0.22, 0.3, x, yBase - 0.42, zN - 0.16));
      scup.push(boxG(0.34, 0.22, 0.3, x + 6, yBase - 0.42, zS + 0.16));
    }
    add(mergeGeos(scup), matSlabDark);
    // 墙顶檐沟：滴水嘴下方一道连续的浅槽，否则滴水嘴像外粘的悬空方块（agy V8）
    const gut = [];
    for (let x = xW + 13; x < xE - 6; x += 13) {
      gut.push(boxG(13.0, 0.1, 0.36, x + 3, yBase - 0.62, zN - 0.18));
      gut.push(boxG(13.0, 0.1, 0.36, x + 9, yBase - 0.62, zS + 0.18));
    }
    add(mergeGeos(gut), matSlab);
  }

  // ---------------- 细节层 2：檐口瓦当 + 封檐板 + 正脊瓦 ----------------
  {
    const caps = [], ridge = [];
    for (const v of M.vols) {
      const west = v.yE, east = v.yR;
      const loX = west > east ? v.x1 : v.x0, loY = Math.min(west, east);
      const dir = loX === v.x1 ? -1 : 1;
      for (let z = zN - 0.46; z <= zS + 0.46; z += 0.56) {        // 瓦当（筒瓦端头）
        const g = cylG(0.16, 0.16, 0.34, 7);
        g.rotateZ(Math.PI / 2);
        g.translate(loX + dir * 0.44, loY - 0.30, z);
        caps.push(g);
      }
      const xb = v.x0 + (v.x1 - v.x0) * 0.58;
      const yb = west + (east - west) * 0.58 + 1.15 + 0.32;
      for (let z = zN - 0.4; z <= zS + 0.4; z += 0.82) {          // 正脊瓦：抬到压脊石之上
        const g = cylG(0.21, 0.21, 0.84, 7);
        g.rotateX(Math.PI / 2);
        g.translate(xb, yb + 0.30, z);
        ridge.push(g);
      }
    }
    add(mergeGeos(caps), matTile);
    add(mergeGeos(ridge), matSlabDark);
  }

  // ---------------- 细节层 3：百叶通风口 + 竖缝窗分格 ----------------
  {
    const louv = [], bars = [], louvDeep = [];
    for (const v of M.vols) {
      const yLo = Math.min(v.yE, v.yR);
      for (let k = 0; k < 3; k++) {
        const x = v.x0 + (v.x1 - v.x0) * (0.24 + k * 0.26);
        const y = yBase + (yLo - yBase) * 0.80;   // 百叶抬到窗户高度带之上，避免百叶撞窗
        for (const sgn of [-1, 1]) {
          // 开口框（四边）→ 叶片 → 暗底板
          for (const [dw, dh, dx, dy] of [[2.56, 0.16, 0, 0.55], [2.56, 0.16, 0, -0.55],
            [0.16, 1.26, -1.2, 0], [0.16, 1.26, 1.2, 0]]) {
            const fr = faceAttach(boxG(dw, dh, 0.26, 0, 0, 0), y + dy, sgn);
            fr.translate(x + dx, y + dy, outAt(y + dy, sgn, 0.08));
            louv.push(fr);
          }
          for (let i = 0; i < 5; i++) {
            const yy2 = y - 0.34 + i * 0.17;
            const sl = faceAttach(boxG(2.3, 0.14, 0.20, 0, 0, 0), yy2, sgn);
            sl.translate(x, yy2, outAt(yy2, sgn, 0.14));
            louv.push(sl);
          }
          const bk = faceAttach(boxG(2.3, 1.02, 0.06, 0, 0, 0), y, sgn);
          bk.translate(x, y, outAt(y, sgn, 0.015));
          louvDeep.push(bk);
        }
      }
      // 竖缝窗的竖向分格（两扇）
      for (let k = 0; k < 2; k++) {
        const wx = (v.x0 + v.x1) / 2 + (k ? 4.5 : -5.5);
        const wl = 6.5 - k * 1.6;
        const wy = yBase + (yLo - yBase) * (0.30 + k * 0.26);
        for (const sgn of [-1, 1]) {
          const zz = faceZ(wy, sgn);
          for (const f of [-0.25, 0.25]) {
            const b = faceAttach(boxG(0.09, 1.18, 0.1, 0, 0, 0), wy, sgn);
            b.translate(wx + wl * f, wy, zz - sgn * 0.05);
            bars.push(b);
          }
        }
      }
    }
    add(mergeGeos(louv), matSlabDark);
    add(mergeGeos(louvDeep), matDeep);
    add(mergeGeos(bars), matFrame);
  }

  // ---------------- 细节层 4：裂口洗墙灯 + 门厅（展板/接待台/铜牌/围挡）----------------
  {
    const wash = [];
    for (let z = -17; z <= 17; z += 4.2) wash.push(boxG(0.34, 0.16, 0.5, P.x0 + 0.62, yBase - 0.5, z));
    const wm = toonMat({ color: 0x2c2e30, emissive: 0xffc98a, emissiveIntensity: 0 });
    glowEmissive.push({ mat: wm, max: 1.7 });
    add(mergeGeos(wash), wm);
    // 门厅背景墙上的展板（夜间微亮）
    const pm = toonMat({ map: posterTexture(), emissive: 0xffd0a0, emissiveIntensity: 0 });
    glowEmissive.push({ mat: pm, max: 0.30 });
    const pg = new THREE.PlaneGeometry(7.4, 3.7);
    pg.rotateY(-Math.PI / 2);
    pg.translate(P.x1 - 0.07, yPl + 4.4, 0);
    group.add(meshOf(pg, pm, { cast: false, receive: false }));
    // 接待台 + 台面
    add(boxG(4.4, 1.12, 1.2, -47.5, yPl + 0.56, -7.5), matWood);
    add(boxG(4.7, 0.1, 1.5, -47.5, yPl + 1.16, -7.5), matSlabDark);
    // 铜牌（入口北侧墙墩）
    const bronze = toonMat({ color: 0x6f8a72 });
    add(boxG(0.1, 0.95, 1.7, -60.5, 3.3, P.z0 + 0.12), bronze);
    // 入口围挡（立柱 + 横杆）
    const stan = [];
    for (let i = 0; i < 5; i++) stan.push(cylG(0.045, 0.05, 1.0, 6, -56.6, yPl + 0.5, -4.4 + i * 2.2));
    stan.push(boxG(0.06, 0.06, 9.4, -56.6, yPl + 0.97, 0));
    add(mergeGeos(stan), matSteel);
    // 门厅顶部灯带 + 一盏真实点光源（不然进到裂口里是一片死黑）
    const panels = [];
    for (const z of [-9, 0, 9]) panels.push(boxG(7.6, 0.12, 0.4, -52.5, yBase - 0.06, z));
    group.add(meshOf(mergeGeos(panels), new THREE.MeshBasicMaterial({ color: 0xfff0d4, fog: false }), { cast: false, receive: false }));
    const inLight = new THREE.PointLight(0xffd9a8, 0, 46, 2);
    inLight.position.set(-52.5, yBase - 1.6, 0);
    group.add(inLight);
    glowLights.push({ light: inLight, day: 16, night: 52 });
    // 裂口内的地埋射灯
    const up = [];
    for (const z of [-14, -7, 7, 14]) up.push(boxG(0.3, 0.06, 0.3, P.x0 + 1.6, yPl + 0.06, z));
    const um = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, fog: false });
    const umesh = meshOf(mergeGeos(up), um, { cast: false, receive: false });
    group.add(umesh);
    glowBasic.push({ mat: um, max: 0.85 });
  }


  // ---------------- 细节层 5：墙面展板（临展海报框）----------------
  {
    const ptex = posterTexture();
    const pm = toonMat({ map: ptex, emissive: 0xffd0a0, emissiveIntensity: 0, side: THREE.DoubleSide });
    glowEmissive.push({ mat: pm, max: 0.18 });
    const frames = [];
    const boards = [[-64.5, zN], [-52.5, zN], [34, zN], [50, zN], [-64.5, zS], [34, zS]];
    const geos = [];
    for (const [bx, bz] of boards) {
      const sgn = bz === zN ? -1 : 1;
      const g = new THREE.PlaneGeometry(2.7, 1.75);
      if (sgn < 0) g.rotateY(Math.PI);        // 南立面朝 +z 不用转；北立面才转 180°
      g.translate(bx, 5.1, bz + sgn * 0.14);
      geos.push(g);
      frames.push(boxG(3.0, 2.05, 0.12, bx, 5.1, bz + sgn * 0.07));
    }
    add(mergeGeos(frames), matSlabDark);
    const bm = meshOf(mergeGeos(geos), pm, { cast: false, receive: false });
    group.add(bm);
  }


  // ---------------- 细节层 6：基座洗墙灯（夜间）/ 屋面小体量与风帽 / 雨棚筒灯 / 外墙铜牌 ----------------
  {
    // 洗墙灯：北立面 + 西立面，灯体 + 墙面光晕（加法混合，白天透明）
    const upBodies = [], washes = [];
    const ww = wallWashTexture();
    const pushWash = (x, y, z, face) => {
      const pg = new THREE.PlaneGeometry(4.8, 7.6);
      if (face === 'n') pg.rotateY(Math.PI);
      if (face === 'w') pg.rotateY(-Math.PI / 2);
      if (face === 's') pg.rotateY(0);
      pg.translate(x, y, z);
      washes.push(pg);
    };
    // 灯槽：贴在墙面上的横向条形灯（原来是小立方体悬在离墙 0.62m、离地 0.6m 处）
    const housings = [];
    for (let x = -66; x <= 66; x += 8) {
      housings.push(boxG(0.5, 0.26, 0.14, x, yPl + 0.62, zN - 0.05));
      upBodies.push(boxG(0.4, 0.1, 0.06, x, yPl + 0.62, zN - 0.13));
      pushWash(x, yPl + 3.5, zN - 0.03, 'n');
      if (x >= -40 && x <= 40) {
        housings.push(boxG(0.5, 0.26, 0.14, x + 3, yPl + 0.62, zS + 0.05));
        upBodies.push(boxG(0.4, 0.1, 0.06, x + 3, yPl + 0.62, zS + 0.13));
        pushWash(x + 3, yPl + 3.5, zS + 0.03, 's');
      }
    }
    for (let z = -30; z <= 30; z += 8) {
      if (z > P.z0 - 2 && z < P.z1 + 2) continue;                 // 裂口处不装
      housings.push(boxG(0.14, 0.26, 0.5, xW - 0.05, yPl + 0.62, z));
      upBodies.push(boxG(0.06, 0.1, 0.4, xW - 0.13, yPl + 0.62, z));
      pushWash(xW - 0.03, yPl + 3.5, z, 'w');
    }
    add(mergeGeos(housings), matSlabDark);
    const ubMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false });
    const ubMesh = meshOf(mergeGeos(upBodies), ubMat, { cast: false, receive: false });
    group.add(ubMesh);
    hideDuringReflect.push(ubMesh);   // 不参与描边法线通道 → 不会再被勾出黑边
    const wMat = new THREE.MeshBasicMaterial({ map: ww, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const wMesh = meshOf(mergeGeos(washes), wMat, { cast: false, receive: false });
    group.add(wMesh);
    glowBasic.push({ mat: wMat, max: 0.46 });
    hideDuringReflect.push(wMesh);

    // 屋面上的小体量（出屋面楼梯间 / 设备房）+ 风帽
    const tops = [], caps2 = [];
    for (const [vi, tx, tz, w, d, hh] of [[1, -26, -16, 5.0, 4.2, 3.0], [3, 26, 14, 4.2, 3.6, 2.6], [4, 60, -12, 3.6, 3.2, 2.4]]) {
      const v = M.vols[vi];
      const west = v.yE, east = v.yR;
      const xb = v.x0 + (v.x1 - v.x0) * 0.58;
      const yb = west + (east - west) * 0.58 + 1.15;
      // 屋面沿 x 起坡：小体量若做成水平盒，低侧必然戳穿或悬空。
      // 用踏面范围内屋面最低点作基准，高度再加上整段落差，高侧自然埋进屋面。
      const kx0 = (tx - w / 2 - v.x0) / (v.x1 - v.x0), kx1 = (tx + w / 2 - v.x0) / (v.x1 - v.x0);
      const yRoofLow = west + (east - west) * Math.min(kx0, kx1) + 0.46;
      const dropR = Math.abs((east - west) * (kx1 - kx0));
      const y0r = yRoofLow - 0.18;
      tops.push(prismG({ bx0: tx - w / 2, bx1: tx + w / 2, bz0: tz - d / 2, bz1: tz + d / 2, y0: y0r, y1: y0r + hh + dropR }, 2.4, 2.4, 'nswetop'));
      caps2.push(boxG(w + 0.5, 0.3, d + 0.5, tx, y0r + hh + dropR + 0.12, tz));
      caps2.push(boxG(w + 0.2, 0.12, d + 0.2, tx, y0r + hh + dropR - 0.06, tz));   // 压顶下的一道挑檐线
      caps2.push(boxG(0.16, 2.0, 1.1, tx - w / 2 + 0.02, y0r + 1.3, tz + d * 0.18)); // 检修门
      caps2.push(boxG(0.2, 0.12, 1.3, tx - w / 2 + 0.06, y0r + 2.36, tz + d * 0.18));
      // 风帽（两根出气管）
      for (const dz of [-1.1, 1.1]) {
        const topY = y0r + hh + dropR;
        const g = cylG(0.16, 0.16, 1.4, 6);
        g.translate(tx + w * 0.15, topY - 0.4, tz + dz);
        caps2.push(g);
        const c2 = cylG(0.3, 0.3, 0.16, 8);
        c2.translate(tx + w * 0.15, topY + 0.36, tz + dz);
        caps2.push(c2);
      }
    }
    add(mergeGeos(tops), matBamboo);
    add(mergeGeos(caps2), matSlabDark);

    // 雨棚下的筒灯
    const down = [];
    for (let z = -6.6; z <= 6.6; z += 2.2) { down.push(boxG(0.32, 0.16, 0.32, -60.5, yPl + 8.75, z)); down.push(boxG(0.22, 0.06, 0.22, -60.5, yPl + 8.63, z)); }
    const dm = new THREE.MeshBasicMaterial({ color: 0xfff2d6, fog: false });
    group.add(meshOf(mergeGeos(down), dm, { cast: false, receive: false }));

    // 外墙铜牌（入口两侧 + 北立面一块说明牌）
    const bronze2 = toonMat({ color: 0x6f8a72 });
    add(mergeGeos([
      boxG(0.1, 0.8, 1.5, xW - 0.1, 2.3, 30),
      boxG(1.5, 0.8, 0.1, -50, 2.3, zN - 0.1),
    ]), bronze2);
  }


  // ---------------- 细节层 7：屋面天窗条 / 山墙分缝 / 东立面服务门与设备箱 ----------------
  {
    // 屋面天窗条：每个量体两条，沿坡向的长条玻璃（实景屋面确有采光带）
    const sky = [], frames2 = [];
    for (const v of M.vols) {
      const west = v.yE, east = v.yR;
      const roofAt = (x) => west + (east - west) * ((x - v.x0) / (v.x1 - v.x0));
      const xFold = v.x0 + (v.x1 - v.x0) * 0.58;
      const yFold = west + (east - west) * 0.58 + 1.15;
      const roofSurf = (x) => (x <= xFold
        ? west + (yFold - west) * ((x - v.x0) / (xFold - v.x0))
        : yFold + (east - yFold) * ((x - xFold) / (v.x1 - xFold)));
      const segAng = (x) => (x <= xFold
        ? Math.atan2(yFold - west, xFold - v.x0)
        : Math.atan2(east - yFold, v.x1 - xFold));
      for (const zz of [-14, 14]) {
        for (const t of [0.24, 0.78]) {                    // 避开折脊，落在各坡段中间
          const x = v.x0 + (v.x1 - v.x0) * t;
          const len = 4.2;
          const g = boxG(len, 0.12, 1.15, 0, 0, 0);
          g.rotateZ(segAng(x));
          g.translate(x, roofSurf(x) + 0.56, zz);          // 屋面板上表面 +0.46，这里再抬 0.1
          sky.push(g);
          for (const dz of [-0.72, 0.72]) {
            const f = boxG(len + 0.3, 0.2, 0.16, 0, 0, 0);
            f.rotateZ(segAng(x));
            f.translate(x, roofSurf(x) + 0.50, zz + dz);
            frames2.push(f);
          }
        }
      }
    }
    const skyMesh = new THREE.Mesh(mergeGeos(sky), matGlassRoof);   // 独立材质：夜里不再变成橙色荧光条
    skyMesh.castShadow = false; skyMesh.receiveShadow = false;
    group.add(skyMesh);
    add(mergeGeos(frames2), matSlabDark);

    // 山墙（两端斜壁）上的竖向分缝 + 小百叶
    const seam = [], gableL = [];
    for (const v of M.vols) {
      const yLo = Math.min(v.yE, v.yR);
      const rateX = 0.6 / Math.max(1, yLo - yBase);          // 端面同样内收
      for (const [xx, sgn, hEnd] of [[v.x0, -1, v.yE], [v.x1, 1, v.yR]]) {
        const hh = Math.max(2, hEnd - 0.45 - yBase);
        const yMid = yBase + hh / 2;
        const xAt = (yy) => xx + (yy - yBase) * rateX + sgn * 0.02;
        for (let k = 0; k < 3; k++) {
          const zz = -22 + k * 22;
          const g = boxG(0.1, hh, 0.18, 0, 0, 0);
          g.rotateZ(-sgn * Math.atan(rateX));
          g.translate(xAt(yMid), yMid, zz);
          seam.push(g);
        }
        const yL2 = yBase + hh * 0.62;
        const gl2 = boxG(0.12, 1.1, 1.9, 0, 0, 0);
        gl2.rotateZ(-sgn * Math.atan(rateX));
        gl2.translate(xAt(yL2), yL2, 8);
        gableL.push(gl2);
        for (let i = 0; i < 5; i++) {
          const yy = yL2 - 0.34 + i * 0.17;
          gableL.push(boxG(0.14, 0.11, 1.72, xAt(yy) - sgn * 0.05, yy, 8));
        }
      }
    }
    add(mergeGeos(seam), matSlabDark);
    add(mergeGeos(gableL), matFrame);

    // 东立面：服务门 + 设备箱 + 小雨棚
    const door = boxG(0.16, 2.6, 2.0, xE + 0.02, yPl + 1.3, -18);
    add(door, matFrame);
    add(boxG(0.2, 0.14, 2.4, xE + 0.1, yPl + 2.72, -18), matSlabDark);
    add(mergeGeos([
      boxG(0.3, 1.1, 1.6, xE + 0.1, yPl + 1.5, 26),
      boxG(0.34, 0.14, 1.7, xE + 0.12, yPl + 2.06, 26),
    ]), matSlabDark);
  }


  // ---------------- 细节层 8：平台雨水口 / 边沿灯带 / 平台座椅 ----------------
  {
    const outs = [];
    for (let x = -66; x <= 66; x += 22) {
      outs.push(boxG(0.7, 0.16, 0.7, x, yT + 0.02, zN + 1.5));      // 雨水口（带格栅的方形口）
      outs.push(boxG(0.66, 0.1, 0.05, x, yT + 0.12, zN + 1.5));
      outs.push(boxG(0.7, 0.16, 0.7, x + 8, yT + 0.02, zS - 1.5));
    }
    add(mergeGeos(outs), matSlabDark);
    // 平台边沿灯带（夜间亮）
    const strip = [];
    for (const v of M.vols) {
      strip.push(boxG(v.x1 - v.x0 - 1.0, 0.08, 0.12, (v.x0 + v.x1) / 2, yT + 0.06, zN + 1.05));
      strip.push(boxG(v.x1 - v.x0 - 1.0, 0.08, 0.12, (v.x0 + v.x1) / 2, yT + 0.06, zS - 1.05));
    }
    const sm = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.1, fog: false });
    group.add(meshOf(mergeGeos(strip), sm, { cast: false, receive: false }));
    glowBasic.push({ mat: sm, max: 0.8 });
    // 平台上的两张长椅（看风景用）
    const seats = [];
    for (const [sx, sz] of [[-40, -14], [30, 12]]) {
      seats.push(prismG({ bx0: sx - 1.0, bx1: sx + 1.0, bz0: sz - 0.24, bz1: sz + 0.24, y0: yT, y1: yT + 0.44 }, 2, 2, 'nswetop'));
      seats.push(prismG({ bx0: sx - 1.0, bx1: sx + 1.0, bz0: sz - 0.34, bz1: sz - 0.26, y0: yT + 0.44, y1: yT + 0.86 }, 2, 2, 'nswetop'));
    }
    add(mergeGeos(seats), matWood);
  }

  return {
    group, hideDuringReflect, M,
    update(st) {
      const lit = clamp(st.lampF, 0, 1);
      matGlass.emissive.setHex(0x243c44).lerp(new THREE.Color(0xffb069), lit * 0.9);
      matGlass.emissiveIntensity = 0.25 + lit * 0.6;
      matGlass.opacity = 0.6 + lit * 0.14;
      for (const g of glowEmissive) g.mat.emissiveIntensity = g.max * lit;
      for (const g of glowBasic) g.mat.opacity = g.max * lit;
      for (const g of glowLights) g.light.intensity = lerp(g.day, g.night, lit);
    },
    tick(t) {
      const f = 0.93 + 0.07 * Math.sin(t * 0.8);
      for (const g of glowEmissive) g.mat.emissiveIntensity *= f;
      for (const g of glowBasic) g.mat.opacity *= f;
    },
  };
}
