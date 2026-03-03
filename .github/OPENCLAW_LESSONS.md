# OpenClaw Lessons Learned

> 이 파일은 JEPO 코드 리뷰에서 발견된 패턴과 교훈을 기록합니다.
> PR을 생성하기 전에 반드시 이 파일을 읽고 동일한 실수를 반복하지 마세요.

---

## 필수 체크리스트 (PR 생성 전)

- [ ] **git 브랜치 전환 시 데이터 보존**: checkout 전에 생성된 파일을 tmpdir에 백업
- [ ] **동시 실행 보호**: 크론/스케줄 스크립트에는 반드시 `flock` 락 추가
- [ ] **trap EXIT**: 쉘 스크립트에서 브랜치 전환 시 `trap 'git checkout main' EXIT` 필수
- [ ] **빌드 검증 의미 확인**: 검증 대상이 실제 변경된 데이터인지 확인
- [ ] **`|| true` 남용 금지**: 실패를 무시하면 후속 단계가 잘못된 상태에서 실행됨
- [ ] **backend/ 경로 주의**: automerge가 `backend/` 경로 변경을 차단함 — 반드시 수동 리뷰 필요

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

### git 브랜치 전환 시 데이터 보존
```bash
# 절대 하지 말 것:
git checkout other-branch  # 워킹 트리의 uncommitted 변경이 사라짐!

# 올바른 방법:
TMPDIR=$(mktemp -d)
cp -r important-files "$TMPDIR/"
git checkout other-branch
cp -r "$TMPDIR/important-files" ./
rm -rf "$TMPDIR"
```

### 검증 시점
- 빌드 검증은 실제 변경된 데이터가 포함된 상태에서 실행
- `git checkout main` 후에는 main의 기존 데이터가 복원됨 → 새 데이터 검증이 아님
