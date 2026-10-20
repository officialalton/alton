# SAT 정량 근거(표·그래프) 문항 반영 계획 (2026-10-20)

백로그 A4. `command_of_evidence_quant` 문항이 한 건도 없는 SAT 공개 세트에 결정형 컴파일러가 만든 표·그래프 문항을 넣는다. 원격은 읽기 SELECT 만 했고 공개·쓰기는 하지 않았다.

## 생성
- 컴파일러: `scripts/mock-exam-generation/rw-quant-compiler.ts` (AI 호출 없음, 비용 $0). 틀 5종: PAIR_COMPARE(두 항목 비교), RATIO_VS_BASELINE(기준의 2배 초과), TARGET_MET(목표 달성), MAX_CHANGE(전후 증가량 기준 초과, 막대·표), MAX_STEP(한 해 상승 기준 초과, 선그래프). 시나리오 22개, 표·막대·선 세 가지 자료.
- 모든 선택지는 자료의 값을 정확히 인용하고, 오답은 같은 자료의 다른 행·기간(두 해 구간 함정, 후(after) 값이 가장 큰 항목 함정 포함)이라 주장을 뒷받침하지 못한다.
- 독립 검증: `scripts/mock-exam-generation/rw-quant-verify.ts` 가 컴파일러 내부 정보 없이 선택지 텍스트와 figure 만 읽어, 인용 값이 자료와 같은지와 주장을 뒷받침하는 선택지가 정확히 하나인지(정답 표시와 일치)를 다시 판정한다. 36/36 통과.
- 항목 수 36건 (난이도 easy 8 · medium 14 · hard 14).

## 대체 대상 칸
기준: 공개 세트 중 정량 근거 문항 0건, 진행 중인 초안 버전 없음. 칸은 같은 영역(Information and Ideas)의 Command of Evidence (Textual) 칸에서 난이도가 같은 곳을 고른다. 세트당 최대 2칸, 한 세트에 같은 틀은 두 번 쓰지 않는다. 총 31칸(16세트).

| 세트 | 모듈·번호 | 칸 난이도 | 새 문항 gid | 틀(자료) | 새 문항 난이도 |
|---|---|---|---|---|---|
| SAT Practice Test 6 | rw_m1 #7 | easy | quant-pair-compare-20261027 | PAIR_COMPARE (bar) | easy |
| SAT Practice Test 6 | rw_m1 #27 | medium | quant-ratio-vs-baseline-20261090 | RATIO_VS_BASELINE (table) | medium |
| SAT Practice Test 10 | rw_m1 #9 | easy | quant-pair-compare-20261118 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 10 | rw_m2 #31 | easy | quant-target-met-20261097 | TARGET_MET (table) | medium |
| SAT Practice Test 11 | rw_m1 #27 | medium | quant-ratio-vs-baseline-20261293 | RATIO_VS_BASELINE (table) | medium |
| SAT Practice Test 11 | rw_m2 #31 | easy | quant-pair-compare-20261321 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 12 | rw_m1 #8 | easy | quant-pair-compare-20261384 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 13 | rw_m2 #28 | easy | quant-pair-compare-20261475 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 13 | rw_m2 #74 | hard | quant-max-change-20261104 | MAX_CHANGE (table) | hard |
| SAT Practice Test 16 | rw_m1 #5 | easy | quant-pair-compare-20261692 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 16 | rw_m2 #29 | easy | quant-target-met-20261300 | TARGET_MET (table) | medium |
| SAT Practice Test 17 | rw_m1 #5 | easy | quant-pair-compare-20261769 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 17 | rw_m2 #37 | medium | quant-ratio-vs-baseline-20261356 | RATIO_VS_BASELINE (table) | medium |
| SAT Practice Test 18 | rw_m1 #3 | easy | quant-pair-compare-20261937 | PAIR_COMPARE (table) | easy |
| SAT Practice Test 18 | rw_m2 #39 | medium | quant-target-met-20261363 | TARGET_MET (table) | medium |
| SAT Practice Test 19 | rw_m1 #5 | easy | quant-ratio-vs-baseline-20261447 | RATIO_VS_BASELINE (bar) | medium |
| SAT Practice Test 19 | rw_m2 #38 | medium | quant-target-met-20261454 | TARGET_MET (table) | medium |
| SAT Practice Test 20 | rw_m1 #9 | easy | quant-ratio-vs-baseline-20261622 | RATIO_VS_BASELINE (table) | medium |
| SAT Practice Test 20 | rw_m2 #39 | medium | quant-target-met-20261636 | TARGET_MET (table) | medium |
| SAT Practice Test 22 | rw_m1 #2 | easy | quant-ratio-vs-baseline-20261727 | RATIO_VS_BASELINE (bar) | medium |
| SAT Practice Test 22 | rw_m1 #17 | medium | quant-target-met-20261741 | TARGET_MET (table) | medium |
| SAT Practice Test 23 | rw_m1 #2 | easy | quant-ratio-vs-baseline-20261874 | RATIO_VS_BASELINE (table) | medium |
| SAT Practice Test 23 | rw_m1 #10 | medium | quant-target-met-20261888 | TARGET_MET (table) | medium |
| SAT Practice Test 24 | rw_m1 #11 | medium | quant-max-step-20261111 | MAX_STEP (line) | hard |
| SAT Practice Test 24 | rw_m2 #54 | medium | quant-max-change-20261307 | MAX_CHANGE (bar) | hard |
| SAT Practice Test 25 | rw_m1 #27 | medium | quant-max-step-20261314 | MAX_STEP (line) | hard |
| SAT Practice Test 25 | rw_m2 #40 | medium | quant-max-change-20261370 | MAX_CHANGE (bar) | hard |
| SAT Practice Test 27 | rw_m1 #21 | medium | quant-max-step-20261377 | MAX_STEP (line) | hard |
| SAT Practice Test 27 | rw_m1 #22 | medium | quant-max-change-20261461 | MAX_CHANGE (table) | hard |
| SAT Practice Test 30 | rw_m1 #11 | medium | quant-max-step-20261468 | MAX_STEP (line) | hard |
| SAT Practice Test 30 | rw_m1 #24 | medium | quant-max-change-20261678 | MAX_CHANGE (table) | hard |

제외 세트(이미 정량 근거 문항 있음): Test 15, Test 1, Test 4, Test 5, Test 2, Test 7, Test 14, Test 3.
초안 버전이 이미 있어 이번 계획에서 뺀 세트(해당 초안이 공개·폐기된 뒤 같은 방식으로 추가 가능): SAT Practice Test 9, SAT Practice Test 29, SAT Practice Test 21, SAT Practice Test 8, SAT Practice Test 28.
예비 문항(미사용 5건): quant-max-step-20261685, quant-max-change-20261755, quant-max-step-20261762, quant-max-change-20261923, quant-max-step-20261930.

## 반영 SQL (총괄 실행, 번호 31~35)
`SAT_QUANT=1 npx tsx scripts/prod-open/sat-expand-sql.ts` 로 생성한다(원격은 읽기 SELECT 만).
- `31_preflight_quant.sql` 읽기: 대상 세트의 초안 유무·현재 정량 근거 문항 수·이미 가져온 gid 수.
- `32_import_quant.sql` 새 문항 가져오기(멱등: 같은 gid 가 있으면 건너뜀, 게이트 통과분만 공개).
- `33_keywords_quant.sql` 스킬 키워드 연결(멱등).
- `34_set_versions_quant.sql` 대상 세트의 새 초안 버전(칸 교체, 세트 검증 함수 통과 못하면 그 세트만 건너뜀, 공개 없음). 칸 메타(스킬·난이도)는 새 문항 값으로 기록한다.
- `35_verify_quant.sql` 읽기 검증. `99_rollback_quant.sql` 초안 버전 삭제·가져온 문항 보관 처리.
- 순서: 31_preflight → 32_import → 33 → 34 → 35_verify. 세트 새 버전의 공개는 총괄 판단(응시 이력 있는 세트는 기존 버전이 보존됨).

## 순서 주의
- 27_set_versions_official_order(공식 문항 순서 정렬)가 칸 위치(position)를 바꾼다. 이 계획의 교체는 (세트, 위치, 옛 버전 id)가 모두 맞는 칸만 바꾸므로, 정렬 초안이 이미 공개돼 위치가 바뀐 세트는 '변경 없음'으로 건너뛴다. 정렬 공개 전에 34 를 먼저 반영하거나, 공개 뒤라면 덤프를 갱신해 `sat-quant-plan.ts` 를 다시 실행하고 위치를 새로 잡는다. 같은 세트에 초안이 있으면 건너뛰므로 둘 중 하나를 먼저 공개하거나 폐기해야 한다.

## 한계
- 시험 전체 정답률 분포·노출 횟수는 반영하지 않았다(칸 난이도만 맞춤). 반영 SQL 은 로컬 DB 리허설을 하지 않았고 세트 검증 함수에 의존한다.
- 브라우저 화면 확인은 하지 못했다(그림은 figure 검사·렌더러 오류 없음까지 확인).
