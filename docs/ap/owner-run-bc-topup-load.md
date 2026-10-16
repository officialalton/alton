# 오너 실행 절차: BC 보강(bc-topup-2026-10-09) 비프로덕션 적재·검증 기록 (2026-10-09)

에이전트는 비프로덕션 서비스 키를 취득할 수 없어(자동 분류기가 거부 — 우회 안 함) 이 단계는 **오너 본인 터미널**에서 실행한다. 이 문서·채팅·로그에 키를 적지 않는다.

## 변경 범위
- 대상: 공유 비프로덕션 `worpsqwqgnspddnrtnvq` (프로덕션·다른 프로젝트 아님. 스크립트가 호스트가 `worpsqwqgnspddnrtnvq.supabase.co` 또는 로컬이 아니면 `--execute` 를 거부한다).
- 쓰기: `ap_candidate_items` 에 **새 후보 키 18행 insert**(통과 16 + 반려 2, 이력 보존용), `ap_load_batches` 에 배치 `bc-topup-2026-10-09` 1행(보조 적재 `--supplement`: 배치 행 is_current=false, 후보 행 is_current=true). 그다음 통과 16건에 렌더·화면 검증 표식(`ap_set_verification` RPC) 기록.
- 하지 않는 것: `problems`/`problem_versions` 변경 없음(학생 비노출), 기존 행 갱신 0, 삭제 0, 게시·승격 아님.

## 준비 (오너 터미널, 저장소 루트 = 이 변경이 반영된 체크아웃)
1. 같은 터미널 세션에서만 환경변수를 설정한다(셸 히스토리에 남지 않게 값은 직접 붙여넣고, 키는 `read -s` 로 입력):
   - `export NEXT_PUBLIC_SUPABASE_URL=<비프로덕션 프로젝트 URL>`
   - `read -s SUPABASE_SECRET_KEY` 입력 후 `export SUPABASE_SECRET_KEY`
   - 스크립트는 `.env.local` 보다 이미 설정된 환경변수를 우선한다. `.env.local` 이 다른 대상을 가리키면 실행 첫 줄 `대상: …` 로 확인한다.
2. 출력의 `대상:` 이 `worpsqwqgnspddnrtnvq.supabase.co` 인지 매번 확인한다. `local` 이거나 다른 호스트면 즉시 중단.

## 실행 순서 (각각 dry-run → 결과 확인 → `--execute`)
1. 적재 dry-run: `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/bc-topup-items.json --batch bc-topup-2026-10-09 --supplement --report`
   - 기대: 재고 행 18건(auto_passed 16, rejected 2), **새 키 18 · 갱신 0 · 보존 0**. 갱신 > 0 이면 중단(기존 행에 닿는 것).
2. 적재 실행: 위 명령에서 `--report` 를 `--execute` 로 바꿔 실행. 기대: 새 키 18 적재.
3. 렌더 검증 dry-run: `npx tsx scripts/ap-generation/mark-verified.ts --render --report data/ap/render-check/report.json --keys-file data/ap/stock/bc-topup-pass-keys.json --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq`
   - 기대: 선택 목록 16건 중 DB 대상 16건, 렌더 검증 대상 최대 15(그림 필수 MC 15; FRQ 텍스트형은 대상 아님·건너뜀 사유 출력), 건너뜀 0~1.
   - 실행: 같은 명령 끝에 `--execute`.
4. 화면 검증 dry-run: `npx tsx scripts/ap-generation/mark-verified.ts --screen --evidence data/ap/screen-evidence/evidence-bc-topup.json --keys-file data/ap/stock/bc-topup-pass-keys.json --target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq`
   - 기대: 증거 32행(16키 × 2 뷰포트), **화면 검증 대상 16건**. 실행: 끝에 `--execute`.
5. 사후 확인(읽기 전용): 같은 환경변수로 3·4를 `--execute` 없이 다시 실행하면 "이미 검증됨 16건" 이어야 한다. 적재 dry-run 을 다시 돌리면 새 키 0 · 갱신 0(멱등).

## 롤백
- 별도 롤백이 필요 없는 additive 적재다(멱등 upsert, 기존 행 보존 규칙 `lib/ap-generation/import-merge.ts`). 잘못 적재된 경우에도 삭제하지 않고, 해당 18키 행을 현재 재고에서 내리는(`is_current=false`) 조치는 별도 승인 후 수행한다.
- 중간에 멈추면 그 지점부터 같은 명령을 다시 실행하면 된다(멱등).

## 앱 내 공식 승인 경로 확인
- 관리자 화면·서버 액션 중 `ap_candidate_items`/`ap_load_batches` 를 읽거나 쓰는 것은 **없다**(검색 결과: 마이그레이션 `…394_ap_load_batches.sql`·`…403_ap_defect_flags.sql` 과 `scripts/ap-generation/*` 에만 존재). 비프로덕션 적재·검증 기록의 공식 경로는 이 스크립트(서비스 키)뿐이다. 승인(게시·승격)은 이 적재 뒤 별도 단계이며 이번 절차의 범위가 아니다.
- 정리: 오너가 환경변수 입력 후 위 5단계를 실행하고 `대상:` 줄과 각 기대 건수가 맞는지만 알려주면 에이전트가 문서 상태표를 갱신한다(키·URL 은 전달하지 않는다).
