// 锚点匹配用的文本归一化：去空白、连字符、引号，转小写，拆连字。
// 浏览器高亮和 validate.ts 共用同一份，保证"校验通过"等于"页面能标上"。
const DROP = /[\s­\-‐-―"'`‘’“”̀-ͯ]/;

export function normMap(str) {
  let out = "";
  const map = [];
  for (let i = 0; i < str.length; i++) {
    const d = str[i].normalize("NFKD").toLowerCase();
    for (const c of d) {
      if (DROP.test(c)) continue;
      out += c;
      map.push(i);
    }
  }
  return { out, map };
}

export const norm = (s) => normMap(s).out;

// 在归一化后的页面文本里定位一条批注，返回 [start, end]（闭区间）或 null
export function locate(pageNorm, note) {
  const a = norm(note.from);
  const s = pageNorm.indexOf(a);
  if (s < 0) return null;
  if (!note.to) return [s, s + a.length - 1];
  const b = norm(note.to);
  const e = pageNorm.indexOf(b, s);
  if (e < 0 || e - s > 2500) return null;
  return [s, e + b.length - 1];
}
