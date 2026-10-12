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

## 아직 하지 않은 것
- 격리 스택 DB 통합 테스트 실행(작성만, 다른 세션의 격리 스택과 포트 충돌로 미실행 — 아래 보고 참고), Preview UAT, 마이그레이션 490·491 원격 적용.
- 서버 ILP 실행, 파일 업로드, 게시(공개) 기능, lesson 용도 변환, 프로덕션 지원.
