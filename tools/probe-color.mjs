// 材质染色探针：把关键材质换成高饱和色，渲一张图 → 一眼看出某片区域到底是什么构件
// 用法: node tools/probe-color.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const req = createRequire('/home/nyan/deepseek-harness/node_modules/.pnpm/playwright-core@1.63.0-alpha-2026-08-31/node_modules/playwright-core/package.json');
const { chromium } = req('playwright-core');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const browser = await chromium.launchPersistentContext(path.join(ROOT, 'review', '.chrome-probe'), {
  headless: true, executablePath: '/usr/bin/google-chrome',
  viewport: { width: 1400, height: 800 },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto('file://' + path.join(ROOT, 'dist/ningbo-museum.html') + '?ui=0&orbit=0', { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForFunction('window.__SCENE__ && window.__SCENE__.camera', null, { timeout: 300000 });
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const S = window.__SCENE__;
  S.state.autoOrbit = false; S.setHour(14.0);
  S.camera.position.set(-46, 8, -62); S.controls.target.set(-20, 9, -32.6);
  S.camera.lookAt(S.controls.target); S.camera.updateMatrixWorld(true);
  // 遍历材质，按特征认人 → 换成高饱和色
  const seen = new Set(), report = [];
  S.scene.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (seen.has(m.uuid)) continue; seen.add(m.uuid);
      const col = m.color ? m.color.getHexString() : '-';
      const tag = `${m.type}/${col}/metal=${m.metalness ?? '-'}/rough=${m.roughness ?? '-'}/map=${m.map ? 'y' : 'n'}/transp=${m.transparent ? 'y' : 'n'}`;
      // 窗玻璃（matWindow）：a9c4d0 + metal .55
      if (col === 'a9c4d0') { m.color.set(0xff00ff); m.emissive && m.emissive.set(0xff00ff); m.emissiveIntensity = 0.6; report.push('玻璃→品红 ' + tag); }
      // 竹模墙
      else if (col === 'ffffff' && m.map && m.bumpMap) { m.color.set(0xffee55); report.push('(白+map+bump)→黄 ' + tag); }
      // 深色框/压条
      else if (col === '8b8781' || col === '6f7578' || col === '9a978e') { m.color.set(0x00ffff); report.push('框/压条→青 ' + tag); }
      else if (col === '4b5257' || col === '23282b') { m.color.set(0xff8800); report.push('深色件→橙 ' + tag); }
    }
  });
  return { report, cam: [S.camera.position.toArray(), S.controls.target.toArray()] };
});
console.log(info.report.join('\n'));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(ROOT, 'review/probe-color.png') });
console.log('→ review/probe-color.png');
await browser.close();
