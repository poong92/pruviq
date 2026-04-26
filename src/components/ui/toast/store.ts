/**
 * toast/store.ts — singleton toast store (W1-3).
 *
 * Vanilla module-scoped state with subscribe pattern. No external dep.
 * Works across Preact islands without Context — any component on any
 * page can call `toast(...)` after the Toaster has mounted on the page.
 *
 * Variants:
 *   success   — verb done OK (e.g., "URL 복사됨")            polite live
 *   error     — operation failed                              assertive live
 *   warning   — proceed with caution / soft block             assertive live
 *   info      — neutral info / hint                           polite live
 *
 * Default auto-dismiss after 4s. Pass `duration: 0` for sticky.
 */

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastEntry {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  /** When true, keep on screen until manually dismissed. */
  sticky: boolean;
  /** Marked when scheduled to leave — Toaster uses this for exit animation. */
  leaving: boolean;
}

type Subscriber = (toasts: ToastEntry[]) => void;

let toasts: ToastEntry[] = [];
const subscribers = new Set<Subscriber>();
let nextId = 0;

function notify() {
  const snap = [...toasts];
  for (const sub of subscribers) sub(snap);
}

export interface ToastOptions {
  variant?: ToastVariant;
  /** Auto-dismiss after `duration` ms. Set to 0 for sticky. Default 4000. */
  duration?: number;
}

export function toast(message: string, opts: ToastOptions = {}): string {
  const id = `t-${++nextId}`;
  const variant = opts.variant ?? "info";
  const duration = opts.duration ?? 4000;
  const sticky = duration <= 0;
  const entry: ToastEntry = {
    id,
    message,
    variant,
    duration,
    sticky,
    leaving: false,
  };
  toasts = [entry, ...toasts];
  notify();
  if (!sticky) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

/** Schedule the toast for removal. Toaster will play exit animation then unmount. */
export function dismiss(id: string) {
  const idx = toasts.findIndex((t) => t.id === id);
  if (idx === -1) return;
  // Two-phase: mark leaving → after 200ms remove from store
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 200);
}

/** Remove all toasts immediately (e.g., on route change). */
export function dismissAll() {
  toasts = [];
  notify();
}

export function subscribe(sub: Subscriber): () => void {
  subscribers.add(sub);
  sub([...toasts]);
  return () => {
    subscribers.delete(sub);
  };
}

/** Test-only: reset module state between tests. */
export function _resetForTests() {
  toasts = [];
  subscribers.clear();
  nextId = 0;
}
