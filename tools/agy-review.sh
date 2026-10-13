#!/usr/bin/env bash
# 让 agy 对宁波博物馆场景做一次"自主审查"：自己读源码 + 自己跑 tools/shoot.mjs 截图 + 自己看图 + 写报告
# 前置：agy 已登录（在终端跑一次 `agy` 完成 Google 授权；未登录时本脚本会直接提示并退出）
# 用法：bash tools/agy-review.sh            # 完整审查
#       AGY_EFFORT=max bash tools/agy-review.sh
set -u
cd "$(dirname "$0")/.."
AGY="${AGY:-/home/nyan/.local/bin/agy}"
EFFORT="${AGY_EFFORT:-high}"
SRC="${AGY_SRC:-releases/ningbo-museum-v11-20261013-1227.html}"

mkdir -p review

echo "→ 检查 agy 登录状态…"
if ! "$AGY" models 2>/dev/null | grep -qiE "gemini|claude|gpt|model"; then
  echo "✗ agy 未登录。请先在你自己的终端里执行：agy"
  echo "  （它会显示一个 Google 授权链接；浏览器里账号已登录时点同意，把 code 粘回终端即可）"
  exit 2
fi
echo "✓ 已登录"

echo "→ 送审版本：$SRC"
PROMPT="${AGY_PROMPT:-review/agy-prompt.md}"
[ -f "$PROMPT" ] || { echo "✗ 缺少 $PROMPT"; exit 2; }
[ -f tools/shoot.mjs ]     || { echo "✗ 缺少 tools/shoot.mjs"; exit 2; }

echo "→ 开始自主审查（print 模式 / effort=$EFFORT / 超时 3600s）…"
"$AGY" --dangerously-skip-permissions --effort "$EFFORT" \
  -p "$(cat "$PROMPT")" --print-timeout 3600s > review/agy-raw.txt 2>&1
RC=$?
echo "agy exit=$RC（原始输出 review/agy-raw.txt）"
if [ -f review/agy-report-2.md ]; then
  echo "✓ 报告已生成：review/agy-report-2.md（$(wc -l < review/agy-report-2.md) 行）"
elif [ -f review/agy-report.md ]; then
  echo "✓ 报告已生成：review/agy-report.md（$(wc -l < review/agy-report.md) 行）"
else
  echo "⚠ 未生成报告，检查 review/agy-raw.txt 末尾："
  tail -20 review/agy-raw.txt
fi
exit $RC
