// 관리자 'AP 재고 관리'의 서비스 함수(서버 액션이 부르는 lib/ap-admin/service.ts·load-batch.ts·launch-gate.ts)를 격리 Supabase 스택에 대해 실행하는 스모크.
// requireAdmin()(쿠키 세션)만 건너뛰고 나머지 경로(파일 읽기 → 계획 → DB 쓰기 → 감사 기록)는 서버 액션과 같다. .gz 만 있는 폴더에서 돌려 /admin 람다 환경을 모사한다.
//   SMOKE_API_URL=http://127.0.0.1:54521 SMOKE_SERVICE_KEY=<격리 스택 service_role> [SMOKE_ACTOR=<admin profile id>] [SMOKE_BATCHES=lt-p0,lt-p1a,...] npx tsx --tsconfig <repo>/tsconfig.json <repo>/scripts/dev/admin-ap-smoke.ts
// 로컬 호스트(127.0.0.1)가 아니면 실행을 거부한다(공유·원격 DB 보호).
import { createClient } from "@supabase/supabase-js";
import { STOCK_BATCHES, batchArtifactsPresent, readPassKeys } from "../../lib/ap-admin/batches";
import { fetchReviewRows, listAssignments, loadCheck, runAssemble, runConvert, runImport, runVerify, type Ctx, type StepResult } from "../../lib/ap-admin/service";
import { computeBatchStatus } from "../../lib/ap-admin/load-batch";
import { fetchLaunchGateReport } from "../../lib/ap-admin/launch-gate";
import { readSwapPlan } from "../../lib/ap-admin/new-version";
import { runNewVersionDraft, runNewVersionPreview } from "../../lib/ap-admin/new-version-service";

const url = process.env.SMOKE_API_URL ?? "", key = process.env.SMOKE_SERVICE_KEY ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost):545\d\d$/.test(url) || url.includes(":54321") || url.includes(":54421")) throw new Error("격리 스택(포트 545xx) URL 만 허용합니다.");
if (!key) throw new Error("SMOKE_SERVICE_KEY 필요");
const db = createClient(url, key, { auth: { persistSession: false } });
const c: Ctx = { db, target: { kind: "local", ref: "local", canWrite: true, reason: null }, actorId: process.env.SMOKE_ACTOR ?? "aaaaaaaa-0000-0000-0000-000000000001" };
const line = (name: string, r: StepResult) => console.log(`${r.ok && !r.blocked ? "ok  " : "FAIL"} ${name.padEnd(34)} ${r.blocked ? `blocked: ${r.blocked.slice(0, 140)}` : JSON.stringify(r.counts)}`);
async function two(name: string, f: (execute: boolean, hash?: string | null) => Promise<StepResult>) {
  try { const d = await f(false); line(`${name} dry`, d); const e = await f(true, d.planHash); line(`${name} execute`, e); if (!e.ok || e.blocked) process.exitCode = 1; }
  catch (e) { console.log(`FAIL ${name} threw: ${(e as Error).message.slice(0, 200)}`); process.exitCode = 1; }
}
async function main() {
  console.log(`cwd=${process.cwd()}`);
  const lc = await loadCheck(c); console.log("ok   load_check(before)".padEnd(40), JSON.stringify(lc.result.counts));
  for (const id of (process.env.SMOKE_BATCHES ?? "lt-p0").split(",")) {
    const b = STOCK_BATCHES.find((x) => x.id === id)!; const a = batchArtifactsPresent(b); console.log(`-- batch ${id} artifacts ${JSON.stringify(a)} passKeys=${readPassKeys(b).length}`);
    await two(`${id} import`, (ex, h) => runImport(c, id, ex, h));
    await two(`${id} render`, (ex, h) => runVerify(c, "render", id, ex, h));
    await two(`${id} screen`, (ex, h) => runVerify(c, "screen", id, ex, h));
    await two(`${id} convert`, (ex, h) => runConvert(c, id, ex, h));
  }
  const rows = await fetchReviewRows(db); const conv = new Set<string>();
  const { data } = await db.from("ap_candidate_items").select("candidate_key").not("problem_id", "is", null).range(0, 999); for (const x of data ?? []) conv.add(x.candidate_key as string);
  const st = computeBatchStatus(STOCK_BATCHES.filter((b) => batchArtifactsPresent(b).passKeys).map((b) => ({ id: b.id, keys: readPassKeys(b) })), rows, conv);
  console.log("ok   batch_status".padEnd(40), JSON.stringify(st.filter((s) => (process.env.SMOKE_BATCHES ?? "lt-p0").split(",").includes(s.id))));
  console.log("ok   assignments".padEnd(40), listAssignments().length, "reports");
  if (process.env.SMOKE_ASSEMBLE) { const [file, setId] = process.env.SMOKE_ASSEMBLE.split(":"); await two(`assemble ${setId}`, (ex, h) => runAssemble(c, file, setId, undefined, ex, h)); }
  if (process.env.SMOKE_NEWVERSION) { // "<plan 파일>" — 방금 저장한 초안 세트(plan.set 이름 접두)를 공개하고 새 버전 미리보기·초안을 만든다.
    const plan = readSwapPlan(process.env.SMOKE_NEWVERSION);
    const { data: sets } = await db.from("mock_exam_sets").select("id, name, status").eq("exam_program", "ap").order("created_at", { ascending: false });
    const src = (sets ?? []).find((x) => String(x.name).includes(plan.sourceSetName)) ?? (sets ?? [])[0];
    console.log("-- new version source", JSON.stringify(src), "plan", plan.set, plan.swaps.length, "swaps");
    if (src.status !== "published") { const { error } = await db.rpc("mock_exam_publish_set", { p_set_id: src.id, p_actor_id: c.actorId }); console.log(error ? `FAIL publish: ${error.message}` : "ok   publish source set"); }
    const pv = await runNewVersionPreview(c, src.id as string, plan.swaps); line("new_version preview", pv); console.log("     ", pv.preview.issues.slice(0, 5).join(" | "));
    const create = async (srcId: string, swaps: { section: string; position: number; problemId: string }[]) => { const { data, error } = await db.rpc("mock_exam_create_new_version", { p_source_set_id: srcId, p_swaps: swaps.map((x) => ({ section: x.section, position: x.position, problem_id: x.problemId })), p_actor_id: c.actorId }); if (error) throw new Error(error.message); const r = data as { newSetId: string; versionNo: number; swapped: number }; return r; };
    const dr = await runNewVersionDraft(c, src.id as string, plan.swaps, pv.planHash, create as never); line("new_version draft", dr);
  }
  const g = await fetchLaunchGateReport(db); console.log("ok   launch_gate".padEnd(40), JSON.stringify({ sets: g.sets.length }));
  const lc2 = await loadCheck(c); console.log("ok   load_check(after)".padEnd(40), JSON.stringify(lc2.result.counts));
}
main().catch((e) => { console.error("FAIL", e); process.exit(1); });
