// 'AB/AP 세트 새 버전' 화면 로직(2026-10-12): 커밋된 교체 계획 파일 읽기·슬롯 해석(순수), 미리보기(검증 + 구성 전/후 + 기존 응시 수; 읽기 전용).
// 검증은 두 층이다: (1) lib/mock-exam/new-version.ts 의 TS 조립 규칙(문항군 상한·단원 비중·계산기·중복·풀 모의고사 겹침 0)을 서버 액션 createMockExamNewVersionAction 과 같은 입력으로 돌리고,
// (2) DB RPC mock_exam_create_new_version 이 거부할 조건(공개·확정 버전, 모의고사 용도, review_env_ready, 같은 과목, 슬롯 형식)을 미리 점검한다. DB 가 최종 방어선이다.
import { readdirSync, readFileSync } from "../ap-generation/data-fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fullPracticeUnitBounds } from "../ap-exam/full-set-rules";
import { checkNewVersionComposition, type NewVersionContext, type SlotItem } from "../mock-exam/new-version";

export type SwapSpec = { section: string; position: number; addKey: string; /** 공유 자료 세트 교체에서 새 세트 안의 문항 순서(0부터). 단독 문항은 없음. */ addIndex?: number };
/** addIndex 가 있으면 '재편(regroup)' 항목: 슬롯(section+position)과 새 후보 안의 문항 순서를 직접 지정한다(묶음 크기가 달라지는 교체 — 영어 장문 묶음). 이 항목은 기존 묶음 전체로 펼치지 않는다. */
export type PlanSwapInput = { section: string; position?: number; removeKey?: string; addKey: string; addIndex?: number };
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
    if (s.addIndex !== undefined && (!Number.isInteger(s.addIndex) || s.addIndex < 0 || typeof s.position !== "number")) throw new Error("재편 항목(addIndex)에는 0 이상의 정수 addIndex 와 position 이 필요합니다.");
    return { section: s.section, position: typeof s.position === "number" ? s.position : undefined, removeKey: s.removeKey, addKey: s.addKey, ...(s.addIndex !== undefined ? { addIndex: s.addIndex } : {}) } as PlanSwapInput;
  });
  return { kind: "ap_new_version_swap_plan", set: String(o.set ?? ""), sourceSetName: o.sourceSetName, sourceVersionNo: o.sourceVersionNo, swaps };
}

/** 계획의 removeKey/position 을 원본 세트의 실제 슬롯으로 해석한다. 키가 그 섹션에 없거나 position 과 키가 어긋나면 사유를 돌려준다.
 *  공유 자료 세트(같은 후보 키가 한 섹션의 여러 슬롯 — 통계 3문항 세트)는 세트 전체가 한 번에, 같은 교체 후보 하나로만 바뀐다: 세트의 한 문항만 가리켜도 세트 전체 슬롯으로 펼치고(addIndex 0..n-1), 다른 교체 후보로 나누면 거부한다. */
export function resolveSwaps(inputs: PlanSwapInput[], slots: { section: string; position: number; candidateKey: string | null }[]): { swaps: (SwapSpec & { removeKey: string | null })[]; problems: string[] } {
  const problems: string[] = []; const swaps: (SwapSpec & { removeKey: string | null })[] = [];
  const setGroups = new Map<string, string>(); // `${section}|${removeKey}` → addKey
  for (const s of inputs) {
    if (s.addIndex !== undefined) { // 재편 항목: 슬롯을 그대로 한 칸씩 교체(묶음 펼치기 없음). 묶음 무결성은 조합 검사·DB RPC 가 최종으로 본다.
      const slot = slots.find((x) => x.section === s.section && x.position === s.position);
      if (!slot) { problems.push(`슬롯 ${s.section} #${s.position} 이(가) 없습니다.`); continue; }
      if (s.removeKey && slot.candidateKey !== s.removeKey) { problems.push(`${s.section} #${s.position} 의 현재 문항이 계획(${s.removeKey})과 다릅니다.`); continue; }
      swaps.push({ section: slot.section, position: slot.position, addKey: s.addKey, addIndex: s.addIndex, removeKey: slot.candidateKey }); continue;
    }
    let slot = s.position !== undefined ? slots.find((x) => x.section === s.section && x.position === s.position) : undefined;
    if (s.removeKey) {
      const byKey = slots.find((x) => x.section === s.section && x.candidateKey === s.removeKey);
      if (!byKey) { problems.push(`제거할 문항 ${s.removeKey} 이(가) ${s.section} 섹션에 없습니다(이미 바뀌었거나 다른 버전).`); continue; }
      if (slot && slot.candidateKey !== s.removeKey) { problems.push(`${s.section} #${s.position} 의 현재 문항이 계획(${s.removeKey})과 다릅니다.`); continue; }
      slot = slot ?? byKey;
    }
    if (!slot) { problems.push(`슬롯 ${s.section} #${s.position} 이(가) 없습니다.`); continue; }
    const members = slot.candidateKey ? slots.filter((x) => x.section === slot!.section && x.candidateKey === slot!.candidateKey).sort((a, b) => a.position - b.position) : [slot];
    if (members.length > 1) {
      const gk = `${slot.section}|${slot.candidateKey}`; const prev = setGroups.get(gk);
      if (prev !== undefined && prev !== s.addKey) { problems.push(`공유 자료 세트 ${slot.candidateKey} 를 서로 다른 문항으로 나눠 교체할 수 없습니다(세트 전체를 하나의 새 세트로).`); continue; }
      if (prev === undefined) { setGroups.set(gk, s.addKey); members.forEach((m, j) => swaps.push({ section: m.section, position: m.position, addKey: s.addKey, removeKey: m.candidateKey, addIndex: j })); }
      continue;
    }
    swaps.push({ section: slot.section, position: slot.position, addKey: s.addKey, removeKey: slot.candidateKey });
  }
  const seen = new Set<string>();
  for (const s of swaps) { const k = `${s.section}:${s.position}`; if (seen.has(k)) problems.push(`슬롯 ${k} 을(를) 두 번 교체할 수 없습니다.`); seen.add(k); }
  const adds = swaps.map((s) => `${s.addKey}#${s.addIndex ?? 0}`); if (new Set(adds).size !== adds.length) problems.push("같은 문항을 두 슬롯에 넣을 수 없습니다.");
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

  const addKeys = [...new Set(res.swaps.map((s) => s.addKey))];
  const need = new Map<string, number>(); for (const r of res.swaps) need.set(r.addKey, (need.get(r.addKey) ?? 0) + 1);
  const allKeys = [...new Set([...slots.map((s) => s.candidateKey), ...addKeys].filter((k): k is string => !!k))];
  const cands = new Map<string, CandRow>();
  for (let i = 0; i < allKeys.length; i += 100) {
    const { data, error: e } = await db.from("ap_candidate_items").select("candidate_key, keyword_code, calculator, item_family_id, kind, ap_subject_code, release_tier, purpose, review_env_ready, is_current").in("candidate_key", allKeys.slice(i, i + 100));
    if (e) throw new Error(e.message);
    for (const c of (data ?? []) as CandRow[]) cands.set(c.candidate_key, c);
  }
  const probsByKey = new Map<string, string[]>(); // 후보 키 → 문제 id(item_index 순; 공유 세트는 3건)
  const probMeta = new Map<string, { status: string | null; archived_at: string | null; published_version_id: string | null; usage_scope: string | null }>();
  if (addKeys.length) {
    const { data, error: e } = await db.from("problems").select("id, ap_candidate_key, status, archived_at, published_version_id, usage_scope").in("ap_candidate_key", addKeys);
    if (e) throw new Error(e.message);
    const { data: ord, error: oe } = await db.from("ap_candidate_problems").select("candidate_key, item_index, problem_id").in("candidate_key", addKeys);
    if (oe) throw new Error(oe.message);
    const order = new Map((ord ?? []).map((x) => [x.problem_id as string, x.item_index as number]));
    for (const p of data ?? []) { const k = p.ap_candidate_key as string; probsByKey.set(k, [...(probsByKey.get(k) ?? []), p.id as string]); probMeta.set(p.id as string, p as never); }
    for (const ids of probsByKey.values()) ids.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    for (const k of addKeys) { const n = probsByKey.get(k)?.length ?? 0; if (n && n !== (need.get(k) ?? 1)) issues.push(`교체 문항 ${k} 은(는) 변환된 문제가 ${n}건인데 교체할 슬롯은 ${need.get(k) ?? 1}개입니다(공유 자료 세트는 같은 크기의 세트로만 교체).`); }
  }
  const brief = (key: string | null): Brief => { const c = key ? cands.get(key) : undefined; return { candidateKey: key, unit: c?.keyword_code?.split(".")[0] ?? null, calculator: c?.calculator ?? null, kind: c?.kind === "mc" ? "mc" : c?.kind ? "frq" : null, family: c?.item_family_id ?? null }; };

  // (2) DB RPC 가 거부할 조건 미리 점검
  for (const k of addKeys) {
    const c = cands.get(k); const ids = probsByKey.get(k) ?? [];
    if (!c || !ids.length) { issues.push(`교체 문항 ${k} 이(가) 문제은행으로 변환되지 않았습니다.`); continue; }
    if (c.purpose !== "mock_exam" || !["review_env", "launch"].includes(c.release_tier ?? "") || c.review_env_ready !== true) issues.push(`교체 문항 ${k} 이(가) 검수 환경 준비(review_env_ready)·모의고사 용도가 아닙니다.`);
    if (c.is_current === false) issues.push(`교체 문항 ${k} 은(는) 현재 버전 후보가 아닙니다.`);
    for (const id of ids) { const p = probMeta.get(id); if (!p || p.status !== "confirmed" || p.archived_at || !p.published_version_id || !["mock_exam", "both"].includes(p.usage_scope ?? "")) { issues.push(`교체 문항 ${k} 의 문제가 확정·공개된 모의고사 문항이 아닙니다.`); break; } }
    if (c.ap_subject_code !== set.ap_subject && !(set.ap_subject === "ap_calculus_bc" && c.ap_subject_code === "ap_calculus_ab")) issues.push(`교체 문항 ${k} 은(는) 다른 AP 과목입니다.`);
  }

  // (1) TS 조립 규칙
  const sections = ((set.section_layout as { sections?: { key: string; calculator?: string }[] } | null)?.sections ?? []);
  const probFor = (sw: { addKey: string; addIndex?: number }) => probsByKey.get(sw.addKey)?.[sw.addIndex ?? 0];
  const pids = res.swaps.map((sw) => probFor(sw)).filter((x): x is string => !!x);
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
    setSizes: new Map([...probsByKey].filter(([, ids]) => ids.length > 1).map(([k, ids]) => [k, ids.length] as [string, number])),
    replacements: new Map(res.swaps.filter((s) => probFor(s)).map((s) => { const sl = toSlot({ section: s.section, position: s.position, problemId: probFor(s)!, candidateKey: s.addKey }); return [sl.problemId, { problemId: sl.problemId, candidateKey: sl.candidateKey, kind: sl.kind, unit: sl.unit, family: sl.family, calculator: sl.calculator }] as const; })),
  };
  const actionSwaps = res.swaps.filter((s) => probFor(s)).map((s) => ({ section: s.section, position: s.position, problemId: probFor(s)! }));
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
    swaps: res.swaps.map((s) => ({ section: s.section, position: s.position, removeKey: s.removeKey, addKey: s.addKey, problemId: probFor(s) ?? null, before: brief(s.removeKey), after: brief(s.addKey) })),
    before: summarize(before), after: summarize(afterItems),
    attempts: { total: (att ?? []).length, byStatus }, actionSwaps,
  };
}
