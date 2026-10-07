"use client";

import { useMemo } from "react";
import { LiftBadge, TrailBadge } from "@/components/badges";
import { liftById, trailById } from "@/data/resort";
import { DIFFICULTIES, DIFFICULTY_META } from "@/lib/difficulty";
import { fmtDistance, fmtMeters } from "@/lib/format";
import { usePlans } from "@/lib/plans-store";
import { tripStats, type DayStats } from "@/lib/trip-stats";

const iconBtn = "grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 active:bg-black/5 dark:active:bg-white/10";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

function span(day: DayStats): string | null {
  if (day.firstAt == null || day.lastAt == null) return null;
  const minutes = Math.round((day.lastAt - day.firstAt) / 60_000);
  const h = Math.floor(minutes / 60);
  const length = h > 0 ? `${h} год ${minutes % 60} хв` : `${minutes} хв`;
  return `${clock(day.firstAt)}–${clock(day.lastAt)} (${length})`;
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/10">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
    </div>
  );
}

export function StatsPanel({ onClose }: { onClose: () => void }) {
  const plans = usePlans((s) => s.plans);
  const stats = useMemo(() => tripStats(plans), [plans]);
  const { totals, days } = stats;
  const empty = days.length === 0;

  const maxDayDescent = Math.max(0, ...days.map((d) => d.descent));
  const maxRuns = Math.max(0, ...DIFFICULTIES.map((d) => stats.byDifficulty[d].runs));

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Статистика поїздки">
      <button type="button" aria-label="Закрити статистику" className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-3xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-lg font-semibold">Статистика поїздки</h2>
          <button type="button" onClick={onClose} aria-label="Закрити" className={`${iconBtn} text-xl`}>
            ×
          </button>
        </div>

        {empty ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            Позначайте пройдені траси й підйомники в плані (тап по рядку) — тут з&apos;явиться статистика за всі дні.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 px-4">
              <Card label="Спуск (вертикаль)" value={fmtMeters(totals.descent)} hint="сума перепадів пройдених трас" />
              <Card label="Підйом підйомниками" value={fmtMeters(totals.ascent)} />
              <Card label="Пройдено трас" value={fmtDistance(totals.trailMeters)} hint={`спусків: ${totals.runs}`} />
              <Card label="Їздок на підйомниках" value={String(totals.liftRides)} hint={`днів: ${days.length}`} />
            </div>

            <h3 className="px-4 pt-5 text-sm font-semibold">За днями</h3>
            <ul className="space-y-3 px-4 pt-2">
              {days.map((d) => (
                <li key={d.planId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{d.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">↓ {fmtMeters(d.descent)}</span>
                  </div>
                  <Bar value={d.descent} max={maxDayDescent} color="var(--diff-blue)" />
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    спусків {d.runs} · підйомників {d.liftRides} · {fmtDistance(d.trailMeters)}
                    {span(d) && ` · ${span(d)}`}
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="px-4 pt-5 text-sm font-semibold">За складністю</h3>
            <ul className="space-y-2.5 px-4 pt-2">
              {DIFFICULTIES.map((d) => {
                const b = stats.byDifficulty[d];
                return (
                  <li key={d}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{DIFFICULTY_META[d].plural}</span>
                      <span className="text-xs tabular-nums text-zinc-500">
                        {b.runs} · {fmtDistance(b.meters)} · ↓ {fmtMeters(b.descent)}
                      </span>
                    </div>
                    <Bar value={b.runs} max={maxRuns} color={d === "black" ? "#64748b" : DIFFICULTY_META[d].color} />
                  </li>
                );
              })}
            </ul>

            {stats.topTrails.length > 0 && (
              <>
                <h3 className="px-4 pt-5 text-sm font-semibold">Найчастіші траси</h3>
                <div className="flex flex-wrap gap-2 px-4 pt-2">
                  {stats.topTrails.map(({ id, count }) => {
                    const t = trailById.get(id);
                    return (
                      <span key={id} className="flex items-center gap-1.5">
                        {t && <TrailBadge trail={t} size="sm" />}
                        <span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">×{count}</span>
                      </span>
                    );
                  })}
                </div>
              </>
            )}

            {stats.topLifts.length > 0 && (
              <>
                <h3 className="px-4 pt-4 text-sm font-semibold">Найчастіші підйомники</h3>
                <div className="flex flex-wrap gap-2 px-4 pt-2">
                  {stats.topLifts.map(({ id, count }) => (
                    <span key={id} className="flex items-center gap-1.5">
                      <LiftBadge id={id} size="sm" />
                      <span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-300">×{count}</span>
                    </span>
                  ))}
                </div>
              </>
            )}

            <h3 className="px-4 pt-5 text-sm font-semibold">Рекорди</h3>
            <dl className="space-y-1 px-4 pt-2 text-sm">
              {stats.bestDay && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Найбільша вертикаль за день</dt>
                  <dd className="text-right tabular-nums">
                    {stats.bestDay.name}: {fmtMeters(stats.bestDay.descent)}
                  </dd>
                </div>
              )}
              {stats.longestTrail && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Найдовша траса</dt>
                  <dd className="tabular-nums">
                    {stats.longestTrail.id}, {fmtDistance(stats.longestTrail.meters)}
                  </dd>
                </div>
              )}
              {stats.highest && (
                <div className="flex justify-between gap-2">
                  <dt className="text-zinc-500">Найвища точка</dt>
                  <dd className="tabular-nums">
                    {stats.highest.elevation} м ({stats.highest.type === "lift" ? `підйомник ${liftById.get(stats.highest.id)?.id}` : `траса ${stats.highest.id}`})
                  </dd>
                </div>
              )}
            </dl>
            <p className="px-4 pt-4 text-[11px] text-zinc-400">
              Рахуються лише позначені «пройдено». Вертикаль і довжини — за даними Буковеля, а не за GPS-треком, тож це оцінка, а не точний облік.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
