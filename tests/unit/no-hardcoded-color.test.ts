import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const ROOTS = ["src/components", "src/layouts", "src/pages"].map((p) =>
  join(ROOT, p),
);

// Tailwind utility scales that bypass the design-token system.
// Allowed exceptions: plain `white` / `black` are intentional UI primitives
// (modal overlays, "always-white-on-colored" labels, toggle thumbs).
const FORBIDDEN_SCALE =
  "(zinc|gray|slate|neutral|emerald|rose|amber|red|green|yellow|blue|cyan|purple|orange|sky|teal|lime|pink|indigo)";
const FORBIDDEN_RE = new RegExp(
  `(?<![-_a-zA-Z0-9:])(bg|text|border|ring|placeholder|divide|outline|fill|stroke)(?:-(?:hover|focus|active|group-hover|focus-within))?:?-${FORBIDDEN_SCALE}-[0-9]+(?:\\/[0-9]+)?\\b`,
);

// Hex literals inside class strings break theme swap.
const HEX_BG_RE = /\bbg-\[#[0-9a-fA-F]{3,8}\]/;

const SCAN_EXT = new Set([".tsx", ".ts", ".astro", ".jsx", ".js"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro"]);
// Files allowed to keep brand-specific hex (macOS traffic-light decorations).
const HEX_ALLOWLIST = ["src/components/ui/BrowserFrame.astro"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(full.slice(full.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));

describe("light/dark theme: no hardcoded color utilities", () => {
  test("forbidden Tailwind color scales are not used in markup", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const content = readFileSync(f, "utf8");
      const m = content.match(FORBIDDEN_RE);
      if (m) offenders.push(`${f.slice(ROOT.length + 1)}: ${m[0]}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  test("no inline hex backgrounds (bg-[#xxxxxx]) outside allowlist", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const rel = f.slice(ROOT.length + 1);
      if (HEX_ALLOWLIST.includes(rel)) continue;
      const content = readFileSync(f, "utf8");
      const m = content.match(HEX_BG_RE);
      if (m) offenders.push(`${rel}: ${m[0]}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
