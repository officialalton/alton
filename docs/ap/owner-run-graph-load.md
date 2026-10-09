# 오너 실행 절차: 그래프·일반 신규 배치 10개 비프로덕션 적재·검증 기록 (2026-10-09, 예행 연습 완료)

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
