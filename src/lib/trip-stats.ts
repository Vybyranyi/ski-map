import { liftById, trailById } from "@/data/resort";
import { DIFFICULTIES, type Difficulty } from "./difficulty";
import { drop } from "./format";
import type { Plan } from "./plans-store";

export type DayStats = {
  planId: string;
  name: string;
  runs: number;
  liftRides: number;
  /** сума перепадів пройдених трас, м */
  descent: number;
  trailMeters: number;
  /** час першої й останньої відмітки (мс); null, якщо відмітки старі й без часу */
  firstAt: number | null;
  lastAt: number | null;
};

export type TripStats = {
  /** лише плани, де є хоч одна відмітка «пройдено» */
  days: DayStats[];
  totals: {
    runs: number;
    liftRides: number;
    /** вертикаль за спусками, м */
    descent: number;
    /** підйом підйомниками, м */
    ascent: number;
    trailMeters: number;
  };
  byDifficulty: Record<Difficulty, { runs: number; meters: number; descent: number }>;
  topTrails: { id: string; count: number }[];
  topLifts: { id: string; count: number }[];
  longestTrail: { id: string; meters: number } | null;
  bestDay: { name: string; descent: number } | null;
  highest: { elevation: number; type: "trail" | "lift"; id: string } | null;
};

const TOP = 5;

const topOf = (counts: Map<string, number>) =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en", { numeric: true }))
    .slice(0, TOP)
    .map(([id, count]) => ({ id, count }));

/** Статистика за всіма планами: рахуємо лише те, що позначено «пройдено». */
export function tripStats(plans: Plan[]): TripStats {
  const totals = { runs: 0, liftRides: 0, descent: 0, ascent: 0, trailMeters: 0 };
  const byDifficulty = Object.fromEntries(
    DIFFICULTIES.map((d) => [d, { runs: 0, meters: 0, descent: 0 }]),
  ) as TripStats["byDifficulty"];
  const trailCounts = new Map<string, number>();
  const liftCounts = new Map<string, number>();
  const days: DayStats[] = [];
  let longestTrail: TripStats["longestTrail"] = null;
  let highest: TripStats["highest"] = null;

  for (const plan of plans) {
    const day: DayStats = {
      planId: plan.id,
      name: plan.name,
      runs: 0,
      liftRides: 0,
      descent: 0,
      trailMeters: 0,
      firstAt: null,
      lastAt: null,
    };

    for (const item of plan.items) {
      if (!item.done) continue;
      if (item.doneAt) {
        day.firstAt = Math.min(day.firstAt ?? item.doneAt, item.doneAt);
        day.lastAt = Math.max(day.lastAt ?? item.doneAt, item.doneAt);
      }

      if (item.type === "trail") {
        const t = trailById.get(item.ref);
        if (!t) continue;
        const d = drop(t) ?? 0;
        const m = t.distance ?? 0;
        day.runs++;
        day.descent += d;
        day.trailMeters += m;
        const b = byDifficulty[t.difficulty];
        b.runs++;
        b.meters += m;
        b.descent += d;
        trailCounts.set(t.id, (trailCounts.get(t.id) ?? 0) + 1);
        if (m > (longestTrail?.meters ?? 0)) longestTrail = { id: t.id, meters: m };
        if (t.top != null && t.top > (highest?.elevation ?? 0)) highest = { elevation: t.top, type: "trail", id: t.id };
      } else {
        const l = liftById.get(item.ref);
        if (!l) continue;
        day.liftRides++;
        totals.ascent += drop(l) ?? 0;
        liftCounts.set(l.id, (liftCounts.get(l.id) ?? 0) + 1);
        if (l.top != null && l.top > (highest?.elevation ?? 0)) highest = { elevation: l.top, type: "lift", id: l.id };
      }
    }

    if (day.runs + day.liftRides === 0) continue;
    days.push(day);
    totals.runs += day.runs;
    totals.liftRides += day.liftRides;
    totals.descent += day.descent;
    totals.trailMeters += day.trailMeters;
  }

  const best = days.reduce<DayStats | null>((a, d) => (!a || d.descent > a.descent ? d : a), null);
  return {
    days,
    totals,
    byDifficulty,
    topTrails: topOf(trailCounts),
    topLifts: topOf(liftCounts).slice(0, 3),
    longestTrail,
    bestDay: best && best.descent > 0 ? { name: best.name, descent: best.descent } : null,
    highest,
  };
}
