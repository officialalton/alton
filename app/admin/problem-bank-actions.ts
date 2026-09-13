"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

// P2 3차 — 관리자 문제은행.
//
// 교재와 독립된 진입점이다. 지금까지 문제는 교재 섹션 편집기 안에서만 만들 수
// 있어서, 과목 전체의 문제를 모아 보고 검수·공개하는 자리가 없었다.
//
// **자동 공개는 없다.** 새 문제도 AI가 만든 문제도 전부 draft로 들어오고,
// 공개는 draft → 검수 요청 → 공개 세 단계를 사람이 눌러야 한다. 그 흐름은
// 20261293000000의 DB 함수가 강제한다(검수 중인 버전만 공개 가능).
//
// 오류는 던지지 않고 { ok, error }로 돌려준다 — 던진 예외는 Production에서
// 내부 오류 코드로 마스킹된다(2026-09-12 teacher-subjects-actions와 같은 부류).

export type BankProblemStatus = "draft" | "in_review" | "published" | "archived_problem";

export type BankProblem = {
  id: string;
  format: string;
  passage: string | null;
  skillType: string | null;
  difficulty: string | null;
  subjectId: string | null;
  subjectName: string;
  /** 문제 자체가 보관됐는가. 버전 상태와는 다른 축이다. */
  archived: boolean;
  /** 지금 이 문제가 어느 단계에 있는가 — 작업 중인 버전이 있으면 그 상태. */
  workState: "draft" | "in_review" | "published" | "none";
  keywords: { id: string; label: string }[];
  updatedAt: string;
};

export type BankResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

export type ProblemBankFilter = {
  subjectId?: string;
  /** 보관된 문제를 볼지. 기본은 현재 문제만. */
  archived?: boolean;
  workState?: "draft" | "in_review" | "published";
  format?: string;
  keywordId?: string;
  /** 지문·해설에서 찾는다. */
  query?: string;
};

export async function listBankProblemsAction(
  filter: ProblemBankFilter = {}
): Promise<BankProblem[]> {
  await requireAdmin();
  const admin = createAdminClient();

  let q = admin
    .from("problems")
    .select("id, format, passage, skill_type, difficulty, subject_id, status, archived_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // 보관됨과 현재는 **한 목록에 섞지 않는다.** 기본 진입은 현재다.
  q = filter.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (filter.subjectId) q = q.eq("subject_id", filter.subjectId);
  if (filter.format) q = q.eq("format", filter.format);
  if (filter.query?.trim()) q = q.ilike("passage", `%${filter.query.trim()}%`);

  const { data: rows, error } = await q;
  if (error || !rows?.length) return [];

  const ids = rows.map((r) => r.id as string);
  const subjectIds = Array.from(
    new Set(rows.map((r) => r.subject_id as string | null).filter(Boolean) as string[])
  );

  const [{ data: versions }, { data: keywordRows }, { data: subjects }] = await Promise.all([
    admin.from("problem_versions").select("problem_id, status").in("problem_id", ids),
    admin
      .from("problem_keywords")
      .select("problem_id, keyword:subject_keywords(id, label)")
      .in("problem_id", ids),
    subjectIds.length
      ? admin.from("subjects").select("id, name").in("id", subjectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const stateByProblem = new Map<string, BankProblem["workState"]>();
  for (const v of versions ?? []) {
    const pid = v.problem_id as string;
    const s = v.status as string;
    const current = stateByProblem.get(pid);
    // 작업 중인 것이 공개본보다 중요하다 — 지금 누가 뭘 해야 하는지를 보여준다.
    if (s === "in_review") stateByProblem.set(pid, "in_review");
    else if (s === "draft" && current !== "in_review") stateByProblem.set(pid, "draft");
    else if (s === "published" && !current) stateByProblem.set(pid, "published");
  }

  const keywordsByProblem = new Map<string, { id: string; label: string }[]>();
  for (const k of keywordRows ?? []) {
    const kw = Array.isArray(k.keyword) ? k.keyword[0] : k.keyword;
    if (!kw) continue;
    const pid = k.problem_id as string;
    keywordsByProblem.set(pid, [
      ...(keywordsByProblem.get(pid) ?? []),
      { id: (kw as { id: string }).id, label: (kw as { label: string }).label },
    ]);
  }

  const nameById = new Map((subjects ?? []).map((s) => [s.id as string, s.name as string]));

  const mapped = rows.map((r) => ({
    id: r.id as string,
    format: r.format as string,
    passage: (r.passage as string | null) ?? null,
    skillType: (r.skill_type as string | null) ?? null,
    difficulty: (r.difficulty as string | null) ?? null,
    subjectId: (r.subject_id as string | null) ?? null,
    subjectName: r.subject_id ? nameById.get(r.subject_id as string) ?? "(과목 없음)" : "(과목 없음)",
    archived: Boolean(r.archived_at),
    workState: stateByProblem.get(r.id as string) ?? "none",
    keywords: keywordsByProblem.get(r.id as string) ?? [],
    updatedAt: r.created_at as string,
  }));

  return mapped.filter((p) => {
    if (filter.workState && p.workState !== filter.workState) return false;
    if (filter.keywordId && !p.keywords.some((k) => k.id === filter.keywordId)) return false;
    return true;
  });
}

export type ProblemVersionRow = {
  id: string;
  versionNo: number;
  status: string;
  passage: string | null;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string | null;
  difficulty: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export async function loadProblemVersionsAction(problemId: string): Promise<ProblemVersionRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("problem_versions")
    .select("id, version_no, status, passage, options, correct_index, explanation, difficulty, created_at, published_at")
    .eq("problem_id", problemId)
    .order("version_no", { ascending: false });

  return (data ?? []).map((v) => ({
    id: v.id as string,
    versionNo: v.version_no as number,
    status: v.status as string,
    passage: (v.passage as string | null) ?? null,
    options: (v.options as string[] | null) ?? null,
    correctIndex: (v.correct_index as number | null) ?? null,
    explanation: (v.explanation as string | null) ?? null,
    difficulty: (v.difficulty as string | null) ?? null,
    createdAt: v.created_at as string,
    publishedAt: (v.published_at as string | null) ?? null,
  }));
}

export async function createBankProblemAction(params: {
  subjectId: string;
  format: string;
  skillType?: string;
  difficulty?: string;
}): Promise<BankResult<string>> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_bank_problem", {
    p_subject_id: params.subjectId,
    p_format: params.format,
    p_skill_type: params.skillType ?? "",
    p_difficulty: params.difficulty ?? "",
    p_actor_id: adminUserId,
  });
  if (error) return { ok: false, error: readable(error.message, "문제를 만들지 못했습니다.") };
  return { ok: true, value: data as string };
}

/**
 * 초안을 저장한다 — 작업 중인 초안이 있으면 고치고 없으면 만든다.
 *
 * 문제를 만들면 트리거가 대응하는 버전을 함께 만든다. 그래서 "새로 만들기"만
 * 있으면 방금 만든 빈 문제조차 저장이 막힌다.
 */
export async function createDraftVersionAction(params: {
  problemId: string;
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string;
}): Promise<BankResult<string>> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("save_problem_draft_version", {
    p_problem_id: params.problemId,
    p_passage: params.passage,
    p_options: params.options,
    p_correct_index: params.correctIndex,
    p_explanation: params.explanation,
    p_difficulty: params.difficulty,
    p_actor_id: adminUserId,
  });
  if (error) return { ok: false, error: readable(error.message, "초안을 저장하지 못했습니다.") };
  return { ok: true, value: data as string };
}

export async function submitVersionForReviewAction(versionId: string): Promise<BankResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_problem_version_for_review", {
    p_version_id: versionId,
    p_actor_id: adminUserId,
  });
  if (error) return { ok: false, error: readable(error.message, "검수 요청에 실패했습니다.") };
  return { ok: true };
}

export async function publishVersionAction(versionId: string): Promise<BankResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("publish_problem_version", {
    p_version_id: versionId,
    p_actor_id: adminUserId,
  });
  if (error) return { ok: false, error: readable(error.message, "공개하지 못했습니다.") };
  return { ok: true };
}

/** 문제 보관·해제. 삭제가 아니다 — 과거 기록은 그대로 남는다. */
export async function setProblemArchivedAction(
  problemId: string,
  archived: boolean,
  reason?: string
): Promise<BankResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("problems")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_reason: archived ? reason ?? null : null,
    })
    .eq("id", problemId);
  if (error) return { ok: false, error: archived ? "보관하지 못했습니다." : "보관을 풀지 못했습니다." };
  return { ok: true };
}

/**
 * DB 함수가 올려주는 한국어 메시지는 그대로 쓰고(이미 사용자용 문구다), 그 밖의
 * 내부 오류는 일반 문구로 바꾼다 — Postgres 원문에는 컬럼·제약 이름이 섞인다.
 */
function readable(message: string, fallback: string): string {
  return /[가-힣]/.test(message) ? message.replace(/^.*?:\s*/, "") : fallback;
}

/**
 * 기존 AI 생성을 문제은행에 연결한다.
 *
 * 생성기는 교재 섹션용으로 만들어져 있어 섹션 제목을 받는다 — 은행에서는 그
 * 자리에 주제(skillType)를 넣는다. 생성기 자체를 복제하지 않는다.
 *
 * **자동 공개하지 않는다.** 생성 결과는 문제 + 초안 버전으로만 들어가고, 검수
 * 요청과 공개는 사람이 따로 눌러야 한다. 여기서 만들어진 것과 손으로 쓴 것을
 * 다르게 취급하지 않는다 — 둘 다 같은 검수를 거친다.
 */
export async function generateBankProblemsAction(params: {
  subjectId: string;
  skillType: string;
  difficulty: string;
  format: string;
  count: number;
}): Promise<BankResult<number>> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: subject } = await admin
    .from("subjects")
    .select("name, archived_at")
    .eq("id", params.subjectId)
    .maybeSingle();
  if (!subject) return { ok: false, error: "존재하지 않는 과목입니다." };
  if (subject.archived_at) return { ok: false, error: "보관된 과목에는 문제를 만들 수 없습니다." };

  const { generateSectionProblems } = await import("./curriculum-doc-actions");

  let generated: Awaited<ReturnType<typeof generateSectionProblems>>;
  try {
    generated = await generateSectionProblems({
      sectionTitle: params.skillType,
      subjectName: subject.name as string,
      skillType: params.skillType,
      difficulty: params.difficulty as never,
      format: params.format as never,
      count: params.count,
    });
  } catch {
    // AI 응답 처리 실패의 원문은 화면에 넘기지 않는다.
    return { ok: false, error: "문제를 생성하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  let created = 0;
  for (const g of generated) {
    const problem = await createBankProblemAction({
      subjectId: params.subjectId,
      format: params.format,
      skillType: params.skillType,
      difficulty: params.difficulty,
    });
    if (!problem.ok) continue;
    const draft = await createDraftVersionAction({
      problemId: problem.value,
      passage: g.passage,
      options: g.options ?? null,
      correctIndex: g.correctIndex ?? null,
      explanation: g.explanation,
      difficulty: params.difficulty,
    });
    if (draft.ok) created += 1;
  }

  if (created === 0) return { ok: false, error: "문제를 생성하지 못했습니다." };
  return { ok: true, value: created };
}

/** 문제에 키워드를 붙이고 뗀다 — 자동 구성 후보가 되려면 키워드가 있어야 한다. */
export async function setProblemKeywordAction(
  problemId: string,
  keywordId: string,
  attached: boolean
): Promise<BankResult> {
  await requireAdmin();
  const admin = createAdminClient();
  if (!attached) {
    const { error } = await admin
      .from("problem_keywords")
      .delete()
      .eq("problem_id", problemId)
      .eq("keyword_id", keywordId);
    if (error) return { ok: false, error: "키워드를 떼지 못했습니다." };
    return { ok: true };
  }
  const { error } = await admin.from("problem_keywords").insert({ problem_id: problemId, keyword_id: keywordId });
  if (error && error.code !== "23505") return { ok: false, error: "키워드를 붙이지 못했습니다." };
  return { ok: true };
}
