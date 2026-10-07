"use client";

import { useEffect, useState } from "react";
import { LiftBadge, TrailBadge } from "@/components/badges";
import { Sheet } from "@/components/sheet";
import { btnPrimary, btnSecondary } from "@/components/ui";
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

  if (!incoming.ok) {
    return (
      <Sheet title="Не вдалось відкрити план" onClose={close} z="z-50">
        <p className="text-sm text-muted">{incoming.error}</p>
        <button type="button" className={`${btnSecondary} mt-4 w-full`} onClick={close}>
          Закрити
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Вам надіслали план" onClose={close} z="z-50">
      <p className="font-medium">«{incoming.plan.name}»</p>
      <p className="text-sm text-muted">Елементів: {incoming.plan.items.length}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {incoming.plan.items.slice(0, 24).map((item, i) => {
          const trail = item.type === "trail" ? trailById.get(item.ref) : undefined;
          if (trail) return <TrailBadge key={i} trail={trail} size="sm" />;
          return liftById.has(item.ref) ? <LiftBadge key={i} id={item.ref} size="sm" /> : null;
        })}
        {incoming.plan.items.length > 24 && <span className="self-center text-sm text-muted">+{incoming.plan.items.length - 24}</span>}
      </div>
      {incoming.droppedItems > 0 && (
        <p className="mt-3 text-sm text-warn">Пропущено невідомих елементів: {incoming.droppedItems}</p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          className={`${btnPrimary} flex-1`}
          onClick={() => {
            usePlans.getState().importPlans([incoming.plan]);
            close();
            onImported();
          }}
        >
          Додати в мої плани
        </button>
        <button type="button" className={btnSecondary} onClick={close}>
          Скасувати
        </button>
      </div>
    </Sheet>
  );
}
