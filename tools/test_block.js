
// ---------- 自動測試 ?test=flow ----------
async function runTest() {
  const log = []; let fail = false; const ok = (c, m) => { log.push((c ? '✔ ' : '✘ ') + m); if (!c) fail = true; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const until = async (f, ms = 15000) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await sleep(50); return f(); };
  try {
    await sleep(600);
    const soba = W.shops.find(s => s.def.id === 'soba');
    G.pos.set(soba.front.x, 0, soba.front.z);
    ok(await until(() => near && near.type === 'shop' && near.shop === soba), '靠近店家出現提示');
    act(); ok(!$('#panel').classList.contains('hide'), '店家面板');
    $('#bCust').click(); ok(G.mode === 'seat', '坐下');
    const m0 = G.money; document.querySelector('.mi[data-i="0"]').click(); ok(G.money === m0 - 16 && !!G.order, '點餐扣 16 文');
    ok(await until(() => !G.order && G.me.anim === 5), 'NPC 掌櫃上菜、吃麵');
    await until(() => !G.busy); standUp(); ok(G.mode === 'walk', '起身');
    const go = W.shops.find(s => s.def.id === 'gofuku'); openShop(go); $('#bCust').click(); order(go, go.def.menu.find(m => m.id === 'k7'));
    ok(await until(() => G.look.k === 7 && G.look.p === 4), '吳服店換和服'); standUp();
    const ka = W.shops.find(s => s.def.id === 'kamiyui'); openShop(ka); $('#bCust').click(); order(ka, ka.def.menu[1]);
    ok(await until(() => G.look.h === 1), '髮結床換髮型'); standUp();
    const uk = W.shops.find(s => s.def.id === 'ukiyoe'); openShop(uk); $('#bCust').click(); order(uk, uk.def.menu[0]);
    ok(await until(() => !$('#ukiyo').classList.contains('hide') && !!$('#ukiyo img')), '浮世繪完成'); closePanels(); standUp();
    const ek = W.shops.find(s => s.def.id === 'ekisha'); openShop(ek); $('#bCust').click(); order(ek, ek.def.menu[0]);
    ok(await until(() => !$('#fortune').classList.contains('hide')), '求籤'); closePanels(); standUp();
    const yu = W.shops.find(s => s.def.id === 'yuya'); openShop(yu); $('#bCust').click(); order(yu, yu.def.menu[0]);
    ok(await until(() => G.mode === 'bath'), '泡湯'); standUp(); ok(G.mode === 'walk' && okAt(G.pos.x, G.pos.z), '出浴後位置可走');
    const ch = W.shops.find(s => s.def.id === 'chaya'); G.pos.set(ch.front.x, 0, ch.front.z); claim(ch); ok(G.mode === 'owner', '開店當老闆');
    G.npcT = 0; ok(await until(() => G.queue.length > 0), 'NPC 客人上門點餐');
    const m1 = G.money; startMG(G.queue[0]); ok(MG.on, '做菜小遊戲開始');
    for (let g = 0; MG.on && g < 600; g++) { const st = MG.st; if (st && !st.done) { if (st.g === 'tap' && Math.abs(st.v - st.zc) < st.zw / 4) mgPress(true); if (st.g === 'mash') mgPress(true); if (st.g === 'hold') { if (!st.held) mgPress(true); else if (st.v >= st.zc) mgPress(false); } } await sleep(25); }
    ok(!MG.on && G.money > m1, '做完收錢 +' + (G.money - m1) + ' 文');
    await sleep(500); leaveOwner(); ok(G.mode === 'walk' && !G.owners.chaya, '收店');
    emote(10, 1e9); ok(await until(() => G.me.anim === 10), '跳舞'); G.emoteT = 0; sendEmoji('🌸'); ok(!!G.me.emo, '表情符號');
    G.pos.set(30, 0, 3); const n = NPCS[0]; n.ch.root.position.set(31, 0, 3); n.wait = 20;
    ok(await until(() => near && near.type === 'npc'), 'NPC 互動提示'); act(); ok(!!n.ch.bub, 'NPC 回話');
    G.me.bub = null; onChat(G.myId, '你好'); ok(!!G.me.bub, '聊天泡泡');
    G.pos.set(-128, 0, 0); ok(await until(() => near && near.type === 'pray'), '神社參拜點');
    G.pos.set(125, 0, 0); ok(okAt(125, 0) && !okAt(125, 5), '橋可走、河不可走');
  } catch (e) { ok(false, 'EXC ' + e.message); }
  document.title = (fail ? 'FAIL ' : 'PASS ') + log.length;
  const d = document.createElement('pre'); d.style.cssText = 'position:fixed;left:8px;top:50px;z-index:99;background:rgba(255,255,255,.92);font-size:15px;padding:8px;margin:0'; d.textContent = (fail ? 'FAIL\n' : 'PASS\n') + log.join('\n'); document.body.appendChild(d);
}
if (QS.get('test') === 'flow') { store.set('helped', true); setTimeout(runTest, 1500); }
