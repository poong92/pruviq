/**
 * Shared helper for per-strategy dynamic OG images (EN + KO).
 *
 * Both /og/strategies/[slug].png and /og/ko/strategies/[slug].png
 * delegate here so layout, colours, and rendering logic live in one
 * place. Only locale-specific config (labels, fonts, tagline) differs.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Fonts (loaded once at module scope) ─────────────────────────
const FONT_DIR = resolve(process.cwd(), "src/assets/fonts");
export const interRegular = readFileSync(resolve(FONT_DIR, "Inter-Regular.ttf"));
export const interBold = readFileSync(resolve(FONT_DIR, "Inter-Bold.ttf"));
export const pretendardRegular = readFileSync(
  resolve(FONT_DIR, "Pretendard-Regular.ttf"),
);
export const pretendardBold = readFileSync(
  resolve(FONT_DIR, "Pretendard-Bold.ttf"),
);

// ── Types ───────────────────────────────────────────────────────
export interface StrategyData {
  name: string;
  status: "verified" | "killed" | "shelved" | "testing";
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  description?: string;
  direction?: string;
}

export interface LocaleConfig {
  statusLabels: Record<StrategyData["status"], string>;
  directionLabel: (dir: string) => string;
  statLabels: { pf: string; wr: string; mdd: string };
  tagline: string;
  fontFamily: string;
  fonts: Array<{ name: string; data: Buffer; weight: number; style: "normal" }>;
}

// ── Shared constants ────────────────────────────────────────────
const STATUS_COLORS: Record<StrategyData["status"], string> = {
  verified: "#F59E0B",
  testing: "#F59E0B",
  killed: "#F23645",
  shelved: "#71717A",
};

// ── OG tree builder ─────────────────────────────────────────────
export function buildOgTree(slug: string, data: StrategyData, locale: LocaleConfig) {
  const accent = "#5CC8ED";
  const text = "#FAFAFA";
  const muted = "#A1A1AA";
  const bg = "#09090B";
  const cardBg = "rgba(255,255,255,0.04)";
  const statusColor = STATUS_COLORS[data.status];
  const statusLabel = locale.statusLabels[data.status];
  const dirLabel = data.direction ? locale.directionLabel(data.direction) : "";

  const pf =
    typeof data.profitFactor === "number" ? data.profitFactor.toFixed(2) : "—";
  const wr =
    typeof data.winRate === "number" ? `${data.winRate.toFixed(1)}%` : "—";
  const mdd =
    typeof data.maxDrawdown === "number"
      ? `${data.maxDrawdown.toFixed(1)}%`
      : "—";

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        backgroundColor: bg,
        backgroundImage: `radial-gradient(circle at 80% 20%, rgba(44,181,232,0.10) 0%, transparent 60%)`,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        fontFamily: locale.fontFamily,
        color: text,
      },
      children: [
        // Top bar: PRUVIQ wordmark + status badge
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          width: 16,
                          height: 16,
                          backgroundColor: accent,
                          borderRadius: 4,
                        },
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "Inter",
                          fontSize: 24,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: text,
                        },
                        children: "PRUVIQ",
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: `2px solid ${statusColor}`,
                    backgroundColor: `${statusColor}1F`,
                    color: statusColor,
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  },
                  children: statusLabel,
                },
              },
            ],
          },
        },
        // Strategy name (big)
        {
          type: "div",
          props: {
            style: {
              marginTop: 80,
              fontFamily: "Inter",
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.1,
              color: text,
              letterSpacing: "-0.02em",
            },
            children: data.name,
          },
        },
        // Direction + slug (small)
        {
          type: "div",
          props: {
            style: {
              marginTop: 16,
              fontSize: 22,
              color: muted,
              letterSpacing: "0.02em",
            },
            children: `${dirLabel ? `${dirLabel} · ` : ""}${slug}`,
          },
        },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // 3-stat row
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              gap: 24,
              marginBottom: 32,
            },
            children: [
              { label: locale.statLabels.pf, value: pf, color: text },
              { label: locale.statLabels.wr, value: wr, color: text },
              { label: locale.statLabels.mdd, value: mdd, color: "#F87171" },
            ].map((s) => ({
              type: "div",
              props: {
                style: {
                  flex: 1,
                  padding: "20px 24px",
                  borderRadius: 12,
                  backgroundColor: cardBg,
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 16,
                        color: muted,
                        letterSpacing: "0.02em",
                        fontWeight: 700,
                      },
                      children: s.label,
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        marginTop: 8,
                        fontFamily: "Inter",
                        fontSize: 44,
                        fontWeight: 700,
                        color: s.color,
                      },
                      children: s.value,
                    },
                  },
                ],
              },
            })),
          },
        },
        // Tagline footer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 18,
              color: muted,
              letterSpacing: "0.02em",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 20,
            },
            children: [
              {
                type: "div",
                props: { children: locale.tagline },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Inter",
                    color: accent,
                    fontWeight: 700,
                  },
                  children: "pruviq.com",
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// ── Shared getStaticPaths ───────────────────────────────────────
export async function getStrategyPaths() {
  const strategies = await getCollection("strategies");
  return strategies.map((s) => ({ params: { slug: s.id } }));
}

// ── Shared GET handler ──────────────────────────────────────────
export function createOgHandler(locale: LocaleConfig): APIRoute {
  return async ({ params }) => {
    const slug = params.slug as string;
    const all = await getCollection("strategies");
    const entry = all.find((s) => s.id === slug);
    if (!entry) {
      return new Response("not found", { status: 404 });
    }
    const data: StrategyData = {
      name: entry.data.name,
      status: entry.data.status as StrategyData["status"],
      winRate: entry.data.winRate,
      profitFactor: entry.data.profitFactor,
      maxDrawdown: entry.data.maxDrawdown,
      description: entry.data.description,
      direction: entry.data.direction,
    };

    const tree = buildOgTree(slug, data, locale) as unknown as Parameters<
      typeof satori
    >[0];

    const svg = await satori(tree, {
      width: 1200,
      height: 630,
      fonts: locale.fonts,
    });

    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
    })
      .render()
      .asPng();

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  };
}
