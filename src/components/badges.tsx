import { DIFFICULTY_META } from "@/lib/difficulty";
import type { Trail } from "@/data/resort";

const SIZES = { sm: "size-7 text-xs", md: "size-10 text-sm" } as const;

export function TrailBadge({ trail, size = "md" }: { trail: Trail; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white ${SIZES[size]}`}
      style={{ background: DIFFICULTY_META[trail.difficulty].color }}
    >
      {trail.id}
    </span>
  );
}

export function LiftBadge({ id, size = "md" }: { id: string; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-lg bg-zinc-600 font-bold text-white ${SIZES[size]}`}
    >
      {id}
    </span>
  );
}
