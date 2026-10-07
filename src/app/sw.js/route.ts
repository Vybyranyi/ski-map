import { readFile } from "node:fs/promises";
import path from "node:path";

// /sw.js збирається під час білда: у код підставляється ідентифікатор збірки, тож
// кожен деплой дає новий service worker (браузер порівнює його побайтно) і новий кеш.
export const dynamic = "force-static";

const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36);

export async function GET() {
  const source = await readFile(path.join(process.cwd(), "src/sw/service-worker.js"), "utf8");
  return new Response(source.replaceAll("__BUILD__", BUILD), {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
}
