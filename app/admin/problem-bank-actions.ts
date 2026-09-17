"use server";

import { checkFigure, type RenderCheck } from "@/lib/problem-figures/check";
import { validateFigureSpec } from "@/lib/problem-figures/spec";
import { checkContent } from "@/lib/problem-content-check";
import { composeProblemText, hasQuestion, splitLegacyQuestion } from "@/lib/problem-question";
import { judgeMaterialNeed, materialBlocker } from "@/lib/problem-material-need";
import type { QualityRecord } from "@/lib/problem-generation/review";
import type { GeneratedProblem } from "@/lib/problem-generation/pipeline";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

// P2 3차 — 관리자 문제은행.
//
// 교재와 독립된 진입점이다. 지금까지 문제는 교재 섹션 편집기 안에서만 만들 수
// 있어서, 과목 전체의 문제를 모아 보고 검수·공개하는 자리가 없었다.
//
// **자동 공개는 없다.** 새 문제도 AI가 만든 문제도 전부 draft로 들어오고,
// 사람이 내용을 눈으로 확인한 뒤 공개를 눌러야 한다.
//
// 2026-09-13: 화면의 흐름은 **초안 저장 → 미리보기·내용 확인 → 공개**다. 관리자
// 본인이 자기에게 검수를 요청하는 단계는 없앴다. DB의 draft → in_review →
// published 전이는 그대로 두되 한 트랜잭션에서 처리하고
// (confirm_and_publish_problem_version), 별도 검수자가 승인한 것처럼 기록하지
// 않는다 — review_kind에 self_confirmed로 남는다.
//
// 오류는 던지지 않고 { ok, error }로 돌려준다 — 던진 예외는 Production에서
// 내부 오류 코드로 마스킹된다(2026-09-12 teacher-subjects-actions와 같은 부류).

export type BankProblemStatus = "draft" | "in_review" | "published" | "archived_problem";

export type BankProblem = {
  id: string;
  format: string;
  passage: string | null;
  skillType: string | null;
  /** SAT 영역·세부 기술 코드(lib/problem-taxonomy, DB problem_skill_codes). 만들기·찾기·배정·성취의 공통 기준. */
  satDomain: string | null;
  skillCode: string | null;
  /** 문항 체계(2026-09-14): sat_rw | sat_math | ap. 관리 과목과 독립. */
  examSystem: string | null;
  /** AP 과목 코드(exam_system = ap). */
  apSubject: string | null;
  /** 최신 내용(공개본 우선)에 질문이 있는가 — 없으면 '질문 보완 필요', 자동 구성 후보에서 빠진다. */
  hasQuestion: boolean;
  /** 학생 응답 통계(공개본 기준, 개인 식별 없음) — 추정 난이도 보정의 재료. */
  responseStats: { responses: number; correctPct: number | null } | null;
  difficulty: string | null;
  subjectId: string | null;
  subjectName: string;
  /** 문제 자체가 보관됐는가. 버전 상태와는 다른 축이다. */
  archived: boolean;
  /** 지금 이 문제가 어느 단계에 있는가 — 작업 중인 버전이 있으면 그 상태. */
  workState: "draft" | "in_review" | "published" | "none";
  keywords: { id: string; label: string }[];
  updatedAt: string;
  /** 이 문제가 다루는 주제. 유형(skillType)과 다른 축이고 둘 다 선택 항목이다. */
  topic: string | null;
  /**
   * 회차 자동 구성 후보가 되는지, 안 된다면 어느 조건에 걸렸는지.
   * "공개했는데 왜 안 나오지?"를 화면이 설명할 수 있어야 한다.
   */
  readiness: "ok" | "not_confirmed" | "archived" | "no_published_version" | "no_keyword";
  /** 지금 공개돼 있는 내용. 없으면 아직 공개된 적이 없다. */
  published: ProblemContent | null;
  /**
   * 지금 작업 중인 초안. 있으면 "수정 초안 만들기"가 새로 만들지 않고 이것을
   * 이어서 고친다 — 반복 클릭으로 초안이 늘어나지 않게 한다.
   */
  draft: ProblemContent | null;
};

export type ProblemContent = {
  versionId: string;
  passage: string | null;
  /** 질문(지문과 분리 저장, 2026-09-14). 옛 버전은 null — 지문 안의 질문 문장을 그대로 읽는다. */
  question: string | null;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string | null;
  /** spr 동치 정답 목록. */
  answers: string[] | null;
  /** 도형·그래프 데이터(lib/problem-figures). */
  figure: unknown | null;
  figureChecked: boolean;
  /** 표준 렌더링 검증 결과(초안 저장 때 서버가 기록). null 이면 아직 검증 전. */
  renderCheck: RenderCheck | null;
  /** 로마숫자 진술 I, II, III … */
  statements: string[] | null;
  /** 품질 기록(추정 난이도·근거·오답 근거·독립 검사·검토 필요). 관리자에게는 난이도 근거와 검토 필요만 보인다. */
  quality: QualityRecord | null;
  /** 2026-09-15: 'needs_distractor_repair' 면 지문·질문·정답·자료는 통과했고 오답만 보강이 필요 — 일반 초안 목록에서 숨는다. */
  repairStatus: "none" | "needs_distractor_repair";
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
  satDomain?: string;
  skillCode?: string;
  examSystem?: string;
  /** 2026-09-15: 지정하지 않으면 'needs_distractor_repair' 초안은 기본 목록에서 숨는다. */
  repairStatus?: "none" | "needs_distractor_repair";
};

export async function listBankProblemsAction(
  filter: ProblemBankFilter = {}
): Promise<BankProblem[]> {
  await requireAdmin();
  const admin = createAdminClient();

  let q = admin
    .from("problems")
    .select(
      "id, format, passage, skill_type, topic, difficulty, subject_id, status, archived_at, created_at, sat_domain, skill_code, exam_system, ap_subject"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  // 보관됨과 현재는 **한 목록에 섞지 않는다.** 기본 진입은 현재다.
  q = filter.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (filter.subjectId) q = q.eq("subject_id", filter.subjectId);
  if (filter.format) q = q.eq("format", filter.format);
  if (filter.satDomain) q = q.eq("sat_domain", filter.satDomain);
  if (filter.skillCode) q = q.eq("skill_code", filter.skillCode);
  if (filter.examSystem) q = q.eq("exam_system", filter.examSystem);
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

  const problemIds = rows.map((r) => r.id as string);

  // 지금 공개돼 있는 내용. 목록의 problems.passage 는 오래된 칸이라 비어 있을 수
  // 있다 — 그래서 공개된 문제가 "(아직 내용이 없는 문제)"로 보였다.
  const { data: contentRows } = await admin
    .from("problem_versions")
    .select("id, problem_id, status, version_no, passage, question, options, correct_index, explanation, answers, figure, figure_checked, render_check, statements, quality, repair_status")
    .in("problem_id", problemIds)
    .in("status", ["published", "draft", "in_review"])
    .order("version_no", { ascending: false });

  const asContent = (v: Record<string, unknown>): ProblemContent => ({
    versionId: v.id as string,
    passage: (v.passage as string | null) ?? null,
    question: (v.question as string | null) ?? null,
    options: (v.options as string[] | null) ?? null,
    correctIndex: (v.correct_index as number | null) ?? null,
    explanation: (v.explanation as string | null) ?? null,
    answers: (v.answers as string[] | null) ?? null,
    figure: v.figure ?? null,
    figureChecked: Boolean(v.figure_checked),
    renderCheck: (v.render_check as RenderCheck | null) ?? null,
    statements: Array.isArray(v.statements) ? (v.statements as string[]) : null,
    quality: (v.quality as QualityRecord | null) ?? null,
    repairStatus: (v.repair_status as "none" | "needs_distractor_repair" | undefined) ?? "none",
  });

  const publishedByProblem = new Map<string, ProblemContent>();
  const draftByProblem = new Map<string, ProblemContent>();
  for (const v of contentRows ?? []) {
    const pid = v.problem_id as string;
    if (v.status === "published") {
      if (!publishedByProblem.has(pid)) publishedByProblem.set(pid, asContent(v));
    } else if (!draftByProblem.has(pid)) {
      // version_no 내림차순이라 가장 최근 작업본이 먼저 온다.
      draftByProblem.set(pid, asContent(v));
    }
  }

  const { data: statRows } = await admin.from("problem_response_stats").select("problem_id, problem_version_id, responses, correct_pct").in("problem_id", problemIds);
  const statsByVersion = new Map((statRows ?? []).map((r) => [r.problem_version_id as string, { responses: Number(r.responses ?? 0), correctPct: r.correct_pct === null || r.correct_pct === undefined ? null : Number(r.correct_pct) }]));
  const { data: readinessRows } = await admin
    .from("problem_composition_readiness")
    .select("problem_id, readiness")
    .in("problem_id", problemIds);
  const readinessByProblem = new Map(
    (readinessRows ?? []).map((r) => [r.problem_id as string, r.readiness as string])
  );

  const mapped = rows.map((r) => ({
    id: r.id as string,
    format: r.format as string,
    passage: (r.passage as string | null) ?? null,
    skillType: (r.skill_type as string | null) ?? null,
    satDomain: (r.sat_domain as string | null) ?? null,
    skillCode: (r.skill_code as string | null) ?? null,
    examSystem: (r.exam_system as string | null) ?? null,
    apSubject: (r.ap_subject as string | null) ?? null,
    hasQuestion: (() => {
      const c = publishedByProblem.get(r.id as string) ?? draftByProblem.get(r.id as string);
      return c ? hasQuestion(c.passage, c.question) : false;
    })(),
    responseStats: (() => {
      const pub = publishedByProblem.get(r.id as string);
      return pub ? statsByVersion.get(pub.versionId) ?? null : null;
    })(),
    difficulty: (r.difficulty as string | null) ?? null,
    subjectId: (r.subject_id as string | null) ?? null,
    subjectName: r.subject_id ? nameById.get(r.subject_id as string) ?? "(과목 없음)" : "(과목 없음)",
    archived: Boolean(r.archived_at),
    workState: stateByProblem.get(r.id as string) ?? "none",
    keywords: keywordsByProblem.get(r.id as string) ?? [],
    updatedAt: r.created_at as string,
    topic: (r.topic as string | null) ?? null,
    readiness: (readinessByProblem.get(r.id as string) ??
      "not_confirmed") as BankProblem["readiness"],
    published: publishedByProblem.get(r.id as string) ?? null,
    draft: draftByProblem.get(r.id as string) ?? null,
  }));

  return mapped.filter((p) => {
    if (filter.workState && p.workState !== filter.workState) return false;
    if (filter.keywordId && !p.keywords.some((k) => k.id === filter.keywordId)) return false;
    // 2026-09-15: 오답 보강 대기 초안은 명시적으로 요청했을 때만 보인다 — 기본 화면·자동 구성에서 숨긴다.
    const currentRepairStatus = p.draft?.repairStatus ?? "none";
    if (filter.repairStatus) { if (currentRepairStatus !== filter.repairStatus) return false; }
    else if (currentRepairStatus !== "none") return false;
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
  /** 무엇을 묻는가(예: Words in Context). 선택 항목이다. */
  skillType?: string;
  /** 세부 기술 코드 — 정하면 SAT 영역·문항 체계는 DB 트리거가 맞춘다. */
  skillCode?: string;
  /** 문항 체계(sat_rw | sat_math | ap). 관리 과목과 독립. */
  examSystem?: string;
  /** AP 과목 코드(문항 체계가 ap 일 때). */
  apSubject?: string;
  /** 무엇에 대한 글인가. 유형과 다른 축이고 역시 선택 항목이다. */
  topic?: string;
  difficulty?: string;
  /**
   * 만들면서 바로 붙일 키워드. 선택 항목이다 — 키워드 없이도 초안은 만들어진다.
   * 만든 뒤 편집 화면에서도 붙일 수 있지만, 이미 아는 것을 다시 찾아 들어가게 하지 않는다.
   */
  keywordIds?: string[];
}): Promise<BankResult<string>> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_bank_problem", {
    p_subject_id: params.subjectId,
    p_format: params.format,
    p_skill_type: params.skillType ?? "",
    p_topic: params.topic ?? "",
    p_skill_code: params.skillCode ?? null,
    p_exam_system: params.examSystem ?? null,
    p_ap_subject: params.apSubject ?? null,
    p_difficulty: params.difficulty ?? "",
    p_actor_id: adminUserId,
  });
  if (error) return { ok: false, error: readable(error.message, "문제를 만들지 못했습니다.") };

  const problemId = data as string;
  if (params.keywordIds?.length) {
    // 키워드를 붙이지 못해도 문제 자체는 만들어졌다. 만들기를 실패로 돌리면
    // 화면에 없는 문제가 DB 에 남는다 — 붙이기 실패만 따로 알린다.
    const { error: linkError } = await admin
      .from("problem_keywords")
      .insert(params.keywordIds.map((keywordId) => ({ problem_id: problemId, keyword_id: keywordId })));
    if (linkError && linkError.code !== "23505") {
      return { ok: false, error: "문제는 만들었지만 키워드를 붙이지 못했습니다. 편집 화면에서 붙여주세요." };
    }
  }
  return { ok: true, value: problemId };
}

/**
 * 초안을 저장한다 — 작업 중인 초안이 있으면 고치고 없으면 만든다.
 *
 * 문제를 만들면 트리거가 대응하는 버전을 함께 만든다. 그래서 "새로 만들기"만
 * 있으면 방금 만든 빈 문제조차 저장이 막힌다.
 */
export async function createDraftVersionAction(params: {
  problemId: string;
  /** 지문/자료 본문(질문 제외). 옛 문제는 질문이 섞여 있을 수 있다 — 그대로 둔다. */
  passage: string;
  /** 질문 문장(2026-09-14 분리). 비우면 지문 안의 질문 문장을 그대로 읽는다(레거시). */
  question?: string | null;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string;
  answers?: string[] | null;
  figure?: unknown | null;
  figureChecked?: boolean;
  statements?: string[] | null;
  /** 2026-09-15: 'needs_distractor_repair' 로 저장하면 지문·질문·정답·자료는 통과했지만 오답 보강 대기 상태로 들어간다(일반 초안 목록에서 숨음). */
  repairStatus?: "none" | "needs_distractor_repair";
}): Promise<BankResult<{ versionId: string; answerFixed: boolean }>> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  // 렌더·검증은 "지문 + 질문" 한 덩어리를 본다.
  const fullText = composeProblemText(params.passage, params.question ?? null);
  // 2026-09-14 표준 렌더링 검증 — 스키마에 안 맞는 그림·조판할 수 없는 수식은 저장하지 않는다. 그 외 문제(참조 불일치·
  // 충돌·잘림·레거시·선택지 정합)는 저장은 되지만 render_check 에 남고 공개가 막힌다(관리자가 사유를 보고 고친다).
  const { data: problemRow } = await admin.from("problems").select("format, skill_code, exam_system").eq("id", params.problemId).maybeSingle();
  const format = (problemRow?.format as string | undefined) ?? (params.options ? "mc" : "essay");

  // 2026-09-15 제품 오너 — "관리자가 고치는 상황을 원하지 않는다. 초안으로 들어올 때 이미 문제 자체에
  // 오류가 없어야 한다." 관리자 검수는 "문제가 괜찮은가"를 판단하는 것이지 "문제가 틀렸는가"를 고치는
  // 일이 아니다. 그래서 정답-해설이 어긋나면: (a) 정답이 선택지 안에 있으면 그 자리로 조용히 맞춰 저장하고
  // (b) 정답이 선택지 어디에도 없으면(실제 사례) 아예 **저장을 거부한다** — "오답 보강 대기"처럼 admin이
  // 보는 큐에 절대 들어가지 않는다. AI 배치 생성 경로는 이 거부를 실패로 받아 재생성하고, 수동 작성 경로는
  // 관리자가 그 자리에서 다시 계산해 고쳐야만 저장된다(초안으로 남지 않는다).
  let correctIndex = params.correctIndex;
  let explanation = params.explanation;
  let answerFixed = false;
  if (format === "mc" && params.options && params.options.length >= 2 && correctIndex !== null && explanation.trim()) {
    try {
      const { resolveAnswerFromExplanationCore } = await import("@/lib/problem-generation/core");
      const resolved = await resolveAnswerFromExplanationCore({
        stimulus: fullText, question: params.question ?? "", options: params.options, explanation,
      });
      if (!resolved.ok) {
        return { ok: false, error: "정답-해설이 서로 맞지 않습니다 — 해설이 어느 선택지도 명확히 뒷받침하지 않습니다. 계산이나 선택지를 다시 확인한 뒤 저장하세요." };
      }
      const isMathSystem = ((problemRow?.exam_system as string | null) ?? "").startsWith("sat_math");
      if (resolved.concludedIndex !== correctIndex) {
        // 2026-09-16(코드 검토 C, Math 한정) — 해설이 추론한 답으로 정답 키를 조용히 바꾸지 않는다. Math는
        // 정답이 계산으로 결정돼야 하므로 불일치 자체를 저장 거부 사유로 삼는다(직접 작성 편집 기능은 유지 —
        // 관리자가 정답이나 해설을 다시 고쳐 저장하면 된다). R&W는 기존 승인된 자동 반영 동작을 유지한다.
        if (isMathSystem) {
          return {
            ok: false,
            error: `정답-해설이 서로 맞지 않습니다 — 해설은 ${String.fromCharCode(65 + resolved.concludedIndex)}를 뒷받침하지만 지정 정답은 ${String.fromCharCode(65 + correctIndex)}입니다. Math는 정답을 자동으로 바꾸지 않으니 계산을 다시 확인해 정답 또는 해설을 고친 뒤 저장하세요.`,
          };
        }
        if (resolved.confidence === "high") {
          correctIndex = resolved.concludedIndex;
          explanation = resolved.cleanExplanation;
          answerFixed = true;
        }
      }
    } catch (e) {
      console.error("[problem-bank] 저장 시 정답-해설 대조 오류:", e instanceof Error ? e.message : e);
    }
  }

  // 자료 필수 문항(세부 기술·질문 문장으로 판정)은 자료 없이 저장하지 않는다(2026-09-14 제품 오너).
  const need = judgeMaterialNeed({ examSystem: (problemRow?.exam_system as string | null) ?? null, skillCode: (problemRow?.skill_code as string | null) ?? null, text: fullText });
  const blocker = materialBlocker(need, params.figure ?? null);
  if (blocker && fullText.trim()) return { ok: false, error: blocker };
  const contentIssues = checkContent({
    format, passage: fullText, options: params.options, correctIndex, explanation,
    answers: params.answers ?? null, statements: params.statements ?? null,
    // RW 구조화 자료 블록(2026-09-14): 세부 기술이 RW 코드인 문제만 — 옛 문제(코드 없음)는 의미를 확정할 수 없어 검사하지 않는다.
    skillCode: (problemRow?.skill_code as string | null | undefined) ?? null, figure: params.figure ?? null,
  });
  const fatal = contentIssues.find((i) => ["math_parse", "math_unclosed", "latex_leak"].includes(i.code));
  if (fatal) return { ok: false, error: `수식을 조판할 수 없어 저장하지 않았습니다 — ${fatal.message}` };
  const figureCheck = checkFigure(params.figure ?? null, fullText, params.options, correctIndex);
  if (figureCheck.issues.some((i) => i.code === "schema")) {
    return { ok: false, error: `그림 데이터가 규격에 맞지 않아 저장하지 않았습니다 — ${figureCheck.issues[0].message}` };
  }
  // 저장은 정규화된 spec 으로 — 옛 표기·교점 아닌 점이 원문에 남아 있으면 렌더·alt 가 깨진다(2026-09-15).
  const figureToSave: unknown | null = (() => {
    if (params.figure == null) return null;
    const fv = validateFigureSpec(params.figure);
    return fv.ok ? fv.spec : params.figure;
  })();
  const check: RenderCheck = { ...figureCheck, issues: [...figureCheck.issues, ...contentIssues], ok: figureCheck.ok && contentIssues.length === 0 };
  const { data, error } = await admin.rpc("save_problem_draft_version", {
    p_problem_id: params.problemId,
    p_passage: params.passage,
    p_options: params.options,
    p_correct_index: correctIndex,
    p_explanation: explanation,
    p_difficulty: params.difficulty,
    p_actor_id: adminUserId,
    p_answers: params.answers ?? null,
    p_figure: figureToSave,
    p_figure_checked: params.figureChecked ?? false,
    p_statements: params.statements && params.statements.length ? params.statements : null,
    p_question: params.question?.trim() || null,
    p_repair_status: params.repairStatus ?? null,
  });
  if (error) return { ok: false, error: readable(error.message, "초안을 저장하지 못했습니다.") };
  const { error: checkError } = await admin.rpc("set_problem_render_check", { p_version_id: data as string, p_check: check });
  if (checkError) return { ok: false, error: readable(checkError.message, "그림 검증 결과를 저장하지 못했습니다.") };
  return { ok: true, value: { versionId: data as string, answerFixed } };
}

/**
 * 문제 그림 파일 올리기(2026-09-14 ④). PNG·JPG·WEBP·SVG, 5MB 까지. 비공개 버킷에 두고 figure 데이터로 돌려준다 —
 * 편집 칸이 그 데이터를 그림 데이터에 넣는다. 공개는 여전히 '그림 확인함' 뒤.
 */
/** 올린 그림의 대체 설명(alt) — 공개에 필수(2026-09-14 결정 2). 편집 칸에서 figure 데이터에 넣는다. */
export async function uploadProblemImageAction(
  formData: FormData
): Promise<BankResult<{ type: "image"; bucket: string; path: string; alt: string }>> {
  await requireAdmin();
  const file = formData.get("file");
  const problemId = String(formData.get("problemId") ?? "");
  if (!(file instanceof File)) return { ok: false, error: "파일이 없습니다." };
  if (!problemId) return { ok: false, error: "문제를 알 수 없습니다." };
  const allowed: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
  const ext = allowed[file.type];
  if (!ext) return { ok: false, error: "PNG·JPG·WEBP·SVG 만 올릴 수 있습니다." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "5MB 이하만 올릴 수 있습니다." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const path = `${problemId}/${hash}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("problem-assets").upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: readable(error.message, "그림을 올리지 못했습니다.") };
  return { ok: true, value: { type: "image", bucket: "problem-assets", path, alt: file.name.replace(/\.[^.]+$/, "") } };
}

/** 이미 있는 문제의 그림 데이터만 AI 로 만든다(저장 안 함 — 편집 칸에 채운다). */
export async function generateFigureForProblemAction(params: {
  passage: string;
  options: string[] | null;
  explanation: string;
  kind: "plane" | "parallel_transversal" | "triangle" | "circle" | "polygon" | "solid" | "composite" | "data" | "figure_choice" | "figure_set";
  correctIndex?: number | null;
}): Promise<BankResult<unknown>> {
  await requireAdmin();
  const { generateFigureForProblem } = await import("./curriculum-doc-actions");
  try {
    const r = await generateFigureForProblem(params);
    return r.ok ? { ok: true, value: r.figure } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "그림을 만들지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
}

/** 관리자가 미리보기의 그림을 확인했다(2026-09-14 ③). 그림이 있는 버전은 이것 없이 공개되지 않는다. */
export async function markFigureCheckedAction(versionId: string, checked: boolean): Promise<BankResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.rpc("mark_problem_figure_checked", { p_version_id: versionId, p_checked: checked });
  if (error) return { ok: false, error: readable(error.message, "그림 확인을 저장하지 못했습니다.") };
  return { ok: true };
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

/**
 * 초안을 공개한다 — 사용자에게는 한 동작이다.
 *
 * 2026-09-13 확정: 지금은 관리자 본인이 작성·확인·공개를 다 한다. 그런데 화면이
 * "검수 요청"을 따로 누르게 해서, 자기 자신에게 검수를 요청하는 것처럼 보였다.
 * 사용자 흐름은 **초안 저장 → 미리보기·내용 확인 → 공개**다.
 *
 * DB 는 draft → in_review → published 순서를 강제하므로(20261293000000) 그 상태는
 * 그대로 유지하되, 두 단계를 여기서 이어 붙인다. 검수자 역할 분리는 후속 범위다.
 */
export async function publishDraftAction(versionId: string): Promise<BankResult> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();
  // 2026-09-15 제품 오너 — 정답-해설 대조는 여기서 하지 않는다. 초안이 저장되는 시점(createDraftVersionAction)에
  // 이미 끝났어야 한다 — "정답이 정정되어야 초안으로 들어와야지, 공개할 때 정정되면 안 된다." 공개는 순수한 게이트다.
  const { error } = await admin.rpc("confirm_and_publish_problem_version", {
    p_version_id: versionId,
    p_actor_id: adminUserId,
  });
  if (error) return { ok: false, error: readable(error.message, "공개하지 못했습니다.") };
  return { ok: true };
}

/**
 * 공개본을 바탕으로 수정 초안을 만든다.
 *
 * 공개된 버전은 고치지 않는다. 지금 공개본의 내용을 복사해 새 초안으로 넣고,
 * 그것을 고쳐 다시 공개하면 새 버전이 된다 — **기존 공개본은 그대로 쓰인다.**
 * 이미 저장된 준비안과 시작한 수업은 자기가 가리키는 버전을 계속 본다.
 */
export async function createDraftFromPublishedAction(
  problemId: string
): Promise<BankResult<{ versionId: string; reused: boolean }>> {
  await requireAdmin();
  const admin = createAdminClient();

  // 이미 작업 중인 초안이 있으면 **공개본으로 덮어쓰지 않는다.** 쓰던 내용을
  // 잃지 않도록 그것을 그대로 돌려주고, 화면이 "이어서 편집"임을 알린다.
  // 반복 클릭으로 초안이 늘어나지도 않는다.
  const { data: working } = await admin
    .from("problem_versions")
    .select("id, status")
    .eq("problem_id", problemId)
    .in("status", ["draft", "in_review"])
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (working) {
    return { ok: true, value: { versionId: working.id as string, reused: true } };
  }

  const { data: published } = await admin
    .from("problem_versions")
    .select("passage, question, options, correct_index, explanation, difficulty, answers, figure, statements")
    .eq("problem_id", problemId)
    .eq("status", "published")
    .maybeSingle();

  if (!published) return { ok: false, error: "공개된 버전이 없습니다." };

  const created = await createDraftVersionAction({
    problemId,
    passage: (published.passage as string | null) ?? "",
    question: (published.question as string | null) ?? null,
    options: (published.options as string[] | null) ?? null,
    correctIndex: (published.correct_index as number | null) ?? null,
    explanation: (published.explanation as string | null) ?? "",
    difficulty: (published.difficulty as string | null) ?? "",
    answers: (published.answers as string[] | null) ?? null,
    figure: published.figure ?? null,
    statements: Array.isArray(published.statements) ? (published.statements as string[]) : null,
    // 공개본의 그림은 이미 확인된 것이다 — 데이터가 그대로면 확인도 이어진다.
    figureChecked: published.figure != null,
  });
  if (!created.ok) return created;
  return { ok: true, value: { versionId: created.value.versionId, reused: false } };
}

/**
 * 유형·주제를 고친다.
 *
 * 둘 다 문제의 정체성 쪽 정보라 버전 내용(지문·선택지·정답·해설)과 다른 축이다 —
 * 고쳐도 공개본의 내용은 바뀌지 않고, 이미 고정된 준비안·수업도 그대로다.
 * 공개된 문제에서도 바로 고칠 수 있어야 한다.
 */
export async function updateProblemMetaAction(
  problemId: string,
  meta: { skillType?: string | null; topic?: string | null; skillCode?: string | null; satDomain?: string | null; examSystem?: string | null; apSubject?: string | null; format?: string }
): Promise<BankResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const patch: Record<string, string | null> = {};
  // 답안 형식 변경(2026-09-14): 공개본만 있는 문제는 화면이 막는다(수정 초안에서만). 숨겨지는 값(선택지·SPR 정답)은 버전에 그대로 남는다.
  if (meta.format !== undefined && ["mc", "spr", "essay", "math"].includes(meta.format)) patch.format = meta.format;
  // 문항 체계는 관리 과목·키워드와 독립이다 — 여기서 바꿔도 subject_id·problem_keywords 는 건드리지 않는다.
  if (meta.examSystem !== undefined) patch.exam_system = meta.examSystem?.trim() || null;
  if (meta.apSubject !== undefined) patch.ap_subject = meta.apSubject?.trim() || null;
  if (meta.skillType !== undefined) patch.skill_type = meta.skillType?.trim() || null;
  if (meta.topic !== undefined) patch.topic = meta.topic?.trim() || null;
  // 기술 코드를 정하면 영역은 트리거가 맞춘다. 코드를 비우고 영역만 둘 수도 있다.
  if (meta.skillCode !== undefined) patch.skill_code = meta.skillCode?.trim() || null;
  if (meta.satDomain !== undefined && !meta.skillCode) patch.sat_domain = meta.satDomain?.trim() || null;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await admin.from("problems").update(patch).eq("id", problemId);
  if (error) return { ok: false, error: readable(error.message, "분류·주제를 저장하지 못했습니다.") };
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
  /** 세부 기술 코드 — 프롬프트에 영역·기술 힌트가 들어가고, 만들어진 문제에 그대로 기록된다. */
  skillCode?: string;
  topic?: string;
  difficulty: string;
  format: string;
  count: number;
  keywordIds?: string[];
  /** 그림 요구: none | optional | require_plane | require_geometry (2026-09-14). */
  figurePolicy?: string;
  examSystem?: string;
  apSubject?: string;
}): Promise<BankResult<{ created: number; failures: string[]; requested: number; shortfall: number; stoppedReason: string }>> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: subject } = await admin
    .from("subjects")
    .select("name, archived_at")
    .eq("id", params.subjectId)
    .maybeSingle();
  if (!subject) return { ok: false, error: "존재하지 않는 과목입니다." };
  if (subject.archived_at) return { ok: false, error: "보관된 과목에는 문제를 만들 수 없습니다." };

  // 2026-09-17(제품 오너 지시, 전환 2단계) — "Linear equations in two variables"는
  // 이제 AI가 아니라 결정적 계산 컴파일러가 만든다(정답·오답·그래프 좌표를 전부
  // 코드로 계산). AI 호출이 아예 없으므로 ANTHROPIC_API_KEY 유무와 무관하게 동작한다.
  const MATH_COMPILER_SKILLS = new Set(["linear_equations_two_var"]);
  if (
    params.skillCode && MATH_COMPILER_SKILLS.has(params.skillCode) &&
    (params.difficulty === "easy" || params.difficulty === "medium" || params.difficulty === "hard")
  ) {
    // 2026-09-17(제품 오너 지시) — "요청 시작부터 저장 완료까지의 전체 벽시계 시간,
    // 컴파일 시간, DB 저장 시간, 렌더링 검증 시간을 분리 기록"한다. requestStart는
    // 이 서버 액션이 시작된 시점(관리자가 "AI로 만들기"를 누른 시점과 사실상 같다) —
    // dbSaveMs는 onAccepted 콜백(실제 Supabase 왕복) 안에서만 잰다. 컴파일·렌더링
    // 검증 시간은 배치 실행기가 별도로 재서 compilerTiming으로 돌려준다.
    const requestStart = Date.now();
    const { runMathCompilerBatch } = await import("@/lib/problem-generation/math-compilers/batch");
    const failures: string[] = [];
    let created = 0;
    let dbSaveMs = 0;
    const result = await runMathCompilerBatch({
      skillCode: params.skillCode as "linear_equations_two_var",
      difficulty: params.difficulty,
      count: params.count,
      onAccepted: async ({ problem: g, quality }) => {
        const t0 = Date.now();
        const problem = await createBankProblemAction({
          subjectId: params.subjectId, format: "mc", skillType: params.skillType, skillCode: params.skillCode,
          examSystem: params.examSystem, apSubject: params.apSubject, topic: params.topic, difficulty: params.difficulty, keywordIds: params.keywordIds,
        });
        if (!problem.ok) { failures.push(problem.error); dbSaveMs += Date.now() - t0; return; }
        const draft = await createDraftVersionAction({
          problemId: problem.value, passage: g.stimulus ?? g.passage, question: g.question ?? null, options: g.options ?? null, correctIndex: g.correctIndex ?? null,
          explanation: g.explanation, difficulty: params.difficulty, figure: g.figure ?? null,
        });
        if (!draft.ok) {
          failures.push(draft.error);
          await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problem.value);
          dbSaveMs += Date.now() - t0;
          return;
        }
        const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: draft.value.versionId, p_quality: quality });
        if (qErr) console.error("[problem-bank] 품질 기록 실패(계산형):", qErr.message);
        created += 1;
        dbSaveMs += Date.now() - t0;
      },
    });
    failures.push(...result.failures.filter((f) => !f.resolved).map((f) => f.reason));
    const totalRequestMs = Date.now() - requestStart;
    // AI 호출 계측 — 이 경로는 Anthropic 클라이언트를 아예 import하지 않으므로 항상 0이다.
    // (기존 AI 파이프라인 경로였다면 result.stats.modelCalls가 0보다 컸을 것.)
    console.log(JSON.stringify({
      event: "math_compiler_product_path_timing",
      skillCode: params.skillCode, difficulty: params.difficulty, requested: params.count,
      totalRequestMs, compileMs: result.compilerTiming.compileMs, renderCheckMs: result.compilerTiming.renderCheckMs,
      dbSaveMs, created, shortfall: result.stats.shortfall, stoppedReason: result.stats.stoppedReason,
      mathAiCallCount: 0,
    }));
    if (created === 0) {
      return { ok: false, error: `문제를 생성하지 못했습니다.${failures.length ? ` ${failures[0]}` : ""}` };
    }
    return {
      ok: true,
      value: { created, failures, requested: result.stats.requested, shortfall: result.stats.shortfall, stoppedReason: result.stats.stoppedReason },
    };
  }

  // AI 키가 없는 환경(예: 키를 심지 않은 Preview)에서 "생성하지 못했습니다"만
  // 돌려주면 관리자가 무엇을 해야 할지 알 수 없다. 설정 누락은 내부 오류가 아니라
  // 사람이 조치할 수 있는 사실이므로 구분해서 말한다.
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "이 환경에는 AI 생성이 설정되어 있지 않습니다. 직접 쓰기로 문제를 만들어 주세요.",
    };
  }

  // 2026-09-17(제품 오너 지시) — AI 생성의 정상 결과는 자동 검사를 모두 통과한
  // 완성 후보뿐이다. 오답만 걸린 문항을 '오답 보강 대기'로 저장해 관리자가 고치게
  // 하던 경로는 새 생성 경로에서 없앤다 — 파이프라인이 그런 문항을 그냥 실패로
  // 집계하고 다른 후보로 대체한다(상한 안에서). 문항 하나가 판정 나는 즉시
  // onAccepted로 그 자리에서 저장하므로, 나머지가 상한에 걸려 조기 종료해도
  // 이미 저장된 문항은 남는다.
  const failures: string[] = [];
  let created = 0;

  async function persistProblem(g: GeneratedProblem, quality: QualityRecord): Promise<void> {
    const problem = await createBankProblemAction({
      subjectId: params.subjectId, format: params.format, skillType: params.skillType, skillCode: params.skillCode,
      examSystem: params.examSystem, apSubject: params.apSubject, topic: params.topic, difficulty: params.difficulty, keywordIds: params.keywordIds,
    });
    if (!problem.ok) { failures.push(problem.error); return; }
    const draft = await createDraftVersionAction({
      problemId: problem.value, passage: g.stimulus ?? g.passage, question: g.question ?? null, options: g.options ?? null, correctIndex: g.correctIndex ?? null,
      explanation: g.explanation, difficulty: params.difficulty, answers: g.answers ?? null, figure: g.figure ?? null, statements: g.statements ?? null,
    });
    if (!draft.ok) {
      // 초안을 저장하지 못한 결과는 분리한다 — 빈 문제가 '질문 없는 초안'으로 남지 않게 바로 보관한다(삭제 아님).
      failures.push(draft.error);
      await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problem.value);
      return;
    }
    const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: draft.value.versionId, p_quality: quality });
    if (qErr) console.error("[problem-bank] 품질 기록 실패:", qErr.message);
    created += 1;
  }

  // 생성 → 자료 → 유형별 품질 계약 → 독립 품질 검사 → 통과분만(2026-09-15). 걸린 결과는 사유 피드백으로 1회 재생성.
  const { runGenerationPipeline } = await import("@/lib/problem-generation/pipeline");
  const result = await runGenerationPipeline({
    subjectName: subject.name as string,
    skillType: params.skillType,
    skillCode: params.skillCode ?? null,
    examSystem: params.examSystem ?? null,
    topic: params.topic,
    difficulty: params.difficulty as never,
    format: params.format as never,
    count: params.count,
    figurePolicy: (params.figurePolicy as never) ?? "optional",
    onAccepted: async ({ problem: g, quality }) => { await persistProblem(g, quality); },
  });
  failures.push(...result.failures.filter((f) => !f.resolved).map((f) => `${f.snippet} — ${f.reason}`));

  if (created === 0) {
    console.error("[problem-bank] AI 생성 결과를 저장하지 못했습니다:", failures, result.stats);
    return { ok: false, error: `문제를 생성하지 못했습니다.${failures.length ? ` ${failures[0]}` : ""}` };
  }
  return {
    ok: true,
    value: { created, failures, requested: result.stats.requested, shortfall: result.stats.shortfall, stoppedReason: result.stats.stoppedReason },
  };
}

/**
 * 기존 생성분 질문 집계(2026-09-14): 질문 있음 / 질문 없는 초안 / 질문 없는 공개본.
 * 공개본은 자동으로 고치지 않는다 — 관리자가 '질문 보완 필요' 표시를 보고 수정 초안 또는 재생성으로 처리한다.
 */
export async function problemQuestionAuditAction(subjectId?: string): Promise<BankResult<{ withQuestion: number; draftWithout: number; publishedWithout: number }>> {
  await requireAdmin();
  const admin = createAdminClient();
  let q = admin.from("problems").select("id").is("archived_at", null).limit(2000);
  if (subjectId) q = q.eq("subject_id", subjectId);
  const { data: rows, error } = await q;
  if (error) return { ok: false, error: "문제 목록을 읽지 못했습니다." };
  const ids = (rows ?? []).map((r) => r.id as string);
  if (!ids.length) return { ok: true, value: { withQuestion: 0, draftWithout: 0, publishedWithout: 0 } };
  const { data: versions } = await admin
    .from("problem_versions")
    .select("problem_id, status, version_no, passage, question")
    .in("problem_id", ids)
    .in("status", ["published", "draft", "in_review"])
    .order("version_no", { ascending: false });
  const latest = new Map<string, { status: string; has: boolean }>();
  for (const v of versions ?? []) {
    const pid = v.problem_id as string;
    const has = hasQuestion(v.passage as string | null, v.question as string | null);
    const cur = latest.get(pid);
    // 공개본 우선, 없으면 최신 작업본.
    if (!cur || (cur.status !== "published" && v.status === "published")) latest.set(pid, { status: v.status as string, has });
  }
  let withQuestion = 0, draftWithout = 0, publishedWithout = 0;
  for (const { status, has } of latest.values()) {
    if (has) withQuestion += 1;
    else if (status === "published") publishedWithout += 1;
    else draftWithout += 1;
  }
  return { ok: true, value: { withQuestion, draftWithout, publishedWithout } };
}

/** 옛 지문에서 질문을 갈라 초안에 넣을 때 쓴다(관리자가 '질문 보완' 을 눌렀을 때 — 자동 적용 없음). */
export async function suggestQuestionSplitAction(passage: string): Promise<BankResult<{ passage: string; question: string | null }>> {
  await requireAdmin();
  return { ok: true, value: splitLegacyQuestion(passage) };
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

/**
 * 오답 보강 대기 문항을 다시 검사한다(2026-09-15). 관리자가 지목된 오답을 고쳐 초안 저장(createDraftVersionAction)한 뒤 누른다.
 * 독립 검사를 다시 돌려 오답 품질이 통과하면 repair_status 를 'none' 으로 바꿔 일반 초안으로 전환한다(그 뒤부터 정상 공개 흐름).
 * 통과하지 못하면 draft 는 그대로 'needs_distractor_repair' 로 남고 새 사유를 보여준다 — 공개·자동 구성·학생 화면에는 들어가지 않는다.
 */
export async function recheckDistractorRepairAction(problemId: string): Promise<BankResult<{ passed: boolean; reasons: string[] }>> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: problemRow }, { data: versionRow }] = await Promise.all([
    admin.from("problems").select("format, skill_type, skill_code, exam_system, difficulty").eq("id", problemId).maybeSingle(),
    admin.from("problem_versions").select("id, passage, question, options, correct_index, answers, statements, figure, explanation, repair_status").eq("problem_id", problemId).in("status", ["draft", "in_review"]).order("version_no", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!problemRow || !versionRow) return { ok: false, error: "오답 보강 대기 초안을 찾을 수 없습니다." };
  if (versionRow.repair_status !== "needs_distractor_repair") return { ok: false, error: "이미 일반 초안입니다." };
  if (problemRow.format !== "mc") return { ok: false, error: "객관식 문항만 다시 검사할 수 있습니다." };

  const { reviewProblemIndependently, classifyReviewIssues } = await import("@/lib/problem-generation/review");
  const { skillLabel } = await import("@/lib/problem-taxonomy");
  const stimulus = (versionRow.passage as string | null) ?? "";
  const question = (versionRow.question as string | null) ?? "";
  const options = (versionRow.options as string[] | null) ?? [];
  const correctIndex = (versionRow.correct_index as number | null) ?? null;
  const difficulty = (problemRow.difficulty as string | null) ?? "medium";
  let review;
  try {
    review = await reviewProblemIndependently({
      skillLabel: (problemRow.skill_code ? skillLabel(problemRow.skill_code as string) : null) ?? (problemRow.skill_type as string | null) ?? "",
      examSystem: (problemRow.exam_system as string | null) ?? null,
      format: "mc", stimulus, question, options, statements: (versionRow.statements as string[] | null) ?? null,
      figure: versionRow.figure ?? null, correctIndex, answers: (versionRow.answers as string[] | null) ?? null, requestedDifficulty: difficulty,
    });
  } catch (e) {
    return { ok: false, error: `다시 검사하지 못했습니다 — ${e instanceof Error ? e.message : "오류"}` };
  }
  const issues = classifyReviewIssues(review, difficulty, "mc");
  const passed = issues.reasons.length === 0;
  const quality: QualityRecord = {
    contract: { ok: true, issues: [] },
    estimatedDifficulty: review.estimatedDifficulty,
    requestedDifficulty: difficulty,
    difficultyReasons: review.difficultyReasons,
    distractors: review.distractors,
    independentReview: { pickedIndex: review.pickedIndex, pickedAnswer: review.pickedAnswer, agrees: review.agrees, confidence: review.confidence, flags: review.flags },
    needsReview: !passed,
    needsReviewReasons: issues.reasons,
    calibrated: false,
    reviewedAt: new Date().toISOString(),
  };
  await admin.rpc("set_problem_quality", { p_version_id: versionRow.id, p_quality: quality });
  if (passed) {
    const { error } = await admin.from("problem_versions").update({ repair_status: "none" }).eq("id", versionRow.id);
    if (error) return { ok: false, error: "통과했지만 상태를 바꾸지 못했습니다." };
  }
  return { ok: true, value: { passed, reasons: issues.reasons } };
}
