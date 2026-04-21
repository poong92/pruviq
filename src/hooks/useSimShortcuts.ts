// Keyboard shortcuts for /simulate/ Quick Start + Standard.
//   ← / →         cycle through SIMULATOR_PRESETS
//   1-7           jump to Nth preset
//   q / s         switch skill mode (Quick / Standard)
//   e             open /simulate/builder/ (Expert)
//   r             reset to default
//   ?             open help panel (consumer handles display)
//
// Keys ignore events originating from input, textarea, select, or
// contentEditable so typing in the Standard controls doesn't trigger
// shortcuts. Event listener attaches/detaches on mount.

import { useEffect } from "preact/hooks";
import { SIMULATOR_PRESETS } from "../config/simulator-presets";
import type { SimulatorSkillMode } from "../config/simulator-tokens";

interface Handlers {
  currentPresetId: string | null;
  setPreset: (id: string) => void;
  setMode: (mode: SimulatorSkillMode) => void;
  reset: () => void;
  onHelp?: () => void;
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useSimShortcuts(h: Handlers): void {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const idx = SIMULATOR_PRESETS.findIndex(
        (p) => p.id === h.currentPresetId,
      );

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          const next = idx < 0 ? 0 : (idx + 1) % SIMULATOR_PRESETS.length;
          h.setPreset(SIMULATOR_PRESETS[next].id);
          return;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const prev = idx <= 0 ? SIMULATOR_PRESETS.length - 1 : idx - 1;
          h.setPreset(SIMULATOR_PRESETS[prev].id);
          return;
        }
        case "q":
        case "Q":
          e.preventDefault();
          h.setMode("quick");
          return;
        case "s":
        case "S":
          e.preventDefault();
          h.setMode("standard");
          return;
        case "e":
        case "E":
          e.preventDefault();
          if (typeof window !== "undefined") {
            const path = window.location.pathname.startsWith("/ko")
              ? "/ko/simulate/builder/"
              : "/simulate/builder/";
            window.location.assign(path);
          }
          return;
        case "r":
        case "R":
          e.preventDefault();
          h.reset();
          return;
        case "?":
          if (h.onHelp) {
            e.preventDefault();
            h.onHelp();
          }
          return;
        default:
          if (/^[1-7]$/.test(e.key)) {
            e.preventDefault();
            const pick = Number(e.key) - 1;
            if (SIMULATOR_PRESETS[pick])
              h.setPreset(SIMULATOR_PRESETS[pick].id);
          }
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [h.currentPresetId, h.setPreset, h.setMode, h.reset, h.onHelp]);
}
