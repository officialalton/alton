// 외부 감사 수정 적용 계획기(2026-10-13). 이 스크립트는 DB 에 쓰지 않는다 — 읽기 전용 SELECT(`supabase db query --linked`, 총괄의 CLI 로그인)로 현재 공개 버전을 읽고,
// 문항별 전/후 diff 와 실행 SQL 파일(한 트랜잭션)·롤백 SQL·검증 SELECT 를 만든다. 쓰기는 총괄이 SQL 파일을 직접 실행한다.
//   npx tsx scripts/audit/apply-audit-fixes.ts --dry-run [--print-sql] [--only S-01,S-02] [--no-ap]
//        [--emit-sql data/audit/out/apply.sql] [--emit-rollback .../rollback.sql] [--emit-verify .../verify.sql]
//        [--readout-in data/audit/2026-10-13-db-readout.json]  (저장된 readout 으로 오프라인 재계획)  [--readout-out <file>]  [--status-out <file>]
// 대상: SAT 패치 목록(S-*/R-*/D-*/F-*/Q-*/C-*/U-*/A-*) + 영어 해설 수동 패치(E-*) + AP 그래프 FRQ 3건(초기값 지문). 멱등: 이미 반영된 항목은 "already", 옛 값과 다르면 "needs_owner".
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { planConversion } from "../../lib/ap-exam/convert";
import { planPatch, planSets, formatDiff, type Overrides, type Patch, type PatchPlan, type ProblemReadout, type SetRow } from "../../lib/audit-fix/plan";
import { emitApplySql, emitRollbackSql, emitVerifySql, toSqlPlan } from "../../lib/audit-fix/sql";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;

/** 읽기 전용 가드: 하나의 SELECT/WITH 문만. 따옴표·달러 인용 리터럴을 지운 뒤 쓰기 키워드가 있으면 거부. */
export function assertSelectOnly(sql: string): void {
  const stripped = sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "''").replace(/'(?:[^']|'')*'/g, "''");
  if (!/^\s*(select|with)\b/i.test(stripped)) throw new Error("SELECT/WITH 문만 허용됩니다.");
  if (/;\s*\S/.test(stripped)) throw new Error("여러 문장은 허용되지 않습니다.");
  if (/\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|call|do|copy|vacuum|set|reset|lock|notify|listen|comment)\b/i.test(stripped.replace(/"[^"]*"/g, '""'))) throw new Error("쓰기/DDL 키워드가 있어 거부합니다.");
}
export function dbSelect<T = Record<string, unknown>>(sql: string): T[] {
  assertSelectOnly(sql);
  const r = spawnSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024, cwd: process.cwd() });
  if (r.status !== 0) throw new Error(`supabase db query 실패: ${(r.stderr || r.stdout).slice(0, 500)}`);
  const m = r.stdout.slice(r.stdout.indexOf("{"));
  return (JSON.parse(m) as { rows: T[] }).rows;
}
const lit = (s: string) => { if (s.includes("$q$")) throw new Error("dollar tag in literal"); return `$q$${s}$q$`; };
const uuidArr = (ids: string[]) => (ids.length ? `array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]` : "array[]::uuid[]");
const textArr = (xs: string[]) => (xs.length ? `array[${xs.map(lit).join(",")}]::text[]` : "array[]::text[]");

export const PROBLEM_SELECT = (where: string) => `select p.id as problem_id, p.published_version_id, p.status::text as pstatus, p.format::text as pformat, p.usage_scope, p.exam_system, p.skill_code, p.ap_candidate_key, p.ap_item_index,
  (select pv.quality->'mockExamGeneration'->>'gid' from problem_versions pv where pv.problem_id = p.id and pv.quality->'mockExamGeneration'->>'gid' is not null order by pv.version_no limit 1) as gid,
  (select jsonb_agg(jsonb_build_object('id', v.id, 'no', v.version_no, 'status', v.status) order by v.version_no) from problem_versions v where v.problem_id = p.id) as versions,
  (select to_jsonb(v) - 'created_by' - 'published_by' - 'submitted_by' from problem_versions v where v.id = p.published_version_id) as pub,
  (select jsonb_agg(jsonb_build_object('set_id', s.id, 'set_name', s.name, 'set_version', s.version_no, 'set_status', s.status, 'format', s.format, 'section', i.section, 'position', i.position,
          'module_key', i.module_key, 'route', i.route, 'item_version_id', i.problem_version_id) order by s.name, s.version_no)
     from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id and s.status in ('published', 'draft') where i.problem_id = p.id) as placements
  from problems p where ${where} order by p.id`;

type SatList = { patches: Patch[] };
export type Readout = { generatedAt: string; project: string; problems: ProblemReadout[]; sets: SetRow[]; triage: Record<string, unknown> };

/** apply 대상 패치 전부(SAT 목록 + 수동 E-* + AP FRQ). */
export function loadPatches(opts: { includeScan?: boolean } = {}): { patches: Patch[]; overrides: Overrides } {
  const sat = rd<SatList>("data/audit/2026-10-13-sat-patch-list.json").patches.map((p) => ({ ...p, kind: "sat" as const }));
  const extra = rd<SatList>("data/audit/2026-10-13-sat-extra-patches.json").patches;
  const overrides = rd<Overrides>("data/audit/2026-10-13-apply-overrides.json");
  // 현재 DB 스캔이 찾은 기계 패치(SCAN-*): 같은 틀(문제 id + 기대 공개 버전 id 로 매칭). 스캔 자체는 includeScan:false 로 읽는다.
  let scan: Patch[] = [];
  if (opts.includeScan !== false && existsSync("data/audit/2026-10-13-scan-patches.json")) scan = rd<SatList>("data/audit/2026-10-13-scan-patches.json").patches;
  return { patches: [...sat, ...extra, ...scan], overrides };
}

/** AP 그래프 FRQ 3건: 변환기(graphStatedFacts)가 만드는 지문(초기값·함수 정의)을 현재 공개 버전에 더하는 패치. */
export const AP_FRQ_KEYS = ["run1:ap_calculus_ab-f02-k5", "run1:ap_calculus_ab-f02-k9", "run1:ap_calculus_ab-f02-k10"];
export function buildApPatches(keys = AP_FRQ_KEYS): Patch[] {
  const items = rd<Record<string, unknown>[]>("data/ap/stock/items.json");
  return keys.map((k) => {
    const it = items.find((x) => x.stockKey === k) as Record<string, unknown> | undefined;
    if (!it) throw new Error(`stock item ${k} not found`);
    const cand = { candidateKey: k, apSubjectCode: it.apSubjectCode, kind: it.kind, payload: it.payload, keywordCode: it.keywordCode, difficultyProvisional: it.difficultyProvisional } as never;
    const plan = planConversion(cand);
    if (!plan.ok) throw new Error(`${k}: ${plan.reason}`);
    const passage = plan.items[0].passage;
    if (!passage) throw new Error(`${k}: conversion produced no passage (graphStatedFacts empty)`);
    return { id: `AP-${k.replace(/^run1:ap_calculus_ab-/, "")}`, apCandidateKey: k, kind: "ap" as const, why: "AP graph FRQ: initial value / function definition (stimulus.data.given/context) was never shown to students (external audit A-04). New problem version adds it as the passage, using the fixed converter (graphStatedFacts).", changes: [{ field: "passage", old: null, new: passage }] };
  });
}

function fetchReadout(patches: Patch[]): Readout {
  const gids = patches.map((p) => p.gid).filter((g): g is string => !!g);
  const pids = patches.map((p) => p.problemId).filter((g): g is string => !!g);
  const aps = patches.map((p) => p.apCandidateKey).filter((g): g is string => !!g);
  const byGid = dbSelect<ProblemReadout>(PROBLEM_SELECT(`p.id in (select pv.problem_id from problem_versions pv where pv.quality->'mockExamGeneration'->>'gid' = any (${textArr(gids)})) or p.id = any (${uuidArr(pids)}) or p.ap_candidate_key = any (${textArr(aps)})`));
  const problems = [...byGid];
  const have = new Set(byGid.map((r) => r.gid ?? ""));
  // gid 로 못 찾은 SAT 패치: 옛 지문이 같은 문제 버전으로 찾는다(임포트 때 gid 접두사가 다른 경우).
  for (const p of patches) {
    if (!p.gid || have.has(p.gid) || p.problemId || p.apCandidateKey) continue;
    const old = p.changes.find((c) => c.field === "passage")?.old;
    if (typeof old !== "string") continue;
    const rows = dbSelect<ProblemReadout>(PROBLEM_SELECT(`p.id in (select pv.problem_id from problem_versions pv where pv.passage = ${lit(old)})`));
    for (const r of rows) if (!problems.some((x) => x.problem_id === r.problem_id)) problems.push({ ...r, gid: r.gid ?? null });
  }
  const sets = dbSelect<SetRow>(`select id, set_group_id, name, version_no, status, format, access_tier, published_at, published_by, archived_at from mock_exam_sets where status in ('published', 'draft') order by name, version_no`);
  const q = (sql: string) => dbSelect(sql);
  const triage = {
    notes: "problems[] = Q1 (per patched problem: DB id, published version row `pub`, version history, every published/draft set placement incl. section/position/module/route and the set item's problem_version_id), sets[] = published/draft set rows, patchStatus[] = per-patch plan result (apply/already/needs_owner/blocked/not_in_db). q2..q5 = the triage doc's read queries (Q2 RW passage length, Q3 English explanation suspects, Q4 text search for unlocated items, Q5 AP slots). SELECT-only reads through `supabase db query --linked`.",
    q2_rw_passage_words_over_150: q(`select count(*) filter (where w > 150) as over150, count(*) filter (where length(passage)/6.0 > 150) as over150_chars6, count(*) as total from (select pv.passage, cardinality(regexp_split_to_array(trim(pv.passage), '\\s+')) as w from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id and s.status = 'published' and s.archived_at is null join problem_versions pv on pv.id = i.problem_version_id where i.section = 'rw' and pv.passage is not null) t`),
    q3_explanation_en_suspects: q(`select p.id as problem_id, pv.id as version_id, left(pv.explanation_en, 160) as explanation_en_head from problem_versions pv join problems p on p.published_version_id = pv.id where pv.explanation_en ilike any (array['%exactly one way%','%less than%adding%','%6.50 rather than%'])`),
    q4_text_search: q(`select pv.id as version_id, pv.problem_id, pv.status, left(pv.passage, 120) as passage_head from problem_versions pv where pv.passage ilike any (array['%they maintain%','%radioactive substance%','%purchase price%'])`),
    q5_ap_slots: q(`select s.name, s.version_no, s.status, i.section, i.position, p.ap_candidate_key, p.ap_item_index, p.id as problem_id, i.problem_version_id, p.published_version_id from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id join problems p on p.id = i.problem_id where p.ap_candidate_key in ('run2:ap_calculus_ab-m17-k2','s1a-final:ap_calculus_ab-m17-k1','run2:ap_calculus_ab-m17-k3','run1:ap_calculus_ab-f02-k5','run1:ap_calculus_ab-f02-k9','run1:ap_calculus_ab-f02-k10') and s.status in ('published','draft') order by 1,2,4,5`),
  };
  return { generatedAt: new Date().toISOString(), project: "worpsqwqgnspddnrtnvq", problems, sets, triage };
}

export function matchProblem(p: Patch, problems: ProblemReadout[]): ProblemReadout | null {
  if (p.problemId) return problems.find((r) => r.problem_id === p.problemId) ?? null;
  if (p.apCandidateKey) return problems.find((r) => r.ap_candidate_key === p.apCandidateKey && (r.ap_item_index ?? 0) === 0) ?? null;
  const byGid = problems.find((r) => r.gid === p.gid);
  if (byGid) return byGid;
  const old = p.changes.find((c) => c.field === "passage")?.old;
  return typeof old === "string" ? problems.find((r) => r.pub?.passage === old) ?? null : null;
}

export function planAll(patches: Patch[], readout: Readout, overrides: Overrides, now?: string): { plans: PatchPlan[]; sets: ReturnType<typeof planSets> } {
  const plans = patches.map((p) => planPatch(p, matchProblem(p, readout.problems), { overrides, now }));
  const pub = new Map(readout.problems.map((r) => [r.problem_id, r.published_version_id] as const));
  return { plans, sets: planSets(plans, readout.sets, pub) };
}

async function main() {
  const { patches: base, overrides } = loadPatches({ includeScan: !flag("--no-scan") });
  let patches = [...base, ...(flag("--no-ap") ? [] : buildApPatches())];
  const only = arg("--only")?.split(",");
  if (only) patches = patches.filter((p) => only.includes(p.id));
  const inFile = arg("--readout-in");
  const readout = inFile ? rd<Readout>(inFile) : fetchReadout(patches);
  const { plans, sets } = planAll(patches, readout, overrides);
  const roOut = arg("--readout-out");
  if (!inFile && roOut) {
    mkdirSync(path.dirname(roOut), { recursive: true });
    const patchStatus = plans.map((p) => ({ patchId: p.patchId, status: p.status, problemId: p.problemId, fromVersionNo: p.fromVersionNo, reasons: p.reasons, changed: p.changed, sets: p.placements.map((x) => `${x.set_name} v${x.set_version} ${x.section}#${x.position}`) }));
    writeFileSync(roOut, JSON.stringify({ ...readout, patchStatus }, null, 1) + "\n");
  }
  const tally: Record<string, number> = {}; for (const p of plans) tally[p.status] = (tally[p.status] ?? 0) + 1;
  console.log(`대상 ${plans.length}건: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ")}  (프로젝트 ${readout.project}, readout ${readout.generatedAt})`);
  for (const p of plans) console.log(p.status === "apply" || flag("--verbose") || p.status === "needs_owner" || p.status === "blocked" ? formatDiff(p) : `[${p.patchId}] ${p.status}${p.reasons.length ? ` — ${p.reasons[0]}` : ""}`);
  console.log(`\n세트 새 버전 ${sets.sets.length}개: ${sets.sets.map((s) => `${s.name} v${s.versionNo}→v${s.versionNo + 1} (${s.patchIds.join(",")})`).join("; ")}`);
  for (const i of sets.issues) console.log(`  세트 경고: ${i}`);
  const sqlPlan = toSqlPlan(plans, sets.sets);
  const stOut = arg("--status-out");
  if (stOut) writeFileSync(stOut, JSON.stringify({ generatedAt: readout.generatedAt, tally, plans: plans.map((p) => ({ patchId: p.patchId, gid: p.gid, problemId: p.problemId, status: p.status, reasons: p.reasons, warnings: p.warnings, changed: p.changed, fromVersionNo: p.fromVersionNo, sets: p.placements.map((x) => `${x.set_name} v${x.set_version} ${x.section}#${x.position}`) })), sets: sets.sets.map((s) => ({ name: s.name, from: s.versionNo, patches: s.patchIds, slots: s.slots })) }, null, 1) + "\n");
  const emit = (f: string | undefined, body: () => string) => { if (!f) return; mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, body()); console.log(`wrote ${f}`); };
  emit(arg("--emit-sql"), () => emitApplySql(sqlPlan));
  emit(arg("--emit-rollback"), () => emitRollbackSql(sqlPlan, sets.sets.map((s) => ({ setId: s.setId, setGroupId: s.setGroupId, accessTier: s.accessTier, publishedAt: s.publishedAt, publishedBy: s.publishedBy }))));
  emit(arg("--emit-verify"), () => emitVerifySql(sqlPlan));
  if (flag("--print-sql")) console.log("\n" + emitApplySql(sqlPlan));
  if (!flag("--dry-run") && !arg("--emit-sql") && !arg("--status-out")) console.log("\n(dry-run 전용: DB 에 쓰지 않습니다. SQL 은 --emit-sql 로 파일에 쓰고 총괄이 실행합니다.)");
}
if (process.argv[1]?.endsWith("apply-audit-fixes.ts")) main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
