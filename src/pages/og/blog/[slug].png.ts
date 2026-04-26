/**
 * /og/blog/[slug].png — Per-blog-post dynamic OG (W3-1c).
 *
 * Generates 1200×630 PNG OG cards for both EN and KO blog posts.
 * Each post gets its own preview with title, category, date.
 *
 * Posts that ship a custom `image` in frontmatter keep using that
 * (BlogPost.astro layout passes the image through). Posts without
 * a custom image now reference the dynamic PNG generated here
 * instead of the generic /og-image.jpg fallback.
 *
 * Slug uniqueness: EN and KO blog collections can share slugs (same
 * post in two languages). The endpoint serves both — it loads from
 * the EN collection first and falls back to KO if EN is missing
 * (some posts are KO-only).
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
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

const CATEGORY_COLORS: Record<string, string> = {
  market: "#5CC8ED", // accent
  quant: "#A78BFA", // violet
  strategy: "#22AB94", // up green
  weekly: "#F59E0B", // amber
  education: "#5CC8ED",
  autopsy: "#F23645", // down red
};

const CATEGORY_LABELS: Record<string, string> = {
  market: "MARKET",
  quant: "QUANT",
  strategy: "STRATEGY",
  weekly: "WEEKLY",
  education: "EDUCATION",
  autopsy: "AUTOPSY",
};

interface BlogData {
  title: string;
  description: string;
  category: string;
  date: string;
}

function buildBlogTree(slug: string, data: BlogData) {
  const catColor = CATEGORY_COLORS[data.category] ?? accent;
  const catLabel =
    CATEGORY_LABELS[data.category] ?? data.category.toUpperCase();

  // Truncate long titles to fit 2 lines reasonably
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
        fontFamily: "Inter",
        color: text,
      },
      children: [
        // Top: PRUVIQ wordmark + category badge
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
                    letterSpacing: "0.18em",
                  },
                  children: catLabel,
                },
              },
            ],
          },
        },
        // Spacer
        { type: "div", props: { style: { height: 60 } } },
        // Title
        {
          type: "div",
          props: {
            style: {
              fontSize: 60,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: text,
            },
            children: title,
          },
        },
        // Description (smaller)
        {
          type: "div",
          props: {
            style: {
              marginTop: 24,
              fontSize: 22,
              color: muted,
              lineHeight: 1.4,
            },
            children: desc,
          },
        },
        // Spacer
        { type: "div", props: { style: { flex: 1 } } },
        // Footer: date + slug + cta
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
                      props: { children: data.date },
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
                      props: { children: `/blog/${slug}` },
                    },
                  ],
                },
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
  const en = await getCollection("blog");
  const ko = await getCollection("blog-ko");
  // Use union of slugs (some posts may exist only in KO)
  const slugSet = new Set<string>();
  for (const p of en) slugSet.add(p.id);
  for (const p of ko) slugSet.add(p.id);
  return Array.from(slugSet).map((slug) => ({ params: { slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug as string;
  const en = await getCollection("blog");
  const ko = await getCollection("blog-ko");
  const entry = en.find((p) => p.id === slug) ?? ko.find((p) => p.id === slug);
  if (!entry) {
    return new Response("not found", { status: 404 });
  }
  const data: BlogData = {
    title: entry.data.title,
    description: entry.data.description,
    category: entry.data.category,
    date: entry.data.date,
  };

  const tree = buildBlogTree(slug, data) as unknown as Parameters<
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
