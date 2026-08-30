-- R1 — v3 스키마 4/12: lesson_types / entitlement_types / entitlement_products / teacher_rate_history
-- (판매 가격·구매·결제는 R4 범위. 여기서는 세션 스냅샷과 수업권 grant가 참조할
-- 순수 마스터 데이터만 만든다 — master-roadmap R1 "수업 유형과 수업권 유형 버전".)

create table lesson_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  duration_minutes int not null,
  label text not null
);
insert into lesson_types (code, duration_minutes, label) values
  ('regular', 120, '정규 1:1 수업'),
  ('trial', 60, '체험 수업');

create table entitlement_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  lesson_type_id uuid not null references lesson_types (id)
);
insert into entitlement_types (code, lesson_type_id)
  select 'regular_lesson_use', id from lesson_types where code = 'regular';

create table entitlement_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  entitlement_type_id uuid not null references entitlement_types (id),
  quantity int not null check (quantity > 0)
);
insert into entitlement_products (code, entitlement_type_id, quantity)
  select 'lesson_pack_20', id, 20 from entitlement_types where code = 'regular_lesson_use';

-- 선생님 시급 이력(Gate B §3.11). 과거 이력이 없으므로 소급 생성하지 않고,
-- 이 마이그레이션 적용 시점을 effective_from으로 하는 최초 1행만 채운다(4단계 검증 시 실행).
create table teacher_rate_history (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'KRW',
  effective_from timestamptz not null,
  effective_until timestamptz,
  rate_version_id uuid not null default gen_random_uuid(),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index on teacher_rate_history (teacher_id);

alter table teacher_rate_history add constraint teacher_rate_history_no_overlap
  exclude using gist (
    teacher_id with =,
    tstzrange(effective_from, coalesce(effective_until, 'infinity'::timestamptz)) with &&
  );

create unique index teacher_rate_history_one_current_per_teacher
  on teacher_rate_history (teacher_id) where (effective_until is null);

comment on table teacher_rate_history is 'Gate B §3.11, §9-1: 과거 이력 소급 생성 없음. R1 백필 시 현재 teachers.hourly_rate_krw 값으로 v3 전환일 기준 최초 1행만 생성.';
