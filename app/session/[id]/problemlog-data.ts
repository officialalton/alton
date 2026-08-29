import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherPick = {
  reasons: string[];
  reasonText: string | null;
  taggedAt: string;
};

export type ProblemLogEntry = {
  attemptId: string;
  problemId: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  subjectName: string;
  unitTitle: string | null;
  skillType: string | null;
  response: string | number | null;
  correct: boolean | null;
  saved: boolean;
  attemptedAt: string;
  teacherPick: TeacherPick | null;
};

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export async function loadProblemLog(
  supabase: SupabaseClient,
  studentId: string
): Promise<ProblemLogEntry[]> {
  const { data } = await supabase
    .from("session_problem_attempts")
    .select(
      `id, problem_id, response, correct, saved, attempted_at,
       problems ( format, passage, options, correct_index, explanation, unit_title, skill_type, subjects ( name ) ),
       teacher_problem_tags ( reason, reason_text, tagged_at )`
    )
    .eq("student_id", studentId)
    .order("attempted_at", { ascending: false });

  const rows = data ?? [];
  const wrongCountByProblem = new Map<string, number>();
  for (const row of rows) {
    if (row.correct === false) {
      wrongCountByProblem.set(
        row.problem_id,
        (wrongCountByProblem.get(row.problem_id) ?? 0) + 1
      );
    }
  }

  return rows.flatMap((row) => {
    const problem = one(row.problems as unknown);
    if (!problem) return [];
    const subject = one(
      (problem as { subjects: unknown }).subjects as unknown
    ) as { name: string } | null;
    const pick = one(row.teacher_problem_tags as unknown) as {
      reason: string[];
      reason_text: string | null;
      tagged_at: string;
    } | null;

    const p = problem as {
      format: "mc" | "essay" | "math";
      passage: string;
      options: string[] | null;
      correct_index: number | null;
      explanation: string;
      unit_title: string | null;
      skill_type: string | null;
    };

    // mc problems leak the answer to a student mid-attempt (wrong guesses
    // before the 3-strike/correct conclusion) unless gated on whether the
    // attempt sequence actually concluded (correct, or 3 wrong attempts).
    // essay/math have no such concept — the explanation is always safe.
    const done =
      row.correct === true || (wrongCountByProblem.get(row.problem_id) ?? 0) >= 3;
    const revealAnswer = p.format !== "mc" || done;

    return [
      {
        attemptId: row.id,
        problemId: row.problem_id,
        format: p.format,
        passage: p.passage,
        options: p.options,
        correctIndex: revealAnswer ? p.correct_index : null,
        explanation: revealAnswer ? p.explanation : "",
        subjectName: subject?.name ?? "",
        unitTitle: p.unit_title,
        skillType: p.skill_type,
        response: row.response,
        correct: row.correct,
        saved: row.saved,
        attemptedAt: row.attempted_at,
        teacherPick: pick
          ? {
              reasons: pick.reason ?? [],
              reasonText: pick.reason_text,
              taggedAt: pick.tagged_at,
            }
          : null,
      },
    ];
  });
}
