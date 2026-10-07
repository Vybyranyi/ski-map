"use client";

import { useGeo } from "@/lib/geo-store";
import type { MapPosition } from "@/lib/geo";

const glass =
  "rounded-full bg-white/95 text-zinc-700 shadow-lg ring-1 ring-black/5 active:bg-zinc-100 dark:bg-zinc-900/95 dark:text-zinc-200 dark:ring-white/10";

type Props = {
  position: MapPosition | null;
  picking: boolean;
  onLocate: () => void;
  onTogglePick: () => void;
};

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-56 rounded-xl bg-white/95 px-3 py-2 text-right text-xs text-zinc-700 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900/95 dark:text-zinc-200 dark:ring-white/10">
      {children}
    </div>
  );
}

export function LocateControls({ position, picking, onLocate, onTogglePick }: Props) {
  const status = useGeo((s) => s.status);
  const weak = useGeo((s) => s.weakSignal);
  const offset = useGeo((s) => s.offset);
  const active = status === "active" || status === "searching";
  const outside = status === "active" && position && !position.inside;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onLocate}
        aria-label={active ? "Показати мене на карті" : "Увімкнути GPS"}
        className={`${glass} grid size-11 place-items-center ${
          status === "active" ? "!bg-blue-600 !text-white" : ""
        } ${status === "searching" ? "animate-pulse" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.5" fill={status === "active" ? "currentColor" : "none"} />
          <circle cx="12" cy="12" r="8" />
          <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
        </svg>
      </button>

      {active && (
        <div className="flex flex-col items-end gap-2 text-xs font-medium">
          <button type="button" onClick={() => useGeo.getState().stop()} className={`${glass} h-8 px-3`}>
            Вимкнути GPS
          </button>
          {status === "active" && position?.inside && (
            <button
              type="button"
              onClick={onTogglePick}
              className={`h-8 rounded-full px-3 shadow-lg ring-1 ring-black/5 ${
                picking ? "bg-amber-500 text-white" : "bg-white/95 text-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200"
              }`}
            >
              {picking ? "Скасувати" : "Я насправді тут…"}
            </button>
          )}
          {offset && !picking && (
            <button type="button" onClick={() => useGeo.getState().setOffset(null)} className={`${glass} h-8 px-3`}>
              Скинути поправку
            </button>
          )}
        </div>
      )}

      {status === "searching" && <Hint>Шукаю сигнал GPS…</Hint>}
      {status === "active" && weak && <Hint>Сигнал GPS слабкий, показую останню позицію</Hint>}
      {outside && <Hint>Ви за {position.distanceKm.toFixed(0)} км від курорту: точки на карті немає</Hint>}
      {picking && <Hint>Тапніть на карті місце, де ви зараз насправді</Hint>}
      {status === "denied" && <Hint>Немає доступу до геолокації. Дозвольте її для сайту в налаштуваннях браузера.</Hint>}
      {status === "unavailable" && <Hint>Цей браузер не підтримує геолокацію</Hint>}
    </div>
  );
}
