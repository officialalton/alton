# Bio FRQ 완성 풀이 예시와 채점 가이드 (검토용 초안, 2026-10-09)

코드가 생성한 번들 2개(시드 1300)를 그대로 옮겼다. **이 문서가 승인되기 전에는 Bio FRQ 를 추가 생성하거나 수선하지 않는다.** 모든 항목은 가상 실험이며 실제 연구가 아니다. 무료 결정적 검사(`lib/ap-generation/bio-frq-checks.ts`)와 설계도 검증(`blueprint.ts`)은 통과한 상태이며, 결과는 각 예시 끝에 적었다.

## 무료 결정적 검사 목록(LLM 호출 없음)
| 검사 | 막는 결함 |
|---|---|
| nonexistent_topic | 존재하지 않는 CED 토픽(예: 3.7) |
| control_group_not_unique / control_rationale_missing / control_answer_not_in_table | 모호한 대조군: 표에 (control) 표시가 정확히 1개, 설계도에 대조군 근거, 파트 B 정답이 표의 그 집단 |
| accepted_answer_contradicts_data / model_answer_number_not_in_data | 자료와 모순되는 허용 답(추세 표현), 표에 없는 수 |
| duplicated_display_text / repeated_word | `(control) (control)` 같은 표시 문구 중복 |
| empty_column_name / duplicate_column_name / ph_miscased | 열 이름 오류(`Ph` → `pH`) |
| rubric_not_meaning_based / rubric_alternatives_missing / rubric_common_errors_missing / rubric_element_is_phrase | 문구 일치 루브릭: 행마다 의미 기반 표시, 허용 표현 2개 이상(수치 행 제외), 흔한 오류, 필수 요소는 25자 이상 개념 서술 |
| 설계도 bio_* | 독립변수 1개, 대조군/근거, 반복 ≥ 3, 측정 정의, 관찰 자료 인과 결론 금지, 단원 범위, 가상 실험 표시 |

한계: 생물학적 사실의 정확성(최적 pH·온도의 현실성 등)은 코드로 증명할 수 없다 → 게시 후 오류 신고 흐름.

## 예시 1: 짧은 탐구 FRQ (4점, 토픽 8.1, 대표 스킬 3.C)

**Investigation of bean seedlings** — Mean angle of stem curvature toward the light source after 24 hours (mean ± 2SE) for each group of bean seedlings

| Group | Mean (degrees) ± 2SE | Number of replicates |
|---|---|---|
| white light (control) | 3.9 ± 3.6 | 10 |
| red light | 10.1 ± 3.4 | 10 |
| blue light | 41.6 ± 3.8 | 10 |

설계도 요약: 개념 = Experimental design: variables, control, null hypothesis, and data-supported claim. 학생이 거치는 사고 = Identify the manipulated (independent) variable and the measured (dependent) variable → Recognize which group is the control and why a baseline is needed → State a null hypothesis and support a claim by comparing means with +/-2SE intervals. 독립 검증 = means and standard errors are generated from the scenario parameters; overlap of +/-2SE intervals is re-derived by the separate bio_checks module.

대조군 근거: unfiltered white light is the reference condition containing all wavelengths.

### 파트 A (1점, 스킬 3.C, 토픽 8.1)

**문제**: A student investigates how the wavelength of light shone on one side of the shoot affects the bean seedlings' response. Identify the independent variable in the investigation.

**모범 답**: The independent variable is the wavelength of light shone on one side of the shoot.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 A1 (1점): Identifies the independent variable
  - 인정해야 하는 의미: Names the factor the investigator deliberately varied (the independent variable), not the measured response
  - 허용 표현 예(전부가 아님): the factor the experimenter deliberately changed; the manipulated variable; wavelength of light shone on one side of the shoot
  - 흔한 오류(점수 없음): names the measured response (dependent variable); names the organism
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

### 파트 B (1점, 스킬 3.C, 토픽 8.1)

**문제**: Identify the group that served as the control in the investigation, and explain why a control group is needed.

**모범 답**: The control group was the white light group, which provides a baseline for comparison.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 B1 (1점): Names the control group and states it provides a baseline/comparison for the effect of the variable
  - 인정해야 하는 의미: Identifies the reference (baseline) group as the control / Explains that it allows the effect of the independent variable to be isolated by comparison
  - 허용 표현 예(전부가 아님): the group kept at the standard condition; serves as a point of comparison so any change can be attributed to the variable
  - 흔한 오류(점수 없음): names a treated group as the control; says a control makes the results larger or more reliable without a comparison
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

### 파트 C (1점, 스킬 3.B, 토픽 8.1)

**문제**: State a null hypothesis for the investigation.

**모범 답**: There is no difference in the angle of stem curvature toward the light source among the groups; the wavelength of light shone on one side of the shoot has no effect.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 C1 (1점): States no effect or no difference in the dependent variable among the groups
  - 인정해야 하는 의미: States that the independent variable has no effect on (or no difference in) the measured response among the groups
  - 허용 표현 예(전부가 아님): any differences among groups are due to chance; the variable does not affect the response
  - 흔한 오류(점수 없음): states a predicted difference instead of no effect
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

### 파트 D (1점, 스킬 6.B/4.B, 토픽 8.1)

**문제**: A student claims that blue light increases the angle of stem curvature toward the light source compared with white light (control). Using the data in the table, support the student's claim.

**모범 답**: blue light: 41.6 ± 3.8 versus control 3.9 ± 3.6; the ±2SE intervals do not overlap, so the difference is statistically supported.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 D1 (1점): Cites the group means and notes the error bars (±2SE) do not overlap (the difference is real)
  - 인정해야 하는 의미: Uses the group means to show the difference from the control / Uses the ±2SE intervals to argue the difference is unlikely to be due to chance
  - 허용 표현 예(전부가 아님): the means differ by more than the variability; the error bars are separated
  - 흔한 오류(점수 없음): cites the means but ignores the error bars; claims the variable proves causation without comparing to the control
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

무료 검사 결과: 결함 0


## 예시 2: 짧은 데이터 분석 FRQ (4점, 토픽 3.2, 대표 스킬 4.B)

**Data analysis: a catalase-catalyzed reaction** — Enzyme activity depends on the three-dimensional shape of the protein, which environmental conditions can change. Mean oxygen released in 2 minutes (milliliters) ± 2SE for a catalase-catalyzed reaction at three levels of temperature

| Temperature | Mean (milliliters) ± 2SE | n |
|---|---|---|
| 10 °C | 4.9 ± 0.44 | 10 |
| 37 °C | 16.4 ± 1.12 | 10 |
| 70 °C | 2.3 ± 0.24 | 10 |

설계도 요약: 개념 = Data analysis: trend, percent change, statistical overlap, and a supported claim. 학생이 거치는 사고 = Describe the trend across the three levels from the table values → Compute a percent change between two means → Use +/-2SE overlap to judge whether differences are supported and support a claim with the data. 독립 검증 = percent change and interval overlap re-computed by the separate bio_checks module from the table strings.

### 파트 A (1점, 스킬 4.B, 토픽 3.2)

**문제**: Based on the data, describe how the enzyme activity (measured as the oxygen released in 2 minutes) changes across the three levels of temperature, identify the level closest to the enzyme's optimum, and explain how the other levels of temperature would affect the shape of the enzyme.

**모범 답**: Enzyme activity peaks across the levels (4.9, 16.4, 2.3); it is greatest at 37 °C.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 A1 (1점): Describes the direction of change of enzyme activity across the levels and names the level of greatest activity
  - 인정해야 하는 의미: Describes the direction of change of enzyme activity across the three levels consistent with the data and names the level closest to the optimum / Explains that levels away from the optimum change the enzyme's shape (active site), reducing activity
  - 허용 표현 예(전부가 아님): rises then falls; highest at the middle level
  - 흔한 오류(점수 없음): describes only one pair of levels; describes a trend the data do not show; names a level that does not have the greatest activity
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

### 파트 B (1점, 스킬 5.A, 토픽 3.2)

**문제**: Calculate the percent change in the oxygen released in 2 minutes from 10 °C to 37 °C. Show your work.

**모범 답**: ((16.4 - 4.9) / 4.9) x 100 = 234.7%.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 B1 (1점): Percent change with work shown (answer)
  - 인정해야 하는 의미: Computes the percent change correctly with a valid method (new minus old, divided by old, times 100) / 234.7%
  - 허용 표현 예(전부가 아님): percent change = (new - old) / old x 100
  - 흔한 오류(점수 없음): divides by the new value; forgets to multiply by 100
  - 채점 메모: Award for the correct value with a valid method; equivalent forms and rounding within the tolerance are accepted. This part assesses the quantitative skill (5.A) and does not require the topic concept.

### 파트 C (1점, 스킬 5.B, 토픽 3.2)

**문제**: Using the ±2SE values in the table, identify the pair of levels, if any, for which the mean oxygen released in 2 minutes is not statistically different, and explain, in terms of how close each level is to the enzyme's optimum, why the enzyme's activity could be similar at those two levels.

**모범 답**: Answer: none of the pairs; each level is a different distance from the enzyme's optimum, so the enzyme's activity differs.

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 C1 (1점): Identifies the pair whose ±2SE intervals overlap (or none) and explains the similar activity by the levels' distance from the enzyme's optimum
  - 인정해야 하는 의미: Identifies the pair of levels (or none) whose ±2SE intervals overlap, consistent with the data / Explains the similar activity by how far each level is from the enzyme's optimum (effect on the active site)
  - 허용 표현 예(전부가 아님): the pair whose error ranges overlap, so the activity is about the same; none of the pairs overlap so every level differs
  - 흔한 오류(점수 없음): compares only the means; claims the overlapping levels differ significantly
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

### 파트 D (1점, 스킬 6.B/4.B, 토픽 3.2)

**문제**: A student claims that oxygen released in 2 minutes is greatest at 37 °C. Use the data in the table, including the ±2SE values, to support the claim, and explain how the change in temperature could account for the lower enzyme activity at a level away from the optimum.

**모범 답**: 16.4 ± 1.12 at 37 °C is higher than the other levels; temperature far from the enzyme's optimum reduces activity (too cold: fewer effective collisions; too hot: denaturation changes the active site).

**채점 가이드(의미·과학적 추론으로 채점, 특정 문구를 요구하지 않음)**

- 행 D1 (1점): Cites the highest mean with the ±2SE values and explains the effect on enzyme structure and function
  - 인정해야 하는 의미: Cites the highest mean with its ±2SE values and compares it with the other levels / Explains that a condition away from the optimum alters enzyme structure (shape of the active site), lowering activity
  - 허용 표현 예(전부가 아님): the condition changes the enzyme's shape so substrate binds less well; denaturation of the enzyme reduces the rate away from the optimum
  - 흔한 오류(점수 없음): cites the highest mean but gives no structural explanation; attributes the change to the substrate running out
  - 채점 메모: Award the point when the response conveys the required meaning, whatever the wording; do not require any specific phrase.

무료 검사 결과: 결함 0

## 유료 재검증 계획(실행하지 않음)
- 승인 후 새 시드 8개(원형당 4)를 설계도 → 무료 검사 → 동결 검토기(Bio 과목 변형) 순으로 검토. 예상 약 $0.6(후보당 $0.07), 최초 통과가 3/8 미만이면 생성을 멈추고 이 문서의 설계를 다시 고친다. 수선은 하지 않는다.
- 검토기 보정: 루브릭이 의미 기반이므로 `reference_pattern_mismatch`(공식 FRQ 와 입자 차이) 판정은 짧은 FRQ 입자(4×1점)에서 면제하는 안을 검토기 메모에 이미 반영했다.
