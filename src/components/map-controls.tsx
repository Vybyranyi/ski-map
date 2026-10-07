"use client";

import { useState, type ReactNode } from "react";
import { FitIcon, LocateIcon, MoreIcon } from "@/components/icons";
import { floating } from "@/components/ui";
import { useGeo } from "@/lib/geo-store";
import type { MapPosition } from "@/lib/geo";

type Props = {
  position: MapPosition | null;
  picking: boolean;
  onFit: () => void;
  onLocate: () => void;
  onTogglePick: () => void;
};

const control = "grid size-11 place-items-center text-ink transition-colors active:bg-subtle";
const divider = "mx-2 h-px bg-hairline";
const menuRow = "flex min-h-11 w-full items-center px-4 text-left text-sm active:bg-subtle";

function Hint({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className={`max-w-60 rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug text-ink ${floating}`}>
      {children}
      {action}
    </div>
  );
}

/** Керування картою справа: весь курорт, «я тут» і (коли GPS увімкнено) меню GPS. */
export function MapControls({ position, picking, onFit, onLocate, onTogglePick }: Props) {
  const status = useGeo((s) => s.status);
  const weak = useGeo((s) => s.weakSignal);
  const offset = useGeo((s) => s.offset);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = status === "active" || status === "searching";
  const outside = status === "active" && position && !position.inside;
  const canPick = status === "active" && !!position?.inside;
  const menuVisible = menuOpen && active;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className={`flex flex-col overflow-hidden rounded-2xl ${floating}`}>
        <button type="button" onClick={onFit} aria-label="Показати весь курорт" className={control}>
          <FitIcon />
        </button>
        <div className={divider} />
        <button
          type="button"
          onClick={onLocate}
          aria-label={active ? "Показати мене на карті" : "Увімкнути GPS"}
          className={`${control} ${status === "searching" ? "animate-pulse" : ""} ${status === "active" ? "text-locate" : ""}`}
        >
          <LocateIcon filled={status === "active"} />
        </button>
        {active && (
          <>
            <div className={divider} />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Налаштування GPS"
              aria-expanded={menuVisible}
              className={`${control} ${menuVisible ? "bg-subtle" : ""}`}
            >
              <MoreIcon />
            </button>
          </>
        )}
      </div>

      {menuVisible && (
        <div className={`animate-sheet w-56 overflow-hidden rounded-2xl py-1 ${floating}`}>
          {canPick && (
            <button
              type="button"
              className={menuRow}
              onClick={() => {
                setMenuOpen(false);
                onTogglePick();
              }}
            >
              Я насправді тут…
            </button>
          )}
          {offset && (
            <button
              type="button"
              className={menuRow}
              onClick={() => {
                useGeo.getState().setOffset(null);
                setMenuOpen(false);
              }}
            >
              Скинути поправку
            </button>
          )}
          <button
            type="button"
            className={`${menuRow} text-bad`}
            onClick={() => {
              setMenuOpen(false);
              useGeo.getState().stop();
            }}
          >
            Вимкнути GPS
          </button>
        </div>
      )}

      {status === "searching" && <Hint>Шукаю сигнал GPS…</Hint>}
      {status === "active" && weak && <Hint>Сигнал слабкий, показую останню позицію</Hint>}
      {outside && <Hint>Ви за {position.distanceKm.toFixed(0)} км від курорту: точки на карті немає</Hint>}
      {picking && (
        <Hint
          action={
            <button type="button" onClick={onTogglePick} className="mt-1 block min-h-11 font-medium underline underline-offset-2">
              Скасувати
            </button>
          }
        >
          Тапніть на карті місце, де ви зараз насправді
        </Hint>
      )}
      {status === "denied" && <Hint>Немає доступу до геолокації. Дозвольте її для сайту в налаштуваннях браузера.</Hint>}
      {status === "unavailable" && <Hint>Цей браузер не підтримує геолокацію</Hint>}
    </div>
  );
}
