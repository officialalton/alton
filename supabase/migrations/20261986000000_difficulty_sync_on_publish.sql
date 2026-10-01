-- 본문 개정 공개가 난이도 이력 없이 문항 난이도를 바꾸지 못하게 한다(2026-10-01, 20261985000000 후속).
-- 새 버전이 published 로 전환될 때 그 버전의 difficulty 가 problems.difficulty 와 다르면:
--   문항 난이도를 새 공개 버전 값으로 맞추고, difficulty_status 를 provisional 로 되돌리며, 이력에
--   '본문 개정 공개에 의한 변경'(행위자 = 공개한 관리자)을 남긴다. 수정 초안 → 공개 흐름은 그대로 통과한다(거절 없음).
-- 난이도 점검 RPC 안(alton.difficulty_rpc=on)에서는 동작하지 않는다. 세트 스냅샷·응시는 건드리지 않는다.
-- 되돌리기: drop trigger problem_versions_difficulty_sync on problem_versions; drop function problem_versions_difficulty_sync();
--           alter table problem_difficulty_changes alter column changed_by set not null(행위자 없는 행이 없을 때).
alter table public.problem_difficulty_changes alter column changed_by drop not null;

create or replace function public.problem_versions_difficulty_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cur text; v_status text;
begin
  if coalesce(current_setting('alton.difficulty_rpc', true), '') = 'on' or new.difficulty is null then
    return new;
  end if;
  select difficulty::text, difficulty_status into v_cur, v_status from problems where id = new.problem_id for update;
  if v_cur is null or v_cur = new.difficulty then return new; end if;
  perform set_config('alton.difficulty_rpc', 'on', true);
  update problems set difficulty = new.difficulty::problem_difficulty, difficulty_status = 'provisional',
         difficulty_confirmed_at = null, difficulty_confirmed_by = null
   where id = new.problem_id;
  perform set_config('alton.difficulty_rpc', 'off', true);
  insert into problem_difficulty_changes (problem_id, problem_version_id, action, from_difficulty, to_difficulty, from_status, to_status, changed_by, reason, batch_id)
  values (new.problem_id, new.id, 'change', v_cur, new.difficulty, v_status, 'provisional', new.published_by, '본문 개정 공개에 의한 변경', gen_random_uuid());
  return new;
end $$;
drop trigger if exists problem_versions_difficulty_sync on public.problem_versions;
create trigger problem_versions_difficulty_sync after update of status on public.problem_versions
  for each row when (new.status = 'published' and old.status is distinct from 'published')
  execute function public.problem_versions_difficulty_sync();
