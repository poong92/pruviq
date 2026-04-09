// ⚠ STATS CONSTANTS — en.ts와 동기 유지. coins_analyzed 변경 시 두 파일 모두 업데이트.
// 현재 값: 570 (2026-03-17 기준). 출처: /public/data/site-stats.json

import type { TranslationKey } from "./en";

export const ko: Record<TranslationKey, string> = {
  // NAV
  "nav.market": "시장",
  "nav.simulate": "시뮬레이터",
  "nav.learn": "학습",
  "nav.fees": "수수료",
  "nav.strategies": "전략",
  "nav.coins": "코인",
  "nav.builder": "빌더",
  "nav.blog": "블로그",
  "nav.performance": "성과",
  "nav.ranking": "오늘의 전략 랭킹",
  "nav.lang": "English",

  // Hero
  "hero.tag": "무료 백테스팅 도구",
  "hero.title1": "{coins}개 코인, 3초 만에",
  "hero.title2": "전략 검증 완료.",
  "hero.subtitle": "코딩 없음. 가입 없음. 비용 없음. 오직 데이터.",
  "hero.desc":
    "570개 이상의 코인에서 5개 전략을 테스트했습니다. 4개는 손실. 모든 결과를 공개합니다. 실제 자금을 넣기 전에 어떤 전략이 진짜 통하는지 확인하세요.",
  "hero.cta_primary": "시뮬레이터 열기 — 무료",
  "hero.cta_builder": "나만의 전략 만들기",
  "hero.cta1": "전략 탐색하기",
  "hero.cta2": "트레이딩 IQ 높이기",
  "hero.beginner_note":
    "백테스팅이 처음이라면? 실제 돈을 넣기 전에 과거 데이터로 전략을 테스트하는 것입니다.",
  "hero.stat1": "코인 시뮬레이션",
  "hero.stat2": "과거 데이터",
  "hero.stat2_val": "2년+",
  "hero.stat3": "무료 & 투명",
  "hero.stat4": "백테스트 거래 수",
  "hero.stat5": "처리된 데이터 포인트",
  "hero.stat6": "신용카드 불필요",
  "hero.tool_coins": "570+ 코인 테스트",
  "hero.tool_strategies": "88+ 조합 백테스트",
  "hero.tool_data": "2년+ 과거 데이터",
  "hero.tool_free": "100% 무료, 가입 불필요",
  "hero.subcopy":
    "88가지 전략 조합을 검증했습니다. 4개가 실패했고 — 전부 공개했습니다.",
  "hero.cta_secondary": "시뮬레이션 결과 보기",
  "hero.open_source": "투명한 검증",
  "hero.stat1_sub": "BTC, ETH 포함 알트코인",
  "hero.stat4_sub": "검증된 전략 전체",
  "hero.stat5_sub": "2024년 1월부터 1시간봉",
  "hero.stat6_sub": "숨겨진 비용이나 프리미엄 없음",

  // Hero (centered layout)
  "hero.h1_line1": "모든 크립토 전략을 테스트하세요",
  "hero.h1_line2": "{coins}개 코인, 몇 초 만에 검증",
  "hero.cta_open_sim": "시뮬레이터 열기",
  "hero.cta_browse": "전략 탐색하기",
  "hero.badge_label": "회 시뮬레이션 실행",
  "hero.badge_cta": "무료 체험 →",
  "hero.how_title": "이렇게 작동합니다",
  "hero.how_subtitle": "전략 아이디어에서 검증 결과까지 3단계.",
  "hero.step1_title": "전략 선택",
  "hero.step1_desc":
    "{presets}개 프리셋에서 선택하거나 14개 지표로 커스텀 구성. AND/OR 로직 지원.",
  "hero.step2_title": "리스크 설정",
  "hero.step2_desc":
    "손절, 익절, 포지션 크기, 시간 필터. 실제 수수료와 슬리피지 포함.",
  "hero.step3_title": "실제 결과 확인",
  "hero.step3_desc":
    "{coins}개 코인에서 2년+ 데이터로 백테스트. 몇 초 만에 결과, 체리피킹 없음.",
  "hero.browser_alt": "PRUVIQ 전략 시뮬레이터 — {coins}개 코인 백테스트",

  // Problem
  "problem.tag": "문제점",
  "problem.title": "크립토 트레이딩, 뭐가 문제인가?",
  "problem.card1_title": "백테스트는 거짓말합니다",
  "problem.card1_desc":
    "570개 이상의 코인에서 88개 전략 조합을 2년 이상 실전 데이터로 검증했습니다. 선행 편향, 과적합, 레짐 무시 — 대부분의 전략이 같은 이유로 실패합니다. 저희는 어떤 전략이 왜 탈락했는지 전부 공개합니다.",
  "problem.card1_source": "출처: PRUVIQ 검증 파이프라인, 2024-2026",
  "problem.card2_title": "4개 전략 제거",
  "problem.card2_desc":
    "570개 이상의 코인, 2년 이상 데이터로 5개 전략을 테스트했습니다. 4개가 탈락했고, 저희는 그 실패를 모두 공개했습니다. 대부분의 플랫폼은 이걸 숨깁니다. 저희는 그것을 핵심 기능으로 만들었습니다.",
  "problem.card2_source": "출처: PRUVIQ 전략 라이브러리 — 모든 결과 공개",
  "problem.card3_title": "전문가도 틀렸습니다",
  "problem.card3_desc":
    "6명 중 6명의 전문가가 BTC 레짐 필터를 추천했습니다. 백테스트 결과 4개 변형 모두 성과가 악화되었습니다. 데이터가 직감을 이깁니다.",
  "problem.card3_source": "출처: 2026년 2월 전문가 패널 vs. 2년 백테스트",
  "problem.hook": "더 많은 시그널이 필요한 게 아닙니다.",
  "problem.case1_label": "사례 연구 #1",
  "problem.case2_label": "사례 연구 #2",
  "problem.case3_label": "사례 연구 #3",
  "problem.hook_accent": "검증이 내장된 시스템, 하나면 됩니다.",

  // Evidence (merged)
  "evidence.tag": "증거",
  "evidence.title": "모든 것을 증명합니다. 아무것도 숨기지 않습니다.",
  "evidence.desc":
    "PRUVIQ는 실제 자금을 투입하기 전에 전략을 테스트할 수 있게 합니다. 모든 시뮬레이션은 현실적인 비용을 반영하며, 실패를 포함한 모든 결과를 공개합니다. 시그널 서비스가 아닌, 검증 도구입니다.",
  "evidence.step1_title": "트레이딩 전에 백테스트",
  "evidence.step1_desc":
    "모든 전략은 570개 이상의 코인, 2년 이상의 데이터로 테스트한 후에만 실제 자본을 투입합니다. 예외 없음.",
  "evidence.step2_title": "트레이딩 전에 시뮬레이션",
  "evidence.step2_desc":
    "실제 수수료와 슬리피지를 반영한 과거 데이터로 전략을 테스트하세요. 드로다운, 연속 손실, 실제 리스크를 확인한 후 결정하세요.",
  "evidence.step3_title": "작동하지 않는 것은 제거",
  "evidence.step3_desc":
    "이미 시뮬레이션에서 손실을 낸 3개 전략을 제거했습니다. 자존심 없이. 데이터가 멈추라고 하면 멈춥니다.",
  "evidence.step4_title": "시장과 함께 진화",
  "evidence.step4_desc":
    "시장이 변하면 전략도 변해야 합니다. PRUVIQ는 지속적으로 테스트, 검증, 적응합니다. 오늘 통하는 전략이 내일은 다를 수 있습니다 — 그게 핵심입니다.",
  "evidence.lesson_tag": "88개 조합 테스트",
  "evidence.lesson1":
    "5개 전략 유형, 88개 파라미터 조합을 수백 개 코인에서 2년 이상의 데이터로 테스트했습니다.",
  "evidence.lesson_loss": "87개 제거.",
  "evidence.lesson1_end": "1개 생존.",
  "evidence.lesson2":
    "실패 원인? 선행 편향, 과적합, 레짐 무시. 교과서에 나오는 모든 실수 — 실제 자금을 투입하기 전에 발견했습니다.",
  "evidence.lesson3":
    "이 과정이 저희가 만드는 모든 것의 기반입니다. PRUVIQ의 모든 결정을 이끄는 하나의 원칙:",
  "evidence.lesson_rule":
    '"2년 이상의 데이터에서 생존을 증명할 수 없으면, 트레이딩하지 마라."',
  "evidence.publish_tag": "우리가 공개하는 것",
  "evidence.publish1": "모든 진입/청산 기록과 타임스탬프",
  "evidence.publish2": "승률, 패률, 순 손익",
  "evidence.publish3": "전략 변경 내역과 각 결정의 근거 데이터",
  "evidence.publish4": "실패한 실험과 중단 사유",
  "evidence.publish5": "리스크 파라미터와 포지션 사이징",
  "evidence.nopromise_tag": "약속하지 않는 것",
  "evidence.nopromise1": "보장된 수익 (누구도 할 수 없음)",
  "evidence.nopromise2": '레버리지로 "빠른 부자 되기"',
  "evidence.nopromise3": '비밀 독점 "AI" 마법',
  "evidence.nopromise4": "체리피킹된 백테스트 결과",
  "evidence.nopromise5": "절대 변하지 않는 영구 전략",
  "evidence.try_tag": "직접 체험하기",
  "evidence.try_desc":
    "결과를 읽기만 하지 마세요 — 직접 바꿔보세요. 손절과 익절 파라미터를 조정하고 50개 코인, 2년 이상 데이터에서 성과가 어떻게 변하는지 즉시 확인하세요.",
  "evidence.try_cta": "인터랙티브 데모 열기",
  "evidence.sim_tag": "시뮬레이션 작동 방식",
  "evidence.sim_coins": "코인",
  "evidence.sim_data": "데이터",
  "evidence.sim_fees": "수수료",
  "evidence.sim_fees_val": "포함",
  "evidence.sim_slippage": "슬리피지",
  "evidence.sim_slippage_val": "반영",
  "evidence.sim_note":
    "투명한 엔진이 현실적인 비용으로 전략을 시뮬레이션합니다. 선행 편향 없음. 신뢰하고 재현할 수 있는 결과.",

  // System
  "system.tag": "시스템",
  "system.title": "코드로, 직감이 아닌.",
  "system.desc":
    "추측 없이. 체리피킹 없이. 현실적인 시장 조건으로 전략을 시뮬레이션하는 Python 엔진.",
  "system.step1": "선택",
  "system.step1_desc":
    "전략 라이브러리에서 선택하세요. BB Squeeze, 모멘텀, 평균회귀 — 또는 나만의 전략으로.",
  "system.step2": "시뮬레이션",
  "system.step2_desc":
    "570개 이상의 코인, 2년 이상의 데이터로 실행. 수수료, 슬리피지, 드로다운 포함. 빈틈 없이.",
  "system.step3": "검증",
  "system.step3_desc":
    "전체 그림 확인: 승률, 최대 드로다운, 연속 손실, 수익 팩터. 그리고 판단하세요.",
  "system.engine_tag": "투명한 엔진",

  // Features section
  "features.tag": "도구",
  "features.title": "시뮬레이션에 필요한 모든 것",
  "features.card1_tag": "전략 시뮬레이터",
  "features.card1_title": "만들고 시뮬레이션하기",
  "features.card1_desc":
    "14개 지표, 노코드 빌더. 진입 조건, 손절, 익절 설정. 몇 초만에 시뮬레이션 실행.",
  "features.card2_tag": "전략 라이브러리",
  "features.card2_title": "검증된 전략들",
  "features.card2_desc":
    "570개 이상의 코인에서 5개 전략 백테스트. 검증된 것과 중단된 것 모두 결과 공개.",
  "features.card3_tag": "수수료 계산기",
  "features.card3_title": "비교하고 절약하기",
  "features.card3_desc": "거래소 수수료 비교. PRUVIQ 추천 링크로 할인 혜택.",

  // How it works
  "how.tag": "이렇게 작동합니다",
  "how.title": "3단계",
  "how.step1": "선택",
  "how.step1_desc": "36개 프리셋 또는 14개 지표로 직접 구성.",
  "how.step2": "시뮬레이션",
  "how.step2_desc": "SL, TP, 레버리지, 시간 필터. 실제 수수료 포함.",
  "how.step3": "검증",
  "how.step3_desc": "570+ 코인, 2년+ 데이터. 수 초 만에 결과 확인.",

  // CTA
  "cta.tag": "지금 시작",
  "cta.title": "검증할 준비 되셨나요?",
  "cta.desc1":
    "전략을 만들고, 백테스트를 돌리고, 결과를 확인하세요. 계정 불필요.",
  "cta.desc2": "$0 — 구독 없음, 이메일 불필요, 숨겨진 비용 없음.",
  "cta.button1": "시뮬레이터 열기 — 무료",
  "cta.button2": "커뮤니티 참여",
  "cta.button3": "수수료 절약하기",
  "cta.disclaimer":
    "투자 조언이 아닙니다. 암호화폐 트레이딩은 상당한 손실 위험을 수반합니다. 과거 성과는 미래 결과를 보장하지 않습니다. PRUVIQ는 교육 및 연구 프로젝트입니다.",

  // Footer
  "footer.tagline": "검증하고. 실행하고. 수익내고.",
  "footer.strategies": "전략",
  "footer.learn": "학습",
  "footer.fees": "수수료 절약",
  "footer.telegram": "텔레그램",
  "footer.changelog": "변경 이력",
  "footer.privacy": "개인정보처리방침",
  "footer.terms": "이용약관",
  "footer.disclaimer":
    "투자 조언이 아닙니다. 레버리지 사용 시 원금 전액 손실 가능성을 포함한 상당한 손실 위험이 있습니다. 과거 성과는 미래 결과를 보장하지 않습니다. 거래 제한 국가 거주자에게는 제공되지 않습니다.",
  "footer.affiliate": "이 사이트에는 제휴 링크가 포함되어 있습니다.",
  "footer.details": "수수료 자세히 보기",
  "footer.legal_entity": "PRUVIQ 프로젝트 · contact@pruviq.com",
  "footer.legal_entity_notice":
    "독립 리서치 프로젝트. 금융 투자 자문업 등록 사업자가 아닙니다.",
  "cookie.notice":
    "이 사이트는 보안 목적의 필수 쿠키만 사용합니다. 추적 또는 광고 쿠키 없음.",
  "cookie.ok": "확인",

  // Strategies page
  "strategies.tag": "전략 라이브러리",
  "strategies.title": "모든 전략. 모든 결과.",
  "strategies.desc":
    "실패를 숨기지 않습니다. 테스트한 모든 전략이 완전한 백테스트 데이터, 실제 결과, 솔직한 분석과 함께 여기 문서화되어 있습니다.",
  "strategies.count":
    "총 {total}개 전략 문서화 — 실거래 데이터 기반, 결과 100% 공개.",
  "strategies.funnel":
    "88개 파라미터 조합 테스트 → {total}개 전략 완전 문서화 → 통과/탈락 포함 모든 결과 공개. 이것이 진짜 투명성입니다.",
  "strategies.more_tag": "더 많은 전략 예정",
  "strategies.more_desc":
    "새로운 접근법을 지속적으로 테스트합니다. 백테스트 검증이 완료되면 여기에 표시됩니다.",
  "strategies.join": "커뮤니티 참여",
  "strategies.back": "전략 라이브러리로 돌아가기",
  "strategies.explore": "모든 전략 탐색",
  "strategies.detail_demo_footer": "더 많은 검증된 전략을 탐색하세요.",
  "strategies.detail_nodemo_footer":
    "직접 파라미터를 조정하여 시뮬레이션해 보시겠습니까?",

  // Strategy labels
  "strategy.verified": "검증됨 — 모든 검증 통과",
  "strategy.testing": "테스트 중",
  "strategy.killed": "중단됨 — 수익성 기준 미달",
  "strategy.shelved": "검토 중 — 추가 테스트 필요",
  "strategy.beginner": "초급",
  "strategy.intermediate": "중급",
  "strategy.advanced": "고급",
  "strategy.mean_reversion": "평균 회귀",
  "strategy.momentum": "모멘텀",
  "strategy.breakout": "돌파",
  "strategy.volatility": "변동성",
  "strategy.hybrid": "하이브리드",
  "strategy.win_rate": "승률",
  "strategy.profit_factor": "수익 팩터",
  "strategy.total_pnl": "총 손익",
  "strategy.coins_tested": "테스트 코인",
  "strategy.max_drawdown": "최대 드로다운",
  "strategy.added": "추가일",
  "strategy.killed_date": "중단일",
  "strategy.trades_analyzed": "건 분석됨",
  "strategy.leverage_warning_title": "레버리지 위험",
  "strategy.leverage_warning":
    "모든 결과는 5배 레버리지로 시뮬레이션되었습니다. 최대 드로다운 26.7%는 5배 기준으로 실제 자본 손실은 포지션당 ~5.3%입니다. 높은 레버리지는 수익과 손실 모두를 증폭시킵니다. 감당할 수 없는 레버리지를 사용하지 마세요.",
  "strategy.research_warning":
    "연구 단계 — OOS 검증 미완료. 실거래 사용 비권장.",
  "strategy.verified_badge": "검증된 전략",
  "strategy.oos_label": "OOS 검증 완료",
  "strategy.wr_desc": "수익이 난 거래의 비율",
  "strategy.pf_desc": "총 수익 / 총 손실 비율",
  "strategy.pnl_desc": "모든 수수료와 손실 차감 후 순수익",
  "strategy.mdd_desc": "최고점에서 최저점까지 최대 하락폭",
  "strategies.beginner_tag": "암호화폐 트레이딩이 처음이신가요?",
  "strategies.beginner_desc":
    "전략을 탐색하기 전에 교육 가이드부터 시작하세요. 백테스팅 기초, 리스크 관리, 흔한 실수를 배우세요.",
  "strategies.beginner_cta": "학습 시작하기",
  "strategies.verified_explanation":
    "검증됨 = 570개+ 코인, 2년+ 데이터에서 모든 검증 통과",
  "strategies.simulate_button": "시뮬레이션",
  "strategies.fees_cta": "거래소 수수료 비교",
  "strategies.performance_cta": "백테스트 결과 보기",

  // Strategies: Simulator Presets section
  "strategies.presets_title": "시뮬레이터 프리셋 전체 ({count}종)",
  "strategies.presets_desc":
    "아래 전략을 클릭하면 시뮬레이터에서 바로 파라미터가 적용됩니다. 570개 코인 동시 테스트.",
  "strategies.todays_pick": "오늘의 추천",
  "strategies.click_to_simulate": "클릭하여 시뮬레이션",

  // Blog
  "blog.tag": "트레이딩 IQ",
  "blog.title": "트레이딩 IQ를 높이세요.",
  "blog.desc":
    "무엇이 되고 안 되는지 확인하세요. 570개 코인, 88개 파라미터 조합에서 얻은 백테스팅 방법론, 리스크 관리, 교훈.",
  "blog.coming_soon": "최신 인사이트",
  "blog.coming_desc":
    "시장 분석, 퀀트 교육, 전략 시뮬레이션 업데이트를 확인하세요.",
  "blog.coming_cta": "지금 기사 보기",
  "blog.coming_cta2": "또는 커뮤니티에 참여해 업데이트를 확인하세요.",
  "blog.back": "트레이딩 IQ로 돌아가기",
  "blog.category.market": "시장 분석",
  "blog.category.quant": "퀀트 개념",
  "blog.category.strategy": "전략 업데이트",
  "blog.category.weekly": "주간 리뷰",
  "blog.category.education": "교육",
  "blog.category.autopsy": "전략 부검",
  "blog.min_read": "분 소요",
  "blog.share": "공유하기",
  "blog.copy_link": "링크 복사",
  "blog.copied": "복사됨!",
  "blog.contents": "목차",
  "blog.related": "관련 글",
  "blog.en_badge": "EN",

  // Demo
  "demo.tag": "인터랙티브 시뮬레이션",
  "demo.title": "직접 체험하기",
  "demo.desc":
    "손절과 익절을 조정하여 성과 변화를 확인하세요. {coins}개 코인, {range} 데이터, 수수료 포함 시뮬레이션.",
  "demo.sl": "손절",
  "demo.tp": "익절 (TP)",
  "demo.chart_title": "누적 수익률 (%)",
  "demo.loading": "시뮬레이션 데이터 로딩 중...",
  "demo.error": "데모 데이터 로딩 실패.",
  "demo.no_data": "이 조합에 대한 데이터가 없습니다.",
  "demo.disclaimer":
    "* 기본 파라미터 (SL=10%, TP=8%)는 현재 검증된 라이브 설정입니다. 시뮬레이션은 0.04% 선물 수수료 + 0.02% 슬리피지를 포함합니다. 과거 성과는 미래 결과를 보장하지 않습니다.",
  "demo.live_badge": "현재 라이브 설정",
  "demo.total_return": "총 수익률",
  "demo.trades_simulated": "건 시뮬레이션됨",
  "demo.interactive_tag": "인터랙티브 데모",
  "demo.hero_title": "직접 확인하세요",
  "demo.hero_desc":
    "아래 손절/익절 슬라이더를 조정하여 전략 성과가 어떻게 변하는지 확인하세요. 570개+ 코인에 대한 실제 백테스트 결과이며, 수수료가 포함되어 있습니다.",
  "demo.want_more": "더 세밀한 제어가 필요하신가요?",
  "demo.want_more_desc":
    "전체 시뮬레이터에서는 20개+ 지표로 커스텀 전략을 만들고, 원하는 코인을 선택하여 테스트하고, OOS 검증까지 할 수 있습니다.",
  "demo.open_simulator": "전체 시뮬레이터 열기",
  "demo.view_strategies": "전략 목록 보기",
  "demo.fees_cta": "거래소 수수료 비교",

  // Fees page
  "fees.tag": "거래소 수수료",
  "fees.title1": "수수료 비교.",
  "fees.title2": "매 거래마다 절약.",
  "fees.desc":
    "현물 & 선물 수수료 한눈에. PRUVIQ 추천 링크로 바이낸스 가입 시 최대 19% 할인.",
  "fees.disclosure":
    "제휴 공개: PRUVIQ는 추천 링크로 가입 시 거래소로부터 수수료를 받습니다. 회원의 수수료 할인에는 영향이 없습니다.",
  "fees.ctaSimulate": "무료 시뮬레이션 시작",
  "fees.compare_title": "거래소 비교",
  "fees.compare_desc":
    "기본 등급 (VIP 0). 추천 할인은 VIP 등급 할인 위에 추가 적용됩니다.",
  "fees.card_binance_tag": "거래량 1위",
  "fees.card_binance_desc":
    "최대 유동성, 최저 슬리피지. PRUVIQ 시뮬레이션은 바이낸스 데이터 사용.",
  "fees.card_bitget_tag": "카피 트레이딩",
  "fees.card_bitget_desc":
    "카피 트레이딩 선두 플랫폼. 성공한 트레이더를 자동으로 따라하기.",
  "fees.card_okx_tag": "120개국 이상",
  "fees.card_okx_desc":
    "120개국 이상 이용 가능. 바이낸스 제한 지역에서 좋은 대안.",
  "fees.label_spot": "현물",
  "fees.label_futures": "선물",
  "fees.pruviq_discount": "PRUVIQ 할인",
  "fees.discount_off": "할인",
  "fees.signup": "가입하기",
  "fees.coming_soon": "제휴 링크 — 준비 중",
  "fees.visit_okx": "OKX 방문",
  "fees.okx_discount_pending": "20% 할인 코드 준비 중 — 제휴 승인 대기",
  "fees.footnote":
    "메이커 / 테이커 수수료 기준. 거래량이 높으면 자동으로 낮은 등급이 적용됩니다. 최종 업데이트: 2026년 2월.",
  "fees.korean_title": "국내 거래소 (참고용)",
  "fees.korean_desc":
    "비교 참고용입니다. 현물 거래만 지원하며 PRUVIQ 제휴 할인이 적용되지 않습니다.",
  "fees.card_upbit_tag": "국내 1위",
  "fees.card_upbit_desc":
    "국내 최대 거래량. 원화(KRW) 거래 지원. 현물 거래만 가능.",
  "fees.card_bithumb_tag": "국내 2위",
  "fees.card_bithumb_desc":
    "국내 2위 거래소. 원화(KRW) 거래 지원. 현물 거래만 가능.",
  "fees.visit": "사이트 방문",
  "fees.spot_only": "현물만",
  "fees.no_futures": "선물 미지원",
  "fees.faq_title": "자주 묻는 질문",
  "fees.faq1_q": "PRUVIQ가 수익을 얻나요?",
  "fees.faq1_a":
    "네. 거래소가 PRUVIQ에 수익의 일부를 지급합니다. 이것은 회원님의 주머니에서 나오지 않습니다 — 추천을 통한 수수료는 항상 더 낮습니다.",
  "fees.faq2_q": "현물과 선물의 차이는?",
  "fees.faq2_a":
    "현물 = 암호화폐를 직접 매매. 선물 = 레버리지를 이용한 계약 거래 (높은 위험, 거래 금액당 낮은 수수료).",
  "fees.faq3_q": "이미 계정이 있어도 할인 받을 수 있나요?",
  "fees.faq3_a":
    "추천 할인은 계정 생성 시 적용됩니다. 기존 계정은 소급 적용이 안 될 수 있습니다.",
  "fees.trust_tag": "레퍼럴 코드의 실체",
  "fees.trust_title": '"수수료 20% 할인!" — 근데 그 20%, 누가 받는 건데?',
  "fees.trust_desc":
    "인플루언서, 제휴 사이트, '특별 링크' — 전부 같은 말을 합니다. 큰 할인. 그들이 말 안 하는 것? 당신 몫을 0%로 설정하고 전부 가져갈 수 있다는 겁니다. 할인받았다고 생각하며 가입하지만, 실제로 돌아온 건 없습니다. 당신이 누군가의 수익이 된 겁니다. 그리고 한 번 가입하면, 절대 바꿀 수 없습니다.",
  "fees.trust_col_user": "실제 받는 것",
  "fees.trust_col_platform": "그들이 가져가는 것",
  "fees.trust_typical": '"내 코드로 20% 할인!"',
  "fees.trust_influencer": "실제 설정 가능한 값",
  "fees.trust_point1_title": '그들의 "할인"은 그들의 월급입니다',
  "fees.trust_point1_desc":
    "추천인은 커미션 전부를 가져가고 당신에게 0을 줄 수 있습니다. 유튜브 설명란의 '20% 할인'? 그들에게 20%, 당신에게 0%일 수 있습니다. 아무도 알려주지 않고, 알림도 오지 않습니다.",
  "fees.trust_point2_title": "PRUVIQ는 95%를 드립니다",
  "fees.trust_point2_desc":
    "저희는 1%만 가져갑니다. 현물 19%, 선물 9%는 회원님 몫. 관대한 게 아닙니다 — 저희 수익은 시뮬레이터지, 거래 수수료가 아니니까요. 직접 확인: 바이낸스 → 수수료 일정.",
  "fees.trust_point3_title": "잘못된 레퍼럴은 되돌릴 수 없습니다",
  "fees.trust_point3_desc":
    "레퍼럴 코드는 가입 시 영구 고정됩니다. 누군가의 '독점 링크'로 가입해서 0%를 받았다면? 방법이 없습니다. 고객센터도 안 됩니다. 리셋도 안 됩니다. 가입 전에 선택하세요.",

  // Referral Transparency - Block 1: Problem Hook
  "fees.referral.problem.headline": "당신은 아마 0%를 받고 있습니다.",
  "fees.referral.problem.subheading":
    "99%의 추천인 프로모터들은 이 사실을 말하지 않습니다.",
  "fees.referral.problem.body":
    '모든 인플루언서, 제휴 사이트, 무작위 유튜버가 바이낸스 추천 코드를 홍보할 때 당신에게 0% 수수료를 줄 수 있도록 법적으로 허용되어 있고, 대부분 그렇게 합니다. 그들은 "20% 캐시백"이라고 광고하면서 실제로는 당신에게 아무것도 주지 않습니다. 가입 순간 당신의 추천 코드는 고정됩니다. 절대 변경할 수 없습니다. 우리는 산업 표준이 이를 숨기기 때문에 우리의 코드를 공개합니다.',

  // Referral Transparency - Block 2: Education
  "fees.referral.how.headline": "광고와 현실의 차이를 보세요.",
  "fees.referral.how.body":
    "바이낸스는 모든 거래에서 수수료를 배분합니다. 추천인(코드를 홍보한 사람)이 그 배분을 결정합니다. 당신에게 아무것도 줄 의무가 없습니다. 대부분은 큰 할인을 주장한 후 100%를 자신이 챙깁니다.",
  "fees.referral.table.column.scenario": "광고 내용",
  "fees.referral.table.column.spotFees": "주장 (현물)",
  "fees.referral.table.column.futuresFees": "주장 (선물)",
  "fees.referral.table.column.yourActual": "실제 받는 것",
  "fees.referral.table.column.referrerKeeps": "프로모터가 챙기는 것",
  "fees.referral.table.row.typical": "전형적인 인플루언서 광고",
  "fees.referral.table.row.typical.claim": '"20% 캐시백"',
  "fees.referral.table.row.typical.claimFutures": '"10% 캐시백"',
  "fees.referral.table.row.typical.actual": "0% — 5% (운이 좋으면)",
  "fees.referral.table.row.typical.keeps": "15% — 20%",
  "fees.referral.table.row.worst": "최악의 경우 (흔함)",
  "fees.referral.table.row.worst.claim": '"20% 캐시백"',
  "fees.referral.table.row.worst.claimFutures": '"10% 캐시백"',
  "fees.referral.table.row.worst.actual": "0% (법적으로 허용됨)",
  "fees.referral.table.row.worst.keeps": "20% — 100%",
  "fees.referral.table.row.pruviq": "PRUVIQ (검증됨)",
  "fees.referral.table.row.pruviq.claim": "19% 캐시백",
  "fees.referral.table.row.pruviq.claimFutures": "9% 캐시백",
  "fees.referral.table.row.pruviq.actual": "19% (보장)",
  "fees.referral.table.row.pruviq.keeps": "1%",
  "fees.referral.how.locked":
    "당신의 추천 코드는 가입 시점에 고정되며 절대 변경할 수 없습니다.",
  "fees.referral.how.check":
    "바이낸스 계정에서 현재 배분을 확인할 수 있습니다 (계정 → 추천 프로그램 → 리베이트 상세).",

  // Referral Transparency - Block 3: Screenshot Proof
  "fees.referral.proof.headline": "이것이 우리의 설정입니다.",
  "fees.referral.proof.subheading":
    "바이낸스 대시보드에서 직접 검증되었습니다.",
  "fees.referral.proof.imageCaption":
    "PRUVIQ 바이낸스 추천 설정 - 현물 거래 수수료: 1% 추천인(PRUVIQ) / 19% 사용자. 선물 거래 수수료: 1% 추천인(PRUVIQ) / 9% 사용자.",
  "fees.referral.proof.timestamp":
    "스크린샷 검증일: 2026년 3월 21일. 설정은 분기별로 업데이트됩니다.",
  "fees.referral.proof.why":
    "1%만 가져가는 이유? 무료 플랫폼이니까요. 추천 수익에 의존하지 않습니다 — MLM이 아닙니다. 바이낸스가 지급하는 금액의 거의 전부가 회원님에게 돌아갑니다.",
  "fees.referral.proof.transparent":
    "이걸 공개하는 이유는 간단합니다. 다른 곳처럼 했다면 20% 할인을 내걸고 실제로는 0%를 줬을 겁니다. 그게 업계 관행이고, 저희는 그러지 않습니다.",

  // Referral Transparency - Block 4: How to Verify
  "fees.referral.verify.headline": "2분 안에 현재 추천 배분을 확인하세요.",
  "fees.referral.verify.body":
    "저희 말을 믿을 필요 없습니다. 지금 바이낸스 계정에서 직접 확인해 보세요:",
  "fees.referral.verify.step1.title": "1단계: 바이낸스에 로그인",
  "fees.referral.verify.step1.body":
    "바이낸스에 로그인 후, 오른쪽 상단의 계정 메뉴를 클릭하세요.",
  "fees.referral.verify.step2.title": "2단계: 추천 프로그램 찾기",
  "fees.referral.verify.step2.body":
    "드롭다운에서 '추천 프로그램' 또는 '내 추천'을 선택하세요.",
  "fees.referral.verify.step3.title": "3단계: 리베이트 상세 확인",
  "fees.referral.verify.step3.body":
    "'리베이트 상세' 또는 '수수료'를 클릭하면 현물/선물별 리베이트 %를 확인할 수 있습니다.",
  "fees.referral.verify.step4.title": "4단계: 비교하기",
  "fees.referral.verify.step4.body":
    "0%이거나 19%(현물) / 9%(선물)보다 낮다면 손해 보고 있는 겁니다. 그리고 변경 불가입니다.",
  "fees.referral.verify.cta": "대부분 0%입니다. 놀라지 마세요.",
  "fees.referral.verify.note":
    "추천 코드는 가입 시점에 영구 고정됩니다. 아무 링크로 가입했다면 리베이트 0%일 가능성이 높습니다.",

  // Referral Transparency - Block 5: FAQ
  "fees.referral.faq.headline": "추천 투명성 FAQ",
  "fees.referral.faq.q1": "PRUVIQ는 왜 1%만 챙기나요? 손해 보는 건 아닌가요?",
  "fees.referral.faq.a1":
    "아닙니다. PRUVIQ는 완전 무료 플랫폼입니다 — 구독료 없음, 유료 기능 없음, 잠긴 도구 없음. 바이낸스 추천 수익만으로 운영됩니다. 1%면 비용 충당과 확장에 충분합니다. 나머지 19%(선물 9%)는 회원님 몫입니다. 다른 추천인들이 20~100%를 챙기는 건 그들의 선택이고, 저희는 그러지 않습니다.",
  "fees.referral.faq.q2":
    "이 수수료 배분이 정말 영구적이라고요? 나중에 바꿀 수 없나요?",
  "fees.referral.faq.a2":
    "네, 영구적입니다. 추천 코드로 가입하는 순간, 수수료 배분이 계정에 영구 고정됩니다. 변경 불가, 코드 전환 불가, 협상 불가. 그래서 처음부터 제대로 선택하는 게 중요합니다. 대부분 너무 늦게 알게 됩니다.",
  "fees.referral.faq.q3":
    "이미 바이낸스 계정이 있습니다. PRUVIQ 코드를 사용할 수 있을까요?",
  "fees.referral.faq.a3":
    "안타깝게도 불가능합니다. 바이낸스 추천 코드는 신규 계정에서만 작동합니다. 이미 바이낸스 계정이 있다면 추천 코드가 이미 고정된 상태입니다. 하지만 PRUVIQ의 무료 백테스트 플랫폼은 그대로 이용 가능합니다 — 수수료 리베이트만 적용 안 될 뿐입니다. 참고로 바이낸스 설정에서 현재 배분을 확인해 보세요 — 0%일 가능성이 높습니다.",
  "fees.referral.faq.q4":
    "이 스크린샷이 진짜라는 걸 어떻게 알지요? 포토샵으로 조작한 건 아닐까요?",
  "fees.referral.faq.a4":
    "저희 말만 믿을 필요 없습니다. 2분만 투자해서 위의 단계대로 바이낸스 계정을 확인해 보세요. 실제 수수료 배분을 직접 보시고, 저희 것과 비교해 보세요. 맹목적 신뢰가 아니라 직접 검증을 요청드립니다 — 확인해 보시면 놀라실 겁니다.",
  "fees.referral.faq.q5": "PRUVIQ가 챙기는 1%는 어디에 쓰나요?",
  "fees.referral.faq.a5":
    "서버 비용, 플랫폼 개발, 백테스트 엔진 확장에 사용됩니다. 전액 제품에 재투자합니다. 광고비, 스폰서십, 인플루언서 홍보에는 일절 사용하지 않습니다 — 그건 본래 취지를 훼손하니까요. 모든 돈은 더 나은 플랫폼을 만드는 데 씁니다.",

  // Referral Transparency - Block 6: CTA
  "fees.referral.cta.primary":
    "PRUVIQ 코드로 가입하고 19% 캐시백(현물) / 9%(선물)을 받으세요",
  "fees.referral.cta.secondary": "또는 지금 바로 현재 배분을 확인하세요",
  "fees.referral.cta.button.signup": "추천 코드 받기",
  "fees.referral.cta.button.check": "바이낸스 계정 확인",
  "fees.referral.cta.footer":
    "신규 바이낸스 사용자: 당신은 코드에 영구적으로 고정됩니다. 신중하게 선택하세요.",
  "fees.referral.cta.footer.existing":
    "기존 바이낸스 사용자: 지금 설정을 확인하세요. 대부분 0%를 받고 있습니다.",

  // Referral Transparency - Callouts
  "fees.referral.callout.warning":
    "당신의 추천 코드는 가입 시점에 영구적으로 고정됩니다. 변경할 수 없습니다.",
  "fees.referral.callout.fact":
    "사실: 추천 프로모터의 89%는 20% 이상을 주장하면서 0% 수수료를 줍니다.",
  "fees.referral.callout.comparison":
    "PRUVIQ가 챙김 1% | 당신이 받는 19%(현물) | 바이낸스가 나머지",
  "fees.referral.callout.industry":
    "업계 표준: 프로모터 20% | 당신 0% | 당신은 알지 못함",

  "fees.affiliate_disclosure":
    "제휴 공개: PRUVIQ는 바이낸스 추천 링크로 가입 시 1% 커미션을 받습니다. 회원의 수수료 할인(현물 19%, 선물 9%)에는 영향이 없습니다. 투자 조언이 아닙니다. 암호화폐 거래는 상당한 손실 위험을 수반합니다.",

  // Changelog
  "changelog.tag": "변경 이력",
  "changelog.title": "전체 히스토리.",
  "changelog.desc":
    "모든 버전. 모든 변경. 모든 이유. 시스템이 처음부터 어떻게 발전했는지 보여드립니다.",
  "changelog.why_title": "왜 변경 이력을 공개하나요?",
  "changelog.why_desc":
    '\"버전 2.0\"은 맥락 없이는 의미가 없습니다. 모든 변경에는 이유가 있고, 모든 이유에는 데이터가 있습니다. 이것이 투명한 시스템 개발의 모습입니다.',

  // Coins
  "coins.tag": "코인 탐색기",
  "coins.title": "전체 코인 탐색",
  "coins.desc":
    "570개 이상 암호화폐의 실시간 시장 데이터. 가격, 시가총액, 거래량, 7일 차트 — 15분마다 갱신.",
  "coins.search": "코인 검색...",
  "coins.apply": "전략 적용",
  "coins.resim": "재시뮬레이션",
  "coins.trades": "거래 내역",
  "coins.no_trades": "전략을 적용하면 결과를 볼 수 있습니다",
  "coins.back": "코인",
  "coins.bb_bands": "BB 밴드",
  "coins.ema": "EMA",
  "coins.col_coin": "코인",
  "coins.col_price": "가격",
  "coins.col_change": "24h %",
  "coins.col_volume": "거래량",
  "coins.col_trades": "거래 수",
  "coins.col_wr": "승률",
  "coins.col_pf": "PF",
  "coins.col_return": "수익률",
  "coins.col_entry": "진입",
  "coins.col_exit": "청산",
  "coins.col_result": "결과",
  "coins.col_pnl": "PnL",
  "coins.col_bars": "봉",

  // Market
  "market.tag": "시장 현황",
  "market.title": "시장 대시보드",
  "market.desc":
    "실시간 암호화폐 시장 데이터. 공포/탐욕 지수, 상승/하락 순위, 경제 캘린더, 주요 뉴스를 한눈에 확인하세요.",
  "market.context_tip":
    "관심 가는 움직임이 있나요? 전략이 어떻게 작동할지 테스트해 보세요.",
  "market.context_cta": "시뮬레이터 열기",
  "market.fear_greed": "공포/탐욕 지수",
  "market.total_mcap": "총 시가총액",
  "market.btc_dom": "BTC 도미넌스",
  "market.volume_24h": "24시간 거래량",
  "market.top_gainers": "상승 TOP 10",
  "market.top_losers": "하락 TOP 10",
  "market.latest_news": "최신 뉴스",
  "market.noscript_title": "시장 개요",
  "market.noscript_desc":
    "실시간 시장 데이터(BTC 도미넌스, 공포·탐욕 지수, 펀딩률, 상승/하락 TOP)는 JavaScript가 필요합니다.",
  "market.noscript_alt":
    "개별 코인 데이터를 탐색하거나 전략 시뮬레이션을 실행하세요 — 정적 페이지는 JavaScript 없이도 이용 가능합니다.",
  "market.loading": "시장 데이터 로딩 중...",
  "market.error": "시장 데이터 로딩 실패.",
  "market.news_loading": "뉴스 로딩 중...",
  "market.news_error": "뉴스 로딩 실패.",
  "market.updated": "업데이트",
  "market.disclaimer":
    "시장 데이터는 정보 제공 목적으로만 제공됩니다. 투자 조언이 아닙니다. 데이터는 15분마다 갱신됩니다.",

  // Meta
  "meta.market_title": "시장 대시보드 - 프루빅(PRUVIQ)",
  "meta.market_desc":
    "실시간 암호화폐 시장 현황. 공포/탐욕 지수, BTC 도미넌스, 상승/하락 순위, 경제 캘린더, 주요 뉴스.",
  "meta.coins_title": "코인 탐색기 - 프루빅(PRUVIQ)",
  "meta.coins_desc":
    "프루빅(PRUVIQ)의 실시간 암호화폐 시장 데이터. 570개 이상 코인의 가격, 시가총액, 거래량, 7일 차트를 확인하세요. 15분마다 갱신됩니다.",
  "meta.home_title":
    "PRUVIQ \u2014 무료 암호화폐 전략 백테스터 | 570+ 코인, 가입 불필요",
  "meta.home_desc":
    "570개 이상의 코인에서 2년+ 데이터로 무료 백테스트. 수수료, 슬리피지 모델링, 실패 포함 전체 결과 공개. 가입 불필요.",
  "meta.simulate_title":
    "전략 시뮬레이터 \u2014 커스텀 전략 빌드 & 백테스트 | PRUVIQ",
  "meta.simulate_desc":
    "14개 지표로 커스텀 전략을 만들고 570+ 코인에서 백테스트. 코딩 불필요. 무료, 즉시 결과.",
  "meta.index_desc":
    "프루빅(PRUVIQ) — 무료 크립토 전략 백테스팅. 570개 이상 코인과 2년 이상의 실제 데이터로 전략을 검증하고, 실패 사례까지 투명하게 공개합니다.",
  "meta.strategies_title": "전략 라이브러리 - 프루빅(PRUVIQ)",
  "meta.strategies_desc":
    "테스트한 모든 전략의 전체 시뮬레이션 결과 — 검증된 것, 중단된 것, 그 사이의 모든 것. 체리피킹 없음.",
  "meta.blog_title": "트레이딩 IQ - PRUVIQ",
  "meta.blog_desc":
    "트레이딩 IQ를 높이세요. 백테스팅, 리스크 관리, 알고리즘 전략, 실제 트레이딩의 교훈.",
  "meta.demo_title": "PRUVIQ 데모 — 인터랙티브 전략 시뮬레이터",
  "meta.demo_desc":
    "PRUVIQ 전략 시뮬레이터를 즉시 체험하세요. 손절/익절을 조정하여 570개+ 코인에 대한 실제 백테스트 결과를 확인하세요.",
  "meta.fees_title": "거래소 수수료 비교 - PRUVIQ",
  "meta.fees_desc":
    "바이낸스 거래소 수수료 비교. PRUVIQ 추천 링크로 10% 절약. 투명한 수수료 비교.",
  "meta.changelog_title": "변경 이력 - PRUVIQ",
  "meta.changelog_desc":
    "PRUVIQ 트레이딩 시스템의 전체 버전 히스토리. 모든 변경, 모든 이유, 모든 날짜.",
  "meta.performance_title": "백테스트 성과 - PRUVIQ",
  "meta.performance_desc":
    "BB Squeeze SHORT 전략 백테스트 결과. 570개 코인, 2년 이상 데이터, 2,898건 거래. 실패 포함 전체 공개.",
  "meta.about_title": "소개 - PRUVIQ",
  "meta.about_desc":
    "PRUVIQ 프로젝트를 만나보세요. 우리의 미션: 크립토 전략 검증을 누구나 할 수 있게. 과대광고 없이. 데이터만.",

  // About page
  "about.tag": "PRUVIQ 소개",
  "about.title": "트레이더가 만든, 트레이더를 위한.",
  "about.mission":
    "PRUVIQ는 거짓말하는 백테스트, 체리피킹하는 전략, 손실을 보여주지 않는 인플루언서에 질렸기 때문에 탄생했습니다. 실패를 포함한 모든 결과를 공개하는 플랫폼을 만들었습니다. 실제 자금을 투입하기 전에 검증할 수 있도록.",
  "about.team_tag": "PRUVIQ 프로젝트",
  "about.team_desc":
    "PRUVIQ는 독립적인 트레이딩 리서치 프로젝트입니다. 과장 없이, 신호 없이, 약속 없이. 이 사이트에 공개되는 모든 전략은 실제 수수료와 슬리피지를 반영한 과거 데이터로 먼저 검증됩니다.",
  "about.team_stat1_label": "백테스트 전략",
  "about.team_stat1_val": "88+",
  "about.team_stat2_label": "커버 코인",
  "about.team_stat2_val": "570",
  "about.team_stat3_label": "시뮬레이터 실행 수",
  "about.team_stat3_val": "100만+",
  "about.philosophy_tag": "우리의 철학",
  "about.philosophy_title": "증명하거나, 제거하거나.",
  "about.philosophy1_title": "모든 것을 공개",
  "about.philosophy1_desc":
    "모든 전략 결과, 모든 거래, 모든 실패. 보여줄 수 없으면 주장하지 않습니다.",
  "about.philosophy2_title": "직감보다 데이터",
  "about.philosophy2_desc":
    "6명의 전문가가 BTC 필터를 추천했습니다. 백테스트가 틀렸음을 증명했습니다. 의견이 아닌 숫자를 믿습니다.",
  "about.philosophy3_title": "직접 검증, 직접 사용",
  "about.philosophy3_desc":
    "모든 전략은 570개 이상의 코인에서 2년 이상의 데이터로 백테스트한 후 공개합니다. 근거 없이 권하지 않습니다.",
  "about.philosophy4_title": "비용 제로, 조건 제로",
  "about.philosophy4_desc":
    "전략 검증은 누구나 접근할 수 있어야 합니다. 핵심 기능은 항상 무료. 거래소 제휴를 통해서만 수익을 창출합니다.",
  "about.stack_tag": "기술 스택",
  "about.stack_desc":
    "Python 백테스팅 엔진, Astro 정적 사이트, Cloudflare 엣지 배포, Binance Futures API. 독점 블랙박스 없음.",
  "about.contact_tag": "연락하기",
  "about.contact_desc": "질문, 피드백, 파트너십 문의:",
  "about.contact_email": "contact@pruviq.com",
  "about.contact_telegram": "텔레그램 커뮤니티",
  "about.explore_desc":
    "전략을 테스트할 준비가 되셨나요? 시뮬레이터를 사용하거나 검증된 전략을 둘러보세요.",

  "about.roadmap_tag": "다음 단계",
  "about.roadmap_title": "로드맵",
  "about.roadmap_desc": "PRUVIQ는 활발히 개발 중입니다. 현재 작업 중인 내용:",
  "about.roadmap_done1": "36개 프리셋 전략 시뮬레이터",
  "about.roadmap_done2": "570+ 코인 백테스팅 엔진",
  "about.roadmap_done3": "29개 교육 가이드 (영어 + 한국어)",
  "about.roadmap_done4": "일일 전략 랭킹",
  "about.roadmap_next1": "더 많은 전략 유형과 지표",
  "about.roadmap_next2": "포트폴리오 레벨 백테스팅",
  "about.roadmap_next3": "커뮤니티 전략 공유",
  "about.roadmap_label_done": "완료",
  "about.roadmap_label_next": "진행 중",

  "about.proof_tag": "공개 개발",
  "about.proof_desc":
    "PRUVIQ는 지속적으로 개발 중입니다. 시뮬레이션 엔진, API, 전략 로직은 실제 백테스트 데이터를 바탕으로 꾸준히 업데이트됩니다.",
  "about.proof_github": "검증 가능한 데이터",
  "about.proof_commits": "활발한 개발 진행 중",
  "about.proof_since": "2025년부터 개발 중",

  // About - Founder section
  "about.solo_tag": "창업자",
  "about.solo_headline": "시스템 트레이더이자 퀀트 리서처가 설립했습니다.",
  "about.solo_background":
    "2021년부터 알고리즘 트레이딩, 퀀트 리서치, 크립토 시장 연구.",
  "about.solo_why":
    "PRUVIQ를 만든 이유: 백테스트에서 검증된 전략이 실전에서 실패하는 경험을 직접 겪었고, 기존 툴들이 실패를 숨긴다는 것을 깨달았습니다. 그래서 투명한 시뮬레이션 플랫폼을 설계했습니다.",

  // About - Numbers at a Glance
  "about.numbers_tag": "한눈에 보는 숫자",
  "about.numbers_title": "플랫폼 현황",
  "about.num_coins": "분석 코인",
  "about.num_presets": "전략 프리셋",
  "about.num_presets_val": "36+",
  "about.num_data": "데이터 포인트",
  "about.num_data_val": "2년+",
  "about.num_sims": "시뮬레이션 실행 수",

  // About - Methodology Highlight
  "about.method_tag": "방법론",
  "about.method_title": "전략 검증 방법",
  "about.method_desc":
    "PRUVIQ의 모든 전략은 공개 전 엄격한 백테스팅 파이프라인을 거칩니다. 체리피킹 없이 투명한 데이터만 제공합니다.",
  "about.method1_title": "히스토리컬 백테스팅",
  "about.method1_desc":
    "500+ 코인의 2년 이상 실제 시장 데이터로 전략을 검증합니다. 현실적인 수수료 모델링 포함.",
  "about.method2_title": "워크포워드 검증",
  "about.method2_desc":
    "과적합을 감지하기 위한 표본 외 테스트. 과거 데이터에서만 작동하는 전략은 제거합니다.",
  "about.method3_title": "완전 무료",
  "about.method3_desc":
    "모든 시뮬레이션은 무료입니다. 거래소 레퍼럴 파트너십으로 플랫폼을 운영합니다 — 숨겨진 비용 없음.",
  "about.method_cta": "전체 방법론 보기",

  // About - Partners
  "about.partners_tag": "공식 파트너",
  "about.partners_desc":
    "PRUVIQ는 주요 거래소와 파트너십을 통해 수수료 할인을 제공합니다. 이 파트너십으로 플랫폼을 운영하며, 모든 기능은 무료로 유지됩니다.",
  "about.partners_okx": "OKX — 수수료 할인",
  "about.partners_binance": "바이낸스 — 수수료 할인",
  "about.partners_detail": "수수료 비교 보기 →",

  // Home hero stat labels
  "home.stat_coins": "테스트 코인",
  "home.stat_trades": "백테스트 거래",
  "home.stat_datapoints": "데이터 포인트",
  "home.stat_free": "$0 항상",

  // Performance page static fallback
  "perf.tag": "백테스트 결과",
  "perf.archived_badge": "보관됨",
  "perf.archived_notice":
    "2026년 3월 실거래 중단. 아래 데이터는 2024년 1월 – 2026년 2월 백테스트 결과입니다.",
  "perf.title": "모든 거래 공개. 손실 포함.",
  "perf.desc":
    "BB Squeeze SHORT 전략 백테스트 결과. 570개 코인, 2년 이상 과거 데이터. 체리피킹 없음.",
  "perf.loading": "백테스트 성과 데이터 로딩 중...",
  "perf.stat1_label": "전략",
  "perf.stat1_val": "BB Squeeze SHORT",
  "perf.stat2_label": "코인",
  "perf.stat2_val": "570개",
  "perf.stat3_label": "레버리지",
  "perf.stat3_val": "5배",
  "perf.stat4_label": "데이터 소스",
  "perf.stat4_val": "백테스트 (2년+)",
  "perf.updated_label": "최종 업데이트",
  "perf.updated_val": "2026년 2월 28일",
  "perf.period_label": "기간",
  "perf.period_val": "2024년 1월 — 2026년 2월",
  "perf.note":
    "성과 데이터는 2년 이상의 과거 데이터를 사용한 백테스트에서 수집되며, 수수료와 슬리피지를 포함합니다. 대시보드가 로딩되지 않으면 JavaScript를 활성화하거나 새로고침해 주세요.",
  "perf.results_title": "백테스트 결과",
  "perf.results_desc":
    "2년+, 570개 코인, 2,898건 거래. 0.08%/side 수수료 포함.",
  "perf.gap_title": "백테스트 vs 현실",
  "perf.gap_desc":
    "모든 백테스트에는 실거래와의 괴리가 있습니다. 직접 경험했고 — 한계를 초과했을 때 즉시 중단했습니다.",
  "perf.gap_backtest": "백테스트 (2년, 570개 코인)",
  "perf.gap_live": "실거래 (52일)",
  "perf.gap_pnl_label": "총 손익",
  "perf.gap_mdd_label": "최대 낙폭",
  "perf.gap_status_label": "상태",
  "perf.gap_status_stopped": "MDD 한도 도달로 중단",
  "perf.gap_why_title": "왜 괴리가 발생하나?",
  "perf.gap_why1":
    "시장 충격: 실제 주문은 가격을 움직이지만, 백테스트는 그렇지 않음",
  "perf.gap_why2":
    "체결 시간: 백테스트는 즉시 체결을 가정하지만, 실제로는 지연 발생",
  "perf.gap_why3":
    "시장 체제 변화: 2024-2025 데이터가 2026 상황을 예측하지 못함",
  "perf.gap_why4": "샘플 크기: 52일 실거래 vs 2년+ 백테스트",
  "perf.gap_action_title": "어떻게 대응했나",
  "perf.gap_action_desc":
    "MDD 20% 하드 스톱을 적용했습니다. 실거래에서 이 한계에 도달하자 전략을 즉시 중단했습니다 — 예외 없이. 모든 트레이더에게 동일한 규율을 권장합니다.",
  "perf.gap_lesson":
    "수익성 있는 백테스트는 필요조건이지 충분조건이 아닙니다. 항상 표본외 검증과 엄격한 리스크 한도로 확인하세요.",
  "perf.killed_title": "기각된 전략",
  "perf.killed_desc":
    "테스트 후 기각한 전략들입니다. 실패도 성공만큼 중요하기에 공개합니다.",
  "perf.equity_title": "실거래 손익 곡선",
  "perf.equity_desc":
    "실거래 누적 PnL (2026년 1월 13일 – 3월 9일). MDD가 20% 리스크 한도를 초과하여 전략이 중단되었습니다.",
  "perf.download_json": "JSON 다운로드",
  "perf.download_csv": "CSV 다운로드",
  "perf.verify_title": "직접 확인하세요",
  "perf.verify_desc":
    "저희를 믿지 마세요. 시뮬레이터에서 SL/TP를 조정하여 결과가 실시간으로 변하는 것을 직접 확인하세요.",
  "perf.verify_cta": "전략 시뮬레이터 열기",
  "perf.methodology_cta": "검증 방법론 보기",
  "perf.strategies_cta": "전체 전략 보기",
  "perf.fees_cta": "거래소 수수료 비교",
  "perf.metric_good": "양호",
  "perf.metric_excellent": "우수",
  "perf.metric_low_risk": "저위험",
  "perf.killed_bb_long":
    "SHORT 전략을 LONG에 그대로 적용. 암호화폐 시장의 구조적 비대칭으로 실패.",
  "perf.killed_bb_long_result": "승률 31.4% \u00b7 PF 0.41 \u00b7 -$2,847",
  "perf.killed_momentum":
    "20봉 고점 돌파 + 거래량 확인. 모든 시장 상황에서 치명적 손실.",
  "perf.killed_momentum_result": "승률 28.1% \u00b7 PF 0.35 \u00b7 -$4,102",
  "perf.killed_all_long":
    "88개 LONG 전략 조합을 전체 지표로 테스트. OOS 검증을 통과한 전략 없음.",
  "perf.killed_all_long_result": "0/88 생존 \u00b7 평균 PF 0.67",
  "perf.killed_btc_regime":
    "BTC 추세에 따라 거래 필터링. 위험 조정 수익률 개선 없이 복잡성만 증가.",
  "perf.killed_btc_regime_result": "PF 2.18 vs 기준 2.22 \u00b7 거래 -12%",

  // Performance: Metrics table labels
  "perf.tbl_header_metric": "지표",
  "perf.tbl_header_value": "값",
  "perf.tbl_sl": "손절 (SL)",
  "perf.tbl_tp": "익절 (TP)",
  "perf.tbl_hold": "최대 보유 시간",
  "perf.tbl_hold_val": "48시간",
  "perf.tbl_sl_rate": "SL 비율",
  "perf.tbl_tp_rate": "TP 비율",
  "perf.tbl_timeout": "타임아웃 비율",
  "perf.tbl_mdd": "최대 손실폭 (MDD)",
  "perf.tbl_breakeven": "손익분기 승률",
  "perf.tbl_safety": "안전 마진",

  // Daily Ranking page
  "ranking.tag": "데일리 랭킹",
  "ranking.title": "오늘의 전략 랭킹",
  "ranking.date_label": "{date} 기준 · PRUVIQ 시뮬레이터 백테스트 결과",
  "ranking.desc":
    "시가총액 상위 50개 코인 기준(스테이블코인 제외), 수익팩터(PF) 기준으로 오늘 가장 성과가 좋은 전략과 나쁜 전략을 확인하세요. 샘플 수가 100건 미만인 전략은 통계적 신뢰도가 낮습니다.",
  "ranking.open_sim": "시뮬레이터 열기",
  "ranking.strategy_lib": "전략 라이브러리",
  "ranking.leaderboard": "리더보드",
  "ranking.disclaimer_note": "참고:",
  "ranking.disclaimer_text":
    "이 랭킹은 과거 데이터 백테스트 기반입니다. 미래 수익을 보장하지 않으며, 샘플 수 부족(< 100건) 전략은 과적합 가능성이 높습니다.",
  "ranking.footer_text":
    "마음에 드는 전략을 시뮬레이터에서 직접 파라미터 조정해보세요.",
  "ranking.try_sim": "시뮬레이터에서 직접 확인",
  "ranking.live_perf": "실거래 성과",
  "ranking.noscript_title": "랭킹을 표시하려면 JavaScript가 필요합니다.",
  "ranking.noscript_desc":
    "랭킹은 매일 업데이트되며 JavaScript가 필요합니다. 브라우저에서 JavaScript를 활성화하세요.",
  "compare.noscript_text":
    "전략 비교 도구를 사용하려면 JavaScript가 필요합니다.",
  "compare.noscript_title": "전략 비교",
  "compare.noscript_desc":
    "BB Squeeze SHORT, BB Squeeze LONG, RSI Reversal, MACD Momentum 등 5개 백테스트된 전략을 50개 코인에서 동일 조건으로 비교합니다. SL/TP 파라미터를 조정하고 승률, 수익 팩터, 최대 드로다운, 수익률을 나란히 확인하세요.",
  "compare.noscript_strategies":
    "제공 전략: BB Squeeze SHORT (검증 완료, 실거래 중), BB Squeeze LONG, RSI Reversal LONG, MACD Momentum LONG, ATR Breakout LONG. 모두 0.04% 수수료 + 0.02% 슬리피지, 2년 이상 데이터로 시뮬레이션.",

  // Blog article CTA
  "blog.cta_title": "직접 전략을 테스트해 보시겠습니까?",
  "blog.cta_desc":
    "570개 코인, 2년 이상의 데이터로 트레이딩 전략을 시뮬레이션하세요. 무료.",
  "blog.cta_button": "라이브 데모 체험",
  "blog.cta_fees": "수수료 절약하기",
  "blog.cta_community": "커뮤니티 참여",
  "blog.learn_cta": "학습 시작하기",
  "blog.strategies_cta": "전략 탐색하기",
  "blog.simulate_cta": "시뮬레이터 열기",

  // Compare page
  "compare.tag": "전략 비교",
  "compare.title": "모든 전략 비교",
  "compare.desc":
    "동일한 조건, 동일한 데이터. 어떤 전략이 나에게 맞는지 확인하세요. SL/TP를 조정하면 5개 전략이 실시간으로 변합니다.",
  "compare.disclaimer":
    "* 모든 전략은 50개 코인, 동일한 수수료(0.04% + 0.02% 슬리피지)로 시뮬레이션됩니다. 과거 성과는 미래 결과를 보장하지 않습니다.",
  "compare.loading": "비교 데이터 로딩 중...",
  "compare.error": "비교 데이터 로딩 실패.",
  "compare.name": "전략",
  "compare.direction": "방향",
  "compare.status": "상태",
  "compare.trades": "거래 수",
  "compare.no_data": "데이터 없음",
  "compare.back": "전략 라이브러리로 돌아가기",
  "compare.view": "자세히 보기",
  "meta.compare_title": "전략 비교 - PRUVIQ",
  "meta.compare_desc":
    "5개 트레이딩 전략을 나란히 비교하세요. 동일 조건, 동일 데이터. SL/TP를 조정하고 승률, 수익 팩터, 드로다운을 한눈에 확인.",
  "strategies.compare": "전체 비교",

  // Footer
  "footer.about": "소개",
  "footer.col_product": "서비스",
  "footer.col_resources": "리소스",
  "footer.col_compare": "비교",
  "footer.col_legal": "법적 고지",

  // Builder
  "meta.builder_title": "전략 빌더 - PRUVIQ",
  "meta.builder_desc":
    "코드 없이 나만의 트레이딩 전략을 설계하세요. 지표 선택, 조건 설정, 570+ 코인 2년+ 실제 데이터로 백테스트.",

  // Learn page
  "meta.learn_title": "학습 — 크립토 트레이딩 교육 | PRUVIQ",
  "meta.learn_desc":
    "초급부터 고급까지 무료 크립토 트레이딩 교육. 지표, 백테스팅, 리스크 관리, 퀀트 트레이딩을 실제 데이터로 배우세요.",
  "learn.tag": "교육",
  "learn.title": "트레이딩을 배우세요.",
  "learn.title2": "과대광고 없이. 실제 데이터로.",
  "learn.desc":
    "레벨별로 정리된 {count}개 가이드. 모든 주장은 데이터로 뒷받침됩니다. 유료 강의도, 업셀링도 없습니다 — 명확한 설명만 있습니다.",
  "learn.level_beginner": "초급",
  "learn.level_beginner_title": "여기서 시작하세요",
  "learn.level_beginner_desc":
    "크립토 트레이딩이 처음이신가요? 기본 개념부터 배워보세요.",
  "learn.level_intermediate": "중급",
  "learn.level_intermediate_title": "지표 & 전술",
  "learn.level_intermediate_desc":
    "트레이딩 도구의 원리와 실전 활용법을 익히세요.",
  "learn.level_advanced": "고급",
  "learn.level_advanced_title": "퀀트 & 전략",
  "learn.level_advanced_desc": "백테스팅, 포지션 사이징, 실제 의사결정 과정.",
  "learn.min_read": "분 소요",
  "learn.cta_title": "배운 것을 테스트할 준비가 되셨나요?",
  "learn.cta_desc":
    "전략을 만들고 570개 이상의 코인에서 실행하세요 — 무료, 계정 불필요.",
  "learn.cta_button": "시뮬레이터 열기",

  // Learn page tag translations
  "learn.tag_beginners": "입문",
  "learn.tag_futures": "선물",
  "learn.tag_leverage": "레버리지",
  "learn.tag_perpetual_contracts": "무기한계약",
  "learn.tag_bollinger_bands": "볼린저밴드",
  "learn.tag_squeeze": "스퀴즈",
  "learn.tag_volatility": "변동성",
  "learn.tag_risk_management": "리스크관리",
  "learn.tag_position_sizing": "포지션사이징",
  "learn.tag_stop_loss": "손절",
  "learn.tag_take_profit": "익절",
  "learn.tag_backtesting": "백테스트",
  "learn.tag_overfitting": "과적합",
  "learn.tag_look_ahead_bias": "미래편향",
  "learn.tag_rsi": "RSI",
  "learn.tag_ema": "EMA",
  "learn.tag_macd": "MACD",
  "learn.tag_atr": "ATR",
  "learn.tag_vwap": "VWAP",
  "learn.tag_adx": "ADX",
  "learn.tag_indicators": "지표",
  "learn.tag_momentum": "모멘텀",
  "learn.tag_oversold": "과매도",
  "learn.tag_overbought": "과매수",
  "learn.tag_mean_reversion": "평균회귀",
  "learn.tag_crossover": "크로스오버",
  "learn.tag_moving_average": "이동평균",
  "learn.tag_trend_following": "추세추종",
  "learn.tag_divergence": "다이버전스",
  "learn.tag_volume": "거래량",
  "learn.tag_confirmation": "확인",
  "learn.tag_fakeouts": "페이크아웃",
  "learn.tag_stochastic": "스토캐스틱",
  "learn.tag_trend_strength": "추세강도",
  "learn.tag_risk_reward": "손익비",
  "learn.tag_optimization": "최적화",
  "learn.tag_fees": "수수료",
  "learn.tag_exchanges": "거래소",
  "learn.tag_cost_optimization": "비용최적화",
  "learn.tag_binance": "바이낸스",
  "learn.tag_referral": "레퍼럴",
  "learn.tag_ichimoku": "일목균형표",
  "learn.tag_cloud": "구름",
  "learn.tag_trend": "추세",
  "learn.tag_support_resistance": "지지/저항",
  "learn.tag_support": "지지",
  "learn.tag_resistance": "저항",
  "learn.tag_fibonacci": "피보나치",
  "learn.tag_retracement": "되돌림",
  "learn.tag_technical_analysis": "기술적분석",
  "learn.tag_price_action": "가격행동",
  "learn.tag_candlestick": "캔들스틱",
  "learn.tag_patterns": "패턴",
  "learn.tag_doji": "도지",
  "learn.tag_engulfing": "장악형",
  "learn.tag_institutional": "기관",
  "learn.tag_intraday": "장중",
  "learn.tag_kelly_criterion": "켈리기준",
  "learn.tag_math": "수학",
  "learn.tag_market_review": "시장리뷰",
  "learn.tag_btc": "BTC",
  "learn.tag_crash": "폭락",
  "learn.tag_real_data": "실데이터",
  "learn.tag_crypto": "크립토",
  "learn.tag_algorithmic_trading": "알고리즘매매",
  "learn.tag_python": "Python",
  "learn.tag_pruviq": "PRUVIQ",
  "learn.tag_origin": "기원",
  "learn.tag_philosophy": "철학",
  "learn.tag_bb_squeeze": "BB스퀴즈",
  "learn.tag_tp": "TP",
  "learn.tag_decision": "의사결정",
  "learn.tag_v170": "v1.7.0",
  "learn.tag_expert_panel": "전문가패널",
  "learn.tag_levels": "레벨",
  "learn.tag_feb_2026": "2026년2월",

  // Simulate page
  "simulate.tag": "전략 시뮬레이터",
  "simulate.title1": "전략을 만들고,",
  "simulate.title2": "570개 코인에서 테스트하세요.",
  "simulate.desc":
    "지표를 선택하고, 진입 조건을 설정하고, 리스크 파라미터를 조정하세요. 2년 이상의 실제 데이터로 백테스트를 실행하거나, 프리셋으로 시작하세요.",
  "simulate.quick_start": "퀵 스타트",
  "simulate.quick_start_desc": "이번 달 최고 성과 전략 — 클릭하면 바로 실행",
  "simulate.note":
    "코드 불필요. 계정 불필요. 비용 없음. 결과에는 현실적인 수수료와 슬리피지가 포함됩니다.",
  "simulate.loading": "전략 빌더 로딩중...",
  "simulate.strategies_title": "검증된 전략",
  "simulate.strategies_desc":
    "5개 전략 테스트. 4개 탈락. 1개 검증 완료. 전체 결과 공개.",
  "simulate.strategy_desc_bb_short": "볼린저 밴드 변동성 확장 — 숏 방향",
  "simulate.strategy_desc_bb_long": "동일 전략, 롱 방향 — 검증 실패",
  "simulate.strategy_desc_momentum": "20캔들 최고가 돌파 — 대규모 손실",
  "simulate.view_all": "전체 5개 전략 보기",
  "simulate.disclaimer":
    "시뮬레이션에는 거래당 0.04% 선물 수수료 + 0.02% 슬리피지가 포함됩니다. 과거 성과가 미래 수익을 보장하지 않습니다. 투자 조언이 아닙니다.",
  "simulate.step1_title": "프리셋을 선택하거나 지표를 고르세요",
  "simulate.step1_desc": "14개 지표, AND/OR 로직",
  "simulate.step2_title": "진입 조건과 리스크를 설정하세요",
  "simulate.step2_desc": "손절, 익절, 시간 필터, 포지션 크기",
  "simulate.step3_title": "570개+ 코인에서 백테스트 실행",
  "simulate.step3_desc": "수초 내 결과, 수수료 포함",
  "simulate.risk_disclaimer":
    "시뮬레이션 전용 \u2014 실거래가 아닙니다. 과거 성과가 미래 수익을 보장하지 않습니다. 선물 거래는 손실 위험이 있습니다.",
  "simulate.cta_preset": "BB Squeeze (검증됨)로 시작",
  "simulate.fees_cta": "거래소 수수료 비교",

  // Blog category short labels
  "blog.cat_short.market": "시장",
  "blog.cat_short.quant": "퀀트",
  "blog.cat_short.strategy": "전략",
  "blog.cat_short.weekly": "주간",
  "blog.cat_short.education": "교육",

  // Methodology page
  "meta.methodology_title": "방법론 - PRUVIQ",
  "meta.methodology_desc":
    "PRUVIQ가 트레이딩 전략을 백테스트하는 방법. 데이터 소스, 수수료 가정, 포지션 사이징, 평가 지표, 알려진 한계 — 완전히 투명하게 공개합니다.",
  "methodology.tag": "방법론",
  "methodology.title": "이렇게 테스트합니다.",
  "methodology.title2": "편법 없이.",
  "methodology.desc":
    "PRUVIQ의 모든 수치는 재현 가능한 시뮬레이션에서 나옵니다. 이 페이지에서는 백테스트 방법, 측정 지표, 그리고 포함하지 않는 것을 정확히 설명합니다.",

  "methodology.backtest_title": "백테스트 방법",
  "methodology.data_label": "데이터",
  "methodology.data_desc":
    "바이낸스 선물에서 수집한 2년 이상의 1시간 OHLCV 캔들 데이터. 모든 캔들은 완성된(종료된) 데이터만 사용하며, 선행 편향(look-ahead bias)을 방지하기 위해 미완성 데이터는 사용하지 않습니다.",
  "methodology.universe_label": "유니버스",
  "methodology.universe_desc":
    "바이낸스에 상장된 570개 이상의 USDT 무기한 선물 페어. 스테이블코인, 상장 폐지 코인, 유동성이 낮은 페어는 제외됩니다. 데일리 랭킹은 시가총액 상위 50개 코인 기준으로 산출됩니다. 정확한 수는 전략 버전에 따라 다릅니다.",
  "methodology.execution_label": "체결",
  "methodology.execution_desc":
    "진입은 캔들 종가에서 체결되는 것으로 가정합니다. 이는 보수적인 가정입니다 — 실제 체결가는 타이밍과 호가창 깊이에 따라 소폭 차이가 날 수 있습니다.",
  "methodology.fees_label": "수수료",
  "methodology.fees_desc":
    "편도 0.04% 테이커 수수료 (왕복 0.08%). 바이낸스 선물 VIP 0 등급 기본 수수료입니다.",
  "methodology.slippage_label": "슬리피지",
  "methodology.slippage_desc":
    "기본적으로 모델링하지 않습니다. 지정가 주문을 가정합니다. 바이낸스 선물에서 대부분의 거래의 진입 슬리피지는 일반적으로 0.05% 미만입니다.",
  "methodology.position_label": "포지션 사이징",
  "methodology.position_desc":
    "거래당 고정 $60, 5배 레버리지 (명목가 $300). 복리 없음 — 계좌 잔고와 관계없이 매 거래마다 동일한 금액을 사용합니다.",

  "methodology.metrics_title": "전략 평가 지표",
  "methodology.metrics_desc":
    "모든 전략은 수수료 차감 후 동일한 지표로 평가됩니다:",
  "methodology.metric_wr": "승률 — 수익으로 청산된 거래의 비율.",
  "methodology.metric_pf":
    "수익 팩터 — 총 수익을 총 손실로 나눈 비율. 1.0 이상이면 수익.",
  "methodology.metric_return": "총 수익률 % — 시작 자본 대비 순 손익 비율.",
  "methodology.metric_mdd":
    "최대 드로다운 — 자산 곡선에서 고점 대비 최대 하락폭.",
  "methodology.metric_trades": "거래 수 — 완료된 왕복 거래의 총 수.",
  "methodology.metric_sharpe":
    "샤프 비율 — 변동성 대비 위험 조정 수익률. 높을수록 좋습니다.",
  "methodology.metric_sortino":
    "소르티노 비율 — 샤프와 유사하지만 하방 변동성만 고려합니다.",
  "methodology.metric_calmar":
    "칼마 비율 — 총 수익률을 최대 드로다운으로 나눈 값. 위험 단위당 수익을 측정합니다.",
  "methodology.metrics_coming":
    "고급 지표(샤프, 소르티노, 칼마 비율)는 모든 시뮬레이션에서 계산되며, 시뮬레이터 결과에서 확인 가능합니다.",
  "methodology.label_wr": "승률",
  "methodology.label_pf": "수익 팩터",
  "methodology.label_return": "총 수익률 %",
  "methodology.label_mdd": "최대 드로다운",
  "methodology.label_trades": "거래 수",
  "methodology.label_sharpe": "Sharpe Ratio",
  "methodology.label_sortino": "Sortino Ratio",
  "methodology.label_calmar": "Calmar Ratio",
  "methodology.advanced_title": "위험 조정 지표",

  "methodology.validation_title": "강건성 검증",
  "methodology.validation_desc":
    "숫자만으로는 오해를 불러올 수 있습니다. 전략 성과가 실제인지 단순한 노이즈인지 검증하기 위해 두 가지 추가 방법을 적용합니다:",
  "methodology.oos_label": "표본 외 테스트 (OOS)",
  "methodology.oos_desc":
    "데이터를 학습 구간(In-Sample)과 테스트 구간(Out-of-Sample)으로 분리합니다. 전략은 학습에 사용하지 않은 데이터에서도 일관된 성과를 보여야 검증된 것으로 인정됩니다. 2024년, 2025년, 2026년을 독립적으로 테스트합니다.",
  "methodology.mc_label": "몬테카를로 시뮬레이션",
  "methodology.mc_desc":
    "전략당 1,000회 이상의 무작위 시뮬레이션을 실행합니다 — 거래 순서를 섞고 통계적 노이즈를 적용합니다. 최악의 시나리오, 신뢰 구간, 수익이 운 좋은 순서에 의존하는지 여부를 밝혀냅니다.",

  "methodology.not_modeled_title": "모델링하지 않는 것",
  "methodology.not_modeled_desc":
    "투명성은 빈틈을 보여주는 것입니다. 다음 요소들은 백테스트에 포함되지 않습니다:",
  "methodology.not_modeled_funding":
    "펀딩 비율 — 무기한 선물은 8시간마다 펀딩을 부과/지급합니다. 방향과 시장 상황에 따라 수익에 더하거나 뺄 수 있습니다.",
  "methodology.not_modeled_impact":
    "시장 충격 — 대량 주문은 가격을 움직일 수 있습니다. $60 포지션 규모에서는 최소화되지만 존재합니다.",
  "methodology.not_modeled_outages":
    "거래소 장애 — 바이낸스는 가끔 다운타임이 있습니다. 백테스트는 100% 가동을 가정합니다.",
  "methodology.not_modeled_blackswan":
    "블랙 스완 이벤트 — 급락, 상장 폐지, 규제 충격은 시뮬레이션하지 않습니다.",
  "methodology.not_modeled_liquidity":
    "유동성 변동 — 호가창 깊이는 시간대와 코인에 따라 변합니다.",

  "methodology.reproducibility_title": "재현 가능성",
  "methodology.reproducibility_desc":
    "모든 전략 파라미터를 공개합니다 — 진입 조건, 청산 조건, 손절, 익절, 시간 필터, 코인 유니버스. 시그널 로직이 문서화되어 있어 직접 재현하거나 수정할 수 있습니다. 인터랙티브 시뮬레이터에서 SL/TP를 조정하고 결과가 어떻게 변하는지 실시간으로 확인할 수 있습니다.",

  "methodology.disclaimer_title": "면책 조항",
  "methodology.disclaimer_text":
    "과거 성과는 미래 결과를 보장하지 않습니다. 백테스트는 시뮬레이션이지 예측이 아닙니다. 실제 트레이딩에는 어떤 모델로도 포착할 수 없는 위험이 있으며, 감정적 의사결정, 연결 문제, 시장 레짐 변화 등이 포함됩니다. 항상 감당할 수 있는 자본으로만 테스트하세요.",
  "methodology.cta_title": "직접 확인하세요",
  "methodology.cta_desc":
    "파라미터를 조정하고 570개+ 코인에 대한 실제 백테스트 결과를 확인하세요.",
  "methodology.cta_button": "시뮬레이터 열기",
  "methodology.sharpe_formula": "공식: (수익률 - 무위험 수익률) / 변동성",
  "methodology.sortino_formula": "공식: (수익률 - 무위험 수익률) / 하방 편차",
  "methodology.calmar_formula": "공식: 연간 수익률 / 최대 낙폭",
  "methodology.term_oos":
    "Out-of-Sample(표본 외 검증) = 전략이 한 번도 보지 못한 데이터로 테스트하여, 실제로 작동하는지 패턴만 외웠는지 확인합니다.",
  "methodology.term_mc":
    "몬테카를로 = 1,000회 이상 무작위 시뮬레이션으로 최악 시나리오와 신뢰 수준을 확인합니다.",
  "methodology.performance_cta": "백테스트 결과 보기",
  "methodology.strategies_cta": "전체 전략 탐색",
  "methodology.learn_cta": "기초 학습하기",
  "footer.methodology": "방법론",

  // CSV download
  "csv.download": "CSV 다운로드",

  // Signals page
  "meta.signals_title": "실시간 매매 시그널 - PRUVIQ",
  "meta.signals_desc":
    "17개 검증된 전략이 30개 코인을 매시간 스캔합니다. 실시간 시그널 확인 후 시뮬레이터에서 직접 검증하세요.",
  "signals.title": "실시간 시그널",
  "signals.desc":
    '17개 전략이 30개 코인을 매시간 스캔합니다. 각 시그널에 진입가, 손절, 익절 수준이 표시됩니다. "Verify"를 클릭하면 시뮬레이터에서 직접 백테스트할 수 있습니다.',
  "signals.stat_strategies": "전략 수",
  "signals.stat_coins": "스캔 코인",
  "signals.stat_interval": "스캔 주기",
  "signals.how_title": "작동 방식:",
  "signals.how_desc":
    "엔진이 최신 완성 1시간 캔들에서 17개 전략의 진입 조건을 확인합니다. 조건이 충족되면 시그널이 여기에 표시됩니다. 시그널은 매매 추천이 아닙니다 — 항상 시뮬레이터에서 먼저 검증하세요.",
  "signals.cta_tag": "검증 & 실행",
  "signals.cta_title": "테스트하고 싶은 시그널이 있나요?",
  "signals.cta_desc":
    "시뮬레이터에서 백테스트를 실행해 매매 전 시그널을 검증하세요. 무료, 가입 불필요.",
  "signals.cta_simulate": "시뮬레이터 열기",
  "signals.cta_strategies": "전략 둘러보기",

  // API Docs page
  "meta.api_title": "API 레퍼런스 - PRUVIQ",
  "meta.api_desc":
    "무료 크립토 전략 백테스팅 REST API. 570개 이상 코인에서 전략 시뮬레이션, OHLCV 데이터, 시장 개요 등을 제공합니다.",
  "api.tag": "API 레퍼런스",
  "api.title": "PRUVIQ 데이터로",
  "api.title2": "직접 빌드하세요.",
  "api.desc":
    "전략 백테스팅, 시장 데이터, OHLCV 캔들을 위한 무료 REST API. API 키 불필요. 분당 30회 제한.",
  "api.base_url": "기본 URL",
  "api.rate_limit": "요청 제한",
  "api.rate_limit_value": "IP당 분당 30회",
  "api.auth": "인증",
  "api.auth_value": "불필요 (공개 API)",
  "api.format": "응답 형식",
  "api.format_value": "JSON",
  "api.cors": "CORS",
  "api.cors_value": "모든 오리진 허용",
  "api.interactive": "인터랙티브 문서",
  "api.interactive_desc": "Swagger UI (직접 테스트 가능):",
  "api.section_market": "시장 데이터",
  "api.section_simulation": "시뮬레이션",
  "api.section_builder": "전략 빌더",
  "api.section_data": "데이터",
  "api.endpoint_health": "헬스 체크. API 상태, 로드된 코인 수, 가동 시간 반환.",
  "api.endpoint_market":
    "시장 개요: BTC/ETH 가격, 공포·탐욕 지수, BTC 도미넌스, 상위 상승/하락, 극단적 펀딩률.",
  "api.endpoint_news": "여러 RSS 소스에서 수집한 크립토 뉴스. 정기적으로 갱신.",
  "api.endpoint_macro":
    "거시경제 지표, 크립토 파생상품 데이터, 예정된 경제 이벤트.",
  "api.endpoint_coins":
    "사용 가능한 모든 코인 목록. 데이터 범위 및 행 수 포함.",
  "api.endpoint_coins_stats":
    "모든 코인의 사전 계산된 전략 통계. 가격, 거래량, 승률, 수익 팩터 포함.",
  "api.endpoint_ohlcv":
    "OHLCV 캔들 데이터 + 기술 지표 (볼린저 밴드, EMA, 거래량 비율).",
  "api.endpoint_strategies":
    "사용 가능한 모든 전략 목록. 기본 파라미터 및 상태 포함.",
  "api.endpoint_simulate":
    "여러 코인에서 전략 시뮬레이션 실행. 종합 성과 지표 및 자산 곡선 반환.",
  "api.endpoint_simulate_coin":
    "단일 코인 시뮬레이션. 진입/청산 가격이 포함된 개별 거래 상세 반환.",
  "api.endpoint_compare":
    "동일 조건(동일 SL/TP, 동일 코인)에서 모든 전략 비교.",
  "api.endpoint_backtest":
    "조건 엔진을 사용한 커스텀 전략 백테스트. 전략 빌더 전체 지원.",
  "api.endpoint_indicators":
    "전략 빌더용 사용 가능한 기술 지표 목록. 필드 및 기본 파라미터 포함.",
  "api.endpoint_presets": "전략 빌더용 프리셋 전략 템플릿 목록.",
  "api.endpoint_preset_detail":
    "편집을 위한 프리셋 전략의 전체 JSON 정의 반환.",
  "api.quickstart": "빠른 시작",
  "api.quickstart_desc": "설정 없이 바로 시작하세요.",
  "api.example_python": "Python",
  "api.example_curl": "cURL",
  "api.example_js": "JavaScript",
  "api.sdk_title": "출시 예정",
  "api.sdk_desc":
    "Python SDK와 WebSocket 피드가 개발 중입니다. X에서 최신 소식을 확인하세요.",
  "api.request_body": "요청 본문",
  "api.params_label": "파라미터:",
  "api.try_it": "직접 호출",
  "api.response_example": "응답 예시",
  "api.curl_example": "cURL",
  "api.copy": "복사",
  "api.copied": "복사됨!",
  "api.section_signals": "랭킹 & 시그널",
  "api.endpoint_rankings_daily":
    "오늘의 최고 성과 전략을 수익 팩터 기준으로 랭킹. 매일 00:30 UTC 갱신.",
  "api.endpoint_signals_live":
    "모든 활성 전략의 실시간 트레이딩 시그널. 진입가, 방향, SL/TP 포함.",
  "api.endpoint_hot_strategies": "최근 30일 상위 50코인 기준 핫 전략 랭킹.",
  "api.endpoint_market_live":
    "실시간 시장 데이터 스트림. BTC/ETH 실시간 가격 및 시장 지표.",
  "api.endpoint_export_csv": "시뮬레이션 결과를 CSV 파일로 내보내기.",
  "api.endpoint_validate": "전체 시뮬레이션 실행 전 전략 설정을 검증.",
  "api.note_async":
    "장시간 실행되는 백테스트(top_n이 크거나 기간이 넓은 경우)는 비동기 처리가 필요할 수 있습니다. 타임아웃을 방지하려면 top_n을 줄이거나(예: 50), 기간을 좁히거나, 여러 개의 작은 요청으로 분할하세요.",
  "footer.api": "API",
  "footer.compare": "vs 트레이딩뷰",

  // Compare index page (/ko/compare)
  "compare_index.tag": "비교",
  "compare_index.title": "PRUVIQ vs 대안 플랫폼",
  "compare_index.subtitle":
    "무료 백테스트. 가입 불필요. 570개 코인. 직접 비교해 보세요.",
  "compare_index.meta_title":
    "PRUVIQ vs 대안 플랫폼 — 무료 크립토 백테스트 비교",
  "compare_index.meta_desc":
    "PRUVIQ를 TradingView, Coinrule, 3Commas, Cryptohopper, Gainium, Streak와 비교하세요. 무료, 가입 불필요, 570개 코인.",
  "compare_index.most_popular": "가장 인기",
  "compare_index.tradingview_desc": "코딩 없는 백테스트 vs 유료 Pine Script",
  "compare_index.coinrule_desc": "무료 무제한 백테스트 vs $29+/월 규칙 빌더",
  "compare_index.cryptohopper_desc": "570개 코인 무료 vs 제한된 봇 구독",
  "compare_index.3commas_desc": "투명한 결과 vs 폐쇄형 전략 마켓",
  "compare_index.gainium_desc": "가입 불필요 vs 필수 계정 생성",
  "compare_index.streak_desc": "크립토 네이티브 570개 코인 vs 주식 중심 플랫폼",
  "compare_index.footer": "모든 비교는 실제 백테스트 데이터를 사용합니다.",
  "compare_index.try_cta": "직접 체험하기 →",
  "compare_index.strength1_tag": "완전 무료",
  "compare_index.strength1_title": "$0 — 신용카드 불필요",
  "compare_index.strength1_desc":
    "경쟁사는 월 $19–$60를 청구합니다. PRUVIQ는 $0 — 구독 없음. 계정 없이 시뮬레이션 실행 가능.",
  "compare_index.strength2_tag": "570개 코인 동시 테스트",
  "compare_index.strength2_title": "전체 시장을 한 번에",
  "compare_index.strength2_desc":
    "다른 플랫폼은 코인 하나씩 테스트합니다. PRUVIQ는 570개 코인을 한 번에 스캔 — 진짜 작동하는 전략을 찾으세요.",
  "compare_index.strength3_tag": "실패도 공개합니다",
  "compare_index.strength3_title": "급진적 투명성",
  "compare_index.strength3_desc":
    "경쟁사는 실패를 0건 공개합니다. 저희는 중단한 모든 전략과 이유를 기록합니다. 마케팅보다 정직.",
  "compare_index.primary_cta": "무료 체험 — 계정 불필요",
  "compare_index.cta_note": "회원가입 없음. 신용카드 없음. 즉시 결과 확인.",
  "compare_index.detailed_label": "상세 비교",
  "compare_index.tbl_feature": "기능",
  "compare_index.tbl_price": "가격",
  "compare_index.tbl_no_account": "계정 불필요",
  "compare_index.tbl_multicoin": "멀티코인 백테스트",
  "compare_index.tbl_transparency": "실패 투명성",
  "compare_index.tbl_no_code": "코딩 불필요",

  // Social proof / trust section
  "trust.badge_api": "CoinGecko 데이터",
  "trust.badge_source": "투명한 방법론",
  "trust.badge_privacy": "개인정보 불필요",
  "trust.badge_validated": "몬테카를로 검증",
  "trust.verified_label": "검증된 전략",
  "trust.verified_count": "{count}개 검증됨",
  "trust.last_updated": "최종 업데이트: {date}",
  "trust.section_tag": "데이터로 검증됨",
  "trust.section_title": "모든 주장은 검증 가능합니다.",
  "trust.badge_mc": "몬테카를로 검증",
  "trust.badge_mc_desc": "전략당 10,000회 랜덤 시뮬레이션으로 견고성 테스트",
  "trust.badge_oos": "Out-of-Sample 테스트",
  "trust.badge_oos_desc": "2024, 2025, 2026년 데이터에서 독립 검증",
  "trust.badge_live": "완전 투명 저널",
  "trust.badge_live_desc": "모든 거래, 모든 실패, 모든 결과 — 전부 공개",
  "trust.badge_open": "완전 감사 가능",
  "trust.badge_open_desc":
    "모든 전략, 모든 파라미터, 모든 결과 — 문서화되고 검증 가능합니다.",
  "trust.stat_trades": "백테스트 거래 수",
  "trust.stat_datapoints": "처리된 데이터 포인트",
  "trust.stat_live_days": "백테스트 코인 수",
  "trust.stat_strategies": "테스트된 전략 (4개 실패)",

  // Homepage misc
  "home.social_simulations": "12,847회 시뮬레이션 실행",
  "home.social_simulations_note": "(2026년 3월 기준)",
  "home.trust_documented": "문서화된 전략",
  "home.trust_verified_active": "검증 완료 및 활성",
  "home.trust_oos_label": "OOS 검증 전략",
  "home.cta_survives": "살아남는 전략 보기",
  "home.cta_test_yourself": "직접 테스트 — 무료",
  "home.not_sure": "확신이 없으신가요?",
  "home.not_sure_cta": "30초 만에 작동 방식 확인하기",
  "home.community_feedback_tag": "커뮤니티 피드백",
  "home.quotes_initials_note":
    "이름은 커뮤니티 회원 요청에 따라 이니셜로 표시합니다.",
  "home.quotes_heading": "트레이더들의 이야기",
  "home.quotes_cta": "함께 해보세요 — 시뮬레이터 열기",
  "home.ranking_shortcut": "오늘의 상위 전략",
  "home.competitor_banner":
    "TradingView는 백테스팅에 월 $14~240를 청구합니다. PRUVIQ는 $0 — 구독 없음.",
  "home.social_proof_cta": "이번 달 4,200명 이상이 백테스트를 실행했습니다.",

  // TradingView comparison page
  "meta.vs_tv_title": "PRUVIQ vs 트레이딩뷰 - 무료 크립토 백테스팅 비교",
  "meta.vs_tv_desc":
    "크립토 전략 백테스팅에서 PRUVIQ와 트레이딩뷰를 비교합니다. Pine Script 불필요. $0 — 구독 없음. 570개+ 코인. 완전 백테스트 투명성.",
  "vs.tag": "솔직한 비교",
  "vs.title": "PRUVIQ vs 트레이딩뷰",
  "vs.subtitle": "크립토 백테스팅용",
  "vs.desc":
    "트레이딩뷰는 차트에 훌륭합니다. 하지만 코딩 없이 크립토 전략을 백테스트하고 싶다면, PRUVIQ가 그것을 위해 만들어졌습니다.",
  "vs.tldr": "요약",
  "vs.tldr_text":
    "차트와 커뮤니티는 트레이딩뷰. 무료 노코드 크립토 백테스팅과 완전 투명 검증은 PRUVIQ.",
  "vs.feature": "기능",
  "vs.pruviq": "PRUVIQ",
  "vs.tradingview": "트레이딩뷰",
  "vs.row_price": "가격",
  "vs.row_price_p": "$0 — 구독 없음",
  "vs.row_price_tv": "월 $14.95-59.95 (Essential-Premium)",
  "vs.row_coding": "코딩 필요",
  "vs.row_coding_p": "코딩 불필요 — 비주얼 빌더",
  "vs.row_coding_tv": "Pine Script (자체 프로그래밍 언어)",
  "vs.row_coins": "크립토 코인",
  "vs.row_coins_p": "570개+ USDT 무기한 선물",
  "vs.row_coins_tv": "거래소 연결에 따라 다름",
  "vs.row_data": "과거 데이터",
  "vs.row_data_p": "2년+ 1시간 캔들 (무료)",
  "vs.row_data_tv": "무료 플랜 제한, 최대 20K 봉",
  "vs.row_fees": "수수료 모델링",
  "vs.row_fees_p": "내장 (편도 0.08% 선물)",
  "vs.row_fees_tv": "Pine Script에서 수동 설정",
  "vs.row_multi": "멀티코인 테스트",
  "vs.row_multi_p": "570개 코인 원클릭 테스트",
  "vs.row_multi_tv": "한 번에 차트 1개",
  "vs.row_live": "백테스트 투명성",
  "vs.row_live_p": "실패 포함 전체 결과 공개",
  "vs.row_live_tv": "사용자 공유만 — 실패 결과 거의 공개 안 됨",
  "vs.row_builder": "전략 빌더",
  "vs.row_builder_p": "비주얼, 14개 지표, AND/OR 로직",
  "vs.row_builder_tv": "Pine Script 에디터",
  "vs.row_api": "API 접근",
  "vs.row_api_p": "무료 REST API (분당 30회)",
  "vs.row_api_tv": "유료 플랜만",
  "vs.row_community": "커뮤니티",
  "vs.row_community_p": "성장 중 (X, GitHub)",
  "vs.row_community_tv": "5000만+ 사용자, 소셜 기능",
  "vs.when_pruviq": "PRUVIQ를 선택할 때...",
  "vs.when_pruviq_1": "코딩 없이 무료 크립토 백테스팅",
  "vs.when_pruviq_2": "570개+ 코인에서 동시 전략 테스트",
  "vs.when_pruviq_3": "수수료와 슬리피지 포함 현실적 결과",
  "vs.when_pruviq_4": "투명한 백테스트 결과로 검증",
  "vs.when_tv": "트레이딩뷰를 선택할 때...",
  "vs.when_tv_1": "고급 차트와 기술적 분석",
  "vs.when_tv_2": "커뮤니티 스크립트와 소셜 트레이딩",
  "vs.when_tv_3": "멀티 자산 (주식, 외환, 크립토)",
  "vs.when_tv_4": "복잡한 커스텀 지표를 위한 Pine Script",
  "vs.cta_title": "둘 다 사용하세요",
  "vs.cta_desc": "차트는 트레이딩뷰. 백테스트는 PRUVIQ. 계정 생성 불필요.",

  // FAQ
  "faq.title": "자주 묻는 질문",
  "faq.q1": "PRUVIQ는 무엇인가요?",
  "faq.a1":
    "PRUVIQ는 무료 크립토 전략 백테스팅 플랫폼입니다. 14개 기술 지표를 사용해 커스텀 전략을 만들고, 570개 이상의 코인에서 2년 이상의 실제 시장 데이터로 백테스트하며, 수수료와 슬리피지를 포함한 현실적인 결과를 확인할 수 있습니다. 코딩 불필요.",
  "faq.q2": "전략 빌더는 어떻게 작동하나요?",
  "faq.a2":
    "노코드 전략 빌더에서 지표(볼린저 밴드, RSI, MACD, EMA, 스토캐스틱, ADX, ATR, 거래량 등)를 AND/OR 논리와 비교 연산자로 조합할 수 있습니다. 진입 조건, 손절, 익절, 시간 필터를 설정한 후 3초 이내에 전체 코인 백테스트를 실행합니다.",
  "faq.q3": "PRUVIQ는 무료인가요?",
  "faq.a3":
    "네, PRUVIQ의 핵심 백테스팅 기능은 완전 무료입니다. 전략 만들기, 570개 이상 코인 백테스트, 모든 교육 콘텐츠 이용이 결제나 계정 생성 없이 가능합니다.",
  "faq.q4": "PRUVIQ가 TradingView 등 다른 도구와 다른 점은?",
  "faq.a4":
    "PRUVIQ는 코딩 없이 크립토 선물에 특화되어 설계되었습니다. TradingView(Pine Script 필요)나 QuantConnect(Python/C# 필요)와 달리 시각적 전략 빌더를 제공합니다. 또한 실패를 포함한 실제 거래 결과를 공개하고, 570개 이상 코인을 동시에 테스트하며, 모든 시뮬레이션에 현실적인 수수료와 슬리피지를 포함합니다.",
  "faq.q5": "PRUVIQ는 전략을 어떻게 검증하나요?",
  "faq.a5":
    "PRUVIQ는 570개 이상의 코인에서 2년 이상의 과거 데이터로 모든 전략을 백테스트합니다. 수수료, 슬리피지, 펀딩비를 포함한 현실적인 시뮬레이션으로 검증하며, 실패한 전략도 모두 공개합니다.",

  // Tooltips
  "tooltip.sl":
    "손절(Stop Loss) \u2014 자동 종료 전 최대 손실. 예: 10% = 가격이 10% 불리하게 움직이면 포지션 종료.",
  "tooltip.tp":
    "익절(Take Profit) \u2014 자동 종료 수익 목표. 예: 8% = 가격이 8% 유리하게 움직이면 포지션 종료.",
  "tooltip.sharpe":
    "샤프 비율 \u2014 위험 대비 수익. 1.0 이상 양호, 2.0 이상 우수.",
  "tooltip.sortino":
    "소르티노 비율 \u2014 샤프와 유사하나 하방 위험만 고려. 큰 수익이 가끔 나는 전략에 더 정직한 지표.",
  "tooltip.calmar":
    "칼마 비율 \u2014 수익률 \u00f7 최대 낙폭. 높을수록 손실에서 빠르게 회복.",
  "tooltip.pf":
    "수익 팩터 \u2014 총 수익 \u00f7 총 손실. 1.5 이상 강함, 2.0 이상 우수.",
  "tooltip.mdd": "최대 낙폭(MDD) \u2014 고점 대비 최대 하락. 낮을수록 좋음.",
  "tooltip.wr":
    "승률 \u2014 수익 거래 비율. 좋은 손익비와 함께 50% 이상이면 견고.",
  "tooltip.oos":
    "Out-of-Sample \u2014 과적합 방지를 위해 보지 못한 데이터로 테스트.",
  "tooltip.mc":
    "몬테카를로 \u2014 1,000회+ 무작위 시뮬레이션으로 전략 견고성 확인.",

  // Cross-page CTAs
  "cross.simulate_cta": "시뮬레이터 열기",
  "cross.strategies_cta": "전체 전략 보기",
  "cross.fees_cta": "거래소 수수료 비교",
  "cross.performance_cta": "백테스트 결과 보기",
  "cross.methodology_cta": "검증 방법론",
  "cross.learn_cta": "기초 학습하기",
  "cross.demo_cta": "인터랙티브 데모 체험",
  "cross.coins_cta": "전체 코인 탐색",
  "cross.market_cta": "시장 대시보드",

  // Leaderboard
  "leaderboard.tag": "주간 순위",
  "leaderboard.title": "이번 주 최고의 전략",
  "leaderboard.desc":
    "570개 이상의 코인에서 이번 주 가장 좋은 성과를 보인 전략 설정을 확인하세요. 매주 월요일 업데이트.",
  "leaderboard.best": "최고 성과",
  "leaderboard.worst": "저조한 성과",
  "leaderboard.coming_soon":
    "실시간 리더보드 준비 중. 지금은 시뮬레이터에서 직접 백테스트를 해보세요.",
  "leaderboard.cta": "시뮬레이터 열기",
  "leaderboard.rank": "#",
  "leaderboard.strategy": "전략",
  "leaderboard.direction": "방향",
  "leaderboard.win_rate": "승률",
  "leaderboard.profit_factor": "PF",
  "leaderboard.total_return": "수익률",
  "leaderboard.weekly_note": "매주 업데이트",
  "leaderboard.noscript_title": "주간 전략 순위",
  "leaderboard.noscript_desc":
    "승률, 수익률 등 실시간 주간 전략 순위를 보려면 JavaScript를 활성화하세요.",
  "meta.leaderboard_title": "주간 전략 순위 - PRUVIQ",
  "meta.leaderboard_desc":
    "이번 주 최고 및 최악의 암호화폐 전략을 확인하세요. 실제 백테스트 데이터로 매주 업데이트.",
  "meta.ranking_title": "일별 전략 랭킹 | PRUVIQ",
  "meta.ranking_desc":
    "수익 팩터와 승률 기반 일별 전략 랭킹. 570개 코인 · 37개 전략 설정 백테스트 데이터로 매일 업데이트.",
  "fees.savings_callout":
    "월 $10,000 거래 시? PRUVIQ 바이낸스 VIP 할인으로 연간 약 $144 절약.",
  "nav.leaderboard": "리더보드",
  "nav.compare_tools": "도구 비교",
  "nav.ranking_desc": "일일 성과 순위",
  "nav.leaderboard_desc": "주간 베스트",
  "nav.compare_tools_desc": "vs TradingView 등",
  "nav.daily_ranking": "일일 랭킹",
  "nav.weekly": "주간",
  "nav.signals": "시그널",

  // Metric explanation tooltips
  "metric.sharpe_desc":
    "위험 조정 수익률. 높을수록 좋음. 1 이상 양호, 2 이상 우수.",
  "metric.sortino_desc": "하방 변동성만 반영한 샤프 비율. 높을수록 좋음.",
  "metric.mdd_desc": "최고점 대비 최대 하락폭. 낮을수록 좋음. 최악의 시나리오.",
  "metric.pf_desc": "총 이익 / 총 손실. 1.5 이상 양호, 2.0 이상 우수.",
  "metric.wr_desc":
    "수익 거래 비율. 맥락이 중요 \u2014 높은 승률이라도 R:R이 낮으면 손실 가능.",
  "metric.calmar_desc":
    "연간 수익률 / 최대 낙폭. 높을수록 위험 대비 수익이 좋음.",

  // Learn feature card
  "features.learn_tag": "교육",
  "features.learn_title": "트레이딩 전에 학습하기",
  "features.learn_desc":
    "초급부터 고급까지 무료 가이드. 실제 데이터로 지표, 리스크 관리, 백테스팅을 이해하세요.",

  // Simulator placeholders & labels
  "simulator.placeholder.topCoins": "상위 코인 수",
  "simulator.placeholder.searchCoins": "코인 검색...",
  "simulator.placeholder.symbol": "심볼...",
  "simulator.lookAheadWarning":
    "현재(미완성) 캔들 데이터를 사용하면 실거래에서 look-ahead bias가 발생할 수 있습니다",
  "simulator.label.inSample": "학습 구간",
  "simulator.label.outOfSample": "검증 구간",
  "simulator.aria.resetChartZoom": "차트 줌 초기화",
  "simulator.aria.closeGuide": "가이드 닫기",

  // Market Dashboard
  "market.economicCalendar": "경제 캘린더",

  // Learn Card
  "learn.read": "읽음",

  // Coin Detail Page
  "coin_detail.header_desc":
    "{name} BB Squeeze SHORT 전략 시뮬레이션. 2년 이상 과거 데이터로 진입/청산 신호, 에퀴티 커브, 개별 거래 분석을 확인하세요.",
  "coin_detail.simulate_coin": "{coin} 시뮬레이션",
  "coin_detail.all_strategies": "전체 전략",
  "coin_detail.all_coins": "전체 코인",
  "coin_detail.strategy_overview": "전략 개요",
  "coin_detail.direction": "방향",
  "coin_detail.short_only": "숏 전용",
  "coin_detail.sl_tp": "손절 / 익절",
  "coin_detail.max_hold": "최대 보유",
  "coin_detail.max_hold_val": "48시간",
  "coin_detail.data_period": "데이터 기간",
  "coin_detail.data_period_val": "2년 이상 (1H)",
  "coin_detail.strategy_desc":
    "BB Squeeze 전략은 {name}에서 저변동성 구간(볼린저밴드 압축)을 식별합니다. 밴드가 확장되고 가격이 하향 돌파하면 숏 포지션에 진입합니다. 570개 코인에서 Out-of-Sample 테스트와 몬테카를로 시뮬레이션으로 검증되었습니다.",
  "coin_detail.faq_title": "자주 묻는 질문",
  "coin_detail.faq_q1": "{name}의 BB Squeeze SHORT 전략이란?",
  "coin_detail.faq_a1":
    "BB Squeeze SHORT 전략은 {display}에서 볼린저밴드 압축을 감지하고, 하향 돌파 시 숏 포지션에 진입합니다. 손절 10%, 익절 8%, 최대 48시간 보유합니다.",
  "coin_detail.faq_q2": "{name} 백테스트는 신뢰할 수 있나요?",
  "coin_detail.faq_a2":
    "PRUVIQ 백테스트는 바이낸스 선물 2년 이상의 1시간 OHLCV 데이터를 사용합니다. 모든 결과는 Out-of-Sample 테스트와 몬테카를로 시뮬레이션(10,000회)으로 검증됩니다. Look-ahead bias 없이 완성된 캔들만 신호에 사용합니다.",
  "coin_detail.faq_q3": "{name} 시뮬레이션은 무료인가요?",
  "coin_detail.faq_a3":
    "네. PRUVIQ는 100% 무료입니다. 모든 지원 코인에서 BB Squeeze 전략을 시뮬레이션하고, 파라미터를 조정하고, 상세 에퀴티 커브와 거래 로그를 확인할 수 있습니다. 가입 불필요.",

  // Strategy Detail Page
  "strategy_detail.simulate_this": "이 전략 시뮬레이션",
  "strategy_detail.english_only": "이 콘텐츠는 영어로만 제공됩니다.",

  // Simulate Page
  "simulate.all_strategies": "전체 전략",
  "simulate.preset_verified_tooltip":
    "검증됨 = 570개+ 코인, 2년+ 실제 시장 데이터 백테스트",

  // CTA badges
  "cta.badge1": "신용카드 불필요",
  "cta.badge2": "계정 생성 불필요",
  "cta.badge3": "$0 — 구독 없음",
  "cta.badge4": "3초 만에 결과",

  // Homepage comparison section
  "compare.section_tag": "왜 PRUVIQ?",
  "compare.section_title": "백테스트에 돈 쓰지 마세요",
  "compare.other_label": "다른 도구",
  "compare.pruviq_label": "PRUVIQ",
  "compare.row1_label": "비용",
  "compare.row1_other": "월 $15 - $200",
  "compare.row1_pruviq": "$0 — 구독 없음",
  "compare.row2_label": "코딩",
  "compare.row2_other": "Python / Pine Script 필요",
  "compare.row2_pruviq": "코딩 불필요",
  "compare.row3_label": "코인",
  "compare.row3_other": "한 번에 1개 코인",
  "compare.row3_pruviq": "570개+ 코인 동시 테스트",
  "compare.row4_label": "가입",
  "compare.row4_other": "이메일 + 신용카드",
  "compare.row4_pruviq": "계정 불필요",
  "compare.row5_label": "수수료",
  "compare.row5_other": "대부분 미반영",
  "compare.row5_pruviq": "실제 수수료 포함",

  // Homepage trust badges (below features)
  "trust_badges.no_signup": "가입 불필요",
  "trust_badges.free": "$0 — 구독 없음",
  "trust_badges.opensource": "투명한 방법론",
  "trust_badges.data_sources": "Binance + CoinGecko 데이터",

  // Coins page
  "coins.explore_next":
    "관심 있는 코인을 찾으셨나요? 전략에서 테스트해 보세요.",
  "coins.noscript_title": "코인 목록을 보려면 JavaScript가 필요합니다.",
  "coins.noscript_desc":
    "570개 이상의 코인을 탐색하려면 JavaScript를 활성화하세요. 인기 코인:",

  // Changelog context callout
  "changelog.context_title": "여기서 추적하는 버전은?",
  "changelog.context_desc":
    '이 변경 기록은 바이낸스 선물에서 실시간 운영 중인 <strong class="text-[--color-text]">BB Squeeze SHORT 매매 전략</strong>을 추적합니다. 플랫폼 버전(웹사이트, 시뮬레이터, API)은 별도로 관리됩니다.',

  // Meta: Privacy & Terms
  "meta.privacy_title": "개인정보처리방침 - PRUVIQ",
  "meta.privacy_desc":
    "PRUVIQ 개인정보처리방침. 데이터 수집, 쿠키, 분석 도구 사용에 대한 안내. GDPR 및 개인정보보호법 준수.",
  "meta.privacy_tag": "개인정보처리방침",
  "meta.privacy_heading": "개인정보처리방침",
  "meta.privacy_updated": "최종 수정일: 2026년 3월 1일",
  "meta.terms_title": "이용약관 - PRUVIQ",
  "meta.terms_desc":
    "PRUVIQ 이용약관. 서비스 이용 조건, 금융 면책조항, 책임 제한, 제휴 링크 고지.",
  "meta.terms_tag": "이용약관",
  "meta.terms_heading": "이용약관",
  "meta.terms_updated": "최종 수정일: 2026년 3월 1일",

  // Ranking component inline strings (QW6)
  "ranking.card_wr": "승률",
  "ranking.card_trades": "거래 수",
  "ranking.card_days": "집계 일수",
  "ranking.card_days_unit": "일",
  "ranking.card_low_sample":
    "제한된 데이터 ({n}거래). 참고용으로만 활용하세요.",
  "ranking.card_load_fail": "데이터 로드 실패",
  "ranking.section_best3_title": "상위 3개 전략",
  "ranking.section_best3_sub": "PF(수익팩터) 기준 상위 3개",
  "ranking.section_worst3_title": "하위 3개 전략",
  "ranking.section_worst3_sub": "PF 기준 하위 3개 — 피해야 할 조합",
  "ranking.section_weekly_title": "이번 주 상위 3개",
  "ranking.section_weekly_sub": "최근 7일 평균 PF 기준",
  "ranking.summary_wr50": "WR 50%+ 전략:",
  "ranking.summary_total_unit": "개",
  "ranking.summary_cta": "시뮬레이터에서 직접 확인",
  "ranking.period_7d": "7일",
  "ranking.period_30d": "30일",
  "ranking.period_365d": "365일",
  "ranking.group_top30": "Top 30",
  "ranking.group_top50": "Top 50",
  "ranking.group_top100": "Top 100",
  "ranking.group_btc": "BTC 전용",
  "ranking.confidence_high": "검증됨",
  "ranking.confidence_mid": "참고",
  "ranking.confidence_low": "신호",

  // 비교 페이지: 3Commas
  "meta.vs_3commas_title": "PRUVIQ vs 3Commas — 무료 암호화폐 백테스트 대안",
  "meta.vs_3commas_desc":
    "암호화폐 전략 백테스팅에서 PRUVIQ와 3Commas를 비교하세요. 구독료 없이 무료, 570개 코인, 실제 수수료 시뮬레이션.",
  "vs_3commas.tag": "솔직한 비교",
  "vs_3commas.title": "PRUVIQ vs 3Commas",
  "vs_3commas.subtitle": "백테스팅 연구 vs. 자동매매 봇",
  "vs_3commas.desc":
    "3Commas는 DCA·그리드 봇으로 자동매매를 실행하는 대표 플랫폼입니다. PRUVIQ는 전용 백테스팅 연구 도구입니다. 목적이 다릅니다 — 실제 자금을 투입하기 전에 전략을 검증할 때, 어떻게 다른지 비교합니다.",
  "vs_3commas.tldr": "한 줄 요약",
  "vs_3commas.tldr_text":
    "3Commas는 실거래 자동화($15-110/월). PRUVIQ는 거래 전 전략 검증 — 무료, 코딩 불필요, 570개 코인, 실제 수수료·슬리피지 반영. PRUVIQ로 연구하고 3Commas로 실행하세요.",
  "vs_3commas.feature": "기능",
  "vs_3commas.pruviq": "PRUVIQ",
  "vs_3commas.other": "3Commas",
  "vs_3commas.row_price": "가격",
  "vs_3commas.row_price_p": "$0 — 구독 없음 — $0/월",
  "vs_3commas.row_price_other": "$15–110/월 (Starter–Expert)",
  "vs_3commas.row_annual": "연간 비용",
  "vs_3commas.row_annual_p": "$0",
  "vs_3commas.row_annual_other": "$180–1,320/년",
  "vs_3commas.row_coding": "코딩 필요 여부",
  "vs_3commas.row_coding_p": "코딩 불필요 — 시각적 지표 빌더",
  "vs_3commas.row_coding_other": "코딩 불필요 — DCA/그리드 봇 마법사",
  "vs_3commas.row_coins": "지원 코인",
  "vs_3commas.row_coins_p": "570개 코인 (바이낸스 USDT 선물)",
  "vs_3commas.row_coins_other": "여러 거래소, 플랜에 따라 상이",
  "vs_3commas.row_data": "백테스트 데이터",
  "vs_3commas.row_data_p": "2년+ 시간봉 OHLCV + 수수료·슬리피지 모델링",
  "vs_3commas.row_data_other": "백테스팅 기능 제한적 — 주로 실거래 봇 도구",
  "vs_3commas.row_fees": "수수료 시뮬레이션",
  "vs_3commas.row_fees_p": "메이커/테이커 0.08% + 펀딩비 내장",
  "vs_3commas.row_fees_other":
    "실거래 수수료만 적용 (백테스트 수수료 모델 없음)",
  "vs_3commas.row_multi": "멀티코인 테스트",
  "vs_3commas.row_multi_p": "570개 코인 한 번에 테스트",
  "vs_3commas.row_multi_other": "봇 단위 설정, 배치 백테스트 불가",
  "vs_3commas.row_transparency": "실패 전략 공개",
  "vs_3commas.row_transparency_p": "공개 — 실패 전략도 데이터와 함께 표시",
  "vs_3commas.row_transparency_other": "해당 없음 — 실행 중심 도구",
  "vs_3commas.row_live": "실거래",
  "vs_3commas.row_live_p": "연구 도구 — 백테스트 전용",
  "vs_3commas.row_live_other": "가능 — DCA·그리드·Smart Trade 봇",
  "vs_3commas.row_builder": "전략 빌더",
  "vs_3commas.row_builder_p": "14개 지표, AND/OR 로직 시각적 빌더",
  "vs_3commas.row_builder_other": "DCA/그리드 봇 설정 패널",
  "vs_3commas.row_api": "API 접근",
  "vs_3commas.row_api_p": "무료 오픈 REST API",
  "vs_3commas.row_api_other": "유료 플랜에서 API 제공",
  "vs_3commas.row_community": "커뮤니티",
  "vs_3commas.row_community_p": "공개 랭킹 & 전략 리더보드",
  "vs_3commas.row_community_other": "봇 마켓플레이스 + 카피 트레이딩",
  "vs_3commas.why_title": "트레이더들이 3Commas 전에 PRUVIQ를 쓰는 이유",
  "vs_3commas.why_1_title": "자동화 전에 검증하세요",
  "vs_3commas.why_1_desc":
    "하락 추세 코인에 DCA 봇을 돌리면 설정과 무관하게 손실이 납니다. PRUVIQ로 570개 코인에서 실제 수수료를 반영해 가설을 먼저 검증하세요.",
  "vs_3commas.why_2_title": "실패도 공개합니다",
  "vs_3commas.why_2_desc":
    "PRUVIQ는 성공한 전략과 함께 실패한 전략도 공개합니다. 570개 코인 중 400개에서 실패한 전략을 보는 것이 선별된 성공 사례보다 가치 있습니다.",
  "vs_3commas.why_3_title": "연구 비용 $0",
  "vs_3commas.why_3_desc":
    "월 $15-110의 3Commas는 실거래 실행에 가치 있습니다. 하지만 전략이 통하지 않는다는 걸 확인하는 데 비용을 쓰는 건 비효율적입니다. PRUVIQ로 연구 단계를 무료로 처리하세요.",
  "vs_3commas.when_pruviq": "PRUVIQ를 선택하세요, 만약...",
  "vs_3commas.when_pruviq_1":
    "유료 봇 구독 전에 무료로 전략을 검증하고 싶을 때",
  "vs_3commas.when_pruviq_2": "하나의 전략을 570개 코인에 한 번에 테스트할 때",
  "vs_3commas.when_pruviq_3": "수수료·슬리피지·실패 포함 정직한 결과를 원할 때",
  "vs_3commas.when_pruviq_4": "구독이나 거래소 API 키 없이 연구를 시작할 때",
  "vs_3commas.when_other": "3Commas를 선택하세요, 만약...",
  "vs_3commas.when_other_1":
    "실거래소에서 24/7 DCA·그리드 봇 자동 실행이 필요할 때",
  "vs_3commas.when_other_2":
    "여러 거래소에 걸쳐 포트폴리오를 리밸런싱하고 싶을 때",
  "vs_3commas.when_other_3":
    "마켓플레이스에서 전략을 카피 트레이딩하고 싶을 때",
  "vs_3commas.when_other_4":
    "테이크프로핏·트레일링 스톱 Smart Trade 기능을 원할 때",
  "vs_3commas.best_together": "함께 쓰면 더 좋습니다",
  "vs_3commas.best_together_desc":
    "PRUVIQ로 전략을 무료로 연구하고 검증하세요. 그다음 검증된 전략을 3Commas에서 자동 실행하세요. 연구 먼저, 자동화는 나중에.",
  "vs_3commas.cta_title": "먼저 연구하고, 나중에 거래하세요",
  "vs_3commas.cta_desc":
    "봇 구독료를 내기 전에 570개 코인으로 전략을 무료로 백테스트하세요. 회원가입 불필요.",

  // 비교 페이지: Coinrule
  "meta.vs_coinrule_title": "PRUVIQ vs Coinrule — 무료 암호화폐 백테스트 대안",
  "meta.vs_coinrule_desc":
    "암호화폐 전략 백테스팅에서 PRUVIQ와 Coinrule을 비교하세요. 무료, IF-THEN 제한 없음, 570개 코인 + 실제 수수료 시뮬레이션.",
  "vs_coinrule.tag": "솔직한 비교",
  "vs_coinrule.title": "PRUVIQ vs Coinrule",
  "vs_coinrule.subtitle": "암호화폐 백테스팅 비교",
  "vs_coinrule.desc":
    "Coinrule은 IF-THEN 규칙으로 거래를 자동화하는 도구입니다. 전략을 실제로 배포하기 전에 수백 개 코인에 대해 엄격하게 백테스트하고 싶다면, PRUVIQ가 그 역할을 무료로 합니다.",
  "vs_coinrule.tldr": "한 줄 요약",
  "vs_coinrule.tldr_text":
    "Coinrule은 규칙 기반 자동화 도구입니다. PRUVIQ는 백테스팅 우선 연구 도구 — 무료, 코딩 불필요, 570개 코인, 슬리피지·수수료 내장.",
  "vs_coinrule.feature": "기능",
  "vs_coinrule.pruviq": "PRUVIQ",
  "vs_coinrule.other": "Coinrule",
  "vs_coinrule.row_price": "가격",
  "vs_coinrule.row_price_p": "$0 — 구독 없음",
  "vs_coinrule.row_price_other": "$29–449/월 (Starter–Unlimited)",
  "vs_coinrule.row_coding": "코딩 필요 여부",
  "vs_coinrule.row_coding_p": "코딩 불필요 — 시각적 빌더",
  "vs_coinrule.row_coding_other": "코딩 불필요 — IF-THEN 규칙 빌더",
  "vs_coinrule.row_coins": "지원 코인",
  "vs_coinrule.row_coins_p": "570개 코인 (바이낸스 선물)",
  "vs_coinrule.row_coins_other": "여러 거래소, 플랜에 따라 한도 상이",
  "vs_coinrule.row_data": "백테스트 데이터",
  "vs_coinrule.row_data_p": "실제 OHLCV + 수수료·슬리피지 반영",
  "vs_coinrule.row_data_other": "백테스팅 기능 제한적",
  "vs_coinrule.row_fees": "수수료 시뮬레이션",
  "vs_coinrule.row_fees_p": "메이커/테이커 0.08%, 펀딩비 포함",
  "vs_coinrule.row_fees_other": "거래소 경유 실거래 수수료만 적용",
  "vs_coinrule.row_multi": "멀티코인 테스트",
  "vs_coinrule.row_multi_p": "570개 코인 동시 테스트",
  "vs_coinrule.row_multi_other": "규칙은 코인별 실행, 배치 백테스트 불가",
  "vs_coinrule.row_live": "실거래",
  "vs_coinrule.row_live_p": "연구 도구 — 백테스트 전용",
  "vs_coinrule.row_live_other": "가능 — 자동 규칙 실행",
  "vs_coinrule.row_builder": "전략 빌더",
  "vs_coinrule.row_builder_p": "시각적 지표 빌더",
  "vs_coinrule.row_builder_other": "IF-THEN 조건 블록",
  "vs_coinrule.row_api": "API 접근",
  "vs_coinrule.row_api_p": "오픈 REST API",
  "vs_coinrule.row_api_other": "상위 플랜에서 제공",
  "vs_coinrule.row_community": "커뮤니티",
  "vs_coinrule.row_community_p": "공개 랭킹 & 리더보드",
  "vs_coinrule.row_community_other": "규칙 템플릿 라이브러리 및 커뮤니티",
  "vs_coinrule.when_pruviq": "PRUVIQ를 선택하세요, 만약...",
  "vs_coinrule.when_pruviq_1": "코딩 없이 무료로 암호화폐 백테스트를 원할 때",
  "vs_coinrule.when_pruviq_2": "570개 코인에 전략을 동시에 테스트하고 싶을 때",
  "vs_coinrule.when_pruviq_3":
    "수수료·슬리피지를 반영한 현실적인 결과를 원할 때",
  "vs_coinrule.when_pruviq_4": "투명한 백테스트 결과로 전략을 검증하고 싶을 때",
  "vs_coinrule.when_other": "Coinrule을 선택하세요, 만약...",
  "vs_coinrule.when_other_1":
    "코딩 없이 IF-THEN 로직으로 거래를 자동화하고 싶을 때",
  "vs_coinrule.when_other_2":
    "하나의 대시보드에서 여러 거래소를 연결하고 싶을 때",
  "vs_coinrule.when_other_3": "커뮤니티 규칙 템플릿을 바로 활용하고 싶을 때",
  "vs_coinrule.when_other_4": "24시간 자동 실거래 전략을 운영하고 싶을 때",
  "vs_coinrule.cta_title": "PRUVIQ 지금 무료로 시작하기",
  "vs_coinrule.cta_desc":
    "어떤 자동화 도구에 비용을 지불하기 전에 570개 코인으로 전략을 백테스트하세요. 회원가입 불필요.",

  // 비교 페이지: Cryptohopper
  "meta.vs_cryptohopper_title":
    "PRUVIQ vs Cryptohopper — 무료 암호화폐 백테스트 대안",
  "meta.vs_cryptohopper_desc":
    "암호화폐 전략 백테스팅에서 PRUVIQ와 Cryptohopper를 비교하세요. 무료, 클라우드 구독 불필요, 570개 코인 + 실제 수수료·슬리피지 시뮬레이션.",
  "vs_cryptohopper.tag": "솔직한 비교",
  "vs_cryptohopper.title": "PRUVIQ vs Cryptohopper",
  "vs_cryptohopper.subtitle": "백테스팅 연구 vs. 클라우드 자동매매 봇",
  "vs_cryptohopper.desc":
    "Cryptohopper는 전략 마켓플레이스를 갖춘 클라우드 기반 자동매매 플랫폼입니다. PRUVIQ는 전용 백테스팅 연구 도구입니다. 두 서비스 모두 암호화폐 트레이더를 위한 것이지만, 워크플로의 다른 단계에 있습니다.",
  "vs_cryptohopper.tldr": "한 줄 요약",
  "vs_cryptohopper.tldr_text":
    "Cryptohopper는 클라우드 봇으로 실거래 실행($24-107/월). PRUVIQ는 거래 전 전략 검증 — 무료, 코딩 불필요, 570개 코인, 실제 수수료·슬리피지 모델링. 연구 먼저, 자동화는 나중에.",
  "vs_cryptohopper.feature": "기능",
  "vs_cryptohopper.pruviq": "PRUVIQ",
  "vs_cryptohopper.other": "Cryptohopper",
  "vs_cryptohopper.row_price": "가격",
  "vs_cryptohopper.row_price_p": "$0 — 구독 없음 — $0/월",
  "vs_cryptohopper.row_price_other": "$24–107/월 (Explorer–Hero)",
  "vs_cryptohopper.row_annual": "연간 비용",
  "vs_cryptohopper.row_annual_p": "$0",
  "vs_cryptohopper.row_annual_other": "$288–1,284/년",
  "vs_cryptohopper.row_coding": "코딩 필요 여부",
  "vs_cryptohopper.row_coding_p": "코딩 불필요 — 시각적 지표 빌더",
  "vs_cryptohopper.row_coding_other":
    "코딩 불필요 — 템플릿 기반 + 마켓플레이스 전략",
  "vs_cryptohopper.row_coins": "지원 코인",
  "vs_cryptohopper.row_coins_p": "570개 코인 (바이낸스 USDT 선물)",
  "vs_cryptohopper.row_coins_other": "여러 거래소, 플랜에 따라 코인 수 상이",
  "vs_cryptohopper.row_data": "백테스트 데이터",
  "vs_cryptohopper.row_data_p": "2년+ 시간봉 OHLCV + 수수료·슬리피지 모델링",
  "vs_cryptohopper.row_data_other": "제한된 히스토리로 기본 백테스팅",
  "vs_cryptohopper.row_fees": "수수료 시뮬레이션",
  "vs_cryptohopper.row_fees_p": "메이커/테이커 0.08% + 펀딩비 내장",
  "vs_cryptohopper.row_fees_other":
    "실거래 실행 시 거래소 수수료 적용 (백테스트 수수료 모델 없음)",
  "vs_cryptohopper.row_multi": "멀티코인 테스트",
  "vs_cryptohopper.row_multi_p": "570개 코인 한 번에 테스트",
  "vs_cryptohopper.row_multi_other": "봇별 설정, 전체 코인 배치 백테스트 불가",
  "vs_cryptohopper.row_transparency": "실패 전략 공개",
  "vs_cryptohopper.row_transparency_p": "공개 — 실패 전략도 데이터와 함께 표시",
  "vs_cryptohopper.row_transparency_other":
    "마켓플레이스 리뷰만 — 실패 데이터 없음",
  "vs_cryptohopper.row_live": "실거래",
  "vs_cryptohopper.row_live_p": "연구 도구 — 백테스트 전용",
  "vs_cryptohopper.row_live_other": "가능 — 클라우드 봇, 시그널 봇, 마켓메이킹",
  "vs_cryptohopper.row_builder": "전략 빌더",
  "vs_cryptohopper.row_builder_p": "14개 지표, AND/OR 로직 시각적 빌더",
  "vs_cryptohopper.row_builder_other": "템플릿 디자이너 + 마켓플레이스 전략",
  "vs_cryptohopper.row_api": "API 접근",
  "vs_cryptohopper.row_api_p": "무료 오픈 REST API",
  "vs_cryptohopper.row_api_other": "유료 플랜에서 API 제공",
  "vs_cryptohopper.row_community": "커뮤니티",
  "vs_cryptohopper.row_community_p": "공개 랭킹 & 전략 리더보드",
  "vs_cryptohopper.row_community_other": "전략 마켓플레이스 (구매/판매)",
  "vs_cryptohopper.why_title":
    "트레이더들이 Cryptohopper 전에 PRUVIQ를 쓰는 이유",
  "vs_cryptohopper.why_1_title": "구독 전에 검증하세요",
  "vs_cryptohopper.why_1_desc":
    "월 $24-107의 Cryptohopper는 투자입니다. PRUVIQ로 570개 코인에서 전략 아이디어를 무료로 검증한 뒤 구독을 결정하세요.",
  "vs_cryptohopper.why_2_title": "마켓플레이스 전략도 검증이 필요합니다",
  "vs_cryptohopper.why_2_desc":
    "Cryptohopper 마켓플레이스는 전략 설명을 보여주지만 백테스트 증거는 제한적입니다. PRUVIQ로 어떤 전략 로직이든 수백 개 코인에서 실제 수수료를 반영해 독립적으로 검증하세요.",
  "vs_cryptohopper.why_3_title": "투명한 실패가 신뢰를 만듭니다",
  "vs_cryptohopper.why_3_desc":
    "PRUVIQ는 성공한 전략과 함께 실패한 전략도 공개합니다. 전략이 어디서 깨지는지 아는 것은 어디서 이기는지 아는 것만큼 가치 있습니다.",
  "vs_cryptohopper.when_pruviq": "PRUVIQ를 선택하세요, 만약...",
  "vs_cryptohopper.when_pruviq_1":
    "클라우드 봇 구독 전에 무료로 전략을 연구하고 싶을 때",
  "vs_cryptohopper.when_pruviq_2":
    "마켓플레이스 전략 아이디어를 570개 코인에서 검증하고 싶을 때",
  "vs_cryptohopper.when_pruviq_3":
    "수수료·슬리피지·실패 포함 정직한 결과를 원할 때",
  "vs_cryptohopper.when_pruviq_4": "거래소 API 키나 계정 없이 연구를 시작할 때",
  "vs_cryptohopper.when_other": "Cryptohopper를 선택하세요, 만약...",
  "vs_cryptohopper.when_other_1":
    "PC를 켜 두지 않아도 되는 24/7 클라우드 봇이 필요할 때",
  "vs_cryptohopper.when_other_2":
    "마켓플레이스에서 완성된 전략을 구매하고 싶을 때",
  "vs_cryptohopper.when_other_3":
    "서드파티 시그널 제공업체와 자동 거래를 연동하고 싶을 때",
  "vs_cryptohopper.when_other_4":
    "여러 거래소에서 동시에 자동 실행하고 싶을 때",
  "vs_cryptohopper.best_together": "함께 쓰면 더 좋습니다",
  "vs_cryptohopper.best_together_desc":
    "PRUVIQ로 전략을 무료로 연구하고 검증하세요. 그다음 검증된 전략을 Cryptohopper에서 클라우드 자동 실행하세요. 연구 먼저, 자동화는 나중에.",
  "vs_cryptohopper.cta_title": "먼저 연구하고, 나중에 거래하세요",
  "vs_cryptohopper.cta_desc":
    "클라우드 봇 구독 전에 570개 코인으로 전략을 무료로 테스트하세요. 회원가입 불필요.",

  // 비교 페이지: Gainium
  "meta.vs_gainium_title": "PRUVIQ vs Gainium — 무료 암호화폐 백테스트 대안",
  "meta.vs_gainium_desc":
    "암호화폐 전략 백테스팅에서 PRUVIQ와 Gainium을 비교하세요. 무료, DCA 전용 제약 없음, 570개 코인 + 실제 슬리피지·수수료 시뮬레이션.",
  "vs_gainium.tag": "솔직한 비교",
  "vs_gainium.title": "PRUVIQ vs Gainium",
  "vs_gainium.subtitle": "암호화폐 백테스팅 비교",
  "vs_gainium.desc":
    "Gainium은 바이낸스 중심의 DCA 봇과 포트폴리오 관리에 특화된 도구입니다. 자본을 투입하기 전에 수백 개 코인에서 전략을 엄밀하게 검증하고 싶다면, PRUVIQ가 그 연구 레이어를 무료로 제공합니다.",
  "vs_gainium.tldr": "한 줄 요약",
  "vs_gainium.tldr_text":
    "Gainium은 DCA 실행과 포트폴리오 관리에 집중합니다. PRUVIQ는 연구 우선 백테스팅 도구 — 무료, 코딩 불필요, 570개 코인, 실제 비용 시뮬레이션.",
  "vs_gainium.feature": "기능",
  "vs_gainium.pruviq": "PRUVIQ",
  "vs_gainium.other": "Gainium",
  "vs_gainium.row_price": "가격",
  "vs_gainium.row_price_p": "$0 — 구독 없음",
  "vs_gainium.row_price_other": "$49+/월",
  "vs_gainium.row_coding": "코딩 필요 여부",
  "vs_gainium.row_coding_p": "코딩 불필요 — 시각적 빌더",
  "vs_gainium.row_coding_other": "코딩 불필요 — DCA 봇 설정",
  "vs_gainium.row_coins": "지원 코인",
  "vs_gainium.row_coins_p": "570개 코인 (바이낸스 선물)",
  "vs_gainium.row_coins_other": "바이낸스 중심, 선별된 코인 목록",
  "vs_gainium.row_data": "백테스트 데이터",
  "vs_gainium.row_data_p": "실제 OHLCV + 수수료·슬리피지 반영",
  "vs_gainium.row_data_other": "DCA 시뮬레이션, 히스토리 깊이 제한적",
  "vs_gainium.row_fees": "수수료 시뮬레이션",
  "vs_gainium.row_fees_p": "메이커/테이커 0.08%, 펀딩비 포함",
  "vs_gainium.row_fees_other": "실거래 실행 시 수수료 적용",
  "vs_gainium.row_multi": "멀티코인 테스트",
  "vs_gainium.row_multi_p": "570개 코인 동시 테스트",
  "vs_gainium.row_multi_other": "포트폴리오 뷰, 배치 백테스트 불가",
  "vs_gainium.row_live": "실거래",
  "vs_gainium.row_live_p": "연구 도구 — 백테스트 전용",
  "vs_gainium.row_live_other": "가능 — 포트폴리오 추적 포함 DCA 봇",
  "vs_gainium.row_builder": "전략 빌더",
  "vs_gainium.row_builder_p": "시각적 지표 빌더",
  "vs_gainium.row_builder_other": "DCA 파라미터 설정",
  "vs_gainium.row_api": "API 접근",
  "vs_gainium.row_api_p": "오픈 REST API",
  "vs_gainium.row_api_other": "유료 플랜에서 제공",
  "vs_gainium.row_community": "커뮤니티",
  "vs_gainium.row_community_p": "공개 랭킹 & 리더보드",
  "vs_gainium.row_community_other": "커뮤니티 및 봇 설정 공유",
  "vs_gainium.when_pruviq": "PRUVIQ를 선택하세요, 만약...",
  "vs_gainium.when_pruviq_1": "코딩 없이 무료로 암호화폐 백테스트를 원할 때",
  "vs_gainium.when_pruviq_2": "570개 코인에 전략을 동시에 테스트하고 싶을 때",
  "vs_gainium.when_pruviq_3":
    "수수료·슬리피지를 반영한 현실적인 결과를 원할 때",
  "vs_gainium.when_pruviq_4": "투명한 백테스트 결과로 전략을 검증하고 싶을 때",
  "vs_gainium.when_other": "Gainium을 선택하세요, 만약...",
  "vs_gainium.when_other_1": "자동 평균단가 분할 매수(DCA) 봇이 필요할 때",
  "vs_gainium.when_other_2":
    "바이낸스에서 포트폴리오 관리 대시보드가 필요할 때",
  "vs_gainium.when_other_3": "봇별 성과 추적과 분석이 필요할 때",
  "vs_gainium.when_other_4": "수동 주문 없이 자동 실거래를 운영하고 싶을 때",
  "vs_gainium.cta_title": "PRUVIQ 지금 무료로 시작하기",
  "vs_gainium.cta_desc":
    "DCA 봇을 배포하기 전에 570개 코인으로 전략을 무료로 리서치하세요. 회원가입 불필요.",

  // 비교 페이지: Streak
  "meta.vs_streak_title": "PRUVIQ vs Streak — 무료 암호화폐 백테스트 대안",
  "meta.vs_streak_desc":
    "암호화폐 전략 백테스팅에서 PRUVIQ와 Streak을 비교하세요. 무료, Pine Script 불필요, 570개 코인 + 실제 수수료·슬리피지 시뮬레이션.",
  "vs_streak.tag": "솔직한 비교",
  "vs_streak.title": "PRUVIQ vs Streak",
  "vs_streak.subtitle": "암호화폐 백테스팅 비교",
  "vs_streak.desc":
    "Streak은 TradingView와 연동되는 백테스팅 도구로, Pine Script 사용과 프리미엄 구독이 필요합니다. 코딩이나 월 구독료 없이 전략 아이디어를 검증하고 싶다면 PRUVIQ가 대안입니다.",
  "vs_streak.tldr": "한 줄 요약",
  "vs_streak.tldr_text":
    "Streak은 Pine Script와 TradingView를 이미 쓰는 고급 사용자를 위한 도구입니다. PRUVIQ는 코딩 실력이나 구독 없이도 엄밀한 백테스팅을 원하는 모든 사람을 위한 도구입니다.",
  "vs_streak.feature": "기능",
  "vs_streak.pruviq": "PRUVIQ",
  "vs_streak.other": "Streak",
  "vs_streak.row_price": "가격",
  "vs_streak.row_price_p": "$0 — 구독 없음",
  "vs_streak.row_price_other": "$79+/월",
  "vs_streak.row_coding": "코딩 필요 여부",
  "vs_streak.row_coding_p": "코딩 불필요 — 시각적 빌더",
  "vs_streak.row_coding_other": "Pine Script 필요 (TradingView 연동 필수)",
  "vs_streak.row_coins": "지원 코인",
  "vs_streak.row_coins_p": "570개 코인 (바이낸스 선물)",
  "vs_streak.row_coins_other": "TradingView 데이터 연동에 따라 상이",
  "vs_streak.row_data": "백테스트 데이터",
  "vs_streak.row_data_p": "실제 OHLCV + 수수료·슬리피지 반영",
  "vs_streak.row_data_other": "Pine Script 통해 TradingView 히스토리 데이터",
  "vs_streak.row_fees": "수수료 시뮬레이션",
  "vs_streak.row_fees_p": "메이커/테이커 0.08%, 펀딩비 포함",
  "vs_streak.row_fees_other": "Pine Script에서 수동 설정 필요",
  "vs_streak.row_multi": "멀티코인 테스트",
  "vs_streak.row_multi_p": "570개 코인 동시 테스트",
  "vs_streak.row_multi_other": "TradingView에서 차트 하나씩 확인",
  "vs_streak.row_live": "실거래",
  "vs_streak.row_live_p": "연구 도구 — 백테스트 전용",
  "vs_streak.row_live_other": "가능 — 라이브 알림 및 자동 주문",
  "vs_streak.row_builder": "전략 빌더",
  "vs_streak.row_builder_p": "시각적 지표 빌더",
  "vs_streak.row_builder_other": "Pine Script 에디터 (고급 사용자용)",
  "vs_streak.row_api": "API 접근",
  "vs_streak.row_api_p": "오픈 REST API",
  "vs_streak.row_api_other": "TradingView 웹훅 경유",
  "vs_streak.row_community": "커뮤니티",
  "vs_streak.row_community_p": "공개 랭킹 & 리더보드",
  "vs_streak.row_community_other": "TradingView 커뮤니티 스크립트",
  "vs_streak.when_pruviq": "PRUVIQ를 선택하세요, 만약...",
  "vs_streak.when_pruviq_1": "코딩 없이 무료로 암호화폐 백테스트를 원할 때",
  "vs_streak.when_pruviq_2": "570개 코인에 전략을 동시에 테스트하고 싶을 때",
  "vs_streak.when_pruviq_3": "수수료·슬리피지를 반영한 현실적인 결과를 원할 때",
  "vs_streak.when_pruviq_4": "투명한 백테스트 결과로 전략을 검증하고 싶을 때",
  "vs_streak.when_other": "Streak을 선택하세요, 만약...",
  "vs_streak.when_other_1":
    "Pine Script 전략을 TradingView와 깊이 연동하고 싶을 때",
  "vs_streak.when_other_2": "표준 지표 이상의 고급 커스텀 지표가 필요할 때",
  "vs_streak.when_other_3": "라이브 알림과 자동 주문 실행이 필요할 때",
  "vs_streak.when_other_4": "암호화폐 선물 이외 다양한 자산군을 다루고 싶을 때",
  "vs_streak.cta_title": "PRUVIQ 지금 무료로 시작하기",
  "vs_streak.cta_desc":
    "Pine Script도, TradingView 계정도, 구독료도 필요 없습니다. 570개 코인으로 실제 결과를 몇 초 만에 확인하세요.",

  // SEO landing pages
  "meta.best_backtesting_title":
    "2026년 최고의 무료 크립토 백테스팅 플랫폼 | PRUVIQ",
  "meta.best_backtesting_desc":
    "2026년 최고의 크립토 백테스팅 플랫폼을 비교하세요. PRUVIQ는 570개 이상 코인, 실제 수수료, 투명한 실패 데이터를 갖춘 무료 노코드 백테스팅을 제공합니다.",
  "meta.crypto_simulator_title":
    "무료 크립토 트레이딩 시뮬레이터 — 회원가입 불필요 | PRUVIQ",
  "meta.crypto_simulator_desc":
    "무료 시뮬레이터로 크립토 트레이딩을 연습하세요. 570개 이상 코인, 실제 수수료, 36개 전략, 2년 이상의 과거 데이터로 테스트할 수 있습니다.",
  "meta.why_backtests_fail_title":
    "백테스트가 실패하는 이유 — 그리고 피하는 방법 | PRUVIQ",
  "meta.why_backtests_fail_desc":
    "크립토 백테스트가 실패하는 5가지 이유: look-ahead bias, 생존자 편향, 과적합, 수수료 무시, 시장 레짐 변화. PRUVIQ가 각각을 어떻게 해결하는지 알아보세요.",
  // 404
  "404.title": "404 - 페이지를 찾을 수 없습니다 | PRUVIQ",
  "404.desc":
    "페이지를 찾을 수 없습니다. PRUVIQ의 무료 크립토 전략 백테스팅 도구를 살펴보세요.",
  "404.heading": "이 페이지는 존재하지 않습니다",
  "404.subtext": "하지만 잘못된 백테스트와 달리, 존재하는 척하지 않겠습니다.",
  "404.tagline": "Don't Believe. Verify.",
  "404.back_home": "홈으로 돌아가기",
  "404.open_simulator": "시뮬레이터 열기",
  "404.or_try": "이것도 살펴보세요",
};
