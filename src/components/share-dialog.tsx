"use client";

import { useMemo, useState } from "react";
import { Sheet } from "@/components/sheet";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { renderSVG } from "uqr";
import { shareUrl } from "@/lib/plan-share";
import type { Plan } from "@/lib/plans-store";

/** Поділитися планом: системне меню, копіювання посилання, QR-код. План лежить у самому посиланні. */
export function ShareDialog({ plan, onClose }: { plan: Pick<Plan, "name" | "items">; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const url = useMemo(() => shareUrl(plan, location.origin), [plan]);
  const qr = useMemo(() => renderSVG(url, { ecc: "M", border: 2 }), [url]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const share = async () => {
    try {
      await navigator.share({
        title: `План катання «${plan.name}»`,
        text: `План катання «${plan.name}» (${plan.items.length}) у Ski Map · Буковель`,
        url,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("Не вдалось відкрити меню «Поділитися»");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Посилання скопійовано");
    } catch {
      setNote("Не вдалось скопіювати: виділіть посилання вручну");
    }
  };

  return (
    <Sheet title="Поділитися планом" onClose={onClose} z="z-40">
      <p className="text-sm text-muted">
        «{plan.name}» · елементів: {plan.items.length}
      </p>

      {/* QR завжди на білому: так його читають камери і в темній темі */}
      <div
        className="mx-auto mt-4 size-56 rounded-xl bg-white p-1 ring-1 ring-hairline [&>svg]:size-full"
        role="img"
        aria-label="QR-код з посиланням на план"
        dangerouslySetInnerHTML={{ __html: qr }}
      />

      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Посилання на план"
        className="mt-4 h-11 w-full rounded-xl border border-hairline bg-transparent px-3 text-sm"
      />

      <div className="mt-3 flex gap-2">
        {canShare && (
          <button type="button" className={`${btnPrimary} flex-1`} onClick={share}>
            Надіслати
          </button>
        )}
        <button type="button" className={`${canShare ? btnSecondary : btnPrimary} flex-1`} onClick={copy}>
          Копіювати
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-muted">
          {note}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Позначки «пройдено» не передаються. Якщо у друга посилання відкрилось у браузері, а не в застосунку: «План» → «Резервна копія» → «Вставити».
      </p>
    </Sheet>
  );
}
