/**
 * KeyboardShortcuts.tsx — `?` shortcut catalog overlay (W5-3).
 *
 * Linear-style power-user surface. Press `?` (or Shift+/) anywhere to
 * see the full keyboard shortcut catalog. Escape closes.
 *
 * Behavior:
 *   - `?` key (Shift+/) opens overlay
 *   - Escape closes
 *   - Click backdrop closes
 *   - Focus trap inside dialog
 *   - aria-modal + role="dialog" + aria-labelledby
 *   - Returns focus to triggering element on close
 *
 * Does not register the actual shortcuts (those live with their owner —
 * Cmd+K is in CommandPalette, T is the theme toggle in Layout). This
 * component is a *catalog* — a discoverability surface that lists
 * what's already wired elsewhere, plus a few "always-on" globals
 * (?, Escape, Tab navigation hints).
 *
 * Mounted globally via Layout.astro alongside CommandPalette and Toaster.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { Lang } from "../i18n";

interface ShortcutEntry {
  keys: string[];
  label_en: string;
  label_ko: string;
}

interface ShortcutGroup {
  title_en: string;
  title_ko: string;
  items: ShortcutEntry[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title_en: "Navigation",
    title_ko: "탐색",
    items: [
      {
        keys: ["⌘", "K"],
        label_en: "Open command palette (Ctrl+K on Windows)",
        label_ko: "명령 팔레트 열기 (Windows: Ctrl+K)",
      },
      {
        keys: ["?"],
        label_en: "Show this shortcut catalog",
        label_ko: "이 단축키 카탈로그 열기",
      },
      {
        keys: ["Esc"],
        label_en: "Close any modal / overlay / dropdown",
        label_ko: "모달 / 오버레이 / 드롭다운 닫기",
      },
    ],
  },
  {
    title_en: "Appearance",
    title_ko: "외관",
    items: [
      {
        keys: ["T"],
        label_en: "Toggle theme (light ↔ dark)",
        label_ko: "테마 전환 (라이트 ↔ 다크)",
      },
    ],
  },
  {
    title_en: "Interaction",
    title_ko: "인터랙션",
    items: [
      {
        keys: ["Tab"],
        label_en: "Move focus to next interactive element",
        label_ko: "다음 인터랙티브 요소로 포커스 이동",
      },
      {
        keys: ["⇧", "Tab"],
        label_en: "Move focus to previous interactive element",
        label_ko: "이전 인터랙티브 요소로 포커스 이동",
      },
      {
        keys: ["Enter"],
        label_en: "Activate focused button or link",
        label_ko: "포커스된 버튼 / 링크 활성화",
      },
      {
        keys: ["Space"],
        label_en: "Activate focused button / toggle",
        label_ko: "포커스된 버튼 / 토글 활성화",
      },
      {
        keys: ["←", "→"],
        label_en: "Move between tabs in tab strips",
        label_ko: "탭 스트립에서 탭 간 이동",
      },
    ],
  },
];

interface Props {
  lang?: Lang;
}

export default function KeyboardShortcuts({ lang = "en" }: Props) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Toggle on `?` key (Shift+/), close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (!open && !isEditable && e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        previousFocus.current = (document.activeElement as HTMLElement) ?? null;
        setOpen(true);
      } else if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus management
  useEffect(() => {
    if (open) {
      // Move focus to dialog
      requestAnimationFrame(() => {
        dialogRef.current?.focus();
      });
    } else if (previousFocus.current) {
      // Return focus to the element that was focused before opening
      const el = previousFocus.current;
      requestAnimationFrame(() => el.focus());
      previousFocus.current = null;
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const t = (en: string, ko: string) => (lang === "ko" ? ko : en);

  return (
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-shortcuts-title"
      data-testid="kbd-shortcuts-overlay"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("Close shortcuts", "단축키 닫기")}
        class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        onClick={() => setOpen(false)}
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        class="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-[--color-border] bg-[--color-bg-card] shadow-[var(--shadow-lg)] focus:outline-none"
      >
        <header class="flex items-center justify-between px-5 py-4 border-b border-[--color-border]">
          <div>
            <h2
              id="kbd-shortcuts-title"
              class="font-semibold text-[--color-text] text-base"
            >
              {t("Keyboard Shortcuts", "키보드 단축키")}
            </h2>
            <p class="text-xs text-[--color-text-muted] mt-0.5">
              {t(
                "Press ? anywhere to reopen this list",
                "어디서든 ? 키로 이 목록을 다시 열 수 있습니다",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("Close", "닫기")}
            class="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-hover] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="px-5 py-4 space-y-5">
          {GROUPS.map((group) => (
            <section
              key={group.title_en}
              aria-label={t(group.title_en, group.title_ko)}
            >
              <h3 class="text-[10px] font-mono uppercase tracking-wider text-[--color-text-muted] mb-2">
                {t(group.title_en, group.title_ko)}
              </h3>
              <ul class="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item.keys.join("+") + item.label_en}
                    class="flex items-center justify-between gap-3 text-sm"
                  >
                    <span class="text-[--color-text]">
                      {t(item.label_en, item.label_ko)}
                    </span>
                    <span class="shrink-0 flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <>
                          {i > 0 && (
                            <span
                              class="text-[10px] text-[--color-text-muted]"
                              aria-hidden="true"
                            >
                              +
                            </span>
                          )}
                          <kbd
                            key={`${k}-${i}`}
                            class="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-[--color-border] bg-[--color-bg-elevated] font-mono text-[11px] text-[--color-text-muted]"
                          >
                            {k}
                          </kbd>
                        </>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
