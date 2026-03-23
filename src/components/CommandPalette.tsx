/**
 * CommandPalette.tsx — Cmd+K global search
 * Fuzzy search across strategies, pages, and tools.
 * Keyboard navigation: ↑↓ to move, Enter to select, Esc to close.
 */
import { useState, useEffect, useRef, useCallback } from "preact/hooks";

interface SearchItem {
  label: string;
  description?: string;
  href: string;
  category: "page" | "strategy" | "tool";
  keywords?: string;
}

const PAGES: SearchItem[] = [
  { label: "Home", href: "/", category: "page", keywords: "main landing" },
  {
    label: "Simulator",
    description: "Build & backtest strategies",
    href: "/simulate",
    category: "tool",
    keywords: "backtest test run",
  },
  {
    label: "Strategies",
    description: "Browse all strategies",
    href: "/strategies",
    category: "page",
    keywords: "list library",
  },
  {
    label: "Daily Ranking",
    description: "Top performing strategies",
    href: "/strategies/ranking",
    category: "page",
    keywords: "rank best worst",
  },
  {
    label: "Weekly Leaderboard",
    description: "This week's best",
    href: "/leaderboard",
    category: "page",
    keywords: "weekly top",
  },
  {
    label: "Fee Calculator",
    description: "Compare exchange fees",
    href: "/fees",
    category: "tool",
    keywords: "exchange binance okx bybit",
  },
  {
    label: "Market Overview",
    description: "Live market data",
    href: "/market",
    category: "page",
    keywords: "price btc eth",
  },
  {
    label: "Learn",
    description: "Crypto trading education",
    href: "/learn",
    category: "page",
    keywords: "guide tutorial beginner",
  },
  {
    label: "Methodology",
    description: "How simulations work",
    href: "/methodology",
    category: "page",
    keywords: "engine backtest how",
  },
  {
    label: "About",
    description: "About PRUVIQ",
    href: "/about",
    category: "page",
    keywords: "team story",
  },
  {
    label: "Compare: TradingView",
    href: "/compare/tradingview",
    category: "page",
    keywords: "vs alternative",
  },
  {
    label: "API",
    description: "Public API docs",
    href: "/api",
    category: "tool",
    keywords: "developer endpoint",
  },
  {
    label: "Changelog",
    description: "Recent updates",
    href: "/changelog",
    category: "page",
    keywords: "release version update",
  },
];

const STRATEGIES: SearchItem[] = [
  {
    label: "BB Squeeze SHORT",
    description: "Volatility squeeze ↓",
    href: "/simulate?preset=bb-squeeze-short",
    category: "strategy",
  },
  {
    label: "BB Squeeze LONG",
    description: "Volatility squeeze ↑",
    href: "/simulate?preset=bb-squeeze-long",
    category: "strategy",
  },
  {
    label: "RSI Reversal LONG",
    description: "Oversold bounce ↑",
    href: "/simulate?preset=rsi-reversal-long",
    category: "strategy",
  },
  {
    label: "MACD Momentum LONG",
    description: "Momentum surge ↑",
    href: "/simulate?preset=macd-momentum-long",
    category: "strategy",
  },
  {
    label: "EMA Crossover LONG",
    description: "Trend cross ↑",
    href: "/simulate?preset=ema-crossover-long",
    category: "strategy",
  },
  {
    label: "ADX Trend SHORT",
    description: "Strong trend ↓",
    href: "/simulate?preset=adx-trend-short",
    category: "strategy",
  },
  {
    label: "Ichimoku Cloud LONG",
    description: "Cloud bullish ↑",
    href: "/simulate?preset=ichimoku-cloud-long",
    category: "strategy",
  },
  {
    label: "Turtle Breakout LONG",
    description: "Breakout ↑",
    href: "/simulate?preset=turtle-breakout-long",
    category: "strategy",
  },
  {
    label: "Supertrend LONG",
    description: "Trend following ↑",
    href: "/simulate?preset=supertrend-long",
    category: "strategy",
  },
  {
    label: "MACD Zero Cross",
    description: "Both directions ↕",
    href: "/simulate?preset=macd-zero-cross",
    category: "strategy",
  },
];

const ALL_ITEMS = [...PAGES, ...STRATEGIES];

function fuzzyMatch(query: string, item: SearchItem): number {
  const q = query.toLowerCase();
  const searchText =
    `${item.label} ${item.description || ""} ${item.keywords || ""}`.toLowerCase();

  // Exact substring match — highest score
  if (searchText.includes(q)) return 100 - searchText.indexOf(q);

  // Word-start match
  const words = searchText.split(/\s+/);
  let wordScore = 0;
  for (const w of words) {
    if (w.startsWith(q)) wordScore += 50;
  }
  if (wordScore > 0) return wordScore;

  // Character-by-character fuzzy
  let qi = 0;
  for (let i = 0; i < searchText.length && qi < q.length; i++) {
    if (searchText[i] === q[qi]) qi++;
  }
  return qi === q.length ? 10 : 0;
}

const CATEGORY_LABELS: Record<string, string> = {
  tool: "Tools",
  page: "Pages",
  strategy: "Strategies",
};

const CATEGORY_ORDER = ["tool", "strategy", "page"];

interface Props {
  lang?: "en" | "ko";
}

export default function CommandPalette({ lang = "en" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter and group results
  const results =
    query.length > 0
      ? ALL_ITEMS.map((item) => ({ item, score: fuzzyMatch(query, item) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((r) => r.item)
          .slice(0, 12)
      : ALL_ITEMS.slice(0, 8); // Show top items when no query

  // Group by category
  const grouped: { category: string; items: SearchItem[] }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = results.filter((r) => r.category === cat);
    if (items.length > 0) grouped.push({ category: cat, items });
  }
  const flatResults = grouped.flatMap((g) => g.items);

  const navigate = useCallback(
    (item: SearchItem) => {
      const prefix =
        lang === "ko" && !item.href.startsWith("/simulate") ? "/ko" : "";
      window.location.href = prefix + item.href;
      setOpen(false);
    },
    [lang],
  );

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[activeIdx]) {
      e.preventDefault();
      navigate(flatResults[activeIdx]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      class="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div class="relative w-full max-w-lg mx-4 rounded-xl border border-[--color-border] bg-[--color-bg-card] shadow-2xl overflow-hidden">
        {/* Search input */}
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[--color-border]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-[--color-text-muted] shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onInput={(e) => {
              setQuery((e.target as HTMLInputElement).value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={
              lang === "ko"
                ? "페이지, 전략, 도구 검색..."
                : "Search pages, strategies, tools..."
            }
            class="flex-1 bg-transparent outline-none text-sm font-mono text-[--color-text] placeholder:text-[--color-text-muted]"
            aria-label="Search"
          />
          <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-[--color-border] text-[10px] font-mono text-[--color-text-muted]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} class="max-h-[50vh] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div class="px-4 py-8 text-center text-sm text-[--color-text-muted] font-mono">
              {lang === "ko" ? "결과 없음" : "No results found"}
            </div>
          ) : (
            grouped.map((group) => {
              return (
                <div key={group.category}>
                  <div class="px-4 py-1.5 text-[9px] font-mono text-[--color-text-muted] uppercase tracking-wider">
                    {CATEGORY_LABELS[group.category]}
                  </div>
                  {group.items.map((item) => {
                    const idx = flatResults.indexOf(item);
                    const isActive = idx === activeIdx;
                    return (
                      <button
                        key={item.href}
                        data-idx={idx}
                        onClick={() => navigate(item)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        class={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm transition-colors ${
                          isActive
                            ? "bg-[--color-accent]/10 text-[--color-accent]"
                            : "text-[--color-text] hover:bg-[--color-bg-hover]"
                        }`}
                        role="option"
                        aria-selected={isActive}
                      >
                        <div class="flex-1 min-w-0">
                          <div class="font-mono text-xs font-semibold truncate">
                            {item.label}
                          </div>
                          {item.description && (
                            <div class="text-[10px] text-[--color-text-muted] truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <span class="text-[10px] font-mono text-[--color-text-muted] shrink-0">
                            ↵
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div class="border-t border-[--color-border] px-4 py-2 flex items-center gap-4 text-[10px] font-mono text-[--color-text-muted]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
