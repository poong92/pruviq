/**
 * /og/coins/[symbol].png — Per-coin dynamic OG (W3-1d).
 *
 * Generates 1200×630 PNG OG cards for each tracked coin (235 symbols).
 * Each share shows: coin name + symbol, current price, 24h change
 * with up/down color, market cap rank, mini sparkline drawn from
 * the 7-day series in coins-stats.json.
 *
 * Build cost: ~80ms per coin × 235 ≈ 19s additional build time.
 * Acceptable for the social-sharing lift.
 */
import type { APIRoute } from "astro";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FONT_DIR = resolve(process.cwd(), "src/assets/fonts");
const fontRegular = readFileSync(resolve(FONT_DIR, "Inter-Regular.ttf"));
const fontBold = readFileSync(resolve(FONT_DIR, "Inter-Bold.ttf"));

const accent = "#5CC8ED";
const text = "#FAFAFA";
const muted = "#A1A1AA";
const bg = "#09090B";
const cardBg = "rgba(255,255,255,0.04)";
const up = "#22AB94";
const down = "#F23645";

interface CoinEntry {
  symbol: string;
  name: string;
  price: number;
  change_1h?: number;
  change_24h?: number;
  change_7d?: number;
  market_cap_rank?: number;
  volume_24h?: number;
  sparkline_7d?: number[];
}

interface CoinsFile {
  generated: string;
  total_coins: number;
  coins: CoinEntry[];
}

let cachedCoins: CoinsFile | null = null;
function loadCoins(): CoinsFile {
  if (!cachedCoins) {
    const path = resolve(process.cwd(), "public/data/coins-stats.json");
    cachedCoins = JSON.parse(readFileSync(path, "utf-8")) as CoinsFile;
  }
  return cachedCoins;
}

function formatPrice(p: number): string {
  if (p >= 10000)
    return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 100) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 3 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * Build sparkline path string from a series of prices, normalized to a
 * 360×60 viewBox area inside the OG card.
 */
function sparklinePath(values: number[], w = 360, h = 60): string {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pad = 4;
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildCoinTree(coin: CoinEntry) {
  const change = coin.change_24h ?? 0;
  const changeColor = change >= 0 ? up : down;
  const changeSign = change >= 0 ? "+" : "";
  const sparkPath = sparklinePath(coin.sparkline_7d ?? []);
  const rank = coin.market_cap_rank ? `#${coin.market_cap_rank}` : "—";
  const symbol = coin.symbol.replace(/USDT$/i, "");

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        backgroundColor: bg,
        backgroundImage: `radial-gradient(circle at ${change >= 0 ? "80% 20%" : "20% 80%"}, ${change >= 0 ? "rgba(34,171,148,0.10)" : "rgba(242,54,69,0.10)"} 0%, transparent 60%)`,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        fontFamily: "Inter",
        color: text,
      },
      children: [
        // Top: PRUVIQ + rank badge
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
                          fontSize: 22,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: text,
                        },
                        children: "PRUVIQ",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 16, color: muted, marginLeft: 4 },
                        children: "/ coins",
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: `1.5px solid rgba(255,255,255,0.18)`,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: text,
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                  },
                  children: `RANK ${rank}`,
                },
              },
            ],
          },
        },
        // Spacer
        { type: "div", props: { style: { height: 50 } } },
        // Coin symbol + name
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "baseline", gap: 18 },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 80,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: text,
                  },
                  children: symbol,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 30,
                    color: muted,
                    fontWeight: 400,
                  },
                  children: coin.name,
                },
              },
            ],
          },
        },
        // Price + 24h change
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "baseline",
              gap: 24,
              marginTop: 18,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 56,
                    fontWeight: 700,
                    color: text,
                  },
                  children: `$${formatPrice(coin.price)}`,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 28,
                    fontWeight: 700,
                    color: changeColor,
                  },
                  children: `${changeSign}${change.toFixed(2)}% (24h)`,
                },
              },
            ],
          },
        },
        // Sparkline
        sparkPath
          ? {
              type: "div",
              props: {
                style: {
                  marginTop: 28,
                  width: 360,
                  height: 60,
                  display: "flex",
                },
                children: [
                  {
                    type: "svg",
                    props: {
                      width: 360,
                      height: 60,
                      viewBox: "0 0 360 60",
                      style: { overflow: "visible" },
                      children: [
                        {
                          type: "path",
                          props: {
                            d: sparkPath,
                            fill: "none",
                            stroke: changeColor,
                            "stroke-width": 2,
                            "stroke-linejoin": "round",
                            "stroke-linecap": "round",
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            }
          : { type: "div", props: { style: { height: 60 } } },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // Stats row
        {
          type: "div",
          props: {
            style: { display: "flex", gap: 16, marginBottom: 24 },
            children: [
              {
                label: "1H",
                value: `${(coin.change_1h ?? 0) >= 0 ? "+" : ""}${(coin.change_1h ?? 0).toFixed(2)}%`,
                color: (coin.change_1h ?? 0) >= 0 ? up : down,
              },
              {
                label: "7D",
                value: `${(coin.change_7d ?? 0) >= 0 ? "+" : ""}${(coin.change_7d ?? 0).toFixed(2)}%`,
                color: (coin.change_7d ?? 0) >= 0 ? up : down,
              },
              {
                label: "VOLUME 24H",
                value: coin.volume_24h ? formatVolume(coin.volume_24h) : "—",
                color: text,
              },
            ].map((s) => ({
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
                        fontSize: 28,
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
                props: { children: `Backtest crypto strategies on ${symbol}` },
              },
              {
                type: "div",
                props: {
                  style: { color: accent, fontWeight: 700 },
                  children: `pruviq.com/coins/${symbol.toLowerCase()}usdt`,
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
  const data = loadCoins();
  return data.coins.map((c) => ({
    params: { symbol: c.symbol.toLowerCase() },
  }));
}

export const GET: APIRoute = async ({ params }) => {
  const symbol = (params.symbol as string).toUpperCase();
  const data = loadCoins();
  const coin = data.coins.find((c) => c.symbol === symbol);
  if (!coin) {
    return new Response("not found", { status: 404 });
  }

  const tree = buildCoinTree(coin) as unknown as Parameters<typeof satori>[0];
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
      "Cache-Control": "public, max-age=86400",
    },
  });
};
