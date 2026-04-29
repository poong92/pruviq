import { useState, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { formatPrice, formatVolume } from "../utils/format";
import { generateCSV, downloadCSV } from "../utils/csv";
import { STATIC_DATA, fetchWithFallback, fetchLiveFirst } from "../config/api";
import MiniSparkline from "./MiniSparkline";

interface CoinRow {
  symbol: string;
  name: string;
  image: string;
  price: number;
  change_1h: number;
  change_24h: number;
  change_7d: number;
  market_cap: number;
  market_cap_rank: number | null;
  volume_24h: number;
  sparkline_7d: number[];
}

interface StatsData {
  generated: string;
  total_coins: number;
  coins: CoinRow[];
}

const PER_PAGE = 50;

const labels = {
  en: {
    search: "Search coins...",
    coin: "Coin",
    price: "Price",
    h1: "1h",
    h24: "24h",
    d7: "7d",
    mcap: "Market Cap",
    volume: "Volume (24h)",
    chart: "Last 7 Days",
    loading: "Loading coin data...",
    error: "Failed to load coin data.",
    noResults: "No coins match your search.",
    showing: (from: number, to: number, total: number) =>
      `${from}-${to} of ${total}`,
    tableCaption: "Cryptocurrency prices, market cap, volume, and 7-day charts",
    prevPage: "Previous page",
    nextPage: "Next page",
    downloadCsv: "Download CSV",
    simulateCta: "Simulate a Strategy",
    retry: "Retry",
    csvRank: "Rank",
    csvSymbol: "Symbol",
    csvName: "Name",
    csvPrice: "Price",
    csvH1: "1h %",
    csvH24: "24h %",
    csvD7: "7d %",
    csvMcap: "Market Cap",
    csvVolume: "Volume 24h",
    dataAsOf: "Data as of: ",
  },
  ko: {
    search: "코인 검색...",
    coin: "코인",
    price: "가격",
    h1: "1h",
    h24: "24h",
    d7: "7d",
    mcap: "시가총액",
    volume: "거래량 (24h)",
    chart: "7일 차트",
    loading: "코인 데이터 로딩 중...",
    error: "코인 데이터 로딩 실패.",
    noResults: "검색 결과가 없습니다.",
    showing: (from: number, to: number, total: number) =>
      `${from}-${to} / ${total}`,
    tableCaption: "암호화폐 가격, 시가총액, 거래량, 7일 차트",
    prevPage: "이전 페이지",
    nextPage: "다음 페이지",
    downloadCsv: "CSV 다운로드",
    simulateCta: "전략 시뮬레이션",
    retry: "다시 시도",
    csvRank: "순위",
    csvSymbol: "심볼",
    csvName: "이름",
    csvPrice: "가격",
    csvH1: "1h %",
    csvH24: "24h %",
    csvD7: "7d %",
    csvMcap: "시가총액",
    csvVolume: "거래량 24h",
    dataAsOf: "데이터 시점: ",
  },
};

type SortKey =
  | "symbol"
  | "price"
  | "change_1h"
  | "change_24h"
  | "change_7d"
  | "market_cap"
  | "volume_24h";

function formatMarketCap(v: number | null): string {
  if (v == null || v === 0) return "-";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function ChangeCell({
  value,
  className = "",
}: {
  value: number | null;
  className?: string;
}) {
  if (value == null)
    return (
      <td
        class={`px-2 py-2.5 text-right text-[--color-text-muted] ${className}`}
      >
        -
      </td>
    );
  const color = value >= 0 ? "text-[--color-up]" : "text-[--color-down]";
  const arrow = value >= 0 ? "\u25B2" : "\u25BC";
  return (
    <td class={`px-2 py-2.5 text-right ${color} ${className}`}>
      <span class="text-[0.625rem]" aria-hidden="true">
        {arrow}
      </span>{" "}
      {Math.abs(value).toFixed(1)}%
    </td>
  );
}

function CoinLogo({ image, symbol }: { image: string; symbol: string }) {
  const letter = symbol.charAt(0);
  if (!image) {
    return (
      <div
        class="w-6 h-6 rounded-full bg-[--color-border] flex items-center justify-center text-[0.625rem] font-bold text-[--color-text-muted] flex-shrink-0"
        aria-hidden="true"
      >
        {letter}
      </div>
    );
  }
  return (
    <img
      src={image}
      alt={`${symbol} icon`}
      width="24"
      height="24"
      loading="lazy"
      decoding="async"
      class="rounded-full flex-shrink-0"
      style="background: var(--color-border)"
    />
  );
}

function SkeletonRow() {
  return (
    <tr class="border-b border-[--color-border]">
      <td class="px-2 py-3 text-center">
        <div class="skeleton h-3 w-5 mx-auto" />
      </td>
      <td class="px-2 py-3">
        <div class="flex items-center gap-2">
          <div class="skeleton w-6 h-6 rounded-full" />
          <div class="skeleton h-4 w-20" />
        </div>
      </td>
      <td class="px-2 py-3 text-right hidden sm:table-cell">
        <div class="skeleton h-3 w-16 ml-auto" />
      </td>
      <td class="px-2 py-3 text-right hidden lg:table-cell">
        <div class="skeleton h-3 w-12 ml-auto" />
      </td>
      <td class="px-2 py-3 text-right hidden sm:table-cell">
        <div class="skeleton h-3 w-12 ml-auto" />
      </td>
      <td class="px-2 py-3 text-right hidden lg:table-cell">
        <div class="skeleton h-3 w-12 ml-auto" />
      </td>
      <td class="px-2 py-3 text-right hidden md:table-cell">
        <div class="skeleton h-3 w-16 ml-auto" />
      </td>
      <td class="px-2 py-3 text-right hidden md:table-cell">
        <div class="skeleton h-3 w-14 ml-auto" />
      </td>
      <td class="px-2 py-3 hidden lg:table-cell">
        <div class="skeleton h-6 w-[120px] ml-auto" />
      </td>
    </tr>
  );
}

function SortableHeader({
  sortKey,
  currentSort,
  sortDesc,
  onClick,
  children,
  className = "",
  title,
}: {
  sortKey: SortKey;
  currentSort: SortKey;
  sortDesc: boolean;
  onClick: (key: SortKey) => void;
  children: ComponentChildren;
  className?: string;
  title?: string;
}) {
  const isActive = currentSort === sortKey;
  const ariaSortValue = isActive
    ? sortDesc
      ? "descending"
      : "ascending"
    : "none";
  const arrowChar = isActive ? (sortDesc ? " \u25BC" : " \u25B2") : "";
  return (
    <th
      scope="col"
      aria-sort={ariaSortValue}
      title={title}
      class={`px-2 py-2 font-mono text-[0.6875rem] tracking-wider uppercase whitespace-nowrap border-b border-[--color-border] ${className} ${isActive ? "text-[--color-accent]" : "text-[--color-text-muted]"}`}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        class="w-full text-inherit cursor-pointer select-none bg-transparent border-none p-0 font-inherit text-inherit tracking-inherit uppercase"
        style="text-align: inherit"
      >
        {children}
        <span aria-hidden="true">{arrowChar}</span>
      </button>
    </th>
  );
}

export default function CoinListTable({ lang = "en" }: { lang?: "en" | "ko" }) {
  const t = labels[lang] || labels.en;
  const [data, setData] = useState<CoinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("market_cap");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    // Hybrid: load static first (metadata: name, image, sparkline), then overlay live prices
    fetchWithFallback<StatsData>("/coins/stats", STATIC_DATA.coinsStats)
      .then((json) => {
        setData(json.coins || []);
        setGeneratedAt(json.generated || null);
        setLoading(false);
        // Overlay live prices from API
        fetchLiveFirst<StatsData>("/market/live", STATIC_DATA.coinsStats)
          .then((live) => {
            const priceMap = new Map<
              string,
              { price: number; change_24h: number; volume_24h: number }
            >();
            for (const c of live.coins || []) {
              priceMap.set(c.symbol, {
                price: c.price,
                change_24h: c.change_24h,
                volume_24h: c.volume_24h,
              });
            }
            setData((prev) =>
              prev.map((coin) => {
                const lp = priceMap.get(coin.symbol);
                return lp
                  ? {
                      ...coin,
                      price: lp.price,
                      change_24h: lp.change_24h,
                      volume_24h: lp.volume_24h,
                    }
                  : coin;
              }),
            );
            setGeneratedAt(live.generated || json.generated || null);
          })
          .catch(() => {}); // Live price overlay failure is non-critical
      })
      .catch((err) => {
        setError(err.message);
        setGeneratedAt(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div>
        <div class="mb-4">
          <div class="skeleton h-10 w-80 max-w-full rounded-lg" />
        </div>
        <div class="relative overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
          <table
            class="w-full md:min-w-[900px] border-collapse font-mono text-[0.8125rem]"
            aria-busy="true"
          >
            <caption class="sr-only">{t.tableCaption}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  class="px-2 py-2 w-10 border-b border-[--color-border]"
                />
                {[
                  t.coin,
                  t.price,
                  t.h1,
                  t.h24,
                  t.d7,
                  t.mcap,
                  t.volume,
                  t.chart,
                ].map((h, i) => (
                  <th
                    scope="col"
                    key={i}
                    class="px-2 py-2 text-left font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="py-8 text-center">
        <p class="font-mono text-sm text-[--color-red] mb-3">{t.error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchWithFallback<StatsData>("/coins/stats", STATIC_DATA.coinsStats)
              .then((json) => {
                setData(json.coins || []);
                setLoading(false);
              })
              .catch((err) => {
                setError(err.message);
                setLoading(false);
              });
          }}
          class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  const filtered = data.filter((c) => {
    const q = search.toLowerCase();
    const base = c.symbol.endsWith("USDT")
      ? c.symbol.slice(0, -4).toLowerCase()
      : c.symbol.toLowerCase();
    return (
      c.symbol.toLowerCase().includes(q) ||
      base.includes(q) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === "string")
      return sortDesc
        ? (bVal as string).localeCompare(aVal)
        : aVal.localeCompare(bVal as string);
    return sortDesc
      ? (bVal as number) - (aVal as number)
      : (aVal as number) - (bVal as number);
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const pageItems = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDesc(!sortDesc);
    else {
      setSortBy(key);
      setSortDesc(true);
    }
    setPage(0);
  };

  const basePath = lang === "ko" ? "/ko/coins" : "/coins";

  const handleDownloadCsv = () => {
    const headers = [
      t.csvRank,
      t.csvSymbol,
      t.csvName,
      t.csvPrice,
      t.csvH1,
      t.csvH24,
      t.csvD7,
      t.csvMcap,
      t.csvVolume,
    ];
    const rows = sorted.map((coin, i) => [
      i + 1,
      coin.symbol.endsWith("USDT") ? coin.symbol.slice(0, -4) : coin.symbol,
      coin.name || "",
      coin.price,
      coin.change_1h != null ? coin.change_1h.toFixed(2) : null,
      coin.change_24h != null ? coin.change_24h.toFixed(2) : null,
      coin.change_7d != null ? coin.change_7d.toFixed(2) : null,
      coin.market_cap,
      coin.volume_24h,
    ]);
    const csv = generateCSV(headers, rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `pruviq-coins-${dateStr}.csv`);
  };

  return (
    <div class="fade-in">
      {/* Search + CSV download */}
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="coin-search" class="sr-only">
          {t.search}
        </label>
        <input
          id="coin-search"
          type="text"
          placeholder={t.search}
          aria-label={t.search}
          value={search}
          onInput={(e: Event) => {
            setSearch((e.target as HTMLInputElement).value);
            setPage(0);
          }}
          class="w-full max-w-xs px-4 py-2.5 bg-[--color-bg-card] border border-[--color-border] rounded-lg text-[--color-text] font-mono text-sm outline-none focus:border-[--color-accent] transition-colors"
        />
        <a
          href={lang === "ko" ? "/ko/simulate" : "/simulate"}
          class="px-4 py-2.5 rounded-lg font-semibold text-sm no-underline hover:opacity-90 transition-opacity whitespace-nowrap min-h-[44px] inline-flex items-center"
          style="background:var(--color-accent);color:#fff"
        >
          {t.simulateCta} &rarr;
        </a>
        {sorted.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            class="px-3 py-2.5 border border-[--color-border] rounded-lg bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px] whitespace-nowrap"
            title={t.downloadCsv}
          >
            {t.downloadCsv}
          </button>
        )}
      </div>

      {generatedAt && (
        <div class="text-[--color-text-muted] text-xs mb-2">
          {t.dataAsOf} {new Date(generatedAt).toLocaleString()}
        </div>
      )}

      {/* Table */}
      <div class="relative overflow-x-auto border border-[--color-border] rounded-xl bg-[--color-bg-card]">
        <table class="w-full md:min-w-[900px] border-collapse font-mono text-[0.8125rem]">
          <caption class="sr-only">{t.tableCaption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                class="px-2 py-2 text-center font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] w-10 cursor-default select-none hidden sm:table-cell"
              >
                #
              </th>
              <SortableHeader
                sortKey="symbol"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-left min-w-[160px]"
              >
                {t.coin}
              </SortableHeader>
              <SortableHeader
                sortKey="price"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-right hidden sm:table-cell"
              >
                {t.price}
              </SortableHeader>
              <SortableHeader
                sortKey="change_1h"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-right hidden lg:table-cell"
              >
                {t.h1}
              </SortableHeader>
              <SortableHeader
                sortKey="change_24h"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-right hidden sm:table-cell"
              >
                {t.h24}
              </SortableHeader>
              <SortableHeader
                sortKey="change_7d"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-right hidden lg:table-cell"
              >
                {t.d7}
              </SortableHeader>
              <SortableHeader
                sortKey="market_cap"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-right hidden md:table-cell"
              >
                {t.mcap}
              </SortableHeader>
              <SortableHeader
                sortKey="volume_24h"
                currentSort={sortBy}
                sortDesc={sortDesc}
                onClick={handleSort}
                className="text-right hidden md:table-cell"
              >
                {t.volume}
              </SortableHeader>
              <th
                scope="col"
                class="px-2 py-2 text-center font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] hidden lg:table-cell cursor-default select-none w-[140px]"
              >
                {t.chart}
              </th>
              <th
                scope="col"
                class="px-2 py-2 text-center font-mono text-[0.6875rem] tracking-wider uppercase border-b border-[--color-border] text-[--color-text-muted] hidden lg:table-cell cursor-default select-none"
              >
                TEST
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  class="py-8 text-center text-[--color-text-muted]"
                >
                  {t.noResults}
                </td>
              </tr>
            )}
            {pageItems.map((coin, i) => {
              const rank = page * PER_PAGE + i + 1;
              const slug = coin.symbol.toLowerCase();
              const coinUrl = `${basePath}/${slug}`;
              const sparkPositive =
                (coin.change_7d ?? coin.change_24h ?? 0) >= 0;

              return (
                <tr
                  key={coin.symbol}
                  tabIndex={0}
                  role="link"
                  aria-label={`${coin.name} (${coin.symbol.replace("USDT", "")}) — view detail`}
                  onClick={(e: MouseEvent) => {
                    if (!(e.target as HTMLElement).closest("a"))
                      window.location.href = coinUrl;
                  }}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (
                      (e.key === "Enter" || e.key === " ") &&
                      !(e.target as HTMLElement).closest("a")
                    ) {
                      e.preventDefault();
                      window.location.href = coinUrl;
                    }
                  }}
                  class="cursor-pointer border-b border-[--color-border] row-hover"
                >
                  <td class="px-2 py-2.5 text-center text-[--color-text-muted] text-[0.6875rem] hidden sm:table-cell">
                    {rank}
                  </td>

                  <td class="px-2 py-3 sm:py-2.5 whitespace-nowrap">
                    <a
                      href={coinUrl}
                      class="flex items-center gap-2.5 hover:text-[--color-accent] transition-colors"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <CoinLogo image={coin.image} symbol={coin.symbol} />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="font-semibold">
                            {coin.symbol.endsWith("USDT")
                              ? coin.symbol.slice(0, -4)
                              : coin.symbol}
                          </span>
                          {coin.name && (
                            <span class="text-[--color-text-muted] text-[0.6875rem] hidden sm:inline">
                              {coin.name}
                            </span>
                          )}
                        </div>
                        {/* Mobile: coin name subtitle */}
                        {coin.name && (
                          <span class="text-[--color-text-muted] text-[0.625rem] sm:hidden block truncate">
                            {coin.name}
                          </span>
                        )}
                      </div>
                      {/* Mobile: price + change badge on right side */}
                      <div class="flex flex-col items-end gap-0.5 sm:hidden ml-auto">
                        <span class="text-sm font-semibold tabular-nums">
                          ${formatPrice(coin.price)}
                        </span>
                        <span
                          class={`text-[0.625rem] tabular-nums font-bold px-1.5 py-0.5 rounded ${(coin.change_24h ?? 0) >= 0 ? "text-[--color-up] bg-[--color-up]/10" : "text-[--color-down] bg-[--color-down]/10"}`}
                        >
                          {(coin.change_24h ?? 0) >= 0 ? "+" : ""}
                          {(coin.change_24h ?? 0).toFixed(1)}%
                        </span>
                      </div>
                    </a>
                  </td>

                  <td class="px-2 py-2.5 text-right tabular-nums hidden sm:table-cell">
                    ${formatPrice(coin.price)}
                  </td>
                  <ChangeCell
                    value={coin.change_1h}
                    className="hidden lg:table-cell"
                  />
                  <ChangeCell
                    value={coin.change_24h}
                    className="hidden sm:table-cell"
                  />
                  <ChangeCell
                    value={coin.change_7d}
                    className="hidden lg:table-cell"
                  />
                  <td class="px-2 py-2.5 text-right text-[--color-text-muted] hidden md:table-cell tabular-nums">
                    {formatMarketCap(coin.market_cap)}
                  </td>
                  <td class="px-2 py-2.5 text-right text-[--color-text-muted] hidden md:table-cell tabular-nums">
                    {formatVolume(coin.volume_24h)}
                  </td>

                  <td class="px-2 py-2.5 hidden lg:table-cell">
                    {coin.sparkline_7d && coin.sparkline_7d.length > 1 ? (
                      <MiniSparkline
                        data={coin.sparkline_7d}
                        width={120}
                        height={32}
                        positive={sparkPositive}
                      />
                    ) : (
                      <span class="text-[--color-text-muted]">-</span>
                    )}
                  </td>
                  <td class="px-2 py-2.5 hidden lg:table-cell text-center">
                    <a
                      href={`${lang === "ko" ? "/ko" : ""}/simulate?coin=${coin.symbol}`}
                      onClick={(e: MouseEvent) => e.stopPropagation()}
                      class="text-xs font-mono text-[--color-accent] hover:underline"
                    >
                      Test &rarr;
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div class="flex justify-between items-center mt-4 font-mono text-xs">
          <span class="text-[--color-text-muted]">
            {t.showing(
              page * PER_PAGE + 1,
              Math.min((page + 1) * PER_PAGE, sorted.length),
              sorted.length,
            )}
          </span>
          <div class="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label={t.prevPage}
              class={`px-3 py-1.5 border border-[--color-border] rounded-md bg-transparent font-mono text-xs transition-colors min-h-12 min-w-12 ${page === 0 ? "text-[--color-text-muted] cursor-default" : "text-[--color-text] hover:border-[--color-accent] cursor-pointer"}`}
            >
              &lt;
            </button>
            <span class="px-2 py-1.5 text-[--color-text-muted]">
              {page + 1}/{totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t.nextPage}
              class={`px-3 py-1.5 border border-[--color-border] rounded-md bg-transparent font-mono text-xs transition-colors min-h-12 min-w-12 ${page >= totalPages - 1 ? "text-[--color-text-muted] cursor-default" : "text-[--color-text] hover:border-[--color-accent] cursor-pointer"}`}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
