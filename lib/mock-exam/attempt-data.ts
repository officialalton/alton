import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { computeMockExamReport } from "./report";
import { estimateScore, type ScoreEstimate } from "./score-estimate";
import { mstSectionSeconds } from "./mst";

// 고정형 SAT 모의고사 V1 — 응시 기록 읽기 계층(학생/교사/학부모 공용).
// 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3절(역할별 흐름)·5절(상태)·7절(답안·채점).
//
// 2026-09-21(P0 보안 차단) — 목록·상세는 SECURITY DEFINER RPC(mock_exam_attempt_summaries /
// mock_exam_attempt_detail)로 읽는다. 학생·학부모에게는 채점 확정(graded) 전까지 정답·해설·정오가
// DB 안에서 마스킹된 채로 내려오고(예전엔 TS에서만 가렸고 REST API로는 그대로 읽혔다), 학생 세션이
// 직접 읽을 수 없던 mock_exam_set_items(관리자 SELECT 정책만 존재)도 RPC 가 대신 읽는다.

export type AttemptStatus = "assigned" | "in_progress" | "submitted" | "graded";

export type MockExamAttemptSummary = {
  id: string;
  examSetId: string;
  examSetName: string;
  difficultyTier: string;
  studentId: string;
  studentName: string | null;
  status: AttemptStatus;
  /** 2026-09-22(사용자 지시) — 보드 카드에 "담당 선생님" 대신 실제 이름을 보여주려고 추가. */
  assignedByName: string | null;
  dueAt: string | null;
  startBy: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  totalCount: number;
  correctCount: number | null;
  /** 문항 오류 판정으로 correctCount 가 조정 채점 기준이다. */
  scoreAdjusted?: boolean;
  /** 2026-09-22(사용자 지시) — 응시 화면을 나갔다가 다시 들어온 횟수. 시간
   * 어뷰징 의심 신호로 교사 화면에 노출한다(정교한 타이머 재설계는 아님). */
  entryCount: number;
  /** 재응시(2026-10-08): 같은 학생·시험의 몇 번째 응시인지(1부터). 마이그레이션 370 적용 전 응답에는 없다. */
  attemptNo?: number;
  /** 같은 학생·시험의 전체 응시 횟수. */
  attemptTotal?: number;
  /** 시험(세트 계열) id — 같은 시험의 회차를 묶는 키. */
  setGroupId?: string;
  /** AP 모의고사(마이그레이션 401). 없으면 SAT. */
  examProgram?: "sat" | "ap";
  apSubject?: string | null;
  apLabel?: "full_practice" | "mc_practice" | "frq_practice" | null;
};

export type MockExamAttemptItem = {
  setItemId: string;
  section: "rw" | "math";
  position: number;
  problemId: string;
  satDomain: string;
  skillCode: string | null;
  difficulty: string;
  format: "mc" | "essay" | "math" | "spr";
  passage: string | null;
  question: string | null;
  options: string[] | null;
  correctIndex: number | null;
  answers: string[] | null;
  explanation: string | null;
  /** 영어 해설(problem_versions.explanation_en). explanation 이 공개된 경우에만 DB 가 싣는다
   * (20262001000000). 없으면 화면은 한글 해설로 폴백한다. */
  explanationEn?: string | null;
  figure: unknown;
  response: string | null;
  correct: boolean | null;
  /** 문항 오류 판정으로 조정 채점된 문항(correct 는 조정 기준, originalCorrect 는 원채점). 신고 기능 이전 응답에는 없다. */
  adjusted?: boolean;
  originalCorrect?: boolean | null;
  flagged: boolean;
  /** 학생이 스스로 누른 "찍음" 표시(20262001000000). 마이그레이션 적용 전 응답에는 없다. */
  guessed?: boolean;
  savedToPractice: boolean;
  timeSpentSeconds: number | null;
  /** AP 문항(마이그레이션 401): 선택지 수(4·5)·FRQ 파트 [{label, points, prompt, mode}]. 실제 section 값은 AP 에서 "ap_*" 문자열이다. */
  optionCount?: number | null;
  parts?: { label: string; points: number; prompt: string; mode: string }[] | null;
  apItemIndex?: number | null;
};

export type MockExamAttemptDetail = {
  id: string;
  examSetId: string;
  examSetName: string;
  difficultyTier: string;
  studentId: string;
  studentName: string | null;
  status: AttemptStatus;
  dueAt: string | null;
  startBy: string | null;
  maxAttempts: number;
  attemptCount: number;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  rwTimeLimitMinutes: number;
  mathTimeLimitMinutes: number;
  mathCalculatorAllowed: boolean;
  mathReferenceSheetAllowed: boolean;
  timeRemainingSeconds: { rw?: number; math?: number } | null;
  entryCount: number;
  /** 재응시 회차(1부터)와 이 학생·시험의 전체 응시 횟수. */
  attemptNo?: number;
  attemptTotal?: number;
  setGroupId?: string;
  /** 'fixed'(V1 고정형) | 'mst'(4모듈). MST 진행 중엔 학생·보호자에게 현재 모듈 문항만 내려온다. */
  format: "fixed" | "mst";
  currentModule: "rw_m1" | "rw_m2" | "break" | "math_m1" | "math_m2" | null;
  items: MockExamAttemptItem[];
  /** AP: 공식 섹션 구조(키·시간·계산기·문항 수). examProgram 이 'ap' 일 때만. */
  examProgram?: "sat" | "ap";
  apSubject?: string | null;
  apLabel?: "full_practice" | "mc_practice" | "frq_practice" | null;
  sectionLayout?: { key: string; kind: "mc" | "frq"; label: string; minutes: number; count: number; calculator: "allowed" | "not_allowed" | "required" | "na"; options?: number }[];
  /** 문항 오류 판정으로 점수가 조정된 응시(학생·학부모 안내용). 원채점은 DB 에 보존된다. */
  scoreAdjusted?: boolean;
  /** 직원(관리자·담당 교사·컨설턴트) 응답에만 있다. 학생·보호자 응답에는 이 키 자체가 없다(경로 비노출). */
  /** 예상 점수 범위(내부 추정). 서버가 경로로 계산해 범위만 싣는다 — 경로·난이도는 없다. MST 채점 완료 시에만. */
  scoreEstimate?: ScoreEstimate | null;
  /** 섹션 소요 시간(초). MST 는 모듈 시작~제출 시각으로 계산한다(문항별 시간 미수집). null 이면 문항별 합계. */
  sectionTimeSeconds?: { rw: number | null; math: number | null } | null;
  routing?: {
    rw: { route: "higher" | "lower" | null; policyVersion: number | null };
    math: { route: "higher" | "lower" | null; policyVersion: number | null };
  };
};

async function loadSummaries(supabase: SupabaseClient, studentId: string): Promise<MockExamAttemptSummary[]> {
  const { data, error } = await supabase.rpc("mock_exam_attempt_summaries", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : []) as (Omit<MockExamAttemptSummary, "totalCount" | "correctCount"> & {
    totalCount: number | string;
    correctCount: number | string | null;
  })[];
  return rows.map((r) => ({
    ...r,
    totalCount: Number(r.totalCount ?? 0),
    correctCount: r.correctCount === null || r.correctCount === undefined ? null : Number(r.correctCount),
    entryCount: Number(r.entryCount ?? 0),
    attemptNo: r.attemptNo === undefined || r.attemptNo === null ? undefined : Number(r.attemptNo),
    attemptTotal: r.attemptTotal === undefined || r.attemptTotal === null ? undefined : Number(r.attemptTotal),
  }));
}

/** 학생 본인의 모의고사 탭(수업 안/밖 공용) — 자기 응시 기록 전체. */
export async function loadStudentMockExamAttempts(supabase: SupabaseClient, studentId: string): Promise<MockExamAttemptSummary[]> {
  return loadSummaries(supabase, studentId);
}

/** 학부모 읽기 전용 화면 — 자녀 응시 기록(RPC가 본인 자녀만 허용). */
export async function loadGuardianMockExamAttempts(supabase: SupabaseClient, studentId: string): Promise<MockExamAttemptSummary[]> {
  return loadSummaries(supabase, studentId);
}

/** 담당 학생의 모의고사 응시 목록(수업 화면 `모의고사` 탭). */
export async function loadTeacherMockExamAttemptsForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<MockExamAttemptSummary[]> {
  return loadSummaries(supabase, studentId);
}

/** 응시 상세 — 문항·본문·(채점 확정 전까지 DB에서 마스킹된) 정답/해설을 포함한 전체 화면 데이터. */
export async function loadMockExamAttemptDetail(supabase: SupabaseClient, attemptId: string): Promise<MockExamAttemptDetail | null> {
  const { data, error } = await supabase.rpc("mock_exam_attempt_detail", { p_attempt_id: attemptId });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const d = data as MockExamAttemptDetail & { items: MockExamAttemptItem[] | null };
  const detail = { ...d, items: Array.isArray(d.items) ? d.items : [] };
  if (detail.format !== "mst") return detail;
  const [scoreEstimate, sectionTimeSeconds] = await Promise.all([computeScoreEstimate(detail), loadMstSectionTime(detail.id)]);
  return { ...detail, scoreEstimate, sectionTimeSeconds };
}

/** MST 섹션 소요 시간 — RPC 가 접근 권한을 확인한 뒤, 모듈 시각(경로 정보 없음)만 서비스 롤로 읽는다. */
async function loadMstSectionTime(attemptId: string): Promise<{ rw: number | null; math: number | null } | null> {
  try {
    const { data } = await createAdminClient()
      .from("mock_exam_attempt_modules")
      .select("module_key, started_at, submitted_at, ends_at, time_limit_seconds")
      .eq("attempt_id", attemptId);
    return data ? mstSectionSeconds(data) : null;
  } catch {
    return null;
  }
}

/** 경로는 학생·보호자 RPC 응답에 없으므로(RPC가 접근 권한을 이미 확인한 뒤) 서비스 롤로 읽어 계산에만 쓴다. */
async function computeScoreEstimate(detail: MockExamAttemptDetail): Promise<ScoreEstimate | null> {
  try {
    const report = computeMockExamReport(detail.items);
    if (report.bySection.some((s) => s.correct === null)) return null;
    const { data } = await createAdminClient()
      .from("mock_exam_attempts")
      .select("rw_m2_route, math_m2_route")
      .eq("id", detail.id)
      .maybeSingle();
    if (!data) return null;
    return estimateScore(report.bySection, { rw: data.rw_m2_route ?? null, math: data.math_m2_route ?? null });
  } catch {
    return null;
  }
}

export type MockExamCatalogRow = {
  examSetId: string;
  setGroupId: string;
  name: string;
  description: string | null;
  difficultyTier: string;
  format: "fixed" | "mst";
  publishedAt: string | null;
  /** 이 학생의 응시(없으면 미응시). 'assigned' 는 시작은 눌렀지만 첫 문항 전. */
  attemptId: string | null;
  attemptStatus: AttemptStatus | null;
  /** 최신 회차 번호와 전체 회차 수(재응시). attemptId/attemptStatus 는 최신 회차 기준 — 진행 중 응시가 있으면 그것. */
  attemptNo?: number | null;
  attemptTotal?: number;
  /** AP 세트(마이그레이션 401). 없으면 SAT. */
  examProgram?: "sat" | "ap";
  apSubject?: string | null;
  apLabel?: "full_practice" | "mc_practice" | "frq_practice" | null;
  /** AP 세트의 공식 섹션 구성(문항 수·시간·계산기) — 목록의 배지·시작 안내에 쓴다. */
  apSections?: { key: string; kind: "mc" | "frq"; label: string; minutes: number; count: number; calculator: "allowed" | "not_allowed" | "required" | "na" }[] | null;
};

/** 공개된 모의고사 세트 전체 + 그 학생의 응시 상태 — RPC 한 번(N+1 없음). 학생 본인·학부모·교사·컨설턴트·관리자 열람용. */
export async function loadMockExamOpenCatalog(supabase: SupabaseClient, studentId: string): Promise<MockExamCatalogRow[]> {
  const { data, error } = await supabase.rpc("mock_exam_open_catalog", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []) as MockExamCatalogRow[];
}

/** 관리자 화면 등에서 쓰는 공개 세트 이름·난이도 목록(조회 전용). */
export async function loadPublishedMockExamSets(
  supabase: SupabaseClient,
): Promise<{ id: string; setGroupId: string; name: string; difficultyTier: string }[]> {
  const { data, error } = await supabase
    .from("mock_exam_sets")
    .select("id, set_group_id, name, difficulty_tier")
    .eq("status", "published")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, setGroupId: r.set_group_id, name: r.name, difficultyTier: r.difficulty_tier }));
}

/** 학생·학부모 모의고사 탭 데이터 — 공개 세트 목록 + 응시 요약(RPC 2회, 병렬). */
export type MockExamOverview = { catalog: MockExamCatalogRow[]; attempts: MockExamAttemptSummary[] };

export async function loadMockExamOverview(supabase: SupabaseClient, studentId: string): Promise<MockExamOverview> {
  const [catalog, attempts] = await Promise.all([loadMockExamOpenCatalog(supabase, studentId), loadSummaries(supabase, studentId)]);
  return { catalog, attempts };
}
