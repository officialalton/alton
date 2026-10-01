-- 2026-09-09(UAT 지적, 제품 오너 승인) — 과목 삭제 정책: 실사용 참조가 있는
-- 과목은 하드 삭제하지 않고 보관(archive) 처리한다.
--
-- 정책:
--  * 참조가 전혀 없는 과목만 하드 삭제 허용(subject_template_units/subject_keywords는
--    cascade라 함께 삭제돼도 안전 — 애초에 실사용 이력이 아님).
--  * teacher_curriculum_templates/enrollments/subject_enrollments/curriculum_docs/
--    problems/trial_sessions/proposal_subjects 중 하나라도 참조가 있으면 하드
--    삭제하지 않고 archived_at/archived_reason만 세팅한다 — 이름·FK는 그대로
--    유지되므로 기존 계약·수강·교재·세션 이력은 전혀 영향받지 않는다.
--    (contract_version_subjects는 20260913000000_r3_contract_model_realignment.sql에서
--    이미 drop되고 proposal_subjects로 대체된 테이블이라 대상에서 제외한다.)
--  * 보관된 과목은 신규 배정·템플릿 선택·교재 연결 후보에서 제외한다(앱
--    레벨에서 archived_at is null로 필터 — 이 마이그레이션은 컬럼과 조회용
--    RPC만 추가한다).

alter table subjects add column archived_at timestamptz;
alter table subjects add column archived_reason text;

comment on column subjects.archived_at is
  '2026-09-09: 실사용 참조가 있어 하드 삭제할 수 없는 과목을 표시. null이면 활성. 신규 배정·템플릿 선택·교재 연결 후보에서 제외 대상.';
comment on column subjects.archived_reason is
  '2026-09-09: 관리자에게 보여줄 보관 사유(어떤 이력이 몇 건 있어 보관됐는지) — attempt_delete_or_archive_subject()가 채운다.';

-- attempt_delete_or_archive_subject() — 참조 카운트를 직접 세어(정확한 사유
-- 문구를 만들기 위해 raw FK 위반을 먼저 유도하지 않는다), 전부 0이면 하드
-- 삭제, 하나라도 있으면 archived_at/reason만 세팅한다.
-- 반환값: archived(boolean), reason(text, 삭제 시 null).
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
  v_reasons text[] := array[]::text[];
begin
  if not is_admin() then
    raise exception '관리자만 과목을 삭제·보관 처리할 수 있습니다.';
  end if;

  if not exists (select 1 from subjects where id = p_subject_id) then
    raise exception '존재하지 않는 과목입니다.';
  end if;

  select count(*) into v_enrollments_count from enrollments where subject_id = p_subject_id;
  select count(*) into v_subject_enrollments_count from subject_enrollments where subject_id = p_subject_id;
  select count(*) into v_templates_count from teacher_curriculum_templates where subject_id = p_subject_id;
  select count(*) into v_docs_count from curriculum_docs where subject_id = p_subject_id;
  select count(*) into v_problems_count from problems where subject_id = p_subject_id;
  select count(*) into v_trial_sessions_count from trial_sessions where subject_id = p_subject_id;
  select count(*) into v_proposal_subjects_count from proposal_subjects where subject_id = p_subject_id;

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
  '2026-09-09: 과목 삭제 요청 처리 — 실사용 참조가 전혀 없으면 하드 삭제, 하나라도 있으면 archived_at/reason만 세팅(보관). 함수 내부 is_admin() 체크로 관리자만 허용(app/admin/subject-actions.ts::deleteSubject()).';
