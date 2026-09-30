"use server";

// 관리자 hard 난이도 점검(2026-10-01) — 서버 액션. 쓰기·읽기 모두 service_role 전용 정의자 RPC 이고,
// 여기서 requireAdmin 으로 관리자만 통과시킨다(RPC 도 actor 가 admin 인지 다시 검사한다).
// 오류는 던지지 않고 { ok:false, error } 로 돌려준다(Production 에서 던진 예외는 마스킹됨).

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export type DifficultyLevel = "easy" | "medium" | "hard";
/** provisional 잠정 / confirmed 현재 hard 이며 관리자 확인됨 / changed hard 에서 다른 난이도로 바뀜. */
export type DifficultyReviewState = "provisional" | "confirmed" | "changed";

export type DifficultyReviewFilter = {
  status?: "all" | DifficultyReviewState;
  satDomain?: string;
  skillCode?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type DifficultyReviewRow = {
  problemId: string;
  versionId: string;
  satDomain: string | null;
  skillCode: string | null;
  format: string;
  createdVia: string;
  difficulty: DifficultyLevel;
  state: DifficultyReviewState;
  publishedAt: string | null;
  confirmedAt: string | null;
  snippet: string;
  responses: number;
  correctPct: number | null;
  /** 이 문항이 들어 있는 조립된 세트 중 칸 규칙에 어긋나 '세트 교체 필요'인 세트 수(표시만, 자동 변경 없음). */
  setsNeedReplacement: number;
};

export type DifficultyReviewList = {
  summary: { provisional: number; confirmed: number; changed: number };
  total: number;
  rows: DifficultyReviewRow[];
};

export type JudgeRecord = { model?: string; effort?: string; fit?: boolean; correctOk?: boolean; complianceOk?: boolean; which?: string[]; note?: string; passed?: boolean };

export type DifficultyReviewDetail = {
  problemId: string;
  versionId: string;
  format: string;
  satDomain: string | null;
  skillCode: string | null;
  createdVia: string;
  difficulty: DifficultyLevel;
  difficultyStatus: "provisional" | "confirmed";
  passage: string | null;
  question: string | null;
  options: string[] | null;
  correctIndex: number | null;
  answers: string[] | null;
  explanation: string | null;
  hasFigure: boolean;
  judge: {
    hardJudge: JudgeRecord | null;
    advisory: JudgeRecord | null;
    recipeId: string | null;
    recipeCheck: { compliance?: { met: number | null; minMet: number; of: number; ok: boolean } | null; hardFit?: { ok: boolean; which?: string[]; note?: string } } | null;
    hardBasis: string | null;
    generationStatus: string | null;
    generatedBy: string | null;
    estimatedDifficulty: string | null;
    difficultyReasons: string[] | null;
  };
  stats: { responses: number; correct: number; correctPct: number | null };
  history: { id: string; action: "confirm" | "change"; from: DifficultyLevel; to: DifficultyLevel; fromStatus: string; toStatus: string; at: string; by: string | null; reason: string | null }[];
  sets: { setId: string; name: string; status: string; moduleKey: string | null; route: string | null; snapshotDifficulty: string; liveDifficulty: string; violates: boolean; startedAttempts: number }[];
};

export type ReviewResult =
  | { ok: true; confirmed: number; changed: number; skipped: number; needsSetReplacement: string[] }
  | { ok: false; error: string };

function readable(message: string, fallback: string): string {
  return /[가-힣]/.test(message) ? message.replace(/^.*?:\s*/, "") : fallback;
}

const PAGE_SIZE_MAX = 100;

export async function listDifficultyReviewAction(filter: DifficultyReviewFilter = {}): Promise<{ ok: true; data: DifficultyReviewList } | { ok: false; error: string }> {
  await requireAdmin();
  const pageSize = Math.min(Math.max(Math.floor(filter.pageSize ?? 20), 1), PAGE_SIZE_MAX);
  const page = Math.max(Math.floor(filter.page ?? 0), 0);
  const db = createAdminClient();
  const { data, error } = await db.rpc("problem_difficulty_review_list", {
    p_status: filter.status ?? "all",
    p_domain: filter.satDomain || null,
    p_skill: filter.skillCode || null,
    p_q: filter.q?.trim() || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) return { ok: false, error: readable(error.message, "난이도 점검 목록을 불러오지 못했습니다.") };
  return { ok: true, data: data as DifficultyReviewList };
}

export async function getDifficultyReviewDetailAction(problemId: string): Promise<{ ok: true; data: DifficultyReviewDetail } | { ok: false; error: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db.rpc("problem_difficulty_review_detail", { p_problem_id: problemId });
  if (error || !data) return { ok: false, error: error ? readable(error.message, "상세를 불러오지 못했습니다.") : "문항을 찾을 수 없습니다." };
  return { ok: true, data: data as DifficultyReviewDetail };
}

/**
 * 난이도 확인·변경(일괄 가능, 한 트랜잭션). to 가 현재 난이도와 같으면 '확인', 다르면 '변경'(사유 필수).
 * 이미 조립된 세트·진행 중 응시는 바뀌지 않는다. 칸 규칙에 어긋나게 된 세트는 needsSetReplacement(문항 id)로만 알린다.
 */
export async function reviewDifficultyAction(params: { problemIds: string[]; to: DifficultyLevel; reason?: string }): Promise<ReviewResult> {
  const { adminUserId } = await requireAdmin();
  if (!["easy", "medium", "hard"].includes(params.to)) return { ok: false, error: "난이도는 쉬움·보통·어려움 중에서 골라야 합니다." };
  const ids = Array.from(new Set(params.problemIds));
  if (ids.length === 0) return { ok: false, error: "문항을 선택하세요." };
  if (ids.length > 500) return { ok: false, error: "한 번에 500개까지만 처리할 수 있습니다." };
  const db = createAdminClient();
  const { data, error } = await db.rpc("review_problem_difficulty", {
    p_problem_ids: ids,
    p_to: params.to,
    p_actor_id: adminUserId,
    p_reason: params.reason?.trim() || null,
  });
  if (error) return { ok: false, error: readable(error.message, "난이도를 저장하지 못했습니다.") };
  const r = data as { confirmed: number; changed: number; skipped: number; needsSetReplacement: string[] };
  return { ok: true, confirmed: r.confirmed, changed: r.changed, skipped: r.skipped, needsSetReplacement: r.needsSetReplacement ?? [] };
}
