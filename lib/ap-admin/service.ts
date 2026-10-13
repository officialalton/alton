// AP 재고 관리 서비스 계층: 점검·적재·검증 기록·변환·초안 세트 저장. 서버 액션(app/admin/ap-stock-actions.ts)이 requireAdmin 뒤에서 호출한다.
// 모든 쓰기 단계는 dry-run(미리보기) → 같은 계획 해시로 execute. INSERT 또는 검증 표식·변환 RPC 만 쓰며, 게시 세트·응시·답안·결과는 읽지도 쓰지도 않는다
// (예외: 초안 저장 전 겹침 확인을 위해 비보관 AP 풀 세트의 문항 id 를 읽기만 한다).
import type { SupabaseClient } from "@supabase/supabase-js";
import { convertCandidate, type CandidateRow } from "../ap-exam/convert-run";
import { planConversion } from "../ap-exam/convert";
import type { ExistingRow } from "../ap-generation/import-merge";
import type { RenderReportRow, ScreenEntry } from "../ap-generation/verify-guard";
import { assertCanWrite, type StockTarget } from "./env-guard";
import { batchArtifactsPresent, batchById, listAssignReports, readAssignReport, readDefectScan, readEvidence, readItems, readPassKeys, readRenderReport, STOCK_BATCHES } from "./batches";
import { computeLoadCheck, type ReviewStatusRow } from "./load-check";
import { buildCandidateRows, buildHistoryRows, EXISTING_COLUMNS, parseDefectScan, planImport } from "./import-plan";
import { planHash } from "./plan-hash";
import { decideRender, decideScreen, type VerifyDbRow } from "./verify-plan";
import { planDraftSet, stockItems, type FullSetUsage, type PoolRow, type SetKeys } from "./assemble-draft";
import { planPartialDraftSet } from "./partial-draft";
import { readPartialPlan } from "./batches";
import { reservedKeyMap } from "./reserved-keys";
import { published } from "../../scripts/ap-generation/assign-pool";

export type AuditAction = "load_check" | "import" | "render_verify" | "screen_verify" | "convert" | "assemble_draft" | "new_version_preview" | "new_version_draft" | "new_version_publish" | "set_access_tier" | "explanation_fix_preview" | "explanation_fix" | "set_refresh_draft";
export type StepResult = {
  action: AuditAction; mode: "dry_run" | "execute"; executed: boolean; target: { ref: string; kind: string; canWrite: boolean; reason: string | null };
  scope: Record<string, unknown>; counts: Record<string, number>; lines: string[]; planHash: string | null; blocked: string | null; ok: boolean;
};
export type Ctx = { db: SupabaseClient; target: StockTarget; actorId: string; now?: () => number };

const MAX_LINES = 60;
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
export const base = (c: Ctx, action: AuditAction, mode: "dry_run" | "execute", scope: Record<string, unknown>): StepResult => ({ action, mode, executed: false, target: { ref: c.target.ref, kind: c.target.kind, canWrite: c.target.canWrite, reason: c.target.reason }, scope, counts: {}, lines: [], planHash: null, blocked: null, ok: true });
export const cap = (lines: string[]) => (lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `… 외 ${lines.length - MAX_LINES}건`] : lines);

/** 감사 로그 기록(append-only). 실패해도 이미 끝난 작업을 되돌리지 않고 호출자에게 경고를 돌려준다. */
export async function recordRun(c: Ctx, r: StepResult, status: "ok" | "refused" | "error", note?: string): Promise<string | null> {
  const { error } = await c.db.from("ap_stock_admin_runs").insert({ actor_id: c.actorId, action: r.action, mode: r.mode, status, target_ref: c.target.ref, scope: r.scope, counts: r.counts, plan_hash: r.planHash, note: note ?? r.blocked ?? null });
  return error ? error.message : null;
}
/** execute 전에 감사 테이블이 쓸 수 있는지 확인(읽을 수 없으면 쓰기 시작 전에 중단). */
export async function auditReady(c: Ctx) {
  const { error } = await c.db.from("ap_stock_admin_runs").select("id", { head: true, count: "exact" }).limit(1);
  if (error) throw new Error(`감사 로그 테이블(ap_stock_admin_runs)에 접근할 수 없어 쓰기를 시작하지 않습니다: ${error.message}`);
}
export function gate(c: Ctx, r: StepResult, execute: boolean, expected?: string | null) {
  if (!execute) return true;
  try { assertCanWrite(c.target); } catch (e) { r.blocked = (e as Error).message; r.ok = false; return false; }
  if (!expected) { r.blocked = "미리보기(dry-run)를 먼저 실행하고 같은 계획을 확인한 뒤 실행하세요."; r.ok = false; return false; }
  return true;
}
export function checkHash(r: StepResult, expected: string | null | undefined, execute: boolean) {
  if (execute && expected !== r.planHash) { r.blocked = "미리보기 이후 계획이 달라졌습니다(DB 상태 변경). 미리보기를 다시 실행하세요."; r.ok = false; return false; }
  return true;
}

// ── (1) 적재 점검(읽기 전용) ─────────────────────────────────────────────
export async function fetchReviewRows(db: SupabaseClient): Promise<ReviewStatusRow[]> {
  const rows: ReviewStatusRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("ap_item_review_status_v").select("candidate_key, review_state, render_verified, screen_verified, review_env_ready").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ReviewStatusRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
export async function loadCheck(c: Ctx) {
  const batches = STOCK_BATCHES.filter((b) => { const a = batchArtifactsPresent(b); return a.passKeys; }).map((b) => ({ id: b.id, label: b.title, keys: readPassKeys(b) }));
  const rows = await fetchReviewRows(c.db);
  const chk = computeLoadCheck(batches, rows);
  const r = base(c, "load_check", "dry_run", {}); r.counts = { batches: chk.batches.length, keys: chk.totals.keys, ready: chk.totals.ready, shortBatches: chk.totals.shortBatches, dbRows: chk.totals.dbRows };
  return { result: r, check: chk };
}

// ── (2a) 후보 적재 ───────────────────────────────────────────────────────
export async function runImport(c: Ctx, batchId: string, execute: boolean, expectedHash?: string | null): Promise<StepResult> {
  const b = batchById(batchId); const r = base(c, "import", execute ? "execute" : "dry_run", { batchId });
  if (!b.itemsFile || !b.loadLabel) { r.ok = false; r.blocked = "이 배치는 이미 적재돼 있어 적재 단계가 없습니다(렌더·화면 기록만)."; return r; }
  if (!gate(c, r, execute, expectedHash)) return r;
  const items = readItems(b);
  const { data: subs, error } = await c.db.from("subjects").select("id, ap_subject_code").not("ap_subject_code", "is", null);
  if (error) throw new Error(error.message);
  const sid = new Map((subs ?? []).map((s) => [s.ap_subject_code as string, s.id as string]));
  const missing = [...new Set(items.map((i) => i.apSubjectCode))].filter((x) => !sid.has(x));
  if (missing.length) { r.ok = false; r.blocked = `AP 과목 행이 없습니다(커리큘럼 시드 먼저): ${missing.join(", ")}`; return r; }
  const scan = parseDefectScan(readDefectScan());
  const rowsNoBatch = buildCandidateRows(items, { subjectIds: sid, batchId: null, scan });
  const keys = rowsNoBatch.map((x) => x.candidate_key);
  const existing = new Map<string, ExistingRow>();
  for (const ks of chunk(keys, 150)) { const { data, error: e } = await c.db.from("ap_candidate_items").select(EXISTING_COLUMNS).in("candidate_key", ks); if (e) throw new Error(e.message); for (const x of data ?? []) existing.set(x.candidate_key as string, x as unknown as ExistingRow); }
  const plan = planImport(rowsNoBatch, existing); const s = plan.summary;
  r.counts = { items: items.length, insert: s.insert, update: s.update, unchanged: s.unchanged, preserveOnly: s.preserveOnly, verifiedPreserved: s.verifiedPreserved, convertedPreserved: s.convertedPreserved, payloadSkipped: s.payloadSkipped, stateConflictsKept: s.stateConflictsKept, stateUpgrades: s.stateUpgrades, upgradesOnVerifiedOrConverted: s.upgradesOnVerifiedOrConverted };
  r.planHash = planHash("import", r.scope, { insert: plan.results.filter((x) => x.m.action === "insert").map((x) => x.key), update: plan.results.filter((x) => x.m.action === "update").map((x) => ({ k: x.key, p: Object.keys(x.m.patch ?? {}).sort() })) });
  r.lines = cap([`배치 ${b.title} → ${b.loadLabel}${b.supplement ? " (보조 적재: 배치 행은 현재 배치 아님, 후보 행은 현재 재고)" : ""}`, ...plan.results.filter((x) => x.m.flags.verified).slice(0, 20).map((x) => `보존(검증·변환됨): ${x.key}`)]);
  if (!checkHash(r, expectedHash, execute)) return r;
  if (!execute) return r;
  await auditReady(c);
  const { error: be } = await c.db.from("ap_load_batches").upsert(b.supplement ? { label: b.loadLabel, is_current: false, note: "supplement batch (admin stock screen; loading is not publication)" } : { label: b.loadLabel, note: "current stock load (admin stock screen)" }, { onConflict: "label" });
  if (be) throw new Error(be.message);
  const { data: bd } = await c.db.from("ap_load_batches").select("id").eq("label", b.loadLabel).single();
  const rows = buildCandidateRows(items, { subjectIds: sid, batchId: bd?.id ?? null, scan });
  const final = planImport(rows, existing);
  const inserts = final.results.filter((x) => x.m.action === "insert").map((x) => x.m.row!);
  for (const part of chunk(inserts, 50)) { const { error: e } = await c.db.from("ap_candidate_items").insert(part); if (e) throw new Error(e.message); }
  const updates = final.results.filter((x) => x.m.action === "update");
  for (const part of chunk(updates, 20)) await Promise.all(part.map(async (x) => { const { error: e } = await c.db.from("ap_candidate_items").update(x.m.patch!).eq("candidate_key", x.key); if (e) throw new Error(`${x.key}: ${e.message}`); }));
  const hist = buildHistoryRows(items);
  for (const part of chunk(hist, 200)) { const { error: e } = await c.db.from("ap_candidate_review_history").upsert(part, { onConflict: "candidate_key,run_label,gate_version" }); if (e) throw new Error(e.message); }
  r.executed = true; r.counts = { ...r.counts, insertedNow: inserts.length, updatedNow: updates.length, historyRows: hist.length };
  return r;
}

// ── (2b) 렌더·화면 검증 기록 ─────────────────────────────────────────────
async function verifyRows(c: Ctx, keys: string[]): Promise<VerifyDbRow[]> {
  const out: VerifyDbRow[] = [];
  for (const ks of chunk(keys, 100)) {
    const { data, error } = await c.db.from("ap_candidate_items").select("candidate_key, ap_subject_code, kind, payload, render_verified, screen_verified, screen_evidence, defect_flags").eq("is_current", true).eq("review_state", "auto_passed").is("problem_id", null).in("candidate_key", ks);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as VerifyDbRow[]));
  }
  return out;
}
const DEADLINE_MS = 40_000;
export async function runVerify(c: Ctx, kind: "render" | "screen", batchId: string, execute: boolean, expectedHash?: string | null): Promise<StepResult> {
  const b = batchById(batchId); const action: AuditAction = kind === "render" ? "render_verify" : "screen_verify";
  const r = base(c, action, execute ? "execute" : "dry_run", { batchId });
  if (!gate(c, r, execute, expectedHash)) return r;
  const keys = readPassKeys(b); const rows = await verifyRows(c, keys);
  const skipped: string[] = []; const todo: { row: VerifyDbRow; evidence: Record<string, unknown> }[] = []; let already = 0, relabeled = 0;
  const notInDb = keys.length - rows.length;
  if (kind === "render") {
    const report = readRenderReport(); const byKey = new Map<string, RenderReportRow>(report.results.map((x) => [x.key, x]));
    for (const row of rows) { const d = decideRender(row, byKey.get(row.candidate_key), "data/ap/render-check/report.json"); if (d.action === "already") already++; else if (d.action === "skip") skipped.push(`${row.candidate_key}: ${d.reason}`); else todo.push({ row, evidence: d.evidence! }); }
  } else {
    const ev = readEvidence(b); const byCand = new Map<string, ScreenEntry[]>();
    for (const e of ev.entries) (byCand.get(e.candidate_key) ?? byCand.set(e.candidate_key, []).get(e.candidate_key)!).push(e);
    for (const row of rows) {
      const es = byCand.get(row.candidate_key);
      if (!es) { skipped.push(`${row.candidate_key}: 화면 증거 항목 없음`); continue; }
      const d = decideScreen(row, es, ev, process.cwd(), { skipScreenshotFiles: true });
      if (d.action === "already") already++; else if (d.action === "skip") skipped.push(`${row.candidate_key}: ${d.reason}`); else { if (d.action === "relabel") relabeled++; todo.push({ row, evidence: d.evidence! }); }
    }
  }
  r.counts = { passKeys: keys.length, dbTargets: rows.length, notLoadedOrNotEligible: notInDb, toRecord: todo.length, relabel: relabeled, alreadyVerified: already, skipped: skipped.length };
  r.planHash = planHash(action, r.scope, todo.map((x) => ({ k: x.row.candidate_key, h: (x.evidence as { contentHash?: string }).contentHash })).sort((a, z) => a.k.localeCompare(z.k)));
  r.lines = cap(skipped.map((s) => `건너뜀 ${s}`));
  if (!checkHash(r, expectedHash, execute)) return r;
  if (!execute) return r;
  await auditReady(c);
  const t0 = (c.now ?? Date.now)(); let done = 0;
  for (const part of chunk(todo, 10)) {
    if ((c.now ?? Date.now)() - t0 > DEADLINE_MS) break;
    await Promise.all(part.map(async (x) => { const { error } = await c.db.rpc("ap_set_verification", { p_candidate_key: x.row.candidate_key, p_render: kind === "render" ? true : null, p_screen: kind === "screen" ? true : null, p_evidence: x.evidence, p_actor: c.actorId }); if (error) throw new Error(`${x.row.candidate_key}: ${error.message}`); }));
    done += part.length;
  }
  r.executed = true; r.counts = { ...r.counts, recordedNow: done, remaining: todo.length - done };
  if (done < todo.length) r.lines.unshift(`시간 제한으로 ${done}건만 기록했습니다. 남은 ${todo.length - done}건은 미리보기부터 다시 실행하세요(멱등).`);
  return r;
}

// ── (3) 문제은행 변환(mock_exam 고정) ────────────────────────────────────
const CONVERT_LIMIT = 20;
export async function runConvert(c: Ctx, batchId: string, execute: boolean, expectedHash?: string | null): Promise<StepResult> {
  const b = batchById(batchId); const r = base(c, "convert", execute ? "execute" : "dry_run", { batchId, purpose: "mock_exam" });
  if (!gate(c, r, execute, expectedHash)) return r;
  const keys = readPassKeys(b); const cands: { row: Record<string, unknown>; cand: CandidateRow }[] = []; let notReady = 0, alreadyConverted = 0;
  for (const ks of chunk(keys, 100)) {
    const { data, error } = await c.db.from("ap_candidate_items").select("candidate_key, ap_subject_code, kind, keyword_code, difficulty_provisional, payload, purpose, problem_id, review_env_ready").eq("is_current", true).in("candidate_key", ks);
    if (error) throw new Error(error.message);
    for (const x of data ?? []) {
      if (x.problem_id || x.purpose) { alreadyConverted++; continue; }
      if (!x.review_env_ready) { notReady++; continue; }
      cands.push({ row: x, cand: { candidateKey: x.candidate_key, apSubjectCode: x.ap_subject_code, kind: x.kind, payload: x.payload, keywordCode: x.keyword_code, difficultyProvisional: x.difficulty_provisional } });
    }
  }
  const skipped: string[] = []; const ok: CandidateRow[] = [];
  for (const { cand } of cands) { const p = planConversion(cand); if (p.ok) ok.push(cand); else skipped.push(`${cand.candidateKey}: ${p.reason}`); }
  const batch = ok.slice(0, CONVERT_LIMIT);
  r.counts = { passKeys: keys.length, convertible: ok.length, thisRun: batch.length, alreadyConverted, notReviewReady: notReady, skipped: skipped.length };
  r.planHash = planHash("convert", r.scope, batch.map((x) => x.candidateKey).sort());
  r.lines = cap([...(ok.length > batch.length ? [`한 번에 최대 ${CONVERT_LIMIT}건씩 변환합니다. 남은 ${ok.length - batch.length}건은 이어서 다시 실행하세요.`] : []), ...skipped.map((s) => `건너뜀 ${s}`)]);
  if (!checkHash(r, expectedHash, execute)) return r;
  if (!execute) return r;
  await auditReady(c);
  const t0 = (c.now ?? Date.now)(); let done = 0; const st: Record<string, number> = {};
  for (const cand of batch) {
    if ((c.now ?? Date.now)() - t0 > DEADLINE_MS) break;
    const res = await convertCandidate(c.db as never, cand, "mock_exam", c.actorId); st[res.status] = (st[res.status] ?? 0) + 1; done++;
  }
  r.executed = true; r.counts = { ...r.counts, convertedNow: st.converted ?? 0, skippedNow: st.skipped ?? 0, remaining: batch.length - done };
  return r;
}

// ── (4) 세트 배정 검증 → 초안 세트 저장 ──────────────────────────────────
export function listAssignments() {
  return listAssignReports().map((f) => ({ file: f, sets: readAssignReport(f).sets.map((s) => ({ id: s.id, virtual: (s.virtual?.length ?? 0) + (s.frqVirtual?.length ?? 0), saveable: /^(AB|BC)\d$/.test(s.id) && s.id !== "AB1" })) }));
}
/** 비보관 AP 세트의 문항 사용 현황. fullOnly 면 풀 모의고사(full_practice)만, 아니면 부분 연습 세트까지 전부. */
export async function fetchApSetUsage(db: SupabaseClient, fullOnly: boolean): Promise<FullSetUsage[]> {
  let q = db.from("mock_exam_sets").select("id, name, status, ap_label").eq("exam_program", "ap").neq("status", "archived");
  if (fullOnly) q = q.eq("ap_label", "full_practice");
  const { data: sets, error } = await q;
  if (error) throw new Error(error.message);
  if (!sets?.length) return [];
  const { data: items, error: ie } = await db.from("mock_exam_set_items").select("exam_set_id, problem_id").in("exam_set_id", sets.map((s) => s.id as string));
  if (ie) throw new Error(ie.message);
  const pids = [...new Set((items ?? []).map((i) => i.problem_id as string))];
  const keyOf = new Map<string, string>();
  for (const ps of chunk(pids, 150)) { const { data, error: e } = await db.from("ap_candidate_problems").select("problem_id, candidate_key").in("problem_id", ps); if (e) throw new Error(e.message); for (const x of data ?? []) keyOf.set(x.problem_id as string, x.candidate_key as string); }
  return sets.map((s) => { const mine = (items ?? []).filter((i) => i.exam_set_id === s.id).map((i) => i.problem_id as string); return { id: s.id as string, name: s.name as string, status: s.status as string, label: (s.ap_label as string | null) ?? undefined, problemIds: mine, candidateKeys: mine.map((p) => keyOf.get(p)).filter((k): k is string => !!k) }; });
}
export const fetchFullSetUsage = (db: SupabaseClient) => fetchApSetUsage(db, true);
export type AccessTier = "free" | "tutoring";
export async function runAssemble(c: Ctx, reportFile: string, setId: string, name: string | undefined, execute: boolean, expectedHash?: string | null, tier: AccessTier = "free"): Promise<StepResult> {
  if (tier !== "free" && tier !== "tutoring") throw new Error("공개 범위는 무료 또는 튜터링이어야 합니다.");
  const r = base(c, "assemble_draft", execute ? "execute" : "dry_run", { reportFile, setId, name: name ?? null, tier });
  if (!gate(c, r, execute, expectedHash)) return r;
  const rep = readAssignReport(reportFile); const s = rep.sets.find((x) => x.id === setId);
  if (!s) { r.ok = false; r.blocked = `보고서에 세트 ${setId} 가 없습니다.`; return r; }
  const keys: SetKeys = { mcA: s.mcA, mcB: s.mcB, frqA: s.frqA, frqB: s.frqB };
  const all = [...keys.mcA, ...keys.mcB, ...keys.frqA, ...keys.frqB];
  const pool: PoolRow[] = [];
  for (const ks of chunk(all, 100)) { const { data, error } = await c.db.from("ap_candidate_items").select("candidate_key, kind, keyword_code, difficulty_provisional, purpose, is_current, render_verified, screen_verified, ap_candidate_problems(item_index, problem_id, problem_version_id)").in("candidate_key", ks); if (error) throw new Error(error.message); pool.push(...((data ?? []) as unknown as PoolRow[])); }
  const existing = await fetchFullSetUsage(c.db); const pub = published();
  const plan = planDraftSet({ setId, keys, hasVirtual: (s.virtual?.length ?? 0) + (s.frqVirtual?.length ?? 0) > 0, name, pool, existingFullSets: existing, publishedKeys: new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]), stock: stockItems() });
  r.counts = { mc: plan.composition.mcTotal, frq: plan.composition.frqTotal, items: plan.items.length, problems: plan.problems.length };
  r.scope = { ...r.scope, name: plan.name, subject: plan.subject };
  r.lines = cap(plan.ok ? [`저장할 초안: ${plan.name} (${plan.subject}) — MC ${plan.composition.mcTotal} (A ${plan.composition.mcA} + B ${plan.composition.mcB}) / FRQ ${plan.composition.frqTotal} (A ${plan.composition.frqA} + B ${plan.composition.frqB}). 상태 draft, 공개 안 함. 공개 때 적용할 범위: ${tier === "free" ? "무료" : "튜터링"}.`] : plan.problems);
  r.ok = plan.ok; if (!plan.ok) r.blocked = "검증 위반이 있어 저장할 수 없습니다.";
  r.planHash = plan.ok ? planHash("assemble_draft", r.scope, plan.items.map((i) => `${i.sectionKey}:${i.position}:${i.problemId}`)) : null;
  if (!plan.ok || !checkHash(r, expectedHash, execute)) return r;
  if (!execute) return r;
  await auditReady(c);
  const { data: id, error } = await c.db.rpc("ap_admin_create_draft_set", { p_name: plan.name, p_subject: plan.subject, p_label: "full_practice", p_layout: plan.layout, p_items: plan.items.map((i) => ({ section: i.sectionKey, position: i.position, problem_id: i.problemId, problem_version_id: i.versionId, sat_domain: i.satDomain, difficulty: i.difficulty })) });
  if (error) throw new Error(error.message);
  // 초안은 DB 가드 때문에 free 로 저장할 수 없다 → 공개 때 적용할 범위를 planned_access_tier 에 적어 둔다(공개 RPC 가 사용).
  const { error: te } = await c.db.rpc("ap_admin_set_access_tier", { p_set_id: id, p_tier: tier, p_actor_id: c.actorId });
  if (te) { r.executed = true; r.ok = false; r.blocked = `초안은 저장했지만 공개 범위 지정에 실패했습니다: ${te.message}`; return r; }
  r.executed = true; r.lines.push(`초안 세트 ${id as string} 저장(공개 안 함, 공개 범위 ${tier === "free" ? "무료" : "튜터링"}).`);
  return r;
}

// ── (5) 부분 연습 세트 초안 저장(풀·부분 세트 전체와 겹침 0) ────────────────────────────────
export async function runAssemblePartial(c: Ctx, planFile: string, setId: string, execute: boolean, expectedHash?: string | null, tier: AccessTier = "free"): Promise<StepResult> {
  if (tier !== "free" && tier !== "tutoring") throw new Error("공개 범위는 무료 또는 튜터링이어야 합니다.");
  const r = base(c, "assemble_draft", execute ? "execute" : "dry_run", { planFile, setId, tier, partial: true });
  if (!gate(c, r, execute, expectedHash)) return r;
  const plan0 = readPartialPlan(planFile); const set = plan0.sets.find((x) => x.id === setId);
  if (!set) { r.ok = false; r.blocked = `계획 파일에 세트 ${setId} 가 없습니다.`; return r; }
  const all = [...set.keys.mcA, ...set.keys.mcB, ...set.keys.frqA, ...set.keys.frqB];
  const pool: PoolRow[] = [];
  for (const ks of chunk(all, 100)) { const { data, error } = await c.db.from("ap_candidate_items").select("candidate_key, kind, keyword_code, difficulty_provisional, purpose, is_current, render_verified, screen_verified, ap_candidate_problems(item_index, problem_id, problem_version_id)").in("candidate_key", ks); if (error) throw new Error(error.message); pool.push(...((data ?? []) as unknown as PoolRow[])); }
  const existing = await fetchApSetUsage(c.db, false);
  const plan = planPartialDraftSet({ set, subject: plan0.subject, pool, existingSets: existing, reservedKeys: reservedKeyMap(), stock: stockItems() });
  r.counts = { mc: plan.composition.mcTotal, frq: plan.composition.frqTotal, items: plan.items.length, problems: plan.problems.length, units: plan.units.length, graphMc: plan.stats.graphMc };
  r.scope = { ...r.scope, name: plan.name, subject: plan.subject, partial: plan.partial };
  const units = plan.units.length === 1 ? `Unit ${plan.units[0]}` : `Units ${plan.units.join(", ")}`;
  r.lines = cap(plan.ok ? [`저장할 초안: ${plan.name} (${plan.subject}) — MC ${plan.composition.mcTotal} / FRQ ${plan.composition.frqTotal}${plan.stats.short ? " (짧은 연습)" : ""}. 다루는 단원: ${units}. 비보관 AP 세트 ${existing.length}개·예약 문항과 겹침 0. 상태 draft, 공개 안 함. 공개 때 적용할 범위: ${tier === "free" ? "무료" : "튜터링"}.`] : plan.problems);
  r.ok = plan.ok; if (!plan.ok) r.blocked = "검증 위반이 있어 저장할 수 없습니다.";
  r.planHash = plan.ok ? planHash("assemble_draft", r.scope, plan.items.map((i) => `${i.sectionKey}:${i.position}:${i.problemId}`)) : null;
  if (!plan.ok || !checkHash(r, expectedHash, execute)) return r;
  if (!execute) return r;
  await auditReady(c);
  const { data: id, error } = await c.db.rpc("ap_admin_create_partial_draft_set", { p_name: plan.name, p_subject: plan.subject, p_label: plan.label, p_layout: plan.layout, p_items: plan.items.map((i) => ({ section: i.sectionKey, position: i.position, problem_id: i.problemId, problem_version_id: i.versionId, sat_domain: i.satDomain, difficulty: i.difficulty })) });
  if (error) throw new Error(error.message);
  const { error: te } = await c.db.rpc("ap_admin_set_access_tier", { p_set_id: id, p_tier: tier, p_actor_id: c.actorId });
  if (te) { r.executed = true; r.ok = false; r.blocked = `초안은 저장했지만 공개 범위 지정에 실패했습니다: ${te.message}`; return r; }
  r.executed = true; r.lines.push(`초안 세트 ${id as string} 저장(공개 안 함, 공개 범위 ${tier === "free" ? "무료" : "튜터링"}).`);
  return r;
}
