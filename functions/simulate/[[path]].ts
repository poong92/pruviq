/// <reference types="@cloudflare/workers-types" />

export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();
  const url = new URL(context.request.url);
  const wr = url.searchParams.get("wr");
  if (!wr) return response;

  const ogParams = new URLSearchParams();
  for (const key of ["strategy", "dir", "wr", "pf", "ret", "trades", "mdd"]) {
    const val = url.searchParams.get(key);
    if (val) ogParams.set(key, val);
  }
  const ogUrl = `https://api.pruviq.com/og?${ogParams.toString()}`;
  const strategy = (url.searchParams.get("strategy") || "Backtest").replace(
    /-/g,
    " ",
  );
  const title = `${strategy}: WR ${wr}%, PF ${url.searchParams.get("pf") || "?"}`;

  return new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute("content", ogUrl);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el) {
        el.setAttribute("content", ogUrl);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute("content", title);
      },
    })
    .transform(response);
};
