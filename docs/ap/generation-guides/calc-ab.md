# AP Calculus AB 생성 가이드

공통 코어는 `calc-core.md`. 이 문서는 AB 전용 범위·원형·FRQ 템플릿·오개념 카탈로그다. 설정 파일: `lib/ap-generation/subjects/calc-ab.ts`(`calcAbGuide`) — 파이프라인이 이 설정에서 문장 작성/검토 프롬프트, 범위, 금지어, 원형 일치 게이트를 만든다.

## 1. 단원별 범위(AB 기준, 공식 MC 비중)
| 단원 | 비중 | AB 범위 안 | AB 범위 밖(BC 또는 다른 단원) |
|---|---|---|---|
| 1 Limits and Continuity | 10–15% | 그래프·표·대수적 극한, 한쪽·무한 극한, 연속·불연속 유형, 압착, IVT | 엡실론-델타, 수열의 극한, 로피탈(AB는 4단원) |
| 2 Differentiation: Definition and Fundamental Properties | 10–15% | 평균·순간 변화율, 도함수 정의·표 추정, 미분가능성과 연속, 멱·곱·몫 규칙, sin/cos/tan/e^x/ln x | 연쇄법칙·음함수(3단원) |
| 3 Composite, Implicit, Inverse | 5–10% | 연쇄법칙, 음함수(1계), 역함수·역삼각 도함수, 고계 도함수 | 관련 변화율(4단원), 음함수 2계 도함수(MC) |
| 4 Contextual Applications | 10–15% | 단위 있는 해석, 직선 운동, 관련 변화율, 국소 선형 근사, 로피탈 | 매개·벡터 운동(BC) |
| 5 Analytical Applications | 15–20% | MVT·EVT, 임계점·1/2계 도함수 판정, 오목성·변곡, f–f'–f'' 연결, 최적화 | 롤의 정리 별도 출제, 뉴턴 방법 |
| 6 Integration and Accumulation | 15–20% | 리만 합(좌·우·중점·사다리꼴), 정적분 성질, FTC 1·2, 누적 함수, 기본 부정적분, 치환 | 부분적분·부분분수·이상적분(BC), 심프슨 |
| 7 Differential Equations | 5–10% | 모형화, 기울기장, 변수분리·특수해, 지수 증감 | 오일러, 로지스틱(BC) |
| 8 Applications of Integration | 10–15% | 평균값, 변위·총 이동거리, 순변화, 곡선 사이 넓이, 단면·원판·와셔 부피 | 호의 길이, 극좌표·매개 넓이(BC), 쉘 |

## 2. 스킬별 문항 설계 규칙(공식 CED 스킬 코드)
MC에서 평가되는 스킬만 쓴다(1.C–1.F, 2.B–2.E, 3.B–3.F). `1.A/1.B/3.A`와 Practice 4는 MC 금지. 코드별 설계 규칙·금지 사항은 `calc-ab.ts`의 `skills[]`에 있다(요약):
- **1.C** 표현의 형태를 보고 규칙 선택(곱/몫/연쇄) — 규칙 이름을 지문에 쓰지 않는다.
- **1.D** 개념 관계로 절차 선택(변화율↔누적, 넓이·부피 설정, 관련 변화율) — 선택지가 설정의 개념적 실수를 드러낸다.
- **1.E** 한 번의 깔끔한 다단계 계산 — 같은 공식에 숫자만 바꾸는 반복·불필요한 긴 계산 금지.
- **1.F** 근사와 참값의 관계 — 값과 과대/과소 판단을 함께.
- **2.B** 표·그래프에서 정보를 읽기 — 표가 지문과 중복이면 금지.
- **2.C** 표기 간 변환(극한/도함수, 리만 합/적분, 미분방정식/기울기장).
- **2.D/2.E** f, f', f'' 표현 간 관계 — 한 표현의 부호·단조 데이터로 다른 표현의 성질.
- **3.B/3.C/3.D** 정리 선택·가설 확인·적용 — 가설 하나가 정답을 결정하게 한다.
- **3.E/3.F** 이유/해석 — MC는 결론이 정답, 선택지에 "because" 서술 금지.
MC 스킬 비중(30문항): P1 63% / P2 20% / P3 17%(공식 범위: 50–70/15–30/10–20 안).

## 3. 원형(문항 틀) — 단원별 30개, 1칸 1원형
각 원형: 토픽·스킬·계산기·자료·**코드 검증 방식**·**오개념**. (id는 `scripts/ap-generation/archetypes/calc_ab_*.py`의 함수명)
| 단원 | 원형 id | 토픽 / 스킬 / 계산기 | 자료 | 코드 검증 | 오개념 카탈로그 |
|---|---|---|---|---|---|
| 1 | `lim_table` | 1.4 / 2.B / 불가 | 값 표 | sympy 극한, 안쪽 두 값 평균 vs 극한 | 극한=f(a), 0/0→0·DNE, √ 미분의 1/2 누락 |
| 1 | `lim_alg` | 1.7 / 1.C / 불가 | 없음 | sympy 극한 | 0/0→0·DNE, 인수 약분 오류 |
| 1 | `cont_piece` | 1.11 / 1.E / 불가 | 구간 정의 | sympy solve | 부호 실수, 상수 누락, 도함수 일치로 대체 |
| 1 | `ivt` | 1.16 / 3.D / 불가 | 끝점 값·연속 | 구간 산술 | 끝점 값 보장, 범위 밖 값 |
| 2 | `deriv_est_table` | 2.3 / 2.B / 불가 | 값 표 | 이차함수 정확 도함수 | 한쪽 구간, 잘못된 분모, 나눗셈 누락 |
| 2 | `diff_cont` | 2.4 / 3.E / 불가 | 구간 정의 | sympy 한쪽 극한·도함수 | 값 일치→기울기 일치, 미분가능하나 불연속 |
| 2 | `product_table` | 2.8 / 1.E / 불가 | 값·도함수 표 | 곱의 미분 재계산 | f'g', 상수배 미미분, 항 누락 |
| 2 | `quotient_rule_eval` | 2.9 / 1.E / 불가 | 값·도함수 표 | 몫의 미분 재계산 | 분자 순서 반대, g² 누락, f'/g' |
| 3 | `chain_table` | 3.1 / 1.E / 불가 | f,g 표 | 연쇄법칙 재계산 | f'(x) 평가, 안쪽 도함수 누락 |
| 3 | `implicit_slope` | 3.2 / 1.E / 불가 | 암시 곡선 | sympy idiff | xy의 x y' 누락, y² dy/dx 누락, 부호 |
| 4 | `motion_calc` | 4.2 / 1.E / 필수 | 속도 함수 | sympy diff, 중앙차분 | 곱의 미분 항 누락, 속도=가속도 |
| 4 | `related_rates` | 4.4 / 1.D / 불가 | 기하 공식 | sympy diff | 공식 미분 안 함, r·dr/dt 누락 |
| 4 | `linearization` | 4.6 / 1.F / 불가 | 함수·점 | 정확 유리수 접선값, 오목성 | 1/2 누락, 기울기 1, 과대/과소 오판 |
| 4 | `lhopital` | 4.7 / 1.E / 불가 | 부정형 몫 | sympy 극한 | 비율 뒤집기, 분자만 |
| 5 | `mvt_calc` | 5.1 / 3.D / 필수 | 구간의 미분가능 함수 | brentq 해·범위 확인 | 중점, 변화율 자체, 로그 밑 |
| 5 | `extrema_classification` | 5.4 / 3.E / 불가 | 인수분해된 f' | sympy 부호표 | 중근을 극값으로, 극대·극소 혼동 |
| 5 | `fprime_graph_statements` | 5.9 / 2.D / 불가 | f' 부호·단조 데이터 | 구간 논리 | 극대/극소 뒤바꿈, f' 증가→아래로 볼록 |
| 5 | `inflection_count` | 5.6 / 2.E / 불가 | 인수분해된 f'' | sympy 부호표 | 모든 영점 계수, 이중근 |
| 5 | `optimization` | 5.11 / 1.E / 불가 | 포물선 아래 직사각형 | 수치 최대화 | x를 넓이로, 밑변 x vs 2x |
| 6 | `riemann_table` | 6.2 / 2.B / 불가 | v(t) 표 | 산술 재계산 | 우합, 사다리꼴, 폭 누락 |
| 6 | `ftc_accum` | 6.4 / 1.D / 불가 | f 표 | FTC+연쇄 재계산 | 2x 누락, f(x) vs f(x²) |
| 6 | `prop_integrals` | 6.6 / 1.E / 불가 | 없음 | 선형성 재계산 | 상수 적분 무시·부호 |
| 6 | `ftc_eval_calc` | 6.7 / 1.E / 필수 | 비초등 피적분 | scipy quad+Simpson | 직사각형, 피적분값, 치환 오용 |
| 6 | `usub_integral` | 6.9 / 1.E / 불가 | 없음 | sympy integrate | 1/2 누락, n+1 누락, 한계 미변환 |
| 7 | `slope_field_match` | 7.3 / 2.C / 불가 | 격자점 기울기 표 | 모든 선택지를 모든 점에서 평가 | 일부 점에서 불일치 |
| 7 | `separable_particular` | 7.7 / 1.E / 불가 | 없음 | sympy dsolve | 초기조건 누락, 선형 해, 적분 오류 |
| 8 | `avg_value_calc` | 8.1 / 1.E / 필수 | 함수·구간 | scipy quad | 나눗셈 누락, 끝점 평균, 중점값 |
| 8 | `area_setup` | 8.4 / 1.D / 불가 | 두 곡선 | 각 선택지 적분 수치 평가 | 순서 반대, 함수 합, 한계 오류 |
| 8 | `volume_calc` | 8.7 / 1.D / 필수 | 두 곡선·정사각 단면 | quad + brentq 교점 | 변 미제곱, 원판, 제곱의 차 |
| 8 | `accum_context_calc` | 8.3 / 1.D / 필수 | 맥락 속도 함수 | scipy quad | 초기량 누락, 속도×시간, 항 무시 |
계산기 필수 6/30(20%) — 공식 파트 B 비율(31%)보다 낮음(원형 부족, 보고서에 기록).

## 4. FRQ 템플릿(반복 6유형 중 4개) — 9점
| 템플릿 id | 토픽 | 파트(점수) | 코드 검증 |
|---|---|---|---|
| `frq_table_rate` | 6.2(+8.1) / 2.B / 계산기 | a 사다리꼴 합+단위 해석(3) / b 좌합 과대·과소 이유(2) / c 모형 평균값(2) / d IVT 연속 조건 정당화(2) | 산술 재계산, scipy quad vs Simpson, 감소 확인 |
| `frq_fprime_graph` | 5.9(+5.6,5.4) / 3.E / 불가 | a 위로 볼록 구간+이유(2) / b 상대 극값 분류(2) / c 절대 최솟값 후보 비교(3) / d f(8) 순넓이(2) | 정수 넓이 유리수 계산, 수치 quad |
| `frq_diffeq` | 7.7(+7.3,7.4) / 1.E / 불가 | a 기울기장 불일치(1) / b 한 점 기울기(1) / c 접선 근사+오목성(2) / d 변수분리 5단계(5) | sympy dsolve, 이계 도함수 부호 |
| `frq_area_volume` | 8.4(+8.7,8.8) / 1.D / 계산기 | a 넓이(2) / b 단면 부피(2) / c 와셔 설정(3) / d f−g 평균값(2) | brentq 교점, 설정 적분을 sympy 파싱해 수치 비교, scipy quad |
나머지 공식 유형(입자 운동, 음함수·관련 변화율)은 재고 확장 시 추가(원형 미구현).

## 5. 합격/반려 예시(독창)
`calc-ab.ts`의 `acceptExamples`/`rejectExamples` 참조(요지: 합격 = f' 부호 데이터로 극값·오목성 판단(2.D), 표 기반 곱의 미분(1.E); 반려 = 같은 적분의 숫자만 바꾼 반복, 급수 수렴(BC 범위), 불필요한 복잡한 f''(0.37) 계산).

## 6. 금지어·범위 게이트
BC 전용 용어(series/converge/Taylor/Maclaurin/parametric/polar/vector/Euler/logistic/integration by parts/partial fractions/arc length/improper/Lagrange error)와 `Rolle`, `Newton's method`, `Simpson`, "AP 3/4/5 수준" 표현은 문항·해설에 나오면 반려(`gateGuideMc/Frq`).

## 부록: 계산기 필수 MC 신규 원형 3종(2026-10-09 소규모 검증, 설계도 포함)
단원 1·3·7 에 계산기 필수 문항이 없던 칸을 채우는 원형. 각 원형은 문장·보기 전에 설계도(`blueprint`)를 만들고 `lib/ap-generation/blueprint.ts` 로 검증한다. 상세: `docs/ap/generation-blueprints.md`.
- `deriv_calc_chain` (3.1, 스킬 1.E): 곱과 합성함수의 한 점 도함수를 계산기로 평가. 생성=기호 미분, 독립 검증=중심 차분. 오답: 안쪽 도함수 누락 / 곱의 법칙 한 항 누락 / 지수의 계수 c 누락.
- `ivt_solve_calc` (1.16, 스킬 1.E): f(c)=k 의 해를 계산기로. 생성=brentq, 독립 검증=직접 이분법. 오답: 구간 중점 / 선형 보간 / 목표값 오설정.
- `diffeq_value_calc` (7.7, 스킬 1.E): 분리 가능한 미분방정식 특수해를 점에서 평가. 생성=닫힌 형태, 독립 검증=적응형 룽게-쿠타 수치 적분. 오답: 1/2 인수 누락 / x 를 상수로 취급 / 지수화 대신 덧셈.

## 부록 2: 2026-10-09 보강 원형(그래프 MC 2종 + 미구현 FRQ 3유형, 설계도 포함)
- `graph_fprime_extremum` (5.4, 2.D, 계산기 불가, 그래프): f′ 그래프에서 상대 극값 — 오답: 부호가 안 바뀌는 영점, f′ 의 최댓값·최솟값 혼동. 독립 검증: 조각 선형 f′ 를 촘촘히 표본한 부호 변화 탐색.
- `graph_accum_value` (6.4, 2.B, 계산기 불가, 그래프): g(b)=g(0)+∫f 의 값 — 오답: g(0) 누락, 음의 넓이 무시, 폭 오류. 독립 검증: 적응형 수치 적분.
- FRQ `frq_particle_motion` (particle_motion_calc, 4.2, 계산기 필수): 가속도(1)·속력 증감+이유(2)·총 이동 거리(3)·위치(3). `frq_related_rates` (related_rates_setup, 4.5, 계산기 불가): 관계식·시간 미분(2)·순간 변화율+단위(3)·부호 해석(1)·파생 넓이 변화율(3). `frq_implicit_diff` (implicit_differentiation, 3.2, 계산기 불가): dy/dx 유도(3)·접선(2)·수평 접선(2)·법선(2, 음함수의 2계도함수는 AB 범위 밖).


## AB 그래프·일반 계산기 신규 원형 (2026-10-09, six-set-plan S1~S3)
그래프 필수(또는 계산기 필수 일반) MC 신규 원형. 정답·자료는 코드가 계산하고 별도 수치 경로로 재확인한다. 원천: `scripts/ap-generation/archetypes/calc_graph_*.py`, 가이드 항목 `lib/ap-generation/subjects/graph-archetypes.json`.

| id | 토픽 | 스킬 | 계산기 | 독립 검증 |
|---|---|---|---|---|
| c_abs_extreme_calc | 5.5 | 1.E | required | maximum of f over a 6001-point grid on [0, 6] (independent of the candidate comparison) |
| c_accum_interval_calc | 6.5 | 3.E | required | sign of the integrand on a fine grid and Brent roots (independent of the Fundamental Theorem argument) |
| c_area_between_calc | 8.4 | 1.D | required | composite Simpson rule on f - g between the Brent root (independent of scipy quad) |
| c_decay_model_calc | 7.8 | 1.E | required | Runge-Kutta numerical integration of dy/dt = -ky with k recomputed from the two data points (independent of th |
| c_disc_volume_calc | 8.9 | 1.D | required | composite Simpson rule on pi f^2 (independent of scipy quad) |
| c_ftc_chain_calc | 6.4 | 1.D | required | central difference (step 1e-6) of F computed by scipy quad (independent of the Fundamental Theorem) |
| c_implicit_slope_calc | 3.2 | 1.E | required | the curve is solved for y(x) with Brent's method near the point and differentiated by central difference (inde |
| c_inflection_calc | 5.6 | 2.E | required | Brent's method on the lambdified f'' near the reported root and a sign-change check (independent of the polyno |
| c_linear_approx_overunder_calc | 4.6 | 1.F | required | the exact f(a + dx) is compared with the tangent line value (independent of the sign of f'') |
| c_midpoint_sum_calc | 6.2 | 1.E | required | direct sum of the lambdified integrand at the midpoints (independent of the closed form of the points) |
| c_motion_turn_calc | 4.2 | 1.E | required | bisection on v over a fine grid (independent of Brent's method) |
| c_quotient_deriv_calc | 2.9 | 1.E | required | central difference (step 1e-6) of the original function (independent of the quotient rule) |
| c_related_rates_cone_calc | 4.5 | 1.D | required | V(h) inverted numerically by Brent's method and differentiated by central difference in time (independent of t |
| c_second_deriv_test_calc | 5.7 | 3.D | required | maximum of f over a fine grid on [0, 20] compared with f at the critical number (independent of the Second Der |
| c_trig_deriv_calc | 2.10 | 1.C | required | central difference (step 1e-6) of the original function (independent of the symbolic derivative) |
| g_abs_max_fprime | 5.5 | 1.D | not_allowed | numerical integration of f' to every grid point and maximum of f over a 0.25 grid (independent of the candidat |
| g_accum_justify_graph | 6.5 | 3.E | not_allowed | numerical quadrature of g with first and second difference tests at each segment midpoint (independent of the  |
| g_accum_reverse_extremum | 6.5 | 2.E | not_allowed | g computed by numerical quadrature on a fine grid and its relative maximum located by comparing neighbouring v |
| g_accum_two_values | 6.4 | 2.B | not_allowed | numerical quadrature of the interpolated graph between 2 and b (independent of trapezoid areas) |
| g_arcsin_deriv_mixed_calc | 3.4 | 1.E | required | central difference (step 1e-6) of arcsin(g/10) with g interpolated (independent of the derivative formula) |
| g_area_between_graph | 8.4 | 1.D | not_allowed | numerical quadrature of |f - g| with breakpoints at the vertices (independent of the exact crossing computatio |
| g_area_curve_line_calc | 8.4 | 1.D | required | composite Simpson rule on f - L between roots recomputed by Brent's method (independent of scipy quad) |
| g_area_y_graph | 8.5 | 1.D | not_allowed | numerical quadrature of the interpolated x(y) over y in [0, 8] (independent of trapezoid areas) |
| g_avg_roc_graph | 2.1 | 2.B | not_allowed | quadrature of the piecewise slope function over [a, b] divided by b - a (independent of f(b) - f(a)) |
| g_avg_roc_mixed_calc | 2.1 | 2.B | required | difference quotient from the lambdified f and interpolated g (independent of splitting into f and g rates) |
| g_avg_value_graph | 8.1 | 1.E | not_allowed | numerical quadrature of the interpolated graph divided by 8 (independent of trapezoid areas) |
| g_avg_value_mixed_calc | 8.1 | 1.E | required | composite Simpson rule (20001 nodes) on f + g with g interpolated, divided by 8 (independent of the split into |
| g_chain_mixed_calc | 3.1 | 1.E | required | central difference (step 1e-6) of f(g(x)) with f lambdified and g interpolated (independent of the chain rule) |
| g_chain_two_graphs | 3.1 | 1.E | not_allowed | central difference (step 1e-6) of the numerically composed interpolants (independent of the chain rule) |
| g_cont_k_mixed_calc | 1.11 | 1.E | required | k substituted back into the right-hand piece and compared with the plotted value f(2) (independent of the alge |
| g_cont_removable | 1.10 | 3.D | not_allowed | side limits and function values compared numerically from the plotted piece endpoints (independent of how the  |
| g_context_roc_meaning | 4.1 | 3.F | not_allowed | difference quotient of the interpolated graph at t = a +/- 1e-6 (independent of the vertex list) |
| g_count_nondiff | 2.4 | 3.D | not_allowed | numerical one-sided difference slopes and one-sided values around each interior vertex on the plotted pieces ( |
| g_critical_point_mixed_calc | 5.2 | 1.E | required | bisection with 80 halvings on f'(x) - g'(x) using numerically interpolated f' and sympy g' (independent of Bre |
| g_exp_deriv_mixed_calc | 2.7 | 1.C | required | central difference (step 1e-6) of exp(g/2) with g interpolated (independent of the chain rule) |
| g_exp_growth_constant | 7.8 | 1.E | not_allowed | k recomputed as ln(P(T)/P(0))/T from the dense numerical curve samples (independent of the exact exponents) |
| g_exp_value_calc | 7.8 | 1.E | required | P(t1) recomputed as P(0) (P(T)/P(0))^(t1/T) (independent of the exponent k) |
| g_extrema_count_fprime | 5.4 | 2.D | not_allowed | dense sampling of the sign of f' and counting sign alternations (independent of listing the zeros) |
| g_extreme_mixed_calc | 5.5 | 1.D | required | maximum of h over a 6001-point grid on [0, 6] (independent of the candidate list) |
| g_fprime_inc_concave | 5.9 | 2.E | not_allowed | numerical value and finite-difference slope of f' at each segment midpoint (independent of the sign table) |
| g_fprime_inflection | 5.6 | 2.E | not_allowed | dense sampling of the finite-difference slope of f' and counting its sign changes (independent of comparing se |
| g_ftc_chain_graph | 6.4 | 1.D | not_allowed | central difference (step 1e-6) of F computed by numerical quadrature of the interpolated graph (independent of |
| g_ftc_mixed_calc | 6.4 | 1.D | required | central difference (step 1e-6) of H built from the lambdified f and a quadrature of the interpolated g (indepe |
| g_inflow_outflow_graph | 8.3 | 1.D | not_allowed | numerical quadrature of the two interpolated rate graphs (independent of the trapezoid formula) |
| g_integral_mixed_calc | 6.6 | 1.E | required | composite Simpson rule (20001 nodes) on f + c g with g interpolated (independent of the split into two integra |
| g_integral_properties_graph | 6.6 | 1.E | not_allowed | numerical quadrature of c f + d on the interpolated graph (independent of linearity) |
| g_integral_semicircle | 6.6 | 2.B | not_allowed | numerical quadrature of the explicit piecewise formula with the sqrt semicircle (independent of the geometric  |
| g_inverse_deriv_graph | 3.3 | 1.E | not_allowed | numerical inverse by Brent's method on the interpolated graph, then a central difference of that inverse (inde |
| g_ivt_graph | 1.16 | 3.D | not_allowed | numerical scan of the interpolated graph for a sign change of f - k (independent of comparing k with the endpo |
| g_lhopital_graph | 4.7 | 1.D | not_allowed | evaluating the interpolated quotient f/g at x = a +/- 1e-7 (independent of the slope ratio) |
| g_lim_jump_sum | 1.3 | 2.B | not_allowed | numerical evaluation of the two linear pieces at c -/+ 1e-9 (independent of the endpoints read from the figure |
| g_linearization_composite_calc | 4.6 | 1.F | required | the exact value ln(g(a + dx) + 2) from the interpolated graph is within 0.2 of the approximation (a sanity bou |
| g_mvt_fprime_graph | 5.1 | 3.D | not_allowed | dense sampling of f'(x) minus the average value and counting sign changes (independent of exact crossing arith |
| g_parallel_tangent_calc | 2.2 | 2.B | required | bisection on the central-difference derivative with 100 halvings (independent of the symbolic derivative and B |
| g_position_graph_speed | 4.2 | 2.B | not_allowed | central difference of the interpolated position graph at t = a (independent of the vertex list) |
| g_prod_deriv_mixed_calc | 2.8 | 1.E | required | central difference (step 1e-6) of the product of the lambdified formula and the interpolated graph (independen |
| g_product_two_graphs | 2.8 | 1.E | not_allowed | central difference (step 1e-6) of the product of the numerically interpolated graphs (independent of the produ |
| g_quotient_mixed_calc | 2.9 | 1.E | required | central difference (step 1e-6) of the lambdified formula divided by the interpolated graph (independent of the |
| g_quotient_two_graphs | 2.9 | 1.E | not_allowed | central difference (step 1e-6) of the numerically interpolated quotient (independent of the quotient rule) |
| g_rate_mixed_calc | 8.3 | 1.D | required | composite Simpson rule (20001 nodes) on R - L with L interpolated (independent of splitting into two integrals |
| g_related_rates_two_graphs | 4.5 | 1.D | not_allowed | central difference (step 1e-6) of V(t) built from the numerically interpolated r and h (independent of the pro |
| g_riemann_left_graph | 6.2 | 1.E | not_allowed | direct sum of the numerically interpolated function at the left endpoints times 2 (independent of exact vertex |
| g_riemann_mixed_calc | 6.2 | 1.E | required | direct floating-point sum of f + g (g interpolated) at the right endpoints times 2 (independent of exact verte |
| g_second_deriv_mixed_calc | 3.6 | 1.E | required | second central difference (step 1e-4) of the product of the lambdified formula and the interpolated graph (ind |
| g_separable_graph_calc | 7.7 | 1.E | required | Runge-Kutta numerical integration of the differential equation with the interpolated g (independent of separat |
| g_speed_increasing | 4.2 | 2.D | not_allowed | numerical |v| at t = midpoint +/- 0.01 on every segment (independent of the sign table) |
| g_squeeze_graph | 1.8 | 3.D | not_allowed | numerical limits of g and h at x = a from both sides (independent of the vertex values) |
| g_tangent_approx_fprime_graph | 4.6 | 1.F | not_allowed | numerical integral of f' over [a, a+1] gives the true f(a+1); the sign of true - tangent value is compared wit |
| g_tangent_line_value_graph | 4.6 | 1.E | not_allowed | the tangent line value recomputed from numerically interpolated f(a) and a difference quotient at a (independe |
| g_total_distance_graph | 8.2 | 1.D | not_allowed | numerical quadrature of |v| with breakpoints at the vertices (independent of the exact piecewise formula) |
| g_trapezoid_unequal_graph | 6.2 | 1.E | not_allowed | direct sum of the numerically interpolated heights times widths (independent of exact rationals) |
| g_usub_graph | 6.9 | 1.E | not_allowed | numerical quadrature of x f(x^2) on [0, 2] with the interpolated graph (independent of the substitution) |
| g_volume_axis_shift_calc | 8.10 | 1.D | required | composite Simpson rule on pi((f + s)^2 - (L + s)^2) between the roots (independent of scipy quad) |
| g_volume_base_graph | 8.7 | 1.D | not_allowed | numerical quadrature of the interpolated f squared (independent of the exact quadratic piece formula) |
| g_volume_curve_line_calc | 8.7 | 1.D | required | composite Simpson rule on (f - L)^2 between Brent-found roots (independent of scipy quad) |
| g_volume_semicircle_graph | 8.8 | 1.D | not_allowed | numerical quadrature of (pi/8) f^2 on the interpolated graph (independent of exact quadratic pieces) |
| g_volume_triangle_graph | 8.8 | 1.D | not_allowed | numerical quadrature of (sqrt(3)/4) f^2 on the interpolated graph (independent of exact quadratic pieces) |
| g_volume_washer_graph | 8.11 | 1.D | not_allowed | numerical quadrature of f^2 - g^2 with breakpoints at the vertices times pi (independent of exact quadratic pi |
| g_washer_curve_line_calc | 8.11 | 1.D | required | composite Simpson rule on pi (f^2 - L^2) between Brent-found roots (independent of scipy quad) |

보강(supplement, 2026-10-09 오너 승인) FRQ 새 유형(기존 유형과 풀이 구조가 다른 것만):

| id | 대표 토픽 / 스킬 / 계산기 | 파트 | 독립 검증 |
|---|---|---|---|
| `frq_table_values` | 3.1(+2.9, 5.1, 6.2) / 1.E / 불가 | a 표에서 합성함수 미분(2) / b 몫의 법칙(2) / c 평균변화율 + 평균값 정리 정당화(3) / d 폭이 다른 사다리꼴 합(2) | 로그 미분으로 몫 미분 재계산, 부동소수점 사다리꼴 |
| `frq_function_analysis` | 5.4(+5.5, 5.6, 2.7) / 3.E / 불가 | a 접선(2) / b 상대극값 f' 부호(3) / c 변곡점 f'' 부호(2) / d 닫힌 구간 절대 최대·최소(2) | 중심차분 기울기, 수치 도함수 Brent, 격자 최댓값 |
| `frq_rate_in_out` | 8.3(+4.1, 5.5) / 3.E / 계산기 | a 총 유입량(2) / b 순변화율 부호·단위(2) / c 시각의 양(2) / d 최대량 시각 정당화(3) | sympy 기호 적분, 순변화 함수 격자 최댓값 |
