# AP 샘플 생성 보고 (run1)

생성: 2026-10-08T10:13:37.286Z · 총 비용 $36.41 (상한 $80) · 호출 2140건 · 후보 576 → 전체 통과 220 → 셀당 1개 채택 90 (+ reserve 130)

## 과목별 수율·비용

| 과목 | 후보 | 통과 | 채택(칸 채움) | MC 문항 채택 | FRQ 번들 채택 | 수율(채택/후보) | 비용 | 호출/채택 | 미충전 칸 |
|---|---|---|---|---|---|---|---|---|---|
| ap_calculus_ab | 204 | 80 | 33/34 | 30 | 3 | 16% | $11.71 | 21.9 | 1 |
| ap_biology | 200 | 57 | 27/28 | 30 | 3 | 14% | $11.64 | 24.6 | 1 |
| ap_microeconomics | 172 | 83 | 30/30 | 30 | 3 | 17% | $9.37 | 19.2 | 0 |

## 반려 사유

| 사유 | 건수 |
|---|---|
| criterion_failed_exam_suitability | 200 |
| criterion_failed_scope_skill | 179 |
| criterion_failed_distractor_explanation | 166 |
| criterion_failed_key_scoring | 153 |
| criterion_failed_stimulus_expression | 123 |
| solver_disagrees_or_flags_flaw | 43 |
| instant_reject_out_of_scope_knowledge | 30 |
| instant_reject_missing_condition | 22 |
| instant_reject_wrong_key | 20 |
| missing_set_stimulus | 18 |
| part_a_numeric_check_failed | 13 |
| part_b_numeric_check_failed | 11 |
| item_count_N_expected_N | 11 |
| instant_reject_multiple_correct | 10 |
| instant_reject_wrong_stimulus | 9 |
| verification_error | 8 |
| part_c_numeric_check_failed | 7 |
| key_mismatch_deterministic | 5 |
| part_d_numeric_check_failed | 5 |
| resembles_known_exam_item | 5 |
| itemN_key_out_of_range | 5 |
| itemN_key_mismatch_deterministic | 4 |
| difficulty_from_unfair_sources | 3 |
| itemN_missing_stem_or_explanation | 3 |
| explanation_references_option_letter | 2 |
| fable_spot_check_disagrees | 2 |
| no_parts | 2 |
| total_points_N_vs_undefined | 2 |
| option_count_N_expected_N | 2 |
| key_is_much_longer_giveaway | 1 |
| verification_no_checks | 1 |
| part_c_unknown_skill_N.C | 1 |
| part_d_unknown_skill_N.D | 1 |
| part_d_unknown_skill_N.E | 1 |
| part_d_no_rubric_rows | 1 |
| part_e_no_rubric_rows | 1 |
| part_undefined_no_rubric_rows | 1 |
| part_undefined_rubric_sum_N_vs_undefined | 1 |
| total_points_N_vs_N | 1 |
| itemN_verification_error | 1 |
| part_e_numeric_check_failed | 1 |

## 재고(채택 후보): ap_calculus_ab

| 단원 | MC 문항 | FRQ 번들 |
|---|---|---|
| 1 | 4 | 0 |
| 2 | 4 | 0 |
| 3 | 2 | 0 |
| 4 | 4 | 0 |
| 5 | 5 | 1 |
| 6 | 5 | 1 |
| 7 | 2 | 1 |
| 8 | 4 | 0 |

- 스킬: 2.B×5, 1.C×2, 3.C×1, 2.D×2, 1.D×4, 3.E×3, 1.E×12, 2.A×1, 3.F×1, 3.D×1, 1.F×1
- 구조: standalone×30, frq_multipart×3
- 잠정 난이도(근거는 후보 파일): basic_learning×9, exam_prep×24

## 재고(채택 후보): ap_biology

| 단원 | MC 문항 | FRQ 번들 |
|---|---|---|
| 1 | 3 | 0 |
| 2 | 3 | 0 |
| 3 | 4 | 1 |
| 4 | 4 | 1 |
| 5 | 3 | 0 |
| 6 | 4 | 1 |
| 7 | 5 | 0 |
| 8 | 4 | 0 |

- 스킬: 2.A×2, 1.A×1, 2.D×2, 6.E×6, 1.B×7, 6.B×3, 4.A×2, 6.C×1, 5.C×1, 1.C×1, 2.B×2, 6.D×1, 3.C×4
- 구조: standalone×22, shared_stimulus_set×2, frq_multipart×3
- 잠정 난이도(근거는 후보 파일): basic_learning×9, exam_prep×18

## 재고(채택 후보): ap_microeconomics

| 단원 | MC 문항 | FRQ 번들 |
|---|---|---|
| 1 | 4 | 0 |
| 2 | 7 | 1 |
| 3 | 7 | 0 |
| 4 | 6 | 2 |
| 5 | 3 | 0 |
| 6 | 3 | 0 |

- 스킬: 1.A×6, 2.A×10, 1.C×2, 2.C×4, 3.C×5, 3.A×2, 1.D×2, 1.B×1, 4.A×1
- 구조: standalone×24, shared_stimulus_set×3, frq_multipart×3
- 잠정 난이도(근거는 후보 파일): basic_learning×8, exam_prep×22

## 중복·검수

- 채택 후보 쌍 4005 중 3-gram 유사(>0.5) 0쌍
- Fable 표본 확인 39건
- 전원 `pending_expert_review` (학생 비노출). 전문가 검수 필요 시간 추정: MC 문항 90개 × 6분 + FRQ 9개 × 25분 + 세트/구조 검토 = 약 15.8시간.
