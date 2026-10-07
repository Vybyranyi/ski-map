"use client";

import { LiftBadge, TrailBadge } from "@/components/badges";
import { ChevronRightIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { StateDot, btnPrimary, floating, iconBtn } from "@/components/ui";
import { DIFFICULTY_META } from "@/lib/difficulty";
import { liftById, trailById, trailsByLift, type Lift, type Trail } from "@/data/resort";
import { drop, fmtDistance, fmtTime } from "@/lib/format";
import type { ItemStatus } from "@/lib/live-status";
import type { Selection } from "@/lib/map-dom";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const STATE_LABEL = { open: "Відкрито", closed: "Закрито", waiting: "Очікує відкриття" } as const;

/** «Відкрито до 16:00» / «Закрито · з 09:00» */
function StatusText({ status }: { status: ItemStatus }) {
  const schedule =
    status.from && status.to
      ? ` ${fmtTime(status.from)}–${fmtTime(status.to)}`
      : status.state === "open" && status.to
        ? ` до ${fmtTime(status.to)}`
        : status.state !== "open" && status.from
          ? ` з ${fmtTime(status.from)}`
          : "";
  return (
    <span className="inline-flex items-center gap-1.5">
      <StateDot state={status.state} />
      <span className="text-ink">
        {STATE_LABEL[status.state]}
        {schedule}
      </span>
    </span>
  );
}

function Heading({ badge, title, subtitle, status }: { badge: React.ReactNode; title: string; subtitle: string; status?: ItemStatus }) {
  return (
    <div className="flex min-w-0 items-center gap-3 pr-10">
      {badge}
      <div className="min-w-0">
        <h2 className="font-semibold leading-tight">{title}</h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span>{subtitle}</span>
          {status && <StatusText status={status} />}
        </p>
      </div>
    </div>
  );
}

function TrailInfo({ trail, status, onSelect }: { trail: Trail; status?: ItemStatus; onSelect: (s: Selection) => void }) {
  const lift = trail.liftId ? liftById.get(trail.liftId) : undefined;
  const d = drop(trail);
  return (
    <>
      <Heading badge={<TrailBadge trail={trail} />} title={`Траса ${trail.id}`} subtitle={DIFFICULTY_META[trail.difficulty].label} status={status} />
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Довжина" value={fmtDistance(trail.distance)} />
        <Stat label="Перепад" value={d == null ? "—" : `${d} м`} />
        <Stat label="Висота" value={trail.top != null ? `${trail.top} → ${trail.bottom} м` : "—"} />
      </dl>
      {trail.notes.length > 0 && <p className="mt-3 text-sm text-muted">{trail.notes.join(" · ")}</p>}
      {lift && (
        <button
          type="button"
          onClick={() => onSelect({ type: "lift", id: lift.id })}
          className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-subtle px-3 text-sm active:bg-hairline"
        >
          <span>
            Підйомник {lift.id}
            {lift.typeName ? <span className="text-muted"> · {lift.typeName}</span> : null}
          </span>
          <ChevronRightIcon className="size-4 text-muted" />
        </button>
      )}
    </>
  );
}

function LiftInfo({
  lift,
  status,
  isTrailHidden,
  onSelect,
}: {
  lift: Lift;
  status?: ItemStatus;
  isTrailHidden: (t: Trail) => boolean;
  onSelect: (s: Selection) => void;
}) {
  const served = (trailsByLift.get(lift.id) ?? []).filter((t) => !isTrailHidden(t));
  const d = drop(lift);
  return (
    <>
      <Heading badge={<LiftBadge id={lift.id} />} title={`Підйомник ${lift.id}`} subtitle={lift.typeName ?? lift.type} status={status} />
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Довжина" value={fmtDistance(lift.distance)} />
        <Stat label="Перепад" value={d == null ? "—" : `${d} м`} />
        <Stat label="Пропускна" value={lift.traffic ? `${lift.traffic} люд/год` : "—"} />
      </dl>
      {served.length > 0 && (
        <div className="mt-3">
          <div className="text-xs text-muted">Траси від верхньої станції</div>
          <div className="-ml-1.5 flex flex-wrap">
            {served.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={`Траса ${t.id}`}
                onClick={() => onSelect({ type: "trail", id: t.id })}
                className="grid size-11 place-items-center rounded-full active:bg-subtle"
              >
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
    <section
      aria-label={trail ? `Траса ${trail.id}` : `Підйомник ${lift?.id}`}
      className={`animate-sheet relative rounded-2xl p-4 ${floating}`}
    >
      <button type="button" onClick={onClose} aria-label="Закрити" className={`${iconBtn} absolute right-1 top-1`}>
        <CloseIcon />
      </button>
      {trail ? (
        <TrailInfo trail={trail} status={status} onSelect={onSelect} />
      ) : (
        lift && <LiftInfo lift={lift} status={status} isTrailHidden={isTrailHidden} onSelect={onSelect} />
      )}
      <button type="button" onClick={onAddToPlan} className={`${btnPrimary} mt-4 w-full`}>
        <PlusIcon className="size-4" />
        Додати в план
        {planCount > 0 && <span className="text-xs font-normal opacity-70">вже ×{planCount}</span>}
      </button>
    </section>
  );
}
