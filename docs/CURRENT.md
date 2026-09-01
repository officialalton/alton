# ALTON — 현재 상태 (2026-09-01 기준)

이 문서는 매 R 단계 종료 시 갱신되는 "지금 상태" 요약이다. 장문의 조사·실행 내역은 여기 복사하지 않는다 — `docs/2026-08-29-r2-migration-execution-log.md`(R0~R2 실행 로그)와 `docs/2026-08-29-master-roadmap-v3.md`(전체 R 계획)에 있다.

## 완료된 단계

- **Gate A·B·C** — 전부 완료(2026-08-30). Gate C 검증 중 앱이 없어 검증 못 한 3개 워크플로우(GW-10/12/14)는 R8/R9/R12 필수 인수 기준으로 이관됨.
- **R1** — 데이터 기반 재설계, 완료.
- **R2** — 계정·가족·권한 수명주기, **완료(2026-09-01)**. Task 1~9 전부 완료. 상세는 실행 로그 참고.
- **R3** — 상담·체험·제안·계약, **백엔드·계약모델·관리자 UI·로컬 E2E·Drive 실측(업로드·file ID·멱등·재시도) 완료(2026-09-01)**. **유일한 남은 blocker: DocuSign 웹훅 HMAC 실수신**(DocuSign 지원 문의 진행 중) — 이 항목 해결 전까지 R3 정식 완료 처리 보류.

## 스키마·외부 서비스 현재 구조

- **DB**: Supabase Postgres. 계정 상태는 역할별 테이블(`students`/`teachers`/`parents`)의 `status` 컬럼 + `transition_account_status()`(SECURITY DEFINER, 역할별 유효 전이 강제 + 선생님은 7조건 게이트) 하나로 통일 관리. `households`/`household_members`가 가족 관계의 원본(레거시 `guardian_students`는 동결, 쓰기 트리거로 차단). 계정 초대는 `account_invites` 자체 토큰 상태 머신. 권한은 `is_admin() OR current_user_has_capability('...')` 패턴(capability는 `supervisor_capabilities`, 자유 텍스트) — Task 4/5/6/7의 신규 함수는 이 패턴 적용됨(레거시 함수 전체 전환은 R12).
- **선생님 계정**: `@alton.education` Google Workspace 계정 필수, `teacher_workspace_provisioning` staging 테이블 → 실제 Google OAuth 최초 로그인으로 연결. 인증 체인은 Vercel OIDC → GCP WIF → 서비스 계정 impersonation → signJwt(DWD) → Directory API(서비스 계정 키·장기 토큰 없음). 쓰기(계정 생성/정지/재활성화)는 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`, 읽기 전용 점검은 `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` — **둘 다 Production에서 기본값 `false`**, 필요할 때만 일시적으로 `true`로 전환 후 반드시 복원.
- **배포**: Vercel, Production 도메인 `https://app.alton.education`. `git push origin main` → Vercel 자동 배포(GitHub 연동, Production Branch = `main`).
- **테스트**: Vitest(유닛, 94개 파일/422건) + Playwright(E2E, `e2e/`, 27건 — `--workers=1` 순차 실행 기준, 기본 병렬 설정은 알려진 파일 간 레이스 있음, 아래 blocker 참고).

## 다음 작업에 필요한 확정 정책만

- 계정 상태: `pending→active↔suspended`(가역적), `active/suspended↔inactive`(일반 서비스 중단, 복귀 가능), `active/suspended→closure_pending→closed`(명시적 폐쇄, 30일 유예, 복원 없음). 선생님의 `active` 전환(어떤 전이든)은 7조건(workspace_issued/first_login/identity_linked/valid_rate/onboarding_complete/contract_signed/admin_base_info) 전부 충족해야 함.
- `teacher_rate_history`/`account_status_events`는 **하드 immutable**(DELETE·UPDATE 전면 차단, bypass 플래그 없음, service_role도 EXECUTE revoke) — 테스트 데이터라도 물리 삭제 불가, 정리는 `suspended`/`closed` 같은 정상 상태 전이로만.
- 초대: 관리자가 보호자 초대 → 가입한 보호자가 자녀 추가 초대(§4.19). 보호자가 다른 보호자(공동 보호자)를 초대하는 것도 이제 가능하지만 관리자 전용(자기서비스 아님).
- 시간대: 개인 설정 → household 기본값 → `America/Los_Angeles`(`lib/timezone.ts`). 브라우저 감지 UI는 R6까지 의도적 보류.

## 최신 마이그레이션

`supabase/migrations/20260916000000_r3_trial_goal_and_classification_tags.sql` (로컬·원격 개발 DB 적용 완료, 원격 = `worpsqwqgnspddnrtnvq.supabase.co`). R3 전체 6개 마이그레이션(`20260911`~`20260916`, contracts cutover + 상담/체험/제안서/계약모델 정렬/취소·노쇼/목표필드+classification_tags) 포함.

## R3 계약/DocuSign 구조 (2026-09-01 확정)

- 계약은 자녀 1명 단위 계속 계약(보호자 1명 서명), 기본계약에 과목·선생님·패키지 금액을 고정하지 않는다 — 추천 조건은 `proposals`/`proposal_subjects`에만 남기고 실제 구매 스냅샷은 R4.
- DocuSign envelope는 `contracts`가 아니라 `contract_versions`와 1:1(`docusign_envelope_id`/`status`/`company_signed_at` 등 버전 레벨). 회사 선서명 완료 버전만 발송 가능.
- 웹훅(`app/api/webhooks/docusign/route.ts`)은 서명 검증 fail-closed, `external_event_receipts(provider,event_id)` 멱등, 완료 시 `contracts.status='active'`(결제 진입 경계)로 전환하되 Drive 저장은 `drive_artifacts.sync_status`로 분리 추적(서명 상태를 되돌리지 않음).
- 13세 미만 학생 동의 게이트(`assert_guardian_consent_ok()`)가 체험 생성·계약 활성화 모두에서 fail-closed로 강제됨 — R2 `consent_policy_versions`/`guardian_consents` 그대로 재사용.
- Sandbox DocuSign 인증(JWT)·envelope 발송·실서명 완료(1차 envelope)는 실측 검증됨. 서명 필드 미렌더링 근본원인(`anchorIgnoreIfNotPresent` 기본값) 수정·확인 완료(2026-09-01, 아래 참고). Drive 실제 업로드는 코드 구현 완료(worker·다운로드 연결·멱등 포함), 실제 쓰기 자체는 최소권한 전용 인프라 설계·승인 대기 중.

## 남은 blocker·후속 작업

- **(R3, 2026-09-01, 해결)** Drive 실제 업로드 — Preview 전용 최소권한 서비스 계정(`r3-drive-preview-verify@alton-integration-sandbox.iam.gserviceaccount.com`, Directory API·DWD 없음, WIF provider `vercel-r3-preview`가 owner_id/project_id/environment=="preview" 조건으로 제한)으로 실측 검증 완료: 실제 업로드·`drive_file_id` 연결·멱등 재실행(동일 file id, 중복 없음) 전부 확인. 검증 중 실제 버그 2건 발견·수정 — impersonation 토큰에 Drive 스코프 명시 필요(없으면 403), Shared Drive 실제 이름이 "Alton Integration Sandbox"로 대소문자가 코드 가정과 달랐음(대소문자 무시 비교로 수정). 검증 후 쓰기 플래그·IAM binding 제거, 서비스 계정 비활성화 완료 — 서비스 계정/WIF provider 자체와 Shared Drive 멤버십(사용자 직접 제거 필요)은 별도 승인 대기.
- **(R3, 2026-09-01, DocuSign 지원 문의 필요로 확정)** DocuSign Connect **계정 레벨** 웹훅 라우팅은 sandbox에서 여전히 미작동. **envelope별 `eventNotification`은 실제 Preview까지 배달됨**(실측 확인)이나 **HMAC 서명이 계속 누락**됨 — `eventNotification.includeHMAC: "true"`를 코드에 명시(근본원인으로 추정해 수정, 유닛 테스트로 payload 검증 완료)하고 계정에 활성 HMAC 키를 등록한 뒤 승인된 2번째 envelope으로 재검증했으나 **최초 배달·retry 모두 401(서명 없음) 유지**. 실제 요청 헤더를 직접 캡처하려 했으나 DocuSign retry_queue가 envelope 생성 시점의 원래 URL로만 재전달돼 확인 실패. 코드 쪽 요청 구성은 검증 완료(정확히 포함), fail-closed 거부도 정확히 동작 — 남은 원인은 DocuSign sandbox 계정 자체의 설정/한계로 보이며 **DocuSign 지원 문의 필요**. 웹훅 처리 로직 자체(서명검증·멱등·순서역전·동의게이트·void 사유저장)는 실제 서명된 요청으로 Preview+원격 dev DB 대상 반복 검증 완료.
- **(R3, 2026-09-01 해결)** ~~`queued` 상태 최초 처리 워커 부재~~ → `processQueuedDriveArtifacts()` 구현 완료(claim/lock, `queued→processing→succeeded/retryable_failed→manual_review`, `drive_artifacts.retry_count` 컬럼 추가). ~~`uploadArtifactToDrive`에 실제 문서 다운로드 미연결~~ → `retryFailedDriveArtifacts()`가 이제 실제 `downloadCompletedDocument`/`downloadCertificateOfCompletion`을 호출. Drive 파일명 기준 멱등 확인도 추가. 전부 mock 테스트로 검증(502/502) — **실제 Drive 쓰기 자체는 아직 미실행**(아래 항목).
- **(R3, 2026-09-01 신규, 진행 중)** Drive 실측 검증용 최소권한 전용 인프라(Preview 전용 서비스 계정, ALTON 프로젝트·Preview 환경만 허용하는 WIF 조건, Directory API/DWD 권한 없음, `ALTON Integration Sandbox` 또는 `R3 Test` 폴더로 접근 제한) 설계·승인 요청 진행 중 — 기존 Production WIF/서비스 계정은 건드리지 않기로 확정(`assertNotPreview()` 완화 금지, Production 런타임 시험 금지).
- **(R12로 이관, 2026-09-01 확정)** 이미 active인 계정의 로그인 이메일 정정 절차 — 본인확인·Workspace/Auth identity 재연결·중복 계정 충돌·감사 이력을 함께 다뤄야 하는 별도 계정관리 정책이라 R2 범위에 포함하지 않음. `master-roadmap-v3.md` R12에 등록됨. PENDING 초대 오타는 기존 revoke+재초대로 충분(이 항목과 무관).
- **(R13, 정식 오픈 전)** `e2e/account-lifecycle.spec.ts`/`account-merge.spec.ts`가 전역 시드 계정을 공유해 `fullyParallel:true` 기본 설정에서 다른 스펙과 레이스 가능 — 전용 픽스처로 리팩터링 필요.
- **(R12)** SECURITY DEFINER 함수 전체 anon EXECUTE 권한 감사(레거시 9개 + 이번 세션에서 확인된 다른 함수들), Workspace 위임 관리자를 `official@alton.education`에서 전용 자동화 계정으로 분리, 테스트 데이터 안전 정리 절차 설계.
- **(R11 또는 R13)** `mark_expired_invites()` 스케줄러(cron) 연결.
- Gate C 이관 3건(GW-10/12/14, R8/R9/R12 인수 기준) — 여전히 해당 R에서 반드시 통과.

## 다음 R 착수 시 읽을 문서

1. `CLAUDE.md`
2. `docs/CURRENT.md`(이 문서)
3. `docs/2026-08-29-master-roadmap-v3.md`의 해당 R 섹션
4. 그 작업에 직접 필요한 설계 문서만 선택적으로(예: `product-architecture-v3.md`의 관련 절, 해당 Gate 문서) — 전체 실행 로그·과거 계획·prompts는 문제 해결에 필요할 때만 검색.
