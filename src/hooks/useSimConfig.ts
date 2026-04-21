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
}

const SL_MIN = 1;
const SL_MAX = 30;
const TP_MIN = 1;
const TP_MAX = 50;
const DIRECTIONS: readonly PresetDirection[] = ["long", "short", "both"];

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

function defaultsFromPreset(presetId: string | null): Omit<SimConfig, "mode"> {
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

function readFromURL(): SimConfig {
  if (typeof window === "undefined") {
    return { mode: DEFAULT_SKILL_MODE, ...defaultsFromPreset(null) };
  }
  const params = new URLSearchParams(window.location.search);
  const rawPreset = params.get("preset");
  const preset = rawPreset && findPreset(rawPreset) ? rawPreset : null;
  const base = defaultsFromPreset(preset);

  const mode = parseMode(params.get("mode")) ?? DEFAULT_SKILL_MODE;
  const direction = parseDirection(params.get("dir")) ?? base.direction;
  const sl = parseNum(params.get("sl"), SL_MIN, SL_MAX) ?? base.sl;
  const tp = parseNum(params.get("tp"), TP_MIN, TP_MAX) ?? base.tp;
  const coinRaw = params.get("coin");
  const coin = coinRaw ? coinRaw.toUpperCase().slice(0, 12) : base.coin;

  return { mode, presetId: base.presetId, direction, sl, tp, coin };
}

function writeToURL(next: SimConfig): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const p = url.searchParams;
  if (next.presetId) p.set("preset", next.presetId);
  else p.delete("preset");
  p.set("dir", next.direction);
  p.set("sl", String(next.sl));
  p.set("tp", String(next.tp));
  p.set("coin", next.coin);
  if (next.mode !== DEFAULT_SKILL_MODE) p.set("mode", next.mode);
  else p.delete("mode");
  const qs = p.toString();
  const newPath = `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`;
  window.history.replaceState(null, "", newPath);
}

export interface UseSimConfig {
  config: SimConfig;
  setMode: (mode: SimulatorSkillMode) => void;
  setPreset: (presetId: string) => void;
  setDirection: (direction: PresetDirection) => void;
  setSL: (sl: number) => void;
  setTP: (tp: number) => void;
  setCoin: (coin: string) => void;
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

  const reset = useCallback(() => {
    const defaults = {
      mode: DEFAULT_SKILL_MODE,
      ...defaultsFromPreset(QUICK_START_DEFAULT_PRESET_ID),
    };
    setConfig(defaults);
  }, []);

  return {
    config,
    setMode,
    setPreset,
    setDirection,
    setSL,
    setTP,
    setCoin,
    reset,
  };
}
