/**
 * KeyboardShortcuts.test.tsx — contract test for W5-3.
 */
import { describe, expect, test, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import KeyboardShortcuts from "../../src/components/KeyboardShortcuts";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

function pressKey(key: string, opts: { shift?: boolean } = {}) {
  fireEvent.keyDown(window, {
    key,
    shiftKey: opts.shift ?? false,
    bubbles: true,
  });
}

describe("KeyboardShortcuts overlay", () => {
  test("renders nothing initially", () => {
    const { container } = render(<KeyboardShortcuts />);
    expect(
      container.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeNull();
  });

  test("? key opens the overlay", () => {
    render(<KeyboardShortcuts />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    );
    expect(overlay).toBeTruthy();
    expect(overlay!.getAttribute("role")).toBe("dialog");
    expect(overlay!.getAttribute("aria-modal")).toBe("true");
  });

  test("Escape closes the overlay", () => {
    render(<KeyboardShortcuts />);
    pressKey("?");
    expect(
      document.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeTruthy();
    pressKey("Escape");
    expect(
      document.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeNull();
  });

  test("clicking the backdrop closes the overlay", () => {
    render(<KeyboardShortcuts />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    )!;
    const backdrop = overlay.querySelector(
      'button[aria-label*="Close" i]',
    ) as HTMLButtonElement;
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop);
    expect(
      document.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeNull();
  });

  test("? does NOT trigger when typing in <input>", () => {
    render(
      <div>
        <input data-testid="i" />
        <KeyboardShortcuts />
      </div>,
    );
    const input = document.querySelector(
      '[data-testid="i"]',
    ) as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: "?", bubbles: true });
    expect(
      document.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeNull();
  });

  test("? does NOT trigger when typing in <textarea>", () => {
    render(
      <div>
        <textarea data-testid="t" />
        <KeyboardShortcuts />
      </div>,
    );
    const ta = document.querySelector(
      '[data-testid="t"]',
    ) as HTMLTextAreaElement;
    ta.focus();
    fireEvent.keyDown(ta, { key: "?", bubbles: true });
    expect(
      document.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeNull();
  });

  test("opening locks body scroll, closing restores it", () => {
    render(<KeyboardShortcuts />);
    expect(document.body.style.overflow).toBe("");
    pressKey("?");
    expect(document.body.style.overflow).toBe("hidden");
    pressKey("Escape");
    expect(document.body.style.overflow).toBe("");
  });

  test("renders shortcut categories with kbd elements", () => {
    render(<KeyboardShortcuts />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    )!;
    // At least 3 sections (Navigation, Appearance, Interaction)
    expect(overlay.querySelectorAll("section").length).toBeGreaterThanOrEqual(
      3,
    );
    // kbd elements rendered for keys
    expect(overlay.querySelectorAll("kbd").length).toBeGreaterThan(5);
  });

  test("aria-labelledby points to the title id", () => {
    render(<KeyboardShortcuts />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    )!;
    const ariaLabelledBy = overlay.getAttribute("aria-labelledby");
    expect(ariaLabelledBy).toBeTruthy();
    const title = document.getElementById(ariaLabelledBy!);
    expect(title).toBeTruthy();
    expect(title!.tagName).toBe("H2");
  });

  test("ko lang switches title and content", () => {
    render(<KeyboardShortcuts lang="ko" />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    )!;
    expect(overlay.textContent).toContain("키보드 단축키");
    expect(overlay.textContent).toContain("탐색");
  });

  test("en lang shows English title and content", () => {
    render(<KeyboardShortcuts lang="en" />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    )!;
    expect(overlay.textContent).toContain("Keyboard Shortcuts");
    expect(overlay.textContent).toContain("Navigation");
  });

  test("explicit close button (×) closes overlay", () => {
    render(<KeyboardShortcuts />);
    pressKey("?");
    const overlay = document.querySelector(
      '[data-testid="kbd-shortcuts-overlay"]',
    )!;
    // The × close button has aria-label "Close" (en) or "닫기" (ko)
    const closeBtn = overlay.querySelector(
      'button[aria-label="Close"]',
    ) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);
    expect(
      document.querySelector('[data-testid="kbd-shortcuts-overlay"]'),
    ).toBeNull();
  });
});
