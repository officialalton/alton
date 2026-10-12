# 보강 생성 수량 대조 (2026-10-09, 조정 세션)

원본: `data/ap/stock/supp-b*-items.json`(재고 행) + `supp-b*-pass-keys.json`(통과 키). 원장 지출 $3.2920.

| 배치 파일 | 행(후보) | 최종 통과 | 반려 |
|---|---|---|---|
| supp-b1 (BC 단원 10 MC) | 14 | 10 | 4 |
| supp-b2ab (AB FRQ 신규 유형 3) | 6 | 3 | 3 |
| supp-b2bc (BC 전용 FRQ 2종) | 4 | 3 | 1 |
| supp-b3ab (AB 계산기 MC) | 14 | 11 | 3 |
| supp-b3bc (BC 계산기 MC + b1 수정본) | 9 | 9 | 0 |
| supp-b3fa (`frq_rate_in_out` v2) | 2 | 0 | 2 |
| supp-b4ab (두 번째 수치 묶음 + 수정본) | 11 | 9 | 2 |
| supp-b5bc (`frq_polar_region`) | 3 | 1 | 2 |
| supp-b6ab (FRQ 신규 유형 2) | 4 | 3 | 1 |
| **합계** | **67** | **49** | **18** |

## 보고 숫자 간 연결
- **후보 67 vs 65**: 파일 행은 67이다. 리허설·오너 적재 절차는 **8배치 = 65행**(통과가 0인 `supp-b3fa` 2행 제외 — 전부 `criterion_failed_scope_skill` 반려, 이력 보존이 필요하면 별도 적재 가능). 새 키 65·갱신 0과 일치.
- **통과 52 vs 49**: 단계 보고표의 통과(재고) 합 52 = 49 + 3. 3건은 **검수는 통과했으나 근접 중복 게이트(`duplicate_gate_near_duplicat…`, 3-gram 유사도 > 0.8)로 최종 반려**되어 재고에서 제외된 형제 묶음이다:
  - `supp-b2-ab-final:ap_calculus_ab-f02-k1`
  - `supp-b2-bc-final:ap_calculus_bc-f02-k1`
  - `supp-b5-bc-final:ap_calculus_bc-f01-k2`
- **수정본**: b1 반려 4건의 수정본은 b3bc(9행 중 4), b3 반려 3건의 수정본은 b4ab(11행 중 3)에 포함. 수정본은 새 후보이며 원본은 `rejected`로 재고에 남는다(삭제 없음).
- 최종 고유 통과 = 49(MC 39 + FRQ 10). 반려 18 = 근접 중복 3 + 기출 유사 `resembles_known_exam_item` 등 기준 반려 15.
