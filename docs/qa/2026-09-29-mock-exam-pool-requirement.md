# 2026-09-29 모의고사(MST) 문항 풀 필요량·부족분 분석 (읽기 전용, DB 쓰기 없음)

근거 수치: `docs/qa/2026-09-29-problem-bank-classification.md`(원격 활성 `mock_exam` 303개 = A 195 공개본 + 깨끗한 미공개 초안 108). 조립 규칙: `lib/mock-exam/assemble.ts`(난이도 적합성), `app/admin/mock-exam-actions.ts`(`skillMaxSharePct` 50, 영역 비중), `20261415000000`(영역·난이도 기본 비중, standard 등급).

## 1. 결론
- **R&W는 문항이 절대적으로 부족하다.** 공개 가능한 R&W `mock_exam` 문항은 11개뿐(초안까지 더해도 상한 61개). 세트 1개(R&W 81문항)조차 만들 수 없다.
- **Math는 세트 1~3개 분량의 총량은 있으나 구성이 부족하다.** 공개 184개, 초안 포함 상한 300개 vs 3배 풀 198개. 그러나 `advanced_math`가 공개 25개(필요 69), `algebra` 51(필요 69)로 모자란다. 초안을 공개해야 채워진다.
- 난이도(easy/medium/hard)·모듈별 분포는 분류 보고서에 없어 **실측이 불가능했다**. 아래는 규칙 기반 필요량이며, 난이도 부족분은 원격에서 `mock_exam_pool_usage()`(service_role)로 난이도 열을 더해 재집계해야 확정된다(별도 읽기 작업).

## 2. 필요량 산식
세트 1개 = 모듈 5종 중 문제 모듈: M1 + M2(lower) + M2(higher), 세트 안에서 문항 중복 0.
- R&W: 27 x 3 = **81**, Math: 22 x 3 = **66** (총 147문항/세트).
- **3배 풀 기준** = 세트 1개 필요량 x 3 (한 문항이 평균적으로 세트 3개 중 1개에만 등장하도록): R&W **243**, Math **198**, 합계 **441**.
- 영역 비중(기본값): R&W information 26 / craft 28 / expression 20 / standard 26, Math algebra 35 / advanced 35 / psd 15 / geometry 15.

### 모듈·난이도별 필요 (standard 등급 난이도 비중 easy 25 : medium 50 : hard 25를 모듈 적합 난이도로 재정규화)
적합 난이도: M1·M2 lower = easy·medium, M2 higher = medium·hard(`moduleEligibility`).

| 모듈(경로) | 문항 | easy | medium | hard | 3배 풀(문항) |
|---|---|---|---|---|---|
| rw_m1 | 27 | 9 | 18 | 0 | 81 |
| rw_m2 lower | 27 | 9 | 18 | 0 | 81 |
| rw_m2 higher | 27 | 0 | 18 | 9 | 81 |
| math_m1 | 22 | 7 | 15 | 0 | 66 |
| math_m2 lower | 22 | 7 | 15 | 0 | 66 |
| math_m2 higher | 22 | 0 | 15 | 7 | 66 |

세트당 난이도 합: R&W easy 18 / medium 54 / hard 9, Math easy 14 / medium 44 / hard 8. 3배 풀: R&W easy 54 / medium 162 / hard 27, Math easy 42 / medium 132 / hard 24. (반올림 +-1.) medium이 전체의 절반 이상을 차지하고 hard가 가장 적게 필요하나, **hard 공급이 M2 higher의 유일한 고난도 출처**라 hard 부족 시 higher 경로가 medium 일색이 된다 — 난이도 실측이 중요한 이유.

## 3. 영역별 부족분 (3배 풀 기준, 난이도 무시)
"공개 풀(A)" = 지금 즉시 조립 후보가 되는 공개본. "초안 후보" = 깨끗한 초안 108개가 속할 수 있는 상한(C 영역 합; 실제 108개 중 영역별 분배는 원격 재집계 필요). 조립은 공개 버전이 있는 문항만 쓴다.

| 섹션 | 영역 | 세트 1개 | 3배 풀 | 공개(A) | A 대비 부족 | 초안 상한(C) | A+C 상한 대비 부족 |
|---|---|---|---|---|---|---|---|
| rw | rw_information_ideas | 21 | 63 | 4 | 59 | 16 | 43 |
| rw | rw_craft_structure | 23 | 69 | 3 | 66 | 14 | 52 |
| rw | rw_expression_ideas | 16 | 48 | 4 | 44 | 16 | 28 |
| rw | rw_standard_english | 21 | 63 | 0 | 63 | 4 | 59 |
| math | algebra | 23 | 69 | 51 | 18 | 44 | 0 |
| math | advanced_math | 23 | 69 | 25 | 44 | 33 | 11 |
| math | problem_solving_data | 10 | 30 | 49 | 0 | 27 | 0 |
| math | geometry_trig | 10 | 30 | 59 | 0 | 12 | 0 |
| **합계** | R&W | 81 | 243 | 11 | **232** | 50 | **182** |
| **합계** | Math | 66 | 198 | 184 | **62**(영역별 합) | 116 | **11** |

(Math A 대비 부족 합 = 18 + 44 = 62. 총량 198은 A 184로 14 부족하나, 영역 배분이 맞지 않아 실제 부족은 영역별 합 62.)

세트 **1개**만 만들 경우(필요 = 세트 1개 열): R&W는 모든 영역에서 A만으로 불가(information 4/21, craft 3/23, expression 4/16, standard 0/21). Math는 공개 A만으로 가능(algebra 51/23, advanced 25/23, psd 49/10, geometry 59/10).

## 4. skill 단위 (`skillMaxSharePct` 50 기준)
모듈·영역 안에서 한 skill이 50%를 넘으면 경고(하드 게이트 OFF). 영역 안에서 최소 2개 skill이 필요하고, 모듈당 영역 문항이 3개 이상일 때 검사한다.
- **공급이 한 skill에 쏠린 영역(A 기준)**: geometry_trig은 area_volume 32 + circles 19 = 51/59(86%), lines_angles_triangles 0; algebra는 linear_functions 22(43%)와 linear_equations_one_var 13; advanced_math는 nonlinear_functions 15/25(60%). 모듈 안에서 50% 상한을 지키려면 이 skill들의 상한 때문에 **부족한 skill을 채워야 영역 정원이 나온다**(예: geometry 모듈 영역 정원이 작을 때는 문제없으나, 3배 풀에서는 lines_angles_triangles·right_triangles 보강 필요).
- R&W는 영역별 skill이 대부분 1~4개라 50% 상한을 지킬 수 있는 조합이 거의 없다(예: rw_standard_english A 0개, boundaries·form_structure_sense 초안 4개).
- skill 상세(A / 초안 상한 C)는 분류 보고서 3절 표와 동일하며 본 분석의 영역 합계 근거다. 우선 보강 순위(3배 풀 부족분이 큰 순): R&W standard_english > craft_structure > information_ideas > expression_ideas, Math advanced_math > algebra.

## 5. 권고 (총괄·오너 판단)
1. R&W 신규 문항 생성·검수·공개가 가장 시급(최소 세트 1개 분량 81개, 3배 풀 243개, 영역별 필요 위 표). AI 생성 후 사람 검수 경로(`created_via=ai_generated`)가 필요하다.
2. Math는 advanced_math(필요 69, 공개 25)·algebra(69, 51)를 중심으로 깨끗한 초안 108개 중 해당 영역을 공개해 채운다.
3. 원격에서 `mock_exam_pool_usage()` 결과에 difficulty 열을 더한 읽기 전용 집계로 난이도·skill 실측을 확정한 뒤, 세트 개수(1/2/3)별 출시 가능 여부를 다시 판정한다.
4. 풀 배수(3배)는 제품 결정 — 배수를 2배로 낮추면 R&W 162, Math 132.
