"use client";

import { useEffect, useState } from "react";
import { LiftBadge, TrailBadge } from "@/components/badges";
import { liftById, trailById } from "@/data/resort";
import { parseShare, type ShareParseResult } from "@/lib/plan-share";
import { usePlans } from "@/lib/plans-store";

/** Плани, надіслані посиланням (#p=…): показує, що прийшло, і додає лише після підтвердження. */
export function SharedPlanDialog({ onImported }: { onImported: () => void }) {
  const [incoming, setIncoming] = useState<ShareParseResult | null>(null);

  useEffect(() => {
    const handle = () => {
      const hash = location.hash;
      if (!hash.startsWith("#p=")) return;
      // хеш читаємо до очищення; очищаємо, щоб перезавантаження не пропонувало додати той самий план
      history.replaceState(null, "", location.pathname + location.search);
      setIncoming(parseShare(hash));
    };
    const timer = setTimeout(handle, 0); // не викликаємо setState синхронно в ефекті
    window.addEventListener("hashchange", handle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", handle);
    };
  }, []);

  if (!incoming) return null;
  const close = () => setIncoming(null);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Надісланий план">
      <button type="button" aria-label="Закрити" className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        {incoming.ok ? (
          <>
            <h3 className="text-lg font-semibold">Вам надіслали план</h3>
            <p className="mt-1 font-medium">«{incoming.plan.name}»</p>
            <p className="text-sm text-zinc-500">Елементів: {incoming.plan.items.length}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {incoming.plan.items.slice(0, 24).map((item, i) => {
                const trail = item.type === "trail" ? trailById.get(item.ref) : undefined;
                if (trail) return <TrailBadge key={i} trail={trail} size="sm" />;
                return liftById.has(item.ref) ? <LiftBadge key={i} id={item.ref} size="sm" /> : null;
              })}
              {incoming.plan.items.length > 24 && <span className="self-center text-xs text-zinc-500">+{incoming.plan.items.length - 24}</span>}
            </div>
            {incoming.droppedItems > 0 && (
              <p className="mt-2 text-xs text-amber-600">Пропущено невідомих елементів: {incoming.droppedItems}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white active:bg-blue-700"
                onClick={() => {
                  usePlans.getState().importPlans([incoming.plan]);
                  close();
                  onImported();
                }}
              >
                Додати в мої плани
              </button>
              <button type="button" className="rounded-xl bg-black/5 px-4 py-2.5 text-sm font-medium dark:bg-white/10" onClick={close}>
                Скасувати
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">Не вдалось відкрити план</h3>
            <p className="mt-1 text-sm text-zinc-500">{incoming.error}</p>
            <button type="button" className="mt-4 rounded-xl bg-black/5 px-4 py-2.5 text-sm font-medium dark:bg-white/10" onClick={close}>
              Закрити
            </button>
          </>
        )}
      </div>
    </div>
  );
}
