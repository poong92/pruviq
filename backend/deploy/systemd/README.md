# PRUVIQ systemd units (DO server)

Source of truth for systemd services/timers deployed on DO `167.172.81.145`.
Migration from Mac Mini cron (2026-04-17).

## Layout

```
backend/deploy/systemd/
├── pruviq-<name>.service   Oneshot/simple service unit
├── pruviq-<name>.timer     Timer that triggers the service
├── pruviq-alert@.service   OnFailure handler template (instantiated with unit name)
└── bin/
    ├── <name>.sh           DO-native wrapper script
    └── alert-failure.sh    Telegram failure notifier
```

## Conventions

- Unit naming: `pruviq-<dash-separated-name>.{service,timer}`
- `User=pruviq` / `Group=pruviq` — no root services
- `EnvironmentFile=/opt/pruviq/shared/.env` — single secret source
- `WorkingDirectory=/opt/pruviq/current` — symlink to active release
- `OnFailure=pruviq-alert@%n.service` — auto-Telegram on failure
- `RandomizedDelaySec=30` on timers — prevent thundering herd
- `Persistent=true` on timers — catch up missed runs after reboot

## Deploy procedure (one unit)

```bash
# 1. Copy wrapper to /opt/pruviq/bin/
scp -P 2222 backend/deploy/systemd/bin/<name>.sh \
    root@167.172.81.145:/opt/pruviq/bin/

# 2. Copy unit files to /etc/systemd/system/
scp -P 2222 backend/deploy/systemd/pruviq-<name>.{service,timer} \
    root@167.172.81.145:/etc/systemd/system/

# 3. On DO: make wrapper executable, reload systemd, enable timer
ssh -p 2222 root@167.172.81.145 "
  chown pruviq:pruviq /opt/pruviq/bin/<name>.sh
  chmod +x /opt/pruviq/bin/<name>.sh
  systemctl daemon-reload
  # Manual run first (service, not timer)
  systemctl start pruviq-<name>.service
  journalctl -u pruviq-<name>.service --since '2 min ago' -n 50
  # If OK, enable timer
  systemctl enable --now pruviq-<name>.timer
  systemctl list-timers pruviq-*
"

# 4. Disable Mac cron line (comment with # MIGRATED-TO-DO prefix)
ssh jepo@macmini.local "crontab -l | sed 's|^.*<script_name>.*$|# MIGRATED-TO-DO &|' | crontab -"

# 5. Wait for next DO timer fire, verify journal:
ssh -p 2222 root@167.172.81.145 "journalctl -u pruviq-<name>.service -n 30 --no-pager"
```

## Dedup window policy

Pattern depends on duplicate impact:

- **Idempotent / silent duplicate** (sim_audit, monitor, update_ohlcv):
  DO enable → verify → Mac disable. Accept one double-fire.
- **User-visible duplicate** (signal_telegram → @PRUVIQ channel):
  Mac disable FIRST → accept brief gap → DO enable. Never double-post.

## KST → UTC cron mapping

Mac crontab is implicit KST (macOS system timezone). DO systemd is UTC. Convert:

| Mac cron | Desc | DO OnCalendar |
|----------|------|---------------|
| `*/5 * * * *` | monitor | `*:0/5` |
| `*/10 * * * *` | staleness-watch | `*:0/10` |
| `*/15 * * * *` | macmini_health | (Mac 전용) |
| `*/20 * * * *` | refresh_static | `*:0/20` |
| `*/30 * * * *` | jepo_healthcheck | (Mac 전용) |
| `0 * * * *` | monitor --full | `*:00:00` |
| `5 * * * *` | signal_telegram | `*:05:00` |
| `0 */6 * * *` | sim_audit | `00,06,12,18:00:00` |
| `15 */4 * * *` | update_ohlcv | `00/4:15:00` |
| `0 4 * * *` KST | update_pruviq_performance | `*-*-* 19:00:00` UTC (prev day) |
| `30 2 * * *` KST | full_pipeline | `*-*-* 17:30:00` UTC (prev day) |
| `0 5 * * *` KST | backup_do_server | (Mac 전용, 역방향 백업) |
| `0 6 * * *` KST | backup-critical-data | (Mac 전용) |
| `0 7 * * *` KST | doc-sync-check | (Mac 전용, ~/.claude) |
| `0 3 1,20 * *` KST | refresh_threads_token | (Mac 전용, SNS 토큰) |
| `0 4 5,25 * *` KST | refresh_instagram_token | (Mac 전용, SNS 토큰) |
| `0 5 1,15 * *` KST | refresh_tokens | (Mac 전용, SNS 토큰) |
| `0 * * * *` KST | social/health_check | (Mac 전용, SNS) |

## Migration status (2026-04-17)

| Unit | Timer | Verified | Mac cron disabled |
|------|-------|----------|-------------------|
| pruviq-monitor | ✅ every 5 min | ✅ | ✅ |
| pruviq-monitor-full | ✅ hourly | ✅ | ✅ |
| pruviq-staleness-watch | ✅ every 10 min | ✅ | ✅ |
| pruviq-signal-telegram | ⏸ disabled (backend /signals/live hang, PR #1080 pending) | — | ✅ |
| pruviq-update-ohlcv | ✅ every 4h :15 | pending first fire | ✅ |
| pruviq-sim-audit | ⏸ disabled (PR #1078 env fix merged, re-enable after /signals/live stable) | — | — |
| pruviq-refresh-static | ⏳ Phase 5-B (see PHASE5B_PLAN.md) | — | — |
| pruviq-full-pipeline | ⏳ Phase 5-B | — | — |
| pruviq-update-performance | ⏳ Phase 5-B | — | — |

**Related PRs**:
- #1075 requirements.txt (httpx, Pillow) — MERGED
- #1078 Phase 5-A systemd timers + sim_audit env override — MERGED
- #1079 backend-deploy.yml Mac→DO auto-restart — MERGED
- #1080 signal_scanner.scan() single-flight lock (backend perf fix) — OPEN

**Next session prerequisites**: See `PHASE5B_PLAN.md` for Node 22, swap, CF_TOKEN, deploy key.
