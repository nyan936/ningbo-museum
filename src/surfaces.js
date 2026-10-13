// surfaces.js —— 宁波博物馆特有的程序化材质（第二版：按实拍比例重做瓦爿与竹模）
//  · 瓦爿墙：青砖按真实尺码（约 240×55mm）横砌，瓦片竖砌成带，缸片/龙骨砖点缀，灰缝+苔痕+雨渍
//  · 竹条模板混凝土：竖竹纹（竹竿约 8~10cm）+ 竹节 + 模板拼缝 + 对拉螺栓孔 + 雨水冲刷痕
//  · 回收砖铺装 / 江南青瓦 / 花岗岩条石 / 馆名牌 / 展旗 / 玻璃柔光
// 贴图全部程序化，零外部请求；墙面贴图都配 bump，避免整面墙读成一张贴纸。
import * as THREE from 'three';
import { NC, mulberry32, TAU } from './base.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function tint(col, dh, ds, dl) {
  const c = new THREE.Color(col);
  c.offsetHSL(dh, ds, dl);
  return '#' + c.getHexString();
}
function canvasOf(w, h = w) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}
function texOf(cv, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}
function bumpOf(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// ============================================================
// 1. 瓦爿墙 —— 一张贴图覆盖 3.0m × 3.0m（1px ≈ 2.9mm）
// ============================================================
export function wapanTexture(w = 4096, h = 2048) {
  // 4096×2048 覆盖 12.0m × 6.0m（1px ≈ 2.93mm，与最初 1024px/3m 密度一致）
  // → 144m 长墙面只重复 12 次（原 3m 贴图重复 48 次，机械阵列感一眼可见）
  const R = mulberry32(0x5A17);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(w, h);
  const hv = canvasOf(w, h);
  const g = cv.getContext('2d');
  const b = hv.getContext('2d');
  g.fillStyle = '#4a4841'; g.fillRect(0, 0, w, h);       // 灰浆底
  b.fillStyle = '#4e4e4e'; b.fillRect(0, 0, w, h);

  const GREY = [0x9c9a90, 0x8b8d84, 0xa9a69a, 0x7d8079, 0x95978d, 0xb0ab9f, 0x71756f, 0xa19f96];
  const QING = [0x848e8d, 0x8e9896, 0x7a8482];                  // 青砖偏蓝灰
  const TILE = [0x565750, 0x63645d, 0x4b4c47, 0x6e7067, 0x5c5d56];
  const SHARD = [0x8c5340, 0x7a4a34, 0x9c6b4d, 0x6f5a44, 0xa3765a];
  const BONE = [0x9c6a52, 0x8a5a46, 0xa8795c];

  const brick = (x, y, w, h, col) => {
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, tint(col, 0, 0, 0.045));
    grd.addColorStop(1, tint(col, 0, 0, -0.045));
    g.fillStyle = grd; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(x, y, w, 1.4);
    g.fillStyle = 'rgba(24,22,18,0.22)'; g.fillRect(x, y + h - 1.6, w, 1.6);
    if (R() > 0.90) {                                           // 缺角
      g.fillStyle = 'rgba(74,72,65,0.85)';
      g.fillRect(R() > 0.5 ? x : x + w - 7, R() > 0.5 ? y : y + h - 6, 7, 6);
    }
    b.fillStyle = tint('#b6b6b6', 0, 0, rr(-0.10, 0.10));
    b.fillRect(x, y, w, h);
    b.fillStyle = 'rgba(0,0,0,0.30)'; b.fillRect(x, y + h - 1.4, w, 1.4);
  };
  // 砖面铭文（"福壽"意象）：3~6 笔抽象刻痕
  const glyph = (cx, cy, s) => {
    for (const [ctx, alpha, lw] of [[g, 'rgba(40,36,30,0.42)', 0.1], [b, 'rgba(0,0,0,0.5)', 0.13]]) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      ctx.strokeStyle = alpha; ctx.lineWidth = lw; ctx.lineCap = 'round';
      const st = (pts) => {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      };
      st([[-1, -0.95], [1, -0.95]]);
      st([[0, -0.95], [0, 0.55]]);
      st([[-0.75, -0.32], [0.75, -0.32]]);
      st([[-0.7, 0.12], [0.6, 0.12]]);
      if (R() > 0.4) st([[-0.6, 0.5], [0.6, 0.5]]);
      if (R() > 0.5) st([[-0.45, 0.85], [0.45, 0.85]]);
      ctx.restore();
    }
  };

  // ---- 第一遍：青砖横砌（层高 22~30px ≈ 6.5~9cm，砖长 58~112px ≈ 17~33cm）----
  let y = -6;
  while (y < h) {
    const rowH = ri(22, 30);
    let x = -ri(0, 70);
    while (x < w) {
      const bw = ri(58, 112);
      const bh = rowH - ri(2, 4);
      const p = R();
      const col = p > 0.94 ? SHARD[ri(0, SHARD.length - 1)] : (p > 0.72 ? QING[ri(0, 2)] : GREY[ri(0, GREY.length - 1)]);
      brick(x, y + 2, bw, bh, col);
      if (bw > 76 && bh > 20 && R() > 0.93) glyph(x + bw / 2, y + 2 + bh / 2, bh * 0.24);
      x += bw + ri(2, 4);
    }
    y += rowH;
  }
  // ---- 第二遍：竖砌瓦片带（瓦爿墙最认得出的笔触）----
  for (let k = 0; k < 11; k++) {
    const bx = rr(-30, w - 120), by = rr(-30, h - 80);
    const bw = rr(130, 330), bh = rr(58, 132);
    g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    b.save(); b.beginPath(); b.rect(bx, by, bw, bh); b.clip();
    let x = bx;
    while (x < bx + bw) {
      const sw = ri(4, 6);
      const col = TILE[ri(0, TILE.length - 1)];
      const lg = g.createLinearGradient(x, 0, x + sw, 0);
      lg.addColorStop(0, tint(col, 0, 0, -0.06));
      lg.addColorStop(0.45, tint(col, 0, 0, 0.10));
      lg.addColorStop(1, tint(col, 0, 0, -0.05));
      g.fillStyle = lg; g.fillRect(x, by, sw, bh);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, by, sw, 1.5);
      b.fillStyle = tint('#a0a0a0', 0, 0, rr(-0.12, 0.12)); b.fillRect(x, by, sw, bh);
      b.fillStyle = 'rgba(0,0,0,0.35)'; b.fillRect(x + sw - 1.2, by, 1.2, bh);
      x += sw + ri(1, 1);
    }
    g.restore(); b.restore();
    g.strokeStyle = 'rgba(58,56,50,0.5)'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
  }
  // ---- 第三遍：碎缸片 ----
  for (let k = 0; k < 12; k++) {
    const cx = rr(0, w), cy = rr(0, h), rad = rr(26, 58), n = ri(5, 7);
    const col = SHARD[ri(0, SHARD.length - 1)];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rr(-0.22, 0.22);
      const r0 = rad * rr(0.6, 1.0);
      pts.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8]);
    }
    for (const [ctx, isCol] of [[g, true], [b, false]]) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (isCol) {
        const grd = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
        grd.addColorStop(0, tint(col, 0, 0, 0.10));
        grd.addColorStop(1, tint(col, 0, 0, -0.10));
        ctx.fillStyle = grd;
      } else ctx.fillStyle = tint('#c8c8c8', 0, 0, rr(-0.08, 0.08));
      ctx.fill();
      ctx.strokeStyle = isCol ? 'rgba(52,32,24,0.55)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = isCol ? 2 : 1.6; ctx.stroke();
      ctx.restore();
    }
  }
  // ---- 第四遍：龙骨砖（拱形压脊砖）----
  for (let k = 0; k < 13; k++) {
    const x = rr(-10, w - 90), yy = rr(-10, h - 40), bw = rr(72, 128), bh2 = rr(26, 44);
    const col = BONE[ri(0, BONE.length - 1)];
    for (const [ctx, isCol] of [[g, true], [b, false]]) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, yy + bh2);
      ctx.lineTo(x, yy + bh2 * 0.5);
      ctx.quadraticCurveTo(x + bw / 2, yy - bh2 * 0.42, x + bw, yy + bh2 * 0.5);
      ctx.lineTo(x + bw, yy + bh2);
      ctx.closePath();
      if (isCol) {
        const grd = ctx.createLinearGradient(x, yy - bh2 * 0.4, x, yy + bh2);
        grd.addColorStop(0, tint(col, 0, 0, 0.12));
        grd.addColorStop(1, tint(col, 0, 0, -0.12));
        ctx.fillStyle = grd;
      } else ctx.fillStyle = tint('#c4c4c4', 0, 0, rr(-0.06, 0.06));
      ctx.fill();
      ctx.strokeStyle = isCol ? 'rgba(48,32,24,0.5)' : 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2; ctx.stroke();
      if (isCol) {
        ctx.beginPath();
        ctx.moveTo(x + bw * 0.12, yy + bh2 * 0.62);
        ctx.quadraticCurveTo(x + bw / 2, yy + bh2 * 0.06, x + bw * 0.88, yy + bh2 * 0.62);
        ctx.strokeStyle = 'rgba(60,40,30,0.28)'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.restore();
    }
  }
  // ---- 第五遍：灰缝、苔痕、雨渍、泛碱 ----
  g.globalAlpha = 0.22; g.lineWidth = 2;
  for (let k = 0; k < 40; k++) {
    const yy = rr(0, h);
    g.strokeStyle = 'rgba(26,24,20,0.5)';
    g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy + rr(-4, 4)); g.stroke();
  }
  g.globalAlpha = 1;
  for (let k = 0; k < 22; k++) {
    const x = rr(0, w), yy = rr(0, h), r0 = rr(20, 80);
    const moss = R() > 0.42;
    const grd = g.createRadialGradient(x, yy, 0, x, yy, r0);
    grd.addColorStop(0, moss ? 'rgba(96,116,66,0.18)' : 'rgba(236,234,222,0.15)');
    grd.addColorStop(1, 'rgba(150,160,120,0)');
    g.fillStyle = grd; g.fillRect(x - r0, yy - r0, r0 * 2, r0 * 2);
  }
  for (let k = 0; k < 46; k++) {
    const x = rr(0, w), yy = rr(0, h * 0.7), len = rr(60, 240);
    const grd = g.createLinearGradient(x, yy, x, yy + len);
    grd.addColorStop(0, 'rgba(26,24,20,0.13)');
    grd.addColorStop(1, 'rgba(26,24,20,0)');
    g.fillStyle = grd; g.fillRect(x, yy, rr(4, 14), len);
  }
  // 整体上浅下深（雨水把底部洇深）
  const vg = g.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, 'rgba(255,255,255,0.05)');
  vg.addColorStop(0.6, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = `rgba(${ri(30, 230)},${ri(30, 220)},${ri(28, 205)},${rr(0.02, 0.07)})`;
    g.fillRect(rr(0, w), rr(0, h), rr(1, 3), rr(1, 3));
  }
  return { map: texOf(cv), bump: bumpOf(hv) };
}

// ============================================================
// 2. 竹条模板混凝土 —— 一张贴图覆盖 2.4m(横) × 4.8m(竖)
// ============================================================
export function bambooConcreteTexture(w = 512, h = 1024) {
  const R = mulberry32(0xB00);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(w, h);
  const hv = canvasOf(w, h);
  const g = cv.getContext('2d');
  const b = hv.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#b3ada0');
  base.addColorStop(0.55, '#aba598');
  base.addColorStop(1, '#9d9789');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  b.fillStyle = '#8f8f8f'; b.fillRect(0, 0, w, h);
  // 大尺度色斑（混凝土的浇筑不均）
  for (let i = 0; i < 40; i++) {
    const x = rr(0, w), y = rr(0, h), r0 = rr(40, 150);
    const grd = g.createRadialGradient(x, y, 0, x, y, r0);
    const green = R() > 0.55;
    grd.addColorStop(0, green ? 'rgba(122,132,104,0.10)' : 'rgba(126,118,102,0.09)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }
  // 竖向竹纹：一条条压出半圆柱的明暗，缝里压深
  const phase = rr(0, TAU);
  const strips = [];
  let x = -rr(0, 20);
  while (x < w) {
    const sw = rr(15, 21);
    strips.push({ x, w: sw, amp: rr(0.5, 2.0), seed: rr(0, 10), tone: rr(-0.032, 0.032) });
    x += sw + rr(0.6, 1.8);
  }
  const wob = (s, y) => Math.sin(y * 0.010 + s.seed + phase) * s.amp + Math.sin(y * 0.033 + s.seed * 2) * 0.45;
  const path = (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(s.x + wob(s, 0), 0);
    for (let y = 0; y <= h; y += 20) ctx.lineTo(s.x + wob(s, y), y);
    for (let y = h; y >= 0; y -= 20) ctx.lineTo(s.x + s.w + wob(s, y), y);
    ctx.closePath();
  };
  for (const s of strips) {
    // 缝（暗）
    g.beginPath();
    g.moveTo(s.x - 1.6 + wob(s, 0), 0);
    for (let y = 0; y <= h; y += 20) g.lineTo(s.x - 1.6 + wob(s, y), y);
    g.strokeStyle = 'rgba(52,48,40,0.42)'; g.lineWidth = 2.2; g.stroke();
    path(g, s);
    const lg = g.createLinearGradient(s.x, 0, s.x + s.w, 0);
    lg.addColorStop(0.0, tint('#847e72', 0, 0, s.tone - 0.02));
    lg.addColorStop(0.30, tint('#c6c0b2', 0, 0, s.tone + 0.015));
    lg.addColorStop(0.58, tint('#b5afa0', 0, 0, s.tone));
    lg.addColorStop(1.0, tint('#87816f', 0, 0, s.tone - 0.03));
    g.fillStyle = lg; g.fill();
    // bump：竹竿凸、缝凹
    b.beginPath();
    b.moveTo(s.x - 2 + wob(s, 0), 0);
    for (let y = 0; y <= h; y += 20) b.lineTo(s.x - 2 + wob(s, y), y);
    for (let y = h; y >= 0; y -= 20) b.lineTo(s.x + s.w + wob(s, y), y);
    b.closePath();
    const lb = b.createLinearGradient(s.x, 0, s.x + s.w, 0);
    lb.addColorStop(0, '#4c4c4c'); lb.addColorStop(0.32, '#e6e6e6'); lb.addColorStop(1, '#3f3f3f');
    b.fillStyle = lb; b.fill();
    // 竹节
    const nNode = Math.max(2, Math.round(h / rr(200, 300)));
    for (let i = 0; i < nNode; i++) {
      const ny = (i + rr(0.15, 0.85)) * (h / nNode);
      g.fillStyle = 'rgba(74,68,56,0.40)';
      g.fillRect(s.x + wob(s, ny) - 1.5, ny, s.w + 3, 3.2);
      g.fillStyle = 'rgba(255,255,255,0.15)';
      g.fillRect(s.x + wob(s, ny) - 1.5, ny + 3.2, s.w + 3, 1.6);
      b.fillStyle = 'rgba(0,0,0,0.5)'; b.fillRect(s.x + wob(s, ny) - 1.5, ny, s.w + 3, 3.2);
    }
  }
  // 模板拼缝（每 256px 一道）+ 缝下的雨水痕
  for (let y = 256; y < h; y += 256) {
    g.fillStyle = 'rgba(58,54,46,0.42)'; g.fillRect(0, y, w, 2.6);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, y + 2.6, w, 2);
    b.fillStyle = 'rgba(0,0,0,0.6)'; b.fillRect(0, y, w, 2.6);
    const drd = g.createLinearGradient(0, y + 4, 0, y + 90);
    drd.addColorStop(0, 'rgba(58,54,46,0.12)'); drd.addColorStop(1, 'rgba(58,54,46,0)');
    g.fillStyle = drd; g.fillRect(0, y + 4, w, 90);
  }
  // 对拉螺栓孔（模板体系的真实痕迹：Ø≈10px 的小圆孔）
  for (let y = 128; y < h; y += 256) {
    for (let xx = 60; xx < w - 20; xx += 128) {
      const cx = xx + rr(-6, 6), cy = y + rr(-4, 4), r0 = rr(4, 6);
      g.beginPath(); g.arc(cx, cy, r0, 0, TAU);
      g.fillStyle = 'rgba(44,40,34,0.72)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.4; g.stroke();
      b.beginPath(); b.arc(cx, cy, r0, 0, TAU);
      b.fillStyle = 'rgba(0,0,0,0.6)'; b.fill();
    }
  }
  // 裂缝
  for (let k = 0; k < 14; k++) {
    let cx = rr(0, w), cy = rr(0, h);
    g.strokeStyle = `rgba(62,56,46,${rr(0.10, 0.24)})`;
    b.strokeStyle = 'rgba(0,0,0,0.42)';
    for (const ctx of [g, b]) {
      ctx.lineWidth = ctx === g ? 1.2 : 1.6;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let i = 0; i < 4; i++) { cx += rr(-12, 12); cy += rr(10, 38); ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
  }
  // 底部青苔（江南潮气）
  const alg = g.createLinearGradient(0, h * 0.72, 0, h);
  alg.addColorStop(0, 'rgba(108,122,84,0)');
  alg.addColorStop(1, 'rgba(108,122,84,0.16)');
  g.fillStyle = alg; g.fillRect(0, h * 0.72, w, h * 0.28);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${ri(150, 225)},${ri(148, 220)},${ri(138, 205)},${rr(0.03, 0.09)})`;
    g.fillRect(rr(0, w), rr(0, h), rr(1, 4), rr(1, 4));
  }
  return { map: texOf(cv), bump: bumpOf(hv) };
}

// ============================================================
// 3. 江南青瓦屋面（覆盖 2.0m × 2.0m）
// ============================================================
export function roofTileTexture(size = 512) {
  const R = mulberry32(0x7A11);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(size);
  const hv = canvasOf(size);
  const g = cv.getContext('2d');
  const b = hv.getContext('2d');
  g.fillStyle = '#545b5f'; g.fillRect(0, 0, size, size);
  b.fillStyle = '#606060'; b.fillRect(0, 0, size, size);
  const colW = size / 9;                         // 9 垄筒瓦（1.8m 贴图 → 约 20cm 一垄，太密会糊成噪点）
  for (let c = 0; c < 9; c++) {
    const x = c * colW, tone = rr(-0.028, 0.028);   // 竖棱对比度压得很低：这是"瓦"不是"瓦楞铁"
    const lg = g.createLinearGradient(x, 0, x + colW, 0);
    lg.addColorStop(0.00, tint('#4b5256', 0, 0, tone - 0.012));
    lg.addColorStop(0.42, tint('#646b6f', 0, 0, tone + 0.020));
    lg.addColorStop(0.72, tint('#5c6367', 0, 0, tone + 0.006));
    lg.addColorStop(1.00, tint('#484f53', 0, 0, tone - 0.016));
    g.fillStyle = lg; g.fillRect(x, 0, colW, size);
    const lb = b.createLinearGradient(x, 0, x + colW, 0);
    lb.addColorStop(0, '#6a6a6a'); lb.addColorStop(0.45, '#c4c4c4'); lb.addColorStop(1, '#606060');
    b.fillStyle = lb; b.fillRect(x, 0, colW, size);
  }
  const rowH = size / 8;                         // 8 道瓦垄层：每层一道压叠阴影 + 瓦头收边
  for (let r = 0; r < 8; r++) {
    const y = r * rowH;
    const step = g.createLinearGradient(0, y + rowH - 16, 0, y + rowH);
    step.addColorStop(0, 'rgba(16,19,21,0)');
    step.addColorStop(1, 'rgba(16,19,21,0.62)');
    g.fillStyle = step; g.fillRect(0, y + rowH - 16, size, 16);
    g.fillStyle = 'rgba(12,14,16,0.72)'; g.fillRect(0, y + rowH - 4, size, 4);
    g.fillStyle = 'rgba(226,234,238,0.20)'; g.fillRect(0, y + rowH - 6.5, size, 2.4);
    b.fillStyle = 'rgba(0,0,0,0.85)'; b.fillRect(0, y + rowH - 6, size, 6);
    for (let c = 0; c < 9; c++) {               // 瓦头（筒瓦端头的圆边）
      g.beginPath();
      g.arc(c * colW + colW / 2, y + rowH - 4, colW * 0.46, Math.PI, TAU);
      g.fillStyle = tint('#6f767a', 0, 0, rr(-0.03, 0.05));
      g.fill();
      g.strokeStyle = 'rgba(24,28,30,0.5)'; g.lineWidth = 1.2; g.stroke();
      b.beginPath();
      b.arc(c * colW + colW / 2, y + rowH - 4, colW * 0.46, Math.PI, TAU);
      b.fillStyle = 'rgba(255,255,255,0.5)'; b.fill();
    }
  }
  // 风化：苔痕 / 积尘 / 缺瓦（把"同一块板"打散）
  for (let k = 0; k < 110; k++) {
    const x = rr(0, size), y = rr(0, size), r0 = rr(10, 54);
    const grd = g.createRadialGradient(x, y, 0, x, y, r0);
    const moss = R() > 0.45;
    grd.addColorStop(0, moss ? 'rgba(96,112,68,0.16)' : 'rgba(38,42,46,0.16)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }
  for (let k = 0; k < 6; k++) {                  // 缺瓦：露出深色底面
    const c = ri(0, 11), x = c * colW + colW * 0.2, y = rr(0, size), h2 = rr(14, 26);
    g.fillStyle = 'rgba(30,33,36,0.85)';
    g.fillRect(x, y, colW * 0.6, h2);
  }
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${ri(24, 150)},${ri(28, 158)},${ri(32, 165)},${rr(0.02, 0.07)})`;
    g.fillRect(rr(0, size), rr(0, size), rr(1, 3), rr(1, 3));
  }
  return { map: texOf(cv), bump: bumpOf(hv) };
}

// ============================================================
// 4. 回收砖铺装（广场，覆盖 12m × 12m）
// ============================================================
export function plazaPavingTexture(size = 1024) {
  const R = mulberry32(0x9C0DE);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#57544e'; g.fillRect(0, 0, size, size);       // 缝底
  const COLS = [0x8b8a82, 0x82847e, 0x94918a, 0x777b76, 0x8d897f, 0x9a9890, 0x7e7b73, 0x8a8d84, 0x918d84];
  // 规整石板网格：1024px = 12m → 每格 128px = 1.5m（真实的广场石板尺寸），
  // 关键：**两个方向都要有同样的深缝**，否则掠射角下只会看到横向长条（"木板"感）
  const N = 8, S = size / N;
  for (let iy = 0; iy < N; iy++) {
    for (let ix = 0; ix < N; ix++) {
      const jx = rr(-2, 2), jy = rr(-2, 2);
      const x = ix * S + jx, y = iy * S + jy;
      const w = S - 3 + rr(-1, 1.5), h = S - 3 + rr(-1, 1.5);
      const p = R();
      const col = p > 0.985 ? (R() > 0.5 ? 0x84786c : 0x7c8074) : COLS[ri(0, COLS.length - 1)];
      g.fillStyle = tint(col, rr(-0.006, 0.006), rr(-0.015, 0.015), rr(-0.018, 0.018));
      g.fillRect(x + 1.5, y + 1.5, w, h);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 1.5, y + 1.5, w, 2);
      g.fillRect(x + 1.5, y + 1.5, 2, h);
      g.fillStyle = 'rgba(20,20,18,0.14)'; g.fillRect(x + 1.5, y + h - 0.5, w, 2);
      g.fillRect(x + w - 0.5, y + 1.5, 2, h);
      if (R() > 0.96) {                                   // 断砖补砌 / 裂纹
        g.fillStyle = tint(0x8a6a55, 0, 0, rr(-0.06, 0.02));
        g.fillRect(x + w * 0.5, y + h * 0.45, w * 0.42, h * 0.45);
      }
      if (R() > 0.96) {
        g.strokeStyle = 'rgba(44,42,38,0.32)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x + w * 0.3, y + 3);
        g.lineTo(x + w * 0.55, y + h * 0.5); g.lineTo(x + w * 0.35, y + h - 3); g.stroke();
      }
    }
  }
  // 6m 大分格缝（每 512px）
  for (const p of [0, 512]) {
    g.fillStyle = 'rgba(44,42,38,0.34)'; g.fillRect(p - 2, 0, 4, size); g.fillRect(0, p - 2, size, 4);
    g.fillStyle = 'rgba(232,228,214,0.14)'; g.fillRect(p + 2, 0, 2, size); g.fillRect(0, p + 2, size, 2);
  }
  for (let k = 0; k < 24; k++) {                        // 湿痕 / 清洗痕
    const x = rr(0, size), y = rr(0, size), r0 = rr(70, 230);
    const grd = g.createRadialGradient(x, y, 0, x, y, r0);
    const dark = R() > 0.38;
    grd.addColorStop(0, dark ? 'rgba(34,36,38,0.14)' : 'rgba(226,224,214,0.08)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }
  for (let i = 0; i < 12000; i++) {
    g.fillStyle = `rgba(${ri(60, 205)},${ri(60, 200)},${ri(56, 192)},${rr(0.02, 0.07)})`;
    g.fillRect(rr(0, size), rr(0, size), rr(1, 3), rr(1, 3));
  }
  return texOf(cv);
}

// ============================================================
// 5. 花岗岩条石（它山堰 / 池岸，覆盖 3.0m × 3.0m）
// ============================================================
export function graniteTexture(size = 512) {
  const R = mulberry32(0x6A17);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(size);
  const g = cv.getContext('2d');
  g.fillStyle = hex(NC.granite); g.fillRect(0, 0, size, size);
  const rows = 4, rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 90;
    for (let x = -120; x < size; x += 180) {
      g.fillStyle = tint(NC.granite, rr(-0.01, 0.01), rr(-0.02, 0.02), rr(-0.08, 0.08));
      g.fillRect(x + off + 4, r * rh + 4, 172, rh - 8);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + off + 4, r * rh + 4, 172, 3);
      g.fillStyle = 'rgba(30,30,28,0.22)'; g.fillRect(x + off + 4, r * rh + rh - 8, 172, 4);
      for (let k = 0; k < 90; k++) {
        const px = x + off + rr(10, 165), py = r * rh + rr(8, rh - 12);
        g.strokeStyle = `rgba(${ri(60, 130)},${ri(58, 128)},${ri(56, 124)},0.22)`;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + rr(-7, 7), py + rr(3, 8)); g.stroke();
      }
    }
  }
  for (let i = 0; i < 9000; i++) {
    const v = ri(90, 220);
    g.fillStyle = `rgba(${v},${v},${v - 4},${rr(0.05, 0.16)})`;
    g.fillRect(rr(0, size), rr(0, size), 1.4, 1.4);
  }
  return texOf(cv);
}

// ============================================================
// 6. 馆名牌（花岗岩刻字，bump 做凹刻）
// ============================================================
export function museumSignTexture(size = 1024, h = 512) {
  const cv = canvasOf(size, h);
  const hv = canvasOf(size, h);
  const g = cv.getContext('2d');
  const b = hv.getContext('2d');
  g.fillStyle = '#5f5d57'; g.fillRect(0, 0, size, h);
  b.fillStyle = '#c8c8c8'; b.fillRect(0, 0, size, h);
  for (let i = 0; i < 9000; i++) {
    const v = 90 + Math.floor(Math.random() * 130);
    g.fillStyle = `rgba(${v},${v},${v - 3},0.16)`;
    g.fillRect(Math.random() * size, Math.random() * h, 1.6, 1.6);
  }
  const draw = (text, font, y, colDark, colLight) => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    b.font = font; b.textAlign = 'center'; b.textBaseline = 'middle';
    g.fillStyle = colDark; g.fillText(text, size / 2, y + 3);
    g.fillStyle = colLight; g.fillText(text, size / 2, y);
    b.fillStyle = '#3a3a3a'; b.fillText(text, size / 2, y + 3);
  };
  draw('宁波博物馆', '600 148px "Songti SC","Source Han Serif SC","STSong",serif', h * 0.40, 'rgba(20,18,14,0.75)', '#ece5d2');
  draw('NINGBO MUSEUM', '500 54px "Helvetica Neue",Arial,sans-serif', h * 0.72, 'rgba(20,18,14,0.7)', '#cfc9b8');
  return { map: texOf(cv), bump: bumpOf(hv) };
}

// ============================================================
// 7. 展厅横幅（竖挂旗）
// ============================================================
export function bannerTexture(text = '宁波博物馆', size = 256, h = 1024) {
  const cv = canvasOf(size, h);
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#b8342a'); grd.addColorStop(1, '#8f241d');
  g.fillStyle = grd; g.fillRect(0, 0, size, h);
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, size, 10); g.fillRect(0, h - 10, size, 10);
  g.font = '600 104px "Songti SC","Source Han Serif SC",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f6ecd8';
  const n = text.length;
  for (let i = 0; i < n; i++) g.fillText(text[i], size / 2, h * 0.14 + i * (h * 0.72 / Math.max(1, n - 1) || 0));
  return texOf(cv);
}

// ============================================================
// 8. 玻璃柔光（斜向高光带）
// ============================================================
export function glassSheenTexture() {
  const cv = canvasOf(512);
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(150,176,188,0.55)'; g.fillRect(0, 0, 512, 512);
  const band = (wid, a, rot) => {
    const grd = g.createLinearGradient(0, 0, 0, wid);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, `rgba(255,255,255,${a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.translate(256, 256); g.rotate(rot); g.translate(-256, -256);
    g.fillStyle = grd; g.fillRect(-300, 256 - wid / 2, 1120, wid);
    g.restore();
  };
  band(190, 0.55, -0.62); band(74, 0.45, -0.62);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ============================================================
// 9. 草坪（覆盖 22m；带割草条纹与斑块，避免一大片纯色绿）
// ============================================================
export function lawnTexture(size = 512) {
  const R = mulberry32(0x1A3B);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#728759'; g.fillRect(0, 0, size, size);
  // 割草条纹（3 条宽的明暗带）
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.045)';
    g.fillRect(i * (size / 3), 0, size / 3, size);
  }
  // 大尺度枯黄/深绿斑块
  for (let i = 0; i < 46; i++) {
    const x = rr(0, size), y = rr(0, size), r0 = rr(22, 90);
    const grd = g.createRadialGradient(x, y, 0, x, y, r0);
    const dry = R() > 0.62;
    grd.addColorStop(0, dry ? 'rgba(146,140,92,0.16)' : 'rgba(74,96,58,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }
  // 草叶纹理
  for (let i = 0; i < 9000; i++) {
    const c = new THREE.Color(0x728759).offsetHSL(rr(-0.03, 0.03), rr(-0.12, 0.10), rr(-0.14, 0.14));
    g.strokeStyle = '#' + c.getHexString();
    g.lineWidth = rr(1, 2.1);
    const x = rr(0, size), y = rr(0, size), a = rr(-0.6, 0.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 5, y - rr(3, 9)); g.stroke();
  }
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${ri(60, 190)},${ri(80, 200)},${ri(50, 150)},${rr(0.03, 0.10)})`;
    g.fillRect(rr(0, size), rr(0, size), rr(1, 3), rr(1, 3));
  }
  return texOf(cv);
}

// ============================================================
// 10. 展厅海报（门厅展板）
// ============================================================
export function posterTexture(size = 512, h = 256) {
  const cv = canvasOf(size, h);
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, size, h);
  grd.addColorStop(0, '#8f2a22'); grd.addColorStop(1, '#5f1a16');
  g.fillStyle = grd; g.fillRect(0, 0, size, h);
  g.fillStyle = '#c9a86a'; g.fillRect(0, h * 0.78, size, 4);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 24; i++) g.fillRect(0, i * (h / 24), size, 1);
  g.fillStyle = '#f4ead6';
  g.font = '600 62px "Songti SC","Source Han Serif SC",serif';
  g.textBaseline = 'middle';
  g.fillText('瓦爿·宁波', 26, h * 0.30);
  g.font = '400 26px "PingFang SC","Microsoft YaHei",sans-serif';
  g.fillStyle = 'rgba(244,234,214,0.86)';
  g.fillText('宁波博物馆藏 历代砖瓦特展', 28, h * 0.52);
  g.fillText('2026.10.01 — 2027.03.31  一层临展厅', 28, h * 0.66);
  g.fillStyle = 'rgba(244,234,214,0.55)';
  g.fillRect(28, h * 0.86, size * 0.30, 6);
  g.fillRect(28, h * 0.92, size * 0.20, 6);
  // 装饰：右下角一枚瓦当纹样
  g.save(); g.translate(size * 0.86, h * 0.34);
  g.strokeStyle = 'rgba(201,168,106,0.85)'; g.lineWidth = 5;
  g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.beginPath(); g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); g.stroke();
  }
  g.restore();
  return texOf(cv);
}

// ============================================================
// 11. 指示牌（箭头 + 文字条）
// ============================================================
export function signboardTexture(size = 512, h = 128) {
  const cv = canvasOf(size, h);
  const g = cv.getContext('2d');
  g.fillStyle = '#2f3b46'; g.fillRect(0, 0, size, h);
  g.strokeStyle = 'rgba(226,232,236,0.55)'; g.lineWidth = 5; g.strokeRect(5, 5, size - 10, h - 10);
  g.fillStyle = '#e8eef2';
  g.beginPath();
  g.moveTo(size * 0.80, h * 0.5); g.lineTo(size * 0.68, h * 0.22); g.lineTo(size * 0.68, h * 0.78);
  g.closePath(); g.fill();
  g.fillRect(size * 0.12, h * 0.30, size * 0.34, 12);
  g.fillRect(size * 0.12, h * 0.52, size * 0.22, 12);
  g.fillStyle = '#c9a86a';
  g.fillRect(size * 0.12, h * 0.74, size * 0.44, 8);
  return texOf(cv);
}

// ============================================================
// 12. 洗墙灯的墙面光晕（底部亮、向上渐隐，两侧收窄）
// ============================================================
export function wallWashTexture(size = 128, h = 256) {
  const cv = canvasOf(size, h);
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, h, 0, 0);
  grd.addColorStop(0.00, 'rgba(255,216,152,0.92)');
  grd.addColorStop(0.22, 'rgba(255,208,140,0.52)');
  grd.addColorStop(0.55, 'rgba(255,200,132,0.18)');
  grd.addColorStop(1.00, 'rgba(255,196,128,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, h);
  g.globalCompositeOperation = 'destination-in';
  const mg = g.createLinearGradient(0, 0, size, 0);
  mg.addColorStop(0.00, 'rgba(0,0,0,0)');
  mg.addColorStop(0.28, 'rgba(0,0,0,1)');
  mg.addColorStop(0.72, 'rgba(0,0,0,1)');
  mg.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = mg; g.fillRect(0, 0, size, h);
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ============================================================
// 13. 导览图（广场总平面示意牌：抽象化的场地平面 + 图例）
// ============================================================
export function siteMapTexture(size = 512, h = 384) {
  const cv = canvasOf(size, h);
  const g = cv.getContext('2d');
  g.fillStyle = '#e9e3d3'; g.fillRect(0, 0, size, h);
  g.fillStyle = '#2f3b46'; g.fillRect(0, 0, size, h * 0.16);
  g.fillStyle = '#e8eef2';
  g.font = '600 30px "PingFang SC","Microsoft YaHei",sans-serif';
  g.textBaseline = 'middle';
  g.fillText('宁波博物馆 · 园区导览', 18, h * 0.08);
  // 建筑
  g.fillStyle = '#8d8a80';
  g.fillRect(size * 0.30, h * 0.34, size * 0.42, h * 0.28);
  g.fillStyle = '#6f6c64';
  g.fillRect(size * 0.30, h * 0.34, size * 0.42, h * 0.05);
  // 水面
  g.fillStyle = '#9dc4d4';
  g.fillRect(size * 0.10, h * 0.30, size * 0.16, h * 0.44);
  g.fillRect(size * 0.74, h * 0.30, size * 0.06, h * 0.44);
  g.fillRect(size * 0.30, h * 0.24, size * 0.42, h * 0.06);
  // 广场与草坪
  g.fillStyle = '#c9c3b2'; g.fillRect(0, h * 0.66, size, h * 0.30);
  g.fillStyle = '#a8bf84'; g.fillRect(0, h * 0.16, size * 0.10, h * 0.50);
  g.fillRect(size * 0.80, h * 0.16, size * 0.20, h * 0.50);
  // 路径与节点
  g.strokeStyle = '#f4efe2'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(0, h * 0.52); g.lineTo(size * 0.16, h * 0.52); g.lineTo(size * 0.24, h * 0.48); g.stroke();
  g.beginPath(); g.moveTo(size * 0.72, h * 0.48); g.lineTo(size * 0.86, h * 0.52); g.lineTo(size, h * 0.52); g.stroke();
  g.beginPath(); g.moveTo(size * 0.50, h * 0.62); g.lineTo(size * 0.50, h * 0.96); g.stroke();
  // 指北针 + 图例
  g.fillStyle = '#2f3b46';
  g.beginPath();
  g.moveTo(size * 0.93, h * 0.22); g.lineTo(size * 0.90, h * 0.32); g.lineTo(size * 0.96, h * 0.32);
  g.closePath(); g.fill();
  g.font = '400 20px "PingFang SC",sans-serif';
  g.fillStyle = '#3b4650';
  g.fillText('■ 博物馆展厅   ▨ 水面   ▩ 广场   · 出入口', 18, h * 0.90);
  return texOf(cv);
}

// ============================================================
// 14. 混凝土平台/屋面板（2.4m 一格，带分格缝、雨水口周边渍痕）
// ============================================================
export function deckTexture(size = 512) {
  const R = mulberry32(0xDECC);
  const rr = (a, b) => a + (b - a) * R();
  const ri = (a, b) => Math.floor(rr(a, b + 1));
  const cv = canvasOf(size);
  const g = cv.getContext('2d');
  g.fillStyle = '#9aa0a0'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {                    // 骨料斑驳
    const x = rr(0, size), y = rr(0, size), r0 = rr(4, 26);
    const grd = g.createRadialGradient(x, y, 0, x, y, r0);
    grd.addColorStop(0, R() > 0.5 ? 'rgba(122,128,128,0.16)' : 'rgba(212,214,210,0.14)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }
  for (let i = 0; i < 9000; i++) {                   // 细骨料
    const v = ri(110, 210);
    g.fillStyle = `rgba(${v},${v},${v - 3},${rr(0.05, 0.16)})`;
    g.fillRect(rr(0, size), rr(0, size), 1.4, 1.4);
  }
  // 分格缝（贴在 2.4m 的 0 / 1.2m 处 → 形成 1.2m 方格）
  for (const p of [0, size / 2]) {
    g.fillStyle = 'rgba(44,46,46,0.55)'; g.fillRect(p - 1.6, 0, 3.2, size); g.fillRect(0, p - 1.6, size, 3.2);
    g.fillStyle = 'rgba(226,228,224,0.18)'; g.fillRect(p + 1.6, 0, 1.6, size); g.fillRect(0, p + 1.6, size, 1.6);
  }
  for (let k = 0; k < 22; k++) {                     // 雨渍 / 落水口附近的深色痕
    const x = rr(0, size), y = rr(0, size), r0 = rr(16, 70);
    const grd = g.createRadialGradient(x, y, 0, x, y, r0);
    grd.addColorStop(0, 'rgba(50,54,54,0.16)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r0, y - r0, r0 * 2, r0 * 2);
  }
  return texOf(cv);
}

// 远景城市的"亮窗"自发光贴图：与 cityFacadeTexture 的 4×5 窗格对齐，随机点亮一部分
export function cityLightsTexture() {
  const R = mulberry32(0x9C31);
  const rr = (a, b) => a + (b - a) * R();
  const cv = canvasOf(128); const g = cv.getContext('2d');
  const w = 128, h = 128;
  {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        if (R() > 0.42) continue;                       // 只有约四成窗亮着，才有零散灯火感
        const x = 8 + c * 24, y = 10 + r * 28;
        g.fillStyle = `rgba(255,${Math.round(rr(190, 225))},${Math.round(rr(120, 170))},${rr(0.55, 1.0)})`;
        g.fillRect(x, y, 13, 17);
      }
    }
  }
  return texOf(cv);   // 自发光贴图不能是 sRGB? —— 保持与其它程序化贴图同一套设置
}

// 碎石/砾石：场地铺装与草地之间的过渡带、公园小路（agy V7：消除"地毯贴在荒原上"的硬边）
export function gravelTexture(size = 256) {
  const R = mulberry32(0x3E19);
  const rr = (a, b) => a + (b - a) * R();
  const cv = canvasOf(size); const g = cv.getContext('2d');
  const w = size, h = size;
  g.fillStyle = '#9d9a8e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = rr(0, w), y = rr(0, h), r = rr(0.9, 3.4);
    const l = rr(-0.16, 0.16);
    g.fillStyle = tint('#a8a496', rr(-0.02, 0.02), rr(-0.05, 0.05), l);
    g.beginPath(); g.ellipse(x, y, r, r * rr(0.7, 1.0), rr(0, TAU), 0, TAU); g.fill();
  }
  for (let i = 0; i < 14; i++) {                      // 几团杂草
    const x = rr(0, w), y = rr(0, h);
    g.fillStyle = `rgba(${ri(96, 138)},${ri(118, 152)},${ri(70, 96)},${rr(0.25, 0.5)})`;
    g.beginPath(); g.ellipse(x, y, rr(4, 11), rr(3, 7), rr(0, TAU), 0, TAU); g.fill();
  }
  return texOf(cv);
  function ri(a, b) { return Math.floor(rr(a, b + 1)); }
}
