/** Shared formatting utilities used across PRUVIQ components */

export function formatPrice(p: number): string {
  if (p >= 10000)
    return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 100) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 3 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function formatVolume(v: number, prefix = "$"): string {
  if (v >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${prefix}${(v / 1e3).toFixed(0)}K`;
  return `${prefix}${v.toFixed(0)}`;
}

export function formatVolumeRaw(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(1);
}

export function formatUsd(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatReasonLabel(reason: string): string {
  if (reason === "TP") return "TP";
  if (reason === "SL") return "SL";
  if (reason === "TIMEOUT") return "TO";
  return reason;
}

/** Win rate color: BEP-relative when bep provided, else fixed 50/55 fallback.
 *  bep provided: margin >5pp → green, >=0pp → yellow, <0pp → red
 *  no bep: >=55 → green, >=50 → yellow, else red */
export function winRateColor(wr: number, bep?: number): string {
  if (bep !== undefined) {
    const margin = wr - bep;
    if (margin > 5) return "var(--color-accent)";
    if (margin >= 0) return "var(--color-yellow)";
    return "var(--color-red)";
  }
  if (wr >= 55) return "var(--color-accent)";
  if (wr >= 50) return "var(--color-yellow)";
  return "var(--color-red)";
}

/** Format profit factor: 999.99 sentinel → ∞ */
export function formatPF(pf: number): string {
  if (pf >= 999) return "\u221E";
  return pf.toFixed(2);
}

/** Profit factor color: >=1.5 accent, >=1.0 yellow, else red */
export function profitFactorColor(pf: number): string {
  if (pf >= 1.5) return "var(--color-accent)";
  if (pf >= 1.0) return "var(--color-yellow)";
  return "var(--color-red)";
}

/** Sign color: >=0 accent, else red */
export function signColor(v: number): string {
  return v >= 0 ? "var(--color-accent)" : "var(--color-red)";
}

export function changeColor(v: number): string {
  return v >= 0 ? "var(--color-up)" : "var(--color-down)";
}

export function fgColor(idx: number): string {
  if (idx <= 25) return "var(--color-fg-extreme-fear)";
  if (idx <= 45) return "var(--color-fg-fear)";
  if (idx <= 55) return "var(--color-fg-neutral)";
  if (idx <= 75) return "var(--color-fg-greed)";
  return "var(--color-fg-extreme-greed)";
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 60000);
    if (diff < 1) return "now";
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  } catch {
    return "";
  }
}

/** Get runtime CSS variable value */
export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * formatKoNum — Korean idiomatic number formatting.
 *
 * Korean numerals break at 만 (10,000) and 억 (10^8), not at thousands.
 * `toLocaleString("ko-KR")` only inserts commas (Western grouping) — it
 * doesn't compose the 만 / 억 idioms that feel native to Korean readers.
 *
 * Default (verbose) mode preserves precision but reads natively:
 *   formatKoNum(123)          → "123"
 *   formatKoNum(1_234)        → "1,234"
 *   formatKoNum(12_345)       → "1만 2,345"
 *   formatKoNum(1_234_567)    → "123만 4,567"
 *   formatKoNum(12_345_678)   → "1,234만 5,678"
 *   formatKoNum(123_456_789)  → "1억 2,345만 6,789"
 *   formatKoNum(-12_345)      → "-1만 2,345"
 *
 * Compact mode rounds to one significant fraction:
 *   formatKoNum(12_345,        { compact: true }) → "1.2만"
 *   formatKoNum(1_234_567,     { compact: true }) → "123만"
 *   formatKoNum(12_345_678,    { compact: true }) → "1,234만"
 *   formatKoNum(123_456_789,   { compact: true }) → "1.2억"
 *   formatKoNum(1_234_567_890, { compact: true }) → "12억"
 *
 * Use this in any user-facing numeric copy targeting Korean readers
 * (KO `:lang(ko)` text, /ko/* pages, or trader-facing dollar/USDT amounts
 * where a parallel KRW idiom feels more grounded).
 */
const EOK = 100_000_000;
const MAN = 10_000;

export function formatKoNum(
  n: number,
  opts: { compact?: boolean } = {},
): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);

  if (opts.compact) {
    // Compact: round to 1 fraction. Drop fraction if >= 10 of the unit.
    if (v >= EOK) {
      const eok = v / EOK;
      const formatted =
        eok >= 10 ? Math.round(eok).toLocaleString("en-US") : eok.toFixed(1);
      return `${sign}${formatted}억`;
    }
    if (v >= MAN) {
      const man = v / MAN;
      const formatted =
        man >= 10 ? Math.round(man).toLocaleString("en-US") : man.toFixed(1);
      return `${sign}${formatted}만`;
    }
    return `${sign}${Math.round(v).toLocaleString("en-US")}`;
  }

  // Verbose: preserve full precision, compose 억 / 만 / 단위 segments.
  const eok = Math.floor(v / EOK);
  const remAfterEok = v - eok * EOK;
  const man = Math.floor(remAfterEok / MAN);
  const ones = remAfterEok - man * MAN;

  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("en-US")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("en-US")}만`);
  if (ones > 0 || (eok === 0 && man === 0)) {
    parts.push(ones.toLocaleString("en-US"));
  }
  return `${sign}${parts.join(" ")}`;
}

/**
 * formatLocalizedCount — lang-aware integer formatter for trade counts /
 * activity numbers / sample sizes. Always lossless (no compact mode here —
 * call `formatKoNum(n, { compact: true })` directly when you need that).
 *
 *   formatLocalizedCount(12_345, "en") → "12,345"
 *   formatLocalizedCount(12_345, "ko") → "1만 2,345"
 *
 * Single source for "render this integer for this user". Use this instead
 * of `n.toLocaleString()` whenever the surrounding component already knows
 * the lang prop, so KO readers see the idiom without per-site branching.
 */
export function formatLocalizedCount(n: number, lang: "en" | "ko"): string {
  if (lang === "ko") return formatKoNum(n);
  return n.toLocaleString("en-US");
}
