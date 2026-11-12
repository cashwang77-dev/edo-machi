// 假玩家：node tools/bots.mjs ws://127.0.0.1:8787/ws 12 [秒數]
const URL = process.argv[2] || 'ws://127.0.0.1:8787/ws', N = +(process.argv[3] || 12), SEC = +(process.argv[4] || 120);
const names = ['阿花', '小明', '太郎', '花子', '源五郎', 'お菊', '八兵衛', 'Mika', 'Ken', '小雪', '辰吉', 'お蝶', '半次', '千代', '勘太', 'お咲'];
const lines = ['こんにちは！', '好漂亮的街道', '一起去吃蕎麥麵吧', '我開了糰子店喔', '夕陽好美～', 'いらっしゃい！', '要不要去泡湯？'];
const emos = ['😊', '🌸', '🍵', '👍', '😂', '🏮'];
for (let i = 0; i < N; i++) {
  const ws = new WebSocket(URL + '?room=edo1');
  let x = 70 + Math.random() * 25, z = (Math.random() - .5) * 8, tx = x, tz = z, r = 0;
  const lk = { k: i % 10, p: i % 6, o: i % 6, h: i % 5, s: i % 3, hat: i % 7 === 0 ? 1 : 0, c: i % 5 === 0 ? 2 : 0 };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hi', n: names[i % names.length], lk, x, z }));
  ws.onmessage = () => {};
  const iv = setInterval(() => {
    if (ws.readyState !== 1) return;
    const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    let a = 0;
    if (d < .3) { if (Math.random() < .03) { tx = 60 + Math.random() * 40; tz = (Math.random() - .5) * 10; } }
    else { const s = Math.min(d, .64); x += dx / d * s; z += dz / d * s; r = Math.atan2(dx, dz); a = 1; }
    if (Math.random() < .004) ws.send(JSON.stringify({ t: 'chat', s: lines[Math.floor(Math.random() * lines.length)] }));
    if (Math.random() < .006) ws.send(JSON.stringify({ t: 'emote', e: emos[Math.floor(Math.random() * emos.length)] }));
    if (a === 0 && Math.random() < .01) a = [7, 9, 10][Math.floor(Math.random() * 3)];
    ws.send(JSON.stringify({ t: 'p', x, z, y: 0, r, a }));
  }, 200);
  setTimeout(() => { clearInterval(iv); ws.close(); }, SEC * 1000);
}
setTimeout(() => process.exit(0), SEC * 1000 + 500);
