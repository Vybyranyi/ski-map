import { normalizeStatus } from "@/lib/live-status";

// Проксі до статусу трас і підйомників Буковеля (їхнє API без CORS, тож із браузера не прочитати).
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const UPSTREAM = "https://bukovel.com/api/v2/status-lifts-trails";

const fail = (message: string) =>
  Response.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  try {
    const res = await fetch(UPSTREAM, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return fail(`Bukovel API: HTTP ${res.status}`);

    const status = normalizeStatus(await res.json(), Date.now());
    if (!status) return fail("Bukovel API: неочікуваний формат відповіді");

    // CDN Vercel тримає відповідь хвилину (стільки ж навантаження на Буковель максимум),
    // ще 5 хв може віддати застарілу, поки оновлює у фоні.
    return Response.json(status, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "невідома помилка");
  }
}
