"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { iconBtn } from "@/components/ui";

// відкриті шторки: Escape закриває лише верхню
const stack: symbol[] = [];

type Props = {
  title: string;
  onClose: () => void;
  /** кнопки в шапці зліва від «закрити» */
  actions?: ReactNode;
  /** закріплена смуга під шапкою (вкладки) */
  subheader?: ReactNode;
  /** закріплена смуга внизу (головні дії) */
  footer?: ReactNode;
  /** клас z-index; вкладена шторка має бути вище за батьківську */
  z?: string;
  children: ReactNode;
};

/**
 * Нижня шторка для всіх вторинних екранів: однакова шапка, закриття по тапу поза нею та Escape,
 * фокус переходить у шторку й повертається назад.
 */
export function Sheet({ title, onClose, actions, subheader, footer, z = "z-30", children }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const token = Symbol("sheet");
    stack.push(token);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === token) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className={`fixed inset-0 ${z} flex items-end justify-center`}>
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="animate-fade absolute inset-0 cursor-default bg-black/35"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 pl-5 pr-2 pt-2">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold">
            {title}
          </h2>
          <div className="flex shrink-0 items-center">
            {actions}
            <button type="button" onClick={onClose} aria-label="Закрити" className={iconBtn}>
              <CloseIcon />
            </button>
          </div>
        </header>
        {subheader && <div className="shrink-0 px-5 pb-2 pt-1">{subheader}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-2">{children}</div>
        {footer && <div className="shrink-0 border-t border-hairline px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}
