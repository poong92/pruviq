/**
 * DashboardTabs — Tabbed layout wrapper for the trading dashboard.
 *
 * Redesigned 2026-05-20 to address owner UX feedback:
 * "모든 컴포넌트가 세로 1열로 쌓여 스크롤이 많음. 초보자 비친화적."
 *
 * Structure (3 tabs):
 *   Status  — OKX connection + balance + bot status + DCA KPI strip
 *   Bots    — DCA bots + Grid bots + Strategy builder + Settings + Signals
 *   History — Recent fills + Parity check + Live positions + Trade history
 *
 * Tab state lives here. Child components are unchanged — they receive the
 * same `lang` prop they always did. The per-component `client:*` directives
 * on the old dashboard.astro are replaced by this single `client:load` wrapper.
 *
 * Cross-tab edit anchor: DCABots scrolls to #dca-builder-form on Edit click.
 * Bot list + builder are both in the Bots tab so that works.
 */
import { useState } from "preact/hooks";
import Tabs, { TabPanel } from "./ui/Tabs";
import OKXConnectButton from "./OKXConnectButton";
import OKXBalance from "./OKXBalance";
import AutoTradingStatus from "./AutoTradingStatus";
import DCASummaryStrip from "./DCASummaryStrip";
import DCABots from "./DCABots";
import GridBots from "./GridBots";
import StrategyBuilder from "./StrategyBuilder";
import TradingSettings from "./TradingSettings";
import PendingSignalsApproval from "./PendingSignalsApproval";
import RecentDCAFills from "./RecentDCAFills";
import DCAParityCheck from "./DCAParityCheck";
import LivePositions from "./LivePositions";
import LiveTradeHistory from "./LiveTradeHistory";
import { OKX_DISCOUNT_PCT } from "../config/exchanges";

type Tab = "status" | "bots" | "history";

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    tabStatus: "Status",
    tabBots: "Bots",
    tabHistory: "History",
    okxTitle: "OKX Broker",
    okxSub: `Official Broker Partner — ${OKX_DISCOUNT_PCT}% fee discount`,
    statFeeLabel: "Fee Discount",
    statExecLabel: "Execution",
    statExecValue: "Auto",
    statApiLabel: "API Key Sharing",
    statApiValue: "Not required",
  },
  ko: {
    tabStatus: "현황",
    tabBots: "봇 관리",
    tabHistory: "기록",
    okxTitle: "OKX 브로커",
    okxSub: `공식 브로커 파트너 — 수수료 ${OKX_DISCOUNT_PCT}% 할인`,
    statFeeLabel: "수수료 할인",
    statExecLabel: "실행 방식",
    statExecValue: "자동",
    statApiLabel: "API 키",
    statApiValue: "불필요",
  },
} as const;

const ID_PREFIX = "dashboard-tabs";

export default function DashboardTabs({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [activeTab, setActiveTab] = useState<Tab>("status");

  const tabs = [
    { value: "status" as Tab, label: t.tabStatus },
    { value: "bots" as Tab, label: t.tabBots },
    { value: "history" as Tab, label: t.tabHistory },
  ] as const;

  return (
    <div>
      {/* Tab strip */}
      <Tabs
        tabs={tabs as unknown as Array<{ value: Tab; label: string }>}
        value={activeTab}
        onChange={setActiveTab}
        variant="underline"
        size="lg"
        aria-label={lang === "ko" ? "대시보드 섹션" : "Dashboard sections"}
        idPrefix={ID_PREFIX}
        class="mb-6"
      />

      {/* Status tab */}
      <TabPanel
        idPrefix={ID_PREFIX}
        active={activeTab}
        value="status"
        mount="lazy"
      >
        {/* OKX Connection Card */}
        <section class="mb-6">
          <div class="card-enterprise rounded-2xl p-5 md:p-6">
            <div class="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-(--color-accent)/10 flex items-center justify-center shrink-0">
                  <svg
                    class="w-6 h-6 text-(--color-accent)"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 class="text-lg font-bold">{t.okxTitle}</h2>
                  <p class="text-sm text-(--color-text-muted)">{t.okxSub}</p>
                </div>
              </div>
              <OKXConnectButton lang={lang} size="md" />
            </div>
            {/* Key stats — 2-col on mobile, 3-col from sm */}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              <div class="bg-(--color-bg)/50 rounded-xl p-3 text-center">
                <p class="text-xs text-(--color-text-muted) mb-1">
                  {t.statFeeLabel}
                </p>
                <p class="text-xl font-bold text-(--color-success)">
                  {OKX_DISCOUNT_PCT}%
                </p>
              </div>
              <div class="bg-(--color-bg)/50 rounded-xl p-3 text-center">
                <p class="text-xs text-(--color-text-muted) mb-1">
                  {t.statExecLabel}
                </p>
                <p class="text-xl font-bold">{t.statExecValue}</p>
              </div>
              <div class="bg-(--color-bg)/50 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                <p class="text-xs text-(--color-text-muted) mb-1">
                  {t.statApiLabel}
                </p>
                <p class="text-lg font-bold text-(--color-success)">
                  {t.statApiValue}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Balance + Bot status — stack on mobile, 2-col from sm */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <OKXBalance lang={lang} />
          <AutoTradingStatus lang={lang} />
        </div>

        {/* DCA KPI strip */}
        <section class="mb-2">
          <DCASummaryStrip lang={lang} />
        </section>
      </TabPanel>

      {/* Bots tab */}
      <TabPanel
        idPrefix={ID_PREFIX}
        active={activeTab}
        value="bots"
        mount="lazy"
      >
        <div class="space-y-6">
          <DCABots lang={lang} />
          <GridBots lang={lang} />
          <StrategyBuilder lang={lang} />
          <TradingSettings lang={lang} />
          <PendingSignalsApproval lang={lang} />
        </div>
      </TabPanel>

      {/* History tab */}
      <TabPanel
        idPrefix={ID_PREFIX}
        active={activeTab}
        value="history"
        mount="lazy"
      >
        <div class="space-y-6">
          <RecentDCAFills lang={lang} />
          <DCAParityCheck lang={lang} />
          <LivePositions lang={lang} />
          <LiveTradeHistory lang={lang} />
        </div>
      </TabPanel>
    </div>
  );
}
