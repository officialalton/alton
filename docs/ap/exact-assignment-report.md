# 정확 배정(정수계획)·BC#1/AB#2 조립·1.5배 계획 보고 (2026-10-09, 무료·읽기 전용)

게시된 AB#1(문항·구성 고정, 10건 교체안은 쓰지 않음)을 빼고 BC#1·AB#2 와 나머지 세트를 **정확하게** 배정한다. 휴리스틱(담금질) 부족 수는 이 문서의 어떤 수치에도 쓰지 않는다. 생성·DB·서비스 키·원격·push·삭제 없음.

## 0. 사고 기록(공유 스택 쓰기 1회) — 조정 세션 확인 필요
격리 스택에서 화면 증거를 만들던 중, 첫 시드 실행(`local-demo-seed.ts seed --keys-file …`)이 **DB 쪽만 공유 스택 54422 로 접속**했다(스크립트의 `SUPABASE_TEST_DB_URL` 기본값이 54422 였고 값을 `.env.local` 에서 읽는 시점이 상수 계산보다 늦었음 — API 쪽은 격리 스택이라 두 쪽이 갈라짐). 결과: 공유 스택에 **`ap_candidate_items` 1행(run_id `apdemo<타임스탬프>`, candidate_key `apdemo<타임스탬프>-<첫 후보 stockKey>`) + 그 행의 `ap_set_verification` 2회(render·screen 표시)**, 과목 행이 없었다면 `apdemo… AP Calculus AB` 등 과목 최대 4행이 쓰였다. 곧바로 RPC(`ap_create_bank_problem`, 격리 스택으로 감)가 "Unknown AP candidate" 로 실패해 중단됐고 상태 파일이 쓰이지 않아 시드의 `cleanup` 으로는 지울 수 없다. 시각은 2026-10-09 약 15:40~15:50 UTC. **에이전트는 그 뒤 공유 스택에 접속하지 않았다**(삭제·확인도 금지 범위라 하지 않음). 정리는 조정 세션이 판단: `ap_candidate_items where run_id like 'apdemo%'` 중 이 시각의 행 1건과 `subjects where name like 'apdemo% AP %'`(있다면), 연결된 검증 기록. 고친 점: 두 스크립트가 `SUPABASE_TEST_DB_URL` 을 필수로 요구하고 544xx 거부·API+1=DB 일치 검사를 한다(`local-demo-seed.ts`, `screen-evidence.ts`). 이후 모든 DB 작업은 격리 스택 `ALTON_apev1`(API 54521 / DB 54522, 이미 정리됨)에서만 했다.

## 1. 증거 상태 (우선순위 1)
| 항목 | 결과 |
|---|---|
| 신규 통과 70건(MC 69 + FRQ 1) 화면 증거 | **70/70 통과**, 140항목(390×844·1280×800), automated, content-hash 결속, 점검 실패 0 — `data/ap/screen-evidence/evidence-graph-s1s3.json`, 스크린샷 `docs/ap/screen-evidence/graph-s1s3/` |
| 첫 시도에서 실패 1건 | `s3c-graph-bc:ap_calculus_bc-m02-k0`(오일러): 결과 화면 해설에 원문 TeX(`y_{k+1}…`) 노출(`result_no_raw_tex`). 아키타입·재고 해설을 수식으로 고치고 렌더 보고서·증거 재생성 → 통과(해시 변경 1건) |
| 렌더 보고서 | `data/ap/render-check/report.json` 재생성(그래프 76 pass·fail 0, 일반·FRQ 20 not_applicable) |
| 예행 연습(격리 스택) | 10개 배치 96행: 새 키 96·갱신 0 → 렌더 기록 70 → 화면 기록 70 → 사후 dry-run 새 키 0·이미 검증 70. `docs/ap/owner-run-graph-load.md` 표 |
| 추가: 증거 없던 기존 형제 21건(MC 15 + FRQ 6) | 증거 생성 21/21 통과(42항목) — `evidence-v1v45-siblings.json`. 렌더·화면 기록 예행 연습 21/21 |
오너 실행 순서·배치별 기대 건수·dry-run 출력은 `owner-run-graph-load.md` 가 정본이다.

## 2. BC#1 + AB#2 조립 (dry-run 선택, 우선순위 2)
- 재고(검증된 풀): 자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·**화면 증거 보유**(위 신규 70 + 형제 21 포함) MC 330·FRQ 41 중 **게시 AB#1(MC 42·FRQ 6) 제외** → MC 288·FRQ 35. 비프로덕션 검증이 아직인 항목(신규 70 + 형제 21 = 91건)은 "대기"로 표시.
- 결과: **BC#1·AB#2 모두 가상 문항 0, 조건 전부 충족, 게시 AB#1 변경 불필요**(교체안 미사용). 정수계획으로 최적 증명(MC·FRQ 모두 하한 0 = 해 0). 독립 검증기 위반 0.
  | 조건 | BC#1 | AB#2 |
  |---|---|---|
  | MC | 42 = Part A 29(계산기 불가) + Part B 13(필수) | 42 = 29 + 13 |
  | 단원(공식 범위 안) | 1:3 2:3 3:3 4:3 5:5 6:7 7:3 8:3 9:5 10:7 | 1:5 2:5 3:4 4:5 5:8 6:7 7:3 8:5 |
  | 스킬 1/2/3 | 25/12/5 | 29/8/5 |
  | 그래프 필수 MC(하한 10) | 10 | 10 |
  | 문항군(구조 판정 반영) | 42 서로 다른 군, 상한 1 | 42 서로 다른 군 |
  | FRQ 6(A 2 계산기 + B 4 불가) | 서로 다른 유형 6, BC 전용 2 | 서로 다른 유형 6 |
  | 두 세트 간·게시 AB#1 과 동일 문항 | 0 | 0 |
- 선택 파일(새 경로, 게시본 무변경): 구조 문항군 반영 `data/ap/stock/exact-assign-bc1-ab2-strict.json`(권장, 기본 군집 기준도 만족), 기본 군집 `exact-assign-bc1-ab2.json`. 재현: `npx tsx scripts/ap-generation/exact-assign.ts --sets BC1,AB2 --strict-families --min-pending --write-report <새 경로>`.
- **비프로덕션 검증 대기 의존: 최소 16건**(`--min-pending` 이 증명한 최솟값: 가상 0 을 유지하며 대기 항목 사용 최소 = 16). BC#1 6건, AB#2 10건:
  - BC#1: `s1-graph-ab:…ab-m08-k0`, `…m15-k0`, `s2-graph-ab:…m02-k0`, `…m04-k0`, `s3a-graph-ab:…m13-k0`, `s3b-graph-ab:…m01-k0`
  - AB#2: `s1-graph-ab:…m02-k0`, `…m11-k0`, `…m12-k0`, `…m17-k0`, `…m20-k0`, `…m07-k0`, `…m19-k0`, `…m21-k0`, `s2-graph-ab:…m05-k0`, `v45ab-final:v4-ab:ap_calculus_ab-m02-k3`(형제)
  - 이 16건이 오너 적재·검증 기록 전이면 선택기 조건(`screenVerified`)이 충족되지 않는다. **대기 항목을 전부 빼면**(적재 전 상태) BC#1 + AB#2 는 정확히 **가상 MC 16건 부족**(증명)이다 — 신규 70건의 적재가 BC#1·AB#2 의 전제다.
- 게시 AB#1 을 바꿔야만 가능한 결과: 없음.

## 3. "BC#1 단독 부족 1" vs "BC#1+AB#2 부족 0" (우선순위 3)
- **합동이 가능하면 단독도 가능하다.** 합동 해에서 AB#2 의 문항을 빼면 BC#1 의 해이고, BC#1 의 제약은 AB#2 와 문항이 겹치지 않아야 한다는 것 하나만 더 있을 뿐이라 단독 문제는 합동 문제의 완화다(같은 재고·같은 조건). 그러므로 같은 조건에서 "단독 1, 합동 0"은 **불가능**하고, 그 1 은 진짜 부족이 아니라 **담금질 휴리스틱의 국소 최솟값**이다.
- 원인: `six-set-plan.ts` 의 부족 수는 고정 시드 4개·250만 회 담금질로 얻은 "상한"이다(스크립트 머리 주석에도 "불가능·최소의 증명 아님"). 단계마다 세트 수가 달라 같은 시드라도 다른 탐색 경로를 타고(위반 1 = 점수 20, 온도는 낮게 끝남) 단계 0 은 1 에서 멈추고 단계 1 은 0 에 도달했다. 실제로 단계 2 도 실행마다 0~5 로 흔들렸다(보고서 §3).
- 정확 해법으로 재계산(`lib/ap-exam/ilp.ts` 단체법 + 분기한정, `scripts/ap-generation/exact-assign.ts`; 위반 0 인 배정을 실제로 먼저 찾고 독립 검증기로 재확인, 분기한정이 끝나 하한 = 상한이 된 것만 "최소"로 보고):
  | 세트 | 가상 MC 최소(증명) | 가상 FRQ |
  |---|---|---|
  | BC#1 단독 | **0** | 0 |
  | AB#2 단독 | **0** | 0 |
  | BC#1 + AB#2 | **0** | 0 |
  | + BC#2 | **0** | 0 |
  | + AB#3 + BC#3(5세트 동시) | **2** | 0 |
- 이전 휴리스틱 수치(단계 3 부족 19, 단계 0 부족 1)는 폐기한다. 5세트 정확 최소는 2 이고(원래 19 → 2), 형제 21건의 증거 없이(검증된 풀만)면 MC 6·FRQ 3, 신규 91건 전부 빼면 MC 43·FRQ 3 이다(전부 정확 최소).

## 4. 5세트 정확 부족 칸 (우선순위 4 — 실제 배정 출력의 칸만)
검증 대기 91건이 비프로덕션 검증을 통과한다는 전제의 **최소 MC 부족 2, FRQ 0**(증명). 일반 MC 15~19 같은 범위 확장은 채택하지 않았고 아래 칸만 적는다. 같은 최적 총량(2)의 배정이 여러 개라 칸은 한 해(解)의 값이고, 아래 "필수(어느 최적에도 피할 수 없음)" 표시만 확정이다.
**필수 부족(어느 최적 배정에서도 피할 수 없음)**: **BC 단원 10 MC 2건**(단원 10 은 BC 전용). 단원 1~9·Part A/B·스킬 1~3·그래프/비그래프 각각의 필수 부족은 0(그 묶음에 가상 0 인 최적 배정이 존재), Part A × 단원 10 과 Part B × 단원 10 도 각각 0 이라 두 건이 Part A/B 어느 쪽에도 놓일 수 있다. 즉 확정된 것은 "BC 단원 10 에 2건"이고 스킬·계산기·그래프 여부는 자유다.
**계수 증명(Hall 조건)**: BC 3세트는 단원 10 에서 세트당 최소 7문항(공식 하한) = 21 이 필요하다. 재고의 단원 10 은 21문항이지만 문항군이 10개(구조 판정 반영 시 8개)이고 문항군은 세트당 1건만 쓰므로 한 군이 3세트에 줄 수 있는 것은 min(군 크기, 3)이다 → 용량 2(series_test)+3(taylor_coeff)+3(radius_interval 4→3)+3(geometric_sum 4→3)+2(alt_series_table)+2(taylor_table)+라그랑주 계열 4(기본 군집: lagrange_error 1+lagrange_graph 1+g_lagrange 2건 각 1) = **19 < 21**. 정수계획 최소 2 와 일치한다(상한 = 하한).
**실제 배정 출력의 가상 문항(최적해 3개 — 같은 총량 2, 칸 조합만 다름)**
| 해 | 세트 | Part(계산기) | 단원 | 스킬 | 표현 | 문항군 |
|---|---|---|---|---|---|---|
| 기본 군집, 실행 1 | BC#1 | B(필수) | 10 | 3 | 그래프 없음 | 새 독립 구조 또는 용량 <3 인 군의 형제 |
| | BC#2 | A(불가) | 10 | 2 | 그래프 없음 | 〃 |
| 기본 군집, 최신 파일 `exact-assign-5sets.json` | BC#2 | B | 10 | 2 | 그래프 필수 | 〃 |
| | BC#3 | B | 10 | 2 | 그래프 없음 | 〃 |
| 구조 군집 `exact-assign-5sets-strict.json` | BC#3 | A | 10 | 3 | 그래프 필수 | 〃 |
| | BC#3 | B | 10 | 3 | 그래프 필수 | 〃 |
- 채우는 방법(용량 +1 씩): 용량이 3 미만인 군의 형제 1건(series_test 스킬 3·alt_series_table 스킬 2·taylor_table 스킬 2 등, 모두 계산기 불가·단원 10) 또는 새 독립 구조 1건. 같은 문항군은 세트당 1건이므로 한 군에서 3세트 몫(3건)이 필요하다. 이 외의 칸(AB 단원 1~8, 일반 MC 15~19 등)은 부족이 아니므로 만들지 않는다.
**검증 대기 항목이 일부 통과하지 못할 때(참고)**: 형제 21건 증거를 쓰지 않으면 MC 6·FRQ 3 — MC: BC#1 B 단원 10 스킬 1 그래프, AB#2 B 단원 3 스킬 3 비그래프, AB#2 B 단원 7 스킬 3 그래프, BC#2 B 단원 10 스킬 1 비그래프, BC#3 B 단원 5 스킬 2 비그래프, BC#3 B 단원 6 스킬 2 비그래프; FRQ: AB#2·BC#2·AB#3 의 Part B 각 1(공유 유형). 신규 91건 전부 빼면 MC 43·FRQ 3.

## 5. 1.5배 예비 계획 (우선순위 5 — 계획만, 생성 없음)
기준: **품질 통과·고유 재고**(자동 통과·결함 0·완전 중복 제외·렌더 통과·화면 증거 보유)로 센다(후보 수 아님). **게시 AB#1 48건은 재고에서 제외**(이미 쓴·예약). 수요 = 남은 5세트(AB#2·#3, BC#1~#3), 1.5배 목표 = ⌈1.5 × 수요⌉. 미사용 재고를 먼저 쓰므로 부족분만 생성한다. 재현 `npx tsx scripts/ap-generation/reserve-plan.ts [--strict-families]`.

**(가) 세트 필수 부족(예비 아님)** — 5세트 조립에 꼭 필요한 신규: **MC 2(BC 단원 10)**, FRQ 0. (검증 대기 91건이 통과한다는 전제. 통과 못 하면 형제 21 제외 MC 6·FRQ 3, 신규 전부 제외 MC 43·FRQ 3 로 늘어난다.)

**(나) 1.5배 예비 부족(필수와 별도)** — 목표까지 모자란 수에서 위 (가)를 뺀 예비분:
| 묶음 | 수요(5세트) | 통과·고유 재고(검증 대기 포함) | 1.5배 목표 | 목표까지 부족 | 그중 예비분 |
|---|---|---|---|---|---|
| MC 계산기 불가(Part A) | 145 | 218 (47) | 218 | 0 | 0 |
| MC 계산기 필수(Part B) | 65 | 70 (37) | 98 | 28 | 28 |
| MC 그래프 필수(세트당 하한 10) | 50 | 71 (64) | 75 | 4 | 4 |
| MC BC 전용 단원 9·10 | 36 | 49 (5) | 54 | 5 | 5 |
| FRQ Part A(계산기) | 10 | 13 (3) | 15 | 2 | 2 |
| FRQ Part B(계산기 불가) | 20 | 22 (4) | 30 | 8 | 8 |
| FRQ BC 전용 | 6 | 6 (1) | 9 | 3 | 3 |
단원별 하한 기준 1.5배 목표까지 부족(대체가 어려운 칸): 단원 5 **+11**, 단원 10 **+11**(BC 전용, 계산기 필수 재고 2뿐·그래프 3), 단원 6 **+8**, 단원 2 +3, 단원 4 +2(나머지 단원 0). 구조 문항군 판정(§6) 반영 시 MC 군집은 152 → 111, 그래프 필수 군집은 65 → 48.
**배분 제안(예비를 모든 칸에 기계적으로 나누지 않는다)**: ① 대체가 어려운 구조에 먼저 — BC 단원 10(+11, 필수 부족 2 포함), 단원 5(+11)·6(+8)·2(+3)·4(+2)의 **계산기 필수 칸**(Part B 28을 여기에 겹쳐 채움), 그래프 필수 +4(위 단원에 그래프형으로 섞음), BC 전용 FRQ +3 ② 나머지 FRQ Part A +2·Part B +8(BC 전용 3을 겹침). 합산 **신규 통과 MC 35(필수 2 + 예비 33) + FRQ 10**.

**비용(누적 $27.9992, 중단선 $45, 상한 $50 — 여유 $17.0008 / $22.0008)**
| 구분 | 신규 통과 수 | 관측 단가 기준(S1~S3: $4.1358/통과 70 = $0.0591, FRQ 약 $0.25) | 보수 단가(원장 정책: MC $0.134, 그래프·표 ×1.6, FRQ $0.399×1.5, 재시도 ×1.2) |
|---|---|---|---|
| 세트 필수 부족 | MC 2 | $0.12 | $0.32(그래프형이면 $0.51) |
| 1.5배 예비 | MC 33(그래프 4 포함) + FRQ 10 | MC $1.95 + FRQ $2.50 = **$4.45** | MC $5.69 + FRQ $7.18 = **$12.87** |
| 합계 | MC 35 + FRQ 10 | **$4.57 → 누적 $32.57** | **$13.19 → 누적 $41.19** |
- 보수 기준에서도 중단선 $45 아래(누적 $41.19)이고 상한 $50 이내다. 통과율은 S1~S3 실측 MC 69/94 = 73%, FRQ 1/2 — 후보 수는 통과 수 ÷ 0.73(MC)·÷0.5(FRQ)로 환산(MC 약 48후보, FRQ 약 20후보). 승인 아님.
- **새 아키타입 비용 주의**: §6 판정상 "표현만 바꾼 그래프판"은 문항군을 늘리지 못한다. BC 단원 10·AB 단원 5·6 의 부족은 **새 독립 구조 아키타입**(원형 개발)이 필요해 위 LLM 비용에 포함되지 않는 개발 시간이 든다.

## 6. 문항군 구조 판정 (우선순위 6)
`family-structure-review.md`. 신규 통과 MC 69건 중 **독립 구조 N 30 / 기존 아키타입 변형 R-기존 33 / 신규끼리 변형 R-신규 6**. 아키타입 코드 공유는 0(코드 기준 69)이나 구조 기준 독립 문항군은 **30**. 이 판정을 문항군 상한 1 에 적용해도(`--strict-families`) BC#1·AB#2 는 0 부족이고 5세트는 MC 2 로 같다.

## 7. 후보 수 대조 (우선순위 7)
단계 합 37 + 12 + 44 = 93 과 적재 행 96 의 차이 3 은 **새 후보가 아니라 보고서의 S3 합계 오기**다: S3 실제 행은 47(MC 45 + FRQ 2)인데 보고서는 "MC 42(+FRQ 2)"로 적어 BC S3c 배치(`graph-s3f`, MC 3행 = 통과 1·반려 2)의 MC 3행이 빠졌고 S3 통과도 "MC 28"이 아니라 30 이다. 재생성(S3d BC FRQ 재시도 `s3d-graph-bc:…f01-k0`, $0.0788)은 이미 FRQ 2 에 포함돼 있다. 원장 호출 시각 창과 재고 파일을 맞춘 **하나의 최종 표**(`npx tsx scripts/ap-generation/graph-reconcile.ts`, 비용 합 = 보고 지출 $4.1358):
| 단계 | 재고 파일 | 호출 비용($) | 행 | MC 통과 | MC 반려 | FRQ 통과 | FRQ 반려 | 완전 중복 |
|---|---|---|---|---|---|---|---|---|
| S1 BC#1+AB#2(AB) | graph-s1-items | 1.6970 | 37 | 29 | 8 | 0 | 0 | 0 |
| S2 BC#2(BC) | graph-s2b-items | 0.2770 | 6 | 5 | 1 | 0 | 0 | 0 |
| S2 BC#2(AB) | graph-s2a-items | 0.2369 | 6 | 5 | 1 | 0 | 0 | 0 |
| S3a AB | graph-s3a-items | 0.8687 | 23 | 17 | 6 | 0 | 0 | 0 |
| S3a BC | graph-s3b-items | 0.1305 | 3 | 1 | 2 | 0 | 0 | 0 |
| S3b AB | graph-s3c-items | 0.2522 | 6 | 5 | 1 | 0 | 0 | 0 |
| S3b BC | graph-s3d-items | 0.1147 | 3 | 1 | 2 | 0 | 0 | 0 |
| S3c AB | graph-s3e-items | 0.2908 | 7 | 5 | 2 | 0 | 0 | 0 |
| S3c BC | graph-s3f-items | 0.1891 | 4 | 1 | 2 | 0 | 1 | 0 |
| S3d BC FRQ 재시도 | graph-s3g-items | 0.0788 | 1 | 0 | 0 | 1 | 0 | 0 |
| **합계** | | **4.1358** | **96** | **69** | **25** | **1** | **1** | **0** |
- 최종 재고: **MC 통과 69, FRQ 통과 1, 반려 26(MC 25 + FRQ 1), 완전 중복 0**. 반려 26건 사유(첫 사유 기준): 오답 해설 기준 12, 스킬·범위 8(FRQ 1 포함 — 극좌표 곡선 길이가 BC 범위 밖·기울기 0 키·채점 단위 불일치), 자료 표현 3, 시험 적합성 1, 풀이기 불일치 1(`s2-graph-bc-final:ap_calculus_bc-m05-k0`: 문제문의 "모든 계수 도함수 존재"가 그래프 모서리와 모순), 키·채점 1. 반려 후보 ID 전체는 스크립트 출력.
- 구조 변형은 "중복"이 아니라 §6 의 R 판정이다(완전 중복 0, 사전 점검에서 템플릿 동일로 걸린 1건은 유료 호출 전에 문구를 바꿔 행으로 남지 않았다).

## 8. 테스트 보강 (우선순위 8)
`lib/ap-generation/screen-evidence-file.test.ts` 를 고쳤다(커밋 `d95e74e5`): 증거 항목의 `candidate_key` 가 **결합 재고(`items.json` + `STOCK_FILES` 의 모든 보조 배치: bc-topup·graph-s*·v1ab·v45ab …)에 없으면 실패**하고, **증거에 있는 모든 키**(첫 키만이 아님)와 그 키의 모든 항목에 대해 `judgeScreenEntries` 와 `content_hash === itemContentHash(payload)` 를 확인한다. 이전 수정의 "재고에 없으면 건너뜀"은 제거했다. 신규 증거 파일 2개(70·21건)가 이 검사를 통과한다.

## 9. 재현·검증
- 정확 배정: `npx tsx scripts/ap-generation/exact-assign.ts --sets BC1,AB2[,BC2,AB3,BC3] [--strict-families] [--min-pending] [--no-pending] [--write-report <새 경로>]`(게시본 경로 쓰기 거부), 필수 칸 분석 `exact-assign-cells.ts`. 해는 항상 독립 검증기(`verifyAssignment`)로 재계산한다.
- 테스트: `lib/ap-exam/ilp.test.ts`(솔버), `lib/ap-exam/exact-assign.test.ts`(BC#1·AB#2 가 가상 0·단독도 0·검증기가 위반을 잡음), `lib/ap-generation/screen-evidence-file.test.ts`.

## 10. 보강 이후 (2026-10-09, `supplement-report.md`)
보강 49건(MC 39 + FRQ 10)의 화면 증거(`evidence-supp.json`)를 포함해 다시 계산: **5세트(AB#2·AB#3·BC#1·BC#2·BC#3) 가상 MC 0·FRQ 0**(`exact-assign-5sets-supp-strict.json`, 독립 검증기 위반 0), BC#1+AB#2 도 가상 0(`exact-assign-bc1-ab2-supp-strict.json`, 검증 대기 의존 최소 16건·보강 0). 계산상 가능이며 **비프로덕션 DB 검증 완료 항목만으로는** 5세트 가상 MC 43·FRQ 3, BC#1+AB#2 가상 MC 16 그대로다(오너 적재 전). 5세트 전부에 필요한 검증 대기 항목은 최소 59건(그래프 배치 44 + 형제 3 + 보강 12).

## 11. 문항군 두 시나리오 재계산 + 실조립 준비 (2026-10-09 오너 요청 A·C, 무료·DB 없음)
**동일 하드 조건**: 게시 AB#1 포함 어떤 풀 세트와도 동일 문항 0, 문항군(구조) 세트 안 상한 1, 공식 단원·스킬 비중, 계산기 29/13, 그래프 필수 ≥10, FRQ 6 서로 다른 유형·BC 세트 BC 전용 ≥2. 코드 아키타입·숫자만 다른 변형은 별도 군으로 세지 않음(`--strict-families`). 재고 = 화면 증거 보유 전부(검증 대기 포함, 오너 적재 완료 가정).
| 시나리오 | 묶음 파일 | 보강 MC 독립 문항군 | 재고 MC 문항군 | BC#1+AB#2 | 5세트(AB#2·AB#3·BC#1·BC#2·BC#3) |
|---|---|---|---|---|---|
| (i) 독립 28 | `structure-groups.json`(커밋됨) | 28 | 150 | 가상 MC 0·FRQ 0, 위반 0 | 가상 MC 0·FRQ 0, 위반 0 |
| (ii) 보수(경계 8종 병합) | `structure-groups.conservative.json`(새 파일, 커밋 묶음에 8묶음 추가) | **21**(문서의 20과 1 차이: `c_ftc_second_derivative_calc` 는 이미 `ftc_accum` 군집에 합쳐져 있어 실제 줄어든 것은 7) | 143 | 가상 0·FRQ 0, 위반 0 | 가상 0·FRQ 0, 위반 0 |
- **(ii)는 불가능하지 않다 → 부족 칸·증명 없음**(정수계획 최적 = 가상 0, 분기한정 끝). 최종 조립은 (ii) 기준(보수 구조 판정)으로 하고 커밋된 `structure-groups.json` 은 건드리지 않았다(조립 시 `STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json` 환경변수로 선택; `assign-pool.ts` 에 추가).
- 검증 대기 의존 최소(보수, 가상 0 유지): BC#1+AB#2 = **16건**(BC#1 6 + AB#2 10, 신규70 15 + 형제 1) — 보강 불필요. 이어서 AB#3·BC#2·BC#3 를 BC#1/AB#2 를 고정(`--exclude-keys`)한 뒤 풀어도 **가상 0**, 추가 검증 대기 최소 43건(AB#3 15·BC#2 15·BC#3 13). 즉 BC#1·AB#2 를 먼저 조립해도 뒤 세트가 막히지 않는다.
- 산출(새 파일, 계획용 — 실조립은 오너 적재 뒤 DB 검증 재고로 다시 계산): `exact-assign-5sets-cons.json`, `exact-assign-bc1-ab2-cons-minpending.json`, `exact-assign-ab3-bc2-bc3-cons-after-bc1ab2.json`.

### 실조립 절차 (오너 적재·DB 검증 완료 후, 조정 세션이 비프로덕션 키로 실행)
전제: `owner-run-graph-load.md` 맨 위 표의 ①②③ 완료, 통과 140건이 `review_env_ready=true`. 모든 산출은 **새 경로 `data/ap/stock/assembled/`**(게시 AB#1 기록·`ab-full-set-selection.*` 불변; `exact-assign.ts`는 그 경로 쓰기를 거부, `assembly-keys.ts export` 는 기존 파일 덮어쓰기를 거부).
1. DB 검증 키 목록 내보내기(읽기 전용): `ap_item_review_status_v` 에서 `review_env_ready` 인 `candidate_key` 를 JSON 배열로(`/tmp` 아닌 스크래치). 재고가 이 목록과 다르면 중단.
2. BC#1+AB#2 먼저: `STRUCTURE_GROUPS_FILE=data/ap/stock/structure-groups.conservative.json npx tsx scripts/ap-generation/exact-assign.ts --sets BC1,AB2 --strict-families --min-pending --write-report data/ap/stock/assembled/plan-bc1-ab2.json` → 가상 0·위반 0 이어야 진행.
3. 나머지: 같은 환경변수로 `--sets AB3,BC2,BC3 --strict-families --exclude-keys data/ap/stock/assembled/plan-bc1-ab2.json --write-report data/ap/stock/assembled/plan-rest.json`(BC#1·AB#2 문항을 고정 제외).
4. 세트별 선택 파일: `npx tsx scripts/ap-generation/assembly-keys.ts export --report data/ap/stock/assembled/plan-bc1-ab2.json --out-dir data/ap/stock/assembled/sets` 와 `plan-rest.json` 도 같은 out-dir 로 → `BC1.keys.json`·`AB2.keys.json`·`AB3.keys.json`·`BC2.keys.json`·`BC3.keys.json`(`{set, keys:{mcA,mcB,frqA,frqB}}` = `assemble-ap-set.ts --keys-file` 형식, 섹션 지정 포함).
5. **독립 검증**(배정기와 별개 재계산): `npx tsx scripts/ap-generation/assembly-keys.ts verify --files data/ap/stock/assembled/sets/BC1.keys.json,…/AB2.keys.json,…/AB3.keys.json,…/BC2.keys.json,…/BC3.keys.json --verified-keys <1 의 목록>` — 위반 0 이어야 한다(게시 AB#1·세트 간 중복 0·문항군·단원·스킬·계산기·그래프·FRQ·DB 검증 목록 포함).
6. 문제은행 변환(검수 환경 게시, 후보당 용도 `mock_exam` 고정): `npx tsx scripts/ap-generation/publish-to-bank.ts --purpose mock_exam --keys <선택 키> --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq` dry-run → 대상 건수 확인 → `--execute`. 이미 변환된 후보는 대상에서 빠진다(AB#1 의 기존 변환·응시 기록 무변경).
7. **초안으로만 저장(공개 안 함)**: 세트마다 `npx tsx scripts/ap-generation/assemble-ap-set.ts --subject ap_calculus_bc --keys-file data/ap/stock/assembled/sets/BC1.keys.json --name "AP Calculus BC — Practice Exam 1" --draft --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq` 를 dry-run 후 `--execute`(AB 는 `--subject ap_calculus_ab`, 이름은 AB#2·#3, BC#2·#3). 스크립트는 공식 구성(MC 42·FRQ 6)을 못 채우면 세트를 만들지 않고, 같은 이름의 비보관 세트가 있으면 중단하며, `status='draft'`(공개 안 함)로 `mock_exam_sets`·`mock_exam_set_items` 에 새 행만 INSERT 한다. **`publish` 단계(상태 변경·공개)는 이 라운드에서 하지 않는다.**
8. 기존 응시 기록 무변경: 위 과정은 INSERT 전용이다(기존 `mock_exam_sets`·`mock_exam_set_items`·응시·점수 행 UPDATE/DELETE 없음, 게시 AB#1 의 문제 버전·후보 `is_current` 불변). 진행 전후에 `mock_exam_attempts` 행 수와 AB#1 세트·항목 행 수를 읽기 전용으로 세어 같은지 확인.
- 실제 DB 쓰기(6·7)는 오너 승인 뒤 조정 세션이 한다. 이 문서·스크립트는 어디에도 키를 담지 않는다.

### 최종 DB 기준 보고에 필요한 항목 체크리스트
1. 조립된 세트 5개(이름·id·초안 상태·MC 42/FRQ 6 구성·각 문항 `candidate_key`)와 AB#1 변경 없음 확인.
2. 게시 상태: AB#1 게시, 나머지 5개 모두 `status='draft'`(공개 0) — `mock_exam_sets` 조회.
3. 고유 문항 수와 구조 문항군 수(세트 6개 합계, 세트 간 동일 문항 0, 세트 안 문항군 1 — `assembly-keys.ts verify` 출력과 DB 조회 일치).
4. 예비 부족: 5세트 사용 후 미사용 재고(`ap_item_review_status_v` 에서 `review_env_ready` 이면서 세트 미배정)를 묶음별로 세어 1.5배 목표 대비(그래프 필수 4·단원 6 계산기 4·단원 2 1 등 `supplement-report.md` §4 표와 같은 기준) 부족 수.
5. launch 차단 미해결 결함: `ap_launch_ready_v`(= 최신 게이트 통과 + 렌더·화면 검증 + `open_defect_reports=0` + `open_blockers=0`)에 배정된 모든 후보가 있는지, 빠진 후보는 `ap_launch_blockers`(`resolved_at is null`)·`ap_item_review_status_v.open_defect_reports` 로 사유 확인. 배정 문항 중 `ap_launch_ready_v` 밖이 하나라도 있으면 보고서에 명시.
6. 누적 비용: `npx tsx scripts/ap-generation/ledger-total.ts`(현재 $31.2912 = 27.9992 + 3.2920, 중단선 $45·상한 $50) — 이후 추가 유료 호출이 없었음을 원장으로 확인.
7. 외부 변경 내역(어느 DB에 몇 행 INSERT) 과 UAT/자동 테스트 실행 ID, 정리 결과.
