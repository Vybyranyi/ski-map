"use client";

import { CheckIcon, SlidersIcon } from "@/components/icons";
import { DIFFICULTIES, DIFFICULTY_META, type Difficulty } from "@/lib/difficulty";

type Props = {
  hidden: readonly Difficulty[];
  onToggle: (d: Difficulty) => void;
  /** скільки додаткових фільтрів увімкнено («лише відкриті», «вечірнє») */
  extraActive: number;
  menuOpen: boolean;
  onMenu: () => void;
};

const cell =
  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors active:bg-subtle";

/** Нижня панель: чотири складності (кольорове коло = показано, порожнє кільце = сховано) і меню фільтрів. */
export function FilterBar({ hidden, onToggle, extraActive, menuOpen, onMenu }: Props) {
  return (
    <div role="group" aria-label="Фільтри трас" className="grid grid-cols-5">
      {DIFFICULTIES.map((d) => {
        const meta = DIFFICULTY_META[d];
        const off = hidden.includes(d);
        return (
          <button key={d} type="button" aria-pressed={!off} onClick={() => onToggle(d)} className={cell}>
            <span
              className="grid size-6 place-items-center rounded-full text-white transition-colors"
              style={{ background: off ? "transparent" : meta.color, boxShadow: `inset 0 0 0 2px ${meta.color}` }}
            >
              {!off && <CheckIcon className="size-3.5" />}
            </span>
            <span className={off ? "text-muted" : "text-ink"}>{meta.plural}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="filter-menu"
        aria-label={extraActive ? `Фільтри, увімкнено: ${extraActive}` : "Фільтри"}
        onClick={onMenu}
        className={`${cell} relative before:absolute before:inset-y-3 before:left-0 before:w-px before:bg-hairline ${
          menuOpen ? "bg-subtle" : ""
        }`}
      >
        <span className="relative grid size-6 place-items-center text-ink">
          <SlidersIcon />
          {extraActive > 0 && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-ink ring-2 ring-surface" />}
        </span>
        <span className="text-ink">Фільтри</span>
      </button>
    </div>
  );
}
