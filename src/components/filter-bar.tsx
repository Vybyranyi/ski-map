"use client";

import { CheckIcon } from "@/components/icons";
import { DIFFICULTIES, DIFFICULTY_META, type Difficulty } from "@/lib/difficulty";

type Props = {
  hidden: readonly Difficulty[];
  onToggle: (d: Difficulty) => void;
};

/** Чотири складності: кольорове коло з галочкою = показано, порожнє кільце = сховано. */
export function FilterBar({ hidden, onToggle }: Props) {
  return (
    <div role="group" aria-label="Складність трас" className="grid grid-cols-4">
      {DIFFICULTIES.map((d) => {
        const meta = DIFFICULTY_META[d];
        const off = hidden.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={!off}
            onClick={() => onToggle(d)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors active:bg-subtle"
          >
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
    </div>
  );
}
