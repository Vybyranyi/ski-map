import { liftById, trailById } from "@/data/resort";
import { drop } from "./format";
import type { Plan } from "./plans-store";

export type PlanStats = {
  total: number;
  done: number;
  /** сума перепадів трас: пройдених і всіх запланованих, м */
  descentDone: number;
  descentPlanned: number;
  /** довжина пройдених трас, м */
  trailMetersDone: number;
  liftRidesDone: number;
};

export function planStats(plan: Plan): PlanStats {
  const s: PlanStats = { total: plan.items.length, done: 0, descentDone: 0, descentPlanned: 0, trailMetersDone: 0, liftRidesDone: 0 };
  for (const item of plan.items) {
    if (item.done) s.done++;
    if (item.type === "trail") {
      const t = trailById.get(item.ref);
      const d = t ? (drop(t) ?? 0) : 0;
      s.descentPlanned += d;
      if (item.done) {
        s.descentDone += d;
        s.trailMetersDone += t?.distance ?? 0;
      }
    } else if (item.done && liftById.has(item.ref)) {
      s.liftRidesDone++;
    }
  }
  return s;
}
