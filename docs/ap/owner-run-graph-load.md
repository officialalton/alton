# 오너 실행 절차: 그래프·일반 신규 배치 10개 비프로덕션 적재·검증 기록 (2026-10-09)

`owner-run-bc-topup-load.md` 와 같은 방식이다. 에이전트는 서비스 키를 취득할 수 없어 이 단계는 **오너 본인 터미널**에서 실행한다. 이 문서·채팅·로그에 키를 적지 않는다. 대상은 공유 비프로덕션 `worpsqwqgnspddnrtnvq` 뿐이다(스크립트가 호스트가 다르면 `--execute` 를 거부).

## 준비 (같은 터미널 세션에서만)
1. `export NEXT_PUBLIC_SUPABASE_URL=<비프로덕션 프로젝트 URL>`, `read -s SUPABASE_SECRET_KEY` 입력 후 `export SUPABASE_SECRET_KEY`.
2. 모든 출력 첫 줄 `대상:` 이 `worpsqwqgnspddnrtnvq.supabase.co` 인지 매번 확인. 로컬이거나 다른 호스트면 즉시 중단.

## 배치 표 (재고 행 = 통과 + 반려 이력, 새 키만 insert, 갱신 0 이 정상)
| 재고 파일 | 배치 이름(제안) | 행 | 통과 키 파일 |
|---|---|---|---|
| graph-s1-items.json | graph-s1-ab-2026-10-09 | 37 (통과 29) | graph-s1-pass-keys.json |
| graph-s2a-items.json | graph-s2-ab-2026-10-09 | 6 (5) | graph-s2a-pass-keys.json |
| graph-s2b-items.json | graph-s2-bc-2026-10-09 | 6 (5) | graph-s2b-pass-keys.json |
| graph-s3a-items.json | graph-s3a-ab-2026-10-09 | 23 (17) | graph-s3a-pass-keys.json |
| graph-s3b-items.json | graph-s3a-bc-2026-10-09 | 3 (1) | graph-s3b-pass-keys.json |
| graph-s3c-items.json | graph-s3b-ab-2026-10-09 | 6 (5) | graph-s3c-pass-keys.json |
| graph-s3d-items.json | graph-s3b-bc-2026-10-09 | 3 (1) | graph-s3d-pass-keys.json |
| graph-s3e-items.json | graph-s3c-ab-2026-10-09 | 7 (5) | graph-s3e-pass-keys.json |
| graph-s3f-items.json | graph-s3c-bc-2026-10-09 | 4 (1, FRQ 1 반려) | graph-s3f-pass-keys.json |
| graph-s3g-items.json | graph-s3d-bc-2026-10-09 | 1 (1, FRQ) | graph-s3g-pass-keys.json |
(파일은 모두 `data/ap/stock/`. 합계 96행, 통과 70.)

## 파일마다 순서 (각각 dry-run → 건수 확인 → `--execute`)
1. 적재 dry-run: `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/<파일> --batch <배치 이름> --supplement --report` — 기대: **새 키 = 행 수, 갱신 0, 보존 0**. 갱신 > 0 이면 중단.
2. 적재: `--report` 를 `--execute` 로 바꿔 실행(`--target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq` 는 `bc-topup` 절차와 같게 명시).
3. 렌더 검증: `npx tsx scripts/ap-generation/mark-verified.ts --render --report data/ap/render-check/report.json --keys-file data/ap/stock/<통과 키 파일> --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq` (dry-run 후 끝에 `--execute`). 렌더 보고서는 에이전트가 로컬에서 만들었다(신규 96건 그래프 76 pass, fail 0).
4. 화면 검증: 화면 증거 JSON 이 필요하다(아래). 증거가 있으면 `mark-verified.ts --screen --evidence <증거> --keys-file <통과 키 파일> …`.
5. 사후 확인(읽기 전용): 3·4 를 `--execute` 없이 다시 실행하면 이미 검증됨, 적재 dry-run 은 새 키 0 · 갱신 0(멱등).

## 화면 증거 만들기(격리 스택, 오너 또는 후속 세션)
`screen-evidence.ts` 머리 주석 순서: `scripts/dev/isolated-stack.sh start ALTON_<이름>` → 시드(`local-demo-seed.ts seed --keys-file <통과 키 파일>`) → 대상 DB 를 가리키는 dev 서버 → `screen-evidence.ts`. 공유 스택(544xx)은 어떤 경로로도 건드리지 않는다. **이번 세션에는 실행하지 않았다.**

## 롤백
추가만 하는 적재라 롤백이 필요 없다. 잘못 올라간 경우 삭제하지 않고 해당 키를 현재 재고에서 내리는(`is_current=false`) 조치를 별도 승인 후 수행한다.

## 조립 가능 시점
BC#1·AB#2 는 위 적재 + 렌더·화면 검증 기록 후 기존 선택기(`ab-select.ts`·`bc-feasibility.ts`)로 조립 가능(`graph-stages-report.md` §4).
