# OpenClaw 로드맵 요약 (Executive Summary)

> **작성일**: 2026-02-14
> **목표**: "세계 최고의 레퍼럴 트레이딩 커뮤니티" (PRUVIQ)
> **현재 상태**: Phase 3 완료 (OpenClaw 설치)

---

## 🎯 프로젝트 목표

### 비전
레퍼럴 시스템 기반 트레이딩 커뮤니티 구축:
- 자동화된 트레이딩 시그널 배포
- AI 기반 커뮤니티 관리
- 투명한 레퍼럴 보상 시스템

### 핵심 가치
1. **투명성**: 모든 시그널 공개, 실제 성과 공유
2. **교육**: 전략 설명, 리스크 교육 우선
3. **커뮤니티**: 수수료보다 커뮤니티 성장 우선

---

## 📊 현재 인프라

| 서비스 | 위치 | 상태 | 용도 |
|--------|------|------|------|
| OpenClaw | Mac Mini M4 Pro | ✅ 설치 완료 | AI Agent 허브 |
| Ollama | Mac Mini (qwen2.5:32b) | ✅ 작동 | 로컬 LLM |
| n8n | Mac Mini localhost:5678 | ✅ 운영 중 | 자동화 워크플로우 |
| Trading Bot | DO 167.172.81.145 | ✅ v1.6.2 운영 | BB Squeeze SHORT |
| Telegram | @existing_bot | ✅ 운영 중 | 트레이딩 알림 |

**보안**:
- Phase 0-2 완료: SSH 키, 방화벽, 계정 격리
- Tailscale ACL 적용: DO 서버 ↔ Mac Mini 암호화 통신

---

## 🗺️ 로드맵 개요

### Phase 3.5: OpenClaw 정상화 (2-3시간)
**목표**: TUI/CLI 응답 최적화, workspace 초기화

**주요 작업**:
- contextWindow 최적화 (32768 or 16384)
- SOUL.md, IDENTITY.md, AGENTS.md 생성
- CLI 응답 시간 < 10초 검증

**성공 기준**:
- ✅ Gateway 정상 작동
- ✅ CLI 응답 < 10초
- ✅ Workspace 파일 생성 완료

**스크립트**: `scripts/openclaw/phase3_5_normalize.sh`

---

### Phase 4: Telegram 연동 (3-4시간)
**목표**: 커뮤니티 전용 봇 생성 및 페어링

**주요 작업**:
- 새 Telegram 봇 생성 (@pruviq_autotrader_bot)
- Privacy 설정 (Disable)
- OpenClaw 페어링 (dmPolicy: pairing)
- 보안 정책 설정 (allowlist)

**성공 기준**:
- ✅ DM 페어링 성공
- ✅ 그룹 메시지 응답 확인
- ✅ 보안 감사 PASS

**스크립트**: `scripts/openclaw/phase4_telegram.sh`

---

### Phase 5: n8n 연동 (4-6시간)
**목표**: Trading Signal → Community 자동 발신

**아키텍처**:
```
[Trading Bot DO] → [n8n WF-03] → [OpenClaw] → [Telegram Community]
```

**주요 작업**:
- WF-03 생성: Trading Signal Processor
- n8n → OpenClaw webhook 연동
- DO 서버 코드 수정 (선택)
- 보안 레이어 검증 (Basic Auth, Gateway Token)

**성공 기준**:
- ✅ End-to-End 테스트 성공 (< 10초)
- ✅ Telegram 그룹 메시지 수신
- ✅ 무인증 요청 차단 확인

**스크립트**: `scripts/openclaw/phase5_n8n.sh`

---

### Phase 6: 레퍼럴 시스템 (6-8시간)
**목표**: 사용자별 레퍼럴 코드 생성 및 추적

**데이터베이스**:
```sql
- users: user_id, referral_code, referred_by, total_earned, tier
- referral_events: event_type, amount, timestamp
```

**주요 작업**:
- SQLite DB 설계 및 생성
- n8n WF-04: Referral Manager
- OpenClaw Skill: referral.md
- Telegram 명령어: /referral, /referral stats

**성공 기준**:
- ✅ 코드 자동 생성 (6자리)
- ✅ 추천인 추적 작동
- ✅ 통계 조회 가능

**스크립트**: `scripts/openclaw/phase6_referral.sh` (준비 중)

---

### Phase 7: 보안 하드닝 (3-4시간)
**목표**: Sandbox, Tool 제한, 침투 테스트

**보안 설정**:
```json
{
  "sandbox": {
    "mode": "all",
    "scope": "session",
    "workspaceAccess": "none"
  },
  "tools": {
    "deny": ["exec", "process", "browser", "write", "edit"],
    "allow": ["read", "telegram", "webhook", "web_fetch"]
  }
}
```

**침투 테스트 (6가지)**:
1. 파일 시스템 접근
2. 시스템 명령어 실행
3. 환경변수 접근
4. Prompt Injection
5. DM 스팸
6. 그룹 스팸

**성공 기준**:
- ✅ 모든 테스트 PASS (6/6)
- ✅ CVE 최신 버전 확인 (2026.2.12)
- ✅ 보안 감사 --deep PASS

**스크립트**: `scripts/openclaw/phase7_security.sh` (준비 중)

---

## ⏱️ 타임라인

| Phase | 소요 시간 | 누적 시간 | 우선순위 |
|-------|----------|----------|----------|
| 3.5 | 2-3시간 | 2-3시간 | ⭐⭐⭐ (필수) |
| 4 | 3-4시간 | 5-7시간 | ⭐⭐⭐ (필수) |
| 5 | 4-6시간 | 9-13시간 | ⭐⭐⭐ (필수) |
| 6 | 6-8시간 | 15-21시간 | ⭐⭐ (중요) |
| 7 | 3-4시간 | 18-25시간 | ⭐⭐⭐ (필수) |

**총 예상 시간**: 18-25시간 (3-4일 분량)

**권장 일정**:
- Day 1: Phase 3.5 + 4 (5-7시간)
- Day 2: Phase 5 (4-6시간)
- Day 3: Phase 6 (6-8시간)
- Day 4: Phase 7 + 통합 테스트 (4-5시간)

---

## 🔑 핵심 기술 스택

### AI & Automation
- **OpenClaw 2026.2.12**: AI Agent 게이트웨이 (오픈소스)
- **Ollama qwen2.5:32b**: 로컬 LLM (무료, 32GB 파라미터)
- **n8n**: 워크플로우 자동화 (셀프호스트)

### Communication
- **Telegram Bot API**: 커뮤니티 채널 (무료)
- **Webhook**: DO 서버 ↔ Mac Mini 연동

### Data
- **SQLite**: 레퍼럴 DB (로컬, 경량)
- **Mem0 Cloud**: AI 컨텍스트 메모리 (MCP)

### Security
- **Tailscale**: 암호화 VPN (무료 플랜)
- **pf Firewall**: macOS 방화벽
- **OpenClaw Sandbox**: 도구 실행 격리

---

## 💰 비용 분석

### 완전 무료 옵션 (현재 구성)
- OpenClaw: $0 (오픈소스)
- Ollama: $0 (로컬)
- n8n: $0 (셀프호스트)
- Telegram: $0
- SQLite: $0

**총 비용**: $0/월

### 유료 업그레이드 옵션
- **Claude Opus 4.6**: ~$30/월 (100만 토큰)
- **Mem0 Cloud Pro**: $20/월 (무제한 메모리)
- **n8n Cloud**: $20/월 (호스팅 + 지원)
- **DigitalOcean 추가 서버**: $6/월 (1GB RAM)

**최대 비용**: ~$76/월

---

## 🎓 학습 곡선

| 역량 | 필요 수준 | 학습 시간 | 리소스 |
|------|----------|----------|--------|
| Linux 기본 | 중급 | - | 기존 경험 활용 |
| Docker | 초급 | 1시간 | DO 서버 경험 |
| n8n | 초급 | 2시간 | 기존 WF-01/02 경험 |
| OpenClaw | 초급 | 3시간 | 공식 문서 |
| Telegram Bot | 초급 | 1시간 | @BotFather 가이드 |
| SQL (SQLite) | 초급 | 2시간 | 기본 CRUD |

**총 예상 학습 시간**: 9시간 (작업과 병행 가능)

---

## ⚠️ 리스크 분석

### 기술 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| OpenClaw TUI 응답 지연 | 중 | 중 | contextWindow 축소, 모델 변경 |
| Telegram 페어링 실패 | 저 | 고 | Privacy 설정, 봇 재생성 |
| n8n ↔ OpenClaw 연동 오류 | 중 | 중 | webhook 디버깅, Tailscale 재설정 |
| 레퍼럴 DB 손상 | 저 | 중 | 자동 백업 (cron) |
| 보안 침투 성공 | 저 | 고 | Phase 7 샌드박스 강화 |
| DO ↔ Mac Mini 네트워크 단절 | 중 | 고 | Tailscale 헬스체크, fallback 알림 |

### 운영 리스크

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| Mac Mini 장애 | 저 | 고 | DO 서버로 페일오버 |
| 커뮤니티 스팸 | 중 | 중 | 그룹 allowlist, 속도 제한 |
| API 키 유출 | 저 | 고 | 환경변수 관리, Git 제외 |
| 과도한 토큰 사용 | 저 | 저 | 로컬 LLM 사용 (qwen2.5) |

---

## 📈 성공 지표 (KPI)

### Phase 완료 기준
- [ ] Phase 3.5: CLI 응답 < 10초
- [ ] Phase 4: DM + 그룹 연동 성공
- [ ] Phase 5: End-to-End 테스트 < 10초
- [ ] Phase 6: 레퍼럴 코드 자동 발급
- [ ] Phase 7: 침투 테스트 6/6 PASS

### 커뮤니티 성장 (Phase 8+)
- Week 1: 10명 가입
- Month 1: 100명 가입
- Month 3: 500명 가입, 레퍼럴 활성화 20%

### 기술 성능
- Telegram 응답 시간: < 5초 (90th percentile)
- n8n 워크플로우 성공률: > 99%
- OpenClaw Gateway 가동률: > 99.9%

---

## 🔄 다음 단계 (Phase 8+)

### Phase 8: 프로덕션 모니터링 (4시간)
- Grafana + Prometheus 대시보드
- n8n 워크플로우 실패 알림
- OpenClaw 메트릭 수집

### Phase 9: 커뮤니티 성장 (지속적)
- 자동 온보딩 메시지
- 주간 트레이딩 리포트
- 리더보드 (레퍼럴 순위)

### Phase 10: 고급 기능 (8시간)
- 멀티 에이전트 (전략별 봇)
- A/B 테스트 (메시지 포맷)
- 사용자 피드백 분석

---

## 📚 참고 문서

### 프로젝트 내부
- [OPENCLAW_ROADMAP.md](./OPENCLAW_ROADMAP.md) - 전체 상세 로드맵
- [OPENCLAW_QUICKSTART.md](./OPENCLAW_QUICKSTART.md) - 30분 빠른 시작
- [scripts/openclaw/README.md](../scripts/openclaw/README.md) - 실행 가이드

### OpenClaw 공식
- [Telegram Setup Guide](https://docs.openclaw.ai/channels/telegram)
- [Security Documentation](https://docs.openclaw.ai/gateway/security)
- [GitHub Repository](https://github.com/openclaw/openclaw)

### 커뮤니티
- [OpenClaw + n8n Stack](https://github.com/caprihan/openclaw-n8n-stack)
- [SOUL.md Templates](https://alirezarezvani.medium.com/10-soul-md-practical-cases-in-a-guide-for-moltbot-clawdbot-defining-who-your-ai-chooses-to-be-dadff9b08fe2)
- [Security Hardening 2026](https://adversa.ai/blog/openclaw-security-101-vulnerabilities-hardening-2026/)

---

## ✅ 체크리스트 (시작 전)

### 환경 준비
- [ ] Mac Mini M4 Pro 정상 작동
- [ ] OpenClaw 2026.2.12 설치 완료
- [ ] Ollama qwen2.5:32b 로드 완료
- [ ] n8n 접속 가능 (localhost:5678)
- [ ] Tailscale 설치 및 연결
- [ ] DO 서버 접속 가능 (167.172.81.145)

### 백업
- [ ] `/opt/openclaw/openclaw.json` 백업
- [ ] n8n 워크플로우 Export (WF-01, WF-02)
- [ ] autotrader 코드 Git 커밋

### 문서 읽기
- [ ] OPENCLAW_QUICKSTART.md 읽기 (30분 체험)
- [ ] OPENCLAW_ROADMAP.md Phase 3.5 읽기
- [ ] scripts/openclaw/README.md 읽기

---

## 🚀 시작하기

### Option A: 30분 체험
```bash
cd /Users/jplee/Desktop/autotrader
cat docs/OPENCLAW_QUICKSTART.md
```

### Option B: 전체 로드맵 시작
```bash
cd /Users/jplee/Desktop/autotrader
chmod +x scripts/openclaw/*.sh
./scripts/openclaw/phase3_5_normalize.sh
```

### Option C: 문서만 읽기
```bash
cat docs/OPENCLAW_ROADMAP.md | less
```

---

**작성자**: Research Agent (research-agent)
**프로젝트**: AutoTrader v1.6.2
**작성일**: 2026-02-14

**최종 업데이트**: 2026-02-14
**다음 리뷰**: Phase 3.5 완료 후
