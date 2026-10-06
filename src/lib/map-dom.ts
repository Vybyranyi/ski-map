import type { Difficulty } from "./difficulty";
import { trailsByLift } from "@/data/resort";
import type { LiveStatus } from "./live-status";

export type Selection = { type: "trail" | "lift"; id: string };

const GROUPS = "[data-kind=trail],[data-kind=connector],[data-kind=lift]";

/**
 * Додає до кожної лінії траси/підйомника прозорий «двійник» із товстим штрихом —
 * щоб у тонку лінію можна було влучити пальцем. Ширина — у CSS (.hit).
 */
export function addHitAreas(svg: SVGSVGElement) {
  if (svg.dataset.hitAreas) return;
  svg.dataset.hitAreas = "1";

  svg.querySelectorAll<SVGElement>(GROUPS).forEach((group) => {
    const isLift = group.dataset.kind === "lift";
    const lines = group.querySelectorAll<SVGElement>(
      isLift ? "line.animated, path.animated" : "path, line",
    );
    lines.forEach((el) => {
      if (el.closest(".label, .lift-label")) return;
      const hit = el.cloneNode(false) as SVGElement;
      hit.removeAttribute("id");
      hit.setAttribute("class", "hit");
      el.after(hit);
    });
  });
}

/** Записує живий статус у data-status груп (без статусу атрибут прибирається). */
export function applyStatus(svg: SVGSVGElement, status: LiveStatus | null) {
  svg.querySelectorAll<SVGElement>(GROUPS).forEach((el) => {
    const st =
      el.dataset.kind === "lift"
        ? status?.lifts[el.dataset.lift ?? ""]
        : status?.trails[(el.dataset.trail ?? "").split(" ")[0]];
    if (st) el.dataset.status = st.state;
    else delete el.dataset.status;
  });
}

/**
 * Ховає траси, з'єднання й підйомники за прихованими складностями та (за потреби)
 * за статусом «закрито». Статус береться з data-status, тож applyStatus має виконатись раніше.
 */
export function applyVisibility(svg: SVGSVGElement, hidden: ReadonlySet<Difficulty>, onlyOpen: boolean) {
  svg.querySelectorAll<SVGElement>(GROUPS).forEach((el) => {
    let hide: boolean;
    if (el.dataset.kind === "lift") {
      // підйомник ховаємо, якщо всі траси, на які він веде, приховані
      const served = trailsByLift.get(el.dataset.lift ?? "") ?? [];
      hide = served.length > 0 && served.every((t) => hidden.has(t.difficulty));
    } else {
      const diffs = (el.dataset.diff ?? "").split(" ").filter(Boolean) as Difficulty[];
      hide = diffs.length > 0 && diffs.every((d) => hidden.has(d));
    }
    if (onlyOpen && el.dataset.status === "closed") hide = true;
    el.toggleAttribute("data-hidden", hide);
  });
}

export function selectionSelector(sel: Selection) {
  return sel.type === "lift"
    ? `[data-kind="lift"][data-lift="${sel.id}"]`
    : `[data-kind][data-trail~="${sel.id}"]`;
}
