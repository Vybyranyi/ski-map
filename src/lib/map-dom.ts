import type { Difficulty } from "./difficulty";
import { trailsByLift } from "@/data/resort";

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

/** Ховає траси, з'єднання й підйомники відповідно до прихованих складностей. */
export function applyVisibility(svg: SVGSVGElement, hidden: ReadonlySet<Difficulty>) {
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
    el.toggleAttribute("data-hidden", hide);
  });
}

export function selectionSelector(sel: Selection) {
  return sel.type === "lift"
    ? `[data-kind="lift"][data-lift="${sel.id}"]`
    : `[data-kind][data-trail~="${sel.id}"]`;
}
