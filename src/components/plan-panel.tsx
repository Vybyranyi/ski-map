"use client";

import { useRef, useState } from "react";
import { LiftBadge, TrailBadge } from "@/components/badges";
import { AlertIcon, ArrowDownIcon, ArrowUpIcon, ChartIcon, CheckIcon, CloseIcon, LocateIcon, PlusIcon, ShareIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { ShareDialog } from "@/components/share-dialog";
import { StatsPanel } from "@/components/stats-panel";
import { ConfirmButton, btnGhost, btnPrimary, btnSecondary, iconBtn } from "@/components/ui";
import { liftById, trailById } from "@/data/resort";
import { drop, fmtDistance, fmtMeters } from "@/lib/format";
import { exportPlans, parseAnyImport } from "@/lib/plan-io";
import { planStats } from "@/lib/plan-stats";
import { selectActivePlan, usePlans, type PlanItem, type PlanItemType } from "@/lib/plans-store";
import { useStatus } from "@/lib/status-store";

type Props = {
  onClose: () => void;
  /** показати елемент плану на карті (панель закривається) */
  onLocate: (type: PlanItemType, ref: string) => void;
};

function ItemInfo({ item, closed }: { item: PlanItem; closed: boolean }) {
  if (item.type === "trail") {
    const t = trailById.get(item.ref);
    if (!t) return <span className="text-sm text-muted">Невідома траса {item.ref}</span>;
    const d = drop(t);
    return (
      <>
        <TrailBadge trail={t} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">Траса {t.id}</span>
          <span className="block truncate text-xs text-muted tabular-nums">
            {fmtDistance(t.distance)}
            {d != null && ` · ↓ ${d} м`}
            {closed && <span className="font-medium text-bad"> · закрито</span>}
          </span>
        </span>
      </>
    );
  }
  const l = liftById.get(item.ref);
  if (!l) return <span className="text-sm text-muted">Невідомий підйомник {item.ref}</span>;
  const d = drop(l);
  return (
    <>
      <LiftBadge id={l.id} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">Підйомник {l.id}</span>
        <span className="block truncate text-xs text-muted tabular-nums">
          {l.typeName ?? l.type}
          {d != null && ` · ↑ ${d} м`}
          {closed && <span className="font-medium text-bad"> · закрито</span>}
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
    <li className="flex items-center border-b border-hairline last:border-0">
      <button
        type="button"
        onClick={() => store.toggleDone(planId, item.id)}
        aria-pressed={item.done}
        aria-label={item.done ? "Зняти позначку «пройдено»" : "Позначити пройденим"}
        className="grid size-11 shrink-0 place-items-center"
      >
        <span
          className={`grid size-6 place-items-center rounded-full border-2 transition-colors ${
            item.done ? "border-ink bg-ink text-surface" : "border-muted/60"
          }`}
        >
          {item.done && <CheckIcon className="size-3.5" />}
        </span>
      </button>

      <div className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 ${item.done ? "opacity-50" : ""}`}>
        <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
        <ItemInfo item={item} closed={state === "closed" && !item.done && !edit} />
      </div>

      {edit ? (
        <>
          <button type="button" className={iconBtn} aria-label="Вгору" disabled={index === 0} onClick={() => store.moveItem(planId, item.id, -1)}>
            <ArrowUpIcon />
          </button>
          <button type="button" className={iconBtn} aria-label="Вниз" disabled={index === count - 1} onClick={() => store.moveItem(planId, item.id, 1)}>
            <ArrowDownIcon />
          </button>
          <button type="button" className={`${iconBtn} text-bad`} aria-label="Прибрати з плану" onClick={() => store.removeItem(planId, item.id)}>
            <CloseIcon />
          </button>
        </>
      ) : (
        <button type="button" className={iconBtn} aria-label="Показати на карті" onClick={() => onLocate(item.type, item.ref)}>
          <LocateIcon />
        </button>
      )}
    </li>
  );
}

export function PlanPanel({ onClose, onLocate }: Props) {
  const plans = usePlans((s) => s.plans);
  const plan = usePlans(selectActivePlan);
  const [edit, setEdit] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
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
    const result = parseAnyImport(text);
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
    <>
      <Sheet
        title="План катання"
        onClose={onClose}
        actions={
          <button type="button" onClick={() => setStatsOpen(true)} aria-label="Статистика поїздки" className={iconBtn}>
            <ChartIcon />
          </button>
        }
        subheader={
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === plan?.id}
                onClick={() => store.setActive(p.id)}
                className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors ${
                  p.id === plan?.id ? "bg-ink text-surface" : "bg-subtle text-ink active:bg-hairline"
                }`}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => store.createPlan()}
              aria-label="Додати день"
              className="grid h-9 shrink-0 place-items-center rounded-full border border-dashed border-muted/60 px-3 text-muted active:bg-subtle"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        }
        footer={
          plan && (
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={edit ? `${btnPrimary} flex-1` : btnSecondary} onClick={() => setEdit((v) => !v)}>
                {edit ? "Готово" : "Змінити"}
              </button>
              {!edit && (
                <button type="button" className={btnGhost} disabled={!plan.items.length} onClick={() => setSharing(true)}>
                  <ShareIcon className="size-4" />
                  Поділитися
                </button>
              )}
            </div>
          )
        }
      >
        {plan && stats ? (
          <>
            {edit && (
              <input
                key={plan.id}
                defaultValue={plan.name}
                onBlur={(e) => store.renamePlan(plan.id, e.target.value)}
                aria-label="Назва плану"
                className="mb-3 h-11 w-full rounded-xl border border-hairline bg-transparent px-3 text-base"
              />
            )}

            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium tabular-nums">
                Пройдено {stats.done} з {stats.total}
              </span>
              <span className="text-muted tabular-nums">
                ↓ {fmtMeters(stats.descentDone)} / {fmtMeters(stats.descentPlanned)}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.done} aria-label="Прогрес плану">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-300"
                style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }}
              />
            </div>
            {closedLeft > 0 && (
              <p className="mt-3 flex items-center gap-2 text-sm text-bad">
                <AlertIcon className="size-4" />
                Зараз закрито серед непройдених: {closedLeft}
              </p>
            )}

            <ul className="mt-2 -ml-2.5">
              {plan.items.length === 0 && (
                <li className="py-8 pl-2.5 text-center text-sm text-muted">
                  План порожній. Тапніть трасу чи підйомник на карті й додайте в план.
                </li>
              )}
              {plan.items.map((item, i) => (
                <Row key={item.id} planId={plan.id} item={item} index={i} count={plan.items.length} edit={edit} onLocate={onLocate} />
              ))}
            </ul>

            {edit && (
              <div className="mt-2 flex flex-wrap gap-1">
                <ConfirmButton label="Скинути прогрес" confirmLabel="Скинути?" onConfirm={() => store.resetProgress(plan.id)} className={btnGhost} />
                <ConfirmButton label="Видалити план" confirmLabel="Видалити?" onConfirm={() => store.deletePlan(plan.id)} />
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            Планів ще немає. Створіть день кнопкою «+» або додайте трасу з карти.
          </p>
        )}

        <details className="mt-4 border-t border-hairline pt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">Резервна копія (усі плани)</summary>
          <div className="flex flex-wrap gap-2 pb-1 pt-1">
            <button type="button" className={btnSecondary} onClick={download} disabled={!plans.length}>
              Експорт у файл
            </button>
            <button type="button" className={btnSecondary} onClick={copy} disabled={!plans.length}>
              Копіювати
            </button>
            <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
              Імпорт з файлу
            </button>
            <button type="button" className={btnSecondary} onClick={paste}>
              Вставити
            </button>
          </div>
          {note && (
            <p role="status" className="pt-2 text-sm text-muted">
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
      </Sheet>
      {sharing && plan && <ShareDialog plan={plan} onClose={() => setSharing(false)} />}
      {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}
    </>
  );
}
