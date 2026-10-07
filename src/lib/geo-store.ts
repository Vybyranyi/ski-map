import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GeoFix } from "./geo";

export type GeoStatus = "idle" | "searching" | "active" | "denied" | "unavailable";

type GeoState = {
  status: GeoStatus;
  fix: GeoFix | null;
  /** Слабкий сигнал: помилка таймауту, але стеження триває */
  weakSignal: boolean;
  /** Ручна поправка в px карти: «насправді я тут» (виправляє системну похибку калібрування) */
  offset: [number, number] | null;
  start: () => void;
  stop: () => void;
  setOffset: (offset: [number, number] | null) => void;
};

let watchId: number | null = null;

export const useGeo = create<GeoState>()(
  persist(
    (set, get) => ({
      status: "idle",
      fix: null,
      weakSignal: false,
      offset: null,

      start: () => {
        if (get().status === "searching" || get().status === "active") return;
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          set({ status: "unavailable" });
          return;
        }
        set({ status: "searching", weakSignal: false });
        watchId = navigator.geolocation.watchPosition(
          (pos) =>
            set({
              status: "active",
              weakSignal: false,
              fix: {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                alt: pos.coords.altitude,
                accuracy: pos.coords.accuracy,
              },
            }),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              get().stop();
              set({ status: "denied" });
            } else {
              set({ weakSignal: true }); // стеження триває, сигнал може повернутись
            }
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );
      },

      stop: () => {
        if (watchId != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchId);
        watchId = null;
        set({ status: "idle", fix: null, weakSignal: false });
      },

      setOffset: (offset) => set({ offset }),
    }),
    {
      name: "ski-map:geo",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ offset: s.offset }),
      skipHydration: true,
    },
  ),
);
