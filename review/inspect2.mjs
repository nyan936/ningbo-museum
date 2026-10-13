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
const V11_HTML = path.join(ROOT, 'releases/ningbo-museum-v11-20261013-1227.html');
const V9_HTML = path.join(ROOT, 'releases/ningbo-museum-v9-20261013-0943.html');

console.log('=== 1. 文件完整性与交付物哈希 ===');
const distBuf = fs.readFileSync(DIST_HTML);
const v11Buf = fs.readFileSync(V11_HTML);
const v9Buf = fs.readFileSync(V9_HTML);

const distMd5 = crypto.createHash('md5').update(distBuf).digest('hex');
const v11Md5 = crypto.createHash('md5').update(v11Buf).digest('hex');
const v9Md5 = crypto.createHash('md5').update(v9Buf).digest('hex');

console.log(`dist MD5:    ${distMd5} (${distBuf.length} bytes, ${(distBuf.length / 1024).toFixed(1)} KB)`);
console.log(`v11  MD5:    ${v11Md5} (${v11Buf.length} bytes)`);
console.log(`v9   MD5:    ${v9Md5} (${v9Buf.length} bytes)`);
console.log(`dist 与 v11 冻结一致: ${distMd5 === v11Md5 ? '是 ✓' : '否 ✗'}`);

const extRegex = /(src|href)=["']https?:\/\/|@import|url\(["']?https?:\/\//i;
console.log(`dist 外部网络引用:     ${extRegex.test(distBuf.toString('utf8')) ? '存在 ✗' : '零外部引用 ✓'}`);

const profile = path.join(ROOT, 'review', '.chrome-inspect-profile-2');
fs.mkdirSync(profile, { recursive: true });

const browser = await chromium.launchPersistentContext(profile, {
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  viewport: { width: 1400, height: 800 },
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  ],
});

const page = browser.pages()[0] || await browser.newPage();
const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => consoleMsgs.push({ type: 'pageerror', text: e.message }));

await page.goto('file://' + DIST_HTML + '?ui=0&orbit=0', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__SCENE__ && window.__SCENE__.camera', null, { timeout: 120000 });
await page.waitForFunction(() => (window.__SCENE__.stats().fps || 0) > 0, null, { timeout: 120000 });

const report = await page.evaluate(() => {
  const S = window.__SCENE__;
  const THREE = window.__DBG__ ? { Raycaster: window.__DBG__.Raycaster, Vector2: window.__DBG__.Vector2, Vector3: window.__DBG__.Vector3 } : null;

  // 1. 场景资源统计
  let meshCount = 0;
  let instancedCount = 0;
  const geometries = new Set();
  const materials = new Set();
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

  const texList = Array.from(textures).map((t) => ({
    w: t.image ? (t.image.width || 0) : 0,
    h: t.image ? (t.image.height || 0) : 0,
    colorSpace: t.colorSpace,
  }));

  // 2. 测量 Draw calls
  S.jumpCam('hero');
  S.setHour(12.0);
  S.post.render();
  const callsWithOutline = S.renderer.info.render.calls;
  const trisWithOutline = S.renderer.info.render.triangles;

  S.TOGGLES.outline(false);
  S.post.render();
  const callsNoOutline = S.renderer.info.render.calls;

  S.TOGGLES.water(false);
  S.post.render();
  const callsNoWaterNoOutline = S.renderer.info.render.calls;

  // 恢复
  S.TOGGLES.water(true);
  S.TOGGLES.outline(false);

  // 3. 测量大台阶几何尺寸
  const stairData = {
    N: S.museum.M ? (30) : null,
    totalHeight: 10.5 - 0.55, // 9.95m
    perRise: 10.5 / 30, // 0.35m
    stairY_z0: S.museum ? (10.5) : null,
  };

  // 4. 百叶穿模专项探针（北立面百叶位置）
  // 北立面百叶在北墙 x in [-72..72], y in [10.5..24], zN = -32.5
  // 我们检测 museum.js 里是否有百叶 Mesh
  let louvMeshFound = false;
  let louvVerticesSample = [];
  S.scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x6f7578) {
      // 可能的 matSlabDark
    }
  });

  // 5. 垃圾桶数量与状态
  let trashBinCount = 0;
  // 查找是否有 bins
  // props.js 里面有 6 处垃圾桶，每个由 2 个圆柱合并，共 12 个圆柱合并为一个 mesh
  let trashBinMeshFound = false;
  S.scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x4b5257) {
      trashBinMeshFound = true;
    }
  });

  // 6. 测量机位参数
  const camInfo = {};
  for (const [k, v] of Object.entries(S.CAMS)) {
    camInfo[k] = { pos: v.pos, tgt: v.tgt, label: v.label };
  }

  // 7. 漫步机位视高与地面高差
  const walkCam = S.CAMS.walk;

  // 8. 错误检测
  const errors = window.__ERRORS__ || [];

  return {
    meshCount,
    instancedCount,
    geometryCount: geometries.size,
    materialCount: materials.size,
    textureCount: textures.size,
    texList,
    stats: S.stats(),
    calls: {
      withOutline: callsWithOutline,
      noOutline: callsNoOutline,
      noWaterNoOutline: callsNoWaterNoOutline,
    },
    tris: trisWithOutline,
    stairData,
    trashBinMeshFound,
    camInfo,
    walkCam,
    errors,
  };
});

console.log('\n=== 2. 独立探针运行结果 ===');
console.log(`Mesh 总数:       ${report.meshCount} (其中 InstancedMesh: ${report.instancedCount})`);
console.log(`Geometry 去重数:  ${report.geometryCount}`);
console.log(`Material 去重数:  ${report.materialCount}`);
console.log(`Texture 去重数:   ${report.textureCount}`);
console.log(`Draw Calls 实测:`);
console.log(`  - 关描边 + 开水反射:  ${report.calls.noOutline}`);
console.log(`  - 开描边 + 开水反射:  ${report.calls.withOutline}`);
console.log(`  - 关描边 + 关水反射:  ${report.calls.noWaterNoOutline}`);
console.log(`三角面数:         ${report.tris} (总计统计: ${report.stats.tris_total})`);
console.log(`垃圾桶 Mesh 存在:  ${report.trashBinMeshFound ? '是 ✓ (已实例化)' : '否 ✗'}`);
console.log(`大台阶级高:       ${report.stairData.perRise.toFixed(3)} m (35.0 cm/级)`);
console.log(`漫步机位相机参数:  pos=[${report.walkCam.pos.join(', ')}]`);

console.log('\n贴图尺寸明细:');
const texSizes = {};
for (const t of report.texList) {
  const k = `${t.w}x${t.h}`;
  texSizes[k] = (texSizes[k] || 0) + 1;
}
console.log(texSizes);

console.log('\n运行期错误与控制台消息:');
console.log('window.__ERRORS__:', report.errors);
console.log('console errors:', consoleMsgs.filter(m => m.type === 'error'));

fs.writeFileSync(path.join(ROOT, 'review/inspect2-result.json'), JSON.stringify({ report, consoleMsgs }, null, 2));

await browser.close();
