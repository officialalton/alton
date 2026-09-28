# Digital SAT 스타일 4모듈 MST 모의고사 재설계 — 조사 + 계획 (2026-09-28)

이 문서는 조사와 구현 계획만 담는다. **이 세션에서 마이그레이션 파일 작성, 스키마 변경, 코드 리팩터링은 하지 않았다.** Phase 1 착수 시 별도 R 승인 절차(CLAUDE.md 기준)를 거친다.

## 0. 결론 요약

현재 저장소에는 모의고사("모의고사"/"mock exam") 기능이 **전혀 존재하지 않는다.** `app/student`, `lib`, `supabase/migrations`, `e2e` 전체에서 `mockexam|mock_exam|mock-exam|모의고사`로 검색해도 매치가 0건이다. `lib/mock-exam/` 디렉터리도, `app/student/mock-exam/` 라우트도, `*MockExamTab.tsx`류 컴포넌트도 없다. 요청서에 나열된 파일들(`StudentMockExamTab.tsx` 등)은 존재하지 않으므로 "기존 단순 문제 세트 구조"를 리팩터링하는 작업이 아니라 **그린필드 신규 구현**이다.

다만 재사용 가능한 인접 인프라가 있다: 문제 자체를 담는 `problems` 테이블과 문제생성(AI) 파이프라인(`app/session/[id]/aigen-actions.ts`), 그리고 단건 문제풀이 기록 테이블 `session_problem_attempts`. 이들은 SAT MST 모의고사가 요구하는 "고정 문항 수·모듈·시간·adaptive 배정·집계 점수" 모델과는 근본적으로 맞지 않으므로, 아래 신규 스키마가 이를 감싸거나 확장하는 방식으로 설계되어야 한다.

## 1. 현재 코드 조사 (Explore 서브에이전트 결과, 이 세션에서 직접 확인)

### 1.1 존재하지 않는 것
- 모의고사 관련 파일 일체(학생/보호자/선생님/세션뷰/관리자 어디에도 없음)
- `lib/mock-exam/` 디렉터리
- "problem_bank"라는 이름의 테이블 (해당 명칭 자체가 존재하지 않음)
- 모의고사 관련 테스트/E2E 파일

### 1.2 재사용 가능한 인접 테이블/코드 (`supabase/migrations/20260827120000_initial_schema.sql` 등)

**`problems`** (문제 원본, 단일 테이블이 두 가지 상호 호환 안 되는 소유 모델을 겸함):
```sql
create type problem_format as enum ('mc', 'essay', 'math');
create type problem_difficulty as enum ('easy', 'medium', 'hard');
create type problem_status as enum ('draft', 'confirmed');

create table problems (
  id uuid primary key default gen_random_uuid(),
  format problem_format not null,
  passage text,
  options jsonb,
  correct_index int,
  explanation text,
  difficulty problem_difficulty,
  skill_type text,             -- 자유 텍스트, 표준 domain/skill 분류 아님
  subject_id uuid references subjects (id),
  section_id uuid references curriculum_doc_sections (id) on delete cascade,   -- 교재 귀속 (재사용 가능)
  origin_session_id uuid references sessions (id) on delete cascade,           -- 세션 귀속 (그 세션 숙제 전용, 재사용 불가 설계)
  status problem_status not null default 'draft',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unit_title text  -- 20260828110000에서 추가, AI 생성 문제의 단원명 비정규화
);
```
- `section_id`와 `origin_session_id`는 동시에 의미 있게 쓰이지 않는다(교재 귀속 vs 세션 숙제 귀속, 배타적 설계).
- 표준 domain 분류, 수치 난이도 추정치, Module1/2 배정가능 플래그, 중복방지용 지문 유사도 메타데이터 전무.

**`session_problem_attempts`** (단건 응답 로그, "시험 attempt" 개념 없음):
```sql
create table session_problem_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions (id) on delete set null,  -- 재시도는 null
  student_id uuid not null references students (id),
  problem_id uuid not null references problems (id),
  response jsonb,
  correct boolean,
  saved boolean not null default false,
  attempted_at timestamptz not null default now()
);
```
상태 enum 없음, 모듈/시험 그룹핑 없음, 시작/종료 시각 없음 — 문항 1개 = 행 1개의 flat 로그.

**`teacher_problem_tags`**: attempt 단위 선생님 주석(모의고사와 무관, 채점 아님).

**AI 문제 생성 파이프라인** (`app/session/[id]/aigen-actions.ts`, `AigenTab.tsx`):
- 선생님이 세션 안에서 unit/skill/difficulty/format/count 지정 → Claude(`claude-sonnet-5`, tool-use `generate_problems`) 호출 → 초안(`DraftProblem[]`, 메모리만, 미저장) → 선생님 편집/재생성 → "과제로 확정"(`finalizeProblemsToHomework`) 시 `problems`(status=`confirmed`, `origin_session_id`=해당 세션) INSERT + `homework_items` INSERT 동시 발생.
- **초안 → 재사용 가능한 미배정 은행(pool) 상태가 없다.** 생성된 문제는 폐기되거나 즉시 특정 세션의 숙제로 확정될 뿐, 여러 학생/시험에서 재사용 가능한 "은행 항목"으로 존재한 적이 없다.

**채점 로직**: `problemlog-actions.ts`의 `retryMcAttempt`(3진 아웃 규칙, `correct = options[correct_index] === selected`), essay/math는 `correct: null`(자동채점 없음). **문항 간 집계·환산 점수·도메인별 진단은 전혀 없음.**

**UI**: `ProblemLogTab.tsx`는 과거 응시 이력을 훑어보는 회고형 UI(리스트+확장 카드+인라인 재시도)이며, 순서 고정된 문항 세트를 처음부터 끝까지 타이머 아래 진행하는 "시험 응시" 흐름이 아니다. 모듈/섹션 개념, 카운트다운 타이머, "시험 시작/제출" 흐름 모두 존재하지 않는다.

## 2. Gap 분석 (6개 영역 × 재사용 가능 vs 완전 신규)

| 영역 | 재사용 가능 (구체적 근거) | 완전 신규 필요 |
|---|---|---|
| **1. 시험 엔진/상태 모델** | 없음. `session_problem_attempts`는 단건 로그일 뿐 attempt 컨테이너가 아님 | `mock_exam_attempts`(모듈별 상태·시간·경로·잠금), 문항 snapshot 테이블, 답안 이력 테이블 전부 신규 |
| **2. 문제은행 메타데이터** | `problems.subject_id`/`skill_type`(자유 텍스트)/`difficulty`(3단계 enum)/`format` 재사용 가능 | SAT domain(예: R&W의 Information & Ideas/Craft & Structure/Expression of Ideas/Standard English Conventions, Math의 Algebra/Advanced Math/Problem-Solving & Data Analysis/Geometry & Trig) 표준 taxonomy, 수치 난이도 추정치, Module1/2-higher/lower 배정가능 플래그, 자료유형(그래프/도형/표) 플래그, 품질검수 상태, 유사문항 중복방지 메타데이터 전부 신규 컬럼/테이블 |
| **3. 적응형 라우팅** | 없음(AI 생성 파이프라인은 즉석 생성이지 사전 축적된 pool에서의 알고리즘적 선별이 아님) | 라우팅 정책 설정 테이블, M1→M2 배정 함수, 내부 경로명 비노출 원칙 구현 전부 신규 |
| **4. 점수/리포트** | `session_problem_attempts.correct`(boolean)만 원자료로 재사용 가능 | 200-800 스케일링, raw-환산 구분, domain/skill 진단, calibration 가능 구조 전부 신규 |
| **5. 시험 UI** | `MathCanvas`(주관식 수학 입력 컴포넌트, `ProblemLogTab.tsx` 내부)는 Math 주관식 답안 입력 UI로 재검토 후 재사용 가능성 있음. mc 옵션 렌더링 패턴(`DetailBody`/`RetrySection`)은 시각적 참고 가능 | 문항 번호 네비게이션, 답변/검토 표시, 모듈별 타이머, 모듈 잠금·종료 확인, 자동제출 흐름 전부 신규 |
| **6. 출시 단계** | — | 아래 8절 |

## 3. 데이터 모델 설계 (초안)

Additive migration으로 전부 구성 가능(기존 `problems`/`session_problem_attempts`/`students`/`subjects`를 FK로 참조, 기존 컬럼 변경 없음). 아래는 컬럼 초안이며 Phase 착수 시 세부 조정.

### 3.1 문제은행 메타데이터 확장 — `problems` additive 컬럼 (신규 마이그레이션, 기존 컬럼 불변)
```sql
alter table problems
  add column sat_domain text,              -- 표준 domain 코드 (설정 테이블 참조 예정)
  add column sat_skill_code text,           -- 표준 skill 코드
  add column irt_difficulty numeric,        -- 추정 난이도(연속값), 초기엔 easy/medium/hard → 매핑값
  add column eligible_m1 boolean not null default false,
  add column eligible_m2_higher boolean not null default false,
  add column eligible_m2_lower boolean not null default false,
  add column response_input_type text,      -- 'mc' | 'spr'(student produced response), math 주관식 구분용
  add column stimulus_type text,            -- 'text' | 'graph' | 'figure' | 'table'
  add column review_status text not null default 'pending', -- 'pending'|'approved'|'rejected'
  add column similarity_group_id uuid;       -- 유사문항 클러스터, 같은 attempt 내 중복 출제 방지용
```
`section_id`/`origin_session_id`는 그대로 두되, 모의고사용 문항은 **둘 다 null**로 두고 순수히 위 메타데이터 + 신규 `mock_exam_item_pool` 소속으로만 식별한다(기존 소유 모델과 충돌 방지).

### 3.2 신규: 시험 청사진/설정 — `mock_exam_blueprints` (단일 진실 소스, 향후 SAT 외 다른 표준화 시험 확장 대비 이름은 일반화)
```sql
create table mock_exam_blueprints (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- 'digital_sat_v1'
  name text not null,
  sections jsonb not null,            -- [{section:'rw', module:1, item_count:27, minutes:32, common:true}, ...] 문항수/시간/domain분포 청사진
  routing_policy_id uuid,             -- FK, 아래 3.3
  scoring_model_id uuid,              -- FK, 아래 3.4
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### 3.3 신규: 라우팅 정책 (운영값으로 튜닝 가능, 학생/관리자 화면에 내부 경로명 노출 금지 — 애플리케이션 레이어에서 강제)
```sql
create table mock_exam_routing_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  section text not null,               -- 'rw' | 'math'
  threshold_type text not null,        -- 'raw_correct_count' | 'weighted_accuracy' | 'skill_gate'
  threshold_value numeric not null,
  config jsonb,                        -- 임계값 세부 계산식 파라미터
  version int not null default 1,
  created_at timestamptz not null default now()
);
```

### 3.4 신규: 점수 모델 (raw ↔ scaled 환산, calibration 가능하게 버전 관리)
```sql
create table mock_exam_scoring_models (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  section text not null,               -- 'rw' | 'math'
  raw_to_scaled_table jsonb not null,  -- [{raw_min, raw_max, path:'m2_higher'|'m2_lower', scaled_score}, ...] 초기엔 보수적 lookup table
  version int not null default 1,
  calibrated_from_attempts boolean not null default false, -- 초기 false(내부 추정), 실측 후 true
  created_at timestamptz not null default now()
);
```

### 3.5 신규: attempt 상태 모델 (엔진 핵심)
```sql
create type mock_exam_module_key as enum ('rw_m1','rw_m2','break','math_m1','math_m2');
create type mock_exam_attempt_status as enum ('not_started','in_progress','break','submitted','scored','abandoned');
create type mock_exam_route as enum ('higher','lower');  -- 내부 저장 전용, UI 노출 금지

create table mock_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  blueprint_id uuid not null references mock_exam_blueprints (id),
  status mock_exam_attempt_status not null default 'not_started',
  current_module mock_exam_module_key,
  rw_m2_route mock_exam_route,          -- 감사 로그용 내부 값, 학생/관리자 화면 미노출
  math_m2_route mock_exam_route,
  break_started_at timestamptz,
  break_ends_at timestamptz,
  total_scaled_score int,
  rw_scaled_score int,
  math_scaled_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mock_exam_modules (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references mock_exam_attempts (id) on delete cascade,
  module_key mock_exam_module_key not null,
  started_at timestamptz,
  submitted_at timestamptz,
  time_limit_seconds int not null,
  remaining_seconds_at_pause int,        -- 중단 복구용 스냅샷
  locked boolean not null default false, -- 제출/시간종료 후 true, 이전 모듈 재진입 방지
  raw_correct_count int,
  unique (attempt_id, module_key)
);
```

### 3.6 신규: 문항 snapshot (문제은행이 나중에 바뀌어도 attempt 불변 보장 — 완료 기준 핵심 요구사항)
```sql
create table mock_exam_module_items (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references mock_exam_modules (id) on delete cascade,
  seq int not null,                         -- 학생에게 보여지는 순서(1..N)
  problem_id uuid not null references problems (id),  -- 원본 참조(감사용)
  problem_snapshot jsonb not null,          -- 조립 당시 problems 행 전체를 얼려서 복사(정답/지문 불변 보장)
  unique (module_id, seq),
  unique (module_id, problem_id)            -- 같은 module 안 동일 문항 중복 방지
);

create table mock_exam_responses (
  id uuid primary key default gen_random_uuid(),
  module_item_id uuid not null references mock_exam_module_items (id) on delete cascade,
  response jsonb,                 -- mc: selected_index, math spr: raw text/value
  is_correct boolean,
  is_flagged_for_review boolean not null default false,
  last_updated_at timestamptz not null default now(),
  unique (module_item_id)          -- 최종 답안 1개(변경 이력은 별도 append-only 테이블로 분리 여부는 Phase1에서 UX 요구 재확인 후 결정)
);
```
문항 간 중복 방지는 `mock_exam_module_items`의 `unique(module_id, problem_id)` 만으로는 attempt 전체(5개 module) 중복까지 못 막으므로, 조립 RPC(§4) 내부에서 같은 `attempt_id`의 이미 조립된 모든 `problem_id`(+`similarity_group_id`)를 제외 조건으로 사용해야 한다 — DB 제약이 아니라 애플리케이션/RPC 레벨 가드로 설계(제약만으로는 batch insert 순서에 안전하지 않음, 대신 RPC를 단일 트랜잭션으로 감싼다).

### 3.7 신규: domain/skill 진단 리포트 (모듈별 raw_correct_count 위에 얹는 세분화)
```sql
create table mock_exam_skill_diagnostics (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references mock_exam_attempts (id) on delete cascade,
  sat_domain text not null,
  sat_skill_code text not null,
  correct_count int not null,
  total_count int not null,
  unique (attempt_id, sat_domain, sat_skill_code)
);
```

## 4. API / RPC 설계 초안

모두 SECURITY DEFINER Postgres 함수(기존 컨벤션 `is_admin() OR current_user_has_capability(...)` 패턴 계승) + 얇은 서버 액션 레이어(`app/student/mock-exam/*-actions.ts` 신규).

- `start_mock_exam_attempt(p_student_id uuid, p_blueprint_id uuid) returns uuid`
  — 기존 `in_progress` attempt 있으면 그 id 반환(멱등, 중복 시작 방지), 없으면 attempt+첫 module(`rw_m1`) 생성 후 `assemble_module_items()` 내부 호출.
- `assemble_module_items(p_attempt_id uuid, p_module_key mock_exam_module_key) returns void`
  — 청사진의 domain 분포 요구를 만족하는 문항 집합을 `problems`(eligible_* 플래그 + review_status='approved')에서 선별해 `mock_exam_module_items`에 snapshot insert. `rw_m2`/`math_m2` 호출 시 `p_route`(higher/lower)를 함께 받아 `eligible_m2_higher`/`eligible_m2_lower` 필터링.
- `submit_module_response(p_module_item_id uuid, p_response jsonb) returns void`
  — 자유 이동/답 변경 허용 구간에서 매 답변 저장(현재 UI의 "저장" 개념과 유사, autosave).
  — 모듈 잠금(`mock_exam_modules.locked=true`) 상태면 fail-closed 거부.
- `submit_module(p_module_id uuid) returns mock_exam_route` (M1의 경우 null 리턴)
  — 미제출 상태를 `submitted`+`locked=true`로 전환, `raw_correct_count` 계산, M1이면 라우팅 정책 적용 후 리턴값으로 다음 모듈(`assemble_module_items` 호출용 route) 전달. 시간종료 자동제출도 동일 함수를 cron/서버 타이머가 호출(§5 자동제출 참고).
- `advance_to_next_module(p_attempt_id uuid) returns mock_exam_module_key`
  — 현재 module 잠금 확인 후 다음 module 결정(`rw_m1→rw_m2→break→math_m1→math_m2`), break 진입 시 `break_started_at/ends_at` 세팅.
- `resume_mock_exam_attempt(p_attempt_id uuid) returns jsonb`
  — 중단 후 재접속 복구: 현재 module, 남은 시간(서버 시각 기준 재계산, 클라이언트 시계 신뢰 안 함), 이미 저장된 응답 전부 반환.
- `score_mock_exam_attempt(p_attempt_id uuid) returns void`
  — 모든 module 제출 완료 후 `mock_exam_scoring_models`의 raw_to_scaled_table로 환산, `mock_exam_skill_diagnostics` 집계, `mock_exam_attempts.status='scored'` 전환.
- `validate_blueprint_assembly(p_blueprint_id uuid) returns table(...)` — 관리자/CI용: 문항 수·시간·domain 분포 청사진 충족 여부를 실제 조립 없이 pool 통계로 사전 점검(완료 기준의 자동 검증에 사용).

시간종료 자동제출은 클라이언트 타이머만으로는 부정행위 방지가 안 되므로, 서버측에서도 `mock_exam_modules.started_at + time_limit_seconds`를 기준으로 만료 여부를 매 RPC 호출(`submit_module_response` 등) 진입 시 재확인해 fail-closed로 거부 + 자동 `submit_module` 트리거하는 가드를 모든 쓰기 RPC 앞단에 공통 함수로 둔다(`assert_module_not_expired()`).

## 5. 화면 설계

- **학생 시험 응시 화면** (Bluebook 참고, 완전 신규): `app/student/mock-exam/[attemptId]/page.tsx` — 좌측 문항 네비게이터(답변/검토 표시), 중앙 문항 본문(mc 옵션 or math 주관식 입력 — 주관식 입력 컴포넌트는 기존 `MathCanvas`를 검토해 확장 또는 신규 결정 필요, Phase1에서 결정), 상단 모듈별 카운트다운 타이머(경고 임계값 UI), "모듈 제출" 확인 모달, 자동 제출 배너. 기존 `ProblemLogTab.tsx`의 `DetailBody`/옵션 렌더링 스타일은 시각적 참고만, 컴포넌트 자체는 새로 작성(회고형 vs 응시형 상호작용 모델이 근본적으로 다름).
- **관리자 문항 메타데이터 입력/검수 화면**: 기존 `ProblemDraftFields.tsx`(passage/options/correct_index/explanation 편집 UI)를 확장 — sat_domain/sat_skill_code/eligible_* 플래그/review_status 필드 추가한 신규 `MockExamItemFields.tsx` 또는 `ProblemDraftFields.tsx` 자체에 옵셔널 섹션으로 추가(재사용 vs 신규는 Phase2 착수 시 확정, 후자가 중복 최소화에 유리해 보임). 신규 관리자 탭 `app/admin/MockExamItemBankTab.tsx`(검수 큐, domain 분포 대시보드 — `validate_blueprint_assembly` 결과 시각화).
- **리포트 화면**: 신규 `app/student/mock-exam/[attemptId]/ReportTab.tsx` — 총점/영역별 점수 카드, domain/skill 진단 바 차트(`mcp__visualize` 또는 기존 프로젝트 차트 컨벤션 확인 후 결정), "다음 학습 추천" 카드(학습 진단 문구 중심, 모듈 경로명 절대 노출 안 함). 보호자 화면(`app/parent/`)에는 R6까지의 패턴처럼 학생과 동일 리포트를 자녀별로 재사용(RLS로 접근 제한).

## 6. 마이그레이션 영향

- **전부 additive**: 신규 테이블/enum/컬럼만 추가, 기존 `problems`/`session_problem_attempts` 컬럼은 변경하지 않음(신규 nullable 컬럼 add만). 기존 RLS 정책·함수 변경 없음.
- **기존 데이터 마이그레이션 불필요**: 진행 중인 모의고사 attempt가 원천적으로 존재하지 않으므로(기능 자체가 없었음) 백필 대상 데이터 없음.
- **RLS 신규 정책 필요**: `mock_exam_attempts`/`mock_exam_modules`/`mock_exam_module_items`/`mock_exam_responses`는 본인(학생) SELECT/본인 것에만 쓰기, 관리자 전체 조회, 선생님은 기본 비공개(수업 세션과 무관한 개인 진단이므로 — 필요 시 정책 확인 질문 대상). `problems`의 신규 eligible_*/review_status 컬럼은 기존 SELECT 정책 그대로 적용되되, 학생에게 모의고사 조립 전 원본 노출 방지를 위해 `mock_exam_module_items.problem_snapshot`을 통해서만 학생이 접근하도록(문항 직접 조회 경로 차단) 설계 — `problems` 테이블 자체에 대한 학생 직접 SELECT는 여전히 기존 정책(자기 세션/공개 교재 조건)을 따르므로 모의고사용 문항(`section_id`/`origin_session_id` 둘 다 null)은 그 조건에 안 걸려 원천 비공개 — 조립 후에만 snapshot을 통해 노출.

## 7. Phase 1~5 (이 코드베이스 기준 구체화)

- **Phase 1 — 4모듈 shell + 타이머 + 모듈잠금 + 답안저장 + 고정 샘플문항**
  - 신규 파일: `supabase/migrations/*_mock_exam_phase1_schema.sql`(§3.5/3.6 테이블, §3.1 없이 시작 — 샘플문항은 하드코딩 seed 데이터로 `problems`에 임시 삽입 또는 신규 `mock_exam_module_items.problem_snapshot`에 직접 seed), `start_mock_exam_attempt`/`submit_module_response`/`submit_module`/`advance_to_next_module`/`resume_mock_exam_attempt` RPC(라우팅 없이 고정 다음 module만), `app/student/mock-exam/[attemptId]/page.tsx` + 하위 컴포넌트, `lib/mock-exam/`(순수 함수: 남은시간 계산, 모듈 순서 상수, 타입 정의) 신규 디렉터리.
  - 완료 기준: 고정 샘플 문항 세트로 5-module(휴식 포함) 전체를 처음부터 끝까지 진행 가능, 시간종료 자동제출 동작, 새로고침/재접속 후 정확한 위치·남은시간 복구, 이전 모듈 재진입 완전 차단, 동일 attempt 중복 제출 방지(멱등) 자동 테스트.

- **Phase 2 — 문제은행 메타데이터 + 자동 조립**
  - 신규: §3.1 `problems` additive 컬럼, §3.2 `mock_exam_blueprints`, `assemble_module_items()`, `validate_blueprint_assembly()`, 관리자 검수 화면(§5).
  - 완료 기준: 관리자가 문항에 domain/skill/eligible 플래그를 지정할 수 있고, `assemble_module_items()`가 청사진의 문항수·domain 분포를 만족하는 세트를 실제로 조립하며, 같은 attempt 내 중복 문항이 발생하지 않음을 자동 테스트로 검증(대량 pool 시뮬레이션 포함).

- **Phase 3 — M1→M2 adaptive routing**
  - 신규: §3.3 `mock_exam_routing_policies`, `submit_module()`의 라우팅 결정 로직, 내부 경로명 비노출 검증(UI 텍스트 감사).
  - 완료 기준: M1 성과를 인위적으로 다르게 만든 두 attempt가 실제로 다른 M2 문항 세트를 받음을 자동 테스트로 검증, 라우팅 임계값이 코드가 아닌 설정 테이블 값으로 변경 가능함을 확인.

- **Phase 4 — 점수·영역진단·학생리포트**
  - 신규: §3.4 `mock_exam_scoring_models`, §3.7 `mock_exam_skill_diagnostics`, `score_mock_exam_attempt()`, 리포트 화면(§5).
  - 완료 기준: 총점 400-1600 범위 내 산출, R&W/Math 각 200-800, domain/skill 진단이 실제 응답 데이터와 일치, 학생 화면에 모듈 경로명이 노출되지 않음을 화면 텍스트 검사로 검증.

- **Phase 5 — 운영데이터 기반 calibration + 예측정확도 검증**
  - 신규: `mock_exam_scoring_models.calibrated_from_attempts` 전환 절차(관리자 전용 재계산 배치/RPC), 예측정확도 대시보드(내부 추정 점수 vs 추후 실제 College Board 점수 비교 입력 UI — 수동 입력 전제, 외부 API 연동 없음).
  - 완료 기준: 최소 표본 수 이상 attempt 축적 후 raw_to_scaled_table 재계산이 기존 버전을 덮어쓰지 않고 새 `version`으로 추가되며, 과거 attempt의 점수는 채점 당시 버전 그대로 불변임을 확인.

## 8. 테스트 계획 (완료 기준 6가지 → 테스트 매핑)

1. **R&W M1→적응형 M2→휴식→Math M1→적응형 M2 끝까지 수행 가능** → `e2e/mock-exam-full-flow.spec.ts`(Playwright, 실브라우저): 5개 module 전부 클릭으로 진행 + 각 module 제출 확인.
2. **M1 결과에 따라 M2 문제 세트가 실제로 달라짐** → Vitest: 동일 blueprint로 두 개의 attempt를 인위적 M1 정답 패턴(높음/낮음)으로 시뮬레이션 후 `assemble_module_items()` 결과 문항 집합(problem_id 목록)이 다른지, 그리고 실제로 각각 higher/lower 풀에서 왔는지 검증.
3. **시간 종료·중단 복구·중복 제출·이전 모듈 재진입** → Vitest 유닛(시간 계산 순수함수) + Playwright: 타이머 강제 만료(서버 시각 mock) 후 자동제출 확인, 페이지 새로고침 후 상태 복구 확인, 동일 module에 `submit_module` 2회 호출 시 두 번째가 no-op임을 확인, 잠긴 이전 module URL 직접 접근 시 차단 확인.
4. **같은 attempt 안 문항 중복 없음** → Vitest: 대량(예: pool 500문항, blueprint 98문항) 조립 반복 실행(propert-based 또는 100회 반복) 후 attempt 전체 `problem_id` set에 중복 없음 assert.
5. **문항 수·시간·과목별 domain 분포 충족 자동 검증** → Vitest: `validate_blueprint_assembly()`를 각 module 조립 직후 호출해 청사진 기대값과 실제 값 diff 없음 assert, CI에 이 검증을 회귀 게이트로 등록.
6. **점수·리포트·학생 UI non-prod E2E 검증** → Playwright: 실제 채점까지 마친 attempt에 대해 리포트 화면 텍스트 검사(총점 범위, domain 진단 표시, "고난도/기본" 등 내부 경로명 텍스트 부재 assert), Vercel Preview(비-Production)에서 1회 수동 확인 기록.

## 9. 결정 필요 사항 (Phase 1 착수 전 확인 질문 후보)

- Math 계산기 정책: 실제 Digital SAT는 Desmos 내장 계산기를 전 모듈에서 허용한다(2023년 이후 정책, R&W 포함 전체 허용) — 이 사실 확인 후 자체 계산기 내장 vs Desmos API/embed 사용 여부는 Phase1 승인 시 결정 필요(외부 서비스 연동이면 비용/계약 검토 대상, CLAUDE.md "반드시 멈추고 확인" 조건에 해당할 수 있음).
- 선생님이 학생의 모의고사 리포트를 볼 권한 범위(§6 RLS 질문) — 수업 진단과 연결할지, 완전히 학생 개인 데이터로 분리할지는 제품 정책 확인 필요.
- 주관식(math SPR) 채점 규칙(등가 분수/소수 허용 오차 등)은 College Board 공개 정책 기준으로 Phase2 설계 시 별도 조사 필요.
