// AP 해설·참고 답안의 원문 수식 교정(설명 수정 새 버전). 서버 액션(app/admin/ap-explanation-fix-actions.ts)이 requireAdmin 뒤에서 부른다.
// 원칙: 공개된 문제 버전·세트 스냅샷은 불변. 교정 = (1) 문제마다 "새 버전"(해설만 다름)을 기존 RPC 로 만들어 공개하고 후보에 연결 → (2) 세트는 mock_exam_refresh_explanations 로 version_no+1 초안 → 기존 공개 흐름.
// 응시·답안·결과·공개본은 쓰지 않는다. 쓰기는 환경 가드 + dry-run 계획 해시 + 감사 로그(ap_stock_admin_runs). 교정 문안은 교정 파일(data/ap/stock/tex-corrections.json)에 있고 "변환 전 해시"에 묶여 있다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { autoMathExplanation } from "../ap-exam/explanation-math";
import { planConversion } from "../ap-exam/convert";
import { findUnwrappedMath } from "../ap-exam/tex-audit";
import { base, cap, auditReady, checkHash, gate, type Ctx, type StepResult } from "./service";
import { planHash } from "./plan-hash";

export const CORRECTION_FILE = "data/ap/stock/tex-corrections.json";
export const sha256 = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

export type CorrectionEntry = { candidateKey: string; itemIndex: number; sets: string[]; beforeSha256: string; afterSha256: string; after: string };
export type CorrectionFile = { kind: "ap_explanation_math_correction"; version: 1; generatedBy: string; note: string; count: number; entries: CorrectionEntry[] };

type StockLike = { stockKey: string; apSubjectCode: string; kind: "mc" | "frq_bundle"; validation?: string; keywordCode?: string; difficultyProvisional?: string; payload: Record<string, unknown> };

/** 후보 하나의 교정 항목들(순수 함수). 변환 전 원문(wrapMath:false)과 교정 문안(autoMath) 이 다른 문항만. */
export function correctionsForStock(it: StockLike, sets: string[]): CorrectionEntry[] {
  const cand = { candidateKey: it.stockKey, apSubjectCode: it.apSubjectCode, kind: it.kind, payload: it.payload, keywordCode: it.keywordCode, difficultyProvisional: it.difficultyProvisional } as never;
  const before = planConversion(cand, { wrapMath: false });
  if (!before.ok) return [];
  const out: CorrectionEntry[] = [];
  for (const x of before.items) {
    const after = autoMathExplanation(x.explanationEn);
    if (after === x.explanationEn) continue;
    out.push({ candidateKey: it.stockKey, itemIndex: x.index, sets, beforeSha256: sha256(x.explanationEn), afterSha256: sha256(after), after });
  }
  return out;
}

export function readCorrectionFile(file = CORRECTION_FILE): CorrectionFile {
  const f = JSON.parse(readFileSync(path.resolve(file), "utf-8")) as CorrectionFile;
  if (f.kind !== "ap_explanation_math_correction" || !Array.isArray(f.entries)) throw new Error("교정 파일 형식이 올바르지 않습니다.");
  for (const e of f.entries) {
    if (sha256(e.after) !== e.afterSha256) throw new Error(`교정 파일 변조 의심: ${e.candidateKey}#${e.itemIndex} (문안 해시 불일치)`);
    if (findUnwrappedMath(e.after).some((h) => h.kind === "tex-command" || h.kind === "tex-script")) throw new Error(`교정 문안에 구분자 밖 TeX 가 남아 있습니다: ${e.candidateKey}#${e.itemIndex}`);
  }
  return f;
}

type Ver = { id: string; passage: string | null; question: string | null; options: unknown; correct_index: number | null; explanation: string | null; explanation_en: string | null; difficulty: string; answers: unknown; figure: unknown; figure_checked: boolean | null; statements: unknown; render_check: unknown; evidence_target: string | null; evidence_span: string | null; answer_rationale: string | null; distractor_error_types: unknown };
export type EntryState = "apply" | "already" | "not_converted" | "drift" | "pending_draft";
export type EntryPlan = { entry: CorrectionEntry; state: EntryState; problemId?: string; version?: Ver };

const VER_COLS = "id, passage, question, options, correct_index, explanation, explanation_en, difficulty, answers, figure, figure_checked, statements, render_check, evidence_target, evidence_span, answer_rationale, distractor_error_types";
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** DB 의 현재 공개 버전과 교정 파일을 대조해 항목별 상태를 정한다(읽기 전용). */
export async function planEntries(c: Ctx, entries: CorrectionEntry[]): Promise<EntryPlan[]> {
  const out: EntryPlan[] = [];
  for (const part of chunk(entries, 50)) {
    const keys = [...new Set(part.map((e) => e.candidateKey))];
    const { data: probs, error } = await c.db.from("problems").select("id, ap_candidate_key, ap_item_index, published_version_id").in("ap_candidate_key", keys);
    if (error) throw new Error(error.message);
    const pm = new Map((probs ?? []).map((p) => [`${p.ap_candidate_key}#${p.ap_item_index}`, p as { id: string; published_version_id: string | null }]));
    const vids = [...new Set((probs ?? []).map((p) => p.published_version_id as string | null).filter((x): x is string => !!x))];
    const vm = new Map<string, Ver>();
    if (vids.length) { const { data, error: ve } = await c.db.from("problem_versions").select(VER_COLS).in("id", vids); if (ve) throw new Error(ve.message); for (const v of data ?? []) vm.set((v as Ver).id, v as Ver); }
    const pids = [...pm.values()].map((p) => p.id);
    const open = new Set<string>();
    if (pids.length) { const { data, error: de } = await c.db.from("problem_versions").select("problem_id").in("problem_id", pids).in("status", ["draft", "in_review"]); if (de) throw new Error(de.message); for (const d of data ?? []) open.add(d.problem_id as string); }
    for (const e of part) {
      const p = pm.get(`${e.candidateKey}#${e.itemIndex}`);
      const v = p?.published_version_id ? vm.get(p.published_version_id) : undefined;
      if (!p || !v) { out.push({ entry: e, state: "not_converted" }); continue; }
      const cur = sha256(v.explanation_en ?? "");
      const state: EntryState = cur === e.afterSha256 ? "already" : cur !== e.beforeSha256 ? "drift" : open.has(p.id) ? "pending_draft" : "apply";
      out.push({ entry: e, state, problemId: p.id, version: v });
    }
  }
  return out;
}

const effectOf = (plans: EntryPlan[]) => plans.filter((p) => p.state === "apply").map((p) => `${p.entry.candidateKey}#${p.entry.itemIndex}:${p.entry.beforeSha256.slice(0, 12)}>${p.entry.afterSha256.slice(0, 12)}`).sort();
export const stateLabel: Record<EntryState, string> = { apply: "교정 대상", already: "이미 교정됨", not_converted: "아직 변환 전(변환 때 자동 반영)", drift: "DB 해설이 변환 전 원문과 다름(건드리지 않음)", pending_draft: "진행 중인 초안·검수 버전이 있음(건드리지 않음)" };

function summarize(r: StepResult, plans: EntryPlan[]) {
  const c: Record<string, number> = { total: plans.length };
  for (const p of plans) c[p.state] = (c[p.state] ?? 0) + 1;
  r.counts = c;
  r.lines = cap([
    `교정 파일 ${plans.length}건 중 교정 대상 ${c.apply ?? 0}건 · 이미 교정 ${c.already ?? 0} · 변환 전 ${c.not_converted ?? 0} · 해설 불일치 ${c.drift ?? 0} · 진행 중 초안 ${c.pending_draft ?? 0}`,
    "교정은 문제마다 새 버전(해설만 다름)을 만들어 공개합니다. 본문·선지·정답·그림은 그대로이고, 응시·답안·결과·공개본은 바뀌지 않습니다.",
    ...plans.filter((p) => p.state === "drift" || p.state === "pending_draft").map((p) => `${stateLabel[p.state]}: ${p.entry.candidateKey}#${p.entry.itemIndex}`),
    ...plans.filter((p) => p.state === "apply").map((p) => `교정: ${p.entry.candidateKey}#${p.entry.itemIndex} (${p.entry.sets.join(", ") || "예비"})`),
  ]);
}

/** 1단계 미리보기(읽기 전용). */
export async function runExplanationFixPreview(c: Ctx, file: CorrectionFile): Promise<StepResult> {
  const r = base(c, "explanation_fix_preview", "dry_run", { file: CORRECTION_FILE, entries: file.entries.length });
  const plans = await planEntries(c, file.entries);
  summarize(r, plans);
  r.ok = true;
  r.planHash = (r.counts.apply ?? 0) > 0 ? planHash("explanation_fix", { file: CORRECTION_FILE }, effectOf(plans)) : null;
  if (!r.planHash) r.lines.unshift("교정할 항목이 없습니다.");
  return r;
}

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;
const rpcOf = (c: Ctx): Rpc => async (fn, args) => { const { data, error } = await c.db.rpc(fn, args); if (error) throw new Error(`${fn}: ${error.message}`); return data; };

/** 한 항목의 교정: 새 초안(해설만 교체) → 렌더 점검 복사 → 공개 → 후보 연결. 기존 RPC 만 쓴다. */
export async function applyEntry(rpc: Rpc, actorId: string, p: EntryPlan): Promise<string> {
  const v = p.version!; const e = p.entry;
  const versionId = (await rpc("save_problem_draft_version", {
    p_problem_id: p.problemId, p_passage: v.passage, p_options: v.options, p_correct_index: v.correct_index, p_explanation: e.after, p_difficulty: v.difficulty, p_actor_id: actorId,
    p_answers: v.answers, p_figure: v.figure, p_figure_checked: v.figure_checked ?? false, p_statements: v.statements, p_question: v.question, p_explanation_en: e.after,
    p_evidence_target: v.evidence_target, p_evidence_span: v.evidence_span, p_answer_rationale: v.answer_rationale, p_distractor_error_types: v.distractor_error_types,
  })) as string;
  if (v.render_check != null) await rpc("set_problem_render_check", { p_version_id: versionId, p_check: v.render_check });
  await rpc("confirm_and_publish_problem_version", { p_version_id: versionId, p_actor_id: actorId });
  await rpc("ap_attach_new_version", { p_candidate_key: e.candidateKey, p_item_index: e.itemIndex, p_version_id: versionId, p_actor_id: actorId });
  return versionId;
}

/** 2단계 실행. 미리보기와 같은 계획 해시일 때만. 항목 하나가 실패하면 거기서 멈추고 이미 끝난 항목은 다음 실행에서 "이미 교정됨"이 된다(멱등). */
export async function runExplanationFix(c: Ctx, file: CorrectionFile, expectedHash: string | null | undefined, limit = 40): Promise<StepResult> {
  const r = base(c, "explanation_fix", "execute", { file: CORRECTION_FILE, entries: file.entries.length });
  if (!gate(c, r, true, expectedHash)) return r;
  const plans = await planEntries(c, file.entries);
  summarize(r, plans);
  r.planHash = planHash("explanation_fix", { file: CORRECTION_FILE }, effectOf(plans));
  r.ok = (r.counts.apply ?? 0) > 0;
  if (!r.ok) { r.blocked = "교정할 항목이 없습니다."; return r; }
  if (!checkHash(r, expectedHash, true)) return r;
  await auditReady(c);
  const rpc = rpcOf(c); let done = 0;
  const todo = plans.filter((p) => p.state === "apply").slice(0, limit);
  try { for (const p of todo) { await applyEntry(rpc, c.actorId, p); done++; } }
  catch (e) { r.executed = done > 0; r.ok = false; r.blocked = `${done}건 교정 후 중단: ${(e as Error).message}`; r.counts = { ...r.counts, appliedNow: done }; return r; }
  r.executed = true; r.counts = { ...r.counts, appliedNow: done, remaining: (r.counts.apply ?? 0) - done };
  r.lines.push(`${done}건 새 버전 공개·연결 완료${(r.counts.apply ?? 0) > done ? `. 남은 ${(r.counts.apply ?? 0) - done}건은 이어서 다시 미리보기 → 실행하세요.` : ". 다음: 세트 새 버전 초안(교정 반영) → 기존 '새 버전 공개'."}`);
  return r;
}

// ── 세트 반영: 공개 세트 → 교정된 새 문제 버전을 쓰는 version_no+1 초안 ──────────────
export type RefreshCreateFn = (sourceSetId: string) => Promise<{ newSetId: string; versionNo: number; refreshed: number }>;
type StaleRow = { problem_id: string; problem_version_id: string; position: number; section: string };
export async function staleItems(c: Ctx, setId: string): Promise<{ total: number; stale: number }> {
  const { data: items, error } = await c.db.from("mock_exam_set_items").select("problem_id, problem_version_id, section, position").eq("exam_set_id", setId);
  if (error) throw new Error(error.message);
  const rows = (items ?? []) as StaleRow[]; const ids = [...new Set(rows.map((x) => x.problem_id))]; const cur = new Map<string, string | null>();
  for (const part of chunk(ids, 100)) { const { data, error: pe } = await c.db.from("problems").select("id, published_version_id").in("id", part); if (pe) throw new Error(pe.message); for (const p of data ?? []) cur.set(p.id as string, p.published_version_id as string | null); }
  return { total: rows.length, stale: rows.filter((x) => { const v = cur.get(x.problem_id); return !!v && v !== x.problem_version_id; }).length };
}

export async function runRefreshDraft(c: Ctx, sourceSetId: string, execute: boolean, expectedHash: string | null | undefined, createFn: RefreshCreateFn): Promise<StepResult> {
  const r = base(c, "set_refresh_draft", execute ? "execute" : "dry_run", { sourceSetId });
  if (execute && !gate(c, r, true, expectedHash)) return r;
  const { data: s, error } = await c.db.from("mock_exam_sets").select("id, name, version_no, status, exam_program, format, set_group_id").eq("id", sourceSetId).single();
  if (error || !s) throw new Error(error?.message ?? "세트를 찾을 수 없습니다.");
  const set = s as { name: string; version_no: number; status: string; exam_program: string; format: string; set_group_id: string };
  const problems: string[] = [];
  if (set.exam_program !== "ap" || set.format !== "ap_fixed") problems.push("고정형 AP 세트만 반영합니다.");
  if (set.status !== "published") problems.push("공개 중인 세트에서만 새 버전 초안을 만듭니다.");
  const { count: drafts } = await c.db.from("mock_exam_sets").select("id", { count: "exact", head: true }).eq("set_group_id", set.set_group_id).eq("status", "draft");
  if ((drafts ?? 0) > 0) problems.push("같은 계열에 이미 초안이 있습니다. 공개하거나 보관한 뒤 다시 하세요.");
  const st = await staleItems(c, sourceSetId);
  if (st.stale === 0) problems.push("교정된 새 문제 버전을 쓸 문항이 없습니다(먼저 설명 수정 새 버전을 실행하세요).");
  r.counts = { items: st.total, refreshed: st.stale };
  r.lines = problems.length ? problems : [`${set.name} v${set.version_no} → v${set.version_no + 1} 초안: ${st.total}문항 중 ${st.stale}문항이 교정된 새 문제 버전을 씁니다(본문·선지·정답은 그대로). 공개본·응시·답안·결과는 바뀌지 않습니다. 다음: 초안을 확인한 뒤 '새 버전 공개'.`];
  r.ok = problems.length === 0; if (!r.ok) r.blocked = "새 버전 초안을 만들 수 없는 상태입니다.";
  r.planHash = r.ok ? planHash("set_refresh_draft", { sourceSetId }, { v: set.version_no, stale: st.stale }) : null;
  if (!r.ok || !execute || !checkHash(r, expectedHash, true)) return r;
  await auditReady(c);
  const out = await createFn(sourceSetId);
  r.executed = true; r.scope = { ...r.scope, newSetId: out.newSetId, versionNo: out.versionNo };
  r.lines.push(`v${out.versionNo} 초안 ${out.newSetId} 생성(교정 반영 ${out.refreshed}문항).`);
  return r;
}
