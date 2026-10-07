"use client";

import { useMemo } from "react";
import { LiftBadge, TrailBadge } from "@/components/badges";
import { Sheet } from "@/components/sheet";
import { liftById, trailById } from "@/data/resort";
import { DIFFICULTIES, DIFFICULTY_META } from "@/lib/difficulty";
import { fmtDistance, fmtMeters } from "@/lib/format";
import { usePlans } from "@/lib/plans-store";
import { tripStats, type DayStats } from "@/lib/trip-stats";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

function span(day: DayStats): string | null {
  if (day.firstAt == null || day.lastAt == null) return null;
  const minutes = Math.round((day.lastAt - day.firstAt) / 60_000);
  const h = Math.floor(minutes / 60);
  const length = h > 0 ? `${h} год ${minutes % 60} хв` : `${minutes} хв`;
  return `${clock(day.firstAt)}–${clock(day.lastAt)} (${length})`;
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-hairline pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
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
    <Sheet title="Статистика поїздки" onClose={onClose} z="z-40">
      {empty ? (
        <p className="py-10 text-center text-sm text-muted">
          Позначайте пройдені траси й підйомники в плані — тут з&apos;явиться статистика за всі дні.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            <Figure label="Спуск" value={fmtMeters(totals.descent)} hint="вертикаль пройдених трас" />
            <Figure label="Підйом" value={fmtMeters(totals.ascent)} hint="підйомниками" />
            <Figure label="Траси" value={fmtDistance(totals.trailMeters)} hint={`спусків: ${totals.runs}`} />
            <Figure label="Підйомники" value={String(totals.liftRides)} hint={`днів: ${days.length}`} />
          </dl>

          <Section title="За днями">
            <ul className="mt-3 space-y-4">
              {days.map((d) => (
                <li key={d.planId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{d.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">↓ {fmtMeters(d.descent)}</span>
                  </div>
                  <Bar value={d.descent} max={maxDayDescent} color="var(--ink)" />
                  <div className="mt-1 text-xs text-muted tabular-nums">
                    спусків {d.runs} · підйомників {d.liftRides} · {fmtDistance(d.trailMeters)}
                    {span(d) && ` · ${span(d)}`}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="За складністю">
            <ul className="mt-3 space-y-3">
              {DIFFICULTIES.map((d) => {
                const b = stats.byDifficulty[d];
                return (
                  <li key={d}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span>{DIFFICULTY_META[d].plural}</span>
                      <span className="text-muted tabular-nums">
                        {b.runs} · {fmtDistance(b.meters)} · ↓ {fmtMeters(b.descent)}
                      </span>
                    </div>
                    <Bar value={b.runs} max={maxRuns} color={d === "black" ? "#64748b" : DIFFICULTY_META[d].color} />
                  </li>
                );
              })}
            </ul>
          </Section>

          {stats.topTrails.length > 0 && (
            <Section title="Найчастіші траси">
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {stats.topTrails.map(({ id, count }) => {
                  const t = trailById.get(id);
                  return (
                    <span key={id} className="flex items-center gap-1.5">
                      {t && <TrailBadge trail={t} size="sm" />}
                      <span className="text-sm tabular-nums text-muted">×{count}</span>
                    </span>
                  );
                })}
              </div>
            </Section>
          )}

          {stats.topLifts.length > 0 && (
            <Section title="Найчастіші підйомники">
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {stats.topLifts.map(({ id, count }) => (
                  <span key={id} className="flex items-center gap-1.5">
                    <LiftBadge id={id} size="sm" />
                    <span className="text-sm tabular-nums text-muted">×{count}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          <Section title="Рекорди">
            <dl className="mt-3 space-y-2 text-sm">
              {stats.bestDay && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Найбільша вертикаль за день</dt>
                  <dd className="text-right tabular-nums">
                    {stats.bestDay.name}: {fmtMeters(stats.bestDay.descent)}
                  </dd>
                </div>
              )}
              {stats.longestTrail && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Найдовша траса</dt>
                  <dd className="tabular-nums">
                    {stats.longestTrail.id}, {fmtDistance(stats.longestTrail.meters)}
                  </dd>
                </div>
              )}
              {stats.highest && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Найвища точка</dt>
                  <dd className="text-right tabular-nums">
                    {stats.highest.elevation} м ({stats.highest.type === "lift" ? `підйомник ${liftById.get(stats.highest.id)?.id}` : `траса ${stats.highest.id}`})
                  </dd>
                </div>
              )}
            </dl>
          </Section>

          <p className="mt-6 text-xs leading-relaxed text-muted">
            Рахуються лише позначені «пройдено». Вертикаль і довжини — за даними Буковеля, а не за GPS-треком, тож це оцінка.
          </p>
        </>
      )}
    </Sheet>
  );
}
