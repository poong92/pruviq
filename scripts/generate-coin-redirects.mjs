/**
 * Generate case-insensitive redirects for /coins/ pages.
 * Appends UPPERCASE -> lowercase 301 redirects to public/_redirects.
 * Cloudflare Pages _redirects limit: 2000 lines.
 */
import { readFileSync, appendFileSync } from "fs";

const src = readFileSync("src/data/coin-symbols.ts", "utf8");
const symbols = [...src.matchAll(/'([A-Z0-9]+)'/g)].map(m => m[1]);

const redirectsFile = "public/_redirects";
const existing = readFileSync(redirectsFile, "utf8");

if (existing.includes("# Auto-generated coin case redirects")) {
  console.log("Coin redirects already present, skipping.");
  process.exit(0);
}

const lines = ["\n# Auto-generated coin case redirects (do not edit below this line)"];
for (const s of symbols) {
  const slug = s.toLowerCase();
  lines.push("/coins/" + s + "/ /coins/" + slug + "/ 301");
  lines.push("/ko/coins/" + s + "/ /ko/coins/" + slug + "/ 301");
}

appendFileSync(redirectsFile, lines.join("\n") + "\n");
console.log("Added " + (lines.length - 1) + " redirect rules for " + symbols.length + " coins.");
