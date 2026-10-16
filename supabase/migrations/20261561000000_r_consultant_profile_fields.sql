-- Phase B(4) — 컨설턴트 Profile 탭. 이름·생년월일·성별·이력·입사일을 볼 수
-- 있어야 한다. profiles에 gender/career_bio/hire_date가 없어 추가한다
-- (timezone은 20260827120000에 이미 있음). "입사일 등 회사 기준 정보는
-- 관리자 수정으로 두고, 컨설턴트 본인이 수정할 수 있는 항목은 구분" —
-- 이름·생년월일·입사일은 관리자만 수정(기존에도 이름/생년월일은 관리자
-- 관리 항목이었다 — app/admin/users-actions.ts 패턴과 일관), 성별·이력·
-- 시간대는 본인이 수정한다. RLS 자체는 role 구분 없이 본인 프로필 수정을
-- 허용하는 기존 정책을 그대로 두고(다른 role도 동일 컬럼을 공유), 관리자
-- 전용 필드(hire_date) 수정은 앱 레이어(서버 액션)에서 role 검사로 막는다
-- (기존 admin_edited_by/admin_edited_at 감사 패턴과 동일).

alter table profiles add column gender text check (gender in ('male', 'female', 'unspecified'));
alter table profiles add column career_bio text;
alter table profiles add column hire_date date;

comment on column profiles.gender is '2026-09-23(Phase B-4) — 자기 보고. 컨설턴트 등 직원 프로필에서 본인이 수정.';
comment on column profiles.career_bio is '2026-09-23(Phase B-4) — 자기소개/이력. 본인이 수정.';
comment on column profiles.hire_date is '2026-09-23(Phase B-4) — 입사일. 회사 기준 정보라 관리자만 수정(트리거로 본인 수정 차단).';

-- date_of_birth와 같은 패턴(20260904000000 protect_date_of_birth) — 본인
-- 프로필 수정 RLS가 열려 있어도 hire_date만은 관리자만 바꿀 수 있게
-- 트리거로 한 번 더 막는다(앱 레이어 검사만으로는 direct REST 호출을
-- 못 막는다).
create or replace function public.protect_hire_date()
returns trigger language plpgsql as $$
begin
  if new.hire_date is distinct from old.hire_date then
    if not is_admin() then
      raise exception '입사일은 관리자만 수정할 수 있습니다.';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect_hire_date
  before update of hire_date on profiles
  for each row execute function public.protect_hire_date();
