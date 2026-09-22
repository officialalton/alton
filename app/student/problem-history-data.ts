import { createAdminClient } from "@/lib/supabase-admin";

// 2026-09-14 UAT: "문제 기록은 레거시로 남아있는 거 같은데" — 학생 포털 문제 기록을 v3 답안(session_problem_work)으로
// 다시 만든다. 수업 문제·과제 문제 모두, 답을 저장(제출)했거나 채점된 것만. 정답·해설·자동 채점은 **교사 채점 뒤에만**
// 학생에게 내려간다(확정 정책). 예전 session_problem_attempts 는 더 읽지 않는다.
//
// 서버 전용 로더 — 학생은 problems 를 직접 읽지 못하므로 관리자 클라이언트로 읽되, 조건은 항상 본인(studentId)으로 건다.

export type ProblemHistoryEntry = {
  workId: string;
  sessionId: string;
  source: "lesson" | "homework" | "mock_exam";
  subjectName: string;
  /** 수업 시각(예약) — 없으면 null. */
  startsAt: string | null;
  unitTitle: string | null;
  format: "mc" | "spr" | "essay" | "math";
  passage: string;
  options: string[];
  figure: unknown | null;
  myChoice: number | null;
  myText: string | null;
  submittedAt: string | null;
  graded: boolean;
  grade: "correct" | "partial" | "incorrect" | null;
  gradeComment: string | null;
  /** 아래 셋은 채점 뒤에만 채워진다. */
  correctIndex: number | null;
  acceptedAnswers: string[] | null;
  explanation: string | null;
  /** 분류(2026-09-14) — 성취 기록의 기준. */
  satDomain: string | null;
  skillCode: string | null;
};

const one = (rel: unknown) => (Array.isArray(rel) ? rel[0] : rel) as Record<string, unknown> | null | undefined;

// 2026-09-21(사용자 지시) — 모의고사 문항도 이 화면에 보이게 하되, 수업/과제처럼 전부
// 자동으로 들어가지 않고 학생이 "문제 저장" 버튼을 누른 것(saved_to_practice)만 보인다
// (단어장의 "내 단어장"과 같은 구조). 정답·해설은 그 응시가 채점 확정(graded)된 뒤에만.
async function loadSavedMockExamPractice(studentId: string): Promise<ProblemHistoryEntry[]> {
  const admin = createAdminClient();
  const { data: answers } = await admin
    .from("mock_exam_answers")
    .select(
      "attempt_id, set_item_id, response, correct, updated_at, attempt:mock_exam_attempts!inner(id, student_id, status, exam_set_id, submitted_at, graded_at, exam_set:mock_exam_sets(name)), item:mock_exam_set_items!inner(id, sat_domain, skill_code, problem_id, problem_version_id)"
    )
    .eq("saved_to_practice", true)
    .eq("attempt.student_id", studentId);
  if (!answers?.length) return [];

  const versionIds = Array.from(new Set(answers.map((a) => one(a.item)?.problem_version_id as string).filter(Boolean)));
  const problemIds = Array.from(new Set(answers.map((a) => one(a.item)?.problem_id as string).filter(Boolean)));
  const [{ data: versions }, { data: problems }] = await Promise.all([
    versionIds.length
      ? admin.from("problem_versions").select("id, passage, question, options, correct_index, explanation, answers, figure").in("id", versionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    problemIds.length ? admin.from("problems").select("id, format").in("id", problemIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);
  const versionById = new Map((versions ?? []).map((v) => [v.id as string, v]));
  const formatById = new Map((problems ?? []).map((p) => [p.id as string, p.format as string]));

  return answers.map((a) => {
    const attempt = one(a.attempt);
    const item = one(a.item);
    const examSet = one(attempt?.exam_set);
    const v = versionById.get((item?.problem_version_id as string) ?? "");
    const options = Array.isArray(v?.options) ? (v!.options as unknown[]).map(String) : [];
    const answersArr = Array.isArray(v?.answers) ? (v!.answers as unknown[]).map(String) : null;
    const graded = attempt?.status === "graded";
    const fmt = formatById.get((item?.problem_id as string) ?? "");
    const format: ProblemHistoryEntry["format"] = fmt === "mc" || fmt === "spr" || fmt === "essay" || fmt === "math" ? fmt : options.length > 0 ? "mc" : "essay";
    const grade: ProblemHistoryEntry["grade"] = graded ? (a.correct === true ? "correct" : a.correct === false ? "incorrect" : null) : null;
    return {
      workId: `mock:${a.attempt_id}:${a.set_item_id}`,
      sessionId: a.attempt_id as string,
      source: "mock_exam",
      subjectName: "모의고사",
      startsAt: (attempt?.submitted_at as string | null) ?? (attempt?.graded_at as string | null) ?? null,
      unitTitle: (examSet?.name as string | undefined) ?? null,
      format,
      passage: [((v?.passage as string | null) ?? "").trim(), ((v?.question as string | null) ?? "").trim()].filter(Boolean).join("\n\n"),
      options,
      figure: (v?.figure as unknown) ?? null,
      myChoice: format === "mc" && a.response != null ? Number(a.response) : null,
      myText: format !== "mc" ? ((a.response as string | null) ?? null) : null,
      submittedAt: (a.updated_at as string | null) ?? null,
      graded,
      grade,
      gradeComment: null,
      correctIndex: graded ? ((v?.correct_index as number | null) ?? null) : null,
      acceptedAnswers: graded ? answersArr : null,
      explanation: graded ? ((v?.explanation as string | null) ?? null) : null,
      satDomain: (item?.sat_domain as string | null) ?? null,
      skillCode: (item?.skill_code as string | null) ?? null,
    };
  });
}

export async function loadProblemHistory(studentId: string): Promise<ProblemHistoryEntry[]> {
  const admin = createAdminClient();
  const { data: work } = await admin
    .from("session_problem_work")
    .select(
      "id, session_id, problem_id, problem_version_id, source, submitted_at, submitted_choice_index, submitted_text, grade, grade_comment, graded_at, attempt_no"
    )
    .eq("student_id", studentId)
    .or("submitted_at.not.is.null,graded_at.not.is.null")
    .order("submitted_at", { ascending: false, nullsFirst: false });
  const savedMockExam = await loadSavedMockExamPractice(studentId);
  if (!work?.length) return savedMockExam;

  // 같은 문제를 여러 번 풀었으면(풀이형 다시 풀기) 가장 최근 시도만.
  const latest = new Map<string, (typeof work)[number]>();
  for (const w of work) {
    const key = `${w.session_id}:${w.source}:${w.problem_id}`;
    const prev = latest.get(key);
    if (!prev || (w.attempt_no as number) > (prev.attempt_no as number)) latest.set(key, w);
  }
  const rows = Array.from(latest.values());

  const sessionIds = Array.from(new Set(rows.map((r) => r.session_id as string)));
  const versionIds = Array.from(new Set(rows.map((r) => r.problem_version_id as string).filter(Boolean)));
  const problemIds = Array.from(new Set(rows.map((r) => r.problem_id as string)));
  const [{ data: sessions }, { data: units }, { data: versions }, { data: problems }] = await Promise.all([
    admin
      .from("sessions")
      .select(
        "id, reservation:reservations!sessions_reservation_id_fkey(starts_at), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name))"
      )
      .in("id", sessionIds),
    admin
      .from("session_curriculum_units")
      .select("session_id, unit:curriculum_overlay_units(unit_title)")
      .eq("role", "primary")
      .in("session_id", sessionIds),
    versionIds.length
      ? admin.from("problem_versions").select("id, passage, options, correct_index, explanation, answers, figure").in("id", versionIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    admin.from("problems").select("id, format, sat_domain, skill_code").in("id", problemIds),
  ]);

  const sessionById = new Map(
    (sessions ?? []).map((s) => {
      const subject = one(one(s.subject_enrollment)?.subject);
      return [s.id as string, { startsAt: ((one(s.reservation)?.starts_at as string | undefined) ?? null), subjectName: (subject?.name as string | undefined) ?? "" }];
    })
  );
  const unitBySession = new Map((units ?? []).map((u) => [u.session_id as string, (one(u.unit)?.unit_title as string | undefined) ?? null]));
  const versionById = new Map((versions ?? []).map((v) => [v.id as string, v]));
  const formatById = new Map((problems ?? []).map((p) => [p.id as string, p.format as string]));
  const classById = new Map((problems ?? []).map((p) => [p.id as string, { satDomain: (p.sat_domain as string | null) ?? null, skillCode: (p.skill_code as string | null) ?? null }]));
  const toFormat = (f: string | undefined, options: string[], answers: unknown): ProblemHistoryEntry["format"] => {
    if (f === "mc" || f === "spr" || f === "essay" || f === "math") return f;
    if (options.length > 0) return "mc";
    if (Array.isArray(answers) && answers.length > 0) return "spr";
    return "essay";
  };

  const lessonHomeworkEntries = rows.map((r) => {
    const v = versionById.get(r.problem_version_id as string);
    const options = Array.isArray(v?.options) ? (v!.options as unknown[]).map(String) : [];
    const graded = Boolean(r.graded_at);
    const meta = sessionById.get(r.session_id as string);
    const answers = Array.isArray(v?.answers) ? (v!.answers as unknown[]).map(String) : null;
    return {
      workId: r.id as string,
      sessionId: r.session_id as string,
      source: (r.source as string) === "homework" ? "homework" : "lesson",
      subjectName: meta?.subjectName ?? "",
      startsAt: meta?.startsAt ?? null,
      unitTitle: unitBySession.get(r.session_id as string) ?? null,
      format: toFormat(formatById.get(r.problem_id as string), options, v?.answers),
      passage: ((v?.passage as string | null) ?? "").trim(),
      options,
      figure: (v?.figure as unknown) ?? null,
      myChoice: (r.submitted_choice_index as number | null) ?? null,
      myText: (r.submitted_text as string | null) ?? null,
      submittedAt: (r.submitted_at as string | null) ?? null,
      graded,
      grade: (r.grade as ProblemHistoryEntry["grade"]) ?? null,
      gradeComment: (r.grade_comment as string | null) ?? null,
      correctIndex: graded ? ((v?.correct_index as number | null) ?? null) : null,
      acceptedAnswers: graded ? answers : null,
      explanation: graded ? ((v?.explanation as string | null) ?? null) : null,
      satDomain: classById.get(r.problem_id as string)?.satDomain ?? null,
      skillCode: classById.get(r.problem_id as string)?.skillCode ?? null,
    };
  }) as ProblemHistoryEntry[];

  return [...lessonHomeworkEntries, ...savedMockExam];
}
