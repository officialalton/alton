// 'AB/AP 세트 새 버전' 화면 로직(2026-10-12): 커밋된 교체 계획 파일 읽기·슬롯 해석(순수), 미리보기(검증 + 구성 전/후 + 기존 응시 수; 읽기 전용).
// 검증은 두 층이다: (1) lib/mock-exam/new-version.ts 의 TS 조립 규칙(문항군 상한·단원 비중·계산기·중복·풀 모의고사 겹침 0)을 서버 액션 createMockExamNewVersionAction 과 같은 입력으로 돌리고,
// (2) DB RPC mock_exam_create_new_version 이 거부할 조건(공개·확정 버전, 모의고사 용도, review_env_ready, 같은 과목, 슬롯 형식)을 미리 점검한다. DB 가 최종 방어선이다.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { checkNewVersionComposition, type NewVersionContext, type SlotItem } from "../mock-exam/new-version";

export type SwapSpec = { section: string; position: number; addKey: string };
export type PlanSwapInput = { section: string; position?: number; removeKey?: string; addKey: string };
export type SwapPlanFile = { kind: "ap_new_version_swap_plan"; set: string; sourceSetName: string; sourceVersionNo?: number; swaps: PlanSwapInput[] };
export type PlanListing = { file: string; set: string; sourceSetName: string; swapCount: number };

const PLAN_DIR = "data/ap/stock";
const PLAN_NAME = /^[A-Za-z0-9._-]*swap-plan[A-Za-z0-9._-]*\.json$/;

export function listSwapPlans(dir = PLAN_DIR): PlanListing[] {
  let files: string[] = [];
  try { files = readdirSync(dir).filter((f) => PLAN_NAME.test(f)).sort(); } catch { return []; }
  const out: PlanListing[] = [];
  for (const file of files) {
    try { const p = parseSwapPlan(JSON.parse(readFileSync(path.join(dir, file), "utf-8"))); out.push({ file, set: p.set, sourceSetName: p.sourceSetName, swapCount: p.swaps.length }); } catch { /* 형식 오류 파일은 목록에서 뺀다 */ }
  }
  return out;
}
export function readSwapPlan(file: string, dir = PLAN_DIR): SwapPlanFile {
  if (!PLAN_NAME.test(file)) throw new Error("교체 계획 파일 이름이 올바르지 않습니다.");
  return parseSwapPlan(JSON.parse(readFileSync(path.join(dir, file), "utf-8")));
}
export function parseSwapPlan(raw: unknown): SwapPlanFile {
  const o = raw as Partial<SwapPlanFile> | null;
  if (!o || o.kind !== "ap_new_version_swap_plan" || !Array.isArray(o.swaps) || typeof o.sourceSetName !== "string") throw new Error("교체 계획 형식이 올바르지 않습니다.");
  const swaps = o.swaps.map((s) => {
    if (!s || typeof s.section !== "string" || typeof s.addKey !== "string" || (s.position === undefined && typeof s.removeKey !== "string")) throw new Error("교체 항목에는 section, addKey 와 position 또는 removeKey 가 필요합니다.");
    return { section: s.section, position: typeof s.position === "number" ? s.position : undefined, removeKey: s.removeKey, addKey: s.addKey } as PlanSwapInput;
  });
  return { kind: "ap_new_version_swap_plan", set: String(o.set ?? ""), sourceSetName: o.sourceSetName, sourceVersionNo: o.sourceVersionNo, swaps };
}

/** 계획의 removeKey/position 을 원본 세트의 실제 슬롯으로 해석한다. 키가 그 섹션에 없거나 position 과 키가 어긋나면 사유를 돌려준다. */
export function resolveSwaps(inputs: PlanSwapInput[], slots: { section: string; position: number; candidateKey: string | null }[]): { swaps: (SwapSpec & { removeKey: string | null })[]; problems: string[] } {
  const problems: string[] = []; const swaps: (SwapSpec & { removeKey: string | null })[] = [];
  for (const s of inputs) {
    let slot = s.position !== undefined ? slots.find((x) => x.section === s.section && x.position === s.position) : undefined;
    if (s.removeKey) {
      const byKey = slots.find((x) => x.section === s.section && x.candidateKey === s.removeKey);
      if (!byKey) { problems.push(`제거할 문항 ${s.removeKey} 이(가) ${s.section} 섹션에 없습니다(이미 바뀌었거나 다른 버전).`); continue; }
      if (slot && slot !== byKey) { problems.push(`${s.section} #${s.position} 의 현재 문항이 계획(${s.removeKey})과 다릅니다.`); continue; }
      slot = byKey;
    }
    if (!slot) { problems.push(`슬롯 ${s.section} #${s.position} 이(가) 없습니다.`); continue; }
    swaps.push({ section: slot.section, position: slot.position, addKey: s.addKey, removeKey: slot.candidateKey });
  }
  const seen = new Set<string>();
  for (const s of swaps) { const k = `${s.section}:${s.position}`; if (seen.has(k)) problems.push(`슬롯 ${k} 을(를) 두 번 교체할 수 없습니다.`); seen.add(k); }
  const adds = swaps.map((s) => s.addKey); if (new Set(adds).size !== adds.length) problems.push("같은 문항을 두 슬롯에 넣을 수 없습니다.");
  return { swaps, problems };
}

export type Brief = { candidateKey: string | null; unit: string | null; calculator: string | null; kind: string | null; family: string | null };
export type Composition = { mc: number; frq: number; unitCounts: Record<string, number>; calculator: { not_allowed: number; required: number; other: number } };
export type NewVersionPreview = {
  ok: boolean; issues: string[];
  source: { id: string; name: string; versionNo: number; status: string; accessTier: string; apSubject: string | null; apLabel: string | null };
  newVersionNo: number;
  swaps: { section: string; position: number; removeKey: string | null; addKey: string; problemId: string | null; before: Brief | null; after: Brief | null }[];
  before: Composition; after: Composition;
  attempts: { total: number; byStatus: Record<string, number> };
  /** createMockExamNewVersionAction 에 그대로 넘길 교체 목록(문제 id 로 해석 완료). */
  actionSwaps: { section: string; position: number; problemId: string }[];
};

export function summarize(items: { kind: string | null; unit: string | null; calculator: string | null }[]): Composition {
  const unitCounts: Record<string, number> = {}; const calc = { not_allowed: 0, required: 0, other: 0 }; let mc = 0, frq = 0;
  for (const i of items) {
    if (i.kind === "mc") { mc++; if (i.unit) unitCounts[i.unit] = (unitCounts[i.unit] ?? 0) + 1; if (i.calculator === "not_allowed") calc.not_allowed++; else if (i.calculator === "required") calc.required++; else calc.other++; }
    else if (i.kind) frq++;
  }
  return { mc, frq, unitCounts, calculator: calc };
}

type CandRow = { candidate_key: string; keyword_code: string | null; calculator: string | null; item_family_id: string | null; kind: string | null; ap_subject_code: string | null; release_tier: string | null; purpose: string | null; review_env_ready: boolean | null; is_current: boolean | null };
const keyOf = (r: { ap_candidate_key: string | null } | { ap_candidate_key: string | null }[] | null) => (Array.isArray(r) ? r[0] : r)?.ap_candidate_key ?? null;

/** 읽기 전용 미리보기. 어떤 행도 쓰지 않는다. */
export async function buildNewVersionPreview(db: SupabaseClient, sourceSetId: string, inputs: PlanSwapInput[]): Promise<NewVersionPreview> {
  const { data: set, error } = await db.from("mock_exam_sets").select("id, name, set_group_id, version_no, status, access_tier, exam_program, ap_subject, ap_label, section_layout").eq("id", sourceSetId).single();
  if (error || !set) throw new Error(error?.message ?? "세트를 찾을 수 없습니다.");
  const issues: string[] = [];
  if (set.exam_program !== "ap") issues.push("AP 세트만 이 화면에서 새 버전을 만들 수 있습니다.");
  if (set.status !== "published") issues.push("새 버전은 현재 공개 중인 버전에서만 만들 수 있습니다.");
  if (!inputs.length) issues.push("교체할 문항이 없습니다.");

  const { data: srcItems, error: e1 } = await db.from("mock_exam_set_items").select("section, position, problem_id, problems(ap_candidate_key)").eq("exam_set_id", sourceSetId);
  if (e1) throw new Error(e1.message);
  const slots = (srcItems ?? []).map((i) => ({ section: i.section as string, position: i.position as number, problemId: i.problem_id as string, candidateKey: keyOf(i.problems as never) }));
  const res = resolveSwaps(inputs, slots); issues.push(...res.problems);

  // 공유 자료 세트(같은 후보 키가 여러 슬롯 — 통계 3문항 세트)는 이 화면의 키 단위 미리보기로 바꿀 수 없다(교체는 세트 단위로 서버 액션에서만; 후속 작업).
  const keyCount = new Map<string, number>(); for (const sl of slots) if (sl.candidateKey) keyCount.set(sl.candidateKey, (keyCount.get(sl.candidateKey) ?? 0) + 1);
  for (const r of res.swaps) if (r.removeKey && (keyCount.get(r.removeKey) ?? 0) > 1) issues.push(`공유 자료 세트 문항(${r.removeKey})은 이 화면에서 교체할 수 없습니다 — 세트 단위 교체는 후속 지원.`);
  const addKeys = res.swaps.map((s) => s.addKey);
  const allKeys = [...new Set([...slots.map((s) => s.candidateKey), ...addKeys].filter((k): k is string => !!k))];
  const cands = new Map<string, CandRow>();
  for (let i = 0; i < allKeys.length; i += 100) {
    const { data, error: e } = await db.from("ap_candidate_items").select("candidate_key, keyword_code, calculator, item_family_id, kind, ap_subject_code, release_tier, purpose, review_env_ready, is_current").in("candidate_key", allKeys.slice(i, i + 100));
    if (e) throw new Error(e.message);
    for (const c of (data ?? []) as CandRow[]) cands.set(c.candidate_key, c);
  }
  const probByKey = new Map<string, string>();
  const probMeta = new Map<string, { status: string | null; archived_at: string | null; published_version_id: string | null; usage_scope: string | null }>();
  if (addKeys.length) {
    const { data, error: e } = await db.from("problems").select("id, ap_candidate_key, status, archived_at, published_version_id, usage_scope").in("ap_candidate_key", addKeys);
    if (e) throw new Error(e.message);
    const per = new Map<string, number>();
    for (const p of data ?? []) { const k = p.ap_candidate_key as string; per.set(k, (per.get(k) ?? 0) + 1); probByKey.set(k, p.id as string); probMeta.set(k, p as never); }
    for (const [k, n] of per) if (n !== 1) issues.push(`교체 문항 ${k} 은(는) 변환된 문제가 ${n}건이라 지원하지 않습니다(후보당 1건만).`);
  }
  const brief = (key: string | null): Brief => { const c = key ? cands.get(key) : undefined; return { candidateKey: key, unit: c?.keyword_code?.split(".")[0] ?? null, calculator: c?.calculator ?? null, kind: c?.kind === "mc" ? "mc" : c?.kind ? "frq" : null, family: c?.item_family_id ?? null }; };

  // (2) DB RPC 가 거부할 조건 미리 점검
  for (const k of addKeys) {
    const c = cands.get(k); const p = probMeta.get(k);
    if (!c || !probByKey.has(k)) { issues.push(`교체 문항 ${k} 이(가) 문제은행으로 변환되지 않았습니다.`); continue; }
    if (c.purpose !== "mock_exam" || !["review_env", "launch"].includes(c.release_tier ?? "") || c.review_env_ready !== true) issues.push(`교체 문항 ${k} 이(가) 검수 환경 준비(review_env_ready)·모의고사 용도가 아닙니다.`);
    if (c.is_current === false) issues.push(`교체 문항 ${k} 은(는) 현재 버전 후보가 아닙니다.`);
    if (!p || p.status !== "confirmed" || p.archived_at || !p.published_version_id || !["mock_exam", "both"].includes(p.usage_scope ?? "")) issues.push(`교체 문항 ${k} 의 문제가 확정·공개된 모의고사 문항이 아닙니다.`);
    if (c.ap_subject_code !== set.ap_subject && !(set.ap_subject === "ap_calculus_bc" && c.ap_subject_code === "ap_calculus_ab")) issues.push(`교체 문항 ${k} 은(는) 다른 AP 과목입니다.`);
  }

  // (1) TS 조립 규칙
  const sections = ((set.section_layout as { sections?: { key: string; calculator?: string }[] } | null)?.sections ?? []);
  const pids = addKeys.map((k) => probByKey.get(k)).filter((x): x is string => !!x);
  let used = new Set<string>();
  if (pids.length) {
    const { data, error: e } = await db.from("mock_exam_set_items").select("problem_id, mock_exam_sets!inner(set_group_id, status, ap_label)").in("problem_id", pids).neq("mock_exam_sets.set_group_id", set.set_group_id).in("mock_exam_sets.status", ["draft", "published"]).eq("mock_exam_sets.ap_label", "full_practice");
    if (e) throw new Error(e.message);
    used = new Set((data ?? []).map((u) => u.problem_id as string));
  }
  const toSlot = (s: { section: string; position: number; problemId: string; candidateKey: string | null }): SlotItem => { const b = brief(s.candidateKey); return { section: s.section, position: s.position, problemId: s.problemId, candidateKey: s.candidateKey, kind: b.kind as "mc" | "frq" | null, unit: b.unit, family: b.family, calculator: b.calculator }; };
  const ctx: NewVersionContext = {
    apLabel: set.ap_label as NewVersionContext["apLabel"], sectionCalculator: Object.fromEntries(sections.map((x) => [x.key, x.calculator ?? "na"])),
    unitBounds: fullPracticeUnitBounds(set.ap_subject as string | null, set.ap_label as string | null),
    usedByOtherExams: used,
    replacements: new Map(res.swaps.filter((s) => probByKey.has(s.addKey)).map((s) => { const sl = toSlot({ section: s.section, position: s.position, problemId: probByKey.get(s.addKey)!, candidateKey: s.addKey }); return [sl.problemId, { problemId: sl.problemId, candidateKey: sl.candidateKey, kind: sl.kind, unit: sl.unit, family: sl.family, calculator: sl.calculator }] as const; })),
  };
  const actionSwaps = res.swaps.filter((s) => probByKey.has(s.addKey)).map((s) => ({ section: s.section, position: s.position, problemId: probByKey.get(s.addKey)! }));
  const before = slots.map(toSlot);
  const { items: afterItems, issues: tsIssues } = res.problems.length || actionSwaps.length !== res.swaps.length ? { items: before, issues: [] as string[] } : checkNewVersionComposition(before, actionSwaps, ctx);
  issues.push(...tsIssues);

  const { data: att, error: e5 } = await db.from("mock_exam_attempts").select("status").eq("exam_set_id", sourceSetId).limit(20000);
  if (e5) throw new Error(e5.message);
  const byStatus: Record<string, number> = {}; for (const a of att ?? []) byStatus[a.status as string] = (byStatus[a.status as string] ?? 0) + 1;
  const { data: maxV } = await db.from("mock_exam_sets").select("version_no").eq("set_group_id", set.set_group_id).order("version_no", { ascending: false }).limit(1);

  return {
    ok: issues.length === 0, issues,
    source: { id: set.id as string, name: set.name as string, versionNo: set.version_no as number, status: set.status as string, accessTier: set.access_tier as string, apSubject: (set.ap_subject as string | null) ?? null, apLabel: (set.ap_label as string | null) ?? null },
    newVersionNo: ((maxV?.[0]?.version_no as number | undefined) ?? (set.version_no as number)) + 1,
    swaps: res.swaps.map((s) => ({ section: s.section, position: s.position, removeKey: s.removeKey, addKey: s.addKey, problemId: probByKey.get(s.addKey) ?? null, before: brief(s.removeKey), after: brief(s.addKey) })),
    before: summarize(before), after: summarize(afterItems),
    attempts: { total: (att ?? []).length, byStatus }, actionSwaps,
  };
}
