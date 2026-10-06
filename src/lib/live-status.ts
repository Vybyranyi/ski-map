export type ItemState = "open" | "closed" | "waiting";

export type ItemStatus = {
  state: ItemState;
  /** Розклад із даних Буковеля (ISO-рядок або текст як є) */
  from: string | null;
  to: string | null;
};

export type LiveStatus = {
  /** Коли дані отримано від Буковеля (мс), а не коли клієнт їх прочитав */
  fetchedAt: number;
  /** ключ — id підйомника ("13", "2R") */
  lifts: Record<string, ItemStatus>;
  /** ключ — id траси ("5K") */
  trails: Record<string, ItemStatus>;
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;
const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

function parseState(raw: unknown): ItemState | null {
  const s = String(raw ?? "").toUpperCase();
  if (s === "OPEN") return "open";
  if (s === "CLOSE" || s === "CLOSED") return "closed";
  if (s.includes("WAIT")) return "waiting";
  return null; // невідомий статус краще не показувати, ніж вгадувати
}

function parseItem(raw: unknown): ItemStatus | null {
  if (!isObj(raw)) return null;
  const state = parseState(raw.status);
  return state ? { state, from: str(raw.startDate), to: str(raw.stopDate) } : null;
}

/** Нормалізує відповідь /api/v2/status-lifts-trails; null, якщо формат не той, що очікуємо. */
export function normalizeStatus(upstream: unknown, now: number): LiveStatus | null {
  const lifts = isObj(upstream) && isObj(upstream.data) ? upstream.data.lifts : null;
  if (!Array.isArray(lifts) || lifts.length === 0) return null;

  const out: LiveStatus = { fetchedAt: now, lifts: {}, trails: {} };
  for (const lift of lifts) {
    if (!isObj(lift)) continue;
    const liftId = str(lift.title);
    const liftStatus = parseItem(lift);
    if (liftId && liftStatus) out.lifts[liftId] = liftStatus;

    if (!Array.isArray(lift.trails)) continue;
    for (const trail of lift.trails) {
      const trailId = isObj(trail) ? str(trail.title) : null;
      const trailStatus = parseItem(trail);
      if (trailId && trailStatus) out.trails[trailId] = trailStatus;
    }
  }
  return Object.keys(out.lifts).length > 0 && Object.keys(out.trails).length > 0 ? out : null;
}

export const statusOf = (status: LiveStatus | null | undefined, type: "trail" | "lift", id: string) =>
  type === "trail" ? status?.trails[id] : status?.lifts[id];
