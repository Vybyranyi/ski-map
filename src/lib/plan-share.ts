import { liftById, trailById } from "@/data/resort";
import type { Plan, PlanItem } from "./plans-store";

// Формат посилання: <origin>/#p=v1~<назва>~t5K,l13,t7B
//   назва — encodeURIComponent (з екрануванням "~"), елементи: t<траса> або l<підйомник>.
// Позначки «пройдено» не передаємо: отримувач починає з чистого списку.

const VERSION = "v1";
const MAX_ITEMS = 200;
const MAX_NAME = 60;

type SharedPlan = Pick<Plan, "name" | "items">;

export type ShareParseResult =
  | { ok: true; plan: SharedPlan; droppedItems: number }
  | { ok: false; error: string };

export function encodeShare(plan: SharedPlan): string {
  const name = encodeURIComponent(plan.name.slice(0, MAX_NAME)).replaceAll("~", "%7E");
  const items = plan.items.map((i) => `${i.type === "trail" ? "t" : "l"}${i.ref}`).join(",");
  return `${VERSION}~${name}~${items}`;
}

export function shareUrl(plan: SharedPlan, origin: string): string {
  return `${origin}/#p=${encodeShare(plan)}`;
}

/** Приймає повне посилання, "#p=…", "p=…" або сам код "v1~…". */
export function parseShare(input: string): ShareParseResult {
  let payload = input.trim();
  const marker = payload.match(/[#&?]p=([^&\s]+)/) ?? payload.match(/^p=([^&\s]+)/);
  if (marker) payload = marker[1];

  const [version, rawName, rawItems, ...rest] = payload.split("~");
  if (version !== VERSION || rawName == null || rawItems == null || rest.length) {
    return { ok: false, error: "Це не схоже на посилання плану" };
  }

  let name: string;
  try {
    name = decodeURIComponent(rawName).trim().slice(0, MAX_NAME);
  } catch {
    return { ok: false, error: "Пошкоджена назва плану" };
  }

  const tokens = rawItems.split(",").filter(Boolean).slice(0, MAX_ITEMS);
  const items: PlanItem[] = [];
  let droppedItems = 0;
  for (const token of tokens) {
    const type = token[0] === "t" ? "trail" : token[0] === "l" ? "lift" : null;
    const ref = token.slice(1);
    const known = type === "trail" ? trailById.has(ref) : type === "lift" ? liftById.has(ref) : false;
    if (type && known) items.push({ id: "", type, ref, done: false });
    else droppedItems++;
  }
  if (!items.length) return { ok: false, error: "У плані немає відомих трас чи підйомників" };
  return { ok: true, plan: { name: name || "План", items }, droppedItems };
}
