-- 버그(실사용 UAT 발견): set_consultant_auto_assign_enabled()의 UPDATE에
-- WHERE 절이 없어 "UPDATE requires a WHERE clause" 오류로 실패했다
-- (payout_auto_dispatch_settings의 set_auto_dispatch_enabled()와 동일하게
-- where id = true를 추가한다 — 싱글턴 테이블이라도 안전장치가 걸린다).
create or replace function public.set_consultant_auto_assign_enabled(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 자동배정 설정을 바꿀 수 있습니다.';
  end if;
  update consultant_assignment_settings
    set auto_assign_enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
    where id = true;
end;
$$;
