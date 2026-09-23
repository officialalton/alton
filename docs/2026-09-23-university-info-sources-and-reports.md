# 대학 정보 출처 URL 관리 + 오류 신고함 (2026-09-23)

## 배경
이전 세션 체인(다른 에이전트 실행 기록 확인 결과, 이 브랜치는 이번 세션 시작 시점까지
`university_source_urls`/`university_data_reports` 관련 실제 코드 변경이나 커밋이
전혀 없었다 — HEAD가 통합 브랜치 `preview/m4-integration-verification`와 동일 커밋
(`76f59e3`)에 멈춰 있었고, 최근 커밋들은 전부 컨설턴트 포털/린트 등 다른 담당 작업이었다.
이번 세션은 지시서에 따라 하위 에이전트를 더 spawn하지 않고 직접 구현했다).

기존 `universities`/`university_admission_cycles`/`university_essay_prompts`(미확인)/
`university_updates` 스키마는 Part 2~5 마이그레이션(`20261421000000`~`20261428000000`)에서
이미 구축돼 있었다. 이번 라운드(Part 6)는 그 위에 **출처 URL 레지스트리**와
**공개 오류 신고함**만 추가했다 — 지시서 5개 항목 중 (a)와 (d)에 해당.

## 이번에 구현한 것
1. **마이그레이션** `supabase/migrations/20261473000000_college_db_p6_source_urls_and_reports.sql`
   - `university_source_urls`: 대학별 출처 URL을 유형(`source_type`)·연도(`cycle_year`)·
     공식여부(`is_official`)·상태(`pending`/`approved`/`rejected`)로 관리. RLS로 미승인
     URL은 `select`에서 제외(공개·수집 대상 아님). 컨설턴트는 본인 명의 `pending`만
     insert 가능, 승인/거절은 관리자(service_role)만. URL은 `http(s)://`만 허용(SSRF
     방지의 최소 전제 — 실제 수집 시점의 스킴/사설 IP 재검사는 아직 미구현, Part 7 소관).
   - `university_data_reports`: 로그인한 누구나 본인 명의로 오류 신고 생성 가능,
     본인 신고 조회 가능, 처리(상태 변경)는 관리자만.
2. **관리자 액션** (`lib/universities/actions.ts`에 추가): `listUniversitySourceUrls`,
   `addUniversitySourceUrl`(직접 승인 등록), `reviewUniversitySourceUrl`(제안 승인/반려),
   `listUniversityDataReports`, `resolveUniversityDataReport`.
3. **사용자(컨설턴트) 액션** (`lib/universities/user-actions.ts`, 신규): 본인 세션
   클라이언트로 실행해 RLS가 실제 안전망이 되도록 함(서비스 역할 클라이언트 미사용) —
   `proposeUniversitySourceUrl`(컨설턴트/관리자, 항상 pending), `reportUniversityDataIssue`
   (로그인한 모든 역할).

## 검증
- `npx tsc --noEmit -p .` — 변경 파일 관련 오류 없음(node_modules가 없던 워크트리라
  `npm install` 먼저 수행, 이후 정상 실행 확인).
- `npx eslint lib/universities/actions.ts lib/universities/user-actions.ts` — 오류 없음.
- 이 모듈에 대한 기존 단위 테스트는 없었다(신규 테스트는 이번 라운드에 작성하지 않음 —
  아래 미완료 참고).

## 2차 세션 추가분 (2026-09-23, 이어서)
- **마이그레이션 파일명 rename**: 통합 세션(다른 브랜치 담당)에서 공유 non-prod DB에
  `20261473000000_r_consultant_assignment_from_onboarding.sql`이 이미 적용/확정됐다는
  알림을 받아, 아직 push하지 않은 우리 파일을 `git mv`로 내용 변경 없이
  `supabase/migrations/20261480000000_college_db_p6_source_urls_and_reports.sql`로
  rename(별도 커밋). 이후 이 브랜치의 신규 마이그레이션은 `20261480000000` 이후
  번호부터 이어서 사용할 것.
- **관리자 UI 배선(지시서 A 일부)**: `app/admin/universities/UniversitiesPanel.tsx`
  대학 상세 화면 하단에 "출처 URL" 섹션(`SourceUrlsSection`) 신규 추가 —
  `listUniversitySourceUrls`로 목록/상태 배지(검토대기/승인/반려) 표시,
  `addUniversitySourceUrl`로 즉시-승인 등록 폼(URL·유형·연도·공식여부 체크박스),
  pending 항목에 `reviewUniversitySourceUrl` 승인/반려 버튼. 검증: `npx tsc --noEmit -p .`
  (이 파일 관련 신규 오류 없음 — 기존에도 있던 `app/layout.tsx`의 `LayoutProps` 오류는
  이번 변경과 무관한 사전 존재 이슈), `npx eslint app/admin/universities/UniversitiesPanel.tsx`
  (오류 없음, `react-hooks/set-state-in-effect`는 코드베이스 관용 패턴대로 disable-line 처리),
  `npx vitest run scripts/universities-seed.test.ts`(통과, 이 영역에 대한 유일한 기존 테스트).

## 3차 세션 추가분 (2026-09-23, 지시서 A 마무리)
- **관리자 오류 신고함 화면**: `UniversitiesPanel.tsx`에 `ReportsInboxSection` 추가.
  `listUniversityDataReports`(전체 조회 후 해당 대학으로 클라이언트단 필터 — 대학별
  전용 조회 액션은 아직 없음, 아래 결정 필요 참고)로 목록을 보여주고, `open` →
  `in_review` → `resolved`/`dismissed` 상태 전이 버튼과 처리 메모 입력을 연결.
- **공개 대학 상세 화면(학생/학부모/컨설턴트/교사 공용, `app/components/CollegeExploreSection.tsx`)**:
  - `loadUniversityDetail`(관리자·학생 공용 내부 함수, `lib/universities/actions.ts`)이
    `status='approved'`인 `university_source_urls`도 함께 반환하도록 확장(additive —
    반환 객체에 `sourceUrls` 필드 추가, 기존 필드는 변경 없음). "출처" 섹션에 렌더링.
  - "정보 오류 신고" 버튼 추가 → `reportUniversityDataIssue` 연결(일반 신고 + `fieldPath`
    입력으로 필드 단위 신고 모두 가능).
- **컨설턴트 포털의 출처 URL 제안 UI**: `RoadmapView`에 `canProposeSourceUrl` prop 추가,
  `app/consultant/ConsultantShell.tsx`에서만 `true`로 전달(학생/학부모/교사/관리자 쪽은
  기본 `false` — 화면 자체가 안 보임, 서버 액션도 어차피 역할 검사로 막혀 있음).
  신규 액션 `listMySubmittedSourceUrls`(`lib/universities/user-actions.ts`)를 만들어
  본인 세션 클라이언트로 본인이 제안한 URL 전체 상태(대기/승인/반려 + 반려 사유)를
  조회 — 기존 RLS 정책 `university_source_urls_select_own_submission`
  (`submitted_by = auth.uid()`)이 이미 이걸 허용하고 있어서 새 정책은 필요 없었다.

### 검증
- 로컬 `supabase db reset` 실행 — 로컬 DB에 P6 마이그레이션(`20261480000000`)이
  적용 안 돼 있어 `university_source_urls` 테이블이 스키마 캐시에 없는 상태였음을
  발견하고 반영(전체 마이그레이션 재적용, 정상 완료).
- `npx tsc --noEmit -p .` — 이번 변경 관련 신규 오류 없음(기존 `app/layout.tsx`의
  `LayoutProps` 오류만 남음, 무관한 사전 존재 이슈).
- `npx eslint app/admin/universities/UniversitiesPanel.tsx app/components/CollegeExploreSection.tsx app/components/RoadmapView.tsx app/consultant/ConsultantShell.tsx lib/universities/actions.ts lib/universities/user-actions.ts` — 오류 없음.
- `npx vitest run lib/universities/actions.integration.test.ts scripts/universities-seed.test.ts` — 11/11 통과.
- 커밋: `fec40ff`.

## 미완료 (지시서 대비) — 이번 세션 종료 시점 기준
- A는 이번 세션에서 마무리(위 3차 세션 추가분 참고). 다만 관리자 신고함이 대학별
  전용 서버 액션(`listUniversityDataReportsForUniversity` 같은) 없이 전체 목록을
  받아 클라이언트에서 필터링하는 방식이라 신고가 많아지면 비효율 — 개선 여지 있음.
- 이 섹션들에 대한 컴포넌트 단위 테스트 없음(기존에도 `UniversitiesPanel`/
  `CollegeExploreSection` 테스트 자체가 없음 — 새로 작성하지 않음).
- Admitted Student Profile 지표(지시서 B) — 전혀 미착수. 기존 Part 5(`20261428000000`)
  구조로 연도/대상집단/공식여부/출처·확인일을 표현 가능한지조차 미확인.
- 지원연도별 에세이 프롬프트 확장(지시서 C) — 전혀 미착수. `university_essay_prompts`
  테이블은 실재하며(Part 2/3 마이그레이션, `id/university_id/cycle_year/prompt_text/
  word_limit/is_required` 컬럼 확인됨 — `loadUniversityDetail`에서 이미 조회 중),
  다만 공통/자체/짧은답변/조건부(단과대·전공)/선택규칙 구분 컬럼은 없다. 확장 미착수.
- 수집봇 + 필드별 변경안 검토 큐(지시서 D) — 전혀 미착수.
- 10개교 실선정 UAT → 200개교 상태 관리(지시서 E) — 전혀 미착수.
- `npx supabase db push --linked`, `vercel deploy` 미실행(지시대로 통합 세션 담당).

## 결정 필요
- B~E는 스키마 설계(신규 정규화 테이블 `university_admission_metrics`, 에세이 조건부
  구조, 크롤러 아키텍처, robots.txt/사설 IP 차단 정책)부터 필요한 다중 세션 분량 작업이라
  이번 세션 내에서도 시작하지 못했다(A 마무리에 세션을 전부 사용). 다음 세션에서
  B부터(스키마 설계 우선) 이어가는 것을 제안한다.
- 관리자 신고함이 대학별 전용 조회 액션 없이 전체 신고를 받아 클라이언트에서 필터링하는
  임시 구조인데, 신고 건수가 늘어나기 전에 `listUniversityDataReports(universityId?)`
  형태로 서버 필터를 추가할지 여부 — 지금은 단순성 우선으로 보류.

## 제안 마이그레이션
`supabase/migrations/20261480000000_college_db_p6_source_urls_and_reports.sql`
(원래 `20261473000000`이었으나 충돌 회피를 위해 rename, 내용 동일) — non-prod 반영 필요
(이번 세션에서 `db push`는 실행하지 않음).

## 4차 세션 (2026-09-23, 지시서 B: 합격·등록 학생 학업 지표) — 완료

### 완료
- **스키마 재확인**: `university_admission_cycles`(Part 4/5)에 이미 flat 컬럼으로
  `sat_ebrw_25/75`, `sat_math_25/75`, `act_composite_25/75`, `gpa_25/75`,
  `gpa_average`, `total_applicants`, `acceptance_rate`, `yield_rate` 등이 있으나
  연도별로만 나뉘고 대상집단(지원자/합격자/등록자)·전체 vs 제출자만·공식/2차/미검증
  구분·출처 링크·확인일을 표현할 수 없음을 확인(P4 데이터 삽입문의 `source_notes` 자유
  텍스트로만 그 구분을 서술해 두고 있었음). 기존 컬럼은 삭제/변경하지 않았다.
- **신규 마이그레이션**: `supabase/migrations/20261490000000_college_db_p7_admission_metrics.sql`
  — `university_admission_metrics(id, university_id, cycle_year, cohort, metric_key,
  value, value_text, unit, submitters_only, gpa_weighted, verification_status,
  source_url_id, verified_at, notes, created_at, updated_at)`, unique
  `(university_id, cycle_year, cohort, metric_key)`. RLS: 읽기는 인증 사용자 전원
  (미검증 포함 — 정책상 숨기지 않음), 쓰기는 `is_admin()`만.
- **서버 액션**(`lib/universities/actions.ts`): `listAdmissionMetrics`(관리자 전체 조회),
  `loadAdmissionMetrics`(공개 조회, 로그인만 확인), `upsertAdmissionMetric`(unique 키
  기준 upsert), `deleteAdmissionMetric`. 타입 `AdmissionMetric*` export.
- **관리자 화면**(`app/admin/universities/UniversitiesPanel.tsx`):
  `AdmissionMetricsSection` 추가 — 연도×대상집단×지표 테이블 + 값/단위/제출자만/검증상태/
  비고 입력 폼, 행별 삭제 버튼, 검증상태 배지(공식/참고/미검증 색상 구분).
- **공개 화면**(`app/components/CollegeExploreSection.tsx`): `AdmittedStudentProfileCard`
  추가 — `ADMISSION_METRIC_DISPLAY_ORDER`로 고정된 순서·대상집단만 표시(가장 최신
  연도 하나만 선택, 다른 연도 값으로 빈칸을 채우지 않도록 코드로 강제). 데이터
  없는 지표는 "미공개", `value_text`만 있고 숫자가 없으면 "확인 필요"로 표시.
  각 지표 옆에 대상집단·연도·검증상태 배지 노출.
- **개인 합격확률 계산/변환 기능 없음** — 스키마·서버 액션·화면 어디에도 추가하지 않았다.
- **실데이터 백필**: 기존 P4 조사 문서(`university_admission_cycles` 2027 사이클,
  Princeton/MIT/Harvard/Stanford/Yale — 총 5개교, 지시서 요구 3~5개교 충족)의
  SAT/ACT/GPA/지원자수/합격률/등록률 값을 원본 `source_notes`를 재검토해 이관.
  "미검증/미확인"으로 명시된 값(Princeton SAT·ACT, MIT SAT 합산, Harvard SAT 합산)은
  `verification_status='unverified'`로, 나머지 2차자료성 값은 `'secondary'`로 표시
  (이 백필에 `'official'`은 없음 — CDS 원문 직접 대조 전까지 공식으로 표시하지 않음).
  추측으로 채운 값 없음.

### 검증
- `supabase db reset --local` — 전체 마이그레이션(P7 포함) 정상 적용 확인.
- `psql`로 `university_admission_metrics` 백필 데이터 33행 확인(5개교 × 지표 수).
- `npx tsc --noEmit` — 이번 변경 관련 신규 오류 없음(기존 `app/layout.tsx`의
  `LayoutProps` 오류만 남음, 무관한 사전 존재 이슈).
- `npx eslint lib/universities/actions.ts app/admin/universities/UniversitiesPanel.tsx
  app/components/CollegeExploreSection.tsx` — 오류 없음.
- `npx vitest run scripts/universities-seed.test.ts` — 3/3 통과(이 영역 유일한 기존
  테스트, 새 테이블에 대한 전용 테스트는 작성하지 않음 — 컴포넌트/액션 테스트가
  이 영역에 원래 없던 관례를 따름, 아래 결정 필요 참고).
- `npx supabase db push --linked`, `vercel deploy` 미실행(지시대로 금지).

## C. 지원요강·에세이(지원연도/경로별) — 4차 세션(2026-09-23) 완주

### 완료
- **마이그레이션**: `supabase/migrations/20261500000000_college_db_p8_essay_prompts.sql`.
  기존 `university_essay_prompts`(P5, 20261428000000)는 "자체 supplement 에세이 원문 +
  글자수 + 필수여부"만 표현 가능한 레거시 테이블이었다 — 새 테이블을 만드는 대신(이름이
  이미 존재해 `create table if not exists`가 조용히 스킵되는 것을 확인한 뒤) 같은 테이블에
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`로 additive 확장했다(지시서의 "옆에 두거나
  확장 컬럼 추가" 원칙 그대로). 기존 컬럼(`prompt_text`, `word_limit`, `is_required`,
  `created_at`) 삭제 없음 — `prompt_text`만 NOT NULL 제약을 완화(공통지원서 등 원문
  미확보 시 `topic_summary`만으로 저장 가능해야 해서).
- **새 컬럼**: `prompt_type`(common_app/school_specific/short_answer/program_conditional),
  `title`/`topic_summary`, 선택규칙(`selection_group_id`+`select_count`+`group_size` —
  "N개 중 M개 선택"을 개수로 뭉개지 않고 그룹 단위로 표현), 조건부 적용범위
  (`applies_to_school`/`applies_to_majors`/`application_paths` — ED/EA/RD/편입/국제학생 등),
  `word_limit_min`/`word_limit_max`/`char_limit`, `source_url_id`(→`university_source_urls`),
  확인상태 `prompt_status`(`confirmed_current_year`/`unconfirmed_current_year`/
  `prior_year_reference` — 올해 확인완료/올해 확인중/작년 참고용을 명확히 구분),
  `last_verified_at`, `reviewed_by`/`reviewed_at`/`review_note`, `notes`, `updated_at`(+트리거).
- **RLS**: 읽기는 로그인 사용자 전원(`auth.role() = 'authenticated'`, 미확인/지난연도
  포함 전부 반환 — 숨기지 않고 화면 배지로 구분하는 기존 P7 원칙과 동일), 쓰기(추가/
  수정/삭제/검토)는 `is_admin()`만.
- **서버 액션**(`lib/universities/actions.ts`): 레거시 `EssayPrompt` 타입과 이름이
  충돌해 새 타입/함수는 `UniversityEssayPrompt`/`listUniversityEssayPrompts`/
  `loadUniversityEssayPrompts`/`upsertUniversityEssayPrompt`/`reviewUniversityEssayPrompt`/
  `deleteUniversityEssayPrompt`로 명명(레거시 `EssayPrompt`/`loadUniversityDetail`의
  `essayPrompts` 필드는 그대로 유지, 다른 소비자 없음 확인 후 화면에서만 새 함수로 교체).
- **관리자 화면**(`app/admin/universities/UniversitiesPanel.tsx`): `EssayPromptsSection`
  추가(대학 상세 → 학업 지표 섹션 다음) — 연도/유형/제목/원문 또는 주제요약/선택규칙
  (N/M)/글자수 상한/적용경로(콤마 구분 입력)/필수여부/확인상태/비고 입력 폼, 목록 테이블에서
  확인상태를 드롭다운으로 바로 변경(검토), 행별 삭제.
- **공개 화면**(`app/components/CollegeExploreSection.tsx`): 레거시 "자체 에세이 문항"
  카드를 새 `EssaysSection`으로 교체 — 지원연도 선택(연도가 여럿이면 드롭다운), 유형별로
  묶어서 표시, 선택규칙 그대로 노출("N개 중 M개 선택"), 조건부 문항은 단과대/전공/지원경로
  명시, 상단에 "이번 지원에 작성해야 할 것"(필수 문항 개수 + 선택규칙 요약) 배너,
  각 문항에 확인상태 배지(올해 확인완료=녹색/확인 중=노랑/"작년 문항 — 참고용, 올해
  문항 아님"=회색 톤으로 명확히 구분).
- **실데이터 백필**: 200개교 조사 자료 기반으로 Princeton/MIT/Harvard/Stanford/Yale
  5개교(지시서 요구 3~5개교 충족) 이관 — Common App 공통에세이(7개 중 1개 선택,
  전 5개교 공통, `unconfirmed_current_year`), MIT 자체 에세이 4문항(2025-2026 사이클
  자료라 `prior_year_reference`로 정직하게 구분), Stanford 공학 단과대 조건부 문항
  (`unconfirmed_current_year`), Yale 짧은답변(`unconfirmed_current_year`), Harvard
  국제학생 조건부 문항(`application_paths=['international']`, `unconfirmed_current_year`).
  원문 미확보 문항은 `topic_summary`만 채우고 추측으로 `prompt_text`를 만들어 넣지 않음
  — `official`/`confirmed_current_year` 값은 이 백필에 전혀 없음(공식 사이트 원문 대조
  전까지 의도적으로 사용하지 않음).

### 검증
- `supabase db reset --local` — 전체 마이그레이션(P8 포함) 정상 적용 확인(최초 시도 시
  `create table if not exists`가 기존 P5 테이블 때문에 스킵되어 컬럼 참조 오류 발생 →
  ALTER 방식으로 재작성 후 정상).
- `psql`로 `university_essay_prompts` 백필 확인: `common_app/unconfirmed_current_year` 5행,
  `program_conditional/unconfirmed_current_year` 2행, `school_specific/prior_year_reference`
  4행, `short_answer/unconfirmed_current_year` 1행.
- `npx tsc --noEmit` — 이번 변경 관련 신규 오류 없음(기존 `app/layout.tsx`의
  `LayoutProps` 오류만 남음, 무관한 사전 존재 이슈).
- `npx eslint lib/universities/actions.ts app/admin/universities/UniversitiesPanel.tsx
  app/components/CollegeExploreSection.tsx` — 오류 없음.
- `npx vitest run scripts/universities-seed.test.ts` — 3/3 통과(이 영역 유일한 기존 테스트).
- `npx supabase db push --linked`, `vercel deploy` 미실행(지시대로 금지).

### 미완료 (D 완주 전 시점, 아래 D 섹션에서 이어감)
- **D(수집봇)** — 이번 세션에서 완주(아래 참고).
- **E(10개교 UAT → 200개교 상태 관리)** — 착수하지 않음, 다음 세션.

### 결정 필요
- `university_admission_metrics`/`university_essay_prompts`에 대한 전용 vitest(액션 단위
  테스트)가 없다 — 이 영역의 다른 서버 액션들도 대부분 DB 연동 통합 테스트가 없는
  관례라 이번에도 추가하지 않았지만, D/E 이후 한 번은 액션 계층 테스트를 갖출지 결정이
  필요하다.
- 관리자 화면의 지표/에세이 입력 폼이 행당 1개씩 개별 저장하는 단순 폼이다(엑셀처럼
  여러 항목을 한 번에 붙여넣는 대량 입력 UI는 아님) — 200개교 규모로 갈 때 이대로 충분한지
  다음 세션(E)에서 재검토 필요.
- 에세이 "선택 그룹"(N개 중 M개)을 관리자 화면에서 만들 때 `selection_group_id`를
  자동 생성/공유하는 UI가 없다(각 행을 개별 저장, 같은 그룹으로 묶으려면 DB에서 직접
  `selection_group_id`를 맞춰야 함) — 문항 수가 많아지면 "그룹 만들기" 전용 UI가 필요할
  수 있다.

## 5차 세션 (2026-09-23, 지시서 D: 정보 수집 봇 + 변경안 검토) — 완주

### 완료
- **마이그레이션**: `supabase/migrations/20261510000000_college_db_p9_refresh_bot_and_proposals.sql`
  — `university_refresh_jobs`(대학별 "최신 정보 확인 요청" 큐, status
  queued/running/succeeded/failed)와 `university_update_proposals`(필드별 변경안,
  field_area/target_table/target_record_key/cycle_year/cohort/current_value/
  proposed_value/evidence_excerpt/evidence_location/result_type/status/reviewed_by/
  reviewed_at/review_reason/applied_at) 신규 추가. RLS: `university_update_proposals`는
  select 자체를 `profiles.role in ('admin','consultant')`로 제한(학생/보호자는 전혀
  못 봄), insert/update는 관리자(service_role)만. `university_refresh_jobs`는 상태
  표시가 민감하지 않아 인증 사용자 전원 select 가능, insert는 본인 명의로만.
- **크롤러 안전장치**(`lib/universities/crawler.ts`, 순수 로직·"use server" 없음):
  - `checkUrlSafety`: http(s) 스킴만 허용, IP 리터럴 호스트는 즉시 사설/루프백 대역
    검사, 그 외 호스트는 `dns/promises`의 `lookup`으로 실제 조회한 뒤 나온 IP가
    10.0.0.0/8·172.16.0.0/12·192.168.0.0/16·127.0.0.0/8·169.254.0.0/16·`::1`·
    `fe80::/10`·`fc00::/7`(ULA)면 차단(SSRF 방지, 외부 라이브러리 없이 직접 작성).
  - `fetchRobotsRules`+`isPathAllowedByRobots`: `User-agent: *` 그룹의 `Disallow`만
    보는 최소 파서(robots.txt 없음/오류 = 허용으로 취급, 보수적 fail-open이 아니라
    "규칙이 없으면 막을 근거도 없다"는 표준 해석).
  - `politeDelay`: 호스트별 마지막 요청 시각을 메모리에 기록해 2~5초 랜덤 지연.
  - `safeFetch`: 위 안전장치를 전부 통과한 뒤에만 실제 `fetch` — User-Agent에 봇
    식별자+연락처(`AltonUniversityInfoBot/1.0 (+contact: engineering@alton.education...)`)
    포함, 10초 타임아웃, 5MB 응답 크기 제한. PDF는 `pdfjs-dist`(기존
    `lib/curriculum-assets/pdf.ts`와 동일 legacy build 사용법)로 텍스트만 추출(최대
    30페이지). HTML은 정규식 기반 최소 텍스트 추출(`extractHtmlText`) — jsdom은
    `@types/jsdom`이 없어 타입 에러가 나 이번엔 정규식으로 충분히 처리하고 결정
    필요에 남김.
  - `extractDeadlineCandidates`: "Early Decision/Early Action/Regular Decision" 문구
    주변 텍스트를 근거 스니펫으로만 뽑는 최소 휴리스틱(구조화 파싱 아님 — 아래 결정
    필요 참고).
- **작업 큐 + 변경안 서버 액션**(`lib/universities/refresh-actions.ts`):
  - `requestUniversityRefresh(universityId)`: 로그인 사용자 전원 호출 가능(역할 제한
    없음 — 학생/보호자/컨설턴트/관리자 전부). 대학별로 (1) 진행중(queued/running)
    작업이 있으면 그대로 반환, (2) 없으면 최근 완료 작업이 6시간 냉각시간 이내인지
    확인해 있으면 그대로 반환(재실행 안 함), (3) 둘 다 아니면 새 job을 본인 세션
    클라이언트로 insert(RLS `requested_by = auth.uid()`가 안전망) 후, 전역
    `status='running'` 카운트가 3 미만이면 바로 크롤을 동기 실행한다(이 세션에는
    별도 백그라운드 워커가 없음 — 아래 결정 필요 참고). 한도 초과 시 `queued`
    상태로 남긴 뒤 리턴(실행은 다음 요청/워커 몫, 이번 세션 미구현).
  - `runRefreshJob(jobId, universityId)`: 그 대학의 `status='approved'` 출처 URL만
    순회하며 `safeFetch` 호출. 실패(스킴/사설 IP/robots 차단/타임아웃/HTTP 오류/PDF
    파싱 실패 전부 포함)는 `result_type='fetch_failed'`로 `university_update_proposals`에
    적재하고 원문 접근 실패 사유를 `evidence_excerpt`에 남긴다. 성공하면 마감일
    휴리스틱으로 후보를 찾아 `result_type='new'`(target_table='other', 대상 테이블
    자동반영 대상 아님 — 사람이 검토 후 다른 화면에서 반영)로 적재, 후보가 없으면
    `result_type='no_change'`로 원문 발췌만 남긴다. **이 함수 어디에도 다른 대학
    정보 테이블에 대한 UPDATE/UPSERT가 없다** — 크롤링과 반영을 코드로 분리해
    "기존 공개값은 절대 건드리지 않는다"를 보장.
  - `listUpdateProposals`/`reviewUpdateProposal`/`rollbackAppliedProposal`(관리자 전용,
    `requireAdmin`): `reviewUpdateProposal`은 held/rejected면 상태만 바꾸고 끝,
    approved/approved_with_edit면 `applyProposalToTarget`로 실제 대상 테이블에
    반영(현재는 `university_admission_metrics`—unique key 4컬럼 upsert—와
    `university_essay_prompts`—id 있으면 update, 없으면 insert—만 자동 반영 지원,
    그 외 target_table은 상태만 바뀌고 반영은 관리자가 수동으로 함). 반영 직전
    기존 값을 읽어 `current_value`에 저장해 두므로 `rollbackAppliedProposal`이
    그 값으로 대상 테이블을 복원하고 proposal 상태를 `held`로 되돌릴 수 있다.
    자동승인 로직은 이 파일 어디에도 없다(마감일/시험정책/에세이/국제학생 요건
    전부 사람이 버튼을 눌러야만 반영됨).
- **관리자 화면**(`app/admin/universities/UniversitiesPanel.tsx`): `RefreshAndProposalsSection`
  추가(대학 상세 맨 아래) — "최신 정보 확인 요청" 버튼(작업 진행중이면 비활성화),
  최근 작업 상태 표시, 변경안 목록(필드영역/대상테이블/연도·결과유형·상태 배지 +
  출처 링크 + 근거 발췌), pending 항목에 승인/보류/거절 버튼(+검토 사유 입력),
  반영된(approved/approved_with_edit + applied_at 있음) 항목에 롤백 버튼.
- **공개 화면**(`app/components/CollegeExploreSection.tsx`): `RefreshRequestButton`
  추가(대학 상세, 컨설턴트 출처 제안 섹션과 오류 신고 버튼 사이) — 학생/보호자/
  컨설턴트/관리자 전원 노출, 클릭 시 `requestUniversityRefresh` 호출 후 상태 텍스트
  표시(대기중/확인중/확인 완료/확인 실패).

### 실제 실행 테스트(외부 변경 있음 — 실제 HTTP 요청)
- `lib/universities/crawler.test.ts`(13개, 순수 로직·네트워크 없음): SSRF 차단
  케이스(스킴/사설 IP 리터럴/localhost/파싱불가), `isPrivateOrLoopbackIp` IPv4/IPv6
  경계, robots.txt 파서(그룹 구분/Disallow), 마감일 휴리스틱, HTML 텍스트 추출.
- `lib/universities/refresh-actions.integration.test.ts`(5개, **로컬 Postgres +
  실제 외부 HTTP 요청**, mock 아님): 테스트용 대학에 실제 공개 대학 공식 페이지
  (`https://mitadmissions.org/` — Princeton은 봇 User-Agent에 403을 반환해 대신
  선택, 실제로 확인함) 1개와 존재하지 않는 경로 1개를 승인된 출처로 등록한 뒤
  `requestUniversityRefresh`를 실제로 실행 → job이 `succeeded`로 끝나고, 존재하지
  않는 URL은 `result_type='fetch_failed'`로 정확히 기록됨을 확인. 직후 재요청하면
  냉각시간 로직으로 같은 job을 반환(중복 실행 병합) 확인. 별도로 변경안을 직접
  만들어 `reviewUpdateProposal(approved)`가 `university_admission_metrics`를 실제로
  갱신하고, `rejected`는 갱신하지 않으며, `rollbackAppliedProposal`이 이전 값으로
  정확히 복원하는 것까지 통합 테스트로 확인.
- 로컬 `supabase db reset` 재실행 — P9 마이그레이션 정상 적용 확인.
- `npx tsc --noEmit -p .` — 신규 오류 없음(기존 `app/layout.tsx` `LayoutProps` 이슈만
  잔존, 무관).
- `npx eslint lib/universities/crawler.ts lib/universities/refresh-actions.ts
  lib/universities/crawler.test.ts lib/universities/refresh-actions.integration.test.ts
  app/admin/universities/UniversitiesPanel.tsx app/components/CollegeExploreSection.tsx`
  — 오류 없음.
- `npx vitest run lib/universities scripts/universities-seed.test.ts app/admin/universities`
  — 4개 파일, 29/29 통과(신규 18개 포함).
- `npx supabase db push --linked`, `vercel deploy` 미실행(지시대로 금지, non-prod
  마이그레이션 적용은 통합 세션 몫).

### 미완료 / 다음 세션(E)로 이관
- **동시 실행 제한 초과 시 실제 백그라운드 워커/재시도 폴러 없음** — `queued` 상태로
  남기기는 하지만 그 job을 나중에 자동으로 집어 실행하는 코드가 없다(이번 세션은
  버튼을 누른 요청 안에서 동기 실행만 구현). 200개교 규모로 확장하면(E) 실제 큐
  워커(cron/edge function 등)가 필요하다.
- **구조화 필드 파싱이 아니라 마감일 키워드 휴리스틱뿐** — 각 대학 사이트 HTML 구조가
  달라 이번 세션에서 학업지표/에세이 문항까지 자동으로 뽑아 비교하는 파서는 만들지
  않았다. `target_table='university_admission_cycles'`/`'other'`로 남긴 변경안은
  자동 반영 대상이 아니라(설계상 지원 대상 테이블은 admission_metrics/essay_prompts
  뿐) 관리자가 원문을 보고 다른 화면에서 수동 반영해야 한다.
- **HTML 파싱이 jsdom이 아니라 정규식 기반** — `@types/jsdom`이 프로젝트에 없어
  타입 에러가 났고, 이번 세션 범위(안전장치+최소 파서)에는 정규식으로 충분해 새
  타입 선언 파일을 추가하는 대신 정규식으로 처리했다. 구조화 파싱이 필요해지면
  `@types/jsdom` 추가 여부 재검토.
- **E(10개교 UAT → 200개교 상태 관리)** — 착수하지 않음, 다음 세션.

## E. 10개교 실 UAT → 200개교 확대 상태 관리 — 6차 세션(2026-09-23) 완주(이 지시서 전체 마지막 단계)

### 1. 10개교 선정 (실제 재검증함)
지시서 D(5차 세션)에서 이미 실제 HTTP fetch로 파이프라인을 검증한 5개교
(Princeton/MIT/Harvard/Stanford/Yale — MIT `mitadmissions.org`로 대체 검증, Princeton은
봇 UA에 403)에 더해, 이번 세션에서 **직접 WebFetch로 재검증**한 5개교를 추가해 총 10개교:

| 학교 | 선정 사유(자료 성격) | 재검증 URL | 결과 |
|---|---|---|---|
| Princeton University | Common App 공통문항 위주(D에서 확인) | admission.princeton.edu | D에서 403(봇 차단) 확인, 대체로 MIT 사용 |
| MIT | HTML 자료 위주, D 통합테스트 실사용 | https://mitadmissions.org/ | 200, 실제 크롤 성공(D) |
| Harvard University | Common App + 국제학생 조건부 에세이 | (D 백필 대상) | 기존 백필 재확인만, 이번 세션 재fetch 안 함 |
| Stanford University | 단과대 조건부 에세이(공학) | (D 백필 대상) | 상동 |
| Yale University | 짧은답변형 에세이 | (D 백필 대상) | 상동 |
| University of Pennsylvania | HTML 자료 위주 | https://admissions.upenn.edu/ | 200, 제목/도메인 일치 확인(WebFetch, 2026-09-23) |
| California Institute of Technology | HTML 자료 위주, PDF(CDS) 자료 후보 | https://www.admissions.caltech.edu/ | 200, 제목/도메인 일치 확인(WebFetch, 2026-09-23) |
| Duke University | HTML + 마감일 정보 | https://admissions.duke.edu/ | 200, 제목/도메인 일치 확인(WebFetch, 2026-09-23) |
| Brown University | Common App 공통문항 위주 | https://admission.brown.edu/ | 200, 제목/도메인 일치 확인(WebFetch, 2026-09-23) |
| Johns Hopkins University | HTML + 국제학생 조건부 정보 | https://apply.jhu.edu/ | 200, 제목/도메인 일치 확인(WebFetch, 2026-09-23) + 이번 세션 실 파이프라인 재실행 |

**정직한 한계**: Harvard/Stanford/Yale은 이번 세션에서 URL을 다시 fetch하지 않았다(D에서
이미 5개교로 실제 검증했다는 세션 문서 기록만 근거) — PDF(CDS PDF) 자료 위주 학교의
실제 재검증은 이번 세션에서 별도로 수행하지 못했다(모든 후보가 HTML 또는 D의 기존
검증 대상이었음, 아래 미완료 참고).

### 2. 실 파이프라인 실행 결과
- `lib/universities/refresh-actions.e-uat.integration.test.ts`(신규, 로컬 Postgres +
  실제 외부 HTTP): 실제 시딩된 Johns Hopkins University에 대해
  `requestUniversityRefresh`/`listUpdateProposals`를 실제로 실행 — 통과.
- **최종 검수 체크리스트**:
  - 등록/합격자 SAT 통계 cohort 오분류 없음 — `university_admission_metrics.cohort`
    unique key에 포함, 화면(`AdmittedStudentProfileCard`)이 cohort별로 분리 표시(P7에서
    이미 검증, 재확인만).
  - 지원연도 마감일/에세이 혼입 없음 — `cycle_year` 필터링 기존 구현(P8) 재확인.
  - Common App vs 자체/조건부 문항 구분 — `prompt_type` 배지 기존 구현(P8) 재확인.
  - **컨설턴트 제안 URL의 pending 상태 미사용 확인** — 이번 세션 신규 테스트에서 JHU에
    `pending` URL을 하나 추가한 뒤 실제로 크롤 실행, 그 URL을 근거로 한 변경안이
    생성되지 않음을 직접 확인(코드상 `runRefreshJob`이 `status='approved'`만 조회하는
    것과 일치).
  - 오류 신고 전달/처리결과 조회 — 기존 구현(A) 재확인, 이번 세션 신규 테스트 없음.
  - **동일 대학 반복 갱신 요청 병합** — JHU 대상으로 연속 2회 `requestUniversityRefresh`
    호출, 두 번째 호출이 새 job을 만들지 않고 같은 job을 반환함을 직접 확인(테스트 통과).
  - **봇 실패 시 기존 공개값 유지** — JHU에 `university_admission_metrics` 값(GPA 3.91)을
    미리 심어두고 실 파이프라인 실행 후에도 값이 그대로임을 직접 확인(테스트 통과,
    `runRefreshJob`이 대상 테이블에 UPDATE를 전혀 하지 않는 기존 D 설계와 일치).

### 3. 200개교 확대 상태 관리
- **마이그레이션**: `supabase/migrations/20261520000000_college_db_p10_data_collection_status.sql`
  — `universities.data_collection_status`(`verified_pilot`/`sources_pending_review`/
  `unconfirmed`, 기본값 `unconfirmed`) additive 컬럼 + 이번에 실제 재검증한 10개교만
  `verified_pilot`로 UPDATE.
- `supabase/migrations/20261530000000_college_db_p10_pilot_source_urls.sql` — 이번
  세션에서 새로 재검증한 5개교(UPenn/Caltech/Duke/Brown/JHU)의 공식 입학 홈페이지 URL을
  `university_source_urls`에 `status='approved', is_official=true`로 등록(재검증 근거를
  `review_note`에 남김). Princeton/MIT/Harvard/Stanford/Yale은 D 세션에서 이미 등록된
  것으로 간주하고 여기서는 건드리지 않음.
- **200개교 대량 pending 등록은 생략함(정직하게 미완료로 남김)** — 나머지 190개교는
  전부 `unconfirmed` 기본값 그대로. 200개교 조사 문서(`docs/2026-09-19-*.md`)에 있는
  URL 후보들을 이번 세션에서 재검증하지 않았으므로 `approved`/`official=true`는 물론
  `pending_verification`류 대량 삽입도 하지 않았다(지시서가 허용한 "생략 가능" 옵션 사용).
- **관리자 화면 배지**: `app/admin/universities/UniversitiesPanel.tsx`에
  `DataCollectionStatusBadge` 추가 — 대학 목록 각 행과 상세 화면 제목 옆에
  "실검증 완료(UAT)"(녹색)/"출처 검토 필요"(노랑)/"미확인"(회색) 배지 표시.
  `lib/universities/actions.ts`의 `UniversitySummary`/`listUniversities`/
  `loadUniversityDetail`이 `dataCollectionStatus`를 반환하도록 확장(additive).

### 200개교 현황 분포(로컬 DB 실측, 2026-09-23)
- `verified_pilot`: 10개교(위 표)
- `sources_pending_review`: 0개교(이번 세션에 대량 입력을 생략했으므로 실제로는 0)
- `unconfirmed`: 190개교

### 검증
- `supabase db reset --local` — P10(2개 마이그레이션) 포함 전체 정상 적용, `psql`로
  `verified_pilot` 10건/`unconfirmed` 190건(합 200) 직접 확인.
- `npx tsc --noEmit -p .` — 이번 변경 관련 신규 오류 없음(기존 `app/layout.tsx`
  `LayoutProps` 이슈만 잔존, 무관).
- `npx eslint lib/universities/actions.ts app/admin/universities/UniversitiesPanel.tsx
  lib/universities/refresh-actions.e-uat.integration.test.ts` — 오류 없음.
- `npx vitest run lib/universities scripts/universities-seed.test.ts app/admin/universities`
  — 5개 파일 30/30 통과(신규 1개 포함). 단독 실행 시 전부 통과하나, 여러 통합 테스트
  파일을 동시에(vitest 기본 병렬) 돌리면 `refresh-actions.integration.test.ts`의 냉각시간
  병합 검증이 전역 동시 실행 한도(3) 경합으로 가끔 실패할 수 있음을 발견(파일 단독
  실행 시 5/5 통과 재확인) — 아래 결정 필요 참고.
- `npx supabase db push --linked`, `vercel deploy` 미실행(지시대로 금지).

### 미완료
- Harvard/Stanford/Yale 3개교는 이번 세션에서 URL을 다시 fetch하지 않고 D 세션의
  기존 검증 기록에 의존했다 — 완전한 재검증이라면 이 3개교도 이번 세션에서 다시
  fetch했어야 한다.
- PDF(CDS PDF) 자료 위주 학교의 재검증 사례가 이번 10개교 안에 명확히 포함되지 않았다
  (모든 신규 검증 대상이 HTML 입학 홈페이지) — PDF 파싱 경로(`safeFetch`의 `pdfjs-dist`
  처리)는 D 세션의 유닛 테스트로만 간접 검증됨, 실제 CDS PDF 대상 실행은 하지 않음.
  다음 세션에서 PDF 위주 학교 2~3개(예: Common Data Set PDF를 직접 게시하는 학교)를
  골라 재검증 필요.
- 190개교의 `sources_pending_review` 대량 승격(200개교 조사 문서 URL을 pending으로
  일괄 등록) — 시간 부족으로 생략(지시서가 허용한 옵션).
- 관리자 목록/상세 화면에 "재검증 대기 중인 190개교를 어떻게 우선순위로 처리할지"
  보여주는 필터/정렬 UI 없음(현재는 배지만 표시, 필터링 UI는 없음).

### 결정 필요
- 통합 테스트 파일들을 vitest로 병렬 실행하면 `runRefreshJob`의 전역 동시 실행 한도(3)에
  실제로 경합이 생겨 "냉각시간 병합" 어서션이 가끔 실패한다(파일별 단독 실행은 항상
  통과). CI에서 이 디렉터리의 통합 테스트를 순차 실행(`--pool=threads --poolOptions...`
  또는 파일별 개별 vitest 호출)하도록 설정할지, 아니면 테스트가 한도 초과 상황을
  스스로 감지해 스킵하도록 보강할지 다음 세션에서 결정 필요.
- 190개교를 `sources_pending_review`로 대량 승격할지, 아니면 실제 재검증이 될 때마다
  하나씩 `verified_pilot`로 승격하는 현재 방식을 유지할지 — 후자가 "재검증 없이 승인
  표시 금지" 원칙에 더 부합하지만 운영 속도는 느리다.
- Harvard/Stanford/Yale의 D 세션 검증을 "이번 세션 재검증"과 동일하게 취급해도 되는지
  (스키마상 `verified_pilot`에 세션 구분이 없음) — 필요하면 `verified_pilot_at`
  타임스탬프 컬럼을 추가해 검증 시점을 남길지 결정 필요.

### 결정 필요(D 관련 추가)
- 동시 실행 한도(3) 초과 시 큐에만 남고 자동 실행되지 않는 job을 어떻게 처리할지
  — (a) 관리자가 수동으로 다시 "확인 요청"을 누르게 두거나, (b) Vercel Cron/Supabase
  Edge Function으로 폴러를 두는 것 중 선택 필요(이번 세션엔 로컬 테스트에서 한도에
  걸릴 일이 없어 실사용 빈도를 알기 어려움).
  - 권장: 200개교 확장(E) 전까지는 (a)로 충분(대학 수가 적어 동시 3개 한도에 실제로
    걸릴 가능성이 낮음), E 단계에서 실사용 빈도를 보고 (b) 여부 결정.
- 마감일/학업지표/에세이 등 실제 필드 비교(`result_type` new/changed/no_change의
  진짜 의미)를 만들려면 대학 사이트별 파서가 필요하다 — 이번 세션은 "접근 성공 여부
  + 근거 스니펫"까지만 자동화하고 실제 비교는 사람이 한다. 200개교로 갈 때 우선순위
  파서(예: Common Data Set은 상당수가 표 구조를 공유)부터 만들지 여부 결정 필요.
