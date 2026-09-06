# 세션 인수인계 — 상담·재상담·복수자녀 온보딩 (2026-09-06)

이 문서는 진행 중이던 대형 UAT+지시 라운드를 다음 세션이 이어받기 위한 인수인계다. `docs/CURRENT.md`는 아직 이 라운드의 최신 상태로 갱신되지 않았다 — 이 문서를 먼저 읽고 작업을 이어간다.

## 지금까지 실제로 완료·검증·배포된 것

1. **재상담(기존 보호자 계정) 처리** — 완료, 로컬 검증 완료, non-prod 반영 완료.
   - `find_auth_user_id_by_email(p_email)` — 이메일로 기존 Auth 사용자 존재 여부 확인(service_role 전용).
   - `finalize_trial_onboarding_existing_guardian(p_link_id, p_existing_guardian_id, p_child_auth_user_id)` — 새 household/보호자 profile을 만들지 않고 기존 household에 자녀만 추가. `finalize_trial_onboarding_new_guardian()`과 동일한 신뢰 모델(1회용 온보딩 토큰 교환 성공 = 이메일 접근 확인) 재사용, pending→redeemed 상태 기계 그대로, 재시도 멱등.
   - 마이그레이션: `supabase/migrations/20261128000000_m4_existing_guardian_reconsult.sql`
   - 통합 테스트: `app/consult/existing-guardian-reconsult.integration.test.ts`(5건, 전부 통과)
   - `lib/trial-onboarding-finalize.ts`: `createGuardianAndStudentThenRedirect()` 진입 시 이메일 중복을 먼저 확인해 기존 보호자면 `createStudentAndLinkToExistingGuardianThenRedirect()`로 분기.
   - **왜 필요했나**: 실 UAT 중 같은 이메일로 재상담 시 Auth 계정 생성이 이메일 중복으로 실패해 "보호자 계정 생성에 실패했습니다"만 뜨던 실버그(원인 불명 오류) 재현·수정.
2. **"다른 이메일 사용하기" 버튼 제거** — 완료. `ConfirmEmailForm.tsx`는 이제 읽기전용 이메일 표시 + "이 이메일로 계속" 링크만 제공(관리자가 초대 시 이메일을 이미 기입하므로 편집 불필요, 제품 오너 명시 지시).
3. **재상담 후보(중복 상담) UI 노출** — 완료. 기존에 구현만 되고 안 쓰이던 `find_possible_duplicate_consultations()`를 `ConsultationKanbanBoard.tsx` 상세 모달에 배선(🔁 재상담 후보 박스). 새 데이터 모델 없음, 순수 UI 배선.
4. **상담 카드 정보 노출 보완** — 완료. 카드 목록에 🗓 상담 희망/확정 시각 배지, 📝 상담 리뷰 요약(`admin_review_summary`) 배지 추가. "체험 온보딩" 진입 버튼을 시각적으로 강조(주요 다음 단계로 인지되도록).
5. **로그인 페이지 notice 문구 지원** — 완료. `app/login/page.tsx`가 `?notice=` 쿼리를 에러와 별개로 표시(자녀 추가 연결 완료 안내에 사용).
6. **Smart Notes를 상담 결과 기록(consultation outcome)의 게이트에서 완전히 제거** — 완료(2단계에 걸쳐 실측 확인).
   - `admin_record_consultation_outcome()`은 이제 `consent_confirmed_at` + `admin_review_summary`만 확인한다. `smart_notes_drive_file_id`/`smart_notes_config_status` 조건 둘 다 제거됨(마이그레이션 `20261126000000`/`20261127000000`).
   - 이것으로 **Phase O의 "Smart Notes는 어디서도 게이트가 아니어야 한다" 요구 중, 상담 결과 기록 경로는 검증 완료.** 다른 경로(체험 진행/정규 전환 등)에 Smart Notes 게이트가 남아있는지는 이번 세션에서 전수 재확인하지 못했다 — 아래 "미완료" 참고.
7. **수업 종료 기준 보완(별도의 선행 대형 작업, 이 라운드보다 먼저 완료)** — 완료, non-prod 반영·Preview 재배포 확인 완료. 세부는 이 문서가 아니라 이전 세션 보고 참고(`finalize_lesson_session()` 상태기계 강화, trial/regular 세션 통합, teacher/admin UI 문구 정리 등). 이 라운드와 무관하게 이미 안정 상태.
8. **테스트 회귀 수정** — `lib/trial-onboarding-finalize.test.ts`가 새 `find_auth_user_id_by_email` 선행 호출과 충돌하던 것을 rpcMock을 함수명 기준으로 분기하도록 수정, 재검증 통과.

### 검증 결과(이 커밋 기준)
- `supabase db reset --local` 클린 적용(전체 마이그레이션 포함).
- `npx tsc --noEmit` 클린.
- `npx vitest run` — **169 files / 1135 tests 전부 통과.**
- `npx next build` — 성공.
- `npx supabase db push --linked --dry-run` → `npx supabase db push --linked` — 신규 마이그레이션 1개(`20261128000000`)만 non-prod(`worpsqwqgnspddnrtnvq`, Production 아님)에 적용, `migration list --linked`로 local=remote 전체 일치 재확인.
- 커밋 `0e33076`, 브랜치 `preview/m4-integration-verification`(PR #1)에 push 완료. **main 병합·Production 배포는 하지 않았다.**
- Vercel Preview 자동 재배포는 트리거됐을 것(push 기준)이나 이번 세션에서 Preview 재배포 완료 여부·스모크 테스트는 **재확인하지 않았다** — 다음 세션에서 확인 필요.

## 아직 구현되지 않은 것 (제품 오너가 이번 세션에서 요청한 것 중 남은 부분)

제품 오너가 이 라운드에서 요청한 전체 스펙은 세 메시지에 걸쳐 누적됐다(① 12항목 "전체 대체" 지시, ② 카드 단위 정정, ③ "정정·구체화"로 카드/자녀 분기 모델 최종본). **③이 가장 최신이고 ①②를 대체·구체화한다** — 다음 세션은 ③을 기준으로 삼아야 한다. ③의 핵심 요지:

- 상담 칸반 = **상담 건 단위** 카드(자녀 수만큼 복제 금지). `신청 접수 → 승인 대기 → 상담 예정 → 상담 완료`까지만 담당.
- 상담 완료 후에는 **자녀별 진행 카드**로 분기(체험·전환 칸반은 자녀 단위). 같은 가족 자녀도 서로 다른 칸에 위치 가능.
- 자녀별 진행 카드는 가족ID·원래 상담건ID로 cross-link, 가족명 배지/필터로 함께 조회 가능해야 함.
- 중복 방지: 상담 전 자녀 수만큼 카드 복제 금지, 상담 후 가족 카드를 자녀 상태에 맞춰 이동시키지 않음(가족 카드는 완료 후 이력 보존, 더 이상 이동 안 함), 동일 상담·동일 자녀 조합으로 후속 카드 1회만 생성(멱등).
- 관리자 UI는 **상담 운영(상담 건 단위) 보드**와 **체험·정규 전환 운영(자녀 단위) 보드**, 두 개로 분리돼야 한다. 현재 14단계 단일 칸반이 상담 카드 하나를 정규 전환까지 끌고 가는 구조라면 이 구조로 재정리 필요.

**이번 세션에서 위 카드 분기 구조는 구현하지 못했다.** 이유: 현재 `consultations.child_id`가 단수(1 상담 ↔ 최대 1 자녀)이고, "체험·전환 칸반"에 해당하는 자녀 단위 파이프라인 테이블 자체가 아직 없다(현재는 `trial_sessions`가 사실상 자녀 단위에 가깝지만 상담 카드와 명시적으로 분리된 "진행 카드" 엔티티는 없음). 이는 **새 스키마 설계가 필요한 항목**이지 기존 코드 재배선으로 끝나지 않는다.

### 다음 세션이 먼저 해야 할 일 (제품 오너 지시 순서 그대로)

제품 오너의 마지막 지시("앞서 보낸 두 지시는 하나의 통합 작업 라운드로 처리")는 **먼저 3분류(이미구현/부분구현/신규구현 필요)를 내부적으로 분류한 뒤 진행**하라고 명시했다. 이번 세션은 이 분류를 문서화된 형태로 보고하지 못한 채 시간이 부족해 인수인계로 전환했다. 다음 세션 시작 시:

1. 이 문서 + 제품 오너의 원문 세 메시지(세션 로그 또는 이전 요약 참고)를 함께 읽고, 아래 표를 최신화한다.
2. 특히 **"상담 건 카드 vs 자녀별 진행 카드" 분리**가 가장 스키마 영향이 큰 항목이므로, 구현 착수 전 아래 후보 설계 중 하나를 정하고(또는 더 나은 안이 있으면 그것으로) 실제 마이그레이션 스코프를 먼저 정리할 것을 권장한다:
   - **안 A(최소변경)**: 새 테이블 `child_progress_cards`(또는 유사 이름) — `consultation_id`, `child_profile_id`(nullable, 아직 계정 없을 수 있음), `family_id`/`household_id`, `stage`, `blocked_reason`, `next_action` 등. 상담 완료 시(`admin_record_consultation_outcome()` 또는 그 후속 트리거) 자녀 수만큼 이 테이블에 1건씩 insert(동일 상담·동일 자녀 조합 unique 제약으로 멱등). 기존 `trial_sessions`/`subject_enrollments`/`teacher_assignments` 등은 그대로 두고 이 테이블은 "요약·집계 뷰"에 가깝게 각 자녀의 현재 stage를 파생시키거나 명시적으로 관리자가 갱신.
   - **안 B**: 자녀별 진행 카드를 별도 테이블로 만들지 않고, 기존 `trial_sessions`/`subject_enrollments`/향후 정규 전환 상태를 **조회 시점에 합성**해 "진행 카드"처럼 렌더링(뷰 또는 서버 액션에서 계산). 스키마 변경 최소화되지만 "차단 사유"/"다음 작업 하나" 같은 사람이 직접 기록하는 자유 텍스트 필드는 어딘가에 저장할 곳이 필요(예: 기존 `consultations.admin_review_summary`와 유사한 자녀별 컬럼/테이블 필요).
   - 두 안 모두 "복수 자녀 온보딩"(한 상담에 여러 자녀, 신규/기존 보호자 공통) 스키마와 맞물려 있으므로, 어느 안을 택하든 **`consultations`가 자녀 1명만 가리키는 현재 제약을 먼저 깨야 한다** — 예: 상담과 자녀를 연결하는 조인 테이블(`consultation_children`) 신설이 유력한 공통 전제.
3. 이 설계가 확정되면 나머지(복수 자녀 온보딩 폼, 자녀별 독립 파이프라인 실패격리, 자녀별 초대 발송 독립 추적, 상담-레벨 vs 체험-레벨 Smart Notes 동의 분리 등)는 이 스키마 위에서 비교적 기계적으로 따라온다.

### 아직 손대지 못한 나머지 항목(원 지시 ①의 12항목 기준, 우선순위 참고용)

- 신규 보호자의 복수 자녀 동시 온보딩 폼(자녀 추가 버튼, 자녀별 이름/학년/과목/우려사항).
- 자녀별 독립 초대 발송(현재는 온보딩 링크가 상담 1건당 사실상 1개 자녀만 가정).
- 상담-레벨(회의 참석 전체) vs 체험-레벨(자녀별) Smart Notes 동의 분리 저장 — 현재는 계약 조항 기반 단일 동의 모델(위 6번 항목)이라 이 세분화가 아직 없음. **단, "Smart Notes가 어디서도 게이트가 아니어야 한다"는 요구 자체는 상담 결과 기록 경로에서는 충족됨(위 6번).** 체험 진행/정규 전환 등 다른 경로에 남은 게이트가 있는지 `grep -rn "smart_notes" app/ supabase/migrations/` 로 전수 재확인 필요 — 이번 세션에서 못함.
- 자녀별 entitlement 완전 독립(1건 실패가 형제 자매에 영향 주면 안 됨) — 기존 R4 entitlement 모델이 이미 자녀(child_id) 단위이므로 구조적으로는 이미 독립적일 가능성이 높으나, 명시적으로 검증하는 테스트는 없다.
- 즉시 리뷰 작성 + 나중 도착하는 AI 요약(`lesson_reviews.ai_summary`)이 사람이 작성한 리뷰를 덮어쓰지 않는지 — 컬럼은 이미 있고 게시된 리뷰를 자동 갱신하는 코드 경로 자체가 없으므로 구조적으로는 이미 안전하지만, 이것도 명시적 테스트는 없다.
- 비prod 데이터 정리(공식 관리자/선생님1 관련만 남기고 나머지 정리) — **하지 않음**. 파괴적 작업이라 제품 오너 재확인 없이 진행하지 않는 것이 맞다고 판단(다음 세션도 이 판단 유지 권장 — 스키마/마이그레이션/env/webhook은 건드리지 않는다는 제약이 있었지만 정확히 어떤 테스트 레코드를 지울지는 여전히 판단이 필요한 파괴적 작업).

## 명시적으로 하지 않은 것(제약 준수 확인)

- main 병합 없음, Production 배포 없음, 실제 Google/DocuSign/Stripe 호출 없음, 실제 고객 대상 발송 없음.
- 전체 외부 골든패스 UAT 재실행 없음(제품 오너가 직접 하기로 함).
- 비prod 데이터 대량 정리 없음(파괴적 작업 — 재확인 필요 판단).

## 다음 세션 시작 체크리스트

1. `CLAUDE.md` → 이 문서(`docs/2026-09-06-session-handoff-consult-multichild.md`) → 필요 시 `docs/CURRENT.md` 최신 섹션 순으로 읽는다.
2. 제품 오너의 원문 세 메시지(카드 분기 최종 정정본이 가장 중요)를 세션 로그에서 다시 확인해 위 "3분류" 표를 실제로 채운다.
3. Vercel Preview가 최신 커밋(`0e33076`)으로 재배포됐는지, 기본적인 재상담 흐름이 Preview에서 동작하는지 가벼운 스모크 확인부터 한다(전체 골든패스 재실행은 아님).
4. 이후 위 "다음 세션이 먼저 해야 할 일" 순서대로 스키마 설계 → 구현 → 테스트 → non-prod 반영 순으로 진행한다.
