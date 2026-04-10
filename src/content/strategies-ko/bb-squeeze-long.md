---
name: "BB Squeeze LONG"
description: "BB Squeeze의 롱 변형. 음의 기대값(-$26)과 51% 승률로 폐기."
status: "killed"
category: "volatility"
direction: "long"
difficulty: "intermediate"
winRate: 51.0
profitFactor: 0.98
totalPnl: "-$26"
timeframe: "1H"
coins: 577
dateAdded: "2026-01-10"
dateUpdated: "2026-04-10"
dateKilled: "2026-02-05"
tags: ["bollinger-bands", "squeeze", "long", "killed"]
---

## 개요

BB Squeeze LONG은 성공적인 SHORT 전략의 거울 이미지였습니다. 같은 설정, 같은 지표, 반대 방향. 가설: 스퀴즈 확장이 숏에 통하면, 롱에도 통할 것이다.

통하지 않았습니다.

## 결과

- **승률**: 51.0% (동전 던지기 수준)
- **수익 팩터**: 0.98 (수수료 후 순손실)
- **총 PnL**: -$26

## 왜 실패했는가

BB Squeeze 시그널은 방향 중립적입니다 — 변동성 확장을 감지하지, 방향을 감지하지 않습니다. 하지만 현재 크립토 시장에서:

- **숏은 평균회귀의 혜택** — 스퀴즈 후, 과도하게 상승한 랠리가 반전하는 경향
- **롱은 매크로 트렌드에 역행** — 하락/횡보장에서 롱 돌파는 빈번히 실패
- **비대칭 리스크** — 크립토는 올라가는 것보다 빠르게 떨어짐 (청산 캐스케이드)

## 교훈

같은 지표, 반대 방향, 완전히 다른 결과. 시장 구조가 시그널 품질보다 중요합니다. 2024-2026 크립토에서 숏 사이드는 롱 사이드에 없는 구조적 우위를 가지고 있습니다.

## 상태: 폐기

2026-02-05 Momentum LONG과 함께 폐기. 6명의 전문가 종합 분석이 만장일치로 확인: 현재 레짐에서 SHORT only가 올바른 설정.
