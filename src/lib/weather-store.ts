import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { forecastUrl, parseForecast, type Weather } from "./weather";

const MIN_INTERVAL = 5 * 60_000; // погода змінюється повільно: не частіше, ніж раз на 5 хв (якщо не примусово)

type WeatherState = {
  /** Останній успішний прогноз; лишається, якщо оновлення не вдалось (нема зв'язку в горах) */
  data: Weather | null;
  error: string | null;
  loading: boolean;
  lastAttempt: number;
  refresh: (force?: boolean) => Promise<void>;
};

export const useWeather = create<WeatherState>()(
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
          const res = await fetch(forecastUrl(), { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const weather = parseForecast(await res.json(), Date.now());
          if (!weather) throw new Error("неочікуваний формат");
          set({ data: weather, error: null, loading: false });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "помилка", loading: false });
        }
      },
    }),
    {
      name: "ski-map:weather",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data }),
      skipHydration: true,
    },
  ),
);
