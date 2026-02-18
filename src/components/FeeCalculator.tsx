import { useState } from 'preact/hooks';

interface Exchange {
  name: string;
  maker: number;
  taker: number;
  discount: number;
  discountLabel: string;
  link: string;
  available: boolean;
}

const exchanges: Exchange[] = [
  { name: 'Binance', maker: 0.0002, taker: 0.0005, discount: 0.09, discountLabel: '9% (Futures)', link: 'https://accounts.binance.com/register?ref=PRUVIQ', available: true },
  { name: 'Bybit', maker: 0.0002, taker: 0.00055, discount: 0.20, discountLabel: '20%', link: '#', available: false },
  { name: 'OKX', maker: 0.0002, taker: 0.0005, discount: 0.20, discountLabel: '20%', link: '#', available: false },
  { name: 'Bitget', maker: 0.0002, taker: 0.0006, discount: 0.20, discountLabel: '20%', link: '#', available: false },
  { name: 'MEXC', maker: 0, taker: 0.0002, discount: 0.10, discountLabel: '10%', link: '#', available: false },
];

const labels = {
  en: {
    tag: 'FEE CALCULATOR',
    title: 'How Much Are You Paying in Fees?',
    desc: 'Enter your trading volume and see the real cost across exchanges. PRUVIQ referral discounts applied automatically.',
    volume: 'Monthly Trading Volume (USD)',
    trades: 'Trades Per Month',
    makerRatio: 'Maker Order Ratio',
    exchange: 'Exchange',
    monthly: 'Monthly Fees',
    annual: 'Annual Fees',
    withPruviq: 'With PRUVIQ',
    savings: 'Annual Savings',
    noDiscount: 'No Discount',
    standard: 'Standard',
    discounted: 'Discounted',
    bestFor: 'Best savings',
    signup: 'Sign Up',
    coming: 'Coming Soon',
    disclaimer: 'Calculations use base tier (VIP 0) rates. Actual fees may vary with VIP level and exchange promotions. Maker ratio indicates what percentage of your orders are limit orders (maker) vs market orders (taker).',
    makerTip: 'maker orders (limit)',
  },
  ko: {
    tag: '수수료 계산기',
    title: '매매 수수료, 얼마나 내고 계신가요?',
    desc: '거래량을 입력하면 거래소별 실제 비용을 비교합니다. PRUVIQ 추천 할인이 자동 적용됩니다.',
    volume: '월간 거래량 (USD)',
    trades: '월간 거래 횟수',
    makerRatio: '메이커 주문 비율',
    exchange: '거래소',
    monthly: '월간 수수료',
    annual: '연간 수수료',
    withPruviq: 'PRUVIQ 적용',
    savings: '연간 절감액',
    noDiscount: '할인 없음',
    standard: '기본',
    discounted: '할인 적용',
    bestFor: '최고 절감',
    signup: '가입하기',
    coming: '준비 중',
    disclaimer: 'VIP 0 (기본) 등급 기준 계산. 실제 수수료는 VIP 등급과 거래소 프로모션에 따라 다를 수 있습니다.',
    makerTip: '메이커 주문 (지정가)',
  },
};

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  lang?: 'en' | 'ko';
}

export default function FeeCalculator({ lang = 'en' }: Props) {
  const t = labels[lang] || labels.en;
  const [volume, setVolume] = useState(100000);
  const [trades, setTrades] = useState(100);
  const [makerPct, setMakerPct] = useState(30);

  const volumeSteps = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  const tradeSteps = [10, 25, 50, 100, 250, 500, 1000];

  function calcFees(ex: Exchange) {
    const makerVol = volume * (makerPct / 100);
    const takerVol = volume * (1 - makerPct / 100);
    const standard = makerVol * ex.maker + takerVol * ex.taker;
    const discounted = standard * (1 - ex.discount);
    return { standard, discounted, savings: (standard - discounted) * 12 };
  }

  const results = exchanges.map((ex) => ({ ex, ...calcFees(ex) }));
  const bestSavings = Math.max(...results.map((r) => r.savings));

  return (
    <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] p-6">
      <div class="font-mono text-[--color-accent] text-xs tracking-wider mb-2">{t.tag}</div>
      <h3 class="text-xl font-bold mb-1">{t.title}</h3>
      <p class="text-[--color-text-muted] text-sm mb-6">{t.desc}</p>

      {/* Inputs */}
      <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label class="block font-mono text-xs text-[--color-text-muted] mb-2">{t.volume}</label>
          <input
            type="range"
            min={0}
            max={volumeSteps.length - 1}
            value={volumeSteps.indexOf(volume) >= 0 ? volumeSteps.indexOf(volume) : 3}
            onInput={(e) => setVolume(volumeSteps[Number((e.target as HTMLInputElement).value)])}
            class="w-full accent-[--color-accent]"
          />
          <div class="font-mono text-lg font-bold mt-1">{fmtFull(volume)}</div>
        </div>
        <div>
          <label class="block font-mono text-xs text-[--color-text-muted] mb-2">{t.trades}</label>
          <input
            type="range"
            min={0}
            max={tradeSteps.length - 1}
            value={tradeSteps.indexOf(trades) >= 0 ? tradeSteps.indexOf(trades) : 3}
            onInput={(e) => setTrades(tradeSteps[Number((e.target as HTMLInputElement).value)])}
            class="w-full accent-[--color-accent]"
          />
          <div class="font-mono text-lg font-bold mt-1">{trades}</div>
        </div>
        <div>
          <label class="block font-mono text-xs text-[--color-text-muted] mb-2">{t.makerRatio}</label>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={makerPct}
            onInput={(e) => setMakerPct(Number((e.target as HTMLInputElement).value))}
            class="w-full accent-[--color-accent]"
          />
          <div class="font-mono text-lg font-bold mt-1">
            {makerPct}% <span class="text-xs text-[--color-text-muted] font-normal">{t.makerTip}</span>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[600px]">
          <thead>
            <tr class="border-b border-[--color-border]">
              <th class="text-left py-2 font-mono text-[--color-text-muted] text-xs">{t.exchange}</th>
              <th class="text-right py-2 font-mono text-[--color-text-muted] text-xs">{t.standard}</th>
              <th class="text-right py-2 font-mono text-[--color-accent] text-xs">{t.withPruviq}</th>
              <th class="text-right py-2 font-mono text-[--color-accent] text-xs">{t.savings}</th>
              <th class="text-center py-2"></th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ ex, standard, discounted, savings }) => (
              <tr class="border-b border-[--color-border] last:border-0">
                <td class="py-3">
                  <span class="font-bold">{ex.name}</span>
                  <span class="ml-2 text-xs text-[--color-text-muted]">{ex.discountLabel}</span>
                </td>
                <td class="py-3 text-right font-mono text-[--color-text-muted]">
                  {fmt(standard)}<span class="text-xs">/mo</span>
                </td>
                <td class="py-3 text-right font-mono font-bold text-[--color-accent]">
                  {fmt(discounted)}<span class="text-xs">/mo</span>
                </td>
                <td class="py-3 text-right">
                  <span class="font-mono font-bold text-[--color-accent]">{fmtFull(Math.round(savings))}</span>
                  <span class="text-xs text-[--color-text-muted]">/yr</span>
                  {savings === bestSavings && savings > 0 && (
                    <span class="ml-2 text-[0.625rem] bg-[--color-accent]/20 text-[--color-accent] px-1.5 py-0.5 rounded font-mono">
                      {t.bestFor}
                    </span>
                  )}
                </td>
                <td class="py-3 text-center">
                  {ex.available ? (
                    <a
                      href={ex.link}
                      target="_blank"
                      rel="noopener"
                      class="inline-block bg-[--color-accent] text-[--color-bg] px-3 py-1 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      {t.signup} &rarr;
                    </a>
                  ) : (
                    <span class="inline-block bg-[--color-border] text-[--color-text-muted] px-3 py-1 rounded text-xs font-semibold cursor-default">
                      {t.coming}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p class="text-[--color-text-muted] text-xs mt-4">{t.disclaimer}</p>
    </div>
  );
}
