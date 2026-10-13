import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const req = createRequire('/home/nyan/deepseek-harness/node_modules/.pnpm/playwright-core@1.63.0-alpha-2026-08-31/node_modules/playwright-core/package.json');
let chromium;
try { ({ chromium } = req('playwright-core')); }
catch (e) { ({ chromium } = req('playwright')); }

const ROOT = '/home/nyan/Documents/deepseek-harness/default-workspace/ningbo-museum';
const DIST_HTML = path.join(ROOT, 'dist/ningbo-museum.html');
const RELEASE_HTML = path.join(ROOT, 'releases/ningbo-museum-v9-20261013-0943.html');

// 1. MD5 和离线检查
console.log('=== 1. 交付物哈希与离线检查 ===');
const distBuf = fs.readFileSync(DIST_HTML);
const relBuf = fs.readFileSync(RELEASE_HTML);
const distMd5 = crypto.createHash('md5').update(distBuf).digest('hex');
const relMd5 = crypto.createHash('md5').update(relBuf).digest('hex');
console.log(`dist MD5:    ${distMd5} (${distBuf.length} bytes)`);
console.log(`release MD5: ${relMd5} (${relBuf.length} bytes)`);
console.log(`MD5 一致性:   ${distMd5 === relMd5 ? '一致 ✓' : '不一致 ✗'}`);

const extRegex = /(src|href)=["']https?:\/\/|@import|url\(["']?https?:\/\//i;
console.log(`dist 外链检测: ${extRegex.test(distBuf.toString('utf8')) ? '发现外链 ✗' : '零外链 ✓'}`);

// 2. 浏览器内运行期深入审查
const profile = path.join(ROOT, 'review', '.chrome-inspect-profile');
fs.mkdirSync(profile, { recursive: true });

const browser = await chromium.launchPersistentContext(profile, {
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  viewport: { width: 1280, height: 720 },
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ],
});

const page = browser.pages()[0] || await browser.newPage();
const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => consoleMsgs.push({ type: 'pageerror', text: e.message }));

await page.goto('file://' + DIST_HTML, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__SCENE__ && window.__SCENE__.camera', null, { timeout: 120000 });
await page.waitForFunction(() => (window.__SCENE__.stats().fps || 0) > 0, null, { timeout: 120000 });

const inspectReport = await page.evaluate(() => {
  const S = window.__SCENE__;
  const gl = S.renderer.getContext();
  
  // 统计材质、贴图、mesh
  let meshCount = 0;
  let instancedCount = 0;
  let skinnedCount = 0;
  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  
  S.scene.traverse((o) => {
    if (o.isMesh) {
      meshCount++;
      if (o.isInstancedMesh) instancedCount++;
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => materials.add(m));
        else materials.add(o.material);
      }
    }
  });

  materials.forEach((m) => {
    ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach((slot) => {
      if (m[slot] && m[slot].isTexture) textures.add(m[slot]);
    });
  });

  const textureDetails = Array.from(textures).map((t) => ({
    name: t.name || 'unnamed',
    w: t.image ? (t.image.width || 0) : 0,
    h: t.image ? (t.image.height || 0) : 0,
    format: t.format,
    colorSpace: t.colorSpace,
  }));

  // 测试所有开关
  const toggleResults = {};
  for (const k of ['orbit', 'people', 'outline', 'water', 'shadows', 'bloom', 'quality']) {
    try {
      S.TOGGLES[k](true);
      S.TOGGLES[k](false);
      toggleResults[k] = 'ok';
    } catch (e) {
      toggleResults[k] = e.message;
    }
  }

  // 测试机位
  const camResults = {};
  for (const name of Object.keys(S.CAMS)) {
    try {
      S.jumpCam(name);
      camResults[name] = 'ok';
    } catch (e) {
      camResults[name] = e.message;
    }
  }

  // 测试时刻滑动
  const hourResults = {};
  for (const h of [0, 6.6, 12, 17.7, 19.6, 22.4, 24, -1, 25]) {
    try {
      S.setHour(h);
      hourResults[h] = 'ok';
    } catch (e) {
      hourResults[h] = e.message;
    }
  }

  // 恢复状态
  S.setHour(16.4);
  S.jumpCam('hero');

  const stats = S.stats();
  const renderInfo = {
    calls: S.renderer.info.render.calls,
    lines: S.renderer.info.render.lines,
    triangles: S.renderer.info.render.triangles,
    points: S.renderer.info.render.points,
    geometries: S.renderer.info.memory.geometries,
    textures: S.renderer.info.memory.textures,
    programs: S.renderer.info.programs ? S.renderer.info.programs.length : 0,
  };

  return {
    meshCount,
    instancedCount,
    materialCount: materials.size,
    geometryCount: geometries.size,
    textureCount: textures.size,
    textureDetails,
    stats,
    renderInfo,
    toggleResults,
    camResults,
    hourResults,
    errors: window.__ERRORS__ || [],
  };
});

console.log('\n=== 2. 场景统计 ===');
console.log(`Mesh 总数:        ${inspectReport.meshCount} (其中 InstancedMesh: ${inspectReport.instancedCount})`);
console.log(`Geometry 去重数:   ${inspectReport.geometryCount}`);
console.log(`Material 去重数:   ${inspectReport.materialCount}`);
console.log(`Texture 去重数:    ${inspectReport.textureCount}`);
console.log(`渲染器 Calls:      ${inspectReport.renderInfo.calls}`);
console.log(`渲染器 Triangles:  ${inspectReport.renderInfo.triangles}`);
console.log(`渲染器 Programs:   ${inspectReport.renderInfo.programs}`);

console.log('\n=== 3. 控制台消息 ===');
console.log(consoleMsgs);

console.log('\n=== 4. 交互测试结果 ===');
console.log('Toggles:', inspectReport.toggleResults);
console.log('Cams:', inspectReport.camResults);
console.log('Hours:', inspectReport.hourResults);

fs.writeFileSync(path.join(ROOT, 'review/inspect-result.json'), JSON.stringify({ inspectReport, consoleMsgs }, null, 2));

await browser.close();
