import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.string(),
  category: z.enum([
    "market",
    "quant",
    "strategy",
    "weekly",
    "education",
    "autopsy",
  ]),
  tags: z.array(z.string()).optional(),
  author: z.string().optional().default("PRUVIQ Research"),
  image: z.string().optional(),
});

const strategySchema = z.object({
  name: z.string(),
  description: z.string(),
  status: z.enum(["verified", "testing", "killed", "shelved"]),
  category: z.enum([
    "mean-reversion",
    "momentum",
    "breakout",
    "volatility",
    "hybrid",
  ]),
  direction: z.enum(["long", "short", "both"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  winRate: z.number().optional(),
  profitFactor: z.number().optional(),
  maxDrawdown: z.number().optional(),
  totalPnl: z.string().optional(),
  timeframe: z.string(),
  dataPoints: z.number().optional(),
  coins: z.number().optional(),
  dateAdded: z.string(),
  dateKilled: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: blogSchema,
});

const strategies = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/strategies" }),
  schema: strategySchema,
});

const blogKo = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog-ko" }),
  schema: blogSchema,
});

const strategiesKo = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/strategies-ko" }),
  schema: strategySchema,
});

export const collections = {
  blog,
  strategies,
  "blog-ko": blogKo,
  "strategies-ko": strategiesKo,
};
