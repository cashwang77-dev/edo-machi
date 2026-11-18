# 江戶町 2D 立繪人物計畫（2026-11-18 使用者選「直接全面改」）
目標：人物改成 RO 式 2D 手繪立繪（billboard），效能更好、畫面更精緻。

## 原型（archetype）
- 一個原型＝一整套立繪（含髮型）。先做女 4、男 4。
- 每原型兩張 Gemini 圖（4:5、5 列×4 欄）：
  - A 走路：5 方向（正、右前、右側、右後、背）× 4 格（右腳前/併/左腳前/併）
  - B 動作：5 方向 站立＋坐下；正面 揮手、鞠躬（上傳 A 正面當參考）
- 和服畫淺灰無花紋、腰帶紅色 → 後製分出遮罩（R=和服、G=腰帶），遊戲裡換色＋花紋。
- 左向用鏡像。

## 管線
art_src/sprites/<原型>/A.png,B.png → tools/sprite_cut.py（find_figures 找框、remove_bg、對齊腳底、遮罩）→ img/spr/<原型>.png（atlas）＋ .json（格位、頭頂錨點）

## 遊戲
- js/sprite.js：SpriteChara（介面與 Chara 相同：root、setLook、play、update、say、emoji、lod、setRide…），一個 Mesh＋自訂 shader（換色、花紋、描邊、晝夜光照）。
- 方向：依角色朝向與鏡頭夾角選 8 方向。
- 逐步替換：NPC → 掌櫃 → 玩家；換裝 UI 改成選原型＋顏色＋花紋。

## 進度
- [x] 11/18 原型 1 f1（女・島田髷）A 圖 → tools/sprite_cut.py → img/spr/f1.*；js/sprite.js SpriteChara；shots/sprview.html 試看（8 人換色＋花紋＋8 方向＋走路）成功，截圖 docs/立繪原型_1118.png
  - f1 A 圖方向：正面只有 1 格、背面 2 格 → B 圖要補正面/背面走路 4 格
  - 遮罩門檻：和服 sat<.13 且 .42<亮度<.93；腰帶 紅色且在頭部 38% 以下
- [ ] f1 B 圖：正面走路 4、背面走路 4、5 方向站立、坐下（正/斜/側）、揮手、鞠躬
- [ ] 其餘 7 原型（女：おかっぱ、ポニー、垂髪；男：丁髷、総髪、坊主、散切り）
- [ ] 遊戲整合：SpriteChara 補齊 Chara 介面（say/emoji/setName/lod/setRide/坐/動作）、NPC 先換、再換玩家與換裝 UI
