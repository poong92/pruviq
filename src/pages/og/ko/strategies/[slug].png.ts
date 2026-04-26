/**
 * /og/ko/strategies/[slug].png — Korean-text dynamic OG (W3-1e).
 *
 * Korean-glyph variant of /og/strategies/[slug].png. Uses Pretendard
 * (the de-facto Korean web font) so 한글 strategy descriptions and
 * subtitles render natively instead of falling back to tofu blocks
 * (which is what would happen if the EN OG with Inter rendered KR text).
 *
 * Wired only on /ko/strategies/[id] pages — the EN locale keeps using
 * the Inter-only OG (#1437) since strategy names like "BB Squeeze SHORT"
 * are already English even on the KO page.
 *
 * Build cost: ~2.5 MB Pretendard fonts (Regular + Bold) loaded once at
 * module scope, ~80ms per render × 8 strategies ≈ 640ms additional
 * over the EN-only generation.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FONT_DIR = resolve(process.cwd(), "src/assets/fonts");
const interRegular = readFileSync(resolve(FONT_DIR, "Inter-Regular.ttf"));
const interBold = readFileSync(resolve(FONT_DIR, "Inter-Bold.ttf"));
const pretendardRegular = readFileSync(
  resolve(FONT_DIR, "Pretendard-Regular.ttf"),
);
const pretendardBold = readFileSync(resolve(FONT_DIR, "Pretendard-Bold.ttf"));

interface StrategyData {
  name: string;
  status: "verified" | "killed" | "shelved" | "testing";
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  description?: string;
  direction?: string;
}

const STATUS_COLORS: Record<StrategyData["status"], string> = {
  verified: "#F59E0B",
  testing: "#F59E0B",
  killed: "#F23645",
  shelved: "#71717A",
};

const STATUS_LABELS_KO: Record<StrategyData["status"], string> = {
  verified: "검증 완료",
  testing: "검증 중",
  killed: "폐기",
  shelved: "보류",
};

const DIRECTION_LABELS_KO: Record<string, string> = {
  long: "롱",
  short: "숏",
  both: "양방향",
};

function buildKoOgTree(slug: string, data: StrategyData) {
  const accent = "#5CC8ED";
  const text = "#FAFAFA";
  const muted = "#A1A1AA";
  const bg = "#09090B";
  const cardBg = "rgba(255,255,255,0.04)";
  const statusColor = STATUS_COLORS[data.status];
  const statusLabel = STATUS_LABELS_KO[data.status];
  const dirLabel = data.direction
    ? (DIRECTION_LABELS_KO[data.direction] ?? data.direction.toUpperCase())
    : "";

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
        // Pretendard takes precedence so 한글 renders; Inter is fallback for ASCII
        fontFamily: "Pretendard, Inter",
        color: text,
      },
      children: [
        // Top bar
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: 12 },
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
        // Strategy name (English-only — names are universal)
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
        // Direction + slug subline (KR direction label)
        {
          type: "div",
          props: {
            style: {
              marginTop: 16,
              fontSize: 22,
              color: muted,
              letterSpacing: "0.02em",
            },
            children: `${dirLabel ? `${dirLabel} 전략 · ` : ""}${slug}`,
          },
        },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // 3-stat row with Korean labels
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              gap: 24,
              marginBottom: 32,
            },
            children: [
              { label: "수익 팩터", value: pf, color: text },
              { label: "승률", value: wr, color: text },
              { label: "최대 낙폭", value: mdd, color: "#F87171" },
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
                props: { children: "트레이딩 전에 검증하세요." },
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

export async function getStaticPaths() {
  // Use the same set of strategies as the EN endpoint — there's no
  // separate strategies-ko collection that diverges in slugs.
  const strategies = await getCollection("strategies");
  return strategies.map((s) => ({ params: { slug: s.id } }));
}

export const GET: APIRoute = async ({ params }) => {
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

  const tree = buildKoOgTree(slug, data) as unknown as Parameters<
    typeof satori
  >[0];

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      // Pretendard FIRST so 한글 codepoints find a glyph; Inter fallback
      // covers ASCII (PRUVIQ wordmark, numbers, slug).
      {
        name: "Pretendard",
        data: pretendardRegular,
        weight: 400,
        style: "normal",
      },
      {
        name: "Pretendard",
        data: pretendardBold,
        weight: 700,
        style: "normal",
      },
      { name: "Inter", data: interRegular, weight: 400, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
    ],
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
