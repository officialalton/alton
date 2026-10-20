// SAT 신규 13세트(Practice Test 14~26) + 오류 신고(2026-10-18) 수정본(Test 1~13 Math 20건 패치 + 20건 교체)을 비프로덕션 공유 DB 에 반영하는 "오너 한 번 실행" 스크립트.
// 기본은 dry-run(읽기만). --apply 일 때만 쓴다. 공개는 하지 않는다 — 새 세트·새 세트 버전은 전부 초안(draft)까지, 공개는 관리자 화면에서.
//
//   NEXT_PUBLIC_SUPABASE_URL=https://worpsqwqgnspddnrtnvq.supabase.co SUPABASE_SECRET_KEY=<대시보드 service_role/secret 키> npx tsx scripts/prod-open/apply-sat-expansion.ts            # dry-run
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/prod-open/apply-sat-expansion.ts --apply                                                               # 실제 반영
//
// 옵션: --steps 1,2,3,4(기본 전부) · --work-dir tmp/sat-apply · --rehearsal-local(로컬 격리 스택 리허설 전용: 127.0.0.1 허용) · --ignore-import-failures
// 단계: (0) 대상 확인 (1) adopted-all.json 임포트(--publish; 게이트 거절 8건 건너뜀) + 키워드 연결 (2) 새 은행 덤프 → 소재 분류(API 없음) → rebalance-sets 재계획
//       (3) 새 세트 14~26 초안 생성·검증(+ 새 세트에 들어갈 Math 의 오류 신고 결함 문항은 새 버전으로 패치) (4) 오류 신고: 패치 20건=새 problem_versions, 교체 20칸=새 문항,
//       Test 1~13 은 새 세트 버전(draft). 응시 기록·옛 버전·옛 세트는 읽기만 하고 삭제·덮어쓰기 하지 않는다. 모든 단계 멱등(다시 돌리면 끝난 것은 건너뜀).
// 서비스 키는 출력·로그에 남기지 않는다(자식 프로세스 출력도 가린다).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { planPatch, formatDiff, type Patch, type PatchPlan, type ProblemReadout, type VersionRow } from "../../lib/audit-fix/plan";
import { planSatErrorReportFix, type SatRow } from "../../lib/audit-fix/sat-error-report-1018";

const EXPECTED_REF = "worpsqwqgnspddnrtnvq";
const EXPECTED_IMPORT_REJECTS = 8; // 은행 게이트가 거절하는 것으로 알려진 신규 R&W 문항 수
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);
const APPLY = flag("--apply");
const LOCAL_OK = flag("--rehearsal-local");
const STEPS = new Set((arg("--steps") ?? "1,2,3,4").split(",").map((s) => s.trim()));
const WORK = path.resolve(arg("--work-dir") ?? "tmp/sat-apply");

const EXPAND = "data/mock-exam-generation/sat-expand-20261015/final";
const ADOPTED = `${EXPAND}/adopted-all.json`;
const PROJECTED = `${EXPAND}/new-sets.json`;
const PATCHES = "data/audit/2026-10-18-sat-error-report-patches.json";
const SLOT_FILE = "data/mock-exam-generation/sat-error-report-1018/slot-replacements.json";
const NEW_FIRST = 14, NEW_LAST = 26, ITEMS_PER_SET = 147;

// ── 공통 ─────────────────────────────────────────────────
const KEY = process.env.SUPABASE_SECRET_KEY ?? "";
const redact = (s: string) => (KEY ? s.split(KEY).join("***") : s);
const log = (...a: unknown[]) => console.log(redact(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")));
const head = (t: string) => log(`\n══ ${t} ══`);
const warnings: string[] = [];
const warn = (m: string) => { warnings.push(m); log(`  ! ${m}`); };
const summary: Record<string, unknown> = {};

function runChild(script: string, args: string[], label: string): string {
  log(`  $ ${label}`);
  const r = spawnSync("npx", ["tsx", script, ...args], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } });
  const out = redact(`${r.stdout ?? ""}${r.stderr ? `\n${r.stderr}` : ""}`);
  if (out.trim()) log(out.trimEnd().split("\n").map((l) => `    ${l}`).join("\n"));
  if (r.status !== 0) throw new Error(`${label} 실패(exit ${r.status})`);
  return out;
}
const parseJsonBlock = (s: string): Record<string, number> | null => { const m = s.match(/\{\n[\s\S]*?\n\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };
const chunk = <T,>(xs: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < xs.length; i += n) o.push(xs.slice(i, i + n)); return o; };
const n = (x: unknown) => (Array.isArray(x) ? x.length : x);
const rd = <T,>(p: string) => JSON.parse(readFileSync(path.resolve(p), "utf-8")) as T;

let db: SupabaseClient;
let actor = "";
async function paged<T = any>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(`${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
const must = <T,>(r: { data: T | null; error: { message: string } | null }, label: string): T => { if (r.error) throw new Error(`${label}: ${r.error.message}`); return r.data as T; };

// ── 세트·문항 공용 ─────────────────────────────────────────
const SET_EXCLUDE = ["id", "version_no", "status", "created_by", "created_at", "published_at", "published_by", "archived_at", "access_tier", "readiness_status", "readiness_report", "readiness_checked_at"];
const ITEM_EXCLUDE = ["id", "exam_set_id", "created_at", "m1_eligible", "m2_lower_eligible", "m2_higher_eligible"];
type ItemRow = Record<string, any> & { section: string; position: number; problem_id: string; problem_version_id: string };
const liveSetNames = (rows: any[]) => rows.filter((s) => !s.archived_at && s.status !== "archived");

async function loadSets(): Promise<any[]> {
  return paged((a, b) => db.from("mock_exam_sets").select("*").like("name", "SAT Practice Test%").order("created_at").range(a, b), "mock_exam_sets");
}
async function loadItems(setId: string): Promise<ItemRow[]> {
  return paged((a, b) => db.from("mock_exam_set_items").select("*").eq("exam_set_id", setId).order("section").order("position").range(a, b), "mock_exam_set_items");
}

async function validateDraft(setId: string, name: string, persist: boolean): Promise<{ ok: boolean; why: string }> {
  const v = must(await db.rpc("mock_exam_validate_mst_set", { p_exam_set_id: setId }), `${name} validate`) as any;
  const iss = must(await db.rpc("mock_exam_set_item_issues", { p_set_id: setId }), `${name} issues`) as { problem_id: string; issue: string | null }[];
  const bad = (iss ?? []).filter((r) => r.issue);
  const ready = !!v.ready;
  if (persist) await db.from("mock_exam_sets").update({ readiness_status: ready ? "ready" : "incomplete", readiness_report: { ...v, shortfalls: [], checkedAt: new Date().toISOString() }, readiness_checked_at: new Date().toISOString() }).eq("id", setId);
  const why = !ready ? `ready=false ${JSON.stringify({ modules: (v.modules ?? []).filter((m: any) => !m.ok), dup: v.duplicateCount, nosnap: v.missingSnapshotCount, shape: v.routeShapeViolationCount, variant: (v.variantEligibilityViolations ?? []).length, sim: (v.similarityViolations ?? []).length, elig: (v.eligibilityViolations ?? []).length, skill: (v.skillViolations ?? []).length })}` : bad.length ? `issues ${bad.slice(0, 5).map((r) => `${r.problem_id}(${r.issue})`).join(",")}` : "";
  return { ok: ready && !bad.length, why };
}

/** 초안 세트 행 + 문항을 만든다(세트 행은 source 를 복사, 문항은 호출자가 만든 행). 검증 실패하면 방금 만든 초안만 지우고 실패를 돌려준다(공개·기존 세트는 건드리지 않음). */
async function createDraft(src: any, items: Record<string, any>[], opts: { name: string; newGroup: boolean }): Promise<{ id: string; ok: boolean; why: string }> {
  const row: Record<string, any> = Object.fromEntries(Object.entries(src).filter(([k]) => !SET_EXCLUDE.includes(k)));
  row.name = opts.name; row.status = "draft"; row.created_by = actor; row.access_tier = "tutoring";
  if (opts.newGroup) { delete row.set_group_id; } else {
    const { data: vs } = await db.from("mock_exam_sets").select("version_no").eq("set_group_id", src.set_group_id);
    row.version_no = Math.max(...((vs ?? []) as any[]).map((x) => x.version_no)) + 1;
  }
  const { data: created, error } = await db.from("mock_exam_sets").insert(row).select("id").single();
  if (error || !created) throw new Error(`${opts.name}: 세트 초안 생성 실패 ${error?.message}`);
  const id = (created as any).id as string;
  const { error: iErr } = await db.from("mock_exam_set_items").insert(items.map((i) => ({ ...i, exam_set_id: id })));
  if (iErr) { await db.from("mock_exam_sets").delete().eq("id", id).eq("status", "draft"); return { id, ok: false, why: `문항 삽입 실패 ${iErr.message}` }; }
  const v = await validateDraft(id, opts.name, true);
  if (!v.ok) { await db.from("mock_exam_sets").delete().eq("id", id).eq("status", "draft"); return { id, ok: false, why: `검증 실패(초안 폐기) ${v.why}` }; }
  return { id, ok: true, why: "" };
}

// ── 문항 새 버전(패치) ─────────────────────────────────────
async function loadReadouts(problemIds: string[]): Promise<ProblemReadout[]> {
  const ids = [...new Set(problemIds)];
  const problems: any[] = [], versions: any[] = [], items: any[] = [];
  for (const c of chunk(ids, 60)) {
    problems.push(...must(await db.from("problems").select("id,status,format,usage_scope,exam_system,skill_code,published_version_id").in("id", c), "problems") as any[]);
    versions.push(...await paged((a, b) => db.from("problem_versions").select("*").in("problem_id", c).range(a, b), "problem_versions"));
    items.push(...await paged((a, b) => db.from("mock_exam_set_items").select("exam_set_id,section,position,module_key,route,problem_id,problem_version_id").in("problem_id", c).range(a, b), "items"));
  }
  const setIds = [...new Set(items.map((i) => i.exam_set_id))];
  const sets = new Map<string, any>();
  for (const c of chunk(setIds, 80)) for (const s of must(await db.from("mock_exam_sets").select("id,name,version_no,status,format,archived_at").in("id", c), "sets") as any[]) sets.set(s.id, s);
  return problems.map((p) => {
    const vs = versions.filter((v) => v.problem_id === p.id);
    const pub = vs.find((v) => v.id === p.published_version_id) ?? null;
    const placements = items.filter((i) => i.problem_id === p.id).map((i) => { const s = sets.get(i.exam_set_id); return s && !s.archived_at && (s.status === "published" || s.status === "draft") ? { set_id: s.id, set_name: s.name, set_version: s.version_no, set_status: s.status, format: s.format, section: i.section, position: i.position, module_key: i.module_key, route: i.route, item_version_id: i.problem_version_id } : null; }).filter(Boolean) as any[];
    return { problem_id: p.id, published_version_id: p.published_version_id, pstatus: p.status, pformat: p.format, usage_scope: p.usage_scope, exam_system: p.exam_system, skill_code: p.skill_code, versions: vs.map((v) => ({ id: v.id, no: v.version_no, status: v.status })), pub: pub as VersionRow | null, placements } as ProblemReadout;
  });
}

type PatchOutcome = { patchId: string; problemId: string | null; status: string; reasons: string[]; newVersionId?: string };
/** 패치 목록 → 계획(항상) → 새 problem_versions(apply 이고 --apply 일 때). 이미 반영된 것은 'already'. */
async function runPatches(label: string, patches: Patch[]): Promise<{ outcomes: PatchOutcome[]; plans: PatchPlan[] }> {
  const readouts = await loadReadouts(patches.map((p) => p.problemId!).filter(Boolean));
  const plans = patches.map((p) => {
    const ro = readouts.find((r) => r.problem_id === p.problemId) ?? null;
    // 이전 실행에서 이 패치로 만든 새 버전이 이미 공개 버전이면 완료(expectVersionId 대조보다 먼저 판단)
    if (ro?.pub && (ro.pub.quality as any)?.auditFix?.patch === p.id) return { ...planPatch({ ...p, expectVersionId: undefined }, ro, { overrides: {} }), status: "already" as const, reasons: ["이미 이 패치의 새 버전이 공개 버전"], changed: [], placements: [] } as PatchPlan;
    return planPatch(p, ro, { overrides: {} });
  });
  const tally: Record<string, number> = {}; for (const p of plans) tally[p.status] = (tally[p.status] ?? 0) + 1;
  log(`  ${label}: 패치 ${plans.length}건 — ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  for (const p of plans) {
    if (p.status === "apply") log(`    [${p.patchId}] apply problem=${p.problemId?.slice(0, 8)} v${p.fromVersionNo} 필드=${p.changed.join(",")} 세트=${[...new Set(p.placements.map((x) => x.set_name))].join(", ") || "-"}`);
    else if (p.status !== "already") log(formatDiff(p).split("\n").map((l) => `    ${l}`).join("\n"));
  }
  const outcomes: PatchOutcome[] = [];
  for (const p of plans) {
    const o: PatchOutcome = { patchId: p.patchId, problemId: p.problemId, status: p.status, reasons: p.reasons };
    if (p.status !== "apply" || !p.args || !p.problemId) { if (p.status !== "already") warn(`${label} ${p.patchId}: ${p.status} — ${p.reasons[0] ?? ""}`); outcomes.push(o); continue; }
    if (!APPLY) { outcomes.push(o); continue; }
    const a = p.args;
    const { data: vid, error } = await db.rpc("save_problem_draft_version", { p_problem_id: p.problemId, p_passage: a.passage, p_options: a.options, p_correct_index: a.correct_index, p_explanation: a.explanation, p_difficulty: a.difficulty, p_actor_id: actor, p_answers: a.answers ?? null, p_figure: a.figure ?? null, p_figure_checked: a.figure_checked, p_statements: a.statements ?? null, p_question: a.question, p_repair_status: null, p_explanation_en: a.explanation_en, p_evidence_target: a.evidence_target, p_evidence_span: a.evidence_span, p_answer_rationale: a.answer_rationale, p_distractor_error_types: a.distractor_error_types ?? null });
    if (error || !vid) { o.status = "failed"; o.reasons = [`초안 저장 실패 ${error?.message}`]; warn(`${label} ${p.patchId}: ${o.reasons[0]}`); outcomes.push(o); continue; }
    const step = async (name: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => { const { error: e } = await fn(); if (e) throw new Error(`${name}: ${e.message}`); };
    try {
      await step("render_check", () => db.rpc("set_problem_render_check", { p_version_id: vid, p_check: p.renderCheck }));
      await step("quality", () => db.rpc("set_problem_quality", { p_version_id: vid, p_quality: p.quality }));
      await step("publish", () => db.rpc("confirm_and_publish_problem_version", { p_version_id: vid, p_actor_id: actor }));
      o.status = "applied"; o.newVersionId = vid as string;
    } catch (e) { o.status = "failed"; o.reasons = [String((e as Error).message)]; warn(`${label} ${p.patchId}: 새 버전 ${vid} 마무리 실패 — ${o.reasons[0]} (초안 버전이 남아 있음; 관리자 화면에서 확인)`); }
    outcomes.push(o);
  }
  return { outcomes, plans };
}

// ══════════════════════════════════════════════════════════
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !KEY) { console.error("NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SECRET_KEY 환경변수가 필요합니다(값은 출력되지 않음)."); process.exit(2); }
  mkdirSync(WORK, { recursive: true });

  head(`0. 대상 확인 — ${APPLY ? "APPLY(쓰기)" : "DRY-RUN(읽기만)"}`);
  const u = new URL(url);
  const isLocal = /^(127\.0\.0\.1|localhost)$/.test(u.hostname);
  const ref = u.hostname.split(".")[0];
  if (isLocal) { if (!LOCAL_OK) throw new Error("로컬 URL 입니다. 리허설이면 --rehearsal-local 을 붙이세요(운영 반영은 원격 공유 DB URL 로)."); }
  else if (ref !== EXPECTED_REF || !u.hostname.endsWith(".supabase.co")) throw new Error(`대상이 ${EXPECTED_REF}.supabase.co 가 아닙니다(받은 호스트: ${u.hostname}). 중단합니다.`);
  log(`  대상: ${isLocal ? `로컬 리허설 ${u.host}` : u.host} ✓ (${EXPECTED_REF})`);
  db = createClient(url, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: admin, error: aErr } = await db.from("profiles").select("id").eq("role", "admin").order("created_at").limit(1).maybeSingle();
  if (aErr) throw new Error(`키 확인 실패(키가 service_role/secret 키가 맞는지 확인): ${aErr.message}`);
  if (!admin) throw new Error("관리자 계정을 찾지 못했습니다.");
  actor = (admin as any).id;
  for (const f of [ADOPTED, PROJECTED, PATCHES, SLOT_FILE]) if (!existsSync(path.resolve(f))) throw new Error(`입력 파일 없음: ${f} (저장소를 최신으로 받았는지 확인)`);
  const allSets = await loadSets();
  const pub = allSets.filter((s) => s.status === "published" && !s.archived_at && /^SAT Practice Test \d+$/.test(s.name));
  const nums = pub.map((s) => Number(s.name.match(/\d+/)![0])).sort((a, b) => a - b);
  log(`  공개 SAT 세트 ${pub.length}개: T${nums.join(", T")}; 전체 SAT 세트 행 ${allSets.length}`);
  const missingLive = Array.from({ length: 13 }, (_, i) => i + 1).filter((n) => !nums.includes(n));
  if (missingLive.length) throw new Error(`공개 세트 T${missingLive.join(", T")} 가 없습니다 — 예상 상태가 아닙니다.`);
  summary.target = u.host; summary.mode = APPLY ? "apply" : "dry-run";

  // ── 1. 임포트 + 키워드 ─────────────────────────────────
  let importPending = false;
  if (STEPS.has("1")) {
    head("1. 신규 R&W 임포트(--publish) + 키워드 연결");
    const out = runChild("scripts/mock-exam-generation/import.ts", ["--file", ADOPTED, "--publish", ...(APPLY ? [] : ["--dry-run"])], `import.ts adopted-all.json --publish${APPLY ? "" : " --dry-run"}`);
    const st = parseJsonBlock(out);
    if (!st) throw new Error("임포트 결과를 읽지 못했습니다.");
    summary.import = st; importPending = !APPLY && (st.created ?? 0) > 0;
    if ((st.failed ?? 0) > EXPECTED_IMPORT_REJECTS && !flag("--ignore-import-failures")) throw new Error(`임포트 실패·거절이 ${st.failed}건(예상 ${EXPECTED_IMPORT_REJECTS}건 이하). 위 사유를 확인하세요(무시하려면 --ignore-import-failures).`);
    if ((st.failed ?? 0) !== EXPECTED_IMPORT_REJECTS) warn(`게이트 거절/실패 ${st.failed}건(예상 ${EXPECTED_IMPORT_REJECTS}건)`);
    const lk = runChild("scripts/keywords/link-imported.ts", ["--file", ADOPTED, ...(APPLY ? ["--execute"] : [])], `link-imported.ts --file adopted-all.json${APPLY ? " --execute" : " (dry-run)"}`);
    summary.keywordsLog = lk.split("\n").filter((l) => /DB 매칭|삽입 완료/.test(l)).map((l) => l.trim());
  }

  // ── 2. 재계획 ──────────────────────────────────────────
  const NAMES = Array.from({ length: NEW_LAST - NEW_FIRST + 1 }, (_, i) => `SAT Practice Test ${NEW_FIRST + i}`);
  const missingNames = NAMES.filter((nm) => !liveSetNames(allSets).some((x) => x.name === nm));
  let plan: any[][] | null = null; let planNote = "";
  if ((STEPS.has("2") || STEPS.has("3")) && !missingNames.length) { head("2. 재계획 생략"); log(`  Practice Test ${NEW_FIRST}~${NEW_LAST} 가 이미 모두 있어(초안 또는 공개) 다시 계획하지 않습니다.`); }
  if ((STEPS.has("2") || STEPS.has("3")) && missingNames.length) {
    head("2. 새 은행 덤프 → 소재 분류(API 없음) → rebalance-sets 재계획");
    if (importPending) {
      plan = rd<any[][]>(PROJECTED); planNote = "dry-run: 임포트 전이라 투영 계획(proj: id)으로 표시 — --apply 에서는 임포트 뒤 실제 id 로 다시 계획";
      log(`  ${planNote}`);
    } else {
      const dumpDir = path.join(WORK, "dump");
      runChild("scripts/mock-exam-generation/dump-bank.ts", ["--out", dumpDir], "dump-bank.ts");
      runChild("scripts/prod-open/build-topics-offline.ts", ["--dump", `${dumpDir}/dump.json`, "--out", `${dumpDir}/topics.json`], "build-topics-offline.ts");
      const planDir = path.join(WORK, "plan");
      runChild("scripts/mock-exam-generation/rebalance-sets.ts", ["--dump", `${dumpDir}/dump.json`, "--weights", `${dumpDir}/weights.json`, "--topics", `${dumpDir}/topics.json`, "--out", planDir, "--total", "26", "--first-index", String(NEW_FIRST), "--max-per-module", "1", "--max-per-exam", "2", "--max-family-per-exam", "4"], "rebalance-sets.ts --total 26 --first-index 14 ...");
      plan = rd<any[][]>(path.join(planDir, "new-sets.json"));
      const rep = rd<any>(path.join(planDir, "plan-report.json"));
      log(`  재계획: 새 세트 ${plan.length}/${rep.newRequested}, 교체 후보 ${rep.swaps}건(기존 세트는 바꾸지 않으므로 무시), 중복 ${n(rep.duplicatesAcrossAllSets)}, 그룹오류 ${n(rep.groupErrors)}, 칸 누락 ${n(rep.missingCells)}, 조립 실패 ${n(rep.newPlanFailures)}`);
      summary.plan = { newSets: plan.length, newRequested: rep.newRequested, swapsIgnored: rep.swaps, dupAcross: rep.duplicatesAcrossAllSets, groupErrors: n(rep.groupErrors), missingCells: n(rep.missingCells), newPlanFailures: n(rep.newPlanFailures) };
      if (plan.length < rep.newRequested) warn(`새 세트가 ${plan.length}/${rep.newRequested} 개만 계획됐습니다 — 계획된 만큼만 만듭니다.`);
    }
    if (plan.length < missingNames.length) warn(`계획된 새 세트(${plan.length})가 만들 세트(${missingNames.length})보다 적습니다.`);
    const seen = new Map<string, number>();
    plan.forEach((items, si) => { if (items.length !== ITEMS_PER_SET) throw new Error(`계획 오류: 세트 ${NEW_FIRST + si} 문항 ${items.length}≠${ITEMS_PER_SET}`); for (const it of items) { const o = seen.get(it.problemId); if (o !== undefined) throw new Error(`계획 오류: 문항 ${it.problemId} 가 세트 ${NEW_FIRST + o}·${NEW_FIRST + si} 에 중복`); seen.set(it.problemId, si); } });
    log(`  계획 점검 ✓ 세트 ${plan.length}개 × ${ITEMS_PER_SET}문항, 세트 간 중복 0`);
  }

  // ── 3. 새 세트 초안 ────────────────────────────────────
  if (STEPS.has("3")) {
    head("3. 새 세트 Practice Test 14~26 — 초안 생성·검증(공개 안 함)");
    const planFor = new Map<string, any[]>(); missingNames.forEach((nm, j) => { if (plan && plan[j]) planFor.set(nm, plan[j]); });
    const template = pub.sort((a, b) => Number(b.name.match(/\d+/)![0]) - Number(a.name.match(/\d+/)![0]))[0];
    const toCreate = [...planFor.values()];
    const hasProj = toCreate.some((s) => s.some((i) => String(i.problemId).startsWith("proj:")));
    // 3a. 새 세트 Math 의 오류 신고 결함(같은 규칙) — 자동 패치 가능한 것은 세트에 넣기 전에 새 버전으로
    if (!hasProj && toCreate.length) {
      const mathIds = [...new Set(toCreate.flatMap((s) => s.filter((i) => i.section === "math").map((i) => i.problemId as string)))];
      const rows: any[] = [];
      for (const c of chunk(mathIds, 60)) {
        const ps = must(await db.from("problems").select("id,skill_code,published_version_id").in("id", c), "problems") as any[];
        const vs = must(await db.from("problem_versions").select("id,problem_id,passage,question,options,correct_index,explanation,explanation_en,figure").in("id", ps.map((p) => p.published_version_id).filter(Boolean)), "versions") as any[];
        for (const p of ps) { const v = vs.find((x) => x.id === p.published_version_id); if (v) rows.push({ problem_id: p.id, version_id: v.id, skill_code: p.skill_code, ...v }); }
      }
      const dyn: Patch[] = []; const manual: string[] = []; const byRule: Record<string, number> = {};
      for (const r of rows) { const hit = planSatErrorReportFix(r as SatRow); if (!hit) continue; byRule[hit.rule] = (byRule[hit.rule] ?? 0) + 1; if (hit.status === "manual") { manual.push(r.problem_id); continue; } dyn.push({ id: `E1018-N${String(dyn.length + 1).padStart(3, "0")}`, kind: "sat", problemId: r.problem_id, expectVersionId: r.version_id, why: `[${hit.rule}] ${hit.why}`, changes: hit.changes } as unknown as Patch); }
      log(`  3a. 새 세트 Math ${mathIds.length}문항 결함 점검: 자동 패치 ${dyn.length}건 · 수동 교체 필요 ${manual.length}건`, byRule);
      summary.newSetMathDefects = { auto: dyn.length, manual: manual.length, byRule };
      if (dyn.length) { const r = await runPatches("3a 새 세트 Math 패치", dyn); summary.newSetMathPatched = r.outcomes.filter((o) => o.status === "applied").length; }
      if (manual.length) warn(`새 세트 Math ${manual.length}문항은 자동 패치가 안 되는 결함(그래프+식 중복 등) — 초안에 그대로 들어가므로 공개 전 관리자 화면에서 교체하세요: ${manual.slice(0, 5).join(", ")}${manual.length > 5 ? " ..." : ""}`);
    } else if (toCreate.length) log("  3a. (dry-run 투영 계획 — 실제 id 가 없어 Math 결함 점검은 apply 에서 수행)");

    const res: { name: string; action: string; items?: number }[] = [];
    for (const name of NAMES) {
      const items = planFor.get(name) ?? [];
      const existing = liveSetNames(allSets).filter((s) => s.name === name);
      const archivedSame = allSets.filter((s) => s.name === name && (s.archived_at || s.status === "archived")).length;
      if (existing.length) {
        const s = existing[0]; const cnt = (await loadItems(s.id)).length;
        if (s.status === "draft" && cnt === ITEMS_PER_SET) { const v = await validateDraft(s.id, name, APPLY); res.push({ name, action: `이미 초안 있음(${v.ok ? "검증 통과" : `검증 실패 ${v.why}`})`, items: cnt }); if (!v.ok) warn(`${name} 기존 초안 검증 실패: ${v.why}`); }
        else { res.push({ name, action: `건너뜀: 같은 이름의 ${s.status} 세트(문항 ${cnt}) 존재` }); warn(`${name}: 같은 이름의 ${s.status} 세트가 이미 있어(문항 ${cnt}) 만들지 않았습니다.`); }
        continue;
      }
      if (!items.length) { res.push({ name, action: "만들 계획 없음(재계획에서 조립되지 않음)" }); warn(`${name}: 재계획에서 조립되지 않아 만들지 못했습니다.`); continue; }
      if (!APPLY || hasProj) { res.push({ name, action: `생성 예정(초안, 문항 ${items.length}${archivedSame ? `; 같은 이름 보관본 ${archivedSame}개는 그대로 둠` : ""})`, items: items.length }); continue; }
      // 현재 공개 버전으로 문항 행 구성
      const pids = items.map((x) => x.problemId as string);
      const ps: any[] = []; for (const c of chunk(pids, 100)) ps.push(...must(await db.from("problems").select("id,status,usage_scope,archived_at,published_version_id").in("id", c), "problems") as any[]);
      const bad = items.filter((x) => { const p = ps.find((q) => q.id === x.problemId); return !p || p.status !== "confirmed" || p.archived_at || !p.published_version_id; });
      if (bad.length) { res.push({ name, action: `실패: 확정·공개 버전 없는 문항 ${bad.length}` }); warn(`${name}: 공개 가능한 버전이 없는 문항 ${bad.length}건 — 만들지 않음`); continue; }
      const rows = items.map((x) => ({ section: x.section, position: x.position, problem_id: x.problemId, problem_version_id: ps.find((q) => q.id === x.problemId).published_version_id, sat_domain: x.domain, skill_code: x.skill, difficulty: x.difficulty, module_key: x.moduleKey, route: x.route }));
      const r = await createDraft(template, rows, { name, newGroup: true });
      res.push({ name, action: r.ok ? "초안 생성·검증 통과" : `실패: ${r.why}`, items: rows.length });
      if (!r.ok) warn(`${name}: ${r.why}`);
    }
    for (const r of res) log(`  - ${r.name}: ${r.action}`);
    summary.newSets = res;
  }

  // ── 4. 오류 신고 수정본 ────────────────────────────────
  if (STEPS.has("4")) {
    head("4. 오류 신고(2026-10-18) 수정본 — Test 1~13 Math");
    const pf = rd<{ patches: Patch[]; manual: { set: string; position: number; problemId: string; versionId: string }[] }>(PATCHES);
    // 4a. 패치 20건
    const { outcomes: patchOut } = await runPatches("4a 신고 패치", pf.patches);
    summary.patches = patchOut.map((o) => `${o.patchId}:${o.status}`);

    // 4b. 교체 20칸 — 새 문항 임포트
    log("  4b. 교체 20칸");
    const slots = rd<{ entries: { slot: any; rec: any | null }[] }>(SLOT_FILE).entries;
    const recFile = path.join(WORK, "slot-recs.json");
    writeFileSync(recFile, JSON.stringify(slots.filter((e) => e.rec).map((e) => e.rec)));
    runChild("scripts/mock-exam-generation/import.ts", ["--file", recFile, "--publish", "--no-dup-check", "--no-text-dedupe", ...(APPLY ? [] : ["--dry-run"])], `import.ts slot-recs.json --publish --no-dup-check --no-text-dedupe${APPLY ? "" : " --dry-run"}`);
    // gid → 새 문항
    const gids = slots.filter((e) => e.rec).map((e) => e.rec.gid as string);
    const byGid = new Map<string, { problem_id: string; version_id: string }>();
    {
      const vs = must(await db.from("problem_versions").select("id,problem_id,status,quality").in("quality->mockExamGeneration->>gid", gids), "gid lookup") as any[];
      for (const v of vs) { const g = v.quality?.mockExamGeneration?.gid; if (g && v.status === "published") byGid.set(g, { problem_id: v.problem_id, version_id: v.id }); }
    }
    // 같은 칸의 은행 미사용 문항(컴파일러 미지원 칸용)
    let usedProblemIds: Set<string> | null = null;
    const bankFallback = async (slot: any, itemsOfSet: ItemRow[], blocked: Set<string>): Promise<{ problem_id: string; version_id: string; group: string | null } | null> => {
      if (!usedProblemIds) {
        const live = liveSetNames(await loadSets()).map((s) => s.id);
        usedProblemIds = new Set();
        for (const c of chunk(live, 40)) for (const i of await paged((a, b) => db.from("mock_exam_set_items").select("problem_id").in("exam_set_id", c).range(a, b), "used")) usedProblemIds.add((i as any).problem_id);
        for (const s of plan ?? []) for (const i of s) usedProblemIds.add(i.problemId);
      }
      const cands = await paged((a, b) => db.from("problems").select("id,published_version_id,similarity_group").eq("skill_code", slot.skill).eq("format", slot.format).eq("difficulty", slot.difficulty).eq("status", "confirmed").eq("usage_scope", "mock_exam").is("archived_at", null).not("published_version_id", "is", null).order("id").range(a, b), "bank candidates");
      const myGroups = new Set(itemsOfSet.map((i) => i.problem_id));
      for (const c of cands as any[]) {
        if (usedProblemIds!.has(c.id) || myGroups.has(c.id) || (c.similarity_group && blocked.has(c.similarity_group))) continue;
        const v = must(await db.from("problem_versions").select("id,passage,question,options,correct_index,explanation,explanation_en,figure,status").eq("id", c.published_version_id).single(), "cand version") as any;
        if (v.status !== "published") continue;
        if (planSatErrorReportFix({ problem_id: c.id, version_id: v.id, skill_code: slot.skill, ...v } as SatRow)) continue; // 같은 결함 문항은 쓰지 않는다
        usedProblemIds!.add(c.id);
        return { problem_id: c.id, version_id: v.id, group: c.similarity_group ?? null };
      }
      return null;
    };

    // 4c. Test 1~13 새 세트 버전(draft)
    log("  4c. Test 1~13 새 세트 버전(초안)");
    const sets = liveSetNames(await loadSets());
    const patchedProblemIds = [...new Set(pf.patches.map((p) => p.problemId!).filter(Boolean))];
    const pvNow = new Map<string, string>();
    for (const c of chunk(patchedProblemIds, 80)) for (const p of must(await db.from("problems").select("id,published_version_id").in("id", c), "problems") as any[]) pvNow.set(p.id, p.published_version_id);
    const patchOk = new Set(patchOut.filter((o) => o.status === "applied" || o.status === "already").map((o) => o.problemId!));
    const patchPlanned = new Set(patchOut.filter((o) => o.status === "apply").map((o) => o.problemId!)); // dry-run: 새 버전이 만들어질 문항
    const slotsBySet = new Map<string, typeof slots>();
    for (const e of slots) (slotsBySet.get(e.slot.name) ?? slotsBySet.set(e.slot.name, []).get(e.slot.name)!).push(e);
    // 패치 문항이 들어 있는 세트도 대상 — 현재 공개 세트 전체를 훑는다.
    const liveT = sets.filter((s) => s.status === "published" && /^SAT Practice Test \d+$/.test(s.name) && Number(s.name.match(/\d+/)![0]) <= 13);
    const setReports: { name: string; action: string; repoint: number; replace: number }[] = [];
    for (const s of liveT.sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]))) {
      const items = await loadItems(s.id);
      const repointReal = items.filter((i) => patchedProblemIds.includes(i.problem_id) && (APPLY ? patchOk.has(i.problem_id) && !!pvNow.get(i.problem_id) && pvNow.get(i.problem_id) !== i.problem_version_id : patchPlanned.has(i.problem_id) || (patchOk.has(i.problem_id) && !!pvNow.get(i.problem_id) && pvNow.get(i.problem_id) !== i.problem_version_id)));
      const slotEntries = (slotsBySet.get(s.name) ?? []).filter((e) => { const it = items.find((i) => i.section === (String(e.slot.moduleKey).startsWith("rw") ? "rw" : "math") && i.position === e.slot.position); return it && it.problem_version_id === e.slot.versionId; });
      if (!repointReal.length && !slotEntries.length) { if (patchedProblemIds.some((p) => items.some((i) => i.problem_id === p)) || slotsBySet.has(s.name)) setReports.push({ name: s.name, action: "변경 없음(이미 최신이거나 대상 아님)", repoint: 0, replace: 0 }); continue; }
      const drafts = allSets.filter((x) => x.set_group_id === s.set_group_id && x.status === "draft" && !x.archived_at);
      if (drafts.length) {
        const dItems = await loadItems(drafts[0].id);
        const okRe = repointReal.every((i) => dItems.some((d) => d.problem_id === i.problem_id && d.problem_version_id === pvNow.get(i.problem_id)));
        const okSl = slotEntries.every((e) => { const it = dItems.find((d) => d.position === e.slot.position && d.section === (String(e.slot.moduleKey).startsWith("rw") ? "rw" : "math")); return it && it.problem_id !== e.slot.problemId; });
        setReports.push({ name: s.name, action: okRe && okSl ? `이미 새 버전 초안 있음(v${drafts[0].version_no})` : `충돌: 이 세트 계열에 이미 초안(v${drafts[0].version_no})이 있어 새 버전을 만들지 않음 — 공개하거나 폐기한 뒤 다시 실행`, repoint: repointReal.length, replace: slotEntries.length });
        if (!(okRe && okSl)) warn(`${s.name}: 기존 초안이 있어 건너뜀(v${drafts[0].version_no}) — 그 초안이 이번 수정을 담고 있는지 확인하세요.`);
        continue;
      }
      if (!APPLY) { setReports.push({ name: s.name, action: `새 버전 초안 생성 예정(문항 새 버전 ${repointReal.length}칸 · 문항 교체 ${slotEntries.length}칸)`, repoint: repointReal.length, replace: slotEntries.length }); continue; }
      // apply: 새 문항 확보
      const repl = new Map<string, { problem_id: string; version_id: string }>();
      let lacking = "";
      // 세트의 유사문항 그룹 규칙(noSimilarGroupRepeat): 교체 문항 그룹이 세트의 다른 문항·다른 교체 문항과 겹치면 안 된다.
      const grp = new Map<string, string | null>();
      for (const c of chunk([...new Set(items.map((i) => i.problem_id))], 100)) for (const p of must(await db.from("problems").select("id,similarity_group").in("id", c), "groups") as any[]) grp.set(p.id, p.similarity_group);
      const slotKey = (e: any) => `${String(e.slot.moduleKey).startsWith("rw") ? "rw" : "math"}:${e.slot.position}`;
      const replacedKeys = new Set(slotEntries.map(slotKey));
      const blocked = new Set<string>(items.filter((i) => !replacedKeys.has(`${i.section}:${i.position}`)).map((i) => grp.get(i.problem_id)).filter((g): g is string => !!g));
      for (const e of slotEntries) {
        let nv: { problem_id: string; version_id: string; group?: string | null } | null = e.rec ? byGid.get(e.rec.gid) ?? null : null;
        if (!nv && e.rec) log(`    #${e.slot.position}: 컴파일러 문항(${e.rec.gid})이 임포트되지 않아 은행 문항으로 대체합니다.`);
        if (nv) { const { data: pr } = await db.from("problems").select("similarity_group").eq("id", nv.problem_id).single(); nv.group = (pr as any)?.similarity_group ?? null; if (nv.group && blocked.has(nv.group)) { log(`    #${e.slot.position}: 새 문항의 유사문항 그룹(${nv.group})이 세트 안 다른 문항과 겹쳐 은행 문항으로 대체합니다.`); nv = null; } }
        if (!nv) nv = await bankFallback(e.slot, items, blocked);
        if (!nv) { lacking = `교체 칸 #${e.slot.position}(${e.slot.skill}/${e.slot.format}/${e.slot.difficulty})에 쓸 새 문항 없음`; break; }
        if (nv.group) blocked.add(nv.group);
        repl.set(slotKey(e), { problem_id: nv.problem_id, version_id: nv.version_id });
      }
      if (lacking) { setReports.push({ name: s.name, action: `실패: ${lacking}`, repoint: repointReal.length, replace: slotEntries.length }); warn(`${s.name}: ${lacking}`); continue; }
      const rows = items.map((i) => {
        const base: Record<string, any> = Object.fromEntries(Object.entries(i).filter(([k]) => !ITEM_EXCLUDE.includes(k)));
        const r = repl.get(`${i.section}:${i.position}`);
        if (r) return { ...base, problem_id: r.problem_id, problem_version_id: r.version_id, content_snapshot: null };
        if (repointReal.some((x) => x.problem_id === i.problem_id)) return { ...base, problem_version_id: pvNow.get(i.problem_id), content_snapshot: null };
        return base;
      });
      const r = await createDraft(s, rows, { name: s.name, newGroup: false });
      setReports.push({ name: s.name, action: r.ok ? `새 버전 초안 생성·검증 통과(문항 새 버전 ${repointReal.length}칸 · 교체 ${slotEntries.length}칸)` : `실패: ${r.why}`, repoint: repointReal.length, replace: slotEntries.length });
      if (!r.ok) warn(`${s.name}: ${r.why}`);
    }
    for (const r of setReports) log(`  - ${r.name}: ${r.action}`);
    summary.oldSetVersions = setReports;
  }

  head("끝");
  log(APPLY ? "공개는 하지 않았습니다 — 새 세트(14~26)와 Test 1~13 새 버전은 초안입니다. 관리자 화면에서 확인 후 공개하세요." : "dry-run 이었습니다(아무것도 쓰지 않음). 실제 반영은 같은 명령에 --apply 를 붙이세요.");
  if (warnings.length) { log(`경고 ${warnings.length}건:`); warnings.forEach((w) => log(`  ! ${w}`)); }
  writeFileSync(path.join(WORK, `summary-${APPLY ? "apply" : "dryrun"}.json`), redact(JSON.stringify({ ...summary, warnings }, null, 1)));
}
main().catch((e) => { console.error(redact(`\n중단: ${String(e?.message ?? e)}`)); process.exit(1); });
