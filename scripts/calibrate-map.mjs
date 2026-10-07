// Калібрує зв'язок «GPS → піксель карти».
//
// Опорні точки — кінці підйомників: пікселі з нашого SVG (data/raw/lift-pixels.json) і справжні
// координати з OpenStreetMap (data/raw/osm-aerialways.json), висоти станцій — з даних Буковеля.
// Порівнює три моделі (афінна, гомографія, повна камера з висотою) leave-one-lift-out і
// записує найкращу в src/data/generated/geo-calibration.json.
//
// Запуск: npm run calibrate:map   (--report — лише звіт, без запису)

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const osm = readJson("data/raw/osm-aerialways.json");
const pixels = readJson("data/raw/lift-pixels.json");
const resort = readJson("src/data/generated/resort.json");
const reportOnly = process.argv.includes("--report");

// ---------- геометрія ----------

const ORIGIN = { lat: 48.365, lon: 24.4 };
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLocal = (lat, lon) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, (lat - ORIGIN.lat) * M_PER_DEG_LAT];

// ---------- лінійна алгебра (дрібні системи) ----------

function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-14) throw new Error("вироджена система");
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Найменші квадрати: min |Ax − b|² через нормальні рівняння (з крихітною регуляризацією). */
function lstsq(rows, rhs) {
  const n = rows[0].length;
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  rows.forEach((row, i) => {
    for (let a = 0; a < n; a++) {
      Atb[a] += row[a] * rhs[i];
      for (let c = 0; c < n; c++) AtA[a][c] += row[a] * row[c];
    }
  });
  for (let a = 0; a < n; a++) AtA[a][a] += 1e-9;
  return solve(AtA, Atb);
}

// ---------- моделі: point = {x, y, z (км, відносно центру), u, v (тис. px, відносно центру)} ----------

const MODELS = {
  // u,v — лінійні по (x, y)
  affine: {
    min: 3,
    fit: (pts) => {
      const rows = pts.map((p) => [p.x, p.y, 1]);
      return { u: lstsq(rows, pts.map((p) => p.u)), v: lstsq(rows, pts.map((p) => p.v)) };
    },
    project: (m, x, y) => [m.u[0] * x + m.u[1] * y + m.u[2], m.v[0] * x + m.v[1] * y + m.v[2]],
  },
  // гомографія (8 параметрів, пласка сцена)
  homography: {
    min: 4,
    fit: (pts) => {
      const rows = [];
      const rhs = [];
      for (const p of pts) {
        rows.push([p.x, p.y, 1, 0, 0, 0, -p.u * p.x, -p.u * p.y]);
        rhs.push(p.u);
        rows.push([0, 0, 0, p.x, p.y, 1, -p.v * p.x, -p.v * p.y]);
        rhs.push(p.v);
      }
      return { h: lstsq(rows, rhs) };
    },
    project: ({ h }, x, y) => {
      const w = h[6] * x + h[7] * y + 1;
      return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
    },
  },
  // повна камера 3×4 (DLT) з висотою: перспективна проєкція 3D-рельєфу
  camera: {
    min: 6,
    fit: (pts) => {
      const rows = [];
      const rhs = [];
      for (const p of pts) {
        rows.push([p.x, p.y, p.z, 1, 0, 0, 0, 0, -p.u * p.x, -p.u * p.y, -p.u * p.z]);
        rhs.push(p.u);
        rows.push([0, 0, 0, 0, p.x, p.y, p.z, 1, -p.v * p.x, -p.v * p.y, -p.v * p.z]);
        rhs.push(p.v);
      }
      return { P: lstsq(rows, rhs) };
    },
    project: ({ P }, x, y, z) => {
      const w = P[8] * x + P[9] * y + P[10] * z + 1;
      return [
        (P[0] * x + P[1] * y + P[2] * z + P[3]) / w,
        (P[4] * x + P[5] * y + P[6] * z + P[7]) / w,
      ];
    },
  },
};

// ---------- опорні точки ----------

const liftMeta = new Map(resort.lifts.map((l) => [l.id, l]));
const osmLifts = new Map();
for (const way of osm.elements) {
  const id = way.tags?.ref || way.tags?.name;
  if (id && liftMeta.has(id) && pixels[id]) osmLifts.set(id, way);
}

const raw = []; // по підйомнику: геометрія низу/верху, висоти, два піксельні кінці
for (const [id, way] of osmLifts) {
  const meta = liftMeta.get(id);
  if (meta.bottom == null || meta.top == null) continue;
  const first = way.geometry[0];
  const last = way.geometry[way.geometry.length - 1];
  const [bx, by] = toLocal(first.lat, first.lon);
  const [tx, ty] = toLocal(last.lat, last.lon);
  raw.push({
    id,
    bottom: { x: bx, y: by, z: meta.bottom, lat: first.lat, lon: first.lon },
    top: { x: tx, y: ty, z: meta.top, lat: last.lat, lon: last.lon },
    px: [pixels[id].a, pixels[id].b],
  });
}

// центруємо й масштабуємо (км, тис. px) — для стійкості розв'язку
const all = raw.flatMap((r) => [r.bottom, r.top]);
const mean = (f) => all.reduce((s, p) => s + f(p), 0) / all.length;
const C = { x: mean((p) => p.x), y: mean((p) => p.y), z: mean((p) => p.z) };
const allPx = raw.flatMap((r) => r.px);
const PXC = [allPx.reduce((s, p) => s + p[0], 0) / allPx.length, allPx.reduce((s, p) => s + p[1], 0) / allPx.length];
const norm = (g) => ({ x: (g.x - C.x) / 1000, y: (g.y - C.y) / 1000, z: (g.z - C.z) / 1000 });
const normPx = (p) => [(p[0] - PXC[0]) / 1000, (p[1] - PXC[1]) / 1000];

/** flips[i] = true → піксельний кінець 0 відповідає верху, а не низу */
function buildPoints(flips, skip = -1) {
  const pts = [];
  raw.forEach((r, i) => {
    if (i === skip) return;
    const [pb, pt] = flips[i] ? [r.px[1], r.px[0]] : [r.px[0], r.px[1]];
    const nb = normPx(pb);
    const nt = normPx(pt);
    pts.push({ ...norm(r.bottom), u: nb[0], v: nb[1], lift: r.id });
    pts.push({ ...norm(r.top), u: nt[0], v: nt[1], lift: r.id });
  });
  return pts;
}

const err = (model, params, p) => {
  const [u, v] = model.project(params, p.x, p.y, p.z);
  return Math.hypot(u - p.u, v - p.v) * 1000; // px
};
const rms = (xs) => Math.sqrt(xs.reduce((s, e) => s + e * e, 0) / xs.length);

// ---------- орієнтація підйомників: який піксельний кінець — низ ----------
// Старт: вищий над рівнем моря кінець зазвичай вище на екрані. Далі ітеративно перевертаємо
// ті, чий переворот зменшує нев'язку афінної моделі з висотою (3 параметри на вісь + z).

const flips = raw.map((r) => r.px[0][1] < r.px[1][1] === false); // кінець 0 нижче на екрані → він низ → flip=false
// (flip=true означає, що кінець 0 = верх; верх має менший y)
for (let i = 0; i < raw.length; i++) flips[i] = raw[i].px[0][1] < raw[i].px[1][1];

for (let iter = 0; iter < 20; iter++) {
  let changed = 0;
  const model = MODELS.camera;
  for (let i = 0; i < raw.length; i++) {
    const params = model.fit(buildPoints(flips, i));
    const trial = (flip) => {
      const [pb, pt] = flip ? [raw[i].px[1], raw[i].px[0]] : [raw[i].px[0], raw[i].px[1]];
      const nb = normPx(pb);
      const nt = normPx(pt);
      return (
        err(model, params, { ...norm(raw[i].bottom), u: nb[0], v: nb[1] }) +
        err(model, params, { ...norm(raw[i].top), u: nt[0], v: nt[1] })
      );
    };
    if (trial(!flips[i]) < trial(flips[i]) - 1e-9) {
      flips[i] = !flips[i];
      changed++;
    }
  }
  if (!changed) break;
}

// ---------- порівняння моделей: leave-one-lift-out ----------

console.log(`Підйомників із парою OSM↔піксель: ${raw.length} (${raw.map((r) => r.id).join(", ")})`);
const results = {};
for (const [name, model] of Object.entries(MODELS)) {
  const cv = [];
  for (let i = 0; i < raw.length; i++) {
    const params = model.fit(buildPoints(flips, i));
    const held = buildPoints(flips).filter((p) => p.lift === raw[i].id);
    for (const p of held) cv.push(err(model, params, p));
  }
  const full = model.fit(buildPoints(flips));
  const train = buildPoints(flips).map((p) => err(model, full, p));
  results[name] = { cvRms: rms(cv), cvMax: Math.max(...cv), trainRms: rms(train), params: full };
  console.log(
    `${name.padEnd(10)} train RMS ${rms(train).toFixed(1).padStart(6)} px | leave-one-out RMS ${rms(cv).toFixed(1).padStart(6)} px, max ${Math.max(...cv).toFixed(0)} px`,
  );
}

// масштаб: пікселів на метр (з афінної моделі)
{
  const a = results.affine.params;
  const sx = Math.hypot(a.u[0], a.v[0]); // тис.px на км = px на м
  const sy = Math.hypot(a.u[1], a.v[1]);
  console.log(`Масштаб (афінне наближення): ~${sx.toFixed(2)} px/м по x, ~${sy.toFixed(2)} px/м по y`);
}

// ---------- уточнення за кривими трас (ICP) ----------
// OSM-траси (повні лінії) зіставляємо з піксельними лініями трас у SVG: проєктуємо, шукаємо
// найближчу точку тієї ж траси, перепідбираємо камеру. Висоти вздовж траси — лінійно між
// верхом і низом із даних Буковеля (орієнтацію лінії OSM вгадуємо за нев'язкою).

const trailPixels = fs.existsSync(path.join(root, "data/raw/trail-pixels.json")) ? readJson("data/raw/trail-pixels.json") : {};
const pistes = fs.existsSync(path.join(root, "data/raw/osm-pistes.json")) ? readJson("data/raw/osm-pistes.json") : { elements: [] };
const trailMeta = new Map(resort.trails.map((t) => [t.id, t]));

function densify(geometry, stepM) {
  const pts = geometry.map((g) => toLocal(g.lat, g.lon));
  const out = [];
  let total = 0;
  const seg = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push(len);
    total += len;
  }
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const n = Math.max(1, Math.round(seg[i] / stepM));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, s: (acc + seg[i] * t) / (total || 1) });
    }
    acc += seg[i];
  }
  out.push({ x: pts.at(-1)[0], y: pts.at(-1)[1], s: 1 });
  return { pts: out, total };
}

// лише траси, що в OSM є одним відрізком (інакше висоти вздовж фрагмента невідомі)
const wayCount = new Map();
for (const w of pistes.elements) {
  const id = w.tags?.["piste:ref"] || w.tags?.ref || w.tags?.name;
  if (id) wayCount.set(id, (wayCount.get(id) ?? 0) + 1);
}
const trailWays = [];
for (const w of pistes.elements) {
  const id = w.tags?.["piste:ref"] || w.tags?.ref || w.tags?.name;
  const meta = trailMeta.get(id);
  if (!id || !meta || wayCount.get(id) !== 1 || !trailPixels[id] || meta.top == null || meta.bottom == null) continue;
  const { pts, total } = densify(w.geometry, 20);
  if (total < 80) continue;
  trailWays.push({ id, pts, top: meta.top, bottom: meta.bottom, cloud: trailPixels[id] });
}

function nearest(cloud, px) {
  let best = 1e9;
  let bp = null;
  for (const c of cloud) {
    const d = (c[0] - px[0]) ** 2 + (c[1] - px[1]) ** 2;
    if (d < best) {
      best = d;
      bp = c;
    }
  }
  return { d: Math.sqrt(best), p: bp };
}

const toPx = (u, v) => [u * 1000 + PXC[0], v * 1000 + PXC[1]];

function trailCorrespondences(params, thr) {
  const corr = [];
  const orient = [];
  for (const w of trailWays) {
    const evalOrient = (down) => {
      const rows = [];
      for (const p of w.pts) {
        const z = down ? w.top + (w.bottom - w.top) * p.s : w.bottom + (w.top - w.bottom) * p.s;
        const g = norm({ x: p.x, y: p.y, z });
        const [u, v] = MODELS.camera.project(params, g.x, g.y, g.z);
        const near = nearest(w.cloud, toPx(u, v));
        rows.push({ g, d: near.d, near: near.p });
      }
      const score = rows.reduce((a, r) => a + Math.min(r.d, thr), 0) / rows.length;
      return { rows, score };
    };
    const a = evalOrient(true);
    const b = evalOrient(false);
    const pick = a.score <= b.score ? a : b;
    orient.push(pick === a);
    const good = pick.rows.filter((r) => r.d < thr);
    const stride = Math.max(1, Math.floor(good.length / 25));
    good.forEach((r, i) => {
      if (i % stride) return;
      const n = normPx(r.near);
      corr.push({ ...r.g, u: n[0], v: n[1], trail: w.id });
    });
  }
  return { corr, orient };
}

function fitCameraWeighted(sets) {
  const rows = [];
  const rhs = [];
  for (const { pts, w } of sets) {
    const sw = Math.sqrt(w);
    for (const p of pts) {
      rows.push([p.x * sw, p.y * sw, p.z * sw, sw, 0, 0, 0, 0, -p.u * p.x * sw, -p.u * p.y * sw, -p.u * p.z * sw]);
      rhs.push(p.u * sw);
      rows.push([0, 0, 0, 0, p.x * sw, p.y * sw, p.z * sw, sw, -p.v * p.x * sw, -p.v * p.y * sw, -p.v * p.z * sw]);
      rhs.push(p.v * sw);
    }
  }
  return { P: lstsq(rows, rhs) };
}

let refined = null;
if (trailWays.length >= 10) {
  const liftPts = buildPoints(flips);
  let params = results.camera.params;
  let corr = [];
  let orient = [];
  for (let iter = 0; iter < 18; iter++) {
    const thr = Math.max(45, 160 - iter * 8);
    ({ corr, orient } = trailCorrespondences(params, thr));
    params = fitCameraWeighted([
      { pts: liftPts, w: 8 },
      { pts: corr, w: 1 },
    ]);
  }
  ({ orient } = trailCorrespondences(params, 45));
  const trailsOnly = fitCameraWeighted([{ pts: corr, w: 1 }]);
  const liftErrTrailsOnly = rms(liftPts.map((p) => err(MODELS.camera, trailsOnly, p)));
  const liftErrFinal = rms(liftPts.map((p) => err(MODELS.camera, params, p)));
  const corrErr = rms(corr.map((p) => err(MODELS.camera, params, p)));
  console.log(
    `\nУточнення по ${trailWays.length} трасах (${corr.length} відповідностей): ` +
      `підйомники, модель лише за трасами (незалежна перевірка) RMS ${liftErrTrailsOnly.toFixed(1)} px; ` +
      `підсумкова модель: підйомники ${liftErrFinal.toFixed(1)} px, криві трас ${corrErr.toFixed(1)} px`,
  );
  refined = { params, orient, cvRms: liftErrTrailsOnly, cvMax: Math.max(...liftPts.map((p) => err(MODELS.camera, trailsOnly, p))), trailsOnly };
}

const baseline = Object.entries(results).sort((a, b) => a[1].cvRms - b[1].cvRms)[0];
const chosen = refined
  ? { name: "camera", params: refined.params, cvRms: refined.cvRms, cvMax: refined.cvMax, note: "камера, уточнена по кривих трас (ICP)" }
  : { name: baseline[0], params: baseline[1].params, cvRms: baseline[1].cvRms, cvMax: baseline[1].cvMax, note: "лише кінці підйомників" };
console.log(`\nОбрано: ${chosen.name} (${chosen.note})`);

// Цифрова модель рельєфу з наявних ліній: точки трас (z лінійно між верхом і низом) і підйомників.
// Пласкі масиви [x, y, z, x, y, z, ...] у метрах відносно ORIGIN, округлені.
function buildDem() {
  const flat = [];
  const push = (x, y, z) => flat.push(Math.round(x), Math.round(y), Math.round(z));
  trailWays.forEach((w, i) => {
    const down = refined ? refined.orient[i] : true;
    w.pts.forEach((p, k) => {
      if (k % 2) return; // крок ≈ 40 м
      push(p.x, p.y, down ? w.top + (w.bottom - w.top) * p.s : w.bottom + (w.top - w.bottom) * p.s);
    });
  });
  for (const r of raw) {
    const way = osmLifts.get(r.id);
    const { pts } = densify(way.geometry, 40);
    for (const p of pts) push(p.x, p.y, r.bottom.z + (r.top.z - r.bottom.z) * p.s);
  }
  return flat;
}

if (!reportOnly) {
  const out = {
    model: chosen.name,
    params: chosen.params,
    origin: ORIGIN,
    center: C,
    pixelCenter: PXC,
    // нев'язка кінців підйомників для моделі, навченої лише на трасах — незалежна оцінка
    accuracy: { liftEndsRmsPx: +chosen.cvRms.toFixed(1), liftEndsMaxPx: +chosen.cvMax.toFixed(0), pxPerMeter: 0.351 },
    sources: { liftPairs: raw.length, trailsUsed: trailWays.length },
    dem: buildDem(),
  };
  const { dem, ...rest } = out;
  fs.writeFileSync(
    path.join(root, "src/data/generated/geo-calibration.json"),
    JSON.stringify(rest, null, 2).replace(/\n}$/, `,\n  "dem": ${JSON.stringify(dem)}\n}`) + "\n",
  );
  console.log("записано src/data/generated/geo-calibration.json");
}

// ---------- діагностика: нев'язки по підйомниках (камера, leave-one-out) ----------
if (process.argv.includes("--residuals")) {
  console.log("\nНев'язки (leave-one-out, px) і орієнтація:");
  const rowsOut = raw.map((r, i) => {
    const params = MODELS.camera.fit(buildPoints(flips, i));
    const held = buildPoints(flips).filter((p) => p.lift === r.id);
    const [eb, et] = held.map((p) => err(MODELS.camera, params, p));
    return { id: r.id, flip: flips[i], bottom: eb, top: et, hDrop: r.top.z - r.bottom.z };
  });
  rowsOut.sort((a, b) => Math.max(b.bottom, b.top) - Math.max(a.bottom, a.top));
  for (const r of rowsOut)
    console.log(`  ${r.id.padEnd(3)} низ ${r.bottom.toFixed(0).padStart(4)}  верх ${r.top.toFixed(0).padStart(4)}  flip=${r.flip}  Δh=${r.hDrop}`);
}

if (process.argv.includes("--bias") && refined) {
  const liftPts = buildPoints(flips);
  const dv = liftPts.map((p) => {
    const [u, v] = MODELS.camera.project(refined.trailsOnly, p.x, p.y, p.z);
    return [(p.u - u) * 1000, (p.v - v) * 1000, p.lift];
  });
  const mu = dv.reduce((s, d) => s + d[0], 0) / dv.length;
  const mv = dv.reduce((s, d) => s + d[1], 0) / dv.length;
  console.log(`\nСистемний зсув кінців підйомників (піксель з SVG − модель за трасами): du=${mu.toFixed(1)} dv=${mv.toFixed(1)} px`);
  console.log("після віднімання зсуву RMS =", rms(dv.map((d) => Math.hypot(d[0] - mu, d[1] - mv))).toFixed(1), "px");
  const alongZ = dv.map((d, i) => [liftPts[i].z * 1000, d[1]]);
  const mz = alongZ.reduce((s, a) => s + a[0], 0) / alongZ.length;
  const cov = alongZ.reduce((s, a) => s + (a[0] - mz) * (a[1] - mv), 0);
  const varz = alongZ.reduce((s, a) => s + (a[0] - mz) ** 2, 0);
  console.log(`залежність dv від висоти: ${(cov / varz).toFixed(3)} px на метр`);
}

if (process.argv.includes("--cv") && refined) {
  // 5-fold за трасами: модель на 4/5 трас (+ підйомники), відстань до кривої на решті
  const liftPts = buildPoints(flips);
  const ids = trailWays.map((w) => w.id);
  const dists = [];
  for (let fold = 0; fold < 5; fold++) {
    const held = new Set(ids.filter((_, i) => i % 5 === fold));
    const keep = trailWays.filter((w) => !held.has(w.id));
    const saved = trailWays.splice(0, trailWays.length, ...keep);
    let params = results.camera.params;
    let corr = [];
    for (let iter = 0; iter < 18; iter++) {
      ({ corr } = trailCorrespondences(params, Math.max(45, 160 - iter * 8)));
      params = fitCameraWeighted([{ pts: liftPts, w: 8 }, { pts: corr, w: 1 }]);
    }
    trailWays.splice(0, trailWays.length, ...saved);
    // тестові траси: відстань проєкції точок OSM до піксельної кривої (орієнтацію обираємо як у ICP)
    const test = trailWays.filter((w) => held.has(w.id));
    const saved2 = trailWays.splice(0, trailWays.length, ...test);
    const { corr: tc } = trailCorrespondences(params, 400);
    trailWays.splice(0, trailWays.length, ...saved2);
    for (const c of tc) dists.push(err(MODELS.camera, params, c));
  }
  dists.sort((a, b) => a - b);
  const q = (p) => dists[Math.floor(p * (dists.length - 1))].toFixed(0);
  console.log(`\n5-fold за трасами (відстань до кривої, px): RMS ${rms(dists).toFixed(1)}, медіана ${q(0.5)}, 90-й перцентиль ${q(0.9)}  (1 px ≈ ${(1 / 0.351).toFixed(1)} м)`);
}
