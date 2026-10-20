# SAT 모듈 안 문항 순서 — 공식 순서 규칙 (2026-10-19)

코드: `lib/mock-exam/official-order.ts` (규칙 단일 출처), 세트 버전 SQL: `data/prod-open/sat-expand-sql/27_*` (생성기 `scripts/prod-open/sat-order-sql.ts`).

## 근거 (docs/2026-09-17-collegeboard-coverage-map.md, 공식 7종 14모듈 분류표)

R&W: 영역 블록이 엄격히 고정. skill 별 위치 중앙값(M1/M2):
words_in_context 3 → text_structure_purpose 8 → cross_text_connections 9 → central_ideas_details 10 → command_of_evidence_quant 13~14 → command_of_evidence_text 15 → inferences 17~17.5 → form_structure_sense 20~22 · boundaries 23 → transitions 28 → rhetorical_synthesis 32.
= Craft & Structure → Information & Ideas → Standard English Conventions → Expression of Ideas. 표준 영어 두 skill 은 공식에서 서로 섞이므로 같은 순서 키(난이도·원래 순서로 결정).

Math: 영역 블록 없음(영역 단위 정렬 0/14 일치). 느슨한 skill 평균 위치 순서가 있다(총괄 측정값 사용): probability 3.5 → inference_from_sample 8.3 → two_variable_data 9.4 → linear_equations_one_var 9.7 → linear_functions 11.3 → linear_inequalities 12.3 → equivalent_expressions 13.2 → ratios_rates·percentages·lines_angles_triangles 14.8 → linear_two_variables 15.1 → nonlinear_functions 15.6 → one_variable_data 16.8 → nonlinear_equations_systems·area_volume 17.1 → right_triangles_trigonometry 19.1 → circles 19.5. 난이도는 대체로 뒤로 갈수록 어려움.

## 규칙

- R&W 모듈: (영역 블록, 블록 안 skill 순서, 난이도 오름차순, 원래 position). 블록 안 skill 순서: CS = wic < tsp < ctc, II = cid < coe_quant < coe_text < inferences, EOI = transitions < rhetorical_synthesis.
- Math 모듈: (skill 공식 평균 위치, 난이도 오름차순, 원래 position). 모르는 skill 은 맨 뒤.
- 모듈(module_key+route) 단위로만 정렬하고 그 모듈이 쓰던 position 값 집합을 오름차순으로 재분배한다 — 모듈 1·2(rw_m1/rw_m2 lower·higher, math_m1/math_m2 lower·higher) 경계·문항 수·라우팅 불변.
- 주의: 이전 규칙은 모듈 전체를 난이도 오름차순으로만 정렬했다(실측 inversion 0). 새 규칙은 skill 이 1차라서 모듈 앞쪽에 어려운 문항이 올 수 있다(공식 경향과 같다는 총괄 지시). 난이도가 1차였던 흐름으로 되돌리려면 `officialOrderKey` 의 키 순서만 바꾸면 된다.

## Math skill 매핑표 (우리 skill_code → 분류표 이름)

| 우리 | 분류표 | 근거 |
|---|---|---|
| probability | probability | 동일 |
| inference_margin_error, evaluating_statistical_claims | inference_from_sample | 표본 추론·오차 한계·통계 주장 평가는 모두 공식 "Inference from sample statistics and margin of error" 영역 |
| two_variable_data / one_variable_data | 동명 | 동일 |
| linear_equations_one_var / linear_functions / linear_inequalities / equivalent_expressions | 동명 | 동일 |
| ratios_rates_units | ratios_rates | 분류표 이름 축약 |
| percentages / lines_angles_triangles / nonlinear_functions / nonlinear_equations_systems / area_volume / right_triangles_trigonometry / circles | 동명 | 동일 |
| linear_equations_two_var, systems_linear | linear_two_variables | 공식 "Linear equations in two variables" 와 "Systems of two linear equations in two variables" 가 분류표에서 한 skill 로 묶임 |

## 적용 범위

- 조립: `lib/mock-exam/assemble.ts`(`orderSectionItems`, MST 모듈 조립 포함), `scripts/mock-exam-generation/assemble-unique.ts`(새 세트), `rebalance-sets.ts`(교체로 바뀐 사본은 `reorderSetModulesOfficial` 로 재정렬) 모두 같은 함수를 쓴다.
- 공개 30세트: `27_set_versions_official_order.sql` 이 세트마다 새 draft 버전(문항 동일, position 만 재배치)을 만든다. 옛 버전·응시 이력 보존, 공개 안 함. 순서 키 표는 SQL 안 VALUES 로 계산하므로 문항 id 를 박지 않는다.
- draft 가 이미 있는 세트(24/26 단계 draft)는 건너뛴다 — 그 draft 를 공개한 뒤 27 을 재실행한다(이미 공식 순서면 건너뜀, 멱등).
- access_tier: DB 가드(`mock_exam_sets_guard_access_tier`)가 draft 의 'free' 를 거부하므로 초안은 'tutoring' 으로 만들고, `mock_exam_publish_set` 이 이전 공개본의 티어를 물려준다. 로컬 리허설에서 공개 후 'free' 유지 확인. `27_verify.sql` 이 공개 SAT 세트의 `published_not_free = 0` 을 점검한다.
