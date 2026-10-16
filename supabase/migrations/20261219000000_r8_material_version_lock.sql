-- R8 1/N — sessions(v3).material_version_id 불변식 강제
--
-- 배경(docs/CURRENT.md "material_version_id 정책(R9 이관, 2026-09-02 명문화)"):
-- 이미 시작(final_status <> 'scheduled') 또는 완료된 세션의 material_version_id는
-- 절대 재배정/덮어쓰지 않는다. 실제 배정 메커니즘(과목 템플릿 기반)은 R9 범위이지만,
-- R8에서 세션뷰를 v3 sessions에 연결하면서 이 컬럼을 처음 쓰기 시작하므로 그 전에
-- 불변식을 트리거로 못박아 둔다 — 이 마이그레이션은 정책을 새로 만드는 것이 아니라
-- 이미 문서화된 정책을 코드로 반영하는 additive 변경이다.

create or replace function public.prevent_material_version_reassignment()
returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.bypass_session_lock', true), 'false') = 'true' then
    return new;
  end if;
  if old.material_version_id is not null
     and new.material_version_id is distinct from old.material_version_id then
    raise exception 'material_version_id는 세션 시작/완료 후 재배정할 수 없습니다.';
  end if;
  if old.final_status not in ('scheduled', 'live')
     and new.material_version_id is distinct from old.material_version_id then
    raise exception 'completed 세션의 material_version_id는 변경할 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger sessions_prevent_material_version_reassignment
  before update of material_version_id on sessions
  for each row execute function public.prevent_material_version_reassignment();

revoke execute on function public.prevent_material_version_reassignment() from public, anon, authenticated, service_role;
