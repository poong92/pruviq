/**
 * LiveStats.tsx - Backtesting tool stats with animated numbers
 */
import { useState, useEffect } from 'preact/hooks';

interface Props {
  lang?: 'en' | 'ko';
}

const L = {
  en: {
    trades: 'Backtested Trades',
    coins: 'Coins Tested',
    strategies: 'Variations Tested',
    history: 'Historical Data',
  },
  ko: {
    trades: '백테스트 거래',
    coins: '테스트 코인',
    strategies: '테스트 조합',
    history: '과거 데이터',
  },
};

function AnimatedNumber({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const steps = 30;
    const increment = value / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const current = Math.min(value, Math.round(increment * step));
      setDisplay(current);
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{prefix}{display.toLocaleString()}{suffix}</span>;
}

export default function LiveStats({ lang = 'en' }: Props) {
  const t = L[lang] || L.en;

  return (
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={2898} suffix="+" />
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.trades}</p>
      </div>
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={549} suffix="+" />
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.coins}</p>
      </div>
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={88} suffix="+" />
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.strategies}</p>
      </div>
      <div class="text-center p-4">
        <p class="font-mono text-[--color-accent] text-3xl md:text-4xl font-bold">
          <AnimatedNumber value={2} suffix="+" />
          <span class="text-xl ml-1">{lang === 'ko' ? '년' : 'yrs'}</span>
        </p>
        <p class="text-[--color-text-muted] text-sm mt-1">{t.history}</p>
      </div>
    </div>
  );
}
