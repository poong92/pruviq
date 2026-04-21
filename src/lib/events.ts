// Lightweight fire-and-forget event emitter for /events endpoint.
//
// Design:
// - Uses navigator.sendBeacon when available → survives page unload.
// - Falls back to fetch with keepalive for Safari quirks.
// - Never throws; caller should never await the return value.
// - Events are closed-set (mirrors functions/events.ts validator).

export type PruviqEventType =
  | "sim.view"
  | "sim.preset_click"
  | "sim.run_succeeded"
  | "sim.run_failed"
  | "sim.skill_switch"
  | "sim.csv_download"
  | "cta.connect_clicked"
  | "cta.learn_more_clicked"
  | "cta.sticky_clicked"
  | "ab.enroll"
  | "ab.convert";

interface Envelope {
  type: PruviqEventType;
  payload?: Record<string, unknown>;
  ts?: number;
}

export function emit(
  type: PruviqEventType,
  payload?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const body: Envelope = { type, payload, ts: Date.now() };
  try {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/events", blob)) return;
    void fetch("/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // swallow — instrumentation must never break the page
  }
}

// Bucket helper: deterministic A/B enrollment keyed on a client-persistent
// random id (localStorage). Returns "a" or "b". Emits an enrollment event
// once per experiment per browser.
export function abBucket(experiment: string): "a" | "b" {
  if (typeof window === "undefined") return "a";
  try {
    const key = `pruviq_ab_${experiment}`;
    let bucket = localStorage.getItem(key) as "a" | "b" | null;
    if (bucket !== "a" && bucket !== "b") {
      bucket = Math.random() < 0.5 ? "a" : "b";
      localStorage.setItem(key, bucket);
      emit("ab.enroll", { experiment, bucket });
    }
    return bucket;
  } catch {
    return "a";
  }
}
