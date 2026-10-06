export const DIFFICULTIES = ["green", "blue", "red", "black"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

// Кольори — змінні --diff-* у globals.css (одне джерело для карти й інтерфейсу).
export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; plural: string; color: string }
> = {
  green: { label: "Зелена", plural: "Зелені", color: "var(--diff-green)" },
  blue: { label: "Синя", plural: "Сині", color: "var(--diff-blue)" },
  red: { label: "Червона", plural: "Червоні", color: "var(--diff-red)" },
  black: { label: "Чорна", plural: "Чорні", color: "var(--diff-black)" },
};
