# OpenClaw 보안 강화 가이드 (2026년 2월 기준)

> **작성일**: 2026-02-13
> **대상 환경**: Mac Mini M4 Pro 64GB (macOS 26)
> **목적**: 안전한 OpenClaw 설치 및 운영

---

## 목차
1. [최신 보안 취약점](#1-최신-보안-취약점)
2. [OpenClaw 샌드박스 설정](#2-openclaw-샌드박스-설정)
3. [외부 서비스 연동 보안](#3-외부-서비스-연동-보안)
4. [macOS 26 격리 방법](#4-macos-26-격리-방법)
5. [역방향 접근 차단](#5-역방향-접근-차단)
6. [보안 체크리스트](#6-보안-체크리스트)

---

## 1. 최신 보안 취약점

### 1.1 CVE-2026-25253: 1-Click RCE 취약점 (Critical)

**심각도**: CVSS 8.8 (High)
**발견일**: 2026년 2월 초
**영향 범위**: OpenClaw 2026.1.29 이전 버전

#### 취약점 상세
- **공격 방식**: 악의적 URL을 통한 인증 토큰 탈취 → RCE
- **악용 경로**:
  ```
  1. 공격자가 악의적 gatewayUrl 파라미터가 포함된 링크 전송
  2. 피해자가 링크 클릭 (1-Click)
  3. OpenClaw가 자동으로 WebSocket 연결 시도
  4. 인증 토큰이 공격자 서버로 전송됨
  5. 공격자가 RCE 실행
  ```
- **특이사항**: localhost에서 실행 중이어도 피해자 브라우저를 통해 로컬 네트워크 침투 가능
- **영향**: 전 세계 135,000개 이상의 OpenClaw 인스턴스가 인터넷에 노출됨

#### 패치 상태
- **패치 버전**: OpenClaw 2026.1.29 이상
- **최신 안정 버전**: 2026.2.12 (2026년 2월 12일)
- **필수 조치**:
  ```bash
  # OpenClaw 업데이트
  claw update

  # 버전 확인
  claw version  # 2026.1.29 이상인지 확인

  # 인증 토큰 강제 재발급
  claw gateway token rotate
  ```

### 1.2 ClawHub 악성 스킬 현황

**발견 수**: 341개 이상 (2026년 2월 3일 기준)
**추가 발견**: 386개 (Paul McCarty, 2026년 2월 1~3일)

#### 주요 악성 스킬 유형
1. **암호화폐 트레이딩 봇 위장**
   - 가짜 필수 패키지를 설치하여 Atomic Stealer (AMOS) 배포
   - 335개 스킬이 macOS Atomic Stealer 설치

2. **자격 증명 탈취**
   - 암호화폐 거래소 API 키
   - 지갑 개인키
   - SSH 자격 증명
   - 브라우저 저장 비밀번호

3. **평문 자격 증명 노출**
   - 전체 ClawHub 스킬의 7.1%가 자격 증명을 평문으로 노출

#### 보안 대응
- **VirusTotal 스캔 도입** (2026년 2월 발표)
  - 모든 ClawHub 업로드 스킬을 VirusTotal로 자동 스캔
  - Code Insight 기능으로 코드 수준 분석
- **프롬프트 인젝션 취약점**: 전체 스킬의 36%가 프롬프트 인젝션에 취약

### 1.3 최신 보안 패치 (2026.2.12)

OpenClaw 2026.2.12 버전에서 수정된 40개 이상의 취약점:
- Gateway 보안 강화
- Sandbox 격리 개선
- 다중 통합 제공자 보안 패치

---

## 2. OpenClaw 샌드박스 설정

### 2.1 Docker 기반 격리 실행

#### 샌드박스 모드 종류

| 모드 | 설명 | 보안 수준 |
|------|------|-----------|
| `off` | 샌드박스 없음 (호스트에서 직접 실행) | ⚠️ 낮음 |
| `non-main` | 그룹/스레드만 샌드박스, 메인 DM은 호스트 | ⚠️ 중간 |
| `all` | 모든 세션을 Docker 컨테이너에서 실행 | ✅ 높음 |

#### Scope 옵션

| Scope | 설명 | 격리 수준 |
|-------|------|-----------|
| `session` | 세션마다 별도 컨테이너 (기본값) | ✅ 최고 |
| `agent` | 에이전트마다 별도 컨테이너 | 중간 |
| `shared` | 모든 에이전트가 단일 컨테이너 공유 | ⚠️ 낮음 |

#### 권장 설정 (openclaw.json)

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all",           // 모든 세션 격리
        "scope": "session",       // 세션별 독립 컨테이너
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "network": "none",      // 네트워크 격리
          "readOnlyRoot": true,   // 읽기 전용 루트 파일시스템
          "dropCapabilities": [   // Linux 권한 제거
            "NET_RAW",
            "SYS_ADMIN",
            "SYS_PTRACE"
          ]
        }
      }
    }
  }
}
```

### 2.2 파일시스템 접근 제한

#### allowedDirectories 설정

```json
{
  "agents": {
    "defaults": {
      "fileAccess": {
        "mode": "allowlist",
        "allowedPaths": [
          "/opt/OpenClaw/workspace",
          "/Users/jplee/Desktop/autotrader"  // 특정 프로젝트만
        ],
        "deniedPaths": [
          "/Users/jplee/.ssh",               // SSH 키 차단
          "/Users/jplee/.openclaw/credentials",  // 자격 증명 차단
          "/etc",
          "/System",
          "/Library/Keychains"               // macOS 키체인 차단
        ],
        "rules": [
          {
            "pattern": "/Users/jplee/Desktop/autotrader/**",
            "operations": ["read", "write"],
            "allow": true
          },
          {
            "pattern": "/Users/jplee/.ssh/**",
            "operations": ["*"],
            "allow": false
          }
        ]
      }
    }
  }
}
```

### 2.3 네트워크 접근 제한

#### 특정 호스트만 허용

```json
{
  "gateway": {
    "bind": "loopback",          // 127.0.0.1만 바인딩 (기본값)
    "auth": {
      "required": true,          // 인증 필수
      "failClosed": true         // 인증 실패 시 연결 차단
    },
    "trustedProxies": [
      "127.0.0.1",
      "100.64.0.0/10"            // Tailscale 네트워크만
    ]
  },
  "sandbox": {
    "docker": {
      "network": "none",         // 컨테이너 네트워크 완전 차단
      "allowedHosts": [          // 필요 시 특정 호스트만 허용
        "api.telegram.org",
        "api.openai.com"
      ]
    }
  }
}
```

### 2.4 MCP 서버 제한

#### 화이트리스트 방식 설정

```json
{
  "mcpServers": {
    "allowlist": [
      "mem0",                    // 허용된 MCP 서버만 나열
      "github"
    ],
    "denylist": [
      "*"                        // 나머지 모두 차단
    ]
  }
}
```

### 2.5 스킬 설치 제한

#### 화이트리스트 설정

```json
{
  "skills": {
    "installPolicy": "allowlist",
    "allowedSkills": [
      "official/git",            // 공식 스킬만
      "official/docker"
    ],
    "autoInstall": false,        // 자동 설치 비활성화
    "verifySignatures": true     // 서명 검증 필수
  }
}
```

#### 수동 검증 절차

```bash
# 스킬 설치 전 VirusTotal 확인
# 1. ClawHub에서 스킬 페이지 확인
# 2. "Security Scan" 결과 확인
# 3. 평판이 좋고 다운로드 수가 많은 스킬만 설치

# 스킬 설치
claw skill install <skill-name> --verify

# 설치된 스킬 감사
claw skill list --verbose
```

---

## 3. 외부 서비스 연동 보안

### 3.1 SSH 키 접근 차단

#### 방법 1: 파일시스템 거부 목록

```json
{
  "agents": {
    "defaults": {
      "fileAccess": {
        "deniedPaths": [
          "/Users/jplee/.ssh",
          "/Users/jplee/.ssh/*"
        ]
      }
    }
  }
}
```

#### 방법 2: macOS 파일 권한

```bash
# SSH 디렉토리 권한 강화
chmod 700 ~/.ssh
chmod 600 ~/.ssh/*

# OpenClaw 전용 사용자로 실행 시 소유권 분리
sudo chown -R openclaw:openclaw /opt/openclaw
# 주의: OpenClaw는 ~/.ssh에 접근 불가
```

#### 방법 3: Docker 볼륨 마운트 제외

```json
{
  "sandbox": {
    "docker": {
      "volumes": [
        "/Users/jplee/Desktop/autotrader:/workspace:rw",
        // SSH 디렉토리는 마운트하지 않음
      ]
    }
  }
}
```

### 3.2 환경 변수/시크릿 격리

#### 권장 방식: 환경 변수 우선순위 활용

```bash
# OpenClaw 우선순위
# 1. 프로세스 환경 변수 (최우선)
# 2. 로컬 .env
# 3. ~/.openclaw/.env
# 4. openclaw.json의 env 필드
```

#### 안전한 시크릿 관리

```bash
# 1. 별도 .env 파일 생성 (Agent 접근 불가 위치)
cat > /opt/openclaw/.env.secrets << 'EOF'
TELEGRAM_BOT_TOKEN=your_token_here
N8N_API_KEY=your_key_here
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here
EOF

# 2. 권한 설정 (openclaw 사용자만 읽기 가능)
sudo chown openclaw:openclaw /opt/openclaw/.env.secrets
sudo chmod 400 /opt/openclaw/.env.secrets

# 3. systemd/launchd에서 EnvironmentFile 지정
# macOS LaunchDaemon 예시 (/Library/LaunchDaemons/com.openclaw.plist)
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
"http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw</string>
    <key>EnvironmentVariables</key>
    <dict>
        <!-- 여기서 환경 변수 지정 -->
    </dict>
    <key>UserName</key>
    <string>_openclaw</string>
</dict>
</plist>
```

#### Agent가 .env 읽는 것 방지

```json
{
  "agents": {
    "defaults": {
      "fileAccess": {
        "deniedPaths": [
          "/opt/openclaw/.env.secrets",
          "/Users/jplee/.openclaw/.env",
          "**/.env"                    // 모든 .env 파일 차단
        ]
      }
    }
  }
}
```

### 3.3 API 키 보호

#### Broker 패턴 (권장)

에이전트가 API 키를 직접 보지 못하게 프록시 서버 사용:

```bash
# n8n, Telegram 등의 API를 프록시로 감쌈
# 예시: n8n-proxy.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/n8n/*', async (req, res) => {
  const n8nApiKey = process.env.N8N_API_KEY;  // 프록시만 키 보유
  const path = req.params[0];

  try {
    const response = await axios({
      method: req.method,
      url: `https://your-n8n-instance.com/api/v1/${path}`,
      headers: {
        'X-N8N-API-KEY': n8nApiKey
      },
      data: req.body
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data);
  }
});

app.listen(3001, '127.0.0.1');
```

OpenClaw 설정:
```json
{
  "integrations": {
    "n8n": {
      "endpoint": "http://127.0.0.1:3001/n8n",
      // API 키 없음 - 프록시가 처리
    }
  }
}
```

#### 단기 토큰 사용

```bash
# OAuth2 Refresh Token 방식
# 1. 짧은 유효기간 (1시간) Access Token 발급
# 2. Refresh Token으로 자동 갱신
# 3. OpenClaw가 만료된 토큰으로 피해 최소화
```

### 3.4 Heartbeat 자동 실행 시 권한 최소화

```json
{
  "agents": {
    "heartbeat": {
      "enabled": true,
      "interval": 3600,          // 1시간마다
      "sandbox": {
        "mode": "all",           // Heartbeat도 샌드박스에서 실행
        "scope": "session"
      },
      "permissions": {
        "allowedTools": [
          "sessions_list",       // 세션 목록만
          "read"                 // 읽기만
        ],
        "deniedTools": [
          "write",
          "edit",
          "bash",
          "browser"
        ]
      }
    }
  }
}
```

---

## 4. macOS 26 격리 방법

### 4.1 격리 방식 비교

| 방식 | 보안 수준 | 복잡도 | 성능 | 권장도 |
|------|-----------|--------|------|--------|
| Docker | ⭐⭐⭐⭐⭐ | 중간 | 양호 | ✅ 최고 권장 |
| 별도 사용자 계정 | ⭐⭐⭐⭐ | 낮음 | 최고 | ✅ 권장 |
| macOS Sandbox Profile | ⭐⭐⭐ | 높음 | 최고 | ⚠️ 복잡 |
| App Sandbox | ⭐⭐⭐ | 중간 | 양호 | ⚠️ 제한적 |

### 4.2 Docker 격리 (최고 권장)

#### 설치 및 설정

```bash
# 1. Docker Desktop for Mac 설치
brew install --cask docker

# 2. OpenClaw Docker 이미지 빌드
cd /opt/openclaw
docker build -t openclaw-sandbox:latest .

# 3. 보안 강화 Docker 실행
docker run -d \
  --name openclaw \
  --network none \                    # 네트워크 격리
  --read-only \                       # 읽기 전용 파일시스템
  --tmpfs /tmp:rw,noexec,nosuid \    # 임시 디렉토리만 쓰기 가능
  --cap-drop ALL \                    # 모든 Linux Capability 제거
  --security-opt no-new-privileges \  # 권한 상승 금지
  -v /Users/jplee/Desktop/autotrader:/workspace:ro \  # 프로젝트는 읽기 전용
  -v openclaw-data:/data \            # 영구 데이터는 볼륨
  openclaw-sandbox:latest

# 4. 로그 확인
docker logs -f openclaw
```

#### Docker Compose 설정

```yaml
# /opt/openclaw/docker-compose.yml
version: '3.8'

services:
  openclaw:
    build: .
    container_name: openclaw
    restart: unless-stopped

    security_opt:
      - no-new-privileges:true

    cap_drop:
      - ALL

    read_only: true

    networks:
      - openclaw_internal

    volumes:
      - /Users/jplee/Desktop/autotrader:/workspace:ro
      - openclaw-data:/data
      - /tmp:/tmp:rw,noexec,nosuid

    environment:
      - OPENCLAW_GATEWAY_BIND=0.0.0.0  # Docker 내부에서만
      - OPENCLAW_SANDBOX_MODE=all

    labels:
      - "com.openclaw.security=high"

networks:
  openclaw_internal:
    driver: bridge
    internal: true  # 외부 인터넷 차단

volumes:
  openclaw-data:
    driver: local
```

### 4.3 별도 사용자 계정 격리 (권장)

#### 전용 사용자 생성

```bash
# 1. _openclaw 사용자 생성 (macOS 시스템 사용자 규칙 따름)
sudo dscl . -create /Users/_openclaw
sudo dscl . -create /Users/_openclaw UserShell /usr/bin/false  # 로그인 불가
sudo dscl . -create /Users/_openclaw UniqueID 501  # 적절한 UID
sudo dscl . -create /Users/_openclaw PrimaryGroupID 501
sudo dscl . -create /Users/_openclaw NFSHomeDirectory /var/lib/openclaw
sudo dscl . -create /Users/_openclaw RealName "OpenClaw Service"

# 2. 홈 디렉토리 생성
sudo mkdir -p /var/lib/openclaw
sudo chown _openclaw:_openclaw /var/lib/openclaw
sudo chmod 700 /var/lib/openclaw

# 3. 워크스페이스 권한 설정
sudo mkdir -p /var/lib/openclaw/workspace
sudo ln -s /Users/jplee/Desktop/autotrader /var/lib/openclaw/workspace/autotrader
# 주의: 심볼릭 링크로 연결, 원본은 jplee 소유 유지

# 4. SSH 키 접근 차단 확인
sudo -u _openclaw ls /Users/jplee/.ssh  # Permission Denied 확인
```

#### LaunchDaemon 설정

```bash
# /Library/LaunchDaemons/com.openclaw.plist
sudo tee /Library/LaunchDaemons/com.openclaw.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
"http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw</string>

    <key>UserName</key>
    <string>_openclaw</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/claw</string>
        <string>gateway</string>
        <string>start</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/var/lib/openclaw</string>

    <key>StandardOutPath</key>
    <string>/var/log/openclaw/stdout.log</string>

    <key>StandardErrorPath</key>
    <string>/var/log/openclaw/stderr.log</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>ProcessType</key>
    <string>Background</string>

    <key>Nice</key>
    <integer>10</integer>
</dict>
</plist>
EOF

# 권한 설정
sudo chown root:wheel /Library/LaunchDaemons/com.openclaw.plist
sudo chmod 644 /Library/LaunchDaemons/com.openclaw.plist

# 서비스 로드
sudo launchctl load /Library/LaunchDaemons/com.openclaw.plist

# 상태 확인
sudo launchctl list | grep openclaw
```

### 4.4 키체인 접근 차단

```bash
# macOS 키체인 접근 권한 확인
security list-keychains

# OpenClaw가 키체인 접근하는지 감사
sudo fs_usage -w -f filesys | grep Keychain

# 키체인 접근 차단 (별도 사용자 방식)
# _openclaw 사용자는 기본적으로 jplee의 키체인 접근 불가

# Docker 방식
# 컨테이너 내부에는 키체인 경로 자체가 없음
```

---

## 5. 역방향 접근 차단

### 5.1 OpenClaw → 로컬 네트워크 접근 차단

#### Docker 네트워크 격리

```yaml
# docker-compose.yml
services:
  openclaw:
    networks:
      - isolated
    # 외부 네트워크 연결 없음

networks:
  isolated:
    driver: bridge
    internal: true  # 인터넷 및 호스트 네트워크 차단
```

#### iptables 규칙 (Linux 컨테이너)

```bash
# Docker 컨테이너에서 나가는 트래픽 차단
sudo iptables -I DOCKER-USER -i docker0 -j DROP
sudo iptables -I DOCKER-USER -i docker0 -d 127.0.0.1 -j ACCEPT  # localhost만 허용
sudo iptables -I DOCKER-USER -i docker0 -d 100.64.0.0/10 -j ACCEPT  # Tailscale만 허용
```

### 5.2 Tailscale ACL 단방향 접근 설정

#### ACL 정책 파일 (policy.hujson)

```json
{
  "acls": [
    // MacBook Pro → Mac Mini 접근 허용
    {
      "action": "accept",
      "src": ["tag:admin"],              // MacBook Pro
      "dst": ["tag:openclaw:*"]          // Mac Mini의 모든 포트
    },

    // Mac Mini → MacBook Pro 접근 차단
    // (명시적 deny가 아닌 allow 없음으로 차단)
    // Tailscale은 기본 deny 정책

    // Mac Mini → 인터넷 접근 허용 (필요한 경우)
    {
      "action": "accept",
      "src": ["tag:openclaw"],
      "dst": ["autogroup:internet:443", "autogroup:internet:80"]
    }
  ],

  "tagOwners": {
    "tag:admin": ["autogroup:admin"],
    "tag:openclaw": ["autogroup:admin"]
  },

  "hosts": {
    "macbook-pro": "100.64.1.10",
    "mac-mini-openclaw": "100.64.1.20"
  }
}
```

#### Tailscale 설정 적용

```bash
# 1. Mac Mini에 Tailscale 설치
brew install tailscale

# 2. Tailscale 시작 (tag 지정)
sudo tailscale up --advertise-tags=tag:openclaw

# 3. ACL 적용 (Tailscale Admin Console에서)
# https://login.tailscale.com/admin/acls

# 4. 접근 테스트
# MacBook Pro에서:
ssh jplee@mac-mini-openclaw  # ✅ 성공해야 함

# Mac Mini에서:
ssh jplee@macbook-pro  # ❌ 연결 거부되어야 함
```

#### Tailscale Funnel 비활성화

```bash
# Mac Mini에서 Funnel 비활성화 (인터넷 공개 방지)
tailscale funnel off

# Serve도 비활성화 (Tailnet 내부 공개만)
tailscale serve off
```

### 5.3 macOS 방화벽 아웃바운드 제한

#### Little Snitch 설정 (유료)

```bash
# 1. Little Snitch 설치
brew install --cask little-snitch

# 2. Little Snitch 규칙 생성
# GUI에서 설정:
# - 앱: /usr/local/bin/claw
# - 방향: Outgoing
# - 호스트:
#   - Allow: api.openai.com, api.telegram.org, api.binance.com
#   - Deny: 192.168.0.0/16, 10.0.0.0/8 (로컬 네트워크)

# 3. 명령줄로 규칙 추가 (예시)
# Little Snitch Rules.plist 편집 필요
```

#### LuLu 설정 (무료 오픈소스)

```bash
# 1. LuLu 설치
brew install --cask lulu

# 2. LuLu 실행 및 규칙 설정
# GUI에서:
# - Process: /usr/local/bin/claw
# - Action: Block
# - Exceptions:
#   - api.openai.com:443 (Allow)
#   - api.telegram.org:443 (Allow)
#   - api.binance.com:443 (Allow)

# 3. 로컬 네트워크 차단 확인
# LuLu는 프로세스 단위 차단만 지원 (포트/도메인 필터 제한적)
```

#### pf (Packet Filter) 규칙 (고급)

```bash
# /etc/pf.anchors/com.openclaw
# OpenClaw 전용 pf 규칙

# 변수 정의
openclaw_user = "_openclaw"
allowed_nets = "{ 100.64.0.0/10 }"  # Tailscale만
blocked_nets = "{ 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12 }"

# 로컬 네트워크로 나가는 트래픽 차단
block out log quick from any to $blocked_nets user $openclaw_user

# Tailscale 네트워크만 허용
pass out quick from any to $allowed_nets user $openclaw_user

# HTTPS만 허용
pass out quick proto tcp from any to any port 443 user $openclaw_user

# /etc/pf.conf에 anchor 추가
# anchor "com.openclaw"
# load anchor "com.openclaw" from "/etc/pf.anchors/com.openclaw"

# pf 활성화
sudo pfctl -ef /etc/pf.conf

# 규칙 확인
sudo pfctl -sr
```

---

## 6. 보안 체크리스트

### 6.1 설치 전 체크리스트

```
□ OpenClaw 최신 버전 확인 (2026.1.29 이상)
□ Docker Desktop 설치 및 테스트
□ Tailscale 설치 및 ACL 설정
□ 전용 사용자 계정 (_openclaw) 생성
□ 파일 권한 설정 (SSH 키, 자격 증명)
□ 아웃바운드 방화벽 (Little Snitch 또는 LuLu) 설치
```

### 6.2 설정 후 검증

```bash
# 1. OpenClaw 버전 확인
claw version  # 2026.1.29 이상

# 2. 샌드박스 모드 확인
claw doctor | grep sandbox  # mode: all, scope: session

# 3. SSH 키 접근 테스트
# OpenClaw에게 "~/.ssh 디렉토리 내용 보여줘" 요청
# → Permission Denied 또는 Empty 반환되어야 함

# 4. 네트워크 격리 테스트
docker exec openclaw ping -c 1 192.168.0.1  # 실패해야 함
docker exec openclaw ping -c 1 8.8.8.8      # 실패해야 함 (network: none)

# 5. 파일 쓰기 제한 테스트
docker exec openclaw touch /test.txt  # Read-only file system 에러

# 6. Tailscale 단방향 접근 테스트
# MacBook Pro → Mac Mini: 성공
# Mac Mini → MacBook Pro: 실패

# 7. 키체인 접근 테스트
sudo -u _openclaw security list-keychains  # 접근 실패
```

### 6.3 운영 중 주기적 점검

```bash
# 매주 실행
claw update                  # 보안 업데이트 확인
claw skill audit             # 설치된 스킬 검토
docker image prune -a        # 오래된 이미지 제거

# 매월 실행
tailscale status             # Tailscale 연결 상태
sudo pfctl -sr               # 방화벽 규칙 확인
sudo launchctl list | grep openclaw  # 서비스 상태

# 분기별 실행
전체 보안 감사 수행
침투 테스트 (로컬 네트워크 접근 시도)
백업 및 재해 복구 계획 테스트
```

### 6.4 긴급 대응 절차

```bash
# OpenClaw 긴급 중지
sudo launchctl unload /Library/LaunchDaemons/com.openclaw.plist
# 또는
docker-compose down

# 인증 토큰 즉시 회전
claw gateway token rotate --force

# 모든 API 키 교체
# - Telegram Bot Token
# - n8n API Key
# - Binance API Key/Secret
# - OpenAI API Key

# 로그 분석
tail -f /var/log/openclaw/stderr.log
docker logs openclaw | grep -i "error\|unauthorized\|failed"

# 의심스러운 활동 확인
# - 예상치 못한 네트워크 연결
# - 파일 시스템 수정 시도
# - 인증 실패 로그
```

---

## 7. 추가 권장 사항

### 7.1 모니터링 및 알림

```bash
# 1. 파일 시스템 변경 감지 (fswatch)
brew install fswatch
fswatch -r /var/lib/openclaw | while read file; do
  echo "$(date): $file changed" >> /var/log/openclaw/fswatch.log
done &

# 2. 네트워크 트래픽 모니터링 (Little Snitch Alert)
# Little Snitch에서 알림 설정:
# - OpenClaw가 허용되지 않은 호스트에 연결 시도
# - 로컬 네트워크 접근 시도

# 3. 텔레그램 알림 봇 설정
# OpenClaw 이상 활동 감지 시 텔레그램 알림
```

### 7.2 백업 전략

```bash
# 1. OpenClaw 설정 백업
tar -czf openclaw-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/openclaw \
  /Library/LaunchDaemons/com.openclaw.plist \
  /etc/pf.anchors/com.openclaw

# 2. 복원 스크립트
cat > restore-openclaw.sh << 'EOF'
#!/bin/bash
BACKUP_FILE=$1
tar -xzf "$BACKUP_FILE" -C /
sudo launchctl load /Library/LaunchDaemons/com.openclaw.plist
sudo pfctl -ef /etc/pf.conf
EOF
chmod +x restore-openclaw.sh
```

### 7.3 정기 보안 업데이트

```bash
# 주간 자동 업데이트 스크립트
cat > /usr/local/bin/openclaw-update.sh << 'EOF'
#!/bin/bash
# OpenClaw 자동 업데이트

LOG=/var/log/openclaw/update.log
echo "$(date): Starting OpenClaw update" >> $LOG

# 1. 백업
tar -czf /var/backups/openclaw-pre-update-$(date +%Y%m%d).tar.gz \
  /var/lib/openclaw

# 2. 업데이트
claw update >> $LOG 2>&1

# 3. 서비스 재시작
sudo launchctl unload /Library/LaunchDaemons/com.openclaw.plist
sudo launchctl load /Library/LaunchDaemons/com.openclaw.plist

# 4. 확인
sleep 10
if sudo launchctl list | grep -q openclaw; then
  echo "$(date): Update successful" >> $LOG
else
  echo "$(date): Update failed - restoring backup" >> $LOG
  # 복원 로직
fi
EOF

chmod +x /usr/local/bin/openclaw-update.sh

# LaunchDaemon으로 주간 실행
sudo tee /Library/LaunchDaemons/com.openclaw.update.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
"http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.update</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/openclaw-update.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>  <!-- 일요일 -->
        <key>Hour</key>
        <integer>3</integer>  <!-- 오전 3시 -->
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
EOF

sudo launchctl load /Library/LaunchDaemons/com.openclaw.update.plist
```

---

## 요약: 최소 보안 구성

Mac Mini M4 Pro에서 OpenClaw를 안전하게 운영하기 위한 최소 필수 구성:

1. **OpenClaw 2026.1.29 이상** 설치 (CVE-2026-25253 패치)
2. **Docker 격리 모드** (sandbox: all, network: none)
3. **별도 사용자 계정** (_openclaw, 홈 디렉토리 격리)
4. **파일시스템 제한** (SSH 키, 키체인 접근 차단)
5. **Tailscale ACL** (MacBook Pro → Mac Mini 단방향만 허용)
6. **아웃바운드 방화벽** (LuLu로 로컬 네트워크 차단)
7. **MCP/스킬 화이트리스트** (신뢰된 것만 허용)
8. **주기적 업데이트** (매주 자동 또는 수동)

---

## 참고 자료

- [OpenClaw 공식 보안 문서](https://docs.openclaw.ai/gateway/security)
- [CVE-2026-25253 상세 분석](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/)
- [OpenClaw 보안 강화 가이드](https://aimaker.substack.com/p/openclaw-security-hardening-guide)
- [Docker 보안 모범 사례](https://docs.openclaw.ai/install/docker)
- [Tailscale ACL 가이드](https://tailscale.com/kb/1018/acls/)

---

**면책 조항**: 이 문서는 2026년 2월 13일 기준 공개된 정보를 바탕으로 작성되었습니다. 보안 위협은 지속적으로 진화하므로 정기적으로 최신 보안 권고사항을 확인하시기 바랍니다.
