"use client";

import { useWeather } from "@/lib/weather-store";
import { describeCode, fmtTemp, fmtWind, windLevel } from "@/lib/weather";

const LEVEL_TEXT = { ok: "", strong: "text-amber-600 dark:text-amber-400", severe: "text-red-600 dark:text-red-400" } as const;

/** Коротка погода на верху: значок, температура, вітер. Тап відкриває панель. */
export function WeatherChip({ onOpen }: { onOpen: () => void }) {
  const data = useWeather((s) => s.data);
  const error = useWeather((s) => s.error);
  const top = data?.places.find((p) => p.id === "top");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Погода"
      className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-3.5 text-sm font-semibold text-zinc-800 shadow-lg ring-1 ring-black/5 active:bg-zinc-100 dark:bg-zinc-900/95 dark:text-zinc-100 dark:ring-white/10"
    >
      {top ? (
        <>
          <span aria-hidden="true">{describeCode(top.current.code).icon}</span>
          <span className="tabular-nums">{fmtTemp(top.current.temp)}</span>
          <span className={`tabular-nums text-xs font-medium ${LEVEL_TEXT[windLevel(top.current.windGust)] || "text-zinc-500"}`}>
            {fmtWind(top.current.windSpeed)} м/с
          </span>
        </>
      ) : (
        <span className="text-xs font-medium text-zinc-500">{error ? "Погода ↻" : "Погода…"}</span>
      )}
    </button>
  );
}
