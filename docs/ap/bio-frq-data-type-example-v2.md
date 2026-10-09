# Bio FRQ 데이터형 v2 — 완성 풀이 예시와 비평 (검토용, 2026-10-09)

코드가 생성한 번들 1개(시드 1800)를 그대로 옮겼다. **유료 호출 없음 — 이 설계는 검토기로 검증된 적이 없다.** 무료 결정적 검사 통과는 구조적 안정성 증거일 뿐 개념적 타당성이나 실제 품질의 증거가 아니다. 탐구형(investigation) 결과와는 별개다.

## 평가 목적(파트별 역할)
| 파트 | 평가 목적 | 스킬 | 필요한 사고 | 효소 개념이 필요한 곳 |
|---|---|---|---|---|
| A (1점) | table_interpretation | 4.B (Practice 4: Representing and Describing Data: Describe data from a table or graph) | 표 읽기(값 인용)와 추세 진술. 생물학 개념 불필요. | 없음 — 표의 값만 필요하다. |
| B (1점) | quantitative_analysis | 5.A (Practice 5: Statistical Tests and Data Analysis: Perform mathematical calculations) | 한 단계 계산(퍼센트 변화). 개념 불필요. | 없음 — 산술. |
| C (1점) | statistical_reasoning | 5.B (Practice 5: Statistical Tests and Data Analysis: Use confidence intervals and error bars) | ±2SE 범위 비교로 차이가 지지되는지 판단. 통계 추론, 개념 불필요. | 없음 — 범위 겹침 규칙(통계). |
| D (1점) | biological_explanation | 6.B (Practice 6: Argumentation: Support a claim with evidence); 4.B (Practice 4: Representing and Describing Data: Describe data from a table or graph) | 자료로 주장을 뒷받침하고, 낮은 수준에서 활성이 낮은 **생물학적 이유**를 설명. | 여기서만 필요: 최적에서 벗어난 조건이 효소 모양·활성 부위에 영향 → 활성 감소(토픽 3.2 개념). |

## 자료

**Data analysis: a catalase-catalyzed reaction** — Mean oxygen released in 2 minutes (milliliters) ± 2SE for a catalase-catalyzed reaction at three levels of temperature. n = 8 replicates per level.

| Temperature | Mean (milliliters) ± 2SE | n |
|---|---|---|
| 10 °C | 4.9 ± 0.56 | 8 |
| 37 °C | 16.1 ± 1.46 | 8 |
| 70 °C | 2.6 ± 0.30 | 8 |

## 문제·모범 답·채점 가이드
### 파트 A (1점, table_interpretation)

**문제**: Describe how the oxygen released in 2 minutes changes across the three levels of temperature, and identify the level with the greatest oxygen released in 2 minutes. Use values from the table to support your description.

**모범 답**: The oxygen released in 2 minutes peaks across the levels (4.9, 16.1, 2.6); it is greatest at 37 °C (16.1).

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 A1 (1점): Describes the direction of change across all three levels, identifies the level with the greatest value, and cites table values
  - 인정해야 하는 의미: Describes the direction of change of the mean across the three levels consistent with the data / Identifies the level with the greatest mean and cites at least one table value
  - 허용 표현 예(전부가 아님): rises then falls; highest at the middle level
  - 흔한 오류: describes only one pair of levels; describes a trend the data do not show; names a level that is not the greatest
  - 채점 메모: Table interpretation (skill 4.B): no biology concept is required for this point.

### 파트 B (1점, quantitative_analysis)

**문제**: Calculate the percent change in the oxygen released in 2 minutes from 70 °C to 37 °C. Show your work.

**모범 답**: ((16.1 - 2.6) / 2.6) x 100 = 519.2%.

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 B1 (1점): Percent change with work shown (answer)
  - 인정해야 하는 의미: Computes the percent change correctly with a valid method (new minus old, divided by old, times 100)
  - 허용 표현 예(전부가 아님): percent change = (new - old) / old x 100
  - 흔한 오류: divides by the new value; forgets to multiply by 100
  - 채점 메모: Quantitative analysis (skill 5.A): award for the correct value with a valid method; equivalent forms and rounding within the tolerance are accepted. No biology concept is required.

### 파트 C (1점, statistical_reasoning)

**문제**: Using the ±2SE values, determine whether the difference between the mean oxygen released in 2 minutes at 37 °C and at 10 °C is statistically supported. Justify your answer with the ±2SE ranges.

**모범 답**: 37 °C: 14.64 to 17.56; 10 °C: 4.34 to 5.46. The ranges do not overlap, so the difference is supported.

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 C1 (1점): States whether the difference is supported and justifies it by comparing the ±2SE ranges of the two levels
  - 인정해야 하는 의미: Correctly states whether the difference between the two levels is statistically supported / Justifies by comparing the ±2SE ranges of the two levels (overlap or separation)
  - 허용 표현 예(전부가 아님): the ranges are separated so the difference is supported; compares the mean ± 2SE intervals of the two levels
  - 흔한 오류: compares only the means; states the wrong conclusion for the ranges
  - 채점 메모: Statistical reasoning (skill 5.B): no biology concept is required for this point.

### 파트 D (1점, biological_explanation)

**문제**: A student claims that oxygen released in 2 minutes is greatest at 37 °C. Use the data to support the claim, and explain a biological reason why the oxygen released in 2 minutes is lower at 70 °C than at 37 °C.

**모범 답**: The mean at 37 °C (16.1 ± 1.46) is the highest; at 70 °C the mean is 2.6. temperature far from the enzyme's optimum reduces activity (too cold: fewer effective collisions; too hot: denaturation changes the active site).

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 D1 (1점): Supports the claim with data and explains the lower value by the effect of the condition on enzyme structure and function
  - 인정해야 하는 의미: Supports the claim with data from the table (the highest mean compared with the others) / Explains that a condition away from the optimum alters the enzyme's shape (active site), lowering activity
  - 허용 표현 예(전부가 아님): the condition changes the enzyme's shape so substrate binds less well; denaturation of the enzyme reduces the rate away from the optimum
  - 흔한 오류: cites the highest mean but gives no structural explanation; attributes the change to the substrate running out
  - 채점 메모: Biological explanation (skill 6.B and the topic 3.2 concept): this is the point that requires the enzyme concept. Award both elements for the point.

### 구조화 기대값(루브릭 문장과 분리)

| 파트 | 양 | 값 | 단위 | 허용 오차 |
|---|---|---|---|---|
| B | percent change | 519.2 | % | 5.19 |
| A | greatest mean at 37 °C | 16.1 | milliliters | 0.05 |

루브릭 `required_elements` 의 설명 문장은 수치 비교의 출처가 아니다(솔버 일치 검사는 이 표만 읽는다).

## 무료 검사 결과(구조적 안정성)
- 이 번들: 공통 규칙(a)(c) + 원형 내부 설계 조건(b) + 설계도 모두 통과.
- 새 시드 60개(1800~1859) 전부 통과 — **구조적 안정성 증거일 뿐이다**(개념적 타당성·실제 품질 아님).

## 정직한 비평(이 번들이 목표 개념·스킬을 충분히 평가하는가)
**스킬 평가는 대체로 충분하다**: 4.B 표 해석(A), 5.A 정량(B), 5.B 통계 추론(C), 6.B 논증(D)이 파트마다 하나씩 분리되어 공식 짧은 FRQ 의 4×1점 입자와 맞는다.
**목표 개념(토픽 3.2 효소 기능에 대한 환경 영향) 평가는 얇다**: 개념이 필요한 것은 D 한 파트(4점 중 1점, 25%)뿐이다. 이 번들은 개념 이해 평가라기보다 **데이터 분석 번들에 개념 설명이 하나 붙은 형태**다. 개념 평가를 더 늘리려면 점수 입자(1점 4파트)를 바꾸거나 별도 개념 번들이 필요하다 — 모든 파트에 개념 키워드를 넣는 방식은 쓰지 않았다(키워드 채우기).
**약점**: (1) A·B·C 는 여전히 표만 보면 풀린다(의도된 설계 — 공식 데이터 스킬이 그렇다). (2) D 한 점에 '자료로 뒷받침' + '생물학적 이유' 두 요소를 모두 요구해 1점이 가혹할 수 있고 부분 점수가 없다. (3) C 의 답이 이진(지지됨/아님)이라 추측 가능성이 있다 — **초기 설계는 새 시드 60개 모두 '지지됨'(항상 같은 정답)이라는 결함이 있었고**, 수준 구성을 spread/near 두 가지로 나눠 고친 뒤 '지지됨' 39/60(65%)이다(완전 균형은 아님). 추세 분포는 {"peaks":51,"decreases":9} 로 'peaks' 위주라 다양성이 낮다. NaN

## 판단
이 번들은 **데이터 스킬 평가 번들로는 쓸 만하고, 토픽 3.2 개념 평가로는 부족하다.** 다음 유료 검증 전에 오너가 (a) 이 역할 분담을 승인하고 (b) D 의 1점 구성을 유지할지 정해야 한다.
