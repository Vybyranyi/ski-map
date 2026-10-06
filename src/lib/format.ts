export const fmtDistance = (m: number | null) =>
  m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} км` : `${m} м`;

export const fmtMeters = (m: number) => `${Math.round(m).toLocaleString("uk-UA")} м`;

/** Перепад висот (верх − низ) */
export const drop = (x: { top: number | null; bottom: number | null }) =>
  x.top != null && x.bottom != null ? x.top - x.bottom : null;
