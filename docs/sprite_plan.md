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
- [x] f1 B 圖（正背走路、5 方向站/坐、揮手/鞠躬/掩嘴笑/歡呼）
- [x] 11/18 8 原型全部完成：f1 島田髷、f2 おかっぱ、f3 ポニー、f4 垂髪、m1 丁髷、m2 総髪、m3 坊主、m4 散切り（img/spr/*，plan 在 art_src/sprites/*_plan.json），合照 docs/立繪8原型_1118.png
  - 待修：m3 坐下斜前那格腳邊有一小段長椅線（黏在人物上）
  - 和服遮罩只算頭部 34% 以下（避免剃頭、灰眼被換色）；腰帶 38% 以下
- [x] 11/18 上線 144e450：js/sprite.js SChara（介面同 Chara；setName/say/emoji/setRide/updRide 借用 Chara.prototype；addHeld 沿用；arms 掛點給祭典/隊伍）
  - game.js：NPCChara（啟動後 preloadSprites，?npc3d 切回 3D）用於 NPC/掌櫃/客人/小孩/隊伍/祭典/車夫/玩家/其他玩家；GM 花魁維持 3D（rebuildMe）
  - 換裝：立繪模式只顯示 和服/花紋/腰帶/髮型（look.ai＋aiH；髮結床改 h 後 aiH≠h 改用 HAIR2ARCH）
  - SPR_LIGHT 依 W.night 調亮度
## 之後可改進
- [x] 11/19 飾品手繪圖 36 件（tools/acc_cut.py → img/spr/acc.*；sprite.js ACC_POS/ACC_FIX 位置）
- 羽織／袴／法被、臉部五官與膚色選項在立繪模式不顯示
- m3 坐下斜前那格腳邊細線
- [x] 11/19 新增 f5 唐輪、f6 勝山髷、f7 兵庫髷、f8 お団子、f9 二つ結び、m5 銀杏髷（ARCH_LIST 只能接在後面；HAIR2ARCH 一對一）
- [x] 11/19 f9 歡呼：Gemini 圖片編輯重畫（art_src/sprites/f9_cheer.png）手動塞進 atlas 第 34 格；m3 坐下斜前的長椅線手動清掉。⚠ 重跑 sprite_cut 的 f9、m3 會蓋掉這兩個手動修正
