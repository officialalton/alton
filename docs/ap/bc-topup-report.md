# BC 보강 생성 보고 (2026-10-09, 필수 단계만)

실행 승인 근거: 오너 '유료 생성 권장안대로 해'(2026-10-09), 필수 단계 상한 총 $2.50(상한 연장 없음, 선택 단계·추가 호출 없음). 동결 구성 `config/ap-frozen/bc-topup.v1.json`(해시 일치 확인 후 첫 유료 호출, 수선 반복 없음).

## 1. 지출
- 이번 실행 **$0.8974** / 상한 $2.50. 누적 $22.966 → **$23.8634**(중단선 $27 여유 $3.1366). 원장 `data/ap/sample-2027/ledger.json` 반영.
- 호출: 문장 생성 18, 독립 풀이 18, 5기준 검토 18(+재요청 3), 난이도 18. Fable 표본 없음.

## 2. 생성·통과
| 구분 | 슬롯 | 자동 통과 | 비고 |
|---|---|---|---|
| MC(단원 9·10, 스킬 2, 그래프/표) | 16(원형 8 × 2) | **15** | 반려 1: lagrange_graph 1건(자료 표현·오답 해설 기준 실패) |
| FRQ(오일러+로지스틱) | 2 | **1** | 나머지 1건은 같은 문항군과 근접 중복(duplicate_gate_near_duplicate)으로 반려 |
- MC 통과율 15/16(첫 배치 통과율 50% 이상, 중단 조건 미발동). 결정적 게이트 18/18 통과 후 LLM 단계에서 위 2건 탈락.
- 통과 MC 원형(고유 문항군 8): 그래프 필수 4원형 — param_xvel_graph(9.5), polar_area_graph(9.8), polar_rprime_graph(9.7), lagrange_graph(10.12) → 그래프 필수 MC 신규 **7**(통과 기준, lagrange 1건 반려 후); 표 필수 4원형 — alt_series_table(10.10), taylor_table(10.11), polar_table_distance(9.7), param_speed_table(9.6). 전부 스킬 2(2.B/2.D/2.E), 계산기 불가, 설계도 포함.
- 단원별: 단원 9 = 10건(그래프 6 + 표 4), 단원 10 = 5건(그래프 1 + 표 4); 스킬 2 = 15건 전부. 정확한 세트 제약 집계는 적재 후 재고 재계산에서 확정.
- 정직한 한계: LLM 문장 채택 0건(template 18) — 문장은 코드 템플릿 그대로이며 LLM 다듬기는 수치 보존 규칙으로 전부 미채택. 정답·자료는 코드 계산 + 독립 수치 경로.

## 3. 공식 학습 목표 매핑(BC 전용 부족에 산입하는 근거)
출처: `docs/ap/…` CED(AP Calculus AB and BC CED) 토픽별 학습 목표, `data/ap/curriculum-2027/ap_calculus_bc.json`(scope=bc_only).
| 문항군 | 토픽 | CED 학습 목표 | 요구 수준 |
|---|---|---|---|
| frq_euler_logistic | 7.5 | FUN-7.C.4 오일러 방법으로 미분방정식의 해를 근사(BC 전용) | (a) 2단계 오일러 계산 3점, (b) 오목성으로 과소/과대 판정 |
| 〃 | 7.9 | FUN-7.H.1~4 로지스틱 모형 해석: 풀지 않고 극한(수용력)·최대 성장 값 결정(BC 전용) | (c) 극한과 최대 성장 P, (d) 수용력 초과 시 dP/dt 부호 해석 |
| param_xvel_graph / param_speed_table | 9.5 / 9.6 | 벡터함수 적분으로 위치, 속력(BC 전용 단원 9) | 그래프·표에서 읽어 위치/속력 계산 |
| polar_area_graph / polar_rprime_graph / polar_table_distance | 9.8 / 9.7 | 극좌표 넓이, 극곡선 미분·원점 거리(BC 전용) | r 그래프·표 해석 |
| lagrange_graph / alt_series_table / taylor_table | 10.12 / 10.10 / 10.11 | 라그랑주 오차, 교대급수 오차 한계, 테일러 다항식(BC 전용 단원 10) | 그래프·표에서 M, 첫 생략항, 계수 읽기 |
토픽 이름만으로 산입하지 않고 위 학습 목표의 요구 행위(근사 절차 수행·오목성 근거·풀지 않고 해석)가 문항 파트/선지에 들어 있는 것만 산입한다.

## 4. 남은 단계(이 실행에서 중단된 것)
자동 분류기가 `stock.ts`(공유 재고 파일·`docs/ap/stock-report.md` 덮어쓰기)와 `data/ap/sample-2027/bc-topup-final` 복사 단계를 **공유 자원 변경으로 거부**했다. 우회하지 않고 중단했다. 코드 배선(아래)은 커밋돼 있고 다음이 남았다.
1. `data/ap/sample-2027/bc-topup/candidates.json` → `bc-topup-final/candidates.json` 복사, `npx tsx scripts/ap-generation/stock.ts`(재고 파일 `bc-topup-items.json` 생성; 기존 항목 상태 변동 diff 확인).
2. 렌더 검사 `render-check.ts` → 비프로덕션 `worpsqwqgnspddnrtnvq` 에 `import-candidates.ts --items data/ap/stock/bc-topup-items.json --batch bc-topup-2026-10-09 --supplement`(dry-run 후 `--execute`, `--target`·`--i-know-nonprod` 명시), 격리 스택에서 `screen-evidence.ts`, `mark-verified.ts --render/--screen`(자동 점검, content-hash 결합).
3. 재고 재계산(`bc-feasibility.ts`, AB 풀 세트 항목 제외): 중복 0·단원·스킬·표현·계산기·문항군 제약 동시 점검. 과목 전체 은행 충분성은 선언하지 않는다.

## 5. 배선 변경(커밋됨)
`lib/ap-generation/stock.ts`(GATE_OF_RUN), `scripts/ap-generation/{stock,keys-file,render-check,bc-feasibility,stock-targets,stock-consistency}.ts` 에 `bc-topup-final` / `bc-topup-items` 추가. 원형: `archetypes/calc_bc_topup.py`, `calc_bc_topup_frq.py`, 가이드: `lib/ap-generation/subjects/calc-bc.ts`.
