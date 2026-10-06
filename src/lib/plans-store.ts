import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "./uid";

export type PlanItemType = "trail" | "lift";

export type PlanItem = {
  id: string;
  type: PlanItemType;
  /** id траси ("5K") або підйомника ("13") */
  ref: string;
  done: boolean;
};

export type Plan = {
  id: string;
  name: string;
  createdAt: number;
  items: PlanItem[];
};

type PlansState = {
  plans: Plan[];
  activeId: string | null;
  createPlan: (name?: string) => string;
  renamePlan: (id: string, name: string) => void;
  deletePlan: (id: string) => void;
  setActive: (id: string) => void;
  /** Додає в активний план (створює «День N», якщо планів ще нема) */
  addItem: (type: PlanItemType, ref: string) => void;
  removeItem: (planId: string, itemId: string) => void;
  toggleDone: (planId: string, itemId: string) => void;
  moveItem: (planId: string, itemId: string, dir: -1 | 1) => void;
  resetProgress: (planId: string) => void;
  /** Додає плани як нові (з новими id) і робить активним перший доданий */
  importPlans: (plans: Pick<Plan, "name" | "items">[]) => void;
};

const newPlan = (name: string): Plan => ({ id: uid(), name, createdAt: Date.now(), items: [] });
const mapPlan = (plans: Plan[], id: string, fn: (p: Plan) => Plan) =>
  plans.map((p) => (p.id === id ? fn(p) : p));

export const usePlans = create<PlansState>()(
  persist(
    (set, get) => ({
      plans: [],
      activeId: null,

      createPlan: (name) => {
        const plan = newPlan(name?.trim() || `День ${get().plans.length + 1}`);
        set((s) => ({ plans: [...s.plans, plan], activeId: plan.id }));
        return plan.id;
      },

      renamePlan: (id, name) =>
        set((s) => ({ plans: mapPlan(s.plans, id, (p) => ({ ...p, name: name.trim() || p.name })) })),

      deletePlan: (id) =>
        set((s) => {
          const plans = s.plans.filter((p) => p.id !== id);
          const activeId = s.activeId === id ? (plans[0]?.id ?? null) : s.activeId;
          return { plans, activeId };
        }),

      setActive: (id) => set({ activeId: id }),

      addItem: (type, ref) => {
        let planId = get().activeId;
        if (!planId || !get().plans.some((p) => p.id === planId)) planId = get().createPlan();
        const item: PlanItem = { id: uid(), type, ref, done: false };
        set((s) => ({ plans: mapPlan(s.plans, planId, (p) => ({ ...p, items: [...p.items, item] })) }));
      },

      removeItem: (planId, itemId) =>
        set((s) => ({
          plans: mapPlan(s.plans, planId, (p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) })),
        })),

      toggleDone: (planId, itemId) =>
        set((s) => ({
          plans: mapPlan(s.plans, planId, (p) => ({
            ...p,
            items: p.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
          })),
        })),

      moveItem: (planId, itemId, dir) =>
        set((s) => ({
          plans: mapPlan(s.plans, planId, (p) => {
            const from = p.items.findIndex((i) => i.id === itemId);
            const to = from + dir;
            if (from < 0 || to < 0 || to >= p.items.length) return p;
            const items = [...p.items];
            [items[from], items[to]] = [items[to], items[from]];
            return { ...p, items };
          }),
        })),

      resetProgress: (planId) =>
        set((s) => ({
          plans: mapPlan(s.plans, planId, (p) => ({ ...p, items: p.items.map((i) => ({ ...i, done: false })) })),
        })),

      importPlans: (incoming) => {
        if (!incoming.length) return;
        const added: Plan[] = incoming.map((p) => ({
          id: uid(),
          name: p.name,
          createdAt: Date.now(),
          items: p.items.map((i) => ({ ...i, id: uid() })),
        }));
        set((s) => ({ plans: [...s.plans, ...added], activeId: added[0].id }));
      },
    }),
    {
      name: "ski-map:plans",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ plans: s.plans, activeId: s.activeId }),
      skipHydration: true,
    },
  ),
);

/** Активний план (або перший, якщо activeId застарів) */
export const selectActivePlan = (s: Pick<PlansState, "plans" | "activeId">): Plan | null =>
  s.plans.find((p) => p.id === s.activeId) ?? s.plans[0] ?? null;
