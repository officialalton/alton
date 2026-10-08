-- 오류 신고 '확인' 중간 상태 + '수정됨' 자동 분류 + 상세에 그림·영어 해설 (2026-10-08, 오너 지시). 추가형 마이그레이션.
--  - '확인' = 관리자가 신고된 (문항, 버전)을 실제 오류로 보고 수정 대기 중이라고 표시한 것. 판정(problem_error_verdicts)과 별개이며
--    보관·정답 일괄 처리·자동 교체 같은 운영 동작을 일으키지 않는다. 되돌리면(unconfirm) 행이 지워진다.
--  - '수정됨' = 신고된 버전보다 새 공개 버전이 문항에 있으면 계산으로 분류(신고 행·verdict 불변, 별도 컬럼·트리거 없음).
--    새 공개 버전이 생기는 즉시 목록 조회에 반영되므로 기존 데이터 백필도 필요 없다.
-- 되돌리기: drop table problem_error_report_confirmations; 이전 정의로 함수 재적용(새 번호 마이그레이션).
create table if not exists problem_error_report_confirmations (
  problem_id uuid not null references problems (id),
  problem_version_id uuid not null references problem_versions (id),
  confirmed_by uuid not null references profiles (id),
  confirmed_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 1000),
  primary key (problem_id, problem_version_id)
);
alter table problem_error_report_confirmations enable row level security;
revoke all on problem_error_report_confirmations from anon, authenticated;
grant select on problem_error_report_confirmations to authenticated;
drop policy if exists "관리자 조회" on problem_error_report_confirmations;
create policy "관리자 조회" on problem_error_report_confirmations for select using (is_admin());

create or replace function public.problem_error_report_confirm(p_problem_id uuid, p_version_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 확인할 수 있습니다.'; end if;
  if not exists (select 1 from problem_error_reports where problem_id = p_problem_id and problem_version_id = p_version_id) then
    raise exception '신고가 없는 문항입니다.';
  end if;
  insert into problem_error_report_confirmations (problem_id, problem_version_id, confirmed_by, note)
  values (p_problem_id, p_version_id, auth.uid(), nullif(btrim(p_note), ''))
  on conflict (problem_id, problem_version_id) do update set note = coalesce(nullif(btrim(p_note), ''), problem_error_report_confirmations.note);
  return jsonb_build_object('confirmed', true);
end $$;

create or replace function public.problem_error_report_unconfirm(p_problem_id uuid, p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 확인을 취소할 수 있습니다.'; end if;
  delete from problem_error_report_confirmations where problem_id = p_problem_id and problem_version_id = p_version_id;
  return jsonb_build_object('confirmed', false);
end $$;
revoke execute on function public.problem_error_report_confirm(uuid, uuid, text), public.problem_error_report_unconfirm(uuid, uuid) from public, anon;
grant execute on function public.problem_error_report_confirm(uuid, uuid, text), public.problem_error_report_unconfirm(uuid, uuid) to authenticated;

-- 목록: p_status = 'open'(검토 필요: 미확인·미해결·수정 안 됨) | 'confirmed' | 'fixed' | 'all'. 칩 건수는 같은 필터에서 한 번에 계산해 counts 로 돌려준다.
create or replace function public.problem_error_report_groups(
  p_status text default 'open', p_limit int default 50, p_offset int default 0,
  p_skill text default null, p_difficulty text default null, p_domain text default null, p_days int default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200); v_view text := coalesce(p_status, 'open'); v_out jsonb;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  with base as (
    select r.problem_id, r.problem_version_id, count(*) n, count(*) filter (where r.resolved_verdict_id is null) n_open,
           count(*) filter (where r.report_type = 'wrong_key') n_key, count(*) filter (where r.report_type = 'flawed_problem') n_flawed,
           count(*) filter (where r.report_type = 'bad_explanation') n_expl, count(*) filter (where r.report_type = 'other') n_other,
           count(*) filter (where r.source = 'session_assignment') n_session, count(*) filter (where r.source = 'mock_exam') n_mock, count(*) filter (where r.source = 'homework_batch') n_hw,
           min(r.created_at) first_at, max(r.created_at) last_at
    from problem_error_reports r
    join problems fp on fp.id = r.problem_id
    join problem_versions fv on fv.id = r.problem_version_id
    where (p_skill is null or coalesce(fp.skill_code, 'unknown') = p_skill)
      and (p_domain is null or coalesce(fp.sat_domain, 'unknown') = p_domain)
      and (p_difficulty is null or coalesce(fv.difficulty::text, 'unknown') = p_difficulty)
      and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
    group by r.problem_id, r.problem_version_id
  ), cls as (
    select b.*, v.version_no, cv.version_no as current_no, cf.confirmed_at, cf.confirmed_by, cf.note as confirm_note,
           (cv.version_no is not null and cv.version_no > v.version_no) as is_fixed,
           (cf.problem_id is not null) as is_confirmed
    from base b
    join problem_versions v on v.id = b.problem_version_id
    join problems p on p.id = b.problem_id
    left join problem_versions cv on cv.id = p.published_version_id
    left join problem_error_report_confirmations cf on cf.problem_id = b.problem_id and cf.problem_version_id = b.problem_version_id
  ), cnt as (
    select count(*) filter (where not is_fixed and not is_confirmed and n_open > 0) review,
           count(*) filter (where not is_fixed and is_confirmed) confirmed,
           count(*) filter (where is_fixed) fixed, count(*) total from cls
  ), sel as (
    select * from cls where case v_view
      when 'confirmed' then not is_fixed and is_confirmed
      when 'fixed' then is_fixed
      when 'all' then true
      else not is_fixed and not is_confirmed and n_open > 0 end
  ), page as (
    select * from sel order by last_at desc limit v_limit offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from sel),
    'counts', (select jsonb_build_object('review', review, 'confirmed', confirmed, 'fixed', fixed, 'all', total) from cnt),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'problemId', c.problem_id, 'versionId', c.problem_version_id,
      'format', p.format, 'satDomain', p.sat_domain, 'skillCode', p.skill_code, 'difficulty', v.difficulty,
      'snippet', left(coalesce(nullif(v.question, ''), v.passage, ''), 140),
      'reportCount', c.n, 'openCount', c.n_open,
      'typeCounts', jsonb_build_object('wrong_key', c.n_key, 'flawed_problem', c.n_flawed, 'bad_explanation', c.n_expl, 'other', c.n_other),
      'sourceCounts', jsonb_build_object('session_assignment', c.n_session, 'mock_exam', c.n_mock, 'homework_batch', c.n_hw),
      'firstAt', c.first_at, 'lastAt', c.last_at,
      'archived', p.archived_at is not null,
      'versionNo', c.version_no, 'currentVersionNo', c.current_no,
      'state', case when c.is_fixed then 'fixed' when c.is_confirmed then 'confirmed' else 'review' end,
      'confirmedAt', c.confirmed_at,
      'latestDecision', (select lv.decision from problem_error_verdicts lv where lv.problem_id = c.problem_id and lv.problem_version_id = c.problem_version_id
                          order by lv.decided_at desc, lv.id desc limit 1)
    ) order by c.last_at desc)
    from page c join problems p on p.id = c.problem_id join problem_versions v on v.id = c.problem_version_id), '[]'::jsonb))
  into v_out;
  return v_out;
end $$;

-- 상세: 그림(figure)·영어 해설·확인/수정됨 상태 추가(나머지는 20261970000000 정의 그대로).
create or replace function public.problem_error_report_detail(p_problem_id uuid, p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_prob problems%rowtype; v_ver problem_versions%rowtype; v_out jsonb; v_cur int; v_cf problem_error_report_confirmations%rowtype; v_cf_name text;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select * into v_prob from problems where id = p_problem_id;
  select * into v_ver from problem_versions where id = p_version_id and problem_id = p_problem_id;
  if v_prob.id is null or v_ver.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
  select version_no into v_cur from problem_versions where id = v_prob.published_version_id;
  select * into v_cf from problem_error_report_confirmations where problem_id = p_problem_id and problem_version_id = p_version_id;
  select name into v_cf_name from profiles where id = v_cf.confirmed_by;
  v_out := jsonb_build_object(
    'problem', jsonb_build_object('id', v_prob.id, 'format', v_prob.format, 'satDomain', v_prob.sat_domain, 'skillCode', v_prob.skill_code,
      'usageScope', v_prob.usage_scope, 'archived', v_prob.archived_at is not null, 'archivedReason', v_prob.archived_reason,
      'reviewNeeded', v_prob.error_review_needed),
    'version', jsonb_build_object('id', v_ver.id, 'versionNo', v_ver.version_no, 'status', v_ver.status, 'passage', v_ver.passage, 'question', v_ver.question,
      'options', v_ver.options, 'correctIndex', v_ver.correct_index, 'answers', v_ver.answers, 'explanation', v_ver.explanation,
      'explanationEn', v_ver.explanation_en, 'figure', v_ver.figure, 'difficulty', v_ver.difficulty),
    'currentVersionNo', v_cur,
    'confirmation', case when v_cf.problem_id is null then null else jsonb_build_object('confirmedAt', v_cf.confirmed_at, 'confirmedByName', v_cf_name, 'note', v_cf.note) end,
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'source', r.source, 'sessionSource', r.session_source, 'reporterRole', r.reporter_role,
        'reporterName', pr.name, 'reportType', r.report_type, 'memo', r.memo, 'createdAt', r.created_at, 'resolved', r.resolved_verdict_id is not null)
        order by r.created_at desc)
      from (select * from problem_error_reports where problem_id = p_problem_id and problem_version_id = p_version_id order by created_at desc limit 200) r
      left join profiles pr on pr.id = r.reporter_id), '[]'::jsonb),
    'reportTotal', (select count(*) from problem_error_reports where problem_id = p_problem_id and problem_version_id = p_version_id),
    'affected', jsonb_build_object(
      'mockAttemptsGraded', (select count(*) from mock_exam_set_items i join mock_exam_attempts a on a.exam_set_id = i.exam_set_id and a.status = 'graded'
                              where i.problem_id = p_problem_id and i.problem_version_id = p_version_id),
      'mockAttemptsOpen', (select count(*) from mock_exam_set_items i join mock_exam_attempts a on a.exam_set_id = i.exam_set_id and a.status <> 'graded'
                            where i.problem_id = p_problem_id and i.problem_version_id = p_version_id),
      'sessionWorks', (select count(*) from session_problem_work w join problems p on p.id = w.problem_id
                        where w.problem_id = p_problem_id and w.submitted_at is not null
                          and coalesce(w.problem_version_id, p.published_version_id) = p_version_id),
      'mockAdjusted', (select count(*) from mock_exam_answer_adjustments where problem_id = p_problem_id and problem_version_id = p_version_id and superseded_at is null),
      'sessionAdjusted', (select count(*) from session_problem_work w where w.problem_id = p_problem_id and w.error_adjusted_at is not null),
      'sessionPending', (select count(*) from session_problem_work w where w.problem_id = p_problem_id and w.error_adjustment_pending),
      'homework', _problem_error_homework_counts(p_problem_id, p_version_id)),
    'verdicts', coalesce((
      select jsonb_agg(jsonb_build_object('id', vd.id, 'decision', vd.decision, 'note', vd.note, 'decidedAt', vd.decided_at, 'decidedByName', pr.name) order by vd.decided_at desc)
      from problem_error_verdicts vd left join profiles pr on pr.id = vd.decided_by
      where vd.problem_id = p_problem_id and vd.problem_version_id = p_version_id), '[]'::jsonb),
    'replacementNeeds', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'status', n.status, 'moduleKey', n.module_key, 'route', n.route, 'difficulty', n.difficulty,
        'satDomain', n.sat_domain, 'skillCode', n.skill_code, 'usageScope', n.usage_scope, 'inMockSet', n.in_mock_set,
        'openReason', n.open_reason, 'replacementProblemId', n.replacement_problem_id) order by n.created_at)
      from problem_replacement_needs n where n.problem_id = p_problem_id), '[]'::jsonb),
    'replacements', coalesce((
      select jsonb_agg(jsonb_build_object('examSetId', r.exam_set_id, 'examSetName', s.name, 'newProblemId', r.new_problem_id,
        'moduleKey', r.module_key, 'route', r.route, 'createdAt', r.created_at) order by r.created_at)
      from mock_exam_item_replacements r left join mock_exam_sets s on s.id = r.exam_set_id
      where r.old_problem_id = p_problem_id), '[]'::jsonb));
  return v_out;
end $$;

-- '확인' 목록 내보내기(복사·CSV용): 확인 상태이고 아직 수정되지 않은 (문항, 버전)별 한 행.
create or replace function public.problem_error_report_confirmed_export() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'problemId', cf.problem_id, 'versionId', cf.problem_version_id, 'versionNo', v.version_no, 'currentVersionNo', cv.version_no,
      'satDomain', p.sat_domain, 'skillCode', p.skill_code, 'difficulty', v.difficulty, 'confirmedAt', cf.confirmed_at, 'confirmNote', cf.note,
      'hasExplanationEn', coalesce(btrim(v.explanation_en), '') <> '', 'hasExplanationKo', coalesce(btrim(v.explanation), '') <> '',
      'sets', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'module', i.module_key, 'position', i.position) order by s.name, i.position)
                         from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id
                         where i.problem_id = cf.problem_id and i.problem_version_id = cf.problem_version_id), '[]'::jsonb),
      'reports', coalesce((select jsonb_agg(jsonb_build_object('type', r.report_type, 'memo', r.memo, 'reporter', pr.name, 'role', r.reporter_role, 'at', r.created_at) order by r.created_at)
                            from problem_error_reports r left join profiles pr on pr.id = r.reporter_id
                            where r.problem_id = cf.problem_id and r.problem_version_id = cf.problem_version_id), '[]'::jsonb)
    ) order by cf.confirmed_at)
    from problem_error_report_confirmations cf
    join problems p on p.id = cf.problem_id
    join problem_versions v on v.id = cf.problem_version_id
    left join problem_versions cv on cv.id = p.published_version_id
    where not (cv.version_no is not null and cv.version_no > v.version_no)), '[]'::jsonb);
end $$;
revoke execute on function public.problem_error_report_confirmed_export() from public, anon;
grant execute on function public.problem_error_report_confirmed_export() to authenticated;
