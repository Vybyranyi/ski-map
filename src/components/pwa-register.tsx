"use client";

import { useEffect, useState } from "react";

/**
 * Реєструє service worker (лише у продакшні: у dev він заважав би HMR), просить браузер
 * не стирати дані сайту й показує банер, коли готова нова версія.
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // нова версія вже чекає (напр., встановилась у попередньому сеансі)
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      })
      .catch(() => {
        /* без SW застосунок просто працює онлайн */
      });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    // дані планів у localStorage: просимо не видаляти їх при нестачі місця (де це підтримується)
    void navigator.storage?.persist?.();

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink py-1.5 pl-4 pr-1.5 text-sm text-surface shadow-float">
      <span>Доступна нова версія</span>
      <button
        type="button"
        onClick={() => waiting.postMessage("SKIP_WAITING")}
        className="h-11 rounded-full bg-surface px-4 font-medium text-ink active:opacity-80"
      >
        Оновити
      </button>
    </div>
  );
}
