/**
 * Dialog.test.tsx — contract test for W1-1g.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import Dialog, { DialogActions } from "../../src/components/ui/Dialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("Dialog primitive", () => {
  test("open=false renders nothing", () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="x">
        body
      </Dialog>,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  test("open=true renders role=dialog + aria-modal", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="Confirm">
        body
      </Dialog>,
    );
    const dlg = container.querySelector('[role="dialog"]')!;
    expect(dlg).toBeTruthy();
    expect(dlg.getAttribute("aria-modal")).toBe("true");
  });

  test("title renders <h2> with aria-labelledby wiring", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="My title">
        body
      </Dialog>,
    );
    const dlg = container.querySelector('[role="dialog"]')!;
    const labelledBy = dlg.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).toBeTruthy();
    expect(titleEl!.tagName).toBe("H2");
    expect(titleEl!.textContent).toBe("My title");
  });

  test("description wires aria-describedby", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="x" description="Helpful hint">
        body
      </Dialog>,
    );
    const dlg = container.querySelector('[role="dialog"]')!;
    const describedBy = dlg.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const descEl = document.getElementById(describedBy!);
    expect(descEl).toBeTruthy();
    expect(descEl!.textContent).toBe("Helpful hint");
  });

  test("Escape closes when closeOnEscape=true (default)", () => {
    let closed = false;
    render(
      <Dialog
        open
        onClose={() => {
          closed = true;
        }}
        title="x"
      >
        body
      </Dialog>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closed).toBe(true);
  });

  test("Escape does NOT close when closeOnEscape=false", () => {
    let closed = false;
    render(
      <Dialog
        open
        onClose={() => {
          closed = true;
        }}
        title="x"
        closeOnEscape={false}
      >
        body
      </Dialog>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closed).toBe(false);
  });

  test("backdrop click closes when closeOnBackdropClick=true (default)", () => {
    let closed = false;
    const { container } = render(
      <Dialog
        open
        onClose={() => {
          closed = true;
        }}
        title="x"
      >
        body
      </Dialog>,
    );
    const backdrop = container.querySelector(
      'button[aria-label="Close dialog"]',
    ) as HTMLButtonElement;
    fireEvent.click(backdrop);
    expect(closed).toBe(true);
  });

  test("backdrop click does NOT close when closeOnBackdropClick=false", () => {
    let closed = false;
    const { container } = render(
      <Dialog
        open
        onClose={() => {
          closed = true;
        }}
        title="x"
        closeOnBackdropClick={false}
      >
        body
      </Dialog>,
    );
    const backdrop = container.querySelector(
      'button[aria-label="Close dialog"]',
    ) as HTMLButtonElement;
    fireEvent.click(backdrop);
    expect(closed).toBe(false);
  });

  test("× close button closes dialog", () => {
    let closed = false;
    const { container } = render(
      <Dialog
        open
        onClose={() => {
          closed = true;
        }}
        title="x"
      >
        body
      </Dialog>,
    );
    // The header × button has aria-label="Close" (not "Close dialog")
    const closeBtn = container.querySelector(
      'button[aria-label="Close"]',
    ) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(closed).toBe(true);
  });

  test("hideCloseButton omits the × button", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="x" hideCloseButton>
        body
      </Dialog>,
    );
    expect(container.querySelector('button[aria-label="Close"]')).toBeNull();
  });

  test("body scroll locks while open, restores on close", () => {
    expect(document.body.style.overflow).toBe("");
    const { rerender } = render(
      <Dialog open onClose={() => {}} title="x">
        body
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Dialog open={false} onClose={() => {}} title="x">
        body
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  test("size=sm uses max-w-sm", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="x" size="sm">
        body
      </Dialog>,
    );
    const dlg = container.querySelector('[role="dialog"]')!;
    expect(dlg.className).toContain("max-w-sm");
  });

  test("size=xl uses max-w-2xl", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="x" size="xl">
        body
      </Dialog>,
    );
    const dlg = container.querySelector('[role="dialog"]')!;
    expect(dlg.className).toContain("max-w-2xl");
  });

  test("titleNode replaces default <h2>", () => {
    const { container } = render(
      <Dialog
        open
        onClose={() => {}}
        titleNode={<div data-testid="custom-title">Custom</div>}
      >
        body
      </Dialog>,
    );
    const dlg = container.querySelector('[role="dialog"]')!;
    expect(
      container.querySelector('[data-testid="custom-title"]'),
    ).toBeTruthy();
    expect(dlg.querySelector("h2")).toBeNull();
  });

  test("DialogActions renders with end alignment by default", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="x">
        <DialogActions>
          <button data-testid="ok">OK</button>
        </DialogActions>
      </Dialog>,
    );
    const actions =
      container.querySelector('[data-testid="ok"]')!.parentElement!;
    expect(actions.className).toContain("justify-end");
  });

  test("DialogActions align=between", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="x">
        <DialogActions align="between">
          <button data-testid="cancel">Cancel</button>
          <button data-testid="ok">OK</button>
        </DialogActions>
      </Dialog>,
    );
    const actions =
      container.querySelector('[data-testid="ok"]')!.parentElement!;
    expect(actions.className).toContain("justify-between");
  });

  test("dialog without title or hideCloseButton omits the header", () => {
    const { container } = render(
      <Dialog open onClose={() => {}} hideCloseButton>
        body
      </Dialog>,
    );
    expect(container.querySelector("header")).toBeNull();
  });
});
