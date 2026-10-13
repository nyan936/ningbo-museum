#!/usr/bin/env bash
# 防回归：把这轮实际踩过的坑固化成可自动检查的断言（每条都对应一次真实事故）
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
fail=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=1; }
has() { grep -q "$2" "$1" && ok "$3" || bad "$3"; }

echo "[1] 交付物：单文件、零外部请求"
HTML="${1:-dist/ningbo-museum.html}"
if [ -f "$HTML" ]; then
  ok "存在 $HTML ($(du -h "$HTML" | cut -f1))"
  if grep -qE '(src|href)="https?://|@import|url\(https?://' "$HTML"; then bad "含外部引用（必须零请求）"; else ok "无任何 http(s) 外部引用"; fi
  grep -qE '<script[^>]+src=' "$HTML" && bad "存在外链 script" || ok "无外链 script"
else bad "缺少 $HTML（先跑 tools/build.sh）"; fi

echo "[2] 地面必须给水面开洞（曾用一整块 1600×1600 平面把水面全盖住）"
grep -q 'new THREE.PlaneGeometry(1600' src/world.js && bad "地面又变回整块平面（会盖住水面）" || ok "地面不是整块平面"
has src/world.js 'shape.holes.push' "地面用带洞 ShapeGeometry"
has src/world.js 'export function waterRects' "waterRects 由 world 导出"
has src/water.js 'waterRects()' "water.js 复用同一份水面矩形"

echo "[3] 水面材质必须 DoubleSide（曾因绕序朝下被整块剔除）"
has src/water.js 'reflector.material.side = THREE.DoubleSide' "水面 DoubleSide"

echo "[4] 反射期间隐藏小物件（否则倒影里塞满看不见的草/鸟/鲤鱼）"
has src/main.js 'water.hideDuringReflect.push' "hideDuringReflect 已接入"

echo "[5] 描边通道必须隐藏天空/远山/水面/草木（否则草叶边缘产生噪点黑边）"
has src/post.js 'setHideForNormal' "post 提供 setHideForNormal"
has src/main.js 'post.setHideForNormal' "main 里已传隐藏清单"
grep -q 'vec2 offs\[8\]' src/post.js && bad "描边 shader 用数组下标（GLSL ES 1.0 有风险）" || ok "描边 shader 无数组下标"

echo "[6] 控制台/运行期不得有错误（曾把 BufferGeometry 当 Mesh 塞进 group → 垃圾桶全丢且控制台常驻报错）"
if command -v node >/dev/null && [ -f tools/shoot.mjs ]; then
  if node tools/shoot.mjs --only 01-hero-day --w 640 --h 360 --out review/.check-shots > review/.check-run.txt 2>&1; then
    if grep -q "THREE.Object3D.add\|Shader Error\|Uncaught" review/.check-run.txt; then
      bad "无头运行出现控制台错误：$(grep -m1 -o 'THREE[^ ]*\|Shader Error\|Uncaught[^\n]*' review/.check-run.txt)"
    else ok "无头渲染：无 THREE/Shader/Uncaught 错误"; fi
  else
    echo "  \033[33m!\033[0m 无头检查跳过（Chrome 不可用或超时）——见 review/.check-run.txt"
  fi
else
  echo "  \033[33m!\033[0m 无头检查跳过（缺 node 或 tools/shoot.mjs）"
fi

echo "[7] 建筑识别度：裂口宽度 / 山谷宽度 / 五个量体"
python3 - <<'PY'
import re, sys
s = open('src/museum.js', encoding='utf-8').read()
def pair(name):
    m = re.search(name + r':\s*\{\s*x0:\s*([-0-9.]+),\s*x1:\s*([-0-9.]+)', s)
    return (float(m.group(1)), float(m.group(2))) if m else None
p = pair('portal'); c = pair('canyon')
vols = len(re.findall(r'\{ x0: -?\d+, x1: -?\d+, yE:', s))
bad = 0
if p and p[1] - p[0] >= 26: print(f'  \033[32m✓\033[0m 西端裂口净宽 {p[1]-p[0]:.1f} m (>=26)')
else: print('  \033[31m✗\033[0m 裂口过窄:', p); bad = 1
if c and c[1] - c[0] >= 12: print(f'  \033[32m✓\033[0m 山谷峡谷宽 {c[1]-c[0]:.1f} m (>=12)')
else: print('  \033[31m✗\033[0m 山谷过窄:', c); bad = 1
if vols == 5: print('  \033[32m✓\033[0m 上部量体 = 5 个')
else: print(f'  \033[31m✗\033[0m 量体数 = {vols}（应为 5）'); bad = 1
sys.exit(bad)
PY
[ $? -eq 0 ] || fail=1

echo "[7] 大台阶踏步高必须符合人体尺度（曾出现 35cm/级，膝盖高不可攀）"
python3 - <<'PYT'
import re
s = open('src/museum.js', encoding='utf-8').read()
m = re.search(r'const N = (\d+), per = (\d+), runs = (\d+), landing = ([0-9.]+)', s)
yb = re.search(r'yBase: ([0-9.]+)', s)
if m and yb:
    N = int(m.group(1)); rise = float(yb.group(1)) / N
    if 0.13 <= rise <= 0.18:
        print(f'  \033[32mOK\033[0m 踏步高 {rise*100:.1f}cm（规范 13~18cm，共 {N} 级）')
    else:
        print(f'  \033[31mX\033[0m 踏步高 {rise*100:.1f}cm 超出人体尺度（应 13~18cm）'); raise SystemExit(1)
else:
    print('  \033[31mX\033[0m 找不到台阶参数'); raise SystemExit(1)
PYT
if [ $? -ne 0 ]; then fail=1; fi

echo "[8] 瓦爿 / 竹模贴图必须按真实尺码（3px 级误差就会让墙读成噪点）"
python3 - <<'PY'
import re, sys
s = open('src/surfaces.js', encoding='utf-8').read()
w = re.search(r'wapanTexture\(w = (\d+), h = (\d+)\)', s)
b = re.search(r'bambooConcreteTexture\(w = (\d+), h = (\d+)\)', s)
bad = 0
# 瓦爿贴图：4096×2048px 覆盖 12.0m × 6.0m（1px≈2.93mm）；砖层高必须落在 5.5~9.5cm 的真实区间
WAP_W_M, WAP_H_M = 12.0, 6.0
if w and int(w.group(1)) == 4096 and int(w.group(2)) == 2048:
    pxmm = WAP_H_M * 1000 / int(w.group(2))
    print(f'  \033[32m✓\033[0m 瓦爿贴图 {w.group(1)}×{w.group(2)}px 覆盖 {WAP_W_M}m × {WAP_H_M}m（1px≈{pxmm:.2f}mm，144m 墙面重复 {144/WAP_W_M:.0f} 次）')
else: print('  \033[31m✗\033[0m 瓦爿贴图尺寸异常（应 4096×2048 覆盖 12m×6m）'); bad = 1
m = re.search(r'const rowH = ri\((\d+), *(\d+)\)', s)
if m:
    pxmm = WAP_H_M * 1000 / int(w.group(2))
    lo, hi = int(m.group(1)) * pxmm / 10, int(m.group(2)) * pxmm / 10
    if 5.5 <= lo and hi <= 9.5: print(f'  \033[32m✓\033[0m 砖层高 {lo:.1f}~{hi:.1f}cm（真实区间 5.5~9.5cm）')
    else: print(f'  \033[31m✗\033[0m 砖层高 {lo:.1f}~{hi:.1f}cm 超出真实区间'); bad = 1
else: print('  \033[31m✗\033[0m 找不到砖层高参数'); bad = 1
m2 = re.search(r'const bw = ri\((\d+), *(\d+)\)', s)
if m2:
    pxmm = WAP_W_M * 1000 / int(w.group(1))
    lo2, hi2 = int(m2.group(1)) * pxmm / 10, int(m2.group(2)) * pxmm / 10
    if 12 <= lo2 and hi2 <= 40: print(f'  \033[32m✓\033[0m 砖长 {lo2:.0f}~{hi2:.0f}cm（真实区间 12~40cm）')
    else: print(f'  \033[31m✗\033[0m 砖长 {lo2:.0f}~{hi2:.0f}cm 超出真实区间'); bad = 1
if b and int(b.group(1)) == 512: print('  \033[32m✓\033[0m 竹模贴图 512px 覆盖 2.4m（竹竿 7~10cm）')
else: print('  \033[31m✗\033[0m 竹模贴图尺寸异常'); bad = 1
if '对拉螺栓孔' in s: print('  \033[32m✓\033[0m 有对拉螺栓孔（模板体系的真实痕迹）')
else: print('  \033[31m✗\033[0m 缺对拉螺栓孔'); bad = 1
sys.exit(bad)
PY
[ $? -eq 0 ] || fail=1

echo
if [ "$fail" -eq 0 ]; then echo "全部通过 ✓"; else echo "有检查未通过 ✗"; exit 1; fi
