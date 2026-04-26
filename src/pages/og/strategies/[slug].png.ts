/**
 * /og/strategies/[slug].png — Per-strategy dynamic OG image (W3-1).
 *
 * Generates a 1200×630 PNG OG card per strategy via satori + resvg
 * at build time. Each strategy gets its own branded preview that
 * reads strategy frontmatter (name, status, profitFactor, winRate,
 * maxDrawdown) so social shares show the actual numbers — instead
 * of every share showing the same generic /og-image.jpg.
 *
 * Static export: `getStaticPaths()` enumerates all 8 strategy slugs;
 * `GET()` is invoked at build time and the response body is written
 * to `dist/og/strategies/[slug].png`.
 *
 * Font strategy:
 *   - Inter TTF fetched once from Google Fonts CDN at build start
 *   - Cached in module scope (subsequent calls reuse)
 *   - 700 weight for headings, 400 for body
 *
 * Visual:
 *   - Dark backdrop (#09090B) matching --color-bg
 *   - Cyan accent stripe + "PRUVIQ" wordmark
 *   - Strategy name (large)
 *   - Status badge (verified amber / killed red / shelved gray)
 *   - 3-stat row (PF / WR / MDD)
 *   - "Verify before you trade" tagline
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vendor-shipped Inter OTF (src/assets/fonts/) — kept out of public/ so it
// doesn't ship to clients. Read once at module scope, reused across all
// strategy slugs. process.cwd() resolves to the project root reliably both
// during dev and during the static build (where import.meta.url would point
// to dist/ instead).
const FONT_DIR = resolve(process.cwd(), "src/assets/fonts");
const fontRegular = readFileSync(resolve(FONT_DIR, "Inter-Regular.ttf"));
const fontBold = readFileSync(resolve(FONT_DIR, "Inter-Bold.ttf"));

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

const STATUS_LABELS: Record<StrategyData["status"], string> = {
  verified: "VERIFIED",
  testing: "IN REVIEW",
  killed: "KILLED",
  shelved: "SHELVED",
};

function buildOgTree(slug: string, data: StrategyData) {
  const accent = "#5CC8ED";
  const text = "#FAFAFA";
  const muted = "#A1A1AA";
  const bg = "#09090B";
  const cardBg = "rgba(255,255,255,0.04)";
  const statusColor = STATUS_COLORS[data.status];
  const statusLabel = STATUS_LABELS[data.status];

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
        fontFamily: "Inter",
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
                    letterSpacing: "0.15em",
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
              letterSpacing: "0.05em",
            },
            children: `${data.direction ? data.direction.toUpperCase() + " · " : ""}${slug}`,
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
              { label: "PF", value: pf, color: text },
              { label: "WIN RATE", value: wr, color: text },
              { label: "MAX DD", value: mdd, color: "#F87171" },
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
                        fontSize: 14,
                        color: muted,
                        letterSpacing: "0.15em",
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
              letterSpacing: "0.05em",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 20,
            },
            children: [
              {
                type: "div",
                props: { children: "Verify before you trade." },
              },
              {
                type: "div",
                props: {
                  style: { color: accent, fontWeight: 700 },
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
  const strategies = await getCollection("strategies");
  return strategies.map((s) => ({
    params: { slug: s.id },
  }));
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

  // satori expects a JSX-tree shape — we built a plain-object equivalent
  // via buildOgTree. Cast so satori's internal types accept it.
  const tree = buildOgTree(slug, data) as unknown as Parameters<
    typeof satori
  >[0];

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
      { name: "Inter", data: fontBold, weight: 700, style: "normal" },
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
