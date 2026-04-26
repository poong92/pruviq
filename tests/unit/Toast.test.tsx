/**
 * Toast.test.tsx — contract tests for toast store + Toaster (W1-3).
 */
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import {
  toast,
  dismiss,
  dismissAll,
  subscribe,
  _resetForTests,
  type ToastEntry,
} from "../../src/components/ui/toast/store";
import Toaster from "../../src/components/ui/Toaster";

beforeEach(() => {
  _resetForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("toast store", () => {
  test("toast() pushes a new entry to subscribers (newest first)", () => {
    const seen: ToastEntry[][] = [];
    subscribe((t) => seen.push(t));
    toast("first", { variant: "info" });
    toast("second", { variant: "success" });
    const last = seen[seen.length - 1];
    expect(last.length).toBe(2);
    expect(last[0].message).toBe("second"); // newest first
    expect(last[1].message).toBe("first");
  });

  test("default variant is info, default duration 4000ms", () => {
    const seen: ToastEntry[][] = [];
    subscribe((t) => seen.push(t));
    toast("hi");
    expect(seen[seen.length - 1][0].variant).toBe("info");
    expect(seen[seen.length - 1][0].duration).toBe(4000);
  });

  test("auto-dismiss fires after duration", () => {
    const seen: ToastEntry[][] = [];
    subscribe((t) => seen.push(t));
    toast("vanishing", { duration: 1000 });
    expect(seen[seen.length - 1].length).toBe(1);
    // Advance to dismiss trigger (mark leaving)
    vi.advanceTimersByTime(1000);
    expect(seen[seen.length - 1][0].leaving).toBe(true);
    // Advance past 200ms exit phase to fully remove
    vi.advanceTimersByTime(200);
    expect(seen[seen.length - 1].length).toBe(0);
  });

  test("duration: 0 marks the toast sticky (no auto-dismiss)", () => {
    const seen: ToastEntry[][] = [];
    subscribe((t) => seen.push(t));
    toast("permanent", { duration: 0 });
    vi.advanceTimersByTime(60_000);
    const last = seen[seen.length - 1];
    expect(last.length).toBe(1);
    expect(last[0].sticky).toBe(true);
    expect(last[0].leaving).toBe(false);
  });

  test("dismiss(id) marks leaving then removes", () => {
    const seen: ToastEntry[][] = [];
    subscribe((t) => seen.push(t));
    const id = toast("x", { duration: 0 });
    dismiss(id);
    expect(seen[seen.length - 1][0].leaving).toBe(true);
    vi.advanceTimersByTime(200);
    expect(seen[seen.length - 1].length).toBe(0);
  });

  test("dismissAll() clears immediately", () => {
    const seen: ToastEntry[][] = [];
    subscribe((t) => seen.push(t));
    toast("a", { duration: 0 });
    toast("b", { duration: 0 });
    dismissAll();
    expect(seen[seen.length - 1].length).toBe(0);
  });

  test("subscribe returns unsubscribe function", () => {
    const seen: ToastEntry[][] = [];
    const unsub = subscribe((t) => seen.push(t));
    toast("a");
    const beforeUnsub = seen.length;
    unsub();
    toast("b");
    expect(seen.length).toBe(beforeUnsub);
  });
});

describe("<Toaster /> renderer", () => {
  test("renders nothing when no toasts", () => {
    const { container } = render(<Toaster />);
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  test("renders toast with role=status for success/info (polite)", () => {
    const { container } = render(<Toaster />);
    toast("saved", { variant: "success", duration: 0 });
    // Microtask flush — Preact useEffect subscribe hasn't run synchronously
    return Promise.resolve().then(() => {
      const el = container.querySelector('[data-testid="toast-success"]');
      expect(el).toBeTruthy();
      expect(el!.getAttribute("role")).toBe("status");
      expect(el!.getAttribute("aria-live")).toBe("polite");
    });
  });

  test("renders toast with role=alert for error/warning (assertive)", () => {
    const { container } = render(<Toaster />);
    toast("oh no", { variant: "error", duration: 0 });
    return Promise.resolve().then(() => {
      const el = container.querySelector('[data-testid="toast-error"]');
      expect(el).toBeTruthy();
      expect(el!.getAttribute("role")).toBe("alert");
      expect(el!.getAttribute("aria-live")).toBe("assertive");
    });
  });

  test("each toast has a dismiss button with aria-label", () => {
    const { container } = render(<Toaster />);
    toast("hi", { duration: 0 });
    return Promise.resolve().then(() => {
      const btn = container.querySelector(
        'button[aria-label="Dismiss notification"]',
      );
      expect(btn).toBeTruthy();
    });
  });
});
