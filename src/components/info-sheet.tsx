"use client";

import { LiftBadge, TrailBadge } from "@/components/badges";
import { DIFFICULTY_META } from "@/lib/difficulty";
import { liftById, trailById, trailsByLift, type Lift, type Trail } from "@/data/resort";
import { drop, fmtDistance, fmtTime } from "@/lib/format";
import type { ItemStatus } from "@/lib/live-status";
import type { Selection } from "@/lib/map-dom";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const STATE_LABEL = { open: "Відкрито", closed: "Закрито", waiting: "Очікує відкриття" } as const;
const STATE_DOT = { open: "bg-green-500", closed: "bg-red-500", waiting: "bg-amber-400" } as const;

function StatusLine({ status }: { status: ItemStatus }) {
  const schedule =
    status.from && status.to
      ? ` · ${fmtTime(status.from)}–${fmtTime(status.to)}`
      : status.state === "open" && status.to
        ? ` · до ${fmtTime(status.to)}`
        : status.state !== "open" && status.from
          ? ` · з ${fmtTime(status.from)}`
          : "";
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className={`size-2.5 rounded-full ${STATE_DOT[status.state]}`} />
      <span className="font-medium">{STATE_LABEL[status.state]}</span>
      <span className="text-zinc-500">{schedule}</span>
    </div>
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
  isTrailHidden,
  onSelect,
}: {
  lift: Lift;
  isTrailHidden: (t: Trail) => boolean;
  onSelect: (s: Selection) => void;
}) {
  const served = (trailsByLift.get(lift.id) ?? []).filter((t) => !isTrailHidden(t));
  const d = drop(lift);
  return (
    <>
      <div className="flex items-center gap-3">
        <LiftBadge id={lift.id} />
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
  /** Чи сховано трасу на карті (фільтри складності / «лише відкриті») */
  isTrailHidden: (t: Trail) => boolean;
  /** скільки разів ця траса/підйомник уже є в активному плані */
  planCount: number;
  /** живий статус вибраного елемента (якщо відомий) */
  status?: ItemStatus;
  onAddToPlan: () => void;
  onClose: () => void;
  onSelect: (s: Selection) => void;
};

export function InfoSheet({ selection, isTrailHidden, planCount, status, onAddToPlan, onClose, onSelect }: Props) {
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
        lift && <LiftInfo lift={lift} isTrailHidden={isTrailHidden} onSelect={onSelect} />
      )}
      {status && <StatusLine status={status} />}
      <button
        type="button"
        onClick={onAddToPlan}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white active:bg-blue-700"
      >
        + Додати в план
        {planCount > 0 && (
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium">вже ×{planCount}</span>
        )}
      </button>
    </div>
  );
}
