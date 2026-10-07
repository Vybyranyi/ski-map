// Генерує PNG-іконки застосунку з public/icons/icon.svg (потрібен sharp).
// Запуск: npm run make:icons

import path from "node:path";
import sharp from "sharp";

const dir = path.resolve(import.meta.dirname, "../public/icons");
const svg = path.join(dir, "icon.svg");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];
for (const { file, size } of targets) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(path.join(dir, file));
}

// maskable: ОС обрізає по колу/«squircle», тож вміст стискаємо в безпечну зону (≈ 80%) на фоні того ж кольору
const inner = await sharp(svg, { density: 300 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#2563eb" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(path.join(dir, "maskable-512.png"));

console.log("icons: ", [...targets.map((t) => t.file), "maskable-512.png"].join(", "));
