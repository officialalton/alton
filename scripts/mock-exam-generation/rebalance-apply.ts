// 13세트 재조정 적용(2026-10-08). 기본은 dry-run(읽기 전용 조회 + 단계 출력). --execute 일 때만 쓴다. 서비스 키는 출력하지 않는다.
// 실행: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/mock-exam-generation/rebalance-apply.ts [--plan DIR] [--execute] [--only "SAT Practice Test 1,SAT Practice Test 10"]
//   DIR 기본 data/mock-exam-generation/rebalance-20261008/final (set-copies.json, new-sets.json, new-sets-meta.json)
// 동작(세트마다 멱등 — 다시 돌리면 끝난 단계는 건너뛴다):
//   T1~T9 수리본: 같은 set_group_id 의 새 버전(version_no+1, 이름 동일)을 draft 로 만들고 문항 삽입 → mock_exam_validate_mst_set ready 와 mock_exam_set_item_issues 0건 확인.
//   모든 초안이 검증을 통과한 뒤에만(1단계) 기존 공개본 이름을 "<이름> (replaced)" 로 바꾸고 보관한 다음 새 버전을 공개(2단계)하고 access_tier='free'.
//   T10~T13: 같은 이름의 보관된 세트(예: 예전 'SAT Practice Test 10~16')는 "<이름> (replaced)" 로 개명 → 새 세트 draft 생성·검증·공개·free.
// 응시 기록이 있는 세트의 문항은 바꾸지 않는다(기존 세트는 이름 변경·보관만).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export type PlanItem = { versionId: string; position: number; problemId: string; moduleKey: string; route: string | null; section: string; skill: string | null; difficulty: string; domain: string };
export type CopyJob = { kind: "copy"; name: string; oldSetId: string; items: PlanItem[] };
export type NewJob = { kind: "new"; name: string; items: PlanItem[] };
export type Job = CopyJob | NewJob;
export type SetRow = { id: string; name: string; status: "draft" | "published" | "archived"; archived_at: string | null; set_group_id: string; version_no: number; access_tier?: string | null };
export type Step =
  | { op: "skip"; reason: string }
  | { op: "rename_archived_conflict"; setId: string; from: string; to: string }
  | { op: "create_draft" }
  | { op: "insert_items" }
  | { op: "validate" }
  | { op: "swap_old"; setId: string; from: string; to: string }
  | { op: "publish" }
  | { op: "set_free" };

export const replacedName = (n: string) => `${n} (replaced)`;

/** 순수 결정 함수: 현재 DB 상태(세트 행 + 세트별 문항 수)로 이 작업에 남은 단계를 정한다. */
export function decideSteps(job: Job, sets: SetRow[], itemCount: (setId: string) => number): { phase1: Step[]; phase2: Step[]; target: SetRow | null } {
  const phase1: Step[] = [], phase2: Step[] = [];
  let target: SetRow | null = null;
  if (job.kind === "copy") {
    const old = sets.find((s) => s.id === job.oldSetId);
    if (!old) return { phase1: [{ op: "skip", reason: `기존 세트 ${job.oldSetId} 없음` }], phase2: [], target };
    target = sets.find((s) => s.set_group_id === old.set_group_id && s.version_no > old.version_no && s.name === job.name && s.status !== "archived") ?? null;
    if (target?.status === "published") {
      return { phase1: [{ op: "skip", reason: "이미 새 버전 공개됨" }], phase2: target.access_tier === "free" ? [] : [{ op: "set_free" }], target };
    }
    if (!target) phase1.push({ op: "create_draft" });
    if (!target || itemCount(target.id) === 0) phase1.push({ op: "insert_items" });
    phase1.push({ op: "validate" });
    if (old.name !== replacedName(job.name) || old.status !== "archived") phase2.push({ op: "swap_old", setId: old.id, from: old.name, to: replacedName(job.name) });
  } else {
    target = sets.find((s) => s.name === job.name && s.status !== "archived" && !s.archived_at) ?? null;
    if (target?.status === "published") return { phase1: [{ op: "skip", reason: "이미 공개됨" }], phase2: target.access_tier === "free" ? [] : [{ op: "set_free" }], target };
    for (const c of sets.filter((s) => s.name === job.name && (s.status === "archived" || s.archived_at))) phase2.push({ op: "rename_archived_conflict", setId: c.id, from: c.name, to: replacedName(job.name) });
    if (!target) phase1.push({ op: "create_draft" });
    if (!target || itemCount(target.id) === 0) phase1.push({ op: "insert_items" });
    phase1.push({ op: "validate" });
  }
  phase2.push({ op: "publish" }, { op: "set_free" });
  return { phase1, phase2, target };
}

const itemRow = (examSetId: string, x: PlanItem) => ({ exam_set_id: examSetId, section: x.section, position: x.position, problem_id: x.problemId, problem_version_id: x.versionId, sat_domain: x.domain, skill_code: x.skill, difficulty: x.difficulty, module_key: x.moduleKey, route: x.route });

export function loadJobs(dir: string, only?: string[]): Job[] {
  const rd = (f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf-8"));
  const copies = rd("set-copies.json") as { oldSetId: string; setName: string; items: PlanItem[] }[];
  const news = rd("new-sets.json") as PlanItem[][]; const meta = rd("new-sets-meta.json") as { names: string[] };
  const jobs: Job[] = [...copies.map((c): Job => ({ kind: "copy", name: c.setName, oldSetId: c.oldSetId, items: c.items })), ...news.map((items, i): Job => ({ kind: "new", name: meta.names[i], items }))];
  return only?.length ? jobs.filter((j) => only.includes(j.name)) : jobs;
}

/** 계획 자체 점검: 세트 안 problem 중복, 세트 간 problem 중복 0. */
export function checkPlan(jobs: Job[]): string[] {
  const errs: string[] = []; const seen = new Map<string, string>();
  for (const j of jobs) { const own = new Set<string>(); for (const it of j.items) { if (own.has(it.problemId)) errs.push(`${j.name}: 세트 안 중복 ${it.problemId}`); own.add(it.problemId); const o = seen.get(it.problemId); if (o && o !== j.name) errs.push(`세트 간 중복 ${it.problemId}: ${o} / ${j.name}`); seen.set(it.problemId, j.name); } }
  return errs;
}

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const execute = process.argv.includes("--execute");
  const dir = arg("--plan") ?? "data/mock-exam-generation/rebalance-20261008/final";
  const jobs = loadJobs(dir, arg("--only")?.split(","));
  const errs = checkPlan(jobs); if (errs.length) { console.error("계획 오류:\n" + errs.join("\n")); process.exit(1); }
  const envPath = path.resolve(process.cwd(), ".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SECRET_KEY 환경변수가 필요합니다(.env.local 은 읽지 않음)."); void envPath; process.exit(2); }
  console.log(`대상 호스트: ${new URL(url).host} · 모드: ${execute ? "EXECUTE" : "dry-run"} · 작업 ${jobs.length}개`);
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: sets, error } = await db.from("mock_exam_sets").select("id,name,status,archived_at,set_group_id,version_no,access_tier").like("name", "SAT Practice Test%");
  if (error) throw new Error(error.message);
  let rows = (sets ?? []) as SetRow[];
  const counts = new Map<string, number>();
  for (const s of rows) { const { count } = await db.from("mock_exam_set_items").select("id", { count: "exact", head: true }).eq("exam_set_id", s.id); counts.set(s.id, count ?? 0); }
  const { data: tmplRows } = await db.from("mock_exam_sets").select("*").eq("status", "published").is("archived_at", null).eq("format", "mst").order("created_at", { ascending: false }).limit(1);
  const template = tmplRows?.[0];
  if (!template && execute) throw new Error("템플릿으로 쓸 공개 mst 세트가 없습니다.");

  const decided = jobs.map((job) => ({ job, ...decideSteps(job, rows, (id) => counts.get(id) ?? 0) }));
  for (const d of decided) console.log(`[${d.job.kind}] ${d.job.name}: ${[...d.phase1, ...d.phase2].map((s) => (s.op === "skip" ? `skip(${s.reason})` : s.op)).join(" → ")}`);
  if (!execute) { console.log("dry-run 끝 — 쓰기 없음. 적용하려면 --execute."); return; }

  const targets = new Map<string, string>(); // job.name -> 새 세트 id
  const validateSet = async (id: string, name: string) => {
    const { data: v, error: e } = await db.rpc("mock_exam_validate_mst_set", { p_exam_set_id: id }); if (e) throw new Error(`${name}: ${e.message}`);
    const { data: iss, error: e2 } = await db.rpc("mock_exam_set_item_issues", { p_set_id: id }); if (e2) throw new Error(`${name}: ${e2.message}`);
    const bad = ((iss ?? []) as { problem_id: string; issue: string | null }[]).filter((r) => r.issue);
    const ready = (v as { ready: boolean }).ready;
    await db.from("mock_exam_sets").update({ readiness_status: ready ? "ready" : "incomplete", readiness_report: { ...(v as object), shortfalls: [], checkedAt: new Date().toISOString() }, readiness_checked_at: new Date().toISOString() }).eq("id", id);
    if (!ready || bad.length) throw new Error(`${name}: 검증 실패 ready=${ready} issues=${bad.slice(0, 5).map((r) => `${r.problem_id}(${r.issue})`).join(",")}`);
  };
  // 1단계: 모든 초안을 만들고 검증한다(기존 공개본은 건드리지 않음).
  for (const d of decided) {
    if (d.phase1[0]?.op === "skip") { if (d.target) targets.set(d.job.name, d.target.id); continue; }
    let id = d.target?.id;
    for (const st of d.phase1) {
      if (st.op === "create_draft") {
        const t = template!; const old = d.job.kind === "copy" ? rows.find((s) => s.id === (d.job as CopyJob).oldSetId)! : null;
        const groupVersions = old ? rows.filter((s) => s.set_group_id === old.set_group_id).map((s) => s.version_no) : [];
        const { data, error: e } = await db.from("mock_exam_sets").insert({ ...(old ? { set_group_id: old.set_group_id, version_no: Math.max(...groupVersions) + 1 } : {}), name: d.job.name, description: t.description, difficulty_tier: "standard", status: "draft", format: "mst",
          module_time_limits: t.module_time_limits, module_item_counts: t.module_item_counts, assembly_rules: t.assembly_rules, rw_time_limit_minutes: t.rw_time_limit_minutes, math_time_limit_minutes: t.math_time_limit_minutes, created_by: t.created_by }).select("id,name,status,archived_at,set_group_id,version_no").single();
        if (e) throw new Error(`${d.job.name}: ${e.message}`);
        id = data.id; rows = [...rows, { ...(data as SetRow), access_tier: null }]; counts.set(id!, 0);
      } else if (st.op === "insert_items") {
        const { error: e } = await db.from("mock_exam_set_items").insert(d.job.items.map((x) => itemRow(id!, x))); if (e) throw new Error(`${d.job.name}: ${e.message}`);
        counts.set(id!, d.job.items.length);
      } else if (st.op === "validate") await validateSet(id!, d.job.name);
    }
    targets.set(d.job.name, id!); console.log(`초안 검증 통과: ${d.job.name} → ${id}`);
  }
  // 2단계: 교체(이름 변경·보관) → 공개 → free.
  for (const d of decided) {
    const id = targets.get(d.job.name);
    for (const st of d.phase2) {
      if (st.op === "swap_old" || st.op === "rename_archived_conflict") {
        const { error: e } = await db.from("mock_exam_sets").update({ name: st.to, ...(st.op === "swap_old" ? { status: "archived", archived_at: new Date().toISOString() } : {}) }).eq("id", st.setId); if (e) throw new Error(`${d.job.name}: ${e.message}`);
      } else if (st.op === "publish" && id) {
        const { data: tg } = await db.from("mock_exam_sets").select("set_group_id,status").eq("id", id).single();
        if (tg?.status === "draft") {
          await db.from("mock_exam_sets").update({ status: "archived", archived_at: new Date().toISOString() }).eq("set_group_id", tg.set_group_id).eq("status", "published");
          const { error: e } = await db.from("mock_exam_sets").update({ status: "published", published_at: new Date().toISOString(), published_by: template.created_by }).eq("id", id); if (e) throw new Error(`${d.job.name}: ${e.message}`);
        }
      } else if (st.op === "set_free" && id) {
        const { error: e } = await db.from("mock_exam_sets").update({ access_tier: "free" }).eq("id", id); if (e) throw new Error(`${d.job.name}: ${e.message}`);
      }
    }
    console.log(`완료: ${d.job.name}`);
  }
}
if (process.argv[1]?.endsWith("rebalance-apply.ts")) main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
