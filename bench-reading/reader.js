import * as pdfjs from "./vendor/pdfjs/build/pdf.mjs";
import { normMap, locate } from "./lib/norm.js";

pdfjs.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/build/pdf.worker.mjs";

const CATS = { task: "任务构造", verifier: "Verifier", data: "数据与质量", result: "结果", limit: "局限" };
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const md = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

const id = new URLSearchParams(location.search).get("id");
const paper = await (await fetch(`data/${id}.json`)).json();
document.title = `${paper.title} · 精读`;
$("#title").textContent = paper.title;
$("#meta").textContent = paper.meta;
$("#arxiv").href = `https://arxiv.org/abs/${paper.arxiv}`;

const notesByPage = new Map();
paper.notes.forEach((n, i) => { n.num = i + 1; (notesByPage.get(n.page) ?? notesByPage.set(n.page, []).get(n.page)).push(n); });
const noteById = new Map(paper.notes.map((n) => [n.id, n]));

/* ---------- 右栏 ---------- */
const side = $("#side");
side.append(el("p", "q", `<span class="lab">这篇回答的问题</span>${md(paper.question)}`));
side.append(el("div", "sec", `<h3 class="lab">精炼总结</h3><ol>${paper.tldr.map((t) => `<li>${md(t)}</li>`).join("")}</ol>`));
side.append(el("div", "sec infer", `<h3 class="lab">对我们意味着什么 · 我的推断</h3><ul>${paper.forUs.map((t) => `<li>${md(t)}</li>`).join("")}</ul>`));
side.append(el("div", "sec", `<h3 class="lab">时间有限只读这些</h3><div class="rf">${paper.readFirst.map((r) => `<a data-go="${r.note}">${r.label}</a><span>${md(r.why)}</span>`).join("")}</div>`));
const listRoot = el("div"); side.append(listRoot);

/* ---------- 左栏：PDF ---------- */
const pdfPane = $("#pdf");
// 本机读本地 PDF；公开站点不转存论文，直接从 arXiv 读对应版本
const isLocal = /(^|\.)localhost$|^127\./.test(location.hostname);
const pdfUrl = isLocal && !new URLSearchParams(location.search).has("remote") ? paper.pdf : `https://arxiv.org/pdf/${paper.arxiv}${paper.ver ?? ""}`;
const doc = await pdfjs.getDocument({ url: pdfUrl, cMapUrl: "vendor/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "vendor/pdfjs/standard_fonts/" }).promise;
const first = await doc.getPage(1);
const base = first.getViewport({ scale: 1 });
const scale = Math.min(2.2, (pdfPane.clientWidth - 72) / base.width);
const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const d = el("div", "page"); d.dataset.page = n;
  d.style.width = `${base.width * scale}px`; d.style.height = `${base.height * scale}px`;
  d.style.setProperty("--scale-factor", scale);
  d.append(el("span", "pno", n));
  pdfPane.append(d);
  pages[n] = { div: d, done: null };
}

/* ---------- 右栏批注列表：小节总结按原文位置插在批注之间 ---------- */
const sections = paper.sections ?? [];
const secById = new Map(sections.map((x) => [x.id, x]));
{
  const posOf = new Map();
  for (const pn of new Set([...sections, ...paper.notes].map((x) => x.page))) {
    const tc = await (await doc.getPage(pn)).getTextContent();
    const text = normMap(tc.items.map((it) => it.str ?? "").join("")).out;
    for (const it of [...sections, ...paper.notes]) if (it.page === pn) posOf.set(it.id, locate(text, it)?.[0] ?? 1e9);
  }
  const items = [...sections.map((x) => ({ ...x, sec: true })), ...paper.notes];
  items.sort((x, y) => x.page - y.page || (posOf.get(x.id) ?? 0) - (posOf.get(y.id) ?? 0) || (x.sec ? -1 : 1));
  let cur = 0, num = 0;
  for (const it of items) {
    if (!it.sec) it.num = ++num; // 编号按原文出现顺序
    if (it.page !== cur) { cur = it.page; const g = el("div", "pg lab", `第 ${cur} 页`); g.dataset.page = cur; listRoot.append(g); }
    if (it.sec) {
      const d = el("div", "ssum", `<span class="st">${md(it.title)}</span>${md(it.summary)}`);
      d.dataset.sec = it.id; d.id = `sec-${it.id}`; listRoot.append(d);
    } else {
      const d = el("div", `note${it.key ? " key" : ""}`, `<span class="num">${it.num}</span><span>${md(it.note)}</span>${it.infer ? `<span class="inf">${md(it.infer)}</span>` : ""}`);
      d.dataset.cat = it.cat; d.dataset.note = it.id; d.id = `note-${it.id}`; listRoot.append(d);
    }
  }
}

function renderPage(n) {
  const p = pages[n];
  if (p.done) return p.done;
  return (p.done = (async () => {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale });
    p.div.style.width = `${vp.width}px`; p.div.style.height = `${vp.height}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = el("canvas"); canvas.width = vp.width * dpr; canvas.height = vp.height * dpr;
    const hl = el("div", "hl"); const tl = el("div", "textLayer");
    p.div.append(canvas, hl, tl);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] }).promise;
    const tc = await page.getTextContent();
    const layer = new pdfjs.TextLayer({ textContentSource: tc, container: tl, viewport: vp });
    await layer.render();
    refont(layer.textDivs, tc.items.filter((it) => it.str !== undefined));
    drawMarks(n, layer.textDivs, hl);
  })());
}

// 文本层默认用系统后备字体，字宽和 PDF 不同。改用 pdf.js 已加载的内嵌字体，
// 再按 PDF 给出的行宽重算横向拉伸，这样字形宽度和原文一致。
function refont(divs, items) {
  divs.forEach((d, i) => {
    const it = items[i];
    if (!it || !it.str.trim() || !it.width || Math.abs(it.transform[1]) > 0.01) return;
    if (!document.fonts.check(`12px "${it.fontName}"`)) return;
    d.style.fontFamily = `"${it.fontName}", ${d.style.fontFamily}`;
    d.style.transform = "none";
    const nat = d.getBoundingClientRect().width;
    if (nat > 0) d.style.transform = `scaleX(${(it.width * scale) / nat})`;
  });
}

// 文本层把整行均匀拉伸到 PDF 行宽，但两端对齐的 PDF 把多出的宽度全放在词间空格里，
// 所以行内字符位置会漂移。这里按"字形宽度不变、余量平摊到空格"还原真实横坐标。
function trueX(span, offset) {
  const text = span.textContent;
  const box = span.getBoundingClientRect();
  const s = new DOMMatrixReadOnly(getComputedStyle(span).transform).a || 1;
  if (s < 0.6 || s > 1.6 || !text.length) return null;
  const r = document.createRange();
  r.setStart(span.firstChild, 0); r.setEnd(span.firstChild, Math.min(offset, text.length));
  const nat = r.getBoundingClientRect().width / s;
  const spaces = (str) => (str.match(/ /g) || []).length;
  const total = spaces(text.trimEnd());
  const extra = total ? (box.width - box.width / s) / total : 0;
  if (!total) return box.left + nat * s;
  return box.left + nat + Math.min(spaces(text.slice(0, offset)), total) * extra;
}

function drawMarks(n, divs, hl) {
  const notes = notesByPage.get(n) ?? [];
  const secs = sections.filter((x) => x.page === n);
  if (!notes.length && !secs.length) return;
  let out = ""; const src = [];
  divs.forEach((d, di) => { const m = normMap(d.textContent); out += m.out; for (const off of m.map) src.push([di, off]); });
  const pr = pages[n].div.getBoundingClientRect();
  for (const sec of secs) {
    const hit = locate(out, sec); if (!hit) { console.warn("小节未命中", sec.id); continue; }
    const [a] = src[hit[0]];
    const pin = el("div", "spin", "§"); pin.dataset.sec = sec.id; pin.title = sec.title;
    pin.style.top = `${divs[a].getBoundingClientRect().top - pr.top - 19}px`;
    hl.append(pin);
  }
  for (const note of notes) {
    const hit = locate(out, note);
    if (!hit) { console.warn("未命中", note.id); continue; }
    const [a, ao] = src[hit[0]], [b, bo] = src[hit[1]];
    const range = document.createRange();
    range.setStart(divs[a].firstChild, ao); range.setEnd(divs[b].firstChild, bo + 1);
    // 同一行的碎片合并成一笔
    const lines = [];
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 3) continue;
      const mid = r.top + r.height / 2;
      const L = lines.find((l) => mid > l.top && mid < l.bottom && r.left < l.right + 30 && r.right > l.left - 30);
      if (L) { L.left = Math.min(L.left, r.left); L.right = Math.max(L.right, r.right); L.top = Math.min(L.top, r.top); L.bottom = Math.max(L.bottom, r.bottom); }
      else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    if (lines.length) {
      lines[0].left = trueX(divs[a], ao) ?? lines[0].left;
      lines.at(-1).right = trueX(divs[b], bo + 1) ?? lines.at(-1).right;
    }
    lines.forEach((l) => {
      const m = el("div", `mark${note.key ? " key" : ""}`);
      m.dataset.cat = note.cat; m.dataset.note = note.id;
      Object.assign(m.style, { left: `${l.left - pr.left - 1}px`, top: `${l.top - pr.top}px`, width: `${l.right - l.left + 2}px`, height: `${l.bottom - l.top}px` });
      hl.append(m);
    });
    if (lines[0]) {
      const pin = el("div", `pin${note.key ? " key" : ""}`, note.num);
      pin.dataset.cat = note.cat; pin.dataset.note = note.id;
      pin.style.top = `${lines[0].top - pr.top}px`;
      hl.append(pin);
    }
  }
  applyFilter();
}

const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && renderPage(+e.target.dataset.page)), { root: pdfPane, rootMargin: "900px 0px" });
pages.forEach((p) => p && io.observe(p.div));

/* ---------- 联动：批注 ⇄ 高亮 双向 ---------- */
const marksOf = (nid) => document.querySelectorAll(`.mark[data-note="${nid}"]`);
function setActive(nid) {
  document.querySelectorAll(".note.active").forEach((e) => e.classList.remove("active"));
  $(`#note-${nid}`)?.classList.add("active");
  history.replaceState(null, "", `#${nid}`);
}
function flash(nid) {
  marksOf(nid).forEach((m) => { m.classList.remove("flash"); void m.offsetWidth; m.classList.add("flash"); });
}
// 右 → 左：把 PDF 滚到这条批注的高亮处
async function goMark(nid) {
  const note = noteById.get(nid); if (!note) return;
  setActive(nid);
  const p = pages[note.page];
  if (!p.done) pdfPane.scrollTop = p.div.offsetTop - 8;
  await renderPage(note.page);
  const m = marksOf(nid)[0];
  if (m) {
    const y = m.getBoundingClientRect().top - pdfPane.getBoundingClientRect().top + pdfPane.scrollTop;
    pdfPane.scrollTop = y - pdfPane.clientHeight * 0.3;
  } else pdfPane.scrollTop = p.div.offsetTop - 8;
  flash(nid);
}
// 左 → 右：把右栏滚到这条批注
function goNote(nid) {
  setActive(nid);
  const n = $(`#note-${nid}`); if (!n) return;
  side.scrollTop = n.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop - side.clientHeight * 0.3;
  flash(nid);
}
async function goSec(sid, fromPdf) {
  const sec = secById.get(sid); if (!sec) return;
  document.querySelectorAll(".ssum.active").forEach((e) => e.classList.remove("active"));
  const d = $(`#sec-${sid}`); d?.classList.add("active");
  if (fromPdf) { if (d) side.scrollTop = d.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop - side.clientHeight * 0.25; return; }
  const p = pages[sec.page];
  if (!p.done) pdfPane.scrollTop = p.div.offsetTop - 8;
  await renderPage(sec.page);
  const pin = p.div.querySelector(`.spin[data-sec="${sid}"]`);
  pdfPane.scrollTop = pin ? pin.getBoundingClientRect().top - pdfPane.getBoundingClientRect().top + pdfPane.scrollTop - pdfPane.clientHeight * 0.2 : p.div.offsetTop - 8;
  if (pin) { pin.classList.remove("flash"); void pin.offsetWidth; pin.classList.add("flash"); }
}
side.addEventListener("click", (e) => {
  const ss = e.target.closest(".ssum"); if (ss) return goSec(ss.dataset.sec);
  const go = e.target.closest("[data-go]"); if (go) { goMark(go.dataset.go).then(() => goNote(go.dataset.go)); return; }
  const n = e.target.closest(".note"); if (n) goMark(n.dataset.note);
});
// 高亮在文本层下面（保留选字），所以用坐标判断点中了哪条
function markAt(x, y) {
  for (const m of document.querySelectorAll(".mark:not(.hide)")) {
    const r = m.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top - 1 && y <= r.bottom + 1) return m.dataset.note;
  }
  return null;
}
pdfPane.addEventListener("click", (e) => {
  const sp = e.target.closest(".spin"); if (sp) return goSec(sp.dataset.sec, true);
  const pin = e.target.closest(".pin"); if (pin) return goNote(pin.dataset.note);
  if (String(getSelection())) return;
  const nid = markAt(e.clientX, e.clientY); if (nid) goNote(nid);
});
let hot = null, mv = 0;
function setHot(nid) {
  if (nid === hot) return; hot = nid;
  document.querySelectorAll(".hot").forEach((e) => e.classList.remove("hot"));
  if (nid) { marksOf(nid).forEach((m) => m.classList.add("hot")); $(`#note-${nid}`)?.classList.add("hot"); }
}
pdfPane.addEventListener("mousemove", (e) => {
  cancelAnimationFrame(mv);
  mv = requestAnimationFrame(() => { const nid = markAt(e.clientX, e.clientY); pdfPane.classList.toggle("over-mark", !!nid); setHot(nid); });
});
pdfPane.addEventListener("mouseleave", () => setHot(null));
side.addEventListener("mouseover", (e) => setHot(e.target.closest(".note")?.dataset.note ?? null));
side.addEventListener("mouseleave", () => setHot(null));

// 滚动 PDF 时，右栏跟到当前页的批注
let hoverPdf = false, curPage = 0, tick = 0;
pdfPane.addEventListener("mouseenter", () => (hoverPdf = true));
pdfPane.addEventListener("mouseleave", () => (hoverPdf = false));
pdfPane.addEventListener("scroll", () => {
  cancelAnimationFrame(tick);
  tick = requestAnimationFrame(() => {
    const y = pdfPane.scrollTop + pdfPane.clientHeight * 0.35;
    let n = 1; while (n < doc.numPages && pages[n + 1].div.offsetTop <= y) n++;
    $("#pageind").textContent = `${n} / ${doc.numPages}`;
    if (n === curPage) return; curPage = n;
    document.querySelectorAll(".pg.cur").forEach((e) => e.classList.remove("cur"));
    const g = $(`.pg[data-page="${n}"]`);
    if (g) { g.classList.add("cur"); if (hoverPdf) side.scrollTop = g.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop; }
  });
});
$("#pageind").textContent = `1 / ${doc.numPages}`;

/* ---------- 筛选 ---------- */
const off = new Set(); let keyOnly = false;
const chips = $("#chips");
for (const [k, label] of Object.entries(CATS)) {
  const c = el("span", "chip", `<i style="background:var(--c-${k})"></i>${label}`);
    c.onclick = () => { off.has(k) ? off.delete(k) : off.add(k); c.classList.toggle("off"); applyFilter(); };
  chips.append(c);
}
$("#keyonly").onclick = (e) => { keyOnly = !keyOnly; e.currentTarget.classList.toggle("on-key", keyOnly); applyFilter(); };
function applyFilter() {
  document.querySelectorAll("[data-note]").forEach((e) => {
    const n = noteById.get(e.dataset.note); if (!n) return;
    e.classList.toggle("hide", off.has(n.cat) || (keyOnly && !n.key));
  });
  document.querySelectorAll(".pg").forEach((g) => {
    const pn = +g.dataset.page;
    const any = sections.some((x) => x.page === pn) || (notesByPage.get(pn) ?? []).some((n) => !off.has(n.cat) && !(keyOnly && !n.key));
    g.classList.toggle("hide", !any);
  });
}

if (location.hash.length > 1) { const h = location.hash.slice(1); goMark(h).then(() => goNote(h)); }
