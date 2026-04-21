/// <reference types="@cloudflare/workers-types" />
//
// Minimal A/B + funnel event collector.
// POST /events with JSON { type, payload?, ts? }
//
// Write path:
//   1. Validates envelope (type is a known enum, size < 4KB)
//   2. Appends to a Cloudflare Log Push (via console.log — CF collects)
//   3. Returns 204 No Content
//
// Read path:
//   Grafana / Cloudflare dashboards ingest the console logs.
//   No DB dependency by design: this endpoint should never block the
//   user experience. If logging fails, we still return 204.
//
// Not covered (by design):
//   - Session stitching (Cloudflare already provides cf-ray)
//   - PII scrubbing — client must not send user-identifying data
//   - Rate limiting — Cloudflare's turnstile + 1 free / 10/min bot
//     rules handle floods at the edge

type EventEnvelope = {
  type: string;
  payload?: Record<string, unknown>;
  ts?: number;
};

// Closed set. Client can only fire these — prevents accidental PII/freeform.
const ALLOWED_EVENTS = new Set([
  // /simulate Quick Start funnel
  "sim.view",
  "sim.preset_click",
  "sim.run_succeeded",
  "sim.run_failed",
  "sim.skill_switch",
  "sim.csv_download",
  // CTA funnel
  "cta.connect_clicked",
  "cta.learn_more_clicked",
  "cta.sticky_clicked",
  // A/B variant enrollment
  "ab.enroll",
  "ab.convert",
]);

const MAX_BODY_BYTES = 4 * 1024;

export const onRequestPost: PagesFunction = async (context) => {
  const req = context.request;
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let body: EventEnvelope;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.type !== "string") {
    return new Response("invalid envelope", { status: 400 });
  }
  if (!ALLOWED_EVENTS.has(body.type)) {
    return new Response("unknown event", { status: 400 });
  }

  const cf = (req as unknown as { cf?: Record<string, unknown> }).cf ?? {};
  // Strip to safe allow-list, cap payload size by serialising and trimming.
  const payload =
    body.payload && typeof body.payload === "object"
      ? JSON.stringify(body.payload).slice(0, 1024)
      : null;

  // Single-line structured log → Cloudflare Log Push → Grafana Loki.
  console.log(
    JSON.stringify({
      kind: "pruviq_event",
      type: body.type,
      ts: body.ts ?? Date.now(),
      country: cf.country ?? null,
      colo: cf.colo ?? null,
      ray: req.headers.get("cf-ray") ?? null,
      referer: req.headers.get("referer") ?? null,
      payload,
    }),
  );

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
};

// OPTIONS passthrough for CORS preflight (same-origin by default; allowed
// for the future case where we host marketing pages on a different
// subdomain and want to fire events from there).
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "https://pruviq.com",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
    },
  });
};
