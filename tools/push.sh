#!/bin/bash
# 一鍵上線：tools/push.sh "提交訊息"  （自動換 index.html 的 game.js 版本號、commit、push）
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M); sed -i -E "s#js/game.js\?v=[0-9a-z]+#js/game.js?v=$V#" index.html
for f in js/*.js server/worker.js; do node --check "$f" || { echo "語法錯誤：$f"; exit 1; }; done
git add -A && git -c user.name="cashwang77-dev" -c user.email="cashwang77-dev@users.noreply.github.com" commit -qm "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015uMb1hWVV5cYwYy3CR9Dif" && git push -q 2>&1 | grep -v "LF will be" | tail -1; git log --oneline | head -1
