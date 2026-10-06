"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import { FilterBar } from "@/components/filter-bar";
import { InfoSheet } from "@/components/info-sheet";
import { PlanPanel } from "@/components/plan-panel";
import { StatusPill } from "@/components/status-pill";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  RESORT_AREA,
  liftById,
  trailById,
  trailsByLift,
} from "@/data/resort";
import { DIFFICULTIES, type Difficulty } from "@/lib/difficulty";
import { useFilters } from "@/lib/filters-store";
import { statusOf, type LiveStatus } from "@/lib/live-status";
import { addHitAreas, applyStatus, applyVisibility, selectionSelector, type Selection } from "@/lib/map-dom";
import { selectActivePlan, usePlans } from "@/lib/plans-store";
import { useStatus } from "@/lib/status-store";

const MAX_SCALE = 3;
const DEFAULT_MIN_ZOOM = 0.42; // на телефоні відкриваємо ближче, ніж «весь курорт»
const TAP_MAX_MOVE = 10; // px
const TAP_MAX_TIME = 500; // ms
const REVEAL_TOP_INSET = 64; // px: під кнопкою «весь курорт»

type Size = { w: number; h: number };

function computeView(size: Size) {
  const fit = Math.min(size.w / RESORT_AREA.width, size.h / RESORT_AREA.height);
  const initial = Math.min(1, Math.max(fit, DEFAULT_MIN_ZOOM));
  const min = Math.min(fit, size.w / MAP_WIDTH);
  return { fit, initial, min, ...centerOn(size, initial) };
}

function centerOn(size: Size, scale: number) {
  return {
    x: size.w / 2 - RESORT_AREA.cx * scale,
    y: size.h / 2 - RESORT_AREA.cy * scale,
  };
}

function isSelectionVisible(
  sel: Selection,
  hidden: ReadonlySet<Difficulty>,
  onlyOpen: boolean,
  status: LiveStatus | null,
) {
  if (onlyOpen && statusOf(status, sel.type, sel.id)?.state === "closed") return false;
  if (sel.type === "trail") {
    const t = trailById.get(sel.id);
    return !!t && !hidden.has(t.difficulty);
  }
  const served = trailsByLift.get(sel.id) ?? [];
  return liftById.has(sel.id) && !(served.length > 0 && served.every((t) => hidden.has(t.difficulty)));
}

/**
 * Що вибрано під пальцем. Мітки й іконки (те, що намальовано) мають пріоритет над
 * прозорими хітбоксами ліній — інакше канат підйомника перекриває мітки трас.
 */
function pickGroup(stack: Element[]): SVGElement | null {
  const groupOf = (el: Element) => el.closest<SVGElement>("[data-kind]");
  const painted = stack.find((el) => !el.classList.contains("hit") && el.closest(".label, .lift-label"));
  const el = painted ?? stack.find((e) => e.classList.contains("hit"));
  return el ? groupOf(el) : null;
}

/** Зсуває карту, якщо вибране опинилось поза видимою ділянкою (над нижньою панеллю). */
function revealSelection(
  nodes: Iterable<Element>,
  viewport: HTMLElement | null,
  bottomStack: HTMLElement | null,
  transform: ReactZoomPanPinchContentRef | null,
) {
  if (!viewport || !bottomStack || !transform) return;
  const rects = [...nodes].map((n) => n.getBoundingClientRect()).filter((r) => r.width > 0 || r.height > 0);
  if (!rects.length) return;

  const cx = (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
  const cy = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
  const freeTop = REVEAL_TOP_INSET;
  const freeBottom = bottomStack.getBoundingClientRect().top - 8;
  const visible = cx > 0 && cx < viewport.clientWidth && cy > freeTop && cy < freeBottom;
  if (visible) return;

  void transform.panBy(viewport.clientWidth / 2 - cx, (freeTop + freeBottom) / 2 - cy, 250);
}

export function SkiMap({ overlay }: { overlay: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const bottomStackRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const zoomTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [size, setSize] = useState<Size | null>(null);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const hiddenList = useFilters((s) => s.hidden);
  const toggleFilter = useFilters((s) => s.toggle);
  const hidden = useMemo(() => new Set(hiddenList), [hiddenList]);
  const onlyOpen = useFilters((s) => s.onlyOpen);
  const status = useStatus((s) => s.data);

  const plan = usePlans(selectActivePlan);
  // ключ "trail:5K" → усі входження пройдені?
  const planMarks = useMemo(() => {
    const marks = new Map<string, boolean>();
    for (const i of plan?.items ?? []) {
      const key = `${i.type}:${i.ref}`;
      marks.set(key, (marks.get(key) ?? true) && i.done);
    }
    return marks;
  }, [plan]);

  const view = useMemo(() => (size ? computeView(size) : null), [size]);
  const activeSelection = selection && isSelectionVisible(selection, hidden, onlyOpen, status) ? selection : null;
  const selectionKey = activeSelection ? `${activeSelection.type}:${activeSelection.id}` : "";

  // збережене з localStorage (skipHydration у сторах)
  useEffect(() => {
    void useFilters.persist.rehydrate();
    void usePlans.persist.rehydrate();
  }, []);

  // живий статус: одразу з кешу, далі оновлюємо при старті, поверненні у вкладку, появі мережі й раз на 2 хв
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled && document.visibilityState === "visible") void useStatus.getState().refresh();
    };
    void Promise.resolve(useStatus.persist.rehydrate()).then(refresh);
    const timer = setInterval(refresh, 120_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  // розмір в'юпорту (від нього залежить початковий зум)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // SVG з'явився в DOM: хітбокси + стартовий --zoom (до першого малювання, щоб лінії не блимали)
  useLayoutEffect(() => {
    if (!svgEl) return;
    addHitAreas(svgEl);
    const scale = transformRef.current?.state.scale ?? 1;
    rootRef.current?.style.setProperty("--zoom", scale.toFixed(3));
  }, [svgEl]);

  useEffect(() => {
    if (svgEl) applyStatus(svgEl, status);
  }, [svgEl, status]);

  // після applyStatus: «лише відкриті» читає data-status
  useEffect(() => {
    if (svgEl) applyVisibility(svgEl, hidden, onlyOpen);
  }, [svgEl, hidden, onlyOpen, status]);

  // підсвітка вибраного
  useEffect(() => {
    if (!svgEl || !selectionKey) return;
    const [type, id] = selectionKey.split(":") as [Selection["type"], string];
    const root = rootRef.current;
    const nodes = svgEl.querySelectorAll(selectionSelector({ type, id }));
    nodes.forEach((n) => n.setAttribute("data-selected", ""));
    root?.setAttribute("data-has-selection", "");
    revealSelection(nodes, viewportRef.current, bottomStackRef.current, transformRef.current);
    return () => {
      nodes.forEach((n) => n.removeAttribute("data-selected"));
      root?.removeAttribute("data-has-selection");
    };
  }, [svgEl, selectionKey]);

  // елементи активного плану: товщі лінії, пройдені — світліші
  useEffect(() => {
    if (!svgEl) return;
    const nodes: Element[] = [];
    planMarks.forEach((allDone, key) => {
      const [type, id] = key.split(":") as [Selection["type"], string];
      svgEl.querySelectorAll(selectionSelector({ type, id })).forEach((n) => {
        n.setAttribute("data-planned", "");
        n.toggleAttribute("data-done", allDone);
        nodes.push(n);
      });
    });
    return () => {
      nodes.forEach((n) => {
        n.removeAttribute("data-planned");
        n.removeAttribute("data-done");
      });
    };
  }, [svgEl, planMarks]);

  useEffect(() => () => clearTimeout(zoomTimer.current), []);

  const handleTap = useCallback((x: number, y: number) => {
    const group = pickGroup(document.elementsFromPoint(x, y));
    const kind = group?.dataset.kind;
    if (!group || kind === "marker") return setSelection(null);
    if (kind === "lift") {
      const id = group.dataset.lift;
      return setSelection(id ? { type: "lift", id } : null);
    }
    const id = group.dataset.trail?.split(" ")[0];
    setSelection(id && trailById.has(id) ? { type: "trail", id } : null);
  }, []);

  // Тап відрізняємо від панорамування/щипка власним порогом руху й часу.
  // Відпускання слухаємо на window: палець/миша можуть відпуститися поза в'юпортом.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const active = new Map<number, { x: number; y: number; t: number }>();
    let multiTouch = false;

    const onDown = (e: globalThis.PointerEvent) => {
      multiTouch = active.size > 0; // другий палець — це жест, а не тап
      active.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    };
    const onEnd = (e: globalThis.PointerEvent) => {
      const start = active.get(e.pointerId);
      if (!start) return;
      active.delete(e.pointerId);
      if (e.type === "pointercancel" || multiTouch || active.size > 0) return;
      if (e.timeStamp - start.t > TAP_MAX_TIME) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_MAX_MOVE) return;
      if (!(e.target instanceof Node) || !viewport.contains(e.target)) return;
      handleTap(e.clientX, e.clientY);
    };

    viewport.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      viewport.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [handleTap]);

  // товщина ліній залежить від зуму; оновлюємо CSS-змінну з невеликою затримкою, не на кожен кадр жесту
  const handleTransform = useCallback((_: unknown, state: { scale: number }) => {
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => {
      rootRef.current?.style.setProperty("--zoom", state.scale.toFixed(3));
    }, 80);
  }, []);

  // «Показати на карті» з плану: повертаємо приховану складність, інакше елемент не буде видно
  const locate = (type: Selection["type"], id: string) => {
    const sel: Selection = { type, id };
    if (!isSelectionVisible(sel, hidden, onlyOpen, status)) {
      const diffs = (type === "trail" ? [trailById.get(id)] : (trailsByLift.get(id) ?? []))
        .map((t) => t?.difficulty)
        .filter((d): d is Difficulty => !!d);
      const easiest = DIFFICULTIES.find((d) => diffs.includes(d));
      if (easiest) useFilters.getState().show([easiest]);
      if (onlyOpen && statusOf(status, type, id)?.state === "closed") useFilters.getState().setOnlyOpen(false);
    }
    setSelection(sel);
    setPlanOpen(false);
  };

  const planCount = activeSelection
    ? (plan?.items.filter((i) => i.type === activeSelection.type && i.ref === activeSelection.id).length ?? 0)
    : 0;
  const planDone = plan?.items.filter((i) => i.done).length ?? 0;

  const resetView = () => {
    if (!view || !size) return;
    const { x, y } = centerOn(size, view.fit);
    void transformRef.current?.setTransform(x, y, view.fit, 300);
  };

  return (
    <div ref={rootRef} className="ski-map fixed inset-0 select-none overflow-hidden bg-white">
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
      >
        {view && (
          <TransformWrapper
            ref={transformRef}
            initialScale={view.initial}
            initialPositionX={view.x}
            initialPositionY={view.y}
            minScale={view.min}
            maxScale={MAX_SCALE}
            limitToBounds
            centerZoomedOut
            doubleClick={{ mode: "zoomIn", step: 0.7 }}
            onTransform={handleTransform}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
            >
              <div className="relative" style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
                {/* звичайний <img>: статичний файл із /public, оптимізація next/image тут не потрібна */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/map/background.webp"
                  alt=""
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  draggable={false}
                  className="absolute inset-0 max-w-none"
                />
                <svg
                  ref={setSvgEl}
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  aria-label="Карта трас і підйомників Буковеля"
                  className="absolute inset-0 max-w-none"
                  dangerouslySetInnerHTML={{ __html: overlay }}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPlanOpen(true)}
        className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold text-zinc-800 shadow-lg ring-1 ring-black/5 active:bg-zinc-100 dark:bg-zinc-900/95 dark:text-zinc-100 dark:ring-white/10"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
        План
        {plan && plan.items.length > 0 && (
          <span className="tabular-nums text-zinc-500">
            {planDone}/{plan.items.length}
          </span>
        )}
      </button>

      <div className="absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)]">
        <StatusPill />
      </div>

      <button
        type="button"
        onClick={resetView}
        aria-label="Показати весь курорт"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/95 text-zinc-700 shadow-lg ring-1 ring-black/5 active:bg-zinc-100 dark:bg-zinc-900/95 dark:text-zinc-200 dark:ring-white/10"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>

      <div ref={bottomStackRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {activeSelection && (
          <div className="pointer-events-auto">
            <InfoSheet
              selection={activeSelection}
              isTrailHidden={(t) =>
                hidden.has(t.difficulty) || (onlyOpen && statusOf(status, "trail", t.id)?.state === "closed")
              }
              planCount={planCount}
              status={statusOf(status, activeSelection.type, activeSelection.id)}
              onAddToPlan={() => usePlans.getState().addItem(activeSelection.type, activeSelection.id)}
              onClose={() => setSelection(null)}
              onSelect={setSelection}
            />
          </div>
        )}
        <div className="pointer-events-auto rounded-2xl bg-white/95 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-zinc-900/95 dark:ring-white/10">
          <FilterBar hidden={hiddenList} onToggle={toggleFilter} />
        </div>
      </div>
      {planOpen && <PlanPanel onClose={() => setPlanOpen(false)} onLocate={locate} />}
    </div>
  );
}
