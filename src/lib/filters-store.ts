import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Difficulty } from "./difficulty";

type FiltersState = {
  /** Складності, які сховано на карті */
  hidden: Difficulty[];
  /** Ховати закриті траси й підйомники (за живим статусом) */
  onlyOpen: boolean;
  setOnlyOpen: (v: boolean) => void;
  /** Показувати лише вечірні траси та підйомники, що ведуть на них */
  eveningOnly: boolean;
  setEveningOnly: (v: boolean) => void;
  toggle: (d: Difficulty) => void;
  /** Знову показує вказані складності */
  show: (ds: Difficulty[]) => void;
};

// skipHydration: стан із localStorage підтягується в ефекті (rehydrate), щоб не ламати SSR.
export const useFilters = create<FiltersState>()(
  persist(
    (set) => ({
      hidden: [],
      onlyOpen: false,
      setOnlyOpen: (onlyOpen) => set({ onlyOpen }),
      eveningOnly: false,
      setEveningOnly: (eveningOnly) => set({ eveningOnly }),
      toggle: (d) =>
        set((s) => ({
          hidden: s.hidden.includes(d)
            ? s.hidden.filter((x) => x !== d)
            : [...s.hidden, d],
        })),
      show: (ds) => set((s) => ({ hidden: s.hidden.filter((x) => !ds.includes(x)) })),
    }),
    {
      name: "ski-map:filters",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ hidden: s.hidden, onlyOpen: s.onlyOpen, eveningOnly: s.eveningOnly }),
      skipHydration: true,
    },
  ),
);
