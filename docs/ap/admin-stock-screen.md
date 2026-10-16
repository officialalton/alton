# 관리자 'AP 재고 관리' 화면 (2026-10-12 오너 승인)

터미널에서 서비스 키로 돌리던 AP 재고 스크립트(`check-load`·`import-candidates`·`mark-verified`·`publish-to-bank`·`assemble-ap-set`·`assembly-keys verify`)를 관리자 화면 `/admin?tab=mock-exam` → **AP 재고 관리** 서브탭으로 옮겼다. 키를 사용자가 입력하는 경로는 없다(앱 서버의 기존 `createAdminClient()`).

## 1장 정리
1. **흐름**: 관리자 → Mock Exams → AP 재고 관리. ① 대상 프로젝트 확인 → ② 적재 점검(읽기) → ③ 배치 선택 → 적재 / 렌더 기록 / 화면 기록 / 문제은행 변환 각각 **미리보기 → "확인했습니다" 체크 → 실행** → ④ 배정 보고서의 세트를 검증해 **초안 세트로 저장**. 실패·취소: 미리보기 이후 DB 상태가 바뀌면(계획 해시 불일치) 실행을 거부하고 미리보기를 다시 요구. 모든 단계 멱등(재실행해도 새 변경 0).
2. **데이터·권한**: 서버 액션 전부 `requireAdmin()`(별도 capability 없음 — 기존 모의고사 탭과 동일 등급, `admin-action-auth-guard.test.ts` 가 가드 누락을 자동 검사). 쓰기는 INSERT 또는 검증 표식·변환 RPC 뿐이며 게시 세트·응시·답안·결과는 읽지도 쓰지도 않는다(초안 저장 전 겹침 확인용으로 비보관 AP 풀 세트의 문항 id 만 읽음). 새 테이블 `ap_stock_admin_runs`(append-only 감사 로그), 새 함수 `ap_admin_create_draft_set`(원자적 초안 저장, 이름·풀 세트 간 문항 중복을 DB 에서 한 번 더 거부).
3. **UAT 데이터**: 실제 재고 키로 UAT 하지 않는다. 자동 테스트는 실행 ID(`adm…`) 전용 과목·후보·세트만 만들고 실행 ID 단위로 정리(`ap-admin-draft-set.integration.test.ts`, 격리 스택). Preview UAT 는 비프로덕션 프로젝트에서 dry-run 중심, 실행은 오너 승인 뒤.
4. **UI**: 상태 — 로딩("불러오는 중..."), 빈(작업 이력 없음·배치 없음·배정 보고서 없음), 오류(빨간 문구·`role=alert`), 쓰기 차단(사유 표시, 실행 버튼 비활성). 표는 가로 스크롤, 버튼 높이 36px 이상, 전부 네이티브 button/select/checkbox(키보드 이동·Enter/Space).
5. **검증·성능**: 단위(env 가드·계획 해시·점검 계산·검증 판정·적재 병합·초안 검증·쓰기 가드)·컴포넌트 테스트, DB 통합 테스트(격리 스택). 쿼리 수: 화면 열 때 2~3회(감사 로그 30건 + 이름 조회), 점검 ≈ ⌈DB행/1000⌉회(약 2~3), 적재 = 과목 1 + 후보 ⌈N/150⌉, 검증 기록 = ⌈키/100⌉ + RPC N건(10개씩 병렬), 초안 저장 = ⌈48/100⌉ + 세트 2 + 문항 1 + 키 매핑 ⌈N/150⌉ + RPC 1. 클라이언트 추가 요청 없음(버튼 누를 때만).

## 기능 ↔ 스크립트 (공유 lib, 스크립트는 그대로 동작)
| 화면 | 스크립트 | 공유 코드 |
|---|---|---|
| 적재 점검 | `check-load.ts` | `lib/ap-admin/load-check.ts` |
| ① 후보 적재 | `import-candidates.ts` | `lib/ap-admin/import-plan.ts` (+ `lib/ap-generation/import-merge.ts`) |
| ②③ 렌더·화면 기록 | `mark-verified.ts` | `lib/ap-admin/verify-plan.ts` (+ `lib/ap-generation/verify-guard.ts`) |
| ④ 문제은행 변환 | `publish-to-bank.ts` | `lib/ap-exam/convert-run.ts`·`convert.ts` (원래 공용) |
| ⑤ 초안 세트 | `assemble-ap-set.ts --keys-file --draft`, `assembly-keys.ts verify` | `lib/ap-admin/assemble-draft.ts` + `verifyAssignment`(`scripts/ap-generation/exact-assign.ts`) |
| ⑤-b 부분 연습 세트 초안(겹침 0) | `partial-rebuild-plan.ts`(계획 계산) | `lib/ap-admin/partial-draft.ts`, 마이그레이션 520 — `docs/ap/partial-rebuild.md` |

## 입력 산출물 메커니즘 (Vercel)
- 저장소에 커밋된 산출물(`data/ap/stock/*.json`, `data/ap/render-check/report.json`, `data/ap/screen-evidence/*.json`, `data/ap/curriculum-2027/*.json`)을 **배포 번들에 포함**(`next.config.ts` `outputFileTracingIncludes["/admin"]`)해 서버가 파일로 읽는다. **업로드 경로는 만들지 않았다**(임의 파일로 DB 에 쓰는 통로 방지). 새 배치는 커밋 → 배포로만 들어온다. 배치 목록은 `lib/ap-admin/batches.ts` 의 레지스트리(owner-load.sh 와 동일 값).
- 스크린샷 PNG(약 49MB)는 번들에 넣지 않는다 → 화면 검증 기록에서 **스크린샷 파일 실존 검사만** 서버에서 끈다(`skipScreenshotFiles`, 스크립트 기본은 그대로 검사). 해시 일치·모바일(≤430)·데스크톱(≥1024) 전 항목 통과·결과/자료 영역 점검·점검자 이름 규칙은 동일. 렌더 보고서 해시와 화면 증거 해시는 현재 DB payload 해시(`itemContentHash`)와 같아야 하며 불일치는 건너뜀. 자동 점검 증거는 `checker_kind=automated`·한계 문구와 함께 기록된다(그래프 의미·문장 자연스러움은 사람 검토 별도). 관리자 화면은 사람(human) 증거를 만들지 않는다.

## 세트 배정 (ILP)
무거운 정수계획은 **서버에서 돌리지 않는다**(수 분, Vercel 제한). 저장소에 커밋된 배정 보고서(`data/ap/stock/exact-assign-*.json`)에서 세트를 고르면 서버가 배정기와 별개인 `verifyAssignment` 로 전 조건을 다시 확인한다: 공식 구성 MC 42(29+13)/FRQ 6(2+4), 구조 묶음(`structure-groups.json`) 기준 문항군 상한 1, 단원·스킬·계산기·그래프 하한, FRQ 서로 다른 유형, BC 전용 FRQ 2, 게시 AB#1 + DB 에 저장된 풀 세트와 동일 문항 0, 가상 문항 0, 모든 문항이 mock_exam 용도로 변환되고 렌더·화면 검증 완료. 통과해야만 `draft` 로 저장(공개 기능 없음). 이름 중복·같은 구성·겹침은 거부(덮어쓰기 없음). 새 배정은 로컬에서 `exact-assign.ts` 로 계산해 보고서를 커밋·배포한다.

## 환경 가드 (`lib/ap-admin/env-guard.ts`, verify-guard 규칙 이식)
- 화면 상단에 연결된 Supabase 프로젝트 ref 와 쓰기 허용 여부를 표시한다(키·URL 전체는 표시 안 함).
- 쓰기는 `AP_STOCK_ADMIN_ALLOWED_REFS`(쉼표 구분, 비프로덕션 ref 또는 `local`)에 있을 때만. **기본은 빈 목록 = 쓰기 전부 거부**. `AP_STOCK_ADMIN_BLOCKED_REFS` 는 허용 목록보다 우선(프로덕션 ref 를 넣어 두는 안전장치). `VERCEL_ENV=production` 배포는 허용 목록과 무관하게 쓰기 거부. 호스트가 정확히 `<ref>.supabase.co` 가 아니면(접미어 위조 포함) unknown → 거부. 프로덕션 변경은 이 화면이 아니라 별도 승인 절차.
- 실행은 미리보기와 같은 계획 해시(`lib/ap-admin/plan-hash.ts`)일 때만 하고, 감사 테이블에 쓸 수 없으면 쓰기를 시작하지 않는다.

## 시간 제한
`app/admin/page.tsx` 에 `maxDuration = 60`. 검증 기록·변환은 40초 예산 안에서만 진행하고 남으면 "남은 N건, 다시 실행"으로 알린다(멱등). 변환은 한 번에 최대 20건.

## 작업 이력
`ap_stock_admin_runs`(마이그레이션 490): 누가·언제·무엇을·대상 ref·dry-run/execute·건수·계획 해시·결과(ok/refused/error). 서버(service role)만 INSERT, 관리자 SELECT, UPDATE/DELETE 없음. 미리보기·점검·거부·오류도 기록한다.

## 출시 차단·검증 현황 패널 (2026-10-12, 읽기 전용)
적재 점검 아래의 `ApLaunchGatePanel`. 서버 액션 `apLaunchGateStatusAction`(`requireAdmin`, 쓰기·감사 기록 없음) → `lib/ap-admin/launch-gate.ts`.
- **표시**: 비보관 AP 세트(풀·부분, 초안 포함) 전부에 대해 세트별 문항 수·`ap_launch_ready_v` 통과 수·차단 결함(미해결 `ap_launch_blockers` + 미해결 `wrong_key`/`flawed_problem` 신고)·열린 오류 신고 수, **출시 게이트 판정**(문항 전부가 `ap_launch_ready_v` 에 있고 문항이 1개 이상이면 "통과 가능", 아니면 "차단 — 문항 N건 미충족"). 판정은 게이트 충족 여부일 뿐 launch 승격·공개는 하지 않는다. 세트마다 미충족 문항을 펼쳐 섹션·번호·후보 키·사유(검수 환경 미게시 / 자동 게이트 미통과 / 렌더·화면 검증 없음 / 생성기 결함 플래그 / 오답·문항 결함 신고 / launch 차단 결함 분류 / 후보 연결 없음 / 일반 신고는 "차단 아님"으로 표기)를 보여 준다. 상단 합계: 통과 가능 세트 수·미충족 문항·차단 결함·열린 신고·전체 대장 미해결 수.
- **쿼리(읽기 6회, 각 1000행 초과 시만 쪽 나눔)**: ① `mock_exam_sets`(AP·비보관) ② `mock_exam_set_items`(해당 세트) ③ `ap_candidate_problems` ④ `ap_item_review_status_v` ⑤ `ap_launch_ready_v` ⑥ `ap_launch_blockers`(resolved_at null). ③~⑥ 은 키 목록으로 쪼개지 않고 전체를 한 번에 읽어(수백 행) 요청 수를 일정하게 둔다. 클라이언트 추가 요청은 화면 진입·새로고침 때 액션 1회뿐. 준비 여부는 뷰 정의를 복제하지 않고 `ap_launch_ready_v` 포함 여부로 판정한다.
- **상태**: 로딩·빈("비보관 AP 세트가 없습니다.")·오류(`role=alert`)·세트별 접이식 목록(키보드 조작 가능), 표는 가로 스크롤.
- **테스트**: `lib/ap-admin/launch-gate.test.ts`(사유·판정·합계, 가짜 클라이언트로 읽기 전용·쿼리 6회 증명 — insert/update/upsert/delete/rpc 호출 시 실패), `ApLaunchGatePanel.test.tsx`, `admin-action-auth-guard.test.ts`(가드 누락 자동 검사).

## 배치 전체 적재 (2026-10-13)
'배치 작업' 맨 위 `ApLoadBatchPanel`("배치 전체 적재"). 기존 ①~④ 단계 카드는 그대로 두고, 같은 서버 함수·정책을 이어서 호출한다(새 정책 없음). 코드: `lib/ap-admin/load-batch.ts`(오케스트레이션), `load-batch-client.ts`(클라이언트 안전: 타입·순차 실행·현황 계산), 서버 액션 `apStockLoadBatchAction`·`apStockBatchStatusAction`(둘 다 `requireAdmin`).
- **흐름**: 배치 다중 선택(또는 "아직 안 끝난 배치 모두 선택") → **미리보기**(배치마다 단계별 dry-run, 쓰기 0, 결과는 단계별 건수) → "확인했습니다" 체크 → **실행**. 화면이 배치를 순서대로 한 번에 하나씩 서버에 호출(서버 시간 제한 때문)하고 배치마다 결과를 즉시 표시, 끝나면 요약.
- **가드(약화 없음)**: 쓰기 허용 목록(`AP_STOCK_ADMIN_ALLOWED_REFS`) 밖이면 어떤 단계도 호출하지 않고 거부. 실행은 미리보기 해시(단계별 dry-run 해시 합)가 현재 계획과 같을 때만 시작. 각 단계는 직전에 dry-run 을 다시 계산·검증하고 **그 해시로** execute 하므로 기존 `runImport/runVerify/runConvert` 의 해시·가드가 그대로 적용되며, 단계마다 기존 `guarded` 래퍼가 `ap_stock_admin_runs` 에 미리보기·실행 모두 기록한다(배치 전체 적재 전용 새 로그 없음).
- **멈춤 조건(단일 단계보다 엄격)**: 단계 `blocked`/오류/예외, ① 건너뛴 payload·상태 충돌·검증된 행 승급, ②③ 건너뜀 ≥1, ④ 변환 불가 ≥1·검증 안 끝난 후보 ≥1·DB 에 없는 키 ≥1, 변환 중 건너뜀 ≥1, 감사 기록 실패 경고. 멈추면 이후 단계·배치를 시작하지 않고 "멈춘 위치(배치/단계)와 사유"를 표시한다.
- **건너뜀 허용(opt-in, 2026-10-14)**: 패널의 "증거 없는 행은 건너뛰고 나머지만 적재" 체크(기본 꺼짐 = 위의 엄격 모드 그대로). 실제 사례: 파일럿 배치 bio-p1a 통과 20키 중 5키가 조립 시험에 쓰이지 않아 화면 증거가 없다 — 엄격 모드는 ③ 에서 멈춘다.
  - **허용되는 건너뜀만**: ②③ 의 "화면 증거 항목 없음"·"해시 불일치"·"렌더 보고서 없음"(+ 그 연쇄인 ③ "렌더 검증이 먼저입니다", 단 ② 에서 건너뛴 키일 때만) 과 ④ 의 "검증 미완료(notReviewReady)". 판정은 서버 단계 결과의 구조화 목록(`skips`/`notReady`)으로 하며 목록이 건수와 다르면 멈춘다. 그 외(결함 플래그·렌더 게이트 실패·증거 검증 실패, ① payload 건너뜀·충돌·승급, ④ 변환 불가·DB 누락 키·변환 중 건너뜀, blocked·오류·가드·감사 기록 실패·반복 상한)는 엄격 모드와 똑같이 멈춘다.
  - **건너뛴 행은 절대 기록·변환·검증 표시되지 않는다**(단계 함수가 원래 하던 대로 미검증 후보로 남음, 새 쓰기 경로 없음).
  - **미리보기**: 단계×종류별 건수 + 펼치면 정확한 키·사유. 확인 체크 문구에 건너뛸 건수가 들어간다. ② 기록 전 후보의 화면 증거 여부는 ② 실행 뒤에야 확정되므로(미리보기는 쓰기 0) 실행 시점 목록이 다르면 미리보기 해시가 달라져 중단된다(해시에 허용 여부와 건너뛸 키 목록 포함, 엄격 해시와 호환 안 됨).
  - **감사**: 허용 모드 단계 호출은 `ap_stock_admin_runs.scope.skipTolerant=true` 로 기록되고 건너뜀 건수는 기존 `counts`(skipped·notReviewReady)에 남는다.
  - **실행 후 "남은 것"**: 배치별로 통과했지만 변환되지 않은 키와 사유(+ 요약 문장에 배치별 건너뛴 키). 가드·④ 20건 청크·반복 상한·멱등은 동일.
  - 테스트: `lib/ap-admin/load-batch-skip.test.ts`(엄격 기본 불변, 허용 5건 건너뛰고 나머지 변환, 비허용 종류 중단, 변환 불가·DB 누락 중단, 가드·해시 거부, 상한·멱등).
- **반복**: ④ 는 변환 대상이 0 이 될 때까지 20건씩 반복(각 회차 dry-run→실행), 검증 단계의 시간 제한 잔여분도 같은 방식. 단계당 하드 상한 60회, 초과 시 오류로 중단. 할 일이 없는 단계는 실행 없이 통과(멱등 — 끝난 배치를 다시 돌리면 쓰기 0).
- **현황 표**: 배치별 통과 키·적재·렌더·화면·변환 수와 완료/작업 필요(기존 점검 로직 `computeLoadCheck` 와 같은 정의 + `problem_id` 있는 후보 수). 쿼리 ≈ ⌈DB행/1000⌉ + ⌈변환행/1000⌉, 화면 열 때 1회·"현황 새로고침"·실행 후.
- **성능**: 실행 1배치 ≈ 사전 확인 dry-run 3~4회 + 단계별 (dry-run + execute) 반복. 미리보기도 배치 수만큼 서버 호출.
- **테스트**: `lib/ap-admin/load-batch.test.ts`(가짜 서비스: 건너뜀 중단, 20건 청크 반복, 상한, 오류 중단, 가드 거부(호출 0), 해시 불일치·누락 거부, 멱등, 단계 호출=감사 기록, 순차 실행 중단, 현황 계산).

## 아직 하지 않은 것
- 격리 스택 DB 통합 테스트 실행(작성만, 다른 세션의 격리 스택과 포트 충돌로 미실행 — 아래 보고 참고), Preview UAT, 마이그레이션 490·491 원격 적용.
- 서버 ILP 실행, 파일 업로드, 게시(공개) 기능, lesson 용도 변환, 프로덕션 지원.
