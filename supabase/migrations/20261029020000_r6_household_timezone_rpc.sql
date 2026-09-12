-- R6 N/N — 시간대 설정 UI. profiles.timezone/households.default_timezone 컬럼은
-- 이미 R2에서 추가됐다(20260831011000_r2_account_status_apply.sql). profiles.timezone
-- 갱신은 기존 "본인 프로필 수정" RLS 정책(id = auth.uid())으로 이미 허용되므로 새
-- 정책이 필요 없다. households.default_timezone은 "households 쓰기" 정책이
-- is_admin() OR current_user_has_capability('학생관리')만 허용해(일반 보호자는
-- 통과 못 함) set_primary_guardian()과 동일한 패턴(security definer + 호출자가
-- 그 household의 주 보호자인지 함수 내부에서 직접 확인)으로 우회 경로를 연다.

create or replace function public.update_household_default_timezone(p_household_id uuid, p_timezone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_timezone is null or length(trim(p_timezone)) = 0 then
    raise exception '시간대 값이 비어 있습니다';
  end if;

  if not (
    is_admin()
    or exists (
      select 1 from household_members
      where household_id = p_household_id
        and profile_id = auth.uid()
        and role = 'guardian'
        and is_primary = true
    )
  ) then
    raise exception '이 가족의 주 보호자만 가족 기본 시간대를 변경할 수 있습니다';
  end if;

  update households set default_timezone = p_timezone where id = p_household_id;
end;
$$;

revoke execute on function public.update_household_default_timezone(uuid, text) from public;
grant execute on function public.update_household_default_timezone(uuid, text) to authenticated;
