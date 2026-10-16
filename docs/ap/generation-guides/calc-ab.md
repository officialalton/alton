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

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_accum_max_value_calc | 6.5 | 3.E | required | G is accumulated with a cumulative trapezoid rule on 40000 steps and its maximum is read from the running valu |
| c_closest_point_calc | 5.11 | 1.D | required | the minimum of the distance over a 300001-point grid on [-1, 5] (independent of Brent's method on the derivati |
| c_critical_count_calc | 5.2 | 1.E | required | sign changes of a central-difference derivative on a 30001-point grid are counted (independent of the closed-f |
| c_fastest_increase_calc | 5.5 | 3.E | required | the maximum of M' over a 200001-point grid on [0, 10c] (independent of Brent's method on M'') |
| c_ftc_second_derivative_calc | 6.4 | 1.D | required | F is computed by scipy quad and its second central difference with step 1e-3 is compared with the derivative o |
| c_implicit_horizontal_tangent_calc | 5.12 | 1.E | required | the curve is solved for y(x) on a 200000-point grid and the point with the smallest slope magnitude is located |
| c_increasing_interval_calc | 5.3 | 3.E | required | the sign of a central-difference derivative is checked at 401 points of [1, 5], with the single sign change lo |
| c_integral_equation_solve_calc | 6.7 | 1.E | required | bisection on the numerically integrated I(k) (independent of the inverse error function used to build the key) |
| c_limit_def_derivative_calc | 2.2 | 1.E | required | the difference quotient is evaluated numerically with h = 10^-6 (symmetric) and h = 10^-7 (one-sided) and comp |
| c_max_speed_calc | 4.2 | 1.E | required | the maximum of /x'(t)/ over a 200001-point grid on [0, T] (independent of Brent's method on the acceleration) |
| c_optimization_rect_calc | 5.11 | 1.D | required | the maximum of A over a 200001-point grid on the allowed interval (independent of Brent's method on A') |
| c_related_rates_angle_calc | 4.5 | 1.D | required | theta(t) = arctan((h0 + v t)/d) is differentiated by central difference at t = 0 (independent of the implicit  |
| c_tangent_x_intercept_calc | 2.7 | 1.E | required | the slope is recomputed by central difference (step 1e-6) and the intersection of the numerical tangent line w |
| c_total_distance_calc | 8.2 | 1.D | required | /v/ is integrated with a composite Simpson rule on 400000 subintervals (independent of the sign-change splitti |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_implicit_second_calc | 3.6 | 1.E | required | the curve is solved for y(x) near the point with Brent's method and the second central difference (step 1e-3)  |

| `frq_model_analysis_calc` | 8.1(+4.1, 5.5) / 1.E / 계산기 | a 모형의 평균값(2) / b C' 의 의미와 단위(2) / c 최댓값과 정당화(2) / d 기준 이상인 시간 구간(3) | sympy 기호 적분, 중심차분, 격자 교점·최댓값 |
| `frq_piecewise_diff` | 2.4(+1.11, 2.7, 6.7) / 3.B / 불가 | a 꺾이는 점의 연속(2) / b 편측 도함수로 미분 가능 정당화(3) / c 접선(2) / d 도함수의 평균값(2) | 편측 차분 몫, 중심차분 도함수의 수치 평균 |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_ftc_initial_value_calc | 6.7 | 1.E | required | composite Simpson rule (20001 nodes) added to the initial value (independent of scipy quad) |
| c_limit_numeric_e_calc | 1.4 | 1.E | required | direct evaluation at x = 1e-7 (independent of the closed form e^k) |
| c_normal_line_calc | 2.7 | 1.D | required | slope from a central difference (step 1e-6) of the lambdified function, then the point-slope equation (indepen |
| c_related_rates_distance_calc | 4.5 | 1.E | required | central difference (step 1e-7) of s(t) = sqrt((x0 + v t)^2 + H^2) (independent of implicit differentiation) |
| c_riemann_error_calc | 6.2 | 1.F | required | composite Simpson rule (20001 nodes) for the exact value minus a direct left sum (independent of scipy quad) |
| g_accum_concave_down_graph | 6.5 | 2.E | not_allowed | second difference of F computed by numerical quadrature at the midpoint of each segment (independent of the sl |
| g_accum_intersect_formula_calc | 6.4 | 1.E | required | bisection on the exact rational area of the graph minus the formula (independent of the quadrature + Brent roo |
| g_avg_value_intersection_graph | 8.1 | 2.D | not_allowed | sign changes of f - c counted on an 8001-point grid of the interpolated graph with c from numerical quadrature |
| g_direction_changes_count_graph | 4.2 | 2.D | not_allowed | sign changes of v counted on a 5001-point grid of the interpolated graph, skipping zeros (independent of the e |
| g_integral_even_function_graph | 6.6 | 1.D | not_allowed | numerical quadrature of f(/x/) + c x over [-4, 4] (independent of the symmetry argument) |
| g_integral_piecewise_graph_formula_calc | 6.6 | 1.D | required | composite Simpson rule on the piecewise function with the graph interpolated (independent of the split into ex |
| g_linear_combo_two_graphs | 2.6 | 1.E | not_allowed | central difference (step 1e-6) of the numerically interpolated combination (independent of the term-by-term ru |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_avg_vs_instant_rate_calc | 2.1 | 1.D | required | difference quotient from the lambdified function and a central difference (step 1e-6) for the instantaneous ra |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_x_sec_derivative_calc | 2.10 | 1.C | required | central difference (step 1e-6) of k x sec x (independent of the derivative formulas) |
| g_chain_exp_graph_calc | 3.1 | 1.C | required | central difference (step 1e-6) of e^(g/2) with g interpolated (independent of the chain rule) |
| g_chain_graph_outer_calc | 3.1 | 1.E | required | central difference (step 1e-6) of g(u(x)) with g interpolated (independent of the chain rule) |
| g_cont_k_graph_log_calc | 1.11 | 1.E | required | the right-hand piece evaluated just to the right of x = 2 with the computed k and compared with the plotted f( |
| g_ivt_sum_graph_calc | 1.16 | 3.D | required | dense grid scan of h on the open interval: the key lies strictly between the endpoint values and every wrong v |
| g_parallel_tangent_formula_calc | 2.7 | 2.B | required | bisection with 100 halvings on a central-difference slope minus m (independent of Brent's method and the symbo |
| g_product_formula_graph_calc | 2.8 | 1.E | required | central difference (step 1e-6) of the numerically interpolated product (independent of the product rule) |
| g_quotient_formula_graph_calc | 2.9 | 1.E | required | central difference (step 1e-6) of the numerically interpolated quotient (independent of the quotient rule) |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_choose_differentiable_at_point | 2.4 | 2.D | not_allowed | numerical one-sided difference quotients (step 1e-7) of all four functions at the point |
| c_cont_three_pieces_two_unknowns | 1.12 | 1.E | not_allowed | substitute the constants back and compare the piece values at x = 1 and x = 3 numerically |
| c_count_corners_abs_polynomial | 2.4 | 2.D | not_allowed | one-sided difference quotients of /P/ (step 1e-6) at each zero |
| c_count_vertical_asymptotes | 1.14 | 1.D | not_allowed | numerical evaluation of /f/ just left and right of each denominator zero (independent of the factor cancellati |
| c_derivative_sec_csc_cot_exact | 2.10 | 1.C | not_allowed | central difference (step 1e-6) of the lambdified function at the angle |
| c_horizontal_tangent_poly_exp | 2.8 | 1.E | not_allowed | central difference of the lambdified f at the key x (zero slope) and at the other root |
| c_ivt_root_interval_polynomial | 1.16 | 3.D | not_allowed | numpy.roots of the cubic: exactly one real root lies in the key interval |
| c_lim_inf_difference_of_radicals | 1.7 | 1.E | not_allowed | direct evaluation at x = 10^9 with 40-digit arithmetic (independent of the conjugate algebra) |
| c_lim_inf_equal_degree | 1.15 | 1.C | not_allowed | direct evaluation of the rational expression at x = 10^7 (independent of the leading coefficient rule) |
| c_lim_neg_inf_radical | 1.15 | 1.E | not_allowed | direct evaluation at x = -10^8 with 30-digit arithmetic (independent of the /x/ algebra) |
| c_limit_is_derivative_exact | 2.2 | 2.C | not_allowed | central difference (step 1e-6) of g at the point |
| c_limit_two_point_difference_quotient | 2.2 | 2.C | not_allowed | linear model f(x) = d x evaluated directly in the difference quotient (independent of the splitting argument) |
| c_normal_slope_power_ln | 2.7 | 1.D | not_allowed | central difference (step 1e-6) of the lambdified function at x = e, then the negative reciprocal |
| c_one_sided_abs_quotient | 1.3 | 1.E | not_allowed | numerical evaluation of the quotient at x = a minus or plus 1e-8 on the stated side (independent of the algebr |
| c_piecewise_differentiable_two_constants | 2.4 | 3.E | not_allowed | substitute the constants back and compare the values and the left and right difference quotients numerically a |
| c_product_power_times_unknown_function | 2.8 | 1.C | not_allowed | model g(x) = g(a) + g'(a)(x - a) and a central difference of x^n g(x) at a (independent of the product rule fo |
| c_quotient_rule_trig_exp_value | 2.9 | 1.C | not_allowed | central difference (step 1e-6) of the lambdified quotient at the evaluation point |
| c_removable_value_power_ratio | 1.13 | 1.E | not_allowed | numerical average of f(a - 1e-6) and f(a + 1e-6) (independent of factoring) |
| c_rewrite_then_differentiate_root_denominator | 2.5 | 2.C | not_allowed | central difference (step 1e-6) of the lambdified original quotient |
| c_squeeze_polynomial_bounds | 1.8 | 3.D | not_allowed | numerical evaluation of both bounds just beside the approach point (independent of the substitution) |
| c_tangent_y_intercept_power_exp | 2.8 | 1.D | not_allowed | central difference (step 1e-6) of the lambdified function for the slope, then y-intercept f(a) - a * slope |
| c_trig_limit_sine_ratio | 1.5 | 1.C | not_allowed | direct evaluation at x = 1e-5 (independent of the special limit) |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_accum_two_limits | 6.4 | 1.E | not_allowed | central difference (step 1e-5) of F(x) computed by numerical quadrature (independent of the Fundamental Theore |
| c_antideriv_power_rules | 6.8 | 1.C | not_allowed | derivative of each option checked symbolically and by a central difference at x = 1.7 (independent of the term |
| c_area_between_in_y | 8.5 | 1.D | not_allowed | scipy quad of /line - y^2/ over the interval between the roots (independent of the sign analysis and exact ant |
| c_area_crossing_setup | 8.4 | 1.D | not_allowed | scipy quad of /kx - x^3/ over the full interval with a break point at 0 (independent of the split setup); each |
| c_area_exp_between | 8.4 | 1.D | not_allowed | scipy quad of e^x - e^-x on [0, ln b] (independent of the antiderivative) |
| c_complete_square_arctan | 6.10 | 1.E | not_allowed | scipy quad of the integrand (independent of the completed-square antiderivative) |
| c_distance_minus_displacement | 8.2 | 1.E | not_allowed | scipy quad of /v/ minus scipy quad of v over [0, T] with break points at the zeros (independent of the piece-b |
| c_integral_abs_poly | 6.7 | 1.E | not_allowed | scipy quad of abs(x^2 - kx) with the break point at x = k (independent of the manual split) |
| c_longdiv_integral | 6.10 | 1.E | not_allowed | scipy quad of the original quotient (independent of the long division) |
| c_mvt_integral_value | 8.1 | 3.D | not_allowed | root of f(c) minus the numerical average (scipy quad / Brent) (independent of the exact integral) |
| c_position_from_velocity | 8.2 | 1.D | not_allowed | scipy quad of the velocity over [0, T] added to the initial position (independent of the antiderivative evalua |
| c_separable_general_solution | 7.7 | 1.E | not_allowed | implicit differentiation of each relation (symbolic) evaluated at (x, y) = (1.3, 1.7): only the key satisfies  |
| c_sigma_to_integral | 6.3 | 2.C | not_allowed | a right Riemann sum with 400000 subintervals compared with the exact integral value (independent of the symbol |
| c_slope_sign_points | 7.3 | 2.D | not_allowed | evaluation of the formula at every option point and at nearby points by brute force (independent of the factor |
| c_trapezoid_table_initial | 6.2 | 1.E | not_allowed | scipy.integrate.trapezoid applied to the table times and values plus the initial amount (independent of the ha |
| c_usub_indef_trig | 6.9 | 1.E | not_allowed | central difference of each antiderivative at x = 0.9 compared with the integrand (independent of the substitut |
| c_usub_limits_transform | 6.9 | 2.C | not_allowed | numerical quadrature of both sides with the concrete continuous function f(u) = 1/(1+u^2); every distractor di |
| c_usub_ln_definite | 6.9 | 1.E | not_allowed | numerical quadrature (scipy) of the integrand compared with the closed form (independent of the substitution) |
| c_volume_disc_y_axis | 8.9 | 1.D | not_allowed | cylindrical shells 2 pi times the integral of x (h - x^n) with scipy quad (independent of the disk setup) |
| c_washer_about_line | 8.10 | 1.D | not_allowed | numerical quadrature of pi times (outer radius squared minus inner radius squared) with scipy (independent of  |
| c_xsection_nonstandard | 8.7 | 1.D | not_allowed | numerical quadrature of the cross-sectional area function with scipy (independent of the symbolic integration) |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_accel_at_rest_calc | 4.2 | 1.E | required | second central difference (step 1e-4) of the position at the root (independent of the symbolic derivatives) |
| c_linearization_error_calc | 4.6 | 1.F | required | actual value recomputed with 30-digit sympy evaluation and compared with the floating-point value (independent |
| c_marginal_cost_meaning_calc | 4.3 | 3.F | required | central difference (step 1e-5) of C and the average cost C(q0)/q0 computed separately (independent of the prod |
| c_motion_first_reversal_calc | 4.2 | 1.E | required | bisection (separate implementation) on v and a sign check on both sides of the root (independent of Brent's me |
| c_related_rates_cylinder_calc | 4.5 | 1.E | required | central difference (step 1e-6) of V(t) with r(t) and h(t) linear in t (independent of implicit differentiation |
| c_related_rates_shadow_calc | 4.5 | 1.D | required | the ground intercept of the line from the lamp top through the head, differentiated numerically with respect t |
| c_temperature_rate_calc | 4.3 | 1.E | required | central difference (step 1e-6) of T (independent of the chain rule) |
| c_water_depth_rate_calc | 4.3 | 1.E | required | bisection (separate implementation) for the time and a central difference for the rate (independent of Brent's |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_abs_extremum_cubic | 5.5 | 1.E | not_allowed | maximum or minimum of the lambdified function over a 20001-point grid (independent of the candidate test) |
| c_abs_max_candidates_calc | 5.5 | 1.E | required | maximum of f over a 6001-point grid on [0, 6] compared with the candidate values (independent of the candidate |
| c_arc_trig_deriv_value | 3.4 | 1.E | not_allowed | central difference (step 1e-6) of the lambdified function (independent of the inverse-trig formula) |
| c_box_min_surface | 5.11 | 1.E | not_allowed | grid minimum of $S(x)=x^{2}+4V/x$ over a 60001-point grid (independent of the derivative) |
| c_chain_exp_cos_point | 3.1 | 1.E | not_allowed | central difference (step 1e-6) of the lambdified function at the numeric point (independent of the symbolic ch |
| c_concave_xnlnx | 5.6 | 1.E | not_allowed | sign change of a second central difference found with brentq (independent of the symbolic second derivative) |
| c_conditions_at_point | 5.9 | 2.E | not_allowed | central difference of $f'$ at the point to check the sign of $f''$ (independent of the symbolic derivative) |
| c_critical_points_cusp | 5.2 | 1.D | not_allowed | root of the numerical derivative on a bracket and the size of the slope near $x=0$ (independent of the symboli |
| c_decreasing_rational | 5.3 | 1.E | not_allowed | sign of a central-difference derivative at a point in each of the four intervals (independent of the factored  |
| c_first_deriv_test_trig | 5.4 | 3.D | not_allowed | sign changes of $f'$ on a 40000-point grid of $(0,2\pi)$ (independent of solving $f'=0$) |
| c_implicit_cubic_horizontal_x | 3.2 | 1.E | not_allowed | grid scan of the upper branch $Y(x)=\sqrt{x^{3}-3ax^{2}+k}$ for interior local extrema (independent of the imp |
| c_implicit_tangent_line_eq | 3.2 | 1.E | not_allowed | solve the curve numerically for $y(x)$ near the point and take a central difference (independent of implicit d |
| c_inverse_deriv_formula | 3.3 | 1.E | not_allowed | root-finding for $f(z)=b\pm h$ and a central difference of the numerical inverse (independent of the formula $ |
| c_lhopital_inf_inf | 4.7 | 1.E | not_allowed | direct evaluation of the quotient at $x=40$ (independent of L'Hospital's Rule) |
| c_lhopital_twice_zero | 4.7 | 1.E | not_allowed | direct evaluation of the quotient at $x=10^{-3}$ (independent of L'Hospital's Rule) |
| c_log_trig_deriv_expr | 3.5 | 1.C | not_allowed | central difference of the lambdified function compared with the key expression at a numeric point (independent |
| c_mvt_hypotheses | 5.1 | 3.C | not_allowed | numerical difference quotients and blow-up tests at the suspicious point of each choice (independent of the ca |
| c_mvt_must_be_true | 5.1 | 3.D | not_allowed | test the statements on a linear function and on a function with an added bump, on a 4000-point grid (independe |
| c_product_sqrt_chain_value | 3.5 | 1.C | not_allowed | central difference (step 1e-6) of the lambdified function (independent of the symbolic rules) |
| c_related_rates_ladder | 4.5 | 1.E | not_allowed | numerical derivative of $y(t)=\sqrt{L^{2}-(x_0+vt)^{2}}$ (independent of implicit differentiation) |
| c_relative_min_justify_calc | 5.4 | 3.E | required | signs of f' just left and right of the root and the sign of f'' evaluated numerically (independent of the argu |
| c_roc_meaning_polynomial | 4.1 | 3.F | not_allowed | central difference (step 1e-4) of the quadratic model at $t_0$ (independent of the power rule) |
| c_second_deriv_product_exp | 3.6 | 1.E | not_allowed | second central difference (step 1e-3) of the lambdified function (independent of symbolic differentiation) |
| c_second_deriv_test_justify_calc | 5.7 | 3.D | required | central difference of f' at the critical point compared with the closed form of f'' (independent of the algebr |
| c_second_deriv_test_quartic | 5.7 | 3.D | not_allowed | numerical comparison of $f$ near $x=0$ and $x=3p$ (independent of the derivative tests) |
| c_speeding_up_intervals | 4.2 | 2.D | not_allowed | numerical derivative of $/v(t)/$ at one sample point inside each interval (independent of the sign chart) |
| g_critical_point_graph_formula_calc | 5.2 | 1.E | required | bisection with 100 halvings on f'(x) - g'(x) with f' interpolated (independent of Brent's method) |
| g_mvt_sum_graph_formula_calc | 5.1 | 3.D | required | bisection on f'(c) + p'(c) minus the average, with the signed area recomputed by numerical quadrature (indepen |
| g_relative_max_graph_formula_calc | 5.4 | 3.E | required | bisection on the first zero of f' - g' and a count of sign changes on a 2401-point grid (independent of Brent' |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_accum_abs_max_x_calc | 6.5 | 3.E | required | composite Simpson rule (20001 nodes) for F at the candidate point (independent of scipy quad) |
| c_accum_increasing_interval_calc | 6.5 | 3.E | required | sign of the integrand sampled inside each of the three intervals (independent of the root-finding) |
| c_area_wrt_y_calc | 8.5 | 1.D | required | composite Simpson rule on (right - left) with the limit from Brent's method (independent of scipy quad) |
| c_decay_two_points_calc | 7.8 | 1.E | required | Runge-Kutta numerical integration of dy/dt = -ky with k from the two data points (independent of the exponenti |
| c_equilateral_cross_section_calc | 8.8 | 1.D | required | composite Simpson rule (20001 nodes) on the squared side (independent of scipy quad) |
| c_ftc_two_limits_calc | 6.4 | 1.D | required | central difference (step 1e-5) of G computed by numerical quadrature (independent of the Fundamental Theorem) |
| c_horizontal_asymptotes_exp_ratio | 1.15 | 1.D | not_allowed | direct evaluation of f at x = 40 and x = -40 (independent of the dominant-term argument) |
| c_integral_meaning_calc | 8.3 | 3.F | required | composite Simpson rule (20001 nodes) for the integral and the average (independent of scipy quad) |
| c_speed_change_justify_calc | 4.2 | 3.E | required | central difference (step 1e-6) of v for the acceleration and a direct evaluation of v (independent of the symb |
| c_trapezoid_formula_calc | 6.2 | 1.E | required | average of the left and right sums computed separately (independent of the trapezoid weights) |
| g_area_sin_line_calc | 8.4 | 1.D | required | composite Simpson rule on f - L between Brent-found roots (independent of scipy quad) |
| g_exp_time_graph_calc | 7.8 | 1.E | required | the model value P(0) e^{k t} evaluated at the computed time and compared with the target (independent of the l |
| g_net_amount_formula_graph_calc | 8.3 | 1.D | required | composite Simpson rule (20001 nodes) on R - L with L interpolated (independent of splitting into two integrals |

보강(supplement, 2026-10-09 오너 승인) 원형:

| id | topic | skill | calculator | verified by |
|---|---|---|---|---|
| c_limit_laws_from_given_limits | 1.6 | 1.C | not_allowed | evaluate the expression for the concrete linear functions f(x) = p + (x - c) and g(x) = q - 2(x - c) at x = c  |

예비 3차(R3, 2026-10-12) FRQ 템플릿:

| id | template | topic | skill | calculator | parts |
|---|---|---|---|---|---|
| frq_accum_charge | accumulation_function_analysis_calc | 6.5 | 3.E | required | a During a charging test, the current into a small battery is (2) / b Find the average rate of change of $Q$ over the interval $2\ (2) / c For $0\le x |
| frq_cooling_check | cooling_model_check_tangent_calc | 7.3 | 1.E | required | a A cast-iron pan is taken out of an oven and left in a kitche (2) / b Write an equation for the line tangent to the curve $y=T(t)$ (2) / c Is the app |
| frq_exp_decay_de | exponential_decay_model_de | 7.8 | 1.E | not_allowed | a A sealed capsule holds $80$ grams of a radioactive tracer. L (3) / b The half-life of the tracer is $4$ years, that is, $M(4)=\fr (1) / c At what ti |
| frq_inverse_table | inverse_function_table_derivatives | 3.3 | 1.E | not_allowed | a The function $f$ is differentiable and increasing on $1\le x (2) / b Let $h(x)=x\cdot f^{-1}(x)$. Find $h'(13)$. (2) / c Find the value of $\int_{1} |
| frq_ivp_antiderivative | derivative_formula_initial_value | 4.6 | 1.E | not_allowed | a A function $f$ satisfies $f'(x)=-2xe^{-x^2}$ for all real $x (2) / b Is the approximation from part (a) an overestimate or an und (2) / c Find $f(x) |
| frq_limits_continuity | limits_lhopital_continuity | 4.7 | 1.E | not_allowed | a Find $\lim_{x\to 2}\frac{x^2-4}{\ln x-\ln 2}$. Show the work (3) / b Let $g$ be the function defined by $g(x)=\frac{x^2-4}{\ln x- (1) / c Find $\lim |
| frq_marginal_profit | marginal_profit_calc | 5.10 | 3.E | required | a A workshop makes and sells $q$ hundred custom phone cases pe (2) / b The profit is $P(q)=R(q)-C(q)$, where $R$ and $C$ are the re (3) / c Find the i |
| frq_pen_cost | optimization_cost_divided_pen | 5.11 | 3.E | not_allowed | a A farmer builds a rectangular pen against a long stone wall, (2) / b Find the value of $x$ for which $C'(x)=0$. (2) / c Use the second derivative to |
| frq_rational_param | parametric_rational_global_extrema | 5.2 | 3.E | not_allowed | a Let $f$ be the function given by $f(x)=\frac{Ax}{x^2+B}$, wh (3) / b For the values of $A$ and $B$ found in part (a), find $\lim_ (1) / c Show that  |
| frq_trench_volume | cross_section_table_model_calc | 8.2 | 1.E | required | a A drainage trench is dug along a straight line for $20$ mete (3) / b The area function is modeled by $A(x)=14+4\sin\left(\dfrac{x (2) / c Find $A'(8 |

예비 3차(R3, 2026-10-12) FRQ 템플릿:

| id | template | topic | skill | calculator | parts |
|---|---|---|---|---|---|
| frq_arctan_zeros | inverse_tangent_function_analysis | 3.4 | 3.E | not_allowed | a Let $f$ be the function defined by $f(x)=8\arctan x-2x$ for (2) / b Show that $f$ has a relative maximum at $x=\sqrt{3}$, and fi (2) / c Find $\lim_ |
| frq_closest_point | closest_point_to_curve_calc | 5.10 | 3.E | required | a A drone flies along the path $y=\ln x$ for $0.5\le x\le 8$, (2) / b Find the value of $x$ for which the drone is closest to the (3) / c At the point |
| frq_ftc_chain_limit | accumulation_function_variable_limit | 6.4 | 1.E | not_allowed | a Let $H$ be the function defined by $H(x)=\int_0^{x^2}\left(e (2) / b Write an equation for the line tangent to the curve $y=H(x)$ (2) / c Find the $ |
| frq_region_bisect | region_bisecting_line_calc | 8.4 | 1.E | required | a Let $R$ be the region in the first quadrant enclosed by the (2) / b Find the area of $R$. Show the setup for your calculation. (2) / c The vertical  |
