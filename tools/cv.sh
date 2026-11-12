#!/bin/bash
# 人物檢視截圖：tools/cv.sh 輸出名 "查詢字串" [寬 高]
CH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"; cd "$(dirname "$0")/.."
timeout 60 "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=${3:-500},${4:-700} --virtual-time-budget=12000 --screenshot="$(cygpath -w "$PWD/shots/$1.png")" "http://localhost:8811/shots/charview.html?w=${3:-500}&h=${4:-700}&$2" >/dev/null 2>&1
