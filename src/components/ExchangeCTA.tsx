import { exchanges, type Exchange } from '../data/exchanges';

interface Props {
  /** Display mode: 'inline' for table rows, 'card' for full-width */
  mode?: 'inline' | 'card';
  lang?: 'en' | 'ko';
  /** Optional coin symbol for tracking */
  coin?: string;
  /** Optional strategy ID for tracking */
  strategy?: string;
}

const labels = {
  en: {
    heading: 'Start trading with reduced fees',
    subtext: 'Sign up through PRUVIQ and save on every trade',
    discount: 'fee discount',
    signup: 'Sign Up',
    disclosure: 'Affiliate link — we may earn a commission at no extra cost to you.',
  },
  ko: {
    heading: '수수료 할인으로 트레이딩 시작',
    subtext: 'PRUVIQ를 통해 가입하면 매 거래마다 절약',
    discount: '수수료 할인',
    signup: '가입하기',
    disclosure: '제휴 링크 — 추가 비용 없이 저희에게 수수료가 지급됩니다.',
  },
};

function buildUrl(exchange: Exchange, coin?: string, strategy?: string): string {
  const base = exchange.referralUrl;
  if (base === '#' || !base) return '#';
  const params = new URLSearchParams();
  if (coin) params.set('utm_content', coin);
  if (strategy) params.set('utm_campaign', strategy);
  const qs = params.toString();
  return qs ? `${base}&${qs}` : base;
}

export default function ExchangeCTA({ mode = 'card', lang = 'en', coin, strategy }: Props) {
  const t = labels[lang] || labels.en;
  const available = exchanges.filter(e => e.available && e.referralUrl !== '#');

  if (available.length === 0) return null;

  if (mode === 'inline') {
    return (
      <div class="mt-3 pt-3 border-t border-[--color-border]/50">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[0.625rem] text-[--color-text-muted] uppercase tracking-wider">{t.heading}:</span>
          {available.map(ex => (
            <a
              key={ex.id}
              href={buildUrl(ex, coin, strategy)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[--color-border] hover:border-[--color-accent] text-[0.6875rem] font-mono transition-colors"
            >
              <span class="font-semibold text-[--color-text]">{ex.name}</span>
              <span class="text-[--color-accent] text-[0.625rem]">{ex.discountLabel} off</span>
            </a>
          ))}
        </div>
        <p class="text-[0.5rem] text-[--color-text-muted] mt-1">{t.disclosure}</p>
      </div>
    );
  }

  // Card mode (full-width)
  return (
    <div class="border border-[--color-border] rounded-xl bg-[--color-bg-card] p-6 mt-6">
      <h3 class="text-sm font-bold mb-1">{t.heading}</h3>
      <p class="text-[0.75rem] text-[--color-text-muted] mb-4">{t.subtext}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {available.map(ex => (
          <a
            key={ex.id}
            href={buildUrl(ex, coin, strategy)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            class="flex items-center justify-between p-3 rounded-lg border border-[--color-border] hover:border-[--color-accent] transition-colors group"
          >
            <div>
              <div class="font-semibold text-sm">{ex.name}</div>
              <div class="text-[0.6875rem] text-[--color-text-muted]">
                {ex.tag} &middot; <span class="text-[--color-accent]">{ex.discountLabel} {t.discount}</span>
              </div>
            </div>
            <span class="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap" style="background:#00ff88;color:#0a0a0a">
              {t.signup} &rarr;
            </span>
          </a>
        ))}
      </div>
      <p class="text-[0.5625rem] text-[--color-text-muted] mt-3">{t.disclosure}</p>
    </div>
  );
}
