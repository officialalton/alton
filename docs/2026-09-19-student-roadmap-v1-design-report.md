# 학생 프로필 · 대학 준비 로드맵 V1 — 조사·설계 보고 (구현 착수 전)

> 브랜치 `feature/student-roadmap-v1`. 스펙 원문: [`2026-09-19-student-roadmap-v1-spec.md`](2026-09-19-student-roadmap-v1-spec.md).
> 아직 구현 착수 안 함 — 이 보고를 승인받은 뒤 프로필 폼 → 로드맵 화면 → 교사 읽기전용 → 관리자 전체 열람 순으로 진행.

## 1. 기존 스키마 조사 결과 — 섹션별 재사용 여부

`docs/spec/schema-draft.md`는 폐기된 초안(1행에 명시)이라 실제 스키마는 마이그레이션 파일만 신뢰. 관련 기존 테이블: `profiles`(base) → `students`(FK), `guardian_students`/`household_members`(보호자 관계).

`students` 테이블은 `20261026000000_m4_student_profile_completion.sql`에서 이미 한 차례 확장됨:
- `school_name`, `grade`(필수) — 학교·학년
- `sat_score integer`(0~1600 단일값) — **응시 이력 없음, ACT 없음, 목표 점수·다음 응시 계획 없음**
- `gpa numeric(3,2)`(선택)
- `target_colleges text[]`, `intended_majors text[]` — 자유 텍스트 배열, 국가/대학유형/지원시기 구조 없음
- `profile_completed_at` — 완료 게이트 플래그

같은 마이그레이션의 부속 테이블:
- `student_ap_courses`(course_name, status planned/taking/completed, exam_year, score) — AP만, 일반 수강 과목 없음
- `student_extracurricular_activities`(activity_name, description, start_date, end_date, is_ongoing) — 분야·역할·시간·리더십·성과·수상명/수준 컬럼 없음

| 스펙 섹션 | 재사용 가능한 것 | 신규 필요 |
|---|---|---|
| 1. 기본 학업 정보 | `students.grade/school_name/gpa` | 졸업 예정 연도, 교육과정(국내/미국계/IB 등), 현재 수강 과목(일반) |
| 2. 시험 정보 | `students.sat_score`(단일값, 마이그레이션으로 대체 예정) | 응시 이력(복수), ACT, 목표 점수, 다음 응시 계획 → 신규 테이블 |
| 3. 관심분야·대학목표 | `intended_majors`, `target_colleges`(text[]) | 진로, 희망 국가/대학 유형, 지원 목표 시기 |
| 4. 활동과 수상 | `student_extracurricular_activities`(활동명/기간) | 분야·역할·시간·리더십/성과, 수상명·수준(신규 `student_awards` 분리 권장) |
| 5. 준비 현황 | 없음 | 전부 신규(`student_prep_status`류) |

**방침**: `students` 테이블에 컬럼을 더 얹지 않고, 섹션 1·2·3·4·5를 각각 독립적인 신규 테이블로 분리한다(`student_academic_profile`, `student_test_records`, `student_college_interests`, `student_awards`, `student_prep_items` — 정확한 이름은 마이그레이션 작성 시 확정). 이유: 스펙이 "섹션별로 저장·보완 가능"을 요구하고, 기존 `students.sat_score`/`target_colleges`/`intended_majors`는 단일값·비구조 배열이라 이력·상태 추적이 안 됨 — 기존 컬럼은 읽기 호환만 유지하고 새 UI는 신규 테이블을 원본으로 쓴다(레거시 컬럼은 방치, 별도 마이그레이션 없이 deprecate만).

## 2. 권한(RLS) 모델

헬퍼 함수(기존, 그대로 재사용): `is_admin()`, `is_guardian_of(student_id)`, `teaches_student(student_id)`(`teacher_assignments`+`subject_enrollments` 기반, legacy `enrollments` OR — 신규 담당 학생 테이블 불필요).

직접 참고할 기존 패턴:
- **학생+보호자 쓰기 / 교사 읽기 전용**: `student_ap_courses`/`student_extracurricular_activities`의 RLS — select는 학생 본인 or `teaches_student()` or `is_guardian_of()` or `is_admin()`, insert/update/delete는 학생 본인 or `is_admin()`(보호자·교사는 쓰기 정책 없음). **스펙 요구("학생·학부모 작성/수정, 교사 읽기만")와 정확히 일치하지 않음** — 스펙은 학부모도 쓰기 가능해야 하므로 write 정책에 `is_guardian_of()`를 추가해야 한다(기존 패턴에서 한 단계 확장).
- **교사 읽기 전용 예시**: `session_smart_notes` — select 정책만 존재, insert/update/delete 정책 없음(교사·학생 모두 쓰기 불가, 관리자는 서버 경로로만).
- **관리자 전체 + 본인 household만**: `meeting_requests` — `"관리자 전체 조회"` / `"보호자 본인 household 조회"`, update는 관리자 전용.

**신규 로드맵 마일스톤 테이블(`student_roadmap_milestones`)의 RLS**: select는 학생 본인 or 보호자 or `teaches_student()` or 관리자, insert/update/delete는 학생 본인 or 보호자 or 관리자(교사 제외). status는 기존 컨벤션(`text not null default 'todo' check (status in ('todo','in_progress','done'))`)을 따른다.

민감 정보(재정·가족 배경)는 V1 범위에서 아예 수집하지 않음 — 스펙 지시대로 컬럼 자체를 만들지 않는다.

## 3. 진입점 — 코드 위치

- 학생: `app/student/StudentShell.tsx`의 `NAV_ITEMS` 배열, `{ id: "home", label: "홈" }` 다음에 `{ id: "roadmap", label: "로드맵" }` 삽입.
- 학부모: `app/parent/ParentShell.tsx`의 `NAV_ITEMS`, 동일 패턴.
- 교사: 메인 탭 아님 — `app/teacher/CurriculumTab.tsx`/`StudentCurriculumPanel.tsx`(학생별 커리큘럼 관리 화면)와 `app/session/*`(수업 화면)에 "학생 프로필·로드맵 보기"(읽기전용) 버튼/링크 추가.
- 관리자: 기존 `StudentDetailPanel.tsx` 계열에 전체 열람·수정 진입점 추가(신규 관리자 탭 대신 학생 상세 패널에 통합).

## 4. AI 월간 종합 리뷰 — 데이터 모델·화면 자리만 준비

V1은 생성 로직 없음. `student_roadmap_monthly_reviews`(또는 유사) 테이블에 `status`(`not_generated`만 사용, 생성 로직은 후속)와 `content`(nullable) 컬럼만 두고, 로드맵 화면 상단에 학부모 홈 "종합 리뷰" 서브탭과 동일하게 "아직 생성된 로드맵 리뷰가 없습니다" 정적 문구 자리만 배치. 입학 가능성 점수/합격 확률 필드는 만들지 않음.

## 5. 열린 질문 (결정 필요, 권장안 포함)

1. **기존 `students.sat_score/target_colleges/intended_majors`를 새 테이블로 마이그레이션(데이터 이전)할지, 그냥 신규 테이블만 쓰고 구컬럼은 방치할지** — 현재 실사용 데이터 없음(오픈 전)이므로 **권장: 데이터 이전 없이 신규 테이블만 사용, 구컬럼은 읽기 호환만 유지하고 새 UI에서 노출 안 함**.
2. **"현재 수강 과목"을 자유 텍스트로 받을지, 과목 템플릿(`subject_template_units` 등 기존 과목 마스터)과 연결할지** — 스펙에 없어 재량 판단이나, CLAUDE.md 원칙 4("과목 템플릿이 단일 진실 소스")를 따르면 연결이 맞지만 로드맵은 학원 외부 학교 수강 과목까지 포함해야 하므로 **권장: 자유 텍스트 리스트(학원 과목과 무관, 학교 수강 과목 기록용)**.
3. **활동/수상을 하나의 테이블(활동에 수상 컬럼 옵션)로 합칠지, 분리할지** — **권장: 분리**(`student_activities`, `student_awards`) — 수상이 특정 활동에 종속되지 않는 경우(교내 경시대회 등)가 있어 1:1 강제가 부적절.

위 세 항목은 기술 구현 선택 범위로 보고 별도 승인 없이 권장안대로 진행할 예정이나(CLAUDE.md "결과에 영향을 주지 않는 기술 구현 선택은 개발자가 판단"), 이견 있으면 알려주시기 바랍니다.
