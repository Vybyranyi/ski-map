// Витягує піксельну геометрію трас і підйомників з src/data/generated/overlay.svg:
//   data/raw/lift-pixels.json  — два кінці кожного підйомника
//   data/raw/trail-pixels.json — хмара точок вздовж кожної траси
// getCTM/getPointAtLength потребують рендеру, тож використовуємо headless Chrome.
//
// Запуск: npm run extract:geometry   (CHROME=/шлях/до/chrome, якщо не macOS-за-замовчуванням)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const overlay = fs.readFileSync(path.join(root, "src/data/generated/overlay.svg"), "utf8");

const page = `<!doctype html><meta charset="utf-8"><style>svg{width:2865px;height:1648px}</style>
${overlay}
<pre id="out"></pre>
<script>
try {
  const svg = document.querySelector('svg');
  const lifts = {}, trails = {};

  for (const g of svg.querySelectorAll('[data-kind=lift]')) {
    const pts = [];
    for (const el of g.querySelectorAll(':scope > line, :scope > path')) {
      const m = el.getCTM();
      const P = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); pts.push([p.x, p.y]); };
      if (el.tagName === 'line') { P(el.x1.baseVal.value, el.y1.baseVal.value); P(el.x2.baseVal.value, el.y2.baseVal.value); }
      else { const L = el.getTotalLength(); for (let l = 0; l <= L; l += 3) { const q = el.getPointAtLength(l); P(q.x, q.y); } const q = el.getPointAtLength(L); P(q.x, q.y); }
    }
    let best = [0, 0, -1];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d > best[2]) best = [i, j, d];
    }
    lifts[g.dataset.lift] = { a: pts[best[0]].map((v) => +v.toFixed(1)), b: pts[best[1]].map((v) => +v.toFixed(1)), len: +best[2].toFixed(0), n: pts.length };
  }

  for (const g of svg.querySelectorAll('[data-kind=trail]')) {
    if (g.classList.contains('learning-area')) continue;
    const id = g.dataset.trail.split(' ')[0];
    const pts = [];
    for (const el of g.querySelectorAll('path,line')) {
      if (el.closest('.label')) continue;
      if (!el.closest('[stroke]')) continue;
      const m = el.getCTM();
      const P = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); pts.push([+p.x.toFixed(1), +p.y.toFixed(1)]); };
      if (el.tagName === 'line') {
        const a = [el.x1.baseVal.value, el.y1.baseVal.value], b = [el.x2.baseVal.value, el.y2.baseVal.value];
        for (let t = 0; t <= 1; t += 0.05) P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      } else { const L = el.getTotalLength(); for (let l = 0; l <= L; l += 4) { const q = el.getPointAtLength(l); P(q.x, q.y); } }
    }
    (trails[id] ||= []).push(...pts);
  }
  document.getElementById('out').textContent = 'RESULT' + JSON.stringify({ lifts, trails });
} catch (e) { document.getElementById('out').textContent = 'ERR ' + e.message; }
</script>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ski-geometry-"));
const file = path.join(tmp, "page.html");
fs.writeFileSync(file, page);

const dom = execFileSync(
  chrome,
  ["--headless=new", "--disable-gpu", "--window-size=2865,1648", "--virtual-time-budget=8000", "--dump-dom", `file://${file}`],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
);
fs.rmSync(tmp, { recursive: true, force: true });

const match = dom.match(/RESULT(\{.*\})<\/pre>/s);
if (!match) throw new Error("не вдалось витягти геометрію: " + (dom.match(/ERR [^<]*/)?.[0] ?? "немає результату"));
const { lifts, trails } = JSON.parse(match[1]);
fs.writeFileSync(path.join(root, "data/raw/lift-pixels.json"), JSON.stringify(lifts));
fs.writeFileSync(path.join(root, "data/raw/trail-pixels.json"), JSON.stringify(trails));
console.log(`підйомників: ${Object.keys(lifts).length}, трас: ${Object.keys(trails).length}`);
