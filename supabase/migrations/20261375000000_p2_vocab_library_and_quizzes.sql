-- 2026-09-15 제품 오너 — 단어장 재구성 1차: 내 단어장 확장(반의어·예문 2개), College Board 권별
-- 공용 단어장(스키마 + 표본만, 실제 5,000단어 채우기는 범위 밖), 시험 만들기·채점·이력.
-- docs/2026-09-15-vocab-library-plan.md 참고.

alter table vocab_words add column if not exists antonym_words text[];
alter table vocab_words add column if not exists example2 text;
comment on column vocab_words.antonym_words is '2026-09-15: 반의어(최대 2개 권장, 강제하지 않음).';
comment on column vocab_words.example2 is '2026-09-15: 두 번째 예문(기존 example 이 첫 번째).';

-- 공용 단어장(College Board 1~10권) — 학생별이 아니라 전체 공용. 관리자만 쓴다.
create table vocab_library_books (
  id uuid primary key default gen_random_uuid(),
  volume_no int not null check (volume_no between 1 and 10),
  title text not null,
  created_at timestamptz not null default now(),
  unique (volume_no)
);

create table vocab_library_words (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references vocab_library_books (id) on delete cascade,
  word text not null,
  definition_ko text,
  synonym_words text[],
  antonym_words text[],
  example1 text,
  example2 text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (book_id, word)
);
create index on vocab_library_words (book_id, position);

alter table vocab_library_books enable row level security;
alter table vocab_library_words enable row level security;
-- 로그인한 누구나 읽는다(학생·교사·보호자 전부 볼 수 있는 공용 자료). 쓰기는 서버 액션(service_role)만.
create policy "로그인 사용자 전체 조회" on vocab_library_books for select using (auth.uid() is not null);
create policy "로그인 사용자 전체 조회" on vocab_library_words for select using (auth.uid() is not null);

-- 단어 시험 — 문항을 jsonb 로 통째 저장한다(정규화된 문항 테이블을 만들 만큼 분석 요구가 아직 없다).
create table vocab_quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id),
  -- legacy_sessions 와 sessions(v3) 둘 중 하나를 가리킬 수 있어 단일 FK를 걸지 않는다(assign_vocab_quiz 가 둘 다 확인).
  session_id uuid,
  source jsonb not null,
  items jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  score int,
  total int,
  answers jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on vocab_quizzes (owner_id, created_at desc);
comment on column vocab_quizzes.source is '{customWords: boolean, bookIds: uuid[]} — 어느 단어장에서 뽑았는지.';
comment on column vocab_quizzes.items is '[{word, definitionShown, options:[4], correctIndex}] — 응시 중 정답 노출 안 되게 클라이언트에서 가린다.';
comment on column vocab_quizzes.session_id is '교사가 수업 중 만들었으면 그 수업. 학생이 스스로 만들었으면 null.';

alter table vocab_quizzes enable row level security;
create policy "본인 시험 조회" on vocab_quizzes for select using (owner_id = auth.uid() or created_by = auth.uid());
create policy "본인 시험 생성" on vocab_quizzes for insert with check (created_by = auth.uid() and owner_id = auth.uid());
create policy "본인 시험 응시 기록" on vocab_quizzes for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- 교사가 수업 중인 학생에게 시험을 낸다 — 본인이 담당하는 학생인지 서버에서 확인한다(RLS insert 정책은
-- created_by=owner_id 만 허용하므로 교사→학생 배정은 이 SECURITY DEFINER 함수로만 가능하다).
create or replace function public.assign_vocab_quiz(
  p_session_id uuid, p_owner_id uuid, p_source jsonb, p_items jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_ok boolean;
begin
  select exists (
    select 1 from legacy_sessions s
    join enrollments e on e.id = s.enrollment_id
    where s.id = p_session_id and e.teacher_id = auth.uid() and e.student_id = p_owner_id
  ) or exists (
    select 1 from sessions s
    join subject_enrollments se on se.id = s.subject_enrollment_id
    join teacher_assignments ta on ta.subject_enrollment_id = se.id and ta.status = 'active'
    where s.id = p_session_id and ta.teacher_id = auth.uid() and se.child_id = p_owner_id
  ) into v_ok;
  if not coalesce(v_ok, false) then
    raise exception '담당하는 학생의 수업에만 단어 시험을 낼 수 있습니다.';
  end if;
  insert into vocab_quizzes (owner_id, created_by, session_id, source, items, status)
  values (p_owner_id, auth.uid(), p_session_id, p_source, p_items, 'pending')
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.assign_vocab_quiz(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.assign_vocab_quiz(uuid, uuid, jsonb, jsonb) to authenticated;
