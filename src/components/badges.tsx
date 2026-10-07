import { DIFFICULTY_META } from "@/lib/difficulty";
import type { Trail } from "@/data/resort";

const SIZES = { sm: "size-7 text-xs", md: "size-10 text-sm" } as const;

// тонке кільце, щоб чорна траса не зникала на темній поверхні
const RING = "ring-1 ring-inset ring-black/10 dark:ring-white/25";

export function TrailBadge({ trail, size = "md" }: { trail: Trail; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${RING} ${SIZES[size]}`}
      style={{ background: DIFFICULTY_META[trail.difficulty].color }}
    >
      {trail.id}
    </span>
  );
}

export function LiftBadge({ id, size = "md" }: { id: string; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-md bg-subtle font-semibold text-ink ring-1 ring-inset ring-hairline ${SIZES[size]}`}
    >
      {id}
    </span>
  );
}
