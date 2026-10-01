-- 오류 확정 → '오류 아님' 번복 시 문항 복귀·대체 문항 필요 기록 닫기 (2026-09-30, Preview UAT 결함).
--  - 이전 오류 확정 때문에 보관된 문항(archived_reason '문제 오류 신고 확정(…)')만 보관 해제. 관리자가 따로 보관한 문항은 건드리지 않는다.
--  - 열린 problem_replacement_needs 는 status 'cancelled'(resolution 'verdict_reverted')로 닫는다. linked(자동 교체 완료)는 이력 그대로, 세트 교체는 되돌리지 않는다.
--  - 취소 행은 부분 유니크에서 빠져, 이후 재확정 시 대체 필요 기록을 다시 쌓을 수 있다.
-- 되돌리기: 이 함수를 20261970000000 본문으로 새 번호 마이그레이션에서 재적용.
alter table problem_replacement_needs
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_verdict_id uuid references problem_error_verdicts (id);
alter table problem_replacement_needs drop constraint if exists problem_replacement_needs_status_check;
alter table problem_replacement_needs add constraint problem_replacement_needs_status_check check (status in ('open', 'linked', 'cancelled'));
alter table problem_replacement_needs drop constraint if exists problem_replacement_needs_resolution_check;
alter table problem_replacement_needs add constraint problem_replacement_needs_resolution_check check (resolution in ('auto_replaced', 'verdict_reverted'));
drop index if exists problem_replacement_needs_slot_uq;
create unique index problem_replacement_needs_slot_uq on problem_replacement_needs (problem_id, coalesce(set_item_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status <> 'cancelled';

create or replace function public.problem_error_apply_verdict(
  p_problem_id uuid,
  p_version_id uuid,
  p_decision text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prob problems%rowtype;
  v_last problem_error_verdicts%rowtype;
  v_id uuid;
  v_affecting boolean;
  v_confirmed boolean;
  v_mock int := 0;
  v_work int := 0;
  v_hw int := 0;
  v_resolved int;
  v_needs int := 0;
  v_need uuid;
  v_res text;
  v_replaced int := 0;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_restored boolean := false;
  v_cancelled int := 0;
  v_kept_sets int := 0;
begin
  if v_uid is null or not is_admin() then raise exception '관리자만 판정할 수 있습니다.'; end if;
  if p_decision not in ('not_error', 'key_wrong_confirmed', 'flawed_confirmed', 'explanation_confirmed') then
    raise exception '알 수 없는 판정입니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('problem_error:' || p_problem_id::text, 0));
  select * into v_prob from problems where id = p_problem_id for update;
  if v_prob.id is null then raise exception '존재하지 않는 문항입니다.'; end if;
  if not exists (select 1 from problem_versions where id = p_version_id and problem_id = p_problem_id) then
    raise exception '이 문항의 버전이 아닙니다.';
  end if;

  select * into v_last from problem_error_verdicts
   where problem_id = p_problem_id and problem_version_id = p_version_id
   order by decided_at desc, id desc limit 1;
  if v_last.id is not null and v_last.decision = p_decision then
    -- 같은 판정 재적용: 새 행 없음. 남아 있는 열린 신고만 닫는다(판정 이후 들어온 신고).
    update problem_error_reports set resolved_verdict_id = v_last.id, resolved_at = now()
     where problem_id = p_problem_id and problem_version_id = p_version_id and resolved_verdict_id is null;
    get diagnostics v_resolved = row_count;
    if v_resolved > 0 and not exists (select 1 from problem_error_reports where problem_id = p_problem_id and resolved_verdict_id is null) then
      update problems set error_review_needed = false where id = p_problem_id;
    end if;
    return jsonb_build_object('alreadyApplied', true, 'verdictId', v_last.id, 'decision', v_last.decision, 'resolvedReports', v_resolved);
  end if;

  v_affecting := p_decision in ('key_wrong_confirmed', 'flawed_confirmed');
  v_confirmed := p_decision <> 'not_error';

  insert into problem_error_verdicts (problem_id, problem_version_id, decision, note, decided_by)
  values (p_problem_id, p_version_id, p_decision, v_note, v_uid) returning id into v_id;

  update problem_error_reports set resolved_verdict_id = v_id, resolved_at = now()
   where problem_id = p_problem_id and problem_version_id = p_version_id and resolved_verdict_id is null;
  get diagnostics v_resolved = row_count;
  -- 다른 버전에 열린 신고가 남아 있으면 검토 필요 표시는 유지.
  update problems set error_review_needed = exists (
      select 1 from problem_error_reports r where r.problem_id = p_problem_id and r.resolved_verdict_id is null)
   where id = p_problem_id;

  if v_confirmed then
    update problems
       set archived_at = coalesce(archived_at, now()),
           archived_reason = coalesce(archived_reason, '문제 오류 신고 확정(' || p_decision || ')')
     where id = p_problem_id;
    -- 같은 칸(모듈×난이도×skill, 용도) 정보와 함께 대체 문항 필요 큐에 쌓고, 여분이 있으면 아직 시작 안 한 세트의 그 칸을 자동 교체한다.
    -- 이 문항의 큐가 이미 있으면(이전 확정 판정) 다시 쌓지·교체하지 않는다.
    if not exists (select 1 from problem_replacement_needs where problem_id = p_problem_id and status in ('open', 'linked')) then
      insert into problem_replacement_needs
        (verdict_id, problem_id, set_item_id, exam_set_id, section, module_key, route, difficulty, sat_domain, skill_code, usage_scope, in_mock_set)
      select v_id, p_problem_id, i.id, i.exam_set_id, i.section, i.module_key::text, i.route::text, i.difficulty, i.sat_domain, i.skill_code, v_prob.usage_scope, true
        from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id
       where i.problem_id = p_problem_id and s.archived_at is null and s.status in ('draft', 'published');
      get diagnostics v_needs = row_count;
      if v_needs = 0 then
        insert into problem_replacement_needs (verdict_id, problem_id, difficulty, sat_domain, skill_code, usage_scope, in_mock_set)
        values (v_id, p_problem_id, (select difficulty from problem_versions where id = p_version_id), v_prob.sat_domain, v_prob.skill_code, v_prob.usage_scope, false);
        v_needs := 1;
      end if;
      for v_need in select id from problem_replacement_needs where problem_id = p_problem_id and in_mock_set order by id loop
        v_res := _problem_error_try_replace_need(v_need);
        if v_res = 'replaced' then v_replaced := v_replaced + 1; end if;
      end loop;
    end if;
  end if;

  if p_decision = 'not_error' then
    -- 번복: 이전 오류 확정 판정 때문에 보관된 문항만 되돌린다(관리자가 따로 보관한 문항·다른 버전의 확정이 살아 있는 문항은 그대로).
    -- usage_scope·status 는 보관이 바꾸지 않으므로 보관 전 값 그대로다. 이미 활성이면 아무 것도 하지 않는다(멱등).
    if v_prob.archived_at is not null
       and v_prob.archived_reason like '문제 오류 신고 확정(%'
       and not exists (
         select 1 from problem_error_verdicts lv
          where lv.problem_id = p_problem_id and lv.decision <> 'not_error'
            and lv.id = (select z.id from problem_error_verdicts z
                          where z.problem_id = lv.problem_id and z.problem_version_id = lv.problem_version_id
                          order by z.decided_at desc, z.id desc limit 1)) then
      update problems set archived_at = null, archived_reason = null where id = p_problem_id;
      v_restored := true;
    end if;
    -- 열린 대체 문항 필요 기록은 '판정 번복'으로 닫는다. 이미 교체된(linked) 기록·세트는 그대로(교체 이력 append-only, 세트 교체 되돌리지 않음).
    update problem_replacement_needs
       set status = 'cancelled', open_reason = null, resolution = 'verdict_reverted', cancelled_at = now(), cancelled_verdict_id = v_id
     where problem_id = p_problem_id and status = 'open';
    get diagnostics v_cancelled = row_count;
  end if;
  select count(distinct exam_set_id) into v_kept_sets from mock_exam_item_replacements where old_problem_id = p_problem_id;

  -- 이전 판정이 만든 조정은 모두 대체 처리한 뒤 새 판정 기준으로 다시 계산한다.
  update mock_exam_answer_adjustments set superseded_at = now()
   where problem_id = p_problem_id and problem_version_id = p_version_id and superseded_at is null;
  if v_affecting then
    v_mock := _problem_error_apply_mock(p_problem_id, p_version_id, v_id);
  end if;
  v_work := _problem_error_apply_session(p_problem_id, p_version_id, v_id, v_affecting);
  v_hw := _problem_error_apply_homework(p_problem_id, p_version_id, v_id, v_affecting);

  return jsonb_build_object('alreadyApplied', false, 'verdictId', v_id, 'decision', p_decision,
    'resolvedReports', v_resolved, 'mockAdjustedAnswers', v_mock, 'sessionWorksAdjusted', v_work, 'homeworkItemsAdjusted', v_hw,
    'replacementNeedsCreated', v_needs, 'autoReplaced', v_replaced,
    'replacementNeedsOpen', (select count(*) from problem_replacement_needs where problem_id = p_problem_id and status = 'open'),
    'archived', v_confirmed, 'restored', v_restored, 'replacementNeedsCancelled', v_cancelled, 'replacedSetsKept', v_kept_sets);
end $$;

