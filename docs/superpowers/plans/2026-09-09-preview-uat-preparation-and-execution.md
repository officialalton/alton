# Preview UAT 준비 및 실행 계획

**작성일**: 2026-09-09
**성격**: 계획 문서 — 이 라운드는 실행 계획 작성까지만 한다. **non-prod migration 반영,
Preview 배포, UAT 계정·세션 생성은 이 계획을 검토한 뒤 제품 오너가 각각 별도로
승인해야 시작한다.** 이번 문서 작성 라운드 자체는 코드/마이그레이션/설정을
변경하지 않았다.

## 0. 이번 라운드의 범위와 금지 사항

**범위**: 아래 1~7절의 계획 수립만. 승인 후 실행 단계에서도 범위는 "Preview UAT
준비 및 실행"으로 한정한다.

**이번 범위에 포함하지 않는 것** (제품 오너 명시):
- 다른 포털 성능 개선, 캐싱, 탭별 지연 로딩
- 레거시/v3 정리, 공용 헬퍼 리팩터링
- 새 기능 개발
- 아래 3가지 미결 항목의 변경 — **UAT blocker로 취급하지 않고 보류 항목으로만
  기록한다**(6절 참고):
  1. `app/admin/page.tsx`가 다른 모든 포털처럼 미들웨어 역할 게이트에만 의존하는 구조
  2. 미사용 RPC 3종(`apply_makeup_time`, `adjust_entitlement`,
     `retry_direct_onboarding_student_entitlement`) 삭제 여부
  3. `trial_lesson_review` RPC 계열 존치·삭제·연결 여부

**절대 금지(계속 유지)**: 실제 고객 발송(이메일/알림), 실제 결제·송금, Production
반영, `main` 병합, `git push`. non-prod migration 반영·Preview 배포·UAT 계정
생성·UAT 세션 생성은 **이 보고를 검토한 뒤 제품 오너가 각각 개별 승인**해야
시작한다 — 계획 문서 작성만으로는 어떤 것도 자동 진행하지 않는다.

## 1. Non-prod migration 목록과 Preview 배포 대상

### 반영 완료(2026-09-09) — 이 절은 이제 실행 기록이다

**30개 전부 non-prod에 반영 완료.** `supabase migration list --linked` 원문
기준: 반영 전 로컬 173개 중 **143개가 이미 적용돼 있었고(마지막 적용분
`20261227000000`), 30개(`20261228000000`~`20261264000000`)가 미반영**이었다
(143+30=173). 아래 두 숫자를 구분해 기록해 둔다:

- **이번 세션에서 로컬에 새로 추가된 migration**: 3개
  (`20261262000000`/`20261263000000`/`20261264000000` — 기반 안정화 7단계
  승인 이후 작성됨).
- **non-prod에 실제로 미반영이었던 migration**: 30개(위 3개 포함, 나머지
  27개는 그 이전 라운드부터 이미 로컬에 존재했으나 non-prod에는 한 번도
  반영되지 않았던 것).

**복원용 스냅샷**: 반영 직전 `supabase db dump --linked`로 schema
덤프(824KB, `public`+`auth`)와 data 덤프(205KB, `--data-only --use-copy`)를
생성했다. **두 파일 모두 이 저장소 밖 세션 scratchpad에 있고 Git 추적 대상이
아니다.** 데이터 삭제·정리·변환은 하지 않았다.

**반영 실행**: `supabase db push --linked`로 30개(`20261228000000`~
`20261264000000`) 전부를 dry-run에서 확인한 순서 그대로, 도메인 분할 없이
한 번에 반영 — **전부 오류 없이 성공**.

**반영 후 검증**: `supabase migration list --linked` 재조회 →
**173/173 local=remote 완전 일치**(mismatch 0건). 반영 후 스키마 재덤프로
구조 확인 — 신규 테이블 7개(`student_curriculum_overlays`,
`session_prepared_selections`, `session_content_manifest`,
`session_content_use_events`, `session_homework_items`,
`status_transition_tokens`, `session_invariant_unlock_tokens`) 전부 존재 +
RLS 활성화, 핵심 함수 5개(`reverse_payout_item`, `generate_payout_batches`,
`reopen_session`, `ensure_active_curriculum_overlay`,
`pin_session_selection`) 전부 존재/재정의 확인,
`payout_items_reversed_from_item_id_key` 부분 유니크 인덱스 존재 확인,
`session_incident_reports` INSERT 정책이 정확히 `reported_by = auth.uid()
AND (...)`로 반영됨을 실제 정책 텍스트로 확인. **`payout_disbursement_gate.
real_disbursement_enabled = false`**(읽기 전용 확인, `enabled_at`/
`enabled_by`/`note` 전부 NULL — 이번 배치가 이 테이블 데이터를 변경하지
않으므로 그대로 안전).

**실패 없음** — 롤백·migration repair 불필요. 계정 생성, 상담·예약 생성,
이메일 발송, 지급 상태 변경은 전혀 하지 않았다. **실제 고객 발송, 실제
결제·송금, Production 반영, `main` 병합, `git push`는 전혀 없었다.**

아래 표(반영 전 작성한 도메인별 영향 분석)는 그대로 남겨 이번 반영이 어떤
근거로 승인됐는지 기록해 둔다.

### 30개 미반영 migration — 도메인별 목록과 영향

| # | 파일 | 도메인 | 변경 종류 | 기존 non-prod 데이터에 미칠 영향 | 롤백 불가 여부 |
|---|---|---|---|---|---|
| 1 | `20261228000000_r9_curriculum_content_foundation.sql` | R9 커리큘럼·콘텐츠 | 신규 테이블 4개(과목 키워드 카탈로그 등) + RLS | 없음(신규 기능, 기존 테이블 미변경) | 아니오 |
| 2 | `20261229000000_r9_student_curriculum_overlay.sql` | R9 커리큘럼·콘텐츠 | 신규 테이블 4개(학생 커리큘럼 오버레이) + RLS | 없음(신규 테이블) | 아니오 |
| 3 | `20261230000000_r9_corrective_overlay_baseline_seed.sql` | R9 커리큘럼·콘텐츠 | 함수 재정의(`ensure_active_curriculum_overlay`, 위 #2 테이블 대상) | 없음 — 이 함수가 다루는 테이블 자체가 #2에서 이번에 처음 생기므로 기존 행이 있을 수 없음 | 아니오 |
| 4 | `20261230010000_r9_corrective_keyword_publish_gate.sql` | R9 커리큘럼·콘텐츠 | `drop function if exists` 2건(이번 배치에서 새로 만든 함수 정리) + 함수 재정의 | 없음(대상 함수도 이번 배치 산물) | 아니오 |
| 5 | `20261231000000_r9_corrective_overlay_baseline_materials.sql` | R9 커리큘럼·콘텐츠 | 함수 재정의(베이스라인 시딩에 발행된 교재까지 포함) | 없음(#3과 동일 이유) | 아니오 |
| 6 | `20261232000000_r9_session_prepared_selection.sql` | 세션·과제 | 신규 테이블 4개(수업 준비 스테이징) + RLS | 없음(신규 테이블) | 아니오 |
| 7 | `20261233000000_r9_session_content_manifest.sql` | 세션·과제 | 신규 테이블 1개(`session_content_manifest`) + RLS + **기존 정책 교체**(`session_prepared_selections`의 쓰기 정책, #6에서 이번에 신설된 테이블) | 없음 — 교체 대상 정책도 이번 배치에서 신설된 테이블의 것 | 아니오 |
| 8 | `20261234000000_r9_session_content_use_events.sql` | 세션·과제 | 신규 테이블 1개(`session_content_use_events`, append-only) + RLS | 없음 | 아니오 |
| 9 | `20261235000000_r9_homework_composition.sql` | 세션·과제 | 신규 테이블 1개(`session_homework_items`) + RLS | 없음 | 아니오 |
| 10 | `20261236000000_r9_corrective_remove_pin_lock_bypass.sql` | 세션·과제 | 함수 재정의(GUC bypass 제거, #6/#7 테이블 대상) | 없음 | 아니오 |
| 11 | `20261237000000_r9_corrective_content_item_unit_provenance.sql` | 세션·과제 | 컬럼 추가 + **즉시 실행되는 백필 UPDATE 3건**(`session_prepared_selection_content_items`) + `NOT NULL` 잠금 | **이 파일 자체 주석이 "로컬 dev reset 흐름에서만 실행 가정, 운영 데이터 없음"이라고 명시** — 그러나 대상 테이블은 #6에서 이번 배치에 처음 생기므로 non-prod에 이 30개를 순서대로 한 번에 반영하는 한 실제로 빈 테이블에 대한 백필이라 안전하다. **주의**: 이 파일만 따로/나중에 재실행하거나 #6 반영 후 실제 사용자가 데이터를 쌓은 뒤 이 파일을 반영하면 위험해진다(3번째 UPDATE는 못 채운 행을 "그 선택의 첫 단원"으로 임의 귀속시킴) | 데이터가 있는 상태에서 실행했다면 사실상 예 — 이번엔 빈 테이블이라 실질적 위험 없음 |
| 12 | `20261238000000_r9_corrective_content_item_unit_update_guard.sql` | 세션·과제 | 트리거/함수 추가(수정 가드) | 없음 | 아니오 |
| 13 | `20261239000000_r8_corrective_remove_annotation_lock_bypass.sql` | 세션·과제 | 함수 재정의(GUC bypass 제거, `session_annotation_events` — **기존에 이미 non-prod에 있는 테이블**, R8에서 생성됨) | 낮음 — bypass 분기를 토큰 방식으로 교체하는 것뿐, 기존 정상 append 행에는 영향 없음. 다만 이 테이블은 실제 non-prod 데이터가 있을 수 있는 첫 파일이므로 반영 직후 기존 필기 이벤트 조회로 확인 권장 | 아니오 |
| 14 | `20261240000000_r9_corrective_student_homework_access.sql` | 세션·과제 | RLS 정책 신설(#9 테이블 대상, 학생 접근 추가) | 없음(신규 테이블 대상) | 아니오 |
| 15 | `20261245000000_r9_teacher_homework_answer_view.sql` | 세션·과제 | RLS 정책 신설(#9 테이블 대상) | 없음 | 아니오 |
| 16 | `20261250000000_r9_corrective_atomic_compose_homework.sql` | 세션·과제 | 함수 재정의(원자성 보강) | 없음 | 아니오 |
| 17 | `20261251000000_r_status_transition_tokens.sql` | GUC 보안 정리 | 신규 공유 테이블 `status_transition_tokens`(RLS 활성화, 정책 0개, 전 권한 revoke) | 없음(신규 테이블) | 아니오 |
| 18 | `20261252000000_r2_corrective_consent_protect_token.sql` | GUC 보안 정리 | 함수 재정의(`bypass_consent_protect` 제거, 기존 동의 관련 함수 3개 대상 — **기존에 이미 non-prod에 있는 함수/테이블**) | 낮음 — GUC 우회 분기 제거는 정상 호출 경로(앱 서버 액션)에는 영향 없음, 오직 `SET app.bypass_consent_protect` 직접 호출 경로만 막힘(애초에 앱 코드가 쓰지 않던 경로) | 아니오 |
| 19 | `20261253000000_r1_corrective_teacher_rate_protect_token.sql` | GUC 보안 정리 | 함수 재정의(`bypass_teacher_rate_protect` 제거) | #18과 동일 성격, 낮음 | 아니오 |
| 20 | `20261254000000_m5d_corrective_trial_auto_complete_condition.sql` | GUC 보안 정리 | 함수 재정의(GUC 대신 결과-조건 재확인 방식) | 낮음 | 아니오 |
| 21 | `20261255000000_r_corrective_status_transition_tokens_search_path.sql` | GUC 보안 정리 | 함수 재정의(`search_path` 명시, `#17` 테이블 스키마 한정 참조로 수정 — temp-table hijack 방지) | 없음(보안 강화, 정상 경로 동작 동일) | 아니오 |
| 22 | `20261256000000_r2_corrective_status_protect_token.sql` | GUC 보안 정리 | 함수 재정의(`bypass_status_protect` 제거, `merge_accounts` 등 — **기존 계정 상태 전이에 실사용 함수**) | 낮음~중간 — 정상 호출 경로는 동일하게 동작하나, 계정 병합·상태 전이처럼 민감한 함수라 반영 직후 admin 포털에서 계정 상태 변경 1건 정도로 정상 동작 확인 권장 | 아니오 |
| 23 | `20261257000000_r2_corrective_status_transition_row_lock.sql` | GUC 보안 정리 | 함수 재정의(`FOR UPDATE` 잠금 추가) | 없음(동시성 강화, 단일 호출 동작 동일) | 아니오 |
| 24 | `20261258000000_r2_corrective_invite_protect_token.sql` | GUC 보안 정리 | 함수 재정의(초대 관련 5개 함수) | 낮음, #18과 동일 성격 | 아니오 |
| 25 | `20261259000000_r2_corrective_reconciliation_task_lock_token.sql` | GUC 보안 정리 | 함수 재정의(대사 작업 관련 4개 함수 — **기존 미해결 대사 작업이 non-prod에 남아있을 수 있음**) | 중간 — 반영 시점에 이미 `pending`/`needs_review` 상태인 대사 작업이 있다면, 그 다음 처리(승인/반려)부터 새 토큰 방식을 타게 된다. 처리 자체의 정상 동작은 로컬에서 이미 충분히 검증됨(기반 안정화 세션) | 아니오 |
| 26 | `20261260000000_r2_corrective_reconciliation_lock_order.sql` | GUC 보안 정리 | 함수 재정의(잠금 순서 통일, 데드락 방지) | 없음 | 아니오 |
| 27 | `20261261000000_r8_corrective_session_invariant_tokens.sql` | GUC 보안 정리 | 신규 테이블 `session_invariant_unlock_tokens` + 함수 재정의(`reopen_session` 등 — **기존 `sessions` 테이블의 실사용 함수**) | 낮음~중간 — 정상 재개방 경로는 동일 동작, non-prod에 이미 완료/재개방 이력이 있는 세션이 있다면 그 세션들 자체는 변경 없음(과거 이력 데이터 아님, 함수 로직만 교체) | 아니오 |
| 28 | `20261262000000_r10_corrective_reversal_idempotency.sql` | 정산 corrective | 컬럼 추가(`payout_items.reversed_from_item_id`) + 부분 유니크 제약 + 함수 재정의(`reverse_payout_item`) | **이번 세션 신규**. 낮음 — 신규 컬럼은 nullable, 기존 `payout_items` 행은 전부 `NULL`로 시작(기존 역분개 없음으로 해석). non-prod에 이미 수동으로 처리된 역분개 항목이 있다면 그 항목들은 이 컬럼이 채워지지 않은 채로 남는다(소급 연결 안 됨) — 반영 후 기존 역분개 건이 있었는지 1회 확인 권장 | 아니오 |
| 29 | `20261263000000_r10_corrective_generate_payout_batches_lock.sql` | 정산 corrective | 함수 재정의(`generate_payout_batches`, `FOR UPDATE SKIP LOCKED` 추가) | **이번 세션 신규**. 없음(동시성 강화, 단일 호출 동작 동일) | 아니오 |
| 30 | `20261264000000_r6_corrective_incident_report_reported_by_identity.sql` | 신고자 신원 corrective | **기존 정책 교체**(`session_incident_reports`의 INSERT 정책 — 이 테이블은 R6에서부터 이미 non-prod에 있었음) | **이번 세션 신규. 이 30개 중 유일하게 "이미 non-prod에 실재하던 테이블"의 RLS를 교체하는 항목** — 반영 직후 `reported_by`가 `NULL`이거나 세션 관련자 본인이 아닌 기존 행이 있다면(이번 세션에서 발견한 원 버그상 애초에 `reported_by` 자체가 항상 비어 인서트가 실패했으므로 실재 행이 있을 가능성은 낮음, 그러나 확인 필요) 새 정책 자체는 INSERT에만 영향(기존 SELECT 정책은 미변경)이라 과거 행 조회에는 영향 없음 | 아니오(정책 자체는 되돌리기 쉬움 — 다만 위조 방지가 사라진 상태로 되돌아감을 의미하므로 보안상 되돌리지 않는 것을 권장) |

**전체 요약**: 30개 중 `DROP TABLE`/`TRUNCATE`/컬럼 삭제/타입 변경은 **0건** —
전부 신규 테이블·컬럼 추가·함수(RLS 포함) 재정의뿐이다. 데이터 손실 위험이
있는 항목은 없다. "기존에 이미 non-prod에 존재하는 객체"를 건드리는 항목은
#13, #18~#27(GUC 보안 정리 대다수), #30뿐이며, 전부 "정상 호출 경로 동작은
동일, 우회 경로만 차단/토큰화"하는 성격이라 실제 데이터에 미치는 영향은
낮다. **#11과 #30이 이번 검토에서 가장 주의 깊게 봐야 할 항목**(각각 위 표에
근거 기재).

### 2단계(dry-run·의존성 검토) 결과 — 실제 반영 없음

`supabase db push --linked --dry-run`(non-prod 대상, **쓰기 없음**)을 실행해
확인:
- 30개 파일 전부가 "반영 대상"으로 정확히 식별됨(local=remote 기준 정확히
  일치, 위 목록과 동일) — dry-run 자체는 SQL을 실행하지 않으므로 실행 중
  실패 여부까지는 알려주지 않는다.
- 정적 검토(각 파일 grep)로 확인: **최상위(함수 본문 밖) `UPDATE`/`DELETE`/
  `INSERT`는 #11(`20261237000000`) 3건뿐** — 나머지 datawrite처럼 보이는
  구문은 전부 `create or replace function ... $$ ... $$` 본문 안에 있어 이
  마이그레이션 적용 시점이 아니라 그 함수가 나중에 호출될 때만 실행된다.
- **도메인 경계가 타임스탬프로 깔끔히 분리돼 있다**: R9 커리큘럼·세션·과제
  (`20261228~20261250`) → GUC 보안 정리(`20261251~20261261`) → 정산·신고자
  corrective(`20261262~20261264`) 순서로 겹침이 없다. 즉 **도메인별로 나눠
  반영해도 뒤 도메인이 앞 도메인의 대상을 참조하는 구조라 순서를 지키는 한
  실패할 이유가 없다** — 다만 각 도메인 안에서는 파일 순서를 반드시 지켜야
  한다(예: `20261232000000`이 먼저 있어야 `20261233000000`이 참조하는
  테이블이 존재).

**중단 가능성이 있는 migration**: 없음으로 판단(정적 검토 기준) — 전부 `if
exists`/`if not exists`/`create or replace` 패턴을 쓰거나 이번 배치 내에서
새로 만든 객체만 참조한다. 단, dry-run은 실제 실행이 아니므로 이 판단은
**정적 분석 기준의 예상**이며 100% 보장은 아니다.

**기존 데이터 조건이 필요한 migration**: **#11
(`20261237000000_r9_corrective_content_item_unit_provenance.sql`)** 하나 —
위 표 설명대로, 대상 테이블이 빈 상태일 때만 안전이 보장된 백필이다. 30개를
한 번에(또는 R9 도메인을 통째로) 반영하는 한 문제 없다.

**RLS 정책 교체 항목**(신규 테이블의 최초 정책 부여가 아니라 기존 정책을
`drop policy`로 없애고 다시 만드는 것): **#7, #30** 둘뿐. #7은 이번 배치에서
새로 생긴 테이블의 정책이라 실질적 위험 없음, #30은 위에서 설명한 대로 이미
non-prod에 있던 테이블의 정책 교체라 유일하게 "실제 서비스 중인 테이블의 RLS
교체"에 해당한다.

### 안전 플래그 재확인(fail-closed 코드 경계, 값은 열람하지 않음)
- **DocuSign**: `lib/docusign.ts:109` — `process.env.DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS
  === "true"`. 정확히 문자열 `"true"`가 아니면(미설정 포함) 항상 차단 —
  코드 구조 자체가 fail-closed. Preview에 이 변수가 설정돼 있음은 1단계에서
  확인했으나 **실제 값은 열람하지 않았다** — `"true"`가 아님을 콘솔에서
  확인하는 것은 여전히 필요.
- **Calendar**: `lib/google-calendar.ts:32` — `process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS
  !== "true"`일 때 예외를 던지는 구조로, 동일하게 fail-closed. 값 열람 안 함,
  콘솔 확인 필요.
- **SMTP·Stripe는 코드로 fail-closed를 강제할 수 없는 항목**(`lib/email.ts`는
  `SMTP_HOST` 미설정 시 발송 실패로 처리할 뿐 "안전한 값"인지는 판단하지
  못하고, Stripe는 키 자체가 test/live를 결정한다) — **이 두 값이 실제로
  Preview 전용 sandbox/test 값인지는 이번 세션이 확인할 수 없고, UAT 시작
  전 제품 오너가 Vercel 콘솔에서 직접 값을 교체·확인해야 한다는 조건으로
  남긴다.** 이 조건이 충족되기 전에는 UAT를 시작하지 않는다.

### Preview 배포 — 완료(2026-09-09, 제품 오너 승인)

**대상 커밋**: `1b6335a`(브랜치 `preview/m4-integration-verification`,
working tree clean 확인 후 배포). **배포 ID**: `dpl_4YUqPzVBzDAfCnqbxPjwgjWzWxWm`.
**Preview URL**: `https://alton-o90ch0k7c-alton7.vercel.app`. **Inspector**:
`https://vercel.com/alton7/alton/4YUqPzVBzDAfCnqbxPjwgjWzWxWm`.

**실행 직전 재확인**: `vercel whoami` → `officialalton` 계정, `.vercel/project.json`
→ 대상 프로젝트 `alton7/alton`(`prj_PN2skh92lFA1DvBZpBhE2fLr2wso`) 일치 확인 후
`vercel deploy`(`--prod` 플래그 없음 — Preview 배포)를 실행했다. 배포 후
`vercel inspect`로 `target: preview`, `status: Ready` 재확인(Production 승격
아님을 배포 자체의 메타데이터로 확인).

**로그인 없이 확인 가능한 수준의 검증**: 루트(`/`)에 인증 없이 요청 →
`302` + Vercel SSO 리다이렉트(`location: https://vercel.com/sso-api?...`) —
Deployment Protection이 정상 작동해 콘텐츠가 노출되지 않음을 확인(기존
라운드들과 동일한 known limitation, 실제 화면·기능 확인은 로그인 필요 —
이번 라운드 범위 밖). 이 이상의 라우트 확인, UAT 계정 생성, 상담·예약·
수업·이메일·결제·송금 동작은 실행하지 않았다.

**하지 않은 것**: `main` 병합, `git push`, Production 배포/승격, alias 변경,
환경변수 변경.

## 2. UAT 최소 계정 구성

관리자 1 · 교사 1 · 보호자 1 · 학생 1, 총 4개 역할 계정. 로컬 dev 계정
(`supabase/seed.sql`의 `alton-dev-1234` 패턴)과 **완전히 분리된 별도 UAT 전용
계정**을 Preview 환경에 새로 만든다(로컬 seed 계정을 Preview/non-prod에
재사용하지 않음 — 별도 환경, 별도 데이터).

**실행 ID 원칙(CLAUDE.md 2026-09-07 확정 그대로 적용)**: 모든 UAT 계정 이메일에
공통 실행 ID를 포함시킨다. 예: `uat-2026-09-XX-admin@example.com`,
`uat-2026-09-XX-teacher@example.com`, `uat-2026-09-XX-guardian@example.com`,
`uat-2026-09-XX-student@example.com`(정확한 날짜는 실제 실행일로 확정). 이렇게
하면:
- UAT 종료 후 이 실행 ID로 생성된 모든 데이터(계정, household, contract,
  enrollment, session, entitlement, payout 등)를 정확히 식별해 정리할 수 있다.
- 여러 차례 UAT를 반복해도 이전 실행의 잔여 데이터와 섞이지 않는다.

**계정 생성 방법**: 실제 Google Workspace 계정 발급이 필요한 교사 역할을
제외하면(4절 참고), 나머지는 일반 회원가입/초대 플로우를 통해 만든다 —
"상담 → 온보딩 → 계정 생성" 흐름 자체가 5절 체크리스트의 첫 항목이므로, 관리자
계정만 먼저 만들고 나머지 3개(교사/보호자/학생)는 **가능한 한 실제 UAT 플로우를
통해(직접 SQL INSERT가 아니라) 발급**하는 것이 검증 가치가 더 크다. 단, 교사의
Google Workspace 계정 발급은 실제 Workspace API 쓰기가 필요하므로(4절의
`WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`), 이 부분만 별도 승인 없이는 실제
호출로 진행하지 않는다 — 승인되면 실제 발급, 승인되지 않으면 관리자가 DB에
이미 발급된 것으로 표시된 테스트용 교사 계정을 직접 준비하는 대안을 쓴다(그
경우 UAT 체크리스트 1번 흐름에서 "교사 Workspace 발급" 단계는 스킵하고 별도
기록).

## 3. 교사·학생이 함께 접속 가능한 v3 세션 1건 준비

**목표**: 5절 두 번째 흐름(예약 → 수업 시작 → 세션뷰·화이트보드 → 종료)을 실제
UAT 계정 두 명(교사/학생)이 동시에 접속해서 검증할 수 있는 `sessions`(v3) 행
1건.

**안전한 준비 절차**(전부 실제 앱 플로우 — DB 직접 수정 없음):
1. 위 2절의 UAT 교사·학생·보호자 계정과 계약(contract)·수업권(entitlement)까지는
   실제 흐름(상담→온보딩→계약→수업권 부여)으로 만든다 — 이것 자체가 5절 첫 번째
   흐름의 검증 대상이므로 별도로 미리 만들지 않는다.
2. 예약(`reservation`)은 **실제 예약 화면**(교사 가능 시간 → 학생/보호자 예약)으로
   만든다. `is_within_booking_window`가 24시간~8주 미래만 허용하므로 예약
   시각은 그 범위 안의 아무 미래 시각으로 잡는다 — 이후 그 시각을 기다리지
   않는다(아래 3번 참고).
3. **`starts_at`을 기다리지 않고 바로 "수업 시작"을 진행한다.**
   `mark_lesson_session_started()`(`supabase/migrations/20261030000000_m5a_session_final_judgment.sql`)를
   직접 확인한 결과, 이 함수는 세션의 `final_status = 'scheduled'`와 예약의
   `status = 'confirmed'`만 검사할 뿐 `starts_at`이 현재 시각을 지났는지는
   전혀 확인하지 않는다 — 즉 예약이 확정되는 순간부터 교사가 실제 "수업 시작"
   버튼을 눌러도 정상적으로 진행된다. 예약 시각 자체를 게이트로 오해해 DB를
   직접 고치지 않는다 — **`reservations.starts_at`/`ends_at`을 직접 UPDATE하는
   절차는 이 계획에서 쓰지 않는다**(예약·수업권·알림·세션 관련 규칙을 우회할
   수 있어 UAT 데이터라도 허용하지 않는다는 제품 오너 지적 반영).
4. 세션(`sessions` 행)은 예약이 확정되면 `confirm_lesson_booking()`이 자동으로
   만든다 — 별도로 만들 필요 없음.
5. 종료도 마찬가지로 DB 직접 수정 없이, 기존에 검증된 정상 종료
   (`finalize_lesson_session(outcome='completed')`) 또는 정책상 허용된 조기
   종료 경로(예: 학생 사유 조기종료 `earlyEndReason='student_reason'`, 또는
   회사/선생님 귀책 조기종료 전용 경로)만 실제 UI로 그대로 검증한다 — 시간을
   맞추기 위한 목적의 DB 수정은 하지 않는다.
6. 커리큘럼/교재는 4번째 흐름(커리큘럼·교재·문제 선택)에서 관리자/교사가 UAT
   중 직접 구성하는 것을 검증 대상으로 삼는다 — 미리 채워두지 않는다.

**안전장치**: 이 세션은 실제 Google Meet 연결(`google_meeting_code`)이 필요한
화면 요소가 있다면, 4절의 Google Workspace 관련 플래그가 꺼져 있는 상태에서
"연결 안 됨" 표시가 정상적으로 뜨는지도 확인 대상에 포함한다(실제 화상 연결
자체는 UAT 범위 밖).

## 4. 안전 플래그와 사전 점검 항목

실제 외부 발송·결제·송금 없이 검증하려면 UAT 시작 전 아래 전부가 **비활성/
sandbox 상태**인지 확인한다. 이 표는 그대로 사전 점검 체크리스트로 쓴다.

| 항목 | 확인 방법 | UAT 시작 전 기대 상태 |
|---|---|---|
| DocuSign 실제 발송 | `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` env var | 미설정 또는 `false` |
| Google Calendar 동기화 실제 호출 | `CALENDAR_SYNC_ALLOW_REAL_CALLS` env var | 미설정 또는 `false` |
| Google Workspace 계정 실제 발급 | `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS` env var | 미설정 또는 `false`(2절의 교사 계정 발급을 실제로 승인한 경우에만 일시적으로 `true`) |
| Google Workspace 실제 조회 | `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` env var | 별도 승인 전까지 `false` |
| 정산 실제 지급 | DB `payout_disbursement_gate.real_disbursement_enabled` | `false`(기본값) — UAT 흐름에서 이 값을 임시로 켜는 테스트 코드 경로는 없으므로 실행 중 값이 바뀔 일 자체가 없다. 반영 직후 1회 확인만 하면 됨 |
| 이메일 실제 발송 | `SMTP_HOST` 등 SMTP_* env var | Preview 전용 sandbox/캐처(예: Mailpit, Mailtrap 등 실제 수신자에게 도달하지 않는 서비스)를 가리켜야 함 — **production SMTP 자격증명을 Preview에 그대로 쓰지 않는다** |
| Stripe 결제 | `STRIPE_SECRET_KEY` | 반드시 test 모드 키(`sk_test_...`) — `sk_live_`가 아님을 실행 직전 재확인 |
| Vercel Deployment Protection 우회 | `VERCEL_AUTOMATION_BYPASS_SECRET` | Preview 전용 값(운영 웹훅 URL에는 적용 안 됨, `lib/vercel-protection-bypass.ts` 주석 참고) |

**사전 점검 절차**: Preview 배포 직후, 아무 UAT 계정도 만들기 전에 위 표를
Vercel 프로젝트의 Preview 환경 변수 설정 화면에서 하나씩 확인하고 스크린샷/
기록을 남긴다. 하나라도 예상과 다르면(특히 SMTP_HOST가 production 값이거나
STRIPE_SECRET_KEY가 live 키인 경우) **UAT를 시작하지 않고 즉시 보고한다.**

## 5. 흐름별 UAT 체크리스트와 기대 결과

각 흐름은 실행 ID를 포함한 메모와 함께 성공/실패를 기록한다. "기대 결과"는
정상 흐름 기준이며, 각 흐름 끝에 실패·취소·재시도 경로도 별도로 확인한다(맨
아래 5-5 참고).

### 5-1. 상담 → 복수 자녀 온보딩 → 계정/초대 생성
- [ ] 관리자가 상담 요청을 등록/예약한다.
- [ ] 상담 완료 후 "복수 자녀 온보딩" 링크를 발급한다(자녀 1명, UAT 학생 1명
      기준).
- [ ] 발급된 링크로 보호자 이메일에 안내가 "발송"된다 — 실제 수신함이 아니라
      4절의 sandbox SMTP 캐처에서 내용을 확인한다.
- [ ] 보호자가 링크를 열어 계정(보호자+학생)을 생성한다.
- **기대 결과**: 보호자/학생 `profiles`·`auth.users`가 생성되고, household·
  contract가 draft 상태로 만들어진다. 실제 이메일이 외부로 나가지 않는다(4절
  확인).

### 5-2. 계약·수업권 → 예약 → 수업 시작 → 세션뷰·화이트보드 → 종료
- [ ] 관리자가 계약을 확정하고 수업권(entitlement)을 부여한다.
- [ ] 보호자/학생이 교사를 배정받고 예약(reservation)을 만든다(3절 참고).
- [ ] 예약 시각이 되면 교사가 "수업 시작" 버튼을 누른다.
- [ ] 교사·학생이 **각자의 계정으로 동시에** 세션뷰에 접속한다.
- [ ] 화이트보드에 교사가 필기하면 학생 화면에도 실시간으로 보인다(반대
      방향도 확인).
- [ ] 교사가 "수업 종료"를 눌러 세션을 완료 처리한다.
- **기대 결과**: 세션 상태가 scheduled → live → completed로 전이되고,
  `payable_minutes`/정산 항목이 정상 계산된다. 화이트보드 동기화가 두 브라우저
  간 실시간으로 반영된다. 재접속 시 이전 필기가 replay된다.

### 5-3. 커리큘럼·교재·문제 선택 → 과제 발급 → 학생 풀이
- [ ] 관리자/교사가 이 학생의 과목에 커리큘럼(단원)을 구성한다.
- [ ] 교사가 세션뷰에서 교재·문제를 선택해 과제로 확정한다.
- [ ] 학생이 본인 포털에서 배정된 과제를 확인하고 푼다.
- **기대 결과**: 학생에게는 확정된 과제만 보이고(AI 생성/편집 중 초안은 노출
  안 됨), 학생이 제출한 답안이 교사 화면에서 조회된다.

### 5-4. 보호자·학생·교사·관리자 권한 분리
- [ ] 학생 계정으로 로그인해 다른 포털(`/teacher`, `/admin`, `/parent`) 직접
      URL 접근 시 본인 홈으로 리다이렉트되는지 확인(middleware 역할 게이트).
- [ ] 보호자 계정으로 본인 자녀가 아닌 세션/학생 데이터에 접근 시도 시 거부되는지
      확인.
- [ ] 교사 계정으로 본인이 담당하지 않는 세션의 "수업 시작/종료" 시도 시 거부되는지
      확인(`lesson-schedule-actions.ts`의 본인 확인 게이트 — 3단계에서 이미
      테스트로 검증된 것을 실제 UI로 재확인).
- [ ] 학생/보호자가 지각·노쇼를 신고할 때 **본인 명의로만** 신고되는지, 다른
      사용자 명의로 위조를 시도하면 거부되는지 확인(이번 세션의
      `session_incident_reports` corrective — UI로는 위조 자체가 불가능해야
      정상이므로, 이 항목은 "위조 시도 UI가 없다"는 것 자체가 정상).
- **기대 결과**: 전부 거부/리다이렉트되고, 화면에 이해 가능한 오류 메시지가
  뜬다(예외가 그대로 노출되는 #441류 마스킹 버그 재발 여부도 함께 확인).

### 5-5. 중복 클릭, 실패, 재시도, 취소·재예약
- [ ] "수업 시작" 버튼을 빠르게 두 번 클릭했을 때 상태가 꼬이지 않는지(이미
      기반 안정화 라운드에서 DB 레벨로 검증된 멱등성/잠금을 실제 UI에서
      재확인).
- [ ] 예약을 취소한 뒤 같은 시간대로 재예약이 정상적으로 되는지.
- [ ] 네트워크 지연/일시 실패 상황을 흉내낼 수 있다면(예: 느린 3G 스로틀링)
      "수업 종료" 도중 페이지를 새로고침했을 때 세션 상태가 일관되게 유지되는지.
- [ ] 정산 항목 역분개(관리자)를 두 번 연속 시도했을 때 중복 역분개가 생기지
      않는지(1단계 corrective의 실제 UI 재현).
- **기대 결과**: 어느 경우에도 중복 상태 변경이나 데이터 불일치가 생기지
  않는다 — 발견되면 6절 기준에 따라 즉시 분류.

## 6. 이슈 분류 기준 — blocker / 이번 라운드 수정 / 후속 백로그

| 분류 | 기준 | 처리 |
|---|---|---|
| **Blocker** | (a) 데이터 손실·이중 처리(정산 이중 지급 등) 가능, (b) 권한 없는 사용자가 타 가족/학생 데이터 접근 또는 위조 가능, (c) 핵심 흐름(5절 1~3번)이 정상 입력으로도 완주되지 않음, (d) 실제 외부 발송·결제·송금이 의도치 않게 발생함 | UAT 즉시 중단, 제품 오너에게 즉시 보고. 수정 후 **처음부터 재실행**(부분 재검증 아님) |
| **이번 라운드 수정** | 핵심 흐름은 완주되지만 명백히 잘못된 문구/계산/누락된 검증 등 — 다음 UAT 재실행 전에 반드시 고쳐야 다음 검증이 의미 있는 것 | UAT 종료 후 정리해 별도 corrective 라운드로 승인 요청, 수정 후 **해당 흐름만** 재검증 |
| **후속 백로그** | UX 개선, 문구 다듬기, 엣지 케이스(발생 가능성 낮고 영향 작음) | 기록만 하고 이번 UAT 종료 기준에 영향 주지 않음 — 별도 라운드에서 제품 오너가 우선순위 결정 |

**분류 시 주의**: 이번에 UAT blocker로 분류하지 않는 항목이 이미 3개 정해져
있다 — admin 페이지 역할 게이트 구조, 미사용 RPC 3종, `trial_lesson_review`.
이 3개는 UAT 중 우연히 다시 언급되더라도(예: admin 페이지 접근 관련 테스트에서)
**blocker로 재분류하지 않고 보류 항목 그대로 유지**한다 — 제품 오너가 명시적으로
범위에 다시 포함시키기 전까지는.

## 7. UAT 종료 기준과 UAT 뒤 수정·재검증 순서

**종료 기준**(전부 충족해야 "UAT 통과"로 보고):
1. 5절의 5개 흐름 전부 최소 1회 이상 정상 완주(성공 경로).
2. 5-4(권한 분리), 5-5(중복·재시도·취소) 검증 항목 전부 기대대로 거부/처리됨.
3. Blocker로 분류된 이슈가 0건이거나, 있었다면 전부 수정 후 **처음부터
   재실행**해 다시 통과.
4. 4절의 안전 플래그가 UAT 시작부터 종료까지 한 번도 실제 외부 호출로 전환되지
   않았음을 로그/설정으로 재확인(단, 2절에서 교사 Workspace 발급을 실제로
   승인한 경우는 그 항목만 예외로 기록).
5. UAT 실행 ID로 만든 모든 데이터의 정리 계획이 확인됨(실제 삭제는 별도 승인
   시점에 수행 — 8절 아님, 이 문서 범위 밖의 정리 라운드로 이월 가능).

**UAT 뒤 수정·재검증 순서**:
1. UAT 중 기록한 이슈를 6절 기준으로 분류.
2. Blocker가 있으면 그것부터 수정 → **전체 UAT 재실행**.
3. Blocker가 없고 "이번 라운드 수정" 항목만 있으면, 수정 후 **해당 흐름만**
   재검증(전체 재실행 불필요).
4. 후속 백로그는 이번 라운드 종료 보고에 목록으로만 남기고 별도 우선순위
   결정을 기다린다.
5. 모든 corrective/재검증이 끝난 뒤에만 "이 UAT 라운드 종료"로 `docs/CURRENT.md`에
   기록하고, 다음 단계(예: 실제 UAT 데이터 정리, 추가 포털 성능 라운드 등)를
   제품 오너에게 다시 제안한다 — 자동으로 다음 라운드에 착수하지 않는다.
