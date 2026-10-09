# 신규 통과 MC 69건 문항군 구조 판정 (2026-10-09, 무료·읽기 전용)

질문: 69건이 아키타입 코드만 다른 변형이 아니라 **지문(자료)·질문·사고 단계·풀이 구조**가 실제로 다른 문항군인가? 재현: `npx tsx scripts/ap-generation/graph-family-review.ts`(판정표), 근거 데이터 `data/ap/stock/structure-groups.json`.

## 방법과 기준
1. 사전 점검(`graph-precheck.ts`/`look-alike.ts`)은 문항군 ID·문제문 틀·아키타입+사고 단계 동일 + 문장 Jaccard ≥ 0.7 만 걸러 신규끼리·기존과 0건이었다. 하지만 이는 **문장 중심**이고 자료 종류가 다르면(표 ↔ 그래프) 다른 틀로 본다.
2. 이번에는 신규 69건 × 전체 MC 재고(기존 261 + 신규 69) 쌍에서 단원.토픽이 같거나 문제문·사고 단계 유사도(Jaccard)가 0.3 이상인 460쌍을 뽑아, 질문(구하는 양)·사고 단계 골격·자료 구조를 **읽고** 판정했다(상위 유사 쌍 26개는 전부, 같은 토픽 쌍은 전수).
3. 판정 기준(검토자 판단 — 기준을 바꾸면 결과가 바뀐다):
   - **N 독립 구조**: 구하는 양과 풀이 골격이 다른 모든 문항과 다르다(독립 단계가 더해지는 경우 포함: 연쇄법칙 추가, 부호 분석, 다른 정리).
   - **R-기존**: 기존 재고 아키타입과 **같은 질문·같은 풀이 골격**이고 자료 표현(표 → 그래프, 식 → 그래프, 계산기 유무)·숫자·반복 횟수만 다르다 → 새 문항군이 아니다(기존 군에 합류).
   - **R-신규**: 다른 신규 문항과 같은 질문·골격에 도형 상수·회전축·마지막 단계 연장만 다르다 → 묶음 대표 1건만 새 문항군이다.
   - 공유 아키타입 **코드**는 허용되지만 이번에는 69건 모두 코드가 서로 다르다(신규끼리·기존과 공유 0). 같은 질문·골격이면 코드가 달라도 변형으로 센다.

## 결과 (신규 통과 MC 69건)
| 판정 | 건수 | 의미 |
|---|---|---|
| N 독립 구조 | **30** | 새 문항군 |
| R-기존 | **33** | 기존 재고 아키타입의 표현 변형(새 문항군 아님) |
| R-신규 | **6** | 신규 내 변형(대표 N 이 이미 센 문항군) |
| 합계 | 69 | |
- **교정된 고유 문항군 수: 아키타입 코드 기준 69 → 구조 기준 독립 30**(R-신규 6건은 묶음 대표 N 에 흡수, R-기존 33건은 기존 문항군에 합류).
- 재고 전체(게시 AB#1 제외 MC 288건)의 문항군 군집 수: 기본 판정(사전 점검 군집) 152 → **구조 묶음 반영 111**(`reserve-plan.ts` 출력). 그래프 필수 MC 71건은 65군집 → 48군집.
- 영향: 이 판정을 "문항군 상한 1"에 그대로 적용해도(`--strict-families`) **BC#1 + AB#2 는 가상 문항 0 으로 조립 가능**하고 5세트 부족은 MC 2 로 같다(`exact-assignment-report.md`). 다만 **새 구조 문항군이 부족한 칸(예: BC 단원 10)** 은 군집이 줄어 더 빨리 막힌다. 앞으로 신규 생성은 "표현만 바꾼 그래프판"이 아니라 **독립 구조**를 기준으로 계획해야 한다(그래프 필수 하한 충족에는 그래프판 변형도 쓸 수 있으나 문항군 다양성에는 기여하지 않는다).

## 묶음(구조 동일) 목록과 근거
| 묶음(아키타입) | 근거 |
|---|---|
| riemann_table, g_riemann_left_graph, g_riemann_mixed_calc, c_midpoint_sum_calc | 리만 합 평가: 너비·점 찾기 → 값 읽기/계산 → 너비 곱(표→그래프→식+계산기, 좌/우/중점만 다름) |
| avg_value_calc, g_avg_value_graph, g_avg_value_mixed_calc | 평균값 = 적분/(b−a) |
| chain_table, g_chain_two_graphs, g_chain_mixed_calc | h=f(g(x)) 의 h'(a)=f'(g(a))·g'(a), 값을 읽는 자료만 다름 |
| inflection_count, g_fprime_inflection | 변곡점 개수(식 부호 변화 → f' 그래프) |
| accum_context_calc, g_inflow_outflow_graph | 초기량 + ∫속도 |
| prop_integrals, g_integral_mixed_calc, g_integral_properties_graph | 정적분 선형성/성질 |
| lhopital, g_lhopital_graph | 0/0 에서 로피탈 |
| product_table, g_product_two_graphs / quotient_rule_eval, g_quotient_two_graphs | 곱·몫 미분 값 평가(표 → 그래프) |
| linearization, g_tangent_approx_fprime_graph, c_linear_approx_overunder_calc, g_tangent_line_value_graph, g_linearization_composite_calc | 접선 근사값(+과대/과소) |
| volume_calc, g_volume_curve_line_calc | 두 곡선 사이 밑면 정사각형 단면 부피 |
| separable_particular, diffeq_value_calc, g_separable_graph_calc | 변수분리 특수해 값 |
| euler_method, g_euler_graph, c_bc_euler_calc | 오일러 방법 반복 근사(기울기 자료·단계 수만 다름) |
| lagrange_graph, g_lagrange_decimal_calc, g_lagrange_p2_calc | 그래프에서 최대 \|f^(n+1)\| 읽어 라그랑주 오차 한계 |
| param_dydx, g_param_dydx_graphs / param_speed_table·param_speed_calc, g_param_speed_graphs / param_xvel_graph, g_vector_displacement_graph | 매개변수 dy/dx · 속력 · 속도 성분 그래프 넓이로 위치 |
| ftc_accum, c_ftc_chain_calc / implicit_slope, c_implicit_slope_calc / graph_accum_value, g_accum_two_values / graph_fprime_extremum, g_extrema_count_fprime / ivt, g_ivt_graph / usub_integral, g_usub_graph | 같은 질문·풀이, 자료만 다름 |
| 신규끼리: g_exp_growth_constant+g_exp_value_calc; g_fprime_inc_concave+g_accum_justify_graph; g_avg_roc_graph+g_avg_roc_mixed_calc; g_volume_base_graph+g_volume_semicircle_graph+g_volume_triangle_graph; g_washer_curve_line_calc+g_volume_axis_shift_calc | 같은 그림·골격(도형 상수 1·π/8·√3/4, 회전축 x축→y=−2 등) |
- **경계 사례(검토자 판단 필요)**: g_avg_value_*·g_integral_*·g_riemann_mixed_calc 처럼 "그래프 + 식(계산기)"가 섞여 풀이에 **수치 적분 한 단계**가 더해지는 것은 골격이 같다고 보아 R-기존으로 세었다. 이 단계를 독립 구조로 인정하면 R-기존 33 중 약 6~8건이 N 으로 올라간다(독립 구조 30 → 최대 약 38). 어느 쪽이든 BC#1·AB#2 가 0 부족이라는 결론은 같다.
- 독립 N 으로 인정한 유사 쌍(근거): 리만 좌합 vs **사다리꼴(불균등 폭)**(규칙·폭 계산이 다름), 곱 vs 몫 미분(규칙이 다른 토픽), chain_two_graphs vs 매개변수 dy/dx(다른 정리), 원판 vs 와셔 vs 정사각형 단면(고체 구성이 다름), 접선 근사 vs 함수값 평가 등.

## 문항별 판정표 (신규 통과 MC 69건)
|---|---|---|---|---|---|
| s1-graph-ab:ab-m01-k0 | g_abs_max_fprime | 5.5 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m02-k0 | g_accum_reverse_extremum | 6.5 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m05-k0 | g_avg_roc_graph | 2.1 | N |  | (묶음 대표) 구간 평균변화율: 그래프 두 값 → 식−그래프 차(계산기) |
| s1-graph-ab:ab-m06-k0 | g_avg_value_graph | 8.1 | R-기존 | avg_value_calc | 평균값 = 적분/(b−a)(식+계산기 → 그래프 넓이 → 식+그래프 합) |
| s1-graph-ab:ab-m07-k0 | g_avg_value_mixed_calc | 8.1 | R-기존 | avg_value_calc | 평균값 = 적분/(b−a)(식+계산기 → 그래프 넓이 → 식+그래프 합) |
| s1-graph-ab:ab-m08-k0 | g_chain_mixed_calc | 3.1 | R-기존 | chain_table | h=f(g(x)) 의 h'(a) = f'(g(a))·g'(a): 값을 표 → 그래프 → 식+그래프에서 읽을 뿐 |
| s1-graph-ab:ab-m09-k0 | g_chain_two_graphs | 3.1 | R-기존 | chain_table | h=f(g(x)) 의 h'(a) = f'(g(a))·g'(a): 값을 표 → 그래프 → 식+그래프에서 읽을 뿐 |
| s1-graph-ab:ab-m11-k0 | g_cont_removable | 1.10 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m12-k0 | g_count_nondiff | 2.4 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m14-k0 | g_exp_growth_constant | 7.8 | N |  | (묶음 대표) 같은 그림(지수 곡선 두 점)에서 k 구하기 → 뒤 시각 값 구하기(마지막 단계만 연장) |
| s1-graph-ab:ab-m15-k0 | g_exp_value_calc | 7.8 | R-신규 | g_exp_growth_constant | 같은 그림(지수 곡선 두 점)에서 k 구하기 → 뒤 시각 값 구하기(마지막 단계만 연장) |
| s1-graph-ab:ab-m16-k0 | g_fprime_inc_concave | 5.9 | N |  | (묶음 대표) 그래프 부호와 기울기 부호 두 조건을 동시에 만족하는 구간(f'→f, f→∫f 한 단계 이동뿐) |
| s1-graph-ab:ab-m17-k0 | g_fprime_inflection | 5.6 | R-기존 | inflection_count | 변곡점 개수: 식의 부호 변화 → f' 그래프 기울기 부호 변화 |
| s1-graph-ab:ab-m19-k0 | g_ftc_mixed_calc | 6.4 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m20-k0 | g_inflow_outflow_graph | 8.3 | R-기존 | accum_context_calc | 초기량 + ∫(속도) 로 시각의 양: 식 → 유입·유출 그래프 넓이 |
| s1-graph-ab:ab-m21-k0 | g_integral_mixed_calc | 6.6 | R-기존 | prop_integrals | 정적분 선형성/성질: 주어진 적분값 → 그래프 넓이 → 식+그래프 |
| s1-graph-ab:ab-m23-k0 | g_inverse_deriv_graph | 3.3 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m24-k0 | g_lhopital_graph | 4.7 | R-기존 | lhopital | 0/0 형태에서 로피탈: 식 미분 → 그래프에서 기울기 읽기 |
| s1-graph-ab:ab-m25-k0 | g_lim_jump_sum | 1.3 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m28-k0 | g_product_two_graphs | 2.8 | R-기존 | product_table | 곱의 미분 값 평가: 표 → 그래프에서 값·기울기 읽기 |
| s1-graph-ab:ab-m29-k0 | g_quotient_two_graphs | 2.9 | R-기존 | quotient_rule_eval | 몫의 미분 값 평가: 표 → 그래프에서 값·기울기 읽기 |
| s1-graph-ab:ab-m30-k0 | g_related_rates_two_graphs | 4.5 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m31-k0 | g_riemann_left_graph | 6.2 | R-기존 | riemann_table | 리만 합 평가: 너비·점 찾기 → 값 읽기/계산 → 너비 곱(표→그래프→식+계산기, 좌/우/중점만 다름) |
| s1-graph-ab:ab-m32-k0 | g_speed_increasing | 4.2 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m33-k0 | g_tangent_approx_fprime_graph | 4.6 | R-기존 | linearization | 접선 근사값(+과대/과소 판정): 식 → f' 그래프 → 계산기 식 → 그래프 → 합성함수 |
| s1-graph-ab:ab-m34-k0 | g_total_distance_graph | 8.2 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s1-graph-ab:ab-m35-k0 | g_volume_base_graph | 8.7 | N |  | (묶음 대표) 같은 그래프 밑면, 단면 도형만 정사각형/반원/정삼각형(도형 상수 1·π/8·√3/4) |
| s1-graph-ab:ab-m36-k0 | g_volume_curve_line_calc | 8.7 | R-기존 | volume_calc | 두 곡선 사이 밑면·정사각형 단면 부피: 식 → 그림(곡선+직선) |
| s1-graph-ab:ab-m37-k0 | g_washer_curve_line_calc | 8.11 | N |  | (묶음 대표) 같은 그림(4 sin x 와 직선 L), 회전축 x축 → y=−2(반지름에 s 더함) |
| s2-graph-ab:ab-m01-k0 | g_context_roc_meaning | 4.1 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s2-graph-ab:ab-m02-k0 | g_extreme_mixed_calc | 5.5 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s2-graph-ab:ab-m04-k0 | g_second_deriv_mixed_calc | 3.6 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s2-graph-ab:ab-m05-k0 | g_separable_graph_calc | 7.7 | R-기존 | separable_particular | 변수분리 미분방정식의 특수해 값: 식 → g(x) 가 그래프 |
| s2-graph-ab:ab-m06-k0 | g_trapezoid_unequal_graph | 6.2 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s2-graph-bc:bc-m01-k0 | g_euler_graph | 7.5 | R-기존 | euler_method | 오일러 방법 반복 근사: 기울기 식 → 그래프 → 비선형식+계산기(단계 수만 다름) |
| s2-graph-bc:bc-m02-k0 | g_lagrange_decimal_calc | 10.12 | R-기존 | lagrange_graph | 그래프에서 최대 |f^(n+1)| 을 읽어 라그랑주 오차 한계 M|x|^(n+1)/(n+1)! 적용(n=2·3, 계산기 유무) |
| s2-graph-bc:bc-m03-k0 | g_param_dydx_graphs | 9.1 | R-기존 | param_dydx | dy/dx=(dy/dt)/(dx/dt): 식 → 그래프 기울기 |
| s2-graph-bc:bc-m04-k0 | g_param_speed_graphs | 9.6 | R-기존 | param_speed_table | 속력 sqrt(x'^2+y'^2): 표/식 → 그래프 |
| s2-graph-bc:bc-m06-k0 | g_vector_displacement_graph | 9.5 | R-기존 | param_xvel_graph | 속도 성분 그래프의 부호 있는 넓이로 위치(성분 1개 → 2개) |
| s3a-graph-ab:ab-m03-k0 | c_ftc_chain_calc | 6.4 | R-기존 | ftc_accum | 상한이 x² 인 누적함수의 미분(FTC + 연쇄): 표 → 식+계산기 |
| s3a-graph-ab:ab-m04-k0 | c_implicit_slope_calc | 3.2 | R-기존 | implicit_slope | 음함수 미분 dy/dx 값: 다항식 → 지수·곱 식+계산기 |
| s3a-graph-ab:ab-m05-k0 | c_inflection_calc | 5.6 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3a-graph-ab:ab-m06-k0 | c_midpoint_sum_calc | 6.2 | R-기존 | riemann_table | 리만 합 평가: 너비·점 찾기 → 값 읽기/계산 → 너비 곱(표→그래프→식+계산기, 좌/우/중점만 다름) |
| s3a-graph-ab:ab-m08-k0 | c_related_rates_cone_calc | 4.5 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3a-graph-ab:ab-m09-k0 | c_second_deriv_test_calc | 5.7 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3a-graph-ab:ab-m11-k0 | g_accum_justify_graph | 6.5 | R-신규 | g_fprime_inc_concave | 그래프 부호와 기울기 부호 두 조건을 동시에 만족하는 구간(f'→f, f→∫f 한 단계 이동뿐) |
| s3a-graph-ab:ab-m12-k0 | g_accum_two_values | 6.4 | R-기존 | graph_accum_value | g(x)=c+∫ f 의 값(부호 있는 넓이 + 초기값): 아래끝 0 → 아래끝 2 |
| s3a-graph-ab:ab-m13-k0 | g_avg_roc_mixed_calc | 2.1 | R-신규 | g_avg_roc_graph | 구간 평균변화율: 그래프 두 값 → 식−그래프 차(계산기) |
| s3a-graph-ab:ab-m14-k0 | g_extrema_count_fprime | 5.4 | R-기존 | graph_fprime_extremum | f' 그래프의 부호 변화로 극값 판정(어디인가 → 몇 개인가) |
| s3a-graph-ab:ab-m15-k0 | g_integral_properties_graph | 6.6 | R-기존 | prop_integrals | 정적분 선형성/성질: 주어진 적분값 → 그래프 넓이 → 식+그래프 |
| s3a-graph-ab:ab-m16-k0 | g_ivt_graph | 1.16 | R-기존 | ivt | 사잇값 정리가 보장하는 k: 값 주어짐 → 그래프에서 읽음 |
| s3a-graph-ab:ab-m17-k0 | g_linearization_composite_calc | 4.6 | R-기존 | linearization | 접선 근사값(+과대/과소 판정): 식 → f' 그래프 → 계산기 식 → 그래프 → 합성함수 |
| s3a-graph-ab:ab-m20-k0 | g_riemann_mixed_calc | 6.2 | R-기존 | riemann_table | 리만 합 평가: 너비·점 찾기 → 값 읽기/계산 → 너비 곱(표→그래프→식+계산기, 좌/우/중점만 다름) |
| s3a-graph-ab:ab-m21-k0 | g_tangent_line_value_graph | 4.6 | R-기존 | linearization | 접선 근사값(+과대/과소 판정): 식 → f' 그래프 → 계산기 식 → 그래프 → 합성함수 |
| s3a-graph-ab:ab-m22-k0 | g_volume_semicircle_graph | 8.8 | R-신규 | g_volume_base_graph | 같은 그래프 밑면, 단면 도형만 정사각형/반원/정삼각형(도형 상수 1·π/8·√3/4) |
| s3a-graph-ab:ab-m23-k0 | g_volume_washer_graph | 8.11 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3a-graph-bc:bc-m02-k0 | g_lagrange_p2_calc | 10.12 | R-기존 | lagrange_graph | 그래프에서 최대 |f^(n+1)| 을 읽어 라그랑주 오차 한계 M|x|^(n+1)/(n+1)! 적용(n=2·3, 계산기 유무) |
| s3b-graph-ab:ab-m01-k0 | g_arcsin_deriv_mixed_calc | 3.4 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3b-graph-ab:ab-m03-k0 | g_position_graph_speed | 4.2 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3b-graph-ab:ab-m04-k0 | g_squeeze_graph | 1.8 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3b-graph-ab:ab-m05-k0 | g_usub_graph | 6.9 | R-기존 | usub_integral | 치환적분 u=x², 극한 변환: 식 → 그래프 넓이 |
| s3b-graph-ab:ab-m06-k0 | g_volume_axis_shift_calc | 8.10 | R-신규 | g_washer_curve_line_calc | 같은 그림(4 sin x 와 직선 L), 회전축 x축 → y=−2(반지름에 s 더함) |
| s3b-graph-bc:bc-m02-k0 | g_logistic_fastest_graph | 7.9 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3c-graph-ab:ab-m02-k0 | c_area_between_calc | 8.4 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3c-graph-ab:ab-m03-k0 | c_disc_volume_calc | 8.9 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3c-graph-ab:ab-m04-k0 | c_linear_approx_overunder_calc | 4.6 | R-기존 | linearization | 접선 근사값(+과대/과소 판정): 식 → f' 그래프 → 계산기 식 → 그래프 → 합성함수 |
| s3c-graph-ab:ab-m06-k0 | g_area_y_graph | 8.5 | N |  | 다른 모든 문항과 질문·풀이 골격이 다름 |
| s3c-graph-ab:ab-m07-k0 | g_volume_triangle_graph | 8.8 | R-신규 | g_volume_base_graph | 같은 그래프 밑면, 단면 도형만 정사각형/반원/정삼각형(도형 상수 1·π/8·√3/4) |
| s3c-graph-bc:bc-m02-k0 | c_bc_euler_calc | 7.5 | R-기존 | euler_method | 오일러 방법 반복 근사: 기울기 식 → 그래프 → 비선형식+계산기(단계 수만 다름) |
