// Погода з Open-Meteo (https://open-meteo.com, дані CC BY 4.0, безкоштовно для некомерційного
// використання, без ключа; CORS відкритий, тож запити йдуть прямо з браузера).

export type PlaceId = "base" | "top";

export const PLACES: { id: PlaceId; name: string; lat: number; lon: number; elevation: number }[] = [
  { id: "base", name: "Низ", lat: 48.3569, lon: 24.404, elevation: 900 }, // біля бази, нижня станція підйомника 5
  { id: "top", name: "Верх", lat: 48.3681, lon: 24.3691, elevation: 1370 }, // верхня станція підйомника 12 (найвища)
];

export type HourPoint = {
  /** локальний час Києва, "2026-10-07T21:00" */
  time: string;
  temp: number;
  code: number;
  /** м/с */
  windSpeed: number;
  windGust: number;
  /** см снігу за годину */
  snowfall: number;
  /** ймовірність опадів, % */
  precipProb: number | null;
};

export type PlaceWeather = {
  id: PlaceId;
  name: string;
  elevation: number;
  current: {
    time: string;
    temp: number;
    feelsLike: number;
    code: number;
    cloud: number;
    windSpeed: number;
    windDir: number;
    windGust: number;
    precip: number;
    snowfall: number;
  };
  /** найближчі години, починаючи з поточної */
  hourly: HourPoint[];
  /** "07:30" / "18:49" (сьогодні) */
  sunrise: string | null;
  sunset: string | null;
};

export type Weather = { fetchedAt: number; places: PlaceWeather[] };

const HOURS_AHEAD = 24;

export function forecastUrl(): string {
  const q = new URLSearchParams({
    latitude: PLACES.map((p) => p.lat).join(","),
    longitude: PLACES.map((p) => p.lon).join(","),
    // висота потрібна для поправки температури на рельєф
    elevation: PLACES.map((p) => p.elevation).join(","),
    current:
      "temperature_2m,apparent_temperature,precipitation,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,precipitation_probability,snowfall,weather_code,wind_speed_10m,wind_gusts_10m",
    daily: "sunrise,sunset",
    wind_speed_unit: "ms",
    timezone: "Europe/Kyiv",
    forecast_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Розбирає відповідь Open-Meteo (масив із двох локацій у порядку PLACES). */
export function parseForecast(json: unknown, now: number): Weather | null {
  if (!Array.isArray(json) || json.length !== PLACES.length) return null;

  const places: PlaceWeather[] = [];
  for (const [i, raw] of json.entries()) {
    if (!isObj(raw) || !isObj(raw.current) || !isObj(raw.hourly)) return null;
    const c = raw.current;
    const h = raw.hourly;

    const temp = num(c.temperature_2m);
    const windSpeed = num(c.wind_speed_10m);
    const windGust = num(c.wind_gusts_10m);
    const code = num(c.weather_code);
    if (temp == null || windSpeed == null || windGust == null || code == null || typeof c.time !== "string") return null;

    const times = Array.isArray(h.time) ? (h.time as unknown[]) : [];
    const col = (key: string) => (Array.isArray(h[key]) ? (h[key] as unknown[]) : []);
    const [hTemp, hCode, hWind, hGust, hSnow, hProb] = [
      col("temperature_2m"),
      col("weather_code"),
      col("wind_speed_10m"),
      col("wind_gusts_10m"),
      col("snowfall"),
      col("precipitation_probability"),
    ];

    // час локальний і в одному форматі, тож рядки порівнюються як є
    const currentHour = `${c.time.slice(0, 13)}:00`;
    const start = times.findIndex((t) => typeof t === "string" && t >= currentHour);
    const hourly: HourPoint[] = [];
    if (start >= 0) {
      for (let k = start; k < Math.min(times.length, start + HOURS_AHEAD); k++) {
        const t = num(hTemp[k]);
        const w = num(hWind[k]);
        const g = num(hGust[k]);
        const cd = num(hCode[k]);
        if (typeof times[k] !== "string" || t == null || w == null || g == null || cd == null) continue;
        hourly.push({
          time: times[k] as string,
          temp: t,
          code: cd,
          windSpeed: w,
          windGust: g,
          snowfall: num(hSnow[k]) ?? 0,
          precipProb: num(hProb[k]),
        });
      }
    }

    const daily = isObj(raw.daily) ? raw.daily : {};
    const hhmm = (v: unknown) => (Array.isArray(v) && typeof v[0] === "string" ? v[0].slice(11, 16) : null);

    places.push({
      id: PLACES[i].id,
      name: PLACES[i].name,
      elevation: num(raw.elevation) ?? PLACES[i].elevation,
      current: {
        time: c.time,
        temp,
        feelsLike: num(c.apparent_temperature) ?? temp,
        code,
        cloud: num(c.cloud_cover) ?? 0,
        windSpeed,
        windDir: num(c.wind_direction_10m) ?? 0,
        windGust,
        precip: num(c.precipitation) ?? 0,
        snowfall: num(c.snowfall) ?? 0,
      },
      hourly,
      sunrise: hhmm(daily.sunrise),
      sunset: hhmm(daily.sunset),
    });
  }
  return { fetchedAt: now, places };
}

// ---------- відображення ----------

export type WeatherKind = "clear" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm";

/** WMO weather code → підпис і тип значка */
export function describeCode(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: "Ясно", kind: "clear" };
  if (code === 1) return { label: "Переважно ясно", kind: "clear" };
  if (code === 2) return { label: "Мінлива хмарність", kind: "partly" };
  if (code === 3) return { label: "Хмарно", kind: "cloud" };
  if (code === 45 || code === 48) return { label: "Туман", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Морось", kind: "rain" };
  if (code >= 61 && code <= 65) return { label: "Дощ", kind: "rain" };
  if (code === 66 || code === 67) return { label: "Крижаний дощ", kind: "rain" };
  if (code >= 71 && code <= 75) return { label: "Сніг", kind: "snow" };
  if (code === 77) return { label: "Снігова крупа", kind: "snow" };
  if (code >= 80 && code <= 82) return { label: "Злива", kind: "rain" };
  if (code === 85 || code === 86) return { label: "Снігопад", kind: "snow" };
  if (code >= 95) return { label: "Гроза", kind: "storm" };
  return { label: "—", kind: "cloud" };
}

export type WindLevel = "ok" | "strong" | "severe";

/**
 * Орієнтовна оцінка за поривами, м/с. Це евристика, а не правило Буковеля: пороги, за яких
 * зупиняють підйомники, залежать від типу підйомника й рішення служби.
 */
export function windLevel(gust: number): WindLevel {
  if (gust >= 15) return "severe";
  if (gust >= 10) return "strong";
  return "ok";
}

export const WIND_LABEL: Record<WindLevel, string> = {
  ok: "",
  strong: "Поривчастий вітер: на відкритих ділянках буде відчутно",
  severe: "Сильний вітер: підйомники можуть зупинятись",
};

/** З мінусом-символом, а не дефісом */
export function fmtTemp(t: number): string {
  const r = Math.round(t);
  return `${r < 0 ? "−" : ""}${Math.abs(r)}°`;
}

export const fmtWind = (v: number) => String(Math.round(v));

const COMPASS = ["Пн", "ПнСх", "Сх", "ПдСх", "Пд", "ПдЗх", "Зх", "ПнЗх"];
/** Звідки дме вітер (за градусами метеорологічного напрямку) */
export const windFrom = (deg: number) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
