-- 플래너 보드 수동 할 일 감사 필드 (2026-10-01 오너 확정).
-- 생성일·생성자·최종 편집일·편집자를 서버(트리거)가 기록한다 — 클라이언트가 보낸 값은 무시되어 위조할 수 없다.
-- 이름은 기록 시점의 스냅샷(profiles.name)을 같이 남겨, 학부모·선생님 등 profiles 를 못 읽는 역할도 그대로 표시한다.
-- 삭제된 할 일은 행이 사라지므로 편집 기록 대상이 아니다(이동·완료·수정만 편집자·편집일 갱신).
-- 서비스 롤(auth.uid() 없음)이 쓰면 편집자는 기존 값을 유지하고 편집일만 갱신한다.

alter table board_manual_tasks
  add column if not exists created_by_name text,
  add column if not exists updated_by uuid references profiles (id) on delete set null,
  add column if not exists updated_by_name text;

-- 백필: 생성자 이름은 있는 대로, 한 번도 고쳐지지 않은 행(updated_at = created_at)만 편집자=생성자.
-- 이미 편집된 기존 행의 편집자는 알 수 없어 null(화면에서 '알 수 없음').
update board_manual_tasks t
set created_by_name = p.name
from profiles p
where p.id = t.created_by and t.created_by_name is null;

update board_manual_tasks
set updated_by = created_by, updated_by_name = created_by_name
where updated_by is null and updated_at = created_at;

create or replace function public.board_manual_tasks_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_name text;
begin
  if v_uid is not null then
    select name into v_name from profiles where id = v_uid;
  end if;
  if tg_op = 'INSERT' then
    if v_uid is not null then new.created_by := v_uid; end if;
    new.created_at := now();
    new.updated_at := new.created_at;
    new.created_by_name := (select name from profiles where id = new.created_by);
    new.updated_by := new.created_by;
    new.updated_by_name := new.created_by_name;
  else
    -- 생성 정보는 불변.
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.created_by_name := old.created_by_name;
    new.updated_at := now();
    if v_uid is not null then
      new.updated_by := v_uid;
      new.updated_by_name := v_name;
    else
      new.updated_by := old.updated_by;
      new.updated_by_name := old.updated_by_name;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.board_manual_tasks_audit() from public, anon, authenticated;

drop trigger if exists board_manual_tasks_audit on board_manual_tasks;
create trigger board_manual_tasks_audit
  before insert or update on board_manual_tasks
  for each row execute function public.board_manual_tasks_audit();
