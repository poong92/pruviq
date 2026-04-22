// URL ↔ state SSoT for the /simulate redesign.
//
// Purpose: every Quick Start / Standard interaction (pick preset, change SL,
// switch skill mode) writes to the URL. Reload / share-link / browser back
// all reproduce the same screen. Becomes the one place that owns the
// "current simulation config" across the new simulator components.
//
// Boundaries:
// - Does NOT fetch from /simulate. Consumers do that themselves, keyed on
//   the config this hook returns.
// - Does NOT manage Expert builder state (indicators/conditions). Those
//   stay inside SimulatorPage.tsx legacy paths until Phase 3.
// - Uses history.replaceState so rapid param changes (e.g. slider drags)
//   don't pollute browser history.

import { useCallback, useEffect, useState } from "preact/hooks";
import {
  findPreset,
  QUICK_START_DEFAULT_PRESET_ID,
  type PresetDirection,
} from "../config/simulator-presets";
import {
  DEFAULT_SKILL_MODE,
  SIMULATOR_SKILL_MODES,
  type SimulatorSkillMode,
} from "../config/simulator-tokens";

export interface SimConfig {
  mode: SimulatorSkillMode;
  presetId: string | null;
  direction: PresetDirection;
  sl: number;
  tp: number;
  coin: string;
  topN: number;
  leverage: number;
  feePct: number;
  startDate: string;
  endDate: string;
}

const SL_MIN = 1;
const SL_MAX = 30;
const TP_MIN = 1;
const TP_MAX = 50;
const TOPN_MIN = 1;
const TOPN_MAX = 100;
const LEV_MIN = 1;
const LEV_MAX = 20;
const FEE_MIN = 0;
const FEE_MAX = 1;
const DIRECTIONS: readonly PresetDirection[] = ["long", "short", "both"];

const DEFAULT_TOP_N = 10;
const DEFAULT_LEVERAGE = 5;
const DEFAULT_FEE_PCT = 0.05;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseDirection(raw: string | null): PresetDirection | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return (DIRECTIONS as readonly string[]).includes(lower)
    ? (lower as PresetDirection)
    : null;
}

function parseMode(raw: string | null): SimulatorSkillMode | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return (SIMULATOR_SKILL_MODES as readonly string[]).includes(lower)
    ? (lower as SimulatorSkillMode)
    : null;
}

function parseNum(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clamp(n, min, max);
}

// Accept YYYY-MM-DD only; anything else rejects.
function parseDate(raw: string | null): string {
  if (!raw) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

type PresetDefaults = Pick<
  SimConfig,
  "presetId" | "direction" | "sl" | "tp" | "coin"
>;

function defaultsFromPreset(presetId: string | null): PresetDefaults {
  const preset = presetId ? findPreset(presetId) : undefined;
  if (preset) {
    return {
      presetId: preset.id,
      direction: preset.direction,
      sl: preset.defaults.sl,
      tp: preset.defaults.tp,
      coin: preset.defaults.coin,
    };
  }
  const fallback = findPreset(QUICK_START_DEFAULT_PRESET_ID);
  return {
    presetId: fallback?.id ?? QUICK_START_DEFAULT_PRESET_ID,
    direction: fallback?.direction ?? "short",
    sl: fallback?.defaults.sl ?? 10,
    tp: fallback?.defaults.tp ?? 8,
    coin: fallback?.defaults.coin ?? "BTC",
  };
}

function buildDefaults(presetId: string | null): SimConfig {
  return {
    mode: DEFAULT_SKILL_MODE,
    ...defaultsFromPreset(presetId),
    topN: DEFAULT_TOP_N,
    leverage: DEFAULT_LEVERAGE,
    feePct: DEFAULT_FEE_PCT,
    startDate: "",
    endDate: "",
  };
}

function readFromURL(): SimConfig {
  if (typeof window === "undefined") {
    return buildDefaults(null);
  }
  const params = new URLSearchParams(window.location.search);
  const rawPreset = params.get("preset");
  // 2026-04-22: if URL has `?preset=xxx` but xxx is not in SIMULATOR_PRESETS
  // (e.g. a stale link from when presets were fake, or the rankings Top 3
  // slugs that used to point at fabricated ids), we used to silently fall
  // back to the default preset while keeping the misleading `?preset=xxx`
  // in the URL. Now we warn + force-clean the URL so the user sees what's
  // actually active.
  let preset: string | null = null;
  if (rawPreset) {
    if (findPreset(rawPreset)) {
      preset = rawPreset;
    } else if (typeof console !== "undefined") {
      console.warn(
        `[useSimConfig] Unknown preset id in URL: "${rawPreset}". ` +
          `Falling back to "${QUICK_START_DEFAULT_PRESET_ID}". ` +
          `Valid ids: see src/config/simulator-presets.ts`,
      );
      // Clean the misleading param so re-share doesn't propagate confusion.
      try {
        const clean = new URL(window.location.href);
        clean.searchParams.delete("preset");
        window.history.replaceState({}, "", clean.toString());
      } catch {
        /* URL api unavailable — leave as-is */
      }
    }
  }
  const base = defaultsFromPreset(preset);

  const mode = parseMode(params.get("mode")) ?? DEFAULT_SKILL_MODE;
  const direction = parseDirection(params.get("dir")) ?? base.direction;
  const sl = parseNum(params.get("sl"), SL_MIN, SL_MAX) ?? base.sl;
  const tp = parseNum(params.get("tp"), TP_MIN, TP_MAX) ?? base.tp;
  const coinRaw = params.get("coin");
  const coin = coinRaw ? coinRaw.toUpperCase().slice(0, 12) : base.coin;
  const topN =
    parseNum(params.get("topN"), TOPN_MIN, TOPN_MAX) ?? DEFAULT_TOP_N;
  const leverage =
    parseNum(params.get("lev"), LEV_MIN, LEV_MAX) ?? DEFAULT_LEVERAGE;
  const feePct =
    parseNum(params.get("fee"), FEE_MIN, FEE_MAX) ?? DEFAULT_FEE_PCT;
  const startDate = parseDate(params.get("from"));
  const endDate = parseDate(params.get("to"));

  return {
    mode,
    presetId: base.presetId,
    direction,
    sl,
    tp,
    coin,
    topN,
    leverage,
    feePct,
    startDate,
    endDate,
  };
}

function writeToURL(next: SimConfig): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const p = url.searchParams;
  const setOrDefault = (key: string, value: string, def: string) => {
    if (value === def) p.delete(key);
    else p.set(key, value);
  };

  if (next.presetId) p.set("preset", next.presetId);
  else p.delete("preset");
  p.set("dir", next.direction);
  p.set("sl", String(next.sl));
  p.set("tp", String(next.tp));
  p.set("coin", next.coin);
  if (next.mode !== DEFAULT_SKILL_MODE) p.set("mode", next.mode);
  else p.delete("mode");
  setOrDefault("topN", String(next.topN), String(DEFAULT_TOP_N));
  setOrDefault("lev", String(next.leverage), String(DEFAULT_LEVERAGE));
  setOrDefault("fee", String(next.feePct), String(DEFAULT_FEE_PCT));
  if (next.startDate) p.set("from", next.startDate);
  else p.delete("from");
  if (next.endDate) p.set("to", next.endDate);
  else p.delete("to");

  const qs = p.toString();
  const newPath = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
  window.history.replaceState(null, "", newPath);
}

export interface StandardPatch {
  topN?: number;
  leverage?: number;
  feePct?: number;
  startDate?: string;
  endDate?: string;
}

export interface UseSimConfig {
  config: SimConfig;
  setMode: (mode: SimulatorSkillMode) => void;
  setPreset: (presetId: string) => void;
  setDirection: (direction: PresetDirection) => void;
  setSL: (sl: number) => void;
  setTP: (tp: number) => void;
  setCoin: (coin: string) => void;
  setStandard: (patch: StandardPatch) => void;
  reset: () => void;
}

export function useSimConfig(): UseSimConfig {
  const [config, setConfig] = useState<SimConfig>(() => readFromURL());

  useEffect(() => {
    writeToURL(config);
  }, [config]);

  const setMode = useCallback((mode: SimulatorSkillMode) => {
    setConfig((prev) => ({ ...prev, mode }));
  }, []);

  const setPreset = useCallback((presetId: string) => {
    const preset = findPreset(presetId);
    if (!preset) return;
    setConfig((prev) => ({
      ...prev,
      presetId: preset.id,
      direction: preset.direction,
      sl: preset.defaults.sl,
      tp: preset.defaults.tp,
      coin: preset.defaults.coin,
    }));
  }, []);

  const setDirection = useCallback((direction: PresetDirection) => {
    setConfig((prev) => ({ ...prev, direction }));
  }, []);

  const setSL = useCallback((sl: number) => {
    setConfig((prev) => ({ ...prev, sl: clamp(sl, SL_MIN, SL_MAX) }));
  }, []);

  const setTP = useCallback((tp: number) => {
    setConfig((prev) => ({ ...prev, tp: clamp(tp, TP_MIN, TP_MAX) }));
  }, []);

  const setCoin = useCallback((coin: string) => {
    const clean = coin.trim().toUpperCase().slice(0, 12);
    if (!clean) return;
    setConfig((prev) => ({ ...prev, coin: clean }));
  }, []);

  const setStandard = useCallback((patch: StandardPatch) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (patch.topN !== undefined)
        next.topN = clamp(patch.topN, TOPN_MIN, TOPN_MAX);
      if (patch.leverage !== undefined)
        next.leverage = clamp(patch.leverage, LEV_MIN, LEV_MAX);
      if (patch.feePct !== undefined)
        next.feePct = clamp(patch.feePct, FEE_MIN, FEE_MAX);
      if (patch.startDate !== undefined)
        next.startDate = parseDate(patch.startDate);
      if (patch.endDate !== undefined) next.endDate = parseDate(patch.endDate);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(buildDefaults(QUICK_START_DEFAULT_PRESET_ID));
  }, []);

  return {
    config,
    setMode,
    setPreset,
    setDirection,
    setSL,
    setTP,
    setCoin,
    setStandard,
    reset,
  };
}
