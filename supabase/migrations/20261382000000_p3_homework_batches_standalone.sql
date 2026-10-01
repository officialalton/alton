-- 2026-09-16 제품 오너 정정(2차) — 과제를 특정 수업(세션)과 아예 연동하지 않는다. 교사가 발급할
-- 때마다 발급 날짜로 이름 붙는 새 배치가 생기고, 교사↔학생 쌍으로만 저장·노출된다(다른 교사·다른
-- 학생에게 노출되지 않음). 단어장의 즉석 시험 발급과 같은 구조 — session_homework_items/
-- session_problem_work(세션에 강하게 결합됨, sessions 테이블 재사용은 캘린더·Meet 동기화·수업
-- 목록에 새는 부작용이 있어 배제)를 재사용하지 않고, 문항 스냅샷을 담은 독립 테이블로 새로 만든다.
-- 20261379/20261381의 세션 결합 과제 발급 RPC는 이 라운드로 대체되어 더 쓰지 않는다(호출부 없음).

create table homework_batches (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id),
  student_id uuid not null references profiles (id) on delete cascade,
  label text not null,
  items jsonb not null,
  created_at timestamptz not null default now()
);
create index on homework_batches (student_id, created_at desc);
create index on homework_batches (teacher_id, created_at desc);
comment on table homework_batches is
  '수업(세션)과 무관하게 교사가 학생에게 직접 낸 과제 배치. 발급할 때마다 새 배치(라벨은 발급 날짜
  기준, 예: "9월 16일 과제"). items 는 발급 시점에 고정한 문항 스냅샷 배열 —
  [{problemId, position, format, passage, question, options, correctIndex, answers, explanation,
  statements, figure, response, submittedAt, autoCorrect, graded, gradedAt, grade, gradeComment}].
  이 교사·이 학생 쌍 밖에는 절대 보이지 않는다(다른 교사·다른 학생 노출 금지).';

alter table homework_batches enable row level security;
-- 발급한 교사 본인과 학생 본인만 본다(다른 교사가 같은 학생을 담당해도 안 보인다 — 배치는
-- "이 교사가 이 학생에게 낸 것"이지 "이 학생의 담당 교사 전체"의 것이 아니다). 보호자·관리자는 읽기만.
create policy "발급 교사/학생 본인/보호자/관리자 조회" on homework_batches for select
  using (teacher_id = auth.uid() or student_id = auth.uid() or is_guardian_of(student_id) or is_admin());
create policy "발급한 교사만 생성" on homework_batches for insert
  with check (teacher_id = auth.uid() and (teaches_student(student_id) or is_admin()));
-- 수정(응답 저장·채점)은 발급 교사 또는 학생 본인만 — 서버 액션이 필드별 권한(학생은 response만,
-- 교사는 grade만)을 다시 나눠 강제한다. RLS는 "이 배치의 당사자만" 범위를 잡는다.
create policy "발급 교사/학생 본인 수정" on homework_batches for update
  using (teacher_id = auth.uid() or student_id = auth.uid())
  with check (teacher_id = auth.uid() or student_id = auth.uid());

-- 학생별로 이미 낸 적 있는 문제는 다시 뽑지 않는다(20261379의 같은 원칙) — items 배열을 훑어야 하므로
-- 함수로 감싼다.
create or replace function public.student_already_has_homework_problem(p_student_id uuid, p_problem_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from homework_batches hb, jsonb_array_elements(hb.items) it
    where hb.student_id = p_student_id and (it->>'problemId')::uuid = p_problem_id
  );
$$;

-- 키워드별 개수로 문제은행에서 무작위로 뽑아 학생에게 즉시 발급한다(세션 무관). 라벨은 호출부(서버
-- 액션)가 발급 날짜 기준으로 만들어 넘긴다.
create or replace function public.issue_homework_batch_v2(
  p_student_id uuid, p_label text, p_requests jsonb
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_req jsonb; v_keyword uuid; v_count int; v_ids uuid[] := array[]::uuid[]; v_picked uuid[];
  v_pid uuid; v_problem problems%rowtype; v_version problem_versions%rowtype;
  v_items jsonb := '[]'::jsonb; v_pos int := 0; v_batch_id uuid;
begin
  if not (teaches_student(p_student_id) or is_admin()) then
    raise exception '담당하는 학생에게만 과제를 낼 수 있습니다.';
  end if;
  if p_requests is null or jsonb_typeof(p_requests) <> 'array' then
    raise exception '키워드별 개수 목록이 필요합니다.';
  end if;

  for v_req in select * from jsonb_array_elements(p_requests) loop
    v_keyword := (v_req->>'keyword_id')::uuid;
    v_count := coalesce((v_req->>'count')::int, 0);
    if v_count <= 0 then
      continue;
    end if;
    select coalesce(array_agg(problem_id), array[]::uuid[]) into v_picked
    from (
      select c.problem_id
      from problem_auto_composition_candidates c
      where c.keyword_id = v_keyword
        and c.problem_id <> all (v_ids)
        and not student_already_has_homework_problem(p_student_id, c.problem_id)
      group by c.problem_id
      order by random()
      limit v_count
    ) s;
    v_ids := v_ids || v_picked;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception '고를 수 있는 문제가 없습니다.';
  end if;

  foreach v_pid in array v_ids loop
    select * into v_problem from problems where id = v_pid;
    if v_problem.id is null or v_problem.archived_at is not null or v_problem.status::text <> 'confirmed' or v_problem.published_version_id is null then
      continue;
    end if;
    select * into v_version from problem_versions where id = v_problem.published_version_id;
    v_pos := v_pos + 1;
    v_items := v_items || jsonb_build_object(
      'problemId', v_pid, 'position', v_pos, 'format', v_problem.format,
      'passage', v_version.passage, 'question', v_version.question, 'options', v_version.options,
      'correctIndex', v_version.correct_index, 'answers', v_version.answers, 'explanation', v_version.explanation,
      'statements', v_version.statements, 'figure', v_version.figure,
      'response', null, 'submittedAt', null, 'autoCorrect', null, 'graded', false, 'gradedAt', null, 'grade', null, 'gradeComment', null
    );
  end loop;

  if jsonb_array_length(v_items) = 0 then
    raise exception '고를 수 있는 문제가 없습니다.';
  end if;

  insert into homework_batches (teacher_id, student_id, label, items)
  values (auth.uid(), p_student_id, p_label, v_items)
  returning id into v_batch_id;
  return v_batch_id;
end;
$$;
revoke all on function public.issue_homework_batch_v2(uuid, text, jsonb) from public, anon;
grant execute on function public.issue_homework_batch_v2(uuid, text, jsonb) to authenticated;
