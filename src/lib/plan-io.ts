import { liftById, trailById } from "@/data/resort";
import { parseShare } from "./plan-share";
import type { Plan, PlanItem } from "./plans-store";

const FORMAT = "ski-map-plans";

export function exportPlans(plans: Plan[]): string {
  return JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      plans: plans.map((p) => ({
        name: p.name,
        items: p.items.map(({ type, ref, done, doneAt }) => ({ type, ref, done, ...(done && doneAt ? { doneAt } : {}) })),
      })),
    },
    null,
    2,
  );
}

export type ImportResult =
  | { ok: true; plans: Pick<Plan, "name" | "items">[]; droppedItems: number }
  | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Розбирає JSON з експорту. Невідомі траси/підйомники відкидаємо (карту могли оновити). */
export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Це не схоже на JSON" };
  }
  const rawPlans = Array.isArray(data) ? data : isObj(data) ? data.plans : null;
  if (!Array.isArray(rawPlans)) return { ok: false, error: "Не знайшов список планів" };

  let droppedItems = 0;
  const plans: Pick<Plan, "name" | "items">[] = [];

  for (const [index, rp] of rawPlans.entries()) {
    if (!isObj(rp) || !Array.isArray(rp.items)) continue;
    const items: PlanItem[] = [];
    for (const ri of rp.items) {
      const valid =
        isObj(ri) &&
        ((ri.type === "trail" && typeof ri.ref === "string" && trailById.has(ri.ref)) ||
          (ri.type === "lift" && typeof ri.ref === "string" && liftById.has(ri.ref)));
      if (!valid) {
        droppedItems++;
        continue;
      }
      const done = ri.done === true;
      const doneAt = done && typeof ri.doneAt === "number" && Number.isFinite(ri.doneAt) ? ri.doneAt : undefined;
      items.push({ id: "", type: ri.type as PlanItem["type"], ref: ri.ref as string, done, doneAt });
    }
    const name = typeof rp.name === "string" && rp.name.trim() ? rp.name.trim() : `Імпорт ${index + 1}`;
    plans.push({ name, items });
  }

  if (!plans.length) return { ok: false, error: "У файлі немає жодного плану" };
  return { ok: true, plans, droppedItems };
}

/** Імпорт із файлу/буфера: JSON з експорту або посилання/код плану, яким поділились. */
export function parseAnyImport(text: string): ImportResult {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) return parseImport(t);
  const shared = parseShare(t);
  if (shared.ok) return { ok: true, plans: [shared.plan], droppedItems: shared.droppedItems };
  return { ok: false, error: "Не схоже ні на файл копії, ні на посилання плану" };
}
