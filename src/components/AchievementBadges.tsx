/**
 * AchievementBadges.tsx - Lightweight gamification badge bar (localStorage-based)
 *
 * Tracks user achievements via localStorage. No backend required.
 */
import { useState, useEffect } from "preact/hooks";

interface Badge {
  id: string;
  icon: string;
  en: string;
  ko: string;
  check: () => boolean;
}

interface Props {
  lang: string;
}

const badges: Badge[] = [
  {
    id: "first-backtest",
    icon: "\ud83c\udfaf",
    en: "First Backtest",
    ko: "\ucca8 \ubc31\ud14c\uc2a4\ud2b8",
    check: () => {
      try {
        return localStorage.getItem("has-run-backtest") === "true";
      } catch {
        return false;
      }
    },
  },
  {
    id: "explorer",
    icon: "\ud83d\udd0d",
    en: "Strategy Explorer",
    ko: "\uc804\ub7b5 \ud0d0\ud5d8\uac00",
    check: () => {
      try {
        return (
          JSON.parse(localStorage.getItem("strategies-tried") || "[]").length >=
          3
        );
      } catch {
        return false;
      }
    },
  },
  {
    id: "multi-coin",
    icon: "\ud83e\ude99",
    en: "Multi-Coin",
    ko: "\uba40\ud2f0\ucf54\uc778",
    check: () => {
      try {
        return localStorage.getItem("multi-coin-badge") === "true";
      } catch {
        return false;
      }
    },
  },
  {
    id: "data-scientist",
    icon: "\ud83e\uddea",
    en: "Data Scientist",
    ko: "\ub370\uc774\ud130 \uc0ac\uc774\uc5b8\ud2f0\uc2a4\ud2b8",
    check: () => {
      try {
        return localStorage.getItem("expert-mode-used") === "true";
      } catch {
        return false;
      }
    },
  },
  {
    id: "weekly",
    icon: "\ud83d\udcc5",
    en: "Weekly Regular",
    ko: "\uc8fc\uac04 \ub2e8\uace8",
    check: () => {
      try {
        return (
          JSON.parse(localStorage.getItem("leaderboard-weeks") || "[]")
            .length >= 2
        );
      } catch {
        return false;
      }
    },
  },
];

export default function AchievementBadges({ lang }: Props) {
  const [, setTick] = useState(0);

  // Re-check badges on mount and when storage changes
  useEffect(() => {
    setTick((n) => n + 1);
    const onStorage = () => setTick((n) => n + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const earned = badges.filter((b) => b.check());
  if (earned.length === 0) return null;

  const isKo = lang === "ko";

  return (
    <div
      class="flex gap-2 flex-wrap"
      role="group"
      aria-label={isKo ? "\uc5c5\uc801 \ubc30\uc9c0" : "Achievement badges"}
    >
      {badges.map((b) => {
        const isEarned = b.check();
        return (
          <div
            key={b.id}
            title={isEarned ? (isKo ? b.ko : b.en) : "???"}
            class={`text-xs px-2 py-1 rounded-full border ${
              isEarned
                ? "border-[--color-accent]/50 bg-[--color-accent]/10 text-[--color-accent]"
                : "border-[--color-border] text-[--color-text-muted] opacity-30"
            }`}
          >
            {b.icon} {isEarned ? (isKo ? b.ko : b.en) : "???"}
          </div>
        );
      })}
    </div>
  );
}
