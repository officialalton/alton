-- R9 corrective — Task 4가 놓친 "학생이 실제로 과제를 보고 답을 낼 수 있어야
-- 한다"는 요구사항을 채운다(제품 오너 리뷰로 확인된 진짜 공백).
--
-- Task 4(20261235000000)는 session_homework_items의 RLS를 Task 3
-- (session_content_use_events, 내부 교사 기록)과 동일한 "담당 선생님/관리자만"
-- 패턴으로 만들었다. 그 패턴은 Task 3에는 맞았지만(교사 내부 사용 기록이라 학생이
-- 볼 이유가 없음), 과제는 정의상 학생이 읽고 풀어야 하는 것이라 그대로 베끼면
-- 안 됐다 — 이 마이그레이션이 그 구멍을 메운다.
--
-- 이 파일이 하는 일:
--   1) session_homework_items에 "본인에게 배정된 과제" 학생 SELECT 정책 추가.
--   2) 새 v3 답안 테이블 session_homework_attempts — 기존 session_problem_attempts는
--      legacy_sessions를 참조하는 별개 테이블이라(20261235000000 헤더 주석과 동일한
--      사전 검토 결론) 재사용하지 않는다. session_homework_items(과제로 실제
--      발급된 단위)에 FK를 건다 — sessions에 직접 걸지 않는 이유는 "무엇이
--      배정됐는가"의 단위 자체가 homework_item이기 때문.
--   3) 학생이 배정된 문제만 조회할 수 있도록 problems에 SELECT 정책 추가(표시
--      시점 confirmed 재검증은 앱 레이어에서 한다 — Task 2의 manifest 리더와
--      동일한 정신: 행 자체는 숨기지 않고, 콘텐츠 표시만 게이트한다).

-- =========================================================================
-- 1. session_homework_items — 학생 본인 조회
-- =========================================================================

-- student_id는 발급 시점에 "누구에게 배정됐는가"를 그대로 담고 있다(과제 구성
-- 자체가 학생 단위로 이뤄짐 — 20261235000000 참고). 그래서 별도로
-- is_owning_student_for_enrollment(subject_enrollment_id)를 경유해 재확인할
-- 필요 없이 `student_id = auth.uid()` 직접 비교가 "본인 것만"을 정확히
-- 포착한다(students.id가 profiles.id = auth.uid()를 그대로 참조하므로 —
-- 20260827120000). 다른 학생의 student_id로는 이 비교가 절대 참이 될 수 없다.
create policy "학생 본인 과제 조회" on session_homework_items for select
  using (student_id = auth.uid());

-- =========================================================================
-- 2. session_homework_attempts — v3 과제 답안(초안/제출)
-- =========================================================================
--
-- 설계 결정: "학생당 과제 항목당 한 행, submitted=false인 동안 수정 가능,
-- submitted=true가 되면 잠김" — append-only 이벤트 로그(Task 2/3 패턴)가 아니라
-- mutable 단일 행을 택했다. 과제 답안은 "학생이 여러 번 고쳐 쓰다가 최종
-- 제출하는 초안"이라는 본질이 이벤트 로그와 다르다(Task 2/3은 "일어난 사실"의
-- 불변 기록이지만, 답안 초안 자체는 아직 사실이 아니라 진행 중인 입력이다).
-- unique(homework_item_id, student_id)로 "항목당 한 행"을 강제하고, submitted
-- 이후 UPDATE는 트리거로 무조건 거부한다(GUC bypass 없음 — 이 세션에서 이미
-- 세 차례 확인된 취약점 패턴을 다시 만들지 않는다. 90d7012/6f292cc/876b30a
-- 참고).
create table session_homework_attempts (
  id uuid primary key default gen_random_uuid(),
  homework_item_id uuid not null references session_homework_items (id) on delete cascade,
  student_id uuid not null references students (id),
  -- session_problem_attempts.response(jsonb, 20260827120000)와 동일한 형태를
  -- 그대로 빌린다 — FK로 묶지는 않지만(그 테이블은 legacy_sessions 전용) 응답
  -- 모양은 그쪽 선례를 따르는 게 합리적이다.
  response jsonb,
  -- session_problem_attempts.saved(boolean)의 정신을 잇되 이름을 submitted로
  -- 바꾼다 — "저장됨(saved)"과 "최종 제출됨(submitted)"은 이 v3 테이블에서는
  -- 서로 다른 상태다(초안 저장은 saved=true 없이도 그냥 UPDATE로 반영되고,
  -- submitted=true만 "더 이상 못 고침"을 의미하는 잠금 신호).
  submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (homework_item_id, student_id)
);
create index on session_homework_attempts (homework_item_id);
create index on session_homework_attempts (student_id);

comment on table session_homework_attempts is
  'R9 corrective: session_homework_items에 대한 v3 학생 답안(초안→제출). 기존
  session_problem_attempts는 legacy_sessions를 참조하는 별개 테이블이라(위 헤더
  주석) 재사용하지 않는다. 학생당 항목당 한 행, submitted=true가 되면
  트리거로 잠긴다(bypass 없음).';

-- updated_at 자동 갱신(다른 mutable 테이블과 동일한 관례가 있으면 재사용해야
-- 하나, 이 스키마엔 범용 updated_at 트리거가 없어 이 테이블 전용으로 하나
-- 둔다 — 새 "잠금" 메커니즘이 아니라 순수 갱신 편의 트리거).
create or replace function public.touch_session_homework_attempt_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger session_homework_attempts_touch_updated_at
  before update on session_homework_attempts
  for each row execute function public.touch_session_homework_attempt_updated_at();

-- 2a) 발급 대상 검증 — new.student_id가 실제로 그 homework_item에 배정된
-- 학생과 일치하는지 DB 레벨에서 강제한다. RLS WITH CHECK로도 같은 걸 걸지만,
-- check_homework_item_problem_confirmed()와 동일한 이유로 독립 트리거를 둔다:
-- "이 답안이 배정된 과제에 대한 것인가"는 가시성이 아니라 순수한 무결성
-- 검사이므로 SECURITY DEFINER로 실제 상태를 정확히 봐야 한다(RLS를 통과한
-- 값을 다시 믿지 않는다).
create or replace function public.check_homework_attempt_assigned_to_student()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assigned_student_id uuid;
begin
  select student_id into v_assigned_student_id
  from session_homework_items where id = new.homework_item_id;
  if v_assigned_student_id is null then
    raise exception '존재하지 않는 과제 항목입니다: %', new.homework_item_id;
  end if;
  if v_assigned_student_id <> new.student_id then
    raise exception '본인에게 배정되지 않은 과제에는 답안을 작성할 수 없습니다: %', new.homework_item_id;
  end if;
  return new;
end;
$$;

create trigger session_homework_attempts_check_assigned
  before insert or update of homework_item_id, student_id on session_homework_attempts
  for each row execute function public.check_homework_attempt_assigned_to_student();

comment on function public.check_homework_attempt_assigned_to_student() is
  'R9 corrective: session_homework_attempts의 student_id가 실제 homework_item의
  배정 학생과 일치하는지 INSERT/UPDATE 시점에 강제 — RLS WITH CHECK와 별개의
  우회 불가능한 방어선.';

-- 2b) submitted 이후 잠금 — append-only 이벤트 테이블과 동일한 무조건 거부
-- 방식(설정 가능한 bypass 없음). submitted=false → true 전이 자체는 허용해야
-- 하므로, "old.submitted가 이미 true였는가"만 본다.
create or replace function public.prevent_homework_attempt_update_after_submit()
returns trigger
language plpgsql as $$
begin
  if old.submitted then
    raise exception '제출된 과제 답안은 더 이상 수정할 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger session_homework_attempts_lock_after_submit
  before update on session_homework_attempts
  for each row execute function public.prevent_homework_attempt_update_after_submit();

comment on function public.prevent_homework_attempt_update_after_submit() is
  'R9 corrective: submitted=true인 session_homework_attempts 행은 어떤 역할로도
  더 이상 수정할 수 없다 — 설정 가능한 우회(app.bypass_*류)는 이 세션에서 이미
  세 차례 발견/제거된 안티패턴이라 다시 두지 않는다(90d7012/6f292cc/876b30a).
  트리거 실행 순서는 이름순이라 lock 트리거(session_homework_attempts_lock_after_submit)가
  touch_updated_at보다 먼저 실행되어, 잠긴 행은 updated_at조차 갱신되지 않고
  즉시 거부된다.';

-- =========================================================================
-- 3. RLS — session_homework_attempts
-- =========================================================================

alter table session_homework_attempts enable row level security;

-- 조회: 본인 학생, 그 과제 항목이 속한 세션의 담당 선생님, 관리자.
create policy "본인 학생/담당 선생님/관리자 조회" on session_homework_attempts for select
  using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from session_homework_items shi
      where shi.id = homework_item_id and is_session_teacher_v3(shi.session_id)
    )
  );

-- 생성: 본인 학생만, 그것도 실제 본인에게 배정된 항목에 대해서만(WITH CHECK +
-- 위 2a 트리거의 이중 방어). 선생님/관리자에게는 쓰기 권한을 주지 않는다 —
-- "선생님이 학생 답안을 대신 쓰거나 고칠 수 있어야 한다"는 요구를 이 계획서
-- 어디에서도 찾지 못했고(student-curriculum-actions.ts류 어디에도 이런
-- 선례 없음), 지금 만들면 학생 답안 위조 경로가 되므로 넣지 않는다(과잉
-- 설계 금지 — 필요해지면 별도 승인 후 추가).
create policy "본인 학생만 생성" on session_homework_attempts for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from session_homework_items shi
      where shi.id = homework_item_id and shi.student_id = auth.uid()
    )
  );

-- 수정: 본인 학생만, 그리고 아직 제출 전인 행만(USING). submitted=true인 행은
-- USING에서 이미 걸러지므로 UPDATE 자체가 0행에 적용되고, 위 2b 트리거가
-- 명시적인 에러 메시지로 이중 거부한다(둘 중 하나만으로도 막히지만, 명확한
-- 에러가 필요해 트리거를 남긴다).
create policy "본인 학생만, 제출 전에만 수정" on session_homework_attempts for update
  using (student_id = auth.uid() and submitted = false)
  with check (student_id = auth.uid());

revoke all on session_homework_attempts from public, anon;
grant select, insert, update on session_homework_attempts to authenticated;

-- =========================================================================
-- 4. problems — 본인에게 과제로 배정된 문제는 학생도 조회 가능
-- =========================================================================
--
-- 기존 "문제 조회"(20260828060000) 정책은 origin_session_id 경유(레거시
-- 세션 개념, is_session_related) 또는 section_id가 published 교재에 속한
-- 경우만 커버한다 — session_homework_items로 배정된 문제가 반드시 그 두
-- 경로 중 하나에 해당한다는 보장이 없으므로(예: 세션에서 즉석으로 만든
-- section_id/origin_session_id 없는 confirmed 문제), 배정 사실 자체를 근거로
-- 하는 별도 SELECT 정책을 추가한다. status는 여기서 필터링하지 않는다 —
-- "이 행이 보이는가"(RLS)와 "콘텐츠를 표시할 것인가"(status='confirmed'
-- 재검증)는 Task 2 manifest 리더와 동일하게 분리한다: 앱 레이어
-- (student-homework-v3-data.ts)가 status를 읽어 confirmed가 아니면 콘텐츠를
-- 숨기고, 그 재검증 자체를 위해서도 행을 읽을 수 있어야 한다.
create policy "본인에게 과제로 배정된 문제는 학생도 조회" on problems for select
  using (
    exists (
      select 1 from session_homework_items shi
      where shi.problem_id = problems.id and shi.student_id = auth.uid()
    )
  );
