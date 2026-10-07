"use client";

import { useEffect } from "react";
import { RefreshIcon } from "@/components/icons";
import { StateDot, Switch, floating, iconBtn } from "@/components/ui";
import { lifts, trails } from "@/data/resort";
import { useFilters } from "@/lib/filters-store";
import { useStatus } from "@/lib/status-store";

const count = (items: Record<string, { state: string }> | undefined, ids: string[]) =>
  items ? ids.filter((id) => items[id]?.state === "open").length : 0;

const liftIds = lifts.map((l) => l.id);
const trailIds = trails.map((t) => t.id);

/** Додаткові фільтри й стан курорту: «лише відкриті», «вечірнє», скільки зараз працює. */
export function FilterMenu({ onClose }: { onClose: () => void }) {
  const data = useStatus((s) => s.data);
  const error = useStatus((s) => s.error);
  const loading = useStatus((s) => s.loading);
  const onlyOpen = useFilters((s) => s.onlyOpen);
  const setOnlyOpen = useFilters((s) => s.setOnlyOpen);
  const eveningOnly = useFilters((s) => s.eveningOnly);
  const setEveningOnly = useFilters((s) => s.setEveningOnly);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const time = data
    ? new Date(data.fetchedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div id="filter-menu" className={`animate-sheet rounded-2xl px-4 pb-2 pt-2 ${floating}`}>
      <Switch checked={onlyOpen} onChange={setOnlyOpen} label="Лише відкриті" />
      <Switch checked={eveningOnly} onChange={setEveningOnly} label="Вечірнє катання" />

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-hairline pt-1">
        <p role="status" className="flex min-w-0 items-center gap-2 text-sm text-muted">
          {data ? (
            <>
              <StateDot state={error ? "waiting" : "open"} />
              <span className="min-w-0 tabular-nums">
                Підйомники {count(data.lifts, liftIds)}/{lifts.length} · Траси {count(data.trails, trailIds)}/{trails.length}
                {error && <span className="block text-warn">Офлайн, дані від {time}</span>}
              </span>
            </>
          ) : (
            <span>{error ? "Статус недоступний" : "Завантажую статус…"}</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => void useStatus.getState().refresh(true)}
          aria-label="Оновити статус"
          className={`${iconBtn} ${loading ? "animate-spin" : ""}`}
        >
          <RefreshIcon />
        </button>
      </div>
    </div>
  );
}
