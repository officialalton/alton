-- 2026-10-05 오너 결정(미국 고객 대상 영어 UI): 단어장 기본 폴더 이름 "오답 노트" → "Missed Words".
-- 기본 폴더는 is_default 로 식별하므로 이름만 바꿔도 동작은 같다. 기존 학생 폴더도 이름을 바꾼다
-- ((student_id, name) 유니크 충돌을 피해, 이미 'Missed Words' 가 있는 학생은 건너뛴다).
create or replace function public.ensure_default_vocab_folder(p_student_id uuid)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (p_student_id = auth.uid() or teaches_student(p_student_id) or is_admin()) then
    raise exception '본인 또는 담당 학생만 폴더를 만들 수 있습니다.';
  end if;
  select id into v_id from vocab_word_folders where student_id = p_student_id and is_default limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into vocab_word_folders (student_id, name, is_default, position)
  values (p_student_id, 'Missed Words', true, -1)
  on conflict (student_id, name) do update set is_default = true
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ensure_default_vocab_folder(uuid) from public, anon;
grant execute on function public.ensure_default_vocab_folder(uuid) to authenticated;

update vocab_word_folders f
   set name = 'Missed Words'
 where f.name = '오답 노트'
   and not exists (select 1 from vocab_word_folders x where x.student_id = f.student_id and x.name = 'Missed Words');
