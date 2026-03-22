/**
 * EmailCapture.tsx - Lightweight email capture banner (localStorage-based)
 *
 * Shows a non-intrusive banner below backtest results on first completion.
 * Stores emails in localStorage (no backend required).
 */
import { useState, useEffect } from "preact/hooks";

interface Props {
  lang: "en" | "ko";
}

const labels = {
  en: {
    headline: "Get weekly strategy rankings in your inbox",
    subtext:
      "Top strategies, market insights, and new features \u2014 every Monday.",
    placeholder: "your@email.com",
    subscribe: "Subscribe",
    disclaimer: "No spam. Unsubscribe anytime.",
    thanks: "Thank you! You\u2019ll receive updates every Monday.",
  },
  ko: {
    headline:
      "\ub9e4\uc8fc \uc804\ub7b5 \uc21c\uc704\ub97c \uc774\uba54\uc77c\ub85c \ubc1b\uc544\ubcf4\uc138\uc694",
    subtext:
      "\ucd5c\uace0 \uc804\ub7b5, \uc2dc\uc7a5 \uc778\uc0ac\uc774\ud2b8, \uc0c8 \uae30\ub2a5 \u2014 \ub9e4\uc8fc \uc6d4\uc694\uc77c.",
    placeholder: "your@email.com",
    subscribe: "\uad6c\ub3c5",
    disclaimer:
      "\uc2a4\ud338 \uc5c6\uc74c. \uc5b8\uc81c\ub4e0 \uad6c\ub3c5 \ucde8\uc18c.",
    thanks:
      "\uac10\uc0ac\ud569\ub2c8\ub2e4! \ub9e4\uc8fc \uc6d4\uc694\uc77c \uc5c5\ub370\uc774\ud2b8\ub97c \ubc1b\uc73c\uc2e4 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
  },
};

export default function EmailCapture({ lang }: Props) {
  const [captured, setCaptured] = useState(true); // default hidden
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    try {
      setCaptured(localStorage.getItem("email-captured") === "true");
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (captured) return null;

  const t = labels[lang] || labels.en;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!email) return;
    try {
      const existing = JSON.parse(
        localStorage.getItem("captured-emails") || "[]",
      );
      if (!Array.isArray(existing)) throw new Error("corrupt");
      if (!existing.includes(email)) {
        existing.push(email);
        localStorage.setItem("captured-emails", JSON.stringify(existing));
      }
      localStorage.setItem("email-captured", "true");
    } catch {
      // fallback: just set the flag
      localStorage.setItem("captured-emails", JSON.stringify([email]));
      localStorage.setItem("email-captured", "true");
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div
        class="mt-6 border border-[--color-accent]/30 rounded-lg p-4 bg-[--color-accent]/5"
        role="status"
        aria-live="polite"
      >
        <p class="text-sm font-semibold text-[--color-accent]">{t.thanks}</p>
      </div>
    );
  }

  return (
    <div class="mt-6 border border-[--color-accent]/30 rounded-lg p-4 bg-[--color-accent]/5">
      <p class="text-sm font-semibold mb-1">{t.headline}</p>
      <p class="text-xs text-[--color-text-muted] mb-3">{t.subtext}</p>
      <form onSubmit={handleSubmit} class="flex gap-2">
        <input
          type="email"
          placeholder={t.placeholder}
          required
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="flex-1 px-3 py-2 rounded border border-[--color-border] bg-[--color-bg] text-sm"
          aria-label="Email address"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-[--color-accent] text-[--color-bg] rounded text-sm font-medium hover:bg-[--color-accent-dim] transition-colors"
        >
          {t.subscribe}
        </button>
      </form>
      <p class="text-xs text-[--color-text-muted] mt-2 opacity-60">
        {t.disclaimer}
      </p>
    </div>
  );
}
