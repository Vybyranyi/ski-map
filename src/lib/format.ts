export const fmtDistance = (m: number | null) =>
  m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} км` : `${m} м`;

export const fmtMeters = (m: number) => `${Math.round(m).toLocaleString("uk-UA")} м`;

/** Перепад висот (верх − низ) */
export const drop = (x: { top: number | null; bottom: number | null }) =>
  x.top != null && x.bottom != null ? x.top - x.bottom : null;

/** Час із розкладу Буковеля: ISO → "09:00" (Київ); незрозумілий рядок показуємо як є */
export function fmtTime(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });
}
