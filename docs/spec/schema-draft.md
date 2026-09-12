# Alton Education — DB 스키마 초안 (001-schema-design)

> **문서 상태: 폐기된 초기 초안·신규 구현 금지.** 현재 구현 구조를 이해하는 참고자료로만 보존한다. `credit_balance`, Calendly 중심 예약, 결합된 enrollment 등은 v3와 충돌한다. 신규 스키마는 `../2026-08-29-r0-approval-and-technical-validation-package.md`의 Gate B 절차와 `../2026-08-29-developer-handoff-v3.md`를 따른다.

목업 HTML 7개의 `<script>`에 하드코딩된 데이터 구조를 전부 찾아 분석한 뒤 설계했다. 원본 하드코딩 변수명(`CURRICULUM_DOCS_T`, `MY_SUBJECTS_T` 등)은 각 테이블 설명에 "목업 근거"로 남겨서 대조하기 쉽게 했다.

목업 데이터는 실제로 여러 곳에서 (1) FK 대신 이름 문자열/합성 문자열 키를 쓰고, (2) 같은 개념(과제/문제)이 파일마다 다른 모양으로 존재하고, (3) "세션"과 "커리큘럼"이 완전히 분리되지 않은 채 섞여 있었다. 이 초안은 그런 부분들을 정규화했고, 판단이 갈렸던 지점은 문서 맨 아래 **"검토 결과"**에서 확인한 대로 전부 반영했다.

타입 표기는 Postgres 기준(`uuid`/`text`/`int`/`numeric`/`boolean`/`timestamptz`/`jsonb`), enum은 `enum(a/b/c)`로 표기.

---

## 1. 인증 / 사용자

### `profiles`
- `id`: uuid, PK, FK → `auth.users.id` (Supabase Auth가 실제 로그인 담당, 이 테이블은 프로필 확장)
- `role`: enum(student/parent/teacher/admin)
- `name`: text
- `phone`: text, nullable
- `created_at`: timestamptz

목업 근거: 모든 포털의 `?role=` URL 파라미터를 대체하는 자리. 실제 역할 분기는 여기서 나온다.

### `students`
- `id`: uuid, PK, FK → `profiles.id`
- `grade`: text (예: "10학년")
- `intake_type`: enum(A/B/C/D/E), nullable — functional-spec §4의 5가지 상담 분류. 상담 중 `consult_requests.intake_type`(§2)에 먼저 기록되고, 계약 체결로 계정이 생기면 여기로 복사됨
- `status`: enum(active/pending/inactive)
- `credit_balance`: int, default 0 — `credit_transactions`에서 파생 가능하지만 조회 성능 위해 캐시 컬럼으로 유지 (조정 시마다 트랜잭션과 함께 갱신)
- `joined_at`: timestamptz

목업 근거: `STUDENTS_ADMIN_T`, `DATA[child]` (학생/학부모 포털)

### `parents`
- `id`: uuid, PK, FK → `profiles.id`
- `referral_code`: text, unique
- `location`: text, nullable
- `joined_at`: timestamptz

목업 근거: `PARENTS_T`, `PARENT`(학부모 포털 — 로그인한 본인)

### `guardian_students` (parent ↔ student, N:M)
- `id`: uuid, PK
- `parent_id`: uuid, FK → `parents.id`
- `student_id`: uuid, FK → `students.id`
- `relation_type`: enum(모/부/기타)
- `is_primary`: boolean — 알림/청구 기본 수신자 여부

목업 근거: 학부모 포털의 "자녀 전환"은 `PARENT`에 `children` 배열조차 없이 `DATA`/`RAW_LESSONS`의 object key로만 암묵적으로 존재했음 — 실 스키마에서는 반드시 명시적 join 테이블이 필요 (parent-first invitation 순서 정책과도 연결).

### `teachers`
- `id`: uuid, PK, FK → `profiles.id`
- `school`: text
- `bio`: text, nullable
- `status`: enum(active/pending)
- `joined_at`: timestamptz

목업 근거: `TEACHERS_ADMIN_T`, `TEACHER`(선생님 포털 — 로그인한 본인), `TEACHERS`(학생/학부모 포털의 이름 keyed map — 실 스키마에서는 이름이 아니라 FK로 참조)

---

## 2. 상담 / 온보딩

### `consult_requests`
- `id`: uuid, PK
- `category`: enum(family/teacher_applicant)
- `person_name`, `email`, `phone`: text
- `student_grade`: text, nullable
- `intake_type`: enum(A/B/C/D/E), nullable — 상담 중 Chrisy가 수동으로 선택해 저장. 계약 체결로 계정이 생기면 `students.intake_type`(§1)으로 복사됨 (**확인 필요 — "상담 중 수동 선택"이 맞는지만 확정, 그 외엔 목업에 근거가 없던 필드라 계속 주시할 것**)
- `concerns`: text
- `submitted_at`: timestamptz
- `status`: enum(requested/confirmed/completed)
- `scheduled_at`: timestamptz, nullable (Calendly 연동 후 채워짐)
- `meeting_link`: text, nullable
- `meeting_notes`: text, nullable
- `completed_at`: timestamptz, nullable
- `converted_student_id`: FK → `students.id`, nullable
- `converted_parent_id`: FK → `parents.id`, nullable
- `calendly_event_uri`: text, nullable — Calendly가 예약의 유일한 소스 (아래 참고)

목업 근거: `CONSULTS_DB_T` — "신청부터 완료까지 하나의 레코드에 누적"되는 설계를 그대로 유지. 목업은 `personName`/`email` 문자열만으로 사람을 식별했는데(FK 없음), 실 스키마에서는 상담 신청 시점엔 아직 계정이 없을 수 있어 이 테이블은 계정과 무관한 1차 기록으로 남겨두고, **계약 체결 시점에 실제 `students`/`parents` 계정이 생성되면서 `converted_student_id`/`converted_parent_id`로 연결**한다 — 트라이얼 수업이 계약 체결과 맞물려 진행되므로, 트라이얼 수업을 실제 세션 데이터로 남기려면 그 시점엔 이미 계정이 있어야 하기 때문. (§6 `sessions.is_trial` 참고)

### `consult_attachments`
- `id`: uuid, PK
- `consult_request_id`: FK → `consult_requests.id`
- `filename`: text
- `storage_path`: text (Supabase Storage)
- `uploaded_at`: timestamptz

목업 근거: `CONSULTS_DB_T.attachments` (파일명 배열만 있던 것을 정규화)

### ~~`consult_availability_slots`~~ → Calendly로 대체 (테이블 제거)
목업 근거: `CONSULT_RANGES_T` — 관리자가 여는 상담용 슬롯. **원래 자체 테이블로 설계했었는데, 확인 결과 Calendly가 상담/개별 회차 예약을 전담**(functional-spec §2, §9)하는 걸로 확정돼서 제거함. 가용시간 설정 자체를 Calendly 쪽 UI에서 관리하고, 우리 DB는 예약 "결과"만 웹훅으로 받아 반영한다.

---

## 3. 계약

### `contracts` (자녀별 개별 계약)
- `id`: uuid, PK
- `parent_id`: FK → `parents.id` (법적 서명자)
- `student_id`: FK → `students.id` (계약 대상 자녀 — **자녀별로 계약 1건**)
- `docusign_envelope_id`: text, nullable
- `status`: enum(sent/signed)
- `signed_at`: timestamptz, nullable
- `document_url`: text (서명된 문서 저장 위치)

목업 근거: `CONTRACTS_T`는 `studentNames`를 콤마로 join한 문자열이었음(`'지훈, 이서아'`) — 확인 결과 계약은 자녀별 개별 계약이 맞다고 해서, 처음 설계했던 join 테이블(가족 단위 1건) 대신 `student_id`를 계약에 직접 FK로 뒀다. 참고: `student_id`가 가리키는 학생 계정은 이 계약 체결 시점에 생성됨 — 아래 §4a "계정 생성 시점" 참고.

### `teacher_contracts`
- `id`: uuid, PK
- `teacher_id`: FK → `teachers.id`
- `doc_type`: text (예: "튜터 계약서 + W-8BEN")
- `docusign_envelope_id`: text, nullable
- `status`: enum(sent/signed)
- `signed_at`: timestamptz, nullable
- `document_url`: text

목업 근거: `TEACHER_CONTRACTS_T` — W-8BEN + 한국 소재 서비스 계약서 (사업개요 §1의 원천징수 비대상 근거).

---

## 4. 매칭 / 등록 (매칭 = 커리큘럼 진행 요약을 겸함)

### `enrollments`
- `id`: uuid, PK
- `student_id`: FK → `students.id`
- `teacher_id`: FK → `teachers.id`
- `subject_id`: FK → `subjects.id`
- `status`: enum(active/cancelled) — **소프트 삭제** (운영정책 §7)
- `total_sessions`: int
- `current_session`: int
- `created_at`: timestamptz
- `cancelled_at`: timestamptz, nullable

목업 근거: `MATCHES_T`(관리자 매칭) + `CURRICULA_T`(진행 요약, `studentId_subj` 합성키)를 하나로 합침 — 매칭 1건당 커리큘럼 진행 요약도 1개뿐이라 분리할 이유가 없다고 판단. Unique(student_id, teacher_id, subject_id) where status='active'.

---

## 5. 커리큘럼 — 3단 구조 (과목 템플릿 → 선생님 개인 템플릿 → 학생 배정)

교사 포털 분석에서 확인된 중요한 패턴: 목업은 **3단계 복사** 구조였다 — 관리자 마스터 템플릿을 선생님이 "내 과목"으로 복사하고, 선생님이 특정 학생에게 적용할 때 다시 한번 복사해서 세션들을 만든다. 이후 각 단계는 독립적으로 편집 가능하고 상위로 역전파되지 않는다. 이 구조를 그대로 정규 테이블로 옮긴다.

### `subjects`
- `id`: uuid, PK
- `name`: text, unique (예: "SAT Math") — **다른 모든 화면(교재 생성 폼 등)의 단일 진실 소스**

### `subject_template_units` (관리자 마스터 템플릿)
- `id`: uuid, PK
- `subject_id`: FK → `subjects.id`
- `position`: int (순서)
- `unit_title`: text
- `note`: text, nullable

목업 근거: `CATALOG_SUBJECTS_T`, `ADMIN_SUBJECT_CATALOG` — "과목 템플릿" 그 자체.

### `teacher_curriculum_templates` ("내 과목")
- `id`: uuid, PK
- `teacher_id`: FK → `teachers.id`
- `subject_id`: FK → `subjects.id`
- `created_at`: timestamptz
- unique(teacher_id, subject_id)

### `teacher_curriculum_template_units`
- `id`: uuid, PK
- `template_id`: FK → `teacher_curriculum_templates.id`
- `position`: int
- `unit_title`: text
- `note`: text, nullable
- `teacher_comment`: text, nullable

목업 근거: `MY_SUBJECTS_T` — `subject_template_units`를 복사(`mkTplRow`)해서 만들고, 이후 독립적으로 편집됨(관리자 템플릿에 역전파 안 됨). 자재 연결은 아래 `curriculum_docs`를 참조하는 join 테이블(`teacher_curriculum_template_unit_materials`, subject_template_units 쪽도 동일 패턴)로 처리 — 세부 컬럼은 002 마이그레이션 단계에서 확정.

---

## 6. 수업 세션 — 이 앱의 핵심 테이블

**중요**: `sessions`는 `student_id + teacher_id + subject + session_number`로 유니크해야 한다는 요구사항(prompt 01)은, 위에서 설계한 `enrollments`가 이미 (student, teacher, subject)를 유니크하게 식별하므로 `unique(enrollment_id, session_number)`로 충족된다.

### `sessions`
- `id`: uuid, PK
- `enrollment_id`: FK → `enrollments.id`
- `session_number`: int (회차)
- `unit_title`: text — 배정 당시 `teacher_curriculum_template_units`에서 복사(스냅샷). 이후 템플릿이 바뀌어도 이미 생성된 세션은 영향받지 않음
- `source_template_unit_id`: FK → `teacher_curriculum_template_units.id`, nullable (추적용, 템플릿 삭제돼도 세션은 유지되도록 `ON DELETE SET NULL`)
- `note`: text, nullable
- `teacher_comment`: text, nullable
- `status`: enum(upcoming/completed/cancelled/no_show)
- `scheduled_at`: timestamptz, nullable (예약 전에는 null)
- `duration_minutes`: int, default 30 — 운영정책 §7 "30분 단위 슬롯"
- `meeting_link`: text, nullable (Zoom 링크, 임베드 아님 — 외부연동 표 참고. 2026-08-28: Google Meet에서 Zoom으로 변경)
- `curriculum_doc_id`: FK → `curriculum_docs.id`, nullable — 이 세션에 배정된 교재
- `is_trial`: boolean, default false — 계약 체결 직후 진행되는 트라이얼 수업 표시
- `whiteboard_strokes`: jsonb, nullable — 연습장 화이트보드 최종 스냅샷 (§7 참고)
- `calendly_event_uri`: text, nullable — 이 회차의 실제 예약을 담당하는 Calendly 이벤트 참조 (아래 참고)
- `created_at`: timestamptz

unique(enrollment_id, session_number)

**설계 노트**: 세션뷰 상단바의 "준비중/진행중/완료" 3단계는 `status`+`scheduled_at`+`duration_minutes`로 클라이언트에서 계산해서 보여주고, DB에는 저장하지 않는 걸 권장한다 (진행중인지 여부는 "지금 시각이 예약시간~예약시간+길이 사이인지"로 매 순간 바뀌는 값이라 별도 컬럼으로 저장하면 곧 stale해짐). 다만 `completed`/`cancelled`/`no_show`는 실제 이벤트(수업 종료 버튼, 노쇼 신고)로 확정되는 영속 상태라 컬럼으로 둔다.

목업 근거: 목업에는 세션 자체를 나타내는 단일 엔티티가 없었고, `CURRICULA_T[key].sessions[]`(커리큘럼 진행 슬롯)와 `SCHEDULE_T`(실제 예약된 날짜/시간)가 분리되어 있었다 — 실 스키마에서는 이 둘을 하나로 합쳤다: 세션은 등록(enrollment) 생성 시 `teacher_curriculum_template_units`를 복사해 미리 N개 행으로 만들어두고(`scheduled_at=null`), **Calendly에서 실제로 예약되면 웹훅을 받아 그 행의 `scheduled_at`/`calendly_event_uri`를 채우는 방식**(아래 "Calendly가 예약의 유일한 소스" 참고).

**Calendly가 예약의 유일한 소스**: 목업의 선생님 포털엔 예약 요청 수락/거절 UI와 가용시간 설정 화면이 있었지만(`REQUESTS_T`, `OPEN_RANGES_T`, `TEACHER_AVAILABILITY`), functional-spec은 상담과 개별 회차 예약 모두 Calendly가 담당한다고 명시한다(§2, §9). 이미 해결된 문제(타임존 변환, 중복예약 방지, 재예약, 알림메일)를 다시 만들 이유가 없어서, 자체 예약 시스템(`booking_requests`, `teacher_availability`)은 만들지 않기로 확정 — 선생님 가용시간 설정도 Calendly 쪽에서 관리하고, 우리 DB는 Calendly 웹훅으로 넘어오는 예약 결과만 `sessions.scheduled_at`/`calendly_event_uri`에 반영한다.

### `session_memos`
- `id`: uuid, PK
- `enrollment_id`: FK → `enrollments.id` (세션이 아니라 등록 단위 — 아래 이유)
- `author_role`: enum(teacher/student/admin)
- `text`: text
- `created_at`: timestamptz

목업 근거: `CURRICULUM[subj].memos` — 목업에서 메모는 세션별이 아니라 "이 학생의 이 과목 커리큘럼 전체"에 달려 있었다. 세션 단위로 오해하기 쉬운 부분이라 명시.

### ~~`booking_requests`~~ / ~~`teacher_availability`~~ → Calendly로 대체 (테이블 제거)
목업 근거: `REQUESTS_T`, `TEACHER_AVAILABILITY`/`OPEN_RANGES_T` — 원래 자체 예약/가용시간 테이블로 설계했으나, 위 "Calendly가 예약의 유일한 소스" 결정에 따라 제거. 참고로 `REQUESTS_T` 원본은 `studentName` 문자열만 갖고 있어 이름이 겹치면 오배정되는 버그 소지가 있었는데(교사 포털 분석에서 지적됨), Calendly로 넘기면서 이 문제 자체가 사라진다.

### `makeup_credits`
- `id`: uuid, PK
- `student_id`: FK → `students.id`
- `teacher_id`: FK → `teachers.id`
- `triggering_session_id`: FK → `sessions.id`, nullable
- `count`: int
- `reason`: text
- `created_at`: timestamptz

목업 근거: `MAKEUP_COUNT_T`, `MAKEUP_STATUS_T` — 운영정책 §7 "선생님 지각 10분 기준" 규칙의 결과 기록. 목업은 이유/트리거 세션 연결 없이 카운터만 있었음 — 실 스키마는 이력 추적 가능하게 개별 행으로.

### `teacher_qc_warnings`
- `id`: uuid, PK
- `teacher_id`: FK → `teachers.id`
- `student_id`: FK → `students.id`, nullable
- `type`: text
- `detail`: text
- `occurred_at`: timestamptz

목업 근거: `QC_WARNINGS_T`. **주의**: 목업에서 `TEACHERS_ADMIN_T.qcWarnings`(카운트)가 이 테이블에서 파생되지 않고 별도로 하드코딩돼 있었음(불일치 소지 있는 부분으로 관리자 포털 분석에서 지적됨) — 실 스키마에서는 카운트를 저장하지 말고 이 테이블에서 매번 계산할 것.

---

## 7. 세션뷰 기능별 데이터 (전부 `sessions.id` 기준)

### `problems` — 문제/과제의 단일 모델
- `id`: uuid, PK
- `format`: enum(mc/essay/math)
- `passage`: text
- `options`: jsonb, nullable (mc 전용, 문자열 배열)
- `correct_index`: int, nullable (mc 전용)
- `explanation`: text
- `difficulty`: enum(easy/medium/hard)
- `skill_type`: text, nullable
- `subject_id`: FK → `subjects.id`, nullable
- `section_id`: FK → `curriculum_doc_sections.id`, nullable (교재에 포함된 문제인 경우)
- `origin_session_id`: FK → `sessions.id`, nullable (교재 밖, 특정 세션의 과제로 즉석 생성된 경우)
- `status`: enum(draft/confirmed) — **AI 생성 직후엔 draft, "과제로 확정"을 눌러야 confirmed** (functional-spec §5, §6 공통 원칙)
- `created_by`: FK → `profiles.id` (관리자 또는 선생님)
- `created_at`: timestamptz

**설계 노트 — 통합 결정 (확정)**: 관리자 포털 분석에서 지적된 대로, 목업에는 "문제/과제"가 최소 3가지 다른 모양으로 따로 존재했다 (`LESSON_HISTORY_T.assignments`: `{title,studentAnswer,graded,score}` / `CATALOG_SUBJECTS_T[..].assignments`: `{id,title,content}` / `CURRICULUM_DOCS_T`의 `problems`: `{id,format,passage,options,correctIndex,explanation}`). 이 초안은 이 셋을 `problems` 테이블 하나로 통합하고, "교재 문제"든 "세션 과제"든 "AI 생성 문제"든 전부 여기서 시작해서 `draft→confirmed` 절차를 거치게 했다 — **통합 방식으로 확정**.

### `homework_items`
- `id`: uuid, PK
- `session_id`: FK → `sessions.id`
- `problem_id`: FK → `problems.id`, nullable (AI 생성→확정 경로일 때)
- `title`: text
- `description`: text, nullable
- `student_answer`: text, nullable (자유 서술형, `problem_id`가 없는 수동 추가 과제용)
- `graded`: boolean, default false
- `score`: text, nullable (예: "8/10" — 목업 원본 그대로 문자열 유지, 숫자 분리는 002 단계에서 재검토)
- `created_at`: timestamptz

목업 근거: `HOMEWORK_ITEMS`, `ASSIGNMENTS_T`

### `session_problem_attempts` (문제 기록)
- `id`: uuid, PK
- `session_id`: FK → `sessions.id`, nullable (교재 라이브러리에서 세션 밖에 풀었을 수도 있음)
- `student_id`: FK → `students.id`
- `problem_id`: FK → `problems.id`
- `response`: jsonb (mc: 선택 인덱스 / essay: 텍스트 / math: 캔버스 이미지 URL — format별로 형태가 달라 jsonb)
- `correct`: boolean, nullable (essay/math는 null)
- `saved`: boolean, default false (즐겨찾기)
- `attempted_at`: timestamptz

### `teacher_problem_tags` (선생님 픽)
- `id`: uuid, PK
- `attempt_id`: FK → `session_problem_attempts.id`
- `teacher_id`: FK → `teachers.id`
- `reason`: enum(단어/로직/해석/기타)
- `reason_text`: text, nullable (reason='기타'일 때)
- `tagged_at`: timestamptz

### `vocab_words`
- `id`: uuid, PK
- `student_id`: FK → `students.id`
- `word`: text
- `definition`: text
- `example`: text
- `similar_words`: text[]
- `source_session_id`: FK → `sessions.id`, nullable
- `created_at`: timestamptz

목업 근거: `VOCAB_LIST`, `STUDENT_VOCAB_S` — functional-spec §5 "학생 포털의 단어장과 데이터 공유" 요구사항대로 `student_id` 기준 단일 테이블 (목업은 세션뷰/학생포털에서 서로 다른 전역 배열을 썼음 — 실제로는 공유 안 됐던 부분).

### `session_doc_links` (연습장 — Docs 서브탭)
- `id`: uuid, PK
- `session_id`: FK → `sessions.id`
- `title`: text
- `external_url`: text (Google Docs 임베드 링크)
- `created_at`: timestamptz

### `sessions.whiteboard_room_id` (연습장 — 화이트보드 서브탭)
별도 테이블 대신 `sessions`에 컬럼 하나(`whiteboard_room_id text nullable`, 실질적으로는 세션 id를 그대로 room id로 써도 됨)로 충분하다. 실시간 동기화/영속 저장 방식은 아래 "검토 결과" 섹션에서 **Supabase Realtime Broadcast로 확정**(캔버스 필기와 동일한 방식, tldraw 등 신규 SaaS 도입 안 함) — 016 티켓에서 실제로 이 방식으로 구현·검증 완료. 영속 저장은 `sessions.whiteboard_strokes` jsonb에 최종 스트로크 배열을 보관.

### `session_files` (보충 자료)
- `id`: uuid, PK
- `session_id`: FK → `sessions.id`
- `uploaded_by_role`: enum(teacher/student)
- `uploaded_by_id`: FK → `profiles.id`
- `filename`: text
- `storage_path`: text (Supabase Storage)
- `uploaded_at`: timestamptz

목업 근거: `SHARED_FILES`, `LIVE_FILES_T` — "본인이 올린 파일만 삭제 가능, 삭제 시 확인 다이얼로그" 규칙은 애플리케이션 레벨에서 `uploaded_by_id = auth.uid()` 체크 + RLS로 처리 (002 단계).

### `canvas_annotations` (교재 탭 필기)
- `id`: uuid, PK
- `session_id`: FK → `sessions.id`
- `curriculum_doc_id`: FK → `curriculum_docs.id`
- `strokes`: jsonb (벡터 스트로크 데이터 — 좌표/색상/굵기 배열)
- `updated_at`: timestamptz

unique(session_id, curriculum_doc_id) — functional-spec §5 "콘텐츠 전체 높이에 걸친 단일 캔버스" + 목업 자체 주석("같은 교재를 다른 세션에서 열면 빈 캔버스로 시작, 이 세션을 복기할 때만 다시 보임")과 정확히 일치하도록 세션×교재 조합당 하나. **목업은 이걸 전혀 저장하지 않았음(순수 클라이언트 렌더링)**.

**실시간 동기화 확정**: 라이브 수업 중 선생님/학생이 같은 캔버스를 동시에 보며 필기하는 게 핵심 요구사항이라, **Supabase Realtime(Broadcast 채널)**로 스트로크 이벤트를 실시간 전송하고, `strokes` jsonb는 그 최종 결과를 세션 종료 시(또는 주기적으로) 영속 저장하는 용도로 쓴다. 화이트보드(`sessions.whiteboard_strokes`)도 동일한 방식. 새 화이트보드 SaaS(tldraw/Liveblocks 등) 없이 이미 쓰는 Supabase 인프라 하나로 처리 — 단순함과 실시간 공유 둘 다 만족.

---

## 8. 교재(curriculum_docs) — 세션과 무관한 콘텐츠 레이어

### `curriculum_docs`
- `id`: uuid, PK
- `title`: text
- `subject_id`: FK → `subjects.id`
- `unit_id`: FK → `subject_template_units.id`, nullable
- `owner_type`: enum(admin/teacher)
- `owner_teacher_id`: FK → `teachers.id`, nullable (owner_type='teacher'일 때만)
- `status`: enum(draft/pending_approval/published/rejected)
- `created_at`, `updated_at`: timestamptz

목업 근거: `CURRICULUM_DOCS_T`. **주의**: `MATERIALS_CATALOG_T`(관리자 포털의 구식 "교재 라이브러리")는 별도 병렬 구조로 존재했는데, 목업 자체 UI 카피가 새 자료는 `CURRICULUM_DOCS_T` 쪽("교재 문서" 탭)으로 만들라고 안내하고 있어 **레거시로 간주하고 실 스키마에 옮기지 않음** — 이견 있으면 알려달라.

### `curriculum_doc_sections`
- `id`: uuid, PK
- `curriculum_doc_id`: FK → `curriculum_docs.id`
- `position`: int
- `title`: text
- `body`: text (richtext HTML — WYSIWYG 에디터 출력)
- `teaching_tip`: text, nullable (선생님 전용)

`problems`는 위 §7에서 `section_id`로 연결됨 (별도 join 테이블 불필요).

### `curriculum_doc_adoptions`
- `curriculum_doc_id`: FK → `curriculum_docs.id`
- `teacher_id`: FK → `teachers.id`
- `adopted_at`: timestamptz

목업 근거: `adoptedBy` 배열 → 정규화.

### `curriculum_doc_versions`
- `id`: uuid, PK
- `curriculum_doc_id`: FK → `curriculum_docs.id`
- `version_number`: int
- `snapshot`: jsonb (그 시점 sections+problems 전체 스냅샷)
- `ai_assisted`: boolean
- `created_by`: FK → `profiles.id`
- `created_at`: timestamptz

목업 근거: 목업에는 없던 테이블 — functional-spec §8 "저작권 등록을 위해 버전 이력을 보존, AI 관여 부분 명시적으로 disclaim" 요구사항 때문에 추가. **판단 근거가 목업이 아니라 spec 문서라 검토 시 특히 확인 필요.**

---

## 9. 수업 리뷰

### `session_reviews`
- `id`: uuid, PK, unique(session_id)
- `session_id`: FK → `sessions.id`
- `teacher_summary`, `strength`, `improve`, `next_plan`: text
- `submitted_at`: timestamptz, nullable (제출 전엔 null = 아직 초안 상태)

### `session_review_categories`
- `id`: uuid, PK
- `review_id`: FK → `session_reviews.id`
- `category`: enum(concept/problemsolving/participation/homework) — 고정 4종, 과목별 변형 없음
- `ai_draft_text`: text
- `final_text`: text
- `reviewed`: boolean, default false
- `reviewed_at`: timestamptz, nullable

목업 근거: `REVIEWS_T` — 교사 포털 분석에서 지적된 대로, 원본은 `text`(초안/최종 겸용) + `checked`뿐이라 AI 원본과 최종본을 구분 못 했음. 실 스키마는 `ai_draft_text`/`final_text`를 분리해서 "AI가 작성한 부분 명시적으로 disclaim"(functional-spec §8) 요구와도 맞춘다.

### `session_review_revisions` (이력)
- `id`: uuid, PK
- `session_id`: FK → `sessions.id`
- `revision_number`: int
- `snapshot`: jsonb (제출 당시 `session_reviews`+`session_review_categories` 전체 스냅샷)
- `submitted_at`: timestamptz

관리자 반려 등으로 리뷰가 재작성될 때마다, 덮어쓰기 전에 기존 내용을 여기 스냅샷으로 남긴다. `session_reviews`/`session_review_categories`는 항상 "현재(최신)" 버전만 들고 있고, 과거 버전이 필요하면 이 테이블에서 조회.

### `session_student_feedback`
- `id`: uuid, PK, unique(session_id)
- `session_id`: FK → `sessions.id`
- `student_id`: FK → `students.id`
- `rating`: int (0-5)
- `comment`: text
- `submitted_at`: timestamptz, nullable

목업 근거: `REVIEWS_T.studentReview`

---

## 10. 메시징 / 알림

### `chat_threads`
- `id`: uuid, PK, unique(student_id, teacher_id)
- `student_id`: FK → `students.id`
- `teacher_id`: FK → `teachers.id`

### `chat_messages`
- `id`: uuid, PK
- `thread_id`: FK → `chat_threads.id`
- `sender_role`: enum(teacher/student)
- `text`: text
- `created_at`: timestamptz

목업 근거: `CHATS_T`, `CHATS_S`. 목업은 학생 1명당 스레드 1개뿐이라 학생이 과목별로 다른 선생님과 있을 때도 뭉뚱그려졌음(학생 포털 분석에서 지적) — `unique(student_id, teacher_id)`로 선생님별 분리.

### `parent_requests`
- `id`: uuid, PK
- `parent_id`: FK → `parents.id`
- `student_id`: FK → `students.id`
- `teacher_id`: FK → `teachers.id`, nullable
- `text`: text
- `status`: enum(open/resolved)
- `created_at`: timestamptz

목업 근거: `PARENT_REQUESTS_T`/`PARENT_REQUESTS_ADMIN_T` (학부모→관리자 요청, 원본은 이름 문자열만 있었음 → FK로 대체)

### `notifications`
- `id`: uuid, PK
- `recipient_id`: FK → `profiles.id`
- `text`: text
- `link_view`: text, nullable (딥링크할 화면 식별자)
- `read`: boolean, default false
- `created_at`: timestamptz

목업 근거: `NOTIFICATIONS` (전 포털 공통 패턴)

---

## 11. 결제 / 크레딧

### `credit_packages`
- `id`: uuid, PK
- `name`: text
- `credit_count`: int
- `price_usd`: numeric
- `active`: boolean

목업 근거: 학부모 포털의 하드코딩 HTML(10장/$1,200, 20장/$2,400, 40장/$4,800 — 장당 $120 고정, 대량 할인 없음 — 운영정책 §7과 일치)

### `credit_purchases`
- `id`: uuid, PK
- `student_id`: FK → `students.id`
- `package_id`: FK → `credit_packages.id`
- `stripe_payment_intent_id`: text
- `amount_usd`: numeric
- `credits_purchased`: int
- `purchased_at`: timestamptz

### `credit_transactions` (원장)
- `id`: uuid, PK
- `student_id`: FK → `students.id`
- `type`: enum(purchase/debit/refund/adjustment/referral_bonus)
- `amount`: int (부호 있음)
- `related_session_id`: FK → `sessions.id`, nullable
- `related_purchase_id`: FK → `credit_purchases.id`, nullable
- `admin_id`: FK → `profiles.id`, nullable (수동 조정 시)
- `reason`: text, nullable
- `created_at`: timestamptz

목업 근거: **목업 전체에 걸쳐 원장/거래이력 테이블이 아예 없었다** — 잔액(`credit_balance`)만 그때그때 숫자로 mutate했음(학생/관리자 포털 분석 모두 동일하게 지적). 실 스키마는 반드시 원장을 둬야 나중에 "왜 잔액이 이렇게 됐는지" 추적 가능. `CREDIT_ADJUSTMENTS_T`(카테고리: 환불/굿윌/오류정정/기타)도 이 테이블의 `type='adjustment'` + `reason`으로 흡수.

### `payment_methods`
- `id`: uuid, PK
- `parent_id`: FK → `parents.id`
- `is_primary`: boolean
- `stripe_payment_method_id`: text — **Stripe 토큰만 저장, 카드번호/CVC 등 원본 데이터는 절대 저장 안 함**
- `brand`: text, `last4`: text, `expiry`: text (표시용 메타데이터만)

---

## 12. 정산 (선생님 KRW 지급)

### `teacher_payouts`
- `id`: uuid, PK
- `teacher_id`: FK → `teachers.id`
- `amount_krw`: int
- `period_start`, `period_end`: date
- `status`: enum(pending/approved/paid)
- `wise_transfer_id`: text, nullable
- `approved_by`: FK → `profiles.id`, nullable
- `paid_at`: timestamptz, nullable

목업 근거: `PAYOUTS_T`. `SESSIONS_LOG_T`(정산 집계용 별도 로그)는 **의도적으로 스키마에 옮기지 않음** — 관리자 포털 분석에서 `LESSON_HISTORY_T`/`sessions`와 중복이라고 지적된 부분이라, 정산 금액은 완료된 `sessions`에서 직접 집계하는 게 맞다고 판단 (외부연동 §9 "자동 계산, 사람 승인 후 집행" 원칙과도 맞음 — `status='pending'`이 자동계산 단계, `approved`가 사람 승인 단계).

---

## 13. 관리자 내부 (교재/세션과 무관)

### `company_documents`
- `id`: uuid, PK
- `category`: enum(법인설립/계좌정보/세무/계약템플릿/기타)
- `filename`: text
- `storage_path`: text
- `uploaded_at`: timestamptz

목업 근거: `COMPANY_DOCS_T` — 법인 서류 아카이브, 교재 문서와 이름이 비슷해 보이지만 완전히 다른 개념이라 별도 테이블 유지.

---

## 검토 결과 (2026-08-27 확정)

1. **`problems` 테이블 통합** → **확정.** "교재 문제"/"세션 과제"/"AI 초안"을 `problems` 하나로 통합.
2. **`intake_type`(A-E 분류) 필드** → 상담 중 Chrisy가 수동 선택, 계약 시 `students.intake_type`으로 복사. **입력 UI 자체는 지금 안 만들어도 됨** — nullable 필드라 다른 테이블에 영향 없고, 실제 입력 화면은 Phase 5(관리자 포털, 원래도 후순위)에서 만들면 됨.
3. **`contracts`** → **자녀별 개별 계약으로 확정** (`contracts.student_id` 직접 FK, join 테이블 제거).
4. **계정 생성 시점** → **확정.** 상담 신청 단계(`consult_requests`)엔 계정이 없고, **계약 체결 시점에 `students`/`parents` 계정 생성** — 계약과 맞물려 진행되는 트라이얼 수업을 실제 세션(`sessions.is_trial=true`)으로 남기기 위함.
5. **캔버스 필기 저장 방식** → 벡터 스트로크(jsonb) 유지, **실시간 동기화는 Supabase Realtime(Broadcast)로 확정**(새 벤더 없이 기존 Supabase 인프라 재사용).
6. **화이트보드 실서비스** → 캔버스와 동일하게 **Supabase Realtime**으로 확정, 저장은 `sessions.whiteboard_strokes` jsonb.
7. **리뷰 재작성 이력** → `session_review_revisions` 테이블 추가로 확정.

**남은 오픈 아이템**: 없음. 다음 단계(002 마이그레이션 + 인증)로 진행 가능.
