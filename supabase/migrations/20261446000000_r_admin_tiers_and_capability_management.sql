-- 관리자 계정 구조(2026-09-22 사용자 지시) — "중간 관리자" 계정과, 마스터
-- 계정(official@alton.education)이 관리자별 권한을 셋업할 수 있는 기반.
--
-- 오늘 상태: role='admin'이면 전부 무제한 접근이다(requireAdminOrCapability가
-- role='admin'을 항상 통과시킨다 — lib/admin-auth.ts). supervisor_capabilities
-- 테이블과 current_user_has_capability() RPC는 이미 있지만(R1), 실제로 admin
-- 계정을 제한하는 데 쓰이지 않고 있었다.
--
-- 이번 마이그레이션은 그 상태를 그대로 보존한 채(기존 관리자 전원 'full' 등급
-- = 지금과 동일하게 무제한) 3단계 등급만 추가한다:
--   master     — official@alton.education. 유일하게 다른 관리자의 등급·권한을
--                바꿀 수 있다. 항상 무제한.
--   full       — 기존 관리자 전원(마이그레이션 시점 기준)의 기본값. 무제한
--                (오늘과 동일한 동작 — 정책을 바꾸지 않는다).
--   supervisor — 앞으로 마스터가 새로 지정하는 "중간 관리자". capability로
--                허용된 작업만 가능(requireAdminOrCapability의 capability
--                검사를 그대로 받는다 — role='admin' 자동 통과가 없어진다).
alter table profiles add column if not exists admin_tier text
  check (admin_tier in ('master', 'full', 'supervisor'));

-- 백필: 마스터 계정 하나만 지정하고, 나머지 기존 관리자는 전부 'full'(=오늘과
-- 동일하게 무제한)로 둔다 — 아무도 갑자기 권한을 잃지 않는다.
update profiles p
set admin_tier = 'master'
from auth.users u
where p.id = u.id and u.email = 'official@alton.education' and p.role = 'admin';

update profiles
set admin_tier = 'full'
where role = 'admin' and admin_tier is null;

create or replace function public.is_master_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select admin_tier = 'master' from profiles where id = auth.uid()), false);
$$;

comment on function public.is_master_admin() is
  '2026-09-22 — 다른 관리자의 등급·capability를 바꿀 수 있는 유일한 등급(master)인지 확인한다.';

-- supervisor_capabilities: 조회는 기존처럼 관리자 전원, 쓰기(부여·회수)는
-- 마스터만. 기존 "supervisor_capabilities 쓰기" 정책을 마스터 전용으로 좁힌다
-- (오늘까지는 관리자 아무나 capability를 부여할 수 있었는데, 실제로 이 테이블을
-- 쓰는 화면이 없어 사용된 적 없는 구멍이었다).
drop policy if exists "supervisor_capabilities 쓰기" on supervisor_capabilities;
create policy "supervisor_capabilities 쓰기(마스터만)" on supervisor_capabilities for all
  using (is_master_admin()) with check (is_master_admin());

-- profiles.admin_tier 변경도 마스터만 — 일반 관리자가 스스로를 master로 바꾸는
-- 경로를 막는다. 기존 profiles update 정책(본인 프로필 수정)에 admin_tier가
-- 걸려 있지 않은지는 애플리케이션 서버 액션에서 강제한다(profiles는 이미 여러
-- 정책이 얽혀 있어 여기서 새 컬럼만을 위한 컬럼 단위 정책을 추가하지 않고,
-- admin_tier 변경 전용 SECURITY DEFINER RPC로 좁힌다 — 아래).
create or replace function public.set_admin_tier(p_profile_id uuid, p_tier text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_master_admin() then
    raise exception '마스터 계정만 관리자 등급을 바꿀 수 있습니다.';
  end if;
  if p_tier not in ('full', 'supervisor') then
    raise exception '마스터 등급은 이 함수로 바꿀 수 없습니다.';
  end if;
  update profiles set admin_tier = p_tier where id = p_profile_id and role = 'admin';
  if not found then
    raise exception '존재하지 않는 관리자입니다.';
  end if;
end $$;

comment on function public.set_admin_tier(uuid, text) is
  '2026-09-22 — 마스터가 다른 관리자를 full(무제한)/supervisor(제한)로 지정한다. 마스터 등급 자체는 이 함수로 바꿀 수 없다(수동 이관만).';
