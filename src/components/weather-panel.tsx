"use client";

import { useState } from "react";
import {
  WIND_LABEL,
  describeCode,
  fmtTemp,
  fmtWind,
  windFrom,
  windLevel,
  type HourPoint,
  type PlaceId,
  type PlaceWeather,
} from "@/lib/weather";
import { useWeather } from "@/lib/weather-store";

const LEVEL_TEXT = { ok: "", strong: "text-amber-600 dark:text-amber-400", severe: "text-red-600 dark:text-red-400" } as const;
const LEVEL_BANNER = {
  strong: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  severe: "bg-red-500/15 text-red-700 dark:text-red-300",
} as const;

const iconBtn = "grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 active:bg-black/5 dark:active:bg-white/10";

function WindArrow({ from }: { from: number }) {
  // стрілка вказує, куди дме вітер: «з півночі» (0°) — вниз
  return (
    <span aria-hidden="true" className="inline-block" style={{ transform: `rotate(${from}deg)` }}>
      ↓
    </span>
  );
}

function PlaceCard({ place }: { place: PlaceWeather }) {
  const c = place.current;
  const desc = describeCode(c.code);
  const level = windLevel(c.windGust);
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-black/5 p-3 dark:bg-white/10">
      <div className="text-xs text-zinc-500">
        {place.name} · {Math.round(place.elevation)} м
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-3xl" aria-hidden="true">{desc.icon}</span>
        <span className="text-3xl font-semibold tabular-nums">{fmtTemp(c.temp)}</span>
      </div>
      <div className="mt-0.5 text-xs text-zinc-500">
        {desc.label} · відчувається {fmtTemp(c.feelsLike)}
      </div>
      <div className={`mt-2 text-sm tabular-nums ${LEVEL_TEXT[level]}`}>
        <WindArrow from={c.windDir} /> {fmtWind(c.windSpeed)} м/с
        <span className="ml-1 text-xs text-zinc-500">{windFrom(c.windDir)}</span>
      </div>
      <div className={`text-xs tabular-nums ${level === "ok" ? "text-zinc-500" : LEVEL_TEXT[level]}`}>
        пориви до {fmtWind(c.windGust)} м/с
      </div>
      <div className="mt-0.5 text-xs text-zinc-500 tabular-nums">
        {c.snowfall > 0 ? `сніг ${c.snowfall.toFixed(1)} см/год` : c.precip > 0 ? `опади ${c.precip.toFixed(1)} мм/год` : "без опадів"} · хмари {Math.round(c.cloud)}%
      </div>
    </div>
  );
}

function HourColumn({ h }: { h: HourPoint }) {
  const level = windLevel(h.windGust);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-0.5 text-center">
      <span className="text-xs text-zinc-500 tabular-nums">{h.time.slice(11, 16)}</span>
      <span className="text-xl" aria-hidden="true">{describeCode(h.code).icon}</span>
      <span className="text-sm font-semibold tabular-nums">{fmtTemp(h.temp)}</span>
      <span className={`text-xs tabular-nums ${LEVEL_TEXT[level]}`}>
        {fmtWind(h.windSpeed)}
        <span className="text-zinc-400">/</span>
        {fmtWind(h.windGust)}
      </span>
      <span className="h-4 text-[11px] text-sky-600 tabular-nums dark:text-sky-400">{h.snowfall > 0 ? `❄ ${h.snowfall.toFixed(1)}` : ""}</span>
    </div>
  );
}

export function WeatherPanel({ onClose }: { onClose: () => void }) {
  const data = useWeather((s) => s.data);
  const error = useWeather((s) => s.error);
  const loading = useWeather((s) => s.loading);
  const [hourlyFor, setHourlyFor] = useState<PlaceId>("top");

  const hourlyPlace = data?.places.find((p) => p.id === hourlyFor);
  const worst = data ? Math.max(...data.places.map((p) => p.current.windGust)) : 0;
  const level = windLevel(worst);
  const updated = data
    ? new Date(data.fetchedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
    : null;
  const sun = data?.places[0];

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="Погода">
      <button type="button" aria-label="Закрити погоду" className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-y-auto rounded-t-3xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-lg font-semibold">Погода</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void useWeather.getState().refresh(true)}
              aria-label="Оновити погоду"
              className={`${iconBtn} ${loading ? "animate-spin" : ""}`}
            >
              ↻
            </button>
            <button type="button" onClick={onClose} aria-label="Закрити" className={`${iconBtn} text-xl`}>
              ×
            </button>
          </div>
        </div>

        {!data ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            {error ? `Не вдалось отримати погоду (${error}). Спробуйте пізніше.` : "Завантажую…"}
          </p>
        ) : (
          <>
            {level !== "ok" && (
              <div className={`mx-4 mb-3 rounded-xl px-3 py-2 text-sm ${LEVEL_BANNER[level]}`}>{WIND_LABEL[level]}</div>
            )}

            <div className="flex gap-3 px-4">
              {[...data.places].reverse().map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </div>

            {sun?.sunrise && sun.sunset && (
              <div className="px-4 pt-3 text-xs text-zinc-500">
                Світанок {sun.sunrise} · захід {sun.sunset}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between px-4">
              <div className="text-sm font-semibold">Найближчі години</div>
              <div className="flex gap-1 rounded-full bg-black/5 p-0.5 text-xs font-medium dark:bg-white/10">
                {(["top", "base"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={hourlyFor === id}
                    onClick={() => setHourlyFor(id)}
                    className={`rounded-full px-3 py-1 ${hourlyFor === id ? "bg-white shadow dark:bg-zinc-700" : ""}`}
                  >
                    {id === "top" ? "Верх" : "Низ"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              {hourlyPlace?.hourly.map((h) => <HourColumn key={h.time} h={h} />)}
            </div>
            <div className="px-4 pt-1 text-[11px] text-zinc-400">Вітер / пориви, м/с · сніг, см за годину</div>

            <div className="px-4 pt-4 text-[11px] text-zinc-400">
              {error && <div className="mb-1 text-red-500">Немає зв&apos;язку, показано дані від {updated}</div>}
              Дані:{" "}
              <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline">
                Open-Meteo.com
              </a>{" "}
              (CC BY 4.0), оновлено о {updated}. Це модельний прогноз для двох точок, а не показники метеостанцій курорту.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
