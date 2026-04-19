"""
backend-deploy.yml rollback automation regression guard (PR 2026-04-19).

Before this PR, a bad main commit that bricked `/health` left the broken
SHA running until an operator SSH'd in to `git reset` + `systemctl restart`.
architecture-audit agent flagged "배포 롤백 없음 — health gate 얕음" as HIGH.

This test proves the workflow now:
  1. Captures the prior SHA BEFORE `git reset --hard origin/main`
  2. Triggers a rollback step on health-gate failure
  3. Alerts via Telegram when rollback happens
  4. Guards against rollback-of-rollback loops (prev == current short-circuit)
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
WORKFLOW = REPO / ".github" / "workflows" / "backend-deploy.yml"


def _yaml() -> str:
    return WORKFLOW.read_text()


def test_captures_prev_sha_before_reset():
    """Step order matters: prev_sha must be saved BEFORE git reset."""
    src = _yaml()
    capture_pos = src.find("Capture pre-deploy SHA for rollback")
    reset_pos = src.find("Pull latest code on DO")
    assert 0 < capture_pos < reset_pos, (
        "Capture pre-deploy SHA step must appear BEFORE 'Pull latest code'. "
        "Otherwise reset overwrites HEAD and prev_sha points to the bad commit."
    )
    # prev_sha path agreed on
    assert "/opt/pruviq/rollback/prev_sha" in src


def test_rollback_step_runs_only_on_health_failure():
    """Rollback must fire only when wait_for_health fails — not on unrelated
    failures (deps install, ssh keyscan, etc.) which have their own signals."""
    src = _yaml()
    # Ensure wait_for_health has an id (required for outcome reference)
    assert re.search(r"id:\s*wait_for_health", src), (
        "Wait-for-health step must have `id: wait_for_health` so the "
        "rollback condition can scope to it."
    )
    # The rollback `if:` must reference wait_for_health.outcome == 'failure'
    assert re.search(
        r"steps\.wait_for_health\.outcome\s*==\s*'failure'", src,
    ), (
        "Rollback `if:` must gate on wait_for_health.outcome == 'failure' "
        "to avoid rolling back for unrelated failures."
    )


def test_rollback_has_loop_guard():
    """prev == current short-circuit — prevents rollback-of-rollback loop
    when the rollback commit itself triggers another bad deploy cycle."""
    src = _yaml()
    # The rollback block must compare PREV and CUR and abort if equal
    assert re.search(r'PREV.*=.*CUR|CUR.*=.*PREV', src), (
        "Rollback must compare current HEAD to prev SHA and short-circuit "
        "if equal, else two consecutive bad deploys loop the rollback."
    )
    # And there should be a documented skip message
    assert re.search(
        r"(rollback-of-rollback|loop guard|already on prev)",
        src,
        re.IGNORECASE,
    )


def test_rollback_reruns_health_gate():
    """After reset + restart, health must be re-verified. A failed rollback
    must surface to the operator (exit 1 + Telegram), not silently success."""
    src = _yaml()
    # Expect the rollback block to include a second polling loop + an
    # explicit "rollback restart ALSO failed" message.
    assert re.search(
        r"rollback restart ALSO failed",
        src,
    ), (
        "Rollback step must re-verify /health and surface failure — "
        "silent 'rollback OK' when rollback actually failed is worse "
        "than the original bug."
    )


def test_rollback_alerts_via_telegram():
    """Operator should know a rollback happened without polling the Actions UI."""
    src = _yaml()
    assert "Telegram alert on rollback" in src
    assert "PRUVIQ_TELEGRAM_TOKEN" in src
    assert "PRUVIQ_TELEGRAM_CHAT_ID" in src


def test_rollback_syncs_systemd_units_on_revert():
    """git reset doesn't propagate to /etc/systemd/system/ or /opt/pruviq/bin/.
    Rollback must re-run `install` so unit definitions match prev SHA, else
    a reverted code base runs with new unit files → mismatched env/timeouts."""
    src = _yaml()
    # The rollback run block must contain install -o ... for both wrapper
    # scripts (pruviq:pruviq mode 0755) and unit files (root mode 0644).
    # We assert both by looking for the familiar patterns inside the
    # rollback step body (between "Rollback on health failure" and
    # "Telegram alert on rollback").
    m = re.search(
        r"Rollback on health failure.*?Telegram alert on rollback",
        src,
        re.DOTALL,
    )
    assert m, "rollback block not found"
    block = m.group(0)
    assert "install -o pruviq -g pruviq" in block, (
        "rollback block must re-install wrapper scripts from reverted tree"
    )
    assert "install -o root -g root" in block, (
        "rollback block must re-install unit files from reverted tree"
    )
    assert "systemctl daemon-reload" in block
