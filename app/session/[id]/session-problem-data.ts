import type { SupabaseClient } from "@supabase/supabase-js";

// P2 3단계 — 수업·복습 화면이 "고정된 문제 버전"을 실제로 읽는 경로.
// session_content_manifest는 어떤 문제를 썼는지와 그 시점의 버전만 담는다.
// 실제 지문·보기·정답·해설은 그 버전(problem_versions)에서 가져온다 — 문제
// 원본(problems)에서 읽으면 이후 수정이 과거 수업 화면을 바꿔버린다.
//
// 내부 ID·기술 상태값은 화면에 내보내지 않는다. 여기서 돌려주는 것은 사람이
// 읽는 내용과 표시용 번호뿐이다.

export type ProblemFormat = "mc" | "essay" | "math";
export type ProblemGrade = "correct" | "partial" | "incorrect";

export type SessionProblem = {
  /** 화면에 보이는 문제 번호 — 내부 id가 아니다. */
  number: number;
  problemId: string;
  /**
   * 객관식 / 서술형 / 풀이형. 2026-09-14 UAT: 유형마다 푸는 방식이 다르다 —
   * 객관식은 선택지 클릭이 곧 답, 서술형은 아래 연습장, 풀이형만 풀이판·제출.
   */
  format: ProblemFormat;
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
  /**
   * 채점 상태(가장 최근 풀이 기준). 2026-09-14 UAT: 정답·해설은 **교사가 채점을
   * 끝낸 뒤**에만 학생에게 열린다 — 풀었다는 사실만으로는 열리지 않는다.
   */
  graded: boolean;
  grade: ProblemGrade | null;
  gradeComment: string | null;
  /** 가장 최근 풀이의 객관식 선택(학생 본인 답). 없으면 null. */
  myChoice: number | null;
  /** 객관식 자동 채점 결과 — 정답을 볼 자격이 있을 때만 채운다(채점 전 학생에게 새면 정답이 드러난다). */
  autoCorrect: boolean | null;
  /** 가장 최근 풀이판 id — 교사 채점이 가리킬 대상. */
  latestWorkId: string | null;
  /**
   * 이 수업이 쓴 문제 내용이 보존돼 있지 않다.
   *
   * 2026-09-13 확정: 고정된 버전이 없으면 **현재 공개본으로 대체하지 않는다.**
   * 지금 내용을 보여주면 그 수업이 실제로 낸 문제라는 거짓말이 된다. 지문·선택지·
   * 정답·해설은 비우고 화면이 사유를 말한다. **풀이 기록(attempts·solved)은
   * 그대로 남긴다** — 학생이 풀었다는 사실 자체는 사라지면 안 된다.
   */
  preservedUnavailable?: boolean;
  /**
   * 아직 고정되지 않은 **예정** 문제다(수업 시작 전 미리보기).
   *
   * 2026-09-14 제품 오너: "'수업 준비' 들어가면 배정된 교재는 보이는데 배정된 문제는
   * 안 보임." 교재는 예정 구성으로 내려가는데(loadPlannedMaterialData) 문제는 매니페스트
   * 만 읽어 시작 전엔 늘 비어 있었다. 예정 문제는 읽기만 한다 — 풀이·제출은 수업에서.
   * 정답·해설은 unit_preview_for_viewer 응답에 담기지 않으므로 여기서도 없다.
   */
  planned?: boolean;
};

export type SessionProblemViewer = {
  /** 교사·관리자는 정답·해설을 항상 본다. */
  canSeeAnswers: boolean;
  /** 학생 본인 시점이면 그 학생 id — 풀이 상태를 붙이는 데 쓴다. */
  studentId: string | null;
};

function toFormat(raw: string | null | undefined): ProblemFormat {
  return raw === "essay" || raw === "math" ? raw : "mc";
}

export type ProblemSource = "lesson" | "homework";

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
  return buildSessionProblems(
    supabase,
    sessionId,
    viewer,
    rows.map((r) => ({ problemId: r.content_id as string, versionId: (r.problem_version_id as string | null) ?? null })),
    "lesson"
  );
}

/**
 * 과제 문제(2026-09-14 과제 v3 통일) — 발급 원본은 session_homework_items, 답·채점은 수업 문제와 같은
 * session_problem_work. 버전은 발급 시 고정한 것(없는 옛 항목은 현재 공개본).
 */
export async function loadHomeworkProblems(
  supabase: SupabaseClient,
  sessionId: string,
  viewer: SessionProblemViewer
): Promise<SessionProblem[]> {
  const { data: rows, error } = await supabase
    .from("session_homework_items")
    .select("problem_id, problem_version_id, position")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  if (!rows?.length) return [];
  const missing = rows.filter((r) => !r.problem_version_id).map((r) => r.problem_id as string);
  const publishedByProblem = new Map<string, string>();
  if (missing.length) {
    const { data } = await supabase.from("problems").select("id, published_version_id").in("id", missing);
    for (const p of data ?? []) if (p.published_version_id) publishedByProblem.set(p.id as string, p.published_version_id as string);
  }
  return buildSessionProblems(
    supabase,
    sessionId,
    viewer,
    rows.map((r) => ({
      problemId: r.problem_id as string,
      versionId: (r.problem_version_id as string | null) ?? publishedByProblem.get(r.problem_id as string) ?? null,
    })),
    "homework"
  );
}

async function buildSessionProblems(
  supabase: SupabaseClient,
  sessionId: string,
  viewer: SessionProblemViewer,
  rows: { problemId: string; versionId: string | null }[],
  source: ProblemSource
): Promise<SessionProblem[]> {
  // 고정된 버전만 읽는다.
  //
  // 2026-09-13 정정: 예전에는 problem_version_id 가 비어 있으면 **현재 공개 버전으로
  // 대체**했다. 그러면 그 수업이 실제로 낸 문제가 아닌 것을 그 수업의 문제처럼
  // 보여주게 되고, 이후 문제를 고칠 때마다 과거 수업이 달라진다. 복원할 근거가
  // 없으면 없다고 말한다.
  const pinnedVersionIds = rows.map((r) => r.versionId).filter((v): v is string => Boolean(v));
  const versionById = new Map<string, Record<string, unknown>>();
  if (pinnedVersionIds.length) {
    const { data, error: versionError } = await supabase
      .from("problem_versions")
      .select("id, problem_id, passage, options, correct_index, explanation, difficulty")
      .in("id", pinnedVersionIds);
    if (versionError) throw new Error(versionError.message);
    for (const v of data ?? []) versionById.set(v.id as string, v);
  }


  // 문제 유형 — 학생은 problems 를 직접 읽지 못하므로 수업 관계자용 함수로 받는다.
  const formatByProblemId = new Map<string, ProblemFormat>();
  {
    const { data: formats } = await supabase.rpc("session_problem_formats", { p_session_id: sessionId });
    for (const f of (formats ?? []) as { problem_id: string; format: string }[]) {
      formatByProblemId.set(f.problem_id, toFormat(f.format));
    }
  }

  // 풀이 상태 — 이 학생이 이 수업에서 이 문제를 푼 기록. 채점·선택은 **가장 최근 풀이** 기준.
  type WorkState = {
    attempts: number;
    solved: boolean;
    latest: {
      attemptNo: number;
      workId: string;
      choice: number | null;
      autoCorrect: boolean | null;
      grade: ProblemGrade | null;
      gradeComment: string | null;
      gradedAt: string | null;
    } | null;
  };
  const emptyState = (): WorkState => ({ attempts: 0, solved: false, latest: null });
  const attemptsByProblemId = new Map<string, WorkState>();
  if (viewer.studentId) {
    const { data: work } = await supabase
      .from("session_problem_work")
      .select("id, problem_id, attempt_no, submitted_at, submitted_choice_index, auto_correct, grade, grade_comment, graded_at")
      .eq("session_id", sessionId)
      .eq("student_id", viewer.studentId)
      // 과제 답안은 수업 답안과 따로 — 같은 문제라도 섞이지 않는다(2026-09-14).
      .eq("source", source);
    for (const w of work ?? []) {
      const key = w.problem_id as string;
      const prev = attemptsByProblemId.get(key) ?? emptyState();
      const attemptNo = (w.attempt_no as number) ?? 0;
      const latest =
        !prev.latest || attemptNo >= prev.latest.attemptNo
          ? {
              attemptNo,
              workId: w.id as string,
              choice: (w.submitted_choice_index as number | null) ?? null,
              autoCorrect: (w.auto_correct as boolean | null) ?? null,
              grade: (w.grade as ProblemGrade | null) ?? null,
              gradeComment: (w.grade_comment as string | null) ?? null,
              gradedAt: (w.graded_at as string | null) ?? null,
            }
          : prev.latest;
      attemptsByProblemId.set(key, {
        attempts: Math.max(prev.attempts, attemptNo),
        solved: prev.solved || Boolean(w.submitted_at),
        latest,
      });
    }
  }

  return rows.map((r, index) => {
    const problemId = r.problemId;
    const version = r.versionId ? versionById.get(r.versionId) : undefined;
    const state = attemptsByProblemId.get(problemId) ?? emptyState();
    // 버전이 없거나 그 버전 행이 사라졌다 — 당시 내용을 확인할 수 없다.
    const preservedUnavailable = !version;
    // 2026-09-14 UAT: 학생·보호자는 **교사가 채점을 끝낸** 문제만 정답·해설을 본다.
    const graded = Boolean(state.latest?.gradedAt);
    const revealAnswers = viewer.canSeeAnswers || graded;
    const rawOptions = version?.options;
    const options = Array.isArray(rawOptions) ? (rawOptions as string[]) : [];
    return {
      number: index + 1,
      problemId,
      format: formatByProblemId.get(problemId) ?? (options.length > 0 ? "mc" : "essay"),
      passage: (version?.passage as string | null) ?? null,
      options,
      difficulty: (version?.difficulty as string | null) ?? null,
      correctIndex: revealAnswers ? ((version?.correct_index as number | null) ?? null) : null,
      explanation: revealAnswers ? ((version?.explanation as string | null) ?? null) : null,
      attempts: state.attempts,
      solved: state.solved,
      graded,
      grade: graded ? (state.latest?.grade ?? null) : null,
      gradeComment: graded ? (state.latest?.gradeComment ?? null) : null,
      myChoice: state.latest?.choice ?? null,
      // 자동 채점 결과는 정답과 같은 정보다 — 정답을 볼 자격이 있을 때만.
      autoCorrect: revealAnswers ? (state.latest?.autoCorrect ?? null) : null,
      latestWorkId: state.latest?.workId ?? null,
      ...(preservedUnavailable ? { preservedUnavailable: true } : {}),
    };
  });
}


// -------------------------------------------------------------------------
// 수업 시작 전 — 예정 문제 미리보기
// -------------------------------------------------------------------------
// 교재의 loadPlannedMaterialData 와 같은 자리다: 매니페스트가 비어 있는 **시작 전**
// 수업에서만 쓰이고, 시작되면 고정본이 우선이라 쓰이지 않는다. 내용 고르기와 범위
// 판단은 unit_preview_for_viewer 가 한다 — 학생·보호자 화면과 같은 함수라 두 곳이
// 다른 것을 보여줄 수 없다.

type PlannedPreviewProblem = {
  problemId: string;
  passage: string | null;
  options: string[] | null;
};

/** unit_preview_for_viewer 의 문제 목록을 화면 모양으로 옮긴다. 정답·해설·풀이 상태는 없다. */
export function toPlannedSessionProblems(
  problems: PlannedPreviewProblem[] | null | undefined
): SessionProblem[] {
  return (problems ?? []).map((p, index) => {
    const options = Array.isArray(p.options) ? p.options.map(String) : [];
    return {
      number: index + 1,
      problemId: p.problemId,
      // 미리보기 응답에는 유형이 없다 — 읽기만 하는 화면이라 선택지 유무로 갈라 보여준다.
      format: options.length > 0 ? "mc" : "essay",
      passage: p.passage ?? null,
      options,
      difficulty: null,
      correctIndex: null,
      explanation: null,
      attempts: 0,
      solved: false,
      graded: false,
      grade: null,
      gradeComment: null,
      myChoice: null,
      autoCorrect: null,
      latestWorkId: null,
      planned: true,
    };
  });
}

export async function loadPlannedProblems(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionProblem[]> {
  const { data: link } = await supabase
    .from("session_curriculum_units")
    .select("overlay_unit_id")
    .eq("session_id", sessionId)
    .eq("role", "primary")
    .maybeSingle();
  const overlayUnitId = link?.overlay_unit_id as string | undefined;
  if (!overlayUnitId) return [];

  const { data, error } = await supabase.rpc("unit_preview_for_viewer", {
    p_overlay_unit_id: overlayUnitId,
  });
  if (error) {
    console.error(JSON.stringify({ event: "planned_problems_failed", message: error.message }));
    return [];
  }
  const preview = data as { problems?: PlannedPreviewProblem[] } | null;
  return toPlannedSessionProblems(preview?.problems);
}
