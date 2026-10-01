// 선지 순서 교정 반영 스크립트 (2026-10-01) — apply_problem_option_reorders RPC(20261990000000)로 검수 통과 후보를 제자리 갱신한다.
//
// 실행:
//   npx tsx scripts/mock-exam-generation/position-fix-apply.ts                       # 드라이런(읽기 전용): 후보 → 현재 원격 버전 매칭·stale·참조 여부 집계
//   npx tsx scripts/mock-exam-generation/position-fix-apply.ts --execute --limit 20  # 앞에서 20건만 실제 반영(소규모 먼저)
//   npx tsx scripts/mock-exam-generation/position-fix-apply.ts --execute             # 전체 반영
//   npx tsx scripts/mock-exam-generation/position-fix-apply.ts --revert-batch <batchId>   # 그 배치의 적용을 모두 되돌림
// 대상 DB = .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. 원격에 돌릴 때는 총괄이 환경을 지정한다.
// 후보 파일: --file(기본 data/mock-exam-generation/position-fix/apply-candidates.json). 재검수 통과분은 --extra-ok <result.json> 로 gid 를 더한다.
// 재실행 안전: RPC 가 현재 내용=expected 일 때만 쓰고(이미 after 면 already), 사용된 버전(세트·과제·신고 등)은 건너뛴다.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (n: string) => process.argv.includes(n);

type Content = { options: string[]; correctIndex: number; explanation: string; explanationEn?: string | null };
type Cand = { gid: string; before: Content; after: Content; perm: number[]; rewriteMethod?: string; verification?: string };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SECRET_KEY!;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 가 필요합니다.");
const admin = createClient(url, key, { auth: { persistSession: false } });
const snake = (c: Content) => ({ options: c.options, correct_index: c.correctIndex, explanation: c.explanation, explanation_en: c.explanationEn ?? null });

async function main() {
  const actorRes = await admin.from("profiles").select("id").eq("role", "admin").order("created_at", { ascending: true }).limit(1);
  const actor = actorRes.data?.[0]?.id as string | undefined;
  if (!actor) throw new Error("관리자 프로필을 찾지 못했습니다.");

  if (arg("--revert-batch")) {
    const batch = arg("--revert-batch")!;
    const { data: rows, error } = await admin.from("problem_option_reorders").select("id").eq("batch_id", batch).eq("kind", "apply");
    if (error) throw new Error(error.message);
    const tally: Record<string, number> = {};
    for (const r of rows ?? []) {
      const { data, error: e } = await admin.rpc("revert_problem_option_reorder", { p_reorder_id: r.id, p_actor_id: actor });
      if (e) throw new Error(e.message);
      const st = (data as { status: string }).status;
      tally[st] = (tally[st] ?? 0) + 1;
    }
    console.log(`되돌리기 ${rows?.length ?? 0}건:`, tally);
    return;
  }

  const file = arg("--file") ?? "data/mock-exam-generation/position-fix/apply-candidates.json";
  let cands = JSON.parse(readFileSync(file, "utf-8")) as Cand[];
  const extra = arg("--extra-ok");
  if (extra) {
    const okGids = new Set((JSON.parse(readFileSync(extra, "utf-8")) as { gid: string; ok: boolean }[]).filter((r) => r.ok).map((r) => r.gid));
    const pool = JSON.parse(readFileSync("data/mock-exam-generation/position-fix/apply-candidates.needs-rereview.json", "utf-8")) as Cand[];
    const have = new Set(cands.map((c) => c.gid));
    for (const c of pool) if (okGids.has(c.gid) && !have.has(c.gid)) cands.push(c);
  }
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;
  if (limit) cands = cands.slice(0, limit);

  // gid → 공개 버전(현재 버전) 조회 — 50개씩.
  const byGid = new Map<string, { id: string; options: string[]; correct_index: number; explanation: string; explanation_en: string | null; status: string }>();
  for (let i = 0; i < cands.length; i += 50) {
    const chunk = cands.slice(i, i + 50).map((c) => c.gid);
    // 모의고사용은 quality.mockExamGeneration.gid, 일반용은 quality.generalGeneration.gid 에 식별자가 있다.
    for (const path of ["mockExamGeneration", "generalGeneration"] as const) {
      const { data, error } = await admin
        .from("problem_versions")
        .select("id, options, correct_index, explanation, explanation_en, status, quality")
        .in(`quality->${path}->>gid`, chunk)
        .eq("status", "published");
      if (error) throw new Error(`버전 조회 실패: ${error.message}`);
      for (const v of (data ?? []) as unknown as { id: string; options: string[]; correct_index: number; explanation: string; explanation_en: string | null; status: string; quality: Record<string, { gid?: string } | undefined> }[]) {
        const g = v.quality?.[path]?.gid;
        if (g) byGid.set(g, v);
      }
    }
  }

  const items: { cand: Cand; versionId: string }[] = [];
  const missing: string[] = [];
  for (const c of cands) {
    const v = byGid.get(c.gid);
    if (!v) { missing.push(c.gid); continue; }
    // 원격 DB 에 영어 해설이 저장돼 있지 않으면(임포트가 explanation_en 을 비워 둠) 영어 해설은 비교도 반영도 하지 않는다.
    const adapted: Cand = v.explanation_en == null
      ? { ...c, before: { ...c.before, explanationEn: null }, after: { ...c.after, explanationEn: null } }
      : c;
    items.push({ cand: adapted, versionId: v.id });
  }
  console.log(`후보 ${cands.length}건 · 원격 공개 버전 매칭 ${items.length}건 · 원격에 없음 ${missing.length}건`);

  const tally: Record<string, number> = {};
  const skipped: { gid: string; reason: string }[] = [];
  let batchIds: string[] = [];
  for (let i = 0; i < items.length; i += 50) {
    const slice = items.slice(i, i + 50);
    if (!flag("--execute")) {
      // 드라이런: 현재 내용 일치(stale)와 참조 여부만 읽기 전용으로 센다.
      for (const it of slice) {
        const v = byGid.get(it.cand.gid)!;
        const same = JSON.stringify(v.options) === JSON.stringify(it.cand.before.options) && v.correct_index === it.cand.before.correctIndex
          && v.explanation === it.cand.before.explanation && (v.explanation_en ?? null) === (it.cand.before.explanationEn ?? null);
        const already = JSON.stringify(v.options) === JSON.stringify(it.cand.after.options);
        const { data: ref } = await admin.rpc("problem_option_reorder_referenced", { p_version_id: it.versionId });
        const st = already ? "already" : !same ? "stale" : ref ? `referenced:${ref}` : "would_apply";
        tally[st] = (tally[st] ?? 0) + 1;
        if (st !== "would_apply" && st !== "already") skipped.push({ gid: it.cand.gid, reason: st });
      }
      continue;
    }
    const payload = slice.map((it) => ({
      version_id: it.versionId, expected: snake(it.cand.before), after: snake(it.cand.after), perm: it.cand.perm,
      method: it.cand.rewriteMethod ?? null, verification: it.cand.verification ?? null,
    }));
    const { data, error } = await admin.rpc("apply_problem_option_reorders", { p_items: payload, p_actor_id: actor });
    if (error) throw new Error(`반영 실패(${i}~): ${error.message}`);
    const out = data as { batchId: string; results: { version_id: string; status: string; reason?: string }[] };
    batchIds.push(out.batchId);
    for (const r of out.results) {
      const k = r.reason ? `${r.status}:${r.reason}` : r.status;
      tally[k] = (tally[k] ?? 0) + 1;
      if (r.status === "skipped") skipped.push({ gid: r.version_id, reason: r.reason ?? "" });
    }
  }
  console.log(flag("--execute") ? "반영 결과:" : "드라이런 집계:", tally);
  if (batchIds.length) console.log("batchIds:", batchIds.join(","));
  const outFile = `data/mock-exam-generation/position-fix/${flag("--execute") ? "apply" : "dryrun"}-report.json`;
  writeFileSync(outFile, JSON.stringify({ at: new Date().toISOString(), tally, batchIds, missing, skipped }, null, 1));
  console.log(`보고서: ${outFile}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
