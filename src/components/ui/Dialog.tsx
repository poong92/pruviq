/**
 * Dialog.tsx — Modal dialog primitive (W1-1g).
 *
 * Generalizes the modal pattern that appears in CommandPalette,
 * KeyboardShortcuts overlay, and future "Share result" / onboarding
 * modals. Controlled component — caller owns `open` state.
 *
 * Features:
 *   - role="dialog" + aria-modal="true" + aria-labelledby
 *   - Focus trap: Tab cycles within dialog, Shift+Tab reverses
 *   - Auto-focus on first focusable element when opened
 *     (or `initialFocusRef` if provided)
 *   - Returns focus to triggering element on close
 *   - Body scroll lock while open (preserves prior overflow style)
 *   - Backdrop click closes (configurable: closeOnBackdropClick)
 *   - Escape closes (configurable: closeOnEscape)
 *   - Sizes: sm (max-w-sm) / md (max-w-md) / lg (max-w-lg, default) / xl (max-w-2xl) / full (max-w-4xl)
 *
 * Tokens-only — adapts to light/dark theme.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Confirm">
 *     <p>Body content</p>
 *     <DialogActions>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button variant="primary">OK</Button>
 *     </DialogActions>
 *   </Dialog>
 */
import { useEffect, useId, useRef, type RefObject } from "preact/hooks";
import type { ComponentChildren } from "preact";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Title text — rendered as <h2 id={titleId}> and referenced by aria-labelledby. */
  title?: string;
  /** When set, replaces default title node. Caller must include id={titleId} for aria. */
  titleNode?: ComponentChildren;
  /** Optional description below title (gets aria-describedby). */
  description?: string;
  /** Children render inside the dialog body (under title/description). */
  children: ComponentChildren;
  /** When true (default), backdrop click closes. */
  closeOnBackdropClick?: boolean;
  /** When true (default), Escape key closes. */
  closeOnEscape?: boolean;
  /** Auto-focus this ref when dialog opens. Defaults to first focusable. */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Hide the × close button (e.g., for required-action dialogs). */
  hideCloseButton?: boolean;
  /** Dialog max-width. Default lg. */
  size?: DialogSize;
  /** Outer wrapper class merge. */
  class?: string;
  "data-testid"?: string;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-4xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Dialog({
  open,
  onClose,
  title,
  titleNode,
  description,
  children,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  initialFocusRef,
  hideCloseButton = false,
  size = "lg",
  class: className = "",
  ...rest
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Focus management: trap + restore
  useEffect(() => {
    if (!open) return;
    previousFocus.current = (document.activeElement as HTMLElement) ?? null;

    // Focus initial target
    requestAnimationFrame(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        (first ?? dialog).focus();
      }
    });

    return () => {
      const prev = previousFocus.current;
      previousFocus.current = null;
      if (prev && typeof prev.focus === "function") {
        requestAnimationFrame(() => prev.focus());
      }
    };
  }, [open, initialFocusRef]);

  // Keyboard handlers (Escape + focus trap)
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (closeOnEscape && e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || active === dialog) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, closeOnEscape]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const ariaDescribedBy = description ? descId : undefined;

  return (
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center p-4"
      data-dialog-root
      {...rest}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={closeOnBackdropClick ? onClose : undefined}
        class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title || titleNode ? titleId : undefined}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        class={`relative w-full ${sizeClasses[size]} max-h-[85vh] overflow-y-auto rounded-xl border border-[--color-border] bg-[--color-bg-card] shadow-[var(--shadow-lg)] focus:outline-none ${className}`.trim()}
      >
        {(title || titleNode || !hideCloseButton) && (
          <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-[--color-border]">
            <div class="flex-1 min-w-0">
              {titleNode ? (
                <div id={titleId}>{titleNode}</div>
              ) : title ? (
                <h2
                  id={titleId}
                  class="font-semibold text-[--color-text] text-base"
                >
                  {title}
                </h2>
              ) : null}
              {description && (
                <p id={descId} class="text-xs text-[--color-text-muted] mt-1">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </header>
        )}
        <div class="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface DialogActionsProps {
  children: ComponentChildren;
  /** Justify alignment. Default `end`. */
  align?: "start" | "center" | "end" | "between";
  class?: string;
}

const alignClass: Record<NonNullable<DialogActionsProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

export function DialogActions({
  children,
  align = "end",
  class: className = "",
}: DialogActionsProps) {
  return (
    <div
      class={`mt-5 -mx-5 -mb-4 px-5 py-3 border-t border-[--color-border] flex items-center gap-2 ${alignClass[align]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
