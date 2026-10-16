-- 학생 통계 탭 확장 — 단일 집계 RPC (2026-09-30).
-- 통계 탭을 열 때 화면이 쿼리 여러 개를 날리지 않도록 지표 원천 집계를 한 번의 정의자 함수로 모은다.
--  * service_role 전용: 호출 전에 서버가 assertCanViewStudent(또는 학생 본인 확인)로 권한을 판정한다.
--    함수 안에서도 service_role 이 아니면 거절한다(authenticated·anon 에는 EXECUTE 를 주지 않는다).
--  * session_problem_work.auto_correct·mock_exam_attempt_modules.raw_correct_count 컬럼 권한 구조는 그대로 —
--    정의자 함수가 읽지만 돌려주는 것은 집계 수치뿐이다(문항·정답 ID 없음).
--  * 정오 집계는 교사가 채점 확정(graded_at / graded=true)한 응답만 센다 — 채점 전 정오가 새지 않는다.
--  * 모의고사 경로(route)는 예상 점수 범위 계산 입력으로만 서버(service_role)에 돌려준다. TS 가 범위로 바꾸고 버린다.
-- 기존 마이그레이션은 수정하지 않는다(추가만, 재실행 안전).

create index if not exists session_problem_work_student_submitted_idx
  on public.session_problem_work (student_id, submitted_at desc) where submitted_at is not null;
create index if not exists vocab_words_student_created_idx
  on public.vocab_words (student_id, created_at desc);

-- 채점 확정된 skill 단위 정오 이벤트(수업 과제 work + 독립 과제 배치 항목).
create or replace function public._stat_skill_events(p_student_id uuid)
returns table (at timestamptz, skill_code text, correct boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(w.graded_at, w.submitted_at), p.skill_code, (w.grade = 'correct')
  from session_problem_work w join problems p on p.id = w.problem_id
  where w.student_id = p_student_id and w.submitted_at is not null and w.graded_at is not null
    and w.grade is not null and p.skill_code is not null
  union all
  select coalesce(nullif(it->>'gradedAt', '')::timestamptz, nullif(it->>'submittedAt', '')::timestamptz),
         p.skill_code, (it->>'grade') = 'correct'
  from homework_batches b
  cross join lateral jsonb_array_elements(case when jsonb_typeof(b.items) = 'array' then b.items else '[]'::jsonb end) it
  join problems p on p.id = nullif(it->>'problemId', '')::uuid
  where b.student_id = p_student_id
    and coalesce((it->>'graded')::boolean, false) and nullif(it->>'submittedAt', '') is not null
    and (it->>'grade') in ('correct', 'incorrect') and p.skill_code is not null;
$$;

-- 독립 과제 배치 항목 단위 행.
create or replace function public._stat_homework_items(p_student_id uuid)
returns table (batch_id uuid, created_at timestamptz, due_at timestamptz, submitted_at timestamptz,
               graded boolean, graded_at timestamptz, grade text)
language sql stable security definer set search_path = public as $$
  select b.id, b.created_at, b.due_at,
         nullif(it->>'submittedAt', '')::timestamptz,
         coalesce((it->>'graded')::boolean, false),
         nullif(it->>'gradedAt', '')::timestamptz,
         it->>'grade'
  from homework_batches b
  cross join lateral jsonb_array_elements(case when jsonb_typeof(b.items) = 'array' then b.items else '[]'::jsonb end) it
  where b.student_id = p_student_id;
$$;

create or replace function public.student_stats_aggregate(p_student_id uuid, p_include_staff boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'Asia/Seoul';
  v_now timestamptz := now();
  v_week0 date := (date_trunc('week', now() at time zone 'Asia/Seoul') - interval '11 weeks')::date;
  v_month0 date := (date_trunc('month', now() at time zone 'Asia/Seoul') - interval '5 months')::date;
  v_skills jsonb; v_skill_weekly jsonb; v_ent jsonb; v_mock jsonb; v_hw jsonb; v_overdue jsonb;
  v_habits jsonb; v_vocab jsonb; v_ops jsonb; v_staff jsonb := null;
begin
  if not _is_service_role() then
    raise exception '통계 집계는 서버에서만 호출할 수 있습니다.' using errcode = '42501';
  end if;
  if p_student_id is null then return null; end if;

  -- 1) skill 정답률(전체·최근 4주·그 이전) + 주별 전체 정답률
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', e.skill_code, 'label', coalesce(c.label, e.skill_code), 'domain', c.domain,
      'total', e.total, 'correct', e.correct,
      'recentTotal', e.r_total, 'recentCorrect', e.r_correct,
      'priorTotal', e.p_total, 'priorCorrect', e.p_correct) order by e.skill_code), '[]'::jsonb)
  into v_skills
  from (
    select skill_code, count(*) total, count(*) filter (where correct) correct,
      count(*) filter (where at >= v_now - interval '28 days') r_total,
      count(*) filter (where at >= v_now - interval '28 days' and correct) r_correct,
      count(*) filter (where at < v_now - interval '28 days') p_total,
      count(*) filter (where at < v_now - interval '28 days' and correct) p_correct
    from _stat_skill_events(p_student_id) group by skill_code
  ) e left join problem_skill_codes c on c.code = e.skill_code;

  select coalesce(jsonb_agg(jsonb_build_object('week', to_char(w.d, 'YYYY-MM-DD'),
           'total', coalesce(x.total, 0), 'correct', coalesce(x.correct, 0)) order by w.d), '[]'::jsonb)
  into v_skill_weekly
  from (select (v_week0 + i * 7) from generate_series(0, 11) i) w(d)
  left join (
    select date_trunc('week', at at time zone v_tz)::date wk, count(*) total, count(*) filter (where correct) correct
    from _stat_skill_events(p_student_id) group by 1
  ) x on x.wk = w.d;

  -- 2) 수업권 잔여·만료 임박(14일)
  select jsonb_build_object(
    'remaining', coalesce(sum(remaining), 0),
    'expiringSoon', coalesce(sum(remaining) filter (where expires_at <= v_now + interval '14 days'), 0),
    'nextExpiresAt', min(expires_at),
    'groups', coalesce(jsonb_agg(jsonb_build_object('label', label, 'remaining', remaining, 'expiresAt', next_exp, 'isPaid', is_paid)
                                order by next_exp nulls last, label), '[]'::jsonb))
  into v_ent
  from (
    select lesson_type_label label, is_paid, sum(remaining) remaining, min(expires_at) next_exp, min(expires_at) expires_at
    from entitlement_grant_details d
    where d.child_id = p_student_id and d.remaining > 0 and (d.expires_at is null or d.expires_at > v_now)
    group by lesson_type_label, is_paid
  ) g;

  -- 3) 모의고사: 채점 완료 응시(최근 12회)별 섹션·영역 집계 + 경로(서버 계산용)
  select coalesce(jsonb_agg(jsonb_build_object(
      'attemptId', m.id, 'gradedAt', m.graded_at, 'format', m.fmt, 'label', m.detail->>'examSetName',
      'rwRoute', m.rw_route, 'mathRoute', m.math_route,
      'sections', (select coalesce(jsonb_agg(jsonb_build_object('section', x.section, 'total', x.total, 'correct', x.correct)), '[]'::jsonb)
                   from (select it->>'section' section, count(*) total, count(*) filter (where (it->>'correct')::boolean) correct
                         from jsonb_array_elements(m.detail->'items') it group by 1) x),
      'domains', (select coalesce(jsonb_agg(jsonb_build_object('domain', x.domain, 'total', x.total, 'correct', x.correct)), '[]'::jsonb)
                   from (select it->>'satDomain' domain, count(*) total, count(*) filter (where (it->>'correct')::boolean) correct
                         from jsonb_array_elements(m.detail->'items') it where it->>'correct' is not null group by 1) x)
    ) order by m.graded_at), '[]'::jsonb)
  into v_mock
  from (
    select a.id, a.graded_at, coalesce(s.format, 'fixed') fmt, a.rw_m2_route::text rw_route, a.math_m2_route::text math_route,
           mock_exam_attempt_detail(a.id) detail
    from (select * from mock_exam_attempts where student_id = p_student_id and status = 'graded' and graded_at is not null
          order by graded_at desc limit 12) a
    join mock_exam_sets s on s.id = a.exam_set_id
  ) m;

  -- 4) 과제: 전체 + 주별(배정 주 기준)
  select jsonb_build_object(
    'assigned', count(*), 'submitted', count(submitted_at),
    'onTime', count(*) filter (where submitted_at is not null and (due_at is null or submitted_at <= due_at)),
    'graded', count(*) filter (where graded and grade in ('correct', 'incorrect')),
    'correct', count(*) filter (where graded and grade = 'correct'),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object('week', to_char(w.d, 'YYYY-MM-DD'),
                 'assigned', coalesce(x.assigned, 0), 'submitted', coalesce(x.submitted, 0),
                 'graded', coalesce(x.graded, 0), 'correct', coalesce(x.correct, 0)) order by w.d), '[]'::jsonb)
               from (select (v_week0 + i * 7) from generate_series(0, 11) i) w(d)
               left join (
                 select date_trunc('week', created_at at time zone v_tz)::date wk, count(*) assigned, count(submitted_at) submitted,
                        count(*) filter (where graded and grade in ('correct', 'incorrect')) graded,
                        count(*) filter (where graded and grade = 'correct') correct
                 from _stat_homework_items(p_student_id) group by 1) x on x.wk = w.d)
  ) into v_hw
  from _stat_homework_items(p_student_id);

  -- 보드 기한 초과(마감이 지났고 아직 끝나지 않은 카드)
  select jsonb_build_object(
    'homework', (select count(*) from (select batch_id from _stat_homework_items(p_student_id)
                   where due_at < v_now and submitted_at is null group by batch_id) z),
    'vocabQuiz', (select count(*) from vocab_quizzes where owner_id = p_student_id and due_at < v_now
                   and submitted_at is null and status is distinct from 'completed'),
    'mockExam', (select count(*) from mock_exam_attempts where student_id = p_student_id and due_at < v_now
                   and status in ('assigned', 'in_progress')),
    'manual', (select count(*) from board_manual_tasks where student_id = p_student_id and due_at < v_now and status <> 'done'))
  into v_overdue;

  -- 5) 학습 습관: 주별 활동량 + 단어 시험 성적
  select coalesce(jsonb_agg(jsonb_build_object('week', to_char(w.d, 'YYYY-MM-DD'),
           'homework', coalesce(h.n, 0) + coalesce(l.n_hw, 0), 'lesson', coalesce(l.n_lesson, 0), 'vocab', coalesce(v.n, 0)) order by w.d), '[]'::jsonb)
  into v_habits
  from (select (v_week0 + i * 7) from generate_series(0, 11) i) w(d)
  left join (select date_trunc('week', submitted_at at time zone v_tz)::date wk, count(*) n
             from _stat_homework_items(p_student_id) where submitted_at is not null group by 1) h on h.wk = w.d
  left join (select date_trunc('week', submitted_at at time zone v_tz)::date wk,
                    count(*) filter (where source = 'lesson') n_lesson, count(*) filter (where source = 'homework') n_hw
             from session_problem_work where student_id = p_student_id and submitted_at >= v_week0 group by 1) l on l.wk = w.d
  left join (select date_trunc('week', created_at at time zone v_tz)::date wk, count(*) n
             from vocab_words where student_id = p_student_id and created_at >= v_week0 group by 1) v on v.wk = w.d;

  select coalesce(jsonb_agg(jsonb_build_object('at', q.submitted_at, 'score', q.score, 'total', q.total) order by q.submitted_at), '[]'::jsonb)
  into v_vocab
  from (select submitted_at, score, total from vocab_quizzes
        where owner_id = p_student_id and submitted_at is not null and total > 0 and score is not null
        order by submitted_at desc limit 12) q;

  -- 6) 수업 운영: 최근 6개월 월별(시간대 Asia/Seoul)
  select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m.d, 'YYYY-MM'),
           'completed', coalesce(s.completed, 0), 'noShow', coalesce(s.no_show, 0), 'late', coalesce(s.late, 0),
           'cancelled', coalesce(c.cancelled, 0), 'lateCancel', coalesce(c.late_cancel, 0)) order by m.d), '[]'::jsonb)
  into v_ops
  from (select (v_month0 + (i * interval '1 month'))::date from generate_series(0, 5) i) m(d)
  left join (
    select date_trunc('month', r.starts_at at time zone v_tz)::date mo,
           count(*) filter (where s.final_status = 'completed') completed,
           count(*) filter (where s.final_status = 'student_no_show') no_show,
           count(*) filter (where s.final_status = 'completed' and coalesce(s.late_start_minutes, 0) > 0) late
    from sessions s join reservations r on r.id = s.reservation_id
    join subject_enrollments se on se.id = s.subject_enrollment_id
    where se.child_id = p_student_id group by 1) s on s.mo = m.d::date
  left join (
    select date_trunc('month', x.starts_at at time zone v_tz)::date mo, count(*) cancelled,
           count(*) filter (where x.late) late_cancel
    from (
      select r.id, r.starts_at, bool_or(rc.entitlement_disposition = 'consumed') late
      from reservation_cancellations rc join reservations r on r.id = rc.reservation_id
      join subject_enrollments se on se.id = r.subject_enrollment_id
      where se.child_id = p_student_id and rc.cancelled_by_role = 'student' group by r.id, r.starts_at
      union all
      select r.id, r.starts_at, false
      from sessions s join reservations r on r.id = s.reservation_id
      join subject_enrollments se on se.id = s.subject_enrollment_id
      where se.child_id = p_student_id and s.final_status = 'student_cancelled'
        and not exists (select 1 from reservation_cancellations rc where rc.reservation_id = r.id)
    ) x group by 1) c on c.mo = m.d::date;

  -- 7) 관리자 전용: 선생님 수업 리뷰 작성 현황·과제 채점 지연(최근 90일)
  if p_include_staff then
    select jsonb_build_object(
      'reviewsByTeacher', (select coalesce(jsonb_agg(jsonb_build_object(
            'teacherId', t.teacher_id, 'teacherName', t.name, 'sessions', t.sessions, 'finalized', t.finalized,
            'draft', t.draft, 'missing', t.sessions - t.finalized - t.draft, 'avgHoursToFinalize', t.avg_hours) order by t.name), '[]'::jsonb)
          from (
            select s.teacher_id, pr.name, count(*) sessions,
                   count(*) filter (where lr.status = 'final') finalized,
                   count(*) filter (where lr.status = 'draft') draft,
                   round((avg(extract(epoch from (lr.finalized_at - s.actual_end_at)) / 3600.0)
                          filter (where lr.status = 'final' and lr.finalized_at >= s.actual_end_at))::numeric, 1) avg_hours
            from sessions s join subject_enrollments se on se.id = s.subject_enrollment_id
            left join lesson_reviews lr on lr.regular_session_id = s.id
            left join profiles pr on pr.id = s.teacher_id
            where se.child_id = p_student_id and s.final_status = 'completed' and s.actual_end_at >= v_now - interval '90 days'
            group by s.teacher_id, pr.name) t),
      'grading', (select jsonb_build_object(
            'pending', count(*) filter (where done_at is null),
            'oldestPendingAt', min(sub_at) filter (where done_at is null),
            'avgHoursToGrade', round((avg(extract(epoch from (done_at - sub_at)) / 3600.0)
                                     filter (where done_at is not null and done_at >= sub_at and done_at >= v_now - interval '90 days'))::numeric, 1))
          from (
            select submitted_at sub_at, graded_at done_at from session_problem_work
              where student_id = p_student_id and submitted_at is not null
            union all
            select submitted_at, case when graded then coalesce(graded_at, submitted_at) end
              from _stat_homework_items(p_student_id) where submitted_at is not null
          ) g))
    into v_staff;
  end if;

  return jsonb_build_object(
    'generatedAt', v_now, 'skills', v_skills, 'skillWeekly', v_skill_weekly, 'entitlements', v_ent, 'mock', v_mock,
    'homework', v_hw, 'overdue', v_overdue, 'habits', v_habits, 'vocabQuizzes', v_vocab, 'ops', v_ops, 'staff', v_staff);
end $$;

revoke all on function public._stat_skill_events(uuid), public._stat_homework_items(uuid),
  public.student_stats_aggregate(uuid, boolean) from public, anon, authenticated;
grant execute on function public.student_stats_aggregate(uuid, boolean) to service_role;
grant execute on function public._stat_skill_events(uuid), public._stat_homework_items(uuid) to service_role;
