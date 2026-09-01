# ALTON — 현재 상태 (2026-09-01 기준)

이 문서는 매 R 단계 종료 시 갱신되는 "지금 상태" 요약이다. 장문의 조사·실행 내역은 여기 복사하지 않는다 — `docs/2026-08-29-r2-migration-execution-log.md`(R0~R2 실행 로그)와 `docs/2026-08-29-master-roadmap-v3.md`(전체 R 계획)에 있다.

## 완료된 단계

- **Gate A·B·C** — 전부 완료(2026-08-30). Gate C 검증 중 앱이 없어 검증 못 한 3개 워크플로우(GW-10/12/14)는 R8/R9/R12 필수 인수 기준으로 이관됨.
- **R1** — 데이터 기반 재설계, 완료.
- **R2** — 계정·가족·권한 수명주기, **완료(2026-09-01)**. Task 1~9 전부 완료. 상세는 실행 로그 참고.
- **R3** — 상담·체험·제안·계약, **백엔드·계약모델·관리자 UI·로컬 E2E 완료(2026-09-01), 외부 통합(Preview/DocuSign Connect/Drive) 부분 검증·미완료**. 아래 "R3 남은 blocker" 참고 — 정식 완료 처리 보류.

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
- Sandbox DocuSign 인증(JWT)·envelope 발송·실서명 완료는 실측 검증됨. **Drive 실제 업로드는 코드는 구현됐으나 로컬 실행 시 GCP IAM이 impersonation을 거부해(WIF 토큰은 로컬 pull 토큰, Production 런타임 전용으로 신뢰 설정된 것으로 보임) 미검증** — 아래 blocker 참고.

## 남은 blocker·후속 작업

- **(R3, 2026-09-01 신규)** DocuSign Connect 계정 레벨 웹훅 라우팅이 sandbox에서 전달 시도 자체를 하지 않음(`connect/logs`·`connect/failures` 모두 0건, 90초+ 대기 확인) — 원인 미확정(계정 기능 활성화 필요 가능성). 웹훅 처리 로직 자체는 실제 서명된 HTTP POST로 Preview+원격 dev DB 대상 직접 검증 완료(서명검증·멱등·순서역전·동의게이트·void 사유저장 전부 확인)했으나, DocuSign→앱 실배달 경로는 미해결.
- **(R3, 2026-09-01 신규)** `uploadArtifactToDrive` 로컬 실행 시 `iam.serviceAccounts.getAccessToken` IAM 권한 거부 — R2 WIF 신뢰 정책이 로컬에서 pull한 OIDC 토큰의 impersonation을 허용하지 않는 것으로 보임(Vercel Production 런타임 전용 설계 가능성). Vercel Production에서 직접 실행하는 검증이 필요(Preview는 `assertNotPreview()`로 원천 차단).
- **(R3)** `queueDriveArtifactSync`가 큐에 넣은 `queued` 상태 행을 최초로 처리하는 워커가 없음 — 현재 `retryFailedDriveArtifacts()`는 `retryable_failed`/`manual_review`만 대상으로 함. `uploadArtifactToDrive` 실사용 시 실제 DocuSign 문서 다운로드(`downloadCompletedDocument`/`downloadCertificateOfCompletion`) 연결도 아직 안 됨(현재 빈 버퍼로 호출).
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
