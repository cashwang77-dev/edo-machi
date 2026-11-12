// 店鋪資料：位置、外觀、菜單、做菜步驟
// step: g = 'tap'（看準時機按）| 'mash'（連打）| 'hold'（按住到剛好放開）
const S = (n, zh, g) => ({ n, zh, g });
const SOBA = [S('こねる', '揉麵', 'mash'), S('切る', '切麵', 'tap'), S('茹でる', '煮麵', 'hold'), S('盛る', '盛碗', 'tap')];
const TEA = [S('湯を沸かす', '燒水', 'hold'), S('点てる', '刷茶', 'mash'), S('出す', '奉茶', 'tap')];
const SUSHI = [S('酢飯', '拌醋飯', 'mash'), S('切る', '切魚', 'tap'), S('握る', '捏壽司', 'tap')];
const GOFUKU = [S('採寸', '量身', 'tap'), S('裁つ', '裁布', 'tap'), S('縫う', '縫製', 'mash')];
const UKIYO = [S('下絵', '打草稿', 'tap'), S('彫る', '雕版', 'mash'), S('摺る', '刷印', 'hold')];
const UNAGI = [S('割く', '剖鰻', 'tap'), S('焼く', '炭烤', 'hold'), S('タレ', '刷醬', 'tap')];
const SAKE = [S('燗をつける', '溫酒', 'hold'), S('盛る', '上菜', 'tap')];
const DANGO = [S('丸める', '搓圓', 'mash'), S('串打ち', '串起', 'tap'), S('焼く', '烤', 'hold')];
const TEMPURA = [S('衣', '裹麵衣', 'mash'), S('揚げる', '油炸', 'hold'), S('油切り', '瀝油', 'tap')];
const KAMI = [S('梳く', '梳頭', 'mash'), S('結う', '結髮', 'tap'), S('整える', '整理', 'tap')];
const KASHI = [S('練る', '揉餡', 'mash'), S('形作る', '塑形', 'tap'), S('包む', '包裝', 'tap')];
const KOMA = [S('選ぶ', '挑選', 'tap'), S('包む', '包裝', 'tap')];
const EKI = [S('筮竹', '搖籤', 'mash'), S('占う', '占卜', 'tap')];
const YU = [S('湯加減', '調水溫', 'hold'), S('番台', '收錢', 'tap')];

const D = (type, ...c) => ({ type, c });
export const SHOPS = [
  // 北側（面向南）
  { id: 'soba', name: '信濃屋', kind: '蕎麥麵', sign: 'そば', noren: '#24406e', w: 12, floors: 2, side: -1, x: -54, wall: '#e8e0cc',
    menu: [
      { id: 'kake', n: 'かけそば', zh: '湯蕎麥', p: 16, dish: D('bowl', '#7a4a22', '#d8c69a'), steps: SOBA },
      { id: 'zaru', n: 'ざるそば', zh: '竹篩涼麵', p: 16, dish: D('zaru', '#6d5a3c'), steps: SOBA },
      { id: 'ten', n: '天ぷらそば', zh: '天婦羅蕎麥', p: 32, dish: D('bowl', '#7a4a22', '#e0a046'), steps: [...SOBA.slice(0, 3), S('揚げる', '炸蝦', 'hold'), S('盛る', '盛碗', 'tap')] },
    ] },
  { id: 'chaya', name: '花見茶屋', kind: '茶屋', sign: '御休処', noren: '#b5373a', w: 11, floors: 1, side: -1, x: -36, wall: '#efe6d2', umbrella: true,
    menu: [
      { id: 'sencha', n: '煎茶', zh: '煎茶', p: 8, dish: D('cup', '#9fb35a'), steps: TEA },
      { id: 'matcha', n: '抹茶', zh: '抹茶', p: 20, dish: D('cup', '#5f8a2f'), steps: TEA },
      { id: 'sakuramochi', n: '桜餅', zh: '櫻餅', p: 12, dish: D('sweet', '#efb4c4', '#4f7a3a'), steps: [S('包む', '包葉', 'tap'), S('出す', '奉上', 'tap')] },
    ] },
  { id: 'gofuku', name: '丸屋', kind: '吳服（換和服）', sign: '呉服', noren: '#2c2c34', w: 14, floors: 2, side: -1, x: -18, wall: '#f0ead8', service: true,
    menu: [
      { id: 'k0', n: '藍染', zh: '藍染和服', p: 100, look: { k: 0, p: 0 }, steps: GOFUKU },
      { id: 'k1', n: '紅梅', zh: '紅梅和服', p: 100, look: { k: 1, p: 0 }, steps: GOFUKU },
      { id: 'k2', n: '若竹の縞', zh: '若竹條紋', p: 120, look: { k: 2, p: 1 }, steps: GOFUKU },
      { id: 'k4', n: '山吹の水玉', zh: '山吹水玉', p: 120, look: { k: 4, p: 2 }, steps: GOFUKU },
      { id: 'k3', n: '墨の市松', zh: '墨色市松', p: 140, look: { k: 3, p: 3 }, steps: GOFUKU },
      { id: 'k7', n: '江戸紫の麻の葉', zh: '江戶紫麻葉', p: 160, look: { k: 7, p: 4 }, steps: GOFUKU },
      { id: 'k5', n: '桜色の花柄', zh: '櫻色花紋', p: 160, look: { k: 5, p: 5 }, steps: GOFUKU },
      { id: 'k8', n: '浅葱', zh: '淺蔥色', p: 100, look: { k: 8, p: 0 }, steps: GOFUKU },
    ] },
  { id: 'sushi', name: '辰巳鮨', kind: '壽司屋台', sign: 'すし', noren: '#3b6a5a', w: 9, floors: 1, side: -1, x: 0, wall: '#e6dcc4', stall: true,
    menu: [
      { id: 'maguro', n: '鮪', zh: '鮪魚握壽司', p: 8, dish: D('sushi', '#b8333d'), steps: SUSHI },
      { id: 'kohada', n: '小鰭', zh: '小鰭握壽司', p: 8, dish: D('sushi', '#a9b0b8'), steps: SUSHI },
      { id: 'tamago', n: '玉子', zh: '玉子燒壽司', p: 6, dish: D('sushi', '#f0c43a'), steps: SUSHI },
      { id: 'anago', n: '穴子', zh: '星鰻握壽司', p: 10, dish: D('sushi', '#6e4426'), steps: SUSHI },
    ] },
  { id: 'ukiyoe', name: '花鳥堂', kind: '浮世繪店', sign: '錦絵', noren: '#c46a2c', w: 11, floors: 2, side: -1, x: 18, wall: '#efe4cc', service: true,
    menu: [
      { id: 'nigao', n: '似顔絵', zh: '畫你的浮世繪', p: 60, art: 'me', steps: UKIYO },
      { id: 'meisho', n: '名所絵', zh: '江戶名所圖', p: 40, art: 'view', steps: UKIYO },
    ] },
  { id: 'unagi', name: '川吉', kind: '鰻魚屋', sign: 'うなぎ', noren: '#5a3420', w: 12, floors: 2, side: -1, x: 36, wall: '#e8dcc4', smoke: true,
    menu: [
      { id: 'kabayaki', n: '蒲焼', zh: '蒲燒鰻', p: 60, dish: D('box', '#6a3a1c'), steps: UNAGI },
      { id: 'donburi', n: '鰻丼', zh: '鰻魚丼', p: 80, dish: D('bowl', '#6a3a1c', '#6a3a1c'), steps: [S('炊く', '炊飯', 'hold'), ...UNAGI] },
    ] },
  { id: 'izakaya', name: '千鳥', kind: '居酒屋', sign: '酒', noren: '#6b5a3a', w: 11, floors: 1, side: -1, x: 54, wall: '#e2d6bc', rope: true,
    menu: [
      { id: 'atsukan', n: '熱燗', zh: '熱清酒', p: 20, dish: D('tokkuri', '#e8e2d0'), steps: SAKE },
      { id: 'oden', n: 'おでん', zh: '關東煮', p: 16, dish: D('bowl', '#b08a4a', '#e8d8a8'), steps: [S('煮込む', '燉煮', 'hold'), S('盛る', '盛盤', 'tap')] },
      { id: 'hiyayakko', n: '冷奴', zh: '冷豆腐', p: 10, dish: D('sweet', '#f4f0e4', '#5a8a3a'), steps: [S('切る', '切豆腐', 'tap'), S('盛る', '上菜', 'tap')] },
    ] },
  // 南側（面向北）
  { id: 'dango', name: '月見屋', kind: '糰子', sign: '団子', noren: '#2f5f8a', w: 9, floors: 1, side: 1, x: -54, wall: '#efe6d0', umbrella: true,
    menu: [
      { id: 'mitarashi', n: 'みたらし団子', zh: '醬油糰子', p: 4, dish: D('skewer', '#b07a3a', '#b07a3a', '#b07a3a'), steps: DANGO },
      { id: 'sanshoku', n: '三色団子', zh: '三色糰子', p: 5, dish: D('skewer', '#ef9fb4', '#f4f0e4', '#8ab35a'), steps: DANGO },
      { id: 'kusa', n: '草団子', zh: '艾草糰子', p: 5, dish: D('skewer', '#6f9a4a', '#6f9a4a', '#6f9a4a'), steps: DANGO },
    ] },
  { id: 'tempura', name: '浜屋', kind: '天婦羅屋台', sign: '天麩羅', noren: '#8a6a2a', w: 9, floors: 1, side: 1, x: -36, wall: '#e6dac0', stall: true,
    menu: [
      { id: 'ebi', n: '海老天', zh: '炸蝦', p: 4, dish: D('skewer', '#e3a548', '#e3a548'), steps: TEMPURA },
      { id: 'anagoten', n: '穴子天', zh: '炸星鰻', p: 6, dish: D('skewer', '#d9963c', '#d9963c'), steps: TEMPURA },
      { id: 'kakiage', n: 'かき揚げ', zh: '炸什錦', p: 8, dish: D('sweet', '#dba04a', '#c58a3a'), steps: TEMPURA },
    ] },
  { id: 'kamiyui', name: '床松', kind: '髮結床（換髮型）', sign: '髪結', noren: '#3d3d5c', w: 10, floors: 1, side: 1, x: -18, wall: '#ebe3d0', service: true, pole: true,
    menu: [
      { id: 'h0', n: '丁髷', zh: '丁髷（月代）', p: 32, look: { h: 0 }, steps: KAMI },
      { id: 'h1', n: '島田髷', zh: '島田髷', p: 32, look: { h: 1 }, steps: KAMI },
      { id: 'h2', n: '総髪', zh: '總髮馬尾', p: 28, look: { h: 2 }, steps: KAMI },
      { id: 'h4', n: '唐輪', zh: '唐輪雙髻', p: 32, look: { h: 4 }, steps: KAMI },
      { id: 'h3', n: '坊主', zh: '光頭', p: 16, look: { h: 3 }, steps: [S('剃る', '剃頭', 'mash'), S('整える', '整理', 'tap')] },
    ] },
  { id: 'wagashi', name: '白梅堂', kind: '和菓子', sign: '菓子', noren: '#7a2f4a', w: 12, floors: 2, side: 1, x: 0, wall: '#f2ead6',
    menu: [
      { id: 'yokan', n: '羊羹', zh: '羊羹', p: 24, dish: D('sweet', '#3a1a1a', '#3a1a1a'), steps: KASHI },
      { id: 'daifuku', n: '大福', zh: '大福', p: 8, dish: D('sweet', '#f6f2ea', '#f6f2ea'), steps: KASHI },
      { id: 'konpeito', n: '金平糖', zh: '金平糖', p: 12, dish: D('sweet', '#f2b8d0', '#b8d8f2'), steps: KASHI },
    ] },
  { id: 'komamono', name: '紅屋', kind: '小間物（飾品）', sign: '小間物', noren: '#a8323e', w: 10, floors: 2, side: 1, x: 18, wall: '#efe5d0', service: true,
    menu: [
      { id: 'kanzashi', n: '簪', zh: '髮簪', p: 40, look: { hat: 2 }, steps: KOMA },
      { id: 'kasa', n: '菅笠', zh: '斗笠', p: 30, look: { hat: 1 }, steps: KOMA },
      { id: 'sensu', n: '扇子', zh: '扇子', p: 30, look: { c: 1 }, steps: KOMA },
      { id: 'bangasa', n: '番傘', zh: '紅紙傘', p: 50, look: { c: 2 }, steps: KOMA },
      { id: 'none', n: '外す', zh: '卸下飾品（免費）', p: 0, look: { hat: 0, c: 0 }, steps: [S('外す', '卸下', 'tap')] },
    ] },
  { id: 'ekisha', name: '八卦見', kind: '占卜', sign: '易', noren: '#4a3a6a', w: 8, floors: 1, side: 1, x: 36, wall: '#e2d8c2', service: true, stall: true,
    menu: [
      { id: 'omikuji', n: 'おみくじ', zh: '求籤', p: 4, fortune: 'kuji', steps: EKI },
      { id: 'tesou', n: '手相', zh: '看手相', p: 20, fortune: 'palm', steps: EKI },
    ] },
  { id: 'yuya', name: '亀の湯', kind: '湯屋（泡湯）', sign: 'ゆ', noren: '#1f5a7a', w: 14, floors: 1, side: 1, x: 54, wall: '#ece4d2', service: true, chimney: true,
    menu: [
      { id: 'nyuyoku', n: '入浴', zh: '泡湯', p: 8, bath: true, steps: YU },
    ] },
];
export const STREET = { front: 7, x0: -100, x1: 106 }; // 店面線 |z| = 7

export const FORTUNE = {
  kuji: [['大吉', '萬事如意，今天點的每一碗都特別好吃。'], ['中吉', '在橋上會遇到有緣人。'], ['小吉', '小小的好運藏在糰子的第三顆裡。'], ['吉', '平穩的一天，適合看夕陽。'], ['末吉', '慢慢來，好事在後頭。'], ['凶', '小心別在河邊滑倒……換個髮型轉轉運吧。']],
  palm: [['財運', '掌紋顯示你很會做生意，試著開一家店吧！'], ['戀愛運', '櫻花樹下，會有人跟你搭話。'], ['健康運', '多泡湯、多走路，身體會很好。'], ['人緣', '你身邊總是熱熱鬧鬧，朋友會越來越多。']],
};
