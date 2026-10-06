"use client";

import { DIFFICULTIES, DIFFICULTY_META, type Difficulty } from "@/lib/difficulty";
import { trails } from "@/data/resort";

const counts = Object.fromEntries(
  DIFFICULTIES.map((d) => [d, trails.filter((t) => t.difficulty === d).length]),
) as Record<Difficulty, number>;

type Props = {
  hidden: readonly Difficulty[];
  onToggle: (d: Difficulty) => void;
};

export function FilterBar({ hidden, onToggle }: Props) {
  return (
    <div role="group" aria-label="Складність трас" className="grid grid-cols-4 gap-2">
      {DIFFICULTIES.map((d) => {
        const meta = DIFFICULTY_META[d];
        const off = hidden.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={!off}
            onClick={() => onToggle(d)}
            className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-medium transition-colors active:bg-black/5 dark:active:bg-white/10"
          >
            <span
              className="grid size-7 place-items-center rounded-full border-2 border-white/70 shadow-sm transition-colors"
              style={{
                background: off ? "transparent" : meta.color,
                borderColor: off ? meta.color : undefined,
              }}
            >
              {off && <span className="h-0.5 w-4 rotate-45 rounded" style={{ background: meta.color }} />}
            </span>
            <span className={off ? "text-zinc-400 line-through" : ""}>{meta.plural}</span>
            <span className="text-[10px] font-normal text-zinc-500 tabular-nums">{counts[d]}</span>
          </button>
        );
      })}
    </div>
  );
}
