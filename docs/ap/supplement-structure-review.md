# 보강(supplement) 신규 통과 항목의 문항군 구조 판정 (2026-10-09, 무료·읽기 전용)

기준은 `family-structure-review.md` 와 `lib/ap-exam/look-alike.ts` 그대로다(오너 결정 7): **숫자·문구·아키타입 코드만 다른 변형은 새 독립 문항군이 아니다. 구하는 양과 풀이 골격이 다르거나 독립 단계(연쇄법칙 추가·부호 분석·다른 정리·수치 풀이 단계)가 더해지면 독립이다. 애매하면 보수적으로 같은 군으로 묶는다.** 기준을 완화해 세트를 채우지 않았다. 판정 데이터는 `data/ap/stock/structure-groups.json`(보강 항목 5묶음 추가), 재고 수치는 `npx tsx scripts/ap-generation/reserve-plan.ts --strict-families`·`supplement-status.ts` 로 재현한다.

## 결과 요약
| 구분 | MC | FRQ 묶음 |
|---|---|---|
| 신규 통과(고유 문항) | **39** (아키타입 33종) | **10** (유형 7종) |
| 독립 구조 문항군(새 군) | **28** | **6**(새 유형) |
| 독립 군의 형제(같은 군에 수치만 다른 두 번째 묶음) | 3 (`c_closest_point_calc`·`c_implicit_horizontal_tangent_calc`·`c_ftc_second_derivative_calc`) | 3 (`frq_table_values`·`frq_bc_taylor_diffeq`·`frq_piecewise_diff` 의 두 번째) |
| 기존 군에 보수적으로 합류(새 군 아님) | 8문항 / 아키타입 5종 (아래 표) | 1 (`frq_polar_region` — 기존 유형의 새 수치 묶음) |
- 재고 전체 MC 문항군 군집: 구조 묶음 반영 **111 → 139**(+28 = 독립 28). 그래프 필수 군집은 48 그대로(그래프 문항을 만들지 않았다).
- 위 28은 **엄격 기준(경계 사례를 독립으로 인정)** 이다. 아래 "경계 사례 8종"을 모두 기존 군에 묶으면 독립은 **20**(보수 하한)이 된다. 5세트 배정은 엄격 묶음(`--strict-families`)으로 계산했고, 경계 사례 8종은 독립으로 두었다(질문·풀이 단계가 다름이 문서화된 경우).

## 기존 군에 합류시킨 아키타입 5종(structure-groups.json 에 묶음 추가, 새 독립 군 아님)
| 신규 아키타입 | 합류 대상 | 근거 | 문항 |
|---|---|---|---|
| `c_optimization_rect_calc` | `optimization` (5.11) | 곡선 아래 y축 대칭 직사각형 최대 넓이 — 포물선(손 계산) → 코사인(계산기), 같은 질문·골격 | 2 |
| `c_fastest_increase_calc` | `c_inflection_calc` (5.6) | M″=0 의 근을 수치로 풀어 구한다 — 변곡점의 x 와 "변화율 최대 시각"은 같은 점 | 2 |
| `c_total_distance_calc` | `g_total_distance_graph` (8.2) | 총 이동거리 ∫\|v\| (속도 그래프 → 식, 부호 바뀌는 점에서 분할) | 1 |
| `c_increasing_interval_calc` | `c_accum_interval_calc` (경계 사례) | 도함수(피적분함수 ↔ f′) 영점을 수치로 찾아 증가 구간 선택 | 2 |
| `c_accum_max_value_calc` | `g_abs_max_fprime` (경계 사례) | f′ 정보에서 부호 바뀌는 점을 찾아 f 의 최댓값을 ∫ 로 — 그래프 → 식+계산기 | 1 |

## 독립으로 인정한 아키타입 28종(문항군) — 근거
| 아키타입 | 토픽·계산기 | 기존/신규와 다른 점(구하는 양·풀이 골격) |
|---|---|---|
| `c_lagrange_min_degree_calc` ⚑ | 10.12 계산기 | 라그랑주 한계가 허용오차보다 작아지는 **최소 n** 을 n 을 올려 가며 찾는다(`lagrange_error` 는 한계 값 계산) |
| `c_taylor_actual_error_calc` | 10.11 계산기 | 실제 오차 \|f−P\| (한계가 아님) |
| `c_series_integral_calc` | 10.15 계산기 | 급수 세 항을 항별 적분해 정적분 근사 |
| `c_taylor_from_diffeq_calc` ⚑ | 10.11 계산기 | 미분방정식에서 연쇄법칙으로 f′(0)·f″(0)·f‴(0)을 얻는 **독립 단계** 뒤 다항식 평가(`taylor_table` 은 표의 도함수 값) |
| `c_integral_test_bound_calc` | 10.4 계산기 | 부분합 + 꼬리 적분으로 합의 상계 |
| `c_geometric_terms_needed_calc` | 10.2 계산기 | 나머지 a rⁿ/(1−r) < 허용오차의 최소 항 수(`geometric_sum` 은 합 값) |
| `c_series_recognize_sum` | 10.15 | 알려진 매클로린 급수(ln(1+x)·arctan)로 수치 급수의 합을 알아본다 |
| `c_term_diff_sum` | 10.15 | 항별 미분 후 등비급수 합 |
| `c_ratio_limit_e` | 10.8 | n!·nⁿ 비율 극한 → 1/e |
| `c_partial_sum_term` | 10.1 | 부분합 공식에서 항 a_m = S_m − S_{m−1} |
| `c_telescoping_sum` | 10.1 | 부분분수·망원급수 합 |
| `c_integral_test_choice` | 10.4 | 네 급수 중 적분 판정법으로 수렴이 보이는 것(`series_test` 는 한 급수의 진술 선택) |
| `c_comparison_benchmark` | 10.6 | 극한 비교 판정법의 비교 급수·결론 |
| `c_alt_test_choice` | 10.7 | 교대급수 판정법의 조건(감소·0 수렴) 확인 |
| `c_series_limit_eval` | 10.14 | 매클로린 급수로 부정형 극한 계산 |
| `c_bc_logistic_time_calc` | 7.9 계산기 | 로지스틱 해로 목표 크기에 도달하는 **시각**(`logistic` 은 최대 성장 지점) |
| `c_bc_vector_speed_max_calc` ⚑ | 9.6 계산기 | 속력의 **최댓값**(후보 검사) — `param_speed_*` 는 한 시각의 속력 |
| `c_bc_polar_between_calc` | 9.9 계산기 | 두 극곡선 사이 — 교점 각 + r² 차(단일 곡선 `polar_area_*` 와 독립 단계 둘) |
| `c_bc_polar_slope_calc` | 9.7 계산기 | 극곡선 접선 기울기 (r′ 부호 문항과 다름) |
| `c_critical_count_calc` | 5.2 계산기 | f′ = 0 의 해 개수 |
| `c_closest_point_calc` | 5.11 계산기 | 곡선 위 한 점까지의 최소 거리(제곱 거리 최소화) |
| `c_implicit_horizontal_tangent_calc` | 5.12 계산기 | dy/dx = 0 → 관계식을 곡선에 대입해 점 찾기 |
| `c_ftc_second_derivative_calc` ⚑ | 6.4 계산기 | F″ = 피적분함수의 도함수(`c_ftc_chain_calc` 는 연쇄 FTC) |
| `c_integral_equation_solve_calc` | 6.7 계산기 | ∫₀ᵏ f = m 의 상한 k 를 수치로 푼다 |
| `c_limit_def_derivative_calc` ⚑ | 2.2 계산기 | 차분 몫의 극한을 도함수로 **알아보는** 단계(곱·몫의 법칙 함수) |
| `c_tangent_x_intercept_calc` | 2.7 계산기 | 접선의 x 절편 |
| `c_related_rates_angle_calc` | 4.5 계산기 | tan θ = h/d 의 시간 미분(각도 관련 변화율; 원뿔 부피 문항과 관계식이 다름) |
| `c_max_speed_calc` | 4.2 계산기 | \|v\| 의 최댓값 후보 검사(`c_motion_turn_calc` 는 v=0 시각) |
- ⚑ = **경계 사례 8종**(기존 군과 같은 기본 양에 독립 단계 하나가 더해진 경우): 위 ⚑ 5종 + 기존 군 후보 3종(`c_integral_test_choice`·`c_comparison_benchmark`·`c_alt_test_choice` 는 `series_test` 와 토픽·질문이 다르다고 보아 독립으로 셈; 같은 판정법 모음으로 묶으면 독립이 3 줄어든다). 엄격 기준(독립 인정)이 28, 모두 묶으면 20.

## FRQ 유형 판정(유형 = 번들 구조, 같은 유형의 다른 수치는 형제)
| 유형 | 새 독립 유형? | 통과 묶음 | 비고 |
|---|---|---|---|
| `frq_table_values`(AB 불가) | 예 — 표 값으로 합성·몫·평균변화율+MVT·사다리꼴(`frq_table_rate` 는 모형 평균·IVT·좌합) | 2 | 두 번째는 형제 |
| `frq_function_analysis`(AB 불가) | 예 — 식으로 접선·극값·변곡·닫힌 구간 극값(`frq_fprime_graph` 는 f′ 그래프) | 1 | 두 번째 묶음은 근접 중복 게이트(문장 3-gram 유사도 > 0.8)로 반려 |
| `frq_piecewise_diff`(AB 불가) | 예 — 조각 함수의 연속·미분 가능(편측 도함수)·접선·도함수 평균 | 2 | 두 번째는 형제 |
| `frq_model_analysis_calc`(AB 계산기) | 예 — 약물 농도 모형: 평균값·C′ 의미·최댓값·기준 이상 시간 구간 | 1 | |
| `frq_bc_taylor_diffeq`(BC 불가) | 예 — 미분방정식의 테일러 다항식·근삿값·라그랑주·2계 판정(`frq_series` 는 급수 일반항·수렴 구간) | 2 | 두 번째는 형제 |
| `frq_bc_improper_parts`(BC 불가) | 예 — 이상적분·부분적분·최대 속도·상수 맞추기 | 1 | 두 번째 묶음은 근접 중복으로 반려 |
| `frq_polar_region`(BC 계산기) | 아니오 — 기존 유형의 새 수치 묶음 | 1 | 신규 유형 `frq_rate_in_out` 이 기출 유사로 두 번(v1 2건, v2 2건) 반려돼 **중단**하고 청사진이 있는 기존 계산기 유형으로 대체 |
- `frq_table_rate`·`frq_area_volume`·`frq_particle_motion`·`frq_parametric` 은 구형 원형(설계도 없음)이라 현재 게이트(`missing_blueprint`·`part_*_references_missing_part_i`)를 통과하지 못해 사용하지 않았다.
