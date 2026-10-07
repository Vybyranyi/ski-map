import type { Difficulty } from "@/lib/difficulty";
import resortJson from "./generated/resort.json";

export type Trail = {
  id: string;
  difficulty: Difficulty;
  grade: string | null;
  /** Підйомник, що піднімає до початку траси (за даними Буковеля) */
  liftId: string | null;
  bottom: number | null;
  top: number | null;
  distance: number | null;
  notes: string[];
  /** Траса працює у вечірньому катанні (за приміткою Буковеля) */
  evening: boolean;
  freeride: boolean;
  svg: string[];
};

export type Lift = {
  id: string;
  type: string;
  typeName: string | null;
  traffic: number | null;
  bottom: number | null;
  top: number | null;
  distance: number | null;
  svg: string | null;
};

type Resort = { viewBox: string; trails: Trail[]; lifts: Lift[] };

const resort = resortJson as unknown as Resort;

export const trails = resort.trails;
export const lifts = resort.lifts;

export const trailById = new Map(trails.map((t) => [t.id, t]));
export const liftById = new Map(lifts.map((l) => [l.id, l]));

export const trailsByLift = new Map<string, Trail[]>();
for (const t of trails) {
  if (!t.liftId) continue;
  const list = trailsByLift.get(t.liftId) ?? [];
  list.push(t);
  trailsByLift.set(t.liftId, list);
}

/** Підйомники, що ведуть на вечірні траси (режим «Вечірнє») */
export const eveningLiftIds = new Set(
  trails.filter((t) => t.evening && t.liftId).map((t) => t.liftId as string),
);

const [, , w, h] = resort.viewBox.split(" ").map(Number);
export const MAP_WIDTH = w;
export const MAP_HEIGHT = h;

/** Область, де зосереджені траси й підйомники (у координатах карти) */
export const RESORT_AREA = { cx: 1640, cy: 815, width: 2000, height: 1450 };
