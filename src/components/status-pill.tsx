"use client";

import { lifts, trails } from "@/data/resort";
import { useFilters } from "@/lib/filters-store";
import { useStatus } from "@/lib/status-store";

const glass =
  "rounded-full bg-white/95 text-xs font-medium text-zinc-700 shadow-lg ring-1 ring-black/5 active:bg-zinc-100 dark:bg-zinc-900/95 dark:text-zinc-200 dark:ring-white/10";

const count = (items: Record<string, { state: string }> | undefined, ids: string[]) =>
  items ? ids.filter((id) => items[id]?.state === "open").length : 0;

export function StatusPill() {
  const data = useStatus((s) => s.data);
  const error = useStatus((s) => s.error);
  const loading = useStatus((s) => s.loading);
  const onlyOpen = useFilters((s) => s.onlyOpen);
  const setOnlyOpen = useFilters((s) => s.setOnlyOpen);

  const time = data
    ? new Date(data.fetchedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void useStatus.getState().refresh(true)}
        aria-label="Оновити статус"
        title={time ? `Дані від ${time}` : undefined}
        className={`${glass} flex h-9 items-center gap-2 whitespace-nowrap px-3`}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${
            loading ? "animate-pulse bg-amber-400" : error ? "bg-red-500" : data ? "bg-green-500" : "bg-zinc-400"
          }`}
        />
        {data ? (
          <span className="tabular-nums">
            Підйомники {count(data.lifts, lifts.map((l) => l.id))}/{lifts.length} · Траси{" "}
            {count(data.trails, trails.map((t) => t.id))}/{trails.length}
            {error && <span className="ml-1.5 text-red-500">· офлайн, дані від {time}</span>}
          </span>
        ) : (
          <span>{error ? "Статус недоступний ↻" : "Статус…"}</span>
        )}
      </button>

      <button
        type="button"
        aria-pressed={onlyOpen}
        onClick={() => setOnlyOpen(!onlyOpen)}
        className={`flex h-9 items-center whitespace-nowrap rounded-full px-3 text-xs font-medium shadow-lg ring-1 ring-black/5 dark:ring-white/10 ${
          onlyOpen ? "bg-green-600 text-white" : "bg-white/95 text-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200"
        }`}
      >
        Лише відкриті
      </button>
    </div>
  );
}
