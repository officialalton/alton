import type { SupabaseClient } from "@supabase/supabase-js";

// R9 corrective — v3 과제(session_homework_items, 20261235000000/20261240000000)
// 학생 조회 리더. 기존 app/student/homework-data.ts(legacy homework_items,
// legacy_sessions 경유)와는 완전히 별개의 테이블/경로다 — 절대 합치지 않는다
// (계획서가 명시적으로 구분하라고 요구).
//
// session-content-data.ts(Task 2)와 동일한 "표시 시점 재검증" 정신: 과제로
// 배정된 시점엔 confirmed였던 문제가 이후 unconfirmed가 됐을 수 있으므로,
// 여기서 problems.status를 다시 읽어 confirmed가 아니면 콘텐츠를 숨긴다(항목
// 행 자체, 즉 "배정됐다"는 사실은 계속 보여준다 — 숨김은 콘텐츠에만 적용).

export type StudentHomeworkV3Item = {
  id: string;
  sessionId: string;
  problemId: string;
  position: number;
  composedAt: string;
  contentVisible: boolean;
  problem: {
    passage: string | null;
    options: unknown;
    format: string;
  } | null;
  attempt: {
    id: string;
    response: unknown;
    submitted: boolean;
  } | null;
};

export async function loadStudentHomeworkV3(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentHomeworkV3Item[]> {
  const { data: items, error } = await supabase
    .from("session_homework_items")
    .select("id, session_id, problem_id, position, composed_at")
    .eq("student_id", studentId)
    .order("composed_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return [];

  const problemIds = items.map((i) => i.problem_id as string);
  const { data: problems, error: problemsError } = await supabase
    .from("problems")
    .select("id, status, format, passage, options")
    .in("id", problemIds);
  if (problemsError) throw new Error(problemsError.message);
  const problemById = new Map((problems ?? []).map((p) => [p.id as string, p]));

  const itemIds = items.map((i) => i.id as string);
  const { data: attempts, error: attemptsError } = await supabase
    .from("session_homework_attempts")
    .select("id, homework_item_id, response, submitted")
    .in("homework_item_id", itemIds)
    .eq("student_id", studentId);
  if (attemptsError) throw new Error(attemptsError.message);
  const attemptByItemId = new Map(
    (attempts ?? []).map((a) => [a.homework_item_id as string, a])
  );

  return items.map((item) => {
    const problem = problemById.get(item.problem_id as string);
    // 표시 시점 재검증: 발급 당시 confirmed였어도 지금 아니면 콘텐츠를 숨긴다.
    const contentVisible = !!problem && problem.status === "confirmed";
    const attempt = attemptByItemId.get(item.id as string);
    return {
      id: item.id as string,
      sessionId: item.session_id as string,
      problemId: item.problem_id as string,
      position: item.position as number,
      composedAt: item.composed_at as string,
      contentVisible,
      problem: contentVisible
        ? {
            passage: (problem!.passage as string | null) ?? null,
            options: problem!.options ?? null,
            format: problem!.format as string,
          }
        : null,
      attempt: attempt
        ? {
            id: attempt.id as string,
            response: attempt.response ?? null,
            submitted: attempt.submitted as boolean,
          }
        : null,
    };
  });
}


// 2026-09-14 과제 v3 통일 — 학생 포털은 회차별 과제 묶음만 보여주고, 풀이는 그 수업 화면의 과제 탭에서 한다.
export type StudentHomeworkSet = {
  sessionId: string;
  subjectName: string;
  /** 수업 예정/진행 시각 — 없으면 null. */
  startsAt: string | null;
  total: number;
  answered: number;
  graded: number;
  /** 가장 최근 발급 시각. */
  composedAt: string;
};

export async function loadStudentHomeworkSets(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentHomeworkSet[]> {
  const { data: items } = await supabase
    .from("session_homework_items")
    .select("session_id, problem_id, composed_at")
    .eq("student_id", studentId)
    .order("composed_at", { ascending: false });
  if (!items?.length) return [];

  const sessionIds = Array.from(new Set(items.map((i) => i.session_id as string)));
  const [{ data: sessions }, { data: work }] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, reservation:reservations!sessions_reservation_id_fkey(starts_at), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name))"
      )
      .in("id", sessionIds),
    supabase
      .from("session_problem_work")
      .select("session_id, problem_id, submitted_at, graded_at")
      .eq("student_id", studentId)
      .eq("source", "homework")
      .in("session_id", sessionIds),
  ]);
  const one = (rel: unknown) => (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | null | undefined;
  const sessionById = new Map(
    (sessions ?? []).map((s) => {
      const enrollment = one(s.subject_enrollment);
      const subject = one(enrollment?.subject);
      return [
        s.id as string,
        {
          startsAt: ((one(s.reservation)?.starts_at as string | undefined) ?? null) as string | null,
          subjectName: ((subject?.name as string | undefined) ?? "") as string,
        },
      ];
    })
  );
  const workKey = (sessionId: string, problemId: string) => `${sessionId}:${problemId}`;
  const answered = new Set<string>();
  const graded = new Set<string>();
  for (const w of work ?? []) {
    const key = workKey(w.session_id as string, w.problem_id as string);
    if (w.submitted_at) answered.add(key);
    if (w.graded_at) graded.add(key);
  }

  const sets = new Map<string, StudentHomeworkSet>();
  for (const item of items) {
    const sessionId = item.session_id as string;
    const meta = sessionById.get(sessionId);
    const set =
      sets.get(sessionId) ??
      {
        sessionId,
        subjectName: meta?.subjectName ?? "",
        startsAt: meta?.startsAt ?? null,
        total: 0,
        answered: 0,
        graded: 0,
        composedAt: item.composed_at as string,
      };
    set.total += 1;
    const key = workKey(sessionId, item.problem_id as string);
    if (answered.has(key)) set.answered += 1;
    if (graded.has(key)) set.graded += 1;
    sets.set(sessionId, set);
  }
  return Array.from(sets.values());
}
