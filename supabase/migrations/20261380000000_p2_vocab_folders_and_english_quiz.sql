-- 2026-09-16 제품 오너 세부 지시 — 내 단어장에 폴더(기본 폴더 "오답 노트" 포함), 단어별
-- 폴더 지정("별표" 저장/취소), 시험 선택지는 영어(유의어 기반)로, 오답은 "오답 노트" 폴더에
-- 자동 저장(맞히면 폴더에서 빠짐). vocab_review_items(20261376)는 아직 실사용 전이라 폴더
-- 방식으로 대체하고 걷어낸다(공유 non-prod에 실제 데이터 없음).

drop table if exists vocab_review_items;

create table vocab_word_folders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (student_id, name)
);
create index on vocab_word_folders (student_id, position);
comment on table vocab_word_folders is
  '학생별 "내 단어장" 폴더. is_default=true 인 행이 "오답 노트"(시험에서 틀린 단어 자동 저장처).
  학생마다 하나만 있어야 하며 ensure_default_vocab_folder()가 최초 접근 시 만든다.';

alter table vocab_word_folders enable row level security;
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on vocab_word_folders for select
  using (student_id = auth.uid() or teaches_student(student_id) or is_guardian_of(student_id) or is_admin());
create policy "본인 학생 쓰기" on vocab_word_folders for all
  using (student_id = auth.uid() or is_admin()) with check (student_id = auth.uid() or is_admin());

alter table vocab_words add column if not exists folder_id uuid references vocab_word_folders (id) on delete set null;
create index on vocab_words (student_id, folder_id);

-- 학생의 기본 폴더("오답 노트")가 없으면 만들고, 있으면 그 id를 돌려준다. 학생 본인이 처음 단어장을
-- 열 때, 그리고 교사가 오답 자동 저장을 시도할 때 둘 다 이걸 부른다(멱등).
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
  values (p_student_id, '오답 노트', true, -1)
  on conflict (student_id, name) do update set is_default = true
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ensure_default_vocab_folder(uuid) from public, anon;
grant execute on function public.ensure_default_vocab_folder(uuid) to authenticated;

-- 교사가 공용 단어장의 단어를 학생 개인 단어장에 배정 복사한다(폴더 지정 가능 — 재정의:
-- 20261376 버전에 p_folder_id 파라미터 추가, 이미 있는 단어면 폴더만 옮긴다).
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
  insert into vocab_words (student_id, word, definition, example, example2, similar_words, antonym_words, assigned_by, folder_id)
  select p_student_id, lw.word, lw.definition_ko, lw.example1, lw.example2, lw.synonym_words, lw.antonym_words,
         case when p_student_id = auth.uid() then null else auth.uid() end, p_folder_id
  from vocab_library_words lw
  where lw.id = any(p_library_word_ids)
  on conflict (student_id, word) do update set folder_id = excluded.folder_id;
end;
$$;
revoke all on function public.assign_library_words_to_student(uuid, uuid[], uuid) from public, anon;
grant execute on function public.assign_library_words_to_student(uuid, uuid[], uuid) to authenticated;
-- 이전 4-인자(폴더 없음) 시그니처는 지운다 — 호출부를 전부 새 시그니처로 옮긴다.
drop function if exists public.assign_library_words_to_student(uuid, uuid[]);
