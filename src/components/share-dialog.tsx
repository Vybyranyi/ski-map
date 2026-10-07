"use client";

import { useMemo, useState } from "react";
import { renderSVG } from "uqr";
import { shareUrl } from "@/lib/plan-share";
import type { Plan } from "@/lib/plans-store";

const btn =
  "rounded-lg bg-black/5 px-3 py-2 text-sm font-medium active:bg-black/10 dark:bg-white/10 dark:active:bg-white/15";

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
    <div className="fixed inset-0 z-40 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Поділитися планом">
      <button type="button" aria-label="Закрити" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <h3 className="pr-8 text-lg font-semibold">Поділитися планом «{plan.name}»</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Елементів: {plan.items.length}. Отримувач відкриє посилання й підтвердить додавання; позначки «пройдено» не передаються.
        </p>

        <div
          className="mx-auto mt-4 size-56 rounded-xl bg-white p-1 ring-1 ring-black/10 [&>svg]:size-full"
          role="img"
          aria-label="QR-код з посиланням на план"
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Посилання на план"
          className="mt-4 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-600"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {canShare && (
            <button type="button" className={`${btn} !bg-blue-600 !text-white active:!bg-blue-700`} onClick={share}>
              Надіслати…
            </button>
          )}
          <button type="button" className={btn} onClick={copy}>
            Копіювати
          </button>
          <button type="button" className={btn} onClick={onClose}>
            Закрити
          </button>
        </div>
        {note && (
          <p role="status" className="mt-2 text-xs text-zinc-500">
            {note}
          </p>
        )}
        <p className="mt-3 text-[11px] text-zinc-400">
          Якщо у друга застосунок встановлений на екран, посилання відкриється в браузері. Тоді в застосунку: «План» → «Резервна копія» → «Вставити».
        </p>
      </div>
    </div>
  );
}
