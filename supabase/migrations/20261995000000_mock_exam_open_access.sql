-- 모의고사 '배정' 폐지 — 공개 세트 공통 노출 + 학생이 '시작'할 때 응시 생성 (2026-10-01 오너 확정).
--
-- 1) mock_exam_open_start(set): 활성 학생 본인만, 공개·보관 아님·구성 완료 세트만, 같은 학생·세트 계열은
--    응시 하나(멱등 — 이미 있으면 그 응시 id 반환, DB 고유 인덱스 mock_exam_attempts_one_per_student_per_exam 이 최종 방어).
-- 2) mock_exam_open_catalog(student): 공개 세트 목록 + 그 학생의 응시 상태를 한 번에(N+1 없음). 학생 본인·학부모·
--    담당 교사·컨설턴트·관리자(_mock_exam_can_view) 읽기 전용.
-- 3) 교사의 응시 INSERT/UPDATE RLS 제거 — 응시 생성 경로는 이제 이 RPC 하나(교사는 보드 할 일로 지정).
--    학생 직접 INSERT 정책은 원래 없다(20261429000000 이후 학생 쓰기는 RPC 전용). 관리자 전체 정책은 유지.
-- 이미 배정돼 있던 기존 응시(status='assigned' 포함)는 그대로 유효하다.

create or replace function public.mock_exam_open_start(p_exam_set_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_s mock_exam_sets%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (select 1 from students where id = v_uid and status = 'active') then
    raise exception '활성 학생만 모의고사를 시작할 수 있습니다.';
  end if;
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception '존재하지 않는 시험입니다.'; end if;

  -- 멱등: 이 시험(세트 계열)의 응시가 이미 있으면(기존 배정분 포함) 그대로 돌려준다.
  select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  if v_id is not null then return v_id; end if;

  if v_s.status <> 'published' or v_s.archived_at is not null then
    raise exception '공개된 시험만 시작할 수 있습니다.';
  end if;
  if v_s.format = 'mst' and v_s.readiness_status <> 'ready' then
    raise exception '이 시험의 문항 구성이 완료되지 않아 시작할 수 없습니다. 관리자에게 문의해 주세요.';
  end if;

  insert into mock_exam_attempts (student_id, exam_set_id, exam_set_group_id)
  values (v_uid, v_s.id, v_s.set_group_id)
  on conflict (student_id, exam_set_group_id) do nothing
  returning id into v_id;
  if v_id is null then
    -- 동시 시작 경쟁에서 진 쪽: 먼저 들어간 응시를 돌려준다.
    select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  end if;
  return v_id;
end $$;
revoke execute on function public.mock_exam_open_start(uuid) from public, anon;
grant execute on function public.mock_exam_open_start(uuid) to authenticated, service_role;

create or replace function public.mock_exam_open_catalog(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception '이 학생의 모의고사 정보를 볼 권한이 없습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'examSetId', s.id, 'setGroupId', s.set_group_id, 'name', s.name, 'description', s.description,
      'difficultyTier', s.difficulty_tier, 'format', s.format, 'publishedAt', s.published_at,
      'attemptId', a.id, 'attemptStatus', a.status
    ) order by s.published_at desc nulls last, s.name)
    from mock_exam_sets s
    left join mock_exam_attempts a on a.exam_set_group_id = s.set_group_id and a.student_id = p_student_id
    where s.status = 'published' and s.archived_at is null
      and (s.format <> 'mst' or s.readiness_status = 'ready')
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_open_catalog(uuid) from public, anon;
grant execute on function public.mock_exam_open_catalog(uuid) to authenticated, service_role;

drop policy if exists "응시 기록 담당 교사 배정" on mock_exam_attempts;
drop policy if exists "응시 기록 담당 교사 배정 갱신" on mock_exam_attempts;
