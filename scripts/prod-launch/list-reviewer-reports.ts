// 검수 결과 CSV(읽기 전용): 문제 오류 신고를 세트·문항 위치·신고자·유형·메모·판정과 함께 뽑는다.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... \
//   npx tsx scripts/prod-launch/list-reviewer-reports.ts [--reviewers-only] [--since YYYY-MM-DD] [--out file.csv]
// 쓰기 호출 없음. 서비스 키는 출력하지 않는다. --reviewers-only: auth.users.app_metadata.external_reviewer=true 인 신고자만.
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}

export const COLUMNS = ["reported_at", "set_name", "module", "position", "skill", "difficulty", "problem_id", "problem_version_id", "report_type", "memo", "reporter_name", "reporter_email", "reporter_is_external_reviewer", "verdict", "verdict_note", "verdict_at"];

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다."); process.exit(2); }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = arg("--since"); const onlyReviewers = process.argv.includes("--reviewers-only");

  let reports: Record<string, any>[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("problem_error_reports").select("*").order("created_at", { ascending: true }).range(from, from + 999);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q; if (error) throw new Error(error.message);
    reports = reports.concat(data ?? []); if ((data ?? []).length < 1000) break;
  }
  const uniq = <T,>(l: T[]) => [...new Set(l.filter(Boolean))] as T[];
  const itemIds = uniq(reports.map((r) => r.mock_set_item_id));
  const items = new Map<string, any>();
  for (let i = 0; i < itemIds.length; i += 200) {
    const { data } = await db.from("mock_exam_set_items").select("id,exam_set_id,position,module_key,skill_code,difficulty").in("id", itemIds.slice(i, i + 200));
    (data ?? []).forEach((x) => items.set(x.id, x));
  }
  const setIds = uniq([...items.values()].map((x) => x.exam_set_id));
  const sets = new Map<string, string>();
  if (setIds.length) { const { data } = await db.from("mock_exam_sets").select("id,name").in("id", setIds); (data ?? []).forEach((s) => sets.set(s.id, s.name)); }
  const verdictIds = uniq(reports.map((r) => r.resolved_verdict_id));
  const verdicts = new Map<string, any>();
  if (verdictIds.length) { const { data } = await db.from("problem_error_verdicts").select("id,decision,note,decided_at").in("id", verdictIds); (data ?? []).forEach((v) => verdicts.set(v.id, v)); }
  const reporterIds = uniq(reports.map((r) => r.reporter_id));
  const people = new Map<string, { name: string; email: string; reviewer: boolean }>();
  for (const id of reporterIds) {
    const { data: u } = await db.auth.admin.getUserById(id);
    const { data: p } = await db.from("profiles").select("name").eq("id", id).maybeSingle();
    people.set(id, { name: p?.name ?? "", email: u?.user?.email ?? "", reviewer: u?.user?.app_metadata?.external_reviewer === true });
  }
  const rows = reports
    .filter((r) => !onlyReviewers || people.get(r.reporter_id)?.reviewer)
    .map((r) => {
      const it = items.get(r.mock_set_item_id); const v = verdicts.get(r.resolved_verdict_id); const who = people.get(r.reporter_id);
      return { reported_at: r.created_at, set_name: it ? sets.get(it.exam_set_id) ?? "" : "", module: it?.module_key ?? "", position: it?.position ?? "", skill: it?.skill_code ?? "", difficulty: it?.difficulty ?? "", problem_id: r.problem_id, problem_version_id: r.problem_version_id, report_type: r.report_type, memo: r.memo ?? "", reporter_name: who?.name ?? "", reporter_email: who?.email ?? "", reporter_is_external_reviewer: who?.reviewer ?? false, verdict: v?.decision ?? "", verdict_note: v?.note ?? "", verdict_at: v?.decided_at ?? "" };
    });
  const csv = toCsv(rows, COLUMNS);
  const out = arg("--out");
  if (out) { writeFileSync(out, csv, { mode: 0o600 }); console.error(`${rows.length} rows -> ${out}`); } else process.stdout.write(csv);
}

if (process.argv[1]?.endsWith("list-reviewer-reports.ts")) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
