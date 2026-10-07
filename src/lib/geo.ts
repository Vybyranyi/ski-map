import calibration from "@/data/generated/geo-calibration.json";
import { MAP_HEIGHT, MAP_WIDTH } from "@/data/resort";

// Модель «GPS → піксель карти» з scripts/calibrate-map.mjs: перспективна камера 3×4
// (карта Буковеля — ілюстрація з перспективою) + рельєф для висоти.

const { origin, center, pixelCenter, params, dem, accuracy } = calibration;
const P = (params as { P: number[] }).P;

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((origin.lat * Math.PI) / 180);

/** пікселів карти на метр (середнє по карті) */
export const PX_PER_METER = accuracy.pxPerMeter;

/** Типова похибка моделі (медіана на непобачених трасах ≈ 9 px), м — додаємо до похибки GPS */
const MODEL_ERROR_M = 25;

/** Далі від найближчої точки ліній висоту беремо не з рельєфу, а з GPS (або середню) */
const DEM_MAX_DIST = 250; // м
const DEM_K = 4;

export type GeoFix = {
  lat: number;
  lon: number;
  /** висота за GPS, м (може бути null) */
  alt: number | null;
  /** похибка положення за GPS, м */
  accuracy: number;
};

export type MapPosition = {
  /** координати в системі карти (px у viewBox) */
  x: number;
  y: number;
  /** радіус кола похибки, px карти */
  radius: number;
  /** чи точка в межах карти (з невеликим запасом) */
  inside: boolean;
  /** відстань від центру курорту, км */
  distanceKm: number;
};

function toLocal(lat: number, lon: number): [number, number] {
  return [(lon - origin.lon) * M_PER_DEG_LON, (lat - origin.lat) * M_PER_DEG_LAT];
}

/** Висота рельєфу в точці: зважене середнє (IDW) найближчих точок ліній трас/підйомників. */
function elevationAt(x: number, y: number): number | null {
  const best: { d: number; z: number }[] = [];
  for (let i = 0; i < dem.length; i += 3) {
    const d = Math.hypot(dem[i] - x, dem[i + 1] - y);
    if (d > DEM_MAX_DIST) continue;
    if (best.length < DEM_K) best.push({ d, z: dem[i + 2] });
    else {
      let worst = 0;
      for (let k = 1; k < best.length; k++) if (best[k].d > best[worst].d) worst = k;
      if (d < best[worst].d) best[worst] = { d, z: dem[i + 2] };
    }
  }
  if (!best.length) return null;
  let sw = 0;
  let sz = 0;
  for (const b of best) {
    const w = 1 / (b.d + 10) ** 2;
    sw += w;
    sz += w * b.z;
  }
  return sz / sw;
}

function project(x: number, y: number, z: number): [number, number] | null {
  const X = (x - center.x) / 1000;
  const Y = (y - center.y) / 1000;
  const Z = (z - center.z) / 1000;
  const w = P[8] * X + P[9] * Y + P[10] * Z + 1;
  if (w <= 0) return null; // точка «за камерою» — далеко за межами карти
  const u = (P[0] * X + P[1] * Y + P[2] * Z + P[3]) / w;
  const v = (P[4] * X + P[5] * Y + P[6] * Z + P[7]) / w;
  return [u * 1000 + pixelCenter[0], v * 1000 + pixelCenter[1]];
}

/** GPS-координати → точка на карті (без ручної поправки). */
export function gpsToMap(fix: GeoFix): MapPosition | null {
  const [x, y] = toLocal(fix.lat, fix.lon);
  const distanceKm = Math.hypot(x - center.x, y - center.y) / 1000;
  const z = elevationAt(x, y) ?? fix.alt ?? center.z;
  const px = distanceKm < 15 ? project(x, y, z) : null;
  if (!px) return { x: 0, y: 0, radius: 0, inside: false, distanceKm };

  const margin = 150;
  const inside = px[0] > -margin && px[0] < MAP_WIDTH + margin && px[1] > -margin && px[1] < MAP_HEIGHT + margin;
  return {
    x: px[0],
    y: px[1],
    radius: Math.hypot(fix.accuracy, MODEL_ERROR_M) * PX_PER_METER,
    inside,
    distanceKm,
  };
}
