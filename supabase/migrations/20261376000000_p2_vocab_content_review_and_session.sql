-- 2026-09-15 제품 오너 2차 지시 — 단어장 실 데이터 채우기 인프라 + 상시 학습 자산화
-- (수업 중 연결·교사 발급 UI·오답 복습). docs/2026-09-15-vocab-round2-plan.md 참고.

alter table vocab_library_words add column if not exists difficulty smallint check (difficulty between 1 and 5);
alter table vocab_library_words add column if not exists source_note text;
comment on column vocab_library_words.difficulty is '1(쉬움)~5(어려움). 권 순서와 별개로 문항 난이도 표시에 쓴다.';
comment on column vocab_library_words.source_note is '선정 기준/출처 메모(예: "College Board 공식 단어장이라는 표기는 쓰지 않음" 정책에 따라 내부 근거만 기록).';

-- 교사가 담당 학생 개인 단어장에 배정한 단어인지 구분(학생이 스스로 추가한 것과 UI에서 다르게 표시).
alter table vocab_words add column if not exists assigned_by uuid references profiles (id);
comment on column vocab_words.assigned_by is 'null이면 학생 본인이 추가. 값이 있으면 그 교사가 배정.';
-- 교사 배정 시 같은 단어를 중복으로 넣지 않기 위한 제약(학생이 이미 같은 스펠링을 갖고 있으면 건너뛴다).
-- 유니크 인덱스를 걸기 전에 기존 중복(있었다면 UAT 테스트 데이터)을 가장 오래된 행만 남기고 정리한다.
delete from vocab_words a using vocab_words b
  where a.student_id = b.student_id and a.word = b.word and a.id > b.id;
create unique index if not exists vocab_words_student_word_uniq on vocab_words (student_id, word);

alter table vocab_quizzes add column if not exists due_at timestamptz;
comment on column vocab_quizzes.due_at is '교사가 즉석 시험 발급 시 지정하는 마감(선택). null이면 마감 없음.';

-- vocab_quizzes 조회 범위를 다른 테이블과 같은 패턴(teaches_student/is_guardian_of/is_admin)으로 확장 —
-- 처음 설계(20261375)는 owner/creator 본인만 봤는데, 보호자·같은 학생을 담당하는 다른 조회 경로도
-- 필요하다(vocab_words 등 기존 테이블과 일관성).
drop policy if exists "본인 시험 조회" on vocab_quizzes;
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on vocab_quizzes for select
  using (
    owner_id = auth.uid() or created_by = auth.uid()
    or teaches_student(owner_id) or is_guardian_of(owner_id) or is_admin()
  );

-- 오답 복습 큐 — 시험 채점 시 틀린 문항을 여기 쌓는다. 원본 단어가 나중에 바뀌거나 삭제돼도
-- 그 시점 뜻/예문을 그대로 보여주기 위해 스냅샷으로 저장한다(정규화 FK 아님).
create table vocab_review_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  word text not null,
  definition text,
  example1 text,
  example2 text,
  synonym_words text[],
  antonym_words text[],
  source_quiz_id uuid references vocab_quizzes (id) on delete set null,
  added_at timestamptz not null default now(),
  cleared_at timestamptz
);
create index on vocab_review_items (student_id, cleared_at);
-- 같은 학생의 같은 단어에 대해 "열린"(아직 안 지워진) 복습 항목은 하나만 — 반복 오답이면 added_at만 안 바뀌고 중복 행이 쌓이지 않는다.
create unique index vocab_review_items_open_word_uniq on vocab_review_items (student_id, word) where cleared_at is null;

alter table vocab_review_items enable row level security;
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on vocab_review_items for select
  using (student_id = auth.uid() or teaches_student(student_id) or is_guardian_of(student_id) or is_admin());
create policy "본인 학생 쓰기" on vocab_review_items for all
  using (student_id = auth.uid() or is_admin()) with check (student_id = auth.uid() or is_admin());

-- 수업 화면에 "이 수업에서 참고·배정한 단어"만 연결(단어장 전체를 복제하지 않는다).
create table vocab_session_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  student_id uuid not null references profiles (id) on delete cascade,
  library_word_id uuid references vocab_library_words (id) on delete cascade,
  custom_word_id uuid references vocab_words (id) on delete cascade,
  linked_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  constraint vocab_session_links_one_source check (
    (library_word_id is not null)::int + (custom_word_id is not null)::int = 1
  )
);
create index on vocab_session_links (session_id, student_id);
create unique index vocab_session_links_uniq_library on vocab_session_links (session_id, student_id, library_word_id) where library_word_id is not null;
create unique index vocab_session_links_uniq_custom on vocab_session_links (session_id, student_id, custom_word_id) where custom_word_id is not null;

alter table vocab_session_links enable row level security;
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on vocab_session_links for select
  using (student_id = auth.uid() or teaches_student(student_id) or is_guardian_of(student_id) or is_admin());
create policy "담당 선생님/관리자 연결" on vocab_session_links for insert
  with check (linked_by = auth.uid() and (teaches_student(student_id) or is_admin()));
create policy "담당 선생님/관리자 연결 해제" on vocab_session_links for delete
  using (teaches_student(student_id) or is_admin());

-- assign_vocab_quiz 재정의 — 기존 20261375 버전은 legacy_sessions/sessions 조인을 직접 풀어썼는데,
-- 이제 같은 일을 하는 teaches_student() 헬퍼(2026-09-13 v3 가시성 수정판, legacy+v3 둘 다 인지)가
-- 있으니 그걸 재사용해 로직을 하나로 합치고, due_at 파라미터를 추가한다. 파라미터가 늘어난 새
-- 시그니처라 이전 4-인자 버전은 지운다.
drop function if exists public.assign_vocab_quiz(uuid, uuid, jsonb, jsonb);

create or replace function public.assign_vocab_quiz(
  p_session_id uuid, p_owner_id uuid, p_source jsonb, p_items jsonb, p_due_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not (teaches_student(p_owner_id) or is_admin()) then
    raise exception '담당하는 학생의 수업에만 단어 시험을 낼 수 있습니다.';
  end if;
  insert into vocab_quizzes (owner_id, created_by, session_id, source, items, status, due_at)
  values (p_owner_id, auth.uid(), p_session_id, p_source, p_items, 'pending', p_due_at)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.assign_vocab_quiz(uuid, uuid, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.assign_vocab_quiz(uuid, uuid, jsonb, jsonb, timestamptz) to authenticated;

-- 교사가 수업 중(또는 교사 포털에서) 학생에게 보여줄 단어를 그 세션에 연결한다.
create or replace function public.link_vocab_words_to_session(
  p_session_id uuid, p_student_id uuid, p_library_word_ids uuid[], p_custom_word_ids uuid[]
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (teaches_student(p_student_id) or is_admin()) then
    raise exception '담당하는 학생에게만 단어를 연결할 수 있습니다.';
  end if;
  insert into vocab_session_links (session_id, student_id, library_word_id, linked_by)
  select p_session_id, p_student_id, w, auth.uid()
  from unnest(coalesce(p_library_word_ids, '{}')) as w
  on conflict (session_id, student_id, library_word_id) where library_word_id is not null do nothing;

  insert into vocab_session_links (session_id, student_id, custom_word_id, linked_by)
  select p_session_id, p_student_id, w, auth.uid()
  from unnest(coalesce(p_custom_word_ids, '{}')) as w
  on conflict (session_id, student_id, custom_word_id) where custom_word_id is not null do nothing;
end; $$;
revoke execute on function public.link_vocab_words_to_session(uuid, uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.link_vocab_words_to_session(uuid, uuid, uuid[], uuid[]) to authenticated;

-- 교사가 공용 단어장의 단어를 학생 개인 단어장("내 단어장")에 배정 복사한다(원본 공용 단어는 그대로,
-- 학생 것은 이후 독립적으로 존재 — 공용 원본이 나중에 바뀌어도 학생이 이미 받은 건 안 바뀐다).
create or replace function public.assign_library_words_to_student(
  p_student_id uuid, p_library_word_ids uuid[]
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (teaches_student(p_student_id) or is_admin()) then
    raise exception '담당하는 학생에게만 단어를 배정할 수 있습니다.';
  end if;
  insert into vocab_words (student_id, word, definition, example, example2, similar_words, antonym_words, assigned_by)
  select p_student_id, lw.word, lw.definition_ko, lw.example1, lw.example2, lw.synonym_words, lw.antonym_words, auth.uid()
  from vocab_library_words lw
  where lw.id = any(p_library_word_ids)
  on conflict do nothing;
end; $$;
revoke execute on function public.assign_library_words_to_student(uuid, uuid[]) from public, anon;
grant execute on function public.assign_library_words_to_student(uuid, uuid[]) to authenticated;
