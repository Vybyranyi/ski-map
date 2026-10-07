"use client";

import { WeatherIcon } from "@/components/icons";
import { floating } from "@/components/ui";
import { useWeather } from "@/lib/weather-store";
import { describeCode, fmtTemp, fmtWind, windLevel } from "@/lib/weather";

const LEVEL_TEXT = { ok: "text-muted", strong: "text-warn", severe: "text-bad" } as const;

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
      className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-medium active:bg-subtle ${floating}`}
    >
      {top ? (
        <>
          <WeatherIcon kind={describeCode(top.current.code).kind} />
          <span className="tabular-nums">{fmtTemp(top.current.temp)}</span>
          <span className={`tabular-nums ${LEVEL_TEXT[windLevel(top.current.windGust)]}`}>
            {fmtWind(top.current.windSpeed)} м/с
          </span>
        </>
      ) : (
        <span className="text-muted">{error ? "Погода недоступна" : "Погода…"}</span>
      )}
    </button>
  );
}
