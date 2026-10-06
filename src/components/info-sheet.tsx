"use client";

import { DIFFICULTY_META, type Difficulty } from "@/lib/difficulty";
import { liftById, trailById, trailsByLift, type Lift, type Trail } from "@/data/resort";
import type { Selection } from "@/lib/map-dom";

const fmtDistance = (m: number | null) =>
  m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} км` : `${m} м`;

const drop = (x: { top: number | null; bottom: number | null }) =>
  x.top != null && x.bottom != null ? x.top - x.bottom : null;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TrailBadge({ trail, size = "md" }: { trail: Trail; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full font-bold text-white ${
        size === "md" ? "size-10 text-sm" : "size-7 text-xs"
      }`}
      style={{ background: DIFFICULTY_META[trail.difficulty].color }}
    >
      {trail.id}
    </span>
  );
}

function TrailInfo({ trail, onSelect }: { trail: Trail; onSelect: (s: Selection) => void }) {
  const lift = trail.liftId ? liftById.get(trail.liftId) : undefined;
  const d = drop(trail);
  return (
    <>
      <div className="flex items-center gap-3">
        <TrailBadge trail={trail} />
        <div>
          <div className="font-semibold">Траса {trail.id}</div>
          <div className="text-sm text-zinc-500">{DIFFICULTY_META[trail.difficulty].label}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Довжина" value={fmtDistance(trail.distance)} />
        <Stat label="Перепад" value={d == null ? "—" : `${d} м`} />
        <Stat label="Висота" value={trail.top != null ? `${trail.top} → ${trail.bottom} м` : "—"} />
      </div>
      {trail.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {trail.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
      {lift && (
        <button
          type="button"
          onClick={() => onSelect({ type: "lift", id: lift.id })}
          className="mt-3 rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/10"
        >
          Підйомник {lift.id}
          {lift.typeName ? ` · ${lift.typeName}` : ""} →
        </button>
      )}
    </>
  );
}

function LiftInfo({
  lift,
  hidden,
  onSelect,
}: {
  lift: Lift;
  hidden: ReadonlySet<Difficulty>;
  onSelect: (s: Selection) => void;
}) {
  const served = (trailsByLift.get(lift.id) ?? []).filter((t) => !hidden.has(t.difficulty));
  const d = drop(lift);
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="inline-grid size-10 place-items-center rounded-lg bg-zinc-700 text-sm font-bold text-white">
          {lift.id}
        </span>
        <div>
          <div className="font-semibold">Підйомник {lift.id}</div>
          <div className="text-sm text-zinc-500">{lift.typeName ?? lift.type}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Довжина" value={fmtDistance(lift.distance)} />
        <Stat label="Перепад" value={d == null ? "—" : `${d} м`} />
        <Stat label="Пропускна" value={lift.traffic ? `${lift.traffic} люд/год` : "—"} />
      </div>
      {served.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] text-zinc-500">Траси від верхньої станції</div>
          <div className="flex flex-wrap gap-1.5">
            {served.map((t) => (
              <button key={t.id} type="button" onClick={() => onSelect({ type: "trail", id: t.id })}>
                <TrailBadge trail={t} size="sm" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

type Props = {
  selection: Selection;
  hidden: ReadonlySet<Difficulty>;
  onClose: () => void;
  onSelect: (s: Selection) => void;
};

export function InfoSheet({ selection, hidden, onClose, onSelect }: Props) {
  const trail = selection.type === "trail" ? trailById.get(selection.id) : undefined;
  const lift = selection.type === "lift" ? liftById.get(selection.id) : undefined;
  if (!trail && !lift) return null;

  return (
    <div className="relative rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/95 dark:ring-white/10">
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрити"
        className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-xl text-zinc-400 active:bg-black/5 dark:active:bg-white/10"
      >
        ×
      </button>
      {trail ? (
        <TrailInfo trail={trail} onSelect={onSelect} />
      ) : (
        lift && <LiftInfo lift={lift} hidden={hidden} onSelect={onSelect} />
      )}
    </div>
  );
}
