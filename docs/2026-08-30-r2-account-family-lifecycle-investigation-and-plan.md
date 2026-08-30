# R2 — 계정·가족·권한 수명주기: 코드 영향도 조사 + 실행 계획

- 상태: **정책 확정 완료(2026-08-30) — 구현 진행 중.** §8의 10개 정책 질문은 전부 사용자가 확정 답변했다. 확정 내용은 `docs/2026-08-29-product-architecture-v3.md` §4.13(13세 미만 동의 확장), §4.19(계정 초대·상태·병합), §4.20(선생님 Google Workspace 계정), §4.21(시간대), §5.7(계정 상태 모델)에 정식 정책으로 반영했다 — 아래 §8은 원래 질문과 확정 답변을 함께 남긴 기록이다.
- 목적: `master-roadmap-v3.md` "공통 Definition of Done"(1-1) 1번 원칙("DB 변경 전 기존 앱 코드·서버 액션·웹훅 사용처 전수 조사") + 사용자 지시에 따라 조사·계획을 먼저 작성했고, 정책 확정 후 태스크 단위 구현 계획(`docs/superpowers/plans/2026-08-30-r2-account-family-lifecycle.md`)을 별도로 제출했다.
- 이 문서(§1~7, §9~11)의 조사·제안 내용은 대부분 그대로 유효하며, 구현 세부사항은 태스크 계획 문서를 따른다.

---

## 0. 가장 시급한 발견 — R1이 이미 실제 앱과 충돌하는 지점

R1 승인 당시에는 몰랐던, **지금 이미 라이브 상태인 호환성 문제**를 조사 중 발견했다. R2 항목 9(시급 안내)와 직접 관련되지만, 그보다 더 급한 것은 **버그 자체**다.

- `app/admin/users-actions.ts`의 `inviteTeacher()`(65-91행)와 `setTeacherHourlyRate()`(111-124행)는 둘 다 `teachers.hourly_rate_krw`를 직접 UPDATE/INSERT할 뿐, R1이 만든 `set_teacher_rate()`를 호출해 `teacher_rate_history`를 만들지 않는다.
- R1의 `teachers_enforce_active_requires_rate` 트리거는 `teacher_rate_history`(하위 이력 테이블)만 확인한다 — `teachers.hourly_rate_krw` 값이 있어도 이력이 없으면 `active` 전환을 막는다.
- **결과**: R1 배포 이후 `inviteTeacher()`로 새로 초대된 선생님, 또는 `setTeacherHourlyRate()`(관리자 화면 `TeacherDetailPanel.tsx`의 "시급(정산 기준)" 패널)로 시급을 바꾼 선생님은, 이후 `setTeacherStatus(id, 'active')`를 호출하면 아래 원시 오류를 그대로 받는다:
  ```
  선생님(...)을 active로 전환하려면 유효한 현재 시급 이력(teacher_rate_history)이 먼저 필요합니다. set_teacher_rate()로 먼저 생성하세요.
  ```
  `setTeacherStatus`가 `throw new Error(error.message)`로 그대로 던지므로 관리자 화면에 이 문장이 노출된다(최소한 오류 자체는 나지만 "친화적 사전 안내"는 아니다).
- **권장 조치**: 이건 R2의 "구현"이 아니라 R1이 만든 회귀를 R2 착수와 동시에 최소 변경으로 막는 조치로 분류해 R2 Task 1로 먼저 처리할 것을 제안한다(정책 판단이 필요 없는 순수 버그 수정 — `inviteTeacher`/`setTeacherHourlyRate`가 서비스-role 클라이언트로 `set_teacher_rate()` RPC를 함께 호출하도록 수정). **승인 없이는 지금 건드리지 않았다.**

---

## 1. 현재 코드·DB 사용처 전수 조사

### 1.1 로그인/인증 흐름

- **로그인**(`app/login/actions.ts`): `signInWithPassword`만 지원. 성공 시 `profiles.role`로 포털 리다이렉트(`getRoleHomePath`).
- **가입은 전적으로 관리자 주도, 자기가입 경로 없음**: `app/admin/users-actions.ts`의 `inviteAndCreateProfile()`(공통 헬퍼, 6-28행)가 `admin.auth.admin.inviteUserByEmail()`(서비스-role, `lib/supabase-admin.ts`)을 호출 → `profiles` insert. `inviteParent`/`inviteStudent`/`inviteTeacher` 3개 공개 함수 전부 `requireAdmin()` 가드로 시작한다.
  - `inviteParent`(30-37행): 부모 초대 + `parents` insert.
  - `inviteStudent`(39-63행): **`parentId`를 필수 인자로 받는다** — 부모가 먼저 존재해야 학생을 초대할 수 있다. 성공 시 `guardian_students`에 `{relation_type:'보호자', is_primary:true}`를 **하드코딩**으로 insert — 복수 보호자·비-주 보호자 개념이 코드에 아예 없다.
  - `inviteTeacher`(65-91행): `hourlyRateKrw > 0` 검증 후 초대 + `teachers` insert(`status:'pending'`, `hourly_rate_krw` 직접 저장 — §0 참고).
- **비밀번호 설정**(`app/set-password/page.tsx`): Supabase 초대/재설정 링크의 `token_hash`(+`type`, `verifyOtp`) 또는 해시의 `access_token`/`refresh_token`(`setSession`)으로 세션을 새로 만든 뒤 `updateUser({password})`. 기존 세션에 대고 진행하지 않도록 방어 로직 있음(42-50행 주석). `role=parent` 쿼리파라미터일 때만 추천인 코드 입력 필드 노출(등록만, 검증/적립 로직 없음 — 별도 티켓으로 미룸).
- **post-auth**(`app/post-auth/page.tsx`): role 기반 리다이렉트 경유지, 그 이상의 로직 없음.
- **초대 재발송/철회/만료 처리 — 전무**: 코드 전체(`재발송|철회|revoke|resend|expir`)를 검색해도 매칭 없음(DocuSign 토큰 만료·무관한 SQL revoke만 검출). Supabase 기본 초대 링크 만료(기본 ~24시간)에 전적으로 의존 중이며, `app/admin/UsersTab.tsx`에는 초대 폼만 있고 이미 보낸(pending) 초대의 재발송 버튼 자체가 없다.
- **이메일 중복 검증 — 전무**: `inviteUserByEmail` 실패 시 Supabase 자체 오류를 그대로 던질 뿐, 사전 중복 체크나 "잘못된 이메일 수정" 플로우가 없다.

### 1.2 데이터 모델 현황

| 테이블 | 현재 status/lifecycle 컬럼 | 비고 |
|---|---|---|
| `profiles` | 없음(role/name/phone뿐) | email은 `auth.users`에만 존재, `loadEmailById()`가 서비스-role로 `admin.auth.admin.listUsers()`를 호출해 매번 교차조회 |
| `students` | `status: active｜pending｜inactive`(3값) | `setStudentStatus`가 `inactive`로도 전환 가능하지만, 그 상태가 로그인·예약·다른 테이블에 미치는 연쇄 효과를 처리하는 코드가 전혀 없다 |
| `teachers` | `status: active｜pending`(**2값뿐, inactive 자체가 없다**) | R1 트리거가 `active` 전환에 개입(§0) |
| `parents` | **status 컬럼 자체가 없음** | 비활성화라는 개념이 스키마에 없다 |
| `guardian_students` | 없음(관계 테이블) | 유일한 생성 경로가 `inviteStudent` 내부 하드코딩 insert뿐 |

- **RLS**(`20260827120001_rls_policies.sql`): 5개 테이블 모두 INSERT는 `is_admin()`만 허용, UPDATE는 본인 또는 `is_admin()`, **DELETE 정책은 5개 테이블 어디에도 없음(기본 거부)**. `is_admin()`은 `profiles.role='admin'` 문자열 비교 — R1의 `has_capability`/`current_user_has_capability` capability 시스템은 애플리케이션 코드 어디에도 아직 연결되지 않았다(레거시 role 체크만 쓰인다).
- **timezone/Google Workspace 이메일/연락처**: 전부 없음. `profiles.phone`(자유 텍스트), `parents.location`(자유 텍스트, timezone 아님)만 존재. `google_email`/`workspace_email` 컬럼은 어디에도 없다.
- **capability 체크**: `lib/admin-auth.ts`의 `requireAdmin()`이 `profiles.role === "admin"`을 직접 비교하는 것이 사실상 유일한 애플리케이션 레벨 권한 가드 패턴.
- **비활성화 관련 코드**: 전무(`disable|deactivat|suspend|비활성화|탈퇴` 검색 결과 무관한 HTML `disabled` 속성뿐).

### 1.3 Google Workspace / 이메일 인프라

- **Workspace 계정 프로비저닝은 앱 코드에 전혀 없다**. Gate C에서 쓴 Admin SDK Directory API·domain-wide-delegation·서비스 계정 impersonation 스크립트는 전부 세션 스크래치패드의 일회성 검증 스크립트였고, 앱에 병합된 적이 없다.
- **이메일 발송**: `lib/email.ts`의 `sendEmail({to, subject, html})` — 순수 SMTP(nodemailer, `SMTP_HOST/PORT/USER/PASS`), Kakao 알림톡은 명시적으로 배제됐고(주석) 로컬은 Supabase Mailpit으로 확인. 현재 호출처 3곳뿐(상담 신청 확인, 정산 알림, 리뷰 완료 알림) — **초대/가입 관련 이메일은 전부 Supabase Auth의 기본 메일 템플릿에 의존 중이며, ALTON 자체 이메일 발송 로직은 아직 없다.**

### 1.4 E2E 테스트 현황

`e2e/auth-roles.spec.ts`(6개 테스트): 4개 역할 로그인→올바른 포털 리다이렉트, 다른 포털 접근 차단, 로그아웃→`/login` 복귀만 검증. **초대·비밀번호 설정·비활성화·병합 시나리오는 0건.**

---

## 2. 기존 기능 중 유지·교체·삭제

| 기능 | 판단 | 근거 |
|---|---|---|
| `inviteUserByEmail` 기반 초대 메커니즘(Supabase Auth 자체 메일) | **유지, 확장** | 이미 동작하는 검증된 경로. 재발송/철회는 이 위에 상태 모델을 얹어 확장(§4) |
| `inviteParent`/`inviteTeacher` | **유지, 시급 이력 연동 수정** | §0 버그만 고치면 구조 자체는 유효 |
| `inviteStudent`의 `parentId` 필수 + 하드코딩 단일 주 보호자 | **교체 필요** | R2 항목 1·2·4(보호자 우선 초대, 복수 보호자)와 정면 충돌 — 아래 §3 참고 |
| `guardian_students` 직접 insert 패턴 | **폐기 예정(R2 범위 내 즉시는 아님)** | R1이 만든 `household_members`로 대체하는 것이 목표지만, `guardian_students`를 참조하는 레거시 RLS 헬퍼(`is_guardian_of` 등)가 아직 살아있어(R1 실행 로그 §6-3에서 이미 확인) 즉시 삭제하면 기존 화면이 깨진다 — cutover 전략은 §3 |
| `students.status`/`teachers.status`(2진 pending/active) | **확장 필요** | `teachers`에 `inactive` 상태 자체가 없다 — 열거형 자체를 바꿔야 함(마이그레이션 필요, §7) |
| `setStudentStatus`/`setTeacherStatus`(단순 컬럼 변경) | **교체 필요** | 비활성화의 연쇄 효과(§5)를 처리하는 서버 함수/트랜잭션으로 승격 |
| `adjustStudentCredit`(직접 `credit_balance` 조정) | **유지(R2 범위 아님)** | R4(수업권·결제 원장) 영역, 손대지 않는다 |
| `is_admin()` 레거시 체크 | **유지, capability와 병행** | R1의 `current_user_has_capability()`로 전면 교체는 더 큰 리팩터 — R2에서는 "계정 비활성화" 같은 신규 기능에만 새 capability 체크를 추가하고, 기존 `is_admin()` 경로는 건드리지 않는 것을 제안(별도 확인 필요, §8) |

---

## 3. `households`/`household_members`를 실제 앱에 연결하는 전략

Gate B 마이그레이션 설계 문서(`2026-08-29-gate-b-migration-and-permission-design.md` §6.1-6.2)에 이미 백필 매핑과 cutover 원칙이 정해져 있다 — R2는 이걸 재도출하지 않고 그대로 실행한다:

- **매핑**: 기존 `parents.id` → 그 부모가 속한 household의 **첫 guardian**으로 백필. `guardian_students`로 이미 연결된 그룹을 household 1개로 재구성(부모 1명 = household 1개, 그 부모의 모든 자녀를 같은 household에 묶음).
- **Cutover 원칙(Gate B 11번)**: feature flag 없이 한 번에 전환 — E2E 통과를 전제로 앱의 읽기/쓰기 경로를 신규 테이블로 스위치.

R2에서 구체적으로 할 일:

1. **백필 마이그레이션**: 기존 `parents`+`guardian_students` 데이터를 `households`+`household_members`로 변환(§6 백필 계획 참고 — 이미 R1에서 두 테이블 다 만들어져 있고 비어 있다).
2. **쓰기 경로 전환**: `inviteParent`/`inviteStudent`가 더 이상 `parents`/`guardian_students`에 직접 insert하지 않고, `households`/`household_members`에 insert하도록 서버 액션을 다시 쓴다. **단, 기존 `parents`/`guardian_students` 테이블 자체는 R2에서 삭제하지 않는다** — R1과 같은 shadow 원칙: 레거시 RLS 헬퍼(`is_guardian_of` 등, 여전히 여러 정책에서 쓰임)가 `guardian_students`를 참조하므로, 이걸 걷어내는 건 R2 범위를 넘는 더 큰 RLS 재작성이 필요하다. **R2에서는 두 모델을 당분간 병행 쓰기(dual-write)**하거나(운영 부담 있음), 혹은 R2 자체를 "쓰기는 신규 모델로 완전 전환 + 레거시 테이블은 읽기 전용으로 동결"로 정할지 **정책 확인이 필요하다**(§8 질문 3).
3. **읽기 경로**: `app/admin/users-data.ts`의 `loadParents`/`loadStudents`/`loadTeachers`가 `households`/`household_members` 기준으로 다시 조회하도록 변경(복수 보호자 표시가 이 시점부터 가능해짐).

---

## 4. 이메일 중복·초대 중복·만료·철회·재발송 상태 모델(제안)

현재 상태 모델이 전무하므로, 아래는 **제안**이며 §8에서 정책 확인이 필요하다.

- 신규 테이블(가칭) `account_invites`: `id`, `email`, `role`, `invited_by`, `status`(`pending｜accepted｜expired｜revoked`), `expires_at`, `resent_count`, `created_at`, `accepted_at`.
- **중복 초대**: 같은 이메일에 `status='pending'`인 초대가 이미 있으면 재발송(같은 행의 `expires_at` 갱신 + `resent_count` 증가)으로 처리하고 새 행을 만들지 않는다. `auth.users`에 이미 존재하는 이메일이면 Supabase가 반환하는 오류를 잡아 "이미 가입된 이메일입니다" 같은 명확한 안내로 변환한다(현재는 원시 오류 그대로 노출).
- **만료**: Supabase 기본 초대 링크 만료(설정 가능, 기본 24h)와 별개로 앱 레벨 `expires_at`을 둬서(더 길게, 예: 7일) 재발송 없이도 링크가 오래 살아있게 할지, 아니면 Supabase 설정값을 늘리고 앱 레벨 만료는 안 둘지 — **정책 확인 필요**(§8 질문 4).
- **철회**: `admin.auth.admin.deleteUser()`로 아직 비밀번호를 설정하지 않은 `auth.users` 행을 삭제하고 `account_invites.status='revoked'`로 표시. 이미 `profiles`/`students`/`teachers`/`parents`에 행이 생겨 있다면(현재 흐름은 초대 시점에 즉시 만듦) 같이 정리해야 한다.

---

## 5. 계정 병합 시 데이터 소유권과 감사 이력(제안)

R2 항목 6("중복 계정 발견 및 병합 절차")은 정책이 전혀 정해져 있지 않다. 제안 원칙:

- 병합은 **되돌릴 수 없는 관리자 전용 작업**으로, 반드시 "생존 계정(survivor)"과 "병합되는 계정(merged)"을 명시적으로 지정한다.
- 병합되는 계정이 소유한 모든 FK(`enrollments`, `guardian_students`/`household_members`, `credit_transactions`, `sessions`/`sessions_v3`, `entitlement_grants` 등)를 생존 계정으로 재배정(`UPDATE ... SET owner_id = survivor_id`)한다 — **삭제가 아니라 재배정**이어야 수업 이력·정산 이력이 끊기지 않는다.
- 병합 자체를 감사 테이블(가칭 `account_merge_log`: `survivor_id`, `merged_id`, `merged_by`, `merged_at`, `affected_tables_summary`)에 기록해, "왜 이 계정이 사라졌는지" 나중에 추적 가능하게 한다.
- 병합되는 계정의 `auth.users` 행은 즉시 삭제하지 않고 로그인만 차단(비밀번호 강제 리셋 또는 별도 플래그)한 채 일정 기간 보관 후 삭제 — 이는 §4.13의 탈퇴-30일-삭제 정책과 같은 리듬을 맞출지 **정책 확인 필요**(§8 질문 5).
- 이 작업은 **되돌릴 수 있는 DB 함수 하나로 처리하기 어렵다** — 여러 테이블에 걸친 트랜잭션이 필요하므로 R1의 `set_teacher_rate()` 같은 단일 SECURITY DEFINER 함수보다는, 서버 액션이 명시적 트랜잭션으로 각 재배정을 순서대로 수행하고 실패 시 전체 롤백하는 구조를 제안한다.

---

## 6. 기존 사용자 5명 백필 계획 (구체적)

`alton_r1_test`(로컬 백업 복원 DB, 실제 원격 스냅샷과 동일)에서 직접 조회한 실제 관계:

| 관계 | 값 |
|---|---|
| 부모 | `b91d45f5-2177-44d8-ba6d-6e972ecef5dd`(장지만) |
| 자녀 | `84557af2-9beb-49c7-a420-e4fbe9a458b2`(장세온, 10학년, active, credit_balance=2) |
| `guardian_students` | 부모→자녀, `relation_type='부'`, `is_primary=true` (1건) |
| `enrollments` | 자녀 ↔ 선생님 `29430e24-...`(장세준), 과목 `fff052c7-...`, active (1건) |
| `contracts`(레거시) | **0건** — 이 학생은 정식 계약 없이 active 상태(파일럿/테스트 데이터의 특성) |
| 선생님 2명 | `29430e24-...`(active, 50000 KRW), `d8fe6918-...`(pending, 50000 KRW — R1에서 설정) |
| 관리자 1명 | `b2a34464-...` |

**백필 절차(제안)**:
1. `households` 1행 생성(`primary_guardian_id = b91d45f5-...`).
2. `household_members` 2행: 부모(`role='guardian', is_primary=true`), 자녀(`role='child'`).
3. `contracts_v3`는 **생성하지 않는다** — 레거시 `contracts`가 0건이라 백필할 원본이 없다. 이 자녀·계약 관계가 정말 "계약 없이 active"가 의도된 상태인지, 아니면 파일럿 데이터의 결함인지는 **정책 확인이 필요하다**(§8 질문 6) — R3(계약 cutover) 이전에 정리해야 할 수도 있다.
4. `subject_enrollments`/`teacher_assignments`는 R3 계약 cutover와 함께 처리(계약 없이 이 둘만 먼저 만드는 것은 R1 스키마의 FK 제약(`subject_enrollments.contract_id not null`)과 충돌 — `contracts_v3`가 없으면 만들 수 없다). **즉 이 백필은 R2 단독으로 끝나지 않고 R3와 순서가 얽혀 있다** — households/household_members만 R2에서 먼저 채우고, subject_enrollments/teacher_assignments 백필은 R3의 계약 백필과 같이 간다.
5. 선생님 2명은 `teachers`/`teacher_rate_history` 그대로 유지(R1에서 이미 처리 완료), 계정 수명주기 관점에서는 손댈 것 없음.

---

## 7. 비활성화가 로그인·예약·대화방·Drive 권한에 미치는 영향(조사 결과 + 제안)

**현재**: 비활성화의 연쇄 효과를 처리하는 코드가 전혀 없다(§1.2). `students.status='inactive'`로 바꿔도 로그인은 그대로 가능하고, RLS도 `status`를 검사하지 않는다(자기 자신 조건 `id = auth.uid()`만 확인).

**제안(정책 확인 필요, §8 질문 2)**:
- **로그인**: `profiles`(또는 각 역할 테이블)에 `status`를 추가해 로그인 직후(post-auth 단계)에서 확인, 비활성 계정이면 별도 안내 화면으로 리다이렉트(세션 자체를 막을지, 로그인은 허용하되 화면 접근만 막을지는 UX 판단 필요).
- **예약**: R1의 `reservations`/`teacher_assignments` RLS와 신규 트리거 계층에 "비활성 계정은 새 예약·배정 생성 불가" 체크 추가가 필요(R1의 `enforce_teacher_assignment_requires_rate`와 같은 자리에 나란히 넣을 수 있음).
- **대화방**(`chat_threads`/`subject_thread` 계열): 비활성 후에도 과거 대화 열람은 유지하되 새 메시지 작성은 막는 것이 자연스러워 보이나, 명시적 정책 없음.
- **Drive 권한**: Gate C GW-13에서 "Workspace 계정 정지(Admin SDK)는 R2 범위"로 이미 명시했다(§8 질문 8과 연결) — 이게 실행되면 Drive 접근은 Workspace 계정 자체가 정지되며 자동으로 막힌다. 즉 **Drive 권한 회수는 이번 R2의 Workspace 처리 여부에 종속적**이다.

---

## 8. 정책 질문과 확정 답변 (2026-08-30 사용자 확정 — `product-architecture-v3.md` §4.19~4.21, §5.7에 정식 반영됨)

1. **보호자 우선 초대 vs 관리자 초대 공존 여부** → **확정: 공존.** 자기가입은 초기 범위에서 제공하지 않는다. 관리자가 보호자를 초대하고, 가입한 보호자가 자기 자녀를 추가·초대한다. 관리자는 예외 상황에서 대신 생성·연결할 수 있고 이 개입은 감사 이력에 남긴다(product-architecture-v3.md §4.19).
2. **"비활성화"의 의미** → **확정: 분리.** `pending → active → suspended(복구 가능) → closure_pending → closed(인증 차단, 보존기간 후 삭제·익명화, 복원 없음)` 5단계로 나눈다. `suspended`는 재활성화 가능, `closed`는 사용자 기능으로 복원하지 않는다(§4.19, §5.7).
3. **`guardian_students`/`parents` 레거시 테이블 처리** → **확정: 장기 dual-write 금지.** `households`/`household_members`로 백필하고 앱 읽기·쓰기·관련 RLS를 신규 구조로 함께 cutover한다. 레거시 테이블은 검증 기간 동안 읽기 전용으로 동결하고 삭제하지 않으며, 삭제는 후속 보안·정리 단계(R12)로 넘긴다.
4. **초대 만료·재발송 정책** → **확정.** 유효기간 7일, 재발송 시 기존 링크 무효화 후 새 링크 발급, 동일 이메일 pending 초대는 새 행을 만들지 않고 재발송 이력으로 누적, 24시간 내 최대 3회 재발송, 관리자 철회 가능, 만료·재발송·철회 전부 감사 이력 기록. Supabase 자체 링크 만료(기본 ~24h)와 ALTON의 7일 정책 사이의 정합성은 구현 시 반드시 검증한다(태스크 계획 참고).
5. **계정 병합 후 병합된 계정의 보관 기간** → **확정.** 병합 계정은 즉시 로그인 차단, 관련 데이터는 생존 계정으로 단일 트랜잭션 재배정, 병합된 인증 계정은 30일 후 삭제·익명화(§4.13 탈퇴 리듬과 동일), 병합 매핑·감사 기록은 7년 보관(계약·정산 기록과 동일). 관리자 전용, 실행 전 영향 범위 재확인, 사용자 UI 되돌리기 없음.
6. **기존 학생(장세온) 계약 없는 active 상태** → **확정: 이관 예외로 유지, 소급 계약 생성 안 함.** 학생 활성화 조건을 "계약 필수"로 좁히지 않는다 — 유효한 체험 수업 여정, 유효한 계약, 사유가 기록된 관리자 이관 예외 중 하나만 있으면 `active`가 될 수 있다. 이 학생은 세 번째 경로(이관 예외)로 분류하고 근거를 기록한다. 근거 없는 활성화만 차단한다(§4.19).
7. **13세 미만 동의 UI** → **확정: R2에서 구현.** 생년월일/연령대, 보호자 동의 상태·시각·정책 버전 저장. 동의 전 로그인·수업 참여·메시지 작성·불필요한 개인정보 수집 차단. 동의 철회 처리. 동의 문구는 버전화(§4.13 확장).
8. **Google Workspace 계정 생성 타이밍** → **확정: R2에서 선생님 계정 자동 프로비저닝까지 구현.** 보호자·학생은 개인 이메일, 선생님은 `@alton.education` 필수. 관리자 초대 시 생성/충돌 확인 → Supabase 연결 → 시급 설정 후 active 전환. 부분 실패는 재처리 가능한 상태로 저장. 관리자 계정은 초기 수동 발급(§4.20).
9. **타임존 필드** → **확정.** IANA 형식 저장, 최초 로그인 시 브라우저 감지값 제안, household 기본값을 학생이 상속(개별 override 가능), 선생님은 개인 타임존, fallback `America/Los_Angeles`, 예약은 UTC+원본 타임존 함께 보존(§4.21).
10. **`is_admin()` vs capability 시스템 이원화** → **확정.** 신규 민감 액션은 `is_admin() OR required capability`로 강제한다. 슈퍼 관리자는 전체 허용, 운영자는 capability별 최소 권한, 서버·DB 양쪽에서 강제. 기존 `is_admin()` 전면 교체는 R12 보안 감사로 이관(당장 R2에서 좁히지 않음).

---

## 9. 역할별 RLS 및 E2E 테스트 계획(초안)

- **RLS**: `households`/`household_members`(이미 R1에서 6개 역할 테스트 완료) 위에 신규로 만드는 `account_invites`/`account_merge_log`(가칭) 테이블의 RLS를 관리자 전용으로 설계하고, R1과 동일하게 **실제 `SET ROLE authenticated`+JWT 클레임 시뮬레이션**으로 학생/보호자/담당·비담당 선생님/관리자/익명 6개 역할 전부 실측 테스트한다(superuser 테스트만으로는 불충분하다는 R1의 교훈을 그대로 적용).
- **동시성**: 계정 병합처럼 여러 테이블에 걸친 재배정 트랜잭션은 R1의 `set_teacher_rate()` 동시성 테스트와 같은 방식(백그라운드 세션 2개로 실제 락 대기 재현)으로, "같은 계정을 동시에 두 번 병합 시도" 같은 경쟁 상태를 검증한다.
- **E2E**(Playwright): `e2e/auth-roles.spec.ts`를 확장해 (a) 초대→비밀번호 설정→로그인 전체 흐름, (b) 비활성화된 계정의 로그인 차단, (c) 보호자가 자녀를 추가 초대하는 흐름(정책 질문 1의 답에 따라), (d) 중복 이메일 초대 시도 시 안내 메시지를 신규로 추가한다.
- **타입 검사·빌드**: 매 태스크 완료 시 `npx tsc --noEmit` + `npm run build` 클린 확인(공통 DoD 그대로 적용).

---

## 10. 마이그레이션·롤백·cutover 전략(초안)

R1과 동일한 원칙을 따른다(공통 DoD 2번):

- 신규 테이블(`account_invites`, `account_merge_log` 등)은 이름 충돌이 없으므로 shadow 이름이 필요 없다 — R1처럼 바로 최종 이름으로 생성.
- `households`/`household_members`로의 **쓰기 경로 전환**은 앱 코드 배포와 같은 순간에 이뤄져야 하므로(그 전까지는 `guardian_students`가 유일한 진실 소스), Gate B 11번 원칙(feature flag 없이 한 번에)을 따른다 — 배포 직전에 백필 마이그레이션을 실행하고, 배포와 동시에 읽기/쓰기 경로를 신규 테이블로 전환한다.
- `teachers.status` enum에 `inactive` 추가는 **`ALTER TYPE ... ADD VALUE`가 트랜잭션 내에서 즉시 쓰기 어려운 Postgres 제약**이 있으므로(같은 트랜잭션에서 추가한 값을 바로 쓸 수 없음), 이 부분만 별도의 소규모 선행 마이그레이션으로 분리해야 한다.
- 모든 신규 마이그레이션은 R1과 동일하게: 로컬 빈 DB + 백업 복원 DB 양쪽 검증 → 역할별 RLS 실측 → 동시성 실측(해당하는 경우) → 원격 변경 대상·영향 범위 사전 보고 → 승인 후 `supabase db push --linked` → 원격 재검증. **승인 없이는 어떤 마이그레이션도 작성만 하고 적용하지 않는다.**
- 롤백: R1과 마찬가지로 신규 테이블은 전부 `CREATE`뿐이라 실패 시 개별 `DROP`으로 충분하다. 단, `households`/`household_members` **쓰기 경로 전환**은 앱 코드 배포와 묶여 있으므로, 이 부분의 롤백은 "이전 앱 코드 커밋으로 되돌리기 + 마이그레이션은 그대로 둬도 무해(신규 테이블일 뿐)"로 설계한다.

---

## 11. 다음 단계 (2026-08-30 갱신 — 정책 확정 완료 후)

1. §0의 R1 회귀 버그(시급 이력 미연동) 수정 — 태스크 계획의 Task 1.
2. §8 답변을 `product-architecture-v3.md`에 반영 완료(§4.13/4.19/4.20/4.21/5.7).
3. 확정된 설계를 바탕으로 태스크 단위 구현 계획을 `docs/superpowers/plans/2026-08-30-r2-account-family-lifecycle.md`에 작성해 제출.
4. 구현 착수 — 코드 변경 전 로컬 검증, 원격 적용 전 변경 대상·영향 범위 요약 보고, 실행 로그 기록 원칙을 R1과 동일하게 따른다. 정책 재확인은 이미 끝났으므로 각 태스크의 구현·검증 자체만 진행하고 결과를 보고한다.
