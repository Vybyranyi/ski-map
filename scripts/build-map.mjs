// Перетворює сирі дані Буковеля (data/raw) на:
//   src/data/generated/overlay.svg  — чистий SVG-оверлей (без фонового зображення)
//   src/data/generated/resort.json  — нормалізовані дані трас і підйомників
//
// Сирі файли отримані з https://bukovel.com/map-new/ :
//   map-dom.html  — серіалізований DOM карти (SVG збирається React-ом на льоту)
//   map-data.json — /api/v1/ski/map/trails/lifts/
//   status.json   — /api/v2/status-lifts-trails
//
// Запуск: npm run build:map

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const root = path.resolve(import.meta.dirname, '..');
const raw = (f) => path.join(root, 'data/raw', f);
const outDir = path.join(root, 'src/data/generated');
fs.mkdirSync(outDir, { recursive: true });

const mapData = JSON.parse(fs.readFileSync(raw('map-data.json'), 'utf8'));
const status = JSON.parse(fs.readFileSync(raw('status.json'), 'utf8')).data;

const num = (s) => (s === '' || s == null ? null : Number(s));
const DIFFS = ['green', 'blue', 'red', 'black'];
const warnings = [];

// ---------- дані ----------

const v2Trails = new Map();
for (const lift of status.lifts) {
  for (const t of lift.trails) v2Trails.set(t.title, t);
}
const v2Lifts = new Map(status.lifts.map((l) => [l.title, l]));

// У v1 складність надійна (збігається з типом EASY/MEDIUM/HARD у v2);
// поле difficultyLevel у v2 завжди BLUE, тому ігноруємо його.
const trails = Object.values(mapData.tracksData)
  .map((t) => {
    const name = t.info.name;
    const v2 = v2Trails.get(name);
    if (!DIFFS.includes(t.difficulty)) warnings.push(`невідома складність ${name}: ${t.difficulty}`);
    return {
      id: name,
      difficulty: t.difficulty,
      grade: v2 ? v2.type.type.toLowerCase() : null,
      liftId: t.info.lift?.name ?? null,
      bottom: num(t.info.bottom_height),
      top: num(t.info.top_height),
      distance: num(t.info.distance),
      notes: (v2?.notes ?? []).map((n) => n.text),
      freeride: v2?.isFreeRide ?? false,
      svg: [],
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const trailById = new Map(trails.map((t) => [t.id, t]));

const lifts = Object.entries(mapData.liftsData)
  .map(([key, l]) => {
    const name = l.info.name;
    const v2 = v2Lifts.get(name);
    return {
      id: name,
      key, // ключ у JSON, напр. "Lift1"
      type: l.info.type,
      typeName: v2?.type.name ?? null,
      traffic: num(l.info.traffic),
      bottom: num(l.info.bottom_height),
      top: num(l.info.top_height),
      distance: num(l.info.distance),
      svg: null,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const liftById = new Map(lifts.map((l) => [l.id, l]));

// ---------- SVG ----------

const dom = cheerio.load(fs.readFileSync(raw('map-dom.html'), 'utf8'));
const svgHtml = dom.html(dom('#mapObject'));
const $ = cheerio.load(svgHtml, { xmlMode: true });
const svg = $('svg').first();
const viewBox = svg.attr('viewBox');

// прибираємо атрибути розміру з root, залишаємо namespace-и та viewBox
for (const attr of Object.keys(svg.attr())) {
  if (!['xmlns', 'xmlns:xlink', 'viewBox'].includes(attr)) svg.removeAttr(attr);
}

const main = svg.children('g').first();
const groups = main.children('g').toArray();

// 0-ва група — фонове зображення, воно рендериться окремо
const bg = $(groups[0]);
if (!bg.find('image').length) throw new Error('очікував <image> у першій групі');
bg.remove();

// "13BRed", "5K-blue", "MBlue" → [{name, color}]
const TOKEN = /(\d+[A-Z]|[A-Z])-?(Green|Blue|Red|Black|green|blue|red|black)/g;
const tokensOf = (id) => [...id.matchAll(TOKEN)].map((m) => ({ name: m[1], color: m[2].toLowerCase() }));

const liftIdFromSvg = (svgId) => {
  const n = svgId.replace(/^Lift/, '');
  if (liftById.has(n)) return n;
  if (n.endsWith('R') && liftById.has(n.slice(0, -1))) return n.slice(0, -1); // Lift1R → 1
  return null;
};

// Три безіменні шматки ліній у SVG — продовження трас до станцій підйомників.
// Власників визначено геометрично (найближча траса до кінців лінії), порядок = порядок у SVG.
const SEGMENT_OWNERS = ['1E', '13B', '13B'];
let segmentIndex = 0;

const MARKERS = /^(lightMarkers|parking|ic-.*|crossroad)$/;
const unknown = [];
const summary = { trail: 0, connector: 0, lift: 0, marker: 0 };

for (const el of main.children('g').toArray()) {
  const g = $(el);
  const id = g.attr('id') ?? '';
  let kind;

  if (id.startsWith('Lift')) {
    kind = 'lift';
    const liftId = liftIdFromSvg(id);
    if (!liftId) unknown.push(id);
    else {
      g.attr('data-lift', liftId);
      liftById.get(liftId).svg = id;
    }
  } else if (id.startsWith('Track') || id.startsWith('Connector')) {
    const tokens = tokensOf(id);
    const names = [...new Set(tokens.map((t) => t.name))];
    // складність — з JSON (там 17A і 7D зелені, хоча в id вони Blue); запасний варіант — колір з id
    const diffs = [
      ...new Set(
        tokens.map((t) => trailById.get(t.name)?.difficulty ?? t.color),
      ),
    ];
    if (!tokens.length) unknown.push(id);
    // Track-7D-blue не має класу track, але має мітку з назвою — це справжня траса
    const isPrimary = id.startsWith('Track') && (g.hasClass('track') || g.hasClass('learning-area') || g.find('.label').length > 0);
    kind = isPrimary ? 'trail' : 'connector';
    g.attr('data-trail', names.join(' '));
    g.attr('data-diff', diffs.join(' '));
    if (isPrimary) {
      const t = trailById.get(names[0]);
      if (!t) warnings.push(`SVG-траса ${id} без запису в JSON`);
      else t.svg.push(id);
    }
  } else if (MARKERS.test(id)) {
    kind = 'marker';
  } else if (id === '') {
    // безіменні групи: або шматки ліній трас (stroke помаранчевий), або іконки
    const isSegment = g.find('[stroke="#FFA500"]').length || g.attr('stroke') === '#FFA500';
    if (isSegment) {
      const owner = SEGMENT_OWNERS[segmentIndex++];
      if (!trailById.has(owner)) warnings.push(`шматок лінії #${segmentIndex - 1} без відомого власника`);
      else {
        g.attr('data-trail', owner);
        g.attr('data-diff', trailById.get(owner).difficulty);
      }
      kind = 'connector';
    } else {
      kind = 'marker';
    }
  } else {
    kind = 'marker';
    unknown.push(id);
  }
  g.attr('data-kind', kind);
  summary[kind]++;
}

// унікальні id: лишаємо ті, на які є посилання (defs), та перше входження Track*/Lift*
const referenced = new Set();
const html0 = $.xml();
for (const m of html0.matchAll(/(?:href="#|url\(#)([^")]+)/g)) referenced.add(m[1]);
const seen = new Set();
$('[id]').each((_, el) => {
  const id = $(el).attr('id');
  const keep = referenced.has(id) || (/^(Track|Lift|Connector)/.test(id) && !seen.has(id));
  if (keep) seen.add(id);
  else $(el).removeAttr('id');
});

// інлайнові стилі root і порожні class
$('[class=""]').removeAttr('class');

const overlay = $.xml();
fs.writeFileSync(path.join(outDir, 'overlay.svg'), overlay);

// ---------- перевірки ----------

if (segmentIndex !== SEGMENT_OWNERS.length) warnings.push(`очікував ${SEGMENT_OWNERS.length} безіменних шматків ліній, знайшов ${segmentIndex}`);

for (const t of trails) if (!t.svg.length) warnings.push(`траса ${t.id} не знайдена в SVG`);
for (const l of lifts) if (!l.svg) warnings.push(`підйомник ${l.id} не знайдений в SVG`);

const resort = {
  source: 'https://bukovel.com/map-new/',
  viewBox,
  trails,
  lifts,
};
fs.writeFileSync(path.join(outDir, 'resort.json'), JSON.stringify(resort, null, 2) + '\n');

const byDiff = Object.fromEntries(DIFFS.map((d) => [d, trails.filter((t) => t.difficulty === d).length]));
console.log('viewBox:', viewBox);
console.log('елементи SVG:', summary);
console.log('траси:', trails.length, byDiff, '| підйомники:', lifts.length);
console.log('overlay.svg:', (overlay.length / 1024).toFixed(0), 'KB');
if (unknown.length) console.log('нерозпізнані id:', unknown);
if (warnings.length) console.log('УВАГА:\n - ' + warnings.join('\n - '));
