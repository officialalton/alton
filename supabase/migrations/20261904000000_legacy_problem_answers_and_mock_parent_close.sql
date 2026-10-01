-- 정답·해설은 교사 채점(또는 응시 완료) 뒤에만 학생·학부모에게 — 2026-09-29 포털 점검 #9 잔여·#10
--
-- (1) 레거시 problems.correct_index / problems.explanation
--     정책 "본인에게 과제로 배정된 문제는 학생도 조회"·"문제 조회"가 행을 열면 학생이 REST 로 두 컬럼을
--     직접 읽을 수 있었다(problem_versions 는 20261903000000 에서 막았다). 교사·학생이 같은 authenticated
--     역할이라 행 정책으로는 컬럼만 숨길 수 없어, **컬럼 단위 SELECT 를 회수**한다:
--     anon·authenticated 는 두 컬럼 외의 모든 컬럼만 읽는다. 정답·해설이 필요한 서버 코드(학생 시도 채점,
--     교재 로더, 관리자 교재 편집)는 서버 전용 admin 클라이언트로 읽는다(lib/legacy-problem-answers.ts).
--     INSERT/UPDATE 권한은 그대로(작성자 RLS 로 제한) — 회수하는 것은 읽기뿐이다.
--     주의: 이 테이블에 새 컬럼을 더하면 authenticated 에 컬럼 SELECT 를 따로 grant 해야 한다.
-- (2) mock_exam_answers "답안 보호자 조회" — 진행 중 응시의 문항별 correct 가 학부모에게 보였다.
--     채점 확정(graded)된 응시의 답안만 열도록 좁힌다(앱의 _mock_exam_results_visible 규칙과 동일).
--
-- additive: 데이터 변경 없음.
-- 되돌리기: (1) grant select on public.problems to anon, authenticated;
--           (2) 정책을 status 조건 없이 다시 만든다(20261xxx 의 "답안 보호자 조회" 정의).

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'problems'
     and column_name not in ('correct_index', 'explanation');
  execute 'revoke select on public.problems from anon, authenticated';
  execute format('grant select (%s) on public.problems to anon, authenticated', cols);
end $$;

comment on column public.problems.correct_index is
  '2026-09-29: anon·authenticated SELECT 회수. 서버 admin 클라이언트(lib/legacy-problem-answers.ts)로만 읽는다.';
comment on column public.problems.explanation is
  '2026-09-29: anon·authenticated SELECT 회수. 서버 admin 클라이언트(lib/legacy-problem-answers.ts)로만 읽는다.';

drop policy if exists "답안 보호자 조회" on mock_exam_answers;
create policy "답안 보호자 조회" on mock_exam_answers for select
  using (
    exists (
      select 1 from mock_exam_attempts a
      where a.id = mock_exam_answers.attempt_id
        and a.status = 'graded'
        and is_guardian_of(a.student_id)
    )
  );

comment on policy "답안 보호자 조회" on mock_exam_answers is
  '2026-09-29: 채점 확정(graded)된 응시의 답안만. 진행 중·제출 대기 응시의 문항별 정오는 보호자에게 숨긴다.';

-- 컬럼 권한 회수 뒤에도 트리거(호출자 권한)가 깨지지 않게: problems 를 select *(%rowtype)으로 읽던
-- 함수는 필요한 컬럼만 읽게 바꾼다(정답·해설 컬럼을 건드리지 않음). 나머지 본문은 기존과 동일.
CREATE OR REPLACE FUNCTION public.check_prepared_content_item_selectable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_unit_selection_id uuid;
  v_ok boolean;
  v_reason text;
  v_problem_id uuid;
  v_problem_archived_at timestamptz;
  v_problem_status text;
begin
  perform public.check_prepared_selection_not_pinned(new.prepared_selection_id);

  select prepared_selection_id into v_unit_selection_id
  from session_prepared_selection_units
  where id = new.prepared_selection_unit_id;

  if v_unit_selection_id is null then
    raise exception '존재하지 않는 준비된 선택 단원입니다: %', new.prepared_selection_unit_id;
  end if;

  if v_unit_selection_id <> new.prepared_selection_id then
    raise exception '이 단원은 다른 준비된 선택에 속해 있어 출처로 지목할 수 없습니다: %', new.prepared_selection_unit_id;
  end if;

  if new.content_type = 'material_doc' then
    select exists (
      select 1 from curriculum_docs d
      where d.id = new.content_id and d.status = 'published' and d.archived_at is null
    ) into v_ok;
    if not v_ok then v_reason := '교재가 공개돼 있지 않거나 보관됐습니다'; end if;

  elsif new.content_type = 'material_section' then
    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
    if not v_ok then v_reason := '교재가 공개돼 있지 않거나 이 회차의 키워드 범위 밖입니다'; end if;

  elsif new.content_type = 'problem' then
    select id, archived_at, status::text into v_problem_id, v_problem_archived_at, v_problem_status
      from problems where id = new.content_id;

    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join problem_keywords_selectable sel
        on sel.problem_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;

    if not v_ok then
      v_reason := case
        when v_problem_id is null then '문제를 찾을 수 없습니다'
        when v_problem_archived_at is not null then '보관된 문제입니다'
        when v_problem_status <> 'confirmed' then '아직 공개되지 않은 문제입니다'
        else '이 회차의 키워드 범위 밖입니다'
      end;
    end if;

  else
    raise exception '알 수 없는 콘텐츠 유형입니다: %', new.content_type;
  end if;

  if not v_ok then
    raise exception '선택 가능(published/confirmed)하지 않거나 이 단원의 키워드 범위 밖인 콘텐츠는 담을 수 없습니다: % % (%)',
      new.content_type, new.content_id, v_reason;
  end if;

  return new;
end;
$function$;
