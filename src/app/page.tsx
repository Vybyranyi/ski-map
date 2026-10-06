import { readFile } from "node:fs/promises";
import path from "node:path";
import { SkiMap } from "@/components/ski-map";

// Вміст <svg> оверлею (без кореневого тегу): збирається `npm run build:map`
async function readOverlay() {
  const file = path.join(process.cwd(), "src/data/generated/overlay.svg");
  const svg = await readFile(file, "utf8");
  const inner = svg.match(/^<svg[^>]*>([\s\S]*)<\/svg>\s*$/)?.[1];
  if (!inner) throw new Error("overlay.svg: неочікуваний формат");
  return inner;
}

export default async function Home() {
  return <SkiMap overlay={await readOverlay()} />;
}
