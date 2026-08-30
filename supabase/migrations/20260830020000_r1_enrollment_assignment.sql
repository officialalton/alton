-- R1 — v3 스키마 3/12: subject_enrollments / teacher_assignments
-- 이름이 기존 `enrollments`와 겹치지 않으므로 최종 이름을 바로 사용한다. 기존
-- `enrollments`는 이번 R1에서 rename하거나 건드리지 않는다 — cutover 이후에도
-- 이름 충돌이 없어 별도 조치가 필요 없다(DROP 없음, R1~R10 검증 기간 읽기 전용 보존).

create table subject_enrollments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references profiles (id),
  subject_id uuid not null references subjects (id),
  contract_id uuid not null references contracts_v3 (id),
  status v3_subject_enrollment_status not null default 'planned',
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on subject_enrollments (child_id);
create index on subject_enrollments (contract_id);

-- 불변(Gate B §3.2): (child_id, subject_id)에 동시 active/paused 1개
create unique index subject_enrollments_one_live_per_subject
  on subject_enrollments (child_id, subject_id) where (status in ('active', 'paused'));

create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_id uuid not null references profiles (id),
  status v3_teacher_assignment_status not null default 'planned',
  effective_from timestamptz not null,
  effective_until timestamptz,
  reason text,
  changed_by uuid references profiles (id),
  source text not null default 'app', -- 'app' | 'migration' 등
  created_at timestamptz not null default now()
);
create index on teacher_assignments (subject_enrollment_id);
create index on teacher_assignments (teacher_id);

-- 불변(Gate B §3.3, 개정 v4): planned/active 상태의 기간 겹침을 exclusion constraint로 차단.
-- "동시 active 1개"와 "planned끼리 겹침 금지"를 이 제약 하나로 함께 보장한다.
create extension if not exists btree_gist;
alter table teacher_assignments add constraint teacher_assignments_no_overlap
  exclude using gist (
    subject_enrollment_id with =,
    tstzrange(effective_from, coalesce(effective_until, 'infinity'::timestamptz)) with &&
  ) where (status in ('planned', 'active'));

comment on table subject_enrollments is 'Gate B §3.2, §2 매핑표: 기존 enrollments를 과목 수강(선생님 무관)으로 분리.';
comment on table teacher_assignments is 'Gate B §3.3: 자녀·과목에 선생님이 배정된 기간. 변경 시 기존 행을 UPDATE하지 않고 종료+신규 insert(단일 트랜잭션).';
