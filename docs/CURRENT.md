# ALTON — 현재 상태 (2026-09-03 기준)

이 문서는 매 R 단계 종료 시 갱신되는 "지금 상태" 요약이다. 장문의 조사·실행 내역은 여기 복사하지 않는다 — `docs/2026-08-29-r2-migration-execution-log.md`(R0~R2 실행 로그), `docs/2026-08-29-r3-migration-execution-log.md`(R3 실행 로그), `docs/2026-09-01-r4-migration-execution-log.md`(R4 실행 로그)와 `docs/2026-08-29-master-roadmap-v3.md`(전체 R 계획)에 있다.

## 완료된 단계

- **Gate A·B·C** — 전부 완료(2026-08-30). Gate C 검증 중 앱이 없어 검증 못 한 3개 워크플로우(GW-10/12/14)는 R8/R9/R12 필수 인수 기준으로 이관됨.
- **R1** — 데이터 기반 재설계, 완료.
- **R2** — 계정·가족·권한 수명주기, **완료(2026-09-01)**. Task 1~9 전부 완료. 상세는 실행 로그 참고.
- **R3** — 상담·체험·제안·계약, **완료(2026-09-01)**. 백엔드·계약모델·관리자 UI·로컬 E2E·Drive 실측(업로드·file ID·멱등·재시도)·DocuSign 웹훅 실배달(HMAC 검증·payload 파싱·DB 반영·idempotency) 전부 실측 검증 완료. 상세는 실행 로그 참고.
- **R4** — 수업권·결제 원장(entitlement ledger + payments), **완료(2026-09-01)**. 스키마(`purchases`/`payment_attempts`/`entitlement_products`/`entitlement_product_versions`/`entitlement_grants`/`entitlement_ledger`/`payment_disputes`), Stripe checkout+웹훅, 관리자 수업권 원장 UI(상품·공지·환불·정산·이전·분쟁 대사), 보호자 구매 UI(체크아웃·영수증·잔액·분쟁 상태), 관리자 Google 로그인(선생님 흐름과 완전 분리, 2026-09-02 실사람 검증 완료), 계약 활성화 재시도 UI 전부 구현·단위/E2E 테스트 통과. 실제 Stripe TEST 모드 API로 성공/거절/환불/웹훅 중복배달 검증 완료. `charge.dispute.created`이 `purchases.status`를 무효 enum 값으로 no-op시키던 버그는 `payment_disputes` 신규 테이블(`20260924000000_r4_payment_disputes.sql`)을 분쟁 전용 소스오브트루스로 둬 해결. 상세는 R4 실행 로그 참고.
- **R5** — 과목 수강·선생님 배정, **완료(2026-09-02)**. `subject_enrollments`/`teacher_assignments`(테이블·겹침방지 exclusion·시급강제 트리거·RLS)는 R1(`20260830020000`, `20260830100000`, `20260830080000`)에서 이미 구현돼 있었음을 확인. 그 위에 앱 레이어를 추가: 활성화 선행조건(계약 active + 결제완료 entitlement) DB 함수+트리거, 체험→정규 승계 자격 판정 함수(자격/커리큘럼/시급 독립 판정), `change_teacher_assignment()` 원자적 선생님 변경(종료+생성+스레드 archive/생성+문서권한 재처리 큐 등록 단일 트랜잭션), `subject_threads`/`subject_thread_messages`(과목별 채팅), `document_permission_retries`(R8 전 Drive 호출 stub 큐), 관리자 서버 액션(`app/admin/subject-enrollment-actions.ts`), 순수 판단 로직(`lib/enrollment/subject-enrollment-decision.ts`), 관리자 UI(`SubjectEnrollmentPanel.tsx`), 학생/보호자/선생님 role 화면(`app/student/EnrollmentTab.tsx`/`app/parent/EnrollmentTab.tsx`/`app/teacher/AssignmentsTab.tsx`). 후속 세션(2026-09-02)에서 R2/R5 시급 확인 로직을 `lib/enrollment/teacher-rate-check.ts`로 통합, `change_teacher_assignment()` 연속 호출 동시성 테스트 추가, 실브라우저 admin→guardian→teacher E2E(`e2e/r5-subject-enrollment-flow.spec.ts`) 작성 중 profiles RLS가 R5 관계를 인식하지 못해 배정된 선생님 이름이 안 보이던 실제 버그를 발견·수정(`20260925020000_r5_profile_visibility_teacher_assignments.sql`), 전체 회귀(tsc/vitest 655건/Playwright 50건) 통과, Vercel Preview 배포(Production 아님) 완료. Preview의 인증 이후 화면 HTTP 확인은 Vercel Deployment Protection SSO에 막혀 미완료(제품 오너의 실제 브라우저 로그인 필요, R4때와 동일한 blocker) — 상세는 R5 실행 로그(`docs/2026-09-02-r5-migration-execution-log.md`) 8절 참고.

## 스키마·외부 서비스 현재 구조

- **DB**: Supabase Postgres. 계정 상태는 역할별 테이블(`students`/`teachers`/`parents`)의 `status` 컬럼 + `transition_account_status()`(SECURITY DEFINER, 역할별 유효 전이 강제 + 선생님은 7조건 게이트) 하나로 통일 관리. `households`/`household_members`가 가족 관계의 원본(레거시 `guardian_students`는 동결, 쓰기 트리거로 차단). 계정 초대는 `account_invites` 자체 토큰 상태 머신. 권한은 `is_admin() OR current_user_has_capability('...')` 패턴(capability는 `supervisor_capabilities`, 자유 텍스트) — Task 4/5/6/7의 신규 함수는 이 패턴 적용됨(레거시 함수 전체 전환은 R12).
- **선생님 계정**: `@alton.education` Google Workspace 계정 필수, `teacher_workspace_provisioning` staging 테이블 → 실제 Google OAuth 최초 로그인으로 연결. 인증 체인은 Vercel OIDC → GCP WIF → 서비스 계정 impersonation → signJwt(DWD) → Directory API(서비스 계정 키·장기 토큰 없음). 쓰기(계정 생성/정지/재활성화)는 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`, 읽기 전용 점검은 `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` — **둘 다 Production에서 기본값 `false`**, 필요할 때만 일시적으로 `true`로 전환 후 반드시 복원.
- **배포**: Vercel, Production 도메인 `https://app.alton.education`. `git push origin main` → Vercel 자동 배포(GitHub 연동, Production Branch = `main`).
- **테스트**: Vitest(유닛, 113개 파일/655건, 2026-09-02 R5 후속 재실행 확인) + Playwright(E2E, `e2e/`, R5 신규 12건 포함 50건 — `--workers=1` 순차 실행 기준, 기본 병렬 설정은 알려진 파일 간 레이스 있음, 아래 blocker 참고).
- **결제**: Stripe(TEST 모드), 웹훅 `app/api/webhooks/stripe/route.ts`. `external_event_receipts(provider='stripe', event_id)` 기반 멱등성 적용.

## 다음 작업에 필요한 확정 정책만

- 계정 상태: `pending→active↔suspended`(가역적), `active/suspended↔inactive`(일반 서비스 중단, 복귀 가능), `active/suspended→closure_pending→closed`(명시적 폐쇄, 30일 유예, 복원 없음). 선생님의 `active` 전환(어떤 전이든)은 7조건(workspace_issued/first_login/identity_linked/valid_rate/onboarding_complete/contract_signed/admin_base_info) 전부 충족해야 함.
- `teacher_rate_history`/`account_status_events`는 **하드 immutable**(DELETE·UPDATE 전면 차단, bypass 플래그 없음, service_role도 EXECUTE revoke) — 테스트 데이터라도 물리 삭제 불가, 정리는 `suspended`/`closed` 같은 정상 상태 전이로만.
- 초대: 관리자가 보호자 초대 → 가입한 보호자가 자녀 추가 초대(§4.19). 보호자가 다른 보호자(공동 보호자)를 초대하는 것도 이제 가능하지만 관리자 전용(자기서비스 아님).
- 시간대: 개인 설정 → household 기본값 → `America/Los_Angeles`(`lib/timezone.ts`). 브라우저 감지 UI는 R6까지 의도적 보류.

## 최신 마이그레이션

`supabase/migrations/20260925020000_r5_profile_visibility_teacher_assignments.sql`(로컬 개발 DB `supabase db reset --local`로 적용 완료). R5 마이그레이션: `20260925000000_r5_subject_enrollment_teacher_assignment.sql`(활성화 선행조건 함수+트리거, 승계 자격 함수, `change_teacher_assignment()` 원자적 처리, `subject_threads`/`subject_thread_messages`, `document_permission_retries`, `teacher_assignments.curriculum_handoff_status` placeholder), `20260925010000_r5_subject_thread_auto_create.sql`(스레드 자동생성을 트리거로 옮기고 archive 순서 버그 수정), `20260925020000_r5_profile_visibility_teacher_assignments.sql`(profiles RLS에 `teacher_assignments`/`subject_enrollments` 기반 가시성 추가 — 2026-09-02 후속 세션에서 발견한 버그 수정, 아래 blocker 참고). R5 세 마이그레이션 전부(`20260925000000`/`20260925010000`/`20260925020000`) `npx supabase db push --linked`로 원격(`worpsqwqgnspddnrtnvq.supabase.co`) 반영 완료, `npx supabase migration list --linked`로 local=remote 일치 확인됨(2026-09-02).

## R3 계약/DocuSign 구조 (2026-09-01 확정)

- 계약은 자녀 1명 단위 계속 계약(보호자 1명 서명), 기본계약에 과목·선생님·패키지 금액을 고정하지 않는다 — 추천 조건은 `proposals`/`proposal_subjects`에만 남기고 실제 구매 스냅샷은 R4.
- DocuSign envelope는 `contracts`가 아니라 `contract_versions`와 1:1(`docusign_envelope_id`/`status`/`company_signed_at` 등 버전 레벨). 회사 선서명 완료 버전만 발송 가능.
- 웹훅(`app/api/webhooks/docusign/route.ts`)은 서명 검증 fail-closed, `external_event_receipts(provider,event_id)` 멱등, 완료 시 `contracts.status='active'`(결제 진입 경계)로 전환하되 Drive 저장은 `drive_artifacts.sync_status`로 분리 추적(서명 상태를 되돌리지 않음).
- 13세 미만 학생 동의 게이트(`assert_guardian_consent_ok()`)가 체험 생성·계약 활성화 모두에서 fail-closed로 강제됨 — R2 `consent_policy_versions`/`guardian_consents` 그대로 재사용.
- Sandbox DocuSign 인증(JWT)·envelope 발송·실서명 완료(1차 envelope)는 실측 검증됨. 서명 필드 미렌더링 근본원인(`anchorIgnoreIfNotPresent` 기본값) 수정·확인 완료(2026-09-01, 아래 참고). Drive 실제 업로드는 코드 구현 완료(worker·다운로드 연결·멱등 포함), 실제 쓰기 자체는 최소권한 전용 인프라 설계·승인 대기 중.

## 남은 blocker·후속 작업

- **(R4, 2026-09-01, 해결)** `charge.dispute.created` 처리 시 `purchases.status`를 `'disputed'`로 갱신하려던 코드가 이 값이 `v3_payment_attempt_status` enum에 없어 조용히 no-op되던 버그를 수정했다. 정책 결정(제품 오너): 분쟁은 `purchases`에 파생 컬럼을 두지 않고 신규 `payment_disputes` 테이블(`20260924000000_r4_payment_disputes.sql`)을 소스오브트루스로 둔다 — `charge.dispute.created`/`.updated`/`.closed` 전부 `stripe_dispute_id` 유니크 제약으로 upsert(idempotent), `purchases.status`는 어떤 경로로도 건드리지 않는다(payment_attempts 상태만 계속 반영). 분쟁 생성은 `entitlement_ledger`를 절대 건드리지 않음(자동 회수 없음) — 패소로 실제 조정이 필요하면 기존 `adjust_entitlement()`/관리자 조정 UI(`EntitlementLedgerTab.tsx` "조정·연장·이전")를 그대로 사용. 관리자 "결제 실패·대사" 탭에 열린/최근 분쟁 목록(상태·금액·사유·Stripe ID·최근 갱신) 추가, 보호자 영수증 화면에도 분쟁 상태 표시 추가. `purchase_receipts` 뷰는 기존 컬럼 순서를 보존하고 `dispute_*` 컬럼을 끝에 append(CREATE OR REPLACE VIEW의 중간 삽입 불가 제약 때문 — `20260923000000`과 동일한 패턴). 레거시 `credit_purchases` 플로우의 분쟁은 `purchases.stripe_payment_intent_id` 매칭으로 찾지 못해 `purchase_id=null`로만 기록됨(조용히 버리지 않음) — 레거시 전용 분쟁 테이블은 만들지 않았다(범위 밖 판단, 필요 시 후속 확인). Vitest(`app/api/webhooks/stripe/route.r4.test.ts` 신규 케이스 8개) + Playwright(`e2e/r4-webhook-dispute.spec.ts` 신규 4건: 생성/갱신/종결/미매칭)로 검증.
- **(R4, 2026-09-01, 해결)** 레거시 크레딧(`credit_purchases`) 신규 구매 경로(`app/parent/credits-actions.ts`의 `createCreditCheckoutSession`, 보호자 "수업권" 탭 `CreditsTab.tsx` "충전하기" 버튼)가 R4 전환 이후에도 여전히 호출 가능했던 것을 확인 — 신규 Stripe 체크아웃 세션 생성만 즉시 에러로 차단(기존 레거시 데이터 조회·웹훅의 기완료 건 처리 능력은 그대로 보존). 실제 제거는 오픈 전 정리 단계로 이관, 마이그레이션·삭제 작업은 하지 않음.
- **(R3, 2026-09-01, 해결)** Drive 실제 업로드 — Preview 전용 최소권한 서비스 계정(`r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com`, Directory API·DWD 없음, WIF provider `vercel-r3-preview`가 owner_id/project_id/environment=="preview" 조건으로 제한)으로 실측 검증 완료: 실제 업로드·`drive_file_id` 연결·멱등 재실행(동일 file id, 중복 없음) 전부 확인. 검증 중 실제 버그 2건 발견·수정 — impersonation 토큰에 Drive 스코프 명시 필요(없으면 403), Shared Drive 실제 이름이 "Alton Integration Sandbox"로 대소문자가 코드 가정과 달랐음(대소문자 무시 비교로 수정). 검증 후 쓰기 플래그·IAM binding 제거, 서비스 계정 비활성화 완료 — 서비스 계정/WIF provider 자체와 Shared Drive 멤버십(사용자 직접 제거 필요)은 별도 승인 대기.
- **(R3, 2026-09-01, 해결)** DocuSign 웹훅 HMAC 실수신 — 원인은 두 가지였다: (1) 계정 Connect Key가 아니라 임시 Connect configuration의 `hmacKeyItems`를 썼던 것(DocuSign 지원팀 확인, Admin UI → Connect → Connect Keys에서 발급한 계정 키로 교체), (2) `eventNotification`이 계정 레벨 Connect의 `event`/`data` 래퍼 구조가 아니라 envelope summary 필드를 최상위에 그대로 평탄하게 보내는 실제 구조였던 것(안전한 필드명 진단 로그로 실측 확인, 파서 수정+실제 구조 재현 fixture로 로컬 검증). 최종 라이브 검증: 새 envelope(수정된 파서 배포 URL로 처음부터 생성) 발송 → `sent` 이벤트 HMAC 통과·2xx·payload 파싱·DB 반영·`external_event_receipts` 기록 전부 확인 → 실제 서명 → `completed` 이벤트도 동일하게 확인(단, `contracts.status='active'` 전환은 이 테스트 학생의 DOB 미등록으로 R2 동의 게이트가 정당하게 차단 — 파싱/HMAC과 무관한 별개의 정상 동작). DocuSign Connect **계정 레벨** 라우팅 자체는 여전히 미작동 상태로 남아있으나, envelope별 `eventNotification`을 실제 운영 경로로 채택해 문제 없음(계정 레벨 라우팅 이슈는 더 이상 blocker 아님, 후속 조사 불필요).
- **(R3, 2026-09-01 해결)** ~~`queued` 상태 최초 처리 워커 부재~~ → `processQueuedDriveArtifacts()` 구현 완료(claim/lock, `queued→processing→succeeded/retryable_failed→manual_review`, `drive_artifacts.retry_count` 컬럼 추가). ~~`uploadArtifactToDrive`에 실제 문서 다운로드 미연결~~ → `retryFailedDriveArtifacts()`가 이제 실제 `downloadCompletedDocument`/`downloadCertificateOfCompletion`을 호출. Drive 파일명 기준 멱등 확인도 추가. 전부 mock 테스트로 검증(502/502) — **실제 Drive 쓰기 자체는 아직 미실행**(아래 항목).
- **(R3, 2026-09-01 신규, 진행 중)** Drive 실측 검증용 최소권한 전용 인프라(Preview 전용 서비스 계정, ALTON 프로젝트·Preview 환경만 허용하는 WIF 조건, Directory API/DWD 권한 없음, `ALTON Integration Sandbox` 또는 `R3 Test` 폴더로 접근 제한) 설계·승인 요청 진행 중 — 기존 Production WIF/서비스 계정은 건드리지 않기로 확정(`assertNotPreview()` 완화 금지, Production 런타임 시험 금지).
- **(R12로 이관, 2026-09-01 확정)** 이미 active인 계정의 로그인 이메일 정정 절차 — 본인확인·Workspace/Auth identity 재연결·중복 계정 충돌·감사 이력을 함께 다뤄야 하는 별도 계정관리 정책이라 R2 범위에 포함하지 않음. `master-roadmap-v3.md` R12에 등록됨. PENDING 초대 오타는 기존 revoke+재초대로 충분(이 항목과 무관).
- **(R13, 정식 오픈 전)** `e2e/account-lifecycle.spec.ts`/`account-merge.spec.ts`가 전역 시드 계정을 공유해 `fullyParallel:true` 기본 설정에서 다른 스펙과 레이스 가능 — 전용 픽스처로 리팩터링 필요.
- **(R12)** SECURITY DEFINER 함수 전체 anon EXECUTE 권한 감사(레거시 9개 + 이번 세션에서 확인된 다른 함수들), Workspace 위임 관리자를 `official@alton.education`에서 전용 자동화 계정으로 분리, 테스트 데이터 안전 정리 절차 설계.
- **(R11 또는 R13)** `mark_expired_invites()` 스케줄러(cron) 연결.
- Gate C 이관 3건(GW-10/12/14, R8/R9/R12 인수 기준) — 여전히 해당 R에서 반드시 통과.
- **(R4, 정식 오픈 전 blocker)** 실제 세금 계산 서비스 미구현 — `purchases.tax_minor`는 현재 0/수동값으로만 채워짐, 실제 tax 서비스 연동 필요.
- **(R4, 정식 오픈 전 blocker)** 실제 이메일 발송 미구현 — 가격 변경 공지 등은 `outbox` 테이블에 쌓이기만 하고 실제 발송(SMTP/이메일 서비스 연동)까지는 안 감.
- **(R4, 2026-09-01, 해결)** Vercel Preview Deployment Protection(SSO)으로 자동화 도구가 막혀 있던 문제는 제품 오너가 직접 브라우저로 로그인해 우회 — 2026-09-02 관리자 Google 로그인 실사람 검증(위 항목)에 사용.
- **(R4, 2026-09-01, 해결 — 2026-09-02 실사람 검증 완료)** 관리자 Google 로그인: 원인은 `NEXT_PUBLIC_SITE_URL`을 리디렉션 기준으로 쓰던 것이 실제 요청 origin과 달라 콜백이 어긋나던 버그(`039068b`/`a0645ce`로 수정, request origin 기준으로 전환) + Supabase 원격 프로젝트의 "manual linking" 인증 설정이 꺼져 있었던 것(대시보드에서 제품 오너가 직접 켜 영구 반영 완료, 되돌리지 않음) 두 가지였다. 2026-09-02 제품 오너가 실제 Vercel Preview 배포에서 브라우저로 관리자 Google 로그인 전체 흐름을 완주해 검증 완료 — 기존 Google identity(`google_sub=111086046953656987120`)가 관리자 프로필(`b2a34464-f8b1-4605-89cd-e3e56de44c67`)의 `admin_google_identities`에 정상 연결됨을 확인. **관리자 Google 로그인 항목 완전히 완료.**

- **(R4·R5, 2026-09-02, 완전히 해결 — 실사람 UAT 완료)** 제품 오너가 R4·R5 통합 UAT를 Vercel Preview에서 직접 수행해 전체 흐름(보호자 20회 패키지 구매→Stripe TEST 결제→영수증/수업권 확인→관리자 확인→과목 수강 활성화→체험 선생님 승계 제안→선생님 배정→적용일·사유 지정 변경→보호자/학생/선생님 역할별 화면 확인)을 승인 완료. UAT 중 발견되어 수정된 실버그: 관리자 Google 로그인/비밀번호 재설정/Stripe 결제 성공 리다이렉트가 전부 고정 `NEXT_PUBLIC_SITE_URL` 대신 실제 요청 origin을 쓰도록 수정(`039068b`/`a0645ce`/`97b04f2`, `lib/request-origin.ts` 공용 헬퍼), 관리자 "구매 상세 조회"가 UUID 아닌 입력(이메일 등)에 원시 DB 에러를 던져 페이지 전체가 깨지던 500 버그 수정(`7992fb3`), 선생님 변경 화면에 적용일 입력란이 아예 없어 항상 "지금"으로만 처리되던 버그 수정(DB 함수는 이미 `p_effective_from`을 지원했음, UI만 연결, `7992fb3`). **R4·R5 두 단계 모두 완료 확정 — 같은 범위 재작업 금지.**
- **(R4, 2026-09-02, 정식 오픈 전 blocker, 2026-09-02 재확인)** Production Stripe 웹훅 엔드포인트 `https://app.alton.education/api/webhooks/stripe`가 아직 등록되어 있지 않음(현재 Stripe 계정에 있는 웹훅 2개는 전부 이번 세션 UAT용 임시 Preview 주소). Preview에서 있었던 웹훅 전달 지연은 Preview 전용 Deployment Protection + 배포마다 바뀌는 URL 때문이며 Production 구조 문제가 아님(Production 도메인 `app.alton.education`은 Deployment Protection 없음, 확인됨). **법인 설립·Stripe Live 계정 활성화 전에는 다음을 하지 않는다**: (1) 이 Production 웹훅 엔드포인트 등록, (2) Stripe Live secret key 발급·환경변수 입력, (3) 실제(Live) 결제 API 호출. 법인 설립·Stripe Live 계정 활성화 후 오픈 전 필수 작업으로 남겨둔다. `docs/2026-08-29-master-roadmap-v3.md` R13(종단 QA·정식 오픈) 체크리스트에도 동일 항목 등록.
- **(R6, 2026-09-03) 상태: 완료.** Smart Notes canonical PATCH 실제 Sandbox 최종 검증까지 통과(M0 종료).** 정규수업 예약/수업권 연동/Calendar·Meet/취소·재예약/역할별 캘린더 UI(학생·보호자/선생님/관리자)/선생님 외부 일정 표시/Google 직접 변경(시간 변경 양방향·삭제 양자택일)/지각·노쇼/AI 회의록·Smart Notes/알림/운영 전체 범위가 구현·mock 테스트 완료에 이어 **실제 Google Sandbox 통합 검증까지 통과**했다(15/N, 아래 참고 — 실제 버그 3건 발견·수정). 그 통과를 조건으로 **Calendly/Zoom(개별 회차 예약용)을 완전히 제거**했다 — 상담(consult_requests) 예약 Calendly는 범위 밖(`ConsultForm`으로 독립 동작, 영향 없음). 전체 스펙은 `docs/2026-09-02-r6-scope-and-approval.md`에 원문 그대로 보존. 진행 상세는 `docs/2026-09-02-r6-migration-execution-log.md` 참고. **(2026-09-03, 16/N)** 제품 오너 지시로 Smart Notes 동의 모델을 보호자 opt-out 선택 기능에서 가족 서비스 이용계약의 필수 조항으로 단순화(아래 참고) — 이때 재작성한 `enableMeetSpaceSmartNotes()`(canonical space name 기반 PATCH)를 **(2026-09-03, M0) 사용자 승인 후 실제 Google Sandbox로 재검증** — 임시 `environment:development` IAM binding 추가 → 실제 Calendar 이벤트+Meet space 생성 → canonical name으로 PATCH → 재확인 GET·독립 재조회 모두 `autoSmartNotesGeneration: "ON"` 확인 → 검증 직후 임시 Calendar 이벤트 삭제, IAM binding 제거(재조회로 Production만 남았음 확인), 임시 파일·자격 증명 삭제. **canonical name PATCH가 기존 403을 실제로 우회함을 확인 — 더 이상 외부 gap 아님.** 이로써 R6은 정식 종료됐다.
- **다음 실행 순서(2026-09-03 확정, 상세는 마스터 로드맵 "근접 실행계획" 절)**: `M0 R6 마감(완료) → M1 상담·체험 기반 재설계 → M2 R4 후속(체험/정규 수업권·환불) → M3 R5 후속(체험/정규 배정) → M4 상담→체험→정규 전환 통합 마감 → M5 기존 R7 착수`. **M1/R6 Workspace Events 공통 blocker는 2026-09-03 코드 정정+mock/로컬 검증까지 완료**했다 — 실제 Google Sandbox 실측 재검증(구독 생성 응답 확인 등)만 사람 복귀 후 실행 대기 상태다(실행 절차는 `scripts/m1-sandbox-verification.sh` v2, 요청서는 `docs/2026-09-03-m1-google-sandbox-verification-request-v2.md`). 이 실측 재검증이 끝나기 전까지 M1/R6은 "코드+mock 완료"로만 표시하고 "완전 마감"으로 표시하지 않는다. **M2는 착수해 아래 별도 절 기준으로 완료됐다(2026-09-03) — M3/M4는 여전히 착수하지 않았다.** 상세는 아래 "M1 — 상담 기반 재설계" 절, "M2 — R4 후속(체험수업권)" 절과 `docs/2026-09-03-m1-migration-execution-log.md`/`docs/2026-09-03-m2-migration-execution-log.md`. R9(과목 마일스톤 보드)·R11(보호자–관리자 운영 메신저)은 이 실행 순서에 포함되지 않고 각자의 R 섹션에 별도 미착수 항목으로 남아있다.
  - **1/N 완료**: 선생님 반복가능시간·날짜별예외·15분버퍼·24h~8주 window, `confirm_lesson_booking()`(예약+세션+entitlement hold 단일 트랜잭션).
  - **2/N 완료**: Calendar/Meet 이벤트+Meet 생성·FreeBusy·취소, 실패해도 예약/hold는 건드리지 않는 재처리 워커(`reconciliation_needed` 포함).
  - **3/N 완료**: 구조적 cutover — `sessions`→`legacy_sessions`(레거시 세션뷰 8파일 14곳 계속 사용), `sessions_v3`→`sessions`(신규 예약이 쓰는 테이블). FK·RLS·인덱스는 rename에 자동 추종, 함수 본문 7개(텍스트 참조라 자동추종 안 됨)는 전부 CREATE OR REPLACE로 갱신 확인. `material_version_id`는 R9 선행조건(학생별 진도 스냅샷) 부재로 의도적으로 비워둠(인터페이스만 유지).
  - **4/N 완료**: 예약 멱등성(동일 idempotency_key 재요청 시 중복 생성 안 함 — `RETURN QUERY`가 함수를 종료시키지 않는 실제 PL/pgSQL 버그를 스모크 테스트로 발견·수정), 관리자 24시간 이내 예외, 주1회 최대8회 반복예약(수업권 부족 시 가능한 회차까지만 생성 후 명확한 사유로 중단).
  - **5/N 완료**: 취소(`cancel_lesson_booking()` — 학생 24h+ release/24h미만 consume, 선생님·회사 취소는 release+30일 미만 만료 시 30일로 연장), 취소 이력 테이블(예약 덮어쓰지 않음). 지각·노쇼는 사용자 최신 지시에 따라 **"신고"+"원본 접속기록 수집"까지만**(수업권 소진·출석확정·정산은 R7로 명시 이관) — `session_incident_reports`/`session_access_events`(Meet vs ALTON 접속을 source로 분리, 서로 보정하지 않음).
  - **6/N 완료**: 예약 서버 액션(`lib/booking/*`, `app/{parent,student,teacher,admin}/*booking*-actions.ts`) + 슬롯조회 알고리즘(순수함수, `AT TIME ZONE`과 동일한 DST 처리를 `Intl`로 구현) + UI 4종(보호자·학생 예약 탭, 선생님 가용시간 관리 탭 — 원래 빈 슬롯이었음, 관리자 예약 운영 화면). 리팩터링 중 **실제 권한 우회 취약점 발견·수정**(취소 액션이 reservationId가 실제로 그 childId 소유인지 검증하지 않던 문제 — `assertReservationBelongsToChild()` 추가). 실제 로컬 브라우저로 보호자 1회예약·주간반복8회·취소, 선생님 가용시간 등록, 관리자 재처리·회사취소까지 전부 클릭해서 검증(단순 tsc/vitest 아님) — 이 과정에서 "예정된 수업" 미갱신 버그와 `window.prompt()` 불안정성(인라인 폼으로 교체) 2건 추가 발견·수정.
  - 전 단계 로컬 dev DB 적용·전체 Vitest 704건·tsc 클린·전체 Playwright(--workers=1) 재확인(1건 실패는 R6 변경 제거한 베이스라인에서도 재현되는 기존 결함으로 실측 확인, 회귀 아님) 후 원격 dev DB 반영·커밋 완료.
  - **7/N(2026-09-02)**: AI 회의록(Smart Notes) 동의 게이트를 opt-out 모델(기본 ON, 보호자 토글, `ai_notes_consent_events`)로 처음 구현했으나, **16/N(2026-09-03)에서 전면 폐기**됐다 — 아래 16/N 항목 참고. 이 7/N 항목은 역사적 기록으로만 남긴다.
  - **16/N 완료(2026-09-03, 제품 오너 지시 — 정책 단순화)** Smart Notes를 보호자 opt-out 선택 기능에서 가족 서비스 이용계약의 필수 조항으로 전환. **계약 모델**: 가족계약은 기간제 의무 구매가 아니라 계속적 서비스 이용약정 — 계약 서명 한 번(별도 동의서·체크박스·AI 서명란 없음)이 정규수업 전체의 Smart Notes 사전 동의 근거다. 계약과 수업권은 독립적(수업권 소진이 계약을 종료시키지 않음, 최신 계약 버전이 유효하면 재구매 시 재서명 불필요 — 이 동작은 기존 `contracts.status`/`contract_versions.version_status` 설계가 이미 제공하고 있어 활성화 게이트(`subject_enrollment_activation_ready()`, R5) 자체는 변경하지 않았다. 이 게이트는 원래도 `contracts.status='active'`만 요구했고 별도 AI 동의 조건을 추가한 적이 없다). **제거한 것**: `ai_notes_consent_events` 테이블, `has_ai_notes_consent()`/`set_ai_notes_consent_as_guardian()` SQL 함수, `sessions.smart_notes_status`의 `disabled_by_guardian` 값(CHECK 제약에서 삭제), 보호자 자녀별 ON/OFF 토글 UI(`app/parent/ConsentTab.tsx`), 관리자 열람 화면(`app/admin/ConsultationTab.tsx`의 "AI 회의록 선택" 탭) — 전부 `20261008000000_r6_smart_notes_contract_clause_simplification.sql`. `confirm_lesson_booking()`은 이제 항상 `smart_notes_status='pending'`으로 스냅샷한다(회차별 재동의 없음). **Meet Space 설정 재구현**: 기존 `spaces.patch` 403(meeting code 별칭으로 PATCH)을 원인 확인해 `enableMeetSpaceSmartNotes()`로 재작성 — `spaces.get`(별칭)으로 canonical `space.name` 확인 → canonical name으로 `spaces.patch` → 재확인 `spaces.get`. 실패해도 예약·세션·수업권 hold는 자동 취소하지 않고 `sessions.smart_notes_config_status`(`pending`/`applied`/`failed`) + `smart_notes_config_error`로 관리자 재처리 대상 기록(신규 컬럼). 이 세션에서는 mock/로컬 검증까지만 하고 실제 Google API는 호출하지 않았다 — **실제 Sandbox 재검증은 M0(2026-09-03)에서 완료, 아래 15/N 항목 갱신 참고**: canonical name PATCH가 기존 403을 실제로 우회함을 확인. 회차별 재동의 화면(예약/Meet 입장 전)은 애초에 존재한 적이 없어 제거할 것도 없었다(확인 완료). 세션뷰(`app/session/[id]`)는 아직 R6 `sessions`/`reservations` 모델로 전환되지 않아(레거시 `enrollments`/`legacy_sessions` 기반, 별도 후속 R 작업) 정규수업 Smart Notes 안내 배너를 실제 화면에 연결할 지점이 없다 — 문구 자체는 정책에 확정했고(부모 포털 `ConsentTab.tsx`에 정적 안내로 반영), 세션뷰 전환 시 이식한다. 전체 Vitest/tsc/build 통과, Production/실제 DocuSign/실제 Google API/Stripe Production 접근 0건.
  - **17/N 문서정책 확정(2026-09-03, 구현 없음)**: 체험수업에서도 정규 리뷰 경험 제공을 위해 Smart Notes를 필수 사용한다. 가족 기본계약은 체험 완료 후 정규 전환 시에만 체결하며 과거 체험에 소급 적용하지 않는다. 체험 예약 최종 단계에서 보호자 계정으로 학생별 최초 1회 「체험수업 및 AI 수업리뷰 안내·동의」를 능동 확인하고, 보호자 계정·학생·문구/정책 버전·동의 시각·IP를 기록한다. 이는 별도 계약·DocuSign 문서가 아니며 체험마다 반복하지 않는다. 비동의 시 체험을 진행하지 않고, Smart Notes만 끄고 체험·정규수업을 계속하는 옵션은 없다. 체험·정규수업 모두 Google 원본을 고객에게 통상 직접 제공하지 않고 선생님이 검토·수정한 리뷰를 제공하되 법률상 열람·정정 권리는 제한하지 않는다. **현재는 문서와 화면 문구만 확정했으며 실제 체험 동의 화면·감사기록 게이트는 미구현**이다. 특히 만 13세 미만의 보호자 확인 방식은 변호사 승인 전 정식 출시 blocker다. 문서 기준: `docs/contracts/trial-class-ai-review-notice-consent-v0.1-draft.md`.
  - **8/N 완료**: 알림 outbox(그린필드 `booking_notification_outbox`) — 24h/2h 리마인드 + 예약확정/취소 즉시알림, 수신자는 자녀+household guardian 전원, 인앱 표시(R0 `notifications` 재사용)도 함께 삽입. 실제 발송 인프라 없음(status는 pending/cancelled까지만, 기존 R4 blocker와 일관). 관리자 화면에 유형×상태 요약 추가. 스모크 테스트 중 서브쿼리 컬럼명이 PL/pgSQL 변수와 겹쳐 나던 "ambiguous" 에러 발견·수정.
  - **9/N 완료**: 신규 예약 흐름 로컬 E2E(`e2e/r6-lesson-booking-flow.spec.ts`, 보호자 로그인→슬롯 클릭→예약 확정(원장 hold 확인)→outbox 확인→취소→원장 release 확인) 실브라우저 2회 연속 통과 + 전체 스위트 회귀 없음.
  - **10/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 9/N "완료" 보고에서 누락으로 지적한 실제 내부 배선을 mock/fixture 검증까지만 채웠다(실제 Google API 호출은 여전히 전부 미실행, `CALENDAR_SYNC_ALLOW_REAL_CALLS` 미설정 유지):
    - FreeBusy 사전 확인(`lib/booking/freebusy-check.ts`)을 `confirmLessonBooking()` 안에서 DB 확정(RPC) *직전*에 실제로 호출하도록 배선 — 조회 실패/미설정 시 예약을 막지 않고(`{checked:false}`), 확정 이후의 겹침은 기존 DB 배타 제약(`reservations_no_overlap`)이 최종 방어선.
    - Calendar 이벤트+Meet 생성(`syncOneReservationCalendarEvent()`)을 배치 워커뿐 아니라 `confirmLessonBooking()`/`createWeeklyLessonSeries()`/`cancelLessonBooking()` 실제 서버 흐름에서 즉시 호출하도록 배선(awaited-then-swallowed — 실패해도 예약 확정 응답 자체는 절대 막지 않음). 실패 시 reservations.google_sync_status만 `failed`/`reconciliation_needed`로 남고 예약·hold는 전혀 건드리지 않음(기존 원칙 유지) — claim 방식 낙관적 잠금(조건부 UPDATE)이 즉시 호출 경로와 배치 워커 양쪽 동시 호출을 안전하게 처리(재시도가 중복 외부 객체를 만들지 않음).
    - 보호자 동의 스냅샷(`sessions.smart_notes_status`) → Meet Space Smart Notes ON/OFF(`setMeetSpaceSmartNotesConfig()`)를 Calendar 동기화 성공 직후 best-effort로 연결(`applySmartNotesConfigBestEffort()`) — 이 설정이 실패해도 Calendar 동기화 자체는 `synced`로 처리.
    - Workspace Events(Pub/Sub push) 수신 웹훅(`app/api/webhooks/workspace-events/route.ts`) 신규 추가 — OIDC bearer token 검증(fail-closed), Smart Notes 생성 이벤트를 `reservations.google_meeting_code`로 세션에 연결해 신규 테이블 `smart_notes_generation_events`에 적재 + `sessions.smart_notes_drive_file_id` 갱신. **Drive 파일 이동·ACL 작업은 R8, 리뷰 생성·게시는 R9로 스코프 밖 유지(구현 안 함)** — 이번엔 이벤트 수신·연결까지만.
    - Meet 참가 기록 수집 파이프라인(`lib/google-meet.ts`의 `listConferenceParticipantEvents()` + 웹훅의 참가자 이벤트 분기) — `session_access_events`에 `source:"google_meet_api"`로 삽입해 ALTON 자체 접속 기록(source 다름)과 명확히 분리, **출석 확정·수업권 소진·정산은 절대 자동으로 하지 않음**(R7 범위 그대로 유지).
    - 학생/보호자 지각·노쇼 "신고" 제출 UI(`app/student/LessonBookingTab.tsx`의 "지난 수업 지각·노쇼 신고" 섹션, 최근 14일 이내 확정 세션 목록) + 서버 액션(`app/student/incident-report-actions.ts`, `app/parent/booking-actions.ts`의 `reportTeacherIssueForChild`, 세션이 실제로 그 자녀 것인지 `assertSessionBelongsToChild()`로 검증), 선생님 신고 UI(`app/teacher/ScheduleTab.tsx` 지난 수업 목록), 관리자 열람 화면(`app/admin/BookingReconciliationPanel.tsx`의 "지각·노쇼 신고" 섹션, `listRecentIncidentReports()`) 신규 추가. **최종 판정·수업권 소진·정산은 여전히 R7 범위 — 이 UI는 신고 원문 제출·열람만 한다.**
    - 위 전부 mock/fixture 유닛 테스트로 커버(신규 테스트 파일: `lib/google-meet.test.ts`, `lib/google-workspace-events.test.ts`, `app/api/webhooks/workspace-events/route.test.ts`, `lib/booking/freebusy-check.test.ts`, `app/student/LessonBookingTab.test.tsx`, `app/teacher/ScheduleTab.test.tsx`의 추가 케이스, `app/parent/booking-actions.test.ts`의 추가 케이스, `app/admin/BookingReconciliationPanel.test.tsx`의 추가 케이스) — **실제 Google API 호출은 이번 세션에서 단 한 번도 발생하지 않았다.**
    - R5 기존 결함 근본 원인 특정(제품 오너가 "그냥 R6 아님으로 넘기지 말라"고 명시 요구): `e2e/r5-subject-enrollment-flow.spec.ts`의 관리자 선생님 변경(같은 날짜 적용) 테스트가 결정론적으로 실패하던 원인은 `app/admin/SubjectEnrollmentPanel.tsx`의 `TeacherChangeForm` — "적용일" `<input type="date">`가 오늘 날짜를 고르면 `new Date(effectiveFromDate).toISOString()`이 UTC 자정이 되어, 방금 만든 최초 배정의 정밀 시각(`new Date().toISOString()`)보다 항상 이전이 되면서 `change_teacher_assignment()`의 `p_effective_from > 기존 effective_from` 가드에 매번 걸리는 버그(레이스 아님, 매번 100% 재현). 오늘 날짜를 고른 경우에만 "지금"으로 취급하도록 수정 — 영향 범위: R5 관리자 선생님 변경(같은 날 적용) 한 곳뿐, 사용자 영향은 "관리자가 오늘 날짜로 선생님을 변경하면 항상 실패"(관리자 전용 운영 기능, 학생/보호자/선생님 화면에는 영향 없음). 담당 단계는 R5(버그 발생 코드가 R5 범위) — 이번 세션에서 R6 작업과 함께 수정·검증 완료.
    - `material_version_id` 정책을 명문화(구현은 하지 않음, R9 이관 유지) — 상세는 아래 별도 절 참고.
  - **11/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 10/N 보고 이후 Calendar·Meet 소유 정책을 확정 지시했다(선생님 계정이 organizer, `official` 관리자는 통합 일정 화면에서 중앙 통제, Google 직접 변경 감지, FreeBusy scope 정정, Sandbox 객체 상한 재조정 등). 이번 세션에서 실제로 반영한 것:
    - **Calendar/Meet 소유 정책 확인·정정**: `createCalendarEventWithMeet()`가 이미 `teacherWorkspaceEmail`(담당 선생님)을 DWD subject로 써서 선생님 본인 캘린더에 생성하고, attendees를 추가하지 않으며 `sendUpdates=none`인 것을 재확인(코드 변경 불필요, R6 2/N부터 이미 이 정책과 일치). `docs/2026-08-29-product-architecture-v3.md`의 "성인 회사 관리 계정이 모든 Meet을 주최한다"는 옛 표현을 "담당 선생님의 회사 계정이 주최하고 ALTON 서버가 DWD로 중앙 통제한다"로 정정.
    - **DWD scope 불일치 발견·수정(코드 버그, 이번에 새로 발견)**: `lib/google-workspace-auth.ts`의 `CALENDAR_SCOPE`가 광범위한 `.../auth/calendar`를 요청하고 있었는데, Gate C가 실제로 DWD에 등록한 목록(`calendar.events`/`calendar.events.readonly`)에는 이 광범위한 scope가 없었다 — 지금까지 `CALENDAR_SYNC_ALLOW_REAL_CALLS`가 항상 false여서 발견되지 않았을 뿐, 실제 호출 시 전부 인가 실패였을 것이다. 이미 등록된 `calendar.events`로 좁혀 수정(외부 승인 불필요, 최소권한 원칙에도 부합). 같은 이유로 `lib/google-meet.ts`가 Calendar용 토큰을 재사용하던 것도 Meet 전용 scope(`meetings.space.settings`/`meetings.space.readonly`, Gate C에 이미 등록됨)로 분리하는 전용 토큰 함수(`getMeetSettingsApiAccessToken`/`getMeetReadonlyApiAccessToken`)를 추가해 수정.
    - **FreeBusy scope 정정**: `calendar.events.readonly` → `calendar.events.freebusy`로 변경, 이벤트 생성용 토큰과 완전히 분리된 전용 함수(`getFreeBusyApiAccessToken`)로 구현. 이 scope는 Gate C DWD 등록 목록에 없어 **실제 Admin Console 등록이 필요한 외부 설정 변경**으로 Sandbox 승인 요청서에 명시(아직 미등록, 미승인).
    - **Google 직접 변경 감지("외부 변경 감지")**: 신규 마이그레이션(`20261004000000_r6_external_change_detection.sql`)으로 `reservations.external_change_status`(`none`/`time_changed`/`deleted`/`meet_link_changed`) + `teacher_calendar_sync_state`(sync token 증분 동기화) 추가. `lib/google-calendar.ts`의 `listCalendarEventsIncremental()`(sync token 기반, 만료 시 전체 재동기화 폴백) + `lib/booking/external-change-detection.ts`의 `reconcileTeacherCalendarChanges()`(오케스트레이션, 8개 유닛 테스트)로 감지만 하고 예약·세션·수업권 hold는 절대 자동으로 바꾸지 않는다. `createCalendarEventWithMeet()`에 `extendedProperties.private.altonReservationId`를 추가해 ALTON이 만든 이벤트를 식별 가능하게 함. 관리자 확인 UI는 `app/admin/BookingReconciliationPanel.tsx`의 "Google 외부 변경 감지" 섹션으로 추가했으나 **"무시(오탐)" 처리만 실제로 연결**되고 "ALTON 시간 유지"/"Google 시간 반영"(재검증 후 확정)은 아직 미연결 — 명확히 표시해 UI가 하지 않는 일을 하는 것처럼 보이지 않게 함.
    - **관리자 통합 일정 화면(정책 #2)**: 데이터 계층(외부 변경 큐, 기존 `adminCreateLessonBooking()`/`adminCancelLessonBooking()`이 이미 전체 재검증 체인을 타는 것)은 준비됐지만, 정책이 요구하는 금주/주간/월간 캘린더 전환 UI는 이번 세션에서 만들지 않았다 — **명시적으로 UI 고도화 후속 작업으로 이관**(`docs/2026-08-29-master-roadmap-v3.md` R6 절 참고).
    - **학생/보호자 예약 UI 보완(정책 #3 일부)**: `LessonBookingTab.tsx`에 "빠른 추천 시간"(최근 3개 슬롯 강조)과 슬롯 선택 후 "예약 확인" 요약 카드(주간 반복이면 실제 생성 시도할 최대 8개 날짜를 미리 나열)를 추가해 "시간 선택 후 요약 확인을 거쳐 최종 확정" 요구를 충족. 월간 날짜 선택기(달력 그리드)는 만들지 않음 — 후속 작업으로 이관. 이 변경으로 `e2e/r6-lesson-booking-flow.spec.ts`가 슬롯 클릭 후 "최종 확정"을 한 번 더 눌러야 하도록 갱신됨(실제 브라우저로 재검증 완료).
    - 선생님 계정 정지 전 "미래 예약·미수집 Smart Notes 확인" 운영 게이트는 `docs/2026-08-29-master-roadmap-v3.md` R6 체크리스트에 필요 항목으로만 등록(미구현 — R6 마무리 또는 R8 착수 시).
    - Google Sandbox 외부 검증 승인 요청서(`docs/2026-09-02-r6-google-sandbox-verification-request.md`)를 정책 확정 내용(객체·시나리오 상한 재조정, Smart Notes 검증 참가자 확정, Workspace Events pull 전용 수신 방식, 외부 변경 승인 항목 분리 표시)에 맞춰 전면 개정(v2) — 아직 승인 전, 실제 호출 없음.
    - 검증: 신규/변경 테스트 전부 통과(`lib/google-calendar.test.ts`, `lib/google-meet.test.ts`, `lib/booking/external-change-detection.test.ts`[신규], `app/admin/BookingReconciliationPanel.test.tsx`), 전체 Vitest 771건 통과, `tsc --noEmit` 클린, 전체 Playwright(`--workers=1`) 재확인(결과는 이 세션의 최종 보고 참고). **실제 Google API 호출은 이번 11/N에서도 단 한 번도 발생하지 않았다** — 모든 플래그 미설정 유지.
  - **12/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 11/N 반영 후에도 남은 확정 요구사항(학생·보호자/선생님/관리자 캘린더 UI, Google 외부 변경 양방향 처리 실연결, DWD scope 문서 확인, Sandbox 요청서 통합)을 하나의 R6 마감 작업으로 지시. 실제로 구현한 것:
    - **학생·보호자 예약 화면**: `LessonBookingTab.tsx`에 월간 캘린더 날짜 선택기 + 선택일 시간 패널(`app/components/MonthCalendar.tsx` 신규 공용 컴포넌트) 추가, 빠른 추천 시간 유지. 슬롯 클릭은 바로 예약하지 않고 요약 확인 카드(단건/반복 구분, 반복은 실제 생성 시도 날짜 최대 8개 표시)를 거쳐야 최종 확정. "예정된 수업"에 목록/월간 보기 전환 추가(월간에서 날짜 클릭 시 그 날짜만 필터링). 보호자는 같은 컴포넌트를 자녀별로 재사용(`ParentShell.tsx`)해 자녀별 월간/목록 일정을 본다 — 다른 학생·선생님의 다른 수업 정보는 RLS로 이미 차단됨.
    - **선생님 일정 및 가능시간**: 신규 데이터 계층(`app/teacher/lesson-schedule-data.ts`, `lesson-schedule-actions.ts`) — 기존 `app/teacher/dashboard-data.ts`(legacy_sessions 기반, 교재/과제 기능 전용)와는 완전히 별개로, R6 v3 `sessions`/`reservations`에서 선생님 본인 확정 예약만 조회하도록 새로 만들었다(레거시 데이터와 섞이지 않도록 분리 확인 완료). 신규 "정규수업" 탭(`TeacherLessonScheduleTab.tsx`)이 금주 목록/주간/월간 전환 + 확정 수업·날짜별 휴무/임시 오픈 배지를 함께 표시. 기존 "일정" 탭은 "가능시간"으로 개명하고 `TeacherAvailabilityTab.tsx`를 월간 캘린더 기본 화면으로 재작성(반복 가능 시간=템플릿, 날짜별 예외는 달력 클릭으로 추가/삭제, 기간 휴무 일괄 등록, 지난달 예외 복사 지원). Google 외부 개인 일정을 "외부 일정·예약 불가"로만 표시하는 UI는 준비했으나, 실제 Google 조회·렌더링 연결은 Sandbox 승인 이후로 명시적으로 미룸(UI에 그 사실을 문구로 표시).
    - **관리자 통합 일정**: 신규 `UnifiedScheduleTab.tsx`("통합 일정" 탭) — `official` 관리자 계정에 선생님 개인 Google Calendar를 공유하지 않고, 새 서버 액션 `listAllTeacherLessons()`가 ALTON DB(v3 sessions/reservations)에서 전체 선생님 확정 예약을 중앙 조회. 오늘/주간/월간 전환 + 선생님·과목·동기화 상태 필터. 일정 변경·취소는 이 화면에서 직접 하지 않고 기존 "예약 운영" 탭으로 안내(그 탭이 이미 전체 재검증 체인을 태움).
    - **Google 외부 변경 양방향 처리 실연결**: 신규 마이그레이션(`20261005000000_r6_external_change_resolution.sql`)이 `reservation_reschedules`(append-only 감사 이력 테이블) + `reschedule_reservation_to_google_time()`(가용성·버퍼·중복예약·수업권 재검증 후 DB를 Google 시간으로 갱신, exclusion 제약이 중복예약을 자동 차단) + `record_reservation_restored_to_alton_time()`(감사 이력만) SQL 함수를 추가. 앱 레이어(`lib/booking/external-change-resolution.ts`)가 "Google 시간 반영"(재검증 RPC 호출) / "ALTON 시간 유지"(`patchCalendarEventTime()`으로 Google 이벤트 복원 후 감사 기록)를 각각 실제로 수행하고, 관리자 UI(`BookingReconciliationPanel.tsx`)의 두 버튼이 이제 실제로 연결됨(이전엔 "아직 연결 안 됨" 안내만 있었음). `deleted` 상태에는 이 두 버튼을 노출하지 않음(이벤트 자체가 없어 시간 조정이 무의미 — 무시 또는 정식 취소만 가능).
    - **DWD scope 재확인(문서 기준, 실제 API 호출 없음)**: Gate C 인프라 로그에 기록된 등록 목록과 현재 코드가 요청하는 scope를 대조 — `calendar.events`/`meetings.space.settings`/`meetings.space.readonly`는 문서상 이미 등록됨(코드도 이미 그 scope로 좁혀져 있음), `calendar.events.freebusy`만 문서상 미등록으로 실제 Admin Console 등록이 필요함을 확인. 이 대조는 문서 열람만으로 수행했고 어떤 실제 Google API도 호출하지 않았다.
    - **Sandbox 요청서 통합(v3)**: `docs/2026-09-02-r6-google-sandbox-verification-request.md`를 위 전부를 반영해 한 번 더 개정 — 기존 Pub/Sub pull 구독과 신규 Workspace Events 구독을 별개 객체로 명시, Smart Notes 실회의 시간 상한 15분, Google 시간 변경/삭제 감지 후 "관리자 확인 필요" 상태와 양방향 처리 결과가 사이트·Google 양쪽에 반영되는 시나리오를 검증 절차에 포함, 외부 변경 승인 항목을 표로 분리. 아직 제출·승인 전, 실제 호출 없음.
    - 검증: 신규 컴포넌트(`MonthCalendar`, `TeacherLessonScheduleTab`, `TeacherAvailabilityTab`, `UnifiedScheduleTab`)와 신규 로직(`lib/booking/external-change-resolution.ts`, `lib/calendar-date-utils.ts`) 전부 mock 유닛 테스트로 커버, 기존 테스트(TeacherShell/AdminShell 사이드바 개수, r6-lesson-booking-flow E2E의 요약 확인 카드 클릭 단계) 갱신·재검증 완료. 전체 Vitest 801건 이상 통과(최종 수치는 이 세션 마지막 실행 기준), `tsc --noEmit` 클린. **실제 Google API 호출은 이번 12/N에서도 단 한 번도 발생하지 않았다** — 모든 플래그 미설정 유지.
  - **13/N 완료(2026-09-02, 이번 세션)** — 제품 오너가 12/N 이후에도 확정 정책과 Sandbox 요청서가 3가지 일치하지 않는다고 보정 지시(새 범위 아님, R6 마감 보정):
    - **선생님 Google 외부 일정 표시 실제 구현**: `lib/booking/external-busy.ts` + `TeacherLessonScheduleTab.tsx`/`TeacherAvailabilityTab.tsx`에 밑줄 표시+"외부 일정(예약 불가)" 칩으로 렌더링(FreeBusy는 구조적으로 제목·내용·참석자를 반환하지 않음). 본인만 조회 가능, 보호자·학생·다른 선생님에게는 노출 경로 없음. 실제 Google 호출은 여전히 Sandbox 승인 대기, mock 테스트만.
    - **Google 이벤트 삭제 시 "무시" 제거**: `20261006000000_r6_external_change_deletion_resolution.sql`(RPC가 `deleted` 상태의 `dismissed`를 명시적으로 거부) + `recreateCalendarEventAfterDeletion()`("ALTON 일정 유지" — 재생성)와 `resolveExternalChangeCancelDueToDeletion()`("예약 취소" — 정식 절차) 실연결, `reservation_reschedules`에 `google_event_deleted_recreated` 감사 이력 추가. 관리자 UI는 이 상태에서 두 버튼만 보여줌.
    - **Sandbox 요청서 v4**: "부분 실행 가능" 문구 전부 삭제, DWD scope를 "문서상 등록 예상/추가 필요/시작 전 실제 확인 필요(전 항목)" 3범주로 재구성하고 실제 확인이 다르면 API 호출 없이 문서만 갱신·재보고하도록 명시, 외부 일정 렌더링·삭제 양자택일을 통합 시나리오에 포함.
    - **선생님 계정 정지 게이트를 R6 blocker에서 완전히 제외**하고 R12+정식 오픈 전 체크리스트로 이관(R8 Smart Notes 이동과의 의존관계 명시).
    - 검증: 전체 Vitest 812건, `tsc --noEmit` 클린. **실제 Google API 호출 0건**, 모든 플래그 미설정 유지.
  - **14/N 완료(2026-09-02, 이번 세션, 문서만 정정 — 코드 변경 없음)** — 제품 오너가 승인 전 Sandbox 요청서 v4의 객체 범위·Smart Notes 정리 방식만 정정 지시. v5로 개정: (1) §3을 "동시 존재 최대 4개(E1~E4) / 누적 생성 최대 5개(재생성분 E3′ 포함) / Meet space 누적 최대 4개"로 정정하고, 어느 예약을 어떤 순서로 재사용해 시간 변경·삭제 후 재생성·삭제 후 정식 취소를 모두 검증할지 명시(추가 테스트 예약 없음). (2) Smart Notes 증적을 Shared Drive로 이동·보존하는 선택지 삭제(R8 범위) — 식별정보만 기록하고 합성 파일은 선생님 Sandbox Drive에서 정리(삭제)하는 것으로 고정, 외부 변경 목록에도 명시.
  - **15/N 완료(2026-09-03, 이번 세션) — 실제 Google Sandbox 통합 검증 및 Calendly/Zoom 제거 완료.** 제품 오너 승인(v5 범위 전체, DWD scope 실제 확인 후 일괄 실행)에 따라 `gate-c-automation@...`에 임시 `environment:development` WIF IAM binding을 좁게 추가(Production 바인딩 불변)하고, `teacher1@alton.education` 실제 계정으로 로컬 dev 환경에서 실제 Google API를 호출해 검증했다. **실제 결과**: Calendar/Meet 생성·수정·삭제(E1~E4), FreeBusy 충돌·외부 바쁨 블록, Google 시간 변경 양방향(반영/유지), Google 삭제 후 재생성/정식 취소, Smart Notes 실회의(약 19분) 생성·연결, Workspace Events 구독·Pub/Sub 실제 수신, Meet 참가자 기록 조회까지 전부 실측 통과. **실제 버그 3건 발견·수정**: (1) 멱등 재요청이 자기 자신이 만든 Calendar 이벤트와 FreeBusy 충돌 오탐(`lib/booking/create-booking.ts`), (2) `privateExtendedProperty` 와일드카드 미지원으로 외부 변경 감지가 항상 무동작(`lib/google-calendar.ts`, `lib/booking/external-change-detection.ts`), (3) Workspace Events 실제 페이로드는 이벤트 타입이 본문이 아니라 Pub/Sub 메시지의 `ce-type` 속성에 있고 Smart Notes 본문엔 `smartNote.name`만 있어 Drive 파일 ID·meetingCode를 추가 API 호출로 채워야 함(`lib/google-workspace-events.ts`, `app/api/webhooks/workspace-events/route.ts`, `lib/google-meet.ts`) — meetingCode/driveFileId 해석은 도메인 위임 관리자(official@alton.education) subject로 조직 내 임의 회의를 조회할 수 있음을 실측 확인해 해결. **미해결 외부 gap(코드로 해결 불가, 비차단)**: Meet Space `smartNotesConfig` PATCH가 `meetings.space.settings` scope로도 일관되게 403 — Google Admin Console DWD 등록 확인이 추가로 필요(보호자 Smart Notes 거부 옵트아웃이 API로는 실제로 적용되지 않음, 신고 대상). 검증 후 정해진 순서대로 정리 완료: 생성했던 Calendar 이벤트 전부 삭제, Workspace Events 구독 삭제, 합성 Smart Notes Google Doc 삭제, 테스트 fixture DB row 전부 삭제(`teachers.workspace_email` 원복 포함), `/tmp` 임시 스크립트·자격증명 삭제, 마지막으로 임시 IAM binding 제거 후 `get-iam-policy` 재조회로 Production 바인딩만 남았음을 확인. 이 통합 검증이 실제로 전부 통과해 **Calendly/Zoom 완전 제거**를 진행: `CalendlyWidget.tsx`/`app/api/webhooks/calendly/*`/`scripts/register-calendly-webhook.mjs`/`app/student/booking-data.ts` 삭제, `teachers.calendly_scheduling_url`/`legacy_sessions.calendly_event_uri` 컬럼 삭제(`20261007000000_r6_remove_calendly_zoom_lesson_booking.sql`), 관련 env var(`CALENDLY_*`) 제거, 세션뷰 "Zoom 연결됨" 배지를 "Google Meet 연결됨"으로 변경. **상담(consult_requests) 예약 Calendly는 이번 제거 범위가 아니다** — 애초에 R6 스펙 밖이고 `ConsultForm`/`submitConsultRequest`로 Calendly 없이 독립적으로 동작해왔으므로 랜딩페이지는 이제 항상 `ConsultForm`을 쓰고, `consult_requests.calendly_event_uri` 컬럼은 보존(이관하지 않음, 그냥 미사용 컬럼으로 남음). 전체 회귀(Vitest 809건, tsc, `npm run build`) 전부 통과. Production/원격 dev DB/Stripe Production 접근 없음, 모든 Google 관련 플래그 세션 종료 시 기본값(false/미설정) 유지.

### M1 — 상담 기반 재설계, 코드 구현 완료·**조건부 승인, push 대기**(2026-09-03)

**다음 실행 순서**가 `M0 R6 마감(완료) → M1 상담·체험 기반 재설계 → M2 → M3 → M4 → M5 기존 R7 착수`이던 것 중
**M1의 코드·DB·로컬 검증을 완료**했다 — 제품 오너가 **조건부 승인**했고(2026-09-03, 4개 항목
보완 지시 후 승인), 그 보완도 같은 세션에서 완료했다. **push는 여전히 하지 않았다**(로컬
커밋 5개: `6f978db`→`d8862bb`→`1feb800`→`ca7b187`→최신, 실제 커밋 해시는 `git log` 참고).
상세는 `docs/2026-09-03-m1-migration-execution-log.md`, 인수 기준 체크박스는
`master-roadmap-v3.md` "근접 실행계획" M1 절 참고.

- **DB**: `supabase/migrations/20261009000000_m1_consultation_unification.sql` — 신규
  `prospect_contacts`(비로그인 잠재고객, Auth 계정 미생성), `consult_consent_versions`(동의
  문구 버전형 인터페이스, placeholder 1건 삽입), `consult_availability_rules`/
  `consult_availability_exceptions`(공용 상담 가능시간, 특정 담당자 비귀속), `consult_consent_tokens`
  (동의 확인용 만료형 토큰 — 해시만 저장), 기존 `consultations`에 `prospect_contact_id`/`source`/
  `hold_expires_at`(더 이상 값이 채워지지 않음, 아래 참고)/`starts_at`/`ends_at`/`google_*`/
  `google_meeting_code`/`smart_notes_*`/`consent_*`/`outcome*`/`confirmation_email_*` 컬럼 추가,
  `consultation_status_events`(INSERT-only 감사 이력), `submit_homepage_consult_request()`/
  `admin_accept_consultation()`/`admin_reject_consultation()`/`admin_reschedule_consultation()`/
  `admin_cancel_consultation()`/`admin_record_consultation_outcome()`(readiness 게이트 포함, 아래
  참고)/`list_open_consult_slots()`/`issue_consult_consent_token()`/`resolve_consult_consent_token()`/
  `confirm_consult_consent_by_token()` SECURITY DEFINER 함수, `smart_notes_generation_events`에
  `consultation_id`/`pubsub_message_id` 컬럼 추가(R6 웹훅 재사용, 아래 참고). 레거시
  `consult_requests`는 동결 보존(rename/삭제 없음, R3와 동일 방침).
- **hold 정책(2026-09-03 정정)**: 최초 구현의 30분 자동 만료는 "고객에게 아무 알림 없이
  신청이 무효화되는" 별도 설계가 필요한 결정이라는 지적에 따라 **제거**했다 — `requested`
  상담은 관리자가 수락/거절하기 전까지 슬롯을 계속 점유한다. now() 의존 없는 IMMUTABLE
  조건만 허용되는 Postgres 배타 제약 제약 덕분에 오히려 더 단순해졌다: `consultations_no_overlap`
  배타 제약이 `requested`/`scheduled` 둘 다 직접 하드 차단(앱 레벨 `SELECT ... FOR UPDATE`는
  더 친절한 에러 메시지용 이중 방어일 뿐). 비로그인 신청 남용 방지는 "동일 이메일당 처리
  대기 중인 신청 1건 제한"으로 대체(UX 변경 없음).
- **Smart Notes readiness 게이트 — 진행/완료 2단계 분리(2026-09-03 추가, 조건부 승인
  보완으로 재정의)**: "상담 진행 가능"(동의 확인 + Smart Notes ON)과 "상담 완료 가능"(그
  위에 Smart Notes 원본 자동 연결 + 비어있지 않은 관리자 검토 요약)은 서로 다른 시점의
  서로 다른 기준이라 더 이상 하나로 묶지 않는다. `official@alton.education` 조직 차원 Smart
  Notes 정책이 이미 켜져 있으면 그것으로 충분(`ensureMeetSpaceSmartNotesOn()`이 GET으로 먼저
  확인, ON이 아닐 때만 기존 canonical PATCH로 보정) — 확인·보정 실패는 확정 이메일 발송을
  막지 않는다. `admin_record_consultation_outcome()`이 **서버에서 4개 조건 전부**(①
  `consent_confirmed_at` 존재, ② `smart_notes_config_status='applied'`, ③
  `smart_notes_drive_file_id` 존재, ④ `admin_review_summary`가 공백 아닌 값)를 강제하고
  하나라도 미충족이면 `completed` 전이·outcome 기록을 전부 거부한다(부분 허용 없음).
  관리자 화면(`ConsultationSchedulingPanel.tsx`)에 `consultReadiness`(진행 가능 여부)와
  `completionReadiness`(완료 가능 여부)를 별도로 표시하고, 완료 불가 사유별(동의/Smart
  Notes ON/원본 미연결/요약 누락) 안내와 수동 재처리 버튼을 제공.
- **Smart Notes 원본 자동 연결(2026-09-03 추가, 실제 구현)**: 새 웹훅을 만들지 않고 기존 R6
  Workspace Events 웹훅(`app/api/webhooks/workspace-events/route.ts`)의 매칭 대상만 넓혔다 —
  세션 매칭 실패 시 `consultations.google_meeting_code`로 상담도 시도, 매칭되면
  `consultations.smart_notes_drive_file_id` 갱신(잠재고객에게는 노출 경로 없음, 관리자 전용).
  Pub/Sub `messageId` 기반 멱등(재전송 시 중복 행 생성 안 함), 매칭 실패는 유실시키지 않고
  `linked=false`로 보존. **재처리 경로 신규 추가**: `reprocessUnlinkedSmartNotesEvents()`
  (`lib/consultation/calendar-sync.ts`)가 매칭 실패로 남은 이벤트를(대개 웹훅이 상담의
  `google_meeting_code` 저장 전에 먼저 도착하는 레이스) 다시 매칭 시도 — 관리자 화면 "Smart
  Notes 미매칭 재처리" 버튼으로 실행.
- **동의 확인 토큰화(2026-09-03 정정)**: 상담 UUID를 URL에 노출하지 않는다 — 확인 이메일마다
  새 만료형 토큰(SHA-256 해시만 DB 저장, 원문은 발송 시점에만 메모리에 존재)을 발급하고,
  `/consult/[id]/consent` → `/consult/consent?token=...`로 라우트 변경. 위조/재사용/다른 상담
  확인은 해시 불일치로 차단, 동일 토큰 재확인은 멱등(반복 체크 없음 요구사항과 일치).
- **이메일 신뢰성(2026-09-03 추가)**: 링크는 `currentRequestOrigin()`(R4 UAT에서 확립된 패턴)
  기반 절대 URL로 발송(기존 상대경로 버그 수정). `confirmation_email_content_hash`(시간+Meet
  링크 sha256)로 재처리 시 동일 내용 중복 발송을 막고, 시간 변경 등으로 내용이 실제로 바뀌면
  새로 발송.
- **앱 레이어**: `app/consult-actions.ts`(홈페이지 신청·슬롯 조회·토큰 기반 동의 확인),
  `app/admin/consultation-scheduling-actions.ts`(수락/거절/시간변경/취소/결과기록/readiness/
  가용성 관리), `lib/consultation/calendar-sync.ts`(R6 `lib/google-calendar.ts`/
  `lib/google-workspace-auth.ts`/`lib/google-meet.ts` 재사용, subject를 담당 선생님 대신
  `official@alton.education`으로 교체 — `CALENDAR_SYNC_ALLOW_REAL_CALLS` 기본 false 그대로
  재사용, 이번 세션에서 실제 Google API 호출 0건), `app/admin/ConsultationSchedulingPanel.tsx`
  (관리자 "상담 운영" 탭), `app/ConsultForm.tsx`(슬롯 선택), `/consult/consent`(동의 확인
  페이지, placeholder 문구 노출).
- **동의 placeholder**: `consult_consent_versions`에 `is_placeholder=true`인 1개 버전만 존재.
  최종 법률 문구는 별도 계약 문서 세션 확정 후 신규 버전을 삽입해야 한다 — 이 문구로 실제
  법적 동의를 받았다고 취급하지 않는다(문서 의존성으로 명시). **placeholder로 수집된 확인은
  법적 동의가 아니다 — 이 사실은 코드·이메일·확인 화면 어디에도 실제 법적 효력이 있는
  것처럼 표시하지 않는다.**
- **검증**: 로컬 `supabase db reset --local` 반영, 전체 Vitest 817건 통과, `tsc --noEmit`·
  `next build` 클린, 전체 Playwright 52건(`--workers=1`, M1 E2E 포함) 통과. **저장소 무결성**:
  `6f978db`가 당시 미커밋 R6 파일(`lib/google-meet.ts` 등)에 의존해 단독으로는 빌드되지 않던
  문제를 발견해 R6 잔여분을 `d8862bb`로 별도 커밋(M1과 R6 변경을 섞지 않음) — 이후 커밋된
  파일만 있는 별도 임시 `git worktree`에서 `next build`+전체 Vitest를 재실행해 실제로 통과함을
  확인. hold/readiness/토큰 발급·소비 멱등성은 로컬 psql 직접 호출로도 실측 확인.
  **검증 중 실제 버그 다수 발견·수정**: `list_open_consult_slots()`가 규칙의 `start_time` 슬롯
  하나만 만들던 버그(전체 시간창 60분 단위로 수정), 겹치는 규칙의 슬롯 중복 반환(`DISTINCT`
  추가, React key 중복 경고로 발견), 확인 이메일의 상대경로 URL, `admin_reject_consultation()`/
  `admin_cancel_consultation()`이 기존 R3 관례(`status='cancelled'`)와 다르게 `status='closed'`를
  쓰던 불일치(기존 관례로 통일).
- **미완료(스펙상 의도적으로 M2~M4로 이관, 이번 범위 아님)**: 기존 로그인 보호자·학생·선생님이
  보내는 상담 요청 유형 UI/구분 로직("신규 보호자 홈페이지 흐름 우선 완성" 원칙),
  `prospect_contacts.converted_guardian_id` 실제 연결 로직(M4).

### M1 — Google Sandbox 실측 결과 + 최종 통합 보완(2026-09-03, 같은 날 후속 세션)

**제품 오너가 이 세션 중 직접** M1 Sandbox 요청서(v1) 범위로 실제 Google Sandbox 통합 검증을
실행했다(Claude 세션은 실제 외부 호출을 하지 않음 — 원칙적으로 실제 외부 호출은 사용자가
채팅에서 직접 확인해야만 진행하는 정책, 아래 "안전 경계" 참고). **실측 결과**: `official@
alton.education` 소유 Calendar 이벤트+Meet 생성, 확인 이메일(`matchbox512@snu.ac.kr`로만
발송, 실제 2통), 동의 토큰 확인까지는 전부 실제로 확인됐으나, **Workspace Events 구독을
실제로 만드는 코드가 아예 없어서 Smart Notes 원본 자동 연결이 통과하지 못했다** — 이 공백을
이번 후속 세션에서 해결했다(아래 신규 항목). 이 실측에 쓰인 실제 Gmail SMTP 앱 비밀번호(
`official@alton.education` 계정, Vercel Production에 이미 등록된 것과 동일 값)는 검증 직후
`.env.local`에서 완전히 제거됐다고 보고됐다 — 이 세션에서 저장소 전체(추적 파일, 테스트
결과물, `scripts/m1-sandbox-verification.sh`)와 `.env.local` 현재 상태를 직접 점검해 평문
자격증명이 전혀 남아있지 않음을 확인했다(`SMTP_PASS` 현재 길이 0, `.env.local`은
`.gitignore`로 커밋 대상에서 제외됨 확인). 임의 회전은 하지 않았다 — 노출 범위가 로컬 개발
환경 한정으로 보이고 즉시 제거됐다는 보고가 있어 강제 회전이 필요하다고 판단하지 않았지만,
최종 판단은 제품 오너 몫으로 남긴다.

이번 후속 세션에서 실제로 구현·검증(전부 mock/로컬, 실제 Google API 호출 0건)한 것:

- **Workspace Events 구독 수명주기(M1/R6 공통 blocker, 신규 해결)**: `workspace_events_
  subscriptions` 테이블(`20261010000000_m1_workspace_events_subscriptions.sql`) +
  `lib/google-workspace-events-subscriptions.ts`(구독 생성·조회·갱신·삭제 API 클라이언트,
  `CALENDAR_SYNC_ALLOW_REAL_CALLS` 게이트 재사용) + `lib/workspace-events/subscription-
  lifecycle.ts`(`ensureSubscriptionForOrganizer()` — organizer당 최대 1개 유지, 만료 임박
  갱신, 만료/오류 시 재생성, `disabled`는 자동 재활성화 안 함; `reconcileMissedSmartNotes
  Events()` — 구독 장애·이벤트 유실 대비 Meet API 사후 대조, 실패해도 상담·수업을 자동
  완료 처리하지 않음). 상담 확정(`lib/consultation/calendar-sync.ts`)과 정규수업 확정
  (`lib/booking/calendar-sync.ts`) 양쪽에서 Calendar 동기화 성공 직후 best-effort로 호출.
  관리자 화면에 구독 상태·수동 갱신·수동 사후 대조 버튼 추가(`app/admin/workspace-events-
  actions.ts`, `ConsultationSchedulingPanel.tsx`).
- **Calendar 네이티브 초대로 정책 전환(제품 정책 확정)**: `lib/google-calendar.ts`의
  `createCalendarEventWithMeet`/`patchCalendarEventTime`/`deleteCalendarEvent`에
  `attendeeEmail`/`sendUpdates`/guest 제한 3종(`guestsCanInviteOthers`/`guestsCanModify`/
  `guestsCanSeeOtherGuests` 항상 false)을 추가 — 호출부가 `sendUpdates`를 명시하도록 강제.
  **상담**: `official@alton.education`이 organizer, 신청 이메일이 유일한 attendee,
  `sendUpdates="all"`(생성·시간변경·취소 전부), 이벤트 설명에 AI Smart Notes 안내+동의
  토큰 링크. **정규수업**: 담당 선생님 회사 계정이 organizer, 학생의 검증된(이메일 존재+
  `email_confirmed_at` not null) 계정 이메일이 attendee — 보호자는 attendee로 추가하지
  않음(R6의 "attendees 없음+sendUpdates=none" 정책 폐기). 학생 이메일 미검증은 조용히
  무시하지 않고 예외를 던져 기존 `failed`/`reconciliation_needed` 재처리 경로로 노출(관리자
  조치 필요 상태). Calendar 초대가 성공하면 기존 커스텀 SMTP 확인 메일은 중복 발송하지
  않고, 재시도 한도까지 반복 실패한 경우에만 fallback 이메일 1통을 보낸다(요구사항 6).
  거절 알림은 여전히 ALTON 커스텀 이메일 경로(`lib/consultation/notifications.ts`).
- **Smart Notes 외부 공개 통제(정책+기존 구조 재확인, 신규 API 강제 코드 없음)**: Google
  Meet API가 공유 대상(host/co-host 전용)을 직접 설정하는 기능을 제공하지 않아, 이 통제는
  Workspace 관리자 기본 설정 + 앱 레벨 접근 통제(원본 `smart_notes_drive_file_id`는 관리자
  전용 select 경로에서만 노출, 잠재고객에게 노출되는 화면 전무 — 기존 구조 그대로 유지)로만
  담당한다. 외부 attendee가 Google에서 원본 접근 이메일/Drive 권한을 실제로 받는지는
  다음 Sandbox 요청서(v2, `docs/2026-09-03-m1-google-sandbox-verification-request-v2.md`)의
  검증 항목으로만 추가했다 — 이번엔 실제 호출 없음. 만약 다음 검증에서 원본 접근이 실제로
  확인되면 공유 범위를 확대하지 않고 즉시 중단해 정책 blocker로 보고하기로 문서화해뒀다.
- **관리자 UX**: "시간 변경"/"상담 결과 기록"의 `window.prompt()`를 인라인 폼으로 교체
  (`ConsultationSchedulingPanel.tsx`). Calendar 동기화 상태 문구를 "Calendar 초대 발송
  대기/발송됨/실패(재시도 중)/실패 — 관리자 확인 필요(이메일로 대체 안내됨)"로 세분화해
  Workspace Events 구독 장애·Smart Notes 설정 실패·원본 미연결과 서로 다른 상태로 구분
  표시. 기존 4조건 완료 게이트는 그대로 유지.
- **검증**: 로컬 psql로 hold/readiness 게이트 재확인, 신규 유닛 테스트(`google-workspace-
  events-subscriptions` 오케스트레이션 9건, Calendar attendee/guest 제한 1건, 학생 이메일
  미검증 차단 1건 등) 포함 전체 Vitest 832건, `tsc --noEmit`·`next build` 클린, 전체
  Playwright 52건(`--workers=1`) 중 51건 통과(1건은 이 작업과 무관한 기존 R4 동시성
  테스트의 알려진 플레이키니스 — 단독 재실행 시 즉시 통과, 회귀 아님을 재확인).
### M1 — 역할별 Calendar 상태 표시 + 검증 스크립트/요청서 v2 정정(2026-09-03, 같은 날 세 번째 후속)

**이 절이 끝난 시점에만 M1 로컬 구현을 완료로 표시한다.** 위 두 절(코드 구현, Sandbox
실측 결과+구독 수명주기)에 이어 마지막 잔여 항목을 마감했다:

- **역할별 Calendar 상태 표시**: 학생·보호자(같은 `LessonBookingTab.tsx`를 자녀별로
  재사용)·선생님(`TeacherLessonScheduleTab.tsx`) 예약 화면은 이미 R6부터
  `google_sync_status` 기반 상태 배지를 갖고 있었다 — 이번엔 그 문구를 Calendar 네이티브
  초대 정책에 맞게 정정했다: 학생 화면은 "Calendar 초대 발송 준비 중/완료/재시도 중/실패
  — 관리자 조치 중", 선생님 화면은 "내 Calendar에 일정 생성 준비 중/생성됨(학생 초대
  발송)/재시도 중/실패 — 관리자 조치 중". 보호자는 학생과 동일 컴포넌트를 자녀별로 읽기
  전용에 가깝게 재사용하며 attendee라는 표현은 어디에도 쓰지 않는다(자녀 이름과 상태만
  표시). 내부 Google 오류 원문·개인정보는 이 세 화면 어디에도 노출하지 않는다(원문은
  관리자 전용 `google_sync_last_error`/`google_sync_error` 컬럼에만 남고, 학생/보호자/
  선생님 화면은 고정된 한국어 라벨만 매핑해서 보여준다 — 코드 리뷰로 확인).
- **Sandbox 검증 스크립트 v2 갱신**: `scripts/m1-sandbox-verification.sh`를 v2 절차로
  다시 썼다 — attendee(상담 신청자=정규수업 테스트 학생=`matchbox512@snu.ac.kr` 계정
  하나로 통일), `sendUpdates=all`, guest 제한 3종, Workspace Events 구독 생성·갱신·삭제,
  자동 연결, 외부 attendee의 Smart Notes 원본 접근 차단 확인을 전부 포함. v1 전용 절차
  (attendee 없는 이벤트 생성, fallback 이메일을 의도적으로 유도하는 절차)는 제거했다.
  파일에 비밀값은 여전히 없다(이전에도 없었음, 재확인) — 모든 자격증명은 실행자가 그때
  셸/`.env.local`에 직접 넣고 검증 종료 즉시 빼는 것을 전제로 한다.
- **Sandbox 요청서 v2 정정**: `docs/2026-09-03-m1-google-sandbox-verification-request-v2.md`
  §2·§3·§5를 수정 — attendee 테스트 계정을 2개에서 **`matchbox512@snu.ac.kr` 1개로
  통일**(역할 검증을 위해 계정을 늘리지 않음), 상담·수업 이벤트 각 최대 1개·구독
  organizer당 최대 1개 상한은 그대로 유지, 커스텀 SMTP fallback은 이 검증에서 의도적으로
  실패를 유도해 발송시키지 않는다고 명시. 외부 attendee의 Smart Notes 원본 접근 차단
  확인 절차는 그대로 유지. 실제 외부 호출은 여전히 이 문서만으로는 실행되지 않는다 —
  별도 승인 후에만.
- **SMTP 자격증명 회전 절차 문서화(실행 아님)**: 신규
  `docs/2026-09-03-smtp-credential-rotation-procedure.md` — 새 앱 비밀번호 생성 → Vercel
  Production 값 교체 → 통제된 테스트(팀 내부 주소로 기존 발송 경로 1건 실행) → 기존
  비밀번호 폐기 순서의 무중단 절차만 정의했다. 이번 세션은 앱 비밀번호를 새로 만들지도,
  Vercel Production 값을 바꾸지도, 기존 비밀번호를 폐기하지도 않았다 — 실제 회전은 제품
  오너의 별도 명시적 승인 후에만 실행한다.
- **검증**: 라벨 변경 3곳(`app/student/LessonBookingTab.tsx`, `app/teacher/
  TeacherLessonScheduleTab.tsx` — 보호자는 학생 컴포넌트 재사용이라 별도 변경 없음) 반영 후
  `tsc --noEmit` 클린 재확인, 관련 테스트에 하드코딩된 구 라벨 문자열 참조 없음을 grep으로
  확인(테스트 깨짐 없음).
- **미완료**: 실제 Google Sandbox 재검증(v2, 구독 생성 포함) — 요청서·스크립트 작성만
  완료, 승인·실행 대기. SMTP 자격증명 실제 회전 — 절차만 문서화, 실행 대기.
- **외부 변경(이번 세 번째 후속 세션 자체)**: Claude 세션이 실행한 실제 Google API 호출,
  실제 이메일 발송, Production/원격 DB 접근, IAM·Vercel 설정 변경 전부 0건.
  `CALENDAR_SYNC_ALLOW_REAL_CALLS` 등 모든 플래그 기본값(false/미설정) 유지. `git push`
  하지 않음 — 로컬 커밋만 존재.

### M1/R6 — Workspace Events 구독 모델 정정(2026-09-03, 같은 날 네 번째 후속) — **코드+mock 완료, 실측 재검증 대기**

앞선 구독 수명주기 구현(위 절)의 target resource·Pub/Sub 연결 구성이 **실제 Google API
요구사항과 맞지 않는 근본 오류**였음이 드러나 이번 세션에서 정정했다. R6가 과거(15/N)
실제 Sandbox로 검증했던 것은 **Calendar/Meet 이벤트 생성·FreeBusy·Smart Notes 자동
생성·Workspace Events "수신"**(웹훅이 실제로 도착하는지)이었고, 이번에 발견된 문제는
그것과 다른 대상 — **구독을 실제로 만드는 요청 자체**의 target resource·notification
endpoint 형식이다. 즉 R6 15/N의 "구독·Pub/Sub 실제 수신 성공" 기록과 이번 실패는 서로
다른 것을 가리킨다(과거: 기존에 이미 존재하던 pull 구독으로 메시지를 pull해서 확인 —
구독을 새로 만드는 API 호출 자체는 검증한 적이 없었다). 충돌이 아니라 서로 다른 범위의
기록이다.

- **정정 1 — target resource**: `//meet.googleapis.com/workspaces/{email}/spaces/-`
  (존재하지 않는 형식, organizer 이메일을 리소스 이름에 직접 사용)를 제거하고
  `//cloudidentity.googleapis.com/users/{USER}`로 교체 — `{USER}`는 Directory API
  (`lib/google-workspace-directory-readonly.ts`의 `getWorkspaceUserByEmail()`, 기존
  R2 Task 7 자산 재사용)가 반환하는 불변 사용자 ID. `workspace_events_subscriptions.
  organizer_workspace_user_id` 컬럼(`20261011000000_...sql`)에 최초 조회 시 캐시해
  재사용 — 매 구독 생성마다 Directory API를 다시 호출하지 않는다. organizer 전체
  회의를 구독하는 제품 구조 자체는 그대로 유지(사용자 단위 구독). **사용자 단위 구독이
  실제로 거부되는지는 mock으로 확정할 수 없다** — 거부되면 canonical Meet space 단위로
  전환해야 하는데, 그 최종 판단은 아래 실측 재검증에서만 가능하다(`decision_required`
  로 남김, 이번 세션에서 코드를 추측만으로 더 바꾸지 않았다).
- **정정 2 — Pub/Sub 연결**: `notificationEndpoint.pubsubTopic`에 웹훅 HTTP URL을
  그대로 넣던 임시 fallback(`WORKSPACE_EVENTS_PUBSUB_TOPIC` 미설정 시
  `NEXT_PUBLIC_SITE_URL` 기반 URL로 대체)을 완전히 제거했다. 이제
  `WORKSPACE_EVENTS_PUBSUB_TOPIC`이 `projects/{project}/topics/{topic}` 형식이
  아니면(없음 포함) 실제 API를 호출하기 전에 즉시 fail-closed로 실패한다
  (`lib/google-workspace-events-subscriptions.ts`의 `assertValidPubsubTopic()`).
  웹훅 URL(`app/api/webhooks/workspace-events`)은 이 토픽에 대한 별도 Pub/Sub push
  subscription의 endpoint로 GCP 콘솔에서 연결하는 것이지 이 코드가 만드는 값이 아니라는
  것을 코드 주석·문서 양쪽에서 개념적으로 분리했다.
- **정정 3 — 전달 경로 문서화**(실제 gcloud 설정은 실측 재검증에서 사람이 직접 실행):
  `scripts/m1-sandbox-verification.sh`에 STEP 0.5(Pub/Sub 토픽 생성 → Workspace Events
  발행 서비스 계정에 `roles/pubsub.publisher` 부여 → 그 토픽에 push subscription 생성,
  push endpoint=웹훅 URL) 신규 추가. 발행 서비스 계정의 정확한 이름은 GCP 콘솔에서
  실행 직전 확인하도록 명시(추정값을 코드/문서에 박아두지 않음).
- **수명주기·복구는 유지**: organizer별 중복 없는 생성·조회·만료 전 갱신·삭제/정지·
  재생성 경로, 구독/이벤트 전달 장애 시 Meet API 사후 대조(`reconcileMissedSmartNotesEvents`),
  상담 완료·수업 처리 자동 확정 금지 원칙 — 전부 이전 구현 그대로, target resource/topic
  파라미터만 교체됐다.
- **검증(mock/로컬만)**: 신규 회귀 차단 테스트 — 이메일을 사용자 ID로 쓰지 않는지,
  웹훅 URL을 pubsubTopic으로 쓰지 않는지, 필수 topic 누락/오형식 fail-closed, 캐시된
  사용자 ID 재사용(Directory API 재호출 안 함) 등(`lib/workspace-events/subscription-
  lifecycle.test.ts`, `lib/google-workspace-events-subscriptions.test.ts` 신규). 전체
  Vitest 841건, `tsc --noEmit`·`next build` 클린.
- **미완료**: 실제 Sandbox 재검증(구독 생성 응답 실측, 사용자 단위 vs canonical space
  단위 최종 판단 포함) — 실행 절차만 준비, 사람 복귀 후 실행 대기. Pub/Sub 발행 서비스
  계정 이름 확인·Publisher 권한 부여·push subscription 생성도 실측 재검증과 함께 실행.
- **decision_required**: 사용자 단위(`cloudidentity.googleapis.com/users/{id}`) Workspace
  Events 구독이 실제로 거부될 경우 canonical Meet space 단위 구독으로 전환할지 — mock으로는
  판단 불가, 실측 재검증 결과로만 확정 가능. 이 결정과 무관한 나머지 작업(위 정정 1~3,
  수명주기 유지)은 이미 완료했으므로 이 결정이 늦어져도 막히지 않는다.
- **외부 변경**: 이번 라운드도 실제 Google API 호출, IAM 변경, 이메일 발송 전부 0건.
  `git push` 없음.
- **M2/M3/M4 착수 여부**: 이번 세션은 M1/R6 blocker 해결 범위로 스스로 제한했다 —
  M2/M3/M4 코드는 작성하지 않았다(각 마일스톤은 별도 승인 단위로 취급).

push는 제품 오너가 최종 확인 후 별도로 지시할 때만 한다(이 세션은 지시받지 않아
push하지 않았다).

### M2 — R4 후속(체험수업권 + 정규상품 환불), 완료(2026-09-03)

커밋 `007e917`(1라운드: 지급) → `de9cd26`(문서) → `<잔여 마감 커밋, 아래 §2 참고>`
(2라운드: 90일 유효기간 만료 강제 확인 + 정규상품 환불 정책, 모두 main 브랜치,
`git push` 없음). 상세는 `docs/2026-09-03-m2-migration-execution-log.md`.
**환불 정책·90일 유효기간까지 통과해 M2를 완료로 표시한다.**

- **DB**(`supabase/migrations/20261012000000_m2_trial_entitlement.sql`): 구매·환불·
  양도 불가능한 60분 전용 체험수업권 — `entitlement_types.trial_lesson_use` +
  `entitlement_products.trial_lesson_grant`(신규 `system_only` 컬럼=true, 가격
  버전 없음 → 구매 체크아웃 자체 불가). `entitlement_grants.source_consultation_id`
  + 부분 unique index로 상담당 지급 1건만 허용(idempotent). **실제로 발견한 DB
  갭**: `hold_entitlement()`가 지금까지 수업 유형(정규 120분/체험 60분)을 전혀
  구분하지 않고 child의 아무 grant나 hold했다 — `p_lesson_type_id`(기본 null,
  하위호환) 파라미터를 추가하고 `confirm_lesson_booking()`이 항상 넘기도록 해
  정규/체험 오사용을 DB 레벨에서 막았다. `admin_record_consultation_outcome()`이
  outcome='trial_recommended' 기록 시점에 같은 트랜잭션에서 지급을 시도(실패해도
  outcome 기록 자체는 막지 않음, `consultations.trial_entitlement_grant_status/_error`로
  추적) — `admin_retry_trial_entitlement_grant()`로 관리자 수동 재처리 가능. 환불은
  `refund_entitlement()`가 `purchase_id_ref`(체험은 항상 null) 기준이라 애초에
  대상이 아니고, 양도는 `is_paid=false`(체험은 항상 false)를 기존 `transfer_entitlement()`
  가드가 이미 차단 — 새 환불/양도 로직을 만들지 않았다. 취소(회수)는 기존
  `expire_entitlement()` 재사용.
- **앱 레이어**: 관리자 `ConsultationSchedulingPanel.tsx`에 지급 상태+재처리 버튼,
  보호자 `EntitlementsTab.tsx`에 체험수업권 별도 카드(정규 수업권과 절대 합산하지
  않음 — `app/parent/entitlements-data.ts`를 `entitlement_grant_details`(신규 뷰,
  lesson_type_code로 정규/체험 구분) 조회로 교체해 실제로 합산될 뻔한 버그를 사전
  차단). `purchase-actions.ts`가 `system_only` 상품의 체크아웃을 명시적으로 차단.
- **1라운드 검증**: 로컬 `supabase db reset --local`, psql 직접 검증(멱등성/오사용
  방지/양도·환불 차단/회수 전부 실측 통과), `tsc --noEmit` 클린, 전체 Vitest 846건
  통과(기존 841건 + 신규 5건, 회귀 없음), `next build` 성공, 관련 Playwright 10건
  (`m1-consultation-flow`/`r4-*`/`r6-lesson-booking-flow`) 통과, 커밋만 있는 별도
  clean `git worktree`에서 build+전체 Vitest(846/846) 재현 확인.
- **2라운드(잔여 마감, 2026-09-03) — 정책 확정 반영**: 제품 오너가 체험수업권
  유효기간(지급일로부터 90일, 실제 체험 시작 시각이 만료 이하여야 함)과 정규상품
  환불 공식(7일 이내+미사용 전액환불, 그 외 실제 결제액−소진회차×구매당시
  할인전 단건 정상가, 체험 제외)을 확정 지시해 실제로 구현했다
  (`supabase/migrations/20261013000000_m2_refund_policy_and_trial_expiry.sql`).
  **90일 유효기간**: 지급 로직(1라운드 `now()+90 days`)은 이미 정책과 일치 —
  "체험 실제 시작 시각이 만료 이하"는 R1부터 있던 `hold_entitlement()`의
  `expires_at > p_lesson_start_at` 필터가 모든 lesson_type에 이미 공통 적용하고
  있었고, 시간 변경 재검증도 기존 `reschedule_reservation_to_google_time()`이
  동일 필터로 범용 처리해 별도 체험 전용 코드가 필요 없었다(psql로 만료된 grant의
  hold 거부까지 실측 확인). **환불**: 신규 `purchase_has_active_future_holds()`
  헬퍼로 "미래 예약 해제 우선순위"를 자동 취소가 아니라 명시적 차단+안내로
  구현(근거는 마이그레이션 §1 주석, 기술적 선택 — 자동 취소가 맞다고 판단되면 이
  헬퍼 하나만 교체하면 됨). `calculate_purchase_refund_minor()`가
  `within_full_refund_window`/`blocked_by_active_holds`를 추가로 반환, 전부
  `purchases` 스냅샷(package_price_minor/unit_price_minor/confirmed_at)과
  `entitlement_ledger` 이력만 사용(가격표 재조회 없음 — 상품 가격이 나중에
  바뀌어도 과거 구매 환불액 불변). `refund_requests.within_full_refund_window`
  컬럼으로 계산 근거를 감사 이력에 고정. 체험수업권은 `purchase_id_ref`가 항상
  null이라 이 전체 경로에서 자동 제외(신규 코드 불필요, psql로 no-op 확인).
  앱 레이어: `requestRefund()`가 차단 시 즉시 친절한 에러, `approveRefund()`는
  `refund_entitlement()`의 fail-closed 재확인에 그대로 의존(이중 방어).
  관리자 화면(`EntitlementLedgerTab.tsx`)에 "구매 후 7일 이내 미사용(전액 환불
  적용)" 표시, 관리자 상담 패널·보호자 화면에 체험수업권 정확한 만료일+사용 조건
  문구 추가.
  **검증**: psql 직접 검증 5개 시나리오(7일 이내 전액환불/7일 밖 소진 반영/
  미래 hold 차단→해제 후 환불→idempotent 재시도/체험 grant 환불 대상 자동 제외/
  만료된 체험 grant hold 거부) **전부 실제 로컬 DB로 통과**, `tsc --noEmit` 클린,
  전체 Vitest 849건 통과(2라운드 신규 3건 포함, 회귀 없음), `next build` 성공.
  **미완료**: 2라운드 관련 Playwright 재실행과 별도 clean worktree 재현은 이
  세션이 로컬 Supabase DB를 다른 세션과 공유하는 충돌이 발견돼 중단 지시를 받아
  실행하지 못했다 — 재개 승인 후 이어서 실행 필요(DB 자체 변경 없이 코드는 이미
  실제 DB로 검증됨).
- **결정 필요**: 없음 — 90일 유효기간·환불 공식 모두 2026-09-03 확정.
- **범위 밖(M3/M4, 착수하지 않음)**: 체험 선생님 배정·예약, 잠재고객→정식 학생
  계정 연결. 연결 지점만 남겨둠(`grant_trial_entitlement_for_consultation()`이
  child_id 없으면 명확한 예외를 던지고, M4가 계정 연결 후
  `admin_retry_trial_entitlement_grant()`를 호출하면 자연스럽게 이어짐).
- **기술적 선택(결정 필요 아님, 근거 문서화)**: "미래 예약 해제 우선순위"를 자동
  취소가 아니라 명시적 차단으로 구현 — 예약 취소는 이미 Calendar 동기화·통지까지
  포함한 별도 완결 흐름(`cancel_lesson_booking()`)이라 환불 승인이 그걸 몰래
  트리거하면 부작용이 크다고 판단. 자동 취소가 맞다고 판단되면
  `purchase_has_active_future_holds()`만 교체하면 됨.
- **외부 변경**: 0건(Stripe/Google/이메일/원격 DB 전부 미접근). `git push` 없음.

## `material_version_id` 정책(R9 이관, 2026-09-02 명문화)

`sessions.material_version_id`(교재 버전 스냅샷 FK)는 R1부터 nullable 컬럼으로만 존재하고 실제로 채워진 적이 없다 — "이 subject_enrollment가 지금 어떤 교재 버전을 쓰는지"를 판정하는 개념 자체가 R9(과목 템플릿과 학생별 진도 스냅샷) 전에는 없기 때문이다. 이번 세션에서 제품 오너 요구에 따라 정책을 다음과 같이 명문화했다(구현은 R9에서):

- **예약(booking) 자체는 이 값이 null이어도 막지 않는다** — 지금처럼 예약 시점에는 채우지 않는다.
- **R9가 학생의 확정 커리큘럼 진도를 판정하는 즉시**, 아직 시작하지 않은(`actual_start_at is null`) 예정 세션들에 버전을 배정해야 하고, **세션이 시작되기 전에는 반드시 non-null이어야 한다** — "수업 시작 전 필수 선행 조건(blocker)"으로 취급한다. `docs/2026-08-29-master-roadmap-v3.md` R9 체크리스트에 동일 항목 등록 완료.
- **이미 시작했거나 완료된 세션의 `material_version_id`는 절대 재배정/덮어쓰지 않는다** — R1의 스냅샷 불변 원칙을 그대로 따른다.
- **기존 데이터 무결성 규칙과의 충돌 여부(조사 완료)**: 현재 `material_version_id`를 보호하는 트리거나 제약은 전혀 없다 — R1의 `sessions_prevent_direct_update` 트리거(`supabase/migrations/20260830040000_r1_reservation_session.sql`)는 `before update of final_status`로 **`final_status` 컬럼 UPDATE에만** 반응하고 `material_version_id`는 건드리지 않는다. 즉 이 정책은 기존 불변성 규칙과 **충돌하지 않는다** — R9 구현 시 지금은 없는 새로운 트리거/체크(시작 전 세션만 UPDATE 허용)를 추가해야 하는 것으로, 제품 정책 결정이 필요한 사항은 아니다(그대로 진행 가능).

## 다음 R 착수 시 읽을 문서

1. `CLAUDE.md`
2. `docs/CURRENT.md`(이 문서)
3. `docs/2026-08-29-master-roadmap-v3.md`의 해당 R 섹션
4. 그 작업에 직접 필요한 설계 문서만 선택적으로(예: `product-architecture-v3.md`의 관련 절, 해당 Gate 문서) — 전체 실행 로그·과거 계획·prompts는 문제 해결에 필요할 때만 검색.
