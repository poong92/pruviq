/**
 * /og/ko/blog/[slug].png — Korean-text dynamic OG for /ko/blog/[id] (W3-1f).
 *
 * Most KO blog posts have Korean titles + descriptions in their
 * frontmatter (see src/content/blog-ko/*.md). The default per-blog
 * endpoint /og/blog/[slug].png uses Inter only — when fed a Korean
 * title, Inter has zero glyph coverage for 한글 codepoints and the
 * preview renders as tofu blocks (□□□).
 *
 * This endpoint mirrors /og/blog with Pretendard added as the primary
 * font so KR titles render natively. Blog category labels stay
 * uppercase English (universal across PRUVIQ's content style).
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

const accent = "#5CC8ED";
const text = "#FAFAFA";
const muted = "#A1A1AA";
const bg = "#09090B";

const CATEGORY_COLORS: Record<string, string> = {
  market: "#5CC8ED",
  quant: "#A78BFA",
  strategy: "#22AB94",
  weekly: "#F59E0B",
  education: "#5CC8ED",
  autopsy: "#F23645",
};

const CATEGORY_LABELS_KO: Record<string, string> = {
  market: "시장 분석",
  quant: "퀀트",
  strategy: "전략 업데이트",
  weekly: "주간 리뷰",
  education: "교육",
  autopsy: "전략 부검",
};

interface BlogData {
  title: string;
  description: string;
  category: string;
  date: string;
}

function buildKoBlogTree(slug: string, data: BlogData) {
  const catColor = CATEGORY_COLORS[data.category] ?? accent;
  const catLabel =
    CATEGORY_LABELS_KO[data.category] ?? data.category.toUpperCase();

  const title =
    data.title.length > 100 ? `${data.title.slice(0, 97)}…` : data.title;
  const desc =
    data.description.length > 200
      ? `${data.description.slice(0, 197)}…`
      : data.description;

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        backgroundColor: bg,
        backgroundImage: `radial-gradient(circle at 80% 20%, rgba(44,181,232,0.08) 0%, transparent 60%)`,
        display: "flex",
        flexDirection: "column",
        padding: 64,
        // Pretendard primary so KR titles render; Inter fallback for ASCII
        fontFamily: "Pretendard, Inter",
        color: text,
      },
      children: [
        // Top bar: PRUVIQ wordmark + category badge
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
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "Inter",
                          fontSize: 16,
                          color: muted,
                          marginLeft: 4,
                        },
                        children: "/ blog",
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
                    border: `2px solid ${catColor}`,
                    backgroundColor: `${catColor}1F`,
                    color: catColor,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                  },
                  children: catLabel,
                },
              },
            ],
          },
        },
        // Spacer
        { type: "div", props: { style: { height: 60 } } },
        // KR title (Pretendard renders 한글)
        {
          type: "div",
          props: {
            style: {
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: "-0.01em",
              color: text,
            },
            children: title,
          },
        },
        // KR description preview
        {
          type: "div",
          props: {
            style: {
              marginTop: 24,
              fontSize: 22,
              color: muted,
              lineHeight: 1.5,
            },
            children: desc,
          },
        },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
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
                  style: { display: "flex", alignItems: "center", gap: 16 },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontFamily: "Inter" },
                        children: data.date,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { color: "rgba(255,255,255,0.15)" },
                        children: "·",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontFamily: "Inter" },
                        children: `/ko/blog/${slug}`,
                      },
                    },
                  ],
                },
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
  const ko = await getCollection("blog-ko");
  return ko.map((p) => ({ params: { slug: p.id } }));
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug as string;
  const ko = await getCollection("blog-ko");
  const entry = ko.find((p) => p.id === slug);
  if (!entry) {
    return new Response("not found", { status: 404 });
  }
  const data: BlogData = {
    title: entry.data.title,
    description: entry.data.description,
    category: entry.data.category,
    date: entry.data.date,
  };

  const tree = buildKoBlogTree(slug, data) as unknown as Parameters<
    typeof satori
  >[0];

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
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
