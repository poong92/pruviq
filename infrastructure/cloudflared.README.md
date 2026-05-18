# cloudflared systemd unit

## Why

Production cloudflared (PID 189439, started Apr 20) runs as a **bare process**, not under systemd. If it crashes or the box restarts, `api.pruviq.com` becomes unreachable until manually restarted. Infrastructure audit (2026-05-18) flagged this as the top single-point-of-failure for real-mode dog-foot.

## Activation (owner action — DO SSH)

**Pre-req**: traffic-quiet window, ideally KST 03–05. Active DCA bots are unaffected (they read the local DB, not the tunnel) but dashboard becomes briefly unreachable during the switchover.

```bash
ssh -p 2222 root@167.172.81.145

# 1) Install unit
scp -P 2222 infrastructure/cloudflared.service \
  root@167.172.81.145:/etc/systemd/system/cloudflared.service

# 2) Reload systemd
systemctl daemon-reload

# 3) Stop the bare cloudflared process — verify with `pgrep cloudflared`
kill 189439   # or `pkill cloudflared` if PID has changed
sleep 2
pgrep cloudflared && echo "FAIL: still running" || echo "OK: stopped"

# 4) Enable + start under systemd
systemctl enable cloudflared
systemctl start cloudflared

# 5) Verify (within 30s api.pruviq.com should respond again)
systemctl status cloudflared --no-pager
journalctl -u cloudflared --since "1 minute ago" | grep -iE "connection|registered|tunnel"
curl -s -o /dev/null -w "%{http_code}\n" https://api.pruviq.com/healthz
```

## Rollback

```bash
systemctl stop cloudflared
systemctl disable cloudflared
# Restart the bare process manually if needed:
sudo -u pruviq /usr/local/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run &
```

## Verification post-activation

1. `systemctl status cloudflared` → `active (running)` + `Restart: on-failure`
2. `kill $(pgrep cloudflared)` → systemd should restart it within 10s
3. `journalctl -u cloudflared --since "5m"` should show the restart event

## Notes

- `User=pruviq` matches the current bare-process owner (verified via `ps -ef`)
- `ExecStart` mirrors the current command exactly (no `--no-autoupdate` etc.)
- `MemoryMax=512M` — cloudflared has used <100MB historically; ceiling prevents OOM from goroutine leak
- `Restart=always` + `RestartSec=10` — survives transient network blips

## Audit trail

- Discovery: infrastructure-monitor agent (2026-05-18)
- Risk class: book-keeping → real-money (real-mode dog-foot needs reliable tunnel)
- Decision rationale: see `~/.claude/projects/-Users-jepo-pruviq/memory/project_infra_checklist_home.md`
