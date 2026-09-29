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
  moduleEligibility,
  type AssembledItem,
  type DifficultyTier,
  type EligibleProblem,
  type ExamSection,
  type FormatWeight,
} from "@/lib/mock-exam/assemble";
import { loadMockExamSetContentForStaff, type MockExamSetContentItem } from "@/lib/mock-exam/set-content";
import { selectInChunks } from "@/lib/select-in-chunks";

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
    .select("id, set_group_id, version_no, name, difficulty_tier, status, format, readiness_status, readiness_report, created_at, published_at")
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
  }));
}

function fetchEligiblePage(db: ReturnType<typeof createAdminClient>, domains: string[], from: number, to: number) {
  return db
    .from("problems")
    .select(
      `id, sat_domain, skill_code, format, similarity_group,
       problem_versions!problem_versions_problem_id_fkey!inner(id, status, difficulty)`,
    )
    .in("sat_domain", domains)
    .eq("status", "confirmed")
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

/** 다른(공개된) 세트가 이미 쓴 문항 id — 가능하면 겹치지 않게 피한다(사양 5절 "이상적으로 세트 간에도"). */
async function fetchAlreadyUsedProblemIds(db: ReturnType<typeof createAdminClient>, tier: DifficultyTier): Promise<Set<string>> {
  const { data: publishedSets, error } = await db
    .from("mock_exam_sets")
    .select("id")
    .eq("difficulty_tier", tier)
    .eq("status", "published");
  if (error) throw new Error(error.message);
  const setIds = (publishedSets ?? []).map((s) => s.id);
  if (setIds.length === 0) return new Set();
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: page, error: pageErr } = await db
      .from("mock_exam_set_items")
      .select("problem_id")
      .in("exam_set_id", setIds)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (pageErr) throw new Error(pageErr.message);
    for (const i of page ?? []) ids.add(i.problem_id);
    if (!page || page.length < 1000) break;
  }
  return ids;
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
};

// MST 청사진 — lib/mock-exam/mst.ts MST_BLUEPRINT와 같은 값(서버 액션은 "use server" 파일이라
// 상수 re-export를 피하고 여기 복제). 모듈 position은 V1 unique(exam_set_id, section, position)
// 때문에 섹션 안에서 연속 번호를 쓴다(rw 1..54, math 1..44).
const MST_MODULES: { key: "rw_m1" | "rw_m2" | "math_m1" | "math_m2"; section: ExamSection; count: number }[] = [
  { key: "rw_m1", section: "rw", count: 27 },
  { key: "rw_m2", section: "rw", count: 27 },
  { key: "math_m1", section: "math", count: 22 },
  { key: "math_m2", section: "math", count: 22 },
];
const MST_TIME_LIMITS = { rw_m1: 1920, rw_m2: 1920, break: 600, math_m1: 2100, math_m2: 2100 };

export type AssembleShortfall = {
  section: ExamSection;
  /** mst 조립에서만 채워진다(고정형은 null). */
  moduleKey: string | null;
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
  type ModuleItem = AssembledItem & { moduleKey: string | null };
  const allItems: ModuleItem[] = [];
  const shortfalls: AssembleMockExamSetResult["shortfalls"] = [];

  if (format === "mst") {
    // 모듈마다 같은 tier 가중치로 조립하되, 세트 안에서 이미 뽑힌 문항은 후보에서 아예 빼서
    // 모듈 간 중복을 원천 차단한다(assembleSection의 excludeProblemIds는 부족하면 재사용하므로
    // 그 경로에 맡기지 않는다). DB unique(exam_set_id, problem_id)가 최종 방어선.
    const usedInSet = new Set<string>();
    const usedGroups = new Set<string>(); // 유사문항 그룹은 세트 전체에서 하나만
    const offsets: Record<ExamSection, number> = { rw: 0, math: 0 };
    for (const mod of MST_MODULES) {
      const isRw = mod.section === "rw";
      // Module 1은 m1 배정 가능 난이도(easy·medium)만 쓰고, 난이도 비중도 그 범위로 좁혀 다시 배분한다.
      // Module 2는 Phase 3(라우팅)에서 higher/lower 변형으로 나뉘므로 여기서는 제한하지 않는다.
      const isM1 = mod.key === "rw_m1" || mod.key === "math_m1";
      const weights = isRw ? rwWeights : mathWeights;
      const difficultyWeights = isM1 ? weights.difficultyWeights.filter((d) => moduleEligibility(d.difficulty).m1) : weights.difficultyWeights;
      if (difficultyWeights.length === 0) throw new Error(`${mod.key}: 배정 가능한 난이도 비중이 없습니다.`);
      const result = assembleSection({
        section: mod.section,
        totalCount: mod.count,
        domainWeights: weights.domainWeights,
        difficultyWeights,
        candidates: (isRw ? rwCandidates : mathCandidates).filter(
          (c) => !usedInSet.has(c.problemId) && (!isM1 || moduleEligibility(c.difficulty).m1),
        ),
        excludeProblemIds: excludeIds,
        formatWeights: isRw ? undefined : MATH_FORMAT_WEIGHTS,
        selection: { skillUse: new Map(), usedGroups },
      });
      for (const item of result.items) {
        usedInSet.add(item.problemId);
        allItems.push({ ...item, position: item.position + offsets[mod.section], moduleKey: mod.key });
      }
      offsets[mod.section] += result.items.length;
      shortfalls.push(...result.shortfalls.map((s) => ({ section: mod.section, moduleKey: mod.key, ...s })));
    }
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
    });
    allItems.push(...[...rwResult.items, ...mathResult.items].map((i) => ({ ...i, moduleKey: null })));
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
      assembly_rules: format === "mst" ? MST_ASSEMBLY_RULES : null,
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
    .select("id, section, position, problem_id, sat_domain, skill_code, difficulty, module_key, m1_eligible, m2_lower_eligible, m2_higher_eligible")
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

export type MockExamStudentOption = { id: string; name: string | null };

/** 관리자 흐름 "배정" — 교사 담당 여부와 무관하게 어떤 학생에게도 배정할 수 있다(교사 배정
 * 화면은 담당 학생으로 제한되지만, 관리자는 전체 학생을 대상으로 한다). */
export async function listAllActiveStudentsForMockExamAction(): Promise<MockExamStudentOption[]> {
  await requireAdmin();
  const db = createAdminClient();
  // 2026-09-28: 활성 학생 id를 모아 .in("id", [...])으로 다시 조회하던 방식은 학생 수가
  // 수백 명이 되면 PostgREST GET URL이 한도를 넘어 "URI too long"으로 실패했다 —
  // students(id → profiles.id FK) inner embed 한 번으로 같은 결과를 얻는다.
  const { data, error } = await db
    .from("profiles")
    .select("id, name, students!inner(status)")
    .eq("students.status", "active")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}

/** assignMockExamAction(lib/mock-exam/attempt-actions.ts)과 같은 배정 로직이지만, RLS의
 * teaches_student() 제한을 받지 않도록 admin 클라이언트로 직접 쓴다(관리자는 담당 교사가
 * 아니어도 배정할 수 있어야 한다). */
export async function assignMockExamAsAdminAction(input: {
  studentId: string;
  examSetId: string;
  dueAt?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // mock_exam_attempts.assigned_by는 teachers(id) 참조라, 관리자 본인 id를 그대로 넣으면
  // (관리자가 동시에 teachers 행을 갖고 있지 않은 한) FK 위반이 난다 — 관리자 배정은 null로 둔다.
  await requireAdmin();
  const db = createAdminClient();

  const { data: setRow, error: setErr } = await db
    .from("mock_exam_sets")
    .select("set_group_id")
    .eq("id", input.examSetId)
    .maybeSingle();
  if (setErr) return { ok: false, error: setErr.message };
  if (!setRow) return { ok: false, error: "존재하지 않는 시험 세트입니다." };

  const { data: existing, error: existingErr } = await db
    .from("mock_exam_attempts")
    .select("id, status")
    .eq("student_id", input.studentId)
    .eq("exam_set_group_id", setRow.set_group_id)
    .maybeSingle();
  if (existingErr) return { ok: false, error: existingErr.message };

  if (existing) {
    if (existing.status !== "assigned") {
      return { ok: false, error: "이미 시작했거나 제출한 시험은 다시 배정할 수 없습니다." };
    }
    const { error } = await db
      .from("mock_exam_attempts")
      .update({ exam_set_id: input.examSetId, due_at: input.dueAt ?? null })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  }

  const { error } = await db.from("mock_exam_attempts").insert({
    student_id: input.studentId,
    exam_set_id: input.examSetId,
    due_at: input.dueAt ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export type BulkAssignMockExamResult = {
  assignedCount: number;
  skipped: { studentId: string; studentName: string | null; reason: string }[];
};

/** 2026-09-21(사용자 지시) — "전체 학생에게 배정" — 비활성화(active가 아닌) 학생은
 * listAllActiveStudentsForMockExamAction이 이미 걸러낸다. 학생 하나하나에 대해
 * assignMockExamAsAdminAction과 같은 배정 로직을 돌리고, 이미 시작·제출한 시험이라
 * 배정을 건너뛴 학생은 사유와 함께 목록으로 돌려준다(전체를 막지 않는다 — 한 명
 * 실패했다고 나머지 배정까지 막을 이유가 없다). */
export async function assignMockExamToAllActiveStudentsAction(input: {
  examSetId: string;
  dueAt?: string | null;
}): Promise<BulkAssignMockExamResult> {
  await requireAdmin();
  const students = await listAllActiveStudentsForMockExamAction();
  let assignedCount = 0;
  const skipped: BulkAssignMockExamResult["skipped"] = [];
  for (const s of students) {
    const result = await assignMockExamAsAdminAction({ studentId: s.id, examSetId: input.examSetId, dueAt: input.dueAt ?? null });
    if (result.ok) assignedCount += 1;
    else skipped.push({ studentId: s.id, studentName: s.name, reason: result.error });
  }
  return { assignedCount, skipped };
}

export type MockExamAttemptHistoryRow = {
  attemptId: string;
  studentId: string;
  studentName: string | null;
  examSetName: string;
  status: string;
  dueAt: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  totalCount: number;
  correctCount: number | null;
};

/** 관리자 흐름 "내역" — 전체 배정·응시 내역(누구에게 언제 배정했고, 얼마나 풀었는지)을 한 번에 본다. */
export async function listAllMockExamAttemptsAction(): Promise<MockExamAttemptHistoryRow[]> {
  await requireAdmin();
  const db = createAdminClient();

  const { data: attempts, error } = await db
    .from("mock_exam_attempts")
    .select("id, student_id, exam_set_id, status, due_at, submitted_at, graded_at")
    .order("due_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  if (!attempts || attempts.length === 0) return [];

  const studentIds = Array.from(new Set(attempts.map((a) => a.student_id)));
  const examSetIds = Array.from(new Set(attempts.map((a) => a.exam_set_id)));
  const [{ data: profiles }, { data: sets }, { data: itemCounts }, { data: answers }] = await Promise.all([
    selectInChunks(studentIds, (chunk) => db.from("profiles").select("id, name").in("id", chunk)),
    selectInChunks(examSetIds, (chunk) => db.from("mock_exam_sets").select("id, name").in("id", chunk)),
    selectInChunks(examSetIds, (chunk) => db.from("mock_exam_set_items").select("exam_set_id").in("exam_set_id", chunk)),
    selectInChunks(attempts.map((a) => a.id), (chunk) => db.from("mock_exam_answers").select("attempt_id, correct").in("attempt_id", chunk)),
  ]);
  const nameByStudent = new Map((profiles ?? []).map((p) => [p.id, p.name as string | null]));
  const nameBySet = new Map((sets ?? []).map((s) => [s.id, s.name as string]));
  const totalCountBySet = new Map<string, number>();
  for (const row of itemCounts ?? []) totalCountBySet.set(row.exam_set_id, (totalCountBySet.get(row.exam_set_id) ?? 0) + 1);
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
    dueAt: a.due_at,
    submittedAt: a.submitted_at,
    gradedAt: a.graded_at,
    totalCount: totalCountBySet.get(a.exam_set_id) ?? 0,
    correctCount: a.status === "graded" ? (correctCountByAttempt.get(a.id) ?? 0) : null,
  }));
}
