"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Плаваюча поверхня над картою: одна тінь, тонка межа. */
export const floating = "bg-surface shadow-float ring-1 ring-hairline";

/** Кнопки: мінімум 44 px по висоті, один головний варіант на екран. */
const btn =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-40";
export const btnPrimary = `${btn} bg-ink text-surface active:opacity-80`;
export const btnSecondary = `${btn} bg-subtle text-ink active:bg-hairline`;
export const btnGhost = `${btn} text-ink active:bg-subtle`;
export const btnDanger = `${btn} text-bad active:bg-subtle`;

/** Кругла кнопка-значок із зоною тапу 44 px. */
export const iconBtn =
  "grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors active:bg-subtle disabled:opacity-40";

/** Перемикач «увімк/вимк»: увесь рядок — одна ціль для тапу. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-sm"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-ink" : "bg-muted/40"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-[left] ${
            checked ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/** Руйнівна дія за два тапи: перший просить підтвердження, через 4 с повертається назад. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = btnDanger,
}: {
  label: ReactNode;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={armed ? `${btn} bg-bad text-surface` : className}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/** Колір стану: відкрито / закрито / очікує. Лише точка, без заливок. */
export function StateDot({ state, className = "" }: { state: "open" | "closed" | "waiting"; className?: string }) {
  const color = state === "open" ? "bg-ok" : state === "closed" ? "bg-bad" : "bg-warn";
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${color} ${className}`} />;
}
