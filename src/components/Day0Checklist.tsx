/**
 * Day0Checklist — guided onboarding banner at the top of /dashboard.
 *
 * Auto-hides when all 3 conditions are met:
 *  1) OKX connected (session cookie + /auth/okx/status.connected)
 *  2) Trading account has any balance (/execute/balance returns ≥1 row)
 *  3) At least 1 DCA bot saved (/dca-bots returns ≥1 row)
 *
 * Otherwise renders a 3-step progress card with the next-action CTA
 * highlighted. Converts the dashboard from "list of cards" into a
 * guided experience for first-time owners. Pairs with the dog-foot
 * manual's Day 0 flow.
 */
import { useCallback, useEffect, useState } from "preact/hooks";
import { API_BASE_URL } from "../config/api";

interface Props {
  lang?: "en" | "ko";
}

const i18n = {
  en: {
    title: "Day 0 quick start",
    subtitle:
      "3 steps before your first paper-mode dog-foot. Auto-hides when done.",
    s1Title: "Connect OKX",
    s1Hint: "Already connected. Skip to step 2.",
    s2Title: "Transfer Funding → Trading",
    s2Hint:
      "Your assets are in Funding. Bots only fill against Trading. Move 100 USDT to start.",
    s2Cta: "Open OKX Assets",
    s3Title: "Create your first paper-mode DCA bot",
    s3Hint:
      "Use the DCA builder below. The form's live preview validates the math before save.",
    s3Cta: "Jump to builder",
    done: "Done",
    pending: "Next",
  },
  ko: {
    title: "Day 0 빠른 시작",
    subtitle: "첫 paper-mode dog-foot 전 3단계. 완료되면 자동으로 사라집니다.",
    s1Title: "OKX 연결",
    s1Hint: "이미 연결됨. 2단계로.",
    s2Title: "Funding → Trading 이체",
    s2Hint:
      "자산이 Funding 계정에 있습니다. 봇은 Trading 계정만 사용합니다. 100 USDT부터 시작하세요.",
    s2Cta: "OKX 자산 페이지 열기",
    s3Title: "첫 paper-mode DCA 봇 만들기",
    s3Hint:
      "아래 DCA 빌더를 사용하세요. 폼의 실시간 미리보기가 저장 전에 계산을 검증합니다.",
    s3Cta: "빌더로 이동",
    done: "완료",
    pending: "다음",
  },
} as const;

export default function Day0Checklist({ lang = "en" }: Props) {
  const t = i18n[lang] ?? i18n.en;
  const [connected, setConnected] = useState<boolean | null>(null);
  const [hasTrading, setHasTrading] = useState<boolean | null>(null);
  const [hasBot, setHasBot] = useState<boolean | null>(null);

  const probe = useCallback(async () => {
    try {
      const [auth, bal, bots] = await Promise.all([
        fetch(`${API_BASE_URL}/auth/okx/status`, {
          credentials: "include",
          signal: AbortSignal.timeout(8_000),
        }),
        fetch(`${API_BASE_URL}/execute/balance`, {
          credentials: "include",
          signal: AbortSignal.timeout(8_000),
        }),
        fetch(`${API_BASE_URL}/dca-bots`, {
          credentials: "include",
          signal: AbortSignal.timeout(8_000),
        }),
      ]);
      const authData = (await auth.json().catch(() => null)) as {
        connected?: boolean;
      } | null;
      setConnected(!!authData?.connected);

      if (bal.status === 401) {
        setHasTrading(false);
      } else if (bal.ok) {
        const data = (await bal.json()) as { balances?: Array<unknown> };
        setHasTrading((data.balances ?? []).length > 0);
      }

      if (bots.status === 401) {
        setHasBot(false);
      } else if (bots.ok) {
        const data = (await bots.json()) as { bots?: Array<unknown> };
        setHasBot((data.bots ?? []).length > 0);
      }
    } catch {
      // silent — banner stays hidden if probe fails
    }
  }, []);

  useEffect(() => {
    void probe();
    const id = setInterval(() => void probe(), 30_000);
    return () => clearInterval(id);
  }, [probe]);

  // Only show after probe completes and at least one step is pending
  if (connected === null || hasTrading === null || hasBot === null) return null;
  if (connected && hasTrading && hasBot) return null;
  // Owner has no session yet — Connect step happens via OKX Broker card,
  // not duplicated here. Hide the banner until the first connect.
  if (!connected) return null;

  const okxAssetsUrl = "https://www.okx.com/balance/main-account";
  const nextStep = !hasTrading ? 2 : !hasBot ? 3 : 0;

  return (
    <section
      class="card-enterprise rounded-2xl p-5 md:p-6 ring-2 ring-(--color-accent)/30 bg-(--color-accent)/5"
      aria-labelledby="day0-title"
    >
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 id="day0-title" class="font-bold text-lg flex items-center gap-2">
            <span aria-hidden="true">🚀</span> {t.title}
          </h2>
          <p class="text-xs text-(--color-text-muted) mt-1">{t.subtitle}</p>
        </div>
        <div
          class="flex items-center gap-1 text-xs font-mono font-bold"
          aria-label="progress"
        >
          {[1, 2, 3].map((n) => {
            const done =
              (n === 1 && connected) ||
              (n === 2 && hasTrading) ||
              (n === 3 && hasBot);
            return (
              <span
                key={n}
                class={`w-7 h-7 rounded-full inline-flex items-center justify-center border ${
                  done
                    ? "bg-(--color-up)/20 border-(--color-up)/40 text-(--color-up)"
                    : nextStep === n
                      ? "bg-(--color-accent)/20 border-(--color-accent)/50 text-(--color-accent-bright) ring-2 ring-(--color-accent)/30"
                      : "bg-(--color-bg-elevated) border-(--color-border) text-(--color-text-muted)"
                }`}
              >
                {done ? "✓" : n}
              </span>
            );
          })}
        </div>
      </div>

      <ol class="space-y-3">
        <Step
          n={1}
          title={t.s1Title}
          done={!!connected}
          isNext={nextStep === 1}
          doneLabel={t.done}
          nextLabel={t.pending}
        >
          <p class="text-xs text-(--color-text-muted)">{t.s1Hint}</p>
        </Step>
        <Step
          n={2}
          title={t.s2Title}
          done={!!hasTrading}
          isNext={nextStep === 2}
          doneLabel={t.done}
          nextLabel={t.pending}
        >
          <p class="text-xs text-(--color-text-secondary) mb-2 leading-relaxed">
            {t.s2Hint}
          </p>
          {!hasTrading && (
            <a
              href={okxAssetsUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-primary btn-sm min-h-[44px] inline-flex items-center"
            >
              {t.s2Cta} ↗
            </a>
          )}
        </Step>
        <Step
          n={3}
          title={t.s3Title}
          done={!!hasBot}
          isNext={nextStep === 3}
          doneLabel={t.done}
          nextLabel={t.pending}
        >
          <p class="text-xs text-(--color-text-secondary) mb-2 leading-relaxed">
            {t.s3Hint}
          </p>
          {!hasBot && hasTrading && (
            <a
              href="#dca-builder-form"
              class="btn btn-primary btn-sm min-h-[44px] inline-flex items-center"
            >
              {t.s3Cta} ↓
            </a>
          )}
        </Step>
      </ol>
    </section>
  );
}

function Step({
  n,
  title,
  done,
  isNext,
  doneLabel,
  nextLabel,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  isNext: boolean;
  doneLabel: string;
  nextLabel: string;
  children: preact.ComponentChildren;
}) {
  return (
    <li
      class={`flex gap-3 p-3 rounded-lg border ${
        done
          ? "border-(--color-up)/20 bg-(--color-up)/5"
          : isNext
            ? "border-(--color-accent)/40 bg-(--color-accent)/10"
            : "border-(--color-border) bg-(--color-bg)/40"
      }`}
    >
      <span
        class={`shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center font-mono font-bold text-sm ${
          done
            ? "bg-(--color-up)/20 text-(--color-up)"
            : isNext
              ? "bg-(--color-accent)/20 text-(--color-accent-bright)"
              : "bg-(--color-bg-elevated) text-(--color-text-muted)"
        }`}
        aria-hidden="true"
      >
        {done ? "✓" : n}
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h3 class="font-bold text-sm">{title}</h3>
          <span
            class={`text-[0.65rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
              done
                ? "bg-(--color-up)/15 text-(--color-up)"
                : isNext
                  ? "bg-(--color-accent)/15 text-(--color-accent-bright)"
                  : "bg-(--color-bg-elevated) text-(--color-text-muted)"
            }`}
          >
            {done ? doneLabel : isNext ? nextLabel : ""}
          </span>
        </div>
        <div class="mt-1">{children}</div>
      </div>
    </li>
  );
}
