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
  type AssembledItem,
  type DifficultyTier,
  type EligibleProblem,
  type ExamSection,
  type FormatWeight,
} from "@/lib/mock-exam/assemble";
import { loadMockExamSetContentForStaff, type MockExamSetContentItem } from "@/lib/mock-exam/set-content";

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
    .select("id, set_group_id, version_no, name, difficulty_tier, status, created_at, published_at")
    .order("created_at", { ascending: false });
  if (opts.archivedOnly) query = query.not("archived_at", "is", null);
  else if (!opts.includeArchived) query = query.is("archived_at", null);
  const { data: sets, error } = await query;
  if (error) throw new Error(error.message);

  const { data: itemCounts } = await db.from("mock_exam_set_items").select("exam_set_id, section");
  const countsBySet = new Map<string, { rw: number; math: number }>();
  for (const row of itemCounts ?? []) {
    const entry = countsBySet.get(row.exam_set_id) ?? { rw: 0, math: 0 };
    if (row.section === "rw") entry.rw += 1;
    else entry.math += 1;
    countsBySet.set(row.exam_set_id, entry);
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
  }));
}

async function fetchEligibleProblems(db: ReturnType<typeof createAdminClient>, domains: string[]): Promise<EligibleProblem[]> {
  // 공개 문항만: problems.status='confirmed', archived_at is null, 공개된(published) 버전 존재.
  const { data, error } = await db
    .from("problems")
    .select(
      `id, sat_domain, skill_code, format,
       problem_versions!problem_versions_problem_id_fkey!inner(id, status, difficulty)`,
    )
    .in("sat_domain", domains)
    .eq("status", "confirmed")
    .is("archived_at", null)
    .eq("problem_versions.status", "published");
  if (error) throw new Error(error.message);

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
  const { data: items } = await db.from("mock_exam_set_items").select("problem_id").in("exam_set_id", setIds);
  return new Set((items ?? []).map((i) => i.problem_id));
}

export type AssembleMockExamSetInput = {
  name: string;
  description?: string;
  difficultyTier: DifficultyTier;
  rwCount: number;
  mathCount: number;
  rwTimeLimitMinutes?: number;
  mathTimeLimitMinutes?: number;
};

export type AssembleMockExamSetResult = {
  examSetId: string;
  shortfalls: { section: ExamSection; satDomain: string; difficulty: string; needed: number; found: number }[];
};

/** 관리자 흐름 1단계: 후보 문항 풀에서 비중대로 세트를 조립하고 draft로 저장한다(사양 3절 1~2). */
export async function assembleMockExamSet(input: AssembleMockExamSetInput): Promise<AssembleMockExamSetResult> {
  const { adminUserId } = await requireAdmin();
  const db = createAdminClient();

  if (!input.name.trim()) throw new Error("세트 이름을 입력하세요.");
  if (input.rwCount <= 0 || input.mathCount <= 0) throw new Error("R&W·Math 문항 수는 1 이상이어야 합니다.");

  const [rwCandidates, mathCandidates, rwWeights, mathWeights, excludeIds] = await Promise.all([
    fetchEligibleProblems(db, RW_DOMAINS),
    fetchEligibleProblems(db, MATH_DOMAINS),
    fetchWeights(db, input.difficultyTier, "rw"),
    fetchWeights(db, input.difficultyTier, "math"),
    fetchAlreadyUsedProblemIds(db, input.difficultyTier),
  ]);

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

  const { data: setRow, error: setErr } = await db
    .from("mock_exam_sets")
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      difficulty_tier: input.difficultyTier,
      status: "draft",
      rw_time_limit_minutes: input.rwTimeLimitMinutes ?? 64,
      math_time_limit_minutes: input.mathTimeLimitMinutes ?? 70,
      created_by: adminUserId,
    })
    .select("id")
    .single();
  if (setErr) throw new Error(setErr.message);

  const allItems: AssembledItem[] = [...rwResult.items, ...mathResult.items];
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
      })),
    );
    if (itemsErr) throw new Error(itemsErr.message);
  }

  revalidatePath("/admin");
  return {
    examSetId: setRow.id,
    shortfalls: [
      ...rwResult.shortfalls.map((s) => ({ section: "rw" as const, ...s })),
      ...mathResult.shortfalls.map((s) => ({ section: "math" as const, ...s })),
    ],
  };
}

export type MockExamSetItemDetail = {
  id: string;
  section: ExamSection;
  position: number;
  problemId: string;
  satDomain: string;
  skillCode: string | null;
  difficulty: string;
};

/** 관리자 흐름 2단계: 조립된 세트를 검토한다(사양 3절 2~3의 "확인 후 공개"). */
export async function getMockExamSetItems(examSetId: string): Promise<MockExamSetItemDetail[]> {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("mock_exam_set_items")
    .select("id, section, position, problem_id, sat_domain, skill_code, difficulty")
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
  const { data: activeStudents, error: studentsErr } = await db.from("students").select("id").eq("status", "active");
  if (studentsErr) throw new Error(studentsErr.message);
  const activeIds = (activeStudents ?? []).map((s) => s.id);
  if (activeIds.length === 0) return [];
  const { data, error } = await db.from("profiles").select("id, name").in("id", activeIds).order("name");
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
    db.from("profiles").select("id, name").in("id", studentIds),
    db.from("mock_exam_sets").select("id, name").in("id", examSetIds),
    db.from("mock_exam_set_items").select("exam_set_id").in("exam_set_id", examSetIds),
    db.from("mock_exam_answers").select("attempt_id, correct").in(
      "attempt_id",
      attempts.map((a) => a.id),
    ),
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
