-- 2026-09-21 — 기획자 코드 리뷰 P1 2건 + UAT 지적 1건.
--
--  A) 결제 성공 → 수업권 원장이 원자적이지 않았다(lib/entitlements.ts): grant INSERT 뒤 ledger INSERT 가
--     별도 쿼리라 중간 실패 시 "grant 는 있는데 ledger 가 없어 잔액 0" 상태가 영구화됐고, 재시도는 기존
--     grant 만 보고 조기 종료했다. 한 트랜잭션 RPC 로 묶고, 이미 grant 만 있는 상태도 ledger 를 채워 치유한다.
--     동시 웹훅 경합으로 grant 가 두 번 만들어지는 것도 purchase_id_ref 유니크 인덱스로 막는다.
--  B) 모의고사 교사 권한이 legacy `enrollments` 만 봐서, v3 매칭(teacher_assignments/subject_enrollments)
--     으로 담당 중인 학생이 배정 대상에 안 나오고(RLS insert 거절) 목록에도 안 보였다 — 다른 모든 교사
--     권한 함수와 같은 teaches_student() 기준으로 통일한다.

-- =========================================================================
-- A) 수업권 grant + ledger 원자화
-- =========================================================================
-- 유니크 인덱스를 걸기 전에, 과거 경합으로 같은 purchase 에 두 번 만들어진 grant 가 있으면 가장 먼저
-- 만들어진 것만 연결을 남기고 나머지의 purchase_id_ref 를 비운다(grant 행·ledger·잔액은 그대로 —
-- 연결 표시만 떼어 낸다. 비프로덕션 테스트 데이터에서 1건 확인됨, 2026-09-21).
update entitlement_grants g
set purchase_id_ref = null
where purchase_id_ref is not null
  and exists (
    select 1 from entitlement_grants g2
    where g2.purchase_id_ref = g.purchase_id_ref
      and (g2.created_at < g.created_at or (g2.created_at = g.created_at and g2.id < g.id))
  );

create unique index if not exists entitlement_grants_purchase_id_ref_uq
  on entitlement_grants (purchase_id_ref) where purchase_id_ref is not null;

create or replace function public.create_entitlement_grant_for_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_grant_id uuid; v_created boolean := false; v_p purchases%rowtype; v_event text;
begin
  if p_purchase_id is null then raise exception '구매 id 가 필요합니다.'; end if;
  v_event := 'purchase:' || p_purchase_id::text;

  select id into v_grant_id from entitlement_grants where purchase_id_ref = p_purchase_id limit 1;
  if v_grant_id is null then
    select * into v_p from purchases where id = p_purchase_id;
    if v_p.id is null then raise exception '구매 내역을 찾을 수 없습니다: %', p_purchase_id; end if;
    insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
    values (v_p.child_id, v_p.entitlement_product_id, v_p.id, v_p.quantity, now() + make_interval(months => v_p.validity_months), true)
    on conflict (purchase_id_ref) where purchase_id_ref is not null do nothing
    returning id into v_grant_id;
    if v_grant_id is null then
      -- 동시 요청이 먼저 만들었다 — 그 grant 를 쓴다.
      select id into v_grant_id from entitlement_grants where purchase_id_ref = p_purchase_id limit 1;
    else
      v_created := true;
    end if;
  end if;

  -- grant-type ledger 행. 이미 있으면(dedup 인덱스 기준) 건너뛴다 — grant 만 있고 ledger 가 빠진
  -- 과거 상태도 이 호출로 치유된다.
  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  select v_grant_id, 'grant'::v3_entitlement_event_type, g.original_quantity, v_event
  from entitlement_grants g
  where g.id = v_grant_id
    and not exists (
      select 1 from entitlement_ledger l
      where l.grant_id = v_grant_id and l.event_type = 'grant'::v3_entitlement_event_type and l.business_event_id = v_event
    );

  return jsonb_build_object('grantId', v_grant_id, 'created', v_created);
end $$;
revoke execute on function public.create_entitlement_grant_for_purchase(uuid) from public, anon, authenticated;
grant execute on function public.create_entitlement_grant_for_purchase(uuid) to service_role;

-- =========================================================================
-- B) 모의고사 교사 권한 — teaches_student() 로 통일(legacy enrollments + v3 teacher_assignments)
-- =========================================================================
drop policy if exists "응시 기록 담당 교사 배정" on mock_exam_attempts;
create policy "응시 기록 담당 교사 배정" on mock_exam_attempts for insert to authenticated
  with check (teaches_student(student_id));

drop policy if exists "응시 기록 담당 교사 배정 갱신" on mock_exam_attempts;
create policy "응시 기록 담당 교사 배정 갱신" on mock_exam_attempts for update to authenticated
  using (teaches_student(student_id)) with check (teaches_student(student_id));

drop policy if exists "응시 기록 담당 교사 조회" on mock_exam_attempts;
create policy "응시 기록 담당 교사 조회" on mock_exam_attempts for select to authenticated
  using (teaches_student(student_id));

drop policy if exists "답안 담당 교사 조회" on mock_exam_answers;
create policy "답안 담당 교사 조회" on mock_exam_answers for select to authenticated
  using (exists (
    select 1 from mock_exam_attempts a
    where a.id = mock_exam_answers.attempt_id and teaches_student(a.student_id)
  ));

-- =========================================================================
-- C) 수업 문제 풀이판(start_problem_work) — 끝난 수업·배정되지 않은 문제에는 답안을 만들 수 없다
--    (기획자 리뷰 Spec P1). 예전엔 세션 상태를 보지 않았고, 문제가 manifest/과제 발급본에 없으면
--    "현재 공개본"으로 폴백해 풀이판을 만들어 줬다 — 완료 수업 기록과 성취 통계를 오염시킬 수 있었다.
--    이제 (1) final_status 가 scheduled/live 인 수업에서만, (2) lesson 은 session_content_manifest 에,
--    homework 는 session_homework_items 에 실제로 들어 있는 문제만 풀이판을 만든다(폴백 제거).
-- =========================================================================
create or replace function public.start_problem_work(
  p_session_id uuid,
  p_student_id uuid,
  p_problem_id uuid,
  p_new_attempt boolean default false,
  p_source text default 'lesson'
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_existing session_problem_work%rowtype;
  v_next int;
  v_version_id uuid;
  v_id uuid;
  v_status text;
  v_assigned boolean;
begin
  if p_source not in ('lesson', 'homework') then
    raise exception '풀이판 출처는 lesson 또는 homework 입니다: %', p_source;
  end if;
  select final_status into v_status from sessions where id = p_session_id;
  if v_status is null then
    raise exception '존재하지 않는 수업입니다.';
  end if;
  if v_status not in ('scheduled', 'live') then
    raise exception '이미 끝난 수업에는 답안을 만들 수 없습니다.';
  end if;

  if p_source = 'homework' then
    select exists (
      select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = p_problem_id
    ) into v_assigned;
    if not v_assigned then raise exception '이 수업의 과제로 발급된 문제가 아닙니다.'; end if;
  else
    select exists (
      select 1 from session_content_manifest m
      where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = p_problem_id
    ) into v_assigned;
    if not v_assigned then raise exception '이 수업에 배정된 문제가 아닙니다.'; end if;
  end if;

  select * into v_existing from session_problem_work
    where session_id = p_session_id and student_id = p_student_id and problem_id = p_problem_id and source = p_source
    order by attempt_no desc limit 1;
  if found and not p_new_attempt then
    return v_existing.id;
  end if;
  v_next := coalesce(v_existing.attempt_no, 0) + 1;
  -- 버전: 과제면 발급본, 수업이면 고정본. 그 행에 버전이 비어 있는 경우만 현재 공개본을 쓴다.
  if p_source = 'homework' then
    select coalesce(
      (select h.problem_version_id from session_homework_items h
        where h.session_id = p_session_id and h.problem_id = p_problem_id and h.problem_version_id is not null limit 1),
      (select p.published_version_id from problems p where p.id = p_problem_id)
    ) into v_version_id;
  else
    select coalesce(
      (select m.problem_version_id from session_content_manifest m
        where m.session_id = p_session_id and m.content_id = p_problem_id and m.problem_version_id is not null limit 1),
      (select p.published_version_id from problems p where p.id = p_problem_id)
    ) into v_version_id;
  end if;
  insert into session_problem_work (session_id, student_id, problem_id, problem_version_id, attempt_no, source)
  values (p_session_id, p_student_id, p_problem_id, v_version_id, v_next, p_source)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.start_problem_work(uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.start_problem_work(uuid, uuid, uuid, boolean, text) to service_role;
