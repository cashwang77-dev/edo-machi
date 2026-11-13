#!/bin/bash
# 背景自動測試（無頭 Chrome，約 4~5 分鐘）：tools/flowtest.sh → 印出 PASS/FAIL 與失敗項
cd "$(dirname "$0")/.."
CH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
timeout 330 "$CH" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=800,600 --virtual-time-budget=240000 --dump-dom "http://localhost:8811/index.html?test=flow&auto=%E6%B8%AC%E8%A9%A6&t=0.5&v=$RANDOM" 2>/dev/null > shots/flow.html
grep -o "<title>[^<]*</title>" shots/flow.html | sed 's/<[^>]*>//g'; grep -o "✘[^<]*" shots/flow.html | head
