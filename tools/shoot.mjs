#!/usr/bin/env node
// 无头渲染截图：给独立审查者（agy 等）自己跑、自己看图用。
// 用法:
//   node tools/shoot.mjs                       # 默认 8 个机位 → review/shots-agy/
//   node tools/shoot.mjs --out review/x --w 1280 --h 720
//   node tools/shoot.mjs --only hero,night     # 只拍指定几个
// 说明: 页面通过 window.__SCENE__ 暴露 setHour/jumpCam/setCam/camera/controls/stats/sample/TOGGLES，
//       本脚本用它切机位与时刻，跑完输出每个文件的路径、像素统计（均值/纯黑占比）与控制台错误。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const req = createRequire('/home/nyan/deepseek-harness/node_modules/.pnpm/playwright-core@1.63.0-alpha-2026-08-31/node_modules/playwright-core/package.json');
let chromium;
try { ({ chromium } = req('playwright-core')); }
catch (e) { ({ chromium } = req('playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('out', 'review/shots-agy'));
const W = +arg('w', 1280), H = +arg('h', 720);
const HTML = path.resolve(ROOT, arg('html', 'dist/ningbo-museum.html'));
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);

// 机位清单：name → 用 __SCENE__ 切到哪
const SHOTS = [
  { name: '01-hero-day',     hour: 12.0, cam: 'hero',  note: '全景/正午' },
  { name: '02-hero-golden',  hour: 17.4, cam: 'hero',  note: '全景/黄金时刻' },
  { name: '03-hero-night',   hour: 21.6, cam: 'hero',  note: '全景/夜' },
  { name: '04-portal',       hour: 16.4, cam: 'portal', note: '西面裂口与入口' },
  { name: '05-valley',       hour: 14.0, cam: 'valley', note: '南面山谷大台阶' },
  { name: '06-aerial',       hour: 11.0, cam: 'aerial', note: '航拍总体量' },
  { name: '07-water',        hour: 15.0, cam: 'water',  note: '水面/堰体' },
  { name: '07b-night-square',hour: 21.4, cam: 'night',  note: '夜景入口广场' },
  { name: '08-wall',         hour: 15.5, cam: 'wall',   note: '瓦爿墙贴脸（材质细看）' },
  { name: '09-closeup-wall', hour: 14.0, cam: 'hero', pos: [-46, 8, -62], look: [-20, 9, -32.6], note: '竹模墙/窗/百叶贴脸' },
  { name: '10-closeup-roof', hour: 13.0, cam: 'ridge', note: '屋面/檐口细看' },
  { name: '11-walk',        hour: 15.5, cam: 'walk',  note: '漫步（行人视高 1.65m）' },
  { name: '12-site-edge',   hour: 12.0, cam: 'hero',  pos: [-260, 26, 150], look: [0, 6, -20], note: '场地边缘/中景' },
];

fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(ROOT, 'review', '.chrome-profile');
fs.mkdirSync(profile, { recursive: true });

const EXE = arg('exe', process.env.CHROME_PATH || '/usr/bin/google-chrome');
const browser = await chromium.launchPersistentContext(profile, {
  headless: true,
  executablePath: fs.existsSync(EXE) ? EXE : undefined,
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--force-device-scale-factor=1',
  ],
});
const ctx = browser;
const page = ctx.pages()[0] || await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

// SwiftShader 下场景是同步构建的（贴图 + 几何 + PMREM），load 事件会被推迟 → 用 domcontentloaded + 长超时
await page.goto('file://' + HTML + '?ui=0&orbit=0', { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction('window.__SCENE__ && window.__SCENE__.camera', null, { timeout: 300000 });
// 等首帧真正画出来
await page.waitForFunction(() => (window.__SCENE__.stats().fps || 0) > 0, null, { timeout: 300000 });
await page.evaluate(() => { window.__SCENE__.state.autoOrbit = false;
  ['hud', 'panel', 'dock', 'hudwrap', 'scrim', 'brand'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); });

const results = [];
for (const s of SHOTS) {
  if (ONLY.length && !ONLY.includes(s.name)) continue;
  const info = await page.evaluate((s) => {
    const S = window.__SCENE__;
    S.state.autoOrbit = false;
    if (S.state.outline !== undefined) S.TOGGLES.outline(false);
    S.setHour(s.hour);
    if (s.pos) {
      S.camera.position.set(s.pos[0], s.pos[1], s.pos[2]);
      S.controls.target.set(s.look[0], s.look[1], s.look[2]);
      S.camera.lookAt(S.controls.target);
      S.camera.updateMatrixWorld(true);
    } else {
      S.jumpCam(s.cam);
      S.camera.lookAt(S.controls.target);
      S.camera.updateMatrixWorld(true);
    }
    return { cam: S.state.cam || s.cam, stats: S.stats() };
  }, s);
  // 等若干帧稳定
  await page.waitForTimeout(4000);   // SwiftShader 一帧可能 1~2s，多等几帧
  const file = path.join(OUT, s.name + '.png');
  await page.screenshot({ path: file });
  const sample = await page.evaluate(() => {
    const S = window.__SCENE__, gl = S.renderer.getContext();
    const w = S.renderer.domElement.width, h = S.renderer.domElement.height;
    const buf = new Uint8Array(w * h * 4);
    S.post.render(); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let sum = 0, dark = 0, over = 0, n = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const l = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];
      sum += l; n++;
      if (l < 8) dark++;
      if (buf[i] > 250 && buf[i + 1] > 250 && buf[i + 2] > 250) over++;
    }
    return { mean: +(sum / n).toFixed(1), blackPct: +(100 * dark / n).toFixed(2), overPct: +(100 * over / n).toFixed(2), tris: S.stats().tris_total, fps: S.stats().fps };
  });
  results.push({ name: s.name, note: s.note, hour: s.hour, cam: info.cam, file, ...sample });
  console.log(`${s.name.padEnd(18)} ${String(s.note).padEnd(22)} mean=${String(sample.mean).padStart(6)} black%=${String(sample.blackPct).padStart(5)} over%=${String(sample.overPct).padStart(5)}  →  ${file}`);
}

const errs = await page.evaluate(() => (window.__ERRORS__ || []).slice(0, 10));
console.log('\n--- 运行期错误 ---');
console.log(errs.length ? errs.map((e) => '  ' + e).join('\n') : '  （无）');
if (logs.length) { console.log('--- 控制台错误 ---'); console.log(logs.slice(0, 10).map((l) => '  ' + l).join('\n')); }
fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ html: HTML, size: [W, H], results, errors: errs, logs }, null, 2));
console.log('\n清单已写入 ' + path.join(OUT, 'shots.json'));
await browser.close();
