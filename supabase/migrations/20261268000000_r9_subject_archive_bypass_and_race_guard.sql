-- 2026-09-09(UAT 지적, 제품 오너 승인) — 과목 보관 정책 보완:
--  1) UI 필터(selectableSubjects())는 앱 레벨 편의일 뿐 실제 방어선이 아니다.
--     보관된 과목을 참조하는 새 행(신규 수강, 새 과목 템플릿, 새 교재/문제)이
--     어느 경로로 들어와도 DB가 직접 거부하도록 트리거를 추가한다.
--  2) attempt_delete_or_archive_subject()가 "참조 0건" 판정과 실제 DELETE
--     사이에서 동시에 새 참조가 생기는 경쟁을 만나면, 원시 FK 위반 에러를
--     그대로 던지지 않고 보관 처리로 안전하게 전환한다. 동시 호출 자체는
--     대상 과목 행을 잠가 직렬화한다.

create or replace function public.reject_archived_subject_reference()
returns trigger
language plpgsql as $$
declare
  v_archived_at timestamptz;
begin
  select archived_at into v_archived_at from subjects where id = new.subject_id;
  if v_archived_at is not null then
    raise exception '보관된 과목에는 새로 연결할 수 없습니다(과목 id: %).', new.subject_id;
  end if;
  return new;
end;
$$;

comment on function public.reject_archived_subject_reference() is
  '2026-09-09: 보관(archived) 처리된 과목을 참조하는 새 행 생성을 막는다 — UI 필터(selectableSubjects())를 우회해도 DB가 직접 거부.';

create trigger subject_enrollments_reject_archived_subject
  before insert on subject_enrollments
  for each row execute function public.reject_archived_subject_reference();

create trigger enrollments_reject_archived_subject
  before insert on enrollments
  for each row execute function public.reject_archived_subject_reference();

create trigger curriculum_docs_reject_archived_subject
  before insert on curriculum_docs
  for each row execute function public.reject_archived_subject_reference();

create trigger problems_reject_archived_subject
  before insert on problems
  for each row execute function public.reject_archived_subject_reference();

create trigger teacher_curriculum_templates_reject_archived_subject
  before insert on teacher_curriculum_templates
  for each row execute function public.reject_archived_subject_reference();

-- attempt_delete_or_archive_subject() 재정의 — for update로 동시 호출을
-- 직렬화하고, 카운트 확인 이후 실제 DELETE 시점에 새로 생긴 참조와 부딪혀
-- foreign_key_violation이 나면 원시 에러를 던지는 대신 그 시점 기준으로 다시
-- 세어 보관 처리로 넘어간다.
create or replace function public.attempt_delete_or_archive_subject(p_subject_id uuid)
returns table (archived boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  v_enrollments_count int;
  v_subject_enrollments_count int;
  v_templates_count int;
  v_docs_count int;
  v_problems_count int;
  v_trial_sessions_count int;
  v_proposal_subjects_count int;
  v_reasons text[];
begin
  if not is_admin() then
    raise exception '관리자만 과목을 삭제·보관 처리할 수 있습니다.';
  end if;

  -- 동시에 여러 삭제/보관 요청이 같은 과목에 들어와도 하나씩 순서대로
  -- 처리되도록 과목 행을 잠근다(존재하지 않으면 여기서 바로 예외).
  if not exists (select 1 from subjects where id = p_subject_id for update) then
    raise exception '존재하지 않는 과목입니다.';
  end if;

  <<recount>>
  declare
    v_should_archive boolean;
  begin
    select count(*) into v_enrollments_count from enrollments where subject_id = p_subject_id;
    select count(*) into v_subject_enrollments_count from subject_enrollments where subject_id = p_subject_id;
    select count(*) into v_templates_count from teacher_curriculum_templates where subject_id = p_subject_id;
    select count(*) into v_docs_count from curriculum_docs where subject_id = p_subject_id;
    select count(*) into v_problems_count from problems where subject_id = p_subject_id;
    select count(*) into v_trial_sessions_count from trial_sessions where subject_id = p_subject_id;
    select count(*) into v_proposal_subjects_count from proposal_subjects where subject_id = p_subject_id;

    v_reasons := array[]::text[];
    if v_enrollments_count > 0 then
      v_reasons := v_reasons || format('레거시 수강 이력 %s건', v_enrollments_count);
    end if;
    if v_subject_enrollments_count > 0 then
      v_reasons := v_reasons || format('학생 수강 이력 %s건', v_subject_enrollments_count);
    end if;
    if v_templates_count > 0 then
      v_reasons := v_reasons || format('선생님 커리큘럼 템플릿 %s건', v_templates_count);
    end if;
    if v_docs_count > 0 then
      v_reasons := v_reasons || format('교재 문서 %s건', v_docs_count);
    end if;
    if v_problems_count > 0 then
      v_reasons := v_reasons || format('문제 %s건', v_problems_count);
    end if;
    if v_trial_sessions_count > 0 then
      v_reasons := v_reasons || format('체험 수업 이력 %s건', v_trial_sessions_count);
    end if;
    if v_proposal_subjects_count > 0 then
      v_reasons := v_reasons || format('제안서 %s건', v_proposal_subjects_count);
    end if;

    v_should_archive := array_length(v_reasons, 1) is not null;

    if not v_should_archive then
      begin
        delete from subjects where id = p_subject_id;
        return query select false, null::text;
        return;
      exception when foreign_key_violation then
        -- 카운트 확인 직후, DELETE가 실제로 실행되는 그 짧은 틈에 다른
        -- 트랜잭션이 새 참조를 커밋했다(예: 신규 수강 배정) — 원시 FK
        -- 에러를 그대로 올리지 않고 다시 세어서 보관 처리로 전환한다.
      end;
    end if;
  end recount;

  select count(*) into v_enrollments_count from enrollments where subject_id = p_subject_id;
  select count(*) into v_subject_enrollments_count from subject_enrollments where subject_id = p_subject_id;
  select count(*) into v_templates_count from teacher_curriculum_templates where subject_id = p_subject_id;
  select count(*) into v_docs_count from curriculum_docs where subject_id = p_subject_id;
  select count(*) into v_problems_count from problems where subject_id = p_subject_id;
  select count(*) into v_trial_sessions_count from trial_sessions where subject_id = p_subject_id;
  select count(*) into v_proposal_subjects_count from proposal_subjects where subject_id = p_subject_id;

  v_reasons := array[]::text[];
  if v_enrollments_count > 0 then
    v_reasons := v_reasons || format('레거시 수강 이력 %s건', v_enrollments_count);
  end if;
  if v_subject_enrollments_count > 0 then
    v_reasons := v_reasons || format('학생 수강 이력 %s건', v_subject_enrollments_count);
  end if;
  if v_templates_count > 0 then
    v_reasons := v_reasons || format('선생님 커리큘럼 템플릿 %s건', v_templates_count);
  end if;
  if v_docs_count > 0 then
    v_reasons := v_reasons || format('교재 문서 %s건', v_docs_count);
  end if;
  if v_problems_count > 0 then
    v_reasons := v_reasons || format('문제 %s건', v_problems_count);
  end if;
  if v_trial_sessions_count > 0 then
    v_reasons := v_reasons || format('체험 수업 이력 %s건', v_trial_sessions_count);
  end if;
  if v_proposal_subjects_count > 0 then
    v_reasons := v_reasons || format('제안서 %s건', v_proposal_subjects_count);
  end if;

  if array_length(v_reasons, 1) is null then
    -- 재확인해도 여전히 참조가 없다(드문 경우: 동시 트랜잭션이 롤백됨) —
    -- 원래 계획대로 하드 삭제를 다시 시도한다.
    delete from subjects where id = p_subject_id;
    return query select false, null::text;
    return;
  end if;

  update subjects
  set archived_at = now(),
      archived_reason = array_to_string(v_reasons, ', ') || '이(가) 있어 보관 처리되었습니다.'
  where id = p_subject_id;

  return query select true, (select archived_reason from subjects where id = p_subject_id);
end;
$$;

revoke execute on function public.attempt_delete_or_archive_subject(uuid) from public;
grant execute on function public.attempt_delete_or_archive_subject(uuid) to authenticated;

comment on function public.attempt_delete_or_archive_subject(uuid) is
  '2026-09-09(보완): 과목 삭제 요청 처리 — 참조 0건이면 하드 삭제, 있으면 보관.
   대상 과목 행을 잠가 동시 호출을 직렬화하고, 카운트 확인 후 DELETE 시점에
   새로 생긴 참조와 경쟁해도 원시 FK 에러 대신 재확인 후 보관으로 안전하게
   전환한다.';
