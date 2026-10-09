# Bio FRQ 데이터형 v2 — 완성 풀이 예시와 비평 (오너 승인 구조, 2026-10-09 개정)

코드가 생성한 번들 1개(시드 1900)를 그대로 옮겼다. **오너 결정(2026-10-09): 이 번들은 데이터 해석 + 정량 분석 번들이며 효소 개념은 파트 D 에서만 평가한다. 번들을 토픽 3.2 를 넓게 평가하는 것으로 표기하지 않고, 약점 분석에서는 D 만 개념 수준 증거에 기여한다(A–C 점수를 효소 개념 숙달로 합산 금지).** 무료 결정적 검사 통과는 구조적 안정성 증거일 뿐 개념적 타당성이나 실제 품질의 증거가 아니다. 탐구형(investigation) 결과와는 별개다.

## 평가 목적(파트별 역할)
| 파트 | 평가 목적 | 스킬 | 필요한 사고 | 효소 개념이 필요한 곳 |
|---|---|---|---|---|
| A (1점) | table_interpretation | 4.B (Practice 4: Representing and Describing Data: Describe data from a table or graph) | 표 읽기(값 인용)와 추세 진술. 생물학 개념 불필요. | 없음 — 표의 값만 필요하다. |
| B (1점) | quantitative_analysis | 5.A (Practice 5: Statistical Tests and Data Analysis: Perform mathematical calculations) | 한 단계 계산(퍼센트 변화). 개념 불필요. | 없음 — 산술. |
| C (1점) | statistical_reasoning | 5.B (Practice 5: Statistical Tests and Data Analysis: Use confidence intervals and error bars) | ±2SE 범위 비교로 차이가 지지되는지 판단. 통계 추론, 개념 불필요. | 없음 — 범위 겹침 규칙(통계). |
| D (1점) | biological_explanation | 6.C (Practice 6: Argumentation: Provide reasoning connecting evidence to theory) | 하나의 설명: 표의 값(증거)을 효소 구조에 대한 지식(이론)과 연결해 낮은 값을 설명(6.C: 증거를 이론과 연결하는 추론). | 여기서만 필요: 최적에서 벗어난 조건이 효소 모양·활성 부위에 영향 → 활성 감소(토픽 3.2 개념). |

## 자료

**Data analysis: an amylase-catalyzed reaction** — Mean initial reaction rate (micromoles per minute) ± 2SE for an amylase-catalyzed reaction at three levels of pH. n = 8 replicates per level.

| pH | Mean (micromoles per minute) ± 2SE | n |
|---|---|---|
| pH 5 | 14.2 ± 1.72 | 8 |
| pH 7 | 17.6 ± 2.02 | 8 |
| pH 9 | 7.7 ± 0.98 | 8 |

## 문제·모범 답·채점 가이드
### 파트 A (1점, table_interpretation)

**문제**: Describe how the initial reaction rate changes across the three levels of pH, and identify the level with the greatest initial reaction rate. Use values from the table to support your description.

**모범 답**: The initial reaction rate peaks across the levels (14.2, 17.6, 7.7); it is greatest at pH 7 (17.6).

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 A1 (1점): One description of the pattern across the levels, supported by table values (the level with the greatest value is part of the description)
  - 인정해야 하는 의미: A description of how the mean changes across the three levels, supported by table values and naming the level with the greatest mean
  - 허용 표현 예(전부가 아님): rises then falls; highest at the middle level
  - 흔한 오류: describes only one pair of levels; describes a trend the data do not show; names a level that is not the greatest
  - 채점 메모: Table interpretation (skill 4.B): no biology concept is required for this point.

### 파트 B (1점, quantitative_analysis)

**문제**: Calculate the percent change in the initial reaction rate from pH 9 to pH 7. Show your work.

**모범 답**: ((17.6 - 7.7) / 7.7) x 100 = 128.6%.

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 B1 (1점): Percent change with work shown (answer)
  - 인정해야 하는 의미: Computes the percent change correctly with a valid method (new minus old, divided by old, times 100)
  - 허용 표현 예(전부가 아님): percent change = (new - old) / old x 100
  - 흔한 오류: divides by the new value; forgets to multiply by 100
  - 채점 메모: Quantitative analysis (skill 5.A): award for the correct value with a valid method; equivalent forms and rounding within the tolerance are accepted. No biology concept is required.

### 파트 C (1점, statistical_reasoning)

**문제**: Using the ±2SE values, determine whether the difference between the mean initial reaction rate at pH 7 and at pH 5 is statistically supported. Justify your answer with the ±2SE ranges.

**모범 답**: pH 7: 15.58 to 19.62; pH 5: 12.48 to 15.92. The ranges overlap, so the difference is not supported.

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 C1 (1점): States whether the difference is supported and justifies it by comparing the ±2SE ranges of the two levels
  - 인정해야 하는 의미: Correctly states whether the difference between the two levels is statistically supported / Justifies by comparing the ±2SE ranges of the two levels (overlap or separation)
  - 허용 표현 예(전부가 아님): the ranges overlap so the difference is not supported; compares the mean ± 2SE intervals of the two levels
  - 흔한 오류: compares only the means; states the wrong conclusion for the ranges
  - 채점 메모: Statistical reasoning (skill 5.B): no biology concept is required for this point.

### 파트 D (1점, biological_explanation)

**문제**: Explain why the initial reaction rate is lower at pH 9 than at pH 7. Use data from the table as evidence and connect it to what you know about enzymes.

**모범 답**: At pH 9 the mean is 7.7 compared with 17.6 at pH 7. pH far from the enzyme's optimum changes the shape of the enzyme (denaturation), so the active site binds substrate less effectively, which explains the lower value in the data.

**채점(의미·추론으로 채점, 특정 문구 요구 없음)**

- 행 D1 (1점): One reasoned explanation that connects the data (the lower value at the stated level compared with the highest) to the effect of the condition on enzyme shape and active site, so activity is reduced
  - 인정해야 하는 의미: A single reasoned explanation that connects the data (the lower value at the stated level compared with the highest) to the effect of the condition on enzyme shape and active site, so activity is reduced
  - 허용 표현 예(전부가 아님): the condition at the lower level changes the enzyme's shape, so substrate binds less well, which is why the table shows the lower value; denaturation of the enzyme at that level reduces the rate seen in the data
  - 흔한 오류: cites the numbers but gives no biological reason (evidence without reasoning); gives the mechanism with no reference to the data (reasoning without evidence); attributes the lower value to the substrate running out or to the enzyme being used up
  - 채점 메모: ONE explanation completed by a claim-evidence relationship (skill 6.C: reasoning that connects evidence to theory). Award the point only when the response connects the data to the enzyme-structure mechanism in one explanation. Data alone or mechanism alone earns no point: these are the two halves of one explanation, not separately scored elements.

### 구조화 기대값(루브릭 문장과 분리)

| 파트 | 양 | 값 | 단위 | 허용 오차 |
|---|---|---|---|---|
| B | percent change | 128.6 | % | 1.29 |
| A | greatest mean at pH 7 | 17.6 | micromoles per minute | 0.05 |

루브릭 `required_elements` 의 설명 문장은 수치 비교의 출처가 아니다(솔버 일치 검사는 이 표만 읽는다).

## 파트 D 결정: 하나의 설명(주장-증거 관계로 완성)

- **결정**: D 의 1점은 독립 요구 두 개가 아니라 **하나의 설명**이다 — 표의 값(증거)을 효소 구조에 대한 지식(이론)과 연결해 낮은 값을 설명한다(스킬 6.C: 증거를 이론과 연결하는 추론). 증거 없는 기제나 기제 없는 숫자 인용은 이 설명의 반쪽일 뿐 따로 채점하지 않는다. 그래서 4×1점 입자를 유지하는 것이 정당하다(파트가 하나의 스킬만 평가).
- **모범 답**: At pH 9 the mean is 7.7 compared with 17.6 at pH 7. pH far from the enzyme's optimum changes the shape of the enzyme (denaturation), so the active site binds substrate less effectively, which explains the lower value in the data.
- **부분 답과 점수**: (1) 숫자만 인용하고 생물학적 이유 없음(증거만) → 0점. (2) 효소 모양·활성 부위 기제만 말하고 표의 값과 연결하지 않음(이론만) → 0점. (3) 값과 기제를 한 설명으로 연결(예: "표의 낮은 값은 그 수준에서 효소 모양이 바뀌어 기질 결합이 줄었기 때문") → 1점. 부분 점수는 없다.
- **오답 예**: 낮은 값을 기질 고갈·효소 소모 탓으로 돌림; 최적 조건과 무관한 일반론; 값을 반대로 해석.
- **채점 규칙**: 하나의 기준(single_explanation). 자료 인용과 기제를 모두 포함하고 서로 연결되어야 한다. 표현은 달라도 의미가 같으면 인정.

## 약점 분석 귀속(메타데이터)
- `weakness_attribution`: 개념 수준(토픽 3.2) 증거 = D 만. 데이터 스킬 증거 = A 4.B, B 5.A, C 5.B. **A–C 점수를 효소 개념 숙달로 합산하지 않는다.** 파트별 `topic_role`(A–C = context, D = assessed)과 `evidence_role`(data_skill / concept)로 기록하며 코드 훅 `conceptEvidenceParts()`는 ["D"] 만 돌려준다.

## 무료 검사 결과(구조적 안정성)
- 이 번들: 공통 규칙(a)(c) + 원형 내부 설계 조건(b) + 설계도 모두 통과.
- 새 시드 60개(1900~1959) 전부 통과 — **구조적 안정성 증거일 뿐이다**(개념적 타당성·실제 품질 아님).

## 정직한 비평(이 번들이 목표 개념·스킬을 충분히 평가하는가)
**스킬 평가는 대체로 충분하다**: 4.B 표 해석(A), 5.A 정량(B), 5.B 통계 추론(C), 6.B 논증(D)이 파트마다 하나씩 분리되어 공식 짧은 FRQ 의 4×1점 입자와 맞는다.
**토픽 3.2 개념 평가는 얇다(의도된 설계)**: 개념이 필요한 것은 D 한 파트(4점 중 1점, 25%)뿐이며 이 번들은 **데이터 해석 + 정량 분석 번들**이다(오너 승인). 번들을 토픽 3.2 를 넓게 평가한다고 표기하지 않는다. 개념 평가를 더 늘리려면 점수 입자(1점 4파트)를 바꾸거나 별도 개념 번들이 필요하다 — 모든 파트에 개념 키워드를 넣는 방식은 쓰지 않았다(키워드 채우기).
**약점**: (1) A·B·C 는 여전히 표만 보면 풀린다(의도된 설계 — 공식 데이터 스킬이 그렇다). (2) D 는 하나의 설명으로 1점이라 부분 점수가 없고, 증거만·이론만 쓴 답은 0점이다(위 결정). 학생이 이론을 알아도 값 연결을 빠뜨리면 점수를 잃는다. (3) C 의 답이 이진(지지됨/아님)이라 추측 가능성이 있다 — **초기 설계는 새 시드 60개 모두 '지지됨'(항상 같은 정답)이라는 결함이 있었고**, 수준 구성을 spread/near 두 가지로 나눠 고친 뒤 '지지됨' 40/60(67%)이다(완전 균형은 아님). 추세 분포는 {"peaks":47,"decreases":13} 로 'peaks' 위주라 다양성이 낮다. NaN

## 판단
데이터 해석 + 정량 분석 번들로 승인된 구조다. 개념(토픽 3.2) 증거는 파트 D 한 점뿐이므로 약점 분석에서 개념 수준 결론을 내리지 않는다.
