# 보강(supplement) 생성·검증 보고 (2026-10-09, 오너 승인 4~10)

범위: BC 단원 10 필수 부족 MC 2 + 1.5배 예비. 목표 = **신규 품질 통과 MC 35(필수 2 포함) + FRQ 묶음 10**. 승인 총 유료 호출 상한 $13.20(생성·검토·수선·재시도 포함, 지출 목표 아님), 누적 시작 $27.9992 → 최대 약 $41.20, 중단선 $45·총 상한 $50 유지. 서비스 키·원격/비프로덕션 DB·push·삭제·공유 스택(544xx)은 쓰지 않았다(DB 작업은 격리 스택 `ALTON_apsupp` 에서만, 끝나고 정리).

## 1. 하드닝(무료, 가장 먼저) — 오너 결정 9
- 모든 DB·API 대상 스크립트는 **모든 env 파일(`.env.local`, `.env`)과 process env 를 다 읽은 뒤** 대상을 정하고, 쓰기 전에 **docker 로 실제 컨테이너를 조회**해 DB URL·API URL 이 **같은 격리 project(`ALTON_<이름>`)** 의 `supabase_db_<id>`·`supabase_kong_<id>` 인지 확인한다. 공유 ALTON·불일치·컨테이너 없음·형식 위반·모호(같은 포트 게시 컨테이너 2개)면 쓰기 전에 종료한다. 포트 관계(API+1=DB)만으로는 사고(2026-10-09, DB만 공유 54422)를 못 막으므로 대체했다.
- 구현: `lib/dev/stack-identity.ts`(`mergeEnv`·`projectsPublishing`·`verifySameIsolatedStack`·`verifyIsolatedApi`·`assertIsolatedTargetOrExit`·`assertIsolatedApiOrExit`). 적용: `local-demo-seed.ts`·`screen-evidence.ts`(DB+API), 통합 테스트 가드 `lib/dev/integration-db-guard.ts` + `vitest.integration-guard.ts`(globalSetup: env 병합 후 포트 검사 + docker 검사, 조정 세션 우회 표식은 기존대로), `graph-load-rehearsal.ts`·`supp-load-rehearsal.ts`(API 전용).
- 테스트(가짜 docker 출력): `lib/dev/stack-identity.test.ts`(사고 재현: DB 공유·API 격리 → 차단, API+1=DB 이지만 컨테이너가 다른 project → 차단, 공유·형식 위반·중복 게시·docker 실패·env 병합 우선순위) + `integration-db-guard.test.ts` 보강. 실제 실행에서도 격리 스택으로 통과, 공유 스택이면 종료함을 확인(시드가 docker 검증을 통과해야 진행).
- 커밋 `cea6321c` (이후 `scripts/ap-generation/graph-load-rehearsal.ts`·`lib/dev/stack-identity.ts` API 전용 확장 포함).

## 2. 생성 — 작은 배치, 동결 구성 해시 고정, 자동 수선 반복 없음
모든 유료 배치는 `run-frozen.ts --freeze` 로 해시를 기록(`config/ap-frozen/supp-*.v1.json`)한 뒤 `--check-only`(불일치 시 종료 코드 2)를 거쳤다. 수선 모드는 쓰지 않았다. 반려 원형은 원인을 무료로 진단·수정한 뒤 **새 후보**로 다음 배치에 넣었다(같은 후보 수선 아님).

| 배치 | 내용 | 후보 | 통과 | 첫 통과율 | 비용 | 한도 |
|---|---|---|---|---|---|---|
| b1 `supp-b1-bc` | BC 단원 10(계산기 6 + 정확값·텍스트 8) 필수 부족 | 14 | 10 | 71% | $0.6846 | $1.8 |
| b2 `supp-b2-ab` | AB FRQ 새 유형 3(표 값·함수 분석·유입/유출) ×2 | 6 | 4(재고 3) | 67% | $0.4048 | $2.4 |
| b2 `supp-b2-bc` | BC 전용 FRQ 새 유형 2(테일러·이상적분) ×2 | 4 | 4(재고 3) | 100% | $0.2401 | $1.8 |
| b3 `supp-b3-ab` | AB 계산기 일반 MC 14(단원 5·6·2·4·8) | 14 | 11 | 79% | $0.6231 | $1.6 |
| b3 `supp-b3-bc` | BC 계산기 MC 5 + b1 반려 4 수정본 | 9 | 9 | 100% | $0.3431 | $1.2 |
| b3 `supp-b3-fa` | `frq_rate_in_out` v2 ×2 | 2 | 0 | 0% → **중단** | $0.1279 | $0.8 |
| b4 `supp-b4-ab` | 단원 5·6·2 부족 칸: 통과 구조의 두 번째 수치 묶음 6 + b3 반려 3 수정본 + 신규 1 | 11 | 9 | 82% | $0.4429 | $1.6 |
| b5 `supp-b5-bc` | BC 전용·계산기 FRQ `frq_polar_region` ×3 | 3 | 2(재고 1) | 67% | $0.1958 | $0.6 |
| b6 `supp-b6-ab` | FRQ 새 유형 2(모형 분석·조각 함수) ×2 | 4 | 3 | 75% | $0.2297 | $0.8 |
| **합계** | | **67** | **MC 39 + FRQ 10 (재고 기준)** | | **$3.2920** | $13.20 |
- 누적 $27.9992 → **$31.2912**(`ledger-total.ts`, 중단선 $45 여유 $13.71). 승인 상한 $13.20 의 25%, 보수 단가 추정($13.19) 대비 훨씬 적다 — 통과 MC 당 약 $0.06, FRQ 묶음 당 약 $0.07(관측). 단계별 한도는 아무 배치에서도 근접하지 않았다.
- **50% 미만 중단 조건**: b3 `frq_rate_in_out` v2 만 0%(2/2 반려)였고 즉시 중단했다. 같은 유형 v1 도 2/2 반려(`resembles_known_exam_item`)였으므로 **같은 원형이 연속 반려** → 진단: ① 기출 유사(표준 유입/유출 FRQ), ② v2 의 스킬 불일치(대표 스킬 3.E 인데 정당화 서술을 요구하는 파트 없음)·루브릭 문구 의존. 무료로 구조를 바꿔(감소 유입·상수 유출·"처음 양으로 돌아오는 시각") 재설계했으나 기출 유사 반려는 남아 **이 유형은 더 쓰지 않고**, 청사진이 있는 기존 계산기 유형 `frq_polar_region` 의 새 수치 묶음(b5)으로 Part A 를 채웠다. 구형 FRQ 원형(`frq_table_rate`·`frq_area_volume`·`frq_particle_motion`)은 설계도가 없어 현재 게이트를 통과하지 못해 쓸 수 없었다.
- 반려와 원인(전부 무료 진단): b1 4건(적분판정 선택지의 "감소" 가정이 ln n/n 에서 거짓 → 시작 n=3 으로, 해설 근거 부정확 3건 → 수치 근거 명시) 수정본은 b3 에서 4/4 통과. b3-ab 3건(`c_limit_def_derivative_calc` 는 연쇄법칙=3단원 범위 밖 → 곱·몫만 쓰는 함수로, `c_accum_max_value_calc` 는 3.E 스킬 불일치 → 1.E·오답 근거 보강, `c_critical_count_calc` 는 오답 근거가 열린 구간과 모순 → 정정) 수정본은 b4 에서 3/3 통과. b4 `c_implicit_second_calc`(AP 범위 밖 판정)·형제 1건은 반려 그대로(재시도하지 않음).
- FRQ 형제 묶음은 **근접 중복 게이트**(문장·자료 3-gram 유사도 > 0.8)가 같은 유형의 두 번째 묶음을 자주 반려한다(function_analysis·improper_parts·polar). 그래서 FRQ 는 유형을 늘리는 쪽으로 채웠다.

## 3. 결과 — 신규 통과와 구조 판정(`supplement-structure-review.md`)
| | MC | FRQ 묶음 |
|---|---|---|
| 신규 통과(고유 문항) | **39** | **10** |
| 독립 구조 문항군 | **28**(보수 하한 20) | 새 유형 **6** |
| 독립 군의 형제 | 3 | 3 |
| 기존 군에 보수적 합류(새 군 아님) | 8문항(아키타입 5종) | 1(`frq_polar_region`) |
- MC 단원 분포: 단원 10 **15**, 단원 5 11, 단원 6 4, 단원 9 3, 단원 2 2, 단원 4 2, 단원 7 1, 단원 8 1. 계산기 필수 30·불가 9. 대체가 어려운 칸(BC 단원 10, 계산기 필수 Part B, 단원 5·6·2·4 계산기 칸)에 먼저 배치했고 겹치는 칸은 한 문항이 함께 채우도록 설계했다(합산 금지).
- **필수 부족 2(BC 단원 10)는 해소**: 단원 10 보강 15건(필수 2 포함, 계산기 필수 6건 + 불가 9건; BC 전용). FRQ: Part B(계산기 불가) 8 · Part A(계산기) 2 · BC 전용 4(테일러 2·이상적분 1·극좌표 1; 극좌표는 기존 유형의 새 수치 묶음).
- 사전 점검(무료): 전 아키타입이 결정적 게이트·설계도·그림 게이트·생성기 결함 검사 0건을 통과했고, 신규 49건 `generatorDefects` 0건(`scripts/ap-generation/supp-defect-check.ts`). 같은 아키타입의 두 번째 수치 묶음은 사전 점검의 look-alike(`template`)에 걸리지만 의도된 형제다.

## 4. 5세트 계산 대상과 상태 (오너 결정 8)
**5세트 = AB#2, AB#3, BC#1, BC#2, BC#3.** AB#1 은 게시·고정(MC 42·FRQ 6, 변경 없음, 재고 계산에서 제외). 세트별 확정 배정은 `data/ap/stock/exact-assign-5sets-supp-strict.json`(정수계획 최적, 독립 검증기 위반 0, 한 최적해이며 다른 최적해가 존재), BC#1+AB#2 는 `exact-assign-bc1-ab2-supp-strict.json`.

| 세트 | 상태 | MC(A 29 + B 13) | FRQ | 비고 |
|---|---|---|---|---|
| AB#1 | **게시(고정)** | 42 | 6 | 변경 없음, 이중 계산 방지를 위해 모든 수요·재고에서 제외 |
| AB#2 | 예약(배정됨, 미게시) | 42 | 6 | 검증 대기 의존 13건 |
| AB#3 | 예약 | 42 | 6 | 검증 대기 의존 14건 |
| BC#1 | 예약 | 42 | 6 | 검증 대기 의존 12건 |
| BC#2 | 예약 | 42 | 6 | 검증 대기 의존 11건 |
| BC#3 | 예약 | 42 | 6 | 검증 대기 의존 9건 |
| 미배정 | **미사용 예비** | 117 | 15 | 재고(327·45)에서 예약 210·30 을 뺀 값 |

1.5배 목표는 5세트 번들 기준 ⌈1.5 × 수요⌉(과목 × 섹션 × 계산기 조건 단위 올림, 모든 칸 기계적 1.5배 아님). 게시·예약·미사용을 구분하고 이중 계산하지 않았다(`npx tsx scripts/ap-generation/supplement-status.ts`).

| 묶음 | 수요(5세트) | 게시(AB#1, 참고) | 예약 | 미사용 예비 | (그중 검증 대기) | 합계 | 1.5배 목표 | 채움률 | 그중 보강 신규 |
|---|---|---|---|---|---|---|---|---|---|
| MC 계산기 불가(Part A) | 145 | 29 | 145 | 82 | 30 | 227 | 218 | **104%** | 9 |
| MC 계산기 필수(Part B) | 65 | 13 | 65 | 35 | 34 | 100 | 98 | **102%** (전 70, 목표 98) | 30 |
| MC 그래프 필수(세트당 하한 10) | 50 | 10 | 50 | 21 | 21 | 71 | 75 | **95%** (부족 4) | 0 |
| MC BC 전용 단원 9·10 | 36 | 0 | 36 | 31 | 17 | 67 | 54 | **124%** | 18 |
| FRQ Part A(계산기) | 10 | 2 | 10 | 5 | 4 | 15 | 15 | **100%** | 2 |
| FRQ Part B(계산기 불가) | 20 | 4 | 20 | 10 | 8 | 30 | 30 | **100%** | 8 |
| FRQ BC 전용 | 6 | 0 | 8 | 2 | 2 | 10 | 9 | **111%** | 4 |

| 단원(MC) | 필수 하한(5세트) | 예약 | 미사용 | 합계 | 1.5배 목표 | 채움률 | 보강 신규 |
|---|---|---|---|---|---|---|---|
| 1 | 19 | 19 | 11 | 30 | 29 | 103% | 0 |
| 2 | 19 | 20 | 8 | 28 | 29 | 97% | 2 |
| 3 | 15 | 15 | 9 | 24 | 23 | 104% | 0 |
| 4 | 19 | 19 | 10 | 29 | 29 | 100% | 2 |
| 5 | 29 | 30 | 14 | 44 | 44 | 100% | 11 |
| 6 | 35 | 35 | 14 | 49 | 53 | **92%** | 4 |
| 7 | 15 | 15 | 11 | 26 | 23 | 113% | 1 |
| 8 | 19 | 21 | 9 | 30 | 29 | 103% | 1 |
| 9 | 15 | 15 | 16 | 31 | 23 | 135% | 3 |
| 10 | 21 | 21 | 15 | 36 | 32 | 113% | 15 |
- **남은 1.5배 예비 부족**: 그래프 필수 MC 4, 단원 6 MC 4(계산기 필수), 단원 2 MC 1. **세트 필수 부족은 0**(MC·FRQ 모두). 남은 칸은 새 독립 구조가 필요하고(그래프 변형은 문항군을 늘리지 못함) 내 판단으로 독립 구조 후보가 소진돼, 숫자만 다른 변형으로 채우지 않았다 — 필요하면 오너 결정 사항(단원 6 계산기 구조 4~5종 + 그래프 독립 구조 약 4종 원형 개발, 예상 호출비 $1 미만).

## 5. 조립 가능성: 계산상 가능 vs DB 적재·검증 후 사용 가능
| 대상 | 계산상(검증 대기가 통과한다는 전제) | **지금 DB 검증된 항목만** |
|---|---|---|
| BC#1 + AB#2 | **가상 문항 0**, 조건 전부 충족, 게시 AB#1 변경 없음 — 검증 대기 의존 최소 16건(보강 0건, 그래프 배치 필요) | **가상 MC 16**(증명) — 그래프 배치 70건 중 16건(BC#1 6 + AB#2 10)을 적재·검증해야 가능 |
| 5세트 전부 | **가상 MC 0·FRQ 0**(이전 MC 2 → 0), 검증 대기 의존 최소 59건(그래프 배치·형제·**보강 12건 포함**) | 가상 MC **43**·FRQ **3**(= 비프로덕션 검증된 항목만) |
- "계산상 가능"은 화면 증거 파일을 가진 항목을 쓴다는 뜻이다. **비프로덕션 DB 의 적재·렌더·화면 검증 기록은 오너 터미널 실행 전이라 아직 없다**(에이전트는 키를 취득할 수 없다). 오너 실행 절차는 `owner-run-graph-load.md`("보강 배치" 절), 순서: 그래프 10배치 → 형제 21건 → 보강 8배치 → `--no-pending` 재계산.
- 5세트 전부 쓰는 보강 신규는 MC 12·FRQ 2(최소 검증 대기 해 기준). 나머지 보강 신규는 미사용 예비(합계 MC 39·FRQ 10 중).

## 6. 화면 증거·렌더·예행 연습(격리 스택 `ALTON_apsupp`, 이미 정리)
- 렌더 보고서 재생성: 보강 통과 49건 중 표 자료 4건 pass, 나머지 그림 없음 not_applicable, 실패 0.
- 화면 증거 `data/ap/screen-evidence/evidence-supp.json`: 49건 × 2 뷰포트 = 98항목 전부 통과(보기 보임·표 렌더·가림 없음·제출 전 정답/해설 비노출·FRQ 입력·지문/선지/결과 해설의 원문 수식 없음), `checker_kind=automated`, content-hash 결속 49종. 스크린샷 `docs/ap/screen-evidence/supp/`(98장). `lib/ap-generation/screen-evidence-file.test.ts`(재고에 키 존재 + 해시 일치) 통과.
- 예행 연습(`supp-load-rehearsal.ts --execute`, 격리 스택): 8배치 적재 새 키 65·갱신 0 → 렌더 기록 49 → 화면 기록 49 → 사후 dry-run 새 키 0·이미 검증 49 — 표는 `owner-run-graph-load.md`. 시드·증거 생성 전 단계마다 하드닝된 docker 검증을 통과했다.
- 정리: dev 서버 종료, `isolated-stack.sh stop`(락의 project id 검사 후 `--no-backup`), `supabase/config.toml` 원복, 워크트리 `.env.local` 은 **서비스 키 없는 최소 격리 값**으로 썼다가 정리.

## 7. 남은 일·레거시·주의
- 오너 터미널 적재·검증 기록(그래프 70건·형제 21건·보강 49건) — 그 전에는 5세트가 "계산상 가능"일 뿐이다.
- 문항군 판정은 검토자 판단(경계 사례 8종은 독립으로 인정; 모두 묶으면 독립 20). 기준 변경 시 `structure-groups.json` 에 묶음을 추가하면 배정이 자동 반영된다.
- `frq_rate_in_out`(코드·가이드 항목은 남김, 실행 중단), 구형 FRQ 원형 설계도 부재, 근접 중복 게이트로 FRQ 형제가 잘 반려됨.
- 정책 대장(`docs/POLICY-DECISIONS.md`) 반영은 조정 세션 몫으로 두었다(결정 4~10 은 이 문서 첫 문단에 기록).
- 호출 비용 정산표(`cost-reconciliation.md` §6)에 보강 지출 한 줄을 추가했다.

## 8. 재현
`python3 scripts/ap-generation/archetypes/sync_guide_docs.py`(가이드·id 목록) · `npx tsx scripts/ap-generation/run-frozen.ts --config config/ap-frozen/supp-bN-….v1.json [--check-only]` · `graph-verdicts.ts <run>` · `graph-finalize.ts <run> <subject> <seed0>` · `stock.ts` · `supp-pass-keys.ts` · `render-check.ts` · 증거: `local-demo-seed.ts seed --keys-file data/ap/stock/supp-all-pass-keys.json --practice-sets` → `npm run dev -- -p 3011` → `screen-evidence.ts --out data/ap/screen-evidence/evidence-supp.json --shots-dir docs/ap/screen-evidence/supp`(격리 스택에서만) · 배정: `exact-assign.ts --sets BC1,AB2,BC2,AB3,BC3 --strict-families --min-pending [--no-pending]` · `reserve-plan.ts --strict-families` · `supplement-status.ts`.

## 9. 커밋(로컬, 명시 경로)
`cea6321c` 하드닝 · `12167619` b1 원형·구성 · `493a1cad` b1 결과·재고 배선(`supp-batches.ts`)·b2 FRQ 원형 · `6be3312b` b3 원형·b1 반려 수정 · `9139d989` b2·b3 결과 · `4b82a4e0` b4~b6 결과·통과 키 · 마지막 커밋: 화면 증거·오너 절차·5세트 배정·구조 판정·보고서.
