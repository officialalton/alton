# 2026-10-01 수학 원형 확장 D 담당 — 진행표와 생산 가능 수량

작성: 하위 에이전트(수학 원형 D). 브랜치 `feat/math-archetypes-D`(worktree `~/Developer/ALTON-worktrees/math-archetypes-D`, 베이스 `feat/math-hard-compilers` 344e8c01). **DB·원격·배포·유료 API 사용 0, 마이그레이션 0, 모델 보조 문구 비용 US$0**(대안 문구는 전부 직접 작성한 결정론 템플릿).
공용 문서 `docs/qa/2026-09-30-math-hard-archetypes.md` 는 수정하지 않았다.

## 1. 결론

- 담당 6 skill(`lines_angles_triangles`·`right_triangles_trigonometry`·`one_variable_data`·`two_variable_data`·`inference_margin_error`·`evaluating_statistical_claims`)의 **hard 원형을 세부 패턴마다 연산자가 모두 다른 4개씩**(정성형 `evaluating_statistical_claims` 만 3개씩, 아래 7절 근거) 구현했고, 같은 프레임워크의 **easy 12 · medium 19 원형**으로 유사문항 그룹 부족을 메웠다.
- 합격 기준(완화 없음)은 전 원형이 5,000 시드 스윕에서 충족: 정답 재계산 불일치 0 · 선지 값 겹침 0 · 표기 위반 0 · 예외 0 · 문장-변수 의미 일치(명사→값 표 기계 검사) 위반 0 · 본문 유사도 0.6 미만 독립 변형 30 이상(hard 는 원형당, easy/medium 은 **그룹(=원형/변형)당**).
- 새로 얹은 공용 장치(다른 에이전트 파일은 건드리지 않음): `levels-d.ts`(난이도별 검증·의미 일치 검사·정성형 검증·easy/medium 레코드·스윕), `registry-d.ts`(D 전체 목록), `skills/d-kit.ts`(오답 후보·장면·자료 문장 도구), `skills/<skill>.ts` 6개, `levels-d.test.ts`, 스크립트 `archetype-sweep-d.ts`·`archetype-samples-d.ts`.
- 수치형 hard 원형 전부는 `registry.ts` 에 skill 당 한 줄로 등록돼 공용 `archetypes.test.ts`(400 시드 스윕·재현성·같은 세부 패턴 4개 연산자 상이)도 그대로 통과한다. 정성형 hard 와 easy/medium 은 선지가 서술문이거나 난이도 기준이 달라 `registry-d.ts` 에서만 관리한다(그룹 키·레코드는 `levelRecord`).

## 2. 구성(파일)

| 경로 | 역할 |
|---|---|
| `lib/problem-generation/math-archetypes/levels-d.ts` | 난이도(easy·medium·hard)별 검증(`verifyLevel`: hard 는 공용 `verifyInstance`, easy/medium 은 풀이 단계 easy ≥2·medium ≥3, 정성형은 `verification_js` 가 지문을 읽어 정답 선지 판정), **문장-변수 의미 일치 검사**(`checkBindings`: 생성기가 내보낸 `bindings=[{noun,value}]` 표에서 명사와 값이 같은 문장 80자 이내에 있어야 함, 영어 수 표기·분수 표기 인정), 난이도별 스윕(`sweepLevel`: 그룹별 독립 변형 수), `levelRecord`(easy/medium `passed.json` 호환 레코드, `difficultyStatus=confirmed`) |
| `.../registry-d.ts` | D 담당 전체 원형 목록(`D_ARCHETYPES`, 난이도 필드 포함) |
| `.../skills/d-kit.ts` | 오답 후보(`W`)·0 이하 오답 제거(`fin`)·장면 풀·자료 나열 문장(`listSentence`)·부정관사 등 공용 조각 |
| `.../skills/lines-angles-triangles.ts` 외 5개 | skill 별 원형(hard 배열 + easy/medium 배열) |
| `.../levels-d.test.ts` | 메타데이터(연산자 상이·개념 ≥2·medium 실측 단계)·400 시드 스윕 합격(원형당)·재현성·돌연변이(정답 키·의미 일치·단계·정성형) 261 테스트 |
| `scripts/mock-exam-generation/archetype-sweep-d.ts` | 5,000 시드 스윕 CLI(`--seeds`·`--id`·`--json`) |
| `scripts/mock-exam-generation/archetype-samples-d.ts` | Preview 육안 확인 샘플 생성 → `data/mock-exam-generation/math-archetype-D/samples.tsv` |
| `registry.ts` | 수치형 hard 원형 6줄(skill 당 한 줄) 추가만 수정 |

## 3. 진행표(세부 패턴 × hard 원형, ✔ = 5,000 시드 합격)

| skill | 세부 패턴 | 연산자(코드) | hard 원형 | 합격 |
|---|---|---|---|---|
| lines_angles_triangles | triangle_angle_sum | I(inverse) H(chain2) R(repr_shift) S(constraint_select) | 4/4 | ✔ |
| lines_angles_triangles | exterior_angle | I(inverse) H(chain2) S(constraint_select) C(compose_kind) | 4/4 | ✔ |
| lines_angles_triangles | isosceles_base_angle | I(inverse) H(chain2) R(repr_shift) C(compose_kind) | 4/4 | ✔ |
| lines_angles_triangles | similar_triangles | U(unit_ratio) C(compose_kind) I(inverse) S(constraint_select) | 4/4 | ✔ |
| right_triangles_trigonometry | pythagorean_hypotenuse | I(inverse) C(compose_kind) H(chain2) U(unit_ratio) | 4/4 | ✔ |
| right_triangles_trigonometry | pythagorean_leg | I(inverse) H(chain2) S(constraint_select) R(repr_shift) | 4/4 | ✔ |
| right_triangles_trigonometry | trig_ratio | I(inverse) C(compose_kind) H(chain2) R(repr_shift) | 4/4 | ✔ |
| one_variable_data | mean | I(inverse) V(compare_scenarios) H(chain2) S(constraint_select) | 4/4 | ✔ |
| one_variable_data | median | I(inverse) S(constraint_select) V(compare_scenarios) R(repr_shift) | 4/4 | ✔ |
| one_variable_data | range | I(inverse) S(constraint_select) V(compare_scenarios) C(compose_kind) | 4/4 | ✔ |
| one_variable_data | grouped_median_interval | R(repr_shift) I(inverse) S(constraint_select) V(compare_scenarios) | 4/4 | ✔ |
| two_variable_data | cell | I(inverse) H(chain2) R(repr_shift) S(constraint_select) | 4/4 | ✔ |
| two_variable_data | row_total | I(inverse) H(chain2) R(repr_shift) V(compare_scenarios) | 4/4 | ✔ |
| two_variable_data | conditional_share | I(inverse) H(chain2) C(compose_kind) V(compare_scenarios) | 4/4 | ✔ |
| two_variable_data | scatter_equation | I(inverse) R(repr_shift) H(chain2) S(constraint_select) | 4/4 | ✔ |
| two_variable_data | scatter_predict | H(chain2) I(inverse) V(compare_scenarios) R(repr_shift) | 4/4 | ✔ |
| two_variable_data | scatter_slope_context | U(unit_ratio) R(repr_shift) V(compare_scenarios) I(inverse) | 4/4 | ✔ |
| two_variable_data | scatter_count_above | S(constraint_select) R(repr_shift) V(compare_scenarios) C(compose_kind) | 4/4 | ✔ |
| inference_margin_error | population_estimate | U(unit_ratio) I(inverse) H(chain2) V(compare_scenarios) | 4/4 | ✔ |
| inference_margin_error | margin_interval | I(inverse) S(constraint_select) V(compare_scenarios) R(repr_shift) | 4/4 | ✔ |
| inference_margin_error | sample_size_effect | P(param_condition) V(compare_scenarios) I(inverse) H(chain2) | 4/4 | ✔ |
| evaluating_statistical_claims | generalizability | S(constraint_select) R(repr_shift) V(compare_scenarios) | 3/3 | ✔ |
| evaluating_statistical_claims | cause_vs_association | R(repr_shift) S(constraint_select) V(compare_scenarios) | 3/3 | ✔ |
| evaluating_statistical_claims | conclusion_scope | R(repr_shift) S(constraint_select) V(compare_scenarios) | 3/3 | ✔ |

합계: hard 93 · easy 12 · medium 19 = **원형 124개**. 담당 세부 패턴 24개(카탈로그 18개 + 카탈로그 밖 제안 6개 = `lines_angles_triangles` 4 · `right_triangles_trigonometry` 3 · `one_variable_data` 4 · `two_variable_data` 7 · `inference_margin_error` 3 · `evaluating_statistical_claims` 3). 정성형만 세부 패턴당 hard 3개(7절).

## 4. 5,000 시드 스윕 결과

원형 124개 × 5,000 시드 = 620,000건. 생성 제약을 못 맞춘 표집은 같은 시드에서 파생한 난수로 최대 40회 재추출(결과는 (원형, 시드)만으로 결정). 합계 생산 618,174건, 재추출 후에도 실패 1,826건(0.29%), **정답 재계산 불일치·선지 값 겹침·표기·공개 게이트·문장-변수 의미 일치 위반 0, 예외 0**. 독립 변형은 본문(지문+질문+선지) 숫자 마스킹 3-gram Jaccard 0.6 미만을 탐욕으로 모은 수(상한 400).

| 원형 ID | 난이도 | 생산/5000 | 검증실패 | 예외 | 독립변형(<0.6) | 그룹(변형)별 독립 |
|---|---|---|---|---|---|---|
| `lat.triangle_angle_sum.inverse` | hard | 5000 | 0 | 0 | 251 | relation_inverse:251 |
| `lat.triangle_angle_sum.chain2` | hard | 5000 | 0 | 0 | 211 | bisector_chain:211 |
| `lat.triangle_angle_sum.repr_shift` | hard | 4999 | 0 | 0 | 82 | multiples_statement:32, ratio_statement:50 |
| `lat.triangle_angle_sum.constraint_select` | hard | 5000 | 0 | 0 | 100 | obtuse_window:63, acute_window:38 |
| `lat.exterior_angle.inverse` | hard | 5000 | 0 | 0 | 169 | difference_remote:89, ratio_remote:82 |
| `lat.exterior_angle.chain2` | hard | 5000 | 0 | 0 | 83 | two_exterior_chain:83 |
| `lat.exterior_angle.constraint_select` | hard | 5000 | 0 | 0 | 60 | acute_window:60 |
| `lat.exterior_angle.compose_kind` | hard | 4995 | 0 | 0 | 96 | algebra_exterior:96 |
| `lat.isosceles_base_angle.inverse` | hard | 5000 | 0 | 0 | 40 | vertex_offset_base:22, vertex_times_base:18 |
| `lat.isosceles_base_angle.chain2` | hard | 5000 | 0 | 0 | 111 | nested_isosceles:111 |
| `lat.isosceles_base_angle.repr_shift` | hard | 5000 | 0 | 0 | 34 | fraction_relation:34 |
| `lat.isosceles_base_angle.compose_kind` | hard | 5000 | 0 | 0 | 162 | parallel_segment:162 |
| `lat.similar_triangles.unit_ratio` | hard | 5000 | 0 | 0 | 52 | area_to_length:52 |
| `lat.similar_triangles.compose_kind` | hard | 4978 | 0 | 0 | 98 | perimeter_scale:98 |
| `lat.similar_triangles.inverse` | hard | 5000 | 0 | 0 | 164 | cross_multiply_expr:164 |
| `lat.similar_triangles.constraint_select` | hard | 5000 | 0 | 0 | 56 | perimeter_window:24, larger_than_given:35 |
| `lat.triangle_angle_sum.easy_third_angle` | easy | 5000 | 0 | 0 | 38 | third_angle:38 |
| `lat.exterior_angle.easy_remote_sum` | easy | 5000 | 0 | 0 | 66 | ext_from_remote:66 |
| `lat.isosceles_base_angle.med_base_from_apex` | medium | 5000 | 0 | 0 | 325 | apex_from_base:133, base_from_apex:196 |
| `lat.exterior_angle.med_find_remote` | medium | 5000 | 0 | 0 | 97 | interior_from_exterior:48, remote_from_exterior:51 |
| `lat.similar_triangles.med_scale` | medium | 5000 | 0 | 0 | 56 | proportion_one_pair:56 |
| `lat.triangle_angle_sum.med_expressions` | medium | 5000 | 0 | 0 | 113 | linear_expressions:113 |
| `rt.pythagorean_hypotenuse.inverse` | hard | 5000 | 0 | 0 | 152 | perimeter_leg:82, perimeter_area:72 |
| `rt.pythagorean_hypotenuse.compose_kind` | hard | 5000 | 0 | 0 | 62 | square_on_diagonal:28, circle_on_diagonal:34 |
| `rt.pythagorean_hypotenuse.chain2` | hard | 5000 | 0 | 0 | 400 | two_right_triangles:400 |
| `rt.pythagorean_hypotenuse.unit_ratio` | hard | 5000 | 0 | 0 | 400 | mixed_units:400 |
| `rt.pythagorean_leg.inverse` | hard | 5000 | 0 | 0 | 120 | area_hyp_perimeter:62, area_hyp_leg:58 |
| `rt.pythagorean_leg.chain2` | hard | 5000 | 0 | 0 | 126 | slide_down:126 |
| `rt.pythagorean_leg.constraint_select` | hard | 5000 | 0 | 0 | 50 | integer_triangles_with_leg:50 |
| `rt.pythagorean_leg.repr_shift` | hard | 5000 | 0 | 0 | 217 | legs_differ:121, hyp_exceeds_leg:96 |
| `rt.trig_ratio.inverse` | hard | 5000 | 0 | 0 | 184 | sine_to_perimeter:96, sine_to_side:95 |
| `rt.trig_ratio.compose_kind` | hard | 5000 | 0 | 0 | 64 | sine_to_area:64 |
| `rt.trig_ratio.chain2` | hard | 5000 | 0 | 0 | 160 | two_elevation_angles:160 |
| `rt.trig_ratio.repr_shift` | hard | 5000 | 0 | 0 | 174 | slope_to_length:87, slope_to_rise:88 |
| `rt.pythagorean_hypotenuse.easy_triple` | easy | 5000 | 0 | 0 | 39 | legs_to_hyp:39 |
| `rt.pythagorean_leg.easy_missing_leg` | easy | 5000 | 0 | 0 | 39 | hyp_leg_to_leg:39 |
| `rt.pythagorean_hypotenuse.med_perimeter` | medium | 5000 | 0 | 0 | 56 | hyp_then_perimeter:56 |
| `rt.pythagorean_leg.med_area` | medium | 5000 | 0 | 0 | 51 | leg_then_area:51 |
| `rt.trig_ratio.med_ratio` | medium | 5000 | 0 | 0 | 400 | cos:293, tan:288, sin:280 |
| `ovd.mean.inverse` | hard | 5000 | 0 | 0 | 400 | added_value:216, removed_value:188 |
| `ovd.mean.compare_scenarios` | hard | 4636 | 0 | 0 | 400 | combined_mean:267, combined_vs_group:306 |
| `ovd.mean.chain2` | hard | 4885 | 0 | 0 | 330 | transform_then_add:330 |
| `ovd.mean.constraint_select` | hard | 5000 | 0 | 0 | 62 | greatest_largest:39, least_largest:42 |
| `ovd.median.inverse` | hard | 5000 | 0 | 0 | 286 | unknown_in_list:286 |
| `ovd.median.constraint_select` | hard | 5000 | 0 | 0 | 130 | greatest_largest:85, greatest_smallest:83 |
| `ovd.median.compare_scenarios` | hard | 5000 | 0 | 0 | 130 | merge_compare:130 |
| `ovd.median.repr_shift` | hard | 4999 | 0 | 0 | 104 | frequency_tally:104 |
| `ovd.range.inverse` | hard | 5000 | 0 | 0 | 134 | fifth_value_cases:134 |
| `ovd.range.constraint_select` | hard | 5000 | 0 | 0 | 77 | min_range_distinct:77 |
| `ovd.range.compare_scenarios` | hard | 5000 | 0 | 0 | 178 | merge_range:178 |
| `ovd.range.compose_kind` | hard | 4992 | 0 | 0 | 330 | linear_transform_mean_range:330 |
| `ovd.grouped_median_interval.repr_shift` | hard | 5000 | 0 | 0 | 53 | median_interval:53 |
| `ovd.grouped_median_interval.inverse` | hard | 5000 | 0 | 0 | 39 | missing_before_median:27, missing_after_median:39 |
| `ovd.grouped_median_interval.constraint_select` | hard | 5000 | 0 | 0 | 58 | add_to_top_interval:58 |
| `ovd.grouped_median_interval.compare_scenarios` | hard | 5000 | 0 | 0 | 84 | two_tables_median_interval:84 |
| `ovd.mean.easy_mean` | easy | 4999 | 0 | 0 | 176 | mean_of_list:176 |
| `ovd.range.easy_range` | easy | 5000 | 0 | 0 | 170 | range_of_list:170 |
| `ovd.median.med_median_list` | medium | 5000 | 0 | 0 | 177 | median_even:175, median_odd:174 |
| `ovd.mean.med_missing_for_mean` | medium | 5000 | 0 | 0 | 209 | missing_value_for_mean:209 |
| `ovd.mean.med_freq_mean` | medium | 4180 | 0 | 0 | 116 | mean_from_frequency:116 |
| `tvd.cell.inverse` | hard | 5000 | 0 | 0 | 68 | fill_from_totals:68 |
| `tvd.cell.chain2` | hard | 5000 | 0 | 0 | 95 | percent_chain_total:95 |
| `tvd.cell.repr_shift` | hard | 5000 | 0 | 0 | 110 | statements_to_cells:110 |
| `tvd.cell.constraint_select` | hard | 5000 | 0 | 0 | 113 | least_both:64, greatest_both:57 |
| `tvd.row_total.inverse` | hard | 5000 | 0 | 0 | 114 | percent_to_row_total:114 |
| `tvd.row_total.chain2` | hard | 5000 | 0 | 0 | 60 | total_then_row_percent:60 |
| `tvd.row_total.repr_shift` | hard | 5000 | 0 | 0 | 182 | relation_to_row_total:182 |
| `tvd.row_total.compare_scenarios` | hard | 5000 | 0 | 0 | 127 | two_surveys_row_total:127 |
| `tvd.conditional_share.inverse` | hard | 5000 | 0 | 0 | 186 | conditional_percent_to_row:186 |
| `tvd.conditional_share.chain2` | hard | 5000 | 0 | 0 | 89 | weighted_overall_percent:89 |
| `tvd.conditional_share.compose_kind` | hard | 4516 | 0 | 0 | 56 | column_conditional_share:56 |
| `tvd.conditional_share.compare_scenarios` | hard | 5000 | 0 | 0 | 201 | two_group_percentage_points:201 |
| `tvd.scatter_equation.inverse` | hard | 5000 | 0 | 0 | 129 | x_intercept_from_slope_point:129 |
| `tvd.scatter_equation.repr_shift` | hard | 5000 | 0 | 0 | 280 | statement_to_slope:135, statement_to_prediction:170 |
| `tvd.scatter_equation.chain2` | hard | 5000 | 0 | 0 | 48 | two_points_then_predict:48 |
| `tvd.scatter_equation.constraint_select` | hard | 5000 | 0 | 0 | 50 | integer_predictions_count:50 |
| `tvd.scatter_predict.chain2` | hard | 5000 | 0 | 0 | 62 | year_to_x_to_units:62 |
| `tvd.scatter_predict.inverse` | hard | 5000 | 0 | 0 | 85 | target_year:85 |
| `tvd.scatter_predict.compare_scenarios` | hard | 5000 | 0 | 0 | 95 | equal_prediction_value:48, equal_prediction_x:48 |
| `tvd.scatter_predict.repr_shift` | hard | 5000 | 0 | 0 | 48 | residual_from_observation:48 |
| `tvd.scatter_slope_context.unit_ratio` | hard | 5000 | 0 | 0 | 47 | slope_unit_conversion:47 |
| `tvd.scatter_slope_context.repr_shift` | hard | 5000 | 0 | 0 | 86 | slope_from_two_predictions:86 |
| `tvd.scatter_slope_context.compare_scenarios` | hard | 5000 | 0 | 0 | 59 | compare_predicted_changes:59 |
| `tvd.scatter_slope_context.inverse` | hard | 5000 | 0 | 0 | 90 | slope_from_change_then_predict:90 |
| `tvd.scatter_count_above.constraint_select` | hard | 5000 | 0 | 0 | 51 | above_line_in_range:51 |
| `tvd.scatter_count_above.repr_shift` | hard | 5000 | 0 | 0 | 57 | on_or_above_line:57 |
| `tvd.scatter_count_above.compare_scenarios` | hard | 5000 | 0 | 0 | 62 | between_two_lines:62 |
| `tvd.scatter_count_above.compose_kind` | hard | 5000 | 0 | 0 | 84 | residual_threshold_count:84 |
| `tvd.cell.easy_read_cell` | easy | 5000 | 0 | 0 | 132 | cell_from_row_total:132 |
| `tvd.row_total.easy_row_total` | easy | 5000 | 0 | 0 | 132 | row_total_of_two_cells:132 |
| `tvd.conditional_share.med_share` | medium | 5000 | 0 | 0 | 72 | share_in_row:72 |
| `tvd.scatter_predict.med_evaluate` | medium | 5000 | 0 | 0 | 108 | evaluate_line:108 |
| `tvd.scatter_slope_context.med_interpret` | medium | 5000 | 0 | 0 | 84 | slope_times_change:84 |
| `ime.population_estimate.unit_ratio` | hard | 5000 | 0 | 0 | 61 | dozen_to_count:61 |
| `ime.population_estimate.inverse` | hard | 5000 | 0 | 0 | 251 | estimate_to_population:251 |
| `ime.population_estimate.chain2` | hard | 5000 | 0 | 0 | 85 | two_stage_estimate:85 |
| `ime.population_estimate.compare_scenarios` | hard | 5000 | 0 | 0 | 133 | two_places_estimate:133 |
| `ime.margin_interval.inverse` | hard | 5000 | 0 | 0 | 109 | interval_to_margin:48, interval_to_center:79 |
| `ime.margin_interval.constraint_select` | hard | 5000 | 0 | 0 | 292 | interval_with_claim:153, interval_multiples:139 |
| `ime.margin_interval.compare_scenarios` | hard | 5000 | 0 | 0 | 99 | two_polls_overlap:99 |
| `ime.margin_interval.repr_shift` | hard | 5000 | 0 | 0 | 80 | interval_upper_count:48, interval_lower_count:48 |
| `ime.sample_size_effect.param_condition` | hard | 5000 | 0 | 0 | 50 | min_sample_for_margin:50 |
| `ime.sample_size_effect.compare_scenarios` | hard | 5000 | 0 | 0 | 106 | bigger_sample_smaller_margin:110, smaller_sample_larger_margin:109 |
| `ime.sample_size_effect.inverse` | hard | 4995 | 0 | 0 | 122 | margin_to_sample_size:122 |
| `ime.sample_size_effect.chain2` | hard | 5000 | 0 | 0 | 110 | additional_respondents:110 |
| `ime.population_estimate.easy_estimate` | easy | 5000 | 0 | 0 | 252 | sample_to_group:252 |
| `ime.margin_interval.easy_interval` | easy | 5000 | 0 | 0 | 73 | upper_end:57, lower_end:57 |
| `ime.population_estimate.med_percent_population` | medium | 5000 | 0 | 0 | 213 | percent_to_count:142, percent_to_complement:137 |
| `ime.margin_interval.med_interval_margin` | medium | 5000 | 0 | 0 | 71 | margin_from_interval:71 |
| `ime.sample_size_effect.med_quadruple` | medium | 5000 | 0 | 0 | 171 | bigger_sample_margin:171 |
| `esc.generalizability.constraint_select` | hard | 5000 | 0 | 0 | 41 | frame_restricted:41 |
| `esc.generalizability.repr_shift` | hard | 5000 | 0 | 0 | 84 | random_small_sample:36, nonrandom_large_sample:48, random_large_sample:36 |
| `esc.generalizability.compare_scenarios` | hard | 5000 | 0 | 0 | 72 | random_small_vs_volunteer_large:72 |
| `esc.cause_vs_association.repr_shift` | hard | 5000 | 0 | 0 | 85 | random_assignment_causal:44, self_selected_association:41 |
| `esc.cause_vs_association.constraint_select` | hard | 5000 | 0 | 0 | 71 | confounder_from_passage:71 |
| `esc.cause_vs_association.compare_scenarios` | hard | 5000 | 0 | 0 | 77 | experiment_vs_observational:77 |
| `esc.conclusion_scope.repr_shift` | hard | 5000 | 0 | 0 | 48 | random_sample_random_assignment_frame:48 |
| `esc.conclusion_scope.constraint_select` | hard | 5000 | 0 | 0 | 48 | random_sample_self_selected_frame:48 |
| `esc.conclusion_scope.compare_scenarios` | hard | 5000 | 0 | 0 | 70 | sampling_only_vs_assignment_only:70 |
| `esc.generalizability.easy_method` | easy | 5000 | 0 | 0 | 142 | volunteer_no:72, random_yes:70 |
| `esc.cause_vs_association.easy_assignment` | easy | 5000 | 0 | 0 | 156 | self_chosen_no:72, random_assignment_yes:87 |
| `esc.conclusion_scope.med_four_combo` | medium | 5000 | 0 | 0 | 156 | nra_nrs:59, ra_nrs:80, ra_rs:77, nra_rs:64 |
| `esc.cause_vs_association.med_design_fix` | medium | 5000 | 0 | 0 | 72 | fix_for_cause:72 |
| `esc.generalizability.med_design_fix` | medium | 5000 | 0 | 0 | 72 | fix_for_generalization:72 |

## 5. skill × 난이도 생산 가능 수량과 필요량(30세트, plan.json 3세트 목표 × 10)

공급 = 그룹(원형/변형)마다 min(30, 독립 변형 수)의 합 — 세트당 같은 그룹 1문항 규칙 때문에 그룹은 30세트에 최대 30문항만 공급한다. 필요량은 기존 공개분 차감 전.

| skill | easy 원형/그룹/공급(상한 30/그룹) | 필요 easy | medium 원형/그룹/공급 | 필요 medium | hard 원형/그룹/공급 | 필요 hard |
|---|---|---|---|---|---|---|
| lines_angles_triangles | 2/2/60 | 20 | 4/6/180 | 50 | 16/21/604 | 10 |
| right_triangles_trigonometry | 2/2/60 | 20 | 3/5/150 | 50 | 12/18/538 | 10 |
| one_variable_data | 2/2/60 | 10 | 3/4/120 | 30 | 16/21/627 | 0 |
| two_variable_data | 2/2/60 | 10 | 3/3/90 | 30 | 28/31/930 | 0 |
| inference_margin_error | 2/3/90 | 10 | 3/4/120 | 30 | 12/16/480 | 0 |
| evaluating_statistical_claims | 2/4/120 | 10 | 3/6/180 | 30 | 9/12/360 | 0 |

- easy/medium 은 모든 skill 에서 필요량을 초과 공급한다(그룹당 ≥ 38 독립 변형이므로 그룹 상한 30 이 공급을 결정). 기존 컴파일러 그룹은 포함하지 않았다.
- 세트당 필요 그룹 수(easy+medium 필요량 ÷ 30, 올림): lines 3 · right 3 · one_var 2 · two_var 2 · inference 2 · evaluating 2. 공급 그룹은 easy+medium 합계 lines 8 · right 7 · one_var 6 · two_var 5 · inference 7 · evaluating 10 으로 모두 충족한다(난이도별로도 easy 2~4 · medium 3~6 그룹).
- hard 는 원형·그룹 모두 필요량(lines 10 · right 10, 나머지 0)을 훨씬 넘는다. 오너 확정("모든 skill 에 hard 가능")에 따라 plan.json hard 0 인 자료 해석 계열도 hard 원형을 갖췄다.

## 6. 그림·자료가 필요한 패턴(시각 버전은 구현하지 않음 — 목록과 필요 스키마)

모든 D 원형은 `figure: null` 이며 서술(문장·좌표 나열)만으로 성립하게 만들었다. 기존 컴파일러가 그림을 쓰는 세부 패턴과의 관계:

| 세부 패턴 | 기존 컴파일러의 그림 | 원형 구현 방식 | 시각 버전이 필요하면(미구현) |
|---|---|---|---|
| lines_angles_triangles 4종 · right_triangles_trigonometry 3종 | `TriangleSpec`(꼭짓점·변·각) | 꼭짓점 이름·변 길이·각을 문장으로 서술(그림 불필요) | `TriangleSpec{vertices,kind,rightAngleAt,sides,angles}` 연동, 보조선(이등분선·평행선) 표현 |
| two_variable_data.cell·row_total·conditional_share | `DataSpec` 표 | 칸 값을 문장으로 서술(합·비율·차이) | `DataSpec{kind:'table'}` 2×2 + 행·열 합 표시 |
| two_variable_data.scatter_equation·scatter_predict·scatter_slope_context | `PlaneSpec` 산점도 | 회귀선의 식과 두 점/두 예측값을 문장으로 서술 | `PlaneSpec{type:'scatter',points,line}` 산점도 + 회귀선 |
| two_variable_data.scatter_count_above | 점 위치를 눈으로 읽음 | **자료점 좌표 목록 + 회귀선 식**으로 서술(선 위 점 개수는 계산으로 판정) — 그림에서 점 세기 자체는 미구현 | 점·선 위치를 시각적으로 구분 가능하게 그리는 산점도 + '선 위 점' 판독 검사(점이 선에 너무 가깝지 않도록 간격 제약) |
| one_variable_data.grouped_median_interval | 히스토그램/도수표 | 구간별 도수를 문장으로 서술 | `DataSpec{kind:'histogram',bins}` |
| inference_margin_error · evaluating_statistical_claims | 없음 | — | — |

**구현하지 않은 시각 의존 변형 목록**: ① 도형 그림에서 각·변 읽기, ② 표 그림에서 칸 읽기, ③ 산점도에서 점 위치·선 위/아래 세기, ④ 산점도에서 기울기·절편 읽기, ⑤ 히스토그램에서 막대 높이 읽기. 이들은 figure 스키마와 `checkFigure` 연동이 선행돼야 하며 이 세션 범위가 아니다.

## 7. 정성 판단형 `evaluating_statistical_claims` — hard 세부 패턴당 3개인 근거

- 이 skill 의 선지는 서술문이고 정답은 (무작위 표집 여부 × 무작위 배정 여부 × 표집 틀 × 표본 크기) 판단 트리의 한 잎이다. 서로 다른 **풀이 구조**는 다음 세 종류가 한계다: (a) 서술을 '무작위/비무작위'로 번역(R), (b) 표집 틀·교란 요인처럼 지문의 단서를 선택해 범위를 제한(S), (c) 두 연구를 비교해 어느 쪽이 어떤 결론을 뒷받침하는지 짝짓기(V). 4번째 구조(예: 연산자 C/P/I)를 억지로 만들면 기존 2×2 조합 매핑(easy/medium)과 같아져 hard 기준(추가 요구 사고)을 채우지 못하므로 **기준 완화 없이 세부 패턴당 3개(총 9개)**로 멈췄다.
- 대신 구조 다양성을 본문에서 확보했다: 12개 맥락(대상·표집 틀·처치·결과 지표) × 문장 틀 3~4개 × 질문 2~5개로 hard 원형당 독립 변형 41 이상, easy/medium 그룹당 48 이상.
- 정성형 검증: `verification_js` 는 `const P = {stimulus, options}` 만 읽어 지문 키워드(무작위·배정·표집 틀·교란 요인 문구)로 정답 선지 하나를 고르며, 선지가 유일하지 않거나 지문이 그 원형의 설계가 아니면 예외를 던진다. 돌연변이 테스트(정답 키·지문 배정 방식 뒤집기·중복 선지)가 이를 잡는다. 한계: 지문·선지 어휘와 JS 정규식이 짝으로 묶여 있어 문구를 추가하면 정규식을 같이 갱신해야 한다(스윕이 불일치를 즉시 실패로 보고).
- 선지 설계 원칙: 오답은 반드시 '결론이 틀린' 선지만 두고 '결론은 맞고 이유만 틀린' 선지는 정답과 함께 두지 않는다(예외: 무작위 일반화 문항의 '크기 때문에' 선지는 질문이 '이유까지' 묻는 형식이라 오답).

## 8. 의미 일치 검사와 hard 인정 기준(요약)

- **명사-수식 매핑 표 기반 기계 검사**: 생성기가 `bindings`(예: `angle A ↔ 55`, `mean ↔ 80`, `Model A ↔ 3x + 5`)를 선언하면 `checkBindings` 가 같은 문장에서 80자 이내인지 검사한다. 영어 수 표기(two·twice·half·third…)와 분수(`\frac{p}{q}`)를 값으로 인정한다. 스윕 중 이 검사가 문장 틀의 명사와 값이 어긋난 곳을 다수 잡아 수정했다(예: 대체 문장에 해당 명사가 없는 경우).
- hard 인정 기준(공용 `verifyInstance`): 풀이 단계 ≥ max(5, medium 실측+1), 결합 개념 ≥ 2, 지문 4자리 이상 숫자·소수 둘째 자리 금지. 연도 같은 4자리 값은 'Year N' 형태로 바꿨고(`scatter_predict`), 길이·숫자·계산량만으로 hard 를 만들지 않는다 — 모든 hard 원형에 `extraThinking`(추가 요구 사고)을 명시했다(진행표의 원형 메타데이터).
- 레코드: hard 는 `bulk.ts` 의 `archetypeRecord`(잠정 `provisional_ai`), easy/medium 은 `levelRecord`(`confirmed`). 그룹 키 `c:<skill>:<원형ID>/<변형>`.

## 9. 외부 변경·비용·남은 일

- **외부 변경 0**: DB·Storage·원격·배포·푸시·유료 API·마이그레이션·`supabase db reset` 없음. 공유 로컬 DB(54422) 사용 없음(순수 함수 테스트와 시드 스윕만). 대안 문구는 모델 호출 없이 직접 작성해 **US$0**.
- 남은 일(승인 필요): 대량 산출·`passed.json` 생성·import, 카탈로그 밖 6개 세부 패턴(`systems_linear` 는 담당 밖)의 `kind-catalog.ts` 반영(컴파일러 구현 시 함께), Preview 육안 확인(`data/mock-exam-generation/math-archetype-D/samples.tsv`, 원형당 2건), 시각 버전(6절).
- 알려진 한계: ① easy 일부 그룹은 독립 변형이 38~40 수준이라(상한 30 에는 여유) 대량 산출 시 중복 방지 필터가 필요하다. ② 의미 일치 표는 생성기 선언 방식이라 자동 추출이 아니다. ③ `mediumSteps` 는 medium 컴파일러 실측(`math-medium-baseline.json`)이 있는 세부 패턴만 실측 검증, 나머지(산점도 4·카탈로그 밖 6·`grouped` 등)는 선언값.
