/** HotStrategies — "지금 뜨는 전략" 위젯
 *
 * API /hot-strategies에서 최근 30일 기준 상위 전략을 가져와 표시.
 * 시뮬레이터 페이지 상단 또는 메인 페이지에 배치.
 */

import { useState, useEffect } from "preact/hooks";
import { API_BASE_URL as API_URL } from "../config/api";
import { buildSimulatorUrl } from "../config/simulation-context";

interface HotStrategy {
  strategy_id: string;
  strategy_name: string;
  direction: string;
  status: string;
  period: string;
  profit_factor: number;
  win_rate: number;
  total_trades: number;
  total_return_pct: number;
}

interface HotResponse {
  strategies: HotStrategy[];
  updated_at: string;
}

export default function HotStrategies({ lang = "en" }: { lang?: string }) {
  const [data, setData] = useState<HotResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Delay fetch by 3s so page reaches networkidle first (prevents E2E timeout)
    const delay = setTimeout(() => {
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 5000);

      fetch(`${API_URL}/hot-strategies`, { signal: controller.signal })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
        .then(setData)
        .catch(() => setError(true))
        .finally(() => clearTimeout(fetchTimer));
    }, 3000);

    return () => clearTimeout(delay);
  }, []);

  if (error || !data?.strategies?.length) return null;

  const top3 = data.strategies.slice(0, 3);
  const title = lang === "ko" ? "지금 뜨는 전략" : "Hot Strategies";
  const subtitle =
    lang === "ko"
      ? "최근 30일 BTC 기준 상위 전략"
      : "Top strategies by recent 30-day BTC performance";

  return (
    <div class="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 mb-6">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-lg">🔥</span>
        <h3 class="text-sm font-semibold text-yellow-400">{title}</h3>
        <span class="text-xs text-zinc-500">{subtitle}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {top3.map((s, i) => {
          const url = buildSimulatorUrl({
            strategy: s.strategy_id,
            direction: s.direction,
          });

          return (
            <a
              key={s.strategy_id + s.direction}
              href={url}
              class="block rounded-md border border-zinc-700/50 bg-zinc-800/50 p-3 hover:border-yellow-500/40 transition-colors"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs font-medium text-zinc-300">
                  #{i + 1} {s.strategy_name}
                </span>
                {s.status === "verified" && (
                  <span class="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                    verified
                  </span>
                )}
              </div>
              <div class="flex items-center gap-3 text-xs text-zinc-400">
                <span class="uppercase">{s.direction}</span>
                <span>
                  PF{" "}
                  <span
                    class={
                      s.profit_factor > 1.5
                        ? "text-green-400 font-bold"
                        : s.profit_factor > 1.0
                          ? "text-green-400"
                          : "text-red-400"
                    }
                  >
                    {s.profit_factor.toFixed(2)}
                  </span>
                </span>
                <span>WR {s.win_rate.toFixed(0)}%</span>
                <span>{s.total_trades}T</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
