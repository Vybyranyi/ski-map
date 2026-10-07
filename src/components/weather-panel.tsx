"use client";

import { useState } from "react";
import { AlertIcon, ArrowDownIcon, RefreshIcon, SnowflakeIcon, WeatherIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { iconBtn } from "@/components/ui";
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

const LEVEL_TEXT = { ok: "", strong: "text-warn", severe: "text-bad" } as const;

function PlaceColumn({ place }: { place: PlaceWeather }) {
  const c = place.current;
  const desc = describeCode(c.code);
  const level = windLevel(c.windGust);
  return (
    <div className="min-w-0 flex-1">
      <div className="text-sm text-muted">
        {place.name} · {Math.round(place.elevation)} м
      </div>
      <div className="mt-1 flex items-center gap-2">
        <WeatherIcon kind={desc.kind} className="size-7" />
        <span className="text-3xl font-semibold tabular-nums">{fmtTemp(c.temp)}</span>
      </div>
      <div className="mt-1 text-sm text-muted">
        {desc.label}, відчувається {fmtTemp(c.feelsLike)}
      </div>
      <div className={`mt-3 flex items-center gap-1.5 text-sm font-medium tabular-nums ${LEVEL_TEXT[level]}`}>
        {/* стрілка вказує, куди дме вітер: «з півночі» (0°) — вниз */}
        <ArrowDownIcon className="size-4" style={{ transform: `rotate(${c.windDir}deg)` }} />
        {fmtWind(c.windSpeed)} м/с
        <span className="font-normal text-muted">{windFrom(c.windDir)}</span>
      </div>
      <div className={`text-sm tabular-nums ${level === "ok" ? "text-muted" : LEVEL_TEXT[level]}`}>
        пориви до {fmtWind(c.windGust)} м/с
      </div>
      <div className="mt-1 text-sm text-muted tabular-nums">
        {c.snowfall > 0 ? `сніг ${c.snowfall.toFixed(1)} см/год` : c.precip > 0 ? `опади ${c.precip.toFixed(1)} мм/год` : "без опадів"}
      </div>
    </div>
  );
}

function HourColumn({ h }: { h: HourPoint }) {
  const level = windLevel(h.windGust);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 text-center">
      <span className="text-xs text-muted tabular-nums">{h.time.slice(11, 16)}</span>
      <WeatherIcon kind={describeCode(h.code).kind} />
      <span className="text-sm font-medium tabular-nums">{fmtTemp(h.temp)}</span>
      <span className={`text-xs tabular-nums ${level === "ok" ? "text-muted" : LEVEL_TEXT[level]}`}>
        {fmtWind(h.windSpeed)}/{fmtWind(h.windGust)}
      </span>
      <span className="flex h-4 items-center gap-0.5 text-xs text-muted tabular-nums">
        {h.snowfall > 0 && (
          <>
            <SnowflakeIcon className="size-3" />
            {h.snowfall.toFixed(1)}
          </>
        )}
      </span>
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
    <Sheet
      title="Погода"
      onClose={onClose}
      actions={
        <button
          type="button"
          onClick={() => void useWeather.getState().refresh(true)}
          aria-label="Оновити погоду"
          className={`${iconBtn} ${loading ? "animate-spin" : ""}`}
        >
          <RefreshIcon />
        </button>
      }
    >
      {!data ? (
        <p className="py-8 text-center text-sm text-muted">
          {error ? `Не вдалось отримати погоду (${error}). Спробуйте пізніше.` : "Завантажую…"}
        </p>
      ) : (
        <>
          {level !== "ok" && (
            <p className={`mb-4 flex items-start gap-2 text-sm ${LEVEL_TEXT[level]}`}>
              <AlertIcon className="mt-0.5 size-4" />
              {WIND_LABEL[level]}
            </p>
          )}

          <div className="flex gap-4">
            {[...data.places].reverse().map((p) => (
              <PlaceColumn key={p.id} place={p} />
            ))}
          </div>

          {sun?.sunrise && sun.sunset && (
            <p className="mt-4 text-sm text-muted">
              Світанок {sun.sunrise} · захід {sun.sunset}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
            <h3 className="text-sm font-semibold">Найближчі години</h3>
            <div className="flex gap-0.5 rounded-full bg-subtle p-0.5 text-sm font-medium">
              {(["top", "base"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={hourlyFor === id}
                  onClick={() => setHourlyFor(id)}
                  className={`h-9 rounded-full px-4 transition-colors ${hourlyFor === id ? "bg-surface shadow-sm" : "text-muted"}`}
                >
                  {id === "top" ? "Верх" : "Низ"}
                </button>
              ))}
            </div>
          </div>
          <div className="no-scrollbar -mx-5 mt-3 flex gap-1 overflow-x-auto px-5 pb-1">
            {hourlyPlace?.hourly.map((h) => <HourColumn key={h.time} h={h} />)}
          </div>
          <p className="mt-1 text-xs text-muted">Вітер/пориви, м/с · сніг, см за годину</p>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            {error && <span className="mb-1 block text-warn">Немає зв&apos;язку, показано дані від {updated}</span>}
            Дані:{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Open-Meteo.com
            </a>{" "}
            (CC BY 4.0), оновлено о {updated}. Це модельний прогноз для двох точок, а не показники метеостанцій курорту.
          </p>
        </>
      )}
    </Sheet>
  );
}
