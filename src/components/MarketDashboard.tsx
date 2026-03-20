import { useState, useEffect } from "preact/hooks";
import { changeColor, timeAgo } from "../utils/format";
import { useMarketLive } from "../hooks/useMarketLive";
import { useMarketOverview } from "../hooks/useMarketOverview";
import { useNews } from "../hooks/useNews";
import { useMacro } from "../hooks/useMacro";

const labels = {
  en: {
    tag: "MARKET OVERVIEW",
    title: "Market Dashboard",
    fearGreed: "Fear & Greed",
    totalMcap: "Total Market Cap",
    btcDom: "BTC Dominance",
    volume24h: "24h Volume",
    latestNews: "Latest News",
    cryptoNews: "Crypto",
    macroNews: "Macro",
    loading: "Loading market data...",
    error: "Failed to load market data.",
    newsLoading: "Loading news...",
    newsError: "Failed to load news.",
    updated: "Updated",
    disclaimer:
      "Market data is for informational purposes only. Not financial advice. Prices update every 30s. Market data refreshed every 5 min.",
    readMore: "Read more",
    searchNews: "Search news...",
    allSources: "All",
    lastUpdated: "Last updated",
    ago: "ago",
    economicCalendar: "Economic Calendar",
    calendarNote: "Powered by TradingView",
    macroTitle: "Macro Indicators",
    macroNote: "Federal Reserve (FRED)",
    macroLoading: "Loading macro data...",
    macroError: "Macro data unavailable",
    macroPrevious: "prev",
    ctaTitle: "Test a Strategy",
    ctaDesc: "Use our free strategy builder to backtest on {coins}+ coins.",
    ctaButton: "Try Simulator",
    staleWarning: "Data may be delayed",
    staleWarningSevere: "Market data is outdated — live API fallback active",
    showMore: "Show all",
    showLess: "Show less",
    showMoreNews: "Show more news",
    showLessNews: "Show less",
    retry: "Retry",
  },
  ko: {
    tag: "시장 현황",
    title: "시장 대시보드",
    fearGreed: "공포/탐욕 지수",
    totalMcap: "총 시가총액",
    btcDom: "BTC 도미넌스",
    volume24h: "24시간 거래량",
    latestNews: "최신 뉴스",
    cryptoNews: "크립토",
    macroNews: "매크로",
    loading: "시장 데이터 로딩 중...",
    error: "시장 데이터 로딩 실패.",
    newsLoading: "뉴스 로딩 중...",
    newsError: "뉴스 로딩 실패.",
    updated: "업데이트",
    disclaimer:
      "시장 데이터는 정보 제공 목적으로만 제공됩니다. 투자 조언이 아닙니다. 가격 30초 갱신. 시장 데이터 5분 갱신.",
    readMore: "자세히 보기",
    searchNews: "뉴스 검색...",
    allSources: "전체",
    lastUpdated: "마지막 업데이트",
    ago: "전",
    economicCalendar: "경제 캘린더",
    calendarNote: "TradingView 제공",
    ctaTitle: "전략 테스트",
    ctaDesc: "{coins}개 이상의 코인에서 무료 전략 빌더로 백테스트하세요.",
    macroTitle: "거시경제 지표",
    macroNote: "미국 연방준비제도 (FRED)",
    macroLoading: "매크로 데이터 로딩 중...",
    macroError: "매크로 데이터 없음",
    macroPrevious: "이전",
    ctaButton: "시뮬레이터 시작",
    staleWarning: "데이터가 지연될 수 있습니다",
    staleWarningSevere: "시장 데이터가 오래됨 — 라이브 API 대체 중",
    showMore: "전체 보기",
    showLess: "접기",
    showMoreNews: "더 보기",
    showLessNews: "접기",
    retry: "다시 시도",
  },
};

/* --- Skeleton Components --- */

function SkeletonCard() {
  return (
    <div class="border border-[--color-border] rounded-lg p-5 bg-[--color-bg-card]">
      <div class="skeleton h-3 w-20 mb-3" />
      <div class="skeleton h-7 w-28 mb-2" />
      <div class="skeleton h-3 w-14" />
    </div>
  );
}

function SkeletonPriceBar() {
  return (
    <div class="flex gap-4 flex-wrap mb-4">
      <div class="flex-1 min-w-[200px] border border-[--color-border] rounded-lg p-3 bg-[--color-bg-card] flex items-center gap-3">
        <div class="skeleton h-4 w-10" />
        <div class="skeleton h-6 w-24" />
        <div class="skeleton h-4 w-16" />
      </div>
      <div class="flex-1 min-w-[200px] border border-[--color-border] rounded-lg p-3 bg-[--color-bg-card] flex items-center gap-3">
        <div class="skeleton h-4 w-10" />
        <div class="skeleton h-6 w-24" />
        <div class="skeleton h-4 w-16" />
      </div>
    </div>
  );
}

function SkeletonNews() {
  return (
    <div>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          class="px-4 py-3 border-b border-[--color-border] last:border-0"
        >
          <div class="skeleton h-4 w-3/4 mb-2" />
          <div class="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/* --- Data Components --- */

function StatCard({
  label,
  value,
  sub,
  color,
  style,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  style?: Record<string, string>;
}) {
  return (
    <div
      class="border border-[--color-border] rounded-lg p-4 bg-[--color-bg-card] card-hover"
      style={style}
    >
      <div class="text-[11px] text-[--color-text-muted] uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div
        class="text-2xl font-bold font-mono"
        style={{ color: color || "var(--color-text)" }}
      >
        {value}
      </div>
      {sub && <div class="text-xs text-[--color-text-muted] mt-1">{sub}</div>}
    </div>
  );
}

function ExpandButton({
  expanded,
  onClick,
  expandLabel,
  collapseLabel,
}: {
  expanded: boolean;
  onClick: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <div class="text-center py-2">
      <button
        onClick={onClick}
        class="inline-flex items-center gap-1.5 text-xs text-[--color-accent] px-4 py-1.5 rounded-md border border-[--color-border] bg-[--color-bg-hover] cursor-pointer hover:border-[--color-accent] transition-colors"
      >
        <span>{expanded ? collapseLabel : expandLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
    </div>
  );
}

const CRYPTO_SOURCES = [
  "CoinDesk",
  "CoinTelegraph",
  "Decrypt",
  "Bitcoin Magazine",
];
const MACRO_SOURCES = ["Bloomberg", "CNBC Economy", "MarketWatch"];

// Fear & Greed gauge scale labels (i18n)
const FG_SCALE = [
  {
    min: 0,
    max: 25,
    label: "Extreme Fear",
    labelKo: "극단적 공포",
    color: "rgb(234,57,67)",
  },
  { min: 25, max: 50, label: "Fear", labelKo: "공포", color: "rgb(255,140,0)" },
  {
    min: 50,
    max: 75,
    label: "Greed",
    labelKo: "탐욕",
    color: "rgb(144,238,144)",
  },
  {
    min: 75,
    max: 100,
    label: "Extreme Greed",
    labelKo: "극단적 탐욕",
    color: "rgb(22,163,74)",
  },
];

function getFGSegment(value: number) {
  return FG_SCALE.find((s) => value >= s.min && value < s.max) || FG_SCALE[0];
}

export default function MarketDashboard({
  lang = "en",
}: {
  lang?: "en" | "ko";
}) {
  const l = labels[lang] || labels.en;
  const [coinsCount, setCoinsCount] = useState("569");

  useEffect(() => {
    fetch("/data/site-stats.json")
      .then((r) => r.json())
      .then((d: { coins_analyzed?: number }) => {
        if (d.coins_analyzed) setCoinsCount(String(d.coins_analyzed));
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  // 4 independent hooks — each polls at its own interval
  const {
    btcPrice,
    btcChange,
    ethPrice,
    ethChange,
    flash,
    generated,
    error: liveErr,
    retry: retryLive,
  } = useMarketLive();
  const { market, error: marketErr, retry: retryMarket } = useMarketOverview();
  const { news, error: newsErr, retry: retryNews } = useNews();
  const { macro, error: macroErr } = useMacro();

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [newsTab, setNewsTab] = useState<"crypto" | "macro">("crypto");
  const [newsExpanded, setNewsExpanded] = useState(false);

  // Live "updated X ago" counter (based on live price generated timestamp)
  const [refreshAgo, setRefreshAgo] = useState("");
  const [isDataStale, setIsDataStale] = useState(false);
  const [isDataVeryStale, setIsDataVerySale] = useState(false);
  useEffect(() => {
    if (!generated) return;
    const genTime = new Date(generated).getTime();
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - genTime) / 1000));
      setIsDataStale(sec > 1800); // stale if >30 min old
      setIsDataVerySale(sec > 3600); // very stale if >1 hour old
      if (sec < 60) setRefreshAgo(`${sec}s`);
      else if (sec < 3600) setRefreshAgo(`${Math.floor(sec / 60)}m`);
      else {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        setRefreshAgo(m > 0 ? `${h}h ${m}m` : `${h}h`);
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [generated]);

  // Determine if we have enough data to render (either live prices or market overview)
  const hasData = btcPrice > 0 || market;
  const hasError = liveErr && marketErr;

  const activeNewsSources =
    newsTab === "crypto" ? CRYPTO_SOURCES : MACRO_SOURCES;

  const filteredNews =
    news?.items.filter((item) => {
      const itemCat =
        item.category ||
        (MACRO_SOURCES.includes(item.source) ? "macro" : "crypto");
      if (itemCat !== newsTab) return false;
      if (sourceFilter && item.source !== sourceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.summary || "").toLowerCase().includes(q)
        );
      }
      return true;
    }) ?? [];

  // Use live prices (30s) with fallback to market overview (5min)
  const displayBtcPrice = btcPrice || market?.btc_price || 0;
  const displayBtcChange = btcPrice ? btcChange : (market?.btc_change_24h ?? 0);
  const displayEthPrice = ethPrice || market?.eth_price || 0;
  const displayEthChange = ethPrice ? ethChange : (market?.eth_change_24h ?? 0);

  // Display helpers
  const totalMcapDisplay =
    market && market.total_market_cap_b
      ? `$${market.total_market_cap_b.toFixed(0)}B`
      : "—";
  const btcDomDisplay =
    market && market.btc_dominance ? `${market.btc_dominance}%` : "—";
  const volume24hDisplay =
    market && market.total_volume_24h_b
      ? `$${market.total_volume_24h_b.toFixed(0)}B`
      : "—";

  // Fear & Greed gauge
  const fgSegment = market
    ? getFGSegment(market.fear_greed_index)
    : FG_SCALE[0];
  const fgPct = market
    ? Math.max(0, Math.min(100, market.fear_greed_index))
    : 0;

  return (
    <div class="max-w-[1100px] mx-auto">
      {/* Loading skeleton */}
      {!hasData && !hasError && (
        <div>
          <SkeletonPriceBar />
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {hasError && (
        <div class="text-center py-10">
          <p class="font-mono text-sm text-[--color-red] mb-3">{l.error}</p>
          <button
            onClick={() => {
              retryLive();
              retryMarket();
            }}
            class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
          >
            {l.retry}
          </button>
        </div>
      )}

      {hasData && (
        <div class="fade-in">
          {/* Staleness warning */}
          {isDataStale && (
            <div
              class={`mb-4 px-4 py-2.5 rounded-lg border text-center ${isDataVeryStale ? "border-red-500/30 bg-red-500/10" : "border-yellow-500/30 bg-yellow-500/10"}`}
            >
              <span
                class={`text-xs font-mono ${isDataVeryStale ? "text-red-400" : "text-yellow-400"}`}
              >
                ⚠ {isDataVeryStale ? l.staleWarningSevere : l.staleWarning} (
                {refreshAgo})
              </span>
            </div>
          )}
          {/* BTC + ETH Price Bar — 30s live refresh */}
          <div class="flex gap-4 flex-wrap mb-4">
            <div
              class={`flex items-center gap-3 border border-[--color-border] rounded-lg py-3 px-5 bg-[--color-bg-card] flex-1 min-w-[200px] ${flash.btc}`}
            >
              <span class="text-sm font-semibold text-[--color-btc]">BTC</span>
              <span class="text-xl font-bold font-mono text-[--color-text]">
                $
                {displayBtcPrice.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span
                class="text-sm font-semibold font-mono"
                style={{ color: changeColor(displayBtcChange) }}
              >
                {displayBtcChange > 0 ? "+" : ""}
                {displayBtcChange.toFixed(2)}%
              </span>
            </div>
            <div
              class={`flex items-center gap-3 border border-[--color-border] rounded-lg py-3 px-5 bg-[--color-bg-card] flex-1 min-w-[200px] ${flash.eth}`}
            >
              <span class="text-sm font-semibold text-[--color-eth]">ETH</span>
              <span class="text-xl font-bold font-mono text-[--color-text]">
                $
                {displayEthPrice.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span
                class="text-sm font-semibold font-mono"
                style={{ color: changeColor(displayEthChange) }}
              >
                {displayEthChange > 0 ? "+" : ""}
                {displayEthChange.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Stat Cards — 5min market overview refresh */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {/* Fear & Greed with enhanced gauge */}
            {market ? (
              <div
                class="border border-[--color-border] rounded-lg p-4 bg-[--color-bg-card] card-hover"
                style={{ backgroundColor: `${fgSegment.color}10` }}
              >
                <div class="text-[11px] text-[--color-text-muted] uppercase tracking-wider mb-1.5">
                  {l.fearGreed}
                </div>
                <div class="flex items-baseline gap-1.5">
                  <span
                    class="text-2xl font-bold font-mono"
                    style={{ color: fgSegment.color }}
                  >
                    {market.fear_greed_index}
                  </span>
                  <span class="text-sm font-mono text-[--color-text-muted]">
                    / 100
                  </span>
                </div>

                {/* Gauge bar */}
                <div class="mt-3 mb-2">
                  <div
                    class="w-full bg-[--color-bg-hover] rounded-full overflow-hidden"
                    style={{ height: "8px" }}
                    role="img"
                    aria-label={`Fear and Greed gauge ${market.fear_greed_index} out of 100`}
                  >
                    <div
                      style={{
                        width: `${fgPct}%`,
                        backgroundColor: fgSegment.color,
                        height: "8px",
                      }}
                      class="rounded-full transition-all duration-500"
                    />
                  </div>
                  {/* Scale markers */}
                  <div class="flex justify-between mt-1">
                    <span class="text-[9px] text-[--color-text-muted] font-mono">
                      0
                    </span>
                    <span class="text-[9px] text-[--color-text-muted] font-mono">
                      25
                    </span>
                    <span class="text-[9px] text-[--color-text-muted] font-mono">
                      50
                    </span>
                    <span class="text-[9px] text-[--color-text-muted] font-mono">
                      75
                    </span>
                    <span class="text-[9px] text-[--color-text-muted] font-mono">
                      100
                    </span>
                  </div>
                </div>

                <div
                  class="text-xs font-semibold"
                  style={{ color: fgSegment.color }}
                >
                  {lang === "ko" ? fgSegment.labelKo : market.fear_greed_label}
                </div>
              </div>
            ) : (
              <SkeletonCard />
            )}

            <StatCard label={l.totalMcap} value={totalMcapDisplay} />
            <StatCard label={l.btcDom} value={btcDomDisplay} />
            <StatCard label={l.volume24h} value={volume24hDisplay} />
          </div>

          {/* Macro Economic Indicators — 30min refresh */}
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden mb-6">
            <div class="px-4 py-3 border-b border-[--color-border] flex items-center justify-between">
              <span class="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">
                {l.macroTitle}
              </span>
              <span class="text-[0.6875rem] text-[--color-text-muted] opacity-60">
                {l.macroNote}
              </span>
            </div>
            {!macro && !macroErr && (
              <div class="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} class="p-3 bg-[--color-bg-hover] rounded-lg">
                    <div class="skeleton h-3 w-24 mb-2" />
                    <div class="skeleton h-5 w-16" />
                  </div>
                ))}
              </div>
            )}
            {macroErr && (
              <div class="p-4 text-center text-[--color-text-muted] text-xs">
                {l.macroError}
              </div>
            )}
            {macro && macro.indicators.length > 0 && (
              <div class="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {macro.indicators.map((ind) => {
                  const delta =
                    ind.change ??
                    (ind.previous != null ? ind.value - ind.previous : null);
                  const deltaColor =
                    delta != null
                      ? delta >= 0
                        ? "text-[--color-up]"
                        : "text-[--color-down]"
                      : "";
                  const arrow =
                    delta != null ? (delta >= 0 ? "\u25B2" : "\u25BC") : "";
                  const fmtValue =
                    ind.value >= 1000
                      ? ind.value.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                      : ind.value.toFixed(2);
                  const suffix = ind.unit === "%" ? "%" : "";
                  return (
                    <div
                      key={ind.id}
                      class="p-2 sm:p-3 bg-[--color-bg-hover] rounded-lg"
                    >
                      <div
                        class="text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider mb-1 truncate"
                        title={ind.name}
                      >
                        {ind.name}
                      </div>
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-sm sm:text-lg font-bold font-mono tabular-nums">
                          {ind.unit === "USD" ? "$" : ""}
                          {fmtValue}
                          {suffix}
                        </span>
                        {delta != null && (
                          <span
                            class={`text-[0.625rem] font-mono ${deltaColor}`}
                          >
                            <span aria-hidden="true">{arrow}</span>{" "}
                            {Math.abs(delta).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div class="text-[0.5625rem] text-[--color-text-muted] mt-0.5">
                        {ind.source} · {ind.updated}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TradingView Economic Calendar Widget */}
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden mb-6">
            <div class="px-4 py-3 border-b border-[--color-border] flex items-center justify-between">
              <span class="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">
                {l.economicCalendar}
              </span>
              <span class="text-[0.6875rem] text-[--color-text-muted] opacity-60">
                {l.calendarNote}
              </span>
            </div>
            <div class="w-full h-[300px] md:h-[400px] relative">
              {/* Loading placeholder — shown until iframe paints */}
              <div
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[--color-text-muted] text-xs font-mono pointer-events-none"
                id="cal-placeholder"
              >
                <span class="animate-spin inline-block w-5 h-5 border-2 border-[--color-accent] border-t-transparent rounded-full" />
                Loading economic calendar...
              </div>
              <iframe
                src={`https://s.tradingview.com/embed-widget/events/?locale=${lang === "ko" ? "kr" : "en"}#%7B%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22width%22%3A%22100%25%22%2C%22height%22%3A%22100%25%22%2C%22importanceFilter%22%3A%220%2C1%22%7D`}
                title={l.economicCalendar}
                class="w-full h-full border-0 relative z-10"
                loading="lazy"
                onLoad={() =>
                  document.getElementById("cal-placeholder")?.remove()
                }
              />
            </div>
          </div>

          {/* News Feed — 5min refresh */}
          <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] overflow-hidden mb-6">
            <div class="px-4 py-3 border-b border-[--color-border] flex flex-wrap items-center gap-2.5">
              <span class="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mr-auto">
                {l.latestNews}
              </span>

              {/* Crypto / Macro tab toggle */}
              <div class="flex rounded-md overflow-hidden border border-[--color-border]">
                <button
                  onClick={() => {
                    setNewsTab("crypto");
                    setSourceFilter("");
                  }}
                  class={`px-3 py-1 text-[0.6875rem] font-semibold cursor-pointer border-none transition-colors min-h-[36px] ${
                    newsTab === "crypto"
                      ? ""
                      : "bg-[--color-bg-hover] text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                  style={
                    newsTab === "crypto"
                      ? { background: "var(--color-accent)", color: "#fff" }
                      : undefined
                  }
                >
                  {l.cryptoNews}
                </button>
                <button
                  onClick={() => {
                    setNewsTab("macro");
                    setSourceFilter("");
                  }}
                  class={`px-3 py-1 text-[0.6875rem] font-semibold cursor-pointer border-none transition-colors min-h-[36px] ${
                    newsTab === "macro"
                      ? ""
                      : "bg-[--color-bg-hover] text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                  style={
                    newsTab === "macro"
                      ? { background: "var(--color-accent)", color: "#fff" }
                      : undefined
                  }
                >
                  {l.macroNews}
                </button>
              </div>

              <input
                type="text"
                placeholder={l.searchNews}
                value={searchQuery}
                onInput={(e: Event) =>
                  setSearchQuery((e.target as HTMLInputElement).value)
                }
                class="bg-[--color-bg-hover] border border-[--color-border] rounded-md px-2.5 py-1 text-xs text-[--color-text] outline-none w-full sm:w-44 font-sans focus:border-[--color-accent] transition-colors"
              />
              <div class="flex flex-wrap gap-1">
                <button
                  onClick={() => setSourceFilter("")}
                  aria-pressed={sourceFilter === ""}
                  class={`px-2 py-1 text-[0.6875rem] rounded font-semibold cursor-pointer border-none transition-colors min-h-[44px] ${
                    !sourceFilter
                      ? ""
                      : "bg-[--color-bg-hover] text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                  style={
                    !sourceFilter
                      ? { background: "var(--color-accent)", color: "#fff" }
                      : undefined
                  }
                >
                  {l.allSources}
                </button>
                {activeNewsSources.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(sourceFilter === s ? "" : s)}
                    aria-pressed={sourceFilter === s}
                    class={`px-2 py-1 text-[0.6875rem] rounded font-semibold cursor-pointer border-none whitespace-nowrap transition-colors min-h-[44px] ${
                      sourceFilter === s
                        ? ""
                        : "bg-[--color-bg-hover] text-[--color-text-muted] hover:text-[--color-text]"
                    }`}
                    style={
                      sourceFilter === s
                        ? { background: "var(--color-accent)", color: "#fff" }
                        : undefined
                    }
                  >
                    {s
                      .replace("Bitcoin Magazine", "BTC Mag")
                      .replace("CNBC Economy", "CNBC")}
                  </button>
                ))}
              </div>
            </div>

            {!news && !newsErr && <SkeletonNews />}
            {newsErr && (
              <div class="text-center py-8">
                <p class="font-mono text-sm text-[--color-red] mb-3">
                  {l.newsError}
                </p>
                <button
                  onClick={retryNews}
                  class="px-4 py-2 rounded-lg border border-[--color-border] bg-[--color-bg-card] text-[--color-text] font-mono text-sm cursor-pointer hover:border-[--color-accent] transition-colors min-h-[44px]"
                >
                  {l.retry}
                </button>
              </div>
            )}
            {news && filteredNews.length > 0 && (
              <div class="fade-in">
                {(newsExpanded ? filteredNews : filteredNews.slice(0, 5)).map(
                  (item, i) => (
                    <a
                      key={`${item.source}-${i}`}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-3 border-b border-[--color-border] last:border-0 no-underline text-inherit row-hover"
                    >
                      <div class="flex items-start gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-[--color-text] leading-snug mb-1 truncate">
                            {item.title}
                          </div>
                          {item.summary && (
                            <div class="text-xs text-[--color-text-muted] leading-snug truncate">
                              {item.summary}
                            </div>
                          )}
                        </div>
                        <div class="shrink-0 text-right">
                          <div class="text-[0.6875rem] text-[--color-accent] font-semibold tracking-wide">
                            {item.source}
                          </div>
                          <div class="text-[0.6875rem] text-[--color-text-muted] mt-0.5">
                            {timeAgo(item.published)}
                          </div>
                        </div>
                      </div>
                    </a>
                  ),
                )}

                {filteredNews.length > 5 && (
                  <ExpandButton
                    expanded={newsExpanded}
                    onClick={() => setNewsExpanded((e) => !e)}
                    expandLabel={l.showMoreNews}
                    collapseLabel={l.showLessNews}
                  />
                )}
              </div>
            )}
            {news && filteredNews.length === 0 && (
              <div class="text-center py-8 text-[--color-text-muted] text-[13px]">
                {lang === "ko" ? "검색 결과가 없습니다." : "No results found."}
              </div>
            )}
          </div>

          {/* CTA */}
          <div class="mt-8 p-6 bg-[--color-bg-card] border border-[--color-border] rounded-xl">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 class="font-bold text-sm mb-1">{l.ctaTitle}</h3>
                <p class="text-[--color-text-muted] text-xs">
                  {l.ctaDesc.replace("{coins}", coinsCount)}
                </p>
              </div>
              <a
                href={lang === "ko" ? "/ko/simulate" : "/simulate"}
                class="shrink-0 px-5 py-2.5 rounded-lg font-semibold text-sm no-underline hover:opacity-90 transition-opacity whitespace-nowrap"
                style="background:var(--color-accent);color:#fff"
              >
                {l.ctaButton} &rarr;
              </a>
            </div>
          </div>

          {/* Last Updated + Disclaimer */}
          {generated && (
            <p class="text-[11px] text-[--color-text-muted] text-center mt-4 font-mono">
              {l.lastUpdated}: {refreshAgo} {l.ago}
            </p>
          )}
          <p class="text-[11px] text-[--color-text-muted] text-center mt-1 opacity-60">
            {l.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
