import { useState } from 'preact/hooks';

interface FeeRate {
  maker: number;
  taker: number;
}

interface Exchange {
  name: string;
  spot: FeeRate;
  futures: FeeRate;
  discount: number;
  discountLabel: string;
  link: string;
  available: boolean;
  tag: string;
}

const exchanges: Exchange[] = [
  {
    name: 'Binance',
    spot: { maker: 0.001, taker: 0.001 },
    futures: { maker: 0.0002, taker: 0.0005 },
    discount: 0.10,
    discountLabel: '10%',
    link: 'https://accounts.binance.com/register?ref=PRUVIQ',
    available: true,
    tag: '#1 Volume',
  },
  {
    name: 'OKX',
    spot: { maker: 0.0008, taker: 0.001 },
    futures: { maker: 0.0002, taker: 0.0005 },
    discount: 0.20,
    discountLabel: '20%',
    link: '#',
    available: false,
    tag: '120+ Countries',
  },
  {
    name: 'Bitget',
    spot: { maker: 0.001, taker: 0.001 },
    futures: { maker: 0.0002, taker: 0.0006 },
    discount: 0.20,
    discountLabel: '20%',
    link: '#',
    available: false,
    tag: 'Copy Trading',
  },
];

const labels = {
  en: {
    tag: 'FEE CALCULATOR',
    title: 'How Much Can You Save?',
    desc: 'Enter your monthly trading volume. See the real cost — and how much PRUVIQ saves you.',
    volume: 'Monthly Volume (USD)',
    spot: 'Spot',
    futures: 'Futures',
    market: 'Market',
    exchange: 'Exchange',
    standard: 'Standard Fee',
    withPruviq: 'With PRUVIQ',
    savings: 'You Save / Year',
    signup: 'Sign Up',
    coming: 'Coming Soon',
    disclaimer: 'Based on VIP 0 (base tier) taker fees. Actual fees may vary with VIP level.',
    spotTab: 'Spot Trading',
    futuresTab: 'Futures Trading',
  },
  ko: {
    tag: '수수료 계산기',
    title: '얼마나 절약할 수 있을까요?',
    desc: '월 거래량을 입력하세요. 실제 비용과 PRUVIQ로 절약할 수 있는 금액을 확인하세요.',
    volume: '월 거래량 (USD)',
    spot: '현물',
    futures: '선물',
    market: '시장',
    exchange: '거래소',
    standard: '기본 수수료',
    withPruviq: 'PRUVIQ 적용',
    savings: '연간 절약액',
    signup: '가입하기',
    coming: '준비 중',
    disclaimer: 'VIP 0 (기본 등급) 테이커 수수료 기준. 실제 수수료는 VIP 등급에 따라 다를 수 있습니다.',
    spotTab: '현물 거래',
    futuresTab: '선물 거래',
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
  const [market, setMarket] = useState<'futures' | 'spot'>('futures');

  const volumeSteps = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];

  function calcFees(ex: Exchange) {
    const rates = market === 'futures' ? ex.futures : ex.spot;
    const standard = volume * rates.taker;
    const discounted = standard * (1 - ex.discount);
    const savingsYear = (standard - discounted) * 12;
    return { standard, discounted, savingsYear };
  }

  const results = exchanges.map((ex) => ({ ex, ...calcFees(ex) }));

  return (
    <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] p-6">
      <div class="font-mono text-[--color-accent] text-xs tracking-wider mb-2">{t.tag}</div>
      <h3 class="text-xl font-bold mb-1">{t.title}</h3>
      <p class="text-[--color-text-muted] text-sm mb-6">{t.desc}</p>

      {/* Market Toggle + Volume */}
      <div class="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Spot / Futures Toggle */}
        <div class="flex-shrink-0">
          <label class="block font-mono text-xs text-[--color-text-muted] mb-2">{t.market}</label>
          <div class="flex rounded-lg overflow-hidden border border-[--color-border]">
            <button
              onClick={() => setMarket('spot')}
              class={`px-4 py-2 text-sm font-semibold transition-colors ${
                market === 'spot'
                  ? 'bg-[--color-accent] text-[--color-bg]'
                  : 'bg-[--color-bg-card] text-[--color-text-muted] hover:text-[--color-text]'
              }`}
            >
              {t.spotTab}
            </button>
            <button
              onClick={() => setMarket('futures')}
              class={`px-4 py-2 text-sm font-semibold transition-colors ${
                market === 'futures'
                  ? 'bg-[--color-accent] text-[--color-bg]'
                  : 'bg-[--color-bg-card] text-[--color-text-muted] hover:text-[--color-text]'
              }`}
            >
              {t.futuresTab}
            </button>
          </div>
        </div>

        {/* Volume Slider */}
        <div class="flex-1">
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
      </div>

      {/* Results — Simple Cards */}
      <div class="grid gap-4">
        {results.map(({ ex, standard, discounted, savingsYear }) => (
          <div class="border border-[--color-border] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Exchange Name */}
            <div class="sm:w-36 flex-shrink-0">
              <span class="font-bold text-base">{ex.name}</span>
              <span class="ml-2 text-[0.65rem] bg-[--color-accent]/10 text-[--color-accent] px-1.5 py-0.5 rounded font-mono">
                {ex.tag}
              </span>
            </div>

            {/* Fees */}
            <div class="flex-1 grid grid-cols-3 gap-2 text-center">
              <div>
                <div class="font-mono text-xs text-[--color-text-muted] mb-1">{t.standard}</div>
                <div class="font-mono text-sm line-through text-[--color-text-muted]">{fmt(standard)}<span class="text-[0.6rem]">/mo</span></div>
              </div>
              <div>
                <div class="font-mono text-xs text-[--color-accent] mb-1">{t.withPruviq} ({ex.discountLabel})</div>
                <div class="font-mono text-sm font-bold text-[--color-accent]">{fmt(discounted)}<span class="text-[0.6rem]">/mo</span></div>
              </div>
              <div>
                <div class="font-mono text-xs text-[--color-text-muted] mb-1">{t.savings}</div>
                <div class="font-mono text-sm font-bold text-[--color-accent]">{fmtFull(Math.round(savingsYear))}</div>
              </div>
            </div>

            {/* CTA */}
            <div class="sm:w-28 flex-shrink-0 text-center">
              {ex.available ? (
                <a
                  href={ex.link}
                  target="_blank"
                  rel="noopener"
                  class="inline-block w-full bg-[--color-accent] text-[--color-bg] px-4 py-2 rounded text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  {t.signup} &rarr;
                </a>
              ) : (
                <span class="inline-block w-full bg-[--color-border] text-[--color-text-muted] px-4 py-2 rounded text-xs font-semibold cursor-default">
                  {t.coming}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p class="text-[--color-text-muted] text-xs mt-4">{t.disclaimer}</p>
    </div>
  );
}
