-- 20261985/20261986 후속 정정(2026-10-01): 실제 공개 경로(confirm_and_publish_problem_version → publish_problem_version)는
-- 버전을 published 로 바꾼 뒤 problems 를 갱신하면서 difficulty 를 같이 쓴다. 문항 난이도가 아직 비어 있던(null) 경우 등에서
-- 난이도 가드가 이 정상 갱신을 막았다. publish_problem_version 본문은 그대로 두고 가드·동기화 트리거만 고친다.
--  * 가드: 기존 난이도가 null 이면(첫 설정) 통과. 값이 있던 문항의 난이도 변경은 여전히 RPC/동기화 트리거 경로만.
--  * 동기화 트리거: 문항 난이도가 null 이면 이력·상태 변경 없이 새 공개 버전 값으로 조용히 채운다(첫 설정).
--    값이 다르면 기존대로 맞춤 + 잠정 복귀 + 이력. (버전 공개가 problems 갱신보다 먼저라 트리거가 먼저 돌고,
--    뒤따르는 problems 갱신은 이미 같은 값이라 가드에 걸리지 않는다.)
-- 되돌리기: 두 함수를 20261985/20261986 정의로 복원.
create or replace function public.problems_difficulty_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('alton.difficulty_rpc', true), '') <> 'on' then
    if (new.difficulty is distinct from old.difficulty and old.difficulty is not null)
       or new.difficulty_status is distinct from old.difficulty_status
       or new.difficulty_confirmed_at is distinct from old.difficulty_confirmed_at
       or new.difficulty_confirmed_by is distinct from old.difficulty_confirmed_by then
      raise exception '문항 난이도는 난이도 점검 기능으로만 바꿀 수 있습니다.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.problem_versions_difficulty_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cur text; v_status text;
begin
  if coalesce(current_setting('alton.difficulty_rpc', true), '') = 'on' or new.difficulty is null or new.difficulty = '' then
    return new;
  end if;
  select difficulty::text, difficulty_status into v_cur, v_status from problems where id = new.problem_id for update;
  if v_cur = new.difficulty then return new; end if;
  perform set_config('alton.difficulty_rpc', 'on', true);
  if v_cur is null then
    update problems set difficulty = new.difficulty::problem_difficulty where id = new.problem_id; -- 첫 설정: 이력·상태 그대로
    perform set_config('alton.difficulty_rpc', 'off', true);
    return new;
  end if;
  update problems set difficulty = new.difficulty::problem_difficulty, difficulty_status = 'provisional',
         difficulty_confirmed_at = null, difficulty_confirmed_by = null
   where id = new.problem_id;
  perform set_config('alton.difficulty_rpc', 'off', true);
  insert into problem_difficulty_changes (problem_id, problem_version_id, action, from_difficulty, to_difficulty, from_status, to_status, changed_by, reason, batch_id)
  values (new.problem_id, new.id, 'change', v_cur, new.difficulty, v_status, 'provisional', new.published_by, '본문 개정 공개에 의한 변경', gen_random_uuid());
  return new;
end $$;
