/**
 * /og/home.png — Homepage dynamic OG image (W3-1b).
 *
 * Single static endpoint (no params) that ships a dedicated OG card
 * for the most-shared URL: pruviq.com / and pruviq.com/ko/.
 *
 * Visual differs from per-strategy OGs (W3-1, #1437):
 *   - Hero-tier title "Verify before you trade." (the brand promise)
 *   - 4-stat row: 240 coins · 14 indicators · 2+ years data · free
 *   - PRUVIQ wordmark prominent
 *   - Same dark backdrop + cyan accent for visual consistency
 *
 * Built once at static build via `prerender = true`. Output:
 * dist/og/home.png (~80 KB).
 */
import type { APIRoute } from "astro";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COINS_ANALYZED } from "../../config/site-stats";

const FONT_DIR = resolve(process.cwd(), "src/assets/fonts");
const fontRegular = readFileSync(resolve(FONT_DIR, "Inter-Regular.ttf"));
const fontBold = readFileSync(resolve(FONT_DIR, "Inter-Bold.ttf"));

export const prerender = true;

const accent = "#5CC8ED";
const text = "#FAFAFA";
const muted = "#A1A1AA";
const bg = "#09090B";
const cardBg = "rgba(255,255,255,0.04)";

function buildHomeTree() {
  const stats = [
    { label: "COINS", value: String(COINS_ANALYZED) },
    { label: "INDICATORS", value: "14" },
    { label: "YEARS DATA", value: "2+" },
    { label: "PRICE", value: "FREE" },
  ];

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        backgroundColor: bg,
        backgroundImage: `radial-gradient(circle at 80% 20%, rgba(44,181,232,0.12) 0%, transparent 60%)`,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        fontFamily: "Inter",
        color: text,
      },
      children: [
        // Top: PRUVIQ wordmark
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: 14 },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    width: 20,
                    height: 20,
                    backgroundColor: accent,
                    borderRadius: 5,
                  },
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 28,
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
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // Hero title
        {
          type: "div",
          props: {
            style: {
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: text,
            },
            children: "Verify before",
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: accent,
              marginBottom: 8,
            },
            children: "you trade.",
          },
        },
        {
          type: "div",
          props: {
            style: {
              marginTop: 12,
              fontSize: 24,
              color: muted,
              maxWidth: 900,
            },
            children:
              "Free crypto strategy backtester. Build, test, share verified results — including the failures.",
          },
        },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // 4-stat row
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              gap: 16,
              marginBottom: 24,
            },
            children: stats.map((s) => ({
              type: "div",
              props: {
                style: {
                  flex: 1,
                  padding: "16px 20px",
                  borderRadius: 10,
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
                        fontSize: 12,
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
                        marginTop: 6,
                        fontSize: 36,
                        fontWeight: 700,
                        color: text,
                      },
                      children: s.value,
                    },
                  },
                ],
              },
            })),
          },
        },
        // Footer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 18,
              color: muted,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 18,
            },
            children: [
              {
                type: "div",
                props: { children: "Don't Believe. Verify." },
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

export const GET: APIRoute = async () => {
  const tree = buildHomeTree() as unknown as Parameters<typeof satori>[0];
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
