"use client";

import { useRef, useState } from "react";
import { LiftBadge, TrailBadge } from "@/components/badges";
import { liftById, trailById } from "@/data/resort";
import { drop, fmtDistance, fmtMeters } from "@/lib/format";
import { exportPlans, parseImport } from "@/lib/plan-io";
import { planStats } from "@/lib/plan-stats";
import { selectActivePlan, usePlans, type PlanItem, type PlanItemType } from "@/lib/plans-store";
import { useStatus } from "@/lib/status-store";

type Props = {
  onClose: () => void;
  /** показати елемент плану на карті (панель закривається) */
  onLocate: (type: PlanItemType, ref: string) => void;
};

const iconBtn =
  "grid size-9 shrink-0 place-items-center rounded-full text-zinc-500 active:bg-black/5 disabled:opacity-30 dark:active:bg-white/10";
const textBtn =
  "rounded-lg bg-black/5 px-3 py-2 text-sm font-medium active:bg-black/10 dark:bg-white/10 dark:active:bg-white/15";

function ItemInfo({ item }: { item: PlanItem }) {
  if (item.type === "trail") {
    const t = trailById.get(item.ref);
    if (!t) return <span className="text-sm text-zinc-500">Невідома траса {item.ref}</span>;
    const d = drop(t);
    return (
      <>
        <TrailBadge trail={t} size="sm" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Траса {t.id}</span>
          <span className="block text-xs text-zinc-500">
            {fmtDistance(t.distance)}
            {d != null && ` · ↓ ${d} м`}
          </span>
        </span>
      </>
    );
  }
  const l = liftById.get(item.ref);
  if (!l) return <span className="text-sm text-zinc-500">Невідомий підйомник {item.ref}</span>;
  const d = drop(l);
  return (
    <>
      <LiftBadge id={l.id} size="sm" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">Підйомник {l.id}</span>
        <span className="block text-xs text-zinc-500">
          {l.typeName ?? l.type}
          {d != null && ` · ↑ ${d} м`}
        </span>
      </span>
    </>
  );
}

function Row({
  planId,
  item,
  index,
  count,
  edit,
  onLocate,
}: {
  planId: string;
  item: PlanItem;
  index: number;
  count: number;
  edit: boolean;
  onLocate: Props["onLocate"];
}) {
  const store = usePlans.getState();
  const state = useStatus((s) => (item.type === "trail" ? s.data?.trails[item.ref] : s.data?.lifts[item.ref])?.state);
  return (
    <li className="flex items-center gap-1 border-b border-black/5 last:border-0 dark:border-white/10">
      <button
        type="button"
        onClick={() => store.toggleDone(planId, item.id)}
        aria-pressed={item.done}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
      >
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm leading-none ${
            item.done ? "border-green-600 bg-green-600 text-white" : "border-zinc-300 dark:border-zinc-600"
          }`}
        >
          {item.done && "✓"}
        </span>
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-400">{index + 1}</span>
        <span className={`flex min-w-0 items-center gap-2.5 ${item.done ? "opacity-45" : ""}`}>
          <ItemInfo item={item} />
        </span>
        {state === "closed" && !item.done && (
          <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
            закрито
          </span>
        )}
      </button>

      {edit ? (
        <>
          <button type="button" className={iconBtn} aria-label="Вгору" disabled={index === 0} onClick={() => store.moveItem(planId, item.id, -1)}>
            ▲
          </button>
          <button type="button" className={iconBtn} aria-label="Вниз" disabled={index === count - 1} onClick={() => store.moveItem(planId, item.id, 1)}>
            ▼
          </button>
          <button type="button" className={`${iconBtn} text-red-500`} aria-label="Прибрати з плану" onClick={() => store.removeItem(planId, item.id)}>
            ✕
          </button>
        </>
      ) : (
        <button type="button" className={iconBtn} aria-label="Показати на карті" onClick={() => onLocate(item.type, item.ref)}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      )}
    </li>
  );
}

export function PlanPanel({ onClose, onLocate }: Props) {
  const plans = usePlans((s) => s.plans);
  const plan = usePlans(selectActivePlan);
  const [edit, setEdit] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const store = usePlans.getState();
  const stats = plan ? planStats(plan) : null;
  const status = useStatus((s) => s.data);
  const closedLeft = plan
    ? plan.items.filter(
        (i) => !i.done && (i.type === "trail" ? status?.trails[i.ref] : status?.lifts[i.ref])?.state === "closed",
      ).length
    : 0;

  const runImport = (text: string) => {
    const result = parseImport(text);
    if (!result.ok) return setNote(`Не вдалось імпортувати: ${result.error}`);
    store.importPlans(result.plans);
    const dropped = result.droppedItems ? `, пропущено елементів: ${result.droppedItems}` : "";
    setNote(`Імпортовано планів: ${result.plans.length}${dropped}`);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportPlans(plans)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ski-plans-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote("Файл збережено");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportPlans(plans));
      setNote("Скопійовано в буфер");
    } catch {
      setNote("Не вдалось скопіювати: немає доступу до буфера");
    }
  };

  const paste = async () => {
    try {
      runImport(await navigator.clipboard.readText());
    } catch {
      setNote("Не вдалось вставити: немає доступу до буфера");
    }
  };

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-label="План катання">
      <button type="button" aria-label="Закрити план" className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-lg font-semibold">План катання</h2>
          <button type="button" onClick={onClose} aria-label="Закрити" className={`${iconBtn} text-xl`}>
            ×
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => store.setActive(p.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                p.id === plan?.id ? "bg-blue-600 text-white" : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => store.createPlan()}
            className="shrink-0 rounded-full border border-dashed border-zinc-400 px-3.5 py-1.5 text-sm text-zinc-500"
          >
            + День
          </button>
        </div>

        {plan && stats ? (
          <>
            <div className="px-4 pb-2">
              {edit && (
                <input
                  key={plan.id}
                  defaultValue={plan.name}
                  onBlur={(e) => store.renamePlan(plan.id, e.target.value)}
                  aria-label="Назва плану"
                  className="mb-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-600"
                />
              )}
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  Пройдено {stats.done} з {stats.total}
                </span>
                <span className="text-xs text-zinc-500">
                  ↓ {fmtMeters(stats.descentDone)} / {fmtMeters(stats.descentPlanned)}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                <div
                  className="h-full rounded-full bg-green-600 transition-[width]"
                  style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Траси: {fmtDistance(stats.trailMetersDone)} · підйомників: {stats.liftRidesDone}
              </div>
              {closedLeft > 0 && (
                <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  Зараз закрито серед непройдених: {closedLeft}
                </div>
              )}
            </div>

            <ul className="min-h-24 flex-1 overflow-y-auto px-4">
              {plan.items.length === 0 && (
                <li className="py-8 text-center text-sm text-zinc-500">
                  План порожній. Тапніть трасу чи підйомник на карті й натисніть «Додати в план».
                </li>
              )}
              {plan.items.map((item, i) => (
                <Row key={item.id} planId={plan.id} item={item} index={i} count={plan.items.length} edit={edit} onLocate={onLocate} />
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 px-4 pt-3">
              <button type="button" className={textBtn} onClick={() => setEdit((v) => !v)}>
                {edit ? "Готово" : "Змінити"}
              </button>
              {edit && (
                <>
                  <button
                    type="button"
                    className={textBtn}
                    onClick={() => confirm("Зняти позначки «пройдено» у цьому плані?") && store.resetProgress(plan.id)}
                  >
                    Скинути прогрес
                  </button>
                  <button
                    type="button"
                    className={`${textBtn} text-red-600`}
                    onClick={() => confirm(`Видалити план «${plan.name}»?`) && store.deletePlan(plan.id)}
                  >
                    Видалити план
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">
            Планів ще немає. Створіть день або тапніть трасу на карті й додайте її в план.
          </p>
        )}

        <details className="mt-3 border-t border-black/5 px-4 pt-3 dark:border-white/10">
          <summary className="cursor-pointer text-sm text-zinc-500">Резервна копія (усі плани)</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={textBtn} onClick={download} disabled={!plans.length}>
              Експорт у файл
            </button>
            <button type="button" className={textBtn} onClick={copy} disabled={!plans.length}>
              Копіювати
            </button>
            <button type="button" className={textBtn} onClick={() => fileInput.current?.click()}>
              Імпорт з файлу
            </button>
            <button type="button" className={textBtn} onClick={paste}>
              Вставити
            </button>
          </div>
          {note && (
            <p role="status" className="mt-2 text-xs text-zinc-500">
              {note}
            </p>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // щоб той самий файл можна було вибрати знову
              if (file) runImport(await file.text());
            }}
          />
        </details>
      </div>
    </div>
  );
}
