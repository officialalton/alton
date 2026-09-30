-- 문제 오류 신고 (2026-09-29, 오너 확정) — 2/2: 관리자 판정·채점 조정·대체 문항 큐·읽기 경로.
--
-- 판정(decision)과 처리 — 유형 무관, 관리자가 판정한다. 수정본 발행·정답 추가 인정 경로는 없다(오너 단순화).
--   not_error             유지. 신고만 닫고 신고자에게 "오류 아님"으로 보인다. 채점·문항 변경 없음.
--   key_wrong_confirmed   정답 오류 확정 → 문항 보관 + 이미 나간 응시·과제 전원 정답 처리 + 대체 문항 필요 기록.
--   flawed_confirmed      문제 자체 오류 확정 → 위와 같음.
--   explanation_confirmed 해설 오류 확정 → 문항 보관 + 대체 문항 필요 기록. 채점·점수 변경 없음.
-- 오류 확정 시 문항은 즉시 보관(신규 조립·배정 후보에서 제외)되고, 아직 응시가 시작되지 않은 세트의 그 칸은 여분 공개 문항으로 자동 교체한다
-- (_problem_error_try_replace_need — 응시 시작·완료 세트는 불변, 여분 없으면 큐에 no_spare/set_started 로 기록, AI 생성 없음).
-- 채점 조정(전원 정답 처리)은 응답 여부와 무관하게(미응답 포함) 정답으로 본다 — 문항 자체가 무효이기 때문.
--   모의고사: 원채점(mock_exam_answers.correct·모듈 raw_correct_count·M2 경로)은 그대로 두고 조정 채점을 별도 이력
--            (mock_exam_answer_adjustments)에 저장한다. 채점 완료(graded) 응시에 적용하고, 아직 진행 중인 응시는
--            graded 로 바뀌는 순간 트리거가 적용한다. 경로(rw_m2_route 등)는 건드리지 않는다(재라우팅 없음).
--            결과 화면·요약의 정답 수·예상 점수 범위는 조정 채점 기준이다.
--   과제:   자동 채점(auto_correct)을 전원 정답으로 재계산한다. 이미 선생님이 채점한 풀이는 덮어쓰지 않고
--            error_adjustment_pending 으로 "조정 대상" 표시만 한다(선생님이 다시 채점하면 해제).
-- 판정 이력(problem_error_verdicts)은 append-only(수정·삭제·TRUNCATE 차단). 같은 (문항, 버전)에 같은 판정을 다시 적용하면
-- 새 행 없이 alreadyApplied 로 끝난다(멱등). 다른 판정이 오면 새 행이 쌓이고 이전 조정은 superseded 처리 후 새 판정 기준으로 다시 계산.
-- 되돌리기: drop function/table 이 파일의 객체 → mock_exam_attempt_detail/_summaries 는 20261918000001 본문으로, grade_problem_attempt 는
--          20261442000000 본문으로 새 번호 마이그레이션에서 재적용.

-- =========================================================================
-- 1. 판정 이력 (append-only)
-- =========================================================================
create table problem_error_verdicts (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id),
  problem_version_id uuid not null references problem_versions (id),
  decision text not null check (decision in ('not_error', 'key_wrong_confirmed', 'flawed_confirmed', 'explanation_confirmed')),
  note text check (note is null or char_length(note) <= 2000),
  decided_by uuid not null references profiles (id),
  decided_at timestamptz not null default now()
);
create index problem_error_verdicts_lookup_idx on problem_error_verdicts (problem_id, problem_version_id, decided_at desc, id desc);
alter table problem_error_verdicts enable row level security;
revoke all on problem_error_verdicts from anon, authenticated;
grant select on problem_error_verdicts to authenticated;
create policy "관리자 조회" on problem_error_verdicts for select using (is_admin());

create or replace function public._problem_error_append_only() returns trigger
language plpgsql as $$
begin
  raise exception '% 는 추가만 가능합니다(수정·삭제 불가).', tg_table_name;
end $$;
create trigger problem_error_verdicts_no_update before update or delete on problem_error_verdicts
  for each row execute function _problem_error_append_only();
create trigger problem_error_verdicts_no_truncate before truncate on problem_error_verdicts
  for each statement execute function _problem_error_append_only();

alter table problem_error_reports
  add constraint problem_error_reports_verdict_fk foreign key (resolved_verdict_id) references problem_error_verdicts (id);

-- =========================================================================
-- 2. 모의고사 조정 채점 이력
-- =========================================================================
create table mock_exam_answer_adjustments (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references mock_exam_attempts (id) on delete cascade,
  set_item_id uuid not null references mock_exam_set_items (id) on delete cascade,
  verdict_id uuid not null references problem_error_verdicts (id),
  problem_id uuid not null references problems (id),
  problem_version_id uuid not null references problem_versions (id),
  original_correct boolean,            -- 원채점(미응답이면 null) — mock_exam_answers.correct 의 그 시점 사본
  adjusted_correct boolean not null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);
-- 현재 유효한 조정은 (응시, 문항)당 하나.
create unique index mock_exam_answer_adjustments_current_uq on mock_exam_answer_adjustments (attempt_id, set_item_id) where superseded_at is null;
create index mock_exam_answer_adjustments_problem_idx on mock_exam_answer_adjustments (problem_id, problem_version_id) where superseded_at is null;
create index mock_exam_answer_adjustments_verdict_idx on mock_exam_answer_adjustments (verdict_id);
alter table mock_exam_answer_adjustments enable row level security;
revoke all on mock_exam_answer_adjustments from anon, authenticated;
grant select on mock_exam_answer_adjustments to authenticated;
create policy "관리자 조회" on mock_exam_answer_adjustments for select using (is_admin());

-- 이력: 삭제 금지, 갱신은 superseded_at 을 한 번 채우는 것만.
create or replace function public._mock_exam_answer_adjustments_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception '조정 채점 이력은 삭제할 수 없습니다.'; end if;
  if old.superseded_at is not null
     or (to_jsonb(new) - 'superseded_at') is distinct from (to_jsonb(old) - 'superseded_at') then
    raise exception '조정 채점 이력은 수정할 수 없습니다(대체 처리만 가능).';
  end if;
  return new;
end $$;
create trigger mock_exam_answer_adjustments_guard before update or delete on mock_exam_answer_adjustments
  for each row execute function _mock_exam_answer_adjustments_guard();
create trigger mock_exam_answer_adjustments_no_truncate before truncate on mock_exam_answer_adjustments
  for each statement execute function _problem_error_append_only();

-- =========================================================================
-- 3. 대체 문항 필요 큐
-- =========================================================================
create table problem_replacement_needs (
  id uuid primary key default gen_random_uuid(),
  verdict_id uuid not null references problem_error_verdicts (id),
  problem_id uuid not null references problems (id),          -- 보관된 문항
  -- 세트·칸 정보는 교체로 행이 삭제돼도 이력이 남도록 FK 없이 보관한다.
  set_item_id uuid,
  exam_set_id uuid,
  section text,
  module_key text,
  route text,
  difficulty text,
  sat_domain text,
  skill_code text,
  usage_scope text not null,               -- 문항의 용도: general / mock_exam / both
  in_mock_set boolean not null,            -- 모의고사 세트 칸에서 빠진 것인가(true) / 일반 문항(false, 자동 교체 대상 아님)
  status text not null default 'open' check (status in ('open', 'linked')),
  open_reason text check (open_reason in ('no_spare', 'set_started')),
  resolution text check (resolution in ('auto_replaced')),
  replacement_problem_id uuid references problems (id),
  linked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index problem_replacement_needs_slot_uq on problem_replacement_needs (problem_id, coalesce(set_item_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index problem_replacement_needs_open_idx on problem_replacement_needs (created_at desc) where status = 'open';
create index problem_replacement_needs_set_idx on problem_replacement_needs (exam_set_id) where status = 'open';
alter table problem_replacement_needs enable row level security;
revoke all on problem_replacement_needs from anon, authenticated;
grant select on problem_replacement_needs to authenticated;
create policy "관리자 조회" on problem_replacement_needs for select using (is_admin());

-- 자동 교체 이력(append-only). 세트·문항 id 는 FK 없이 남긴다.
create table mock_exam_item_replacements (
  id uuid primary key default gen_random_uuid(),
  verdict_id uuid not null references problem_error_verdicts (id),
  need_id uuid references problem_replacement_needs (id),
  exam_set_id uuid not null,
  old_problem_id uuid not null,
  new_problem_id uuid not null,
  old_set_item_id uuid not null,
  new_set_item_id uuid not null,
  section text, module_key text, route text, difficulty text, sat_domain text, skill_code text,
  created_at timestamptz not null default now()
);
create index mock_exam_item_replacements_recent_idx on mock_exam_item_replacements (created_at desc);
create index mock_exam_item_replacements_old_problem_idx on mock_exam_item_replacements (old_problem_id);
alter table mock_exam_item_replacements enable row level security;
revoke all on mock_exam_item_replacements from anon, authenticated;
grant select on mock_exam_item_replacements to authenticated;
create policy "관리자 조회" on mock_exam_item_replacements for select using (is_admin());
create trigger mock_exam_item_replacements_append_only before update or delete on mock_exam_item_replacements
  for each row execute function _problem_error_append_only();
create trigger mock_exam_item_replacements_no_truncate before truncate on mock_exam_item_replacements
  for each statement execute function _problem_error_append_only();

-- =========================================================================
-- 4. 채점 조정 적용 함수 (내부 — execute 권한 없음)
-- =========================================================================
-- 모의고사: graded 응시 중 이 (문항, 버전)을 응시 경로 안에서 푼 것에 조정 이력을 넣는다. 원래 정답인 것은 건드리지 않는다.
create or replace function public._problem_error_apply_mock(p_problem_id uuid, p_version_id uuid, p_verdict_id uuid, p_attempt_id uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with ins as (
    insert into mock_exam_answer_adjustments (attempt_id, set_item_id, verdict_id, problem_id, problem_version_id, original_correct, adjusted_correct)
    select a.id, i.id, p_verdict_id, p_problem_id, p_version_id, ans.correct, true
    from mock_exam_set_items i
    join mock_exam_attempts a on a.exam_set_id = i.exam_set_id and a.status = 'graded'
    left join mock_exam_answers ans on ans.attempt_id = a.id and ans.set_item_id = i.id
    where i.problem_id = p_problem_id and i.problem_version_id = p_version_id
      and (p_attempt_id is null or a.id = p_attempt_id)
      and _mock_exam_item_in_route(i, a)
      and ans.correct is not true
      and not exists (select 1 from mock_exam_answer_adjustments x
                       where x.attempt_id = a.id and x.set_item_id = i.id and x.superseded_at is null)
    returning 1)
  select count(*) into v_n from ins;
  return v_n;
end $$;
revoke execute on function public._problem_error_apply_mock(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- 응시가 graded 로 바뀌는 순간: 그 세트 문항 중 이미 전원 정답 판정이 난 (문항, 버전)에 조정을 적용한다.
create or replace function public._problem_error_attempt_graded() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select distinct on (v.problem_id, v.problem_version_id) v.id, v.problem_id, v.problem_version_id, v.decision
    from mock_exam_set_items i
    join problem_error_verdicts v on v.problem_id = i.problem_id and v.problem_version_id = i.problem_version_id
    where i.exam_set_id = new.exam_set_id
    order by v.problem_id, v.problem_version_id, v.decided_at desc, v.id desc
  loop
    if r.decision in ('key_wrong_confirmed', 'flawed_confirmed') then
      perform _problem_error_apply_mock(r.problem_id, r.problem_version_id, r.id, new.id);
    end if;
  end loop;
  return new;
end $$;
create trigger problem_error_attempt_graded after update of status on mock_exam_attempts
  for each row when (new.status = 'graded' and old.status is distinct from 'graded')
  execute function _problem_error_attempt_graded();

-- 과제·수업 풀이: 제출된 풀이의 자동 채점을 (원채점 재계산 →) 전원 정답으로 조정하거나, 조정 해제 시 원채점으로 되돌린다.
--  - 선생님이 이미 채점(graded_at)한 풀이의 grade 는 절대 바꾸지 않는다. 채점 결과가 '정답'이 아니면 조정 대상으로만 표시한다.
--  - 원채점(raw)은 제출 답안 + 그 풀이가 고정한 버전의 정답으로 다시 계산한다.
create or replace function public._problem_error_apply_session(p_problem_id uuid, p_version_id uuid, p_verdict_id uuid, p_score_affecting boolean)
returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with target as (
    select w.id, w.graded_at, w.grade, w.auto_correct, w.error_adjustment_verdict_id,
           p.format::text as fmt,
           case
             when w.submitted_choice_index is not null then (v.correct_index = w.submitted_choice_index)
             when w.submitted_text is not null and v.answers is not null and jsonb_typeof(v.answers) = 'array' and jsonb_array_length(v.answers) > 0
               then public.spr_answer_matches(w.submitted_text, v.answers)
             else null
           end as raw_auto
    from session_problem_work w
    join problems p on p.id = w.problem_id
    left join problem_versions v on v.id = coalesce(w.problem_version_id, p.published_version_id)
    where w.problem_id = p_problem_id
      and coalesce(w.problem_version_id, p.published_version_id) = p_version_id
      and w.submitted_at is not null
  ), upd as (
    update session_problem_work w set
      auto_correct = case when p_score_affecting and t.fmt in ('mc', 'spr') then true
                          when p_score_affecting then w.auto_correct
                          else t.raw_auto end,
      error_adjusted_at = case when p_score_affecting and (w.graded_at is null or w.grade is distinct from 'correct') then now()
                               when p_score_affecting then w.error_adjusted_at
                               else null end,
      error_adjustment_pending = case when p_score_affecting then (w.graded_at is not null and w.grade is distinct from 'correct')
                                      else false end,
      error_adjustment_verdict_id = case when p_score_affecting and (w.graded_at is null or w.grade is distinct from 'correct') then p_verdict_id
                                         when p_score_affecting then w.error_adjustment_verdict_id
                                         else null end
    from target t
    where w.id = t.id
      and (p_score_affecting or t.error_adjustment_verdict_id is not null or w.auto_correct is distinct from t.raw_auto)
    returning 1)
  select count(*) into v_n from upd;
  return v_n;
end $$;
revoke execute on function public._problem_error_apply_session(uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- 판정 이후 새로 제출되는 풀이도 같은 기준으로 자동 채점되게 한다(전원 정답 판정된 문항의 자동 채점 가능 형식만).
create or replace function public._problem_error_work_auto_adjust() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_decision text; v_fmt text;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' and new.auto_correct is not distinct from old.auto_correct and old.submitted_at is not null then return new; end if;
  select v.decision into v_decision from problem_error_verdicts v
   where v.problem_id = new.problem_id
     and v.problem_version_id = coalesce(new.problem_version_id, (select published_version_id from problems where id = new.problem_id))
   order by v.decided_at desc, v.id desc limit 1;
  if v_decision in ('key_wrong_confirmed', 'flawed_confirmed') then
    select format::text into v_fmt from problems where id = new.problem_id;
    if v_fmt in ('mc', 'spr') then new.auto_correct := true; end if;
  end if;
  return new;
end $$;
create trigger problem_error_work_auto_adjust before insert or update of auto_correct, submitted_at on session_problem_work
  for each row execute function _problem_error_work_auto_adjust();

-- 선생님이 다시 채점하면 조정 대상 표시를 해제한다(20261442000000 본문 + 해제).
create or replace function public.grade_problem_attempt(
  p_work_id uuid,
  p_grade text,
  p_comment text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_work session_problem_work%rowtype;
  v_grade text := p_grade;
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  select * into v_work from session_problem_work where id = p_work_id for update;
  if not found then
    raise exception '풀이판을 찾을 수 없습니다.';
  end if;
  if not (public.is_session_teacher_v3(v_work.session_id) or is_admin()) then
    raise exception '이 수업의 담당 선생님만 채점할 수 있습니다.';
  end if;
  -- 객관식은 비워 보내면 자동 채점 결과를 그대로 확정한다.
  if v_grade is null then
    if v_work.auto_correct is null then
      raise exception '채점 결과(정답/부분/오답)를 골라 주세요.';
    end if;
    v_grade := case when v_work.auto_correct then 'correct' else 'incorrect' end;
  end if;
  if v_grade not in ('correct', 'partial', 'incorrect') then
    raise exception '채점 결과는 정답/부분/오답 중 하나입니다: %', v_grade;
  end if;
  update session_problem_work
    set grade = v_grade,
        grade_comment = nullif(btrim(coalesce(p_comment, '')), ''),
        graded_at = now(),
        graded_by = auth.uid(),
        error_adjustment_pending = false,
        saved_to_practice = case when v_grade = 'incorrect' then true else saved_to_practice end
    where id = p_work_id;
end;
$$;

-- 여분 문항 자동 교체(오너 확정): 아직 응시가 시작되지 않은 세트의 그 칸(set_items 행)을, 같은 칸(영역·skill·난이도·형식·모듈·경로)의
-- 공개 문항 중 어떤 (초안·공개) 세트에도 배정되지 않았고 그 세트의 유사문항 그룹과 겹치지 않는 것으로 바꾼다.
--  - 응시가 하나라도 시작된(assigned 가 아닌) 세트·답안이 붙은 문항은 절대 바꾸지 않는다(스냅샷 불변) → 큐에 set_started 로 남는다.
--  - 여분이 없으면 바꾸지 않고 큐에 no_spare 로 남는다(AI 문항 생성 없음, 조립·배정 차단 없음).
--  - 스냅샷 트리거가 문항 내용 변경을 막으므로 행을 지우고 같은 자리에 새로 넣는다(position·module_key·route 유지 → 경로 변형 구분·skill 균형 유지).
--  - 전역 어드바이저리 락 + 세트 응시 행 FOR UPDATE 로 동시 판정·동시 시작과 직렬화한다. 멱등: 이미 교체된(linked) 항목은 건너뛴다.
create or replace function public._problem_error_try_replace_need(p_need_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  n problem_replacement_needs%rowtype;
  it mock_exam_set_items%rowtype;
  st mock_exam_sets%rowtype;
  v_fmt problem_format;
  cand record;
  v_new uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('problem_error:replace_pool', 0));
  select * into n from problem_replacement_needs where id = p_need_id for update;
  if n.id is null or n.status <> 'open' or n.set_item_id is null then return 'skipped'; end if;
  select * into it from mock_exam_set_items where id = n.set_item_id;
  if it.id is null then return 'skipped'; end if;
  select * into st from mock_exam_sets where id = it.exam_set_id;
  if st.archived_at is not null or st.status not in ('draft', 'published') then return 'skipped'; end if;

  perform 1 from mock_exam_attempts where exam_set_id = st.id order by id for update;
  if exists (select 1 from mock_exam_attempts where exam_set_id = st.id and status <> 'assigned')
     or exists (select 1 from mock_exam_answers a where a.set_item_id = it.id) then
    update problem_replacement_needs set open_reason = 'set_started' where id = n.id;
    return 'set_started';
  end if;

  select format into v_fmt from problems where id = it.problem_id;
  select p.id as problem_id, p.published_version_id as version_id into cand
  from problems p
  join problem_versions v on v.id = p.published_version_id and v.status = 'published'
  where p.archived_at is null and p.status = 'confirmed' and not p.error_review_needed
    and p.usage_scope in ('mock_exam', 'both')
    and p.sat_domain = it.sat_domain and p.skill_code is not distinct from it.skill_code
    and p.format = v_fmt and v.difficulty = it.difficulty
    and not exists (select 1 from mock_exam_set_items x join mock_exam_sets s on s.id = x.exam_set_id
                     where x.problem_id = p.id and s.archived_at is null and s.status in ('draft', 'published'))
    and (p.similarity_group is null or not exists (
          select 1 from mock_exam_set_items y join problems py on py.id = y.problem_id
           where y.exam_set_id = it.exam_set_id and y.id <> it.id and py.similarity_group = p.similarity_group))
  order by p.id
  limit 1
  for update of p skip locked;
  if cand.problem_id is null then
    update problem_replacement_needs set open_reason = 'no_spare' where id = n.id;
    return 'no_spare';
  end if;

  delete from mock_exam_set_items where id = it.id;
  insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty, module_key, route)
  values (it.exam_set_id, it.section, it.position, cand.problem_id, cand.version_id, it.sat_domain, it.skill_code, it.difficulty, it.module_key, it.route)
  returning id into v_new;
  update problem_replacement_needs
     set status = 'linked', open_reason = null, resolution = 'auto_replaced', replacement_problem_id = cand.problem_id, linked_at = now()
   where id = n.id;
  insert into mock_exam_item_replacements (verdict_id, need_id, exam_set_id, old_problem_id, new_problem_id, old_set_item_id, new_set_item_id,
                                           section, module_key, route, difficulty, sat_domain, skill_code)
  values (n.verdict_id, n.id, it.exam_set_id, it.problem_id, cand.problem_id, it.id, v_new,
          it.section, it.module_key::text, it.route::text, it.difficulty, it.sat_domain, it.skill_code);
  return 'replaced';
end $$;
revoke execute on function public._problem_error_try_replace_need(uuid) from public, anon, authenticated;

-- =========================================================================
-- 5. 판정 RPC (관리자 전용, 정의자 함수)
-- =========================================================================
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
  v_resolved int;
  v_needs int := 0;
  v_need uuid;
  v_res text;
  v_replaced int := 0;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
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
    if not exists (select 1 from problem_replacement_needs where problem_id = p_problem_id) then
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

  -- 이전 판정이 만든 조정은 모두 대체 처리한 뒤 새 판정 기준으로 다시 계산한다.
  update mock_exam_answer_adjustments set superseded_at = now()
   where problem_id = p_problem_id and problem_version_id = p_version_id and superseded_at is null;
  if v_affecting then
    v_mock := _problem_error_apply_mock(p_problem_id, p_version_id, v_id);
  end if;
  v_work := _problem_error_apply_session(p_problem_id, p_version_id, v_id, v_affecting);

  return jsonb_build_object('alreadyApplied', false, 'verdictId', v_id, 'decision', p_decision,
    'resolvedReports', v_resolved, 'mockAdjustedAnswers', v_mock, 'sessionWorksAdjusted', v_work,
    'replacementNeedsCreated', v_needs, 'autoReplaced', v_replaced,
    'replacementNeedsOpen', (select count(*) from problem_replacement_needs where problem_id = p_problem_id and status = 'open'),
    'archived', v_confirmed);
end $$;
revoke execute on function public.problem_error_apply_verdict(uuid, uuid, text, text) from public, anon;
grant execute on function public.problem_error_apply_verdict(uuid, uuid, text, text) to authenticated;

-- =========================================================================
-- 6. 관리자 읽기 RPC
-- =========================================================================
-- 신고된 문항 목록 — (문항, 버전)별 묶음. status: open(열린 신고가 있는 것) / all.
-- 대량 신고에서도 한 번의 집계 + 페이지 크기만큼의 조인만 한다(문항당 추가 쿼리 없음).
create or replace function public.problem_error_report_groups(p_status text default 'open', p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200); v_open boolean := coalesce(p_status, 'open') <> 'all';
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select count(*) into v_total from (
    select 1 from problem_error_reports r where (not v_open or r.resolved_verdict_id is null) group by r.problem_id, r.problem_version_id) x;
  select coalesce(jsonb_agg(g.item order by g.last_at desc), '[]'::jsonb) into v_rows from (
    select c.last_at, jsonb_build_object(
      'problemId', c.problem_id, 'versionId', c.problem_version_id,
      'format', p.format, 'satDomain', p.sat_domain, 'skillCode', p.skill_code, 'difficulty', v.difficulty,
      'snippet', left(coalesce(nullif(v.question, ''), v.passage, ''), 140),
      'reportCount', c.n, 'openCount', c.n_open,
      'typeCounts', jsonb_build_object('wrong_key', c.n_key, 'flawed_problem', c.n_flawed, 'bad_explanation', c.n_expl, 'other', c.n_other),
      'sourceCounts', jsonb_build_object('session_assignment', c.n_session, 'mock_exam', c.n_mock),
      'firstAt', c.first_at, 'lastAt', c.last_at,
      'archived', p.archived_at is not null,
      'latestDecision', (select lv.decision from problem_error_verdicts lv where lv.problem_id = c.problem_id and lv.problem_version_id = c.problem_version_id
                          order by lv.decided_at desc, lv.id desc limit 1)
    
    ) as item
    from (
      select r.problem_id, r.problem_version_id, count(*) n, count(*) filter (where r.resolved_verdict_id is null) n_open,
             count(*) filter (where r.report_type = 'wrong_key') n_key, count(*) filter (where r.report_type = 'flawed_problem') n_flawed,
             count(*) filter (where r.report_type = 'bad_explanation') n_expl, count(*) filter (where r.report_type = 'other') n_other,
             count(*) filter (where r.source = 'session_assignment') n_session, count(*) filter (where r.source = 'mock_exam') n_mock,
             min(r.created_at) first_at, max(r.created_at) last_at
      from problem_error_reports r
      where (not v_open or r.resolved_verdict_id is null)
      group by r.problem_id, r.problem_version_id
      order by max(r.created_at) desc
      limit v_limit offset greatest(coalesce(p_offset, 0), 0)
    ) c
    join problems p on p.id = c.problem_id
    join problem_versions v on v.id = c.problem_version_id
  ) g;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;
revoke execute on function public.problem_error_report_groups(text, int, int) from public, anon;
grant execute on function public.problem_error_report_groups(text, int, int) to authenticated;

-- 신고된 문항 상세: 문항 내용(관리자는 정답 포함), 신고 목록, 영향받은 응시·과제 수, 판정 이력, 대체 문항 큐.
create or replace function public.problem_error_report_detail(p_problem_id uuid, p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_prob problems%rowtype; v_ver problem_versions%rowtype; v_out jsonb;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select * into v_prob from problems where id = p_problem_id;
  select * into v_ver from problem_versions where id = p_version_id and problem_id = p_problem_id;
  if v_prob.id is null or v_ver.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
  v_out := jsonb_build_object(
    'problem', jsonb_build_object('id', v_prob.id, 'format', v_prob.format, 'satDomain', v_prob.sat_domain, 'skillCode', v_prob.skill_code,
      'usageScope', v_prob.usage_scope, 'archived', v_prob.archived_at is not null, 'archivedReason', v_prob.archived_reason,
      'reviewNeeded', v_prob.error_review_needed),
    'version', jsonb_build_object('id', v_ver.id, 'versionNo', v_ver.version_no, 'status', v_ver.status, 'passage', v_ver.passage, 'question', v_ver.question,
      'options', v_ver.options, 'correctIndex', v_ver.correct_index, 'answers', v_ver.answers, 'explanation', v_ver.explanation, 'difficulty', v_ver.difficulty),
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
      'sessionPending', (select count(*) from session_problem_work w where w.problem_id = p_problem_id and w.error_adjustment_pending)),
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
revoke execute on function public.problem_error_report_detail(uuid, uuid) from public, anon;
grant execute on function public.problem_error_report_detail(uuid, uuid) to authenticated;

-- 신고자 본인의 신고 진행 상태(정답·내부 메모 미포함).
create or replace function public.problem_error_report_mine(p_problem_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'problemId', r.problem_id, 'versionId', r.problem_version_id, 'reportType', r.report_type, 'createdAt', r.created_at,
    'status', case when r.resolved_verdict_id is null then 'reviewing'
                   when v.decision = 'not_error' then 'not_error' else 'confirmed' end
  ) order by r.created_at desc), '[]'::jsonb)
  from problem_error_reports r
  left join problem_error_verdicts v on v.id = r.resolved_verdict_id
  where r.reporter_id = auth.uid() and r.problem_id = any (p_problem_ids);
$$;
revoke execute on function public.problem_error_report_mine(uuid[]) from public, anon;
grant execute on function public.problem_error_report_mine(uuid[]) to authenticated;

-- 대체 문항 필요 요약(문항 풀 서브탭·문제은행 경고·세트 '문항 교체 필요' 표시) + 최근 자동 교체 이력.
create or replace function public.problem_replacement_need_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  return jsonb_build_object(
    'openTotal', (select count(*) from problem_replacement_needs where status = 'open'),
    'openInMockSet', (select count(*) from problem_replacement_needs where status = 'open' and in_mock_set),
    'autoReplacedTotal', (select count(*) from mock_exam_item_replacements),
    'cells', coalesce((
      select jsonb_agg(jsonb_build_object('satDomain', c.sat_domain, 'skillCode', c.skill_code, 'difficulty', c.difficulty,
        'moduleKey', c.module_key, 'usageScope', c.usage_scope, 'inMockSet', c.in_mock_set, 'openCount', c.n)
        order by c.n desc, c.sat_domain, c.skill_code)
      from (select sat_domain, skill_code, difficulty, module_key, usage_scope, in_mock_set, count(*) n
              from problem_replacement_needs where status = 'open' group by 1, 2, 3, 4, 5, 6) c), '[]'::jsonb),
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object('examSetId', x.exam_set_id, 'name', s.name, 'openCount', x.n, 'startedCount', x.n_started, 'noSpareCount', x.n_nospare)
        order by x.n desc)
      from (select exam_set_id, count(*) n, count(*) filter (where open_reason = 'set_started') n_started, count(*) filter (where open_reason = 'no_spare') n_nospare
              from problem_replacement_needs where status = 'open' and exam_set_id is not null group by exam_set_id) x
      join mock_exam_sets s on s.id = x.exam_set_id), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'problemId', n.problem_id, 'moduleKey', n.module_key, 'route', n.route, 'difficulty', n.difficulty,
        'satDomain', n.sat_domain, 'skillCode', n.skill_code, 'usageScope', n.usage_scope, 'inMockSet', n.in_mock_set,
        'openReason', n.open_reason, 'createdAt', n.created_at) order by n.created_at)
      from (select * from problem_replacement_needs where status = 'open' order by created_at limit 100) n), '[]'::jsonb),
    'replacements', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'examSetId', r.exam_set_id, 'examSetName', s.name, 'oldProblemId', r.old_problem_id,
        'newProblemId', r.new_problem_id, 'moduleKey', r.module_key, 'route', r.route, 'difficulty', r.difficulty, 'satDomain', r.sat_domain,
        'skillCode', r.skill_code, 'createdAt', r.created_at) order by r.created_at desc)
      from (select * from mock_exam_item_replacements order by created_at desc limit 50) r
      left join mock_exam_sets s on s.id = r.exam_set_id), '[]'::jsonb));
end $$;
revoke execute on function public.problem_replacement_need_summary() from public, anon;
grant execute on function public.problem_replacement_need_summary() to authenticated;

-- 열린 대체 문항 필요 항목에 대해 자동 교체를 다시 시도한다(여분 문항이 풀에 들어온 뒤). 멱등·동시성 안전(항목 단위 락).
create or replace function public.problem_replacement_retry_open() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_need uuid; v_res text; v_replaced int := 0; v_noSpare int := 0; v_started int := 0;
begin
  if not is_admin() then raise exception '관리자만 실행할 수 있습니다.'; end if;
  for v_need in select id from problem_replacement_needs where status = 'open' and in_mock_set order by created_at, id loop
    v_res := _problem_error_try_replace_need(v_need);
    if v_res = 'replaced' then v_replaced := v_replaced + 1;
    elsif v_res = 'no_spare' then v_noSpare := v_noSpare + 1;
    elsif v_res = 'set_started' then v_started := v_started + 1; end if;
  end loop;
  return jsonb_build_object('replaced', v_replaced, 'noSpare', v_noSpare, 'setStarted', v_started);
end $$;
revoke execute on function public.problem_replacement_retry_open() from public, anon;
grant execute on function public.problem_replacement_retry_open() to authenticated;

-- =========================================================================
-- 7. 결과·요약 읽기: 조정 채점 기준(원채점은 그대로 보존)
-- =========================================================================
alter function public.mock_exam_attempt_detail(uuid) rename to _mock_exam_attempt_detail_v3;
revoke execute on function public._mock_exam_attempt_detail_v3(uuid) from public, anon, authenticated;

create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_d jsonb; v_a mock_exam_attempts%rowtype; v_items jsonb; v_visible boolean; v_any boolean := false;
begin
  v_d := _mock_exam_attempt_detail_v3(p_attempt_id);
  if v_d is null then return null; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  v_visible := _mock_exam_results_visible(v_a.student_id, v_a.status);
  if not v_visible or not exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = p_attempt_id and x.superseded_at is null) then
    return v_d || jsonb_build_object('scoreAdjusted', false);
  end if;
  select coalesce(jsonb_agg(
           case when adj.id is null then t.it || jsonb_build_object('adjusted', false)
                else t.it || jsonb_build_object('adjusted', true, 'correct', adj.adjusted_correct, 'originalCorrect', adj.original_correct) end
           order by t.ord), '[]'::jsonb),
         coalesce(bool_or(adj.id is not null), false)
    into v_items, v_any
  from jsonb_array_elements(v_d->'items') with ordinality as t(it, ord)
  left join mock_exam_answer_adjustments adj
    on adj.attempt_id = p_attempt_id and adj.set_item_id = (t.it->>'setItemId')::uuid and adj.superseded_at is null;
  return v_d || jsonb_build_object('items', v_items, 'scoreAdjusted', v_any);
end $$;
revoke execute on function public.mock_exam_attempt_detail(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_detail(uuid) to authenticated, service_role;

-- 요약: correctCount 는 조정 채점 기준(20261918000001 본문 + 조정 반영·scoreAdjusted).
create or replace function public.mock_exam_attempt_summaries(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception '이 학생의 모의고사 기록을 볼 권한이 없습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'examSetId', a.exam_set_id, 'examSetName', s.name, 'difficultyTier', s.difficulty_tier,
      'studentId', a.student_id, 'studentName', pr.name, 'status', a.status,
      'assignedByName', ap.name,
      'dueAt', a.due_at, 'startBy', a.start_by, 'startedAt', a.started_at, 'submittedAt', a.submitted_at, 'gradedAt', a.graded_at,
      'entryCount', a.entry_count,
      'totalCount', _mock_exam_expected_item_count(a.exam_set_id),
      'correctCount', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then (select count(*) from mock_exam_answers ans
                 where ans.attempt_id = a.id and ans.correct = true
                   and not exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.set_item_id = ans.set_item_id and x.superseded_at is null))
             + (select count(*) from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.superseded_at is null and x.adjusted_correct)
        else null end,
      'scoreAdjusted', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.superseded_at is null)
        else false end
    ) order by a.created_at desc)
    from mock_exam_attempts a
    join mock_exam_sets s on s.id = a.exam_set_id
    left join profiles pr on pr.id = a.student_id
    left join profiles ap on ap.id = a.assigned_by
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_attempt_summaries(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_summaries(uuid) to authenticated, service_role;

-- =========================================================================
-- 8. 오류가 확정된 문항은 보관을 풀 수 없다 (문제은행 '보관 풀기'가 확정 판정을 조용히 무력화하지 않게).
--    가장 최근 판정이 '오류 아님'이면(= 재판정으로 번복) 풀 수 있다.
-- =========================================================================
create or replace function public._problems_error_confirmed_archive_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_decision text;
begin
  if old.archived_at is not null and new.archived_at is null then
    select decision into v_decision from problem_error_verdicts where problem_id = new.id order by decided_at desc, id desc limit 1;
    if v_decision is not null and v_decision <> 'not_error' then
      raise exception '오류가 확정된 문항은 보관을 풀 수 없습니다. 신고 탭에서 다시 판정(오류 아님)한 뒤에 풀 수 있습니다.';
    end if;
  end if;
  return new;
end $$;
create trigger problems_error_confirmed_archive_guard before update of archived_at on problems
  for each row execute function _problems_error_confirmed_archive_guard();
