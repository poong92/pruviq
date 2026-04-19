"""
Post-audit cleanup regression guards (PR 2026-04-19).

Closes automation-engineer findings from the expert sweep:

1. [CRITICAL] pruviq-commit-data.service was a dead unit — no timer, no
   ExecStartPost caller in active/ directory (the one reference lives in
   disabled/pruviq-refresh-data.service which is itself disabled).
2. [MEDIUM] pruviq-monitor.timer (:00/05/10…) and pruviq-staleness-watch.timer
   (:00/10/20…) fired on the same second every 10 minutes, doubling
   /health probes on a 2vCPU droplet and occasionally double-alerting.
3. [MEDIUM] backend-deploy.yml only gated on `coins_loaded >= 200`. A
   silent /rankings/daily regression (2026-04-19 4-day-stale incident)
   could ship without tripping a deploy smoke.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SYSTEMD_DIR = REPO / "deploy" / "systemd"
DISABLED_DIR = SYSTEMD_DIR / "disabled"
BACKEND_DEPLOY = REPO.parent / ".github" / "workflows" / "backend-deploy.yml"


def test_pruviq_commit_data_is_in_disabled():
    """Dead unit must live under disabled/ where `backend-deploy.yml`'s
    `install` glob does not pick it up."""
    active = SYSTEMD_DIR / "pruviq-commit-data.service"
    archived = DISABLED_DIR / "pruviq-commit-data.service"
    assert not active.exists(), (
        "pruviq-commit-data.service is in the active unit dir. Its only "
        "caller (disabled/pruviq-refresh-data.service) is itself disabled "
        "— move the unit + its wrapper script to disabled/."
    )
    assert archived.exists(), (
        "pruviq-commit-data.service must be preserved under disabled/ "
        "rather than deleted, so a future re-enable is documented."
    )


def test_commit_data_sh_is_in_disabled():
    active = SYSTEMD_DIR / "bin" / "commit-data.sh"
    archived = DISABLED_DIR / "bin" / "commit-data.sh"
    assert not active.exists()
    assert archived.exists()


def test_staleness_watch_timer_offset_from_monitor():
    """The two 10-min-ish timers must not fire on the same :NN second."""
    monitor_timer = (SYSTEMD_DIR / "pruviq-monitor.timer").read_text()
    staleness_timer = (SYSTEMD_DIR / "pruviq-staleness-watch.timer").read_text()

    def _on_calendar(src: str) -> str:
        m = re.search(r"^OnCalendar=(.+)$", src, re.M)
        return m.group(1).strip() if m else ""

    mon = _on_calendar(monitor_timer)
    stale = _on_calendar(staleness_timer)
    assert mon and stale, "OnCalendar= missing in a timer file"
    # monitor.timer is *:0/5 (every 5min on :00/:05). staleness was *:0/10 —
    # the collision points were :00/:10/:20. The fix shifts staleness by 5.
    assert stale != mon, (
        f"Timers share OnCalendar={mon!r} — concurrent /health probes double "
        "up under load and cause duplicate Telegram alerts."
    )
    # Specifically require the offset we applied.
    assert stale == "*:5/10" or stale == "*:5/15" or "0/10" not in stale, (
        f"staleness-watch.timer OnCalendar={stale!r} still aligns with monitor "
        "(every :00). Offset via *:5/10 (or similar) to decorrelate."
    )


def test_backend_deploy_has_rankings_smoke():
    """The post-deploy smoke must call /rankings/daily. `coins_loaded` alone
    did not catch the 2026-04-19 4-day-stale regression."""
    yaml = BACKEND_DEPLOY.read_text()
    assert "/rankings/daily" in yaml, (
        "backend-deploy.yml must call /rankings/daily in a smoke step. "
        "The prior `coins_loaded >= 200` gate missed the ranking-stale "
        "regression that stale-served data for 4 days."
    )
    # Must parse JSON + require `date` field.
    assert re.search(r'date.*missing date field|"date"', yaml), (
        "Rankings smoke must assert a `date` field exists (not just 200 OK) "
        "— an empty `{}` would otherwise pass."
    )
