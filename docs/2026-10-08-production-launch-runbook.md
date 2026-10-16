# 운영(Production) 오픈 런북 — 새 Supabase 프로젝트 + 콘텐츠·검수자 이전 (2026-10-08)

범위: 오너 결정(10-07) — 공유 비프로덕션(`worpsqwqgnspddnrtnvq`)과 **별개의 새 운영 Supabase 프로젝트**를 만들고, Vercel Production(프로젝트 `alton`, 도메인 `alton.education`·`app.alton.education`)을 거기에 연결한다. 랜딩·가입은 공개, 외부 검수자는 운영에서 가입, 비프로덕션 데이터는 분리, 오픈 시점에 검수자 계정·산출물 + 콘텐츠(같은 UUID)를 옮긴다.

이 문서와 `scripts/prod-launch/`는 **작성만** 했다. 운영 자원에는 아무것도 실행하지 않았다(프로젝트 생성·Vercel env·배포·원격 쓰기 없음). 표기: **[오너]** 대시보드·결제 등 오너 조작, **[개발]** 개발 세션 실행, **[승인]** 실행 전 오너 승인 필요.

## 0. 전제·원칙

- 운영 작업은 **전용 worktree**에서만: `git worktree add ~/Developer/ALTON-worktrees/prod-release <릴리스 커밋>`. 다른 worktree의 `supabase/.temp`가 비프로덕션에 링크돼 있어 잘못된 곳에 push할 위험이 크다. 링크 후 `cat supabase/.temp/project-ref`가 새 ref인지 매번 확인.
- 비밀은 저장소 밖 `~/.alton-secrets/prod.env`(chmod 600, 템플릿 `scripts/prod-launch/prod.env.example`). 채팅·로그·커밋에 값을 쓰지 않는다.
- `supabase config push`는 **쓰지 않는다** — `supabase/config.toml`은 로컬 값(site_url `localhost:3010`, 한국어 제목, Google 로컬 client)이라 운영 Auth 설정을 덮어쓴다. Auth 설정은 대시보드(또는 Management API `PATCH /v1/projects/{ref}/config/auth`)로만.
- 마이그레이션은 파일을 고쳐도 반영 안 됨(CLAUDE.md). 운영에 적용할 번호가 곧 정본이다. 현재 548개(최신 `20262100000310`).
- 신규 DB가 **빈 상태일 때만** 콘텐츠·검수자 키트를 적재한다. 운영에 실사용자가 생긴 뒤의 재적재는 별도 설계가 필요하다(§3, §4 주의).

## 1. 단계별 절차(순서 고정)

| # | 담당 | 단계 | 확인 |
|---|---|---|---|
| 1 | 오너 | Supabase 새 프로젝트 생성: free plan org, region `us-west-2`(us-west-2 = 비프로덕션과 동일, Vercel `pdx1`과 근접), 이름 예 `alton-production`. DB 비밀번호는 비밀번호 관리자에서 생성(20자+, 특수문자는 URL 인코딩 주의) → `~/.alton-secrets/prod.env`. | 대시보드 상태 Healthy |
| 2 | 오너 | **플랜 결정(§7-1)** — free plan은 7일 비활성 시 일시정지·자동 백업 없음·내장 SMTP 시간당 2통. 공개 오픈 전 Pro 전환 권장. | 결정 기록 |
| 3 | 개발 | 새 worktree `prod-release` 준비, `supabase link --project-ref $PROD_PROJECT_REF -p "$PROD_DB_PASSWORD"`, `.temp/project-ref` 확인 | ref 일치 |
| 4 | 개발 | 선행 점검: `psql "$PROD_DB_URL" -f scripts/prod-launch/sql/00-preflight-vault.sql` (§2 Vault) | `supabase_vault` 확장·`vault.create_secret` 존재 |
| 5 | 개발 [승인] | 마이그레이션 **dry-run**: `supabase db push --linked --include-all --dry-run` → 548개 목록·순서 확인(실제 변경 없음). 이어서 `supabase db push --linked --include-all`. | 오류 0, 마지막 `20262100000310` |
| 6 | 개발 | 적용 검증: `supabase migration list --linked`(local=remote), `supabase db diff --linked`(차이 0). | 차이 0 |
| 7 | 개발 | **강화 SQL**: `psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f scripts/prod-launch/sql/01-post-migration-hardening.sql`(계약 자동 발송·정산 자동 송금 시드값을 닫음, §5). 출력(`03-verify-closed.sql`)이 전부 `f`. | 4개 스위치 f, 사용자 0명 |
| 8 | 오너 | Auth 설정(§2-Auth) — site URL, 리다이렉트, SMTP, 템플릿, 가입 설정, Google provider. | 체크리스트 완료 |
| 9 | 오너+개발 | 첫 master 관리자: `official@alton.education` Auth 계정 생성(초대 또는 Google 로그인) 후 `02-bootstrap-master-admin.sql`(§2-마스터). | master 1행 |
| 10 | 개발 [승인] | **콘텐츠 복사**(§3): 내보내기 → dry-run → apply → 행 수 검증. | 전 표 OK, 고아 0 |
| 11 | 개발 | Vercel Production **환경변수**(§6) — 새 프로젝트 값 + 닫힘 스위치. **[승인]**(운영 env 변경) | `vercel env ls production` 이름 대조 |
| 12 | 개발 [승인] | 운영 배포(§8-1), 도메인 연결 확인, `healthcheck.sh`. | 전 항목 OK |
| 13 | 오너+개발 | 스모크: 가입→이메일 확인→`/student` 무료 홈→모의고사 시작→제출(§8-2). 테스트 계정은 실행 ID 부여 후 종료 시 삭제. | 통과 |
| 14 | 오너 | 공개 전환(도메인 DNS·랜딩 링크). 검수자 이전(§4)은 오픈 시점 별도 작업. | — |

단계 8~9는 10 이전이어도 되고, 10은 **12 이전**에 끝나야 가입자가 빈 문제은행을 보지 않는다.

## 2. 새 프로젝트 설정 상세

### Vault 키(마이그레이션 112, 수취 계좌 암호화)
- 정책(POLICY-DECISIONS): 암호화 키는 **Supabase Vault만**, Vault를 보장 못 하면 112가 **중단**하며 설정값·환경변수 대체 금지.
- 112의 동작: `pgcrypto`·`supabase_vault` 확장과 `vault.create_secret`이 없으면 변경 전에 예외로 중단. 있으면 `vault.secrets`에 `payout_account_encryption_key`가 **없을 때만** 32바이트 난수를 생성해 저장한다. 즉 새 프로젝트에서는 **별도 키를 넣을 필요가 없고, 112가 운영 전용 키를 자동 생성**한다(비프로덕션 키와 달라야 하며 그래야 맞다).
- 해야 할 일: ① 신규 Supabase 프로젝트는 Vault가 기본 제공 — 4단계 점검 SQL로 확인. ② 112 적용 후 키 행이 1개 생겼는지 확인(`00-preflight-vault.sql` 마지막 쿼리). ③ **키는 읽거나 내보내지 않는다.** 백업 시 Vault 키를 별도 보관해야 한다(키가 없으면 계좌 번호 복호화 불가) — Supabase 백업(Pro)에 vault가 포함되는지 오너가 확인하고, 포함이 불확실하면 오픈 직후 `payout` 계좌 입력 전에 방침을 정한다(아직 계좌 데이터 0이라 지금은 위험 없음).
- 비프로덕션에서 계좌 데이터를 **복사하지 않는다**(키가 다르면 복호화 불가이며, 복사 대상도 아님).

### 확장·Storage·Realtime·크론
- 확장: 마이그레이션이 `btree_gist`, `pgcrypto`, `supabase_vault`를 `create extension if not exists`로 처리. 별도 조작 불필요. `pg_cron` **미사용**(크론은 Vercel).
- Storage 버킷(전부 **비공개**, 마이그레이션이 생성): `teacher-documents`, `curriculum-assets`, `problem-assets`. 적용 후 `select id, public from storage.buckets`로 3개·`public=false` 확인, `storage.objects` 정책이 있는지 확인. 프로젝트 파일 크기 상한은 대시보드(free 50MB)에서 확인.
- Realtime: 마이그레이션 2개가 `supabase_realtime` publication을 설정. 적용 후 `select * from pg_publication_tables where pubname='supabase_realtime'` 로 테이블 목록 확인.
- Vercel 크론 7개(`vercel.json`, 하루 1회, Hobby 제약 준수) — §5의 환경변수 게이트가 닫혀 있으면 정산·보존·계약 크론은 아무 일도 하지 않는다. `CRON_SECRET`이 없으면 전 크론이 503.

### Auth 설정(대시보드 — [오너], 값은 `supabase/config.toml` 아닌 아래가 정본)
| 항목 | 운영 값 | 비고 |
|---|---|---|
| Site URL | `https://alton.education` | |
| Redirect URLs | `https://alton.education/**`, `https://app.alton.education/**` | 가입 확인은 `/signup/student/confirm`, 그 외 `/set-password`, `/auth/teacher-callback`, `/auth/admin-google-callback`, `/auth/admin-google-link-callback`. **Preview 와일드카드(`*.vercel.app`)는 넣지 않는다** — Preview는 비프로덕션 DB를 쓰고, 운영 Auth에 허용하면 운영 토큰이 Preview로 갈 수 있다. |
| Enable sign ups | ON(공개 가입) | 비상 차단 = 이 토글 OFF |
| Email provider / Confirm email | ON | 무료 회원 가입이 확인 메일 기반(`provision_free_member`가 이메일 확인을 요구) |
| Minimum password length | 8 | 10-05 기록상 8자. 로컬 config는 6 |
| Secure email change / secure password change | ON | |
| Anonymous sign-ins, manual linking | OFF | |
| Custom SMTP | **필수** — 내장 SMTP는 시간당 2통 제한이라 가입 확인이 막힌다. 발신 `official@alton.education` 계열, SPF/DKIM/DMARC 설정 | 앱 알림용 `SMTP_*` env와 별개(Auth 메일은 Supabase가 보냄) |
| Rate limits | email_sent을 SMTP 한도에 맞춰 상향(예: 30~60/h), sign-in/up 5분당 IP 30(기본) 유지 | |
| 이메일 템플릿 | Confirm signup = `supabase/templates/confirmation.html`, Invite = `invite.html`, Reset password = `recovery.html` 내용을 붙여넣기 | **제목은 영어로**: config.toml의 invite 제목("ALTON EDUCATION에 초대되었습니다")·recovery("비밀번호 재설정")는 한국어라 영어화 결정(10-05)과 어긋남. confirmation은 config.toml에 제목 설정 자체가 없다. |
| Captcha | **켜지 않는다(현재)** — 가입 클라이언트에 Turnstile 토큰 전달 코드가 없다(`captcha`/`turnstile` 참조 0건). Supabase에서 켜면 모든 가입이 실패한다. | 후속: Turnstile 연동 구현 후 켜기. 그 전 봇 방어는 확인 메일·rate limit뿐(§7-2) |
| Google provider | 운영용 OAuth Client를 별도로(권장) 만들어 Client ID/Secret을 Supabase에만 저장, GCP 승인된 리디렉션 URI에 `https://<새 ref>.supabase.co/auth/v1/callback` 추가 | config.toml의 client_id는 로컬 개발용 |
| JWT expiry / refresh rotation | 3600 / ON(기본 유지) | |

### 첫 master 관리자
마이그레이션 20261446은 `official@alton.education`이 이미 있을 때만 master로 지정하므로 **신규 DB에는 master가 없다**. 계정 생성 뒤 `02-bootstrap-master-admin.sql -v admin_email="'official@alton.education'"`(프로필 insert/업데이트 후 결과 1행 확인). 마이그레이션에 하드코딩된 다른 이메일(`admin-uat-*`, `admin2@`, `cs.jiman@`, `consultant.jiman@`, `jiman@alton.education`, `matchbox512@snu.ac.kr`)은 신규 DB에서 **no-op**이지만, `jiman@alton.education`은 `consultant_workspace_provisioning`에 사전 등록된 채로 남아 첫 Google 로그인 시 컨설턴트로 자동 연결된다(오너 본인 계정이라 의도된 것으로 보이나 확인 요망).

## 3. 콘텐츠 복사 키트 (`scripts/prod-launch/`)

목표: 문제은행·모의고사가 빈 DB에서 동작하도록 **같은 UUID**로 복사. 사용자·테스트·결제·계약·응시·세션·신고 데이터는 제외.

**포함 표와 FK 순서**(스키마 FK 기준, `content-tables.ts`):
1. `problem_skill_codes`(reference: 마이그레이션 시드가 이미 있음 → 없는 행만 추가)
2. `subjects` → `subject_template_units` → `subject_keywords` → `subject_template_unit_keywords`
3. `problems`(순환 FK `published_version_id`는 2단계 채움) → `problem_versions` → `problem_keywords`
4. `mock_exam_sets` → `mock_exam_set_items`(`content_snapshot` 포함, 생성 컬럼 `m1_eligible` 등은 대상이 계산)
5. `mock_exam_domain_weights`, `mock_exam_difficulty_weights`, `mock_exam_routing_policies`(replace: 마이그레이션이 임의 uuid로 시드한 설정표라 대상 기존 행을 지우고 원본 uuid로 교체)

정답·해설·유사도는 별도 표가 아니라 `problem_versions`(correct_index, answers, explanation, explanation_en), `problems`(correct_index, similarity_group, subpattern, usage_scope)와 세트 항목의 `content_snapshot`에 있다 — 위 표로 전부 포함된다. 문제 그림은 데이터(figure spec)라 함께 가며, `figure.type='image'`인 버전의 `problem-assets` 파일은 키트가 따로 내려받아 업로드한다.

**제외(의도)**: 사용자·프로필·응시(`mock_exam_attempts/answers/annotations/…`)·세션·과제·`problem_error_reports/verdicts`(검수자 키트가 담당)·`problem_*_changes`/`option_reorders`/`replacement_needs`(운영 이력)·커리큘럼 문서(`curriculum_docs*`, Drive 파일 의존)·교재 템플릿 문항 연결(`subject_template_unit_problems` 등, 운영 시작 뒤 새로 구성)·어휘 라이브러리(`vocab_library_*`는 **마이그레이션 자체가 데이터를 넣는다**)·대학 데이터(`university_*`는 시드/수집 스크립트로 재생성).

**작성자 컬럼**: `created_by`, `published_by`, `difficulty_confirmed_by` 등은 대상에 없는 프로필을 가리키므로 기본 NULL 처리(`--keep-authors`로 유지 가능 — 같은 profiles.id가 있을 때만). `origin_session_id`, `section_id`는 항상 NULL(세션·교재 섹션 미이전).

**사용법**
```
# 1) 원본에서 읽기 전용 내보내기 (비프로덕션에 쓰기 없음)
SOURCE_SUPABASE_URL=https://worpsqwqgnspddnrtnvq.supabase.co SOURCE_SUPABASE_SECRET_KEY=... \
  npx tsx scripts/prod-launch/export-content.ts          # → ~/.alton-secrets/prod-content/<시각>/ (JSONL + manifest.json)
# 2) dry-run (한 트랜잭션에서 전부 실행 후 ROLLBACK, 실제 변경 없음)
TARGET_DB_URL=$PROD_DB_URL npx tsx scripts/prod-launch/import-kit.ts --dir <내보내기 폴더> --target-ref $PROD_PROJECT_REF
# 3) 반영 [승인]
TARGET_DB_URL=$PROD_DB_URL TARGET_SUPABASE_URL=... TARGET_SUPABASE_SECRET_KEY=... \
  npx tsx scripts/prod-launch/import-kit.ts --dir <폴더> --apply --target-ref $PROD_PROJECT_REF --yes-production
```
- **안전장치**: 원격 대상은 `--target-ref`가 접속 주소의 ref와 같아야 하고, 비프로덕션 ref는 거부, 원격 반영은 `--yes-production` 필요. 기본은 항상 dry-run.
- **멱등**: 없는 행만 추가(`on conflict do nothing`), 재실행 시 신규추가 0. replace 표만 매번 통째 교체.
- **검증**: 표마다 원본 행 수 = 대상에서 해당 pk가 존재하는 행 수(OK/MISMATCH), 순환 FK 채움 수, FK 고아 행 검사(0이어야 통과, 아니면 종료 코드 1).
- **트리거**: 대량 적재는 `session_replication_role=replica`로 트리거·FK 자동검사를 끄고 직접 검증한다(대상 파생값 재계산·감사 기록이 생기지 않게). Supabase 호스티드 `postgres` 역할에서 설정 가능한지는 §10 "운영 전 확인"에서 dry-run으로 먼저 확인.
- **일관성**: 내보내기는 REST 페이지 읽기라 스냅샷이 아니다. **내보내기 중 비프로덕션 문항 쓰기를 멈춘다**(콘텐츠 동결 창). 고아 검사가 어긋남을 잡는다(실제로 로컬 공유 DB에서 다른 세션이 만든 고아 버전 8건을 이 검사가 잡았다).
- **테스트 오염**: 내보내기가 `uat|test|테스트|sandbox` 이름의 과목·키워드를 manifest `warnings`에 목록으로 낸다. 비프로덕션 원격에 UAT 키워드(예: `Speaking`, UAT 키워드 2개)가 남아 있으므로 **오너가 목록을 보고 제외 여부를 정한다**(제외하려면 원본에서 먼저 보관 처리 후 재내보내기 — 키트는 조용히 걸러내지 않는다).
- **무엇을 올릴지(세트 상태)**: 기본은 전 상태 복사. 초안·보관 세트까지 운영에 둘지는 §7-4 결정.

## 4. 검수자 계정 이전 (`export-reviewers.ts` / `import-kit.ts --kit reviewers` / `mark-reviewers.ts`)

**표시 방법(스키마 변경 없음)**: `auth.users.raw_app_meta_data = {"external_reviewer": true, "reviewer_cohort": "2026-10"}`. app_metadata는 서비스 키/관리자 API로만 쓸 수 있어 사용자가 못 바꾸고, JWT `app_metadata`에 실려 앱이 필요하면 바로 읽을 수 있으며, 조회는 `select … from auth.users where raw_app_meta_data->>'external_reviewer'='true'`. 별도 컬럼·테이블·마이그레이션이 필요 없어 공유 DB의 병합 충돌 위험이 없다. 관리자 화면에서 보이게 하는 것은 후속(뷰/컬럼 추가는 additive 마이그레이션으로 이후에).
- **지금**: `mark-reviewers.ts --emails 검수자.txt`(기본 dry-run) → 총괄 승인 후 `--apply`(공유 비프로덕션 쓰기). 이후 검수자 목록은 이 표시가 정본이고, 이전 스크립트는 표시 ∪ 이메일 파일을 대상으로 삼는다.
- **이전 대상**: `auth.users`(비밀번호 해시 `encrypted_password` 포함, 일회용 토큰 컬럼은 빈 값으로 초기화, app_metadata에 표시 병합) · `auth.identities` · `profiles` · `students`(`member_type`, `is_test_account` 등) · `student_terms_acceptances` · `problem_error_reports`(reporter가 검수자인 것) · 그 신고가 가리키는 `problem_error_verdicts`.
- **검수 의견·난이도 검토**: 현재 스키마에서 검수자 산출물로 확인된 표는 `problem_error_reports`(유형·`memo`)뿐이다. 별도 "난이도 검토/의견" 표가 있다면(없음으로 판단했으나 오너 확인 필요) `content-tables.ts`의 `REVIEWER_TABLES`에 한 줄 추가하면 된다. `problem_difficulty_changes`는 관리자 일괄 조정 이력이라 제외, 난이도 검토 **결과**는 `problems.difficulty*`에 이미 반영돼 콘텐츠 복사에 포함된다(그래서 콘텐츠 복사는 검수 종료 후 최신으로 한다).
- **제외(기본)**: 응시 기록·답안·주석·단어장·노트·세션·알림·로그·테스트 계정, 신고의 `mock_attempt_id/session_id/homework_batch_id`(NULL 처리, `mock_set_item_id`는 같은 UUID라 유지).
- **판정자**: `problem_error_verdicts.decided_by`는 비프로덕션 관리자 프로필을 가리킨다 → 운영의 관리자 프로필 id로 대체(`--override problem_error_verdicts.decided_by=<운영 master 프로필 id>`). 이 값이 없으면 스크립트가 중단한다.
- **순서**: 콘텐츠 복사 → (그 사이 운영에서 검수자가 이미 가입했다면 **이메일 충돌 사전 점검**) → 검수자 이전. 같은 이메일이 운영에 이미 가입돼 있으면 이전하지 말고 오너가 처리 방식을 정한다(UUID가 달라 신고가 새 계정에 못 붙음). 가능하면 검수자에게 "운영에서 가입하지 말고 이전을 기다려 달라"고 안내(§7-3).
- **세션**: refresh token·세션은 이전하지 않으므로 검수자는 **다시 로그인**해야 한다(비밀번호는 유지). Google 로그인 검수자는 `identities`가 이전되지만 Google OAuth Client가 달라지면(운영용 새 Client) 이전 `provider_id`는 sub 기준이라 동일 구글 계정으로 계속 매칭된다 — 오픈 전 1명 이상 로그인 확인.
- **사용법**: `SOURCE_DB_URL=… npx tsx scripts/prod-launch/export-reviewers.ts --emails 검수자.txt` → `import-kit.ts --kit reviewers --dir <폴더> --override …`(dry-run → `--apply --target-ref … --yes-production`). 비밀번호 해시가 들어 있으므로 산출물은 `~/.alton-secrets`(700)에만 두고 이전 후 삭제한다. 원본 DB 직접 접속(읽기 전용 트랜잭션)이 필요하다 — 해시는 REST/Admin API로 얻을 수 없다([오너]가 비프로덕션 DB 비밀번호를 제공하거나 `supabase db dump --data-only`를 대신 실행).

## 5. 안전 스위치 — 신규 DB·환경에서 "사람·돈에 실제로 작용하는" 기본값 점검

신규 DB에서 마이그레이션이 만드는 기본값(실제 확인):
| 스위치 | 신규 DB 기본 | 위험 | 권고 |
|---|---|---|---|
| `contract_dispatch_settings.auto_dispatch_enabled` | **true**(20262100000040 시드) | 계약 자동 발송 큐 활성. 앱 쪽은 `CONTRACT_AUTO_DISPATCH_ENABLED`가 정확히 `"false"`일 때만 강제 정지 — **미설정이면 열림** | `01-post-migration-hardening.sql`로 false + Vercel에 **`CONTRACT_AUTO_DISPATCH_ENABLED=false`를 명시** |
| `payout_auto_dispatch_settings.enabled` | **true**(시드) | 자동 송금 디스패치 활성(단 아래 게이트들이 이중 차단) | 01에서 false |
| `payout_disbursement_gate.real_disbursement_enabled` | false | 실제 지급 상태 전이 DB 차단 | 유지(오너 승인 전 변경 금지) |
| `consultant_assignment_settings.auto_assign_enabled` | false | | 유지 |

환경변수(전부 **미설정=닫힘**이 기본인 것들, Production에도 **설정하지 않는다**):
| 이름 | 권고 | 열면 |
|---|---|---|
| `CONTRACT_AUTO_DISPATCH_ENABLED` | **`false`(명시)** | 실제 고객에게 DocuSign 계약 발송 — 오너 승인·계약 문안 확정·DocuSign 운영 계정 후 |
| `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS` | 미설정 | DocuSign 호출(운영 계정으로 전환 시 별도 설계 필요 — 이름이 SANDBOX) |
| `PAYOUT_CRON_ENABLED` | 미설정 | 정산 자동 송금 크론 — 시도 모델 연동 전 열지 않음(mercury-ops-checklist) |
| `MERCURY_PAYOUTS_ENABLED`, `MERCURY_API_TOKEN`, `MERCURY_PAYOUT_ACCOUNT_ID` | 미설정 | 실제 송금 |
| `RETENTION_BATCH_ENABLED`, `RETENTION_DRIVE_DELETION_ENABLED` | 미설정 | 실제 삭제 배치 — 정책 확정·dry-run 검토 후 |
| `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES` | 미설정 | Drive 실제 쓰기 |
| `CALENDAR_SYNC_ALLOW_REAL_CALLS` | 미설정 | Calendar/Meet 실제 호출. **주의**: 닫혀 있으면 상담 예약의 Meet 링크·일정 동기화가 동작하지 않는다 — 공개 가입(무료 회원)만 열 때는 문제없으나 **상담·예약 기능을 공개하려면 이 플래그 오픈이 선행**돼야 한다(§7-5) |
| `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS` | 미설정 | 선생님 Google 계정 실제 생성·정지 |
| `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` | 미설정 | Workspace 읽기 조회 |
| `COMPANY_DOCUMENTS_ENABLED` | 미설정 | 회사 문서 Drive 연동 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 무료 오픈에는 **미설정**(또는 test 키) | 유료 결제(모의고사·공개 자료는 전부 무료 정책). 설정 시 Preview용 키를 운영에 넣지 않는다 |

닫힌 상태에서도 계속 도는 것(의도적): `mark-expired-invites`, `close-pending-accounts`(실제 가입자의 미완료 계정을 규칙에 따라 정리), `resync-meeting-events`(플래그 닫힘이면 외부 호출 없음), `close-payout-month`(정산 기록 집계만). 확인이 필요하면 `close-pending-accounts`는 오픈 직후 며칠은 로그로 관찰.

**확인 SQL**: `scripts/prod-launch/sql/03-verify-closed.sql`(읽기 전용) — 배포 전·후 각각 실행.

## 6. Vercel Production 환경변수 (이름만 — 값은 어디에도 쓰지 않음)

**새 프로젝트 값으로 반드시 교체**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(앱 클라이언트·SSR이 읽는 이름), `NEXT_PUBLIC_SUPABASE_ANON_KEY`(일부 코드가 읽음 — 같은 publishable/anon 키를 함께 설정), `SUPABASE_SECRET_KEY`(서버 service 키; 코드·스크립트가 `SUPABASE_SERVICE_ROLE_KEY`도 참조하므로 설정돼 있으면 함께 교체), `NEXT_PUBLIC_SITE_URL`(`https://alton.education` 또는 앱 정본 도메인으로 확정 — 이메일 링크 폴백. 서버 액션은 요청 origin을 우선 사용).
**새로 생성(운영 전용)**: `CRON_SECRET`(없으면 크론 503), `DOCUSIGN_WEBHOOK_TOKEN`(DocuSign 설정 시), SMTP: `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`(앱 알림 메일용 — 운영 발송 계정).
**유지(비밀 아닌 식별자 또는 공용 외부 키)**: `ANTHROPIC_API_KEY`(AI 기능 — 사용량 한도 확인), `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`, `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`(쓰기 플래그가 닫혀 있어 호출 없음), 모델 이름 계열(`GENERATION_MODEL`/`REVIEW_MODEL`/`WEAK_MODEL`)이 있으면 유지, `WORKSPACE_EVENTS_PUBSUB_TOPIC`/`WORKSPACE_EVENTS_PUSH_*`(Workspace 이벤트 — 플래그 닫힘이면 휴면).
**운영에 두지 않는다**: `SUPABASE_TEST_*`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `UAT_MATRIX_WRITE`, `ALTON_AI_SMOKE`, 스크립트 전용(`T*_SAMPLES_OUT`, `XIDS`, `ITEMS`, `GATE_SEEDS` 등).
**닫힘 스위치**: §5 표. `NEXT_PUBLIC_VERCEL_ENV=production`은 Vercel이 주입 → 분석이 운영에서만 켜진다(`lib/analytics/config.ts`).
**점검**: `vercel env ls production`의 이름 목록을 이 절과 대조해 닫힘 스위치가 하나도 `true`가 아닌지 확인. **Preview/Development env는 건드리지 않는다**(계속 비프로덕션 DB) — 운영 값이 Preview 범위로 새지 않게 변수 추가 시 환경(Production만)을 명시.
**참고(별건)**: `scripts/deploy-preview.sh`에 Vercel 자동화 우회 토큰이 평문으로 커밋돼 있다 — 운영 오픈 전 폐기·재발급 후 환경변수로 이동 권장(후속 작업 제안).

## 7. 오너 결정이 필요한 항목

1. **Supabase 플랜**: 지시는 free plan org. free는 비활성 7일 시 일시정지, 자동 백업·PITR 없음, Auth 내장 SMTP 시간당 2통(커스텀 SMTP로 해소), 파일 50MB 상한, 연결 수 제한. 공개 오픈에는 **Pro 권장**(백업 포함). 콘텐츠 용량은 약 수십 MB라 용량 문제는 없다.
2. **가입 봇 방어**: Captcha 코드 미구현(Supabase에서 켤 수 없음). 확인 메일 + rate limit로 오픈할지, Turnstile 연동을 오픈 전에 먼저 구현할지.
3. **검수자 운영 가입 금지 안내**: 오픈 전까지 검수자는 비프로덕션 사용. 운영 오픈 후 이전 순간에 같은 이메일이 운영에 이미 있으면 충돌(§4). 이전 → 안내 순서를 지킬지.
4. **복사할 세트 범위**: 전 상태 복사(기본) vs 발행(published) 세트만. 문항은 세트 항목이 참조하므로 세트 필터링 시 참조 문항만 복사하는 옵션을 추가할 수 있다(구현 요청 시).
5. **상담·예약 기능 공개 시점**: `CALENDAR_SYNC_ALLOW_REAL_CALLS` 닫힘이면 Meet 링크가 생성되지 않는다. 무료 학습(가입·모의고사·단어)만 먼저 공개하고 상담·예약은 플래그 승인 후 공개하는 단계 오픈을 권장.
6. **계약 자동 발송**: DB 시드 ON을 01 스크립트가 끄고 env `false`로 이중 정지. 켜는 시점은 계약 문안 최종·DocuSign 운영 계정 후(오너 승인).
7. **비프로덕션 테스트 오염 목록**(§3)과 `jiman@alton.education` 사전 등록(§2) 확인.

## 8. 배포·점검·롤백

### 8-1 배포
1. 릴리스 커밋 확정(전체 테스트는 신규 DB 1회, 오픈 직전 3회 반복은 CLAUDE.md 정책: "프로덕션 배포 직전에만"). `main` 대비 통합 브랜치 병합 상태 확인 — 마이그레이션 번호 충돌·누락(`migration list` local=remote) 점검(BRANCH-WORKFLOW 체크리스트).
2. Production env 반영(§6) **후** `vercel deploy --prod`(또는 Git 연결 프로덕션 브랜치 푸시) — [승인]. 첫 배포 결과가 `Ready`인지(Hobby에서 크론이 하루 1회 초과면 배포 자체가 실패하므로 `vercel.json` 그대로 유지).
3. 도메인: `alton.education`, `app.alton.education`이 프로젝트 `alton` Production에 연결·인증서 발급 확인.
4. `scripts/prod-launch/healthcheck.sh https://alton.education`(GET만): 랜딩·로그인·가입·재설정 200, 크론·웹훅 라우트가 무인증으로 거부(401/403/503 또는 405/501/503).
5. `03-verify-closed.sql` 재실행(배포 후에도 닫힘).

### 8-2 스모크(오너 로그인 창 + Claude UAT, 실행 ID 부여)
테스트 학생 가입(실행 ID 이메일) → 확인 메일 수신(영어 템플릿·링크 도메인) → `/signup/student/confirm` → `/student` → 모의고사 목록에 복사된 세트 노출 → 시작·제출·결과(해설 영어 기본) → 단어·오답노트 → 로그아웃. 종료 후 실행 ID 계정·응시 정리, 공식 계정 보존 확인. 관리자: master 로그인, 문제은행 건수가 복사 manifest와 일치.

### 8-3 롤백
- **오픈 전(실사용자 0명)**: ① Vercel에서 이전 배포로 Instant Rollback(`vercel rollback <deployment>` 또는 대시보드), 또는 도메인을 이전 프로덕션 배포에 재할당. ② env 변경은 Vercel 대시보드 환경변수 이력으로 되돌리고 재배포. ③ DB는 비어 있으므로 **새 프로젝트를 지우고 처음부터 재생성**하는 것이 가장 깨끗하다(콘텐츠 키트는 재실행 가능).
- **오픈 후(실사용자 있음)**: DB를 되돌리거나 재생성하지 않는다. 앱 이슈는 Vercel Instant Rollback, 데이터/스키마 이슈는 **새 번호 additive 마이그레이션으로 전진 수정**(CLAUDE.md). 배포 전 `supabase db dump --linked -f ~/.alton-secrets/prod-backup-<날짜>.sql`(데이터 포함 `--data-only` 별도)로 수동 백업 — Pro 전에는 이것이 유일한 백업. 가입 폭주·악용 시 비상 차단은 Auth의 "Enable sign ups" OFF, 계약·송금은 §5 스위치가 이미 닫혀 있음.
- **스위치 비상 정지**: `CONTRACT_AUTO_DISPATCH_ENABLED=false`(env, 재배포 불필요가 아니라 env 변경 후 재배포 필요) 및 DB 토글(관리자 화면, 즉시).

## 9. 로컬 검증 결과(이 문서 작성 시점)

- 내보내기: 로컬 DB(공유, 테스트 데이터 포함)를 원본으로 13개 표 내보내기 성공(예: problems 3,487, problem_versions 3,519, mock_exam_sets 140, items 2,613).
- 가져오기(빈 스크래치 DB, 별도 데이터베이스 `prodkit_scratch` 생성 후 삭제): dry-run → 롤백 확인(대상 0행), apply → 전 표 OK·고아 0·`published_version_id` 3,469행 채움·작성자 NULL, 재실행 → 신규추가 0(멱등). 안전장치 3종(비프로덕션 ref 거부, `--yes-production` 필요, ref 불일치 거부) 확인.
- 검수자 키트: 로컬 2계정(신고 304건·판정 4건) 내보내기 → 콘텐츠 적재된 스크래치 DB에 가져오기 dry-run/apply/재실행 OK, `raw_app_meta_data`에 `external_reviewer: true` 병합·비밀번호 해시 보존·일회용 토큰 초기화 확인. 판정자 override 없으면 중단 확인.
- 강화·마스터 SQL은 로컬에서 ROLLBACK 트랜잭션으로 실행해 문법·동작 확인(데이터 변경 없음).
- **미검증(운영 전 확인 항목, §10)**.

## 10. 운영 전 확인(로컬에서 못 본 것)

- Supabase 호스티드의 `postgres` 역할이 `set session_replication_role = replica`를 허용하는지(공식적으로 허용되나 새 프로젝트에서 dry-run으로 확인. 불가하면 `--no-replica` + 트리거가 막는 행을 개별 조사).
- 신규 프로젝트에서 `db push` 548개가 한 번에 성공하는지(112의 Vault 사전 점검 포함), `supabase_vault`가 기본 활성인지.
- Storage 그림 업로드(`figure.type='image'` 문항이 비프로덕션 원격에 몇 건 있는지는 원격 manifest의 `storage` 항목으로 확인).
- 새 프로젝트의 REST `max_rows`(기본 1000)와 내보내기 페이지(500)는 무관하지만, 대상 연결은 Session pooler(5432) 또는 직접 연결 사용(Transaction pooler 6543은 `session_replication_role`·다중 문장에 부적합).
