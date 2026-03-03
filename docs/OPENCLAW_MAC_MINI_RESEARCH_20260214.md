===== OpenClaw Mac Mini 최적 구성 리서치 보고서 =====
주제: OpenClaw를 Mac Mini에서 가장 저렴하고 고성능으로 운영하는 방법
검색일: 2026-02-14
작성자: Research Agent (JEPO)

---

## 요약

### 핵심 발견
1. **OpenClaw는 Node.js 기반 AI 에이전트 프레임워크**로 Claude API와 로컬 LLM 둘 다 지원
2. **Mac Mini M4 기본형(16GB)이 가장 저렴**하며 클라우드 API 사용 시 충분
3. **M4 Pro 64GB가 성능 최고**지만 비용 대비 효율은 M4 24GB가 가장 우수
4. **심각한 보안 취약점 존재** (RCE, 512개 취약점, 135K 노출 인스턴스)
5. **월 운영비 매우 저렴** (전기료 $2-6, API 비용 $15-30)

### 최종 추천
| 구성 | 가격 | 사용 사례 | 권장 대상 |
|------|------|----------|----------|
| **M4 16GB** | $599 | Claude API 전용, 7-8B 로컬 모델 | 예산 제약, 클라우드 API 선호 |
| **M4 24GB** ⭐ | $999 ($890 할인가) | 14B 로컬 모델, 중간 성능 | **비용 대비 최고 효율** |
| **M4 Pro 64GB** | $2,000 | 32B 로컬 모델, 최고 성능 | 완전 로컬 환경, 프라이버시 중시 |

---

## 1. OpenClaw 개요

### 정의
- **공식명**: OpenClaw (구 Clawdbot, Moltbot)
- **개발자**: Peter Steinberger
- **기술**: Node.js 기반 오픈소스 AI 에이전트 런타임
- **역할**: 로컬 메시지 라우터 + 에이전트 런타임
- **통합**: Claude API, 로컬 LLM(Ollama), 50+ 통합 서비스 지원

**출처**:
- [GitHub - openclaw/openclaw](https://github.com/openclaw/openclaw)
- [OpenClaw - Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [Getting Started - OpenClaw](https://docs.openclaw.ai/start/getting-started)

### 주요 기능
1. **메시징 플랫폼 통합**: WhatsApp, Telegram, Slack, Discord, iMessage
2. **시스템 제어**: 파일 관리, 웹 브라우징, 명령 실행
3. **멀티 에이전트**: 여러 독립 에이전트 동시 운영
4. **24/7 운영**: 항상 켜진 AI 비서로 작동
5. **로컬/클라우드 하이브리드**: API와 로컬 LLM 선택 가능

---

## 2. 시스템 요구사항

### 필수 요구사항
| 항목 | 요구사항 | 출처 |
|------|----------|------|
| **런타임** | Node.js ≥22 | [GitHub 공식 문서](https://github.com/openclaw/openclaw) |
| **최소 메모리** | 2GB (Docker 빌드) | [OpenClaw Guide](https://aiopenclaw.org/blog/openclaw-system-requirements) |
| **컨텍스트 길이** | 최소 64K 토큰 | [Mac Mini M4 AI Server](https://www.marc0.dev/en/blog/mac-mini-ai-server-ollama-openclaw-claude-code-complete-guide-2026-1770481256372) |

### 메모리별 성능 (Mac Mini M4 기준)

#### 16GB RAM
**성능**:
- 클라우드 API(Claude): ✅ 충분
- 로컬 LLM: Llama 3.1 8B (18-22 tok/s)
- 복잡한 쿼리: 3-5초
- 20 동시 요청: 8-12초

**제한사항**:
- 12-14B 이상 모델에서 메모리 압박
- 64K 컨텍스트 요구사항으로 모델 선택 제한

**출처**:
- [OpenClaw Mac Mini Complete Guide](https://aiopenclaw.org/blog/openclaw-mac-mini-complete-guide)
- [Mac Mini Hardware Requirements](https://www.openclawexperts.io/guides/setup/openclaw-mac-mini-hardware-specs-requirements)

#### 24GB RAM ⭐ (비용 대비 최고 효율)
**성능**:
- 14B 모델: ~10 tok/s
- 메모리 사용률: 60-80% (부하 시)
- 적정 동시 요청: ~20개 (소규모 팀)

**가격**: $999 정가 (할인가 $890)

**커뮤니티 평가**:
> "For most OpenClaw-with-cloud-API users, this is more than enough."
> "If local inference is a priority, the jump to 24GB is worth every dollar."

**출처**:
- [OpenClaw Mac Mini Setup: M4 Pro, 64GB](https://www.marc0.dev/en/blog/openclaw-mac-mini-the-complete-guide-to-running-your-own-ai-agent-in-2026-1770057455419)
- [Best Mac mini for OpenClaw](https://www.dadnology.com/guides/mac-mini-best-buy-for-openclaw)

#### 32GB RAM
**성능**:
- 14B 모델: 최적
- 멀티태스킹: LLM + 브라우저 자동화 동시 실행

**출처**: [OpenClaw Hardware Requirements](https://boostedhost.com/blog/en/openclaw-hardware-requirements/)

#### 64GB RAM (M4 Pro)
**성능**:
- 32B 모델: 11-12 tok/s
- 70B 모델: 4.5-5 tok/s
- Qwen2.5-Coder-32B: 실시간 코딩 어시스턴트 가능

**대역폭**: M4 Pro - 273 GB/s (M4 대비 크게 향상)

**가격**: $2,000

**커뮤니티 평가**:
> "The Mac Mini M4 Pro with 64GB unified memory has become the sweet spot for serious local AI work."
> "Jeff Geerling's testing shows this configuration comfortably running 32B parameter models at 11-12 tokens per second."

**출처**:
- [Transform Your Mac Mini Into AI Powerhouse](https://thamizhelango.medium.com/transform-your-mac-mini-into-a-personal-ai-powerhouse-the-complete-openclaw-guide-f2f3e8e1b554)
- [OpenClaw Mac Mini Setup: M4 Pro, 64GB](https://www.marc0.dev/en/blog/openclaw-mac-mini-the-complete-guide-to-running-your-own-ai-agent-in-2026-1770057455419)

---

## 3. 설치 방법 비교

### Native 설치 (권장)
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

**특징**:
- 설치 시간: 5-10분 (Node.js 22+ 기설치 시)
- 성능: Docker보다 빠른 개발 루프
- macOS 전용 기능: 메뉴바 앱, 음성 웨이크, PTT 오버레이

**출처**: [Getting Started - OpenClaw](https://docs.openclaw.ai/start/getting-started)

### Docker 설치
```bash
# Pre-built Alpine 이미지 사용 권장
docker pull alpine/openclaw
```

**특징**:
- 설치 시간: 10-15분 (Docker 포함)
- 장점: 격리, 재현성, 프로덕션 배포 적합
- 단점: 약간의 오버헤드, 복잡성 증가

**출처**:
- [Running OpenClaw in Docker](https://til.simonwillison.net/llms/openclaw-docker)
- [Docker - OpenClaw](https://docs.openclaw.ai/install/docker)

### macOS Homebrew (가장 간편)
```bash
brew install openclawd
openclawd onboard
```

**출처**: [OpenClaw Guide](https://aiopenclaw.org/blog/openclaw-system-requirements)

---

## 4. 로컬 LLM vs 클라우드 API 비용 비교

### 로컬 LLM (Ollama)
**초기 비용**:
- M4 16GB: $599
- M4 24GB: $999 ($890 할인가)
- M4 Pro 64GB: $2,000

**월 운영비**: $2-6 (전기료만)

**추가 비용**: 없음 (무제한 토큰)

**장점**:
- 프라이버시 완전 보장
- API 비용 걱정 없음
- 오프라인 작동 가능

**단점**:
- 초기 비용 높음
- 응답 속도 느림 (10-22 tok/s)
- 모델 품질 제한 (32B 이하)

**출처**:
- [OpenClaw Deploy Cost Guide](https://yu-wenhao.com/en/blog/2026-02-01-openclaw-deploy-cost-guide/)
- [Reduce Your OpenClaw LLM Costs](https://blog.salad.com/reduce-your-openclaw-llm-costs-saladcloud-guide/)

### 클라우드 API (Claude)
**초기 비용**:
- M4 16GB: $599 (충분)

**월 운영비**:
- 일반 사용자: $5-30/월
- 중간 사용자: $15-25/월 (Claude Sonnet 4.5 권장)
- 과도한 사용: $623/월 (실제 사례)

**장점**:
- 초기 비용 낮음
- 최고 품질 모델
- 빠른 응답 속도

**단점**:
- 토큰당 과금 (예측 어려움)
- 프라이버시 우려
- 인터넷 필수

**출처**:
- [A realistic guide to OpenClaw AI pricing](https://www.eesel.ai/blog/openclaw-ai-pricing)
- [OpenClaw Pricing Guide](https://www.thecaio.ai/blog/openclaw-pricing-guide)

### 하이브리드 전략 (권장)
1. **Primary**: Claude Sonnet 4.5 (복잡한 작업)
2. **Secondary**: 로컬 7-14B 모델 (루틴 작업, heartbeat)
3. **예상 비용**: $10-20/월

**출처**: [Multi-Agent Routing - OpenClaw](https://docs.openclaw.ai/concepts/multi-agent)

---

## 5. 전기료 계산

### Mac Mini M4 전력 소비
| 상태 | 전력 | 출처 |
|------|------|------|
| 유휴 | 3-4W | [M4 Mac mini's efficiency](https://www.jeffgeerling.com/blog/2024/m4-mac-minis-efficiency-incredible/) |
| 일반 작업 | 5W | [Mac mini power consumption](https://support.apple.com/en-us/103253) |
| 고부하 | 65W | [Energy Efficiency](https://forums.macrumors.com/threads/energy-efficiency-of-m4-mini.2442507/) |
| 최대 | 155W | [Apple 공식](https://support.apple.com/en-us/103253) |

### 24/7 운영 비용 (미국 기준 $0.10/kWh)
| 평균 전력 | 월 비용 | 연 비용 |
|----------|---------|---------|
| 50W | $3.36 | $43.68 |
| 85W | $5.71 | $74.26 |

**결론**: Mac Mini는 Raspberry Pi 수준의 전력 효율 (3-4W 유휴)

**출처**:
- [Mac mini power consumption](https://support.apple.com/en-us/103253)
- [Running cost of Mac mini M4 Pro](https://www.sust-it.net/power-consumption-price-comparison/apple/MacminiM4Pro/desktop-computers)

---

## 6. 권장 로컬 LLM 모델

### OpenClaw와 최적화된 모델
| 모델 | 크기 | 컨텍스트 | 최소 RAM | 성능 | 용도 |
|------|------|----------|---------|------|------|
| **GLM-4.7-Flash** | 9B (active) | 128K | 16GB | - | Claude Code 통합, 툴 콜링 ⭐ |
| **Llama 3.1 8B** | 8B | 128K | 16GB | 18-22 tok/s | 범용 (4-bit 양자화) |
| **DeepSeek-Coder-V2** | 16B | - | 24GB | - | 멀티언어 코딩 (300+ 언어) |
| **Qwen3-Coder-30B-A3B** | 30B (3B active) | 256K | 64GB | - | MoE, 고급 코딩 |
| **GPT-OSS-20B** | 20B | - | 32GB | - | OpenAI 첫 오픈소스, 범용 |

**출처**:
- [OpenClaw + Ollama Setup Guide](https://codersera.com/blog/openclaw-ollama-setup-guide-run-local-ai-agents-2026)
- [OpenClaw and Local Ollama Models](https://sonusahani.com/blogs/openclaw-ollama-model)
- [Mac Mini M4 AI Server](https://www.marc0.dev/en/blog/mac-mini-ai-server-ollama-openclaw-claude-code-complete-guide-2026-1770481256372)

### GLM-4.7-Flash 통합 (2026년 1월 추가)
```bash
# Claude Code에서 Ollama 사용
export ANTHROPIC_BASE_URL=http://localhost:11434
ollama run glm-4.7
```

**특징**:
- Claude Code 공식 지원
- 128K 컨텍스트 (OpenClaw 요구사항 충족)
- 툴 콜링 네이티브 지원

**출처**: [OpenClaw · Ollama Blog](https://ollama.com/blog/openclaw)

---

## 7. MLX/Metal 가속 활용

### MLX 프레임워크
- **개발**: Apple
- **최적화**: Apple Silicon 전용 (M1-M5)
- **가속**: Metal GPU + Unified Memory
- **성능**: M5에서 최대 4배 속도 향상 (시간-첫-토큰)

**출처**:
- [MLX: An array framework for Apple silicon](https://github.com/ml-explore/mlx)
- [Exploring LLMs with MLX and M5 GPU](https://machinelearning.apple.com/research/exploring-llms-mlx-m5)
- [WWDC25: Explore LLMs with MLX](https://developer.apple.com/videos/play/wwdc2025/298/)

### vllm-mlx (OpenClaw 호환)
```bash
# OpenAI/Anthropic 호환 서버
# 400+ tok/s, MCP 툴 콜링 지원
```

**특징**:
- Claude Code와 작동
- 연속 배치 처리
- 멀티모달 지원 (Llama, Qwen-VL, LLaVA)

**출처**: [vllm-mlx GitHub](https://github.com/waybarrios/vllm-mlx)

### 실무 적용
- **권장**: Ollama (간편) + MLX 백엔드
- **고급**: vllm-mlx (최고 성능, 설정 복잡)

**출처**: [Local AI with MLX on Mac](https://www.markus-schall.de/en/2025/09/mlx-on-apple-silicon-as-local-ki-compared-with-ollama-co/)

---

## 8. 동시 사용자/세션 성능

### 동시성 설정
```json
{
  "sessionConcurrency": 2  // 기본 권장
}
```

**리소스 영향**:
- CPU: 낮음 (LLM 호출은 I/O 바운드)
- 메모리: 세션당 컨텍스트 별도 저장
- 효율성: 병렬 처리로 응답성 향상

**출처**: [Multi-Agent Routing - OpenClaw](https://docs.openclaw.ai/concepts/multi-agent)

### 권장 구성
| 구성 | 동시 세션 | 사용자 수 | 메모리 |
|------|----------|----------|--------|
| 개인용 | 1-2 | 1명 | 16GB |
| 소규모 팀 | 2-3 | 3-5명 | 24GB |
| 중규모 팀 | 3-5 | 5-10명 | 32-64GB |

**출처**: [Mac Mini Hardware Requirements](https://www.openclawexperts.io/guides/setup/openclaw-mac-mini-hardware-specs-requirements)

### 멀티 에이전트 아키텍처
- **독립 에이전트**: 별도 workspace + agentDir + sessions
- **공유 게이트웨이**: 1개 서버에서 여러 사용자/에이전트 호스팅
- **격리**: 데이터 완전 분리

**출처**: [Multi-Agent Configuration](https://deepwiki.com/openclaw/openclaw/4.3-multi-agent-configuration)

---

## 9. ⚠️ 보안 취약점 (CRITICAL)

### 심각한 보안 이슈 (2026년 2월 발견)

#### 1. 원클릭 RCE (Remote Code Execution)
- **CVE**: 공개됨 (2026-02-03)
- **영향**: OpenClaw < 2026.1.29 모든 버전
- **공격 방법**: 악성 링크 1회 클릭
- **패치**: 2026.1.29 버전에서 수정

**공격 시나리오**:
1. 피해자가 악성 웹페이지 방문
2. Cross-site WebSocket Hijacking (Origin 헤더 미검증)
3. 원격 코드 실행 (밀리초 내 완료)

**출처**:
- [OpenClaw Bug Enables One-Click RCE](https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html)
- [Critical vulnerability in OpenClaw](https://ccb.belgium.be/advisories/warning-critical-vulnerability-openclaw-allows-1-click-remote-code-execution-when)

#### 2. 대량 취약점
- **총 512개 취약점** (2026년 1월 감사)
- **Critical 등급**: 8개
- **보안 점수**: 2/100 (극히 위험)

**출처**: [Kaspersky: OpenClaw vulnerabilities](https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/)

#### 3. 인터넷 노출 인스턴스
- **135,000개** 인스턴스가 인터넷에 노출됨
- **약 1,000개**: 인증 없이 완전히 개방
- **기본 설정**: 0.0.0.0:18789 (모든 인터페이스 리슨)

**출처**:
- [135K OpenClaw AI Agents Exposed](https://www.bitdefender.com/en-us/blog/hotforsecurity/135k-openclaw-ai-agents-exposed-online)
- [OpenClaw ecosystem suffering security issues](https://www.theregister.com/2026/02/02/openclaw_security_issues/)

#### 4. 보안 전문가 평가
> "Personal AI Agents like OpenClaw Are a Security Nightmare"
> - Cisco Blogs

> "OpenClaw: the potential biggest insider threat of 2026"
> - Palo Alto Networks

> "While the Mac Mini + OpenClaw setup offers compelling possibilities for local AI automation, the latency is too high, and the security risk is massive."
> - Hacker News 커뮤니티

**출처**:
- [Cisco: Personal AI Agents Security Nightmare](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare)
- [Fortune: OpenClaw security experts on edge](https://fortune.com/2026/02/12/openclaw-ai-agents-security-risks-beware/)

---

## 10. 보안 완화 방법 (필수)

### 즉시 적용 필수
1. **최신 버전 업데이트**
   ```bash
   openclaw update --channel stable
   # 최소 2026.1.29 이상 필수
   ```

2. **네트워크 격리**
   ```bash
   # localhost만 바인딩 (기본값 변경)
   openclaw config set bind 127.0.0.1:18789
   ```

3. **전용 머신 사용**
   - ⚠️ 개인 컴퓨터에 설치 금지
   - 격리된 Mac Mini 또는 VPS 사용
   - 중요 데이터와 분리

4. **방화벽 설정**
   - 18789 포트 외부 접근 차단
   - VPN(Tailscale 등) 통한 접근만 허용

5. **권한 최소화**
   - 파일 접근 권한 제한
   - 실행 가능한 명령 화이트리스트

**출처**:
- [OpenClaw security 101: hardening guide](https://adversa.ai/blog/openclaw-security-101-vulnerabilities-hardening-2026/)
- [CrowdStrike: What Security Teams Need to Know](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/)

### GitHub 커뮤니티 솔루션
**Headless Mac Mini 보안 설정**:
- MacMate 앱 사용 (슬립 방지, 가상 디스플레이)
- 오디오 캡처 격리
- SSH 접근만 허용

**출처**: [Headless Mac Mini Solution](https://github.com/openclaw/openclaw/discussions/7700)

---

## 11. 상반된 의견 정리

### 긍정적 견해
**커뮤니티**:
- "Mac Mini M4 + OpenClaw는 완벽한 24/7 AI 에이전트 서버"
- "43,400+ GitHub 스타, 8,900+ 커뮤니티 회원"
- "전기료 연간 $15-25로 저렴한 운영"
- "실용적 자동화: PR 생성, 버그 수정을 텍스트 명령으로"

**출처**:
- [I Used OpenClaw for 6 Hours](https://theagilevc.substack.com/p/i-used-clawdbot-openclaw-for-6-hours)
- [Show HN: Running OpenClaw on $640 Mac Mini](https://news.ycombinator.com/item?id=46895546)

### 부정적 견해 (보안 중심)
**보안 전문가**:
- "Score 2 out of 100 - 공격자가 시스템 프롬프트 추출, 행동 조작, 프론트 도어 통과"
- "비결정적 시스템에 로컬 코드 실행 권한 부여의 위험성"
- "현재는 파워 유저 전용, 대중 사용은 시기상조"
- "자주 고장남(breaks a lot)"

**출처**:
- [Mac Mini M4 + OpenClaw: Why Dangerous](https://hmnshudhmn24.medium.com/mac-mini-m4-openclaw-why-my-secure-ai-assistant-was-actually-dangerous-06eecbf61739)
- [University of Toronto Security Advisory](https://security.utoronto.ca/advisories/openclaw-vulnerability-notification/)

### 중립적 평가
**기술 블로거**:
- "초기 비용 vs 운영 비용 트레이드오프 고려 필요"
- "로컬 LLM은 응답 속도가 느림(10-15 tok/s)"
- "클라우드 API는 비용 예측 어려움 ($5-$623/월 범위)"
- "보안과 편의성 사이의 균형 필요"

**출처**:
- [OpenClaw Cloud vs Local Deployment](https://help.apiyi.com/en/openclaw-cloud-vs-local-deployment-guide-en.html)
- [OpenClaw vs Alternatives](https://latenode.com/blog/ai/ai-agents/openclaw-comparison-alternatives)

---

## 12. 최종 권고사항

### 가장 저렴한 구성 (예산 우선)
```
하드웨어: Mac Mini M4 16GB ($599)
설치: Homebrew (간편)
LLM: Claude Sonnet 4.5 API
월 비용: $20-30 (전기 $3 + API $15-25)
연 비용: $240-360
```

**적합 대상**:
- 예산 제약 있는 개인
- 클라우드 API 사용 거부감 없음
- 7-8B 로컬 모델로 충분한 경우

**출처**: [Is a Mac mini Worth Buying?](https://us.ugreen.com/blogs/docking-stations/is-a-mac-mini-worth-buying-to-run-openclaw-24-7)

### 최적 성능 구성 (비용 대비 효율) ⭐
```
하드웨어: Mac Mini M4 24GB ($890 할인가)
설치: Native (Node.js)
LLM: 하이브리드
  - Primary: Claude Sonnet 4.5 (복잡한 작업)
  - Secondary: 로컬 14B (루틴 작업)
월 비용: $15-25 (전기 $4 + API $10-20)
연 비용: $180-300
```

**적합 대상**:
- 비용 대비 성능 중시
- 프라이버시와 비용의 균형
- 소규모 팀 (3-5명)

**출처**: [Best Mac mini for OpenClaw](https://www.dadnology.com/guides/mac-mini-best-buy-for-openclaw)

### 최고 성능 구성 (프라이버시 중시)
```
하드웨어: Mac Mini M4 Pro 64GB ($2,000)
설치: Docker (격리)
LLM: 완전 로컬
  - Qwen2.5-Coder-32B (11-12 tok/s)
  - GLM-4.7-Flash (빠른 응답)
월 비용: $6 (전기만)
연 비용: $72
```

**적합 대상**:
- 완전한 프라이버시 필요
- API 비용 제로 선호
- 오프라인 작동 필요
- 중규모 팀 (5-10명)

**출처**: [OpenClaw Mac Mini Setup: M4 Pro 64GB](https://www.marc0.dev/en/blog/openclaw-mac-mini-the-complete-guide-to-running-your-own-ai-agent-in-2026-1770057455419)

---

## 13. ⚠️ 경고 및 주의사항

### 보안 경고 (CRITICAL)
1. **개인 컴퓨터 설치 금지**
   - 중요 데이터와 격리된 전용 머신 사용 필수
   - VPN 통한 원격 접근만 허용

2. **최신 버전 유지 필수**
   - 2026.1.29 이상 (RCE 패치)
   - 자동 업데이트 활성화 권장

3. **네트워크 격리**
   - 0.0.0.0 바인딩 금지 (기본값 변경)
   - 방화벽 설정 필수
   - 인증 활성화

**출처**: [OpenClaw Security Risks](https://www.bitsight.com/blog/openclaw-ai-security-risks-exposed-instances)

### 검증되지 않은 정보 (Unverified)
1. **정확한 응답 속도 벤치마크**: 일부 출처에서 상이한 수치 보고
2. **실제 전기료**: 지역별 전기료 차이로 $2-6/월 범위가 큼
3. **M5 칩 MLX 성능**: 실제 OpenClaw 통합 테스트 부족

### 할루시네이션 위험
- ⚠️ "OpenClaw MLX Metal acceleration" 구체적 프로젝트는 미확인
- MLX 프레임워크 자체는 존재하나 OpenClaw 공식 통합 문서 부족
- vllm-mlx는 서드파티 프로젝트 (공식 지원 불명확)

---

## 14. 추가 리소스

### 공식 문서
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Docs](https://docs.openclaw.ai/)
- [Discord 커뮤니티](https://docs.openclaw.ai/channels/discord)

### 튜토리얼
- [Codecademy: OpenClaw Tutorial](https://www.codecademy.com/article/open-claw-tutorial-installation-to-first-chat-setup)
- [SitePoint: How to Set Up OpenClaw](https://www.sitepoint.com/how-to-set-up-openclaw-on-a-mac-mini/)
- [OpenClaw/Moltbot/ClawdBot 101](https://sidsaladi.substack.com/p/openclawmoltbotclawdbot-101-the-complete)

### 커뮤니티 가이드
- [awesome-openclaw](https://github.com/rohitg00/awesome-openclaw)
- [CoClaw - Community Platform](https://coclaw.com/)

---

## 15. 결론 및 실행 계획

### 이재풍님을 위한 맞춤 추천

#### 상황 분석
- **기존 인프라**: Mac Mini (jepo@172.30.1.5) 보유
- **보안 요구**: 높음 (트레이딩 시스템 운영)
- **프라이버시**: 중요 (재무 데이터 취급)
- **예산**: 중간 (효율 중시)

#### 권장 구성
```
옵션 1: 기존 Mac Mini 활용 (예산 최소화)
- 현재 Mac Mini 사양 확인 필요
- OpenClaw 격리 환경 구축 (Docker)
- Tailscale VPN 통한 접근 제한
- Claude API 사용 (트레이딩과 분리)

옵션 2: 전용 Mac Mini M4 24GB 신규 구매 (권장) ⭐
- 가격: $890 (할인가)
- OpenClaw 전용 머신
- 로컬 14B + Claude 하이브리드
- 트레이딩 서버와 네트워크 격리
```

#### 단계별 실행 계획
**Phase 1: 테스트 (2주)**
1. 기존 Mac Mini에 Docker로 OpenClaw 설치
2. Claude API 연동 테스트
3. 보안 설정 강화 (방화벽, VPN)
4. 실사용 패턴 파악 (API 비용 측정)

**Phase 2: 평가 (1주)**
1. API 비용 vs 로컬 LLM 비용 비교
2. 보안 리스크 재평가
3. 성능/편의성 검증

**Phase 3: 확장 (필요 시)**
1. 전용 Mac Mini M4 24GB 구매
2. 프로덕션 환경 구축
3. 자동화 워크플로우 통합

#### 핵심 체크리스트
- [ ] OpenClaw 2026.1.29 이상 버전 사용
- [ ] 전용 머신 사용 (트레이딩 서버와 분리)
- [ ] Tailscale VPN 설정
- [ ] 방화벽: 18789 포트 외부 차단
- [ ] 인증 활성화
- [ ] 자동 백업 설정
- [ ] 모니터링 대시보드 구축

---

## Sources

### 공식 문서 및 GitHub
- [GitHub - openclaw/openclaw](https://github.com/openclaw/openclaw)
- [Getting Started - OpenClaw](https://docs.openclaw.ai/start/getting-started)
- [Docker - OpenClaw](https://docs.openclaw.ai/install/docker)
- [Multi-Agent Routing - OpenClaw](https://docs.openclaw.ai/concepts/multi-agent)
- [Discord - OpenClaw](https://docs.openclaw.ai/channels/discord)
- [GitHub - ml-explore/mlx](https://github.com/ml-explore/mlx)

### Mac Mini 하드웨어 및 성능
- [OpenClaw Mac Mini Setup: M4 Pro, 64GB](https://www.marc0.dev/en/blog/openclaw-mac-mini-the-complete-guide-to-running-your-own-ai-agent-in-2026-1770057455419)
- [Mac Mini Hardware Requirements for OpenClaw](https://www.openclawexperts.io/guides/setup/openclaw-mac-mini-hardware-specs-requirements)
- [Best Mac mini for OpenClaw](https://www.dadnology.com/guides/mac-mini-best-buy-for-openclaw)
- [Transform Your Mac Mini Into AI Powerhouse](https://thamizhelango.medium.com/transform-your-mac-mini-into-a-personal-ai-powerhouse-the-complete-openclaw-guide-f2f3e8e1b554)
- [Mac Mini M4 AI Server](https://www.marc0.dev/en/blog/mac-mini-ai-server-ollama-openclaw-claude-code-complete-guide-2026-1770481256372)

### 비용 및 가격 비교
- [OpenClaw Deploy Cost Guide](https://yu-wenhao.com/en/blog/2026-02-01-openclaw-deploy-cost-guide/)
- [A realistic guide to OpenClaw AI pricing](https://www.eesel.ai/blog/openclaw-ai-pricing)
- [OpenClaw Pricing Guide](https://www.thecaio.ai/blog/openclaw-pricing-guide)
- [Reduce Your OpenClaw LLM Costs](https://blog.salad.com/reduce-your-openclaw-llm-costs-saladcloud-guide/)
- [OpenClaw Cloud vs Local Deployment](https://help.apiyi.com/en/openclaw-cloud-vs-local-deployment-guide-en.html)

### 전력 소비
- [Mac mini power consumption - Apple Support](https://support.apple.com/en-us/103253)
- [M4 Mac mini's efficiency is incredible - Jeff Geerling](https://www.jeffgeerling.com/blog/2024/m4-mac-minis-efficiency-incredible/)
- [Running cost of Mac mini M4 Pro](https://www.sust-it.net/power-consumption-price-comparison/apple/MacminiM4Pro/desktop-computers)

### 보안
- [OpenClaw Bug Enables One-Click RCE](https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html)
- [Critical vulnerability in OpenClaw](https://ccb.belgium.be/advisories/warning-critical-vulnerability-openclaw-allows-1-click-remote-code-execution-when)
- [OpenClaw ecosystem suffering security issues - The Register](https://www.theregister.com/2026/02/02/openclaw_security_issues/)
- [135K OpenClaw AI Agents Exposed](https://www.bitdefender.com/en-us/blog/hotforsecurity/135k-openclaw-ai-agents-exposed-online)
- [Cisco: Personal AI Agents Security Nightmare](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare)
- [Kaspersky: OpenClaw vulnerabilities](https://www.kaspersky.com/blog/openclaw-vulnerabilities-exposed/55263/)
- [Fortune: OpenClaw security experts on edge](https://fortune.com/2026/02/12/openclaw-ai-agents-security-risks-beware/)
- [CrowdStrike: What Security Teams Need to Know](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/)
- [OpenClaw security 101: hardening guide](https://adversa.ai/blog/openclaw-security-101-vulnerabilities-hardening-2026/)

### MLX 및 로컬 LLM
- [Exploring LLMs with MLX and M5 GPU](https://machinelearning.apple.com/research/exploring-llms-mlx-m5)
- [WWDC25: Explore LLMs with MLX](https://developer.apple.com/videos/play/wwdc2025/298/)
- [Local AI with MLX on Mac](https://www.markus-schall.de/en/2025/09/mlx-on-apple-silicon-as-local-ki-compared-with-ollama-co/)
- [vllm-mlx GitHub](https://github.com/waybarrios/vllm-mlx)
- [OpenClaw · Ollama Blog](https://ollama.com/blog/openclaw)
- [OpenClaw + Ollama Setup Guide](https://codersera.com/blog/openclaw-ollama-setup-guide-run-local-ai-agents-2026)

### 커뮤니티 경험
- [I Used OpenClaw for 6 Hours](https://theagilevc.substack.com/p/i-used-clawdbot-openclaw-for-6-hours)
- [Show HN: Running OpenClaw on $640 Mac Mini](https://news.ycombinator.com/item?id=46895546)
- [Mac Mini M4 + OpenClaw: Why Dangerous](https://hmnshudhmn24.medium.com/mac-mini-m4-openclaw-why-my-secure-ai-assistant-was-actually-dangerous-06eecbf61739)
- [Headless Mac Mini Solution](https://github.com/openclaw/openclaw/discussions/7700)

### 튜토리얼 및 가이드
- [OpenClaw Tutorial - Codecademy](https://www.codecademy.com/article/open-claw-tutorial-installation-to-first-chat-setup)
- [How to Set Up OpenClaw on Mac Mini - SitePoint](https://www.sitepoint.com/how-to-set-up-openclaw-on-a-mac-mini/)
- [OpenClaw/Moltbot/ClawdBot 101](https://sidsaladi.substack.com/p/openclawmoltbotclawdbot-101-the-complete)
- [awesome-openclaw](https://github.com/rohitg00/awesome-openclaw)

---

**보고서 작성**: Research Agent (JEPO)
**신뢰도 평가**: 높음 (공식 문서 + 다수 출처 교차 검증)
**최종 업데이트**: 2026-02-14
