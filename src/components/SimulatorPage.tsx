/**
 * SimulatorPage.tsx - PRUVIQ Strategy Simulator
 *
 * Layout: 70:30 split (chart left, conditions right), both 640px
 * Below: Backtest results with CSV/Excel download
 *
 * Split into: ChartPanel, BuilderPanel, ResultsPanel
 */
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import {
  API_BASE_URL as API_URL,
  STATIC_DATA,
  fetchWithFallback,
} from "../config/api";
import { COINS_ANALYZED } from "../config/site-stats";
import type {
  OhlcvBar,
  IndicatorInfo,
  Condition,
  BacktestResult,
  PresetItem,
  CoinOption,
} from "./simulator-types";
import { nextCondId, COLORS, booleanFields } from "./simulator-types";
import ChartPanel from "./ChartPanel";
import BuilderPanel from "./BuilderPanel";
import ResultsPanel from "./ResultsPanel";
import ModeSwitcher, { SIM_MODE_KEY, isValidSimMode } from "./ModeSwitcher";
import type { SimMode } from "./ModeSwitcher";
import QuickTestPanel from "./QuickTestPanel";
import HotStrategies from "./HotStrategies";
import StandardPanel from "./StandardPanel";
import AchievementBadges from "./AchievementBadges";
import LoadingEquityAnimation from "./LoadingEquityAnimation";

// ─── i18n ───
const L = {
  en: {
    title: "Strategy Simulator",
    strategyBuilder: "STRATEGY BUILDER",
    previewChart: "Preview Chart",
    conditions: "Entry Conditions",
    addCondition: "+ Add Condition",
    parameters: "Parameters",
    direction: "Direction",
    sl: "Stop Loss %",
    tp: "Take Profit %",
    maxBars: "Max Hold (h)",
    perCoinUsdt: "Per Coin $",
    leverage: "Leverage",
    compounding: "Compound",
    simple: "Simple",
    dateRange: "Test Period",
    startDate: "Start",
    endDate: "End",
    coins: "Coins",
    allCoins: "All Coins",
    topN: "Top",
    selectCoins: "Select...",
    preset: "Presets",
    indicators: "Indicators",
    timeframe: "Timeframe",
    both: "BOTH",
    customPreset: "Custom",
    recommended: "Recommended",
    allPresetsLabel: (n: number) => `All ${n} presets`,
    hidePresets: "Hide",
    selectAll: "All",
    selectNone: "None",
    selectedOf: (n: number, m: number) => `${n} of ${m} selected`,
    hoursSelected: (n: number) => `${n}h selected`,
    noneSelected: "none",
    indicatorNames: {
      bb: "Bollinger Bands",
      ema: "EMA Trend",
      volume: "Volume Analysis",
      candle: "Candle Pattern",
      atr: "ATR",
      hv: "Historical Volatility",
      rsi: "RSI",
      macd: "MACD",
      stochastic: "Stochastic",
      adx: "ADX",
      price_action: "Price Action",
    } as Record<string, string>,
    run: "Run Backtest",
    runWithCoins: "Simulate on {n} Coins",
    running: "Running...",
    results: "Results",
    noResults: "Run a backtest to see results.",
    noResultsHint:
      "Try Quick Test above — instant results with the top-ranked strategy.",
    exportCsv: "Download CSV",
    exportExcel: "Download Excel",
    trades: "Trade List",
    equity: "Equity Curve",
    summary: "Summary",
    coinsTab: "Per Coin",
    field: "Field",
    op: "Op",
    val: "Value",
    shift: "Candle",
    prev: "Prev",
    curr: "Curr",
    remove: "Remove",
    avoidHours: "Avoid Hours (UTC)",
    short: "SHORT",
    long: "LONG",
    symbol: "Symbol",
    entryTime: "Entry",
    exitTime: "Exit",
    pnl: "PnL %",
    reason: "Reason",
    held: "Bars",
    loading: "Loading...",
    error: "Error",
    retry: "Retry",
    noDataError: "Unable to load chart data. Check API connection.",
    symbolPlaceholder: "Symbol...",
    apiDown: "API unavailable. Using demo mode.",
    disclaimer:
      "Past performance does not guarantee future results. This is not financial advice.",
    simNotes: [
      "No duplicate entries — if a coin already has an open position, new signals for that coin are skipped until it closes.",
      "Fees included — results are net of trading fees (0.04%/side) and funding (0.01%/8h).",
      "Slippage 0.02% per side included — real fills may still differ from simulated prices.",
    ],
    simNotesTitle: "How it works",
    mobile: { chart: "Chart", config: "Settings", results: "Results" },
    mobileIcon: { chart: "📊", config: "⚙️", results: "📋" },
    quickStart: "New to backtesting?",
    quickStartDesc:
      "Click 'BB Squeeze (Verified)' preset above, then hit 'Run Backtest'. Takes ~2 seconds. No signup needed.",
    quickStartCta: "Run BB Squeeze SHORT",
    quickStartDismiss: "I'll build my own",
    lookAheadWarn:
      "C = current candle (incomplete in live). P = previous candle (confirmed). Using C may cause look-ahead bias.",
    modifyRerun: "Modify & Re-run",
    quickAdjust: "Quick Adjust",
    rerun: "Re-run",
    copyLink: "Copy Link",
    linkCopied: "Copied!",
    shareResults: "Share Results",
    saveOnFees: "Save on exchange fees",
    history: "History",
    clearHistory: "Clear",
    compareWith: "Compare",
    run1: "Run 1",
    run2: "Run 2",
    run3: "Run 3",
    validate: "Validate",
    // Parameter tooltips
    slTip:
      "Max loss per trade before auto-exit. e.g., 10% = closes if price moves 10% against you",
    tpTip:
      "Target profit per trade. e.g., 8% = auto-closes when 8% profit reached",
    maxBarsTip: "Max holding period in candles. 48 = 48 hours for 1H candles",
    leverageTip:
      "Position size multiplier. 5x means $60 acts like $300. Higher = higher risk",
    perCoinUsdtTip: "Investment amount per coin position",
    topNCoinsHint: "Top coins by data availability (most candle history)",
    topCoinsPlaceholder: "Number of top coins",
    searchCoinsPlaceholder: "Search coins...",
    // Results guide
    resultsGuide: "How to read results:",
    resultsGuideWr: "Win Rate > 50%: Good",
    resultsGuidePf: "Profit Factor > 1.5: Strong",
    resultsGuideMdd: "Max Drawdown < 20%: Low risk",
    closeGuideAria: "Close guide",
    monthlyReturns: "Monthly Returns",
    pnlDistribution: "PnL Distribution",
    bars: "bars",
    yearlyBreakdown: "Yearly Breakdown",
    equityCurve: "Equity Curve",
    drawdown: "Drawdown",
    maxDrawdown: "Max Drawdown",
    noTradeDetails: "Trade details not available for this backtest type.",
    noCoinData: "No per-coin data available.",
    tradeTableCaption: "Simulated trade details",
    progressLabels: [
      "Preparing data...",
      "Computing indicators...",
      "Finding signals...",
      "Simulating trades...",
      "Building results...",
    ],
    timeoutMsg:
      "Backtest timed out. Large coin sets (100+) can take longer. Try reducing the number of coins or narrowing the date range.",
    rateLimitMsg: "Too many requests. Retrying automatically...",
    retryingIn: "Retrying in {n}s...",
    elapsed: "{n}s",
    estimatedTime: "~{n}s for {c} coins",
    // BuilderPanel direction descriptions
    dirShortDesc: "Profit when price falls",
    dirLongDesc: "Profit when price rises",
    dirBothDesc: "Test SHORT + LONG simultaneously",
    // BuilderPanel capital/compound labels
    capitalLabel: "Capital $",
    compoundLabel: "Compound",
    simpleLabel: "Simple",
    // BuilderPanel compound info (coinLabel injected at render)
    allCoinsLabel: "All Coins",
    compoundInfoTpl: (
      coinLabel: string,
      capital: number,
      lev: number,
      exposure: number,
    ) =>
      `${coinLabel} — $${capital.toLocaleString()} × ${lev}x = $${exposure.toLocaleString()} position, profits compound into next trade`,
    // ResultsPanel strategy verdict
    gradeStrong: "STRONG",
    gradeGood: "GOOD",
    gradeFair: "FAIR",
    gradeWeak: "WEAK",
    strategyLabel: "Strategy:",
    reasonStrong: (pf: string, wr: string, mdd: string) =>
      `PF ${pf}, WR ${wr}%, MDD ${mdd}% — all three metrics strong`,
    reasonGood: (pf: string, wr: string, mdd: string) =>
      `PF ${pf}, WR ${wr}%, MDD ${mdd}% — viable for live use`,
    reasonFairPf: (pf: string) => `PF ${pf} (target: ≥1.1)`,
    reasonFairWr: (wr: string) => `WR ${wr}% (target: ≥50%)`,
    reasonFairSuffix: (weak: string) => `${weak} — consider parameter tuning`,
    reasonWeakPf: (pf: string) => `PF ${pf} (net loss)`,
    reasonWeakMdd: (mdd: string) => `MDD ${mdd}% (excessive drawdown)`,
    reasonWeakWr: (wr: string) => `WR ${wr}% (below 50%)`,
    reasonWeakSuffix: (issue: string) =>
      `${issue} — not recommended for live trading`,
    // ResultHero labels
    heroWinRate: "Win Rate",
    heroPF: "Profit Factor",
    heroMDD: "Max DD",
    // Trade detail expansion
    tradeDirection: "Direction",
    tradeEntryPrice: "Entry Price",
    tradeExitPrice: "Exit Price",
    tradeHoldTime: "Hold Time",
    // Equity chart legend
    legendStrategy: "Strategy",
    legendBtcHold: "BTC Hold",
    // ResultsPanel coins used / shared buttons
    coinsUnit: "coins",
    cumulativePct: "cumulative % — sum of per-coin trades",
    settingsCopied: "Copied!",
    copySettings: "Copy Strategy Settings",
    // ResultsPanel coins tab headers + stats
    coinHeader: "Coin",
    tradesHeader: "Trades",
    winRateHeader: "Win%",
    returnHeader: "Return",
    profitableUnit: "profitable",
    losingUnit: "losing",
    flatUnit: "flat",
    profitableCoinsUnit: "profitable",
  },
  ko: {
    title: "전략 시뮬레이터",
    strategyBuilder: "전략 빌더",
    previewChart: "미리보기 차트",
    conditions: "진입 조건",
    addCondition: "+ 조건 추가",
    parameters: "파라미터",
    direction: "방향",
    sl: "손절 %",
    tp: "익절 %",
    maxBars: "최대 보유 (h)",
    perCoinUsdt: "코인당 $",
    leverage: "레버리지",
    compounding: "복리",
    simple: "단리",
    dateRange: "테스트 기간",
    startDate: "시작",
    endDate: "종료",
    coins: "코인",
    allCoins: "전체",
    topN: "상위",
    selectCoins: "선택...",
    preset: "프리셋",
    indicators: "지표",
    timeframe: "타임프레임",
    both: "BOTH",
    customPreset: "커스텀",
    recommended: "추천",
    allPresetsLabel: (n: number) => `전체 ${n}개 프리셋`,
    hidePresets: "접기",
    selectAll: "전체",
    selectNone: "없음",
    selectedOf: (n: number, m: number) => `${n}/${m} 선택됨`,
    hoursSelected: (n: number) => `${n}시간 선택됨`,
    noneSelected: "없음",
    indicatorNames: {
      bb: "볼린저 밴드",
      ema: "EMA 추세",
      volume: "거래량 분석",
      candle: "캔들 패턴",
      atr: "ATR",
      hv: "과거 변동성",
      rsi: "RSI",
      macd: "MACD",
      stochastic: "스토캐스틱",
      adx: "ADX",
      price_action: "가격 행동",
    } as Record<string, string>,
    run: "백테스트 실행",
    runWithCoins: "{n}개 코인 시뮬레이션",
    running: "실행 중...",
    results: "결과",
    noResults: "백테스트를 실행하면 결과가 표시됩니다.",
    noResultsHint:
      "위의 퀵 테스트를 눌러보세요 — 상위 전략으로 즉시 결과를 확인할 수 있습니다.",
    exportCsv: "CSV 다운로드",
    exportExcel: "Excel 다운로드",
    trades: "거래 목록",
    equity: "수익 곡선",
    summary: "요약",
    coinsTab: "코인별",
    field: "필드",
    op: "연산",
    val: "값",
    shift: "캔들",
    prev: "이전",
    curr: "현재",
    remove: "삭제",
    avoidHours: "제외 시간 (UTC)",
    short: "SHORT",
    long: "LONG",
    symbol: "심볼",
    entryTime: "진입",
    exitTime: "청산",
    pnl: "PnL %",
    reason: "사유",
    held: "보유",
    loading: "로딩 중...",
    error: "에러",
    retry: "다시 시도",
    noDataError: "차트 데이터를 불러올 수 없습니다. API 연결을 확인하세요.",
    symbolPlaceholder: "심볼...",
    apiDown: "API 연결 불가. 데모 모드로 전환합니다.",
    disclaimer:
      "과거 성과가 미래 수익을 보장하지 않습니다. 이것은 투자 조언이 아닙니다.",
    simNotes: [
      "중복 진입 불가 — 코인에 열린 포지션이 있으면 청산될 때까지 새 신호는 무시됩니다.",
      "수수료 포함 — 결과는 거래 수수료(0.04%/편도) + 펀딩(0.01%/8h) 차감 후 순수익입니다.",
      "슬리피지 0.02%/편도 포함 — 실제 체결가는 시뮬레이션과 다를 수 있습니다.",
    ],
    simNotesTitle: "시뮬레이션 안내",
    mobile: { chart: "차트", config: "설정", results: "결과" },
    mobileIcon: { chart: "📊", config: "⚙️", results: "📋" },
    quickStart: "백테스트가 처음이라면?",
    quickStartDesc:
      "위의 'BB Squeeze (검증됨)' 프리셋을 선택하고 '백테스트 실행'을 누르세요. 약 2초면 됩니다. 회원가입 불필요.",
    quickStartCta: "BB Squeeze SHORT 실행",
    quickStartDismiss: "직접 만들기",
    lookAheadWarn:
      "C = 현재 캔들(실거래에서 미완성). P = 이전 캔들(확정됨). C 사용 시 look-ahead bias 위험이 있습니다.",
    modifyRerun: "수정 후 재실행",
    quickAdjust: "빠른 조정",
    rerun: "재실행",
    copyLink: "링크 복사",
    linkCopied: "복사됨!",
    shareResults: "결과 공유하기",
    saveOnFees: "거래소 수수료 절약하기",
    history: "히스토리",
    clearHistory: "초기화",
    compareWith: "비교",
    run1: "실행 1",
    run2: "실행 2",
    run3: "실행 3",
    validate: "검증",
    // Parameter tooltips
    slTip: "거래당 최대 손실 한도. 예: 10%면 불리하게 10% 움직이면 자동 청산",
    tpTip: "거래당 목표 수익률. 예: 8%면 8% 수익 시 자동 익절",
    maxBarsTip: "최대 보유 기간(캔들 수). 1시간봉 기준 48 = 48시간",
    leverageTip: "포지션 배율. 5배면 $60이 $300 효과. 높을수록 위험",
    perCoinUsdtTip: "코인당 투자 금액",
    topNCoinsHint: "데이터 보유량 기준 상위 코인 (캔들 이력 순)",
    topCoinsPlaceholder: "상위 코인 수",
    searchCoinsPlaceholder: "코인 검색...",
    // Results guide
    resultsGuide: "결과 해석 가이드:",
    resultsGuideWr: "승률 > 50%: 양호",
    resultsGuidePf: "Profit Factor > 1.5: 우수",
    resultsGuideMdd: "최대 낙폭 < 20%: 안전",
    closeGuideAria: "가이드 닫기",
    yearlyBreakdown: "연도별 분석",
    equityCurve: "수익 곡선",
    drawdown: "낙폭",
    maxDrawdown: "최대 낙폭",
    noTradeDetails:
      "이 백테스트 유형에서는 개별 거래 내역을 제공하지 않습니다.",
    noCoinData: "코인별 데이터가 없습니다.",
    tradeTableCaption: "시뮬레이션 거래 내역",
    progressLabels: [
      "데이터 준비 중...",
      "지표 계산 중...",
      "신호 탐색 중...",
      "거래 시뮬레이션 중...",
      "결과 생성 중...",
    ],
    timeoutMsg:
      "백테스트가 시간 초과되었습니다. 코인 수가 많으면(100+) 더 오래 걸릴 수 있습니다. 코인 수를 줄이거나 기간을 좁혀보세요.",
    rateLimitMsg: "요청이 많습니다. 자동 재시도 중...",
    retryingIn: "{n}초 후 재시도...",
    elapsed: "{n}초",
    estimatedTime: "~{n}초 ({c}개 코인)",
    // BuilderPanel direction descriptions
    dirShortDesc: "하락 시 수익",
    dirLongDesc: "상승 시 수익",
    dirBothDesc: "SHORT + LONG 동시 테스트",
    // BuilderPanel capital/compound labels
    capitalLabel: "투자 원금 $",
    compoundLabel: "복리",
    simpleLabel: "단리",
    // BuilderPanel compound info
    allCoinsLabel: "전체 코인",
    compoundInfoTpl: (
      coinLabel: string,
      capital: number,
      lev: number,
      exposure: number,
    ) =>
      `${coinLabel} — $${capital.toLocaleString()} × ${lev}x = $${exposure.toLocaleString()} 포지션, 수익이 다음 거래 원금에 누적`,
    // ResultsPanel strategy verdict
    gradeStrong: "강력함",
    gradeGood: "양호함",
    gradeFair: "보통",
    gradeWeak: "위험",
    strategyLabel: "전략 등급:",
    reasonStrong: (pf: string, wr: string, mdd: string) =>
      `PF ${pf}, 승률 ${wr}%, MDD ${mdd}% — 세 지표 모두 우수`,
    reasonGood: (pf: string, wr: string, mdd: string) =>
      `PF ${pf}, 승률 ${wr}%, MDD ${mdd}% — 실사용 가능 수준`,
    reasonFairPf: (pf: string) => `PF ${pf} (목표: 1.1 이상)`,
    reasonFairWr: (wr: string) => `승률 ${wr}% (목표: 50% 이상)`,
    reasonFairSuffix: (weak: string) => `${weak} — 파라미터 조정 권장`,
    reasonWeakPf: (pf: string) => `PF ${pf} (손익 역전)`,
    reasonWeakMdd: (mdd: string) => `MDD ${mdd}% (과도한 낙폭)`,
    reasonWeakWr: (wr: string) => `승률 ${wr}% (50% 미만)`,
    reasonWeakSuffix: (issue: string) => `${issue} — 실거래 비권장`,
    // ResultHero labels
    heroWinRate: "승률",
    heroPF: "수익 팩터",
    heroMDD: "최대 낙폭",
    // Trade detail expansion
    tradeDirection: "방향",
    tradeEntryPrice: "진입가",
    tradeExitPrice: "청산가",
    tradeHoldTime: "보유 시간",
    // Equity chart legend
    legendStrategy: "전략",
    legendBtcHold: "BTC 보유",
    // ResultsPanel coins used / shared buttons
    coinsUnit: "코인",
    cumulativePct: "누적 % — 개별 코인 합산",
    settingsCopied: "복사됨!",
    copySettings: "설정 복사",
    // ResultsPanel coins tab headers + stats
    coinHeader: "코인",
    tradesHeader: "거래",
    winRateHeader: "승률",
    returnHeader: "수익률",
    profitableUnit: "수익",
    losingUnit: "손실",
    flatUnit: "보합",
    profitableCoinsUnit: "수익 코인",
  },
};

// ─── Component ───
interface Props {
  lang?: "en" | "ko";
}

export default function SimulatorPage({ lang = "en" }: Props) {
  const t = L[lang] || L.en;

  // API state
  const [apiReady, setApiReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [coinsLoaded, setCoinsLoaded] = useState(0);

  // Indicator state
  const [availableIndicators, setAvailableIndicators] = useState<
    IndicatorInfo[]
  >([]);
  const [selectedIndicators, setSelectedIndicators] = useState<Set<string>>(
    new Set(["bb", "ema", "volume", "candle"]),
  );
  const [indicatorParams, setIndicatorParams] = useState<
    Record<string, Record<string, number>>
  >({});

  // Conditions — start empty; hint UI in BuilderPanel guides user to add or load a preset
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Params
  const [direction, setDirection] = useState<"short" | "long" | "both">(
    "short",
  );
  const [slPct, setSlPct] = useState(10);
  const [tpPct, setTpPct] = useState(8);
  const [maxBars, setMaxBars] = useState(48);
  const [avoidHours, setAvoidHours] = useState<Set<number>>(
    new Set([2, 3, 10, 20, 21, 22, 23]),
  );

  // Date range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Coin selection
  const [coinMode, setCoinModeRaw] = useState<"all" | "top" | "select">("all");
  const setCoinMode = (mode: "all" | "top" | "select") => {
    setCoinModeRaw(mode);
    if (mode === "all") setSelectedCoins([]);
  };
  const [topN, setTopN] = useState(50);
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [coinSearch, setCoinSearch] = useState("");
  const [allCoins, setAllCoins] = useState<CoinOption[]>([]);

  // Presets
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(
    "bb-squeeze-short",
  );
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  // Fee rate (user-configurable, default 0.05% Binance/OKX taker)
  const [feePct, setFeePct] = useState(0.05);

  // Per-coin USDT + Leverage (compound mode uses total capital)
  const [perCoinUsdt, setPerCoinUsdt] = useState(60);
  const [leverage, setLeverage] = useState(5);
  const [compounding, setCompounding] = useState(false);
  const handleCompoundToggle = (v: boolean) => {
    setCompounding(v);
    setPerCoinUsdt(v ? 1000 : 60); // swap default: total capital vs per-coin
  };

  // Timeframe
  const [timeframe, setTimeframe] = useState<string>("1H");

  // Chart
  const [chartSymbol, setChartSymbol] = useState("BTCUSDT");
  const [chartData, setChartData] = useState<OhlcvBar[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Backtest
  const [isRunning, setIsRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Results tab
  const [resultTab, setResultTab] = useState<
    "summary" | "equity" | "trades" | "coins" | "validate"
  >("summary");

  // Mobile tab
  const [mobileTab, setMobileTab] = useState<"chart" | "config" | "results">(
    "config",
  );
  const scrollPositions = useRef<Record<string, number>>({});

  // 3-Tier Mode
  const [simMode, setSimMode] = useState<SimMode>(() => {
    try {
      const stored = localStorage.getItem(SIM_MODE_KEY);
      return isValidSimMode(stored) ? stored : "quick";
    } catch {
      return "quick";
    }
  });
  const [isFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem(SIM_MODE_KEY);
    } catch {
      return true;
    }
  });

  // Quick Start banner (persists dismissal)
  const [showQuickStart, setShowQuickStart] = useState(() => {
    try {
      return localStorage.getItem("pruviq-quick-start-dismissed") !== "1";
    } catch {
      return true;
    }
  });
  const dismissQuickStart = useCallback(() => {
    setShowQuickStart(false);
    try {
      localStorage.setItem("pruviq-quick-start-dismissed", "1");
    } catch {}
  }, []);

  // History comparison (max 3 results)
  const [history, setHistory] = useState<
    { label: string; result: BacktestResult }[]
  >([]);
  const [showHistory, setShowHistory] = useState(false);

  // Copy link feedback
  const [linkCopied, setLinkCopied] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  // Available fields from selected indicators
  // Fallback order: selected → all loaded → hardcoded base fields
  const BASE_FIELDS = [
    "close",
    "open",
    "high",
    "low",
    "volume",
    "rsi",
    "bb_upper",
    "bb_lower",
    "bb_mid",
    "ema_fast",
    "ema_slow",
    "vol_ratio",
    "bearish",
    "bullish",
    "is_squeeze",
  ];
  const _selectedFields = availableIndicators
    .filter((ind) => selectedIndicators.has(ind.id))
    .flatMap((ind) => ind.fields);
  const _allLoadedFields = availableIndicators.flatMap((ind) => ind.fields);
  const availableFields =
    _selectedFields.length > 0
      ? _selectedFields
      : _allLoadedFields.length > 0
        ? _allLoadedFields
        : BASE_FIELDS;

  // Dynamic coin count based on selection mode
  const currentCoinCount =
    coinMode === "all"
      ? coinsLoaded
      : coinMode === "top"
        ? topN
        : selectedCoins.length;

  // Persist simMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SIM_MODE_KEY, simMode);
    } catch {}
  }, [simMode]);

  // ─── Init: healthcheck + load indicators + coins ───
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Retry health check up to 3× — backend may still be warming up after restart
      let healthOk = false;
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const healthRes = await fetch(`${API_URL}/health`, {
            signal: AbortSignal.timeout(8000),
          });
          if (healthRes.ok) {
            const h = await healthRes.json();
            if (!cancelled) {
              setCoinsLoaded(h.coins_loaded || h.coin_count || 0);
              setApiReady(true);
            }
            healthOk = true;
            break;
          }
        } catch {
          // retry
        }
        if (attempt < 2 && !cancelled) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      if (!healthOk && !cancelled) {
        setDemoMode(true);
      }

      try {
        const data = await fetchWithFallback<
          IndicatorInfo[] | { indicators: IndicatorInfo[] }
        >("/builder/indicators", STATIC_DATA.builderIndicators);
        if (!cancelled)
          setAvailableIndicators(
            Array.isArray(data) ? data : data.indicators || [],
          );
      } catch {}

      try {
        const presetsData = await fetchWithFallback<
          PresetItem[] | { presets: PresetItem[] }
        >("/builder/presets", STATIC_DATA.builderPresets);
        if (!cancelled)
          setPresets(
            Array.isArray(presetsData)
              ? presetsData
              : presetsData.presets || [],
          );
      } catch {}

      try {
        const coinRes = await fetch(`${API_URL}/coins`);
        if (coinRes.ok) {
          const data: CoinOption[] | { coins: CoinOption[] } =
            await coinRes.json();
          if (!cancelled) {
            const arr = Array.isArray(data) ? data : data.coins || [];
            setAllCoins(
              arr.map((c: { symbol?: string } | string) => ({
                symbol: (typeof c === "string" ? c : c.symbol) || "",
              })),
            );
          }
        } else {
          // Fallback: try static coins-stats for a basic symbol list
          try {
            const stats = await fetchWithFallback<{
              coins: Array<{ symbol?: string } | string>;
            }>("/coins/stats", STATIC_DATA.coinsStats);
            if (!cancelled && Array.isArray(stats.coins)) {
              setAllCoins(
                stats.coins.map((c: { symbol?: string } | string) => ({
                  symbol: (typeof c === "string" ? c : c.symbol) || "",
                })),
              );
            }
          } catch {}
        }
      } catch {}
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── URL querystring: read on mount ───
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("sl")) setSlPct(parseFloat(params.get("sl")!) || 10);
      if (params.has("tp")) setTpPct(parseFloat(params.get("tp")!) || 8);
      if (params.has("bars")) setMaxBars(parseInt(params.get("bars")!) || 48);
      if (params.has("dir")) {
        const d = params.get("dir");
        if (d === "short" || d === "long" || d === "both") setDirection(d);
      }
      if (params.has("coins")) setTopN(parseInt(params.get("coins")!) || 50);
      if (params.has("tf")) {
        const tf = params.get("tf")!.toUpperCase();
        if (["1H", "2H", "4H", "6H", "12H", "1D", "1W"].includes(tf))
          setTimeframe(tf);
      }
      if (params.has("start")) {
        setStartDate(params.get("start")!);
      } else {
        // Default to 1-year lookback
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        setStartDate(d.toISOString().slice(0, 10));
      }
      if (params.has("end")) setEndDate(params.get("end")!);
      // Auto-select coin from URL (e.g., from /coins/[symbol] CTA)
      // Supports both ?symbol= and ?coin= for backwards compat
      const symParam = params.get("symbol") || params.get("coin");
      if (symParam) {
        const sym = symParam.toUpperCase();
        setCoinMode("select");
        setSelectedCoins([sym]);
        setChartSymbol(sym);
      }
      // ?strategy= from ranking page → open Standard mode and auto-run
      if (params.has("strategy")) {
        setSimMode("standard");
        // sl/tp/dir already set above from URL params
        // Mark for auto-run once API is ready
        (window as any).__pruviq_pending_strategy = params.get("strategy")!;
      }
      // Store pending preset from URL — applied after presets load
      if (params.has("preset") && !params.has("strategy")) {
        (window as any).__pruviq_pending_preset = params.get("preset")!;
      }
    } catch {}
  }, []);

  // Build shareable URL from current params
  const buildShareUrl = useCallback(() => {
    const url = new URL(window.location.href.split("?")[0]);
    url.searchParams.set("sl", String(slPct));
    url.searchParams.set("tp", String(tpPct));
    url.searchParams.set("bars", String(maxBars));
    url.searchParams.set("dir", direction);
    if (coinMode === "top") url.searchParams.set("coins", String(topN));
    if (startDate) url.searchParams.set("start", startDate);
    if (endDate) url.searchParams.set("end", endDate);
    // OG image params (when result is available)
    if (result) {
      if (activePreset) url.searchParams.set("strategy", activePreset);
      url.searchParams.set("wr", String(result.win_rate));
      url.searchParams.set("pf", String(result.profit_factor));
      url.searchParams.set("ret", String(result.total_return_pct));
      url.searchParams.set("trades", String(result.total_trades));
      url.searchParams.set("mdd", String(result.max_drawdown_pct));
    }
    return url.toString();
  }, [
    slPct,
    tpPct,
    maxBars,
    direction,
    coinMode,
    topN,
    startDate,
    endDate,
    result,
    activePreset,
  ]);

  const copyLink = useCallback(() => {
    const url = buildShareUrl();
    navigator.clipboard
      .writeText(url)
      .then(() => {
        // Update URL without reload
        window.history.replaceState(null, "", url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => {});
  }, [buildShareUrl]);

  // Mobile tab change with scroll position save/restore
  const handleMobileTabChange = useCallback(
    (newTab: typeof mobileTab) => {
      scrollPositions.current[mobileTab] = window.scrollY;
      setMobileTab(newTab);
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositions.current[newTab] || 0);
      });
    },
    [mobileTab],
  );

  // Scroll to builder panel (for Modify & Re-run)
  const scrollToBuilder = useCallback(() => {
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    handleMobileTabChange("config");
  }, [handleMobileTabChange]);

  // Quick Adjust re-run (with changed SL/TP/coins)
  const quickAdjustRerun = useCallback(
    (newSl: number, newTp: number, newTopN: number) => {
      setSlPct(newSl);
      setTpPct(newTp);
      setTopN(newTopN);
      // runBacktest is triggered after state update via a separate effect
    },
    [],
  );

  // ─── Chart loading ───
  const loadChart = useCallback(() => {
    if (!chartSymbol) return;
    setChartLoading(true);
    setChartError(null);

    if (!apiReady) {
      setChartError(
        demoMode
          ? "API unavailable — chart data not available in demo mode"
          : "Waiting for API...",
      );
      setChartLoading(false);
      return;
    }

    fetch(`${API_URL}/ohlcv/${chartSymbol}?limit=500&timeframe=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data || data.bars) {
          setChartData(data.data || data.bars);
          setChartError(null);
        } else {
          setChartError("No chart data returned for " + chartSymbol);
        }
      })
      .catch(() => {
        setChartError("Failed to load chart data");
      })
      .finally(() => {
        setChartLoading(false);
      });
  }, [chartSymbol, apiReady, demoMode, timeframe]);

  useEffect(() => {
    if (!chartSymbol) return;
    // In demo mode, show error immediately
    if (demoMode && !apiReady) {
      setChartError("API unavailable — chart data not available in demo mode");
      setChartData([]);
      return;
    }
    if (!apiReady) return;
    loadChart();
  }, [chartSymbol, apiReady, demoMode, loadChart]);

  // ─── Run backtest ───
  const runBacktest = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgressStep(0);

    if (demoMode) {
      const steps = [300, 400, 500, 200, 100];
      for (let i = 0; i < steps.length; i++) {
        setProgressStep(i);
        await new Promise((r) => setTimeout(r, steps[i]));
      }
      try {
        const demoData = await fetch("/data/demo-backtest-result.json").then(
          (r) => r.json(),
        );
        setResult({ ...demoData, _isDemo: true });
        setResultTab("summary");
        scrollPositions.current[mobileTab] = window.scrollY;
        setMobileTab("results");
      } catch {
        setError("Demo data load failed");
      } finally {
        setIsRunning(false);
      }
      return;
    }

    const indicatorConfigs: Record<string, Record<string, number>> = {};
    for (const id of selectedIndicators) {
      indicatorConfigs[id] = indicatorParams[id] || {};
    }

    const entryConditions = conditions.map((c) => {
      const cond: Record<string, string | number | boolean | undefined> = {
        field: c.field,
        op: c.op,
        shift: c.shift,
      };
      if (c.field2) cond.field2 = c.field2;
      else cond.value = c.value;
      return cond;
    });

    // Convert max_bars (user thinks in hours) to the target timeframe's bar count
    const tfHours: Record<string, number> = {
      "1H": 1,
      "2H": 2,
      "4H": 4,
      "6H": 6,
      "12H": 12,
      "1D": 24,
      "1W": 168,
    };
    const hoursPerBar = tfHours[timeframe] || 1;
    const adjustedMaxBars = Math.max(6, Math.round(maxBars / hoursPerBar));

    const body: Record<
      string,
      | string
      | number
      | boolean
      | number[]
      | string[]
      | Record<string, Record<string, number>>
      | { type: string; conditions: typeof entryConditions }
    > = {
      name: "Custom Strategy",
      direction,
      timeframe,
      indicators: indicatorConfigs,
      entry: { type: "AND", conditions: entryConditions },
      avoid_hours:
        hoursPerBar >= 24 ? [] : Array.from(avoidHours).sort((a, b) => a - b),
      sl_pct: slPct,
      tp_pct: tpPct,
      max_bars: adjustedMaxBars,
      // Compound: 1 coin, user enters total capital = per_coin_usd
      // Simple: user enters per-coin amount directly
      per_coin_usd: perCoinUsdt,
      leverage,
      compounding,
      fee_pct: feePct / 100,
    };

    if (coinMode === "top") body.top_n = topN;
    else if (coinMode === "select" && selectedCoins.length > 0)
      body.symbols = selectedCoins;
    // 'all' mode: don't send top_n → backend defaults to all coins

    if (startDate) body.start_date = startDate;
    if (endDate) body.end_date = endDate;

    const progressInterval = setInterval(() => {
      setProgressStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 2500);

    // Elapsed time counter
    setElapsedSec(0);
    elapsedRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);

    try {
      // Abortable fetch with timeout — scale with coin count
      const controller = new AbortController();
      const coinCount =
        coinMode === "top"
          ? topN
          : coinMode === "select"
            ? selectedCoins.length
            : COINS_ANALYZED;
      const timeoutMs = Math.max(120000, coinCount > 100 ? 180000 : 120000);
      const abortTimeout = setTimeout(() => controller.abort(), timeoutMs);

      const doFetch = async (retryCount = 0): Promise<Response> => {
        const res = await fetch(`${API_URL}/backtest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        // Rate limit: auto-retry with backoff (max 2 retries)
        if (res.status === 429 && retryCount < 2) {
          const waitSec = (retryCount + 1) * 5;
          setError(t.rateLimitMsg || "Too many requests. Retrying...");
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          setError(null);
          return doFetch(retryCount + 1);
        }

        return res;
      };

      const res = await doFetch();
      clearTimeout(abortTimeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Server error" }));
        const detail = err.detail;
        const msg = Array.isArray(detail)
          ? detail
              .map(
                (d: { msg?: string; message?: string }) =>
                  d.msg || d.message || JSON.stringify(d),
              )
              .join("; ")
          : typeof detail === "string"
            ? detail
            : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data: BacktestResult = await res.json();
      setResult(data);
      setResultTab("summary");
      scrollPositions.current[mobileTab] = window.scrollY;
      setMobileTab("results");

      // Achievement badge tracking
      try {
        localStorage.setItem("has-run-backtest", "true");
        // Track strategies tried
        if (activePreset) {
          const tried = JSON.parse(
            localStorage.getItem("strategies-tried") || "[]",
          );
          if (Array.isArray(tried) && !tried.includes(activePreset)) {
            tried.push(activePreset);
            localStorage.setItem("strategies-tried", JSON.stringify(tried));
          }
        }
        // Multi-coin badge: 100+ coins
        if (data.coins_used >= 100) {
          localStorage.setItem("multi-coin-badge", "true");
        }
        // Expert mode badge
        if (simMode === "expert") {
          localStorage.setItem("expert-mode-used", "true");
        }
      } catch {
        // localStorage unavailable — skip silently
      }

      // Save to history (max 3)
      setHistory((prev) => {
        const label = `SL${slPct}/TP${tpPct}/${direction.toUpperCase()}`;
        const next = [{ label, result: data }, ...prev].slice(0, 3);
        return next;
      });
      // Update URL with current params
      try {
        const url = new URL(window.location.href.split("?")[0]);
        url.searchParams.set("sl", String(slPct));
        url.searchParams.set("tp", String(tpPct));
        url.searchParams.set("bars", String(maxBars));
        url.searchParams.set("dir", direction);
        window.history.replaceState(null, "", url.toString());
      } catch {}
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        200,
      );
    } catch (e: unknown) {
      const err = e as { message?: string; name?: string };
      const errMsg =
        typeof err?.message === "string"
          ? err.message
          : typeof e === "string"
            ? e
            : "Backtest failed";
      // If the request was aborted, provide a clearer timeout message
      if (err?.name === "AbortError")
        setError(
          t.timeoutMsg ||
            "Backtest timed out. Try fewer coins or a shorter date range.",
        );
      else setError(errMsg);
    } finally {
      clearInterval(progressInterval);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setIsRunning(false);
    }
  }, [
    demoMode,
    selectedIndicators,
    indicatorParams,
    conditions,
    direction,
    slPct,
    tpPct,
    maxBars,
    avoidHours,
    coinMode,
    topN,
    selectedCoins,
    startDate,
    endDate,
    perCoinUsdt,
    leverage,
    timeframe,
  ]);

  // ─── Load preset ───
  const loadPreset = useCallback(async (presetId: string) => {
    setActivePreset(presetId);
    setPresetLoading(true);
    setPresetError(null);
    try {
      const res = await fetch(
        `${API_URL}/builder/presets/${encodeURIComponent(presetId)}`,
      );
      if (!res.ok) {
        setPresetError(`Failed to load preset (HTTP ${res.status})`);
        setTimeout(() => setPresetError(null), 3000);
        setPresetLoading(false);
        return null;
      }
      const p = await res.json();

      if (p.indicators) {
        setSelectedIndicators(new Set(Object.keys(p.indicators)));
        setIndicatorParams(p.indicators);
      }
      if (p.entry?.conditions) {
        setConditions(
          p.entry.conditions.map((c: Omit<Condition, "id">) => ({
            ...c,
            id: nextCondId(),
          })),
        );
      }
      // URL params take priority over preset defaults (e.g., ranking → simulator
      // passes &dir=long&sl=8&tp=6 which should NOT be overwritten by preset defaults)
      const urlParams = new URLSearchParams(window.location.search);
      if (p.direction && !urlParams.has("dir")) setDirection(p.direction);
      if (p.sl_pct && !urlParams.has("sl")) setSlPct(p.sl_pct);
      if (p.tp_pct && !urlParams.has("tp")) setTpPct(p.tp_pct);
      if (p.max_bars && !urlParams.has("bars")) setMaxBars(p.max_bars);
      if (p.avoid_hours) setAvoidHours(new Set(p.avoid_hours));
      setPresetLoading(false);
      return p;
    } catch {
      setPresetError("Failed to load preset. Check connection.");
      setTimeout(() => setPresetError(null), 3000);
      setPresetLoading(false);
      return null;
    } finally {
      /* presetLoading state handled above */
    }
  }, []);

  // Apply pending preset from URL after presets are loaded
  useEffect(() => {
    const pending = (window as any).__pruviq_pending_preset;
    if (pending && presets.length > 0) {
      delete (window as any).__pruviq_pending_preset;
      setSimMode("expert");
      loadPreset(pending);
    }
  }, [presets, loadPreset]);

  // Auto-run when ?strategy= is in URL (from ranking page)
  // Uses /simulate API (not /backtest) since we have strategy ID, not conditions
  useEffect(() => {
    const pending = (window as any).__pruviq_pending_strategy;
    if (pending && apiReady && !isRunning && !result) {
      delete (window as any).__pruviq_pending_strategy;
      // Mark strategy as active so preset bar reflects the current strategy
      setActivePreset(pending);

      // Call /simulate with strategy ID directly (matching Standard mode behavior)
      setIsRunning(true);
      setProgressStep(0);
      setElapsedSec(0);
      const timer = setInterval(
        () => setElapsedSec((s: number) => s + 1),
        1000,
      );

      const body: Record<string, unknown> = {
        strategy: pending,
        direction: direction,
        sl_pct: slPct,
        tp_pct: tpPct,
        top_n: topN,
        fee_pct: feePct / 100,
        leverage: leverage,
      };
      if (startDate) body.start_date = startDate;
      if (endDate) body.end_date = endDate;

      fetch(`${API_URL}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          setResult(data);
          setResultTab("summary");
          setMobileTab("results");
        })
        .catch((err) => setError(String(err.message || err)))
        .finally(() => {
          setIsRunning(false);
          clearInterval(timer);
        });
    }
  }, [apiReady, isRunning, result, direction, slPct, tpPct, topN]);

  // Auto-load BB Squeeze preset for first-time visitors (shows config, not auto-run)
  // This just selects the preset — user still clicks "Run Backtest"
  useEffect(() => {
    if (!apiReady || result) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preset") || params.get("strategy") || params.get("coin"))
      return;
    if ((window as any).__pruviq_pending_strategy) return;
    try {
      if (localStorage.getItem("has-run-backtest")) return;
    } catch {}
    // Just load the preset (show config), don't auto-run
    loadPreset("bb-squeeze-short");
  }, [apiReady, result, loadPreset]);

  const onSelectPreset = useCallback(
    (id: string | null) => {
      if (id === null) {
        setActivePreset(null);
        setSelectedIndicators(new Set());
        setConditions([]);
        setDirection("short");
        setSlPct(10);
        setTpPct(8);
        setMaxBars(48);
        setAvoidHours(new Set());
      } else {
        loadPreset(id);
      }
    },
    [loadPreset],
  );

  // ─── Indicator toggle: auto-remove conditions that use deselected fields ───
  const handleIndicatorToggle = (id: string, checked: boolean) => {
    if (!checked) {
      const removedFields = new Set(
        availableIndicators.find((ind) => ind.id === id)?.fields ?? [],
      );
      setConditions((prev) =>
        prev.filter(
          (c) =>
            !removedFields.has(c.field) && !removedFields.has(c.field2 ?? ""),
        ),
      );
    }
    setSelectedIndicators((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // ─── Condition helpers ───
  const addCondition = () => {
    const firstField = availableFields[0] || "close";
    const isBool = booleanFields.has(firstField);
    setConditions((prev) => [
      ...prev,
      {
        id: nextCondId(),
        field: firstField,
        op: isBool ? "==" : ">=",
        value: isBool ? true : 0,
        shift: 1,
      },
    ]);
  };

  const updateCondition = (
    id: string,
    key: string,
    val: string | number | boolean,
  ) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: val } : c)),
    );
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const filteredCoins = coinSearch
    ? allCoins
        .filter((c) =>
          c.symbol.toLowerCase().includes(coinSearch.toLowerCase()),
        )
        .slice(0, 20)
    : allCoins.slice(0, 20);

  const progressLabels = t.progressLabels || [
    "Preparing data...",
    "Computing indicators...",
    "Finding signals...",
    "Simulating trades...",
    "Building results...",
  ];

  // Quick Test: load preset + run backtest in one click
  const runPresetQuick = useCallback(
    async (presetId: string) => {
      const p = await loadPreset(presetId);
      if (!p) return;
      // Small delay to let state flush before running
      await new Promise((r) => setTimeout(r, 50));
      await runBacktest();
    },
    [loadPreset, runBacktest],
  );

  // ────── RENDER ──────
  return (
    <div class="max-w-[1400px] mx-auto px-3 md:px-4">
      {/* Mobile tabs — only for Standard/Expert (Quick has no chart/config split) */}
      {simMode !== "quick" && (
        <div class="md:hidden flex border-b border-[--color-border] mb-3 gap-0">
          {(["chart", "config", "results"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleMobileTabChange(tab)}
              class={`flex-1 py-2 min-h-[48px] text-xs font-mono uppercase tracking-wider transition-colors flex flex-col items-center justify-center
                ${mobileTab === tab ? "font-bold border-b-2" : "text-[--color-text-muted] hover:text-[--color-text]"}`}
              style={
                mobileTab === tab
                  ? {
                      color: COLORS.accent,
                      borderColor: COLORS.accent,
                      background: COLORS.accentBg,
                    }
                  : undefined
              }
            >
              {
                <>
                  <span
                    class="block text-base leading-none mb-0.5"
                    aria-hidden="true"
                  >
                    {t.mobileIcon[tab]}
                  </span>
                  <span class="block text-[10px]">{t.mobile[tab]}</span>
                </>
              }
            </button>
          ))}
        </div>
      )}

      {/* Hot Strategies Banner — shows top performers */}
      {!result && <HotStrategies lang={lang} />}

      {/* 3-Tier Mode Switcher */}
      <ModeSwitcher
        mode={simMode}
        setMode={setSimMode}
        lang={lang}
        isFirstVisit={isFirstVisit}
      />

      {/* Quick Start Banner — Expert mode only */}
      {simMode === "expert" && showQuickStart && !result && (
        <div
          class="mb-3 border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{
            borderColor: COLORS.accent,
            background: `linear-gradient(135deg, ${COLORS.accentBg}, transparent)`,
          }}
        >
          <div>
            <p
              class="font-mono text-sm font-bold"
              style={{ color: COLORS.accent }}
            >
              {t.quickStart}
            </p>
            <p class="text-[--color-text-muted] text-xs mt-0.5">
              {t.quickStartDesc}
            </p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                const p = await loadPreset("bb-squeeze-short");
                if (!p) return;
                dismissQuickStart();
                await new Promise((r) => setTimeout(r, 50));
                try {
                  await runBacktest();
                } catch {}
              }}
              class="px-4 py-2 rounded font-mono text-xs font-bold transition-colors hover:opacity-90"
              style={{
                background: COLORS.accent,
                color: "#fff",
                boxShadow: `0 0 12px ${COLORS.accentGlow}`,
              }}
            >
              {t.quickStartCta} &rarr;
            </button>
            <button
              onClick={dismissQuickStart}
              class="px-3 py-2 rounded font-mono text-[10px] text-[--color-text-muted] border border-[--color-border] hover:text-[--color-text] transition-colors"
            >
              {t.quickStartDismiss}
            </button>
          </div>
        </div>
      )}

      {/* ─── Quick Test Mode ─── */}
      {simMode === "quick" && (
        <div role="tabpanel" id="panel-quick" aria-labelledby="tab-quick">
          <QuickTestPanel
            lang={lang}
            onRunPreset={runPresetQuick}
            isRunning={isRunning}
            hasResult={!!result}
          />
        </div>
      )}

      {/* ─── Standard Mode ─── */}
      {simMode === "standard" && (
        <div
          role="tabpanel"
          id="panel-standard"
          aria-labelledby="tab-standard"
          class="flex flex-col md:flex-row gap-3"
        >
          {/* Left: Chart */}
          <div
            class={`md:w-[55%] flex-shrink-0 ${mobileTab !== "chart" ? "hidden md:block" : ""}`}
          >
            <ChartPanel
              chartSymbol={chartSymbol}
              setChartSymbol={setChartSymbol}
              chartData={chartData}
              chartLoading={chartLoading}
              loadingText={t.loading}
              trades={result?.trades}
              error={chartError}
              onRetry={loadChart}
              timeframe={timeframe}
              retryLabel={t.retry}
              noDataError={t.noDataError}
              symbolPlaceholder={t.symbolPlaceholder}
            />
          </div>

          {/* Right: StandardPanel */}
          <div
            class={`md:w-[45%] flex-shrink-0 ${mobileTab !== "config" ? "hidden md:block" : ""}`}
          >
            <StandardPanel
              lang={lang}
              presets={presets}
              activePreset={activePreset}
              onSelectPreset={onSelectPreset}
              presetLoading={presetLoading}
              direction={direction}
              setDirection={setDirection}
              slPct={slPct}
              setSlPct={setSlPct}
              tpPct={tpPct}
              setTpPct={setTpPct}
              leverage={leverage}
              setLeverage={setLeverage}
              feePct={feePct}
              setFeePct={setFeePct}
              coinMode={coinMode}
              setCoinMode={setCoinMode}
              topN={topN}
              setTopN={setTopN}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              isRunning={isRunning}
              onRun={runBacktest}
              coinsLoaded={coinsLoaded}
            />
          </div>
        </div>
      )}

      {/* ─── Expert Mode: Full Builder ─── */}
      {simMode === "expert" && (
        <div
          role="tabpanel"
          id="panel-expert"
          aria-labelledby="tab-expert"
          class="flex flex-col md:flex-row gap-3"
        >
          {/* Left: Chart (55%) */}
          <div
            class={`md:w-[55%] flex-shrink-0 ${mobileTab !== "chart" ? "hidden md:block" : ""}`}
          >
            <ChartPanel
              chartSymbol={chartSymbol}
              setChartSymbol={setChartSymbol}
              chartData={chartData}
              chartLoading={chartLoading}
              loadingText={t.loading}
              trades={result?.trades}
              error={chartError}
              onRetry={loadChart}
              timeframe={timeframe}
              retryLabel={t.retry}
              noDataError={t.noDataError}
              symbolPlaceholder={t.symbolPlaceholder}
            />
          </div>

          {/* Right: Conditions Panel (45%) */}
          <div
            ref={builderRef}
            class={`md:w-[45%] flex-shrink-0 ${mobileTab !== "config" ? "hidden md:block" : ""}`}
          >
            <BuilderPanel
              t={t}
              lang={lang}
              coinsLoaded={currentCoinCount}
              totalCoins={coinsLoaded}
              demoMode={demoMode}
              availableIndicators={availableIndicators}
              selectedIndicators={selectedIndicators}
              setSelectedIndicators={handleIndicatorToggle}
              availableFields={availableFields}
              conditions={conditions}
              addCondition={addCondition}
              updateCondition={updateCondition}
              removeCondition={removeCondition}
              direction={direction}
              setDirection={setDirection}
              slPct={slPct}
              setSlPct={setSlPct}
              tpPct={tpPct}
              setTpPct={setTpPct}
              maxBars={maxBars}
              setMaxBars={setMaxBars}
              perCoinUsdt={perCoinUsdt}
              setPerCoinUsdt={setPerCoinUsdt}
              leverage={leverage}
              setLeverage={setLeverage}
              compounding={compounding}
              setCompounding={handleCompoundToggle}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              coinMode={coinMode}
              setCoinMode={setCoinMode}
              topN={topN}
              setTopN={setTopN}
              selectedCoins={selectedCoins}
              setSelectedCoins={setSelectedCoins}
              coinSearch={coinSearch}
              setCoinSearch={setCoinSearch}
              filteredCoins={filteredCoins}
              allCoinsCount={allCoins.length}
              avoidHours={avoidHours}
              setAvoidHours={setAvoidHours}
              presets={presets}
              activePreset={activePreset}
              onSelectPreset={onSelectPreset}
              presetLoading={presetLoading}
              presetError={presetError}
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              isRunning={isRunning}
              progressStep={progressStep}
              progressLabels={progressLabels}
              elapsedSec={elapsedSec}
              onRun={runBacktest}
            />
          </div>
        </div>
      )}

      {/* Results section */}
      <div
        ref={resultsRef}
        class={`mt-3 ${mobileTab !== "results" && !result && !isRunning ? "hidden md:block" : ""}`}
      >
        {/* Phase 1.5: Loading animation replaces empty results area */}
        {isRunning && !result && (
          <div class="rounded-xl border border-[--color-border] bg-[--color-bg-card] overflow-hidden">
            <LoadingEquityAnimation
              t={t}
              progressStep={progressStep}
              elapsedSec={elapsedSec}
            />
          </div>
        )}
        <ResultsPanel
          t={t}
          result={result}
          error={error}
          simMode={simMode}
          resultTab={resultTab}
          setResultTab={setResultTab}
          activePreset={activePreset}
          lang={lang}
          onModifyRerun={scrollToBuilder}
          onQuickAdjustRerun={(sl, tp, coins) => {
            setSlPct(sl);
            setTpPct(tp);
            setTopN(coins);
            setTimeout(runBacktest, 50);
          }}
          onCopyLink={copyLink}
          linkCopied={linkCopied}
          slPct={slPct}
          tpPct={tpPct}
          topN={topN}
          isRunning={isRunning}
          history={history}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          onSelectHistory={(idx) => {
            if (history[idx]) setResult(history[idx].result);
          }}
          onClearHistory={() => setHistory([])}
        />
        {result && (
          <div class="mt-4">
            <AchievementBadges lang={lang} />
          </div>
        )}
      </div>

      {/* Mobile sticky Run button — Standard & Expert modes */}
      {simMode !== "quick" &&
        mobileTab === "config" &&
        (simMode === "standard" || conditions.length > 0) && (
          <div
            class="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 py-3 border-t border-[--color-border]"
            style={{
              background: "var(--color-bg)",
              boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <button
              onClick={runBacktest}
              disabled={isRunning || conditions.length === 0}
              class={`w-full py-3 rounded-lg font-mono text-sm font-bold transition-colors
              ${isRunning ? "cursor-not-allowed opacity-60" : "hover:opacity-90"}`}
              style={
                isRunning
                  ? { background: COLORS.disabled, color: COLORS.disabledText }
                  : {
                      background: COLORS.accent,
                      color: "#fff",
                      boxShadow: `0 0 12px ${COLORS.accentGlow}`,
                    }
              }
            >
              {isRunning ? (
                <span class="flex items-center justify-center gap-2">
                  <span class="spinner" />
                  {progressLabels[progressStep] || t.running}
                  {elapsedSec > 0 && (
                    <span class="text-[10px] opacity-70 font-normal">
                      {(t.elapsed || "{n}s").replace("{n}", String(elapsedSec))}
                    </span>
                  )}
                </span>
              ) : currentCoinCount > 0 ? (
                t.runWithCoins?.replace("{n}", String(currentCoinCount)) ||
                t.run
              ) : (
                t.run
              )}
            </button>
          </div>
        )}

      {/* How it works + Disclaimer */}
      <div class="mt-6 mb-8 max-w-lg mx-auto">
        {t.simNotes && (
          <details class="mb-3 group">
            <summary class="text-[11px] font-mono text-[--color-text-muted] cursor-pointer select-none hover:text-[--color-accent] transition-colors">
              {t.simNotesTitle}{" "}
              <span class="opacity-50 group-open:rotate-90 inline-block transition-transform">
                {"▶"}
              </span>
            </summary>
            <ul class="mt-2 space-y-1.5 text-[11px] text-[--color-text-muted] list-none pl-0">
              {t.simNotes.map((note: string, i: number) => (
                <li key={i} class="flex gap-2">
                  <span class="text-[--color-accent] opacity-60 shrink-0">
                    {"•"}
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p class="text-[--color-text-muted] text-[10px] text-center opacity-60">
          {t.disclaimer}
        </p>
      </div>
    </div>
  );
}
