# R3 — 마이그레이션·구현 실행 로그

- 목적: R1/R2 실행 로그와 동일한 형식. 장문 조사 내역은 복사하지 않고 핵심 결정·변경·검증·blocker만 기록한다.
- 상태: **부분 완료 — 외부 통합(DocuSign 실배달, Drive 실저장) blocker로 R3 정식 완료 처리 보류(2026-09-01).** 최신 상태는 `docs/CURRENT.md` 참고.

## 완료된 것 (로컬 검증 완료)

- `contracts_v3` cutover(`20260911000000`), 상담/체험/제안서/계약모델 정렬 스키마(`20260912000000`~`20260916000000`, 6개 마이그레이션), 원격 dev DB(`worpsqwqgnspddnrtnvq.supabase.co`) 적용 완료.
- 계약 버전 단위 DocuSign 연동 컬럼(`contract_versions.docusign_envelope_id` 등), 회사 선서명 게이트, 상태 전이(draft→...→active, void/superseded), R2 동의 구조 재사용한 fail-closed 게이트(`assert_guardian_consent_ok()`), AI 회의록 선택 별도 테이블(`ai_notes_consent_events`).
- 관리자 UI(`ConsultationTab.tsx`, `ContractsTab.tsx` 재작성) — 상담/체험/제안서/계약/동의대기/AI선택/오류·재처리 현황판.
- 로컬 유닛·통합 테스트 487/487, E2E 3건(`e2e/r3-*.spec.ts`) + 기존 R1/R2 스펙 회귀(1건 사전 known-issue 제외 전부 통과).
- DocuSign JWT 인증·envelope 발송·실서명 완료·API 상태조회 — sandbox 실측 검증(첫 envelope `25fc22d0-...`).

## 외부 검증 1차 시도 (2026-09-01) — 부분 실패, 원인 규명

- Vercel Preview 배포(`alton-o1kv4n01y-alton7.vercel.app`), Preview 전용 env var 추가(Supabase 원격 dev DB 값, DocuSign sandbox 값, 신규 webhook 시크릿).
- **외부 변경(승인 필요 항목 아님, 기록 목적)**: 검증 중 Vercel Deployment Protection(SSO)을 일시 해제 → 웹훅 401 원인이 Vercel 보호벽임을 확인 → **검증 직후 원복 완료**(재확인됨).
- DocuSign Connect 계정 레벨 웹훅 설정(connectId 22299996) 생성 → **전달 시도 자체가 발생하지 않음**(`connect/logs`/`connect/failures` 0건, 90초+ 대기) → 원인 미확정 → **검증 후 Connect 설정 삭제 완료**.
- 웹훅 처리 로직 자체는 실제 서명된 HTTP POST로 Preview+원격 dev DB 대상 직접 검증(서명 fail-closed, 멱등, out-of-order 가드, 동의 게이트 실전 발동, declined→void+사유 저장) — 전부 정상 확인.
- `uploadArtifactToDrive` 실구현(Drive API v3, R2 WIF 체인의 Drive 스코프 토큰 추가) 완료했으나 로컬 실행 시 `iam.serviceAccounts.getAccessToken` IAM 거부 — R2 WIF 신뢰 정책이 로컬 pull 토큰의 impersonation을 허용하지 않는 것으로 보임. **Production 런타임에서 시험하거나 `assertNotPreview()`를 완화하지 않기로 확정(2026-09-01)** — 별도 최소권한 Preview 전용 서비스 계정 설계로 방향 전환.

## 기록: 개발 DB 마이그레이션 추적 동기화 (외부 변경)

R3 스키마 작업 중 일부 마이그레이션(`20260914000000`, `20260915000000`)이 로컬 DB에는 정상 적용됐으나 Supabase CLI의 `supabase_migrations.schema_migrations` 추적 테이블에는 기록되지 않은 상태가 발견됨(원인: 일부 작업이 `supabase migration up` 대신 직접 psql로 적용됨). 실제 컬럼/enum 존재를 확인한 뒤 **추적 테이블에 두 버전 row를 수동 INSERT하여 동기화**(로컬 DB, 2026-09-01) — 이후 `db reset`으로 처음부터 전체 마이그레이션이 순서대로 재현되는 것을 확인함. 이 수동 동기화는 로컬 개발 DB에 대한 외부 변경으로 기록한다. 이후 모든 R3 마이그레이션은 `supabase migration up`/`db push` CLI 경로로만 적용해 재발 방지.

## 남은 blocker

`docs/CURRENT.md` "남은 blocker·후속 작업" 절 참고 — 중복 기록하지 않음.
