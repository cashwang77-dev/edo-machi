// 髒話過濾（前端與伺服器共用）
const EXC = ['幹部', '幹嘛', '幹麻', '能幹', '骨幹', '樹幹', '幹線', '才幹', '主幹', '幹事', '幹活', '苦幹', '實幹', '精幹', '軀幹', '幹練', '幹勁', '肝膽', 'shiitake', 'cocktail', 'dickens', 'scunthorpe'];
const BAD = ['幹你', '干你', '幹妳', '幹您', '幹拎', '幹林', '操你', '肏', '靠北', '靠杯', '靠腰', '靠夭', '雞掰', '機掰', '雞歪', '機歪', '雞巴', '鸡巴', '屌你', '婊子', '賤人', '賤貨', '白癡', '白痴', '智障', '腦殘', '去死', '他媽', '她媽', '他妈', '你媽的', '媽的', '妈的', '三小', '塞你', '王八蛋', '混蛋', '廢物', '垃圾人', '低能', '北七', '俗辣', '死ね', 'しね', '殺す', 'ころす', 'くそ', 'クソ', 'ちんこ', 'まんこ', 'fuck', 'fuk', 'fck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'dick', 'pussy', 'stfu', 'wtf', '幹'];
const SKIP = /[\s*.\-_~!@#$%^&()+=,，。、！？?…·'"`|\\/:;：；<>《》「」『』【】\[\]{}]/;
export function cleanText(s) {
  const src = [...String(s || '')]; const keep = [];
  src.forEach((ch, i) => { const n = ch.normalize('NFKC').toLowerCase(); if (SKIP.test(n)) return; for (const c of n) keep.push([c, i]); });
  const j = keep.map(k => k[0]).join('');
  const prot = new Array(j.length).fill(false);
  for (const e of EXC) { let p = j.indexOf(e); while (p >= 0) { for (let k = 0; k < e.length; k++) prot[p + k] = true; p = j.indexOf(e, p + 1); } }
  const mask = new Set(); let bad = false;
  for (const w of BAD) {
    let p = j.indexOf(w);
    while (p >= 0) {
      let free = false; for (let k = 0; k < w.length; k++) if (!prot[p + k]) free = true;
      if (free) { bad = true; for (let k = 0; k < w.length; k++) mask.add(keep[p + k][1]); }
      p = j.indexOf(w, p + 1);
    }
  }
  return { text: src.map((c, i) => mask.has(i) ? '＊' : c).join(''), bad };
}
