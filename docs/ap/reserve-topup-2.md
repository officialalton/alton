# 예비 보충 2차 (2026-10-12, 오너 승인: 남은 1.5배 예비 부족만, 상한 $1.00)

## 1. 부족 재계산 (`npx tsx scripts/ap-generation/topup2-status.ts`)
기준: 5개 초안 세트(`exact-assign-5sets-cons.json`) 예약 + 게시 AB#1 고정 + AB#1 10건 교체안(그래프 하한 10 안, `family-cap-report.ts`)을 예약으로 간주. 교체안 10건 중 5건은 5세트 초안과 같은 문항이다(`run1:…c010-k0`, `run2:…m24-k0`, `run2:…m04-k2`, `supp-b3-ab-final:…m13-k0`, `s1a-final:…m27-k0`) — 교체안을 적용하려면 초안 세트 쪽을 다른 예비로 바꿔야 한다(교체안 적용 시 조정 세션이 처리). 교체안이 재고에서 빼가는 10건(그래프 3·계산기 필수 5·단원 1·1·2·4×2·6×2·8×2 등)은 부족에 반영했다.
| 칸 | 교체안 전 부족 | 교체안 후 부족(생성 대상) | 생성 후 |
|---|---|---|---|
| 그래프 필수 MC | 4 | **7** | 0 (재고 78, 목표 75, 교체안 3건 소비 후에도 충족) |
| 단원 6 (계산기 필수 포함) | 4 | **6** | 0 |
| 단원 2 | 1 | **2** | 0 |
| 단원 4 | 0 | **2** | 0 |
| 단원 8 | 0 | **1** | 0 |
| 단원 1 | 0 | **1** | 0 |
| 계산기 필수 Part B | 0 | **3** | 0 |
겹치는 칸은 한 문항이 함께 채우도록 설계(그래프+단원 6+계산기 필수 등). 생성 대상 셀(단원 × 스킬 × 계산기 × 표현 × 구조): 단원 6 그래프 4(1.D/2.E/1.E 계산기 필수 2건 포함), 단원 6 비그래프 계산기 필수 2, 단원 2 그래프 1 + 비그래프 1, 단원 4 그래프 1 + 비그래프 계산기 필수 1, 단원 8 그래프 1, 단원 1 계산기 필수 1.

## 2. 생성 (동결 구성, 수선 없음, 구조 판정)
- 신규 원형 14종(`archetypes/calc_topup2.py`, 정답은 코드 + 독립 수치 경로, 설계도·가이드 동기화, 사전 점검 12/12 clean, 기존 재고 전체와 구조 look-alike 0).
- 배치 `supp-t2a-ab`(seed0 7100, 해시 `generatorHash` 커밋 a5e74eb9 시점): 후보 12 → **통과 10**(83%). 비용 $0.6924. 반려 2: `c_normal_line_calc`(AP 범위 밖: 법선), `g_direction_changes_count_graph`(오답 해설 부정확).
- 배치 `supp-t2b-ab`(seed0 7300, `config/ap-frozen/supp-t2b-ab.v1.json`, generatorHash `65f041fb71fc`): 반려 2건을 **새 후보로** 고쳐(방향 전환 오답 해설 재작성, 법선 대신 `c_avg_vs_instant_rate_calc`) 2/2 통과. 비용 $0.0901. 자동 수선 반복 없음. t2a 구성은 이후 원형 파일이 바뀌어 해시가 달라졌다(역사 기록, t2a 는 재실행하지 않는다).
- 총 지출 **$0.7825 / 상한 $1.00**, 누적 $31.2912 → **$32.0737**(중단선 $45).
- 신규 통과 고유 MC **12**(그래프 필수 7, 계산기 필수 7). 구조 판정: 엄격 기준 독립 12; 경계 사례 6종(`c_riemann_error_calc`, `c_ftc_initial_value_calc`, `g_accum_intersect_formula_calc`, `g_integral_piecewise_graph_formula_calc`, `g_direction_changes_count_graph`, `g_avg_value_intersection_graph`)은 "애매하면 같은 군" 규칙에 따라 `structure-groups.conservative.json` 에 기존 아키타입과 병합(보수 하한 독립 **6**: `g_accum_concave_down_graph`, `g_integral_even_function_graph`, `g_linear_combo_two_graphs`, `c_related_rates_distance_calc`, `c_limit_numeric_e_calc`, `c_avg_vs_instant_rate_calc`). 5세트 초안의 군 판정은 병합이 새 아키타입에만 붙으므로 변하지 않는다.

## 3. 렌더·화면 증거·적재 준비
- 렌더 보고서 재생성: 신규 그래프 7건 pass, 나머지 not_applicable, 신규 실패 0(기존 `run1:…f04-k8` 실패는 이전부터).
- 격리 스택 `ALTON_aptopup2`(이미 정리)에서 화면 증거 `data/ap/screen-evidence/evidence-topup2.json`: 12건 × 2 뷰포트 = 24항목 전부 통과, 스크린샷 `docs/ap/screen-evidence/topup2/`(24장).
- 관리자 화면 'AP 재고 관리' 배치 목록(`lib/ap-admin/batches.ts`)에 `supp-t2a`(행 12·통과 10), `supp-t2b`(행 2·통과 2) 등록. 산출물: `data/ap/stock/supp-t2a-items.json`, `supp-t2b-items.json`, `supp-t2a-pass-keys.json`, `supp-t2b-pass-keys.json`, `data/ap/screen-evidence/evidence-topup2.json`, `data/ap/render-check/report.json`.
- 비프로덕션 적재·검증은 관리자 화면에서(검증 대기 항목): 적재 → 렌더 → 화면 기록 순.

## 4. 남은 일
교체안 적용 시 5세트 초안 5건 교체 필요(위 겹침). 신규 12건은 비프로덕션 적재·검증 전까지 "검증 대기".
