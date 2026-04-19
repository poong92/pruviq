"""
data-pipeline audit cleanup regression guard (PR 2026-04-19).

Closes three findings from the data-pipeline re-audit:
  1. `backend/scripts/update_performance_and_push.sh` had `/Users/jplee/...`
     (typo, correct is `/Users/jepo`) — script was dead, but present in repo
     as a trap. Moved to `disabled/`.
  2. `generate_autopsy.py` hardcoded `/Users/jepo/pruviq/src/content/blog*`
     and `/Users/jepo/pruviq-data/posted_autopsies.json` — env-ified.
  3. `api/main.py:SUBSCRIBERS_FILE` fallback was `/Users/jepo/pruviq-data/...`
     — replaced with `~/pruviq-data/subscribers.json` (home-relative). The
     prod path stays `/opt/pruviq/shared/...` via systemd `Environment=`.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DISABLED_DIR = REPO / "deploy" / "systemd" / "disabled"


def test_dead_perf_script_relocated_to_disabled():
    live = REPO / "scripts" / "update_performance_and_push.sh"
    archived = DISABLED_DIR / "update_performance_and_push.sh.legacy"
    assert not live.exists(), (
        "dead script must be archived (was Mac-only with /Users/jplee typo, "
        "never run successfully)"
    )
    assert archived.exists(), (
        "archived copy must be preserved under disabled/ for history"
    )


def test_generate_autopsy_uses_env_and_project_root():
    src = (REPO / "scripts" / "generate_autopsy.py").read_text()
    # No direct Mac hardcode in module-level constants
    assert not re.search(
        r'^\s*BLOG_DIR\s*=\s*Path\(\s*["\']/Users/jepo/',
        src,
        re.MULTILINE,
    )
    assert not re.search(
        r'^\s*POSTED_FILE\s*=\s*Path\(\s*["\']/Users/jepo/',
        src,
        re.MULTILINE,
    )
    # Env reads present (multi-line formatting tolerated)
    for env_name in (
        "PRUVIQ_BLOG_DIR",
        "PRUVIQ_BLOG_KO_DIR",
        "POSTED_AUTOPSIES_FILE",
        "PRUVIQ_API_URL",
    ):
        assert f'"{env_name}"' in src, (
            f"{env_name} env var must be consulted in generate_autopsy.py"
        )
    # Project-root fallback constant
    assert "_PROJECT_ROOT" in src


def test_subscribers_file_fallback_is_home_relative_not_absolute_mac():
    src = (REPO / "api" / "main.py").read_text()
    # Must NOT fall back to a /Users/jepo/... literal
    assert not re.search(
        r'os\.environ\.get\(\s*["\']SUBSCRIBERS_FILE["\']\s*,\s*["\']/Users/jepo/',
        src,
    ), (
        "SUBSCRIBERS_FILE fallback still literal Mac path — DO without env "
        "injection would hit PermissionError creating /Users on mkdir."
    )
    # Must use expanduser (~/...) fallback
    assert re.search(
        r'SUBSCRIBERS_FILE\s*=.*expanduser.*pruviq-data',
        src,
        re.DOTALL,
    ), "SUBSCRIBERS_FILE must use expanduser for the home-relative fallback"


def test_legacy_script_comment_preserves_history():
    """Archived dead script retains its header comment explaining why it was
    moved — operators reading `disabled/` should know the context."""
    archived = DISABLED_DIR / "update_performance_and_push.sh.legacy"
    src = archived.read_text()
    # Contains the original /Users/jplee typo (historical artifact)
    assert "/Users/jplee" in src, (
        "archived script should retain original typo for context; "
        "don't edit it, it's a historical snapshot"
    )
