# 오너 실행 절차: 그래프·일반 신규 배치 10개 비프로덕션 적재·검증 기록 (2026-10-09, 예행 연습 완료)

## 한눈에 보는 오너 적재 표 (고정 순서: ① 그래프 10파일 → ② 형제 21 → ③ 보강 8파일, 2026-10-09 요청 B)
키는 어디에도 적지 않는다. 모든 단계: 먼저 dry-run → 표의 기대와 같을 때만 `--execute`. 출력 첫 줄 `대상:` 이 `worpsqwqgnspddnrtnvq.supabase.co` 가 아니면 즉시 중단. `$T` = `--target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq`.
| 단계 | 파일 수·내용 | 적재 행(총) | 최종 통과(검증 대상) | 렌더 기록 | 화면 기록 | 적재 dry-run 기대 | 렌더·화면 dry-run 기대 | execute 명령 형태 | 사후 확인(읽기 전용) |
|---|---|---|---|---|---|---|---|---|---|
| ① 그래프·일반 | 10파일(`graph-s1…s3g-items`) | **96** (통과 70 + 반려 26 이력) | **70** (MC 69 + FRQ 1) | 70 | 70 | `새 키 96·갱신 0` (파일별 표 아래) | 렌더 `대상 70(파일별 합)·건너뜀 0` / 화면 `신규 70·라벨 0·건너뜀 0` | 파일마다 `import-candidates.ts --items data/ap/stock/<파일>.json --batch <배치> --supplement --execute` → `mark-verified.ts --render --report data/ap/render-check/report.json --keys-file <통과 키 파일> $T --execute` → `mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-graph-s1s3.json --keys-file <통과 키 파일> $T --execute` | 3개 명령을 `--execute` 없이 재실행: `새 키 0`, `이미 검증됨 70`, `이미 같은 증거 70`, 신규 0 |
| ② 기존 형제 | 키 목록 1개(`v1v45-siblings-keys.json`, 이미 적재돼 있다고 가정 — 적재 생략) | 0 (신규 적재 없음) | **21** (MC 15 + FRQ 6) | ≤21 (이미 검증된 것은 `이미 검증됨`) | 21 | 적재 없음 | 렌더 `대상 ≤21` / 화면 `신규 21·라벨 0` | `mark-verified.ts --render …` 와 `mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-v1v45-siblings.json --keys-file data/ap/stock/v1v45-siblings-keys.json $T` 각각 dry-run 뒤 `--execute` | 두 명령 재실행: `이미 검증됨 21`, `이미 같은 증거 21` |
| ③ 보강 | 8파일(`supp-b1·b2ab·b2bc·b3ab·b3bc·b4ab·b5bc·b6ab-items`) | **65** (통과 49 + 반려 16 이력) | **49** (MC 39 + FRQ 10) | 49 | 49 | `새 키 65·갱신 0` | 렌더 `대상 49` / 화면 `신규 49·라벨 0·건너뜀 0` | 파일마다 `import-candidates.ts --items data/ap/stock/<파일>.json --batch <supp-bN-…> --supplement --execute` → 렌더(`--report data/ap/render-check/report.json --keys-file data/ap/stock/<supp-bN…-pass-keys.json>`) → 화면(`--evidence data/ap/screen-evidence/evidence-supp.json`, 같은 키 파일) 각각 `--execute` | 3개 재실행: `새 키 0`, `이미 검증됨 49`, `이미 같은 증거 49` |
| **합계** | 18파일 + 키 목록 1 | **161** (96 + 65 = 통과 119 + 반려 이력 42; 아래 주 참고) | **140** | 140 (②의 이미 검증분 제외 가능) | 140 | | | | DB 에서 통과 140건이 `review_env_ready` 인지 확인(아래 "조립 직전 점검") |
- 반려 행 수 정정: ①의 반려 26 + ③의 반려 **16**(= 67행 중 b3fa 2행 제외한 65행에서 통과 49 뺀 값) = 42 이력 행(합계 적재 161 = 통과 119 + 반려 42, ②의 21건은 이미 적재돼 있어 합계 행에 포함하지 않는다. 통과 140 = 70 + 21 + 49 는 검증 대상 건수).
- **`supp-b3fa`(2행, 통과 0, 기출 유사 반려한 `frq_rate_in_out`)는 적재 표에서 제외**(새 키 2 로 적재하려면 선택 사항이며 검증 단계가 없다). 위 ③ 의 65행 안에는 **검수는 통과했으나 근접 중복 게이트(3-gram 유사도 > 0.8)로 최종 반려된 3건**(`supp-b2-ab-final:…f02-k1`, `supp-b2-bc-final:…f02-k1`, `supp-b5-bc-final:…f01-k2`)이 `rejected` 행으로 들어 있다 — 재고·검증 대상에서는 빠져 있고 통과 키 파일에도 없다.
- 렌더 기록 수가 통과 수와 같은 것은 그림이 없는 문항이 `not_applicable` 로도 기록되기 때문(예행 연습 실측). 오너 dry-run 출력의 건수가 이 표와 다르면 중단하고 보고.
- 순서를 지키는 이유: ① 이 BC#1·AB#2 의 전제(검증 대기 최소 16건 중 대부분), ② 는 AB#2·AB#3 일부 보강 재고, ③ 은 BC 단원 10 등 5세트 전체의 전제. 순서 자체는 서로 독립이라 어느 단계에서 멈춰도 데이터는 일관(추가만 하는 적재).

### 조립 직전 점검(읽기 전용, 오너 또는 조정 세션)
적재·검증 후 DB 에서 통과 140건이 모두 `ap_candidate_items.review_env_ready = true` 인지 확인하고(`ap_item_review_status_v`), 키 목록을 JSON 배열 파일로 내보내 `assembly-keys.ts verify --verified-keys <파일>` 에 넘긴다(`exact-assignment-report.md` §11).

`owner-run-bc-topup-load.md` 와 같은 방식이다(오너가 bc-topup 을 같은 절차로 성공 실행). 에이전트는 서비스 키를 취득할 수 없어 이 단계는 **오너 본인 터미널**에서 실행한다. 이 문서·채팅·로그에 키를 적지 않는다. 대상은 공유 비프로덕션 `worpsqwqgnspddnrtnvq` 뿐이다(스크립트가 호스트가 다르면 `--execute` 를 거부).

## 준비된 증거(에이전트가 격리 스택에서 만들어 커밋함)
| 파일 | 내용 |
|---|---|
| `data/ap/screen-evidence/evidence-graph-s1s3.json` | 신규 통과 70건(MC 69 + FRQ 1)의 화면 증거 v3 — 390×844·1280×800 모두, 140항목, `checker_kind=automated`, content-hash 결속, 점검 실패 0. 스크린샷 `docs/ap/screen-evidence/graph-s1s3/` |
| `data/ap/screen-evidence/evidence-v1v45-siblings.json` | 화면 증거가 없던 기존 형제 21건(MC 15 + FRQ 6; 아래 "추가 21건")의 증거 — 42항목, 실패 0. 스크린샷 `docs/ap/screen-evidence/v1v45-siblings/` |
| `data/ap/render-check/report.json` | 렌더 보고서(재생성). 신규 96건 그래프 76 pass·fail 0·나머지 not_applicable. **`s3c-graph-bc-final:ap_calculus_bc-m02-k0`(오일러) 해설의 원문 TeX(`y_{k+1}…`)를 수식으로 고쳐 해시가 바뀐 뒤의 보고서다** — 예전 보고서가 있으면 이 파일로 덮어써야 한다. |
- 화면 점검은 응시 화면에서 문항마다: 보기/입력 보임·그림/표 렌더·가림·가로 스크롤 없음·제출 전 정답/해설 비노출·FRQ 입력·지문/선지 원문 수식 없음, 제출 뒤 결과 화면 해설 원문 수식 없음.
- 첫 시도에서 오일러 1건이 `result_no_raw_tex` 로 실패했다(해설 `y_{k+1} = …` 가 `$…$` 없이 노출). 아키타입(`calc_graph_k.py`)과 재고(`graph-s3f-items.json`)를 고치고 렌더·화면 증거를 다시 만들어 **지금은 70/70 통과**다. 이 수정으로 이 문항의 payload 해시가 바뀌었으므로 반드시 위 두 파일이 같이 쓰여야 한다(`content_hash` 불일치면 `mark-verified` 가 건너뜀).

## 준비 (같은 터미널 세션에서만)
1. `export NEXT_PUBLIC_SUPABASE_URL=<비프로덕션 프로젝트 URL>`, `read -s SUPABASE_SECRET_KEY` 입력 후 `export SUPABASE_SECRET_KEY`.
2. 모든 출력 첫 줄 `대상:` 이 `worpsqwqgnspddnrtnvq.supabase.co` 인지 매번 확인. 로컬이거나 다른 호스트면 즉시 중단.
3. `mark-verified.ts` 는 항상 `--target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq` 를 붙인다(`$T`). `import-candidates.ts` 는 `--execute` 일 때 호스트가 비프로덕션인지 스스로 확인한다.

## 배치 표와 단계별 기대 건수 (예행 연습 실측, 새 키만 insert)
공통: 재고 파일은 `data/ap/stock/<파일>.json`, 통과 키 파일은 `data/ap/stock/<파일 접두>-pass-keys.json`. 합계 **96행 → 새 키 96, 통과 70**(반려 26행은 이력으로만 적재되고 검증 대상 아님).

| 재고 파일 | 배치 이름 | 행 | ① 적재 dry-run 기대 | ③ 렌더 dry-run 기대 | ④ 화면 dry-run 기대 | ⑤ 사후 |
|---|---|---|---|---|---|---|
| graph-s1-items | graph-s1-ab-2026-10-09 | 37 | 새 키 37, 갱신 0, 무변경 0, 보존 0 | 대상 29, 건너뜀 0 | 신규 29, 라벨 0, 같은 증거 0 | 새 키 0 / 렌더·화면 이미 29 |
| graph-s2a-items | graph-s2-ab-2026-10-09 | 6 | 새 키 6, 갱신 0 | 대상 5 | 신규 5 | 새 키 0 / 이미 5 |
| graph-s2b-items | graph-s2-bc-2026-10-09 | 6 | 새 키 6, 갱신 0 | 대상 5 | 신규 5 | 새 키 0 / 이미 5 |
| graph-s3a-items | graph-s3a-ab-2026-10-09 | 23 | 새 키 23, 갱신 0 | 대상 17 | 신규 17 | 새 키 0 / 이미 17 |
| graph-s3b-items | graph-s3a-bc-2026-10-09 | 3 | 새 키 3, 갱신 0 | 대상 1 | 신규 1 | 새 키 0 / 이미 1 |
| graph-s3c-items | graph-s3b-ab-2026-10-09 | 6 | 새 키 6, 갱신 0 | 대상 5 | 신규 5 | 새 키 0 / 이미 5 |
| graph-s3d-items | graph-s3b-bc-2026-10-09 | 3 | 새 키 3, 갱신 0 | 대상 1 | 신규 1 | 새 키 0 / 이미 1 |
| graph-s3e-items | graph-s3c-ab-2026-10-09 | 7 | 새 키 7, 갱신 0 | 대상 5 | 신규 5 | 새 키 0 / 이미 5 |
| graph-s3f-items | graph-s3c-bc-2026-10-09 | 4 (FRQ 반려 1 포함) | 새 키 4, 갱신 0 | 대상 1 | 신규 1 | 새 키 0 / 이미 1 |
| graph-s3g-items | graph-s3d-bc-2026-10-09 | 1 (FRQ) | 새 키 1, 갱신 0 | 대상 1 | 신규 1 | 새 키 0 / 이미 1 |
| 합계 | | 96 | 새 키 96 | 70 | 70 | |
- 렌더 dry-run 줄: `렌더 검증 대상 N건, 건너뜀 0건, 이미 검증됨 0건 (후보 N건)`; 화면 dry-run 줄: `화면 검증(대상) 신규 N건, 라벨 갱신 0건, 이미 같은 증거 0건` + `건너뜀 0건`. 렌더·화면 dry-run 은 **적재(②) 뒤에** 의미가 있다(적재 전에는 DB 대상 0건으로 나온다).
- ⑤ 사후(읽기 전용, 멱등 확인): 적재 dry-run 은 **새 키 0**(이게 멱등 기준)이며 `기존 행 update N, payload 갱신 건너뜀 N` 은 상태 필드 재기록·jsonb 키 순서 차이로 나오는 정상 값이다(검증된 행의 payload·검증 필드는 건드리지 않는다, `lib/ap-generation/import-merge.ts`). 렌더·화면 dry-run 은 `이미 검증됨 N건` / `이미 같은 증거 N건` · 신규 0.

예: `graph-s1-items` 적재 dry-run(예행 연습 출력과 같은 형식, 대상 줄만 다르다):
```
재고 행 37건 { auto_passed: 29, rejected: 8 }
대상: worpsqwqgnspddnrtnvq.supabase.co / dry-run
병합 계획: 새 키 insert 37, 기존 행 update 0, 변경 없음 0, 검증·변환 보존만 0
dry-run: 이력 37행, 실제 쓰기 없음(--execute 로 위 계획 적용)
```
렌더/화면 dry-run(적재 후): `렌더 검증 대상 29건, 건너뜀 0건, 이미 검증됨 0건 (후보 29건)` / `화면 검증(대상) 신규 29건, 라벨 갱신 0건, 이미 같은 증거 0건` + `건너뜀 0건`. 선택 목록 줄: `선택 목록 29건 중 DB 대상 29건`(반려 8행은 목록에 없다).

## 파일마다 순서 (각각 dry-run → 건수 확인 → `--execute`)
1. 적재 dry-run: `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/<파일>.json --batch <배치 이름> --supplement --report` — 위 표 ① 과 같아야 한다. **갱신 > 0 이거나 새 키가 행 수와 다르면 중단.**
2. 적재: `--report` 를 `--execute` 로 바꿔 실행 → 출력 `적재 완료: insert <행 수>, update 0`.
3. 렌더 검증: `npx tsx scripts/ap-generation/mark-verified.ts --render --report data/ap/render-check/report.json --keys-file data/ap/stock/<통과 키 파일> $T`(dry-run, 표 ③) → 같은 명령 끝에 `--execute`(출력 `렌더 검증 기록 N건, 건너뜀 0건, 이미 검증됨 0건`).
4. 화면 검증: `npx tsx scripts/ap-generation/mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-graph-s1s3.json --keys-file data/ap/stock/<통과 키 파일> $T`(dry-run, 표 ④) → `--execute`(출력 `화면 검증(기록) 신규 N건`). 증거 파일은 10개 배치 모두 같다(키 목록이 대상을 정한다).
5. 사후 확인(읽기 전용): 1·3·4 를 `--execute` 없이 다시 실행(표 ⑤).
- 10개 배치를 한 번에 돌리고 싶으면 셸 반복문으로 같은 명령을 배치 이름만 바꿔 반복하면 된다. 예행 연습 스크립트 `npx tsx scripts/ap-generation/graph-load-rehearsal.ts [--execute]` 가 위 표를 그대로 만든다(**로컬 격리 스택 전용**: 로컬 URL 이 아니거나 544xx 면 즉시 중단하므로 비프로덕션에는 쓰지 않는다).

## 추가 21건 — 화면 증거가 없던 기존 형제(선택, 자유 재고를 늘림)
`v1ab-final`·`v45ab-final` 배치의 기존 후보 21건(MC 15: `v1ab-final:…m01-k0..k3, m02-k2..k5, m03-k1/k3`, `v45ab-final:v4-ab:…m01-k0..k2, m02-k1/k3`; FRQ 6: `v45ab-final:v4-ab/v5-ab:…f0x-k*`)은 화면 증거가 저장소에 없어 지금까지 "검증된 재고"가 아니었다. 증거 `evidence-v1v45-siblings.json` 을 만들었고 21건 전부 통과다. 이 21건을 쓰면 5세트 부족이 MC 6·FRQ 3 → MC 2·FRQ 0 으로 줄어든다(`exact-assignment-report.md`). 키 목록 `data/ap/stock/v1v45-siblings-keys.json`.
- 이미 비프로덕션에 적재돼 있다고 가정(원래 배치 `ab-calc-mc-2026-10-09` 등): 적재 단계는 건너뛰고 `mark-verified.ts --render …`(이미 검증돼 있으면 `이미 검증됨 N건`)와 `mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-v1v45-siblings.json --keys-file data/ap/stock/v1v45-siblings-keys.json $T` 만 dry-run → `--execute`. 기대: 화면 `신규 21건, 라벨 갱신 0건`(증거가 없었으므로). 렌더가 아직이면 `렌더 검증 대상 ≤21건`.
- 예행 연습(로컬 격리 스택, 같은 파일들을 적재한 뒤): 렌더 기록 21·건너뜀 0, 화면 신규 21·건너뜀 0, 사후 dry-run `이미 같은 증거 21건`. 비프로덕션 실제 상태(이미 적재·검증 여부)는 에이전트가 읽을 수 없어 **오너 dry-run 출력이 기준**이다.

## 조립 가능 시점
위 10개 배치(+선택 21건) 적재·검증 기록 후 `exact-assignment-report.md` 의 BC#1·AB#2 선택(`data/ap/stock/exact-assign-bc1-ab2-strict.json`)이 선택기 조건(`screenVerified/renderOk`)을 실제로 만족한다. BC#1·AB#2 가 쓰는 검증 대기 항목은 16건(키 목록은 같은 문서 §2)이라 이 16건만 먼저 올려도 조립은 가능하다.

## 롤백
추가만 하는 적재라 롤백이 필요 없다. 잘못 올라간 경우 삭제하지 않고 해당 키를 현재 재고에서 내리는(`is_current=false`) 조치를 별도 승인 후 수행한다.

## 화면 증거를 다시 만들어야 할 때(격리 스택, 오너 또는 후속 세션)
`scripts/dev/isolated-stack.sh start ALTON_<이름>` → `.env.local` 에 **격리 스택 값**(API 545xx, DB `SUPABASE_TEST_DB_URL`=API 포트+1, 로컬 키)을 둔다 → `local-demo-seed.ts seed --keys-file <통과 키 파일> --practice-sets`(신규 `--practice-sets`: 공식 풀 레이아웃 대신 MC 20·FRQ 6 연습 세트로 쪼개 구성 게이트를 피함) → `npm run dev -- -p 3011` → `screen-evidence.ts --shots-dir … --out …` → `isolated-stack.sh stop`. 시드·증거 스크립트는 이제 `SUPABASE_TEST_DB_URL` 이 없거나 544xx(공유 스택)이거나 API 포트와 한 스택(API+1=DB)이 아니면 즉시 중단한다(2026-10-09 사고 재발 방지: 시드가 DB 기본값 54422 로 공유 스택에 후보 1건을 쓴 사고가 있었다 — `exact-assignment-report.md` §0).


---

## 추가 절차: 보강(supplement) 배치 8개 — 통과 49건(MC 39 + FRQ 10) (2026-10-09, 예행 연습 완료)

오너 승인(2026-10-09)으로 만든 부족분 보강이다. 위 10개 그래프 배치(+선택 21건)와 **독립**이라 순서는 자유지만, 5세트 조립(`exact-assignment-report.md` §4)에는 위 70건·21건과 이 49건이 모두 필요하다. 에이전트는 키를 취득할 수 없어 실행하지 않았고 **격리 스택에서 같은 명령 전부를 예행 연습**했다(표의 건수는 실측). 이 문서·채팅·로그에 키를 적지 않는다.

### 준비된 파일(에이전트가 만들어 커밋함)
| 파일 | 내용 |
|---|---|
| `data/ap/screen-evidence/evidence-supp.json` | 통과 49건의 화면 증거 — 390×844·1280×800 모두 98항목, `checker_kind=automated`, content-hash 결속, 점검 실패 0. 스크린샷 `docs/ap/screen-evidence/supp/` |
| `data/ap/render-check/report.json` | 렌더 보고서(재생성, 보강 포함): 보강 통과 49건 중 표 4건 pass, 나머지 not_applicable(그림 없음) |
| `data/ap/stock/supp-b*-items.json` | 배치별 재고(행) — 아래 표 |
| `data/ap/stock/supp-b*-pass-keys.json` | 배치별 통과 키 목록(JSON 배열), 합쳐 `supp-all-pass-keys.json`(49) |
| `data/ap/stock/supp-load-summary.json` | 배치별 행·통과 건수(`npx tsx scripts/ap-generation/supp-pass-keys.ts` 재현) |

### 배치 표와 단계별 기대 건수 (격리 스택 예행 연습 실측, 새 키만 insert)
| 재고 파일 | 배치 이름 | 행 | ① 적재 dry-run | ③ 렌더 기록 | ④ 화면 기록 | ⑤ 사후 |
|---|---|---|---|---|---|---|
| supp-b1-items | supp-b1-2026-10-09 | 14 (통과 10) | 새 키 14, 갱신 0 | 10 | 10 | 새 키 0 / 이미 10·10 |
| supp-b2ab-items | supp-b2ab-2026-10-09 | 6 (통과 3, FRQ) | 새 키 6, 갱신 0 | 3 | 3 | 새 키 0 / 이미 3·3 |
| supp-b2bc-items | supp-b2bc-2026-10-09 | 4 (통과 3, FRQ) | 새 키 4, 갱신 0 | 3 | 3 | 새 키 0 / 이미 3·3 |
| supp-b3ab-items | supp-b3ab-2026-10-09 | 14 (통과 11) | 새 키 14, 갱신 0 | 11 | 11 | 새 키 0 / 이미 11·11 |
| supp-b3bc-items | supp-b3bc-2026-10-09 | 9 (통과 9) | 새 키 9, 갱신 0 | 9 | 9 | 새 키 0 / 이미 9·9 |
| supp-b4ab-items | supp-b4ab-2026-10-09 | 11 (통과 9) | 새 키 11, 갱신 0 | 9 | 9 | 새 키 0 / 이미 9·9 |
| supp-b5bc-items | supp-b5bc-2026-10-09 | 3 (통과 1, FRQ) | 새 키 3, 갱신 0 | 1 | 1 | 새 키 0 / 이미 1·1 |
| supp-b6ab-items | supp-b6ab-2026-10-09 | 4 (통과 3, FRQ) | 새 키 4, 갱신 0 | 3 | 3 | 새 키 0 / 이미 3·3 |
| 합계 | | 65 | 새 키 65 | 49 | 49 | |
- `supp-b3fa-items.json`(2행, 통과 0: 기출 유사로 반려된 FRQ 이력)은 위 표에서 뺐다. 반려 이력까지 적재하려면 같은 명령으로 `새 키 2` 이며 검증 단계는 없다(선택).
- 명령은 위 10개 배치와 같다. **증거 파일만 `evidence-supp.json` 이고, 통과 키 파일은 배치마다 `supp-bN…-pass-keys.json`**:
  1. `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/<파일>.json --batch <배치 이름> --supplement --report` → 새 키가 표 ① 과 다르거나 갱신 > 0 이면 중단 → 같은 명령의 `--report` 를 `--execute` 로.
  2. `npx tsx scripts/ap-generation/mark-verified.ts --render --report data/ap/render-check/report.json --keys-file data/ap/stock/<통과 키 파일> $T`(dry-run, 표 ③) → `--execute`.
  3. `npx tsx scripts/ap-generation/mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-supp.json --keys-file data/ap/stock/<통과 키 파일> $T`(dry-run, 표 ④) → `--execute`.
  4. 사후 확인(읽기 전용): 1·2·3 을 `--execute` 없이 다시 — 새 키 0, `이미 검증됨 N`, `이미 같은 증거 N`.
- 8개를 한 번에: `npx tsx scripts/ap-generation/supp-load-rehearsal.ts [--execute]`(**로컬 격리 스택 전용** — 시작 전에 docker 로 API 가 격리 project(`ALTON_<이름>`)의 kong 인지 확인하고, 공유 ALTON·불일치면 쓰기 전에 종료하므로 비프로덕션에는 쓰지 않는다).

### 전체 실행 순서(권장)
1. 위 "배치 표"의 10개 그래프 배치(70건) → 2. 선택 21건(형제) → 3. 이 절의 보강 8개(49건) → 4. 조립 가능성 확인: `npx tsx scripts/ap-generation/exact-assign.ts --sets BC1,AB2,BC2,AB3,BC3 --strict-families --no-pending`(DB 검증된 항목만으로 계산했을 때 가상 문항이 0 이어야 한다. 3 단계까지 끝나면 `exact-assign-5sets-supp-strict.json` 과 같은 결과) — 단, 이 명령의 "검증 대기" 판정은 증거 파일 기준이라 오너 DB 에서 직접 확인하려면 `mark-verified.ts --screen` dry-run 의 "이미 같은 증거"가 전부 나오는지를 본다.
- BC#1·AB#2 만 먼저 필요하면 1 의 일부 16건(보강 불필요)으로 충분하다(`exact-assignment-report.md` §2). 5세트 전부는 보강 포함 59건(최소) 이상의 검증 대기 항목이 필요하다.
