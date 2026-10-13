# 任务：对「宁波博物馆 · 卡通三维场景」做一次完整的独立审查，并输出详细报告

你是一位资深的三维场景 / Three.js 工程 + 美术方向的独立审查者。请**自己读源码、自己渲染截图、自己看图**，然后给出可直接执行的修复清单。**不要修改任何 src/*.js 或 dist/*.html**，你只做审查（可以在 review/ 下新建脚本与截图）。

## 项目位置（全部用绝对路径）

- 工作目录：`/home/nyan/Documents/deepseek-harness/default-workspace/ningbo-museum`
- **送审版本（冻结）**：`releases/ningbo-museum-v9-20261013-0943.html`（单文件，双击即开，零外部请求）
- 当前产物：`dist/ningbo-museum.html`（内容与冻结版一致，md5 `175c305d475b…`）
- 源码：`src/` 下 `base.js`（工具/调色板/昼夜模型）、`surfaces.js`（程序化贴图）、`museum.js`（建筑本体）、`world.js`（地面/水系/铺装）、`water.js`（反射水面）、`props.js`（人物/植物/家具/灯具）、`horizon.js`、`sky.js`、`post.js`（后处理：Bloom+描边+调色）、`main.js`（装配）、`shell.html`（页面外壳，含 `/*__BUNDLE__*/`）
- 构建：`tools/build.sh`（esbuild 打包内联）；自检：`tools/check-scene.sh`
- **截图驱动（你要自己跑）**：`tools/shoot.mjs`
- 设计说明：`README.md`（**不要相信它的结论**，一切以源码和实际画面为准）

## 第一步：自己读源码

用你的文件读取能力，把 `src/*.js` 全部读完（**每批不超过 4 个文件**，避免超时）。同时读 `tools/build.sh`、`tools/check-scene.sh`、`tools/shoot.mjs`、`shell.html`。

## 第二步：自己渲染、自己看图

在项目目录下运行：

```bash
node tools/shoot.mjs                 # 默认 11 个机位 → review/shots-agy/*.png 与 shots.json
node tools/shoot.mjs --only 08-wall,09-closeup-wall --w 1600 --h 900
```

- 它用 headless Chrome（SwiftShader 软渲染）+ playwright，通过页面暴露的 `window.__SCENE__` 切机位与时刻，产出 PNG，并在 `review/shots-agy/shots.json` 里给出每张图的**均值/纯黑占比/过曝占比/三角面数/fps**。
- **然后你必须逐张用你的视觉能力实际看图**（有 11 张）。想补机位就写 `review/shoot2.mjs`（或传 `--out/--html/--w/--h/--only`），别改 src。
- 页面可用于审查的接口（在浏览器控制台/脚本里）：`window.__SCENE__ = { setHour(h), jumpCam(name), CAMS, setCam, camera, controls, state, TOGGLES, stats(), sample(), regionMean(), applyDay() }`；机位名：`hero portal valley wall water ridge aerial night`。URL 参数：`?cam=hero&hour=16.4&orbit=0&ui=0&outline=1`。
- 参考机位含义：`08-wall` 是瓦爿墙贴脸看材质，`09-closeup-wall` 是竹模混凝土墙/窗/百叶贴脸，`10-closeup-roof` 是屋面与檐口。

## 第三步：审查维度（每条都要给证据）

1. **美术风格与"像不像"**：这是王澍/业余建筑工作室的宁波博物馆（2008）。瓦爿墙（百万块回收旧砖瓦）、竹条模板混凝土斜壁、三层起裂成 5 个体量如山体、南面"山谷"大台阶、三面环水、西面裂口面向城市。请评价：体量/比例/材质/色彩/光影/氛围是否成立，卡通化处理是否统一，哪里"一眼假"。
2. **视觉缺陷**：穿模、悬空、共面闪烁（z-fighting）、贴图方向/拉伸、比例失调、光照突兀、构图问题、远景与天空的处理、导航栏/UI 遮挡等。**给出截图文件名 + 画面位置（百分比或像素坐标）**。
3. **代码与实现问题**：几何生成函数（`prismG/boxG/cylG/rboxG/mergeGeos`）的 UV/绕序/法线、材质与贴图复用、显存与 draw call、每帧开销、确定性（随机种子）、资源释放、可维护性、命名与注释、边界条件（除零、NaN、越界索引）。
4. **控制台与运行期**：自己扫一遍浏览器控制台与 `window.__ERRORS__`（`shots.json` 里也有），**逐条定位到源码行并说明后果**。
5. **工程性**：单文件/离线是否真的零外部请求、构建可复现性、自检脚本 `tools/check-scene.sh` 的断言是否够、README 与实际是否一致。
6. **交互与可用性**：时刻滑块、8 个机位、6 个开关（自动环绕/游客/描边/水面倒影/阴影/泛光/高画质）、性能档位、移动端与超宽屏、首屏等待时间。

## 第四步：输出报告（必须完整、详细、可执行）

把完整报告写到 **`review/agy-report.md`**（UTF-8，中文），并在最终回答里给出摘要。报告结构：

```
# 宁波博物馆场景 · 独立审查报告（agy）
## 0. 审查范围与方法   ← 读了哪些文件、跑了什么命令、看了哪些图（列出文件名）
## 1. 总体印象        ← 风格/审美总评 + "像不像宁波博物馆"（打分 1-10 并说明）
## 2. 视觉缺陷清单     ← 编号 V1…Vn，每条：位置｜现象｜证据（截图文件+坐标）｜严重度 P0/P1/P2｜建议修法
## 3. 代码与实现问题   ← 编号 C1…Cn，每条：file:line｜问题｜为什么是问题｜影响｜建议改法
## 4. 性能与资源       ← 三角面/draw call/材质数/显存/每帧开销，给出可优化项与预估收益
## 5. 交互与可用性
## 6. 优先级修复清单   ← 表格：编号｜严重度｜改动量（小/中/大）｜具体怎么做
## 7. 建议但非必须（锦上添花）
## 8. 不确定/需要用户决策的点
```

硬性要求：

- 每一条结论都必须**可验证**：给文件行号、或截图文件名 + 画面位置、或可复现的命令与数字。
- 区分「**我实测看到的**」与「**我推测的**」；推测要标注。
- 不要笼统说"材质可以更好"，要说"`src/museum.js:412` 的窗框厚度 0.18 在 8m 视距下投影 <2px，所以远看丢失"这种颗粒度。
- 严重度定义：**P0** 一眼可见的错误（穿模/悬空/闪烁/报错/构件缺失）；**P1** 明显影响观感或性能；**P2** 打磨项。
- **不许用网络**（离线环境）；不许修改 src/dist；可以在 `review/` 下随便建文件。
