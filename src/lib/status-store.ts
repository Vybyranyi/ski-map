import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LiveStatus } from "./live-status";

const MIN_INTERVAL = 20_000; // не частіше, ніж раз на 20 с (якщо не примусово)

type StatusState = {
  /** Останній успішний статус; лишається, якщо оновлення не вдалось (напр., нема зв'язку в горах) */
  data: LiveStatus | null;
  error: string | null;
  loading: boolean;
  lastAttempt: number;
  refresh: (force?: boolean) => Promise<void>;
};

const isStatus = (x: unknown): x is LiveStatus =>
  typeof x === "object" && x !== null && "lifts" in x && "trails" in x && "fetchedAt" in x;

export const useStatus = create<StatusState>()(
  persist(
    (set, get) => ({
      data: null,
      error: null,
      loading: false,
      lastAttempt: 0,

      refresh: async (force = false) => {
        const { loading, lastAttempt } = get();
        if (loading || (!force && Date.now() - lastAttempt < MIN_INTERVAL)) return;
        set({ loading: true, lastAttempt: Date.now() });
        try {
          const res = await fetch("/api/status", { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: unknown = await res.json();
          if (!isStatus(json)) throw new Error("неочікуваний формат");
          set({ data: json, error: null, loading: false });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "помилка", loading: false });
        }
      },
    }),
    {
      name: "ski-map:status",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data }),
      skipHydration: true,
    },
  ),
);
