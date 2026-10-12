# AP Calculus BC 생성 가이드 (공통 코어 + AB 공유분 + BC 델타)

BC 시험은 AB 핵심 위에 BC 전용 토픽을 더한다. **공유 토픽의 문항은 한 번만 생성하고 `content_key`(`calculus:<코드>`)로 AB·BC 양쪽에 태깅**하며, BC 전용 칸만 별도 생성한다. 설정: `lib/ap-generation/subjects/calc-bc.ts`(`calcBcGuide`).

## 1. BC 시험·비중
MC 42문항·100분(파트 A 29/B 13), FRQ 6문항 9점(AB 공통 3 + BC 3: 급수, 매개·극좌표·벡터, 미분방정식/오일러·로지스틱 등). BC MC 단원 비중: U1 5–10, U2 5–10, U3 5–10, U4 5–10, U5 10–15, U6 15–20, U7 5–10, U8 5–10, U9 15–20, U10 15–20.

## 2. BC 전용 토픽 30개(AB 범위 밖) — 델타
| 단원 | 토픽(공식 코드) |
|---|---|
| 6 | 6.11 부분적분, 6.12 부분분수, 6.13 이상적분 |
| 7 | 7.5 오일러 방법, 7.9 로지스틱 모형 |
| 8 | 8.13 호의 길이 |
| 9 | 9.1 매개 함수 미분, 9.2 매개 2계 도함수, 9.3 매개 호 길이, 9.4 벡터함수 미분, 9.5 벡터함수 적분, 9.6 매개·벡터 운동, 9.7 극좌표·극 미분, 9.8 극 영역 넓이, 9.9 두 극곡선 사이 넓이 |
| 10 | 10.1 급수 수렴/발산, 10.2 등비급수, 10.3 n항 판정법, 10.4 적분 판정법, 10.5 조화·p-급수, 10.6 비교 판정법, 10.7 교대급수 판정법, 10.8 비율 판정법, 10.9 절대/조건 수렴, 10.10 교대급수 오차 한계, 10.11 테일러 다항식, 10.12 라그랑주 오차 한계, 10.13 수렴 반지름·구간, 10.14 테일러·매클로린 급수, 10.15 거듭제곱 급수 표현 |

## 3. BC 전용 스킬·구조
- 스킬 코드는 AB와 동일한 Mathematical Practices(1.C–1.F, 2.B–2.E, 3.B–3.F). 급수 단원은 **3.D(판정법 적용)·3.C(조건 확인)**, 매개·극 단원은 **1.D/1.E**, 오차 한계는 **1.F/1.E**가 중심.
- MC 구조: 독립형 4지선다(세트 없음), 급수 판정 문항은 "진술 선택형"(절대 수렴 / 조건 수렴 / 발산 / 'n항 판정법으로 수렴'은 항상 오답 선택지).
- FRQ 템플릿(BC 전용): `frq_series`(매클로린 급수 항·일반항(3) / 수렴 반지름·구간·끝점 교대급수 조건(3) / 오차 한계(2) / 항별 적분 근사(1)), `frq_parametric`(속도·가속도·속력(3) / 접선(2) / 총 이동거리(2) / d²y/dx²(2)). 극좌표 FRQ·미분방정식(오일러/로지스틱) FRQ·벡터 FRQ는 후속.

## 4. BC 전용 원형 16개
| 단원 | 원형 id | 토픽 / 스킬 / 계산기 | 코드 검증 | 오개념 |
|---|---|---|---|---|
| 6 | `int_by_parts` | 6.11 / 1.C / 불가 | sympy integrate + 수치 quad | 부호 실수, uv 항만, 남은 적분 더하기, k 곱 |
| 6 | `partial_fractions` | 6.12 / 1.C / 불가 | sympy integrate + quad | 로그 순서 반대, 단일 로그, 계수 동일 |
| 6 | `improper_integral` | 6.13 / 1.E / 불가 | p-적분 판정 공식(수렴 p>1) | 항상 발산, 지수 보고, 1/p |
| 7 | `euler_method` | 7.5 / 1.E / 불가 | 2단계 직접 계산 | 한 단계, x 미갱신, h 누락, 옛 y |
| 7 | `logistic` | 7.9 / 1.D / 불가 | 극한 K·최대 성장 K/2 수치 확인 | K/2 vs K, k 곱 |
| 8 | `arc_length_calc` | 8.13 / 1.E / 필수 | scipy quad | y 대입, 제곱근 누락, 넓이, 직선 거리 |
| 9 | `param_dydx` | 9.1 / 1.E / 불가 | sympy | dx/dy, dy/dt만, 곱, 부호 |
| 9 | `param_second` | 9.2 / 1.E / 불가 | sympy | d/dt(dy/dx)만, y''/x'', y''/x' |
| 9 | `param_arclength_calc` | 9.3 / 1.D / 필수 | scipy quad | 성분 합, 제곱근 누락, 원점 거리 |
| 9 | `param_speed_calc` | 9.6 / 1.E / 필수 | sympy + 수치 | 성분 합, dy/dx, 위치 크기, 제곱근 누락 |
| 9 | `polar_area_calc` | 9.8 / 1.D / 필수 | scipy quad | r 적분, ½ 누락, 적분의 제곱, 부호 |
| 10 | `series_test` | 10.9 / 3.D / 불가 | 가족별 판정(등비·p·교대 p·비율·n항) + 부분합 | 절대/조건 혼동, n항 판정법으로 수렴 |
| 10 | `taylor_coeff` | 10.14 / 1.E / 불가 | sympy series | n! 누락, k^n 누락, 부호 |
| 10 | `radius_interval` | 10.13 / 1.E / 불가 | 비율 판정 + 끝점 부분합(조화 발산, 교대조화 수렴) | 끝점 미검사, 발산 끝점 포함 |
| 10 | `geometric_sum` | 10.2 / 1.E / 불가 | 부분합 | 첫 항 혼동, 1+r, 첫 항만 |
| 10 | `lagrange_error` | 10.12 / 3.D / 불가 | 공식 M·|x|^(n+1)/(n+1)! | 차수·계승 오류 |
BC 샘플(MC 30): 공유 AB 14 + BC 전용 16(U6 3, U7 2, U8 1, U9 5, U10 5).

## 5. 검증기(BC 추가)
- **급수**: 가족별(등비·p·교대 p·비율·n항) 판정 + 부분합 수치 거동(수렴 급수의 부분합 안정, 발산의 증가), 끝점 검사(조화=발산, 교대조화=수렴), sympy `series`/`summation` 교차.
- **매개·극**: sympy 미분(dy/dx = y'/x', d²y/dx² = d/dt(dy/dx)/x'), scipy 수치 적분(호 길이·속력·극 넓이).
- **오차 한계**: 교대급수 오차 = 다음 항 크기(항 감소 조건 확인 후), 라그랑주 공식 직접 계산.
- **금지**: BC 전용이라도 코스 범위 밖(Simpson 등)과 점수 수준 표기.

## 6. AB 문항의 BC 재사용
- 공유 토픽(AB 81개)의 AB 채택 문항은 `content_key`가 같으면 BC 문항 풀에도 **태깅**한다(복제 생성 안 함). 단 BC 범위 규칙: 같은 BC 세트·시험에는 한 번만(중복 0).
- AB 문항 중 BC 비중상 낮은 단원(U1–U4 각 5–10%)은 공유분에서 최소만 사용하고 BC 전용 단원(U9·U10)을 충분히 채운다.
- BC에서 AB 문항을 재사용해도 난이도 라벨(잠정)과 검수 상태는 그대로 이월한다.


## BC 전용 그래프 신규 원형 (2026-10-09, six-set-plan S1~S3)
그래프 필수(또는 계산기 필수 일반) MC 신규 원형. 정답·자료는 코드가 계산하고 별도 수치 경로로 재확인한다. 원천: `scripts/ap-generation/archetypes/calc_graph_*.py`, 가이드 항목 `lib/ap-generation/subjects/graph-archetypes.json`.

| id | 토픽 | 스킬 | 계산기 | 독립 검증 |
|---|---|---|---|---|
| c_bc_alt_terms_calc | 10.10 | 1.E | required | terms computed in floating point and the first index with b_(N+1) below the tolerance found by direct search ( |
| c_bc_euler_calc | 7.5 | 1.E | required | the iteration recomputed as a table of floating-point values (independent of the loop implementation) |
| c_bc_improper_calc | 6.14 | 1.E | required | scipy quad to a finite upper bound of 40 compared with the infinite-range quad (independent of the infinite-ra |
| g_alt_series_graph | 10.10 | 2.B | not_allowed | exact rational recomputation of the terms at integers and of the partial sum (independent of option constructi |
| g_euler_graph | 7.5 | 1.E | not_allowed | two Euler steps recomputed with floating-point arithmetic on the interpolated graph (independent of the exact  |
| g_geometric_series_graph | 10.2 | 1.E | not_allowed | partial sum of 400 terms computed in floating point (independent of the closed form) |
| g_lagrange_decimal_calc | 10.12 | 1.E | required | maximum absolute value from a 2000-point grid on [0, a] (independent of vertex reading) |
| g_lagrange_p2_calc | 10.12 | 3.D | required | maximum absolute value from a 2000-point grid on [0, a] (independent of vertex reading) |
| g_logistic_fastest_graph | 7.9 | 2.E | not_allowed | finite-difference growth rate of the plotted curve is largest near P = K/2 (independent of the logistic formul |
| g_param_arclength_graphs_calc | 9.4 | 1.E | required | composite Simpson rule on each segment of the speed function (independent of scipy quad) |
| g_param_dydx_graphs | 9.1 | 1.E | not_allowed | difference quotient of y over difference quotient of x with step 1e-6 on the interpolated graphs (independent  |
| g_param_rest_graph | 9.5 | 2.E | not_allowed | numerical speed from central differences of both interpolated graphs at each interval midpoint (independent of |
| g_param_speed_graphs | 9.6 | 2.B | not_allowed | math.hypot of the numerically interpolated components at t = a (independent of the Pythagorean triple used to  |
| g_taylor_deriv_graph | 10.11 | 2.B | not_allowed | polynomial evaluated numerically from numerically interpolated heights and finite-difference slope of f' (inde |
| g_vector_displacement_graph | 9.5 | 1.D | not_allowed | numerical quadrature of each interpolated velocity component plus the initial position (independent of trapezo |

보강(bc-topup) 원형: param_xvel_graph, polar_area_graph, polar_rprime_graph, lagrange_graph, alt_series_table, taylor_table, polar_table_distance, param_speed_table (`calc_bc_topup.py`). FRQ: frq_polar_region(극좌표 영역, 계산기, 9.8/9.7), frq_euler_logistic.

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_alt_test_choice | 10.7 | 3.D | not_allowed | b_n is checked to be strictly decreasing for 2 <= n < 300 and its limit evaluated at n = 10^6; the distractors |
| c_comparison_benchmark | 10.6 | 3.D | not_allowed | the ratio of the general term to 1/n^(q-p) is evaluated at n = 10^6 and by sympy's limit, and must be finite a |
| c_geometric_terms_needed_calc | 10.2 | 1.E | required | partial sums are accumulated term by term in floating point and compared with the closed-form sum a/(1 - r) (i |
| c_integral_test_bound_calc | 10.4 | 1.E | required | the sum is computed from 200000 terms plus the exact tail, and the tail integral by scipy quad (independent of |
| c_integral_test_choice | 10.4 | 3.D | not_allowed | for the convergent series the tail sum over n from 10^5 to 2*10^5 is checked to be small, and each integral is |
| c_lagrange_min_degree_calc | 10.12 | 1.E | required | for the two critical degrees, the maximum of /f^(n+1)/ is found by a 2001-point grid on [0, c] and the bound r |
| c_partial_sum_term | 10.1 | 1.E | not_allowed | the first m terms are generated one by one and their exact sum is compared with S_m; the difference is also co |
| c_ratio_limit_e | 10.8 | 1.E | not_allowed | the ratio is evaluated at n = 10^7 using logarithms in floating point and compared with c/e (independent of th |
| c_series_integral_calc | 10.15 | 1.E | required | the truncated series is rebuilt with sympy's series expansion and integrated numerically by quadrature (indepe |
| c_series_recognize_sum | 10.15 | 1.E | not_allowed | partial sums of 400 terms computed in floating point (independent of the recognition of the series) |
| c_taylor_actual_error_calc | 10.11 | 1.E | required | the coefficients come from the series closed form (not sympy's series expansion used to generate the options)  |
| c_taylor_from_diffeq_calc | 10.11 | 1.E | required | Picard iteration of the integral equation y = y0 + integral of F(x, y), truncated at x^3, gives the same coeff |
| c_telescoping_sum | 10.1 | 1.E | not_allowed | the partial sums up to 200000 terms plus a tail estimate are accumulated in floating point (independent of the |
| c_term_diff_sum | 10.15 | 1.E | not_allowed | the terms n x^(n-1)/(n k^n) = x^(n-1)/k^n are summed numerically (400 terms) at the given x (independent of th |

보강(supplement, 2026-10-09 오너 승인) BC 전용 FRQ 새 유형:

| id | 대표 토픽 / 스킬 / 계산기 | 파트 | 독립 검증 |
|---|---|---|---|
| `frq_bc_taylor_diffeq` | 10.11(+10.12, 5.7) / 1.E / 불가 | a 미분방정식에서 f'(0)·f''(0)·f'''(0)과 3차 테일러 다항식(3) / b 근삿값(2) / c 라그랑주 오차 한계(2) / d 2계 도함수 판정(2) | sympy dsolve 해의 매클로린 계수 |
| `frq_bc_improper_parts` | 6.13(+6.11, 5.4) / 1.E / 불가 | a 이상적분(부분적분)(3) / b 유한 구간 정확값(2) / c 최대 속도 시각(2) / d 목표 총량에 맞는 상수(2) | scipy quad 무한 구간·유한 구간, 격자 최댓값 |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_bc_logistic_time_calc | 7.9 | 1.E | required | the differential equation is integrated numerically (Runge-Kutta, tolerance 1e-11) and the crossing time of th |
| c_bc_polar_between_calc | 9.9 | 1.D | required | the area is summed from 400000 polar sectors between the intersection angles (independent of scipy quad) |
| c_bc_polar_slope_calc | 9.7 | 1.E | required | x(theta) and y(theta) are evaluated and differenced numerically with step 1e-6, and the ratio of the differenc |
| c_bc_vector_speed_max_calc | 9.6 | 1.E | required | the maximum speed over a 300001-point grid on [0, T] (independent of Brent's method on the derivative of the s |
| c_series_limit_eval | 10.14 | 1.E | not_allowed | the quotient is evaluated at x = +/-10^-3 in floating point and averaged (independent of the series expansion) |
