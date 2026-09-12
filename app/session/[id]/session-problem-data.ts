import type { SupabaseClient } from "@supabase/supabase-js";

// P2 3단계 — 수업·복습 화면이 "고정된 문제 버전"을 실제로 읽는 경로.
// session_content_manifest는 어떤 문제를 썼는지와 그 시점의 버전만 담는다.
// 실제 지문·보기·정답·해설은 그 버전(problem_versions)에서 가져온다 — 문제
// 원본(problems)에서 읽으면 이후 수정이 과거 수업 화면을 바꿔버린다.
//
// 내부 ID·기술 상태값은 화면에 내보내지 않는다. 여기서 돌려주는 것은 사람이
// 읽는 내용과 표시용 번호뿐이다.

export type SessionProblem = {
  /** 화면에 보이는 문제 번호 — 내부 id가 아니다. */
  number: number;
  problemId: string;
  passage: string | null;
  options: string[];
  difficulty: string | null;
  /**
   * 정답·해설은 채점 결과를 볼 자격이 있을 때만 채운다(교사·관리자는 항상,
   * 학생은 자기 풀이를 제출한 뒤). 자격이 없으면 null이라 payload 자체에
   * 답이 실려 나가지 않는다.
   */
  correctIndex: number | null;
  explanation: string | null;
  /** 이 학생이 이 수업에서 이 문제를 몇 번 풀었는지(0이면 아직 안 풀었다). */
  attempts: number;
  solved: boolean;
};

export type SessionProblemViewer = {
  /** 교사·관리자는 정답·해설을 항상 본다. */
  canSeeAnswers: boolean;
  /** 학생 본인 시점이면 그 학생 id — 풀이 상태를 붙이는 데 쓴다. */
  studentId: string | null;
};

export async function loadSessionProblems(
  supabase: SupabaseClient,
  sessionId: string,
  viewer: SessionProblemViewer
): Promise<SessionProblem[]> {
  const { data: rows, error } = await supabase
    .from("session_content_manifest")
    .select("content_id, problem_version_id, display_position")
    .eq("session_id", sessionId)
    .eq("content_type", "problem")
    .order("display_position", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows?.length) return [];

  // 고정된 버전을 우선 읽는다. problem_version_id가 비어 있는 행은 버전 체계
  // 도입(20261293000000) 이전에 고정된 수업이므로, 그때의 값을 복원할 방법이
  // 없다 — 이 경우에만 현재 공개 버전으로 대체한다.
  const pinnedVersionIds = rows
    .map((r) => r.problem_version_id as string | null)
    .filter((v): v is string => Boolean(v));
  const unversionedProblemIds = rows
    .filter((r) => !r.problem_version_id)
    .map((r) => r.content_id as string);

  const versionById = new Map<string, Record<string, unknown>>();
  if (pinnedVersionIds.length) {
    const { data, error: versionError } = await supabase
      .from("problem_versions")
      .select("id, problem_id, passage, options, correct_index, explanation, difficulty")
      .in("id", pinnedVersionIds);
    if (versionError) throw new Error(versionError.message);
    for (const v of data ?? []) versionById.set(v.id as string, v);
  }

  const fallbackByProblemId = new Map<string, Record<string, unknown>>();
  if (unversionedProblemIds.length) {
    const { data, error: fallbackError } = await supabase
      .from("problem_versions")
      .select("id, problem_id, passage, options, correct_index, explanation, difficulty")
      .in("problem_id", unversionedProblemIds)
      .eq("status", "published");
    if (fallbackError) throw new Error(fallbackError.message);
    for (const v of data ?? []) fallbackByProblemId.set(v.problem_id as string, v);
  }

  // 풀이 상태 — 이 학생이 이 수업에서 이 문제를 푼 기록.
  const attemptsByProblemId = new Map<string, { attempts: number; solved: boolean }>();
  if (viewer.studentId) {
    const { data: work } = await supabase
      .from("session_problem_work")
      .select("problem_id, attempt_no, submitted_at")
      .eq("session_id", sessionId)
      .eq("student_id", viewer.studentId);
    for (const w of work ?? []) {
      const key = w.problem_id as string;
      const prev = attemptsByProblemId.get(key) ?? { attempts: 0, solved: false };
      attemptsByProblemId.set(key, {
        attempts: Math.max(prev.attempts, (w.attempt_no as number) ?? 0),
        solved: prev.solved || Boolean(w.submitted_at),
      });
    }
  }

  return rows.map((r, index) => {
    const problemId = r.content_id as string;
    const version =
      (r.problem_version_id ? versionById.get(r.problem_version_id as string) : undefined) ??
      fallbackByProblemId.get(problemId);
    const state = attemptsByProblemId.get(problemId) ?? { attempts: 0, solved: false };
    // 학생은 자기 풀이를 제출한 뒤에만 정답·해설을 본다.
    const revealAnswers = viewer.canSeeAnswers || state.solved;
    const rawOptions = version?.options;
    return {
      number: index + 1,
      problemId,
      passage: (version?.passage as string | null) ?? null,
      options: Array.isArray(rawOptions) ? (rawOptions as string[]) : [],
      difficulty: (version?.difficulty as string | null) ?? null,
      correctIndex: revealAnswers ? ((version?.correct_index as number | null) ?? null) : null,
      explanation: revealAnswers ? ((version?.explanation as string | null) ?? null) : null,
      attempts: state.attempts,
      solved: state.solved,
    };
  });
}
