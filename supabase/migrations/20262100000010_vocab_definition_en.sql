-- 2026-10-05(제품 오너) — 미국 고객 대상: 학생 화면은 영어. 단어 뜻은 영어를 기본으로 보이고
-- 한국어는 토글로 보여준다. 데이터 변경 없이 nullable 컬럼만 추가한다(기존 단어는 definition_en 이
-- null 이면 한국어 뜻만 그대로 보여준다 — 백필은 scripts/vocab/backfill-definition-en.ts).
alter table public.vocab_words add column if not exists definition_en text;
alter table public.vocab_library_words add column if not exists definition_en text;

-- 공용 단어장 -> 학생 단어장 배정 복사에 definition_en 을 함께 복사한다(20261380 정의 + definition_en).
-- 이미 있는 단어는 폴더만 옮기던 기존 동작은 유지하되, 영어 뜻이 비어 있으면 채워 넣는다.
create or replace function public.assign_library_words_to_student(
  p_student_id uuid, p_library_word_ids uuid[], p_folder_id uuid default null
)
returns void
language plpgsql
security definer set search_path = public as $$
begin
  if not (teaches_student(p_student_id) or p_student_id = auth.uid() or is_admin()) then
    raise exception '담당하는 학생에게만 단어를 배정할 수 있습니다.';
  end if;
  insert into vocab_words (student_id, word, definition, definition_en, example, example2, similar_words, antonym_words, assigned_by, folder_id)
  select p_student_id, lw.word, lw.definition_ko, lw.definition_en, lw.example1, lw.example2, lw.synonym_words, lw.antonym_words,
         case when p_student_id = auth.uid() then null else auth.uid() end, p_folder_id
  from vocab_library_words lw
  where lw.id = any(p_library_word_ids)
  on conflict (student_id, word) do update
    set folder_id = excluded.folder_id,
        definition_en = coalesce(vocab_words.definition_en, excluded.definition_en);
end;
$$;
revoke all on function public.assign_library_words_to_student(uuid, uuid[], uuid) from public, anon;
grant execute on function public.assign_library_words_to_student(uuid, uuid[], uuid) to authenticated;
