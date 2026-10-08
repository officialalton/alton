-- AP 후보의 문항 내용(자료·본문·선지·정답·FRQ 파트)이 바뀌면 렌더·화면 검증을 무효화한다(이전 검증이 다른 내용에 재사용되지 않게).
-- 변환된 후보(problem_id 있음)는 검증이 이미 고정이라 건드리지 않는다. 내용이 같으면(import 재실행 등) 아무 일도 하지 않는다.
-- 되돌리기: drop trigger ap_candidate_content_resets_verification on public.ap_candidate_items; drop function public.ap_candidate_content_resets_verification().
create or replace function public.ap_candidate_content_resets_verification() returns trigger language plpgsql as $$
begin
  if old.problem_id is null and (old.render_verified or old.screen_verified)
     and (old.payload->'stimulus', old.payload->'stem', old.payload->'options', old.payload->'key_index', old.payload->'key_index_final', old.payload->'parts')
         is distinct from
         (new.payload->'stimulus', new.payload->'stem', new.payload->'options', new.payload->'key_index', new.payload->'key_index_final', new.payload->'parts') then
    new.render_verified := false; new.screen_verified := false;
    new.render_evidence := null; new.screen_evidence := null;
  end if;
  return new;
end $$;
drop trigger if exists ap_candidate_content_resets_verification on public.ap_candidate_items;
create trigger ap_candidate_content_resets_verification before update of payload on public.ap_candidate_items
  for each row execute function public.ap_candidate_content_resets_verification();
