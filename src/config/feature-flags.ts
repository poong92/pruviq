/**
 * SSoT for runtime feature flags.
 *
 * Phase 3b of the autotrading redesign plan: prior to this file,
 * `AUTOTRADE_COMING_SOON = true` was duplicated across 4 components
 * (OKXConnectButton, dashboard.astro, OKXConnectCTA, MobileStickyCTA).
 * Flipping the gate at Phase 4 production rollout therefore meant
 * editing 4 files in lockstep — drift-prone.
 *
 * AUTOTRADE_LIVE is the canonical signal, env-driven so the rollout PR
 * is a single workflow YAML change (data-deploy.yml `PUBLIC_AUTOTRADE_LIVE`
 * env value flip from 'false' → 'true'). AUTOTRADE_COMING_SOON is exported
 * as the inverted convenience to keep call-site JSX/logic unchanged from
 * the pre-Phase 3b code — no inversion bugs introduced as a side effect
 * of the refactor.
 *
 * Default (env unset) = false, which preserves the current
 * coming-soon behaviour. Phase 4 sets PUBLIC_AUTOTRADE_LIVE='true' in the
 * Astro build env to flip everything in one step.
 */

export const AUTOTRADE_LIVE: boolean =
  import.meta.env.PUBLIC_AUTOTRADE_LIVE === "true";

export const AUTOTRADE_COMING_SOON: boolean = !AUTOTRADE_LIVE;
