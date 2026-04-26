/**
 * /og/simulate.png — Simulator page dynamic OG image (W3-1b).
 *
 * Tailored for /simulate share — emphasizes the "test → see results
 * in 3 seconds" loop that's the core simulator value prop.
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
const up = "#22AB94";

function buildSimulateTree() {
  const steps = [
    { num: "1.", label: "SELECT", desc: "Pick or build a strategy" },
    { num: "2.", label: "SIMULATE", desc: `Run on ${COINS_ANALYZED} coins` },
    { num: "3.", label: "VERIFY", desc: "PF · WR · MDD · trades" },
  ];

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        backgroundColor: bg,
        backgroundImage: `radial-gradient(circle at 20% 80%, rgba(34,171,148,0.10) 0%, transparent 55%)`,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        fontFamily: "Inter",
        color: text,
      },
      children: [
        // Top: PRUVIQ + section badge
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
              {
                type: "div",
                props: {
                  style: {
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: `2px solid ${accent}`,
                    backgroundColor: `${accent}1F`,
                    color: accent,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                  },
                  children: "SIMULATOR",
                },
              },
            ],
          },
        },
        // Spacer
        { type: "div", props: { style: { height: 60 } } },
        // Hero
        {
          type: "div",
          props: {
            style: {
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            },
            children: "Backtest a strategy in",
          },
        },
        {
          type: "div",
          props: {
            style: {
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: up,
            },
            children: "under 3 seconds.",
          },
        },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // 3-step row
        {
          type: "div",
          props: {
            style: { display: "flex", gap: 20, marginBottom: 32 },
            children: steps.map((s) => ({
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
                        fontSize: 30,
                        fontWeight: 700,
                        color: accent,
                        marginBottom: 4,
                      },
                      children: s.num,
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 14,
                        letterSpacing: "0.2em",
                        fontWeight: 700,
                        color: text,
                      },
                      children: s.label,
                    },
                  },
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 18,
                        marginTop: 6,
                        color: muted,
                      },
                      children: s.desc,
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
                props: {
                  children: "Free. No signup. Verify before you trade.",
                },
              },
              {
                type: "div",
                props: {
                  style: { color: accent, fontWeight: 700 },
                  children: "pruviq.com/simulate",
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
  const tree = buildSimulateTree() as unknown as Parameters<typeof satori>[0];
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
