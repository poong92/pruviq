// D6: probe component that wires D1 (presets) + D2 (tokens) + D4 (hook).
//
// Purpose: prove the foundation reads/writes URL correctly in a real
// browser before any Quick Start UI is built on top of it. Not shown in
// navigation; reached only via the /simulate/v2-probe route.
//
// What it renders:
// - Current config as pretty-printed JSON
// - A row of 7 preset buttons (calls setPreset)
// - SL +/- buttons (calls setSL), same for TP
// - Skill mode switcher (calls setMode)
// - Reset button
//
// A successful load = click → URL search params update → JSON re-renders
// with new values. Playwright can assert on both screen text and
// window.location.search.

import { SIMULATOR_PRESETS } from "../config/simulator-presets";
import {
  RISK_TOKENS,
  SIMULATOR_SKILL_MODES,
  SKILL_MODE_META,
} from "../config/simulator-tokens";
import { useSimConfig } from "../hooks/useSimConfig";

export default function SimV2Probe() {
  const { config, setMode, setPreset, setSL, setTP, reset } = useSimConfig();

  return (
    <div class="mx-auto max-w-3xl p-6 font-mono text-sm">
      <h1 class="mb-4 text-xl font-bold" data-testid="probe-title">
        /simulate v2 foundation probe
      </h1>
      <p class="mb-4 text-zinc-400">
        Internal diagnostic — verifies D1 presets + D2 tokens + D4 useSimConfig
        work together. Not linked from nav.
      </p>

      <pre
        class="mb-6 overflow-auto rounded border border-zinc-700 bg-zinc-900 p-4 text-emerald-300"
        data-testid="probe-config-json"
      >
        {JSON.stringify(config, null, 2)}
      </pre>

      <section class="mb-6">
        <h2 class="mb-2 font-bold">Skill mode</h2>
        <div class="flex flex-wrap gap-2">
          {SIMULATOR_SKILL_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              data-testid={`probe-mode-${m}`}
              class={`rounded border px-3 py-2 text-xs ${
                config.mode === m
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {SKILL_MODE_META[m].label.en}
            </button>
          ))}
        </div>
      </section>

      <section class="mb-6">
        <h2 class="mb-2 font-bold">
          Preset ({SIMULATOR_PRESETS.length} curated)
        </h2>
        <div class="flex flex-wrap gap-2">
          {SIMULATOR_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              data-testid={`probe-preset-${p.id}`}
              class={`rounded border px-3 py-2 text-xs ${
                config.presetId === p.id
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              <span
                class={`mr-2 inline-block h-2 w-2 rounded-full ${RISK_TOKENS[p.risk].dot}`}
              />
              {p.labels.en}
            </button>
          ))}
        </div>
      </section>

      <section class="mb-6 flex gap-6">
        <div>
          <h2 class="mb-2 font-bold">SL: {config.sl}%</h2>
          <div class="flex gap-2">
            <button
              type="button"
              data-testid="probe-sl-down"
              onClick={() => setSL(config.sl - 1)}
              class="rounded border border-zinc-700 px-3 py-2 text-xs"
            >
              −1
            </button>
            <button
              type="button"
              data-testid="probe-sl-up"
              onClick={() => setSL(config.sl + 1)}
              class="rounded border border-zinc-700 px-3 py-2 text-xs"
            >
              +1
            </button>
          </div>
        </div>
        <div>
          <h2 class="mb-2 font-bold">TP: {config.tp}%</h2>
          <div class="flex gap-2">
            <button
              type="button"
              data-testid="probe-tp-down"
              onClick={() => setTP(config.tp - 1)}
              class="rounded border border-zinc-700 px-3 py-2 text-xs"
            >
              −1
            </button>
            <button
              type="button"
              data-testid="probe-tp-up"
              onClick={() => setTP(config.tp + 1)}
              class="rounded border border-zinc-700 px-3 py-2 text-xs"
            >
              +1
            </button>
          </div>
        </div>
      </section>

      <button
        type="button"
        data-testid="probe-reset"
        onClick={reset}
        class="rounded border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
      >
        Reset to default
      </button>
    </div>
  );
}
