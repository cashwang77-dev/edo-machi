#!/bin/bash
# 用法: tools/shot.sh 輸出名 "查詢字串" [寬 高]
CH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
cd "$(dirname "$0")/.." && mkdir -p shots
"$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=${3:-1280},${4:-720} --virtual-time-budget=${VT:-25000} --screenshot="$(cygpath -w "$PWD/shots/$1.png")" "http://localhost:8811/index.html?$2" >/dev/null 2>&1
echo "shots/$1.png"
