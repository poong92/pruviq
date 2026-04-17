# Phase 5-B Plan: refresh_static / full_pipeline / update_performance → DO

> Mac cron 3개(빌드+git push 필요)를 DO systemd timer로 이관하기 위한 사전 작업 계획.
> Phase 5-A는 별도 PR들로 완료 (PRs #1075, #1078, #1079, #1080).

## 대상 스크립트 (Mac → DO)

| Mac cron | 역할 | 블로커 |
|----------|------|--------|
| `*/20 refresh_static.sh` | Binance+CoinGecko fetch → npm build → `wrangler deploy` | Node 없음, CF_TOKEN 없음 |
| `30 2 full_pipeline.sh` | update_ohlcv + demo_data + git commit + git push | git deploy key 없음 |
| `0 4 update_pruviq_performance.sh` | `/opt/autotrader/logs/trades/` → performance.json → git push | SSH 로직 불필요 (같은 DO) + git push |

## 사전 준비 (1회성, DO 서버)

### A. Node.js + npm + wrangler

```bash
# Ubuntu 24.04 apt 기본: Node 18.19 (astro 호환 OK)
apt install -y nodejs npm

# 또는 NodeSource 22.x (권장: astro build 안정성):
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# wrangler는 repo의 package.json에 devDependency로 존재. npm ci 시 자동 설치.
# 별도 글로벌 설치 불필요.
```

### B. Swap (메모리 보호)

현재 DO 4GB 중 pruviq-api 1.36GB 사용. Astro build는 1.5-2GB peak. 동시 실행 시 OOM 위험.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### C. Git deploy key (DO → GitHub)

```bash
sudo -u pruviq ssh-keygen -t ed25519 -f /opt/pruviq/.ssh/id_ed25519 -N ""
cat /opt/pruviq/.ssh/id_ed25519.pub
# 출력 key를 GitHub repo → Settings → Deploy keys → Add (write access 체크)
```

### D. CLOUDFLARE_API_TOKEN

```bash
# 1. CF dashboard에서 token 생성 (Workers:Edit 권한)
# 2. /opt/pruviq/shared/.env에 추가:
echo 'CLOUDFLARE_API_TOKEN=xxxxxxxxxxxx' >> /opt/pruviq/shared/.env
echo 'CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxx' >> /opt/pruviq/shared/.env
```

### E. node_modules 초기 설치

```bash
sudo -u pruviq bash -c "cd /opt/pruviq/current && npm ci"
# ~9초, 약 500MB
```

## 대체 아키텍처 (고려)

### Option B: GitHub Actions로 빌드/배포 이관

**장점**: DO 메모리 부담 없음, Node 설치 불필요, build 환경 재현 가능
**단점**: DO에서 한 flow로 완결 안 됨, 오너 명시 목표("Mac → DO") 반감

권장 워크플로우:
- DO systemd: 데이터만 갱신 + `git push` (PR 없이 main 직커밋)
- Actions `on.push.paths: public/data/**`: build + wrangler deploy

**원론적 비교**:
- Option A (DO 완전 이관): 서버 하나 책임, 외부 의존 최소 → "책임지는 서비스" 원칙 일치
- Option B (DO+Actions): 역할 분리 깨끗, DO 리소스 적게 사용 → 운영 관점 실용적

## Option A 실행 순서

1. DO 사전 준비 (A~E)
2. `bin/refresh-static.sh` wrapper 작성 (macOS-specific 로직 제거)
3. `pruviq-refresh-static.{service,timer}` 유닛
   - OnCalendar=*:0/20, RandomizedDelaySec=60
   - MemoryMax=3G (pruviq-api OOM 방지)
4. `bin/full-pipeline.sh` wrapper
5. `pruviq-full-pipeline.{service,timer}` (OnCalendar=*-*-* 17:30:00)
6. `bin/update-performance.sh` wrapper (autotrader 로컬 읽기)
7. `pruviq-update-performance.{service,timer}` (OnCalendar=*-*-* 19:00:00)
8. 수동 service 실행 → journal 검증
9. Mac cron 3줄 MIGRATED-TO-DO 주석 처리
10. Timer enable

## Mac cron 유지 (Phase 5-C)

이전 불가:
- `*/15 macmini_health.sh`: Mac 자기 진단
- `*/30 jepo_healthcheck.sh`: Mac 자기 진단
- `0 5 backup_do_server.sh`: 역방향 백업 (DO→Mac)
- `0 6 backup-critical-data.sh`: 로컬 디스크 백업
- `0 7 doc-sync-check.sh`: `~/.claude` 로컬
- `0 * social/health_check.sh`: SNS 토큰 Mac 보관
- `0 3 1,20 refresh_threads_token.sh`: Threads API (Mac 토큰)
- `0 4 5,25 refresh_instagram_token.sh`: Instagram API (Mac 토큰)
- `0 5 1,15 refresh_tokens.sh`: X/Twitter (Mac 토큰)

SNS 토큰들은 Meta/Graph/X OAuth가 기기별 refresh_token을 쓰므로 이관 시 재인증 필요.
현 시점에서 이관 메리트 없음.

## 리스크 및 Rollback

| 리스크 | 완화 | Rollback |
|--------|------|----------|
| DO OOM (build + api 동시) | Swap 2GB, MemoryMax=3G | swapoff, timer disable |
| git push 충돌 (concurrent data commits) | flock wrapper | 수동 reset |
| wrangler deploy 실패 | journal 알림 (OnFailure) | 수동 재deploy |
| CF_TOKEN 유출 | `.env` 600 mode + git ignore | CF dashboard에서 token revoke |
| Node 18 → Astro 비호환 | 22.x 업그레이드 | apt downgrade |

## 진행 승인 필요 (오너)

- [ ] Option A (DO 완전 이관) vs Option B (DO 데이터 + Actions 배포) 중 선택
- [ ] CF_TOKEN 생성 + .env 저장
- [ ] Deploy key 생성 + GitHub Settings 등록
