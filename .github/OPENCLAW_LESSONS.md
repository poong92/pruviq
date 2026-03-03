# OpenClaw Lessons Learned (v0.1.2)

> 이 파일은 JEPO 코드 리뷰에서 발견된 패턴과 교훈을 기록합니다.
> PR을 생성하기 전에 반드시 이 파일을 읽고 동일한 실수를 반복하지 마세요.
>
> **버전**: SemVer — MAJOR(안정화 릴리스).MINOR(규칙/교훈 추가).PATCH(문구 수정)
> - v0.1.0 (2026-03-03): 초기 작성 (PR #154 교훈)
> - v0.1.1 (2026-03-04): PR #159 교훈 추가, 브랜치 전환 금지 규칙
> - v0.1.2 (2026-03-04): 데이터 파이프라인 무결성 체크, 패턴 가이드 개선

---

## 필수 체크리스트 (PR 생성 전)

- [ ] **브랜치 전환 금지**: cron/스케줄 스크립트에서 `git checkout`으로 브랜치를 바꾸지 마라. 배포가 깨진다.
- [ ] **동시 실행 보호**: 크론/스케줄 스크립트에는 반드시 `flock` 락 추가
- [ ] **trap EXIT**: 쉘 스크립트에 반드시 `trap` 추가 (인터럽트 시 자동 복구)
- [ ] **배포 경로 확인**: `npm run build` + `wrangler deploy`가 실제 새 데이터로 실행되는지 확인
- [ ] **`|| true` 남용 금지**: 실패를 무시하면 후속 단계가 잘못된 상태에서 실행됨
- [ ] **backend/ 경로 주의**: automerge가 `backend/` 경로 변경을 차단함 — 반드시 수동 리뷰 필요
- [ ] **단순함 우선**: 기존 스크립트에 안전장치를 추가하는 것이 구조를 바꾸는 것보다 안전하다

---

## 리뷰 이력

### 2026-03-03 — PR #154: fix(static-refresh): push generated static data to dedicated 'generated-data' branch

**문제점**:
1. `git checkout --orphan` + `git rm -rf .`이 방금 생성된 `public/data/*`를 삭제 → 빈 커밋
2. `git checkout main` 복귀 후 빌드 검증이 기존 데이터로 실행 → 검증 무의미
3. `flock` 없이 4시간 크론 실행 → 동시 실행 충돌 가능
4. `trap` 없음 → 중간 실패 시 잘못된 브랜치에 남겨짐

**올바른 패턴**:
```bash
# 1. 데이터 생성 후 백업
TMPDIR=$(mktemp -d)
cp -r public/data "$TMPDIR/"

# 2. 브랜치 전환
trap 'git checkout main 2>/dev/null || exit 1' EXIT
git checkout $BRANCH

# 3. 백업 복원
cp -r "$TMPDIR/data" public/
rm -rf "$TMPDIR"

# 4. 커밋 & 푸시
git add -f public/data
git commit -m "chore: update snapshot"
git push --force origin $BRANCH
```

**핵심 교훈**: git 브랜치 전환은 워킹 트리를 변경한다. 생성된 파일을 보존하려면 반드시 전환 전에 백업하라.

### 2026-03-04 — PR #159: 동일 코드 재제출 (3번째 실패)

**문제점**:
1. PR #154와 **완전히 동일한 코드** — 피드백 미반영
2. `generated-data` 브랜치에 데이터를 push하지만, 배포(`wrangler deploy`)는 main에서 실행 → **새 데이터가 배포에 반영되지 않음**
3. 브랜치 분리 자체가 잘못된 접근 — main에 데이터가 없으면 빌드/배포가 구 데이터 사용

**핵심 교훈**: 문제 해결 시 전체 데이터 흐름(생성 → 커밋 → 빌드 → 배포)을 끝까지 추적하라. 한 단계만 바꾸면 후속 단계가 깨진다.

**올바른 접근**: 이슈 #153의 "수정 지침 v3" 참조 — 브랜치 전환 없이 main에 직접 커밋 + flock/trap/pull 전략 보강.

---

## 패턴별 가이드

### 쉘 스크립트 안전 패턴
```bash
#!/bin/bash
set -euo pipefail

# 동시 실행 방지
exec 9>/tmp/script-name.lock
flock -n 9 || { echo "Already running"; exit 0; }

# 중단 시 복구
trap 'cleanup_function' EXIT

# 메인 로직
```

### cron 스크립트에서 git 사용 시 금지 사항
```bash
# 절대 하지 말 것:
git checkout other-branch    # 워킹 트리 변경 → 빌드/배포 깨짐
git rm -rf .                 # 전체 파일 삭제 → 복구 불가
git push --force origin main # main force-push → 재앙

# 안전한 방법: main에서 벗어나지 말 것
git add -f $DATA_FILES
git commit -m "chore: data refresh"
git pull -X ours --no-edit origin main
git push origin main
```

### 데이터 파이프라인 무결성 확인법
변경하기 전에 이 질문에 답하라:
1. 데이터가 생성된 후 main 브랜치에 있는가?
2. `npm run build`가 새 데이터를 포함하는가?
3. `wrangler deploy`가 새 빌드를 배포하는가?
**하나라도 "아니오"면 배포가 깨진다.**
