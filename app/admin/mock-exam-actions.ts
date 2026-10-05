"use server";

// 고정형 SAT 모의고사 V1 — 관리자 세트 조립·공개 액션.
// 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3절(관리자 흐름)·5절(데이터 모델).
// 조립 알고리즘 자체(영역·난이도 비중 → 목표 문항 수 → 후보 선택)는 lib/mock-exam/assemble.ts에
// 순수 함수로 있고 여기서는 DB 조회·삽입만 담당한다.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  assembleSection,
  difficultyAllowedForModule,
  mstModulePlans,
  type AssembledItem,
  type DifficultyTier,
  type EligibleProblem,
  type ExamSection,
  type FormatWeight,
} from "@/lib/mock-exam/assemble";
import { findHangulInStem } from "@/lib/problem-text-guards";
import { loadMockExamSetContentForStaff, type MockExamSetContentItem } from "@/lib/mock-exam/set-content";
import { selectInChunks } from "@/lib/select-in-chunks";
import { fetchAlreadyUsedProblemIds } from "@/lib/mock-exam/used-problem-ids";

const RW_DOMAINS = ["rw_information_ideas", "rw_craft_structure", "rw_expression_ideas", "rw_standard_english"];
const MATH_DOMAINS = ["algebra", "advanced_math", "problem_solving_data", "geometry_trig"];

// 2026-09-21(UAT 지적) — 조립 로직이 영역·난이도만 보고 형식(mc/spr)은 전혀 고려하지 않아, Math
// 섹션이 전부 객관식으로만 채워질 수 있었다(실제 디지털 SAT Math는 객관식과 SPR이 섞여 나온다).
// 사양에 별도 비중 입력 UI는 없어(제품 오너가 이 축을 아예 정의한 적이 없다) 실제 디지털 SAT의
// 대략적인 구성비(약 75% 객관식 · 25% SPR)를 상수로 고정한다 — 필요하면 이후 관리자 입력값으로
// 옮길 수 있게 fetchWeights 와 같은 자리에 분리해 뒀다. R&W는 전부 객관식이라 적용하지 않는다.
const MATH_FORMAT_WEIGHTS: FormatWeight[] = [
  { format: "mc", weightPct: 75 },
  { format: "spr", weightPct: 25 },
];

export type MockExamSetSummary = {
  id: string;
  setGroupId: string;
  versionNo: number;
  name: string;
  difficultyTier: DifficultyTier;
  status: "draft" | "published" | "archived";
  format: "fixed" | "mst";
  readinessStatus: "not_applicable" | "ready" | "incomplete";
  readinessReport: MstReadinessReport | null;
  rwCount: number;
  mathCount: number;
  createdAt: string;
  publishedAt: string | null;
  /** 2026-10-05 무료 회원 S2 — free=무료 회원에게도 공개(공개+문항 구성 완료 세트만, DB 트리거가 강제). */
  accessTier: "free" | "tutoring";
};

/** includeArchived=false(기본, "생성/검토/공개" 서브탭용)면 보관된 세트를 뺀다.
 * "보관" 서브탭은 archivedOnly=true로 보관된 세트만 따로 본다. */
export async function listMockExamSets(
  opts: { includeArchived?: boolean; archivedOnly?: boolean } = {},
): Promise<MockExamSetSummary[]> {
  await requireAdmin();
  const db = createAdminClient();
  let query = db
    .from("mock_exam_sets")
    .select("id, set_group_id, version_no, name, difficulty_tier, status, format, readiness_status, readiness_report, created_at, published_at, access_tier")
    .order("created_at", { ascending: false });
  if (opts.archivedOnly) query = query.not("archived_at", "is", null);
  else if (!opts.includeArchived) query = query.is("archived_at", null);
  const { data: sets, error } = await query;
  if (error) throw new Error(error.message);

  // 문항 수는 DB에서 집계한다 — 전체 행을 읽어 세면 PostgREST 기본 1,000행 상한에 걸려 최신 세트가 0으로 보인다.
  const { data: itemCounts, error: countsErr } = await db.rpc("mock_exam_set_item_counts");
  if (countsErr) throw new Error(countsErr.message);
  const countsBySet = new Map<string, { rw: number; math: number }>();
  for (const row of (itemCounts ?? []) as { exam_set_id: string; rw_count: number; math_count: number }[]) {
    countsBySet.set(row.exam_set_id, { rw: row.rw_count, math: row.math_count });
  }

  return (sets ?? []).map((s) => ({
    id: s.id,
    setGroupId: s.set_group_id,
    versionNo: s.version_no,
    name: s.name,
    difficultyTier: s.difficulty_tier,
    status: s.status,
    rwCount: countsBySet.get(s.id)?.rw ?? 0,
    mathCount: countsBySet.get(s.id)?.math ?? 0,
    createdAt: s.created_at,
    publishedAt: s.published_at,
    format: (s.format ?? "fixed") as "fixed" | "mst",
    readinessStatus: (s.readiness_status ?? "not_applicable") as MockExamSetSummary["readinessStatus"],
    readinessReport: (s.readiness_report as MstReadinessReport | null) ?? null,
    accessTier: (s.access_tier === "free" ? "free" : "tutoring") as MockExamSetSummary["accessTier"],
  }));
}

/** 2026-10-05 무료 회원 S2 — 공개 세트의 무료 공개 여부 토글. 규칙(공개·보관 아님·MST는 ready)은 DB 트리거
 * mock_exam_sets_guard_access_tier 가 최종 방어선이고, 여기서는 그 오류 문구를 그대로 올린다. */
export async function setMockExamSetAccessTierAction(examSetId: string, accessTier: "free" | "tutoring"): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("mock_exam_sets").update({ access_tier: accessTier }).eq("id", examSetId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

function fetchEligiblePage(db: ReturnType<typeof createAdminClient>, domains: string[], from: number, to: number) {
  return db
    .from("problems")
    .select(
      `id, sat_domain, skill_code, format, similarity_group,
       problem_versions!problem_versions_problem_id_fkey!inner(id, status, difficulty, passage, question, options)`,
    )
    .in("sat_domain", domains)
    .eq("status", "confirmed")
    // 용도(2026-09-29): 모의고사용·기존(both)만. 일반용은 수업·과제 전용이라 조립 후보가 아니다(DB 트리거도 막는다).
    .in("usage_scope", ["mock_exam", "both"])
    .is("archived_at", null)
    .eq("problem_versions.status", "published")
    .order("id", { ascending: true })
    .range(from, to);
}

async function fetchEligibleProblems(db: ReturnType<typeof createAdminClient>, domains: string[]): Promise<EligibleProblem[]> {
  // 공개 문항만: problems.status='confirmed', archived_at is null, 공개된(published) 버전 존재.
  // PostgREST 기본 1,000행 상한: 문제은행이 커지면 후보가 조용히 잘려 skill·난이도 셀이 비므로 페이지를 돌며 전부 읽는다.
  const PAGE = 1000;
  const data: NonNullable<Awaited<ReturnType<typeof fetchEligiblePage>>["data"]> = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await fetchEligiblePage(db, domains, from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    data.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }

  const eligible: EligibleProblem[] = [];
  for (const row of data ?? []) {
    const versions = Array.isArray(row.problem_versions) ? row.problem_versions : [row.problem_versions];
    const version = versions[0];
    if (!version || !row.sat_domain) continue;
    const difficulty = (version.difficulty ?? "").toLowerCase();
    if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") continue;
    // 모의고사는 자동 채점 가능한 형식(mc/spr)만 조립 후보로 쓴다 — 서술형·풀이형(essay/math)은
    // 채점 확정이 필요해 이번 라운드의 "제출 즉시 자동 채점" 정책과 맞지 않는다.
    if (row.format !== "mc" && row.format !== "spr") continue;
    // 2026-10-02 UAT C1 — 영어 SAT 시험에 한글 지문·질문·선택지 문항이 섞이지 않게 후보에서 뺀다(해설은 무관).
    if (findHangulInStem({ passage: version.passage, question: version.question, options: version.options as string[] | null }).length) continue;
    eligible.push({
      problemId: row.id,
      problemVersionId: version.id,
      satDomain: row.sat_domain,
      skillCode: row.skill_code,
      difficulty,
      format: row.format,
      similarityGroup: row.similarity_group ?? null,
    });
  }
  return eligible;
}

async function fetchWeights(db: ReturnType<typeof createAdminClient>, tier: DifficultyTier, section: ExamSection) {
  const [{ data: domainRows, error: domainErr }, { data: diffRows, error: diffErr }] = await Promise.all([
    db.from("mock_exam_domain_weights").select("sat_domain, weight_pct").eq("difficulty_tier", tier).eq("section", section),
    db.from("mock_exam_difficulty_weights").select("problem_difficulty, weight_pct").eq("difficulty_tier", tier).eq("section", section),
  ]);
  if (domainErr) throw new Error(domainErr.message);
  if (diffErr) throw new Error(diffErr.message);
  return {
    domainWeights: (domainRows ?? []).map((r) => ({ satDomain: r.sat_domain, weightPct: Number(r.weight_pct) })),
    difficultyWeights: (diffRows ?? []).map((r) => ({
      difficulty: r.problem_difficulty as "easy" | "medium" | "hard",
      weightPct: Number(r.weight_pct),
    })),
  };
}

/** 노출 이력(세트 포함 횟수 + 응답 저장 횟수) — 조립 시 덜 노출된 문항을 우선한다. */
async function fetchExposureCounts(db: ReturnType<typeof createAdminClient>): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc("mock_exam_problem_exposure_counts").range(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { problem_id: string; set_count: number; attempt_count: number }[];
    for (const r of rows) map.set(r.problem_id, r.set_count + r.attempt_count);
    if (rows.length < 1000) break;
  }
  return map;
}

export type AssembleMockExamSetInput = {
  name: string;
  description?: string;
  difficultyTier: DifficultyTier;
  rwCount: number;
  mathCount: number;
  rwTimeLimitMinutes?: number;
  mathTimeLimitMinutes?: number;
  /** 'mst'면 Digital SAT 4모듈(R&W 27+27, Math 22+22)로 조립하고 rwCount/mathCount는 무시한다. */
  format?: "fixed" | "mst";
  /** mst만. true(기본)면 Module 2를 higher/lower 두 변형으로 조립한다(Phase 3 라우팅). false면 Phase 1/2와 같은 4모듈. */
  routing?: boolean;
};

// MST 청사진 — lib/mock-exam/mst.ts MST_BLUEPRINT와 같은 값(서버 액션은 "use server" 파일이라
// 상수 re-export를 피하고 여기 복제). 모듈 position은 V1 unique(exam_set_id, section, position)
// 때문에 섹션 안에서 연속 번호를 쓴다(rw 1..54, math 1..44).
const MST_TIME_LIMITS = { rw_m1: 1920, rw_m2: 1920, break: 600, math_m1: 2100, math_m2: 2100 };

export type AssembleShortfall = {
  section: ExamSection;
  /** mst 조립에서만 채워진다(고정형은 null). */
  moduleKey: string | null;
  /** 라우팅 M2 변형(higher/lower). 그 외 null/undefined. */
  route?: string | null;
  satDomain: string;
  difficulty: string;
  format?: string;
  needed: number;
  found: number;
};

/** 4모듈 세트의 출시 가능 여부. modules는 모듈·경로(Phase 3 higher/lower)별 정원 충족 여부,
 * shortfalls는 조립이 못 채운 영역·난이도·형식 셀(관리자에게 그대로 보여준다). */
export type MstReadinessReport = {
  ready: boolean;
  duplicateCount: number;
  modules: { moduleKey: string; route: string | null; needed: number; found: number; ok: boolean }[];
  shortfalls: AssembleShortfall[];
  /** Phase 2 검증(세트에 assembly_rules가 있을 때만 강제). 없으면 빈 배열/0. */
  missingSnapshotCount: number;
  skillViolations: { moduleKey: string; route: string | null; satDomain: string; skillCode: string; count: number; cap: number }[];
  /** skill 쏠림 경고(출시 차단 아님, 2026-09-29 오너 결정). skillHardGate 규칙이 켜진 세트만 skillViolations로 나온다. */
  skillWarnings: { moduleKey: string; route: string | null; satDomain: string; skillCode: string; count: number; cap: number }[];
  eligibilityViolations: { moduleKey: string; setItemId: string; difficulty: string }[];
  similarityViolations: { similarityGroup: string; count: number }[];
  /** Phase 3 라우팅 검증(routing=true 세트). 비라우팅 세트는 false/0/빈 배열. */
  routing: boolean;
  routeShapeViolationCount: number;
  variantEligibilityViolations: { moduleKey: string; route: string; setItemId: string; difficulty: string }[];
  routingPolicyMissing: string[];
  checkedAt: string;
};

export type AssembleMockExamSetResult = {
  examSetId: string;
  shortfalls: AssembleShortfall[];
  /** mst 세트만. 고정형은 null. */
  readiness: MstReadinessReport | null;
};

// 조립 규칙(세트 assembly_rules에 저장돼 DB 검증이 같은 규칙을 강제한다).
// skillMaxSharePct: 모듈·영역 안에서 한 skill이 차지할 수 있는 최대 비율(%) — 경고 기준. 2026-09-29 오너 결정으로 하드 게이트는 꺼져 있고
// (skillHardGate 미설정), 다시 켜려면 skillHardGate: true를 넣는다.
const MST_ASSEMBLY_RULES = { skillMaxSharePct: 50, enforceM1Eligibility: true, noSimilarGroupRepeat: true };
// 라우팅(Phase 3): assembly_rules.routing=true인 세트만 M2 변형·경로 결정이 동작한다. 없는 세트는 이전 동작 그대로.
const MST_ROUTING_ASSEMBLY_RULES = { ...MST_ASSEMBLY_RULES, routing: true };
const MST_ITEM_COUNTS = { rw_m1: 27, rw_m2: 27, math_m1: 22, math_m2: 22 };

/** 세트의 모듈·경로별 정원 충족을 DB 함수로 검증하고 결과를 세트 행에 기록한다. 배정·공개 게이트(트리거)와
 * mock_exam_start_mst()가 같은 함수를 다시 호출하므로, 여기 기록은 관리자 표시용이고 최종 방어는 DB다. */
async function recordMstReadiness(
  db: ReturnType<typeof createAdminClient>,
  examSetId: string,
  shortfalls: AssembleShortfall[],
): Promise<MstReadinessReport> {
  const { data, error } = await db.rpc("mock_exam_validate_mst_set", { p_exam_set_id: examSetId });
  if (error) throw new Error(error.message);
  const v = data as Partial<MstReadinessReport> & { ready: boolean };
  const report: MstReadinessReport = {
    ready: v.ready,
    duplicateCount: v.duplicateCount ?? 0,
    modules: v.modules ?? [],
    missingSnapshotCount: v.missingSnapshotCount ?? 0,
    skillViolations: v.skillViolations ?? [],
    skillWarnings: v.skillWarnings ?? [],
    eligibilityViolations: v.eligibilityViolations ?? [],
    similarityViolations: v.similarityViolations ?? [],
    routing: v.routing ?? false,
    routeShapeViolationCount: v.routeShapeViolationCount ?? 0,
    variantEligibilityViolations: v.variantEligibilityViolations ?? [],
    routingPolicyMissing: v.routingPolicyMissing ?? [],
    shortfalls,
    checkedAt: new Date().toISOString(),
  };
  const { error: updErr } = await db
    .from("mock_exam_sets")
    .update({ readiness_status: report.ready ? "ready" : "incomplete", readiness_report: report, readiness_checked_at: report.checkedAt })
    .eq("id", examSetId);
  if (updErr) throw new Error(updErr.message);
  return report;
}

/** 관리자 흐름 1단계: 후보 문항 풀에서 비중대로 세트를 조립하고 draft로 저장한다(사양 3절 1~2). */
export async function assembleMockExamSet(input: AssembleMockExamSetInput): Promise<AssembleMockExamSetResult> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();

  if (!input.name.trim()) throw new Error("세트 이름을 입력하세요.");
  if ((input.format ?? "fixed") === "fixed" && (input.rwCount <= 0 || input.mathCount <= 0)) {
    throw new Error("R&W·Math 문항 수는 1 이상이어야 합니다.");
  }

  const [rwCandidatesRaw, mathCandidatesRaw, rwWeights, mathWeights, excludeIds, exposure] = await Promise.all([
    fetchEligibleProblems(db, RW_DOMAINS),
    fetchEligibleProblems(db, MATH_DOMAINS),
    fetchWeights(db, input.difficultyTier, "rw"),
    fetchWeights(db, input.difficultyTier, "math"),
    fetchAlreadyUsedProblemIds(db, input.difficultyTier),
    fetchExposureCounts(db),
  ]);
  const withExposure = (list: EligibleProblem[]) => list.map((c) => ({ ...c, exposureCount: exposure.get(c.problemId) ?? 0 }));
  const rwCandidates = withExposure(rwCandidatesRaw);
  const mathCandidates = withExposure(mathCandidatesRaw);

  const format = input.format ?? "fixed";
  const routing = format === "mst" && (input.routing ?? true);
  type ModuleItem = AssembledItem & { moduleKey: string | null; route: "higher" | "lower" | null };
  const allItems: ModuleItem[] = [];
  const shortfalls: AssembleMockExamSetResult["shortfalls"] = [];

  if (format === "mst") {
    // 모듈(라우팅이면 M2 higher/lower 변형 포함)마다 같은 tier 가중치로 조립하되, 세트 안에서 이미 뽑힌 문항은
    // 후보에서 아예 빼서 모듈 간·변형 간 중복을 원천 차단한다(assembleSection의 excludeProblemIds는 부족하면
    // 재사용하므로 그 경로에 맡기지 않는다). DB unique(exam_set_id, problem_id)가 최종 방어선이라 같은 문항을
    // 두 변형에 넣는 것은 불가능하다 — 풀이 부족하면 해당 셀이 shortfall 로 남아 readiness=incomplete.
    const usedInSet = new Set<string>();
    const usedGroups = new Set<string>(); // 유사문항 그룹은 세트 전체에서 하나만
    const hardReused = new Set<string>(); // 후보 부족으로 어쩔 수 없이 재사용한 hard 문항(다른 세트와 겹침)
    const offsets: Record<ExamSection, number> = { rw: 0, math: 0 };
    for (const mod of mstModulePlans(routing)) {
      const isRw = mod.section === "rw";
      // 난이도 배정 가능 범위로 비중을 좁혀 다시 배분한다: M1·lower = easy·medium, higher = medium·hard.
      const weights = isRw ? rwWeights : mathWeights;
      const difficultyWeights = weights.difficultyWeights.filter((d) => difficultyAllowedForModule(mod, d.difficulty));
      if (difficultyWeights.length === 0) throw new Error(`${mod.key}${mod.route ? `/${mod.route}` : ""}: 배정 가능한 난이도 비중이 없습니다.`);
      const result = assembleSection({
        section: mod.section,
        totalCount: mod.count,
        domainWeights: weights.domainWeights,
        difficultyWeights,
        candidates: (isRw ? rwCandidates : mathCandidates).filter(
          (c) => !usedInSet.has(c.problemId) && difficultyAllowedForModule(mod, c.difficulty),
        ),
        excludeProblemIds: excludeIds,
        formatWeights: isRw ? undefined : MATH_FORMAT_WEIGHTS,
        hardIgnoreFormat: true,
        // hard 문항은 다른 세트에서 쓴 것을 하드 제외한다(부족할 때만 재사용 — hardReused 에 기록).
        selection: { skillUse: new Map(), usedGroups, hardExcludeIds: excludeIds, hardReused },
      });
      for (const item of result.items) {
        usedInSet.add(item.problemId);
        allItems.push({ ...item, position: item.position + offsets[mod.section], moduleKey: mod.key, route: mod.route });
      }
      offsets[mod.section] += result.items.length;
      shortfalls.push(...result.shortfalls.map((s) => ({ section: mod.section, moduleKey: mod.key, route: mod.route, ...s })));
    }
    if (hardReused.size > 0) console.warn(`[mock-exam] hard 후보 부족으로 다른 세트와 겹친 문항 ${hardReused.size}건: ${[...hardReused].slice(0, 10).join(", ")}`);
  } else {
    const rwResult = assembleSection({
      section: "rw",
      totalCount: input.rwCount,
      domainWeights: rwWeights.domainWeights,
      difficultyWeights: rwWeights.difficultyWeights,
      candidates: rwCandidates,
      excludeProblemIds: excludeIds,
    });
    const mathResult = assembleSection({
      section: "math",
      totalCount: input.mathCount,
      domainWeights: mathWeights.domainWeights,
      difficultyWeights: mathWeights.difficultyWeights,
      candidates: mathCandidates,
      excludeProblemIds: excludeIds,
      formatWeights: MATH_FORMAT_WEIGHTS,
      hardIgnoreFormat: true,
    });
    allItems.push(...[...rwResult.items, ...mathResult.items].map((i) => ({ ...i, moduleKey: null, route: null })));
    shortfalls.push(
      ...rwResult.shortfalls.map((s) => ({ section: "rw" as const, moduleKey: null, ...s })),
      ...mathResult.shortfalls.map((s) => ({ section: "math" as const, moduleKey: null, ...s })),
    );
  }

  const { data: setRow, error: setErr } = await db
    .from("mock_exam_sets")
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      difficulty_tier: input.difficultyTier,
      status: "draft",
      format,
      module_time_limits: format === "mst" ? MST_TIME_LIMITS : null,
      module_item_counts: format === "mst" ? MST_ITEM_COUNTS : null,
      assembly_rules: format === "mst" ? (routing ? MST_ROUTING_ASSEMBLY_RULES : MST_ASSEMBLY_RULES) : null,
      rw_time_limit_minutes: input.rwTimeLimitMinutes ?? 64,
      math_time_limit_minutes: input.mathTimeLimitMinutes ?? 70,
      created_by: adminUserId,
    })
    .select("id")
    .single();
  if (setErr) throw new Error(setErr.message);

  if (allItems.length > 0) {
    const { error: itemsErr } = await db.from("mock_exam_set_items").insert(
      allItems.map((item) => ({
        exam_set_id: setRow.id,
        section: item.section,
        position: item.position,
        problem_id: item.problemId,
        problem_version_id: item.problemVersionId,
        sat_domain: item.satDomain,
        skill_code: item.skillCode,
        difficulty: item.difficulty,
        module_key: item.moduleKey,
        route: item.route,
      })),
    );
    if (itemsErr) throw new Error(itemsErr.message);
  }

  // 출시 조건(2026-09-28): mst 세트는 조립 직후 모듈·경로별 정원 충족을 검증해 ready/incomplete를 기록한다.
  // incomplete면 공개·배정이 DB 트리거에서 거부되고, 학생은 Module 2에서 막히는 일 없이 애초에 시작할 수 없다.
  const readiness = format === "mst" ? await recordMstReadiness(db, setRow.id, shortfalls) : null;

  revalidatePath("/admin");
  return { examSetId: setRow.id, shortfalls, readiness };
}

export type MockExamSetItemDetail = {
  id: string;
  section: ExamSection;
  position: number;
  problemId: string;
  satDomain: string;
  skillCode: string | null;
  difficulty: string;
  /** mst 세트만(고정형은 null). */
  moduleKey: string | null;
  /** 라우팅 세트의 M2 변형(higher/lower). 직원 전용 — 학생·보호자 화면에는 절대 쓰지 않는다. */
  route: "higher" | "lower" | null;
  /** M1/M2(higher/lower) 배정 가능 플래그 — difficulty에서 파생(DB generated column). */
  m1Eligible: boolean;
  m2LowerEligible: boolean;
  m2HigherEligible: boolean;
};

/** 관리자 흐름 2단계: 조립된 세트를 검토한다(사양 3절 2~3의 "확인 후 공개"). */
export async function getMockExamSetItems(examSetId: string): Promise<MockExamSetItemDetail[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("mock_exam_set_items")
    .select("id, section, position, problem_id, sat_domain, skill_code, difficulty, module_key, route, m1_eligible, m2_lower_eligible, m2_higher_eligible")
    .eq("exam_set_id", examSetId)
    .order("section", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    section: r.section,
    position: r.position,
    problemId: r.problem_id,
    satDomain: r.sat_domain,
    skillCode: r.skill_code,
    difficulty: r.difficulty,
    moduleKey: r.module_key,
    route: r.route ?? null,
    m1Eligible: r.m1_eligible,
    m2LowerEligible: r.m2_lower_eligible,
    m2HigherEligible: r.m2_higher_eligible,
  }));
}

/**
 * 관리자 흐름 3단계: 세트를 공개한다(사양 3절 3, 5절). 같은 계열의 기존 공개본이 있으면
 * 새 버전으로 교체한다(archived로 내림) — DB의 부분 유니크 인덱스(mock_exam_sets_one_published_per_group)를
 * 어기지 않도록 트랜잭션 순서를 지킨다: 기존 공개본 archive → 새 버전 publish.
 */
export type MockExamPoolRow = {
  satDomain: string;
  skillCode: string | null;
  /** 모의고사용 공개 문항 수. */
  mockExam: number;
  /** 기존(용도 미분류) 공개 문항 수 — 수업·모의고사 양쪽 후보. */
  both: number;
  /** 일반용 공개 문항 수 — 모의고사 후보가 아님(참고). */
  general: number;
  /** 풀(모의고사용 + 기존) 중 공개된 세트에 배정된 서로 다른 문항 수. */
  assignedPublished: number;
  /** 풀 중 초안(검토 중) 세트에만 배정된 서로 다른 문항 수(공개 세트에도 있으면 위에서만 센다). */
  assignedDraft: number;
};

/** 영역·세부 기술별 용도 풀 크기(공개 문항 기준, 보관 제외) — 모의고사 풀이 충분한지 보는 용도. */
export async function getMockExamPoolSummaryAction(): Promise<MockExamPoolRow[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db.rpc("mock_exam_pool_usage");
  if (error) throw new Error(error.message);
  const byKey = new Map<string, MockExamPoolRow>();
  for (const r of (data ?? []) as {
    sat_domain: string; skill_code: string | null; usage_scope: string;
    published: number | string; assigned_published: number | string; assigned_draft: number | string;
  }[]) {
    const key = `${r.sat_domain}|${r.skill_code ?? ""}`;
    const row = byKey.get(key) ?? { satDomain: r.sat_domain, skillCode: r.skill_code, mockExam: 0, both: 0, general: 0, assignedPublished: 0, assignedDraft: 0 };
    const n = Number(r.published);
    if (r.usage_scope === "general") row.general += n; // 일반용은 후보가 아니므로 배정 수는 세지 않는다.
    else {
      if (r.usage_scope === "mock_exam") row.mockExam += n;
      else row.both += n;
      row.assignedPublished += Number(r.assigned_published);
      row.assignedDraft += Number(r.assigned_draft);
    }
    byKey.set(key, row);
  }
  return Array.from(byKey.values()).sort((a, b) => a.satDomain.localeCompare(b.satDomain) || (a.skillCode ?? "").localeCompare(b.skillCode ?? ""));
}

export async function publishMockExamSet(examSetId: string): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();

  const { data: target, error: targetErr } = await db
    .from("mock_exam_sets")
    .select("id, set_group_id, status")
    .eq("id", examSetId)
    .single();
  if (targetErr) throw new Error(targetErr.message);
  if (target.status !== "draft") throw new Error("draft 상태의 세트만 공개할 수 있습니다.");
  // mst 출시 조건: 공개 직전에 최신 상태로 다시 검증한다(DB 트리거가 최종 방어선이지만, 관리자에게는
  // 부족한 모듈·영역·난이도를 구체적으로 보여주기 위해 여기서 먼저 잡는다).
  const { data: fmtRow } = await db.from("mock_exam_sets").select("format, readiness_report").eq("id", examSetId).single();
  if (fmtRow?.format === "mst") {
    const prev = (fmtRow.readiness_report as MstReadinessReport | null) ?? null;
    const report = await recordMstReadiness(db, examSetId, prev?.shortfalls ?? []);
    if (!report.ready) {
      const missing = report.modules.filter((m) => !m.ok).map((m) => `${m.moduleKey}${m.route ? `/${m.route}` : ""} ${m.found}/${m.needed}`);
      throw new Error(`문항 구성이 완료되지 않아 공개할 수 없습니다: ${missing.join(", ")}`);
    }
  }

  const { count: itemCount, error: countErr } = await db
    .from("mock_exam_set_items")
    .select("id", { count: "exact", head: true })
    .eq("exam_set_id", examSetId);
  if (countErr) throw new Error(countErr.message);
  if (!itemCount) throw new Error("문항이 없는 세트는 공개할 수 없습니다.");

  const { error: archiveErr } = await db
    .from("mock_exam_sets")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("set_group_id", target.set_group_id)
    .eq("status", "published");
  if (archiveErr) throw new Error(archiveErr.message);

  const { error: publishErr } = await db
    .from("mock_exam_sets")
    .update({ status: "published", published_at: new Date().toISOString(), published_by: adminUserId })
    .eq("id", examSetId);
  if (publishErr) throw new Error(publishErr.message);

  revalidatePath("/admin");
}

/** 관리자 흐름 "보관" — 초안·공개 어느 상태든 더 이상 쓰지 않을 세트를 보관 처리한다.
 * 공개본을 보관하면 그 계열(set_group_id)에는 더 이상 공개된 버전이 없어지지만, 이미
 * 배정·응시된 attempts는 exam_set_id를 그대로 참조하므로 과거 응시 기록·결과는 안 깨진다
 * (2026-09-17 사양 5절 스냅샷 원칙과 동일). */
export async function archiveMockExamSetAction(examSetId: string): Promise<void> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("mock_exam_sets")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", examSetId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

/** 관리자 흐름 "검토" — 조립된 세트의 실제 문항 내용(지문·질문·선택지·정답·해설·그림)을 본다
 * (2026-09-21 UAT 지적: 기존 검토 화면은 영역·난이도 메타데이터뿐이었다). */
export async function getMockExamSetContentAction(examSetId: string): Promise<MockExamSetContentItem[]> {
  const { supabase } = await requireAdmin();
  return loadMockExamSetContentForStaff(supabase, examSetId);
}

export type MockExamAttemptHistoryRow = {
  attemptId: string;
  studentId: string;
  studentName: string | null;
  examSetName: string;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  totalCount: number;
  correctCount: number | null;
  /** 라우팅 세트: Module 2 경로와 결정에 쓴 정책 버전(직원 전용). 비라우팅·미결정이면 null. */
  rwRoute: "higher" | "lower" | null;
  mathRoute: "higher" | "lower" | null;
  rwPolicyVersion: number | null;
  mathPolicyVersion: number | null;
};

/** 관리자 흐름 "내역" — 학생이 직접 시작한 응시 내역(최근 200건, 시작 전 제외). 배정은 폐지됐다(2026-10-01). */
export async function listAllMockExamAttemptsAction(): Promise<MockExamAttemptHistoryRow[]> {
  await requireAdmin();
  const db = createAdminClient();

  const { data: attempts, error } = await db
    .from("mock_exam_attempts")
    .select("id, student_id, exam_set_id, status, started_at, submitted_at, graded_at, rw_m2_route, math_m2_route, rw_m2_route_policy_version, math_m2_route_policy_version")
    .neq("status", "assigned")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  if (!attempts || attempts.length === 0) return [];

  const studentIds = Array.from(new Set(attempts.map((a) => a.student_id)));
  const examSetIds = Array.from(new Set(attempts.map((a) => a.exam_set_id)));
  const [{ data: profiles }, { data: sets }, expectedCounts, { data: answers }] = await Promise.all([
    selectInChunks(studentIds, (chunk) => db.from("profiles").select("id, name").in("id", chunk)),
    selectInChunks(examSetIds, (chunk) => db.from("mock_exam_sets").select("id, name").in("id", chunk)),
    // 응시자가 실제로 풀 문항 수(라우팅 세트는 M2 변형 하나만 센다) — DB에서 집계(1,000행 상한 회피).
    db.rpc("mock_exam_set_expected_counts"),
    // 채점 완료 응시만, 응시당 문항 ~100개 × 청크 8 < PostgREST 1,000행 상한.
    selectInChunks(attempts.filter((a) => a.status === "graded").map((a) => a.id), (chunk) => db.from("mock_exam_answers").select("attempt_id, correct").in("attempt_id", chunk), 8),
  ]);
  const nameByStudent = new Map((profiles ?? []).map((p) => [p.id, p.name as string | null]));
  const nameBySet = new Map((sets ?? []).map((s) => [s.id, s.name as string]));
  const totalCountBySet = new Map<string, number>();
  if (expectedCounts.error) throw new Error(expectedCounts.error.message);
  for (const row of (expectedCounts.data ?? []) as { exam_set_id: string; total_count: number }[]) totalCountBySet.set(row.exam_set_id, row.total_count);
  const correctCountByAttempt = new Map<string, number>();
  for (const row of answers ?? []) {
    if (row.correct) correctCountByAttempt.set(row.attempt_id, (correctCountByAttempt.get(row.attempt_id) ?? 0) + 1);
  }

  return attempts.map((a) => ({
    attemptId: a.id,
    studentId: a.student_id,
    studentName: nameByStudent.get(a.student_id) ?? null,
    examSetName: nameBySet.get(a.exam_set_id) ?? "모의고사",
    status: a.status,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
    gradedAt: a.graded_at,
    totalCount: totalCountBySet.get(a.exam_set_id) ?? 0,
    correctCount: a.status === "graded" ? (correctCountByAttempt.get(a.id) ?? 0) : null,
    rwRoute: a.rw_m2_route ?? null,
    mathRoute: a.math_m2_route ?? null,
    rwPolicyVersion: a.rw_m2_route_policy_version ?? null,
    mathPolicyVersion: a.math_m2_route_policy_version ?? null,
  }));
}

export type MockExamRoutingPolicyRow = {
  section: "rw" | "math";
  thresholdType: "correct_ratio" | "correct_count";
  thresholdValue: number;
  version: number;
  active: boolean;
  note: string | null;
  createdAt: string;
};

/** 라우팅 정책(섹션별 활성 + 이전 버전). 읽기 전용 표시 — 값은 DB 데이터이고 새 버전은 mock_exam_set_routing_policy 로 발행한다. */
export async function listMockExamRoutingPoliciesAction(): Promise<MockExamRoutingPolicyRow[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("mock_exam_routing_policies")
    .select("section, threshold_type, threshold_value, version, active, note, created_at")
    .order("section", { ascending: true })
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    section: r.section,
    thresholdType: r.threshold_type,
    thresholdValue: Number(r.threshold_value),
    version: r.version,
    active: r.active,
    note: r.note,
    createdAt: r.created_at,
  }));
}
