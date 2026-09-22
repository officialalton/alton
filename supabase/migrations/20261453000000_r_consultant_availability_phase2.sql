-- 컨설턴트 Phase 2(2026-09-22 스펙 §Scheduling after Assignment) — "배정된
-- 컨설턴트의 가능시간만" 보여주려면 가능시간 자체가 컨설턴트별로 구분돼야
-- 한다. 기존 consult_availability_rules/exceptions는 의도적으로 "회사 공용
-- 가능시간"으로 설계됐다(20261009000000 주석 참고) — 다른 상담 유형(가족/
-- 선생님 지원자)은 계속 공용을 쓸 수 있어야 하므로, consultant_id를 nullable로
-- 추가해 null=공용, 값 있음=그 컨설턴트 전용으로 구분한다(사용자 승인:
-- "컨설턴트별 가능시간 신규 도입").

alter table consult_availability_rules add column if not exists consultant_id uuid references profiles (id);
alter table consult_availability_exceptions add column if not exists consultant_id uuid references profiles (id);

comment on column consult_availability_rules.consultant_id is
  '스펙 §Scheduling after Assignment — null이면 회사 공용(기존 동작 유지), 값이 있으면 그 컨설턴트 개인 가능시간.';
comment on column consult_availability_exceptions.consultant_id is
  '위와 동일 — null이면 공용 휴무/예외, 값이 있으면 그 컨설턴트 개인 예외.';

-- =========================================================================
-- 겹침 방지 제약을 컨설턴트별로 다시 건다(공용 규칙끼리는 기존과 동일하게
-- 겹침 금지, 서로 다른 컨설턴트의 규칙은 겹쳐도 된다).
-- =========================================================================
alter table consult_availability_rules drop constraint if exists consult_availability_rules_no_overlap;
alter table consult_availability_rules add constraint consult_availability_rules_no_overlap
  exclude using gist (
    coalesce(consultant_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    weekday with =,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) with &&
  ) where (active);

comment on constraint consult_availability_rules_no_overlap on consult_availability_rules is
  '같은 컨설턴트(또는 공용, consultant_id null)·같은 요일에 겹치는 반복 가능시간을 등록할 수 없다. 서로 다른 컨설턴트끼리는 겹쳐도 된다.';

-- 예외(휴무/임시 오픈) 테이블의 기존 unique index는 consultant_id를 몰라서
-- 그대로 두면 서로 다른 컨설턴트의 같은 날짜 예외가 충돌한다 — 동적으로
-- 찾아서 지우고 consultant_id를 포함한 인덱스로 다시 만든다.
do $$
declare
  v_index_name text;
begin
  select indexname into v_index_name
  from pg_indexes
  where tablename = 'consult_availability_exceptions'
    and indexdef like '%exception_date%coalesce%start_time%'
  limit 1;
  if v_index_name is not null then
    execute format('drop index if exists %I', v_index_name);
  end if;
end $$;

create unique index consult_availability_exceptions_scoped_idx on consult_availability_exceptions (
  coalesce(consultant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  exception_date,
  coalesce(start_time, '00:00'::time)
);

-- =========================================================================
-- RLS 쓰기 정책 확장 — 컨설턴트도 자기 자신의 가능시간/예외를 직접 관리할 수 있게.
-- =========================================================================
drop policy if exists "관리자 쓰기" on consult_availability_rules;
create policy "관리자/본인 컨설턴트 쓰기" on consult_availability_rules for all
  using (is_admin() or consultant_id = auth.uid())
  with check (is_admin() or consultant_id = auth.uid());

drop policy if exists "관리자 쓰기" on consult_availability_exceptions;
create policy "관리자/본인 컨설턴트 쓰기" on consult_availability_exceptions for all
  using (is_admin() or consultant_id = auth.uid())
  with check (is_admin() or consultant_id = auth.uid());
