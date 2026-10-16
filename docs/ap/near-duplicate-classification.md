# 근사 중복 6건 개별 분류 (2026-10-09)

근사 중복 게이트(`duplicate_gate_near_duplicate`)로 반려돼 있던 6건을 **일괄 반려도 일괄 독립 인정도 하지 않고** 각각 정본과 대조했다(`data/ap/stock/near-dup-classification.json`, 후보 ID·사유 포함; `stock.ts` 가 읽음). 모두 전체 게이트(결정적·독립 풀이·검토·난이도)는 통과한 후보이며 근사 중복 게이트만 걸렸다. 기준: 숫자·문구 변형 = 같은 문항군(보존), 풀이 구조·스킬이 다르면 독립, 내용이 같으면 완전 중복(재고 정책상 제외).

| 후보 | 정본 | 대조 결과 | 분류 | 최종 재고 상태 |
|---|---|---|---|---|
| run2 AB m06-k3 (diff_cont) | m06-k1 | 같은 함수·같은 문항·같은 키, 보기 순서만 다름 | **완전 중복** | exact_duplicate |
| run2 AB m15-k3 (mvt_calc) | m15-k1 | 같은 함수·같은 c 값, 오답 구성만 다름 | 같은 문항군 변형 | auto_passed(문항군 보존, 군당 유효 2개 상한) |
| run2 AB m25-k3 (slope_field_match) | m25-k1 | 같은 표·같은 키, 오답 조합만 다름 | 같은 문항군 변형 | auto_passed(문항군 보존) |
| run2 AB f03-k1 (frq_diffeq) | f03-k0 | 같은 FRQ 템플릿, 상수만 다름(H−10 vs H−20, 초기 기울기 −6 vs −5) = 숫자 변형 | 같은 문항군 변형 | auto_passed(문항군 보존) |
| run2bc BC m02-k3 (partial_fractions) | m02-k1 | 같은 적분·같은 보기 집합(순서만 다름) | **완전 중복** | exact_duplicate |
| run2bc BC m16-k3 (lagrange_error) | m16-k1 | 같은 문항·같은 보기 집합 | **완전 중복** | exact_duplicate |
스킬·풀이 구조가 정본과 다른 "독립 문항"은 6건 중 0건이다(모두 같은 원형·같은 토픽·같은 스킬·같은 풀이). 결과: 완전 중복 3건은 재고에서 제외(이력 유지), 문항군 변형 3건은 같은 문항군으로 보존.
