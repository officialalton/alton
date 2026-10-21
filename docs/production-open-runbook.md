# 정정(2026-10-15, 오너 확인): Production 은 비프로덕션과 같은 Supabase 프로젝트를 쓴다

> **2026-10-21 사용 범위 정정:** 이 문서 첫 10-15 정정과 [CURRENT](CURRENT.md)가 현재 기준이다. 아래 본문에 남은 '운영 프로젝트 없음·새 DB 생성·Hobby·계약/AI 문구 없음'은 이전 설계 기록이며 그대로 실행하지 않는다. Vercel Pro 전환은 10-19 정책에 기록됐고 실제 crons는 vercel.json을 확인한다. 공유 DB 쓰기는 운영 영향 작업으로 취급하며 새 DB 이관/reset 절차를 임의 실행하지 않는다. 최근 Stripe SQL 공유 DB 적용은 개발자 보고, Production 코드·자동 회수 활성화와 구분한다.

- Vercel Production 의 `NEXT_PUBLIC_SUPABASE_URL` = `https://worpsqwqgnspddnrtnvq.supabase.co` — 지금까지 '비프로덕션'이라 부른 바로 그 프로젝트다. 따라서 이 문서의 '새 프로젝트 생성 → 마이그레이션 594개 적용 → 콘텐츠 이관(§2)' 절차는 **필요 없다**. 마이그레이션과 콘텐츠(공개 세트 44개 포함)는 이미 이 프로젝트에 있다.
- 오픈 = (1) `main` 을 통합 브랜치로 fast-forward 해 Production 재배포 + (2) Production 환경변수 확인 + (3) **DB 안의 테스트·UAT 데이터 정리** + (4) 백업·요금제 + (5) 스모크 검증.
- 위험 변화: 이제 '비프로덕션'에서 하던 관리자 쓰기(AP 재고 적재, 새 버전 공개 등)는 곧 **라이브 데이터 변경**이다. Preview(review) 환경의 `AP_STOCK_ADMIN_ALLOWED_REFS` 허용 목록이 이 ref 를 포함하는 한 review 사이트의 관리자 쓰기가 라이브 학생에게 즉시 보인다. 오픈 후 콘텐츠 변경은 '새 버전' 흐름(기존 응시 보존)으로만, 변경 전 오너 확인을 받는다. Production 환경에는 `AP_STOCK_ADMIN_ALLOWED_REFS` 를 설정하지 않는다(관리자 AP 쓰기 차단 유지).
- 오너 확정(2026-10-15): official@alton.education 외 전부 테스트 계정으로 보며 정리 대상. 예외 허용: jiman@alton.education(컨설턴트), chrisy@alton.education(교사). 정리는 나중에 다시 협의 후 실행.
- 계정 현황(2026-10-15 SELECT): 141개 중 대부분이 테스트·UAT. 실사용으로 보이는 후보: chrisykim94@gmail.com, matchbox512@gmail.com / matchbox512@snu.ac.kr, jiman@springcamp.co, jiman@bulqot.co, official@alton.education(마스터·오너), admin2@alton.education, teacher1@alton.education, 컨설턴트 3명(consultant.jiman@, cs.jiman@, jiman@alton.education). 나머지(UAT/test/example.com/e2e/demo 패턴 + `deleted+…@removed.invalid`)는 정리 후보다. **삭제는 영구적이므로 오너가 목록을 확인·승인한 뒤 정확한 id 로만 실행한다.** 학생 데이터(응시 기록, 노출 기록)와 연결 가족·결제·계약 행의 연쇄를 먼저 점검한다.
- Production 환경변수는 값이 암호화 표시라 CLI 로 읽을 수 없다. 오너가 대시보드에서 정확한 값을 확인한다: `CONTRACT_AUTO_DISPATCH_ENABLED` = `false`(정확히 이 문자열), `AI_ESSAY_GRADING_ENABLED` = `true`(켤 때). 변경 뒤 재배포해야 반영된다.

# 운영(Production) 오픈 런북 v2 — AP/SAT 모의고사 콘텐츠 포함 (2026-10-15)

작성만 했다. 운영 자원(Supabase 운영 프로젝트, Vercel Production, env)에는 아무것도 실행·조회하지 않았다. 비프로덕션(`worpsqwqgnspddnrtnvq`)은 SELECT만 했다.

이 문서는 `docs/2026-10-08-production-launch-runbook.md`(v1, 새 Supabase 프로젝트 + 콘텐츠·검수자 키트 `scripts/prod-launch/`)를 **대체하지 않고 갱신**한다. v1의 Auth 설정·Vault·안전 스위치·검수자 이전·healthcheck 절은 그대로 유효하고, 이 문서는 v1 이후 생긴 변화(AP 콘텐츠, AI 채점, Function Storage, 마이그레이션 594개)와 v1의 빈틈을 다룬다. 표기: **[오너]** 대시보드·결제·승인, **[개발]** 개발 세션, **[STOP]** 오너 확인 전 진행 금지.

## 0. 한 장 요약

- 운영 Supabase 프로젝트는 문서상 **아직 없음**(CURRENT.md: "Vercel production 배포·마이그레이션 없음, 실제 고객 데이터 없음"). v1 방침 = 비프로덕션과 **별개의 새 프로젝트**를 만들고 빈 DB에 마이그레이션 전부 + 콘텐츠를 적재. 운영 ref는 **알 수 없음 — 오너가 확인**.
- 콘텐츠 이전의 가장 안전한 방법은 **표 단위 내보내기/가져오기(UUID 보존)** 이고 이미 키트(`scripts/prod-launch/`)가 있다. **그러나 키트는 AP 이후 표를 모른다**: `ap_candidate_items`/`ap_candidate_problems`/`ap_load_batches`/`ap_skills`/`ap_curriculum_editions`/`ap_exam_weights` 등이 빠져 있어, 이대로 올리면 관리자 AP 재고 화면이 비고 **"새 버전" RPC와 세트 공개 게이트가 실패**한다(§2-2). 키트 확장이 선행 작업이다.
- 스택 순서: **(a) 키트 확장+로컬 리허설 → (b) 운영 프로젝트 생성+백업 방침 결정 → (c) 마이그레이션 → (d) 콘텐츠 → (e) env → (f) 배포 → (g) 스모크**. 모든 운영 쓰기 단계는 dry-run 먼저, [오너] 승인 뒤 실행.
- AI 에세이 채점은 **오너가 원할 때만** 켠다(기본 꺼짐). **개인정보처리방침에 AI 채점 언급이 없다** — 켜기 전 문안 필요(§4).

## 1. "운영"의 현재 상태

### 1-1 Vercel (코드·문서 기준, 대시보드 값은 확인 불가)
| 항목 | 알려진 것 | 확인 필요 |
|---|---|---|
| 프로젝트 | `alton` (v1 런북). 도메인 `alton.education`, `app.alton.education` 을 Production에 연결하기로 돼 있음 | **[오너]** 실제 연결 여부, Production Branch가 `main`인지, 현재 production 배포가 있는지 |
| 플랜 | memory/문서: **Hobby**(Function Storage 10 GB 100% 도달 사건, `docs/vercel-function-size.md`). Hobby 크론 = 하루 1회 제한 | **[오너]** Hobby 유지 vs Pro. 상업 서비스 운영은 Hobby 약관상 부적절할 수 있음(비상업 용도 전용) → Pro 전환 권장 **[STOP]** |
| 리전 | `vercel.json` `regions: ["pdx1"]` | — |
| 크론 | 7개 전부 하루 1회(`0 17`, `30 17`, `0 18`, `0 19`, `30 19`) — Hobby 한도 준수. **`vercel.json` 크론을 하루 1회 초과로 바꾸지 말 것(배포가 조용히 실패)** | — |
| 브랜치 | 통합 브랜치 `preview/m4-integration-verification`가 `origin/main`보다 **2,345 커밋 앞서고 main에는 통합 브랜치에 없는 커밋 0**. merge-base `6ab5f401` | main에 직접 푸시가 곧 프로덕션 배포가 되는지(Git 통합) **[오너]** 확인 |

### 1-2 Supabase
- 운영 프로젝트: **unknown — 오너가 project ref 확인/생성**. 비프로덕션 `worpsqwqgnspddnrtnvq`는 운영에 연결하지 않는다(정책 10-07: 오픈 전 분리).
- 비프로덕션 상태(10-15 SELECT 확인): 마이그레이션 **594개, 최신 `20262100000610`, 로컬 파일 594개와 일치**. 운영은 0개 적용(빈 DB)이므로 **594개 전부가 미적용**이며 순서는 파일 번호순 그대로(`db push --include-all`).
- 파괴적 마이그레이션: 빈 DB에서는 기존 행이 없어 데이터 손실 없음. 단 파일에 `drop table|drop column|truncate|delete from`이 있는지 오픈 직전 `grep -il` 로 한 번 훑어 목록화하고(빈 DB에서만 안전한 것과 이후 재실행 위험을 구분), 비-IF-EXISTS 구문이 있으면 dry-run 로그에서 확인. 112번(`payout_account` Vault 키)은 Vault가 없으면 **의도적으로 중단**한다(v1 §2).
- 마이그레이션 중 **개인 이메일이 박힌 항목**: v1 §2 마스터 절 참고. 신규 DB에서 no-op, `jiman@alton.education` 컨설턴트 사전 등록만 남음 — **[오너]** 의도 확인.

## 2. 콘텐츠 문제 — 모의고사를 운영으로 옮기는 법

### 2-1 비프로덕션 규모(10-15 SELECT)
problems 9,195 · problem_versions 9,480 · problem_keywords 8,527 · subjects 24 · subject_keywords 3,118 · mock_exam_sets 167(**published 44**, archived 122, draft 1) · mock_exam_set_items 16,227 · `ap_candidate_items` 4,862 · `ap_candidate_problems` 2,831 · `ap_load_batches` 109 · `ap_skills` 243 · `ap_curriculum_editions` 13 · `ap_exam_weights` 142. 그림 파일(`figure.type='image'` 버전)은 2건. Storage는 `curriculum-assets` 15객체 58 MB, `teacher-documents` 1객체(콘텐츠와 무관, 이전 안 함). 테스트 계정 59명 등 사용자 데이터는 전부 제외 대상.

### 2-2 옵션 비교
| | A. 운영에서 관리자 배치 적재 재생성 | B. 표 단위 내보내기/가져오기(UUID 보존, 키트) |
|---|---|---|
| 방식 | 저장소의 `data/ap/**` 재고 파일로 '배치 전체 적재'·변환·세트 저장을 운영에서 재실행 | `scripts/prod-launch/export-content.ts` → `import-kit.ts`(dry-run → apply) |
| 충실도 | **낮음**. 공개 세트는 v2/v3 새 버전·교체안(`*swap-plan*.json`)·감사 수선·실텍스트 교체(USH/EngLit)를 거쳐 DB가 저장소 JSON과 달라졌다. 재생성하면 UUID·버전 이력·`content_snapshot`이 달라지고 공개 세트와 동일하다고 보장 못 함 | **높음**. 같은 UUID·같은 행. 세트/문항/버전 FK 그대로 |
| 위험 | 관리자 화면 쓰기 가드 `AP_STOCK_ADMIN_ALLOWED_REFS`는 운영을 **항상 거부**(정책 10-12) → 운영 변경에 별도 승인·코드 변경 필요 | 키트 확장 필요(아래), 대량 INSERT가 `session_replication_role=replica` 필요(v1 §10 미검증) |
| 시간 | 수 시간 + 각 배치 검증 | 분 단위 + 행 수·고아 검사 |
| 판정 | 비권장(보조: 새 과목 추가 시에만) | **권장** |

### 2-3 B의 빈틈(필수 확장) — 참조 무결성 분석
키트(`content-tables.ts`) 포함 표: `problem_skill_codes`, `subjects`, `subject_template_units`, `subject_keywords`, `subject_template_unit_keywords`, `problems`, `problem_versions`, `problem_keywords`, `mock_exam_sets`, `mock_exam_set_items`, 가중치 3종. **AP 표가 없다.** FK 분석(`pg_constraint`, 비프로덕션):
- `ap_candidate_items`/`ap_candidate_problems` → `problems`, `problem_versions`, `subjects` FK. `ap_skills`/`ap_curriculum_editions`/`ap_exam_weights`/`ap_stock_*` → `subjects` FK.
- DB 함수가 이 표를 **런타임에** 읽는다: `_mock_exam_ap_publish_gate`, `_mock_exam_ap_set_item_guard`(마이그 401/500), `mock_exam_create_new_version`·`mock_exam_publish_set`(481/530), `mock_exam_ap_pool`(421), `ap_refresh_stock_cells`. 즉 이 표가 비면 **운영에서 새 버전·공개·풀 조회가 실패**하고 관리자 AP 재고 화면은 0으로 보인다. 학생 응시 자체는 세트 항목의 `content_snapshot`으로 돌아가므로 영향 없을 가능성이 높으나 **로컬 리허설에서 확인 필수**.
- 순환 FK(`problems.published_version_id`)는 키트가 2단계로 처리(v1 §3).

**확장 항목(추가 순서, FK 부모 먼저)**: `ap_skills`, `ap_curriculum_editions`, `ap_exam_weights`(과목 부모 후; 이 표는 `scripts/ap-curriculum/seed-sql.ts`로도 재생성 가능하나 내보내기가 UUID 일치에 안전) → `ap_load_batches` → `ap_candidate_items` → `ap_candidate_problems` → `ap_stock_targets`/`ap_stock_cell_targets`/`ap_stock_purpose_targets`. `ap_stock_cells`(현재 0행, 갱신 함수가 채움)·`ap_launch_blockers`(0행)·`ap_generation_calls`·`ap_stock_admin_runs`·`ap_candidate_review_history`(비프로덕션 작업 이력)는 **제외 권장**; `ap_generation_calls`는 비용·모델 호출 기록이라 운영에 불필요.
**복사할 세트 범위 [STOP]**: published 44개만 vs 전체 167개(archived 122 = 이전 공개본, 응시자 없는 운영에선 불필요). 권장 = **published 세트 + 그 세트가 참조하는 문항/버전만**, 단 `mock_exam_create_new_version`이 이전 버전 계보(`set_group_id`/`version_no`)를 읽으므로 archived가 최신 published의 부모면 함께 복사할지 로컬에서 확인. 키트에 "세트 필터링" 옵션은 없음(v1 §7-4: 구현 요청 시) → 추가 구현 필요.
**테스트 오염 [STOP]**: 키트 manifest `warnings`의 UAT/테스트 과목·키워드 목록을 오너가 확인. 비프로덕션 문항 `created_by` 등은 NULL 처리(기본).
**Storage**: 이미지 그림 문항 2건의 `problem-assets` 파일 — 키트가 업로드. `curriculum-assets`(58 MB)는 교재 PDF 등이라 모의고사와 무관, **이전하지 않음**(필요하면 별도).

### 2-4 구체 절차(전부 dry-run 먼저. 아래는 작성만 했고 실행 안 함)
0. **로컬 리허설 [개발]**: 빈 로컬 격리 스택(포트 변경 — CLAUDE.md의 격리 스택 절차)에 마이그레이션 594개 적용 → 확장한 키트로 가져오기 → `scripts/prod-open/content-counts.sql`을 원본·대상에 실행해 diff 0 → 학생 계정으로 앱에서 AP/SAT 세트 하나씩 응시·제출, 관리자 화면에서 새 버전 초안 만들기·공개까지 확인. 공유 로컬 DB(54422)에서 하지 않는다(타 세션 reset 위험).
1. **콘텐츠 동결 [오너/개발]**: 내보내기 시작~운영 반영 끝까지 비프로덕션에서 문항·세트 쓰기(AP 생성 에이전트 포함) 중단. 스냅샷이 아니라 REST 페이지 읽기라서 필수(v1 §3).
2. 내보내기(비프로덕션 읽기 전용): `SOURCE_SUPABASE_URL=https://worpsqwqgnspddnrtnvq.supabase.co SOURCE_SUPABASE_SECRET_KEY=… npx tsx scripts/prod-launch/export-content.ts`
3. 대상 확인: `cat supabase/.temp/project-ref` == 운영 ref, 그리고 `psql "$PROD_DB_URL" -c "select count(*) from public.problems"` == 0(빈 DB일 때만 적재).
4. dry-run: `TARGET_DB_URL=$PROD_DB_URL npx tsx scripts/prod-launch/import-kit.ts --dir <폴더> --target-ref $PROD_PROJECT_REF` (전 트랜잭션 ROLLBACK) → 표별 OK, 고아 0.
5. **[STOP] 오너 승인** 후 `--apply … --yes-production`.
6. 검증: `scripts/prod-open/content-counts.sql`을 운영에서 실행해 원본 manifest와 대조, 고아 0, published 세트 수·문항 수 일치. 공개 세트 하나를 운영 UI(테스트 학생)로 열어 해설·그림 확인.
7. 검수자 계정 이전(v1 §4)은 오픈 시점 별도 작업. 콘텐츠 복사는 **검수 종료 후 최신**으로.

## 3. Vercel Production 배포

### 3-1 병합 전략
`main`에는 통합 브랜치에 없는 커밋이 0이므로 **fast-forward 가능**. 권장: 통합 브랜치에서 릴리스 태그(예 `release-2026-10-xx`)를 찍고, `main`을 그 커밋으로 fast-forward(`git merge --ff-only`) → 푸시. 푸시가 곧 Production 배포이면(Git 통합) 반드시 **env 설정·마이그레이션·콘텐츠 적재가 끝난 뒤**에 푸시한다. 로컬 미커밋 변경(`data/ap/sample-2027/ledger-summary.json`)은 릴리스에서 제외. 병합 직전 BRANCH-WORKFLOW 체크리스트(마이그레이션 번호 충돌, `migration list` local=remote). 전체 테스트는 신규 DB 1회, 배포 직전 3회 반복(CLAUDE.md 정책) — 단 실패 테스트가 python `numpy` 부재 같은 환경 문제인지 구분.

### 3-2 Production 환경변수(이름만; v1 §5·§6이 상세 정본)
- **필수(새 운영 프로젝트 값)**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`(코드 일부가 읽음), `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`(`https://alton.education`), `CRON_SECRET`(없으면 크론 503), SMTP 5종(`SMTP_*`, `EMAIL_FROM`).
- **닫힘 명시**: `CONTRACT_AUTO_DISPATCH_ENABLED=false`(미설정이면 열림), 나머지 외부 쓰기 플래그(`PAYOUT_CRON_ENABLED`, `RETENTION_BATCH_ENABLED`, `CALENDAR_SYNC_ALLOW_REAL_CALLS`, `WORKSPACE_*`, `DRIVE_*`, `DOCUSIGN_*`, `MERCURY_*`, Stripe)는 **설정하지 않는다**.
- **AP 관리자 쓰기 가드**: `AP_STOCK_ADMIN_ALLOWED_REFS`는 운영에 **설정하지 않음**(기본 전부 거부). `AP_STOCK_ADMIN_BLOCKED_REFS`에 운영 ref를 넣어 이중 차단 권장.
- **AI 채점(오너가 원할 때만)**: `AI_ESSAY_GRADING_ENABLED=true` + `ANTHROPIC_API_KEY`(운영용 별도 키 권장). 한도 기본값은 코드/정책에 이미 있음 — 응시당 영어 3건·History 6건, 계정 일 상한(영어 6·History 12), 월 예산 `AI_ESSAY_MONTHLY_BUDGET_USD`(정책: $25, **절대 상한이 아닌 근사 한도** — 호출 전 원자 예약이지만 단가 가정·예외 호출 비용은 반영 안 됨), 모델 `AI_ESSAY_MODEL`, 토큰 `AI_ESSAY_MAX_INPUT_TOKENS`/`AI_ESSAY_MAX_OUTPUT_TOKENS`, 단가 `AI_ESSAY_USD_PER_M_INPUT`/`_OUTPUT`. **월 상한을 env에 명시**(기본값 의존 금지)하고, 마이그레이션 `20262100000650`의 비용 원장(`essay_ai_cost_events`)과 `essay_ai_cost_daily`가 월 집계를 한다. 정책: 실호출은 유료 승인·앵커 샘플 보정 뒤. 문서상 영어 샘플 점수 일부는 사람 채점이 아직 필요(`docs/ap/essay-ai-calibration.md`). **켜지 않으면 `ANTHROPIC_API_KEY`도 AI 기능(단어 뜻풀이 등) 용도 외에는 불필요** — 키 소유 시 다른 AI 기능 비용이 운영에서 발생하므로 상한을 Anthropic 콘솔에서도 설정 **[오너]**.
- **분석**: 코드는 `NEXT_PUBLIC_VERCEL_ENV === "production"`일 때만 켠다(`lib/analytics/config.ts`). 대시보드에 데이터가 쌓이려면 **Vercel Project → Analytics 활성화 [오너]**, 그리고 `next.config.ts`가 `NEXT_PUBLIC_VERCEL_ENV`를 주입하는지 첫 배포 후 확인.
- 운영에 두지 않음: `SUPABASE_TEST_*`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `UAT_*`, `ALTON_AI_SMOKE`. Preview/Development env는 건드리지 않는다. env 추가 시 **Production 범위만** 선택.

### 3-3 조용히 배포를 깨는 것들
1. **Hobby 크론 > 하루 1회**: 배포가 아예 생성되지 않거나 `Deployment failed`(메모리). 원인은 GitHub 커밋 상태의 `vercel.link/3Fpeeb1`. 현재 `vercel.json`은 안전.
2. **Function Storage 10 GB**: 과거 한도 도달. `docs/vercel-function-size.md`의 절감(2,677→359 MB) 반영분이 릴리스에 포함돼야 함 — 배포 후 `vercel inspect`로 람다 크기 확인. **Deployment Retention** 단축, 오래된 Preview 정리 **[오너]**. 새 `process.cwd()` 동적 fs 읽기가 추적 범위를 다시 키우므로 릴리스 전 `next build` 후 `.next/server/app/**/*.nft.json` 크기 점검 **[개발]**.
3. 빌드는 `data/ap` 일부 JSON(AP 재고 패널)을 번들에 의존 — excludes 설정이 유지되는지.
4. Auth Redirect URL에 `*.vercel.app` 와일드카드 금지(운영 토큰이 Preview로 샘, v1 §2).

## 4. 사전 점검(pre-flight)

### 4-1 보안(RLS) — 비프로덕션 점검 결과
- `public` 스키마 **모든 일반 테이블 RLS 활성**(RLS 꺼진 테이블 0).
- AP/채점 표: `ap_*` 14개 RLS ON(정책 0개인 `ap_launch_blockers`·`mock_exam_frq_handwriting`는 **정책 없음 = 클라이언트 전면 거부**, 서버 RPC/서비스 키만 접근 — 의도된 것으로 보이나 **[개발]** `mock_exam_frq_handwriting`을 학생이 RPC로 정상 저장·조회하는지 UAT에서 확인), `mock_exam_essay_scores` RLS ON·정책 1. `essay_ai_cost_daily`는 테이블이면 RLS 별도 확인(위 쿼리에서 관계 종류 'r' 필터에 안 걸렸으므로 뷰일 수 있음 — 마이그 600 직접 확인).
- 오픈 전 **[개발]**: `supabase/migrations`의 SECURITY DEFINER 함수 중 `search_path` 고정·`revoke execute from public/anon` 누락 점검(이번 AP RPC: `mock_exam_ap_enter_section`, `mock_exam_publish_set`, `mock_exam_create_new_version` 등을 anon으로 호출해 거부되는지 운영 스모크에서 실측). `/security-review` 실행 권장.
- 크론·웹훅 라우트가 무인증으로 거부되는지는 v1 `healthcheck.sh`.

### 4-2 AI 채점 비용·문구
- 한도는 위 §3-2. 월 $25 상한은 코드 가드 + Anthropic 콘솔 이중 설정.
- **프라이버시 정책 갭**: `app/privacy/page.tsx`에 AI/제3자 처리자(Anthropic)·에세이 전송 언급이 **없다**(grep 0건). 정책상 "에세이 원문 미저장"이지만 **전송 사실은 고지 필요**. 채점을 켜기 전에 정책 문안 추가 **[STOP — 법무 문안은 오너/계약 문안 세션]**. 정책 10-14: 결과는 'AI estimated score — internal estimate', 공식 점수 아님 표기(UI 확인).

### 4-3 상표(AP, SAT, College Board)
- 현재 문구: 결과 화면 "…not equivalent to an official SAT / College Board score", "Internal estimate — … not an official College Board score", 약관의 "점수·성과 보장 없음". **"AP®/SAT® are registered trademarks of College Board, not affiliated with or endorsed by" 형태의 비제휴·상표 고지는 코드에서 찾지 못했다**(grep). 오너 정책(10-05): "'50 Free SAT & AP Practice Tests', AP 문구 그대로, **안전장치 추가 금지**". 따라서 **임의로 추가하지 않는다 [STOP]**: 오너에게 "푸터에 한 줄 비제휴 고지 추가"를 질문(정책이 막은 범위가 '안전장치'일 수 있음). 위험: College Board 상표 정책은 상업적 시험 대비 서비스의 상표 사용에 비제휴 고지를 요구하는 편 — 법무 확인 권장.

### 4-4 오류 화면 영어
정책 10-13(오류·시스템 화면 전부 영어, 관리자 포함). `app/error.tsx`, `global-error.tsx`, `not-found.tsx` + `app/error-boundaries.test.tsx` 가드가 있음. 배포 전 해당 테스트 + 운영에서 `/존재하지않는경로` 수동 확인.

### 4-5 실사용자에게 나가는 메일
- 콘텐츠 이전·세트 공개는 **메일을 트리거하지 않는다**(`lib/mock-exam`, `lib/ap-admin`, `lib/ap-exam`에 메일 발송 호출 없음, grep 확인). 이전은 SQL 적재라 앱 로직·알림도 우회(트리거 off).
- 오픈 후 나가는 메일: Supabase Auth(가입 확인·재설정, 커스텀 SMTP 필수 — v1 §2), 앱 알림(`SMTP_*`). **계약 자동 발송은 DB 시드가 true라 강화 SQL(`01-post-migration-hardening.sql`)로 끄고 env로 이중 정지** — 이 단계 누락 시 실제 고객에게 DocuSign 메일 위험(v1 §5, **가장 중요한 안전 단계**).
- 검수자 이전 시 비밀번호 해시 계정이 생길 뿐 메일은 나가지 않음(토큰 컬럼 초기화).

### 4-6 백업·롤백(단계별)
| 단계 | 사전 백업/게이트 | 롤백 |
|---|---|---|
| 운영 프로젝트 생성 | **[STOP] 플랜 결정**: Free = 자동 백업·PITR 없음, 7일 비활성 일시정지. 공개 오픈은 Pro(+필요 시 PITR add-on) 권장. Vault 키가 백업에 포함되는지 확인 | 프로젝트 삭제 후 재생성(데이터 0) |
| 마이그레이션 594 | dry-run 로그 보관. 빈 DB라 백업 불필요 | 오픈 전: 프로젝트 재생성이 가장 깨끗. 오픈 후: 새 번호 additive로 전진 수정(CLAUDE.md), 적용된 파일 수정 금지 |
| 강화 SQL·마스터 | 전후 `03-verify-closed.sql` | 같은 스크립트 재실행(멱등) |
| 콘텐츠 적재 | 적재 전 `pg_dump` 또는 Pro 백업 시점 기록 | 빈 DB 기준: 콘텐츠 표 truncate(오픈 전만) 또는 프로젝트 재생성. 오픈 후엔 삭제 금지, 새 버전으로 교체 |
| env | Vercel env 이력/스크린샷(이름만) | 값 되돌리고 재배포 |
| 배포 | 이전 production 배포 ID 기록 | Instant Rollback / 도메인 재할당 |
| 오픈 후 데이터 | 배포 전 `supabase db dump --linked -f ~/.alton-secrets/prod-backup-<날짜>.sql`(+`--data-only`), Pro는 PITR | 앱=롤백, 데이터=전진 수정. 가입 폭주·악용 시 Auth "Enable sign ups" OFF |

## 5. 배포 후 검증

### 5-1 [개발] 자동/반자동(테스트 계정은 실행 ID 포함, 종료 후 정리)
1. `healthcheck.sh https://alton.education`(GET만): 랜딩·로그인·가입·재설정 200, 크론·웹훅 무인증 거부.
2. `03-verify-closed.sql` 배포 전·후: 계약·정산 스위치 전부 f, 사용자 수 기대치.
3. 콘텐츠: `content-counts.sql` 운영 vs 원본 diff 0.
4. 학생: 가입→확인 메일(영어 템플릿·링크 도메인)→`/student` 무료 홈→Practice Tests 목록(번호 오름차순)→SAT 1세트 응시·제출→AP 1세트(섹션 Start section, 서버 타이머, Exit 버튼)→결과(해설 영어 기본+한국어 토글)→AP FRQ Handwrite→단어·My Notebook→로그아웃.
5. 관리자: master 로그인, 문제은행 건수 = manifest, 'AP 재고 관리' **쓰기 거부 메시지 확인**(운영 보호), 새 버전 초안 UI 열림(실행 금지).
6. 익명으로 RPC/REST 호출 거부 확인(AP RPC 3~4개).
7. 에세이 채점은 플래그 꺼진 상태에서 UI가 숨겨지거나 안내만 하는지; 켜는 경우 소액 실제 제출 1건·비용 행 기록 확인.
8. 분석: Vercel Analytics 활성화 후 페이지뷰 수집, 앱 이벤트(`lib/analytics/track`) 도달 확인.
9. 모니터링: Vercel 로그(함수 오류율), Supabase 로그·Auth 로그, 크론 첫 실행(다음 17:00 UTC 이후) 응답 코드와 `close-pending-accounts` 동작 관찰 며칠.

### 5-2 [오너]
Supabase·Vercel 프로젝트 생성/플랜/Analytics/도메인 DNS/Auth 설정(Site URL·Redirect·SMTP·템플릿 제목 영어·Google OAuth 운영 Client)/Anthropic 상한, 공개 전환(DNS·랜딩 링크), 로그인이 필요한 Google 계정 UAT 창.

## 6. [STOP] 오너 확인 지점
1. 운영 Supabase 프로젝트 ref(없으면 생성), **플랜(Pro/백업)**, Vercel 플랜(Hobby 상업 이용 적합성·크론).
2. 복사할 세트 범위(published만 vs 전체)와 테스트·UAT 과목/키워드 제외 여부.
3. 운영 DB 쓰기 3종 각각 승인: 마이그레이션 push, 강화 SQL, 콘텐츠 apply.
4. Production 환경변수 변경 승인 및 **main 푸시(=Production 배포) 승인**.
5. AI 채점 켤지 여부(유료, 월 $25, 프라이버시 문안 선행, 영어 샘플 사람 채점 보정).
6. AP/SAT 비제휴 고지 추가 여부(정책 "안전장치 추가 금지"와 충돌 가능).
7. 상담·예약 공개 시점(`CALENDAR_SYNC_ALLOW_REAL_CALLS` 필요; 무료 학습만 먼저 공개 권장), 계약 자동 발송은 문안·DocuSign 운영 계정 확정 전 닫힘 유지.
8. 가입 봇 방어(Captcha 코드 미구현이라 Supabase에서 켜면 가입 전부 실패 — 확인 메일+rate limit로 갈지).
9. 검수자 운영 가입 금지 안내와 이전 시점, `jiman@alton.education` 사전 등록 의도.
10. 콘텐츠 동결 창(AP 생성·예산 소진 에이전트 중단 시점).

## 7. 지나가며 발견한 위험
- v1 키트가 AP 표를 몰라 그대로 쓰면 **새 버전·공개 게이트 RPC 실패** (§2-3). 가장 큰 위험.
- 프라이버시 정책에 AI 에세이 전송 고지 없음 (§4-2).
- AP/SAT 비제휴·상표 고지 코드에 없음, 오너 정책과 충돌 가능 (§4-3).
- `scripts/deploy-preview.sh`에 Vercel 자동화 우회 토큰 평문 커밋(v1 §6): 오픈 전 폐기·재발급.
- 정책 문서의 "마이그레이션 `…500`/`…560` 미적용 원격" 표기는 낡음 — 실측 비프로덕션은 `…610`까지 전부 적용.
- 로컬 미커밋 `data/ap/sample-2027/ledger-summary.json` — 릴리스에서 제외, AP 생성 원장 병합 규칙(항목 합집합) 유의.
- 비프로덕션에 59개 테스트 학생, 5개 admin 프로필 — 운영 콘텐츠 키트는 사용자 표를 안 올리지만 `created_by` NULL 처리 후 감사 기록이 비는 것은 의도.
- `AP_STOCK_ADMIN_ALLOWED_REFS` 오설정이 운영 쓰기를 열 수 있으므로 운영 env에 절대 두지 않기.
- Supabase `session_replication_role=replica` 허용 여부 미검증(v1 §10), Free 플랜 일시정지, Vault 키 백업 포함 여부 미확인.
- Vercel 호스티드 람다 크기·개수는 로컬 재현 불가 — 배포 후 `vercel inspect`.

## 8. 권장 순서(요약)
1. [개발] 키트 확장(AP 표, 세트 필터) + 로컬 격리 스택 리허설 + `content-counts.sql` diff 0 + 응시·새 버전·공개 UAT.
2. [오너] §6의 1·2·5·6 결정(플랜·세트 범위·AI 채점·고지).
3. [오너] 운영 Supabase 생성(+Pro/백업), Vault 점검, Auth 설정.
4. [개발+승인] 마이그레이션 dry-run→push→diff 0 → 강화 SQL → 마스터 부트스트랩.
5. [개발+승인] 콘텐츠 동결→내보내기→dry-run→apply→검증.
6. [개발+승인] Production env(닫힘 스위치 명시)→`main` ff 푸시/배포→healthcheck→스모크.
7. [오너] 공개 전환(DNS·랜딩). 이후 검수자 이전, 상담·예약·AI 채점은 별도 승인으로 단계 오픈.

헬퍼: `scripts/prod-open/content-counts.sql`(읽기 전용; 실행 전 `cat supabase/.temp/project-ref`로 대상 확인).
