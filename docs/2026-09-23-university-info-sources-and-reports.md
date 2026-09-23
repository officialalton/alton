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

## 미완료 (지시서 대비)
- 관리자 화면(UniversitiesPanel/AdminShell)에 출처 URL 목록·승인 UI, 신고 처리함 UI —
  액션만 구현, 화면 미연결.
- Admitted Student Profile 지표별 연도/대상집단/공식여부/출처·확인일 필드(지시서 b) —
  기존 Part 5(`20261428000000`)에 이미 일부 구조가 있는지 미확인, 이번 라운드에서
  건드리지 않음.
- 지원연도별 에세이 프롬프트 관리(지시서 c) — `university_essay_prompts` 테이블 실재
  여부·스키마 미확인.
- 수집봇 + 필드별 변경안 검토 큐(지시서 e) — 전혀 미착수.
- 10개교 실선정→200개교 확대(지시서 f) — 전혀 미착수.
- `npx supabase db push --linked`, `vercel deploy` 미실행(지시대로 통합 세션 담당,
  실행 안 함).
- 단위 테스트 미작성.

## 제안 마이그레이션
`20261473000000_college_db_p6_source_urls_and_reports.sql` — non-prod 반영 필요
(이번 세션에서 `db push`는 실행하지 않음).
