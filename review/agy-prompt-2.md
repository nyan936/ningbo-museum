# 任务：对「宁波博物馆 · 卡通三维场景」v11 做第二次全盘独立审查

你是资深三维场景 / Three.js 工程 + 美术方向的独立审查者。这是**第二轮**审查：第一轮你出过报告（`review/agy-report.md`），作者据此改了一版（v11），现在要你**验证修复是否真的成立**、并找出**仍然不合理的地方**（含这轮修复可能引入的新问题）。

**不要修改任何 `src/*.js` 或 `dist/*.html`**；可以在 `review/` 下自由新建脚本与截图。**不要用网络**。

## 送审对象（当前版本）

- 交付物：`dist/ningbo-museum.html`（md5 `0ee8d90367a1…`，688 KB，单文件零外部请求）
- 冻结副本：`releases/ningbo-museum-v11-20261013-1227.html`
- 上一版（你上轮审的）：`releases/ningbo-museum-v9-20261013-0943.html`（可用来 A/B 对照）
- 源码：`src/`（base / surfaces / museum / world / water / props / horizon / sky / post / main）、`src/shell.html`
- 上一轮你的报告：`review/agy-report.md`；作者自述的修复清单：`README.md` 的「第十轮 / 第十一轮」两节
- 截图驱动（你自己跑）：`tools/shoot.mjs`
- 自检脚本：`tools/check-scene.sh`

工作目录：`/home/nyan/Documents/deepseek-harness/default-workspace/ningbo-museum`

## 第一步：自己读源码

把 `src/*.js` 全部读完（每批 ≤4 个文件）。**特别核对这些刚改过的地方**：

- `src/surfaces.js`：`wapanTexture(w = 4096, h = 2048)` 改成了非方形（12m × 6m）、以及新增的 `gravelTexture()`
- `src/museum.js`：`UX/UY = 12/6`、山谷尽端上方新增的玻璃幕、石线脚收细、落水管外移、屋面天窗独立材质
- `src/world.js`：新增的"铺装→草地"过渡带（碎石/灌木/园路）
- `src/props.js`：新增的中景远景林地/田埂林带/田块、竹丛树池
- `src/water.js`：水面掠射角混合、涟漪环
- `src/sky.js` / `src/horizon.js`：夜间云与远景城市亮窗
- `src/main.js`：静态临时向量、`walk` 机位
- `src/post.js`：`normalCam.copy(camera)`
- `tools/check-scene.sh`：断言是否与实际一致（有没有"断言跟着实现改"的痕迹）

## 第二步：自己渲染、自己看图

```bash
node tools/shoot.mjs --w 1400 --h 800                      # 13 个机位 → review/shots-agy/*.png
node tools/shoot.mjs --only 11-walk,12-site-edge --w 1600 --h 900 --out review/shots-highres
```

然后**逐张用视觉能力实看**（重点：`01-hero-day / 03-hero-night / 05-valley / 06-aerial / 07-water / 08-wall / 09-closeup-wall / 10-closeup-roof / 11-walk / 12-site-edge`）。想补机位就写 `review/shoot2.mjs` 或改 `review/inspect.mjs`（别改 src）。
页面接口：`window.__SCENE__ = { setHour, jumpCam, CAMS, setCam, camera, controls, state, TOGGLES, stats, sample, regionMean, applyDay }`；机位：`hero portal valley wall water ridge aerial night walk`；URL 参数 `?cam=&hour=&orbit=&ui=&outline=`。

## 第三步：审查要求（这轮的重点是「不合理」）

1. **先验证、再评价**：对上轮报告里的每条结论（你写过的 V1..V11 / C1..C7 / F1..F11），逐条说「已修 / 未修 / 部分修 / 我当时判断有误」，并给源码行号或截图证据。**作者的 README 自述不要采信**，以代码与实际画面为准。
2. **找"不合理"**——不限于 bug：
   - 比例与尺度：门、窗、台阶、栏杆、树、人、瓦垄、砖、路灯是否与人体/常识尺度一致
   - 物理与构造：悬空、穿模、共面闪烁、结构没有传力路径、屋面没有排水、水往高处流
   - 场所与逻辑：道路不通、入口进不去、栏杆挡住去路、树长在路中间、家具朝向不对
   - 材质与贴图：重复周期、拉伸、方向错、贴图比例与实物不符、夜间发光是否合理
   - 光影与构图：曝光、死黑、过曝、地平线处理、远景与近景的一致
   - 交互与可用性：时刻/机位/开关有没有失效组合，移动端与超宽屏
3. **重点排查这轮改动**：
   - 12m × 6m 瓦爿贴图：砖层高/砖长在**实际画面**里是否仍符合真实尺码？有没有出现几米大的色块？（作者说修过一个"龙骨砖用了画布尺寸"的 bug）
   - 中景林地/林带/田块：有没有浮空、**穿透山体/水面**、尺度失真、把远山遮成一条线？
   - 铺装→草地过渡带：碎石/灌木/园路是否与既有道牙、绿篱、水系冲突？
   - `walk` 机位（1.65m 视高）：站在这个高度看，**比例问题会暴露**——请重点在这里找"不合理"
   - 夜间：城市亮窗、被压暗的云、屋面天窗、水面反射
4. **回归检查**：确认上轮已修的问题没有回来（垃圾桶是否真的出现、瓦爿墙绕序是否正常、南北东三面墙是否完整、山谷是否还漏天）。

## 第四步：输出报告

写到 **`review/agy-report-2.md`**（UTF-8 中文），结构：

```
# 宁波博物馆场景 · 第二轮独立审查报告（agy）
## 0. 审查范围与方法（读了哪些文件、跑了什么、看了哪些图）
## 1. 上轮结论复核表   ← 编号｜上轮结论｜现状（已修/未修/部分修/我上轮判断有误）｜证据
## 2. 本轮新发现（不合理项） ← 编号 N1…Nn：位置｜现象｜为什么不合理｜证据（截图+坐标 / file:line）｜严重度 P0/P1/P2｜建议
## 3. 本轮修复引入的新问题（回归）
## 4. 比例/尺度专项：用 walk 机位逐项核对人体尺度
## 5. 仍然合理的取舍（明确说明"这个不改也行"）
## 6. 优先级清单（表格：编号/严重度/改动量/具体怎么做）
## 7. 不确定或需作者决策的点
```

硬性要求：每条结论可验证（file:line 或截图文件名 + 画面位置百分比）；区分「实测看到的」与「推测的」；不许用网络；不许改 src/dist。
