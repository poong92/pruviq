import { h } from 'preact';

interface Props {
  lang: string;
}

const t = (lang: string, key: string, fallback: string) => {
  const translations: Record<string, Record<string, string>> = {
    ko: {
      'leaderboard.best': '\uCD5C\uACE0 \uC131\uACFC',
      'leaderboard.worst': '\uC800\uC870\uD55C \uC131\uACFC',
      'leaderboard.coming_soon': '\uC2E4\uC2DC\uAC04 \uB9AC\uB354\uBCF4\uB4DC \uC900\uBE44 \uC911. \uC9C0\uAE08\uC740 \uC2DC\uBBAC\uB808\uC774\uD130\uC5D0\uC11C \uC9C1\uC811 \uBC31\uD14C\uC2A4\uD2B8\uB97C \uD574\uBCF4\uC138\uC694.',
      'leaderboard.cta': '\uC2DC\uBBAC\uB808\uC774\uD130 \uCCB4\uD5D8',
      'leaderboard.rank': '#',
      'leaderboard.strategy': '\uC804\uB7B5',
      'leaderboard.direction': '\uBC29\uD5A5',
      'leaderboard.win_rate': '\uC2B9\uB960',
      'leaderboard.profit_factor': 'PF',
      'leaderboard.total_return': '\uC218\uC775\uB960',
      'leaderboard.weekly_note': '\uB9E4\uC8FC \uC5C5\uB370\uC774\uD2B8',
    },
  };
  return translations[lang]?.[key] ?? fallback;
};

interface LeaderboardEntry {
  rank: number;
  strategy: string;
  direction: string;
  winRate: string;
  profitFactor: string;
  totalReturn: string;
  isPositive: boolean;
}

const topPerformers: LeaderboardEntry[] = [
  { rank: 1, strategy: 'BB Squeeze + RSI Filter', direction: 'SHORT', winRate: '58.2%', profitFactor: '2.41', totalReturn: '+18.7%', isPositive: true },
  { rank: 2, strategy: 'BB Squeeze Standard', direction: 'SHORT', winRate: '55.8%', profitFactor: '2.22', totalReturn: '+14.3%', isPositive: true },
  { rank: 3, strategy: 'EMA Cross + Volume', direction: 'SHORT', winRate: '52.1%', profitFactor: '1.87', totalReturn: '+9.8%', isPositive: true },
  { rank: 4, strategy: 'RSI Reversal', direction: 'SHORT', winRate: '50.4%', profitFactor: '1.65', totalReturn: '+6.2%', isPositive: true },
  { rank: 5, strategy: 'MACD Divergence', direction: 'SHORT', winRate: '49.1%', profitFactor: '1.42', totalReturn: '+3.1%', isPositive: true },
];

const bottomPerformers: LeaderboardEntry[] = [
  { rank: 1, strategy: 'Momentum Breakout', direction: 'LONG', winRate: '28.1%', profitFactor: '0.35', totalReturn: '-22.4%', isPositive: false },
  { rank: 2, strategy: 'BB Squeeze Standard', direction: 'LONG', winRate: '31.4%', profitFactor: '0.41', totalReturn: '-18.9%', isPositive: false },
  { rank: 3, strategy: 'Triple EMA Cross', direction: 'LONG', winRate: '33.7%', profitFactor: '0.52', totalReturn: '-14.1%', isPositive: false },
  { rank: 4, strategy: 'Stochastic Oversold', direction: 'LONG', winRate: '36.2%', profitFactor: '0.61', totalReturn: '-10.5%', isPositive: false },
  { rank: 5, strategy: 'ADX Trend Follow', direction: 'LONG', winRate: '38.9%', profitFactor: '0.73', totalReturn: '-7.3%', isPositive: false },
];

function LeaderboardTable({ entries, lang }: { entries: LeaderboardEntry[]; lang: string }) {
  return (
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[--color-border] text-[--color-text-muted] text-xs font-mono">
            <th class="text-left py-3 px-2 w-8">{t(lang, 'leaderboard.rank', '#')}</th>
            <th class="text-left py-3 px-2">{t(lang, 'leaderboard.strategy', 'Strategy')}</th>
            <th class="text-left py-3 px-2 hidden sm:table-cell">{t(lang, 'leaderboard.direction', 'Direction')}</th>
            <th class="text-right py-3 px-2">{t(lang, 'leaderboard.win_rate', 'Win Rate')}</th>
            <th class="text-right py-3 px-2 hidden sm:table-cell">{t(lang, 'leaderboard.profit_factor', 'PF')}</th>
            <th class="text-right py-3 px-2">{t(lang, 'leaderboard.total_return', 'Return')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.rank} class="border-b border-[--color-border]/50 hover:bg-[--color-bg-card] transition-colors">
              <td class="py-3 px-2 font-mono text-[--color-text-muted]">{entry.rank}</td>
              <td class="py-3 px-2 font-medium">{entry.strategy}</td>
              <td class="py-3 px-2 hidden sm:table-cell">
                <span class={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  entry.direction === 'SHORT'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-green-500/10 text-green-400'
                }`}>
                  {entry.direction}
                </span>
              </td>
              <td class="py-3 px-2 text-right font-mono">{entry.winRate}</td>
              <td class="py-3 px-2 text-right font-mono hidden sm:table-cell">{entry.profitFactor}</td>
              <td class={`py-3 px-2 text-right font-mono font-semibold ${
                entry.isPositive ? 'text-green-400' : 'text-red-400'
              }`}>
                {entry.totalReturn}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WeeklyLeaderboard({ lang }: Props) {
  const simulatePath = lang === 'ko' ? '/ko/simulate' : '/simulate';

  return (
    <div>
      {/* Top Performers */}
      <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] mb-8">
        <div class="p-4 sm:p-6 border-b border-[--color-border]">
          <div class="flex items-center gap-2">
            <span class="text-green-400 text-lg" aria-hidden="true">&#9650;</span>
            <h2 class="text-xl font-bold">{t(lang, 'leaderboard.best', 'Top Performers')}</h2>
          </div>
        </div>
        <div class="p-4 sm:p-6">
          <LeaderboardTable entries={topPerformers} lang={lang} />
        </div>
      </div>

      {/* Bottom Performers */}
      <div class="border border-[--color-border] rounded-lg bg-[--color-bg-card] mb-10">
        <div class="p-4 sm:p-6 border-b border-[--color-border]">
          <div class="flex items-center gap-2">
            <span class="text-red-400 text-lg" aria-hidden="true">&#9660;</span>
            <h2 class="text-xl font-bold">{t(lang, 'leaderboard.worst', 'Underperformers')}</h2>
          </div>
        </div>
        <div class="p-4 sm:p-6">
          <LeaderboardTable entries={bottomPerformers} lang={lang} />
        </div>
      </div>

      {/* Weekly note */}
      <p class="text-center text-[--color-text-muted] text-xs font-mono mb-6">
        {t(lang, 'leaderboard.weekly_note', 'Data updates weekly')}
      </p>

      {/* Coming Soon + CTA */}
      <div class="border border-dashed border-[--color-border] rounded-lg p-6 sm:p-8 text-center bg-[--color-bg-card]/50">
        <p class="text-[--color-text-muted] mb-6">
          {t(lang, 'leaderboard.coming_soon', 'Live leaderboard coming soon. For now, try the simulator to run your own backtests.')}
        </p>
        <a
          href={simulatePath}
          class="inline-block bg-[--color-accent] text-[--color-bg] px-6 py-2.5 rounded font-semibold text-sm hover:bg-[--color-accent-dim] transition-colors"
        >
          {t(lang, 'leaderboard.cta', 'Try Simulator')} &rarr;
        </a>
      </div>
    </div>
  );
}
