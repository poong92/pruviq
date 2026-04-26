/**
 * Toaster.tsx — Toast renderer (W1-3).
 *
 * Singleton mount point. Place once near root (Layout.astro after
 * CommandPalette). Subscribes to the toast store and renders the queue.
 *
 * A11y:
 *   - Container has role="region" + aria-label
 *   - Each toast: role="status" (polite) for success/info,
 *                 role="alert"  (assertive) for error/warning
 *   - Dismiss button has aria-label
 *   - Close on Escape (focused toast)
 *
 * Animation:
 *   - Slide-in from right + fade (220ms ease-out)
 *   - Slide-out + fade (180ms)
 *   - prefers-reduced-motion → animation disabled (CSS)
 *
 * Position: top-right, z-100. Mobile: top with safe inset.
 */
import { useEffect, useState } from "preact/hooks";
import {
  subscribe,
  dismiss,
  type ToastEntry,
  type ToastVariant,
} from "./toast/store";

const variantClasses: Record<ToastVariant, string> = {
  success:
    "bg-[--color-bg-card] border-l-4 border-[--color-up] text-[--color-text]",
  error:
    "bg-[--color-bg-card] border-l-4 border-[--color-down] text-[--color-text]",
  warning:
    "bg-[--color-bg-card] border-l-4 border-[--color-verified] text-[--color-text]",
  info: "bg-[--color-bg-card] border-l-4 border-[--color-accent] text-[--color-text]",
};

const iconColor: Record<ToastVariant, string> = {
  success: "text-[--color-up]",
  error: "text-[--color-down]",
  warning: "text-[--color-verified]",
  info: "text-[--color-accent]",
};

const iconChar: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const isAssertive = (v: ToastVariant) => v === "error" || v === "warning";

interface ItemProps {
  toast: ToastEntry;
}

function ToastItem({ toast: t }: ItemProps) {
  return (
    <div
      class={`toast-item pointer-events-auto rounded shadow-[var(--shadow-lg)] ${variantClasses[t.variant]} pl-3 pr-2 py-3 flex items-start gap-2.5 min-w-[280px] max-w-[400px]`}
      role={isAssertive(t.variant) ? "alert" : "status"}
      aria-live={isAssertive(t.variant) ? "assertive" : "polite"}
      data-leaving={t.leaving ? "true" : undefined}
      data-variant={t.variant}
      data-testid={`toast-${t.variant}`}
    >
      <span
        class={`shrink-0 font-mono text-base leading-tight pt-0.5 ${iconColor[t.variant]}`}
        aria-hidden="true"
      >
        {iconChar[t.variant]}
      </span>
      <p class="flex-1 text-sm leading-relaxed pt-0.5 whitespace-pre-line">
        {t.message}
      </p>
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        aria-label="Dismiss notification"
        class="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => subscribe(setToasts), []);

  // Escape dismisses the most recent toast
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const top = toasts[0];
      if (top && !top.leaving) dismiss(top.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      style={{ paddingTop: "env(safe-area-inset-top, 0)" }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
